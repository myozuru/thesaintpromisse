/** Geometria de colisão compartilhada pelo mapa e pelos movimentos OMNI. */
import type { Entity } from '@/stores/useMapStore';

export type MapCollisionPoint = { x: number; y: number };
export type MapCollisionSegment = [MapCollisionPoint, MapCollisionPoint];
export type MapCollisionToken = { origin: MapCollisionPoint; entity: Entity };
type MapCollisionBounds = { minX: number; minY: number; maxX: number; maxY: number };
type MapCollisionBlocker = { segment: MapCollisionSegment; bounds: MapCollisionBounds };
export type MapCollisionCache = { blockers: MapCollisionBlocker[]; cellSize: number; cells: Map<string, number[]> };

const COLLISION_TOUCH_EPS = 0.05;
const COLLISION_TIME_EPS = 1e-5;
// Antes era 0.015, o que abria buracos nas quinas (onde duas paredes se encontram),
// permitindo que tokens atravessassem cantos. Mantemos só o eps numérico mínimo.
const COLLISION_ENDPOINT_EPS = 1e-6;
const COLLISION_BROADPHASE_PAD = 2;
const COLLISION_MAX_SUBSTEP = 28;
const COLLISION_SPATIAL_CELL = 192;

const tokenCenterAt = (token: MapCollisionToken, dx: number, dy: number): MapCollisionPoint => ({
  x: token.origin.x + dx,
  y: token.origin.y + dy,
});

const tokenLocalToWorld = (
  token: MapCollisionToken,
  dx: number,
  dy: number,
  lx: number,
  ly: number,
): MapCollisionPoint => {
  const c = Math.cos(token.entity.rotation);
  const s = Math.sin(token.entity.rotation);
  const center = tokenCenterAt(token, dx, dy);
  return { x: center.x + lx * c - ly * s, y: center.y + lx * s + ly * c };
};

const worldToTokenLocalAt = (
  p: MapCollisionPoint,
  token: MapCollisionToken,
  dx: number,
  dy: number,
): MapCollisionPoint => {
  const center = tokenCenterAt(token, dx, dy);
  const px = p.x - center.x;
  const py = p.y - center.y;
  const c = Math.cos(-token.entity.rotation);
  const s = Math.sin(-token.entity.rotation);
  return { x: px * c - py * s, y: px * s + py * c };
};

const tokenFootprintPoints = (token: MapCollisionToken, dx: number, dy: number): MapCollisionPoint[] => {
  const hw = token.entity.w / 2;
  const hh = token.entity.h / 2;
  const points: MapCollisionPoint[] = [];
  if (token.entity.shape === 'ELLIPSE') {
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const a = (Math.PI * 2 * i) / steps;
      points.push(tokenLocalToWorld(token, dx, dy, Math.cos(a) * hw, Math.sin(a) * hh));
    }
    return points;
  }

  const perEdge = 4;
  for (let i = 0; i <= perEdge; i++) {
    const t = -hw + (2 * hw * i) / perEdge;
    points.push(tokenLocalToWorld(token, dx, dy, t, -hh));
    points.push(tokenLocalToWorld(token, dx, dy, t, hh));
  }
  for (let i = 1; i < perEdge; i++) {
    const t = -hh + (2 * hh * i) / perEdge;
    points.push(tokenLocalToWorld(token, dx, dy, -hw, t));
    points.push(tokenLocalToWorld(token, dx, dy, hw, t));
  }
  return points;
};

export const tokenFootprintSegments = (token: MapCollisionToken, dx: number, dy: number): MapCollisionSegment[] => {
  const hw = token.entity.w / 2;
  const hh = token.entity.h / 2;
  if (token.entity.shape === 'ELLIPSE') {
    const pts = tokenFootprintPoints(token, dx, dy);
    return pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
  }
  const corners = [
    tokenLocalToWorld(token, dx, dy, -hw, -hh),
    tokenLocalToWorld(token, dx, dy, hw, -hh),
    tokenLocalToWorld(token, dx, dy, hw, hh),
    tokenLocalToWorld(token, dx, dy, -hw, hh),
  ];
  return corners.map((p, i) => [p, corners[(i + 1) % corners.length]]);
};

const pointInsideTokenFootprint = (
  p: MapCollisionPoint,
  token: MapCollisionToken,
  dx: number,
  dy: number,
): boolean => {
  const lp = worldToTokenLocalAt(p, token, dx, dy);
  const hw = Math.max(0, token.entity.w / 2 - COLLISION_TOUCH_EPS);
  const hh = Math.max(0, token.entity.h / 2 - COLLISION_TOUCH_EPS);
  if (token.entity.shape === 'ELLIPSE') {
    if (hw <= 0 || hh <= 0) return false;
    const nx = lp.x / hw;
    const ny = lp.y / hh;
    return nx * nx + ny * ny < 1;
  }
  return Math.abs(lp.x) < hw && Math.abs(lp.y) < hh;
};

