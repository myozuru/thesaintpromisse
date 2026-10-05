import { ALL_CONDITIONS } from '@/types';
import { charsDistanceMeters } from '@/lib/touchRange';
import { getEnemyTurnAuraPrompts } from '@/lib/auraEffects';
import { calcCursedDC } from '@/lib/fahCombatHooks';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useMapStore } from '@/stores/useMapStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { useLogStore } from '@/stores/useLogStore';

/** Gera o teste de Vontade da Aura Macabra para inimigos realmente dentro do raio. */
export function enqueueAuraMacabraTestsForEnemy(enemyId: string): number {
  const characters = useCharacterStore.getState().characters;
  const enemy = characters.find((c) => c.id === enemyId);
  if (!enemy || (enemy.category !== 'INIMIGO' && enemy.category !== 'NPC')) return 0;

  const { entities, gridConfig } = useMapStore.getState();
  const requests = useTestRequestStore.getState();
  const combat = useCombatStore.getState();
  const log = useLogStore.getState().addLog;
  let count = 0;

  for (const owner of characters.filter((c) => c.category === 'PLAYER')) {
    const aura = getEnemyTurnAuraPrompts(owner).find((p) => p.auraId === 'aura_macabra');
    if (!aura) continue;
    const distance = charsDistanceMeters(owner.id, enemy.id, entities as never, gridConfig as never, {
      casterProfileId: owner.profileId,
      targetProfileId: enemy.profileId,
    });
    if (distance === null) {
      log('system', `⚠ Aura Macabra de ${owner.name}: não foi possível medir a distância até ${enemy.name}; confira os tokens no mapa.`);
      continue;
    }
    if (distance > aura.radiusM + 0.05) continue;

    const conditionId = (owner.cursedAptitudes?.AU ?? 0) >= 3 ? 'amedrontado' : 'abalado';
    const condition = ALL_CONDITIONS.find((c) => c.id === conditionId)!;
    const sourceTag = `aura-macabra:${combat.combatId ?? 'sem-combate'}:${combat.round}:${combat.currentTurnIndex}:${owner.id}:${enemy.id}`;
    if (requests.requests.some((r) => r.sourceTag === sourceTag)) continue;

    requests.enqueue({
      charId: enemy.id,
      charName: enemy.name,
      kind: 'save',
      testName: 'Vontade',
      dc: calcCursedDC(owner),
      note: `Aura Macabra de ${owner.name} — TR para evitar ${condition.name}.`,
      sourceTag,
      auraResolution: {
        type: 'enemy_turn_aura',
        ownerId: owner.id,
        auraId: 'aura_macabra',
        conditionId: condition.id,
        conditionName: condition.name,
        conditionIcon: condition.icon,
      },
    });
    log('combat', `✨ Aura Macabra de ${owner.name}: ${enemy.name} está a ${distance.toFixed(1).replace('.', ',')} m. TR de Vontade vs CD ${calcCursedDC(owner)} solicitado.`);
    count++;
  }
  return count;
}

