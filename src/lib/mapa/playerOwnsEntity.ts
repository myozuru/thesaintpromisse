import type { Entity } from '@/stores/useMapStore';
import type { Character } from '@/types';

type EntityOwnership = Pick<Entity, 'ownerCharId' | 'ownerProfileId' | 'avatarProfileId' | 'characterId' | 'assetId' | 'layer' | 'masterControlled'>;
type CharacterOwnership = Pick<Character, 'id' | 'profileId'>;

export function playerOwnsEntity(
  entity: EntityOwnership,
  profileId: string | null,
  characters: readonly CharacterOwnership[],
): boolean {
  if (entity.masterControlled || !profileId) return false;
  if (entity.ownerCharId && characters.some(character => character.id === entity.ownerCharId && character.profileId === profileId)) return true;
  // Posse real do token/imagem enviada pelo player.
  if (entity.ownerProfileId === profileId) return true;
  // Avatar marcado como "Sou eu" também conta como controlável.
  if (entity.avatarProfileId === profileId) return true;
  // Token vinculado manualmente à ficha do perfil ativo também é controlável.
  if (entity.characterId) {
    const linked = characters.find(character => character.id === entity.characterId);
    if (linked?.profileId === profileId) return true;
  }
  // Compatibilidade: imagens antigas podem ter perdido ownerProfileId quando
  // "Sou eu" limpava a marcação dos outros uploads do player.
  return !!entity.assetId && !entity.ownerProfileId && !entity.characterId && (entity.layer ?? 'tokens') === 'tokens';
}
