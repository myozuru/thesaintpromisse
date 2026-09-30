/**
 * Especialista em Combate — Habilidade de 2º nível: Disparos Sincronizados.
 *
 * Manejando DUAS armas à distância/de fogo, o Especialista gasta a Ação Comum
 * para disparar as duas de uma vez:
 *   - Rola os dois ataques.
 *   - Se AMBOS acertarem, os danos viram UMA única instância (RD, resistências
 *     e fraquezas aplicadas uma só vez).
 *   - Se qualquer um errar, nenhum dano é causado ("tudo ou nada").
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import type { Weapon } from '@/lib/weapons';

export const DISPAROS_SINCRONIZADOS_ID = 'ec-disparos-sincronizados';

export function hasDisparosSincronizados(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === DISPAROS_SINCRONIZADOS_ID);
}

/** Arma válida para sincronizar: à distância ou de fogo (não corpo a corpo, não arremesso). */
export const armaDeDisparo = (w: Weapon | null | undefined): boolean => w?.range === 'ranged';

export function podeSincronizar(
  c: Character | null | undefined,
  main: Weapon | null | undefined,
  off: Weapon | null | undefined,
): { ok: boolean; reason?: string } {
  if (!hasDisparosSincronizados(c)) return { ok: false, reason: 'não possui Disparos Sincronizados' };
  if (!main || !off) return { ok: false, reason: 'é preciso empunhar duas armas' };
  if (!armaDeDisparo(main) || !armaDeDisparo(off)) {
    return { ok: false, reason: 'as duas armas precisam ser à distância ou de fogo' };
  }
  return { ok: true };
}

/** Dano final combinado: só há dano se os dois tiros acertarem. */
export function danoCombinado(
  a: { hit: boolean; damageTotal: number },
  b: { hit: boolean; damageTotal: number },
): number {
  return a.hit && b.hit ? a.damageTotal + b.damageTotal : 0;
}
