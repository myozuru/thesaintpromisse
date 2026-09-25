import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CalendarEvent } from '@/types';

interface CalendarStore {
  events: CalendarEvent[];
  selectedYear: number;
  selectedMonth: number;
  addEvent: (event: CalendarEvent) => void;
  removeEvent: (id: string) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  setSelectedYear: (year: number) => void;
  setSelectedMonth: (month: number) => void;
  resetAll: () => void;
}

export const useCalendarStore = create<CalendarStore>()(
  persist(
    (set) => ({
      events: [],
      selectedYear: 1,
      selectedMonth: 1,
      addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
      removeEvent: (id) => set((state) => ({ events: state.events.filter((e) => e.id !== id) })),
      updateEvent: (id, updates) => set((state) => ({ events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)) })),
      setSelectedYear: (year) => set({ selectedYear: year }),
      setSelectedMonth: (month) => set({ selectedMonth: month }),
      resetAll: () => set({ events: [], selectedYear: 1, selectedMonth: 1 }),
    }),
    { name: 'rpg-calendar' }
  )
);
