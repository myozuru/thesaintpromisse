/**
 * Especialista em Combate — Habilidade de 2º nível: Extensão do Corpo.
 *
 *  - Alcance dos ataques corpo a corpo aumenta em 1,5 m.
 *  - +2 nas jogadas de ataque corpo a corpo.
 *  - +2 em testes para evitar ser desarmado.
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import type { Weapon } from '@/lib/weapons';

export const EXTENSAO_CORPO_ID = 'ec-extensao-corpo';
export const EXTENSAO_ALCANCE_M = 1.5;
export const EXTENSAO_BONUS = 2;

export function hasExtensaoCorpo(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === EXTENSAO_CORPO_ID);
}

/** Metros extras de alcance em ataques corpo a corpo. */
export function extensaoAlcanceBonus(c: Character | null | undefined): number {
  return hasExtensaoCorpo(c) ? EXTENSAO_ALCANCE_M : 0;
}

/** +2 no acerto, apenas com armas corpo a corpo. */
export function extensaoAtaqueBonus(c: Character | null | undefined, w: Weapon | null | undefined): number {
  return hasExtensaoCorpo(c) && w?.range === 'melee' ? EXTENSAO_BONUS : 0;
}

/** +2 em testes para evitar ser desarmado. */
export function extensaoDesarmeBonus(c: Character | null | undefined): number {
  return hasExtensaoCorpo(c) ? EXTENSAO_BONUS : 0;
}

/** O teste pedido é uma tentativa de evitar desarme? */
export function ehTesteDeDesarme(nome: string | null | undefined): boolean {
  return /desarm/i.test(String(nome ?? ''));
}
