import { reservarPassoOmni, executarNaCadeiaOmni, capturarCadeiaOmni } from '@/lib/omni/cadeiaEventos';
import { ajustarProtecoesOmni, consumirProtecoesOmni, expirarProtecoesOmni } from '@/lib/omni/protecoesAtivas';
import { montarMetadadosDano, resolverTipoDano, type OpcoesDano } from '@/lib/omni/contextoDano';
import { useMapStore } from '@/stores/useMapStore';
import { distanceBetweenChars } from '@/lib/weaponRange';
import { markCharacterDeleted } from "@/lib/charSyncStamps";
import { luaReducao, quebraPostura } from '@/lib/posturas';
import { arsenalTrocaLivreDisponivel, arsenalBonusAoTrocar } from '@/lib/arsenalCiclico';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { dispararGatilhoEfeitosItens } from '@/lib/omni/triggerEfeitos';
import { temImunidade as omniTemImunidade } from '@/lib/omni/immunity';
import { useLogStore } from '@/stores/useLogStore';
import { Character, CharacterCategory, Attribute, Passive, Spell, DamageType, ActiveBuff, createEmptyRdByType, CharacterClass, Specialization, Origin, createEmptyAccessorySlots, ActiveCondition, CoreId, AptitudeKey, APTITUDE_MIN, APTITUDE_MAX, createDefaultCursedAptitudes, DEFAULT_SAVING_THROWS } from '@/types';
import { recalcAnatomyPassives } from '@/lib/anatomyEffects';
import { renovacaoSangueAtiva, aplicarRenovacao } from '@/lib/renovacaoSangue';
import { recalcCursedExclusivePassives } from '@/lib/cursedExclusiveEffects';
import { recalcDotePassives } from '@/lib/doteEffects';
import { DOTE_BY_ID } from '@/lib/dotes';
import {
  isFAH as isFahOrigin,
  applyAlmaMalditaReduction,
  calcSangueToxicoReturn,
  calcCursedDC,
} from '@/lib/fahCombatHooks';
import { buildDefaultAttributes, buildDefaultSkills } from '@/lib/defaults';
import {
  buildLevelUpTrackers,
  buildAfinidadeTecnicaTrackers,
  AFINIDADE_TECNICA_MILESTONES,
  MAX_LEVEL,
  getTrainingBonusByLevel,
  getHitDiceMax,
  getClassHitDie,
  getDieAvg,
  getConMod,
  recalcHpMaxFromHistory,
  recalcPeMaxFromHistory,
  recalcPeMaxBySpec,
  type PendingLevelChoice,
  type LevelHistoryEntry,
} from '@/lib/levelEngine';
import { getAuraAptitudeById, checkAuraGate, resolveAuraUsageMax, resolveFixedPeCost } from '@/lib/auraAptitudes';
import { calcularCobrirSe, calcularCanalizar, calcularProjetar, calcularEstimulo, calcularExpandirAura, calcularLeituraDeAura, calcularLeituraRapida, calcularProjecaoDividida, calcularPetalaOfensiva, calcularRastreio, calcularPunhoDivergenteArmar, calcularPunhoDivergenteResolver, getClLevel, type ClActivationResult } from '@/lib/clActivation';
import { calcularRevestimento, calcularAnularTecnica, calcularExpansaoIncompleta, calcularExpansaoCompleta, type DomActivationResult } from '@/lib/domActivation';
import { calcularCriarParedes, calcularCestaOca, calcularCortina, type BarActivationResult } from '@/lib/barActivation';
import { calcularFluxoConstante, calcularLiberacaoEr, calcularCanalizarEr, type ErActivationResult, type FluxoConstanteModo } from '@/lib/erActivation';
import { calcularDominioSimples, aplicarDanoDominioSimples, dissiparDominioSimples, type SpecialActivationResult } from '@/lib/specialActivation';
import {
  switchCoreInCombat,
  applySoulDamage as applySoulDamagePure,
  markCoreFallen,
  healCoreSnapshot,
  enforcePrimaryCap,
  calcSoulIntegrityMax,
  isCamActive,
} from '@/lib/camCores';
import { getSpecAbilityById, resolveUsageMax as resolveSpecUsageMax } from '@/lib/specAbilities';


import { getTalentById, resolveTalentUsageMax } from '@/lib/talents';
import { aggregateTalentBonuses, computeDiscursoMotivador } from '@/lib/talentEffects';
import { getShieldById, effectiveShieldRD } from '@/lib/shields';
import { applyLutadorProgression } from '@/lib/lutadorProgression';
import { applyTecnicaProgression } from '@/lib/tecnicaProgression';
import { aggregateSpecAbilityEffects } from '@/lib/specAbilityEffects';
import { expireTransmitir } from '@/lib/suporteTransmitir';
import { isProtegidoPreAnalise, isSurpresoCondition, preAnaliseShortRestPatch } from '@/lib/suportePreAnaliseRecompensa';
import { aggregateSpecChoices, DOMINANCIA_DYNAMIC } from '@/lib/specChoiceEffects';
import { getSpecKeyMod } from '@/lib/specKeyMod';
import { checkDerivadoEmergency } from '@/lib/derivadoOrigin';
import { applyOriginLevelUp, initOriginPools, resetOriginDailyPools } from '@/lib/originLevelEngine';
import { rollDice, rollD20Com, rollDiceCom } from '@/lib/dice';
import { findWeaponByName, requiresTwoHands, isLight } from '@/lib/weapons';
import { hasCombatStyle, isThrownWeapon } from '@/lib/combateEstilos';
import { clampExh, getExhaustionHpReduction, syncExhaustionConditions, EXHAUSTION_MAX } from '@/lib/exhaustionEffects';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { selectOmniPassiveBonuses } from '@/lib/omni/omniBridge';
import { formatDamageBreakdown } from '@/lib/damageLog';

/** Próximo passo de dado (d4→d6→d8→d10→d12, cap d12). */
function stepDie(d: number): number {
  if (d <= 4) return 6;
  if (d <= 6) return 8;
  if (d <= 8) return 10;
  return 12;
}

/** Dado escalado de "Economia de Energia" para um nível. baseDie = 4 (curto) ou 6 (longo). */
function scaledEconomiaDie(level: number, baseDie: number): number {
  // 1 passo a cada 5 níveis (a partir do Nv 5).
  const steps = Math.max(0, Math.floor((level - 1) / 5));
  let d = baseDie;
  for (let i = 0; i < steps; i++) d = stepDie(d);
  return d;
}

// ============================================================================
//  FAH (Feto Amaldiçoado Híbrido) — fórmulas data-driven
// ============================================================================
/** Vigor Maldito: máx de usos = 1 + (Lv≥4) + (Lv≥8) + (Lv≥12). */
export function calcVigorMalditoMax(level: number): number {
  return 1 + (level >= 4 ? 1 : 0) + (level >= 8 ? 1 : 0) + (level >= 12 ? 1 : 0);
}
/** Vigor Maldito: cura base por patamar (1-3 = 5, 4-7 = 10, 8-11 = 15, 12+ = 20). */
export function calcVigorMalditoBase(level: number): number {
  if (level >= 12) return 20;
  if (level >= 8) return 15;
  if (level >= 4) return 10;
  return 5;
}
/** Alma Maldita: usos diários = 2 + (Lv≥6) + (Lv≥12) + (Lv≥18). */
export function calcAlmaMalditaMax(level: number): number {
  return 2 + (level >= 6 ? 1 : 0) + (level >= 12 ? 1 : 0) + (level >= 18 ? 1 : 0);
}

/**
 * Migra um Character para os novos campos FAH se a origem for "Feto Amaldiçoada Híbrido (FAH)".
 * Idempotente — só preenche o que estiver faltando. Recalcula MAX no nível atual.
 */
export function migrateFAHFields<T extends Character>(c: T): T {
  if (c.origin !== 'Feto Amaldiçoada Híbrido (FAH)') return c;
  const vMax = calcVigorMalditoMax(c.level);
  const aMax = calcAlmaMalditaMax(c.level);
  return {
    ...c,
    healingHalved: c.healingHalved ?? true,
    canHealWithCursedEnergy: c.canHealWithCursedEnergy ?? true,
    vigorMalditoMax: vMax,
    vigorMalditoUses: c.vigorMalditoUses === undefined
      ? vMax
      : Math.min(c.vigorMalditoUses, vMax),
    anatomyFeatures: c.anatomyFeatures ?? [],
    almaMalditaMax: aMax,
    almaMalditaUses: c.almaMalditaUses === undefined
      ? aMax
      : Math.min(c.almaMalditaUses, aMax),
    sangueToxicoEnabled: c.sangueToxicoEnabled ?? true,
  };
}

/**
 * Pipeline FAH completo: garante campos novos + reaplica passivas de anatomia
 * (idempotente). Use em qualquer ponto onde o personagem possa ter virado FAH,
 * ganhado nível, ou alterado anatomias/toggles.
 */
/** Criaturas do Grimório: remove progressão de classe/especialização e pendências de nível. */
function stripCreatureProgression<T extends Character>(c: T): T {
  return {
    ...c,
    tecnicaFundamentos: undefined,
    tecnicaFoco: undefined,
    keyAttribute: undefined,
    empolgacaoLevel: undefined,
    empolgacaoStartLevel: undefined,
    empolgacaoDiceTable: undefined,
    lutadorManeuvers: undefined,
    passives: (c.passives ?? []).filter((p: any) => p?.source !== '__lutador_auto__' && p?.source !== '__tecnica_auto__'),
    pendingLevelChoices: [],
    availableAuraChoices: 0,
  } as T;
}

function readGrimorioLinkedIds(): Set<string> {
  const ids = new Set<string>();
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('fm_creatures_v1') : null;
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list)) for (const cr of list) if (cr?.linkedFichaId) ids.add(String(cr.linkedFichaId));
  } catch { /* ignore */ }
  return ids;
}

function finalizeFAH<T extends Character>(c: T): T {
  // Sempre recalcula passivas CURSED (qualquer ficha pode adquirir aptidões amaldiçoadas).
  const withCursed = recalcCursedExclusivePassives(c) as T;
  // Recalcula passivas de Dotes Gerais (Sentidos Atentos/Afiados).
  const withDotes = recalcDotePassives(withCursed) as T;
  if (withDotes.origin !== 'Feto Amaldiçoada Híbrido (FAH)') return withDotes;
  return recalcAnatomyPassives(migrateFAHFields(withDotes)) as T;
}

/**
 * Migração: garante que TODA ficha contenha os 5 Testes de Resistência canônicos
 * (Astúcia / Fortitude / Integridade / Reflexos / Vontade), preservando entradas
 * customizadas e removendo nomes legados (FOR/DES/CON/INT/SAB/PRE). Idempotente.
 */
function migrateSavingThrowNames<T extends Character>(c: T): T {
  const sts = c.savingThrows ?? [];
  const LEGACY = new Set(['FOR', 'DES', 'CON', 'INT', 'SAB', 'PRE']);
  const CANON = ['Astúcia', 'Fortitude', 'Integridade', 'Reflexos', 'Vontade'];

  // Mapa por nome canônico para preservar valores existentes (trained/mastery/value).
  const byName = new Map(sts.filter(s => CANON.includes(s.name)).map(s => [s.name, s]));
  const customs = sts.filter(s => !LEGACY.has(s.name) && !CANON.includes(s.name));

  // Se já tem todos os 5 canônicos e nenhum legado, nada a fazer.
  const hasLegacy = sts.some(s => LEGACY.has(s.name));
  if (!hasLegacy && byName.size === CANON.length) return c;

  const fresh = CANON.map(name => byName.get(name) ?? ({
    id: crypto.randomUUID(),
    name,
    value: 0,
    linkedAttribute: undefined,
    trained: false,
    mastery: false,
  }));
  return { ...c, savingThrows: [...fresh, ...customs] };
}

function getEffectiveHpMaxForHealing(c: Character): number {
  const entidades = useOmniEntidadesStore.getState().entidades;
  const passivas = (c.omniAtivos ?? [])
    .filter((a) => a.categoria === 'passiva' || a.categoria === 'talento' || a.categoria === 'aura')
    .map((a) => entidades[a.entidadeId])
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  const omniHp = selectOmniPassiveBonuses(c, passivas).totals.hp;
  return Math.max(0, c.hpMax + omniHp);
}

/**
 * Gera as pendências de feitiço extra do talento Afinidade com Técnica
 * quando ele é adquirido: 1 imediato + 1 para cada marco (5/10/15/20)
 * já alcançado pelo nível atual do personagem.
 */
function buildAfinidadeOnAcquire(
  talentId: string,
  acquiredAtLevel: number,
  c: Character,
): PendingLevelChoice[] {
  if (talentId !== 'tal-afinidade-tecnica') return [];
  const out: PendingLevelChoice[] = [{
    id: `${acquiredAtLevel}-afinidade-spell-${crypto.randomUUID()}`,
    level: acquiredAtLevel,
    kind: 'tecnica_extra_spell',
    label: `Afinidade com Técnica: +1 Feitiço extra (imediato)`,
    resolved: false,
  }];
  for (const mile of AFINIDADE_TECNICA_MILESTONES) {
    if (mile <= c.level && mile >= acquiredAtLevel) {
      out.push({
        id: `${mile}-afinidade-spell-${crypto.randomUUID()}`,
        level: mile,
        kind: 'tecnica_extra_spell',
        label: `Nv ${mile}: Afinidade com Técnica — +1 Feitiço extra`,
        resolved: false,
      });
    }
  }
  return out;
}

/**
 * Aplica mutações de estado vinculadas à aquisição de um talento:
 * - Incremento de Atributo (+2 valor/cap em 1 atributo)
 * - Quebra de Limites (+2 valor/cap em 2 atributos distintos)
 * - Alma Inquebrável (marca Integridade como treinada)
 * - Favorecido pela Sorte (inicializa pool de Sorte 3/3)
 */
function applyTalentAcquisitionMutations(
  c: Character,
  talentId: string,
  choices?: Record<string, string>,
): {
  attributes: Character['attributes'];
  attrCaps: Character['attrCaps'];
  skills: Character['skills'];
  luckMax?: number;
  luckCurrent?: number;
  cursedAptitudes?: Character['cursedAptitudes'];
} {
  let attributes = c.attributes;
  let attrCaps = c.attrCaps;
  let skills = c.skills;
  let luckMax = c.luckMax;
  let luckCurrent = c.luckCurrent;
  let cursedAptitudes = c.cursedAptitudes;

  const bumpAttr = (target: string, delta = 2, capDelta = 2) => {
    if (!target) return;
    attributes = (attributes ?? []).map((a) =>
      a.name === target ? { ...a, value: a.value + delta } : a,
    );
    if (capDelta !== 0) {
      attrCaps = { ...(attrCaps ?? {}) };
      attrCaps[target] = (attrCaps[target] ?? 20) + capDelta;
    }
  };

  const trainSkill = (name: string) => {
    if (!name) return;
    const lname = name.trim().toLowerCase();
    skills = (skills ?? []).map((s) =>
      s.name?.trim().toLowerCase() === lname ? { ...s, trained: true } : s,
    );
  };

  if (talentId === 'tal-incremento-atributo' && choices?.attr) {
    bumpAttr(choices.attr);
  }
  if (talentId === 'tal-quebra-limites') {
    if (choices?.attr) bumpAttr(choices.attr);
    if (choices?.attr2 && choices.attr2 !== choices.attr) bumpAttr(choices.attr2);
  }
  if (talentId === 'tal-alma-inquebravel') {
    trainSkill('Integridade');
  }
  if (talentId === 'tal-favorecido-pela-sorte') {
    luckMax = 3;
    luckCurrent = 3;
  }

  // ── Talentos com modal de escolha (apenas valor de atributo, SEM cap boost) ──
  // Mestre das Armas: FOR ou DES +2 (sem cap)
  if (talentId === 'tal-mestre-das-armas' && choices?.attr) {
    bumpAttr(choices.attr, 2, 0);
  }
  // Mestre Defensivo: FOR ou CON +2 (sem cap)
  if (talentId === 'tal-mestre-defensivo' && choices?.attr) {
    bumpAttr(choices.attr, 2, 0);
  }
  // Especialistas (Concussão/Cortes/Perfuração): atributo +1
  if (
    (talentId === 'tal-especialista-concussao' ||
      talentId === 'tal-especialista-cortes' ||
      talentId === 'tal-especialista-perfuracao') &&
    choices?.attr
  ) {
    bumpAttr(choices.attr, 1, 0);
  }
  // Resiliência Melhorada: atributo do TR escolhido +1, perícia (TR) treinada / mestre
  if (talentId === 'tal-resiliencia-melhorada' && choices?.attr) {
    bumpAttr(choices.attr, 1, 0);
    if (choices.skill) trainSkill(choices.skill);
  }
  // Tempestade de Ideias: +1 atributo, +1 perícia treinada
  if (talentId === 'tal-tempestade-ideias') {
    if (choices?.attr) bumpAttr(choices.attr, 1, 0);
    if (choices?.skill) trainSkill(choices.skill);
  }
  // Mestre da Criação: 2 perícias treinadas
  if (talentId === 'tal-mestre-criacao') {
    if (choices?.skill) trainSkill(choices.skill);
    if (choices?.skill2 && choices.skill2 !== choices.skill) trainSkill(choices.skill2);
  }
  // Artesão Amaldiçoado: marca a perícia escolhida como treinada (Ofício)
  if (talentId === 'tal-artesao-amaldicoado' && choices?.skill) {
    trainSkill(choices.skill);
  }
  // Aptidão Desenvolvida: +1 nível na aptidão escolhida
  if (talentId === 'tal-aptidao-desenvolvida' && choices?.aptitude) {
    const k = choices.aptitude;
    const map = { ...(cursedAptitudes ?? createDefaultCursedAptitudes()) };
    if (k in map) {
      (map as any)[k] = Math.min(APTITUDE_MAX, ((map as any)[k] ?? 0) + 1);
      cursedAptitudes = map;
    }
  }

  return { attributes, attrCaps, skills, luckMax, luckCurrent, cursedAptitudes };
}

/** Espelho de `applyTalentAcquisitionMutations` para `removeTalent`. */
function revertTalentAcquisitionMutations(
  c: Character,
  talentId: string,
  choices?: Record<string, string>,
): {
  attributes: Character['attributes'];
  attrCaps: Character['attrCaps'];
  skills: Character['skills'];
  luckMax?: number;
  luckCurrent?: number;
  cursedAptitudes?: Character['cursedAptitudes'];
} {
  let attributes = c.attributes;
  let attrCaps = c.attrCaps;
  let skills = c.skills;
  let luckMax = c.luckMax;
  let luckCurrent = c.luckCurrent;
  let cursedAptitudes = c.cursedAptitudes;

  const dropAttr = (target: string, delta = 2, capDelta = 2) => {
    if (!target) return;
    attributes = (attributes ?? []).map((a) =>
      a.name === target ? { ...a, value: Math.max(0, a.value - delta) } : a,
    );
    if (capDelta !== 0) {
      attrCaps = { ...(attrCaps ?? {}) };
      attrCaps[target] = Math.max(0, (attrCaps[target] ?? 20) - capDelta);
    }
  };

  const untrainSkill = (name: string) => {
    if (!name) return;
    const lname = name.trim().toLowerCase();
    skills = (skills ?? []).map((s) =>
      s.name?.trim().toLowerCase() === lname ? { ...s, trained: false } : s,
    );
  };

  if (talentId === 'tal-incremento-atributo' && choices?.attr) {
    dropAttr(choices.attr);
  }
  if (talentId === 'tal-quebra-limites') {
    if (choices?.attr) dropAttr(choices.attr);
    if (choices?.attr2 && choices.attr2 !== choices.attr) dropAttr(choices.attr2);
  }
  if (talentId === 'tal-alma-inquebravel') {
    untrainSkill('Integridade');
  }
  if (talentId === 'tal-favorecido-pela-sorte') {
    luckMax = undefined;
    luckCurrent = undefined;
  }

  if (talentId === 'tal-mestre-das-armas' && choices?.attr) {
    dropAttr(choices.attr, 2, 0);
  }
  if (talentId === 'tal-mestre-defensivo' && choices?.attr) {
    dropAttr(choices.attr, 2, 0);
  }
  if (
    (talentId === 'tal-especialista-concussao' ||
      talentId === 'tal-especialista-cortes' ||
      talentId === 'tal-especialista-perfuracao') &&
    choices?.attr
  ) {
    dropAttr(choices.attr, 1, 0);
  }
  if (talentId === 'tal-resiliencia-melhorada' && choices?.attr) {
    dropAttr(choices.attr, 1, 0);
    if (choices.skill) untrainSkill(choices.skill);
  }
  if (talentId === 'tal-tempestade-ideias') {
    if (choices?.attr) dropAttr(choices.attr, 1, 0);
    if (choices?.skill) untrainSkill(choices.skill);
  }
  if (talentId === 'tal-mestre-criacao') {
    if (choices?.skill) untrainSkill(choices.skill);
    if (choices?.skill2 && choices.skill2 !== choices.skill) untrainSkill(choices.skill2);
  }
  if (talentId === 'tal-artesao-amaldicoado' && choices?.skill) {
    untrainSkill(choices.skill);
  }
  if (talentId === 'tal-aptidao-desenvolvida' && choices?.aptitude) {
    const k = choices.aptitude;
    const map = { ...(cursedAptitudes ?? createDefaultCursedAptitudes()) };
    if (k in map) {
      (map as any)[k] = Math.max(APTITUDE_MIN, ((map as any)[k] ?? 0) - 1);
      cursedAptitudes = map;
    }
  }

  return { attributes, attrCaps, skills, luckMax, luckCurrent, cursedAptitudes };
}

interface CharacterStore {
  characters: Character[];
  addCharacter: (name: string, category: CharacterCategory, createdBy?: 'PLAYER' | 'MASTER') => void;
  /**
   * Cria uma ficha temporária ("lite"): só HP, PE, RD, deslocamento e
   * atributos/perícias/TRs padrão (para conseguir rolar testes). Sem
   * progressão de classe, sem aptidões, sem feitiços, sem pendências.
   */
  addTemporaryCharacter: (name: string, createdBy?: 'PLAYER' | 'MASTER', profileId?: string) => string | null;
  /** Verifica se o nome já está em uso (case-insensitive). Ignora `excludeId` se fornecido. */
  isNameTaken: (name: string, excludeId?: string) => boolean;
  removeCharacter: (id: string) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  /** Sobe nível e gera pendências. payload.hpRollBase = HP base (rolado ou média) SEM CON. */
  applyLevelUp: (id: string, payload: { hpRollBase: number; pePerLevel?: number; method?: 'roll' | 'fixed' }) => void;
  // applyLevelDown removido: subir de nível é uma ação irreversível.
  /** Resolve pendência de level-up. Aceita appliedEffect (snapshot reversível). */
  resolvePendingLevelChoice: (id: string, choiceId: string, value?: string, appliedEffect?: import('@/lib/levelEngine').PendingChoiceAppliedEffect) => void;
  /** Remove uma pendência (descartar). */
  removePendingLevelChoice: (id: string, choiceId: string) => void;
  /** Adiciona uma Habilidade de Especialização escolhida (consome 1 do pool). */
  chooseSpecAbility: (charId: string, abilityId: string, opts?: { skipPoolConsumption?: boolean }) => boolean;
  /** Remove uma Habilidade de Especialização escolhida (devolve 1 ao pool). */
  removeSpecAbility: (charId: string, abilityId: string) => void;
  /**
   * Persiste a escolha permanente de uma Habilidade de Especialização que
   * possui `choiceSchema` (ex.: Nível Perfeito → nível de feitiço). Substitui
   * qualquer escolha anterior. UI fecha o modal após chamar.
   */
  setSpecAbilityChoice: (
    charId: string,
    abilityId: string,
    value: import('@/lib/specAbilities').SpecAbilityChoiceValue,
  ) => void;
  /** Adiciona um Talento escolhido (sem mexer em pools — uso interno/legado). */
  addTalent: (charId: string, talentId: string, level: number, choices?: Record<string, string>, source?: 'level' | 'asi' | 'origin' | 'training_skill') => boolean;
  /** Adquire um Talento gastando 1 ponto: prioriza `availableTalentOnly`, senão usa o pool compartilhado. */
  chooseTalentFromPool: (charId: string, talentId: string, level: number, choices?: Record<string, string>) => boolean;
  /** Remove um Talento escolhido (devolve 1 ao `availableTalentOnly`). */
  removeTalent: (charId: string, talentId: string) => void;
  /**
   * Aplica o efeito do talento "Estudo Amaldiçoado" (Sem Técnica): +1 nível
   * em DUAS aptidões diferentes. Persiste a escolha em `chosenTalents.choices.aptitudes`.
   * Retorna {ok:false, reason} se inválido.
   */
  applyEstudoAmaldicoado: (charId: string, aptitudes: [import('@/types').AptitudeKey, import('@/types').AptitudeKey]) => { ok: boolean; reason?: string };
  /**
   * Vincula uma entidade Omni (feitiço/talento/passiva/aura/condição) à ficha
   * a partir de uma instância do inventário. A entidade passa a aparecer nas
   * listas correspondentes do CharacterCard com badge "Omni".
   * Retorna `true` se vinculou, `false` se já estava vinculada (mesmo instanceId).
   */
  vincularOmniAtivo: (
    charId: string,
    payload: {
      categoria: 'feitico' | 'talento' | 'passiva' | 'aura' | 'condicao' | 'voto';
      entidadeId: string;
      instanceId: string;
    },
  ) => boolean;
  /** Remove uma vinculação Omni pelo seu `id` (entrada de `omniAtivos`). */
  desvincularOmniAtivo: (charId: string, vinculoId: string) => void;
  /** Ativa uma habilidade: debita PE, incrementa uso. Retorna resultado para UI/log. */
  activateSpecAbility: (charId: string, abilityId: string) => Promise<{ ok: boolean; reason?: string; peSpent?: number; usesLeft?: number }>;
  /** Reseta contadores de uso por escopo (round/scene/rest_short/rest_long). */
  resetSpecAbilityUsage: (charId: string, scope: 'round' | 'scene' | 'rest_short' | 'rest_long') => void;
  /** Gasta pontos de atributo livres em vários atributos. Vincula snapshot a uma pendência. */
  spendAttributePoints: (id: string, spends: Record<string, number>, opts?: { linkChoiceId?: string }) => void;
  /** CAM: troca o núcleo ativo (Ação Bônus). Persiste snapshot e aplica fórmula de PV/PE. */
  switchCore: (id: string, targetCoreId: CoreId) => boolean;
  /** CAM: dano à Integridade da Alma (DAL) — propaga aos hpMax dos 3 núcleos. */
  applySoulDamage: (id: string, amount: number) => void;
  /** CAM: cura aplicada a um núcleo específico. Remove [DANIFICADO] se HP > 0. */
  healCore: (id: string, coreId: CoreId, amount: number) => void;
  /** CAM: marca núcleo ativo como caído (HP <= 0). Para uso após recusar a Reação. */
  markActiveCoreFallen: (id: string) => void;
  /** CAM: alterna o estado "Morrendo" (impede troca de núcleo). */
  setDying: (id: string, dying: boolean) => void;
  /**
   * Define manualmente o nível de Exaustão (0..6). Trata Lv 6 = morte instantânea
   * (HP=0, condição "morto") e aplica/reverte o desmaio quando a redução de HP
   * máximo derruba o HP atual a 0. Sincroniza condições automáticas e clampa.
   */
  setExhaustion: (charId: string, value: number) => void;
  /** Atalho: incrementa/decrementa Exaustão por delta (usa setExhaustion internamente). */
  bumpExhaustion: (charId: string, delta: number) => void;
  /** Distribui +/- 1 ponto numa aptidão amaldiçoada (vinculado a um tracker `aptitude_distribute`). */
  bumpAptitude: (charId: string, choiceId: string, key: AptitudeKey, delta: 1 | -1) => boolean;
  /** Adquire uma Aptidão de Aura (após validar pré-requisitos). */
  chooseAuraAptitude: (charId: string, auraId: string) => { ok: boolean; reason?: string };
  /** Remove uma Aptidão de Aura adquirida. */
  removeAuraAptitude: (charId: string, auraId: string) => void;
  /**
   * Persiste o elemento escolhido para Aura Elemental / Afinidade Ampliada.
   * Armazenado em `auraAptitudeUsage[<aptId>:element]` (string codificada).
   * Passe `element = null` para remover.
   */
  setAuraElement: (charId: string, auraId: string, element: DamageType | null) => void;
  /** Ativa uma Aptidão de Aura (debita PE e incrementa uso). */
  activateAuraAptitude: (charId: string, auraId: string) => { ok: boolean; reason?: string; peSpent?: number; usesLeft?: number };
  /**
   * Liga/desliga uma Aptidão de Aura do tipo TOGGLE (ou com peUpkeep).
   * Cria/remove um ActiveBuff sustentado com `id = aura:<auraId>` que cobra
   * `peCostPerRound` automaticamente via `tickBuffs`. Cobra `peCost` inicial.
   */
  toggleAuraAptitude: (charId: string, auraId: string) => { ok: boolean; reason?: string; active?: boolean; peSpent?: number };
  /** Reseta contadores de uso de Aptidões de Aura por escopo. */
  resetAuraAptitudeUsage: (charId: string, scope: 'round' | 'scene' | 'rest_short' | 'rest_long') => void;
  /** Adquire uma Aptidão de CL (após validar pré-requisitos). Consome 1 do pool `availableAuraChoices`. */
  chooseClAptitude: (charId: string, clId: string) => { ok: boolean; reason?: string };
  /** Remove uma Aptidão de CL adquirida. */
  removeClAptitude: (charId: string, clId: string) => void;
  /** Dotes Gerais — adiciona dote ao personagem (livre, sem custo de pool). */
  addDote: (charId: string, doteId: string) => { ok: boolean; reason?: string };
  /** Dotes Gerais — remove dote. */
  removeDote: (charId: string, doteId: string) => void;
  /** Dotes Gerais — usa o dote (deduz PE, incrementa contagem de uso). */
  useDote: (charId: string, doteId: string, opts?: { peSpent?: number }) => { ok: boolean; reason?: string };
  /** Dotes Gerais — toggle (Fúria Berserker, Posturas). */
  toggleDote: (charId: string, doteId: string) => void;
  /** Dotes Gerais — reseta usos por escopo. */
  resetDoteUsage: (charId: string, scope: 'rodada' | 'cena' | 'descanso-curto' | 'descanso-longo') => void;
  /** Sorte — gasta 1 ponto. */
  spendLuckyPoint: (charId: string) => { ok: boolean; reason?: string };
  /** Sorte — recupera 1 ponto (ex.: recebeu crítico). */
  restoreLuckyPoint: (charId: string) => void;
  /**
   * Ativa uma Aptidão de CL (família Controle e Leitura).
   * Debita PE, aplica escudo/flag conforme o tipo, registra log.
   * `params` carrega opções específicas de cada aptidão (peSpent, submodo etc).
   */
  activateClAptitude: (
    charId: string,
    clId: string,
    params: {
      peSpent?: number;
      resolution?: 'attack' | 'save';
      submodo?: 'movimento' | 'teste' | 'manobra' | 'pular';
      sustain?: boolean;
      cdAmaldicoada?: number;
      peOriginal?: number;
      peDuplicata?: number;
      rastreioSkill?: 'Investigação' | 'Percepção';
      alreadyKnown?: boolean;
      petalaMode?: 'ofensiva' | 'defensiva';
      /** Punho Divergente: 'armar' = aplicar metade agora; 'resolver' = consumir pendência. */
      punhoModo?: 'armar' | 'resolver';
      /** Punho Divergente armar: dano TOTAL do golpe desarmado já rolado. */
      danoTotal?: number;
      /** Punho Divergente resolver: bônus de Fortitude do alvo. */
      fortitudeAlvo?: number;
    }
  ) => Promise<{ ok: boolean; reason?: string; peSpent?: number; logMessage?: string; damageFormula?: string }>;
  /**
   * Aptidões DOM (Domínio): Revestimento, Anular Técnica, Expansões.
   * Reusa `clAptitudeUsage` para contar usos/descanso longo (ex.: Anular Técnica).
   */
  activateDomAptitude: (
    charId: string,
    domId: string,
    params: {
      sustain?: boolean;
      peInimigo?: number;
      feiticariaInimigo?: number;
      comAcertoGarantido?: boolean;
      semBarreiras?: boolean;
    }
  ) => Promise<{ ok: boolean; reason?: string; peSpent?: number; logMessage?: string }>;

