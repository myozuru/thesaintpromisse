/**
 * Especialista em Combate — Repertório do Especialista (Estilos de Combate).
 *
 * Nv 1: 1 estilo; Nv 6: +1; Nv 12: +1. Todos os estilos escolhidos ficam ativos.
 * O talento geral "Adepto de Combate" concede 1 estilo extra (escala pelo nível).
 * Funções puras; UI em CombateEstilosPanel.tsx.
 */
import type { Character } from '@/types';

export type CombatStyleId =
  | 'defensivo'
  | 'arremessador'
  | 'duelista'
  | 'interceptador'
  | 'protetor'
  | 'distante'
  | 'duplo'
  | 'massivo';

export interface CombatStyleDef {
  id: CombatStyleId;
  name: string;
  summary: string;
  /** Já tem efeito mecânico automático no jogo. */
  implemented: boolean;
}

export const COMBAT_STYLES: CombatStyleDef[] = [
  { id: 'defensivo', name: 'Estilo Defensivo', summary: 'CA +2; +1 nos níveis 4, 8, 12 e 16.', implemented: true },
  { id: 'arremessador', name: 'Estilo do Arremessador', summary: 'Saca arma de arremesso como parte do ataque; dano +2 com elas (+1 nos níveis 4, 8, 12 e 16).', implemented: true },
  { id: 'duelista', name: 'Estilo do Duelista', summary: 'Uma arma em uma mão e a outra livre (sem escudo): acerto +1 (+1 nos níveis 8 e 16) e dano +2 (+1 nos níveis 4, 8, 12 e 16).', implemented: true },
  { id: 'interceptador', name: 'Estilo do Interceptador', summary: 'Reação: aliado no seu alcance recebe ataque → reduz o dano em 1d10 + mod. de Força (+1 dado nos níveis 4, 8, 12 e 16).', implemented: false },
  { id: 'protetor', name: 'Estilo do Protetor', summary: 'Reação: impõe desvantagem em ataque contra aliado a até 1,5 m; também concede vantagem no TR de aliado a até 1,5 m.', implemented: true },
  { id: 'distante', name: 'Estilo Distante', summary: 'Armas à distância: acerto +1 (+1 nos níveis 8 e 16) e dano +2 (+1 nos níveis 4, 8, 12 e 16).', implemented: true },
  { id: 'duplo', name: 'Estilo Duplo', summary: 'Duas armas: dano +1 (+1 nos níveis 4, 8, 12 e 16) em todos os ataques. (Atributo no dano da segunda arma: em breve.)', implemented: true },
  { id: 'massivo', name: 'Estilo Massivo', summary: 'Arma de duas mãos ou pesada: rerrola 1 e 2 nos dados de dano; dano +1 (+1 nos níveis 4, 8, 12 e 16).', implemented: true },
];

export const COMBAT_STYLE_LEVELS = [1, 6, 12] as const;
export const ADEPTO_COMBATE_TALENT_ID = 'tal-adepto-combate';

export function getCombatStyleDef(id: string | undefined | null): CombatStyleDef | undefined {
  if (!id) return undefined;
  return COMBAT_STYLES.find((s) => s.id === id || s.name === id);
}

export function isEspecialistaCombate(c: Pick<Character, 'specialization' | 'characterClass'>): boolean {
  return c.characterClass === 'Feiticeiro' && c.specialization === 'Especialista em Combate';
}

/** Quantos estilos a especialização concede no nível. */
export function getCombatStyleSlots(level: number): number {
  return COMBAT_STYLE_LEVELS.filter((l) => (level ?? 1) >= l).length;
}

/** Estilos escolhidos pela especialização (sem duplicatas, só IDs válidos, limitados aos slots). */
export function getSpecCombatStyles(c: Character): CombatStyleId[] {
  if (!isEspecialistaCombate(c)) return [];
  const valid = Array.from(new Set((c.combatStyles ?? []).filter((id) => !!getCombatStyleDef(id))));
  return valid.slice(0, getCombatStyleSlots(c.level ?? 1)) as CombatStyleId[];
}

/** Estilo concedido pelo talento Adepto de Combate (se houver). */
export function getAdeptoCombatStyle(c: Character): CombatStyleId | undefined {
  const t = (c.chosenTalents ?? []).find((x) => x.id === ADEPTO_COMBATE_TALENT_ID);
  return getCombatStyleDef(t?.choices?.combatStyle)?.id;
}

/** Todos os estilos ativos (especialização + talento), sem repetir. */
export function getActiveCombatStyles(c: Character): CombatStyleId[] {
  const out = [...getSpecCombatStyles(c)];
  const ad = getAdeptoCombatStyle(c);
  if (ad && !out.includes(ad)) out.push(ad);
  return out;
}

export function hasCombatStyle(c: Character, id: CombatStyleId): boolean {
  return getActiveCombatStyles(c).includes(id);
}

export function getPendingCombatStyleCount(c: Character): number {
  if (!isEspecialistaCombate(c)) return 0;
  return Math.max(0, getCombatStyleSlots(c.level ?? 1) - getSpecCombatStyles(c).length);
}

