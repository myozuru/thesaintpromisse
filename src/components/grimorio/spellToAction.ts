import type { Spell } from "@/types";

const DAMAGE_TYPE_MAP: Record<string, string> = {
  DCO: "cortante", DP: "perfurante", DI: "impacto",
  DA: "ácido", DCG: "congelante", DCC: "chocante", DQ: "queimante", DS: "sônico",
  DAL: "alma", DNR: "energia reversa", DE: "energético", DPS: "psíquico", DR: "radiante",
  DN: "necrótico", DV: "venenoso",
};

const SAVE_ATTR_TO_TR: Record<string, string> = {
  FOR: "fortitude", CON: "fortitude", DES: "reflexos",
  INT: "astucia", SAB: "vontade", PRE: "vontade",
  fortitude: "fortitude", reflexos: "reflexos", vontade: "vontade",
  astucia: "astucia", integridade: "integridade",
  Fortitude: "fortitude", Reflexos: "reflexos", Vontade: "vontade",
  "Astúcia": "astucia", Astucia: "astucia", Integridade: "integridade",
};

const ACTION_TYPE_MAP: Record<string, string> = {
  action: "comum", bonus: "bonus", reaction: "reacao", full: "comum",
  rapida: "rapida", movimento: "movimento", free: "livre",
};

function parseDice(roll: string): { numDice: number; dieSize: number; mod: number; ok: boolean } {
  // Bug #23 fix: distingue "string vazia / inválida" de "parse OK" via flag `ok`
  if (!roll) return { numDice: 0, dieSize: 0, mod: 0, ok: false };
  const m = String(roll).match(/(\d+)d(\d+)\s*([+-]\s*\d+)?/i);
  if (!m) return { numDice: 0, dieSize: 0, mod: 0, ok: false };
  return {
    numDice: parseInt(m[1], 10) || 0,
    dieSize: parseInt(m[2], 10) || 0,
    mod: m[3] ? parseInt(m[3].replace(/\s+/g, ""), 10) || 0 : 0,
    ok: true,
  };
}

export function spellToAction(spell: Spell): any {
  const baseAttackType =
    spell.targetMode === "single_tr" ? "tr_individual"
    : spell.targetMode === "area_tr" ? "tr_area"
    : spell.targetMode === "single_atk" ? "acerto"
    : "acerto";

  const hasDamage = !!spell.damageDice && spell.spellType !== "heal" && spell.spellType !== "buff";
  const isHealing = spell.spellType === "heal";
  const isBuff    = spell.spellType === "buff";
  // Round-trip: feitiço sem dano preserva o targetMode original (incluindo área)
  // e ativa a flag noDamage; para single_atk continua usando "suporte" (legado).
  const isEffectOnly = !hasDamage && (isHealing || isBuff);
  const attackType = isEffectOnly && spell.targetMode === "single_atk"
    ? "suporte"
    : baseAttackType;
  const noDamage = isEffectOnly && spell.targetMode !== "single_atk";

  const dice = parseDice(spell.damageDice);
  const dmgMod = (dice.mod || 0) + (spell.damageBonus || 0);
  const dmgType = (spell.damageType && DAMAGE_TYPE_MAP[spell.damageType]) || "cortante";

  const trType = SAVE_ATTR_TO_TR[String(spell.saveAttr || "DES")] || "reflexos";

  // Bug #24 fix: cura virava "suporte" e perdia o payload do dado de cura.
  // Preserva `healing` (dados + mod) para a UI poder rolar a cura mesmo
  // quando attackType=suporte. Para buffs sem dado, healing fica null.
  const healing = isHealing && dice.ok ? {
    numDice: dice.numDice,
    dieSize: dice.dieSize || 8,
    mod: dmgMod,
    roll: `${dice.numDice}d${dice.dieSize || 8}${dmgMod ? (dmgMod > 0 ? `+${dmgMod}` : `${dmgMod}`) : ""}`,
  } : null;

  return {
    name: spell.name || "Feitiço",
    type: ACTION_TYPE_MAP[spell.actionType] || "comum",
    attackType,
    noDamage,
    cost: spell.costPE || 0,
    toHit: 0,
    toHitBase: 0,
    cd: spell.bonusDC || 0,
    cdBase: spell.bonusDC || 0,
    trType,
    range: spell.range || "",
    area: "",
    rangeLocked: false,
    areaLocked: false,
    description: spell.description || "",
    damage: hasDamage && dice.ok ? {
      numDice: dice.numDice,
      numDiceBase: dice.numDice,
      dieSize: dice.dieSize || 8,
      mod: dmgMod,
      type: dmgType,
      narrativeType: "padrao",
      isNarrativePhysical: false,
      damageIsLocked: true,
      damageIsCalculated: false,
    } : {
      // Bug #23 fix: sem parse válido, dieSize fica 0 (não força d8 fantasma)
      numDice: 0, numDiceBase: 0, dieSize: 0, mod: 0,
      type: dmgType, narrativeType: "padrao",
      isNarrativePhysical: false, damageIsLocked: true, damageIsCalculated: false,
    },
    // Bug #24 fix: marcadores explícitos para UI/relatório distinguir tipo de feitiço
    isHealing,
    isBuff,
    healing,
    condition: { tier: "nenhuma", payment: "pe", nameKey: "", name: "", durationMode: "ate_acabar", durationTurns: 1 },
    trades: {},
    persistentArea: spell.persistentArea ?? {
      enabled: false,
      durationTurns: 3,
      effectMode: "ambos",
      applyOnEnter: true,
      applyOnTurn: true,
      trMode: "todo_turno",
      residual: { mode: "nenhum", turns: 1, keepDamage: false, keepCondition: true },
    },
    _fromSpellAssistant: true,
  };
}
