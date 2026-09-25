/**
 * WallsEngine — paredes / portas / janelas / terreno para Dynamic Fog.
 *
 * Tipos:
 *   - 'wall'    : bloqueia visão e luz.
 *   - 'door'    : bloqueia visão e luz quando fechada; passa quando aberta.
 *   - 'secret'  : porta secreta (variante de door, oculta para jogadores).
 *   - 'window'  : nunca bloqueia (apenas referência visual).
 *   - 'terrain' : bloqueia VISÃO mas deixa LUZ passar (folhagem, neblina densa).
 *
 * Coordenadas em mundo.
 */
import type { Vector2 } from '@/stores/useMapStore';

export type WallKind = 'wall' | 'door' | 'secret' | 'window' | 'terrain';

export interface Wall {
  id: string;
  kind: WallKind;
  p1: Vector2;
  p2: Vector2;
  /** Para `door`/`secret`. Default false (fechada = bloqueia). */
  open?: boolean;
}

const COLORS: Record<WallKind, { open: string; closed: string }> = {
  wall:    { open: '#ff3344', closed: '#ff3344' },
  door:    { open: '#41d97a', closed: '#ffaf3a' },
  secret:  { open: '#c79bff', closed: '#8a5cff' },
  window:  { open: '#5cb8ff', closed: '#5cb8ff' },
  terrain: { open: '#7be3a8', closed: '#7be3a8' },
};

const DOOR_GAP = 22;

