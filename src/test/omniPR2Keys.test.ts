/**
 * PR-2 — Auditoria: Mapa & Distância, Recursos Detalhados, Empunhadura.
 */
import { describe, it, expect } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import type { Character } from '@/types';

const base: Character = {
  id: 'pr2-1',
  name: 'PR2',
  level: 3,
  trainingBonus: 2,
  hpCurrent: 20, hpMax: 20,
  peCurrent: 10, peMax: 10,
  ca: 10, movement: 9,
  reactionsMax: 1, reactionsCurrent: 1,
  attributes: [], skills: [], savingThrows: [],
} as unknown as Character;

const resolver = (c: Character, key: string) =>
  avaliarFormula(`@USUARIO.${key}`, montarVariaveisDoPersonagem(c)).valor;

describe('PR-2 — Mapa & Distância', () => {
  it('flags de mapa default = 0', () => {
    for (const k of ['em_terreno_dificil', 'voando', 'prono', 'agachado', 'usou_corrida', 'sobrecarregado']) {
      expect(resolver(base, k)).toBe(0);
    }
  });
  it('velocidade_atual = movement quando sem sobrecarga', () => {
    expect(resolver(base, 'velocidade_atual')).toBe(9);
  });
  it('velocidade_atual cai pela metade quando sobrecarregado', () => {
    const c = { ...base, slotsCurrent: 20, slotsMax: 10 } as unknown as Character;
    expect(resolver(c, 'sobrecarregado')).toBe(1);
    expect(resolver(c, 'velocidade_atual')).toBe(4.5);
  });
  it('metros_movidos_neste_turno lê de omniCounters', () => {
    const c = { ...base, omniCounters: { metros_movidos: 6 } } as unknown as Character;
    expect(resolver(c, 'metros_movidos_neste_turno')).toBe(6);
  });
});

describe('PR-2 — Recursos Detalhados (thresholds de vida/PE)', () => {
  it('vida cheia: nenhum threshold ativo', () => {
    expect(resolver(base, 'bloodied')).toBe(0);
    expect(resolver(base, 'criticamente_ferido')).toBe(0);
  });
  it('vida ≤ 50%: bloodied = 1, criticamente_ferido = 0', () => {
    const c = { ...base, hpCurrent: 10, hpMax: 20 } as unknown as Character;
    expect(resolver(c, 'bloodied')).toBe(1);
    expect(resolver(c, 'vida_pct_abaixo_50')).toBe(1);
    expect(resolver(c, 'criticamente_ferido')).toBe(0);
  });
  it('vida ≤ 25%: ambos ativos', () => {
    const c = { ...base, hpCurrent: 5, hpMax: 20 } as unknown as Character;
    expect(resolver(c, 'bloodied')).toBe(1);
    expect(resolver(c, 'criticamente_ferido')).toBe(1);
    expect(resolver(c, 'vida_pct_abaixo_25')).toBe(1);
  });
  it('PE thresholds', () => {
    const c = { ...base, peCurrent: 2, peMax: 10 } as unknown as Character;
    expect(resolver(c, 'pe_pct_abaixo_50')).toBe(1);
    expect(resolver(c, 'pe_pct_abaixo_25')).toBe(1);
  });
});

describe('PR-2 — Empunhadura', () => {
  it('desarmado = 1 quando ambos slots vazios', () => {
    expect(resolver(base, 'desarmado')).toBe(1);
    expect(resolver(base, 'duas_maos')).toBe(0);
    expect(resolver(base, 'dual_wield')).toBe(0);
  });
  it('arma melee Adaga: cac=1, fineza=1, leve=1', () => {
    const c = { ...base, mainHandWeaponName: 'Adaga' } as unknown as Character;
    expect(resolver(c, 'desarmado')).toBe(0);
    expect(resolver(c, 'arma_principal_eh_cac')).toBe(1);
    expect(resolver(c, 'arma_principal_eh_distancia')).toBe(0);
    expect(resolver(c, 'arma_principal_fineza')).toBe(1);
    expect(resolver(c, 'arma_principal_leve')).toBe(1);
  });
  it('duas_maos quando main = off (mesma arma)', () => {
    const c = { ...base, mainHandWeaponName: 'Bastão', offHandWeaponName: 'Bastão' } as unknown as Character;
    expect(resolver(c, 'duas_maos')).toBe(1);
    expect(resolver(c, 'dual_wield')).toBe(0);
  });
  it('dual_wield quando main ≠ off', () => {
    const c = { ...base, mainHandWeaponName: 'Adaga', offHandWeaponName: 'Espada Curta' } as unknown as Character;
    expect(resolver(c, 'dual_wield')).toBe(1);
    expect(resolver(c, 'duas_maos')).toBe(0);
  });
  it('predicate arma_grupo_<grupo> resolve para arma equipada', () => {
    const c = { ...base, mainHandWeaponName: 'Adaga' } as unknown as Character;
    expect(resolver(c, 'arma_grupo_faca')).toBe(1);
    expect(resolver(c, 'arma_grupo_espada')).toBe(0);
  });
  it('ultimo_ataque_acertou / errou', () => {
    const hit = { ...base, lastAttackHit: true } as unknown as Character;
    const miss = { ...base, lastAttackHit: false } as unknown as Character;
    expect(resolver(hit, 'ultimo_ataque_acertou')).toBe(1);
    expect(resolver(hit, 'ultimo_ataque_errou')).toBe(0);
    expect(resolver(miss, 'ultimo_ataque_errou')).toBe(1);
  });
});
