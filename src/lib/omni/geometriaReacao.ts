export interface PontoMapa { x: number; y: number }
export interface PecaMapa extends PontoMapa { w: number; h: number }
export interface GradeReacao { dpi?: number; metersPerCell?: number }

/** Amostra o segmento para que consumidores possam inspecionar cada trecho do arraste. */
export function amostrarTrajetoria(de: PontoMapa, para: PontoMapa, passo: number): PontoMapa[] {
  const distancia = Math.hypot(para.x - de.x, para.y - de.y);
  const segmentos = Math.max(1, Math.min(2048, Math.ceil(distancia / Math.max(1, passo))));
  return Array.from({ length: Math.max(0, segmentos - 1) }, (_, i) => {
    const t = (i + 1) / segmentos;
    return { x: de.x + (para.x - de.x) * t, y: de.y + (para.y - de.y) * t };
  });
}

/**
 * Verifica se o trajeto entre dois pontos toca o alcance, usando a mesma
 * distância Chebyshev borda a borda usada pelo mapa.
 */
export function segmentoCruzaAlcance(
  a: PontoMapa,
  b: PontoMapa,
  fixo: PecaMapa,
  movel: PecaMapa,
  grid: GradeReacao,
  alcanceM: number,
): boolean {
  const dpi = grid.dpi || 70, mpc = grid.metersPerCell || 1.5;
  const rx = Math.max(0, (fixo.w - dpi) / 2) + Math.max(0, (movel.w - dpi) / 2) + (alcanceM + 0.05) * dpi / mpc;
  const ry = Math.max(0, (fixo.h - dpi) / 2) + Math.max(0, (movel.h - dpi) / 2) + (alcanceM + 0.05) * dpi / mpc;
  const dx = b.x - a.x, dy = b.y - a.y;
  let t0 = 0, t1 = 1;
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) { if (t > t1) return false; t0 = Math.max(t0, t); }
    else { if (t < t0) return false; t1 = Math.min(t1, t); }
    return true;
  };
  return clip(-dx, a.x - (fixo.x - rx)) && clip(dx, fixo.x + rx - a.x)
    && clip(-dy, a.y - (fixo.y - ry)) && clip(dy, fixo.y + ry - a.y);
}
