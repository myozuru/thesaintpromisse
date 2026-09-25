/**
 * Spell Cast Pipeline (Fase 3 — Especialista em Técnica).
 *
 * Pipeline central, PURO e DETERMINÍSTICO, que recebe `(character, spell, opts)`
 * e devolve:
 *
 *   • `prepareCast`  → produz um `SpellCastPlan` que descreve TODOS os
 *     modificadores das Habilidades de Especialização aplicáveis a este
 *     lançamento, ANTES de gastar PE/rolar dados. A `SpellApplyDialog` (e
 *     callers headless) usam o plano para mostrar previsões e validar
 *     consumo de PE adicional.
 *
 *   • `applyCast`    → produz `Partial<Character>` com as MUTAÇÕES que o
 *     cast efetivo gera no estado do personagem (lastSpellUsedId, custo PE
 *     extra de Conjuração Defensiva, ActiveBuff temporário, etc.). Não
 *     muta nada — devolve patch que o caller funde com `updateCharacter`.
 *
 *   • `applyDamageMods` → recebe um array de rolls de dano puros e devolve
 *     o total ajustado pelas regras de Spec (Explosão Encadeada/Máxima,
 *     Destruição Ampla/Focada, Ciclagem Maldita). Roll-RNG é INJETADO
 *     (parâmetro `rollDie`) para que a função permaneça testável.
 *
 * Cobertura desta fase (7 IDs):
 *   • tec-mente-placida          → concentrationDC -= maxKeyMod (+opt 1PE/2PE)
 *   • tec-conjuracao-defensiva   → opt-in 2 PE → buff Defesa+RD = nivelFeitiço
 *   • tec-explosao-encadeada     → re-roll explosivo (1×) por dado max
 *   • tec-explosao-maxima        → +4 flat por dado disparado por Encadeada
 *   • tec-destruicao-ampla       → +5 dano por alvo extra em área
 *   • tec-destruicao-focada      → ignoreRD += keyMod, dados +floor(TB/2)
 *   • tec-ciclagem-maldita       → +floor(TB/2) dados se trocar de feitiço
 *
 * Não inclui (já cobertos em Fase 1/2 ou outros sistemas):
 *   • CD/Ataque mágico/Defesa passivos (Fase 1: applyTecnicaProgression).
 *   • Slots de Concentração / Sustentado (Fase 2: tipos + reset).
 *   • Pool aptitudeOnlyTempPE (Fase 2: hooks de turno).
 */
import type { ActiveBuff, Character, Spell } from '@/types';
import { getTrainingBonusByLevel } from './levelEngine';
import { getSpecKeyMod } from './specKeyMod';
import { aggregateSpecChoices, DOMINANCIA_DYNAMIC } from './specChoiceEffects';

/** Resultado de uma única face rolada — usado para detectar dado máximo. */
export interface RolledDie { sides: number; value: number }

/** Função injetável de rolagem de 1 dado (sides) → valor (1..sides). */
export type DieRoller = (sides: number) => number;

/**
 * Default proibido: em produção o caller (`SpellApplyDialog`) pré-rola dados
 * via física 3D e injeta um `rollDie` consumindo essa fila. Se nada for
 * injetado, estouramos — assim 100% das rolagens vêm do 3D.
 */
const defaultRoller: DieRoller = (sides) => {
  throw new Error(
    `spellCastPipeline.defaultRoller(${sides}): rolagem direta proibida — injete rollDie vindo da física 3D.`,
  );
};


function hasAbility(c: Pick<Character, 'chosenSpecAbilities'>, id: string): boolean {
  return (c.chosenSpecAbilities ?? []).some(a => a.abilityId === id);
}

/** Converte SpellLevel ('1','2',...,'Técnica Máxima') em nº numérico (TM = 10). */
function spellLevelNumber(level: Spell['spellLevel']): number {
  if (level === 'Técnica Máxima') return 10;
  const n = parseInt(level, 10);
  return Number.isFinite(n) ? n : 1;
}

// ============================================================================
//  prepareCast
// ============================================================================

