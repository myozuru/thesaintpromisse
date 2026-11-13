export interface Point2D { x: number; y: number }
export interface DifficultTerrainArea {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  shape: 'RECT' | 'ELLIPSE';
  difficultTerrain?: 'natural' | 'magical';
}

const EPSILON = 1e-9;

function localPoint(point: Point2D, area: DifficultTerrainArea): Point2D {
  const angle = -(area.rotation ?? 0);
  const dx = point.x - area.x;
  const dy = point.y - area.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

function clipAxis(start: number, delta: number, halfExtent: number, interval: [number, number]): boolean {
  if (Math.abs(delta) < EPSILON) return Math.abs(start) <= halfExtent;
  const a = (-halfExtent - start) / delta;
  const b = (halfExtent - start) / delta;
  interval[0] = Math.max(interval[0], Math.min(a, b));
  interval[1] = Math.min(interval[1], Math.max(a, b));
  return interval[0] <= interval[1] + EPSILON;
}

/** Segment parameter interval inside a rotated map area, or null when it misses. */
export function segmentInsideTerrainInterval(
  start: Point2D,
  end: Point2D,
  area: DifficultTerrainArea,
): [number, number] | null {
  if (!(area.w > 0 && area.h > 0)) return null;
  const a = localPoint(start, area);
  const b = localPoint(end, area);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const interval: [number, number] = [0, 1];

  if (area.shape === 'RECT') {
    if (!clipAxis(a.x, dx, area.w / 2, interval) || !clipAxis(a.y, dy, area.h / 2, interval)) return null;
    const lo = Math.max(0, interval[0]);
    const hi = Math.min(1, interval[1]);
    return hi > lo ? [lo, hi] : null;
  }

  const rx = area.w / 2;
  const ry = area.h / 2;
  const A = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  const B = (2 * a.x * dx) / (rx * rx) + (2 * a.y * dy) / (ry * ry);
  const C = (a.x * a.x) / (rx * rx) + (a.y * a.y) / (ry * ry) - 1;
  if (A < EPSILON) return C <= 0 ? [0, 1] : null;
  const discriminant = B * B - 4 * A * C;
  if (discriminant < 0) return C <= 0 ? [0, 1] : null;
  const root = Math.sqrt(discriminant);
  const lo = Math.max(0, (-B - root) / (2 * A));
  const hi = Math.min(1, (-B + root) / (2 * A));
  return hi > lo ? [lo, hi] : null;
}

/** Extra movement cost for the part of this segment inside difficult areas. */
export function difficultTerrainPenaltyMeters(
  start: Point2D,
  end: Point2D,
  metersPerPx: number,
  areas: readonly DifficultTerrainArea[],
  ignoresNatural = false,
): number {
  if (!Number.isFinite(metersPerPx) || metersPerPx <= 0) return 0;
  const eligible = areas.filter((area) => area.difficultTerrain && !(ignoresNatural && area.difficultTerrain === 'natural'));
  if (!eligible.length) return 0;
  const intervals = eligible
    .map((area) => segmentInsideTerrainInterval(start, end, area))
    .filter((interval): interval is [number, number] => !!interval)
    .sort((a, b) => a[0] - b[0]);
  if (!intervals.length) return 0;
  let covered = 0;
  let [lo, hi] = intervals[0];
  for (const interval of intervals.slice(1)) {
    if (interval[0] <= hi + EPSILON) hi = Math.max(hi, interval[1]);
    else { covered += hi - lo; [lo, hi] = interval; }
  }
  covered += hi - lo;
  return Math.hypot(end.x - start.x, end.y - start.y) * metersPerPx * covered;
}

export function movementCostForTerrainSegment(
  start: Point2D,
  end: Point2D,
  metersPerPx: number,
  areas: readonly DifficultTerrainArea[],
  ignoresNatural = false,
): number {
  return Math.hypot(end.x - start.x, end.y - start.y) * metersPerPx
    + difficultTerrainPenaltyMeters(start, end, metersPerPx, areas, ignoresNatural);
}

/** Truncate a map route at a physical distance, preserving its intermediate waypoints. */
export function routePrefixByDistance(
  route: readonly Point2D[],
  maxDistanceM: number,
  metersPerPx: number,
): Point2D[] {
  if (!route.length) return [];
  const prefix = [{ ...route[0] }];
  if (!Number.isFinite(maxDistanceM) || maxDistanceM <= 0 || !Number.isFinite(metersPerPx) || metersPerPx <= 0) return prefix;
  let remainingPx = maxDistanceM / metersPerPx;
  for (let i = 1; i < route.length; i++) {
    const start = route[i - 1];
    const end = route[i];
    const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
    if (lengthPx <= EPSILON) continue;
    if (lengthPx <= remainingPx + EPSILON) {
      prefix.push({ ...end });
      remainingPx = Math.max(0, remainingPx - lengthPx);
      if (remainingPx <= EPSILON) break;
      continue;
    }
    if (remainingPx > EPSILON) {
      const ratio = remainingPx / lengthPx;
      prefix.push({ x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio });
    }
    break;
  }
  return prefix;
}
