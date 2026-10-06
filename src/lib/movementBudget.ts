/**
 * Movimento efetivo do personagem considerando sobrecarga de inventário.
 *
 * Regra: se `slotsCurrent` exceder `slotsMax`, o movimento é cortado pela metade.
 * Mobilidade Avançada (Suporte) e itens equipados somam metros antes da sobrecarga.
 */
import type { Character } from '@/types';

export const MOBILIDADE_ID = 'sup-mobilidade-avancada';
export const MOBILIDADE_BONUS_M = 3;

type MoveChar = Pick<Character, 'movement' | 'slotsCurrent' | 'slotsMax'> &
  Partial<Pick<Character, 'chosenSpecAbilities' | 'mobilidadeReacaoM' | 'mobilidadeReacaoBase' | 'ultimoSegundoAtivo' | 'ferimentosComplexos'>>;

export function isOverloaded(c: Pick<Character, 'slotsCurrent' | 'slotsMax'> | undefined | null): boolean {
  if (!c) return false;
  return (c.slotsCurrent ?? 0) > (c.slotsMax ?? 0);
}

export function getMobilidadeBonus(c: Partial<Pick<Character, 'chosenSpecAbilities'>> | undefined | null): number {
  return (c?.chosenSpecAbilities ?? []).some((a) => a.abilityId === MOBILIDADE_ID) ? MOBILIDADE_BONUS_M : 0;
}

export function effectiveMovement(c: MoveChar | undefined | null, bonusDeslocamento = 0): number {
  const pernas = (c?.ferimentosComplexos ?? []).some((f) => f.resultado >= 4 && f.resultado <= 6) ? 0.5 : 1;
  const base = Math.max(0, ((c?.movement ?? 0) + getMobilidadeBonus(c)) * pernas + (c?.ultimoSegundoAtivo ? 4.5 : 0) + bonusDeslocamento);
  return isOverloaded(c) ? base / 2 : base;
}

/** Orçamento fora do turno liberado pela reação de Mobilidade Avançada (null = nenhum). */
export function reactionMoveBudget(c: MoveChar | undefined | null, bonusDeslocamento = 0): number | null {
  if (!c || !((c.mobilidadeReacaoM ?? 0) > 0)) return null;
  return (c.mobilidadeReacaoBase ?? 0) + (c.mobilidadeReacaoM ?? 0) + bonusDeslocamento;
}

/** Orçamento total de movimento em combate: turno ativo ou reação. null = não pode mover. */
export function combatMoveBudget(c: MoveChar | undefined | null, isActiveTurn: boolean, bonusDeslocamento = 0): number | null {
  if (isActiveTurn) return effectiveMovement(c, bonusDeslocamento);
  return reactionMoveBudget(c, bonusDeslocamento);
}
