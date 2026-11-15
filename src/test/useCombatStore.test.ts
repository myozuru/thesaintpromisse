import { beforeEach, describe, expect, it } from 'vitest';
import { useCombatStore } from '@/stores/useCombatStore';

describe('useCombatStore', () => {
  beforeEach(() => {
    useCombatStore.setState({
      inCombat: true,
      combatId: 'combate-relogio',
      currentTurnIndex: 0,
      initiativeOrder: [
        { charId: 'ator-atual', charName: 'Ator atual', roll: 20, bonus: 0, total: 20 },
        { charId: 'dono-relogio-removido', charName: 'Dono removido', roll: 10, bonus: 0, total: 10 },
      ],
      turnClockOwnerCharId: 'dono-relogio-removido',
      turnDurationSec: 60,
      turnBaseRemainingAtStart: 15,
      turnRemainingAtStart: 18,
      turnStartedAt: Date.now() - 3000,
      turnTimerEnabled: true,
      turnPaused: false,
    } as never);
  });

  it('reatribui o relógio ao ator atual se seu dono sair da iniciativa', () => {
    useCombatStore.getState().removeCombatParticipant('dono-relogio-removido');

    expect(useCombatStore.getState()).toMatchObject({
      initiativeOrder: [{ charId: 'ator-atual' }],
      currentTurnIndex: 0,
      turnClockOwnerCharId: 'ator-atual',
      turnBaseRemainingAtStart: 60,
      turnRemainingAtStart: 60,
      turnPaused: false,
    });
  });
});
