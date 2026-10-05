import { afterEach, describe, expect, it } from 'vitest';
import { rollD20Com } from '@/lib/dice';
import { useCombatStore } from '@/stores/useCombatStore';
import { useDice3DStore } from '@/stores/useDice3DStore';
import { useTestRequestStore, type TestRequest } from '@/stores/useTestRequestStore';

describe('pausa do cronômetro durante rolagens e testes pedidos', () => {
  afterEach(() => {
    useTestRequestStore.getState().clearAll();
    useDice3DStore.getState().clear();
    useCombatStore.setState({ reactionPauseIds: [], turnPaused: true, turnTimerEnabled: false, inCombat: false });
  });

  it('pausa enquanto o dado de ataque aguarda a bandeja e libera depois do resultado', async () => {
    useCombatStore.setState({ inCombat: true, turnTimerEnabled: true, turnDurationSec: 60, turnRemainingAtStart: 40, turnStartedAt: Date.now(), turnPaused: false, reactionPauseIds: [] });
    useDice3DStore.setState({ enabled: true, current: null, queue: [] });

    const attackRoll = rollD20Com('atacante');
    expect(useCombatStore.getState().reactionPauseIds.some((id) => id.startsWith('dice-roll:'))).toBe(true);
    useDice3DStore.getState().resolveCurrent([17]);

    await expect(attackRoll).resolves.toBe(17);
    expect(useCombatStore.getState().reactionPauseIds).toEqual([]);
  });

  it('mantém a pausa enquanto uma ficha aguarda o resultado de um TR remoto', () => {
    useCombatStore.setState({ inCombat: true, turnTimerEnabled: true, turnDurationSec: 60, turnRemainingAtStart: 35, turnStartedAt: Date.now(), turnPaused: false, reactionPauseIds: [] });
    const pedido: Omit<TestRequest, 'id' | 'createdAt' | 'result'> = {
      charId: 'player-char', charName: 'Jogadora', kind: 'save', testName: 'Vontade',
    };
    useTestRequestStore.getState().enqueue(pedido);
    const request = useTestRequestStore.getState().requests[0];
    expect(useCombatStore.getState().reactionPauseIds).toContain(`test-request:${request.id}`);

    useTestRequestStore.getState().setResult(request.id, {
      d20: 12, bonus: 4, total: 16, rolledAt: Date.now(),
    });
    expect(useCombatStore.getState().reactionPauseIds).not.toContain(`test-request:${request.id}`);
  });

  it('reconcilia a chegada e o resultado do pedido recebido pelo multiplayer', () => {
    useCombatStore.setState({ inCombat: true, turnTimerEnabled: true, turnDurationSec: 60, turnRemainingAtStart: 30, turnStartedAt: Date.now(), turnPaused: false, reactionPauseIds: [] });
    const request: TestRequest = {
      id: 'remote-tr-1', charId: 'player-char', charName: 'Jogadora', kind: 'save', testName: 'Fortitude', createdAt: Date.now(),
    };
    useTestRequestStore.setState({ requests: [request] });
    expect(useCombatStore.getState().reactionPauseIds).toContain('test-request:remote-tr-1');
    useTestRequestStore.setState({ requests: [{ ...request, result: { d20: 10, bonus: 2, total: 12, rolledAt: Date.now() } }] });
    expect(useCombatStore.getState().reactionPauseIds).not.toContain('test-request:remote-tr-1');
  });
});
