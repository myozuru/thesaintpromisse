/**
 * 🔍 Auditoria das NOVAS keys (Pacotes Recursos, Combate Avançado,
 * Estado, Equipamento, Cena Tática, Talentos/Aptidões/Habilidades,
 * Predicates de Posse e Contadores).
 *
 * Cada chave é testada com:
 *   1. Resolução via @USUARIO.<atalho_pt> (parser + atalhos pt-BR)
 *   2. Resolução via @USUARIO.<KEY_CANONICA> (uppercase direto)
 *   3. Variante prefixada (USUARIO_KEY) presente no bag
 *   4. Valor numérico esperado (não silenciosamente 0 quando o campo foi preenchido)
 */
import { describe, it, expect } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import type { Character } from '@/types';

// Cobaia totalmente preenchida com valores únicos para que qualquer
// "0" detecte uma chave fantasma.
const cobaia: Character = {
  id: 'audit-new-1',
  name: 'Cobaia Keys Novas',
  level: 5,
  trainingBonus: 7,
  hpCurrent: 41, hpMax: 50,
  peCurrent: 21, peMax: 30,
  ca: 14,
  movement: 9,
  attributes: [
    { id: 'forca',         name: 'Força',         value: 4, externalBonus: 0, mastery: false },
    { id: 'destreza',      name: 'Destreza',      value: 3, externalBonus: 0, mastery: false },
    { id: 'constituicao',  name: 'Constituição',  value: 2, externalBonus: 0, mastery: false },
    { id: 'inteligencia',  name: 'Inteligência',  value: 5, externalBonus: 0, mastery: false },
    { id: 'sabedoria',     name: 'Sabedoria',     value: 7, externalBonus: 0, mastery: false },
    { id: 'presenca',      name: 'Presença',      value: 8, externalBonus: 0, mastery: false },
  ],
  // Recursos & Pools
  tempPE: 6,
  luckCurrent: 4, luckMax: 8,
  hitDiceCurrent: 3, hitDiceMax: 5,
  economiaPEReserve: 12,
  // Sobrevivência
  exhaustionLevel: 2,
  hunger: 3,
  // Combate avançado
  initiativeBonus: 5,
  attention: 11,
  actionsMax: 2, actionsCurrent: 1,
  bonusActionsCurrent: 1,
  reactionsMax: 1, reactionsCurrent: 1,
  opportunityMax: 4, opportunityCurrent: 3,
  // Estado físico
  sizeCategory: 'Grande',
  dying: true,
  // Especialização
  empolgacaoLevel: 3,
  maxConcentrationSlots: 4,
  maxSustainedSpells: 3,
  bonusReleaseSlots: 2,
  aptitudeOnlyTempPE: 5,
  lastSpellUsedId: 'feiticoX',
  // Aptidões
  cursedAptitudes: { AU: 2, CL: 3, BAR: 4, DOM: 5, ER: 6 } as Character['cursedAptitudes'],
  chosenAuraAptitudes: ['aptA', 'aptB'],
  chosenClAptitudes: ['cl1'],
  chosenAptitudes: ['ap-x'],
  // Habilidades spec
  chosenSpecAbilities: [
    { abilityId: 'hab1', chosenAtLevel: 3 },
    { abilityId: 'hab2', chosenAtLevel: 5 },
  ],
  // Talentos (incluindo um de "combate" pra contador)
  chosenTalents: [
    { id: 'combate_basico', level: 1 },
    { id: 'arma_focada',    level: 2 },
    { id: 'mente_aguda',    level: 3 },
  ],
  category: 'PLAYER' as Character['category'],
  omniFlags: { bloqueio_total: 1, custom_flag: 42 },
} as unknown as Character;

const vars = montarVariaveisDoPersonagem(cobaia, 'USUARIO');
const get = (k: string) => avaliarFormula(`@USUARIO.${k}`, vars).valor;

// ────────────────────────────────────────────────────────────────────
describe('🩺 Recursos & Pools', () => {
  const casos: Array<[string, number]> = [
    ['vida_temp', 0],         // tempHp não definido → 0
    ['vida_pct', 82],         // 41/50 = 82%
    ['energia_pct', 70],      // 21/30 = 70%
    ['pe_pct', 70],
    ['pe_temp', 6],
    ['sorte', 4],
    ['sorte_atual', 4],
    ['sorte_max', 8],
    ['dado_vida', 3],
    ['dado_vida_atual', 3],
    ['dado_vida_max', 5],
    ['reserva_pe', 12],
    ['reserva_pe_atual', 12],
    ['reserva_pe_max', 12],
  ];
  it.each(casos)('@USUARIO.%s → %i', (k, v) => expect(get(k)).toBe(v));
});

