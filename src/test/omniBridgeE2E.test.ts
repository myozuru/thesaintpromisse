/**
 * 🧪 Auditoria E2E do OmniBridge — passivas vinculadas → ficha real.
 *
 * Para CADA recurso/chave que o Mestre pode digitar como `resourcePath`,
 * cria uma passiva Omni que aplica +X naquela chave e verifica se o
 * `selectOmniPassiveBonuses` realmente coloca o bônus no campo certo.
 *
 * Esses testes detectam DEAD KEYS na ponte (parecidas com o bug que o
 * Diego reportou: passiva ia pro inventário, não pro personagem; depois,
 * passivas vinculadas não somavam no HP/TR).
 */
import { describe, it, expect } from 'vitest';
import {
  selectOmniPassiveBonuses,
  selectOmniModifiers,
  resolverAcumuloOmni,
  resolveOmniKey,
  avaliarFormulaNaFicha,
  avaliarFormulaNaFichaDetalhada,
} from '@/lib/omni/omniBridge';
import { coletarMitigacoesDano, listarDiagnosticosMitigacaoDano } from '@/lib/omni/mitigacoesDano';
import { novaEntidade } from '@/lib/omni/tipos';
import { PacoteOmniSchema } from '@/lib/omni/validacao';
import type { Character } from '@/types';
import type { EntidadeOmni, CombatEffect } from '@/lib/omni/tipos';
import { effectiveMovement, combatMoveBudget, reactionMoveBudget } from '@/lib/movementBudget';
import { computeDefenseBreakdown } from '@/lib/defenseCalc';
import { derivarPassivasContinuas } from '@/lib/omni/passivasDerivadas';
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { ORDEM_PERICIAS, SISTEMA_PERICIAS, ORDEM_TR, SISTEMA_TR } from '@/lib/omni/constantesDoSistema';

// ─── Cobaia padronizada ──────────────────────────────────────────────────
const baseCobaia = (): Character => ({
  id: 'e2e',
  name: 'E2E',
  level: 5,
  trainingBonus: 3,
  hpCurrent: 30, hpMax: 40,
  peCurrent: 10, peMax: 20,
  ca: 12,
  movement: 9,
  attributes: [
    { id: 'forca',         name: 'Força',         value: 4, externalBonus: 0, mastery: false },
    { id: 'destreza',      name: 'Destreza',      value: 3, externalBonus: 0, mastery: false },
    { id: 'constituicao',  name: 'Constituição',  value: 2, externalBonus: 0, mastery: false },
    { id: 'inteligencia',  name: 'Inteligência',  value: 5, externalBonus: 0, mastery: false },
    { id: 'sabedoria',     name: 'Sabedoria',     value: 1, externalBonus: 0, mastery: false },
    { id: 'presenca',      name: 'Presença',      value: 0, externalBonus: 0, mastery: false },
  ],
  skills: ORDEM_PERICIAS.map((k, i) => ({
    id: SISTEMA_PERICIAS[k].replace(/^pericias\./, ''),
    name: k.toLowerCase(),
    value: i + 1, externalBonus: 0, mastery: false,
  })),
  savingThrows: ORDEM_TR.map((k, i) => ({
    id: SISTEMA_TR[k],
    name: k.charAt(0) + k.slice(1).toLowerCase(),
    value: (i + 1) * 2, externalBonus: 0, mastery: false,
  })),
} as unknown as Character);

// ─── Construtor de passiva pronta ───────────────────────────────────────
function fazerPassiva(opts: {
  nome: string;
  resourcePath: string;
  formula: string;
  type?: CombatEffect['type'];
}): EntidadeOmni {
  const ent = novaEntidade('passiva', opts.nome);
  ent.combatData = {
      critRange: 20,
      critMultiplier: 2,
    isActive: false,
    effects: [],
    effectsActive: [],
    effectsPassive: [{
      id: 'eff-1',
      formula: opts.formula,
      type: opts.type ?? 'ADICIONAR',
      target: 'USUARIO',
      resourcePath: opts.resourcePath,
    }],
  };
  return ent;
}

