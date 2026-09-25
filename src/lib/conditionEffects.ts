/**
 * Aggregates numeric debuffs/buffs from active conditions on a character.
 * Conditions live in `c.activeConditions` (array of ActiveCondition with conditionId).
 *
 * Reference (src/types/conditions.ts):
 *  - abalado:       -1 ataque, -1 perícia
 *  - amedrontado:   -3 ataque, -3 perícia
 *  - envenenado:    -2 ataque, -2 TR, -2 perícia
 *  - sofrendo:      -5 concentração/Prestidigitação, -3m movimento (info)
 *  - confuso:       -4 Fortitude, -4 Atletismo
 *  - enredado:      -2 Defesa, -2 ataque
 *  - caido:         -3 ataque CaC, -3 Defesa (CaC), +3 Defesa (à distância)
 *  - cego:          -5 Percepção (alvos têm camuflagem total — não modela aqui)
 *  - surdo:         -5 Iniciativa
 *  - desprevenido:  -3 Defesa, -3 Reflexos
 *  - agarrado:      desprevenido (-3 Defesa) + imóvel
 *  - paralisado:    -10 Defesa
 *  - exposto:       atacantes recebem +4 (modelado como -4 Defesa do alvo)
 *  - condenado:     +1 PE em todas as habilidades (já tratado em tecnicaProgression)
 */

import type { Character } from '@/types';
import { getExhaustionMods, clampExh } from './exhaustionEffects';

export interface ConditionMods {
  /** Penalty/bonus applied to attack rolls. */
  attack: number;
  /** Generic penalty/bonus applied to skill (perícia) checks. */
  skill: number;
  /** Penalty/bonus applied to saving throws (TR) generic. */
  save: number;
  /** Penalty/bonus applied to Defesa (CA) generic. */
  defense: number;
  /** Extra defense vs melee attackers. */
  defenseMelee: number;
  /** Extra defense vs ranged attackers. */
  defenseRanged: number;
  /** Penalty/bonus applied to Reflexos saves. */
  reflexes: number;
  /** Penalty/bonus applied to Fortitude saves. */
  fortitude: number;
  /** Penalty/bonus applied to Iniciativa. */
  initiative: number;
  /** Active condition labels that contributed (for tooltips). */
  notes: string[];
}

const EMPTY: ConditionMods = {
  attack: 0, skill: 0, save: 0, defense: 0,
  defenseMelee: 0, defenseRanged: 0,
  reflexes: 0, fortitude: 0, initiative: 0, notes: [],
};

function getConditionIds(c: Pick<Character, 'activeConditions' | 'exhaustionLevel'> | undefined | null): Set<string> {
  const ids = new Set<string>();
  for (const cd of c?.activeConditions || []) {
    const id = (cd as any).conditionId;
    if (id) ids.add(id);
  }
  // Auto-condições por nível de Exaustão (Lv≥2 Desprevenido, ≥3 Exposto,
  // ≥4 Condenado/Desorientado, ≥5 Enjoado, 6 Morto). Garantidas mesmo se a
  // sincronização da store ainda não tiver rodado.
  const exh = clampExh((c as any)?.exhaustionLevel);
  if (exh >= 2) ids.add('desprevenido');
  if (exh >= 3) ids.add('exposto');
  if (exh >= 4) { ids.add('condenado'); ids.add('desorientado'); }
  if (exh >= 5) ids.add('enjoado');
  if (exh >= 6) ids.add('morto');
  return ids;
}

