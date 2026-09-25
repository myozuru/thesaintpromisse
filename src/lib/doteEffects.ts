/**
 * ============================================================================
 *  DOTE EFFECTS — Passivas estatísticas dos Dotes Gerais
 * ============================================================================
 *  Aplica bônus passivos puros de dotes ao Character. Idempotente via
 *  snapshot `__dotesAppliedSnapshot`.
 *
 *  Efeitos automatizados:
 *    - Sentidos Atentos: +5 Atenção, +5 Iniciativa.
 *    - Sentidos Afiados: +ND (level) em Atenção, +mastery em Percepção.
 *
 *  Demais dotes são tratados na UI/store (botão Usar, custo de PE, contagem
 *  de usos, recurso de Sorte etc.).
 * ============================================================================
 */

import type { Character, Attribute } from '@/types';
import { getMasteryBonus } from '@/types';

export interface DotesAppliedSnapshot {
  attentionDelta: number;
  initiativeDelta: number;
  skillBonuses: Record<string, number>;
  activeIds: string[];
}

const EMPTY: DotesAppliedSnapshot = {
  attentionDelta: 0,
  initiativeDelta: 0,
  skillBonuses: {},
  activeIds: [],
};

function revert(c: Character, snap: DotesAppliedSnapshot): Character {
  const next: Character = { ...c };
  if (snap.attentionDelta) {
    next.attention = Math.max(0, (next.attention ?? 10) - snap.attentionDelta);
  }
  if (snap.initiativeDelta) {
    next.initiativeBonus = (next.initiativeBonus ?? 0) - snap.initiativeDelta;
  }
  next.skills = (next.skills ?? []).map((s: Attribute) => ({
    ...s,
    externalBonus: (s.externalBonus ?? 0) - (snap.skillBonuses[s.name] ?? 0),
  }));
  return next;
}

function apply(c: Character, ids: string[]): { char: Character; snap: DotesAppliedSnapshot } {
  const snap: DotesAppliedSnapshot = {
    attentionDelta: 0,
    initiativeDelta: 0,
    skillBonuses: {},
    activeIds: [...ids],
  };
  const level = c.level ?? 1;
  const mastery = getMasteryBonus(level);

  const bumpSkill = (name: string, amount: number) => {
    if (amount === 0) return;
    snap.skillBonuses[name] = (snap.skillBonuses[name] ?? 0) + amount;
  };

  const has = (id: string) => ids.includes(id);

  // Sentidos Atentos — mutuamente exclusivo com Sentidos Afiados
  if (has('dote-sentidos-atentos')) {
    snap.attentionDelta += 5;
    snap.initiativeDelta += 5;
  } else if (has('dote-sentidos-afiados')) {
    snap.attentionDelta += level; // soma o ND
    bumpSkill('Percepção', mastery);
  }

  // Aplica
  const next: Character = { ...c };
  if (snap.attentionDelta) {
    next.attention = (next.attention ?? 10) + snap.attentionDelta;
  }
  if (snap.initiativeDelta) {
    next.initiativeBonus = (next.initiativeBonus ?? 0) + snap.initiativeDelta;
  }
  next.skills = (next.skills ?? []).map((s: Attribute) => ({
    ...s,
    externalBonus: (s.externalBonus ?? 0) + (snap.skillBonuses[s.name] ?? 0),
  }));

  return { char: next, snap };
}

/** Recalcula passivas de Dotes Gerais. Idempotente. */
export function recalcDotePassives(c: Character): Character {
  const ids = c.chosenDotes ?? [];
  const prev = (c as unknown as { __dotesAppliedSnapshot?: DotesAppliedSnapshot }).__dotesAppliedSnapshot;
  const reverted = prev ? revert(c, prev) : c;
  const { char, snap } = apply(reverted, ids);
  return { ...char, __dotesAppliedSnapshot: snap } as unknown as Character;
}

export { EMPTY as EMPTY_DOTES_SNAPSHOT };
