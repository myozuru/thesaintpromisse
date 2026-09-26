import { useProfileStore } from '@/stores/useProfileStore';
/**
 * SUPORTE — Habilidades de Suporte do 2º nível (escolhidas no catálogo).
 *  • Amizade Inquebrável (sup-amizade-inquebravel)
 *  • Análise Profunda   (sup-analise-profunda)
 * Funções puras + ações que gravam no store. A UI fica em
 * SuporteNivel2Sections.tsx e AmizadePromptDialog.tsx.
 */
import type { Character } from '@/types';
import { getTrainingBonus } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { findCharEntity, isWithinTouch, type TouchEntity, type TouchGrid } from '@/lib/touchRange';
import { create } from 'zustand';

export const AMIZADE_ID = 'sup-amizade-inquebravel';
export const ANALISE_ID = 'sup-analise-profunda';

export function hasSpecAbility(c: Pick<Character, 'chosenSpecAbilities'>, id: string): boolean {
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === id);
}

// ===================== Amizade Inquebrável =====================

export function getAmigo(c: Character, all: Character[]): Character | null {
  if (!c.suporteAmigoId) return null;
  return all.find((x) => x.id === c.suporteAmigoId) ?? null;
}

/** Pode (re)escolher o Amigo: ainda não tem, ou o Mestre liberou a troca. */
export function canChooseAmigo(c: Character): boolean {
  return hasSpecAbility(c, AMIZADE_ID) && (!c.suporteAmigoId || !!c.suporteAmigoTrocaLiberada);
}

export function setAmigo(c: Character, friend: Character): { ok: boolean; reason?: string } {
  if (!hasSpecAbility(c, AMIZADE_ID)) return { ok: false, reason: 'Sem Amizade Inquebrável.' };
  if (!canChooseAmigo(c)) return { ok: false, reason: 'O Amigo é permanente. O Mestre precisa liberar a troca no interlúdio.' };
  if (friend.id === c.id) return { ok: false, reason: 'Você não pode ser seu próprio Amigo.' };
  if (friend.category !== 'PLAYER') return { ok: false, reason: 'O Amigo precisa ser um aliado Jogador.' };
  useCharacterStore.getState().updateCharacter(c.id, { suporteAmigoId: friend.id, suporteAmigoTrocaLiberada: false });
  return { ok: true };
}

/** Botão do Mestre (interlúdio após a morte do Amigo). */
export function liberarTrocaAmigo(c: Character): void {
  useCharacterStore.getState().updateCharacter(c.id, { suporteAmigoTrocaLiberada: true });
}

/**
 * No fim do turno do Suporte: devolve o Amigo se ele puder receber o Apoiar
 * gratuito (tem a habilidade, Amigo vivo e a até 1,5 m no mapa).
 */
export function amizadeEndTurnTarget<E extends TouchEntity & { characterId?: string }>(
  c: Character,
  all: Character[],
  entities: Record<string, E>,
  grid: TouchGrid,
): Character | null {
  if (!hasSpecAbility(c, AMIZADE_ID)) return null;
  const friend = getAmigo(c, all);
  if (!friend || (friend.hpCurrent ?? 0) <= 0) return null;
  const a = findCharEntity(entities, c.id);
  const b = findCharEntity(entities, friend.id);
  if (!a || !b || !isWithinTouch(a, b, grid)) return null;
  return friend;
}

/** Fila da pergunta "Apoiar seu Amigo?" mostrada ao passar o turno. */
interface AmizadePromptState {
  prompt: { supporterId: string; friendId: string } | null;
  open: (p: { supporterId: string; friendId: string }) => void;
  close: () => void;
}
export const useAmizadePromptStore = create<AmizadePromptState>()((set) => ({
  prompt: null,
  open: (p) => set({ prompt: p }),
  close: () => set({ prompt: null }),
}));

