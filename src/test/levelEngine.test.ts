/**
 * Testes do motor de progressão: HP e PE retroativos.
 *
 * Cobre:
 *  - recalcHpMaxFromHistory (CON retroativo, multiplica TODOS os níveis)
 *  - recalcPeMaxFromHistory (atributo-chave soma 1× APENAS, não escala)
 *  - computeTecnicaPeMax (6*Nv + KeyMod)
 *  - Escolha rolagem vs média no Nv 1 (hpStartingBase) impactando HP
 */
import { describe, it, expect } from "vitest";
import {
  recalcHpMaxFromHistory,
  recalcPeMaxFromHistory,
  getAttrMod,
  type LevelHistoryEntry,
} from "@/lib/levelEngine";
import {
  computeTecnicaPeMax,
  getConjuracaoAprimoradaBonus,
  buildTecnicaTrackersForRange,
  computeEffectivePeCost,
  getDestruicaoDamageBonus,
  getRefinoCdAndAtkBonus,
} from "@/lib/tecnicaProgression";
import type { Attribute } from "@/types";

const attr = (name: string, value: number): Attribute =>
  ({ id: name, name, value } as Attribute);

describe("getAttrMod", () => {
  it("calcula modificador padrão D20", () => {
    expect(getAttrMod(8)).toBe(-1);
    expect(getAttrMod(10)).toBe(0);
    expect(getAttrMod(11)).toBe(0);
    expect(getAttrMod(14)).toBe(2);
    expect(getAttrMod(18)).toBe(4);
    expect(getAttrMod(20)).toBe(5);
  });
});

describe("recalcHpMaxFromHistory — CON retroativo", () => {
  it("Nv 1 (sem history): hpMax = base + conMod*1", () => {
    expect(recalcHpMaxFromHistory(10, [], 2, 1)).toBe(12);
  });

  it("CON+ aplicado HOJE multiplica em TODOS os níveis anteriores", () => {
    const history: LevelHistoryEntry[] = [
      { level: 2, hpRollBase: 5, conModSnapshot: 0 },
      { level: 3, hpRollBase: 6, conModSnapshot: 0 },
      { level: 4, hpRollBase: 4, conModSnapshot: 0 },
    ];
    // base 10, somas 5+6+4=15, conMod atual 3, level 4 => 10+15+3*4 = 37
    expect(recalcHpMaxFromHistory(10, history, 3, 4)).toBe(37);
    // Mesma history, agora CON desce p/ -1 (retroativo): 10+15+(-1)*4 = 21
    expect(recalcHpMaxFromHistory(10, history, -1, 4)).toBe(21);
  });

  it("rolagem vs média no Nv 2 muda PV final", () => {
    const baseAt1 = 10;
    const conMod = 1;
    // Rolou 8
    const histRoll: LevelHistoryEntry[] = [{ level: 2, hpRollBase: 8, conModSnapshot: 1 }];
    // Pegou média (5)
    const histAvg: LevelHistoryEntry[] = [{ level: 2, hpRollBase: 5, conModSnapshot: 1 }];
    expect(recalcHpMaxFromHistory(baseAt1, histRoll, conMod, 2)).toBe(20); // 10+8+1*2
    expect(recalcHpMaxFromHistory(baseAt1, histAvg, conMod, 2)).toBe(17);  // 10+5+1*2
  });

  it("nunca devolve menos que 1", () => {
    expect(recalcHpMaxFromHistory(1, [], -10, 1)).toBe(1);
  });
});

