/**
 * useDice3DStore — fila global de rolagens para a física 3D.
 *
 * Agora é o caminho OFICIAL de toda rolagem: `requestRoll(types)` retorna
 * uma Promise que resolve com os valores em que os dados pararam.
 * `enqueueTypes`/`enqueueNotation` ainda existem para rolagens puramente
 * visuais (que não esperam resultado).
 */
import { create } from 'zustand';

import type { DiceType } from '@/components/dice-physics';
import { supabase } from '@/integrations/supabase/safeClient';

/** Canal Realtime para sincronizar configurações globais dos dados (definidas pelo mestre). */
const DICE_SETTINGS_CHANNEL = 'dice3d-settings';
let settingsChannel: ReturnType<typeof supabase.channel> | null = null;
let applyingRemoteSettings = false;
function ensureSettingsChannel() {
  if (settingsChannel) return settingsChannel;
  settingsChannel = supabase.channel(DICE_SETTINGS_CHANNEL, {
    config: { broadcast: { self: false, ack: false } },
  });
  settingsChannel.on('broadcast', { event: 'bounciness' }, ({ payload }) => {
    const v = (payload as { value?: number } | null)?.value;
    if (typeof v !== 'number') return;
    applyingRemoteSettings = true;
    try { useDice3DStore.getState()._setBouncinessLocal(v); }
    finally { setTimeout(() => { applyingRemoteSettings = false; }, 0); }
  });
  settingsChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      // Anuncia o valor atual para novos pares se este cliente já tiver um valor não-padrão.
      const v = useDice3DStore.getState().bounciness;
      settingsChannel?.send({ type: 'broadcast', event: 'bounciness', payload: { value: v } });
    }
  });
  return settingsChannel;
}

const FACE_TO_TYPE: Record<number, DiceType> = {
  4: 'D4', 6: 'D6', 8: 'D8', 10: 'D10', 12: 'D12', 20: 'D20', 100: 'D100',
};

export function notationToDiceTypes(notation: string): DiceType[] {
  const out: DiceType[] = [];
  const re = /(\d*)d(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(notation)) !== null) {
    const n = m[1] ? parseInt(m[1], 10) : 1;
    const faces = parseInt(m[2], 10);
    const type = FACE_TO_TYPE[faces];
    if (!type) continue;
    for (let i = 0; i < Math.min(n, 20); i++) out.push(type);
  }
  return out;
}

interface RollRequest {
  id: string;
  types: DiceType[];
  label?: string;
  /** Bônus fixo somado ao total, exibido na bandeja 3D. */
  bonus?: number;
  at: number;
  resolve?: (values: number[]) => void;
}

interface Dice3DState {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  visible: boolean;
  setVisible: (v: boolean) => void;
  /** Multiplicador de quique aplicado a dados e bandeja. 1 = padrão. Sincronizado entre clientes. */
  bounciness: number;
  setBounciness: (v: number) => void;
  /** @internal Aplica localmente sem reemitir (usado pelo canal Realtime). */
  _setBouncinessLocal: (v: number) => void;
  current: RollRequest | null;
  queue: RollRequest[];
  enqueueTypes: (types: DiceType[], label?: string) => void;
  enqueueNotation: (notation: string, label?: string) => void;
  /**
   * Pede uma rolagem oficial: dados rolam na bandeja 3D e o resultado é
   * devolvido pela Promise. Se 3D estiver desabilitado, gera valores via
   * RNG instantaneamente e resolve já.
   */
  requestRoll: (types: DiceType[], label?: string, bonus?: number) => Promise<number[]>;
  requestNotation: (notation: string, label?: string, bonus?: number) => Promise<number[]>;
  /** chamado pelo overlay quando termina de rolar o atual; resolve a Promise associada. */
  resolveCurrent: (values: number[]) => void;
  /** apenas avança para o próximo da fila (rolagens visuais sem promise). */
  finish: () => void;
  clear: () => void;
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const TYPE_TO_FACES: Record<DiceType, number> = {
  D4: 4, D6: 6, D8: 8, D10: 10, D12: 12, D20: 20, D100: 100,
};

function rngForTypes(types: DiceType[]): number[] {
  return types.map((t) => {
    const faces = TYPE_TO_FACES[t];
    if (faces === 100) return Math.floor(Math.random() * 10) * 10; // d100 = 0..90 (tens)
    if (faces === 10) return Math.floor(Math.random() * 10) + 1; // d10 = 1..10 (face "0" = 10)
    return Math.floor(Math.random() * faces) + 1;
  });
}

export const useDice3DStore = create<Dice3DState>((set, get) => ({
  enabled: true,
  setEnabled: (v) => set({ enabled: v }),
  visible: false,
  setVisible: (v) => set({ visible: v }),
  bounciness: 1,
  _setBouncinessLocal: (v) => set({ bounciness: Math.max(0, Math.min(2, v)) }),
  setBounciness: (v) => {
    const clamped = Math.max(0, Math.min(2, v));
    set({ bounciness: clamped });
    if (applyingRemoteSettings) return;
    const ch = ensureSettingsChannel();
    try { ch.send({ type: 'broadcast', event: 'bounciness', payload: { value: clamped } }); } catch {}
  },
  current: null,
  queue: [],
  enqueueTypes: (types, label) => {
    if (!get().enabled || types.length === 0) return;
    const req: RollRequest = { id: uid(), types, label, at: Date.now() };
    set((s) => {
      if (!s.current) return { current: req, visible: true };
      return { queue: [...s.queue, req], visible: true };
    });
  },
  enqueueNotation: (notation, label) => {
    const types = notationToDiceTypes(notation);
    if (types.length === 0) return;
    get().enqueueTypes(types, label ?? notation);
  },
  requestRoll: (types, label, bonus) => {
    if (types.length === 0) return Promise.resolve([]);
    if (!get().enabled) return Promise.resolve(rngForTypes(types));
    return new Promise<number[]>((resolve) => {
      const req: RollRequest = { id: uid(), types, label, bonus, at: Date.now(), resolve };
      set((s) => {
        if (!s.current) return { current: req, visible: true };
        return { queue: [...s.queue, req], visible: true };
      });
    });
  },
  requestNotation: (notation, label, bonus) => {
    const types = notationToDiceTypes(notation);
    return get().requestRoll(types, label ?? notation, bonus);
  },
  resolveCurrent: (values) => {
    const cur = get().current;
    if (cur?.resolve) {
      try { cur.resolve(values); } catch {}
    }
    set((s) => {
      const [next, ...rest] = s.queue;
      return { current: next ?? null, queue: rest };
    });
  },
  finish: () =>
    set((s) => {
      const [next, ...rest] = s.queue;
      return { current: next ?? null, queue: rest };
    }),
  clear: () => {
    const { current, queue } = get();
    const pending = [current, ...queue].filter(Boolean) as RollRequest[];
    pending.forEach((req) => {
      if (!req.resolve) return;
      // Cancelamento explícito nunca inventa um resultado. Uma lista vazia
      // libera os chamadores aguardando sem aplicar dano ou acerto fictício.
      try { req.resolve([]); } catch {}
    });
    set({ current: null, queue: [], visible: false });
  },
}));

// Garante que o canal Realtime esteja escutando assim que o módulo carregar,
// para que jogadores recebam o valor definido pelo mestre mesmo sem mexer no slider.
if (typeof window !== 'undefined') {
  setTimeout(() => { try { ensureSettingsChannel(); } catch {} }, 0);
}
