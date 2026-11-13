import type { Character, DamageType } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useLogStore } from '@/stores/useLogStore';
import { useTestRequestStore, type TestRequest } from '@/stores/useTestRequestStore';
import { useMapStore } from '@/stores/useMapStore';
import { rollDiceCom } from '@/lib/dice';
import { specDCFor } from '@/lib/golpeEspecial';
import { aplicarMovimentoAtivo } from '@/lib/omni/movimentosAtivos';
import { aetherisRoundUseReady, BACULO_AETHERIS_ID, BACULO_AETHERIS_SEM_REACOES, BACULO_AETHERIS_SUSPENSO } from '@/lib/baculoAetheris';
import { getReactionsAvailable } from '@/lib/reactionBudget';

export type AetherisConditionOnFailure = 'sem-reacoes' | 'suspenso' | 'caido';
export { useBaculoAetherisCounterattackStore } from '@/lib/baculoAetherisState';
export type { BaculoAetherisCounterattack } from '@/lib/baculoAetherisState';
type AetherisResolutionInput = Omit<NonNullable<TestRequest['aetherisResolution']>, 'sourceCharId' | 'sourceCharName' | 'sourceEntityId' | 'sourceName'>;

export function pedirTRBaculoAetheris(
  source: Character,
  target: Character,
  sourceName: string,
  resolution: AetherisResolutionInput,
): string {
  const dc = specDCFor(source);
  return useTestRequestStore.getState().enqueue({
    charId: target.id,
    charName: target.name,
    targetProfileId: target.profileId,
    kind: 'save',
    testName: 'Fortitude',
    dc,
    note: `TR de Fortitude (CD ${dc}) contra ${sourceName}.`,
    originId: source.id,
    sourceTag: `baculo-aetheris:${source.id}:${target.id}:${Date.now()}`,
    aetherisResolution: { ...resolution, sourceCharId: source.id, sourceCharName: source.name, sourceName, sourceEntityId: BACULO_AETHERIS_ID },
  });
}

async function aplicarDanoBaculo(sourceId: string, targetId: string, formula: string, damageType: DamageType, sourceName: string): Promise<number> {
  const rolled = await rollDiceCom(sourceId, formula, { label: sourceName });
  await useCharacterStore.getState().applyDamage(targetId, rolled.total, damageType, { attackerId: sourceId, source: 'arma', isMelee: true });
  useLogStore.getState().addLog('combat', `💥 ${sourceName}: ${formula} Sônico = ${rolled.total} de dano.`);
  return rolled.total;
}

function empurrarAlvo(sourceId: string, targetId: string, metros: number, sourceName: string): void {
  const map = useMapStore.getState();
  const sourceToken = Object.values(map.entities).find((entity) => entity.characterId === sourceId && (entity.layer ?? 'tokens') === 'tokens');
  const targetToken = Object.values(map.entities).find((entity) => entity.characterId === targetId && (entity.layer ?? 'tokens') === 'tokens');
  if (!sourceToken || !targetToken) {
    useLogStore.getState().addLog('combat', `⚠ ${sourceName}: empurrão não aplicado porque falta um token no mapa.`);
    return;
  }
  const result = aplicarMovimentoAtivo(sourceId, targetId, { indice: 0, tipo: 'empurrar', sujeito: 'alvo', metros });
  if (!/empurrad/i.test(result)) useLogStore.getState().addLog('combat', `⚠ ${sourceName}: ${result}.`);
  else useLogStore.getState().addLog('combat', `↗ ${sourceName}: alvo empurrado ${metros} m.`);
}

