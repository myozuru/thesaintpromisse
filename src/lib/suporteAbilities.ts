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

// ===== Testes de Resistência do Suporte =====

/** Nível em que o Suporte ganha o TR Mestre. */
export const TR_MESTRE_LEVEL = 9;

export type SuporteBaseTR = 'Astúcia' | 'Vontade';

/** TR treinado escolhido no Nv 1 (Características de Especialização). */
export function getSuporteBaseTR(c: Pick<Character, 'suporteBaseTR'>): SuporteBaseTR | null {
  return c.suporteBaseTR === 'Astúcia' || c.suporteBaseTR === 'Vontade' ? c.suporteBaseTR : null;
}

function upsertSavingThrow(list: Attribute[], name: string, patch: Partial<Attribute>): Attribute[] {
  const idx = list.findIndex((s) => s.name === name);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = { ...next[idx], ...patch };
    return next;
  }
  return [...list, { id: name.toLowerCase(), name, value: 10, ...patch }];
}

/**
 * Escolha do TR treinado do Suporte (Nv 1): Astúcia OU Vontade fica treinado.
 * Idempotente: re-escolher apenas move o treinamento (e a maestria, se o TR
 * Mestre já foi aplicado) para a nova escolha.
 */
export function applySuporteBaseTR(c: Character, choice: SuporteBaseTR): void {
  const other: SuporteBaseTR = choice === 'Astúcia' ? 'Vontade' : 'Astúcia';
  const hadMastery = (c.savingThrows ?? []).some((s) => s.name === getSuporteBaseTR(c) && s.mastery);
  let list = upsertSavingThrow(c.savingThrows ?? [], choice, { trained: true, mastery: hadMastery });
  list = upsertSavingThrow(list, other, { trained: hadMastery, mastery: false });
  useCharacterStore.getState().updateCharacter(c.id, { suporteBaseTR: choice, savingThrows: list });
}

/**
 * TR Mestre (Nv 9): o TR da especialização (o escolhido no Nv 1) ganha
 * MAESTRIA e o outro (Astúcia/Vontade) fica TREINADO. Idempotente.
 */
export function applyTRMestre(c: Character): { ok: boolean; reason?: string } {
  const base = getSuporteBaseTR(c);
  if (!base) return { ok: false, reason: 'Escolha primeiro o TR treinado do Nv 1 (Astúcia ou Vontade).' };
  if (c.level < TR_MESTRE_LEVEL) return { ok: false, reason: `Requer nível ${TR_MESTRE_LEVEL}.` };
  const other: SuporteBaseTR = base === 'Astúcia' ? 'Vontade' : 'Astúcia';
  let list = upsertSavingThrow(c.savingThrows ?? [], base, { trained: true, mastery: true });
  list = upsertSavingThrow(list, other, { trained: true, mastery: false });
  useCharacterStore.getState().updateCharacter(c.id, { savingThrows: list });
  return { ok: true };
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
