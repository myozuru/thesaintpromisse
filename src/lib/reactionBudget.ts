import type { Character } from '@/types';

/** Saldo atual de reações, com compatibilidade para fichas antigas sem saldo salvo. */
export function getReactionsAvailable(character: Pick<Character, 'reactionsCurrent' | 'reactionsMax'> & { feridaInternaBloqueada?: boolean }): number {
  if (character.feridaInternaBloqueada) return 0;
  return Math.max(0, character.reactionsCurrent ?? character.reactionsMax ?? 1);
}
