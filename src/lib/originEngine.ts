/**
 * ============================================================================
 *  ORIGIN ENGINE
 * ============================================================================
 *  Funções puras que traduzem ORIGIN_SPECS + escolhas do jogador em mutações
 *  concretas no estado do wizard (atributos, trackers, tags, abilities,
 *  curva de nível). Importado pelo CharacterWizard.
 *
 *  Princípio: SEM efeitos colaterais. Recebe inputs, devolve um snapshot
 *  imutável que o componente aplica via setState.
 * ============================================================================
 */

import {
  ORIGIN_SPECS, CLAN_DATA, FAH_ANATOMIES, CAM_CORES, SEM_TECNICA_REWARDS,
  type AttrName, type ClanId, type OriginAutomationState,
  emptyAutomationState, ATTR_NAMES,
} from './origins';
import { AURA_APTITUDES } from './auraAptitudes';
import type { Origin, Specialization, Passive } from '@/types';

// ===== ESTRUTURAS DE SAÍDA =====
export interface OriginChoices {
  /** Atributo que recebe +2 (do dropdown). */
  primaryAttr?: AttrName;
  /** Atributo que recebe +1 (do dropdown). */
  secondaryAttr?: AttrName;
  /** Clã selecionado (Herdado). */
  clan?: ClanId;
  /** Aptidão de Aura selecionada (Derivado). */
  auraAptitudeId?: string;
  /** IDs de Anatomias selecionadas (FAH; pode ter múltiplas conforme nível). */
  anatomyIds?: string[];
  /** Núcleo primário (CAM). */
  primaryCoreId?: 'core1' | 'core2' | 'core3';
}

export interface OriginTrackers {
  availableAttrPoints: number;
  /** Atributos elegíveis para gastar pontos livres (lock). */
  attrPointsLockedTo?: AttrName[];
  /** Cap por atributo (ex.: máx 3 do mesmo). */
  attrPointsCapPerAttr?: number;
  availableTrainings: number;
  trainingWhitelist?: string[];
  trainingAlternativeAsExpertise?: boolean;
  availableTalents: number;
  pendingSpecialChoice: number;
  pendingSpecialChoiceLabel?: string;
  pendingSpecialChoiceKind?: 'clan' | 'anatomy' | 'core' | 'aura';
}

export interface OriginEffects {
  /** Bônus a somar nos atributos do personagem. */
  attrBonuses: Partial<Record<AttrName, number>>;
  /** Trackers consolidados. */
  trackers: OriginTrackers;
  /** Tags livres exibidas na ficha. */
  tags: string[];
  /** Habilidades a serem injetadas como Passive. */
  abilities: { name: string; description: string }[];
  /** Especialização travada (se houver). */
  lockedSpecialization?: Specialization;
  /** Especializações bloqueadas. */
  blockedSpecializations?: Specialization[];
  /** Bloqueia acesso a feitiços. */
  blockSpells?: boolean;
  /** Caps customizados de atributo. */
  attrCapOverrides?: Partial<Record<AttrName, number>>;
  /** Notas de imunidades narrativas. */
  immunitiesNotes: string[];
  /** Cura reversa cai pela metade. */
  healingHalved: boolean;
  /** Bônus de movimento (m). */
  movementBonus: number;
  /** Feitiços extras imediatos. */
  extraSpellsImmediate: number;
  /** Tag automática para feitiços extras. */
  extraSpellTag?: string;
  /** Habilita o sistema de Núcleos (CAM). */
  enablesCores: boolean;
  /** Snapshot acumulado das automações até o nível atual. */
  automation: OriginAutomationState;
  /** Logs legíveis das automações por nível (para o painel "Trackers"). */
  automationLog: string[];
}