// ────────────────────────────────────────────────────────────────────────
// 1. Recursos passivos clássicos (hp/pe/ca/rd/esc)
// ────────────────────────────────────────────────────────────────────────
describe('🌉 OmniBridge E2E — Recursos passivos via passiva vinculada', () => {
  const casos: Array<[string /*nome*/, string /*resourcePath*/, 'hp'|'pe'|'ca'|'rd'|'esc'|'slots']> = [
    ['Fonte Vital',   'vida_max',      'hp'],
    ['Fonte Vital2',  'hp_max',        'hp'],
    ['Fonte Vital3',  'status.vida.max','hp'],
    ['Pulso Maldito', 'energia_max',   'pe'],
    ['Pulso Maldito2','pe_max',        'pe'],
    ['Pulso Maldito3','status.energiaAmaldicoada.max', 'pe'],
    ['Pele de Aço',   'defesa',        'ca'],
    ['Pele de Aço2',  'ca',            'ca'],
    ['Pele de Aço3',  'status.defesa', 'ca'],
    ['Reflexo Élfico','esquiva',       'esc'],
    ['Couraça',       'rd',            'rd'],
    ['Couraça2',      'reducao_dano',  'rd'],
    ['Mochila',       'slots',         'slots'],
  ];

  it.each(casos)('%s → "%s" injeta no slot %s', (nome, path, slot) => {
    const c = baseCobaia();
    const p = fazerPassiva({ nome, resourcePath: path, formula: '7' });
    const bag = selectOmniPassiveBonuses(c, [p]);
    expect(bag.totals[slot]).toBe(7);
    expect(bag.origins[slot].some((o) => o.source.includes(nome))).toBe(true);
  });

  it('SUBTRAIR aplica sinal negativo', () => {
    const c = baseCobaia();
    const p = fazerPassiva({ nome: 'Fragilidade', resourcePath: 'vida_max', formula: '5', type: 'SUBTRAIR' });
    const bag = selectOmniPassiveBonuses(c, [p]);
    expect(bag.totals.hp).toBe(-5);
  });

  it('Fórmula com @TREINO escala dinamicamente', () => {
    const c = baseCobaia(); // trainingBonus = 3
    const p = fazerPassiva({ nome: 'Crescer', resourcePath: 'vida_max', formula: '@TREINO * 2' });
    const bag = selectOmniPassiveBonuses(c, [p]);
    expect(bag.totals.hp).toBe(6);
  });

  it('Múltiplas fontes usam o maior bônus concorrente e mantêm todas as origens', () => {
    const c = baseCobaia();
    const a = fazerPassiva({ nome: 'A', resourcePath: 'vida_max', formula: '4' });
    const b = fazerPassiva({ nome: 'B', resourcePath: 'hp_max',   formula: '6' });
    const bag = selectOmniPassiveBonuses(c, [a, b]);
    expect(bag.totals.hp).toBe(6);
    expect(bag.origins.hp).toHaveLength(2);
    expect(bag.origins.hp.map((origin) => origin.applied)).toEqual([false, true]);
  });

  it('penalidades de fontes distintas continuam somando ao maior bônus', () => {
    const c = baseCobaia();
    const bonus = fazerPassiva({ nome: 'Amuleto', resourcePath: 'defesa', formula: '5' });
    const penalty = fazerPassiva({ nome: 'Maldição', resourcePath: 'ca', formula: '2', type: 'SUBTRAIR' });
    const bag = selectOmniPassiveBonuses(c, [bonus, penalty]);
    expect(bag.totals.ca).toBe(3);
    expect(bag.origins.ca.map((origin) => origin.applied)).toEqual([true, true]);
  });

  it('mantém o máximo ao combinar equipamentos e passivas calculados em bags separados', () => {
    const c = baseCobaia();
    const linked = fazerPassiva({ nome: 'Postura', resourcePath: 'defesa', formula: '3' });
    const gear = novaEntidade('item', 'Broche');
    gear.slotType = 'anel';
    gear.bonusEquipado = { ca: 5 };
    const linkedBag = selectOmniPassiveBonuses(c, [linked]);
    const gearBag = selectOmniModifiers(c, [{ instanceId: 'broche', equippedSlot: 'anel:0', entity: gear }]);
    const contributions = [...linkedBag.origins.ca, ...gearBag.origins.ca];

    expect(resolverAcumuloOmni(contributions)).toBe(5);
    expect(contributions.map((origin) => origin.applied)).toEqual([false, true]);
  });

  it('a defesa real combina passiva vinculada e equipamento sem somar os bônus concorrentes', () => {
    const linked = fazerPassiva({ nome: 'Postura', resourcePath: 'defesa', formula: '3' });
    const gear = novaEntidade('item', 'Broche');
    gear.slotType = 'anel';
    gear.bonusEquipado = { ca: 5 };
    const c = {
      ...baseCobaia(),
      omniAtivos: [{ categoria: 'passiva', entidadeId: linked.id }],
    } as Character;
    const result = computeDefenseBreakdown(c, {
      omniEntidadesMap: { [linked.id]: linked },
      omniInventory: [{ instanceId: 'broche', ownerId: c.id, isEquipped: true, entity: gear }],
    });

    expect(result.omniPassivesCA + result.omniItemsCA).toBe(5);
    expect(result.total).toBe(12 + 2 + 5);
  });

  it('Watcher NÃO entra como bônus passivo (é reação)', () => {
    const c = baseCobaia();
    const ent = novaEntidade('passiva', 'Reação');
    ent.combatData = {
      critRange: 20,
      critMultiplier: 2,
      isActive: false, effects: [], effectsActive: [],
      effectsPassive: [{
        id: 'w', formula: '10', type: 'ADICIONAR', target: 'USUARIO',
        resourcePath: 'vida_max',
        watcher: { resource: 'vida_atual', op: '<=', threshold: 0.5, percent: true },
      }],
    };
    const bag = selectOmniPassiveBonuses(c, [ent]);
    expect(bag.totals.hp).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────
// 2. Testes de Resistência (5 TRs)
// ────────────────────────────────────────────────────────────────────────
describe('🌉 OmniBridge E2E — TRs via passiva vinculada', () => {
  const trCasos: Array<[string, 'integridade'|'vontade'|'fortitude'|'reflexos'|'astucia']> = [
    ['integridade', 'integridade'],
    ['vontade',     'vontade'],
    ['fortitude',   'fortitude'],
    ['reflexos',    'reflexos'],
    ['astucia',     'astucia'],
    // variações que o Mestre pode escrever
    ['Vontade',     'vontade'],
    ['INTEGRIDADE', 'integridade'],
    ['tr.fortitude','fortitude'],
  ];
  it.each(trCasos)('resourcePath="%s" injeta em rollTotals.%s', (path, key) => {
    const c = baseCobaia();
    const p = fazerPassiva({ nome: `Bônus ${path}`, resourcePath: path, formula: '4' });
    const bag = selectOmniPassiveBonuses(c, [p]);
    expect(bag.rollTotals[key]).toBe(4);
  });

  it('TRs e recursos podem coexistir na mesma passiva', () => {
    const c = baseCobaia();
    const ent = novaEntidade('passiva', 'Combo');
    ent.combatData = {
      critRange: 20,
      critMultiplier: 2,
      isActive: false, effects: [], effectsActive: [],
      effectsPassive: [
        { id: 'a', formula: '10', type: 'ADICIONAR', target: 'USUARIO', resourcePath: 'vida_max' },
        { id: 'b', formula: '2',  type: 'ADICIONAR', target: 'USUARIO', resourcePath: 'fortitude' },
      ],
    };
    const bag = selectOmniPassiveBonuses(c, [ent]);
    expect(bag.totals.hp).toBe(10);
    expect(bag.rollTotals.fortitude).toBe(2);
  });
});

// ────────────────────────────────────────────────────────────────────────
// 3. resolveOmniKey — leitura direta do estado da ficha
// ────────────────────────────────────────────────────────────────────────
describe('🌉 OmniBridge E2E — resolveOmniKey (leitura)', () => {
  const c = baseCobaia();
  const casos: Array<[string, number]> = [
    ['vida_max', 40], ['hp_max', 40], ['status.vida.max', 40],
    ['vida', 30], ['vida_atual', 30],
    ['pe_max', 20], ['energia_max', 20],
    ['pe', 10], ['energia', 10],
    ['defesa', 12], ['ca', 12],
    ['deslocamento', 9],
    ['treino', 3], ['bonus_treinamento', 3],
    ['nivel', 5], ['level', 5],
    ['forca', 4], ['for', 4], ['FOR', 4],
    ['destreza', 3], ['des', 3],
    ['constituicao', 2], ['Constituição', 2],
    ['presenca', 0], ['pre', 0],
    ['inteligencia', 5],
    ['fortitude', 4], ['integridade', 6], ['vontade', 10], ['astucia', 2], ['reflexos', 8],
    ['pericia_feiticaria', 5], // 5ª da lista (1-indexed)
  ];
  it.each(casos)('resolveOmniKey("%s") → %i', (k, v) => {
    expect(resolveOmniKey(c, k)).toBe(v);
  });
});

// ────────────────────────────────────────────────────────────────────────
// 4. avaliarFormulaNaFicha — fórmulas com @USUARIO e dados
// ────────────────────────────────────────────────────────────────────────
describe('🌉 OmniBridge E2E — avaliarFormulaNaFicha', () => {
  const c = baseCobaia();
  it('@USUARIO.forca + @TREINO', () => {
    expect(avaliarFormulaNaFicha(c, '@USUARIO.forca + @TREINO')).toBe(7);
  });
  it('@NIVEL * 2', () => {
    expect(avaliarFormulaNaFicha(c, '@NIVEL * 2')).toBe(10);
  });
  it('fórmula vazia → 0 (não NaN)', () => {
    expect(avaliarFormulaNaFicha(c, '')).toBe(0);
    expect(avaliarFormulaNaFicha(c, undefined)).toBe(0);
  });
  it('expressão malformada não explode', () => {
    expect(avaliarFormulaNaFicha(c, '(((')).toBe(0);
  });
  it('a avaliação detalhada preserva o diagnóstico de uma key desconhecida', () => {
    const result = avaliarFormulaNaFichaDetalhada(c, '@USUARIO.chave_inexistente + 2');
    expect(result.value).toBe(0);
    expect(result.diagnostics.join(' ')).toMatch(/chave_inexistente/i);
    expect(avaliarFormulaNaFicha(c, '@USUARIO.chave_inexistente + 2')).toBe(0);
  });
});


describe('Bônus de perícias e TR em itens equipados', () => {
  it('soma bônus por perícia e TR somente em itens equipados e preserva origens', () => {
    const c = baseCobaia();
    const item = novaEntidade('item', 'Broche do Especialista');
    item.slotType = 'anel';
    item.bonusEquipado = { pericias: { atletismo: 2 }, trs: { reflexos: 1 } };
    const bag = selectOmniModifiers(c, [{ instanceId: 'i1', equippedSlot: 'anel:0', entity: item }]);
    expect(bag.pericias.atletismo).toBe(2);
    expect(bag.trs.reflexos).toBe(1);
    expect(bag.periciaOrigins.atletismo[0].source).toContain(item.nome);
    expect(selectOmniModifiers(c, []).pericias.atletismo).toBeUndefined();
  });
  it('aplica deslocamento equipado ao orçamento normal, sobrecarregado e de reação', () => {
    const c = baseCobaia();
    const item = novaEntidade('item', 'Botas de Velocidade'); item.slotType = 'pes';
    item.bonusEquipado = { deslocamento: 3 };
    const bag = selectOmniModifiers(c, [{ instanceId: 'botas', equippedSlot: 'pes', entity: item }]);
    expect(bag.deslocamento).toBe(3);
    expect(bag.deslocamentoOrigins[0].source).toContain(item.nome);
    const move = { movement: 9, slotsCurrent: 0, slotsMax: 10 };
    expect(combatMoveBudget(move, true, bag.deslocamento)).toBe(12);
    expect(effectiveMovement({ ...move, slotsCurrent: 11 }, bag.deslocamento)).toBe(6);
    expect(reactionMoveBudget({ ...move, mobilidadeReacaoBase: 3, mobilidadeReacaoM: 2 }, bag.deslocamento)).toBe(8);
    expect(selectOmniModifiers(c, []).deslocamento).toBe(0);
  });
  it('preserva bônus no importador Omni', () => {
    const item = novaEntidade('item', 'Amuleto'); item.slotType = 'colar';
    item.bonusEquipado = { pericias: { furtividade: 2 }, trs: { vontade: 1 }, deslocamento: 3 };
    const pacote = PacoteOmniSchema.parse({ formato: 'omni-engine.v1', nome: 'Teste', geradoEm: 1, entidades: [item] });
    expect(pacote.entidades[0].bonusEquipado).toEqual(item.bonusEquipado);
  });
});


describe('Fórmulas de bônus equipado para perícias, TRs e deslocamento', () => {
  it('avalia fórmulas com o estado atual da ficha e soma bônus fixos', () => {
    const c = baseCobaia();
    const item = novaEntidade('item', 'Manto Adaptativo');
    item.slotType = 'anel';
    item.bonusEquipado = {
      deslocamento: 1,
      pericias: { furtividade: 1 },
      trs: { reflexos: 1 },
    };
    item.bonusEquipadoFormula = {
      deslocamento: '@USUARIO.treino',
      pericias: { furtividade: '@USUARIO.treino - 2' },
      trs: { reflexos: '@USUARIO.treino - 1' },
    };

    const bag = selectOmniModifiers(c, [{ instanceId: 'formula-1', equippedSlot: 'anel:0', entity: item }]);
    expect(bag.deslocamento).toBe(4);
    expect(bag.pericias.furtividade).toBe(2);
    expect(bag.trs.reflexos).toBe(3);
    expect(bag.periciaOrigins.furtividade.map((origin) => origin.source)).toEqual([expect.stringContaining(item.nome)]);
    expect(bag.trOrigins.reflexos?.map((origin) => origin.source)).toEqual([expect.stringContaining(item.nome)]);
  });

  it('ignora fórmulas de itens que não estão equipados', () => {
    const c = baseCobaia();
    const item = novaEntidade('item', 'Botas guardadas');
    item.slotType = 'pes';
    item.bonusEquipadoFormula = { deslocamento: '10', pericias: { atletismo: '5' }, trs: { vontade: '4' } };
    const bag = selectOmniModifiers(c, [{ instanceId: 'stored', equippedSlot: null, entity: item }]);
    expect(bag.deslocamento).toBe(0);
    expect(bag.pericias.atletismo).toBeUndefined();
    expect(bag.trs.vontade).toBeUndefined();
  });

  it('não deriva bônus para perícias fora do catálogo oficial', () => {
    const c = baseCobaia();
    const item = novaEntidade('item', 'Caderno de Adestramento');
    item.slotType = 'anel';
    item.bonusEquipado = { pericias: { adestramento: 3 } };
    item.bonusEquipadoFormula = { pericias: { adestramento: '@TREINO' } };

    const bag = selectOmniModifiers(c, [{ instanceId: 'caderno', equippedSlot: 'anel:0', entity: item }]);
    expect(bag.pericias).toEqual({});
    expect(bag.periciaOrigins).toEqual({});
  });

  it('preserva as fórmulas no pacote importado', () => {
    const item = novaEntidade('item', 'Anel escalável');
    item.slotType = 'anel';
    item.bonusEquipadoFormula = {
      deslocamento: '@NIVEL / 2',
      pericias: { atletismo: '@TREINO' },
      trs: { vontade: '@TREINO + 1' },
    };
    const pacote = PacoteOmniSchema.parse({ formato: 'omni-engine.v1', nome: 'Teste', geradoEm: 1, entidades: [item] });
    expect(pacote.entidades[0].bonusEquipadoFormula).toEqual(item.bonusEquipadoFormula);
  });
});

describe('Diagnósticos de bônus Omni passivos', () => {
  it('mantém a parte fixa válida e aponta a fórmula inválida do item equipado', () => {
    const c = baseCobaia();
    const item = novaEntidade('item', 'Anel de Rancor');
    item.slotType = 'anel';
    item.bonusEquipado = { ca: 2 };
    item.bonusEquipadoFormula = { ca: '@USUARIO.key_que_nao_existe' };
    item.combatData = {
      critRange: 20,
      critMultiplier: 2,
      isActive: false,
      effects: [],
      effectsActive: [],
      effectsPassive: [{ id: 'ca-valida', type: 'ADICIONAR', target: 'USUARIO', resourcePath: 'ca', formula: '3' }],
    };

    const bag = selectOmniModifiers(c, [{ instanceId: 'anel', equippedSlot: 'anel:0', entity: item }]);
    expect(bag.totals.ca).toBe(5);
    expect(bag.formulaDiagnostics).toContainEqual(expect.objectContaining({
      source: `◇ ${item.nome}`,
      key: 'ca',
      formula: '@USUARIO.key_que_nao_existe',
    }));
  });

  it('não rerrola dados aleatórios como modificador passivo a cada recálculo', () => {
    const c = baseCobaia();
    const item = novaEntidade('item', 'Anel Instável');
    item.slotType = 'anel';
    item.bonusEquipadoFormula = { ca: '1d6' };

    const bag = selectOmniModifiers(c, [{ instanceId: 'anel', equippedSlot: 'anel:0', entity: item }]);
    expect(bag.totals.ca).toBe(0);
    expect(bag.formulaDiagnostics).toContainEqual(expect.objectContaining({
      source: `◇ ${item.nome}`,
      key: 'ca',
      formula: '1d6',
      message: expect.stringContaining('rola dados'),
    }));
  });

  it('aponta fórmula e key de perícia inválidas no item equipado', () => {
    const c = baseCobaia();
    const item = novaEntidade('item', 'Inscrição falha');
    item.slotType = 'anel';
    item.bonusEquipadoFormula = {
      pericias: {
        adestramento: '@USUARIO.treino',
        furtividade: '@USUARIO.foco_inexistente',
      },
    };
    const bag = selectOmniModifiers(c, [{ instanceId: 'inscricao', equippedSlot: 'anel:0', entity: item }]);

    expect(bag.formulaDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'adestramento', message: expect.stringContaining('não reconhecida') }),
      expect.objectContaining({ key: 'furtividade', formula: '@USUARIO.foco_inexistente' }),
    ]));
  });

  it('não descarta em silêncio uma condição inválida de bônus em TR', () => {
    const c = baseCobaia();
    const passiva = fazerPassiva({ nome: 'Guarda', resourcePath: 'fortitude', formula: '2' });
    passiva.combatData!.effectsPassive![0].condition = '@USUARIO.condicao_inexistente > 0';
    const bag = selectOmniPassiveBonuses(c, [passiva]);

    expect(bag.rollTotals.fortitude).toBeUndefined();
    expect(bag.formulaDiagnostics).toContainEqual(expect.objectContaining({
      source: `✦ ${passiva.nome}`,
      key: 'fortitude',
      formula: '@USUARIO.condicao_inexistente > 0',
      message: expect.stringContaining('Condição inválida'),
    }));
  });
});

