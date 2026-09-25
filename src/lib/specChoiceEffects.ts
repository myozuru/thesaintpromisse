/**
 * Agregador central das ESCOLHAS de Habilidades de Especialização
 * (`character.specAbilityChoices`). Lê cada escolha gravada pelo painel
 * (`SpecAbilityChoiceDialog`) e devolve um delta consultável pelos
 * sistemas de combate / progressão / dialog de feitiço.
 *
 * IMPORTANTE: este módulo NÃO muta o personagem — ele apenas devolve
 * o que cada subsistema deve aplicar:
 *
 *  • savesExternalBonus      → patch no array `savingThrows` (Energia Focalizada)
 *  • skillsToPromoteMastery  → patch no array `skills` (Especialização)
 *  • spellPeReductionById    → consumido por `prepareCast` (Dominância, Manipulação Perfeita, Feitiço Favorito)
 *  • spellLevelCdBonus       → consumido por `prepareCast` (Nível Perfeito)
 *  • rdAllExceptSoul         → consumido por `damageStep` (Revestimento Constante)
 *  • cobrirSeMaxPeBonus      → consumido por `barActivation` (Físico Defensivo)
 *  • allowAimForCursed       → consumido pela UI de ataque (Mira Aperfeiçoada)
 *  • fintaUsesKeyAttr        → consumido pela UI de Fintar (Finta Amaldiçoada)
 *  • naturalidadeRitualUsesInt → consumido por testes de Prestidigitação em rituais
 *  • ritualConjuracaoBonus   → consumido pela UI de ritual (Ritualista)
 *  • ritualExtraImprovementsLimit → idem
 *  • atencaoBonus / percepcaoBonus → Sentidos Aguçados (passivo numérico)
 *  • miraAperfeicoadaTecPrecisaPlus → +1 no fundamento se já o possui
 */
import type { Character } from '@/types';
import { getTrainingBonusByLevel } from './levelEngine';
import { getSpecKeyMod } from './specKeyMod';

/**
 * Marcador interno: indica que a redução de PE de um feitiço é dinâmica
 * (= ⌈nivel/2⌉ do feitiço em si). O consumidor (`prepareCast`) reconhece
 * este sentinel e calcula a redução real baseada no `spellLevel`.
 */
export const DOMINANCIA_DYNAMIC = -999;

export interface SpecChoiceAggregate {
  /** TR → bônus absoluto a somar em `externalBonus`. */
  savesExternalBonus: Partial<Record<'Fortitude' | 'Reflexos' | 'Astúcia' | 'Vontade', number>>;
  /** Nomes de perícias a promover para Maestria. */
  skillsToPromoteMastery: string[];
  /** spell.id → redução fixa de PE (mín. 0 quando aplicado). */
  spellPeReductionById: Record<string, number>;
  /** Nível numérico de feitiço → bônus na CD (Nível Perfeito). */
  spellLevelCdBonus: Record<number, number>;
  /** RD aplicada a TODOS os tipos de dano exceto alma (Revestimento Constante). */
  rdAllExceptSoul: number;
  /** +N no `maxPEPerUse` da aptidão Cobrir-se. */
  cobrirSeMaxPeBonus: number;
  /** Ação Mirar pode ser usada para ataques amaldiçoados (Mira Aperfeiçoada). */
  allowAimForCursed: boolean;
  /** Fintar usa atributo-chave (INT/SAB) em vez de Presença. */
  fintaUsesKeyAttr: boolean;
  /** Testes de Prestidigitação atrelados a rituais usam INT (Naturalidade com Rituais). */
  naturalidadeRitualUsesInt: boolean;
  /** Bônus em testes de conjuração ritual (Ritualista: +2). */
  ritualConjuracaoBonus: number;
  /** Limite de melhorias grátis por ritual (Ritualista: ⌊TB/2⌋). */
  ritualExtraImprovementsLimit: number;
  /** Bônus permanente em Atenção (Sentidos Aguçados: ⌊Mod_Chave/2⌋). */
  atencaoBonus: number;
  /** Bônus em rolagens de Percepção (Sentidos Aguçados: idem). */
  percepcaoBonus: number;
  /** +1 no bônus do fundamento Técnica Precisa (se já o possui). Caso contrário, "grants" via UI. */
  tecnicaPrecisaPlus: number;
  /** Notas legíveis para debug/log. */
  notes: string[];
}

