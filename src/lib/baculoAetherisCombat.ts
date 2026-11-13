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
export { expireBaculoAetherisConditionsForTurnStart } from '@/lib/baculoAetherisTurn';
type AetherisResolutionInput = Omit<NonNullable<TestRequest['aetherisResolution']>, 'sourceCharId' | 'sourceCharName' | 'sourceEntityId' | 'sourceName'>;
const rupturasEmResolucao = new Set<string>();

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
  await aplicarDanoBaculoRolado(sourceId, targetId, rolled.total, damageType, formula, sourceName);
  return rolled.total;
}

async function aplicarDanoBaculoRolado(sourceId: string, targetId: string, total: number, damageType: DamageType, formula: string, sourceName: string): Promise<void> {
  await useCharacterStore.getState().applyDamage(targetId, total, damageType, { attackerId: sourceId, source: 'arma', isMelee: true });
  useLogStore.getState().addLog('combat', `💥 ${sourceName}: ${formula} Sônico = ${total} de dano.`);
}

function empurrarAlvo(sourceId: string, targetId: string, metros: number, sourceName: string): boolean {
  const map = useMapStore.getState();
  const sourceToken = Object.values(map.entities).find((entity) => entity.characterId === sourceId && (entity.layer ?? 'tokens') === 'tokens');
  const targetToken = Object.values(map.entities).find((entity) => entity.characterId === targetId && (entity.layer ?? 'tokens') === 'tokens');
  if (!sourceToken || !targetToken) {
    useLogStore.getState().addLog('combat', `⚠ ${sourceName}: empurrão não aplicado porque falta um token no mapa.`);
    return false;
  }
  const result = aplicarMovimentoAtivo(sourceId, targetId, { indice: 0, tipo: 'empurrar', sujeito: 'alvo', metros });
  const aplicado = /empurrad/i.test(result);
  if (!aplicado) useLogStore.getState().addLog('combat', `⚠ ${sourceName}: ${result}.`);
  else useLogStore.getState().addLog('combat', `↗ ${sourceName}: alvo empurrado ${metros} m.`);
  return aplicado;
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
    const empurraoAplicado = empurrarAlvo(attackerId, targetId, 3, 'Rajada Sônica');
    useLogStore.getState().addLog('combat', `+3d8 Sônico aplicado${empurraoAplicado ? ' com empurrão de 3 m.' : '; empurrão não aplicado.'}`);
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
  const useKey = `${sourceId}:${weaponInstanceId || BACULO_AETHERIS_ID}:ruptura`;
  if (rupturasEmResolucao.has(useKey)) return { ok: false, reason: 'Ruptura do Firmamento já está sendo resolvida.' };
  const inicial = useCharacterStore.getState().characters.find((character) => character.id === sourceId);
  if (!inicial || !useCharacterStore.getState().characters.some((character) => character.id === targetId)) {
    return { ok: false, reason: 'Ficha do portador ou do alvo não encontrada.' };
  }
  const bloqueioInicial = motivoBloqueioRupturaBaculo(inicial, weaponInstanceId);
  if (bloqueioInicial) {
    if (bloqueioInicial === 'Sem Reação disponível nesta rodada') useLogStore.getState().addLog('combat', 'Ruptura do Firmamento não disparou: Reação indisponível');
    return { ok: false, reason: bloqueioInicial };
  }

  const combateNoInicio = useCombatStore.getState();
  rupturasEmResolucao.add(useKey);
  try {
    let rolled: Awaited<ReturnType<typeof rollDiceCom>>;
    try {
      // A rolagem não altera o combate; resolvê-la antes do débito preserva
      // PE e Reação se o serviço de dados falhar.
      rolled = await rollDiceCom(sourceId, '10d10', { label: 'Ruptura do Firmamento' });
    } catch (error) {
      const detalhe = error instanceof Error ? ` ${error.message}` : '';
      const reason = 'Ruptura não iniciada: a rolagem falhou; PE e Reação foram preservados.';
      useLogStore.getState().addLog('combat', `⛔ ${reason}${detalhe}`);
      return { ok: false, reason };
    }
    if (!Number.isFinite(rolled.total)) return { ok: false, reason: 'Ruptura não iniciada: resultado de dano inválido; PE e Reação foram preservados.' };

    const store = useCharacterStore.getState();
    const source = store.characters.find((character) => character.id === sourceId);
    const target = store.characters.find((character) => character.id === targetId);
    if (!source || !target) return { ok: false, reason: 'Portador ou alvo removido durante a rolagem; PE e Reação foram preservados.' };
    const combateAtual = useCombatStore.getState();
    if (combateAtual.combatId !== combateNoInicio.combatId || combateAtual.round !== combateNoInicio.round) {
      return { ok: false, reason: 'O combate mudou durante a rolagem; PE e Reação foram preservados.' };
    }
    const bloqueioAtual = motivoBloqueioRupturaBaculo(source, weaponInstanceId);
    if (bloqueioAtual) return { ok: false, reason: `${bloqueioAtual}; PE e Reação foram preservados.` };

    const gastoTemporario = Math.min(2, source.tempPE ?? 0);
    store.updateCharacter(sourceId, {
      tempPE: (source.tempPE ?? 0) - gastoTemporario,
      peCurrent: Math.max(0, (source.peCurrent ?? 0) - (2 - gastoTemporario)),
      reactionsCurrent: getReactionsAvailable(source) - 1,
    });
    useCombatStore.getState().markAetherisRoundUse(useKey);
    try {
      await aplicarDanoBaculoRolado(sourceId, targetId, rolled.total, 'DS', '10d10', 'Ruptura do Firmamento');
      const empurraoAplicado = empurrarAlvo(sourceId, targetId, 6, 'Ruptura do Firmamento');
      pedirTRBaculoAetheris(source, target, 'Ruptura do Firmamento', { conditionOnFailure: 'caido', sourceInstanceId: weaponInstanceId ?? undefined });
      useLogStore.getState().addLog('combat', `Ruptura do Firmamento: 10d10 Sônico${empurraoAplicado ? ', alvo empurrado 6 m' : '; empurrão não aplicado'}; TR de Fortitude para evitar Caído.`);
    } catch (error) {
      const detalhe = error instanceof Error ? ` ${error.message}` : '';
      const reason = 'resolução interrompida após o débito; confira dano e condições antes de repetir';
      useLogStore.getState().addLog('combat', `⛔ Ruptura do Firmamento: ${reason}.${detalhe}`);
      return { ok: false, reason };
    }
    return { ok: true };
  } finally {
    rupturasEmResolucao.delete(useKey);
  }
}

export async function resolverTRBaculoAetheris(request: TestRequest): Promise<void> {
  const effect = request.aetherisResolution;
  const result = request.result;
  if (!effect || !result) return;
  const passed = result.forced ? result.forced.kind === 'success' : result.d20 !== 1 && (request.dc == null || result.total >= request.dc);
  const target = useCharacterStore.getState().characters.find((character) => character.id === request.charId);
  if (!target) {
    useLogStore.getState().addLog('combat', `⚠️ Báculo Aetheris: o alvo ${request.charName} foi removido antes da resolução do TR; o efeito foi encerrado sem aplicar dano ou condição.`);
    return;
  }

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
      // A duração é vinculada ao próximo turno do portador, não ao turno do alvo.
      remainingTurns: -1,
      remainingRounds: -1,
      expiraNoInicioDoTurnoDe: effect.sourceCharId,
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
