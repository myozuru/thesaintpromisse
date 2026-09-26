/**
 * SUPORTE — Habilidades de 2º nível (5º par)
 *  • Expandir Repertório (sup-expandir-repertorio)
 *  • Mobilidade Avançada (sup-mobilidade-avancada)
 * Funções puras + ações no store. UI em SuporteRepertorioMobilidadeSections.tsx.
 */
import { create } from 'zustand';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { hasSpecAbility } from '@/lib/suporteNivel2';
import { effectiveMovement, MOBILIDADE_ID } from '@/lib/movementBudget';

export const REPERTORIO_ID = 'sup-expandir-repertorio';
export { MOBILIDADE_ID };
export const REPERTORIO_BONUS = 2;

// ===================== Expandir Repertório =====================

/** Perícias treinadas concedidas = metade do bônus de treinamento (para baixo). */
export function getRepertorioSlots(c: Pick<Character, 'level' | 'chosenSpecAbilities'>): number {
  if (!hasSpecAbility(c, REPERTORIO_ID)) return 0;
  return Math.floor(getTrainingBonusByLevel(c.level ?? 1) / 2);
}

export function getRepertorioPendentes(c: Character): number {
  return Math.max(0, getRepertorioSlots(c) - (c.repertorioSkills ?? []).length);
}

/** Opções para treinar: perícias ainda não treinadas. */
export function getRepertorioOpcoes(c: Character): string[] {
  return (c.skills ?? []).filter((s) => !s.trained).map((s) => s.name);
}

export function treinarRepertorio(c: Character, skillName: string): { ok: boolean; reason?: string } {
  if (getRepertorioPendentes(c) <= 0) return { ok: false, reason: 'Sem escolhas disponíveis.' };
  const sk = (c.skills ?? []).find((s) => s.name === skillName);
  if (!sk) return { ok: false, reason: 'Perícia não encontrada.' };
  if (sk.trained) return { ok: false, reason: 'Perícia já treinada.' };
  useCharacterStore.getState().updateCharacter(c.id, {
    skills: c.skills.map((s) => (s.name === skillName ? { ...s, trained: true } : s)),
    repertorioSkills: [...(c.repertorioSkills ?? []), skillName],
  });
  return { ok: true };
}

/** +2 fixo em qualquer perícia (inclusive as treinadas por esta habilidade). */
export function definirBonusRepertorio(c: Character, skillName: string): { ok: boolean; reason?: string } {
  if (!hasSpecAbility(c, REPERTORIO_ID)) return { ok: false, reason: 'Sem Expandir Repertório.' };
  if (c.repertorioBonusSkill) return { ok: false, reason: 'O +2 já foi escolhido.' };
  if (!(c.skills ?? []).some((s) => s.name === skillName)) return { ok: false, reason: 'Perícia não encontrada.' };
  useCharacterStore.getState().updateCharacter(c.id, {
    skills: c.skills.map((s) =>
      s.name === skillName ? { ...s, externalBonus: (s.externalBonus ?? 0) + REPERTORIO_BONUS } : s,
    ),
    repertorioBonusSkill: skillName,
  });
  return { ok: true };
}

/** Desfaz as escolhas (para corrigir um erro). */
export function resetarRepertorio(c: Character): void {
  const trained = new Set(c.repertorioSkills ?? []);
  useCharacterStore.getState().updateCharacter(c.id, {
    skills: c.skills.map((s) => {
      let n = s;
      if (trained.has(s.name)) n = { ...n, trained: false };
      if (c.repertorioBonusSkill === s.name) n = { ...n, externalBonus: (n.externalBonus ?? 0) - REPERTORIO_BONUS };
      return n;
    }),
    repertorioSkills: [],
    repertorioBonusSkill: undefined,
  });
}

// ===================== Mobilidade Avançada — reação =====================

