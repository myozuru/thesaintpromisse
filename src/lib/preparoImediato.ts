/**
 * Especialista em Combate — Habilidade de 4º nível: Preparo Imediato.
 *
 * Durante a rolagem de iniciativa, o Especialista pode gastar 3 Pontos de
 * Preparo para usar Preparar, mas apenas para uma Ação Bônus. A partir do
 * 10º nível ele também pode gastar 7 Pontos de Preparo para preparar uma
 * Ação Comum.
 *
 * A ação preparada fica guardada na ficha e pode ser disparada a qualquer
 * momento antes do primeiro turno do próprio Especialista. Disparar fora do
 * próprio turno consome a Reação; no próprio turno, apenas a ação preparada.
 * Se o turno dele começar sem o gatilho, a preparação expira.
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { getPreparoAtual, spendPreparo } from '@/lib/artesCombate';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { getReactionsAvailable } from '@/lib/reactionBudget';
import { useReactionStore } from '@/stores/useReactionStore';

export const PREPARO_IMEDIATO_ID = 'ec-preparo-imediato';
export const CUSTO_BONUS = 3;
export const CUSTO_ACAO = 7;
export const NIVEL_ACAO_COMUM = 10;

export type TipoPreparada = 'bonus' | 'action';

export function hasPreparoImediato(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === PREPARO_IMEDIATO_ID);
}

export function custoDe(tipo: TipoPreparada): number {
  return tipo === 'action' ? CUSTO_ACAO : CUSTO_BONUS;
}

export function rotuloDe(tipo: TipoPreparada): string {
  return tipo === 'action' ? 'Ação Comum' : 'Ação Bônus';
}

/** Tipos que o personagem pode preparar agora (nível + Preparo disponível). */
export function opcoesPreparo(c: Character | null | undefined): TipoPreparada[] {
  if (!c || !hasPreparoImediato(c)) return [];
  const pp = getPreparoAtual(c);
  const out: TipoPreparada[] = [];
  if (pp >= CUSTO_BONUS) out.push('bonus');
  if ((c.level ?? 1) >= NIVEL_ACAO_COMUM && pp >= CUSTO_ACAO) out.push('action');
  return out;
}

/** Deve abrir a pergunta na rolagem de iniciativa deste combate? */
export function devePerguntarNaIniciativa(c: Character | null | undefined, combatId: string): boolean {
  if (!c || !hasPreparoImediato(c)) return false;
  if (c.preparoImediatoOferta === combatId) return false;
  return opcoesPreparo(c).length > 0;
}

/** Marca que a oferta deste combate já foi respondida (aceita ou recusada). */
export function marcarOfertaRespondida(charId: string, combatId: string): void {
  useCharacterStore.getState().updateCharacter(charId, { preparoImediatoOferta: combatId });
}

type R = { ok: boolean; reason?: string };

/** Gasta os Pontos de Preparo e guarda a ação preparada. */
export function prepararNaIniciativa(charId: string, tipo: TipoPreparada, combatId: string): R {
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === charId);
  if (!c || !hasPreparoImediato(c)) return { ok: false, reason: 'Sem Preparo Imediato.' };
  if (tipo === 'action' && (c.level ?? 1) < NIVEL_ACAO_COMUM) {
    return { ok: false, reason: `Preparar Ação Comum exige nível ${NIVEL_ACAO_COMUM}.` };
  }
  const custo = custoDe(tipo);
  const gasto = spendPreparo(charId, custo);
  if (!gasto.ok) return { ok: false, reason: gasto.reason };
  store.updateCharacter(charId, {
    prontidaoPreparada: { tipo, combatId, custo },
    preparoImediatoOferta: combatId,
  });
  useLogStore.getState().addLog(
    'combat',
    `⏱️ Preparo Imediato: ${c.name} gasta ${custo} Preparo na iniciativa e prepara uma ${rotuloDe(tipo)}.`,
  );
  return { ok: true };
}

export function temPreparada(c: Character | null | undefined): boolean {
  return !!c?.prontidaoPreparada;
}

/**
 * Dispara a ação preparada. Fora do próprio turno, consome a Reação.
 * Devolve o tipo liberado para que a UI habilite a ação correspondente.
 */
export function dispararPreparada(charId: string, opts: { meuTurno: boolean }): R & { tipo?: TipoPreparada } {
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === charId);
  if (!c?.prontidaoPreparada) return { ok: false, reason: 'Nenhuma ação preparada.' };
  if (!opts.meuTurno && getReactionsAvailable(c) <= 0) {
    return { ok: false, reason: 'Sem reação disponível para disparar fora do seu turno.' };
  }
  const { tipo } = c.prontidaoPreparada;
  const updates = {
    prontidaoPreparada: null,
    ...(tipo === 'action'
      ? { actionsCurrent: (c.actionsCurrent ?? 0) + 1 }
      : { bonusActionsCurrent: (c.bonusActionsCurrent ?? 0) + 1 }),
  };
  if (opts.meuTurno) store.updateCharacter(charId, updates);
  else if (!useReactionStore.getState().consumeReaction(charId, updates)) {
    return { ok: false, reason: 'Sem reação disponível para disparar fora do seu turno.' };
  }
  useLogStore.getState().addLog(
    'combat',
    `⏱️ ${c.name} dispara a ação preparada (${rotuloDe(tipo)})${opts.meuTurno ? '' : ' — gasta a Reação'}.`,
  );
  return { ok: true, tipo };
}

/** Chamado no início do turno do próprio Especialista: a preparação expira. */
export function expirarPreparoNoTurno(charId: string): void {
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === charId);
  if (!c?.prontidaoPreparada) return;
  const { tipo } = c.prontidaoPreparada;
  store.updateCharacter(charId, { prontidaoPreparada: null });
  useLogStore.getState().addLog(
    'combat',
    `⌛ Preparo Imediato: a ${rotuloDe(tipo)} preparada de ${c.name} expirou no começo do turno dele.`,
  );
}
