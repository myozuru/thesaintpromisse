import type { Character } from '@/types';

export type MoneyViewerRole = 'MASTER' | 'PLAYER';

/** Carteiras pertencem à ficha vinculada à conta, nunca à primeira ficha global. */
export function moneyCharactersForViewer(
  characters: Character[],
  role: MoneyViewerRole,
  activeProfileId: string | null | undefined,
): Character[] {
  const playerCharacters = characters.filter(
    (character) => character.category === 'PLAYER' && !character.hiddenFromPlayers,
  );
  if (role === 'MASTER') return playerCharacters;
  if (!activeProfileId) return [];
  return playerCharacters.filter((character) => character.profileId === activeProfileId);
}