import type { Vec2 } from "./types";
export type { Vec2 };

export const v = (x: number, y: number): Vec2 => ({ x, y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const angle = (from: Vec2, to: Vec2): number =>
  Math.atan2(to.y - from.y, to.x - from.x);

/** Distância ponto → segmento */
export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

/** Interseção raio (origin + t*dir, t>=0) com segmento (a,b). Retorna t e ponto, ou null. */
export function rayVsSegment(
  origin: Vec2,
  dir: Vec2,
  a: Vec2,
  b: Vec2,
): { t: number; point: Vec2 } | null {
  const r_px = origin.x;
  const r_py = origin.y;
  const r_dx = dir.x;
  const r_dy = dir.y;
  const s_px = a.x;
  const s_py = a.y;
  const s_dx = b.x - a.x;
  const s_dy = b.y - a.y;

  const denom = r_dx * s_dy - r_dy * s_dx;
  if (Math.abs(denom) < 1e-9) return null;

  // T2 = parâmetro ao longo do segmento [0,1]; T1 = distância ao longo do raio (>=0).
  const T2 = ((s_px - r_px) * r_dy - (s_py - r_py) * r_dx) / denom;
  const T1 =
    Math.abs(r_dx) > Math.abs(r_dy)
      ? (s_px + s_dx * T2 - r_px) / r_dx
      : (s_py + s_dy * T2 - r_py) / r_dy;

  if (T1 < 0) return null;
  if (T2 < 0 || T2 > 1) return null;

  return { t: T1, point: { x: r_px + r_dx * T1, y: r_py + r_dy * T1 } };
}
