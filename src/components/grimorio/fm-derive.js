import {
  getBonusTreinamento, getModifier, calculateHP, calculatePE,
  calculateDefesa, calculateAcerto, calculateCD, calculateTR,
  calculatePericiaComum, calculatePericiaDominada,
  calculateGuardaInabavel, calculateResistenciaParcial,
  calculateResistenciaTotal, calculateActions,
  RD_GERAL, RD_IRREDUTIVEL, IGNORAR_RD, VIDA_TEMP_ATAQUE,
  TAMANHO_INFO, getDeslocamentoMultiplier,
  getAttributePoints, ATTRIBUTE_LIMIT, PATAMAR_ND_RANGE,
} from "./fm-tables";

/**
 * ============================================================
 * fm-derive.js — Camada de derivação (v2)
 * ============================================================
 * Novidade: derivação de skills incluída.
 * Mantém-se função PURA: sem efeitos colaterais.
 * ============================================================
 */

const SAVE_ATTRS = {
  astucia: "inteligencia",
  fortitude: "constituicao",
  reflexos: "destreza",
  vontade: "sabedoria",
  integridade: "constituicao",
};

const getHighestMentalMod = (attrs) => {
  const mentals = [attrs.inteligencia, attrs.sabedoria, attrs.presenca];
  return getModifier(Math.max(...mentals));
};

const lookup = (table, patamar, nd) => table?.[patamar]?.[nd] ?? 0;

export function deriveStats(raw) {
  const { core, attributes, overrides = {}, skills = [], attackAttr = 'forca', cdAttr = null } = raw;
  const { patamar, difficulty = "iniciante", size = "medio" } = core;

  // Bug #6 fix: ND fora do range do patamar zera lookups e desencadeia
  // valores incoerentes (HP=0, RD=0, etc.). Clampa ANTES de derivar e
  // re-aplica em todos os cálculos para que a ficha permaneça consistente.
  const ndRaw = core.nd;
  const range = PATAMAR_ND_RANGE[patamar] ?? { min: 1, max: 20 };
  const nd = Math.min(Math.max(ndRaw, range.min), range.max);
  const ndClamped = nd !== ndRaw;

  const bt = getBonusTreinamento(nd);
  const mods = {
    forca: getModifier(attributes.forca),
    destreza: getModifier(attributes.destreza),
    constituicao: getModifier(attributes.constituicao),
    inteligencia: getModifier(attributes.inteligencia),
    sabedoria: getModifier(attributes.sabedoria),
    presenca: getModifier(attributes.presenca),
  };
  const modTecnica = getHighestMentalMod(attributes);

  const sizeInfo = TAMANHO_INFO[size] || TAMANHO_INFO.medio;
  const deslocMultiplier = getDeslocamentoMultiplier(nd, patamar);
  const deslocamentoCalc = sizeInfo.deslocamento * deslocMultiplier;

  // Bug #36/#37 fix: warn quando cdAttr/attackAttr inválido cai em fallback
  let cdModAttr;
  if (cdAttr) {
    if (cdAttr in mods) cdModAttr = mods[cdAttr];
    else {
      console.warn(`[fm-derive] cdAttr inválido "${cdAttr}", usando modTecnica como fallback`);
      cdModAttr = modTecnica;
    }
  } else {
    cdModAttr = modTecnica;
  }
  let attackMod;
  if (attackAttr in mods) attackMod = mods[attackAttr];
  else {
    console.warn(`[fm-derive] attackAttr inválido "${attackAttr}", usando força como fallback`);
    attackMod = mods.forca;
  }
  const cdBaseCalc = calculateCD(nd, cdModAttr, difficulty, patamar);
  const acertoCalc = calculateAcerto(patamar, nd, attackMod, difficulty);

  const calculated = {
    hpMax: calculateHP(patamar, nd, attributes.constituicao),
    peMax: calculatePE(patamar, nd),
    defesa: calculateDefesa(patamar, nd, mods.destreza, difficulty),
    atencao: calcAtencao(patamar, nd, attributes.sabedoria),
    iniciativa: calcIniciativa(patamar, nd, mods.destreza),
    deslocamento: deslocamentoCalc,
    espaco: sizeInfo.espaco,
    guardaInabavalMax: calculateGuardaInabavel(patamar, nd),
    rdGeral: lookup(RD_GERAL, patamar, nd),
    rdIrredutivel: lookup(RD_IRREDUTIVEL, patamar, nd),
    ignorarRd: lookup(IGNORAR_RD, patamar, nd),
    vidaTempPorAtaque: lookup(VIDA_TEMP_ATAQUE, patamar, nd),
    resistenciaParcialMax: calculateResistenciaParcial(patamar, nd),
    resistenciaTotalMax: calculateResistenciaTotal(patamar, nd),
    cdBase: cdBaseCalc,
    acerto: acertoCalc,
  };

  const saves = {};
  for (const [saveName, attrKey] of Object.entries(SAVE_ATTRS)) {
    saves[saveName] = calculateTR(nd, mods[attrKey], difficulty, patamar);
  }

  const actionsTotal = calculateActions(patamar, nd);

  const attrBudget = {
    total: getAttributePoints(patamar, nd, bt),
    // Bug #45 fix: clamp v-10 a >=0 — atributos < 10 não devem inflar "remaining"
    spent: Object.values(attributes).reduce((sum, v) => sum + Math.max(0, v - 10), 0),
    limit: ATTRIBUTE_LIMIT[patamar] ?? 26,
  };
  attrBudget.remaining = attrBudget.total - attrBudget.spent;

  // ---------- Aplicação de overrides em stats/saves ----------
  const finalStats = {};
  for (const [key, calcValue] of Object.entries(calculated)) {
    const overrideValue = overrides.stats?.[key];
    finalStats[key] = overrideValue != null ? overrideValue : calcValue;
  }

  const finalSaves = {};
  for (const [key, calcValue] of Object.entries(saves)) {
    const overrideValue = overrides.saves?.[key];
    finalSaves[key] = overrideValue != null ? overrideValue : calcValue;
  }

  // ---------- NOVO: Derivação de perícias ----------
  // Para cada skill, calcula o mod base e resolve override.
  // Retorno indexado por id para consulta rápida.
  const skillDerivations = {};
  for (const sk of skills) {
    const attrMod = mods[sk.attribute] ?? 0;
    const calcMod = sk.mastered
      ? calculatePericiaDominada(nd, attrMod, patamar)
      : calculatePericiaComum(nd, attrMod, patamar);
    const finalMod = sk.overrideMod != null ? sk.overrideMod : calcMod;
    skillDerivations[sk.id] = {
      attrMod,
      calculatedMod: calcMod,
      finalMod,
      isOverridden: sk.overrideMod != null,
    };
  }

  return {
    bt,
    mods,
    modTecnica,
    calculated,
    stats: finalStats,
    saves: finalSaves,
    cdBase: finalStats.cdBase,
    acertoPrincipal: finalStats.acerto,
    actionsTotal,
    attrBudget,
    // Bug #6 fix: expõe ND efetivo + flag para a UI avisar quando clampou
    ndEffective: nd,
    ndClamped,
    pericias: {
      comum:    (attrMod) => calculatePericiaComum(nd, attrMod, patamar),
      dominada: (attrMod) => calculatePericiaDominada(nd, attrMod, patamar),
    },
    skillDerivations,
  };
}

