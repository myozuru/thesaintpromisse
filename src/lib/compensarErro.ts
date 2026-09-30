/**
 * Especialista em Combate — Compensar Erro (4º nível).
 * Uma vez por rodada, ao errar um ataque com arma corpo a corpo, gasta até
 * (bônus de treinamento) PE: o alvo recebe Nd10 + mod (FOR/DES/SAB, uma vez)
 * de dano Energético. RD/resistências do alvo se aplicam normalmente.
 */
import { create } from 'zustand';
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { rollDiceCom } from '@/lib/dice';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';

export const COMPENSAR_ERRO_ID = 'ec-compensar-erro';
export type CompensarAttr = 'Força' | 'Destreza' | 'Sabedoria';

export function hasCompensarErro(c: Character | null | undefined): boolean {
  return !!c && isEspecialistaCombate(c) && (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === COMPENSAR_ERRO_ID);
}

export function compensarPeMax(c: Character): number {
  return Math.max(1, getTrainingBonusByLevel(c.level ?? 1));
}

export function attrModPorNome(c: Character, nome: CompensarAttr): number {
  const sig = { Força: 'FOR', Destreza: 'DES', Sabedoria: 'SAB' }[nome];
  const a = (c.attributes ?? []).find((x) => x.name === nome || x.name === sig);
  return Math.floor(((a?.value ?? 10) + (a?.externalBonus ?? 0) - 10) / 2);
}

interface St {
  pendente: { espId: string; alvoId: string } | null;
  set: (p: St['pendente']) => void;
}
export const useCompensarErroStore = create<St>((set) => ({ pendente: null, set: (pendente) => set({ pendente }) }));

/** Registra o resultado final de um ataque para liberar/limpar Compensar Erro. */
export function registrarAtaqueCompensar(c: Character, alvoId: string | null | undefined, acertou: boolean, cac: boolean) {
  if (!hasCompensarErro(c)) return;
  const st = useCompensarErroStore.getState();
  if (!acertou && cac && alvoId) st.set({ espId: c.id, alvoId });
  else if (st.pendente?.espId === c.id) st.set(null);
}

export function podeCompensar(c: Character | null | undefined, pe: number, round: number): { ok: boolean; reason?: string } {
  if (!c || !hasCompensarErro(c)) return { ok: false, reason: 'Sem Compensar Erro.' };
  const p = useCompensarErroStore.getState().pendente;
  if (!p || p.espId !== c.id) return { ok: false, reason: 'Só depois de errar um ataque corpo a corpo.' };
  if (c.compensarErroRound === round) return { ok: false, reason: 'Já usado nesta rodada.' };
  if (pe < 1 || pe > compensarPeMax(c)) return { ok: false, reason: `Escolha de 1 a ${compensarPeMax(c)} PE.` };
  if ((c.peCurrent ?? 0) < pe) return { ok: false, reason: `PE insuficiente (${c.peCurrent ?? 0}/${pe}).` };
  return { ok: true };
}

export async function usarCompensarErro(charId: string, pe: number, attr: CompensarAttr, round: number) {
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === charId);
  const chk = podeCompensar(c, pe, round);
  const log = useLogStore.getState().addLog;
  if (!c || !chk.ok) { log('combat', `🚫 Compensar Erro: ${chk.reason}`); return chk; }
  const alvoId = useCompensarErroStore.getState().pendente!.alvoId;
  const alvo = store.characters.find((x) => x.id === alvoId);
  store.updateCharacter(charId, { peCurrent: (c.peCurrent ?? 0) - pe, compensarErroRound: round });
  useCompensarErroStore.getState().set(null);
  const mod = attrModPorNome(c, attr);
  const { rolls, total: dados } = await rollDiceCom(charId, `${pe}d10`, { bonus: mod, label: `Compensar Erro — ${pe}d10` });
  const total = Math.max(0, dados + mod);
  log('combat', `⚡ Compensar Erro: ${c.name} gasta ${pe} PE → ${pe}d10 (${rolls.join(', ')}) ${mod >= 0 ? '+' : ''}${mod} (${attr}) = ${total} de dano Energético em ${alvo?.name ?? 'alvo'}.`);
  if (alvo && total > 0) useCharacterStore.getState().applyDamage(alvo.id, total, 'DE', { attackerId: charId, isMelee: true });
  return { ok: true, total };
}
