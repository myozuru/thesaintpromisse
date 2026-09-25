import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Descontos aplicados pelo Mestre em alvos específicos:
 * estabelecimento inteiro, cardapio (menu) ou item.
 *
 * Empilhamento: quando há múltiplos descontos cobrindo o mesmo item,
 * todos são aplicados em cascata (ex.: -10% no estabelecimento e
 * -50¥ no item se acumulam — primeiro percentual, depois fixo).
 */

export type DiscountTargetType = 'establishment' | 'menu' | 'item';
export type DiscountKind = 'percent' | 'flat';

export interface Discount {
  id: string;
  targetType: DiscountTargetType;
  /** id do alvo (estId, menuId ou itemId) */
  targetId: string;
  /** Para menu/item, guardamos o estId pai para referência rápida. */
  parentEstId?: string;
  /** Para item, também guardamos o menuId pai. */
  parentMenuId?: string;
  kind: DiscountKind;
  /** Para 'percent': 0..100. Para 'flat': valor positivo a subtrair. */
  value: number;
  /** Rótulo opcional (ex.: "Promoção de inverno"). */
  label?: string;
  /**
   * Janela de tempo em "dias absolutos" do Chronos (year*360 + (month-1)*30 + day).
   * Se ambos null → permanente.
   */
  startAbsDay?: number | null;
  endAbsDay?: number | null;
  createdAt: number;
}

interface DiscountState {
  discounts: Discount[];
  addDiscount: (d: Omit<Discount, 'id' | 'createdAt'>) => Discount;
  updateDiscount: (id: string, patch: Partial<Omit<Discount, 'id' | 'createdAt'>>) => void;
  removeDiscount: (id: string) => void;
  resetAll: () => void;
}

const newId = () => `disc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const useDiscountStore = create<DiscountState>()(
  persist(
    (set) => ({
      discounts: [],
      addDiscount: (d) => {
        const created: Discount = { ...d, id: newId(), createdAt: Date.now() };
        set((s) => ({ discounts: [...s.discounts, created] }));
        return created;
      },
      updateDiscount: (id, patch) =>
        set((s) => ({
          discounts: s.discounts.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),
      removeDiscount: (id) =>
        set((s) => ({ discounts: s.discounts.filter((x) => x.id !== id) })),
      resetAll: () => set({ discounts: [] }),
    }),
    { name: 'rpg-discounts' },
  ),
);