const EMPTY: SpecChoiceAggregate = Object.freeze({
  savesExternalBonus: {},
  skillsToPromoteMastery: [],
  spellPeReductionById: {},
  spellLevelCdBonus: {},
  rdAllExceptSoul: 0,
  cobrirSeMaxPeBonus: 0,
  allowAimForCursed: false,
  fintaUsesKeyAttr: false,
  naturalidadeRitualUsesInt: false,
  ritualConjuracaoBonus: 0,
  ritualExtraImprovementsLimit: 0,
  atencaoBonus: 0,
  percepcaoBonus: 0,
  tecnicaPrecisaPlus: 0,
  notes: [],
}) as SpecChoiceAggregate;

function hasAbility(c: Pick<Character, 'chosenSpecAbilities'>, id: string): boolean {
  return (c.chosenSpecAbilities ?? []).some(a => a.abilityId === id);
}

function hasAptitude(c: Pick<Character, 'chosenAptitudes' | 'chosenAuraAptitudes' | 'chosenClAptitudes'>, id: string): boolean {
  return (
    (c.chosenAptitudes ?? []).includes(id) ||
    (c.chosenAuraAptitudes ?? []).includes(id) ||
    (c.chosenClAptitudes ?? []).includes(id)
  );
}

export function aggregateSpecChoices(
  c: Pick<
    Character,
    | 'chosenSpecAbilities'
    | 'specAbilityChoices'
    | 'attributes'
    | 'level'
    | 'keyAttribute'
    | 'chosenAptitudes'
    | 'chosenAuraAptitudes'
    | 'chosenClAptitudes'
  >,
): SpecChoiceAggregate {
  const chosen = c.chosenSpecAbilities ?? [];
  if (chosen.length === 0) {
    return { ...EMPTY, savesExternalBonus: {}, skillsToPromoteMastery: [], spellPeReductionById: {}, spellLevelCdBonus: {}, notes: [] };
  }

  const out: SpecChoiceAggregate = {
    savesExternalBonus: {},
    skillsToPromoteMastery: [],
    spellPeReductionById: {},
    spellLevelCdBonus: {},
    rdAllExceptSoul: 0,
    cobrirSeMaxPeBonus: 0,
    allowAimForCursed: false,
    fintaUsesKeyAttr: false,
    naturalidadeRitualUsesInt: false,
    ritualConjuracaoBonus: 0,
    ritualExtraImprovementsLimit: 0,
    atencaoBonus: 0,
    percepcaoBonus: 0,
    tecnicaPrecisaPlus: 0,
    notes: [],
  };

  const level = Math.max(1, c.level ?? 1);
  const tb = getTrainingBonusByLevel(level);
  const keyMod = getSpecKeyMod(c);
  const choices = c.specAbilityChoices ?? {};

  // ─── tec-energia-focalizada (Tier 4) — TR escolhido +⌊Mod_Chave/2⌋ ───
  if (hasAbility(c, 'tec-energia-focalizada')) {
    const ch = choices['tec-energia-focalizada'];
    if (ch?.kind === 'save-skill') {
      const bonus = Math.floor(keyMod / 2);
      if (bonus > 0) {
        out.savesExternalBonus[ch.save] = (out.savesExternalBonus[ch.save] ?? 0) + bonus;
        out.notes.push(`Energia Focalizada: ${ch.save} +${bonus}`);
      }
    }
  }

  // ─── tec-especializacao (Tier 6) — 3 perícias Treinadas → Maestria ───
  if (hasAbility(c, 'tec-especializacao')) {
    const ch = choices['tec-especializacao'];
    if (ch?.kind === 'skills') {
      out.skillsToPromoteMastery.push(...ch.skills);
      if (ch.skills.length) out.notes.push(`Especialização: Maestria em ${ch.skills.join(', ')}`);
    }
  }

  // ─── tec-dominancia-em-feitico (Tier 6) — feitiço escolhido custa −⌈nivel/2⌉ ───
  // Aplicado por nome→spellId no agregador; só marcamos o id e a redução = ⌈nivel/2⌉
  // (o nivel vem do feitiço — calculado em `prepareCast`).
  if (hasAbility(c, 'tec-dominancia-em-feitico')) {
    const ch = choices['tec-dominancia-em-feitico'];
    if (ch?.kind === 'single-spell') {
      // Marcador: -1 indica "dynamic by spell.level". O consumidor lê e calcula.
      out.spellPeReductionById[ch.spellId] = (out.spellPeReductionById[ch.spellId] ?? 0) + DOMINANCIA_DYNAMIC;
    }
  }

  // ─── tec-feitico-favorito (Tier 8) — escolha de feitiço (mesma redução). ───
  // (Spec Tier 8 — texto análogo: feitiço favorito; modelado igual à Dominância).
  if (hasAbility(c, 'tec-feitico-favorito')) {
    const ch = choices['tec-feitico-favorito'];
    if (ch?.kind === 'single-spell') {
      out.spellPeReductionById[ch.spellId] = (out.spellPeReductionById[ch.spellId] ?? 0) + DOMINANCIA_DYNAMIC;
    }
  }

  // ─── tec-manipulacao-perfeita (Tier 16) — N feitiços escolhidos: -⌊TB/2⌋ PE (mín 1). ───
  if (hasAbility(c, 'tec-manipulacao-perfeita')) {
    const ch = choices['tec-manipulacao-perfeita'];
    if (ch?.kind === 'spells') {
      const reduction = Math.max(1, Math.floor(tb / 2));
      for (const sid of ch.spellIds) {
        out.spellPeReductionById[sid] = (out.spellPeReductionById[sid] ?? 0) + reduction;
      }
      if (ch.spellIds.length) out.notes.push(`Manipulação Perfeita: ${ch.spellIds.length} feitiço(s) -${reduction} PE`);
    }
  }

  // ─── tec-nivel-perfeito (Tier 6) — feitiços do nível escolhido: CD +2. ───
  if (hasAbility(c, 'tec-nivel-perfeito')) {
    const ch = choices['tec-nivel-perfeito'];
    if (ch?.kind === 'spell-level') {
      out.spellLevelCdBonus[ch.level] = (out.spellLevelCdBonus[ch.level] ?? 0) + 2;
      out.notes.push(`Nível Perfeito: feitiços de nível ${ch.level} → CD +2`);
    }
  }

  // ─── tec-revestimento-constante (Tier 8) — RD geral = TB. Pré-req: apt-cobrir-se. ───
  if (hasAbility(c, 'tec-revestimento-constante') && hasAptitude(c, 'apt-cobrir-se')) {
    out.rdAllExceptSoul += tb;
    out.notes.push(`Revestimento Constante: RD ${tb} (exceto alma)`);
  }

  // ─── tec-fisico-amaldicoado-defensivo (Tier 8) — Cobrir-se maxPE +2 (+1 com Cob. Avançada). ───
  if (hasAbility(c, 'tec-fisico-amaldicoado-defensivo') && hasAptitude(c, 'apt-cobrir-se')) {
    const hasAvancada = hasAptitude(c, 'apt-cobertura-avancada');
    out.cobrirSeMaxPeBonus += 2 + (hasAvancada ? 1 : 0);
    out.notes.push(`Físico Defensivo: Cobrir-se +${2 + (hasAvancada ? 1 : 0)} maxPE`);
  }

  // ─── tec-mira-aperfeicoada (Tier 8) — Mirar p/ ataques amaldiçoados; Técnica Precisa +1. ───
  if (hasAbility(c, 'tec-mira-aperfeicoada')) {
    out.allowAimForCursed = true;
    out.tecnicaPrecisaPlus += 1;
    out.notes.push('Mira Aperfeiçoada: Mirar habilitado para ataques amaldiçoados');
  }

  // ─── tec-finta-amaldicoada (Tier 2) — Fintar usa INT/SAB em vez de Presença. ───
  if (hasAbility(c, 'tec-finta-amaldicoada')) {
    out.fintaUsesKeyAttr = true;
  }

  // ─── tec-naturalidade-com-rituais (Tier 4) — Prestidigitação em ritual usa INT. ───
  if (hasAbility(c, 'tec-naturalidade-com-rituais')) {
    out.naturalidadeRitualUsesInt = true;
  }

  // ─── tec-ritualista (Tier 6) — +2 conjuração ritual; +⌊TB/2⌋ melhorias grátis. ───
  if (hasAbility(c, 'tec-ritualista')) {
    out.ritualConjuracaoBonus += 2;
    out.ritualExtraImprovementsLimit += Math.floor(tb / 2);
  }

  // ─── tec-sentidos-agucados (Tier 10) — Atenção +⌊Mod_Chave/2⌋, Percepção idem. ───
  if (hasAbility(c, 'tec-sentidos-agucados')) {
    const v = Math.floor(keyMod / 2);
    if (v > 0) {
      out.atencaoBonus += v;
      out.percepcaoBonus += v;
      out.notes.push(`Sentidos Aguçados: Atenção/Percepção +${v}`);
    }
  }

  return out;
}