/** Suportes que podem reagir quando `fallenId` cai a 0 PV. */
export function findMobilidadeReactors(fallenId: string, all: Character[]): Character[] {
  const fallen = all.find((x) => x.id === fallenId);
  if (!fallen || fallen.category !== 'PLAYER') return [];
  return all.filter(
    (c) =>
      c.id !== fallenId &&
      c.category === 'PLAYER' &&
      hasSpecAbility(c, MOBILIDADE_ID) &&
      (c.hpCurrent ?? 0) > 0 &&
      (c.reactionsCurrent ?? 0) > 0,
  );
}

export function getMobilidadeReacaoMeters(c: Character): number {
  return effectiveMovement(c) / 2;
}

/** Aceitar: gasta a reação e libera metade do movimento fora do turno. */
export function aceitarMobilidade(supporterId: string, movementUsed: number): { ok: boolean; reason?: string; meters: number } {
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === supporterId);
  if (!c) return { ok: false, reason: 'Ficha não encontrada.', meters: 0 };
  if ((c.reactionsCurrent ?? 0) <= 0) return { ok: false, reason: 'sem reação disponível', meters: 0 };
  const meters = getMobilidadeReacaoMeters(c);
  store.updateCharacter(c.id, {
    reactionsCurrent: (c.reactionsCurrent ?? 0) - 1,
    mobilidadeReacaoM: meters,
    mobilidadeReacaoBase: movementUsed,
  });
  return { ok: true, meters };
}

export interface MobilidadeOffer { supporterId: string; fallenId: string }

interface MobilidadeState {
  offers: MobilidadeOffer[];
  open: (o: MobilidadeOffer) => void;
  close: (supporterId?: string) => void;
}
export const useMobilidadePromptStore = create<MobilidadeState>()((set) => ({
  offers: [],
  open: (o) => set((s) => ({ offers: [...s.offers.filter((x) => x.supporterId !== o.supporterId), o] })),
  close: (id) => set((s) => ({ offers: id ? s.offers.filter((x) => x.supporterId !== id) : [] })),
}));

export function viewerSeesMobilidade(
  ownerProfileId: string | null | undefined,
  viewer: { role: string | null; profileId: string | null | undefined },
): boolean {
  if (ownerProfileId) return viewer.profileId === ownerProfileId;
  return viewer.role !== 'MASTER';
}

export function shouldSeeMobilidadePrompt(supporterId: string, role: string | null): boolean {
  const c = useCharacterStore.getState().characters.find((x) => x.id === supporterId);
  return viewerSeesMobilidade(c?.profileId, { role, profileId: useProfileStore.getState().activeProfileId });
}

export type MobilidadeMsg = ({ clientId?: string; kind?: string } & Partial<MobilidadeOffer>) | null;

export function reduceMobilidadeMessage(
  msg: MobilidadeMsg,
  selfClientId: string,
  canSee: (supporterId: string) => boolean,
): { type: 'open'; offer: MobilidadeOffer } | { type: 'close'; supporterId?: string } | { type: 'ignore' } {
  if (!msg || msg.clientId === selfClientId) return { type: 'ignore' };
  if (msg.kind === 'close') return { type: 'close', supporterId: msg.supporterId };
  if (msg.kind === 'offer' && msg.supporterId && msg.fallenId && canSee(msg.supporterId)) {
    return { type: 'open', offer: { supporterId: msg.supporterId, fallenId: msg.fallenId } };
  }
  return { type: 'ignore' };
}

export async function sendMobilidadeOffers(fallenId: string): Promise<void> {
  const all = useCharacterStore.getState().characters;
  const { useRoleStore } = await import('@/stores/useRoleStore');
  for (const sup of findMobilidadeReactors(fallenId, all)) {
    const offer = { supporterId: sup.id, fallenId };
    if (shouldSeeMobilidadePrompt(sup.id, useRoleStore.getState().role)) useMobilidadePromptStore.getState().open(offer);
    if (typeof window !== 'undefined')
      window.dispatchEvent(new CustomEvent('mobilidade:send', { detail: { kind: 'offer', ...offer } }));
  }
}

export function closeMobilidadeEverywhere(supporterId: string): void {
  useMobilidadePromptStore.getState().close(supporterId);
  if (typeof window !== 'undefined')
    window.dispatchEvent(new CustomEvent('mobilidade:send', { detail: { kind: 'close', supporterId } }));
}
