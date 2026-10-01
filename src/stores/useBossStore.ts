/**
 * Fichas de Chefe (bosses) — persistidas localmente.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  createBoss,
  uidBoss,
  type Boss,
  type BossAbility,
  type BossRevealField,
} from '@/lib/bosses';

export interface WorldMarker { id: string; bossId: string; x: number; y: number }

interface BossState {
  worldMap: string | null;
  worldMarkers: WorldMarker[];
  setWorldMap: (img: string | null) => void;
  addMarker: (bossId: string, x: number, y: number) => void;
  moveMarker: (id: string, x: number, y: number) => void;
  removeMarker: (id: string) => void;
  bosses: Record<string, Boss>;
  create: (nome?: string) => Boss;
  update: (id: string, patch: Partial<Omit<Boss, 'id' | 'createdAt'>>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => Boss | null;
  toggleReveal: (id: string, field: BossRevealField) => void;
  addAbility: (id: string, kind?: BossAbility['kind']) => void;
  updateAbility: (id: string, abilityId: string, patch: Partial<Omit<BossAbility, 'id'>>) => void;
  removeAbility: (id: string, abilityId: string) => void;
  list: () => Boss[];
}

export const useBossStore = create<BossState>()(
  persist(
    (set, get) => ({
      bosses: {},
      worldMap: null,
      worldMarkers: [],
      setWorldMap: (img) => set({ worldMap: img }),
      addMarker: (bossId, x, y) =>
        set((s) => ({ worldMarkers: [...s.worldMarkers.filter((m) => m.bossId !== bossId), { id: uidBoss(), bossId, x, y }] })),
      moveMarker: (id, x, y) =>
        set((s) => ({ worldMarkers: s.worldMarkers.map((m) => (m.id === id ? { ...m, x, y } : m)) })),
      removeMarker: (id) => set((s) => ({ worldMarkers: s.worldMarkers.filter((m) => m.id !== id) })),

      create: (nome) => {
        const boss = createBoss(nome?.trim() || 'Novo Chefe');
        set((s) => ({ bosses: { ...s.bosses, [boss.id]: boss } }));
        return boss;
      },

      update: (id, patch) =>
        set((s) => {
          const cur = s.bosses[id];
          if (!cur) return s;
          return {
            bosses: {
              ...s.bosses,
              [id]: { ...cur, ...patch, id: cur.id, createdAt: cur.createdAt, updatedAt: Date.now() },
            },
          };
        }),

      remove: (id) =>
        set((s) => {
          const next = { ...s.bosses };
          delete next[id];
          return { bosses: next, worldMarkers: s.worldMarkers.filter((m) => m.bossId !== id) };
        }),

      duplicate: (id) => {
        const cur = get().bosses[id];
        if (!cur) return null;
        const copy: Boss = {
          ...cur,
          id: uidBoss(),
          nome: `${cur.nome} (cópia)`,
          habilidades: cur.habilidades.map((a) => ({ ...a, id: uidBoss() })),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ bosses: { ...s.bosses, [copy.id]: copy } }));
        return copy;
      },

      toggleReveal: (id, field) =>
        set((s) => {
          const cur = s.bosses[id];
          if (!cur) return s;
          return {
            bosses: {
              ...s.bosses,
              [id]: {
                ...cur,
                revelado: { ...cur.revelado, [field]: !cur.revelado[field] },
                updatedAt: Date.now(),
              },
            },
          };
        }),

      addAbility: (id, kind = 'ATAQUE') =>
        set((s) => {
          const cur = s.bosses[id];
          if (!cur) return s;
          const ability: BossAbility = {
            id: uidBoss(),
            nome: 'Nova habilidade',
            kind,
            texto: '',
            revelada: false,
          };
          return {
            bosses: {
              ...s.bosses,
              [id]: { ...cur, habilidades: [...cur.habilidades, ability], updatedAt: Date.now() },
            },
          };
        }),

      updateAbility: (id, abilityId, patch) =>
        set((s) => {
          const cur = s.bosses[id];
          if (!cur) return s;
          return {
            bosses: {
              ...s.bosses,
              [id]: {
                ...cur,
                habilidades: cur.habilidades.map((a) => (a.id === abilityId ? { ...a, ...patch, id: a.id } : a)),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      removeAbility: (id, abilityId) =>
        set((s) => {
          const cur = s.bosses[id];
          if (!cur) return s;
          return {
            bosses: {
              ...s.bosses,
              [id]: {
                ...cur,
                habilidades: cur.habilidades.filter((a) => a.id !== abilityId),
                updatedAt: Date.now(),
              },
            },
          };
        }),

      list: () =>
        Object.values(get().bosses).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    }),
    { name: 'tp-bosses' },
  ),
);

// Dev-only hook for browser tests (never in production builds).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__bossStore = useBossStore;
}
