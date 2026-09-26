/**
 * SUPORTE Nv 4 — Negação Crítica (sup-negacao-critica).
 * 1 + ⌊BT/2⌋ vezes por cena, 3 PE: nega a falha crítica (1 natural no d20) de um
 * aliado a até 12 m que o Suporte possa ver. A falha crítica vira falha comum.
 * O aviso vai ao dono da ficha do Suporte, que decide usar ou não; a rolagem
 * espera a resposta (até NEGACAO_TIMEOUT_MS).
 */
import { create } from 'zustand';
import type { Character } from '@/types';
import { hasSpecAbility } from '@/lib/suporteNivel2';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { findCharEntity, touchDistanceMeters, type TouchEntity, type TouchGrid } from '@/lib/touchRange';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useProfileStore } from '@/stores/useProfileStore';

export const NEGACAO_ID = 'sup-negacao-critica';
export const NEGACAO_PE = 3;
export const NEGACAO_RANGE_M = 12;
export const NEGACAO_TIMEOUT_MS = 25000;

export function getNegacaoMaxUses(c: Pick<Character, 'level'>): number {
  return 1 + Math.floor(getTrainingBonusByLevel(c.level ?? 1) / 2);
}

export function getNegacaoUsesLeft(c: Character): number {
  if (!hasSpecAbility(c, NEGACAO_ID)) return 0;
  return Math.max(0, getNegacaoMaxUses(c) - (c.negacaoCriticaUsed ?? 0));
}

function canSee(c: Pick<Character, 'activeConditions'>): boolean {
  return !(c.activeConditions ?? []).some((cd) => (cd as { conditionId?: string }).conditionId === 'cego');
}

function isAlly(c: Character): boolean {
  return !c.isGrimorioCreature && (c.category === 'PLAYER' || c.category === 'NPC');
}

/** Suporte capaz de negar a falha crítica de `rollerId` (regra pura). */
export function findNegacaoSupporter<E extends TouchEntity & { characterId?: string }>(
  rollerId: string,
  all: Character[],
  entities: Record<string, E>,
  grid: TouchGrid,
): Character | null {
  const roller = all.find((x) => x.id === rollerId);
  if (!roller || !isAlly(roller)) return null;
  const rEnt = findCharEntity(entities, rollerId);
  if (!rEnt) return null;
  for (const c of all) {
    if (c.id === rollerId || !hasSpecAbility(c, NEGACAO_ID)) continue;
    if (getNegacaoUsesLeft(c) <= 0 || (c.peCurrent ?? 0) < NEGACAO_PE || !canSee(c)) continue;
    const sEnt = findCharEntity(entities, c.id);
    if (!sEnt) continue;
    if (touchDistanceMeters(sEnt, rEnt, grid) > NEGACAO_RANGE_M + 0.05) continue;
    return c;
  }
  return null;
}

export interface NegacaoOffer {
  supporterId: string;
  rollerId: string;
  requestId: string;
}

interface NegacaoPromptState {
  offer: NegacaoOffer | null;
  open: (o: NegacaoOffer) => void;
  close: () => void;
}
export const useNegacaoPromptStore = create<NegacaoPromptState>()((set) => ({
  offer: null,
  open: (o) => set({ offer: o }),
  close: () => set({ offer: null }),
}));

export function shouldSeeNegacaoPrompt(supporterId: string, role: string | null): boolean {
  const c = useCharacterStore.getState().characters.find((x) => x.id === supporterId);
  if (c?.profileId) return useProfileStore.getState().activeProfileId === c.profileId;
  return role !== 'MASTER';
}

// Pedidos aguardando resposta nesta tela.
const pending = new Map<string, (accepted: boolean) => void>();

/** Resolve um pedido pendente (resposta local ou vinda de outra tela). */
export function resolveNegacao(requestId: string, accepted: boolean): void {
  const fn = pending.get(requestId);
  if (fn) { pending.delete(requestId); fn(accepted); }
}

function emit(detail: Record<string, unknown>) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('negacao:send', { detail }));
}

// Últimas negações aceitas por personagem (lidas pelos cálculos de crítico).
const negated = new Map<string, number>();

