import { afterEach, describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import type { ActiveCondition } from '@/types/conditions';
import { useCharacterStore } from '@/stores/useCharacterStore';

function setTarget(activeConditions: ActiveCondition[] = []) {
  const target = { id: 'target', name: 'Alvo', category: 'INIMIGO', activeConditions } as unknown as Character;
  useCharacterStore.setState({ characters: [target] } as never);
}

function condition(id: string, conditionId: string, name: string, sourceCharId: string): ActiveCondition {
  return { id, conditionId, name, icon: '', remainingTurns: 2, remainingRounds: 2, sourceCharId };
}

afterEach(() => useCharacterStore.setState({ characters: [] } as never));

describe('condições não acumulam instâncias iguais', () => {
  it('reaplicar de outra fonte preserva uma única instância e a duração atual', () => {
    setTarget();
    const store = useCharacterStore.getState();
    store.addCondition('target', condition('primeira', 'caido', 'Caído', 'a'));
    store.addCondition('target', condition('segunda', 'caido', 'Caído', 'b'));

    const active = useCharacterStore.getState().characters[0].activeConditions;
    expect(active).toHaveLength(1);
    expect(active?.[0]).toMatchObject({ id: 'primeira', sourceCharId: 'a', remainingTurns: 2 });
  });

  it('Amedrontado substitui Abalado, e Abalado não substitui a condição mais forte', () => {
    setTarget();
    const store = useCharacterStore.getState();
    store.addCondition('target', condition('abalado', 'abalado', 'Abalado', 'a'));
    store.addCondition('target', condition('amedrontado', 'amedrontado', 'Amedrontado', 'b'));
    expect(useCharacterStore.getState().characters[0].activeConditions?.map((c) => c.conditionId)).toEqual(['amedrontado']);

    store.addCondition('target', condition('abalado-fraco', 'abalado', 'Abalado', 'c'));
    expect(useCharacterStore.getState().characters[0].activeConditions?.map((c) => c.conditionId)).toEqual(['amedrontado']);
  });

  it('limpa duplicatas antigas ao atualizar ou reidratar a ficha', () => {
    setTarget([
      condition('a1', 'caido', 'Caído', 'a'),
      condition('a2', 'caido', 'Caído', 'b'),
      condition('a3', 'caido', 'Caído', 'c'),
    ]);
    useCharacterStore.getState().updateCharacter('target', { hpCurrent: 10 });
    expect(useCharacterStore.getState().characters[0].activeConditions?.map((c) => c.id)).toEqual(['a1']);
  });
});
