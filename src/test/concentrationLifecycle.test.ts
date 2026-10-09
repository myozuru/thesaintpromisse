import { afterEach, describe, expect, it } from 'vitest';
import { canStartConcentration, concentrationLimit, getActiveConcentrationCount } from '@/lib/concentration';
import { useCharacterStore } from '@/stores/useCharacterStore';
import type { ActiveBuff, ActiveCondition, Character } from '@/types';

const concentration = (instanceId: string) => ({
  instanceId, spellId: `spell-${instanceId}`, spellName: `Spell ${instanceId}`, targetIds: ['ally'], startedAt: 1,
});

const character = (
  id: string,
  patch: Partial<Character> = {},
) => ({
  id,
  name: id,
  category: 'PLAYER',
  maxConcentrationSlots: 1,
  activeConcentrations: [],
  activeBuffs: [],
  activeConditions: [],
  ...patch,
}) as unknown as Character;

afterEach(() => useCharacterStore.setState({ characters: [] } as never));

describe('estado funcional de concentração OMNI', () => {
  it('conta IDs únicos e bloqueia novo feitiço quando todos os slots estão ocupados', () => {
    const caster = character('caster', {
      maxConcentrationSlots: 2,
      activeConcentrations: [concentration('one'), concentration('one')],
    });
    expect(getActiveConcentrationCount(caster)).toBe(1);
    expect(concentrationLimit(caster)).toBe(2);
    expect(canStartConcentration(caster, { requiresConcentration: true })).toBe(true);
    expect(canStartConcentration(character('full', {
      activeConcentrations: [concentration('one')],
    }), { requiresConcentration: true })).toBe(false);
  });

  it('não ocupa concentração por feitiço que não a exige e saneia limites inválidos', () => {
    const full = character('full', { activeConcentrations: [concentration('one')] });
    expect(canStartConcentration(full, { requiresConcentration: false })).toBe(true);
    expect(concentrationLimit(character('invalid', { maxConcentrationSlots: -3 }))).toBe(0);
    expect(concentrationLimit(character('invalid', { maxConcentrationSlots: Number.NaN }))).toBe(1);
  });

  it('encerrar uma instância limpa os efeitos dela em vários alvos e preserva outras fontes', () => {
    const buffs: ActiveBuff[] = [
      { id: 'b1', spellName: 'Névoa', type: 'ca', value: 2, remainingTurns: -1, concentrationInstanceId: 'c1' },
      { id: 'b2', spellName: 'Barreira', type: 'rd', value: 3, remainingTurns: -1, concentrationInstanceId: 'c2' },
    ];
    const conditions: ActiveCondition[] = [
      { id: 'cond1', conditionId: 'cego', name: 'Cego', icon: 'x', remainingTurns: -1, remainingRounds: -1, sourceInstanceId: 'c1' },
      { id: 'cond2', conditionId: 'lento', name: 'Lento', icon: 'x', remainingTurns: -1, remainingRounds: -1, sourceInstanceId: 'c2' },
    ];
    useCharacterStore.setState({ characters: [
      character('caster', { activeConcentrations: [concentration('c1'), concentration('c2')] }),
      character('ally-a', { activeBuffs: buffs, activeConditions: conditions }),
      character('ally-b', { activeBuffs: [
        { id: 'b3', spellName: 'Névoa', type: 'hit', value: 1, remainingTurns: -1, concentrationInstanceId: 'c1' },
      ] }),
    ] } as never);

    expect(useCharacterStore.getState().endConcentration('caster', 'c1')).toBe(true);
    const chars = useCharacterStore.getState().characters;
    expect(chars.find((c) => c.id === 'caster')?.activeConcentrations?.map((entry) => entry.instanceId)).toEqual(['c2']);
    expect(chars.find((c) => c.id === 'ally-a')?.activeBuffs?.map((buff) => buff.id)).toEqual(['b2']);
    expect(chars.find((c) => c.id === 'ally-a')?.activeConditions?.map((condition) => condition.id)).toEqual(['cond2']);
    expect(chars.find((c) => c.id === 'ally-b')?.activeBuffs).toEqual([]);
  });

  it('encerrar concentração preserva uma condição ainda aplicada por outra fonte', () => {
    const sharedCondition: ActiveCondition = {
      id: 'cond', conditionId: 'cego', name: 'Cego', icon: 'x', remainingTurns: -1, remainingRounds: -1,
      sourceInstanceId: 'c1',
      sourceApplications: [
        { applicationId: 'app1', sourceInstanceId: 'c1', remainingTurns: -1, remainingRounds: -1 },
        { applicationId: 'app2', sourceInstanceId: 'c2', remainingTurns: 3, remainingRounds: 2 },
      ],
    };
    useCharacterStore.setState({ characters: [
      character('caster', { activeConcentrations: [concentration('c1')] }),
      character('ally', { activeConditions: [sharedCondition] }),
    ] } as never);

    useCharacterStore.getState().endConcentration('caster', 'c1');
    const condition = useCharacterStore.getState().characters.find((c) => c.id === 'ally')?.activeConditions?.[0];
    expect(condition?.sourceApplications?.map((source) => source.sourceInstanceId)).toEqual(['c2']);
    expect(condition?.remainingRounds).toBe(2);
  });

  it('encerrar sustentação também libera a concentração quando ambas usam a mesma instância', () => {
    const buff: ActiveBuff = {
      id: 'sustained-buff', spellName: 'Muralha', type: 'ca', value: 2, remainingTurns: -1,
      sourceCharId: 'caster', sustainInstanceId: 'cast', concentrationInstanceId: 'cast', isSustained: true,
    };
    useCharacterStore.setState({ characters: [
      character('caster', { activeConcentrations: [concentration('cast')] }),
      character('ally', { activeBuffs: [buff] }),
    ] } as never);

    useCharacterStore.getState().removeSustainedBuffsFrom('caster');
    const caster = useCharacterStore.getState().characters.find((c) => c.id === 'caster');
    expect(caster?.activeConcentrations).toEqual([]);
    expect(useCharacterStore.getState().characters.find((c) => c.id === 'ally')?.activeBuffs).toEqual([]);
  });
});
