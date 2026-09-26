/**
 * ============================================================================
 *  SUPORTE — Habilidades de 2º nível (3º par)
 *  • Otimização de Espaço (sup-otimizacao-espaco)
 *  • Protetor             (sup-protetor)
 * ============================================================================
 *  Funções puras + ações que gravam no store. A UI fica em
 *  ProtetorPromptDialog.tsx; o bônus de espaços entra no cálculo da ficha.
 */
import { create } from 'zustand';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { getSuporteKeyMod } from '@/lib/suporteAbilities';
import { hasSpecAbility } from '@/lib/suporteNivel2';
import { getShieldById } from '@/lib/shields';
import { findCharEntity, isWithinTouch, type TouchEntity, type TouchGrid } from '@/lib/touchRange';

export const OTIMIZACAO_ID = 'sup-otimizacao-espaco';
export const PROTETOR_ID = 'sup-protetor';

// ===================== Otimização de Espaço =====================

/** Espaços de item adicionais = bônus de treinamento (0 sem a habilidade). */
export function getOtimizacaoSlotsBonus(c: Pick<Character, 'chosenSpecAbilities' | 'level'>): number {
  if (!hasSpecAbility(c, OTIMIZACAO_ID)) return 0;
  return getTrainingBonusByLevel(c.level ?? 1);
}

// ===================== Protetor =====================

export const PROTETOR_PE_COST = 1;

/** Dados da redução: Xd10, X = bônus de treinamento. */
export function getProtetorDice(c: Pick<Character, 'level'>): { count: number; sides: number } {
  return { count: getTrainingBonusByLevel(c.level ?? 1), sides: 10 };
}

/** Modificador somado à redução: Presença ou Sabedoria (atributo-chave). */
export function getProtetorMod(c: Pick<Character, 'attributes' | 'keyAttribute'>): number {
  return getSuporteKeyMod(c);
}

/** Tem escudo equipado (requisito do Protetor). */
export function hasShieldEquipped(c: Pick<Character, 'equippedShieldId'>): boolean {
  return !!getShieldById(c.equippedShieldId);
}

/**
 * Acha um Suporte capaz de proteger `targetId`: tem a habilidade, escudo
 * equipado, PE suficiente, é aliado jogador e está a até 1,5 m do alvo no
 * mapa. Regra pura (testável com a mesa simulada).
 */
export function findProtetor<E extends TouchEntity & { characterId?: string }>(
  targetId: string,
  all: Character[],
  entities: Record<string, E>,
  grid: TouchGrid,
): Character | null {
  const target = all.find((x) => x.id === targetId);
  if (!target || target.category !== 'PLAYER') return null;
  const targetEnt = findCharEntity(entities, targetId);
  if (!targetEnt) return null;
  for (const c of all) {
    if (c.id === targetId) continue;
    if (!hasSpecAbility(c, PROTETOR_ID)) continue;
    if (!hasShieldEquipped(c)) continue;
    if ((c.peCurrent ?? 0) < PROTETOR_PE_COST) continue;
    const supEnt = findCharEntity(entities, c.id);
    if (!supEnt) continue;
    if (!isWithinTouch(supEnt, targetEnt, grid)) continue;
    return c;
  }
  return null;
}

export interface ProtetorOffer {
  supporterId: string;
  targetId: string;
  /** Dano efetivamente sofrido (Esc + HP) pelo alvo. */
  damageDealt: number;
  hpLost: number;
  escLost: number;
}

/** Fila da pergunta "Usar Protetor?" mostrada ao dono do Suporte. */
interface ProtetorPromptState {
  offer: ProtetorOffer | null;
  open: (o: ProtetorOffer) => void;
  close: () => void;
}
export const useProtetorPromptStore = create<ProtetorPromptState>()((set) => ({
  offer: null,
  open: (o) => set({ offer: o }),
  close: () => set({ offer: null }),
}));

/** A pergunta vai só para a conta dona da ficha do Suporte (sem dono: qualquer jogador). */
export function shouldSeeProtetorPrompt(supporterId: string, role: string | null): boolean {
  const c = useCharacterStore.getState().characters.find((x) => x.id === supporterId);
  if (c?.profileId) return useProfileStore.getState().activeProfileId === c.profileId;
  return role !== 'MASTER';
}

