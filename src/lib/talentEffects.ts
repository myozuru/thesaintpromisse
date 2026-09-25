/**
 * Agregador de efeitos passivos numéricos vindos de Talentos.
 *
 * Filosofia:
 *   - Os campos "base" do Character (hpMax, peMax, initiativeBonus, etc.) NÃO
 *     são mutados. O bônus é calculado a partir dos talentos comprados e
 *     SOMADO na renderização (mesmo padrão do `passiveBonuses` / `itemBonuses`).
 *   - Adicionar/remover talento = recomputa = bônus aparece/some sem dano.
 *   - Cada bônus carrega `breakdown[]` com origem, para tooltip ⚙.
 */
import type { Character } from '@/types';
import { GENERAL_TALENTS, ORIGIN_TALENTS, type Talent } from './talents';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';

/**
 * Efeitos passivos numéricos suportados pela automação universal.
 * `perLevel`: multiplicado por `character.level` (ex.: Vitalidade Resistente).
 * `flat`: valor fixo.
 * `attrCap`: incremento ao cap do atributo escolhido pelo jogador (lê de `choices.attr`).
 */
export interface TalentPassiveEffects {
  hpMaxFlat?: number;
  hpMaxPerLevel?: number;
  peMaxFlat?: number;
  peMaxPerLevel?: number;
  initiative?: number;
  attention?: number;
  /** Acrescenta ao limite de Ataques de Oportunidade por rodada. */
  opportunityMaxFlat?: number;
  /** Vantagem em AdO (tag legível para tooltip). */
  opportunityAdvantage?: boolean;
  /** Aumenta RD geral. */
  rdFlat?: number;
  /** Bônus a iniciativa permite rerolagem se não foi 1º. */
  initiativeRerollIfNotFirst?: boolean;
  /** Atributo-cap +N no(s) atributo(s) escolhido(s) em `choices.attr`. */
  attrCapBoost?: number;
  /** Incremento direto no valor do atributo escolhido em `choices.attr`. */
  attrValueBoost?: number;
  /** Pool máximo de Sorte (Favorecido pela Sorte). */
  luckMax?: number;
  /** Imunidade narrativa a uma condição (ex.: "Surpreso"). */
  immuneCondition?: string;
  /** Bônus flat em TR de Fortitude (Robustez Aprimorada). */
  fortitudeBonus?: number;
  /** RD contra Dano de Alma proporcional a floor(level / N). Ex.: Alma Inquebrável → N=4. */
  soulRdLevelDivisor?: number;
  /** Marca o personagem como Treinado em uma perícia adicional (pelo talento). */
  grantsTrainedSkill?: string;
  /** Bônus de deslocamento em metros (Físico Aperfeiçoado opção A). */
  movementBonusMeters?: number;
  /**
   * Aplica o mesmo bônus do attrValueBoost/attrCapBoost a UM SEGUNDO atributo
   * armazenado em `choices.attr2`. Usado por Quebra de Limites (2 atributos distintos).
   */
  appliesToSecondAttr?: boolean;
  /** Bônus extra à cura do FAH "Vigor Maldito" (Reposição Sanguínea). */
  vigorMalditoHealBonus?: number;
  /** Adepto de Medicina: desbloqueia 2º efeito de Suporte em Combate + cura usa nível. */
  unlocksSuporteLv2?: boolean;
  /** Mestre Defensivo: já proficiente em escudos (boost de RD). */
  shieldProficient?: boolean;
  /** Empunhadura Dupla: +1 Defesa quando 2 armas equipadas. */
  dualWieldDefenseBonus?: number;
  /** Técnicas de Ocultamento: alvo Desprevenido sofre debuff em todos TRs (não só Reflexos). */
  desprevenidoAffectsAllSaves?: boolean;
  /** Guarda Infalível: falha crítica em ataque NÃO provoca reação inimiga + bônus em TR vs debuff de Defesa. */
  noEnemyReactionOnCritFail?: boolean;
  saveBonusVsDefenseDebuff?: number;
  /**
   * Resiliência Melhorada: chave = nome do TR (Fortitude/Reflexos/...), valor =
   * 'trained' ou 'mastery' indica nível mínimo concedido. Atributo base também
   * recebe +1 (rastreado em saveAttrBoost).
   */
  saveProficiency?: { saveName: string; tier: 'trained' | 'mastery' };
  saveAttrBoost?: { saveName: string; value: number };
  /** Mestre das Armas: -1 na margem crítica para o grupo de armas escolhido. */
  weaponCriticalGroup?: string;
}

