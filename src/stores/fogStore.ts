import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Door, Light, Tool, Vec2, Wall, WallKind } from "@/lib/fog/types";

interface Snapshot {
  walls: Wall[];
  doors: Door[];
  lights: Light[];
}

export type ViewMode = "vision" | "no-vision";

// Subtrai um conjunto de intervalos ocupados de um intervalo-alvo, devolvendo as partes livres.
function subtractIntervals(
  target: [number, number],
  occupied: [number, number][],
): [number, number][] {
  const sorted = occupied
    .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  let result: [number, number][] = [target];
  for (const [oa, ob] of sorted) {
    const next: [number, number][] = [];
    for (const [a, b] of result) {
      if (ob <= a || oa >= b) {
        next.push([a, b]);
      } else {
        if (oa > a) next.push([a, oa]);
        if (ob < b) next.push([ob, b]);
      }
    }
    result = next;
  }
  return result;
}

interface FogState extends Snapshot {
  tool: Tool;
  draft: Vec2[];
  past: Snapshot[];
  future: Snapshot[];
  selectedLightId: string | null;
  selectedWallId: string | null;
  viewMode: ViewMode;
  /** Modo escuridão: visão clara só funciona dentro de áreas iluminadas; visão no escuro (darkRadius) apenas atenua a neblina. */
  darknessMode: boolean;

  setViewMode: (m: ViewMode) => void;
  setDarknessMode: (v: boolean) => void;
  setTool: (t: Tool) => void;
  pushDraftPoint: (p: Vec2) => void;
  clearDraft: () => void;

