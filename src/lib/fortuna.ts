/**
 * Postura da Fortuna — pergunta "rolar de novo?" quando o d20 de ataque ou
 * resistência sai ≤ bônus de treinamento. O novo resultado vale (mesmo pior)
 * e cada dado só pode ser rerrolado uma vez.
 */
import { create } from 'zustand';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useLogStore } from '@/stores/useLogStore';
import { fortunaElegivel, fortunaPatchUso, fortunaUsosRestantes } from '@/lib/posturas';

export interface FortunaPedido {
  id: string;
  charId: string;
  charName: string;
  d20: number;
  tipo: 'ataque' | 'resistencia';
  restantes: number;
  resolve: (sim: boolean) => void;
}

export const useFortunaStore = create<{ pedido: FortunaPedido | null; set: (p: FortunaPedido | null) => void }>((set) => ({
  pedido: null,
  set: (pedido) => set({ pedido }),
}));

export async function perguntarFortuna(
  charId: string, d20: number, tipo: 'ataque' | 'resistencia', rerolar: () => Promise<number>,
): Promise<number> {
  const c = useCharacterStore.getState().characters.find((x) => x.id === charId);
  const cb = useCombatStore.getState();
  if (!c || !cb.inCombat) return d20;
  const round = cb.round ?? 1;
  if (!fortunaElegivel(c, d20, round)) return d20;
  const sim = await new Promise<boolean>((resolve) => {
    useFortunaStore.getState().set({
      id: `${Date.now()}`, charId, charName: c.name, d20, tipo,
      restantes: fortunaUsosRestantes(c, round), resolve,
    });
  });
  useFortunaStore.getState().set(null);
  if (!sim) return d20;
  const atual = useCharacterStore.getState().characters.find((x) => x.id === charId) ?? c;
  useCharacterStore.getState().updateCharacter(charId, fortunaPatchUso(atual, round));
  const novo = await rerolar();
  useLogStore.getState().addLog('combat', `🍀 Postura da Fortuna: ${c.name} rola de novo o d20 ${tipo === 'ataque' ? 'de ataque' : 'de resistência'} — ${d20} → ${novo}.`);
  return novo;
}
