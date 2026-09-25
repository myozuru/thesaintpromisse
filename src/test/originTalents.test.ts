/**
 * Testes para automação dos talentos de origem (quick wins):
 * Quebra de Limites, Físico Aperfeiçoado (A) e Reposição Sanguínea.
 */
import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import { aggregateTalentBonuses } from '@/lib/talentEffects';

function makeChar(level: number, talents: Array<{ id: string; choices?: Record<string, string> }>): Character {
  return {
    id: 't', name: 'T', level,
    peCurrent: 0, peMax: 0, hpCurrent: 0, hpMax: 0,
    attributes: [],
    chosenTalents: talents.map((t) => ({ id: t.id, level: 1, choices: t.choices })),
  } as unknown as Character;
}

describe('Quebra de Limites (Derivado)', () => {
  // NOTA: o talento aplica +2/+2 MUTATIVAMENTE em applyTalentAcquisitionMutations
  // (no store), não via aggregateTalentBonuses. O agregador NÃO deve duplicar
  // esses bônus — testamos a ausência para evitar regressão de double-counting.
  it('NÃO duplica via aggregator (mutações ficam no store)', () => {
    const r = aggregateTalentBonuses(makeChar(6, [
      { id: 'tal-quebra-limites', choices: { attr: 'FOR', attr2: 'DES' } },
    ]));
    expect(r.attrValueBoost).toEqual({});
    expect(r.attrCapBoost).toEqual({});
  });
});

describe('Físico Aperfeiçoado (FAH)', () => {
  it('Movimento +4,5m', () => {
    const r = aggregateTalentBonuses(makeChar(6, [{ id: 'tal-fisico-aperfeicoado' }]));
    expect(r.movementMeters).toBe(4.5);
    expect(r.breakdown.some((b) => b.field === 'Movimento')).toBe(true);
  });
});

describe('Reposição Sanguínea (FAH)', () => {
  it('cura do Vigor Maldito +5', () => {
    const r = aggregateTalentBonuses(makeChar(6, [{ id: 'tal-reposicao-sanguinea' }]));
    expect(r.vigorMalditoHealBonus).toBe(5);
  });
});

describe('Combinação FAH (Físico + Reposição)', () => {
  it('agrega movimento e cura sem conflito', () => {
    const r = aggregateTalentBonuses(makeChar(6, [
      { id: 'tal-fisico-aperfeicoado' },
      { id: 'tal-reposicao-sanguinea' },
    ]));
    expect(r.movementMeters).toBe(4.5);
    expect(r.vigorMalditoHealBonus).toBe(5);
  });
});
