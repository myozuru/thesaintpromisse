/**
 * Especialista em Combate — Habilidade de 2º nível: Assumir Postura.
 *
 *  - Aprende 1 postura ao obter; +1 nos níveis 8 e 16.
 *  - Entrar: Ação Bônus, em combate. Dura 10 rodadas (1 minuto) ou até ficar
 *    Caído/incapacitado ou trocar. Usos = bônus de treinamento (descanso longo).
 *
 * Todas as 8 posturas: Sol, Lua, Terra, Dragão, Fortuna, Devastação, Tempestade e Céu.
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';

export const ASSUMIR_POSTURA_ID = 'ec-assumir-postura';

export type PosturaId = 'sol' | 'lua' | 'terra' | 'dragao' | 'fortuna' | 'devastacao' | 'tempestade' | 'ceu';

export interface PosturaDef { id: PosturaId; name: string; minLevel: number; summary: string; pronta: boolean }

export const POSTURAS: PosturaDef[] = [
  { id: 'sol', name: 'Sol', minLevel: 2, pronta: true, summary: '+2 acerto, +1 dado de dano, −4 Defesa.' },
  { id: 'lua', name: 'Lua', minLevel: 2, pronta: true, summary: '+3 Defesa; reação reduz dano pelo seu nível; −4 acerto e sem atributo no dano.' },
  { id: 'terra', name: 'Terra', minLevel: 2, pronta: true, summary: 'Imune a movimento forçado, +treinamento em Fortitude, PV temporários = nível no começo do turno.' },
  { id: 'dragao', name: 'Dragão', minLevel: 2, pronta: true, summary: 'Inimigos a 1,5 m do alvo atingido: Fortitude (CD Especialização) ou metade do dano.' },
  { id: 'fortuna', name: 'Fortuna', minLevel: 2, pronta: true, summary: 'd20 ≤ treinamento em ataque ou resistência: pode rolar de novo (metade do treinamento por rodada, 1x por dado).' },
  { id: 'devastacao', name: 'Devastação', minLevel: 6, pronta: true, summary: 'Cada acerto no mesmo alvo: +1 acerto e ignora 2 RD (máx. treinamento / dobro). Trocar de alvo zera.' },
  { id: 'tempestade', name: 'Tempestade', minLevel: 10, pronta: true, summary: 'Acerto: alvo faz Fortitude ou fica Caído; se já Caído, falha deixa Imóvel até seu próximo turno.' },
  { id: 'ceu', name: 'Céu', minLevel: 12, pronta: true, summary: 'Alcance dobrado, 2 pontos de preparo temporários por turno, +2 em perícias.' },
];

export const POSTURA_DURACAO_RODADAS = 10;

export const getPostura = (id: string | undefined | null) => POSTURAS.find((p) => p.id === id);

export function hasAssumirPostura(c: Character): boolean {
  return isEspecialistaCombate(c) && (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === ASSUMIR_POSTURA_ID);
}

/** Quantas posturas pode conhecer: 1 (+1 no 8, +1 no 16). */
export function posturasLimite(level: number): number {
  return 1 + (level >= 8 ? 1 : 0) + (level >= 16 ? 1 : 0);
}

/** Aprender Postura (nv 4): +1 postura ao obter e +1 no nível 10. */
export const APRENDER_POSTURA_ID = 'ec-aprender-postura';

export function hasAprenderPostura(c: Character): boolean {
  return isEspecialistaCombate(c) && (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === APRENDER_POSTURA_ID);
}

export function aprenderPosturaExtra(c: Character): number {
  if (!hasAprenderPostura(c)) return 0;
  return 1 + ((c.level ?? 1) >= 10 ? 1 : 0);
}

/** Limite efetivo da ficha (Assumir Postura + Aprender Postura). */
export function posturasLimiteChar(c: Character): number {
  return posturasLimite(c.level ?? 1) + aprenderPosturaExtra(c);
}