const segmentIntersectionParams = (
  a: MapCollisionPoint,
  b: MapCollisionPoint,
  c: MapCollisionPoint,
  d: MapCollisionPoint,
): { t: number; u: number } | null => {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denom;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denom;
  if (t < -1e-7 || t > 1 + 1e-7 || u < -1e-7 || u > 1 + 1e-7) return null;
  return { t: Math.max(0, Math.min(1, t)), u: Math.max(0, Math.min(1, u)) };
};

const segmentIntersectionT = (
  a: MapCollisionPoint,
  b: MapCollisionPoint,
  c: MapCollisionPoint,
  d: MapCollisionPoint,
): number | null => {
  return segmentIntersectionParams(a, b, c, d)?.t ?? null;
};

const boundsOverlap = (a: MapCollisionBounds, b: MapCollisionBounds): boolean =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

const segmentBounds = ([a, b]: MapCollisionSegment, pad = 0): MapCollisionBounds => ({
  minX: Math.min(a.x, b.x) - pad,
  minY: Math.min(a.y, b.y) - pad,
  maxX: Math.max(a.x, b.x) + pad,
  maxY: Math.max(a.y, b.y) + pad,
});

export const prepareCollisionCache = (segments: MapCollisionSegment[]): MapCollisionCache => {
  const blockers = segments.map((segment) => ({ segment, bounds: segmentBounds(segment, COLLISION_BROADPHASE_PAD) }));
  const cells = new Map<string, number[]>();
  for (let i = 0; i < blockers.length; i++) {
    const b = blockers[i].bounds;
    const minX = Math.floor(b.minX / COLLISION_SPATIAL_CELL);
    const maxX = Math.floor(b.maxX / COLLISION_SPATIAL_CELL);
    const minY = Math.floor(b.minY / COLLISION_SPATIAL_CELL);
    const maxY = Math.floor(b.maxY / COLLISION_SPATIAL_CELL);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const key = `${cx},${cy}`;
        const bucket = cells.get(key);
        if (bucket) bucket.push(i);
        else cells.set(key, [i]);
      }
    }
  }
  return { blockers, cellSize: COLLISION_SPATIAL_CELL, cells };
};

const tokenSweepBounds = (
  token: MapCollisionToken,
  fromDx: number,
  fromDy: number,
  moveDx: number,
  moveDy: number,
): MapCollisionBounds => {
  const start = tokenCenterAt(token, fromDx, fromDy);
  const end = { x: start.x + moveDx, y: start.y + moveDy };
  const radius = Math.hypot(token.entity.w, token.entity.h) / 2 + COLLISION_BROADPHASE_PAD;
  return {
    minX: Math.min(start.x, end.x) - radius,
    minY: Math.min(start.y, end.y) - radius,
    maxX: Math.max(start.x, end.x) + radius,
    maxY: Math.max(start.y, end.y) + radius,
  };
};

const filterBlockersForMove = (
  tokens: MapCollisionToken[],
  cache: MapCollisionCache,
  fromDx: number,
  fromDy: number,
  moveDx: number,
  moveDy: number,
): MapCollisionSegment[] => {
  const bounds = tokens.map((token) => tokenSweepBounds(token, fromDx, fromDy, moveDx, moveDy));
  const indices = new Set<number>();
  for (const b of bounds) {
    const minX = Math.floor(b.minX / cache.cellSize);
    const maxX = Math.floor(b.maxX / cache.cellSize);
    const minY = Math.floor(b.minY / cache.cellSize);
    const maxY = Math.floor(b.maxY / cache.cellSize);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const bucket = cache.cells.get(`${cx},${cy}`);
        if (bucket) for (const i of bucket) indices.add(i);
      }
    }
  }
  return Array.from(indices)
    .map((i) => cache.blockers[i])
    .filter((blocker) => bounds.some((tb) => boundsOverlap(tb, blocker.bounds)))
    .map((blocker) => blocker.segment);
};

const segmentsProperlyCross = (
  a: MapCollisionPoint,
  b: MapCollisionPoint,
  c: MapCollisionPoint,
  d: MapCollisionPoint,
): boolean => {
  const t = segmentIntersectionT(a, b, c, d);
  if (t === null || t < -COLLISION_TIME_EPS || t > 1 + COLLISION_TIME_EPS) return false;
  const u = segmentIntersectionT(c, d, a, b);
  return u !== null && u >= -COLLISION_TIME_EPS && u <= 1 + COLLISION_TIME_EPS;
};

