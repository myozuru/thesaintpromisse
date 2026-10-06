import { afterEach, describe, expect, it } from 'vitest';
import { useCharacterStore } from '@/stores/useCharacterStore';
import type { ActiveBuff, ActiveCondition, Character } from '@/types';

const buff = (patch: Partial<ActiveBuff> = {}): ActiveBuff => ({
  id: 'buff-1', spellName: 'Véu Protetor', type: 'ca', value: 2, remainingTurns: -1,
  peCostPerRound: 1, sourceCharId: 'caster', sustainInstanceId: 'cast-1', isSustained: true,
  ...patch,
});

const character = (id: string, peCurrent: number, activeBuffs: ActiveBuff[] = [], activeConditions: ActiveCondition[] = []) => ({
  id, name: id, peCurrent, activeBuffs, activeConditions, cooldowns: {},
}) as unknown as Character;

afterEach(() => useCharacterStore.setState({ characters: [] } as never));

describe('cobrança de sustentação de magia', () => {
  it('cobra uma vez por conjuração do conjurador, mesmo com múltiplos buffs e alvos', () => {
    useCharacterStore.setState({ characters: [
      character('caster', 5),
      character('ally-a', 20, [buff({ id: 'a' }), buff({ id: 'b', type: 'hit', value: 1 })]),
      character('ally-b', 20, [buff({ id: 'c' })]),
    ] } as never);

    useCharacterStore.getState().tickBuffs('caster');
    const chars = useCharacterStore.getState().characters;

    expect(chars.find((c) => c.id === 'caster')?.peCurrent).toBe(4);
    expect(chars.find((c) => c.id === 'ally-a')?.activeBuffs).toHaveLength(2);
    expect(chars.find((c) => c.id === 'ally-b')?.activeBuffs).toHaveLength(1);
    expect(chars.find((c) => c.id === 'ally-a')?.peCurrent).toBe(20);
  });

  it('encerra buffs e condições da conjuração se o conjurador não puder pagar', () => {
    const condition: ActiveCondition = {
      id: 'condition-1', conditionId: 'cego', name: 'Cego', icon: 'x',
      remainingTurns: -1, remainingRounds: -1, sourceCharId: 'caster',
      sourceEntityId: 'spell-1', sourceInstanceId: 'cast-1',
    };
    useCharacterStore.setState({ characters: [
      character('caster', 0),
      character('ally', 20, [buff()], [condition]),
    ] } as never);

    useCharacterStore.getState().tickBuffs('caster');
    const ally = useCharacterStore.getState().characters.find((c) => c.id === 'ally');

    expect(ally?.activeBuffs).toEqual([]);
    expect(ally?.activeConditions).toEqual([]);
    expect(ally?.peCurrent).toBe(20);
  });

  it('ao substituir uma sustentação, remove somente as condições da conjuração encerrada', () => {
    const condition = (id: string, sourceInstanceId: string): ActiveCondition => ({
      id, conditionId: 'cego', name: 'Cego', icon: 'x', remainingTurns: -1,
      remainingRounds: -1, sourceCharId: 'caster', sourceEntityId: 'spell', sourceInstanceId,
    });
    useCharacterStore.setState({ characters: [
      character('caster', 5),
      character('ally', 20, [buff()], [condition('old', 'cast-1'), condition('other', 'cast-other')]),
    ] } as never);

    useCharacterStore.getState().removeSustainedBuffsFrom('caster');

    const ally = useCharacterStore.getState().characters.find((c) => c.id === 'ally');
    expect(ally?.activeBuffs).toEqual([]);
    expect(ally?.activeConditions?.map((c) => c.id)).toEqual(['other']);
  });

  it('não cobra manutenção de buff duradouro com duração finita', () => {
    useCharacterStore.setState({ characters: [
      character('caster', 5),
      character('ally', 20, [buff({ isSustained: false, remainingTurns: 3, peCostPerRound: 0, sustainInstanceId: undefined })]),
    ] } as never);

    useCharacterStore.getState().tickBuffs('caster');
    const chars = useCharacterStore.getState().characters;

    expect(chars.find((c) => c.id === 'caster')?.peCurrent).toBe(5);
    expect(chars.find((c) => c.id === 'ally')?.activeBuffs[0].remainingTurns).toBe(3);
  });

  it('decrementa duração do buff no turno de quem o recebeu', () => {
    useCharacterStore.setState({ characters: [
      character('caster', 5),
      character('ally', 20, [buff({ isSustained: false, remainingTurns: 2, peCostPerRound: 0, sustainInstanceId: undefined })]),
    ] } as never);

    useCharacterStore.getState().tickBuffs('ally');

    expect(useCharacterStore.getState().characters.find((c) => c.id === 'ally')?.activeBuffs[0].remainingTurns).toBe(1);
  });
});
