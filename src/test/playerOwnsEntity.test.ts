import { describe, expect, it } from 'vitest';
import { playerOwnsEntity } from '@/lib/mapa/playerOwnsEntity';

describe('controle de entidades do mapa pelo jogador', () => {
  const character = { id: 'personagem', profileId: 'perfil-jogador' };

  it('não deixa o jogador controlar o adversário de um ritual, mesmo se a arte for dele', () => {
    expect(playerOwnsEntity({
      ownerCharId: character.id,
      ownerProfileId: character.profileId,
      assetId: 'arte-do-jogador',
      layer: 'tokens',
      masterControlled: true,
    }, character.profileId, [character])).toBe(false);
  });

  it('preserva o controle dos tokens comuns do jogador', () => {
    expect(playerOwnsEntity({ ownerCharId: character.id }, character.profileId, [character])).toBe(true);
    expect(playerOwnsEntity({ assetId: 'arte-legada', layer: 'tokens' }, character.profileId, [character])).toBe(true);
  });
});
