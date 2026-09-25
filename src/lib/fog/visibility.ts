import { angle, rayVsSegment } from "./math";
import type { Door, Segment, Vec2, Wall } from "./types";

/** Normaliza ângulo para o intervalo [-PI, PI] */
function normalize(a: number): number {
  let x = a;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x < -Math.PI) x += 2 * Math.PI;
  return x;
}

export interface ConeConfig {
  direction: number;
  angle: number;
}

/**
 * Calcula o polígono de visibilidade. Se `cone` for fornecido, retorna uma
 * "fatia" começando e terminando na origem.
 */
export function computeVisibilityPolygon(
  origin: Vec2,
  segments: Segment[],
  maxRadius: number,
  cone?: ConeConfig,
): Vec2[] {
  const half = cone ? cone.angle / 2 : 0;

  if (segments.length === 0) {
    const pts: Vec2[] = [];
    const N = 64;
    if (cone) {
      pts.push({ ...origin });
      const start = cone.direction - half;
      const end = cone.direction + half;
      for (let i = 0; i <= N; i++) {
        const a = start + ((end - start) * i) / N;
        pts.push({ x: origin.x + Math.cos(a) * maxRadius, y: origin.y + Math.sin(a) * maxRadius });
      }
      return pts;
    }
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      pts.push({ x: origin.x + Math.cos(a) * maxRadius, y: origin.y + Math.sin(a) * maxRadius });
    }
    return pts;
  }

  const all = segments;

  const endpoints: Vec2[] = [];
  const seen = new Set<string>();
  for (const s of all) {
    for (const p of [s.a, s.b]) {
      const k = `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
      if (!seen.has(k)) {
        seen.add(k);
        endpoints.push(p);
      }
    }
  }

  const EPS = 0.0001;
  const candidates: number[] = [];
  for (const ep of endpoints) {
    const base = angle(origin, ep);
    candidates.push(base, base + EPS, base - EPS);
  }
  const SAMPLES = 64;
  for (let i = 0; i < SAMPLES; i++) {
    candidates.push((i / SAMPLES) * Math.PI * 2 - Math.PI);
  }

  if (cone) {
    candidates.push(cone.direction - half, cone.direction + half);
  }

  const hits: { angle: number; point: Vec2 }[] = [];
  for (const a of candidates) {
    if (cone) {
      const d = normalize(a - cone.direction);
      if (d < -half - 1e-6 || d > half + 1e-6) continue;
    }
    const dir = { x: Math.cos(a), y: Math.sin(a) };
    let best: { t: number; point: Vec2 } | null = null;
    for (const s of all) {
      const hit = rayVsSegment(origin, dir, s.a, s.b);
      if (hit && hit.t <= maxRadius && (!best || hit.t < best.t)) best = hit;
    }
    if (!best) {
      best = {
        t: maxRadius,
        point: { x: origin.x + dir.x * maxRadius, y: origin.y + dir.y * maxRadius },
      };
    }
    hits.push({ angle: a, point: best.point });
  }

  if (cone) {
    hits.sort(
      (x, y) => normalize(x.angle - cone.direction) - normalize(y.angle - cone.direction),
    );
    return [origin, ...hits.map((h) => h.point)];
  }
  hits.sort((x, y) => x.angle - y.angle);
  return hits.map((h) => h.point);
}

/** Lista as arestas (a,b) de uma parede, incluindo a de fechamento. */
export function wallEdges(w: Wall): { a: Vec2; b: Vec2 }[] {
  const edges: { a: Vec2; b: Vec2 }[] = [];
  for (let i = 0; i < w.points.length - 1; i++) {
    edges.push({ a: w.points[i], b: w.points[i + 1] });
  }
  if (w.closed && w.points.length > 2) {
    edges.push({ a: w.points[w.points.length - 1], b: w.points[0] });
  }
  return edges;
}

export interface WallSnap {
  wallId: string;
  segIndex: number;
  a: Vec2;
  b: Vec2;
  edgeLen: number;
  t: number;
  dist: number;
}

/** Encontra a aresta de parede mais próxima do ponto `p` (até `maxDist`). */
export function snapToWallEdge(
  p: Vec2,
  walls: Wall[],
  maxDist = 14,
): WallSnap | null {
  let best: WallSnap | null = null;
  for (const w of walls) {
    const edges = wallEdges(w);
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
      if (d < maxDist && (!best || d < best.dist)) {
        best = {
          wallId: w.id,
          segIndex: i,
          a: edge.a,
          b: edge.b,
          edgeLen: Math.sqrt(l2),
          t,
          dist: d,
        };
      }
    });
  }
  return best;
}

/** Resolve as pontas (a,b) de uma porta, usando a âncora na parede se houver. */
export function resolveDoor(door: Door, walls: Wall[]): { a: Vec2; b: Vec2 } {
  if (
    door.wallId != null &&
    door.segIndex != null &&
    door.t0 != null &&
    door.t1 != null
  ) {
    const w = walls.find((x) => x.id === door.wallId);
    if (w) {
      const edges = wallEdges(w);
      const edge = edges[door.segIndex];
      if (edge) {
        const lerp = (t: number) => ({
          x: edge.a.x + (edge.b.x - edge.a.x) * t,
          y: edge.a.y + (edge.b.y - edge.a.y) * t,
        });
        return { a: lerp(door.t0), b: lerp(door.t1) };
      }
    }
  }
  return { a: door.a, b: door.b };
}

export function buildSegments(walls: Wall[], doors: Door[]): Segment[] {
  const out: Segment[] = [];

  // wallId -> segIndex -> ranges [t0,t1] (normalized lo<=hi)
  const cutMap = new Map<string, Map<number, [number, number][]>>();
  for (const d of doors) {
    if (
      d.wallId != null &&
      d.segIndex != null &&
      d.t0 != null &&
      d.t1 != null
    ) {
      if (!cutMap.has(d.wallId)) cutMap.set(d.wallId, new Map());
      const segMap = cutMap.get(d.wallId)!;
      if (!segMap.has(d.segIndex)) segMap.set(d.segIndex, []);
      const lo = Math.min(d.t0, d.t1);
      const hi = Math.max(d.t0, d.t1);
      segMap.get(d.segIndex)!.push([lo, hi]);
    }
  }

  for (const w of walls) {
    const edges = wallEdges(w);
    const segMap = cutMap.get(w.id);
    edges.forEach((edge, i) => {
      const ranges = (segMap?.get(i) ?? []).slice().sort((x, y) => x[0] - y[0]);
      if (ranges.length === 0) {
        out.push({ a: edge.a, b: edge.b });
        return;
      }
      const lerp = (t: number) => ({
        x: edge.a.x + (edge.b.x - edge.a.x) * t,
        y: edge.a.y + (edge.b.y - edge.a.y) * t,
      });
      let cursor = 0;
      for (const [t0, t1] of ranges) {
        if (t0 > cursor + 1e-6) out.push({ a: lerp(cursor), b: lerp(t0) });
        cursor = Math.max(cursor, t1);
      }
      if (cursor < 1 - 1e-6) out.push({ a: lerp(cursor), b: lerp(1) });
    });
  }

  // Portas fechadas bloqueiam luz
  for (const d of doors) {
    if (d.open) continue;
    // Porta órfã (parede já apagada) não pode continuar bloqueando.
    if (d.wallId != null && !walls.some((w) => w.id === d.wallId)) continue;
    const { a, b } = resolveDoor(d, walls);
    out.push({ a, b });
  }

  return out;
}
