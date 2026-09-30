/**
 * Especialista em Combate — Habilidade de 2º nível: Precisão Definitiva.
 *
 * Ao fazer um ataque, gaste 1 PE para receber +2 na rolagem de acerto.
 * A cada quatro níveis você pode gastar 1 PE a mais (aumentando o bônus
 * em +2 por ponto). Alternativamente, o bônus pode ir para a rolagem de
 * DANO, valendo +4 por ponto em vez de +2.
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';

export const PRECISAO_DEFINITIVA_ID = 'ec-precisao-definitiva';

export const PRECISAO_BONUS_ACERTO = 2;
export const PRECISAO_BONUS_DANO = 4;

export type PrecisaoModo = 'acerto' | 'dano';

export function hasPrecisaoDefinitiva(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === PRECISAO_DEFINITIVA_ID);
}

/** Máximo de PE por ataque: 1 + 1 a cada 4 níveis (nv 4 → 2, nv 8 → 3, nv 20 → 6). */
export function precisaoPeMax(c: Character | null | undefined): number {
  if (!hasPrecisaoDefinitiva(c)) return 0;
  return 1 + Math.floor((c?.level ?? 1) / 4);
}

/** Bônus concedido por `pe` pontos gastos, no modo escolhido. */
export function precisaoBonus(pe: number, modo: PrecisaoModo): number {
  const n = Math.max(0, Math.floor(pe));
  return n * (modo === 'dano' ? PRECISAO_BONUS_DANO : PRECISAO_BONUS_ACERTO);
}

/** Pode gastar `pe` pontos agora? */
export function podeUsarPrecisao(
  c: Character | null | undefined,
  pe: number,
): { ok: boolean; reason?: string } {
  if (!hasPrecisaoDefinitiva(c)) return { ok: false, reason: 'Você não tem Precisão Definitiva.' };
  if (pe <= 0) return { ok: false, reason: 'Escolha ao menos 1 PE.' };
  const max = precisaoPeMax(c);
  if (pe > max) return { ok: false, reason: `No seu nível, o máximo é ${max} PE.` };
  if ((c?.peCurrent ?? 0) < pe) return { ok: false, reason: `PE insuficiente (${c?.peCurrent ?? 0}/${pe}).` };
  return { ok: true };
}
