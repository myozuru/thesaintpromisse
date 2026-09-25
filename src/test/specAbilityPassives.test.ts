/**
 * Fase 1 — Bônus passivos derivados das Habilidades de Especialização
 * (Especialista em Técnica). Asserções unitárias por ID + caso combinado.
 */
import { describe, it, expect } from 'vitest';
import { aggregateSpecAbilityEffects } from '@/lib/specAbilityEffects';
import type { Character } from '@/types';

function makeChar(partial: Partial<Character> = {}): Pick<
  Character,
  'chosenSpecAbilities' | 'attributes' | 'level' | 'keyAttribute'
> {
  return {
    level: 1,
    attributes: [
      { id: 'a1', name: 'Força', value: 10 },
      { id: 'a2', name: 'Destreza', value: 10 },
      { id: 'a3', name: 'Constituição', value: 10 },
      { id: 'a4', name: 'Inteligência', value: 10 },
      { id: 'a5', name: 'Sabedoria', value: 10 },
      { id: 'a6', name: 'Presença', value: 10 },
    ] as Character['attributes'],
    chosenSpecAbilities: [],
    keyAttribute: undefined,
    ...partial,
  };
}

const withAbility = (id: string, base: Partial<Character> = {}) =>
  makeChar({
    ...base,
    chosenSpecAbilities: [{ abilityId: id, chosenAtLevel: base.level ?? 1 }],
  });

describe('aggregateSpecAbilityEffects — sem habilidades', () => {
  it('retorna deltas zerados', () => {
    const r = aggregateSpecAbilityEffects(makeChar());
    expect(r.initiativeBonus).toBe(0);
    expect(r.classCdBonus).toBe(0);
    expect(r.spellAtkBonus).toBe(0);
    expect(r.peMaxBonus).toBe(0);
    expect(r.defenseBonus).toBe(0);
    expect(r.savesAdvantageVsConditions).toEqual([]);
  });
});

describe('tec-reacao-rapida', () => {
  it('soma o maior mod entre INT e SAB na iniciativa', () => {
    const c = withAbility('tec-reacao-rapida', {
      level: 5,
      attributes: [
        { id: 'a1', name: 'Força', value: 10 },
        { id: 'a2', name: 'Destreza', value: 10 },
        { id: 'a3', name: 'Constituição', value: 10 },
        { id: 'a4', name: 'Inteligência', value: 18 }, // mod +4
        { id: 'a5', name: 'Sabedoria', value: 14 }, // mod +2
        { id: 'a6', name: 'Presença', value: 10 },
      ] as Character['attributes'],
    });
    expect(aggregateSpecAbilityEffects(c).initiativeBonus).toBe(4);
  });

  it('respeita keyAttribute quando definido', () => {
    const c = withAbility('tec-reacao-rapida', {
      level: 5,
      keyAttribute: 'Sabedoria',
      attributes: [
        { id: 'a1', name: 'Força', value: 10 },
        { id: 'a2', name: 'Destreza', value: 10 },
        { id: 'a3', name: 'Constituição', value: 10 },
        { id: 'a4', name: 'Inteligência', value: 18 },
        { id: 'a5', name: 'Sabedoria', value: 14 },
        { id: 'a6', name: 'Presença', value: 10 },
      ] as Character['attributes'],
    });
    expect(aggregateSpecAbilityEffects(c).initiativeBonus).toBe(2);
  });

  it('não soma mod negativo', () => {
    const c = withAbility('tec-reacao-rapida', {
      level: 1,
      attributes: [
        { id: 'a1', name: 'Força', value: 10 },
        { id: 'a2', name: 'Destreza', value: 10 },
        { id: 'a3', name: 'Constituição', value: 10 },
        { id: 'a4', name: 'Inteligência', value: 8 }, // -1
        { id: 'a5', name: 'Sabedoria', value: 10 }, // 0
        { id: 'a6', name: 'Presença', value: 10 },
      ] as Character['attributes'],
    });
    // O agregador soma o maior; max(-1, 0) = 0.
    expect(aggregateSpecAbilityEffects(c).initiativeBonus).toBe(0);
  });
});

describe('tec-reforco-amaldicoado', () => {
  it('soma +1 na CD em níveis < 10', () => {
    const c = withAbility('tec-reforco-amaldicoado', { level: 5 });
    expect(aggregateSpecAbilityEffects(c).classCdBonus).toBe(1);
  });
  it('soma +2 na CD a partir do nível 10', () => {
    const c = withAbility('tec-reforco-amaldicoado', { level: 10 });
    expect(aggregateSpecAbilityEffects(c).classCdBonus).toBe(2);
  });
});

describe('tec-feiticos-refinados', () => {
  it('soma floor(TB/2) na CD', () => {
    // Nível 1 → TB=2 → +1
    expect(aggregateSpecAbilityEffects(withAbility('tec-feiticos-refinados', { level: 1 })).classCdBonus).toBe(1);
    // Nível 5 → TB=3 → +1
    expect(aggregateSpecAbilityEffects(withAbility('tec-feiticos-refinados', { level: 5 })).classCdBonus).toBe(1);
    // Nível 9 → TB=4 → +2
    expect(aggregateSpecAbilityEffects(withAbility('tec-feiticos-refinados', { level: 9 })).classCdBonus).toBe(2);
    // Nível 17 → TB=6 → +3
    expect(aggregateSpecAbilityEffects(withAbility('tec-feiticos-refinados', { level: 17 })).classCdBonus).toBe(3);
  });
});

