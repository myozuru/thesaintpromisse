/**
 * ============================================================================
 *  CURSED EXCLUSIVE EFFECTS — Aptidões Amaldiçoadas Exclusivas (Maldições)
 * ============================================================================
 *  Resolver de passivas de aptidões da família CURSED que não precisam de
 *  escolha em tempo real (ex.: Olhos Adicionais +Percepção, Estoque
 *  Ampliado +maxPE, Revestimento RD físico).
 *
 *  Idempotente: usa snapshot armazenado em `__cursedExclusiveAppliedSnapshot`
 *  para reverter o que foi aplicado antes de re-aplicar.
 *
 *  Aptidões com escolhas (atributo, elemento, tamanho) ou efeitos puramente
 *  ativos (Regeneração Corporal etc.) NÃO são tratadas aqui — a UI do painel
 *  já expõe seus metadados (activation/peCost/trigger).
 * ============================================================================
 */

import type { Character, Attribute, DamageType } from '@/types';
import { getMasteryBonus } from '@/types';

export interface CursedExclusiveAppliedSnapshot {
  hpMaxBonus: number;
  peMaxBonus: number;
  rdByType: Partial<Record<DamageType, number>>;
  skillBonuses: Record<string, number>;
  attentionDelta: number;
  activeIds: string[];
}

const EMPTY: CursedExclusiveAppliedSnapshot = {
  hpMaxBonus: 0,
  peMaxBonus: 0,
  rdByType: {},
  skillBonuses: {},
  attentionDelta: 0,
  activeIds: [],
};

const PHYS: DamageType[] = ['DCO', 'DP', 'DI'];

function getAttrValue(c: Character, name: string): number {
  const a = (c.attributes ?? []).find((x) => x.name === name);
  return a?.value ?? 10;
}
function mod(value: number): number {
  return Math.floor((value - 10) / 2);
}

function tierBonus(level: number, breakpoints: number[]): number {
  return breakpoints.reduce((acc, bp) => acc + (level >= bp ? 1 : 0), 0);
}

function revert(c: Character, snap: CursedExclusiveAppliedSnapshot): Character {
  const next: Character = { ...c };
  next.hpMax = Math.max(1, (next.hpMax ?? 1) - snap.hpMaxBonus);
  next.hpCurrent = Math.min(next.hpCurrent ?? next.hpMax, next.hpMax);
  next.peMax = Math.max(0, (next.peMax ?? 0) - snap.peMaxBonus);
  next.peCurrent = Math.min(next.peCurrent ?? next.peMax, next.peMax);
  // RD
  const rd: Partial<Record<DamageType, number>> = { ...(next.rdByType ?? {}) };
  for (const [t, v] of Object.entries(snap.rdByType)) {
    rd[t as DamageType] = Math.max(0, (rd[t as DamageType] ?? 0) - (v ?? 0));
  }
  next.rdByType = rd as Character['rdByType'];
  // Skills
  next.skills = (next.skills ?? []).map((s: Attribute) => ({
    ...s,
    externalBonus: (s.externalBonus ?? 0) - (snap.skillBonuses[s.name] ?? 0),
  }));
  // Attention
  if (snap.attentionDelta) {
    next.attention = Math.max(0, (next.attention ?? 10) - snap.attentionDelta);
  }
  return next;
}

function apply(c: Character, ids: string[]): { char: Character; snap: CursedExclusiveAppliedSnapshot } {
  const snap: CursedExclusiveAppliedSnapshot = {
    hpMaxBonus: 0,
    peMaxBonus: 0,
    rdByType: {},
    skillBonuses: {},
    attentionDelta: 0,
    activeIds: [...ids],
  };
  const level = c.level ?? 1;
  const mastery = getMasteryBonus(level);
  const modCON = mod(getAttrValue(c, 'Constituição'));

  const bumpSkill = (name: string, amount: number) => {
    if (amount === 0) return;
    snap.skillBonuses[name] = (snap.skillBonuses[name] ?? 0) + amount;
  };
  const bumpRD = (types: DamageType[], amount: number) => {
    if (amount === 0) return;
    for (const t of types) snap.rdByType[t] = (snap.rdByType[t] ?? 0) + amount;
  };

  const has = (id: string) => ids.includes(id);

  // Olhos Adicionais — +2 Percepção (+1 nos níveis 5/10/15/20); atenção base 12
  if (has('cursed-olhos-adicionais')) {
    bumpSkill('Percepção', 2 + tierBonus(level, [5, 10, 15, 20]));
    // Atenção base 10 → 12 = +2 (idempotente via snapshot)
    snap.attentionDelta += 2;
  }

  // Superioridade Física — +2 Atletismo & Acrobacia (+1 em Nv 10/15/20)
  if (has('cursed-superioridade-fisica')) {
    const b = 2 + tierBonus(level, [10, 15, 20]);
    bumpSkill('Atletismo', b);
    bumpSkill('Acrobacia', b);
  }

  // Estoque Ampliado — maxPE += bônus de maestria
  if (has('cursed-estoque-ampliado')) {
    snap.peMaxBonus += mastery;
  }

  // Revestimento / Revestimento Evoluído — RD físico = mod CON (×2 se evoluído)
  if (has('cursed-revestimento') || has('cursed-revestimento-evoluido')) {
    const mult = has('cursed-revestimento-evoluido') ? 2 : 1;
    const amount = Math.max(0, modCON) * mult;
    bumpRD(PHYS, amount);
  }

  // Aplica no personagem
  const next: Character = { ...c };
  next.hpMax = (next.hpMax ?? 1) + snap.hpMaxBonus;
  next.hpCurrent = Math.min((next.hpCurrent ?? next.hpMax) + snap.hpMaxBonus, next.hpMax);
  next.peMax = (next.peMax ?? 0) + snap.peMaxBonus;
  next.peCurrent = Math.min((next.peCurrent ?? next.peMax) + snap.peMaxBonus, next.peMax);
  const rd: Partial<Record<DamageType, number>> = { ...(next.rdByType ?? {}) };
  for (const [t, v] of Object.entries(snap.rdByType)) {
    rd[t as DamageType] = (rd[t as DamageType] ?? 0) + (v ?? 0);
  }
  next.rdByType = rd as Character['rdByType'];
  next.skills = (next.skills ?? []).map((s: Attribute) => ({
    ...s,
    externalBonus: (s.externalBonus ?? 0) + (snap.skillBonuses[s.name] ?? 0),
  }));
  if (snap.attentionDelta) {
    next.attention = (next.attention ?? 10) + snap.attentionDelta;
  }

  return { char: next, snap };
}

/** Recalcula passivas de aptidões CURSED. Idempotente. */
export function recalcCursedExclusivePassives(c: Character): Character {
  const ids = (c.chosenClAptitudes ?? []).filter((id) => id.startsWith('cursed-'));
  const prev = (c as unknown as { __cursedExclusiveAppliedSnapshot?: CursedExclusiveAppliedSnapshot }).__cursedExclusiveAppliedSnapshot;
  const reverted = prev ? revert(c, prev) : c;
  const { char, snap } = apply(reverted, ids);
  return { ...char, __cursedExclusiveAppliedSnapshot: snap } as unknown as Character;
}