export interface TalentBonusBreakdownItem {
  talentId: string;
  talentName: string;
  field: string;
  value: number | string;
}

export interface AggregatedTalentBonuses {
  hp: number;
  pe: number;
  initiative: number;
  attention: number;
  opportunity: number;
  rd: number;
  luckMax: number;
  /** Bônus em TR de Fortitude (Robustez Aprimorada, etc.). */
  fortitude: number;
  /** RD calculada contra Dano de Alma (Alma Inquebrável). */
  soulRd: number;
  /** Bônus de movimento em metros (Físico Aperfeiçoado A). */
  movementMeters: number;
  /** Bônus à cura do Vigor Maldito FAH (Reposição Sanguínea). */
  vigorMalditoHealBonus: number;
  /** Mapa atributoNome → +N no cap. */
  attrCapBoost: Record<string, number>;
  /** Mapa atributoNome → +N no valor (Incremento de Atributo, Quebra de Limites). */
  attrValueBoost: Record<string, number>;
  /** Perícias automaticamente Treinadas pelos talentos (nomes). */
  grantedTrainedSkills: string[];
  /** Adepto de Medicina: 2º efeito de Suporte em Combate desbloqueado. */
  suporteLv2Unlocked: boolean;
  /** Mestre Defensivo: já proficiente em escudos (boost RD). */
  shieldProficient: boolean;
  /** Empunhadura Dupla: bônus de Defesa quando 2 armas ativas. */
  dualWieldDefenseBonus: number;
  /** Técnicas de Ocultamento: alvo Desprevenido sofre debuff em todos TRs. */
  desprevenidoAffectsAllSaves: boolean;
  /** Guarda Infalível: falha crítica não provoca reação inimiga. */
  noEnemyReactionOnCritFail: boolean;
  /** Guarda Infalível: bônus em TR contra debuffs de Defesa. */
  saveBonusVsDefenseDebuff: number;
  /** Resiliência Melhorada: TR específico → tier ('trained'/'mastery'). */
  saveProficiencyByName: Record<string, 'trained' | 'mastery'>;
  /** Resiliência Melhorada: +N no atributo do TR escolhido. */
  saveAttrBoost: Record<string, number>;
  /** Mestre das Armas: grupo de arma com crítico aprimorado (-1 critRange). */
  weaponCriticalGroups: string[];
  immunities: string[];
  notes: string[];
  breakdown: TalentBonusBreakdownItem[];
}

const ALL_TALENTS: Talent[] = [...GENERAL_TALENTS, ...ORIGIN_TALENTS];

function findTalent(id: string): Talent | undefined {
  return ALL_TALENTS.find(t => t.id === id);
}

