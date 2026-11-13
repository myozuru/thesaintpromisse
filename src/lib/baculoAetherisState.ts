import { create } from 'zustand';

export interface BaculoAetherisCounterattack {
  wielderId: string;
  attackerId: string;
  protectedId: string;
}

interface BaculoAetherisCounterattackState {
  pending: BaculoAetherisCounterattack | null;
  setPending: (pending: BaculoAetherisCounterattack) => void;
  clearPending: () => void;
}

export const useBaculoAetherisCounterattackStore = create<BaculoAetherisCounterattackState>((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
  clearPending: () => set({ pending: null }),
}));
