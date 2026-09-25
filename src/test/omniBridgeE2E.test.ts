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
  resolveOmniKey,
  avaliarFormulaNaFicha,
} from '@/lib/omni/omniBridge';
import { novaEntidade } from '@/lib/omni/tipos';
import type { Character } from '@/types';
import type { EntidadeOmni, CombatEffect } from '@/lib/omni/tipos';
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

  it('Múltiplas passivas somam no mesmo recurso', () => {
    const c = baseCobaia();
    const a = fazerPassiva({ nome: 'A', resourcePath: 'vida_max', formula: '4' });
    const b = fazerPassiva({ nome: 'B', resourcePath: 'hp_max',   formula: '6' });
    const bag = selectOmniPassiveBonuses(c, [a, b]);
    expect(bag.totals.hp).toBe(10);
    expect(bag.origins.hp).toHaveLength(2);
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
});
