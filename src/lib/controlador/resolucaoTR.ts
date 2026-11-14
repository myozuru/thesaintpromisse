import type { TestRequest } from '@/stores/useTestRequestStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { useMapStore } from '@/stores/useMapStore';
import { useFogStore } from '@/stores/fogStore';
import { WallsEngine } from '@/components/mapa/WallsEngine';
import { buildSegments as buildFogSegments } from '@/lib/fog/visibility';
import { prepareCollisionCache, resolveCollisionMove, tokenFootprintSegments, type MapCollisionSegment } from '@/lib/mapCollision';
import { rollDiceGroups } from '@/lib/dice';
import { parseFormulaDanoInvocacao } from './rolagens';
import { causarDanoInvocacao, registrarFenomenoRodaMahoraga } from './mapa';
import { resolverTokenDaFicha } from '@/lib/mapa/tokenDaFicha';
import { InstanciaInvocacaoSchema } from '@/lib/invocacoes/schema';
import { TIGRE_SANGRAMENTO_FORMULA } from './dezSombrasTigre';

/** Aplica a condição única do Retalhar somente após uma falha confirmada em Fortitude. */
export function resolverSangramentoForteTigre(request: TestRequest): { passou: boolean; aplicado: boolean } {
  const resolution = request.tigreSangramentoResolution;
  const result = request.result;
  if (!resolution || !result || request.dc === undefined) {
    throw new Error('O pedido não contém resultado de Fortitude para Sangramento Forte.');
  }
  const passou = result.forced
    ? result.forced.kind === 'success'
    : result.d20 !== 1 && result.total >= request.dc;
  if (passou) {
    useLogStore.getState().addLog('combat', `🐅 ${resolution.sourceName}: ${request.charName} passou em Fortitude contra CD ${request.dc}; não recebe Sangramento Forte.`);
    return { passou: true, aplicado: false };
  }

  const targetInvocation = resolution.targetInvocation ?? request.targetInvocation;
  const condicao = {
    id: `tigre-sangramento:${request.id}`,
    conditionId: resolution.conditionId,
    name: resolution.conditionName,
    icon: resolution.conditionIcon,
    remainingTurns: -1,
    remainingRounds: -1,
    durationMode: 'ate_passar_tr' as const,
    endTrType: 'Fortitude',
    endCD: resolution.endCD,
    endTrTiming: 'turn_end' as const,
    tickDamageFormula: TIGRE_SANGRAMENTO_FORMULA,
    lastDamageTickTurnKey: undefined,
    lastEndTrOfferTurnKey: undefined,
    sourceCharId: resolution.sourceCharId,
    sourceCharName: resolution.sourceCharName,
    sourceEntityId: 'tigre-funebre',
    sourceInstanceId: resolution.sourceInstanceId,
  };
  if (targetInvocation) {
    const token = useMapStore.getState().entities[targetInvocation.tokenId];
    const owner = useCharacterStore.getState().characters.find(character => character.id === targetInvocation.ownerCharacterId);
    const instance = owner?.instanciasInvocacao?.find(item => item.id === targetInvocation.invocationInstanceId);
    if (!token || token.invocationInstanceId !== targetInvocation.invocationInstanceId || !owner || !instance || instance.estado !== 'ativa') {
      useLogStore.getState().addLog('combat', `🐅 ${resolution.sourceName}: a invocação-alvo saiu do combate antes de receber Sangramento Forte.`);
      return { passou: false, aplicado: false };
    }
    const conditions = instance.condicoes ?? [];
    if (conditions.some(item => item && typeof item === 'object' && (item as { id?: unknown }).id === condicao.id)) {
      return { passou: false, aplicado: true };
    }
    const updated = InstanciaInvocacaoSchema.parse({
      ...instance,
      version: instance.version + 1,
      condicoes: [...conditions, condicao],
    });
    useCharacterStore.getState().updateCharacter(owner.id, {
      instanciasInvocacao: (owner.instanciasInvocacao ?? []).map(item => item.id === instance.id ? updated : item),
    });
    useMapStore.getState().updateEntity(token.id, {
      invocationConditionIds: [...new Set([...(token.invocationConditionIds ?? []), resolution.conditionId])],
    });
  } else {
    const alvo = useCharacterStore.getState().characters.find(character => character.id === request.charId);
    if (!alvo) {
      useLogStore.getState().addLog('combat', `🐅 ${resolution.sourceName}: a ficha-alvo saiu do combate antes de receber Sangramento Forte.`);
      return { passou: false, aplicado: false };
    }
    useCharacterStore.getState().addCondition(alvo.id, condicao as never);
  }
  useLogStore.getState().addLog('combat', `🐅 ${resolution.sourceName}: ${request.charName} falhou em Fortitude contra CD ${request.dc} e recebe Sangramento Forte (4d10 no início do turno; Fortitude no fim do turno encerra).`);
  return { passou: false, aplicado: true };
}

