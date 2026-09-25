// ===== SPELL PROGRESSION & VALIDATION RULES =====

import type { SpellLevel, Passive, Specialization } from '@/types';
import { getTecnicaMaxSpellLevel } from '@/lib/tecnicaProgression';

/**
 * Resolve o nível de feitiço efetivo de uma passiva. Compatível com fichas
 * antigas que usavam o campo numérico `level` como "nível mínimo do jogador".
 * Mapeia o nível antigo para o nível de feitiço equivalente.
 */
export function getPassiveSpellLevel(p: Passive): SpellLevel {
  if (p.spellLevel) return p.spellLevel;
  if (typeof p.level === 'number') {
    if (p.level >= 17) return '5';
    if (p.level >= 13) return '4';
    if (p.level >= 9) return '3';
    if (p.level >= 5) return '2';
    return '1';
  }
  return '1';
}

/** Verifica se a passiva está ativa para o nível de jogador atual. */
export function isPassiveActive(p: Passive, charLevel: number): boolean {
  const sl = getPassiveSpellLevel(p);
  if (sl === 'Técnica Máxima' || sl === 'Técnica Reversa') return charLevel >= 17;
  const numLevel = parseInt(sl);
  if (isNaN(numLevel)) return true;
  return numLevel <= getMaxSpellLevel(charLevel);
}

/** PE cost by spell level */
export const PE_COST_BY_LEVEL: Record<string, number> = {
  '0': 0, '1': 2, '2': 5, '3': 8, '4': 12, '5': 20,
  'Técnica Máxima': 20, 'Técnica Reversa': 0, // Reversa = 1.5x original
};

/** Minimum PE cost (1 for all except level 0) */
export function getSpellPECost(level: SpellLevel, customPE?: number): number {
  if (customPE !== undefined && customPE !== null) return customPE;
  const base = PE_COST_BY_LEVEL[level] ?? 2;
  if (level as string === '0') return 0;
  return Math.max(1, base);
}

/**
 * Max spell level allowed by character level.
 * `spec` opcional: Especialista em Técnica usa 'Adiantar a Evolução' (gate próprio).
 */
export function getMaxSpellLevel(charLevel: number, spec?: Specialization): number {
  if (spec === 'Especialista em Técnica') return getTecnicaMaxSpellLevel(charLevel);
  if (charLevel >= 17) return 5;
  if (charLevel >= 13) return 4;
  if (charLevel >= 9) return 3;
  if (charLevel >= 5) return 2;
  return 1;
}

/** Check if a spell level is allowed for a character level (+ spec opcional). */
export function isSpellLevelAllowed(charLevel: number, spellLevel: SpellLevel, spec?: Specialization): boolean {
  if (spellLevel === 'Técnica Máxima' || spellLevel === 'Técnica Reversa') return true;
  const numLevel = parseInt(spellLevel);
  if (isNaN(numLevel)) return true;
  return numLevel <= getMaxSpellLevel(charLevel, spec);
}

/** Max number of spells a character can have */
export function getMaxSpells(charLevel: number): number {
  // Base: 2, +1 at every even level, +1 bonus at levels 10 and 20
  let count = 2;
  for (let i = 2; i <= charLevel; i += 2) {
    count += 1;
  }
  if (charLevel >= 10) count += 1;
  if (charLevel >= 20) count += 1;
  return count;
}

/** Max spell swaps per level = training bonus (level-dependent) */
export function getMaxSwaps(charLevel: number): number {
  // Training bonus: proficiency-like, scales with level
  return Math.max(1, Math.floor((charLevel - 1) / 4) + 1);
}

/** Spell level labels for lock display */
export const LEVEL_LOCK_LABELS: Record<number, string> = {
  1: 'Nv.1-4: até Nível 1',
  2: 'Nv.5-8: até Nível 2',
  3: 'Nv.9-12: até Nível 3',
  4: 'Nv.13-16: até Nível 4',
  5: 'Nv.17-20: até Nível 5',
};

/** Get allowed spell levels as array for a character level */
export function getAllowedSpellLevels(charLevel: number): SpellLevel[] {
  const max = getMaxSpellLevel(charLevel);
  const levels: SpellLevel[] = [];
  for (let i = 1; i <= max; i++) {
    levels.push(String(i) as SpellLevel);
  }
  levels.push('Técnica Máxima', 'Técnica Reversa');
  return levels;
}

/** Area size by spell level (sphere/cone standard) */
export const AREA_SIZE_BY_LEVEL: Record<string, number> = {
  '1': 4.5, '2': 6, '3': 9, '4': 12, '5': 18, 'Técnica Máxima': 24,
};

/** Line area multiplier: 1.5x the standard area */
export function getLineAreaSize(baseArea: number): number {
  return baseArea * 1.5;
}

/** Bonus dice for line shape spells */
export function getLineBonusDice(spellLevel: string): number {
  const lv = parseInt(spellLevel);
  if (lv === 1) return 1;
  if (lv === 2 || lv === 3) return 2;
  if (lv === 4 || lv === 5) return 4;
  if (spellLevel === 'Técnica Máxima') return 4;
  return 0;
}

/** Action type dice modifier for damage spells */
export function getActionTypeDiceModifier(actionType: string, spellLevel: string): number {
  const lv = parseInt(spellLevel);
  const effectiveLevel = isNaN(lv) ? (spellLevel === 'Técnica Máxima' ? 5 : 0) : lv;
  if (actionType === 'full') return effectiveLevel; // +spell level dice
  if (actionType === 'bonus') return -(1 + effectiveLevel); // -(1 + spell level) dice
  return 0;
}
