/**
 * Lojas (Mercadores) do Omni-Engine.
 * Cada loja tem inventário próprio (referencia entidades Omni por ID),
 * lista de tags aceitas para venda e multiplicador de compra.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Shop {
  id: string;
  name: string;
  description: string;
  /** Tags ocultas que esta loja tem interesse em comprar. */
  acceptedTags: string[];
  /** IDs de EntidadeOmni (categoria 'item') vendidas pela loja. */
  inventory: string[];
  /** ID da moeda usada (default 'yen'). */
  currencyId: string;
  /** Multiplicador aplicado ao basePrice quando a loja compra (default 0.5). */
  buyMultiplier: number;
  createdAt: number;
}

interface ShopState {
  shops: Record<string, Shop>;
  criar: (nome?: string) => Shop;
  atualizar: (id: string, patch: Partial<Omit<Shop, 'id' | 'createdAt'>>) => void;
  remover: (id: string) => void;
  listar: () => Shop[];
  /** Adiciona/remove um item do inventário da loja. */
  toggleInventory: (shopId: string, entityId: string) => void;
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `shop-${Math.random().toString(36).slice(2)}-${Date.now()}`;

export const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      shops: {},

      criar: (nome = 'Nova Loja') => {
        const shop: Shop = {
          id: uid(),
          name: nome,
          description: '',
          acceptedTags: [],
          inventory: [],
          currencyId: 'yen',
          buyMultiplier: 0.5,
          createdAt: Date.now(),
        };
        set((s) => ({ shops: { ...s.shops, [shop.id]: shop } }));
        return shop;
      },

      atualizar: (id, patch) =>
        set((s) => {
          const cur = s.shops[id];
          if (!cur) return s;
          return { shops: { ...s.shops, [id]: { ...cur, ...patch, id: cur.id } } };
        }),

      remover: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.shops;
          return { shops: rest };
        }),

      listar: () =>
        Object.values(get().shops).sort((a, b) => a.name.localeCompare(b.name)),

      toggleInventory: (shopId, entityId) =>
        set((s) => {
          const cur = s.shops[shopId];
          if (!cur) return s;
          const has = cur.inventory.includes(entityId);
          const inv = has
            ? cur.inventory.filter((x) => x !== entityId)
            : [...cur.inventory, entityId];
          return { shops: { ...s.shops, [shopId]: { ...cur, inventory: inv } } };
        }),
    }),
    { name: 'omni-shops' },
  ),
);
