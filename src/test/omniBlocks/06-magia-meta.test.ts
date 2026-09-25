/**
 * LOTE 6 — Corretude semântica (final, ~41 chaves)
 *   🔮 Magia / Técnicas
 *   🎬 Meta / Narrativa (combate, iniciativa, cronômetro)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetStores, makeChar, vEval } from './_helper';
import { useCombatStore } from '@/stores/useCombatStore';
import type { Character } from '@/types';

beforeEach(resetStores);

// ─── 🔮 Magia / Técnicas ───────────────────────────────────────────────
describe('Lote 6 — 🔮 Magia / Técnicas (~22)', () => {
  it('grimório vazio: contagens em zero', () => {
    const c = makeChar();
    expect(vEval(c, 'USUARIO', 'qtd_feiticos')).toBe(0);
    expect(vEval(c, 'USUARIO', 'qtd_feiticos_dano')).toBe(0);
    expect(vEval(c, 'USUARIO', 'pe_minimo_feitico')).toBe(0);
    expect(vEval(c, 'USUARIO', 'pe_maximo_feitico')).toBe(0);
    expect(vEval(c, 'USUARIO', 'tem_feitico_pronto')).toBe(0);
    expect(vEval(c, 'USUARIO', 'tem_ultimo_feitico')).toBe(0);
  });

  it('contagens por tipo + prontos + min/max PE + predicates', () => {
    const c = makeChar({
      spells: [
        { id: 'fireball', name: 'Fireball', spellType: 'damage',    costPE: 3, isPrepared: true,  damageType: 'Fogo' },
        { id: 'heal',     name: 'Heal',     spellType: 'heal',      costPE: 2, isPrepared: false, damageType: 'Cura' },
        { id: 'shield',   name: 'Shield',   spellType: 'buff',      costPE: 1, isPrepared: true },
        { id: 'curse',    name: 'Curse',    spellType: 'condition', costPE: 5, isPrepared: false },
        { id: 'icebolt',  name: 'Icebolt',  spellType: 'damage',    costPE: 4, isPrepared: false, damageType: 'Frio' },
      ],
      lastSpellUsedId: 'fireball',
    } as unknown as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'qtd_feiticos')).toBe(5);
    expect(vEval(c, 'USUARIO', 'qtd_feiticos_dano')).toBe(2);
    expect(vEval(c, 'USUARIO', 'qtd_feiticos_cura')).toBe(1);
    expect(vEval(c, 'USUARIO', 'qtd_feiticos_buff')).toBe(1);
    expect(vEval(c, 'USUARIO', 'qtd_feiticos_condicao')).toBe(1);
    expect(vEval(c, 'USUARIO', 'qtd_feiticos_prontos')).toBe(2);
    expect(vEval(c, 'USUARIO', 'tem_feitico_pronto')).toBe(1);
    expect(vEval(c, 'USUARIO', 'pe_minimo_feitico')).toBe(1);
    expect(vEval(c, 'USUARIO', 'pe_maximo_feitico')).toBe(5);
    expect(vEval(c, 'USUARIO', 'tem_ultimo_feitico')).toBe(1);
    // Predicates
    expect(vEval(c, 'USUARIO', 'tem_feitico_fireball')).toBe(1);
    expect(vEval(c, 'USUARIO', 'tem_feitico_inexistente')).toBe(0);
    expect(vEval(c, 'USUARIO', 'qtd_feiticos_elemento_fogo')).toBe(1);
    expect(vEval(c, 'USUARIO', 'qtd_feiticos_elemento_frio')).toBe(1);
  });

  it('buffs ativos / sustentados / PE por rodada / tem_buff_<id>', () => {
    const c = makeChar({
      activeBuffs: [
        { spellName: 'Shield Wall', isSustained: true,  peCostPerRound: 2 },
        { spellName: 'Haste',       isSustained: true,  peCostPerRound: 1 },
        { spellName: 'Bless',       isSustained: false, peCostPerRound: 0 },
      ],
    } as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'qtd_buffs_ativos')).toBe(3);
    expect(vEval(c, 'USUARIO', 'qtd_buffs_sustentados')).toBe(2);
    expect(vEval(c, 'USUARIO', 'pe_por_rodada_sustentado')).toBe(3);
    expect(vEval(c, 'USUARIO', 'tem_buff_shield_wall')).toBe(1);
    expect(vEval(c, 'USUARIO', 'tem_buff_bless')).toBe(1);
    expect(vEval(c, 'USUARIO', 'tem_buff_nada')).toBe(0);
  });

  it('spell_attack_bonus, técnica e foco', () => {
    const c = makeChar({
      spellAttackBonus: 4,
      tecnicaAmaldicoada: { nome: 'X' },
      tecnicaFundamentos: ['f1', 'f2', 'f3'],
      tecnicaFoco: 'Destruição',
    } as unknown as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'spell_attack_bonus')).toBe(4);
    expect(vEval(c, 'USUARIO', 'tecnica_amaldicoada_definida')).toBe(1);
    expect(vEval(c, 'USUARIO', 'qtd_fundamentos_tecnica')).toBe(3);
    expect(vEval(c, 'USUARIO', 'foco_destruicao')).toBe(1);
    expect(vEval(c, 'USUARIO', 'foco_economia')).toBe(0);
    expect(vEval(c, 'USUARIO', 'foco_refino')).toBe(0);

    const eco = makeChar({ tecnicaFoco: 'Economia' } as Partial<Character>);
    expect(vEval(eco, 'USUARIO', 'foco_economia')).toBe(1);
    expect(vEval(eco, 'USUARIO', 'foco_destruicao')).toBe(0);
  });

  it('imbuir_armado / absorcao_armada / au_concentrada', () => {
    const c = makeChar({
      imbuedSpell: { name: 'Fireblade' },
      pendingAbsorbedElement: 'Fogo',
      concentratedAura: { au: 3 },
    } as unknown as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'imbuir_armado')).toBe(1);
    expect(vEval(c, 'USUARIO', 'absorcao_armada')).toBe(1);
    expect(vEval(c, 'USUARIO', 'au_concentrada')).toBe(3);
  });
});

// ─── 🎬 Meta / Narrativa ───────────────────────────────────────────────
describe('Lote 6 — 🎬 Meta / Narrativa (~19)', () => {
  it('fora de combate: tudo zerado, sozinho em initiative', () => {
    const c = makeChar();
    expect(vEval(c, 'USUARIO', 'em_combate')).toBe(0);
    expect(vEval(c, 'USUARIO', 'eh_meu_turno')).toBe(0);
    expect(vEval(c, 'USUARIO', 'ordem_na_iniciativa')).toBe(0);
    expect(vEval(c, 'USUARIO', 'qtd_participantes_combate')).toBe(0);
    expect(vEval(c, 'USUARIO', 'numero_da_rodada')).toBe(0);
  });

  it('em combate: iniciativa, turnos_ate_meu, proximo/ultimo', () => {
    useCombatStore.setState({
      inCombat: true,
      round: 3,
      currentTurnIndex: 0,
      initiativeOrder: [
        { charId: 'outro', roll: 15, bonus: 2, total: 17 },
        { charId: 'hero',  roll: 12, bonus: 3, total: 15 },
        { charId: 'last',  roll: 5,  bonus: 0, total: 5  },
      ],
      movementUsedByChar: { hero: 6 },
      turnTimerEnabled: false, turnDurationSec: 0,
      turnRemainingAtStart: 0, turnStartedAt: 0, turnPaused: false,
    } as never);
    const c = makeChar();
    expect(vEval(c, 'USUARIO', 'em_combate')).toBe(1);
    expect(vEval(c, 'USUARIO', 'numero_da_rodada')).toBe(3);
    expect(vEval(c, 'USUARIO', 'qtd_participantes_combate')).toBe(3);
    expect(vEval(c, 'USUARIO', 'ordem_na_iniciativa')).toBe(2);
    expect(vEval(c, 'USUARIO', 'eh_meu_turno')).toBe(0);
    expect(vEval(c, 'USUARIO', 'iniciativa_total')).toBe(15);
    expect(vEval(c, 'USUARIO', 'iniciativa_bonus')).toBe(3);
    expect(vEval(c, 'USUARIO', 'iniciativa_rolagem')).toBe(12);
    expect(vEval(c, 'USUARIO', 'turnos_ate_meu')).toBe(1);
    expect(vEval(c, 'USUARIO', 'proximo_no_turno')).toBe(1);
    expect(vEval(c, 'USUARIO', 'ultimo_no_turno')).toBe(0);
    expect(vEval(c, 'USUARIO', 'metros_movidos_combate')).toBe(6);
  });

  it('eh_meu_turno=1 quando currentTurnIndex aponta para mim; ultimo_no_turno=1 para último na ordem', () => {
    useCombatStore.setState({
      inCombat: true,
      round: 1,
      currentTurnIndex: 1,
      initiativeOrder: [
        { charId: 'outro', roll: 10, bonus: 0, total: 10 },
        { charId: 'hero',  roll: 8,  bonus: 1, total: 9  },
      ],
      movementUsedByChar: {},
      turnTimerEnabled: false, turnDurationSec: 0,
      turnRemainingAtStart: 0, turnStartedAt: 0, turnPaused: false,
    } as never);
    const c = makeChar();
    expect(vEval(c, 'USUARIO', 'eh_meu_turno')).toBe(1);
    expect(vEval(c, 'USUARIO', 'turnos_ate_meu')).toBe(0);
    expect(vEval(c, 'USUARIO', 'ultimo_no_turno')).toBe(1);
  });

  it('cronômetro de turno: ativo + pausado + segundos restantes', () => {
    useCombatStore.setState({
      inCombat: true,
      round: 1,
      currentTurnIndex: 0,
      initiativeOrder: [{ charId: 'hero', roll: 10, bonus: 0, total: 10 }],
      movementUsedByChar: {},
      turnTimerEnabled: true,
      turnDurationSec: 60,
      turnRemainingAtStart: 45,
      turnStartedAt: 0,   // pausado / não iniciado
      turnPaused: true,
    } as never);
    const c = makeChar();
    expect(vEval(c, 'USUARIO', 'turno_cronometro_ativo')).toBe(1);
    expect(vEval(c, 'USUARIO', 'turno_duracao_seg')).toBe(60);
    expect(vEval(c, 'USUARIO', 'turno_pausado')).toBe(1);
    // Pausado → mantém o restante "as is"
    expect(vEval(c, 'USUARIO', 'turno_segundos_restantes')).toBe(45);
  });

  it('qtd_flags_omni e qtd_contadores_omni contam chaves declaradas', () => {
    const c0 = makeChar();
    expect(vEval(c0, 'USUARIO', 'qtd_flags_omni')).toBe(0);
    expect(vEval(c0, 'USUARIO', 'qtd_contadores_omni')).toBe(0);

    const c = makeChar({
      omniFlags: { a: 1, b: 0, c: 1 },
      omniCounters: { x: 5, y: 10 },
    } as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'qtd_flags_omni')).toBe(3);
    expect(vEval(c, 'USUARIO', 'qtd_contadores_omni')).toBe(2);
  });
});
