import { create } from 'zustand';

export type UserRole = 'PLAYER' | 'MASTER' | null;

interface RoleState {
  role: UserRole;
  setRole: (role: UserRole) => void;
  logout: () => void;
}

export const useRoleStore = create<RoleState>()((set) => ({
  role: null,
  setRole: (role) => set({ role }),
  logout: () => set({ role: null }),
}));
