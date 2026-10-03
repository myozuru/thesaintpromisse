import { describe, expect, it } from 'vitest';
import { DICIONARIO_CHAVES_OMNI, ALIASES_FORMULA } from '@/lib/omni/constantesDoSistema';
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { useCombatStore } from '@/stores/useCombatStore';
import { DEFAULT_SAVING_THROWS, ORIGINS, SPECIALIZATIONS, type Character } from '@/types';
import { buildDefaultAttributes, buildDefaultSkills } from '@/lib/defaults';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { novaEntidade } from '@/lib/omni/tipos';

const usuario = {
  id: 'catalog-user', name: 'Catálogo', level: 5, trainingBonus: 3,
  hpCurrent: 31, hpMax: 43, peCurrent: 7, peMax: 19, escCurrent: 2, escMax: 5,
  ca: 14, movement: 9, category: 'PLAYER',
  attributes: buildDefaultAttributes(), skills: buildDefaultSkills([]), savingThrows: DEFAULT_SAVING_THROWS.map(name => ({ id: name, name, value: 0 })),
  omniFlags: {}, omniCounters: {}, chosenTalents: [], chosenAuraAptitudes: [],
  chosenSpecAbilities: [], spells: [], activeConditions: [],
} as unknown as Character;
const alvo = { ...usuario, id: 'catalog-target', hpCurrent: 17, peCurrent: 11 };
const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

if (process.env.OMNI_AUDIT_SUMMARY === '1') {
  const itens = DICIONARIO_CHAVES_OMNI.flatMap(g => g.itens);
  console.info('OMNI_AUDIT_SUMMARY', JSON.stringify({ grupos: DICIONARIO_CHAVES_OMNI.length, opcoes: itens.length, estaticas: itens.filter(i => !i.id.includes('<')).length, templates: itens.filter(i => i.id.includes('<')).length, referencias: DICIONARIO_CHAVES_OMNI.reduce((n, g) => n + g.itens.filter(i => !i.id.includes('<')).length * g.escopos.length, 0), aliases: Object.keys(ALIASES_FORMULA).length }));
}

function contexto() {
  useCombatStore.setState({ inCombat: true, round: 4, currentTurnIndex: 0, initiativeOrder: [{ charId: usuario.id }] } as never);
  return {
    vars: { ...montarVariaveisDoPersonagem(usuario, 'USUARIO'), ...montarVariaveisDoPersonagem(alvo, 'ALVO'), DANO: 11 },
    extras: {
      // Campos que pertencem a uma execução específica, não à ficha.
      cena: { dt: 19, distancia: 4.5, no_mapa: 1, sujeito_eh_aliado: 1, outro_eh_inimigo: 0, outro_eh_aliado: 1, outro_eh_voce: 0, consumido: 2, dano: 11 },
      item: { usos_restantes: 2, usos_totais: 5 },
      dano: { tipo: 7, fonte: 3, foi_critico: 0, foi_falha_critica: 0, valor_inicial: 11, valor_final: 8, absorvido: 3, id_origem: 1, id_alvo: 1, alcance: 4.5, foi_ataque_oportunidade: 0, foi_furtivo: 0, tipo_ataque: 1 },
    },
  };
}

describe('Catálogo completo: keys estáticas avaliadas em seus escopos reais', () => {
  it('toda opção estática resolve sem diagnóstico de fallback', () => {
    const { vars, extras } = contexto();
    const falhas: string[] = [];
    for (const grupo of DICIONARIO_CHAVES_OMNI) for (const item of grupo.itens) {
      if (item.id.includes('<')) continue;
      for (const escopo of grupo.escopos) {
        const ref = escopo === 'NENHUM' ? `@${item.id}` : `@${escopo}.${item.id}`;
        const r = avaliarFormula(ref, vars, undefined, extras);
        if (!Number.isFinite(r.valor) || r.diagnosticos.length) falhas.push(`${grupo.grupo}: ${ref} — ${r.diagnosticos.map(d => d.tipo).join(', ')}`);
      }
    }
    expect(falhas).toEqual([]);
  });
  it('aliases oficiais também têm um valor disponível', () => {
    const { vars, extras } = contexto();
    const falhas = Object.keys(ALIASES_FORMULA).filter(alias => avaliarFormula(`@${alias}`, vars, undefined, extras).diagnosticos.length);
    expect(falhas).toEqual([]);
  });
});

