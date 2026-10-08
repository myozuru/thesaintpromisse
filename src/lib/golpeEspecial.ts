/**
 * Especialista em Combate — Nível 4: Golpe Especial + Implemento Marcial.
 *
 * Golpe Especial: ao atacar (ou usar Arte que envolva ataque) o jogador monta
 * propriedades; paga o custo total em PE (mínimo 1) só depois das validações.
 * Regras puras aqui; a UI/integração fica no AttackPanel.
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { getTrainingBonusByLevel, getKeyAttrForSpec } from '@/lib/levelEngine';

export type GolpePropId =
  | 'amplo' | 'atroz' | 'impactante' | 'letal' | 'longo' | 'penetrante'
  | 'preciso' | 'sanguinario' | 'lento' | 'sacrificio' | 'desfocado';

export interface GolpePropDef {
  id: GolpePropId;
  name: string;
  cost: number;
  max: number;
  summary: string;
}

export const GOLPE_PROPS: GolpePropDef[] = [
  { id: 'amplo', name: 'Amplo', cost: 2, max: 1, summary: 'Atinge uma criatura a mais (no alcance; rolagem separada).' },
  { id: 'atroz', name: 'Atroz', cost: 1, max: 1, summary: 'No acerto, +1 dado de dano da arma.' },
  { id: 'impactante', name: 'Impactante', cost: 1, max: 1, summary: 'Empurra 1,5 m a cada 15 de dano. Fortitude reduz à metade.' },
  { id: 'letal', name: 'Letal', cost: 2, max: 1, summary: 'Margem de crítico −1.' },
  { id: 'longo', name: 'Longo', cost: 1, max: 1, summary: '+1,5 m corpo a corpo / +9 m à distância.' },
  { id: 'penetrante', name: 'Penetrante', cost: 2, max: 1, summary: 'Ignora RD igual a metade do nível.' },
  { id: 'preciso', name: 'Preciso', cost: 1, max: 1, summary: 'Vantagem no ataque. 2 PE após o 1º uso no turno.' },
  { id: 'sanguinario', name: 'Sanguinário', cost: 2, max: 2, summary: 'Sangramento leve (2×: médio), CD de Especialização.' },
  { id: 'lento', name: 'Lento', cost: -2, max: 1, summary: 'Ação completa (gasta o turno inteiro).' },
  { id: 'sacrificio', name: 'Sacrifício', cost: -1, max: 1, summary: 'Você recebe 15 de dano ao atacar.' },
  { id: 'desfocado', name: 'Desfocado', cost: -1, max: 3, summary: '−4 no acerto por vez (até 3×).' },
];

export type GolpeSelecao = Partial<Record<GolpePropId, number>>;

export function especialistaLevel(c: Pick<Character, 'level'>): number {
  return c.level ?? 1;
}

export function hasGolpeEspecial(c: Character): boolean {
  return isEspecialistaCombate(c) && especialistaLevel(c) >= 4;
}

/** Implemento Marcial: +2 (nv 4), +3 (nv 8), +4 (nv 16). */
export function implementoMarcialBonus(c: Character): number {
  if (!isEspecialistaCombate(c)) return 0;
  const lv = especialistaLevel(c);
  if (lv < 4) return 0;
  return 2 + (lv >= 8 ? 1 : 0) + (lv >= 16 ? 1 : 0);
}

/* ── Preciso: contagem por turno próprio ─────────────────────────────────── */
const precisoUsos = new Map<string, { turnKey: string; count: number }>();

export function precisoUsesThisTurn(charId: string, turnKey: string): number {
  const r = precisoUsos.get(charId);
  return r && r.turnKey === turnKey ? r.count : 0;
}
export function registerPrecisoUse(charId: string, turnKey: string): void {
  precisoUsos.set(charId, { turnKey, count: precisoUsesThisTurn(charId, turnKey) + 1 });
}
export function resetPrecisoUses(): void { precisoUsos.clear(); }

export function isGolpeAtivo(sel: GolpeSelecao): boolean {
  return Object.values(sel).some((n) => (n ?? 0) > 0);
}

/** Custo bruto (pode ser < 1) e custo final (mínimo 1). */
export function custoGolpeEspecial(sel: GolpeSelecao, precisoJaUsado = 0): { bruto: number; total: number } {
  let bruto = 0;
  for (const p of GOLPE_PROPS) {
    const n = Math.min(p.max, Math.max(0, sel[p.id] ?? 0));
    if (!n) continue;
    const unit = p.id === 'preciso' && precisoJaUsado > 0 ? 2 : p.cost;
    bruto += unit * n;
  }
  return { bruto, total: isGolpeAtivo(sel) ? Math.max(1, bruto) : 0 };
}

export function longoBonusMeters(sel: GolpeSelecao, range: 'melee' | 'ranged' | 'thrown' | string): number {
  if (!sel.longo) return 0;
  return range === 'melee' ? 1.5 : 9;
}

export function penetranteRD(c: Character): number {
  return Math.floor((c.level ?? 1) / 2);
}

/** Metros empurrados: 1,5 m a cada 15 de dano; Fortitude bem-sucedida → metade (arredonda p/ baixo em casas). */
export function impactanteMeters(damage: number, fortitudePassou: boolean): number {
  let casas = Math.floor(Math.max(0, damage) / 15);
  if (fortitudePassou) casas = Math.floor(casas / 2);
  return casas * 1.5;
}

/** CD de Especialização (base + atributo-chave + ½ nível + treinamento + Implemento). */
export function specDCFor(c: Character): number {
  const key = c.specialization === 'Controlador'
    ? getKeyAttrForSpec('Controlador', c.keyAttribute)
    : c.keyAttribute;
  const a = (c.attributes ?? []).find((x) => x.name === key);
  const mod = a ? Math.floor(((a.value ?? 10) - 10) / 2) : 0;
  const lv = c.level ?? 1;
  return (c.baseDC || 10) + mod + Math.floor(lv / 2) + getTrainingBonusByLevel(lv) + implementoMarcialBonus(c);
}
