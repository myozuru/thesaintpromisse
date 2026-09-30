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

// Dev-only hook for browser tests (never in production builds).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__roleStore = useRoleStore;
}