describe('Contexto de cena e identidade: valores reais e compatibilidade', () => {
  it('todos os templates têm exemplos concretos em USUARIO e ALVO, sem fallback', () => {
    const ent = { ...novaEntidade('item', 'Catálogo'), id: 'item_audit' };
    useInventoryStore.setState({ items: { i: { instanceId: 'i', ownerId: usuario.id, entity: ent, acquiredAt: 0, isEquipped: true } } });
    useMoneyStore.setState({ wallets: [{ id: 'w', members: [usuario.id], balances: { yen: 15 }, isPersonal: true }] } as never);
    const c = { ...usuario, origin: 'Inato', specialization: 'Suporte', mainHandWeaponName: 'Espada Curta',
      omniCounters: { rancor: 5, rancor__fonte__alvo: 2 },
      chosenTalents: [{ id: 'tal_audit' }], chosenAuraAptitudes: ['apt_audit'], chosenSpecAbilities: [{ abilityId: 'hab_audit' }],
      activeConditions: [{ conditionId: 'atordoado', remainingRounds: 2, remainingTurns: 3, elapsedRounds: 4 }],
      spells: [{ id: 'feitico_audit', name: 'Teste', spellType: 'damage', damageType: 'Fogo', costPE: 1 }],
      activeBuffs: [{ spellName: 'buff_audit' }],
    } as unknown as Character;
    const exemplos: Record<string, [string, number]> = {
      'arma_grupo_<grupo>': ['arma_grupo_espada', 1], 'origem_<id>': ['origem_inato', 1],
      'especializacao_<id>': ['especializacao_suporte', 1],
      'condicao_rodadas_desde_<id>': ['condicao_rodadas_desde_atordoado', 4], 'condicao_tem_idade_<id>': ['condicao_tem_idade_atordoado', 1],
      'tem_condicao_<id>': ['tem_condicao_atordoado', 1], 'condicao_rodadas_restantes_<id>': ['condicao_rodadas_restantes_atordoado', 3],
      '<nome_do_contador>': ['rancor', 5], 'contador_<nome>': ['contador_rancor', 5], '<nome>__fonte__<id>': ['rancor__fonte__alvo', 2],
      'tem_talento_<id>': ['tem_talento_tal_audit', 1], 'tem_aptidao_<id>': ['tem_aptidao_apt_audit', 1], 'tem_habilidade_<id>': ['tem_habilidade_hab_audit', 1],
      'saldo_<moeda>': ['saldo_yen', 15], 'tem_moeda_<moeda>': ['tem_moeda_yen', 1],
      'tem_item_<id>': ['tem_item_item_audit', 1], 'equipado_<id>': ['equipado_item_audit', 1],
      'tem_feitico_<id>': ['tem_feitico_feitico_audit', 1], 'tem_buff_<nome>': ['tem_buff_buff_audit', 1], 'qtd_feiticos_tipo_<tipo>': ['qtd_feiticos_tipo_fogo', 1],
    };
    const templates = DICIONARIO_CHAVES_OMNI.flatMap(g => g.itens.filter(i => i.id.includes('<')));
    expect(templates.map(i => i.id).sort()).toEqual(Object.keys(exemplos).sort());
    for (const template of templates) for (const escopo of ['USUARIO', 'ALVO'] as const) {
      const [key, esperado] = exemplos[template.id];
      const r = avaliarFormula(`@${escopo}.${key}`, montarVariaveisDoPersonagem(c, escopo));
      expect(r.valor, `${escopo}.${key}`).toBe(esperado);
      expect(r.diagnosticos, key).toEqual([]);
    }
    useInventoryStore.setState({ items: {} });
    useMoneyStore.setState({ wallets: [] });
  });
  it('rodada e índice de turno pertencem à cena, sem virar IDs textuais', () => {
    contexto();
    useCombatStore.setState({ currentTurnIndex: 1, initiativeOrder: [{ charId: usuario.id }, { charId: alvo.id }] } as never);
    for (const c of [usuario, alvo]) {
      const vars = montarVariaveisDoPersonagem(c);
      for (const [key, valor] of [['rodada', 4], ['rodadas_em_combate', 4], ['turno_indice', 1], ['turno_de', 1]] as const) {
        const r = avaliarFormula(`@CENA.${key}`, vars);
        expect(r.valor).toBe(valor);
        expect(r.diagnosticos).toEqual([]);
      }
    }
    useCombatStore.setState({ inCombat: false });
    const vars = montarVariaveisDoPersonagem(usuario);
    expect(avaliarFormula('@CENA.rodadas_em_combate', vars).valor).toBe(0);
    expect(avaliarFormula('@CENA.turno_indice', vars).valor).toBe(-1);
  });
  it.each(ORIGINS)('origem textual %s gera predicate utilizável', origin => {
    const r = avaliarFormula(`@USUARIO.origem_${slug(origin)}`, montarVariaveisDoPersonagem({ ...usuario, origin }));
    expect(r.valor).toBe(1);
    expect(r.diagnosticos).toEqual([]);
  });
  it.each(SPECIALIZATIONS)('especialização textual %s gera predicate utilizável', specialization => {
    const r = avaliarFormula(`@ALVO.especializacao_${slug(specialization)}`, montarVariaveisDoPersonagem({ ...alvo, specialization }, 'ALVO'));
    expect(r.valor).toBe(1);
    expect(r.diagnosticos).toEqual([]);
  });
  it('mantém identidade legada com { id } e normalização antiga', () => {
    const c = { ...usuario, origin: { id: 'origem--antiga' }, specialization: { id: 'spec-antiga' } } as unknown as Character;
    const vars = montarVariaveisDoPersonagem(c);
    expect(avaliarFormula('@USUARIO.origem_origem__antiga', vars).valor).toBe(1);
    expect(avaliarFormula('@USUARIO.origem_origem_antiga', vars).valor).toBe(1);
    expect(avaliarFormula('@USUARIO.especializacao_spec_antiga', vars).valor).toBe(1);
  });
  it('contextos do evento continuam ausentes quando não são fornecidos', () => {
    const vars = montarVariaveisDoPersonagem(usuario);
    for (const ref of ['@DANO.valor_final', '@DANO.tipo', '@ITEM.usos_restantes', '@CENA.consumido']) {
      expect(avaliarFormula(ref, vars).diagnosticos[0].tipo).toBe('chave_ausente');
    }
  });
});
