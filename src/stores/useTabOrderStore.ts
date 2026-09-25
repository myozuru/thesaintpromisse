import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TabId } from '@/components/Header';
import type { UserRole } from '@/stores/useRoleStore';

type RoleKey = 'PLAYER' | 'MASTER';

interface TabOrderState {
  orders: Partial<Record<RoleKey, TabId[]>>;
  setOrder: (role: RoleKey, order: TabId[]) => void;
  resetOrder: (role: RoleKey) => void;
  getOrder: (role: UserRole, defaults: TabId[]) => TabId[];
}

export const useTabOrderStore = create<TabOrderState>()(
  persist(
    (set, get) => ({
      orders: {},
      setOrder: (role, order) =>
        set((s) => ({ orders: { ...s.orders, [role]: order } })),
      resetOrder: (role) =>
        set((s) => {
          const next = { ...s.orders };
          delete next[role];
          return { orders: next };
        }),
      getOrder: (role, defaults) => {
        if (!role) return defaults;
        const saved = get().orders[role];
        if (!saved) return defaults;
        // Reconcile: keep saved order, drop unknowns, append new defaults at the end.
        const allowed = new Set(defaults);
        const filtered = saved.filter((id) => allowed.has(id));
        const missing = defaults.filter((id) => !filtered.includes(id));
        return [...filtered, ...missing];
      },
    }),
    { name: 'rpg-tab-order' }
  )
);
