import type { TestRequest } from '@/stores/useTestRequestStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { useLogStore } from '@/stores/useLogStore';

/** Mestre finaliza o TR da Aura Macabra e aplica condição sem duplicá-la. */
export function resolveAuraTurnTest(request: TestRequest): boolean {
  const resolution = request.auraResolution;
  if (!resolution || !request.result || request.dc == null || request.resolutionApplied) return false;
  const characters = useCharacterStore.getState().characters;
  const target = characters.find((c) => c.id === request.charId);
  const owner = characters.find((c) => c.id === resolution.ownerId);
  if (!target || !owner) return false;

  const passed = request.result.total >= request.dc;
  const existing = (target.activeConditions ?? []).some((c) => c.conditionId === resolution.conditionId);
  if (!passed && !existing) {
    useCharacterStore.getState().addCondition(target.id, {
      id: `aura-macabra:${owner.id}:${target.id}`,
      conditionId: resolution.conditionId,
      name: resolution.conditionName,
      icon: resolution.conditionIcon,
      remainingTurns: -1,
      remainingRounds: -1,
      durationMode: 'ate_passar_tr',
      endCD: request.dc,
      endTrType: 'vontade',
      sourceCharId: owner.id,
      sourceCharName: owner.name,
    });
  }

  useLogStore.getState().addLog(
    'combat',
    passed
      ? `🛡️ ${target.name} resiste à Aura Macabra de ${owner.name} (${request.result.total} vs CD ${request.dc}).`
      : existing
        ? `✨ ${target.name} falha contra a Aura Macabra de ${owner.name}, mas ${resolution.conditionName} já está ativa.`
        : `✨ ${target.name} falha contra a Aura Macabra de ${owner.name} (${request.result.total} vs CD ${request.dc}) e fica ${resolution.conditionName}.`,
  );
  useTestRequestStore.getState().markResolutionApplied(request.id);
  return true;
}
