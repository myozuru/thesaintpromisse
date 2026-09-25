import { useState, useMemo } from 'react';
import { Spell, SpellBuff, SpellLevel, SpellTargetMode, SPELL_TARGET_MODES, DAMAGE_TYPES, DAMAGE_TYPE_LABELS, DAMAGE_TYPE_ABBR, DamageType, ALL_CONDITIONS, SPELL_LEVELS, SpellCondition, DifficultyLevel, DIFFICULTY_TABLE, SaveAttr, SAVE_ATTRS, DEFAULT_SAVING_THROWS } from '@/types';
import { X, Wand2, Shield, Lock, AlertTriangle, Info, Skull } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AREA_SIZE_BY_LEVEL, getSpellPECost, getLineAreaSize, getLineBonusDice, getActionTypeDiceModifier } from '@/lib/spellRules';
import { getDamage, getBonusTreinamento, PATAMAR_ND_RANGE, PATAMAR_LABELS } from '@/components/grimorio/fm-tables';
import {
  DurationKind,
  DURATION_KIND_LABELS,
  DURATION_KIND_DESCRIPTIONS,
  getSustainedPEPerRound,
  getMaxDuradouraRounds,
  BUFF_EFFECTS,
  DEBUFF_EFFECTS,
  AuxEffect,
  pickAux,
  TR_TARGETS,
  ATTR_TARGETS,
  SKILL_TARGETS,
  HEAL_SINGLE,
  HEAL_AREA,
} from '@/lib/spellAuxiliaryTables';

/* ═══════════════ AUTO-FILL DATA ═══════════════ */

const PE_COST: Record<string, number> = {
  '0': 1, '1': 2, '2': 5, '3': 8, '4': 12, '5': 20, 'Técnica Máxima': 20, 'Técnica Reversa': 1,
};

// DMG tables are kept local if not needed globally yet, but HEAL are now global
const DMG_SINGLE_ATK: Record<string, string> = {
  '1': '4d8', '2': '8d8', '3': '14d8', '4': '16d10', '5': '20d12', 'Técnica Máxima': '28d12',
};
const DMG_SINGLE_TR: Record<string, string> = {
  '1': '3d8', '2': '7d8', '3': '12d8', '4': '14d10', '5': '18d12', 'Técnica Máxima': '26d12',
};
const DMG_AREA_TR: Record<string, string> = {
  '1': '2d8', '2': '4d8', '3': '5d12', '4': '10d10', '5': '12d12', 'Técnica Máxima': '22d10',
};

const RANGE_BY_LEVEL: Record<string, string> = {
  '1': '12m', '2': '18m', '3': '24m', '4': '30m', '5': '48m', 'Técnica Máxima': '60m',
};

function rangeToMeters(r: string): number {
  if (r === 'Toque') return 0;
  return parseFloat(r.replace(',', '.').replace('m', ''));
}

function metersToRange(m: number): string {
  if (m <= 0) return 'Toque';
  const RANGE_VALUES = ['Toque', '1,5m', '3m', '4,5m', '6m', '9m', '12m', '18m', '24m', '30m', '48m', '60m'];
  let best = 'Toque';
  for (const r of RANGE_VALUES) {
    if (rangeToMeters(r) <= m) best = r;
  }
  return best;
}

const AREA_SHAPES = [
  { value: 'esfera', label: '🔴 Esfera' },
  { value: 'cilindro', label: '🔵 Cilindro' },
  { value: 'cone', label: '🔺 Cone' },
  { value: 'linha', label: '➖ Linha' },
  { value: 'cubo', label: '🟧 Cubo' },
] as const;
type AreaShape = typeof AREA_SHAPES[number]['value'];

/* Condition severity classification */
const COND_WEAK = ['abalado', 'caido', 'desorientado', 'desprevenido', 'sangramento'];
const COND_MEDIUM = ['agarrado', 'amedrontado', 'condenado', 'confuso', 'enfeiticado', 'enjoado', 'enredado', 'envenenado', 'imovel', 'lento', 'sofrendo', 'surdo', 'surpreso'];
const COND_STRONG = ['aterrorizado', 'cego', 'engasgando', 'exposto', 'fragilizado'];
const COND_EXTREME = ['atordoado', 'inconsciente', 'paralisado', 'indefeso'];

type CondSeverity = 'fraca' | 'média' | 'forte' | 'extrema';

function getCondSeverity(condId: string): CondSeverity {
  if (COND_WEAK.includes(condId)) return 'fraca';
  if (COND_MEDIUM.includes(condId)) return 'média';
  if (COND_STRONG.includes(condId)) return 'forte';
  if (COND_EXTREME.includes(condId)) return 'extrema';
  return 'média';
}

const SEVERITY_LABELS: Record<CondSeverity, string> = { fraca: '🟢 Fraca', média: '🟡 Média', forte: '🟠 Forte', extrema: '🔴 Extrema' };
const COND_DICE_COST: Record<CondSeverity, number> = { fraca: 1, média: 3, forte: 5, extrema: 8 };

function getMaxCondDuration(level: string, severity: CondSeverity, focused = false): number {
  const table: Record<string, Record<CondSeverity, number>> = {
    '1': { fraca: 1, média: 0, forte: 0, extrema: 0 },
    '2': { fraca: 2, média: 1, forte: 0, extrema: 0 },
    '3': { fraca: 3, média: 2, forte: 1, extrema: 0 },
    '4': { fraca: 4, média: 3, forte: 2, extrema: 1 },
    '5': { fraca: 5, média: 4, forte: 3, extrema: 1 },
    'Técnica Máxima': { fraca: 99, média: 5, forte: 4, extrema: 1 },
  };
  const focusedTable: Record<string, Record<CondSeverity, number>> = {
    '1': { fraca: 3, média: 2, forte: 1, extrema: 0 },
    '2': { fraca: 4, média: 3, forte: 2, extrema: 0 },
    '3': { fraca: 5, média: 4, forte: 3, extrema: 1 },
    '4': { fraca: 6, média: 5, forte: 4, extrema: 1 },
    '5': { fraca: 7, média: 6, forte: 5, extrema: 1 },
    'Técnica Máxima': { fraca: 99, média: 7, forte: 6, extrema: 1 },
  };
  const t = focused ? focusedTable : table;
  let maxDur = t[level]?.[severity] ?? 0;
  if (severity === 'extrema' && maxDur > 0) maxDur = 1;
  return maxDur;
}

function isCondAllowed(level: string, condId: string, focused = false): boolean {
  const sev = getCondSeverity(condId);
  return getMaxCondDuration(level, sev, focused) > 0;
}

function parseDice(notation: string): { count: number; sides: number } | null {
  const match = notation.match(/^(\d+)d(\d+)$/i);
  if (!match) return null;
  return { count: parseInt(match[1]), sides: parseInt(match[2]) };
}

/** Get the effective spell level as a number (for limit calculations) */
function getEffectiveLevel(spellLevel: string): number {
  const lv = parseInt(spellLevel);
  if (!isNaN(lv)) return lv;
  if (spellLevel === 'Técnica Máxima') return 5;
  return 0;
}

/** Initial duration for a condition: max permitted for that severity and level (≥1). */
function getInitialCondDuration(level: string, severity: CondSeverity, focused: boolean): number {
  const maxDur = getMaxCondDuration(level, severity, focused);
  if (maxDur <= 0) return 1;
  return Math.max(1, maxDur);
}

/* ═══════════════ MODO MALDIÇÃO (GRIMÓRIO) ═══════════════ */

type MaldicaoPatamar = 'lacaio' | 'capanga' | 'comum' | 'desafio' | 'calamidade';
type MaldicaoDifficulty = 'iniciante' | 'intermediario' | 'experiente';
type MaldicaoTarget = 'acerto' | 'tr_ind' | 'tr_area';
type MaldicaoCondCost = 'pe' | 'nd';

/** Custo de condição em PE/ND por severidade (Grimório seção 7). */
const MALD_COND_PE: Record<CondSeverity, number> = { fraca: 2, média: 5, forte: 8, extrema: 10 };
const MALD_COND_ND: Record<CondSeverity, number> = { fraca: 1, média: 2, forte: 3, extrema: 4 };

/** Parser do roll oficial "XdY+N" da tabela de Dano Médio. */
function parseGrimorioRoll(roll: string): { dice: number; sides: number; fixed: number } {
  const m = roll.match(/^(\d+)d(\d+)(?:\+(\d+))?$/i);
  if (!m) return { dice: 0, sides: 8, fixed: 0 };
  return { dice: parseInt(m[1]), sides: parseInt(m[2]), fixed: parseInt(m[3] || '0') };
}

/** Acerto base por dificuldade (sem Mod Atributo) — calculado a partir da tabela. */
function maldicaoAcertoBase(patamar: MaldicaoPatamar, nd: number, difficulty: MaldicaoDifficulty): number {
  // Iniciante = ND; Intermediário = ND + BT; Experiente = ND + 2*BT (para Comum/Desafio)
  // Calamidade tem coluna própria (ver Grimório). Aproximação simples:
  const bt = getBonusTreinamento(nd);
  if (patamar === 'calamidade') {
    if (difficulty === 'iniciante')    return nd + bt + 5;
    if (difficulty === 'intermediario') return nd + bt + 9;
    return nd + bt + 14;
  }
  if (difficulty === 'iniciante')    return nd;
  if (difficulty === 'intermediario') return nd + bt;
  return nd + 2 * bt;
}

/** CD base por dificuldade (Grimório: ND + Mod Téc / 2 / Mod Téc). */
function maldicaoCDBase(nd: number, difficulty: MaldicaoDifficulty): number {
  const bt = getBonusTreinamento(nd);
  if (difficulty === 'iniciante')    return nd + Math.floor(bt / 2);
  if (difficulty === 'intermediario') return nd + bt;
  return nd + bt + Math.floor(bt / 2);
}

/* ═══════════════ COMPONENT ═══════════════ */

type AssistSpellType = 'damage' | 'heal' | 'buff' | 'debuff' | 'condition';

interface Props {
  onAdd: (spell: Spell) => void;
  onCancel: () => void;
  charLevel?: number;
  currentSpellCount?: number;
  maxSpells?: number;
  initialSpell?: Spell;
  isGolpeador?: boolean;
  hasEnergiaReversa?: boolean;
  availableTags?: { label: string; discountPE: number }[];
  /** Mestre pode editar livremente PE/Dano. Players não. */
  isMaster?: boolean;
  /** Personagem comprou a aptidão "Técnica Máxima" (special-tecnica-maxima). */
  hasTecnicaMaxima?: boolean;
  /** Personagem comprou a aptidão "Reversão de Técnica" (special-reversao-de-tecnica). */
  hasTecnicaReversa?: boolean;
  /** Força a UI de "Modo Mestre" (todas edições liberadas) — usado no fluxo de contraproposta. */
  forceMasterMode?: boolean;
  /** Quando definido, o botão de salvar vira "Enviar para o Mestre" e chama esta função em vez de `onAdd`. */
  onSubmitProposal?: (spell: Spell) => void;
  /** Inicia em Modo Maldição (assistente Grimório-aware para inimigos/maldições). */
  initialMaldicaoMode?: boolean;
  /** Patamar padrão sugerido ao entrar em Modo Maldição. */
  defaultPatamar?: MaldicaoPatamar;
  /** ND padrão sugerido ao entrar em Modo Maldição. */
  defaultND?: number;
}