export function aggregateTalentBonuses(c: Character): AggregatedTalentBonuses {
  const out: AggregatedTalentBonuses = {
    hp: 0, pe: 0, initiative: 0, attention: 0, opportunity: 0, rd: 0,
    luckMax: 0, fortitude: 0, soulRd: 0,
    movementMeters: 0, vigorMalditoHealBonus: 0,
    attrCapBoost: {}, attrValueBoost: {},
    grantedTrainedSkills: [],
    suporteLv2Unlocked: false,
    shieldProficient: false,
    dualWieldDefenseBonus: 0,
    desprevenidoAffectsAllSaves: false,
    noEnemyReactionOnCritFail: false,
    saveBonusVsDefenseDebuff: 0,
    saveProficiencyByName: {},
    saveAttrBoost: {},
    weaponCriticalGroups: [],
    immunities: [], notes: [], breakdown: [],
  };
  const chosen = c.chosenTalents ?? [];
  if (chosen.length === 0) return out;

  const level = Math.max(1, c.level ?? 1);

  for (const ct of chosen) {
    const t = findTalent(ct.id);
    if (!t) continue;
    // Variantes: se o talento tem `variants`, usa o passiveEffects da variante
    // escolhida (default = primeira). Caso contrário, usa o passiveEffects raiz.
    let e = t.passiveEffects;
    if (t.variants && t.variants.length) {
      const chosenKey = ct.choices?.variant ?? t.variants[0].key;
      const v = t.variants.find(x => x.key === chosenKey) ?? t.variants[0];
      e = v.passiveEffects ?? undefined;
    }
    if (!e) continue;
    const push = (field: string, value: number | string) =>
      out.breakdown.push({ talentId: t.id, talentName: t.name, field, value });

    if (e.hpMaxFlat) { out.hp += e.hpMaxFlat; push('HP máx', `+${e.hpMaxFlat}`); }
    if (e.hpMaxPerLevel) {
      const v = e.hpMaxPerLevel * level;
      out.hp += v; push('HP máx', `+${v} (${e.hpMaxPerLevel}/nv)`);
    }
    if (e.peMaxFlat) { out.pe += e.peMaxFlat; push('PE máx', `+${e.peMaxFlat}`); }
    if (e.peMaxPerLevel) {
      const v = e.peMaxPerLevel * level;
      out.pe += v; push('PE máx', `+${v} (${e.peMaxPerLevel}/nv)`);
    }
    if (e.initiative) { out.initiative += e.initiative; push('Iniciativa', `+${e.initiative}`); }
    if (e.attention) { out.attention += e.attention; push('Atenção', `+${e.attention}`); }
    if (e.opportunityMaxFlat) {
      out.opportunity += e.opportunityMaxFlat;
      push('AdO/rodada', `+${e.opportunityMaxFlat}`);
    }
    if (e.opportunityAdvantage) {
      out.notes.push(`${t.name}: AdO com Vantagem`);
      push('AdO', 'Vantagem');
    }
    if (e.rdFlat) { out.rd += e.rdFlat; push('RD', `+${e.rdFlat}`); }
    if (e.initiativeRerollIfNotFirst) {
      out.notes.push(`${t.name}: pode rerolar Iniciativa se não foi 1º`);
      push('Iniciativa', 'rerolável');
    }
    if (e.luckMax) { out.luckMax += e.luckMax; push('Sorte máx', `+${e.luckMax}`); }
    if (e.immuneCondition) {
      out.immunities.push(e.immuneCondition);
      push('Imune', e.immuneCondition);
    }
    if (e.fortitudeBonus) {
      out.fortitude += e.fortitudeBonus;
      push('Fortitude', `+${e.fortitudeBonus}`);
    }
    if (e.soulRdLevelDivisor && e.soulRdLevelDivisor > 0) {
      const v = Math.floor(level / e.soulRdLevelDivisor);
      if (v > 0) {
        out.soulRd += v;
        push('RD Alma', `+${v} (Nv÷${e.soulRdLevelDivisor})`);
      }
    }
    if (e.grantsTrainedSkill) {
      if (!out.grantedTrainedSkills.includes(e.grantsTrainedSkill)) {
        out.grantedTrainedSkills.push(e.grantsTrainedSkill);
      }
      push(`Treinado`, e.grantsTrainedSkill);
    }
    if (e.movementBonusMeters) {
      out.movementMeters += e.movementBonusMeters;
      push('Movimento', `+${e.movementBonusMeters}m`);
    }
    if (e.vigorMalditoHealBonus) {
      out.vigorMalditoHealBonus += e.vigorMalditoHealBonus;
      push('Vigor Maldito', `cura +${e.vigorMalditoHealBonus}`);
    }
    if (e.unlocksSuporteLv2) {
      out.suporteLv2Unlocked = true;
      push('Suporte', '2º efeito desbloqueado');
    }
    if (e.shieldProficient) {
      out.shieldProficient = true;
      push('Escudo', 'Proficiente');
    }
    if (e.dualWieldDefenseBonus) {
      out.dualWieldDefenseBonus += e.dualWieldDefenseBonus;
      push('Defesa (2 armas)', `+${e.dualWieldDefenseBonus}`);
    }
    if (e.desprevenidoAffectsAllSaves) {
      out.desprevenidoAffectsAllSaves = true;
      push('Desprevenido', 'afeta todos TRs');
    }
    if (e.noEnemyReactionOnCritFail) {
      out.noEnemyReactionOnCritFail = true;
      push('Falha crítica', 'sem reação inimiga');
    }
    if (e.saveBonusVsDefenseDebuff) {
      out.saveBonusVsDefenseDebuff += e.saveBonusVsDefenseDebuff;
      push('TR vs debuff Defesa', `+${e.saveBonusVsDefenseDebuff}`);
    }
    if (e.weaponCriticalGroup) {
      const grp = ct.choices?.criticalGroup ?? e.weaponCriticalGroup;
      if (grp && !out.weaponCriticalGroups.includes(grp)) out.weaponCriticalGroups.push(grp);
      push('Crítico de Grupo', grp);
    }
    if (e.saveProficiency) {
      const saveName = ct.choices?.save ?? e.saveProficiency.saveName;
      if (saveName) {
        const cur = out.saveProficiencyByName[saveName];
        // mastery > trained
        if (e.saveProficiency.tier === 'mastery' || !cur) {
          out.saveProficiencyByName[saveName] = e.saveProficiency.tier;
          push(`TR ${saveName}`, e.saveProficiency.tier);
        }
      }
    }
    if (e.saveAttrBoost) {
      const saveName = ct.choices?.save ?? e.saveAttrBoost.saveName;
      if (saveName) {
        out.saveAttrBoost[saveName] = (out.saveAttrBoost[saveName] ?? 0) + e.saveAttrBoost.value;
        push(`Atributo TR ${saveName}`, `+${e.saveAttrBoost.value}`);
      }
    }

    // Atributos escolhidos (Incremento de Atributo, Mestre Defensivo, Quebra de Limites…)
    const attrChoice = ct.choices?.attr;
    const attrChoice2 = e.appliesToSecondAttr ? ct.choices?.attr2 : undefined;
    const applyToAttr = (attrName: string) => {
      if (e.attrCapBoost) {
        out.attrCapBoost[attrName] = (out.attrCapBoost[attrName] ?? 0) + e.attrCapBoost;
        push(`Cap ${attrName}`, `+${e.attrCapBoost}`);
      }
      if (e.attrValueBoost) {
        out.attrValueBoost[attrName] = (out.attrValueBoost[attrName] ?? 0) + e.attrValueBoost;
        push(`${attrName}`, `+${e.attrValueBoost}`);
      }
    };
    if (attrChoice) applyToAttr(attrChoice);
    if (attrChoice2 && attrChoice2 !== attrChoice) applyToAttr(attrChoice2);
  }

  return out;
}

