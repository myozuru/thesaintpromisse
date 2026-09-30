/**
 * Especialista em Combate — Habilidade de 2º nível: Pistoleiro Iniciado.
 *
 * Antes da jogada de ataque com uma ARMA DE FOGO, o Especialista pode
 * aumentar a margem de Emperrar em 2. Em troca, se acertar, causa 1 dado
 * de dano adicional (o mesmo dado da arma; dobra em crítico).
 *
 * Emperrar (regra base da propriedade): em um desastre (1 natural na jogada
 * de ataque) a arma emperra e para de funcionar — é preciso uma Ação Comum
 * para fazê-la voltar a funcionar.
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { hasProperty, type Weapon } from '@/lib/weapons';

export const PISTOLEIRO_INICIADO_ID = 'ec-pistoleiro-iniciado';

/** Margem base de emperrar (1 natural = desastre). */
export const EMPERRAR_MARGEM_BASE = 1;
/** Aumento da margem quando o Pistoleiro Iniciado é declarado. */
export const PISTOLEIRO_MARGEM_EXTRA = 2;

export function hasPistoleiroIniciado(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === PISTOLEIRO_INICIADO_ID);
}

/** Arma de fogo = arma com a propriedade Emperrar (Pistola, Rifle, Escopeta…). */
export function ehArmaDeFogo(w: Weapon | null | undefined): boolean {
  return !!w && hasProperty(w, 'emperrar');
}

/**
 * Margem de emperrar desta jogada: 0 se a arma não emperra,
 * 1 normalmente, 3 com Pistoleiro Iniciado declarado.
 */
export function margemEmperrar(w: Weapon | null | undefined, pistoleiro: boolean): number {
  if (!ehArmaDeFogo(w)) return 0;
  return EMPERRAR_MARGEM_BASE + (pistoleiro ? PISTOLEIRO_MARGEM_EXTRA : 0);
}

/** O d20 natural fez a arma emperrar? */
export function emperrou(natural: number, w: Weapon | null | undefined, pistoleiro: boolean): boolean {
  const m = margemEmperrar(w, pistoleiro);
  return m > 0 && natural <= m;
}

/** A arma está emperrada agora (bloqueia ataques com ela)? */
export function armaEstaEmperrada(c: Character | null | undefined, w: Weapon | null | undefined): boolean {
  if (!c || !w) return false;
  return (c.armaEmperrada ?? null) === w.name;
}

/** Pode declarar Pistoleiro Iniciado neste ataque? */
export function podeUsarPistoleiro(
  c: Character | null | undefined,
  w: Weapon | null | undefined,
): { ok: boolean; reason?: string } {
  if (!hasPistoleiroIniciado(c)) return { ok: false, reason: 'Você não tem Pistoleiro Iniciado.' };
  if (!ehArmaDeFogo(w)) return { ok: false, reason: 'Exige uma arma de fogo.' };
  if (armaEstaEmperrada(c, w)) return { ok: false, reason: 'A arma está emperrada.' };
  return { ok: true };
}
