/**
 * Helper compartilhado para os testes de Corretude Semântica
 * das chaves Omni (lotes 1–6).
 *
 * Diferente dos testes de presença/responsividade, AQUI cada chave é
 * comparada com um VALOR ESPERADO calculado à mão a partir do estado.
 */
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { useCombatStore } from '@/stores/useCombatStore';
import { useOpportunityStore } from '@/stores/useOpportunityStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useMapStore } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import type { Character } from '@/types';

export function resetStores() {
  useCombatStore.setState({
    inCombat: false, round: 0, currentTurnIndex: 0,
    initiativeOrder: [], movementUsedByChar: {},
    turnTimerEnabled: false, turnDurationSec: 0,
    turnRemainingAtStart: 0, turnStartedAt: 0, turnPaused: false,
  } as never);
  useOpportunityStore.setState({ grants: {}, pending: null } as never);
  useMoneyStore.setState({
    currencies: [{ id: 'yen', name: 'Yen', symbol: '¥', isDefault: true }],
    wallets: [],
  } as never);
  useChronosStore.setState({
    hours: 0, minutes: 0, seconds: 0, day: 1, month: 1, year: 2025,
    isRunning: false, multiplier: 1,
  } as never);
  useCalendarStore.setState({ events: [] } as never);
  useInventoryStore.setState({ items: {} } as never);
  useMapStore.setState({ entities: {} } as never);
  useCharacterStore.setState({ characters: [] } as never);
}

export function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'hero',
    name: 'Hero',
    level: 1, trainingBonus: 1,
    hpCurrent: 10, hpMax: 10,
    peCurrent: 5, peMax: 5,
    ca: 10, movement: 9,
    category: 'PLAYER',
    attributes: [], skills: [], savingThrows: [],
    actionsCurrent: 1, bonusActionsCurrent: 1,
    reactionsCurrent: 1, reactionsMax: 1,
    ...overrides,
  } as unknown as Character;
}

/** Avalia uma chave `@USUARIO.<id>`, `@ALVO.<id>` ou `@<ID>` (escopo NENHUM). */
export function vEval(
  char: Character,
  scope: 'USUARIO' | 'ALVO' | 'NENHUM',
  id: string,
): number {
  const bag = montarVariaveisDoPersonagem(char, scope === 'NENHUM' ? 'USUARIO' : scope);
  const expr = scope === 'NENHUM' ? `@${id.toUpperCase()}` : `@${scope}.${id}`;
  return avaliarFormula(expr, bag).valor;
}
