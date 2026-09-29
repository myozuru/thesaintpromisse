/**
 * Alcance de ataques com arma no mapa.
 *
 * Regras:
 *   • Corpo-a-corpo (melee): 1,5 m (toque). Armas com a propriedade
 *     "Estendida" alcançam 3 m. Bônus de alcance CaC da ficha
 *     (`meleeRangeBonus`, ex.: Articulações Extensas) soma ao alcance.
 *   • Distância/Arremesso: alcance máximo = `rangeLong` da arma;
 *     `rangeShort` é o alcance curto (acima dele, o ataque é possível
 *     mas fica marcado como "alcance longo").
 *   • A distância é medida na grade do mapa, borda a borda da peça
 *     (mesma regra das habilidades e feitiços — ver touchRange.ts).
 */
import { hasProperty, type Weapon } from './weapons';
import {
  TOUCH_RANGE_M,
  touchDistanceMeters,
  findCharEntity,
  type TouchEntity,
  type TouchGrid,
} from './touchRange';

/** Alcance de armas com a propriedade Estendida (3 m). */
export const EXTENDED_REACH_M = 3;

/** Alcance máximo em metros da arma. null = sem limite definido. */
export function weaponMaxRangeMeters(w: Weapon, meleeRangeBonus = 0): number | null {
  if (w.range === 'melee') {
    const base = hasProperty(w, 'estendida') ? EXTENDED_REACH_M : TOUCH_RANGE_M;
    return base + Math.max(0, meleeRangeBonus);
  }
  return w.rangeLong ?? null;
}

/** Alcance curto (sem penalidade) de armas à distância/arremesso. null para CaC. */
export function weaponShortRangeMeters(w: Weapon): number | null {
  if (w.range === 'melee') return null;
  return w.rangeShort ?? null;
}

/**
 * Distância em metros entre as peças de dois personagens no mapa
 * (borda a borda). null se algum dos dois não tem peça no mapa.
 */
export function distanceBetweenChars<E extends TouchEntity & { characterId?: string }>(
  aId: string,
  bId: string,
  entities: Record<string, E>,
  grid: TouchGrid,
): number | null {
  if (aId === bId) return 0;
  const a = findCharEntity(entities, aId);
  const b = findCharEntity(entities, bId);
  if (!a || !b) return null;
  return touchDistanceMeters(a, b, grid);
}

/**
 * Valida o alcance de um ataque com arma.
 * Retorna null quando o ataque é permitido; string com o motivo quando bloqueado.
 * Se atacante ou alvo não têm peça no mapa, não bloqueia (não há como medir).
 */
export function checkWeaponRange<E extends TouchEntity & { characterId?: string }>(
  attackerId: string,
  targetId: string,
  weapon: Weapon,
  entities: Record<string, E>,
  grid: TouchGrid,
  meleeRangeBonus = 0,
): string | null {
  if (attackerId === targetId) return null;
  const max = weaponMaxRangeMeters(weapon, meleeRangeBonus);
  if (max === null) return null;
  const d = distanceBetweenChars(attackerId, targetId, entities, grid);
  if (d === null) return null;
  if (d > max + 0.05) {
    return `Alvo fora de alcance (${d.toFixed(1)} m; máx. ${max} m com ${weapon.name}).`;
  }
  return null;
}
