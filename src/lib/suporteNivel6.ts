/**
 * ============================================================================
 *  SUPORTE — Habilidades de 6º nível
 *  • Apoio Avançado        (sup-apoio-avancado)
 *  • Conceder Outra Chance (sup-conceder-outra-chance)
 * ============================================================================
 *  Funções puras + ações que gravam no store. A UI fica em
 *  SuporteNivel6Sections.tsx; o Apoiar com efeito é acionado no SuportePanel.
 */
import { create } from 'zustand';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { getSuporteKeyMod, getSuporteHealUsesLeft } from '@/lib/suporteAbilities';
import { hasSpecAbility } from '@/lib/suporteNivel2';
import { findCharEntity, touchDistanceMeters, type TouchEntity, type TouchGrid } from '@/lib/touchRange';

export const APOIO_AVANCADO_ID = 'sup-apoio-avancado';
export const OUTRA_CHANCE_ID = 'sup-conceder-outra-chance';

// ===================== Apoio Avançado =====================

export type ApoioAvancadoKey = 'curativo' | 'defensivo' | 'focado' | 'ofensivo' | 'estrategico';

export const APOIOS_AVANCADOS: Record<ApoioAvancadoKey, { label: string; desc: string }> = {
  curativo: {
    label: 'Apoio Curativo',
    desc: 'Gasta 1 uso de Suporte em Combate e cura o aliado como parte do Apoiar.',
  },
  defensivo: {
    label: 'Apoio Defensivo',
    desc: 'O aliado recebe +½ do seu bônus de treinamento na Defesa até o início do seu próximo turno.',
  },
  focado: {
    label: 'Apoio Focado',
    desc: 'Além da vantagem, o aliado soma +½ do seu mod de Presença/Sabedoria no próximo teste.',
  },
  ofensivo: {
    label: 'Apoio Ofensivo',
    desc: 'Gaste 2 PE para realizar um ataque como parte do Apoiar.',
  },
  estrategico: {
    label: 'Apoio Estratégico',
    desc: 'A CD do próximo teste que o aliado forçar (TR) aumenta em +½ do seu bônus de treinamento.',
  },
};

  /** Quantos apoios o Suporte conhece: 1 no Nv 2, +1 no Nv 6, +1 no Nv 12. */
  export function getApoiosMax(level: number): number {
    if ((level ?? 0) >= 12) return 3;
    if ((level ?? 0) >= 6) return 2;
    if ((level ?? 0) >= 2) return 1;
    return 0;
  }

export function getApoiosEscolhidos(c: Pick<Character, 'apoiosAvancados'>): ApoioAvancadoKey[] {
  return (c.apoiosAvancados ?? []).filter((k): k is ApoioAvancadoKey => k in APOIOS_AVANCADOS);
}

export function canChooseApoio(c: Character): boolean {
  return hasSpecAbility(c, APOIO_AVANCADO_ID) && getApoiosEscolhidos(c).length < getApoiosMax(c.level);
}

export function chooseApoio(c: Character, key: ApoioAvancadoKey): { ok: boolean; reason?: string } {
  if (!hasSpecAbility(c, APOIO_AVANCADO_ID)) return { ok: false, reason: 'Sem Apoio Avançado.' };
  const chosen = getApoiosEscolhidos(c);
  if (chosen.includes(key)) return { ok: false, reason: 'Apoio já conhecido.' };
  if (chosen.length >= getApoiosMax(c.level)) return { ok: false, reason: 'Limite de apoios atingido.' };
  useCharacterStore.getState().updateCharacter(c.id, { apoiosAvancados: [...chosen, key] });
  return { ok: true };
}

export interface ApoioAvancadoResult {
  ok: boolean;
  reason?: string;
  /** 'curativo' pede que a UI role a cura (Suporte em Combate) no alvo. */
  needsHealRoll?: boolean;
  /** Texto extra para o log. */
  note?: string;
}

/**
 * Aplica o efeito do Apoio Avançado escolhido (depois do Apoiar normal).
 * Pré-condição: o Apoiar já foi aplicado no alvo.
 */
