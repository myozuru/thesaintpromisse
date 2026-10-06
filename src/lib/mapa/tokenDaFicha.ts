import type { Character } from '@/types';
import type { Entity } from '@/stores/useMapStore';

/** Resolve todas as peças visíveis e válidas ligadas a uma ficha. */
export function resolverTokensDaFicha(
  char: Pick<Character, 'id' | 'profileId'>,
  entities: Record<string, Entity>, layerVisible: Record<string, boolean>,
): Entity[] {
  // Itens soltos e baús nunca representam a ficha, mesmo tendo dono do perfil.
  const candidates = Object.values(entities).filter(e => !e.hidden && !e.carriedBy && !e.groundItem && !e.chestId &&
    (e.layer ?? 'tokens') === 'tokens' && layerVisible[e.layer ?? 'tokens'] !== false);
  const ordenar = (tokens: Entity[]) => tokens.sort((a, b) => a.id.localeCompare(b.id));
  const vinculados = candidates.filter(e => e.characterId === char.id);
  if (vinculados.length) return ordenar(vinculados);
  return ordenar(candidates.filter(e => !e.characterId && !!char.profileId &&
    (e.avatarProfileId === char.profileId || e.ownerProfileId === char.profileId)));
}

/** Token canônico estável para consumidores que exigem uma única origem. */
export function resolverTokenDaFicha(
  char: Pick<Character, 'id' | 'profileId'>,
  entities: Record<string, Entity>, layerVisible: Record<string, boolean>,
): Entity | undefined {
  return resolverTokensDaFicha(char, entities, layerVisible)[0];
}
