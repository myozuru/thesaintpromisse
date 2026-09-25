/**
 * ============================================================================
 *  ANATOMY EFFECTS — FAH (Feto Amaldiçoada Híbrido)
 * ============================================================================
 *  Resolver puro que traduz `anatomyFeatures[]` em modificadores aplicados
 *  ao snapshot do Character. É IDEMPOTENTE: usa um snapshot (`anatomyAppliedSnapshot`)
 *  para reverter o que foi aplicado anteriormente antes de re-aplicar tudo.
 *
 *  Aplicado em 3 momentos:
 *  - Wizard finaliza ficha FAH com anatomias.
 *  - updateCharacter quando `anatomyFeatures` ou toggles mudam.
 *  - applyLevelUp (Carapaça/Instinto/Desenvolvimento escalam com level/Maestria).
 *
 *  Modificadores aplicados:
 *  - Desenvolvimento Exagerado: hpMax += 1*level (e sizeCategory +1 narrativo)
 *  - Braços Extras:             skills.Prestidigitação.externalBonus += 2
 *                               (toggle Duas Mãos Livres → +2 também em Atletismo)
 *  - Pernas Extras:             movement += 4.5  (flag ignoresGroundDifficultTerrain)
 *  - Articulações Extensas:     meleeRange += 1.5
 *  - Corpo Especializado:       skills[chosen].externalBonus += MAESTRIA  (1d4 ≈ MAESTRIA p/ saldo numérico)
 *                               + tag visual "+1d4" no log
 *  - Carapaça Mutante:          rd.DCO/DP/DI += MAESTRIA. Lv10+: o tipo físico
 *                               escolhido recebe RD adicional = MAESTRIA
 *                               (efeito "Resistência Reforçada", ≈ ½ dano).
 *  - Olhos Sombrios:            skills.Percepção.trained=true; +2; flag darkvision
 *  - Instinto Sanguinário:      initiativeBonus += MAESTRIA
 * ============================================================================
 */

import type { Character, Attribute, DamageType } from '@/types';
import { getMasteryBonus, createEmptyRdByType } from '@/types';

/** Snapshot do que foi aplicado por anatomia — para reversão idempotente. */
export interface AnatomyAppliedSnapshot {
  hpBonus: number;
  movementBonus: number;
  meleeRangeBonus: number;
  initiativeBonus: number;
  /** Map skillName → bônus numérico aplicado em externalBonus. */
  skillBonuses: Record<string, number>;
  /** Map skillName → trained foi setado por nós? (para reverter). */
  skillTrainedSet: string[];
  /** RD aplicado por tipo (somar/subtrair). */
  rdByType: Partial<Record<DamageType, number>>;
  /** Anatomy IDs que estavam ativos quando o snapshot foi criado. */
  activeIds: string[];
}

const EMPTY_SNAPSHOT: AnatomyAppliedSnapshot = {
  hpBonus: 0,
  movementBonus: 0,
  meleeRangeBonus: 0,
  initiativeBonus: 0,
  skillBonuses: {},
  skillTrainedSet: [],
  rdByType: {},
  activeIds: [],
};

/** Tipos de dano físico (Cortante, Perfurante, Impactante). */
export const PHYSICAL_DAMAGE_TYPES: DamageType[] = ['DCO', 'DP', 'DI'];

/** Tira do char todos os modificadores que estavam no snapshot anterior. */
function revertSnapshot(c: Character, snap: AnatomyAppliedSnapshot): Character {
  const next: Character = { ...c };
  // HP
  next.hpMax = Math.max(1, next.hpMax - snap.hpBonus);
  next.hpCurrent = Math.min(next.hpCurrent, next.hpMax);
  // Movement / melee range / initiative
  next.movement = Math.max(0, (next.movement ?? 9) - snap.movementBonus);
  next.initiativeBonus = (next.initiativeBonus ?? 0) - snap.initiativeBonus;
  next.meleeRangeBonus = Math.max(0, (next.meleeRangeBonus ?? 0) - snap.meleeRangeBonus);
  // Skills
  const skills: Attribute[] = (next.skills ?? []).map((s) => {
    const minus = snap.skillBonuses[s.name] ?? 0;
    const trained = snap.skillTrainedSet.includes(s.name) ? false : s.trained;
    const externalBonus = (s.externalBonus ?? 0) - minus;
    return { ...s, externalBonus, trained };
  });
  next.skills = skills;
  // RD por tipo
  const rd = { ...createEmptyRdByType(), ...(next.rdByType ?? {}) };
  for (const [t, v] of Object.entries(snap.rdByType)) {
    rd[t as DamageType] = Math.max(0, (rd[t as DamageType] ?? 0) - (v ?? 0));
  }
  next.rdByType = rd;
  return next;
}