// ===== ENGINE PRINCIPAL =====
export function applyOriginEffects(
  origin: Origin,
  level: number,
  choices: OriginChoices,
): OriginEffects {
  const spec = ORIGIN_SPECS[origin];
  const attrBonuses: Partial<Record<AttrName, number>> = {};

  // 1) Bônus FIXOS
  if (spec.fixedAttrBonuses) {
    for (const [attr, val] of Object.entries(spec.fixedAttrBonuses) as [AttrName, number][]) {
      attrBonuses[attr] = (attrBonuses[attr] ?? 0) + val;
    }
  }

  // 2) Escolha do dropdown +2/+1
  let attrChoice = spec.attrChoice;
  // Se for Herdado, pega do clã
  if (origin === 'Herdado' && choices.clan) {
    attrChoice = CLAN_DATA[choices.clan].attrChoice;
  }
  if (attrChoice && choices.primaryAttr && choices.secondaryAttr && choices.primaryAttr !== choices.secondaryAttr) {
    attrBonuses[choices.primaryAttr] = (attrBonuses[choices.primaryAttr] ?? 0) + 2;
    attrBonuses[choices.secondaryAttr] = (attrBonuses[choices.secondaryAttr] ?? 0) + 1;
  }

  // 3) Trackers
  const trackers: OriginTrackers = {
    availableAttrPoints: spec.trackers.availableAttrPoints ?? 0,
    attrPointsLockedTo: spec.trackers.attrPointsLockedTo,
    attrPointsCapPerAttr: spec.trackers.attrPointsCapPerAttr,
    availableTrainings: spec.trackers.availableTrainings ?? 0,
    trainingWhitelist: spec.trackers.trainingChoice?.whitelist,
    trainingAlternativeAsExpertise: spec.trackers.trainingChoice?.alternativeAsExpertise,
    availableTalents: spec.trackers.availableTalents ?? 0,
    pendingSpecialChoice: spec.trackers.pendingSpecialChoice?.count ?? 0,
    pendingSpecialChoiceLabel: spec.trackers.pendingSpecialChoice?.label,
    pendingSpecialChoiceKind: spec.trackers.pendingSpecialChoice?.kind,
  };

  // 4) Habilidades + tags
  const abilities = [...spec.abilities];
  const tags = [...spec.tags];

  // 5) Camadas do Clã (Herdado)
  if (origin === 'Herdado' && choices.clan) {
    const clan = CLAN_DATA[choices.clan];
    abilities.push(...clan.abilities);
    trackers.availableTrainings += clan.training.count;
    trackers.trainingWhitelist = clan.training.whitelist;
    trackers.trainingAlternativeAsExpertise = clan.training.alternativeAsExpertise;
    // Resolve a pendência "selecionar clã"
    trackers.pendingSpecialChoice = Math.max(0, trackers.pendingSpecialChoice - 1);
  }

  // 6) Aptidão de Aura (Derivado)
  if (origin === 'Derivado' && choices.auraAptitudeId) {
    const apt = AURA_APTITUDES.find(a => a.id === choices.auraAptitudeId);
    if (apt) {
      abilities.push({ name: `Aura: ${apt.name}`, description: apt.mechanic });
      tags.push(`Aura: ${apt.name}`);
      trackers.pendingSpecialChoice = Math.max(0, trackers.pendingSpecialChoice - 1);
    }
  }

  // 7) Anatomia (FAH)
  if (origin === 'Feto Amaldiçoada Híbrido (FAH)' && choices.anatomyIds?.length) {
    for (const id of choices.anatomyIds) {
      const an = FAH_ANATOMIES.find(a => a.id === id);
      if (an) {
        abilities.push({ name: `Anatomia: ${an.name}`, description: an.description });
        tags.push(an.name);
      }
    }
    if (choices.anatomyIds.length >= 1) {
      trackers.pendingSpecialChoice = Math.max(0, trackers.pendingSpecialChoice - 1);
    }
  }

  // 8) Núcleo Primário (CAM)
  if (origin === 'Corpo Amaldiçoado Mutante (CAM)' && choices.primaryCoreId) {
    const core = CAM_CORES.find(c => c.id === choices.primaryCoreId);
    if (core) {
      tags.push(`Núcleo Primário: ${core.name}`);
      trackers.pendingSpecialChoice = Math.max(0, trackers.pendingSpecialChoice - 1);
    }
  }

  // 9) Curva de automação por nível (acumulada de 1..level)
  let automation = emptyAutomationState();
  const automationLog: string[] = [];
  if (spec.perLevel) {
    for (let lvl = 1; lvl <= level; lvl++) {
      for (const layer of spec.perLevel) {
        const before = automation;
        automation = layer.apply(lvl, automation);
        if (automation !== before && automation.notes.length > before.notes.length) {
          automationLog.push(automation.notes[automation.notes.length - 1]);
        }
      }
    }
  }

  // Camadas do clã (Gojo/Kamo: HP/PE per level; Gojo/Zenin: extra spells)
  if (origin === 'Herdado' && choices.clan) {
    const clan = CLAN_DATA[choices.clan];
    if (clan.perLevel?.hpPerLevel) automation.bonusHP += clan.perLevel.hpPerLevel * level;
    if (clan.perLevel?.pePerEvenLevel) automation.bonusPE += clan.perLevel.pePerEvenLevel * Math.floor(level / 2);
    if (clan.extraSpellLevels) {
      const earned = clan.extraSpellLevels.filter(l => l <= level).length;
      automation.extraSpells += earned;
      if (earned) automationLog.push(`Clã ${clan.id}: +${earned} feitiço(s) extra(s) por linhagem.`);
    }
    if (clan.focusedSpellLevels) {
      const earned = clan.focusedSpellLevels.filter(l => l <= level).length;
      if (earned) {
        tags.push(`Feitiço Focado ×${earned}`);
        automationLog.push(`Clã ${clan.id}: ${earned} tag(s) "Feitiço Focado".`);
      }
    }
    if (clan.perLevel?.bonusAtLevel) {
      for (const b of clan.perLevel.bonusAtLevel) {
        if (level >= b.level) automationLog.push(`Clã ${clan.id} (Nv ${b.level}): ${b.note}`);
      }
    }
  }

  // Inato / extra spells imediatos
  const extraSpellsImmediate = spec.extraSpellsImmediate ?? 0;

  // Sem Técnica: enumera recompensas até o nível atual
  if (origin === 'Sem Técnica') {
    for (const r of SEM_TECNICA_REWARDS) {
      if (r.level <= level) automationLog.push(`Sem Técnica (Nv ${r.level}): ${r.description}`);
    }
  }

  return {
    attrBonuses,
    trackers,
    tags,
    abilities,
    lockedSpecialization: spec.lockSpecialization,
    blockedSpecializations: spec.blockedSpecializations,
    blockSpells: spec.blockSpells,
    attrCapOverrides: spec.attrCapOverrides,
    immunitiesNotes: spec.immunitiesNotes ?? [],
    healingHalved: spec.healingHalved ?? false,
    movementBonus: spec.movementBonus ?? 0,
    extraSpellsImmediate,
    extraSpellTag: spec.extraSpellTag,
    enablesCores: spec.enablesCores ?? false,
    automation,
    automationLog,
  };
}