/** Dispara a oferta aqui e nas outras telas. */
export async function sendProtetorOffer(offer: ProtetorOffer): Promise<void> {
  const { useRoleStore } = await import('@/stores/useRoleStore');
  if (shouldSeeProtetorPrompt(offer.supporterId, useRoleStore.getState().role)) {
    useProtetorPromptStore.getState().open(offer);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('protetor:send', { detail: { kind: 'offer', ...offer } }));
  }
}

/** Recusa/expira: fecha aqui e nas outras telas. */
export function closeProtetorEverywhere(): void {
  useProtetorPromptStore.getState().close();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('protetor:send', { detail: { kind: 'close' } }));
  }
}

export type ProtetorMsg =
  | ({ clientId?: string; kind?: string } & Partial<ProtetorOffer>)
  | null;

/** Regra pura: o que uma tela faz ao receber uma mensagem de Protetor. */
export function reduceProtetorMessage(
  msg: ProtetorMsg,
  selfClientId: string,
  canSee: (supporterId: string) => boolean,
): { type: 'open'; offer: ProtetorOffer } | { type: 'close' } | { type: 'ignore' } {
  if (!msg || msg.clientId === selfClientId) return { type: 'ignore' };
  if (msg.kind === 'close') return { type: 'close' };
  if (
    msg.kind === 'offer' &&
    msg.supporterId &&
    msg.targetId &&
    typeof msg.damageDealt === 'number' &&
    canSee(msg.supporterId)
  ) {
    return {
      type: 'open',
      offer: {
        supporterId: msg.supporterId,
        targetId: msg.targetId,
        damageDealt: msg.damageDealt,
        hpLost: msg.hpLost ?? 0,
        escLost: msg.escLost ?? 0,
      },
    };
  }
  return { type: 'ignore' };
}

/**
 * Calcula o reembolso do Protetor (regra pura): a redução rolada cobre
 * primeiro o HP perdido, depois o Escudo perdido, limitada ao dano sofrido.
 */
export function protetorRefund(
  offer: Pick<ProtetorOffer, 'hpLost' | 'escLost'>,
  rollTotal: number,
): { hpBack: number; escBack: number } {
  let rest = Math.max(0, Math.min(rollTotal, offer.hpLost + offer.escLost));
  const hpBack = Math.min(rest, offer.hpLost);
  rest -= hpBack;
  const escBack = Math.min(rest, offer.escLost);
  return { hpBack, escBack };
}

/**
 * Aplica o Protetor depois da rolagem (feita pela UI): paga 1 PE do Suporte
 * e devolve HP/Escudo ao alvo conforme `protetorRefund`.
 */
export function applyProtetor(
  offer: ProtetorOffer,
  rollTotal: number,
): { ok: boolean; reason?: string; hpBack: number; escBack: number } {
  const store = useCharacterStore.getState();
  const sup = store.characters.find((x) => x.id === offer.supporterId);
  const target = store.characters.find((x) => x.id === offer.targetId);
  if (!sup || !target) return { ok: false, reason: 'Ficha não encontrada.', hpBack: 0, escBack: 0 };
  if ((sup.peCurrent ?? 0) < PROTETOR_PE_COST) {
    return { ok: false, reason: 'PE insuficiente (1 PE).', hpBack: 0, escBack: 0 };
  }
  const { hpBack, escBack } = protetorRefund(offer, rollTotal);
  store.updateCharacter(sup.id, { peCurrent: (sup.peCurrent ?? 0) - PROTETOR_PE_COST });
  store.updateCharacter(target.id, {
    hpCurrent: Math.min(target.hpMax, (target.hpCurrent ?? 0) + hpBack),
    escCurrent: Math.min(target.escMax ?? 0, (target.escCurrent ?? 0) + escBack),
  });
  useProtetorPromptStore.getState().close();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('protetor:send', { detail: { kind: 'close' } }));
  }
  return { ok: true, hpBack, escBack };
}
