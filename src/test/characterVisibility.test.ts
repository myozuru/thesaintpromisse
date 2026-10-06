import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import { charactersVisibleToRole } from '@/lib/characterVisibility';

const character = (id: string, patch: Partial<Character> = {}) =>
  ({ id, name: id, category: 'PLAYER', ...patch }) as Character;

describe('charactersVisibleToRole', () => {
  const roster = [
    character('owned', { profileId: 'p1' }),
    character('unowned'),
    character('other-player', { profileId: 'p2' }),
    character('temporary-owned', { profileId: 'p1', temporary: true }),
    character('temporary-other', { profileId: 'p2', temporary: true }),
    character('enemy', { category: 'INIMIGO' }),
    character('master-created', { createdBy: 'MASTER' }),
    character('hidden', { hiddenFromPlayers: true }),
  ];

  it('falha fechado quando o papel ainda não foi carregado', () => {
    expect(charactersVisibleToRole(roster, null, 'p1')).toEqual([]);
  });

  it('restringe jogador à própria ficha e a fichas públicas de jogadores', () => {
    expect(charactersVisibleToRole(roster, 'PLAYER', 'p1').map((c) => c.id)).toEqual([
      'owned',
      'unowned',
      'temporary-owned',
    ]);
  });

  it('mantém o roster completo para o Mestre', () => {
    expect(charactersVisibleToRole(roster, 'MASTER', 'p1')).toBe(roster);
  });
});