describe('🍖 Sobrevivência', () => {
  it('exaustao_nivel', () => expect(get('exaustao_nivel')).toBe(2));
  it('fome', () => expect(get('fome')).toBe(3));
  it('fome_nivel', () => expect(get('fome_nivel')).toBe(3));
});

describe('⚔️ Combate Avançado — Defesa & Iniciativa', () => {
  it('defesa_cac', () => expect(get('defesa_cac')).toBe(14));
  it('defesa_dist', () => expect(get('defesa_dist')).toBe(14));
  it('iniciativa', () => expect(get('iniciativa')).toBe(5));
  it('atencao', () => expect(get('atencao')).toBe(11));
});

describe('🎯 Economia de Ações', () => {
  it('ataques_no_turno', () => expect(get('ataques_no_turno')).toBe(2));
  it('ataques_restantes', () => expect(get('ataques_restantes')).toBe(1));
  it('acao_restante', () => expect(get('acao_restante')).toBe(1));
  it('acoes_restantes', () => expect(get('acoes_restantes')).toBe(1));
  it('acao_bonus', () => expect(get('acao_bonus')).toBe(1));
  it('ado_max', () => expect(get('ado_max')).toBe(4));
  it('ado_restantes', () => expect(get('ado_restantes')).toBe(3));
  it('reacao_disponivel = 1', () => expect(get('reacao_disponivel')).toBe(1));
  it('movimento_restante', () => expect(get('movimento_restante')).toBe(9));
});

describe('🧍 Estado Físico', () => {
  it('tamanho (Grande → 3)', () => expect(get('tamanho')).toBe(3));
  it('morrendo = 1', () => expect(get('morrendo')).toBe(1));
  it('esta_morrendo = 1', () => expect(get('esta_morrendo')).toBe(1));
  it('morto = 0 (vida > 0 ou exaustão != 6)', () => expect(get('morto')).toBe(0));
  it('inconsciente = 0', () => expect(get('inconsciente')).toBe(0));
});

describe('🎒 Equipamento & Categoria', () => {
  it('escudo_equipado é finito', () => expect(Number.isFinite(get('escudo_equipado'))).toBe(true));
  it('categoria (PLAYER → 1)', () => expect(get('categoria')).toBe(1));
});

describe('🔮 Especialização', () => {
  it('concentrando = 1 (tem lastSpellUsedId)', () => expect(get('concentrando')).toBe(1));
  it('empolgacao', () => expect(get('empolgacao')).toBe(3));
  it('empolgacao_nivel', () => expect(get('empolgacao_nivel')).toBe(3));
  it('max_concentracao', () => expect(get('max_concentracao')).toBe(4));
  it('max_sustentados', () => expect(get('max_sustentados')).toBe(3));
  it('slots_liberacao_bonus', () => expect(get('slots_liberacao_bonus')).toBe(2));
  it('pe_temp_por_rodada', () => expect(get('pe_temp_por_rodada')).toBe(5));
});

describe('🌍 Cena Tática', () => {
  it('rodada e rodadas_em_combate são finitos', () => {
    expect(Number.isFinite(get('rodada'))).toBe(true);
    expect(Number.isFinite(get('rodadas_em_combate'))).toBe(true);
  });
});

describe('🌟 Talentos expostos (agregador real)', () => {
  for (const k of [
    'escudo_proficiente', 'dual_wield_def', 'movimento_bonus_metros',
    'vigor_maldito_bonus', 'suporte_lv2_unlocked', 'rd_alma',
    'atencao_bonus', 'tr_vs_debuff_defesa_bonus', 'grupos_critico_arma',
  ]) {
    it(`@USUARIO.${k} é número finito`, () => expect(Number.isFinite(get(k))).toBe(true));
  }
});

describe('✨ Aura / Aptidões', () => {
  it('au', () => expect(get('au')).toBe(2));
  it('cl', () => expect(get('cl')).toBe(3));
  it('bar', () => expect(get('bar')).toBe(4));
  it('dom', () => expect(get('dom')).toBe(5));
  it('er', () => expect(get('er')).toBe(6));
  for (const k of ['aura_ca_bonus', 'aura_rd_fisica', 'aura_furtividade_bonus', 'aura_agarrar_bonus']) {
    it(`@USUARIO.${k} é número finito`, () => expect(Number.isFinite(get(k))).toBe(true));
  }
});

