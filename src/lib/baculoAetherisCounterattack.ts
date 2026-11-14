import { buildAttackContext, pickAttackAbility, rollAttack } from '@/lib/combatEngine';
import { computeTotalDefense } from '@/lib/defenseCalc';
import { findWeaponModelById } from '@/lib/weapons';
import { distanceBetweenChars } from '@/lib/weaponRange';
import { rollDiceCom } from '@/lib/dice';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useMapStore } from '@/stores/useMapStore';
import { useLogStore } from '@/stores/useLogStore';
import { BACULO_AETHERIS_ID, BACULO_AETHERIS_NAME, baculoAetherisEquipped } from '@/lib/baculoAetheris';
import type { BaculoAetherisCounterattack } from '@/lib/baculoAetherisState';
import { penalidadeGarrasTigre } from '@/lib/controlador/dezSombrasTigre';

export async function dispararContraRajadaBaculo(request: BaculoAetherisCounterattack): Promise<{ ok: boolean; reason?: string }> {
  const characters = useCharacterStore.getState().characters;
  const wielder = characters.find((character) => character.id === request.wielderId);
  const attacker = characters.find((character) => character.id === request.attackerId);
  if (!wielder || !attacker || !baculoAetherisEquipped(wielder)) return { ok: false, reason: 'Báculo Aetheris não está mais empunhado.' };
  const map = useMapStore.getState();
  const distance = distanceBetweenChars(wielder.id, attacker.id, map.entities, map.gridConfig, { casterProfileId: wielder.profileId, targetProfileId: attacker.profileId });
  if (distance === null || distance > 18.05) return { ok: false, reason: 'Atacante fora do alcance de 18 m.' };
  const baseWeapon = findWeaponModelById(BACULO_AETHERIS_ID);
  if (!baseWeapon) return { ok: false, reason: 'Báculo Aetheris não encontrado no catálogo.' };
  const weapon = { ...baseWeapon, range: 'ranged' as const };
  const result = await rollAttack(buildAttackContext({
    attacker: wielder,
    weapon,
    targetId: attacker.id,
    alcanceM: 18,
    targetDefense: Math.max(0, computeTotalDefense(attacker, {}, 'ranged') -
      penalidadeGarrasTigre(characters, attacker.id, useCombatStore.getState().combatId ?? undefined)),
    situation: { twoHanded: true, preferredAbility: pickAttackAbility(wielder, weapon) },
    trainedRanges: [...(wielder.meleeTrained ? (['melee'] as const) : []), ...(wielder.rangedTrained ? (['ranged', 'thrown'] as const) : [])],
  }));
  if (result.cancelled) return { ok: false, reason: 'Contra-Rajada interrompida.' };
  if (!result.hit) {
    useLogStore.getState().addLog('combat', 'Contra-Rajada errou contra ' + attacker.name + '.');
    return { ok: true };
  }
  const rolled = await rollDiceCom(wielder.id, '5d8', { label: 'Contra-Rajada' });
  await useCharacterStore.getState().applyDamage(attacker.id, rolled.total, 'DS', { attackerId: wielder.id, source: 'arma', isMelee: false });
  useLogStore.getState().addLog('combat', 'Contra-Rajada: 5d8 Sônico = ' + rolled.total + ' contra ' + attacker.name + '.');
  return { ok: true };
}
