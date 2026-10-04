/** Distância radial entre centros, em metros, igual ao círculo exibido na mira. */
export function distanciaCircularMetros(
  origem: { x: number; y: number }, alvo: { x: number; y: number },
  grid: { dpi?: number; metersPerCell?: number },
): number {
  return Math.hypot(alvo.x - origem.x, alvo.y - origem.y) / (grid.dpi || 70) * (grid.metersPerCell || 1.5);
}
