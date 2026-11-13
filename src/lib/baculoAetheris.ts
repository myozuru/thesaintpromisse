import type { Character } from '@/types';
import type { Weapon } from '@/lib/weapons';

export const BACULO_AETHERIS_ID = 'baculo-aetheris';
export const BACULO_AETHERIS_NAME = 'Báculo Aetheris';
export const BACULO_AETHERIS_SEM_REACOES = 'baculo-aetheris-sem-reacoes';
export const BACULO_AETHERIS_SUSPENSO = 'baculo-aetheris-suspenso';
export const BACULO_AETHERIS_MOVIMENTO_M = 3;
export const BACULO_AETHERIS_ALCANCE_M = 3;
export const BACULO_AETHERIS_QUEDA_SEGURA_M = 18;

const norm = (value?: string | null) => value?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function isBaculoAetheris(weapon?: Pick<Weapon, 'specialFeatureId'> | null): boolean {
  return weapon?.specialFeatureId === BACULO_AETHERIS_ID;
}

export function baculoAetherisEquipped(character: Partial<Pick<Character, 'mainHandWeaponName' | 'offHandWeaponName'>> | null | undefined): boolean {
  return [character?.mainHandWeaponName, character?.offHandWeaponName].some((name) => norm(name) === norm(BACULO_AETHERIS_NAME));
}

export function ignoresNaturalDifficultTerrain(character: Partial<Pick<Character, 'mainHandWeaponName' | 'offHandWeaponName'>> | null | undefined): boolean {
  return baculoAetherisEquipped(character);
}

/** 1d6 per complete 3 m after the first 1.5 m; capped at 20d6. */
export function fallDamageDice(heightMeters: number): number {
  if (!Number.isFinite(heightMeters) || heightMeters <= 1.5) return 0;
  return Math.min(20, Math.max(0, Math.floor((heightMeters - 1.5) / 3)));
}

/** Aetheris negates 18 m, then applies the normal formula to the excess. */
export function baculoAetherisFallDice(heightMeters: number): number {
  if (!Number.isFinite(heightMeters) || heightMeters <= BACULO_AETHERIS_QUEDA_SEGURA_M) return 0;
  return fallDamageDice(heightMeters - BACULO_AETHERIS_QUEDA_SEGURA_M);
}

export function validAetherisFeatherAllocation(allocation: Record<string, number>): boolean {
  const counts = Object.values(allocation);
  const total = counts.reduce((sum, count) => sum + (Number.isFinite(count) ? count : 0), 0);
  return counts.every((count) => Number.isSafeInteger(count) && count >= 0 && count <= 3) && total >= 1 && total <= 3;
}

export function aetherisRoundUseReady(
  previous: { combatId: string | null; round: number } | undefined,
  combatId: string | null,
  round: number,
): boolean {
  return !previous || previous.combatId !== combatId || previous.round !== round;
}

export function aetherisRequiemReady(
  character: Pick<Character, 'peCurrent' | 'tempPE' | 'actionsCurrent' | 'bonusActionsCurrent'>,
  usedCombatId: string | undefined,
  combatId: string | null,
): boolean {
  return usedCombatId !== (combatId ?? 'sem-combate')
    && ((character.peCurrent ?? 0) + (character.tempPE ?? 0)) >= 18
    && (character.actionsCurrent ?? 0) >= 1
    && (character.bonusActionsCurrent ?? 0) >= 1;
}

export function baculoAetherisBlockReason(
  character: Pick<Character, 'peCurrent' | 'tempPE' | 'actionsCurrent' | 'bonusActionsCurrent' | 'reactionsCurrent' | 'reactionsMax'>,
  costPE: number,
  resources: { action?: boolean; bonus?: boolean; reaction?: boolean } = {},
): string | null {
  const pe = (character.peCurrent ?? 0) + (character.tempPE ?? 0);
  if (pe < costPE) return `PE insuficiente: requer ${costPE}, você possui ${pe}`;
  if (resources.action && (character.actionsCurrent ?? 1) < 1) return 'Ação Comum indisponível nesta rodada';
  if (resources.bonus && (character.bonusActionsCurrent ?? 1) < 1) return 'Ação Bônus indisponível nesta rodada';
  const reactions = character.reactionsCurrent ?? character.reactionsMax ?? 1;
  if (resources.reaction && reactions < 1) return 'Sem Reação disponível nesta rodada';
  return null;
}
