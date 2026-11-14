import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useLogStore } from '@/stores/useLogStore';
import { useMapStore } from '@/stores/useMapStore';
import type { ActiveCondition, Character } from '@/types';
import type { Entity } from '@/stores/useMapStore';
import type { DifficultTerrainArea } from '@/lib/mapa/terrenoDificil';
import { tokenFootprintsOverlap } from '@/lib/mapCollision';
import { InstanciaInvocacaoSchema } from '@/lib/invocacoes/schema';

const TAMANHOS = ['Minúsculo', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Colossal'] as const;

function indiceTamanho(nome: string): number {
  const normalizado = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return TAMANHOS.findIndex(tamanho =>
    tamanho.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === normalizado,
  );
}

/** Pegada quadrada da Fuga: Médio ocupa 1 célula; cada categoria acima acrescenta uma. */
export function celulasFugaCoelhosPorPorte(nome: string | undefined): number {
  const indice = indiceTamanho(nome ?? 'Médio');
  if (indice < 2) return 1;
  return Math.min(4, indice - 1);
}

function fugaAtiva(entity: Entity, characters: readonly Character[], layerVisible: Record<string, boolean>): boolean {
  if (entity.invocationSubordinate?.kind === 'fuga-coelho') return false;
  const owner = characters.find(character => character.id === entity.ownerCharId);
  const model = owner?.invocacoesConhecidas?.find(invocation => invocation.id === entity.invocationId);
  return model?.subcategoria === 'dez-sombras:fuga-do-coelho' &&
    (entity.hp ?? 1) > 0 && (!entity.invocationState || entity.invocationState === 'ativa') &&
    !entity.hidden && layerVisible[entity.layer ?? 'tokens'] !== false;
}

/** A massa de coelhos flanqueia automaticamente qualquer token que ocupe sua pegada. */
export function flanqueadoPelaFugaCoelhos(
  alvo: Entity,
  entities: Record<string, Entity>,
  characters: readonly Character[],
  layerVisible: Record<string, boolean>,
): boolean {
  const alvoComoToken = { origin: { x: alvo.x, y: alvo.y }, entity: alvo };
  return Object.values(entities).some(horda => horda.id !== alvo.id && fugaAtiva(horda, characters, layerVisible) &&
    tokenFootprintsOverlap(alvoComoToken, { origin: { x: horda.x, y: horda.y }, entity: horda }));
}

/** Retorna as áreas de terreno difícil da Horda contra quem está no lado adversário. */
export function terrenosDificeisFugaCoelhos(
  personagemMovendoId: string,
  characters: readonly Character[],
  entities: Record<string, Entity>,
  layerVisible: Record<string, boolean>,
): DifficultTerrainArea[] {
  const personagemMovendo = characters.find(character => character.id === personagemMovendoId);
  if (!personagemMovendo) return [];
  return Object.values(entities).flatMap(horda => {
    if (!fugaAtiva(horda, characters, layerVisible)) return [];
    const dono = characters.find(character => character.id === horda.ownerCharId);
    if (!dono) return [];
    const hostil = dono.category === 'INIMIGO'
      ? personagemMovendo.category === 'PLAYER' || personagemMovendo.category === 'NPC'
      : personagemMovendo.category === 'INIMIGO';
    if (!hostil) return [];
    return [{ x: horda.x, y: horda.y, w: horda.w, h: horda.h, rotation: horda.rotation, shape: 'RECT', difficultTerrain: 'magical' }];
  });
}

/** Aplica Fragilizada ao alvo da ação Fuga e à própria Horda após ambos serem atingidos por área. */
export function fragilizarAlvoFugaAtingidoPorArea(
  alvo: { entityId?: string; characterId?: string },
  eventoId: string,
): number {
  if (!eventoId.trim()) return 0;
  let aplicacoes = 0;
  const characters = [...useCharacterStore.getState().characters];
  const mapa = useMapStore.getState();
  for (const ownerSnapshot of characters) {
    for (const instanceSnapshot of ownerSnapshot.instanciasInvocacao ?? []) {
      const vinculo = instanceSnapshot.fugaCoelhosAlvo;
      const model = ownerSnapshot.invocacoesConhecidas?.find(invocation => invocation.id === instanceSnapshot.modeloId);
      if (model?.subcategoria !== 'dez-sombras:fuga-do-coelho' || instanceSnapshot.estado !== 'ativa' || !vinculo ||
        (alvo.entityId ? vinculo.targetEntityId !== alvo.entityId : vinculo.targetCharacterId !== alvo.characterId) ||
        instanceSnapshot.fugaCoelhosEventosAreaProcessados?.includes(eventoId)) continue;
      const owner = useCharacterStore.getState().characters.find(character => character.id === ownerSnapshot.id);
      const hordeInstance = owner?.instanciasInvocacao?.find(item => item.id === instanceSnapshot.id);
      if (!owner || !hordeInstance) continue;

      const sourceId = `fuga-coelhos:${hordeInstance.id}`;
      const makeCondition = (id: string, sourceCharId: string, sourceCharName: string) => ({
        id,
        conditionId: 'fragilizado',
        name: 'Fragilizado',
        icon: '💔',
        remainingTurns: -1,
        remainingRounds: -1,
        sourceCharId,
        sourceCharName,
        sourceEntityId: 'dez-sombras:fuga-do-coelho',
        sourceInstanceId: hordeInstance.id,
      });
      const hordeConditions = hordeInstance.condicoes ?? [];
      const hasHordeFragile = hordeConditions.some(condition => typeof condition === 'object' && condition !== null &&
        (condition as { conditionId?: unknown }).conditionId === 'fragilizado' &&
        (condition as { sourceInstanceId?: unknown }).sourceInstanceId === hordeInstance.id);
      const hordeCondition = makeCondition(`${sourceId}:fragilizado-area`, owner.id, owner.name);
      const processedEvents = [...(hordeInstance.fugaCoelhosEventosAreaProcessados ?? []), eventoId].slice(-500);
      const hordeUpdated = InstanciaInvocacaoSchema.parse({
        ...hordeInstance,
        version: hordeInstance.version + 1,
        condicoes: hasHordeFragile ? hordeConditions : [...hordeConditions, hordeCondition],
        fugaCoelhosEventosAreaProcessados: processedEvents,
      });
      useCharacterStore.getState().updateCharacter(owner.id, {
        instanciasInvocacao: (owner.instanciasInvocacao ?? []).map(item => item.id === hordeInstance.id ? hordeUpdated : item),
      });
      const hordeToken = mapa.entities[hordeInstance.tokenId];
      if (hordeToken) {
        const ids = new Set(hordeToken.invocationConditionIds ?? []);
        ids.add('fragilizado');
        useMapStore.getState().updateEntity(hordeToken.id, { invocationConditionIds: [...ids] });
      }

      const targetEntity = vinculo.targetEntityId ? mapa.entities[vinculo.targetEntityId] : undefined;
      const targetCharacterId = vinculo.targetCharacterId ?? (targetEntity?.invocationId ? targetEntity.ownerCharId : targetEntity?.characterId);
      if (vinculo.tipoAlvo === 'personagem' && targetCharacterId) {
        const active: ActiveCondition = {
          ...makeCondition(`${sourceId}:alvo:${targetCharacterId}:fragilizado-area`, owner.id, owner.name),
        };
        useCharacterStore.getState().addCondition(targetCharacterId, active);
      } else if (vinculo.tipoAlvo === 'invocacao' && targetEntity?.ownerCharId && targetEntity.invocationInstanceId) {
        const targetOwner = useCharacterStore.getState().characters.find(character => character.id === targetEntity.ownerCharId);
        const targetInstance = targetOwner?.instanciasInvocacao?.find(item => item.id === targetEntity.invocationInstanceId);
        if (targetOwner && targetInstance) {
          const targetCondition = makeCondition(`${sourceId}:alvo:${targetInstance.id}:fragilizado-area`, owner.id, owner.name);
          const exists = (targetInstance.condicoes ?? []).some(condition => typeof condition === 'object' && condition !== null &&
            (condition as { id?: unknown }).id === targetCondition.id);
          if (!exists) {
            const targetUpdated = InstanciaInvocacaoSchema.parse({
              ...targetInstance,
              version: targetInstance.version + 1,
              condicoes: [...(targetInstance.condicoes ?? []), targetCondition],
            });
            useCharacterStore.getState().updateCharacter(targetOwner.id, {
              instanciasInvocacao: (targetOwner.instanciasInvocacao ?? []).map(item => item.id === targetInstance.id ? targetUpdated : item),
            });
            const ids = new Set(targetEntity.invocationConditionIds ?? []);
            ids.add('fragilizado');
            useMapStore.getState().updateEntity(targetEntity.id, { invocationConditionIds: [...ids] });
          }
        }
      }
      useLogStore.getState().addLog('combat', `🐇 ${vinculo.targetName} e a Horda da Fuga foram atingidos por área e ficaram Fragilizados.`);
      aplicacoes++;
    }
  }
  return aplicacoes;
}

/** Avança o crescimento periódico da Fuga dos Coelhos no início de uma rodada. */
export function processarCrescimentoFugaCoelhosInicioRodada(combateId: string, rodada: number): number {
  if (!combateId.trim() || !Number.isInteger(rodada) || rodada < 1) return 0;
  const combate = useCombatStore.getState();
  if (!combate.inCombat || combate.combatId !== combateId || combate.round < rodada) return 0;
  // Dynamic import can resolve after the next turn was advanced again; catch up to the live round.
  const rodadaAtual = combate.round;

  let crescimentosAplicados = 0;
  const snapshots = [...useCharacterStore.getState().characters];
  for (const personagemSnapshot of snapshots) {
    for (const instanciaSnapshot of personagemSnapshot.instanciasInvocacao ?? []) {
      const personagem = useCharacterStore.getState().characters.find(item => item.id === personagemSnapshot.id);
      const instancia = personagem?.instanciasInvocacao?.find(item => item.id === instanciaSnapshot.id);
      const modelo = personagem?.invocacoesConhecidas?.find(item => item.id === instancia?.modeloId);
      if (!personagem || !instancia || modelo?.subcategoria !== 'dez-sombras:fuga-do-coelho' || instancia.estado !== 'ativa') continue;

      const mapa = useMapStore.getState();
      const token = mapa.entities[instancia.tokenId];
      if (!token || token.ownerCharId !== personagem.id || token.invocationInstanceId !== instancia.id ||
        (token.hp ?? instancia.hpAtual) <= 0 || token.hidden || mapa.layerVisible[token.layer ?? 'tokens'] === false ||
        (token.invocationState && token.invocationState !== 'ativa')) continue;

      const estadoAnterior = instancia.crescimentoFugaCoelhos;
      const estadoValido = estadoAnterior?.combateId === combateId && rodadaAtual >= estadoAnterior.rodadaInicio;
      const estadoBase = estadoValido
        ? { ...estadoAnterior, crescimentosNestaCena: estadoAnterior.crescimentosNestaCena ?? 0 }
        : {
            combateId,
            rodadaInicio: instancia.combateId === combateId
              ? instancia.rodadaCriacao ?? rodadaAtual
              : instancia.combateId ? rodadaAtual : 1,
            totalCrescimentos: estadoAnterior?.totalCrescimentos ?? 0,
            crescimentosNestaCena: 0,
          };
      const rodadasDesdeInicio = Math.max(0, rodadaAtual - estadoBase.rodadaInicio);
      const crescimentosDevidos = Math.floor(rodadasDesdeInicio / 3);
      const crescimentosPendentes = Math.max(0, crescimentosDevidos - estadoBase.crescimentosNestaCena);
      const incrementoPV = Math.floor((modelo.hpMaximo ?? instancia.hpMaximoAtual) / 5);

      if (crescimentosPendentes === 0 || incrementoPV <= 0) {
        if (!estadoValido) {
          const atualizada = InstanciaInvocacaoSchema.parse({
            ...instancia,
            version: instancia.version + 1,
            crescimentoFugaCoelhos: estadoBase,
          });
          useCharacterStore.getState().updateCharacter(personagem.id, {
            instanciasInvocacao: (personagem.instanciasInvocacao ?? []).map(item => item.id === instancia.id ? atualizada : item),
          });
        }
        continue;
      }

      const pvGanho = incrementoPV * crescimentosPendentes;
      const hpMaximo = instancia.hpMaximoAtual + pvGanho;
      const hpAtual = Math.min(hpMaximo, instancia.hpAtual + pvGanho);
      const totalCrescimentos = estadoBase.totalCrescimentos + crescimentosPendentes;
      const tamanhoBase = modelo.tamanho ?? modelo.porte ?? 'Médio';
      const porteAtual = token.invocationEffectiveSize ?? tamanhoBase;
      const indiceBase = indiceTamanho(porteAtual);
      const categoria = indiceBase < 0
        ? undefined
        : Math.min(TAMANHOS.length - 1, indiceBase + crescimentosPendentes);
      const tamanho = categoria === undefined ? tamanhoBase : TAMANHOS[categoria];
      const passo = useMapStore.getState().gridConfig.dpi;
      const celulas = celulasFugaCoelhosPorPorte(tamanho);
      const largura = passo > 0 ? passo * celulas : token.w;
      const altura = passo > 0 ? passo * celulas : token.h;
      const crescimento = {
        ...estadoBase,
        totalCrescimentos,
        crescimentosNestaCena: crescimentosDevidos,
        ultimaRodadaCrescimento: rodadaAtual,
      };
      const atualizada = InstanciaInvocacaoSchema.parse({
        ...instancia,
        version: instancia.version + 1,
        hpAtual,
        hpMaximoAtual: hpMaximo,
        crescimentoFugaCoelhos: crescimento,
      });
      useCharacterStore.getState().updateCharacter(personagem.id, {
        instanciasInvocacao: (personagem.instanciasInvocacao ?? []).map(item => item.id === instancia.id ? atualizada : item),
        invocacoesConhecidas: (personagem.invocacoesConhecidas ?? []).map(item => item.id === modelo.id
          ? { ...item, hpAtual: Math.min(item.hpMaximo ?? hpMaximo, hpAtual) }
          : item),
      });
      useMapStore.getState().updateEntity(token.id, {
        x: token.x + token.w / 2 - largura / 2,
        y: token.y + token.h / 2 - altura / 2,
        w: largura,
        h: altura,
        shape: 'RECT',
        hp: hpAtual,
        hpMax: hpMaximo,
        invocationEffectiveSize: tamanho,
        ...(categoria !== undefined ? { invocationEffectiveSizeCategory: categoria } : {}),
      });
      useLogStore.getState().addLog(
        'combat',
        `🐇 Horda Infindável: ${modelo.apelido?.trim() || modelo.nome} aplica ${crescimentosPendentes} crescimento(s) até a rodada ${rodadaAtual}: +${pvGanho} PV atuais e máximos; porte ${tamanho}.`,
      );
      crescimentosAplicados += crescimentosPendentes;
    }
  }
  return crescimentosAplicados;
}
