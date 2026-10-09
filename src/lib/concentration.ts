import type { ActiveConcentration, Character, Spell } from '@/types';

export function getActiveConcentrationCount(character: Pick<Character, 'activeConcentrations'>): number {
  return new Set(
    (character.activeConcentrations ?? [])
      .map((entry) => entry?.instanceId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  ).size;
}

export function concentrationLimit(character: Pick<Character, 'maxConcentrationSlots'>): number {
  const configured = character.maxConcentrationSlots ?? 1;
  return Number.isFinite(configured) ? Math.max(0, Math.floor(configured)) : 1;
}

export function canStartConcentration(
  character: Pick<Character, 'activeConcentrations' | 'maxConcentrationSlots'>,
  spell: Pick<Spell, 'requiresConcentration'>,
): boolean {
  if (!spell.requiresConcentration) return true;
  return getActiveConcentrationCount(character) < concentrationLimit(character);
}

export function createActiveConcentration(
  spell: Pick<Spell, 'id' | 'name'>,
  instanceId: string,
  targetIds: readonly string[],
  startedAt = Date.now(),
): ActiveConcentration {
  return {
    instanceId,
    spellId: spell.id,
    spellName: spell.name,
    targetIds: [...new Set(targetIds)],
    startedAt,
  };
}
