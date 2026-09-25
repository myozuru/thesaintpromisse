/**
 * useDiceStore — Fase 13.
 *
 * Mantém o estado do painel de dados (aberto/fechado), favoritos
 * (atalhos rotulados) e o histórico recente de rolagens.
 *
 * As rolagens em si são executadas via `rollExpression` em `dice.ts`
 * e também publicadas no `useLogStore` global como type='roll'.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RollResult } from '@/components/mapa/dice';

export interface DiceFavorite {
  id: string;
  label: string;
  expression: string;
}

export interface DiceHistoryEntry {
  id: string;
  expression: string;
  pretty: string;
  total: number;
  at: number;
}

interface DiceState {
  open: boolean;
  setOpen: (v: boolean) => void;

  modifier: number;
  setModifier: (n: number) => void;

  advantage: 'none' | 'adv' | 'dis';
  setAdvantage: (v: DiceState['advantage']) => void;

  expression: string;
  setExpression: (s: string) => void;

  favorites: DiceFavorite[];
  addFavorite: (label: string, expression: string) => void;
  removeFavorite: (id: string) => void;

  history: DiceHistoryEntry[];
  pushRoll: (r: RollResult) => void;
  clearHistory: () => void;
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const useDiceStore = create<DiceState>()(
  persist(
    (set) => ({
      open: false,
      setOpen: (v) => set({ open: v }),

      modifier: 0,
      setModifier: (n) => set({ modifier: n }),

      advantage: 'none',
      setAdvantage: (v) => set({ advantage: v }),

      expression: '1d20',
      setExpression: (s) => set({ expression: s }),

      favorites: [
        { id: 'fav-atk', label: 'Ataque',  expression: '1d20+5' },
        { id: 'fav-dmg', label: 'Dano',    expression: '1d8+3'  },
        { id: 'fav-sav', label: 'Save',    expression: '1d20+2' },
        { id: 'fav-init',label: 'Iniciativa', expression: '1d20+1' },
      ],
      addFavorite: (label, expression) =>
        set((s) => ({
          favorites: [
            ...s.favorites,
            { id: uid(), label: label.slice(0, 24), expression: expression.slice(0, 80) },
          ],
        })),
      removeFavorite: (id) =>
        set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),

      history: [],
      pushRoll: (r) =>
        set((s) => ({
          history: [
            {
              id: uid(),
              expression: r.expression,
              pretty: r.pretty,
              total: r.total,
              at: Date.now(),
            },
            ...s.history,
          ].slice(0, 30),
        })),
      clearHistory: () => set({ history: [] }),
    }),
    { name: 'vtt-dice-v1' },
  ),
);