export function podeAprender(c: Character, id: PosturaId): { ok: boolean; reason?: string } {
  const def = getPostura(id);
  if (!def || !hasAssumirPostura(c)) return { ok: false, reason: 'Sem Assumir Postura.' };
  const known = c.posturasAprendidas ?? [];
  if (known.includes(id)) return { ok: false, reason: 'Já conhecida.' };
  if ((c.level ?? 1) < def.minLevel) return { ok: false, reason: `Requer nível ${def.minLevel}.` };
  if (known.length >= posturasLimiteChar(c)) return { ok: false, reason: 'Limite de posturas atingido.' };
  return { ok: true };
}

export const posturaUsosMax = (c: Character) => getTrainingBonusByLevel(c.level ?? 1);
export const posturaUsosRestantes = (c: Character) => Math.max(0, posturaUsosMax(c) - (c.posturaUsos ?? 0));

const QUEBRA = new Set(['caido', 'atordoado', 'inconsciente', 'paralisado', 'indefeso', 'morto', 'desmaiado']);
function condIds(c: Character): string[] {
  return (c.activeConditions ?? []).map((x) => x.conditionId);
}
export function quebraPostura(c: Character): boolean {
  return condIds(c).some((id) => QUEBRA.has(id));
}

/** Postura em vigor agora (null se nenhuma, expirada ou quebrada). */
export function posturaAtiva(c: Character | undefined | null): PosturaId | null {
  if (!c?.posturaAtiva || !hasAssumirPostura(c) || quebraPostura(c)) return null;
  return c.posturaAtiva.id as PosturaId;
}

export function podeEntrar(c: Character, id: PosturaId, t: { inCombat: boolean }): { ok: boolean; reason?: string } {
  if (!hasAssumirPostura(c)) return { ok: false, reason: 'Sem Assumir Postura.' };
  if (!(c.posturasAprendidas ?? []).includes(id)) return { ok: false, reason: 'Postura não aprendida.' };
  if (!t.inCombat) return { ok: false, reason: 'Só em combate.' };
  if (posturaAtiva(c) === id) return { ok: false, reason: 'Já está nesta postura.' };
  if (quebraPostura(c)) return { ok: false, reason: 'Caído ou incapacitado.' };
  if (posturaUsosRestantes(c) <= 0) return { ok: false, reason: 'Sem usos (recarrega no descanso longo).' };
  if ((c.bonusActionsCurrent ?? 0) <= 0) return { ok: false, reason: 'Sem Ação Bônus.' };
  return { ok: true };
}

export function patchEntrar(c: Character, id: PosturaId, round: number): Partial<Character> {
  return {
    posturaAtiva: { id, untilRound: round + POSTURA_DURACAO_RODADAS - 1 },
    posturaUsos: (c.posturaUsos ?? 0) + 1,
    devastacao: null,
    bonusActionsCurrent: Math.max(0, (c.bonusActionsCurrent ?? 0) - 1),
  };
}

// ─── Efeitos ─────────────────────────────────────────────────────────────────
export interface PosturaAtaque { hit: number; bonusDice: number; semAtributo: boolean; notes: string[] }
export function posturaAtaque(c: Character): PosturaAtaque {
  const p = posturaAtiva(c);
  if (p === 'sol') return { hit: 2, bonusDice: 1, semAtributo: false, notes: ['Postura do Sol: +2 acerto, +1 dado'] };
  if (p === 'lua') return { hit: -4, bonusDice: 0, semAtributo: true, notes: ['Postura da Lua: −4 acerto, sem atributo no dano'] };
  return { hit: 0, bonusDice: 0, semAtributo: false, notes: [] };
}

export function posturaDefesa(c: Character): number {
  const p = posturaAtiva(c);
  return p === 'sol' ? -4 : p === 'lua' ? 3 : 0;
}

export function posturaFortitude(c: Character): number {
  return posturaAtiva(c) === 'terra' ? getTrainingBonusByLevel(c.level ?? 1) : 0;
}

export function imuneMovimentoForcado(c: Character): boolean {
  return posturaAtiva(c) === 'terra';
}

/** PVT no começo do turno (Terra): não acumula, fica o maior. */
export function terraPvtPatch(c: Character): Partial<Character> | null {
  if (posturaAtiva(c) !== 'terra') return null;
  const lv = c.level ?? 1;
  return (c.escCurrent ?? 0) >= lv ? null : { escCurrent: lv };
}