describe('Mitigações passivas com keys inválidas', () => {
  it('ignora condições/fórmulas inválidas e aleatórias, mas mantém mitigação válida e explica os erros', () => {
    const ent = novaEntidade('passiva', 'Manto Prismático');
    ent.combatData = {
      critRange: 20,
      critMultiplier: 2,
      isActive: false,
      effects: [],
      effectsActive: [],
      effectsPassive: [
        { id: 'condicao', type: 'ADICIONAR', target: 'USUARIO', resourcePath: 'resistencia_fogo', formula: '1', condition: '@USUARIO.sem_essa_key > 0' },
        { id: 'formula', type: 'ADICIONAR', target: 'USUARIO', resourcePath: 'vulnerabilidade_veneno', formula: '@USUARIO.key_inexistente' },
        { id: 'dado', type: 'ADICIONAR', target: 'USUARIO', resourcePath: 'imunidade_impacto', formula: '1d6' },
        { id: 'tipo', type: 'ADICIONAR', target: 'USUARIO', resourcePath: 'resistencia_dano_impossivel', formula: '1' },
        { id: 'valida', type: 'ADICIONAR', target: 'USUARIO', resourcePath: 'resistencia_psiquico', formula: '1' },
      ],
    };
    useOmniEntidadesStore.setState({ entidades: { [ent.id]: ent } });
    useInventoryStore.setState({ items: {} });
    const personagem = {
      ...baseCobaia(),
      omniAtivos: [{ id: 'manto', entidadeId: ent.id, categoria: 'passiva' as const, instanceId: ent.id, vinculadoEm: 0 }],
    } as Character;

    const mitigacoes = coletarMitigacoesDano(personagem);
    expect(mitigacoes.resistencia).toEqual(['DPS']);
    expect(mitigacoes.vulnerabilidade).toEqual([]);
    expect(mitigacoes.imunidade).toEqual([]);

    const diagnostics = listarDiagnosticosMitigacaoDano(personagem);
    expect(diagnostics).toHaveLength(4);
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'resistencia_fogo', message: expect.stringContaining('Condição inválida') }),
      expect.objectContaining({ key: 'vulnerabilidade_veneno', formula: '@USUARIO.key_inexistente' }),
      expect.objectContaining({ key: 'imunidade_impacto', message: expect.stringContaining('rola dados') }),
      expect.objectContaining({ key: 'resistencia_dano_impossivel', message: expect.stringContaining('não reconhecido') }),
    ]));
  });
});