  commitWall: (closed?: boolean) => void;
  addWall: (points: Vec2[], closed?: boolean) => void;
  addDoorFromDraft: () => void;
  addDoorOnWall: (p: Vec2) => boolean;
  addDoorRange: (wallId: string, segIndex: number, t0: number, t1: number) => string | null;
  addLight: (p: Vec2, radius?: number) => void;
  moveLight: (id: string, p: Vec2) => void;
  updateLight: (id: string, patch: Partial<Light>) => void;
  selectLight: (id: string | null) => void;
  selectWall: (id: string | null) => void;
  setWallKind: (id: string, kind: WallKind) => void;
  toggleDoor: (id: string) => void;
  removeWall: (id: string) => void;
  removeDoor: (id: string) => void;
  removeLight: (id: string) => void;
  updateWallPoint: (wallId: string, index: number, p: Vec2) => void;
  moveWall: (wallId: string, dx: number, dy: number) => void;
  updateDoorPoint: (doorId: string, end: "a" | "b", p: Vec2) => void;
  snapshot: () => void;
  clearAll: () => void;
  loadDemo: () => void;
  undo: () => void;
  redo: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const snap = (s: Snapshot): Snapshot => ({
  walls: s.walls,
  doors: s.doors,
  lights: s.lights,
});

const defaultLight = (p: Vec2, radius = 500): Light => ({
  id: uid(),
  position: p,
  radius,
  shape: "full",
  coneDirection: 0,
  coneAngle: Math.PI / 3,
  edge: "blurred",
  type: "primary",
});

const DEMO: Snapshot = {
  walls: [
    {
      id: uid(),
      closed: true,
      points: [
        { x: 80, y: 80 },
        { x: 880, y: 80 },
        { x: 880, y: 520 },
        { x: 80, y: 520 },
      ],
    },
    { id: uid(), points: [{ x: 380, y: 80 }, { x: 380, y: 240 }] },
    { id: uid(), points: [{ x: 380, y: 340 }, { x: 380, y: 520 }] },
    { id: uid(), points: [{ x: 380, y: 340 }, { x: 620, y: 340 }] },
    { id: uid(), points: [{ x: 620, y: 80 }, { x: 620, y: 240 }] },
  ],
  doors: [
    { id: uid(), a: { x: 380, y: 240 }, b: { x: 380, y: 340 }, open: false },
    { id: uid(), a: { x: 620, y: 240 }, b: { x: 620, y: 340 }, open: false },
  ],
  lights: [defaultLight({ x: 220, y: 300 }, 600)],
};

export const useFogStore = create<FogState>()(
  persist(
    (set, get) => {
      const pushHistory = () => {
        const { walls, doors, lights, past } = get();
        return { past: [...past.slice(-49), snap({ walls, doors, lights })], future: [] };
      };

      return {
        walls: [],
        doors: [],
        lights: DEMO.lights,
        tool: "select",
        draft: [],
        past: [],
        future: [],
        selectedLightId: null,
        selectedWallId: null,
        viewMode: "vision",
        darknessMode: false,

        setViewMode: (m) => set({ viewMode: m }),
        setDarknessMode: (v) => set({ darknessMode: v }),
        setTool: (t) => set({ tool: t, draft: [] }),
        pushDraftPoint: (p) => set((s) => ({ draft: [...s.draft, p] })),
        clearDraft: () => set({ draft: [] }),

        commitWall: (closed = false) =>
          set((s) => {
            if (s.draft.length < 2) return { draft: [] };
            return {
              ...pushHistory(),
              walls: [...s.walls, { id: uid(), points: s.draft, closed }],
              draft: [],
            };
          }),

        addWall: (points, closed = true) =>
          set((s) => {
            if (points.length < 2) return s;
            return {
              ...pushHistory(),
              walls: [...s.walls, { id: uid(), points, closed }],
            };
          }),


        addDoorFromDraft: () =>
          set((s) => {
            if (s.draft.length < 2) return s;
            const [a, b] = s.draft;
            return {
              ...pushHistory(),
              doors: [...s.doors, { id: uid(), a, b, open: false }],
              draft: [],
            };
          }),

        addDoorOnWall: (p) => {
          const { walls } = get();
          const DOOR_LEN = 60;
          const MAX_DIST = 14;
          let best:
            | {
                dist: number;
                wallId: string;
                segIndex: number;
                t: number;
                edgeLen: number;
                a: Vec2;
                b: Vec2;
              }
            | null = null;
          for (const w of walls) {
            const edges: { a: Vec2; b: Vec2 }[] = [];
            for (let i = 0; i < w.points.length - 1; i++)
              edges.push({ a: w.points[i], b: w.points[i + 1] });
            if (w.closed && w.points.length > 2)
              edges.push({ a: w.points[w.points.length - 1], b: w.points[0] });
            edges.forEach((edge, i) => {
              const dx = edge.b.x - edge.a.x;
              const dy = edge.b.y - edge.a.y;
              const l2 = dx * dx + dy * dy;
              if (l2 === 0) return;
              let t = ((p.x - edge.a.x) * dx + (p.y - edge.a.y) * dy) / l2;
              t = Math.max(0, Math.min(1, t));
              const px = edge.a.x + t * dx;
              const py = edge.a.y + t * dy;
              const d = Math.hypot(p.x - px, p.y - py);
              if (d < MAX_DIST && (!best || d < best.dist)) {
                best = {
                  dist: d,
                  wallId: w.id,
                  segIndex: i,
                  t,
                  edgeLen: Math.sqrt(l2),
                  a: edge.a,
                  b: edge.b,
                };
              }
            });
          }
          if (!best) return false;
          const hit = best as {
            dist: number;
            wallId: string;
            segIndex: number;
            t: number;
            edgeLen: number;
            a: Vec2;
            b: Vec2;
          };
          const halfT = Math.min(DOOR_LEN / 2 / hit.edgeLen, 0.45);
          let t0 = hit.t - halfT;
          let t1 = hit.t + halfT;
          if (t0 < 0) { t1 -= t0; t0 = 0; }
          if (t1 > 1) { t0 -= t1 - 1; t1 = 1; }
          t0 = Math.max(0, t0);
          t1 = Math.min(1, t1);
          const lerp = (t: number) => ({
            x: hit.a.x + (hit.b.x - hit.a.x) * t,
            y: hit.a.y + (hit.b.y - hit.a.y) * t,
          });
          const free = subtractIntervals(
            [t0, t1],
            get().doors
              .filter((d) => d.wallId === hit.wallId && d.segIndex === hit.segIndex)
              .map((d) => [d.t0 ?? 0, d.t1 ?? 1] as [number, number]),
          );
          if (free.length === 0) return false;
          // Escolhe o sub-intervalo livre que contém (ou está mais próximo de) o clique.
          const pick = free.reduce((best, cur) => {
            const score = (r: [number, number]) =>
              hit.t >= r[0] && hit.t <= r[1] ? 0 : Math.min(Math.abs(hit.t - r[0]), Math.abs(hit.t - r[1]));
            return score(cur) < score(best) ? cur : best;
          });
          if (pick[1] - pick[0] < 0.01) return false;
          const door: Door = {
            id: uid(),
            a: lerp(pick[0]),
            b: lerp(pick[1]),
            open: false,
            wallId: hit.wallId,
            segIndex: hit.segIndex,
            t0: pick[0],
            t1: pick[1],
          };
          set(() => ({ ...pushHistory(), doors: [...get().doors, door] }));
          return true;
        },

        addDoorRange: (wallId, segIndex, t0, t1) => {
          const { walls, doors } = get();
          const w = walls.find((x) => x.id === wallId);
          if (!w) return null;
          const edges: { a: Vec2; b: Vec2 }[] = [];
          for (let i = 0; i < w.points.length - 1; i++)
            edges.push({ a: w.points[i], b: w.points[i + 1] });
          if (w.closed && w.points.length > 2)
            edges.push({ a: w.points[w.points.length - 1], b: w.points[0] });
          const edge = edges[segIndex];
          if (!edge) return null;
          const lo = Math.max(0, Math.min(t0, t1));
          const hi = Math.min(1, Math.max(t0, t1));
          if (hi - lo < 0.01) return null;
          const free = subtractIntervals(
            [lo, hi],
            doors
              .filter((d) => d.wallId === wallId && d.segIndex === segIndex)
              .map((d) => [d.t0 ?? 0, d.t1 ?? 1] as [number, number]),
          ).filter(([a, b]) => b - a >= 0.01);
          if (free.length === 0) return null;
          const lerp = (t: number) => ({
            x: edge.a.x + (edge.b.x - edge.a.x) * t,
            y: edge.a.y + (edge.b.y - edge.a.y) * t,
          });
          const newDoors: Door[] = free.map(([a, b]) => ({
            id: uid(),
            a: lerp(a),
            b: lerp(b),
            open: false,
            wallId,
            segIndex,
            t0: a,
            t1: b,
          }));
          set(() => ({ ...pushHistory(), doors: [...get().doors, ...newDoors] }));
          return newDoors[newDoors.length - 1].id;
        },



        addLight: (p, radius = 500) =>
          set(() => {
            const light = defaultLight(p, radius);
            return {
              ...pushHistory(),
              lights: [...get().lights, light],
              selectedLightId: light.id,
            };
          }),

        moveLight: (id, p) =>
          set((s) => ({
            lights: s.lights.map((l) => (l.id === id ? { ...l, position: p } : l)),
          })),

        updateLight: (id, patch) =>
          set((s) => ({
            lights: s.lights.map((l) => (l.id === id ? { ...l, ...patch } : l)),
          })),

        selectLight: (id) => set({ selectedLightId: id }),
        selectWall: (id) => set({ selectedWallId: id }),

        setWallKind: (id, kind) =>
          set((s) => ({
            ...pushHistory(),
            walls: s.walls.map((w) => (w.id === id ? { ...w, kind } : w)),
          })),

        toggleDoor: (id) =>
          set((s) => ({
            ...pushHistory(),
            doors: s.doors.map((d) => (d.id === id ? { ...d, open: !d.open } : d)),
          })),

        removeWall: (id) =>
          set((s) => ({
            ...pushHistory(),
            walls: s.walls.filter((w) => w.id !== id),
            doors: s.doors.filter((d) => d.wallId !== id),
            selectedWallId: s.selectedWallId === id ? null : s.selectedWallId,
          })),
        removeDoor: (id) =>
          set((s) => ({ ...pushHistory(), doors: s.doors.filter((d) => d.id !== id) })),
        removeLight: (id) =>
          set((s) => ({
            ...pushHistory(),
            lights: s.lights.filter((l) => l.id !== id),
            selectedLightId: s.selectedLightId === id ? null : s.selectedLightId,
          })),

        updateWallPoint: (wallId, index, p) =>
          set((s) => ({
            walls: s.walls.map((w) =>
              w.id === wallId
                ? { ...w, points: w.points.map((pt, i) => (i === index ? p : pt)) }
                : w,
            ),
          })),

        moveWall: (wallId, dx, dy) =>
          set((s) => ({
            walls: s.walls.map((w) =>
              w.id === wallId
                ? { ...w, points: w.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) }
                : w,
            ),
            doors: s.doors.map((d) =>
              d.wallId === wallId
                ? { ...d, a: { x: d.a.x + dx, y: d.a.y + dy }, b: { x: d.b.x + dx, y: d.b.y + dy } }
                : d,
            ),
          })),

        updateDoorPoint: (doorId, end, p) =>
          set((s) => ({
            doors: s.doors.map((d) => (d.id === doorId ? { ...d, [end]: p } : d)),
          })),
        snapshot: () => set(() => ({ ...pushHistory() })),

        clearAll: () =>
          set(() => ({
            ...pushHistory(),
            walls: [],
            doors: [],
            lights: [],
            draft: [],
            selectedLightId: null,
          })),

        loadDemo: () =>
          set(() => ({
            ...pushHistory(),
            walls: DEMO.walls,
            doors: DEMO.doors,
            lights: DEMO.lights,
            draft: [],
            selectedLightId: null,
          })),

        undo: () =>
          set((s) => {
            const prev = s.past[s.past.length - 1];
            if (!prev) return s;
            return {
              past: s.past.slice(0, -1),
              future: [snap(s), ...s.future].slice(0, 50),
              walls: prev.walls,
              doors: prev.doors,
              lights: prev.lights,
              draft: [],
            };
          }),

        redo: () =>
          set((s) => {
            const next = s.future[0];
            if (!next) return s;
            return {
              past: [...s.past, snap(s)].slice(-50),
              future: s.future.slice(1),
              walls: next.walls,
              doors: next.doors,
              lights: next.lights,
              draft: [],
            };
          }),
      };
    },
    {
      name: "fog-store-v2",
      partialize: (s) => ({ walls: s.walls, doors: s.doors, lights: s.lights, darknessMode: s.darknessMode }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FogState>;
        const merged = { ...current, ...p } as FogState;
        // Remove paredes/portas de demonstração antigas que ficavam "invisíveis" para players.
        const demoKey = (pts: Vec2[]) => pts.map((q) => `${q.x},${q.y}`).join("|");
        const demoWalls = new Set(DEMO.walls.map((w) => demoKey(w.points)));
        const demoDoors = new Set(DEMO.doors.map((d) => demoKey([d.a!, d.b!])));
        const walls = (merged.walls ?? []).filter((w) => !demoWalls.has(demoKey(w.points)));
        const doors = (merged.doors ?? []).filter((d) =>
          d.wallId ? walls.some((w) => w.id === d.wallId) : !(d.a && d.b && demoDoors.has(demoKey([d.a, d.b]))),
        );
        return { ...merged, walls, doors };
      },
    },
  ),
);
