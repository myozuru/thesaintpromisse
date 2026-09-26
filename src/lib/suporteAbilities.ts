/**
 * ============================================================================
 *  SUPORTE — Habilidades base (funções puras)
 * ============================================================================
 *  Nv 1 · Suporte em Combate
 *   • Apoiar como Ação Bônus (mecânica própria de Apoiar — não é cura).
 *   • Cura de toque (Ação Bônus): dados por nível + mod do atributo-chave
 *     (Presença ou Sabedoria, o escolhido na ficha). Usos = mod do
 *     atributo-chave, por descanso curto ou longo.
 * ============================================================================
 */
import type { Character } from '@/types';

export function isSuporte(c: Pick<Character, 'specialization' | 'isGrimorioCreature'>): boolean {
  return c.specialization === 'Suporte' && !c.isGrimorioCreature;
}

function mod(c: Pick<Character, 'attributes'>, name: string): number {
  const v = (c.attributes ?? []).find((a) => a.name === name)?.value ?? 10;
  return Math.floor((v - 10) / 2);
}

/** Atributo-chave do Suporte: o escolhido (Presença | Sabedoria); fallback Presença. */
export function getSuporteKeyAttr(c: Pick<Character, 'keyAttribute'>): 'Presença' | 'Sabedoria' {
  return c.keyAttribute === 'Sabedoria' ? 'Sabedoria' : 'Presença';
}

export function getSuporteKeyMod(c: Pick<Character, 'attributes' | 'keyAttribute'>): number {
  return mod(c, getSuporteKeyAttr(c));
}

/** Dados da cura por nível: 2d6 → 2d12 (4) → 3d12 (8) → 6d8 (12) → 6d10 (16). */
export function getSuporteHealDice(level: number): { count: number; sides: number } {
  const lv = level | 0;
  if (lv >= 16) return { count: 6, sides: 10 };
  if (lv >= 12) return { count: 6, sides: 8 };
  if (lv >= 8) return { count: 3, sides: 12 };
  if (lv >= 4) return { count: 2, sides: 12 };
  return { count: 2, sides: 6 };
}

/** Usos da cura por descanso = mod do atributo-chave (mínimo 0). */
export function getSuporteHealMaxUses(c: Pick<Character, 'attributes' | 'keyAttribute'>): number {
  return Math.max(0, getSuporteKeyMod(c));
}

export function getSuporteHealUsesLeft(c: Character): number {
  return Math.max(0, getSuporteHealMaxUses(c) - (c.suporteHealUsed ?? 0));
}