describe("recalcPeMaxFromHistory — atributo-chave soma 1× SOMENTE", () => {
  it("sem spec-chave (Lutador): keyMod = 0", () => {
    const attrs = [attr("Inteligência", 18)];
    // 0 + 0 + 0 = 0
    expect(recalcPeMaxFromHistory(0, 0, "Lutador", attrs)).toBe(0);
  });

  it("Especialista em Técnica usa Inteligência (uma única vez)", () => {
    const attrs = [attr("Inteligência", 18), attr("Sabedoria", 10)];
    // base 10 + ganhos 30 + INT mod (4) = 44 — não escala com nível
    expect(recalcPeMaxFromHistory(10, 30, "Especialista em Técnica", attrs)).toBe(44);
  });

  it("Controlador usa Sabedoria; Suporte usa Presença", () => {
    const attrs = [attr("Sabedoria", 16), attr("Presença", 14)];
    expect(recalcPeMaxFromHistory(10, 0, "Controlador", attrs)).toBe(13); // +3
    expect(recalcPeMaxFromHistory(10, 0, "Suporte", attrs)).toBe(12);     // +2
  });

  it("subir o atributo-chave NÃO multiplica por nível — apenas +delta", () => {
    const before = [attr("Inteligência", 14)]; // mod +2
    const after = [attr("Inteligência", 18)];  // mod +4
    const peBefore = recalcPeMaxFromHistory(10, 60, "Especialista em Técnica", before);
    const peAfter = recalcPeMaxFromHistory(10, 60, "Especialista em Técnica", after);
    expect(peAfter - peBefore).toBe(2); // só o delta de mod (+2), não +2*nível
  });
});

describe("computeTecnicaPeMax — 6*Nível + Mod_AtributoChave (teto INT/SAB)", () => {
  it("Nv 1 INT 18 → 6 + 4 = 10", () => {
    const attrs = [attr("Inteligência", 18)];
    expect(computeTecnicaPeMax(1, attrs, "Inteligência")).toBe(10);
  });

  it("Nv 5 SAB 16 → 30 + 3 = 33", () => {
    const attrs = [attr("Sabedoria", 16)];
    expect(computeTecnicaPeMax(5, attrs, "Sabedoria")).toBe(33);
  });

  it("Nv 20 INT 20 → 120 + 5 = 125", () => {
    const attrs = [attr("Inteligência", 20)];
    expect(computeTecnicaPeMax(20, attrs, "Inteligência")).toBe(125);
  });

  it("KeyAttr ausente → keyMod = 0", () => {
    expect(computeTecnicaPeMax(3, [], undefined)).toBe(18);
  });

  it("Aumentar INT recalcula em TODO nível atual (teto retroativo)", () => {
    const low = [attr("Inteligência", 12)];  // +1
    const high = [attr("Inteligência", 20)]; // +5
    expect(computeTecnicaPeMax(10, low, "Inteligência")).toBe(61);   // 60+1
    expect(computeTecnicaPeMax(10, high, "Inteligência")).toBe(65);  // 60+5
  });

  it("nunca negativo", () => {
    const attrs = [attr("Inteligência", 1)]; // mod -5
    expect(computeTecnicaPeMax(1, attrs, "Inteligência")).toBeGreaterThanOrEqual(0);
  });
});

describe("getConjuracaoAprimoradaBonus — tabela exata por nível de feitiço", () => {
  it("Nv 0 → 0 (não recebe bônus)", () => {
    expect(getConjuracaoAprimoradaBonus("0", 4, 10)).toBe(0);
  });
  it("Nv 1 → keyMod", () => {
    expect(getConjuracaoAprimoradaBonus("1", 4, 10)).toBe(4);
  });
  it("Nv 2 → keyMod", () => {
    expect(getConjuracaoAprimoradaBonus("2", 3, 7)).toBe(3);
  });
  it("Nv 3 → keyMod * 2", () => {
    expect(getConjuracaoAprimoradaBonus("3", 4, 10)).toBe(8);
  });
  it("Nv 4 → keyMod*2 + characterLevel", () => {
    expect(getConjuracaoAprimoradaBonus("4", 4, 10)).toBe(18); // 8+10
  });
  it("Nv 5 → keyMod*2 + characterLevel*2", () => {
    expect(getConjuracaoAprimoradaBonus("5", 4, 10)).toBe(28); // 8+20
  });
  it("Técnica Máxima → keyMod*3 + characterLevel*3", () => {
    expect(getConjuracaoAprimoradaBonus("Técnica Máxima", 4, 10)).toBe(42); // 12+30
  });
  it("Técnica Reversa → 0 (não recebe bônus)", () => {
    expect(getConjuracaoAprimoradaBonus("Técnica Reversa", 4, 10)).toBe(0);
  });
});

