/**
 * ESPECIALISTA EM TÉCNICA — Fundamentos ativáveis + Conjuração Aprimorada (hook de dano extra).
 *
 * Este módulo concentra DOIS sistemas correlatos:
 *
 *  1) `spellDamageBonusByLevel` — dicionário CUSTOMIZÁVEL de dano extra por
 *     nível de feitiço (Nv 0..5 + 'Técnica Máxima' / 'Técnica Reversa').
 *     Começa VAZIO por design: o mestre do sistema preenche conforme for
 *     balanceando. O `calculateSpellDamageBonus` lê este mapa e soma AO
 *     bônus oficial de `getConjuracaoAprimoradaBonus`.
 *
 *  2) Fundamentos como TOGGLES de conjuração: no momento em que o jogador for
 *     lançar um feitiço, ele ativa/desativa cada fundamento adquirido; cada um
 *     altera PE, CD, acerto, alcance, área ou dano de forma isolada.
 *
 * Arquitetura:
 *   - `computeFundamentosModifiers(ctx)` devolve um `FundamentosOutcome` puro
 *     (sem side-effects). O `SpellApplyDialog` consome esse objeto para
 *     aplicar o custo e o modificador a cada tipo de feitiço (dano, TR, direto).
 *   - `rerollLowDamageDice(rolls, sides, threshold)` implementa o hook do
 *     "Feitiço Potente": re-rola qualquer dado cujo valor seja <= threshold.
 */
import type { Spell, SpellLevel } from '@/types';
import { rollDice } from '@/lib/dice';
import { getConjuracaoAprimoradaBonus } from '@/lib/tecnicaProgression';

// ============================================================================
// 1. spellDamageBonusByLevel — mapa customizável (preencher depois)
// ============================================================================

/**
 * Mapa de dano extra fixo aplicado APENAS a feitiços conjurados por um
 * Especialista em Técnica, indexado pelo nível do feitiço.
 *
 * Começa VAZIO. Preencha conforme a sua tabela de progressão (ex.:
 * `spellDamageBonusByLevel[3] = 5;`). Valores ausentes → 0.
 *
 * Este bônus é SOMADO ao bônus oficial da Conjuração Aprimorada
 * (`getConjuracaoAprimoradaBonus`), para permitir ajustes finos sem mexer
 * na tabela canônica.
 */
export const spellDamageBonusByLevel: Partial<Record<SpellLevel, number>> = {
  // '0': 0,
  // '1': 0,
  // '2': 0,
  // '3': 0,
  // '4': 0,
  // '5': 0,
  // 'Técnica Máxima': 0,
  // 'Técnica Reversa': 0,
};

/**
 * Hook de `calculateDamage` para feitiços.
 *
 * - Se NÃO for Especialista em Técnica → retorna 0 (neutro).
 * - Se for → retorna (tabela oficial) + (dicionário custom deste módulo).
 */
export function calculateSpellDamageBonus(args: {
  isTecnica: boolean;
  spellLevel: SpellLevel;
  keyMod: number;
  characterLevel: number;
}): number {
  if (!args.isTecnica) return 0;
  const official = getConjuracaoAprimoradaBonus(args.spellLevel, args.keyMod, args.characterLevel);
  const custom = spellDamageBonusByLevel[args.spellLevel] ?? 0;
  return official + custom;
}

// ============================================================================
// 2. Fundamentos ativáveis no momento da conjuração
// ============================================================================

/** IDs estáveis para os 8 Fundamentos (bate com `TECNICA_FUNDAMENTOS`). */
export type FundamentoId =
  | 'Feitiço Cruel'
  | 'Feitiço Cuidadoso'
  | 'Feitiço Distante'
  | 'Feitiço Duplicado'
  | 'Feitiço Expansivo'
  | 'Feitiço Potente'
  | 'Feitiço Preciso'
  | 'Feitiço Rápido';

/** Intensidade do toggle (para Fundamentos com 2 níveis de custo). */
export type FundamentoTier = 'off' | 't1' | 't2';

/** Estado de ativação do painel de toggles. */
export type FundamentosActivation = Partial<Record<FundamentoId, FundamentoTier>>;

// ---- Custos de PE (puros) -------------------------------------------------

/**
 * Custo extra de PE para Feitiço Duplicado: `2 × nivelDoFeitiço` (mín 1).
 * Nv 0 = 1. Técnica Máxima/Reversa = 1.
 */
export function getDuplicadoExtraPe(spellLevel: SpellLevel): number {
  const n = parseInt(String(spellLevel), 10);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, 2 * n);
}

/** Custo extra de PE para Feitiço Rápido: 2× nível do feitiço (mín 1 para Nv 0). */
export function getRapidoExtraPe(spellLevel: SpellLevel): number {
  const n = parseInt(String(spellLevel), 10);
  if (!Number.isFinite(n)) return 2;
  return Math.max(1, 2 * n);
}

