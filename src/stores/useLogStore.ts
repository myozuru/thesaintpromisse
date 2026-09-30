import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LogEntry, LogType } from '@/types';
import { useChronosStore } from './useChronosStore';
import { useRoleStore } from './useRoleStore';
import { useProfileStore } from './useProfileStore';

export type PlayerLogVisibility = 'full' | 'hide-master' | 'hide-roll-results';

interface LogStore {
  logs: LogEntry[];
  playerVisibility: PlayerLogVisibility;
  showGameTime: boolean;
  panelCollapsed: boolean;
  addLog: (type: LogType, message: string) => void;
  clearLogs: () => void;
  setPlayerVisibility: (visibility: PlayerLogVisibility) => void;
  toggleTimeMode: () => void;
  setPanelCollapsed: (v: boolean) => void;
}

const fmt = (n: number) => String(Math.floor(n)).padStart(2, '0');

export const useLogStore = create<LogStore>()(
  persist(
    (set) => ({
      logs: [],
      playerVisibility: 'full',
      showGameTime: false,
      panelCollapsed: false,
      addLog: (type, message) => {
        const cs = useChronosStore.getState();
        const sourceRole = useRoleStore.getState().role;
        const { activeProfileId, profiles } = useProfileStore.getState();
        const sourceName = profiles.find((profile) => profile.id === activeProfileId)?.name
          ?? (sourceRole === 'MASTER' ? 'Mestre' : 'Jogador');
        const gameTime = `${fmt(cs.hours)}:${fmt(cs.minutes)}:${fmt(cs.seconds)} — Dia ${cs.day}, Mês ${cs.month}, Ano ${cs.year}`;
        set((state) => ({
          logs: [{ id: crypto.randomUUID(), timestamp: Date.now(), gameTime, type, message, sourceRole, sourceName }, ...state.logs].slice(0, 200),
        }));
      },
      clearLogs: () => set({ logs: [] }),
      setPlayerVisibility: (visibility) => set({ playerVisibility: visibility }),
      toggleTimeMode: () => set((s) => ({ showGameTime: !s.showGameTime })),
      setPanelCollapsed: (v) => set({ panelCollapsed: v }),
    }),
    { name: 'rpg-logs' }
  )
);

// Dev-only hook for browser tests (never in production builds).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__logStore = useLogStore;
}
