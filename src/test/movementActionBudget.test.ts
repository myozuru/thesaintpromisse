import { afterEach, describe, expect, it } from 'vitest';
import { useCombatStore } from '@/stores/useCombatStore';

afterEach(() => useCombatStore.setState({
  inCombat: false,
  round: 1,
  currentTurnIndex: 0,
  initiativeOrder: [],
  movementActionUsedByChar: {},
} as never));

describe('ação de movimento', () => {
  it('permite gastar uma vez no próprio turno e rejeita repetição ou turno alheio', () => {
    useCombatStore.setState({
      inCombat: true,
      currentTurnIndex: 0,
      initiativeOrder: [{ charId: 'ana' }, { charId: 'beto' }] as never,
      movementActionUsedByChar: {},
    });

    const combat = useCombatStore.getState();
    expect(combat.spendMovementAction('beto')).toBe(false);
    expect(combat.spendMovementAction('ana')).toBe(true);
    expect(useCombatStore.getState().movementActionUsedByChar.ana).toBe(true);
    expect(useCombatStore.getState().spendMovementAction('ana')).toBe(false);
  });

  it('não cobra ação fora de combate', () => {
    useCombatStore.setState({ inCombat: false, movementActionUsedByChar: {} });
    expect(useCombatStore.getState().spendMovementAction('ana')).toBe(true);
    expect(useCombatStore.getState().movementActionUsedByChar).toEqual({});
  });
});