const firstPointBlockerHit = (
  a: MapCollisionPoint,
  b: MapCollisionPoint,
  blockers: MapCollisionSegment[],
): { t: number; normal: MapCollisionPoint } | null => {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  if (Math.hypot(vx, vy) < 1e-9) return null;
  let best: { t: number; normal: MapCollisionPoint } | null = null;
  for (const [p, q] of blockers) {
    const hit = segmentIntersectionParams(a, b, p, q);
    if (!hit || hit.t <= COLLISION_TIME_EPS || hit.t > 1 + COLLISION_TIME_EPS) continue;
    const sx = q.x - p.x;
    const sy = q.y - p.y;
    const len = Math.hypot(sx, sy) || 1;
    let nx = -sy / len;
    let ny = sx / len;
    if (vx * nx + vy * ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    if (!best || hit.t < best.t) best = { t: hit.t, normal: { x: nx, y: ny } };
  }
  return best;
};

const localVectorToWorld = (token: MapCollisionToken, v: MapCollisionPoint): MapCollisionPoint => {
  const c = Math.cos(token.entity.rotation);
  const s = Math.sin(token.entity.rotation);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
};

const rectEntryHit = (
  start: MapCollisionPoint,
  end: MapCollisionPoint,
  hw: number,
  hh: number,
): { t: number; normal: MapCollisionPoint } | null => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const startsInside = Math.abs(start.x) < hw && Math.abs(start.y) < hh;
  if (startsInside) {
    const movingDeeper = start.x * dx / Math.max(1, hw * hw) + start.y * dy / Math.max(1, hh * hh) < -1e-6;
    if (!movingDeeper) return null;
    const len = Math.hypot(start.x, start.y) || 1;
    return { t: COLLISION_TIME_EPS, normal: { x: start.x / len, y: start.y / len } };
  }
  let tEnter = -Infinity;
  let tExit = Infinity;
  let normal: MapCollisionPoint = { x: 0, y: 0 };

  const applyAxis = (pos: number, delta: number, min: number, max: number, axis: 'x' | 'y') => {
    if (Math.abs(delta) < 1e-9) return pos >= min && pos <= max;
    const enter = delta > 0 ? (min - pos) / delta : (max - pos) / delta;
    const exit = delta > 0 ? (max - pos) / delta : (min - pos) / delta;
    if (enter > tEnter) {
      tEnter = enter;
      normal = axis === 'x'
        ? { x: delta > 0 ? -1 : 1, y: 0 }
        : { x: 0, y: delta > 0 ? -1 : 1 };
    }
    tExit = Math.min(tExit, exit);
    return true;
  };

  if (!applyAxis(start.x, dx, -hw, hw, 'x')) return null;
  if (!applyAxis(start.y, dy, -hh, hh, 'y')) return null;
  if (tEnter > tExit || tExit < COLLISION_TIME_EPS || tEnter <= COLLISION_TIME_EPS || tEnter > 1 + COLLISION_TIME_EPS) return null;
  return { t: Math.max(0, Math.min(1, tEnter)), normal };
};

const ellipseEntryHit = (
  start: MapCollisionPoint,
  end: MapCollisionPoint,
  hw: number,
  hh: number,
): { t: number; normal: MapCollisionPoint } | null => {
  if (hw <= 0 || hh <= 0) return null;
  const sx = start.x / hw;
  const sy = start.y / hh;
  const dx = (end.x - start.x) / hw;
  const dy = (end.y - start.y) / hh;
  if (sx * sx + sy * sy < 1) {
    if (sx * dx + sy * dy >= -1e-6) return null;
    const nLen = Math.hypot(start.x / (hw * hw), start.y / (hh * hh)) || 1;
    return { t: COLLISION_TIME_EPS, normal: { x: (start.x / (hw * hw)) / nLen, y: (start.y / (hh * hh)) / nLen } };
  }
  const a = dx * dx + dy * dy;
  const b = 2 * (sx * dx + sy * dy);
  const c = sx * sx + sy * sy - 1;
  const disc = b * b - 4 * a * c;
  if (a < 1e-9 || disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t <= COLLISION_TIME_EPS || t > 1 + COLLISION_TIME_EPS) return null;
  const px = start.x + (end.x - start.x) * t;
  const py = start.y + (end.y - start.y) * t;
  const nLen = Math.hypot(px / (hw * hw), py / (hh * hh)) || 1;
  return { t: Math.max(0, Math.min(1, t)), normal: { x: (px / (hw * hw)) / nLen, y: (py / (hh * hh)) / nLen } };
};

