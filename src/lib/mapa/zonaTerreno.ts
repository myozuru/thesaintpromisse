import type { Entity, ZonaTerreno } from '@/stores/useMapStore';

type Point = { x: number; y: number };
type ZoneShape = Pick<Entity, 'shape' | 'x' | 'y' | 'w' | 'h' | 'rotation'>;

export function pontoDentroDaZona(zona: ZoneShape, ponto: Point): boolean {
  const dx = ponto.x - zona.x;
  const dy = ponto.y - zona.y;
  const cos = Math.cos(zona.rotation || 0);
  const sin = Math.sin(zona.rotation || 0);
  const x = dx * cos + dy * sin;
  const y = -dx * sin + dy * cos;
  const rx = Math.max(0.001, zona.w / 2);
  const ry = Math.max(0.001, zona.h / 2);
  if (zona.shape === 'ELLIPSE') return (x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1;
  return Math.abs(x) <= rx && Math.abs(y) <= ry;
}

/** Detecta entrada pelo caminho entre dois snapshots do token, mesmo que ele cruze a zona. */
export function segmentoEntraNaZona(zona: ZoneShape, de: Point, para: Point): boolean {
  if (pontoDentroDaZona(zona, de)) return false;
  const distancia = Math.hypot(para.x - de.x, para.y - de.y);
  const passo = Math.max(0.25, Math.min(zona.w, zona.h) / 4);
  const amostras = Math.max(1, Math.ceil(distancia / passo));
  for (let i = 1; i <= amostras; i += 1) {
    const t = i / amostras;
    if (pontoDentroDaZona(zona, { x: de.x + (para.x - de.x) * t, y: de.y + (para.y - de.y) * t })) return true;
  }
  return false;
}

export function avancarDuracaoZona(zona: ZonaTerreno): ZonaTerreno | null {
  if (zona.duracaoRodadas === null) return zona;
  const restantes = Math.max(0, (zona.rodadasRestantes ?? zona.duracaoRodadas) - 1);
  return restantes === 0 ? null : { ...zona, rodadasRestantes: restantes };
}
