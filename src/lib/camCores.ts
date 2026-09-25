/**
 * ============================================================================
 *  CAM CORES — Sistema de Múltiplos Núcleos (Corpo Amaldiçoado Mutante)
 * ============================================================================
 *  Funções puras para manipular o triplo snapshot de núcleos do CAM.
 *  Mantém a regra: o Character "raiz" SEMPRE espelha o núcleo ATIVO; trocas
 *  de núcleo apenas projetam o snapshot do alvo nos campos raiz, com a
 *  fórmula de reajuste de HP/PE em combate.
 *
 *  Princípios:
 *   • Snapshot completo por núcleo (atributos, spells, passives, HP/PE máx/atual,
 *     specialization, flags damaged/destroyed).
 *   • Cap matemático: nenhum secundário ultrapassa o hpMax/peMax do PRIMÁRIO.
 *   • Integridade da Alma compartilhada = floor((Σ hpMax) / 2). Dano DAL
 *     reduz simultaneamente os hpMax dos 3.
 *   • Destruição absoluta (PV negativo == hpMax) marca destroyed=true → aba some.
 * ============================================================================
 */

import type { Attribute, CamCore, Character, CoreId, Passive, Spell, Specialization } from '@/types';
import { CORE_IDS } from '@/types';

/** Tetos do PRIMÁRIO aplicados aos secundários. */
function capToPrimary(value: number, primaryMax: number): number {
  return Math.min(value, primaryMax);
}

/**
 * Cria um snapshot inicial dos 3 núcleos a partir dos valores base do wizard.
 * O primeiro núcleo selecionado como `primaryId` define o teto absoluto; os
 * demais são limitados a esse valor.
 */
export function buildInitialCores(args: {
  primaryId: CoreId;
  baseHpMax: number;
  basePeMax: number;
  attributesPerCore: Record<CoreId, Attribute[]>;
  specPerCore: Record<CoreId, Specialization>;
  spellsPerCore?: Partial<Record<CoreId, Spell[]>>;
  passivesPerCore?: Partial<Record<CoreId, Passive[]>>;
  hpPerCore?: Partial<Record<CoreId, number>>;
  pePerCore?: Partial<Record<CoreId, number>>;
}): CamCore[] {
  const primaryHp = args.hpPerCore?.[args.primaryId] ?? args.baseHpMax;
  const primaryPe = args.pePerCore?.[args.primaryId] ?? args.basePeMax;
  return CORE_IDS.map((id, i) => {
    const isPrimary = id === args.primaryId;
    const rawHp = args.hpPerCore?.[id] ?? args.baseHpMax;
    const rawPe = args.pePerCore?.[id] ?? args.basePeMax;
    const hpMax = isPrimary ? rawHp : capToPrimary(rawHp, primaryHp);
    const peMax = isPrimary ? rawPe : capToPrimary(rawPe, primaryPe);
    return {
      id,
      name: `Núcleo ${['I', 'II', 'III'][i]}`,
      specialization: args.specPerCore[id],
      attributes: args.attributesPerCore[id],
      spells: args.spellsPerCore?.[id] ?? [],
      passives: args.passivesPerCore?.[id] ?? [],
      hpMax,
      peMax,
      hpCurrent: hpMax,
      peCurrent: peMax,
      damaged: false,
      destroyed: false,
    };
  });
}

/**
 * Re-aplica o cap do primário a todos os secundários. Use após qualquer
 * mutação que possa elevar hpMax/peMax (ex.: level up, passiva).
 */
export function enforcePrimaryCap(cores: CamCore[], primaryId: CoreId): CamCore[] {
  const primary = cores.find(c => c.id === primaryId);
  if (!primary) return cores;
  return cores.map(co => {
    if (co.id === primaryId || co.destroyed) return co;
    const hpMax = capToPrimary(co.hpMax, primary.hpMax);
    const peMax = capToPrimary(co.peMax, primary.peMax);
    return {
      ...co,
      hpMax,
      peMax,
      hpCurrent: Math.min(co.hpCurrent, hpMax),
      peCurrent: Math.min(co.peCurrent, peMax),
    };
  });
}