export interface PrepareCastOpts {
  /** Jogador escolheu pagar 2 PE extras de Conjuração Defensiva. */
  defensiveCasting?: boolean;
  /** Quantos alvos serão afetados (usado por Destruição Ampla — área). */
  targetCount?: number;
  /**
   * PE extra gasto via **Sobrecarregar** (Tier 2). Cada PE adicional eleva a
   * CD do feitiço em +1, limitado ao Bônus de Treinamento. Aplica-se
   * apenas quando a habilidade está escolhida.
   */
  overchargePe?: number;
  /**
   * Consome a Ação de Movimento para ativar **Potência Concentrada** (Tier 6).
   * Só vale para feitiço de **dano de alvo único**. Adiciona +5 × Nível ao
   * dano flat. Caller é responsável por gastar a Ação de Movimento.
   */
  potenciaConcentrada?: boolean;
}

export interface SpellCastPlan {
  /** PE adicional cobrado por Specs ativadas neste cast (Conjuração Defensiva). */
  extraPe: number;
  /** Hook flags por habilidade — orientam a UI e `applyDamageMods`. */
  hooks: {
    defensiveCasting: boolean;       // tec-conjuracao-defensiva ativada
    explosionChain: boolean;         // tec-explosao-encadeada
    explosionMax: boolean;           // tec-explosao-maxima
    destructionWide: boolean;        // tec-destruicao-ampla (área)
    destructionFocused: boolean;     // tec-destruicao-focada (alvo único)
    cycling: boolean;                // tec-ciclagem-maldita (trocou de feitiço)
    potenciaConcentrada: boolean;    // tec-potencia-concentrada (Movimento → +5×nível flat)
  };
  /** RD ignorado (Destruição Focada). */
  ignoreRD: number;
  /** Dados extras de dano (Destruição Focada + Ciclagem Maldita). */
  bonusDamageDice: number;
  /** Bônus flat por dado adicional explodido (Explosão Máxima → +4). */
  perChainExtraFlat: number;
  /** Bônus flat de dano direto (Destruição Ampla → +5 × (alvosExtras)). */
  flatDamageBonus: number;
  /** Redução de PE aplicável a este feitiço (Dominância/Favorito/Manipulação). >=0. */
  peReduction: number;
  /** Bônus de CD vindo das escolhas (Nível Perfeito por nível de feitiço). */
  cdBonus: number;
  /** Notas legíveis para mostrar na UI / log. */
  notes: string[];
}

