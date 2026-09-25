/**
 * 📚 Biblioteca global de Passivas (catálogo do Mestre).
 *
 * Espelha `useSpellLibraryStore`, mas para passivas. Quando o Mestre
 * aprova uma passiva proposta, uma cópia é guardada aqui para que ele
 * possa redistribuí-la a outros personagens depois.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Passive } from '@/types';

export interface PassiveLibraryEntry {
  id: string;
  passive: Passive;
  authorName: string;
  createdAt: number;
}

interface PassiveLibraryState {
  entries: Record<string, PassiveLibraryEntry>;
  registrar: (passive: Passive, authorName: string) => PassiveLibraryEntry;
  remover: (id: string) => void;
  listar: () => PassiveLibraryEntry[];
}

export const usePassiveLibraryStore = create<PassiveLibraryState>()(
  persist(
    (set, get) => ({
      entries: {},
      registrar: (passive, authorName) => {
        const id = `passlib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const entry: PassiveLibraryEntry = {
          id,
          passive: { ...passive },
          authorName,
          createdAt: Date.now(),
        };
        set((s) => ({ entries: { ...s.entries, [id]: entry } }));
        return entry;
      },
      remover: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.entries;
          return { entries: rest };
        }),
      listar: () =>
        Object.values(get().entries).sort((a, b) => b.createdAt - a.createdAt),
    }),
    { name: 'passive-library-v1' },
  ),
);