/** Calcula a Integridade da Alma máxima = floor((Σ hpMax) / 2). */
export function calcSoulIntegrityMax(cores: CamCore[]): number {
  const sum = cores.reduce((s, co) => s + (co.destroyed ? 0 : co.hpMax), 0);
  return Math.floor(sum / 2);
}

/**
 * "Achata" o snapshot do núcleo ATIVO nos campos raiz do Character. Mantém
 * em `cores[]` o estado dos 3 (incluindo o atual, que é re-gravado abaixo).
 */
export function projectActiveCore(c: Character): Partial<Character> {
  if (!c.cores || c.cores.length === 0 || !c.activeCoreId) return {};
  const active = c.cores.find(co => co.id === c.activeCoreId);
  if (!active) return {};
  return {
    attributes: active.attributes,
    spells: active.spells,
    passives: active.passives,
    specialization: active.specialization,
    hpMax: active.hpMax,
    peMax: active.peMax,
    hpCurrent: active.hpCurrent,
    peCurrent: active.peCurrent,
  };
}

/**
 * Antes de trocar de núcleo, persiste o estado atual (HP/PE/atributos/spells)
 * no snapshot do núcleo que ESTAVA ativo. É o passo "save" da troca.
 */
export function persistActiveIntoSnapshot(c: Character): CamCore[] {
  if (!c.cores || !c.activeCoreId) return c.cores ?? [];
  return c.cores.map(co => {
    if (co.id !== c.activeCoreId) return co;
    return {
      ...co,
      attributes: c.attributes,
      spells: c.spells,
      passives: c.passives,
      specialization: c.specialization,
      hpMax: c.hpMax,
      peMax: c.peMax,
      hpCurrent: c.hpCurrent,
      peCurrent: c.peCurrent,
    };
  });
}

/**
 * Fórmula de troca em combate (briefing §3):
 *   NovoPVAtual = PVAtualAnterior - (MaxPVAnterior - MaxPVNovo)
 *
 * Implementação:
 *  1. Persiste o snapshot do ativo atual.
 *  2. Aplica a fórmula no HP e PE do núcleo-alvo.
 *  3. Promove o alvo a ativo (projeta nos campos raiz).
 *
 * Retorna `null` se a troca for proibida (núcleo destruído, danificado, ou
 * o personagem está "Morrendo").
 */
export function switchCoreInCombat(
  c: Character,
  targetCoreId: CoreId,
): Partial<Character> | null {
  if (!c.cores || !c.activeCoreId) return null;
  if (c.dying) return null;
  const target = c.cores.find(co => co.id === targetCoreId);
  if (!target || target.destroyed || target.damaged) return null;
  if (targetCoreId === c.activeCoreId) return null;

  const persisted = persistActiveIntoSnapshot(c);
  const previousMaxHp = c.hpMax;
  const previousMaxPe = c.peMax;
  const previousCurHp = c.hpCurrent;
  const previousCurPe = c.peCurrent;

  // Fórmula: NovoAtual = AtualAnterior - (MaxAnterior - MaxNovo).
  // Limita entre 0 e o novo Max.
  const computeNewCurrent = (curOld: number, maxOld: number, maxNew: number) =>
    Math.max(0, Math.min(maxNew, curOld - (maxOld - maxNew)));

  const newHpCurrent = computeNewCurrent(previousCurHp, previousMaxHp, target.hpMax);
  const newPeCurrent = computeNewCurrent(previousCurPe, previousMaxPe, target.peMax);

  const updatedCores = persisted.map(co =>
    co.id === targetCoreId ? { ...co, hpCurrent: newHpCurrent, peCurrent: newPeCurrent } : co,
  );

  const newActive = updatedCores.find(co => co.id === targetCoreId)!;

  return {
    cores: updatedCores,
    activeCoreId: targetCoreId,
    attributes: newActive.attributes,
    spells: newActive.spells,
    passives: newActive.passives,
    specialization: newActive.specialization,
    hpMax: newActive.hpMax,
    peMax: newActive.peMax,
    hpCurrent: newHpCurrent,
    peCurrent: newPeCurrent,
  };
}