/** Primeiro acerto do báculo na rodada: dano sônico e empurrão. Críticos também abrem Julgamento. */
export async function resolverAcertoBaculoAetheris(
  attackerId: string,
  targetId: string,
  weaponInstanceId: string | null | undefined,
  critical: boolean,
): Promise<{ julgamento: boolean; rupturaPodeSerOferecida: boolean }> {
  const chars = useCharacterStore.getState().characters;
  const attacker = chars.find((character) => character.id === attackerId);
  const target = chars.find((character) => character.id === targetId);
  if (!attacker || !target) return { julgamento: false, rupturaPodeSerOferecida: false };

  const combat = useCombatStore.getState();
  const useKey = `${attackerId}:${weaponInstanceId || BACULO_AETHERIS_ID}:rajada`;
  const record = combat.aetherisRoundUse[useKey];
  if (aetherisRoundUseReady(record, combat.combatId ?? null, combat.round)) {
    useCombatStore.getState().markAetherisRoundUse(useKey);
    await aplicarDanoBaculo(attackerId, targetId, '3d8', 'DS', 'Rajada Sônica');
    empurrarAlvo(attackerId, targetId, 3, 'Rajada Sônica');
    useLogStore.getState().addLog('combat', '+3d8 Sônico e empurrão de 3 m aplicados.');
  } else {
    useLogStore.getState().addLog('combat', 'Rajada Sônica já utilizada nesta rodada.');
  }

  if (!critical) return { julgamento: false, rupturaPodeSerOferecida: false };
  await aplicarDanoBaculo(attackerId, targetId, '5d8', 'DS', 'Julgamento dos Ventos');
  pedirTRBaculoAetheris(attacker, target, 'Julgamento dos Ventos', {
    conditionOnFailure: 'sem-reacoes',
    sourceInstanceId: weaponInstanceId ?? undefined,
  });
  useLogStore.getState().addLog('combat', `Julgamento dos Ventos: TR de Fortitude (CD ${specDCFor(attacker)}) contra Sem Reações.`);
  const ruptureKey = attackerId + ':' + (weaponInstanceId || BACULO_AETHERIS_ID) + ':ruptura';
  const ruptureReady = aetherisRoundUseReady(combat.aetherisRoundUse[ruptureKey], combat.combatId ?? null, combat.round);
  const reactions = getReactionsAvailable(attacker);
  if (ruptureReady && reactions <= 0) useLogStore.getState().addLog('combat', 'Ruptura do Firmamento não disparou: Reação indisponível');
  return { julgamento: true, rupturaPodeSerOferecida: ruptureReady && reactions > 0 };
}

export function motivoBloqueioRupturaBaculo(source: Character, weaponInstanceId?: string | null): string | null {
  const combat = useCombatStore.getState();
  const key = source.id + ':' + (weaponInstanceId || BACULO_AETHERIS_ID) + ':ruptura';
  if (!aetherisRoundUseReady(combat.aetherisRoundUse[key], combat.combatId ?? null, combat.round)) return 'Ruptura já foi usada nesta rodada';
  if (getReactionsAvailable(source) <= 0) return 'Sem Reação disponível nesta rodada';
  const pe = (source.peCurrent ?? 0) + (source.tempPE ?? 0);
  if (pe < 2) return 'PE insuficiente: requer 2, você possui ' + pe;
  return null;
}

export async function ativarRupturaBaculoAetheris(sourceId: string, targetId: string, weaponInstanceId?: string | null): Promise<{ ok: boolean; reason?: string }> {
  const store = useCharacterStore.getState();
  const source = store.characters.find((character) => character.id === sourceId);
  const target = store.characters.find((character) => character.id === targetId);
  if (!source || !target) return { ok: false, reason: 'Ficha do portador ou do alvo não encontrada.' };
  const reason = motivoBloqueioRupturaBaculo(source, weaponInstanceId);
  if (reason) {
    if (reason === 'Sem Reação disponível nesta rodada') useLogStore.getState().addLog('combat', 'Ruptura do Firmamento não disparou: Reação indisponível');
    return { ok: false, reason };
  }
  const gastoTemporario = Math.min(2, source.tempPE ?? 0);
  store.updateCharacter(sourceId, {
    tempPE: (source.tempPE ?? 0) - gastoTemporario,
    peCurrent: Math.max(0, (source.peCurrent ?? 0) - (2 - gastoTemporario)),
    reactionsCurrent: getReactionsAvailable(source) - 1,
  });
  const combat = useCombatStore.getState();
  useCombatStore.getState().markAetherisRoundUse(sourceId + ':' + (weaponInstanceId || BACULO_AETHERIS_ID) + ':ruptura');
  await aplicarDanoBaculo(sourceId, targetId, '10d10', 'DS', 'Ruptura do Firmamento');
  empurrarAlvo(sourceId, targetId, 6, 'Ruptura do Firmamento');
  pedirTRBaculoAetheris(source, target, 'Ruptura do Firmamento', { conditionOnFailure: 'caido', sourceInstanceId: weaponInstanceId ?? undefined });
  useLogStore.getState().addLog('combat', 'Ruptura do Firmamento: 10d10 Sônico, alvo empurrado 6 m; TR de Fortitude para evitar Caído.');
  return { ok: true };
}