  /**
   * Aptidões BAR (Barreira): Técnicas de Barreira (paredes), Cesta Oca, Cortina.
   */
  activateBarAptitude: (
    charId: string,
    barId: string,
    params: {
      paredes?: number;
      areaM?: number;
    }
  ) => { ok: boolean; reason?: string; peSpent?: number; logMessage?: string };
  /**
   * Aptidões ER (Energia Reversa) — modos pendentes de motor:
   * Fluxo Constante (gatilho de cura), Liberação de ER (toque), Canalizar ER (carga PER).
   */
  activateErAptitude: (
    charId: string,
    erId: string,
    params: {
      fluxoModo?: FluxoConstanteModo;
      perGasto?: number;
    }
  ) => { ok: boolean; reason?: string; peSpent?: number; logMessage?: string };
  /**
   * Aptidões SPECIAL com motor — atualmente apenas Domínio Simples
   * (criar / dano / dissipar). As outras (Raio Negro, Reversão, Técnica
   * Máxima, Faíscas) são passivas / meta-habilidades.
   */
  activateSpecialAptitude: (
    charId: string,
    specialId: string,
    params: {
      modo?: 'criar' | 'dano' | 'dissipar';
      gatilho?: 'bonus' | 'reacao';
      motivoDano?: 'concentracao_falha' | 'acerto_garantido_tick';
    }
  ) => { ok: boolean; reason?: string; peSpent?: number; logMessage?: string; quebrou?: boolean };
  /**
   * Aura Anuladora — tenta anular uma condição prestes a ser aplicada.
   * Custos: fraca 2 PE, média 4 PE, forte 6 PE, extrema 10 PE.
   * Limite: `usage.max = 'training'` por descanso longo.
   */
  tryNullifyCondition: (charId: string, tier: 'fraca' | 'media' | 'forte' | 'extrema') => { ok: boolean; reason?: string; peSpent?: number; usesLeft?: number };
  /**
   * Aura Absorção Elemental — arma absorção do elemento recebido.
   * Próximo ataque consome a flag e adiciona Xd6/d8/d10 (X = AU) do mesmo tipo.
   */
  armElementalAbsorption: (charId: string, element: DamageType) => { ok: boolean; reason?: string; au?: number };
  /** Limpa a Absorção Elemental armada (após o próximo ataque consumi-la). */
  consumeElementalAbsorption: (charId: string) => void;
  /**
   * Concentrar Aura — gasta 1 Ação e armazena AU como carga concentrada.
   * Próximo Golpe com Aura consome essa carga e soma +au como dano flat.
   */
  armConcentratedAura: (charId: string) => { ok: boolean; reason?: string; au?: number };
  /** Limpa a carga de Concentrar Aura após uso pelo Golpe com Aura. */
  consumeConcentratedAura: (charId: string) => { au: number };
  /**
   * Transferência de Aura — copia 1 aptidão de aura para o aliado por 1 rodada
   * (mantida por upkeep). Implementado como buff sustentado especial cujo
   * `targetName` carrega o `auraId` transferido.
   */
  transferAuraTo: (sourceId: string, allyId: string, auraId: string) => { ok: boolean; reason?: string };
  /** Remove a transferência de aura ativa originada por sourceId. */
  revokeTransferAura: (sourceId: string) => void;
  /**
   * Kokusen — incrementa stack de Consciência Absoluta e marca a cena.
   * Faíscas Negras: ativa buff de cena. Stack é limitada por Math.floor(CL/2) (+1 com Faíscas).
   * Recebe o `round` corrente do combate para gerenciar decay (1 rodada sem novo Kokusen → reset).
   */
  triggerKokusen: (charId: string, round: number) => { ok: boolean; reason?: string; newStacks?: number; threshold?: number };
  /** Reseta stacks de Kokusen e o buff de cena (chamado em endCombat / RestModal). */
  clearKokusenStacks: (charId: string) => void;
  /**
   * Cura em Grupo (ER) — debita PE por PER já gasto, e distribui o pool entre alvos.
   * `distribution` é um mapa charId → valor de cura.
   */
  applyGroupHealing: (
    casterId: string,
    perSpent: number,
    distribution: Record<string, number>,
  ) => { ok: boolean; reason?: string; peSpent?: number; healed?: Record<string, number> };
  /**
   * Energia Reversa (self) — cura o próprio personagem usando perSpent PER.
   * Devolve dados rolados para log.
   */
  castEnergiaReversaSelf: (
    charId: string,
    perSpent: number,
    /** Alvo da cura (padrão: o próprio). Outros exigem Liberação de ER. */
    targetId?: string,
    /** Medicina Infalível: quantos dados maximizar (gasta usos). */
    maximizeDice?: number,
  ) => Promise<{ ok: boolean; reason?: string; peSpent?: number; healed?: number; rolls?: number[]; mod?: number; key?: 'Presença' | 'Sabedoria' }>;
  /**
   * Regeneração Aprimorada (ER) — modos: ferimento(8), veneno(4), membro(3).
   * Se asFreeAction = true, custo é 10 PER (20 PE) e consome só Ação Livre.
   * Side-effect: cura HP rolando (perEquivalente*2)d8 + 2*Mod_Chave (perEquivalente = floor(perGasto/2)).
   */
  castRegeneracaoAprimorada: (
    charId: string,
    mode: 'ferimento' | 'veneno' | 'membro',
    asFreeAction: boolean,
  ) => Promise<{
    ok: boolean;
    reason?: string;
    peSpent?: number;
    perSpent?: number;
    sideHeal?: { rolls: number[]; mod: number; total: number; perEquivalente: number };
  }>;
  /**
   * Aura Redirecionadora — tenta redirecionar um ataque à distância que errou.
   * Custa 2 PE. Retorna o bônus aplicável à nova rolagem (1 + ½ AU).
   */
  redirectMissedAttack: (charId: string) => { ok: boolean; reason?: string; bonus?: number; peSpent?: number };
  /**
   * Aura Drenadora — ao matar um inimigo, ganha PV temporários (escCurrent) = Xd8 + mod CON,
   * onde X = AU. Acumulam. Retorna o roll para log.
   */
  triggerAuraDrenadora: (charId: string) => Promise<{ ok: boolean; reason?: string; rolls?: number[]; conMod?: number; total?: number }>;
  applyDamage: (id: string, rawDamage: number, damageType?: DamageType, opts?: OpcoesDano) => void;
  /**
   * Aplica cura. `source` controla o redutor FAH:
   * - 'cursed_energy_external' → cura de Energia Reversa vinda de TERCEIROS
   *   (será reduzida pela metade se o alvo for FAH).
   * - 'self_cursed_energy' → autocura via Energia Reversa própria (FAH paga 2 PE
   *   para curar integralmente — o store NÃO debita PE; quem chama deve fazer).
   * - 'vigor_maldito' / 'other' (default) → não sofre redutor.
   */
  applyHealing: (id: string, amount: number, source?: 'cursed_energy_external' | 'self_cursed_energy' | 'vigor_maldito' | 'other') => void;
  applyShield: (id: string, amount: number) => void;
  /**
   * Talento "Discurso Motivador" — aplica PV Temporário a aliados selecionados.
   * Cada criatura só pode receber o buff 1× entre Descansos Longos. Retorna
   * detalhes para o log.
   */
  applyDiscursoMotivador: (
    sourceId: string,
    targetIds: string[],
  ) => {
    ok: boolean;
    reason?: string;
    tempHP?: number;
    applied?: string[];
    skipped?: string[];
  };
  /** FAH: gasta `usesSpent` usos de Vigor Maldito; cura = (base+conMod)*usesSpent. Retorna detalhes pro log. */
  useVigorMaldito: (charId: string, usesSpent: number) => { ok: boolean; reason?: string; healed?: number; base?: number; conMod?: number; usesLeft?: number };
  /** Talento Favorecido pela Sorte: gasta 1 ponto de Sorte. */
  spendLuck: (charId: string) => { ok: boolean; reason?: string; remaining?: number };
  /** Talento Favorecido pela Sorte: recupera 1 ponto (ex.: nat20 inimigo). */
  recoverLuck: (charId: string) => void;
  /** Consome 1 ponto pendente de vantagem (chamado após rollAttack que aplicou a vantagem). */
  consumePendingLuckAdvantage: (charId: string) => void;
  /** FAH: gasta 1 uso de Alma Maldita; reduz dano à alma para metade (Lv<15) ou anula (Lv≥15). */
  useAlmaMaldita: (charId: string, rawSoulDamage: number) => { ok: boolean; reason?: string; reducedTo?: number; usesLeft?: number };
  /** Derivado: ação "Recuperação de Emergência" — recupera 2× Bônus de Treinamento de PE. 1×/dia. */
  useDerivadoEmergencyRecovery: (charId: string, inCombat: boolean) => { ok: boolean; reason?: string; recovered?: number };
  /** Inumaki: gasta 1 uso de "Olhos de Cobra e Presas". */
  useInumakiOlhosCobra: (charId: string) => { ok: boolean; reason?: string; usesLeft?: number };
  /** Restringido: gasta 1 uso de Resiliência Imediata; devolve dano evitado. */
  useRestringidoResiliencia: (charId: string) => { ok: boolean; reason?: string; reduced?: number; usesLeft?: number };
  /** FAH: notifica que o personagem PASSOU em TR contra um efeito tag 'Feitiço' → +1 tempPE. */
  notifyFahSavedVsSpell: (charId: string) => void;
  /**
   * Dispara uma Reação de Especialista em Técnica (Bloco A).
   * Centraliza custo de PE, ganho de tempPE e log narrativo. Não rastreia
   * limites de uso por rodada/descanso — confiamos no jogador. Retorna
   * { ok, reason?, log? } para a UI mostrar feedback.
   */
  triggerSpecReaction: (
    charId: string,
    reactionId:
      | 'tec-zelo-recompensador'
      | 'tec-abastecido-pelo-sangue'
      | 'tec-determinacao-energizada'
      | 'tec-incapaz-de-falhar'
      | 'tec-explosao-defensiva'
      | 'tec-passo-rapido'
      | 'tec-primeiro-disparo'
      | 'tec-correcao',
    payload?: { pe?: number; spellLevel?: number },
  ) => { ok: boolean; reason?: string; log?: string };
  addAttribute: (charId: string, attr: Attribute) => void;
  removeAttribute: (charId: string, attrId: string) => void;
  addSkill: (charId: string, skill: Attribute) => void;
  removeSkill: (charId: string, skillId: string) => void;
  addSavingThrow: (charId: string, st: Attribute) => void;
  removeSavingThrow: (charId: string, stId: string) => void;
  addPassive: (charId: string, passive: Passive) => void;
  removePassive: (charId: string, passiveId: string) => void;
  addSpell: (charId: string, spell: Spell) => void;
  updateSpell: (charId: string, spell: Spell) => void;
  removeSpell: (charId: string, spellId: string) => void;
  addBuff: (charId: string, buff: ActiveBuff) => void;
  removeBuff: (charId: string, buffId: string) => void;
  /** Remove all sustained buffs cast by a given source character (across every target). */
  removeSustainedBuffsFrom: (sourceCharId: string) => void;
  addCondition: (charId: string, condition: ActiveCondition) => void;
  removeCondition: (charId: string, conditionInstanceId: string) => void;
  tickBuffs: (charId: string) => void;
  tickConditions: (charId: string) => void;
  tickAllBuffs: () => void;
  tickRoundConditions: () => void;
  resetActions: () => void;
  /**
   * Registra o resultado de um ataque do personagem no turno atual.
   * Incrementa `attacksThisTurn` e atualiza `lastAttackHit`.
   * Usado pelo AttackPanel para automatizar `previousAttacksThisTurn`/`previousMissed`.
   */
  recordAttackResult: (charId: string, hit: boolean, opts?: { replaceLast?: boolean }) => void;
  /**
   * Zera os contadores de "memória de turno" de UM personagem
   * (`attacksThisTurn`, `lastAttackHit`, `weaponSwapsThisTurn`).
   * Usado pelo AttackPanel quando NÃO há combate ativo, para que o
   * mestre possa reiniciar a "rodada narrativa" sem precisar abrir
   * a iniciativa formal.
   */
  resetTurnStateFor: (charId: string) => void;
  resetAll: () => void;
  /**
   * Gasta 1 Dado de Vida (Descanso Curto): rola dXdaClasse + Mod CON, recupera HP.
   * Retorna o roll, o mod e o total curado.
   */
  spendHitDie: (charId: string) => Promise<{ ok: boolean; reason?: string; die?: number; roll?: number; conMod?: number; healed?: number }>;
  /**
   * Descanso Curto (2-4h):
   * - Recupera 50% do PE máximo.
   * - Reseta usos de habilidades/aptidões com escopo `rest_short`.
   * - Zera cooldowns de feitiços.
   * - Aciona "Economia de Energia" se possuída (rola 1d4 escalado).
   * (Cura por Dado de Vida é separada via `spendHitDie`.)
   */
  applyShortRest: (charId: string) => Promise<{ peRecovered: number; economiaRoll?: number }>;
  /**
   * Descanso Longo (8h):
   * - Modo Padrão: PV/PE/Dados de Vida cheios. Reseta `rest_short` E `rest_long`.
   *   Limpa escudo, hpSacrificedTotal, reduz Exaustão em 1.
   *   Aciona Economia de Energia (rola 1d6 escalado).
   * - Modo Crafting: cura/PE/HD = +50% (cap no máx). Demais resets idênticos.
   */
  applyLongRest: (charId: string, opts?: { crafting?: boolean }) => Promise<{
    hpRecovered: number;
    peRecovered: number;
    hitDiceRecovered: number;
    economiaRoll?: number;
    crafting?: boolean;
  }>;
  /**
   * Mestre concede um slot de descanso a uma ficha. O jogador só conseguirá
   * usar o botão "Descansar" na sua ficha se houver um grant — e apenas no
   * tipo concedido. Sobrescreve qualquer grant pendente.
   */
  grantRest: (charId: string, mode: 'short' | 'long') => void;
  /** Equipa/remove o slot de Venda (cobertura ocular). Dispara aoVendar/aoDescobrir. */
  setBlindfold: (charId: string, slot: string | null) => void;
  /** [Mestre] Habilita/desabilita o slot de Venda no card do personagem. */
  setHasBlindfoldSlot: (charId: string, enabled: boolean) => void;
  /** Limpa o grant de descanso (consumido ou cancelado). */
  clearRestGrant: (charId: string) => void;
  /**
   * Reset de "cena" para um personagem participante de combate.
   * Zera usos com `scope: 'scene'` (specAbility e aura), reseta hpSacrificedTotal
   * e limpa stacks/buff de Kokusen. Chamado em `endCombat` para cada participante.
   */
  resetSceneForCharacter: (charId: string) => void;
  /**
   * Verifica se a chave do dia atual (Chronos) difere de `lastDailyResetKey`
   * em cada ficha; quando difere, zera usos de habilidades/aptidões com
   * escopo `daily`. Idempotente — pode ser chamado várias vezes ao dia.
   */
  tickDailyReset: (currentDayKey: string) => void;
  /**
   * Sistema de Fome (PLAYER): processa horas decorridas no Chronos.
   * Cada hora: -1 barra de fome. Se fome chega a 0: +1 Exaustão e reseta para HUNGER_MAX.
   * `currentHourKey` deve ser monotonicamente crescente (year*8760 + ... + hours).
   * Idempotente — só processa o delta entre `lastHungerHourKey` e o atual.
   */
  tickHunger: (currentHourKey: number, charge?: boolean) => void;
  /** Define manualmente a fome de um personagem (UI / Mestre). Clamp 0..HUNGER_MAX. */
  setHunger: (charId: string, value: number) => void;
  /**
   * Marca um conjunto de feitiços do personagem com a flag `isPrepared` e
   * zera `pendingPreparedSpellSlots`. Sobrescreve seleções anteriores.
   */
  markPreparedSpells: (charId: string, spellIds: string[]) => void;
  /**
   * Consome 1 uso de um Talento. Valida `usage.max` e retorna `usesLeft`.
   * Não debita PE — talentos passivos/instantâneos resolvem custo na própria UI.
   */
  consumeTalentUse: (charId: string, talentId: string) => { ok: boolean; reason?: string; usesLeft?: number };
  /** Devolve 1 uso de Talento (Favorecido pela Sorte: inimigo rolou nat 20 contra você). */
  recoverTalentUse: (charId: string, talentId: string) => void;
  /** Atualiza uma escolha persistente do talento (ex.: variant A/B/C/D do Físico Aperfeiçoado). */
  setTalentChoice: (charId: string, talentId: string, key: string, value: string) => void;
  /**
   * Equipa armas nas mãos a partir do nome (mesmo nome do inventário).
   * Validações:
   *  - 1 arma de duas-mãos ocupa AMBOS os slots.
   *  - 2 armas distintas exigem que pelo menos uma seja Leve, OU o talento Empunhadura Dupla.
   *  - Equipar 1 arma = Ação Livre (sem custo). Equipar 2 = Ação Bônus.
   * Retorna {ok:false, reason} se inválido (sem mutar). Devolve `actionUsed` para log.
   */
  equipWeapons: (
    charId: string,
    payload: { mainHandName: string | null; offHandName?: string | null },
    ctx?: { round?: number; inCombat?: boolean },
  ) => { ok: boolean; reason?: string; actionUsed?: 'free' | 'bonus' | 'arremessador' | 'arsenal'; arsenalBonus?: boolean };
  /** Reseta usos de Talentos por escopo (round/scene/rest_short/rest_long/daily). */
  resetTalentUsage: (charId: string, scope: 'round' | 'scene' | 'rest_short' | 'rest_long' | 'daily') => void;
  /** Adiciona PE temporário (consumido antes do peCurrent; expira no fim da cena). */
  addTempPE: (charId: string, amount: number) => void;
  /**
   * Hook de início de turno do personagem para Habilidades de Especialização (Fase 2).
   *   • `tec-mestre-das-aptidoes`: reaplica `aptitudeOnlyTempPE = ⌊TB/2⌋`
   *     (não acumula; substitui o pool a cada rodada).
   * Idempotente — chamar sem a habilidade simplesmente zera o pool.
   */
  applyTurnStartSpecHooks: (charId: string) => void;
  /** Decrementa cooldown de Sacrifício pela Energia em N rodadas (chamado no fim da rodada). */
  tickSacrificioCooldown: () => void;
  /**
   * Conhecimento Aplicado — gasta `pe` PE (até floor(treino/2)) durante um
   * Teste de Resistência contra Feitiço. Retorna o bônus aplicado (+2/PE).
   */
  spendPEForResistance: (charId: string, pe: number) => { ok: boolean; reason?: string; bonus?: number; peSpent?: number };

  /**
   * Aura Controlada — gasta 1 PE para usar o Nível de Aptidão em Aura COMPLETO
   * (em vez do passivo de ½AU) numa rolagem específica de Furtividade.
   * Retorna o roll detalhado (d20 + bônus base + AU completo).
   */
  rollFurtividadeWithAuraBoost: (charId: string) => Promise<{
    ok: boolean;
    reason?: string;
    roll?: number;
    base?: number;
    auFull?: number;
    auHalfAlreadyApplied?: number;
    total?: number;
  }>;

  // ===== GRAPPLE ENGINE =====
  /**
   * Tenta agarrar `targetId` com `attackerId`. Rola Atletismo do agarrador
   * (com ½AU passivo de Aura de Contenção, se houver) vs maior entre
   * Atletismo/Acrobacia do alvo (TR de oposição). Se `spendPEForAdvantage`,
   * gasta 1 PE para vantagem na rolagem.
   * Em caso de sucesso: vincula bilateralmente (grappling/grappledBy).
   */
  grappleAttempt: (
    attackerId: string,
    targetId: string,
    spendPEForAdvantage?: boolean,
  ) => Promise<{
    ok: boolean;
    reason?: string;
    rollAtt?: number[];
    bonusAtt?: number;
    totalAtt?: number;
    rollDef?: number;
    bonusDef?: number;
    totalDef?: number;
    defSkill?: 'Atletismo' | 'Acrobacia';
    success?: boolean;
    advantageUsed?: boolean;
  }>;

  /**
   * `targetId` tenta escapar do agarre de `grapplerId`. TR Atletismo OU
   * Acrobacia (escolha do alvo) vs Atletismo+½AU do agarrador. Se
   * `spendPEForDisadvantage`, o agarrador gasta 1 PE para impor desvantagem
   * no escape.
   */
  escapeGrapple: (
    targetId: string,
    grapplerId: string,
    skill: 'Atletismo' | 'Acrobacia',
    spendPEForDisadvantage?: boolean,
  ) => Promise<{
    ok: boolean;
    reason?: string;
    rollDef?: number[];
    bonusDef?: number;
    totalDef?: number;
    rollAtt?: number;
    bonusAtt?: number;
    totalAtt?: number;
    success?: boolean;
    disadvantageUsed?: boolean;
  }>;

  /** Libera unilateralmente o agarre (ação livre do agarrador). */
  releaseGrapple: (attackerId: string, targetId: string) => void;

  /** Libera todos os agarres deste personagem (chamado ao morrer/desmaiar). */
  releaseAllGrapplesOf: (charId: string) => void;

  /** Predicado: este personagem está agarrado por alguém? */
  isGrappled: (charId: string) => boolean;
}

/**
 * Helper interno: consome `cost` PE priorizando `tempPE` e depois `peCurrent`.
 * Retorna o snapshot patch a ser mesclado no objeto do personagem.
 */
function spendPEPatch(c: Character, cost: number): { tempPE: number; peCurrent: number } {
  if (cost <= 0) return { tempPE: c.tempPE ?? 0, peCurrent: c.peCurrent };
  // 🪬 Omni: aplica redutor de custo de PE com piso mínimo (Seis Olhos etc.).
  const red = c.omniCostReduction?.pe;
  if (red && red.reduce > 0) {
    cost = Math.max(red.min ?? 1, cost - red.reduce);
  }
  const t0 = c.tempPE ?? 0;
  const fromTemp = Math.min(t0, cost);
  const remaining = cost - fromTemp;
  return {
    tempPE: t0 - fromTemp,
    peCurrent: Math.max(0, c.peCurrent - remaining),
  };
}

/**
 * Variante para gastos de **Aptidões Amaldiçoadas**: prioriza
 * `aptitudeOnlyTempPE` (pool dedicado de `tec-mestre-das-aptidoes`),
 * depois `tempPE`, depois `peCurrent`.
 */
function spendAptitudePEPatch(
  c: Character,
  cost: number,
): { aptitudeOnlyTempPE: number; tempPE: number; peCurrent: number } {
  if (cost <= 0) {
    return {
      aptitudeOnlyTempPE: c.aptitudeOnlyTempPE ?? 0,
      tempPE: c.tempPE ?? 0,
      peCurrent: c.peCurrent,
    };
  }
  const a0 = c.aptitudeOnlyTempPE ?? 0;
  const fromAptPool = Math.min(a0, cost);
  let remaining = cost - fromAptPool;
  const t0 = c.tempPE ?? 0;
  const fromTemp = Math.min(t0, remaining);
  remaining -= fromTemp;
  return {
    aptitudeOnlyTempPE: a0 - fromAptPool,
    tempPE: t0 - fromTemp,
    peCurrent: Math.max(0, c.peCurrent - remaining),
  };
}

function ensureRdByType(c: Character): Record<DamageType, number> {
  if (!c.rdByType) return createEmptyRdByType();
  return { ...createEmptyRdByType(), ...c.rdByType };
}

