/**
 * Alcance de toque (1,5 m) entre duas peças do mapa.
 * (x,y) é o CENTRO da entidade. Distância em grade (diagonal conta como 1 casa),
 * descontando o tamanho de peças maiores que 1 casa — ou seja, mede a borda a borda
 * como se fossem peças de 1 casa.
 */
export const TOUCH_RANGE_M = 1.5;

export interface TouchEntity { x: number; y: number; w: number; h: number }
export interface TouchGrid { dpi?: number; metersPerCell?: number }

export function touchDistanceMeters(a: TouchEntity, b: TouchEntity, grid: TouchGrid): number {
  const dpi = grid.dpi || 70;
  const mpc = grid.metersPerCell || 1.5;
  const extraX = Math.max(0, (a.w - dpi) / 2) + Math.max(0, (b.w - dpi) / 2);
  const extraY = Math.max(0, (a.h - dpi) / 2) + Math.max(0, (b.h - dpi) / 2);
  const dx = Math.max(0, Math.abs(a.x - b.x) - extraX);
  const dy = Math.max(0, Math.abs(a.y - b.y) - extraY);
  return (Math.max(dx, dy) / dpi) * mpc;
}

export function isWithinTouch(a: TouchEntity, b: TouchEntity, grid: TouchGrid): boolean {
  return touchDistanceMeters(a, b, grid) <= TOUCH_RANGE_M + 0.05;
}

/** Acha a peça do mapa vinculada a uma ficha. */
export function findCharEntity<E extends TouchEntity & { characterId?: string; hidden?: boolean }>(
  entities: Record<string, E>,
  charId: string,
): E | null {
  return Object.values(entities).find(e => e.characterId === charId) ?? null;
}

/** null = pode tocar; string = motivo do bloqueio. */
export function checkTouchTarget<E extends TouchEntity & { characterId?: string }>(
  casterId: string,
  targetId: string,
  entities: Record<string, E>,
  grid: TouchGrid,
): string | null {
  if (casterId === targetId) return null;
  const a = findCharEntity(entities, casterId);
  const b = findCharEntity(entities, targetId);
  if (!a || !b) return 'Você e o alvo precisam estar no mapa para medir o alcance de toque.';
  const d = touchDistanceMeters(a, b, grid);
  if (!isWithinTouch(a, b, grid)) return `Alvo fora do alcance de toque (${d.toFixed(1)} m; máx. 1,5 m).`;
  return null;
}
