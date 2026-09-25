import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Modo de ocultação aplicável a item / cardapio / estabelecimento.
 * - undefined : visível para todos.
 * - 'soldout' : players veem com selo "Esgotado" e SEM botão Comprar.
 * - 'invisible' : players nem veem (Mestre vê com ícone de oculto).
 */
export type HiddenMode = 'soldout' | 'invisible';

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  cost: number; // em moedas (ouro)
  currencyId?: string; // id da moeda em useMoneyStore; se vazio, usa a moeda padrão
  /** Marca o item como comida/consumível restaurador. */
  isFood?: boolean;
  /** Pontos de fome restaurados ao consumir (0..24). */
  hungerRestore?: number;
  /** PV restaurados ao consumir. */
  hpRestore?: number;
  /** PE restaurados ao consumir. */
  peRestore?: number;
  /** PVT (Pontos de Vida Temporários / Escudo) concedidos ao consumir. */
  pvtRestore?: number;
  /** Visibilidade para players. undefined = visível. */
  hiddenMode?: HiddenMode;
  /**
   * Estoque disponível. `undefined` = ilimitado.
   * `0` = esgotado (UI mostra como indisponível para player).
   */
  stock?: number;
}

export interface Menu {
  id: string;
  name: string;
  description?: string;
  items: MenuItem[];
  /** Visibilidade do cardápio inteiro para players. */
  hiddenMode?: HiddenMode;
}

export interface Establishment {
  id: string;
  name: string;
  type?: string; // taverna, restaurante, etc.
  location?: string;
  description?: string;
  menus: Menu[];
  /** Visibilidade do estabelecimento inteiro para players. */
  hiddenMode?: HiddenMode;
}

interface MenuStore {
  establishments: Establishment[];
  // estabelecimentos
  addEstablishment: (e: Omit<Establishment, 'id' | 'menus'> & { menus?: Menu[] }) => void;
  updateEstablishment: (id: string, updates: Partial<Omit<Establishment, 'id' | 'menus'>>) => void;
  removeEstablishment: (id: string) => void;
  // cardápios
  addMenu: (estId: string, menu: Omit<Menu, 'id' | 'items'> & { items?: MenuItem[] }) => void;
  updateMenu: (estId: string, menuId: string, updates: Partial<Omit<Menu, 'id' | 'items'>>) => void;
  removeMenu: (estId: string, menuId: string) => void;
  // itens
  addMenuItem: (estId: string, menuId: string, item: Omit<MenuItem, 'id'>) => void;
  updateMenuItem: (estId: string, menuId: string, itemId: string, updates: Partial<Omit<MenuItem, 'id'>>) => void;
  removeMenuItem: (estId: string, menuId: string, itemId: string) => void;
  /**
   * Decrementa o estoque de um item de forma atômica.
   * Retorna `true` se houve estoque suficiente; `false` caso contrário.
   * Itens com `stock === undefined` são tratados como ilimitados (sempre `true`).
   */
  consumeStock: (estId: string, menuId: string, itemId: string, qty: number) => boolean;
  resetAll: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const useMenuStore = create<MenuStore>()(
  persist(
    (set) => ({
      establishments: [],
      addEstablishment: (e) =>
        set((s) => ({
          establishments: [
            ...s.establishments,
            { id: uid(), menus: e.menus ?? [], ...e },
          ],
        })),
      updateEstablishment: (id, updates) =>
        set((s) => ({
          establishments: s.establishments.map((e) =>
            e.id === id ? { ...e, ...updates } : e,
          ),
        })),
      removeEstablishment: (id) =>
        set((s) => ({ establishments: s.establishments.filter((e) => e.id !== id) })),
      addMenu: (estId, menu) =>
        set((s) => ({
          establishments: s.establishments.map((e) =>
            e.id === estId
              ? { ...e, menus: [...e.menus, { id: uid(), items: menu.items ?? [], ...menu }] }
              : e,
          ),
        })),
      updateMenu: (estId, menuId, updates) =>
        set((s) => ({
          establishments: s.establishments.map((e) =>
            e.id === estId
              ? { ...e, menus: e.menus.map((m) => (m.id === menuId ? { ...m, ...updates } : m)) }
              : e,
          ),
        })),
      removeMenu: (estId, menuId) =>
        set((s) => ({
          establishments: s.establishments.map((e) =>
            e.id === estId ? { ...e, menus: e.menus.filter((m) => m.id !== menuId) } : e,
          ),
        })),
      addMenuItem: (estId, menuId, item) =>
        set((s) => ({
          establishments: s.establishments.map((e) =>
            e.id === estId
              ? {
                  ...e,
                  menus: e.menus.map((m) =>
                    m.id === menuId
                      ? { ...m, items: [...m.items, { id: uid(), ...item }] }
                      : m,
                  ),
                }
              : e,
          ),
        })),
      updateMenuItem: (estId, menuId, itemId, updates) =>
        set((s) => ({
          establishments: s.establishments.map((e) =>
            e.id === estId
              ? {
                  ...e,
                  menus: e.menus.map((m) =>
                    m.id === menuId
                      ? {
                          ...m,
                          items: m.items.map((it) =>
                            it.id === itemId ? { ...it, ...updates } : it,
                          ),
                        }
                      : m,
                  ),
                }
              : e,
          ),
        })),
      removeMenuItem: (estId, menuId, itemId) =>
        set((s) => ({
          establishments: s.establishments.map((e) =>
            e.id === estId
              ? {
                  ...e,
                  menus: e.menus.map((m) =>
                    m.id === menuId
                      ? { ...m, items: m.items.filter((it) => it.id !== itemId) }
                      : m,
                  ),
                }
              : e,
          ),
        })),
      consumeStock: (estId, menuId, itemId, qty) => {
        if (qty <= 0) return true;
        let ok = true;
        set((s) => ({
          establishments: s.establishments.map((e) => {
            if (e.id !== estId) return e;
            return {
              ...e,
              menus: e.menus.map((m) => {
                if (m.id !== menuId) return m;
                return {
                  ...m,
                  items: m.items.map((it) => {
                    if (it.id !== itemId) return it;
                    if (it.stock === undefined) return it; // ilimitado
                    if (it.stock < qty) {
                      ok = false;
                      return it;
                    }
                    return { ...it, stock: it.stock - qty };
                  }),
                };
              }),
            };
          }),
        }));
        return ok;
      },
      resetAll: () => set({ establishments: [] }),
    }),
    { name: 'menu-store' },
  ),
);