describe("buildTecnicaTrackersForRange — feitiço novo em TODO nível", () => {
  it("0→1 inclui 1 tecnica_extra_spell no Nv 1", () => {
    const trackers = buildTecnicaTrackersForRange(0, 1, false, false);
    const spellTrackers = trackers.filter(t => (t as any).kind === 'tecnica_extra_spell');
    expect(spellTrackers.length).toBe(1);
    expect(spellTrackers[0].level).toBe(1);
  });

  it("0→3 inclui tecnica_extra_spell em Nv 1, 2 e 3 (sem pular)", () => {
    const trackers = buildTecnicaTrackersForRange(0, 3, false, false);
    const levels = trackers
      .filter(t => (t as any).kind === 'tecnica_extra_spell')
      .map(t => t.level)
      .sort();
    expect(levels).toEqual([1, 2, 3]);
  });
});

// ============================================================================
//   Foco Amaldiçoado — helpers puros
// ============================================================================

const mkChar = (over: any = {}) => ({
  level: 1,
  characterClass: 'Feiticeiro',
  specialization: 'Especialista em Técnica',
  tecnicaFoco: undefined,
  activeConditions: [],
  ...over,
}) as any;

describe("computeEffectivePeCost — Economia / Honrado / Condenado", () => {
  it("sem foco: retorna costPE base (mais +1 se Condenado)", () => {
    const c = mkChar({ tecnicaFoco: undefined });
    expect(computeEffectivePeCost(c, { spellLevel: '2', costPE: 5 })).toBe(5);
    const c2 = mkChar({ activeConditions: [{ conditionId: 'condenado' }] });
    expect(computeEffectivePeCost(c2, { spellLevel: '2', costPE: 5 })).toBe(6);
  });

  it("Foco Economia, Nv 1, costPE=3 → 1 (3-2)", () => {
    const c = mkChar({ tecnicaFoco: 'Economia' });
    expect(computeEffectivePeCost(c, { spellLevel: '1', costPE: 3 })).toBe(1);
  });

  it("Foco Economia, Nv 1, costPE=2 → 0 (mínimo 0 só Nv 1)", () => {
    const c = mkChar({ tecnicaFoco: 'Economia' });
    expect(computeEffectivePeCost(c, { spellLevel: '1', costPE: 2 })).toBe(0);
  });

  it("Foco Economia, Nv 3, costPE=2 → 1 (mínimo 1 demais)", () => {
    const c = mkChar({ tecnicaFoco: 'Economia' });
    expect(computeEffectivePeCost(c, { spellLevel: '3', costPE: 2 })).toBe(1);
  });

  it("Honrado (Nv 20), feitiço Nv 2, costPE=5 → ceil(5/2)=3", () => {
    const c = mkChar({ level: 20 });
    expect(computeEffectivePeCost(c, { spellLevel: '2', costPE: 5 })).toBe(3);
  });

  it("Honrado + Economia: aplica Economia primeiro, depois divisor", () => {
    // Nv 2, costPE=8 → 8-2=6 → ceil(6/2)=3
    const c = mkChar({ level: 20, tecnicaFoco: 'Economia' });
    expect(computeEffectivePeCost(c, { spellLevel: '2', costPE: 8 })).toBe(3);
  });

  it("Nv 0 sempre 0, ignora todos os modificadores", () => {
    const c = mkChar({ level: 20, tecnicaFoco: 'Economia', activeConditions: [{ conditionId: 'condenado' }] });
    expect(computeEffectivePeCost(c, { spellLevel: '0', costPE: 0 })).toBe(0);
  });
});