export function SpellCreationAssistant({ 
  onAdd, 
  onCancel, 
  charLevel = 1, 
  currentSpellCount = 0, 
  maxSpells = 99, 
  initialSpell, 
  isGolpeador = false, 
  hasEnergiaReversa = false,
  availableTags = [],
  isMaster = false,
  hasTecnicaMaxima = false,
  hasTecnicaReversa = false,
  forceMasterMode = false,
  onSubmitProposal,
  initialMaldicaoMode = false,
  defaultPatamar = 'comum',
  defaultND = 5,
}: Props) {
  // Strip auto-generated tags so re-edits don't accumulate them
  const stripAutoTags = (raw: string): string => {
    if (!raw) return '';
    return raw
      .split('|')
      .map(s => s.trim())
      .filter(s => s && !/^\[(Duração|Acerto|CD[+-]|Requisito|Req|Debuff|Foco em Condições|Área):?/i.test(s) && !/^\[Debuff\]$/i.test(s) && !/^\[Foco em Condições\]$/i.test(s) && !/^Área:/i.test(s) && !/^\[.*: Custo -.* PE\]$/i.test(s))
      .join(' | ');
  };

  const [name, setName] = useState(initialSpell?.name || '');
  const [description, setDescription] = useState(stripAutoTags(initialSpell?.description || ''));
  const [spellLevel, setSpellLevel] = useState<SpellLevel>(initialSpell?.spellLevel || '1');

  // Map internal types back to assistant types
  const initialAssistType: AssistSpellType = initialSpell
    ? (initialSpell.spellType === 'buff' && initialSpell.description.includes('[Debuff]') ? 'debuff' : initialSpell.spellType as AssistSpellType)
    : 'damage';

  const [spellType, setSpellType] = useState<AssistSpellType>(initialAssistType);
  const [actionType, setActionType] = useState<Spell['actionType']>(initialSpell?.actionType || 'action');
  const [targetMode, setTargetMode] = useState<SpellTargetMode>(initialSpell?.targetMode || 'single_atk');
  const [damageType, setDamageType] = useState<string>(initialSpell?.damageType || '');
  const [damageBonus, setDamageBonus] = useState(initialSpell?.damageBonus || 0);
  const [fixedDamage, setFixedDamage] = useState<number>(initialSpell?.fixedDamage || 0);
  const [buffs, setBuffs] = useState<SpellBuff[]>(initialSpell?.buffs || []);
  const [conditions, setConditions] = useState<SpellCondition[]>(initialSpell?.conditions || []);
  const [addingBuff, setAddingBuff] = useState(false);
  const [buffForm, setBuffForm] = useState<SpellBuff>({ type: 'ca', value: 0, durationTurns: 1 });
  const [addingCondition, setAddingCondition] = useState(false);
  const [condForm, setCondForm] = useState<SpellCondition>({ conditionId: ALL_CONDITIONS[0].id, durationTurns: 0, durationRounds: 1 });

  const [areaShape, setAreaShape] = useState<AreaShape>('esfera');
  const [lineWidth, setLineWidth] = useState<number>(1.5);

  const [durationKind, setDurationKind] = useState<DurationKind>(
    initialSpell?.durationRounds === -1 ? 'sustentada' : initialSpell?.durationRounds === 1 ? 'imediata' : 'duradoura'
  );

  const [duradouraRounds, setDuradouraRounds] = useState<number>(
    initialSpell?.durationRounds && initialSpell.durationRounds > 1 ? initialSpell.durationRounds : 1
  );
  const [selectedEffectKey, setSelectedEffectKey] = useState<string>('');
  const [selectedEffectLevel, setSelectedEffectLevel] = useState<SpellLevel>(initialSpell?.spellLevel || '1');
  /** Tipo de dano obrigatório quando o efeito for 'rd' (RD por tipo). */
  const [rdDamageType, setRdDamageType] = useState<DamageType | ''>('');

  const [diceAdj, setDiceAdj] = useState(initialSpell?.tradeDiceAdj || 0);
  const [hitAdj, setHitAdj] = useState(initialSpell?.tradeHitBonus ? initialSpell.tradeHitBonus / 2 : 0);
  const [rangeAdj, setRangeAdj] = useState(initialSpell?.tradeRangeAdj || 0);
  const [cdAdj, setCdAdj] = useState(initialSpell?.tradeCDAdj || 0);

  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>(initialSpell?.difficultyLevel || 'none');
  const [difficultyDesc, setDifficultyDesc] = useState(initialSpell?.difficultyDescription || '');

  const [attackType, setAttackType] = useState<'melee' | 'ranged' | 'cursed'>(initialSpell?.attackType || 'cursed');
  const [saveAttr, setSaveAttr] = useState<string>(initialSpell?.saveAttr || 'DES');

  // Modo Mestre opt-in para Players (auto-ativado quando há Requisito).
  const [playerMasterToggle, setPlayerMasterToggle] = useState<boolean>(
    !!initialSpell?.difficultyLevel && initialSpell.difficultyLevel !== 'none',
  );

  // Override fields
  const [customPE, setCustomPE] = useState<number | null>(null);
  const [customDice, setCustomDice] = useState<string | null>(null);

  const initialTagMatch = initialSpell?.description?.match(/\[(.*): Custo -\d+ PE\]/);
  const [selectedTag, setSelectedTag] = useState<string>(initialTagMatch ? initialTagMatch[1] : '');

  // ═════ MODO MALDIÇÃO (GRIMÓRIO) ═════
  const [maldicaoMode, setMaldicaoMode] = useState<boolean>(initialMaldicaoMode);
  const [mPatamar, setMPatamar] = useState<MaldicaoPatamar>(defaultPatamar);
  const [mND, setMND] = useState<number>(defaultND);
  const [mDifficulty, setMDifficulty] = useState<MaldicaoDifficulty>('intermediario');
  const [mTarget, setMTarget] = useState<MaldicaoTarget>('acerto');
  const [mPhysicalNarrative, setMPhysicalNarrative] = useState<boolean>(false);
  const [mCondCost, setMCondCost] = useState<MaldicaoCondCost>('pe');
  const [mHitTrade, setMHitTrade] = useState<number>(0); // dados convertidos em +2 acerto cada
  const [mCDTrade, setMCDTrade] = useState<number>(0);   // dados convertidos em +1 CD cada
  const [mAttrMod, setMAttrMod] = useState<number>(0);   // Mod de Atributo (informativo)


  const isFocusedCondition = spellType === 'condition';
  const isDamage = spellType === 'damage';
  const isBuff = spellType === 'buff';
  const isDebuff = spellType === 'debuff';
  const isBuffOrDebuff = isBuff || isDebuff;
  const isArea = targetMode === 'area_tr';
  const isLine = isArea && areaShape === 'linha';
  const needsTR = targetMode === 'single_tr' || targetMode === 'area_tr';
  const L = getEffectiveLevel(spellLevel);

  // === LIMITS ===
  const maxDiceAdj = 1 + L;
  const maxHitAdj = L;
  const maxCDAdj = 1 + L;
  // Max conditions per spell = spell level
  const maxConditionsPerSpell = Math.max(0, L);

  // === BASE VALUES ===
  const diffBonus = DIFFICULTY_TABLE[difficultyLevel];
  const tagDiscount = availableTags.find(t => t.label === selectedTag)?.discountPE || 0;
  const effectivePE = Math.max(1, (customPE !== null ? customPE : (getSpellPECost(spellLevel) + diffBonus.pe)) - tagDiscount);

  const baseDiceStr = useMemo(() => {
    if (spellLevel === '0' && spellType === 'heal') return undefined; // Nível 0 não pode curar
    return spellType === 'heal' 
      ? (isArea ? HEAL_AREA[spellLevel] : HEAL_SINGLE[spellLevel])
      : (isArea ? DMG_AREA_TR[spellLevel] : (needsTR ? DMG_SINGLE_TR[spellLevel] : DMG_SINGLE_ATK[spellLevel]));
  }, [spellLevel, spellType, isArea, needsTR]);

  const baseDice = baseDiceStr ?? '';
  const baseDiceParsed = parseDice(baseDice);
  const baseDiceCount = baseDiceParsed?.count ?? 0;
  const baseDiceSides = baseDiceParsed?.sides ?? 8;

  const autoRange = RANGE_BY_LEVEL[spellLevel] ?? '12m';
  const autoRangeM = rangeToMeters(autoRange);
  const autoAreaSize = AREA_SIZE_BY_LEVEL[spellLevel] ?? 4.5;

  // Line bonus dice
  const lineBonusDice = isLine ? getLineBonusDice(spellLevel) : 0;

  // Action type dice modifier (also applied as budget bonus for focused conditions)
  const actionDiceMod = (isDamage || isFocusedCondition) ? getActionTypeDiceModifier(actionType, spellLevel) : 0;

  // Condition dice cost
  const totalCondDiceCost = conditions.reduce((sum, sc) => {
    const sev = getCondSeverity(sc.conditionId);
    return sum + COND_DICE_COST[sev];
  }, 0);

  // === POOL BALANCE ===
  // For non-debuff: same as before (range counted with rest)
  // For debuff: range only trades with cd (separate sub-pools)
  let poolUsed: number;
  if (isDebuff) {
    // Two separate pools: { dice, hit } and { range, cd }
    poolUsed = diceAdj + hitAdj; // main pool
  } else {
    poolUsed = diceAdj + hitAdj + rangeAdj + cdAdj;
  }
  const poolBalance = -poolUsed;

  // Debuff secondary pool (range ↔ cd)
  const debuffRangePoolUsed = isDebuff ? (rangeAdj + cdAdj) : 0;
  const debuffRangePoolBalance = -debuffRangePoolUsed;

  // For area (non-line, non-debuff): range and area share rangeAdj — already implicit
  // since we use the same rangeAdj for both (vínculo área/alcance via mesma variável)

  // Effective values
  const effectiveDiceCount = Math.max(isDamage ? 1 : 0, baseDiceCount + diceAdj + diffBonus.dice + lineBonusDice + (isDamage ? actionDiceMod : 0) - totalCondDiceCost);
  const effectiveHitBonus = hitAdj * 2;
  const effectiveCDBonus = cdAdj;

  // Range/Area calculation with traves
  // Trava de Alcance Mínimo: nunca pode ser negativo, mínimo "Toque" (0m)
  // Trava de Linha: comprimento mínimo 1,5m
  let effectiveRange: string;
  let effectiveAreaSize: number;
  if (isArea && !isLine) {
    // Vínculo área/alcance: rangeAdj reduces both
    const rawArea = autoAreaSize + rangeAdj * 1.5;
    effectiveAreaSize = Math.max(1.5, rawArea);
    const rawRangeM = autoRangeM + rangeAdj * 6;
    effectiveRange = metersToRange(Math.max(0, rawRangeM));
  } else if (isLine) {
    effectiveAreaSize = autoAreaSize;
    effectiveRange = autoRange;
  } else {
    effectiveAreaSize = autoAreaSize;
    const rangeM = autoRangeM + rangeAdj * 6;
    effectiveRange = metersToRange(Math.max(0, rangeM));
  }

  // Line specifics: 1pt = 4.5m length
  const extraLineWidth = isLine ? Math.max(0, lineWidth - 1.5) : 0;
  const lineWidthPenalty = isLine ? Math.floor(extraLineWidth / 1.5) * 4.5 : 0;
  const effectiveLineLength = isLine
    ? Math.max(1.5, getLineAreaSize(autoAreaSize) + rangeAdj * 4.5 - lineWidthPenalty)
    : 0;

  const effectiveDiceAuto = useMemo(() => {
    if (customDice !== null) return customDice;
    if (!baseDice && !isFocusedCondition) return '';
    if (isFocusedCondition) return '';
    if (isBuffOrDebuff) return '';
    return `${effectiveDiceCount}d${baseDiceSides}`;
  }, [customDice, baseDice, effectiveDiceCount, baseDiceSides, isFocusedCondition, isBuffOrDebuff]);

  // ═════════════ MODO MALDIÇÃO — CÁLCULO ═════════════
  const maldicaoBT = useMemo(() => getBonusTreinamento(mND), [mND]);

  /** ND efetivo para lookup do dano: TR individual baixa 1 ND. */
  const mEffectiveND = useMemo(() => {
    if (mTarget === 'tr_ind') return Math.max(1, mND - 1);
    return mND;
  }, [mND, mTarget]);

  /** Custo total de PE adicional de condições (modo PE). */
  const mCondPECost = useMemo(() => {
    if (!maldicaoMode || mCondCost !== 'pe') return 0;
    return conditions.reduce((sum, sc) => sum + (MALD_COND_PE[getCondSeverity(sc.conditionId)] || 0), 0);
  }, [maldicaoMode, mCondCost, conditions]);

  /** Reduções de ND para o dano (modo ND): cada condição corta NDs do dano. */
  const mCondNDReduction = useMemo(() => {
    if (!maldicaoMode || mCondCost !== 'nd') return 0;
    return conditions.reduce((sum, sc) => sum + (MALD_COND_ND[getCondSeverity(sc.conditionId)] || 0), 0);
  }, [maldicaoMode, mCondCost, conditions]);

  const mFinalND = Math.max(1, mEffectiveND - mCondNDReduction);

  /** Pacote oficial Grimório: dado base + fixo da tabela. */
  const mGrimorioPack = useMemo(() => {
    const entry = getDamage(mPatamar, mFinalND);
    if (!entry) return { dice: 0, sides: 8, fixed: 0, raw: '—' };
    const p = parseGrimorioRoll(entry.roll);
    return { ...p, raw: entry.roll };
  }, [mPatamar, mFinalND]);

  /** Aplica reduções: TR em área = ½ dano; narrativa física = -2 dados; trocas de dados→acerto/CD. */
  const mFinal = useMemo(() => {
    let dice = mGrimorioPack.dice;
    let fixed = mGrimorioPack.fixed;
    if (mTarget === 'tr_area') {
      dice = Math.floor(dice / 2);
      fixed = Math.floor(fixed / 2);
    }
    if (mPhysicalNarrative) dice = Math.max(0, dice - 2);
    // Trocas: cada dado convertido sai do pool de dados
    const tradeCost = mHitTrade + mCDTrade;
    dice = Math.max(0, dice - tradeCost);
    const hitBonus = mHitTrade * 2;
    const cdBonus = mCDTrade * 1;
    const acertoBase = maldicaoAcertoBase(mPatamar, mND, mDifficulty);
    const cdBase = maldicaoCDBase(mND, mDifficulty);
    return {
      dice,
      sides: mGrimorioPack.sides,
      fixed,
      acerto: acertoBase + mAttrMod + hitBonus,
      cd: cdBase + mAttrMod + cdBonus,
      acertoBase,
      cdBase,
      hitBonus,
      cdBonus,
    };
  }, [mGrimorioPack, mTarget, mPhysicalNarrative, mHitTrade, mCDTrade, mPatamar, mND, mDifficulty, mAttrMod]);

  const mDiceStr = mFinal.dice > 0 ? `${mFinal.dice}d${mFinal.sides}` : '';

  /** Quando o Modo Maldição está ativo, sobrescreve o dano final. */
  const effectiveDice = maldicaoMode ? mDiceStr : effectiveDiceAuto;
  const effectiveFixedDamage = maldicaoMode ? mFinal.fixed : (fixedDamage || 0);


  // === CONDITION/DEBUFF BUDGET ===
  // Focused condition or debuff with conditions: budget = base dice + traded dice + action mod
  // Pontos adicionados via pool viram "Dados de Orçamento", não dano
  const condBudgetDice = useMemo(() => {
    if (isFocusedCondition || isDamage) {
      const table = targetMode === 'single_atk' ? DMG_SINGLE_ATK : targetMode === 'single_tr' ? DMG_SINGLE_TR : DMG_AREA_TR;
      const d = table[spellLevel] ?? '1d6';
      const baseBudget = parseDice(d)?.count ?? 0;
      // Add traded dice as budget (positive diceAdj = bought with pool reductions)
      // Add action type modifier (full action increases budget; bonus action decreases)
      // DAMAGE spells have budget = base - 1
      const reduction = isDamage ? 1 : 0;
      return Math.max(0, baseBudget + diceAdj + actionDiceMod - reduction);
    }
    return baseDiceCount;
  }, [isFocusedCondition, isDamage, targetMode, spellLevel, diceAdj, actionDiceMod, baseDiceCount]);

  const remainingDiceAfterConditions = Math.max(0, condBudgetDice - totalCondDiceCost);
  const canAddMoreConditions = remainingDiceAfterConditions > 0 && conditions.length < maxConditionsPerSpell;

  const canSelectReaction = !isDamage;

  // === POOL STRICT VALIDATION (Bug do Saldo Fantasma) ===
  // poolBalance <= 1 disables further spending. Specifically, you cannot consume
  // a unit if the resulting balance would drop below 0 (i.e., balance must remain ≥ 1
  // after the trade, since "1" is the minimum reserve).
  function canAdjust(type: 'dice' | 'hit' | 'range' | 'cd', direction: 1 | -1): boolean {
    const newVal = (type === 'dice' ? diceAdj : type === 'hit' ? hitAdj : type === 'range' ? rangeAdj : cdAdj) + direction;

    // Per-channel limits
    if (type === 'dice') {
      if (Math.abs(newVal) > maxDiceAdj) return false;
      if (isDamage && baseDiceCount + newVal + diffBonus.dice + lineBonusDice + actionDiceMod - totalCondDiceCost < 1) return false;
    } else if (type === 'hit') {
      if (Math.abs(newVal) > maxHitAdj) return false;
    } else if (type === 'cd') {
      if (Math.abs(newVal) > maxCDAdj) return false;
    } else if (type === 'range') {
      // Trava de Alcance Mínimo: nunca pode ficar negativo (mínimo Toque = 0m)
      if (direction === -1) {
        if (isArea && !isLine) {
          const newArea = autoAreaSize + newVal * 1.5;
          if (newArea < 1.5) return false; // área mínima 1,5m
          const newRangeM = autoRangeM + newVal * 6;
          if (newRangeM < 0) return false;
        } else if (isLine) {
          // Trava de Linha: comprimento mínimo absoluto 1,5m
          const newLineLen = getLineAreaSize(autoAreaSize) + newVal * 4.5 - lineWidthPenalty;
          if (newLineLen < 1.5) return false;
        } else {
          const newRangeM = autoRangeM + newVal * 6;
          if (newRangeM < 0) return false;
        }
      }
    }

    // Pool check: Se direction > 0, estamos aumentando um valor de ajuste, o que GASTA um ponto do pool.
    // Precisamos sempre verificar se temos saldo, mesmo se estivermos voltando de um valor negativo.
    if (direction > 0) {
      // Para Debuff: alcance e cd usam um pool separado
      if (isDebuff && (type === 'range' || type === 'cd')) {
        if (debuffRangePoolBalance <= 0) return false;
      } else {
        if (poolBalance <= 0) return false;
      }
    }
    return true;
  }

  const limitReachedTooltip = 'Limite de modificação atingido (saldo do pool não pode ficar negativo)';

  // === HANDLERS ===
  const resetTrades = () => {
    setDiceAdj(0);
    setHitAdj(0);
    setRangeAdj(0);
    setCdAdj(0);
  };

  const handleLevelChange = (lv: SpellLevel) => {
    setSpellLevel(lv);
    setSelectedEffectLevel(lv);
    resetTrades();
    setConditions(prev => prev.filter(sc => isCondAllowed(lv, sc.conditionId, isFocusedCondition)));
    setCustomDice(null);
    setCustomPE(null);
    setDifficultyLevel('none');
    // Adjust duradouraRounds to new max
    setDuradouraRounds(r => Math.min(r, getMaxDuradouraRounds(lv)));
  };

  const handleTypeChange = (type: AssistSpellType) => {
    setSpellType(type);
    resetTrades();
    if (type === 'condition' && targetMode === 'single_atk') setTargetMode('single_tr');
    if (type !== 'damage' && type !== 'debuff' && type !== 'condition') setConditions([]);
    // Reação agora é permitida em qualquer foco (inclusive dano) para os players.
    setCustomDice(null);
    setSelectedEffectKey('');
    setBuffs([]);
  };

  const handleActionTypeChange = (at: Spell['actionType']) => {
    setActionType(at);
    setCustomDice(null);
  };

  const handleAreaShapeChange = (shape: AreaShape) => {
    setAreaShape(shape);
    if (shape === 'linha') setLineWidth(1.5);
    resetTrades();
    setCustomDice(null);
  };

  const allowedConditions = ALL_CONDITIONS.filter(c => isCondAllowed(spellLevel, c.id, isFocusedCondition));

  const showDice = (spellType === 'damage' || spellType === 'heal') && !isFocusedCondition;
  const showConditions = spellType === 'damage' || spellType === 'debuff' || spellType === 'condition';
  const showDamageType = spellType === 'damage';
  const atSpellLimit = currentSpellCount >= maxSpells;

  // Renomeação dinâmica para Debuffs
  const diceLabel = isDebuff ? 'Prejuízo em Rolagem' : 'Quantidade';
  const sidesLabel = isDebuff ? 'Atributo, Perícia ou TR' : 'Lados (do dado)';

  const handleSave = (opts?: { asProposal?: boolean }) => {
    if (!name.trim()) return;
    const mappedType: Spell['spellType'] = spellType === 'debuff' ? 'buff' : spellType;

    // Compute final durationRounds based on durationKind for buff/debuff
    let finalDurationRounds = 0;
    if (isBuffOrDebuff) {
      if (durationKind === 'imediata') finalDurationRounds = 1;
      else if (durationKind === 'duradoura') finalDurationRounds = duradouraRounds;
      else finalDurationRounds = -1; // Sustentada = -1 sentinel (cena)
    }

    // Apply "Condição Fraca no End-Game" rule (level ≥ 5, weak condition → duration = Cena)
    const finalConditions = conditions.map(sc => {
      const sev = getCondSeverity(sc.conditionId);
      if (sev === 'fraca' && L >= 5) {
        return { ...sc, durationTurns: 0, durationRounds: -1 }; // -1 = Cena
      }
      return sc;
    });

    const maldicaoTags: string[] = [];
    if (maldicaoMode) {
      maldicaoTags.push(`[Grimório: ${PATAMAR_LABELS[mPatamar]} ND${mND} ${mDifficulty}]`);
      maldicaoTags.push(`[Acerto ${mFinal.acerto >= 0 ? '+' : ''}${mFinal.acerto} | CD ${mFinal.cd}]`);
      if (mTarget !== 'acerto') maldicaoTags.push(`[Alvo: ${mTarget === 'tr_ind' ? 'TR Individual (-1 ND)' : 'TR em Área (½ dano)'}]`);
      if (mPhysicalNarrative) maldicaoTags.push('[Narrativa Física: -2 dados]');
      if (mCondCost === 'pe' && mCondPECost > 0) maldicaoTags.push(`[Condições: +${mCondPECost} PE]`);
      if (mCondCost === 'nd' && mCondNDReduction > 0) maldicaoTags.push(`[Condições: -${mCondNDReduction} ND no dano]`);
      if (mHitTrade > 0) maldicaoTags.push(`[Troca: -${mHitTrade}d → +${mHitTrade * 2} Acerto]`);
      if (mCDTrade > 0) maldicaoTags.push(`[Troca: -${mCDTrade}d → +${mCDTrade} CD]`);
    }

    const desc = [
      stripAutoTags(description),
      isArea ? `Área: ${AREA_SHAPES.find(s => s.value === areaShape)?.label || areaShape} (${isLine ? `${effectiveLineLength}m x ${lineWidth}m` : `${effectiveAreaSize}m`})` : '',
      spellType === 'debuff' ? '[Debuff]' : '',
      spellType === 'condition' ? '[Foco em Condições]' : '',
      isBuffOrDebuff ? `[Duração: ${DURATION_KIND_LABELS[durationKind]}${durationKind === 'sustentada' ? ` — ${getSustainedPEPerRound(spellLevel)} PE/rd` : ''}]` : '',
      selectedTag ? `[${selectedTag}: Custo -${tagDiscount} PE]` : '',
      !maldicaoMode && effectiveHitBonus !== 0 ? `[Acerto ${effectiveHitBonus >= 0 ? '+' : ''}${effectiveHitBonus}]` : '',
      !maldicaoMode && effectiveCDBonus !== 0 ? `[CD${effectiveCDBonus >= 0 ? '+' : ''}${effectiveCDBonus}]` : '',
      difficultyLevel !== 'none' ? `[Requisito: ${DIFFICULTY_TABLE[difficultyLevel].label}]` : '',
      difficultyDesc ? `[Req: ${difficultyDesc}]` : '',
      ...maldicaoTags,
    ].filter(Boolean).join(' | ');

    // Custo PE final: soma PE de condições em modo Maldição/PE
    const builtPE = maldicaoMode ? Math.max(1, effectivePE + mCondPECost) : effectivePE;

    const built: Spell = {
      id: initialSpell?.id || crypto.randomUUID(),
      name: name.trim(),
      costPE: builtPE,
      description: desc,
      damageDice: isFocusedCondition ? '' : (isBuffOrDebuff ? '' : effectiveDice),
      damageBonus: maldicaoMode ? 0 : (isFocusedCondition ? 0 : damageBonus),
      fixedDamage: isFocusedCondition ? 0 : effectiveFixedDamage,
      spellType: mappedType,
      actionType,
      damageType: damageType ? damageType as DamageType : undefined,
      buffs: [...buffs],
      conditions: finalConditions,
      spellLevel,
      durationRounds: finalDurationRounds,
      range: isLine ? `Linha ${effectiveLineLength}m` : effectiveRange,
      targetMode,
      bonusDC: effectiveCDBonus !== 0 ? effectiveCDBonus : undefined,
      tradeHitBonus: effectiveHitBonus !== 0 ? effectiveHitBonus : undefined,
      tradeDiceAdj: diceAdj !== 0 ? diceAdj : undefined,
      tradeRangeAdj: rangeAdj !== 0 ? rangeAdj : undefined,
      tradeCDAdj: cdAdj !== 0 ? cdAdj : undefined,
      difficultyLevel: difficultyLevel !== 'none' ? difficultyLevel : undefined,
      difficultyDescription: difficultyDesc || undefined,
      attackType,
      saveAttr: needsTR ? saveAttr : undefined,
    };

    if (opts?.asProposal && onSubmitProposal) {
      onSubmitProposal(built);
    } else {
      onAdd(built);
    }
  };

  // === BUFF/DEBUFF EFFECT VALUE LOOKUP ===
  const effectsCatalog = isBuff ? BUFF_EFFECTS : isDebuff ? DEBUFF_EFFECTS : [];
  const selectedEffect: AuxEffect | undefined = effectsCatalog.find(e => e.key === selectedEffectKey);
  const effectAutoValue = useMemo(() => {
    if (!selectedEffect) return null;
    const row = selectedEffect.table[selectedEffectLevel];
    const raw = pickAux(row, durationKind);
    
    const effectNumLv = selectedEffectLevel === 'Técnica Máxima' ? 5 : selectedEffectLevel === 'Técnica Reversa' ? 0 : parseInt(selectedEffectLevel as string) || 0;

    // Handle Dice strings (e.g. Dano Durante, Dano Após)
    if (typeof raw === 'string') {
      let finalStr = raw;
      const parsed = parseDice(raw);
      if (parsed) {
        if (actionType === 'action' && (selectedEffect.key === 'dano_durante' || selectedEffect.key === 'dano_apos')) {
          const extraDice = Math.floor(effectNumLv / 2);
          finalStr = `${parsed.count + extraDice}d${parsed.sides}`;
        }
      }
      return finalStr;
    }

    if (typeof raw !== 'number') return raw;
    let finalValue = raw;

    // Apply 1.5x for Imediata used as Reaction on Defesa
    if (selectedEffect.key === 'defesa' && durationKind === 'imediata' && actionType === 'reaction') {
      finalValue = Math.round(finalValue * 1.5);
    }
    
    // Apply reduce for Bonus Action on Defesa/RD (reduz o valor em nível do feitiço)
    if (actionType === 'bonus' && (selectedEffect.key === 'defesa' || selectedEffect.key === 'rd')) {
      finalValue = Math.max(0, finalValue - effectNumLv);
    }
    if (actionType === 'bonus' && selectedEffect.key === 'negacao_rd') {
      finalValue = Math.min(0, finalValue + effectNumLv); // approaching 0
    }

    // Apply increase for Action on specific effects
    if (actionType === 'action') {
      if (['tr', 'pericia', 'cd_ataque'].includes(selectedEffect.key)) {
        finalValue += Math.max(1, effectNumLv - 1);
      } else if (selectedEffect.key === 'prejuizo_rolagem') {
        finalValue -= Math.max(1, effectNumLv - 1);
      } else if (selectedEffect.key === 'dano_fixo') {
        finalValue += effectNumLv * 2;
      } else if (selectedEffect.key === 'niveis_dano') {
        finalValue += effectNumLv;
      }
    }

    // Feitiços Golpeadores recebem metade em Alcance
    if (isGolpeador && typeof finalValue === 'number' && (selectedEffect.key === 'alcance_cac' || selectedEffect.key === 'alcance_dist')) {
      finalValue = Math.max(1.5, finalValue / 2); // Minimum 1.5m to represent a valid map square reduction
    }

    return finalValue;
  }, [selectedEffect, selectedEffectLevel, durationKind, actionType, isGolpeador]);

  const handleAddBuffFromEffect = () => {
    if (!selectedEffect || effectAutoValue === null) return;
    // RD exige tipo de dano (passivas/feitiços/itens não podem dar RD genérica).
    if (selectedEffect.key === 'rd' && !rdDamageType) return;
    const valueIsNumeric = typeof effectAutoValue === 'number';
    const baseLabel = valueIsNumeric ? `${selectedEffect.label} ${effectAutoValue > 0 ? '+' : ''}${effectAutoValue}${selectedEffect.unit ? selectedEffect.unit : ''}` : `${selectedEffect.label}: ${effectAutoValue}`;
    const labelText = selectedEffect.key === 'rd' && rdDamageType
      ? `${baseLabel} (${DAMAGE_TYPE_LABELS[rdDamageType]})`
      : baseLabel;
    const dur = durationKind === 'imediata' ? 1 : durationKind === 'duradoura' ? duradouraRounds : -1;
    const buffTypeMap: Record<string, SpellBuff['type']> = {
      'defesa': 'ca',
      'cd_ataque': 'hit',
      'pericia': 'skill',
      'atributo': 'attribute',
      'dano_durante': 'extraDice',
      'dano_apos': 'extraDiceAfter',
      'dano_fixo': 'damageBonus',
      'rd': 'rd',
      'tr': 'tr',
      'movimento_up': 'movement',
      'movimento_down': 'movement',
      'niveis_dano': 'damageLevels',
      'critico': 'critMargin',
      'negacao_rd': 'negacaoRd',
      'alcance_cac': 'attribute',
      'alcance_dist': 'attribute'
    };

    let buffValue = 0;
    let eCount = 0;
    let eSides = 0;

    if (valueIsNumeric) {
      buffValue = effectAutoValue as number;
    } else if (typeof effectAutoValue === 'string') {
      const parsed = parseDice(effectAutoValue);
      if (parsed) {
        eCount = parsed.count;
        eSides = parsed.sides;
      }
    }

    setBuffs([...buffs, {
      type: buffTypeMap[selectedEffect.key] || 'attribute',
      targetName: labelText,
      value: buffValue,
      extraDiceCount: eCount || undefined,
      extraDiceSides: eSides || undefined,
      durationTurns: dur,
      // @ts-ignore - temporary extra field for local cost tracking
      effectLevel: selectedEffectLevel
    }]);
  };

  // MULTIPLE EFFECTS BUDGET LOGIC
  const totalPEBudget = PE_COST[spellLevel] || 0;
  // @ts-ignore
  const usedPE = buffs.reduce((sum, b) => sum + (PE_COST[b.effectLevel || spellLevel] || 0), 0);
  const remainingPE = totalPEBudget - usedPE;
  const costOfSelected = PE_COST[selectedEffectLevel] || 0;
  const canAffordEffect = costOfSelected <= remainingPE || (buffs.length === 0 && costOfSelected <= totalPEBudget);

  const handleAddCondition = () => {
    const sev = getCondSeverity(condForm.conditionId);
    const maxDur = getMaxCondDuration(spellLevel, sev, isFocusedCondition);
    const initialMax = sev === 'extrema' ? 1 : maxDur;
    let dur = Math.min(condForm.durationRounds, initialMax);
    if (dur < 1) dur = Math.max(1, initialMax);
    const cost = COND_DICE_COST[sev];
    if (cost > remainingDiceAfterConditions) return;
    if (conditions.length >= maxConditionsPerSpell) return;
    setConditions([...conditions, { ...condForm, durationRounds: dur }]);
    // Reset form with proper initial max
    const firstAllowed = ALL_CONDITIONS.find(c => isCondAllowed(spellLevel, c.id, isFocusedCondition)) || ALL_CONDITIONS[0];
    const firstSev = getCondSeverity(firstAllowed.id);
    setCondForm({
      conditionId: firstAllowed.id,
      durationTurns: 0,
      durationRounds: getInitialCondDuration(spellLevel, firstSev, isFocusedCondition),
    });
    setAddingCondition(false);
  };

  const startAddCondition = () => {
    const firstAllowed = allowedConditions.find(c => COND_DICE_COST[getCondSeverity(c.id)] <= remainingDiceAfterConditions) || allowedConditions[0] || ALL_CONDITIONS[0];
    const firstSev = getCondSeverity(firstAllowed.id);
    // Bug fix: initial durationRounds = max permitted (≥1)
    setCondForm({
      conditionId: firstAllowed.id,
      durationTurns: 0,
      durationRounds: getInitialCondDuration(spellLevel, firstSev, isFocusedCondition),
    });
    setAddingCondition(true);
  };

  // === TRADE UNIT BUTTON ===
  function TradeButton({ label, value, type, unit }: { label: string; value: number; type: 'dice' | 'hit' | 'range' | 'cd'; unit: string }) {
    const setFn = type === 'dice' ? setDiceAdj : type === 'hit' ? setHitAdj : type === 'range' ? setRangeAdj : setCdAdj;
    const canInc = canAdjust(type, 1);
    const canDec = canAdjust(type, -1);
    const maxLabel = type === 'dice' ? `±${maxDiceAdj}` : type === 'hit' ? `±${maxHitAdj}` : type === 'cd' ? `±${maxCDAdj}` : '∞';

    return (
      <div className="rounded-lg border border-border bg-secondary/20 p-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
          <span className="text-xs text-muted-foreground">Lim: {maxLabel}</span>
        </div>
        <div className="flex items-center gap-1 justify-center">
          <button
            onClick={() => { if (canDec) setFn(value - 1); }}
            disabled={!canDec}
            className={cn('h-7 w-7 rounded-lg text-sm font-bold flex items-center justify-center transition-colors',
              canDec ? 'bg-hp/20 text-hp hover:bg-hp/30' : 'bg-secondary/30 text-muted-foreground/30 cursor-not-allowed')}
            title={!canDec ? limitReachedTooltip : `Reduzir ${label}`}
          >−</button>
          <span className={cn('font-mono font-bold text-lg w-10 text-center', value > 0 ? 'text-neon-green' : value < 0 ? 'text-hp' : 'text-foreground')}>
            {value > 0 ? '+' : ''}{value}
          </span>
          <button
            onClick={() => { if (canInc) setFn(value + 1); }}
            disabled={!canInc}
            className={cn('h-7 w-7 rounded-lg text-sm font-bold flex items-center justify-center transition-colors',
              canInc ? 'bg-neon-green/20 text-neon-green hover:bg-neon-green/30' : 'bg-secondary/30 text-muted-foreground/30 cursor-not-allowed')}
            title={!canInc ? limitReachedTooltip : `Aumentar ${label}`}
          >+</button>
        </div>
        <div className="text-xs text-center text-muted-foreground">{unit}</div>
      </div>
    );
  }

  // Show pool for: damage, heal, focused condition (becomes budget), or debuff
  // REMOVED isDebuff from showPool per request "remover dados de debuff"
  const showPool = isDamage || spellType === 'heal' || isFocusedCondition;

  // ════════════════════════════════════════════════════════════════════════
  // NÍVEL 0 — feitiços de Nv 0 são propostas livres ao Mestre (apenas nome
  // + descrição). O Mestre é quem decide os efeitos finais. Para o player,
  // a criação SEMPRE vira proposta (mesmo sem o toggle ativo).
  // ════════════════════════════════════════════════════════════════════════
  if (spellLevel === '0') {
    const buildLv0Spell = (): Spell => ({
      id: initialSpell?.id || crypto.randomUUID(),
      name: name.trim(),
      costPE: 0,
      description: description.trim(),
      damageDice: '',
      damageBonus: 0,
      spellType: 'damage', // default — Mestre ajusta no editor
      actionType: 'action',
      buffs: [],
      conditions: [],
      spellLevel: '0',
      durationRounds: 0,
      range: 'Toque',
      targetMode: 'single_atk',
      attackType: 'cursed',
    });
    const lv0CanProposal = !!onSubmitProposal && !isMaster && !forceMasterMode;
    return (
      <div
        className="mt-2 space-y-3 rounded-xl border-2 p-3 text-sm"
        style={{ backgroundColor: '#1A1A1B', borderColor: '#7C3AED66' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" style={{ color: '#7C3AED' }} />
            <span className="font-bold text-foreground text-base">Feitiço Nv 0 — Proposta ao Mestre</span>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1 hover:bg-secondary"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs text-muted-foreground">
          Feitiços de <strong className="text-primary">Nível 0</strong> são apenas <strong>nome</strong> e <strong>descrição</strong>.
          Eles são enviados automaticamente para análise do Mestre, que decide custo, dano e efeitos.
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Nível</label>
          <select value={spellLevel} onChange={(e) => setSpellLevel(e.target.value as SpellLevel)} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground">
            {SPELL_LEVELS.map((lv) => {
              const numLv = parseInt(lv);
              const maxAllowed = charLevel >= 17 ? 5 : charLevel >= 13 ? 4 : charLevel >= 9 ? 3 : charLevel >= 5 ? 2 : 1;
              const isNumLocked = !isNaN(numLv) && numLv > maxAllowed;
              const isMaxLocked = lv === 'Técnica Máxima' && !hasTecnicaMaxima;
              const isRevLocked = lv === 'Técnica Reversa' && !hasTecnicaReversa;
              const isLocked = isNumLocked || isMaxLocked || isRevLocked;
              return <option key={lv} value={lv} disabled={isLocked}>{lv}{isLocked ? ' 🔒' : ''}</option>;
            })}
          </select>
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do Feitiço" className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground font-medium" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (o que o feitiço faz, narrativa, intenção)" className="min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" />
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (!name.trim()) return;
              const built = buildLv0Spell();
              if (lv0CanProposal) onSubmitProposal!(built);
              else onAdd(built);
            }}
            disabled={!name.trim() || atSpellLimit}
            className="h-9 flex-1 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-white"
            style={{ backgroundColor: '#7C3AED' }}
          >
            <Wand2 className="h-4 w-4" />
            {lv0CanProposal ? 'Enviar para o Mestre' : (initialSpell ? 'Salvar Alterações' : 'Criar Feitiço')}
          </button>
          <button onClick={onCancel} className="h-9 rounded-lg bg-secondary px-4 text-secondary-foreground">Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mt-2 space-y-3 rounded-xl border-2 p-3 text-sm"
      style={{ backgroundColor: '#1A1A1B', borderColor: '#7C3AED66' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4" style={{ color: '#7C3AED' }} />
          <span className="font-bold text-foreground text-base">Assistente de Criação</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMaldicaoMode(v => !v)}
            title="Alternar Modo Maldição (Grimório): cálculos por ND/Patamar"
            className={cn('rounded-md px-2 py-1 text-[10px] font-bold border transition-colors flex items-center gap-1',
              maldicaoMode
                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                : 'bg-secondary/40 text-muted-foreground border-border hover:border-red-500/30')}
          >
            <Skull className="h-3 w-3" /> {maldicaoMode ? 'Modo Maldição' : 'Modo Maldição'}
          </button>
          {!isMaster && !forceMasterMode && (
            <button
              onClick={() => setPlayerMasterToggle(v => !v)}
              disabled={difficultyLevel !== 'none'}
              title={difficultyLevel !== 'none' ? 'Requisito ativo: Modo Mestre obrigatório' : 'Alternar Modo Concreto / Modo Mestre'}
              className={cn('rounded-md px-2 py-1 text-[10px] font-bold border transition-colors',
                (playerMasterToggle || difficultyLevel !== 'none')
                  ? 'bg-primary/20 text-primary border-primary/40'
                  : 'bg-secondary/40 text-muted-foreground border-border hover:border-primary/30')}
            >
              {(playerMasterToggle || difficultyLevel !== 'none') ? '🧙 Modo Mestre' : '📜 Modo Concreto'}
            </button>
          )}
          <button onClick={onCancel} className="rounded-lg p-1 hover:bg-secondary"><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
      </div>

      {atSpellLimit && (
        <div className="rounded-lg border border-hp/30 bg-hp/10 p-2 text-xs text-hp font-bold flex items-center gap-2">
          <Lock className="h-4 w-4" /> Limite de feitiços atingido ({currentSpellCount}/{maxSpells}).
        </div>
      )}

      {/* ═══════ PAINEL MODO MALDIÇÃO (GRIMÓRIO) ═══════ */}
      {maldicaoMode && (
        <div className="space-y-3 rounded-xl border-2 border-red-500/40 bg-red-950/20 p-3">
          <div className="flex items-center gap-2">
            <Skull className="h-4 w-4 text-red-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-red-300">Modo Maldição — Grimório F&amp;M 2.5</span>
            <span className="text-[10px] text-muted-foreground">(sobrescreve dano/acerto/CD)</span>
          </div>

          {/* Patamar + ND + Dificuldade */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-muted-foreground font-bold">Patamar</label>
              <select value={mPatamar} onChange={(e) => setMPatamar(e.target.value as MaldicaoPatamar)}
                className="h-8 w-full rounded border border-input bg-background px-2 text-xs text-foreground">
                {(Object.keys(PATAMAR_LABELS) as MaldicaoPatamar[]).map(p => (
                  <option key={p} value={p}>{PATAMAR_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-muted-foreground font-bold">
                ND (BT +{maldicaoBT})
              </label>
              <input type="number"
                min={PATAMAR_ND_RANGE[mPatamar].min}
                max={PATAMAR_ND_RANGE[mPatamar].max}
                value={mND}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || PATAMAR_ND_RANGE[mPatamar].min;
                  const { min, max } = PATAMAR_ND_RANGE[mPatamar];
                  setMND(Math.max(min, Math.min(max, v)));
                }}
                className="h-8 w-full rounded border border-input bg-background px-2 text-xs text-foreground" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-muted-foreground font-bold">Dificuldade</label>
              <select value={mDifficulty} onChange={(e) => setMDifficulty(e.target.value as MaldicaoDifficulty)}
                className="h-8 w-full rounded border border-input bg-background px-2 text-xs text-foreground">
                <option value="iniciante">Iniciante</option>
                <option value="intermediario">Intermediário</option>
                <option value="experiente">Experiente</option>
              </select>
            </div>
          </div>

          {/* Tipo de Alvo */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-muted-foreground font-bold">Tipo de Resolução</label>
            <div className="flex gap-1 flex-wrap">
              {([
                { v: 'acerto', l: '🎯 Teste de Acerto', t: 'Dano cheio da tabela' },
                { v: 'tr_ind', l: '🛡 TR Individual', t: 'Dano de 1 ND abaixo' },
                { v: 'tr_area', l: '💥 TR em Área', t: 'Dano pela metade' },
              ] as { v: MaldicaoTarget; l: string; t: string }[]).map(o => (
                <button key={o.v} onClick={() => setMTarget(o.v)} title={o.t}
                  className={cn('flex-1 rounded border px-2 py-1.5 text-[10px] font-bold transition-all',
                    mTarget === o.v ? 'bg-red-500/30 text-red-200 border-red-500/60' : 'bg-secondary/30 text-muted-foreground border-border hover:border-red-500/30')}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* Narrativa física + Mod Atributo */}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded border border-input bg-background px-2 py-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={mPhysicalNarrative} onChange={(e) => setMPhysicalNarrative(e.target.checked)} />
              <span className="text-foreground">Narrativa física (-2 dados)</span>
            </label>
            <div className="flex items-center gap-2 rounded border border-input bg-background px-2 py-1">
              <label className="text-[10px] uppercase text-muted-foreground font-bold whitespace-nowrap">Mod Atributo</label>
              <input type="number" value={mAttrMod || ''}
                onChange={(e) => setMAttrMod(parseInt(e.target.value) || 0)}
                placeholder="0"
                className="h-7 flex-1 rounded border-0 bg-transparent text-xs text-foreground" />
            </div>
          </div>

          {/* Trocas dado → acerto / CD */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 space-y-2">
            <div className="text-[10px] uppercase tracking-wider font-bold text-amber-300">
              ⚖ Conversões oficiais: 1 dado = +2 acerto = +1 CD
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-muted-foreground whitespace-nowrap">−Dados → +Acerto</label>
                <button onClick={() => setMHitTrade(Math.max(0, mHitTrade - 1))} className="h-6 w-6 rounded bg-secondary text-xs font-bold">−</button>
                <span className="text-xs font-bold text-amber-300 w-8 text-center">{mHitTrade}d → +{mHitTrade * 2}</span>
                <button onClick={() => setMHitTrade(Math.min(mFinal.dice + mHitTrade, mHitTrade + 1))}
                  disabled={mFinal.dice <= 0}
                  className="h-6 w-6 rounded bg-secondary text-xs font-bold disabled:opacity-30">+</button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-muted-foreground whitespace-nowrap">−Dados → +CD</label>
                <button onClick={() => setMCDTrade(Math.max(0, mCDTrade - 1))} className="h-6 w-6 rounded bg-secondary text-xs font-bold">−</button>
                <span className="text-xs font-bold text-amber-300 w-8 text-center">{mCDTrade}d → +{mCDTrade}</span>
                <button onClick={() => setMCDTrade(Math.min(mFinal.dice + mCDTrade, mCDTrade + 1))}
                  disabled={mFinal.dice <= 0}
                  className="h-6 w-6 rounded bg-secondary text-xs font-bold disabled:opacity-30">+</button>
              </div>
            </div>
          </div>

          {/* Custo de Condições */}
          {conditions.length > 0 && (
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider font-bold text-purple-300">
                  Custo de Condições ({conditions.length})
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setMCondCost('pe')}
                    className={cn('rounded px-2 py-0.5 text-[10px] font-bold border',
                      mCondCost === 'pe' ? 'bg-pe/20 text-pe border-pe/40' : 'bg-secondary/30 text-muted-foreground border-border')}>
                    Pagar em PE
                  </button>
                  <button onClick={() => setMCondCost('nd')}
                    className={cn('rounded px-2 py-0.5 text-[10px] font-bold border',
                      mCondCost === 'nd' ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-secondary/30 text-muted-foreground border-border')}>
                    Reduzir NDs
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Fraca: 2PE/1ND • Média: 5PE/2ND • Forte: 8PE/3ND • Extrema: 10PE/4ND (não mescla)
              </div>
              <div className="text-xs font-bold">
                {mCondCost === 'pe'
                  ? <span className="text-pe">Custo extra: +{mCondPECost} PE</span>
                  : <span className="text-red-300">Redução: −{mCondNDReduction} ND (dano usa ND {mFinalND})</span>}
              </div>
            </div>
          )}

          {/* Resultado Final do Grimório */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg border border-red-500/40 bg-red-950/40 p-2">
            <div>
              <div className="text-[10px] text-muted-foreground">Tabela ({PATAMAR_LABELS[mPatamar]} ND{mFinalND})</div>
              <div className="text-sm font-bold text-foreground">{mGrimorioPack.raw}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Dano Final</div>
              <div className="text-base font-bold text-hp">
                {mDiceStr || '—'}{mFinal.fixed > 0 ? `+${mFinal.fixed}` : ''}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Acerto</div>
              <div className="text-base font-bold text-neon-green">
                +{mFinal.acerto}
                <span className="text-[10px] text-muted-foreground ml-1">(base {mFinal.acertoBase})</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">CD</div>
              <div className="text-base font-bold text-neon-yellow">
                {mFinal.cd}
                <span className="text-[10px] text-muted-foreground ml-1">(base {mFinal.cdBase})</span>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Name & Description */}
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do Feitiço" className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground font-medium" />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground" />

      {/* Special Tags (e.g. Marca Registrada) */}
      {(availableTags.length > 0 || selectedTag) && (
        <div className="flex items-center gap-2 rounded-lg border border-neon-green/30 bg-neon-green/10 p-2">
          <span className="text-xs font-bold text-neon-green uppercase tracking-wider">Tag Especial</span>
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs text-foreground font-medium"
          >
            <option value="">-- Nenhuma --</option>
            {/* Combine available tags with current selected tag if not present */}
            {Array.from(new Set([...availableTags.map(t => t.label), ...(selectedTag ? [selectedTag] : [])])).map(tagLabel => {
              const tagObj = availableTags.find(t => t.label === tagLabel);
              const discount = tagObj?.discountPE || (tagLabel === selectedTag ? 1 : 0);
              return (
                <option key={tagLabel} value={tagLabel}>
                  {tagLabel} {discount > 0 ? `(-${discount} PE)` : ''}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Row 1: Level + Type + Action + Target Mode */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Nível</label>
          <select value={spellLevel} onChange={(e) => handleLevelChange(e.target.value as SpellLevel)} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground">
            {SPELL_LEVELS.map((lv) => {
              const numLv = parseInt(lv);
              const maxAllowed = charLevel >= 17 ? 5 : charLevel >= 13 ? 4 : charLevel >= 9 ? 3 : charLevel >= 5 ? 2 : 1;
              const isNumLocked = !isNaN(numLv) && numLv > maxAllowed;
              const isMaxLocked = lv === 'Técnica Máxima' && !hasTecnicaMaxima;
              const isRevLocked = lv === 'Técnica Reversa' && !hasTecnicaReversa;
              const isLocked = isNumLocked || isMaxLocked || isRevLocked;
              const lockLabel = isMaxLocked
                ? ' 🔒 (req: aptidão Técnica Máxima)'
                : isRevLocked
                  ? ' 🔒 (req: aptidão Reversão de Técnica)'
                  : isNumLocked ? ' 🔒' : '';
              return <option key={lv} value={lv} disabled={isLocked}>{lv}{lockLabel}</option>;
            })}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Tipo de Foco</label>
          <select value={spellType} onChange={(e) => handleTypeChange(e.target.value as AssistSpellType)} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground">
            <option value="damage">⚔️ Dano</option>
            <option value="heal">💚 Cura</option>
            <option value="buff">✨ Buff</option>
            <option value="debuff">💀 Debuff</option>
            <option value="condition">⚠️ Foco em Condições</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Ação</label>
          <select value={actionType} onChange={(e) => handleActionTypeChange(e.target.value as Spell['actionType'])} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground">
            <option value="action">AC (Comum)</option>
            <option value="bonus">AB (Bônus)</option>
            <option value="rapida">AR (Rápida)</option>
            <option value="reaction">RÇ (Reação)</option>
            <option value="movimento">MV (Movimento)</option>
            <option value="free">LV (Livre)</option>
            <option value="full">Completa</option>
          </select>
        </div>
        {(spellType === 'damage' || spellType === 'debuff' || spellType === 'condition') && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Modo Alvo</label>
            <select value={targetMode} onChange={(e) => { setTargetMode(e.target.value as SpellTargetMode); resetTrades(); }} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground">
              {SPELL_TARGET_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* === DURATION KIND (Buff/Debuff) === */}
      {isBuffOrDebuff && (
        <div className="space-y-2 rounded-lg border p-2" style={{ borderColor: '#7C3AED66', backgroundColor: '#7C3AED10' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7C3AED' }}>⏱ Tipo de Duração</span>
          </div>
          <select
            value={durationKind}
            onChange={(e) => setDurationKind(e.target.value as DurationKind)}
            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
          >
            <option value="imediata">⚡ Imediata — 1 ataque/rodada (pode ser Reação)</option>
            <option value="duradoura">⌛ Duradoura — máx {getMaxDuradouraRounds(spellLevel)} rodadas</option>
            <option value="sustentada">♾ Sustentada — Cena ({getSustainedPEPerRound(spellLevel)} PE/rd)</option>
          </select>
          <div className="text-xs text-muted-foreground">{DURATION_KIND_DESCRIPTIONS[durationKind]}</div>

          {durationKind === 'duradoura' && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Rodadas:</label>
              <input
                type="number"
                min={1}
                max={getMaxDuradouraRounds(spellLevel)}
                value={duradouraRounds}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 1;
                  setDuradouraRounds(Math.max(1, Math.min(v, getMaxDuradouraRounds(spellLevel))));
                }}
                className="h-7 w-16 rounded border border-input bg-background px-1 text-xs text-foreground"
              />
              <span className="text-xs text-muted-foreground">(máx {getMaxDuradouraRounds(spellLevel)})</span>
            </div>
          )}

          {durationKind === 'sustentada' && (
            <div className="flex items-start gap-2 rounded border p-2 text-xs" style={{ borderColor: '#FBBF2466', backgroundColor: '#FBBF2410' }}>
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#FBBF24' }} />
              <span style={{ color: '#FBBF24' }}>
                <strong>Apenas 1 feitiço sustentado pode estar ativo por vez.</strong> Consome {getSustainedPEPerRound(spellLevel)} PE a cada rodada enquanto ativo.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Action type dice modifier info */}
      {(isDamage || isFocusedCondition) && actionDiceMod !== 0 && (
        <div className={cn("rounded-lg border p-2 text-xs", actionDiceMod > 0 ? 'border-neon-green/30 bg-neon-green/10' : 'border-hp/30 bg-hp/10')}>
          <div className={cn("font-bold", actionDiceMod > 0 ? 'text-neon-green' : 'text-hp')}>
            {actionType === 'full' ? '⚔️ Ação Completa' : '⚡ Ação Bônus'}: {actionDiceMod > 0 ? '+' : ''}{actionDiceMod}d
            {isFocusedCondition && ' (Orçamento)'}
          </div>
        </div>
      )}

      {/* New Section: Attack Type & Linked Attribute */}
      {targetMode === 'single_atk' && (
        <div className="space-y-4 p-4 rounded-xl bg-secondary/20 border border-border">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
              ⚔️ Tipo de Acerto
            </label>
            <div className="flex gap-2">
              {(['melee', 'ranged', 'cursed'] as const).map(atk => (
                <button
                  key={atk}
                  onClick={() => setAttackType(atk)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all',
                    attackType === atk ? 'bg-primary/20 text-primary border-primary/40 shadow-sm' : 'bg-secondary/30 text-muted-foreground border-border hover:border-primary/30'
                  )}
                >
                  {atk === 'melee' ? 'Corpo a Corpo' : atk === 'ranged' ? 'A Distância' : 'Amaldiçoado'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TR save attribute/save selector */}
      {needsTR && (
        <div className="space-y-3 p-4 rounded-xl bg-secondary/20 border border-neon-yellow/30">
          <label className="text-xs font-bold uppercase tracking-wider text-neon-yellow flex items-center gap-1">
            🎯 Atributo OU Teste de Resistência (alvo)
          </label>
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Atributo</div>
            <div className="flex gap-1 flex-wrap">
              {SAVE_ATTRS.map(s => (
                <button
                  key={s}
                  onClick={() => setSaveAttr(s)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-bold transition-all',
                    saveAttr === s ? 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/50 shadow-sm' : 'bg-secondary/30 text-muted-foreground border-border hover:border-neon-yellow/30'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Teste de Resistência</div>
            <div className="flex gap-1 flex-wrap">
              {DEFAULT_SAVING_THROWS.map(s => (
                <button
                  key={s}
                  onClick={() => setSaveAttr(s)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-bold transition-all',
                    saveAttr === s ? 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/50 shadow-sm' : 'bg-secondary/30 text-muted-foreground border-border hover:border-neon-yellow/30'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">O alvo rolará d20 + bônus de {saveAttr} (+ ½ nível, treino, etc.) contra a CD.</p>
        </div>
      )}

      {/* Area shape & line specifics */}
      {isArea && (spellType === 'damage' || spellType === 'debuff' || spellType === 'condition') && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Forma da Área</label>
              <select value={areaShape} onChange={(e) => handleAreaShapeChange(e.target.value as AreaShape)} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground">
                {AREA_SHAPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">
                {isLine ? 'Comprimento base' : 'Área Afetada (raio)'}: {isLine ? `${getLineAreaSize(autoAreaSize)}m` : `${autoAreaSize}m`}
              </label>
              <div className="text-sm font-bold text-foreground px-2 py-1 bg-secondary/30 rounded-lg">
                {isLine ? `${effectiveLineLength}m x ${lineWidth}m` : `${effectiveAreaSize}m`}
              </div>
            </div>
          </div>
          {isLine && (
            <div className="rounded-lg border p-2 text-xs space-y-1" style={{ borderColor: '#7C3AED66', backgroundColor: '#7C3AED10' }}>
              <div className="font-bold" style={{ color: '#7C3AED' }}>➖ Feitiço em Linha</div>
              <p className="text-muted-foreground">Dados bônus (linha): <span className="text-neon-green font-bold">+{lineBonusDice}d</span></p>
              <p className="text-muted-foreground">Largura +1,5m custa 4,5m de comprimento. Mínimo absoluto: 1,5m.</p>
              <div className="flex items-center gap-2 mt-1">
                <label className="text-xs text-muted-foreground">Largura:</label>
                <button onClick={() => setLineWidth(Math.max(1.5, lineWidth - 1.5))} disabled={lineWidth <= 1.5} className="h-6 w-6 rounded bg-secondary text-foreground text-xs flex items-center justify-center disabled:opacity-30">-</button>
                <span className="text-sm font-bold text-foreground w-12 text-center">{lineWidth}m</span>
                <button onClick={() => setLineWidth(lineWidth + 1.5)} className="h-6 w-6 rounded bg-secondary text-foreground text-xs flex items-center justify-center">+</button>
                {extraLineWidth > 0 && <span className="text-hp text-xs">(-{lineWidthPenalty}m comprimento)</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ TRADE SYSTEM ═══════ */}
      {showPool && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              ⚖️ Pool de Trocas {isFocusedCondition && <span className="text-neon-yellow">(→ Orçamento)</span>}
            </span>
            <div className="flex items-center gap-2">
              {isDebuff ? (
                <>
                  <span className={cn('text-xs font-bold rounded-full px-2 py-0.5 border',
                    poolBalance >= 1 ? 'bg-neon-green/20 text-neon-green border-neon-green/40' :
                      poolBalance === 0 ? 'bg-secondary/30 text-muted-foreground border-border' :
                        'bg-hp/20 text-hp border-hp/40'
                  )}>
                    Pool D/A: {poolBalance > 0 ? '+' : ''}{poolBalance}
                  </span>
                  <span className={cn('text-xs font-bold rounded-full px-2 py-0.5 border',
                    debuffRangePoolBalance >= 1 ? 'bg-neon-green/20 text-neon-green border-neon-green/40' :
                      'bg-secondary/30 text-muted-foreground border-border'
                  )}>
                    Pool Alc/CD: {debuffRangePoolBalance > 0 ? '+' : ''}{debuffRangePoolBalance}
                  </span>
                </>
              ) : (
                <span className={cn('text-xs font-bold rounded-full px-2 py-0.5 border',
                  poolBalance >= 1 ? 'bg-neon-green/20 text-neon-green border-neon-green/40' :
                    poolBalance === 0 ? 'bg-secondary/30 text-muted-foreground border-border' :
                      'bg-hp/20 text-hp border-hp/40'
                )}>
                  Pool: {poolBalance > 0 ? '+' : ''}{poolBalance}
                </span>
              )}
              <button onClick={resetTrades} className="text-xs text-muted-foreground hover:text-foreground px-1">↺ Reset</button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/10 p-2 text-xs text-muted-foreground">
            <span className="font-bold text-foreground">1 Unidade =</span>
            {' '}{isFocusedCondition ? '+1d Orçamento' : '+1d Dano'}
            {spellType !== 'heal' && <>{' '}| +2 Acerto</>}
            {' '}| {isArea && !isLine ? '+1,5m Raio + Alcance' : isLine ? '+4,5m Comprimento' : '+6m Alcance'}
            {needsTR && spellType !== 'heal' && <>{' '}| +1 CD</>}
            {isArea && !isLine && !isDebuff && <div className="mt-1 text-amber-400">⚠ Área: Alcance e Raio reduzem juntos (vínculo)</div>}
          </div>

          <div className={cn("grid gap-2", spellType === 'heal' ? 'grid-cols-2' : (isLine ? (needsTR ? 'grid-cols-3' : 'grid-cols-2') : (needsTR ? 'grid-cols-4' : 'grid-cols-3')))}>
            <TradeButton
              label={isFocusedCondition ? '🎲 Orçamento' : '🎲 Dados'}
              value={diceAdj}
              type="dice"
              unit={`${diceAdj > 0 ? '+' : ''}${diceAdj}d`}
            />
            {spellType !== 'heal' && (
              <TradeButton label="🎯 Acerto" value={hitAdj} type="hit" unit={`${effectiveHitBonus > 0 ? '+' : ''}${effectiveHitBonus} acerto`} />
            )}
            {!isLine && (
              <TradeButton
                label={isArea ? '🔴 Área+Alc' : '📏 Alcance'}
                value={rangeAdj}
                type="range"
                unit={isArea ? `${rangeAdj > 0 ? '+' : ''}${rangeAdj * 1.5}m` : `${rangeAdj > 0 ? '+' : ''}${rangeAdj * 6}m`}
              />
            )}
            {isLine && (
              <TradeButton label="📏 Compr." value={rangeAdj} type="range" unit={`${rangeAdj > 0 ? '+' : ''}${rangeAdj * 4.5}m`} />
            )}
            {spellType !== 'heal' && needsTR && (
              <TradeButton label="🛡 CD" value={cdAdj} type="cd" unit={`${cdAdj > 0 ? '+' : ''}${cdAdj} CD`} />
            )}
          </div>
        </div>
      )}

      {/* ═══════ DIFFICULTY REQUIREMENT ═══════ */}
      <div className="space-y-2 border-t border-border pt-2">
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">📋 Dificuldade do Requisito</span>
        <select
          value={difficultyLevel}
          onChange={(e) => setDifficultyLevel(e.target.value as DifficultyLevel)}
          className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
        >
          {Object.entries(DIFFICULTY_TABLE).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
        {difficultyLevel !== 'none' && (
          <>
            <div className="rounded-lg border border-neon-yellow/30 bg-neon-yellow/10 p-2 text-xs">
              <span className="text-neon-yellow font-bold">+{diffBonus.pe} PE</span> | <span className="text-neon-green font-bold">+{diffBonus.dice}d dano</span>
            </div>
            <textarea
              value={difficultyDesc}
              onChange={(e) => setDifficultyDesc(e.target.value)}
              placeholder="Descrição do requisito (ex: 'Exige um sacrifício de sangue'...)"
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 resize-y"
            />
          </>
        )}
      </div>

      {/* Auto-computed stats display */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border border-pe/30 bg-pe/10 p-2">
          <div className="text-xs text-muted-foreground">Custo PE</div>
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-pe">{effectivePE}</span>
            {isMaster && (customPE === null ? (
              <button onClick={() => setCustomPE(effectivePE)} className="text-xs text-muted-foreground hover:text-foreground">(editar)</button>
            ) : (
              <div className="flex items-center gap-1">
                <input type="number" value={customPE} onChange={(e) => setCustomPE(parseInt(e.target.value) || 0)} className="h-6 w-12 rounded border border-input bg-background px-1 text-xs text-foreground" />
                <button onClick={() => setCustomPE(null)} className="text-xs" style={{ color: '#7C3AED' }}>auto</button>
              </div>
            ))}
          </div>
          {diffBonus.pe > 0 && <div className="text-xs text-neon-yellow mt-0.5">+{diffBonus.pe} requisito</div>}
        </div>

        {showDice && (
          <div className="rounded-lg border border-hp/30 bg-hp/10 p-2">
            <div className="text-xs text-muted-foreground">{spellType === 'heal' ? 'Cura' : 'Dano'}</div>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-hp">{effectiveDice}</span>
              {isMaster && (customDice === null ? (
                <button onClick={() => setCustomDice(effectiveDice)} className="text-xs text-muted-foreground hover:text-foreground">(editar)</button>
              ) : (
                <div className="flex items-center gap-1">
                  <input value={customDice} onChange={(e) => setCustomDice(e.target.value)} className="h-6 w-16 rounded border border-input bg-background px-1 text-xs text-foreground" />
                  <button onClick={() => setCustomDice(null)} className="text-xs" style={{ color: '#7C3AED' }}>auto</button>
                </div>
              ))}
            </div>
            {diffBonus.dice > 0 && <div className="text-xs text-neon-green mt-0.5">+{diffBonus.dice}d requisito</div>}
          </div>
        )}

        {isFocusedCondition && (
          <div className="rounded-lg border border-neon-yellow/30 bg-neon-yellow/10 p-2">
            <div className="text-xs text-muted-foreground">Orçamento</div>
            <div className="text-lg font-bold text-neon-yellow">{condBudgetDice}d</div>
            <div className="text-xs mt-0.5">Gastos: <span className="text-hp font-bold">{totalCondDiceCost}d</span> | Restam: <span className={cn("font-bold", remainingDiceAfterConditions > 0 ? 'text-neon-green' : 'text-hp')}>{remainingDiceAfterConditions}d</span></div>
          </div>
        )}

        {/* Effective hit bonus */}
        {effectiveHitBonus !== 0 && (
          <div className="rounded-lg border p-2" style={{ borderColor: '#7C3AED66', backgroundColor: '#7C3AED10' }}>
            <div className="text-xs text-muted-foreground">🎯 Bônus Acerto</div>
            <div className={cn("text-lg font-bold", effectiveHitBonus >= 0 ? 'text-neon-green' : 'text-hp')}>
              {effectiveHitBonus >= 0 ? '+' : ''}{effectiveHitBonus}
            </div>
          </div>
        )}

        <div className="rounded-lg border p-2" style={{ borderColor: '#7C3AED66', backgroundColor: '#7C3AED10' }}>
          <div className="text-xs text-muted-foreground">{isArea ? '🔴 Área Afetada' : '📏 Alcance'}</div>
          <div className="text-lg font-bold" style={{ color: '#7C3AED' }}>
            {isLine ? `${effectiveLineLength}m` : isArea ? `${effectiveAreaSize}m / ${effectiveRange}` : effectiveRange}
          </div>
          {rangeAdj !== 0 && <div className="text-xs text-muted-foreground">{rangeAdj > 0 ? '+' : ''}{isArea ? `${rangeAdj * 1.5}m` : `${rangeAdj * 6}m`} troca</div>}
        </div>

        {needsTR && (
          <div className="rounded-lg border border-neon-yellow/30 bg-neon-yellow/10 p-2">
            <div className="text-xs text-muted-foreground"><Shield className="h-3 w-3 inline" /> Mod. CD</div>
            <div className={cn("text-lg font-bold", effectiveCDBonus >= 0 ? 'text-neon-yellow' : 'text-hp')}>
              {effectiveCDBonus >= 0 ? '+' : ''}{effectiveCDBonus}
            </div>
          </div>
        )}
      </div>

      {/* Damage type, bonus, fixed damage */}
      <div className="grid grid-cols-3 gap-2">
        {showDamageType && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Tipo de Dano</label>
            <select value={damageType} onChange={(e) => setDamageType(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground">
              <option value="">Nenhum</option>
              {DAMAGE_TYPES.map((t) => <option key={t} value={t}>{DAMAGE_TYPE_ABBR[t]} — {DAMAGE_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
        )}
        {showDice && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Bônus fixo</label>
            <input type="number" value={damageBonus || ''} onChange={(e) => setDamageBonus(parseInt(e.target.value) || 0)} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground" />
          </div>
        )}
        {showDice && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium" title="Dano fixo (plano) somado ao dano final — reservado para reformulação do sistema de dano.">Dano fixo</label>
            <input
              type="number"
              min={0}
              value={fixedDamage || ''}
              onChange={(e) => setFixedDamage(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="0"
              className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
            />
          </div>
        )}
      </div>

      {/* Conditions Section */}
      {showConditions && (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
              Condições ({conditions.length}/{maxConditionsPerSpell})
            </span>
            {canAddMoreConditions ? (
              <button onClick={startAddCondition} className="text-xs text-hp hover:text-hp/80 font-medium">+ Condição</button>
            ) : (
              <span className="text-xs text-hp font-bold flex items-center gap-1">
                <Lock className="h-3 w-3" />
                {conditions.length >= maxConditionsPerSpell ? `Máx ${maxConditionsPerSpell} (= Nv)` : 'Sem dados restantes'}
              </span>
            )}
          </div>

          {L >= 5 && (
            <div className="rounded border p-1.5 text-xs flex items-start gap-1.5" style={{ borderColor: '#7C3AED66', backgroundColor: '#7C3AED10', color: '#A78BFA' }}>
              <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span>Nv ≥ 5: Condições Fracas adicionadas terão duração automática <strong>Cena</strong> (até o fim do combate).</span>
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            {(['fraca', 'média', 'forte', 'extrema'] as CondSeverity[]).map(sev => {
              const maxDur = getMaxCondDuration(spellLevel, sev, isFocusedCondition);
              const diceCost = COND_DICE_COST[sev];
              const canAfford = diceCost <= remainingDiceAfterConditions;
              return (
                <span key={sev} className={cn('rounded-full px-2 py-0.5 text-xs border',
                  maxDur > 0 && canAfford ? 'bg-secondary/50 text-foreground border-border' : 'bg-secondary/20 text-muted-foreground/50 border-border/50 line-through'
                )}>
                  {SEVERITY_LABELS[sev]}: {maxDur > 0 ? `${maxDur}rd max` : 'N/A'} <span className="text-neon-yellow">(-{diceCost}d)</span>
                </span>
              );
            })}
          </div>

          {conditions.map((sc, i) => {
            const cond = ALL_CONDITIONS.find(c => c.id === sc.conditionId);
            if (!cond) return null;
            const sev = getCondSeverity(sc.conditionId);
            const dur = sc.durationRounds === -1 ? 'Cena' : sc.durationTurns > 0 ? `${sc.durationTurns}t` : `${sc.durationRounds}rd`;
            const willBeCena = sev === 'fraca' && L >= 5;
            return (
              <div key={i} className="flex items-center gap-2 text-xs rounded-lg bg-hp/10 border border-hp/20 px-2 py-1">
                <span className="text-hp font-medium truncate">{cond.icon} {cond.name}</span>
                <span className="text-muted-foreground flex-shrink-0">{SEVERITY_LABELS[sev]}</span>
                <span className="text-muted-foreground flex-shrink-0">({willBeCena ? 'Cena' : dur})</span>
                <span className="text-neon-yellow flex-shrink-0">-{COND_DICE_COST[sev]}d</span>
                <button onClick={() => setConditions(conditions.filter((_, j) => j !== i))} className="ml-auto text-destructive/60 hover:text-destructive flex-shrink-0"><X className="h-3 w-3" /></button>
              </div>
            );
          })}

          {addingCondition && (
            <div className="flex gap-1 flex-wrap items-end rounded-lg border border-hp/20 bg-hp/5 p-2">
              <div className="space-y-0.5 flex-1 min-w-[140px]">
                <label className="text-xs text-muted-foreground">Condição</label>
                <select value={condForm.conditionId} onChange={(e) => {
                  const newId = e.target.value;
                  const sev = getCondSeverity(newId);
                  // Bug fix: initial value = max permitted (≥1) — not below 1 on first click
                  const initialDur = getInitialCondDuration(spellLevel, sev, isFocusedCondition);
                  setCondForm({ ...condForm, conditionId: newId, durationRounds: initialDur });
                }} className="h-7 w-full rounded border border-input bg-background px-1 text-xs text-foreground">
                  {allowedConditions.filter(c => COND_DICE_COST[getCondSeverity(c.id)] <= remainingDiceAfterConditions).map((c) => {
                    const sev = getCondSeverity(c.id);
                    return <option key={c.id} value={c.id}>{c.icon} {c.name} ({SEVERITY_LABELS[sev]} | -{COND_DICE_COST[sev]}d)</option>;
                  })}
                </select>
              </div>
              <div className="space-y-0.5">
                <label className="text-xs text-muted-foreground">Rodadas (max: {getMaxCondDuration(spellLevel, getCondSeverity(condForm.conditionId), isFocusedCondition)})</label>
                <input type="number" min={1} max={getMaxCondDuration(spellLevel, getCondSeverity(condForm.conditionId), isFocusedCondition)} value={condForm.durationRounds || 1} onChange={(e) => {
                  const max = getMaxCondDuration(spellLevel, getCondSeverity(condForm.conditionId), isFocusedCondition);
                  const v = parseInt(e.target.value) || 1;
                  setCondForm({ ...condForm, durationRounds: Math.max(1, Math.min(v, max)) });
                }} className="h-7 w-14 rounded border border-input bg-background px-1 text-xs text-foreground" />
              </div>
              <button onClick={handleAddCondition} className="h-7 rounded bg-hp/20 px-2 text-xs text-hp font-medium">OK</button>
              <button onClick={() => setAddingCondition(false)} className="h-7 rounded bg-secondary px-2 text-xs text-secondary-foreground">✕</button>
            </div>
          )}
        </div>
      )}

      {/* Buffs / Debuffs effect picker */}
      {isBuffOrDebuff && (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
              {isBuff ? '✨ Efeitos de Buff' : '💀 Efeitos de Debuff'} ({buffs.length})
            </span>
            <div className="rounded border px-2 py-1 text-xs flex gap-2 font-bold" style={{ borderColor: '#7C3AED66', backgroundColor: '#7C3AED10' }}>
              <span className="text-foreground">Orçamento (PE):</span>
              <span className="text-pe">{totalPEBudget}</span>
              <span className="text-muted-foreground">| Usado:</span>
              <span className="text-hp">{usedPE}</span>
              <span className="text-muted-foreground">| Resta:</span>
              <span className={cn(remainingPE >= 0 ? 'text-neon-green' : 'text-hp')}>{remainingPE}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Efeito</label>
              <select
                value={selectedEffectKey}
                onChange={(e) => setSelectedEffectKey(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
              >
                <option value="">— Selecionar —</option>
                {effectsCatalog.map(eff => (
                  <option key={eff.key} value={eff.key}>{eff.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nível do Efeito</label>
              <select
                value={selectedEffectLevel}
                onChange={(e) => setSelectedEffectLevel(e.target.value as SpellLevel)}
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
              >
                {SPELL_LEVELS.map(lv => (
                  <option key={lv} value={lv}>{lv}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{diceLabel} (auto)</label>
              <div className="h-8 flex items-center px-2 rounded-lg border border-input bg-secondary/30 text-sm font-bold" style={{ color: '#7C3AED' }}>
                {selectedEffect ? (
                  effectAutoValue === 0 || effectAutoValue === '—' ? <span className="text-muted-foreground">N/A neste nível</span> :
                    <>
                      {typeof effectAutoValue === 'number' && effectAutoValue > 0 ? '+' : ''}
                      {effectAutoValue}
                      {selectedEffect.unit ? selectedEffect.unit : ''}
                    </>
                ) : <span className="text-muted-foreground">—</span>}
              </div>
            </div>
          </div>

          {(spellType as string) === 'heal' && (
            <div className={cn("rounded-xl border p-4 transition-all", hasEnergiaReversa ? "border-pe/30 bg-pe/5" : "border-hp/30 bg-hp/5")}>
              <div className="flex items-start gap-3">
                <div className={cn("p-2 rounded-lg", hasEnergiaReversa ? "bg-pe/20 text-pe" : "bg-hp/20 text-hp")}>
                  <Info className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className={cn("text-sm font-bold", hasEnergiaReversa ? "text-pe" : "text-hp")}>
                    {hasEnergiaReversa ? '💚 Energia Reversa Ativa' : '⚠️ Sem Energia Reversa'}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {hasEnergiaReversa 
                      ? 'Sua aptidão permite curar ferimentos reais. O feitiço restaurará Pontos de Vida (HP).' 
                      : 'Sem Energia Reversa, este feitiço concederá Pontos de Vida Temporários (Escudo) em vez de cura real.'}
                    <br /><strong>Nota:</strong> Nível 0 não pode curar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isBuffOrDebuff && isGolpeador && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/20 text-primary">
                  <Wand2 className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-primary">🥋 Especialização Golpeador</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Como Golpeador, bônus de alcance recebidos por feitiços são reduzidos pela metade.
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedEffect && (
            <>
              {selectedEffect.note && (
                <div className="rounded border border-border bg-secondary/20 p-2 text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  <span>{selectedEffect.note}</span>
                </div>
              )}

              {/* Renomeação dinâmica para Debuff: target picker (Atributo/Perícia/TR) */}
              {isDebuff && selectedEffect.key === 'prejuizo_rolagem' && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{sidesLabel}</label>
                  <select
                    value={buffForm.targetName || ''}
                    onChange={(e) => setBuffForm({ ...buffForm, targetName: e.target.value })}
                    className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                  >
                    <option value="">— Selecionar alvo —</option>
                    <optgroup label="Testes de Resistência">
                      {TR_TARGETS.map(t => <option key={t} value={`TR ${t}`}>TR {t}</option>)}
                    </optgroup>
                    <optgroup label="Atributos">
                      {ATTR_TARGETS.map(t => <option key={t} value={`Atributo ${t}`}>{t}</option>)}
                    </optgroup>
                    <optgroup label="Perícias">
                      {SKILL_TARGETS.map(t => <option key={t} value={`Perícia ${t}`}>{t}</option>)}
                    </optgroup>
                  </select>
                </div>
              )}

              {/* Seletor de Tipo de Dano para efeito RD (obrigatório) */}
              {selectedEffect.key === 'rd' && (
                <div className="space-y-1">
                  <label className="text-xs text-pe font-medium">🔰 Tipo de Dano da RD <span className="text-hp">*</span></label>
                  <select
                    value={rdDamageType}
                    onChange={(e) => setRdDamageType(e.target.value as DamageType | '')}
                    className="h-8 w-full rounded-lg border border-pe/40 bg-background px-2 text-sm text-foreground focus:border-pe focus:outline-none"
                  >
                    <option value="">— Selecione um tipo —</option>
                    {DAMAGE_TYPES.map(t => (
                      <option key={t} value={t}>{DAMAGE_TYPE_ABBR[t]} — {DAMAGE_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                  {!rdDamageType && (
                    <p className="text-[11px] text-hp italic">RD genérica não é mais permitida — escolha o tipo de dano.</p>
                  )}
                </div>
              )}

              <button
                onClick={handleAddBuffFromEffect}
                disabled={effectAutoValue === 0 || effectAutoValue === '—' || !selectedEffectKey || !canAffordEffect || (selectedEffect.key === 'rd' && !rdDamageType)}
                className={cn(
                  "h-8 w-full rounded-lg text-sm font-medium transition-colors",
                  (!selectedEffectKey || !canAffordEffect || (selectedEffect.key === 'rd' && !rdDamageType))
                    ? "bg-secondary/30 text-muted-foreground/50 cursor-not-allowed"
                    : isDebuff
                      ? "bg-hp/20 text-hp hover:bg-hp/30"
                      : "bg-pe/20 text-pe hover:bg-pe/30"
                )}
              >
                + Adicionar {isDebuff ? 'Debuff' : 'Buff'} {!canAffordEffect && `(Falta PE — Requer ${costOfSelected})`}
              </button>
            </>
          )}

          {/* List of added effects */}
          {buffs.map((b, i) => {
            const desc = b.targetName || (b.type === 'ca' ? `CA${b.value >= 0 ? '+' : ''}${b.value}` : `${b.type}+${b.value}`);
            const durLabel = b.durationTurns === -1 ? 'Cena' : `${b.durationTurns}rd`;
            // @ts-ignore
            const lvlCost = PE_COST[b.effectLevel || spellLevel] || 0;
            return (
              <div key={i} className={cn("flex items-center gap-1 text-xs rounded-lg border px-2 py-1",
                isDebuff ? 'bg-hp/10 border-hp/20' : 'bg-pe/10 border-pe/20'
              )}>
                <span className={cn("truncate", isDebuff ? 'text-hp' : 'text-pe')}>
                  {isDebuff ? '💀' : '✨'} {desc} ({durLabel}) <span className="opacity-60">[Nv {b.effectLevel || spellLevel} / -{lvlCost}PE]</span>
                </span>
                <button onClick={() => setBuffs(buffs.filter((_, j) => j !== i))} className="ml-auto text-destructive/60 hover:text-destructive flex-shrink-0"><X className="h-3 w-3" /></button>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="rounded-lg border border-border bg-secondary/30 p-2 text-xs space-y-1">
        <span className="font-bold text-foreground uppercase tracking-wider">Resumo</span>
        <div className="flex flex-wrap gap-2">
          <span className="text-pe">PE: {effectivePE}{durationKind === 'sustentada' && isBuffOrDebuff ? ` (+${getSustainedPEPerRound(spellLevel)}/rd)` : ''}</span>
          {showDice && <span className="text-hp">{spellType === 'heal' ? 'Cura' : 'Dano'}: {effectiveDice}{damageBonus > 0 ? `+${damageBonus}` : ''}</span>}
          {isFocusedCondition && <span className="text-neon-yellow">Sem dano (foco condições)</span>}
          <span style={{ color: '#7C3AED' }}>{isArea ? `Área: ${isLine ? `${effectiveLineLength}m` : `${effectiveAreaSize}m`}` : `Alcance: ${effectiveRange}`}</span>
          {effectiveHitBonus !== 0 && <span className={effectiveHitBonus > 0 ? 'text-neon-green' : 'text-hp'}>Acerto: {effectiveHitBonus > 0 ? '+' : ''}{effectiveHitBonus}</span>}
          {effectiveCDBonus !== 0 && <span className={effectiveCDBonus > 0 ? 'text-neon-yellow' : 'text-hp'}>CD: {effectiveCDBonus > 0 ? '+' : ''}{effectiveCDBonus}</span>}
          {conditions.length > 0 && <span className="text-hp">Condições: {conditions.length}</span>}
          {buffs.length > 0 && <span className="text-pe">{isDebuff ? 'Debuffs' : 'Buffs'}: {buffs.length}</span>}
          {isBuffOrDebuff && <span className="text-muted-foreground">Duração: {DURATION_KIND_LABELS[durationKind]}{durationKind === 'duradoura' ? ` (${duradouraRounds}rd)` : ''}</span>}
          {difficultyLevel !== 'none' && <span className="text-neon-yellow">Req: {DIFFICULTY_TABLE[difficultyLevel].label}</span>}
          {needsTR && <span className="text-muted-foreground">Requer TR</span>}
        </div>
      </div>

      {/* Save/Cancel */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            const requisitoForcesMaster = difficultyLevel !== 'none';
            const isPlayerMasterMode =
              !!onSubmitProposal && !isMaster && !forceMasterMode && (playerMasterToggle || requisitoForcesMaster);
            handleSave({ asProposal: isPlayerMasterMode });
          }}
          disabled={!name.trim() || atSpellLimit || poolBalance > 0 || (isDebuff && debuffRangePoolBalance > 0)}
          title={(poolBalance > 0 || (isDebuff && debuffRangePoolBalance > 0)) ? "Gaste todos os pontos da Pool de Trocas antes de salvar" : ""}
          className="h-9 flex-1 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-white"
          style={{ backgroundColor: '#7C3AED' }}
        >
          <Wand2 className="h-4 w-4" />
          {onSubmitProposal && !isMaster && !forceMasterMode && (playerMasterToggle || difficultyLevel !== 'none')
            ? 'Enviar para o Mestre'
            : (initialSpell ? 'Salvar Alterações' : 'Criar Feitiço')}
        </button>
        <button onClick={onCancel} className="h-9 rounded-lg bg-secondary px-4 text-secondary-foreground">Cancelar</button>
      </div>
    </div>
  );
}
