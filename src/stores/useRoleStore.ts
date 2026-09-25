import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'PLAYER' | 'MASTER' | null;

interface RoleState {
  role: UserRole;
  setRole: (role: UserRole) => void;
  logout: () => void;
}

export const useRoleStore = create<RoleState>()(
  persist(
    (set) => ({
      role: null,
      setRole: (role) => set({ role }),
      logout: () => set({ role: null }),
    }),
    { name: 'rpg-role' }
  )
);
