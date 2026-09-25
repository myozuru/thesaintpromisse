/**
 * Testes para Robustez Aprimorada e Alma Inquebrável
 * (extensões do agregador de bônus passivos de talentos).
 */
import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import { aggregateTalentBonuses } from '@/lib/talentEffects';

function makeChar(level: number, talentIds: string[]): Character {
  return {
    id: 't', name: 'T', level,
    peCurrent: 0, peMax: 0, hpCurrent: 0, hpMax: 0,
    attributes: [],
    chosenTalents: talentIds.map((id) => ({ id })),
  } as unknown as Character;
}

describe('Robustez Aprimorada', () => {
  it('Nv 1 → +1 HP, +2 Fortitude', () => {
    const r = aggregateTalentBonuses(makeChar(1, ['tal-robustez-aprimorada']));
    expect(r.hp).toBe(1);
    expect(r.fortitude).toBe(2);
  });

  it('Nv 12 → +12 HP, +2 Fortitude (escala com nível)', () => {
    const r = aggregateTalentBonuses(makeChar(12, ['tal-robustez-aprimorada']));
    expect(r.hp).toBe(12);
    expect(r.fortitude).toBe(2);
  });

  it('breakdown lista origem', () => {
    const r = aggregateTalentBonuses(makeChar(5, ['tal-robustez-aprimorada']));
    expect(r.breakdown.some((b) => b.field === 'Fortitude')).toBe(true);
    expect(r.breakdown.some((b) => b.field === 'HP máx')).toBe(true);
  });
});

describe('Alma Inquebrável', () => {
  it('Nv 3 → 0 RD Alma (floor(3/4)=0), mas concede Integridade', () => {
    const r = aggregateTalentBonuses(makeChar(3, ['tal-alma-inquebravel']));
    expect(r.soulRd).toBe(0);
    expect(r.grantedTrainedSkills).toContain('Integridade');
  });

  it('Nv 4 → +1 RD Alma', () => {
    const r = aggregateTalentBonuses(makeChar(4, ['tal-alma-inquebravel']));
    expect(r.soulRd).toBe(1);
  });

  it('Nv 16 → +4 RD Alma', () => {
    const r = aggregateTalentBonuses(makeChar(16, ['tal-alma-inquebravel']));
    expect(r.soulRd).toBe(4);
  });

  it('Nv 20 → +5 RD Alma', () => {
    const r = aggregateTalentBonuses(makeChar(20, ['tal-alma-inquebravel']));
    expect(r.soulRd).toBe(5);
  });
});

describe('Combinação', () => {
  it('Robustez + Alma Inquebrável Nv 8 acumula corretamente', () => {
    const r = aggregateTalentBonuses(
      makeChar(8, ['tal-robustez-aprimorada', 'tal-alma-inquebravel']),
    );
    expect(r.hp).toBe(8);
    expect(r.fortitude).toBe(2);
    expect(r.soulRd).toBe(2);
    expect(r.grantedTrainedSkills).toContain('Integridade');
  });
});
