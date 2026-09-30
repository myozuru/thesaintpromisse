/**
 * Especialista em Combate — Habilidade de 2º nível: Arsenal Cíclico.
 *
 *  - Uma vez por rodada, sacar/trocar um item é Ação Livre (uma troca que
 *    normalmente custaria Ação Bônus sai de graça).
 *  - Depois de atacar com um grupo de armas e trocar para uma arma de OUTRO
 *    grupo nesta rodada ou na próxima: +1 dado de dano com a arma trocada
 *    até o fim do seu próximo turno.
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { findWeaponByName } from '@/lib/weapons';

export const ARSENAL_CICLICO_ID = 'ec-arsenal-ciclico';

export function hasArsenalCiclico(c: Character): boolean {
  return isEspecialistaCombate(c) && (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === ARSENAL_CICLICO_ID);
}

/** A troca livre extra desta rodada ainda está disponível? */
export function arsenalTrocaLivreDisponivel(c: Character, round: number): boolean {
  return hasArsenalCiclico(c) && c.arsenalFreeSwapRound !== round;
}

/** Registrar ataque com uma arma (grupo + rodada). */
export function arsenalRegistroAtaque(c: Character, weaponName: string, round: number): Partial<Character> | null {
  if (!hasArsenalCiclico(c)) return null;
  const w = findWeaponByName(weaponName);
  if (!w) return null;
  return { arsenalLastAttack: { group: w.group, round } };
}

/**
 * Ao trocar para `newWeaponName` na rodada `round`: ganha o bônus se houve
 * ataque com outro grupo nesta rodada ou na anterior.
 */
export function arsenalBonusAoTrocar(c: Character, newWeaponName: string | null, round: number): Character['arsenalBonus'] | null {
  if (!hasArsenalCiclico(c) || !newWeaponName) return null;
  const last = c.arsenalLastAttack;
  if (!last || round - last.round > 1 || round < last.round) return null;
  const w = findWeaponByName(newWeaponName);
  if (!w || w.group === last.group) return null;
  return { weaponName: w.name, untilRound: round + 1 };
}

/** +1 dado com esta arma agora? */
export function arsenalBonusAtivo(c: Character, weaponName: string | null | undefined, round: number): boolean {
  const b = c.arsenalBonus;
  return !!b && hasArsenalCiclico(c) && !!weaponName && b.weaponName === weaponName && round <= b.untilRound;
}