/** Custo extra de PE para Feitiço Cuidadoso: igual ao Mod. INT/SAB do conjurador (mín 1). */
export function getCuidadosoExtraPe(keyMod: number): number {
  return Math.max(1, keyMod | 0);
}

// ---- Output puro do cálculo de modificadores ------------------------------

export interface FundamentosOutcome {
  /** Soma de PE ADICIONAL a deduzir além do custo-base do feitiço. */
  extraPe: number;
  /** Bônus fixo aplicado à CD do feitiço (Cruel). */
  cdBonus: number;
  /** Bônus fixo aplicado à rolagem de ataque (Preciso). */
  hitBonus: number;
  /** Alcance (descrição) após Distante. `null` = sem mudança. */
  rangeOverride: string | null;
  /** Área (descrição) após Expansivo. `null` = sem mudança. */
  areaOverride: string | null;
  /** Se true, ative o re-roll de dados baixos no rolador (Potente). */
  rerollLowDamage: boolean;
  /** Quantidade de lançamentos efetivos do feitiço (Duplicado = 2). */
  castCount: number;
  /** Converter actionType para 'bonus' (Feitiço Rápido). */
  asBonusAction: boolean;
  /** Linhas narrativas para o chat de combate/log. */
  logLines: string[];
  /** Flags para UI exibir badges por toggle. */
  activeLabels: string[];
}

export interface FundamentosCtx {
  spell: Spell;
  activation: FundamentosActivation;
  /** Usado pelo Distante quando o alcance original for corpo-a-corpo. */
  meleeFallbackRangeMeters?: number;
  /** Mod. INT/SAB do conjurador — necessário p/ Cuidadoso (custo = mod). */
  keyAttrMod?: number;
}

/**
 * Motor puro: dado o estado de ativação + o feitiço, devolve todos os deltas
 * que o resolver de dano/ataque precisa aplicar.
 */
export function computeFundamentosModifiers(ctx: FundamentosCtx): FundamentosOutcome {
  const out: FundamentosOutcome = {
    extraPe: 0,
    cdBonus: 0,
    hitBonus: 0,
    rangeOverride: null,
    areaOverride: null,
    rerollLowDamage: false,
    castCount: 1,
    asBonusAction: false,
    logLines: [],
    activeLabels: [],
  };
  const a = ctx.activation || {};
  const sl = ctx.spell.spellLevel;

  // Cruel: -1 PE → CD +2 · -2 PE → CD +4
  if (a['Feitiço Cruel'] === 't1') {
    out.extraPe += 1; out.cdBonus += 2;
    out.activeLabels.push('Cruel +2 CD');
    out.logLines.push('☠ Feitiço Cruel: a crueldade impregna o ataque — CD +2 (custo: +1 PE).');
  } else if (a['Feitiço Cruel'] === 't2') {
    out.extraPe += 2; out.cdBonus += 4;
    out.activeLabels.push('Cruel +4 CD');
    out.logLines.push('☠☠ Feitiço Cruel: marcas amaldiçoadas sufocam o alvo — CD +4 (custo: +2 PE).');
  }

  // Preciso: -1 PE → +2 Acerto · -2 PE → +4 Acerto
  if (a['Feitiço Preciso'] === 't1') {
    out.extraPe += 1; out.hitBonus += 2;
    out.activeLabels.push('Preciso +2 Atk');
    out.logLines.push('🎯 Feitiço Preciso: a mira se afia — Acerto +2 (custo: +1 PE).');
  } else if (a['Feitiço Preciso'] === 't2') {
    out.extraPe += 2; out.hitBonus += 4;
    out.activeLabels.push('Preciso +4 Atk');
    out.logLines.push('🎯🎯 Feitiço Preciso: mira cirúrgica — Acerto +4 (custo: +2 PE).');
  }

  // Distante: -2 PE, dobra alcance (ou 9m se CaC).
  if (a['Feitiço Distante'] === 't1' || a['Feitiço Distante'] === 't2') {
    out.extraPe += 2;
    const original = (ctx.spell.range || '').trim();
    const meters = parseRangeMeters(original);
    if (meters !== null && meters > 0) {
      out.rangeOverride = `${meters * 2}m (Distante ×2)`;
    } else {
      // CaC ou alcance livre: aplica o fallback.
      const fallback = ctx.meleeFallbackRangeMeters ?? 9;
      out.rangeOverride = `${fallback}m (Distante — CaC→Ranged)`;
    }
    out.activeLabels.push('Distante');
    out.logLines.push(`🏹 Feitiço Distante: o alcance se estende — ${out.rangeOverride} (custo: +2 PE).`);
  }

  // Expansivo: -3 PE, multiplica raio/área por 1.5.
  if (a['Feitiço Expansivo'] === 't1' || a['Feitiço Expansivo'] === 't2') {
    out.extraPe += 3;
    const original = (ctx.spell.range || '').trim();
    const meters = parseAreaMeters(original);
    if (meters !== null && meters > 0) {
      out.areaOverride = `${(meters * 1.5).toFixed(1)}m (Expansivo ×1,5)`;
    } else {
      out.areaOverride = 'Área ×1,5 (Expansivo)';
    }
    out.activeLabels.push('Expansivo');
    out.logLines.push(`🌐 Feitiço Expansivo: a área se alastra — ${out.areaOverride} (custo: +3 PE).`);
  }

  // Potente: -3 PE, engatilha re-roll de dados de dano <= maior entre mods INT/AST.
  if (a['Feitiço Potente'] === 't1' || a['Feitiço Potente'] === 't2') {
    out.extraPe += 3;
    out.rerollLowDamage = true;
    out.activeLabels.push('Potente re-roll');
    out.logLines.push('💥 Feitiço Potente: o dano reverbera — re-rola dados baixos (custo: +3 PE).');
  }

  // Cuidadoso: custo = Mod. INT/SAB do conjurador (mín 1).
  if (a['Feitiço Cuidadoso'] === 't1' || a['Feitiço Cuidadoso'] === 't2') {
    const cost = getCuidadosoExtraPe(ctx.keyAttrMod ?? 1);
    out.extraPe += cost;
    out.activeLabels.push('Cuidadoso');
    out.logLines.push(`🛡 Feitiço Cuidadoso: ${cost * 2} aliado(s) preservado(s) na área (custo: +${cost} PE).`);
  }

  // Duplicado: dedução dinâmica, dobra contagem de lançamentos.
  if (a['Feitiço Duplicado'] === 't1' || a['Feitiço Duplicado'] === 't2') {
    const cost = getDuplicadoExtraPe(sl);
    out.extraPe += cost;
    out.castCount = 2;
    out.activeLabels.push('Duplicado ×2');
    out.logLines.push(`🔁 Feitiço Duplicado: o feitiço ecoa — 2 lançamentos (custo: +${cost} PE).`);
  }

  // Rápido: dedução dinâmica, converte ação para bônus.
  if (a['Feitiço Rápido'] === 't1' || a['Feitiço Rápido'] === 't2') {
    const cost = getRapidoExtraPe(sl);
    out.extraPe += cost;
    out.asBonusAction = true;
    out.activeLabels.push('Rápido (A. Bônus)');
    out.logLines.push(`⚡ Feitiço Rápido: conjurado como Ação Bônus (custo: +${cost} PE, 1×/turno).`);
  }

  return out;
}

