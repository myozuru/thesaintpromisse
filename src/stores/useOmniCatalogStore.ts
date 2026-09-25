/**
 * 📚 Catálogo Global do Mestre — wrapper de leitura/distribuição sobre
 * `useOmniEntidadesStore`.
 *
 * Toda EntidadeOmni salva no Construtor No-Code já fica registrada no
 * store de entidades. Este store oferece uma API explícita e amigável
 * para o tab "Catálogo": listagem, filtragem por categoria, e o método
 * `entregarParaJogador`, que clona uma entrada do catálogo como instância
 * no `useInventoryStore` do personagem escolhido.
 *
 * Não há estado próprio aqui — tudo é derivado dos stores existentes,
 * garantindo que catálogo e construtor permaneçam sempre sincronizados.
 */
import { create } from 'zustand';
import type { CategoriaEntidade, EntidadeOmni } from '@/lib/omni/tipos';
import { useOmniEntidadesStore } from './useOmniEntidadesStore';
import { useInventoryStore, type InventoryItem } from './useInventoryStore';

interface OmniCatalogState {
  /** Lista todo o catálogo (mais recentes primeiro). */
  listar: () => EntidadeOmni[];
  /** Filtra por categoria; passe `'todos'` para tudo. */
  listarPorCategoria: (cat: CategoriaEntidade | 'todos') => EntidadeOmni[];
  /** Busca uma entrada do catálogo pelo ID. */
  obter: (id: string) => EntidadeOmni | undefined;
  /**
   * Entrega uma cópia da entrada `entidadeId` para o inventário do
   * personagem `ownerId`. Retorna a instância criada (ou null se não
   * encontrar a entidade).
   */
  entregarParaJogador: (entidadeId: string, ownerId: string) => InventoryItem | null;
}

export const useOmniCatalogStore = create<OmniCatalogState>(() => ({
  listar: () => useOmniEntidadesStore.getState().listar(),

  listarPorCategoria: (cat) => {
    const todas = useOmniEntidadesStore.getState().listar();
    if (cat === 'todos') return todas;
    return todas.filter((e) => e.categoria === cat);
  },

  obter: (id) => useOmniEntidadesStore.getState().entidades[id],

  entregarParaJogador: (entidadeId, ownerId) => {
    const ent = useOmniEntidadesStore.getState().entidades[entidadeId];
    if (!ent) return null;
    return useInventoryStore.getState().add(ownerId, ent);
  },
}));