export function prepareCast(
  character: Character,
  spell: Spell,
  opts: PrepareCastOpts = {},
): SpellCastPlan {
  const plan: SpellCastPlan = {
    extraPe: 0,
    hooks: {
      defensiveCasting: false,
      explosionChain: false,
      explosionMax: false,
      destructionWide: false,
      destructionFocused: false,
      cycling: false,
      potenciaConcentrada: false,
    },
    ignoreRD: 0,
    bonusDamageDice: 0,
    perChainExtraFlat: 0,
    flatDamageBonus: 0,
    peReduction: 0,
    cdBonus: 0,
    notes: [],
  };

  const level = Math.max(1, character.level ?? 1);
  const tb = getTrainingBonusByLevel(level);
  const keyMod = getSpecKeyMod(character);
  const isDamageSpell = spell.spellType === 'damage';
  const isArea = spell.targetMode === 'area_tr';
  const isSingleTarget = spell.targetMode === 'single_atk' || spell.targetMode === 'single_tr';

  // tec-conjuracao-defensiva (opt-in)
  if (opts.defensiveCasting && hasAbility(character, 'tec-conjuracao-defensiva')) {
    plan.extraPe += 2;
    plan.hooks.defensiveCasting = true;
    plan.notes.push('Conjuração Defensiva: +2 PE → Defesa +nível e RD +nível até o início do próximo turno.');
  }

  // tec-sobrecarregar (Tier 2) — opt-in: gasta PE extra para somar +1 CD por PE.
  if ((opts.overchargePe ?? 0) > 0 && hasAbility(character, 'tec-sobrecarregar')) {
    const requested = Math.max(0, Math.floor(opts.overchargePe ?? 0));
    const allowed = Math.min(requested, tb);
    if (allowed > 0) {
      plan.extraPe += allowed;
      plan.cdBonus += allowed;
      plan.notes.push(`Sobrecarregar: +${allowed} PE → CD +${allowed} (limite ${tb}).`);
    }
  }

  if (isDamageSpell) {
    if (hasAbility(character, 'tec-explosao-encadeada')) {
      plan.hooks.explosionChain = true;
      plan.notes.push('Explosão Encadeada: dado max rola +1 dado igual (uma vez).');
    }
    if (hasAbility(character, 'tec-explosao-maxima')) {
      plan.hooks.explosionMax = true;
      plan.perChainExtraFlat = 4;
      plan.notes.push('Explosão Máxima: +4 flat por dado que disparar Encadeada.');
    }

    if (isArea && hasAbility(character, 'tec-destruicao-ampla')) {
      const extras = Math.max(0, (opts.targetCount ?? 1) - 1);
      const flat = 5 * extras;
      if (flat > 0) {
        plan.flatDamageBonus += flat;
        plan.notes.push(`Destruição Ampla: +${flat} dano (${extras} alvos extras).`);
      }
      plan.hooks.destructionWide = true;
    }

    if (isSingleTarget && hasAbility(character, 'tec-destruicao-focada')) {
      plan.hooks.destructionFocused = true;
      plan.ignoreRD += keyMod;
      const dice = Math.floor(tb / 2);
      plan.bonusDamageDice += dice;
      plan.notes.push(`Destruição Focada: ignora RD +${keyMod}; +${dice} dado(s) de dano.`);
    }

    // tec-ciclagem-maldita — só dispara se trocou de feitiço.
    if (hasAbility(character, 'tec-ciclagem-maldita')) {
      const last = character.lastSpellUsedId;
      if (last && last !== spell.id) {
        const dice = Math.floor(tb / 2);
        plan.hooks.cycling = true;
        plan.bonusDamageDice += dice;
        plan.notes.push(`Ciclagem Maldita: +${dice} dado(s) (feitiço diferente do último).`);
      }
    }

    // tec-potencia-concentrada (Tier 6) — opt-in (consome Ação de Movimento):
    // +5 × Nível_do_Feitiço de dano flat. Só vale para dano em alvo único.
    if (
      opts.potenciaConcentrada &&
      isSingleTarget &&
      hasAbility(character, 'tec-potencia-concentrada')
    ) {
      const bonus = 5 * spellLevelNumber(spell.spellLevel);
      plan.flatDamageBonus += bonus;
      plan.hooks.potenciaConcentrada = true;
      plan.notes.push(`Potência Concentrada: +${bonus} dano (consome Ação de Movimento).`);
    }
  }

  // ─── Escolhas do painel de Especialização (Dominância / Favorito / Manipulação / Nível Perfeito) ───
  const agg = aggregateSpecChoices(character);
  const spellLvlNum = spellLevelNumber(spell.spellLevel);

  const rawRed = agg.spellPeReductionById[spell.id] ?? 0;
  if (rawRed !== 0) {
    let total = 0;
    let dynamicCount = 0;
    let staticPart = 0;
    // DOMINANCIA_DYNAMIC pode ter sido somado 1× (Dominância) ou 2× (Dominância+Favorito).
    // Cada ocorrência vale ⌈nivel/2⌉.
    let r = rawRed;
    while (r <= DOMINANCIA_DYNAMIC / 2) {
      // não esperado — sentinel é grande negativo; tratamos abaixo
      break;
    }
    // Detectar quantas vezes o sentinel foi somado.
    // sentinel = -999. Se rawRed = N*(-999) + staticPos, então:
    if (rawRed < 0) {
      const k = Math.round(rawRed / DOMINANCIA_DYNAMIC); // nº de aplicações dinâmicas
      dynamicCount = k;
      staticPart = rawRed - k * DOMINANCIA_DYNAMIC; // resíduo positivo (Manipulação Perfeita)
    } else {
      staticPart = rawRed;
    }
    const dynamicPart = dynamicCount * Math.ceil(spellLvlNum / 2);
    total = dynamicPart + staticPart;
    if (total > 0) {
      plan.peReduction = total;
      plan.notes.push(`Redução de PE: -${total} (escolhas de Especialização).`);
    }
  }

  const cdBonus = agg.spellLevelCdBonus[spellLvlNum] ?? 0;
  if (cdBonus > 0) {
    plan.cdBonus = cdBonus;
    plan.notes.push(`Nível Perfeito: CD +${cdBonus} para feitiços de nível ${spellLvlNum}.`);
  }

  return plan;
}

