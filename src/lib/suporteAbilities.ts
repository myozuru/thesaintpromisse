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
import type { Attribute, Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';

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

/**
 * Apoiar (Ação Bônus — Suporte em Combate): o alvo ganha VANTAGEM no próximo
 * teste de perícia que fizer para a tarefa apoiada, desde que role antes do
 * início do próximo turno de quem apoiou.
 *
 * Implementação: concede um modificador de vantagem `next_skill` (1 uso) no
 * alvo, marcado com `grantedBy = supporter.id`. O consumo acontece
 * automaticamente na próxima rolagem de perícia do alvo (consumeAdvantageFor)
 * e a expiração ocorre no início do turno do apoiador (expireGrantedBy,
 * chamado em useCombatStore.nextTurn).
 */
export async function applyApoiar(
  supporter: Pick<Character, 'id' | 'name'>,
  target: Pick<Character, 'id' | 'name'>,
): Promise<void> {
  const { grantAdvantage } = await import('@/lib/omni/rollAdvantage');
  grantAdvantage(target.id, 'advantage', 'next_skill', {
    expires: 'use',
    source: `Apoiar (${supporter.name})`,
    grantedBy: supporter.id,
  });
}

/** Presença Inspiradora (Nv 3): PE extra máximo = metade do mod de Presença (fixo). */
export function getPresencaInspiradoraMaxExtra(c: Character): number {
  return Math.max(0, Math.floor(mod(c, 'Presença') / 2));
}

/**
 * Presença Inspiradora (Ação — Suporte Nv 3): paga 2 PE (+ até `extra` PE
 * adicionais) e concede +(1 + extra) em TODAS as rolagens de perícia de
 * todos os aliados (exceto o próprio Suporte) durante a cena.
 * O bônus é armazenado em `inspiracaoBonus` de cada aliado e zerado no
 * reset de cena/descanso do store.
 */
export function applyPresencaInspiradora(
  supporter: Character,
  allies: Character[],
  extraPE: number,
): { ok: boolean; reason?: string; bonus: number; totalCost: number } {
  const maxExtra = getPresencaInspiradoraMaxExtra(supporter);
  const extra = Math.max(0, Math.min(extraPE, maxExtra));
  const totalCost = 2 + extra;
  if ((supporter.peCurrent ?? 0) < totalCost) {
    return { ok: false, reason: `PE insuficiente (precisa de ${totalCost}, tem ${supporter.peCurrent ?? 0}).`, bonus: 0, totalCost };
  }
  const bonus = 1 + extra;
  const store = useCharacterStore.getState();
  store.updateCharacter(supporter.id, { peCurrent: (supporter.peCurrent ?? 0) - totalCost });
  for (const ally of allies) {
    if (ally.id === supporter.id) continue;
    store.updateCharacter(ally.id, { inspiracaoBonus: bonus });
  }
  return { ok: true, bonus, totalCost };
}
