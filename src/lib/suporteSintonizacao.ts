/**
 * SUPORTE Nv 4 — Sintonização Vital (sup-sintonizacao-vital).
 * Quando o Suporte cura um ALIADO (qualquer fonte de cura dele), pode gastar 3 PE
 * para que OUTRA criatura a até 3 m dele (incluindo ele mesmo) recupere PV igual
 * a metade da cura original, arredondada para cima. Sem limite de usos.
 * O aviso vai ao dono da ficha do Suporte, que escolhe o alvo secundário ou recusa.
 */
import { create } from 'zustand';
import type { Character } from '@/types';
import { hasSpecAbility } from '@/lib/suporteNivel2';
import { findCharEntity, touchDistanceMeters, type TouchEntity, type TouchGrid } from '@/lib/touchRange';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useProfileStore } from '@/stores/useProfileStore';

export const SINTONIZACAO_ID = 'sup-sintonizacao-vital';
export const SINTONIZACAO_PE = 3;
export const SINTONIZACAO_RANGE_M = 3;

/** Cura secundária = metade da original, arredondada para cima. */
export function sintonizacaoHealAmount(originalHeal: number): number {
  return Math.ceil(Math.max(0, originalHeal) / 2);
}

/**
 * Alvos secundários elegíveis: qualquer criatura a até 3 m do Suporte,
 * incluindo ele mesmo, exceto o aliado curado originalmente.
 * Se o Suporte não estiver no mapa, não há como medir — vale qualquer criatura
 * (decisão narrativa do Mestre), exceto o curado.
 */
export function listSintonizacaoTargets<E extends TouchEntity & { characterId?: string }>(
  supporterId: string,
  healedId: string,
  all: Character[],
  entities: Record<string, E>,
  grid: TouchGrid,
): Character[] {
  const supEnt = findCharEntity(entities, supporterId);
  return all.filter((c) => {
    if (c.id === healedId) return false;
    if (!supEnt) return true;
    const ent = findCharEntity(entities, c.id);
    if (!ent) return false;
    return touchDistanceMeters(supEnt, ent, grid) <= SINTONIZACAO_RANGE_M + 0.05;
  });
}

/** O Suporte pode oferecer Sintonização após curar `healedId`? (regra pura) */
export function canOfferSintonizacao(supporter: Character, healedId: string): boolean {
  if (!hasSpecAbility(supporter, SINTONIZACAO_ID)) return false;
  if (supporter.id === healedId) return false; // precisa curar um ALIADO
  return (supporter.peCurrent ?? 0) >= SINTONIZACAO_PE;
}

export interface SintonizacaoOffer {
  supporterId: string;
  healedId: string;
  healAmount: number;
  requestId: string;
}

interface SintonizacaoPromptState {
  offer: SintonizacaoOffer | null;
  open: (o: SintonizacaoOffer) => void;
  close: () => void;
}
export const useSintonizacaoPromptStore = create<SintonizacaoPromptState>()((set) => ({
  offer: null,
  open: (o) => set({ offer: o }),
  close: () => set({ offer: null }),
}));

export function shouldSeeSintonizacaoPrompt(supporterId: string, role: string | null): boolean {
  const c = useCharacterStore.getState().characters.find((x) => x.id === supporterId);
  if (c?.profileId) return useProfileStore.getState().activeProfileId === c.profileId;
  return role !== 'MASTER';
}

function emit(detail: Record<string, unknown>) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('sintonizacao:send', { detail }));
}

/**
 * Chamado pelos fluxos de cura do Suporte após curar um aliado.
 * Abre o aviso na tela do dono da ficha (e transmite para as outras telas).
 */
export async function maybeOfferSintonizacao(
  supporterId: string,
  healedId: string,
  healAmount: number,
): Promise<void> {
  const store = useCharacterStore.getState();
  const sup = store.characters.find((x) => x.id === supporterId);
  if (!sup || !canOfferSintonizacao(sup, healedId) || healAmount <= 0) return;
  const [{ useMapStore }, { useRoleStore }] = await Promise.all([
    import('@/stores/useMapStore'),
    import('@/stores/useRoleStore'),
  ]);
  const { entities, gridConfig } = useMapStore.getState();
  const targets = listSintonizacaoTargets(supporterId, healedId, store.characters, entities as never, gridConfig);
  if (targets.length === 0) return;
  const offer: SintonizacaoOffer = {
    supporterId,
    healedId,
    healAmount,
    requestId: `sint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  if (shouldSeeSintonizacaoPrompt(supporterId, useRoleStore.getState().role)) {
    useSintonizacaoPromptStore.getState().open(offer);
  }
  emit({ kind: 'offer', ...offer });
}

/** Aceita: paga 3 PE e cura o alvo secundário em metade (para cima) da cura original. */
export function acceptSintonizacao(
  offer: SintonizacaoOffer,
  targetId: string,
): { ok: boolean; reason?: string; healed?: number } {
  const store = useCharacterStore.getState();
  const sup = store.characters.find((x) => x.id === offer.supporterId);
  if (!sup) return { ok: false, reason: 'Suporte não encontrado.' };
  if ((sup.peCurrent ?? 0) < SINTONIZACAO_PE) return { ok: false, reason: `PE insuficiente (${SINTONIZACAO_PE} PE).` };
  const target = store.characters.find((x) => x.id === targetId);
  if (!target) return { ok: false, reason: 'Alvo não encontrado.' };
  if (target.id === offer.healedId) return { ok: false, reason: 'Escolha outra criatura (não o aliado já curado).' };
  const amount = sintonizacaoHealAmount(offer.healAmount);
  store.updateCharacter(sup.id, { peCurrent: (sup.peCurrent ?? 0) - SINTONIZACAO_PE });
  store.applyHealing(target.id, amount, 'other');
  useSintonizacaoPromptStore.getState().close();
  emit({ kind: 'accept', requestId: offer.requestId });
  return { ok: true, healed: amount };
}

export function closeSintonizacaoEverywhere(requestId: string): void {
  const cur = useSintonizacaoPromptStore.getState().offer;
  if (!cur || cur.requestId === requestId) useSintonizacaoPromptStore.getState().close();
  emit({ kind: 'close', requestId });
}

export type SintonizacaoMsg = ({ clientId?: string; kind?: string } & Partial<SintonizacaoOffer>) | null;

/** Regra pura: o que uma tela faz ao receber mensagem de Sintonização Vital. */
export function reduceSintonizacaoMessage(
  msg: SintonizacaoMsg,
  selfClientId: string,
  canSeePrompt: (supporterId: string) => boolean,
):
  | { type: 'open'; offer: SintonizacaoOffer }
  | { type: 'close'; requestId: string }
  | { type: 'ignore' } {
  if (!msg || msg.clientId === selfClientId || !msg.requestId) return { type: 'ignore' };
  if (msg.kind === 'accept' || msg.kind === 'close') return { type: 'close', requestId: msg.requestId };
  if (msg.kind === 'offer' && msg.supporterId && msg.healedId && msg.healAmount != null && canSeePrompt(msg.supporterId)) {
    return {
      type: 'open',
      offer: {
        supporterId: msg.supporterId,
        healedId: msg.healedId,
        healAmount: msg.healAmount,
        requestId: msg.requestId,
      },
    };
  }
  return { type: 'ignore' };
}