export const placementBlocked = (
  tokens: MapCollisionToken[],
  blockers: MapCollisionSegment[],
  dx: number,
  dy: number,
): boolean => {
  for (const token of tokens) {
    const tokenSegments = tokenFootprintSegments(token, dx, dy);
    for (const [a, b] of blockers) {
      const insideA = pointInsideTokenFootprint(a, token, dx, dy);
      const insideB = pointInsideTokenFootprint(b, token, dx, dy);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (
        insideA ||
        pointInsideTokenFootprint(mid, token, dx, dy) ||
        insideB
      ) return true;
      if (insideA !== insideB) return true;
      if (tokenSegments.some(([p, q]) => segmentsProperlyCross(a, b, p, q))) return true;
    }
  }
  return false;
};

export const firstFootprintHit = (
  tokens: MapCollisionToken[],
  blockers: MapCollisionSegment[],
  fromDx: number,
  fromDy: number,
  moveDx: number,
  moveDy: number,
): { t: number; normal: MapCollisionPoint } | null => {
  if (Math.hypot(moveDx, moveDy) < 1e-9) return null;
  let best: { t: number; normal: MapCollisionPoint } | null = null;
  for (const token of tokens) {
    const hw = token.entity.w / 2;
    const hh = token.entity.h / 2;
    const points = [tokenCenterAt(token, fromDx, fromDy), ...tokenFootprintPoints(token, fromDx, fromDy)];
    for (const p of points) {
      const hit = firstPointBlockerHit(p, { x: p.x + moveDx, y: p.y + moveDy }, blockers);
      if (hit && (!best || hit.t < best.t)) best = hit;
    }

    for (const [a, b] of blockers) {
      for (const p of [a, b]) {
        const start = worldToTokenLocalAt(p, token, fromDx, fromDy);
        const end = worldToTokenLocalAt(p, token, fromDx + moveDx, fromDy + moveDy);
        const hit = token.entity.shape === 'ELLIPSE'
          ? ellipseEntryHit(start, end, hw, hh)
          : rectEntryHit(start, end, hw, hh);
        if (hit && (!best || hit.t < best.t)) {
          best = { t: hit.t, normal: localVectorToWorld(token, hit.normal) };
        }
      }
    }
  }
  return best;
};

export const resolveCollisionMove = (
  tokens: MapCollisionToken[],
  blockers: MapCollisionCache,
  from: { dx: number; dy: number },
  desiredMove: { dx: number; dy: number },
): { dx: number; dy: number } => {
  let resolvedDx = from.dx;
  let resolvedDy = from.dy;
  const desiredLen = Math.hypot(desiredMove.dx, desiredMove.dy);
  const substeps = Math.min(8, Math.max(1, Math.ceil(desiredLen / COLLISION_MAX_SUBSTEP)));
  const stepDx = desiredMove.dx / substeps;
  const stepDy = desiredMove.dy / substeps;

  for (let step = 0; step < substeps; step++) {
    let moveDx = stepDx;
    let moveDy = stepDy;

    for (let i = 0; i < 3 && Math.hypot(moveDx, moveDy) > 0.001; i++) {
      const nearbyBlockers = filterBlockersForMove(tokens, blockers, resolvedDx, resolvedDy, moveDx, moveDy);
      if (!nearbyBlockers.length) {
        const ndx = resolvedDx + moveDx;
        const ndy = resolvedDy + moveDy;
        if (placementBlocked(tokens, blockers.blockers.map((blocker) => blocker.segment), ndx, ndy)) {
          return { dx: resolvedDx, dy: resolvedDy };
        }
        resolvedDx = ndx;
        resolvedDy = ndy;
        break;
      }

      const hit = firstFootprintHit(tokens, nearbyBlockers, resolvedDx, resolvedDy, moveDx, moveDy);
      if (!hit) {
        const ndx = resolvedDx + moveDx;
        const ndy = resolvedDy + moveDy;
        if (!placementBlocked(tokens, nearbyBlockers, ndx, ndy)) {
          resolvedDx = ndx;
          resolvedDy = ndy;
          break;
        }
        return { dx: resolvedDx, dy: resolvedDy };
      }

      const safeT = hit ? Math.max(0, hit.t - 0.0001) : 0;
      resolvedDx += moveDx * safeT;
      resolvedDy += moveDy * safeT;

      if (!hit) break;
      const restDx = moveDx * (1 - hit.t);
      const restDy = moveDy * (1 - hit.t);
      const into = restDx * hit.normal.x + restDy * hit.normal.y;
      if (into >= 0) return { dx: resolvedDx, dy: resolvedDy };
      moveDx = restDx - hit.normal.x * into;
      moveDy = restDy - hit.normal.y * into;
      const probeDx = resolvedDx + moveDx;
      const probeDy = resolvedDy + moveDy;
      if (placementBlocked(tokens, nearbyBlockers, probeDx, probeDy)) return { dx: resolvedDx, dy: resolvedDy };
    }
  }

  return { dx: resolvedDx, dy: resolvedDy };
};
