import type { Character } from '@/types';
import { ALL_CONDITIONS } from '@/types/conditions';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore, type Entity } from '@/stores/useMapStore';
import { useTestRequestStore, type TestRequest } from '@/stores/useTestRequestStore';
import { useLogStore } from '@/stores/useLogStore';
import { distanciaCircularMetros } from '@/lib/mapa/alcanceCircular';
import { GRAU_CONDICAO } from '@/lib/suporteNivel4';

export const CERVO_AURA_RAIO_M = 6;
export const CERVO_AURA_TR_BONUS = 3;
export const CERVO_AURA_CURA = 16;
export const CERVO_NEUTRALIZACAO_RAIO_M = 4.5;

export type NivelCondicaoCervo = 1 | 2 | 3 | 4;

export interface CondicaoInvocacaoCervo {
  selectionId: string;
  conditionId: string;
  name: string;
  icon: string;
  raw: unknown;
}

export function condicaoInvocacaoCervo(raw: unknown, index: number): CondicaoInvocacaoCervo | null {
  let conditionId: string | undefined;
  let selectionId: string | undefined;
  let name: string | undefined;
  let icon: string | undefined;
  if (typeof raw === 'string') {
    conditionId = raw;
    selectionId = `legada:${index}:${raw}`;
  } else if (raw && typeof raw === 'object') {
    const condition = raw as { id?: unknown; conditionId?: unknown; name?: unknown; icon?: unknown };
    conditionId = typeof condition.conditionId === 'string' ? condition.conditionId : undefined;
    if (!conditionId && typeof condition.id === 'string') conditionId = condition.id;
    selectionId = typeof condition.id === 'string' ? condition.id : `legada:${index}:${conditionId ?? ''}`;
    name = typeof condition.name === 'string' ? condition.name : undefined;
    icon = typeof condition.icon === 'string' ? condition.icon : undefined;
  }
  if (!conditionId) return null;
  const definition = ALL_CONDITIONS.find(condition => condition.id === conditionId);
  return {
    selectionId: selectionId ?? `legada:${index}:${conditionId}`,
    conditionId,
    name: name ?? definition?.name ?? conditionId,
    icon: icon ?? definition?.icon ?? '✨',
    raw,
  };
}

export function nivelCondicaoCervo(conditionId: string): NivelCondicaoCervo | null {
  switch (GRAU_CONDICAO[conditionId]) {
    case 'fraca': return 1;
    case 'media': return 2;
    case 'forte': return 3;
    case 'extrema': return 4;
    default: return null;
  }
}

export function mesmaEquipe(a: Character, b: Character): boolean {
  return (a.category === 'INIMIGO') === (b.category === 'INIMIGO');
}

export function tokenVisivel(token: Entity, layerVisible: Record<string, boolean>): boolean {
  return !token.hidden && !token.carriedBy && (token.layer ?? 'tokens') === 'tokens' &&
    layerVisible[token.layer ?? 'tokens'] !== false;
}

export function tokenEmRaioCircular(
  origem: Entity,
  alvo: Entity,
  grid: { dpi?: number; metersPerCell?: number },
  raioM: number,
): boolean {
  const distancia = distanciaCircularMetros(
    { x: origem.x + origem.w / 2, y: origem.y + origem.h / 2 },
    { x: alvo.x + alvo.w / 2, y: alvo.y + alvo.h / 2 },
    grid,
  );
  return distancia <= raioM + 0.05;
}

