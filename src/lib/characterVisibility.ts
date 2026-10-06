import type { Character } from '@/types';
import type { UserRole } from '@/stores/useRoleStore';

/**
 * Lista de fichas exibidas no módulo Fichas.
 * Papel ainda não resolvido falha fechado; não deve ser tratado como Mestre.
 */
export function charactersVisibleToRole(
  characters: Character[],
  role: UserRole,
  profileId: string | null,
): Character[] {
  if (role === 'MASTER') return characters;
  if (role !== 'PLAYER') return [];

  return characters.filter((character) => {
    if (
      character.category !== 'PLAYER' ||
      character.createdBy === 'MASTER' ||
      character.hiddenFromPlayers
    ) {
      return false;
    }
    if (character.temporary) {
      return !!profileId && character.profileId === profileId;
    }
    return !character.profileId || character.profileId === profileId;
  });
}