describe("getDestruicaoDamageBonus — +1/dado + Bônus de Treinamento", () => {
  it("4 dados, Nv 8 (TB=3) → perDie=4, fixed=3 (total +7)", () => {
    const r = getDestruicaoDamageBonus('Destruição', 8, 4);
    expect(r.perDie).toBe(4);
    expect(r.fixed).toBe(3);
  });
  it("foco diferente → {0,0}", () => {
    expect(getDestruicaoDamageBonus('Economia', 8, 4)).toEqual({ perDie: 0, fixed: 0 });
    expect(getDestruicaoDamageBonus('Refino', 8, 4)).toEqual({ perDie: 0, fixed: 0 });
    expect(getDestruicaoDamageBonus(undefined, 8, 4)).toEqual({ perDie: 0, fixed: 0 });
  });
});

describe("getRefinoCdAndAtkBonus — floor(TB/2)", () => {
  it("Nv 12 + Refino (TB=4) → 2", () => {
    expect(getRefinoCdAndAtkBonus('Refino', 12)).toBe(2);
  });
  it("sem foco / outro foco → 0", () => {
    expect(getRefinoCdAndAtkBonus(undefined, 12)).toBe(0);
    expect(getRefinoCdAndAtkBonus('Destruição', 12)).toBe(0);
  });
});

// ===== Talents — Parte 1 (infraestrutura) ===================================

import { evaluateTalentRequirements, type Talent } from "@/lib/talents";
import type { Character } from "@/types";

const baseChar = (overrides: Partial<Character> = {}): Character => ({
  id: 'c1', name: 'Test', category: 'PLAYER', level: 1,
  ca: 10, baseDC: 10, hpCurrent: 10, hpMax: 10, peCurrent: 0, peMax: 0,
  escCurrent: 0, escMax: 0, rd: 0, rdByType: {} as any, slotsMax: 0, slotsCurrent: 0,
  attributes: [
    { id: 'FOR', name: 'FOR', value: 10 } as Attribute,
    { id: 'DES', name: 'DES', value: 10 } as Attribute,
    { id: 'CON', name: 'CON', value: 10 } as Attribute,
    { id: 'INT', name: 'INT', value: 10 } as Attribute,
    { id: 'SAB', name: 'SAB', value: 10 } as Attribute,
    { id: 'PRE', name: 'PRE', value: 10 } as Attribute,
  ],
  skills: [], savingThrows: [], passives: [], spells: [], equippedItems: [],
  customHitBonus: 0, meleeAttackBonus: 0, rangedAttackBonus: 0, cursedAttackBonus: 0,
  meleeLinkedAttr: 'FOR', rangedLinkedAttr: 'DES', cursedLinkedAttr: 'INT', dcLinkedAttr: 'INT',
  meleeTrained: false, rangedTrained: false, cursedTrained: false,
  meleeMastery: false, rangedMastery: false, cursedMastery: false,
  initiativeBonus: 0, movement: 9, damageDiceLevel: 0, critMargin: 20, cdIncrease: 0,
  rollPenalty: 0, actionsMax: 1, actionsCurrent: 1, bonusActionsMax: 1, bonusActionsCurrent: 1,
  reactionsMax: 1, reactionsCurrent: 1, opportunityMax: 1, opportunityCurrent: 1,
  activeBuffs: [], activeConditions: [], vulnerabilities: [], immunities: [],
  characterClass: 'Feiticeiro', specialization: 'Lutador', motivation: 'Raiva', origin: 'Inato',
  accessorySlots: {} as any, votos: '', hasEnergiaReversa: false,
  ...overrides,
} as Character);

const talent = (over: Partial<Talent>): Talent => ({
  id: 't-test', name: 'Teste', category: 'general',
  flavor: '', mechanic: '', triggerText: '', logicText: '',
  activation: 'passive',
  ...over,
});

