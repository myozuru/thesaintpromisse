/**
 * Alcance de toque (1,5 m) entre duas peças do mapa.
 * (x,y) é o CENTRO da entidade. Distância em grade (diagonal conta como 1 casa),
 * descontando o tamanho de peças maiores que 1 casa — ou seja, mede a borda a borda
 * como se fossem peças de 1 casa.
 */
export const TOUCH_RANGE_M = 1.5;

export interface TouchEntity {
  x: number;
  y: number;
  w: number;
  h: number;
  characterId?: string;
  ownerProfileId?: string;
  avatarProfileId?: string;
}
export interface TouchGrid { dpi?: number; metersPerCell?: number }

export interface CharacterMapIdentity {
  characterId: string;
  profileId?: string;
}

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
  identities?: { casterProfileId?: string; targetProfileId?: string },
): string | null {
  if (casterId === targetId) return null;
  const d = charsDistanceMeters(casterId, targetId, entities, grid, identities);
  if (d === null) return 'Você e o alvo precisam estar no mapa para medir o alcance de toque.';
  if (d > TOUCH_RANGE_M + 0.05) return outOfRangeMessage(d, TOUCH_RANGE_M, 'toque');
  return null;
}

/**
 * Alcance em metros de um texto de feitiço/habilidade ("9 m", "Toque", "Pessoal").
 * Toque/corpo-a-corpo = 1,5 m; Pessoal/Próprio = 0; sem número = null (sem limite definido).
 */
export function parseRangeMeters(range: unknown): number | null {
  const s = String(range ?? '').trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/(\d+(?:[.,]\d+)?)/);
  if (m) return parseFloat(m[1].replace(',', '.'));
  if (/toque|corpo|adjacente|melee/.test(s)) return TOUCH_RANGE_M;
  if (/pessoal|pr[óo]prio|si mesmo/.test(s)) return 0;
  return null;
}

/** true se o alvo está dentro de `rangeM` metros (borda a borda, mesma regra do toque). */
export function isWithinRangeMeters(a: TouchEntity, b: TouchEntity, grid: TouchGrid, rangeM: number): boolean {
  return touchDistanceMeters(a, b, grid) <= rangeM + 0.05;
}

/** Formata metros com vírgula ("1,5"). */
export const fmtM = (m: number) => (Math.round(m * 10) / 10).toFixed(1).replace('.', ',');

/** Mensagem explicando quanto falta para alcançar. */
export function outOfRangeMessage(distM: number, maxM: number, label?: string): string {
  const falta = Math.max(0.1, distM - maxM);
  return `Fora de alcance${label ? ` (${label})` : ''}: está a ${fmtM(distM)} m, máx. ${fmtM(maxM)} m — aproxime-se mais ${fmtM(falta)} m.`;
}

/**
 * Menor distância entre as peças de dois personagens. Considera TODAS as peças
 * vinculadas a cada ficha (tokens duplicados), ignorando peças carregadas.
 */
export function charsDistanceMeters<E extends TouchEntity & { characterId?: string; carriedBy?: string }>(
  aId: string,
  bId: string,
  entities: Record<string, E>,
  grid: TouchGrid,
  identities?: { casterProfileId?: string; targetProfileId?: string },
): number | null {
  if (aId === bId) return 0;
  const all = Object.values(entities);
  const belongsTo = (entity: E, characterId: string, profileId?: string) =>
    entity.characterId === characterId ||
    (!!profileId && (entity.avatarProfileId === profileId || entity.ownerProfileId === profileId));
  const as = all.filter(e => belongsTo(e, aId, identities?.casterProfileId));
  const bs = all.filter(e => belongsTo(e, bId, identities?.targetProfileId));
  if (!as.length || !bs.length) return null;
  let best = Infinity;
  for (const a of as) for (const b of bs) best = Math.min(best, touchDistanceMeters(a, b, grid));
  return best;
}
