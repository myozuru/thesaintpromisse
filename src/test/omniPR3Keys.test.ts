/**
 * PR-3 — Auditoria: Identidade, Condições, Concentração e Funções matemáticas.
 */
import { describe, it, expect } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import type { Character } from '@/types';

const base: Character = {
  id: 'pr3-1',
  name: 'PR3',
  level: 3,
  trainingBonus: 2,
  hpCurrent: 20, hpMax: 20,
  peCurrent: 10, peMax: 10,
  ca: 10, movement: 9,
  category: 'PLAYER',
  attributes: [], skills: [], savingThrows: [],
} as unknown as Character;

const resolver = (c: Character, key: string) =>
  avaliarFormula(`@USUARIO.${key}`, montarVariaveisDoPersonagem(c)).valor;

describe('PR-3 — Identidade', () => {
  it('eh_player=1 quando categoria=PLAYER', () => {
    expect(resolver(base, 'eh_player')).toBe(1);
    expect(resolver(base, 'eh_npc')).toBe(0);
    expect(resolver(base, 'eh_inimigo')).toBe(0);
  });
  it('eh_inimigo=1 quando categoria=INIMIGO', () => {
    const c = { ...base, category: 'INIMIGO' } as unknown as Character;
    expect(resolver(c, 'eh_inimigo')).toBe(1);
    expect(resolver(c, 'eh_player')).toBe(0);
  });
  it('origem_id_<id> e especializacao_id_<id> resolvem predicate', () => {
    const c = {
      ...base,
      origin: { id: 'orfao' },
      specialization: { id: 'feiticeiro' },
    } as unknown as Character;
    expect(resolver(c, 'origem_id_orfao')).toBe(1);
    expect(resolver(c, 'especializacao_id_feiticeiro')).toBe(1);
    expect(resolver(c, 'origem_id_nobre')).toBe(0);
  });
});

describe('PR-3 — Condições', () => {
  it('default sem condições', () => {
    expect(resolver(base, 'qtd_condicoes')).toBe(0);
    expect(resolver(base, 'tem_condicao_atordoado')).toBe(0);
  });
  it('conta condições e categoriza', () => {
    const c = {
      ...base,
      activeConditions: [
        { conditionId: 'atordoado' },
        { conditionId: 'cego' },
        { conditionId: 'envenenado' },
      ],
    } as unknown as Character;
    expect(resolver(c, 'qtd_condicoes')).toBe(3);
    expect(resolver(c, 'tem_condicao_atordoado')).toBe(1);
    expect(resolver(c, 'tem_condicao_cego')).toBe(1);
    expect(resolver(c, 'qtd_condicoes_incapacitacao')).toBe(1);
    expect(resolver(c, 'qtd_condicoes_sensorial')).toBe(1);
    expect(resolver(c, 'qtd_condicoes_fisica')).toBe(1);
  });
});

describe('PR-3 — Concentração & Sustentados', () => {
  it('slots livres = max quando nada ativo', () => {
    const c = { ...base, maxConcentrationSlots: 2, maxSustainedSpells: 3 } as unknown as Character;
    expect(resolver(c, 'qtd_concentrando')).toBe(0);
    expect(resolver(c, 'qtd_sustentados')).toBe(0);
    expect(resolver(c, 'slots_concentracao_livres')).toBe(2);
    expect(resolver(c, 'slots_sustentado_livres')).toBe(3);
  });
  it('conta buffs sustentados (isSustained ou durationRounds=-1)', () => {
    const c = {
      ...base,
      maxSustainedSpells: 2,
      activeBuffs: [
        { isSustained: true },
        { durationRounds: -1 },
        { durationRounds: 3 },
      ],
    } as unknown as Character;
    expect(resolver(c, 'qtd_sustentados')).toBe(2);
    expect(resolver(c, 'slots_sustentado_livres')).toBe(0);
  });
});

describe('PR-3 — Funções matemáticas', () => {
  const vars = montarVariaveisDoPersonagem(base);
  const evalF = (f: string) => avaliarFormula(f, vars).valor;

  it('clamp(x,a,b)', () => {
    expect(evalF('clamp(15, 0, 10)')).toBe(10);
    expect(evalF('clamp(-3, 0, 10)')).toBe(0);
    expect(evalF('clamp(5, 0, 10)')).toBe(5);
  });
  it('between(x,a,b)', () => {
    expect(evalF('between(5, 1, 10)')).toBe(1);
    expect(evalF('between(15, 1, 10)')).toBe(0);
    expect(evalF('between(1, 1, 10)')).toBe(1);
  });
  it('pct(parte,total)', () => {
    expect(evalF('pct(25, 100)')).toBe(25);
    expect(evalF('pct(1, 4)')).toBe(25);
    expect(evalF('pct(5, 0)')).toBe(0);
  });
  it('sqrt e pow', () => {
    expect(evalF('sqrt(16)')).toBe(4);
    expect(evalF('pow(2, 5)')).toBe(32);
  });
});