describe('evaluateTalentRequirements', () => {
  it('aprova quando todos os pré-reqs são atendidos', () => {
    const r = evaluateTalentRequirements(talent({}), baseChar());
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('bloqueia por nível mínimo', () => {
    const r = evaluateTalentRequirements(talent({ minLevel: 8 }), baseChar({ level: 7 }));
    expect(r.ok).toBe(false);
    expect(r.missing.join(' ')).toMatch(/Nv 8/);
  });

  it('bloqueia por atributo (CON 14)', () => {
    const r = evaluateTalentRequirements(
      talent({ requiredAttr: { name: 'CON', min: 14 } }),
      baseChar(),
    );
    expect(r.ok).toBe(false);
    expect(r.missing.join(' ')).toMatch(/CON 14/);
  });

  it('aprova atributo "qualquer um" se 1 satisfaz', () => {
    const c = baseChar({
      attributes: [
        { id: 'FOR', name: 'FOR', value: 10 } as Attribute,
        { id: 'DES', name: 'DES', value: 14 } as Attribute,
      ] as Attribute[],
    });
    const r = evaluateTalentRequirements(
      talent({ requiredAttrAny: [{ name: 'FOR', min: 14 }, { name: 'DES', min: 14 }] }),
      c,
    );
    expect(r.ok).toBe(true);
  });

  it('bloqueia por origem incorreta', () => {
    const r = evaluateTalentRequirements(
      talent({ requiredOrigin: 'Herdado' }),
      baseChar({ origin: 'Inato' }),
    );
    expect(r.ok).toBe(false);
    expect(r.missing.join(' ')).toMatch(/Herdado/);
  });

  it('bloqueia por perícia não treinada', () => {
    const r = evaluateTalentRequirements(
      talent({ requiredSkillTrained: ['Vontade'] }),
      baseChar(),
    );
    expect(r.ok).toBe(false);
    expect(r.missing.join(' ')).toMatch(/Treinado em Vontade/);
  });

  it('bloqueia duplicata em talento não-repeatable', () => {
    const c = baseChar({ chosenTalents: [{ id: 't-test', level: 1 }] });
    const r = evaluateTalentRequirements(talent({}), c);
    expect(r.ok).toBe(false);
    expect(r.missing.join(' ')).toMatch(/Já adquirido/);
  });

  it('permite duplicata em talento repeatable', () => {
    const c = baseChar({ chosenTalents: [{ id: 't-test', level: 1 }] });
    const r = evaluateTalentRequirements(talent({ repeatable: true }), c);
    expect(r.ok).toBe(true);
  });
});


describe('GENERAL_TALENTS — Parte 2', () => {
  it('contém 44 entradas (20 sem pré-req + 24 com pré-req)', async () => {
    const { GENERAL_TALENTS } = await import('@/lib/talents');
    expect(GENERAL_TALENTS.length).toBe(44);
  });

  it('todos os IDs são únicos', async () => {
    const { GENERAL_TALENTS } = await import('@/lib/talents');
    const ids = GENERAL_TALENTS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todos começam com prefixo "tal-"', async () => {
    const { GENERAL_TALENTS } = await import('@/lib/talents');
    for (const t of GENERAL_TALENTS) expect(t.id.startsWith('tal-')).toBe(true);
  });

  it('pré-requisitos internos resolvem dentro do catálogo', async () => {
    const { GENERAL_TALENTS, getTalentById } = await import('@/lib/talents');
    for (const t of GENERAL_TALENTS) {
      for (const pid of t.prerequisites ?? []) {
        expect(getTalentById(pid)).toBeDefined();
      }
    }
  });

  it('exatamente 4 talentos com tag "adepto" (limite max:2 aplica)', async () => {
    const { GENERAL_TALENTS } = await import('@/lib/talents');
    const adeptos = GENERAL_TALENTS.filter(t => t.tag === 'adepto');
    expect(adeptos.length).toBe(4);
    for (const a of adeptos) {
      expect(a.maxOfTag).toEqual({ tag: 'adepto', max: 2 });
    }
  });

  it('bloqueia 3º talento "adepto" via maxOfTag', async () => {
    const { GENERAL_TALENTS, evaluateTalentRequirements } = await import('@/lib/talents');
    const adeptos = GENERAL_TALENTS.filter(t => t.tag === 'adepto');
    const c = baseChar({
      chosenTalents: [
        { id: adeptos[0].id, level: 4 },
        { id: adeptos[1].id, level: 4 },
      ],
      attributes: [
        { id: 'FOR', name: 'FOR', value: 14 } as Attribute,
        { id: 'CON', name: 'CON', value: 16 } as Attribute,
      ] as Attribute[],
      skills: [
        { id: 's1', name: 'Medicina', value: 0, mastery: true, trained: true },
        { id: 's2', name: 'Atletismo', value: 0, mastery: true, trained: true },
        { id: 's3', name: 'Intuição', value: 0, mastery: true, trained: true },
        { id: 's4', name: 'Feitiçaria', value: 0, mastery: true, trained: true },
      ] as any,
    });
    const r = evaluateTalentRequirements(adeptos[2], c);
    expect(r.ok).toBe(false);
    expect(r.missing.join(' ')).toMatch(/Limite atingido/);
  });
});

describe('ORIGIN_TALENTS — Parte 3', () => {
  it('contém exatamente 8 entradas', async () => {
    const { ORIGIN_TALENTS } = await import('@/lib/talents');
    expect(ORIGIN_TALENTS.length).toBe(8);
  });

  it('todos têm requiredOrigin definido e válido', async () => {
    const { ORIGIN_TALENTS } = await import('@/lib/talents');
    const { ORIGINS } = await import('@/types');
    for (const t of ORIGIN_TALENTS) {
      expect(t.requiredOrigin).toBeDefined();
      expect(ORIGINS).toContain(t.requiredOrigin!);
    }
  });

  it('todos têm category="origin"', async () => {
    const { ORIGIN_TALENTS } = await import('@/lib/talents');
    for (const t of ORIGIN_TALENTS) expect(t.category).toBe('origin');
  });

  it('merge geral tem 52 entradas com IDs únicos', async () => {
    const { getAllTalents } = await import('@/lib/talents');
    const all = getAllTalents();
    expect(all.length).toBe(52);
    expect(new Set(all.map(t => t.id)).size).toBe(52);
  });

  it('Inato Nv 11 vê Familiaridade com Técnica bloqueada por nível', async () => {
    const { getTalentById, evaluateTalentRequirements } = await import('@/lib/talents');
    const t = getTalentById('tal-familiaridade-tecnica')!;
    const r = evaluateTalentRequirements(t, baseChar({ origin: 'Inato', level: 11 }));
    expect(r.ok).toBe(false);
    expect(r.missing.join(' ')).toMatch(/Nv 12/);
  });

  it('Herdado Nv 12 vê Familiaridade com Técnica bloqueada por origem', async () => {
    const { getTalentById, evaluateTalentRequirements } = await import('@/lib/talents');
    const t = getTalentById('tal-familiaridade-tecnica')!;
    const r = evaluateTalentRequirements(t, baseChar({ origin: 'Herdado', level: 12 }));
    expect(r.ok).toBe(false);
    expect(r.missing.join(' ')).toMatch(/Inato/);
  });

  it('Inato Nv 12 desbloqueia Familiaridade com Técnica', async () => {
    const { getTalentById, evaluateTalentRequirements } = await import('@/lib/talents');
    const t = getTalentById('tal-familiaridade-tecnica')!;
    const r = evaluateTalentRequirements(t, baseChar({ origin: 'Inato', level: 12 }));
    expect(r.ok).toBe(true);
  });
});