/** Resolve o dano de uma ação de Shikigami depois que o alvo conclui o TR. */
export async function resolverDanoAposTRInvocacao(request: TestRequest): Promise<{
  passou: boolean;
  dano: number;
}> {
  const resolution = request.invocationResolution;
  const result = request.result;
  if (!resolution || !result || request.dc === undefined) {
    throw new Error('O pedido não contém resultado de TR com CD e efeito de invocação.');
  }
  const passou = result.forced
    ? result.forced.kind === 'success'
    : result.d20 !== 1 && result.total >= request.dc;
  const eventoId = request.sourceTag ?? request.id;
  const fenomenoId = `${resolution.invocationId}:${resolution.actionId}`;
  if (resolution.targetInvocation) {
    registrarFenomenoRodaMahoraga(
      resolution.targetInvocation.ownerCharacterId,
      resolution.targetInvocation.invocationId,
      { id: fenomenoId, nome: resolution.sourceName, eventoId, tipoDano: resolution.damageType },
    );
  }
  let dano = 0;

  if (!passou || resolution.damageOnSuccess === 'metade') {
    const formula = parseFormulaDanoInvocacao(resolution.damageFormula);
    if (!formula) throw new Error(`Invalid damage formula: ${resolution.damageFormula}`);
    const rolled = await rollDiceGroups(formula.dados, { label: `${resolution.sourceName} - damage after save` });
    dano = Math.max(0, rolled.total + formula.fixo + (resolution.damageBonus ?? 0));
    if (passou) dano = Math.floor(dano / 2);

    if (dano > 0) {
      if (resolution.targetInvocation) {
        const aplicado = causarDanoInvocacao(
          resolution.targetInvocation.tokenId,
          dano,
          resolution.damageType,
          resolution.targetInvocation.invocationInstanceId,
          {
            tipoAlvo: resolution.targetInvocation.tipoAlvo ?? 'unico',
            eventoId,
            fenomenoId,
            fenomenoNome: resolution.sourceName,
          },
        );
        if (!aplicado.ok) throw new Error(aplicado.motivo);
      } else {
        await useCharacterStore.getState().applyDamage(request.charId, dano, resolution.damageType, {
          attackerId: resolution.ownerCharacterId,
          source: 'omni',
        });
      }
    }

    // Torrente empurra após falha no TR de Fortitude, mesmo quando o dano é zero.
    if (!passou && resolution.actionId === 'torrente-agua') {
      await aplicarEmpurroTorrenteDeAgua(
        resolution.ownerCharacterId,
        resolution.invocationId,
        resolution.invocationInstanceId,
        resolution.targetInvocation
          ? { tipo: 'invocacao', tokenId: resolution.targetInvocation.tokenId }
          : { tipo: 'personagem', characterId: request.charId },
      );
    }
  }
  useLogStore.getState().addLog(
    'combat',
    `🛡️ ${request.charName} — ${request.testName}: d20 ${result.d20} + ${result.bonus} = ${result.total} vs CD ${request.dc} → ${passou ? 'sucesso' : 'falha'}. ${resolution.sourceName}: ${dano} ${resolution.damageType ?? 'DCO'} de dano aplicado.`,
  );
  return { passou, dano };
}

