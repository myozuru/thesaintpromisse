/**
 * 📚 Biblioteca global de Feitiços (catálogo do Mestre).
 *
 * Toda vez que o Mestre aprova um feitiço (proposto pelo jogador ou criado
 * por ele mesmo), uma cópia é registrada aqui. A ficha do autor original
 * continua recebendo o feitiço normalmente, mas a entrada do catálogo
 * permite que o Mestre entregue o mesmo feitiço para outros personagens
 * mais tarde.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Spell } from '@/types';

export interface SpellLibraryEntry {
  /** ID único da entrada no catálogo (não é o id do feitiço na ficha). */
  id: string;
  /** Cópia do feitiço aprovado. */
  spell: Spell;
  /** Nome do personagem autor (apenas para referência no catálogo). */
  authorName: string;
  /** Timestamp da aprovação. */
  createdAt: number;
}

interface SpellLibraryState {
  entries: Record<string, SpellLibraryEntry>;
  registrar: (spell: Spell, authorName: string) => SpellLibraryEntry;
  remover: (id: string) => void;
  listar: () => SpellLibraryEntry[];
}

export const useSpellLibraryStore = create<SpellLibraryState>()(
  persist(
    (set, get) => ({
      entries: {},
      registrar: (spell, authorName) => {
        const id = `spelllib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const entry: SpellLibraryEntry = {
          id,
          spell: { ...spell },
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
    { name: 'spell-library-v1' },
  ),
);