/** Chamado pelo combate ao encerrar o turno de `charId`. */
export async function checkAmizadeAtEndOfTurn(charId: string): Promise<void> {
  const all = useCharacterStore.getState().characters;
  const c = all.find((x) => x.id === charId);
  if (!c) return;
  const { useMapStore } = await import('@/stores/useMapStore');
  const { entities, gridConfig } = useMapStore.getState();
  const friend = amizadeEndTurnTarget(c, all, entities, gridConfig);
  if (!friend) return;
  const payload = { supporterId: c.id, friendId: friend.id };
  const { useRoleStore } = await import('@/stores/useRoleStore');
  // A pergunta é do jogador, não do Mestre: abre aqui só se esta tela for de jogador
  // e manda para as telas dos jogadores conectados.
  if (shouldSeeAmizadePrompt(c.id, useRoleStore.getState().role)) useAmizadePromptStore.getState().open(payload);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('amizade:send', { detail: { kind: 'open', ...payload } }));
}

/**
 * A pergunta vai só para a conta dona da ficha do Suporte. Ficha sem dono:
 * qualquer jogador (não-Mestre) vê, como antes.
 */
export function shouldSeeAmizadePrompt(supporterId: string, role: string | null): boolean {
  const c = useCharacterStore.getState().characters.find((x) => x.id === supporterId);
  return viewerSeesAmizade(c?.profileId, { role, profileId: useProfileStore.getState().activeProfileId });
}

/** Regra pura: quem vê a pergunta (testável sem telas nem rede). */
export function viewerSeesAmizade(
  ownerProfileId: string | null | undefined,
  viewer: { role: string | null; profileId: string | null | undefined },
): boolean {
  if (ownerProfileId) return viewer.profileId === ownerProfileId;
  return viewer.role !== 'MASTER';
}

export type AmizadeMsg = { clientId?: string; kind?: string; supporterId?: string; friendId?: string } | null;

/** Regra pura: o que uma tela faz ao receber uma mensagem de Amizade. */
export function reduceAmizadeMessage(
  msg: AmizadeMsg,
  selfClientId: string,
  canSee: (supporterId: string) => boolean,
): { type: 'open'; supporterId: string; friendId: string } | { type: 'close' } | { type: 'ignore' } {
  if (!msg || msg.clientId === selfClientId) return { type: 'ignore' };
  if (msg.kind === 'close') return { type: 'close' };
  if (msg.kind === 'open' && msg.supporterId && msg.friendId && canSee(msg.supporterId)) {
    return { type: 'open', supporterId: msg.supporterId, friendId: msg.friendId };
  }
  return { type: 'ignore' };
}

/** Fecha a pergunta aqui e nas outras telas (alguém já respondeu). */
export function closeAmizadePromptEverywhere(): void {
  useAmizadePromptStore.getState().close();
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('amizade:send', { detail: { kind: 'close' } }));
}

// ===================== Análise Profunda =====================

export const ANALISE_PE_COST = 1;

/** ND da criatura: ND real do Grimório (se > 20) ou o nível da ficha. */
export function getCreatureND(t: Character): number {
  const real = (t.passives ?? []).find((p) => p.name === '[ND Real]');
  const m = real?.description?.match(/ND original:\s*(\d+)/);
  if (m) return Number(m[1]);
  return t.level ?? 1;
}

export function getAnaliseCD(t: Character): number {
  return 15 + getCreatureND(t);
}

/** Quantas características são descobertas: 0 na falha, 1 + 1 a cada 5 excedentes. */
export function getAnaliseDiscoveries(total: number, cd: number): number {
  if (total < cd) return 0;
  return 1 + Math.floor((total - cd) / 5);
}

/** Bônus de Percepção do analista (perícia + Sabedoria + treino + ½ nível + inspiração). */
export function getPercepcaoBonus(c: Character): number {
  const sk = (c.skills ?? []).find((s) => s.name === 'Percepção');
  const attrName = sk?.linkedAttribute || 'Sabedoria';
  const attr = (c.attributes ?? []).find((a) => a.name === attrName || a.id === attrName);
  const attrMod = Math.floor(((attr?.value ?? 10) - 10) / 2);
  return (
    (sk?.value ?? 0) +
    attrMod +
    getTrainingBonus(c.level, sk?.trained, sk?.mastery) +
    Math.floor((c.level ?? 1) / 2) +
    (sk?.externalBonus ?? 0) +
    (c.inspiracaoBonus ?? 0)
  );
}