// ---- Re-roll helper (Feitiço Potente) -------------------------------------

/**
 * Re-rola TODOS os dados de dano com valor menor ou igual ao `threshold`.
 * Uso: `threshold = max(modINT, modAST)`.
 * Devolve os dados finais + total + contagem de re-rolls (para log).
 */
export async function rerollLowDamageDice(
  rolls: number[],
  sides: number,
  threshold: number,
): Promise<{ rolls: number[]; total: number; rerolled: number }> {
  if (threshold <= 0 || sides <= 0) {
    return { rolls, total: rolls.reduce((a, b) => a + b, 0), rerolled: 0 };
  }
  let rerolled = 0;
  const out: number[] = [];
  for (const r of rolls) {
    if (r <= threshold) {
      rerolled++;
      const rr = await rollDice(`1d${sides}`);
      out.push(rr.rolls[0] ?? r);
    } else {
      out.push(r);
    }
  }
  return { rolls: out, total: out.reduce((a, b) => a + b, 0), rerolled };
}

/**
 * Atalho: aplica re-roll sobre uma notação `NdS`. Se não bater, devolve rolagem limpa.
 */
export async function rerollDamageNotation(
  notation: string,
  threshold: number,
): Promise<{ rolls: number[]; total: number; rerolled: number }> {
  const match = notation.match(/^(\d+)d(\d+)$/i);
  if (!match) {
    const rolled = await rollDice(notation);
    return { rolls: rolled.rolls, total: rolled.total, rerolled: 0 };
  }
  const sides = parseInt(match[2], 10);
  const rolled = await rollDice(notation);
  return await rerollLowDamageDice(rolled.rolls, sides, threshold);
}


// ---- Parsers para alcance/área (strings livres) ---------------------------

/** Extrai metros de uma string do tipo "9m", "6 metros", "Curto (9m)". */
export function parseRangeMeters(s: string): number | null {
  if (!s) return null;
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*m/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Heurística simples: reutiliza parseRangeMeters para área (primeiro "Xm"). */
export function parseAreaMeters(s: string): number | null {
  return parseRangeMeters(s);
}