// ============================================================================
//  applyDamageMods — Explosão Encadeada/Máxima sobre rolls puros
// ============================================================================

export interface DamageRollOutcome {
  /** Total final pós-Specs. */
  total: number;
  /** Quantos dados extras foram rolados pela Encadeada. */
  chainExtraRolls: number;
  /** Soma dos valores dos dados extras. */
  chainExtraSum: number;
  /** Bônus flat aplicado pela Máxima (perChainExtraFlat × disparos). */
  maxFlatBonus: number;
}

/**
 * Aplica Explosão Encadeada/Máxima sobre uma lista de dados rolados.
 * O caller é responsável por:
 *   1. Rolar os dados base do feitiço (incluindo `plan.bonusDamageDice` extras).
 *   2. Passar a lista bruta aqui.
 *   3. Somar `plan.flatDamageBonus` ao `outcome.total` final, se desejar (já incluído).
 */
export function applyDamageMods(
  rolls: RolledDie[],
  plan: SpellCastPlan,
  rollDie: DieRoller = defaultRoller,
): DamageRollOutcome {
  const baseSum = rolls.reduce((s, r) => s + r.value, 0);
  let chainExtraRolls = 0;
  let chainExtraSum = 0;

  if (plan.hooks.explosionChain) {
    for (const r of rolls) {
      if (r.value === r.sides) {
        chainExtraRolls += 1;
        chainExtraSum += rollDie(r.sides);
        // Trava: o dado extra NÃO dispara novamente (regra oficial).
      }
    }
  }

  const maxFlatBonus = plan.hooks.explosionMax ? plan.perChainExtraFlat * chainExtraRolls : 0;
  const total = baseSum + chainExtraSum + maxFlatBonus + plan.flatDamageBonus;

  return { total, chainExtraRolls, chainExtraSum, maxFlatBonus };
}

// ============================================================================
//  applyCast — patch de estado pós-cast bem-sucedido
// ============================================================================

export interface ApplyCastResult {
  /** Patch a fundir com `updateCharacter(character.id, ...)`. */
  patch: Partial<Character>;
  /**
   * Buffs a adicionar via `addBuff`. Vazio se nenhuma Spec produzir buff.
   * Conjuração Defensiva emite DOIS buffs (CA + RD), ambos com mesmo `value`
   * e duração de 1 turno (texto: "Defesa += nível E RD += nível").
   */
  buffs: ActiveBuff[];
}

/**
 * Devolve o patch de estado que o caller deve aplicar APÓS o cast efetivo
 * (ataque/TR resolvido). Inclui:
 *   • `lastSpellUsedId` (para Ciclagem Maldita).
 *   • Buffs de Conjuração Defensiva (CA + RD, 1 rodada cada).
 *
 * NÃO debita PE — o caller é responsável por aplicar o custo (já calculado
 * com `plan.extraPe` antes do dispatch).
 */
export function applyCast(
  character: Character,
  spell: Spell,
  plan: SpellCastPlan,
): ApplyCastResult {
  const patch: Partial<Character> = {
    lastSpellUsedId: spell.id,
  };

  const buffs: ActiveBuff[] = [];
  if (plan.hooks.defensiveCasting) {
    const lvl = spellLevelNumber(spell.spellLevel);
    const baseId = `tec-conjuracao-defensiva:${spell.id}:${Date.now()}`;
    buffs.push({
      id: baseId,
      spellName: 'Conjuração Defensiva',
      type: 'ca',
      value: lvl,
      remainingTurns: 1,
      sourceCharId: character.id,
    });
    buffs.push({
      id: `${baseId}:rd`,
      spellName: 'Conjuração Defensiva',
      type: 'rd',
      value: lvl,
      remainingTurns: 1,
      sourceCharId: character.id,
    });
  }

  return { patch, buffs };
}
