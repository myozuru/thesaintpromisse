/**
 * PR-7 — Auditoria: Combate Avançado.
 */
import { describe, it, expect } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import type { Character } from '@/types';

const base: Character = {
  id: 'hero-pr7',
  name: 'Hero',
  level: 3,
  trainingBonus: 2,
  hpCurrent: 20, hpMax: 20,
  peCurrent: 10, peMax: 10,
  ca: 10, movement: 9,
  category: 'PLAYER',
  reactionsMax: 1, reactionsCurrent: 1,
  attributes: [], skills: [], savingThrows: [],
} as unknown as Character;

const r = (c: Character, key: string) =>
  avaliarFormula(`@USUARIO.${key}`, montarVariaveisDoPersonagem(c)).valor;

describe('PR-7 — Combate Avançado', () => {
  it('sem mods/cobertura → defaults zerados', () => {
    expect(r(base, 'tem_vantagem')).toBe(0);
    expect(r(base, 'tem_desvantagem')).toBe(0);
    expect(r(base, 'qtd_vantagens')).toBe(0);
    expect(r(base, 'cobertura_meia')).toBe(0);
    expect(r(base, 'bonus_defesa_cobertura')).toBe(0);
    expect(r(base, 'imune_por_cobertura')).toBe(0);
  });

  it('vantagem em ataque é detectada nos escopos corretos', () => {
    const c = {
      ...base,
      omniAdvMods: {
        a1: { id: 'a1', kind: 'advantage', scope: 'attack_melee', expires: 'turn' },
        a2: { id: 'a2', kind: 'disadvantage', scope: 'next_save', expires: 'use' },
      },
    } as unknown as Character;
    expect(r(c, 'tem_vantagem')).toBe(1);
    expect(r(c, 'tem_desvantagem')).toBe(1);
    expect(r(c, 'qtd_vantagens')).toBe(1);
    expect(r(c, 'qtd_desvantagens')).toBe(1);
    expect(r(c, 'vantagem_proximo_ataque')).toBe(1);
    expect(r(c, 'desvantagem_proximo_ataque')).toBe(0);
    expect(r(c, 'desvantagem_proximo_tr')).toBe(1);
    expect(r(c, 'vantagem_proxima_pericia')).toBe(0);
  });

  it('cobertura: meia=+2, 3/4=+5, total=imune', () => {
    const meia = { ...base, omniFlags: { cobertura_meia: 1 } } as unknown as Character;
    expect(r(meia, 'bonus_defesa_cobertura')).toBe(2);
    expect(r(meia, 'imune_por_cobertura')).toBe(0);

    const tq = { ...base, omniFlags: { cobertura_tres_quartos: 1 } } as unknown as Character;
    expect(r(tq, 'bonus_defesa_cobertura')).toBe(5);

    const tot = { ...base, omniFlags: { cobertura_total: 1 } } as unknown as Character;
    expect(r(tot, 'imune_por_cobertura')).toBe(1);
  });

  it('arma principal: alcance e crítico (Espada Curta, crit 19)', () => {
    const c = { ...base, mainHandWeaponName: 'Espada Curta' } as Character;
    expect(r(c, 'arma_principal_alcance')).toBe(1.5);
    expect(r(c, 'arma_principal_crit_range')).toBe(19);
    expect(r(c, 'arma_principal_crit_ampliado')).toBe(1);
  });

  it('reações usadas na rodada', () => {
    const c = { ...base, reactionsMax: 2, reactionsCurrent: 0 } as Character;
    expect(r(c, 'reacoes_usadas_nesta_rodada')).toBe(2);
  });
});
