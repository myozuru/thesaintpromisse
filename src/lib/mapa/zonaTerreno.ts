import type { Entity, ZonaTerreno } from '@/stores/useMapStore';
type Point = { x: number; y: number };
type ZoneShape = Pick<Entity, 'shape' | 'x' | 'y' | 'w' | 'h' | 'rotation'>;
function local(z: ZoneShape, p: Point): Point {
  const dx = p.x - z.x, dy = p.y - z.y, c = Math.cos(z.rotation || 0), s = Math.sin(z.rotation || 0);
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}
const valida = (z: ZoneShape) => [z.x, z.y, z.w, z.h, z.rotation ?? 0].every(Number.isFinite) && z.w > 0 && z.h > 0;
export function pontoDentroDaZona(z: ZoneShape, p: Point): boolean {
  if (!valida(z) || ![p.x, p.y].every(Number.isFinite)) return false;
  const q = local(z, p), rx = z.w / 2, ry = z.h / 2;
  return z.shape === 'ELLIPSE' ? (q.x / rx) ** 2 + (q.y / ry) ** 2 <= 1 + 1e-10 : Math.abs(q.x) <= rx + 1e-10 && Math.abs(q.y) <= ry + 1e-10;
}
/** Interseção analítica: não perde zonas finas nem depende do comprimento do trajeto. */
export function segmentoEntraNaZona(z: ZoneShape, de: Point, para: Point): boolean {
  if (!valida(z) || ![de.x, de.y, para.x, para.y].every(Number.isFinite) || pontoDentroDaZona(z, de)) return false;
  const a = local(z, de), b = local(z, para), rx = z.w / 2, ry = z.h / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  if (z.shape === 'ELLIPSE') {
    const aa = (dx / rx) ** 2 + (dy / ry) ** 2;
    if (!aa) return false;
    const t = Math.max(0, Math.min(1, -((a.x * dx) / (rx * rx) + (a.y * dy) / (ry * ry)) / aa));
    return ((a.x + dx * t) / rx) ** 2 + ((a.y + dy * t) / ry) ** 2 <= 1 + 1e-10;
  }
  let lo = 0, hi = 1;
  for (const [p, d, raio] of [[a.x, dx, rx], [a.y, dy, ry]]) {
    if (Math.abs(d) < 1e-12) { if (Math.abs(p) > raio) return false; continue; }
    const t1 = (-raio - p) / d, t2 = (raio - p) / d;
    lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
    if (lo > hi + 1e-10) return false;
  }
  return true;
}
export function zonaEstaAtiva(z: ZonaTerreno): boolean {
  return z.duracaoRodadas === null || Number.isFinite(z.duracaoRodadas) && z.duracaoRodadas > 0 && Number.isFinite(z.rodadasRestantes ?? z.duracaoRodadas) && (z.rodadasRestantes ?? z.duracaoRodadas) > 0;
}
export function avancarDuracaoZona(z: ZonaTerreno): ZonaTerreno | null {
  if (!zonaEstaAtiva(z)) return null;
  if (z.duracaoRodadas === null) return z;
  const restantes = Math.max(0, Math.floor(z.rodadasRestantes ?? z.duracaoRodadas) - 1);
  return restantes === 0 ? null : { ...z, rodadasRestantes: restantes };
}