/** Estilos que ainda podem ser escolhidos (não repete os já ativos). */
export function getAvailableCombatStyles(c: Character): CombatStyleDef[] {
  const active = new Set(getActiveCombatStyles(c));
  return COMBAT_STYLES.filter((s) => !active.has(s.id));
}

export function chooseCombatStyle(
  c: Character,
  id: CombatStyleId,
): { ok: true; patch: Partial<Character> } | { ok: false; reason: string } {
  if (!isEspecialistaCombate(c)) return { ok: false, reason: 'Apenas Especialista em Combate.' };
  if (getPendingCombatStyleCount(c) <= 0) return { ok: false, reason: 'Nenhum estilo disponível para escolher agora.' };
  if (!getCombatStyleDef(id)) return { ok: false, reason: 'Estilo inválido.' };
  if (getActiveCombatStyles(c).includes(id)) return { ok: false, reason: 'Estilo já escolhido.' };
  return { ok: true, patch: { combatStyles: [...getSpecCombatStyles(c), id] } };
}

/** Degraus comuns "+1 nos níveis 4, 8, 12 e 16". */
export function styleStepBonus(level: number): number {
  return [4, 8, 12, 16].filter((l) => (level ?? 1) >= l).length;
}

// ===================== Estilo Defensivo =====================

export function getDefensivoCA(c: Character): number {
  if (!hasCombatStyle(c, 'defensivo')) return 0;
  return 2 + styleStepBonus(c.level ?? 1);
}

// ===================== Estilo do Duelista =====================

export interface DuelistaWeaponInfo {
  name: string;
  range: string;
  properties?: { kind: string }[];
}

/**
 * Duelista vale quando: arma corpo a corpo empunhada em UMA mão (sem duas mãos /
 * versátil em duas mãos), outra mão livre (sem segunda arma e sem escudo).
 */
export function duelistaApplies(c: Character, w: DuelistaWeaponInfo, twoHandedGrip = false): { ok: boolean; reason?: string } {
  if (!hasCombatStyle(c, 'duelista')) return { ok: false };
  if (w.range !== 'melee') return { ok: false, reason: 'só armas corpo a corpo' };
  if (twoHandedGrip || (w.properties ?? []).some((p) => p.kind === 'duas_maos')) return { ok: false, reason: 'arma em duas mãos' };
  if (c.equippedShieldId) return { ok: false, reason: 'escudo na outra mão' };
  const off = c.offHandWeaponName;
  if (off && off !== c.mainHandWeaponName) return { ok: false, reason: 'outra mão ocupada' };
  if (off && off === c.mainHandWeaponName) return { ok: false, reason: 'arma em duas mãos' };
  return { ok: true };
}

export function getDuelistaBonus(level: number): { hit: number; damage: number } {
  const lv = level ?? 1;
  return { hit: 1 + [8, 16].filter((l) => lv >= l).length, damage: 2 + styleStepBonus(lv) };
}

// ===================== Estilo Distante =====================

/** Vale para armas à distância (range 'ranged'); arremesso é do Arremessador. */
export function distanteApplies(c: Character, w: { range: string }): boolean {
  return hasCombatStyle(c, 'distante') && w.range === 'ranged';
}
/** Mesma escala do Duelista: acerto +1 (8,16), dano +2 (4,8,12,16). */
export const getDistanteBonus = (level: number) => getDuelistaBonus(level);

// ===================== Estilo do Arremessador =====================

/** Arma de arremesso: alcance 'thrown' ou propriedade Arremessável. */
export function isThrownWeapon(w: { range: string; properties?: { kind: string }[] }): boolean {
  return w.range === 'thrown' || (w.properties ?? []).some((p) => p.kind === 'arremessavel');
}
export function arremessadorApplies(c: Character, w: { range: string; properties?: { kind: string }[] }): boolean {
  return hasCombatStyle(c, 'arremessador') && isThrownWeapon(w);
}
export function getArremessadorDamage(level: number): number {
  return 2 + styleStepBonus(level ?? 1);
}

// ===================== Estilo Duplo =====================
// Parte pronta: +1 dano (+1 nos níveis 4, 8, 12 e 16) em todo ataque enquanto empunha duas armas.
// PENDENTE: somar atributo no dano do ataque com a segunda arma (ataque com a 2ª arma ainda não existe).

export function isDualWielding(c: Pick<Character, 'mainHandWeaponName' | 'offHandWeaponName'>): boolean {
  return !!c.mainHandWeaponName && !!c.offHandWeaponName && c.mainHandWeaponName !== c.offHandWeaponName;
}
export function duploApplies(c: Character): boolean {
  return hasCombatStyle(c, 'duplo') && isDualWielding(c);
}
export function getDuploDamage(level: number): number {
  return 1 + styleStepBonus(level ?? 1);
}

// ===================== Estilo Massivo =====================

/** Arma pesada, de duas mãos, ou empunhada com as duas mãos (versátil). */
export function massivoApplies(c: Character, w: { properties?: { kind: string }[] }, twoHandedGrip = false): boolean {
  if (!hasCombatStyle(c, 'massivo')) return false;
  const props = w.properties ?? [];
  return twoHandedGrip || props.some((p) => p.kind === 'pesada' || p.kind === 'duas_maos');
}
export function getMassivoDamage(level: number): number {
  return 1 + styleStepBonus(level ?? 1);
}