export async function resolverTRBaculoAetheris(request: TestRequest): Promise<void> {
  const effect = request.aetherisResolution;
  const result = request.result;
  if (!effect || !result) return;
  const passed = result.forced ? result.forced.kind === 'success' : result.d20 !== 1 && (request.dc == null || result.total >= request.dc);
  const target = useCharacterStore.getState().characters.find((character) => character.id === request.charId);
  if (!target) throw new Error('Ficha do alvo não encontrada para resolver o efeito do Báculo Aetheris.');

  if (effect.damageFormula) {
    const rolled = await rollDiceCom(effect.sourceCharId, effect.damageFormula, { label: effect.sourceName ?? 'Báculo Aetheris' });
    const damage = passed && effect.halfOnSuccess ? Math.floor(rolled.total / 2) : rolled.total;
    if (damage > 0) {
      await useCharacterStore.getState().applyDamage(target.id, damage, effect.damageType, { attackerId: effect.sourceCharId, source: 'arma' });
    }
    useLogStore.getState().addLog('combat', `💥 ${effect.sourceName ?? 'Báculo Aetheris'}: ${effect.damageFormula} ${effect.damageType ?? ''} = ${rolled.total}${passed && effect.halfOnSuccess ? `; ${damage} após sucesso no TR` : ''}.`);
  }

  if (!passed && effect.pushMetersOnFailure && effect.sourceCharId) {
    empurrarAlvo(effect.sourceCharId, target.id, effect.pushMetersOnFailure, effect.sourceName ?? 'Báculo Aetheris');
  }

  if (!passed && effect.conditionOnFailure) {
    const condition = effect.conditionOnFailure;
    const ids: Record<AetherisConditionOnFailure, string> = {
      'sem-reacoes': BACULO_AETHERIS_SEM_REACOES,
      suspenso: BACULO_AETHERIS_SUSPENSO,
      caido: 'caido',
    };
    const names: Record<AetherisConditionOnFailure, { name: string; icon: string }> = {
      'sem-reacoes': { name: 'Sem Reações', icon: '🚫' },
      suspenso: { name: 'Suspenso • 4,5 m', icon: '🟣' },
      caido: { name: 'Caído', icon: '🔻' },
    };
    const conditionId = `baculo-aetheris:${condition}:${effect.sourceCharId}:${target.id}`;
    useCharacterStore.getState().addCondition(target.id, {
      id: conditionId,
      conditionId: ids[condition],
      name: names[condition].name,
      icon: names[condition].icon,
      remainingTurns: -1,
      remainingRounds: -1,
      sourceCharId: effect.sourceCharId,
      sourceCharName: effect.sourceCharName,
      sourceEntityId: BACULO_AETHERIS_ID,
      sourceInstanceId: effect.sourceInstanceId,
    });
    if (condition === 'suspenso' && useCharacterStore.getState().characters.find((character) => character.id === target.id)?.activeConditions.some((entry) => entry.id === conditionId)) {
      for (const entity of Object.values(useMapStore.getState().entities).filter((candidate) => candidate.characterId === target.id)) {
        useMapStore.getState().updateEntity(entity.id, { altitudeM: 4.5, altitudeLabel: 'Suspenso' });
      }
    }
  }

  useLogStore.getState().addLog('combat', `${request.charName} ${passed ? 'passou' : 'falhou'} no TR de Fortitude (CD ${request.dc ?? '—'})${!passed && effect.conditionOnFailure ? `; condição ${effect.conditionOnFailure === 'sem-reacoes' ? 'Sem Reações' : effect.conditionOnFailure === 'suspenso' ? 'Suspenso' : 'Caído'} aplicada` : ''}.`);
}

/** Expira os efeitos do báculo no início do próximo turno de quem o empunha. */
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
    if (expires.some((condition) => condition.conditionId === BACULO_AETHERIS_SUSPENSO)) {
      suspendedCount += 1;
      const stillSuspended = useCharacterStore.getState().characters.find((entry) => entry.id === character.id)
        ?.activeConditions.some((condition) => condition.conditionId === BACULO_AETHERIS_SUSPENSO);
      if (!stillSuspended) {
        for (const entity of Object.values(useMapStore.getState().entities).filter((candidate) => candidate.characterId === character.id)) {
          useMapStore.getState().updateEntity(entity.id, { altitudeM: 0, altitudeLabel: undefined });
        }
      }
    }
  }
  if (suspendedCount > 0) useLogStore.getState().addLog('combat', '🪶 Trono das Nuvens expirou: criaturas descem suavemente ao solo.');
}
