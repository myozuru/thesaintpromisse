import type { Character } from '@/types/character';

/** Ficha de jogador visível (não criada pelo Mestre, não oculta). */
export const isPlayerVisibleCharacter = (c: Character) =>
  c.category === 'PLAYER' && c.createdBy !== 'MASTER' && !c.hiddenFromPlayers;

/**
 * Ficha "minha" do jogador logado: SOMENTE fichas ligadas ao perfil dele.
 * Nunca cai para a ficha de outro jogador (antes pegava a primeira da lista).
 * Prefere fichas permanentes às temporárias.
 */
export function findMyCharacter(characters: Character[], profileId: string | null | undefined): Character | null {
  if (!profileId) return null;
  const mine = characters.filter((c) => isPlayerVisibleCharacter(c) && c.profileId === profileId);
  return mine.find((c) => !c.temporary) ?? mine[0] ?? null;
}
