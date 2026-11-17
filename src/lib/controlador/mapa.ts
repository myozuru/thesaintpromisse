import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore, type Entity } from '@/stores/useMapStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { validarIntermediarioInvocacao } from './intermediario';
import { useCombatStore } from '@/stores/useCombatStore';
import { limiteAtivasPersonagem, mensagemDomesticaoPendente, type InvocacaoControlador } from './tipos';
import { alcancePosicionamentoInvocacao } from './alcanceInvocacao';
import { aparenciaTokenInvocacao } from './aparenciaToken';
import { useLogStore } from '@/stores/useLogStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { podeUsarVersaoAprovada } from '@/lib/controlador/aprovacao';
import { dadosAdicionaisInvestidaPerfurante, inerciaImparavelTouroAtiva, medirInvestidaRetaEmMetros } from '@/lib/controlador/dezSombras';
import { bonusTRCondicaoMahoraga, efeitosRodaNoDano, encerrarAdaptacaoCondicaoMahoraga, estadoInicialMahoraga, limitePEAdicionalRegeneracaoMahoraga, normalizarEstadoMahoraga, obterIgnoranciaAdaptativaMahoraga, processarAdaptacoesCondicoesMahoraga, processarInicioTurnoMahoraga, processarVontadeDivinaMahoraga, registrarAtaqueContraAlvoMahoraga, registrarFenomenoMahoraga, resolverCicloVidaMahoraga } from './dezSombrasMahoraga';
import { computeTotalDefense } from '@/lib/defenseCalc';
import { rollD20Autonomo, rollDiceGroups } from '@/lib/dice';
import { SISTEMA_PERICIAS, ROTULOS_PERICIAS } from '@/lib/omni/constantesDoSistema';
import { WallsEngine } from '@/components/mapa/WallsEngine';
import { placementBlocked, prepareCollisionCache, resolveCollisionMove, tokenFootprintSegments, tokenFootprintsOverlap, type MapCollisionToken } from '@/lib/mapCollision';
import { buildSegments as buildFogSegments } from '@/lib/fog/visibility';
import { useFogStore } from '@/stores/fogStore';
import { isFreeformFor } from '@/lib/freeformMode';
import { DEFAULT_SAVING_THROWS, type ActiveBuff, type Character, type DamageType } from '@/types';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import type { MapTemplate } from '@/components/mapa/TemplateEngine';
import { findEntitiesInTemplate, resolveAreaTargetCharacters } from '@/lib/mapAoE';
import { resolverTokenDaFicha, resolverTokenControladorDaFicha } from '@/lib/mapa/tokenDaFicha';
import { broadcastEntityPatches } from '@/lib/mapa/broadcastEntityPatches';
import { isWithinTouch, touchDistanceMeters } from '@/lib/touchRange';
import { defaultSizeForLevel } from '@/lib/camCores';
import { movementCostForTerrainSegment } from '@/lib/mapa/terrenoDificil';
import { celulasFugaCoelhosPorPorte, fragilizarAlvoFugaAtingidoPorArea } from './dezSombrasFuga';
import { distanciaCircularMetros } from '@/lib/mapa/alcanceCircular';
import { ALL_CONDITIONS, type ActiveCondition } from '@/types/conditions';
import { GRAU_CONDICAO } from '@/lib/suporteNivel4';
import { dissiparDominioSimples } from '@/lib/specialActivation';
import { CERVO_AURA_CURA, CERVO_AURA_RAIO_M, CERVO_NEUTRALIZACAO_RAIO_M, condicaoInvocacaoCervo, nivelCondicaoCervo, tokenEmRaioCircular, tokenVisivel } from './dezSombrasCervo';
import { InstanciaInvocacaoSchema, type CategoriaEconomiaInvocacao, type InstanciaInvocacao } from '@/lib/invocacoes/schema';
import { alcanceCuraInvocacao, calcularEfeitoSuporte, capacidadeEnergiaReversaInvocacao } from './suporte';
import { bonusPericiaCaracteristicas, reducaoDanoCaracteristicas } from './passivas';
import { resolverAcaoOmniInvocacao } from './omni';
import { aceitaAlvoAtivo } from '@/lib/omni/alvosAtivos';
import type { CadeiaOmni } from '@/lib/omni/cadeiaEventos';
import type { AcaoAtivaConfig } from '@/lib/omni/tipos';
import {
  aplicarCuraPVInvocacao,
  aplicarDanoPVInvocacao,
  levantarInstanciaInvocacao,
  novaInstanciaInvocacao,
  estadoPorPVInvocacao,
  resolverDerrotaManualInvocacao,
  validarDissipacaoVoluntaria,
  type DecisaoManualDerrotaInvocacao,
} from './estadoInvocacao';
import {
  criarContribuicaoTempoInvocacao,
  formatarSegundosTempoInvocacao,
  tempoAdicionalEmSegundos,
} from './tempo';
import {
  categoriaEconomiaDaAcao,
  economiaAcoesInicial,
  gastarAcaoDaInstancia,
  podeUsarAcaoDaInstancia,
  processarResetEconomiaInstancia,
  registrarRecargaDaAcao,
  recursosInvocacaoIniciais,
} from './economiaAcoes';
import {
  calcularBonusAtaqueInvocacao,
  calcularBonusResistenciaInvocacao,
  calcularBonusPericiaInvocacao,
  calcularBonusDanoInvocacao,
  calcularCDInvocacao,
  invocacaoTreinadaNaPericia,
  multiplicarDadosCriticos,
  parseFormulaDanoInvocacao,
  resolverAcertoInvocacao,
} from './rolagens';
import { calcularHorda, calcularReducaoDanoHorda, validarLimiteHorda, vagasInvocacaoEmCampo, type GrauHorda, type TipoAlvoDanoHorda } from './hordas';
import { calcularEscalaHorda, calcularPrejuizoRepeticaoHorda, verificarPerdaMembrosHorda, resolverPerdaMembrosHorda, acumularCuraParaLimiarHorda } from './hordas';
import { consumirAceiteAutonomia, type AceiteAutonomia } from './confirmacaoAutonomia';
import { integracaoInvocacoes, metricasIntegracaoInvocacoes as metricas } from './integracaoFlags';
import { formatDamage, stepDamage } from '@/lib/damageStep';
import { OrigemSuporteHordaSchema } from '@/lib/invocacoes/schema';
import { grantAdvantage, revokeAdvantage } from '@/lib/omni/rollAdvantage';
import { requestReactionDecision, useReactionStore } from '@/stores/useReactionStore';
import type { ParcelaDano } from '@/lib/omni/contextoDano';
import { deslocamentoInvocacaoM, validarCargaNue } from './dezSombrasMovimento';
import { ativarPredadorApiceTigre, estadoInicialTigreFunebre, normalizarEstadoTigreFunebre, penalidadeGarrasTigre, predadorApiceTigreAtivo, recuperarGarrasTigreNoTurnoAlvo, registrarAcertoGarrasTigre as registrarAcertoGarrasTigreEstado, registrarRetalharPredadorApiceTigre, TIGRE_FUNEBRE_SUBCATEGORIA, TIGRE_GARRAS_DEFESA_MAXIMA, TIGRE_PREDADOR_RD_FIXA, TIGRE_SANGRAMENTO_FORMULA, type EstadoTigreFunebre } from './dezSombrasTigre';
import './suporteContinuoHorda';

export type DirecaoInvocacao = 'norte' | 'sul' | 'leste' | 'oeste';
export type ResultadoInvocacao = { ok: true; tokenId: string } | { ok: false; motivo: string };
export type PosicaoInvocacao = { invocacaoId: string; x: number; y: number };
export type ResultadoLoteInvocacoes = { ok: true; tokenIds: string[] } | { ok: false; motivo: string };

const comandosCervoPendentes = new Set<string>();

export interface EntradaCriacaoHorda {
  eventoId?: string;
  liderId: string;
  membrosIds: readonly string[];
  tempoAdicional: NonNullable<InvocacaoControlador['tempoAdicional']>;
  x: number;
  y: number;
  motivosOverrideIntermediario?: Record<string, string>;
}

function novoIdInvocacao(prefixo: string): string {
  const valor = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefixo}-${valor}`;
}

function normalizarCondicaoInvocacao(valor: unknown): string {
  return String(valor ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function maiorModificadorMentalDonoMahoraga(dono: Character): number {
  const aliases: Record<'sabedoria' | 'presenca', string[]> = {
    sabedoria: ['sabedoria', 'wisdom', 'wis'],
    presenca: ['presenca', 'presence', 'pre'],
  };
  const modificadores = (Object.entries(aliases) as Array<[keyof typeof aliases, string[]]>).map(([, nomes]) => {
    const valor = (dono.attributes ?? []).find(item => nomes.includes(normalizarCondicaoInvocacao(item.name)))?.value ?? 10;
    return Math.floor((valor - 10) / 2);
  });
  return Math.max(1, ...modificadores);
}

function donoMahoragaIncapacitado(dono: Character): boolean {
  return Boolean(dono.dying || dono.unconsciousFromExhaustion || dono.activeConditions?.some(condicao =>
    ['inconsciente', 'desmaiado'].includes(normalizarCondicaoInvocacao(condicao.conditionId)),
  ));
}

function instanciaTemCondicao(instancia: InstanciaInvocacao, conditionId: string): boolean {
  const esperada = normalizarCondicaoInvocacao(conditionId);
  return (instancia.condicoes ?? []).some(condicao => {
    if (typeof condicao === 'string') return normalizarCondicaoInvocacao(condicao) === esperada;
    if (!condicao || typeof condicao !== 'object') return false;
    return normalizarCondicaoInvocacao((condicao as { conditionId?: unknown }).conditionId) === esperada;
  });
}

function rankPorteInvocacao(valor: string | undefined): number | null {
  const porte = normalizarCondicaoInvocacao(valor);
  const ranks: Record<string, number> = {
    minimo: 0, minusculo: 0, miudo: 0, pequeno: 1, medio: 2,
    grande: 3, enorme: 4, colossal: 5, gigantesco: 5,
  };
  return Object.hasOwn(ranks, porte) ? ranks[porte] : null;
}

function mensagemFichaDerivadaIncompleta(modelo: InvocacaoControlador): string | null {
  if (modelo.formaDerivada && modelo.acoes.length === 0) {
    return `${modelo.nome} não tem ações cadastradas. Complete a ficha e solicite nova aprovação antes de invocar.`;
  }
  return null;
}

function economiaInicialInvocacao(modelo: InvocacaoControlador): InstanciaInvocacao['economiaAcoes'] {
  return economiaAcoesInicial(modelo);
}

function instanciasComAtualizada(
  personagem: Character,
  instancia: InstanciaInvocacao,
): InstanciaInvocacao[] {
  const anteriores = personagem.instanciasInvocacao ?? [];
  const index = anteriores.findIndex(item => item.id === instancia.id);
  if (index < 0) return [...anteriores, instancia];
  return anteriores.map((item, i) => i === index ? instancia : item);
}

function gravarInstancia(
  personagem: Character,
  instancia: InstanciaInvocacao,
  extras: Partial<Character> = {},
): void {
  const personagemAtual = useCharacterStore.getState().characters.find(item => item.id === personagem.id) ?? personagem;
  const token = useMapStore.getState().entities[instancia.tokenId];
  const instanciasRitualMestre = Boolean(token?.masterControlled && token.ritualId);
  const modeloCatalogo = personagemAtual.invocacoesConhecidas?.find(modelo => modelo.id === instancia.modeloId);
  const limiteCatalogo = modeloCatalogo?.subcategoria === 'dez-sombras:fuga-do-coelho'
    ? modeloCatalogo.hpMaximo ?? instancia.hpMaximoAtual
    : instancia.hpMaximoAtual;
  const hpCatalogo = Math.max(0, Math.min(limiteCatalogo, instancia.hpAtual));
  useCharacterStore.getState().updateCharacter(personagemAtual.id, {
    instanciasInvocacao: instanciasComAtualizada(personagemAtual, instancia),
    ...(!instanciasRitualMestre ? {
      invocacoesConhecidas: (personagemAtual.invocacoesConhecidas ?? []).map(modelo => modelo.id === instancia.modeloId
        ? { ...modelo, hpAtual: hpCatalogo }
        : modelo),
    } : {}),
    ...extras,
  });
}

function empurrarAlvoMahoraga(
  tokenAlvo: Entity,
  tokenAtacante: Entity,
  distanciaM: number,
): { deslocamentoM: number; bloqueado: boolean } {
  const mapa = useMapStore.getState();
  const metrosPorPixel = mapa.gridConfig.metersPerCell / mapa.gridConfig.dpi;
  if (!(metrosPorPixel > 0) || !(distanciaM > 0)) return { deslocamentoM: 0, bloqueado: true };
  const dx = tokenAlvo.x + tokenAlvo.w / 2 - (tokenAtacante.x + tokenAtacante.w / 2);
  const dy = tokenAlvo.y + tokenAlvo.h / 2 - (tokenAtacante.y + tokenAtacante.h / 2);
  const magnitude = Math.hypot(dx, dy);
  if (magnitude < 1e-6) return { deslocamentoM: 0, bloqueado: true };
  const segmentos = WallsEngine.blockingSegments(mapa.walls, 'sight');
  const fog = useFogStore.getState();
  for (const segmento of buildFogSegments(fog.walls, fog.doors)) segmentos.push([segmento.a, segmento.b]);
  for (const entidade of Object.values(mapa.entities)) {
    if (entidade.id === tokenAlvo.id || entidade.layer === 'map' || entidade.hidden) continue;
    segmentos.push(...tokenFootprintSegments({ origin: { x: entidade.x, y: entidade.y }, entity: entidade }, 0, 0));
  }
  const cache = prepareCollisionCache(segmentos);
  const moving: MapCollisionToken = { origin: { x: tokenAlvo.x, y: tokenAlvo.y }, entity: tokenAlvo };
  const pedidoPx = distanciaM / metrosPorPixel;
  const resolvido = resolveCollisionMove([moving], cache, { dx: 0, dy: 0 }, {
    dx: dx / magnitude * pedidoPx,
    dy: dy / magnitude * pedidoPx,
  });
  const deslocamentoM = Math.hypot(resolvido.dx, resolvido.dy) * metrosPorPixel;
  if (deslocamentoM > 0.001) {
    mapa.pushHistory();
    mapa.updateEntity(tokenAlvo.id, { x: tokenAlvo.x + resolvido.dx, y: tokenAlvo.y + resolvido.dy });
    broadcastEntityPatches([{ id: tokenAlvo.id, patch: { x: tokenAlvo.x + resolvido.dx, y: tokenAlvo.y + resolvido.dy } }]);
  }
  return { deslocamentoM, bloqueado: deslocamentoM + 0.05 < distanciaM };
}


/** Release tongue holds when their source invocation becomes inactive. */
type SubcategoriaFonteDeSegurar = 'dez-sombras:sapo' | 'dez-sombras:abismo-desconhecido-do-poco' | 'dez-sombras:grande-serpente';

function isGrappleSource(subcategoria?: string): subcategoria is SubcategoriaFonteDeSegurar {
  return subcategoria === 'dez-sombras:sapo' || subcategoria === 'dez-sombras:abismo-desconhecido-do-poco' ||
    subcategoria === 'dez-sombras:grande-serpente';
}

function releaseGrapples(
  donoFonteId: string,
  instanciaFonteId: string,
  subcategoria: SubcategoriaFonteDeSegurar,
): void {
  const slugFonte = subcategoria.slice('dez-sombras:'.length);
  const grapplerId = `invocacao-${slugFonte}:${instanciaFonteId}`;
  let alvosLiberados = 0;
  const personagens = [...useCharacterStore.getState().characters];

  for (const snapshot of personagens) {
    const alvo = useCharacterStore.getState().characters.find(character => character.id === snapshot.id);
    if (!alvo) continue;
    const condicoes = alvo.activeConditions ?? [];
    const condicoesRestantes = condicoes.filter(condition =>
      condition.sourceEntityId !== subcategoria ||
      condition.sourceCharId !== donoFonteId ||
      condition.sourceInstanceId !== instanciaFonteId,
    );
    const grappledBy = alvo.grappleState?.grappledBy ?? [];
    const grappledByRestante = grappledBy.filter(id => id !== grapplerId);
    if (condicoesRestantes.length === condicoes.length && grappledByRestante.length === grappledBy.length) continue;
    useCharacterStore.getState().updateCharacter(alvo.id, {
      activeConditions: condicoesRestantes,
      grappleState: { ...alvo.grappleState, grappledBy: grappledByRestante },
    });
    alvosLiberados++;
  }

  for (const donoSnapshot of personagens) {
    for (const instanciaSnapshot of donoSnapshot.instanciasInvocacao ?? []) {
      if (!(instanciaSnapshot.agarradoPorInvocacao ?? []).some(link =>
        link.donoId === donoFonteId && link.instanciaId === instanciaFonteId)) continue;
      const donoAtual = useCharacterStore.getState().characters.find(character => character.id === donoSnapshot.id);
      const instanciaAtual = donoAtual?.instanciasInvocacao?.find(item => item.id === instanciaSnapshot.id);
      if (!donoAtual || !instanciaAtual) continue;
      const atualizada = InstanciaInvocacaoSchema.parse({
        ...instanciaAtual,
        version: instanciaAtual.version + 1,
        agarradoPorInvocacao: (instanciaAtual.agarradoPorInvocacao ?? []).filter(link =>
          link.donoId !== donoFonteId || link.instanciaId !== instanciaFonteId),
      });
      gravarInstancia(donoAtual, atualizada);
      alvosLiberados++;
    }
  }

  if (alvosLiberados > 0) {
    useLogStore.getState().addLog('combat', 'A invocação que mantinha Agarrado saiu de campo; os alvos foram liberados.');
  }
}
/** Registra a decisão exclusiva do Mestre e preserva a instância derrotada no histórico. */
export function resolverDerrotaPendenteInvocacao(
  donoId: string,
  invocacaoId: string,
  decisao: DecisaoManualDerrotaInvocacao,
  ator: { isMaster: boolean; profileId?: string },
): { ok: true } | { ok: false; motivo: string } {
  if (!ator.isMaster) return { ok: false, motivo: 'Somente o Mestre pode resolver a derrota de uma invocação.' };
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  if (!dono) return { ok: false, motivo: 'Personagem dono não encontrado.' };
  const modelo = dono.invocacoesConhecidas?.find(item => item.id === invocacaoId);
  if (!modelo) return { ok: false, motivo: 'Invocação não pertence ao catálogo.' };
  if (modelo.perdaPermanente) return { ok: false, motivo: 'Esta invocação já foi arquivada por perda permanente.' };
  const instancia = [...(dono.instanciasInvocacao ?? [])].reverse().find(item =>
    item.modeloId === invocacaoId && item.estado === 'derrotada' && !item.resolucaoDerrota,
  );
  if (!instancia) return { ok: false, motivo: 'Não há uma derrota pendente para esta invocação.' };
  const resultado = resolverDerrotaManualInvocacao(instancia, decisao, {
    ...ator,
    ownerProfileId: dono.profileId || instancia.donoProfileId || modelo.donoProfileId,
  });
  if (!resultado.ok) return resultado;

  const personagemAtual = useCharacterStore.getState().characters.find(character => character.id === donoId) ?? dono;
  const modelosAtualizados = (personagemAtual.invocacoesConhecidas ?? []).map(item => item.id === invocacaoId
    ? {
      ...item,
      hpAtual: resultado.pvCatalogo,
      ...(resultado.perdaPermanente ? { perdaPermanente: true } : {}),
    }
    : item);
  const instanciasAtualizadas = instanciasComAtualizada(
    personagemAtual,
    InstanciaInvocacaoSchema.parse(resultado.instancia),
  );

  useCharacterStore.getState().updateCharacter(personagemAtual.id, {
    invocacoesConhecidas: modelosAtualizados,
    instanciasInvocacao: instanciasAtualizadas,
  });
  if (isGrappleSource(modelo.subcategoria) && resultado.instancia.estado !== 'ativa') {
    releaseGrapples(donoId, instancia.id, modelo.subcategoria);
  }
  return { ok: true };
}

/** Descanso longo restaura o catálogo e as instâncias ainda ativas, sem reescrever o histórico de saídas. */
export function restaurarInvocacoesDescansoLongo(donoId: string): number {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  if (!dono) return 0;

  const instancias = dono.instanciasInvocacao ?? [];
  const derrotasPendentes = new Set(instancias
    .filter(instancia => instancia.estado === 'derrotada' && !instancia.resolucaoDerrota)
    .map(instancia => instancia.modeloId));
  const perdasPermanentes = new Set(instancias
    .filter(instancia => instancia.resolucaoDerrota?.resultado === 'perda_permanente')
    .map(instancia => instancia.modeloId));
  const modelosRestauraveis = new Set((dono.invocacoesConhecidas ?? [])
    .filter(modelo => !modelo.perdaPermanente && !perdasPermanentes.has(modelo.id) && !derrotasPendentes.has(modelo.id))
    .map(modelo => modelo.id));
  if (!modelosRestauraveis.size) return 0;

  let quantidadeRestaurada = 0;
  let alterouInstancia = false;
  const modelosAtualizados = (dono.invocacoesConhecidas ?? []).map(modelo => {
    if (!modelosRestauraveis.has(modelo.id) || modelo.hpAtual === modelo.hpMaximo) return modelo;
    quantidadeRestaurada++;
    return { ...modelo, hpAtual: modelo.hpMaximo };
  });
  const instanciasAtualizadas = instancias.map(instancia => {
    if (!modelosRestauraveis.has(instancia.modeloId) || (instancia.estado !== 'ativa' && instancia.estado !== 'caida')) {
      return instancia;
    }
    if (instancia.hpAtual === instancia.hpMaximoAtual && instancia.estado === 'ativa') return instancia;
    alterouInstancia = true;
    return InstanciaInvocacaoSchema.parse({
      ...instancia,
      version: instancia.version + 1,
      hpAtual: instancia.hpMaximoAtual,
      estado: 'ativa',
      ...(instancia.limiarPerdaHorda ? {
        limiarPerdaHorda: acumularCuraParaLimiarHorda(instancia.limiarPerdaHorda, instancia.hpMaximoAtual - instancia.hpAtual),
      } : {}),
    });
  });

  const alterouCatalogo = modelosAtualizados.some((modelo, index) => modelo !== (dono.invocacoesConhecidas ?? [])[index]);
  if (alterouCatalogo || alterouInstancia) {
    useCharacterStore.getState().updateCharacter(donoId, {
      ...(alterouCatalogo ? { invocacoesConhecidas: modelosAtualizados } : {}),
      ...(alterouInstancia ? { instanciasInvocacao: instanciasAtualizadas } : {}),
    });
  }

  for (const instancia of instanciasAtualizadas) {
    if (!modelosRestauraveis.has(instancia.modeloId) || (instancia.estado !== 'ativa' && instancia.estado !== 'caida')) continue;
    const token = useMapStore.getState().entities[instancia.tokenId];
    if (!token || token.invocationInstanceId !== instancia.id) continue;
    if ((token.hp ?? 0) !== instancia.hpAtual || token.invocationState !== 'ativa') {
      useMapStore.getState().updateEntity(token.id, {
        hp: instancia.hpAtual,
        hpMax: instancia.hpMaximoAtual,
        invocationState: 'ativa',
      });
    }
  }
  return quantidadeRestaurada;
}

type ModoExecucaoComandoInvocacao = 'manual' | 'evento_automatico' | 'reacao' | 'tigre_reacao';
type OpcoesComandoInvocacao = { instanciaId?: string; requestId?: string; cadeia?: CadeiaOmni; validarReacao?: () => boolean; aceiteAutonomia?: AceiteAutonomia; dadosReduzidos?: number };

function prepararDebitoComando(
  dono: Character,
  modelo: InvocacaoControlador,
  instancia: InstanciaInvocacao,
  acao: InvocacaoControlador['acoes'][number],
  custoOverride?: number,
  modoExecucao: ModoExecucaoComandoInvocacao = 'manual',
): { ok: true; peDonoRestante: number; recursosRestantes: Record<string, number> } | { ok: false; motivo: string } {
  const custo = custoOverride ?? acao.custoPE ?? 0;
  const configuracao = modelo.custosComandosConfigurados?.[acao.id];
  if (configuracao?.execucao === 'evento_automatico' && modoExecucao !== 'evento_automatico') {
    return { ok: false, motivo: 'Esta ação está configurada para execução por evento automático.' };
  }
  if (modoExecucao === 'evento_automatico' && configuracao?.execucao !== 'evento_automatico') {
    return { ok: false, motivo: 'A ação não foi autorizada para execução por evento automático.' };
  }
  if (custo > 0 && !configuracao) {
    return { ok: false, motivo: 'A origem do custo de PE desta ação ainda precisa ser configurada.' };
  }

  let peDono = 0;
  let peInvocacao = 0;
  const recursosRestantes = { ...instancia.recursosAtuais };
  for (const debito of custoOverride === 0 ? [] : configuracao?.debitos ?? []) {
    if (!Number.isFinite(debito.quantidade) || debito.quantidade < 0) return { ok: false, motivo: 'Débito de recurso inválido.' };
    if (debito.entidade === 'dono') {
      if (debito.recurso !== 'pe') return { ok: false, motivo: 'Esta versão só pode debitar PE do personagem dono.' };
      peDono += debito.quantidade;
      continue;
    }
    const recursoId = debito.recursoId?.trim();
    if (!recursoId) return { ok: false, motivo: 'Recurso próprio da invocação não identificado.' };
    const saldo = recursosRestantes[recursoId];
    if (saldo === undefined) return { ok: false, motivo: `Recurso próprio "${recursoId}" não configurado nesta instância.` };
    if (saldo < debito.quantidade) return { ok: false, motivo: `Saldo próprio insuficiente para "${recursoId}".` };
    recursosRestantes[recursoId] = saldo - debito.quantidade;
    if (debito.recurso === 'pe') peInvocacao += debito.quantidade;
  }
  if (Math.abs(peDono + peInvocacao - custo) > 1e-9) {
    return { ok: false, motivo: 'Os débitos de PE configurados não correspondem ao custo total da ação.' };
  }
  const peAtual = Number.isFinite(dono.peCurrent) ? dono.peCurrent : 0;
  if (peAtual < peDono) return { ok: false, motivo: 'PE insuficiente para o custo atribuído ao dono.' };
  return { ok: true, peDonoRestante: peAtual - peDono, recursosRestantes };
}

function obterInstanciaDoToken(
  personagem: Character,
  token: Entity,
  modelo: InvocacaoControlador,
): InstanciaInvocacao {
  if (token.invocationSubordinate?.kind === 'fuga-coelho') {
    const pai = useMapStore.getState().entities[token.invocationSubordinate.parentTokenId];
    if (pai && pai.invocationSubordinate?.kind !== 'fuga-coelho' && pai.invocationInstanceId === token.invocationInstanceId) {
      return obterInstanciaDoToken(personagem, pai, modelo);
    }
  }
  const hpAtual = token.hp ?? modelo.hpAtual;
  const hpMaximoAtual = token.hpMax ?? modelo.hpMaximo;
  const id = token.invocationInstanceId ?? `legacy-instance-${token.id}`;
  const existente = personagem.instanciasInvocacao?.find(item => item.id === id);
  if (existente) {
    const estado = hpAtual <= -hpMaximoAtual
      ? 'derrotada'
      : hpAtual <= 0
        ? 'caida'
        : token.invocationState === 'caida' || existente.estado === 'caida'
          ? 'caida'
          : 'ativa';
    return InstanciaInvocacaoSchema.parse({
      ...existente,
      tokenId: token.id,
      hpAtual,
      hpMaximoAtual,
      estado,
    });
  }
  return novaInstanciaInvocacao({
    id,
    modeloId: modelo.id,
    donoCharacterId: personagem.id,
    donoProfileId: personagem.profileId || undefined,
    tokenId: token.id,
    ...(token.invocationEventId ? { eventoCriacaoId: token.invocationEventId } : {}),
    hpAtual,
    hpMaximoAtual,
    estado: hpAtual <= -hpMaximoAtual
      ? 'derrotada'
      : hpAtual <= 0
        ? 'caida'
        : token.invocationState === 'caida'
          ? 'caida'
          : 'ativa',
    economiaAcoes: economiaInicialInvocacao(modelo),
    recursosAtuais: recursosInvocacaoIniciais(modelo),
    ...(modelo.subcategoria === 'dez-sombras:mahoraga' ? {
      estadoMahoraga: estadoInicialMahoraga(useCombatStore.getState().inCombat ? useCombatStore.getState().combatId ?? undefined : undefined),
    } : {}),
    ...(modelo.subcategoria === TIGRE_FUNEBRE_SUBCATEGORIA ? {
      estadoTigreFunebre: estadoInicialTigreFunebre(useCombatStore.getState().inCombat ? useCombatStore.getState().combatId ?? undefined : undefined),
    } : {}),
  });
}

function obterModeloDoToken(
  personagem: Character,
  token: Entity,
): InvocacaoControlador | undefined {
  return personagem.invocacoesConhecidas?.find(modelo => modelo.id === token.invocationId);
}

function preservarContribuicaoNaDerrota(instancia: InstanciaInvocacao): InstanciaInvocacao {
  const contribuicao = instancia.contribuicaoTempo;
  if (!contribuicao || contribuicao.estado !== 'ativa' || contribuicao.quantidadeRestante <= 0) return instancia;
  const instante = new Date().toISOString();
  return InstanciaInvocacaoSchema.parse({
    ...instancia,
    version: instancia.version + 1,
    contribuicaoTempo: {
      ...contribuicao,
      estado: 'consolacao',
      lastAccountingAt: instante,
      removedAt: instante,
      removalReason: 'derrota_definitiva',
    },
  });
}

/** Mantém tokens distintos das fichas: servos não ganham iniciativa própria. */
export function tokensInvocados(donoCharacterId: string) {
  return Object.values(useMapStore.getState().entities).filter(e =>
    e.ownerCharId === donoCharacterId && !!e.invocationId && e.invocationSubordinate?.kind !== 'fuga-coelho',
  );
}

function estaNoTimeInimigo(personagem: Character, token?: Entity): boolean {
  return Boolean(token?.masterControlled && token.ritualId) || personagem.category === 'INIMIGO';
}

function mesmaEquipeNoMapa(
  personagemA: Character,
  tokenA: Entity | undefined,
  personagemB: Character,
  tokenB?: Entity,
): boolean {
  return estaNoTimeInimigo(personagemA, tokenA) === estaNoTimeInimigo(personagemB, tokenB);
}

function coelhosDispersosAtivos(entities: Record<string, Entity>, parentTokenId: string, instanciaId: string): Entity[] {
  return Object.values(entities).filter(entity => entity.invocationSubordinate?.kind === 'fuga-coelho' &&
    entity.invocationSubordinate.parentTokenId === parentTokenId && entity.invocationInstanceId === instanciaId &&
    (entity.hp ?? 0) > 0 && (!entity.invocationState || entity.invocationState === 'ativa'));
}

function modeloVinculadoAHorda(personagem: Character, modeloId: string): boolean {
  return (personagem.instanciasInvocacao ?? []).some(instancia => {
    const composicao = instancia.composicaoHorda;
    if (!composicao || instancia.estado === 'dissipada') return false;
    return composicao.liderModeloId === modeloId || composicao.membros.some(membro => membro.modeloId === modeloId);
  });
}

function modeloEmEsperaAposHorda(personagem: Character, modeloId: string): boolean {
  const combate = useCombatStore.getState();
  return (personagem.instanciasInvocacao ?? []).some(instancia =>
    instancia.membrosHordaRemovidos?.some(membro => membro.modeloId === modeloId && membro.bloqueioRodadas > 0 &&
      !(membro.combateId === (combate.combatId ?? undefined) && (combate.round ?? 1) > membro.rodadaRemocao)));
}

function registrarAcertoGarrasTigre(
  donoId: string,
  instanciaId: string,
  alvoId: string,
  nomeAlvo: string,
): void {
  const combate = useCombatStore.getState();
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const instancia = dono?.instanciasInvocacao?.find(item => item.id === instanciaId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === instancia?.modeloId);
  if (!dono || !instancia || !modelo || modelo.subcategoria !== TIGRE_FUNEBRE_SUBCATEGORIA || instancia.estado !== 'ativa') return;
  const antes = normalizarEstadoTigreFunebre(instancia.estadoTigreFunebre, combate.inCombat ? combate.combatId ?? undefined : undefined);
  const depois = registrarAcertoGarrasTigreEstado(antes, {
    alvoId,
    nomeAlvo,
    rodada: combate.inCombat ? combate.round ?? 1 : 0,
    combateId: combate.inCombat ? combate.combatId ?? undefined : undefined,
  });
  const penalidade = depois.garras.find(item => item.alvoId === alvoId)?.penalidade ?? 0;
  gravarInstancia(dono, InstanciaInvocacaoSchema.parse({
    ...instancia,
    version: instancia.version + 1,
    estadoTigreFunebre: depois,
  }));
  const penalidadeAnterior = antes.garras.find(item => item.alvoId === alvoId)?.penalidade ?? 0;
  useLogStore.getState().addLog('combat', penalidade > penalidadeAnterior
    ? `🐅 Garras de Extermínio: ${nomeAlvo} perde 1 Defesa cumulativa (${penalidade}/${TIGRE_GARRAS_DEFESA_MAXIMA}).`
    : `🐅 Garras de Extermínio: ${nomeAlvo} já está no limite de −${TIGRE_GARRAS_DEFESA_MAXIMA} Defesa; o acerto reinicia a recuperação.`);
}

function recuperarGarrasTigreNoTurno(
  alvoId: string,
  rodada: number,
  turnoId: string,
  combateId?: string,
): void {
  for (const dono of useCharacterStore.getState().characters) {
    for (const instancia of dono.instanciasInvocacao ?? []) {
      const modelo = dono.invocacoesConhecidas?.find(item => item.id === instancia.modeloId);
      if (modelo?.subcategoria !== TIGRE_FUNEBRE_SUBCATEGORIA) continue;
      const anterior = normalizarEstadoTigreFunebre(instancia.estadoTigreFunebre, combateId);
      const penalidadeAnterior = anterior.garras.find(item => item.alvoId === alvoId)?.penalidade ?? 0;
      if (!penalidadeAnterior) continue;
      const seguinte = recuperarGarrasTigreNoTurnoAlvo(anterior, alvoId, rodada, turnoId, combateId);
      const penalidadeSeguinte = seguinte.garras.find(item => item.alvoId === alvoId)?.penalidade ?? 0;
      if (penalidadeSeguinte === penalidadeAnterior) continue;
      gravarInstancia(dono, InstanciaInvocacaoSchema.parse({
        ...instancia,
        version: instancia.version + 1,
        estadoTigreFunebre: seguinte,
      }));
      useLogStore.getState().addLog('combat', `🐅 Garras de Extermínio: ${alvoId} recupera 1 Defesa no início do próprio turno (${penalidadeSeguinte}/${TIGRE_GARRAS_DEFESA_MAXIMA} de penalidade restante).`);
    }
  }
}

type CondicaoSangramentoTigre = ActiveCondition & {
  tickDamageFormula: string;
  lastDamageTickTurnKey?: string;
  lastEndTrOfferTurnKey?: string;
  endTrTiming: 'turn_end';
};

function isCondicaoSangramentoTigre(valor: unknown): valor is CondicaoSangramentoTigre {
  if (!valor || typeof valor !== 'object') return false;
  const condicao = valor as Partial<CondicaoSangramentoTigre>;
  return condicao.conditionId === 'sangramento' &&
    condicao.sourceEntityId === 'tigre-funebre' &&
    condicao.endTrTiming === 'turn_end' &&
    typeof condicao.tickDamageFormula === 'string' &&
    condicao.tickDamageFormula.trim().length > 0;
}

async function resolverTickSangramentoTigre(
  condition: CondicaoSangramentoTigre,
  turnKey: string,
  alvo: { tipo: 'personagem'; charId: string; nome: string } |
    { tipo: 'invocacao'; tokenId: string; ownerId: string; instanceId: string; nome: string },
): Promise<void> {
  const formula = parseFormulaDanoInvocacao(condition.tickDamageFormula);
  if (!formula) {
    useLogStore.getState().addLog('combat', `🐅 Sangramento Forte em ${alvo.nome}: fórmula inválida (${condition.tickDamageFormula}); o efeito não aplicou dano.`);
    return;
  }
  try {
    const rolagem = formula.dados.length
      ? await rollDiceGroups(formula.dados, { label: `Sangramento Forte — ${alvo.nome}` })
      : { total: 0 };
    const perda = Math.max(0, rolagem.total + formula.fixo);
    if (alvo.tipo === 'personagem') {
      const atual = useCharacterStore.getState().characters.find(character => character.id === alvo.charId);
      if (!atual?.activeConditions?.some(item => item.id === condition.id && item.lastDamageTickTurnKey === turnKey)) return;
      if (perda > 0) {
        await useCharacterStore.getState().applyDamage(alvo.charId, perda, undefined, {
          source: 'ambiente',
          ignoresRD: true,
          tags: ['__condition_sangramento', '__tigre_sangramento'],
        });
      }
    } else {
      const owner = useCharacterStore.getState().characters.find(character => character.id === alvo.ownerId);
      const instance = owner?.instanciasInvocacao?.find(item => item.id === alvo.instanceId);
      const token = useMapStore.getState().entities[alvo.tokenId];
      const conditionStillActive = instance?.condicoes?.some(item =>
        isCondicaoSangramentoTigre(item) && item.id === condition.id && item.lastDamageTickTurnKey === turnKey,
      );
      if (!owner || !instance || !token || token.invocationInstanceId !== instance.id || !conditionStillActive) return;
      if (perda > 0) {
        const aplicado = causarDanoInvocacao(token.id, perda, undefined, instance.id, {
          eventoId: `tigre-sangramento:${condition.id}:${turnKey}`,
          ignoresRD: true,
          fenomenoId: 'condicao:sangramento',
          fenomenoNome: condition.name,
        });
        if (!aplicado.ok) throw new Error(aplicado.motivo);
      }
    }
    useLogStore.getState().addLog('combat', `🩸 ${alvo.nome} perde ${perda} PV por Sangramento Forte (${condition.tickDamageFormula}); o efeito ignora RD.`);
  } catch (error) {
    useLogStore.getState().addLog('combat', `🐅 Sangramento Forte em ${alvo.nome}: o tick foi interrompido. ${error instanceof Error ? error.message : ''}`);
  }
}

function processarSangramentoTigreNoInicioTurno(charId: string, turnoId: string): void {
  const personagem = useCharacterStore.getState().characters.find(character => character.id === charId);
  if (!personagem) return;
  const condicoesPersonagem = personagem.activeConditions ?? [];
  const ticksPersonagem: CondicaoSangramentoTigre[] = [];
  const condicoesAtualizadas = condicoesPersonagem.map(condition => {
    if (!isCondicaoSangramentoTigre(condition) || condition.lastDamageTickTurnKey === turnoId) return condition;
    ticksPersonagem.push(condition);
    return { ...condition, lastDamageTickTurnKey: turnoId };
  });
  if (ticksPersonagem.length) {
    useCharacterStore.getState().updateCharacter(charId, { activeConditions: condicoesAtualizadas });
    for (const condition of ticksPersonagem) {
      void resolverTickSangramentoTigre(condition, turnoId, { tipo: 'personagem', charId, nome: personagem.name });
    }
  }

  for (const instancia of personagem.instanciasInvocacao ?? []) {
    if (instancia.estado !== 'ativa' || !instancia.tokenId) continue;
    const modelo = personagem.invocacoesConhecidas?.find(item => item.id === instancia.modeloId);
    const nomeInvocacao = modelo?.apelido?.trim() || modelo?.nome || instancia.modeloId;
    const conditions = instancia.condicoes ?? [];
    const ticks: CondicaoSangramentoTigre[] = [];
    const updatedConditions = conditions.map(condition => {
      if (!isCondicaoSangramentoTigre(condition) || condition.lastDamageTickTurnKey === turnoId) return condition;
      ticks.push(condition);
      return { ...condition, lastDamageTickTurnKey: turnoId };
    });
    if (!ticks.length) continue;
    const atualizada = InstanciaInvocacaoSchema.parse({
      ...instancia,
      version: instancia.version + 1,
      condicoes: updatedConditions,
    });
    const atual = useCharacterStore.getState().characters.find(character => character.id === personagem.id);
    if (!atual) continue;
    useCharacterStore.getState().updateCharacter(personagem.id, {
      instanciasInvocacao: (atual.instanciasInvocacao ?? []).map(item => item.id === instancia.id ? atualizada : item),
    });
    for (const condition of ticks) {
      void resolverTickSangramentoTigre(condition, turnoId, {
        tipo: 'invocacao', tokenId: instancia.tokenId, ownerId: personagem.id, instanceId: instancia.id,
        nome: nomeInvocacao,
      });
    }
  }
}

function oferecerTRSangramentoTigreNoFimTurno(charId: string, turnoId: string): void {
  const personagem = useCharacterStore.getState().characters.find(character => character.id === charId);
  if (!personagem) return;
  const condicoesAtivas = personagem.activeConditions ?? [];
  const ofertasPersonagem: CondicaoSangramentoTigre[] = [];
  const condicoesMarcadas = condicoesAtivas.map(condition => {
    if (!isCondicaoSangramentoTigre(condition) || condition.lastEndTrOfferTurnKey === turnoId) return condition;
    ofertasPersonagem.push(condition);
    return { ...condition, lastEndTrOfferTurnKey: turnoId };
  });
  if (ofertasPersonagem.length) useCharacterStore.getState().updateCharacter(charId, { activeConditions: condicoesMarcadas });
  for (const condition of ofertasPersonagem) {
    useReactionStore.getState().enqueue({
      charId,
      charName: personagem.name,
      kind: 'condition_end_tr_offer',
      message: `${personagem.name}: role TR Fortitude no fim do turno para encerrar ${condition.icon} ${condition.name}.`,
      payload: {
        conditionInstanceId: condition.id,
        conditionId: condition.conditionId,
        conditionName: condition.name,
        conditionIcon: condition.icon,
        endTrType: 'Fortitude',
        endCD: condition.endCD ?? 10,
        durationMode: 'ate_passar_tr',
      },
    });
  }

  for (const instancia of personagem.instanciasInvocacao ?? []) {
    if (instancia.estado !== 'ativa' || !instancia.tokenId) continue;
    const modelo = personagem.invocacoesConhecidas?.find(item => item.id === instancia.modeloId);
    const bonusFortitude = modelo ? calcularBonusResistenciaInvocacao(personagem, modelo, 'Fortitude') : null;
    if (!modelo || !bonusFortitude) continue;
    const conditions = instancia.condicoes ?? [];
    const offers: CondicaoSangramentoTigre[] = [];
    const updatedConditions = conditions.map(condition => {
      if (!isCondicaoSangramentoTigre(condition) || condition.lastEndTrOfferTurnKey === turnoId) return condition;
      offers.push(condition);
      return { ...condition, lastEndTrOfferTurnKey: turnoId };
    });
    if (!offers.length) continue;
    const atualizada = InstanciaInvocacaoSchema.parse({
      ...instancia,
      version: instancia.version + 1,
      condicoes: updatedConditions,
    });
    const atual = useCharacterStore.getState().characters.find(character => character.id === personagem.id);
    if (!atual) continue;
    useCharacterStore.getState().updateCharacter(personagem.id, {
      instanciasInvocacao: (atual.instanciasInvocacao ?? []).map(item => item.id === instancia.id ? atualizada : item),
    });
    for (const condition of offers) {
      useReactionStore.getState().enqueue({
        charId: personagem.id,
        charName: personagem.name,
        kind: 'condition_end_tr_offer',
        message: `${modelo.apelido?.trim() || modelo.nome}: role Fortitude no fim do turno para encerrar ${condition.icon} ${condition.name} (${bonusFortitude.breakdown}).`,
        payload: {
          conditionInstanceId: condition.id,
          conditionId: condition.conditionId,
          conditionName: condition.name,
          conditionIcon: condition.icon,
          endTrType: 'Fortitude',
          endCD: condition.endCD ?? 10,
          durationMode: 'ate_passar_tr',
          targetInvocation: {
            tokenId: instancia.tokenId,
            ownerCharacterId: personagem.id,
            invocationId: modelo.id,
            invocationInstanceId: instancia.id,
            name: modelo.apelido?.trim() || modelo.nome,
          },
          bonusOverride: bonusFortitude.total,
          bonusBreakdownOverride: bonusFortitude.breakdown,
        },
      });
    }
  }
}

// Bloqueio persistente de uma rodada, independente da vida compartilhada da Horda.
useCombatStore.subscribe((atual, anterior) => {
  const rodadaAvancou = (atual.round ?? 1) > (anterior.round ?? 1);
  const mudouTurnoEmCombate = atual.inCombat && anterior.inCombat && (
    atual.combatId !== anterior.combatId || atual.round !== anterior.round || atual.currentTurnIndex !== anterior.currentTurnIndex
  );
  const inicioDeTurno = atual.inCombat && (
    !anterior.inCombat || atual.combatId !== anterior.combatId ||
    atual.round !== anterior.round || atual.currentTurnIndex !== anterior.currentTurnIndex
  );
  if (!rodadaAvancou && !inicioDeTurno) return;
  if (rodadaAvancou) {
    for (const personagem of useCharacterStore.getState().characters) {
      let alterou = false;
      const instanciasInvocacao = (personagem.instanciasInvocacao ?? []).map(instancia => {
        if (!instancia.membrosHordaRemovidos?.some(membro => membro.bloqueioRodadas > 0)) return instancia;
        alterou = true;
        return { ...instancia, version: instancia.version + 1, membrosHordaRemovidos:
          instancia.membrosHordaRemovidos.map(membro => ({ ...membro, bloqueioRodadas: Math.max(0, membro.bloqueioRodadas - 1) })) };
      });
      if (alterou) useCharacterStore.getState().updateCharacter(personagem.id, { instanciasInvocacao });
    }
  }
  if (mudouTurnoEmCombate) {
    const atorAnterior = anterior.initiativeOrder[anterior.currentTurnIndex]?.charId;
    if (atorAnterior) {
      const turnoAnteriorId = `${anterior.combatId ?? 'combate'}:${anterior.round ?? 1}:${anterior.currentTurnIndex}:${atorAnterior}`;
      oferecerTRSangramentoTigreNoFimTurno(atorAnterior, turnoAnteriorId);
    }
  }
  if (!inicioDeTurno) return;
  const atorAtual = atual.initiativeOrder[atual.currentTurnIndex]?.charId;
  if (!atorAtual) return;
  const personagemAtivo = useCharacterStore.getState().characters.find(personagem => personagem.id === atorAtual);
  if (personagemAtivo) {
    const turnoId = `${atual.combatId ?? 'combate'}:${atual.round ?? 1}:${atual.currentTurnIndex}:${atorAtual}`;
    const alvosComTurno = [atorAtual, ...(personagemAtivo.instanciasInvocacao ?? []).map(instancia => `invoc:${instancia.id}`)];
    for (const alvoId of alvosComTurno) recuperarGarrasTigreNoTurno(alvoId, atual.round ?? 1, turnoId, atual.combatId ?? undefined);
    if (useRoleStore.getState().role === 'MASTER') processarSangramentoTigreNoInicioTurno(atorAtual, turnoId);
  }
  for (const personagem of useCharacterStore.getState().characters) {
    if (personagem.id !== atorAtual) continue;
    for (const instancia of personagem.instanciasInvocacao ?? []) {
      if (instancia.estado === 'derrotada' || instancia.estado === 'dissipada') continue;
      const modelo = personagem.invocacoesConhecidas?.find(item => item.id === instancia.modeloId);
      if (modelo?.subcategoria !== 'dez-sombras:mahoraga') continue;
      const token = useMapStore.getState().entities[instancia.tokenId];
      if (!token || token.invocationInstanceId !== instancia.id) continue;
      const estadoBase = normalizarEstadoMahoraga(instancia.estadoMahoraga ?? estadoInicialMahoraga(), atual.combatId ?? undefined);
      const identidadeTurno = `${atual.combatId ?? 'combate'}:${atual.round ?? 1}:${atual.currentTurnIndex}:${personagem.id}`;
      if (estadoBase.ultimoTurnoProcessado === identidadeTurno) continue;
      const instanciaComEconomiaReset = processarResetEconomiaInstancia(
        instancia,
        modelo,
        'inicio_turno_dono',
        `mahoraga-turno:${identidadeTurno}`,
      );
      const idsCondicaoAtiva = new Set((token.invocationConditionIds ?? []).map(normalizarCondicaoInvocacao));
      for (const condicao of instancia.condicoes ?? []) {
        if (typeof condicao === 'string') idsCondicaoAtiva.add(normalizarCondicaoInvocacao(condicao));
        else if (condicao && typeof condicao === 'object' && typeof (condicao as { conditionId?: unknown }).conditionId === 'string') {
          idsCondicaoAtiva.add(normalizarCondicaoInvocacao((condicao as { conditionId: string }).conditionId));
        }
      }
      const condicoesAtivas = [...idsCondicaoAtiva].filter(Boolean).map(conditionId => {
        const definicao = ALL_CONDITIONS.find(item => normalizarCondicaoInvocacao(item.id) === conditionId);
        const grau = GRAU_CONDICAO[conditionId];
        return { conditionId, nome: definicao?.name ?? conditionId, ...(grau ? { grau } : {}) };
      });
      const comAdaptacoes = processarAdaptacoesCondicoesMahoraga(estadoBase, condicoesAtivas, atual.round ?? 1);
      const vontade = processarVontadeDivinaMahoraga(comAdaptacoes, {
        domadoPermanentemente: modelo.domado === true,
        donoIncapacitado: donoMahoragaIncapacitado(personagem),
        maiorModificadorMental: maiorModificadorMentalDonoMahoraga(personagem),
        rodada: atual.round ?? 1,
        combateId: atual.combatId ?? undefined,
      });
      const turno = processarInicioTurnoMahoraga(vontade.estado, atual.round ?? 1);
      let estadoTurnoMahoraga = turno.estado;
      const alvoPrioritarioId = estadoTurnoMahoraga.vontadeDivina?.alvoPrioritarioId;
      if (alvoPrioritarioId) {
        const alvoToken = useMapStore.getState().entities[alvoPrioritarioId];
        const alvoFicha = useCharacterStore.getState().characters.find(item => item.id === alvoPrioritarioId);
        const alvoValido = alvoToken
          ? (alvoToken.hp ?? 1) > 0 && (!alvoToken.invocationState || alvoToken.invocationState === 'ativa' || alvoToken.invocationState === 'caida')
          : Boolean(alvoFicha && (alvoFicha.hpCurrent ?? 1) > 0);
        if (!alvoValido) {
          estadoTurnoMahoraga = {
            ...estadoTurnoMahoraga,
            vontadeDivina: estadoTurnoMahoraga.vontadeDivina
              ? { ...estadoTurnoMahoraga.vontadeDivina, alvoPrioritarioId: undefined }
              : undefined,
          };
          useLogStore.getState().addLog('combat', `Vontade Divina de ${modelo.nome}: o alvo prioritário saiu de combate ou foi derrotado; a prioridade foi limpa para nova decisão do Mestre.`);
        }
      }
      const estadoMahoraga = { ...estadoTurnoMahoraga, ultimoTurnoProcessado: identidadeTurno };
      const instanciaAtualizada = InstanciaInvocacaoSchema.parse({
        ...instanciaComEconomiaReset,
        version: instanciaComEconomiaReset.version + 1,
        ...(turno.acordou ? { hpAtual: turno.pvDespertar!, hpMaximoAtual: turno.pvDespertar!, estado: 'ativa' as const } : {}),
        estadoMahoraga,
      });
      gravarInstancia(personagem, instanciaAtualizada);
      useMapStore.getState().updateEntity(token.id, {
        hp: instanciaAtualizada.hpAtual,
        hpMax: instanciaAtualizada.hpMaximoAtual,
        invocationState: instanciaAtualizada.estado,
      });
      if (turno.acordou) {
        useLogStore.getState().addLog('combat', `☸️ ${modelo.nome} desperta no Estágio ${estadoMahoraga.estagioVida} com ${instanciaAtualizada.hpAtual} PV no início do turno do Controlador.`);
      }
      if (vontade.iniciou) {
        useLogStore.getState().addLog('combat', `☸️ Vontade Divina: ${modelo.nome} entra em Máquina por ${estadoMahoraga.vontadeDivina?.rodadasTotais ?? 1} rodada(s); prioridade inicial: última ordem do Controlador.`);
      }
      if (vontade.terminou) {
        useLogStore.getState().addLog('combat', `☸️ Vontade Divina: a duração de Máquina de ${modelo.nome} terminou.`);
      }
      for (const adaptacao of estadoMahoraga.adaptacoesCondicoes) {
        const anterior = estadoBase.adaptacoesCondicoes.find(item => normalizarCondicaoInvocacao(item.conditionId) === normalizarCondicaoInvocacao(adaptacao.conditionId));
        if (adaptacao.condicaoAtiva && adaptacao.bonusTRConsecutivo > (anterior?.bonusTRConsecutivo ?? 0)) {
          useLogStore.getState().addLog('combat', `☸️ Mahoraga adapta-se à condição ${adaptacao.nome}: +${adaptacao.bonusTRConsecutivo} cumulativo em TR após ${adaptacao.rodadasConsecutivas} rodada(s).`);
        } else if (!adaptacao.condicaoAtiva && (anterior?.condicaoAtiva ?? false) && adaptacao.bonusTRPermanente > 0) {
          useLogStore.getState().addLog('combat', `☸️ Mahoraga superou ${adaptacao.nome}: resistência permanente de +${adaptacao.bonusTRPermanente} em TR contra essa condição.`);
        }
      }
      for (const nome of turno.girados) {
        useLogStore.getState().addLog('combat', `☸️ Roda de Dharma: giro automático para ${nome} (${turno.estado.fenomenos.find(item => item.nome === nome)?.giros ?? 0}/5).`);
      }
      for (const nome of turno.expirados) {
        useLogStore.getState().addLog('combat', `☸️ Mahoraga: a redução de dano do 3º giro contra ${nome} expirou após 1 hora; a adaptação retorna ao 2º giro.`);
      }
    }
  }
});

/** API legada de posicionamento adjacente; a interface atual usa invocarControladores. */
export interface OpcoesInvocacaoControlador {
  motivoOverrideIntermediario?: string;
  /** Chave estável do pedido, reutilizada caso a mesma execução seja reenviada. */
  eventoId?: string;
}

export function invocarControlador(
  donoId: string,
  invocacaoId: string,
  direcao: DirecaoInvocacao,
  opcoes?: OpcoesInvocacaoControlador,
): ResultadoInvocacao {
  const cs = useCharacterStore.getState();
  const dono = cs.characters.find(c => c.id === donoId);
  if (!dono) return { ok: false, motivo: 'Personagem não encontrado.' };
  if (possuiTecnicaInataSuprimida(dono)) return { ok: false, motivo: 'Técnica Inata Suprimida: você não pode invocar ou comandar as Dez Sombras até o início do próximo turno.' };
  if (opcoes?.eventoId !== undefined && !opcoes.eventoId.trim()) {
    return { ok: false, motivo: 'O ID do evento de invocação está vazio.' };
  }
  const eventoId = opcoes?.eventoId?.trim() || novoIdInvocacao('evento');
  const mapa = useMapStore.getState();
  const eventoExistente = Object.values(mapa.entities).find(e => e.invocationEventId === eventoId || e.invocationBatchId === eventoId);
  if (eventoExistente) {
    if (eventoExistente.invocationBatchId === eventoId) return { ok: false, motivo: 'Este ID de evento já pertence a um lote de invocações.' };
    if (eventoExistente.ownerCharId === donoId && eventoExistente.invocationId === invocacaoId) {
      return { ok: true, tokenId: eventoExistente.id };
    }
    return { ok: false, motivo: 'Este ID de evento já pertence a outra invocação.' };
  }
  const instanciaRepetida = dono.instanciasInvocacao?.find(instancia => instancia.eventoCriacaoId === eventoId);
  if (instanciaRepetida) {
    if (instanciaRepetida.donoCharacterId !== donoId || instanciaRepetida.modeloId !== invocacaoId) {
      return { ok: false, motivo: 'Este ID de evento já pertence a outra invocação.' };
    }
    if (mapa.entities[instanciaRepetida.tokenId]) return { ok: true, tokenId: instanciaRepetida.tokenId };
    return { ok: false, motivo: 'Este evento já foi resolvido; ele não pode materializar uma segunda instância.' };
  }
  const modelo = dono.invocacoesConhecidas?.find(i => i.id === invocacaoId && i.donoCharacterId === donoId);
  if (!modelo) return { ok: false, motivo: 'Invocação não pertence ao catálogo.' };
  const fichaIncompleta = mensagemFichaDerivadaIncompleta(modelo);
  if (fichaIncompleta) return { ok: false, motivo: fichaIncompleta };
  const bloqueioDomesticao = mensagemDomesticaoPendente(modelo);
  if (bloqueioDomesticao) return { ok: false, motivo: bloqueioDomesticao };
  if (modeloVinculadoAHorda(dono, modelo.id)) return { ok: false, motivo: 'Esta invocação está vinculada a uma Horda e não pode ser invocada separadamente.' };
  if (modeloEmEsperaAposHorda(dono, modelo.id)) return { ok: false, motivo: 'Aguarde uma rodada após a saída deste membro da Horda.' };
  if (modelo.perdaPermanente) return { ok: false, motivo: 'Esta invocação foi declarada como perda permanente.' };
  if (dono.instanciasInvocacao?.some(instancia => instancia.modeloId === invocacaoId && instancia.estado === 'derrotada' && !instancia.resolucaoDerrota)) {
    return { ok: false, motivo: 'A derrota desta invocação aguarda decisão do Mestre.' };
  }
  if (!podeUsarVersaoAprovada({ estado: modelo.aprovacaoMestre, versaoAtual: modelo.versaoModelo, versaoAprovada: modelo.versaoAprovada })) return { ok: false, motivo: 'Esta versão da invocação ainda não foi aprovada pelo Mestre.' };
  const validacaoIntermediario = validarIntermediarioInvocacao(modelo, dono, useInventoryStore.getState().items, dono.invocacoesConhecidas ?? []);
  const motivoOverride = opcoes?.motivoOverrideIntermediario?.trim() ?? '';
  const overrideIntermediario = !validacaoIntermediario.ok && Boolean(motivoOverride);
  if (!validacaoIntermediario.ok && !motivoOverride) return { ok: false, motivo: validacaoIntermediario.motivo };
  if (overrideIntermediario && useRoleStore.getState().role !== 'MASTER') return { ok: false, motivo: 'Somente o Mestre pode ignorar a validação do intermediário.' };
  const tempoAdicional = tempoAdicionalEmSegundos(modelo.tempoAdicional);
  if (!tempoAdicional.ok) return { ok: false, motivo: tempoAdicional.motivo };

  const ativos = tokensInvocados(donoId);
  if (ativos.some(e => e.invocationId === invocacaoId)) return { ok: false, motivo: 'Essa invocação já está no mapa.' };
  if (ativos.reduce((total, token) => total + vagasInvocacaoEmCampo(token), 0) >= limiteAtivasPersonagem(dono.specialization, dono.treinoControle ?? 0)) return { ok: false, motivo: 'Limite de vagas de invocação ativas atingido.' };
  if (!Number.isFinite(modelo.custoInvocacaoPE) || modelo.custoInvocacaoPE < 0) return { ok: false, motivo: 'Custo de PE inválido.' };
  if ((dono.peCurrent ?? 0) < modelo.custoInvocacaoPE) return { ok: false, motivo: 'PE insuficiente.' };
  const origem = resolverTokenControladorDaFicha(dono, mapa.entities, mapa.layerVisible);
  if (!origem) return { ok: false, motivo: 'Coloque o token do Controlador no mapa primeiro.' };
  const passo = mapa.gridConfig.dpi;
  if (!(passo > 0) || !(mapa.gridConfig.metersPerCell > 0)) return { ok: false, motivo: 'Grade do mapa inválida.' };
  const direcoes: Record<DirecaoInvocacao, [number, number]> = {
    norte: [0, -1], sul: [0, 1], leste: [1, 0], oeste: [-1, 0],
  };
  const deslocamento = direcoes[direcao];
  if (!deslocamento) return { ok: false, motivo: 'Direção inválida.' };
  const x = origem.x + passo * deslocamento[0];
  const y = origem.y + passo * deslocamento[1];
  const alcance = alcancePosicionamentoInvocacao(modelo);
  if (!Number.isFinite(alcance) || (alcance ?? -1) < 0) return { ok: false, motivo: 'Defina o alcance de posicionamento na ficha antes de invocar.' };
  const distanciaM = Math.hypot(x - origem.x, y - origem.y) / passo * mapa.gridConfig.metersPerCell;
  if (distanciaM > alcance!) return { ok: false, motivo: 'A célula escolhida está fora do alcance de posicionamento.' };
  const ocupado = Object.values(mapa.entities).some(e => e.layer !== 'map' && !e.hidden &&
    Math.abs(e.x - x) < (e.w + passo) / 2 && Math.abs(e.y - y) < (e.h + passo) / 2);
  if (ocupado) return { ok: false, motivo: 'A célula escolhida está ocupada.' };
  const paredesAtivas = WallsEngine.blockingSegments(mapa.walls, 'sight');
  if (WallsEngine.minDistanceToSegments({ x, y }, paredesAtivas) < passo * Math.SQRT1_2) return { ok: false, motivo: 'A célula escolhida está bloqueada por uma parede ou obstáculo.' };

  useCombatStore.getState().settleTurnTimer();
  const donoAtual = useCharacterStore.getState().characters.find(c => c.id === donoId);
  if (!donoAtual) return { ok: false, motivo: 'Personagem não encontrado.' };
  const instanciaId = novoIdInvocacao('instancia');
  const tokenId = novoIdInvocacao('token');
  const peAntes = Number.isFinite(donoAtual.peCurrent) ? donoAtual.peCurrent : 0;
  if (peAntes < modelo.custoInvocacaoPE) return { ok: false, motivo: 'PE insuficiente.' };
  const combat = useCombatStore.getState();
  const contribuicaoResult = criarContribuicaoTempoInvocacao({
    grantEventId: eventoId,
    ownerCharacterId: donoId,
    ...(combat.inCombat && combat.combatId ? { combatId: combat.combatId } : {}),
    instanceId: instanciaId,
    invocationId: modelo.id,
    tempoAdicional: modelo.tempoAdicional,
  });
  if (!contribuicaoResult.ok) return { ok: false, motivo: contribuicaoResult.motivo };
  const contribuicaoTempo = contribuicaoResult.contribuicao;
  const celulasFuga = modelo.subcategoria === 'dez-sombras:fuga-do-coelho'
    ? celulasFugaCoelhosPorPorte(modelo.porte)
    : 1;
  try {
    mapa.addEntity({
      id: tokenId,
      ...aparenciaTokenInvocacao(modelo),
      shape: modelo.subcategoria === 'dez-sombras:fuga-do-coelho' ? 'RECT' : modelo.formaToken ?? 'ELLIPSE',
      x, y, w: passo * celulasFuga, h: passo * celulasFuga, rotation: 0,
      locked: false, layer: 'tokens',
      hp: modelo.hpAtual, hpMax: modelo.hpMaximo, ownerCharId: donoId,
      ownerProfileId: dono.profileId || undefined, invocationId: modelo.id,
      invocationEventId: eventoId, invocationInstanceId: instanciaId,
      invocationState: modelo.hpAtual > 0 ? 'ativa' : 'caida',
      invocationDefense: modelo.defesa, invocationMovementM: modelo.deslocamentoM,
      invocationEffectiveSize: modelo.tamanho ?? modelo.porte,
      ...(modelo.subcategoria === 'dez-sombras:fuga-do-coelho' ? { invocationEffectiveSizeCategory: celulasFuga + 1 } : {}),
      ...(modelo.subcategoria === 'dez-sombras:nue' ? { invocationMovementMode: 'voo' as const } : {}),
    });
    const instancia = novaInstanciaInvocacao({
      id: instanciaId,
      modeloId: modelo.id,
      donoCharacterId: donoId,
      donoProfileId: dono.profileId || undefined,
      tokenId,
      eventoCriacaoId: eventoId,
      hpAtual: modelo.hpAtual,
      hpMaximoAtual: modelo.hpMaximo,
      economiaAcoes: economiaInicialInvocacao(modelo),
      recursosAtuais: recursosInvocacaoIniciais(modelo),
      ...(modelo.subcategoria === 'dez-sombras:mahoraga' ? {
        estadoMahoraga: estadoInicialMahoraga(combat.inCombat ? combat.combatId ?? undefined : undefined),
      } : {}),
      ...(modelo.subcategoria === TIGRE_FUNEBRE_SUBCATEGORIA ? {
        estadoTigreFunebre: estadoInicialTigreFunebre(combat.inCombat ? combat.combatId ?? undefined : undefined),
      } : {}),
      ...(combat.inCombat && combat.combatId ? { combateId: combat.combatId } : {}),
      ...(combat.inCombat ? { turnoCriacao: combat.currentTurnIndex, rodadaCriacao: combat.round } : {}),
      ...(contribuicaoTempo ? { contribuicaoTempo } : {}),
    });
    cs.updateCharacter(donoId, {
      peCurrent: peAntes - modelo.custoInvocacaoPE,
      instanciasInvocacao: [...(donoAtual.instanciasInvocacao ?? []), instancia],
    });
  } catch {
    try {
      if (useMapStore.getState().entities[tokenId]) useMapStore.getState().removeEntities([tokenId]);
    } catch { /* mantém a falha original; compensação best-effort */ }
    try {
      const donoDepoisFalha = useCharacterStore.getState().characters.find(c => c.id === donoId);
      if (donoDepoisFalha && donoDepoisFalha.peCurrent === peAntes - modelo.custoInvocacaoPE) {
        useCharacterStore.getState().updateCharacter(donoId, {
          peCurrent: peAntes,
          instanciasInvocacao: donoAtual.instanciasInvocacao,
        });
      }
    } catch { /* mantém a falha original; compensação best-effort */ }
    return { ok: false, motivo: 'Não foi possível concluir a invocação; os efeitos locais foram desfeitos.' };
  }
  if (contribuicaoTempo) {
    const segundosAplicados = useCombatStore.getState().registerInvocationTimeGrant(
      donoId,
      contribuicaoTempo.grantEventId,
      contribuicaoTempo.quantidadeConcedida,
    );
    try {
      useLogStore.getState().addLog(
        'combat',
        `⏱️ ${modelo.apelido?.trim() || modelo.nome}: +${formatarSegundosTempoInvocacao(contribuicaoTempo.quantidadeConcedida)} s de tempo adicional.`,
        segundosAplicados > 0
          ? `Reserva individual de ${modelo.nome} adicionada ao relógio do turno do dono.`
          : `Reserva individual de ${modelo.nome} registrada para o próximo turno do dono.`,
      );
    } catch { /* o log não desfaz uma invocação já materializada */ }
  }
  if (overrideIntermediario) {
    useLogStore.getState().addLog(
      'system',
      'Override do Mestre: ' + dono.name + ' invocou ' + modelo.nome + ' sem intermediário validado. Motivo: ' + motivoOverride,
      'O Mestre autorizou a invocação de ' + modelo.nome + ' com override do intermediário.',
    );
  }
  return { ok: true, tokenId };
}

/** Materializa uma Horda como uma única instância/token e acrescenta uma única contribuição temporal. */
export function invocarHordaControlador(
  donoId: string,
  entrada: EntradaCriacaoHorda,
): ResultadoInvocacao {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  if (!dono) return { ok: false, motivo: 'Personagem não encontrado.' };
  if (possuiTecnicaInataSuprimida(dono)) return { ok: false, motivo: 'Técnica Inata Suprimida: você não pode criar uma Horda até o início do próximo turno.' };
  if (dono.specialization !== 'Controlador') return { ok: false, motivo: 'Somente um Controlador pode criar Hordas.' };
  if (entrada.eventoId !== undefined && !entrada.eventoId.trim()) return { ok: false, motivo: 'O ID do evento da Horda está vazio.' };
  if (!entrada.liderId.trim() || entrada.membrosIds.length < 1) {
    return { ok: false, motivo: 'Escolha um líder e pelo menos um membro para a Horda.' };
  }
  const eventoId = entrada.eventoId?.trim() || novoIdInvocacao('evento-horda');
  const ids = [entrada.liderId, ...entrada.membrosIds];
  if (new Set(ids).size !== ids.length) return { ok: false, motivo: 'O líder e os membros precisam ser invocações diferentes.' };

  const mapa = useMapStore.getState();
  const eventoExistente = Object.values(mapa.entities).find(entity => entity.invocationEventId === eventoId);
  if (eventoExistente) {
    const mesmosMembros = [...(eventoExistente.invocationHordeMemberIds ?? [])].sort().join('|') === [...entrada.membrosIds].sort().join('|');
    if (eventoExistente.ownerCharId === donoId && eventoExistente.invocationHordeId &&
      eventoExistente.invocationId === entrada.liderId && mesmosMembros) {
      return { ok: true, tokenId: eventoExistente.id };
    }
    return { ok: false, motivo: 'Este ID de evento já pertence a outra materialização.' };
  }
  if (dono.instanciasInvocacao?.some(instancia => instancia.eventoCriacaoId === eventoId)) {
    return { ok: false, motivo: 'Este evento já foi resolvido e não pode criar outra Horda.' };
  }

  const modelos = ids.map(id => dono.invocacoesConhecidas?.find(modelo => modelo.id === id && modelo.donoCharacterId === donoId));
  if (modelos.some(modelo => !modelo)) return { ok: false, motivo: 'O líder e todos os membros precisam pertencer ao catálogo deste Controlador.' };
  const modelosValidos = modelos as InvocacaoControlador[];
  for (const modelo of modelosValidos) {
    const fichaIncompleta = mensagemFichaDerivadaIncompleta(modelo);
    if (fichaIncompleta) return { ok: false, motivo: fichaIncompleta };
    const bloqueioDomesticao = mensagemDomesticaoPendente(modelo);
    if (bloqueioDomesticao) return { ok: false, motivo: bloqueioDomesticao };
    if (modeloVinculadoAHorda(dono, modelo.id)) return { ok: false, motivo: `${modelo.nome} já está vinculada a outra Horda.` };
    if (modeloEmEsperaAposHorda(dono, modelo.id)) return { ok: false, motivo: 'Aguarde uma rodada após a saída deste membro da Horda.' };
    if (modelo.perdaPermanente) return { ok: false, motivo: `${modelo.nome} foi declarada como perda permanente.` };
    if (dono.instanciasInvocacao?.some(instancia => instancia.modeloId === modelo.id && instancia.estado === 'derrotada' && !instancia.resolucaoDerrota)) {
      return { ok: false, motivo: `A derrota de ${modelo.nome} aguarda decisão do Mestre.` };
    }
    if (!podeUsarVersaoAprovada({ estado: modelo.aprovacaoMestre, versaoAtual: modelo.versaoModelo, versaoAprovada: modelo.versaoAprovada })) {
      return { ok: false, motivo: `${modelo.nome} ainda não tem uma versão aprovada pelo Mestre.` };
    }
    if (tokensInvocados(donoId).some(token => token.invocationId === modelo.id)) {
      return { ok: false, motivo: `${modelo.nome} já está materializada; recolha-a antes de formar a Horda.` };
    }
  }

  const grausValidos: GrauHorda[] = ['quarto', 'terceiro', 'segundo', 'primeiro', 'especial'];
  const componentes = modelosValidos.map(modelo => {
    const grau = grausValidos.includes(modelo.grau as GrauHorda) ? modelo.grau as GrauHorda : undefined;
    if (!grau) return undefined;
    return {
      id: modelo.id,
      grau,
      pvAtual: modelo.hpAtual,
      pvMaximo: modelo.hpMaximo,
      custoInvocacaoPE: modelo.custoInvocacaoPE,
    };
  });
  if (componentes.some(componente => !componente)) return { ok: false, motivo: 'Defina o grau e os PV de todos os integrantes antes de formar a Horda.' };

  const [liderModelo, ...membrosModelos] = modelosValidos;
  const [liderComponente, ...membrosComponentes] = componentes as NonNullable<(typeof componentes)[number]>[];
  const limite = limiteAtivasPersonagem(dono.specialization, dono.treinoControle ?? 0);
  const hordaAtual = calcularHorda({
    id: 'horda-preview',
    lider: liderComponente,
    membros: membrosComponentes,
    nivelDono: dono.level,
    maximoInvocacoesEmCampo: limite,
    tempoAdicional: entrada.tempoAdicional,
  });
  if (!hordaAtual.ok) return { ok: false, motivo: hordaAtual.motivo };
  const ativos = tokensInvocados(donoId);
  const hordasAtivas = ativos.filter(token => Boolean(token.invocationHordeId)).length;
  const vagasHordasAtivas = ativos.filter(token => Boolean(token.invocationHordeId))
    .reduce((total, token) => total + vagasInvocacaoEmCampo(token), 0);
  const limiteHordas = validarLimiteHorda({
    limiteInvocacoesEmCampo: limite,
    hordasAtivas,
    invocacoesIndividuaisAposCriacao: ativos.filter(token => !token.invocationHordeId).length,
    vagasOcupadasPorHordas: vagasHordasAtivas,
    vagasNovaHorda: hordaAtual.horda.vagasInvocacao,
  });
  if (!limiteHordas.ok) return { ok: false, motivo: limiteHordas.motivo };
  const tempoValidado = tempoAdicionalEmSegundos(entrada.tempoAdicional);
  if (!tempoValidado.ok) return { ok: false, motivo: tempoValidado.motivo };

  const motivosOverride: Array<{ modelo: InvocacaoControlador; motivo: string }> = [];
  for (const modelo of modelosValidos) {
    const validacao = validarIntermediarioInvocacao(modelo, dono, useInventoryStore.getState().items, dono.invocacoesConhecidas ?? []);
    const motivo = entrada.motivosOverrideIntermediario?.[modelo.id]?.trim() ?? '';
    if (!validacao.ok && !motivo) return { ok: false, motivo: `${modelo.nome}: ${validacao.motivo}` };
    if (!validacao.ok && motivo && useRoleStore.getState().role !== 'MASTER') {
      return { ok: false, motivo: 'Somente o Mestre pode ignorar a validação do intermediário.' };
    }
    if (!validacao.ok && motivo) motivosOverride.push({ modelo, motivo });
    if (modelo.id === liderModelo.id && (!Number.isFinite(alcancePosicionamentoInvocacao(modelo)) || alcancePosicionamentoInvocacao(modelo) < 0)) {
      return { ok: false, motivo: `Defina o alcance de invocação na ficha ${modelo.nome}.` };
    }
  }

  const origem = resolverTokenControladorDaFicha(dono, mapa.entities, mapa.layerVisible);
  if (!origem) return { ok: false, motivo: 'Coloque o token do Controlador no mapa primeiro.' };
  const passo = mapa.gridConfig.dpi;
  const metrosPorCelula = mapa.gridConfig.metersPerCell;
  if (!(passo > 0) || !(metrosPorCelula > 0)) return { ok: false, motivo: 'Grade do mapa inválida.' };
  if (!Number.isFinite(entrada.x) || !Number.isFinite(entrada.y) ||
    Math.abs(entrada.x / passo - Math.round(entrada.x / passo)) > 1e-6 ||
    Math.abs(entrada.y / passo - Math.round(entrada.y / passo)) > 1e-6) {
    return { ok: false, motivo: 'Escolha uma célula válida da grade para a Horda.' };
  }
  const distancia = Math.hypot(entrada.x - origem.x, entrada.y - origem.y) / passo * metrosPorCelula;
  if (distancia > alcancePosicionamentoInvocacao(liderModelo)) return { ok: false, motivo: 'A posição da Horda está fora do alcance definido na ficha do líder.' };
  const ocupado = Object.values(mapa.entities).some(entity => entity.layer !== 'map' && !entity.hidden &&
    Math.abs(entity.x - entrada.x) < (entity.w + passo) / 2 && Math.abs(entity.y - entrada.y) < (entity.h + passo) / 2);
  if (ocupado) return { ok: false, motivo: 'A célula escolhida para a Horda está ocupada.' };
  const paredesAtivas = WallsEngine.blockingSegments(mapa.walls, 'sight');
  if (WallsEngine.minDistanceToSegments({ x: entrada.x, y: entrada.y }, paredesAtivas) < passo * Math.SQRT1_2) {
    return { ok: false, motivo: 'A célula escolhida para a Horda está bloqueada por uma parede ou obstáculo.' };
  }

  useCombatStore.getState().settleTurnTimer();
  const donoAtual = useCharacterStore.getState().characters.find(character => character.id === donoId);
  if (!donoAtual) return { ok: false, motivo: 'Personagem não encontrado.' };
  const peAntes = Number.isFinite(donoAtual.peCurrent) ? donoAtual.peCurrent : 0;
  if (peAntes < hordaAtual.horda.custoInvocacaoPE) return { ok: false, motivo: 'PE insuficiente para formar esta Horda.' };
  const combate = useCombatStore.getState();
  const instanciaId = novoIdInvocacao('instancia-horda');
  const tokenId = novoIdInvocacao('token-horda');
  const hordaId = novoIdInvocacao('horda');
  const contribuicaoResult = criarContribuicaoTempoInvocacao({
    grantEventId: eventoId,
    ownerCharacterId: donoId,
    ...(combate.inCombat && combate.combatId ? { combatId: combate.combatId } : {}),
    instanceId: instanciaId,
    invocationId: liderModelo.id,
    tempoAdicional: entrada.tempoAdicional,
  });
  if (!contribuicaoResult.ok) return { ok: false, motivo: contribuicaoResult.motivo };
  const contribuicaoTempo = contribuicaoResult.contribuicao;
  const composicaoHorda = {
    id: hordaId,
    liderModeloId: liderModelo.id,
    membros: membrosModelos.map((modelo, index) => ({
      modeloId: modelo.id,
      grau: membrosComponentes[index].grau,
      pvAntes: modelo.hpAtual,
      pvMaximoAntes: modelo.hpMaximo,
      ordemEntrada: index,
    })),
    tempoAdicional: entrada.tempoAdicional,
    custoInvocacaoPE: hordaAtual.horda.custoInvocacaoPE,
    categoriasTamanhoAdicionais: hordaAtual.horda.efeitos.categoriasTamanhoAdicionais,
    usosAntesPrejuizoMultiplo: hordaAtual.horda.efeitos.usosAntesPrejuizoMultiplo,
  };
  const instancia = novaInstanciaInvocacao({
    id: instanciaId,
    modeloId: liderModelo.id,
    donoCharacterId: donoId,
    donoProfileId: dono.profileId || undefined,
    tokenId,
    eventoCriacaoId: eventoId,
    hpAtual: hordaAtual.horda.pvAtual,
    hpMaximoAtual: hordaAtual.horda.pvMaximo,
    estado: hordaAtual.horda.pvAtual > 0 ? 'ativa' : 'caida',
    economiaAcoes: economiaInicialInvocacao(liderModelo),
    recursosAtuais: recursosInvocacaoIniciais(liderModelo),
    ...(combate.inCombat && combate.combatId ? { combateId: combate.combatId } : {}),
    ...(combate.inCombat ? { turnoCriacao: combate.currentTurnIndex, rodadaCriacao: combate.round } : {}),
    ...(contribuicaoTempo ? { contribuicaoTempo } : {}),
    composicaoHorda,
  });
  try {
    mapa.addEntity({
      id: tokenId,
      ...aparenciaTokenInvocacao(liderModelo),
      x: entrada.x, y: entrada.y, w: passo, h: passo, rotation: 0,
      label: `Horda de ${liderModelo.apelido?.trim() || liderModelo.nome}`,
      locked: false, layer: 'tokens',
      hp: hordaAtual.horda.pvAtual, hpMax: hordaAtual.horda.pvMaximo,
      ownerCharId: donoId, ownerProfileId: dono.profileId || undefined, invocationId: liderModelo.id,
      invocationEventId: eventoId, invocationInstanceId: instanciaId,
      invocationState: instancia.estado,
      invocationDefense: liderModelo.defesa, invocationMovementM: liderModelo.deslocamentoM,
      invocationEffectiveSize: liderModelo.tamanho ?? liderModelo.porte,
      ...(liderModelo.subcategoria === 'dez-sombras:nue' ? { invocationMovementMode: 'voo' as const } : {}),
      invocationHordeId: hordaId,
      invocationHordeMemberIds: [...entrada.membrosIds],
      invocationHordeSizeIncreases: hordaAtual.horda.efeitos.categoriasTamanhoAdicionais,
    });
    useCharacterStore.getState().updateCharacter(donoId, {
      peCurrent: peAntes - hordaAtual.horda.custoInvocacaoPE,
      instanciasInvocacao: [...(donoAtual.instanciasInvocacao ?? []), instancia],
    });
  } catch {
    try { if (useMapStore.getState().entities[tokenId]) useMapStore.getState().removeEntities([tokenId]); } catch { /* rollback best-effort */ }
    try {
      const atual = useCharacterStore.getState().characters.find(character => character.id === donoId);
      if (atual && atual.peCurrent === peAntes - hordaAtual.horda.custoInvocacaoPE) {
        useCharacterStore.getState().updateCharacter(donoId, { peCurrent: peAntes, instanciasInvocacao: donoAtual.instanciasInvocacao });
      }
    } catch { /* rollback best-effort */ }
    return { ok: false, motivo: 'Não foi possível concluir a Horda; os efeitos locais foram desfeitos.' };
  }
  if (contribuicaoTempo) {
    const segundosAplicados = useCombatStore.getState().registerInvocationTimeGrant(
      donoId,
      contribuicaoTempo.grantEventId,
      contribuicaoTempo.quantidadeConcedida,
    );
    try {
      useLogStore.getState().addLog(
        'combat',
        `⏱️ Horda de ${liderModelo.apelido?.trim() || liderModelo.nome}: +${formatarSegundosTempoInvocacao(contribuicaoTempo.quantidadeConcedida)} s ao relógio global.`,
        segundosAplicados > 0 ? 'Uma única contribuição temporal foi registrada para a Horda.' : 'Uma única contribuição temporal foi registrada para a Horda, para o próximo turno do dono.',
      );
    } catch { /* o log não desfaz a Horda */ }
  }
  for (const { modelo, motivo } of motivosOverride) {
    useLogStore.getState().addLog('system', `Override do Mestre: ${dono.name} criou uma Horda com ${modelo.nome}. Motivo: ${motivo}`,
      `O Mestre autorizou a exceção do intermediário para ${modelo.nome} nesta Horda.`);
  }
  return { ok: true, tokenId };
}

/** Invocar é Ação Livre por enquanto; valida e materializa uma ou duas fichas em uma transação local idempotente. */
export function invocarControladores(
  donoId: string,
  posicoes: readonly PosicaoInvocacao[],
  opcoes?: { eventoId?: string; motivosOverrideIntermediario?: Record<string, string> },
): ResultadoLoteInvocacoes {
  if (posicoes.length < 1 || posicoes.length > 2) return { ok: false, motivo: 'Um uso permite posicionar uma ou duas invocações.' };
  const ids = posicoes.map(posicao => posicao.invocacaoId);
  if (new Set(ids).size !== ids.length) return { ok: false, motivo: 'Selecione invocações diferentes.' };
  const cs = useCharacterStore.getState();
  const dono = cs.characters.find(character => character.id === donoId);
  if (!dono) return { ok: false, motivo: 'Personagem não encontrado.' };
  if (opcoes?.eventoId !== undefined && !opcoes.eventoId.trim()) return { ok: false, motivo: 'O ID do evento de invocação está vazio.' };
  const eventoId = opcoes?.eventoId?.trim() || novoIdInvocacao('evento');
  const mapa = useMapStore.getState();
  const associadasAoEvento = Object.values(mapa.entities).filter(entity =>
    entity.invocationBatchId === eventoId || entity.invocationEventId === eventoId,
  );
  if (associadasAoEvento.some(entity => entity.invocationBatchId === eventoId)) {
    const porInvocacao = new Map(associadasAoEvento.filter(entity => entity.invocationBatchId === eventoId).map(entity => [entity.invocationId, entity]));
    if (associadasAoEvento.some(entity => entity.invocationBatchId !== eventoId) ||
      posicoes.some(posicao => {
        const entity = porInvocacao.get(posicao.invocacaoId);
        return !entity || entity.ownerCharId !== donoId;
      }) || porInvocacao.size !== posicoes.length) {
      return { ok: false, motivo: 'Este ID de evento já pertence a outro lote de invocações.' };
    }
    return { ok: true, tokenIds: posicoes.map(posicao => porInvocacao.get(posicao.invocacaoId)!.id) };
  }
  if (associadasAoEvento.length) return { ok: false, motivo: 'Este ID de evento já pertence a outra invocação.' };

  const eventosEsperados = new Set(ids.map(id => eventoId + ':' + id));
  const instanciasRepetidas = (dono.instanciasInvocacao ?? []).filter(instancia =>
    instancia.eventoCriacaoId && eventosEsperados.has(instancia.eventoCriacaoId),
  );
  if (instanciasRepetidas.length) {
    const mesmasInvocacoes = instanciasRepetidas.length === ids.length && ids.every(id =>
      instanciasRepetidas.some(instancia => instancia.donoCharacterId === donoId &&
        instancia.modeloId === id && instancia.eventoCriacaoId === eventoId + ':' + id),
    );
    if (!mesmasInvocacoes) return { ok: false, motivo: 'Este ID de evento já pertence a outro lote de invocações.' };
    const tokensExistentes = ids.map(id => {
      const instancia = instanciasRepetidas.find(item => item.modeloId === id)!;
      return mapa.entities[instancia.tokenId];
    });
    if (tokensExistentes.every(Boolean)) return { ok: true, tokenIds: tokensExistentes.map(token => token!.id) };
    return { ok: false, motivo: 'Este lote já foi resolvido; ele não pode materializar novas instâncias.' };
  }

  const modelos = ids.map(id => dono.invocacoesConhecidas?.find(modelo => modelo.id === id && modelo.donoCharacterId === donoId));
  if (modelos.some(modelo => !modelo)) return { ok: false, motivo: 'Uma das invocações não pertence ao catálogo.' };
  const modelosValidos = modelos as InvocacaoControlador[];
  const validacoesOverride: Array<{ modelo: InvocacaoControlador; motivo: string; override: boolean }> = [];
  for (const modelo of modelosValidos) {
    const fichaIncompleta = mensagemFichaDerivadaIncompleta(modelo);
    if (fichaIncompleta) return { ok: false, motivo: fichaIncompleta };
    const bloqueioDomesticao = mensagemDomesticaoPendente(modelo);
    if (bloqueioDomesticao) return { ok: false, motivo: bloqueioDomesticao };
    if (modeloVinculadoAHorda(dono, modelo.id)) return { ok: false, motivo: `${modelo.nome} já está vinculada a uma Horda.` };
    if (modeloEmEsperaAposHorda(dono, modelo.id)) return { ok: false, motivo: 'Aguarde uma rodada após a saída deste membro da Horda.' };
    if (modelo.perdaPermanente) return { ok: false, motivo: 'A invocação ' + modelo.nome + ' foi declarada como perda permanente.' };
    if (dono.instanciasInvocacao?.some(instancia => instancia.modeloId === modelo.id && instancia.estado === 'derrotada' && !instancia.resolucaoDerrota)) {
      return { ok: false, motivo: 'A derrota de ' + modelo.nome + ' aguarda decisão do Mestre.' };
    }
    if (!podeUsarVersaoAprovada({ estado: modelo.aprovacaoMestre, versaoAtual: modelo.versaoModelo, versaoAprovada: modelo.versaoAprovada })) {
      return { ok: false, motivo: 'A invocação ' + modelo.nome + ' ainda não foi aprovada pelo Mestre.' };
    }
    const validacao = validarIntermediarioInvocacao(modelo, dono, useInventoryStore.getState().items, dono.invocacoesConhecidas ?? []);
    const motivo = opcoes?.motivosOverrideIntermediario?.[modelo.id]?.trim() ?? '';
    const override = !validacao.ok && Boolean(motivo);
    if (!validacao.ok && !motivo) return { ok: false, motivo: validacao.motivo };
    if (override && useRoleStore.getState().role !== 'MASTER') return { ok: false, motivo: 'Somente o Mestre pode ignorar a validação do intermediário.' };
    const tempoAdicional = tempoAdicionalEmSegundos(modelo.tempoAdicional);
    if (!tempoAdicional.ok) return { ok: false, motivo: modelo.nome + ': ' + tempoAdicional.motivo };
    const alcance = alcancePosicionamentoInvocacao(modelo);
    if (!Number.isFinite(alcance) || (alcance ?? -1) < 0) return { ok: false, motivo: 'Defina o alcance de posicionamento na ficha ' + modelo.nome + ' antes de invocar.' };
    if (!Number.isFinite(modelo.custoInvocacaoPE) || modelo.custoInvocacaoPE < 0) return { ok: false, motivo: 'Custo de PE inválido para ' + modelo.nome + '.' };
    validacoesOverride.push({ modelo, motivo, override });
  }

  // Uma instância Caída continua no campo e ocupa o limite simultâneo.
  const ativos = tokensInvocados(donoId);
  if (ids.some(id => ativos.some(token => token.invocationId === id))) return { ok: false, motivo: 'Uma das invocações selecionadas já está no mapa.' };
  const limite = limiteAtivasPersonagem(dono.specialization, dono.treinoControle ?? 0);
  const vagasAtivas = ativos.reduce((total, token) => total + vagasInvocacaoEmCampo(token), 0);
  if (vagasAtivas + posicoes.length > limite) return { ok: false, motivo: 'O lote ultrapassa o limite de vagas de invocação ativas.' };
  const custoTotal = modelosValidos.reduce((total, modelo) => total + modelo.custoInvocacaoPE, 0);

  const origem = resolverTokenControladorDaFicha(dono, mapa.entities, mapa.layerVisible);
  if (!origem) return { ok: false, motivo: 'Coloque o token do Controlador no mapa primeiro.' };
  const passo = mapa.gridConfig.dpi;
  const metrosPorCelula = mapa.gridConfig.metersPerCell;
  if (!(passo > 0) || !(metrosPorCelula > 0)) return { ok: false, motivo: 'Grade do mapa inválida.' };
  const paredesAtivas = WallsEngine.blockingSegments(mapa.walls, 'sight');
  const alvos: Array<{ modelo: InvocacaoControlador; x: number; y: number }> = [];
  for (const posicao of posicoes) {
    const modelo = modelosValidos.find(item => item.id === posicao.invocacaoId)!;
    if (!Number.isFinite(posicao.x) || !Number.isFinite(posicao.y) ||
      Math.abs(posicao.x / passo - Math.round(posicao.x / passo)) > 1e-6 ||
      Math.abs(posicao.y / passo - Math.round(posicao.y / passo)) > 1e-6) {
      return { ok: false, motivo: 'Escolha uma célula válida da grade para ' + modelo.nome + '.' };
    }
    const distanciaM = Math.hypot(posicao.x - origem.x, posicao.y - origem.y) / passo * metrosPorCelula;
    if (distanciaM > alcancePosicionamentoInvocacao(modelo)) return { ok: false, motivo: 'A posição de ' + modelo.nome + ' está fora do alcance definido na ficha.' };
    const ocupado = Object.values(mapa.entities).some(entity => entity.layer !== 'map' && !entity.hidden &&
      Math.abs(entity.x - posicao.x) < (entity.w + passo) / 2 && Math.abs(entity.y - posicao.y) < (entity.h + passo) / 2);
    if (ocupado) return { ok: false, motivo: 'A célula escolhida para ' + modelo.nome + ' está ocupada.' };
    if (alvos.some(alvo => Math.abs(alvo.x - posicao.x) < passo * 0.45 && Math.abs(alvo.y - posicao.y) < passo * 0.45)) {
      return { ok: false, motivo: 'As invocações precisam ocupar células diferentes.' };
    }
    if (WallsEngine.minDistanceToSegments({ x: posicao.x, y: posicao.y }, paredesAtivas) < passo * Math.SQRT1_2) {
      return { ok: false, motivo: 'A célula escolhida para ' + modelo.nome + ' está bloqueada por uma parede ou obstáculo.' };
    }
    alvos.push({ modelo, x: posicao.x, y: posicao.y });
  }

  useCombatStore.getState().settleTurnTimer();
  const donoAtual = useCharacterStore.getState().characters.find(character => character.id === donoId);
  if (!donoAtual) return { ok: false, motivo: 'Personagem não encontrado.' };
  const peAntes = Number.isFinite(donoAtual.peCurrent) ? donoAtual.peCurrent : 0;
  if (peAntes < custoTotal) return { ok: false, motivo: 'PE insuficiente para o lote selecionado.' };
  const combat = useCombatStore.getState();

  const criados: string[] = [];
  const instanciasCriadas: InstanciaInvocacao[] = [];
  try {
    for (const { modelo, x, y } of alvos) {
      const tokenId = novoIdInvocacao('token');
      const instanciaId = novoIdInvocacao('instancia');
      criados.push(tokenId);
      const eventoDaInstancia = eventoId + ':' + modelo.id;
      const celulasFuga = modelo.subcategoria === 'dez-sombras:fuga-do-coelho'
        ? celulasFugaCoelhosPorPorte(modelo.porte)
        : 1;
      const contribuicaoResult = criarContribuicaoTempoInvocacao({
        grantEventId: eventoDaInstancia,
        ownerCharacterId: donoId,
        ...(combat.inCombat && combat.combatId ? { combatId: combat.combatId } : {}),
        instanceId: instanciaId,
        invocationId: modelo.id,
        tempoAdicional: modelo.tempoAdicional,
      });
      if (!contribuicaoResult.ok) throw new Error(contribuicaoResult.motivo);
      const contribuicaoTempo = contribuicaoResult.contribuicao;
      mapa.addEntity({
        id: tokenId,
        ...aparenciaTokenInvocacao(modelo),
        shape: modelo.subcategoria === 'dez-sombras:fuga-do-coelho' ? 'RECT' : modelo.formaToken ?? 'ELLIPSE',
        x, y, w: passo * celulasFuga, h: passo * celulasFuga, rotation: 0,
        locked: false, layer: 'tokens',
        hp: modelo.hpAtual, hpMax: modelo.hpMaximo, ownerCharId: donoId,
        ownerProfileId: dono.profileId || undefined, invocationId: modelo.id,
        invocationEventId: eventoDaInstancia, invocationBatchId: eventoId, invocationInstanceId: instanciaId,
        invocationState: modelo.hpAtual > 0 ? 'ativa' : 'caida',
        invocationDefense: modelo.defesa, invocationMovementM: modelo.deslocamentoM,
        invocationEffectiveSize: modelo.tamanho ?? modelo.porte,
        ...(modelo.subcategoria === 'dez-sombras:fuga-do-coelho' ? { invocationEffectiveSizeCategory: celulasFuga + 1 } : {}),
        ...(modelo.subcategoria === 'dez-sombras:nue' ? { invocationMovementMode: 'voo' as const } : {}),
      });
      instanciasCriadas.push(novaInstanciaInvocacao({
        id: instanciaId,
        modeloId: modelo.id,
        donoCharacterId: donoId,
        donoProfileId: dono.profileId || undefined,
        tokenId,
        eventoCriacaoId: eventoDaInstancia,
        hpAtual: modelo.hpAtual,
        hpMaximoAtual: modelo.hpMaximo,
        economiaAcoes: economiaInicialInvocacao(modelo),
        recursosAtuais: recursosInvocacaoIniciais(modelo),
        ...(modelo.subcategoria === 'dez-sombras:mahoraga' ? {
          estadoMahoraga: estadoInicialMahoraga(combat.inCombat ? combat.combatId ?? undefined : undefined),
        } : {}),
        ...(modelo.subcategoria === TIGRE_FUNEBRE_SUBCATEGORIA ? {
          estadoTigreFunebre: estadoInicialTigreFunebre(combat.inCombat ? combat.combatId ?? undefined : undefined),
        } : {}),
        ...(combat.inCombat && combat.combatId ? { combateId: combat.combatId } : {}),
        ...(combat.inCombat ? { turnoCriacao: combat.currentTurnIndex, rodadaCriacao: combat.round } : {}),
        ...(contribuicaoTempo ? { contribuicaoTempo } : {}),
      }));
    }
    cs.updateCharacter(donoId, {
      peCurrent: peAntes - custoTotal,
      instanciasInvocacao: [...(donoAtual.instanciasInvocacao ?? []), ...instanciasCriadas],
    });
  } catch {
    try { if (criados.length) useMapStore.getState().removeEntities(criados); } catch { /* rollback local best-effort */ }
    try {
      const donoDepoisFalha = useCharacterStore.getState().characters.find(character => character.id === donoId);
      if (donoDepoisFalha && donoDepoisFalha.peCurrent === peAntes - custoTotal) {
        useCharacterStore.getState().updateCharacter(donoId, {
          peCurrent: peAntes,
          instanciasInvocacao: donoAtual.instanciasInvocacao,
        });
      }
    } catch { /* rollback local best-effort */ }
    return { ok: false, motivo: 'Não foi possível concluir o lote; os efeitos locais foram desfeitos.' };
  }

  for (const instancia of instanciasCriadas) {
    const contribuicao = instancia.contribuicaoTempo;
    if (!contribuicao) continue;
    const segundosAplicados = useCombatStore.getState().registerInvocationTimeGrant(
      donoId,
      contribuicao.grantEventId,
      contribuicao.quantidadeConcedida,
    );
    const modelo = modelosValidos.find(item => item.id === instancia.modeloId);
    try {
      useLogStore.getState().addLog(
        'combat',
        `⏱️ ${modelo?.apelido?.trim() || modelo?.nome || instancia.modeloId}: +${formatarSegundosTempoInvocacao(contribuicao.quantidadeConcedida)} s de tempo adicional.`,
        segundosAplicados > 0
          ? `Reserva individual registrada no relógio do turno do dono (${instancia.id}).`
          : `Reserva individual registrada para o próximo turno do dono (${instancia.id}).`,
      );
    } catch { /* o log não desfaz um lote já materializado */ }
  }

  for (const { modelo, motivo, override } of validacoesOverride) {
    if (!override) continue;
    useLogStore.getState().addLog(
      'system',
      'Override do Mestre: ' + dono.name + ' invocou ' + modelo.nome + ' sem intermediário validado. Motivo: ' + motivo,
      'O Mestre autorizou a invocação de ' + modelo.nome + ' com override do intermediário.',
    );
  }
  return { ok: true, tokenIds: criados };
}

/** Recolhe um servo real sem reembolsar PE, conservando a instância como dissipada. */

export function recolherInvocacao(donoId: string, invocacaoId: string): boolean {
  const dono = useCharacterStore.getState().characters.find(c => c.id === donoId);
  if (!dono) return false;
  const mapa = useMapStore.getState();
  const tokens = Object.values(mapa.entities).filter(e => e.ownerCharId === donoId && e.invocationId === invocacaoId);
  if (!tokens.length) return false;
  const token = tokens[0];
  // Não descartar o único pool de PV sem a regra de retorno dos integrantes.
  if (token.invocationHordeId) return false;
  const modelo = obterModeloDoToken(dono, token);
  if (!modelo) return false;
  const instancia = obterInstanciaDoToken(dono, token, modelo);
  const combate = useCombatStore.getState();
  const validacaoDissipacao = validarDissipacaoVoluntaria({
    estado: instancia.estado,
    emCombate: combate.inCombat,
    turnoDoDono: combate.initiativeOrder[combate.currentTurnIndex]?.charId === donoId,
    rodadaAtual: combate.round,
    rodadaCriacao: instancia.rodadaCriacao,
  });
  if (!validacaoDissipacao.ok) return false;
  const tempo = combate.removeInvocationTimeReservation(donoId, instancia.id);
  const donoAtual = useCharacterStore.getState().characters.find(c => c.id === donoId);
  const instanciaAtual = donoAtual?.instanciasInvocacao?.find(item => item.id === instancia.id) ?? instancia;
  const dissipada = InstanciaInvocacaoSchema.parse({
    ...instanciaAtual,
    version: instanciaAtual.version + 1,
    estado: 'dissipada',
    causasSaida: Array.from(new Set([...(instanciaAtual.causasSaida ?? []), 'dissipacao_voluntaria'])),
  });
  gravarInstancia(donoAtual ?? dono, dissipada);
  if (isGrappleSource(modelo.subcategoria)) releaseGrapples(donoId, instancia.id, modelo.subcategoria);
  mapa.removeEntities(tokens.map(t => t.id));
  if (tempo.removedSeconds > 0 || tempo.discardedSeconds > 0) {
    const detalheRelogio = tempo.appliedToCurrentClock
      ? `Relógio do dono: ${formatarSegundosTempoInvocacao(tempo.clockBefore)} s → ${formatarSegundosTempoInvocacao(tempo.clockAfter)} s.`
      : 'A reserva foi cancelada para o próximo turno do dono.';
    useLogStore.getState().addLog(
      'combat',
      `⏱️ ${modelo.apelido?.trim() || modelo.nome} dissipado: ${formatarSegundosTempoInvocacao(tempo.removedSeconds)} s retirados${tempo.discardedSeconds > 0 ? `; ${formatarSegundosTempoInvocacao(tempo.discardedSeconds)} s permaneceram pelo piso de 10 s` : ''}.`,
      detalheRelogio,
    );
  }
  return true;
}

/** Normaliza tokens legados em 0 PV e remove somente os que cruzaram o limiar de −PV máximo. */
export function limparInvocacoesDerrotadas(donoId: string): number {
  useCombatStore.getState().settleTurnTimer();
  let removidos = 0;
  for (const token of tokensInvocados(donoId)) {
    const personagem = useCharacterStore.getState().characters.find(c => c.id === donoId);
    if (!personagem) continue;
    const modelo = obterModeloDoToken(personagem, token);
    if (!modelo) continue;
    const instancia = obterInstanciaDoToken(personagem, token, modelo);
    const hpAtual = token.hp ?? instancia.hpAtual;
    const estado = estadoPorPVInvocacao(hpAtual, token.hpMax ?? modelo.hpMaximo);
    if (estado === 'derrotada') {
      const derrotadaBase = InstanciaInvocacaoSchema.parse({
        ...instancia,
        version: instancia.version + 1,
        hpAtual,
        estado,
      });
      const derrotada = preservarContribuicaoNaDerrota(derrotadaBase);
      gravarInstancia(personagem, derrotada);
      if (isGrappleSource(modelo.subcategoria)) releaseGrapples(donoId, instancia.id, modelo.subcategoria);
      useMapStore.getState().removeEntities([token.id]);
      if (derrotada.contribuicaoTempo?.estado === 'consolacao' && derrotada.contribuicaoTempo.quantidadeRestante > 0) {
        useLogStore.getState().addLog('combat', `⏱️ ${modelo.apelido?.trim() || modelo.nome} foi derrotado; ${formatarSegundosTempoInvocacao(derrotada.contribuicaoTempo.quantidadeRestante)} s restantes preservados.`, 'A contribuição temporal foi mantida no relógio do dono até o fim do combate.');
      }
      removidos++;
      continue;
    }
    if (estado === 'caida' && (token.invocationState !== 'caida' || instancia.estado !== 'caida')) {
      const caida = InstanciaInvocacaoSchema.parse({
        ...instancia,
        version: instancia.version + 1,
        hpAtual,
        estado: 'caida',
      });
      gravarInstancia(personagem, caida);
      useMapStore.getState().updateEntity(token.id, { hp: hpAtual, invocationState: 'caida' });
    }
    if (isGrappleSource(modelo.subcategoria) && estado === 'caida') {
      releaseGrapples(donoId, instancia.id, modelo.subcategoria);
    }
  }
  return removidos;
}

/** Invocações não agem sozinhas; comandos no turno do dono serão implementados na Fase 4. */
export function podeComandarInvocacao(donoId: string, invocacaoId?: string): boolean {
  const combat = useCombatStore.getState();
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  if (!dono || possuiTecnicaInataSuprimida(dono)) return false;
  const mapa = useMapStore.getState();
  const role = useRoleStore.getState().role;
  // O relógio de combate é a fonte de turno durante combate; a iniciativa do mapa só vale fora dele.
  const atorAtualId = combat.inCombat
    ? combat.initiativeOrder[combat.currentTurnIndex]?.charId
    : mapa.initiative.entries[mapa.initiative.turnIndex]?.entityId;
  const tokenMestre = atorAtualId ? mapa.entities[atorAtualId] : undefined;
  const sombrasSobControleMestre = Object.values(mapa.entities).filter(token =>
    token.masterControlled && token.ownerCharId === donoId && token.invocationId &&
    (!invocacaoId || token.invocationId === invocacaoId),
  );
  if (sombrasSobControleMestre.length) {
    if (role !== 'MASTER') return false;
    if (!combat.inCombat) return true;
    return sombrasSobControleMestre.some(token => token.id === atorAtualId &&
      (token.invocationState === undefined || token.invocationState === 'ativa') && (token.hp ?? 1) > 0);
  }
  if (!combat.inCombat) return true;
  if (combat.initiativeOrder[combat.currentTurnIndex]?.charId === donoId) return true;
  return Boolean(role === 'MASTER' && tokenMestre?.masterControlled && tokenMestre.ownerCharId === donoId && tokenMestre.invocationId &&
    (!invocacaoId || tokenMestre.invocationId === invocacaoId));
}

function jogadorBloqueadoPorControleMestre(donoId: string, invocacaoId: string): boolean {
  if (useRoleStore.getState().role !== 'PLAYER') return false;
  return Object.values(useMapStore.getState().entities).some(token =>
    token.masterControlled && token.ownerCharId === donoId && token.invocationId === invocacaoId,
  );
}

function possuiTecnicaInataSuprimida(personagem: Character): boolean {
  return (personagem.activeConditions ?? []).some(condition => condition.conditionId === 'tecnica-inata-suprimida');
}

/** Movimento de jogador em combate exige o turno do dono e Ação de Movimento própria. */
export function podeMoverInvocacao(donoId: string, tokenId: string): boolean {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const token = useMapStore.getState().entities[tokenId];
  if (!dono || !token || token.ownerCharId !== donoId || !token.invocationId || (token.hp ?? 0) <= 0) return false;
  const modelo = obterModeloDoToken(dono, token);
  if (!modelo || !Number.isFinite(modelo.deslocamentoM) || modelo.deslocamentoM <= 0) return false;
  const instancia = obterInstanciaDoToken(dono, token, modelo);
  if (instancia.estado !== 'ativa') return false;
  const combat = useCombatStore.getState();
  const inerciaTouro = modelo.subcategoria === 'dez-sombras:touro-perfurante' &&
    inerciaImparavelTouroAtiva(instancia.inerciaImparavelTouro, combat);
  if ((instancia.agarradoPorInvocacao?.length ?? 0) > 0 && !inerciaTouro) return false;
  if (!podeComandarInvocacao(donoId, token?.invocationId)) return false;
  if (!combat.inCombat) return true;
  if (isFreeformFor(dono, combat.freeformMode)) return true;
  return (instancia.economiaAcoes?.acaoMovimento?.atual ?? 0) > 0;
}

/** Marca uma criatura como carregada pelo Nue depois da confirmação manual da disputa e do alcance. */
export function comandarCargaAereaNue(
  donoId: string,
  tokenId: string,
  alvoTokenId: string,
  confirmacaoManual: boolean,
): { ok: true; penalidadeVooM: number } | { ok: false; motivo: string } {
  const characters = useCharacterStore.getState().characters;
  const dono = characters.find(character => character.id === donoId);
  const mapa = useMapStore.getState();
  const token = mapa.entities[tokenId];
  const alvo = mapa.entities[alvoTokenId];
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === token?.invocationId);
  if (!dono || !token || token.ownerCharId !== donoId || modelo?.subcategoria !== 'dez-sombras:nue') {
    return { ok: false, motivo: 'A ação de voo só pode ser comandada pelo Nue ativo deste Controlador.' };
  }
  if (!alvo || alvo.id === token.id || alvo.hidden || (alvo.layer ?? 'tokens') !== 'tokens') {
    return { ok: false, motivo: 'Escolha uma criatura visível no mapa para carregar.' };
  }
  if ((token.hp ?? 0) <= 0 || token.invocationState === 'caida' || token.invocationState === 'derrotada' || token.invocationState === 'dissipada') {
    return { ok: false, motivo: 'Um Nue caído ou inativo não pode carregar criaturas.' };
  }
  if (!podeComandarInvocacao(donoId, token.invocationId)) {
    return { ok: false, motivo: 'O Nue só pode iniciar ou encerrar o transporte no turno do Controlador.' };
  }
  if (mapa.pendingMove?.entityId === tokenId) {
    return { ok: false, motivo: 'Confirme ou cancele o movimento pendente do Nue antes de alterar a carga.' };
  }
  if (alvo.carriedBy === tokenId) return { ok: false, motivo: 'Esta criatura já está sendo carregada pelo Nue; use Soltar.' };
  if (!confirmacaoManual) {
    return { ok: false, motivo: 'Confirme que o alcance e a disputa de agarrar, quando necessária, foram resolvidos manualmente.' };
  }
  const carga = validarCargaNue(tokenId, alvoTokenId);
  if (!carga.ok) return { ok: false, motivo: carga.motivo ?? 'A carga excede a capacidade do Nue.' };
  const x = token.x + (token.w - alvo.w) / 2;
  const y = token.y + (token.h - alvo.h) / 2;
  mapa.pushHistory();
  mapa.updateEntity(alvoTokenId, { x, y });
  mapa.setEntityCarriedBy(alvoTokenId, tokenId);
  broadcastEntityPatches([{ id: alvoTokenId, patch: { x, y, carriedBy: tokenId } }]);
  useLogStore.getState().addLog('combat', `🪽 ${modelo.apelido?.trim() || modelo.nome} passou a carregar ${alvo.label || 'uma criatura'} após resolução manual confirmada.`);
  return { ok: true, penalidadeVooM: carga.penalidadeVooM };
}

/** Solta uma criatura carregada pelo Nue na posição atual do passageiro. */
export function comandarSoltarCargaNue(
  donoId: string,
  tokenId: string,
  alvoTokenId: string,
): { ok: true } | { ok: false; motivo: string } {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const mapa = useMapStore.getState();
  const token = mapa.entities[tokenId];
  const alvo = mapa.entities[alvoTokenId];
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === token?.invocationId);
  if (!dono || !token || token.ownerCharId !== donoId || modelo?.subcategoria !== 'dez-sombras:nue') {
    return { ok: false, motivo: 'A ação só pode ser comandada pelo Nue ativo deste Controlador.' };
  }
  if (!alvo || alvo.carriedBy !== tokenId) return { ok: false, motivo: 'Esta criatura não está sendo carregada pelo Nue.' };
  if (!podeComandarInvocacao(donoId, token.invocationId)) {
    return { ok: false, motivo: 'O Nue só pode soltar a carga no turno do Controlador.' };
  }
  if (mapa.pendingMove?.entityId === tokenId) {
    return { ok: false, motivo: 'Confirme ou cancele o movimento pendente do Nue antes de soltar a carga.' };
  }
  mapa.pushHistory();
  mapa.setEntityCarriedBy(alvoTokenId, null);
  broadcastEntityPatches([{ id: alvoTokenId, patch: { carriedBy: null } }]);
  useLogStore.getState().addLog('combat', `🪽 ${modelo.apelido?.trim() || modelo.nome} soltou ${alvo.label || 'a criatura carregada'} manualmente.`);
  return { ok: true };
}

export type ResultadoMovimentoInvocacao =
  | { ok: true; distanciaM: number }
  | { ok: false; motivo: string };

/** Confirma um movimento pré-visualizado, revalida distância/colisão e gasta ação da instância. */
export function confirmarMovimentoInvocacao(input: {
  tokenId: string;
  instanciaId: string;
  de: { x: number; y: number };
  para: { x: number; y: number };
  trajetoria: readonly { x: number; y: number }[];
  distanciaM: number;
  requestId: string;
}): ResultadoMovimentoInvocacao {
  const mapa = useMapStore.getState();
  const token = mapa.entities[input.tokenId];
  if (!token?.ownerCharId || !token.invocationId || token.invocationInstanceId !== input.instanciaId) {
    return { ok: false, motivo: 'A instância selecionada não está mais no mapa.' };
  }
  const previa = mapa.pendingMove;
  if (!previa || previa.entityId !== token.id || previa.charId !== token.ownerCharId ||
    previa.invocationInstanceId !== input.instanciaId ||
    Math.hypot(previa.startX - input.de.x, previa.startY - input.de.y) > 0.5 ||
    (previa.movementRequestId !== undefined && previa.movementRequestId !== input.requestId) ||
    Math.abs(previa.distM - input.distanciaM) > 0.05) {
    return { ok: false, motivo: 'A prévia de movimento não corresponde à instância selecionada.' };
  }
  if (!input.requestId.trim() || !Number.isFinite(input.distanciaM) || input.distanciaM < 0 ||
    ![input.de.x, input.de.y, input.para.x, input.para.y].every(Number.isFinite) ||
    input.trajetoria.length > 1024 || !input.trajetoria.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) {
    return { ok: false, motivo: 'Trajetória de movimento inválida.' };
  }
  if (Math.hypot(token.x - input.para.x, token.y - input.para.y) > 0.5) {
    return { ok: false, motivo: 'A posição do token mudou antes da confirmação.' };
  }

  const dono = useCharacterStore.getState().characters.find(character => character.id === token.ownerCharId);
  if (!dono) return { ok: false, motivo: 'Dono da invocação não encontrado.' };
  if (!podeComandarInvocacao(dono.id, token.invocationId)) {
    return { ok: false, motivo: 'Só é possível mover a invocação no turno do dono.' };
  }
  const modelo = obterModeloDoToken(dono, token);
  if (!modelo || !Number.isFinite(modelo.deslocamentoM) || modelo.deslocamentoM <= 0) {
    return { ok: false, motivo: 'Deslocamento da invocação inválido.' };
  }
  const ehNue = modelo.subcategoria === 'dez-sombras:nue';
  const modoAtual = ehNue ? (token.invocationMovementMode ?? 'voo') : undefined;
  const modoDaPrevia = ehNue ? (previa.invocationMovementMode ?? modoAtual) : undefined;
  if (ehNue && modoDaPrevia !== modoAtual) {
    return { ok: false, motivo: 'O modo de deslocamento do Nue mudou durante a prévia. Refaça o movimento.' };
  }
  const limiteMovimentoM = deslocamentoInvocacaoM(token.id, modoDaPrevia);
  if (!Number.isFinite(limiteMovimentoM) || limiteMovimentoM <= 0) {
    return { ok: false, motivo: ehNue ? 'O Nue não pode se deslocar com esta carga; solte passageiros ou reduza a carga.' : 'Deslocamento da invocação inválido.' };
  }
  const instanciaAtiva = obterInstanciaDoToken(dono, token, modelo);
  if ((token.hp ?? instanciaAtiva.hpAtual) <= 0 || (token.invocationState && token.invocationState !== 'ativa') || instanciaAtiva.estado !== 'ativa') {
    return { ok: false, motivo: 'Invocação caída ou inativa não pode se mover.' };
  }
  const combat = useCombatStore.getState();
  const inerciaTouro = modelo.subcategoria === 'dez-sombras:touro-perfurante' &&
    inerciaImparavelTouroAtiva(instanciaAtiva.inerciaImparavelTouro, combat);
  if ((instanciaAtiva.agarradoPorInvocacao?.length ?? 0) > 0 && !inerciaTouro) {
    return { ok: false, motivo: 'Invocação agarrada não pode se mover antes de escapar.' };
  }
  const grid = mapa.gridConfig;
  if (!(grid.dpi > 0) || !(grid.metersPerCell > 0)) return { ok: false, motivo: 'Grade do mapa inválida.' };
  const pontos = [input.de, ...input.trajetoria, input.para];
  const ignoraTerreno = ehNue && modoDaPrevia === 'voo'
    ? { ignoreAll: true }
    : modelo.subcategoria === 'dez-sombras:sapo' ? { ignoreKinds: ['water', 'mud'] as const } : false;
  const areasTerreno = Object.values(mapa.entities).filter(entity => !!entity.difficultTerrain).map(entity => ({
    x: entity.x, y: entity.y, w: entity.w, h: entity.h, rotation: entity.rotation,
    shape: entity.shape, difficultTerrain: entity.difficultTerrain, difficultTerrainKind: entity.difficultTerrainKind,
  }));
  const metrosPorPixel = grid.metersPerCell / grid.dpi;
  const distanciaDaTrajetoriaM = pontos.slice(1).reduce((total, ponto, index) =>
    total + movementCostForTerrainSegment(pontos[index], ponto, metrosPorPixel, areasTerreno, ignoraTerreno), 0);
  const distanciaM = Math.max(input.distanciaM, distanciaDaTrajetoriaM);
  if (distanciaM > limiteMovimentoM + 0.05) {
    return { ok: false, motivo: ehNue
      ? `O movimento excede o deslocamento disponível (${limiteMovimentoM} m).`
      : 'O movimento excede o deslocamento configurado na ficha.' };
  }
  if (distanciaM <= 0.05) return { ok: true, distanciaM };
  const segmentos = WallsEngine.blockingSegments(mapa.walls, 'sight');
  const fog = useFogStore.getState();
  for (const segment of buildFogSegments(fog.walls, fog.doors)) segmentos.push([segment.a, segment.b]);
  const entidadesFixas = Object.values(mapa.entities).filter(entity =>
    entity.id !== token.id && entity.layer !== 'map' && !entity.hidden && !entity.carriedBy &&
    !(ehNue && modoDaPrevia === 'voo' && (entity.altitudeM ?? 0) <= 0),
  );
  for (const entity of entidadesFixas) {
    const bloqueador: MapCollisionToken = { origin: { x: entity.x, y: entity.y }, entity };
    segmentos.push(...tokenFootprintSegments(bloqueador, 0, 0));
  }
  const cache = prepareCollisionCache(segmentos);
  const movingToken: MapCollisionToken = { origin: input.de, entity: token };
  let deslocamento = { dx: 0, dy: 0 };
  for (const ponto of pontos.slice(1)) {
    const destino = { dx: ponto.x - input.de.x, dy: ponto.y - input.de.y };
    const passo = { dx: destino.dx - deslocamento.dx, dy: destino.dy - deslocamento.dy };
    deslocamento = resolveCollisionMove([movingToken], cache, deslocamento, passo);
    if (Math.hypot(deslocamento.dx - destino.dx, deslocamento.dy - destino.dy) > 0.5) {
      return { ok: false, motivo: 'A trajetória está bloqueada por uma parede, área ou token.' };
    }
  }
  if (Math.hypot(input.de.x + deslocamento.dx - input.para.x, input.de.y + deslocamento.dy - input.para.y) > 0.5) {
    return { ok: false, motivo: 'A trajetória não termina na posição pré-visualizada.' };
  }

  let instancia = instanciaAtiva;
  if (combat.inCombat) {
    if (isFreeformFor(dono, combat.freeformMode)) return { ok: true, distanciaM };
    const gasto = gastarAcaoDaInstancia(instancia, 'acaoMovimento', 1, input.requestId);
    if (!gasto.ok) return gasto;
    instancia = gasto.instancia;
    if (modelo.subcategoria === 'dez-sombras:touro-perfurante') {
      instancia = InstanciaInvocacaoSchema.parse({
        ...instancia,
        version: instancia.version + 1,
        investidaPerfuranteTurno: {
          rodada: combat.round ?? 1,
          turnoIndex: combat.currentTurnIndex,
          combateId: combat.combatId ?? undefined,
          distanciaM: medirInvestidaRetaEmMetros(pontos, grid),
          direcao: (() => {
            const dx = input.para.x - input.de.x;
            const dy = input.para.y - input.de.y;
            const comprimento = Math.hypot(dx, dy);
            return comprimento > 0.5 ? { x: dx / comprimento, y: dy / comprimento } : undefined;
          })(),
        },
      });
    }
    gravarInstancia(dono, instancia);
  }
  return { ok: true, distanciaM };
}

/** Aplica os resets manuais configurados no modelo somente à instância escolhida. */
export function resetarEconomiaManualInvocacao(
  donoId: string,
  tokenId: string,
  eventoId = novoIdInvocacao('reset-economia'),
): { ok: true } | { ok: false; motivo: string } {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const token = useMapStore.getState().entities[tokenId];
  if (!dono || !token || token.ownerCharId !== donoId || !token.invocationId) {
    return { ok: false, motivo: 'Instância da invocação não encontrada para este dono.' };
  }
  if (!podeComandarInvocacao(donoId, token.invocationId)) {
    return { ok: false, motivo: 'Só é possível atualizar a economia da invocação no turno do dono.' };
  }
  const modelo = obterModeloDoToken(dono, token);
  if (!modelo) return { ok: false, motivo: 'Modelo da invocação não encontrado.' };
  const temResetManual = Object.values(modelo.economiaAcoesConfigurada?.resetPorCategoria ?? {}).includes('manual') ||
    modelo.acoes.some(acao => acao.recargaConfigurada?.unidade === 'manual') ||
    (modelo.recursosConfigurados ?? []).some(recurso => recurso.recargaConfigurada?.unidade === 'manual');
  if (!temResetManual) return { ok: false, motivo: 'Esta instância não possui saldos com reset manual.' };
  const instancia = obterInstanciaDoToken(dono, token, modelo);
  if (instancia.estado !== 'ativa') return { ok: false, motivo: 'Apenas uma instância ativa pode receber reset manual.' };
  if (!eventoId.trim()) return { ok: false, motivo: 'Identificador do reset inválido.' };
  gravarInstancia(dono, processarResetEconomiaInstancia(instancia, modelo, 'manual', eventoId));
  return { ok: true };
}

const tesouroFugaEmResolucao = new Set<string>();

async function resolverTesouroEscondidoFuga(donoId: string, instanciaId: string, eventoId?: string): Promise<void> {
  const chave = `${instanciaId}:${eventoId?.trim() || novoIdInvocacao('critico-fuga')}`;
  if (tesouroFugaEmResolucao.has(chave)) return;
  tesouroFugaEmResolucao.add(chave);
  try {
    const rolagem = await rollDiceGroups([{ count: 1, sides: 10 }], { label: 'Tesouro Escondido da Fuga dos Coelhos' });
    const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
    const instancia = dono?.instanciasInvocacao?.find(item => item.id === instanciaId);
    const modelo = dono?.invocacoesConhecidas?.find(item => item.id === instancia?.modeloId);
    if (!dono || !instancia || modelo?.subcategoria !== 'dez-sombras:fuga-do-coelho') return;
    if (rolagem.total === 1) {
      const exorcizada = preservarContribuicaoNaDerrota(InstanciaInvocacaoSchema.parse({
        ...instancia,
        version: instancia.version + 1,
        hpAtual: -Math.max(1, instancia.hpMaximoAtual),
        estado: 'derrotada',
        fugaCoelhosAlvo: undefined,
      }));
      useCharacterStore.getState().updateCharacter(dono.id, {
        instanciasInvocacao: instanciasComAtualizada(dono, exorcizada),
        invocacoesConhecidas: (dono.invocacoesConhecidas ?? []).map(item => item.id === modelo.id
          ? { ...item, hpAtual: 0, perdaPermanente: true }
          : item),
      });
      if (useMapStore.getState().entities[instancia.tokenId]) useMapStore.getState().removeEntities([instancia.tokenId]);
      useLogStore.getState().addLog('combat', `🎲 Tesouro Escondido: d10 = 1. O Coelho Líder foi atingido; a Fuga dos Coelhos foi desfeita e exorcizada, independentemente dos PV restantes.`);
    } else {
      useLogStore.getState().addLog('combat', `🎲 Tesouro Escondido: d10 = ${rolagem.total}. O Coelho Líder não foi atingido.`);
    }
  } catch {
    useLogStore.getState().addLog('combat', '⚠️ Tesouro Escondido: não foi possível concluir a rolagem de d10. A Horda permanece no estado anterior; o Mestre deve repetir a resolução do crítico.');
  } finally {
    tesouroFugaEmResolucao.delete(chave);
  }
}


/** Dano direcionado a uma instância; 0 PV deixa a criatura Caída, −PV máximo a derrota. */
export function causarDanoInvocacao(
  tokenId: string,
  dano: number,
  tipoDano?: DamageType,
  instanciaEsperadaId?: string,
  contexto: { tipoAlvo?: TipoAlvoDanoHorda; eventoId?: string; critico?: boolean; parcelas?: ParcelaDano[]; ignoresRD?: boolean; rdIgnore?: number; fenomenoId?: string; fenomenoNome?: string; ataqueCorpoACorpo?: boolean } = {},
): { ok: true; hpRestante: number; destruida: boolean } | { ok: false; motivo: string } {
  const mapa = useMapStore.getState();
  const token = mapa.entities[tokenId];
  if (!token?.ownerCharId || !token.invocationId) return { ok: false, motivo: 'Token não pertence a uma invocação.' };
  const dono = useCharacterStore.getState().characters.find(c => c.id === token.ownerCharId);
  if (!dono) return { ok: false, motivo: 'Dono da invocação não encontrado.' };
  const modelo = obterModeloDoToken(dono, token);
  const alvoRitualControladoPeloMestre = Boolean(token.masterControlled && token.ritualId);
  if (!modelo) return { ok: false, motivo: 'Modelo da invocação não encontrado.' };
  const atual = obterInstanciaDoToken(dono, token, modelo);
  const ehMahoraga = modelo.subcategoria === 'dez-sombras:mahoraga';
  const estadoCombateDano = useCombatStore.getState();
  const estadoMahoragaInicial = ehMahoraga
    ? normalizarEstadoMahoraga(atual.estadoMahoraga, estadoCombateDano.inCombat ? estadoCombateDano.combatId ?? undefined : undefined)
    : undefined;
  if (ehMahoraga && contexto.eventoId && estadoMahoragaInicial?.eventosDanoProcessados.includes(contexto.eventoId)) {
    return { ok: true, hpRestante: atual.hpAtual, destruida: atual.estado === 'derrotada' };
  }
  const ehCoelhoDisperso = token.invocationSubordinate?.kind === 'fuga-coelho';
  const ehFugaCoelhos = !ehCoelhoDisperso && modelo.subcategoria === 'dez-sombras:fuga-do-coelho';
  const condicoesAtuais = atual.condicoes ?? [];
  const fugaFragilizada = ehFugaCoelhos && condicoesAtuais.some(condicao =>
    typeof condicao === 'object' && condicao !== null &&
    (condicao as { conditionId?: unknown }).conditionId === 'fragilizado',
  );
  if (instanciaEsperadaId && atual.id !== instanciaEsperadaId) {
    return { ok: false, motivo: 'A instância da invocação mudou antes da aplicação do dano.' };
  }
  if (contexto.eventoId !== undefined && !contexto.eventoId.trim()) return { ok: false, motivo: 'ID de dano inválido.' };
  if (ehCoelhoDisperso) {
    const horda = token.invocationSubordinate?.parentTokenId
      ? mapa.entities[token.invocationSubordinate.parentTokenId]
      : undefined;
    const instanciaHorda = dono.instanciasInvocacao?.find(instancia => instancia.id === token.invocationInstanceId);
    if (!horda || horda.ownerCharId !== dono.id || horda.invocationInstanceId !== atual.id ||
      !instanciaHorda || instanciaHorda.estado !== 'ativa' || token.invocationInstanceId !== atual.id) {
      return { ok: false, motivo: 'O coelho não está vinculado à Horda ativa esperada.' };
    }
    if (!Number.isFinite(dano) || dano <= 0) return { ok: true, hpRestante: token.hp ?? 1, destruida: false };
    mapa.pushHistory();
    mapa.removeEntities([tokenId]);
    useLogStore.getState().addLog('combat', `🐇 ${token.label || 'Coelho disperso'} perde seu único PV e sai de campo. A Horda e seu Líder permanecem intactos.`);
    return { ok: true, hpRestante: 0, destruida: true };
  }
  const cobertoPorFuga = (contexto.tipoAlvo ?? 'unico') !== 'area' &&
    useCharacterStore.getState().characters.some(owner => (owner.instanciasInvocacao ?? []).some(instance => {
      const vínculo = instance.fugaCoelhosAlvo;
      if (instance.estado !== 'ativa' || vínculo?.lado !== 'aliado' || vínculo.targetEntityId !== tokenId) return false;
      const sourceModel = owner.invocacoesConhecidas?.find(item => item.id === instance.modeloId);
      const sourceToken = useMapStore.getState().entities[instance.tokenId];
      return sourceModel?.subcategoria === 'dez-sombras:fuga-do-coelho' && Boolean(sourceToken &&
        (sourceToken.hp ?? 1) > 0 && (!sourceToken.invocationState || sourceToken.invocationState === 'ativa') &&
        !sourceToken.hidden && useMapStore.getState().layerVisible[sourceToken.layer ?? 'tokens'] !== false);
    }));
  if (cobertoPorFuga) {
    useLogStore.getState().addLog('combat', `🐇 Cobertura Completa da Fuga dos Coelhos impede o ataque de alvo único contra ${modelo.nome}.`);
    return { ok: true, hpRestante: atual.hpAtual, destruida: false };
  }
  if ((atual.composicaoHorda || ehFugaCoelhos) && contexto.eventoId && atual.eventosDanoHordaProcessados?.includes(contexto.eventoId)) {
    return { ok: true, hpRestante: atual.hpAtual, destruida: atual.estado === 'derrotada' };
  }
  useCombatStore.getState().settleTurnTimer();
  const parcelas = contexto.parcelas?.length ? contexto.parcelas : [{ valor: dano, tipo: tipoDano }];
  const round = estadoCombateDano.round ?? 1;
  const danoFinal = parcelas.reduce((total, parcela) => {
    const tipo = parcela.tipo ?? tipoDano;
    const rdCaracteristica = reducaoDanoCaracteristicas(modelo, tipo);
    const rdAuxilio = (atual.efeitosSuporteAtivos ?? []).filter(efeito =>
      efeito.tipo === 'reducao_dano' && efeito.expiraNaRodada >= round &&
      (!efeito.tiposDano?.length || (!!tipo && efeito.tiposDano.includes(tipo)))
    ).reduce((soma, efeito) => soma + efeito.valor, 0);
    const rdEfetiva = contexto.ignoresRD || fugaFragilizada ? 0 : calcularReducaoDanoHorda({
      ehHorda: Boolean(token.invocationHordeId) || ehFugaCoelhos,
      tipoAlvo: contexto.tipoAlvo ?? 'unico',
      rdBase: rdCaracteristica + rdAuxilio,
      nivelDono: dono.level,
    });
    const rdIgnorada = contexto.ignoresRD ? rdEfetiva : Math.min(rdEfetiva, Math.max(0, contexto.rdIgnore ?? 0));
    return total + Math.max(0, Math.floor(parcela.valor) - (rdEfetiva - rdIgnorada));
  }, 0);
  if (danoFinal <= 0) return { ok: true, hpRestante: atual.hpAtual, destruida: atual.estado === 'derrotada' };
  const pvTemporarios = Math.max(0, atual.pvTemporarios ?? 0);
  const absorvido = Math.min(pvTemporarios, danoFinal);
  const danoNosPV = danoFinal - absorvido;
  // Tesouro Escondido impede que dano comum mate o Líder; somente a rolagem de crítico pode exorcizar a Horda.
  const danoAplicadoNosPV = ehFugaCoelhos ? Math.min(danoNosPV, Math.max(0, atual.hpAtual)) : danoNosPV;
  let instanciaDepoisDoDano: InstanciaInvocacao;
  if (ehMahoraga && estadoMahoragaInicial) {
    const fenId = contexto.fenomenoId?.trim() || (tipoDano ? `dano:${tipoDano}` : 'dano:sem-tipo');
    const fenNome = contexto.fenomenoNome?.trim() || (tipoDano ? `Dano ${tipoDano}` : 'Dano sem tipo informado');
    const fenomenoAntes = estadoMahoragaInicial.fenomenos.find(item => item.id === fenId);
    const efeitosRoda = efeitosRodaNoDano(fenomenoAntes, danoFinal, {
      pv: atual.hpAtual,
      pvTemporarios,
      ataqueCorpoACorpo: Boolean(contexto.ataqueCorpoACorpo),
      ataquesCorpoACorpoRecebidos: estadoMahoragaInicial.ataquesCorpoACorpoRecebidos,
    });
    const eventoJaGirou = Boolean(contexto.eventoId && estadoMahoragaInicial.eventosRodaProcessados.includes(contexto.eventoId));
    const giro = eventoJaGirou
      ? { estado: estadoMahoragaInicial, girosAntes: fenomenoAntes?.giros ?? 0, girosDepois: fenomenoAntes?.giros ?? 0, novoFenomeno: !fenomenoAntes }
      : registrarFenomenoMahoraga(estadoMahoragaInicial, {
        id: fenId,
        nome: fenNome,
        tipoDano,
        rodada: round,
        ...(contexto.eventoId ? { eventoId: contexto.eventoId } : {}),
      });
    const estadoComDano = {
      ...giro.estado,
      ...(!eventoJaGirou && giro.girosDepois > giro.girosAntes && !contexto.ataqueCorpoACorpo
        ? { regeneracoesRodaPendentes: giro.estado.regeneracoesRodaPendentes + 1 }
        : {}),
      ...(contexto.ataqueCorpoACorpo && danoFinal > 0
        ? { ataquesCorpoACorpoRecebidos: estadoMahoragaInicial.ataquesCorpoACorpoRecebidos + 1 }
        : {}),
      ...(contexto.eventoId ? { eventosDanoProcessados: [...giro.estado.eventosDanoProcessados, contexto.eventoId].slice(-500) } : {}),
      ...(contexto.eventoId ? { eventosRodaProcessados: [...new Set([...giro.estado.eventosRodaProcessados, contexto.eventoId])].slice(-500) } : {}),
    };
    const primeiroGiroNoEvento = contexto.eventoId !== undefined &&
      giro.estado.fenomenos.find(item => item.id === fenId)?.eventoPrimeiroGiroId === contexto.eventoId;
    const ciclo = resolverCicloVidaMahoraga({
      estado: estadoComDano,
      pvAtual: atual.hpAtual,
      danoNosPV: efeitosRoda.danoNosPV,
      fenomenoJaConhecido: Boolean(fenomenoAntes && !primeiroGiroNoEvento),
    });
    instanciaDepoisDoDano = InstanciaInvocacaoSchema.parse({
      ...atual,
      version: atual.version + 1,
      hpAtual: ciclo.pvAtual,
      hpMaximoAtual: ciclo.pvMaximo,
      estado: ciclo.estadoInvocacao,
      pvTemporarios: pvTemporarios - efeitosRoda.pvTemporariosConsumidos,
      estadoMahoraga: ciclo.estado,
    });
    if (danoFinal > 0) {
      useLogStore.getState().addLog('combat', `☸️ ${modelo.nome}: a Roda girou para ${fenNome} (${giro.girosDepois}/5). ${efeitosRoda.efeito ? `Dano: ${efeitosRoda.efeito}. ` : ''}${ciclo.mensagem}`);
    }
  } else {
    const resultado = aplicarDanoPVInvocacao(atual, danoAplicadoNosPV);
    if (!resultado.ok) return resultado;
    instanciaDepoisDoDano = resultado.instancia;
  }
  let instanciaComPerdaPendente = instanciaDepoisDoDano;
  if (integracaoInvocacoes.resolverPerdaHorda && atual.composicaoHorda) {
    const perda = resolverPerdaMembrosHorda({ pvAntes: atual.hpAtual, pvDepois: instanciaDepoisDoDano.hpAtual,
      pvMaximo: atual.hpMaximoAtual, membros: atual.composicaoHorda.membros, limiar: atual.limiarPerdaHorda });
    if (perda.removidos.length) {
      const escala = calcularEscalaHorda(perda.membros);
      const combate = useCombatStore.getState();
      const custoRemovido = perda.removidos.reduce((total, membro) => total + ({ quarto: 1, terceiro: 2, segundo: 3, primeiro: 0, especial: 0 })[membro.grau], 0);
      instanciaComPerdaPendente = InstanciaInvocacaoSchema.parse({ ...instanciaDepoisDoDano,
        hpAtual: perda.pvAtual, hpMaximoAtual: perda.pvMaximo, limiarPerdaHorda: perda.limiar,
        perdaMembrosHordaPendente: undefined,
        composicaoHorda: { ...atual.composicaoHorda, membros: perda.membros,
          custoInvocacaoPE: Math.max(0, atual.composicaoHorda.custoInvocacaoPE - custoRemovido),
          categoriasTamanhoAdicionais: escala.categoriasTamanho, usosAntesPrejuizoMultiplo: escala.usosAntesPrejuizo },
        membrosHordaRemovidos: [...(atual.membrosHordaRemovidos ?? []), ...perda.removidos.map(membro => ({
          modeloId: membro.modeloId, motivo: 'metade_pv' as const,
          pvIndividual: dono.invocacoesConhecidas?.find(item => item.id === membro.modeloId)?.hpAtual ?? membro.pvAntes,
          rodadaRemocao: combate.round ?? 1, bloqueioRodadas: 1,
          ...(combate.combatId ? { combateId: combate.combatId } : {}),
        }))],
      });
      metricas.perdasHordaResolvidas++;
      metricas.membrosHordaRemovidos += perda.removidos.length;
      useLogStore.getState().addLog('combat', `Horda perdeu ${perda.removidos.length} membro(s): ${perda.removidos.map(m => m.modeloId).join(', ')}.`,
        `PV proporcionais: ${perda.pvAtual}/${perda.pvMaximo}. Integrantes preservam PV individuais e aguardam uma rodada para reinvocar.`);
    }
  } else if (integracaoInvocacoes.registrarPerdaHorda && atual.composicaoHorda && !atual.perdaMembrosHordaPendente) {
    const perda = verificarPerdaMembrosHorda(atual.hpAtual, instanciaDepoisDoDano.hpAtual, atual.hpMaximoAtual, atual.composicaoHorda.membros.length);
    if (perda.pendente && perda.quantidade > 0) {
      instanciaComPerdaPendente = InstanciaInvocacaoSchema.parse({
        ...instanciaDepoisDoDano,
        perdaMembrosHordaPendente: {
          motivo: 'metade_pv', quantidade: perda.quantidade,
          pvAntes: atual.hpAtual, pvDepois: instanciaDepoisDoDano.hpAtual, pvMaximo: atual.hpMaximoAtual,
          membrosIds: atual.composicaoHorda.membros.map(membro => membro.modeloId),
        },
      });
      metricas.perdasHordaPendentes++;
      useLogStore.getState().addLog('combat', `Horda atingiu metade dos PV: perda de ${perda.quantidade} membro(s) pendente de decisão do Mestre.`,
        'Remoção bloqueada: definir ajuste de PV, desempate, destino dos membros e repetição do limiar. Nenhum PV foi redistribuído.');
    }
  }
  let fragilizadaPorArea = false;
  if (ehFugaCoelhos && contexto.tipoAlvo === 'area' && !fugaFragilizada) {
    const condicoes = instanciaComPerdaPendente.condicoes ?? [];
    const novaCondicao = {
      id: `fuga-coelhos-fragilizado:${instanciaComPerdaPendente.id}`,
      conditionId: 'fragilizado',
      name: 'Fragilizado',
      icon: '💔',
      remainingTurns: -1,
      remainingRounds: -1,
      sourceCharId: dono.id,
      sourceCharName: dono.name,
      sourceEntityId: 'dez-sombras:fuga-do-coelho',
    };
    instanciaComPerdaPendente = InstanciaInvocacaoSchema.parse({
      ...instanciaComPerdaPendente,
      version: instanciaComPerdaPendente.version + 1,
      condicoes: [...condicoes, novaCondicao],
    });
    fragilizadaPorArea = true;
  }
  const comTemporarios = InstanciaInvocacaoSchema.parse({ ...instanciaComPerdaPendente, pvTemporarios: pvTemporarios - absorvido,
    ...((atual.composicaoHorda || ehFugaCoelhos) && contexto.eventoId ? {
      eventosDanoHordaProcessados: [...(atual.eventosDanoHordaProcessados ?? []), contexto.eventoId],
    } : {}),
  });
  const instanciaAtualizada = comTemporarios.estado === 'derrotada'
    ? preservarContribuicaoNaDerrota(comTemporarios)
    : comTemporarios;
  gravarInstancia(dono, instanciaAtualizada);
  if (fragilizadaPorArea) {
    useLogStore.getState().addLog('combat', `🐇 ${modelo.nome} foi atingida por uma área e ficou Fragilizada: sua RD e resistências estão zeradas.`);
  }
  if (isGrappleSource(modelo.subcategoria) && instanciaAtualizada.estado !== 'ativa') {
    releaseGrapples(dono.id, instanciaAtualizada.id, modelo.subcategoria);
  }
  if (instanciaAtualizada.estado === 'derrotada') {
    if (alvoRitualControladoPeloMestre) {
      mapa.updateEntity(tokenId, {
        hp: instanciaAtualizada.hpAtual,
        hpMax: instanciaAtualizada.hpMaximoAtual,
        invocationState: 'derrotada',
        invocationTempHp: instanciaAtualizada.pvTemporarios ?? 0,
      });
      mapa.removeInitiativeByEntity(tokenId);
      useCombatStore.getState().removeCombatParticipant(tokenId);
    } else {
      mapa.removeEntities([tokenId]);
    }
    const restante = instanciaAtualizada.contribuicaoTempo?.estado === 'consolacao'
      ? instanciaAtualizada.contribuicaoTempo.quantidadeRestante
      : 0;
    if (restante > 0) {
      useLogStore.getState().addLog(
        'combat',
        `⏱️ ${modelo.apelido?.trim() || modelo.nome} foi derrotado; ${formatarSegundosTempoInvocacao(restante)} s restantes preservados.`,
        'A contribuição temporal foi mantida no relógio do dono até o fim do combate.',
      );
    }
    if (ehFugaCoelhos && contexto.critico) void resolverTesouroEscondidoFuga(dono.id, instanciaAtualizada.id, contexto.eventoId);
    return { ok: true, hpRestante: instanciaAtualizada.hpAtual, destruida: true };
  }
  mapa.updateEntity(tokenId, {
    hp: instanciaAtualizada.hpAtual,
    hpMax: instanciaAtualizada.hpMaximoAtual,
    ...(instanciaAtualizada.composicaoHorda ? {
      invocationHordeMemberIds: instanciaAtualizada.composicaoHorda.membros.map(membro => membro.modeloId),
      invocationHordeSizeIncreases: instanciaAtualizada.composicaoHorda.categoriasTamanhoAdicionais,
    } : {}),
    invocationTempHp: instanciaAtualizada.pvTemporarios ?? 0,
    invocationConditionIds: (instanciaAtualizada.condicoes ?? []).flatMap(condicao =>
      typeof condicao === 'object' && condicao !== null &&
      typeof (condicao as { conditionId?: unknown }).conditionId === 'string'
        ? [(condicao as { conditionId: string }).conditionId]
        : [],
    ),
    invocationState: instanciaAtualizada.estado,
    invocationInstanceId: instanciaAtualizada.id,
  });
  if (ehFugaCoelhos && contexto.critico) void resolverTesouroEscondidoFuga(dono.id, instanciaAtualizada.id, contexto.eventoId);
  return { ok: true, hpRestante: instanciaAtualizada.hpAtual, destruida: false };
}

/** Registra um efeito ou TR que acionou a Roda sem causar dano (ou antes do dano pós-TR). */
export function registrarFenomenoRodaMahoraga(
  donoId: string,
  invocacaoId: string,
  fenomeno: { id: string; nome: string; eventoId: string; tipoDano?: DamageType; prevalidarEfeitoNaoDanoso?: boolean; controleMental?: boolean; origemMestre?: boolean },
): { ok: true; giros: number; duplicado?: boolean; bloqueado?: boolean; bloqueadoPorVontadeDivina?: boolean } | { ok: false; motivo: string } {
  const eventId = fenomeno.eventoId.trim();
  const id = fenomeno.id.trim();
  const nome = fenomeno.nome.trim();
  if (!eventId || !id || !nome) return { ok: false, motivo: 'Fenômeno, nome e ID idempotente do evento são obrigatórios.' };
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  if (!dono || modelo?.subcategoria !== 'dez-sombras:mahoraga') return { ok: false, motivo: 'Mahoraga não foi encontrado para registrar a adaptação.' };
  const token = tokensInvocados(donoId).find(entity => entity.invocationId === invocacaoId && entity.invocationInstanceId);
  const instancia = token
    ? dono.instanciasInvocacao?.find(item => item.id === token.invocationInstanceId)
    : undefined;
  if (!token || !instancia || (instancia.estado !== 'ativa' && instancia.estado !== 'caida')) {
    return { ok: false, motivo: 'Mahoraga não está materializado em campo.' };
  }
  const combate = useCombatStore.getState();
  const estado = normalizarEstadoMahoraga(instancia.estadoMahoraga, combate.inCombat ? combate.combatId ?? undefined : undefined);
  const girosAtuais = estado.fenomenos.find(item => item.id === id)?.giros ?? 0;
  if (fenomeno.controleMental && estado.vontadeDivina?.ativa && !fenomeno.origemMestre) {
    useLogStore.getState().addLog('combat', `☸️ Vontade Divina: Mahoraga ignora ${nome}; controle mental/intimidação de uma fonte que não é o Mestre não o afeta.`);
    return { ok: true, giros: girosAtuais, bloqueado: true, bloqueadoPorVontadeDivina: true };
  }
  const jaProcessados = estado.eventosRodaProcessados;
  if (jaProcessados.includes(eventId)) {
    return { ok: true, giros: girosAtuais, duplicado: true, ...(fenomeno.prevalidarEfeitoNaoDanoso ? { bloqueado: true } : {}) };
  }
  if (fenomeno.prevalidarEfeitoNaoDanoso && girosAtuais >= 4) {
    return { ok: true, giros: girosAtuais, bloqueado: true };
  }
  const giro = registrarFenomenoMahoraga(estado, {
    id,
    nome,
    tipoDano: fenomeno.tipoDano,
    rodada: combate.round ?? 1,
    eventoId: eventId,
  });
  const instanciaAtualizada = InstanciaInvocacaoSchema.parse({
    ...instancia,
    version: instancia.version + 1,
    estadoMahoraga: {
      ...giro.estado,
      regeneracoesRodaPendentes: giro.estado.regeneracoesRodaPendentes + (giro.girosDepois > giro.girosAntes ? 1 : 0),
      eventosRodaProcessados: [...jaProcessados, eventId].slice(-500),
    },
  });
  gravarInstancia(dono, instanciaAtualizada);
  useLogStore.getState().addLog('combat', giro.girosDepois > giro.girosAntes
    ? `☸️ ${modelo.nome}: a Roda girou para ${nome} (${giro.girosDepois}/5) após contato sem dano.`
    : `☸️ ${modelo.nome}: a adaptação à fonte ${nome} já está completa (5/5); nenhum novo giro ocorreu.`);
  return { ok: true, giros: giro.girosDepois, ...(fenomeno.prevalidarEfeitoNaoDanoso ? { bloqueado: false } : {}) };
}

/** Registra no token uma condição já adjudicada pelo Mestre para acompanhar a adaptação de Mahoraga. */
export function registrarCondicaoMahoraga(
  donoId: string,
  invocacaoId: string,
  conditionId: string,
  opcoes: { origemMestre?: boolean } = {},
): { ok: true; duplicada?: boolean; bloqueadaPorVontadeDivina?: boolean } | { ok: false; motivo: string } {
  if (useRoleStore.getState().role !== 'MASTER') return { ok: false, motivo: 'Somente o Mestre pode registrar uma condição de Mahoraga.' };
  const id = normalizarCondicaoInvocacao(conditionId);
  const condicao = ALL_CONDITIONS.find(item => normalizarCondicaoInvocacao(item.id) === id);
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  const token = tokensInvocados(donoId).find(entity => entity.invocationId === invocacaoId && entity.invocationInstanceId);
  const instancia = token ? dono?.instanciasInvocacao?.find(item => item.id === token.invocationInstanceId) : undefined;
  if (!condicao || !dono || modelo?.subcategoria !== 'dez-sombras:mahoraga' || !token || !instancia || instancia.estado !== 'ativa') {
    return { ok: false, motivo: 'Mahoraga ativo ou condição reconhecida não foi encontrado.' };
  }
  const combate = useCombatStore.getState();
  const estado = normalizarEstadoMahoraga(instancia.estadoMahoraga, combate.inCombat ? combate.combatId ?? undefined : undefined);
  if (condicao.category === 'MENTAL' && estado.vontadeDivina?.ativa && !opcoes.origemMestre) {
    useLogStore.getState().addLog('combat', `☸️ Vontade Divina: ${modelo.nome} ignora ${condicao.name}; controle mental de uma fonte que não é o Mestre não o afeta.`);
    return { ok: true, bloqueadaPorVontadeDivina: true };
  }
  const jaRegistrada = (instancia.condicoes ?? []).some(raw => raw && typeof raw === 'object' &&
    normalizarCondicaoInvocacao((raw as { conditionId?: unknown }).conditionId as string | undefined) === id);
  if (jaRegistrada) return { ok: true, duplicada: true };
  const condicaoAtiva = {
    id: `mahoraga-condicao:${id}`,
    conditionId: id,
    name: condicao.name,
    icon: condicao.icon,
    remainingTurns: -1,
    remainingRounds: -1,
    sourceCharId: dono.id,
    sourceCharName: dono.name,
    sourceEntityId: 'dez-sombras:mahoraga',
    sourceInstanceId: instancia.id,
  };
  const atualizada = InstanciaInvocacaoSchema.parse({
    ...instancia,
    version: instancia.version + 1,
    condicoes: [...(instancia.condicoes ?? []), condicaoAtiva],
  });
  gravarInstancia(dono, atualizada);
  useMapStore.getState().updateEntity(token.id, {
    invocationConditionIds: [...new Set([...(token.invocationConditionIds ?? []), id])],
  });
  useLogStore.getState().addLog('combat', `☸️ O Mestre registrou ${condicao.name} em Mahoraga para acompanhar os giros de adaptação. A aplicação mecânica e a duração original da condição continuam sob adjudicação da mesa.`);
  return { ok: true };
}

/** Marca o fim de uma condição adjudicada e fixa a resistência permanente por grau. */
export function encerrarCondicaoMahoraga(
  donoId: string,
  invocacaoId: string,
  conditionId: string,
): { ok: true; bonusTRPermanente: number } | { ok: false; motivo: string } {
  if (useRoleStore.getState().role !== 'MASTER') return { ok: false, motivo: 'Somente o Mestre pode encerrar uma condição de Mahoraga.' };
  const id = normalizarCondicaoInvocacao(conditionId);
  const condicao = ALL_CONDITIONS.find(item => normalizarCondicaoInvocacao(item.id) === id);
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  const token = tokensInvocados(donoId).find(entity => entity.invocationId === invocacaoId && entity.invocationInstanceId);
  const instancia = token ? dono?.instanciasInvocacao?.find(item => item.id === token.invocationInstanceId) : undefined;
  if (!condicao || !dono || modelo?.subcategoria !== 'dez-sombras:mahoraga' || !token || !instancia) {
    return { ok: false, motivo: 'Mahoraga ou condição reconhecida não foi encontrado.' };
  }
  const condicoes = (instancia.condicoes ?? []).filter(raw => !(raw && typeof raw === 'object' &&
    normalizarCondicaoInvocacao((raw as { conditionId?: unknown }).conditionId as string | undefined) === id));
  const combate = useCombatStore.getState();
  const estado = normalizarEstadoMahoraga(instancia.estadoMahoraga, combate.inCombat ? combate.combatId ?? undefined : undefined);
  const estadoMahoraga = encerrarAdaptacaoCondicaoMahoraga(estado, id, { nome: condicao.name, grau: GRAU_CONDICAO[id] });
  const atualizada = InstanciaInvocacaoSchema.parse({
    ...instancia,
    version: instancia.version + 1,
    condicoes,
    estadoMahoraga,
  });
  gravarInstancia(dono, atualizada);
  const aindaAtiva = condicoes.some(raw => raw && typeof raw === 'object' &&
    normalizarCondicaoInvocacao((raw as { conditionId?: unknown }).conditionId as string | undefined) === id);
  useMapStore.getState().updateEntity(token.id, {
    invocationConditionIds: aindaAtiva
      ? [...new Set(token.invocationConditionIds ?? [])]
      : (token.invocationConditionIds ?? []).filter(item => normalizarCondicaoInvocacao(item) !== id),
  });
  const bonusTRPermanente = estadoMahoraga.adaptacoesCondicoes.find(item =>
    normalizarCondicaoInvocacao(item.conditionId) === id,
  )?.bonusTRPermanente ?? 0;
  useLogStore.getState().addLog('combat', `☸️ ${condicao.name} terminou em Mahoraga; resistência permanente contra essa condição: +${bonusTRPermanente} em TR.`);
  return { ok: true, bonusTRPermanente };
}

/** Permite ao Mestre registrar a ordem e a prioridade que Vontade Divina deve seguir. */
export function configurarVontadeDivinaMahoraga(
  donoId: string,
  invocacaoId: string,
  entrada: {
    prioridade: 'ultima_ordem' | 'eliminar_ameaca' | 'proteger_corpo';
    ultimaOrdem?: string;
    alvoPrioritarioId?: string;
  },
): { ok: true } | { ok: false; motivo: string } {
  if (useRoleStore.getState().role !== 'MASTER') return { ok: false, motivo: 'Somente o Mestre pode configurar a prioridade de Vontade Divina.' };
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  const token = tokensInvocados(donoId).find(entity => entity.invocationId === invocacaoId && entity.invocationInstanceId);
  const instancia = token ? dono?.instanciasInvocacao?.find(item => item.id === token.invocationInstanceId) : undefined;
  if (!dono || modelo?.subcategoria !== 'dez-sombras:mahoraga' || modelo.domado !== true || !instancia || !token) {
    return { ok: false, motivo: 'Vontade Divina requer Mahoraga materializado e permanentemente domado.' };
  }
  const ultimaOrdem = entrada.ultimaOrdem?.trim();
  const alvoInformado = entrada.alvoPrioritarioId?.trim();
  const alvoPrioritarioId = entrada.prioridade === 'eliminar_ameaca'
    ? alvoInformado?.startsWith('invoc:') ? alvoInformado.slice('invoc:'.length) : alvoInformado
    : undefined;
  if (entrada.prioridade === 'ultima_ordem' && !ultimaOrdem) {
    return { ok: false, motivo: 'Registre a última ordem do Controlador antes de selecionar essa prioridade.' };
  }
  if (entrada.prioridade === 'eliminar_ameaca' && !alvoPrioritarioId) {
    return { ok: false, motivo: 'Selecione no mapa o alvo que feriu ou ameaça o Controlador.' };
  }
  if (alvoPrioritarioId) {
    const alvoToken = useMapStore.getState().entities[alvoPrioritarioId];
    const alvoFicha = useCharacterStore.getState().characters.find(character => character.id === alvoPrioritarioId);
    if (!alvoToken && !alvoFicha) return { ok: false, motivo: 'O alvo prioritário não existe mais no combate.' };
    if (alvoToken && ((alvoToken.hp ?? 1) <= 0 || ['derrotada', 'dissipada'].includes(alvoToken.invocationState ?? ''))) {
      return { ok: false, motivo: 'O alvo prioritário já está derrotado ou fora de campo.' };
    }
    if (alvoFicha && (alvoFicha.hpCurrent ?? 1) <= 0) return { ok: false, motivo: 'O alvo prioritário já está sem PV.' };
  }
  const combate = useCombatStore.getState();
  const estado = normalizarEstadoMahoraga(instancia.estadoMahoraga, combate.inCombat ? combate.combatId ?? undefined : undefined);
  const anterior = estado.vontadeDivina;
  const atualizada = InstanciaInvocacaoSchema.parse({
    ...instancia,
    version: instancia.version + 1,
    estadoMahoraga: {
      ...estado,
      vontadeDivina: {
        ativa: anterior?.ativa ?? false,
        rodadasRestantes: anterior?.rodadasRestantes ?? 0,
        rodadasTotais: anterior?.rodadasTotais ?? 0,
        ...(combate.combatId ? { combateId: combate.combatId } : {}),
        ...(anterior?.ultimaRodadaProcessada !== undefined ? { ultimaRodadaProcessada: anterior.ultimaRodadaProcessada } : {}),
        prioridade: entrada.prioridade,
        ...(alvoPrioritarioId ? { alvoPrioritarioId } : {}),
        ...(ultimaOrdem ? { ultimaOrdem } : {}),
        ...(anterior?.bloqueadaAteRecuperar ? { bloqueadaAteRecuperar: true } : {}),
      },
    },
  });
  gravarInstancia(dono, atualizada);
  return { ok: true };
}

export async function comandarRegeneracaoAdaptativaMahoraga(
  donoId: string,
  invocacaoId: string,
  entrada: { requestId: string; modo: 'temporarios' | 'cura'; peAdicional: number; origemRoda?: boolean },
): Promise<
  | { ok: true; valorPV: number; modo: 'temporarios' | 'cura'; custoPE: number; categoriaAcao: CategoriaEconomiaInvocacao; hpAtual: number; pvTemporarios: number; formula: string; duplicado?: boolean }
  | { ok: false; motivo: string }
> {
  const requestId = entrada.requestId.trim();
  if (!requestId) return { ok: false, motivo: 'ID idempotente da regeneração é obrigatório.' };
  const obterAtual = () => {
    const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
    const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
    const token = tokensInvocados(donoId).find(entity => entity.invocationId === invocacaoId && entity.invocationInstanceId);
    const instancia = token ? dono?.instanciasInvocacao?.find(item => item.id === token.invocationInstanceId) : undefined;
    const acao = modelo?.acoes.find(item => item.id === 'regeneracao-adaptativa');
    return { dono, modelo, token, instancia, acao };
  };
  const inicial = obterAtual();
  if (!inicial.dono || inicial.modelo?.subcategoria !== 'dez-sombras:mahoraga' || !inicial.instancia || !inicial.token || !inicial.acao) {
    return { ok: false, motivo: 'Mahoraga não está materializado com a ação Regeneração Adaptativa.' };
  }
  const limitePEAdicional = limitePEAdicionalRegeneracaoMahoraga(inicial.modelo.atributos?.constituicao ?? 28);
  if (!Number.isInteger(entrada.peAdicional) || entrada.peAdicional < 0 || entrada.peAdicional > limitePEAdicional) {
    return { ok: false, motivo: `PE adicional deve ser um número inteiro entre 0 e ${limitePEAdicional} (modificador de Constituição + 8).` };
  }
  if (!podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };
  const duplicada = inicial.instancia.estadoMahoraga?.regeneracoesProcessadas.find(evento => evento.requestId === requestId);
  if (duplicada) return {
    ok: true,
    valorPV: duplicada.valorPV,
    modo: duplicada.modo,
    custoPE: duplicada.custoPE,
    categoriaAcao: duplicada.categoriaAcao,
    hpAtual: inicial.instancia.hpAtual,
    pvTemporarios: inicial.instancia.pvTemporarios ?? 0,
    formula: 'resultado já processado',
    duplicado: true,
  };
  if (inicial.instancia.estado !== 'ativa') return { ok: false, motivo: 'Mahoraga precisa estar ativo para regenerar.' };
  if (!Number.isInteger(inicial.instancia.hpAtual)) return { ok: false, motivo: 'PV atual de Mahoraga inválido.' };
  const custoPE = (entrada.modo === 'cura' ? 2 : 0) + entrada.peAdicional;
  const combateInicial = useCombatStore.getState();
  const estadoInicial = normalizarEstadoMahoraga(
    inicial.instancia.estadoMahoraga,
    combateInicial.inCombat ? combateInicial.combatId ?? undefined : undefined,
  );
  if (entrada.origemRoda && estadoInicial.regeneracoesRodaPendentes < 1) {
    return { ok: false, motivo: 'Não há giro da Roda aguardando uma Regeneração Adaptativa como Ação Simples.' };
  }
  if (entrada.modo === 'cura' && inicial.instancia.hpAtual >= inicial.instancia.hpMaximoAtual) {
    return { ok: false, motivo: 'Mahoraga já está com PV completos; escolha PV temporários para usar a regeneração.' };
  }
  const metadeInicial = inicial.instancia.hpAtual <= Math.ceil(inicial.instancia.hpMaximoAtual / 2);
  const regeneraLivreInicial = Boolean(combateInicial.inCombat && metadeInicial &&
    (estadoInicial.regeneracaoLivreUsada?.combateId !== (combateInicial.combatId ?? undefined) ||
      estadoInicial.regeneracaoLivreUsada?.rodada !== (combateInicial.round ?? 1)));
  const categoriaInicial: CategoriaEconomiaInvocacao = regeneraLivreInicial
    ? 'acaoLivre'
    : entrada.origemRoda
      ? categoriaEconomiaDaAcao({ ...inicial.acao, categoriaAcao: 'acao_simples' }, inicial.instancia.economiaAcoes) ?? 'acaoBonus'
      : categoriaEconomiaDaAcao(inicial.acao, inicial.instancia.economiaAcoes) ?? 'acaoComum';
  if ((inicial.instancia.economiaAcoes?.[categoriaInicial]?.atual ?? 0) < 1) {
    return { ok: false, motivo: `Ação ${categoriaInicial} indisponível; nenhuma rolagem foi iniciada.` };
  }
  if (!podeUsarAcaoDaInstancia(inicial.instancia, inicial.acao.id)) {
    return { ok: false, motivo: 'Regeneração Adaptativa ainda está em recarga; nenhuma rolagem foi iniciada.' };
  }
  const modeloDebitoInicial = custoPE > 0
    ? {
      ...inicial.modelo,
      custosComandosConfigurados: {
        ...inicial.modelo.custosComandosConfigurados,
        [inicial.acao.id]: { execucao: 'manual' as const, debitos: [{ entidade: 'dono' as const, recurso: 'pe' as const, quantidade: custoPE }] },
      },
    }
    : inicial.modelo;
  const debitoInicial = prepararDebitoComando(inicial.dono, modeloDebitoInicial, inicial.instancia, inicial.acao, custoPE);
  if (!debitoInicial.ok) return { ok: false, motivo: `${debitoInicial.motivo} Nenhuma rolagem foi iniciada.` };
  const formula = '4d12+1d8';
  const formulaBase = parseFormulaDanoInvocacao(formula);
  if (!formulaBase) return { ok: false, motivo: 'Fórmula oficial de Regeneração Adaptativa inválida.' };
  const formulaDados = stepDamage(formulaBase.dados, 8 + entrada.peAdicional * 2);
  const dadosRolados = await rollDiceGroups(formulaDados, { label: `${inicial.modelo.nome} — Regeneração Adaptativa (${entrada.modo})` });
  const valorPV = Math.max(0, Math.floor(dadosRolados.total + formulaBase.fixo));

  // Revalida o turno, estado, saldo, ação e ID após a rolagem antes de gravar qualquer recurso.
  const atual = obterAtual();
  if (!atual.dono || atual.modelo?.subcategoria !== 'dez-sombras:mahoraga' || !atual.instancia || !atual.token || !atual.acao) {
    return { ok: false, motivo: 'Mahoraga saiu do campo durante a rolagem; nenhum recurso foi gasto.' };
  }
  if (!podeComandarInvocacao(donoId, invocacaoId) || atual.instancia.id !== inicial.instancia.id || atual.instancia.estado !== 'ativa') {
    return { ok: false, motivo: 'O turno ou estado de Mahoraga mudou durante a rolagem; nenhum recurso foi gasto.' };
  }
  const estadoAtual = normalizarEstadoMahoraga(atual.instancia.estadoMahoraga, combateInicial.inCombat ? combateInicial.combatId ?? undefined : undefined);
  const eventoDuplicado = estadoAtual.regeneracoesProcessadas.find(evento => evento.requestId === requestId);
  if (eventoDuplicado) return {
    ok: true,
    valorPV: eventoDuplicado.valorPV,
    modo: eventoDuplicado.modo,
    custoPE: eventoDuplicado.custoPE,
    categoriaAcao: eventoDuplicado.categoriaAcao,
    hpAtual: atual.instancia.hpAtual,
    pvTemporarios: atual.instancia.pvTemporarios ?? 0,
    formula,
    duplicado: true,
  };
  const metadePV = atual.instancia.hpAtual <= Math.ceil(atual.instancia.hpMaximoAtual / 2);
  const turnoKey = combateInicial.combatId ?? undefined;
  const regeneraLivre = Boolean(combateInicial.inCombat && metadePV &&
    (estadoAtual.regeneracaoLivreUsada?.combateId !== turnoKey || estadoAtual.regeneracaoLivreUsada?.rodada !== (combateInicial.round ?? 1)));
  const categoriaAcao: CategoriaEconomiaInvocacao = regeneraLivre
    ? 'acaoLivre'
    : entrada.origemRoda
      ? categoriaEconomiaDaAcao({ ...atual.acao, categoriaAcao: 'acao_simples' }, atual.instancia.economiaAcoes) ?? 'acaoBonus'
      : categoriaEconomiaDaAcao(atual.acao, atual.instancia.economiaAcoes) ?? 'acaoComum';
  const categoriaValida = categoriaAcao === 'acaoLivre' || categoriaAcao === 'acaoBonus'
    ? atual.instancia.economiaAcoes?.[categoriaAcao]
    : atual.instancia.economiaAcoes?.[categoriaAcao];
  if (!categoriaValida || categoriaValida.atual < 1) {
    return { ok: false, motivo: `Ação ${categoriaAcao} indisponível; a rolagem não debitou recursos.` };
  }
  if (!podeUsarAcaoDaInstancia(atual.instancia, atual.acao.id)) {
    return { ok: false, motivo: 'Regeneração Adaptativa ainda está em recarga; a rolagem não debitou recursos.' };
  }
  if (entrada.origemRoda && estadoAtual.regeneracoesRodaPendentes < 1) {
    return { ok: false, motivo: 'O giro da Roda foi consumido antes da confirmação; nenhum recurso foi gasto.' };
  }
  const modeloComDebito = custoPE > 0
    ? {
      ...atual.modelo,
      custosComandosConfigurados: {
        ...atual.modelo.custosComandosConfigurados,
        [atual.acao.id]: { execucao: 'manual' as const, debitos: [{ entidade: 'dono' as const, recurso: 'pe' as const, quantidade: custoPE }] },
      },
    }
    : atual.modelo;
  const debito = prepararDebitoComando(atual.dono, modeloComDebito, atual.instancia, atual.acao, custoPE);
  if (!debito.ok) return { ok: false, motivo: `${debito.motivo} Nenhum recurso foi gasto.` };
  const gasto = gastarAcaoDaInstancia(atual.instancia, categoriaAcao, 1, requestId);
  if (!gasto.ok) return gasto;
  let estadoFinal = {
    ...estadoAtual,
    ...(regeneraLivre ? { regeneracaoLivreUsada: { ...(turnoKey ? { combateId: turnoKey } : {}), rodada: combateInicial.round ?? 1 } } : {}),
    ...(entrada.origemRoda ? { regeneracoesRodaPendentes: Math.max(0, estadoAtual.regeneracoesRodaPendentes - 1) } : {}),
  };
  const registro = {
    requestId,
    valorPV,
    modo: entrada.modo,
    custoPE,
    categoriaAcao,
    rodada: combateInicial.round ?? 1,
    ...(turnoKey ? { combateId: turnoKey } : {}),
  };
  estadoFinal = { ...estadoFinal, regeneracoesProcessadas: [...estadoFinal.regeneracoesProcessadas, registro].slice(-500) };
  let instanciaFinal = InstanciaInvocacaoSchema.parse({
    ...gasto.instancia,
    estadoMahoraga: estadoFinal,
    recursosAtuais: debito.recursosRestantes,
  });
  if (entrada.modo === 'cura') {
    const cura = aplicarCuraPVInvocacao(instanciaFinal, valorPV);
    if (!cura.ok) return { ok: false, motivo: cura.motivo };
    instanciaFinal = cura.instancia;
  } else {
    instanciaFinal = InstanciaInvocacaoSchema.parse({
      ...instanciaFinal,
      version: instanciaFinal.version + 1,
      pvTemporarios: (instanciaFinal.pvTemporarios ?? 0) + valorPV,
    });
  }
  gravarInstancia(atual.dono, instanciaFinal, { peCurrent: debito.peDonoRestante });
  const tokenAtual = useMapStore.getState().entities[atual.token.id];
  if (tokenAtual) useMapStore.getState().updateEntity(tokenAtual.id, {
    hp: instanciaFinal.hpAtual,
    hpMax: instanciaFinal.hpMaximoAtual,
    invocationTempHp: instanciaFinal.pvTemporarios ?? 0,
  });
  useLogStore.getState().addLog('combat', `💚 Regeneração Adaptativa de ${atual.modelo.nome}: ${valorPV} ${entrada.modo === 'cura' ? 'PV curados' : 'PV temporários'} (${formula}, +${8 + entrada.peAdicional * 2} níveis), ${custoPE} PE, ${categoriaAcao}.`);
  return {
    ok: true,
    valorPV,
    modo: entrada.modo,
    custoPE,
    categoriaAcao,
    hpAtual: instanciaFinal.hpAtual,
    pvTemporarios: instanciaFinal.pvTemporarios ?? 0,
    formula: `${formatDamage(formulaDados)}`,
  };
}

/** O Mestre registra a anatomia atingida; ferimentos e membros não têm estado nativo no mapa. */
export function registrarFerimentoMahoraga(
  donoId: string,
  invocacaoId: string,
  entrada: { descricao: string; ferimentoComplexo: boolean; membroSeparado?: string; membroDisponivel?: boolean },
): { ok: true; ferimentoId: string } | { ok: false; motivo: string } {
  if (useRoleStore.getState().role !== 'MASTER') return { ok: false, motivo: 'Somente o Mestre pode registrar ferimentos ou membros de Mahoraga.' };
  const descricao = entrada.descricao.trim();
  const membroSeparado = entrada.membroSeparado?.trim();
  if (!descricao || descricao.length > 120) return { ok: false, motivo: 'Informe uma descrição de até 120 caracteres.' };
  if (!entrada.ferimentoComplexo && !membroSeparado) return { ok: false, motivo: 'Registre um ferimento complexo, um membro separado ou ambos.' };
  if (membroSeparado && membroSeparado.length > 80) return { ok: false, motivo: 'O nome do membro deve ter até 80 caracteres.' };

  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  const token = tokensInvocados(donoId).find(entity => entity.invocationId === invocacaoId && entity.invocationInstanceId);
  const instancia = token ? dono?.instanciasInvocacao?.find(item => item.id === token.invocationInstanceId) : undefined;
  if (!dono || modelo?.subcategoria !== 'dez-sombras:mahoraga' || !token || !instancia ||
    (instancia.estado !== 'ativa' && instancia.estado !== 'caida')) {
    return { ok: false, motivo: 'Mahoraga ativo ou caído em campo não foi encontrado.' };
  }
  const combate = useCombatStore.getState();
  const estado = normalizarEstadoMahoraga(instancia.estadoMahoraga, combate.inCombat ? combate.combatId ?? undefined : undefined);
  const ferimentoId = novoIdInvocacao('mahoraga-ferimento');
  const ferimento = {
    id: ferimentoId,
    descricao,
    ferimentoAtivo: entrada.ferimentoComplexo,
    ...(membroSeparado ? { membroSeparado } : {}),
    membroDisponivel: Boolean(membroSeparado && entrada.membroDisponivel),
    membroReanexado: false,
  };
  const atualizada = InstanciaInvocacaoSchema.parse({
    ...instancia,
    version: instancia.version + 1,
    estadoMahoraga: { ...estado, ferimentosComplexos: [...estado.ferimentosComplexos, ferimento].slice(-50) },
  });
  gravarInstancia(dono, atualizada);
  useLogStore.getState().addLog('combat', `O Mestre registrou em ${modelo.nome}: ${descricao}${membroSeparado ? `; membro separado: ${membroSeparado}${entrada.membroDisponivel ? ' (disponível para reanexar)' : ' (não disponível)'}` : ''}.`);
  return { ok: true, ferimentoId };
}

/** Recupera um ferimento complexo (8 PE) ou reanexa um membro presente (4 PE e Ação Simples). */
export function comandarRecuperacaoFerimentoMahoraga(
  donoId: string,
  invocacaoId: string,
  entrada: { requestId: string; ferimentoId: string; operacao: 'curar_ferimento' | 'reanexar_membro' },
): { ok: true; custoPE: number; categoriaAcao: CategoriaEconomiaInvocacao; duplicado?: boolean } | { ok: false; motivo: string } {
  const requestId = entrada.requestId.trim();
  if (!requestId || requestId.length > 120) return { ok: false, motivo: 'ID idempotente da recuperação é obrigatório e deve ter até 120 caracteres.' };
  if (!podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  const token = tokensInvocados(donoId).find(entity => entity.invocationId === invocacaoId && entity.invocationInstanceId);
  const instancia = token ? dono?.instanciasInvocacao?.find(item => item.id === token.invocationInstanceId) : undefined;
  const acao = modelo?.acoes.find(item => item.id === 'regeneracao-adaptativa');
  if (!dono || modelo?.subcategoria !== 'dez-sombras:mahoraga' || !token || !instancia || !acao || instancia.estado !== 'ativa') {
    return { ok: false, motivo: 'Mahoraga precisa estar ativo em campo com a Regeneração Adaptativa.' };
  }
  const combateInicial = useCombatStore.getState();
  const estado = normalizarEstadoMahoraga(instancia.estadoMahoraga, combateInicial.inCombat ? combateInicial.combatId ?? undefined : undefined);
  const processada = estado.recuperacoesFerimentoProcessadas.find(item => item.requestId === requestId);
  if (processada) return { ok: true, custoPE: processada.custoPE, categoriaAcao: processada.categoriaAcao, duplicado: true };
  const ferimento = estado.ferimentosComplexos.find(item => item.id === entrada.ferimentoId);
  if (!ferimento) return { ok: false, motivo: 'Este ferimento não está mais registrado em Mahoraga.' };
  if (entrada.operacao === 'curar_ferimento' && !ferimento.ferimentoAtivo) {
    return { ok: false, motivo: 'Este registro não tem um Ferimento Complexo ativo.' };
  }
  if (entrada.operacao === 'curar_ferimento' && ferimento.membroSeparado && ferimento.membroDisponivel && !ferimento.membroReanexado) {
    return { ok: false, motivo: 'O membro está disponível: use a reanexação por 4 PE e Ação Simples.' };
  }
  if (entrada.operacao === 'reanexar_membro' && (!ferimento.membroSeparado || ferimento.membroReanexado || !ferimento.membroDisponivel)) {
    return { ok: false, motivo: 'O membro separado precisa estar registrado como disponível para reanexação.' };
  }
  if (!podeUsarAcaoDaInstancia(instancia, acao.id)) return { ok: false, motivo: 'Regeneração Adaptativa ainda está em recarga.' };

  const custoPE = entrada.operacao === 'curar_ferimento' ? 8 : 4;
  const acaoUso = entrada.operacao === 'reanexar_membro' ? { ...acao, categoriaAcao: 'acao_simples' as const } : acao;
  const categoriaAcao = categoriaEconomiaDaAcao(acaoUso, instancia.economiaAcoes) ??
    (entrada.operacao === 'reanexar_membro' ? 'acaoSimples' : 'acaoComplexa');
  if ((instancia.economiaAcoes?.[categoriaAcao]?.atual ?? 0) < 1) {
    return { ok: false, motivo: `Ação ${categoriaAcao} indisponível; nenhum PE foi gasto.` };
  }
  const modeloComDebito = {
    ...modelo,
    custosComandosConfigurados: {
      ...modelo.custosComandosConfigurados,
      [acao.id]: { execucao: 'manual' as const, debitos: [{ entidade: 'dono' as const, recurso: 'pe' as const, quantidade: custoPE }] },
    },
  };
  const debito = prepararDebitoComando(dono, modeloComDebito, instancia, acao, custoPE);
  if (!debito.ok) return { ok: false, motivo: `${debito.motivo} Nenhum recurso foi gasto.` };
  const gasto = gastarAcaoDaInstancia(instancia, categoriaAcao, 1, requestId);
  if (!gasto.ok) return gasto;

  const ferimentosComplexos = estado.ferimentosComplexos.map(item => item.id !== ferimento.id
    ? item
    : entrada.operacao === 'curar_ferimento'
      ? { ...item, ferimentoAtivo: false }
      : { ...item, ferimentoAtivo: false, membroDisponivel: false, membroReanexado: true });
  const registro = {
    requestId,
    ferimentoId: ferimento.id,
    operacao: entrada.operacao,
    custoPE,
    categoriaAcao,
    rodada: combateInicial.round ?? 1,
    ...(combateInicial.combatId ? { combateId: combateInicial.combatId } : {}),
  };
  const instanciaFinal = InstanciaInvocacaoSchema.parse({
    ...gasto.instancia,
    version: gasto.instancia.version + 1,
    recursosAtuais: debito.recursosRestantes,
    estadoMahoraga: {
      ...estado,
      ferimentosComplexos,
      recuperacoesFerimentoProcessadas: [...estado.recuperacoesFerimentoProcessadas, registro].slice(-500),
    },
  });
  gravarInstancia(dono, instanciaFinal, { peCurrent: debito.peDonoRestante });
  useLogStore.getState().addLog('combat', entrada.operacao === 'curar_ferimento'
    ? `${modelo.nome} regenerou o Ferimento Complexo registrado (${custoPE} PE, ${categoriaAcao}).`
    : `${modelo.nome} reanexou ${ferimento.membroSeparado} (${custoPE} PE, Ação Simples).`);
  return { ok: true, custoPE, categoriaAcao };
}

export function comandarAtaqueAdaptativoMahoraga(
  donoId: string,
  invocacaoId: string,
  entrada: { tipoDano: DamageType; requestId: string },
): { ok: true; tipoDano: DamageType } | { ok: false; motivo: string } {
  const requestId = entrada.requestId.trim();
  if (!requestId) return { ok: false, motivo: 'ID idempotente do Ataque Adaptativo é obrigatório.' };
  if (!podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  const token = tokensInvocados(donoId).find(entity => entity.invocationId === invocacaoId && entity.invocationInstanceId);
  const instancia = token ? dono?.instanciasInvocacao?.find(item => item.id === token.invocationInstanceId) : undefined;
  const acao = modelo?.acoes.find(item => item.id === 'ataque-adaptativo');
  if (!dono || modelo?.subcategoria !== 'dez-sombras:mahoraga' || !instancia || !token || !acao) {
    return { ok: false, motivo: 'Mahoraga não está materializado com Ataque Adaptativo disponível.' };
  }
  if (instancia.estado !== 'ativa') return { ok: false, motivo: 'Mahoraga precisa estar ativo para adaptar o próximo ataque.' };
  if (instancia.eventosAcoesProcessados?.includes(requestId)) {
    return instancia.estadoMahoraga?.ataqueAdaptativoTipo
      ? { ok: true, tipoDano: instancia.estadoMahoraga.ataqueAdaptativoTipo }
      : { ok: false, motivo: 'Este Ataque Adaptativo já foi consumido.' };
  }
  const combate = useCombatStore.getState();
  const estado = normalizarEstadoMahoraga(instancia.estadoMahoraga, combate.inCombat ? combate.combatId ?? undefined : undefined);
  const fenômenoDisponivel = estado.fenomenos.some(fenomeno => fenomeno.giros === 5 && fenomeno.tipoDano === entrada.tipoDano);
  if (!fenômenoDisponivel) return { ok: false, motivo: 'A Roda ainda não completou os cinco giros necessários para carregar essa propriedade.' };
  if (estado.ataqueAdaptativoTipo) return { ok: false, motivo: 'Um tipo de dano já está preparado para o próximo ataque.' };
  const categoria = categoriaEconomiaDaAcao(acao, instancia.economiaAcoes);
  if (!categoria) return { ok: false, motivo: 'Ação Simples não configurada na economia de Mahoraga.' };
  const debito = prepararDebitoComando(dono, modelo, instancia, acao, 0);
  if (!debito.ok) return debito;
  const gasto = gastarAcaoDaInstancia(instancia, categoria, 1, requestId);
  if (!gasto.ok) return gasto;
  const instanciaAtualizada = InstanciaInvocacaoSchema.parse({
    ...gasto.instancia,
    estadoMahoraga: { ...estado, ataqueAdaptativoTipo: entrada.tipoDano },
  });
  gravarInstancia(dono, instanciaAtualizada, { peCurrent: debito.peDonoRestante });
  useLogStore.getState().addLog('combat', `☸️ ${modelo.nome}: Ataque Adaptativo preparado para o próximo golpe (${entrada.tipoDano}); propriedade registrada pela Roda.`);
  return { ok: true, tipoDano: entrada.tipoDano };
}

export function removerFragilizadoFugaCoelhos(
  donoId: string,
  tokenId: string,
  instanciaEsperadaId: string,
): { ok: true } | { ok: false; motivo: string } {
  const dono = useCharacterStore.getState().characters.find(personagem => personagem.id === donoId);
  const token = useMapStore.getState().entities[tokenId];
  if (!dono || !token || token.ownerCharId !== donoId || token.invocationId !== dono.invocacoesConhecidas?.find(modelo =>
    modelo.subcategoria === 'dez-sombras:fuga-do-coelho',
  )?.id) return { ok: false, motivo: 'A Horda dos Coelhos não está mais disponível.' };
  const instancia = dono.instanciasInvocacao?.find(item => item.id === instanciaEsperadaId);
  if (!instancia || instancia.tokenId !== tokenId) return { ok: false, motivo: 'A instância da Horda mudou antes da atualização.' };
  const condicoes = instancia.condicoes ?? [];
  const restantes = condicoes.filter(condicao =>
    !(typeof condicao === 'object' && condicao !== null &&
      (condicao as { conditionId?: unknown }).conditionId === 'fragilizado' &&
      (condicao as { sourceEntityId?: unknown }).sourceEntityId === 'dez-sombras:fuga-do-coelho'),
  );
  if (restantes.length === condicoes.length) return { ok: false, motivo: 'A Horda não está Fragilizada.' };
  const atualizada = InstanciaInvocacaoSchema.parse({
    ...instancia,
    version: instancia.version + 1,
    condicoes: restantes,
  });
  gravarInstancia(dono, atualizada);
  useMapStore.getState().updateEntity(tokenId, {
    invocationConditionIds: restantes.flatMap(condicao =>
      typeof condicao === 'object' && condicao !== null &&
      typeof (condicao as { conditionId?: unknown }).conditionId === 'string'
        ? [(condicao as { conditionId: string }).conditionId]
        : [],
    ),
  });
  useLogStore.getState().addLog('combat', `🐇 Fragilizada removida de ${dono.invocacoesConhecidas?.find(modelo => modelo.id === instancia.modeloId)?.nome ?? 'Fuga dos Coelhos'} por resolução manual.`);
  return { ok: true };
}

function atualizarEfeitosSuporteInvocacao(
  personagem: Character,
  modelo: InvocacaoControlador,
  tokenId: string,
  instancia: InstanciaInvocacao,
  efeitos: NonNullable<InstanciaInvocacao['efeitosSuporteAtivos']>,
): InstanciaInvocacao {
  const maisRecente = useCharacterStore.getState().characters.find(c => c.id === personagem.id)
    ?.instanciasInvocacao?.find(item => item.id === instancia.id) ?? instancia;
  const atualizada = InstanciaInvocacaoSchema.parse({
    ...maisRecente,
    version: maisRecente.version + 1,
    efeitosSuporteAtivos: efeitos,
  });
  gravarInstancia(personagem, atualizada);
  const bonusDefesa = efeitos
    .filter(efeito => efeito.tipo === 'defesa' && efeito.expiraNaRodada >= (useCombatStore.getState().round ?? 1))
    .reduce((total, efeito) => total + efeito.valor, 0);
  useMapStore.getState().updateEntity(tokenId, { invocationDefense: modelo.defesa + bonusDefesa });
  return atualizada;
}

/** Remove bônus expirados de todas as instâncias e atualiza a CA dos tokens. */
export function expirarEfeitosSuporteInvocacoes(ateRodada: number, limparTudo = false): void {
  const personagens = [...useCharacterStore.getState().characters];
  for (const snapshot of personagens) {
    for (const instanciaSnapshot of snapshot.instanciasInvocacao ?? []) {
      const efeitos = instanciaSnapshot.efeitosSuporteAtivos;
      if (!efeitos?.length) continue;
      const restantes = limparTudo ? [] : efeitos.filter(efeito => efeito.expiraNaRodada > ateRodada);
      if (restantes.length === efeitos.length) continue;
      const personagem = useCharacterStore.getState().characters.find(item => item.id === snapshot.id);
      if (!personagem) continue;
      const instancia = personagem.instanciasInvocacao?.find(item => item.id === instanciaSnapshot.id);
      const modelo = personagem.invocacoesConhecidas?.find(item => item.id === instanciaSnapshot.modeloId);
      if (!instancia || !modelo) continue;
      atualizarEfeitosSuporteInvocacao(personagem, modelo, instancia.tokenId, instancia, restantes);
    }
  }
}

/** Cura PV da instância sem levantar automaticamente uma criatura que já estava Caída. */
export function curarInvocacao(tokenId: string, cura: number): { ok: true; hpRestante: number; caida: boolean } | { ok: false; motivo: string } {
  const mapa = useMapStore.getState();
  const token = mapa.entities[tokenId];
  if (!token?.ownerCharId || !token.invocationId) return { ok: false, motivo: 'Token não pertence a uma invocação.' };
  const dono = useCharacterStore.getState().characters.find(c => c.id === token.ownerCharId);
  if (!dono) return { ok: false, motivo: 'Dono da invocação não encontrado.' };
  const modelo = obterModeloDoToken(dono, token);
  if (!modelo) return { ok: false, motivo: 'Modelo da invocação não encontrado.' };
  const atual = obterInstanciaDoToken(dono, token, modelo);
  const resultado = aplicarCuraPVInvocacao(atual, cura);
  if (!resultado.ok) return resultado;
  if (resultado.instancia.limiarPerdaHorda) {
    resultado.instancia = InstanciaInvocacaoSchema.parse({ ...resultado.instancia,
      limiarPerdaHorda: acumularCuraParaLimiarHorda(resultado.instancia.limiarPerdaHorda, resultado.instancia.hpAtual - atual.hpAtual) });
  }
  gravarInstancia(dono, resultado.instancia);
  mapa.updateEntity(tokenId, {
    hp: resultado.instancia.hpAtual,
    invocationTempHp: resultado.instancia.pvTemporarios ?? 0,
    invocationState: resultado.instancia.estado,
    invocationInstanceId: resultado.instancia.id,
  });
  return { ok: true, hpRestante: resultado.instancia.hpAtual, caida: resultado.instancia.estado === 'caida' };
}

/** Aplica a cura da Aura da Quietude uma vez no começo do turno real do aliado. */
export function resolverAuraQuietudeInicioTurno(charId: string): number {
  const combate = useCombatStore.getState();
  const turnoIndex = combate.currentTurnIndex;
  const combateId = combate.combatId;
  const rodada = combate.round ?? 1;
  if (!combate.inCombat || !combateId || combate.initiativeOrder[turnoIndex]?.charId !== charId) return 0;
  const personagens = useCharacterStore.getState().characters;
  const mapa = useMapStore.getState();
  const tokenAtorRitual = mapa.entities[charId];
  const ator = personagens.find(character => character.id === charId) ??
    (tokenAtorRitual?.masterControlled && tokenAtorRitual.ritualId && tokenAtorRitual.ownerCharId
      ? personagens.find(character => character.id === tokenAtorRitual.ownerCharId)
      : undefined);
  if (!ator) return 0;
  const alvos: Array<{ chave: string; token: Entity; dono: Character }> = [];
  if (tokenAtorRitual?.masterControlled && tokenAtorRitual.ritualId && tokenAtorRitual.invocationId &&
    tokenAtorRitual.invocationInstanceId && tokenVisivel(tokenAtorRitual, mapa.layerVisible) &&
    (tokenAtorRitual.hp ?? 0) > 0 && (!tokenAtorRitual.invocationState || tokenAtorRitual.invocationState === 'ativa')) {
    const modeloAtor = ator.invocacoesConhecidas?.find(item => item.id === tokenAtorRitual.invocationId);
    const instanciaAtor = ator.instanciasInvocacao?.find(item => item.id === tokenAtorRitual.invocationInstanceId);
    if (modeloAtor && instanciaAtor?.estado === 'ativa') {
      alvos.push({ chave: `invocacao:${instanciaAtor.id}`, token: tokenAtorRitual, dono: ator });
    }
  }
  const tokensAtor = Object.values(mapa.entities).filter(token => token.characterId === charId && !token.invocationId && tokenVisivel(token, mapa.layerVisible));
  for (const tokenAtor of tokensAtor) alvos.push({ chave: `ficha:${charId}`, token: tokenAtor, dono: ator });
  for (const token of Object.values(mapa.entities)) {
    if (token.ownerCharId !== charId || !token.invocationId || !tokenVisivel(token, mapa.layerVisible) ||
      (token.hp ?? 0) <= 0 || (token.invocationState && token.invocationState !== 'ativa')) continue;
    const modelo = ator.invocacoesConhecidas?.find(item => item.id === token.invocationId);
    if (!modelo) continue;
    const instancia = obterInstanciaDoToken(ator, token, modelo);
    if (instancia.estado !== 'ativa') continue;
    alvos.push({ chave: `invocacao:${instancia.id}`, token, dono: ator });
  }
  if (!alvos.length) return 0;

  let totalCurado = 0;
  for (const donoCervo of personagens) {
    for (const modeloCervo of donoCervo.invocacoesConhecidas ?? []) {
      if (modeloCervo.subcategoria !== 'dez-sombras:cervo-circular') continue;
      const tokensCervo = tokensInvocados(donoCervo.id).filter(token => token.invocationId === modeloCervo.id &&
        tokenVisivel(token, mapa.layerVisible) && (token.hp ?? 0) > 0 && (!token.invocationState || token.invocationState === 'ativa'));
      for (const tokenCervo of tokensCervo) {
        const instanciaCervo = obterInstanciaDoToken(donoCervo, tokenCervo, modeloCervo);
        if (instanciaCervo.estado !== 'ativa') continue;
        for (const alvo of alvos) {
          if (!mesmaEquipeNoMapa(donoCervo, tokenCervo, ator, alvo.token)) continue;
          if (!tokenEmRaioCircular(tokenCervo, alvo.token, mapa.gridConfig, CERVO_AURA_RAIO_M)) continue;
          const evento = `${combateId}:${rodada}:${turnoIndex}:${charId}:${alvo.chave}`;
          if (instanciaCervo.eventosAuraQuietudeProcessados?.includes(evento)) continue;
          const donoAtual = useCharacterStore.getState().characters.find(character => character.id === donoCervo.id);
          const tokenAtual = useMapStore.getState().entities[tokenCervo.id];
          const modeloAtual = donoAtual?.invocacoesConhecidas?.find(item => item.id === modeloCervo.id);
          if (!donoAtual || !tokenAtual || !modeloAtual) continue;
          const instanciaAtual = obterInstanciaDoToken(donoAtual, tokenAtual, modeloAtual);
          if (instanciaAtual.estado !== 'ativa') continue;
          const marcada = InstanciaInvocacaoSchema.parse({
            ...instanciaAtual,
            version: instanciaAtual.version + 1,
            eventosAuraQuietudeProcessados: [...(instanciaAtual.eventosAuraQuietudeProcessados ?? []), evento].slice(-500),
          });
          gravarInstancia(donoAtual, marcada);

          if (alvo.token.invocationId) {
            const antes = alvo.token.hp ?? 0;
            const curada = curarInvocacao(alvo.token.id, CERVO_AURA_CURA);
            if (curada.ok) {
              const depois = useMapStore.getState().entities[alvo.token.id]?.hp ?? antes;
              totalCurado += Math.max(0, depois - antes);
            }
          } else {
            const antes = useCharacterStore.getState().characters.find(character => character.id === charId)?.hpCurrent ?? 0;
            useCharacterStore.getState().applyHealing(charId, CERVO_AURA_CURA, 'cursed_energy_external', donoCervo.id);
            const depois = useCharacterStore.getState().characters.find(character => character.id === charId)?.hpCurrent ?? antes;
            totalCurado += Math.max(0, depois - antes);
          }
        }
      }
    }
  }
  if (totalCurado > 0) {
    const nomeAtor = tokenAtorRitual?.label || ator.name;
    useLogStore.getState().addLog('combat', `🦌 Aura da Quietude: ${nomeAtor} e seus aliados recuperam ${totalCurado} PV no início do turno.`);
  }
  return totalCurado;
}

/** A Neutralização dura até o próximo turno do alvo; o campo impede expiração por outra causa. */
export function expirarSupressaoTecnicaInicioTurno(charId: string): number {
  const alvo = useCharacterStore.getState().characters.find(character => character.id === charId);
  if (!alvo) return 0;
  const removidas = (alvo.activeConditions ?? []).filter(condition => condition.conditionId === 'tecnica-inata-suprimida' &&
    condition.expiraNoInicioDoTurnoDe === charId);
  for (const condition of removidas) useCharacterStore.getState().removeCondition(charId, condition.id);
  if (removidas.length) useLogStore.getState().addLog('combat', `🔔 ${alvo.name}: a supressão da técnica inata terminou no início do turno.`);
  return removidas.length;
}

/** Levantar exige PV acima de 0 e uma Ação de Movimento disponível na própria instância. */
export function levantarInvocacao(donoId: string, invocacaoId: string): { ok: true } | { ok: false; motivo: string } {
  const dono = useCharacterStore.getState().characters.find(c => c.id === donoId);
  if (!dono) return { ok: false, motivo: 'Personagem inválido.' };
  const token = tokensInvocados(donoId).find(entity => entity.invocationId === invocacaoId);
  if (!token) return { ok: false, motivo: 'A instância não está no mapa.' };
  const modelo = obterModeloDoToken(dono, token);
  if (!modelo) return { ok: false, motivo: 'Modelo da invocação não encontrado.' };
  const atual = obterInstanciaDoToken(dono, token, modelo);
  const resultado = levantarInstanciaInvocacao(atual);
  if (!resultado.ok) return resultado;
  gravarInstancia(dono, resultado.instancia);
  useMapStore.getState().updateEntity(token.id, {
    hp: resultado.instancia.hpAtual,
    invocationState: 'ativa',
    invocationInstanceId: resultado.instancia.id,
  });
  return { ok: true };
}

/** Primeiro comando da Fase 4: uma Ação Livre própria reposiciona um servo em
 * uma célula livre. Não cria novo turno na iniciativa nem movimento gratuito.
 */
export function comandarReposicionamento(
  donoId: string,
  invocacaoId: string,
  direcao: DirecaoInvocacao,
  instanciaId?: string,
): { ok: true } | { ok: false; motivo: string } {
  const dono = useCharacterStore.getState().characters.find(c => c.id === donoId);
  if (!dono) return { ok: false, motivo: 'Personagem inválido.' };
  if (!podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'Só é possível comandar no turno do Controlador.' };
  const token = tokensInvocados(donoId).find(e => e.invocationId === invocacaoId && (!instanciaId || e.invocationInstanceId === instanciaId));
  if (!token || (token.hp ?? 0) <= 0) return { ok: false, motivo: 'Invocação não está ativa.' };
  const modelo = obterModeloDoToken(dono, token);
  if (!modelo) return { ok: false, motivo: 'Modelo da invocação não encontrado.' };
  const instancia = obterInstanciaDoToken(dono, token, modelo);
  const saldo = instancia.economiaAcoes?.acaoLivre;
  if (!saldo || saldo.atual < 1) return { ok: false, motivo: 'Ação Livre própria indisponível.' };
  const mapa = useMapStore.getState();
  const passo = mapa.gridConfig.dpi;
  if (!(passo > 0) || !(mapa.gridConfig.metersPerCell > 0)) return { ok: false, motivo: 'Grade inválida.' };
  const deltas: Record<DirecaoInvocacao, [number, number]> = {
    norte: [0, -1], sul: [0, 1], leste: [1, 0], oeste: [-1, 0],
  };
  if (!deltas[direcao]) return { ok: false, motivo: 'Direção inválida.' };
  const [dx, dy] = deltas[direcao];
  const x = token.x + dx * passo, y = token.y + dy * passo;
  const ocupado = Object.values(mapa.entities).some(e => e.id !== token.id && e.layer !== 'map' && !e.hidden &&
    Math.abs((e.x + e.w / 2) - (x + token.w / 2)) < passo * .45 &&
    Math.abs((e.y + e.h / 2) - (y + token.h / 2)) < passo * .45);
  if (ocupado) return { ok: false, motivo: 'Destino ocupado.' };
  const gasto = gastarAcaoDaInstancia(instancia, 'acaoLivre');
  if (!gasto.ok) return gasto;
  gravarInstancia(dono, gasto.instancia);
  mapa.updateEntity(token.id, { x, y });
  return { ok: true };
}


/** Quantidade de comandos complexos obtida por Ação Comum, com progressão modular. */
export function comandosPorAcao(nivel: number): number {
  return nivel >= 18 ? 4 : nivel >= 12 ? 3 : nivel >= 6 ? 2 : 1;
}

const ataquesPendentes = new Set<string>();
const suportesPendentes = new Set<string>();
const agarrarGamaPendentes = new Set<string>();
const agarrarOrochiPendentes = new Set<string>();

type ResultadoAlvoAtaqueInvocacao = {
  alvoId: string;
  nomeAlvo: string;
  acertou: boolean;
  totalAtaque: number;
  dano: number;
  critico?: boolean;
  vantagemEmergir?: boolean;
  efeitoOpcional?: { tipo: 'agarrar_gama' | 'agarrar_orochi'; custoPE: number };
  testePendente?: boolean;
  requestId?: string;
  cd?: number;
};
type ResultadoAtaqueUnicoInvocacao = { ok: true } & Omit<ResultadoAlvoAtaqueInvocacao, 'alvoId' | 'nomeAlvo'>;
type ResultadoAtaqueMultiploInvocacao = { ok: true; resultados: ResultadoAlvoAtaqueInvocacao[] };
type SelecaoAlvoAreaInvocacao = { tipo: 'area' };

function validarAcaoAtaqueInvocacao(acao: InvocacaoControlador['acoes'][number]): string | null {
  const tipoTeste = acao.teste ?? (acao.tipo === 'ataque' ? 'ataque' : undefined);
  if (tipoTeste !== 'ataque' && tipoTeste !== 'resistencia') return 'Ação sem ataque ou teste de resistência configurado.';
  if (tipoTeste === 'ataque' && !acao.dano) return 'Configure a fórmula de dano deste ataque.';
  if (tipoTeste === 'resistencia' && !acao.resistenciaAlvo?.trim()) return 'Configure qual Teste de Resistência o alvo fará.';
  if (tipoTeste === 'resistencia' && !DEFAULT_SAVING_THROWS.some(nome => nome.toLocaleLowerCase('pt-BR') === acao.resistenciaAlvo!.trim().toLocaleLowerCase('pt-BR'))) {
    return 'Teste de Resistência não reconhecido para esta ação.';
  }
  return null;
}

function formaTemplateArea(forma: NonNullable<AcaoAtivaConfig['area']>['forma']): MapTemplate['kind'] {
  if (forma === 'cone') return 'cone_attached';
  if (forma === 'linha') return 'line';
  return 'circle';
}

type ConfiguracaoAreaInvocacao = Pick<AcaoAtivaConfig, 'area' | 'alcanceM' | 'tipo_alvo' | 'filtro_alvo' | 'max_alvos'>;

function configuracaoAreaInvocacao(
  acao: InvocacaoControlador['acoes'][number],
  configuracaoOmni?: AcaoAtivaConfig,
): ConfiguracaoAreaInvocacao | undefined {
  if (configuracaoOmni?.tipo_alvo === 'area') return configuracaoOmni;
  if (!acao.area) return undefined;
  return {
    area: acao.area,
    alcanceM: acao.alcanceM ?? 0,
    tipo_alvo: 'area',
    filtro_alvo: acao.filtro_alvo ?? 'todos_exceto_si',
  };
}

function montarTemplateAreaInvocacao(
  cfg: ConfiguracaoAreaInvocacao,
  servo: Entity,
  dono: Character,
  nomeAcao: string,
): Promise<{ ok: true; template: MapTemplate } | { ok: false; motivo: string }> {
  const area = cfg.area;
  if (!area) return Promise.resolve({ ok: false, motivo: 'A ação não tem uma área configurada.' });
  const mapa = useMapStore.getState();
  const dpi = mapa.gridConfig.dpi || 70;
  const metrosPorCelula = mapa.gridConfig.metersPerCell || 1.5;
  if (!(dpi > 0) || !(metrosPorCelula > 0)) {
    return Promise.resolve({ ok: false, motivo: 'Grade inválida para posicionar a área.' });
  }
  const pixelsPorMetro = dpi / metrosPorCelula;
  const origem = { x: servo.x + servo.w / 2, y: servo.y + servo.h / 2 };
  const kind = formaTemplateArea(area.forma);
  const comprimento = area.tamanho_m * pixelsPorMetro;
  const largura = (area.largura_m ?? 1.5) * pixelsPorMetro;
  const templateBase: MapTemplate = {
    id: 'omni-invocacao-area', kind, x: origem.x, y: origem.y, rotation: 0,
    length: comprimento, width: area.forma === 'linha' ? largura : comprimento,
    color: '#ff5577', opacity: 1,
  };
  if (area.forma === 'raio_em_si') return Promise.resolve({ ok: true, template: templateBase });

  const maxRangeMeters = area.forma === 'raio_no_ponto' ? cfg.alcanceM : undefined;
  return mapa.requestAoEPlacement({
    kind,
    sizeMeters: area.tamanho_m,
    widthMeters: area.forma === 'linha' ? area.largura_m ?? 1.5 : undefined,
    sourceLabel: `${dono.name} · ${nomeAcao}`,
    originWorld: origem,
    ...(maxRangeMeters !== undefined ? { maxRangeMeters } : {}),
  }).then(colocado => {
    if (!colocado) return { ok: false as const, motivo: 'Posicionamento da área cancelado.' };
    const ancoraOrigem = area.forma === 'cone' || area.forma === 'linha';
    return {
      ok: true as const,
      template: {
        ...templateBase,
        x: ancoraOrigem ? origem.x : colocado.x,
        y: ancoraOrigem ? origem.y : colocado.y,
        rotation: area.forma === 'raio_no_ponto' ? 0 : colocado.rotation,
      },
    };
  });
}

function filtroAceitaPersonagemNaArea(
  dono: Character,
  alvo: Character,
  cfg: ConfiguracaoAreaInvocacao,
): boolean {
  const filtro = cfg.filtro_alvo ?? 'todos_exceto_si';
  // "Si" é o token do Shikigami, removido da geometria abaixo. O Controlador
  // continua sendo um alvo válido quando a área ou o filtro o incluem.
  if (filtro === 'todos' || filtro === 'todos_exceto_si') return true;
  return aceitaAlvoAtivo(dono, alvo, {
    id: 'area-invocacao', nome: 'Área de invocação', acao: 'comum', custoPE: '0', teste: 'nenhum',
    ...cfg, filtro_alvo: filtro,
  });
}

function resolverAlvosDaAreaInvocacao(
  cfg: ConfiguracaoAreaInvocacao,
  dono: Character,
  servo: Entity,
  template: MapTemplate,
): { ok: true; ids: string[] } | { ok: false; motivo: string } {
  const mapa = useMapStore.getState();
  const characters = useCharacterStore.getState().characters;
  const entidadesVisiveis = Object.fromEntries(Object.entries(mapa.entities)
    .filter(([, entity]) => !entity.hidden && mapa.layerVisible[entity.layer ?? 'tokens'] !== false));
  const entityIds = findEntitiesInTemplate(template, entidadesVisiveis);
  const filtro = cfg.filtro_alvo ?? 'todos_exceto_si';
  const servosAtingidos = entityIds
    .map(id => mapa.entities[id])
    .filter((entity): entity is Entity => Boolean(entity?.invocationId && entity.id !== servo.id));
  const idsServos: string[] = [];
  for (const entity of servosAtingidos) {
    const donoAlvo = entity.ownerCharId
      ? characters.find(character => character.id === entity.ownerCharId)
      : undefined;
    if (!donoAlvo || !donoAlvo.invocacoesConhecidas?.some(item => item.id === entity.invocationId)) {
      return { ok: false, motivo: 'A área atingiu uma invocação sem ficha ou dono válido. Nada foi executado.' };
    }
    if (filtro !== 'todos' && filtro !== 'todos_exceto_si' &&
      !aceitaAlvoAtivo(dono, donoAlvo, {
        id: 'area-invocacao', nome: 'Área de invocação', acao: 'comum', custoPE: '0', teste: 'nenhum',
        ...cfg, filtro_alvo: filtro,
      })) continue;
    idsServos.push(`invoc:${entity.id}`);
  }

  const entityIdsPersonagens = entityIds.filter(id => !mapa.entities[id]?.invocationId);
  const resolvidos = resolveAreaTargetCharacters(entityIdsPersonagens, mapa.entities, characters, undefined, servo.id);
  const idsPersonagens = [...new Set(resolvidos.characterIds)].filter(id => {
    const alvo = characters.find(character => character.id === id);
    return alvo && filtroAceitaPersonagemNaArea(dono, alvo, cfg);
  });
  const ids = [...idsPersonagens, ...idsServos];
  if (!ids.length) return { ok: false, motivo: 'Nenhum alvo válido dentro da área.' };

  if (cfg.area?.forma === 'raio_no_ponto') {
    const pixelsPorMetro = mapa.gridConfig.dpi / mapa.gridConfig.metersPerCell;
    if (!Number.isFinite(pixelsPorMetro) || pixelsPorMetro <= 0) return { ok: false, motivo: 'Grade inválida para medir o alcance da área.' };
    const origem = { x: servo.x + servo.w / 2, y: servo.y + servo.h / 2 };
    const alcanceCentro = Math.hypot(template.x - origem.x, template.y - origem.y) / pixelsPorMetro;
    if (!Number.isFinite(alcanceCentro) || alcanceCentro > cfg.alcanceM + 0.05) {
      return { ok: false, motivo: 'Centro da área fora de alcance.' };
    }
  }
  return { ok: true, ids };
}

/** Ataque de servo comandado no turno do Controlador. O alvo utiliza uma ficha
 * real, portanto o dano percorre applyDamage (reações, RD e demais regras).
 */
export async function comandarAtaque(
  donoId: string,
  invocacaoId: string,
  acaoId: string,
  alvoId: string | string[] | SelecaoAlvoAreaInvocacao,
  opcoes?: Pick<OpcoesComandoInvocacao, 'instanciaId' | 'requestId' | 'dadosReduzidos'>,
):
  Promise<ResultadoAtaqueUnicoInvocacao | ResultadoAtaqueMultiploInvocacao | { ok: false; motivo: string }> {
  return executarAtaqueInvocacao(donoId, invocacaoId, acaoId, alvoId, opcoes, 'manual');
}

export type ResultadoPredadorApiceTigre =
  | { ok: true; rodadaAlvo: number }
  | { ok: false; motivo: string };

/** Predador Ápice consome a Ação Simples atual e reserva os dois Retalhares da próxima rodada. */
export function comandarPredadorApiceTigre(
  donoId: string,
  invocacaoId: string,
  opcoes: { instanciaId?: string; requestId?: string } = {},
): ResultadoPredadorApiceTigre {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  const acao = modelo?.acoes.find(item => item.id === 'predador-apice');
  if (!dono || modelo?.subcategoria !== TIGRE_FUNEBRE_SUBCATEGORIA || !acao || acao.statusAutomacao === 'manual') {
    return { ok: false, motivo: 'Predador Ápice não está disponível nesta ficha do Tigre.' };
  }
  if (!podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };
  const combate = useCombatStore.getState();
  if (!combate.inCombat || !combate.combatId) return { ok: false, motivo: 'Predador Ápice exige combate ativo para definir a próxima rodada.' };
  const token = tokensInvocados(donoId).find(entity => entity.invocationId === invocacaoId &&
    (!opcoes.instanciaId || entity.invocationInstanceId === opcoes.instanciaId) &&
    tokenVisivel(entity, useMapStore.getState().layerVisible) && (entity.hp ?? 0) > 0 &&
    (!entity.invocationState || entity.invocationState === 'ativa'));
  if (!token?.invocationInstanceId) return { ok: false, motivo: 'O Tigre precisa estar ativo e visível no mapa.' };
  const instancia = obterInstanciaDoToken(dono, token, modelo);
  if (instancia.estado !== 'ativa') return { ok: false, motivo: 'Um Tigre caído ou inativo não pode usar Predador Ápice.' };
  const estado = normalizarEstadoTigreFunebre(instancia.estadoTigreFunebre, combate.combatId);
  if (predadorApiceTigreAtivo(estado, combate.round ?? 1, combate.combatId ?? undefined)) {
    return { ok: false, motivo: 'Predador Ápice já está preparado para esta rodada.' };
  }
  const categoria = categoriaEconomiaDaAcao(acao, instancia.economiaAcoes);
  if (!categoria) return { ok: false, motivo: 'Ação Simples do Tigre não está configurada.' };
  const requestId = opcoes.requestId?.trim() || novoIdInvocacao('predador-apice-tigre');
  const gasto = gastarAcaoDaInstancia(instancia, categoria, 1, requestId);
  if (!gasto.ok) return gasto;
  const ativado = ativarPredadorApiceTigre(estado, combate.round ?? 1, combate.combatId ?? undefined);
  const atualizada = InstanciaInvocacaoSchema.parse({
    ...gasto.instancia,
    version: gasto.instancia.version + 1,
    estadoTigreFunebre: ativado,
  });
  gravarInstancia(dono, atualizada);
  useLogStore.getState().addLog('combat', `🐅 ${modelo.nome} ativa Predador Ápice: dois Retalhares na rodada ${ativado.predadorApice?.rodadaAlvo}; os ataques ignoram 8 RD e toda RD de criaturas de grau inferior. Cadastre o grau do personagem na ficha para automatizar esse segundo efeito.`);
  return { ok: true, rodadaAlvo: ativado.predadorApice!.rodadaAlvo };
}

export type AtacanteReflexosFelinosTigre =
  | { tipo: 'personagem'; id: string }
  | { tipo: 'invocacao'; tokenId: string };

function resolverAtacanteReflexosFelinos(
  atacanteRef: AtacanteReflexosFelinosTigre,
  entities: Record<string, Entity>,
  layerVisible: Record<string, boolean>,
): { owner: Character; alvoId: string; nome: string; token: Entity } | null {
  const personagens = useCharacterStore.getState().characters;
  if (atacanteRef.tipo === 'personagem') {
    const owner = personagens.find(character => character.id === atacanteRef.id);
    const token = owner ? resolverTokenDaFicha(owner, entities, layerVisible) : undefined;
    return owner && token && tokenVisivel(token, layerVisible)
      ? { owner, alvoId: owner.id, nome: owner.name, token }
      : null;
  }

  const token = entities[atacanteRef.tokenId];
  if (!token?.ownerCharId || !token.invocationId || !token.invocationInstanceId || !tokenVisivel(token, layerVisible) || (token.hp ?? 0) <= 0) return null;
  const owner = personagens.find(character => character.id === token.ownerCharId);
  const model = owner?.invocacoesConhecidas?.find(item => item.id === token.invocationId);
  const instance = owner?.instanciasInvocacao?.find(item => item.id === token.invocationInstanceId);
  if (!owner || !model || !instance || instance.estado !== 'ativa') return null;
  return { owner, alvoId: `invoc:${token.id}`, nome: model.apelido?.trim() || model.nome, token };
}

/** Oferece Reflexos Felinos após um erro corpo a corpo contra o Tigre. */
export async function oferecerReflexosFelinosTigre(
  tokenTigreId: string,
  atacanteRef: AtacanteReflexosFelinosTigre,
  eventoAtaqueId: string,
): Promise<void> {
  const map = useMapStore.getState();
  const tokenTigre = map.entities[tokenTigreId];
  if (!tokenTigre?.ownerCharId || !tokenTigre.invocationId || !tokenTigre.invocationInstanceId ||
    !tokenVisivel(tokenTigre, map.layerVisible) || (tokenTigre.hp ?? 0) <= 0) return;
  const dono = useCharacterStore.getState().characters.find(character => character.id === tokenTigre.ownerCharId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === tokenTigre.invocationId);
  const tigre = dono?.instanciasInvocacao?.find(item => item.id === tokenTigre.invocationInstanceId);
  const atacante = resolverAtacanteReflexosFelinos(atacanteRef, map.entities, map.layerVisible);
  if (!dono || !modelo || modelo.subcategoria !== TIGRE_FUNEBRE_SUBCATEGORIA || !tigre || tigre.estado !== 'ativa' ||
    !atacante || mesmaEquipeNoMapa(dono, tokenTigre, atacante.owner, atacante.token) || touchDistanceMeters(tokenTigre, atacante.token, map.gridConfig) > 3.05 ||
    (tigre.economiaAcoes?.reacao?.atual ?? 0) < 1) return;
  const resposta = await requestReactionDecision({
    charId: dono.id,
    charName: dono.name,
    kind: 'tigre_reflexos_offer',
    message: `${modelo.apelido?.trim() || modelo.nome} pode gastar 1 das ${tigre.economiaAcoes?.reacao?.maximo ?? 2} Reações para Retalhar ${atacante.nome}.`,
  }, { forceMaster: tokenTigre.masterControlled });
  if (resposta !== 1 || jogadorBloqueadoPorControleMestre(dono.id, modelo.id)) return;

  const estadoAtual = useMapStore.getState();
  const alvoAtual = estadoAtual.entities[tokenTigreId];
  const atacanteAtual = resolverAtacanteReflexosFelinos(atacanteRef, estadoAtual.entities, estadoAtual.layerVisible);
  const donoAtual = useCharacterStore.getState().characters.find(character => character.id === dono.id);
  const modeloAtual = donoAtual?.invocacoesConhecidas?.find(item => item.id === modelo.id);
  const instanciaAtual = donoAtual?.instanciasInvocacao?.find(item => item.id === tokenTigre.invocationInstanceId);
  if (!alvoAtual?.invocationInstanceId || !tokenVisivel(alvoAtual, estadoAtual.layerVisible) || (alvoAtual.hp ?? 0) <= 0 ||
    !donoAtual || !modeloAtual || !instanciaAtual || instanciaAtual.estado !== 'ativa' ||
    !atacanteAtual || mesmaEquipeNoMapa(donoAtual, alvoAtual, atacanteAtual.owner, atacanteAtual.token) ||
    touchDistanceMeters(alvoAtual, atacanteAtual.token, estadoAtual.gridConfig) > 3.05 ||
    (instanciaAtual.economiaAcoes?.reacao?.atual ?? 0) < 1) {
    useLogStore.getState().addLog('combat', `🐅 Reflexos Felinos de ${modelo.nome}: a janela de Retalhar terminou porque o alvo, o Tigre ou a Reação mudou.`);
    return;
  }
  const resultado = await executarAtaqueInvocacao(
    donoAtual.id,
    modeloAtual.id,
    'retalhar',
    atacanteAtual.alvoId,
    { instanciaId: instanciaAtual.id, requestId: `tigre-reflexos:${eventoAtaqueId}:${instanciaAtual.id}` },
    'tigre_reacao',
  );
  if (!resultado.ok) useLogStore.getState().addLog('combat', `🐅 Reflexos Felinos de ${modelo.nome} não foram resolvidos: ${resultado.motivo}`);
}

async function oferecerSangramentoForteTigre(
  donoId: string,
  modeloId: string,
  instanciaTigreId: string,
  alvoId: string,
  nomeAlvo: string,
  eventoAtaqueId: string,
): Promise<void> {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === modeloId);
  const tigre = dono?.instanciasInvocacao?.find(item => item.id === instanciaTigreId);
  if (!dono || !modelo || modelo.subcategoria !== TIGRE_FUNEBRE_SUBCATEGORIA || !tigre || tigre.estado !== 'ativa') return;
  const cd = calcularCDInvocacao(dono, modelo, 'constituicao');
  if (cd === null || (dono.peCurrent ?? 0) < 6) return;
  const tokenTigre = useMapStore.getState().entities[tigre.tokenId];
  const resposta = await requestReactionDecision({
    charId: dono.id,
    charName: dono.name,
    kind: 'tigre_sangramento_offer',
    message: `Retalhar foi crítico. Você pode gastar 6 PE para forçar Fortitude contra CD ${cd} e aplicar Sangramento Forte (4d10). A Enciclopédia não fixa CD própria; aplica-se a CD padrão das ações de invocação.`,
  }, { forceMaster: Boolean(tokenTigre?.masterControlled) });
  if (resposta !== 1 || jogadorBloqueadoPorControleMestre(donoId, modeloId)) return;

  const donoAtual = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modeloAtual = donoAtual?.invocacoesConhecidas?.find(item => item.id === modeloId);
  const tigreAtual = donoAtual?.instanciasInvocacao?.find(item => item.id === instanciaTigreId);
  if (!donoAtual || !modeloAtual || modeloAtual.subcategoria !== TIGRE_FUNEBRE_SUBCATEGORIA || !tigreAtual ||
    tigreAtual.estado !== 'ativa' || (donoAtual.peCurrent ?? 0) < 6) {
    useLogStore.getState().addLog('combat', '🐅 Sangramento Forte: a ficha ou os 6 PE deixaram de estar disponíveis antes da confirmação; nenhum custo foi aplicado.');
    return;
  }

  let alvoPersonagem: Character | undefined;
  let alvoInvocacao: NonNullable<import('@/stores/useTestRequestStore').TestRequest['targetInvocation']> | undefined;
  let bonusInvocacao: ReturnType<typeof calcularBonusResistenciaInvocacao> = null;
  if (alvoId.startsWith('invoc:')) {
    const mapa = useMapStore.getState();
    const token = mapa.entities[alvoId.slice('invoc:'.length)];
    const donoAlvo = token?.ownerCharId
      ? useCharacterStore.getState().characters.find(character => character.id === token.ownerCharId)
      : undefined;
    const modeloAlvo = donoAlvo?.invocacoesConhecidas?.find(item => item.id === token?.invocationId);
    const instanciaAlvo = donoAlvo?.instanciasInvocacao?.find(item => item.id === token?.invocationInstanceId);
    if (!token || !tokenVisivel(token, mapa.layerVisible) || !donoAlvo || !modeloAlvo || !instanciaAlvo ||
      instanciaAlvo.estado !== 'ativa' || (token.hp ?? 0) <= 0) {
      useLogStore.getState().addLog('combat', `🐅 Sangramento Forte: ${nomeAlvo} saiu do campo antes do TR; nenhum PE foi gasto.`);
      return;
    }
    bonusInvocacao = calcularBonusResistenciaInvocacao(donoAlvo, modeloAlvo, 'Fortitude');
    if (!bonusInvocacao) {
      useLogStore.getState().addLog('combat', `🐅 Sangramento Forte: não foi possível calcular Fortitude de ${nomeAlvo}; nenhum PE foi gasto.`);
      return;
    }
    alvoInvocacao = {
      tokenId: token.id,
      ownerCharacterId: donoAlvo.id,
      invocationId: modeloAlvo.id,
      invocationInstanceId: instanciaAlvo.id,
      name: nomeAlvo,
    };
    alvoPersonagem = donoAlvo;
  } else {
    alvoPersonagem = useCharacterStore.getState().characters.find(character => character.id === alvoId);
    if (!alvoPersonagem || !resolverTokenDaFicha(alvoPersonagem, useMapStore.getState().entities, useMapStore.getState().layerVisible)) {
      useLogStore.getState().addLog('combat', `🐅 Sangramento Forte: ${nomeAlvo} saiu do campo antes do TR; nenhum PE foi gasto.`);
      return;
    }
  }

  useCharacterStore.getState().updateCharacter(donoAtual.id, { peCurrent: (donoAtual.peCurrent ?? 0) - 6 });
  const requestId = useTestRequestStore.getState().enqueue({
    charId: alvoPersonagem!.id,
    charName: nomeAlvo,
    targetProfileId: alvoPersonagem!.profileId,
    kind: 'save',
    testName: 'Fortitude',
    dc: cd,
    note: `${modeloAtual.nome} — Retalhar crítico; CD padrão de invocação (a página 85 não especifica CD).`,
    ...(alvoInvocacao ? {
      targetInvocation: alvoInvocacao,
      bonusOverride: bonusInvocacao!.total,
      bonusBreakdownOverride: bonusInvocacao!.breakdown,
    } : {}),
    originId: donoAtual.id,
    sourceTag: `tigre-sangramento:${eventoAtaqueId}:${alvoId}`,
    tigreSangramentoResolution: {
      sourceCharId: donoAtual.id,
      sourceCharName: donoAtual.name,
      sourceInvocationId: modeloAtual.id,
      sourceInstanceId: tigreAtual.id,
      sourceName: `${modeloAtual.apelido?.trim() || modeloAtual.nome} — Retalhar`,
      conditionId: 'sangramento',
      conditionName: 'Sangramento Forte',
      conditionIcon: '🩸',
      endCD: cd,
      ...(alvoInvocacao ? { targetInvocation: alvoInvocacao } : {}),
    },
  });
  useLogStore.getState().addLog('combat', `🐅 ${modeloAtual.nome}: gasta 6 PE e envia TR de Fortitude contra CD ${cd} para ${nomeAlvo}.`);
}

export type ResultadoInerciaImparavelTouro =
  | { ok: true; deslocamentoM: 30 }
  | { ok: false; motivo: string };

/** Ativa a Inércia uma vez por rodada; retries enquanto estiver ativa só retornam o estado vigente. */
export function comandarInerciaImparavelTouro(
  donoId: string,
  invocacaoId: string,
  opcoes: { instanciaId?: string; requestId?: string } = {},
): ResultadoInerciaImparavelTouro {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  const acao = modelo?.acoes.find(item => item.id === 'inercia-imparavel');
  if (!dono || modelo?.subcategoria !== 'dez-sombras:touro-perfurante' || !acao || acao.statusAutomacao === 'manual') {
    return { ok: false, motivo: 'Inércia Imparável não está disponível nesta ficha do Touro.' };
  }
  if (!podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };
  const combate = useCombatStore.getState();
  if (!combate.inCombat || !combate.combatId) return { ok: false, motivo: 'Inércia Imparável exige um combate ativo.' };
  const token = tokensInvocados(donoId).find(entity => entity.invocationId === invocacaoId &&
    (!opcoes.instanciaId || entity.invocationInstanceId === opcoes.instanciaId) &&
    tokenVisivel(entity, useMapStore.getState().layerVisible) && (entity.hp ?? 0) > 0 &&
    (!entity.invocationState || entity.invocationState === 'ativa'));
  if (!token?.invocationInstanceId) return { ok: false, motivo: 'O Touro precisa estar ativo e visível no mapa.' };
  const instancia = obterInstanciaDoToken(dono, token, modelo);
  if (instancia.estado !== 'ativa') return { ok: false, motivo: 'Um Touro caído ou inativo não pode ativar Inércia Imparável.' };
  const requestId = opcoes.requestId?.trim() || novoIdInvocacao('inercia-touro');
  const estadoExistente = instancia.inerciaImparavelTouro;
  if (inerciaImparavelTouroAtiva(estadoExistente, combate)) {
    return { ok: true, deslocamentoM: 30 };
  }
  if (!podeUsarAcaoDaInstancia(instancia, acao.id)) return { ok: false, motivo: 'Inércia Imparável ainda está em recarga.' };
  const debito = prepararDebitoComando(dono, modelo, instancia, acao);
  if (!debito.ok) return debito;
  const categoria = categoriaEconomiaDaAcao(acao, instancia.economiaAcoes);
  if (categoria !== 'acaoSimples') return { ok: false, motivo: 'Inércia Imparável precisa estar configurada como Ação Simples.' };
  const gasto = gastarAcaoDaInstancia(instancia, categoria, 1, requestId);
  if (!gasto.ok) return gasto;
  const combateAtual = useCombatStore.getState();
  if (combateAtual.combatId !== combate.combatId || combateAtual.round !== combate.round ||
    combateAtual.currentTurnIndex !== combate.currentTurnIndex || !podeComandarInvocacao(donoId, invocacaoId)) {
    return { ok: false, motivo: 'O turno mudou durante a ativação; a ação não foi registrada.' };
  }
  const atualizada = InstanciaInvocacaoSchema.parse({
    ...gasto.instancia,
    version: gasto.instancia.version + 1,
    inerciaImparavelTouro: { combateId: combate.combatId, rodada: combate.round ?? 1, requestId },
  });
  gravarInstancia(dono, registrarRecargaDaAcao({ ...atualizada, recursosAtuais: debito.recursosRestantes }, acao));
  useLogStore.getState().addLog('combat', `🐂 ${modelo.nome} ativa Inércia Imparável: deslocamento de 30 m e +2 níveis na Investida Perfurante até o fim da rodada.`);
  return { ok: true, deslocamentoM: 30 };
}

/** Resolve habilidades especiais descritas por dados, debitando a ação própria
 * da instância e desfazendo o bônus se a gravação do comando falhar. */
export function comandarHabilidadeInvocacao(
  donoId: string,
  invocacaoId: string,
  acaoId: string,
  opcoes?: { instanciaId?: string; requestId?: string },
): { ok: true; habilidade: string; pericia: string } | { ok: false; motivo: string } {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  const acao = modelo?.acoes.find(item => item.id === acaoId);
  if (!dono || !modelo || !acao) return { ok: false, motivo: 'Ação ou invocação não encontrada.' };
  if (!podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };
  if (acao.tipo !== 'habilidade' || acao.statusAutomacao === 'manual' ||
    acao.efeitoEspecial?.tipo !== 'vantagem_pericia_controlador' ||
    acao.efeitoEspecial.contexto !== 'rastreamento') {
    return { ok: false, motivo: 'Esta habilidade não tem uma resolução automática válida.' };
  }

  const servo = tokensInvocados(donoId).find(token => token.invocationId === invocacaoId &&
    (!opcoes?.instanciaId || token.invocationInstanceId === opcoes.instanciaId) &&
    (token.hp ?? 0) > 0 && (!token.invocationState || token.invocationState === 'ativa') &&
    !token.hidden && useMapStore.getState().layerVisible[token.layer ?? 'tokens'] !== false);
  if (!servo?.invocationInstanceId) return { ok: false, motivo: 'A invocação precisa estar ativa e visível no mapa.' };

  const instancia = obterInstanciaDoToken(dono, servo, modelo);
  if (instancia.estado !== 'ativa') return { ok: false, motivo: 'Uma invocação caída ou inativa não pode usar esta habilidade.' };
  if (!podeUsarAcaoDaInstancia(instancia, acaoId)) return { ok: false, motivo: 'A habilidade ainda está em recarga.' };
  const debito = prepararDebitoComando(dono, modelo, instancia, acao);
  if (!debito.ok) return debito;
  const categoria = categoriaEconomiaDaAcao(acao, instancia.economiaAcoes);
  if (!categoria) return { ok: false, motivo: 'Categoria de ação própria não configurada.' };
  const requestId = opcoes?.requestId ?? novoIdInvocacao('habilidade');
  const gasto = gastarAcaoDaInstancia(instancia, categoria, 1, requestId);
  if (!gasto.ok) return gasto;

  const pericia = acao.efeitoEspecial.pericia.trim();
  if (!pericia) return { ok: false, motivo: 'A perícia beneficiada não está configurada.' };
  const vantagemId = grantAdvantage(donoId, 'advantage', 'skill_specific', {
    target: pericia,
    expires: 'use',
    source: `${modelo.apelido?.trim() || modelo.nome}: ${acao.nome} (${acao.efeitoEspecial.contexto})`,
    grantedBy: instancia.id,
  });
  if (!vantagemId) return { ok: false, motivo: 'Não foi possível conceder vantagem ao Controlador.' };

  try {
    const comDebitos = registrarRecargaDaAcao({
      ...gasto.instancia,
      recursosAtuais: debito.recursosRestantes,
    }, acao);
    gravarInstancia(dono, comDebitos, { peCurrent: debito.peDonoRestante });
  } catch {
    revokeAdvantage(donoId, vantagemId);
    return { ok: false, motivo: 'A habilidade não foi registrada; a vantagem foi cancelada e a ação não foi gasta.' };
  }

  useLogStore.getState().addLog(
    'combat',
    `🐺 ${modelo.apelido?.trim() || modelo.nome} usa ${acao.nome}: ${dono.name} recebe vantagem no próximo teste de ${pericia} para rastreamento.`,
  );
  return { ok: true, habilidade: acao.nome, pericia };
}

type CervoAtivoParaComando = {
  dono: Character;
  modelo: InvocacaoControlador;
  acao: InvocacaoControlador['acoes'][number];
  token: Entity;
  instancia: InstanciaInvocacao;
};

function obterCervoAtivoParaComando(
  donoId: string,
  invocacaoId: string,
  acaoId: string,
  instanciaId?: string,
): CervoAtivoParaComando | null {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  const acao = modelo?.acoes.find(item => item.id === acaoId);
  if (!dono || modelo?.subcategoria !== 'dez-sombras:cervo-circular' || !acao) return null;
  const mapa = useMapStore.getState();
  const token = tokensInvocados(donoId).find(entity => entity.invocationId === invocacaoId &&
    (!instanciaId || entity.invocationInstanceId === instanciaId) && tokenVisivel(entity, mapa.layerVisible) &&
    (entity.hp ?? 0) > 0 && (!entity.invocationState || entity.invocationState === 'ativa'));
  if (!token) return null;
  const instancia = obterInstanciaDoToken(dono, token, modelo);
  if (instancia.estado !== 'ativa') return null;
  return { dono, modelo, acao, token, instancia };
}

function modeloComCustoCervo(
  modelo: InvocacaoControlador,
  acao: InvocacaoControlador['acoes'][number],
  custoPE: number,
): InvocacaoControlador {
  const custoBase = Math.max(1, acao.custoPE ?? 2);
  const existente = modelo.custosComandosConfigurados?.[acao.id];
  const debitosBase = existente?.debitos?.length
    ? existente.debitos
    : [{ entidade: 'dono' as const, recurso: 'pe' as const, quantidade: custoBase }];
  const debitos = debitosBase.map(debito => ({
    ...debito,
    quantidade: Math.round((debito.quantidade / custoBase * custoPE) * 1000) / 1000,
  }));
  return {
    ...modelo,
    custosComandosConfigurados: {
      ...modelo.custosComandosConfigurados,
      [acao.id]: { execucao: existente?.execucao ?? 'manual', debitos },
    },
  };
}

export type ResultadoToqueDaVidaCervo =
  | { ok: true; condicao: string; custoPE: number; categoriaAcao: 'movimento' | 'acao_complexa' }
  | { ok: false; motivo: string };

/** Toque da Vida remove uma condição elegível de um aliado adjacente, com ação e PE determinados pelo grau. */
export function comandarToqueDaVidaCervo(
  donoId: string,
  invocacaoId: string,
  alvoId: string,
  condicaoInstanceId: string,
  opcoes: { instanciaId?: string; requestId?: string } = {},
): ResultadoToqueDaVidaCervo {
  const atual = obterCervoAtivoParaComando(donoId, invocacaoId, 'toque-da-vida', opcoes.instanciaId);
  if (!atual || atual.acao.efeitoEspecial?.tipo !== 'toque_da_vida_cervo') {
    return { ok: false, motivo: 'O Cervo Circular ou Toque da Vida não está disponível.' };
  }
  if (!podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };
  const mapa = useMapStore.getState();
  const characterStore = useCharacterStore.getState();
  let personagemAlvo: Character | undefined;
  let tokenAlvo: Entity | undefined;
  let modeloAlvo: InvocacaoControlador | undefined;
  let instanciaAlvo: InstanciaInvocacao | undefined;
  let conditionId = '';
  let conditionName = '';
  let conditionIndex = -1;
  if (alvoId.startsWith('invoc:')) {
    tokenAlvo = mapa.entities[alvoId.slice('invoc:'.length)];
    if (!tokenAlvo?.ownerCharId || !tokenAlvo.invocationId || !tokenVisivel(tokenAlvo, mapa.layerVisible) || (tokenAlvo.hp ?? 0) <= 0) {
      return { ok: false, motivo: 'O aliado selecionado não está ativo e visível no mapa.' };
    }
    personagemAlvo = characterStore.characters.find(character => character.id === tokenAlvo!.ownerCharId);
    modeloAlvo = personagemAlvo?.invocacoesConhecidas?.find(item => item.id === tokenAlvo!.invocationId);
    if (!personagemAlvo || !modeloAlvo || modeloAlvo.donoCharacterId !== personagemAlvo.id) return { ok: false, motivo: 'A ficha do aliado selecionado não foi encontrada.' };
    instanciaAlvo = obterInstanciaDoToken(personagemAlvo, tokenAlvo, modeloAlvo);
    if (instanciaAlvo.estado !== 'ativa') return { ok: false, motivo: 'A invocação aliada precisa estar ativa para receber Toque da Vida.' };
    const lista = instanciaAlvo.condicoes ?? [];
    conditionIndex = lista.findIndex((raw, index) => condicaoInvocacaoCervo(raw, index)?.selectionId === condicaoInstanceId);
    const condition = conditionIndex >= 0 ? condicaoInvocacaoCervo(lista[conditionIndex], conditionIndex) : null;
    conditionId = condition?.conditionId ?? '';
    conditionName = condition?.name ?? '';
  } else {
    personagemAlvo = characterStore.characters.find(character => character.id === alvoId);
    if (!personagemAlvo) return { ok: false, motivo: 'Ficha do aliado selecionado não encontrada.' };
    tokenAlvo = Object.values(mapa.entities).find(entity => entity.characterId === personagemAlvo!.id && !entity.invocationId &&
      tokenVisivel(entity, mapa.layerVisible) && isWithinTouch(atual.token, entity, mapa.gridConfig));
    const condition = personagemAlvo.activeConditions?.find(item => item.id === condicaoInstanceId);
    conditionId = condition?.conditionId ?? '';
    conditionName = condition?.name ?? '';
  }
  if (!tokenAlvo || !personagemAlvo) return { ok: false, motivo: 'O aliado precisa ter um token visível e adjacente ao Cervo.' };
  if (!mesmaEquipeNoMapa(atual.dono, atual.token, personagemAlvo, tokenAlvo)) return { ok: false, motivo: 'Toque da Vida só pode atingir aliados.' };
  if (!isWithinTouch(atual.token, tokenAlvo, mapa.gridConfig)) return { ok: false, motivo: 'Toque da Vida exige um aliado adjacente.' };
  if (!conditionId) return { ok: false, motivo: 'A condição selecionada não existe mais no alvo.' };
  const nivel = nivelCondicaoCervo(conditionId);
  if (!nivel) return { ok: false, motivo: 'Esta condição não tem grau removível definido para Toque da Vida.' };
  const categoriaAcao: 'movimento' | 'acao_complexa' = nivel <= 2 ? 'movimento' : 'acao_complexa';
  const acaoUso = { ...atual.acao, categoriaAcao };
  if (!podeUsarAcaoDaInstancia(atual.instancia, atual.acao.id)) return { ok: false, motivo: 'Toque da Vida ainda está em recarga.' };
  const categoria = categoriaEconomiaDaAcao(acaoUso, atual.instancia.economiaAcoes);
  if (!categoria) return { ok: false, motivo: `Ação própria ${categoriaAcao} não configurada no Cervo.` };
  const custoPE = nivel * 2;
  const modeloCusto = modeloComCustoCervo(atual.modelo, atual.acao, custoPE);
  const debito = prepararDebitoComando(atual.dono, modeloCusto, atual.instancia, acaoUso, custoPE);
  if (!debito.ok) return debito;
  const chavePendente = `${atual.instancia.id}:toque-da-vida`;
  if (comandosCervoPendentes.has(chavePendente)) return { ok: false, motivo: 'Outro uso de Toque da Vida já está em andamento.' };
  comandosCervoPendentes.add(chavePendente);
  try {
    const requestId = opcoes.requestId ?? novoIdInvocacao('cervo-toque');
    const gasto = gastarAcaoDaInstancia(atual.instancia, categoria, 1, requestId);
    if (!gasto.ok) return gasto;
    gravarInstancia(atual.dono, registrarRecargaDaAcao({ ...gasto.instancia, recursosAtuais: debito.recursosRestantes }, atual.acao), { peCurrent: debito.peDonoRestante });
    if (modeloAlvo && instanciaAlvo && personagemAlvo) {
      const personagemAtual = useCharacterStore.getState().characters.find(character => character.id === personagemAlvo!.id);
      const tokenAtual = useMapStore.getState().entities[tokenAlvo.id];
      const modeloAtual = personagemAtual?.invocacoesConhecidas?.find(item => item.id === modeloAlvo!.id);
      if (!personagemAtual || !tokenAtual || !modeloAtual) return { ok: false, motivo: 'O aliado saiu do mapa antes da remoção da condição.' };
      const instanciaAtual = obterInstanciaDoToken(personagemAtual, tokenAtual, modeloAtual);
      const condicoes = [...(instanciaAtual.condicoes ?? [])];
      const indexAtual = condicoes.findIndex((raw, index) => condicaoInvocacaoCervo(raw, index)?.selectionId === condicaoInstanceId);
      if (indexAtual < 0) return { ok: false, motivo: 'A condição já não está ativa no aliado.' };
      condicoes.splice(indexAtual, 1);
      const atualizada = InstanciaInvocacaoSchema.parse({ ...instanciaAtual, version: instanciaAtual.version + 1, condicoes });
      gravarInstancia(personagemAtual, atualizada);
      useMapStore.getState().updateEntity(tokenAtual.id, {
        invocationConditionIds: [...new Set(condicoes.map((raw, index) => condicaoInvocacaoCervo(raw, index)?.conditionId).filter((id): id is string => !!id))],
      });
    } else {
      useCharacterStore.getState().removeCondition(personagemAlvo.id, condicaoInstanceId);
    }
    useLogStore.getState().addLog('combat', `🦌 ${atual.modelo.nome} — Toque da Vida remove ${conditionName} de ${personagemAlvo.name}; ${custoPE} PE e ${categoriaAcao === 'movimento' ? 'Ação de Movimento' : 'Ação Complexa'} consumidos.`);
    return { ok: true, condicao: conditionName, custoPE, categoriaAcao };
  } finally {
    comandosCervoPendentes.delete(chavePendente);
  }
}

export type ResultadoNeutralizacaoCervo =
  | { ok: true; dissipadas: number; testes: number; cd: number }
  | { ok: false; motivo: string };

/** Neutralização dissipa efeitos de técnica inata representados no sistema e pede TR de Vontade aos feiticeiros na área. */
export function comandarNeutralizacaoCervo(
  donoId: string,
  invocacaoId: string,
  opcoes: { instanciaId?: string; requestId?: string } = {},
): ResultadoNeutralizacaoCervo {
  const atual = obterCervoAtivoParaComando(donoId, invocacaoId, 'neutralizacao', opcoes.instanciaId);
  if (!atual || atual.acao.efeitoEspecial?.tipo !== 'neutralizacao_cervo') {
    return { ok: false, motivo: 'O Cervo Circular ou Neutralização não está disponível.' };
  }
  if (!podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };
  if (atual.acao.statusAutomacao === 'manual' || String(atual.acao.resistenciaAlvo ?? '').toLocaleLowerCase('pt-BR') !== 'vontade') {
    return { ok: false, motivo: 'Neutralização não tem um TR de Vontade executável configurado.' };
  }
  if (!podeUsarAcaoDaInstancia(atual.instancia, atual.acao.id)) return { ok: false, motivo: 'Neutralização ainda está em recarga.' };
  const categoria = categoriaEconomiaDaAcao(atual.acao, atual.instancia.economiaAcoes);
  if (!categoria) return { ok: false, motivo: 'Ação Simples própria não configurada no Cervo.' };
  const cd = calcularCDInvocacao(atual.dono, atual.modelo, atual.acao.atributoCD);
  if (cd === null) return { ok: false, motivo: 'Defina o atributo usado para calcular a CD de Neutralização.' };
  const chavePendente = `${atual.instancia.id}:neutralizacao`;
  if (comandosCervoPendentes.has(chavePendente)) return { ok: false, motivo: 'Neutralização já está em andamento.' };
  comandosCervoPendentes.add(chavePendente);
  try {
    const mapa = useMapStore.getState();
    const characters = useCharacterStore.getState().characters;
    const raio = atual.acao.area?.tamanho_m ?? CERVO_NEUTRALIZACAO_RAIO_M;
    const personagensNaArea = new Set<string>();
    for (const character of characters) {
      const tokens = Object.values(mapa.entities).filter(token => token.characterId === character.id && !token.invocationId &&
        tokenVisivel(token, mapa.layerVisible));
      if (tokens.some(token => tokenEmRaioCircular(atual.token, token, mapa.gridConfig, raio))) personagensNaArea.add(character.id);
    }

    const requestId = opcoes.requestId?.trim() || novoIdInvocacao('cervo-neutralizacao');
    const gasto = gastarAcaoDaInstancia(atual.instancia, categoria, 1, requestId);
    if (!gasto.ok) return gasto;
    const modeloAtual = useCharacterStore.getState().characters.find(character => character.id === donoId);
    if (!modeloAtual) return { ok: false, motivo: 'O Controlador saiu do combate durante a ação.' };
    gravarInstancia(modeloAtual, registrarRecargaDaAcao(gasto.instancia, atual.acao));

    let dissipadas = 0;
    const condicoesDissipadasIds = new Set<string>();
    for (const characterId of personagensNaArea) {
      const character = useCharacterStore.getState().characters.find(item => item.id === characterId);
      if (!character) continue;
      const buffsDissipados = (character.activeBuffs ?? []).filter(buff => buff.sourceKind === 'tecnica_inata');
      const buffsRestantes = (character.activeBuffs ?? []).filter(buff => buff.sourceKind !== 'tecnica_inata');
      for (const buff of buffsDissipados) {
        useCharacterStore.getState().removeBuff(character.id, buff.id);
        dissipadas++;
      }
      for (const condition of character.activeConditions ?? []) {
        if (condition.sourceKind !== 'tecnica_inata' || condition.conditionId === 'tecnica-inata-suprimida') continue;
        useCharacterStore.getState().removeCondition(character.id, condition.id);
        condicoesDissipadasIds.add(condition.id);
        dissipadas++;
      }
      if (Number(character.omniFlags?.dominio_simples_durabilidade ?? 0) > 0) {
        const dissolvido = dissiparDominioSimples(character);
        if (dissolvido.ok && dissolvido.omniFlagPatch) {
          useCharacterStore.getState().updateCharacter(character.id, { omniFlags: { ...character.omniFlags, ...dissolvido.omniFlagPatch } });
          dissipadas++;
        }
      }
      if (buffsDissipados.length) {
        const atualizado = useCharacterStore.getState().characters.find(item => item.id === character.id);
        if (atualizado && (atualizado.activeBuffs ?? []).length !== buffsRestantes.length) {
          useCharacterStore.getState().updateCharacter(character.id, { activeBuffs: buffsRestantes });
        }
      }
    }

    const runtime = useOmniRuntimeStore.getState();
    runtime.podarExpirados();
    const entidades = useOmniEntidadesStore.getState().entidades;
    for (const efeito of Object.values(useOmniRuntimeStore.getState().efeitos)) {
      const entidade = entidades[efeito.entidadeId];
      if (entidade?.categoria !== 'feitico') continue;
      const linkedEntityId = ['mapEntityId', 'manifestationEntityId', 'targetTokenId', 'entityTokenId']
        .map(key => efeito.meta?.[key])
        .find((value): value is string => typeof value === 'string' && !!value);
      if (linkedEntityId) {
        const manifestation = mapa.entities[linkedEntityId];
        if (!manifestation || !tokenVisivel(manifestation, mapa.layerVisible) ||
          !tokenEmRaioCircular(atual.token, manifestation, mapa.gridConfig, raio)) continue;
      } else {
        // Para efeitos pessoais/dirigidos, a manifestação acompanha o alvo.
        // Um efeito sem alvo acompanha a posição de quem o criou.
        const charIdManifestacao = efeito.targetCharId ?? efeito.sourceCharId;
        if (!charIdManifestacao || !personagensNaArea.has(charIdManifestacao)) continue;
      }
      const conditionInstanceId = efeito.meta?.conditionInstanceId;
      useOmniRuntimeStore.getState().removerEfeito(efeito.id);
      if (typeof conditionInstanceId !== 'string' || !condicoesDissipadasIds.has(conditionInstanceId)) dissipadas++;
    }

    const testRequests: string[] = [];
    for (const characterId of personagensNaArea) {
      const alvo = useCharacterStore.getState().characters.find(character => character.id === characterId);
      if (!alvo || (alvo.characterClass !== 'Feiticeiro' && alvo.characterClass !== 'Maldição')) continue;
      const token = Object.values(mapa.entities).find(entity => entity.characterId === alvo.id && !entity.invocationId &&
        tokenVisivel(entity, mapa.layerVisible) && tokenEmRaioCircular(atual.token, entity, mapa.gridConfig, raio));
      if (!token) continue;
      const idPedidoTR = useTestRequestStore.getState().enqueue({
        charId: alvo.id,
        charName: alvo.name,
        targetProfileId: alvo.profileId,
        kind: 'save',
        testName: 'Vontade',
        dc: cd,
        hideDcFromPlayer: estaNoTimeInimigo(atual.dono, atual.token),
        note: `${atual.modelo.nome} usa Neutralização — role TR de Vontade; na falha, sua técnica inata fica suprimida até o início do próximo turno.`,
        originId: donoId,
        sourceTag: `cervo-neutralizacao:${atual.instancia.id}:${requestId}:${alvo.id}`,
        cervoNeutralizationResolution: {
          sourceCharId: donoId,
          sourceName: atual.modelo.nome,
          sourceInvocationId: atual.modelo.id,
          sourceInstanceId: atual.instancia.id,
        },
      });
      testRequests.push(idPedidoTR);
    }
    useLogStore.getState().addLog('combat', `🦌 ${atual.modelo.nome} usa Neutralização: ${dissipadas} efeito(s) de técnica ativa dissipado(s); ${testRequests.length} TR de Vontade enviados contra CD ${cd} em raio de ${raio} m.`);
    return { ok: true, dissipadas, testes: testRequests.length, cd };
  } finally {
    comandosCervoPendentes.delete(chavePendente);
  }
}

export type ResultadoMassaEsmagadora =
  | { ok: true; alvo: string; formula: string; dano: number; caiu: boolean; requestId: string }
  | { ok: false; motivo: string };

const massaEsmagadoraPendente = new Set<string>();

/** Resolve Massa Esmagadora sobre uma criatura menor que esteja sob o token do Elefante. */
export async function comandarMassaEsmagadoraElefante(
  donoId: string,
  invocacaoId: string,
  alvoId: string,
  opcoes: { instanciaId?: string; requestId?: string; dominioAtivo?: boolean } = {},
): Promise<ResultadoMassaEsmagadora> {
  const requestId = opcoes.requestId?.trim() || novoIdInvocacao('massa-esmagadora');
  const dominioAtivo = opcoes.dominioAtivo === true;
  if (!requestId) return { ok: false, motivo: 'ID do comando inválido.' };
  if (dominioAtivo && useRoleStore.getState().role !== 'MASTER') {
    return { ok: false, motivo: 'Somente o Mestre pode confirmar Expansão de Domínio nesta ação.' };
  }

  const resolverEstado = () => {
    const characters = useCharacterStore.getState().characters;
    const dono = characters.find(character => character.id === donoId);
    const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
    const acao = modelo?.acoes.find(item => item.id === 'massa-esmagadora');
    const mapa = useMapStore.getState();
    const token = Object.values(mapa.entities).find(entity => entity.ownerCharId === donoId &&
      entity.invocationId === invocacaoId && (!opcoes.instanciaId || entity.invocationInstanceId === opcoes.instanciaId));
    if (!dono || modelo?.subcategoria !== 'dez-sombras:elefante-maximo' || !acao ||
      acao.statusAutomacao === 'manual' || !token?.invocationInstanceId) {
      return { ok: false as const, motivo: 'Elefante Máximo, instância ou Massa Esmagadora não está disponível.' };
    }
    if (!token || token.hidden || token.carriedBy || mapa.layerVisible[token.layer ?? 'tokens'] === false ||
      (token.hp ?? 0) <= 0 || (token.invocationState && token.invocationState !== 'ativa')) {
      return { ok: false as const, motivo: 'O Elefante precisa estar ativo e visível no mapa.' };
    }
    if (!podeComandarInvocacao(donoId, invocacaoId)) return { ok: false as const, motivo: 'Fora do turno do Controlador.' };
    const instancia = obterInstanciaDoToken(dono, token, modelo);
    if (instancia.estado !== 'ativa') return { ok: false as const, motivo: 'Um Elefante caído ou inativo não pode usar Massa Esmagadora.' };
    if (instancia.eventosAcoesProcessados?.includes(requestId)) return { ok: false as const, motivo: 'Este comando já foi processado.' };
    if (!podeUsarAcaoDaInstancia(instancia, acao.id)) return { ok: false as const, motivo: 'Massa Esmagadora ainda está em recarga.' };
    const categoria = categoriaEconomiaDaAcao(acao, instancia.economiaAcoes);
    if (!categoria) return { ok: false as const, motivo: 'Ação Simples própria não configurada para o Elefante.' };

    let alvoToken: Entity | undefined;
    let alvoPersonagem: Character | undefined;
    let alvoDonoInvocacao: Character | undefined;
    let alvoModeloInvocacao: InvocacaoControlador | undefined;
    let alvoInstancia: InstanciaInvocacao | undefined;
    if (alvoId.startsWith('invoc:')) {
      alvoToken = mapa.entities[alvoId.slice('invoc:'.length)];
      if (!alvoToken?.ownerCharId || !alvoToken.invocationId || alvoToken.id === token.id || alvoToken.hidden ||
        alvoToken.carriedBy || mapa.layerVisible[alvoToken.layer ?? 'tokens'] === false || (alvoToken.hp ?? 0) <= 0 ||
        (alvoToken.invocationState && alvoToken.invocationState !== 'ativa')) {
        return { ok: false as const, motivo: 'A criatura escolhida não está ativa e visível no mapa.' };
      }
      alvoDonoInvocacao = characters.find(character => character.id === alvoToken!.ownerCharId);
      alvoModeloInvocacao = alvoDonoInvocacao?.invocacoesConhecidas?.find(item => item.id === alvoToken!.invocationId);
      if (!alvoDonoInvocacao || !alvoModeloInvocacao) return { ok: false as const, motivo: 'A ficha da criatura escolhida não está disponível.' };
      alvoInstancia = obterInstanciaDoToken(alvoDonoInvocacao, alvoToken, alvoModeloInvocacao);
      if (alvoInstancia.estado !== 'ativa') return { ok: false as const, motivo: 'A criatura escolhida está caída ou inativa.' };
    } else {
      alvoPersonagem = characters.find(character => character.id === alvoId);
      alvoToken = alvoPersonagem ? resolverTokenDaFicha(alvoPersonagem, mapa.entities, mapa.layerVisible) : undefined;
      if (!alvoPersonagem || !alvoToken || (alvoPersonagem.hpCurrent ?? 0) <= 0 || alvoToken.hidden || alvoToken.carriedBy ||
        mapa.layerVisible[alvoToken.layer ?? 'tokens'] === false) {
        return { ok: false as const, motivo: 'A criatura escolhida não está ativa e visível no mapa.' };
      }
    }

    const porteAlvo = alvoToken.invocationId
      ? alvoToken.invocationEffectiveSize ?? alvoModeloInvocacao?.porte
      : defaultSizeForLevel(alvoPersonagem!.level ?? 1, alvoPersonagem!.sizeCategory);
    const rankAlvo = rankPorteInvocacao(porteAlvo);
    const rankElefante = rankPorteInvocacao(token.invocationEffectiveSize ?? modelo.porte);
    if (rankAlvo === null || rankElefante === null || rankAlvo >= rankElefante) {
      return { ok: false as const, motivo: 'Massa Esmagadora só pode atingir uma criatura menor que o Elefante.' };
    }
    if (!tokenFootprintsOverlap(
      { origin: { x: token.x, y: token.y }, entity: token },
      { origin: { x: alvoToken.x, y: alvoToken.y }, entity: alvoToken },
    ) || (alvoToken.altitudeM ?? 0) > (token.altitudeM ?? 0)) {
      return { ok: false as const, motivo: 'O alvo precisa estar sob os pés do Elefante.' };
    }
    const debito = prepararDebitoComando(dono, modelo, instancia, acao);
    if (!debito.ok) return debito;
    return {
      ok: true as const, dono, modelo, acao, token, instancia, categoria,
      debito: { ...debito, peDonoConsumido: Math.max(0, (dono.peCurrent ?? 0) - debito.peDonoRestante) },
      alvoToken, alvoPersonagem, alvoDonoInvocacao, alvoModeloInvocacao, alvoInstancia,
      altitudeM: token.altitudeM ?? 0,
    };
  };

  const inicial = resolverEstado();
  if (!inicial.ok) return inicial;
  const chave = `${inicial.instancia.id}:massa-esmagadora`;
  if (massaEsmagadoraPendente.has(chave)) return { ok: false, motivo: 'Massa Esmagadora já está sendo resolvida.' };
  massaEsmagadoraPendente.add(chave);
  try {
    const dadosBase = dominioAtivo ? 6 : 4;
    const dadosQueda = Math.floor(Math.max(0, inicial.altitudeM) / 3);
    const formula = `${dadosBase}d12${dadosQueda > 0 ? `+${dadosQueda}d6` : ''}`;
    const formulaResolvida = parseFormulaDanoInvocacao(formula);
    if (!formulaResolvida) return { ok: false, motivo: 'A fórmula de Massa Esmagadora é inválida.' };
    const rolagem = await rollDiceGroups(formulaResolvida.dados, { label: `Massa Esmagadora: ${inicial.modelo.nome}` });
    const dano = rolagem.total + formulaResolvida.fixo;
    if (!Number.isFinite(dano) || dano <= 0) return { ok: false, motivo: 'A rolagem de dano não retornou um valor válido.' };

    const atual = resolverEstado();
    if (!atual.ok) return atual;
    if (atual.instancia.id !== inicial.instancia.id || atual.token.x !== inicial.token.x ||
      atual.token.y !== inicial.token.y || atual.altitudeM !== inicial.altitudeM) {
      return { ok: false, motivo: 'O Elefante mudou de posição ou altura durante a rolagem; refaça a ação.' };
    }
    if (dominioAtivo && useRoleStore.getState().role !== 'MASTER') {
      return { ok: false, motivo: 'A confirmação de Expansão de Domínio foi removida antes da resolução.' };
    }
    const gasto = gastarAcaoDaInstancia(atual.instancia, atual.categoria, 1, requestId);
    if (!gasto.ok) return gasto;
    const comRecarga = registrarRecargaDaAcao({
      ...gasto.instancia,
      recursosAtuais: atual.debito.recursosRestantes,
    }, atual.acao);
    gravarInstancia(atual.dono, comRecarga, { peCurrent: atual.debito.peDonoRestante });

    const eventoDanoId = `${requestId}:dano`;
    let alvoFicouCaido = false;
    if (atual.alvoToken.invocationId && atual.alvoInstancia) {
      const aplicado = causarDanoInvocacao(atual.alvoToken.id, dano, 'DI', atual.alvoInstancia.id, {
        tipoAlvo: 'unico', eventoId: eventoDanoId,
      });
      if (!aplicado.ok) {
        devolverCustoMassaEsmagadora(atual.dono.id, atual.instancia, atual.categoria, atual.acao.id, requestId, atual.debito);
        return { ok: false, motivo: aplicado.motivo };
      }
      if (aplicado.hpRestante > 0) {
        const donoAlvoAtual = useCharacterStore.getState().characters.find(character => character.id === atual.alvoDonoInvocacao!.id);
        const instanciaAlvoAtual = donoAlvoAtual?.instanciasInvocacao?.find(item => item.id === atual.alvoInstancia!.id);
        if (donoAlvoAtual && instanciaAlvoAtual) {
          alvoFicouCaido = aplicarCaidoEmInstancia(donoAlvoAtual, atual.alvoModeloInvocacao!, atual.alvoToken, instanciaAlvoAtual);
        }
      }
    } else if (atual.alvoPersonagem) {
      try {
        await useCharacterStore.getState().applyDamage(atual.alvoPersonagem.id, dano, 'DI', {
          attackerId: atual.dono.id,
          source: 'omni',
          isMelee: true,
          attack: { critical: false, criticalFail: false, kind: 'melee' },
          tags: [eventoDanoId],
        });
      } catch (error) {
        devolverCustoMassaEsmagadora(atual.dono.id, atual.instancia, atual.categoria, atual.acao.id, requestId, atual.debito);
        throw error;
      }
      const alvoDepois = useCharacterStore.getState().characters.find(character => character.id === atual.alvoPersonagem!.id);
      if ((alvoDepois?.hpCurrent ?? 0) > 0) {
        alvoFicouCaido = (alvoDepois?.activeConditions ?? []).some(condition => normalizarCondicaoInvocacao(condition.conditionId) === 'caido');
      }
      if ((alvoDepois?.hpCurrent ?? 0) > 0 && !alvoFicouCaido) {
        alvoFicouCaido = Boolean(useCharacterStore.getState().addCondition(alvoDepois!.id, {
          id: novoIdInvocacao('massa-caido'), conditionId: 'caido', name: 'Caído', icon: '🔻',
          remainingTurns: -1, remainingRounds: -1, sourceCharId: atual.dono.id,
          sourceCharName: atual.modelo.nome, sourceEntityId: atual.modelo.subcategoria, sourceInstanceId: atual.instancia.id,
        }));
      }
    }

    const mapa = useMapStore.getState();
    mapa.pushHistory();
    mapa.updateEntity(atual.token.id, { altitudeM: 0, altitudeLabel: undefined });
    broadcastEntityPatches([{ id: atual.token.id, patch: { altitudeM: 0, altitudeLabel: undefined } }]);
    const alvoNome = atual.alvoToken.label || atual.alvoPersonagem?.name || atual.alvoModeloInvocacao?.nome || 'Criatura';
    useLogStore.getState().addLog('combat', `🐘 ${atual.modelo.nome} usa Massa Esmagadora contra ${alvoNome}: ${formula} de impacto (${dano})${dominioAtivo ? ' com Expansão de Domínio' : ''}${alvoFicouCaido ? '; alvo Caído' : '; alvo não ficou Caído'}.`);
    return { ok: true, alvo: alvoNome, formula, dano, caiu: alvoFicouCaido, requestId };
  } catch (error) {
    useLogStore.getState().addLog('combat', `⚠️ Massa Esmagadora do Elefante foi interrompida: ${error instanceof Error ? error.message : 'falha inesperada'}.`);
    return { ok: false, motivo: error instanceof Error ? error.message : 'Massa Esmagadora foi interrompida.' };
  } finally {
    massaEsmagadoraPendente.delete(chave);
  }
}

function devolverCustoMassaEsmagadora(
  donoId: string,
  instanciaAntes: InstanciaInvocacao,
  categoria: NonNullable<ReturnType<typeof categoriaEconomiaDaAcao>>,
  acaoId: string,
  requestId: string,
  debito: { peDonoRestante: number; peDonoConsumido: number; recursosRestantes: Record<string, number> },
): void {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const instancia = dono?.instanciasInvocacao?.find(item => item.id === instanciaAntes.id);
  if (!dono || !instancia) return;
  const saldo = instancia.economiaAcoes?.[categoria];
  const economiaAcoes = instancia.economiaAcoes && saldo ? {
    ...instancia.economiaAcoes,
    [categoria]: { ...saldo, atual: Math.min(saldo.maximo, saldo.atual + 1) },
  } : instancia.economiaAcoes;
  const recargas = { ...(instancia.recargas ?? {}) };
  const recargaAnterior = instanciaAntes.recargas?.[acaoId];
  if (recargaAnterior === undefined) delete recargas[acaoId];
  else recargas[acaoId] = recargaAnterior;
  const recursosAtuais = { ...(instancia.recursosAtuais ?? {}) };
  for (const [recurso, saldoDepois] of Object.entries(debito.recursosRestantes)) {
    const consumido = (instanciaAntes.recursosAtuais?.[recurso] ?? saldoDepois) - saldoDepois;
    if (consumido > 0) recursosAtuais[recurso] = (recursosAtuais[recurso] ?? 0) + consumido;
  }
  const atualizada = InstanciaInvocacaoSchema.parse({
    ...instancia,
    version: instancia.version + 1,
    ...(economiaAcoes ? { economiaAcoes } : {}),
    recargas,
    recursosAtuais,
    eventosAcoesProcessados: (instancia.eventosAcoesProcessados ?? []).filter(id => id !== requestId),
  });
  gravarInstancia(dono, atualizada, debito.peDonoConsumido > 0
    ? { peCurrent: (dono.peCurrent ?? 0) + debito.peDonoConsumido }
    : {});
}

function aplicarCaidoEmInstancia(
  dono: Character,
  modelo: InvocacaoControlador,
  token: Entity,
  instancia: InstanciaInvocacao,
): boolean {
  if (instanciaTemCondicao(instancia, 'caido')) return true;
  const condicao = {
    id: novoIdInvocacao('massa-caido'), conditionId: 'caido', name: 'Caído', icon: '🔻',
    remainingTurns: -1, remainingRounds: -1, durationMode: 'ate_acabar',
    sourceCharId: modelo.donoCharacterId, sourceCharName: modelo.nome,
    sourceEntityId: modelo.subcategoria, sourceInstanceId: instancia.id,
  };
  const atualizada = InstanciaInvocacaoSchema.parse({
    ...instancia,
    version: instancia.version + 1,
    condicoes: [...(instancia.condicoes ?? []), condicao],
  });
  gravarInstancia(dono, atualizada);
  const ids = new Set(token.invocationConditionIds ?? []);
  ids.add('caido');
  useMapStore.getState().updateEntity(token.id, { invocationConditionIds: [...ids] });
  return true;
}

/** Levantar uma invocação Caída consome a Ação de Movimento própria dela. */
export function comandarLevantarInvocacao(
  donoId: string,
  tokenId: string,
  instanciaId: string,
  requestId = novoIdInvocacao('levantar-invocacao'),
): { ok: true } | { ok: false; motivo: string } {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const token = useMapStore.getState().entities[tokenId];
  if (!dono || !token || token.ownerCharId !== donoId || !token.invocationId || token.invocationInstanceId !== instanciaId) {
    return { ok: false, motivo: 'A instância selecionada não está mais no mapa.' };
  }
  const modelo = obterModeloDoToken(dono, token);
  if (!modelo) return { ok: false, motivo: 'Modelo da invocação não encontrado.' };
  const instancia = obterInstanciaDoToken(dono, token, modelo);
  if (instancia.estado !== 'ativa' || !instanciaTemCondicao(instancia, 'caido')) {
    return { ok: false, motivo: 'A invocação não está Caída ou ficou inativa.' };
  }
  if ((instancia.agarradoPorInvocacao?.length ?? 0) > 0) return { ok: false, motivo: 'Uma invocação Agarrada não pode se levantar.' };
  if (!podeComandarInvocacao(donoId, token.invocationId)) return { ok: false, motivo: 'Levantar só pode ser comandado no turno do Controlador.' };
  if (!requestId.trim()) return { ok: false, motivo: 'ID de comando inválido.' };
  if (instancia.eventosAcoesProcessados?.includes(requestId)) return { ok: false, motivo: 'Este comando já foi processado.' };

  const gasto = gastarAcaoDaInstancia(instancia, 'acaoMovimento', 1, requestId);
  if (!gasto.ok) return gasto;
  const condicoes = (gasto.instancia.condicoes ?? []).filter(condicao => {
    if (typeof condicao === 'string') return normalizarCondicaoInvocacao(condicao) !== 'caido';
    if (!condicao || typeof condicao !== 'object') return true;
    return normalizarCondicaoInvocacao((condicao as { conditionId?: unknown }).conditionId) !== 'caido';
  });
  const atualizada = InstanciaInvocacaoSchema.parse({
    ...gasto.instancia,
    version: gasto.instancia.version + 1,
    condicoes,
  });
  gravarInstancia(dono, atualizada);
  const restantesNoToken = (token.invocationConditionIds ?? []).filter(id => normalizarCondicaoInvocacao(id) !== 'caido');
  useMapStore.getState().updateEntity(token.id, { invocationConditionIds: restantesNoToken });
  useLogStore.getState().addLog('combat', `🐾 ${modelo.apelido?.trim() || modelo.nome} gasta Ação de Movimento própria e se levanta.`);
  return { ok: true };
}

/** Marca o alvo coberto pela ação Fuga; a duração fica sob resolução da mesa porque a fonte não a define. */
export function comandarFugaCoelhos(
  donoId: string,
  invocacaoId: string,
  targetEntityId: string,
  opcoes?: { instanciaId?: string; requestId?: string },
): { ok: true; alvo: string; lado: 'aliado' | 'inimigo' } | { ok: false; motivo: string } {
  const characters = useCharacterStore.getState().characters;
  const dono = characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  const acao = modelo?.acoes.find(item => item.id === 'fuga');
  const mapa = useMapStore.getState();
  const token = Object.values(mapa.entities).find(entity => entity.ownerCharId === donoId &&
    entity.invocationId === invocacaoId && (!opcoes?.instanciaId || entity.invocationInstanceId === opcoes.instanciaId));
  const alvo = mapa.entities[targetEntityId];
  if (!dono || modelo?.subcategoria !== 'dez-sombras:fuga-do-coelho' || !acao || !token || !alvo) {
    return { ok: false, motivo: 'Fuga dos Coelhos, instância ou alvo não encontrado no mapa.' };
  }
  if (token.hp !== undefined && token.hp <= 0 || token.hidden || mapa.layerVisible[token.layer ?? 'tokens'] === false) {
    return { ok: false, motivo: 'A Horda precisa estar ativa e visível no mapa.' };
  }
  if (!podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };
  const targetCharacterId = alvo.invocationId ? alvo.ownerCharId : alvo.characterId;
  const fichaAlvo = targetCharacterId ? characters.find(character => character.id === targetCharacterId) : undefined;
  if (!fichaAlvo || alvo.id === token.id || (alvo.invocationId && ((alvo.hp ?? 0) <= 0 || alvo.invocationState === 'caida'))) {
    return { ok: false, motivo: 'Escolha uma criatura ativa ligada a uma ficha válida.' };
  }
  const distancia = distanciaCircularMetros(
    { x: token.x + token.w / 2, y: token.y + token.h / 2 },
    { x: alvo.x + alvo.w / 2, y: alvo.y + alvo.h / 2 },
    mapa.gridConfig,
  );
  const alcanceM = acao.alcanceM ?? 9;
  if (!Number.isFinite(distancia) || distancia > alcanceM + 0.05) {
    return { ok: false, motivo: `O alvo está fora do alcance de ${alcanceM} m da Fuga.` };
  }
  const instancia = obterInstanciaDoToken(dono, token, modelo);
  if (instancia.estado !== 'ativa') return { ok: false, motivo: 'Uma Horda caída ou inativa não pode usar Fuga.' };
  if (!podeUsarAcaoDaInstancia(instancia, acao.id)) return { ok: false, motivo: 'Fuga ainda está em recarga.' };
  const categoria = categoriaEconomiaDaAcao(acao, instancia.economiaAcoes);
  if (acao.categoriaAcao !== 'acao_complexa' || !categoria) return { ok: false, motivo: 'Fuga requer uma Ação Complexa configurada.' };
  const debito = prepararDebitoComando(dono, modelo, instancia, acao);
  if (!debito.ok) return debito;
  const requestId = opcoes?.requestId ?? novoIdInvocacao('fuga-coelhos');
  const gasto = gastarAcaoDaInstancia(instancia, categoria, 1, requestId);
  if (!gasto.ok) return gasto;
  const lado = mesmaEquipeNoMapa(dono, token, fichaAlvo, alvo) ? 'aliado' : 'inimigo';
  const combate = useCombatStore.getState();
  const atualizada = InstanciaInvocacaoSchema.parse({
    ...registrarRecargaDaAcao({ ...gasto.instancia, recursosAtuais: debito.recursosRestantes }, acao),
    fugaCoelhosAlvo: {
      targetEntityId: alvo.id,
      targetCharacterId: fichaAlvo.id,
      targetName: alvo.label || fichaAlvo.name,
      lado,
      tipoAlvo: alvo.invocationId ? 'invocacao' : 'personagem',
      ...(combate.inCombat && combate.combatId ? { combateId: combate.combatId } : {}),
      rodada: combate.round ?? 0,
    },
  });
  gravarInstancia(dono, atualizada, { peCurrent: debito.peDonoRestante });
  useLogStore.getState().addLog('combat', `🐇 ${modelo.apelido?.trim() || modelo.nome} usa Fuga em ${alvo.label || fichaAlvo.name}${lado === 'aliado' ? ': recebe Cobertura Completa contra ataques de alvo único.' : ': os coelhos cobrem e dificultam os movimentos do alvo.'}`, 'A duração de Fuga não é definida na Enciclopédia; encerre o vínculo quando a mesa resolver seu término.');
  return { ok: true, alvo: alvo.label || fichaAlvo.name, lado };
}

export function encerrarFugaCoelhos(
  donoId: string,
  instanciaId: string,
): { ok: true } | { ok: false; motivo: string } {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const instancia = dono?.instanciasInvocacao?.find(item => item.id === instanciaId);
  if (!dono || !instancia || !instancia.fugaCoelhosAlvo) return { ok: false, motivo: 'Não há um alvo coberto pela Fuga nesta instância.' };
  gravarInstancia(dono, InstanciaInvocacaoSchema.parse({
    ...instancia,
    version: instancia.version + 1,
    fugaCoelhosAlvo: undefined,
  }));
  useLogStore.getState().addLog('combat', `🐇 Fuga dos Coelhos em ${instancia.fugaCoelhosAlvo.targetName} foi encerrada pela mesa.`);
  return { ok: true };
}

const TAMANHOS_FUGA_COELHOS = ['Minúsculo', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Colossal'] as const;
const dispersoesFugaPendentes = new Set<string>();
const ataquesCoelhoPendentes = new Set<string>();

function indicePorteFugaCoelhos(porte: string): number {
  const nome = porte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return TAMANHOS_FUGA_COELHOS.findIndex(item =>
    item.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === nome,
  );
}

export type ResultadoDispersaoFugaCoelhos =
  | { ok: true; tokenIds: string[]; quantidade: number; hpAtualRestante: number; hpMaximoRestante: number; porteRestante: string; repetido?: true }
  | { ok: false; motivo: string };

/** Reduz a Horda e materializa os tokens subordinados sem criar novas vagas de invocação. */
export function comandarDispersaoTaticaFugaCoelhos(
  donoId: string,
  invocacaoId: string,
  quantidade: number,
  pvMaximoRestante: number,
  porteRestante: string,
  opcoes?: { instanciaId?: string; requestId?: string },
): ResultadoDispersaoFugaCoelhos {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  if (!dono) return { ok: false, motivo: 'Personagem inválido.' };
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 6) {
    return { ok: false, motivo: 'A Dispersão precisa liberar de um a seis coelhos.' };
  }
  if (!Number.isInteger(pvMaximoRestante) || pvMaximoRestante < 1) {
    return { ok: false, motivo: 'Informe PV máximos restantes como um inteiro positivo.' };
  }
  const requestId = opcoes?.requestId?.trim() || novoIdInvocacao('dispersao-fuga');
  if (requestId.length > 120) return { ok: false, motivo: 'Identificador da Dispersão é longo demais.' };
  const mapa = useMapStore.getState();
  const token = Object.values(mapa.entities).find(entity => entity.ownerCharId === donoId &&
    entity.invocationId === invocacaoId && entity.invocationSubordinate?.kind !== 'fuga-coelho' &&
    (!opcoes?.instanciaId || entity.invocationInstanceId === opcoes.instanciaId));
  const modelo = dono.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  const acao = modelo?.acoes.find(item => item.id === 'dispersao-tatica');
  if (!token || modelo?.subcategoria !== 'dez-sombras:fuga-do-coelho' || !acao) {
    return { ok: false, motivo: 'Horda da Fuga, instância ou ação de Dispersão não encontrada.' };
  }
  const instancia = obterInstanciaDoToken(dono, token, modelo);
  const dispersaoRegistrada = instancia.fugaCoelhosDispersoes?.find(item => item.eventoId === requestId);
  if (dispersaoRegistrada) {
    return {
      ok: true,
      tokenIds: [...dispersaoRegistrada.tokenIds],
      quantidade: dispersaoRegistrada.tokenIds.length,
      hpAtualRestante: instancia.hpAtual,
      hpMaximoRestante: instancia.hpMaximoAtual,
      porteRestante: dispersaoRegistrada.porteRestante,
      repetido: true,
    };
  }
  if (dispersoesFugaPendentes.has(instancia.id)) return { ok: false, motivo: 'Outra Dispersão desta Horda ainda está sendo resolvida.' };
  dispersoesFugaPendentes.add(instancia.id);
  try {
    if (token.hidden || mapa.layerVisible[token.layer ?? 'tokens'] === false || (token.hp ?? 0) <= 0 ||
      token.invocationState === 'caida' || instancia.estado !== 'ativa') {
      return { ok: false, motivo: 'A Horda precisa estar ativa e visível para se dispersar.' };
    }
    if (!podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };
    if (acao.tipo !== 'habilidade' || acao.categoriaAcao !== 'acao_bonus' || acao.statusAutomacao === 'manual') {
      return { ok: false, motivo: 'Dispersão Tática precisa estar configurada como Ação Bônus resolvível.' };
    }
    if (!podeUsarAcaoDaInstancia(instancia, acao.id)) return { ok: false, motivo: 'Dispersão Tática ainda está em recarga.' };
    const categoria = categoriaEconomiaDaAcao(acao, instancia.economiaAcoes);
    if (categoria !== 'acaoBonus') return { ok: false, motivo: 'Ação Bônus própria não configurada para esta Horda.' };
    const debito = prepararDebitoComando(dono, modelo, instancia, acao);
    if (!debito.ok) return debito;
    if (pvMaximoRestante >= instancia.hpMaximoAtual) {
      return { ok: false, motivo: `A Dispersão deve reduzir os PV máximos da Horda (atual ${instancia.hpMaximoAtual}).` };
    }
    const porteAtual = token.invocationEffectiveSize ?? modelo.tamanho ?? modelo.porte ?? 'Médio';
    const indiceAtual = indicePorteFugaCoelhos(porteAtual);
    const indiceNovo = indicePorteFugaCoelhos(porteRestante);
    if (indiceAtual < 0 || indiceNovo < 0 || indiceNovo >= indiceAtual) {
      return { ok: false, motivo: `Escolha um porte válido menor que o porte atual (${porteAtual}).` };
    }
    const ativos = coelhosDispersosAtivos(mapa.entities, token.id, instancia.id);
    if (ativos.length + quantidade > 6) {
      return { ok: false, motivo: `Há ${ativos.length} coelho(s) disperso(s); o limite simultâneo é seis.` };
    }
    const grade = mapa.gridConfig;
    const passo = grade.dpi;
    if (!(passo > 0) || !(grade.metersPerCell > 0) || !(token.w > 0) || !(token.h > 0)) {
      return { ok: false, motivo: 'Grade ou pegada da Horda inválida.' };
    }
    const celulasHorda = celulasFugaCoelhosPorPorte(porteRestante);
    const larguraHorda = passo * celulasHorda;
    const alturaHorda = passo * celulasHorda;
    const hordaReduzida: Entity = { ...token, w: larguraHorda, h: alturaHorda, shape: 'RECT' };
    const hordaColisao = { origin: { x: token.x, y: token.y }, entity: hordaReduzida };
    const offsets: Array<{ coluna: number; linha: number }> = [];
    for (let linha = -1; linha <= celulasHorda; linha++) {
      for (let coluna = -1; coluna <= celulasHorda; coluna++) {
        if (linha !== -1 && linha !== celulasHorda && coluna !== -1 && coluna !== celulasHorda) continue;
        offsets.push({ coluna, linha });
      }
    }
    const paredesAtivas = WallsEngine.blockingSegments(mapa.walls, 'sight');
    const entidadesFixas = Object.values(mapa.entities).filter(entity =>
      entity.id !== token.id && entity.layer !== 'map' && !entity.hidden && !entity.carriedBy,
    );
    const posicoes: Array<{ x: number; y: number }> = [];
    for (const offset of offsets) {
      const posicao = { x: token.x + offset.coluna * passo, y: token.y + offset.linha * passo };
      const coelho: Entity = {
        id: `fuga-preview-${posicoes.length}`,
        shape: 'ELLIPSE', x: posicao.x, y: posicao.y, w: passo, h: passo, rotation: 0,
        color: '#d7c6f2', locked: false, layer: 'tokens',
      };
      const candidato = { origin: posicao, entity: coelho };
      const colideComHorda = tokenFootprintsOverlap(candidato, hordaColisao);
      const colideComEntidade = entidadesFixas.some(entity => tokenFootprintsOverlap(
        candidato, { origin: { x: entity.x, y: entity.y }, entity },
      ));
      const colideComCoelho = posicoes.some((origem, index) => tokenFootprintsOverlap(
        candidato,
        { origin: origem, entity: { ...coelho, id: `fuga-planejado-${index}`, x: origem.x, y: origem.y } },
      ));
      const centro = { x: posicao.x + passo / 2, y: posicao.y + passo / 2 };
      const bloqueadoPorParede = WallsEngine.minDistanceToSegments(centro, paredesAtivas) < passo * Math.SQRT1_2;
      if (colideComHorda || colideComEntidade || colideComCoelho || bloqueadoPorParede) continue;
      posicoes.push(posicao);
      if (posicoes.length === quantidade) break;
    }
    if (posicoes.length < quantidade) {
      return { ok: false, motivo: `Só há ${posicoes.length} espaço(s) adjacente(s) livre(s); libere espaço antes da Dispersão.` };
    }

    if (instancia.eventosAcoesProcessados?.includes(requestId)) {
      return { ok: false, motivo: 'Este comando de Dispersão já foi usado.' };
    }
    const gasto = gastarAcaoDaInstancia(instancia, categoria, 1, requestId);
    if (!gasto.ok) return gasto;
    const proporcaoPV = Math.max(0, instancia.hpAtual) / instancia.hpMaximoAtual;
    const hpAtualRestante = Math.max(1, Math.min(pvMaximoRestante, Math.floor(proporcaoPV * pvMaximoRestante)));
    const combate = useCombatStore.getState();
    const tokenIds = posicoes.map(() => novoIdInvocacao('coelho-disperso'));
    const atualizada = InstanciaInvocacaoSchema.parse({
      ...gasto.instancia,
      version: gasto.instancia.version + 1,
      hpAtual: hpAtualRestante,
      hpMaximoAtual: pvMaximoRestante,
      fugaCoelhosDispersoes: [...(gasto.instancia.fugaCoelhosDispersoes ?? []), {
        eventoId: requestId,
        tokenIds,
        pvMaximoRestante,
        porteRestante,
        ...(combate.inCombat && combate.combatId ? { combateId: combate.combatId } : {}),
        rodada: combate.round ?? 0,
      }].slice(-200),
    });
    const entidadesCriadas: string[] = [];
    try {
      mapa.pushHistory();
      posicoes.forEach((posicao, index) => {
        const coelhoId = mapa.addEntity({
          id: tokenIds[index], shape: 'ELLIPSE', x: posicao.x, y: posicao.y, w: passo, h: passo, rotation: 0,
          color: '#d7c6f2', label: `Coelho disperso ${ativos.length + index + 1}`, locked: false, layer: 'tokens',
          nameplate: true, hp: 1, hpMax: 1, ownerCharId: donoId, ownerProfileId: dono.profileId || undefined,
          invocationId: modelo.id, invocationInstanceId: instancia.id, invocationState: 'ativa',
          invocationDefense: token.invocationDefense ?? modelo.defesa, invocationMovementM: 9,
          invocationEffectiveSize: 'Minúsculo',
          invocationSubordinate: { kind: 'fuga-coelho', parentTokenId: token.id, dispersionEventId: requestId, index },
        });
        entidadesCriadas.push(coelhoId);
      });
      mapa.updateEntity(token.id, {
        w: larguraHorda, h: alturaHorda, shape: 'RECT',
        hp: hpAtualRestante, hpMax: pvMaximoRestante,
        invocationEffectiveSize: porteRestante,
        invocationEffectiveSizeCategory: indiceNovo,
      });
      gravarInstancia(dono, atualizada);
    } catch {
      if (entidadesCriadas.length) useMapStore.getState().removeEntities(entidadesCriadas);
      useMapStore.getState().updateEntity(token.id, {
        x: token.x, y: token.y, w: token.w, h: token.h, shape: token.shape,
        hp: token.hp, hpMax: token.hpMax,
        invocationEffectiveSize: token.invocationEffectiveSize,
        invocationEffectiveSizeCategory: token.invocationEffectiveSizeCategory,
      });
      const donoAtual = useCharacterStore.getState().characters.find(character => character.id === donoId);
      if (donoAtual) useCharacterStore.getState().updateCharacter(donoId, {
        instanciasInvocacao: dono.instanciasInvocacao,
        invocacoesConhecidas: dono.invocacoesConhecidas,
      });
      return { ok: false, motivo: 'Não foi possível registrar a Dispersão; a Horda e seus tokens foram restaurados.' };
    }
    broadcastEntityPatches([{ id: token.id, patch: {
      w: larguraHorda, h: alturaHorda, shape: 'RECT', hp: hpAtualRestante, hpMax: pvMaximoRestante,
      invocationEffectiveSize: porteRestante, invocationEffectiveSizeCategory: indiceNovo,
    } }]);
    useLogStore.getState().addLog('combat', `🐇 Dispersão Tática: ${quantidade} coelho(s) foram liberados ao redor da Horda; ela agora tem ${hpAtualRestante}/${pvMaximoRestante} PV e porte ${porteRestante}.`,
      'O mestre confirmou o porte e os PV máximos restantes, pois a fonte não determina a proporção numérica da redução.');
    return { ok: true, tokenIds, quantidade, hpAtualRestante, hpMaximoRestante: pvMaximoRestante, porteRestante };
  } finally {
    dispersoesFugaPendentes.delete(instancia.id);
  }
}

export type ResultadoAtaqueCoelhoDisperso =
  | { ok: true; acertou: boolean; totalAtaque: number; defesa: number; dano: number; critico: boolean; requestId: string }
  | { ok: false; motivo: string };

/** Um coelho faz um ataque corpo a corpo simples; o dano fixo ignora RD comum. */
export async function comandarAtaqueCoelhoDisperso(
  donoId: string,
  coelhoTokenId: string,
  alvoId: string,
  opcoes?: { requestId?: string },
): Promise<ResultadoAtaqueCoelhoDisperso> {
  const requestId = opcoes?.requestId?.trim() || novoIdInvocacao('ataque-coelho');
  if (requestId.length > 120) return { ok: false, motivo: 'Identificador do ataque é longo demais.' };
  const characters = useCharacterStore.getState().characters;
  const dono = characters.find(character => character.id === donoId);
  let mapa = useMapStore.getState();
  let coelho = mapa.entities[coelhoTokenId];
  if (!dono || !coelho || coelho.ownerCharId !== donoId || coelho.invocationSubordinate?.kind !== 'fuga-coelho') {
    return { ok: false, motivo: 'Coelho disperso não encontrado para este Controlador.' };
  }
  const marcador = coelho.invocationSubordinate;
  const horda = mapa.entities[marcador.parentTokenId];
  const instancia = dono.instanciasInvocacao?.find(item => item.id === coelho?.invocationInstanceId);
  const modelo = dono.invocacoesConhecidas?.find(item => item.id === coelho?.invocationId);
  if (!horda || horda.invocationInstanceId !== instancia?.id || horda.invocationSubordinate?.kind === 'fuga-coelho' ||
    !instancia || instancia.estado !== 'ativa' || modelo?.subcategoria !== 'dez-sombras:fuga-do-coelho') {
    return { ok: false, motivo: 'A Horda que liberou o coelho não está mais ativa.' };
  }
  if ((coelho.hp ?? 0) <= 0 || coelho.hidden || mapa.layerVisible[coelho.layer ?? 'tokens'] === false) {
    return { ok: false, motivo: 'Este coelho não está ativo e visível no mapa.' };
  }
  if (!podeComandarInvocacao(donoId, horda.invocationId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };

  const combate = useCombatStore.getState();
  const rodada = combate.round ?? 0;
  const ataqueUsado = coelho.invocationSubordinate.attackUsed;
  if (combate.inCombat && ataqueUsado && ataqueUsado.combatId === combate.combatId && ataqueUsado.round === rodada) {
    return { ok: false, motivo: 'Este coelho já atacou nesta rodada.' };
  }
  const chavePendente = `${coelho.id}:${combate.inCombat ? combate.combatId ?? 'combate' : 'fora'}:${rodada}`;
  if (ataquesCoelhoPendentes.has(chavePendente)) return { ok: false, motivo: 'O ataque deste coelho já está sendo resolvido.' };

  const resolverAlvo = () => {
    const estadoMapa = useMapStore.getState();
    const entidades = estadoMapa.entities;
    const personagens = useCharacterStore.getState().characters;
    let alvoToken: Entity | undefined;
    let alvoFicha: Character | undefined;
    let alvoModelo: InvocacaoControlador | undefined;
    let alvoInstancia: InstanciaInvocacao | undefined;
    if (alvoId.startsWith('invoc:')) {
      alvoToken = entidades[alvoId.slice('invoc:'.length)];
    } else if (entidades[alvoId]?.invocationId) {
      alvoToken = entidades[alvoId];
    } else {
      alvoFicha = personagens.find(character => character.id === alvoId) ??
        personagens.find(character => character.id === entidades[alvoId]?.characterId);
      alvoToken = alvoFicha ? resolverTokenDaFicha(alvoFicha, entidades, estadoMapa.layerVisible) : undefined;
      if (!alvoFicha && entidades[alvoId]?.characterId) {
        alvoToken = entidades[alvoId];
        alvoFicha = personagens.find(character => character.id === alvoToken?.characterId);
      }
    }
    if (!alvoToken || alvoToken.hidden || (alvoToken.layer ?? 'tokens') !== 'tokens' ||
      estadoMapa.layerVisible[alvoToken.layer ?? 'tokens'] === false || alvoToken.carriedBy) {
      return { ok: false as const, motivo: 'Escolha um alvo visível e ativo no mapa.' };
    }
    const donoAlvoId = alvoToken.invocationId ? alvoToken.ownerCharId : alvoToken.characterId;
    alvoFicha = donoAlvoId ? personagens.find(character => character.id === donoAlvoId) : undefined;
    if (!alvoFicha || mesmaEquipeNoMapa(dono, horda, alvoFicha, alvoToken)) {
      return { ok: false as const, motivo: 'O coelho só pode atacar uma criatura hostil ligada a uma ficha.' };
    }
    if (alvoToken.invocationId) {
      if ((alvoToken.hp ?? 0) <= 0 || alvoToken.invocationState === 'caida' || alvoToken.invocationState === 'derrotada' || alvoToken.invocationState === 'dissipada') {
        return { ok: false as const, motivo: 'A invocação-alvo está caída ou inativa.' };
      }
      alvoModelo = alvoFicha.invocacoesConhecidas?.find(item => item.id === alvoToken?.invocationId);
      alvoInstancia = alvoFicha.instanciasInvocacao?.find(item => item.id === alvoToken?.invocationInstanceId);
      if (!alvoModelo || !alvoInstancia || alvoInstancia.estado !== 'ativa') {
        return { ok: false as const, motivo: 'A invocação-alvo não possui uma instância ativa.' };
      }
      const defesaBase = Number.isFinite(alvoToken.invocationDefense) ? alvoToken.invocationDefense! : alvoModelo.defesa;
      const penalidadeGarras = penalidadeGarrasTigre(personagens, `invoc:${alvoInstancia.id}`, useCombatStore.getState().combatId ?? undefined);
      const defesa = Math.max(0, defesaBase - ((alvoInstancia.agarradoPorInvocacao?.length ?? 0) > 0 ? 3 : 0) - penalidadeGarras);
      return { ok: true as const, token: alvoToken, ficha: alvoFicha, modelo: alvoModelo, instancia: alvoInstancia, defesa };
    }
    if ((alvoFicha.hpCurrent ?? 0) <= 0) return { ok: false as const, motivo: 'A ficha-alvo está caída.' };
    const penalidadeGarras = penalidadeGarrasTigre(personagens, alvoFicha.id, useCombatStore.getState().combatId ?? undefined);
    return { ok: true as const, token: alvoToken, ficha: alvoFicha, defesa: Math.max(0, computeTotalDefense(alvoFicha, {}, 'melee') - penalidadeGarras) };
  };
  let alvoResolvido = resolverAlvo();
  if (!alvoResolvido.ok) return alvoResolvido;
  if (!isWithinTouch(coelho, alvoResolvido.token, mapa.gridConfig)) {
    return { ok: false, motivo: 'O coelho precisa terminar seu movimento adjacente ao alvo antes de atacar.' };
  }
  const acaoAtaque = {
    ...modelo.acoes.find(item => item.id === 'dispersao-tatica')!,
    tipo: 'ataque' as const,
    tipoAtaque: 'corpo_a_corpo' as const,
    atributoAtaque: 'forca' as const,
    alcanceM: 1.5,
    bonusAtaque: 0,
  };
  const bonusAtaque = calcularBonusAtaqueInvocacao(dono, modelo, acaoAtaque);
  if (!bonusAtaque || !Number.isFinite(bonusAtaque.total)) return { ok: false, motivo: 'Não foi possível calcular o ataque do coelho.' };

  ataquesCoelhoPendentes.add(chavePendente);
  try {
    const natural = await rollD20Autonomo(bonusAtaque.total, { label: 'Ataque de Coelho disperso' });
    if (!Number.isInteger(natural) || natural < 1 || natural > 20) return { ok: false, motivo: 'A rolagem do ataque retornou um d20 inválido.' };
    mapa = useMapStore.getState();
    coelho = mapa.entities[coelhoTokenId];
    const donoAtual = useCharacterStore.getState().characters.find(character => character.id === donoId);
    const hordaAtual = coelho?.invocationSubordinate?.kind === 'fuga-coelho'
      ? mapa.entities[coelho.invocationSubordinate.parentTokenId]
      : undefined;
    const instanciaAtual = donoAtual?.instanciasInvocacao?.find(item => item.id === coelho?.invocationInstanceId);
    if (!coelho || !hordaAtual || !instanciaAtual || instanciaAtual.estado !== 'ativa' ||
      hordaAtual.invocationInstanceId !== instanciaAtual.id || (coelho.hp ?? 0) <= 0 ||
      coelho.hidden || mapa.layerVisible[coelho.layer ?? 'tokens'] === false || !podeComandarInvocacao(donoId, hordaAtual.invocationId)) {
      return { ok: false, motivo: 'A Horda ou o coelho mudou durante a rolagem; nenhum dano foi aplicado.' };
    }
    alvoResolvido = resolverAlvo();
    if (!alvoResolvido.ok || !isWithinTouch(coelho, alvoResolvido.token, mapa.gridConfig)) {
      return { ok: false, motivo: alvoResolvido.ok ? 'O alvo saiu do alcance durante a rolagem; nenhum dano foi aplicado.' : alvoResolvido.motivo };
    }
    const resultado = resolverAcertoInvocacao(natural, bonusAtaque.total, alvoResolvido.defesa, 20);
    const marcadorAtaque = {
      ...coelho.invocationSubordinate!,
      attackUsed: {
        ...(combate.inCombat && combate.combatId ? { combatId: combate.combatId } : {}),
        round: combate.inCombat ? rodada : 0,
        requestId,
      },
    };
    mapa.updateEntity(coelho.id, { invocationSubordinate: marcadorAtaque });
    broadcastEntityPatches([{ id: coelho.id, patch: { invocationSubordinate: marcadorAtaque } }]);
    if (!resultado.acertou) {
      useLogStore.getState().addLog('combat', `🐇 Ataque do Coelho disperso contra ${alvoResolvido.ficha.name}: d20 ${natural} + ${bonusAtaque.total} = ${resultado.total} vs Defesa ${alvoResolvido.defesa}; erro.`);
      return { ok: true, acertou: false, totalAtaque: resultado.total, defesa: alvoResolvido.defesa, dano: 0, critico: false, requestId };
    }
    const eventoDanoId = `${requestId}:dano`;
    if (alvoResolvido.token.invocationId && alvoResolvido.instancia) {
      const aplicado = causarDanoInvocacao(alvoResolvido.token.id, 1, undefined, alvoResolvido.instancia.id, {
        tipoAlvo: 'unico', eventoId: eventoDanoId, critico: resultado.critico, ignoresRD: true,
      });
      if (!aplicado.ok) return { ok: false, motivo: aplicado.motivo };
    } else {
      await useCharacterStore.getState().applyDamage(alvoResolvido.ficha.id, 1, undefined, {
        attackerId: donoId, source: 'omni', isMelee: true, ignoresRD: true,
        attack: { kind: 'melee', critical: resultado.critico, criticalFail: false },
        tags: ['__shikigami_fuga_coelho', eventoDanoId],
      });
    }
    useLogStore.getState().addLog('combat', `🐇 Ataque do Coelho disperso acerta ${alvoResolvido.ficha.name}: ${resultado.total} vs Defesa ${alvoResolvido.defesa}; 1 dano fixo aplicado, ignorando RD comum${resultado.critico ? ' (crítico; o dano permanece 1)' : ''}.`);
    return { ok: true, acertou: true, totalAtaque: resultado.total, defesa: alvoResolvido.defesa, dano: 1, critico: resultado.critico, requestId };
  } catch (error) {
    const detalhe = error instanceof Error ? error.message : String(error);
    useLogStore.getState().addLog('combat', `⚠️ Ataque do Coelho disperso interrompido: ${detalhe}. Confira o estado antes de repetir.`);
    return { ok: false, motivo: 'O ataque foi interrompido durante a resolução.' };
  } finally {
    ataquesCoelhoPendentes.delete(chavePendente);
  }
}

function normalizarNomePericia(valor: string): string {
  return valor.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function bonusPericiaPersonagem(personagem: Character, pericia: string): number {
  const nome = normalizarNomePericia(pericia);
  const habilidade = (personagem.skills ?? []).find(item => normalizarNomePericia(item.name ?? '') === nome);
  if (!habilidade) return 0;
  const atributo = (personagem.attributes ?? []).find(item => item.name === habilidade.linkedAttribute);
  const modificador = atributo ? Math.floor((atributo.value - 10) / 2) : 0;
  const treinamento = habilidade.trained ? getTrainingBonusByLevel(personagem.level ?? 1) : 0;
  return modificador + treinamento + (habilidade.externalBonus ?? 0);
}

function turnoAtualDoPersonagem(personagemId: string): boolean {
  const combate = useCombatStore.getState();
  return !combate.inCombat || combate.initiativeOrder[combate.currentTurnIndex]?.charId === personagemId;
}

export function alvoFlanqueadoPelaMatilha(
  modelo: InvocacaoControlador,
  servo: Entity,
  alvo: Entity,
  characters: Character[],
  entities: Record<string, Entity>,
  layerVisible: Record<string, boolean>,
  grid: { dpi?: number; metersPerCell?: number },
): boolean {
  if (modelo.subcategoria !== 'dez-sombras:cao-branco' && modelo.subcategoria !== 'dez-sombras:cao-preto') return false;
  const dono = characters.find(character => character.id === modelo.donoCharacterId);
  const tokenDoAlvoId = alvo.invocationId ? alvo.ownerCharId : alvo.characterId;
  const personagemAlvo = tokenDoAlvoId ? characters.find(character => character.id === tokenDoAlvoId) : undefined;
  if (!dono || !personagemAlvo || mesmaEquipeNoMapa(dono, servo, personagemAlvo, alvo) ||
    !isWithinTouch(servo, alvo, grid)) return false;

  return Object.values(entities).some(aliado => {
    if (aliado.id === servo.id || aliado.id === alvo.id || aliado.hidden || aliado.carriedBy ||
      (aliado.layer ?? 'tokens') !== 'tokens' || layerVisible[aliado.layer ?? 'tokens'] === false) return false;
    if (aliado.invocationId && ((aliado.hp ?? 0) <= 0 || (aliado.invocationState && aliado.invocationState !== 'ativa'))) return false;
    const aliadoCharacterId = aliado.invocationId ? aliado.ownerCharId : aliado.characterId;
    const personagemAliado = aliadoCharacterId ? characters.find(character => character.id === aliadoCharacterId) : undefined;
    if (!personagemAliado || !mesmaEquipeNoMapa(dono, servo, personagemAliado, aliado)) return false;
    return isWithinTouch(aliado, alvo, grid);
  });
}

type AlvoAgarrarInvocacao =
  | { tipo: 'personagem'; personagem: Character; token: Entity; nome: string }
  | { tipo: 'invocacao'; dono: Character; modelo: InvocacaoControlador; instancia: InstanciaInvocacao; token: Entity; nome: string };

function resolverAlvoAgarrar(
  donoId: string,
  alvoId: string,
  servo: Entity,
  alcanceM: number,
): { ok: true; alvo: AlvoAgarrarInvocacao } | { ok: false; motivo: string } {
  const mapa = useMapStore.getState();
  const personagens = useCharacterStore.getState().characters;
  const donoFonte = personagens.find(personagem => personagem.id === donoId);
  if (!donoFonte) return { ok: false, motivo: 'O Controlador da invocação não está disponível.' };
  let alvo: AlvoAgarrarInvocacao | undefined;
  if (alvoId.startsWith('invoc:')) {
    const token = mapa.entities[alvoId.slice('invoc:'.length)];
    if (!token?.ownerCharId || !token.invocationId || token.id === servo.id || token.hidden ||
      mapa.layerVisible[token.layer ?? 'tokens'] === false || (token.hp ?? 0) <= 0 ||
      (token.invocationState && token.invocationState !== 'ativa')) {
      return { ok: false, motivo: 'O alvo da língua não está mais ativo no mapa.' };
    }
    const dono = personagens.find(personagem => personagem.id === token.ownerCharId);
    const modelo = dono?.invocacoesConhecidas?.find(invocacao => invocacao.id === token.invocationId);
    if (!dono || !modelo) return { ok: false, motivo: 'A ficha da invocação-alvo não está mais disponível.' };
    if (mesmaEquipeNoMapa(donoFonte, servo, dono, token)) {
      return { ok: false, motivo: 'A Língua Sombria só pode agarrar uma criatura hostil.' };
    }
    const instancia = obterInstanciaDoToken(dono, token, modelo);
    if (instancia.estado !== 'ativa') return { ok: false, motivo: 'Uma invocação caída não pode ser agarrada.' };
    if ((instancia.agarradoPorInvocacao?.length ?? 0) > 0) return { ok: false, motivo: 'A invocação-alvo já está Agarrada.' };
    alvo = { tipo: 'invocacao', dono, modelo, instancia, token, nome: modelo.apelido?.trim() || modelo.nome };
  } else {
    const personagem = personagens.find(item => item.id === alvoId);
    if (!personagem || (personagem.hpCurrent ?? 1) <= 0) {
      return { ok: false, motivo: 'O alvo da língua não está mais ativo.' };
    }
    const token = resolverTokenDaFicha(personagem, mapa.entities, mapa.layerVisible);
    if (!token || token.hidden || mapa.layerVisible[token.layer ?? 'tokens'] === false) {
      return { ok: false, motivo: 'O alvo da língua não está mais visível no mapa.' };
    }
    if (mesmaEquipeNoMapa(donoFonte, servo, personagem, token)) {
      return { ok: false, motivo: 'A Língua Sombria só pode agarrar uma criatura hostil.' };
    }
    if ((personagem.activeConditions ?? []).some(condicao => condicao.conditionId === 'agarrado')) {
      return { ok: false, motivo: 'O alvo já está Agarrado.' };
    }
    alvo = { tipo: 'personagem', personagem, token, nome: personagem.name };
  }

  const escala = mapa.gridConfig.metersPerCell / mapa.gridConfig.dpi;
  if (!(escala > 0)) return { ok: false, motivo: 'Grade do mapa inválida.' };
  const distancia = Math.hypot(
    servo.x + servo.w / 2 - (alvo.token.x + alvo.token.w / 2),
    servo.y + servo.h / 2 - (alvo.token.y + alvo.token.h / 2),
  ) * escala;
  if (!Number.isFinite(distancia) || distancia > alcanceM + 1e-6) {
    return { ok: false, motivo: 'O alvo saiu do alcance da Língua Sombria.' };
  }
  return { ok: true, alvo };
}

type AlvoPuxarGama = { personagem: Character; token: Entity; nome: string } | {
  personagem: Character; modelo: InvocacaoControlador; instancia: InstanciaInvocacao; token: Entity; nome: string;
};

function rankPorteGama(valor: string | undefined): number | null {
  const porte = (valor ?? 'Médio').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const ranks: Record<string, number> = {
    minimo: 0, minusculo: 0, miudo: 0, pequeno: 1, medio: 2,
  };
  return Object.hasOwn(ranks, porte) ? ranks[porte] : null;
}

function resolverAlvoPuxarGama(dono: Character, alvoId: string, servo: Entity):
  | { ok: true; alvo: AlvoPuxarGama }
  | { ok: false; motivo: string } {
  const mapa = useMapStore.getState();
  const personagens = useCharacterStore.getState().characters;
  let alvo: AlvoPuxarGama | undefined;
  if (alvoId.startsWith('invoc:')) {
    const token = mapa.entities[alvoId.slice('invoc:'.length)];
    if (!token?.ownerCharId || !token.invocationId || token.id === servo.id || token.hidden || token.carriedBy ||
      mapa.layerVisible[token.layer ?? 'tokens'] === false || (token.hp ?? 0) <= 0 ||
      (token.invocationState && token.invocationState !== 'ativa')) {
      return { ok: false, motivo: 'O aliado selecionado não está ativo e visível no mapa.' };
    }
    const personagem = personagens.find(item => item.id === token.ownerCharId);
    const modelo = personagem?.invocacoesConhecidas?.find(item => item.id === token.invocationId);
    if (!personagem || !modelo) return { ok: false, motivo: 'A ficha da invocação aliada não está mais disponível.' };
    const instancia = obterInstanciaDoToken(personagem, token, modelo);
    if (instancia.estado !== 'ativa') return { ok: false, motivo: 'Uma invocação caída não pode ser puxada.' };
    if (!mesmaEquipeNoMapa(dono, servo, personagem, token)) {
      return { ok: false, motivo: 'Língua Sombria só pode puxar um aliado.' };
    }
    alvo = { personagem, modelo, instancia, token, nome: modelo.apelido?.trim() || modelo.nome };
  } else {
    const personagem = personagens.find(item => item.id === alvoId);
    if (!personagem || (personagem.hpCurrent ?? 1) <= 0) return { ok: false, motivo: 'O aliado selecionado não está ativo.' };
    const tokenPersonagem = resolverTokenDaFicha(personagem, mapa.entities, mapa.layerVisible);
    if (!mesmaEquipeNoMapa(dono, servo, personagem, tokenPersonagem)) {
      return { ok: false, motivo: 'Língua Sombria só pode puxar um aliado.' };
    }
    const token = resolverTokenDaFicha(personagem, mapa.entities, mapa.layerVisible);
    if (!token || token.hidden || token.carriedBy || mapa.layerVisible[token.layer ?? 'tokens'] === false) {
      return { ok: false, motivo: 'O aliado precisa ter um token ativo e visível no mapa.' };
    }
    alvo = { personagem, token, nome: personagem.name };
  }

  const porteAlvo = 'modelo' in alvo
    ? alvo.token.invocationEffectiveSize ?? alvo.modelo.porte
    : defaultSizeForLevel(alvo.personagem.level ?? 1, alvo.personagem.sizeCategory);
  const rankPorte = rankPorteGama(porteAlvo);
  if (rankPorte === null || rankPorte > 2) return { ok: false, motivo: 'Língua Sombria só pode puxar aliados de tamanho Médio ou menor.' };
  return { ok: true, alvo };
}

/** Reação da Língua Sombria: move instantaneamente um aliado até um espaço livre
 * adjacente ao Gama. O deslocamento não passa pelo fluxo de movimento/AoO. */
export function comandarPuxarAliadoGama(
  donoId: string,
  invocacaoId: string,
  alvoId: string,
  opcoes?: { instanciaId?: string; requestId?: string },
): { ok: true; nomeAlvo: string; destino: { x: number; y: number } } | { ok: false; motivo: string } {
  if (jogadorBloqueadoPorControleMestre(donoId, invocacaoId)) {
    return { ok: false, motivo: 'Esta sombra está sob controle do Mestre.' };
  }
  const combate = useCombatStore.getState();
  if (!combate.inCombat || !combate.combatId || !Number.isInteger(combate.round) || combate.round < 1 ||
    !combate.initiativeOrder[combate.currentTurnIndex]) {
    return { ok: false, motivo: 'Língua Sombria só pode ser usada durante uma rodada de combate ativa.' };
  }
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  const acao = modelo?.acoes.find(item => item.efeitoEspecial?.tipo === 'puxar_aliado_gama');
  if (!dono || !modelo || modelo.subcategoria !== 'dez-sombras:sapo' || !acao || acao.categoriaAcao !== 'reacao') {
    return { ok: false, motivo: 'A reação Língua Sombria não está configurada para este Gama.' };
  }
  if (!alvoId.trim()) return { ok: false, motivo: 'Selecione um aliado para puxar.' };

  const mapa = useMapStore.getState();
  const servo = tokensInvocados(donoId).find(token => token.invocationId === invocacaoId &&
    (!opcoes?.instanciaId || token.invocationInstanceId === opcoes.instanciaId) &&
    (token.hp ?? 0) > 0 && !token.hidden && !token.carriedBy &&
    mapa.layerVisible[token.layer ?? 'tokens'] !== false &&
    (!token.invocationState || token.invocationState === 'ativa'));
  if (!servo?.invocationInstanceId) return { ok: false, motivo: 'Gama precisa continuar ativo e visível no mapa.' };
  const instancia = obterInstanciaDoToken(dono, servo, modelo);
  if (instancia.estado !== 'ativa') return { ok: false, motivo: 'Gama está caído ou inativo.' };
  if (!podeUsarAcaoDaInstancia(instancia, acao.id)) return { ok: false, motivo: 'Língua Sombria ainda está em recarga.' };

  const marcadorAtual = instancia.usoLinguaSombriaGama;
  if (marcadorAtual?.combateId === combate.combatId && marcadorAtual.rodada === combate.round) {
    return { ok: false, motivo: 'Língua Sombria já foi usada nesta rodada.' };
  }
  const alvoResolvido = resolverAlvoPuxarGama(dono, alvoId, servo);
  if (!alvoResolvido.ok) return alvoResolvido;
  const alvo = alvoResolvido.alvo;
  const grid = mapa.gridConfig;
  if (!(grid.dpi > 0) || !(grid.metersPerCell > 0)) return { ok: false, motivo: 'Grade do mapa inválida.' };
  const alcanceM = acao.alcanceM ?? 6;
  const distanciaM = Math.hypot(
    servo.x + servo.w / 2 - (alvo.token.x + alvo.token.w / 2),
    servo.y + servo.h / 2 - (alvo.token.y + alvo.token.h / 2),
  ) * grid.metersPerCell / grid.dpi;
  if (!Number.isFinite(distanciaM) || distanciaM > alcanceM + 0.05) {
    return { ok: false, motivo: `O aliado está fora do alcance de ${alcanceM} m da Língua Sombria.` };
  }

  const centroX = servo.x + (servo.w - alvo.token.w) / 2;
  const centroY = servo.y + (servo.h - alvo.token.h) / 2;
  const candidatas = [
    { x: servo.x - alvo.token.w, y: centroY },
    { x: servo.x + servo.w, y: centroY },
    { x: centroX, y: servo.y - alvo.token.h },
    { x: centroX, y: servo.y + servo.h },
    { x: servo.x - alvo.token.w, y: servo.y - alvo.token.h },
    { x: servo.x + servo.w, y: servo.y - alvo.token.h },
    { x: servo.x - alvo.token.w, y: servo.y + servo.h },
    { x: servo.x + servo.w, y: servo.y + servo.h },
  ].sort((a, b) => Math.hypot(a.x - alvo.token.x, a.y - alvo.token.y) - Math.hypot(b.x - alvo.token.x, b.y - alvo.token.y));

  const entidadesFixas = Object.values(mapa.entities).filter(entity =>
    entity.id !== alvo.token.id && (entity.layer ?? 'tokens') === 'tokens' && !entity.hidden && !entity.carriedBy);
  const fog = useFogStore.getState();
  const bloqueios = [
    ...WallsEngine.blockingSegments(mapa.walls, 'sight'),
    ...buildFogSegments(fog.walls, fog.doors).map(segment => [segment.a, segment.b] as [{ x: number; y: number }, { x: number; y: number }]),
  ];
  const tokenMovel: MapCollisionToken = { origin: { x: alvo.token.x, y: alvo.token.y }, entity: alvo.token };
  const destino = candidatas.find(candidato => {
    const dx = candidato.x - alvo.token.x;
    const dy = candidato.y - alvo.token.y;
    const ocupaOutraPeca = entidadesFixas.some(entity => tokenFootprintsOverlap(
      tokenMovel,
      { origin: { x: entity.x, y: entity.y }, entity },
      dx,
      dy,
    ));
    return !ocupaOutraPeca && !placementBlocked([tokenMovel], bloqueios, dx, dy);
  });
  if (!destino) return { ok: false, motivo: 'Não há espaço livre e acessível adjacente ao Gama para o aliado.' };

  const categoria = categoriaEconomiaDaAcao(acao, instancia.economiaAcoes);
  if (categoria !== 'reacao') return { ok: false, motivo: 'A ficha não configurou a economia própria de Reação do Gama.' };
  const requestId = opcoes?.requestId ?? novoIdInvocacao('gama-lingua-sombria');
  const gasto = gastarAcaoDaInstancia(instancia, categoria, 1, requestId);
  if (!gasto.ok) return gasto;
  const atualizado = InstanciaInvocacaoSchema.parse({
    ...gasto.instancia,
    version: gasto.instancia.version + 1,
    usoLinguaSombriaGama: { combateId: combate.combatId, rodada: combate.round },
  });
  const donoAtual = useCharacterStore.getState().characters.find(character => character.id === donoId);
  if (!donoAtual) return { ok: false, motivo: 'O Controlador saiu do combate antes da reação.' };
  gravarInstancia(donoAtual, atualizado);
  useMapStore.getState().pushHistory();
  useMapStore.getState().updateEntity(alvo.token.id, { x: destino.x, y: destino.y });
  broadcastEntityPatches([{ id: alvo.token.id, patch: { x: destino.x, y: destino.y } }]);
  useLogStore.getState().addLog('combat', `🐸 ${modelo.apelido?.trim() || modelo.nome} usa Língua Sombria e puxa ${alvo.nome} para um espaço adjacente; o deslocamento não provoca ataques de oportunidade.`);
  return { ok: true, nomeAlvo: alvo.nome, destino };
}

/** Resolve a opção de Agarrar aberta por um acerto de Protusão de Língua.
 * A tentativa custa 4 PE, mas não debita nenhuma ação adicional da instância. */
export async function comandarAgarrarGama(
  donoId: string,
  invocacaoId: string,
  opcoes?: {
    instanciaId?: string;
    requestId?: string;
    contextoAmbiente?: { submerso?: boolean; escuridaoTotal?: boolean };
  },
): Promise<{ ok: true; sucesso: boolean; aplicouCondicao: boolean; totalGama: number; totalAlvo: number; nomeAlvo: string; bonusSituacional: number } | { ok: false; motivo: string }> {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  const acao = modelo?.acoes.find(item => item.id === 'protusao-lingua');
  if (!dono || !modelo || modelo.subcategoria !== 'dez-sombras:sapo' ||
    acao?.efeitoEspecial?.tipo !== 'agarrar_gama_apos_acerto') {
    return { ok: false, motivo: 'Esta opção só existe após um acerto da Protusão de Língua do Gama.' };
  }
  if (!podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'A tentativa de Agarrar só pode ser resolvida no turno do Controlador.' };

  const mapa = useMapStore.getState();
  const servo = tokensInvocados(donoId).find(token => token.invocationId === invocacaoId &&
    (!opcoes?.instanciaId || token.invocationInstanceId === opcoes.instanciaId) &&
    (token.hp ?? 0) > 0 && !token.hidden &&
    mapa.layerVisible[token.layer ?? 'tokens'] !== false &&
    (!token.invocationState || token.invocationState === 'ativa'));
  if (!servo?.invocationInstanceId) return { ok: false, motivo: 'Gama precisa continuar ativo e visível no mapa.' };
  const instancia = obterInstanciaDoToken(dono, servo, modelo);
  const pendencia = instancia.agarrarLinguaPendente;
  const combate = useCombatStore.getState();
  if (instancia.estado !== 'ativa' || !pendencia || !combate.inCombat ||
    pendencia.combateId !== combate.combatId || pendencia.rodada !== combate.round ||
    pendencia.turnoIndex !== combate.currentTurnIndex || !podeComandarInvocacao(donoId, invocacaoId)) {
    return { ok: false, motivo: 'O acerto não tem mais uma janela de Agarrar válida neste turno.' };
  }

  const chave = `${instancia.id}:${pendencia.eventoId}`;
  const eventoTentativa = `gama-agarrar:${pendencia.eventoId}`;
  if (agarrarGamaPendentes.has(chave) || instancia.eventosAcoesProcessados?.includes(eventoTentativa)) {
    return { ok: false, motivo: 'Esta tentativa de Agarrar já foi processada.' };
  }
  const alvoInicial = resolverAlvoAgarrar(donoId, pendencia.alvoId, servo, acao.alcanceM ?? 6);
  if (!alvoInicial.ok) return alvoInicial;

  const bonusLutaGama = calcularBonusPericiaInvocacao(dono, modelo, 'LUTA');
  if (!bonusLutaGama) return { ok: false, motivo: 'Defina o atributo-base de perícias do Gama antes de tentar Agarrar.' };
  const bonusSituacional = opcoes?.contextoAmbiente?.submerso === true || opcoes?.contextoAmbiente?.escuridaoTotal === true
    ? 2
    : 0;
  const bonusGama = bonusLutaGama.total + bonusSituacional;
  const bonusAlvo = alvoInicial.alvo.tipo === 'personagem'
    ? bonusPericiaPersonagem(alvoInicial.alvo.personagem, 'Atletismo')
    : calcularBonusPericiaInvocacao(alvoInicial.alvo.dono, alvoInicial.alvo.modelo, 'ATLETISMO')?.total ?? 0;
  const custos = {
    ...(modelo.custosComandosConfigurados ?? {}),
    [acao.id]: {
      execucao: 'manual' as const,
      debitos: [{ entidade: 'dono' as const, recurso: 'pe' as const, quantidade: acao.efeitoEspecial.custoPE }],
    },
  };
  const modeloComCustoOpcional: InvocacaoControlador = { ...modelo, custosComandosConfigurados: custos };
  const debitoInicial = prepararDebitoComando(dono, modeloComCustoOpcional, instancia, acao, acao.efeitoEspecial.custoPE);
  if (!debitoInicial.ok) return debitoInicial;

  agarrarGamaPendentes.add(chave);
  try {
    const d20Gama = await rollD20Autonomo(bonusGama, { label: 'Luta de Gama: Agarrar' });
    const d20Alvo = await rollD20Autonomo(bonusAlvo, { label: 'Atletismo: resistir a Agarrar' });
    const totalGama = d20Gama + bonusGama;
    const totalAlvo = d20Alvo + bonusAlvo;
    const sucesso = totalGama >= totalAlvo;

    const donoAtual = useCharacterStore.getState().characters.find(character => character.id === donoId);
    const modeloAtual = donoAtual?.invocacoesConhecidas?.find(item => item.id === invocacaoId);
    const servoAtual = useMapStore.getState().entities[servo.id];
    const instanciaAtual = donoAtual?.instanciasInvocacao?.find(item => item.id === instancia.id);
    const combateAtual = useCombatStore.getState();
    if (!donoAtual || !modeloAtual || !servoAtual || !instanciaAtual ||
      instanciaAtual.agarrarLinguaPendente?.eventoId !== pendencia.eventoId ||
      !podeComandarInvocacao(donoId, invocacaoId) || combateAtual.combatId !== pendencia.combateId ||
      combateAtual.round !== pendencia.rodada || combateAtual.currentTurnIndex !== pendencia.turnoIndex) {
      return { ok: false, motivo: 'O turno, Gama ou a janela de Agarrar mudou durante a rolagem. Nenhum PE foi gasto.' };
    }
    const alvoAtual = resolverAlvoAgarrar(donoId, pendencia.alvoId, servoAtual, acao.alcanceM ?? 6);
    if (!alvoAtual.ok) return alvoAtual;
    const custosAtuais = {
      ...(modeloAtual.custosComandosConfigurados ?? {}),
      [acao.id]: {
        execucao: 'manual' as const,
        debitos: [{ entidade: 'dono' as const, recurso: 'pe' as const, quantidade: acao.efeitoEspecial.custoPE }],
      },
    };
    const debito = prepararDebitoComando(donoAtual, { ...modeloAtual, custosComandosConfigurados: custosAtuais }, instanciaAtual, acao, acao.efeitoEspecial.custoPE);
    if (!debito.ok) return debito;

    let aplicouCondicao = false;
    if (sucesso) {
      const alvoAgarrado = alvoAtual.alvo;
      if (alvoAgarrado.tipo === 'personagem') {
        const conditionId = novoIdInvocacao('gama-agarrado');
        const idAplicado = useCharacterStore.getState().addCondition(alvoAgarrado.personagem.id, {
          id: conditionId,
          conditionId: 'agarrado',
          name: 'Agarrado',
          icon: '🤼',
          remainingTurns: -1,
          remainingRounds: -1,
          sourceCharId: donoId,
          sourceCharName: modelo.nome,
          sourceEntityId: modelo.subcategoria,
          sourceInstanceId: instancia.id,
        });
        if (!idAplicado) return { ok: false, motivo: 'Não foi possível registrar Agarrado; nenhum PE foi gasto.' };
        const vitima = useCharacterStore.getState().characters.find(character => character.id === alvoAgarrado.personagem.id);
        const grappledBy = vitima?.grappleState?.grappledBy ?? [];
        useCharacterStore.getState().updateCharacter(alvoAgarrado.personagem.id, {
          grappleState: { ...vitima?.grappleState, grappledBy: Array.from(new Set([...grappledBy, 'invocacao-sapo:' + instancia.id])) },
        });
        aplicouCondicao = true;
      } else {
        const vitima = useCharacterStore.getState().characters.find(character => character.id === alvoAgarrado.dono.id);
        const instanciaVitima = vitima?.instanciasInvocacao?.find(item => item.id === alvoAgarrado.instancia.id);
        if (!vitima || !instanciaVitima) return { ok: false, motivo: 'A invocação-alvo mudou; nenhum PE foi gasto.' };
        gravarInstancia(vitima, InstanciaInvocacaoSchema.parse({
          ...instanciaVitima,
          version: instanciaVitima.version + 1,
          agarradoPorInvocacao: [{ donoId, instanciaId: instancia.id, modeloId: modelo.id, nome: modelo.apelido?.trim() || modelo.nome }],
        }));
        aplicouCondicao = true;
      }
    }

    const fonteFinal = useCharacterStore.getState().characters.find(character => character.id === donoId);
    const modeloFinal = fonteFinal?.invocacoesConhecidas?.find(item => item.id === invocacaoId);
    const instanciaFinal = fonteFinal?.instanciasInvocacao?.find(item => item.id === instancia.id);
    if (!fonteFinal || !modeloFinal || !instanciaFinal || instanciaFinal.agarrarLinguaPendente?.eventoId !== pendencia.eventoId) {
      return { ok: false, motivo: 'O estado mudou antes de registrar o custo da tentativa.' };
    }
    const custosFinais = {
      ...(modeloFinal.custosComandosConfigurados ?? {}),
      [acao.id]: {
        execucao: 'manual' as const,
        debitos: [{ entidade: 'dono' as const, recurso: 'pe' as const, quantidade: acao.efeitoEspecial.custoPE }],
      },
    };
    const debitoFinal = prepararDebitoComando(fonteFinal, { ...modeloFinal, custosComandosConfigurados: custosFinais }, instanciaFinal, acao, acao.efeitoEspecial.custoPE);
    if (!debitoFinal.ok) return debitoFinal;
    gravarInstancia(fonteFinal, InstanciaInvocacaoSchema.parse({
      ...instanciaFinal,
      version: instanciaFinal.version + 1,
      agarrarLinguaPendente: undefined,
      eventosAcoesProcessados: [...(instanciaFinal.eventosAcoesProcessados ?? []), eventoTentativa].slice(-200),
    }), { peCurrent: debitoFinal.peDonoRestante });
    useLogStore.getState().addLog('combat',
      `🐸 Gama tenta Agarrar ${alvoAtual.alvo.nome}: Luta ${d20Gama} + ${bonusGama} = ${totalGama}${bonusSituacional ? ' (+2 Anfíbio Sombrio)' : ''} vs Atletismo ${d20Alvo} + ${bonusAlvo} = ${totalAlvo}; ${acao.efeitoEspecial.custoPE} PE gastos${sucesso ? (aplicouCondicao ? ' — Agarrado.' : ' — condição não aplicada.') : ' — o alvo resistiu.'}`);
    return { ok: true, sucesso, aplicouCondicao, totalGama, totalAlvo, nomeAlvo: alvoAtual.alvo.nome, bonusSituacional };
  } catch {
    return { ok: false, motivo: 'Não foi possível completar a tentativa de Agarrar; nenhum PE foi gasto.' };
  } finally {
    agarrarGamaPendentes.delete(chave);
  }
}

export async function comandarAgarrarOrochi(
  donoId: string,
  invocacaoId: string,
  opcoes?: { instanciaId?: string; requestId?: string; escuridaoTotal?: boolean },
): Promise<{ ok: true; sucesso: boolean; totalOrochi: number; totalAlvo: number; nomeAlvo: string; bonusEscuridao: number } | { ok: false; motivo: string }> {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(character => character.id === invocacaoId && character.donoCharacterId === donoId);
  const acao = modelo?.acoes.find(item => item.efeitoEspecial?.tipo === 'agarrar_orochi_apos_acerto');
  if (!dono || !modelo || modelo.subcategoria !== 'dez-sombras:grande-serpente' ||
    acao?.efeitoEspecial?.tipo !== 'agarrar_orochi_apos_acerto') {
    return { ok: false, motivo: 'Esta opção só existe após um acerto do Bote Sombrio de Orochi.' };
  }
  if (!podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'A tentativa de Agarrar só pode ser resolvida no turno do Controlador.' };

  const mapa = useMapStore.getState();
  const servo = tokensInvocados(donoId).find(token => token.invocationId === invocacaoId &&
    (!opcoes?.instanciaId || token.invocationInstanceId === opcoes.instanciaId) &&
    (token.hp ?? 0) > 0 && !token.hidden &&
    mapa.layerVisible[token.layer ?? 'tokens'] !== false &&
    (!token.invocationState || token.invocationState === 'ativa'));
  if (!servo?.invocationInstanceId) return { ok: false, motivo: 'Orochi precisa continuar ativo e visível no mapa.' };

  const instancia = obterInstanciaDoToken(dono, servo, modelo);
  const pendencia = instancia.agarrarOrochiPendente;
  const combate = useCombatStore.getState();
  if (instancia.estado !== 'ativa' || !pendencia || !combate.inCombat || !combate.combatId ||
    pendencia.combateId !== combate.combatId || pendencia.rodada !== combate.round ||
    pendencia.turnoIndex !== combate.currentTurnIndex || !podeComandarInvocacao(donoId, invocacaoId)) {
    return { ok: false, motivo: 'O acerto não tem mais uma janela de Agarrar válida neste turno.' };
  }

  const eventoTentativa = `orochi-agarrar:${pendencia.eventoId}`;
  const chave = `${instancia.id}:${eventoTentativa}`;
  if (agarrarOrochiPendentes.has(chave) || instancia.eventosAcoesProcessados?.includes(eventoTentativa)) {
    return { ok: false, motivo: 'Esta tentativa de Agarrar já foi processada.' };
  }
  const alvoInicial = resolverAlvoAgarrar(donoId, pendencia.alvoId, servo, acao.alcanceM ?? 1.5);
  if (!alvoInicial.ok) return alvoInicial;
  const bonusLuta = calcularBonusPericiaInvocacao(dono, modelo, 'LUTA');
  if (!bonusLuta) return { ok: false, motivo: 'Defina o atributo-base de perícias de Orochi antes de tentar Agarrar.' };
  const bonusEscuridao = opcoes?.escuridaoTotal === true ? 2 : 0;
  const bonusOrochi = bonusLuta.total + bonusEscuridao;
  const bonusAlvo = alvoInicial.alvo.tipo === 'personagem'
    ? bonusPericiaPersonagem(alvoInicial.alvo.personagem, 'Atletismo')
    : calcularBonusPericiaInvocacao(alvoInicial.alvo.dono, alvoInicial.alvo.modelo, 'ATLETISMO')?.total ?? 0;
  const custoPE = acao.efeitoEspecial.custoPE;
  const custos = {
    ...(modelo.custosComandosConfigurados ?? {}),
    [acao.id]: { execucao: 'manual' as const, debitos: [{ entidade: 'dono' as const, recurso: 'pe' as const, quantidade: custoPE }] },
  };
  const debitoInicial = prepararDebitoComando(dono, { ...modelo, custosComandosConfigurados: custos }, instancia, acao, custoPE);
  if (!debitoInicial.ok) return debitoInicial;

  agarrarOrochiPendentes.add(chave);
  let conditionId: string | undefined;
  let linkAplicado = false;
  let alvoAplicado: AlvoAgarrarInvocacao | null = null;
  try {
    const d20Orochi = await rollD20Autonomo(bonusOrochi, { label: 'Luta de Orochi: Agarrar' });
    const d20Alvo = await rollD20Autonomo(bonusAlvo, { label: 'Atletismo: resistir a Agarrar' });
    const totalOrochi = d20Orochi + bonusOrochi;
    const totalAlvo = d20Alvo + bonusAlvo;
    const sucesso = totalOrochi >= totalAlvo;

    const donoAtual = useCharacterStore.getState().characters.find(character => character.id === donoId);
    const modeloAtual = donoAtual?.invocacoesConhecidas?.find(item => item.id === invocacaoId);
    const servoAtual = useMapStore.getState().entities[servo.id];
    const instanciaAtual = donoAtual?.instanciasInvocacao?.find(item => item.id === instancia.id);
    const combateAtual = useCombatStore.getState();
    if (!donoAtual || !modeloAtual || !servoAtual || !instanciaAtual ||
      instanciaAtual.agarrarOrochiPendente?.eventoId !== pendencia.eventoId ||
      !podeComandarInvocacao(donoId, invocacaoId) || combateAtual.combatId !== pendencia.combateId ||
      combateAtual.round !== pendencia.rodada || combateAtual.currentTurnIndex !== pendencia.turnoIndex) {
      return { ok: false, motivo: 'O turno, Orochi ou a janela de Agarrar mudou durante a rolagem. Nenhum PE foi gasto.' };
    }
    const alvoAtual = resolverAlvoAgarrar(donoId, pendencia.alvoId, servoAtual, acao.alcanceM ?? 1.5);
    if (!alvoAtual.ok) return alvoAtual;
    const alvoAtualResolvido = alvoAtual.alvo;
    const custosAtuais = {
      ...(modeloAtual.custosComandosConfigurados ?? {}),
      [acao.id]: { execucao: 'manual' as const, debitos: [{ entidade: 'dono' as const, recurso: 'pe' as const, quantidade: custoPE }] },
    };
    const debito = prepararDebitoComando(donoAtual, { ...modeloAtual, custosComandosConfigurados: custosAtuais }, instanciaAtual, acao, custoPE);
    if (!debito.ok) return debito;

    if (sucesso) {
      alvoAplicado = alvoAtualResolvido;
      if (alvoAtualResolvido.tipo === 'personagem') {
        conditionId = novoIdInvocacao('orochi-agarrado');
        const idAplicado = useCharacterStore.getState().addCondition(alvoAtualResolvido.personagem.id, {
          id: conditionId,
          conditionId: 'agarrado',
          name: 'Agarrado por Orochi',
          icon: '🐍',
          remainingTurns: -1,
          remainingRounds: -1,
          sourceCharId: donoId,
          sourceCharName: modeloAtual.nome,
          sourceEntityId: modeloAtual.subcategoria,
          sourceInstanceId: instanciaAtual.id,
        });
        if (!idAplicado) return { ok: false, motivo: 'Não foi possível registrar Agarrado; nenhum PE foi gasto.' };
        const vitima = useCharacterStore.getState().characters.find(character => character.id === alvoAtualResolvido.personagem.id);
        const grappledBy = vitima?.grappleState?.grappledBy ?? [];
        useCharacterStore.getState().updateCharacter(alvoAtualResolvido.personagem.id, {
          grappleState: { ...vitima?.grappleState, grappledBy: Array.from(new Set([...grappledBy, `invocacao-grande-serpente:${instanciaAtual.id}`])) },
        });
      } else {
        const vitima = useCharacterStore.getState().characters.find(character => character.id === alvoAtualResolvido.dono.id);
        const instanciaVitima = vitima?.instanciasInvocacao?.find(item => item.id === alvoAtualResolvido.instancia.id);
        if (!vitima || !instanciaVitima) return { ok: false, motivo: 'A invocação-alvo mudou; nenhum PE foi gasto.' };
        const link = { donoId, instanciaId: instanciaAtual.id, modeloId: modeloAtual.id, nome: modeloAtual.apelido?.trim() || modeloAtual.nome };
        gravarInstancia(vitima, InstanciaInvocacaoSchema.parse({
          ...instanciaVitima,
          version: instanciaVitima.version + 1,
          agarradoPorInvocacao: [...(instanciaVitima.agarradoPorInvocacao ?? []), link],
        }));
        linkAplicado = true;
      }
    }

    const fonteFinal = useCharacterStore.getState().characters.find(character => character.id === donoId);
    const modeloFinal = fonteFinal?.invocacoesConhecidas?.find(item => item.id === invocacaoId);
    const instanciaFinal = fonteFinal?.instanciasInvocacao?.find(item => item.id === instancia.id);
    if (!fonteFinal || !modeloFinal || !instanciaFinal || instanciaFinal.agarrarOrochiPendente?.eventoId !== pendencia.eventoId) {
      throw new Error('Estado de Orochi alterado antes de gravar o custo.');
    }
    const custosFinais = {
      ...(modeloFinal.custosComandosConfigurados ?? {}),
      [acao.id]: { execucao: 'manual' as const, debitos: [{ entidade: 'dono' as const, recurso: 'pe' as const, quantidade: custoPE }] },
    };
    const debitoFinal = prepararDebitoComando(fonteFinal, { ...modeloFinal, custosComandosConfigurados: custosFinais }, instanciaFinal, acao, custoPE);
    if (!debitoFinal.ok) throw new Error(debitoFinal.motivo);
    gravarInstancia(fonteFinal, InstanciaInvocacaoSchema.parse({
      ...instanciaFinal,
      version: instanciaFinal.version + 1,
      agarrarOrochiPendente: undefined,
      eventosAcoesProcessados: [...(instanciaFinal.eventosAcoesProcessados ?? []), eventoTentativa].slice(-200),
    }), { peCurrent: debitoFinal.peDonoRestante });
    useLogStore.getState().addLog('combat', `🐍 Orochi tenta Agarrar ${alvoAtualResolvido.nome}: Luta ${d20Orochi} + ${bonusOrochi} = ${totalOrochi}${bonusEscuridao ? ' (+2 Grande Serpente)' : ''} vs Atletismo ${d20Alvo} + ${bonusAlvo} = ${totalAlvo}; ${custoPE} PE gastos${sucesso ? ' — Agarrado; causa 2 de dano de Força no início dos turnos do alvo.' : ' — o alvo resistiu.'}`);
    return { ok: true, sucesso, totalOrochi, totalAlvo, nomeAlvo: alvoAtualResolvido.nome, bonusEscuridao };
  } catch {
    const alvoComFalha = alvoAplicado;
    if (conditionId && alvoComFalha && alvoComFalha.tipo === 'personagem') {
        useCharacterStore.getState().removeCondition(alvoComFalha.personagem.id, conditionId);
        const vitima = useCharacterStore.getState().characters.find(character => character.id === alvoComFalha.personagem.id);
        const grappledBy = (vitima?.grappleState?.grappledBy ?? []).filter(id => id !== `invocacao-grande-serpente:${instancia.id}`);
        useCharacterStore.getState().updateCharacter(alvoComFalha.personagem.id, {
          grappleState: { ...vitima?.grappleState, grappledBy },
        });
    }
    if (linkAplicado && alvoComFalha?.tipo === 'invocacao') {
      const vitima = useCharacterStore.getState().characters.find(character => character.id === alvoComFalha.dono.id);
      const instanciaVitima = vitima?.instanciasInvocacao?.find(item => item.id === alvoComFalha.instancia.id);
      if (vitima && instanciaVitima) gravarInstancia(vitima, InstanciaInvocacaoSchema.parse({
        ...instanciaVitima,
        version: instanciaVitima.version + 1,
        agarradoPorInvocacao: (instanciaVitima.agarradoPorInvocacao ?? []).filter(link => link.instanciaId !== instancia.id || link.donoId !== donoId),
      }));
    }
    return { ok: false, motivo: 'Não foi possível concluir a tentativa; nenhum PE foi gasto.' };
  } finally {
    agarrarOrochiPendentes.delete(chave);
  }
}

const ticksAgarrarOrochiPendentes = new Set<string>();

/** Aplica uma única vez o dano de Força de Orochi ao começo do turno de cada alvo agarrado. */
export async function tickAgarradosOrochiInicioTurno(alvoDonoId: string): Promise<number> {
  const combate = useCombatStore.getState();
  const ator = combate.initiativeOrder[combate.currentTurnIndex]?.charId;
  if (!combate.inCombat || !combate.combatId || ator !== alvoDonoId) return 0;

  let aplicados = 0;
  const characters = [...useCharacterStore.getState().characters];
  const chaveTick = (alvoId: string) => `orochi-forca:${combate.combatId}:${combate.round}:${combate.currentTurnIndex}:${alvoId}`;
  const fonteAtiva = (donoId: string, instanciaId: string) => {
    const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
    const instancia = dono?.instanciasInvocacao?.find(item => item.id === instanciaId);
    const modelo = dono?.invocacoesConhecidas?.find(item => item.id === instancia?.modeloId);
    const token = instancia ? useMapStore.getState().entities[instancia.tokenId] : undefined;
    if (!dono || !instancia || !modelo || modelo.subcategoria !== 'dez-sombras:grande-serpente' ||
      instancia.estado !== 'ativa' || !token || (token.hp ?? 0) <= 0 ||
      (token.invocationState && token.invocationState !== 'ativa')) return null;
    return { dono, instancia, modelo };
  };
  const registrarTick = (fonte: { dono: Character; instancia: InstanciaInvocacao }, eventoId: string) => {
    const atual = useCharacterStore.getState().characters.find(character => character.id === fonte.dono.id);
    const instanciaAtual = atual?.instanciasInvocacao?.find(item => item.id === fonte.instancia.id);
    if (!atual || !instanciaAtual || instanciaAtual.eventosAcoesProcessados?.includes(eventoId)) return false;
    gravarInstancia(atual, InstanciaInvocacaoSchema.parse({
      ...instanciaAtual,
      version: instanciaAtual.version + 1,
      eventosAcoesProcessados: [...(instanciaAtual.eventosAcoesProcessados ?? []), eventoId].slice(-200),
    }));
    return true;
  };

  for (const snapshot of characters) {
    const conditions = (useCharacterStore.getState().characters.find(character => character.id === snapshot.id)?.activeConditions ?? [])
      .filter(condition => condition.conditionId === 'agarrado' && condition.sourceEntityId === 'dez-sombras:grande-serpente');
    for (const condition of conditions) {
      const sourceDonoId = condition.sourceCharId;
      const sourceInstanceId = condition.sourceInstanceId;
      if (!sourceDonoId || !sourceInstanceId) continue;
      const fonte = fonteAtiva(sourceDonoId, sourceInstanceId);
      if (!fonte) {
        releaseGrapples(sourceDonoId, sourceInstanceId, 'dez-sombras:grande-serpente');
        continue;
      }
      const eventoId = chaveTick(`personagem:${snapshot.id}:${condition.id}`);
      const trava = `${sourceInstanceId}:${eventoId}`;
      if (ticksAgarrarOrochiPendentes.has(trava) || fonte.instancia.eventosAcoesProcessados?.includes(eventoId)) continue;
      ticksAgarrarOrochiPendentes.add(trava);
      try {
        if (!registrarTick(fonte, eventoId)) continue;
        await useCharacterStore.getState().applyDamage(snapshot.id, 2, undefined, {
          attackerId: sourceDonoId,
          source: 'omni',
          isMelee: true,
          attack: { critical: false, criticalFail: false, kind: 'melee' },
          tags: ['__orochi_grapple_tick'],
        });
        useLogStore.getState().addLog('combat', `🐍 ${snapshot.name} sofre 2 de dano de Força de Orochi no início do turno enquanto permanece Agarrado.`);
        aplicados++;
      } catch {
        const donoAtual = useCharacterStore.getState().characters.find(character => character.id === fonte.dono.id);
        const instanciaAtual = donoAtual?.instanciasInvocacao?.find(item => item.id === fonte.instancia.id);
        if (donoAtual && instanciaAtual) gravarInstancia(donoAtual, InstanciaInvocacaoSchema.parse({
          ...instanciaAtual,
          version: instanciaAtual.version + 1,
          eventosAcoesProcessados: (instanciaAtual.eventosAcoesProcessados ?? []).filter(id => id !== eventoId),
        }));
      } finally {
        ticksAgarrarOrochiPendentes.delete(trava);
      }
    }
  }

  const donoAlvo = useCharacterStore.getState().characters.find(character => character.id === alvoDonoId);
  for (const instanciaAlvoSnapshot of donoAlvo?.instanciasInvocacao ?? []) {
    if (instanciaAlvoSnapshot.estado !== 'ativa') continue;
    const tokenAlvo = useMapStore.getState().entities[instanciaAlvoSnapshot.tokenId];
    if (!tokenAlvo || (tokenAlvo.hp ?? 0) <= 0) continue;
    for (const link of instanciaAlvoSnapshot.agarradoPorInvocacao ?? []) {
      const donoFonte = useCharacterStore.getState().characters.find(character => character.id === link.donoId);
      const modeloFonte = donoFonte?.invocacoesConhecidas?.find(modelo => modelo.id === link.modeloId);
      if (modeloFonte?.subcategoria !== 'dez-sombras:grande-serpente') continue;
      const fonte = fonteAtiva(link.donoId, link.instanciaId);
      if (!fonte) {
        releaseGrapples(link.donoId, link.instanciaId, 'dez-sombras:grande-serpente');
        continue;
      }
      const eventoId = chaveTick(`invocacao:${instanciaAlvoSnapshot.id}`);
      const trava = `${link.instanciaId}:${eventoId}`;
      if (ticksAgarrarOrochiPendentes.has(trava) || fonte.instancia.eventosAcoesProcessados?.includes(eventoId)) continue;
      ticksAgarrarOrochiPendentes.add(trava);
      try {
        if (!registrarTick(fonte, eventoId)) continue;
        const resultado = causarDanoInvocacao(tokenAlvo.id, 2, undefined, instanciaAlvoSnapshot.id, { eventoId });
        if (!resultado.ok) throw new Error(resultado.motivo);
        useLogStore.getState().addLog('combat', `🐍 ${instanciaAlvoSnapshot.modeloId} sofre 2 de dano de Força de Orochi no início do turno enquanto permanece Agarrado.`);
        aplicados++;
      } catch {
        const donoAtual = useCharacterStore.getState().characters.find(character => character.id === fonte.dono.id);
        const instanciaAtual = donoAtual?.instanciasInvocacao?.find(item => item.id === fonte.instancia.id);
        if (donoAtual && instanciaAtual) gravarInstancia(donoAtual, InstanciaInvocacaoSchema.parse({
          ...instanciaAtual,
          version: instanciaAtual.version + 1,
          eventosAcoesProcessados: (instanciaAtual.eventosAcoesProcessados ?? []).filter(id => id !== eventoId),
        }));
      } finally {
        ticksAgarrarOrochiPendentes.delete(trava);
      }
    }
  }

  return aplicados;
}

export async function comandarSegurarSapo(
  donoId: string,
  invocacaoId: string,
  alvoId: string,
  opcoes?: { instanciaId?: string; requestId?: string; membrosSapoVivos?: number },
): Promise<{ ok: true; sucesso: boolean; aplicouCondicao: boolean; totalSapo: number; totalAlvo: number; nomeAlvo: string } | { ok: false; motivo: string }> {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  if (!dono || !modelo || !isGrappleSource(modelo.subcategoria)) {
    return { ok: false, motivo: 'Segurar só pode ser comandado pelo Sapo ou pelo Abismo.' };
  }
  const ehAbismo = modelo.subcategoria === 'dez-sombras:abismo-desconhecido-do-poco';
  if (ehAbismo && useRoleStore.getState().role !== 'MASTER') {
    return { ok: false, motivo: 'Somente o Mestre pode confirmar a quantidade de sapos vivos do Abismo.' };
  }
  if (ehAbismo && (!Number.isInteger(opcoes?.membrosSapoVivos) ||
    (opcoes?.membrosSapoVivos ?? 0) < 1 || (opcoes?.membrosSapoVivos ?? 0) > 3)) {
    return { ok: false, motivo: 'Informe explicitamente de 1 a 3 sapos vivos; a contagem não pode ser inferida pelos PV.' };
  }
  if (!podeComandarInvocacao(donoId, modelo.id)) {
    return { ok: false, motivo: 'Segurar só pode ser comandado no turno do dono.' };
  }
  const acao = modelo.acoes.find(item => item.id === 'segurar');
  if (!acao) return { ok: false, motivo: 'A ação Segurar não está configurada nesta invocação.' };
  const mapa = useMapStore.getState();
  const servo = tokensInvocados(donoId).find(token => token.invocationId === invocacaoId &&
    (!opcoes?.instanciaId || token.invocationInstanceId === opcoes.instanciaId) &&
    (token.hp ?? 0) > 0 && (!token.invocationState || token.invocationState === 'ativa'));
  if (!servo?.invocationInstanceId) return { ok: false, motivo: 'Invocação ativa não encontrada no mapa.' };
  const instancia = obterInstanciaDoToken(dono, servo, modelo);
  if (instancia.estado !== 'ativa') return { ok: false, motivo: 'Invocação caída ou inativa não pode manter Agarrado.' };

  let tokenAlvo: Entity | undefined;
  let personagemAlvo: Character | undefined;
  let donoInvocacaoAlvo: Character | undefined;
  let modeloInvocacaoAlvo: InvocacaoControlador | undefined;
  let instanciaAlvo: InstanciaInvocacao | undefined;
  if (alvoId.startsWith('invoc:')) {
    tokenAlvo = mapa.entities[alvoId.slice('invoc:'.length)];
    if (!tokenAlvo?.ownerCharId || !tokenAlvo.invocationId || tokenAlvo.hidden ||
      mapa.layerVisible[tokenAlvo.layer ?? 'tokens'] === false || tokenAlvo.id === servo.id || (tokenAlvo.hp ?? 0) <= 0) {
    return { ok: false, motivo: 'Invocação-alvo ativa não encontrada.' };
    }
    donoInvocacaoAlvo = useCharacterStore.getState().characters.find(character => character.id === tokenAlvo!.ownerCharId);
    modeloInvocacaoAlvo = donoInvocacaoAlvo?.invocacoesConhecidas?.find(item => item.id === tokenAlvo!.invocationId);
    if (!donoInvocacaoAlvo || !modeloInvocacaoAlvo) return { ok: false, motivo: 'Ficha da invocação-alvo não encontrada.' };
    instanciaAlvo = obterInstanciaDoToken(donoInvocacaoAlvo, tokenAlvo, modeloInvocacaoAlvo);
    if (instanciaAlvo.estado !== 'ativa' || (tokenAlvo.invocationState && tokenAlvo.invocationState !== 'ativa')) {
      return { ok: false, motivo: 'Invocação caída ou inativa não pode ser agarrada.' };
    }
    if ((instanciaAlvo.agarradoPorInvocacao?.length ?? 0) > 0) return { ok: false, motivo: 'Esta invocação já está agarrada.' };
  } else {
    personagemAlvo = useCharacterStore.getState().characters.find(character => character.id === alvoId);
    if (!personagemAlvo || personagemAlvo.id === donoId || (personagemAlvo.hpCurrent ?? 1) <= 0) {
      return { ok: false, motivo: 'Personagem-alvo ativo não encontrado.' };
    }
    tokenAlvo = resolverTokenDaFicha(personagemAlvo, mapa.entities, mapa.layerVisible);
    if (!tokenAlvo) return { ok: false, motivo: 'O alvo precisa estar visível no mapa.' };
    if ((personagemAlvo.activeConditions ?? []).some(condition => condition.conditionId === 'agarrado')) {
      return { ok: false, motivo: 'Este personagem já está Agarrado.' };
    }
  }

  const escala = mapa.gridConfig.metersPerCell / mapa.gridConfig.dpi;
  if (!(escala > 0)) return { ok: false, motivo: 'Grade do mapa inválida.' };
  const distancia = Math.hypot(
    (servo.x + servo.w / 2) - (tokenAlvo.x + tokenAlvo.w / 2),
    (servo.y + servo.h / 2) - (tokenAlvo.y + tokenAlvo.h / 2),
  ) * escala;
  if (distancia > (acao.alcanceM ?? 9) + 1e-6) return { ok: false, motivo: 'O alvo está além do alcance de Segurar desta invocação.' };

  const bonusSapo = ehAbismo ? 5 + 2 * (opcoes!.membrosSapoVivos! - 1) : 5;
  const bonusAlvo = personagemAlvo
    ? bonusPericiaPersonagem(personagemAlvo, 'Atletismo')
    : calcularBonusPericiaInvocacao(donoInvocacaoAlvo!, modeloInvocacaoAlvo!, 'ATLETISMO')?.total ?? 0;
  const debito = prepararDebitoComando(dono, modelo, instancia, acao, undefined, 'manual');
  if (!debito.ok) return debito;
  const categoria = categoriaEconomiaDaAcao(acao, instancia.economiaAcoes);
  if (!categoria) return { ok: false, motivo: 'Categoria da ação Segurar não configurada.' };
  const gasto = gastarAcaoDaInstancia(instancia, categoria, 1, opcoes?.requestId ?? novoIdInvocacao('segurar'));
  if (!gasto.ok) return gasto;
  const instanciaGasta = registrarRecargaDaAcao({
    ...gasto.instancia,
    recursosAtuais: debito.recursosRestantes,
  }, acao);
  gravarInstancia(dono, instanciaGasta, { peCurrent: debito.peDonoRestante });

  const d20Sapo = await rollD20Autonomo(bonusSapo, { label: 'Luta de ' + modelo.nome + ': Segurar' });
  const d20Alvo = await rollD20Autonomo(bonusAlvo, { label: 'Atletismo: resistir a Segurar' });
  const totalSapo = d20Sapo + bonusSapo;
  const totalAlvo = d20Alvo + bonusAlvo;
  const sucesso = totalSapo >= totalAlvo;
  let aplicouCondicao = false;
  if (sucesso) {
    const conditionId = novoIdInvocacao('sapo-agarrado');
    if (personagemAlvo) {
      const idAplicado = useCharacterStore.getState().addCondition(personagemAlvo.id, {
        id: conditionId,
        conditionId: 'agarrado',
        name: 'Agarrado',
        icon: '🤼',
        remainingTurns: -1,
        remainingRounds: -1,
        sourceCharId: donoId,
        sourceCharName: modelo.nome,
        sourceEntityId: modelo.subcategoria,
        sourceInstanceId: instancia.id,
      });
      aplicouCondicao = Boolean(idAplicado);
      if (aplicouCondicao) {
        const grapplerId = 'invocacao-sapo:' + instancia.id;
        const atual = useCharacterStore.getState().characters.find(character => character.id === personagemAlvo!.id);
        const grappledBy = atual?.grappleState?.grappledBy ?? [];
        useCharacterStore.getState().updateCharacter(personagemAlvo.id, {
          grappleState: { ...atual?.grappleState, grappledBy: Array.from(new Set([...grappledBy, grapplerId])) },
        });
      }
    } else if (donoInvocacaoAlvo && modeloInvocacaoAlvo && instanciaAlvo) {
      const atualizada = InstanciaInvocacaoSchema.parse({
        ...instanciaAlvo,
        version: instanciaAlvo.version + 1,
        agarradoPorInvocacao: [{
          donoId,
          instanciaId: instancia.id,
          modeloId: modelo.id,
          nome: modelo.nome,
        }],
      });
      gravarInstancia(donoInvocacaoAlvo, atualizada);
      aplicouCondicao = true;
    }
  }
  useLogStore.getState().addLog('combat',
    modelo.nome + ' usa Segurar contra ' + (personagemAlvo?.name ?? modeloInvocacaoAlvo?.apelido ?? modeloInvocacaoAlvo?.nome) +
    ': Luta ' + d20Sapo + ' + ' + bonusSapo + ' = ' + totalSapo + ' vs Atletismo ' +
    d20Alvo + ' + ' + bonusAlvo + ' = ' + totalAlvo + (sucesso ? (aplicouCondicao ? ' — Agarrado.' : ' — condição bloqueada.') : ' — falhou.'));
  return { ok: true, sucesso, aplicouCondicao, totalSapo, totalAlvo, nomeAlvo: personagemAlvo?.name ?? modeloInvocacaoAlvo?.apelido ?? modeloInvocacaoAlvo?.nome ?? 'alvo' };
}

export type PericiaFugaAgarrado = 'Atletismo' | 'Acrobacia';
/** @deprecated Compatibilidade com telas e integrações anteriores ao Orochi. */
export type PericiaFugaSapo = PericiaFugaAgarrado;
type ResultadoFugaAgarrado =
  | { ok: true; escapou: boolean; totalAlvo: number; totalFonte: number; /** @deprecated Compatibilidade com a fuga do Sapo. */ totalSapo: number; pericia: PericiaFugaAgarrado }
  | { ok: false; motivo: string };

/** Resolve fuga de uma criatura agarrada por uma invocação com regra de oposição definida. */
async function rolarFugaAgarrado(
  donoAlvo: Character,
  modeloAlvo?: InvocacaoControlador,
  pericia: PericiaFugaAgarrado = 'Atletismo',
  donoFonteId?: string,
  modeloFonte?: InvocacaoControlador,
  instanciaFonteId?: string,
): Promise<ResultadoFugaAgarrado> {
  const donoFonte = useCharacterStore.getState().characters.find(character => character.id === donoFonteId);
  const instanciaFonte = donoFonte?.instanciasInvocacao?.find(instancia => instancia.id === instanciaFonteId);
  const tokenFonteAtivo = Boolean(donoFonte && modeloFonte && instanciaFonteId &&
    Object.values(useMapStore.getState().entities).some(token =>
      token.ownerCharId === donoFonteId && token.invocationId === modeloFonte.id &&
      token.invocationInstanceId === instanciaFonteId && (token.hp ?? 0) > 0 && !token.hidden &&
      useMapStore.getState().layerVisible[token.layer ?? 'tokens'] !== false &&
      (!token.invocationState || token.invocationState === 'ativa'),
    ));
  if (!donoFonte || !modeloFonte || !isGrappleSource(modeloFonte.subcategoria) ||
    modeloFonte.subcategoria === 'dez-sombras:abismo-desconhecido-do-poco' ||
    !instanciaFonte || instanciaFonte.estado !== 'ativa' || !tokenFonteAtivo) {
    return { ok: false, motivo: 'A invocação que mantém o agarrão não está ativa ou ainda não tem regra de fuga automatizada.' };
  }
  if (!turnoAtualDoPersonagem(donoAlvo.id)) return { ok: false, motivo: 'A fuga só pode ser tentada no início do turno do alvo.' };
  const bonusAlvo = modeloAlvo
    ? calcularBonusPericiaInvocacao(donoAlvo, modeloAlvo, pericia.toUpperCase())?.total ?? 0
    : bonusPericiaPersonagem(donoAlvo, pericia);
  const periciaFonte = modeloFonte.subcategoria === 'dez-sombras:sapo' ? 'ATLETISMO' : 'LUTA';
  const bonusFonte = calcularBonusPericiaInvocacao(donoFonte, modeloFonte, periciaFonte)?.total ?? 0;
  const nomeFonte = modeloFonte.apelido?.trim() || modeloFonte.nome;
  const d20Alvo = await rollD20Autonomo(bonusAlvo, { label: pericia + ': escapar de ' + nomeFonte });
  const d20Fonte = await rollD20Autonomo(bonusFonte, { label: periciaFonte + ' de ' + nomeFonte + ': manter Agarrado' });
  const totalAlvo = d20Alvo + bonusAlvo;
  const totalFonte = d20Fonte + bonusFonte;
  return { ok: true, escapou: totalAlvo > totalFonte, totalAlvo, totalFonte, totalSapo: totalFonte, pericia };
}

export async function escaparAgarradoPorInvocacao(
  donoAlvoId: string,
  conditionId: string,
  pericia: PericiaFugaAgarrado,
): Promise<ResultadoFugaAgarrado> {
  const alvo = useCharacterStore.getState().characters.find(character => character.id === donoAlvoId);
  const condicao = alvo?.activeConditions?.find(condition => condition.id === conditionId &&
    condition.conditionId === 'agarrado' && isGrappleSource(condition.sourceEntityId));
  if (!alvo || !condicao?.sourceCharId || !condicao.sourceInstanceId) {
    return { ok: false, motivo: 'Agarrão de invocação não encontrado nesta ficha.' };
  }
  if (condicao.sourceEntityId === 'dez-sombras:abismo-desconhecido-do-poco') {
    return { ok: false, motivo: 'A regra de fuga do Abismo ainda não está definida; resolva manualmente.' };
  }
  const donoFonte = useCharacterStore.getState().characters.find(character => character.id === condicao.sourceCharId);
  const modeloFonte = donoFonte?.invocacoesConhecidas?.find(modelo => modelo.id ===
    donoFonte.instanciasInvocacao?.find(instancia => instancia.id === condicao.sourceInstanceId)?.modeloId);
  if (!donoFonte || !modeloFonte || !isGrappleSource(modeloFonte.subcategoria) || modeloFonte.subcategoria !== condicao.sourceEntityId) {
    return { ok: false, motivo: 'A invocação que mantém o agarrão não foi encontrada.' };
  }
  const subcategoriaFonte = modeloFonte.subcategoria;
  const resultado = await rolarFugaAgarrado(alvo, undefined, pericia, donoFonte.id, modeloFonte, condicao.sourceInstanceId);
  if (resultado.ok && resultado.escapou) {
    const alvoAtual = useCharacterStore.getState().characters.find(character => character.id === donoAlvoId);
    if (alvoAtual?.activeConditions?.some(condition => condition.id === conditionId)) {
      useCharacterStore.getState().removeCondition(donoAlvoId, conditionId);
      const slugFonte = subcategoriaFonte.slice('dez-sombras:'.length);
      const grappledBy = (alvoAtual.grappleState?.grappledBy ?? []).filter(id => id !== `invocacao-${slugFonte}:${condicao.sourceInstanceId}`);
      useCharacterStore.getState().updateCharacter(donoAlvoId, {
        grappleState: { ...alvoAtual.grappleState, grappledBy },
      });
    }
  }
  if (resultado.ok) useLogStore.getState().addLog('combat',
    alvo.name + ' tenta escapar de ' + modeloFonte.nome + ' com ' + pericia + ': ' + resultado.totalAlvo +
    ' vs ' + (modeloFonte.subcategoria === 'dez-sombras:sapo' ? 'Atletismo' : 'Luta') + ' ' + resultado.totalFonte +
    (resultado.escapou ? ' — escapou.' : ' — permanece Agarrado.'));
  return resultado;
}

export async function escaparInvocacaoAgarrada(
  donoAlvoId: string,
  instanciaAlvoId: string,
  pericia: PericiaFugaAgarrado,
): Promise<ResultadoFugaAgarrado> {
  const donoAlvo = useCharacterStore.getState().characters.find(character => character.id === donoAlvoId);
  const instanciaAlvo = donoAlvo?.instanciasInvocacao?.find(instancia => instancia.id === instanciaAlvoId);
  const modeloAlvo = donoAlvo?.invocacoesConhecidas?.find(modelo => modelo.id === instanciaAlvo?.modeloId);
  const vinculo = instanciaAlvo?.agarradoPorInvocacao?.[0];
  const donoSapo = vinculo && useCharacterStore.getState().characters.find(character => character.id === vinculo.donoId);
  const modeloSapo = donoSapo?.invocacoesConhecidas?.find(modelo => modelo.id === vinculo?.modeloId);
  if (!donoAlvo || !instanciaAlvo || !modeloAlvo || !vinculo) {
    return { ok: false, motivo: 'Agarrão do Sapo não encontrado nesta instância.' };
  }
  if (!donoSapo || !modeloSapo) return { ok: false, motivo: 'A fonte do agarrão não foi encontrada.' };
  if (modeloSapo.subcategoria === 'dez-sombras:abismo-desconhecido-do-poco') {
    return { ok: false, motivo: 'A regra de fuga do Abismo ainda não está definida; resolva manualmente.' };
  }
  if (!isGrappleSource(modeloSapo.subcategoria)) return { ok: false, motivo: 'A fonte do agarrão não tem regra de fuga automatizada.' };
  const resultado = await rolarFugaAgarrado(donoAlvo, modeloAlvo, pericia, donoSapo.id, modeloSapo, vinculo.instanciaId);
  if (resultado.ok && resultado.escapou && donoAlvo && instanciaAlvo) {
    const donoAtual = useCharacterStore.getState().characters.find(character => character.id === donoAlvoId);
    const instanciaAtual = donoAtual?.instanciasInvocacao?.find(instancia => instancia.id === instanciaAlvoId);
    if (!donoAtual || !instanciaAtual?.agarradoPorInvocacao?.some(link =>
      link.donoId === vinculo.donoId && link.instanciaId === vinculo.instanciaId)) return resultado;
    const atualizada = InstanciaInvocacaoSchema.parse({
      ...instanciaAtual,
      version: instanciaAtual.version + 1,
      agarradoPorInvocacao: (instanciaAtual.agarradoPorInvocacao ?? []).filter(link =>
        link.donoId !== vinculo.donoId || link.instanciaId !== vinculo.instanciaId),
    });
    gravarInstancia(donoAtual, atualizada);
  }
  if (resultado.ok) useLogStore.getState().addLog('combat',
    modeloAlvo.nome + ' tenta escapar de ' + modeloSapo.nome + ' com ' + pericia + ': ' + resultado.totalAlvo +
    ' vs ' + (modeloSapo.subcategoria === 'dez-sombras:sapo' ? 'Atletismo' : 'Luta') + ' ' + resultado.totalFonte +
    (resultado.escapou ? ' — escapou.' : ' — permanece Agarrado.'));
  return resultado;
}

/** Caminho interno usado pelo despachante de autonomia após validar gatilho e alvo. */
export async function executarAtaqueAutonomoInvocacao(
  donoId: string,
  invocacaoId: string,
  acaoId: string,
  alvoId: string | string[],
  opcoes: OpcoesComandoInvocacao,
): Promise<ResultadoAtaqueUnicoInvocacao | ResultadoAtaqueMultiploInvocacao | { ok: false; motivo: string }> {
  const dono = useCharacterStore.getState().characters.find(item => item.id === donoId);
  if (!consumirAceiteAutonomia(opcoes.aceiteAutonomia, {
    requestId: opcoes.requestId ?? '', profileId: dono?.profileId ?? '', donoId,
    instanciaId: opcoes.instanciaId ?? '', modeloId: invocacaoId, acaoId,
    alvos: Array.isArray(alvoId) ? alvoId : [alvoId],
  })) return { ok: false, motivo: 'A ação autônoma exige confirmação afirmativa do jogador Controlador.' };
  return executarAtaqueInvocacao(donoId, invocacaoId, acaoId, alvoId, opcoes, 'evento_automatico');
}

/** Executa uma ação reativa já aceita pelo controlador; a economia é da instância. */
export async function executarReacaoInvocacao(
  donoId: string,
  invocacaoId: string,
  acaoId: string,
  alvoId: string,
  opcoes: OpcoesComandoInvocacao,
  gatilho: import('@/lib/omni/tipos').GatilhoReacaoAtiva,
): Promise<ResultadoAtaqueUnicoInvocacao | { ok: false; motivo: string }> {
  const resultado = await executarAtaqueInvocacao(donoId, invocacaoId, acaoId, alvoId, opcoes, 'reacao', gatilho);
  if (!resultado.ok) return resultado;
  if ('resultados' in resultado) return { ok: false, motivo: 'Uma reação da invocação só pode resolver um alvo.' };
  return resultado;
}

type PlanoMovimentoInvestidaTouro =
  | { ok: true; destino: { x: number; y: number }; distanciaRetaM: number; custoMovimentoM: number }
  | { ok: false; motivo: string };

function planejarMovimentoInvestidaTouro(
  token: Entity,
  alvo: Entity,
  mapa: ReturnType<typeof useMapStore.getState>,
  limiteM: number,
  alcanceM: number,
): PlanoMovimentoInvestidaTouro {
  const grid = mapa.gridConfig;
  if (!(grid.dpi > 0) || !(grid.metersPerCell > 0) || !(limiteM > 0)) {
    return { ok: false, motivo: 'Deslocamento ou grade inválidos para a Investida.' };
  }
  const metrosPorPixel = grid.metersPerCell / grid.dpi;
  const dx = alvo.x - token.x;
  const dy = alvo.y - token.y;
  const distanciaPx = Math.hypot(dx, dy);
  if (distanciaPx < 0.5) return { ok: false, motivo: 'A Investida precisa de uma direção livre até o alvo.' };
  const ux = dx / distanciaPx;
  const uy = dy / distanciaPx;
  const extraX = Math.max(0, (token.w - grid.dpi) / 2) + Math.max(0, (alvo.w - grid.dpi) / 2);
  const extraY = Math.max(0, (token.h - grid.dpi) / 2) + Math.max(0, (alvo.h - grid.dpi) / 2);
  const alcancePx = alcanceM / metrosPorPixel;
  const movimentoParaAlcance = (offset: number, extra: number, unidade: number) => {
    const restante = Math.abs(offset) - extra - alcancePx;
    if (restante <= 0) return 0;
    return unidade > 1e-9 ? restante / unidade : Number.POSITIVE_INFINITY;
  };
  const distanciaParaContatoPx = Math.max(
    movimentoParaAlcance(dx, extraX, Math.abs(ux)),
    movimentoParaAlcance(dy, extraY, Math.abs(uy)),
  );
  if (!Number.isFinite(distanciaParaContatoPx)) {
    return { ok: false, motivo: 'A trajetória reta da Investida não alcança o alvo.' };
  }
  const segmentos = WallsEngine.blockingSegments(mapa.walls, 'sight');
  const fog = useFogStore.getState();
  for (const segment of buildFogSegments(fog.walls, fog.doors)) segmentos.push([segment.a, segment.b]);
  const entidadesFixas = Object.values(mapa.entities).filter(entity =>
    entity.id !== token.id && entity.id !== alvo.id && entity.layer !== 'map' && !entity.hidden && !entity.carriedBy,
  );
  for (const entity of entidadesFixas) {
    segmentos.push(...tokenFootprintSegments({ origin: { x: entity.x, y: entity.y }, entity }, 0, 0));
  }
  const cache = prepareCollisionCache(segmentos);
  const movingToken: MapCollisionToken = { origin: { x: token.x, y: token.y }, entity: token };
  const terrenos = Object.values(mapa.entities).filter(entity => !!entity.difficultTerrain).map(entity => ({
    x: entity.x, y: entity.y, w: entity.w, h: entity.h, rotation: entity.rotation,
    shape: entity.shape, difficultTerrain: entity.difficultTerrain, difficultTerrainKind: entity.difficultTerrainKind,
  }));
  const avaliar = (pedidoPx: number) => {
    const deslocamento = resolveCollisionMove([movingToken], cache, { dx: 0, dy: 0 }, {
      dx: ux * pedidoPx, dy: uy * pedidoPx,
    });
    const erroLateral = Math.abs(deslocamento.dx * uy - deslocamento.dy * ux);
    const destino = { x: token.x + deslocamento.dx, y: token.y + deslocamento.dy };
    const distanciaRetaM = Math.hypot(deslocamento.dx, deslocamento.dy) * metrosPorPixel;
    const custoMovimentoM = movementCostForTerrainSegment(
      { x: token.x, y: token.y }, destino, metrosPorPixel, terrenos, false,
    );
    return { deslocamento, destino, distanciaRetaM, custoMovimentoM, erroLateral };
  };
  const limitePx = Math.min(limiteM / metrosPorPixel, distanciaParaContatoPx);
  let plano = avaliar(limitePx);
  if (plano.custoMovimentoM > limiteM + 0.05) {
    let inferior = 0;
    let superior = limitePx;
    for (let tentativa = 0; tentativa < 18; tentativa++) {
      const meio = (inferior + superior) / 2;
      const candidato = avaliar(meio);
      if (candidato.custoMovimentoM <= limiteM + 0.001) inferior = meio;
      else superior = meio;
    }
    plano = avaliar(inferior);
  }
  if (plano.erroLateral > 0.5) {
    return { ok: false, motivo: 'A trajetória reta da Investida foi desviada por um obstáculo.' };
  }
  if (plano.custoMovimentoM > limiteM + 0.05) {
    return { ok: false, motivo: 'O terreno excede o deslocamento disponível para a Investida.' };
  }
  return {
    ok: true,
    destino: plano.destino,
    distanciaRetaM: plano.distanciaRetaM,
    custoMovimentoM: plano.custoMovimentoM,
  };
}

async function executarAtaqueInvocacao(
  donoId: string,
  invocacaoId: string,
  acaoId: string,
  alvoId: string | string[] | SelecaoAlvoAreaInvocacao,
  opcoes: OpcoesComandoInvocacao | undefined,
  modoExecucao: ModoExecucaoComandoInvocacao,
  gatilhoReacao?: import('@/lib/omni/tipos').GatilhoReacaoAtiva,
): Promise<ResultadoAtaqueUnicoInvocacao | ResultadoAtaqueMultiploInvocacao | { ok: false; motivo: string }> {
  let dono = useCharacterStore.getState().characters.find(c => c.id === donoId);
  if (!dono) return { ok: false, motivo: 'Personagem inválido.' };
  if ((modoExecucao === 'tigre_reacao' || modoExecucao === 'reacao') && jogadorBloqueadoPorControleMestre(donoId, invocacaoId)) {
    return { ok: false, motivo: 'Esta sombra está sob controle do Mestre.' };
  }
  if (modoExecucao !== 'reacao' && modoExecucao !== 'tigre_reacao' && !podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };
  let inv = dono.invocacoesConhecidas?.find(i => i.id === invocacaoId && i.donoCharacterId === donoId);
  let acaoOriginal = inv?.acoes.find(a => a.id === acaoId);
  if (!inv || !acaoOriginal) return { ok: false, motivo: 'Ação ou invocação não encontrada.' };
  if (acaoOriginal.statusAutomacao === 'manual') return { ok: false, motivo: 'Esta a\u00e7\u00e3o exige resolu\u00e7\u00e3o manual conforme a lacuna descrita na ficha.' };
  if (modoExecucao === 'reacao' && (acaoOriginal.categoriaAcao !== 'reacao' || (acaoOriginal.tipoExecucao !== 'omni' && acaoOriginal.tipoExecucao !== 'referencia_omni'))) {
    return { ok: false, motivo: 'A ação vinculada não está configurada como reação OMNI.' };
  }
  let resolucaoOmni = acaoOriginal.tipoExecucao === 'omni' || acaoOriginal.tipoExecucao === 'referencia_omni'
    ? resolverAcaoOmniInvocacao(acaoOriginal, useOmniEntidadesStore.getState().entidades, { permitirReacao: modoExecucao === 'reacao' })
    : undefined;
  if (resolucaoOmni && !resolucaoOmni.ok) return { ok: false, motivo: resolucaoOmni.motivo };
  if (modoExecucao === 'reacao' && (!resolucaoOmni?.ok || resolucaoOmni.config.acao !== 'reacao' || !resolucaoOmni.config.reacao)) {
    return { ok: false, motivo: 'A ação deixou de ser uma reação OMNI válida.' };
  }
  if (modoExecucao === 'reacao' && (!gatilhoReacao || !resolucaoOmni?.ok || resolucaoOmni.config.reacao?.gatilho !== gatilhoReacao)) {
    return { ok: false, motivo: 'O gatilho da reação mudou enquanto a oferta estava aberta.' };
  }
  if (modoExecucao === 'reacao' && !opcoes?.validarReacao?.()) {
    return { ok: false, motivo: 'A reação perdeu sua condição antes da execução.' };
  }
  let acao = resolucaoOmni?.ok ? resolucaoOmni.acao : acaoOriginal;
  const selecaoArea = !Array.isArray(alvoId) && typeof alvoId === 'object' && alvoId.tipo === 'area';
  let configAreaInicial = configuracaoAreaInvocacao(acaoOriginal, resolucaoOmni?.ok ? resolucaoOmni.config : undefined);
  const areaConfigurada = Boolean(configAreaInicial);
  if (selecaoArea && !areaConfigurada) return { ok: false, motivo: 'Esta ação não está configurada para selecionar uma área.' };
  if (!selecaoArea && areaConfigurada) return { ok: false, motivo: 'Esta ação precisa selecionar uma área no mapa.' };
  const erroAcao = validarAcaoAtaqueInvocacao(acao);
  if (erroAcao) return { ok: false, motivo: erroAcao };
  let tipoTeste = acao.teste ?? (acao.tipo === 'ataque' ? 'ataque' : undefined);
  let mapa = useMapStore.getState();
  let servo = tokensInvocados(donoId).find(e => e.invocationId === invocacaoId && (!opcoes?.instanciaId || e.invocationInstanceId === opcoes.instanciaId) && (e.hp ?? 0) > 0);
  if (!servo || (selecaoArea && (servo.hidden || mapa.layerVisible[servo.layer ?? 'tokens'] === false))) {
    return { ok: false, motivo: 'Servo ou alvo ausente do mapa.' };
  }
  const servoIdOriginal = servo.id;
  if (modoExecucao === 'reacao' && (servo.hidden || mapa.layerVisible[servo.layer ?? 'tokens'] === false)) {
    return { ok: false, motivo: 'A invocação reativa está oculta ou fora de uma camada visível.' };
  }
  let idsAlvo: string[];
  let resultadoEmLista = Array.isArray(alvoId) || selecaoArea;
  if (selecaoArea && configAreaInicial) {
    const areaPosicionada = await montarTemplateAreaInvocacao(configAreaInicial, servo, dono, acao.nome);
    if (!areaPosicionada.ok) return areaPosicionada;

    // Releia a mesa depois da colocação: alvo, posição, filtros e custo podem
    // ter mudado enquanto o jogador escolhia o ponto no mapa.
    dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
    if (!dono || !podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'O turno do Controlador terminou durante a seleção da área.' };
    inv = dono.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
    acaoOriginal = inv?.acoes.find(item => item.id === acaoId);
    if (!inv || !acaoOriginal) return { ok: false, motivo: 'Ação ou invocação removida durante a seleção da área.' };
    resolucaoOmni = acaoOriginal.tipoExecucao === 'omni' || acaoOriginal.tipoExecucao === 'referencia_omni'
      ? resolverAcaoOmniInvocacao(acaoOriginal, useOmniEntidadesStore.getState().entidades)
      : undefined;
    if (resolucaoOmni && !resolucaoOmni.ok) return { ok: false, motivo: resolucaoOmni.motivo };
    acao = resolucaoOmni?.ok ? resolucaoOmni.acao : acaoOriginal;
    const configAreaAtual = configuracaoAreaInvocacao(acaoOriginal, resolucaoOmni?.ok ? resolucaoOmni.config : undefined);
    if (acao.statusAutomacao === 'manual' || !configAreaAtual ||
      JSON.stringify(configAreaInicial) !== JSON.stringify(configAreaAtual)) {
      return { ok: false, motivo: 'A configuração da área mudou durante a seleção. Tente a ação novamente.' };
    }
    configAreaInicial = configAreaAtual;
    tipoTeste = acao.teste ?? (acao.tipo === 'ataque' ? 'ataque' : undefined);
    const erroAcaoAtual = validarAcaoAtaqueInvocacao(acao);
    if (erroAcaoAtual) return { ok: false, motivo: erroAcaoAtual };
    mapa = useMapStore.getState();
    const servoId = servo.id;
    servo = mapa.entities[servoId];
    if (!servo || servo.ownerCharId !== donoId || servo.invocationId !== invocacaoId ||
      (opcoes?.instanciaId && servo.invocationInstanceId !== opcoes.instanciaId) ||
      (servo.hp ?? 0) <= 0 || servo.hidden || mapa.layerVisible[servo.layer ?? 'tokens'] === false) {
      return { ok: false, motivo: 'A invocação saiu do mapa durante a seleção da área.' };
    }
    const forma = configAreaAtual.area?.forma;
    if ((forma === 'cone' || forma === 'linha' || forma === 'raio_em_si') &&
      (Math.hypot(areaPosicionada.template.x - (servo.x + servo.w / 2), areaPosicionada.template.y - (servo.y + servo.h / 2)) > 1e-6)) {
      return { ok: false, motivo: 'A invocação mudou de posição durante a seleção da área. Tente novamente.' };
    }
    const areaAtual = configAreaAtual.area!;
    const pixelsPorMetro = (mapa.gridConfig.dpi || 70) / (mapa.gridConfig.metersPerCell || 1.5);
    if (!Number.isFinite(pixelsPorMetro) || pixelsPorMetro <= 0) return { ok: false, motivo: 'Grade inválida para resolver a área.' };
    const comprimentoArea = areaAtual.tamanho_m * pixelsPorMetro;
    const templateAtual: MapTemplate = {
      ...areaPosicionada.template,
      length: comprimentoArea,
      width: areaAtual.forma === 'linha' ? (areaAtual.largura_m ?? 1.5) * pixelsPorMetro : comprimentoArea,
    };
    const alvosArea = resolverAlvosDaAreaInvocacao(configAreaAtual, dono, servo, templateAtual);
    if (!alvosArea.ok) return alvosArea;
    idsAlvo = alvosArea.ids;
  } else {
    const idsSelecionados = typeof alvoId === 'string' ? [alvoId] : Array.isArray(alvoId) ? alvoId : [];
    idsAlvo = [...new Set(idsSelecionados.map(id => id.trim()).filter(Boolean))];
  }
  if (!idsAlvo.length) return { ok: false, motivo: 'Escolha pelo menos um alvo.' };
  const aceitaMultiplos = resolucaoOmni?.ok && resolucaoOmni.config.tipo_alvo === 'multiplo';
  if (!selecaoArea && !aceitaMultiplos && idsAlvo.length !== 1) return { ok: false, motivo: 'Esta ação aceita apenas um alvo.' };
  const maxAlvos = aceitaMultiplos && resolucaoOmni?.ok ? Number(resolucaoOmni.config.max_alvos) : 1;
  if (!selecaoArea && idsAlvo.length > maxAlvos) return { ok: false, motivo: `Selecione no máximo ${maxAlvos} alvo(s).` };
  const modelo = obterModeloDoToken(dono, servo);
  if (!modelo) return { ok: false, motivo: 'Modelo da invocação não encontrado.' };
  const instancia = obterInstanciaDoToken(dono, servo, modelo);
  const combatePredador = useCombatStore.getState();
  const rodadaAtual = combatePredador.round ?? 1;
  const ehTigreFunebre = modelo.subcategoria === TIGRE_FUNEBRE_SUBCATEGORIA;
  const estadoTigreAntesDoRetalhar = ehTigreFunebre
    ? normalizarEstadoTigreFunebre(instancia.estadoTigreFunebre, combatePredador.inCombat ? combatePredador.combatId ?? undefined : undefined)
    : undefined;
  const predadorRetalhar = ehTigreFunebre && acaoId === 'retalhar' && modoExecucao === 'manual'
    ? registrarRetalharPredadorApiceTigre(estadoTigreAntesDoRetalhar!, rodadaAtual, combatePredador.combatId ?? undefined)
    : undefined;
  const ataquePredadorGratuito = Boolean(predadorRetalhar?.ativo && predadorRetalhar.ataqueGratuito);
  const estadoTigreAposDebito = predadorRetalhar?.ativo ? predadorRetalhar.estado : estadoTigreAntesDoRetalhar;
  const predadorApiceParaDano = ehTigreFunebre && acaoId === 'retalhar' &&
    predadorApiceTigreAtivo(estadoTigreAntesDoRetalhar, rodadaAtual, combatePredador.combatId ?? undefined);
  const efeitosDeAtaque = (instancia.efeitosSuporteAtivos ?? []).filter(efeito =>
    efeito.expiraNaRodada >= rodadaAtual && (efeito.tipo === 'acerto' || efeito.tipo === 'dano_adicional'),
  );
  const bonusAcertoAuxilio = efeitosDeAtaque
    .filter(efeito => efeito.tipo === 'acerto')
    .reduce((total, efeito) => total + efeito.valor, 0);
  const efeitosDanoAdicional = efeitosDeAtaque.filter(efeito => efeito.tipo === 'dano_adicional');
  const formulasDanoAdicional = efeitosDanoAdicional.map(efeito => ({
    efeito,
    formula: parseFormulaDanoInvocacao(efeito.formula ?? ''),
  }));
  if (formulasDanoAdicional.some(item => !item.formula)) {
    return { ok: false, motivo: 'Uma fórmula de dano adicional ativa está inválida.' };
  }
  const chave = instancia.id + ':' + acaoId;
  if (ataquesPendentes.has(chave)) return { ok: false, motivo: 'Comando anterior ainda em andamento.' };
  if (!podeUsarAcaoDaInstancia(instancia, acaoId)) return { ok: false, motivo: 'A ação ainda está em recarga.' };
  const debito = prepararDebitoComando(dono, modelo, instancia, acao, undefined, modoExecucao);
  if (!debito.ok) return debito;
  const categoriaBase = categoriaEconomiaDaAcao(acao, instancia.economiaAcoes);
  const categoria = modoExecucao === 'tigre_reacao' ? 'reacao' : categoriaBase;
  if (!categoria) return { ok: false, motivo: 'Categoria de ação própria não configurada.' };
  const idsInvocacoesAlvo = idsAlvo.filter(id => id.startsWith('invoc:'));
  const idsPersonagensAlvo = idsAlvo.filter(id => !id.startsWith('invoc:'));
  const alvos = idsPersonagensAlvo.map(id => {
    const personagem = useCharacterStore.getState().characters.find(c => c.id === id);
    const token = personagem ? resolverTokenDaFicha(personagem, mapa.entities, mapa.layerVisible) : undefined;
    return personagem && token ? { personagem, token } : null;
  });
  if (alvos.some(alvo => !alvo) || (!selecaoArea && idsPersonagensAlvo.includes(donoId))) return { ok: false, motivo: 'Servo ou alvo ausente do mapa.' };
  const personagens = useCharacterStore.getState().characters;
  const alvosInvocacaoBrutos = idsInvocacoesAlvo.map(id => {
    const token = mapa.entities[id.slice('invoc:'.length)];
    if (!token?.ownerCharId || !token.invocationId || token.hidden ||
      mapa.layerVisible[token.layer ?? 'tokens'] === false || (!selecaoArea && token.id === servoIdOriginal)) return null;
    const donoAlvo = personagens.find(character => character.id === token.ownerCharId);
    const modeloAlvo = donoAlvo?.invocacoesConhecidas?.find(item => item.id === token.invocationId);
    if (!donoAlvo || !modeloAlvo) return null;
    const instanciaAlvo = obterInstanciaDoToken(donoAlvo, token, modeloAlvo);
    if (instanciaAlvo.estado === 'derrotada' || instanciaAlvo.estado === 'dissipada') return null;
    const defesaBase = Number.isFinite(token.invocationDefense)
      ? token.invocationDefense!
      : modeloAlvo.defesa;
    const ajusteCaido = tipoTeste === 'ataque' && instanciaTemCondicao(instanciaAlvo, 'caido')
      ? (acao.tipoAtaque === 'distancia' ? 3 : -3)
      : 0;
    const penalidadeGarras = penalidadeGarrasTigre(personagens, `invoc:${instanciaAlvo.id}`, useCombatStore.getState().combatId ?? undefined);
    const defesa = Math.max(0, defesaBase + ajusteCaido - ((instanciaAlvo.agarradoPorInvocacao?.length ?? 0) > 0 ? 3 : 0) - penalidadeGarras);
    if (!Number.isFinite(defesa) || defesa < 0) return null;
    const bonusResistenciaBase = tipoTeste === 'resistencia'
      ? calcularBonusResistenciaInvocacao(donoAlvo, modeloAlvo, acao.resistenciaAlvo!)
      : undefined;
    const combateBonusAdaptacao = useCombatStore.getState();
    const bonusAdaptacaoCondicao = tipoTeste === 'resistencia' && modeloAlvo.subcategoria === 'dez-sombras:mahoraga' && acao.condicaoAlvoId
      ? bonusTRCondicaoMahoraga(
        normalizarEstadoMahoraga(
          instanciaAlvo.estadoMahoraga,
          combateBonusAdaptacao.inCombat ? combateBonusAdaptacao.combatId ?? undefined : undefined,
        ),
        acao.condicaoAlvoId,
      )
      : 0;
    const agarrado = (instanciaAlvo.agarradoPorInvocacao?.length ?? 0) > 0;
    const penalidadeReflexos = agarrado && acao.resistenciaAlvo?.trim().toLocaleLowerCase('pt-BR') === 'reflexos' ? 3 : 0;
    const bonusResistenciaComAdaptacao = bonusResistenciaBase && bonusAdaptacaoCondicao > 0
      ? {
        ...bonusResistenciaBase,
        total: bonusResistenciaBase.total + bonusAdaptacaoCondicao,
        breakdown: `${bonusResistenciaBase.breakdown} · Mahoraga +${bonusAdaptacaoCondicao} contra ${acao.condicaoAlvoId}`,
      }
      : bonusResistenciaBase;
    const bonusResistencia = bonusResistenciaComAdaptacao && penalidadeReflexos > 0
      ? {
        ...bonusResistenciaComAdaptacao,
        total: bonusResistenciaComAdaptacao.total - penalidadeReflexos,
        breakdown: bonusResistenciaComAdaptacao.breakdown + ' · Agarrado -' + penalidadeReflexos + ' Reflexos',
      }
      : bonusResistenciaComAdaptacao;
    if (tipoTeste === 'resistencia' && !bonusResistencia) return null;
    return {
      alvoId: `invoc:${token.id}`,
      dono: donoAlvo,
      modelo: modeloAlvo,
      instancia: instanciaAlvo,
      token,
      nome: modeloAlvo.apelido?.trim() || modeloAlvo.nome,
      defesa,
      bonusResistencia,
    };
  });
  if (alvosInvocacaoBrutos.some(alvo => !alvo)) {
    return {
      ok: false,
      motivo: tipoTeste === 'resistencia'
        ? 'Uma invocação-alvo não tem dados válidos para resolver esse Teste de Resistência. Nada foi executado.'
        : 'Uma invocação-alvo não tem ficha, Defesa ou estado válido. Nada foi executado.',
    };
  }
  const alvosInvocacaoValidados = alvosInvocacaoBrutos.filter(
    (alvo): alvo is NonNullable<typeof alvo> => alvo !== null,
  );
  const ehInvestidaTouro = modelo.subcategoria === 'dez-sombras:touro-perfurante' && acaoId === 'investida-perfurante';
  let distanciaTotalInvestidaTouroM = 0;
  let criticoAutomaticoInvestidaTouro = false;
  let movimentoExtraPorCurvaTouro = false;
  let movimentoIntegradoTouro: {
    origem: { x: number; y: number };
    destino: { x: number; y: number };
    alvoTokenId: string;
    alvoPosicao: { x: number; y: number };
  } | undefined;
  const combateInvestidaTouro = useCombatStore.getState();
  const inerciaTouroAtiva = ehInvestidaTouro && inerciaImparavelTouroAtiva(instancia.inerciaImparavelTouro, combateInvestidaTouro);
  if (ehInvestidaTouro) {
    if (tipoTeste !== 'ataque' || selecaoArea || idsAlvo.length !== 1 || alvos.filter(Boolean).length + alvosInvocacaoValidados.length !== 1) {
      return { ok: false, motivo: 'A Investida Perfurante exige um único alvo válido e não pode ser usada em área.' };
    }
    const alvoToken = alvos.find((alvo): alvo is NonNullable<typeof alvo> => Boolean(alvo))?.token ?? alvosInvocacaoValidados[0]?.token;
    if (!alvoToken) return { ok: false, motivo: 'O alvo da Investida saiu do mapa.' };
    const movimentoAnterior = instancia.investidaPerfuranteTurno;
    const movimentoAnteriorValido = Boolean(movimentoAnterior && movimentoAnterior.combateId === combateInvestidaTouro.combatId &&
      movimentoAnterior.rodada === (combateInvestidaTouro.round ?? 1) &&
      movimentoAnterior.turnoIndex === combateInvestidaTouro.currentTurnIndex);
    const distanciaAnteriorM = movimentoAnteriorValido ? movimentoAnterior?.distanciaM ?? 0 : 0;
    const deslocamentoMaximoM = inerciaTouroAtiva ? 30 : deslocamentoInvocacaoM(servo.id);
    if (!(deslocamentoMaximoM >= 3) || distanciaAnteriorM > deslocamentoMaximoM + 0.05) {
      return { ok: false, motivo: 'O Touro não tem deslocamento suficiente para iniciar a Investida.' };
    }
    const alcanceInvestidaM = acao.alcanceM ?? 1.5;
    const jaAlcancou = touchDistanceMeters(servo, alvoToken, mapa.gridConfig) <= alcanceInvestidaM + 0.05;
    if (jaAlcancou && distanciaAnteriorM >= 3) {
      distanciaTotalInvestidaTouroM = distanciaAnteriorM;
    } else {
      const deslocamentoRestanteM = Math.max(0, deslocamentoMaximoM - distanciaAnteriorM);
      const plano = planejarMovimentoInvestidaTouro(servo, alvoToken, mapa, deslocamentoRestanteM, alcanceInvestidaM);
      if (!plano.ok) return plano;
      const distanciaNovaM = plano.distanciaRetaM;
      const dx = alvoToken.x - servo.x;
      const dy = alvoToken.y - servo.y;
      const comprimentoDirecao = Math.hypot(dx, dy);
      const direcaoNova = comprimentoDirecao > 0.5 ? { x: dx / comprimentoDirecao, y: dy / comprimentoDirecao } : undefined;
      if (distanciaAnteriorM > 0.05) {
        const direcaoAnterior = movimentoAnterior?.direcao;
        if (!direcaoNova || !direcaoAnterior) {
          movimentoExtraPorCurvaTouro = true;
        } else {
          const cosseno = Math.max(-1, Math.min(1, direcaoAnterior.x * direcaoNova.x + direcaoAnterior.y * direcaoNova.y));
          movimentoExtraPorCurvaTouro = Math.acos(cosseno) > Math.PI / 4 + 1e-6;
        }
      }
      distanciaTotalInvestidaTouroM = distanciaAnteriorM + distanciaNovaM;
      const destinoVirtual = { ...servo, x: plano.destino.x, y: plano.destino.y };
      if (touchDistanceMeters(destinoVirtual, alvoToken, mapa.gridConfig) > alcanceInvestidaM + 0.05) {
        return { ok: false, motivo: 'O alvo está além do deslocamento reto disponível ou a trajetória está bloqueada.' };
      }
      if (distanciaNovaM > 0.05) {
        movimentoIntegradoTouro = {
          origem: { x: servo.x, y: servo.y },
          destino: plano.destino,
          alvoTokenId: alvoToken.id,
          alvoPosicao: { x: alvoToken.x, y: alvoToken.y },
        };
        servo = destinoVirtual;
      }
    }
    if (distanciaTotalInvestidaTouroM + 0.05 < 3) {
      return { ok: false, motivo: 'A Investida exige pelo menos 3 m de trajetória reta nesta rodada.' };
    }
    criticoAutomaticoInvestidaTouro = distanciaTotalInvestidaTouroM + 0.05 >= deslocamentoMaximoM;
  }
  const escala = mapa.gridConfig.metersPerCell / mapa.gridConfig.dpi;
  if (!(escala > 0)) return { ok: false, motivo: 'Grade inválida.' };
  const alvosValidados = alvos.filter((alvo): alvo is NonNullable<typeof alvo> => alvo !== null).map(alvo => {
    const distancia = ehInvestidaTouro
      ? touchDistanceMeters(servo, alvo.token, mapa.gridConfig)
      : Math.hypot((servo.x + servo.w / 2) - (alvo.token.x + alvo.token.w / 2),
        (servo.y + servo.h / 2) - (alvo.token.y + alvo.token.h / 2)) * escala;
    const defesaBase = computeTotalDefense(alvo.personagem, {}, tipoTeste === 'ataque' && acao.tipoAtaque === 'distancia' ? 'ranged' : 'melee');
    const penalidadeGarras = penalidadeGarrasTigre(personagens, alvo.personagem.id, useCombatStore.getState().combatId ?? undefined);
    return { ...alvo, distancia, defesa: Math.max(0, defesaBase - penalidadeGarras) };
  });
  const alvosInvocacaoComDistancia = alvosInvocacaoValidados.map(alvo => ({
    ...alvo,
    distancia: ehInvestidaTouro
      ? touchDistanceMeters(servo, alvo.token, mapa.gridConfig)
      : Math.hypot((servo.x + servo.w / 2) - (alvo.token.x + alvo.token.w / 2),
        (servo.y + servo.h / 2) - (alvo.token.y + alvo.token.h / 2)) * escala,
  }));
  const toleranciaAlcanceAtaque = ehInvestidaTouro ? 0.05 : 1e-6;
  if (alvosValidados.length + alvosInvocacaoValidados.length !== idsAlvo.length) return { ok: false, motivo: 'Alvo inválido.' };
  if (!selecaoArea && alvosValidados.some(alvo => alvo.distancia > (acao.alcanceM ?? 1.5) + toleranciaAlcanceAtaque)) return { ok: false, motivo: 'Um ou mais alvos estão fora do alcance.' };
  if (!selecaoArea && alvosInvocacaoComDistancia.some(alvo => alvo.distancia > (acao.alcanceM ?? 1.5) + toleranciaAlcanceAtaque)) return { ok: false, motivo: 'Uma ou mais invocações estão fora do alcance.' };
  if (resolucaoOmni?.ok && alvosValidados.some(alvo => selecaoArea
    ? !filtroAceitaPersonagemNaArea(dono, alvo.personagem, resolucaoOmni.config)
    : !aceitaAlvoAtivo(dono, alvo.personagem, resolucaoOmni.config))) {
    return { ok: false, motivo: 'Um ou mais alvos não atendem ao filtro OMNI.' };
  }
  if (resolucaoOmni?.ok && alvosInvocacaoValidados.some(alvo => selecaoArea
    ? !filtroAceitaPersonagemNaArea(dono, alvo.dono, resolucaoOmni.config)
    : !aceitaAlvoAtivo(dono, alvo.dono, resolucaoOmni.config))) {
    return { ok: false, motivo: 'Uma invocação atingida não atende ao filtro OMNI.' };
  }
  const escalaHorda = calcularEscalaHorda(integracaoInvocacoes.escalaHorda ? instancia.composicaoHorda?.membros ?? [] : []);
  const estadoTurnoAtaque = useCombatStore.getState();
  const rodadaAtaque = estadoTurnoAtaque.round ?? 1;
  const atacanteMahoraga = modelo.subcategoria === 'dez-sombras:mahoraga';
  let estadoMahoragaAtaque = atacanteMahoraga
    ? normalizarEstadoMahoraga(instancia.estadoMahoraga, estadoTurnoAtaque.inCombat ? estadoTurnoAtaque.combatId ?? undefined : undefined)
    : undefined;
  const tipoDanoAdaptativoMahoraga = estadoMahoragaAtaque?.ataqueAdaptativoTipo;
  const gravarEstadoAtaqueMahoraga = () => {
    if (!estadoMahoragaAtaque) return;
    const donoAtual = useCharacterStore.getState().characters.find(character => character.id === donoId);
    const instanciaAtual = donoAtual?.instanciasInvocacao?.find(item => item.id === instancia.id);
    if (!donoAtual || !instanciaAtual || instanciaAtual.estado === 'derrotada' || instanciaAtual.estado === 'dissipada') return;
    gravarInstancia(donoAtual, InstanciaInvocacaoSchema.parse({
      ...instanciaAtual,
      version: instanciaAtual.version + 1,
      estadoMahoraga: estadoMahoragaAtaque,
    }));
  };
  const bonusDadosInvestida = ehInvestidaTouro
    ? dadosAdicionaisInvestidaPerfurante(distanciaTotalInvestidaTouroM)
    : 0;
  const formulaDanoAlvoUnico = acao.formulaDanoAlvoUnico;
  if (selecaoArea && idsAlvo.length === 1 && typeof formulaDanoAlvoUnico === 'string' && formulaDanoAlvoUnico.trim()) {
    acao = { ...acao, dano: formulaDanoAlvoUnico.trim() };
  }
  let formulaBase = acao.dano ? parseFormulaDanoInvocacao(acao.dano) : null;
  const ehPunhoMahoraga = modelo.subcategoria === 'dez-sombras:mahoraga' && acao.id === 'punho-do-exterminio';
  const dadosReduzidosPunho = opcoes?.dadosReduzidos ?? 0;
  if (!Number.isInteger(dadosReduzidosPunho) || dadosReduzidosPunho < 0 || (dadosReduzidosPunho > 0 && !ehPunhoMahoraga)) {
    return { ok: false, motivo: 'A redução de dados só pode ser usada no Punho do Extermínio de Mahoraga.' };
  }
  if (ehPunhoMahoraga && dadosReduzidosPunho > 0) {
    if (!formulaBase) return { ok: false, motivo: 'A fórmula do Punho do Extermínio está inválida.' };
    const totalDados = formulaBase.dados.reduce((total, grupo) => total + grupo.count, 0);
    if (dadosReduzidosPunho > totalDados) return { ok: false, motivo: `O Punho tem ${totalDados} dados disponíveis para reduzir.` };
    let restantes = dadosReduzidosPunho;
    const grupos = formulaBase.dados.map(grupo => ({ ...grupo })).sort((a, b) => b.sides - a.sides);
    for (const grupo of grupos) {
      const remover = Math.min(restantes, grupo.count);
      grupo.count -= remover;
      restantes -= remover;
      if (!restantes) break;
    }
    const dados = grupos.filter(grupo => grupo.count > 0);
    formulaBase = { ...formulaBase, dados };
    acao = { ...acao, dano: dados.length ? `${formatDamage(dados)}${formulaBase.fixo ? `+${formulaBase.fixo}` : ''}` : '0' };
  }
  if (formulaBase && bonusDadosInvestida > 0) {
    const dados = [...formulaBase.dados, { count: bonusDadosInvestida, sides: 8 }];
    acao = {
      ...acao,
      dano: `${formatDamage(dados)}${formulaBase.fixo ? `+${formulaBase.fixo}` : ''}`,
    };
    formulaBase = { ...formulaBase, dados };
  }
  if (formulaBase && inerciaTouroAtiva) {
    const dados = stepDamage(formulaBase.dados, 2);
    acao = { ...acao, dano: `${formatDamage(dados)}${formulaBase.fixo ? `+${formulaBase.fixo}` : ''}` };
    formulaBase = { ...formulaBase, dados };
  }
  const formula = formulaBase && escalaHorda.niveisAtaqueCura > 0
    ? { ...formulaBase, dados: stepDamage(formulaBase.dados, escalaHorda.niveisAtaqueCura) }
    : formulaBase;
  if (formula && escalaHorda.niveisAtaqueCura > 0) {
    acao = { ...acao, dano: `${formatDamage(formula.dados)}${formula.fixo ? `+${formula.fixo}` : ''}` };
    metricas.escalas.ataque++;
  }
  if (tipoTeste === 'ataque' && !formula && !(ehPunhoMahoraga && formulaBase?.dados.length === 0)) return { ok: false, motivo: 'Dano inválido; use dados como 2d12+1d6+3.' };
  if (tipoTeste === 'resistencia' && acao.dano && !formula) return { ok: false, motivo: 'Dano inválido; use dados como 2d12+1d6+3.' };
  const bonusAtaqueBase = tipoTeste === 'ataque' ? calcularBonusAtaqueInvocacao(dono, modelo, acao) : null;
  const ataquesAnteriores = instancia.usosAtaqueTurno?.rodada === rodadaAtaque ? instancia.usosAtaqueTurno.total : 0;
  const prejuizoAtaque = integracaoInvocacoes.escalaHorda && instancia.composicaoHorda
    ? 3 * calcularPrejuizoRepeticaoHorda(ataquesAnteriores, instancia.composicaoHorda.membros) : 0;
  const penalidadeCaido = tipoTeste === 'ataque' && acao.tipoAtaque !== 'distancia' && instanciaTemCondicao(instancia, 'caido') ? 3 : 0;
  const bonusAtaque = bonusAtaqueBase
    ? { ...bonusAtaqueBase, total: bonusAtaqueBase.total + bonusAcertoAuxilio - prejuizoAtaque - penalidadeCaido }
    : null;
  if (tipoTeste === 'ataque' && (!bonusAtaque || !Number.isFinite(bonusAtaque.total))) {
    return { ok: false, motivo: 'Defina um atributo de ataque válido na ficha da invocação.' };
  }
  if (acao.margemCritico !== undefined && (!Number.isInteger(acao.margemCritico) || acao.margemCritico < 2 || acao.margemCritico > 20)) {
    return { ok: false, motivo: 'Margem de crítico precisa estar entre 2 e 20.' };
  }
  const cd = tipoTeste === 'resistencia' ? calcularCDInvocacao(dono, modelo, acao.atributoCD) : null;
  if (tipoTeste === 'resistencia' && cd === null) return { ok: false, motivo: 'Defina o atributo usado para calcular a CD da ação.' };
  if (movimentoIntegradoTouro) {
    const mapaAtual = useMapStore.getState();
    const tokenAtual = mapaAtual.entities[servo.id];
    const alvoAtual = mapaAtual.entities[movimentoIntegradoTouro.alvoTokenId];
    if (!tokenAtual || tokenAtual.x !== movimentoIntegradoTouro.origem.x || tokenAtual.y !== movimentoIntegradoTouro.origem.y ||
      !alvoAtual || alvoAtual.x !== movimentoIntegradoTouro.alvoPosicao.x || alvoAtual.y !== movimentoIntegradoTouro.alvoPosicao.y) {
      return { ok: false, motivo: 'A posição do Touro ou do alvo mudou antes da confirmação; nada foi gasto.' };
    }
  }
  if (movimentoExtraPorCurvaTouro && (instancia.economiaAcoes?.acaoMovimento?.atual ?? 0) < 1) {
    return {
      ok: false,
      motivo: 'A mudança de direção acima de 45° exige uma Ação de Movimento adicional; o comando foi recusado sem debitar ações.',
    };
  }
  const requestIdAtaque = opcoes?.requestId ?? novoIdInvocacao('ataque-invocacao');
  if (ataquePredadorGratuito && instancia.eventosAcoesProcessados?.includes(requestIdAtaque)) {
    return { ok: false, motivo: 'Este Retalhar gratuito de Predador Ápice já foi processado.' };
  }
  let gasto = ataquePredadorGratuito
    ? {
        ok: true as const,
        instancia: InstanciaInvocacaoSchema.parse({
          ...instancia,
          version: instancia.version + 1,
          eventosAcoesProcessados: [...(instancia.eventosAcoesProcessados ?? []), requestIdAtaque].slice(-200),
        }),
      }
    : gastarAcaoDaInstancia(instancia, categoria, 1, requestIdAtaque);
  if (!gasto.ok) return gasto;
  if (movimentoExtraPorCurvaTouro) {
    const gastoMovimento = gastarAcaoDaInstancia(gasto.instancia, 'acaoMovimento', 1, `${requestIdAtaque}:curva-touro`);
    if (!gastoMovimento.ok) {
      return {
        ok: false,
        motivo: 'A mudança de direção acima de 45° exige uma Ação de Movimento adicional; o comando foi recusado sem debitar ações.',
      };
    }
    gasto = gastoMovimento;
  }
  const comRecursosDebitados = { ...gasto.instancia, recursosAtuais: debito.recursosRestantes,
    ...(tipoTeste === 'ataque' ? { usosAtaqueTurno: { rodada: rodadaAtaque, total: ataquesAnteriores + 1 } } : {}),
    ...(acao.efeitoEspecial?.tipo === 'agarrar_gama_apos_acerto' ? { agarrarLinguaPendente: undefined } : {}),
    ...(acao.efeitoEspecial?.tipo === 'agarrar_orochi_apos_acerto' ? { agarrarOrochiPendente: undefined } : {}),
    ...(modelo.subcategoria === 'dez-sombras:touro-perfurante' && acaoId === 'investida-perfurante'
      ? { investidaPerfuranteTurno: undefined }
      : {}),
    ...(estadoTigreAposDebito ? { estadoTigreFunebre: estadoTigreAposDebito } : {}),
  };
  const comRecarga = registrarRecargaDaAcao(comRecursosDebitados, acao);
  const instanciaComRecarga = InstanciaInvocacaoSchema.parse(comRecarga);
  gravarInstancia(dono, instanciaComRecarga, { peCurrent: debito.peDonoRestante });
  if (movimentoIntegradoTouro) {
    const mapaAtual = useMapStore.getState();
    mapaAtual.pushHistory();
    mapaAtual.updateEntity(servo.id, { x: movimentoIntegradoTouro.destino.x, y: movimentoIntegradoTouro.destino.y });
    broadcastEntityPatches([{ id: servo.id, patch: { x: movimentoIntegradoTouro.destino.x, y: movimentoIntegradoTouro.destino.y } }]);
  }
  ataquesPendentes.add(chave);
  const consumirAuxiliosDeAtaque = () => {
    if (!efeitosDeAtaque.length) return;
    const ids = new Set(efeitosDeAtaque.map(efeito => efeito.id));
    const atual = useCharacterStore.getState().characters.find(character => character.id === donoId);
    const instanciaAtual = atual?.instanciasInvocacao?.find(item => item.id === instancia.id);
    if (!atual || !instanciaAtual) return;
    const restantes = (instanciaAtual.efeitosSuporteAtivos ?? []).filter(efeito => !ids.has(efeito.id));
    atualizarEfeitosSuporteInvocacao(atual, modelo, servo.id, instanciaAtual, restantes);
  };
  try {
    if (tipoTeste === 'resistencia') {
      const resultados: ResultadoAlvoAtaqueInvocacao[] = alvosValidados.map(({ personagem: alvo }) => {
        const requestId = useTestRequestStore.getState().enqueue({
          charId: alvo.id,
          charName: alvo.name,
          targetProfileId: alvo.profileId,
          kind: 'save',
          testName: acao.resistenciaAlvo!,
          dc: cd!,
          note: `${modelo.nome} — ${acao.nome}`,
          originId: donoId,
          sourceTag: `shikigami:${instancia.id}:${acao.id}:${opcoes?.requestId ?? novoIdInvocacao('tr')}:${alvo.id}`,
          ...(formula ? {
            invocationResolution: {
              kind: 'shikigami_damage_after_save' as const,
              ownerCharacterId: donoId,
              invocationId: modelo.id,
              invocationInstanceId: instancia.id,
              actionId: acao.id,
              sourceName: `${modelo.nome} — ${acao.nome}`,
              damageFormula: acao.dano!,
              damageBonus: calcularBonusDanoInvocacao(modelo, acao, 'resistencia'),
              damageType: acao.tipoDano,
              damageOnSuccess: acao.danoNoSucesso ?? 'nenhum',
            },
          } : {}),
        });
        useLogStore.getState().addLog('combat', `🛡️ ${modelo.nome} — ${acao.nome} exige TR ${acao.resistenciaAlvo} contra CD ${cd} de ${alvo.name}.`);
        return { alvoId: alvo.id, nomeAlvo: alvo.name, acertou: false, totalAtaque: 0, dano: 0, testePendente: true, requestId, cd: cd! };
      });
      for (const alvo of alvosInvocacaoValidados) {
        const requestId = useTestRequestStore.getState().enqueue({
          charId: alvo.dono.id,
          charName: alvo.nome,
          targetProfileId: alvo.dono.profileId,
          kind: 'save',
          testName: acao.resistenciaAlvo!,
          dc: cd!,
          note: `${alvo.nome} (Invocação) — ${modelo.nome}: ${acao.nome}`,
          bonusOverride: alvo.bonusResistencia!.total,
          bonusBreakdownOverride: alvo.bonusResistencia!.breakdown,
          ...(acao.condicaoAlvoId ? { conditionIds: [acao.condicaoAlvoId] } : {}),
          originId: donoId,
          sourceTag: `shikigami:${instancia.id}:${acao.id}:${opcoes?.requestId ?? novoIdInvocacao('tr')}:${alvo.instancia.id}`,
          ...(formula ? {
            invocationResolution: {
              kind: 'shikigami_damage_after_save' as const,
              ownerCharacterId: donoId,
              invocationId: modelo.id,
              invocationInstanceId: instancia.id,
              actionId: acao.id,
              sourceName: `${modelo.nome} — ${acao.nome}`,
              damageFormula: acao.dano!,
              damageBonus: calcularBonusDanoInvocacao(modelo, acao, 'resistencia'),
              damageType: acao.tipoDano,
              damageOnSuccess: acao.danoNoSucesso ?? 'nenhum',
              targetInvocation: {
                tokenId: alvo.token.id,
                ownerCharacterId: alvo.dono.id,
                invocationId: alvo.modelo.id,
                invocationInstanceId: alvo.instancia.id,
                name: alvo.nome,
                tipoAlvo: selecaoArea ? 'area' : 'unico',
              },
            },
          } : {}),
        });
        useLogStore.getState().addLog(
          'combat',
          `🛡️ ${modelo.nome} — ${acao.nome} exige TR ${acao.resistenciaAlvo} contra CD ${cd} de ${alvo.nome}.`,
        );
        resultados.push({
          alvoId: alvo.alvoId,
          nomeAlvo: alvo.nome,
          acertou: false,
          totalAtaque: 0,
          dano: 0,
          testePendente: true,
          requestId,
          cd: cd!,
        });
      }
      return resultadoEmLista
        ? { ok: true, resultados }
        : {
          ok: true,
          acertou: resultados[0].acertou,
          totalAtaque: resultados[0].totalAtaque,
          dano: resultados[0].dano,
          ...(resultados[0].testePendente ? { testePendente: true, requestId: resultados[0].requestId, cd: resultados[0].cd } : {}),
        };
    }
    const resultados: ResultadoAlvoAtaqueInvocacao[] = [];
    const alvosParaAtaque = [
      ...alvosValidados.map(alvo => ({
        tipo: 'personagem' as const,
        alvoId: alvo.personagem.id,
        nome: alvo.personagem.name,
        defesa: alvo.defesa,
        personagem: alvo.personagem,
      token: alvo.token,
      })),
      ...alvosInvocacaoValidados.map(alvo => ({
        tipo: 'invocacao' as const,
        alvoId: alvo.alvoId,
        nome: alvo.nome,
        defesa: alvo.defesa,
        modelo: alvo.modelo,
        token: alvo.token,
        instanciaId: alvo.instancia.id,
      })),
    ];
    for (const alvo of alvosParaAtaque) {
      const { defesa } = alvo;
      const alvoAdaptacaoId = alvo.tipo === 'invocacao' ? `invocacao:${alvo.instanciaId}` : alvo.personagem.id;
      const idsLegadosAlvoAdaptacao = alvo.tipo === 'invocacao' ? [alvo.token.id] : [];
      const ignoranciaAdaptativa = estadoMahoragaAtaque
        ? obterIgnoranciaAdaptativaMahoraga(estadoMahoragaAtaque, alvoAdaptacaoId, idsLegadosAlvoAdaptacao)
        : { giros: 0, rdIgnore: 0, ignoraResistencias: false, ignoraImunidades: false };
      const flanqueadoPorMatilha = alvoFlanqueadoPelaMatilha(
        modelo, servo, alvo.token, useCharacterStore.getState().characters,
        useMapStore.getState().entities, useMapStore.getState().layerVisible, useMapStore.getState().gridConfig,
      );
      // Alcateia é uma habilidade manual que requer decisão explícita do Mestre
      // Nenhum bônus de Alcateia é aplicado automaticamente aqui
      const bonusAtaqueAlvo = bonusAtaque!.total;
      const atacanteAgarrado = (instancia.agarradoPorInvocacao?.length ?? 0) > 0;
      const indiceAlvoNaIniciativa = useCombatStore.getState().initiativeOrder.findIndex(entry =>
        entry.charId === (alvo.tipo === 'personagem' ? alvo.personagem.id : alvo.token.ownerCharId));
      const vantagemEmergir = modelo.subcategoria === 'dez-sombras:grande-serpente' &&
        instancia.combateId === estadoTurnoAtaque.combatId &&
        instancia.rodadaCriacao === rodadaAtaque && instancia.turnoCriacao === estadoTurnoAtaque.currentTurnIndex &&
        indiceAlvoNaIniciativa > estadoTurnoAtaque.currentTurnIndex;
      const vantagemEfetiva = vantagemEmergir && !atacanteAgarrado;
      const desvantagemEfetiva = atacanteAgarrado && !vantagemEmergir;
      const d20Inicial = await rollD20Autonomo(bonusAtaqueAlvo, { label: 'Ataque de ' + modelo.nome + ': ' + acao.nome });
      const d20Alternativo = vantagemEfetiva || desvantagemEfetiva
        ? await rollD20Autonomo(bonusAtaqueAlvo, { label: vantagemEfetiva ? 'Vantagem de Emergir das Sombras' : 'Desvantagem por Agarrado: ' + modelo.nome })
        : undefined;
      const natural = d20Alternativo === undefined
        ? d20Inicial
        : vantagemEfetiva ? Math.max(d20Inicial, d20Alternativo) : Math.min(d20Inicial, d20Alternativo);
      const resultadoBase = resolverAcertoInvocacao(natural, bonusAtaqueAlvo, defesa, acao.margemCritico ?? 20);
      const resultado = criticoAutomaticoInvestidaTouro && resultadoBase.acertou && !resultadoBase.falhaCritica
        ? { ...resultadoBase, critico: true }
        : resultadoBase;
      if (estadoMahoragaAtaque) {
        estadoMahoragaAtaque = registrarAtaqueContraAlvoMahoraga(estadoMahoragaAtaque, {
          id: alvoAdaptacaoId,
          nome: alvo.nome,
          defesa,
          idsLegados: idsLegadosAlvoAdaptacao,
        }).estado;
        if (tipoDanoAdaptativoMahoraga) estadoMahoragaAtaque = { ...estadoMahoragaAtaque, ataqueAdaptativoTipo: undefined };
        gravarEstadoAtaqueMahoraga();
      }
      if (!resultado.acertou) {
        useLogStore.getState().addLog('combat', `🎯 ${modelo.nome} — ${acao.nome} contra ${alvo.nome}: d20 ${natural} + ${bonusAtaqueAlvo} = ${resultado.total} vs Defesa ${defesa} (${resultado.falhaCritica ? 'falha crítica' : 'erro'}).`);
        if (alvo.tipo === 'invocacao' && alvo.modelo.subcategoria === TIGRE_FUNEBRE_SUBCATEGORIA &&
          acao.tipoAtaque !== 'distancia') {
          await oferecerReflexosFelinosTigre(alvo.token.id, { tipo: 'invocacao', tokenId: servo.id }, `${requestIdAtaque}:${alvo.alvoId}`);
        }
        resultados.push({ alvoId: alvo.alvoId, nomeAlvo: alvo.nome, acertou: false, totalAtaque: resultado.total, dano: 0, ...(vantagemEfetiva ? { vantagemEmergir: true } : {}) });
        continue;
      }
      const dadosDano = resultado.critico
        ? multiplicarDadosCriticos(formula!.dados, acao.multiplicadorCritico ?? 2)
        : formula!.dados;
      const rolagem = dadosDano.length
        ? await rollDiceGroups(dadosDano, { label: `Dano de ${modelo.nome}: ${acao.nome}` })
        : { total: 0 };
      let bonusDanoAuxilio = 0;
      const detalhesDanoAuxilio: string[] = [];
      for (const { efeito, formula: formulaAuxilio } of formulasDanoAdicional) {
        if (!formulaAuxilio) continue;
        const rolagemAuxilio = await rollDiceGroups(formulaAuxilio.dados, { label: `${modelo.nome}: auxílio de dano` });
        bonusDanoAuxilio += rolagemAuxilio.total + formulaAuxilio.fixo;
        detalhesDanoAuxilio.push(`${efeito.formula} = ${rolagemAuxilio.total + formulaAuxilio.fixo}`);
      }
      const danoBase = Math.max(0, rolagem.total + formula!.fixo + calcularBonusDanoInvocacao(modelo, acao, 'ataque') + bonusDanoAuxilio);
      const tipoDanoBase = tipoDanoAdaptativoMahoraga ?? acao.tipoDano ?? 'DCO';
      const choqueEstaticoAtivo = modelo.subcategoria === 'dez-sombras:nue' &&
        acao.tipo === 'ataque' && ['DCO', 'DP', 'DI', 'DCC'].includes(tipoDanoBase);
      const rolagemChoque = choqueEstaticoAtivo
        ? await rollDiceGroups([{ count: 1, sides: 6 }], { label: 'Choque Estático de Nue' })
        : undefined;
      const danoChoque = rolagemChoque?.total ?? 0;
      const dano = danoBase + danoChoque;
      const parcelasPorTipo = new Map<DamageType, number>();
      const acumularParcela = (valor: number, tipo: DamageType) => {
        if (valor > 0) parcelasPorTipo.set(tipo, (parcelasPorTipo.get(tipo) ?? 0) + valor);
      };
      acumularParcela(danoBase, tipoDanoBase);
      if (danoChoque > 0) acumularParcela(danoChoque, 'DCC');
      const parcelasDano: ParcelaDano[] = [...parcelasPorTipo].map(([tipo, valor]) => ({ tipo, valor }));
      const espadaContraMaldicao = atacanteMahoraga && acao.id === 'espada-do-exterminio' &&
        (alvo.tipo === 'personagem'
          ? alvo.personagem.characterClass === 'Maldição'
          : alvo.modelo.tipo === 'maldicao_domada');
      const parcelasAlvo: ParcelaDano[] = espadaContraMaldicao ? [{ valor: dano, tipo: 'DNR' }] : parcelasDano;
      const vidaAntes = alvo.tipo === 'invocacao'
        ? useCharacterStore.getState().characters.find(character => character.id === alvo.token.ownerCharId)?.instanciasInvocacao?.find(item => item.id === alvo.instanciaId)
        : undefined;
      const personagemAntes = alvo.tipo === 'personagem'
        ? useCharacterStore.getState().characters.find(character => character.id === alvo.personagem.id)
        : undefined;
      const rdIgnoreTigre = predadorApiceParaDano ? TIGRE_PREDADOR_RD_FIXA : 0;
      const grauAlvoTigre = alvo.tipo === 'invocacao' ? alvo.modelo.grau : alvo.personagem.grauCombate;
      const ignoraRDTigrePorGrau = predadorApiceParaDano &&
        ['segundo', 'terceiro', 'quarto'].includes(grauAlvoTigre ?? '');
      if (predadorApiceParaDano && alvo.tipo === 'personagem' && !alvo.personagem.grauCombate) {
        useLogStore.getState().addLog('combat', `🐅 Predador Ápice: o grau de ${alvo.personagem.name} não está cadastrado; os 8 RD fixos foram ignorados, mas a RD adicional por grau exige adjudicação manual.`);
      }
      if (alvo.tipo === 'invocacao') {
        const tiposDano = new Set(parcelasAlvo.map(parcela => parcela.tipo));
        const tipoDanoUnico = tiposDano.size === 1 ? parcelasAlvo[0]?.tipo : undefined;
        const fenomenoId: string = typeof acao.fenomenoAdaptacaoId === 'string'
          ? acao.fenomenoAdaptacaoId
          : tipoDanoUnico ? `dano:${tipoDanoUnico}` : `acao:${modelo.id}:${acao.id}`;
        const aplicado = causarDanoInvocacao(alvo.token.id, dano, tipoDanoUnico, alvo.instanciaId, {
          tipoAlvo: selecaoArea ? 'area' : 'unico',
          critico: resultado.critico,
          eventoId: `${requestIdAtaque}:${alvo.alvoId}`,
          fenomenoId,
          fenomenoNome: acao.nome,
          ataqueCorpoACorpo: acao.tipoAtaque === 'corpo_a_corpo',
          rdIgnore: Math.max(Number.isFinite(ignoranciaAdaptativa.rdIgnore) ? ignoranciaAdaptativa.rdIgnore : 0, rdIgnoreTigre),
          ignoresRD: ignoranciaAdaptativa.ignoraImunidades || ignoraRDTigrePorGrau,
          ...(parcelasAlvo.length > 1 ? { parcelas: parcelasAlvo } : {}),
        });
        if (!aplicado.ok) throw new Error(aplicado.motivo);
        if (selecaoArea) fragilizarAlvoFugaAtingidoPorArea(
          { entityId: alvo.token.id },
          `${opcoes?.requestId ?? novoIdInvocacao('area-fuga')}:${alvo.alvoId}`,
        );
      } else {
        const tipoDanoAlvo = espadaContraMaldicao ? 'DNR' : undefined;
        const tiposAlvo = new Set(parcelasAlvo.map(parcela => parcela.tipo));
        const tipoDanoUnico = tipoDanoAlvo ?? (tiposAlvo.size === 1 ? parcelasAlvo[0]?.tipo : undefined);
        await useCharacterStore.getState().applyDamage(alvo.personagem.id, dano, tipoDanoUnico, {
          attackerId: donoId,
          source: 'omni',
          rdIgnore: Math.max(Number.isFinite(ignoranciaAdaptativa.rdIgnore) ? ignoranciaAdaptativa.rdIgnore : 0, rdIgnoreTigre),
          ignoresRD: ignoranciaAdaptativa.ignoraImunidades || ignoraRDTigrePorGrau,
          ignoresResistance: ignoranciaAdaptativa.ignoraImunidades,
          ignoresOnlyResistance: ignoranciaAdaptativa.ignoraResistencias && !ignoranciaAdaptativa.ignoraImunidades,
          isMelee: bonusAtaque!.tipo === 'corpo_a_corpo',
          attack: { critical: resultado.critico, criticalFail: resultado.falhaCritica, isAreaAttack: Boolean(selecaoArea), kind: bonusAtaque!.tipo === 'corpo_a_corpo' ? 'melee' : 'ranged' },
          ...(parcelasAlvo.length > 1 ? { parcelas: parcelasAlvo } : {}),
          ...(opcoes?.cadeia ? { cadeia: opcoes.cadeia } : {}),
        });
        if (selecaoArea) fragilizarAlvoFugaAtingidoPorArea(
          { characterId: alvo.personagem.id },
          `${opcoes?.requestId ?? novoIdInvocacao('area-fuga')}:${alvo.alvoId}`,
        );
      }
      if (ehTigreFunebre && acao.tipoAtaque !== 'distancia' && dano > 0) {
        const vidaDepois = alvo.tipo === 'invocacao'
          ? useCharacterStore.getState().characters.find(character => character.id === alvo.token.ownerCharId)?.instanciasInvocacao?.find(item => item.id === alvo.instanciaId)
          : undefined;
        const personagemDepois = alvo.tipo === 'personagem'
          ? useCharacterStore.getState().characters.find(character => character.id === alvo.personagem.id)
          : undefined;
        const causouDano = alvo.tipo === 'invocacao'
          ? Boolean(vidaAntes && vidaDepois && (vidaDepois.hpAtual < vidaAntes.hpAtual || (vidaDepois.pvTemporarios ?? 0) < (vidaAntes.pvTemporarios ?? 0)))
          : Boolean(personagemAntes && personagemDepois && (
              (personagemDepois.hpCurrent ?? 0) < (personagemAntes.hpCurrent ?? 0) ||
              (personagemDepois.escCurrent ?? 0) < (personagemAntes.escCurrent ?? 0)
            ));
        if (causouDano) {
          const alvoGarrasId = alvo.tipo === 'invocacao' ? `invoc:${alvo.instanciaId}` : alvo.personagem.id;
          registrarAcertoGarrasTigre(donoId, instancia.id, alvoGarrasId, alvo.nome);
        }
      }
      if (ehTigreFunebre && acaoId === 'retalhar' && resultado.critico) {
        await oferecerSangramentoForteTigre(donoId, modelo.id, instancia.id, alvo.alvoId, alvo.nome, `${requestIdAtaque}:${alvo.alvoId}`);
      }
      if (danoChoque > 0) {
        useLogStore.getState().addLog('combat', `⚡ Choque Estático de Nue: +${danoChoque} de dano chocante contra ${alvo.nome}.`);
      }
      if (ehPunhoMahoraga && dadosReduzidosPunho > 0) {
        const alvoAtual = useMapStore.getState().entities[alvo.token.id];
        const atacanteAtual = useMapStore.getState().entities[servoIdOriginal];
        if (alvoAtual && atacanteAtual) {
          const empurro = empurrarAlvoMahoraga(alvoAtual, atacanteAtual, dadosReduzidosPunho * 6);
          useLogStore.getState().addLog('combat', `💥 Punho do Extermínio: ${alvo.nome} foi empurrado ${empurro.deslocamentoM.toFixed(1)} m de ${dadosReduzidosPunho * 6} m possíveis${empurro.bloqueado ? ' (movimento limitado por colisão)' : ''}.`);
        }
      }
      let efeitoOpcional: ResultadoAlvoAtaqueInvocacao['efeitoOpcional'];
      if (acao.efeitoEspecial?.tipo === 'agarrar_gama_apos_acerto' && !resultadoEmLista) {
        const combateAtual = useCombatStore.getState();
        const tokenAtual = useMapStore.getState().entities[alvo.token.id];
        const turnoAindaValido = combateAtual.inCombat && combateAtual.combatId === estadoTurnoAtaque.combatId &&
          combateAtual.round === rodadaAtaque && combateAtual.currentTurnIndex === estadoTurnoAtaque.currentTurnIndex &&
          podeComandarInvocacao(donoId, invocacaoId);
        const alvoAindaAtivo = alvo.tipo === 'personagem'
          ? (useCharacterStore.getState().characters.find(character => character.id === alvo.personagem.id)?.hpCurrent ?? 1) > 0
          : Boolean(tokenAtual && (tokenAtual.hp ?? 0) > 0 && (!tokenAtual.invocationState || tokenAtual.invocationState === 'ativa'));
        if (turnoAindaValido && alvoAindaAtivo && tokenAtual && !tokenAtual.hidden &&
          useMapStore.getState().layerVisible[tokenAtual.layer ?? 'tokens'] !== false) {
          const donoAtual = useCharacterStore.getState().characters.find(character => character.id === donoId);
          const instanciaAtual = donoAtual?.instanciasInvocacao?.find(item => item.id === instancia.id);
          if (donoAtual && instanciaAtual?.estado === 'ativa') {
            const eventoId = opcoes?.requestId ?? novoIdInvocacao('gama-lingua');
            const atualizada = InstanciaInvocacaoSchema.parse({
              ...instanciaAtual,
              version: instanciaAtual.version + 1,
              agarrarLinguaPendente: {
                eventoId,
                alvoId: alvo.alvoId,
                ...(combateAtual.combatId ? { combateId: combateAtual.combatId } : {}),
                rodada: rodadaAtaque,
                turnoIndex: combateAtual.currentTurnIndex,
              },
            });
            gravarInstancia(donoAtual, atualizada);
            efeitoOpcional = { tipo: 'agarrar_gama', custoPE: acao.efeitoEspecial.custoPE };
          }
        }
      }
      if (acao.efeitoEspecial?.tipo === 'agarrar_orochi_apos_acerto' && !resultadoEmLista) {
        const combateAtual = useCombatStore.getState();
        const tokenAtual = useMapStore.getState().entities[alvo.token.id];
        const turnoAindaValido = combateAtual.inCombat && combateAtual.combatId === estadoTurnoAtaque.combatId &&
          combateAtual.round === rodadaAtaque && combateAtual.currentTurnIndex === estadoTurnoAtaque.currentTurnIndex &&
          podeComandarInvocacao(donoId, invocacaoId);
        const alvoAindaAtivo = alvo.tipo === 'personagem'
          ? (useCharacterStore.getState().characters.find(character => character.id === alvo.personagem.id)?.hpCurrent ?? 1) > 0
          : Boolean(tokenAtual && (tokenAtual.hp ?? 0) > 0 && (!tokenAtual.invocationState || tokenAtual.invocationState === 'ativa'));
        if (turnoAindaValido && alvoAindaAtivo && tokenAtual && !tokenAtual.hidden &&
          useMapStore.getState().layerVisible[tokenAtual.layer ?? 'tokens'] !== false) {
          const donoAtual = useCharacterStore.getState().characters.find(character => character.id === donoId);
          const instanciaAtual = donoAtual?.instanciasInvocacao?.find(item => item.id === instancia.id);
          if (donoAtual && instanciaAtual?.estado === 'ativa') {
            const eventoId = opcoes?.requestId ?? novoIdInvocacao('orochi-bote');
            const atualizada = InstanciaInvocacaoSchema.parse({
              ...instanciaAtual,
              version: instanciaAtual.version + 1,
              agarrarOrochiPendente: {
                eventoId,
                alvoId: alvo.alvoId,
                combateId: combateAtual.combatId,
                rodada: rodadaAtaque,
                turnoIndex: combateAtual.currentTurnIndex,
              },
            });
            gravarInstancia(donoAtual, atualizada);
            efeitoOpcional = { tipo: 'agarrar_orochi', custoPE: acao.efeitoEspecial.custoPE };
          }
        }
      }
      useLogStore.getState().addLog('combat', `🎯 ${modelo.nome} — ${acao.nome} contra ${alvo.nome}: d20 ${natural} + ${bonusAtaqueAlvo} = ${resultado.total} vs Defesa ${defesa} → ${resultado.critico ? 'acerto crítico' : 'acerto'}, dano ${dano} (${espadaContraMaldicao ? 'DNR' : tipoDanoBase})${atacanteMahoraga ? `; adaptação de combate ${ignoranciaAdaptativa.giros}/4` : ''}${tipoDanoAdaptativoMahoraga ? `; Ataque Adaptativo ${tipoDanoAdaptativoMahoraga}` : ''}${vantagemEfetiva ? '; vantagem de Emergir das Sombras' : ''}${flanqueadoPorMatilha ? '; Flanqueado pela Matilha das Sombras' : ''}${detalhesDanoAuxilio.length ? `; auxílio extra ${detalhesDanoAuxilio.join(', ')}` : ''}.`);
      resultados.push({ alvoId: alvo.alvoId, nomeAlvo: alvo.nome, acertou: true, totalAtaque: resultado.total, dano, ...(resultado.critico ? { critico: true } : {}), ...(vantagemEfetiva ? { vantagemEmergir: true } : {}), ...(efeitoOpcional ? { efeitoOpcional } : {}) });
    }
    gravarEstadoAtaqueMahoraga();
    consumirAuxiliosDeAtaque();
    return resultadoEmLista
      ? { ok: true, resultados }
      : {
        ok: true,
        acertou: resultados[0].acertou,
        totalAtaque: resultados[0].totalAtaque,
        dano: resultados[0].dano,
        ...(resultados[0].critico ? { critico: true } : {}),
        ...(resultados[0].vantagemEmergir ? { vantagemEmergir: true } : {}),
          ...(resultados[0].efeitoOpcional ? { efeitoOpcional: resultados[0].efeitoOpcional } : {}),
      };
  } catch {
    // A execução pode ter chegado ao dano antes da falha. Não duplicar ação nem dano.
    return { ok: false, motivo: 'Falha ao resolver ataque; confira o log de combate.' };
  } finally {
    ataquesPendentes.delete(chave);
  }
}

/** Executa uma ação de auxílio configurada na ficha, debitando a economia da
 * instância e aplicando cura, PVT ou um ActiveBuff temporizado ao aliado. */
export async function comandarSuporte(
  donoId: string,
  invocacaoId: string,
  acaoId: string,
  alvosIds: string[],
  opcoes?: { instanciaId?: string; requestId?: string },
): Promise<{ ok: true; efeito: string; valor: number; alvos: number; curaReal?: boolean; formula?: string } | { ok: false; motivo: string }> {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  if (!dono) return { ok: false, motivo: 'Personagem inválido.' };
  if (!podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };
  const modelo = dono.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  const acaoOriginal = modelo?.acoes.find(item => item.id === acaoId);
  if (!modelo || !acaoOriginal) {
    return { ok: false, motivo: 'Ação ou invocação não encontrada.' };
  }
  if (acaoOriginal.statusAutomacao === 'manual') return { ok: false, motivo: 'Esta a\u00e7\u00e3o exige resolu\u00e7\u00e3o manual conforme a lacuna descrita na ficha.' };
  const resolucaoOmni = acaoOriginal.tipoExecucao === 'omni' || acaoOriginal.tipoExecucao === 'referencia_omni'
    ? resolverAcaoOmniInvocacao(acaoOriginal, useOmniEntidadesStore.getState().entidades)
    : undefined;
  if (resolucaoOmni && !resolucaoOmni.ok) return { ok: false, motivo: resolucaoOmni.motivo };
  const acao = resolucaoOmni?.ok ? resolucaoOmni.acao : acaoOriginal;
  if (acao.tipo !== 'suporte' || !acao.efeitoSuporte) {
    return { ok: false, motivo: 'Ação sem um efeito de suporte estruturado.' };
  }

  const mapa = useMapStore.getState();
  const servo = tokensInvocados(donoId).find(entity => entity.invocationId === invocacaoId &&
    (!opcoes?.instanciaId || entity.invocationInstanceId === opcoes.instanciaId) &&
    (entity.hp ?? 0) > 0 && entity.invocationState !== 'caida');
  if (!servo) return { ok: false, motivo: 'A invocação precisa estar ativa no mapa.' };
  const instancia = obterInstanciaDoToken(dono, servo, modelo);
  const alvosUnicos = [...new Set(alvosIds)];
  if (!alvosUnicos.length || alvosUnicos.length > 50) return { ok: false, motivo: 'Selecione entre 1 e 50 alvos no mapa.' };
  if (acao.efeitoSuporte.alvos === 'unico' && alvosUnicos.length !== 1) {
    return { ok: false, motivo: 'Esta ação atende um único alvo.' };
  }
  if (acao.efeitoSuporte.alvos === 'multiplos' && acao.efeitoSuporte.efeito !== 'cura') {
    return { ok: false, motivo: 'Apenas cura pode afetar múltiplos alvos nesta versão.' };
  }
  if (!podeUsarAcaoDaInstancia(instancia, acaoId)) return { ok: false, motivo: 'A ação ainda está em recarga.' };
  const categoria = categoriaEconomiaDaAcao(acao, instancia.economiaAcoes);
  if (!categoria) return { ok: false, motivo: 'Categoria de ação própria não configurada.' };

  const characterStore = useCharacterStore.getState();
  type AlvoSuporte =
    | { tipo: 'personagem'; personagem: Character; token: Entity; nome: string }
    | { tipo: 'invocacao'; personagem: Character; modelo: InvocacaoControlador; instancia: InstanciaInvocacao; token: Entity; nome: string };
  const alvosBrutos: Array<AlvoSuporte | null> = alvosUnicos.map(id => {
    if (id.startsWith('invoc:')) {
      const token = mapa.entities[id.slice('invoc:'.length)];
      if (!token?.ownerCharId || !token.invocationId || token.hidden) return null;
      const personagem = characterStore.characters.find(item => item.id === token.ownerCharId);
      if (!personagem) return null;
      const modeloAlvo = personagem.invocacoesConhecidas?.find(item => item.id === token.invocationId);
      if (!modeloAlvo) return null;
      const instanciaAlvo = obterInstanciaDoToken(personagem, token, modeloAlvo);
      return { tipo: 'invocacao', personagem, modelo: modeloAlvo, instancia: instanciaAlvo, token, nome: modeloAlvo.apelido?.trim() || modeloAlvo.nome };
    }
    const personagem = characterStore.characters.find(item => item.id === id);
    const token = Object.values(mapa.entities).find(entity => entity.characterId === id && !entity.invocationId && !entity.hidden);
    return personagem && token ? { tipo: 'personagem', personagem, token, nome: personagem.name } : null;
  });
  if (alvosBrutos.some(alvo => !alvo)) return { ok: false, motivo: 'Todos os alvos precisam ter uma ficha e um token visível no mapa.' };
  const alvos = alvosBrutos as AlvoSuporte[];
  if (acao.somenteProprio && alvos.some(alvo => alvo.tipo !== 'invocacao' || alvo.token.id !== servo.id)) {
    return { ok: false, motivo: 'Esta habilidade só pode atingir a própria invocação.' };
  }
  if (!acao.permiteInimigos && alvos.some(alvo => !mesmaEquipeNoMapa(dono, servo, alvo.personagem, alvo.token) &&
    !(alvo.personagem.id === donoId && !servo.masterControlled))) {
    return { ok: false, motivo: 'Ações de suporte só podem escolher o próprio Controlador ou aliados.' };
  }
  if (alvos.some(alvo => alvo.tipo === 'invocacao' &&
    (acao.efeitoSuporte!.efeito === 'cura'
      ? alvo.instancia.estado === 'derrotada' || alvo.instancia.estado === 'dissipada'
      : alvo.instancia.estado !== 'ativa'))) {
    return { ok: false, motivo: 'A invocação-alvo precisa estar em um estado válido para receber este auxílio.' };
  }
  const escala = mapa.gridConfig.metersPerCell / mapa.gridConfig.dpi;
  if (!(escala > 0)) return { ok: false, motivo: 'Grade inválida.' };
  const alcance = acao.alcanceM ?? (acao.efeitoSuporte.efeito === 'cura' ? alcanceCuraInvocacao(modelo.grau) : 1.5);
  if (!Number.isFinite(alcance) || (alcance ?? -1) < 0) return { ok: false, motivo: 'Alcance de suporte inválido.' };
  for (const alvo of alvos) {
    const distancia = Math.hypot((servo.x + servo.w / 2) - (alvo.token.x + alvo.token.w / 2),
      (servo.y + servo.h / 2) - (alvo.token.y + alvo.token.h / 2)) * escala;
    if (distancia > alcance! + 1e-6) return { ok: false, motivo: `${alvo.nome} está fora do alcance de ${alcance} m.` };
  }

  const marcadorUso = instancia.usosAuxilioRodada;
  const rodada = useCombatStore.getState().round ?? 1;
  const repeticoes = acao.efeitoSuporte.efeito === 'cura' || marcadorUso?.rodada !== rodada
    ? 0
    : marcadorUso.total ?? Object.values(marcadorUso.porEfeito).reduce((total, quantidade) => total + quantidade, 0);
  const escalaHorda = calcularEscalaHorda(integracaoInvocacoes.escalaHorda ? instancia.composicaoHorda?.membros ?? [] : []);
  const penalidades = calcularPrejuizoRepeticaoHorda(repeticoes,
    integracaoInvocacoes.escalaHorda ? instancia.composicaoHorda?.membros ?? [] : []);
  const calculado = calcularEfeitoSuporte(modelo, acao, penalidades, escalaHorda);
  if (!calculado.ok) return calculado;
  if (instancia.composicaoHorda && integracaoInvocacoes.escalaHorda) metricas.escalas[calculado.efeito.tipo]++;
  const possuiEnergiaReversa = capacidadeEnergiaReversaInvocacao(modelo, dono);
  const curaLivre = calculado.efeito.tipo === 'cura' && acao.curaRealSemCusto === true;
  const curaReal = calculado.efeito.tipo === 'cura' && (possuiEnergiaReversa || curaLivre);
  let custoOverride: number | undefined;
  if (curaLivre) {
    custoOverride = 0;
  } else if (curaReal) {
    if (acao.custoPE !== 2) return { ok: false, motivo: 'A cura real por Energia Reversa precisa custar exatamente 2 PE.' };
    custoOverride = 2;
  } else if (calculado.efeito.tipo === 'cura' && acao.custoPE === 2) {
    // Sem Energia Reversa, o efeito previsto é PVT e a regra não exige os 2 PE da cura real.
    custoOverride = 0;
  }
  const debito = prepararDebitoComando(dono, modelo, instancia, acao, custoOverride);
  if (!debito.ok) return debito;

  const chave = `${instancia.id}:${acaoId}`;
  if (suportesPendentes.has(chave)) return { ok: false, motivo: 'Comando anterior ainda em andamento.' };
  suportesPendentes.add(chave);
  try {
    let valor: number;
    let formula: string | undefined;
    if (calculado.efeito.tipo === 'cura') {
      formula = `${calculado.efeito.dados.map(dado => `${dado.count}d${dado.sides}`).join('+')}${calculado.efeito.bonus < 0 ? calculado.efeito.bonus : `+${calculado.efeito.bonus}`}`;
      const rolagem = await rollDiceGroups(calculado.efeito.dados, { label: `${modelo.nome} — ${acao.nome}` });
      valor = Math.max(0, Math.floor(rolagem.total + calculado.efeito.bonus));
    } else if (calculado.efeito.tipo === 'dano_adicional') {
      valor = 0;
      formula = calculado.efeito.formula;
    } else {
      valor = calculado.efeito.valor;
    }

    const gasto = gastarAcaoDaInstancia(instancia, categoria, 1, opcoes?.requestId);
    if (!gasto.ok) return gasto;
    const usosPorEfeito = marcadorUso?.rodada === rodada ? { ...marcadorUso.porEfeito } : {};
    const totalUsosAuxilio = marcadorUso?.rodada === rodada ? repeticoes + 1 : 1;
    if (acao.efeitoSuporte.efeito !== 'cura') usosPorEfeito[acao.efeitoSuporte.efeito] = (usosPorEfeito[acao.efeitoSuporte.efeito] ?? 0) + 1;
    const comDebitos = {
      ...gasto.instancia,
      recursosAtuais: debito.recursosRestantes,
      ...(acao.efeitoSuporte.efeito !== 'cura' ? { usosAuxilioRodada: { rodada, total: totalUsosAuxilio, porEfeito: usosPorEfeito } } : {}),
    };
    const comRecarga = registrarRecargaDaAcao(comDebitos, acao);
    gravarInstancia(dono, comRecarga, { peCurrent: debito.peDonoRestante });

    const roundExpiry = rodada + 1;
    const bencaoContraMaldicao = modelo.subcategoria === 'dez-sombras:cervo-circular' && acao.id === 'bencao' &&
      alvos.length === 1 && (alvos[0].tipo === 'personagem'
        ? alvos[0].personagem.characterClass === 'Maldição'
        : alvos[0].modelo.tipo === 'maldicao_domada');
    const valorEfeito = bencaoContraMaldicao ? Math.floor(valor * 1.5) : valor;
    for (const alvo of alvos) {
      if (calculado.efeito.tipo === 'cura') {
        if (bencaoContraMaldicao) {
          if (alvo.tipo === 'personagem') {
            await characterStore.applyDamage(alvo.personagem.id, valorEfeito, 'DNR', {
              attackerId: donoId,
              source: 'omni',
              isMelee: false,
              attack: { critical: false, criticalFail: false, kind: 'cursed' },
              tags: [`cervo-bencao:${opcoes?.requestId ?? novoIdInvocacao('bencao')}`],
            });
          } else {
            const dano = causarDanoInvocacao(alvo.token.id, valorEfeito, 'DNR', alvo.instancia.id, {
              eventoId: `cervo-bencao:${opcoes?.requestId ?? novoIdInvocacao('bencao')}`,
              tipoAlvo: 'unico',
            });
            if (!dano.ok) return dano;
          }
        } else if (alvo.tipo === 'personagem') {
          if (curaReal) characterStore.applyHealing(alvo.personagem.id, valor, 'cursed_energy_external', donoId);
          else characterStore.applyShield(alvo.personagem.id, valor);
        } else if (curaReal) {
          const curada = curarInvocacao(alvo.token.id, valor);
          if (!curada.ok) return curada;
        } else {
          const instanciaAtualizada = InstanciaInvocacaoSchema.parse({
            ...alvo.instancia,
            version: alvo.instancia.version + 1,
            pvTemporarios: (alvo.instancia.pvTemporarios ?? 0) + valor,
          });
          gravarInstancia(alvo.personagem, instanciaAtualizada);
          mapa.updateEntity(alvo.token.id, { invocationTempHp: instanciaAtualizada.pvTemporarios ?? 0 });
        }
        continue;
      }
      const origem = `${modelo.nome} — ${acao.nome}`;
      let buff: ActiveBuff | undefined;
      let efeitoInvocacao: NonNullable<InstanciaInvocacao['efeitosSuporteAtivos']>[number] | undefined;
      if (calculado.efeito.tipo === 'defesa') {
        buff = { id: novoIdInvocacao('auxilio-defesa'), spellName: origem, type: 'ca', value: calculado.efeito.valor, remainingTurns: -1, sourceCharId: donoId, expiraNaRodada: roundExpiry };
        efeitoInvocacao = { id: novoIdInvocacao('auxilio-defesa'), tipo: 'defesa', valor: calculado.efeito.valor, expiraNaRodada: roundExpiry };
      } else if (calculado.efeito.tipo === 'acerto') {
        buff = { id: novoIdInvocacao('auxilio-acerto'), spellName: origem, type: 'hit', value: calculado.efeito.valor, remainingTurns: -1, sourceCharId: donoId, expiraNaRodada: roundExpiry, consumeOnAttack: true };
        efeitoInvocacao = { id: novoIdInvocacao('auxilio-acerto'), tipo: 'acerto', valor: calculado.efeito.valor, expiraNaRodada: roundExpiry, consomeNoAtaque: true };
      } else if (calculado.efeito.tipo === 'dano_adicional') {
        buff = { id: novoIdInvocacao('auxilio-dano'), spellName: origem, type: 'extraDiceAfter', value: 0, remainingTurns: -1, sourceCharId: donoId, expiraNaRodada: roundExpiry, consumeOnAttack: true, extraDamageFormula: calculado.efeito.formula };
        efeitoInvocacao = { id: novoIdInvocacao('auxilio-dano'), tipo: 'dano_adicional', valor: 0, formula: calculado.efeito.formula, expiraNaRodada: roundExpiry, consomeNoAtaque: true };
      } else if (calculado.efeito.tipo === 'reducao_dano') {
        buff = { id: novoIdInvocacao('auxilio-rd'), spellName: origem, type: 'rd', value: calculado.efeito.valor, remainingTurns: -1, sourceCharId: donoId, expiraNaRodada: roundExpiry, rdDamageTypes: calculado.efeito.tiposDano };
        efeitoInvocacao = { id: novoIdInvocacao('auxilio-rd'), tipo: 'reducao_dano', valor: calculado.efeito.valor, tiposDano: calculado.efeito.tiposDano, expiraNaRodada: roundExpiry };
      }
      if (instancia.composicaoHorda) {
        const suporteHorda = OrigemSuporteHordaSchema.parse({ donoId, instanciaId: instancia.id,
          usosAnteriores: repeticoes, grau: modelo.grau, categoriaAcao: acao.categoriaAcao, config: acao.efeitoSuporte });
        if (buff) buff = { ...buff, suporteHorda };
        if (efeitoInvocacao) efeitoInvocacao = { ...efeitoInvocacao, suporteHorda };
      }
      if (alvo.tipo === 'personagem') {
        if (buff) characterStore.addBuff(alvo.personagem.id, buff);
      } else if (efeitoInvocacao) {
        const efeitosAtivos = (alvo.instancia.efeitosSuporteAtivos ?? []).filter(efeito => efeito.expiraNaRodada > rodada);
        atualizarEfeitosSuporteInvocacao(alvo.personagem, alvo.modelo, alvo.token.id, alvo.instancia, [...efeitosAtivos, efeitoInvocacao]);
      }
    }

    let nomeEfeito: string;
    switch (calculado.efeito.tipo) {
      case 'cura': nomeEfeito = bencaoContraMaldicao ? 'dano de Energia Reversa' : curaReal ? 'cura real' : 'Pontos de Vida Temporários'; break;
      case 'defesa': nomeEfeito = 'Defesa'; break;
      case 'acerto': nomeEfeito = 'Acerto'; break;
      case 'dano_adicional': nomeEfeito = `dano adicional ${formula}`; break;
      case 'reducao_dano': nomeEfeito = `RD ${calculado.efeito.valor} contra ${calculado.efeito.tiposDano.join(', ')}`; break;
    }
    useLogStore.getState().addLog('combat', `🛟 ${modelo.nome} — ${acao.nome}: ${nomeEfeito}${calculado.efeito.tipo === 'cura' || calculado.efeito.tipo === 'defesa' || calculado.efeito.tipo === 'acerto' || calculado.efeito.tipo === 'reducao_dano' ? ` ${valorEfeito}` : ''} em ${alvos.map(alvo => alvo.nome).join(', ')}${formula && calculado.efeito.tipo === 'cura' ? ` (${formula}${bencaoContraMaldicao ? ` ×1,5 = ${valorEfeito}` : ''})` : ''}.`);
    return { ok: true, efeito: nomeEfeito, valor: valorEfeito, alvos: alvos.length, ...(calculado.efeito.tipo === 'cura' ? { curaReal: curaReal && !bencaoContraMaldicao } : {}), ...(formula ? { formula } : {}) };
  } catch {
    return { ok: false, motivo: 'Falha ao resolver suporte; confira o log de combate.' };
  } finally {
    suportesPendentes.delete(chave);
  }
}

/** Teste de perícia feito pela invocação: usa a ficha da própria invocação e
 * não consome vantagens, recursos nem rerrolagens do dono. */
export async function rolarPericiaInvocacao(
  donoId: string,
  invocacaoId: string,
  pericia: string,
  opcoes?: { instanciaId?: string },
): Promise<{ ok: true; d20: number; bonus: number; total: number; treinada: boolean } | { ok: false; motivo: string }> {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  if (!dono) return { ok: false, motivo: 'Personagem proprietário não encontrado.' };
  const modelo = dono.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  if (!modelo) return { ok: false, motivo: 'Modelo da invocação não encontrado.' };
  if (!Object.hasOwn(SISTEMA_PERICIAS, pericia)) return { ok: false, motivo: 'Perícia não reconhecida.' };
  const token = tokensInvocados(donoId).find(item => item.invocationId === invocacaoId && (!opcoes?.instanciaId || item.invocationInstanceId === opcoes.instanciaId) && (item.hp ?? 0) > 0);
  if (!token) return { ok: false, motivo: 'A invocação precisa estar ativa no mapa para fazer o teste.' };
  if (useCombatStore.getState().inCombat && !podeComandarInvocacao(donoId, invocacaoId)) return { ok: false, motivo: 'O teste só pode ser rolado no turno do dono durante o combate.' };
  const bonus = calcularBonusPericiaInvocacao(dono, modelo, pericia);
  if (!bonus) return { ok: false, motivo: 'Defina Inteligência ou Sabedoria como atributo-base das perícias na ficha.' };
  if (!invocacaoTreinadaNaPericia(modelo, pericia) && bonusPericiaCaracteristicas(modelo, pericia) <= 0) {
    return { ok: false, motivo: 'A invocação precisa ser treinada nessa perícia ou ter uma característica que conceda o teste.' };
  }
  const nomePericia = ROTULOS_PERICIAS[pericia as keyof typeof ROTULOS_PERICIAS] ?? pericia;
  const d20 = await rollD20Autonomo(bonus.total, { label: `${nomePericia} — ${modelo.nome}` });
  const total = d20 + bonus.total;
  useLogStore.getState().addLog('combat', `🎲 ${modelo.nome} — ${nomePericia}: d20 ${d20} + ${bonus.total} = ${total}${bonus.treinada ? ' (treinada)' : ''}.`);
  return { ok: true, d20, bonus: bonus.total, total, treinada: bonus.treinada };
}
