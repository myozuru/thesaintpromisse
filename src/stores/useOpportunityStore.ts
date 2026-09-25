/**
 * useOpportunityStore — Ataques de Oportunidade (AdO) no mapa.
 *
 * Modelo simples controlado pelo Mestre:
 *  - `grants[charId]` indica que o personagem TEM AdO disponível na rodada.
 *      • `reaction`: 1 reação (AdO clássico).
 *      • `action`:   1 ação comum extra contra o gatilho (consome a "ação"
 *                    representada aqui apenas como flag — não toca o sistema
 *                    de ações do personagem; é uma autorização do mestre).
 *      • `restrictToCharId`: se setado, só dispara contra esse alvo específico.
 *  - Ao detectar saída de adjacência (engine puro em `opportunityEngine.ts`),
 *    o mestre vê um overlay com os candidatos e resolve manualmente.
 *  - Reset automático a cada turno/encerramento de combate.
 *
 * Princípio: a store NÃO conhece motor de combate nem rola dados — só
 * autoriza. A resolução do ataque/ação é manual (clica no botão, faz a rolagem
 * na ficha normalmente). Aqui apenas consumimos o "uso" para impedir abuso.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AdoMode = 'reaction' | 'action' | 'either';

export interface AdoGrant {
  /** Tipo concedido: reação, ação comum, ou ambas (jogador escolhe na hora). */
  mode: AdoMode;
  /** Se setado, só dispara quando o alvo for este charId. */
  restrictToCharId?: string;
  /** Já consumido nesta rodada? */
  consumed?: boolean;
}

export interface AdoCandidate {
  charId: string;
  charName: string;
  /** Token (entity) no mapa. */
  entityId: string;
  /** Tipo permitido para este candidato (do grant). */
  mode: AdoMode;
}

export interface AdoPrompt {
  id: string;
  /** Quem se moveu / provocou. */
  triggerCharId: string;
  triggerCharName: string;
  triggerEntityId: string;
  candidates: AdoCandidate[];
  createdAt: number;
}

interface State {
  grants: Record<string, AdoGrant>;
  pending: AdoPrompt | null;
  grant: (charIds: string[], mode: AdoMode, restrictToCharId?: string) => void;
  revoke: (charId: string) => void;
  clearAllGrants: () => void;
  consume: (charId: string, mode: 'reaction' | 'action') => void;
  setPending: (p: AdoPrompt | null) => void;
  dismissPending: () => void;
  resetRound: () => void;
}

export const useOpportunityStore = create<State>()(
  persist(
    (set) => ({
      grants: {},
      pending: null,
      grant: (charIds, mode, restrictToCharId) =>
        set((s) => {
          const next = { ...s.grants };
          for (const id of charIds) {
            next[id] = { mode, restrictToCharId, consumed: false };
          }
          return { grants: next };
        }),
      revoke: (charId) =>
        set((s) => {
          const next = { ...s.grants };
          delete next[charId];
          return { grants: next };
        }),
      clearAllGrants: () => set({ grants: {} }),
      consume: (charId, mode) =>
        set((s) => {
          const g = s.grants[charId];
          if (!g) return {};
          // 'either' vira o modo oposto se ainda houver outro disponível?
          // Decisão: consumir totalmente (1 uso por rodada).
          void mode;
          return { grants: { ...s.grants, [charId]: { ...g, consumed: true } } };
        }),
      setPending: (p) => set({ pending: p }),
      dismissPending: () => set({ pending: null }),
      resetRound: () =>
        set((s) => {
          const next: Record<string, AdoGrant> = {};
          for (const [k, v] of Object.entries(s.grants)) {
            next[k] = { ...v, consumed: false };
          }
          return { grants: next, pending: null };
        }),
    }),
    {
      name: 'rpg-opportunity',
      partialize: (s) => ({ grants: s.grants }),
    },
  ),
);
