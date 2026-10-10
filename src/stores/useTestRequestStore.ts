import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useCombatStore } from '@/stores/useCombatStore';
import type { DamageType } from '@/types';

/**
 * Pedidos de teste do Mestre → Jogador.
 *
 * O Mestre seleciona uma ficha PLAYER e dispara um pedido (atributo,
 * perícia ou teste de resistência). O jogador dono daquela ficha vê um
 * overlay full-screen com o botão para rolar o d20 daquele teste.
 *
 * Estado é sincronizado entre clientes via `useMultiplayerSync` (slice
 * `testRequests`). O resultado da rolagem fica anexado ao request para
 * que todos vejam o mesmo número.
 */

export type TestKind = 'attribute' | 'skill' | 'save';

export interface TestRequest {
  id: string;
  charId: string;
  charName: string;
  /** Perfil que deve rolar; congela o destinatário no momento do pedido. */
  targetProfileId?: string;
  /** Tipo do teste. */
  kind: TestKind;
  /** Nome do atributo/perícia/TR (ex.: "Astúcia"). */
  testName: string;
  /** CD opcional definida pelo mestre. */
  dc?: number;
  /** Se true, o jogador não vê a CD (mas o mestre vê). */
  hideDcFromPlayer?: boolean;
  /** Se true, o jogador não sabe se passou/falhou (mestre ainda vê). */
  hideOutcomeFromPlayer?: boolean;
  /** Notas opcionais do mestre. */
  note?: string;
  /** Nível de drama da rolagem 3D escolhido pelo Mestre (0 = normal … 3 = lendário). */
  drama?: 0 | 1 | 2 | 3;
  /** Mestre pediu acompanhamento e aproximação de câmera para uma rolagem individual. */
  cinematicFocus?: boolean;
  /** Ficha que força o teste (TR/perícia); habilita reações OMNI de quem protege o alvo. */
  originId?: string;
  /**
   * Bônus pré-calculado (usado quando o pedido vem de um feitiço, em que
   * a pipeline já sabe o bônus correto para aquele TR específico vs. alvo).
   * Quando definido, o overlay ignora o cálculo padrão.
   */
  /** Bônus extra do Mestre; o jogador só descobre quando o resultado aparece. */
  masterBonus?: number;
  bonusOverride?: number;
  bonusBreakdownOverride?: string;
  /** Tag para correlacionar resultado com a origem (ex.: feitiço.id + targetId). */
  sourceTag?: string;
  /** Efeito automático a resolver após a rolagem do TR. */
  auraResolution?: {
    type: 'enemy_turn_aura';
    ownerId: string;
    auraId: 'aura_macabra';
    conditionId: string;
    conditionName: string;
    conditionIcon: string;
  };
  /** Efeito de dano de uma ação de Shikigami após o alvo resolver o TR. */
  invocationResolution?: {
    kind: 'shikigami_damage_after_save';
    ownerCharacterId: string;
    invocationId: string;
    invocationInstanceId: string;
    actionId: string;
    sourceName: string;
    damageFormula: string;
    damageBonus: number;
    damageType?: DamageType;
    damageOnSuccess: 'nenhum' | 'metade';
  };
  resolutionApplied?: boolean;
  createdAt: number;
  /**
   * Preenchido quando o JOGADOR fecha o resultado na tela dele.
   * O pedido continua existindo (com o resultado) até o MESTRE dispensar,
   * para que o mestre sempre consiga ver o que saiu antes de fechar.
   */
  playerAckedAt?: number;
  /** Resultado, preenchido após o jogador rolar. */
  result?: {
    d20: number;
    bonus: number;
    /** Parte do bônus que veio do Mestre (revelada no fim). */
    masterBonus?: number;
    total: number;
    rolledAt: number;
    /** Modo da rolagem aplicada (vantagem/desvantagem). */
    advantageMode?: 'normal' | 'advantage' | 'disadvantage';
    /** Os 1-2 dados rolados (vantagem/desvantagem mostra ambos). */
    rolls?: number[];
    /** Se preenchido, o resultado foi FORÇADO por habilidade (sucesso/falha garantida). */
    forced?: { kind: 'success' | 'failure'; note?: string };
  };
}

interface TestRequestState {
  requests: TestRequest[];
  enqueue: (r: Omit<TestRequest, 'id' | 'createdAt' | 'result'>) => string;
  setResult: (id: string, result: NonNullable<TestRequest['result']>) => void;
  markResolutionApplied: (id: string) => void;
  /** Jogador confirma que viu o resultado (não remove — o mestre ainda vê). */
  ackResult: (id: string) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

export const useTestRequestStore = create<TestRequestState>()(
  persist(
    (set) => ({
      requests: [],
      enqueue: (r) => {
        const id = `tr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        set((s) => ({
          requests: [
            ...s.requests,
            { ...r, id, createdAt: Date.now() },
          ],
        }));
        return id;
      },
      setResult: (id, result) =>
        set((s) => ({
          requests: s.requests.map((x) => (x.id === id ? { ...x, result } : x)),
        })),
      markResolutionApplied: (id) =>
        set((s) => ({ requests: s.requests.map((x) => x.id === id ? { ...x, resolutionApplied: true } : x) })),
      ackResult: (id) =>
        set((s) => ({
          requests: s.requests.map((x) => (x.id === id ? { ...x, playerAckedAt: Date.now() } : x)),
        })),
      dismiss: (id) =>
        set((s) => ({ requests: s.requests.filter((x) => x.id !== id) })),
      clearAll: () => set({ requests: [] }),
    }),
    { name: 'rpg-test-requests' }
  )
);

// Reconcile pending tests because multiplayer applies requests with setState
// directly instead of passing through enqueue/setResult actions.
const pedidosComPausa = new Set<string>();
useTestRequestStore.subscribe((state) => {
  const pendentes = new Set(state.requests.filter((request) => !request.result).map((request) => request.id));
  for (const id of pendentes) {
    if (pedidosComPausa.has(id)) continue;
    pedidosComPausa.add(id);
    useCombatStore.getState().pauseTurnTimerForReaction(`test-request:${id}`);
  }
  for (const id of pedidosComPausa) {
    if (pendentes.has(id)) continue;
    pedidosComPausa.delete(id);
    useCombatStore.getState().resumeTurnTimerForReaction(`test-request:${id}`);
  }
});

// Dev-only hook for browser tests (never in production builds).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__testRequestStore = useTestRequestStore;
}
