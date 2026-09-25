/**
 * Talento "Discurso Motivador" — testes do helper e da action.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { computeDiscursoMotivador } from '@/lib/talentEffects';
import { useCharacterStore } from '@/stores/useCharacterStore';
import type { Character } from '@/types';

function makeChar(overrides: Partial<Character>): Character {
  return {
    id: overrides.id ?? 'src',
    name: overrides.name ?? 'Tester',
    category: 'PLAYER',
    level: overrides.level ?? 5,
    ca: 10,
    baseDC: 10,
    hpCurrent: 30, hpMax: 30,
    peCurrent: 10, peMax: 10,
    escCurrent: 0, escMax: 0,
    rd: 0, rdByType: {} as Character['rdByType'],
    slotsMax: 0, slotsCurrent: 0,
    attributes: [
      { id: 'a1', name: 'Presença', value: 16 }, // mod +3
    ],
    skills: [
      { id: 's1', name: 'Persuasão', value: 0, trained: true },
    ],
    savingThrows: [],
    passives: [],
    spells: [],
    equippedItems: [],
    customHitBonus: 0,
    meleeAttackBonus: 0, rangedAttackBonus: 0, cursedAttackBonus: 0,
    meleeLinkedAttr: '', rangedLinkedAttr: '', cursedLinkedAttr: '',
    chosenTalents: [{ id: 'tal-discurso-motivador' }],
    ...overrides,
  } as unknown as Character;
}

describe('Discurso Motivador — cálculo', () => {
  it('Lv5, mod PRE +3, Treinamento +3 → tempHP = 10 + ⌈9/2⌉ = 15', () => {
    const c = makeChar({ level: 5 });
    const r = computeDiscursoMotivador(c);
    expect(r.available).toBe(true);
    expect(r.eligible).toBe(true);
    expect(r.level).toBe(5);
    expect(r.preMod).toBe(3);
    expect(r.trainingBonus).toBe(3);
    expect(r.tempHP).toBe(15);
  });

  it('Lv10, mod PRE +4 (PRE 18), Treinamento +4 → 20 + ⌈16/2⌉ = 28', () => {
    const c = makeChar({
      level: 10,
      attributes: [{ id: 'a1', name: 'Presença', value: 18 }],
    });
    const r = computeDiscursoMotivador(c);
    expect(r.tempHP).toBe(28);
  });

  it('Sem Persuasão treinada → eligible=false', () => {
    const c = makeChar({
      skills: [{ id: 's1', name: 'Persuasão', value: 0, trained: false }],
    });
    const r = computeDiscursoMotivador(c);
    expect(r.available).toBe(true);
    expect(r.eligible).toBe(false);
  });

  it('Sem talento → available=false', () => {
    const c = makeChar({ chosenTalents: [] });
    const r = computeDiscursoMotivador(c);
    expect(r.available).toBe(false);
    expect(r.eligible).toBe(false);
  });
});

describe('Discurso Motivador — action store', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [] });
  });

  it('aplica PVT em alvos elegíveis e rejeita repetição', () => {
    const source = makeChar({ id: 'src', level: 5 });
    const ally1 = makeChar({ id: 'a1', name: 'Ally 1', chosenTalents: [], escCurrent: 0 });
    const ally2 = makeChar({ id: 'a2', name: 'Ally 2', chosenTalents: [], escCurrent: 5 });
    useCharacterStore.setState({ characters: [source, ally1, ally2] });

    const r1 = useCharacterStore.getState().applyDiscursoMotivador('src', ['a1', 'a2']);
    expect(r1.ok).toBe(true);
    expect(r1.tempHP).toBe(15);
    expect(r1.applied).toEqual(['a1', 'a2']);

    const after1 = useCharacterStore.getState().characters;
    expect(after1.find(c => c.id === 'a1')!.escCurrent).toBe(15);
    expect(after1.find(c => c.id === 'a2')!.escCurrent).toBe(20);
    expect(after1.find(c => c.id === 'src')!.discursoMotivadorUsedOn).toEqual(['a1', 'a2']);

    // segunda tentativa nos mesmos alvos → falha
    const r2 = useCharacterStore.getState().applyDiscursoMotivador('src', ['a1', 'a2']);
    expect(r2.ok).toBe(false);
    expect(r2.skipped).toEqual(['a1', 'a2']);
  });

  it('falha se sem talento', () => {
    const source = makeChar({ id: 'src', chosenTalents: [] });
    useCharacterStore.setState({ characters: [source] });
    const r = useCharacterStore.getState().applyDiscursoMotivador('src', ['x']);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/talento/i);
  });

  it('falha sem Persuasão treinada', () => {
    const source = makeChar({
      id: 'src',
      skills: [{ id: 's1', name: 'Persuasão', value: 0, trained: false }],
    });
    useCharacterStore.setState({ characters: [source] });
    const r = useCharacterStore.getState().applyDiscursoMotivador('src', ['x']);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Persuasão/i);
  });
});