describe('Passivas contínuas condicionais', () => {
  it('recalcula o bônus quando a condição muda e respeita acúmulo por perícia', () => {
    const c = baseCobaia();
    const base = novaEntidade('passiva', 'Postura');
    const condicional = novaEntidade('aura', 'Aura de Foco');
    const penalidade = novaEntidade('talento', 'Ferimento');
    for (const ent of [base, condicional, penalidade]) {
      ent.combatData = { critRange: 20, critMultiplier: 2, isActive: false, effects: [], effectsActive: [], effectsPassive: [] };
    }
    base.combatData!.effectsPassive = [{ id: 'base', type: 'ADICIONAR', target: 'USUARIO', resourcePath: 'pericia_atletismo', formula: '3' }];
    condicional.combatData!.effectsPassive = [{ id: 'bonus', type: 'ADICIONAR', target: 'USUARIO', resourcePath: 'pericia_atletismo', formula: '5', condition: '@USUARIO.forca >= 4' }];
    penalidade.combatData!.effectsPassive = [{ id: 'penalty', type: 'SUBTRAIR', target: 'USUARIO', resourcePath: 'pericia_atletismo', formula: '1' }];
    useOmniEntidadesStore.setState({ entidades: Object.fromEntries([base, condicional, penalidade].map((ent) => [ent.id, ent])) });
    const vinculo = (entidadeId: string) => ({ id: entidadeId, entidadeId, categoria: 'passiva' as const, instanceId: entidadeId, vinculadoEm: 0 });
    const personagem = { ...c, omniAtivos: [vinculo(base.id), vinculo(condicional.id), vinculo(penalidade.id)] } as Character;

    expect(derivarPassivasContinuas(personagem).skillBonuses.atletismo).toBe(4);
    const forcaMenor = { ...personagem, attributes: personagem.attributes.map((attr) => attr.id === 'forca' ? { ...attr, value: 3 } : attr) };
    expect(derivarPassivasContinuas(forcaMenor).skillBonuses.atletismo).toBe(2);
  });

  it('não aplica bônus nem redução quando condição ou fórmula referencia key desconhecida', () => {
    const c = baseCobaia();
    const passiva = novaEntidade('passiva', 'Inscrição ilegível');
    passiva.combatData = {
      critRange: 20,
      critMultiplier: 2,
      isActive: false,
      effects: [],
      effectsActive: [],
      effectsPassive: [
        {
          id: 'condicao-invalida',
          type: 'ADICIONAR',
          target: 'USUARIO',
          resourcePath: 'pericia_atletismo',
          formula: '4',
          condition: '@USUARIO.chave_inexistente + 1 > 0',
        },
        {
          id: 'formula-pericia-invalida',
          type: 'ADICIONAR',
          target: 'USUARIO',
          resourcePath: 'pericia_furtividade',
          formula: '@USUARIO.chave_inexistente + 4',
        },
        {
          id: 'formula-reducao-invalida',
          type: 'MODIFICADOR',
          target: 'USUARIO',
          resourcePath: 'pe',
          formula: '@USUARIO.chave_inexistente + 4',
          peSpellReduction: { filtro: 'tipo:damage', min: 1 },
        },
        {
          id: 'pericia-inexistente',
          type: 'ADICIONAR',
          target: 'USUARIO',
          resourcePath: 'pericia_adestramento',
          formula: '8',
        },
      ],
    };
    useOmniEntidadesStore.setState({ entidades: { [passiva.id]: passiva } });
    const personagem = {
      ...c,
      omniAtivos: [{ id: passiva.id, entidadeId: passiva.id, categoria: 'passiva' as const, instanceId: passiva.id, vinculadoEm: 0 }],
    } as Character;

    const vars = montarVariaveisDoPersonagem(personagem, 'USUARIO');
    expect(avaliarFormula('@USUARIO.chave_inexistente + 1 > 0', vars)).toMatchObject({
      valor: 1,
      diagnosticos: [expect.objectContaining({ tipo: 'chave_ausente' })],
    });
    expect(avaliarFormula('@USUARIO.chave_inexistente + 4', vars)).toMatchObject({
      valor: 4,
      diagnosticos: [expect.objectContaining({ tipo: 'chave_ausente' })],
    });

    const derivados = derivarPassivasContinuas(personagem);
    expect(derivados).toMatchObject({
      skillBonuses: {},
      peReductions: [],
      immunities: [],
    });
    expect(derivados.diagnostics).toHaveLength(4);
    expect(derivados.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'condicao', message: expect.stringContaining('Condição inválida') }),
      expect.objectContaining({ key: 'pericia_furtividade', formula: '@USUARIO.chave_inexistente + 4' }),
      expect.objectContaining({ key: 'reducao_custo_pe', formula: '@USUARIO.chave_inexistente + 4' }),
      expect.objectContaining({ key: 'pericia_adestramento', message: expect.stringContaining('não reconhecida') }),
    ]));
  });

  it('diagnostica dados em fórmula contínua mesmo com a condição atualmente falsa', () => {
    const c = baseCobaia();
    const passiva = novaEntidade('passiva', 'Marca Instável');
    passiva.combatData = {
      critRange: 20,
      critMultiplier: 2,
      isActive: false,
      effects: [],
      effectsActive: [],
      effectsPassive: [{
        id: 'dice',
        type: 'ADICIONAR',
        target: 'USUARIO',
        resourcePath: 'pericia_atletismo',
        formula: '1d6',
        condition: '@USUARIO.forca < 0',
      }],
    };
    useOmniEntidadesStore.setState({ entidades: { [passiva.id]: passiva } });
    const personagem = {
      ...c,
      omniAtivos: [{ id: passiva.id, entidadeId: passiva.id, categoria: 'passiva' as const, instanceId: passiva.id, vinculadoEm: 0 }],
    } as Character;

    const derivados = derivarPassivasContinuas(personagem);
    expect(derivados.skillBonuses).toEqual({});
    expect(derivados.diagnostics).toContainEqual(expect.objectContaining({
      key: 'pericia_atletismo',
      formula: '1d6',
      message: expect.stringContaining('rola dados'),
    }));
  });
});
