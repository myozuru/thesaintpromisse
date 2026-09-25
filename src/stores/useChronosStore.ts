import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChronosState } from '@/types';

interface ChronosStore extends ChronosState {
  lastMutationSource?: 'manual' | 'ticker' | 'remote';
  easeStartMs: number;
  easeStopMs: number;
  setTime: (h: number, m: number, s: number) => void;
  setDate: (day: number, month: number, year: number) => void;
  setMultiplier: (mult: number) => void;
  setIsRunning: (running: boolean) => void;
  setEaseStartMs: (ms: number) => void;
  setEaseStopMs: (ms: number) => void;
  replaceFromRemote: (state: Partial<ChronosState>) => void;
  tick: (deltaSeconds: number, source?: 'manual' | 'ticker') => void;
  resetAll: () => void;
}

const INITIAL_CHRONOS: ChronosState = {
  hours: 12, minutes: 0, seconds: 0,
  day: 1, month: 1, year: 1,
  multiplier: 1, isRunning: false,
};

const DEFAULT_EASE_MS = 450;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function toTimelineSeconds(c: Pick<ChronosState, 'hours' | 'minutes' | 'seconds' | 'day' | 'month' | 'year'>): number {
  const years = Math.max(0, c.year - 1) * 365 * 86400;
  const months = DAYS_IN_MONTH.slice(0, Math.max(0, c.month - 1)).reduce((a, b) => a + b, 0) * 86400;
  const days = Math.max(0, c.day - 1) * 86400;
  return years + months + days + c.hours * 3600 + c.minutes * 60 + c.seconds;
}

export const useChronosStore = create<ChronosStore>()(
  persist(
    (set) => ({
      ...INITIAL_CHRONOS,
      lastMutationSource: 'manual',
      easeStartMs: DEFAULT_EASE_MS,
      easeStopMs: DEFAULT_EASE_MS,
      setTime: (h, m, s) => set({ hours: h, minutes: m, seconds: s, lastMutationSource: 'manual' }),
      setDate: (day, month, year) => set({ day, month, year, lastMutationSource: 'manual' }),
      setMultiplier: (mult) => set({ multiplier: mult, lastMutationSource: 'manual' }),
      setIsRunning: (running) => set({ isRunning: running, lastMutationSource: 'manual' }),
      setEaseStartMs: (ms) => set({ easeStartMs: Math.max(0, ms) }),
      setEaseStopMs: (ms) => set({ easeStopMs: Math.max(0, ms) }),
      replaceFromRemote: (remote) =>
        set((state) => {
          const next = { ...state, ...remote };
          const remoteMovedBack = state.isRunning && next.isRunning && toTimelineSeconds(next) < toTimelineSeconds(state);
          return remoteMovedBack ? { ...remote, hours: state.hours, minutes: state.minutes, seconds: state.seconds, day: state.day, month: state.month, year: state.year, lastMutationSource: 'remote' } : { ...remote, lastMutationSource: 'remote' };
        }),
      tick: (deltaSeconds, source = 'manual') =>
        set((state) => {
          let totalSec = state.hours * 3600 + state.minutes * 60 + state.seconds + deltaSeconds;
          let day = state.day;
          let month = state.month;
          let year = state.year;
          while (totalSec >= 86400) {
            totalSec -= 86400;
            day++;
            const maxDays = DAYS_IN_MONTH[(month - 1) % 12] || 30;
            if (day > maxDays) { day = 1; month++; if (month > 12) { month = 1; year++; } }
          }
          while (totalSec < 0) {
            totalSec += 86400;
            day--;
            if (day < 1) { month--; if (month < 1) { month = 12; year--; } day = DAYS_IN_MONTH[(month - 1) % 12] || 30; }
          }
          const hours = Math.floor(totalSec / 3600);
          const minutes = Math.floor((totalSec % 3600) / 60);
          const seconds = totalSec % 60;
          return { hours, minutes, seconds, day, month, year, lastMutationSource: source };
        }),
      resetAll: () => set(INITIAL_CHRONOS),
    }),
    { name: 'rpg-chronos' }
  )
);