/** Lua: reação que reduz o dano de um ataque pelo nível. */
export function luaReducao(c: Character): number {
  return posturaAtiva(c) === 'lua' && (c.reactionsCurrent ?? 0) > 0 ? (c.level ?? 1) : 0;
}

/** Dragão: TR de Fortitude de quem está perto do alvo. */
export function fortitudeMod(c: Character): number {
  const con = (c.attributes ?? []).find((a) => a.name === 'Constituição');
  return (con ? Math.floor((con.value - 10) / 2) : 0) + posturaFortitude(c);
}

// ─── Parte 2 ─────────────────────────────────────────────────────────────────
const bt = (c: Character) => getTrainingBonusByLevel(c.level ?? 1);

/** Devastação: bônus contra o alvo informado (acumulado de acertos anteriores). */
export function devastacaoBonus(c: Character, alvoId: string | undefined | null): { hit: number; rd: number } {
  if (posturaAtiva(c) !== 'devastacao' || !alvoId || c.devastacao?.alvoId !== alvoId) return { hit: 0, rd: 0 };
  const n = Math.min(c.devastacao.acertos, bt(c));
  return { hit: n, rd: n * 2 };
}

/** Devastação: atualiza acúmulo após atacar (trocar de alvo zera; errar não zera). */
export function devastacaoPatch(c: Character, alvoId: string, acertou: boolean): Partial<Character> | null {
  if (posturaAtiva(c) !== 'devastacao') return null;
  const mesmo = c.devastacao?.alvoId === alvoId;
  const base = mesmo ? c.devastacao!.acertos : 0;
  const acertos = Math.min(bt(c), base + (acertou ? 1 : 0));
  if (mesmo && acertos === base) return null;
  return { devastacao: { alvoId, acertos } };
}

/** Devastação: reconcilia o acúmulo quando o ataque é rerrolado — o resultado final é o que vale. */
export function devastacaoPatchReroll(c: Character, alvoId: string, acertouAntes: boolean, acertouAgora: boolean): Partial<Character> | null {
  if (posturaAtiva(c) !== 'devastacao' || acertouAntes === acertouAgora) return null;
  if (c.devastacao?.alvoId !== alvoId) return acertouAgora ? { devastacao: { alvoId, acertos: 1 } } : null;
  const acertos = Math.max(0, Math.min(bt(c), c.devastacao.acertos + (acertouAgora ? 1 : -1)));
  return { devastacao: { alvoId, acertos } };
}

/** Fortuna: usos por rodada = metade do treinamento (baixo), mínimo 1. */
export const fortunaUsosMax = (c: Character) => Math.max(1, Math.floor(bt(c) / 2));
export function fortunaUsosRestantes(c: Character, round: number): number {
  const used = c.fortunaUsos?.round === round ? c.fortunaUsos.used : 0;
  return Math.max(0, fortunaUsosMax(c) - used);
}
export function fortunaElegivel(c: Character, d20: number, round: number): boolean {
  return posturaAtiva(c) === 'fortuna' && d20 <= bt(c) && fortunaUsosRestantes(c, round) > 0;
}
export function fortunaPatchUso(c: Character, round: number): Partial<Character> {
  const used = c.fortunaUsos?.round === round ? c.fortunaUsos.used : 0;
  return { fortunaUsos: { round, used: used + 1 } };
}

/** Céu: alcance das armas dobrado. */
export const posturaAlcanceMult = (c: Character) => (posturaAtiva(c) === 'ceu' ? 2 : 1);
/** Céu: +2 em rolagens de perícia (não em TR). */
export const posturaPericia = (c: Character) => (posturaAtiva(c) === 'ceu' ? 2 : 0);
/** Céu: 2 pontos de preparo temporários no começo do turno (sobras somem). */
export function ceuPreparoPatch(c: Character): Partial<Character> | null {
  if (posturaAtiva(c) === 'ceu') return { preparoTemp: 2 };
  return (c.preparoTemp ?? 0) > 0 ? { preparoTemp: 0 } : null;
}
export const TEMPESTADE_IMOVEL_PREFIX = 'tempestade-imovel:';