/** Retorna +3 somente se um TR estiver ligado a uma condição mental e um Cervo aliado ativo estiver a até 6 m. */
export function bonusAuraQuietudeNoTR(
  charId: string,
  conditionIds: string[] | undefined,
  snapshot?: {
    characters: Character[];
    entities: Record<string, Entity>;
    gridConfig: { dpi?: number; metersPerCell?: number };
    layerVisible: Record<string, boolean>;
  },
): number {
  if (!temCondicaoMental(conditionIds)) return 0;
  const characters = snapshot?.characters ?? useCharacterStore.getState().characters;
  const alvo = characters.find(character => character.id === charId);
  if (!alvo) return 0;
  const mapa = snapshot ?? useMapStore.getState();
  const tokensAlvo = Object.values(mapa.entities).filter(token => token.characterId === charId &&
    !token.invocationId && tokenVisivel(token, mapa.layerVisible));
  if (!tokensAlvo.length) return 0;

  for (const dono of characters) {
    if (!mesmaEquipe(dono, alvo)) continue;
    const cervos = (dono.invocacoesConhecidas ?? []).filter(modelo => modelo.subcategoria === 'dez-sombras:cervo-circular');
    for (const cervo of cervos) {
      const tokensCervo = Object.values(mapa.entities).filter(token => token.ownerCharId === dono.id &&
        token.invocationId === cervo.id && tokenVisivel(token, mapa.layerVisible) && (token.hp ?? 0) > 0 &&
        (!token.invocationState || token.invocationState === 'ativa'));
      for (const token of tokensCervo) {
        const instancia = (dono.instanciasInvocacao ?? []).find(item => item.id === token.invocationInstanceId);
        if (instancia && instancia.estado !== 'ativa') continue;
        if (tokensAlvo.some(alvoToken => tokenEmRaioCircular(token, alvoToken, mapa.gridConfig, CERVO_AURA_RAIO_M))) {
          return CERVO_AURA_TR_BONUS;
        }
      }
    }
  }
  return 0;
}

export function temCondicaoMental(conditionIds: string[] | undefined): boolean {
  return Boolean(conditionIds?.some(id => id === 'atordoado' || ALL_CONDITIONS.find(condition => condition.id === id)?.category === 'MENTAL'));
}

/** Aplica o impedimento da Neutralização após o resultado persistido do TR. */
export function resolverNeutralizacaoCervo(request: TestRequest): boolean {
  const atual = useTestRequestStore.getState().requests.find(item => item.id === request.id);
  if (!atual || atual.resolutionApplied || !atual.cervoNeutralizationResolution || !atual.result || atual.dc == null) return false;
  const resolution = atual.cervoNeutralizationResolution;
  const target = useCharacterStore.getState().characters.find(character => character.id === atual.charId);
  const passou = atual.result.d20 !== 1 && atual.result.total >= atual.dc;
  if (!target) {
    useLogStore.getState().addLog('combat', `🦌 Neutralização: a ficha de ${atual.charName} foi removida antes de resolver o TR.`);
    useTestRequestStore.getState().markResolutionApplied(atual.id);
    return true;
  }
  const condicao = ALL_CONDITIONS.find(item => item.id === 'tecnica-inata-suprimida')!;
  const existente = (target.activeConditions ?? []).some(item => item.conditionId === condicao.id);
  if (!passou && !existente) {
    useCharacterStore.getState().addCondition(target.id, {
      id: `cervo-neutralizacao:${atual.id}`,
      conditionId: condicao.id,
      name: condicao.name,
      icon: condicao.icon,
      remainingTurns: -1,
      remainingRounds: -1,
      expiraNoInicioDoTurnoDe: target.id,
      sourceCharId: resolution.sourceCharId,
      sourceCharName: resolution.sourceName,
      sourceEntityId: resolution.sourceInvocationId,
      sourceInstanceId: resolution.sourceInstanceId,
      sourceKind: 'tecnica_inata',
    });
  }
  const falhou = !passou;
  useLogStore.getState().addLog('combat', passou
    ? `🦌 ${target.name} resiste à Neutralização de ${resolution.sourceName} (${atual.result.total} vs CD ${atual.dc}).`
    : existente
      ? `🦌 ${target.name} falha contra a Neutralização de ${resolution.sourceName}; a Técnica Inata Suprimida já está ativa.`
      : `🦌 ${target.name} falha contra a Neutralização de ${resolution.sourceName} (${atual.result.total} vs CD ${atual.dc}) e fica sem técnica inata até o início do próximo turno.`);
  useTestRequestStore.getState().markResolutionApplied(atual.id);
  return falhou || passou;
}
