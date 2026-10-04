import { notificarEquiparItem } from '@/lib/omni/notificarEvento';
/**
 * Inventário dos personagens — instâncias de EntidadeOmni adquiridas.
 * Cada entrada é uma cópia "snapshot" da entidade no momento da aquisição,
 * permitindo carregar a flag isBought sem mexer no template original.
 */
import { stampInventoryChanges } from '@/lib/omni/inventorySync';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EntidadeOmni } from '@/lib/omni/tipos';

export interface InventoryItem {
  /** ID único desta instância no inventário. */
  instanceId: string;
  /** ID do personagem dono. */
  ownerId: string;
  /** Snapshot da entidade Omni (com comercio.isBought ajustado). */
  entity: EntidadeOmni;
  acquiredAt: number;
  /** Versão da instância para sincronização entre telas. */
  _syncAt?: number;
  /** Se o item está atualmente equipado em algum slot da ficha. */
  isEquipped?: boolean;
  /**
   * Identificador do slot ocupado (ex: "colar", "anel:0", "pulseira:1").
   * Vazio quando `isEquipped` for false.
   */
  equippedSlot?: string;
  /**
   * Cargas restantes desta instância (Pilar de Recursos).
   * Sincronizado com `entity.usos.total` no momento da criação.
   * `undefined` = item sem usos limitados (ilimitado).
   */
  usosRestantes?: number;
  /** Cópia do total no momento da criação para fórmulas/UI. */
  usosTotais?: number;
  /** Réplica: está materializada agora. */
  materializada?: boolean;
  /** Réplica: sustentação deste turno ainda não paga. */
  sustentacaoPendente?: boolean;
  /** Réplica: nome da arma do catálogo colocada na mão. */
  replicaArma?: string;
}

