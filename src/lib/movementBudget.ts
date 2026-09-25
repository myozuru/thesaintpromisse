/**
 * Movimento efetivo do personagem considerando sobrecarga de inventário.
 *
 * Regra: se `slotsCurrent` exceder `slotsMax`, o movimento é cortado pela metade.
 */
import type { Character } from '@/types';

export function isOverloaded(c: Pick<Character, 'slotsCurrent' | 'slotsMax'> | undefined | null): boolean {
  if (!c) return false;
  return (c.slotsCurrent ?? 0) > (c.slotsMax ?? 0);
}

export function effectiveMovement(c: Pick<Character, 'movement' | 'slotsCurrent' | 'slotsMax'> | undefined | null): number {
  const base = Math.max(0, c?.movement ?? 0);
  return isOverloaded(c) ? base / 2 : base;
}
