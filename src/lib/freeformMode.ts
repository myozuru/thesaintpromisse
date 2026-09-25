/**
 * Helper para decidir se um personagem específico está em "Modo Livre".
 *
 * Mantém compatibilidade com o flag global (`useCombatStore.freeformMode`)
 * mas permite override por ficha via `Character.freeformOverride`:
 *   - 'on'  → força modo livre (sem cap de movimento / hotbar oculta)
 *   - 'off' → força modo normal mesmo quando o global está ligado
 *   - undef → segue o global
 */
import type { Character } from '@/types';

export function isFreeformFor(character: Character | null | undefined, globalFreeform: boolean): boolean {
  const ov = character?.freeformOverride;
  if (ov === 'on') return true;
  if (ov === 'off') return false;
  return !!globalFreeform;
}
