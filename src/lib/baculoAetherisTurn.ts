import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { useMapStore } from '@/stores/useMapStore';
import { BACULO_AETHERIS_ID, BACULO_AETHERIS_SEM_REACOES, BACULO_AETHERIS_SUSPENSO } from '@/lib/baculoAetheris';

/** Expira efeitos do Báculo no início do próximo turno do portador. */
export function expireBaculoAetherisConditionsForTurnStart(wielderId: string): void {
  const store = useCharacterStore.getState();
  let suspendedCount = 0;

  for (const character of store.characters) {
    const conditions = character.activeConditions ?? [];
    const expires = conditions.filter((condition) =>
      (condition.conditionId === BACULO_AETHERIS_SEM_REACOES || condition.conditionId === BACULO_AETHERIS_SUSPENSO)
      && condition.sourceCharId === wielderId
      && condition.sourceEntityId === BACULO_AETHERIS_ID,
    );
    if (expires.length === 0) continue;

    const expiredIds = new Set(expires.map((condition) => condition.id));
    store.updateCharacter(character.id, { activeConditions: conditions.filter((condition) => !expiredIds.has(condition.id)) });

    if (!expires.some((condition) => condition.conditionId === BACULO_AETHERIS_SUSPENSO)) continue;
    suspendedCount += 1;

    const updatedCharacter = useCharacterStore.getState().characters.find((entry) => entry.id === character.id);
    const stillSuspended = updatedCharacter?.activeConditions.some((condition) =>
      condition.conditionId === BACULO_AETHERIS_SUSPENSO || condition.conditionId === 'suspenso',
    );
    if (stillSuspended) continue;

    for (const entity of Object.values(useMapStore.getState().entities).filter((candidate) => candidate.characterId === character.id)) {
      // Só limpamos a altitude criada pelo Báculo. Uma altura editada depois,
      // sem este rótulo, pertence a outra fonte e deve ser preservada.
      if (entity.altitudeLabel !== 'Suspenso') continue;
      useMapStore.getState().updateEntity(entity.id, { altitudeM: 0, altitudeLabel: undefined });
    }
  }

  if (suspendedCount > 0) useLogStore.getState().addLog('combat', '🪶 Os efeitos de suspensão do Trono das Nuvens expiraram.');
}
