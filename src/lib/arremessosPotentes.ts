/**
 * Especialista em Combate — Habilidade de 2º nível: Arremessos Potentes.
 *
 *  - Ataques com armas de arremesso sobem 1 nível de dano (tabela de passos).
 *  - No começo do seu turno (antes de atacar), pode gastar 1 PE: até o fim
 *    desse turno, ataques com armas de arremesso ignoram RD igual ao bônus
 *    de treinamento.
 */
import type { Character } from '@/types';
import { isEspecialistaCombate, isThrownWeapon } from '@/lib/combateEstilos';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';

export const ARREMESSOS_POTENTES_ID = 'ec-arremessos-potentes';

export function hasSpecAbility(c: Pick<Character, 'chosenSpecAbilities'>, id: string): boolean {
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === id);
}

export function hasArremessosPotentes(c: Character): boolean {
  return isEspecialistaCombate(c) && hasSpecAbility(c, ARREMESSOS_POTENTES_ID);
}

type W = { range: string; properties?: { kind: string }[] };

/** +1 nível de dano para armas de arremesso. */
export function arremessosPotentesStep(c: Character, w: W): number {
  return hasArremessosPotentes(c) && isThrownWeapon(w) ? 1 : 0;
}

/** Chave do turno atual do personagem (rodada + id). */
export function turnKeyFor(round: number, charId: string): string {
  return `${round}:${charId}`;
}

export interface TurnInfo {
  inCombat: boolean;
  round: number;
  currentCharId: string | null;
}

/** Pode ativar agora? Só no próprio turno, antes de atacar, com 1 PE. */
export function podeAtivarArremessos(c: Character, t: TurnInfo): { ok: boolean; reason?: string } {
  if (!hasArremessosPotentes(c)) return { ok: false, reason: 'Você não tem Arremessos Potentes.' };
  if (!t.inCombat) return { ok: false, reason: 'Só pode ser usado em combate.' };
  if (t.currentCharId !== c.id) return { ok: false, reason: 'Só no começo do seu turno.' };
  if ((c.arremessosPotentesTurnKey ?? '') === turnKeyFor(t.round, c.id)) return { ok: false, reason: 'Já ativado neste turno.' };
  if ((c.attacksThisTurn ?? 0) > 0) return { ok: false, reason: 'Só no começo do turno (você já atacou).' };
  if ((c.currentPE ?? 0) < 1) return { ok: false, reason: 'PE insuficiente (precisa de 1).' };
  return { ok: true };
}

export function arremessosAtivo(c: Character, t: TurnInfo): boolean {
  return hasArremessosPotentes(c) && t.inCombat && t.currentCharId === c.id
    && c.arremessosPotentesTurnKey === turnKeyFor(t.round, c.id);
}

/** RD ignorada pelo ataque com esta arma (0 se não se aplica). */
export function arremessosRdIgnorada(c: Character, w: W, t: TurnInfo): number {
  if (!isThrownWeapon(w) || !arremessosAtivo(c, t)) return 0;
  return getTrainingBonusByLevel(c.level ?? 1);
}