/**
 * Reduz a Integridade da Alma e propaga o impacto: cada ponto de dano DAL
 * subtrai 1 do hpMax dos 3 núcleos simultaneamente (briefing §3).
 *
 * Se a Integridade chegar a 0, marca todos os núcleos como destroyed (morte
 * total do personagem).
 */
export function applySoulDamage(c: Character, amount: number): Partial<Character> {
  if (!c.cores) return {};
  const newSoul = Math.max(0, (c.soulIntegrityCurrent ?? 0) - amount);
  const newCores = c.cores.map(co => {
    if (co.destroyed) return co;
    const newMax = Math.max(0, co.hpMax - amount);
    return {
      ...co,
      hpMax: newMax,
      hpCurrent: Math.min(co.hpCurrent, newMax),
      destroyed: co.destroyed || newSoul === 0,
    };
  });
  const projection = projectActiveCoreFromList(newCores, c.activeCoreId);
  return {
    cores: newCores,
    soulIntegrityCurrent: newSoul,
    soulIntegrityMax: calcSoulIntegrityMax(newCores),
    ...projection,
  };
}

function projectActiveCoreFromList(cores: CamCore[], activeId?: CoreId): Partial<Character> {
  if (!activeId) return {};
  const a = cores.find(co => co.id === activeId);
  if (!a) return {};
  return {
    hpMax: a.hpMax,
    peMax: a.peMax,
    hpCurrent: a.hpCurrent,
    peCurrent: a.peCurrent,
  };
}

/**
 * Reage a uma queda do núcleo ATIVO (HP <= 0 fora de combate ou após recusar
 * a Reação): marca damaged=true e, se PV negativo == hpMax, destroyed=true.
 *
 * Esta função NÃO promove troca — quem decide é a UI (modal de morte reativa).
 */
export function markCoreFallen(cores: CamCore[], coreId: CoreId, currentHp: number): CamCore[] {
  return cores.map(co => {
    if (co.id !== coreId) return co;
    const negativeOverflow = -Math.min(0, currentHp);
    const destroyed = negativeOverflow >= co.hpMax;
    return {
      ...co,
      damaged: true,
      hpCurrent: Math.max(-co.hpMax, currentHp),
      destroyed: destroyed || co.destroyed,
    };
  });
}

/**
 * Aplica cura a um núcleo específico (ativo ou inativo). Cura suficiente
 * remove a marca [DANIFICADO]. Núcleo destruído NÃO pode ser curado.
 */
export function healCoreSnapshot(cores: CamCore[], coreId: CoreId, amount: number): CamCore[] {
  return cores.map(co => {
    if (co.id !== coreId || co.destroyed) return co;
    const newHp = Math.min(co.hpMax, co.hpCurrent + amount);
    return {
      ...co,
      hpCurrent: newHp,
      damaged: newHp <= 0 ? co.damaged : false,
    };
  });
}

/**
 * Tamanho narrativo do CAM em função do nível.
 *  • Nv 1-5  → Pequeno
 *  • Nv 6-14 → Médio
 *  • Nv 15+  → Pode escolher Grande (UI exibe botão)
 */
export function defaultSizeForLevel(level: number, current?: 'Pequeno' | 'Médio' | 'Grande'): 'Pequeno' | 'Médio' | 'Grande' {
  if (level >= 15 && current === 'Grande') return 'Grande';
  if (level >= 6) return 'Médio';
  return 'Pequeno';
}

/** Helper: o personagem é CAM ativo (origem + núcleos materializados)? */
export function isCamActive(c: Character): boolean {
  return c.origin === 'Corpo Amaldiçoado Mutante (CAM)' && Array.isArray(c.cores) && c.cores.length > 0;
}