export function canAnalisar(
  c: Character,
  target: Character,
  inCombat: boolean,
): { ok: boolean; reason?: string } {
  if (!hasSpecAbility(c, ANALISE_ID)) return { ok: false, reason: 'Sem Análise Profunda.' };
  if (target.id === c.id) return { ok: false, reason: 'Escolha outra criatura.' };
  if ((c.analiseProfundaAlvos ?? []).includes(target.id)) return { ok: false, reason: 'Já analisada nesta cena.' };
  if ((c.peCurrent ?? 0) < ANALISE_PE_COST) return { ok: false, reason: 'PE insuficiente (1 PE).' };
  if (inCombat && (c.actionsCurrent ?? 0) <= 0) return { ok: false, reason: 'Sem Ação Comum neste turno.' };
  return { ok: true };
}

/** Paga 1 PE (+ Ação Comum em combate), marca o alvo na cena e devolve o resultado. */
export function performAnalise(
  c: Character,
  target: Character,
  total: number,
  inCombat: boolean,
): { ok: boolean; reason?: string; cd: number; discoveries: number } {
  const cd = getAnaliseCD(target);
  const check = canAnalisar(c, target, inCombat);
  if (!check.ok) return { ok: false, reason: check.reason, cd, discoveries: 0 };
  useCharacterStore.getState().updateCharacter(c.id, {
    peCurrent: (c.peCurrent ?? 0) - ANALISE_PE_COST,
    analiseProfundaAlvos: [...(c.analiseProfundaAlvos ?? []), target.id],
    ...(inCombat ? { actionsCurrent: Math.max(0, (c.actionsCurrent ?? 0) - 1) } : {}),
  });
  return { ok: true, cd, discoveries: getAnaliseDiscoveries(total, cd) };
}

export interface AnaliseTrait { key: string; label: string; value: string }

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Características que podem ser reveladas (valores reais da ficha). */
export function getAnaliseTraits(t: Character): AnaliseTrait[] {
  const saves = (t.savingThrows ?? []).map((s) => `${s.name} ${sign(s.value ?? 0)}`).join(', ');
  const skills = [...(t.skills ?? [])]
    .filter((s) => (s.value ?? 0) !== 0 || s.trained || s.mastery)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 6)
    .map((s) => `${s.name} ${sign(s.value ?? 0)}${s.mastery ? ' (maestria)' : s.trained ? ' (treinada)' : ''}`)
    .join(', ');
  const attrs = (t.attributes ?? []).map((a) => `${a.name} ${a.value}`).join(', ');
  const rdTypes = Object.entries(t.rdByType ?? {})
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
  return [
    { key: 'pv', label: 'Pontos de vida', value: `${t.hpCurrent}/${t.hpMax} PV` },
    { key: 'ca', label: 'Classe de Armadura', value: `CA ${t.ca}` },
    { key: 'cd', label: 'CD das habilidades', value: `CD ${t.baseDC}` },
    { key: 'ataque', label: 'Bônus de ataque', value: `Corpo a corpo ${sign(t.meleeAttackBonus ?? 0)}, distância ${sign(t.rangedAttackBonus ?? 0)}, amaldiçoado ${sign(t.cursedAttackBonus ?? 0)}` },
    { key: 'trs', label: 'Testes de resistência', value: saves || '—' },
    { key: 'pericias', label: 'Perícias', value: skills || '—' },
    { key: 'atributos', label: 'Atributos', value: attrs || '—' },
    { key: 'rd', label: 'Redução de dano', value: `RD ${t.rd ?? 0}${rdTypes ? ` (${rdTypes})` : ''}` },
  ];
}
