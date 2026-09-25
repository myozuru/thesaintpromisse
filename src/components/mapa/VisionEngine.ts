/**
 * VisionEngine — raycasting 2D para polígono de visibilidade.
 *
 * Dado um ponto-origem, um raio máximo e uma lista de segmentos
 * bloqueadores, calcula o polígono ordenado por ângulo que representa
 * a área visível (limitada por paredes ou pelo raio).
 *
 * Estratégia clássica: para cada endpoint dos segmentos, dispara raios
 * em ângulo ± epsilon; encontra a interseção mais próxima; ordena os
 * hits por ângulo polar.
 */
import type { Vector2 } from '@/stores/useMapStore';

const EPS = 0.00015;
const TAU = Math.PI * 2;

function normAngle(a: number): number {
  const n = a % TAU;
  return n < 0 ? n + TAU : n;
}

export interface Ray {
  ox: number; oy: number;
  dx: number; dy: number;
}

/** Interseção raio↔segmento; retorna distância (t) ou Infinity. */
function rayHitSeg(r: Ray, a: Vector2, b: Vector2): number {
  const sx = b.x - a.x;
  const sy = b.y - a.y;
  const denom = r.dx * sy - r.dy * sx;
  if (Math.abs(denom) < 1e-9) return Infinity; // paralelos
  const t = ((a.x - r.ox) * sy - (a.y - r.oy) * sx) / denom;
  const u = ((a.x - r.ox) * r.dy - (a.y - r.oy) * r.dx) / denom;
  if (t > 0 && u >= 0 && u <= 1) return t;
  return Infinity;
}

/**
 * Calcula o polígono de visibilidade.
 * @param origin     ponto-fonte (em mundo)
 * @param maxRadius  raio máximo (em mundo) — limita o alcance da visão
 * @param segments   segmentos bloqueadores
 * @returns vértices do polígono em ordem horária; mínimo 8 pontos (fallback círculo)
 */
export function computeVisibilityPolygon(
  origin: Vector2,
  maxRadius: number,
  segments: Array<[Vector2, Vector2]>,
): Vector2[] {
  // Adiciona segmentos virtuais do "círculo de raio" via 16 raios uniformes,
  // garantindo que mesmo sem paredes o polígono seja circular limitado.
  const baseAngles: number[] = [];
  const N = 96;
  for (let i = 0; i < N; i++) baseAngles.push((i / N) * TAU);

  // Coleta endpoints dos segmentos e gera 3 raios por endpoint (± epsilon).
  const angles: number[] = [...baseAngles];
  for (const [a, b] of segments) {
    for (const p of [a, b]) {
      const dx = p.x - origin.x;
      const dy = p.y - origin.y;
      if (dx === 0 && dy === 0) continue;
      const ang = normAngle(Math.atan2(dy, dx));
      angles.push(ang, normAngle(ang + EPS), normAngle(ang - EPS));
    }
  }
  angles.sort((x, y) => x - y);

  const pts: Vector2[] = [];
  for (const ang of angles) {
    const r: Ray = { ox: origin.x, oy: origin.y, dx: Math.cos(ang), dy: Math.sin(ang) };
    let best = maxRadius;
    for (const [a, b] of segments) {
      const t = rayHitSeg(r, a, b);
      if (t < best) best = t;
    }
    pts.push({ x: origin.x + r.dx * best, y: origin.y + r.dy * best });
  }
  return pts;
}

/** Helper: aplica um polígono como path no contexto. */
export function pathPolygon(ctx: CanvasRenderingContext2D, poly: Vector2[]) {
  if (poly.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
}