describe('🔢 Contadores por tipo', () => {
  it('qtd_talentos = 3', () => expect(get('qtd_talentos')).toBe(3));
  it('qtd_aptidoes = aura(2) + cl(1) = 3', () => expect(get('qtd_aptidoes')).toBe(3));
  it('qtd_habilidades = 2', () => expect(get('qtd_habilidades')).toBe(2));
  it('qtd_talentos_combate ≥ 2 (combate_basico, arma_focada)', () => {
    expect(get('qtd_talentos_combate')).toBeGreaterThanOrEqual(2);
  });
  it('qtd_aptidoes_aura = 2', () => expect(get('qtd_aptidoes_aura')).toBe(2));
  it('qtd_habilidades_spec = 2', () => expect(get('qtd_habilidades_spec')).toBe(2));
});

describe('🔎 Predicates de posse (TEM_TALENTO_/TEM_APTIDAO_/TEM_HABILIDADE_)', () => {
  it('TEM_TALENTO_COMBATE_BASICO = 1', () => {
    expect(vars.TEM_TALENTO_COMBATE_BASICO).toBe(1);
  });
  it('TEM_TALENTO_ARMA_FOCADA = 1', () => {
    expect(vars.TEM_TALENTO_ARMA_FOCADA).toBe(1);
  });
  it('talento inexistente não vira chave', () => {
    expect(vars.TEM_TALENTO_FANTASMA).toBeUndefined();
  });
  it('TEM_APTIDAO_APTA = 1 (aura aptitude)', () => {
    expect(vars.TEM_APTIDAO_APTA).toBe(1);
  });
  it('TEM_APTIDAO_CL1 = 1 (cl aptitude)', () => {
    expect(vars.TEM_APTIDAO_CL1).toBe(1);
  });
  it('TEM_APTIDAO_AP_X = 1 (chosenAptitudes, hifen virou _)', () => {
    expect(vars.TEM_APTIDAO_AP_X).toBe(1);
  });
  it('TEM_HABILIDADE_HAB1 = 1', () => {
    expect(vars.TEM_HABILIDADE_HAB1).toBe(1);
  });
  it('TEM_HABILIDADE_HAB2 = 1', () => {
    expect(vars.TEM_HABILIDADE_HAB2).toBe(1);
  });
});

describe('🏷️ omniFlags genéricas', () => {
  it('flag custom é exposta em UPPERCASE', () => {
    expect(vars.CUSTOM_FLAG).toBe(42);
  });
  it('bloqueio_total exposto', () => {
    expect(vars.BLOQUEIO_TOTAL).toBe(1);
  });
});

describe('🧬 Espelhamento prefixado USUARIO_*', () => {
  const checagens = [
    'VIDA_TEMP', 'VIDA_PCT', 'PE_TEMP', 'SORTE', 'SORTE_MAX',
    'DADO_VIDA_MAX', 'RESERVA_PE', 'EXAUSTAO_NIVEL', 'FOME',
    'INICIATIVA', 'ATENCAO', 'ATAQUES_NO_TURNO', 'ACOES_RESTANTES',
    'REACAO_DISPONIVEL', 'MOVIMENTO_RESTANTE', 'TAMANHO',
    'MORRENDO', 'CATEGORIA', 'EMPOLGACAO', 'MAX_CONCENTRACAO',
    'AU', 'CL', 'BAR', 'DOM', 'ER',
    'QTD_TALENTOS', 'QTD_APTIDOES', 'QTD_HABILIDADES',
    'QTD_TALENTOS_COMBATE', 'QTD_APTIDOES_AURA', 'QTD_HABILIDADES_SPEC',
  ];
  it.each(checagens)('USUARIO_%s espelha a chave nua', (k) => {
    expect(vars[`USUARIO_${k}`]).toBe(vars[k]);
  });
});

describe('🧮 Variantes pt-BR (parser)', () => {
  // Testamos que cada atalho pt-BR resolve igual à canônica via parser.
  const pares: Array<[string, string]> = [
    ['vidatemp', 'vida_temp'],
    ['vida_temporaria', 'vida_temp'],
    ['vidapct', 'vida_pct'],
    ['porcentagem_vida', 'vida_pct'],
    ['porcentagem_pe', 'pe_pct'],
    ['energiapct', 'energia_pct'],
    ['dadovida', 'dado_vida'],
    ['reservape', 'reserva_pe'],
    ['defesa_corpo', 'defesa_cac'],
    ['defesa_distancia', 'defesa_dist'],
    ['concentrando_em', 'concentrando'],
  ];
  it.each(pares)('@USUARIO.%s ≡ @USUARIO.%s', (a, b) => {
    expect(get(a)).toBe(get(b));
  });
});