export function applyApoioAvancado(
  supporter: Character,
  target: Character,
  key: ApoioAvancadoKey,
): ApoioAvancadoResult {
  if (!getApoiosEscolhidos(supporter).includes(key)) {
    return { ok: false, reason: 'Apoio não conhecido.' };
  }
  const store = useCharacterStore.getState();
  const tb = getTrainingBonusByLevel(supporter.level ?? 1);
  switch (key) {
    case 'curativo': {
      if (getSuporteHealUsesLeft(supporter) <= 0) {
        return { ok: false, reason: 'Sem usos de Suporte em Combate para a cura.' };
      }
      return { ok: true, needsHealRoll: true };
    }
    case 'defensivo': {
      const value = Math.floor(tb / 2);
      store.updateCharacter(target.id, { apoioDefensivo: { value, grantedBy: supporter.id } });
      return { ok: true, note: `+${value} na Defesa até o início do próximo turno de ${supporter.name}` };
    }
    case 'focado': {
      const value = Math.floor(getSuporteKeyMod(supporter) / 2);
      return { ok: true, note: `+${value} no próximo teste de perícia (além da vantagem)`, ...grantFocado(target, supporter, value) };
    }
    case 'ofensivo': {
      if ((supporter.peCurrent ?? 0) < 2) return { ok: false, reason: 'PE insuficiente (2 PE).' };
      store.updateCharacter(supporter.id, { peCurrent: (supporter.peCurrent ?? 0) - 2 });
      return { ok: true, note: `${supporter.name} pode realizar 1 ataque agora como parte do Apoiar (−2 PE)` };
    }
    case 'estrategico': {
      const value = Math.floor(tb / 2);
      store.updateCharacter(target.id, { apoioEstrategico: { value, grantedBy: supporter.id } });
      return { ok: true, note: `+${value} na CD do próximo teste que ${target.name} forçar, até o início do próximo turno de ${supporter.name}` };
    }
  }
}

function grantFocado(target: Character, supporter: Character, value: number): { note?: string } {
  // Concede bônus fixo no próximo teste de perícia (consumido na rolagem).
  void import('@/lib/omni/rollAdvantage').then(({ grantFlatBonus }) => {
    grantFlatBonus(target.id, 'next_skill', value, {
      expires: 'use',
      source: `Apoio Focado (${supporter.name})`,
      grantedBy: supporter.id,
    });
  });
  return {};
}

/** Expira os buffs de Apoio Avançado concedidos por `grantorId` (início do turno dele). */
export function expireApoiosGrantedBy(grantorId: string): void {
  const store = useCharacterStore.getState();
  for (const c of store.characters) {
    const patch: Partial<Character> = {};
    if (c.apoioDefensivo?.grantedBy === grantorId) patch.apoioDefensivo = undefined;
    if (c.apoioEstrategico?.grantedBy === grantorId) patch.apoioEstrategico = undefined;
    if (Object.keys(patch).length > 0) store.updateCharacter(c.id, patch);
  }
}

/** CD efetiva das habilidades de uma ficha (Apoio Estratégico soma aqui). */
export function getEffectiveBaseDC(c: Character): number {
  return (c.baseDC ?? 0) + (c.apoioEstrategico?.value ?? 0);
}

// ===================== Conceder Outra Chance =====================

export const OUTRA_CHANCE_PE_COST = 3;
export const OUTRA_CHANCE_RANGE_M = 6;

/** Usos por descanso longo = bônus de treinamento. */
export function getOutraChanceMaxUses(c: Pick<Character, 'level'>): number {
  return getTrainingBonusByLevel(c.level ?? 1);
}

export function getOutraChanceUsesLeft(c: Character): number {
  if (!hasSpecAbility(c, OUTRA_CHANCE_ID)) return 0;
  return Math.max(0, getOutraChanceMaxUses(c) - (c.outraChanceUsed ?? 0));
}

/** Descanso curto recupera metade dos usos (arredondado para baixo). */
export function getOutraChanceUsedAfterShortRest(c: Character): number {
  return Math.max(0, (c.outraChanceUsed ?? 0) - Math.floor(getOutraChanceMaxUses(c) / 2));
}

export interface OutraChanceOffer {
  supporterId: string;
  rollerId: string;
  requestId: string;
  testName: string;
  total: number;
  dc: number;
}

/**
 * Acha um Suporte capaz de oferecer Outra Chance para `rollerId`:
 * tem a habilidade, usos restantes, PE suficiente e está a até 6 m do aliado
 * no mapa. Regra pura (testável com a mesa simulada).
 */
export function findOutraChanceSupporter<E extends TouchEntity & { characterId?: string }>(
  rollerId: string,
  all: Character[],
  entities: Record<string, E>,
  grid: TouchGrid,
): Character | null {
  const roller = all.find((x) => x.id === rollerId);
  if (!roller || roller.category !== 'PLAYER') return null;
  const rollerEnt = findCharEntity(entities, rollerId);
  if (!rollerEnt) return null;
  for (const c of all) {
    if (c.id === rollerId) continue;
    if (!hasSpecAbility(c, OUTRA_CHANCE_ID)) continue;
    if (getOutraChanceUsesLeft(c) <= 0) continue;
    if ((c.peCurrent ?? 0) < OUTRA_CHANCE_PE_COST) continue;
    const supEnt = findCharEntity(entities, c.id);
    if (!supEnt) continue;
    if (touchDistanceMeters(supEnt, rollerEnt, grid) > OUTRA_CHANCE_RANGE_M + 0.05) continue;
    return c;
  }
  return null;
}

