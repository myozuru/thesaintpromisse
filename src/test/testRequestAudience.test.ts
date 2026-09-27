import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import type { TestRequest } from '@/stores/useTestRequestStore';
import { canViewerRollTestRequest, isPlayerOwnedTestRequest } from '@/lib/testRequestAudience';

const character = (patch: Partial<Character> = {}): Character => ({
  id: 'char-1',
  name: 'Ayla',
  category: 'PLAYER',
  createdBy: 'MASTER',
  profileId: 'player-a',
  ...patch,
} as Character);

const request = (patch: Partial<TestRequest> = {}): TestRequest => ({
  id: 'req-1',
  charId: 'char-1',
  charName: 'Ayla',
  kind: 'skill',
  testName: 'Iniciativa',
  sourceTag: 'init-batch::batch::entry',
  targetProfileId: 'player-a',
  createdAt: 1,
  ...patch,
});

describe('destino de pedidos de rolagem', () => {
  it('envia iniciativa ligada ao perfil somente para o jogador dono', () => {
    const req = request();
    const char = character();
    expect(canViewerRollTestRequest(req, char, 'PLAYER', 'player-a')).toBe(true);
    expect(canViewerRollTestRequest(req, char, 'PLAYER', 'player-b')).toBe(false);
    expect(canViewerRollTestRequest(req, char, 'MASTER', null)).toBe(false);
    expect(isPlayerOwnedTestRequest(req, char)).toBe(true);
  });

  it('mantém ficha sem perfil e NPC sob controle do Mestre', () => {
    const unassigned = character({ profileId: undefined });
    const npc = character({ category: 'NPC', profileId: undefined });
    const req = request({ targetProfileId: undefined });
    expect(canViewerRollTestRequest(req, unassigned, 'MASTER', null)).toBe(true);
    expect(canViewerRollTestRequest(req, unassigned, 'PLAYER', 'player-a')).toBe(false);
    expect(canViewerRollTestRequest(req, npc, 'MASTER', null)).toBe(true);
  });

  it('mantém o destinatário original mesmo se o vínculo da ficha mudar depois', () => {
    const movedCharacter = character({ profileId: 'player-b' });
    const req = request({ targetProfileId: 'player-a' });
    expect(canViewerRollTestRequest(req, movedCharacter, 'PLAYER', 'player-a')).toBe(true);
    expect(canViewerRollTestRequest(req, movedCharacter, 'PLAYER', 'player-b')).toBe(false);
  });
});