export const useCharacterStore = create<CharacterStore>()(
  persist(
    (set, get) => ({
      characters: [],
      isNameTaken: (name, excludeId) => {
        const norm = (name ?? '').trim().toLowerCase();
        if (!norm) return false;
        return get().characters.some(
          (c) => c.id !== excludeId && (c.name ?? '').trim().toLowerCase() === norm,
        );
      },
      addCharacter: (name, category, createdBy) =>
        set((state) => {
          const norm = (name ?? '').trim().toLowerCase();
          if (!norm) return state;
          if (state.characters.some((c) => (c.name ?? '').trim().toLowerCase() === norm)) {
            // Nome duplicado: não cria.
            return state;
          }
          const defaultAttrs = buildDefaultAttributes();
          const defaultSkills = buildDefaultSkills(defaultAttrs);
          const base: Character = {
            id: crypto.randomUUID(), name, category, createdBy, level: 1, ca: 10, baseDC: 10,
            hpCurrent: 20, hpMax: 20, peCurrent: 10, peMax: 10,
            escCurrent: 0, escMax: 0, rd: 0, rdByType: createEmptyRdByType(),
            slotsMax: 5, slotsCurrent: 0,
            attributes: defaultAttrs, skills: defaultSkills, savingThrows: DEFAULT_SAVING_THROWS.map(name => ({ id: crypto.randomUUID(), name, value: 0, linkedAttribute: undefined, trained: false, mastery: false })), passives: [], spells: [], equippedItems: [], customHitBonus: 0,
            meleeAttackBonus: 0, rangedAttackBonus: 0, cursedAttackBonus: 0,
            meleeLinkedAttr: '', rangedLinkedAttr: '', cursedLinkedAttr: '', dcLinkedAttr: '',
            meleeTrained: false, rangedTrained: false, cursedTrained: false,
            meleeMastery: false, rangedMastery: false, cursedMastery: false,
            initiativeBonus: 0, movement: 9, damageDiceLevel: 0, critMargin: 20, cdIncrease: 0, rollPenalty: 0,
            actionsMax: 1, actionsCurrent: 1,
            bonusActionsMax: 1, bonusActionsCurrent: 1,
            reactionsMax: 1, reactionsCurrent: 1,
            opportunityMax: 1, opportunityCurrent: 1,
            activeBuffs: [], activeConditions: [], vulnerabilities: [], immunities: [], characterClass: 'Não-Feiticeiro' as CharacterClass,
            specialization: 'Lutador' as Specialization, motivation: 'Medo' as any, origin: 'Inato' as Origin,
            accessorySlots: createEmptyAccessorySlots(), votos: '', hasEnergiaReversa: false,
            cursedAptitudes: createDefaultCursedAptitudes(), pendingAptitudePoints: 0,
          };
          // Não-Feiticeiro não recebe motores/pêndencias de especialização.
          const isFeiticeiro = base.characterClass === 'Feiticeiro';
          const lut = isFeiticeiro ? applyLutadorProgression(base, 1, base.specialization, 0) : { patch: {}, newTrackers: [] };
          const tec = isFeiticeiro ? applyTecnicaProgression(base, 1, base.specialization, 0) : { patch: {}, newTrackers: [] };
          const initialTrackers = [
            ...(base.pendingLevelChoices ?? []),
            ...lut.newTrackers,
            ...tec.newTrackers,
          ];
          const initialAuraChoices = initialTrackers.filter(t => t.kind === 'pending_aptitude_choice').length;
          return ({
            characters: [...state.characters, finalizeFAH({
              ...base,
              ...lut.patch,
              ...tec.patch,
              pendingLevelChoices: initialTrackers,
              availableAuraChoices: initialAuraChoices,
            })],
          });
        }),
      addTemporaryCharacter: (name, createdBy, profileId) => {
        const norm = (name ?? '').trim().toLowerCase();
        if (!norm) return null;
        if (get().characters.some((c) => (c.name ?? '').trim().toLowerCase() === norm)) return null;
        const defaultAttrs = buildDefaultAttributes();
        const defaultSkills = buildDefaultSkills(defaultAttrs);
        const id = crypto.randomUUID();
        const base: Character = {
          id, name: name.trim(), category: 'PLAYER' as CharacterCategory, createdBy,
          ...(profileId ? { profileId } : {}),
          temporary: true,
          notes: '',
          level: 1, ca: 10, baseDC: 10,
          hpCurrent: 10, hpMax: 10, peCurrent: 0, peMax: 0,
          escCurrent: 0, escMax: 0, rd: 0, rdByType: createEmptyRdByType(),
          slotsMax: 5, slotsCurrent: 0,
          attributes: defaultAttrs,
          skills: defaultSkills,
          savingThrows: DEFAULT_SAVING_THROWS.map((nm) => ({
            id: crypto.randomUUID(), name: nm, value: 0, linkedAttribute: undefined,
            trained: false, mastery: false,
          })),
          passives: [], spells: [], equippedItems: [], customHitBonus: 0,
          meleeAttackBonus: 0, rangedAttackBonus: 0, cursedAttackBonus: 0,
          meleeLinkedAttr: '', rangedLinkedAttr: '', cursedLinkedAttr: '', dcLinkedAttr: '',
          meleeTrained: false, rangedTrained: false, cursedTrained: false,
          meleeMastery: false, rangedMastery: false, cursedMastery: false,
          initiativeBonus: 0, movement: 9, damageDiceLevel: 0, critMargin: 20, cdIncrease: 0, rollPenalty: 0,
          actionsMax: 1, actionsCurrent: 1,
          bonusActionsMax: 1, bonusActionsCurrent: 1,
          reactionsMax: 1, reactionsCurrent: 1,
          opportunityMax: 1, opportunityCurrent: 1,
          activeBuffs: [], activeConditions: [], vulnerabilities: [], immunities: [],
          characterClass: 'Não-Feiticeiro' as CharacterClass,
          specialization: 'Lutador' as Specialization,
          motivation: 'Medo' as any, origin: 'Inato' as Origin,
          accessorySlots: createEmptyAccessorySlots(), votos: '', hasEnergiaReversa: false,
          cursedAptitudes: createDefaultCursedAptitudes(), pendingAptitudePoints: 0,
        };
        set((state) => ({ characters: [...state.characters, base] }));
        return id;
      },
      removeCharacter: (id) => { markCharacterDeleted(id); set((state) => ({ characters: state.characters.filter((c) => c.id !== id) })); },
      updateCharacter: (id, updates) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== id) return c;
          // Bloqueia rename para um nome já usado por outra ficha (case-insensitive).
          if (typeof updates.name === 'string') {
            const norm = updates.name.trim().toLowerCase();
            if (
              norm &&
              state.characters.some(
                (other) => other.id !== id && (other.name ?? '').trim().toLowerCase() === norm,
              )
            ) {
              const { name: _drop, ...rest } = updates;
              updates = rest as Partial<Character>;
            }
          }
          const allowEnemyLevelUpdate = (updates as any).__allowEnemyLevelUpdate === true;
          if (allowEnemyLevelUpdate) {
            const { __allowEnemyLevelUpdate: _dropFlag, ...rest } = updates as any;
            updates = rest as Partial<Character>;
          }
          if (c.category === 'INIMIGO' && typeof updates.level === 'number' && !allowEnemyLevelUpdate) {
            const { level: _dropLevel, ...rest } = updates;
            updates = rest as Partial<Character>;
          }
          let merged: Character = { ...c, ...updates };
          if (typeof updates.escCurrent === 'number' && updates.protecoesOmni === undefined && c.protecoesOmni?.length) {
            merged.protecoesOmni = consumirProtecoesOmni(ajustarProtecoesOmni(c), Math.max(0, (c.escCurrent ?? 0) - updates.escCurrent));
          }
          // Assumir Postura: ficar Caído/incapacitado encerra a postura de vez.
          if (merged.posturaAtiva && quebraPostura(merged)) merged = { ...merged, posturaAtiva: null };
          const classChanged = updates.characterClass && updates.characterClass !== c.characterClass;
          if (merged.characterClass !== 'Feiticeiro') {
            merged = {
              ...merged,
              tecnicaFundamentos: undefined,
              tecnicaFoco: undefined,
              keyAttribute: undefined,
              empolgacaoLevel: undefined,
              empolgacaoStartLevel: undefined,
              empolgacaoDiceTable: undefined,
              lutadorManeuvers: undefined,
              unlocksFreeUnarmed: false,
              passives: (merged.passives ?? []).filter((p: any) => p?.source !== '__lutador_auto__' && p?.source !== '__tecnica_auto__'),
              pendingLevelChoices: (merged.pendingLevelChoices ?? []).filter((p: any) => !String(p?.kind ?? '').startsWith('lutador_') && !String(p?.kind ?? '').startsWith('tecnica_')),
            } as Character;
          }
          const attrsChanged = updates.attributes && updates.attributes !== c.attributes;
          const specChanged = updates.specialization && updates.specialization !== c.specialization;
          const levelChanged = typeof updates.level === 'number' && updates.level !== c.level;
          // Fichas temporárias e criaturas têm vida/PE definidos à mão: não recalcular.
          if ((attrsChanged || specChanged || classChanged) && !merged.temporary && !merged.isGrimorioCreature) {
            const conMod = getConMod(merged);
            const startBase = merged.hpStartingBase ?? c.hpMax - (getConMod(c) * c.level);
            const history = merged.levelHistory ?? [];
            const newHpMax = recalcHpMaxFromHistory(startBase, history, conMod, merged.level, 0);
            // PE: agora 100% determinístico pela especialização + nível + atributo-chave.
            // `pePerLevelGains` continua somado como bônus manual extra (legado).
            const peGains = merged.pePerLevelGains ?? 0;
            const newPeMax = recalcPeMaxBySpec(merged.level, merged.specialization, merged.attributes, peGains, merged.keyAttribute);
            merged.hpMax = newHpMax;
            merged.hpCurrent = Math.min(merged.hpCurrent, newHpMax);
            merged.peMax = newPeMax;
            merged.peCurrent = Math.min(merged.peCurrent, newPeMax);
          }
          if (merged.isGrimorioCreature) {
            merged = stripCreatureProgression(merged);
          } else if (specChanged || levelChanged || classChanged) {
            // Se mudou de spec/classe, regenera os trackers desde o Nv 1 (oldLevel=0).
            // Caso contrário, é um level-up incremental e usa o nível anterior.
            const oldLevelForTrackers = (specChanged || classChanged) ? 0 : c.level;
            const lut = applyLutadorProgression(merged, merged.level, merged.specialization, oldLevelForTrackers);
            merged = { ...merged, ...lut.patch } as Character;
            const tec = applyTecnicaProgression(merged, merged.level, merged.specialization, oldLevelForTrackers);
            merged = { ...merged, ...tec.patch } as Character;
            // Mescla novos trackers gerados às pendências existentes (sem duplicar).
            const existing = merged.pendingLevelChoices ?? [];
            const generated = [...lut.newTrackers, ...tec.newTrackers];
            // Quando troca de spec, remove trackers antigos da spec anterior.
            const filteredExisting = (specChanged || classChanged)
              ? existing.filter((p: any) => !String(p?.kind ?? '').startsWith('lutador_') && !String(p?.kind ?? '').startsWith('tecnica_'))
              : existing;
            const existingIds = new Set(filteredExisting.map(p => p.id));
            const merged2Trackers = [...filteredExisting, ...generated.filter(g => !existingIds.has(g.id))];
            // Recalcula pontos de catálogo de aptidão a partir dos trackers gerados nesta troca.
            const newAptitudeChoices = generated.filter(t => t.kind === 'pending_aptitude_choice').length;
            const prevPool = (specChanged || classChanged) ? 0 : (merged.availableAuraChoices ?? 0);
            merged = {
              ...merged,
              pendingLevelChoices: merged2Trackers,
              availableAuraChoices: prevPool + newAptitudeChoices,
            } as Character;
          }
          // Migração FAH: se origem virou (ou continua) FAH, garante campos novos
          // e recalcula MAX no nível atual quando o nível mudou.
          if (merged.origin === 'Feto Amaldiçoada Híbrido (FAH)') {
            merged = finalizeFAH(merged);
          }
          return merged;
        }),
      })),
      applyLevelUp: (id, payload) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== id) return c;
          if (c.category === 'INIMIGO') return c;
          const newLevel = Math.min(MAX_LEVEL, c.level + 1);
          if (newLevel === c.level) return c;
          const conMod = getConMod(c);
          const newHistory: LevelHistoryEntry[] = [
            ...(c.levelHistory ?? []),
            { level: newLevel, hpRollBase: payload.hpRollBase, conModSnapshot: conMod },
          ];
          const startBase = c.hpStartingBase ?? c.hpMax - (conMod * c.level);
          const newHpMax = recalcHpMaxFromHistory(startBase, newHistory, conMod, newLevel, 0);
          const hpDelta = newHpMax - c.hpMax;
          const newPeGains = (c.pePerLevelGains ?? 0) + (payload.pePerLevel ?? 0);
          const newPeMax = recalcPeMaxBySpec(newLevel, c.specialization, c.attributes, newPeGains, c.keyAttribute);
          const peDelta = newPeMax - c.peMax;

          // ===== ANTI-FARM: tenta restaurar pendências arquivadas deste nível =====
          // Se o personagem já passou por este nível antes (foi descido e está subindo
          // de novo), as pendências resolvidas voltam JÁ RESOLVIDAS e seus efeitos são
          // reaplicados — sem gerar novas escolhas.
          const archived = c.archivedLevelChoices ?? [];
          const restored = archived.filter(p => p.level === newLevel);
          const remainingArchive = archived.filter(p => p.level !== newLevel);

          let availableAttrPoints = c.availableAttrPoints ?? 0;
          let availableTrainings = c.availableTrainings ?? 0;
          let availableMastery = c.availableMastery ?? 0;
          let availableSpecAbilities = c.availableSpecAbilities ?? 0;
          let pendingTalents = c.pendingTalents ?? [];
          let attrCaps = c.attrCaps ? { ...c.attrCaps } : undefined;
          let attributes = c.attributes;
          let skills = c.skills;

          for (const ch of restored) {
            const eff = ch.appliedEffect;
            if (!ch.resolved || !eff) continue;
            if (eff.attrPointsDelta) availableAttrPoints += eff.attrPointsDelta;
            if (eff.trainingsDelta) availableTrainings += eff.trainingsDelta;
            if (eff.masteryDelta) availableMastery += eff.masteryDelta;
            if (eff.specAbilitiesDelta) availableSpecAbilities += eff.specAbilitiesDelta;
            if (eff.pendingTalentId) {
              pendingTalents = [...pendingTalents, { id: eff.pendingTalentId, level: ch.level, source: 'level' }];
            }
            if (eff.attrSpends) {
              attributes = attributes.map(a => {
                const add = eff.attrSpends![a.name] ?? 0;
                return add > 0 ? { ...a, value: a.value + add } : a;
              });
              const totalSpent = Object.values(eff.attrSpends).reduce((s, v) => s + (v || 0), 0);
              availableAttrPoints = Math.max(0, availableAttrPoints - totalSpent);
            }
            if (eff.attrDirect) {
              attributes = attributes.map(a => {
                const add = eff.attrDirect![a.name] ?? 0;
                return add ? { ...a, value: a.value + add } : a;
              });
            }
            if (eff.capDelta) {
              attrCaps = attrCaps ? { ...attrCaps } : {};
              for (const [k, v] of Object.entries(eff.capDelta)) {
                attrCaps[k] = (attrCaps[k] ?? 20) + v;
              }
            }
            if (eff.promotedSkillId) {
              skills = skills.map(s => s.id === eff.promotedSkillId ? { ...s, mastery: true, trained: true } : s);
            }
            if (eff.trainedSkillId) {
              skills = skills.map(s => s.id === eff.trainedSkillId ? { ...s, trained: true } : s);
            }
          }

          // Só gera trackers novos se não havia arquivo deste nível.
          const afinidade = (c.chosenTalents ?? []).find(t => t.id === 'tal-afinidade-tecnica');
          const generated = restored.length > 0
            ? []
            : [
                ...buildLevelUpTrackers(c.level, newLevel, c.specialization, c.characterClass, c.origin)
                  .filter(t => t.kind !== 'hp_roll_or_fixed'),
                ...buildAfinidadeTecnicaTrackers(c.level, newLevel, afinidade?.level ?? null),
              ];

          // ===== MOTORES DE CLASSE — injeção automática =====
          const baseForEngines = { ...c, attributes, skills, level: newLevel } as any;
          const isFeiticeiro = c.characterClass === 'Feiticeiro';
          const lut = isFeiticeiro
            ? applyLutadorProgression(baseForEngines, newLevel, c.specialization, c.level)
            : { patch: {}, newTrackers: [] };
          const tec = isFeiticeiro
            ? applyTecnicaProgression(baseForEngines, newLevel, c.specialization, c.level)
            : { patch: {}, newTrackers: [] };

          // ===== MOTOR DE ORIGEM — bônus de cl\u00e3/origem por n\u00edvel =====
          const origRes = applyOriginLevelUp(baseForEngines, newLevel, c.level);

          const newPending: PendingLevelChoice[] = [
            ...(c.pendingLevelChoices ?? []).filter(p => !p.resolved),
            ...restored,
            ...generated,
            ...(restored.length > 0 ? [] : [...lut.newTrackers, ...tec.newTrackers, ...origRes.newTrackers]),
          ];

          // Acumula pontos de aptidão pendentes a partir dos novos trackers `aptitude_distribute`.
          const newAptitudePts = generated
            .filter(t => t.kind === 'aptitude_distribute')
            .reduce((s, t) => s + (Number(t.value) || 0), 0);
          const pendingAptitudePoints = (c.pendingAptitudePoints ?? 0) + newAptitudePts;

          // Acumula pontos de escolha do CATÁLOGO de Aptidões (1 por tracker pending_aptitude_choice).
          // Inclui trackers gerados pelo motor de classe (Especialista em Técnica injeta 1 por nível).
          const allNewTrackers = [...generated, ...lut.newTrackers, ...tec.newTrackers];
          const newAptitudeChoices = allNewTrackers.filter(t => t.kind === 'pending_aptitude_choice').length;
          const availableAuraChoices = (c.availableAuraChoices ?? 0) + newAptitudeChoices;

          // ANTI-FARM: NÃO somar o delta ao current. Apenas elevamos o teto (max).
          // Se o jogador quiser recuperar, usa cura/descanso. Assim subir-descer-subir
          // não gera ganhos infinitos de PV/PE atuais.
          void hpDelta; void peDelta;

          // Bônus aditivos da origem (Gojo PE par / Kamo HP). origRes.patch.hpMax,
          // se vier, foi computado como (c.hpMax + delta) — extraímos o delta
          // para somar ao newHpMax/newPeMax do histórico (sem dupla contagem).
          const origHpDelta = origRes.patch.hpMax !== undefined
            ? (origRes.patch.hpMax - (c.hpMax ?? 0))
            : 0;
          const baseTecPe = tec.patch.peMax ?? newPeMax;
          const origPeDelta = origRes.patch.peMax !== undefined
            ? (origRes.patch.peMax - (c.peMax ?? 0))
            : 0;
          const finalHpMax = newHpMax + origHpDelta;
          const finalPeMax = baseTecPe + origPeDelta;

          if (origRes.notes.length) {
            // Empilha notas no log de combate p/ feedback ao jogador.
            for (const n of origRes.notes) {
              try { useLogStore.getState().addLog('combat', `📜 ${c.name}: ${n}`); } catch { /* noop */ }
            }
          }

          return finalizeFAH({
            ...c,
            ...lut.patch,
            ...tec.patch,
            ...origRes.patch,
            level: newLevel,
            attributes,
            skills,
            attrCaps,
            availableAttrPoints,
            availableTrainings,
            availableMastery,
            availableSpecAbilities,
            pendingTalents,
            hpMax: finalHpMax,
            hpCurrent: Math.min(c.hpCurrent, finalHpMax),
            peMax: finalPeMax,
            peCurrent: Math.min(c.peCurrent, finalPeMax),
            trainingBonus: getTrainingBonusByLevel(newLevel),
            hitDiceMax: getHitDiceMax(newLevel),
            hitDiceCurrent: Math.min((c.hitDiceCurrent ?? c.hitDiceMax ?? c.level) + 1, getHitDiceMax(newLevel)),
            hpStartingBase: startBase,
            peStartingBase: c.peStartingBase ?? c.peMax,
            pePerLevelGains: newPeGains,
            levelHistory: newHistory,
            hpClassDie: c.hpClassDie ?? getClassHitDie(c.characterClass, c.specialization),
            pendingLevelChoices: newPending,
            archivedLevelChoices: remainingArchive,
            cursedAptitudes: c.cursedAptitudes ?? createDefaultCursedAptitudes(),
            pendingAptitudePoints,
            availableAuraChoices,
          });
        }),
      })),
      resolvePendingLevelChoice: (id, choiceId, value, appliedEffect) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== id) return c;
          const choice = (c.pendingLevelChoices ?? []).find(p => p.id === choiceId);
          if (!choice) return c;

          let availableAttrPoints = c.availableAttrPoints ?? 0;
          let availableTrainings = c.availableTrainings ?? 0;
          let availableMastery = c.availableMastery ?? 0;
          let availableSpecAbilities = c.availableSpecAbilities ?? 0;
          let availableSavingTrainings = c.availableSavingTrainings ?? 0;
          let availableSavingMastery = c.availableSavingMastery ?? 0;
          let pendingTalents = c.pendingTalents ?? [];
          let attrCaps = c.attrCaps;
          let lutadorManeuvers = c.lutadorManeuvers ?? [];
          let tecnicaFundamentos = c.tecnicaFundamentos ?? [];
          let tecnicaFoco = c.tecnicaFoco;
          let zeninFocusedSpells = c.zeninFocusedSpells ?? [];
          let attributes = c.attributes;
          const effect: import('@/lib/levelEngine').PendingChoiceAppliedEffect = appliedEffect ? { ...appliedEffect } : {};

          switch (choice.kind) {
            case 'asi_milestone':
              if (value === 'A') {
                availableAttrPoints += 2;
                effect.attrPointsDelta = (effect.attrPointsDelta ?? 0) + 2;
              } else if (value === 'B') {
                const tid = crypto.randomUUID();
                pendingTalents = [...pendingTalents, { id: tid, level: choice.level, source: 'asi' }];
                effect.pendingTalentId = tid;
              }
              break;

            case 'derivado_attr_milestone': {
              // Desenvolvimento Inesperado: +1 direto no atributo escolhido
              // e +1 no limite DESSE atributo (nunca vira ponto solto).
              if (value && c.attributes.some(a => a.name === value)) {
                const DEFAULT_CAP = 20;
                const currentCap = attrCaps?.[value] ?? DEFAULT_CAP;
                attrCaps = { ...(attrCaps ?? {}), [value]: currentCap + 1 };
                attributes = attributes.map(a => a.name === value ? { ...a, value: a.value + 1 } : a);
                effect.attrDirect = { ...(effect.attrDirect ?? {}), [value]: 1 };
                effect.capDelta = { ...(effect.capDelta ?? {}), [value]: 1 };
              }
              break;
            }

            case 'zenin_focused_spell': {
              // value = JSON { spellId, bonus: 'damage'|'healing'|'range'|'cd' }
              try {
                const data = value ? JSON.parse(value) : null;
                if (data?.spellId && data?.bonus) {
                  zeninFocusedSpells = [
                    ...zeninFocusedSpells,
                    { spellId: data.spellId, bonus: data.bonus, chosenAtLevel: choice.level },
                  ];
                }
              } catch { /* noop */ }
              break;
            }

              if (value === 'A') { availableTrainings += 2; effect.trainingsDelta = 2; }
              else if (value === 'B') { availableMastery += 1; effect.masteryDelta = 1; }
              break;

            case 'skill_or_talent':
              if (value === 'talent' || value?.startsWith('[Talento]')) {
                const tid = crypto.randomUUID();
                pendingTalents = [...pendingTalents, { id: tid, level: choice.level, source: 'level' }];
                effect.pendingTalentId = tid;
              } else if (value === 'skill') {
                // Credita 1 ponto no pool de Habilidades de Especialização.
                availableSpecAbilities += 1;
                effect.specAbilitiesDelta = (effect.specAbilitiesDelta ?? 0) + 1;
              }
              break;

            // ===== Lutador =====
            case 'lutador_initial_maneuvers':
            case 'lutador_extra_maneuver': {
              // value = JSON com array de manobras escolhidas neste passo.
              try {
                const picks: string[] = value ? JSON.parse(value) : [];
                const merged = Array.from(new Set([...(lutadorManeuvers ?? []), ...picks]));
                lutadorManeuvers = merged;
              } catch { /* noop */ }
              break;
            }

            case 'lutador_save_mastery': {
              // value = JSON { mastery: 'Fortitude'|'Reflexos', trained: 'NomeTR' }
              try {
                const data = value ? JSON.parse(value) : null;
                if (data) {
                  availableSavingMastery += 1;
                  availableSavingTrainings += 1;
                  effect.masteryDelta = (effect.masteryDelta ?? 0) + 1;
                  effect.trainingsDelta = (effect.trainingsDelta ?? 0) + 1;
                }
              } catch { /* noop */ }
              break;
            }

            // ===== Especialista em Técnica =====
            case 'tecnica_fundamentos_initial':
            case 'tecnica_fundamentos_extra': {
              // value = JSON com array de fundamentos selecionados nesta etapa.
              try {
                const picks: string[] = value ? JSON.parse(value) : [];
                tecnicaFundamentos = Array.from(new Set([...(tecnicaFundamentos ?? []), ...picks]));
              } catch { /* noop */ }
              break;
            }

            case 'tecnica_foco': {
              if (value === 'Destruição' || value === 'Economia' || value === 'Refino') {
                tecnicaFoco = value;
              }
              break;
            }

            case 'tecnica_refino_grant': {
              // value = nome livre do feitiço/aptidão grátis aprendido (auditoria).
              break;
            }

            case 'tecnica_extra_spell': {
              // value = nome livre do feitiço aprendido. Apenas registra na pendência.
              // O feitiço em si é cadastrado na aba "Feitiços" do CharacterCard.
              break;
            }

            case 'tecnica_save_mastery': {
              // value = JSON { mastery: 'Astúcia'|'Vontade', trained: 'NomeTR' }
              // Mecânica idêntica ao Lutador: credita 1 maestria + 1 treino de TR.
              try {
                const data = value ? JSON.parse(value) : null;
                if (data) {
                  availableSavingMastery += 1;
                  availableSavingTrainings += 1;
                  effect.masteryDelta = (effect.masteryDelta ?? 0) + 1;
                  effect.trainingsDelta = (effect.trainingsDelta ?? 0) + 1;
                }
              } catch { /* noop */ }
              break;
            }

            default:
              break;
          }

          // Refino (Foco): enfileira pendência extra "Feitiço/Aptidão grátis".
          const updatedPending = (c.pendingLevelChoices ?? []).map(p =>
            p.id === choiceId ? { ...p, resolved: true, value, appliedEffect: effect } : p,
          );
          const extraPending: PendingLevelChoice[] = [];
          if (choice.kind === 'tecnica_foco' && value === 'Refino') {
            const alreadyHasGrant = updatedPending.some(p => (p as any).kind === 'tecnica_refino_grant' && !p.resolved);
            if (!alreadyHasGrant) {
              extraPending.push({
                id: `tec-refino-grant-${crypto.randomUUID()}`,
                level: c.level,
                kind: 'tecnica_refino_grant' as any,
                label: `Nv ${c.level} (Técnica/Refino): Aprender 1 Feitiço OU 1 Aptidão Amaldiçoada grátis`,
                resolved: false,
              });
            }
          }

          return {
            ...c,
            availableAttrPoints,
            availableTrainings,
            availableMastery,
            availableSpecAbilities,
            availableSavingTrainings,
            availableSavingMastery,
            pendingTalents,
            attributes,
            attrCaps,
            lutadorManeuvers,
            tecnicaFundamentos,
            tecnicaFoco,
            zeninFocusedSpells,
            pendingLevelChoices: [...updatedPending, ...extraPending],
          };
        }),
      })),
      removePendingLevelChoice: (id, choiceId) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== id) return c;
          return {
            ...c,
            pendingLevelChoices: (c.pendingLevelChoices ?? []).filter(p => p.id !== choiceId),
          };
        }),
      })),
      chooseSpecAbility: (charId, abilityId, opts) => {
        let success = false;
        const skipPool = !!opts?.skipPoolConsumption;
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const skillOnly = c.availableSkillOnly ?? 0;
            const shared = c.availableSpecAbilities ?? 0;
            if (!skipPool && skillOnly <= 0 && shared <= 0) return c;
            const ability = getSpecAbilityById(abilityId);
            const already = (c.chosenSpecAbilities ?? []).some(a => a.abilityId === abilityId);
            if (already && !ability?.allowMultiplePurchases) return c;
            success = true;
            // Consome do pool exclusivo primeiro; só toca o compartilhado se necessário.
            const useSkillOnly = !skipPool && skillOnly > 0;
            const consumeShared = !skipPool && !useSkillOnly;
            const updated: Character = {
              ...c,
              availableSkillOnly: useSkillOnly ? skillOnly - 1 : skillOnly,
              availableSpecAbilities: consumeShared ? shared - 1 : shared,
              chosenSpecAbilities: [
                ...(c.chosenSpecAbilities ?? []),
                { abilityId, chosenAtLevel: c.level },
              ],
            };
            // Reaplica motor de Técnica para que efeitos passivos derivados
            // (Reforço Amaldiçoado, Olhar Preciso, Energia Inacabável,
            // Reação Rápida etc.) sejam refletidos em CD/PE/Iniciativa
            // imediatamente após a compra.
            if (updated.characterClass === 'Feiticeiro' && updated.specialization === 'Especialista em Técnica') {
              const tec = applyTecnicaProgression(updated, updated.level, updated.specialization, updated.level);
              return { ...updated, ...tec.patch };
            }
            return updated;
          }),
        }));
        return success;
      },
      removeSpecAbility: (charId, abilityId) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== charId) return c;
          const list = c.chosenSpecAbilities ?? [];
          if (!list.some(a => a.abilityId === abilityId)) return c;
          const usage = { ...(c.specAbilityUsage ?? {}) };
          delete usage[abilityId];
          // Limpa também a escolha permanente associada (se houver).
          const choices = { ...(c.specAbilityChoices ?? {}) };
          delete choices[abilityId];
          // Devolve ao pool exclusivo de Habilidades (preferência ao específico).
          const updated: Character = {
            ...c,
            availableSkillOnly: (c.availableSkillOnly ?? 0) + 1,
            chosenSpecAbilities: list.filter(a => a.abilityId !== abilityId),
            specAbilityUsage: usage,
            specAbilityChoices: choices,
          };
          // Reaplica motor de Técnica para reverter bônus passivos.
          if (updated.characterClass === 'Feiticeiro' && updated.specialization === 'Especialista em Técnica') {
            const tec = applyTecnicaProgression(updated, updated.level, updated.specialization, updated.level);
            return { ...updated, ...tec.patch };
          }
          return updated;
        }),
      })),
      setSpecAbilityChoice: (charId, abilityId, value) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== charId) return c;
          // Só grava se a habilidade está realmente escolhida.
          const owns = (c.chosenSpecAbilities ?? []).some(a => a.abilityId === abilityId);
          if (!owns) return c;
          return {
            ...c,
            specAbilityChoices: {
              ...(c.specAbilityChoices ?? {}),
              [abilityId]: value,
            },
          };
        }),
      })),
      addTalent: (charId, talentId, level, choices, source) => {
        let success = false;
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            success = true;
            const extraPending = buildAfinidadeOnAcquire(talentId, level, c);
            const mut = applyTalentAcquisitionMutations(c, talentId, choices);
            return {
              ...c,
              attributes: mut.attributes,
              attrCaps: mut.attrCaps,
              skills: mut.skills,
              luckMax: mut.luckMax,
              luckCurrent: mut.luckCurrent,
              cursedAptitudes: mut.cursedAptitudes ?? c.cursedAptitudes,
              chosenTalents: [
                ...(c.chosenTalents ?? []),
                { id: talentId, level, choices, source: source ?? 'level' },
              ],
              pendingLevelChoices: [
                ...(c.pendingLevelChoices ?? []),
                ...extraPending,
              ],
            };
          }),
        }));
        return success;
      },
      /**
       * Adquire um Talento gastando do pool: consome do `availableTalentOnly`
       * primeiro; senão do pool compartilhado `availableSpecAbilities`.
       * Retorna false se não há saldo em nenhum dos dois.
       */
      chooseTalentFromPool: (charId: string, talentId: string, level: number, choices?: Record<string, string>) => {
        let success = false;
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const talentOnly = c.availableTalentOnly ?? 0;
            const shared = c.availableSpecAbilities ?? 0;
            if (talentOnly <= 0 && shared <= 0) return c;
            success = true;
            const useTalentOnly = talentOnly > 0;
            const extraPending = buildAfinidadeOnAcquire(talentId, level, c);
            const mut = applyTalentAcquisitionMutations(c, talentId, choices);
            return {
              ...c,
              attributes: mut.attributes,
              attrCaps: mut.attrCaps,
              skills: mut.skills,
              luckMax: mut.luckMax,
              luckCurrent: mut.luckCurrent,
              cursedAptitudes: mut.cursedAptitudes ?? c.cursedAptitudes,
              availableTalentOnly: useTalentOnly ? talentOnly - 1 : talentOnly,
              availableSpecAbilities: useTalentOnly ? shared : shared - 1,
              chosenTalents: [
                ...(c.chosenTalents ?? []),
                { id: talentId, level, choices, source: 'level' },
              ],
              pendingLevelChoices: [
                ...(c.pendingLevelChoices ?? []),
                ...extraPending,
              ],
            };
          }),
        }));
        return success;
      },
      removeTalent: (charId, talentId) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== charId) return c;
          const list = c.chosenTalents ?? [];
          const idx = list.findIndex(t => t.id === talentId);
          if (idx < 0) return c;
          const removed = list[idx];
          const next = [...list];
          next.splice(idx, 1);
          // Limpa pendências de Afinidade com Técnica não-resolvidas (id contém '-afinidade-spell-').
          const cleanedPending = talentId === 'tal-afinidade-tecnica'
            ? (c.pendingLevelChoices ?? []).filter(
                p => !(p.id.includes('-afinidade-spell-') && !p.resolved),
              )
            : (c.pendingLevelChoices ?? []);
          // Reverte Estudo Amaldiçoado: subtrai +1 de cada aptidão escolhida.
          let cursedApts = c.cursedAptitudes;
          if (talentId === 'tal-estudo-amaldicoado' && removed.choices?.aptitudes) {
            const apts = removed.choices.aptitudes.split(',').map(s => s.trim());
            const map = { ...(cursedApts ?? createDefaultCursedAptitudes()) };
            for (const k of apts) {
              if (k in map) {
                (map as any)[k] = Math.max(APTITUDE_MIN, ((map as any)[k] ?? 0) - 1);
              }
            }
            cursedApts = map;
          }
          // Reverte mutações da aquisição (Incremento, Quebra de Limites, Alma Inquebrável, Sorte).
          const rev = revertTalentAcquisitionMutations(c, talentId, removed.choices);
          // Devolve ao pool exclusivo de Talentos.
          return {
            ...c,
            attributes: rev.attributes,
            attrCaps: rev.attrCaps,
            skills: rev.skills,
            luckMax: rev.luckMax,
            luckCurrent: rev.luckCurrent,
            availableTalentOnly: (c.availableTalentOnly ?? 0) + 1,
            chosenTalents: next,
            pendingLevelChoices: cleanedPending,
            cursedAptitudes: rev.cursedAptitudes ?? cursedApts,
          };
        }),
      })),
      applyEstudoAmaldicoado: (charId, aptitudes) => {
        if (aptitudes[0] === aptitudes[1]) {
          return { ok: false, reason: 'Escolha 2 Aptidões diferentes.' };
        }
        let result: { ok: boolean; reason?: string } = { ok: true };
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const ct = (c.chosenTalents ?? []).find(t => t.id === 'tal-estudo-amaldicoado');
            if (!ct) {
              result = { ok: false, reason: 'Talento não foi adquirido.' };
              return c;
            }
            if (ct.choices?.aptitudes) {
              result = { ok: false, reason: 'Escolha já registrada.' };
              return c;
            }
            const apts = { ...(c.cursedAptitudes ?? createDefaultCursedAptitudes()) };
            for (const k of aptitudes) {
              const cur = (apts as any)[k] ?? 0;
              (apts as any)[k] = Math.min(APTITUDE_MAX, cur + 1);
            }
            const newChosen = (c.chosenTalents ?? []).map(t =>
              t.id === 'tal-estudo-amaldicoado'
                ? { ...t, choices: { ...(t.choices ?? {}), aptitudes: aptitudes.join(',') } }
                : t,
            );
            return { ...c, cursedAptitudes: apts, chosenTalents: newChosen };
          }),
        }));
        return result;
      },
      vincularOmniAtivo: (charId, payload) => {
        let success = false;
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const atuais = c.omniAtivos ?? [];
            // Idempotência: mesma instância não pode vincular duas vezes.
            if (atuais.some((a) => a.instanceId === payload.instanceId)) return c;
            success = true;
            return {
              ...c,
              omniAtivos: [
                ...atuais,
                {
                  id: `omni-link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
                  categoria: payload.categoria,
                  entidadeId: payload.entidadeId,
                  instanceId: payload.instanceId,
                  vinculadoEm: Date.now(),
                },
              ],
            };
          }),
        }));
        return success;
      },
      desvincularOmniAtivo: (charId, vinculoId) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== charId) return c;
          const atuais = c.omniAtivos ?? [];
          const next = atuais.filter((a) => a.id !== vinculoId);
          if (next.length === atuais.length) return c;
          return { ...c, omniAtivos: next };
        }),
      })),
      activateSpecAbility: async (charId, abilityId) => {
        const c = get().characters.find(x => x.id === charId);
        if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
        const ab = getSpecAbilityById(abilityId);
        if (!ab) return { ok: false, reason: 'Habilidade desconhecida.' };
        if (ab.activation === 'passive') return { ok: false, reason: 'Habilidade passiva — sempre ativa.' };

        // ─── Caso especial: Economia de Energia ───
        // Ação Comum: transfere toda a reserva (economiaPEReserve) para peCurrent
        // (cap em peMax) e zera a reserva. Não requer escolha do jogador, não
        // gasta PE e não consome usos por descanso (a recarga é via descanso).
        if (abilityId === 'tec-economia-de-energia') {
          // Economia Avançada (Tier 10) → transferência vira Ação Bônus.
          const hasAvancada = (c.chosenSpecAbilities ?? []).some(a => a.abilityId === 'tec-economia-de-energia-avancada');
          if (hasAvancada) {
            if ((c.bonusActionsCurrent ?? 0) <= 0) return { ok: false, reason: 'Ação Bônus insuficiente.' };
          } else {
            if (c.actionsCurrent <= 0) return { ok: false, reason: 'Ação Comum insuficiente.' };
          }
          const reserve = c.economiaPEReserve ?? 0;
          if (reserve <= 0) {
            return { ok: false, reason: 'Reserva vazia. Faça um descanso (curto ou longo) para recarregar.' };
          }
          const newPe = Math.min(c.peMax, c.peCurrent + reserve);
          const recovered = newPe - c.peCurrent;
          set((s) => ({
            characters: s.characters.map((x) =>
              x.id !== charId ? x : {
                ...x,
                peCurrent: newPe,
                economiaPEReserve: 0,
                actionsCurrent: hasAvancada ? x.actionsCurrent : x.actionsCurrent - 1,
                bonusActionsCurrent: hasAvancada ? Math.max(0, (x.bonusActionsCurrent ?? 0) - 1) : x.bonusActionsCurrent,
              },
            ),
          }));
          return { ok: true, peSpent: -recovered };
        }

        // Check PE (tempPE conta junto com peCurrent)
        const peCost = ab.peCost ?? 0;
        const totalPE = (c.tempPE ?? 0) + c.peCurrent;
        if (peCost > 0 && totalPE < peCost) {
          return { ok: false, reason: `PE insuficiente (precisa ${peCost}, tem ${totalPE}).` };
        }

        // Cooldown de Sacrifício pela Energia
        if ((ab.onActivateEffects ?? []).some((e) => e.type === 'sacrifice_hp_for_pe')) {
          const cd = c.sacrificioCooldownRounds ?? 0;
          if (cd > 0) return { ok: false, reason: `Em cooldown (${cd} rodada(s) restantes).` };
        }

        // Check Actions
        if (ab.activation === 'action' && c.actionsCurrent <= 0) {
          return { ok: false, reason: 'Ação Comum insuficiente.' };
        }
        if (ab.activation === 'bonus' && c.bonusActionsCurrent <= 0) {
          return { ok: false, reason: 'Ação Bônus insuficiente.' };
        }
        if (ab.activation === 'reaction' && c.reactionsCurrent <= 0) {
          return { ok: false, reason: 'Reação insuficiente.' };
        }

        const used = c.specAbilityUsage?.[abilityId] ?? 0;
        let usesLeft: number | undefined;
        if (ab.usage) {
          const max = resolveSpecUsageMax(ab.usage, { trainingBonus: getTrainingBonusByLevel(c.level), level: c.level });
          if (used >= max) return { ok: false, reason: `Sem usos disponíveis (${used}/${max}).` };
          usesLeft = max - (used + 1);
        }
        // Pré-rolar todas as recuperações de PE via dado (3D physics) antes do set().
        const recoverPeRolls: number[] = [];
        for (const eff of ab.onActivateEffects ?? []) {
          if (eff.type === 'recover_pe_dice') {
            const steps = Math.max(0, Math.floor((c.level - 1) / Math.max(1, eff.stepLevels)));
            const sides = Math.min(12, eff.baseDieSides + steps * 2);
            const { total } = await rollDiceCom(charId, `1d${sides}`);
            recoverPeRolls.push(total);
          }
        }
        set((s) => ({
          characters: s.characters.map((x) => {
            if (x.id !== charId) return x;
            const peSpend = spendPEPatch(x, peCost);
            // Process onActivateEffects (declarative side-effects)
            let exhDelta = 0;
            let tempPEDelta = 0;
            let sacrificioCdAdd = 0;
            let sacrificioHpCost = 0;
            let sacrificioPeGain = 0;
            let empolgacaoPenaltyDelta = 0;
            let setEmpolgacaoLevel: number | undefined;
            let recoverPeAmount = 0;
            let recoverIdx = 0;
            for (const eff of ab.onActivateEffects ?? []) {
              if (eff.type === 'exhaustion') exhDelta += eff.delta;
              else if (eff.type === 'temp_pe') {
                const tb = getTrainingBonusByLevel(x.level);
                const amt = eff.amount === 'training' ? tb : eff.amount === 'training_half' ? Math.floor(tb / 2) : eff.amount;
                tempPEDelta += amt;
              } else if (eff.type === 'sacrifice_hp_for_pe') {
                sacrificioHpCost += eff.hpCost;
                sacrificioPeGain += eff.peGain;
                sacrificioCdAdd = Math.max(sacrificioCdAdd, Math.ceil(eff.hpCost / eff.cooldownPerHp));
              } else if (eff.type === 'empolgacao_max_penalty') {
                empolgacaoPenaltyDelta += eff.delta;
              } else if (eff.type === 'set_empolgacao_level') {
                setEmpolgacaoLevel = eff.value;
              } else if (eff.type === 'recover_pe_dice') {
                const roll = recoverPeRolls[recoverIdx++] ?? 0;
                const keyMod = eff.addKeyMod ? getSpecKeyMod(x) : 0;
                recoverPeAmount += roll + keyMod;
              }
            }
            const baseTemp = peSpend.tempPE + tempPEDelta;
            const basePe = Math.min(x.peMax, peSpend.peCurrent + sacrificioPeGain + recoverPeAmount);
            const newHp = Math.max(0, x.hpCurrent - sacrificioHpCost);
            const newSacTotal = (x.hpSacrificedTotal ?? 0) + sacrificioHpCost;
            // Auto-Exaustão: se totalSacrificadoNaCena cruzar hpMax/2, +1 Exaustão (1×/cena)
            const sacExhTriggered = x.sacrificioExhaustionTriggered ?? false;
            const sacExhAuto =
              sacrificioHpCost > 0 && !sacExhTriggered && newSacTotal > Math.floor(x.hpMax / 2);
            const totalExhDelta = exhDelta + (sacExhAuto ? 1 : 0);
            return {
              ...x,
              peCurrent: basePe,
              tempPE: baseTemp,
              hpCurrent: newHp,
              hpSacrificedTotal: newSacTotal,
              exhaustionLevel: Math.max(0, (x.exhaustionLevel ?? 0) + totalExhDelta),
              sacrificioExhaustionTriggered: sacExhAuto ? true : sacExhTriggered,
              empolgacaoMaxPenalty: Math.max(0, (x.empolgacaoMaxPenalty ?? 0) + empolgacaoPenaltyDelta),
              empolgacaoLevel: setEmpolgacaoLevel ?? x.empolgacaoLevel,
              sacrificioCooldownRounds: sacrificioCdAdd > 0
                ? Math.max(x.sacrificioCooldownRounds ?? 0, sacrificioCdAdd)
                : (x.sacrificioCooldownRounds ?? 0),
              actionsCurrent: ab.activation === 'action' ? x.actionsCurrent - 1 : x.actionsCurrent,
              bonusActionsCurrent: ab.activation === 'bonus' ? x.bonusActionsCurrent - 1 : x.bonusActionsCurrent,
              reactionsCurrent: ab.activation === 'reaction' ? x.reactionsCurrent - 1 : x.reactionsCurrent,
              specAbilityUsage: {
                ...(x.specAbilityUsage ?? {}),
                [abilityId]: (x.specAbilityUsage?.[abilityId] ?? 0) + 1,
              },
            };
          }),
        }));
        return { ok: true, peSpent: peCost, usesLeft };
      },
      resetSpecAbilityUsage: (charId, scope) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== charId) return c;
          const cur = c.specAbilityUsage ?? {};
          const next: Record<string, number> = {};
          for (const [aid, used] of Object.entries(cur)) {
            const ab = getSpecAbilityById(aid);
            if (!ab?.usage || ab.usage.scope !== scope) {
              next[aid] = used;
            }
          }
          return { ...c, specAbilityUsage: next };
        }),
      })),
      spendAttributePoints: (id, spends, opts) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== id) return c;
          const totalSpent = Object.values(spends).reduce((s, v) => s + (v || 0), 0);
          if (totalSpent <= 0) return c;
          const newAttrs = c.attributes.map(a => {
            const add = spends[a.name] ?? 0;
            return add > 0 ? { ...a, value: a.value + add } : a;
          });
          const newAvail = Math.max(0, (c.availableAttrPoints ?? 0) - totalSpent);
          let newPending = c.pendingLevelChoices ?? [];
          if (opts?.linkChoiceId) {
            newPending = newPending.map(p => {
              if (p.id !== opts.linkChoiceId) return p;
              const prev = p.appliedEffect ?? {};
              const mergedSpends = { ...(prev.attrSpends ?? {}) };
              for (const [k, v] of Object.entries(spends)) {
                if (v > 0) mergedSpends[k] = (mergedSpends[k] ?? 0) + v;
              }
              return { ...p, appliedEffect: { ...prev, attrSpends: mergedSpends } };
            });
          }
          return { ...c, attributes: newAttrs, availableAttrPoints: newAvail, pendingLevelChoices: newPending };
        }),
      })),
      // applyLevelDown removido: progressão de nível é irreversível para evitar farm de bônus.
      applyDamage: (id, rawDamage, damageType, opts) => {
        const cadeia = reservarPassoOmni(opts?.cadeia);
        if (!cadeia) return;
        opts = { ...opts, cadeia };
        return executarNaCadeiaOmni(cadeia, () => {
        damageType = resolverTipoDano(damageType);
        const totalDamage = Math.max(0, rawDamage);
        let rdApplied = 0;
        let finalDamage = 0;
        let damageResolved = false;
        // Fase 9 — captura "antes/depois" para detectar gatilho de Absorção Elemental.
        const NON_ELEMENTAL = new Set<DamageType>(['DCO', 'DP', 'DI', 'DPS', 'DAL']);
        const beforeChar = get().characters.find((cc) => cc.id === id);

        // ─── Especialista — Estilo do Interceptador (redução armada) ─────────
        if (beforeChar?.interceptGuard && totalDamage > 0 && !opts?.tags?.includes('__interceptado')) {
          const g = beforeChar.interceptGuard;
          const reduced = Math.max(0, totalDamage - g.amount);
          set((s) => ({ characters: s.characters.map((cc) => cc.id === id ? { ...cc, interceptGuard: null } : cc) }));
          try { useLogStore.getState().addLog('combat', `🗡️ ${g.byName} intercepta: dano em ${beforeChar.name} ${totalDamage} → ${reduced} (−${Math.min(g.amount, totalDamage)}).`); } catch { /* noop */ }
          if (reduced <= 0) return;
          get().applyDamage(id, reduced, damageType, { ...opts, tags: [...(opts?.tags ?? []), '__interceptado'] });
          return;
        }

        // ─── Especialista — Postura da Lua (reação reduz dano de ataque pelo nível) ─
        if (beforeChar && opts?.attackerId && totalDamage > 0 && !opts?.tags?.includes('__lua')) {
          const red = luaReducao(beforeChar);
          if (red > 0) {
            // Pergunta ao jogador se usa a reação; o dano fica pendente até decidir.
            setTimeout(() => {
              import('@/stores/useReactionStore').then(({ useReactionStore }) => {
                useReactionStore.getState().enqueue({
                  charId: beforeChar.id,
                  charName: beforeChar.name,
                  kind: 'lua_reacao_offer',
                  message: `🌙 ${beforeChar.name} foi atingido (${totalDamage} de dano). Usar a reação da Postura da Lua? Reduz ${red} e permite Andar e Desengajar.`,
                  payload: { luaDamage: totalDamage, luaDamageType: damageType, luaReducao: red, luaOpts: { ...(opts ?? {}) } as Record<string, unknown> },
                });
              });
            }, 0);
            return;
          }
        }

        // ─── FAH — Alma Maldita (prompt antes de aplicar dano à Alma) ─────────
        // Antes de aplicar DAL, se o alvo é FAH e tem usos disponíveis, enfileira
        // prompt para o jogador decidir gastar 1 uso (reduz à metade ou anula).
        if (
          beforeChar &&
          damageType === 'DAL' &&
          isFahOrigin(beforeChar) &&
          (beforeChar.almaMalditaUses ?? 0) > 0 &&
          !opts?.tags?.includes('__alma_maldita_resolved')
        ) {
          setTimeout(() => {
            import('@/stores/useReactionStore').then(({ useReactionStore }) => {
              useReactionStore.getState().enqueue({
                charId: beforeChar.id,
                charName: beforeChar.name,
                kind: 'fah_alma_maldita_offer',
                message: `${beforeChar.name} sofrerá ${rawDamage} de dano à Alma — Alma Maldita disponível (${beforeChar.almaMalditaUses}/${beforeChar.almaMalditaMax}).`,
                payload: { soulDamageRaw: rawDamage, pendingSoulDamage: rawDamage, soulDamageOpts: { ...opts, attack: opts?.attack ? { ...opts.attack } : undefined, tags: opts?.tags ? [...opts.tags] : undefined } },
              });
            });
          }, 0);
          return; // bloqueia aplicação até o prompt ser resolvido
        }

        // ─── FAH — Anatomia Incompreensível em crítico/furtivo ────────────────
        if (
          beforeChar &&
          isFahOrigin(beforeChar) &&
          (opts?.tags?.includes('critical') || opts?.tags?.includes('furtivo')) &&
          !opts?.tags?.includes('__anat_incompr_resolved')
        ) {
          setTimeout(() => {
            import('@/stores/useReactionStore').then(({ useReactionStore }) => {
              useReactionStore.getState().enqueue({
                charId: beforeChar.id,
                charName: beforeChar.name,
                kind: 'fah_anatomia_incompr_offer',
                message: `${beforeChar.name} foi atingido por crítico/furtivo (${rawDamage} ${damageType ?? '?'}) — Anatomia Incompreensível pode mitigar.`,
                payload: { critDamageRaw: rawDamage, critDamageType: damageType, cursedDC: calcCursedDC(beforeChar) },
              });
            });
          }, 0);
        }

        // ─── Omni-Engine: gatilho REATIVO ao receber dano ───────────────
        // Roda antes do set para que efeitos como `bloqueio_total` cheguem
        // a tempo de absorver este golpe.
        //
        // 🔑 Pré-semeia `omniFlags.dano_pendente = rawDamage` para que
        // scripts limpos como `anular dano_recebido` (= definir 0 em
        // dano_pendente) ou `reduzir 5 em dano_recebido` consigam mexer
        // diretamente no dano deste hit. Após o disparo dos triggers,
        // relemos o valor: 0 → absorção total; N < raw → dano reduzido.
        // Snapshot desta resolução: o pre-hook ainda não conhece dano final.
        const atacanteDano = opts?.attackerId ? get().characters.find((cc) => cc.id === opts.attackerId) : undefined;
        const mapaDano = useMapStore.getState();
        const distanciaDano = opts?.attackerId && beforeChar
          ? distanceBetweenChars(opts.attackerId, id, mapaDano.entities, mapaDano.gridConfig, {
              casterProfileId: atacanteDano?.profileId, targetProfileId: beforeChar.profileId,
            })
          : null;
        const contextoDanoInicial = Object.freeze({
          ...montarMetadadosDano(opts, distanciaDano, damageType),
          valor_inicial: totalDamage,
          id_origem: opts?.attackerId ? 1 : 0,
          id_alvo: beforeChar ? 1 : 0,
        });
        console.group(`[applyDamage] ${beforeChar?.name ?? id} ← ${rawDamage} ${damageType ?? ''}`);
        console.log('flagsAntes', beforeChar?.omniFlags);
        if (beforeChar) {
          const flagsSeed = { ...(beforeChar.omniFlags ?? {}), dano_pendente: rawDamage };
          get().updateCharacter(id, { omniFlags: flagsSeed });
        }
        try {
          dispararGatilhoEfeitosItens('aoSofrerDano', {
            usuarioId: id,
            alvoId: opts?.attackerId,
            cena: { dano: rawDamage, dano_pendente: rawDamage, dano_recebido: rawDamage },
            dano: contextoDanoInicial,
          });
        } catch (err) {
          console.warn('[applyDamage] erro no disparador:', err);
        }

        // Re-lê o personagem após os triggers (podem ter setado bloqueio_total
        // OU mexido em dano_pendente diretamente).
        const charAposTrigger = get().characters.find((c) => c.id === id);
        console.log('flagsDepois', charAposTrigger?.omniFlags);

        // 🛡️ Bloqueio Total clássico (compat retroativo).
        if (charAposTrigger && (charAposTrigger.omniFlags?.bloqueio_total ?? 0) >= 1) {
          const flags = { ...(charAposTrigger.omniFlags ?? {}), bloqueio_total: 0, dano_pendente: 0 };
          get().updateCharacter(id, { omniFlags: flags });
          console.log('🛡️ DANO ABSORVIDO por bloqueio_total — abortando applyDamage');
          console.groupEnd();
          try {
            useLogStore.getState().addLog('system', `🛡️ ${charAposTrigger.name} absorveu ${rawDamage} de dano com Bloqueio Total`);
          } catch { /* noop */ }
          return;
        }

        // 🔑 Mutação de `dano_pendente`: o script ditou um novo valor.
        let danoEfetivo = rawDamage;
        if (charAposTrigger) {
          const pend = charAposTrigger.omniFlags?.dano_pendente;
          if (typeof pend === 'number' && pend !== rawDamage) {
            // Limpa a flag (consumida) e usa o novo valor.
            const flags = { ...(charAposTrigger.omniFlags ?? {}), dano_pendente: 0 };
            get().updateCharacter(id, { omniFlags: flags });
            if (pend <= 0) {
              console.log('🛡️ DANO ANULADO via dano_pendente=0 — abortando applyDamage');
              console.groupEnd();
              try {
                useLogStore.getState().addLog('system', `🛡️ ${charAposTrigger.name} anulou ${rawDamage} de dano (dano_recebido)`);
              } catch { /* noop */ }
              return;
            }
            console.log(`✂️ DANO REDUZIDO via dano_pendente: ${rawDamage} → ${pend}`);
            danoEfetivo = Math.max(0, Math.round(pend));
            try {
              useLogStore.getState().addLog('system', `✂️ ${charAposTrigger.name} reduziu o dano de ${rawDamage} → ${danoEfetivo}`);
            } catch { /* noop */ }
          } else {
            // Sem mutação — limpa a seed silenciosamente.
            const flags = { ...(charAposTrigger.omniFlags ?? {}), dano_pendente: 0 };
            get().updateCharacter(id, { omniFlags: flags });
          }
        }
        console.log(`→ dano prossegue: ${danoEfetivo}`);
        console.groupEnd();

        // Substitui rawDamage pelo dano efetivo daqui pra frente.
        rawDamage = danoEfetivo;

        // Snapshot pré-set para diff de dano (Cobrir-se reativo).
        const preSet = get().characters.find((c) => c.id === id);
        const preEsc = preSet?.escCurrent ?? 0;
        const preHp = preSet?.hpCurrent ?? 0;
        const entidadesOmniAtuais = useOmniEntidadesStore.getState().entidades;
        const mitigacoesOmni = useInventoryStore.getState().listEquipped(id)
          .filter((item) => item.entity.slotType && item.entity.slotType !== 'nenhum')
          .map((item) => entidadesOmniAtuais[item.entity.id] ?? item.entity);

        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== id) return c;
            const immunes = [...(c.immunities || []), ...mitigacoesOmni.flatMap((item) => item.imunidades_dano ?? [])];
            if (damageType && immunes.includes(damageType) && !opts?.ignoresResistance) {
              damageResolved = true;
              return c;
            }
            // CAM: dano DAL (na alma) é absorvido pela Integridade da Alma e reduz
            // o hpMax dos 3 núcleos simultaneamente. Não usa RD comum.
            if (damageType === 'DAL' && isCamActive(c)) {
              const soulPatch = applySoulDamagePure(c, rawDamage);
              finalDamage = rawDamage;
              damageResolved = true;
              return { ...c, ...soulPatch };
            }
            const activeBuffs = c.activeBuffs || [];
            const buffRD = activeBuffs.filter(b => b.type === 'rd').reduce((s, b) => s + b.value, 0);
            const negacaoRD = activeBuffs.filter(b => b.type === 'negacaoRd').reduce((s, b) => s + b.value, 0);

            // tec-revestimento-constante: RD geral exceto dano na alma.
            const specChoiceAgg = aggregateSpecChoices(c);
            const revestimentoRD = damageType === 'DAL' ? 0 : (specChoiceAgg.rdAllExceptSoul ?? 0);

            // Escudo equipado: RD base do escudo (Mestre Defensivo amplifica se já proficiente).
            // Não aplica a Dano de Alma (DAL).
            const equippedShield = getShieldById(c.equippedShieldId);
            const tBonusesForRd = aggregateTalentBonuses(c);
            const shieldRD = (equippedShield && damageType !== 'DAL')
              ? effectiveShieldRD(equippedShield, { mestreDefensivo: tBonusesForRd.shieldProficient })
              : 0;

            const rdByType = ensureRdByType(c);
            const typeRd = damageType ? (rdByType[damageType] || 0) : 0;
            // RD geral + RD por tipo somam (não se substituem).
            const baseRd = (c.rd || 0) + typeRd;
            const effectiveRd = opts?.ignoresRD ? 0 : Math.max(0, baseRd + buffRD + negacaoRD + revestimentoRD + shieldRD - Math.max(0, opts?.rdIgnore ?? 0));

            let damageFinal = Math.max(0, rawDamage - effectiveRd);
            rdApplied = Math.min(rawDamage, effectiveRd);
            const vulns = [...(c.vulnerabilities || []), ...mitigacoesOmni.flatMap((item) => item.vulnerabilidades ?? [])];
            const resistencias = mitigacoesOmni.flatMap((item) => item.resistencias ?? []);
            const vulneravel = !!damageType && vulns.includes(damageType);
            const resistente = !!damageType && resistencias.includes(damageType);
            // Resistência e vulnerabilidade do mesmo tipo se anulam. Caso contrário,
            // aplicam metade ou ×1,5 após RD, com arredondamento para baixo.
            if (!opts?.ignoresResistance && vulneravel !== resistente) {
              if (resistente) damageFinal = Math.floor(damageFinal / 2);
              else damageFinal = Math.floor(damageFinal * 1.5);
            }
            finalDamage = damageFinal;
            damageResolved = true;
            let newEsc = c.escCurrent;
            let newHp = c.hpCurrent;
            if (damageFinal <= newEsc) { newEsc -= damageFinal; }
            else { const overflow = damageFinal - newEsc; newEsc = 0; newHp -= overflow; }
            const protecoesOmni = consumirProtecoesOmni(ajustarProtecoesOmni(c), Math.max(0, c.escCurrent - newEsc));
            // CAM: sincroniza HP do snapshot do núcleo ativo.
            if (isCamActive(c) && c.activeCoreId) {
              const newCores = (c.cores || []).map(co =>
                co.id === c.activeCoreId ? { ...co, hpCurrent: newHp } : co,
              );
              return { ...c, escCurrent: newEsc, protecoesOmni, hpCurrent: newHp, cores: newCores };
            }
            return { ...c, escCurrent: newEsc, protecoesOmni, hpCurrent: newHp };
          }),
        }));

        if (beforeChar && damageResolved) {
          try {
            useLogStore.getState().addLog('combat', formatDamageBreakdown(beforeChar.name, {
              total: totalDamage,
              rd: rdApplied,
              final: finalDamage,
              damageType,
            }));
          } catch { /* noop */ }
        }

        // ─── Especialista — Renovação pelo Sangue (alvo reduzido a 0 PV) ─────
        // Se o dano zerou os PV do alvo e há um atacante identificado que seja
        // Especialista em Combate Nv 6+, ele recupera 1 PE (até o máximo).
        if (damageResolved && opts?.attackerId) {
          const alvoDepois = get().characters.find((c) => c.id === id);
          const atacante = get().characters.find((c) => c.id === opts.attackerId);
          if (alvoDepois && (alvoDepois.hpCurrent ?? 0) <= 0 && atacante && renovacaoSangueAtiva(atacante)) {
            const ok = aplicarRenovacao(atacante, get().updateCharacter);
            if (ok) {
              try { useLogStore.getState().addLog('combat', `🩸 Renovação pelo Sangue: ${atacante.name} reduziu ${alvoDepois.name} a 0 PV e recupera 1 PE.`); } catch { /* noop */ }
            }
          }
        }

        // ─── CL — Cobrir-se reativo (após dano comprometer Esc/HP) ──────────
        // Se o personagem tem a aptidão `cl-cobrir-se`, PE disponível e algum
        // dano foi efetivamente sofrido, enfileira prompt para usar a reação
        // — o handler do overlay reverte parte do dano via PVTs.
        const postSet = get().characters.find((c) => c.id === id);
        if (
          postSet &&
          (postSet.chosenClAptitudes ?? []).includes('cl-cobrir-se') &&
          (postSet.peCurrent ?? 0) > 0 &&
          !opts?.tags?.includes('__cobrir_se_resolved') &&
          damageType !== 'DAL'
        ) {
          const escLost = Math.max(0, preEsc - postSet.escCurrent);
          const hpLost = Math.max(0, preHp - postSet.hpCurrent);
          const dealt = escLost + hpLost;
          if (dealt > 0) {
            const hasAvanc = (postSet.chosenClAptitudes ?? []).includes('cl-cobertura-avancada');
            const cl = getClLevel(postSet);
            const specBonus = aggregateSpecChoices(postSet).cobrirSeMaxPeBonus;
            const maxPe = Math.min(2 + cl * 2 + specBonus, postSet.peCurrent ?? 0);
            const perPe = hasAvanc ? 8 : 4;
            if (maxPe > 0) {
              setTimeout(() => {
                import('@/stores/useReactionStore').then(({ useReactionStore }) => {
                  useReactionStore.getState().enqueue({
                    charId: postSet.id,
                    charName: postSet.name,
                    kind: 'cobrir_se_offer',
                    message: `${postSet.name} sofreu ${dealt} de dano — Cobrir-se disponível (até ${maxPe} PE × ${perPe} PVTs).`,
                    payload: {
                      damageDealt: dealt,
                      hpLost,
                      escLost,
                      maxPe,
                      peAvailable: postSet.peCurrent ?? 0,
                      perPe,
                      hasCoberturaAvancada: hasAvanc,
                    },
                  });
                });
              }, 0);
            }
          }
        }

        // ─── Suporte — Protetor (aliado adjacente sofreu dano) ─────────────
        // Se um Suporte com a habilidade, escudo equipado e PE estiver a até
        // 1,5 m do alvo, oferece a redução retroativa (Xd10 + mod) ao dono da
        // ficha dele. A pergunta e a rolagem ficam no ProtetorPromptDialog.
        const protDealt = postSet
          ? Math.max(0, preEsc - postSet.escCurrent) + Math.max(0, preHp - postSet.hpCurrent)
          : 0;
        if (postSet && protDealt > 0 && damageType !== 'DAL') {
          const dealt = protDealt;
          setTimeout(() => {
            void Promise.all([import('@/lib/suporteProtetor'), import('@/stores/useMapStore')]).then(
              ([prot, mapMod]) => {
                const { entities, gridConfig } = mapMod.useMapStore.getState();
                const all = get().characters;
                const sup = prot.findProtetor(postSet.id, all, entities, gridConfig);
                if (!sup) return;
                void prot.sendProtetorOffer({
                  supporterId: sup.id,
                  targetId: postSet.id,
                  damageDealt: dealt,
                  hpLost: Math.max(0, preHp - postSet.hpCurrent),
                  escLost: Math.max(0, preEsc - postSet.escCurrent),
                });
              },
            ).catch(() => {});
          }, 0);
        }


        // ─── Suporte — Mobilidade Avançada (aliado caiu a 0 PV) ─────────────
        if (postSet && postSet.category === 'PLAYER' && preHp > 0 && (postSet.hpCurrent ?? 0) <= 0) {
          const fallenId = postSet.id;
          setTimeout(() => {
            void import('@/lib/suporteRepertorioMobilidade').then((m) => m.sendMobilidadeOffers(fallenId)).catch(() => {});
          }, 0);
        }

        // ─── Omni-Engine: emite gatilhos de dano ─────────────────────────────
        const contextoDano = Object.freeze({
          ...contextoDanoInicial,
          valor_final: finalDamage,
          // Vulnerabilidade pode elevar o dano final acima do inicial.
          absorvido: Math.max(0, totalDamage - finalDamage),
        });
        import('@/lib/omni/eventBus').then(({ emitirEvento }) => {
          emitirEvento('aoSofrerDano', {
            cadeia,
            usuarioId: id,
            alvoId: opts?.attackerId,
            cena: { dano: rawDamage },
            dano: contextoDano,
            origemNome: 'Dano Sofrido',
            incluirPassivas: true,
            // O pre-hook (linha ~1996) já chamou dispararGatilhoEfeitosItens
            // para este mesmo evento — evita disparo duplo nos scripts de item.
            incluirScriptsItens: false,
          });
          if (opts?.attackerId) {
            emitirEvento('aoCausarDano', {
              cadeia,
              usuarioId: opts.attackerId,
              alvoId: id,
              cena: { dano: rawDamage },
              dano: contextoDano,
              origemNome: 'Dano Causado',
              incluirPassivas: true,
            });
          }
          // Observação espacial: todas as outras fichas "veem" o dano.
          if (rawDamage > 0) {
            void import('@/lib/omni/observadores').then(async (m) => {
              await m.emitirObservadores('sofrerDano', { sujeitoId: id, outroId: opts?.attackerId, dano: rawDamage, contextoDano, cadeia });
              if (opts?.attackerId) {
                await m.emitirObservadores('causarDano', { sujeitoId: opts.attackerId, outroId: id, dano: rawDamage, contextoDano, cadeia });
              }
            }).catch(() => {});
          }
          // Morte: HP cruzou para ≤ 0 nesta aplicação de dano.
          const afterChar = get().characters.find((c) => c.id === id);
          if (
            beforeChar &&
            afterChar &&
            beforeChar.hpCurrent > 0 &&
            afterChar.hpCurrent <= 0
          ) {
            // ─── Determinado a Viver: 1×/dia, em vez de cair, fica com 1 PV ───
            const hasDeterminado = (afterChar.chosenTalents ?? []).some(
              t => t.id === 'tal-determinado-a-viver',
            );
            const usedToday = afterChar.determinadoAViverUsed ?? false;
            if (hasDeterminado && !usedToday) {
              set((state) => ({
                characters: state.characters.map((c) =>
                  c.id === id
                    ? { ...c, hpCurrent: 1, determinadoAViverUsed: true }
                    : c,
                ),
              }));
              try {
                useLogStore.getState().addLog(
                  'combat',
                  `💪 ${afterChar.name} usou Determinado a Viver — fica com 1 PV (1×/dia consumido).`,
                );
              } catch { /* noop */ }
            } else {
              // Snapshot do estado de grapple ANTES de emitir aoMorrer, para
              // que handlers possam ler quem agarrava/era agarrado pelo morto.
              const dyingChar = afterChar;
              const grappling = dyingChar.grappleState?.grappling ?? [];
              const grappledBy = dyingChar.grappleState?.grappledBy ?? [];
              const allChars = get().characters;
              const nameOf = (cid: string) => allChars.find(x => x.id === cid)?.name ?? '?';
              if (grappling.length > 0 || grappledBy.length > 0) {
                try {
                  const parts: string[] = [];
                  if (grappling.length > 0) parts.push(`agarrava ${grappling.map(nameOf).join(', ')}`);
                  if (grappledBy.length > 0) parts.push(`era agarrado por ${grappledBy.map(nameOf).join(', ')}`);
                  useLogStore.getState().addLog(
                    'combat',
                    `🤼💀 ${dyingChar.name} caiu enquanto ${parts.join(' e ')} — vínculos serão liberados.`,
                  );
                } catch { /* noop */ }
              }
              // 1) Emite aoMorrer COM o estado de grapple ainda íntegro.
              emitirEvento('aoMorrer', {
                cadeia,
                usuarioId: id,
                alvoId: opts?.attackerId,
                cena: { dano: rawDamage },
                dano: contextoDano,
                origemNome: 'Morte',
                incluirPassivas: true,
              });
              void import('@/lib/omni/observadores')
                .then((m) => m.emitirObservadores('morrer', { sujeitoId: id, outroId: opts?.attackerId, dano: rawDamage, contextoDano, cadeia }))
                .catch(() => {});
              // 2) Só DEPOIS libera todos os agarres bilateralmente.
              get().releaseAllGrapplesOf(id);
              // Artes do Combate: eliminar um inimigo recupera 1 Ponto de Preparo.
              if (opts?.attackerId) {
                void import('@/lib/artesCombate').then((m) => m.recoverPreparoOnKill(opts.attackerId!)).catch(() => {});
              }
            }
          }
        });

        // ─── FAH — Sangue Tóxico (gancho onTakeDamage: devolve dano em melee) ─
        if (
          beforeChar &&
          isFahOrigin(beforeChar) &&
          (beforeChar.sangueToxicoEnabled ?? true) &&
          opts?.isMelee &&
          opts?.attackerId &&
          opts.attackerId !== beforeChar.id &&
          !opts?.tags?.includes('__sangue_toxico_return')
        ) {
          const attackerId = opts.attackerId;
          const ret = calcSangueToxicoReturn(beforeChar);
          setTimeout(() => {
            get().applyDamage(attackerId, ret, 'DPS', { ignoresRD: false, tags: ['__sangue_toxico_return'], cadeia });
          }, 0);
        }

        // Pós-set: gatilho de Absorção Elemental.
        if (
          beforeChar &&
          damageType &&
          !NON_ELEMENTAL.has(damageType) &&
          (beforeChar.chosenAuraAptitudes ?? []).includes('absorcao_elemental') &&
          !beforeChar.pendingAbsorbedElement
        ) {
          setTimeout(() => {
            import('@/stores/useReactionStore').then(({ useReactionStore }) => {
              useReactionStore.getState().enqueue({
                charId: beforeChar.id,
                charName: beforeChar.name,
                kind: 'absorption_offer',
                message: `${beforeChar.name} sofreu dano ${damageType} — Absorção Elemental disponível (próximo ataque ganha Xd6/d8/d10).`,
                payload: { element: damageType },
              });
            });
          }, 0);
        }
        });
      },
      applyHealing: (id, amount, source = 'other') => {
        const cadeia = capturarCadeiaOmni();
        let healedAmount = 0;
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== id) return c;
            // FAH: cura de Energia Reversa de TERCEIROS cai pela metade.
            // Autocura, Vigor Maldito e curas comuns NÃO sofrem o redutor.
            const isFah = c.origin === 'Feto Amaldiçoada Híbrido (FAH)' && (c.healingHalved ?? true);
            const halve = isFah && source === 'cursed_energy_external';
            const effective = halve ? Math.floor(amount / 2) : amount;
            const newHp = Math.max(c.hpCurrent, Math.min(getEffectiveHpMaxForHealing(c), c.hpCurrent + Math.max(0, effective)));
            healedAmount = newHp - c.hpCurrent;
            if (isCamActive(c) && c.activeCoreId) {
              const newCores = (c.cores || []).map(co =>
                co.id === c.activeCoreId ? { ...co, hpCurrent: newHp } : co,
              );
              return { ...c, hpCurrent: newHp, cores: newCores };
            }
            return { ...c, hpCurrent: newHp };
          }),
        }));
        // ─── Omni-Engine: emite gatilho de cura recebida ───────────────────
        if (healedAmount > 0) {
          import('@/lib/omni/eventBus').then(({ emitirEvento }) => {
            emitirEvento('aoReceberCura', {
              cadeia,
              usuarioId: id,
              cena: { cura: healedAmount },
              origemNome: 'Cura Recebida',
              incluirPassivas: true,
            });
          });
        }
      },
      useVigorMaldito: (charId, usesSpent) => {
        const c = get().characters.find((x) => x.id === charId);
        if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
        if (c.origin !== 'Feto Amaldiçoada Híbrido (FAH)') return { ok: false, reason: 'Apenas FAH possui Vigor Maldito.' };
        const max = c.vigorMalditoMax ?? calcVigorMalditoMax(c.level);
        const cur = c.vigorMalditoUses ?? max;
        if (usesSpent <= 0) return { ok: false, reason: 'Quantidade de usos inválida.' };
        if (usesSpent > cur) return { ok: false, reason: `Apenas ${cur} uso(s) disponível(is).` };
        const base = calcVigorMalditoBase(c.level);
        const conMod = getConMod(c);
        // Talento "Reposição Sanguínea": +5 cura por uso (passa por aggregateTalentBonuses).
        const talentBonusPerUse = aggregateTalentBonuses(c).vigorMalditoHealBonus;
        const healed = (base + conMod + talentBonusPerUse) * usesSpent;
        const newHp = Math.min(getEffectiveHpMaxForHealing(c), c.hpCurrent + healed);
        set((s) => ({
          characters: s.characters.map((x) => {
            if (x.id !== charId) return x;
            const patch: Partial<Character> = {
              vigorMalditoUses: cur - usesSpent,
              hpCurrent: newHp,
            };
            if (isCamActive(x) && x.activeCoreId) {
              patch.cores = (x.cores ?? []).map((co) =>
                co.id === x.activeCoreId ? { ...co, hpCurrent: newHp } : co,
              );
            }
            return { ...x, ...patch };
          }),
        }));
        return { ok: true, healed, base, conMod, usesLeft: cur - usesSpent };
      },
      // ─── Talento Favorecido pela Sorte ────────────────────────────────────
      spendLuck: (charId) => {
        const c = get().characters.find((x) => x.id === charId);
        if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
        if (c.luckMax == null) return { ok: false, reason: 'Talento "Favorecido pela Sorte" não foi adquirido.' };
        const cur = c.luckCurrent ?? 0;
        if (cur <= 0) return { ok: false, reason: 'Sem pontos de Sorte (reseta no Descanso Longo).' };
        // Nova mecânica: gastar 1 ponto = direito a re-rolar uma rolagem
        // já feita e ficar com o maior valor (exceto falha crítica).
        // Aqui só decrementamos o pool — a re-rolagem em si é executada
        // pela UI (AttackPanel para ataque/dano automatizados; manual
        // pelo jogador para perícias/TRs narrativas).
        set((s) => ({
          characters: s.characters.map((x) =>
            x.id === charId ? { ...x, luckCurrent: cur - 1 } : x,
          ),
        }));
        return { ok: true, remaining: cur - 1 };
      },
      recoverLuck: (charId) => set((s) => ({
        characters: s.characters.map((x) => {
          if (x.id !== charId) return x;
          if (x.luckMax == null) return x;
          const cur = x.luckCurrent ?? 0;
          return { ...x, luckCurrent: Math.min(x.luckMax, cur + 1) };
        }),
      })),
      consumePendingLuckAdvantage: (charId) => set((s) => ({
        characters: s.characters.map((x) =>
          x.id === charId && (x.pendingLuckAdvantage ?? 0) > 0
            ? { ...x, pendingLuckAdvantage: (x.pendingLuckAdvantage ?? 0) - 1 }
            : x,
        ),
      })),
      // ─── FAH — Alma Maldita / Devorador de Energia ─────────────────────────
      useAlmaMaldita: (charId, rawSoulDamage) => {
        const c = get().characters.find((x) => x.id === charId);
        if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
        if (!isFahOrigin(c)) return { ok: false, reason: 'Apenas FAH possui Alma Maldita.' };
        const max = c.almaMalditaMax ?? 0;
        const cur = c.almaMalditaUses ?? max;
        if (cur <= 0) return { ok: false, reason: 'Sem usos de Alma Maldita disponíveis.' };
        const reducedTo = applyAlmaMalditaReduction(c, rawSoulDamage);
        set((s) => ({
          characters: s.characters.map((x) =>
            x.id === charId ? { ...x, almaMalditaUses: cur - 1 } : x,
          ),
        }));
        // O dano residual é aplicado pelo handler do prompt via applyDamage(... 'DAL').
        return { ok: true, reducedTo, usesLeft: cur - 1 };
      },
      useDerivadoEmergencyRecovery: (charId, inCombat) => {
        const c = get().characters.find((x) => x.id === charId);
        const check = checkDerivadoEmergency(c, !!inCombat);
        if (!check.ok || !c) return { ok: false, reason: check.reason };
        const tb = getTrainingBonusByLevel(c.level);
        const recovered = tb * 2;
        const peMaxEff = c.peMax;
        set((s) => ({
          characters: s.characters.map((x) =>
            x.id === charId
              ? {
                  ...x,
                  peCurrent: Math.min(peMaxEff, (x.peCurrent ?? 0) + recovered),
                  derivadoEmergencyUsed: true,
                  bonusActionsCurrent: Math.max(0, (x.bonusActionsCurrent ?? 0) - 1),
                }
              : x,
          ),
        }));
        return { ok: true, recovered };
      },
      useInumakiOlhosCobra: (charId) => {
        const c = get().characters.find((x) => x.id === charId);
        if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
        if (c.clanId !== 'Inumaki') return { ok: false, reason: 'Apenas Cl\u00e3 Inumaki possui esta habilidade.' };
        const max = c.inumakiMax ?? getTrainingBonusByLevel(c.level);
        const cur = c.inumakiUses ?? max;
        if (cur <= 0) return { ok: false, reason: 'Sem usos. Recarrega no Descanso Longo.' };
        set((s) => ({
          characters: s.characters.map((x) =>
            x.id === charId ? { ...x, inumakiUses: cur - 1, inumakiMax: max } : x,
          ),
        }));
        return { ok: true, usesLeft: cur - 1 };
      },
      useRestringidoResiliencia: (charId) => {
        const c = get().characters.find((x) => x.id === charId);
        if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
        if (c.origin !== 'Restringido') return { ok: false, reason: 'Apenas a origem Restringido possui Resili\u00eancia Imediata.' };
        const max = c.restringidoResilMax ?? getTrainingBonusByLevel(c.level);
        const cur = c.restringidoResilUses ?? max;
        if (cur <= 0) return { ok: false, reason: 'Sem usos. Recarrega no Descanso Longo.' };
        const reduced = Math.max(1, Math.floor(c.level / 2)) * 5;
        set((s) => ({
          characters: s.characters.map((x) =>
            x.id === charId ? { ...x, restringidoResilUses: cur - 1, restringidoResilMax: max } : x,
          ),
        }));
        return { ok: true, reduced, usesLeft: cur - 1 };
      },
      notifyFahSavedVsSpell: (charId) => {
        const c = get().characters.find((x) => x.id === charId);
        if (!c || !isFahOrigin(c)) return;
        // Devorador de Energia: TR passado contra tag 'Feitiço' → +1 tempPE.
        set((s) => ({
          characters: s.characters.map((x) =>
            x.id === charId ? { ...x, tempPE: (x.tempPE ?? 0) + 1 } : x,
          ),
        }));
      },
      triggerSpecReaction: (charId, reactionId, payload) => {
        const c = get().characters.find((x) => x.id === charId);
        if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
        const hasIt = (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === reactionId);
        if (!hasIt) return { ok: false, reason: 'Habilidade não escolhida.' };
        const tb = getTrainingBonusByLevel(c.level);
        const keyMod = getSpecKeyMod(c);
        const pePayload = Math.max(0, Math.floor(payload?.pe ?? 0));
        let peCost = 0;
        let tempPeGain = 0;
        let log = '';
        switch (reactionId) {
          case 'tec-zelo-recompensador': {
            tempPeGain = c.level >= 14 ? 2 : 1;
            log = `⚡ Zelo Recompensador: passou em TR vs Feitiço → +${tempPeGain} tempPE.`;
            break;
          }
          case 'tec-abastecido-pelo-sangue': {
            // Recupera PE = Mod_Chave (INT ou SAB, o maior — getSpecKeyMod já entrega).
            // Caller controla limite de usos (1/2/3 por descanso longo).
            const gain = Math.max(1, keyMod);
            log = `🩸 Abastecido pelo Sangue: inimigo caiu em 12m → +${gain} PE (Mod_Chave).`;
            // Aplica direto em peCurrent (não temp).
            set((s) => ({
              characters: s.characters.map((x) =>
                x.id === charId
                  ? { ...x, peCurrent: Math.min(x.peMax, x.peCurrent + gain) }
                  : x,
              ),
            }));
            return { ok: true, log };
          }
          case 'tec-determinacao-energizada': {
            // Custo escalonado: 1 PE base, +1 por uso anterior na rodada.
            // payload.pe = custo efetivo informado pelo caller (1+usosNaRodada).
            peCost = Math.max(1, pePayload || 1);
            log = `💪 Determinação Energizada: −${peCost} PE → Vantagem em TR de Astúcia/Vontade.`;
            break;
          }
          case 'tec-incapaz-de-falhar': {
            peCost = 2;
            log = `🎯 Incapaz de Falhar: −2 PE → +${keyMod} no resultado da Aptidão.`;
            break;
          }
          case 'tec-explosao-defensiva': {
            // Input: PE gasto (até TB). Reduz dano em PE×5, empurra PE×3m.
            const used = Math.max(1, Math.min(tb, pePayload || 1));
            peCost = used;
            log = `💥 Explosão Defensiva: −${used} PE → dano sofrido −${used * 5}; empurrão ${used * 3}m.`;
            break;
          }
          case 'tec-passo-rapido': {
            log = `🏃 Passo Rápido: deslocamento reativo (⌊Desloc÷2⌋) sem provocar AoO.`;
            break;
          }
          case 'tec-primeiro-disparo': {
            log = `🎬 Primeiro Disparo: ativou 1 habilidade (Ação Bônus / Livre) antes do round 1.`;
            break;
          }
          case 'tec-correcao': {
            const sLvl = Math.max(1, Math.floor(payload?.spellLevel ?? 1));
            peCost = sLvl;
            log = `🛡️ Correção: −${sLvl} PE → ignora quebra de Concentração (Feitiço Nv ${sLvl}).`;
            break;
          }
        }
        if (peCost > 0) {
          // Consome tempPE primeiro, depois peCurrent.
          const t0 = c.tempPE ?? 0;
          const fromTemp = Math.min(t0, peCost);
          const fromMain = peCost - fromTemp;
          if (c.peCurrent < fromMain) return { ok: false, reason: `PE insuficiente (precisa ${peCost}).` };
          set((s) => ({
            characters: s.characters.map((x) =>
              x.id === charId
                ? { ...x, tempPE: t0 - fromTemp, peCurrent: x.peCurrent - fromMain }
                : x,
            ),
          }));
        }
        if (tempPeGain > 0) {
          set((s) => ({
            characters: s.characters.map((x) =>
              x.id === charId ? { ...x, tempPE: (x.tempPE ?? 0) + tempPeGain } : x,
            ),
          }));
        }
        return { ok: true, log };
      },
      applyShield: (id, amount) => set((state) => ({ characters: state.characters.map((c) => c.id === id ? { ...c, escCurrent: c.escCurrent + amount } : c) })),
      applyDiscursoMotivador: (sourceId, targetIds) => {
        const state = get();
        const source = state.characters.find((c) => c.id === sourceId);
        if (!source) return { ok: false, reason: 'Personagem-fonte não encontrado.' };
        const calc = computeDiscursoMotivador(source);
        if (!calc.available) return { ok: false, reason: 'Não possui o talento Discurso Motivador.' };
        if (!calc.eligible) return { ok: false, reason: 'Requer Persuasão treinada.' };
        const used = new Set(source.discursoMotivadorUsedOn ?? []);
        const applied: string[] = [];
        const skipped: string[] = [];
        for (const tid of targetIds) {
          if (used.has(tid)) { skipped.push(tid); continue; }
          const target = state.characters.find((c) => c.id === tid);
          if (!target) { skipped.push(tid); continue; }
          applied.push(tid);
          used.add(tid);
        }
        if (applied.length === 0) {
          return { ok: false, reason: 'Nenhum alvo elegível (todos já receberam o buff hoje).', tempHP: calc.tempHP, applied, skipped };
        }
        const tempHP = calc.tempHP;
        set((s) => ({
          characters: s.characters.map((c) => {
            if (c.id === sourceId) {
              return { ...c, discursoMotivadorUsedOn: Array.from(used) };
            }
            if (applied.includes(c.id)) {
              return { ...c, escCurrent: (c.escCurrent ?? 0) + tempHP };
            }
            return c;
          }),
        }));
        return { ok: true, tempHP, applied, skipped };
      },
      // ===== CAM actions =====
      switchCore: (id, targetCoreId) => {
        let success = false;
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== id) return c;
            if (c.bonusActionsCurrent <= 0) return c;
            const patch = switchCoreInCombat(c, targetCoreId);
            if (!patch) return c;
            success = true;
            return { ...c, ...patch, bonusActionsCurrent: c.bonusActionsCurrent - 1 };
          }),
        }));
        return success;
      },
      applySoulDamage: (id, amount) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== id || !isCamActive(c)) return c;
          return { ...c, ...applySoulDamagePure(c, amount) };
        }),
      })),
      healCore: (id, coreId, amount) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== id || !isCamActive(c)) return c;
          const newCores = healCoreSnapshot(c.cores!, coreId, amount);
          const isActive = c.activeCoreId === coreId;
          const active = newCores.find(co => co.id === coreId);
          return {
            ...c,
            cores: newCores,
            ...(isActive && active ? { hpCurrent: active.hpCurrent } : {}),
            soulIntegrityMax: calcSoulIntegrityMax(newCores),
          };
        }),
      })),
      markActiveCoreFallen: (id) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== id || !isCamActive(c) || !c.activeCoreId) return c;
          const newCores = markCoreFallen(c.cores!, c.activeCoreId, c.hpCurrent);
          return { ...c, cores: newCores, dying: true };
        }),
      })),
      setDying: (id, dying) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== id) return c;
          // Salvaguarda de Morte: ao entrar em Morrendo com Exaustão >= 4,
          // o tracker de falhas começa em 2.
          if (dying && !c.dying) {
            const preFails = clampExh(c.exhaustionLevel) >= 4 ? 2 : 0;
            return { ...c, dying: true, deathFails: Math.max(c.deathFails ?? 0, preFails) };
          }
          // Sai do estado morrendo → zera o tracker
          if (!dying && c.dying) {
            return { ...c, dying: false, deathFails: 0 };
          }
          return { ...c, dying };
        }),
      })),
      setExhaustion: (charId, value) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== charId) return c;
          const prev = clampExh(c.exhaustionLevel);
          const next = clampExh(value);
          if (prev === next) return c;
          // Lv 6 = morte instantânea
          if (next >= EXHAUSTION_MAX) {
            const synced = syncExhaustionConditions({
              ...c,
              exhaustionLevel: EXHAUSTION_MAX,
              hpCurrent: 0,
              dying: false,
              unconsciousFromExhaustion: false,
              deathRestsRequired: 0,
              deathFails: 3,
            });
            return synced;
          }
          // Calcula impacto da redução de HP máximo (não toca em escudo).
          const prevReduction = getExhaustionHpReduction(prev, c.hpMax);
          const nextReduction = getExhaustionHpReduction(next, c.hpMax);
          const effectiveMaxNow = Math.max(0, c.hpMax - nextReduction);
          let hpCurrent = c.hpCurrent;
          // Se a redução AUMENTOU, clampa o HP atual ao novo teto.
          if (nextReduction > prevReduction && hpCurrent > effectiveMaxNow) {
            hpCurrent = effectiveMaxNow;
          }
          let unconsciousFromExhaustion = c.unconsciousFromExhaustion ?? false;
          let deathRestsRequired = c.deathRestsRequired ?? 0;
          // Regra do Desmaio: se a redução fizer o HP cair a 0 (sem matar)
          if (nextReduction > prevReduction && hpCurrent <= 0 && next < EXHAUSTION_MAX) {
            unconsciousFromExhaustion = true;
            deathRestsRequired = next;
            hpCurrent = 0;
          }
          // Se a exaustão DIMINUIU, limpa o desmaio se o HP voltar a ser positivo
          if (next < prev && unconsciousFromExhaustion && effectiveMaxNow > 0) {
            unconsciousFromExhaustion = false;
            deathRestsRequired = 0;
          }
          const synced = syncExhaustionConditions({
            ...c,
            exhaustionLevel: next,
            hpCurrent,
            unconsciousFromExhaustion,
            deathRestsRequired,
          });
          return synced;
        }),
      })),
      bumpExhaustion: (charId, delta) => {
        const c = get().characters.find((x) => x.id === charId);
        if (!c) return;
        get().setExhaustion(charId, clampExh(c.exhaustionLevel) + delta);
      },
      bumpAptitude: (charId, choiceId, key, delta) => {
        let success = false;
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const choice = (c.pendingLevelChoices ?? []).find(p => p.id === choiceId);
            if (!choice || choice.kind !== 'aptitude_distribute') return c;
            const apts = { ...createDefaultCursedAptitudes(), ...(c.cursedAptitudes ?? {}) };
            const current = apts[key] ?? 0;
            const next = current + delta;
            if (next < APTITUDE_MIN || next > APTITUDE_MAX) return c;
            const eff = choice.appliedEffect ?? {};
            const spends = { ...(eff.aptitudeSpends ?? {}) };
            const spentInThis = spends[key] ?? 0;
            const remaining = eff.pointsRemaining ?? Number(choice.value) ?? 0;
            if (delta === 1) {
              if (remaining <= 0) return c;
              if ((c.pendingAptitudePoints ?? 0) <= 0) return c;
              spends[key] = spentInThis + 1;
            } else {
              // só permite reduzir um ponto que tenha sido gasto NESTE tracker
              if (spentInThis <= 0) return c;
              spends[key] = spentInThis - 1;
            }
            apts[key] = next;
            const newRemaining = remaining + (delta === 1 ? -1 : 1);
            const newPendingPts = Math.max(0, (c.pendingAptitudePoints ?? 0) + (delta === 1 ? -1 : 1));
            const updatedChoices = (c.pendingLevelChoices ?? []).map(p => {
              if (p.id !== choiceId) return p;
              return {
                ...p,
                resolved: newRemaining <= 0,
                value: String(newRemaining),
                appliedEffect: { ...eff, pointsRemaining: newRemaining, aptitudeSpends: spends },
              };
            });
            success = true;
            return {
              ...c,
              cursedAptitudes: apts,
              pendingAptitudePoints: newPendingPts,
              pendingLevelChoices: updatedChoices,
            };
          }),
        }));
        return success;
      },
      chooseAuraAptitude: (charId, auraId) => {
        let result: { ok: boolean; reason?: string } = { ok: false, reason: 'Personagem não encontrado.' };
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const apt = getAuraAptitudeById(auraId);
            if (!apt) { result = { ok: false, reason: 'Aptidão inexistente.' }; return c; }
            if ((c.chosenAuraAptitudes ?? []).includes(auraId)) {
              result = { ok: false, reason: 'Já adquirida.' }; return c;
            }
            const auLevel = c.cursedAptitudes?.AU ?? 0;
            const attrMap: Record<string, number> = {};
            const attrShortMap: Record<string, string> = { 'Força': 'FOR', 'Destreza': 'DES', 'Constituição': 'CON', 'Inteligência': 'INT', 'Sabedoria': 'SAB', 'Presença': 'PRE' };
            (c.attributes ?? []).forEach(a => {
              const short = attrShortMap[a.name] ?? a.name.slice(0, 3).toUpperCase();
              attrMap[short] = a.value;
            });
            const trainedSkills = (c.skills ?? []).filter(s => s.trained || s.mastery).map(s => s.name);
            const gate = checkAuraGate(apt, {
              level: c.level,
              auLevel,
              attrs: attrMap,
              trainedSkills,
              chosenAuraIds: c.chosenAuraAptitudes ?? [],
            });
            if (!gate.ok) { result = { ok: false, reason: gate.reasons.join('; ') }; return c; }
            // Consome 1 ponto do pool de catálogo, se houver. Sem ponto = não pode adquirir.
            const pool = c.availableAuraChoices ?? 0;
            if (pool <= 0) {
              result = { ok: false, reason: 'Sem pontos de Catálogo de Aptidão (suba de nível como Especialista em Técnica para ganhar).' };
              return c;
            }
            // Resolve o primeiro tracker `pending_aptitude_choice` ainda pendente.
            const pending = c.pendingLevelChoices ?? [];
            let resolvedOne = false;
            const updatedPending = pending.map(p => {
              if (!resolvedOne && !p.resolved && p.kind === 'pending_aptitude_choice') {
                resolvedOne = true;
                return { ...p, resolved: true, value: auraId };
              }
              return p;
            });
            result = { ok: true };
            return {
              ...c,
              chosenAuraAptitudes: [...(c.chosenAuraAptitudes ?? []), auraId],
              availableAuraChoices: Math.max(0, pool - 1),
              pendingLevelChoices: updatedPending,
            };
          }),
        }));
        return result;
      },
      removeAuraAptitude: (charId, auraId) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== charId) return c;
          const usage = { ...(c.auraAptitudeUsage ?? {}) };
          delete usage[auraId];
          delete (usage as Record<string, unknown>)[`${auraId}:element`];
          return {
            ...c,
            chosenAuraAptitudes: (c.chosenAuraAptitudes ?? []).filter(id => id !== auraId),
            auraAptitudeUsage: usage,
          };
        }),
      })),
      chooseClAptitude: (charId, clId) => {
        let result: { ok: boolean; reason?: string } = { ok: false, reason: 'Personagem não encontrado.' };
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const apt = getAuraAptitudeById(clId);
            if (!apt) { result = { ok: false, reason: 'Aptidão inexistente.' }; return c; }
            if (apt.family !== 'CL' && apt.family !== 'DOM' && apt.family !== 'BAR' && apt.family !== 'ER' && apt.family !== 'SPECIAL' && apt.family !== 'CURSED') {
              result = { ok: false, reason: 'Aptidão não pertence ao catálogo compartilhado.' };
              return c;
            }
            if ((c.chosenClAptitudes ?? []).includes(clId)) {
              result = { ok: false, reason: 'Já adquirida.' }; return c;
            }
            const aptsState = c.cursedAptitudes;
            const attrMap: Record<string, number> = {};
            const attrShortMap: Record<string, string> = { 'Força': 'FOR', 'Destreza': 'DES', 'Constituição': 'CON', 'Inteligência': 'INT', 'Sabedoria': 'SAB', 'Presença': 'PRE' };
            (c.attributes ?? []).forEach(a => {
              const short = attrShortMap[a.name] ?? a.name.slice(0, 3).toUpperCase();
              attrMap[short] = a.value;
            });
            const trainedSkills = (c.skills ?? []).filter(s => s.trained || s.mastery).map(s => s.name);
            const gate = checkAuraGate(apt, {
              level: c.level,
              auLevel: aptsState?.AU ?? 0,
              clLevel: aptsState?.CL ?? 0,
              barLevel: aptsState?.BAR ?? 0,
              domLevel: aptsState?.DOM ?? 0,
              erLevel: aptsState?.ER ?? 0,
              attrs: attrMap,
              trainedSkills,
              chosenAuraIds: c.chosenAuraAptitudes ?? [],
              chosenAptitudeIds: [...(c.chosenAuraAptitudes ?? []), ...(c.chosenClAptitudes ?? [])],
              clanId: c.clanId,
            });
            if (!gate.ok) { result = { ok: false, reason: gate.reasons.join('; ') }; return c; }
            const pool = c.availableAuraChoices ?? 0;
            if (pool <= 0) {
              result = { ok: false, reason: 'Sem pontos de Catálogo de Aptidão.' };
              return c;
            }
            const pending = c.pendingLevelChoices ?? [];
            let resolvedOne = false;
            const updatedPending = pending.map(p => {
              if (!resolvedOne && !p.resolved && p.kind === 'pending_aptitude_choice') {
                resolvedOne = true;
                return { ...p, resolved: true, value: clId };
              }
              return p;
            });
            result = { ok: true };
            return {
              ...c,
              chosenClAptitudes: [...(c.chosenClAptitudes ?? []), clId],
              availableAuraChoices: Math.max(0, pool - 1),
              pendingLevelChoices: updatedPending,
            };
          }),
        }));
        return result;
      },
      removeClAptitude: (charId, clId) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== charId) return c;
          const usage = { ...(c.clAptitudeUsage ?? {}) };
          delete usage[clId];
          return {
            ...c,
            chosenClAptitudes: (c.chosenClAptitudes ?? []).filter(id => id !== clId),
            clAptitudeUsage: usage,
          };
        }),
      })),

      // ===== DOTES GERAIS =====
      addDote: (charId, doteId) => {
        const dote = DOTE_BY_ID[doteId];
        if (!dote) return { ok: false, reason: 'Dote desconhecido.' };
        let result: { ok: boolean; reason?: string } = { ok: true };
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const owned = c.chosenDotes ?? [];
            if (owned.includes(doteId)) { result = { ok: false, reason: 'Dote já adquirido.' }; return c; }
            // Mutuamente exclusivos: Sentidos Atentos ↔ Afiados
            if (doteId === 'dote-sentidos-atentos' && owned.includes('dote-sentidos-afiados')) {
              result = { ok: false, reason: 'Conflita com Sentidos Afiados.' }; return c;
            }
            if (doteId === 'dote-sentidos-afiados' && owned.includes('dote-sentidos-atentos')) {
              result = { ok: false, reason: 'Conflita com Sentidos Atentos.' }; return c;
            }
            const next: Character = { ...c, chosenDotes: [...owned, doteId] };
            // Recurso Sorte ao adquirir
            if (doteId === 'dote-abencoado-sorte' && !next.luckyPoints) {
              next.luckyPoints = { current: 3, max: 3 };
            }
            return finalizeFAH(next);
          }),
        }));
        return result;
      },

      removeDote: (charId, doteId) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== charId) return c;
          const usage = { ...(c.doteUsage ?? {}) }; delete usage[doteId];
          const toggles = { ...(c.doteToggles ?? {}) }; delete toggles[doteId];
          const next: Character = {
            ...c,
            chosenDotes: (c.chosenDotes ?? []).filter((id) => id !== doteId),
            doteUsage: usage,
            doteToggles: toggles,
          };
          if (doteId === 'dote-abencoado-sorte') delete next.luckyPoints;
          return finalizeFAH(next);
        }),
      })),

      useDote: (charId, doteId, opts) => {
        const dote = DOTE_BY_ID[doteId];
        if (!dote) return { ok: false, reason: 'Dote desconhecido.' };
        let result: { ok: boolean; reason?: string } = { ok: true };
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            if (!(c.chosenDotes ?? []).includes(doteId)) {
              result = { ok: false, reason: 'Dote não adquirido.' }; return c;
            }
            // Custo de PE
            const peCost = typeof dote.peCost === 'number' ? dote.peCost : (opts?.peSpent ?? 0);
            if (peCost > 0 && (c.peCurrent ?? 0) < peCost) {
              result = { ok: false, reason: `PE insuficiente (precisa ${peCost}).` }; return c;
            }
            // Limite de usos
            const used = (c.doteUsage ?? {})[doteId] ?? 0;
            if (dote.uses && used >= dote.uses.max) {
              result = { ok: false, reason: 'Sem usos restantes.' }; return c;
            }
            const usage = { ...(c.doteUsage ?? {}) };
            if (dote.uses) usage[doteId] = used + 1;
            return {
              ...c,
              peCurrent: peCost > 0 ? Math.max(0, (c.peCurrent ?? 0) - peCost) : c.peCurrent,
              doteUsage: usage,
            };
          }),
        }));
        return result;
      },

      toggleDote: (charId, doteId) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== charId) return c;
          const cur = (c.doteToggles ?? {})[doteId] ?? false;
          return { ...c, doteToggles: { ...(c.doteToggles ?? {}), [doteId]: !cur } };
        }),
      })),

      resetDoteUsage: (charId, scope) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== charId) return c;
          const usage = { ...(c.doteUsage ?? {}) };
          for (const id of c.chosenDotes ?? []) {
            const d = DOTE_BY_ID[id];
            if (d?.uses?.per === scope) delete usage[id];
          }
          // Sorte recupera totalmente em descanso longo
          let lucky = c.luckyPoints;
          if (lucky && scope === 'descanso-longo') lucky = { ...lucky, current: lucky.max };
          return { ...c, doteUsage: usage, luckyPoints: lucky };
        }),
      })),

      spendLuckyPoint: (charId) => {
        let result: { ok: boolean; reason?: string } = { ok: true };
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const lp = c.luckyPoints;
            if (!lp || lp.current <= 0) { result = { ok: false, reason: 'Sem pontos de sorte.' }; return c; }
            return { ...c, luckyPoints: { ...lp, current: lp.current - 1 } };
          }),
        }));
        return result;
      },

      restoreLuckyPoint: (charId) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== charId) return c;
          const lp = c.luckyPoints;
          if (!lp) return c;
          return { ...c, luckyPoints: { ...lp, current: Math.min(lp.max, lp.current + 1) } };
        }),
      })),

      activateClAptitude: async (charId, clId, params) => {
        let result: { ok: boolean; reason?: string; peSpent?: number; logMessage?: string; damageFormula?: string } = { ok: false };
        const state = get();
        const c = state.characters.find(x => x.id === charId);
        if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
        const owned = new Set(c.chosenClAptitudes ?? []);
        if (!owned.has(clId)) return { ok: false, reason: 'Aptidão não adquirida.' };

        // Pré-rola d20s na bandeja 3D para aptidões que exigem teste.
        // Cada calc* recebe `rollFn` consumindo a fila pré-rolada.
        let preRolled: number[] = [];
        const needsD20 =
          clId === 'cl-leitura-de-aura' ||
          clId === 'cl-leitura-rapida-de-energia' ||
          (clId === 'cl-rastreio-avancado' && !params.alreadyKnown && params.cdAmaldicoada != null) ||
          (clId === 'cl-punho-divergente' && params.punhoModo === 'resolver');
        if (needsD20) {
          const { useDice3DStore } = await import('@/stores/useDice3DStore');
          preRolled = await useDice3DStore.getState().requestRoll(['D20'], clId);
        }
        const rollFn = () => preRolled.shift() ?? 1;

        let calc: ClActivationResult | null = null;

        // Roteia para a função pura conforme a aptidão.
        if (clId === 'cl-cobrir-se' || clId === 'cl-cobertura-avancada') {
          calc = calcularCobrirSe(c, {
            peSpent: params.peSpent ?? 1,
            hasCoberturaAvancada: owned.has('cl-cobertura-avancada'),
          });
        } else if (clId === 'cl-canalizar-em-golpe' || clId === 'cl-canalizacao-avancada' || clId === 'cl-canalizacao-maxima') {
          const tier: 'basica' | 'avancada' | 'maxima' = owned.has('cl-canalizacao-maxima') ? 'maxima'
            : owned.has('cl-canalizacao-avancada') ? 'avancada' : 'basica';
          calc = calcularCanalizar(c, { peSpent: params.peSpent ?? 1, tier });
        } else if (clId === 'cl-projetar-energia' || clId === 'cl-projecao-avancada' || clId === 'cl-projecao-maxima') {
          const tier: 'basica' | 'avancada' | 'maxima' = owned.has('cl-projecao-maxima') ? 'maxima'
            : owned.has('cl-projecao-avancada') ? 'avancada' : 'basica';
          calc = calcularProjetar(c, {
            peSpent: params.peSpent ?? 1,
            resolution: params.resolution ?? 'attack',
            tier,
          });
        } else if (clId === 'cl-estimulo-muscular' || clId === 'cl-estimulo-muscular-avancado') {
          calc = calcularEstimulo(c, {
            submodo: params.submodo ?? 'movimento',
            peSpent: params.peSpent ?? 1,
            isAvancado: owned.has('cl-estimulo-muscular-avancado'),
            baseSpeedM: 9,
          });
        } else if (clId === 'cl-expandir-aura') {
          calc = calcularExpandirAura(c, { sustain: !!params.sustain });
        } else if (clId === 'cl-leitura-de-aura') {
          if (params.cdAmaldicoada == null) return { ok: false, reason: 'Informe a CD Amaldiçoada.' };
          calc = calcularLeituraDeAura(c, { cdAmaldicoada: params.cdAmaldicoada, rollFn });
        } else if (clId === 'cl-leitura-rapida-de-energia') {
          if (params.cdAmaldicoada == null) return { ok: false, reason: 'Informe a CD Amaldiçoada.' };
          calc = calcularLeituraRapida(c, { cdAmaldicoada: params.cdAmaldicoada, rollFn });
        } else if (clId === 'cl-projecao-dividida') {
          if (params.peOriginal == null || params.peDuplicata == null) {
            return { ok: false, reason: 'Informe PE original e PE da duplicata.' };
          }
          const tier: 'basica' | 'avancada' | 'maxima' = owned.has('cl-projecao-maxima') ? 'maxima'
            : owned.has('cl-projecao-avancada') ? 'avancada' : 'basica';
          calc = calcularProjecaoDividida(c, {
            peOriginal: params.peOriginal,
            peDuplicata: params.peDuplicata,
            tier,
          });
        } else if (clId === 'cl-emocao-da-petala-decadente') {
          if (params.petalaMode === 'ofensiva') {
            calc = calcularPetalaOfensiva(c);
          } else {
            return { ok: false, reason: 'Uso defensivo (anular acerto garantido de DOM) é manual — debite PE = Nível DOM do atacante manualmente.' };
          }
        } else if (clId === 'cl-rastreio-avancado') {
          if (params.alreadyKnown) {
            calc = calcularRastreio(c, { cdAmaldicoada: 0, skill: 'Investigação', alreadyKnown: true });
          } else {
            if (params.cdAmaldicoada == null) return { ok: false, reason: 'Informe a CD Amaldiçoada.' };
            calc = calcularRastreio(c, {
              cdAmaldicoada: params.cdAmaldicoada,
              skill: params.rastreioSkill ?? 'Investigação',
              rollFn,
            });
          }
        } else if (clId === 'cl-punho-divergente') {
          if (params.punhoModo === 'resolver') {
            if (params.fortitudeAlvo == null) return { ok: false, reason: 'Informe o bônus de Fortitude do alvo.' };
            calc = calcularPunhoDivergenteResolver(c, { fortitudeAlvo: params.fortitudeAlvo, rollFn });
          } else {
            if (params.danoTotal == null) return { ok: false, reason: 'Informe o dano total do golpe desarmado.' };
            calc = calcularPunhoDivergenteArmar(c, { danoTotal: params.danoTotal });
          }
        } else {
          return { ok: false, reason: 'Esta aptidão CL ainda não tem ativação automática.' };
        }

        if (!calc || !calc.ok) {
          return { ok: false, reason: calc?.reason ?? 'Falha ao calcular efeito.' };
        }

        // Aplica side-effects.
        set((s) => ({
          characters: s.characters.map((cc) => {
            if (cc.id !== charId) return cc;
            const next = { ...cc, peCurrent: Math.max(0, cc.peCurrent - calc!.peSpent) };
            if (calc!.shieldGranted) next.escCurrent = (next.escCurrent ?? 0) + calc!.shieldGranted;
            if (calc!.omniFlagPatch) {
              next.omniFlags = { ...(next.omniFlags ?? {}), ...calc!.omniFlagPatch };
            }
            return next;
          }),
        }));

        result = {
          ok: true,
          peSpent: calc.peSpent,
          logMessage: calc.logMessage,
          damageFormula: calc.damageFormula,
        };
        return result;
      },
      activateDomAptitude: async (charId, domId, params) => {
        const state = get();
        const c = state.characters.find(x => x.id === charId);
        if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
        const owned = new Set(c.chosenClAptitudes ?? []);
        if (!owned.has(domId)) return { ok: false, reason: 'Aptidão DOM não adquirida.' };

        // Pré-rola d20s da bandeja 3D quando necessário (Anular Técnica = 2 d20).
        let preRolled: number[] = [];
        if (domId === 'dom-anular-tecnica') {
          const { useDice3DStore } = await import('@/stores/useDice3DStore');
          preRolled = await useDice3DStore.getState().requestRoll(['D20', 'D20'], domId);
        }
        const rollFn = () => preRolled.shift() ?? 1;

        let calc: DomActivationResult | null = null;

        if (domId === 'dom-revestimento-de-dominio') {
          calc = calcularRevestimento(c, { sustain: !!params.sustain });
        } else if (domId === 'dom-anular-tecnica') {
          if (params.peInimigo == null || params.feiticariaInimigo == null) {
            return { ok: false, reason: 'Informe PE do Feitiço inimigo e bônus de Feitiçaria do atacante.' };
          }
          const usosGastos = c.clAptitudeUsage?.[domId] ?? 0;
          calc = calcularAnularTecnica(c, {
            peInimigo: params.peInimigo,
            feiticariaInimigo: params.feiticariaInimigo,
            usosGastos,
            rollFn,
          });
        } else if (domId === 'dom-expansao-dominio-incompleta') {
          calc = calcularExpansaoIncompleta(c);
        } else if (domId === 'dom-expansao-dominio-completa') {
          calc = calcularExpansaoCompleta(c, {
            comAcertoGarantido: !!params.comAcertoGarantido,
            semBarreiras: false,
          });
        } else if (domId === 'dom-acerto-garantido') {
          // Ativar Acerto Garantido = ativar a Expansão Completa COM o modificador.
          calc = calcularExpansaoCompleta(c, {
            comAcertoGarantido: true,
            semBarreiras: false,
          });
        } else if (domId === 'dom-expansao-dominio-sem-barreiras') {
          calc = calcularExpansaoCompleta(c, {
            comAcertoGarantido: true,
            semBarreiras: true,
          });
        } else {
          return { ok: false, reason: 'Esta aptidão DOM ainda não tem ativação automática.' };
        }

        if (!calc || !calc.ok) {
          return { ok: false, reason: calc?.reason ?? 'Falha ao calcular efeito.' };
        }

        // Aplica side-effects: PE, flags, e contador para Anular Técnica.
        set((s) => ({
          characters: s.characters.map((cc) => {
            if (cc.id !== charId) return cc;
            const next = { ...cc, peCurrent: Math.max(0, cc.peCurrent - calc!.peSpent) };
            if (calc!.omniFlagPatch) {
              next.omniFlags = { ...(next.omniFlags ?? {}), ...calc!.omniFlagPatch };
            }
            if (domId === 'dom-anular-tecnica') {
              const usage = { ...(cc.clAptitudeUsage ?? {}) };
              usage[domId] = (usage[domId] ?? 0) + 1;
              next.clAptitudeUsage = usage;
            }
            return next;
          }),
        }));

        return { ok: true, peSpent: calc.peSpent, logMessage: calc.logMessage };
      },

      activateBarAptitude: (charId, barId, params) => {
        const state = get();
        const c = state.characters.find(x => x.id === charId);
        if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
        const owned = new Set(c.chosenClAptitudes ?? []);
        if (!owned.has(barId)) return { ok: false, reason: 'Aptidão BAR não adquirida.' };

        let calc: BarActivationResult | null = null;

        if (barId === 'bar-tecnicas-de-barreira') {
          if (!params.paredes || params.paredes <= 0) {
            return { ok: false, reason: 'Informe quantas paredes (1..6).' };
          }
          calc = calcularCriarParedes(c, {
            paredes: params.paredes,
            hasParedesResistentes: owned.has('bar-paredes-resistentes'),
            hasBarreiraRapida: owned.has('bar-barreira-rapida'),
          });
        } else if (barId === 'bar-cesta-oca-de-vime') {
          calc = calcularCestaOca(c);
        } else if (barId === 'bar-cortina') {
          if (!params.areaM || params.areaM <= 0) {
            return { ok: false, reason: 'Informe a área da Cortina (m).' };
          }
          calc = calcularCortina(c, { areaM: params.areaM });
        } else {
          return { ok: false, reason: 'Esta aptidão BAR é passiva ou ainda não tem ativação automática.' };
        }

        if (!calc || !calc.ok) {
          return { ok: false, reason: calc?.reason ?? 'Falha ao calcular efeito.' };
        }

        set((s) => ({
          characters: s.characters.map((cc) => {
            if (cc.id !== charId) return cc;
            const next = { ...cc, peCurrent: Math.max(0, cc.peCurrent - calc!.peSpent) };
            if (calc!.omniFlagPatch) {
              next.omniFlags = { ...(next.omniFlags ?? {}), ...calc!.omniFlagPatch };
            }
            return next;
          }),
        }));

        return { ok: true, peSpent: calc.peSpent, logMessage: calc.logMessage };
      },
      activateErAptitude: (charId, erId, params) => {
        const state = get();
        const c = state.characters.find(x => x.id === charId);
        if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
        const owned = new Set(c.chosenClAptitudes ?? []);
        if (!owned.has(erId)) return { ok: false, reason: 'Aptidão ER não adquirida.' };

        let calc: ErActivationResult | null = null;

        if (erId === 'er-fluxo-constante') {
          if (!params.fluxoModo) {
            return { ok: false, reason: 'Informe o modo (turno-livre ou reacao).' };
          }
          calc = calcularFluxoConstante(c, { modo: params.fluxoModo });
        } else if (erId === 'er-liberacao-energia-reversa') {
          calc = calcularLiberacaoEr(c);
        } else if (erId === 'er-canalizar-energia-reversa') {
          if (!params.perGasto || params.perGasto <= 0) {
            return { ok: false, reason: 'Informe quantos PER investir (≤ Bônus de Treinamento).' };
          }
          const tb = getTrainingBonusByLevel(c.level);
          const cargaErExistente = (c.omniFlags?.canalizar_er_carga as number | undefined) ?? 0;
          const canalizarEmGolpeAtivo = ((c.omniFlags?.canalizar_em_golpe_carga as number | undefined) ?? 0) > 0;
          calc = calcularCanalizarEr(c, {
            perGasto: params.perGasto,
            trainingBonus: tb,
            cargaErExistente,
            canalizarEmGolpeAtivo,
          });
        } else {
          return { ok: false, reason: 'Esta aptidão ER é passiva ou já tem dialog próprio.' };
        }

        if (!calc || !calc.ok) {
          return { ok: false, reason: calc?.reason ?? 'Falha ao calcular efeito.' };
        }

        set((s) => ({
          characters: s.characters.map((cc) => {
            if (cc.id !== charId) return cc;
            const next = { ...cc, peCurrent: Math.max(0, cc.peCurrent - calc!.peSpent) };
            if (calc!.omniFlagPatch) {
              next.omniFlags = { ...(next.omniFlags ?? {}), ...calc!.omniFlagPatch };
            }
            return next;
          }),
        }));

        return { ok: true, peSpent: calc.peSpent, logMessage: calc.logMessage };
      },
      activateSpecialAptitude: (charId, specialId, params) => {
        const state = get();
        const c = state.characters.find(x => x.id === charId);
        if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
        const owned = new Set(c.chosenClAptitudes ?? []);
        if (!owned.has(specialId)) return { ok: false, reason: 'Aptidão SPECIAL não adquirida.' };

        let calc: SpecialActivationResult | null = null;

        if (specialId === 'special-dominio-simples') {
          if (params.modo === 'dano') {
            calc = aplicarDanoDominioSimples(c, params.motivoDano ?? 'concentracao_falha');
          } else if (params.modo === 'dissipar') {
            calc = dissiparDominioSimples(c);
          } else {
            calc = calcularDominioSimples(c, { gatilho: params.gatilho ?? 'bonus' });
          }
        } else {
          return { ok: false, reason: 'Esta aptidão SPECIAL é passiva ou meta-habilidade.' };
        }

        if (!calc || !calc.ok) {
          return { ok: false, reason: calc?.reason ?? 'Falha ao calcular efeito.' };
        }

        set((s) => ({
          characters: s.characters.map((cc) => {
            if (cc.id !== charId) return cc;
            const next = { ...cc, peCurrent: Math.max(0, cc.peCurrent - calc!.peSpent) };
            if (calc!.omniFlagPatch) {
              next.omniFlags = { ...(next.omniFlags ?? {}), ...calc!.omniFlagPatch };
            }
            return next;
          }),
        }));

        return { ok: true, peSpent: calc.peSpent, logMessage: calc.logMessage, quebrou: calc.quebrou };
      },
      setAuraElement: (charId, auraId, element) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== charId) return c;
          const usage = { ...(c.auraAptitudeUsage ?? {}) } as Record<string, unknown>;
          const key = `${auraId}:element`;
          if (element === null) delete usage[key];
          else usage[key] = element;
          return { ...c, auraAptitudeUsage: usage as typeof c.auraAptitudeUsage };
        }),
      })),
      activateAuraAptitude: (charId, auraId) => {
        let result: { ok: boolean; reason?: string; peSpent?: number; usesLeft?: number } = { ok: false };
        // resolved via top-level import
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const apt = getAuraAptitudeById(auraId);
            if (!apt) { result = { ok: false, reason: 'Aptidão inexistente.' }; return c; }
            const peCost = resolveFixedPeCost(apt.peCost);
            if (peCost > 0 && c.peCurrent < peCost) {
              result = { ok: false, reason: `PE insuficiente (${c.peCurrent}/${peCost}).` }; return c;
            }
            let usesLeft: number | undefined;
            const usage = { ...(c.auraAptitudeUsage ?? {}) };
            if (apt.usage) {
              const max = resolveAuraUsageMax(apt.usage, {
                auLevel: c.cursedAptitudes?.AU ?? 0,
                clLevel: c.cursedAptitudes?.CL ?? 0,
                barLevel: c.cursedAptitudes?.BAR ?? 0,
                domLevel: c.cursedAptitudes?.DOM ?? 0,
                erLevel: c.cursedAptitudes?.ER ?? 0,
                trainingBonus: getTrainingBonusByLevel(c.level),
              });
              const used = usage[auraId] ?? 0;
              if (used >= max) {
                result = { ok: false, reason: `Sem usos (${used}/${max}).` }; return c;
              }
              usage[auraId] = used + 1;
              usesLeft = max - usage[auraId];
            }
            // Fase 7 — aptidões com duração concreta criam ActiveBuff de 1 rodada.
            // O efeito real (RD/imunidade/etc) é lido por `aggregateAuraEffects` via id.
            const TIMED_AURA_IDS = new Set(['aura_impenetravel', 'casulo_de_energia', 'aura_excessiva']);
            const buffs = [...(c.activeBuffs ?? [])];
            if (TIMED_AURA_IDS.has(auraId)) {
              const buffId = `aura_active:${auraId}`;
              // Substitui buff existente do mesmo tipo (renovação).
              const filtered = buffs.filter(b => b.id !== buffId);
              filtered.push({
                id: buffId,
                spellName: `Aura: ${apt.name}`,
                type: 'rd',
                value: 0, // efeito real lido via auraEffects pelo id
                remainingTurns: 1,
                isSustained: false,
                sourceCharId: c.id,
              });
              result = { ok: true, peSpent: peCost, usesLeft };
              return {
                ...c,
                peCurrent: Math.max(0, c.peCurrent - peCost),
                auraAptitudeUsage: usage,
                activeBuffs: filtered,
              };
            }
            result = { ok: true, peSpent: peCost, usesLeft };
            return {
              ...c,
              peCurrent: Math.max(0, c.peCurrent - peCost),
              auraAptitudeUsage: usage,
            };
          }),
        }));
        return result;
      },
      toggleAuraAptitude: (charId, auraId) => {
        let result: { ok: boolean; reason?: string; active?: boolean; peSpent?: number } = { ok: false };
        const buffId = `aura:${auraId}`;
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const apt = getAuraAptitudeById(auraId);
            if (!apt) { result = { ok: false, reason: 'Aptidão inexistente.' }; return c; }
            const buffs = c.activeBuffs ?? [];
            const isActive = buffs.some(b => b.id === buffId);
            if (isActive) {
              // Desligar
              result = { ok: true, active: false };
              return { ...c, activeBuffs: buffs.filter(b => b.id !== buffId) };
            }
            // Ligar
            const peCost = resolveFixedPeCost(apt.peCost);
            if (peCost > 0 && c.peCurrent < peCost) {
              result = { ok: false, reason: `PE insuficiente (${c.peCurrent}/${peCost}).` }; return c;
            }
            const newBuff: ActiveBuff = {
              id: buffId,
              spellName: `Aura: ${apt.name}`,
              type: 'rd', // marcador neutro; efeito real é lido por id em auraEffects
              value: 0,
              remainingTurns: -1, // sustentado até desligar
              peCostPerRound: apt.peUpkeep && apt.peUpkeep > 0 ? apt.peUpkeep : undefined,
              isSustained: true,
              sourceCharId: c.id,
            };
            result = { ok: true, active: true, peSpent: peCost };
            return {
              ...c,
              peCurrent: Math.max(0, c.peCurrent - peCost),
              activeBuffs: [...buffs, newBuff],
            };
          }),
        }));
        return result;
      },
      resetAuraAptitudeUsage: (charId, scope) => {
        // resolved via top-level import
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const usage = { ...(c.auraAptitudeUsage ?? {}) };
            for (const id of Object.keys(usage)) {
              const apt = getAuraAptitudeById(id);
              if (apt?.usage?.scope === scope) delete usage[id];
            }
            return { ...c, auraAptitudeUsage: usage };
          }),
        }));
      },
      tryNullifyCondition: (charId, tier) => {
        const PE_BY_TIER: Record<typeof tier, number> = { fraca: 2, media: 4, forte: 6, extrema: 10 };
        const peCost = PE_BY_TIER[tier];
        let result: { ok: boolean; reason?: string; peSpent?: number; usesLeft?: number } = { ok: false };
        const auraId = 'aura_anuladora';
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const apt = getAuraAptitudeById(auraId);
            if (!apt) { result = { ok: false, reason: 'Catálogo inválido.' }; return c; }
            if (!(c.chosenAuraAptitudes ?? []).includes(auraId)) {
              result = { ok: false, reason: 'Aura Anuladora não adquirida.' }; return c;
            }
            if (c.peCurrent < peCost) {
              result = { ok: false, reason: `PE insuficiente (${c.peCurrent}/${peCost}).` }; return c;
            }
            // Limite por descanso longo (treinamento).
            const usage = { ...(c.auraAptitudeUsage ?? {}) };
            const used = usage[auraId] ?? 0;
            const max = apt.usage
              ? resolveAuraUsageMax(apt.usage, {
                  auLevel: c.cursedAptitudes?.AU ?? 0,
                  clLevel: c.cursedAptitudes?.CL ?? 0,
                  barLevel: c.cursedAptitudes?.BAR ?? 0,
                  domLevel: c.cursedAptitudes?.DOM ?? 0,
                  erLevel: c.cursedAptitudes?.ER ?? 0,
                  trainingBonus: getTrainingBonusByLevel(c.level),
                })
              : 0;
            if (max > 0 && used >= max) {
              result = { ok: false, reason: `Sem usos (${used}/${max}).` }; return c;
            }
            usage[auraId] = used + 1;
            const usesLeft = max > 0 ? max - usage[auraId] : undefined;
            result = { ok: true, peSpent: peCost, usesLeft };
            return {
              ...c,
              peCurrent: Math.max(0, c.peCurrent - peCost),
              auraAptitudeUsage: usage,
            };
          }),
        }));
        return result;
      },
      armElementalAbsorption: (charId, element) => {
        let result: { ok: boolean; reason?: string; au?: number } = { ok: false };
        const auraId = 'absorcao_elemental';
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            if (!(c.chosenAuraAptitudes ?? []).includes(auraId)) {
              result = { ok: false, reason: 'Absorção Elemental não adquirida.' }; return c;
            }
            const au = c.cursedAptitudes?.AU ?? 0;
            result = { ok: true, au };
            return { ...c, pendingAbsorbedElement: { element, au } };
          }),
        }));
        return result;
      },
      consumeElementalAbsorption: (charId) => set((state) => ({
        characters: state.characters.map((c) =>
          c.id === charId ? { ...c, pendingAbsorbedElement: undefined } : c,
        ),
      })),
      armConcentratedAura: (charId) => {
        let result: { ok: boolean; reason?: string; au?: number } = { ok: false };
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            if (!(c.chosenAuraAptitudes ?? []).includes('concentrar_aura')) {
              result = { ok: false, reason: 'Concentrar Aura não adquirida.' }; return c;
            }
            const au = c.cursedAptitudes?.AU ?? 0;
            if (au <= 0) { result = { ok: false, reason: 'Sem Nível de AU.' }; return c; }
            const prev = c.concentratedAura?.au ?? 0;
            // Recarga substitui (não acumula entre cenas) — mantém último AU.
            result = { ok: true, au };
            return { ...c, concentratedAura: { au: Math.max(prev, au) } };
          }),
        }));
        return result;
      },
      consumeConcentratedAura: (charId) => {
        let used = 0;
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            used = c.concentratedAura?.au ?? 0;
            if (used <= 0) return c;
            return { ...c, concentratedAura: undefined };
          }),
        }));
        return { au: used };
      },
      // (Aura do Comandante já é aplicada via `applyComandanteToAllies` em AuraAptitudesPanel,
      // usando addBuff direto com remainingTurns:1 — mantemos esse caminho para evitar duplicação.)
      transferAuraTo: (sourceId, allyId, auraId) => {
        const state = get();
        const source = state.characters.find((c) => c.id === sourceId);
        if (!source) return { ok: false, reason: 'Personagem não encontrado.' };
        if (!(source.chosenAuraAptitudes ?? []).includes('transferencia_de_aura')) {
          return { ok: false, reason: 'Transferência de Aura não adquirida.' };
        }
        if (!(source.chosenAuraAptitudes ?? []).includes(auraId)) {
          return { ok: false, reason: 'Você não possui essa aptidão para transferir.' };
        }
        // Marca como buff sustentado especial — engine de auras do aliado pode
        // ler `transferredAuraIds` derivado dos activeBuffs com spellName="Transferência de Aura".
        const bid = `${Date.now()}-transf-${auraId}`;
        // Remove transferência anterior do mesmo source.
        set((s) => ({
          characters: s.characters.map((c) => ({
            ...c,
            activeBuffs: (c.activeBuffs ?? []).filter(
              (b) => !(b.isSustained && b.sourceCharId === sourceId && b.spellName === 'Transferência de Aura'),
            ),
          })),
        }));
        set((s) => ({
          characters: s.characters.map((c) => c.id !== allyId ? c : ({
            ...c,
            activeBuffs: [
              ...(c.activeBuffs ?? []),
              {
                id: bid,
                spellName: 'Transferência de Aura',
                targetName: auraId,
                type: 'attribute',
                value: 0,
                remainingTurns: -1,
                peCostPerRound: 1,
                sourceCharId: sourceId,
                isSustained: true,
              } as ActiveBuff,
            ],
          })),
        }));
        return { ok: true };
      },
      revokeTransferAura: (sourceId) => set((state) => ({
        characters: state.characters.map((c) => ({
          ...c,
          activeBuffs: (c.activeBuffs ?? []).filter(
            (b) => !(b.isSustained && b.sourceCharId === sourceId && b.spellName === 'Transferência de Aura'),
          ),
        })),
      })),
      triggerKokusen: (charId, round) => {
        let result: { ok: boolean; reason?: string; newStacks?: number; threshold?: number } = { ok: false };
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const owned = (c.chosenClAptitudes ?? []).includes('special-raio-negro')
              || (c.chosenAuraAptitudes ?? []).includes('special-raio-negro');
            if (!owned) {
              result = { ok: false, reason: 'Raio Negro não adquirido.' };
              return c;
            }
            const cl = c.cursedAptitudes?.CL ?? 0;
            const hasFaiscas = (c.chosenClAptitudes ?? []).includes('special-abencoado-faiscas-negras')
              || (c.chosenAuraAptitudes ?? []).includes('special-abencoado-faiscas-negras');
            const maxReductions = Math.floor(cl / 2) + (hasFaiscas ? 1 : 0);
            const baseCrit = hasFaiscas ? 19 : 20;
            const prevStacks = c.kokusenStacks ?? 0;
            const newStacks = Math.min(prevStacks + 1, maxReductions);
            const threshold = Math.max(2, baseCrit - newStacks);
            result = { ok: true, newStacks, threshold };
            return {
              ...c,
              kokusenStacks: newStacks,
              kokusenLastRound: round,
              kokusenSceneBuffActive: c.kokusenSceneBuffActive || hasFaiscas,
            };
          }),
        }));
        return result;
      },
      clearKokusenStacks: (charId) => set((state) => ({
        characters: state.characters.map((c) => (
          c.id === charId
            ? { ...c, kokusenStacks: 0, kokusenLastRound: undefined, kokusenSceneBuffActive: false }
            : c
        )),
      })),
      applyGroupHealing: (casterId, perSpent, distribution) => {
        let result: { ok: boolean; reason?: string; peSpent?: number; healed?: Record<string, number> } = { ok: false };
        const peCost = perSpent * 2;
        set((state) => {
          const caster = state.characters.find((cc) => cc.id === casterId);
          if (!caster) { result = { ok: false, reason: 'Conjurador não encontrado.' }; return state; }
          if ((caster.peCurrent ?? 0) < peCost) {
            result = { ok: false, reason: `PE insuficiente (${caster.peCurrent}/${peCost}).` };
            return state;
          }
          const healed: Record<string, number> = {};
          const characters = state.characters.map((c) => {
            let next = c;
            if (c.id === casterId) {
              next = { ...next, peCurrent: Math.max(0, next.peCurrent - peCost) };
            }
            const heal = distribution[c.id] ?? 0;
            if (heal > 0) {
              const newHp = Math.min(next.hpMax, next.hpCurrent + heal);
              healed[c.id] = newHp - next.hpCurrent;
              next = { ...next, hpCurrent: newHp };
            }
            return next;
          });
          result = { ok: true, peSpent: peCost, healed };
          return { ...state, characters };
        });
        return result;
      },
      castEnergiaReversaSelf: async (charId, perSpent, targetId, maximizeDice = 0) => {
        const c0 = get().characters.find(x => x.id === charId);
        if (!c0) return { ok: false, reason: 'Personagem não encontrado.' };
        const peCost = perSpent * 2;
        const owned0 = new Set(c0.chosenClAptitudes ?? []);
        if (!owned0.has('er-energia-reversa')) {
          return { ok: false, reason: 'Energia Reversa não adquirida.' };
        }
        const tgtId = targetId ?? charId;
        if (tgtId !== charId && !owned0.has('er-liberacao-energia-reversa')) {
          return { ok: false, reason: 'Curar outras criaturas exige Liberação de Energia Reversa.' };
        }
        if (!get().characters.some(x => x.id === tgtId)) {
          return { ok: false, reason: 'Alvo não encontrado.' };
        }
        if (tgtId !== charId) {
          const { useMapStore } = await import('@/stores/useMapStore');
          const { checkTouchTarget } = await import('@/lib/touchRange');
          const ms = useMapStore.getState();
          const why = checkTouchTarget(charId, tgtId, ms.entities, ms.gridConfig);
          if (why) return { ok: false, reason: why };
        }
        if (c0.peCurrent < peCost) {
          return { ok: false, reason: `PE insuficiente (${c0.peCurrent}/${peCost}).` };
        }
        const er0 = c0.cursedAptitudes?.ER ?? 0;
        const hasAmplificada = owned0.has('er-cura-amplificada');
        const hasGrupo = owned0.has('er-cura-em-grupo');
        let peLimit = hasAmplificada ? 1 + er0 : 1 + Math.floor(er0 / 2);
        if (hasGrupo) peLimit += 2;
        if (perSpent < 1 || perSpent > peLimit) {
          return { ok: false, reason: `PER fora do limite (1..${peLimit}).` };
        }
        // Dentro de combate, curar é uma Ação Comum.
        let inCombat = false;
        try {
          const { useCombatStore } = await import('@/stores/useCombatStore');
          inCombat = !!useCombatStore.getState().inCombat;
        } catch { /* sem combate */ }
        if (inCombat && (c0.actionsCurrent ?? 0) <= 0) {
          return { ok: false, reason: 'Sem Ação Comum disponível neste turno.' };
        }
        const die = hasAmplificada ? 8 : 6;
        const baseCount = perSpent * 2;
        let bonusDice = 0;
        if (c0.level >= 10) bonusDice += 1;
        if (c0.level >= 15) bonusDice += 1;
        if (c0.level >= 20) bonusDice += 1;
        const totalDiceCount = baseCount + bonusDice;
        const rolled = await rollDiceCom(charId, `${totalDiceCount}d${die}`);
        const { applyMedicinaInfalivel } = await import('@/lib/suporteAbilities');
        const med = applyMedicinaInfalivel(c0, rolled.rolls, die, maximizeDice);
        const rolls = med.rolls;
        const modMul = hasAmplificada ? 2 : 1;
        const pre = (c0.attributes ?? []).find(a => a.name === 'Presença');
        const sab = (c0.attributes ?? []).find(a => a.name === 'Sabedoria');
        const preMod = pre ? Math.floor((pre.value - 10) / 2) : -5;
        const sabMod = sab ? Math.floor((sab.value - 10) / 2) : -5;
        const usePre = preMod >= sabMod;
        const mod = (usePre ? preMod : sabMod) * modMul;
        const total = Math.max(1, rolls.reduce((a, b) => a + b, 0) + mod + med.flatBonus);
        let result: { ok: boolean; reason?: string; peSpent?: number; healed?: number; rolls?: number[]; mod?: number; key?: 'Presença' | 'Sabedoria' } = { ok: false };
        set((state) => ({
          characters: state.characters.map((c) => {
            let next = c;
            if (c.id === charId) {
              next = {
                ...next,
                peCurrent: Math.max(0, next.peCurrent - peCost),
                ...(inCombat ? { actionsCurrent: Math.max(0, (next.actionsCurrent ?? 0) - 1) } : {}),
                ...(med.used > 0 ? { medicinaInfalivelUsed: (next.medicinaInfalivelUsed ?? 0) + med.used } : {}),
              };
            }
            if (c.id === tgtId) {
              const newHp = Math.min(next.hpMax, next.hpCurrent + total);
              result = { ok: true, peSpent: peCost, healed: newHp - next.hpCurrent, rolls, mod, key: usePre ? 'Presença' : 'Sabedoria' };
              next = { ...next, hpCurrent: newHp };
            }
            return next;
          }),
        }));
        return result;
      },
      castRegeneracaoAprimorada: async (charId, mode, asFreeAction) => {
        const c0 = get().characters.find(x => x.id === charId);
        if (!c0) return { ok: false, reason: 'Personagem não encontrado.' };
        if (!(c0.chosenClAptitudes ?? []).includes('er-regeneracao-aprimorada')) {
          return { ok: false, reason: 'Regeneração Aprimorada não adquirida.' };
        }
        const er = c0.cursedAptitudes?.ER ?? 0;
        const perCostByMode: Record<string, number> = { ferimento: 8, veneno: 4, membro: 3 };
        const baseActionByMode: Record<string, 'action' | 'bonus'> = { ferimento: 'action', veneno: 'bonus', membro: 'bonus' };
        const perSpent = asFreeAction ? 10 : perCostByMode[mode];
        const peCost = perSpent * 2;
        if (asFreeAction && er < 5) return { ok: false, reason: 'Override Ação Livre exige ER 5.' };
        if (c0.peCurrent < peCost) return { ok: false, reason: `PE insuficiente (${c0.peCurrent}/${peCost}).` };
        if (!asFreeAction) {
          if (baseActionByMode[mode] === 'action' && c0.actionsCurrent <= 0) return { ok: false, reason: 'Sem Ação Comum disponível.' };
          if (baseActionByMode[mode] === 'bonus' && c0.bonusActionsCurrent <= 0) return { ok: false, reason: 'Sem Ação Bônus disponível.' };
        }
        const perEquivalente = Math.floor(perSpent / 2);
        const diceCount = perEquivalente * 2;
        const { rolls } = diceCount > 0
          ? await rollDiceCom(charId, `${diceCount}d8`)
          : { rolls: [] as number[] };
        let result: { ok: boolean; reason?: string; peSpent?: number; perSpent?: number; sideHeal?: { rolls: number[]; mod: number; total: number; perEquivalente: number } } = { ok: false };
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            let actions = c.actionsCurrent;
            let bonus = c.bonusActionsCurrent;
            if (!asFreeAction) {
              if (baseActionByMode[mode] === 'action') actions -= 1;
              else bonus -= 1;
            }
            const pre = (c.attributes ?? []).find(a => a.name === 'Presença');
            const sab = (c.attributes ?? []).find(a => a.name === 'Sabedoria');
            const preMod = pre ? Math.floor((pre.value - 10) / 2) : -5;
            const sabMod = sab ? Math.floor((sab.value - 10) / 2) : -5;
            const baseMod = Math.max(preMod, sabMod);
            const mod = baseMod * 2;
            const total = Math.max(0, rolls.reduce((a, b) => a + b, 0) + mod);
            const newHp = Math.min(c.hpMax, c.hpCurrent + total);
            result = {
              ok: true,
              peSpent: peCost,
              perSpent,
              sideHeal: { rolls, mod, total: newHp - c.hpCurrent, perEquivalente },
            };
            return {
              ...c,
              peCurrent: c.peCurrent - peCost,
              actionsCurrent: actions,
              bonusActionsCurrent: bonus,
              hpCurrent: newHp,
            };
          }),
        }));
        return result;
      },
      redirectMissedAttack: (charId) => {
        let result: { ok: boolean; reason?: string; bonus?: number; peSpent?: number } = { ok: false };
        const auraId = 'aura_redirecionadora';
        const PE_COST = 2;
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            if (!(c.chosenAuraAptitudes ?? []).includes(auraId)) {
              result = { ok: false, reason: 'Aura Redirecionadora não adquirida.' }; return c;
            }
            if (c.peCurrent < PE_COST) {
              result = { ok: false, reason: `PE insuficiente (${c.peCurrent}/${PE_COST}).` }; return c;
            }
            const au = c.cursedAptitudes?.AU ?? 0;
            const bonus = 1 + Math.floor(au / 2);
            result = { ok: true, peSpent: PE_COST, bonus };
            return { ...c, peCurrent: Math.max(0, c.peCurrent - PE_COST) };
          }),
        }));
        return result;
      },
      triggerAuraDrenadora: async (charId) => {
        const auraId = 'aura_drenadora';
        const c0 = get().characters.find((x) => x.id === charId);
        if (!c0) return { ok: false, reason: 'Personagem não encontrado.' };
        if (!(c0.chosenAuraAptitudes ?? []).includes(auraId)) {
          return { ok: false, reason: 'Aura Drenadora não adquirida.' };
        }
        const au = c0.cursedAptitudes?.AU ?? 0;
        if (au <= 0) return { ok: false, reason: 'AU 0 — sem dados a rolar.' };
        const conAttr = (c0.attributes ?? []).find(a => a.name === 'Constituição');
        const conMod = conAttr ? Math.floor(((conAttr.value ?? 10) - 10) / 2) : 0;
        const { rolls } = await rollDiceCom(charId, `${au}d8`);
        const total = Math.max(0, rolls.reduce((a, b) => a + b, 0) + conMod);
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id !== charId ? c : { ...c, escCurrent: (c.escCurrent ?? 0) + total },
          ),
        }));
        return { ok: true, rolls, conMod, total };
      },
      addAttribute: (charId, attr) => set((state) => ({ characters: state.characters.map((c) => c.id === charId ? { ...c, attributes: [...c.attributes, attr] } : c) })),
      removeAttribute: (charId, attrId) => set((state) => ({ characters: state.characters.map((c) => c.id === charId ? { ...c, attributes: c.attributes.filter((a) => a.id !== attrId) } : c) })),
      addSkill: (charId, skill) => set((state) => ({ characters: state.characters.map((c) => c.id === charId ? { ...c, skills: [...c.skills, skill] } : c) })),
      removeSkill: (charId, skillId) => set((state) => ({ characters: state.characters.map((c) => c.id === charId ? { ...c, skills: c.skills.filter((s) => s.id !== skillId) } : c) })),
      addSavingThrow: (charId, st) => set((state) => ({ characters: state.characters.map((c) => c.id === charId ? { ...c, savingThrows: [...(c.savingThrows || []), st] } : c) })),
      removeSavingThrow: (charId, stId) => set((state) => ({ characters: state.characters.map((c) => c.id === charId ? { ...c, savingThrows: (c.savingThrows || []).filter((s) => s.id !== stId) } : c) })),
      addPassive: (charId, passive) => set((state) => ({ characters: state.characters.map((c) => c.id === charId ? { ...c, passives: [...c.passives, passive] } : c) })),
      removePassive: (charId, passiveId) => set((state) => ({ characters: state.characters.map((c) => c.id === charId ? { ...c, passives: c.passives.filter((p) => p.id !== passiveId) } : c) })),
      addSpell: (charId, spell) => set((state) => ({ characters: state.characters.map((c) => c.id === charId ? { ...c, spells: [...c.spells, spell] } : c) })),
      updateSpell: (charId, spell) => set((state) => ({ characters: state.characters.map((c) => c.id === charId ? { ...c, spells: c.spells.map((s) => s.id === spell.id ? spell : s) } : c) })),
      removeSpell: (charId, spellId) => set((state) => ({ characters: state.characters.map((c) => c.id === charId ? { ...c, spells: c.spells.filter((s) => s.id !== spellId) } : c) })),
      addBuff: (charId, buff) => set((state) => ({
        characters: state.characters.map((c) => c.id === charId ? { ...c, activeBuffs: [...(c.activeBuffs || []), buff] } : c),
      })),
      removeBuff: (charId, buffId) => set((state) => ({
        characters: state.characters.map((c) => c.id === charId ? { ...c, activeBuffs: (c.activeBuffs || []).filter(b => b.id !== buffId) } : c),
      })),
      removeSustainedBuffsFrom: (sourceCharId) => set((state) => ({
        characters: state.characters.map((c) => ({
          ...c,
          activeBuffs: (c.activeBuffs || []).filter(b => !(b.isSustained && b.sourceCharId === sourceCharId)),
        })),
      })),
      addCondition: (charId, condition) => {
        const cadeia = capturarCadeiaOmni();
        const target = get().characters.find((c) => c.id === charId);
        // Talento "Atenção Infalível" / outros: bloqueia condições listadas em immunities.
        if (target) {
          if (isSurpresoCondition(condition) && isProtegidoPreAnalise(target, get().characters)) {
            useLogStore.getState().addLog('system', `🛡 ${target.name} não pode ser surpreendido (Pré-Análise).`);
            return;
          }
          const immunities = aggregateTalentBonuses(target).immunities;
          const condNorm = (condition.name ?? '').trim().toLowerCase();
          if (immunities.some((i) => i.trim().toLowerCase() === condNorm)) {
            useLogStore.getState().addLog('system', `🛡 ${target.name} é imune a [${condition.name}] (talento).`);
            return;
          }
          // 🛡 Imunidade Omni nativa (CONCEDER_IMUNIDADE).
          // Bloqueia por id, nome, categoria inteira ou "todas".
          if (omniTemImunidade(target, { id: condition.conditionId, name: condition.name })) {
            useLogStore.getState().addLog('system', `🛡 ${target.name} é imune a [${condition.name}] (Omni).`);
            return;
          }
        }
        set((state) => ({
          characters: state.characters.map((c) => c.id === charId ? { ...c, activeConditions: [...(c.activeConditions || []), { ...condition, elapsedRounds: 0 }] } : c),
        }));
        // ─── Omni-Engine: gatilho de condição recebida ─────────────────────
        import('@/lib/omni/eventBus').then(({ emitirEvento }) => {
          emitirEvento('aoReceberCondicao', {
            cadeia,
            usuarioId: charId,
            cena: {},
            origemNome: `Condição: ${condition.name}`,
            incluirPassivas: true,
          });
        });
        // Fase 9 — gatilho de Aura Anuladora: se o alvo possui a aptidão e tem PE,
        // enfileira prompt para o jogador escolher anular (com tier).
        if (target && (target.chosenAuraAptitudes ?? []).includes('aura_anuladora') && (target.peCurrent ?? 0) >= 2) {
          setTimeout(() => {
            import('@/stores/useReactionStore').then(({ useReactionStore }) => {
              useReactionStore.getState().enqueue({
                charId: target.id,
                charName: target.name,
                kind: 'nullify_offer',
                message: `${target.name} recebeu condição "${condition.name}" — Aura Anuladora disponível.`,
                payload: { conditionId: condition.id, conditionName: condition.name },
              });
            });
          }, 0);
        }
      },
      removeCondition: (charId, conditionInstanceId) => set((state) => ({
        characters: state.characters.map((c) => c.id === charId ? { ...c, activeConditions: (c.activeConditions || []).filter(cd => cd.id !== conditionInstanceId) } : c),
      })),
      tickBuffs: (charId) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== charId) return c;
          
          let peReduction = 0;
          const buffs = (c.activeBuffs || [])
            .map((b) => {
              if (b.peCostPerRound) peReduction += b.peCostPerRound;
              return { ...b, remainingTurns: b.remainingTurns === -1 ? -1 : b.remainingTurns - 1 };
            })
            .filter((b) => b.remainingTurns === -1 || b.remainingTurns > 0);

          // Decrementa cooldowns de feitiços (Técnica Máxima etc).
          const nextCooldowns: Record<string, number> = {};
          for (const [spellId, turns] of Object.entries(c.cooldowns || {})) {
            const next = Math.max(0, (turns as number) - 1);
            if (next > 0) nextCooldowns[spellId] = next;
          }

          return { 
            ...c, 
            activeBuffs: buffs,
            peCurrent: Math.max(0, c.peCurrent - peReduction),
            cooldowns: nextCooldowns,
          };
        }),
      })),
      tickConditions: (charId) => set((state) => ({
        characters: state.characters.map((c) => {
          if (c.id !== charId) return c;
          const conditions = (c.activeConditions || [])
            .map((cd) => ({ ...cd, remainingTurns: cd.remainingTurns === -1 ? -1 : cd.remainingTurns - 1 }))
            .filter((cd) => cd.remainingTurns === -1 || cd.remainingTurns > 0);
          return { ...c, activeConditions: conditions };
        }),
      })),
      tickAllBuffs: () => set((state) => ({
        characters: state.characters.map((c) => {
          let peReduction = 0;
          const buffs = (c.activeBuffs || [])
            .map((b) => {
              if (b.peCostPerRound) peReduction += b.peCostPerRound;
              return { ...b, remainingTurns: b.remainingTurns === -1 ? -1 : b.remainingTurns - 1 };
            })
            .filter((b) => b.remainingTurns === -1 || b.remainingTurns > 0);
          return { 
            ...c, 
            activeBuffs: buffs,
            peCurrent: Math.max(0, c.peCurrent - peReduction)
          };
        }),
      })),
      tickRoundConditions: () => set((state) => ({
        characters: state.characters.map((c) => ({
          ...c,
          ...expirarProtecoesOmni(c),
          activeConditions: (c.activeConditions || [])
            .map((cd) => ({ ...cd, remainingRounds: cd.remainingRounds === -1 ? -1 : cd.remainingRounds - 1,
              ...(typeof cd.elapsedRounds === 'number' && Number.isFinite(cd.elapsedRounds) && cd.elapsedRounds >= 0 ? { elapsedRounds: cd.elapsedRounds + 1 } : {}) }))
            .filter((cd) => cd.remainingRounds === -1 || cd.remainingRounds > 0),
        })),
      })),
      resetActions: () => set((state) => ({
        characters: state.characters.map((c) => ({
          ...c,
          actionsCurrent: c.actionsMax,
          bonusActionsCurrent: c.bonusActionsMax,
          reactionsCurrent: c.reactionsMax,
          opportunityCurrent: c.opportunityMax,
          weaponSwapsThisTurn: 0,
          attacksThisTurn: 0,
          lastAttackHit: undefined,
        })),
      })),
      recordAttackResult: (charId, hit, opts) => set((state) => ({
        characters: state.characters.map((c) =>
          c.id === charId
            ? {
                ...c,
                attacksThisTurn: opts?.replaceLast
                  ? (c.attacksThisTurn ?? 0)
                  : (c.attacksThisTurn ?? 0) + 1,
                lastAttackHit: hit,
              }
            : c,
        ),
      })),
      resetTurnStateFor: (charId) => set((state) => ({
        characters: state.characters.map((c) =>
          c.id === charId
            ? { ...c, attacksThisTurn: 0, lastAttackHit: undefined, weaponSwapsThisTurn: 0 }
            : c,
        ),
      })),
      resetAll: () => set({ characters: [] }),
      spendHitDie: async (charId) => {
        // Pre-resolve o dado via física 3D antes de mutar estado.
        const charBefore = get().characters.find((x) => x.id === charId);
        if (!charBefore) return { ok: false, reason: 'Personagem não encontrado.' };
        const die = charBefore.hpClassDie ?? getClassHitDie(charBefore.characterClass, charBefore.specialization) ?? 8;
        const { rolls } = await rollDice(`1d${die}`);
        const preRoll = rolls[0] ?? 0;
        let result: { ok: boolean; reason?: string; die?: number; roll?: number; conMod?: number; healed?: number } = { ok: false };
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const available = c.hitDiceCurrent ?? c.hitDiceMax ?? c.level;
            if (available <= 0) {
              result = { ok: false, reason: 'Sem Dados de Vida disponíveis.' };
              return c;
            }
            if (c.hpCurrent >= c.hpMax) {
              result = { ok: false, reason: 'PV já está no máximo.' };
              return c;
            }
            const conMod = getConMod(c);
            const healed = Math.max(1, preRoll + conMod);
            const newHp = Math.min(c.hpMax, c.hpCurrent + healed);
            const actualHealed = newHp - c.hpCurrent;
            result = { ok: true, die, roll: preRoll, conMod, healed: actualHealed };
            return {
              ...c,
              hpCurrent: newHp,
              hitDiceCurrent: available - 1,
            };
          }),
        }));
        return result;
      },
      applyShortRest: async (charId) => {
        // Pre-rola Economia de Energia (se aplicável) antes de mutar estado.
        const cBefore = get().characters.find((x) => x.id === charId);
        let preEconomia: number | undefined;
        if (cBefore) {
          const hasEconomia = (cBefore.chosenSpecAbilities ?? []).some(a => a.abilityId === 'tec-economia-de-energia');
          const hasEconomiaAvancada = (cBefore.chosenSpecAbilities ?? []).some(a => a.abilityId === 'tec-economia-de-energia-avancada');
          if (hasEconomia) {
            const baseDie = hasEconomiaAvancada ? 6 : 4;
            const die = scaledEconomiaDie(cBefore.level, baseDie);
            const { total } = await rollDice(`1d${die}`);
            preEconomia = total;
          }
        }
        let peRecovered = 0;
        let economiaRoll: number | undefined = preEconomia;
        set((state) => ({
          characters: state.characters.map((c0) => {
            const paPatch = preAnaliseShortRestPatch(c0, charId);
            const c = paPatch ? { ...c0, ...paPatch } : c0;
            if (c.id !== charId) return c;
            // Recupera 50% do PE máximo
            const halfPe = Math.floor(c.peMax / 2);
            const newPe = Math.min(c.peMax, c.peCurrent + halfPe);
            peRecovered = newPe - c.peCurrent;
            // Reseta usos rest_short
            const specUsage: Record<string, number> = {};
            for (const [aid, used] of Object.entries(c.specAbilityUsage ?? {})) {
              const ab = getSpecAbilityById(aid);
              if (ab?.usage?.scope !== 'rest_short') specUsage[aid] = used;
            }
            // Revigorar (EC Nv2): descanso curto devolve METADE dos usos máximos (p/ baixo).
            // Lógica inline para não criar ciclo de import com '@/lib/revigorar'.
            const revUsados = specUsage['ec-revigorar'];
            if (revUsados !== undefined) {
              const revMax = Math.max(1, getTrainingBonusByLevel(c.level ?? 1));
              const restante = Math.max(0, revUsados - Math.floor(revMax / 2));
              if (restante <= 0) delete specUsage['ec-revigorar'];
              else specUsage['ec-revigorar'] = restante;
            }


            const auraUsage: Record<string, number> = {};
            for (const [aid, used] of Object.entries(c.auraAptitudeUsage ?? {})) {
              const apt = getAuraAptitudeById(aid);
              if (apt?.usage?.scope !== 'rest_short') auraUsage[aid] = used;
            }
            const talentUsage: Record<string, number> = {};
            for (const [tid, used] of Object.entries(c.talentUsage ?? {})) {
              const t = getTalentById(tid);
              if (t?.usage?.scope !== 'rest_short') talentUsage[tid] = used;
            }
            const economiaPEReserve = preEconomia !== undefined ? preEconomia : c.economiaPEReserve;
            // Artes do Combate: descanso curto recupera metade do preparo máximo.
            const isEspCombate = c.specialization === 'Especialista em Combate';
            const sabA = (c.attributes ?? []).find((a) => a.name === 'Sabedoria');
            const sabM = sabA ? Math.floor((((sabA.value ?? 10) + (sabA.externalBonus ?? 0)) - 10) / 2) : 0;
            const prepMax = isEspCombate ? Math.max(0, (c.level ?? 1) + sabM) : 0;
            const newPreparo = isEspCombate
              ? Math.min(prepMax, (c.preparoCurrent ?? prepMax) + Math.floor(prepMax / 2))
              : c.preparoCurrent;
            return {
              ...c,
              peCurrent: newPe,
              preparoCurrent: newPreparo,
              tempPE: 0,
              specAbilityUsage: specUsage,
              auraAptitudeUsage: auraUsage,
              talentUsage,
              cooldowns: {},
              sacrificioCooldownRounds: 0,
              economiaPEReserve,
              restGrant: c.restGrant === 'short' ? null : c.restGrant,
              // Fase 2/4 — Estado vivo das Specs (descanso curto)
              aptitudeOnlyTempPE: 0,
              lastSpellUsedId: undefined,
              tecCombateAmaldicoadoActive: false,
              suporteHealUsed: 0,
              medicinaInfalivelUsed: 0,
              inspiracaoBonus: 0,
              // Inspirar Aliados: 1 vez por cena.
              inspirarUsadoCena: false,
              // Transmitir Conhecimento: treinamentos temporários expiram no descanso.
              ...(expireTransmitir(c) ?? {}),
              // Conceder Outra Chance (Suporte Nv 6): descanso curto recupera metade dos usos.
              outraChanceUsed: Math.max(
                0,
                (c.outraChanceUsed ?? 0) - Math.floor(getTrainingBonusByLevel(c.level ?? 1) / 2),
              ),
            };
          }),
        }));
        // 🆕 Omni — dispara aoDescansar (curto).
        import('@/lib/omni/eventBus').then(({ emitirEvento }) => {
          emitirEvento('aoDescansar', { usuarioId: charId, cena: { tipo: 1 /* curto */ }, incluirPassivas: true });
        });
        return { peRecovered, economiaRoll };
      },
      applyLongRest: async (charId, opts) => {
        const crafting = !!opts?.crafting;
        // Pre-rola Economia (longo) antes do set.
        const cBefore = get().characters.find((x) => x.id === charId);
        let preEconomia: number | undefined;
        if (cBefore) {
          const hasEconomia = (cBefore.chosenSpecAbilities ?? []).some(a => a.abilityId === 'tec-economia-de-energia');
          const hasEconomiaAvancada = (cBefore.chosenSpecAbilities ?? []).some(a => a.abilityId === 'tec-economia-de-energia-avancada');
          if (hasEconomia) {
            const baseDie = hasEconomiaAvancada ? 8 : 6;
            const die = scaledEconomiaDie(cBefore.level, baseDie);
            const { total } = await rollDice(`1d${die}`);
            preEconomia = total;
          }
        }
        let hpRecovered = 0;
        let peRecovered = 0;
        let hitDiceRecovered = 0;
        let economiaRoll: number | undefined = preEconomia;
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const hdMax = c.hitDiceMax ?? c.level;
            const hdCur = c.hitDiceCurrent ?? hdMax;
            let newHp: number;
            let newPe: number;
            let newHd: number;
            if (crafting) {
              newHp = Math.min(c.hpMax, c.hpCurrent + Math.floor(c.hpMax / 2));
              newPe = Math.min(c.peMax, c.peCurrent + Math.floor(c.peMax / 2));
              newHd = Math.min(hdMax, hdCur + Math.floor(hdMax / 2));
            } else {
              newHp = c.hpMax;
              newPe = c.peMax;
              newHd = hdMax;
            }
            hpRecovered = newHp - c.hpCurrent;
            peRecovered = newPe - c.peCurrent;
            hitDiceRecovered = newHd - hdCur;
            // Reseta rest_short E rest_long
            const specUsage: Record<string, number> = {};
            for (const [aid, used] of Object.entries(c.specAbilityUsage ?? {})) {
              const ab = getSpecAbilityById(aid);
              const sc = ab?.usage?.scope;
              if (sc !== 'rest_short' && sc !== 'rest_long') specUsage[aid] = used;
            }
            const auraUsage: Record<string, number> = {};
            for (const [aid, used] of Object.entries(c.auraAptitudeUsage ?? {})) {
              const apt = getAuraAptitudeById(aid);
              const sc = apt?.usage?.scope;
              if (sc !== 'rest_short' && sc !== 'rest_long') auraUsage[aid] = used;
            }
            const talentUsage: Record<string, number> = {};
            for (const [tid, used] of Object.entries(c.talentUsage ?? {})) {
              const t = getTalentById(tid);
              const sc = t?.usage?.scope;
              if (sc !== 'rest_short' && sc !== 'rest_long') talentUsage[tid] = used;
            }
            const economiaPEReserve = preEconomia !== undefined ? preEconomia : c.economiaPEReserve;
            // Memorização Imediata / Preparação de Técnicas — limpa flags antigas
            // e abre 2 slots de seleção para o jogador no painel pós-descanso.
            const hasPreparacao = (c.chosenSpecAbilities ?? []).some(a => a.abilityId === 'tec-preparacao-de-tecnicas');
            const clearedSpells = hasPreparacao
              ? c.spells.map((sp) => ({ ...sp, isPrepared: false }))
              : c.spells;
            const pendingPreparedSpellSlots = hasPreparacao ? 2 : 0;
            return {
              ...c,
              hpCurrent: newHp,
              peCurrent: newPe,
              // Artes do Combate: descanso longo recupera o preparo total.
              preparoCurrent: c.specialization === 'Especialista em Combate'
                ? Math.max(0, (c.level ?? 1) + Math.floor(((((c.attributes ?? []).find((a) => a.name === 'Sabedoria')?.value ?? 10) + ((c.attributes ?? []).find((a) => a.name === 'Sabedoria')?.externalBonus ?? 0)) - 10) / 2))
                : c.preparoCurrent,
              tempPE: 0,
              escCurrent: 0,
              protecoesOmni: [],
              posturaUsos: 0,
              posturaAtiva: null,
              hitDiceCurrent: newHd,
              specAbilityUsage: specUsage,
              auraAptitudeUsage: auraUsage,
              talentUsage,
              cooldowns: {},
              economiaPEReserve,
              // Crafting preserva penalidades narrativas (decisão do jogador).
              hpSacrificedTotal: crafting ? (c.hpSacrificedTotal ?? 0) : 0,
              empolgacaoMaxPenalty: crafting ? (c.empolgacaoMaxPenalty ?? 0) : 0,
              sacrificioCooldownRounds: crafting ? (c.sacrificioCooldownRounds ?? 0) : 0,
              sacrificioExhaustionTriggered: crafting ? (c.sacrificioExhaustionTriggered ?? false) : false,
              exhaustionLevel: crafting
                ? clampExh(c.exhaustionLevel)
                : Math.max(0, clampExh(c.exhaustionLevel) - 1),
              // Desmaio por exaustão: cada Descanso Longo decrementa em 1; ao chegar a 0 acorda.
              deathRestsRequired: crafting
                ? (c.deathRestsRequired ?? 0)
                : Math.max(0, (c.deathRestsRequired ?? 0) - 1),
              unconsciousFromExhaustion: crafting
                ? (c.unconsciousFromExhaustion ?? false)
                : (c.deathRestsRequired ?? 0) - 1 > 0,
              hunger: crafting ? (c.hunger ?? 24) : 24,
              // Fase 10 — Descanso longo encerra a cena: limpa Kokusen.
              kokusenStacks: 0,
              kokusenLastRound: undefined,
              kokusenSceneBuffActive: false,
              kokusenArmedDamage: false,
              // Talento "Discurso Motivador" — reseta lista de criaturas buffadas.
              discursoMotivadorUsedOn: [],
              restGrant: c.restGrant === 'long' ? null : c.restGrant,
              spells: clearedSpells,
              pendingPreparedSpellSlots,
              // FAH: Vigor Maldito + Alma Maldita resetam no Descanso Longo.
              vigorMalditoUses: c.origin === 'Feto Amaldiçoada Híbrido (FAH)'
                ? (c.vigorMalditoMax ?? calcVigorMalditoMax(c.level))
                : c.vigorMalditoUses,
              almaMalditaUses: c.origin === 'Feto Amaldiçoada Híbrido (FAH)'
                ? (c.almaMalditaMax ?? calcAlmaMalditaMax(c.level))
                : c.almaMalditaUses,
              // Derivado: a "Recuperação de Emergência" (1×/dia) reseta no Descanso Longo.
              derivadoEmergencyUsed: c.origin === 'Derivado' ? false : c.derivadoEmergencyUsed,
              // Talento "Determinado a Viver" reseta no Descanso Longo.
              determinadoAViverUsed: false,
              // Talento "Favorecido pela Sorte": pool de Sorte reseta no Descanso Longo.
              luckCurrent: c.luckMax != null ? c.luckMax : c.luckCurrent,
              // Inumaki / Restringido: pools diários atrelados ao Bônus de Treinamento.
              ...resetOriginDailyPools(c),
              // Fase 2/4 — Estado vivo das Specs (descanso longo)
              aptitudeOnlyTempPE: 0,
              lastSpellUsedId: undefined,
              tecCombateAmaldicoadoActive: false,
              suporteHealUsed: 0,
              medicinaInfalivelUsed: 0,
              inspiracaoBonus: 0,
              // Transmitir Conhecimento: treinamentos temporários expiram no descanso.
              ...(expireTransmitir(c) ?? {}),
              // Conceder Outra Chance (Suporte Nv 6): usos voltam no descanso longo.
              outraChanceUsed: 0,
            };
          }),
        }));
        // Sincroniza condições automáticas de exaustão no alvo (caso o nível mudou).
        const after = get().characters.find((x) => x.id === charId);
        if (after) get().setExhaustion(charId, clampExh(after.exhaustionLevel));
        // 🆕 Omni — dispara aoDescansar (longo). Passivas Seis Olhos zeram fadiga aqui.
        import('@/lib/omni/eventBus').then(({ emitirEvento }) => {
          emitirEvento('aoDescansar', { usuarioId: charId, cena: { tipo: 2 /* longo */ }, incluirPassivas: true });
        });
        return { hpRecovered, peRecovered, hitDiceRecovered, economiaRoll, crafting };
      },
      grantRest: (charId, mode) =>
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === charId ? { ...c, restGrant: mode } : c,
          ),
        })),
      clearRestGrant: (charId) =>
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === charId ? { ...c, restGrant: null } : c,
          ),
        })),
      setBlindfold: (charId, slot) => {
        const before = get().characters.find((c) => c.id === charId);
        const wasBlindfolded = !!before?.blindfoldSlot;
        const willBeBlindfolded = !!slot;
        const isToggle = wasBlindfolded !== willBeBlindfolded;
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === charId
              ? {
                  ...c,
                  blindfoldSlot: slot,
                  blindfoldTogglesThisRound: isToggle
                    ? (c.blindfoldTogglesThisRound ?? 0) + 1
                    : (c.blindfoldTogglesThisRound ?? 0),
                }
              : c,
          ),
        }));
        if (!isToggle) return;
        import('@/lib/omni/eventBus').then(({ emitirEvento }) => {
          emitirEvento(willBeBlindfolded ? 'aoVendar' : 'aoDescobrir', {
            usuarioId: charId,
            incluirPassivas: true,
          });
        });
      },
      setHasBlindfoldSlot: (charId, enabled) =>
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === charId
              ? {
                  ...c,
                  hasBlindfoldSlot: enabled,
                  ...(enabled
                    ? {}
                    : { blindfoldSlot: null, blindfoldTogglesThisRound: 0 }),
                }
              : c,
          ),
        })),
      resetSceneForCharacter: (charId) =>
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            // Resetar usos com scope: 'scene'
            const specUsage: Record<string, number> = {};
            for (const [aid, used] of Object.entries(c.specAbilityUsage ?? {})) {
              const ab = getSpecAbilityById(aid);
              if (ab?.usage?.scope !== 'scene') specUsage[aid] = used;
            }
            const auraUsage: Record<string, number> = {};
            for (const [aid, used] of Object.entries(c.auraAptitudeUsage ?? {})) {
              const apt = getAuraAptitudeById(aid);
              if (apt?.usage?.scope !== 'scene') auraUsage[aid] = used;
            }
            const talentUsage: Record<string, number> = {};
            for (const [tid, used] of Object.entries(c.talentUsage ?? {})) {
              const t = getTalentById(tid);
              if (t?.usage?.scope !== 'scene') talentUsage[tid] = used;
            }
            return {
              ...c,
              specAbilityUsage: specUsage,
              auraAptitudeUsage: auraUsage,
              talentUsage,
              tempPE: 0,
              // Suporte Nv 4 — usos por cena
              inspirarUsadoCena: false,
              negacaoCriticaUsed: 0,
              hpSacrificedTotal: 0,
              sacrificioExhaustionTriggered: false,
              sacrificioCooldownRounds: 0,
              kokusenStacks: 0,
              kokusenLastRound: undefined,
              kokusenSceneBuffActive: false,
              kokusenArmedDamage: false,
              // PV temporários (escudo/buff de cena) zeram com a cena
              escCurrent: 0,
              protecoesOmni: [],
              // Fase 2/4 — Estado vivo das Specs (cena)
              aptitudeOnlyTempPE: 0,
              lastSpellUsedId: undefined,
              tecCombateAmaldicoadoActive: false,
              suporteHealUsed: 0,
              medicinaInfalivelUsed: 0,
              // Presença Inspiradora: bônus de cena zera com a cena.
              inspiracaoBonus: 0,
              // Análise Profunda: 1 vez por criatura, por cena.
              analiseProfundaAlvos: [],
              // Desvendar Terreno: bônus e pedido duram só a cena.
              desvendarPending: false,
              desvendarCD: undefined,
              desvendarBonus: 0,
            };
          }),
        })),
      tickHunger: (currentHourKey, charge = true) => {
        // Snapshot que precisa atualizar via setExhaustion (que sincroniza condições/morte)
        const updates: Array<{ id: string; exhaustion: number }> = [];
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.category !== 'PLAYER') return c;
            const HUNGER_MAX = 24;
            const last = c.lastHungerHourKey;
            // Primeira inicialização: apenas registra o marcador, sem gastar.
            if (last === undefined) {
              return {
                ...c,
                hunger: c.hunger ?? HUNGER_MAX,
                lastHungerHourKey: currentHourKey,
              };
            }
            const deltaHours = currentHourKey - last;
            if (deltaHours === 0) return c;
            // Relógio voltou ou deu um salto enorme (troca de dispositivo, sincronização
            // com o relógio do Mestre, reset do calendário): apenas realinha o marcador,
            // sem cobrar fome — senão todos recebiam Exaustão até morrer.
            if (!charge || deltaHours < 0 || deltaHours >= HUNGER_MAX) {
              return { ...c, lastHungerHourKey: currentHourKey };
            }
            let hunger = c.hunger ?? HUNGER_MAX;
            let exhaustion = clampExh(c.exhaustionLevel);
            for (let i = 0; i < deltaHours; i++) {
              hunger -= 1;
              if (hunger <= 0) {
                exhaustion += 1;
                hunger = HUNGER_MAX;
              }
            }
            if (exhaustion !== clampExh(c.exhaustionLevel)) {
              updates.push({ id: c.id, exhaustion });
            }
            return {
              ...c,
              hunger,
              lastHungerHourKey: currentHourKey,
            };
          }),
        }));
        // Aplica via setExhaustion para acionar sincronização de condições/morte.
        for (const u of updates) get().setExhaustion(u.id, u.exhaustion);
      },
      setHunger: (charId, value) =>
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === charId
              ? { ...c, hunger: Math.max(0, Math.min(24, value)) }
              : c,
          ),
        })),
      tickDailyReset: (currentDayKey) =>
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.lastDailyResetKey === currentDayKey) return c;
            const specUsage: Record<string, number> = {};
            for (const [aid, used] of Object.entries(c.specAbilityUsage ?? {})) {
              const ab = getSpecAbilityById(aid);
              if (ab?.usage?.scope !== 'daily') specUsage[aid] = used;
            }
            const auraUsage: Record<string, number> = {};
            for (const [aid, used] of Object.entries(c.auraAptitudeUsage ?? {})) {
              const apt = getAuraAptitudeById(aid);
              if (apt?.usage?.scope !== 'daily') auraUsage[aid] = used;
            }
            const talentUsage: Record<string, number> = {};
            for (const [tid, used] of Object.entries(c.talentUsage ?? {})) {
              const t = getTalentById(tid);
              if (t?.usage?.scope !== 'daily') talentUsage[tid] = used;
            }
            return {
              ...c,
              specAbilityUsage: specUsage,
              auraAptitudeUsage: auraUsage,
              talentUsage,
              lastDailyResetKey: currentDayKey,
            };
          }),
        })),
      markPreparedSpells: (charId, spellIds) =>
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const set = new Set(spellIds);
            return {
              ...c,
              spells: c.spells.map((sp) => ({ ...sp, isPrepared: set.has(sp.id) })),
              pendingPreparedSpellSlots: 0,
            };
          }),
        })),
      consumeTalentUse: (charId, talentId) => {
        const c = get().characters.find((x) => x.id === charId);
        if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
        const t = getTalentById(talentId);
        if (!t) return { ok: false, reason: 'Talento desconhecido.' };
        if (!t.usage) return { ok: true }; // sem limite
        const tb = getTrainingBonusByLevel(c.level);
        const desAttr = (c.attributes ?? []).find(a => a.name.toUpperCase() === 'DES');
        const preAttr = (c.attributes ?? []).find(a => a.name === 'Presença');
        const desMod = desAttr ? Math.floor(((desAttr.value ?? 10) - 10) / 2) : 0;
        const preMod = preAttr ? Math.floor(((preAttr.value ?? 10) - 10) / 2) : 0;
        const max = resolveTalentUsageMax(t.usage, { trainingBonus: tb, desMod, preMod });
        const used = c.talentUsage?.[talentId] ?? 0;
        if (used >= max) return { ok: false, reason: `Sem usos disponíveis (${used}/${max}).` };
        const usesLeft = max - (used + 1);
        set((s) => ({
          characters: s.characters.map((x) =>
            x.id === charId
              ? {
                  ...x,
                  talentUsage: { ...(x.talentUsage ?? {}), [talentId]: used + 1 },
                }
              : x,
          ),
        }));
        return { ok: true, usesLeft };
      },
      recoverTalentUse: (charId, talentId) =>
        set((s) => ({
          characters: s.characters.map((x) => {
            if (x.id !== charId) return x;
            const t = getTalentById(talentId);
            if (!t?.usage) return x;
            const tb = getTrainingBonusByLevel(x.level);
            const desAttr = (x.attributes ?? []).find(a => a.name.toUpperCase() === 'DES');
            const preAttr = (x.attributes ?? []).find(a => a.name === 'Presença');
            const desMod = desAttr ? Math.floor(((desAttr.value ?? 10) - 10) / 2) : 0;
            const preMod = preAttr ? Math.floor(((preAttr.value ?? 10) - 10) / 2) : 0;
            const max = resolveTalentUsageMax(t.usage, { trainingBonus: tb, desMod, preMod });
            const used = x.talentUsage?.[talentId] ?? 0;
            const next = Math.max(0, Math.min(max, used - 1));
            return { ...x, talentUsage: { ...(x.talentUsage ?? {}), [talentId]: next } };
          }),
        })),
      setTalentChoice: (charId, talentId, key, value) =>
        set((s) => ({
          characters: s.characters.map((x) => {
            if (x.id !== charId) return x;
            const list = x.chosenTalents ?? [];
            const next = list.map(ct =>
              ct.id === talentId
                ? { ...ct, choices: { ...(ct.choices ?? {}), [key]: value } }
                : ct,
            );
            return { ...x, chosenTalents: next };
          }),
        })),
      equipWeapons: (charId, payload, ctx) => {
        const c = get().characters.find((x) => x.id === charId);
        if (!c) return { ok: false, reason: 'Personagem não encontrado.' };

        const mainName = (payload.mainHandName ?? '').trim() || null;
        const offName = (payload.offHandName ?? '').trim() || null;
        const mainW = mainName ? findWeaponByName(mainName) : null;
        const offW = offName ? findWeaponByName(offName) : null;

        if (mainName && !mainW) return { ok: false, reason: `Arma "${mainName}" não encontrada no catálogo.` };
        if (offName && !offW) return { ok: false, reason: `Arma "${offName}" não encontrada no catálogo.` };

        // Resolve a configuração final
        let finalMain: string | null = null;
        let finalOff: string | null = null;
        let weaponsCount = 0;

        if (mainW && offW) {
          // 2 armas distintas
          if (requiresTwoHands(mainW) || requiresTwoHands(offW)) {
            return { ok: false, reason: 'Arma de duas-mãos ocupa AMBOS os slots — não pode coexistir com outra.' };
          }
          const hasDualWieldTalent = (c.chosenTalents ?? []).some(t => t.id === 'tal-empunhadura-dupla');
          const bothNonLight = !isLight(mainW) && !isLight(offW);
          if (bothNonLight && !hasDualWieldTalent) {
            return { ok: false, reason: 'Para empunhar 2 armas não-leves, é necessário o talento "Técnicas de Empunhadura Dupla".' };
          }
          finalMain = mainW.name;
          finalOff = offW.name;
          weaponsCount = 2;
        } else if (mainW) {
          finalMain = mainW.name;
          // Duas-mãos ocupa o slot off também (mesmo nome) — sinaliza ocupação total.
          finalOff = requiresTwoHands(mainW) ? mainW.name : null;
          weaponsCount = 1;
        } else if (offW) {
          // Nada na principal mas algo na secundária = move pra principal.
          finalMain = offW.name;
          finalOff = requiresTwoHands(offW) ? offW.name : null;
          weaponsCount = 1;
        } else {
          // Desequipar tudo é sempre livre.
          weaponsCount = 0;
        }

        // Custo por TROCA: cada chamada de equipWeapons que mude a config
        // conta como 1 swap. 1ª swap do turno = livre; 2ª+ = Ação Bônus.
        const sameMain = (c.mainHandWeaponName ?? null) === finalMain;
        const sameOff = (c.offHandWeaponName ?? null) === finalOff;
        const noChange = sameMain && sameOff;

        let actionUsed: 'free' | 'bonus' | 'arremessador' | 'arsenal' = 'free';
        const arsRound = ctx?.inCombat ? (ctx.round ?? 1) : null;
        let nextSwapCount = c.weaponSwapsThisTurn ?? 0;

        // Estilo do Arremessador: sacar arma de arremesso faz parte do ataque (não conta troca).
        const drawn = [finalMain, finalOff].filter((n): n is string => !!n && n !== c.mainHandWeaponName && n !== c.offHandWeaponName);
        const arremessadorDraw = !noChange && drawn.length > 0 && hasCombatStyle(c, 'arremessador')
          && drawn.every((n) => { const w = findWeaponByName(n); return !!w && isThrownWeapon(w); });

        if (arremessadorDraw) {
          actionUsed = 'arremessador';
        } else if (!noChange) {
          const swapsSoFar = c.weaponSwapsThisTurn ?? 0;
          if (swapsSoFar >= 1 && arsRound !== null && arsenalTrocaLivreDisponivel(c, arsRound)) {
            actionUsed = 'arsenal';
          } else if (swapsSoFar >= 1) {
            // 2ª (ou mais) troca no mesmo turno → consome Ação Bônus
            if ((c.bonusActionsCurrent ?? 0) <= 0) {
              return { ok: false, reason: 'Sem Ação Bônus disponível para uma 2ª troca de arma neste turno.' };
            }
            actionUsed = 'bonus';
          }
          nextSwapCount = swapsSoFar + 1;
        }

        const newArsBonus = arsRound !== null && !noChange && finalMain !== c.mainHandWeaponName
          ? arsenalBonusAoTrocar(c, finalMain, arsRound) : null;
        set((s) => ({
          characters: s.characters.map((x) => {
            if (x.id !== charId) return x;
            return {
              ...x,
              ...(actionUsed === 'arsenal' ? { arsenalFreeSwapRound: arsRound ?? undefined } : {}),
              ...(newArsBonus ? { arsenalBonus: newArsBonus } : {}),
              mainHandWeaponName: finalMain,
              offHandWeaponName: finalOff,
              dualWielding: weaponsCount === 2,
              weaponSwapsThisTurn: nextSwapCount,
              bonusActionsCurrent: actionUsed === 'bonus'
                ? Math.max(0, (x.bonusActionsCurrent ?? 0) - 1)
                : (x.bonusActionsCurrent ?? 0),
            };
          }),
        }));

        return { ok: true, actionUsed, arsenalBonus: !!newArsBonus };
      },
      resetTalentUsage: (charId, scope) =>
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const next: Record<string, number> = {};
            for (const [tid, used] of Object.entries(c.talentUsage ?? {})) {
              const t = getTalentById(tid);
              if (t?.usage?.scope !== scope) next[tid] = used;
            }
            return { ...c, talentUsage: next };
          }),
        })),
      addTempPE: (charId, amount) =>
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === charId
              ? { ...c, tempPE: Math.max(0, (c.tempPE ?? 0) + amount) }
              : c,
          ),
        })),
      applyTurnStartSpecHooks: (charId) =>
        set((state) => ({
          characters: state.characters.map((c) => {
            if (c.id !== charId) return c;
            const eff = aggregateSpecAbilityEffects({
              chosenSpecAbilities: c.chosenSpecAbilities,
              attributes: c.attributes ?? [],
              level: c.level,
              keyAttribute: c.keyAttribute,
            });
            // Mestre das Aptidões: pool dedicado é REAPLICADO (não acumula).
            return { ...c, aptitudeOnlyTempPE: eff.aptitudeOnlyTempPEPerRound };
          }),
        })),
      tickSacrificioCooldown: () =>
        set((state) => ({
          characters: state.characters.map((c) => {
            const cd = c.sacrificioCooldownRounds ?? 0;
            if (cd <= 0) return c;
            return { ...c, sacrificioCooldownRounds: cd - 1 };
          }),
        })),
      spendPEForResistance: (charId, pe) => {
        const c = get().characters.find((x) => x.id === charId);
        if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
        const tb = getTrainingBonusByLevel(c.level);
        const maxPe = Math.floor(tb / 2);
        if (pe <= 0) return { ok: false, reason: 'Quantidade de PE inválida.' };
        if (pe > maxPe) return { ok: false, reason: `Limite por TR: ${maxPe} PE (½ Treinamento).` };
        const totalPE = (c.tempPE ?? 0) + c.peCurrent;
        if (totalPE < pe) return { ok: false, reason: `PE insuficiente (${totalPE}/${pe}).` };
        const patch = spendPEPatch(c, pe);
        set((s) => ({
          characters: s.characters.map((x) =>
            x.id === charId ? { ...x, tempPE: patch.tempPE, peCurrent: patch.peCurrent } : x,
          ),
        }));
        return { ok: true, bonus: pe * 2, peSpent: pe };
      },
      rollFurtividadeWithAuraBoost: async (charId) => {
        const c = get().characters.find((x) => x.id === charId);
        if (!c) return { ok: false, reason: 'Personagem não encontrado.' };
        const apts = { ...createDefaultCursedAptitudes(), ...(c.cursedAptitudes ?? {}) };
        const AU = apts.AU ?? 0;
        const hasAptitude = (c.chosenAuraAptitudes ?? []).includes('aura_controlada');
        if (!hasAptitude) return { ok: false, reason: 'Aura Controlada não adquirida.' };
        if (AU <= 0) return { ok: false, reason: 'Nível de Aptidão em Aura é 0.' };
        const totalPE = (c.tempPE ?? 0) + c.peCurrent;
        if (totalPE < 1) return { ok: false, reason: 'PE insuficiente (custo: 1).' };
        const skill = (c.skills ?? []).find((s) => {
          const n = (s.name ?? '').trim().toLowerCase();
          return n === 'furtividade';
        });
        const attr = (c.attributes ?? []).find((a) => a.name === skill?.linkedAttribute);
        const attrMod = attr ? Math.floor((attr.value - 10) / 2) : 0;
        const tb = getTrainingBonusByLevel(c.level);
        const train = skill?.trained ? tb : 0;
        const ext = skill?.externalBonus ?? 0;
        const auHalf = Math.floor(AU / 2);
        const baseSemAura = attrMod + train + ext;
        const roll = await rollD20Com(charId);
        const total = roll + baseSemAura + AU;
        const patch = spendAptitudePEPatch(c, 1);
        set((s) => ({
          characters: s.characters.map((x) =>
            x.id === charId ? { ...x, aptitudeOnlyTempPE: patch.aptitudeOnlyTempPE, tempPE: patch.tempPE, peCurrent: patch.peCurrent } : x,
          ),
        }));
        return { ok: true, roll, base: baseSemAura, auFull: AU, auHalfAlreadyApplied: auHalf, total };
      },

      // ============================================================
      //  GRAPPLE ENGINE
      // ============================================================
      grappleAttempt: async (attackerId, targetId, spendPEForAdvantage) => {
        const state = get();
        const att = state.characters.find((x) => x.id === attackerId);
        const tgt = state.characters.find((x) => x.id === targetId);
        if (!att || !tgt) return { ok: false, reason: 'Personagem não encontrado.' };
        if (attackerId === targetId) return { ok: false, reason: 'Não pode agarrar a si mesmo.' };
        const alreadyGrappling = (att.grappleState?.grappling ?? []).includes(targetId);
        if (alreadyGrappling) return { ok: false, reason: 'Já está agarrando este alvo.' };

        const skillBonus = (ch: Character, names: string[]): { bonus: number; name: string } => {
          for (const n of names) {
            const sk = (ch.skills ?? []).find((s) => (s.name ?? '').trim().toLowerCase() === n.toLowerCase());
            if (sk) {
              const attr = (ch.attributes ?? []).find((a) => a.name === sk.linkedAttribute);
              const mod = attr ? Math.floor((attr.value - 10) / 2) : 0;
              const tb = getTrainingBonusByLevel(ch.level);
              const train = sk.trained ? tb : 0;
              return { bonus: mod + train + (sk.externalBonus ?? 0), name: n };
            }
          }
          return { bonus: 0, name: names[0] };
        };

        const attApts = { ...createDefaultCursedAptitudes(), ...(att.cursedAptitudes ?? {}) };
        const auHalfAtt = (att.chosenAuraAptitudes ?? []).includes('aura_de_contencao')
          ? Math.floor((attApts.AU ?? 0) / 2)
          : 0;

        const attRoll = skillBonus(att, ['Atletismo']);
        const bonusAtt = attRoll.bonus + auHalfAtt;

        let advantageUsed = false;
        if (spendPEForAdvantage) {
          const totalPE = (att.tempPE ?? 0) + att.peCurrent;
          if (totalPE < 1) return { ok: false, reason: 'PE insuficiente para vantagem (custo: 1).' };
          advantageUsed = true;
        }
        const r1 = await rollD20Com(attackerId);
        const r2 = advantageUsed ? await rollD20Com(attackerId) : null;
        const rollAttFinal = r2 != null ? Math.max(r1, r2) : r1;
        const totalAtt = rollAttFinal + bonusAtt;

        const atlDef = skillBonus(tgt, ['Atletismo']);
        const acrDef = skillBonus(tgt, ['Acrobacia']);
        const useAcr = acrDef.bonus > atlDef.bonus;
        const defRoll = useAcr ? acrDef : atlDef;
        const rollDef = await rollD20Com(targetId);
        const totalDef = rollDef + defRoll.bonus;

        const success = totalAtt >= totalDef;

        set((s) => ({
          characters: s.characters.map((x) => {
            if (advantageUsed && x.id === attackerId) {
              const patch = spendAptitudePEPatch(x, 1);
              x = { ...x, aptitudeOnlyTempPE: patch.aptitudeOnlyTempPE, tempPE: patch.tempPE, peCurrent: patch.peCurrent };
            }
            if (!success) return x;
            if (x.id === attackerId) {
              const cur = x.grappleState ?? {};
              const grappling = Array.from(new Set([...(cur.grappling ?? []), targetId]));
              return { ...x, grappleState: { ...cur, grappling } };
            }
            if (x.id === targetId) {
              const cur = x.grappleState ?? {};
              const grappledBy = Array.from(new Set([...(cur.grappledBy ?? []), attackerId]));
              return { ...x, grappleState: { ...cur, grappledBy } };
            }
            return x;
          }),
        }));

        try {
          const advTxt = advantageUsed
            ? ` [vantagem: rolagens ${r1}/${r2} → escolheu ${rollAttFinal}]`
            : ` [d20=${r1}]`;
          const peTxt = advantageUsed ? ' (gastou 1 PE)' : '';
          const auTxt = auHalfAtt > 0 ? ` (inclui +${auHalfAtt} de ½AU Aura de Contenção)` : '';
          const verdict = success ? '✅ AGARRADO' : '❌ falhou';
          useLogStore.getState().addLog(
            'combat',
            `🤼 [Agarrão/tentativa] ${att.name} → ${tgt.name}${peTxt}: Atletismo ${rollAttFinal}+${bonusAtt}=${totalAtt}${advTxt}${auTxt} vs ${defRoll.name} ${rollDef}+${defRoll.bonus}=${totalDef} — ${verdict}.`,
          );
          if (success) {
            useLogStore.getState().addLog(
              'combat',
              `🔗 [Agarrão/vínculo] ${att.name} ↔ ${tgt.name}: vínculo criado (alvo agora tem desvantagem em ataques e movimento bloqueado).`,
            );
          }
        } catch { /* noop */ }

        return {
          ok: true,
          rollAtt: r2 != null ? [r1, r2] : [r1],
          bonusAtt,
          totalAtt,
          rollDef,
          bonusDef: defRoll.bonus,
          totalDef,
          defSkill: defRoll.name as 'Atletismo' | 'Acrobacia',
          success,
          advantageUsed,
        };
      },

      escapeGrapple: async (targetId, grapplerId, skill, spendPEForDisadvantage) => {
        const state = get();
        const tgt = state.characters.find((x) => x.id === targetId);
        const grp = state.characters.find((x) => x.id === grapplerId);
        if (!tgt || !grp) return { ok: false, reason: 'Personagem não encontrado.' };
        const isGrappled = (tgt.grappleState?.grappledBy ?? []).includes(grapplerId);
        if (!isGrappled) return { ok: false, reason: 'Este personagem não está agarrado por esse alvo.' };

        const skillBonusOne = (ch: Character, name: string): number => {
          const sk = (ch.skills ?? []).find((s) => (s.name ?? '').trim().toLowerCase() === name.toLowerCase());
          if (!sk) return 0;
          const attr = (ch.attributes ?? []).find((a) => a.name === sk.linkedAttribute);
          const mod = attr ? Math.floor((attr.value - 10) / 2) : 0;
          const tb = getTrainingBonusByLevel(ch.level);
          const train = sk.trained ? tb : 0;
          return mod + train + (sk.externalBonus ?? 0);
        };

        let disadvantageUsed = false;
        if (spendPEForDisadvantage) {
          const hasApt = (grp.chosenAuraAptitudes ?? []).includes('aura_de_contencao');
          if (!hasApt) return { ok: false, reason: 'Agarrador não possui Aura de Contenção.' };
          const totalPE = (grp.tempPE ?? 0) + grp.peCurrent;
          if (totalPE < 1) return { ok: false, reason: 'Agarrador sem PE para desvantagem.' };
          disadvantageUsed = true;
        }

        const bonusDef = skillBonusOne(tgt, skill);
        const r1 = await rollD20Com(targetId);
        const r2 = disadvantageUsed ? await rollD20Com(targetId) : null;
        const rollDefFinal = r2 != null ? Math.min(r1, r2) : r1;
        const totalDef = rollDefFinal + bonusDef;

        const grpApts = { ...createDefaultCursedAptitudes(), ...(grp.cursedAptitudes ?? {}) };
        const auHalfGrp = (grp.chosenAuraAptitudes ?? []).includes('aura_de_contencao')
          ? Math.floor((grpApts.AU ?? 0) / 2)
          : 0;
        const bonusAtt = skillBonusOne(grp, 'Atletismo') + auHalfGrp;
        const rollAtt = await rollD20Com(grapplerId);
        const totalAtt = rollAtt + bonusAtt;

        const success = totalDef > totalAtt;

        set((s) => ({
          characters: s.characters.map((x) => {
            if (disadvantageUsed && x.id === grapplerId) {
              const patch = spendAptitudePEPatch(x, 1);
              x = { ...x, aptitudeOnlyTempPE: patch.aptitudeOnlyTempPE, tempPE: patch.tempPE, peCurrent: patch.peCurrent };
            }
            if (!success) return x;
            if (x.id === targetId) {
              const cur = x.grappleState ?? {};
              const grappledBy = (cur.grappledBy ?? []).filter((id) => id !== grapplerId);
              return { ...x, grappleState: { ...cur, grappledBy } };
            }
            if (x.id === grapplerId) {
              const cur = x.grappleState ?? {};
              const grappling = (cur.grappling ?? []).filter((id) => id !== targetId);
              return { ...x, grappleState: { ...cur, grappling } };
            }
            return x;
          }),
        }));

        // ─── LOG DETALHADO: tentativa de escape ───
        try {
          const disTxt = disadvantageUsed
            ? ` [desvantagem: rolagens ${r1}/${r2} → escolheu ${rollDefFinal}]`
            : ` [d20=${r1}]`;
          const peTxt = disadvantageUsed ? ` (${grp.name} gastou 1 PE)` : '';
          const auTxt = auHalfGrp > 0 ? ` (oposição inclui +${auHalfGrp} de ½AU Aura de Contenção)` : '';
          const verdict = success ? '✅ ESCAPOU' : '❌ permanece agarrado';
          useLogStore.getState().addLog(
            'combat',
            `🏃 [Agarrão/fuga] ${tgt.name} vs ${grp.name}${peTxt}: ${skill} ${rollDefFinal}+${bonusDef}=${totalDef}${disTxt} vs Atletismo ${rollAtt}+${bonusAtt}=${totalAtt}${auTxt} — ${verdict} (empate favorece agarrador).`,
          );
          if (success) {
            useLogStore.getState().addLog(
              'combat',
              `🔓 [Agarrão/soltura] ${tgt.name} ↮ ${grp.name}: vínculo desfeito.`,
            );
          }
        } catch { /* noop */ }

        return {
          ok: true,
          rollDef: r2 != null ? [r1, r2] : [r1],
          bonusDef,
          totalDef,
          rollAtt,
          bonusAtt,
          totalAtt,
          success,
          disadvantageUsed,
        };
      },

      releaseGrapple: (attackerId, targetId) => {
        const before = get().characters;
        const att = before.find((x) => x.id === attackerId);
        const tgt = before.find((x) => x.id === targetId);
        const wasGrappling = !!att && (att.grappleState?.grappling ?? []).includes(targetId);
        set((s) => ({
          characters: s.characters.map((x) => {
            if (x.id === attackerId) {
              const cur = x.grappleState ?? {};
              return { ...x, grappleState: { ...cur, grappling: (cur.grappling ?? []).filter((id) => id !== targetId) } };
            }
            if (x.id === targetId) {
              const cur = x.grappleState ?? {};
              return { ...x, grappleState: { ...cur, grappledBy: (cur.grappledBy ?? []).filter((id) => id !== attackerId) } };
            }
            return x;
          }),
        }));
        if (wasGrappling && att && tgt) {
          try {
            useLogStore.getState().addLog(
              'combat',
              `🤝 [Agarrão/soltar] ${att.name} soltou ${tgt.name} voluntariamente — vínculo desfeito.`,
            );
          } catch { /* noop */ }
        }
      },

      releaseAllGrapplesOf: (charId) => {
        const c = get().characters.find((x) => x.id === charId);
        if (!c) return;
        const grappling = c.grappleState?.grappling ?? [];
        const grappledBy = c.grappleState?.grappledBy ?? [];
        const releaseTargetIds = new Set(grappling);
        const releaseGrapplerIds = new Set(grappledBy);
        set((s) => ({
          characters: s.characters.map((x) => {
            if (x.id === charId) {
              return { ...x, grappleState: { grappling: [], grappledBy: [] } };
            }
            if (releaseTargetIds.has(x.id)) {
              const cur = x.grappleState ?? {};
              return { ...x, grappleState: { ...cur, grappledBy: (cur.grappledBy ?? []).filter((id) => id !== charId) } };
            }
            if (releaseGrapplerIds.has(x.id)) {
              const cur = x.grappleState ?? {};
              return { ...x, grappleState: { ...cur, grappling: (cur.grappling ?? []).filter((id) => id !== charId) } };
            }
            return x;
          }),
        }));

        // ─── LOG DETALHADO: liberação em massa (chamado ao morrer/desmaiar) ───
        if (grappling.length > 0 || grappledBy.length > 0) {
          try {
            const allChars = get().characters;
            const nameOf = (cid: string) => allChars.find((x) => x.id === cid)?.name ?? '?';
            const parts: string[] = [];
            if (grappling.length > 0) parts.push(`liberou ${grappling.map(nameOf).join(', ')} (que ${grappling.length === 1 ? 'estava agarrado' : 'estavam agarrados'})`);
            if (grappledBy.length > 0) parts.push(`escapou de ${grappledBy.map(nameOf).join(', ')} (que ${grappledBy.length === 1 ? 'o agarrava' : 'o agarravam'})`);
            useLogStore.getState().addLog(
              'combat',
              `🔓 [Agarrão/soltar-todos] ${c.name}: ${parts.join('; ')}.`,
            );
          } catch { /* noop */ }
        }
      },

      isGrappled: (charId) => {
        const c = get().characters.find((x) => x.id === charId);
        return !!c && (c.grappleState?.grappledBy?.length ?? 0) > 0;
      },
    }),
    {
      name: 'rpg-characters',
      // Migração automática FAH: ao reidratar, garante que personagens com
      // origem "Feto Amaldiçoada Híbrido (FAH)" tenham os campos novos
      // (vigorMalditoUses/Max, anatomyFeatures, canHealWithCursedEnergy, etc.)
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const creatureIds = readGrimorioLinkedIds();
        state.characters = state.characters.map((c) => {
          let migrated = migrateSavingThrowNames(finalizeFAH(c));
          if (migrated.isGrimorioCreature || creatureIds.has(migrated.id)) {
            migrated = stripCreatureProgression({ ...migrated, isGrimorioCreature: true });
          }
          return migrated;
        });
      },
    }
  )
);

// Dev-only hook for browser tests (never in production builds).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__charStore = useCharacterStore;
}
