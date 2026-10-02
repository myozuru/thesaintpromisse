/**
 * Auditoria de RESPONSIVIDADE das novas chaves Omni (PR-1 .. PR-9).
 *
 * Diferente da auditoria de presença (`omniAllKeysAutomation`), este teste
 * prova que cada chave NOVA realmente *responde a estado*: ela não é apenas
 * um texto declarado no dicionário, mas reflete mudanças no `Character` ou
 * nas stores globais (combat / map / money / chronos / calendar / inventory
 * / opportunity).
 *
 * Estratégia: para cada chave, montamos DUAS bags — `baseline` (personagem
 * "vazio" + stores limpas) e `rich` (personagem com todos os campos relevantes
 * preenchidos + stores populadas). Uma chave é considerada **responsiva** se:
 *   (a) `rich !== baseline` (a chave reage a mudança de estado), OU
 *   (b) `rich !== 0` (a chave reflete um valor real do estado rico),
 * caso contrário ela é flagada como SUSPEITA ("just-text").
 */
import { describe, it, expect } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { DICIONARIO_CHAVES_OMNI } from '@/lib/omni/constantesDoSistema';
import { useCombatStore } from '@/stores/useCombatStore';
import { useOpportunityStore } from '@/stores/useOpportunityStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useMapStore } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import type { Character } from '@/types';

// Grupos introduzidos pelos PRs 1–9.
const GRUPOS_NOVOS = new Set<string>([
  '👁️ Visão & Iluminação',
  '⚡ AdO & Reações',
  '🗺️ Mapa & Distância',
  '🩹 Recursos Detalhados',
  '🗡️ Empunhadura',
  '🪪 Identidade',
  '🤕 Condições (ativas)',
  '🌀 Concentração & Sustentados',
  '💰 Economia',
  '🕰️ Tempo & Calendário',
  '🎒 Inventário',
  '🎯 Cena Tática',
  '🩹 Cura & Recursos Avançados',
  '⚔️ Combate Avançado (PR-7)',
  '🔮 Magia & Técnicas',
  '🎬 Meta & Narrativa',
]);

// ─── Cenário BASELINE (tudo zerado/vazio) ──────────────────────────────
const baseline: Character = {
  id: 'hero-base',
  name: 'Base',
  level: 1, trainingBonus: 1,
  hpCurrent: 10, hpMax: 10,
  peCurrent: 0, peMax: 0,
  ca: 10, movement: 0,
  category: 'PLAYER',
  attributes: [], skills: [], savingThrows: [],
  actionsCurrent: 0, bonusActionsCurrent: 0,
  reactionsCurrent: 1, reactionsMax: 1,
} as unknown as Character;

