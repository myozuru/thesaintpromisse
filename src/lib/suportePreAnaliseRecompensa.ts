/**
 * Suporte Nv 4 — Pré-Análise e Recompensa pelo Sucesso.
 *  • Pré-Análise: imune a Surpreso, +5 Atenção (narrativo/visual), escolhe
 *    1 aliado protegido por descanso curto; o aliado perde a proteção quando
 *    ELE faz um descanso curto.
 *  • Recompensa pelo Sucesso: Comando Motivador com bônus pela metade
 *    (arredondado para cima); se o aliado suceder num teste com CD conhecida,
 *    ganha 2 PE (excedente vira PE temporário).
 */
import type { Character } from '@/types';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { hasSpecAbility } from '@/lib/suporteNivel2';

export const PRE_ANALISE_ID = 'sup-pre-analise';
export const RECOMPENSA_ID = 'sup-recompensa-sucesso';
export const PRE_ANALISE_ATENCAO = 5;
export const RECOMPENSA_SOURCE_TAG = 'Recompensa pelo Sucesso';
export const RECOMPENSA_PE = 2;

/** Personagem não pode ser surpreendido (dono da habilidade ou aliado escolhido). */
export function isProtegidoPreAnalise(target: Character, all: Character[]): boolean {
  if (hasSpecAbility(target, PRE_ANALISE_ID)) return true;
  return all.some((s) => s.preAnaliseAllyId === target.id && hasSpecAbility(s, PRE_ANALISE_ID));
}

export function isSurpresoCondition(cond: { conditionId?: string; name?: string }): boolean {
  const id = (cond.conditionId ?? '').toLowerCase();
  const name = (cond.name ?? '').trim().toLowerCase();
  return id === 'surpreso' || name === 'surpreso';
}

export function canEscolherAliadoPreAnalise(c: Character, target: Character | undefined): { ok: boolean; reason?: string } {
  if (!hasSpecAbility(c, PRE_ANALISE_ID)) return { ok: false, reason: 'Sem Pré-Análise.' };
  if (c.preAnaliseEscolhaUsada) return { ok: false, reason: 'Já escolheu um aliado neste descanso curto.' };
  if (!target) return { ok: false, reason: 'Escolha um aliado.' };
  if (target.id === c.id || target.category !== 'PLAYER') return { ok: false, reason: 'O alvo precisa ser outro aliado.' };
  return { ok: true };
}

/** Patch aplicado à ficha do Suporte ao escolher. */
export function escolherAliadoPatch(allyId: string): Partial<Character> {
  return { preAnaliseAllyId: allyId, preAnaliseEscolhaUsada: true };
}

/**
 * Efeitos do descanso curto de `restingId` sobre uma ficha `c`:
 *  – se `c` é quem descansa e tem Pré-Análise: libera nova escolha;
 *  – se `c` protegia `restingId`: a proteção termina.
 */
export function preAnaliseShortRestPatch(c: Character, restingId: string): Partial<Character> | null {
  const patch: Partial<Character> = {};
  if (c.id === restingId && c.preAnaliseEscolhaUsada) patch.preAnaliseEscolhaUsada = false;
  if (c.preAnaliseAllyId && c.preAnaliseAllyId === restingId) patch.preAnaliseAllyId = undefined;
  return Object.keys(patch).length ? patch : null;
}

/** Bônus do Comando com Recompensa: metade, arredondado para cima. */
export function getRecompensaBonus(c: Pick<Character, 'level'>): number {
  return Math.ceil(getTrainingBonusByLevel(c.level ?? 1) / 2);
}

export function hasRecompensaNote(notes: string[]): boolean {
  return notes.some((n) => n.includes(RECOMPENSA_SOURCE_TAG));
}

/**
 * Concede os 2 PE da Recompensa quando uma rolagem consome o bônus reduzido
 * do Comando. Usado tanto em testes com CD (sucesso confirmado) quanto em
 * rolagens sem CD conhecida, onde o Mestre julga o sucesso narrativamente.
 * Retorna true se concedeu.
 */
export function maybeApplyRecompensa(
  charId: string,
  flat: { bonus: number; notes: string[] },
  deps: {
    find: (id: string) => Character | undefined;
    update: (id: string, patch: Partial<Character>) => void;
    log: (msg: string) => void;
  },
): boolean {
  if (!flat.bonus || !hasRecompensaNote(flat.notes)) return false;
  const fresh = deps.find(charId);
  if (!fresh) return false;
  const patch = recompensaPEPatch(fresh);
  deps.update(fresh.id, patch);
  deps.log(`🏆 ${fresh.name} — Recompensa pelo Sucesso: +2 PE${(patch.tempPE ?? 0) > (fresh.tempPE ?? 0) ? ' (excedente como PE temporário)' : ''}.`);
  return true;
}

/** Ganho de 2 PE: preenche até o máximo; o resto vira PE temporário. */
export function recompensaPEPatch(c: Character): Partial<Character> {
  const cur = c.peCurrent ?? 0;
  const max = c.peMax ?? cur;
  const room = Math.max(0, max - cur);
  const toPe = Math.min(room, RECOMPENSA_PE);
  const toTemp = RECOMPENSA_PE - toPe;
  return { peCurrent: cur + toPe, tempPE: (c.tempPE ?? 0) + toTemp };
}