/** Aplica as anatomias selecionadas e devolve { char, snapshot }. */
function applySnapshot(
  c: Character,
  ids: string[],
  level: number,
  opts: {
    duasMaosLivres?: boolean;
    corpoEspecializadoSkill?: string;
    carapacaResistType?: DamageType;
  },
): { char: Character; snapshot: AnatomyAppliedSnapshot } {
  const mastery = getMasteryBonus(level);
  const snap: AnatomyAppliedSnapshot = {
    hpBonus: 0,
    movementBonus: 0,
    meleeRangeBonus: 0,
    initiativeBonus: 0,
    skillBonuses: {},
    skillTrainedSet: [],
    rdByType: {},
    activeIds: [...ids],
  };
  const next: Character = { ...c };

  const bumpSkill = (name: string, amount: number, setTrained = false) => {
    snap.skillBonuses[name] = (snap.skillBonuses[name] ?? 0) + amount;
    if (setTrained) snap.skillTrainedSet.push(name);
  };

  for (const id of ids) {
    switch (id) {
      case 'desenvolvimento_exagerado':
        snap.hpBonus += 1 * level;
        break;
      case 'bracos_extras':
        bumpSkill('Prestidigitação', 2);
        if (opts.duasMaosLivres) bumpSkill('Atletismo', 2);
        break;
      case 'pernas_extras':
        snap.movementBonus += 4.5;
        break;
      case 'articulacoes_extensas':
        snap.meleeRangeBonus += 1.5;
        break;
      case 'corpo_especializado':
        if (opts.corpoEspecializadoSkill) {
          // 1d4 = média 2.5 ≈ Maestria pequena. Como saldo numérico, usamos Maestria
          // para não inflacionar; o "+1d4" textual é exibido na ficha pela UI.
          bumpSkill(opts.corpoEspecializadoSkill, mastery);
        }
        break;
      case 'carapaca_mutante':
        for (const t of PHYSICAL_DAMAGE_TYPES) {
          snap.rdByType[t] = (snap.rdByType[t] ?? 0) + mastery;
        }
        // Lv 10+: o tipo escolhido ganha RD adicional = MAESTRIA, totalizando
        // 2×MAESTRIA naquele tipo — modela "Resistência Reforçada" dentro do
        // motor de RD existente (sem precisar de um sistema separado de resist).
        if (level >= 10 && opts.carapacaResistType) {
          const t = opts.carapacaResistType;
          snap.rdByType[t] = (snap.rdByType[t] ?? 0) + mastery;
        }
        break;
      case 'olhos_sombrios':
        bumpSkill('Percepção', 2, true);
        break;
      case 'instinto_sanguinario':
        snap.initiativeBonus += mastery;
        break;
    }
  }

  // Aplica HP
  next.hpMax = next.hpMax + snap.hpBonus;
  next.hpCurrent = Math.min(next.hpCurrent + snap.hpBonus, next.hpMax);
  // Movement / iniciativa / alcance corpo-a-corpo
  next.movement = (next.movement ?? 9) + snap.movementBonus;
  next.initiativeBonus = (next.initiativeBonus ?? 0) + snap.initiativeBonus;
  next.meleeRangeBonus = (next.meleeRangeBonus ?? 0) + snap.meleeRangeBonus;
  // Skills
  next.skills = (next.skills ?? []).map((s) => {
    const plus = snap.skillBonuses[s.name] ?? 0;
    const trained = snap.skillTrainedSet.includes(s.name) ? true : s.trained;
    return { ...s, externalBonus: (s.externalBonus ?? 0) + plus, trained };
  });
  // RD
  const rd = { ...createEmptyRdByType(), ...(next.rdByType ?? {}) };
  for (const [t, v] of Object.entries(snap.rdByType)) {
    rd[t as DamageType] = (rd[t as DamageType] ?? 0) + (v ?? 0);
  }
  next.rdByType = rd;

  return { char: next, snapshot: snap };
}

/**
 * Recalcula passivas de anatomia para um personagem FAH.
 * Reverte snapshot anterior, re-aplica baseado em `anatomyFeatures` atuais.
 * Idempotente — chame quantas vezes precisar.
 */
export function recalcAnatomyPassives(c: Character): Character {
  if (c.origin !== 'Feto Amaldiçoada Híbrido (FAH)') return c;
  const ids = c.anatomyFeatures ?? [];
  const prevSnap = (c as any).__anatomyAppliedSnapshot as AnatomyAppliedSnapshot | undefined;
  // 1) Reverte
  const reverted = prevSnap ? revertSnapshot(c, prevSnap) : c;
  // 2) Aplica
  const { char, snapshot } = applySnapshot(reverted, ids, c.level, {
    duasMaosLivres: c.anatomyDuasMaosLivres,
    corpoEspecializadoSkill: c.anatomyCorpoEspecializadoSkill,
    carapacaResistType: c.anatomyCarapacaResistType,
  });
  return { ...char, __anatomyAppliedSnapshot: snapshot } as Character;
}

/** True se o personagem tem a anatomia indicada ativa. */
export function hasAnatomy(c: Character, id: string): boolean {
  return (c.anatomyFeatures ?? []).includes(id);
}