// ─── Cenário RICH (todos os campos populados) ──────────────────────────
const rich: Character = {
  id: 'hero-rich',
  name: 'Rich',
  level: 5, trainingBonus: 3,
  hpCurrent: 5, hpMax: 40, tempHp: 3,        // ~12% (bloodied + critico)
  peCurrent: 1, peMax: 10, tempPE: 2,        // ≤25%
  ca: 16, movement: 9,
  category: 'INIMIGO',                       // flip eh_player/eh_npc/eh_inimigo
  attributes: [], skills: [], savingThrows: [],
  reactionsCurrent: 0, reactionsMax: 2,      // reação usada
  actionsCurrent: 1, bonusActionsCurrent: 1, actionsMax: 2,
  opportunityCurrent: 1, opportunityMax: 2,
  initiativeBonus: 4, attention: 5,
  slotsCurrent: 20, slotsMax: 10,            // sobrecarregado
  mainHandWeaponName: 'Adaga', offHandWeaponName: 'Espada Curta',
  equippedShieldId: 'sh1',
  weaponSwapsThisTurn: 1, attacksThisTurn: 2,
  lastAttackHit: true,
  hitDiceCurrent: 2, hitDiceMax: 5,
  vigorMalditoUses: 2, vigorMalditoMax: 3,
  hpSacrificedTotal: 8,
  lastSpellUsedId: 'fb1',
  maxConcentrationSlots: 3, maxSustainedSpells: 4,
  spellAttackBonus: 4,
  tecnicaAmaldicoada: 'Fogo Maldito',
  tecnicaFundamentos: ['expansao', 'reversao'],
  tecnicaFoco: 'Destruição',
  imbuedSpell: { id: 'imb' },
  spells: [
    { id: 'fb1', name: 'Fireball', spellType: 'damage', costPE: 3, isPrepared: true, damageType: 'Fogo' },
    { id: 'cure1', name: 'Cure', spellType: 'heal', costPE: 1, isPrepared: false, damageType: 'Cura' },
    { id: 'buff1', name: 'Aura', spellType: 'buff', costPE: 2, isPrepared: true },
    { id: 'cond1', name: 'Slow', spellType: 'condition', costPE: 4 },
  ],
  activeBuffs: [
    { spellName: 'Aura', isSustained: true, durationRounds: -1, peCostPerRound: 1 },
    { spellName: 'Bless', isSustained: false, durationRounds: 3 },
  ],
  activeConditions: [
    { conditionId: 'atordoado' },
    { conditionId: 'apavorado' },
    { conditionId: 'caido' },
  ],
  omniFlags: {
    visao_normal: 1, visao_penumbra: 1, visao_escuridao: 1,
    esta_iluminado: 1, esta_oculto: 1, linha_de_visao: 1,
    atras_de_cobertura: 1, fonte_de_luz_ativa: 1,
    em_terreno_dificil: 1, voando: 1, prono: 1, agachado: 1, usou_corrida: 1,
    cobertura_meia: 0, cobertura_tres_quartos: 0, cobertura_total: 1,
  },
  omniCounters: {
    metros_movidos: 6, cura_recebida: 7, cura_recebida_nesta_rodada: 12,
    ultimo_dano_recebido: 5, dano_recebido_nesta_rodada: 8,
  },
  omniAdvMods: {
    a1: { kind: 'advantage', scope: 'next_attack' },
    a2: { kind: 'advantage', scope: 'next_save' },
    a3: { kind: 'advantage', scope: 'next_skill' },
    d1: { kind: 'disadvantage', scope: 'next_attack' },
    d2: { kind: 'disadvantage', scope: 'next_save' },
    d3: { kind: 'disadvantage', scope: 'next_skill' },
  },
} as unknown as Character;

// ─── BASELINE state: stores limpas ─────────────────────────────────────
function setupBaseline() {
  useCombatStore.setState({
    inCombat: false, round: 0, currentTurnIndex: 0,
    initiativeOrder: [], movementUsedByChar: {},
    turnTimerEnabled: false, turnDurationSec: 0,
    turnRemainingAtStart: 0, turnStartedAt: 0, turnPaused: false,
  } as never);
  useOpportunityStore.setState({ grants: {}, pending: null } as never);
  useMoneyStore.setState({
    currencies: [{ id: 'yen', name: 'Yen', symbol: '¥', isDefault: true }],
    wallets: [],
  } as never);
  useChronosStore.setState({
    hours: 0, minutes: 0, seconds: 0, day: 0, month: 0, year: 0,
    isRunning: false, multiplier: 1,
  } as never);
  useCalendarStore.setState({ events: [] } as never);
  useInventoryStore.setState({ items: {} } as never);
  useMapStore.setState({ entities: {} } as never);
  useCharacterStore.setState({ characters: [baseline] } as never);
}

