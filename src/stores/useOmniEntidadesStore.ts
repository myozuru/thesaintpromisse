import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CategoriaEntidade, EntidadeOmni, PacoteOmni } from '@/lib/omni/tipos';
import { novaEntidade } from '@/lib/omni/tipos';
import { simplificarKeysLote, simplificarKeysEntidade } from '@/lib/omni/simplificarKeys';

interface OmniState {
  entidades: Record<string, EntidadeOmni>;
  criar: (categoria: CategoriaEntidade, nome?: string) => EntidadeOmni;
  atualizar: (id: string, patch: Partial<EntidadeOmni>) => void;
  substituir: (id: string, proximo: EntidadeOmni) => void;
  remover: (id: string) => void;
  listar: () => EntidadeOmni[];
  listarPorCategoria: (categoria: CategoriaEntidade) => EntidadeOmni[];
  exportarPacote: (nome?: string, autor?: string) => PacoteOmni;
  importarPacote: (pacote: PacoteOmni, modo?: 'mesclar' | 'substituir') => number;
  resetar: () => void;
}

export const useOmniEntidadesStore = create<OmniState>()(
  persist(
    (set, get) => ({
      entidades: {},

      criar: (categoria, nome) => {
        const ent = novaEntidade(categoria, nome);
        set((s) => ({ entidades: { ...s.entidades, [ent.id]: ent } }));
        return ent;
      },

      atualizar: (id, patch) =>
        set((s) => {
          const cur = s.entidades[id];
          if (!cur) return s;
          const merged: EntidadeOmni = {
            ...cur,
            ...patch,
            id: cur.id,
            atualizadoEm: Date.now(),
          };
          return { entidades: { ...s.entidades, [id]: simplificarKeysEntidade(merged) } };
        }),

      substituir: (id, proximo) =>
        set((s) => {
          if (!s.entidades[id]) return s;
          return {
            entidades: {
              ...s.entidades,
              [id]: simplificarKeysEntidade({ ...proximo, id, atualizadoEm: Date.now() }),
            },
          };
        }),

      remover: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.entidades;
          return { entidades: rest };
        }),

      listar: () =>
        Object.values(get().entidades).sort((a, b) => b.atualizadoEm - a.atualizadoEm),

      listarPorCategoria: (categoria) =>
        Object.values(get().entidades)
          .filter((e) => e.categoria === categoria)
          .sort((a, b) => b.atualizadoEm - a.atualizadoEm),

      exportarPacote: (nome = 'Pacote Omni', autor) => ({
        formato: 'omni-engine.v1',
        nome,
        autor,
        geradoEm: Date.now(),
        entidades: Object.values(get().entidades),
      }),

      importarPacote: (pacote, modo = 'mesclar') => {
        if (pacote.formato !== 'omni-engine.v1') return 0;
        set((s) => {
          const base = modo === 'substituir' ? {} : { ...s.entidades };
          for (const ent of pacote.entidades) {
            base[ent.id] = simplificarKeysEntidade(ent);
          }
          return { entidades: base };
        });
        return pacote.entidades.length;
      },

      resetar: () => set({ entidades: {} }),
    }),
    {
      name: 'omni-engine-entidades',
      // 🧹 Migração automática on-load: reescreve keys legadas
      // (status.vida.atual, atributos.forca…) para as canônicas curtas.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const { atualizadas, alteradas } = simplificarKeysLote(state.entidades ?? {});
        if (alteradas > 0) {
          state.entidades = atualizadas;
          // eslint-disable-next-line no-console
          console.info(`[Omni] ${alteradas} entidade(s) migradas para keys canônicas curtas.`);
        }
      },
    }
  )
);

// Dev-only hook for browser tests (never in production builds).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__omniEntStore = useOmniEntidadesStore;
}