/** Aplica o empurrão da Torrente de Água após falha no TR de Fortitude. */
async function aplicarEmpurroTorrenteDeAgua(
  donoCharacterId: string,
  atacanteInvocationId: string,
  atacanteInvocationInstanceId: string,
  alvo: { tipo: 'invocacao'; tokenId: string } | { tipo: 'personagem'; characterId: string }
): Promise<void> {
  const mapa = useMapStore.getState();
  const fog = useFogStore.getState();

  // Get the attacker's token/token (shikigami) by ownerCharacterId + invocationId + invocationInstanceId
  const tokenAtacante = Object.values(mapa.entities).find(
    e => e.ownerCharId === donoCharacterId &&
         e.invocationId === atacanteInvocationId &&
         e.invocationInstanceId === atacanteInvocationInstanceId
  );
  if (!tokenAtacante) return;

  let tokenAlvo: ReturnType<typeof useMapStore.getState>['entities'][string] | undefined;
  if (alvo.tipo === 'invocacao') {
    tokenAlvo = mapa.entities[alvo.tokenId];
  } else {
    const personagemAlvo = useCharacterStore.getState().characters.find(character => character.id === alvo.characterId);
    if (personagemAlvo) {
      const entidadesDePersonagens = Object.fromEntries(
        Object.entries(mapa.entities).filter(([, entity]) => !entity.invocationId),
      );
      tokenAlvo = resolverTokenDaFicha(personagemAlvo, entidadesDePersonagens, mapa.layerVisible);
    }
  }

  if (!tokenAlvo) return;

  // Calculate direction from attacker to target (using token centers)
  const atacanteCenterX = tokenAtacante.x + tokenAtacante.w / 2;
  const atacanteCenterY = tokenAtacante.y + tokenAtacante.h / 2;
  const alvoCenterX = tokenAlvo.x + tokenAlvo.w / 2;
  const alvoCenterY = tokenAlvo.y + tokenAlvo.h / 2;

  const dx = alvoCenterX - atacanteCenterX;
  const dy = alvoCenterY - atacanteCenterY;
  const distancia = Math.hypot(dx, dy);

  // If centers coincide, leave the push unresolved instead of inventing east
  if (distancia < 0.1) {
    return;
  }

  // Normalize the direction vector
  const normalizedDx = dx / distancia;
  const normalizedDy = dy / distancia;

  // Calculate push position (4.5m away from attacker in the direction of the target)
  const pushDistanceMeters = 4.5;
  const pushCenterX = alvoCenterX + (normalizedDx * pushDistanceMeters * mapa.gridConfig.dpi / mapa.gridConfig.metersPerCell);
  const pushCenterY = alvoCenterY + (normalizedDy * pushDistanceMeters * mapa.gridConfig.dpi / mapa.gridConfig.metersPerCell);

  // Convert back to top-left position for the entity
  const pushEntityX = pushCenterX - tokenAlvo.w / 2;
  const pushEntityY = pushCenterY - tokenAlvo.h / 2;

  // Attempt to move the target to the push position
  await moverEntidadeParaPosicao(tokenAlvo.id, pushEntityX, pushEntityY, mapa, fog);
}

/** Tenta mover uma entidade para uma posição específica, verificando colisões. */
async function moverEntidadeParaPosicao(
  entityId: string,
  targetX: number,
  targetY: number,
  mapa: ReturnType<typeof useMapStore.getState>,
  fog: ReturnType<typeof useFogStore.getState>
): Promise<void> {
  const grid = mapa.gridConfig;
  if (!(grid.dpi > 0) || !(grid.metersPerCell > 0)) return;

  const token = mapa.entities[entityId];
  if (!token) return;

  // Calculate the actual movement delta
  const deltaX = targetX - token.x;
  const deltaY = targetY - token.y;

  // Check for wall collisions using the correct API types
  const paredesAtivas = WallsEngine.blockingSegments(mapa.walls, 'sight');
  const fogSegmentsRaw = buildFogSegments(fog.walls, fog.doors);
  // Convert fog segments to [a,b] tuples: buildFogSegments returns objects {a,b}
  const fogSegments: MapCollisionSegment[] = fogSegmentsRaw.map(seg => [seg.a, seg.b]);
  const todosSegmentos = [...paredesAtivas, ...fogSegments];

  const entidadesFixas = Object.values(mapa.entities).filter(entity =>
    entity.id !== entityId && entity.layer !== 'map' && !entity.hidden && !entity.carriedBy
  );

  // Add blockers via tokenFootprintSegments with correct signature
  // tokenFootprintSegments takes one MapCollisionToken plus dx,dy
  const bloqueadores = entidadesFixas.flatMap(entity =>
    tokenFootprintSegments(
      { origin: { x: entity.x, y: entity.y }, entity },
      0, 0
    )
  );

  const segmentos = [...todosSegmentos, ...bloqueadores];
  const cache = prepareCollisionCache(segmentos);

  // Create a moving token at the current position to check collision along the path
  const movingToken = {
    origin: { x: token.x, y: token.y },
    entity: token
  };

  // Check if the path from current position to target position is clear
  // resolveCollisionMove signature: (tokens, cache, from, desiredMove)
  // Pass {dx:0,dy:0} as from and {dx:deltaX,dy:deltaY} as desiredMove
  const passo = { dx: 0, dy: 0 }; // from (current position)
  const desejado = { dx: deltaX, dy: deltaY }; // desiredMove
  const deslocamento = resolveCollisionMove([movingToken], cache, passo, desejado);

  // Apply the collision-clipped displacement: a blocker can shorten the push without cancelling it.
  if (!Number.isFinite(deslocamento.dx) || !Number.isFinite(deslocamento.dy) ||
    Math.hypot(deslocamento.dx, deslocamento.dy) < 1e-6) return;

  mapa.updateEntity(entityId, {
    x: token.x + deslocamento.dx,
    y: token.y + deslocamento.dy
  });
}