// ─── RICH state: stores populadas ──────────────────────────────────────
function setupRich() {
  useCombatStore.setState({
    inCombat: true, round: 4, currentTurnIndex: 1,
    initiativeOrder: [
      { charId: 'ally', total: 20, bonus: 3, roll: 17 },
      { charId: 'hero-rich', total: 15, bonus: 4, roll: 11 },
      { charId: 'foe', total: 8, bonus: 1, roll: 7 },
    ],
    movementUsedByChar: { 'hero-rich': 6 },
    turnTimerEnabled: true, turnDurationSec: 60,
    turnRemainingAtStart: 45, turnStartedAt: Date.now(), turnPaused: false,
  } as never);
  useOpportunityStore.setState({
    grants: { 'hero-rich': { mode: 'either', consumed: false, restrictToCharId: 'foe' } },
    pending: null,
  } as never);
  useMoneyStore.setState({
    currencies: [{ id: 'yen', name: 'Yen', symbol: '¥', isDefault: true }],
    wallets: [
      { id: 'w1', name: 'Pessoal', members: ['hero-rich'], balances: { yen: 500 }, isPersonal: true },
      { id: 'w2', name: 'Grupo', members: ['hero-rich', 'ally'], balances: { yen: 200 }, isPersonal: false },
    ],
  } as never);
  useChronosStore.setState({
    hours: 14, minutes: 30, seconds: 15,
    day: 10, month: 6, year: 2025,
    isRunning: true, multiplier: 2,
  } as never);
  useCalendarStore.setState({
    events: [{ day: 10, month: 6, year: 2025, title: 'Festival' }],
  } as never);
  useInventoryStore.setState({
    items: {
      i1: { instanceId: 'i1', ownerId: 'hero-rich', entity: { id: 'sword' }, acquiredAt: 0, isEquipped: true },
      i2: { instanceId: 'i2', ownerId: 'hero-rich', entity: { id: 'potion' }, acquiredAt: 0, isEquipped: false },
    },
  } as never);
  useMapStore.setState({
    gridConfig: { ...useMapStore.getState().gridConfig, dpi: 1, metersPerCell: 1 },
    entities: {
      t1: { id: 't1', x: 0, y: 0, w: 1, h: 1, characterId: 'hero-rich', layer: 'tokens' },
      t2: { id: 't2', x: 1, y: 0, w: 1, h: 1, characterId: 'ally', layer: 'tokens' },
      t3: { id: 't3', x: 0, y: 1, w: 1, h: 1, characterId: 'foe1', layer: 'tokens' },
      t4: { id: 't4', x: 1, y: 1, w: 1, h: 1, characterId: 'foe2', layer: 'tokens' },
    },
  } as never);
  useCharacterStore.setState({
    characters: [
      rich,
      { id: 'ally', category: 'INIMIGO' } as unknown as Character, // aliado do INIMIGO
      { id: 'foe1', category: 'PLAYER' } as unknown as Character,  // inimigo do INIMIGO
      { id: 'foe2', category: 'PLAYER' } as unknown as Character,
    ],
  } as never);
}

// ─── Cenário ALT-RICH: estados mutuamente exclusivos com `rich` ──────
const altRich: Character = {
  ...rich,
  id: 'hero-alt',
  category: 'NPC',                                                   // eh_npc=1
  mainHandWeaponName: 'Arco Curto', offHandWeaponName: undefined,    // ranged + sem off
  lastAttackHit: false,                                              // ultimo_ataque_errou
  tecnicaFoco: 'Economia',                                           // foco_economia=1
  pendingAbsorbedElement: 'fogo',                                    // absorcao_armada=1
  concentratedAura: { au: 3 },                                       // au_concentrada=3
  activeConditions: [
    { conditionId: 'sangramento' }, { conditionId: 'paralisado' },
    { conditionId: 'amedrontado' }, { conditionId: 'agarrado' },
    { conditionId: 'cego' }, { conditionId: 'exposto' },
  ],
  omniFlags: {
    ...rich.omniFlags,
    cobertura_total: 0, cobertura_meia: 1, cobertura_tres_quartos: 1,
    cena_terreno: 1,
  },
  omniCounters: {
    ...rich.omniCounters,
    cena_distancia_xy: 5, cena_distancia_manhattan: 7, cena_elevacao_diff: 3,
  },
} as unknown as Character;

const altRich2: Character = {
  ...rich,
  id: 'hero-alt2',
  mainHandWeaponName: 'Espada Longa', offHandWeaponName: 'Espada Longa', // duas_maos + versatil
  tecnicaFoco: 'Refino',                                                  // foco_refino=1
} as unknown as Character;

const altRich3: Character = {
  ...rich,
  id: 'hero-alt3',
  mainHandWeaponName: 'Espada Grande',                                    // pesada
} as unknown as Character;

