import type { Character } from '@/types';
import type { Entity } from '@/stores/useMapStore';

/** Um único vínculo de token para seleção e execução; não toma tokens de outra ficha. */
export function resolverTokenDaFicha(
  char: Pick<Character, 'id' | 'profileId'>,
  entities: Record<string, Entity>, layerVisible: Record<string, boolean>,
): Entity | undefined {
  const candidates = Object.values(entities).filter(e => !e.hidden && !e.carriedBy &&
    (e.layer ?? 'tokens') === 'tokens' && layerVisible[e.layer ?? 'tokens'] !== false);
  const primeiro = (tokens: Entity[]) => tokens.sort((a, b) => a.id.localeCompare(b.id))[0];
  return primeiro(candidates.filter(e => e.characterId === char.id))
    ?? primeiro(candidates.filter(e => !e.characterId && !!char.profileId &&
      (e.avatarProfileId === char.profileId || e.ownerProfileId === char.profileId)));
}