/** true se a última falha crítica desse personagem foi negada (consome o aviso). */
export function consumeCritNegated(charId: string): boolean {
  const t = negated.get(charId);
  if (t == null) return false;
  negated.delete(charId);
  return Date.now() - t < 120000;
}

/**
 * Chamado pelo sistema de dados quando um personagem tira 1 natural no d20.
 * Pergunta ao Suporte elegível e espera a decisão. true = virou falha comum.
 */
export async function maybeNegateCritFail(rollerId: string): Promise<boolean> {
  const [{ useMapStore }, { useRoleStore }] = await Promise.all([
    import('@/stores/useMapStore'),
    import('@/stores/useRoleStore'),
  ]);
  const { entities, gridConfig } = useMapStore.getState();
  const all = useCharacterStore.getState().characters;
  const sup = findNegacaoSupporter(rollerId, all, entities as never, gridConfig);
  if (!sup) return false;
  const offer: NegacaoOffer = {
    supporterId: sup.id,
    rollerId,
    requestId: `neg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const result = new Promise<boolean>((resolve) => {
    pending.set(offer.requestId, resolve);
    setTimeout(() => {
      if (pending.has(offer.requestId)) {
        resolveNegacao(offer.requestId, false);
        closeNegacaoEverywhere(offer.requestId);
      }
    }, NEGACAO_TIMEOUT_MS);
  });
  if (shouldSeeNegacaoPrompt(sup.id, useRoleStore.getState().role)) useNegacaoPromptStore.getState().open(offer);
  emit({ kind: 'offer', ...offer });
  const accepted = await result;
  if (accepted) negated.set(rollerId, Date.now());
  return accepted;
}

/** Aceita: paga 3 PE, gasta 1 uso e avisa quem rolou. */
export function acceptNegacao(offer: NegacaoOffer): { ok: boolean; reason?: string } {
  const store = useCharacterStore.getState();
  const sup = store.characters.find((x) => x.id === offer.supporterId);
  if (!sup) return { ok: false, reason: 'Suporte não encontrado.' };
  if (getNegacaoUsesLeft(sup) <= 0) return { ok: false, reason: 'Sem usos nesta cena.' };
  if ((sup.peCurrent ?? 0) < NEGACAO_PE) return { ok: false, reason: 'PE insuficiente (3 PE).' };
  store.updateCharacter(sup.id, {
    peCurrent: (sup.peCurrent ?? 0) - NEGACAO_PE,
    negacaoCriticaUsed: (sup.negacaoCriticaUsed ?? 0) + 1,
  });
  useNegacaoPromptStore.getState().close();
  resolveNegacao(offer.requestId, true);
  emit({ kind: 'accept', requestId: offer.requestId });
  return { ok: true };
}

export function closeNegacaoEverywhere(requestId: string): void {
  const cur = useNegacaoPromptStore.getState().offer;
  if (!cur || cur.requestId === requestId) useNegacaoPromptStore.getState().close();
  resolveNegacao(requestId, false);
  emit({ kind: 'close', requestId });
}

export type NegacaoMsg = ({ clientId?: string; kind?: string } & Partial<NegacaoOffer>) | null;

/** Regra pura: o que uma tela faz ao receber mensagem de Negação Crítica. */
export function reduceNegacaoMessage(
  msg: NegacaoMsg,
  selfClientId: string,
  canSeePrompt: (supporterId: string) => boolean,
):
  | { type: 'open'; offer: NegacaoOffer }
  | { type: 'accept'; requestId: string }
  | { type: 'close'; requestId: string }
  | { type: 'ignore' } {
  if (!msg || msg.clientId === selfClientId || !msg.requestId) return { type: 'ignore' };
  if (msg.kind === 'accept') return { type: 'accept', requestId: msg.requestId };
  if (msg.kind === 'close') return { type: 'close', requestId: msg.requestId };
  if (msg.kind === 'offer' && msg.supporterId && msg.rollerId && canSeePrompt(msg.supporterId)) {
    return { type: 'open', offer: { supporterId: msg.supporterId, rollerId: msg.rollerId, requestId: msg.requestId } };
  }
  return { type: 'ignore' };
}
