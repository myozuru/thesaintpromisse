/**
 * PR-9 — Auditoria: Meta / Narrativa (combate, iniciativa, cronômetro).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { useCombatStore } from '@/stores/useCombatStore';
import type { Character } from '@/types';

const hero: Character = {
  id: 'hero-pr9',
  name: 'Hero',
  level: 3, trainingBonus: 2,
  hpCurrent: 20, hpMax: 20,
  peCurrent: 10, peMax: 10,
  ca: 10, movement: 9,
  category: 'PLAYER',
  attributes: [], skills: [], savingThrows: [],
  omniFlags: { f1: 1, f2: 0 },
  omniCounters: { c1: 5 },
} as unknown as Character;

const r = (c: Character, key: string) =>
  avaliarFormula(`@USUARIO.${key}`, montarVariaveisDoPersonagem(c)).valor;

describe('PR-9 — Meta & Narrativa', () => {
  beforeEach(() => {
    useCombatStore.setState({
      inCombat: false, round: 1, currentTurnIndex: 0,
      initiativeOrder: [], movementUsedByChar: {},
      turnTimerEnabled: false, turnDurationSec: 60,
      turnRemainingAtStart: 60, turnStartedAt: 0, turnPaused: true,
    } as never);
  });

  it('fora de combate → defaults zerados', () => {
    expect(r(hero, 'em_combate')).toBe(0);
    expect(r(hero, 'eh_meu_turno')).toBe(0);
    expect(r(hero, 'ordem_na_iniciativa')).toBe(0);
    expect(r(hero, 'qtd_participantes_combate')).toBe(0);
  });

  it('introspecção: qtd_flags / contadores Omni', () => {
    expect(r(hero, 'qtd_flags_omni')).toBe(2);
    expect(r(hero, 'qtd_contadores_omni')).toBe(1);
  });

  it('em combate: posição, turno, iniciativa', () => {
    useCombatStore.setState({
      inCombat: true, round: 3, currentTurnIndex: 1,
      initiativeOrder: [
        { charId: 'foe1', charName: 'Foe', roll: 18, bonus: 2, total: 20 },
        { charId: 'hero-pr9', charName: 'Hero', roll: 12, bonus: 3, total: 15 },
        { charId: 'foe2', charName: 'Foe2', roll: 9, bonus: 1, total: 10 },
      ],
      movementUsedByChar: { 'hero-pr9': 4 },
    } as never);
    expect(r(hero, 'em_combate')).toBe(1);
    expect(r(hero, 'numero_da_rodada')).toBe(3);
    expect(r(hero, 'ordem_na_iniciativa')).toBe(2);
    expect(r(hero, 'eh_meu_turno')).toBe(1);
    expect(r(hero, 'iniciativa_total')).toBe(15);
    expect(r(hero, 'iniciativa_bonus')).toBe(3);
    expect(r(hero, 'iniciativa_rolagem')).toBe(12);
    expect(r(hero, 'qtd_participantes_combate')).toBe(3);
    expect(r(hero, 'turnos_ate_meu')).toBe(0);
    expect(r(hero, 'metros_movidos_combate')).toBe(4);
  });

  it('próximo no turno detectado', () => {
    useCombatStore.setState({
      inCombat: true, round: 1, currentTurnIndex: 0,
      initiativeOrder: [
        { charId: 'foe1', charName: 'Foe', roll: 15, bonus: 0, total: 15 },
        { charId: 'hero-pr9', charName: 'Hero', roll: 10, bonus: 0, total: 10 },
      ],
    } as never);
    expect(r(hero, 'eh_meu_turno')).toBe(0);
    expect(r(hero, 'proximo_no_turno')).toBe(1);
    expect(r(hero, 'ultimo_no_turno')).toBe(1);
    expect(r(hero, 'turnos_ate_meu')).toBe(1);
  });

  it('cronômetro pausado expõe duração e estado', () => {
    useCombatStore.setState({
      turnTimerEnabled: true, turnDurationSec: 90,
      turnRemainingAtStart: 90, turnPaused: true, turnStartedAt: 0,
    } as never);
    expect(r(hero, 'turno_cronometro_ativo')).toBe(1);
    expect(r(hero, 'turno_duracao_seg')).toBe(90);
    expect(r(hero, 'turno_pausado')).toBe(1);
    expect(r(hero, 'turno_segundos_restantes')).toBe(90);
  });
});
