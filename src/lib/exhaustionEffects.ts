/**
 * Sistema de Exaustão (0..6).
 *
 * Penalidades escalonáveis:
 *  - Deslocamento: -1.5m por nível
 *  - Rolagens (ataque/perícia/atributo/TR): -1 * nível
 *  - Defesa e CD: -1 * nível
 *
 * Condições automáticas (cumulativas):
 *  - Lv >= 2: Desprevenido
 *  - Lv >= 3: Exposto
 *  - Lv >= 4: Condenado, Desorientado
 *  - Lv >= 5: Enjoado
 *  - Lv == 6: Morto (HP -> 0)
 *
 * Redução de Vida Máxima (aplicada apenas sobre o HP base, NÃO sobre escudo/PVT):
 *  - Lv 3 ou 4: max(20, hpMaxBase / 4)
 *  - Lv 5     : max(50, hpMaxBase / 2)
 *  - Lv 6     : HP zero (morte instantânea)
 *
 * Recuperação: Descanso Longo reduz 1 nível (já implementado em applyLongRest).
 */

import type { Character } from '@/types';

export const EXHAUSTION_MIN = 0;
export const EXHAUSTION_MAX = 6;

/** IDs de condição automaticamente aplicadas conforme o nível de exaustão. */
export function getExhaustionAutoConditionIds(level: number): string[] {
  const lv = clampExh(level);
  const ids: string[] = [];
  if (lv >= 2) ids.push('desprevenido');
  if (lv >= 3) ids.push('exposto');
  if (lv >= 4) ids.push('condenado', 'desorientado');
  if (lv >= 5) ids.push('enjoado');
  if (lv >= 6) ids.push('morto');
  return ids;
}

export function clampExh(level: number | undefined | null): number {
  const n = Math.floor(level ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(EXHAUSTION_MIN, Math.min(EXHAUSTION_MAX, n));
}

export interface ExhaustionMods {
  /** Penalidade universal em rolagens (ataque/perícia/atributo/TR). Sempre <=0. */
  roll: number;
  /** Penalidade em Defesa e CD. Sempre <=0. */
  defense: number;
  /** Penalidade no deslocamento (em metros). Sempre <=0. */
  movement: number;
  /** Redução do HP máximo BASE (não toca em escudo/PVT). Sempre >=0. */
  hpMaxReduction: number;
  /** Texto humano para tooltips/log. */
  notes: string[];
}

const EMPTY: ExhaustionMods = { roll: 0, defense: 0, movement: 0, hpMaxReduction: 0, notes: [] };

/** Calcula a redução de HP máximo BASE (não inclui escudo/PVT). */
export function getExhaustionHpReduction(level: number, hpMaxBase: number): number {
  const lv = clampExh(level);
  if (lv >= 6) return Math.max(0, hpMaxBase); // morte instantânea
  if (lv >= 5) return Math.floor(Math.max(50, hpMaxBase / 2));
  if (lv >= 3) return Math.floor(Math.max(20, hpMaxBase / 4));
  return 0;
}

export function getExhaustionMods(c: Pick<Character, 'exhaustionLevel' | 'hpMax'> | undefined | null): ExhaustionMods {
  if (!c) return { ...EMPTY };
  const lv = clampExh(c.exhaustionLevel);
  if (lv === 0) return { ...EMPTY };
  const out: ExhaustionMods = {
    roll: -lv,
    defense: -lv,
    movement: -1.5 * lv,
    hpMaxReduction: getExhaustionHpReduction(lv, c.hpMax ?? 0),
    notes: [`Exaustão ${lv} (-${lv} rolagens, -${lv} Def/CD, ${(-1.5 * lv).toFixed(1)}m mov.)`],
  };
  return out;
}

/**
 * Sincroniza as condições "automáticas" derivadas da exaustão na lista
 * `activeConditions` do personagem. Idempotente: adiciona as faltantes (com
 * `id = 'exh:<conditionId>'`) e remove as que não se aplicam mais (mesmo prefixo).
 *
 * Nunca remove condições aplicadas manualmente (por feitiço/Mestre) que tenham
 * `id` próprio — só toca nas instâncias prefixadas com `exh:`.
 */
export function syncExhaustionConditions<T extends Character>(c: T): T {
  const lv = clampExh(c.exhaustionLevel);
  const want = new Set(getExhaustionAutoConditionIds(lv));
  const existing = c.activeConditions ?? [];
  const others = existing.filter((cd) => !cd.id?.startsWith?.('exh:'));
  const auto = Array.from(want).map((cid) => ({
    id: `exh:${cid}`,
    conditionId: cid,
    name: cid,
    icon: '⚠',
    remainingTurns: -1,
    remainingRounds: -1,
    sourceCharName: 'Exaustão',
  }));
  return { ...c, activeConditions: [...others, ...auto] };
}
