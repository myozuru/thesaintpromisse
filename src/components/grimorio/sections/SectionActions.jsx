import React, { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Copy, Swords, Info, AlertTriangle, Lock, Unlock, Zap, Shield, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { FieldLabel, TextInput, TextArea, Select, NumberInput, SmallButton, Pill } from "../builder-controls";
import {
  getDamage, PATAMAR_ND_RANGE, CONDITIONS,
  getBonusBuff, getReactionBuff, getTrainingReactions,
  BONUS_EFFECT_OPTIONS, REACTION_EFFECT_OPTIONS,
  BONUS_EFFECT_LABELS, REACTION_EFFECT_LABELS,
} from "../fm-tables";
import { ALL_CONDITIONS } from "@/types/conditions";


// ============================================================
// CONSTANTES
// ============================================================
const ACTION_TYPE_OPTIONS = [
  { value: "comum",     label: "Ação Comum" },
  { value: "bonus",     label: "Ação Bônus" },
  { value: "rapida",    label: "Ação Rápida" },
  { value: "reacao",    label: "Reação" },
  { value: "movimento", label: "Movimento" },
  { value: "livre",     label: "Livre" },
];

export const ACTION_TYPE_LABELS = {
  comum: "Ação Comum", bonus: "Ação Bônus", rapida: "Ação Rápida",
  reacao: "Reação", movimento: "Movimento", livre: "Livre",
};

// ---------- MODO DE AÇÃO (Grimório pg 52) ----------
// comum → ataque tabelado | bonus → buff ofensivo | reacao → buff defensivo + reações por treinamento
// rapida → substituto sem PE de Bônus/Reação | movimento/livre → passivo (sem dano/buff)
export const ACTION_MODE = {
  comum: "ataque",
  bonus: "buff_ofensivo",
  reacao: "buff_defensivo",
  rapida: "substituto",
  movimento: "passivo",
  livre:     "passivo",
};
export const getActionMode = (type) => ACTION_MODE[type] ?? "ataque";
const isAttackMode = (type) => getActionMode(type) === "ataque";
const isBuffMode   = (type) => ["buff_ofensivo","buff_defensivo","substituto"].includes(getActionMode(type));

const ATTACK_TYPE_OPTIONS = [
  { value: "acerto",        label: "Teste de Acerto (dano total)" },
  { value: "tr_individual", label: "TR Individual (dano -1 ND)" },
  { value: "tr_area",       label: "TR em Área (dano ÷2)" },
  { value: "suporte",       label: "Suporte / Defesa (sem dano)" },
];

// Determina se uma ação deve ser tratada como "sem dano" (apenas efeito).
// Cobre o tipo dedicado "suporte" e a flag opcional `noDamage`, que pode ser
// ativada em Acerto / TR Individual / TR em Área para criar ataques que só
// aplicam condição/área sem rolar dano.
const isEffectOnly = (action) =>
  action?.attackType === "suporte" || action?.noDamage === true;


const NARRATIVE_OPTIONS = [
  { value: "padrao", label: "Arma / Padrão" },
  { value: "fisica",  label: "Narrativa Física (Soco, Chute...)" },
];

const TR_TYPE_OPTIONS = [
  { value: "fortitude",   label: "Fortitude" },
  { value: "reflexos",    label: "Reflexos" },
  { value: "vontade",     label: "Vontade" },
  { value: "astucia",     label: "Astúcia" },
  { value: "integridade", label: "Integridade" },
];

const TR_TYPE_LABELS = {
  fortitude: "Fortitude", reflexos: "Reflexos", vontade: "Vontade",
  astucia: "Astúcia", integridade: "Integridade",
};

const DAMAGE_TYPE_GROUPS = [
  { label: "Físicos",    types: ["cortante", "perfurante", "impacto"] },
  { label: "Elementais", types: ["ácido", "congelante", "chocante", "queimante", "sônico"] },
  { label: "Etéreos",    types: ["alma", "energia reversa", "energético", "psíquico", "radiante"] },
  { label: "Biológicos", types: ["necrótico", "venenoso"] },
];

const DAMAGE_TYPE_LABELS = {
  // Valores canônicos
  cortante: "Cortante", perfurante: "Perfurante", impacto: "Impacto",
  "ácido": "Ácido", congelante: "Congelante", chocante: "Chocante", queimante: "Queimante", "sônico": "Sônico",
  alma: "Alma",
  "energia reversa": "Energia Reversa", "energético": "Energético",
  "psíquico": "Psíquico", radiante: "Radiante",
  "necrótico": "Necrótico", venenoso: "Venenoso",
  // Compatibilidade com valores antigos salvos
  psiquico: "Psíquico", sonoro: "Sônico", corrosivo: "Ácido",
  necrotico: "Necrótico", energia_amaldicoada: "Energia Reversa",
};

const CONDITION_TIER_OPTIONS = [
  { value: "nenhuma", label: "Nenhuma" },
  { value: "fraca",   label: "Fraca (2 PE ou -1 ND)" },
  { value: "media",   label: "Média (5 PE ou -2 ND)" },
  { value: "forte",   label: "Forte (8 PE ou -3 ND)" },
  { value: "extrema", label: "Extrema (10 PE ou -4 ND)" },
];

const CONDITION_TIER_LABELS = {
  fraca: "Fraca", media: "Média", forte: "Forte", extrema: "Extrema",
};

const CONDITION_PE_COST  = { fraca: 2, media: 5, forte: 8, extrema: 10 };
const CONDITION_ND_COST  = { fraca: 1, media: 2, forte: 3, extrema: 4 };
const BT_MIN_FOR_TIER    = { fraca: 2, media: 3, forte: 4, extrema: 5 };

const CONDITION_PAYMENT_OPTIONS = [
  { value: "pe", label: "Pagar com PE" },
  { value: "nd", label: "Reduzir ND do Dano" },
];

// Bug #28 fix: deriva CONDITION_NAMES de ALL_CONDITIONS (fonte única do sistema)
// — antes era uma lista hardcoded que divergia de CONDITIONS (fm-tables) e do
// catálogo oficial do RPG, causando duplicatas ("Sangrando" vs "Sangramento")
// e nomes que não existiam no livro ("Em Chamas", "Doente", "Fascinado", "Fraco").
const CONDITION_NAMES = ALL_CONDITIONS.map((c) => c.name);

const CONDITION_NAME_OPTIONS = [
  { value: "", label: "— Selecione —" },
  ...CONDITION_NAMES.map((n) => ({ value: n, label: n })),
  { value: "outro", label: "Outro / Customizado" },
];

const TIER_TO_CONDITIONS_KEY = {
  fraca: "fracas", media: "medias", forte: "fortes", extrema: "extremas",
};

const CONDITION_DURATION_MODE_OPTIONS = [
  { value: "ate_acabar",    label: "Até acabar (sem teste, dura X turnos)" },
  { value: "tr_todo_round", label: "TR todos os rounds (sucesso encerra antes)" },
  { value: "ate_passar_tr", label: "Até passar em TR (sem prazo)" },
];

const BLANK_CONDITION = {
  tier: "nenhuma",
  payment: "pe",
  nameKey: "",
  name: "",
  durationMode: "ate_acabar",
  durationTurns: 1,
};

const DIE_SIZES = [4, 6, 8, 10, 12, 20];

// ============================================================
// PARÂMETROS DE ALCANCE/ÁREA POR BT
// ============================================================
const ACTION_PARAMETERS = {
  2: { range: 12,  area: 4.5, meleeBonusDice: 1 },
  3: { range: 18,  area: 6,   meleeBonusDice: 1 },
  4: { range: 24,  area: 9,   meleeBonusDice: 2 },
  5: { range: 30,  area: 12,  meleeBonusDice: 2 },
  6: { range: 48,  area: 18,  meleeBonusDice: 3 },
};

const getActionParams = (bt) =>
  ACTION_PARAMETERS[Math.min(6, Math.max(2, bt ?? 2))] ?? ACTION_PARAMETERS[2];

const TRADES_ZERO = { sacrifDadosAcerto: 0, sacrifDadosCD: 0, sacrifAcertoDados: 0, sacrifCdDados: 0 };

// ============================================================
// CALCULATE ACTION DAMAGE — pipeline rigorosa (7 passos)
// ============================================================
export function calculateActionDamage(
  patamar, nd, attackType, isNarrativeFisica = false, conditionNdReduction = 0
) {
  if (!patamar || !nd || attackType === "suporte") return null;

  // Passo 1 — Somar todas as reduções de ND
  // Bug #1 fix: Calamidade reduz −4 ND no dano via TR individual (livro F&M 2.5)
  const reducaoTrBase  = attackType === "tr_individual" ? 1 : 0;
  const reducaoTr      = reducaoTrBase * (patamar === "calamidade" ? 4 : 1);
  const totalReducaoND = reducaoTr + (conditionNdReduction ?? 0);

  // Passo 2 — Calcular ND alvo, safeND e déficit
  const minND    = PATAMAR_ND_RANGE[patamar]?.min ?? 1;
  const targetND = nd - totalReducaoND;
  const safeND   = Math.max(minND, targetND);
  const deficit  = Math.max(0, minND - targetND);

  // Passo 3 — Buscar na tabela e fazer parse da string de dano
  const entry = getDamage(patamar, safeND);
  if (!entry?.roll) return null;

  const m = entry.roll.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;

  let numDice   = parseInt(m[1]);
  const dieSize = parseInt(m[2]);
  let mod       = parseInt(m[3] ?? "0");

  // Passo 4 — Aplicar o déficit no dano fixo
  mod -= deficit * 4;

  // Passo 5 — Redução por narrativa + trava de segurança
  // Divisão por área/alma ocorre no pipeline runFullCalc após somar todos os dados brutos
  if (isNarrativeFisica) numDice -= 2;
  // Bug #62 fix: detecta ação inválida antes de clampar; UI/log surfacing pendente
  const isInvalidDice = numDice < 1;
  numDice = Math.max(1, numDice);

  // Passos 6-7 — Trades e string final (trades aplicados externamente via applyTrades)
  const modStr  = mod > 0 ? `+${mod}` : mod < 0 ? `${mod}` : "";
  const average = Math.floor(numDice * ((dieSize + 1) / 2)) + mod;
  return { numDice, dieSize, mod, roll: `${numDice}d${dieSize}${modStr}`, average, isInvalidDice };
}

// ============================================================
// TRADE HELPERS
// ============================================================
function enforceMutualExclusion(trades) {
  const t = { ...trades };
  if ((t.sacrifDadosAcerto ?? 0) > 0) t.sacrifAcertoDados = 0;
  if ((t.sacrifAcertoDados ?? 0) > 0) t.sacrifDadosAcerto = 0;
  if ((t.sacrifDadosCD    ?? 0) > 0) t.sacrifCdDados      = 0;
  if ((t.sacrifCdDados    ?? 0) > 0) t.sacrifDadosCD      = 0;
  return t;
}

function applyTrades(numDiceBase, toHitBase, cdBase, rangeType, trades, bt) {
  const params   = getActionParams(bt);
  const bonusCaC = rangeType === "cac" ? params.meleeBonusDice : 0;
  const t        = { ...TRADES_ZERO, ...(trades ?? {}) };
  const dadosFinais = Math.max(1,
    (numDiceBase ?? 0) + bonusCaC
    - t.sacrifDadosAcerto
    - t.sacrifDadosCD
    + Math.floor(t.sacrifAcertoDados / 2)
    + t.sacrifCdDados
  );
  const acertoFinal = (toHitBase ?? 0) + (t.sacrifDadosAcerto * 2) - t.sacrifAcertoDados;
  const cdFinal     = (cdBase     ?? 0) + t.sacrifDadosCD           - t.sacrifCdDados;
  return { dadosFinais, acertoFinal, cdFinal };
}

// Divisor composto: tr_area ×2, alma ×3 (podem se combinar → ×6)
function computeDivisor(attackType, damageType) {
  let divisor = 1;
  if (attackType === "tr_area") divisor *= 2;
  if (damageType === "alma")    divisor *= 3;
  return divisor;
}

// Pipeline Target Average com degradação dinâmica de dado:
// A) Média bruta → B) Média alvo (divisores) → C) Degrada face se necessário → reconstrói dados+fixo
const FACES_VALIDAS = [20, 12, 10, 8, 6, 4, 2];
function applyDivisorFull(dadosBrutos, dieSize, modBase, divisor) {
  if (divisor === 1) return { numDadosFinal: dadosBrutos, danoFixoFinal: modBase, dieSize };
  // Bug #60 fix: mantém precisão racional na média alvo. Antes era
  // `Math.floor(mediaBruta/divisor)`, o que removia até ~0.99 ponto de
  // média por divisão (composto quando tr_area ×2 + alma ×3 = ÷6) e
  // desencadeava degradação de face desnecessária.
  const mediaFace0 = (dieSize + 1) / 2;
  const mediaBruta = dadosBrutos * mediaFace0 + modBase;
  const mediaAlvo  = mediaBruta / divisor;
  // Passo C.1-C.2 — Degrada face enquanto dado for grande demais para a média alvo
  let faceAtual = FACES_VALIDAS.includes(dieSize) ? dieSize : 10;
  while (mediaAlvo < (faceAtual + 1) / 2 && faceAtual > 2) {
    const prox = FACES_VALIDAS[FACES_VALIDAS.indexOf(faceAtual) + 1];
    if (prox == null) break;
    faceAtual = prox;
  }
  // Passo C.3 — Reconstruir com a face final; fixo sempre >= 0
  const mediaFaceFinal = (faceAtual + 1) / 2;
  const numDadosFinal  = Math.max(1, Math.floor(mediaAlvo / mediaFaceFinal));
  const danoFixoBruto  = Math.round(mediaAlvo - numDadosFinal * mediaFaceFinal);
  const danoFixoFinal  = Math.max(0, danoFixoBruto);
  return { numDadosFinal, danoFixoFinal, dieSize: faceAtual };
}

// Bug #61/#62 fix: aplica divisor simples (sem reconstruir dados/fixo) e
// sinaliza `isInvalidDice` quando o resultado seria <1 — antes mascarava
// com `Math.max(1, ...)` e a ação parecia válida mas o dano não fazia
// sentido para o pipeline.
function applyDivisorSimple(dadosBrutos, divisor) {
  if (divisor === 1) return { numDice: dadosBrutos, isInvalidDice: false };
  const raw = dadosBrutos / divisor;
  const numDice = Math.floor(raw);
  return {
    numDice: Math.max(1, numDice),
    isInvalidDice: numDice < 1,
  };
}

// ============================================================
// Bug #2/#3/#20/#30 fix: pipeline puro extraído. Antes existiam duas
// definições quase idênticas de `runFullCalc`/`reapplyTradesHelper`
// (uma em ActionItem, outra em ActionForm), diferindo só na fonte do
// base hit (norm vs derived). Agora ambas chamam as mesmas funções
// puras abaixo, eliminando drift entre os dois caminhos.
// ============================================================
function runFullCalcPure({
  patamar, nd, bt,
  attackType, condition, narrativeType, rangeType, trades, damageType,
  baseHit, baseCd, fallbackDamageType = "cortante", noDamage = false,
}) {
  // Apenas-efeito: pula recálculo de dado e mantém damage existente intocado;
  // ainda assim, hit/cd continuam recalculados via reapplyTrades no fallback.
  if (noDamage) return null;
  const baseResult = calculateActionDamage(
    patamar, nd, attackType, narrativeType === "fisica", getCondNdReduction(condition)
  );
  if (!baseResult) return null;
  const tradeResult = applyTrades(baseResult.numDice, baseHit, baseCd, rangeType, trades, bt);
  const { acertoFinal, cdFinal } = tradeResult;
  const divisor = computeDivisor(attackType, damageType ?? fallbackDamageType);
  const { numDadosFinal, danoFixoFinal, dieSize: dieFinal } =
    applyDivisorFull(tradeResult.dadosFinais, baseResult.dieSize, baseResult.mod, divisor);
  const finalRoll = rollStr(numDadosFinal, dieFinal, danoFixoFinal);
  const finalAvg  = rollAverage(numDadosFinal, dieFinal, danoFixoFinal);
  return {
    toHit:    acertoFinal,
    toHitBase: baseHit,
    cd:       cdFinal,
    cdBase:   baseCd,
    damage: {
      ...baseResult,
      numDice: numDadosFinal,
      numDiceBase: baseResult.numDice,
      mod: danoFixoFinal,
      dieSize: dieFinal,
      roll: finalRoll,
      average: finalAvg,
      damageIsCalculated: true,
    },
  };
}

function reapplyTradesPure({ source, rangeType, trades, bt }) {
  const numDiceBase = source.damage?.numDiceBase ?? source.damage?.numDice ?? 0;
  const tHitBase    = source.toHitBase ?? source.toHit ?? 0;
  const tCdBase     = source.cdBase    ?? source.cd    ?? 0;
  const tradeRes = applyTrades(numDiceBase, tHitBase, tCdBase, rangeType, trades, bt);
  const divisor  = computeDivisor(source.attackType, source.damage?.type ?? "cortante");
  const { numDice: numDadosFinal, isInvalidDice } =
    applyDivisorSimple(tradeRes.dadosFinais, divisor);
  const dieSize = source.damage?.dieSize ?? 8;
  const modVal  = source.damage?.mod ?? 0;
  return {
    toHit: tradeRes.acertoFinal,
    cd:    tradeRes.cdFinal,
    damage: {
      ...source.damage,
      numDice: numDadosFinal,
      isInvalidDice,
      roll:    rollStr(numDadosFinal, dieSize, modVal),
      average: rollAverage(numDadosFinal, dieSize, modVal),
    },
  };
}

// Zera trades irrelevantes ao trocar o tipo de ofensiva
function resetTradesForAttackType(attackType, currentTrades) {
  const t = { ...currentTrades };
  if (attackType === "acerto") {
    t.sacrifDadosCD = 0;
    t.sacrifCdDados = 0;
  } else if (attackType?.startsWith("tr_")) {
    t.sacrifDadosAcerto = 0;
    t.sacrifAcertoDados = 0;
  }
  return t;
}

// Calcula alcance e área automáticos com base no BT, tipo de ataque e tipo de alcance
const fmtM = (n) => `${String(n).replace(".", ",")} Metros`;
// Regra do livro: trocar alcance por área — cada −1,5m de área concede +12m
// de alcance (e vice-versa). A área nunca fica abaixo de 1,5m.
const AREA_TRADE_STEP_M  = 1.5;
const RANGE_TRADE_STEP_M = 12;
// Regra do livro (Linha): área em Linha é multiplicada por 1,5 e começa com
// 1,5m de largura; cada +1,5m de largura custa 4,5m de comprimento.
const LINE_AREA_MULT      = 1.5;
const LINE_BASE_WIDTH_M   = 1.5;
const LINE_WIDTH_STEP_M   = 1.5;
const LINE_LENGTH_COST_M  = 4.5;

const isLineShape = (shape) => shape === "line" || shape === "line_attached";

function baseAreaFor(bt, areaShape) {
  const params = getActionParams(bt);
  return isLineShape(areaShape) ? params.area * LINE_AREA_MULT : params.area;
}

function maxAreaRangeSteps(bt, areaShape) {
  const base = baseAreaFor(bt, areaShape);
  return Math.max(0, Math.floor((base - AREA_TRADE_STEP_M) / AREA_TRADE_STEP_M + 1e-9));
}

function maxLineWidthSteps(bt, areaShape, areaRangeSteps = 0) {
  if (!isLineShape(areaShape)) return 0;
  const steps = Math.max(0, Math.min(maxAreaRangeSteps(bt, areaShape), Number(areaRangeSteps) || 0));
  const afterRange = baseAreaFor(bt, areaShape) - steps * AREA_TRADE_STEP_M;
  // o comprimento nunca fica abaixo de 1,5m
  return Math.max(0, Math.floor((afterRange - AREA_TRADE_STEP_M) / LINE_LENGTH_COST_M + 1e-9));
}

function calcAutoRange(attackType, rangeType, bt, areaRangeSteps = 0, areaShape = "circle", lineWidthSteps = 0) {
  const params = getActionParams(bt);
  const isArea = attackType === "tr_area";
  const isLine = isArea && isLineShape(areaShape);
  const steps  = isArea && rangeType !== "cac"
    ? Math.max(0, Math.min(maxAreaRangeSteps(bt, areaShape), Number(areaRangeSteps) || 0))
    : 0;
  const base  = baseAreaFor(bt, areaShape);
  let area    = base - steps * AREA_TRADE_STEP_M;
  let lineWidth = 0;
  if (isLine) {
    const wSteps = Math.max(0, Math.min(maxLineWidthSteps(bt, areaShape, steps), Number(lineWidthSteps) || 0));
    area      = area - wSteps * LINE_LENGTH_COST_M;
    lineWidth = LINE_BASE_WIDTH_M + wSteps * LINE_WIDTH_STEP_M;
  }
  const range = params.range + steps * RANGE_TRADE_STEP_M;
  if (rangeType === "cac") {
    return {
      range: "Corpo-a-Corpo",
      area:  isArea ? fmtM(base) : "-",
      lineWidth: isLine ? LINE_BASE_WIDTH_M : 0,
    };
  }
  return {
    range: fmtM(range),
    area:  isArea ? fmtM(area) : "-",
    lineWidth,
  };
}

// ============================================================
// HELPERS DE ROLAGEM
// ============================================================
const rollStr = (numDice, dieSize, mod) => {
  if (!numDice || !dieSize) return mod ? (mod > 0 ? `+${mod}` : `${mod}`) : "";
  const base = `${numDice}d${dieSize}`;
  if (!mod) return base;
  return mod > 0 ? `${base}+${mod}` : `${base}${mod}`;
};

const rollAverage = (numDice, dieSize, mod) => {
  if (!numDice || !dieSize) return mod || 0;
  return Math.round(numDice * (dieSize + 1) / 2 + (mod || 0));
};

const parseRollFromStr = (roll) => {
  const m = (roll ?? "").match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  return { numDice: parseInt(m[1]), dieSize: parseInt(m[2]), mod: parseInt(m[3] ?? "0") };
};

// ============================================================
// ESTADO DERIVADO (puro — sem React)
// ============================================================
const deriveFinalDice = (dmg) => {
  const base = dmg?.numDice ?? 0;
  if (dmg?.damageIsCalculated) return base;
  return dmg?.isNarrativePhysical ? Math.max(0, base - 2) : base;
};

const condApplyTr  = (a) => a?.condition?.applyTrType || a?.trType || "";
const condRemoveTr = (a) => a?.condition?.removeTrType || condApplyTr(a);

const deriveCondPE = (condition) => {
  if (!condition) return 0;
  if (condition.tier === "nenhuma" || !condition.tier) return 0;
  if (condition.payment !== "pe") return 0;
  return CONDITION_PE_COST[condition.tier] ?? 0;
};

const deriveFinalPE = (baseCost, condition) => (baseCost ?? 0) + deriveCondPE(condition);

const getCondNdReduction = (condition) => {
  if (!condition || condition.tier === "nenhuma" || condition.payment !== "nd") return 0;
  return CONDITION_ND_COST[condition.tier] ?? 0;
};

// ============================================================
// normalizeAction
// ============================================================
function normalizeAction(action) {
  const dmg = action.damage ?? {};
  let { numDice, dieSize, mod } = dmg;
  if (numDice == null && dmg.roll) {
    const p = parseRollFromStr(dmg.roll);
    if (p) { numDice = p.numDice; dieSize = p.dieSize; mod = p.mod; }
  }
  const existingName = action.condition?.name ?? "";
  const nameKey = action.condition?.nameKey ??
    (CONDITION_NAMES.includes(existingName) ? existingName : existingName ? "outro" : "");
  const trades = { ...TRADES_ZERO, ...(action.trades ?? {}) };
  return {
    rangeType: "distancia",
    trades,
    toHitBase: action.toHitBase ?? action.toHit ?? 0,
    cdBase:    action.cdBase    ?? action.cd    ?? 0,
    // Bug #66 fix: atribuição duplicada de `condition` removida — só a versão completa abaixo
    ...action,
    rangeLocked: action.rangeLocked ?? true,
    areaLocked:  action.areaLocked  ?? true,
    areaShape:   action.areaShape   ?? "circle",
    lineWidthSteps: action.lineWidthSteps ?? 0,
    lineWidth:      action.lineWidth      ?? 0,
    damage: {
      type: "cortante",
      isNarrativePhysical: false,
      narrativeType: "padrao",
      damageIsLocked: true,
      damageIsCalculated: false,
      ...dmg,
      numDice:     numDice ?? 0,
      // Bug #31 fix: só fabrica d8 quando há dados (numDice>0). Sem dados
      // (ação sem dano), dieSize fica 0 e flag `isInvalidDice` evita que a
      // UI mostre "0d8+0" como se fosse uma rolagem real.
      dieSize:     dieSize ?? ((numDice ?? 0) > 0 ? 8 : 0),
      mod:         mod     ?? 0,
      narrativeType: dmg.narrativeType ?? (dmg.isNarrativePhysical ? "fisica" : "padrao"),
      numDiceBase: dmg.numDiceBase ?? numDice ?? 0,
      isInvalidDice: !!((numDice ?? 0) > 0 && !(dieSize ?? 0)),
    },
    condition: {
      tier: "nenhuma",
      payment: "pe",
      nameKey,
      name: nameKey === "outro" ? existingName : nameKey,
      durationMode: "ate_acabar",
      durationTurns: 1,
      ...(action.condition ?? {}),
      nameKey,
    },
    buff: {
      effect:        "toHit",
      // Auto: deriva da tabela em runtime usando bt/nd. Manual: usa customValue.
      customValue:   null,
      customCost:    null,
      training:      null, // id de reação por treinamento, se aplicável
      ...(action.buff ?? {}),
    },
    persistentArea: {
      enabled: false,
      durationTurns: 3,
      effectMode: "ambos",        // 'dano' | 'condicao' | 'ambos'
      applyOnEnter: true,
      applyOnTurn: true,
      trMode: "todo_turno",       // 'uma_vez' | 'todo_round' | 'todo_turno'
      residual: {
        mode: "nenhum",           // 'nenhum' | 'manter_turnos'
        turns: 1,
        keepDamage: false,
        keepCondition: true,
      },
      ...(action.persistentArea ?? {}),
      residual: {
        mode: "nenhum",
        turns: 1,
        keepDamage: false,
        keepCondition: true,
        ...((action.persistentArea ?? {}).residual ?? {}),
      },
    },
  };
}

// ============================================================
// BUFF HELPERS — resolve valores/custo a partir do BT/ND
// ============================================================
const BUFF_DURATION_LABEL = {
  bonus:  "até o fim da rodada",
  reacao: "durante 1 turno (até seu próximo turno)",
  rapida: "no instante seguinte (substitui Bônus/Reação sem custo de PE)",
};

function resolveBuffValues(type, bt, nd, buff) {
  const mode = getActionMode(type);
  if (mode === "buff_ofensivo" || (mode === "substituto" && (buff?.kind ?? "ofensivo") === "ofensivo")) {
    const table = getBonusBuff(bt, nd);
    if (!table) return null;
    const auto = table[buff?.effect ?? "toHit"];
    return {
      cost:   buff?.customCost ?? (mode === "substituto" ? 0 : table.cost),
      value:  buff?.customValue ?? auto,
      tableCost: table.cost,
      tableValue: auto,
      table, kind: "ofensivo",
    };
  }
  if (mode === "buff_defensivo" || mode === "substituto") {
    const table = getReactionBuff(bt);
    if (!table) return null;
    const auto = table[buff?.effect ?? "tr"];
    return {
      cost:   buff?.customCost ?? (mode === "substituto" ? 0 : table.cost),
      value:  buff?.customValue ?? auto,
      tableCost: table.cost,
      tableValue: auto,
      table, kind: "defensivo",
    };
  }
  return null;
}

// Constrói patch ao trocar o tipo de execução (Comum/Bônus/Reação/Rápida/Movimento/Livre).
// - Ataque: restaura attackType=acerto se estava suporte
// - Buff/Passivo: força attackType=suporte e aplica defaults da tabela de buff por BT/ND
function applyTypeChangePatch(newType, currentForm, bt, nd) {
  const mode  = getActionMode(newType);
  const patch = { type: newType };
  if (mode === "ataque") {
    if (currentForm.attackType === "suporte") patch.attackType = "acerto";
    return patch;
  }
  patch.attackType = "suporte";
  const currentBuff = currentForm.buff ?? {};
  const kindDefault = mode === "buff_defensivo" ? "defensivo" : "ofensivo";
  const kind = currentBuff.kind ?? kindDefault;
  const validEffects = kind === "ofensivo" ? BONUS_EFFECT_OPTIONS : REACTION_EFFECT_OPTIONS;
  const effect = validEffects.some(o => o.value === currentBuff.effect)
    ? currentBuff.effect
    : (kind === "ofensivo" ? "toHit" : "tr");
  const buff = { ...currentBuff, kind, effect, customValue: null, customCost: null, training: null };
  const resolved = resolveBuffValues(newType, bt, nd, buff);
  patch.buff = { ...buff, value: resolved?.value };
  patch.cost = resolved?.cost ?? 0;
  patch.condition = BLANK_CONDITION;
  return patch;
}




// ============================================================
// humanizeAction — exportada, consumida por CombatantPanel e LivePreview
// ============================================================
export function humanizeAction(action) {
  if (!action?.name) return "";
  const parts = [];
  const typeLabel = ACTION_TYPE_LABELS[action.type] || action.type || "Ação";
  parts.push(`${action.name} (${typeLabel}).`);

  if (action.description?.trim()) parts.push(action.description.trim());

  // ---------- Modos não-ataque (Bônus / Reação / Rápida / Movimento / Livre) ----------
  const mode = getActionMode(action.type);
  if (mode !== "ataque") {
    const buff = action.buff ?? {};
    if (mode === "buff_ofensivo" || mode === "buff_defensivo" || mode === "substituto") {
      const kind = buff.kind ?? (mode === "buff_defensivo" ? "defensivo" : "ofensivo");
      const labels = kind === "ofensivo" ? BONUS_EFFECT_LABELS : REACTION_EFFECT_LABELS;
      const effectLabel = labels[buff.effect] || buff.effect || "Efeito";
      const v = buff.value;
      const valueStr = v == null ? "" : (typeof v === "number" ? (v >= 0 ? `+${v}` : `${v}`) : ` ${v}`);
      const duration = BUFF_DURATION_LABEL[action.type] || "até o fim da rodada";
      const target = kind === "ofensivo" ? "à próxima Ação Comum" : "contra o próximo ataque/efeito recebido";
      parts.push(`Concede ${effectLabel}${valueStr} ${target}, ${duration}.`);
      const pe = action.cost ?? 0;
      if (mode === "substituto") parts.push(`Sem custo de PE (substitui Bônus/Reação via Ação Rápida).`);
      else if (pe > 0) parts.push(`Custo: ${pe} PE.`);
      if (buff.training) parts.push(buff.trainingDescription || "");
    } else {
      // passivo (movimento / livre) — só nome + descrição
      const pe = action.cost ?? 0;
      if (pe > 0) parts.push(`Custo: ${pe} PE.`);
    }
    return parts.filter(Boolean).join(" ");
  }


  const dmg = action.damage;
  const finalDice = deriveFinalDice(dmg);
  const dieSize   = dmg?.dieSize ?? 8;
  const mod       = dmg?.mod ?? 0;
  const roll      = rollStr(finalDice, dieSize, mod) || dmg?.roll || "";
  const hasDamage = !isEffectOnly(action) && roll;
  const dmgTypeLabel = dmg?.type === "alma" ? "na Alma" : (DAMAGE_TYPE_LABELS[dmg?.type] || dmg?.type || "");
  // Bug #62/#63 fix: sinaliza dado inválido na descrição (antes Math.max(1,...)
  // mascarava o problema e a ação parecia normal)
  const invalidMark = dmg?.isInvalidDice ? " ⚠ dado inválido — revise trades/divisor" : "";
  const dmgStr = hasDamage ? `${roll} de dano ${dmgTypeLabel}${invalidMark}` : null;

  if (action.attackType === "acerto") {
    // Bug #64 fix: formata acerto com sinal correto (+N ou -N), nunca "+−3"
    const hitPart   = action.toHit != null
      ? ` Acerto ${action.toHit >= 0 ? `+${action.toHit}` : action.toHit}.`
      : "";
    const rangePart = action.range ? ` Alcance ${action.range}.` : "";
    if (hasDamage) parts.push(`${hitPart}${rangePart} Causa ${dmgStr}.`);
    else if (hitPart || rangePart) parts.push(`${hitPart}${rangePart}`);
  } else if (action.attackType === "tr_individual") {
    const tr = TR_TYPE_LABELS[action.trType] || action.trType || "TR";
    const rangePart = action.range ? ` a ${action.range}` : "";
    if (hasDamage)
      parts.push(`Criatura${rangePart} realiza TR de ${tr} (CD ${action.cd}). Em uma falha, recebe ${dmgStr} (sucesso reduz à metade).`);
    else
      parts.push(`Criatura${rangePart} realiza TR de ${tr} (CD ${action.cd}).`);
  } else if (action.attackType === "tr_area") {
    const tr = TR_TYPE_LABELS[action.trType] || action.trType || "TR";
    const rangePart = action.range ? ` a ${action.range}` : "";
    const areaPart  = action.area  ? `, área de ${action.area}` : "";
    if (hasDamage)
      parts.push(`Criatura${rangePart}${areaPart} realiza TR de ${tr} (CD ${action.cd}). Em uma falha, recebe ${dmgStr} (sucesso reduz à metade).`);
    else
      parts.push(`Criatura${rangePart}${areaPart} realiza TR de ${tr} (CD ${action.cd}).`);
  }

  const cond = action.condition;
  if (cond?.tier && cond.tier !== "nenhuma") {
    const tierLabel = CONDITION_TIER_LABELS[cond.tier] || cond.tier;
    const condName  = cond.name?.trim() ? `[${cond.name}]` : `[condição ${tierLabel}]`;
    const aTr = condApplyTr(action), rTr = condRemoveTr(action);
    if (aTr && aTr !== action.trType) parts.push(`Teste para aplicar: ${TR_TYPE_LABELS[aTr]}.`);
    if (rTr && rTr !== aTr) parts.push(`Teste para retirar: ${TR_TYPE_LABELS[rTr]}.`);
    if (cond.payment === "nd") {
      const ndCost = CONDITION_ND_COST[cond.tier] ?? "?";
      parts.push(`Aplica a condição ${condName} (${tierLabel} — -${ndCost} ND).`);
    } else {
      // Bug #65 fix: mostra custo PE da condição quando payment === "pe"
      const peCost = CONDITION_PE_COST[cond.tier];
      if (typeof peCost === "number" && peCost > 0) {
        parts.push(`Aplica a condição ${condName} (${tierLabel} — +${peCost} PE).`);
      } else {
        parts.push(`Aplica a condição ${condName} (${tierLabel}).`);
      }
    }
  }

  const finalPE = deriveFinalPE(action.cost, cond);
  if (finalPE > 0) parts.push(`Custo: ${finalPE} PE.`);

  return parts.filter(Boolean).join(" ");
}

// ============================================================
// generateActionDescription — gerador de texto mecânico base
// ============================================================
export function generateActionDescription(action, creatureName, flavorText = "") {
  const creature  = creatureName?.trim() || "A criatura";
  const actionTypeLabel = ACTION_TYPE_LABELS[action.type] || "Ação";
  const flavor    = flavorText?.trim() || "";

  // ---------- Modos não-ataque ----------
  const mode = getActionMode(action.type);
  if (mode !== "ataque") {
    const buff = action.buff ?? {};
    const lines = [`Conjuração: ${actionTypeLabel}`];
    if (mode === "buff_ofensivo" || mode === "buff_defensivo" || mode === "substituto") {
      const kind = buff.kind ?? (mode === "buff_defensivo" ? "defensivo" : "ofensivo");
      const labels = kind === "ofensivo" ? BONUS_EFFECT_LABELS : REACTION_EFFECT_LABELS;
      const effectLabel = labels[buff.effect] || buff.effect || "Efeito";
      const v = buff.value;
      const valueStr = v == null ? "" : (typeof v === "number" ? (v >= 0 ? `+${v}` : `${v}`) : ` ${v}`);
      const duration = BUFF_DURATION_LABEL[action.type] || "até o fim da rodada";
      const pe = action.cost ?? 0;
      if (pe > 0) lines.push(`Custo: ${pe} PE`);
      if (mode === "substituto") lines.push(`Sem custo — substitui Bônus/Reação via Ação Rápida`);
      lines.push("");
      const target = kind === "ofensivo" ? "sua próxima Ação Comum" : "o próximo ataque/efeito recebido";
      let mech = `${creature} concede ${effectLabel}${valueStr} a ${target}, ${duration}.`;
      if (buff.training && buff.trainingDescription) mech += ` ${buff.trainingDescription}`;
      lines.push([flavor, mech].filter(Boolean).join(" "));
      return lines.join("\n");
    }
    // passivo
    const pe = action.cost ?? 0;
    if (pe > 0) lines.push(`Custo: ${pe} PE`);
    lines.push("");
    lines.push(flavor || `${creature} executa ${action.name || "esta ação"} como ação de ${actionTypeLabel.toLowerCase()}.`);
    return lines.join("\n");
  }

  const dmg       = action.damage;
  const finalDice = deriveFinalDice(dmg);
  const dieSize   = dmg?.dieSize ?? 8;
  const mod       = dmg?.mod ?? 0;
  const rollDisplay = isEffectOnly(action) ? "" : rollStr(finalDice, dieSize, mod);
  const dmgType     = dmg?.type === "alma" ? "na Alma" : (DAMAGE_TYPE_LABELS[dmg?.type] || dmg?.type || "");
  const finalPE   = deriveFinalPE(action.cost, action.condition);
  const isTR      = action.attackType?.startsWith("tr_");
  const isTRArea  = action.attackType === "tr_area";
  const isAcerto  = action.attackType === "acerto";
  const hasCond   = action.condition?.tier && action.condition.tier !== "nenhuma";
  const isComplex = finalPE > 0 || hasCond || isTR;
  const alcance   = action.range || "-";
  const area      = action.area  || "-";


  if (isAcerto && !isComplex) {
    const opening = flavor || `${creature} golpeia utilizando ${action.name || "esta ação"}.`;
    return `${opening} Alcance de ${alcance}, +${action.toHit ?? 0} para acertar, causa ${rollDisplay} de dano ${dmgType}.`;
  }

  if (isTR || isComplex) {
    const trAttr   = TR_TYPE_LABELS[action.trType] || "TR";
    const isCaC    = action.rangeType === "cac";
    const targetDesc = isTRArea
      ? (isCaC ? "Toda criatura na área partindo de você" : "Toda criatura na área")
      : "A criatura alvo";
    const areaLine = isTRArea
      ? `Área: ${area}${isCaC ? " partindo de si mesmo" : ""}`
      : null;
    const lines    = [
      `Conjuração: ${actionTypeLabel}`,
      `Alcance: ${alcance}`,
      ...(!isTRArea ? [`Alvo: Uma criatura`] : []),
      ...(areaLine  ? [areaLine]             : []),
      ...(finalPE > 0 ? [`Custo: ${finalPE} PE`] : []),
      "",
    ];

    let mechanicalText = "";
    if (isTR && rollDisplay) {
      mechanicalText = `${targetDesc} deve realizar um teste de resistência de ${trAttr} (CD ${action.cd ?? 0}), recebendo ${rollDisplay} de dano ${dmgType}, ou apenas metade em um sucesso.`;
    } else if (isTR) {
      mechanicalText = `${targetDesc} deve realizar um teste de resistência de ${trAttr} (CD ${action.cd ?? 0}).`;
    } else if (isAcerto && rollDisplay) {
      mechanicalText = `Alcance de ${alcance}, +${action.toHit ?? 0} para acertar, causa ${rollDisplay} de dano ${dmgType}.`;
    }
    if (hasCond) {
      const tierLabel = CONDITION_TIER_LABELS[action.condition.tier] || action.condition.tier;
      const rawName   = action.condition.name?.trim();
      const condName  = rawName
        ? rawName.charAt(0).toUpperCase() + rawName.slice(1)
        : tierLabel;
      const condSuffix = rawName ? ` (${tierLabel})` : "";
      const applyTr  = condApplyTr(action);
      const removeTr = condRemoveTr(action);
      const applyTxt = applyTr && applyTr !== action.trType
        ? ` Além disso, deve realizar um teste de resistência de ${TR_TYPE_LABELS[applyTr]} (CD ${action.cd ?? 0}); caso falhe, sofre a condição ${condName}${condSuffix}.`
        : ` Além disso, caso falhe, sofre a condição ${condName}${condSuffix}.`;
      const removeTxt = removeTr && removeTr !== applyTr
        ? ` Para se livrar da condição, realiza um teste de resistência de ${TR_TYPE_LABELS[removeTr]}.`
        : "";
      mechanicalText += applyTxt + removeTxt;
    }

    const secondParagraph = [flavor, mechanicalText].filter(Boolean).join(" ");
    if (secondParagraph) lines.push(secondParagraph);
    return lines.join("\n");
  }

  return flavor;
}

// ============================================================
// SECTION ACTIONS
// ============================================================
// Grimório §8 Ações por Turno: 1 Comum, 1 Bônus, 1 Rápida, 1 Reação, 1 Movimento;
// Livre é ilimitada. Características especiais ajustam via derived.actionsTotal.
const DEFAULT_MAX_BY_TYPE = { comum: 1, bonus: 1, rapida: 1, reacao: 1, movimento: 1, livre: Infinity };

function getMaxByType(total) {
  return {
    comum:     total?.comum     ?? DEFAULT_MAX_BY_TYPE.comum,
    bonus:     total?.bonus     ?? DEFAULT_MAX_BY_TYPE.bonus,
    rapida:    total?.rapida    ?? DEFAULT_MAX_BY_TYPE.rapida,
    reacao:    total?.reacao    ?? DEFAULT_MAX_BY_TYPE.reacao,
    movimento: total?.movimento ?? DEFAULT_MAX_BY_TYPE.movimento,
    livre:     Infinity,
  };
}

// O limite por tipo vale para o USO em combate (ações por turno), não para
// quantas ações a ficha pode ter cadastradas — a criatura pode ter várias
// opções e escolher quais usar a cada turno.
function buildTypeOptions(usedByType, maxByType, currentType) {
  return ACTION_TYPE_OPTIONS.map((opt) => {
    const max  = maxByType[opt.value] ?? Infinity;
    const used = usedByType[opt.value] ?? 0;
    const suffix = Number.isFinite(max) ? ` (${used} cad., máx ${max}/turno)` : "";
    return {
      value: opt.value,
      label: `${opt.label}${suffix}`,
      disabled: false,
    };
  });
}

export default function SectionActions({ draft, derived, actions }) {
  const [showForm, setShowForm] = useState(false);

  const total       = derived.actionsTotal ?? { comum: 1, bonus: 0, rapida: 0, movimento: 1, reacao: 1 };
  const maxByType   = getMaxByType(total);
  const usedByType  = (draft.actions.list ?? []).reduce((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1;
    return acc;
  }, {});
  const patamar = draft.core?.patamar;
  const nd      = draft.core?.nd;
  const bt      = derived.bt ?? 2;

  const handleAdd = (newAction) => {
    actions.addAction({ ...newAction, id: `act-${Date.now().toString(36)}` });
    setShowForm(false);
  };

  return (
    <div className="space-y-3">
      <div className="bg-slate-950/60 border border-slate-800 rounded px-3 py-2 flex flex-wrap gap-2 text-xs">
        <span className="text-slate-500" title="Cadastradas / limite de uso por turno">Cadastradas / uso por turno:</span>
        <Pill color="rose">{usedByType.comum ?? 0}/{total.comum} Comum</Pill>
        <Pill color="amber">{usedByType.rapida ?? 0}/{total.rapida} Rápida</Pill>
        <Pill color="sky">{usedByType.bonus ?? 0}/{total.bonus} Bônus</Pill>
        <Pill color="emerald">{usedByType.movimento ?? 0}/{total.movimento} Movimento</Pill>
        <Pill color="purple">{usedByType.reacao ?? 0}/{total.reacao} Reação</Pill>
        <Pill color="slate">{usedByType.livre ?? 0} Livre</Pill>
      </div>

      <div className="space-y-2">
        {draft.actions.list.length === 0 && (
          <div className="text-center py-6 text-slate-600 text-sm italic border border-dashed border-slate-800 rounded">
            Nenhuma ação cadastrada
          </div>
        )}
        {draft.actions.list.map((action) => (
          <ActionItem
            key={action.id}
            action={action}
            patamar={patamar}
            nd={nd}
            bt={bt}
            creatureName={draft.name || "A criatura"}
            typeOptions={buildTypeOptions(usedByType, maxByType, action.type)}
            onUpdate={(patch) => actions.updateAction(action.id, patch)}
            onRemove={() => actions.removeAction(action.id)}
            onDuplicate={() => actions.duplicateAction(action.id)}
          />
        ))}
      </div>

      {showForm ? (
        <ActionForm
          derived={derived}
          draft={draft}
          typeOptions={buildTypeOptions(usedByType, maxByType, null)}
          onAdd={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <SmallButton
            onClick={() => setShowForm(true)}
            variant="primary"
            title="Adicionar mais uma opção de ação à ficha (o limite por turno vale só no combate)"
          >
            <Plus className="w-3 h-3" /> Adicionar Ação
          </SmallButton>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ACTION ITEM
// ============================================================
function ActionItem({ action, patamar, nd, bt, creatureName, typeOptions, onUpdate, onRemove, onDuplicate }) {
  const [expanded, setExpanded] = useState(false);
  const norm    = normalizeAction(action);
  const finalPE = deriveFinalPE(norm.cost, norm.condition);

  // Full recalc from table + apply trades + divisor pipeline (used when unlocked)
  const runFullCalc = (attackType, condition, narrativeType, rangeType, trades, damageType) =>
    runFullCalcPure({
      patamar, nd, bt,
      attackType, condition, narrativeType, rangeType, trades, damageType,
      baseHit: norm.toHitBase ?? norm.toHit ?? 0,
      baseCd:  norm.cdBase    ?? norm.cd    ?? 0,
      fallbackDamageType: norm.damage?.type ?? "cortante",
      noDamage: norm.noDamage === true,
    });

  // Re-apply trades (locked) — usa helper puro
  const reapplyTradesHelper = (rangeType, trades) =>
    reapplyTradesPure({ source: norm, rangeType, trades, bt });



  const update = (patch) => {
    if ("type" in patch && patch.type !== norm.type) {
      const typePatch = applyTypeChangePatch(patch.type, norm, bt, nd);
      // Se virou ataque (a partir de buff), recalcula dano. Caso contrário só aplica o patch.
      if (getActionMode(patch.type) === "ataque" && typePatch.attackType) {
        const resetTrades = resetTradesForAttackType(typePatch.attackType, norm.trades ?? TRADES_ZERO);
        const r = runFullCalc(typePatch.attackType, norm.condition, norm.damage?.narrativeType, norm.rangeType, resetTrades, norm.damage?.type);
        if (r) { onUpdate({ ...typePatch, trades: resetTrades, ...r, damage: { ...norm.damage, ...r.damage } }); return; }
      }
      onUpdate(typePatch); return;
    }
    if ("buff" in patch) {
      const merged = { ...(norm.buff ?? {}), ...patch.buff };
      const resolved = resolveBuffValues(norm.type, bt, nd, merged);
      onUpdate({ buff: { ...merged, value: resolved?.value }, cost: resolved?.cost ?? norm.cost ?? 0 });
      return;
    }
    if ("attackType" in patch) {

      const resetTrades = resetTradesForAttackType(patch.attackType, norm.trades ?? TRADES_ZERO);
      const basePatch   = { ...patch, trades: resetTrades };
      if (patch.attackType === "acerto") basePatch.condition = BLANK_CONDITION;
      const av = calcAutoRange(patch.attackType, norm.rangeType, bt, norm.areaRangeSteps, norm.areaShape, norm.lineWidthSteps);
      if (norm.rangeLocked !== false) basePatch.range = av.range;
      if (norm.areaLocked  !== false) basePatch.area  = av.area;
      basePatch.lineWidth = av.lineWidth;
      if (!norm.damage?.damageIsLocked) {
        const r = runFullCalc(patch.attackType, norm.condition, norm.damage?.narrativeType, norm.rangeType, resetTrades, norm.damage?.type);
        if (r) { onUpdate({ ...basePatch, ...r, damage: { ...norm.damage, ...r.damage } }); return; }
      }
      const reapplied = reapplyTradesHelper(norm.rangeType, resetTrades);
      onUpdate({ ...basePatch, ...reapplied });
      return;
    }
    if ("toHitBase" in patch) {
      const t = norm.trades ?? TRADES_ZERO;
      onUpdate({ ...patch, toHit: (patch.toHitBase ?? 0) + ((t.sacrifDadosAcerto ?? 0) * 2) - (t.sacrifAcertoDados ?? 0) });
      return;
    }
    if ("cdBase" in patch) {
      const t = norm.trades ?? TRADES_ZERO;
      onUpdate({ ...patch, cd: (patch.cdBase ?? 0) + (t.sacrifDadosCD ?? 0) - (t.sacrifCdDados ?? 0) });
      return;
    }
    onUpdate(patch);
  };

  const updateDamage = (patch) => {
    const isUnlocking        = patch.damageIsLocked === false && norm.damage?.damageIsLocked === true;
    const isNarrativeChange  = "narrativeType" in patch && !norm.damage?.damageIsLocked;
    const isDamageTypeChange = "type" in patch && !norm.damage?.damageIsLocked;

    if (isUnlocking || isNarrativeChange || isDamageTypeChange) {
      const newNarrative = "narrativeType" in patch ? patch.narrativeType : norm.damage?.narrativeType;
      const newType      = "type" in patch ? patch.type : norm.damage?.type;
      const r = runFullCalc(norm.attackType, norm.condition, newNarrative, norm.rangeType, norm.trades, newType);
      if (r) {
        onUpdate({ ...r, damage: { ...norm.damage, ...patch, ...r.damage, damageIsCalculated: true } });
        return;
      }
    }

    const dmg = { ...norm.damage, ...patch };
    if ("numDiceBase" in patch && !("numDice" in patch)) {
      const tradeRes = applyTrades(
        patch.numDiceBase, norm.toHitBase ?? norm.toHit ?? 0, norm.cdBase ?? norm.cd ?? 0,
        norm.rangeType, norm.trades, bt
      );
      const divisor = computeDivisor(norm.attackType, dmg.type ?? "cortante");
      const ds = applyDivisorSimple(tradeRes.dadosFinais, divisor);
      dmg.numDice = ds.numDice;
      dmg.isInvalidDice = ds.isInvalidDice;
    }
    dmg.roll    = rollStr(dmg.numDice, dmg.dieSize, dmg.mod);
    dmg.average = rollAverage(deriveFinalDice(dmg), dmg.dieSize, dmg.mod);
    onUpdate({ damage: dmg });
  };

  const updateCond = (patch) => {
    const newCondition = { ...norm.condition, ...patch };
    const condUpdate   = { condition: newCondition };
    if (!norm.damage?.damageIsLocked && ("tier" in patch || "payment" in patch)) {
      const r = runFullCalc(norm.attackType, newCondition, norm.damage?.narrativeType, norm.rangeType, norm.trades, norm.damage?.type);
      if (r) Object.assign(condUpdate, r, { damage: { ...norm.damage, ...r.damage, damageIsCalculated: true } });
    }
    onUpdate(condUpdate);
  };

  const updateTrade = (patch) => {
    const newTrades = enforceMutualExclusion({ ...(norm.trades ?? TRADES_ZERO), ...patch });
    const tradePatch = { trades: newTrades };
    if (!norm.damage?.damageIsLocked) {
      const r = runFullCalc(norm.attackType, norm.condition, norm.damage?.narrativeType, norm.rangeType, newTrades, norm.damage?.type);
      if (r) { onUpdate({ ...tradePatch, ...r, damage: { ...norm.damage, ...r.damage, damageIsLocked: false } }); return; }
    }
    const reapplied = reapplyTradesHelper(norm.rangeType, newTrades);
    onUpdate({ ...tradePatch, ...reapplied });
  };

  const updateRangeType = (newRangeType) => {
    const av = calcAutoRange(norm.attackType, newRangeType, bt, norm.areaRangeSteps, norm.areaShape, norm.lineWidthSteps);
    const rangePatch = {
      rangeType: newRangeType,
      lineWidth: av.lineWidth,
      ...(norm.rangeLocked !== false ? { range: av.range } : {}),
      ...(norm.areaLocked  !== false ? { area:  av.area  } : {}),
    };
    if (!norm.damage?.damageIsLocked) {
      const r = runFullCalc(norm.attackType, norm.condition, norm.damage?.narrativeType, newRangeType, norm.trades, norm.damage?.type);
      if (r) { onUpdate({ ...rangePatch, ...r, damage: { ...norm.damage, ...r.damage, damageIsLocked: false } }); return; }
    }
    const reapplied = reapplyTradesHelper(newRangeType, norm.trades);
    onUpdate({ ...rangePatch, ...reapplied });
  };

  return (
    <div className="bg-slate-950/40 border border-slate-800 rounded">
      <div className="flex items-center gap-2 p-2">
        <Swords className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left text-sm font-semibold text-white hover:text-purple-300 min-w-0 flex items-center gap-1.5"
          title={expanded ? "Recolher" : "Clique para editar"}
        >
          <span className="truncate block">{action.name || "Ação sem nome"}</span>
        </button>
        <Pill color="slate">{ACTION_TYPE_LABELS[action.type] || action.type}</Pill>
        {finalPE > 0 && <Pill color="purple">{finalPE} PE</Pill>}
        <SmallButton
          onClick={() => setExpanded(!expanded)}
          title={expanded ? "Recolher" : "Editar"}
          variant={expanded ? "primary" : undefined}
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
        </SmallButton>
        <SmallButton onClick={onDuplicate} title="Duplicar">
          <Copy className="w-3 h-3" />
        </SmallButton>
        <SmallButton onClick={onRemove} variant="danger" title="Remover">
          <Trash2 className="w-3 h-3" />
        </SmallButton>
      </div>

      {expanded ? (
        <div className="border-t border-slate-800 p-3 space-y-3">
          <ActionFormFields
            form={norm}
            bt={bt}
            nd={nd}
            creatureName={creatureName}
            typeOptions={typeOptions}


            update={update}
            updateDamage={updateDamage}
            updateCond={updateCond}
            updateTrade={updateTrade}
            updateRangeType={updateRangeType}
          />
        </div>
      ) : (
        <div className="px-3 pb-2">
          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">
            {generateActionDescription(norm, creatureName, norm.description) || humanizeAction(norm)}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ACTION FORM (nova ação)
// ============================================================
function ActionForm({ derived, draft, typeOptions, onAdd, onCancel }) {
  const availableTypes = (typeOptions ?? ACTION_TYPE_OPTIONS).filter((o) => !o.disabled);
  const defaultType = availableTypes.find((o) => o.value === "comum")?.value
    ?? availableTypes[0]?.value
    ?? "livre";
  const patamar = draft?.core?.patamar;
  const nd      = draft?.core?.nd;
  const bt      = derived?.bt ?? 2;

  const [isMechanicalTextLocked, setIsMechanicalTextLocked] = useState(true);
  const [manualMechanicalText,   setManualMechanicalText]   = useState("");
  const textareaRef = useRef(null);

  const [form, setForm] = useState(() => {
    const calcDmg    = calculateActionDamage(patamar, nd, "acerto", false);
    const tHitBase   = derived?.acertoPrincipal ?? 0;
    const tCdBase    = derived?.cdBase ?? 0;
    const numDiceBase = calcDmg?.numDice ?? 0;
    const initAuto   = calcAutoRange("acerto", "distancia", bt);
    return {
      name:      "",
      type:      defaultType,
      attackType: "acerto",
      toHit:     tHitBase,
      toHitBase: tHitBase,
      cd:        tCdBase,
      cdBase:    tCdBase,
      trType:    "fortitude",
      range:     initAuto.range,
      area:      initAuto.area,
      rangeType: "distancia",
      rangeLocked: true,
      areaLocked:  true,
      trades:    { ...TRADES_ZERO },
      damage: {
        type:              "cortante",
        narrativeType:     "padrao",
        isNarrativePhysical: false,
        damageIsLocked:    false,
        damageIsCalculated: true,
        numDice:           numDiceBase,
        numDiceBase,
        dieSize:           calcDmg?.dieSize ?? 8,
        mod:               calcDmg?.mod ?? 0,
        roll:              calcDmg?.roll ?? "",
        average:           calcDmg?.average ?? 0,
      },
      condition: { tier: "nenhuma", name: "", nameKey: "", payment: "pe" },
      cost:        0,
      description: "",
    };
  });

  const runFullCalc = (attackType, condition, narrativeType, rangeType, trades, damageType) =>
    runFullCalcPure({
      patamar, nd, bt,
      attackType, condition, narrativeType, rangeType, trades, damageType,
      baseHit: derived?.acertoPrincipal ?? 0,
      baseCd:  derived?.cdBase ?? 0,
      noDamage: form.noDamage === true,
    });

  const reapplyTradesHelper = (prev, rangeType, trades) =>
    reapplyTradesPure({ source: prev, rangeType, trades, bt });


  const update = (patch) =>
    setForm((prev) => {
      let next = { ...prev, ...patch };

      if ("type" in patch && patch.type !== prev.type) {
        const tp = applyTypeChangePatch(patch.type, prev, bt, nd);
        Object.assign(next, tp);
        if (getActionMode(patch.type) === "ataque" && tp.attackType) {
          const resetTrades = resetTradesForAttackType(tp.attackType, prev.trades ?? TRADES_ZERO);
          next.trades = resetTrades;
          const r = runFullCalc(tp.attackType, prev.condition, prev.damage?.narrativeType, prev.rangeType, resetTrades, prev.damage?.type);
          if (r) Object.assign(next, r, { damage: { ...prev.damage, ...r.damage, damageIsLocked: false } });
        }
        return next;
      }

      if ("buff" in patch) {
        const merged = { ...(prev.buff ?? {}), ...patch.buff };
        const resolved = resolveBuffValues(prev.type, bt, nd, merged);
        next.buff = { ...merged, value: resolved?.value };
        next.cost = resolved?.cost ?? 0;
      }



      if ("attackType" in patch) {
        const resetTrades = resetTradesForAttackType(patch.attackType, prev.trades ?? TRADES_ZERO);
        next.trades = resetTrades;
        if (patch.attackType === "acerto") next.condition = BLANK_CONDITION;
        const av = calcAutoRange(patch.attackType, next.rangeType, bt, next.areaRangeSteps, next.areaShape, next.lineWidthSteps);
        if (next.rangeLocked !== false) next.range = av.range;
        if (next.areaLocked  !== false) next.area  = av.area;
        next.lineWidth = av.lineWidth;
        if (!prev.damage?.damageIsLocked) {
          const r = runFullCalc(patch.attackType, prev.condition, prev.damage?.narrativeType, prev.rangeType, resetTrades, prev.damage?.type);
          if (r) Object.assign(next, r, { damage: { ...prev.damage, ...r.damage, damageIsLocked: false } });
        } else {
          const reapplied = reapplyTradesHelper(next, prev.rangeType, resetTrades);
          Object.assign(next, reapplied);
        }
      }

      if ("toHitBase" in patch) {
        const t = next.trades ?? TRADES_ZERO;
        next.toHit = (patch.toHitBase ?? 0) + ((t.sacrifDadosAcerto ?? 0) * 2) - (t.sacrifAcertoDados ?? 0);
      }
      if ("cdBase" in patch) {
        const t = next.trades ?? TRADES_ZERO;
        next.cd = (patch.cdBase ?? 0) + (t.sacrifDadosCD ?? 0) - (t.sacrifCdDados ?? 0);
      }

      // Modo "apenas efeito" (suporte ou noDamage) força custo da condição em PE.
      // ND não faz sentido sem rolagem de dano, pois o gatilho do desconto é o acerto/dano.
      if ((next.attackType === "suporte" || next.noDamage === true) && next.condition && next.condition.payment !== "pe") {
        next.condition = { ...next.condition, payment: "pe" };
      }

      return next;
    });


  const updateDamage = (patch) =>
    setForm((prev) => {
      const isUnlocking        = patch.damageIsLocked === false && prev.damage?.damageIsLocked === true;
      const isNarrativeChange  = "narrativeType" in patch && !prev.damage?.damageIsLocked;
      const isDamageTypeChange = "type" in patch && !prev.damage?.damageIsLocked;

      if (isUnlocking || isNarrativeChange || isDamageTypeChange) {
        const newNarrative = "narrativeType" in patch ? patch.narrativeType : prev.damage?.narrativeType;
        const newType      = "type" in patch ? patch.type : prev.damage?.type;
        const r = runFullCalc(prev.attackType, prev.condition, newNarrative, prev.rangeType, prev.trades, newType);
        if (r) return { ...prev, ...r, damage: { ...prev.damage, ...patch, ...r.damage, damageIsCalculated: true } };
      }

      const dmg = { ...prev.damage, ...patch };
      if ("numDiceBase" in patch && !("numDice" in patch)) {
        const tradeRes = applyTrades(
          patch.numDiceBase, prev.toHitBase ?? prev.toHit ?? 0, prev.cdBase ?? prev.cd ?? 0,
          prev.rangeType, prev.trades, bt
        );
        const divisor = computeDivisor(prev.attackType, dmg.type ?? "cortante");
        const ds = applyDivisorSimple(tradeRes.dadosFinais, divisor);
        dmg.numDice = ds.numDice;
        dmg.isInvalidDice = ds.isInvalidDice;
      }
      if (!("damageIsLocked" in patch) && !("narrativeType" in patch) && !isDamageTypeChange) {
        dmg.roll    = rollStr(dmg.numDice, dmg.dieSize, dmg.mod);
        dmg.average = rollAverage(deriveFinalDice(dmg), dmg.dieSize, dmg.mod);
      }
      return { ...prev, damage: dmg };
    });

  const updateCond = (patch) =>
    setForm((prev) => {
      const newCondition = { ...prev.condition, ...patch };
      let next = { ...prev, condition: newCondition };
      if (!prev.damage?.damageIsLocked && ("tier" in patch || "payment" in patch)) {
        const r = runFullCalc(prev.attackType, newCondition, prev.damage?.narrativeType, prev.rangeType, prev.trades, prev.damage?.type);
        if (r) Object.assign(next, r, { damage: { ...prev.damage, ...r.damage, damageIsCalculated: true } });
      }
      return next;
    });

  const updateTrade = (patch) =>
    setForm((prev) => {
      const newTrades = enforceMutualExclusion({ ...(prev.trades ?? TRADES_ZERO), ...patch });
      if (!prev.damage?.damageIsLocked) {
        const r = runFullCalc(prev.attackType, prev.condition, prev.damage?.narrativeType, prev.rangeType, newTrades, prev.damage?.type);
        if (r) return { ...prev, trades: newTrades, ...r, damage: { ...prev.damage, ...r.damage, damageIsLocked: false } };
      }
      const reapplied = reapplyTradesHelper(prev, prev.rangeType, newTrades);
      return { ...prev, trades: newTrades, ...reapplied };
    });

  const updateRangeType = (newRangeType) =>
    setForm((prev) => {
      const av = calcAutoRange(prev.attackType, newRangeType, bt, prev.areaRangeSteps, prev.areaShape, prev.lineWidthSteps);
      const rangeUpdates = {
        rangeType: newRangeType,
        lineWidth: av.lineWidth,
        ...(prev.rangeLocked !== false ? { range: av.range } : {}),
        ...(prev.areaLocked  !== false ? { area:  av.area  } : {}),
      };
      if (!prev.damage?.damageIsLocked) {
        const r = runFullCalc(prev.attackType, prev.condition, prev.damage?.narrativeType, newRangeType, prev.trades, prev.damage?.type);
        if (r) return { ...prev, ...rangeUpdates, ...r, damage: { ...prev.damage, ...r.damage, damageIsLocked: false } };
      }
      const reapplied = reapplyTradesHelper(prev, newRangeType, prev.trades);
      return { ...prev, ...rangeUpdates, ...reapplied };
    });

  const handleResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    handleResize();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, isMechanicalTextLocked, manualMechanicalText]);

  return (
    <div className="bg-slate-950/70 border border-purple-900/50 rounded p-4 space-y-3">
      <h4 className="text-sm font-bold text-purple-300 flex items-center gap-2">
        <Plus className="w-4 h-4" /> Nova Ação
      </h4>

      <ActionFormFields
        form={form}
        bt={bt}
        nd={nd}
        creatureName={draft?.name || "A criatura"}
        typeOptions={typeOptions}


        update={update}
        updateDamage={updateDamage}
        updateCond={updateCond}
        updateTrade={updateTrade}
        updateRangeType={updateRangeType}
      />

      {form.name?.trim() && (form.attackType !== "suporte" || getActionMode(form.type) !== "ataque") && (() => {
          const autoText = generateActionDescription(form, draft?.name, form.description);
          if (!autoText) return null;
          const displayText = isMechanicalTextLocked ? autoText : manualMechanicalText;
          const toggleLockMechanical = () => {
            if (isMechanicalTextLocked) {
              setManualMechanicalText(autoText);
              setIsMechanicalTextLocked(false);
            } else {
              setIsMechanicalTextLocked(true);
            }
          };
          return (
            <div className="bg-slate-900/60 border border-slate-700 rounded p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                  Texto Final
                </div>
                <button
                  type="button"
                  onClick={toggleLockMechanical}
                  title={isMechanicalTextLocked ? "Clique para editar manualmente" : "Clique para voltar ao texto automático"}
                  style={{
                    borderColor: isMechanicalTextLocked ? "rgb(71 85 105)"        : "rgb(217 119 6 / 0.6)",
                    color:       isMechanicalTextLocked ? "rgb(100 116 139)"       : "rgb(251 191 36)",
                    background:  isMechanicalTextLocked ? "transparent"            : "rgb(120 53 15 / 0.2)",
                  }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs transition-colors"
                >
                  {isMechanicalTextLocked
                    ? <><Lock   className="w-3 h-3" /> Auto</>
                    : <><Unlock className="w-3 h-3" /> Manual</>}
                </button>
              </div>
              <textarea
                ref={textareaRef}
                readOnly={isMechanicalTextLocked}
                value={displayText}
                onChange={(e) => { if (!isMechanicalTextLocked) { setManualMechanicalText(e.target.value); handleResize(); } }}
                className={`w-full bg-slate-950 border rounded px-2.5 py-2 text-xs text-slate-300 leading-relaxed resize-none overflow-hidden focus:outline-none transition-colors ${
                  isMechanicalTextLocked
                    ? "border-slate-800 cursor-default text-slate-400"
                    : "border-amber-700/60 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                }`}
              />
              {!isMechanicalTextLocked && (
                <p className="text-xs text-amber-500/70 italic">
                  Editando manualmente — feche o cadeado para voltar ao texto automático.
                </p>
              )}
            </div>
          );
        })()}

      <div className="flex justify-end gap-2 pt-1">
        <SmallButton onClick={onCancel}>Cancelar</SmallButton>
        <SmallButton onClick={() => onAdd(form)} variant="primary" disabled={!form.name.trim()}>
          <Plus className="w-3 h-3" /> Adicionar
        </SmallButton>
      </div>
    </div>
  );
}

// ============================================================
// TRADE ROW — stepper de conversão equivalente
// ============================================================
function TradeRow({ label, hint, value, onChange, step = 1, blocked, max }) {
  const canDecrease = value > 0;
  const canIncrease = !blocked && (max === undefined || value + step <= max);
  const btnBase = "w-7 h-7 flex items-center justify-center rounded text-sm font-bold border transition-colors focus:outline-none select-none";
  const btnActive   = "border-slate-600 text-white hover:bg-slate-700 hover:border-slate-500 active:scale-95";
  const btnDisabled = "border-slate-800 text-slate-700 cursor-not-allowed";

  return (
    <div className={`flex items-center gap-2 ${blocked ? "opacity-40" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-300 leading-tight">{label}</div>
        <div className="text-xs text-slate-500 leading-tight">{hint}</div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => canDecrease && onChange(Math.max(0, value - step))}
          disabled={!canDecrease}
          className={`${btnBase} shrink-0 ${canDecrease ? btnActive : btnDisabled}`}
        >
          −
        </button>
        <span className={`w-6 text-center text-sm font-mono font-semibold shrink-0 ${value > 0 ? "text-amber-300" : "text-slate-600"}`}>
          {value}
        </span>
        <button
          type="button"
          onClick={() => canIncrease && onChange(value + step)}
          disabled={!canIncrease}
          className={`${btnBase} shrink-0 ${canIncrease ? btnActive : btnDisabled}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

// ============================================================
// FORM FIELDS — compartilhado entre ActionItem e ActionForm
// ============================================================
function ActionFormFields({ form, bt = 2, nd = 0, creatureName, typeOptions, update, updateDamage, updateCond, updateTrade, updateRangeType }) {
  const actionMode = getActionMode(form.type);
  const isInAttackMode = actionMode === "ataque";
  const isTR      = isInAttackMode && form.attackType?.startsWith("tr_");
  const isAcerto  = isInAttackMode && form.attackType === "acerto";
  const hasDamage = isInAttackMode && form.attackType !== "suporte" && form.noDamage !== true;

  const hasCond   = form.condition?.tier && form.condition.tier !== "nenhuma";

  const dieSize   = form.damage?.dieSize ?? 8;
  const mod       = form.damage?.mod ?? 0;
  const isLocked  = form.damage?.damageIsLocked === true;
  const isAutoCalc = form.damage?.damageIsCalculated === true && !isLocked;
  const narrativeType = form.damage?.narrativeType ?? "padrao";
  const finalDice  = deriveFinalDice(form.damage);

  const condPE  = deriveCondPE(form.condition);
  const finalPE = deriveFinalPE(form.cost, form.condition);
  const isCondND = hasCond && form.condition?.payment === "nd";

  // Trade / alcance state
  const trades      = { ...TRADES_ZERO, ...(form.trades ?? {}) };
  const rangeType   = form.rangeType ?? "distancia";
  const params      = getActionParams(bt);
  const numDiceBase = form.damage?.numDiceBase ?? form.damage?.numDice ?? 0;
  const toHitBase   = form.toHitBase ?? form.toHit ?? 0;
  const cdBase      = form.cdBase    ?? form.cd    ?? 0;

  // Deltas para mostrar ajuste acima do base
  const tradeToHitDelta = (trades.sacrifDadosAcerto * 2) - trades.sacrifAcertoDados;
  const tradeCdDelta    = trades.sacrifDadosCD - trades.sacrifCdDados;

  // Mutual exclusion: bloqueia lado oposto
  const blockedDadosAcerto  = trades.sacrifAcertoDados > 0;
  const blockedDadosCD      = trades.sacrifCdDados     > 0;
  const blockedAcertoDados  = trades.sacrifDadosAcerto > 0;
  const blockedCdDados      = trades.sacrifDadosCD     > 0;

  // Caps por BT + trava de mínimo 1 dado no pool bruto
  const bonusCaCPool = rangeType === "cac" ? params.meleeBonusDice : 0;
  const rawDicePool  = numDiceBase + bonusCaCPool
    + Math.floor((trades.sacrifAcertoDados ?? 0) / 2)
    + (trades.sacrifCdDados ?? 0);
  const capDadosAcerto  = Math.max(0, Math.min(bt, rawDicePool - 1 - (trades.sacrifDadosCD ?? 0)));
  const capDadosCD      = Math.max(0, Math.min(bt, rawDicePool - 1 - (trades.sacrifDadosAcerto ?? 0)));
  const capCdDados      = bt;
  const capAcertoDados  = bt * 2;

  const hasActiveTrades =
    (isAcerto && (trades.sacrifDadosAcerto > 0 || trades.sacrifAcertoDados > 0)) ||
    (isTR    && (trades.sacrifDadosCD     > 0 || trades.sacrifCdDados      > 0)) ||
    rangeType === "cac";

  const rangeLocked = form.rangeLocked !== false;
  const areaLocked  = form.areaLocked  !== false;
  const autoVals    = calcAutoRange(form.attackType, rangeType, bt, form.areaRangeSteps, form.areaShape, form.lineWidthSteps);

  const toggleRangeLock = () => {
    if (!rangeLocked) update({ rangeLocked: true, range: autoVals.range });
    else update({ rangeLocked: false });
  };
  const toggleAreaLock = () => {
    if (!areaLocked) update({ areaLocked: true, area: autoVals.area, lineWidth: autoVals.lineWidth });
    else update({ areaLocked: false });
  };

  const lockBtnStyle = (isLocked) => ({
    borderColor: isLocked ? "rgb(71 85 105)"        : "rgb(217 119 6 / 0.6)",
    color:       isLocked ? "rgb(100 116 139)"       : "rgb(251 191 36)",
    background:  isLocked ? "transparent"            : "rgb(120 53 15 / 0.2)",
  });

  const handleCondNameKey = (key) => {
    if (key === "outro") updateCond({ nameKey: "outro", name: "" });
    else updateCond({ nameKey: key, name: key });
  };

  const handleTierChange = (tier) => {
    const key = TIER_TO_CONDITIONS_KEY[tier];
    const validNames = key ? CONDITIONS[key] : [];
    const currentKey = form.condition?.nameKey ?? "";
    const nameStillValid = currentKey === "outro" || validNames.includes(currentKey);
    if (nameStillValid) {
      updateCond({ tier });
    } else {
      // Auto-preenche com a primeira condição válida do tier (grimório §7)
      const firstName = validNames[0] ?? "";
      updateCond({ tier, nameKey: firstName, name: firstName });
    }
  };

  const toggleLock = () => updateDamage({ damageIsLocked: !isLocked });

  // Per-field manual overrides (independent cadeados)
  const manualFields = form.damage?.manualFields ?? {};
  const isFieldManual = (name) => !!manualFields[name];
  const isFieldAuto   = (name) => !isFieldManual(name) && form.damage?.damageIsCalculated === true;
  const toggleFieldLock = (name) => {
    const next = { ...manualFields };
    if (next[name]) delete next[name]; else next[name] = true;
    const anyManual = Object.keys(next).length > 0;
    updateDamage({ manualFields: next, damageIsLocked: anyManual });
    // Ao retravar (auto) o Custo Base em PE de uma Ação Comum, força 0 (grimório §8: ataque não consome PE; só condições embutidas custam PE).
    if (name === 'cost' && !next[name] && getActionMode(form.type) === 'ataque') {
      update({ cost: 0 });
    }
  };


  return (
    <div className="space-y-3">
      {/* Nome + Tipo de execução */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel required>Nome da Ação</FieldLabel>
          <TextInput value={form.name} onChange={(v) => update({ name: v })} placeholder="Ex: Garra Lacerante" />
        </div>
        <div>
          <FieldLabel>Tipo de Execução</FieldLabel>
          <Select value={form.type} onChange={(v) => update({ type: v })} options={typeOptions ?? ACTION_TYPE_OPTIONS} />
        </div>
      </div>

      {/* === Painel de BUFF / PASSIVO (Grimório pg 52) === */}
      {!isInAttackMode && (
        <BuffOrPassivePanel form={form} bt={bt} nd={nd} update={update} />
      )}

      {isInAttackMode && (<>
      {/* Tipo de ataque + custo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        <div>
          <FieldLabel>Tipo de Ataque / Efeito</FieldLabel>
          <select
            value={form.attackType ?? ""}
            onChange={(e) => update({ attackType: e.target.value })}
            className="w-full h-9 bg-slate-950 border border-slate-700 rounded px-2 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 appearance-none"
          >
            {ATTACK_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}
                disabled={opt.value === "tr_area" && form.damage?.type === "alma"}>
                {opt.label}{opt.value === "tr_area" && form.damage?.type === "alma" ? " (incompatível com Alma)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel hint={isFieldAuto('cost') ? "auto (ataque comum = 0; condições somam por fora)" : "manual"}>
            Custo Base em PE
          </FieldLabel>
          <div className="flex gap-1">
            {isFieldAuto('cost') ? (
              <div className="flex-1 h-9 bg-slate-950/30 border border-slate-700/50 rounded px-2 text-sm text-slate-400 flex items-center select-none font-mono">
                0
              </div>

            ) : (
              <div className="flex-1">
                <NumberInput value={form.cost} onChange={(v) => update({ cost: v })} min={0} />
              </div>
            )}
            <button
              type="button"
              onClick={() => toggleFieldLock('cost')}
              title={isFieldAuto('cost') ? "Desbloquear para editar manualmente" : "Restaurar valor automático"}
              className="w-9 h-9 flex items-center justify-center rounded border transition-colors flex-shrink-0 focus:outline-none"
              style={lockBtnStyle(isFieldAuto('cost'))}
            >
              {isFieldAuto('cost') ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          </div>
          </div>
        </div>

      {/* Toggle: ação apenas-efeito (sem rolagem de dano) — válida para Acerto, TR Individual e TR em Área */}
      {form.attackType !== "suporte" && (
        <label className="flex items-center gap-2 text-xs text-slate-300 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={form.noDamage === true}
            onChange={(e) => update({ noDamage: e.target.checked })}
            className="w-4 h-4 accent-purple-600"
          />
          <span>
            <span className="font-semibold">Sem dano (apenas efeito)</span>
            <span className="text-slate-500 ml-1">— a ação resolve acerto/TR mas não rola dano; ideal para aplicar somente condição/área.</span>
          </span>
        </label>
      )}

      {/* TR ou Acerto — wrapper estável evita insertBefore ao trocar attackType */}
      <div>
        {isTR && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Tipo de TR</FieldLabel>
              <Select value={form.trType} onChange={(v) => update({ trType: v })} options={TR_TYPE_OPTIONS} />
            </div>
            <div>
              <FieldLabel hint={isFieldAuto('cd') ? "auto (tabela ND)" : "manual"}>
                CD{tradeCdDelta !== 0 && <span className="text-slate-500 font-normal ml-1 text-xs">(base)</span>}
              </FieldLabel>
              <div className="flex gap-1">
                {isFieldAuto('cd') ? (
                  <div className="flex-1 h-9 bg-slate-950/30 border border-slate-700/50 rounded px-2 text-sm text-slate-400 flex items-center select-none font-mono">
                    {cdBase}
                  </div>
                ) : (
                  <div className="flex-1">
                    <NumberInput value={cdBase} onChange={(v) => update({ cdBase: v })} min={0} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => toggleFieldLock('cd')}
                  title={isFieldAuto('cd') ? "Desbloquear para editar manualmente" : "Restaurar valor automático"}
                  className="w-9 h-9 flex items-center justify-center rounded border transition-colors flex-shrink-0 focus:outline-none"
                  style={lockBtnStyle(isFieldAuto('cd'))}
                >
                  {isFieldAuto('cd') ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
              </div>
              {tradeCdDelta !== 0 && (
                <div className="mt-1 text-xs text-slate-400">
                  Final: <span className="font-mono text-white font-semibold">{cdBase + tradeCdDelta}</span>
                  <span className="text-slate-500 ml-1">
                    ({tradeCdDelta > 0 ? "+" : ""}{tradeCdDelta} trades)
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        {isAcerto && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel hint={isFieldAuto('toHit') ? "auto (ND + Mod Técn)" : "manual"}>
                Bônus de Acerto{tradeToHitDelta !== 0 && <span className="text-slate-500 font-normal ml-1 text-xs">(base)</span>}
              </FieldLabel>
              <div className="flex gap-1">
                {isFieldAuto('toHit') ? (
                  <div className="flex-1 h-9 bg-slate-950/30 border border-slate-700/50 rounded px-2 text-sm text-slate-400 flex items-center select-none font-mono">
                    {toHitBase >= 0 ? `+${toHitBase}` : toHitBase}
                  </div>
                ) : (
                  <div className="flex-1">
                    <NumberInput value={toHitBase} onChange={(v) => update({ toHitBase: v })} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => toggleFieldLock('toHit')}
                  title={isFieldAuto('toHit') ? "Desbloquear para editar manualmente" : "Restaurar valor automático"}
                  className="w-9 h-9 flex items-center justify-center rounded border transition-colors flex-shrink-0 focus:outline-none"
                  style={lockBtnStyle(isFieldAuto('toHit'))}
                >
                  {isFieldAuto('toHit') ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
              </div>
              {tradeToHitDelta !== 0 && (
                <div className="mt-1 text-xs text-slate-400">
                  Final: <span className="font-mono text-white font-semibold">+{toHitBase + tradeToHitDelta}</span>
                  <span className="text-slate-500 ml-1">
                    ({tradeToHitDelta > 0 ? "+" : ""}{tradeToHitDelta} trades)
                  </span>
                </div>
              )}
            </div>
            <div />
          </div>
        )}
      </div>

      {/* Tipo de Alcance + Parâmetros do BT */}
      <div className="bg-slate-900/60 border border-slate-800 rounded p-3 space-y-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo de Alcance</div>
        <div className="flex gap-2">
          {[
            { value: "distancia", label: "À Distância" },
            { value: "cac",       label: "Corpo a Corpo" },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => updateRangeType(value)}
              className={`flex-1 py-1.5 px-3 rounded text-xs font-semibold transition-colors border focus:outline-none ${
                rangeType === value
                  ? "bg-purple-900/60 border-purple-700 text-purple-200"
                  : "bg-slate-950 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs font-mono">
          <span className="text-slate-500">
            Alcance Máx: <span className="text-slate-300">{params.range}m</span>
          </span>
          <span className="text-slate-500">
            Área Máx: <span className="text-slate-300">{baseAreaFor(bt, form.areaShape)}m{isLineShape(form.areaShape) ? " (×1,5 linha)" : ""}</span>
          </span>
          {rangeType === "cac" && (
            <span className="text-emerald-400 font-semibold">
              +{params.meleeBonusDice} dado{params.meleeBonusDice > 1 ? "s" : ""} CaC
            </span>
          )}
        </div>
      </div>

      {/* Alcance e Área */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <FieldLabel hint={rangeLocked ? "auto" : "livre"}>Alcance</FieldLabel>
          <div className="flex gap-1">
            {rangeLocked ? (
              <div className="flex-1 h-9 bg-slate-950/30 border border-slate-700/50 rounded px-2 text-sm text-slate-400 flex items-center select-none">
                {form.range || "-"}
              </div>
            ) : (
              <div className="flex-1">
                <TextInput value={form.range ?? ""} onChange={(v) => update({ range: v })} placeholder="Ex: Toque, Visão..." />
              </div>
            )}
            <button
              type="button"
              onClick={toggleRangeLock}
              title={rangeLocked ? "Desbloquear para editar manualmente" : "Restaurar valor automático"}
              className="w-9 h-9 flex items-center justify-center rounded border transition-colors flex-shrink-0 focus:outline-none"
              style={lockBtnStyle(rangeLocked)}
            >
              {rangeLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div>
          <FieldLabel hint={areaLocked ? "auto" : "livre"}>Área</FieldLabel>
          <div className="flex gap-1">
            {areaLocked ? (
              <div className="flex-1 h-9 bg-slate-950/30 border border-slate-700/50 rounded px-2 text-sm text-slate-400 flex items-center select-none">
                {form.area || "-"}
              </div>
            ) : (
              <div className="flex-1">
                <TextInput value={form.area ?? ""} onChange={(v) => update({ area: v })} placeholder="Ex: Cone, Esfera..." />
              </div>
            )}
            <button
              type="button"
              onClick={toggleAreaLock}
              title={areaLocked ? "Desbloquear para editar manualmente" : "Restaurar valor automático"}
              className="w-9 h-9 flex items-center justify-center rounded border transition-colors flex-shrink-0 focus:outline-none"
              style={lockBtnStyle(areaLocked)}
            >
              {areaLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
        </div>
      </div>

      {/* Forma da Área (visível só para TR em Área) */}
      {form.attackType === "tr_area" && (
        <div>
          <FieldLabel hint="formato do template no mapa">Forma da Área</FieldLabel>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
            {[
              { id: "circle", label: "Círculo" },
              { id: "square", label: "Quadrado" },
              { id: "cone",   label: "Cone" },
              { id: "cone_attached", label: "Cone Aderente" },
              { id: "line",   label: "Linha" },
              { id: "line_attached", label: "Linha Aderente" },
            ].map((opt) => {
              const active = (form.areaShape ?? "circle") === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    const av = calcAutoRange(form.attackType, rangeType, bt, form.areaRangeSteps, opt.id, 0);
                    update({
                      areaShape: opt.id,
                      lineWidthSteps: 0,
                      lineWidth: av.lineWidth,
                      ...(areaLocked ? { area: av.area } : {}),
                      ...(rangeLocked ? { range: av.range } : {}),
                    });
                  }}
                  title={opt.id === "cone_attached" ? "Cone com apex no conjurador, mirando na direção do cursor (grudado no personagem)" : opt.id === "line_attached" ? "Linha que parte do conjurador, mirando na direção do cursor (grudada no personagem)" : opt.label}
                  className={`h-9 rounded border text-xs font-medium transition-colors focus:outline-none ${
                    active
                      ? "border-purple-500 bg-purple-600/30 text-purple-100"
                      : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Reduzir área → aumentar alcance (regra do livro) */}
      {form.attackType === "tr_area" && rangeType !== "cac" && (() => {
        const maxSteps = maxAreaRangeSteps(bt, form.areaShape);
        const steps = Math.max(0, Math.min(maxSteps, Number(form.areaRangeSteps) || 0));
        const setSteps = (v) => {
          const n = Math.max(0, Math.min(maxSteps, v));
          const av = calcAutoRange(form.attackType, rangeType, bt, n, form.areaShape, form.lineWidthSteps);
          update({ areaRangeSteps: n, rangeLocked: true, areaLocked: true, range: av.range, area: av.area, lineWidth: av.lineWidth });
        };
        return (
          <div className="rounded border border-slate-800 bg-slate-950/40 p-2.5">
            <FieldLabel hint="−1,5m de área = +12m de alcance">Reduzir Área para Aumentar Alcance</FieldLabel>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSteps(steps - 1)} disabled={steps <= 0}
                className="w-8 h-8 rounded border border-slate-700 bg-slate-950 text-slate-200 disabled:opacity-40">−</button>
              <span className="min-w-[2ch] text-center font-mono text-sm text-white">{steps}</span>
              <button type="button" onClick={() => setSteps(steps + 1)} disabled={steps >= maxSteps}
                className="w-8 h-8 rounded border border-slate-700 bg-slate-950 text-slate-200 disabled:opacity-40">+</button>
              <span className="text-xs text-slate-400">
                {steps > 0
                  ? `Área −${String(steps * AREA_TRADE_STEP_M).replace(".", ",")}m · Alcance +${steps * RANGE_TRADE_STEP_M}m`
                  : maxSteps > 0 ? "Sem troca" : "Área já está no mínimo (1,5m)"}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Linha: aumentar largura reduzindo o comprimento (regra do livro) */}
      {form.attackType === "tr_area" && rangeType !== "cac" && isLineShape(form.areaShape) && (() => {
        const maxWSteps = maxLineWidthSteps(bt, form.areaShape, form.areaRangeSteps);
        const wSteps = Math.max(0, Math.min(maxWSteps, Number(form.lineWidthSteps) || 0));
        const setWSteps = (v) => {
          const n = Math.max(0, Math.min(maxWSteps, v));
          const av = calcAutoRange(form.attackType, rangeType, bt, form.areaRangeSteps, form.areaShape, n);
          update({ lineWidthSteps: n, rangeLocked: true, areaLocked: true, range: av.range, area: av.area, lineWidth: av.lineWidth });
        };
        const curWidth = LINE_BASE_WIDTH_M + wSteps * LINE_WIDTH_STEP_M;
        return (
          <div className="rounded border border-slate-800 bg-slate-950/40 p-2.5">
            <FieldLabel hint="−4,5m de comprimento = +1,5m de largura">Aumentar Largura da Linha</FieldLabel>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setWSteps(wSteps - 1)} disabled={wSteps <= 0}
                className="w-8 h-8 rounded border border-slate-700 bg-slate-950 text-slate-200 disabled:opacity-40">−</button>
              <span className="min-w-[2ch] text-center font-mono text-sm text-white">{wSteps}</span>
              <button type="button" onClick={() => setWSteps(wSteps + 1)} disabled={wSteps >= maxWSteps}
                className="w-8 h-8 rounded border border-slate-700 bg-slate-950 text-slate-200 disabled:opacity-40">+</button>
              <span className="text-xs text-slate-400">
                {wSteps > 0
                  ? `Largura ${String(curWidth).replace(".", ",")}m · Comprimento −${String(wSteps * LINE_LENGTH_COST_M).replace(".", ",")}m`
                  : maxWSteps > 0 ? `Largura 1,5m (padrão)` : "Comprimento insuficiente para alargar"}
              </span>
            </div>
          </div>
        );
      })()}
      </div>

      {/* Dano base */}
      {hasDamage && (
        <div className="bg-slate-900/60 border border-slate-800 rounded p-3 space-y-2">
          {/* Header com lock */}
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              Dano Base
              {isAutoCalc && (
                <span className="text-xs bg-purple-900/40 border border-purple-800 text-purple-300 px-1.5 py-0.5 rounded font-normal tracking-normal">
                  Auto
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={toggleLock}
              title={isLocked ? "Desbloquear (restaurar auto-cálculo)" : "Bloquear (manter valores manuais)"}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs border transition-colors focus:outline-none focus:ring-1 focus:ring-purple-500/40"
              style={{
                borderColor: isLocked ? "rgb(217 119 6 / 0.6)" : "rgb(71 85 105)",
                color:       isLocked ? "rgb(251 191 36)"       : "rgb(100 116 139)",
                background:  isLocked ? "rgb(120 53 15 / 0.2)"  : "transparent",
              }}
            >
              {isLocked
                ? <><Lock className="w-3 h-3" /> Manual</>
                : <><Unlock className="w-3 h-3" /> Auto</>
              }
            </button>
          </div>

          {/* Narrativa do ataque */}
          <div>
            <FieldLabel>Narrativa do Ataque</FieldLabel>
            <Select
              value={narrativeType}
              onChange={(v) => updateDamage({ narrativeType: v, isNarrativePhysical: v === "fisica" })}
              options={NARRATIVE_OPTIONS}
            />
          </div>

          {/* Campos de dado */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <FieldLabel>
                <span className="whitespace-nowrap">Nº Dados</span>
                {hasActiveTrades && <span className="text-slate-600 font-normal ml-1 text-xs">base</span>}
                {isFieldAuto('numDice') && <span className="text-slate-600 font-normal ml-1 text-xs">auto</span>}
              </FieldLabel>
              <div className="flex gap-1">
                {isFieldAuto('numDice') ? (
                  <div className="flex-1 h-9 bg-slate-950/30 border border-slate-700/50 rounded px-2 text-sm text-slate-400 flex items-center select-none font-mono">
                    {numDiceBase}
                  </div>
                ) : (
                  <div className="flex-1">
                    <NumberInput
                      value={numDiceBase}
                      onChange={(v) => updateDamage({ numDiceBase: v, damageIsLocked: true })}
                      min={0}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => toggleFieldLock('numDice')}
                  title={isFieldAuto('numDice') ? "Desbloquear para editar manualmente" : "Restaurar valor automático"}
                  className="w-9 h-9 flex items-center justify-center rounded border transition-colors flex-shrink-0 focus:outline-none"
                  style={lockBtnStyle(isFieldAuto('numDice'))}
                >
                  {isFieldAuto('numDice') ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <FieldLabel>
                <span className="whitespace-nowrap">Dado</span>
                {isFieldAuto('dieSize') && <span className="text-slate-600 font-normal ml-1 text-xs">auto</span>}
              </FieldLabel>
              <div className="flex gap-1">
                {isFieldAuto('dieSize') ? (
                  <div className="flex-1 h-9 bg-slate-950/30 border border-slate-700/50 rounded px-2 text-sm text-slate-400 flex items-center select-none font-mono">
                    d{dieSize}
                  </div>
                ) : (
                  <select
                    value={dieSize}
                    onChange={(e) => updateDamage({ dieSize: parseInt(e.target.value), damageIsLocked: true })}
                    className="flex-1 h-9 bg-slate-950 border border-slate-700 rounded px-2 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  >
                    {DIE_SIZES.map((d) => <option key={d} value={d}>d{d}</option>)}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => toggleFieldLock('dieSize')}
                  title={isFieldAuto('dieSize') ? "Desbloquear para editar manualmente" : "Restaurar valor automático"}
                  className="w-9 h-9 flex items-center justify-center rounded border transition-colors flex-shrink-0 focus:outline-none"
                  style={lockBtnStyle(isFieldAuto('dieSize'))}
                >
                  {isFieldAuto('dieSize') ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <FieldLabel>
                <span className="whitespace-nowrap">Fixo</span>
                {isFieldAuto('mod') && <span className="text-slate-600 font-normal ml-1 text-xs">auto</span>}
              </FieldLabel>
              <div className="flex gap-1">
                {isFieldAuto('mod') ? (
                  <div className="flex-1 h-9 bg-slate-950/30 border border-slate-700/50 rounded px-2 text-sm text-slate-400 flex items-center select-none font-mono">
                    {mod >= 0 ? `+${mod}` : mod}
                  </div>
                ) : (
                  <div className="flex-1">
                    <NumberInput
                      value={mod}
                      onChange={(v) => updateDamage({ mod: v, damageIsLocked: true })}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => toggleFieldLock('mod')}
                  title={isFieldAuto('mod') ? "Desbloquear para editar manualmente" : "Restaurar valor automático"}
                  className="w-9 h-9 flex items-center justify-center rounded border transition-colors flex-shrink-0 focus:outline-none"
                  style={lockBtnStyle(isFieldAuto('mod'))}
                >
                  {isFieldAuto('mod') ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <FieldLabel><span className="whitespace-nowrap">Tipo de Dano</span></FieldLabel>
              <select
                value={form.damage?.type ?? "cortante"}
                onChange={(e) => updateDamage({ type: e.target.value })}
                className="w-full h-9 bg-slate-950 border border-slate-700 rounded px-2 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              >
                {DAMAGE_TYPE_GROUPS.map(({ label, types }) => (
                  <optgroup key={label} label={label}>
                    {types.map((t) => (
                      <option key={t} value={t}
                        disabled={t === "alma" && form.attackType === "tr_area"}>
                        {DAMAGE_TYPE_LABELS[t]}{t === "alma" && form.attackType === "tr_area" ? " (incompatível com Área)" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {/* Preview da rolagem */}
          {(finalDice > 0 || mod !== 0) && (
            <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
              <span>
                Rolagem:{" "}
                <span className="font-mono text-white font-semibold">
                  {rollStr(finalDice, dieSize, mod)}
                </span>
              </span>
              <span className="text-slate-500">(méd. {rollAverage(finalDice, dieSize, mod)})</span>
            </div>
          )}

          {/* Conversão Equivalente — steppers contextuais por tipo de ofensiva */}
          {(isAcerto || isTR) && (
            <div className="border-t border-slate-700/50 pt-2.5 space-y-2.5">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                Conversão Equivalente
              </div>

              {isAcerto && (
                <>
                  <TradeRow
                    label="Dados → Acerto"
                    hint={`Cada dado sacrificado concede +2 Acerto (máx. ${capDadosAcerto})`}
                    value={trades.sacrifDadosAcerto}
                    onChange={(v) => updateTrade({ sacrifDadosAcerto: v })}
                    blocked={blockedDadosAcerto}
                    max={capDadosAcerto}
                  />
                  <TradeRow
                    label="Acerto → Dados"
                    hint={`Cada -2 Acerto concede +1 Dado (máx. ${capAcertoDados} Acerto)`}
                    value={trades.sacrifAcertoDados}
                    onChange={(v) => updateTrade({ sacrifAcertoDados: v })}
                    step={2}
                    blocked={blockedAcertoDados}
                    max={capAcertoDados}
                  />
                </>
              )}

              {isTR && (
                <>
                  <TradeRow
                    label="Dados → CD"
                    hint={`Cada dado sacrificado concede +1 CD (máx. ${capDadosCD})`}
                    value={trades.sacrifDadosCD}
                    onChange={(v) => updateTrade({ sacrifDadosCD: v })}
                    blocked={blockedDadosCD}
                    max={capDadosCD}
                  />
                  <TradeRow
                    label="CD → Dados"
                    hint={`Cada -1 CD concede +1 Dado (máx. ${capCdDados})`}
                    value={trades.sacrifCdDados}
                    onChange={(v) => updateTrade({ sacrifCdDados: v })}
                    blocked={blockedCdDados}
                    max={capCdDados}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Condição */}
      <div className="bg-slate-900/60 border border-slate-800 rounded p-3 space-y-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Condição (Opcional)</div>
        {isAcerto ? (
          <p className="text-xs text-slate-500 italic">
            Condições só podem ser aplicadas em Testes de Resistência.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <FieldLabel>Força da Condição</FieldLabel>
                <select
                  value={form.condition?.tier ?? "nenhuma"}
                  onChange={(e) => handleTierChange(e.target.value)}
                  className="w-full h-9 bg-slate-950 border border-slate-700 rounded px-2 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                >
                  {CONDITION_TIER_OPTIONS.map((opt) => {
                    const minBt = BT_MIN_FOR_TIER[opt.value];
                    const locked = minBt != null && bt < minBt;
                    return (
                      <option key={opt.value} value={opt.value} disabled={locked}>
                        {opt.label}{locked ? ` (BT +${minBt} mín.)` : ""}
                      </option>
                    );
                  })}
                </select>
                {form.condition?.tier && form.condition.tier !== "nenhuma" &&
                  (BT_MIN_FOR_TIER[form.condition.tier] ?? 0) > bt && (
                  <div className="mt-1 text-xs text-red-400">
                    BT insuficiente para esta condição (requer +{BT_MIN_FOR_TIER[form.condition.tier]}, atual +{bt})
                  </div>
                )}
              </div>
              {hasCond && (() => {
                const effectOnly = form.attackType === "suporte" || form.noDamage === true;
                return (
                  <div>
                    <FieldLabel>Método de Custo</FieldLabel>
                    <Select
                      value={effectOnly ? "pe" : (form.condition?.payment ?? "pe")}
                      onChange={(v) => { if (!effectOnly) updateCond({ payment: v }); }}
                      options={CONDITION_PAYMENT_OPTIONS}
                      disabled={effectOnly}
                    />
                    {effectOnly && (
                      <div className="mt-1 text-xs text-slate-500">
                        Modo apenas-efeito: custo travado em PE (sem dano para descontar via ND).
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>

            {hasCond && (() => {
              const tierKey = TIER_TO_CONDITIONS_KEY[form.condition?.tier ?? ""];
              const condNamesForTier = tierKey ? CONDITIONS[tierKey] : [];
              return (
                <div className="space-y-2">
                  <div>
                    <FieldLabel>Nome da Condição</FieldLabel>
                    <select
                      value={form.condition?.nameKey ?? ""}
                      onChange={(e) => handleCondNameKey(e.target.value)}
                      className="w-full h-9 bg-slate-950 border border-slate-700 rounded px-2 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="">— Selecione —</option>
                      {condNamesForTier.map((n) => (
                        <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>
                      ))}
                      <option value="outro">Outro / Customizado</option>
                    </select>
                  </div>
                  {form.condition?.nameKey === "outro" && (
                    <div>
                      <FieldLabel hint="campo livre">Nome Customizado</FieldLabel>
                      <TextInput
                        value={form.condition?.name ?? ""}
                        onChange={(v) => updateCond({ name: v })}
                        placeholder="Descreva a condição..."
                      />
                    </div>
                  )}
                </div>
              );
            })()}

            {hasCond && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <FieldLabel hint="teste para sofrer a condição">Teste para Aplicar</FieldLabel>
                  <Select
                    value={form.condition?.applyTrType ?? ""}
                    onChange={(v) => updateCond({ applyTrType: v })}
                    options={[{ value: "", label: `Mesmo do ataque (${TR_TYPE_LABELS[form.trType] ?? "TR"})` }, ...TR_TYPE_OPTIONS]}
                  />
                </div>
                <div>
                  <FieldLabel hint="teste para se livrar da condição">Teste para Retirar</FieldLabel>
                  <Select
                    value={form.condition?.removeTrType ?? ""}
                    onChange={(v) => updateCond({ removeTrType: v })}
                    options={[{ value: "", label: "Mesmo do teste para aplicar" }, ...TR_TYPE_OPTIONS]}
                  />
                </div>
              </div>
            )}

            {hasCond && (() => {
              const mode = form.condition?.durationMode ?? "ate_acabar";
              const turns = form.condition?.durationTurns ?? 1;
              const isAtePassar = mode === "ate_passar_tr";
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <FieldLabel hint="como a condição termina">Duração</FieldLabel>
                    <Select
                      value={mode}
                      onChange={(v) => updateCond({ durationMode: v })}
                      options={CONDITION_DURATION_MODE_OPTIONS}
                    />
                    {(mode === "tr_todo_round" || mode === "ate_passar_tr") && (
                      <div className="mt-1 text-xs text-slate-500">
                        TR usado: <span className="text-slate-300">{TR_TYPE_LABELS[condRemoveTr(form)] || "—"}</span> vs CD <span className="text-slate-300">{form.cd ?? 0}</span> (CD da própria ação).
                      </div>
                    )}
                  </div>
                  <div>
                    <FieldLabel hint={isAtePassar ? "ignorado neste modo" : "número de turnos"}>
                      Turnos
                    </FieldLabel>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={isAtePassar ? "" : turns}
                      disabled={isAtePassar}
                      onChange={(e) => {
                        const n = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1));
                        updateCond({ durationTurns: n });
                      }}
                      className={`w-full h-9 bg-slate-950 border border-slate-700 rounded px-2 text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 ${isAtePassar ? "opacity-50 cursor-not-allowed" : ""}`}
                      placeholder={isAtePassar ? "sem prazo" : "1"}
                    />
                  </div>
                </div>
              );
            })()}


          </>
        )}
      </div>
      </>)}

      {/* ===== Área Persistente (apenas TR em Área) ===== */}
      {form.attackType === "tr_area" && (() => {
        const pa = form.persistentArea ?? {};
        const res = pa.residual ?? {};
        const updatePA = (patch) =>
          update({ persistentArea: { ...pa, ...patch, residual: { ...res, ...(patch.residual ?? {}) } } });
        return (
          <div className="bg-slate-900/60 border border-slate-800 rounded p-3 space-y-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <input
                type="checkbox"
                checked={!!pa.enabled}
                onChange={(e) => updatePA({ enabled: e.target.checked })}
                className="accent-purple-500"
              />
              Área Persistente (dano/condição contínua na zona)
            </label>
            {pa.enabled && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <FieldLabel hint="quantos turnos a zona dura no mapa">Duração da área (turnos)</FieldLabel>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={pa.durationTurns ?? 3}
                      onChange={(e) => updatePA({ durationTurns: Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)) })}
                      className="w-full h-9 bg-slate-950 border border-slate-700 rounded px-2 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <FieldLabel hint="o que é re-aplicado">Efeito</FieldLabel>
                    <Select
                      value={pa.effectMode ?? "ambos"}
                      onChange={(v) => updatePA({ effectMode: v })}
                      options={[
                        { value: "dano",     label: "Apenas dano" },
                        { value: "condicao", label: "Apenas condição" },
                        { value: "ambos",    label: "Dano + condição" },
                      ]}
                    />
                  </div>
                  <div>
                    <FieldLabel hint="quando o TR é rolado">Teste de Resistência</FieldLabel>
                    <Select
                      value={pa.trMode ?? "todo_turno"}
                      onChange={(v) => updatePA({ trMode: v })}
                      options={[
                        { value: "uma_vez",     label: "1× ao entrar — imune se passar" },
                        { value: "todo_round",  label: "TR a cada rodada — imune se passar" },
                        { value: "todo_turno",  label: "TR todo turno — sucesso ignora tick" },
                      ]}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={pa.applyOnEnter !== false}
                      onChange={(e) => updatePA({ applyOnEnter: e.target.checked })}
                      className="accent-purple-500"
                    />
                    Aplica ao entrar
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={pa.applyOnTurn !== false}
                      onChange={(e) => updatePA({ applyOnTurn: e.target.checked })}
                      className="accent-purple-500"
                    />
                    Aplica no início do turno (dentro)
                  </label>
                </div>

                <div className="border-t border-slate-800 pt-2 space-y-2">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Efeito residual ao sair
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <FieldLabel hint="o que acontece quando o alvo deixa a área">Modo</FieldLabel>
                      <Select
                        value={res.mode ?? "nenhum"}
                        onChange={(v) => updatePA({ residual: { mode: v } })}
                        options={[
                          { value: "nenhum",         label: "Nenhum — cessa imediatamente" },
                          { value: "manter_turnos",  label: "Manter por X turnos após sair" },
                        ]}
                      />
                    </div>
                    {res.mode === "manter_turnos" && (
                      <div>
                        <FieldLabel>Turnos residuais</FieldLabel>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={res.turns ?? 1}
                          onChange={(e) => updatePA({ residual: { turns: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)) } })}
                          className="w-full h-9 bg-slate-950 border border-slate-700 rounded px-2 text-sm text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    )}
                  </div>
                  {res.mode === "manter_turnos" && (
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={!!res.keepDamage}
                          onChange={(e) => updatePA({ residual: { keepDamage: e.target.checked } })}
                          className="accent-purple-500"
                        />
                        Manter dano residual
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={res.keepCondition !== false}
                          onChange={(e) => updatePA({ residual: { keepCondition: e.target.checked } })}
                          className="accent-purple-500"
                        />
                        Manter condição residual
                      </label>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Flavor Text / Narração */}
      <div>

        <FieldLabel hint="flavor text — aparece antes do texto mecânico no preview">
          Texto Narrativo
        </FieldLabel>
        <TextArea
          value={form.description}
          onChange={(v) => update({ description: v })}
          rows={2}
          placeholder="Ex: Com um rugido, a besta desfere uma garra afiada..."
        />
      </div>

      <RulesReference attackType={form.attackType} actionType={form.type} bt={bt} conditionTier={form.condition?.tier} />
    </div>
  );
}

// ============================================================
// BUFF / PASSIVE PANEL — para Bônus / Reação / Rápida / Movimento / Livre
// ============================================================
function BuffOrPassivePanel({ form, bt, nd, update }) {
  const mode = getActionMode(form.type);
  const buff = form.buff ?? {};

  if (mode === "passivo") {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded p-3 space-y-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Info className="w-3 h-3" />
          {form.type === "movimento" ? "Movimento" : "Livre"}
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {form.type === "movimento"
            ? "Sem dano nem buff tabelado — apenas deslocamento (até o deslocamento total da criatura)."
            : "Sem dano nem buff tabelado — apenas timing (interagir, falar, gesticular, etc.)."}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel>Custo em PE (opcional)</FieldLabel>
            <NumberInput value={form.cost ?? 0} onChange={(v) => update({ cost: v })} min={0} />
          </div>
        </div>
      </div>
    );
  }

  const isSubstituto = mode === "substituto";
  const kindOptions = [
    { value: "ofensivo",   label: "Buff Ofensivo (próxima Ação Comum)" },
    { value: "defensivo",  label: "Buff Defensivo (próximo ataque/efeito recebido)" },
  ];
  const kind = isSubstituto
    ? (buff.kind ?? "ofensivo")
    : (mode === "buff_defensivo" ? "defensivo" : "ofensivo");
  const effectOptions = kind === "ofensivo" ? BONUS_EFFECT_OPTIONS : REACTION_EFFECT_OPTIONS;
  const table = kind === "ofensivo" ? getBonusBuff(bt, nd) : getReactionBuff(bt);

  const resolved   = resolveBuffValues(form.type, bt, nd, { ...buff, kind });
  const tableValue = resolved?.tableValue;
  const tableCost  = resolved?.tableCost;
  const usingCustomValue = buff.customValue != null;
  const usingCustomCost  = buff.customCost  != null;

  const trainingList = mode === "buff_defensivo" ? getTrainingReactions(bt) : [];

  const handleEffect = (newEffect) =>
    update({ buff: { effect: newEffect, customValue: null } });
  const handleKind = (newKind) => {
    const validEffects = newKind === "ofensivo" ? BONUS_EFFECT_OPTIONS : REACTION_EFFECT_OPTIONS;
    const defEffect = newKind === "ofensivo" ? "toHit" : "tr";
    const nextEffect = validEffects.some(o => o.value === buff.effect) ? buff.effect : defEffect;
    update({ buff: { kind: newKind, effect: nextEffect, customValue: null, customCost: null, training: null } });
  };
  const toggleCustomValue = () => {
    if (usingCustomValue) update({ buff: { customValue: null } });
    else update({ buff: { customValue: tableValue ?? 0 } });
  };
  const toggleCustomCost = () => {
    if (usingCustomCost) update({ buff: { customCost: null } });
    else update({ buff: { customCost: tableCost ?? 0 } });
  };

  if (!table) {
    return (
      <div className="bg-amber-950/30 border border-amber-900/50 rounded p-3 text-xs text-amber-300">
        BT +{bt} não tem tabela de {kind === "ofensivo" ? "Bônus Ofensiva" : "Reação Defensiva"} no Grimório.
        {kind === "ofensivo" && bt < 3 && " (Bônus ofensiva começa em BT +3.)"}
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded p-3 space-y-3">
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
        {kind === "ofensivo" ? <Zap className="w-3 h-3 text-amber-400" /> : <Shield className="w-3 h-3 text-sky-400" />}
        Buff de {kind === "ofensivo" ? "Bônus" : "Reação"} (BT +{bt}, tabela pg 52)
      </div>

      {isSubstituto && (
        <div>
          <FieldLabel hint="Ação Rápida pode substituir Bônus ou Reação">Tipo de Buff</FieldLabel>
          <Select value={kind} onChange={handleKind} options={kindOptions} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel>Efeito Concedido</FieldLabel>
          <Select value={buff.effect ?? effectOptions[0].value} onChange={handleEffect} options={effectOptions} />
        </div>
        <div>
          <FieldLabel hint={usingCustomValue ? "manual" : "tabela"}>Valor do Buff</FieldLabel>
          <div className="flex gap-1">
            {!usingCustomValue ? (
              <div className="flex-1 h-9 bg-slate-950/30 border border-slate-700/50 rounded px-2 text-sm text-slate-400 flex items-center font-mono">
                {tableValue == null ? "—" : (typeof tableValue === "number" && ["range","area"].includes(buff.effect) ? `${tableValue} m` : (typeof tableValue === "number" ? (tableValue >= 0 ? `+${tableValue}` : tableValue) : tableValue))}
              </div>
            ) : (
              <div className="flex-1">
                <NumberInput value={buff.customValue ?? 0} onChange={(v) => update({ buff: { customValue: v } })} />
              </div>
            )}
            <button
              type="button"
              onClick={toggleCustomValue}
              title={usingCustomValue ? "Restaurar valor da tabela" : "Editar manualmente"}
              className="w-9 h-9 flex items-center justify-center rounded border focus:outline-none"
              style={{
                borderColor: !usingCustomValue ? "rgb(71 85 105)" : "rgb(217 119 6 / 0.6)",
                color:       !usingCustomValue ? "rgb(100 116 139)" : "rgb(251 191 36)",
                background:  !usingCustomValue ? "transparent"      : "rgb(120 53 15 / 0.2)",
              }}
            >
              {!usingCustomValue ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel hint={isSubstituto ? "Ação Rápida = 0 PE" : (usingCustomCost ? "manual" : "tabela")}>Custo em PE</FieldLabel>
          <div className="flex gap-1">
            {(isSubstituto || !usingCustomCost) ? (
              <div className="flex-1 h-9 bg-slate-950/30 border border-slate-700/50 rounded px-2 text-sm text-slate-400 flex items-center font-mono">
                {isSubstituto ? 0 : tableCost ?? 0}
              </div>
            ) : (
              <div className="flex-1">
                <NumberInput value={buff.customCost ?? 0} onChange={(v) => update({ buff: { customCost: v } })} min={0} />
              </div>
            )}
            {!isSubstituto && (
              <button
                type="button"
                onClick={toggleCustomCost}
                title={usingCustomCost ? "Restaurar valor da tabela" : "Editar manualmente"}
                className="w-9 h-9 flex items-center justify-center rounded border focus:outline-none"
                style={{
                  borderColor: !usingCustomCost ? "rgb(71 85 105)" : "rgb(217 119 6 / 0.6)",
                  color:       !usingCustomCost ? "rgb(100 116 139)" : "rgb(251 191 36)",
                  background:  !usingCustomCost ? "transparent"      : "rgb(120 53 15 / 0.2)",
                }}
              >
                {!usingCustomCost ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
        <div>
          <FieldLabel>Duração</FieldLabel>
          <div className="flex-1 h-9 bg-slate-950/30 border border-slate-700/50 rounded px-2 text-xs text-slate-400 flex items-center">
            {BUFF_DURATION_LABEL[form.type] ?? "—"}
          </div>
        </div>
      </div>

      {mode === "buff_defensivo" && trainingList.length > 0 && (
        <div className="border-t border-slate-700/50 pt-2 space-y-1.5">
          <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">
            Reações por Treinamento (atalhos — custo PE = BT)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {trainingList.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  update({
                    name: form.name?.trim() ? form.name : r.name,
                    buff: {
                      training: r.id,
                      trainingDescription: r.description,
                      customCost: r.cost,
                      kind: "defensivo",
                      effect: buff.effect ?? "tr",
                    },
                    description: form.description?.trim() ? form.description : r.description,
                  });
                }}
                className={`px-2 py-1 rounded text-xs border transition-colors ${
                  buff.training === r.id
                    ? "border-sky-500 bg-sky-900/40 text-sky-200"
                    : "border-slate-700 bg-slate-950 text-slate-300 hover:border-sky-700 hover:text-sky-200"
                }`}
                title={r.description}
              >
                BT+{r.btUnlock}: {r.name} ({r.cost} PE)
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-slate-700/50 pt-2 text-xs text-slate-500 leading-relaxed font-mono">
        <span className="text-slate-400 font-semibold">Tabela BT +{bt}:</span>{" "}
        {Object.entries(table).filter(([k]) => k !== "cost").map(([k, v]) => {
          const lbl = (kind === "ofensivo" ? BONUS_EFFECT_LABELS : REACTION_EFFECT_LABELS)[k] || k;
          const vfmt = typeof v === "number" && ["range","area"].includes(k) ? `${v} m` : v;
          return <span key={k} className="mr-2">{lbl}: <span className="text-slate-300">{vfmt}</span></span>;
        })}
        <span className="ml-1 text-slate-300">| Custo: {table.cost} PE</span>
      </div>
    </div>
  );
}


// ============================================================
// REFERÊNCIA DE REGRAS
// ============================================================
function RulesReference({ attackType, actionType, bt, conditionTier }) {
  const tips = [];
  const mode = getActionMode(actionType);

  if (mode === "buff_ofensivo") tips.push("Ação Bônus: concede buff tabelado por BT à próxima Ação Comum, durando 1 rodada (pg 52).");
  else if (mode === "buff_defensivo") tips.push("Reação: concede buff defensivo por BT contra o próximo ataque/efeito recebido, durando 1 turno (pg 52).");
  else if (mode === "substituto") tips.push("Ação Rápida: substitui Bônus ou Reação sem custo de PE (pg 52).");
  else if (mode === "passivo") tips.push("Movimento/Livre: sem dano nem buff tabelado — apenas timing ou deslocamento.");

  if (attackType === "tr_individual")
    tips.push("TR Individual: O dano base é equivalente a 1 ND inferior ao Acerto. Falha = Dano completo calculado. Sucesso = Metade do dano.");
  else if (attackType === "tr_area")
    tips.push("TR em Área: falha = dano completo, sucesso = metade do dano.");


  if (conditionTier && conditionTier !== "nenhuma") {
    const pe = CONDITION_PE_COST[conditionTier];
    const nd = CONDITION_ND_COST[conditionTier];
    tips.push(
      `Condição ${CONDITION_TIER_LABELS[conditionTier]}: pagar ${pe} PE ou reduzir ${nd} ND do dano.`
    );
  }

  if (!tips.length) return null;

  return (
    <div className="bg-blue-950/30 border border-blue-900/40 rounded p-2.5 space-y-1">
      {tips.map((tip, i) => (
        <div key={i} className="flex items-start gap-2 text-xs text-blue-300">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-blue-400" />
          {tip}
        </div>
      ))}
    </div>
  );
}
