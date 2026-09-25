import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChestEntry {
  /** ID do Item no useItemStore */
  itemId: string;
  /** Quantidade armazenada no baú. */
  quantity: number;
}

export interface Chest {
  id: string;
  name: string;
  description?: string;
  /** Itens armazenados (referência ao banco). */
  entries: ChestEntry[];
  /** Se true, exige chave (ou mestre) para ser vasculhado. */
  locked?: boolean;
  /** ID do Item (useItemStore) que funciona como chave deste baú. */
  keyItemId?: string;
  /** Se true, a chave é consumida ao destrancar. */
  consumeKey?: boolean;
  /** Sprite visual do cadeado (ver lockSprites.ts). */
  lockSpriteId?: string;
  /** Sprite visual da chave (ver lockSprites.ts). */
  keySpriteId?: string;
  createdAt: number;
  updatedAt: number;
}


interface ChestState {
  chests: Record<string, Chest>;
  createChest: (name?: string) => Chest;
  updateChest: (id: string, patch: Partial<Omit<Chest, 'id' | 'createdAt'>>) => void;
  removeChest: (id: string) => void;
  /** Adiciona (ou soma) uma entrada de item ao baú. */
  addItem: (chestId: string, itemId: string, quantity?: number) => void;
  /** Define quantidade absoluta (≤0 remove a entrada). */
  setItemQuantity: (chestId: string, itemId: string, quantity: number) => void;
  removeItem: (chestId: string, itemId: string) => void;
  /** Esvazia o baú. */
  clearChest: (chestId: string) => void;
  list: () => Chest[];
  resetAll: () => void;
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `chest-${Math.random().toString(36).slice(2)}-${Date.now()}`;

export const useChestStore = create<ChestState>()(
  persist(
    (set, get) => ({
      chests: {},

      createChest: (name) => {
        const now = Date.now();
        const chest: Chest = {
          id: uid(),
          name: name?.trim() || 'Baú sem nome',
          description: '',
          entries: [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ chests: { ...s.chests, [chest.id]: chest } }));
        return chest;
      },

      updateChest: (id, patch) =>
        set((s) => {
          const cur = s.chests[id];
          if (!cur) return s;
          return {
            chests: {
              ...s.chests,
              [id]: { ...cur, ...patch, id: cur.id, createdAt: cur.createdAt, updatedAt: Date.now() },
            },
          };
        }),

      removeChest: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.chests;
          return { chests: rest };
        }),

      addItem: (chestId, itemId, quantity = 1) =>
        set((s) => {
          const cur = s.chests[chestId];
          if (!cur) return s;
          const existing = cur.entries.find((e) => e.itemId === itemId);
          let entries: ChestEntry[];
          if (existing) {
            entries = cur.entries.map((e) =>
              e.itemId === itemId ? { ...e, quantity: e.quantity + quantity } : e,
            );
          } else {
            entries = [...cur.entries, { itemId, quantity }];
          }
          return {
            chests: { ...s.chests, [chestId]: { ...cur, entries, updatedAt: Date.now() } },
          };
        }),

      setItemQuantity: (chestId, itemId, quantity) =>
        set((s) => {
          const cur = s.chests[chestId];
          if (!cur) return s;
          let entries: ChestEntry[];
          if (quantity <= 0) {
            entries = cur.entries.filter((e) => e.itemId !== itemId);
          } else {
            entries = cur.entries.some((e) => e.itemId === itemId)
              ? cur.entries.map((e) => (e.itemId === itemId ? { ...e, quantity } : e))
              : [...cur.entries, { itemId, quantity }];
          }
          return {
            chests: { ...s.chests, [chestId]: { ...cur, entries, updatedAt: Date.now() } },
          };
        }),

      removeItem: (chestId, itemId) =>
        set((s) => {
          const cur = s.chests[chestId];
          if (!cur) return s;
          return {
            chests: {
              ...s.chests,
              [chestId]: {
                ...cur,
                entries: cur.entries.filter((e) => e.itemId !== itemId),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      clearChest: (chestId) =>
        set((s) => {
          const cur = s.chests[chestId];
          if (!cur) return s;
          return {
            chests: { ...s.chests, [chestId]: { ...cur, entries: [], updatedAt: Date.now() } },
          };
        }),

      list: () => Object.values(get().chests).sort((a, b) => b.updatedAt - a.updatedAt),

      resetAll: () => set({ chests: {} }),
    }),
    { name: 'rpg-chests' },
  ),
);