/**
 * Filtra a breakdown por "campo lógico" para mostrar tooltips por estatística.
 * Usar prefix simples: 'HP máx', 'PE máx', 'Iniciativa', 'Atenção', 'AdO', 'RD', 'Sorte', 'Cap', 'Imune'.
 */
export function breakdownFor(
  bonuses: AggregatedTalentBonuses,
  prefix: string,
): TalentBonusBreakdownItem[] {
  return bonuses.breakdown.filter(b => b.field.startsWith(prefix));
}

// ===========================================================================
// Talento "Discurso Motivador"
// PV Temporário = Nível × 2 + ⌈(Mod.PRE × Bônus de Treinamento) / 2⌉
// 1 buff por criatura por descanso longo.
// ===========================================================================


export interface DiscursoMotivadorCalc {
  available: boolean;
  /** Personagem possui o talento e tem Persuasão treinada. */
  eligible: boolean;
  /** Valor de PVT que cada alvo recebe. Sempre ≥ 0. */
  tempHP: number;
  level: number;
  preMod: number;
  trainingBonus: number;
  /** Persuasão é treinada (≥ trained). Sem isso o talento não funciona. */
  persuasaoTrained: boolean;
}

/** Resolve o cálculo de Discurso Motivador para o personagem-fonte. */
export function computeDiscursoMotivador(c: Character): DiscursoMotivadorCalc {
  const has = (c.chosenTalents ?? []).some(t => t.id === 'tal-discurso-motivador');
  const persuasaoSkill = (c.skills ?? []).find(s => s.name === 'Persuasão');
  const persuasaoTrained = !!persuasaoSkill?.trained || !!persuasaoSkill?.mastery;
  const preAttr = (c.attributes ?? []).find(a => a.name === 'Presença');
  const preMod = preAttr ? Math.floor(((preAttr.value ?? 10) - 10) / 2) : 0;
  const trainingBonus = getTrainingBonusByLevel(c.level);
  const level = c.level;
  const tempHP = Math.max(
    0,
    level * 2 + Math.ceil((preMod * trainingBonus) / 2),
  );
  return {
    available: has,
    eligible: has && persuasaoTrained,
    tempHP,
    level,
    preMod,
    trainingBonus,
    persuasaoTrained,
  };
}