interface InventoryState {
  deleted: Record<string, number>;
  items: Record<string, InventoryItem>;
  /** Adiciona um item ao inventário do personagem (clonando a entidade). */
  add: (ownerId: string, entity: EntidadeOmni, opts?: { markBought?: boolean; instanceId?: string }) => InventoryItem;
  /** Remove uma instância. */
  remove: (instanceId: string) => void;
  /** Lista os itens de um personagem. */
  listByOwner: (ownerId: string) => InventoryItem[];
  /**
   * Equipa uma instância em um slot. Verifica se o slot está livre
   * para o mesmo dono antes de equipar; retorna `false` se ocupado.
   */
  equipItem: (instanceId: string, slotName: string) => boolean;
  /** Remove o item do slot que ocupa (se houver). */
  unequipItem: (instanceId: string) => void;
  /** Lista itens equipados de um personagem. */
  listEquipped: (ownerId: string) => InventoryItem[];
  /**
   * Consome 1 carga (ou `n`) da instância. Retorna `false` se não havia
   * cargas suficientes (chamador deve abortar a ação).
   * Para itens sem `usos`, sempre retorna `true` (uso ilimitado).
   */
  consumirUso: (instanceId: string, n?: number) => boolean;
  /** Recarrega uma instância para o total. */
  recargaInstancia: (instanceId: string) => void;
  /**
   * Recarrega todas as instâncias cujo `entity.usos.recarga` corresponda
   * ao tipo. Usado por hooks (virada de dia, fim de cena, descanso).
   */
  recargaPorTipo: (tipo: 'diaria' | 'porCena' | 'descansoCurto') => number;
  resetAll: () => void;
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `inv-${Math.random().toString(36).slice(2)}-${Date.now()}`;

/**
 * Migração leve em leitura: instâncias antigas que ainda não têm
 * `usosTotais`/`usosRestantes` mas cuja entidade ganhou config de
 * `usos` posteriormente passam a expor o contador imediatamente.
 * Isto evita perder o badge de cargas em itens criados antes do
 * pilar de Recursos.
 */
function adotarUsosSeFaltar(i: InventoryItem): InventoryItem {
  const total = i.entity?.usos?.total;
  if (total === undefined) return i;
  if (i.usosTotais !== undefined) return i;
  return { ...i, usosTotais: total, usosRestantes: i.usosRestantes ?? total };
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      items: {},
      deleted: {},

      add: (ownerId, entity, opts) => {
        const total = entity.usos?.total;
        const inst: InventoryItem = {
          instanceId: opts?.instanceId ?? uid(),
          ownerId,
          entity: {
            ...entity,
            comercio: {
              basePrice: entity.comercio?.basePrice ?? 0,
              hiddenTags: entity.comercio?.hiddenTags ?? [],
              isBought: opts?.markBought ?? entity.comercio?.isBought ?? false,
            },
          },
          acquiredAt: Date.now(),
          usosTotais: total,
          usosRestantes: total,
        };
        set((s) => ({ items: { ...s.items, [inst.instanceId]: inst } }));
        return inst;
      },

      remove: (instanceId) =>
        set((s) => {
          const { [instanceId]: _, ...rest } = s.items;
          return { items: rest };
        }),

      listByOwner: (ownerId) =>
        Object.values(get().items)
          .filter((i) => i.ownerId === ownerId)
          .map(adotarUsosSeFaltar)
          .sort((a, b) => b.acquiredAt - a.acquiredAt),

      equipItem: (instanceId, slotName) => {
        const inst = get().items[instanceId];
        if (!inst) return false;
        if (inst.isEquipped && inst.equippedSlot === slotName) return true;
        // Slot já ocupado por outra instância do mesmo dono?
        const ocupado = Object.values(get().items).some(
          (i) =>
            i.ownerId === inst.ownerId &&
            i.isEquipped &&
            i.equippedSlot === slotName &&
            i.instanceId !== instanceId,
        );
        if (ocupado) return false;
        set((s) => ({
          items: {
            ...s.items,
            [instanceId]: { ...inst, isEquipped: true, equippedSlot: slotName },
          },
        }));
        notificarEquiparItem(instanceId);
        return true;
      },

      unequipItem: (instanceId) =>
        set((s) => {
          const cur = s.items[instanceId];
          if (!cur) return s;
          return {
            items: {
              ...s.items,
              [instanceId]: { ...cur, isEquipped: false, equippedSlot: undefined },
            },
          };
        }),

      listEquipped: (ownerId) =>
        Object.values(get().items)
          .filter((i) => i.ownerId === ownerId && i.isEquipped)
          .map(adotarUsosSeFaltar),

      consumirUso: (instanceId, n = 1) => {
        const stored = get().items[instanceId];
        const cur = stored ? adotarUsosSeFaltar(stored) : undefined;
        if (!cur) return false;
        // Item sem usos limitados — passa direto.
        if (cur.usosRestantes === undefined || cur.usosTotais === undefined) return true;
        if (cur.usosRestantes < n) return false;
        set((s) => ({
          items: {
            ...s.items,
            [instanceId]: { ...cur, usosRestantes: (cur.usosRestantes ?? 0) - n },
          },
        }));
        return true;
      },

      recargaInstancia: (instanceId) =>
        set((s) => {
          const cur = s.items[instanceId];
          if (!cur || cur.usosTotais === undefined) return s;
          return {
            items: {
              ...s.items,
              [instanceId]: { ...cur, usosRestantes: cur.usosTotais },
            },
          };
        }),

      recargaPorTipo: (tipo) => {
        let n = 0;
        set((s) => {
          const next = { ...s.items };
          for (const inst of Object.values(s.items)) {
            const recarga = inst.entity.usos?.recarga;
            if (recarga === tipo && inst.usosTotais !== undefined) {
              if (inst.usosRestantes !== inst.usosTotais) {
                next[inst.instanceId] = { ...inst, usosRestantes: inst.usosTotais };
                n++;
              }
            }
          }
          return { items: next };
        });
        return n;
      },

      resetAll: () => set({ items: {} }),
    }),
    {
      name: 'omni-inventory',
      // Após carregar do localStorage, normaliza instâncias antigas que
      // ainda não tinham `usosTotais` mas cuja entidade tem `usos.total`.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const next: Record<string, InventoryItem> = {};
        for (const [id, inst] of Object.entries(state.items)) {
          next[id] = adotarUsosSeFaltar(inst);
        }
        state.items = next;
      },
    },
  ),
);

// Dev-only hook for browser tests (never in production builds).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__inventoryStore = useInventoryStore;
}

// Antes dos subscribers de rede: carimba mutações e conserva remoções no cache.
useInventoryStore.subscribe((next, prev) => {
  const stamped = stampInventoryChanges(next, prev);
  if (stamped !== next) useInventoryStore.setState(stamped);
});