describe('tec-olhar-preciso', () => {
  it('Ataque Mágico = 2 + floor((Nv-4)/4), mín 0', () => {
    expect(aggregateSpecAbilityEffects(withAbility('tec-olhar-preciso', { level: 4 })).spellAtkBonus).toBe(2);
    expect(aggregateSpecAbilityEffects(withAbility('tec-olhar-preciso', { level: 8 })).spellAtkBonus).toBe(3);
    expect(aggregateSpecAbilityEffects(withAbility('tec-olhar-preciso', { level: 12 })).spellAtkBonus).toBe(4);
    expect(aggregateSpecAbilityEffects(withAbility('tec-olhar-preciso', { level: 20 })).spellAtkBonus).toBe(6);
    // Em Nv 1: 2 + ⌊(1-4)/4⌋ = 2 + (-1) = 1 (não negativo, clamp não atua).
    expect(aggregateSpecAbilityEffects(withAbility('tec-olhar-preciso', { level: 1 })).spellAtkBonus).toBe(1);
  });
});

describe('tec-energia-inacabavel', () => {
  it('PE máx += floor(Nv/2)', () => {
    expect(aggregateSpecAbilityEffects(withAbility('tec-energia-inacabavel', { level: 1 })).peMaxBonus).toBe(0);
    expect(aggregateSpecAbilityEffects(withAbility('tec-energia-inacabavel', { level: 4 })).peMaxBonus).toBe(2);
    expect(aggregateSpecAbilityEffects(withAbility('tec-energia-inacabavel', { level: 11 })).peMaxBonus).toBe(5);
    expect(aggregateSpecAbilityEffects(withAbility('tec-energia-inacabavel', { level: 20 })).peMaxBonus).toBe(10);
  });
});

describe('tec-movimentos-imprevisiveis', () => {
  it('Defesa += min(Mod_Chave, Nv)', () => {
    // Nv 3, INT 18 (+4) → min(4, 3) = 3
    const c1 = withAbility('tec-movimentos-imprevisiveis', {
      level: 3,
      attributes: [
        { id: 'a1', name: 'Força', value: 10 },
        { id: 'a2', name: 'Destreza', value: 10 },
        { id: 'a3', name: 'Constituição', value: 10 },
        { id: 'a4', name: 'Inteligência', value: 18 },
        { id: 'a5', name: 'Sabedoria', value: 10 },
        { id: 'a6', name: 'Presença', value: 10 },
      ] as Character['attributes'],
    });
    expect(aggregateSpecAbilityEffects(c1).defenseBonus).toBe(3);

    // Nv 10, SAB 16 (+3) → min(3, 10) = 3
    const c2 = withAbility('tec-movimentos-imprevisiveis', {
      level: 10,
      attributes: [
        { id: 'a1', name: 'Força', value: 10 },
        { id: 'a2', name: 'Destreza', value: 10 },
        { id: 'a3', name: 'Constituição', value: 10 },
        { id: 'a4', name: 'Inteligência', value: 10 },
        { id: 'a5', name: 'Sabedoria', value: 16 },
        { id: 'a6', name: 'Presença', value: 10 },
      ] as Character['attributes'],
    });
    expect(aggregateSpecAbilityEffects(c2).defenseBonus).toBe(3);
  });

  it('não aplica defesa negativa', () => {
    const c = withAbility('tec-movimentos-imprevisiveis', { level: 5 }); // todos atributos 10 → mod 0
    expect(aggregateSpecAbilityEffects(c).defenseBonus).toBe(0);
  });
});

describe('tec-bastiao-interior', () => {
  it('expõe condições com vantagem em TR', () => {
    const c = withAbility('tec-bastiao-interior', { level: 6 });
    const r = aggregateSpecAbilityEffects(c);
    expect(r.savesAdvantageVsConditions).toEqual(['amedrontado', 'desorientado', 'enfeiticado']);
  });
});

describe('Combinatório — Reforço + Refinados em Nv 10', () => {
  it('CD recebe +2 (Reforço) + ⌊TB/2⌋ = +2 + +2 = +4', () => {
    const c = makeChar({
      level: 10,
      chosenSpecAbilities: [
        { abilityId: 'tec-reforco-amaldicoado', chosenAtLevel: 10 },
        { abilityId: 'tec-feiticos-refinados', chosenAtLevel: 4 },
      ],
    });
    // TB Nv10 = 4 → ⌊4/2⌋ = 2.
    expect(aggregateSpecAbilityEffects(c).classCdBonus).toBe(2 + 2);
  });
});

describe('Combinatório — Olhar Preciso + Energia Inacabável + Reação Rápida em Nv 20', () => {
  it('aplica os três deltas independentes corretamente', () => {
    const c = makeChar({
      level: 20,
      chosenSpecAbilities: [
        { abilityId: 'tec-olhar-preciso', chosenAtLevel: 4 },
        { abilityId: 'tec-energia-inacabavel', chosenAtLevel: 4 },
        { abilityId: 'tec-reacao-rapida', chosenAtLevel: 2 },
      ],
      attributes: [
        { id: 'a1', name: 'Força', value: 10 },
        { id: 'a2', name: 'Destreza', value: 10 },
        { id: 'a3', name: 'Constituição', value: 10 },
        { id: 'a4', name: 'Inteligência', value: 20 }, // +5
        { id: 'a5', name: 'Sabedoria', value: 10 },
        { id: 'a6', name: 'Presença', value: 10 },
      ] as Character['attributes'],
    });
    const r = aggregateSpecAbilityEffects(c);
    expect(r.spellAtkBonus).toBe(6); // 2 + (20-4)/4 = 6
    expect(r.peMaxBonus).toBe(10); // 20/2
    expect(r.initiativeBonus).toBe(5); // mod INT
  });
});
