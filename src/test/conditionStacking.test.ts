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

  it('normaliza Caído antigo para não pedir TR de remoção', () => {
    setTarget([{
      ...condition('caido-antigo', 'caido', 'Caído', 'a'),
      durationMode: 'ate_passar_tr', endCD: 18, endTrType: 'fortitude',
    }]);
    useCharacterStore.getState().updateCharacter('target', { hpCurrent: 10 });
    expect(useCharacterStore.getState().characters[0].activeConditions?.[0]).toMatchObject({
      conditionId: 'caido', durationMode: 'ate_acabar',
    });
    expect(useCharacterStore.getState().characters[0].activeConditions?.[0].endCD).toBeUndefined();
    expect(useCharacterStore.getState().characters[0].activeConditions?.[0].endTrType).toBeUndefined();
  });

  it('renova Condenado pelo maior prazo e mantém a instância e a idade contínua', () => {
    setTarget([{ ...condition('condenado-original', 'condenado', 'Condenado', 'a'), remainingTurns: -1, remainingRounds: 1, elapsedRounds: 3 }]);
    const store = useCharacterStore.getState();
    store.addCondition('target', {
      ...condition('condenado-renovacao', 'condenado', 'Condenado', 'b'),
      remainingTurns: -1,
      remainingRounds: 2,
      sourceEntityId: 'tecnica-b',
      sourceInstanceId: 'arma-b-1',
    });

    let active = useCharacterStore.getState().characters[0].activeConditions!;
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      id: 'condenado-original', remainingRounds: 2, elapsedRounds: 3,
      sourceCharId: 'b', sourceEntityId: 'tecnica-b', sourceInstanceId: 'arma-b-1',
    });
    expect(active[0].sourceApplications).toHaveLength(2);

    useCharacterStore.getState().tickRoundConditions();
    active = useCharacterStore.getState().characters[0].activeConditions!;
    expect(active[0]).toMatchObject({ id: 'condenado-original', remainingRounds: 1, elapsedRounds: 4 });

    useCharacterStore.getState().addCondition('target', {
      ...condition('condenado-menor', 'condenado', 'Condenado', 'c'),
      remainingTurns: -1, remainingRounds: 0,
    });
    expect(useCharacterStore.getState().characters[0].activeConditions?.[0]).toMatchObject({
      id: 'condenado-original', remainingRounds: 1, elapsedRounds: 4,
    });
  });

  it('duração indefinida prevalece sobre renovação finita e idade legada continua desconhecida', () => {
    setTarget([{ ...condition('condenado-legado', 'condenado', 'Condenado', 'a'), remainingTurns: -1, remainingRounds: -1 }]);
    useCharacterStore.getState().addCondition('target', {
      ...condition('condenado-finito', 'condenado', 'Condenado', 'b'),
      remainingTurns: -1, remainingRounds: 4,
    });
    expect(useCharacterStore.getState().characters[0].activeConditions?.[0]).toMatchObject({
      id: 'condenado-legado', remainingRounds: -1,
    });
    expect(useCharacterStore.getState().characters[0].activeConditions?.[0].elapsedRounds).toBeUndefined();
  });

  it('remover uma fonte preserva Condenado enquanto outra aplicação ainda estiver ativa', () => {
    setTarget();
    const store = useCharacterStore.getState();
    store.addCondition('target', {
      ...condition('fonte-a', 'condenado', 'Condenado', 'a'), remainingTurns: -1, remainingRounds: 2,
      sourceEntityId: 'marca-a', sourceInstanceId: 'copia-a',
    });
    store.addCondition('target', {
      ...condition('fonte-b', 'condenado', 'Condenado', 'b'), remainingTurns: -1, remainingRounds: 4,
      sourceEntityId: 'marca-b', sourceInstanceId: 'copia-b',
    });
    expect(useCharacterStore.getState().removeConditionsFromSource('target', 'marca-b', 'copia-b')).toBe(1);
    expect(useCharacterStore.getState().characters[0].activeConditions?.[0]).toMatchObject({
      id: 'fonte-a', remainingRounds: 2, sourceEntityId: 'marca-a', sourceInstanceId: 'copia-a',
    });
    useCharacterStore.getState().tickRoundConditions();
    expect(useCharacterStore.getState().characters[0].activeConditions).toHaveLength(1);
    useCharacterStore.getState().tickRoundConditions();
    expect(useCharacterStore.getState().characters[0].activeConditions).toHaveLength(0);
  });

  it('consolida duplicatas antigas de Condenado sem inventar idade conhecida', () => {
    setTarget([
      { ...condition('antigo-a', 'condenado', 'Condenado', 'a'), remainingTurns: -1, remainingRounds: 1, sourceEntityId: 'fonte-a' },
      { ...condition('antigo-b', 'condenado', 'Condenado', 'b'), remainingTurns: -1, remainingRounds: 3, sourceEntityId: 'fonte-b' },
    ]);
    useCharacterStore.getState().updateCharacter('target', { hpCurrent: 9 });
    const active = useCharacterStore.getState().characters[0].activeConditions!;
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ id: 'antigo-a', remainingRounds: 3 });
    expect(active[0].elapsedRounds).toBeUndefined();
    expect(active[0].sourceApplications?.map((source) => source.sourceEntityId)).toEqual(['fonte-a', 'fonte-b']);
  });
});
