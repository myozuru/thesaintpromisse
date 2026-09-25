import { create } from 'zustand';

/**
 * Carrinho de compras LOCAL (não sincronizado entre players nem persistido).
 * Cada cliente mantém seus próprios carrinhos, segmentados por estabelecimento.
 *
 * O fluxo é:
 *   1. Player abre item → escolhe quantidade → addItem()
 *   2. Abre o carrinho do estabelecimento (CartPanel)
 *   3. Confirma compra → debita carteira + decrementa estoque + adiciona ao inventário
 */

export interface CartLine {
  estId: string;
  menuId: string;
  itemId: string;
  /** Snapshot do nome no momento da adição (resiliente a alteração do Mestre). */
  name: string;
  /** Preço unitário efetivo no momento da adição. */
  unitPrice: number;
  currencyId: string;
  qty: number;
}

interface CartState {
  /** Linhas indexadas por estId → lista de linhas. */
  carts: Record<string, CartLine[]>;
  addItem: (line: Omit<CartLine, 'qty'> & { qty?: number }) => void;
  setQty: (estId: string, itemId: string, qty: number) => void;
  removeItem: (estId: string, itemId: string) => void;
  clearCart: (estId: string) => void;
  totalsByCurrency: (estId: string) => Record<string, number>;
}

export const useCartStore = create<CartState>((set, get) => ({
  carts: {},
  addItem: (line) => {
    const qty = Math.max(1, line.qty ?? 1);
    set((s) => {
      const cur = s.carts[line.estId] ?? [];
      const existing = cur.find((l) => l.itemId === line.itemId);
      const next = existing
        ? cur.map((l) =>
            l.itemId === line.itemId
              ? { ...l, qty: l.qty + qty, unitPrice: line.unitPrice, name: line.name }
              : l,
          )
        : [...cur, { ...line, qty }];
      return { carts: { ...s.carts, [line.estId]: next } };
    });
  },
  setQty: (estId, itemId, qty) =>
    set((s) => {
      const cur = s.carts[estId] ?? [];
      if (qty <= 0) {
        return { carts: { ...s.carts, [estId]: cur.filter((l) => l.itemId !== itemId) } };
      }
      return {
        carts: {
          ...s.carts,
          [estId]: cur.map((l) => (l.itemId === itemId ? { ...l, qty } : l)),
        },
      };
    }),
  removeItem: (estId, itemId) =>
    set((s) => ({
      carts: {
        ...s.carts,
        [estId]: (s.carts[estId] ?? []).filter((l) => l.itemId !== itemId),
      },
    })),
  clearCart: (estId) =>
    set((s) => {
      const { [estId]: _drop, ...rest } = s.carts;
      return { carts: rest };
    }),
  totalsByCurrency: (estId) => {
    const lines = get().carts[estId] ?? [];
    const totals: Record<string, number> = {};
    for (const l of lines) {
      totals[l.currencyId] = (totals[l.currencyId] ?? 0) + l.unitPrice * l.qty;
    }
    return totals;
  },
}));