export const WallsEngine = {
  /** Desenha todas as paredes (apenas visível para mestre). */
  drawAll(ctx: CanvasRenderingContext2D, walls: Wall[], scale: number) {
    if (!walls.length) return;
    ctx.save();
    const lw = Math.max(1.5, 3 / scale);
    ctx.lineCap = 'round';
    for (const w of walls) {
      const c = COLORS[w.kind];
      const opened = (w.kind === 'door' || w.kind === 'secret') && w.open;
      const col = opened ? c.open : c.closed;
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      if (w.kind === 'window') ctx.setLineDash([6 / scale, 4 / scale]);
      else if (w.kind === 'terrain') ctx.setLineDash([2 / scale, 4 / scale]);
      else if (w.kind === 'secret') ctx.setLineDash([10 / scale, 3 / scale, 2 / scale, 3 / scale]);
      else if (opened) ctx.setLineDash([8 / scale, 6 / scale]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(w.p1.x, w.p1.y);
      ctx.lineTo(w.p2.x, w.p2.y);
      ctx.stroke();
      ctx.fillStyle = col;
      const r = 3 / scale;
      ctx.beginPath(); ctx.arc(w.p1.x, w.p1.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w.p2.x, w.p2.y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.setLineDash([]);
    ctx.restore();
  },

  /** Preview de um segmento sendo arrastado (line/rect/ellipse/polygon). */
  drawPreview(
    ctx: CanvasRenderingContext2D,
    a: Vector2,
    b: Vector2,
    kind: WallKind,
    scale: number,
    shape: 'line' | 'rect' | 'ellipse' | 'polygon' = 'line',
    polyPoints?: Vector2[],
  ) {
    ctx.save();
    ctx.strokeStyle = COLORS[kind].closed;
    ctx.lineWidth = Math.max(1.5, 3 / scale);
    ctx.setLineDash([6 / scale, 4 / scale]);
    ctx.beginPath();
    if (shape === 'rect') {
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
      ctx.rect(x, y, w, h);
    } else if (shape === 'ellipse') {
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
      if (rx > 0.1 && ry > 0.1) ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else if (shape === 'polygon' && polyPoints && polyPoints.length) {
      ctx.moveTo(polyPoints[0].x, polyPoints[0].y);
      for (let i = 1; i < polyPoints.length; i++) ctx.lineTo(polyPoints[i].x, polyPoints[i].y);
      ctx.lineTo(b.x, b.y);
    } else {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.restore();
  },

  /** Gera segmentos finais a partir de uma forma. */
  segmentsForShape(
    a: Vector2,
    b: Vector2,
    shape: 'line' | 'rect' | 'ellipse' | 'polygon',
    polyPoints?: Vector2[],
  ): Array<[Vector2, Vector2]> {
    if (shape === 'rect') {
      const x1 = Math.min(a.x, b.x), y1 = Math.min(a.y, b.y);
      const x2 = Math.max(a.x, b.x), y2 = Math.max(a.y, b.y);
      const p = [
        { x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 },
      ];
      return [[p[0], p[1]], [p[1], p[2]], [p[2], p[3]], [p[3], p[0]]];
    }
    if (shape === 'ellipse') {
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
      if (rx < 1 || ry < 1) return [];
      const N = 48;
      const pts: Vector2[] = [];
      for (let i = 0; i < N; i++) {
        const t = (i / N) * Math.PI * 2;
        pts.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry });
      }
      const out: Array<[Vector2, Vector2]> = [];
      for (let i = 0; i < N; i++) out.push([pts[i], pts[(i + 1) % N]]);
      return out;
    }
    if (shape === 'polygon' && polyPoints && polyPoints.length >= 2) {
      const out: Array<[Vector2, Vector2]> = [];
      const all = [...polyPoints, b];
      for (let i = 0; i < all.length - 1; i++) out.push([all[i], all[i + 1]]);
      return out;
    }
    return [[a, b]];
  },

  /** Wall mais próxima dentro de `tol` (em coords-mundo). */
  pickAt(walls: Wall[], p: Vector2, tol: number): Wall | null {
    let best: Wall | null = null;
    let bestD = tol;
    for (const w of walls) {
      const d = distPointSeg(p, w.p1, w.p2);
      if (d <= bestD) { bestD = d; best = w; }
    }
    return best;
  },

  /**
   * Segmentos ATIVOS de bloqueio para um propósito ('sight' ou 'light').
   * - wall: bloqueia ambos
   * - door/secret fechada: bloqueia ambos
   * - terrain: bloqueia 'sight' mas deixa 'light' passar
   * - window: não bloqueia nada
   */
  blockingSegments(walls: Wall[], purpose: 'sight' | 'light' = 'sight'): Array<[Vector2, Vector2]> {
    const out: Array<[Vector2, Vector2]> = [];
    const openDoors = walls.filter(
      (w) => (w.kind === 'door' || w.kind === 'secret') && w.open,
    );
    for (const w of walls) {
      if (w.kind === 'window') continue;
      if ((w.kind === 'door' || w.kind === 'secret') && w.open) continue;
      if (w.kind === 'terrain' && purpose === 'light') continue;
      out.push(...subtractDoorGaps(w.p1, w.p2, openDoors));
    }
    return out;
  },
  /**
   * Primeiro hit (t em [0,1]) de um segmento a→b contra segmentos bloqueadores.
   * Retorna null se não houver interseção.
   */
  firstHitT(a: Vector2, b: Vector2, segments: Array<[Vector2, Vector2]>): number | null {
    let best: number | null = null;
    for (const [p, q] of segments) {
      const t = segSegT(a, b, p, q);
      if (t !== null && (best === null || t < best)) best = t;
    }
    return best;
  },

  /** Menor distância de um ponto até qualquer segmento bloqueador. */
  minDistanceToSegments(p: Vector2, segments: Array<[Vector2, Vector2]>): number {
    let best = Infinity;
    for (const [a, b] of segments) best = Math.min(best, distPointSeg(p, a, b));
    return best;
  },

  /**
   * Primeiro hit de um círculo sólido movendo de a→b contra segmentos.
   * Usa o raio do token para impedir que metade dele atravesse a barreira.
   */
  firstCircleHit(a: Vector2, b: Vector2, radius: number, segments: Array<[Vector2, Vector2]>): { t: number; normal: Vector2 } | null {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const moveLen2 = vx * vx + vy * vy;
    if (moveLen2 < 1e-9 || radius <= 0) return null;

    let best: { t: number; normal: Vector2 } | null = null;
    const keep = (hit: { t: number; normal: Vector2 } | null) => {
      if (!hit || hit.t <= 1e-6 || hit.t > 1 + 1e-6) return;
      const t = Math.max(0, Math.min(1, hit.t));
      if (best === null || t < best.t) best = { t, normal: hit.normal };
    };

    for (const [p, q] of segments) {
      if (distPointSeg(a, p, q) < radius - 1e-6) continue;
      keep(sweptCircleLineHit(a, vx, vy, p, q, radius));
      keep(sweptPointCircleHit(a, vx, vy, p, radius));
      keep(sweptPointCircleHit(a, vx, vy, q, radius));
    }
    return best;
  },

  firstCircleHitT(a: Vector2, b: Vector2, radius: number, segments: Array<[Vector2, Vector2]>): number | null {
    return this.firstCircleHit(a, b, radius, segments)?.t ?? null;
  },
};

function segSegT(a: Vector2, b: Vector2, c: Vector2, d: Vector2): number | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denom;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return t;
}

function sweptCircleLineHit(a: Vector2, vx: number, vy: number, p: Vector2, q: Vector2, radius: number): { t: number; normal: Vector2 } | null {
  const sx = q.x - p.x;
  const sy = q.y - p.y;
  const len = Math.hypot(sx, sy);
  if (len < 1e-9) return null;
  const ux = sx / len;
  const uy = sy / len;
  const nx = -uy;
  const ny = ux;
  const d0 = (a.x - p.x) * nx + (a.y - p.y) * ny;
  const vn = vx * nx + vy * ny;
  if (Math.abs(vn) < 1e-9) return null;

  let best: { t: number; normal: Vector2 } | null = null;
  for (const target of [radius, -radius]) {
    const t = (target - d0) / vn;
    if (t <= 1e-6 || t > 1 + 1e-6) continue;
    const cx = a.x + vx * t;
    const cy = a.y + vy * t;
    const proj = (cx - p.x) * ux + (cy - p.y) * uy;
    if (proj >= -1e-6 && proj <= len + 1e-6 && (best === null || t < best.t)) {
      const normal = target > 0 ? { x: nx, y: ny } : { x: -nx, y: -ny };
      best = { t, normal };
    }
  }
  return best;
}

function sweptPointCircleHit(a: Vector2, vx: number, vy: number, c: Vector2, radius: number): { t: number; normal: Vector2 } | null {
  const ox = a.x - c.x;
  const oy = a.y - c.y;
  const A = vx * vx + vy * vy;
  const B = 2 * (ox * vx + oy * vy);
  const C = ox * ox + oy * oy - radius * radius;
  if (A < 1e-9 || C < 0) return null;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  if (t <= 1e-6 || t > 1 + 1e-6) return null;
  const hx = a.x + vx * t - c.x;
  const hy = a.y + vy * t - c.y;
  const hLen = Math.hypot(hx, hy) || 1;
  return { t, normal: { x: hx / hLen, y: hy / hLen } };
}

function subtractDoorGaps(a: Vector2, b: Vector2, doors: Wall[]): Array<[Vector2, Vector2]> {
  if (!doors.length) return [[a, b]];
  const vx = b.x - a.x, vy = b.y - a.y;
  const len = Math.hypot(vx, vy);
  if (len < 1e-6) return [];
  const ux = vx / len, uy = vy / len;
  const intervals: Array<[number, number]> = [];
  for (const door of doors) {
    const cx = (door.p1.x + door.p2.x) / 2;
    const cy = (door.p1.y + door.p2.y) / 2;
    const t = (cx - a.x) * ux + (cy - a.y) * uy;
    const closest = { x: a.x + ux * t, y: a.y + uy * t };
    const d = Math.hypot(cx - closest.x, cy - closest.y);
    const doorLen = Math.hypot(door.p2.x - door.p1.x, door.p2.y - door.p1.y);
    const gap = Math.max(DOOR_GAP, doorLen) / 2;
    if (d <= gap && t + gap > 0 && t - gap < len) intervals.push([Math.max(0, t - gap), Math.min(len, t + gap)]);
  }
  if (!intervals.length) return [[a, b]];
  intervals.sort((i, j) => i[0] - j[0]);
  const segments: Array<[Vector2, Vector2]> = [];
  let cursor = 0;
  for (const [start, end] of intervals) {
    if (start > cursor + 0.5) segments.push([pointAt(a, ux, uy, cursor), pointAt(a, ux, uy, start)]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < len - 0.5) segments.push([pointAt(a, ux, uy, cursor), b]);
  return segments;
}

function pointAt(a: Vector2, ux: number, uy: number, t: number): Vector2 {
  return { x: a.x + ux * t, y: a.y + uy * t };
}

function distPointSeg(p: Vector2, a: Vector2, b: Vector2): number {
  const vx = b.x - a.x, vy = b.y - a.y;
  const wx = p.x - a.x, wy = p.y - a.y;
  const len2 = vx * vx + vy * vy;
  let t = len2 > 0 ? (wx * vx + wy * vy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * vx, py = a.y + t * vy;
  return Math.hypot(p.x - px, p.y - py);
}
