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

/** Origem de invocação: aceita o avatar do perfil, mas nunca outra invocação. */
export function resolverTokenControladorDaFicha(
  char: Pick<Character, 'id' | 'profileId'> | null | undefined,
  entities: Record<string, Entity>, layerVisible: Record<string, boolean>,
): Entity | undefined {
  if (!char) return undefined;
  const semInvocacoes = Object.fromEntries(
    Object.entries(entities).filter(([, entity]) => !entity.invocationId),
  );
  // O avatar marcado como "Eu" representa a posição atual do controlador.
  // A posse de imagens antigas do perfil não deve deslocar a origem da invocação.
  const avatarAtivo = char.profileId ? Object.values(semInvocacoes)
    .filter(entity => entity.avatarProfileId === char.profileId &&
      (!entity.characterId || entity.characterId === char.id) &&
      !entity.hidden && !entity.carriedBy && !entity.groundItem && !entity.chestId &&
      (entity.layer ?? 'tokens') === 'tokens' && layerVisible[entity.layer ?? 'tokens'] !== false)
    .sort((a, b) => a.id.localeCompare(b.id))[0] : undefined;
  if (avatarAtivo) return avatarAtivo;
  return resolverTokenDaFicha(char, semInvocacoes, layerVisible);
}