// ===== TRACKERS LIVES (estado mutável durante o wizard) =====
export interface LiveTrackers {
  availableAttrPoints: number;
  availableTrainings: number;
  availableTalents: number;
  pendingSpecialChoice: number;
  /** Quantidade de escolhas pendentes do Empenho Implacável + Novo Estilo da Sombra. */
  pendingChoicesCount: number;
}

export function trackersFromEffects(
  effects: OriginEffects,
  consumed: Partial<LiveTrackers>,
): LiveTrackers {
  return {
    availableAttrPoints: Math.max(0, effects.trackers.availableAttrPoints + (effects.automation.extraAttrPoints ?? 0) - (consumed.availableAttrPoints ?? 0)),
    availableTrainings: Math.max(0, effects.trackers.availableTrainings + (effects.automation.extraTrainings ?? 0) - (consumed.availableTrainings ?? 0)),
    availableTalents: Math.max(0, effects.trackers.availableTalents + (effects.automation.extraTalents ?? 0) - (consumed.availableTalents ?? 0)),
    pendingSpecialChoice: Math.max(0, effects.trackers.pendingSpecialChoice - (consumed.pendingSpecialChoice ?? 0)),
    pendingChoicesCount: effects.automation.pendingChoices.length,
  };
}

export function isWizardClear(t: LiveTrackers): boolean {
  return t.availableAttrPoints === 0 && t.availableTrainings === 0 && t.availableTalents === 0 && t.pendingSpecialChoice === 0;
}

// ===== Conversor: efeitos -> Passives =====
export function effectsToPassives(effects: OriginEffects): Passive[] {
  return effects.abilities.map(a => ({
    id: crypto.randomUUID(),
    name: a.name,
    description: a.description,
    bonusHP: 0, bonusPE: 0, bonusESC: 0, bonusSlots: 0, bonusRD: 0, bonusCA: 0,
  }));
}

// ===== Util para UI =====
export function attrChoiceFor(origin: Origin, clan?: ClanId) {
  if (origin === 'Herdado' && clan) return CLAN_DATA[clan].attrChoice;
  return ORIGIN_SPECS[origin].attrChoice;
}

export const ALL_ATTRS: AttrName[] = [...ATTR_NAMES];
