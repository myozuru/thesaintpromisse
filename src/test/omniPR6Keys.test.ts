/**
 * PR-6 — Auditoria: Cura / Recursos Avançados.
 */
import { describe, it, expect } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import type { Character } from '@/types';

const base: Character = {
  id: 'hero-pr6',
  name: 'Hero',
  level: 3,
  trainingBonus: 2,
  hpCurrent: 12, hpMax: 20,
  peCurrent: 5, peMax: 10,
  ca: 10, movement: 9,
  category: 'PLAYER',
  actionsCurrent: 1, bonusActionsCurrent: 1,
  hitDiceCurrent: 2, hitDiceMax: 3,
  vigorMalditoUses: 2, vigorMalditoMax: 3,
  hpSacrificedTotal: 4,
  attributes: [], skills: [], savingThrows: [],
  omniCounters: {
    cura_recebida: 7,
    cura_recebida_nesta_rodada: 12,
    ultimo_dano_recebido: 5,
    dano_recebido_nesta_rodada: 8,
  },
} as unknown as Character;

const r = (c: Character, key: string) =>
  avaliarFormula(`@USUARIO.${key}`, montarVariaveisDoPersonagem(c)).valor;

describe('PR-6 — Cura & Recursos Avançados', () => {
  it('cura: pode_ser_curado / vida_faltante / pct', () => {
    expect(r(base, 'pode_ser_curado')).toBe(1);
    expect(r(base, 'vida_faltante')).toBe(8);
    expect(r(base, 'vida_faltante_pct')).toBe(40);
  });

  it('cura/dano por rodada via omniCounters', () => {
    expect(r(base, 'cura_recebida')).toBe(7);
    expect(r(base, 'cura_recebida_nesta_rodada')).toBe(12);
    expect(r(base, 'ultimo_dano_recebido')).toBe(5);
    expect(r(base, 'dano_recebido_nesta_rodada')).toBe(8);
    expect(r(base, 'vida_perdida_nesta_rodada')).toBe(8);
  });

  it('economia de ações: disponíveis', () => {
    expect(r(base, 'acao_disponivel')).toBe(1);
    expect(r(base, 'bonus_acao_disponivel')).toBe(1);
    expect(r(base, 'movimento_disponivel')).toBe(1);
    const sem = { ...base, actionsCurrent: 0, bonusActionsCurrent: 0, movement: 0 } as Character;
    expect(r(sem, 'acao_disponivel')).toBe(0);
    expect(r(sem, 'bonus_acao_disponivel')).toBe(0);
    expect(r(sem, 'movimento_disponivel')).toBe(0);
  });

  it('descanso curto (hit dice)', () => {
    expect(r(base, 'slots_descanso_curto')).toBe(2);
    expect(r(base, 'slots_descanso_curto_max')).toBe(3);
    expect(r(base, 'slots_descanso_curto_pct')).toBe(67);
  });

  it('vigor maldito', () => {
    expect(r(base, 'vigor_maldito_usos')).toBe(2);
    expect(r(base, 'vigor_maldito_max')).toBe(3);
    expect(r(base, 'vigor_maldito_disponivel')).toBe(1);
  });

  it('sacrifício pela energia', () => {
    expect(r(base, 'hp_sacrificado')).toBe(4);
    expect(r(base, 'sacrificio_pct')).toBe(20);
  });

  it('vida cheia → pode_ser_curado=0', () => {
    const full = { ...base, hpCurrent: 20 } as Character;
    expect(r(full, 'pode_ser_curado')).toBe(0);
    expect(r(full, 'vida_faltante')).toBe(0);
  });
});