function setupAltRich() {
  setupRich();
  // amanhecer (6h) + cronômetro pausado + ado consumida + hero não é seu turno
  useChronosStore.setState({
    hours: 6, minutes: 0, seconds: 0, day: 10, month: 6, year: 2025,
    isRunning: true, multiplier: 1,
  } as never);
  useCombatStore.setState({
    inCombat: true, round: 4, currentTurnIndex: 0,
    initiativeOrder: [
      { charId: 'foe', total: 25, bonus: 5, roll: 20 },
      { charId: 'hero-alt', total: 15, bonus: 4, roll: 11 },
      { charId: 'ally', total: 5, bonus: 0, roll: 5 },
    ],
    movementUsedByChar: { 'hero-alt': 3 },
    turnTimerEnabled: true, turnDurationSec: 60,
    turnRemainingAtStart: 30, turnStartedAt: Date.now(), turnPaused: true,
  } as never);
  useOpportunityStore.setState({
    grants: { 'hero-alt': { mode: 'reaction', consumed: true } },
    pending: null,
  } as never);
}

function setupAltRich2() {
  setupRich();
  // anoitecer (19h); hero é o ÚLTIMO na ordem
  useChronosStore.setState({
    hours: 19, minutes: 0, seconds: 0, day: 10, month: 6, year: 2025,
    isRunning: true, multiplier: 1,
  } as never);
  useCombatStore.setState({
    inCombat: true, round: 4, currentTurnIndex: 1,
    initiativeOrder: [
      { charId: 'foe', total: 20, bonus: 4, roll: 16 },
      { charId: 'ally', total: 15, bonus: 2, roll: 13 },
      { charId: 'hero-alt2', total: 8, bonus: 1, roll: 7 },
    ],
    movementUsedByChar: { 'hero-alt2': 6 },
    turnTimerEnabled: true, turnDurationSec: 60,
    turnRemainingAtStart: 45, turnStartedAt: Date.now(), turnPaused: false,
  } as never);
}

interface Resultado { grupo: string; id: string; valores: number[]; }
const suspeitas: Resultado[] = [];

setupBaseline();
const bag0 = montarVariaveisDoPersonagem(baseline, 'USUARIO');
setupRich();
const bag1 = montarVariaveisDoPersonagem(rich, 'USUARIO');
setupAltRich();
const bag2 = montarVariaveisDoPersonagem(altRich, 'USUARIO');
setupAltRich2();
const bag3 = montarVariaveisDoPersonagem(altRich2, 'USUARIO');
setupRich();
const bag4 = montarVariaveisDoPersonagem(altRich3, 'USUARIO');

for (const cat of DICIONARIO_CHAVES_OMNI.filter(c => GRUPOS_NOVOS.has(c.grupo))) {
  for (const item of cat.itens) {
    if (item.id.includes('<')) continue;
    const escopo = cat.escopos[0];
    const expr = escopo === 'NENHUM'
      ? `@${item.id.toUpperCase()}`
      : `@${escopo}.${item.id}`;

    const valores = [
      avaliarFormula(expr, bag0).valor,
      avaliarFormula(expr, bag1).valor,
      avaliarFormula(expr, bag2).valor,
      avaliarFormula(expr, bag3).valor,
      avaliarFormula(expr, bag4).valor,
    ];
    // ESTRITO: exige VARIAÇÃO entre os 5 cenários — passagem fixa de flag
    // não conta como automação.
    const varia = new Set(valores).size > 1;
    if (!varia) {
      suspeitas.push({ grupo: cat.grupo, id: item.id, valores });
    }
  }
}

describe('Auditoria de Responsividade — chaves novas (PR-1..9) reagem ao estado', () => {
  it('toda chave nova produz valor responsivo em ao menos 1 cenário', () => {
    if (suspeitas.length > 0) {
      const byGroup = suspeitas.reduce<Record<string, Resultado[]>>((acc, r) => {
        (acc[r.grupo] ??= []).push(r);
        return acc;
      }, {});
      const relatorio = Object.entries(byGroup)
        .map(([g, rs]) => `\n  [${g}] (${rs.length}):\n    - ` +
          rs.map(r => `${r.id}  [base,rich,alt,alt2]=[${r.valores.join(',')}]`).join('\n    - '))
        .join('');
      throw new Error(`${suspeitas.length} chave(s) NÃO responsiva(s) (provável "só texto"):${relatorio}`);
    }
    expect(suspeitas).toHaveLength(0);
  });
});
