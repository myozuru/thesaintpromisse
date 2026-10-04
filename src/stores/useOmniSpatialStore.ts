import { findCharEntity } from '@/lib/touchRange';
import { carimbarDicionario } from '@/lib/omni/dicionarioSync';
import { useMapStore } from './useMapStore';
import { comPreviaMovimento, confirmarMovimentoMapa } from '@/lib/mapa/movimentoConfirmado';
/**
 * Omni-Engine Spatial Store (Pilar 5).
 *
 * Posições em metros por personagem; mover também atualiza a peça explícita no mapa. Não modifica o schema
 * legado de Character — vive em store própria. Persistente.
 *
 * `mover(charId, x, y)` aciona o motor de auras (recalcular entrar/sair).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { recalcularAuras } from '@/lib/omni/auras';

export interface Posicao {
  _syncAt?: number;
  x: number;
  y: number;
}

interface SpatialStore {
  /** Cache local de pertencimento por cena/dono/aura; não contém posições. */
  aurasDentro: Record<string, string[]>;
  deleted: Record<string, number>;
  posicoes: Record<string, Posicao>;
  mover: (charId: string, x: number, y: number) => void;
  remover: (charId: string) => void;
  obter: (charId: string) => Posicao | undefined;
  distancia: (a: string, b: string) => number;
}

export const useOmniSpatialStore = create<SpatialStore>()(
  persist(
    (set, get) => ({
      posicoes: {},
      aurasDentro: {},
      deleted: {},
      mover: (charId, x, y) => {
        if (![x, y].every(Number.isFinite)) return;
        const ms = useMapStore.getState();
        const token = findCharEntity(ms.entities, charId);
        if (token) {
          const escala = (ms.gridConfig.dpi || 70) / (ms.gridConfig.metersPerCell || 1.5);
          comPreviaMovimento(() => ms.updateEntity(token.id, { x: x * escala, y: y * escala }));
          confirmarMovimentoMapa(token.id, token);
        }
        set((s) => ({ posicoes: { ...s.posicoes, [charId]: { x, y } } }));
        // Recalcula auras após o movimento (entrar/sair).
        recalcularAuras(charId);
      },
      remover: (charId) =>
        set((s) => {
          const { [charId]: _, ...rest } = s.posicoes;
          return { posicoes: rest };
        }),
      obter: (charId) => get().posicoes[charId],
      distancia: (a, b) => {
        const pa = get().posicoes[a];
        const pb = get().posicoes[b];
        if (!pa || !pb) return Infinity;
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        return Math.sqrt(dx * dx + dy * dy);
      },
    }),
    { name: 'omni-spatial' },
  ),
);

useOmniSpatialStore.subscribe((next, prev) => {
  const entrada = { records: next.posicoes, deleted: next.deleted };
  const out = carimbarDicionario(entrada, { records: prev.posicoes, deleted: prev.deleted });
  if (out !== entrada) useOmniSpatialStore.setState({ posicoes: out.records, deleted: out.deleted });
});
