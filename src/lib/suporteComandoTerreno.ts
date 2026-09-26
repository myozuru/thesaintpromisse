/**
 * ============================================================================
 *  SUPORTE — Habilidades de 2º nível (4º par)
 *  • Comando Motivador (sup-comando-motivador)
 *  • Desvendar Terreno (sup-desvendar-terreno)
 * ============================================================================
 *  Funções puras + ações que gravam no store. UI em SuporteComandoTerrenoSections.tsx.
 *  O estado do Desvendar vive na ficha (desvendar*), então sincroniza pelo
 *  multiplayer normal das fichas — sem evento próprio.
 */
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { hasSpecAbility } from '@/lib/suporteNivel2';
import { grantFlatBonus } from '@/lib/omni/rollAdvantage';

export const COMANDO_ID = 'sup-comando-motivador';
export const DESVENDAR_ID = 'sup-desvendar-terreno';
export const COMANDO_PE_COST = 2;

// ===================== Comando Motivador =====================

export function getComandoBonus(c: Pick<Character, 'level'>): number {
  return getTrainingBonusByLevel(c.level ?? 1);
}

export function canComandar(c: Character, target: Character | undefined): { ok: boolean; reason?: string } {
  if (!hasSpecAbility(c, COMANDO_ID)) return { ok: false, reason: 'Sem Comando Motivador.' };
  if (!target) return { ok: false, reason: 'Escolha um aliado.' };
  if (target.id === c.id) return { ok: false, reason: 'Escolha outro aliado.' };
  if (target.category !== 'PLAYER') return { ok: false, reason: 'O alvo precisa ser um aliado.' };
  if ((c.peCurrent ?? 0) < COMANDO_PE_COST) return { ok: false, reason: 'PE insuficiente (2 PE).' };
  return { ok: true };
}

/** Ação Livre: paga 2 PE e dá +bônus de treinamento na PRÓXIMA rolagem do aliado.
 *  Expira no início do próximo turno do Suporte (expireGrantedBy no nextTurn). */
export function darComando(
  c: Character,
  target: Character | undefined,
  comando: string,
): { ok: boolean; reason?: string; bonus: number } {
  const chk = canComandar(c, target);
  if (!chk.ok || !target) return { ok: false, reason: chk.reason, bonus: 0 };
  const bonus = getComandoBonus(c);
  useCharacterStore.getState().updateCharacter(c.id, { peCurrent: (c.peCurrent ?? 0) - COMANDO_PE_COST });
  grantFlatBonus(target.id, 'next_any', bonus, {
    expires: 'use',
    source: `Comando Motivador (${c.name})${comando ? `: ${comando}` : ''}`,
    grantedBy: c.id,
  });
  return { ok: true, bonus };
}

// ===================== Desvendar Terreno =====================

export type DesvendarFase = 'idle' | 'aguardando-cd' | 'pronto-para-rolar' | 'ativo';

export function getDesvendarFase(c: Character): DesvendarFase {
  if ((c.desvendarBonus ?? 0) > 0) return 'ativo';
  if (c.desvendarPending && c.desvendarCD == null) return 'aguardando-cd';
  if (c.desvendarPending && c.desvendarCD != null) return 'pronto-para-rolar';
  return 'idle';
}

/** Jogador pede o teste (Ação de Movimento); o Mestre precisa definir a CD. */
export function pedirDesvendar(c: Character): { ok: boolean; reason?: string } {
  if (!hasSpecAbility(c, DESVENDAR_ID)) return { ok: false, reason: 'Sem Desvendar Terreno.' };
  if (getDesvendarFase(c) === 'ativo') return { ok: false, reason: 'Terreno já desvendado nesta cena.' };
  useCharacterStore.getState().updateCharacter(c.id, { desvendarPending: true, desvendarCD: undefined });
  return { ok: true };
}

/** Mestre define a CD (inteiro ≥ 1). */
export function definirCDDesvendar(charId: string, cd: number): { ok: boolean; reason?: string } {
  const c = useCharacterStore.getState().characters.find((x) => x.id === charId);
  if (!c || !c.desvendarPending) return { ok: false, reason: 'Sem pedido pendente.' };
  if (!Number.isFinite(cd) || cd < 1) return { ok: false, reason: 'CD inválida.' };
  useCharacterStore.getState().updateCharacter(charId, { desvendarCD: Math.floor(cd) });
  return { ok: true };
}

export function cancelarDesvendar(charId: string): void {
  useCharacterStore.getState().updateCharacter(charId, { desvendarPending: false, desvendarCD: undefined });
}

/** Resolve a rolagem de Percepção contra a CD do Mestre. */
export function resolverDesvendar(c: Character, total: number): { ok: boolean; success: boolean; cd: number; bonus: number } {
  const cd = c.desvendarCD;
  if (!c.desvendarPending || cd == null) return { ok: false, success: false, cd: cd ?? 0, bonus: 0 };
  const success = total >= cd;
  const bonus = success ? getTrainingBonusByLevel(c.level ?? 1) : 0;
  useCharacterStore.getState().updateCharacter(c.id, {
    desvendarPending: false,
    desvendarCD: undefined,
    desvendarBonus: bonus,
  });
  return { ok: true, success, cd, bonus };
}

/** Pedidos aguardando CD (visto pelo Mestre). */
export function pendingDesvendar(all: Character[]): Character[] {
  return all.filter((c) => getDesvendarFase(c) === 'aguardando-cd');
}