/** Fila da pergunta "Conceder Outra Chance?" mostrada ao dono do Suporte. */
interface OutraChancePromptState {
  offer: OutraChanceOffer | null;
  open: (o: OutraChanceOffer) => void;
  close: () => void;
}
export const useOutraChancePromptStore = create<OutraChancePromptState>()((set) => ({
  offer: null,
  open: (o) => set({ offer: o }),
  close: () => set({ offer: null }),
}));

/** A pergunta vai só para a conta dona da ficha do Suporte (sem dono: qualquer jogador). */
export function shouldSeeOutraChancePrompt(supporterId: string, role: string | null): boolean {
  const c = useCharacterStore.getState().characters.find((x) => x.id === supporterId);
  if (c?.profileId) return useProfileStore.getState().activeProfileId === c.profileId;
  return role !== 'MASTER';
}

/** Dispara a oferta aqui e nas outras telas. */
export async function sendOutraChanceOffer(offer: OutraChanceOffer): Promise<void> {
  const { useRoleStore } = await import('@/stores/useRoleStore');
  if (shouldSeeOutraChancePrompt(offer.supporterId, useRoleStore.getState().role)) {
    useOutraChancePromptStore.getState().open(offer);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('outra-chance:send', { detail: { kind: 'offer', ...offer } }));
  }
}

/** Aceita: paga 3 PE, gasta 1 uso e manda o rolador rolar de novo. */
export function acceptOutraChance(offer: OutraChanceOffer): { ok: boolean; reason?: string } {
  const store = useCharacterStore.getState();
  const sup = store.characters.find((x) => x.id === offer.supporterId);
  if (!sup) return { ok: false, reason: 'Suporte não encontrado.' };
  if (getOutraChanceUsesLeft(sup) <= 0) return { ok: false, reason: 'Sem usos restantes.' };
  if ((sup.peCurrent ?? 0) < OUTRA_CHANCE_PE_COST) return { ok: false, reason: 'PE insuficiente (3 PE).' };
  store.updateCharacter(sup.id, {
    peCurrent: (sup.peCurrent ?? 0) - OUTRA_CHANCE_PE_COST,
    outraChanceUsed: (sup.outraChanceUsed ?? 0) + 1,
  });
  useOutraChancePromptStore.getState().close();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('outra-chance:send', {
        detail: { kind: 'accept', requestId: offer.requestId, rollerId: offer.rollerId, supporterId: offer.supporterId },
      }),
    );
  }
  return { ok: true };
}

/** Recusa/expira: fecha aqui e nas outras telas. */
export function closeOutraChanceEverywhere(requestId?: string): void {
  useOutraChancePromptStore.getState().close();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('outra-chance:send', { detail: { kind: 'close', requestId } }));
  }
}

export type OutraChanceMsg =
  | ({ clientId?: string; kind?: string } & Partial<OutraChanceOffer>)
  | null;

/** Regra pura: o que uma tela faz ao receber uma mensagem de Outra Chance. */
export function reduceOutraChanceMessage(
  msg: OutraChanceMsg,
  selfClientId: string,
  canSee: (supporterId: string) => boolean,
):
  | { type: 'open'; offer: OutraChanceOffer }
  | { type: 'accept'; requestId: string; rollerId: string }
  | { type: 'close' }
  | { type: 'ignore' } {
  if (!msg || msg.clientId === selfClientId) return { type: 'ignore' };
  if (msg.kind === 'close') return { type: 'close' };
  if (msg.kind === 'accept' && msg.requestId && msg.rollerId) {
    return { type: 'accept', requestId: msg.requestId, rollerId: msg.rollerId };
  }
  if (
    msg.kind === 'offer' &&
    msg.supporterId &&
    msg.rollerId &&
    msg.requestId &&
    msg.testName &&
    typeof msg.total === 'number' &&
    typeof msg.dc === 'number' &&
    canSee(msg.supporterId)
  ) {
    return {
      type: 'open',
      offer: {
        supporterId: msg.supporterId,
        rollerId: msg.rollerId,
        requestId: msg.requestId,
        testName: msg.testName,
        total: msg.total,
        dc: msg.dc,
      },
    };
  }
  return { type: 'ignore' };
}