function calcAtencao(patamar, nd, sabedoria) {
  const modSab = getModifier(sabedoria);
  const bonusPericia = calculatePericiaComum(nd, modSab, patamar);
  const table = {
    // Bug #4 fix: Lacaio = Percepção (Sabedoria) + 5 (livro F&M 2.5 §3)
    lacaio: () => bonusPericia + 5,
    capanga: () => bonusPericia + 5,
    comum: () => bonusPericia + 10,
    desafio: () => bonusPericia + 15,
    calamidade: () => bonusPericia + (nd >= 20 ? 20 : 15),
  };
  return table[patamar]?.() ?? 10;
}

// Iniciativa Calamidade tem cap em "20 + metade do Mod" (PDF p.45).
function calcIniciativa(patamar, nd, modDex) {
  const halfDex = Math.floor(modDex / 2);
  const table = {
    lacaio:     () => modDex,
    capanga:    () => nd + halfDex,
    comum:      () => nd + halfDex,
    desafio:    () => nd + halfDex,
    calamidade: () => Math.min(20, nd) + halfDex,
  };
  return table[patamar]?.() ?? modDex;
}

export function validateDraft(raw, derived) {
  const warnings = [];
  const { attrBudget } = derived;

  // Bug #6 fix: aviso explícito quando ND foi clampado para o range do patamar
  if (derived.ndClamped) {
    warnings.push({
      field: "core.nd",
      severity: "warn",
      message: `ND ${raw.core?.nd} fora do range do patamar — usando ${derived.ndEffective} para todos os cálculos`,
    });
  }


  if (attrBudget.remaining < 0) {
    warnings.push({
      field: "attributes",
      severity: "error",
      message: `Você distribuiu ${Math.abs(attrBudget.remaining)} pontos além do permitido`,
    });
  }

  if (attrBudget.remaining > 0) {
    warnings.push({
      field: "attributes",
      severity: "warn",
      message: `${attrBudget.remaining} pontos de atributo não distribuídos`,
    });
  }

  for (const [attr, value] of Object.entries(raw.attributes)) {
    if (value > attrBudget.limit) {
      warnings.push({
        field: `attributes.${attr}`,
        severity: "error",
        message: `${attr} (${value}) acima do limite do patamar (${attrBudget.limit})`,
      });
    }
    // Bug #38 fix: flagar atributos abaixo do mínimo (hydrate de JSON corrompido)
    if (value < 8) {
      warnings.push({
        field: `attributes.${attr}`,
        severity: "warn",
        message: `${attr} (${value}) abaixo do mínimo recomendado (8)`,
      });
    }
  }

  if (!raw.name || raw.name.trim().length === 0) {
    warnings.push({ field: "name", severity: "error", message: "Nome é obrigatório" });
  }

  // Aviso leve sobre skills sem nome
  const unnamedSkills = (raw.skills || []).filter((s) => !s.name?.trim()).length;
  if (unnamedSkills > 0) {
    warnings.push({
      field: "skills",
      severity: "warn",
      message: `${unnamedSkills} perícia(s) sem nome`,
    });
  }

  return warnings;
}