export function aggregateConditionMods(c: Pick<Character, 'activeConditions' | 'exhaustionLevel' | 'hpMax'> | undefined | null): ConditionMods {
  if (!c) return { ...EMPTY };
  const seen = getConditionIds(c);
  const exhMods = getExhaustionMods(c as any);
  if (seen.size === 0 && exhMods.roll === 0) return { ...EMPTY };

  const out: ConditionMods = { ...EMPTY, notes: [] };

  if (seen.has('abalado')) {
    out.attack -= 1; out.skill -= 1; out.notes.push('Abalado (-1 ataque/perícia)');
  }
  if (seen.has('amedrontado')) {
    out.attack -= 3; out.skill -= 3; out.notes.push('Amedrontado (-3 ataque/perícia)');
  }
  if (seen.has('envenenado')) {
    out.attack -= 2; out.skill -= 2; out.save -= 2; out.notes.push('Envenenado (-2 ataque/TR/perícia)');
  }
  if (seen.has('confuso')) {
    out.fortitude -= 4; out.notes.push('Confuso (-4 Fortitude/Atletismo)');
  }
  if (seen.has('enredado')) {
    out.defense -= 2; out.attack -= 2; out.notes.push('Enredado (-2 Defesa/ataque)');
  }
  if (seen.has('caido')) {
    out.attack -= 3;
    out.defenseMelee -= 3; out.defenseRanged += 3;
    out.notes.push('Caído (-3 ataque CaC, -3 Def CaC, +3 Def Dist.)');
  }
  if (seen.has('desprevenido')) {
    out.defense -= 3; out.reflexes -= 3; out.notes.push('Desprevenido (-3 Defesa/Reflexos)');
  }
  if (seen.has('agarrado')) {
    out.defense -= 3; out.reflexes -= 3; out.notes.push('Agarrado (desprevenido: -3 Defesa/Reflexos)');
  }
  if (seen.has('paralisado')) {
    out.defense -= 10; out.notes.push('Paralisado (-10 Defesa)');
  }
  if (seen.has('exposto')) {
    out.defense -= 4; out.notes.push('Exposto (-4 Defesa, atacantes +4)');
  }
  if (seen.has('surdo')) {
    out.initiative -= 5; out.notes.push('Surdo (-5 Iniciativa)');
  }
  if (seen.has('cego')) {
    out.notes.push('Cego (-5 Percepção)');
  }
  if (seen.has('sofrendo')) {
    out.notes.push('Sofrendo (-5 conc./Prestidig., -3m mov.)');
  }
  if (seen.has('inconsciente')) {
    out.defense -= 10; out.reflexes -= 99; out.notes.push('Inconsciente (falha Reflexos, ataques críticos)');
  }
  if (seen.has('atordoado')) {
    out.defense -= 3; out.reflexes -= 3; out.notes.push('Atordoado (desprevenido)');
  }
  if (seen.has('enfeiticado')) {
    out.notes.push('Enfeitiçado (-2 testes contra encantador)');
  }

  // ─── Exaustão (penalidade global escalonável) ───
  if (exhMods.roll !== 0) {
    out.attack += exhMods.roll;
    out.skill += exhMods.roll;
    out.save += exhMods.roll;
    out.reflexes += exhMods.roll;
    out.fortitude += exhMods.roll;
    out.initiative += exhMods.roll;
    out.defense += exhMods.defense;
    out.notes.push(...exhMods.notes);
  }

  return out;
}

export function getSkillModFromConditions(
  c: Pick<Character, 'activeConditions' | 'exhaustionLevel' | 'hpMax'> | undefined | null,
  skillName?: string,
): number {
  const ids = getConditionIds(c as any);
  const exh = clampExh((c as any)?.exhaustionLevel);
  if (ids.size === 0 && exh === 0) return 0;

  const lower = (skillName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let mod = -exh; // penalidade universal de exaustão em perícias/atributos

  if (ids.has('abalado')) mod -= 1;
  if (ids.has('amedrontado')) mod -= 3;
  if (ids.has('envenenado')) mod -= 2;

  if (ids.has('cego') && lower.includes('percepcao')) mod -= 5;
  if (ids.has('confuso') && lower.includes('atletismo')) mod -= 4;
  if (ids.has('sofrendo') && (lower.includes('concentracao') || lower.includes('prestidigitacao'))) mod -= 5;

  return mod;
}

/** Convenience: defense modifier for the *target* of an attack of given type. */
export function getDefenseModFromConditions(
  target: Pick<Character, 'activeConditions' | 'exhaustionLevel' | 'hpMax'> | undefined | null,
  attackType: 'melee' | 'ranged' | 'cursed' = 'melee',
): number {
  const m = aggregateConditionMods(target);
  if (attackType === 'melee') return m.defense + m.defenseMelee;
  if (attackType === 'ranged') return m.defense + m.defenseRanged;
  return m.defense;
}

/**
 * Conditions where the target auto-fails defense:
 * Paralisado, Inconsciente, Indefeso → todo ataque acerta automaticamente
 * E todo acerto é crítico (dobra o dano).
 *
 * Retorna `{ autoHit, autoCrit, reason }` ou null se nenhuma condição se aplica.
 * Para Paralisado, isso vale só para ataques corpo-a-corpo.
 * Para Inconsciente/Indefeso, vale para qualquer ataque (alvo está incapaz).
 */
export function getAutoCritFromConditions(
  target: Pick<Character, 'activeConditions'> | undefined | null,
  attackType: 'melee' | 'ranged' | 'cursed' = 'melee',
): { autoHit: boolean; autoCrit: boolean; reason: string } | null {
  const ids = getConditionIds(target);
  if (ids.has('inconsciente')) return { autoHit: true, autoCrit: true, reason: 'Inconsciente' };
  if (ids.has('indefeso')) return { autoHit: true, autoCrit: true, reason: 'Indefeso' };
  if (ids.has('paralisado') && attackType === 'melee') {
    return { autoHit: true, autoCrit: true, reason: 'Paralisado (CaC)' };
  }
  return null;
}

