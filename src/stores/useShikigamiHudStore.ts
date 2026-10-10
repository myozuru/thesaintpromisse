import { create } from 'zustand';

export type ShikigamiRangeMode =
  | { kind: 'movement' }
  | { kind: 'action'; actionId: string }
  | null;

export type ShikigamiMapInteraction = 'target' | 'measure' | null;

type Point = { x: number; y: number };

interface ShikigamiHudState {
  sourceTokenId: string | null;
  selectedTargetId: string | null;
  rangeMode: ShikigamiRangeMode;
  interaction: ShikigamiMapInteraction;
  measurementPoint: Point | null;
  error: string | null;
  setSourceTokenId: (id: string | null) => void;
  setRangeMode: (mode: ShikigamiRangeMode) => void;
  startTargetSelection: () => void;
  startMeasurement: () => void;
  acceptTarget: (id: string) => boolean;
  acceptMeasurement: (point: Point) => boolean;
  cancelInteraction: () => void;
  clearTarget: () => void;
  setError: (message: string | null) => void;
}

/** Estado transitório da HUD do Shikigami; alvo e medição são locais ao cliente. */
export const useShikigamiHudStore = create<ShikigamiHudState>((set, get) => ({
  sourceTokenId: null,
  selectedTargetId: null,
  rangeMode: { kind: 'movement' },
  interaction: null,
  measurementPoint: null,
  error: null,
  setSourceTokenId: (id) => set((state) => id === state.sourceTokenId ? state : {
    sourceTokenId: id,
    selectedTargetId: null,
    rangeMode: { kind: 'movement' },
    interaction: null,
    measurementPoint: null,
    error: null,
  }),
  setRangeMode: (mode) => set({ rangeMode: mode, error: null }),
  startTargetSelection: () => set({ interaction: 'target', measurementPoint: null, error: null }),
  startMeasurement: () => set({ interaction: 'measure', selectedTargetId: null, measurementPoint: null, error: null }),
  acceptTarget: (id) => {
    const state = get();
    if (state.interaction !== 'target' || id === state.sourceTokenId) return false;
    set({ selectedTargetId: id, interaction: null, measurementPoint: null, error: null });
    return true;
  },
  acceptMeasurement: (point) => {
    if (get().interaction !== 'measure') return false;
    set({ measurementPoint: point, interaction: null, error: null });
    return true;
  },
  cancelInteraction: () => set({ interaction: null, error: null }),
  clearTarget: () => set({ selectedTargetId: null, measurementPoint: null, interaction: null, error: null }),
  setError: (message) => set({ error: message }),
}));
