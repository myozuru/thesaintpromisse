import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore, type Entity } from '@/stores/useMapStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { validarIntermediarioInvocacao } from './intermediario';
import { useCombatStore } from '@/stores/useCombatStore';
import { limiteAtivasPersonagem, type InvocacaoControlador } from './tipos';
import { alcancePosicionamentoInvocacao } from './alcanceInvocacao';
import { aparenciaTokenInvocacao } from './aparenciaToken';
import { useLogStore } from '@/stores/useLogStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { podeUsarVersaoAprovada } from '@/lib/controlador/aprovacao';
import { dadosAdicionaisInvestidaPerfurante, medirInvestidaRetaEmMetros, transformarCaoEmTotalidade } from '@/lib/controlador/dezSombras';
import { computeTotalDefense } from '@/lib/defenseCalc';
import { rollD20Autonomo, rollDiceGroups } from '@/lib/dice';
import { SISTEMA_PERICIAS, ROTULOS_PERICIAS } from '@/lib/omni/constantesDoSistema';
import { WallsEngine } from '@/components/mapa/WallsEngine';
import { prepareCollisionCache, resolveCollisionMove, tokenFootprintSegments, type MapCollisionToken } from '@/lib/mapCollision';
import { buildSegments as buildFogSegments } from '@/lib/fog/visibility';
import { useFogStore } from '@/stores/fogStore';
import { isFreeformFor } from '@/lib/freeformMode';
import { DEFAULT_SAVING_THROWS, type ActiveBuff, type Character, type DamageType } from '@/types';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import type { MapTemplate } from '@/components/mapa/TemplateEngine';
import { findEntitiesInTemplate, resolveAreaTargetCharacters } from '@/lib/mapAoE';
import { resolverTokenDaFicha, resolverTokenControladorDaFicha } from '@/lib/mapa/tokenDaFicha';
import { InstanciaInvocacaoSchema, type InstanciaInvocacao } from '@/lib/invocacoes/schema';
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
import { calcularHorda, calcularReducaoDanoHorda, validarLimiteHorda, type GrauHorda, type TipoAlvoDanoHorda } from './hordas';
import { calcularEscalaHorda, calcularPrejuizoRepeticaoHorda, verificarPerdaMembrosHorda, resolverPerdaMembrosHorda, acumularCuraParaLimiarHorda } from './hordas';
import { consumirAceiteAutonomia, type AceiteAutonomia } from './confirmacaoAutonomia';
import { integracaoInvocacoes, metricasIntegracaoInvocacoes as metricas } from './integracaoFlags';
import { formatDamage, stepDamage } from '@/lib/damageStep';
import { OrigemSuporteHordaSchema } from '@/lib/invocacoes/schema';
import './suporteContinuoHorda';

export type DirecaoInvocacao = 'norte' | 'sul' | 'leste' | 'oeste';
export type ResultadoInvocacao = { ok: true; tokenId: string } | { ok: false; motivo: string };
export type PosicaoInvocacao = { invocacaoId: string; x: number; y: number };
export type ResultadoLoteInvocacoes = { ok: true; tokenIds: string[] } | { ok: false; motivo: string };

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
  const hpCatalogo = Math.max(0, Math.min(instancia.hpMaximoAtual, instancia.hpAtual));
  useCharacterStore.getState().updateCharacter(personagemAtual.id, {
    instanciasInvocacao: instanciasComAtualizada(personagemAtual, instancia),
    invocacoesConhecidas: (personagemAtual.invocacoesConhecidas ?? []).map(modelo => modelo.id === instancia.modeloId
      ? { ...modelo, hpAtual: hpCatalogo }
      : modelo),
    ...extras,
  });
}


/** Release tongue holds when their source invocation becomes inactive. */
type SubcategoriaFonteDeSegurar = 'dez-sombras:sapo' | 'dez-sombras:abismo-desconhecido-do-poco';

function isTongueGrappleSource(subcategoria?: string): subcategoria is SubcategoriaFonteDeSegurar {
  return subcategoria === 'dez-sombras:sapo' || subcategoria === 'dez-sombras:abismo-desconhecido-do-poco';
}

function releaseTongueGrapples(
  donoFonteId: string,
  instanciaFonteId: string,
  subcategoria: SubcategoriaFonteDeSegurar,
): void {
  const grapplerId = 'invocacao-sapo:' + instanciaFonteId;
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
    useLogStore.getState().addLog('combat', 'A fonte de Segurar saiu de campo; os alvos agarrados foram liberados.');
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
  let modelosAtualizados = (personagemAtual.invocacoesConhecidas ?? []).map(item => item.id === invocacaoId
    ? {
      ...item,
      hpAtual: resultado.pvCatalogo,
      ...(resultado.perdaPermanente ? { perdaPermanente: true } : {}),
    }
    : item);
  let instanciasAtualizadas = instanciasComAtualizada(
    personagemAtual,
    InstanciaInvocacaoSchema.parse(resultado.instancia),
  );

  if (resultado.perdaPermanente &&
      ['dez-sombras:cao-branco', 'dez-sombras:cao-preto'].includes(modelo.subcategoria ?? '')) {
    const pairedSubcategoria = modelo.subcategoria === 'dez-sombras:cao-branco'
      ? 'dez-sombras:cao-preto'
      : 'dez-sombras:cao-branco';
    const pairedModelo = modelosAtualizados.find(
      item => item.subcategoria === pairedSubcategoria && !item.perdaPermanente,
    );

    if (pairedModelo) {
      const instanciaFonte = [...instanciasAtualizadas].reverse().find(instancia =>
        instancia.modeloId === pairedModelo.id &&
        (instancia.estado === 'ativa' || instancia.estado === 'caida'),
      );
      const modeloTotalidade = transformarCaoEmTotalidade({
        ...pairedModelo,
        hpAtual: instanciaFonte?.hpAtual ?? pairedModelo.hpAtual,
      });

      if (modeloTotalidade) {
        const instanciasTotalidade = instanciasAtualizadas.map(instancia => {
          if (
            instancia.modeloId !== pairedModelo.id ||
            (instancia.estado !== 'ativa' && instancia.estado !== 'caida')
          ) return instancia;

          return InstanciaInvocacaoSchema.parse({
            ...instancia,
            version: instancia.version + 1,
            hpAtual: Math.min(instancia.hpAtual, 35),
            hpMaximoAtual: 35,
          });
        });
        const instanciaCatalogo = [...instanciasTotalidade].reverse().find(instancia =>
          instancia.modeloId === pairedModelo.id &&
          (instancia.estado === 'ativa' || instancia.estado === 'caida'),
        );
        const modeloTotalidadeAtualizado = {
          ...modeloTotalidade,
          hpAtual: instanciaCatalogo?.hpAtual ?? modeloTotalidade.hpAtual,
        };

        for (const instancia of instanciasTotalidade) {
          if (
            instancia.modeloId !== pairedModelo.id ||
            (instancia.estado !== 'ativa' && instancia.estado !== 'caida')
          ) continue;
          const token = useMapStore.getState().entities[instancia.tokenId];
          if (
            token?.ownerCharId !== donoId ||
            token.invocationId !== pairedModelo.id ||
            token.invocationInstanceId !== instancia.id
          ) continue;
          useMapStore.getState().updateEntity(token.id, {
            hp: instancia.hpAtual,
            hpMax: 35,
            invocationDefense: modeloTotalidade.defesa,
            invocationMovementM: modeloTotalidade.deslocamentoM,
          });
        }

        modelosAtualizados = modelosAtualizados.map(item => item.id === pairedModelo.id
          ? modeloTotalidadeAtualizado
          : item);
        instanciasAtualizadas = instanciasTotalidade;
      }
    }
  }

  useCharacterStore.getState().updateCharacter(personagemAtual.id, {
    invocacoesConhecidas: modelosAtualizados,
    instanciasInvocacao: instanciasAtualizadas,
  });
  if (isTongueGrappleSource(modelo.subcategoria) && resultado.instancia.estado !== 'ativa') {
    releaseTongueGrapples(donoId, instancia.id, modelo.subcategoria);
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

type ModoExecucaoComandoInvocacao = 'manual' | 'evento_automatico' | 'reacao';
type OpcoesComandoInvocacao = { instanciaId?: string; requestId?: string; cadeia?: CadeiaOmni; validarReacao?: () => boolean; aceiteAutonomia?: AceiteAutonomia };

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
  return Object.values(useMapStore.getState().entities).filter(e => e.ownerCharId === donoCharacterId && !!e.invocationId);
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

// Bloqueio persistente de uma rodada, independente da vida compartilhada da Horda.
useCombatStore.subscribe((atual, anterior) => {
  if ((atual.round ?? 1) <= (anterior.round ?? 1)) return;
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
  if (modelo.domado === false) return { ok: false, motivo: 'Este shikigami ainda precisa ser domado no ritual.' };
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
  if (ativos.length >= limiteAtivasPersonagem(dono.specialization, dono.treinoControle ?? 0)) return { ok: false, motivo: 'Limite de invocações ativas atingido.' };
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
  try {
    mapa.addEntity({
      id: tokenId,
      ...aparenciaTokenInvocacao(modelo),
      x, y, w: passo, h: passo, rotation: 0, locked: false, layer: 'tokens',
      hp: modelo.hpAtual, hpMax: modelo.hpMaximo, ownerCharId: donoId,
      ownerProfileId: dono.profileId || undefined, invocationId: modelo.id,
      invocationEventId: eventoId, invocationInstanceId: instanciaId,
      invocationState: modelo.hpAtual > 0 ? 'ativa' : 'caida',
      invocationDefense: modelo.defesa, invocationMovementM: modelo.deslocamentoM,
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
    if (modelo.domado === false) return { ok: false, motivo: modelo.nome + ' ainda precisa ser domado no ritual.' };
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
  const limiteHordas = validarLimiteHorda({
    limiteInvocacoesEmCampo: limite,
    hordasAtivas,
    invocacoesIndividuaisAposCriacao: ativos.length - hordasAtivas,
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
    if (modelo.domado === false) return { ok: false, motivo: modelo.nome + ' ainda precisa ser domado no ritual.' };
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
  if (ativos.length + posicoes.length > limite) return { ok: false, motivo: 'O lote ultrapassa o limite de invocações ativas.' };
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
        x, y, w: passo, h: passo, rotation: 0, locked: false, layer: 'tokens',
        hp: modelo.hpAtual, hpMax: modelo.hpMaximo, ownerCharId: donoId,
        ownerProfileId: dono.profileId || undefined, invocationId: modelo.id,
        invocationEventId: eventoDaInstancia, invocationBatchId: eventoId, invocationInstanceId: instanciaId,
        invocationState: modelo.hpAtual > 0 ? 'ativa' : 'caida',
        invocationDefense: modelo.defesa, invocationMovementM: modelo.deslocamentoM,
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
  if (isTongueGrappleSource(modelo.subcategoria)) releaseTongueGrapples(donoId, instancia.id, modelo.subcategoria);
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
      if (isTongueGrappleSource(modelo.subcategoria)) releaseTongueGrapples(donoId, instancia.id, modelo.subcategoria);
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
    if (isTongueGrappleSource(modelo.subcategoria) && estado === 'caida') {
      releaseTongueGrapples(donoId, instancia.id, modelo.subcategoria);
    }
  }
  return removidos;
}

/** Invocações não agem sozinhas; comandos no turno do dono serão implementados na Fase 4. */
export function podeComandarInvocacao(donoId: string): boolean {
  const combat = useCombatStore.getState();
  return combat.inCombat && combat.initiativeOrder[combat.currentTurnIndex]?.charId === donoId;
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
  if ((instancia.agarradoPorInvocacao?.length ?? 0) > 0) return false;
  const combat = useCombatStore.getState();
  if (!combat.inCombat) return true;
  if (!podeComandarInvocacao(donoId)) return false;
  if (isFreeformFor(dono, combat.freeformMode)) return true;
  return (instancia.economiaAcoes?.acaoMovimento?.atual ?? 0) > 0;
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
  const modelo = obterModeloDoToken(dono, token);
  if (!modelo || !Number.isFinite(modelo.deslocamentoM) || modelo.deslocamentoM <= 0) {
    return { ok: false, motivo: 'Deslocamento da invocação inválido.' };
  }
  const instanciaAtiva = obterInstanciaDoToken(dono, token, modelo);
  if ((token.hp ?? instanciaAtiva.hpAtual) <= 0 || (token.invocationState && token.invocationState !== 'ativa') || instanciaAtiva.estado !== 'ativa') {
    return { ok: false, motivo: 'Invocação caída ou inativa não pode se mover.' };
  }
  if ((instanciaAtiva.agarradoPorInvocacao?.length ?? 0) > 0) {
    return { ok: false, motivo: 'Invocação agarrada não pode se mover antes de escapar.' };
  }
  const grid = mapa.gridConfig;
  if (!(grid.dpi > 0) || !(grid.metersPerCell > 0)) return { ok: false, motivo: 'Grade do mapa inválida.' };
  const pontos = [input.de, ...input.trajetoria, input.para];
  const distanciaDaTrajetoriaM = pontos.slice(1).reduce((total, ponto, index) => {
    const anterior = pontos[index];
    return total + Math.hypot(ponto.x - anterior.x, ponto.y - anterior.y) / grid.dpi * grid.metersPerCell;
  }, 0);
  const distanciaM = Math.max(input.distanciaM, distanciaDaTrajetoriaM);
  if (distanciaM > modelo.deslocamentoM + 0.05) {
    return { ok: false, motivo: 'O movimento excede o deslocamento configurado na ficha.' };
  }
  if (distanciaM <= 0.05) return { ok: true, distanciaM };
  const segmentos = WallsEngine.blockingSegments(mapa.walls, 'sight');
  const fog = useFogStore.getState();
  for (const segment of buildFogSegments(fog.walls, fog.doors)) segmentos.push([segment.a, segment.b]);
  const entidadesFixas = Object.values(mapa.entities).filter(entity =>
    entity.id !== token.id && entity.layer !== 'map' && !entity.hidden && !entity.carriedBy,
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

  const combat = useCombatStore.getState();
  let instancia = instanciaAtiva;
  if (combat.inCombat) {
    if (!podeComandarInvocacao(dono.id)) return { ok: false, motivo: 'Só é possível mover a invocação no turno do dono.' };
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
    return { ok: false, motivo: 'Instância do Shikigami não encontrada para este dono.' };
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


/** Dano direcionado a uma instância; 0 PV deixa a criatura Caída, −PV máximo a derrota. */
export function causarDanoInvocacao(
  tokenId: string,
  dano: number,
  tipoDano?: DamageType,
  instanciaEsperadaId?: string,
  contexto: { tipoAlvo?: TipoAlvoDanoHorda; eventoId?: string } = {},
): { ok: true; hpRestante: number; destruida: boolean } | { ok: false; motivo: string } {
  const mapa = useMapStore.getState();
  const token = mapa.entities[tokenId];
  if (!token?.ownerCharId || !token.invocationId) return { ok: false, motivo: 'Token não pertence a uma invocação.' };
  const dono = useCharacterStore.getState().characters.find(c => c.id === token.ownerCharId);
  if (!dono) return { ok: false, motivo: 'Dono da invocação não encontrado.' };
  const modelo = obterModeloDoToken(dono, token);
  if (!modelo) return { ok: false, motivo: 'Modelo da invocação não encontrado.' };
  const atual = obterInstanciaDoToken(dono, token, modelo);
  if (instanciaEsperadaId && atual.id !== instanciaEsperadaId) {
    return { ok: false, motivo: 'A instância da invocação mudou antes da aplicação do dano.' };
  }
  if (contexto.eventoId !== undefined && !contexto.eventoId.trim()) return { ok: false, motivo: 'ID de dano inválido.' };
  if (atual.composicaoHorda && contexto.eventoId && atual.eventosDanoHordaProcessados?.includes(contexto.eventoId)) {
    return { ok: true, hpRestante: atual.hpAtual, destruida: atual.estado === 'derrotada' };
  }
  useCombatStore.getState().settleTurnTimer();
  const rdCaracteristica = reducaoDanoCaracteristicas(modelo, tipoDano);
  const rdAuxilio = (atual.efeitosSuporteAtivos ?? []).filter(efeito =>
    efeito.tipo === 'reducao_dano' && efeito.expiraNaRodada >= (useCombatStore.getState().round ?? 1) &&
    (!efeito.tiposDano?.length || (!!tipoDano && efeito.tiposDano.includes(tipoDano)))
  ).reduce((total, efeito) => total + efeito.valor, 0);
  const rdEfetiva = calcularReducaoDanoHorda({
    ehHorda: Boolean(token.invocationHordeId),
    tipoAlvo: contexto.tipoAlvo ?? 'unico',
    rdBase: rdCaracteristica + rdAuxilio,
    nivelDono: dono.level,
  });
  const danoFinal = Math.max(0, Math.floor(dano) - rdEfetiva);
  const pvTemporarios = Math.max(0, atual.pvTemporarios ?? 0);
  const absorvido = Math.min(pvTemporarios, danoFinal);
  const resultado = aplicarDanoPVInvocacao(atual, danoFinal - absorvido);
  if (!resultado.ok) return resultado;
  let instanciaComPerdaPendente = resultado.instancia;
  if (integracaoInvocacoes.resolverPerdaHorda && atual.composicaoHorda) {
    const perda = resolverPerdaMembrosHorda({ pvAntes: atual.hpAtual, pvDepois: resultado.instancia.hpAtual,
      pvMaximo: atual.hpMaximoAtual, membros: atual.composicaoHorda.membros, limiar: atual.limiarPerdaHorda });
    if (perda.removidos.length) {
      const escala = calcularEscalaHorda(perda.membros);
      const combate = useCombatStore.getState();
      const custoRemovido = perda.removidos.reduce((total, membro) => total + ({ quarto: 1, terceiro: 2, segundo: 3, primeiro: 0, especial: 0 })[membro.grau], 0);
      instanciaComPerdaPendente = InstanciaInvocacaoSchema.parse({ ...resultado.instancia,
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
    const perda = verificarPerdaMembrosHorda(atual.hpAtual, resultado.instancia.hpAtual, atual.hpMaximoAtual, atual.composicaoHorda.membros.length);
    if (perda.pendente && perda.quantidade > 0) {
      instanciaComPerdaPendente = InstanciaInvocacaoSchema.parse({
        ...resultado.instancia,
        perdaMembrosHordaPendente: {
          motivo: 'metade_pv', quantidade: perda.quantidade,
          pvAntes: atual.hpAtual, pvDepois: resultado.instancia.hpAtual, pvMaximo: atual.hpMaximoAtual,
          membrosIds: atual.composicaoHorda.membros.map(membro => membro.modeloId),
        },
      });
      metricas.perdasHordaPendentes++;
      useLogStore.getState().addLog('combat', `Horda atingiu metade dos PV: perda de ${perda.quantidade} membro(s) pendente de decisão do Mestre.`,
        'Remoção bloqueada: definir ajuste de PV, desempate, destino dos membros e repetição do limiar. Nenhum PV foi redistribuído.');
    }
  }
  const comTemporarios = InstanciaInvocacaoSchema.parse({ ...instanciaComPerdaPendente, pvTemporarios: pvTemporarios - absorvido,
    ...(atual.composicaoHorda && contexto.eventoId ? {
      eventosDanoHordaProcessados: [...(atual.eventosDanoHordaProcessados ?? []), contexto.eventoId],
    } : {}),
  });
  const instanciaAtualizada = comTemporarios.estado === 'derrotada'
    ? preservarContribuicaoNaDerrota(comTemporarios)
    : comTemporarios;
  gravarInstancia(dono, instanciaAtualizada);
  if (isTongueGrappleSource(modelo.subcategoria) && instanciaAtualizada.estado !== 'ativa') {
    releaseTongueGrapples(dono.id, instanciaAtualizada.id, modelo.subcategoria);
  }
  if (instanciaAtualizada.estado === 'derrotada') {
    mapa.removeEntities([tokenId]);
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
    invocationState: instanciaAtualizada.estado,
    invocationInstanceId: instanciaAtualizada.id,
  });
  return { ok: true, hpRestante: instanciaAtualizada.hpAtual, destruida: false };
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
  if (!podeComandarInvocacao(donoId)) return { ok: false, motivo: 'Só é possível comandar no turno do Controlador.' };
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

type ResultadoAlvoAtaqueInvocacao = {
  alvoId: string;
  nomeAlvo: string;
  acertou: boolean;
  totalAtaque: number;
  dano: number;
  critico?: boolean;
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

function montarTemplateAreaInvocacao(
  cfg: AcaoAtivaConfig,
  servo: Entity,
  dono: Character,
  nomeAcao: string,
): Promise<{ ok: true; template: MapTemplate } | { ok: false; motivo: string }> {
  const area = cfg.area;
  if (!area) return Promise.resolve({ ok: false, motivo: 'A ação OMNI não tem uma área configurada.' });
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
  cfg: AcaoAtivaConfig,
): boolean {
  const filtro = cfg.filtro_alvo ?? 'todos_exceto_si';
  // "Si" é o token do Shikigami, removido da geometria abaixo. O Controlador
  // continua sendo um alvo válido quando a área ou o filtro o incluem.
  if (filtro === 'todos' || filtro === 'todos_exceto_si') return true;
  return aceitaAlvoAtivo(dono, alvo, { ...cfg, filtro_alvo: filtro });
}

function resolverAlvosDaAreaInvocacao(
  cfg: AcaoAtivaConfig,
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
      !aceitaAlvoAtivo(dono, donoAlvo, { ...cfg, filtro_alvo: filtro })) continue;
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
  opcoes?: Pick<OpcoesComandoInvocacao, 'instanciaId' | 'requestId'>,
):
  Promise<ResultadoAtaqueUnicoInvocacao | ResultadoAtaqueMultiploInvocacao | { ok: false; motivo: string }> {
  return executarAtaqueInvocacao(donoId, invocacaoId, acaoId, alvoId, opcoes, 'manual');
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

export async function comandarSegurarSapo(
  donoId: string,
  invocacaoId: string,
  alvoId: string,
  opcoes?: { instanciaId?: string; requestId?: string; membrosSapoVivos?: number },
): Promise<{ ok: true; sucesso: boolean; aplicouCondicao: boolean; totalSapo: number; totalAlvo: number; nomeAlvo: string } | { ok: false; motivo: string }> {
  const dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
  const modelo = dono?.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
  if (!dono || !modelo || !isTongueGrappleSource(modelo.subcategoria)) {
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
  if (useCombatStore.getState().inCombat && !podeComandarInvocacao(donoId)) {
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
      return { ok: false, motivo: 'Shikigami-alvo ativo não encontrado.' };
    }
    donoInvocacaoAlvo = useCharacterStore.getState().characters.find(character => character.id === tokenAlvo!.ownerCharId);
    modeloInvocacaoAlvo = donoInvocacaoAlvo?.invocacoesConhecidas?.find(item => item.id === tokenAlvo!.invocationId);
    if (!donoInvocacaoAlvo || !modeloInvocacaoAlvo) return { ok: false, motivo: 'Ficha do Shikigami-alvo não encontrada.' };
    instanciaAlvo = obterInstanciaDoToken(donoInvocacaoAlvo, tokenAlvo, modeloInvocacaoAlvo);
    if (instanciaAlvo.estado !== 'ativa' || (tokenAlvo.invocationState && tokenAlvo.invocationState !== 'ativa')) {
      return { ok: false, motivo: 'Shikigami caído ou inativo não pode ser agarrado.' };
    }
    if ((instanciaAlvo.agarradoPorInvocacao?.length ?? 0) > 0) return { ok: false, motivo: 'Este Shikigami já está agarrado.' };
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

export type PericiaFugaSapo = 'Atletismo' | 'Acrobacia';
type ResultadoFugaSapo =
  | { ok: true; escapou: boolean; totalAlvo: number; totalSapo: number; pericia: PericiaFugaSapo }
  | { ok: false; motivo: string };

async function rolarFugaSapo(
  donoAlvo: Character,
  modeloAlvo?: InvocacaoControlador,
  pericia: PericiaFugaSapo = 'Atletismo',
  sapoDonoId?: string,
  sapoModelo?: InvocacaoControlador,
  sapoInstanciaId?: string,
): Promise<ResultadoFugaSapo> {
  const sapoDono = useCharacterStore.getState().characters.find(character => character.id === sapoDonoId);
  const instanciaSapo = sapoDono?.instanciasInvocacao?.find(instancia => instancia.id === sapoInstanciaId);
  const tokenSapoAtivo = Boolean(sapoDono && sapoModelo && sapoInstanciaId &&
    Object.values(useMapStore.getState().entities).some(token =>
      token.ownerCharId === sapoDonoId && token.invocationId === sapoModelo.id &&
      token.invocationInstanceId === sapoInstanciaId && (token.hp ?? 0) > 0 &&
      (!token.invocationState || token.invocationState === 'ativa'),
    ));
  if (!sapoDono || !sapoModelo || sapoModelo.subcategoria !== 'dez-sombras:sapo' ||
    !instanciaSapo || instanciaSapo.estado !== 'ativa' || !tokenSapoAtivo) {
    return { ok: false, motivo: 'A ficha do Sapo que mantém o agarrão não foi encontrada.' };
  }
  if (!turnoAtualDoPersonagem(donoAlvo.id)) return { ok: false, motivo: 'A fuga só pode ser tentada no início do turno do alvo.' };
  const bonusAlvo = modeloAlvo
    ? calcularBonusPericiaInvocacao(donoAlvo, modeloAlvo, pericia.toUpperCase())?.total ?? 0
    : bonusPericiaPersonagem(donoAlvo, pericia);
  const bonusSapo = calcularBonusPericiaInvocacao(sapoDono, sapoModelo, 'ATLETISMO')?.total ?? 0;
  const d20Alvo = await rollD20Autonomo(bonusAlvo, { label: pericia + ': escapar do Sapo' });
  const d20Sapo = await rollD20Autonomo(bonusSapo, { label: 'Atletismo do Sapo: manter Agarrado' });
  const totalAlvo = d20Alvo + bonusAlvo;
  const totalSapo = d20Sapo + bonusSapo;
  return { ok: true, escapou: totalAlvo > totalSapo, totalAlvo, totalSapo, pericia };
}

export async function escaparAgarradoPorInvocacao(
  donoAlvoId: string,
  conditionId: string,
  pericia: PericiaFugaSapo,
): Promise<ResultadoFugaSapo> {
  const alvo = useCharacterStore.getState().characters.find(character => character.id === donoAlvoId);
  const condicao = alvo?.activeConditions?.find(condition => condition.id === conditionId &&
    condition.conditionId === 'agarrado' && isTongueGrappleSource(condition.sourceEntityId));
  if (!alvo || !condicao?.sourceCharId || !condicao.sourceInstanceId) {
    return { ok: false, motivo: 'Agarrão do Sapo não encontrado nesta ficha.' };
  }
  if (condicao.sourceEntityId === 'dez-sombras:abismo-desconhecido-do-poco') {
    return { ok: false, motivo: 'O teste e o custo da fuga do Abismo não estão definidos; resolva manualmente.' };
  }
  const donoSapo = useCharacterStore.getState().characters.find(character => character.id === condicao.sourceCharId);
  const modeloSapo = donoSapo?.invocacoesConhecidas?.find(modelo => modelo.id ===
    donoSapo.instanciasInvocacao?.find(instancia => instancia.id === condicao.sourceInstanceId)?.modeloId);
  if (!donoSapo || !modeloSapo) return { ok: false, motivo: 'A fonte do agarrão não foi encontrada.' };
  if (modeloSapo.subcategoria === 'dez-sombras:abismo-desconhecido-do-poco') {
    return { ok: false, motivo: 'O teste e o custo da fuga do Abismo não estão definidos; resolva manualmente.' };
  }
  const resultado = await rolarFugaSapo(alvo, undefined, pericia, donoSapo.id, modeloSapo, condicao.sourceInstanceId);
  if (resultado.ok && resultado.escapou) {
    useCharacterStore.getState().removeCondition(donoAlvoId, conditionId);
    const grapplerId = 'invocacao-sapo:' + condicao.sourceInstanceId;
    const grappledBy = (alvo.grappleState?.grappledBy ?? []).filter(id => id !== grapplerId);
    useCharacterStore.getState().updateCharacter(donoAlvoId, {
      grappleState: { ...alvo.grappleState, grappledBy },
    });
  }
  if (resultado.ok) useLogStore.getState().addLog('combat',
    alvo.name + ' tenta escapar do Sapo com ' + pericia + ': ' + resultado.totalAlvo +
    ' vs Atletismo ' + resultado.totalSapo + (resultado.escapou ? ' — escapou.' : ' — permanece Agarrado.'));
  return resultado;
}

export async function escaparInvocacaoAgarrada(
  donoAlvoId: string,
  instanciaAlvoId: string,
  pericia: PericiaFugaSapo,
): Promise<ResultadoFugaSapo> {
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
    return { ok: false, motivo: 'O teste e o custo da fuga do Abismo não estão definidos; resolva manualmente.' };
  }
  const resultado = await rolarFugaSapo(donoAlvo, modeloAlvo, pericia, donoSapo.id, modeloSapo, vinculo.instanciaId);
  if (resultado.ok && resultado.escapou && donoAlvo && instanciaAlvo) {
    const atualizada = InstanciaInvocacaoSchema.parse({
      ...instanciaAlvo,
      version: instanciaAlvo.version + 1,
      agarradoPorInvocacao: (instanciaAlvo.agarradoPorInvocacao ?? []).filter(link =>
        link.donoId !== vinculo.donoId || link.instanciaId !== vinculo.instanciaId),
    });
    gravarInstancia(donoAlvo, atualizada);
  }
  if (resultado.ok) useLogStore.getState().addLog('combat',
    modeloAlvo.nome + ' tenta escapar do Sapo com ' + pericia + ': ' + resultado.totalAlvo +
    ' vs Atletismo ' + resultado.totalSapo + (resultado.escapou ? ' — escapou.' : ' — permanece Agarrado.'));
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
  if (modoExecucao !== 'reacao' && !podeComandarInvocacao(donoId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };
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
  const areaConfigurada = resolucaoOmni?.ok && resolucaoOmni.config.tipo_alvo === 'area';
  if (selecaoArea && !areaConfigurada) return { ok: false, motivo: 'Esta ação OMNI não está configurada para selecionar uma área.' };
  if (!selecaoArea && areaConfigurada) return { ok: false, motivo: 'Esta ação precisa selecionar uma área no mapa.' };
  const erroAcao = validarAcaoAtaqueInvocacao(acao);
  if (erroAcao) return { ok: false, motivo: erroAcao };
  let tipoTeste = acao.teste ?? (acao.tipo === 'ataque' ? 'ataque' : undefined);
  let mapa = useMapStore.getState();
  let servo = tokensInvocados(donoId).find(e => e.invocationId === invocacaoId && (!opcoes?.instanciaId || e.invocationInstanceId === opcoes.instanciaId) && (e.hp ?? 0) > 0);
  if (!servo || (selecaoArea && (servo.hidden || mapa.layerVisible[servo.layer ?? 'tokens'] === false))) {
    return { ok: false, motivo: 'Servo ou alvo ausente do mapa.' };
  }
  if (modoExecucao === 'reacao' && (servo.hidden || mapa.layerVisible[servo.layer ?? 'tokens'] === false)) {
    return { ok: false, motivo: 'A invocação reativa está oculta ou fora de uma camada visível.' };
  }
  let idsAlvo: string[];
  let resultadoEmLista = Array.isArray(alvoId) || selecaoArea;
  if (selecaoArea && resolucaoOmni?.ok) {
    const resolucaoInicial = resolucaoOmni;
    const areaPosicionada = await montarTemplateAreaInvocacao(resolucaoInicial.config, servo, dono, acao.nome);
    if (!areaPosicionada.ok) return areaPosicionada;

    // Releia a mesa depois da colocação: alvo, posição, filtros e custo podem
    // ter mudado enquanto o jogador escolhia o ponto no mapa.
    dono = useCharacterStore.getState().characters.find(character => character.id === donoId);
    if (!dono || !podeComandarInvocacao(donoId)) return { ok: false, motivo: 'O turno do Controlador terminou durante a seleção da área.' };
    inv = dono.invocacoesConhecidas?.find(item => item.id === invocacaoId && item.donoCharacterId === donoId);
    acaoOriginal = inv?.acoes.find(item => item.id === acaoId);
    if (!inv || !acaoOriginal) return { ok: false, motivo: 'Ação ou invocação removida durante a seleção da área.' };
    resolucaoOmni = acaoOriginal.tipoExecucao === 'omni' || acaoOriginal.tipoExecucao === 'referencia_omni'
      ? resolverAcaoOmniInvocacao(acaoOriginal, useOmniEntidadesStore.getState().entidades)
      : undefined;
    if (resolucaoOmni && !resolucaoOmni.ok) return { ok: false, motivo: resolucaoOmni.motivo };
    if (!resolucaoOmni?.ok || resolucaoOmni.config.tipo_alvo !== 'area' ||
      JSON.stringify(resolucaoInicial.config.area) !== JSON.stringify(resolucaoOmni.config.area)) {
      return { ok: false, motivo: 'A configuração da área mudou durante a seleção. Tente a ação novamente.' };
    }
    acao = resolucaoOmni.acao;
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
    const forma = resolucaoOmni.config.area?.forma;
    if ((forma === 'cone' || forma === 'linha' || forma === 'raio_em_si') &&
      (Math.hypot(areaPosicionada.template.x - (servo.x + servo.w / 2), areaPosicionada.template.y - (servo.y + servo.h / 2)) > 1e-6)) {
      return { ok: false, motivo: 'A invocação mudou de posição durante a seleção da área. Tente novamente.' };
    }
    const areaAtual = resolucaoOmni.config.area!;
    const pixelsPorMetro = (mapa.gridConfig.dpi || 70) / (mapa.gridConfig.metersPerCell || 1.5);
    if (!Number.isFinite(pixelsPorMetro) || pixelsPorMetro <= 0) return { ok: false, motivo: 'Grade inválida para resolver a área.' };
    const comprimentoArea = areaAtual.tamanho_m * pixelsPorMetro;
    const templateAtual: MapTemplate = {
      ...areaPosicionada.template,
      length: comprimentoArea,
      width: areaAtual.forma === 'linha' ? (areaAtual.largura_m ?? 1.5) * pixelsPorMetro : comprimentoArea,
    };
    const alvosArea = resolverAlvosDaAreaInvocacao(resolucaoOmni.config, dono, servo, templateAtual);
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
  const rodadaAtual = useCombatStore.getState().round ?? 1;
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
  const categoria = categoriaEconomiaDaAcao(acao, instancia.economiaAcoes);
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
      mapa.layerVisible[token.layer ?? 'tokens'] === false || (!selecaoArea && token.id === servo.id)) return null;
    const donoAlvo = personagens.find(character => character.id === token.ownerCharId);
    const modeloAlvo = donoAlvo?.invocacoesConhecidas?.find(item => item.id === token.invocationId);
    if (!donoAlvo || !modeloAlvo) return null;
    const instanciaAlvo = obterInstanciaDoToken(donoAlvo, token, modeloAlvo);
    if (instanciaAlvo.estado === 'derrotada' || instanciaAlvo.estado === 'dissipada') return null;
    const defesaBase = Number.isFinite(token.invocationDefense)
      ? token.invocationDefense!
      : modeloAlvo.defesa;
    const defesa = Math.max(0, defesaBase - ((instanciaAlvo.agarradoPorInvocacao?.length ?? 0) > 0 ? 3 : 0));
    if (!Number.isFinite(defesa) || defesa < 0) return null;
    const bonusResistenciaBase = tipoTeste === 'resistencia'
      ? calcularBonusResistenciaInvocacao(donoAlvo, modeloAlvo, acao.resistenciaAlvo!)
      : undefined;
    const agarrado = (instanciaAlvo.agarradoPorInvocacao?.length ?? 0) > 0;
    const penalidadeReflexos = agarrado && acao.resistenciaAlvo?.trim().toLocaleLowerCase('pt-BR') === 'reflexos' ? 3 : 0;
    const bonusResistencia = bonusResistenciaBase && penalidadeReflexos > 0
      ? {
        ...bonusResistenciaBase,
        total: bonusResistenciaBase.total - penalidadeReflexos,
        breakdown: bonusResistenciaBase.breakdown + ' · Agarrado -' + penalidadeReflexos + ' Reflexos',
      }
      : bonusResistenciaBase;
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
  const escala = mapa.gridConfig.metersPerCell / mapa.gridConfig.dpi;
  if (!(escala > 0)) return { ok: false, motivo: 'Grade inválida.' };
  const alvosValidados = alvos.filter((alvo): alvo is NonNullable<typeof alvo> => alvo !== null).map(alvo => {
    const distancia = Math.hypot((servo.x + servo.w / 2) - (alvo.token.x + alvo.token.w / 2),
      (servo.y + servo.h / 2) - (alvo.token.y + alvo.token.h / 2)) * escala;
    return { ...alvo, distancia, defesa: computeTotalDefense(alvo.personagem, {}, tipoTeste === 'ataque' && acao.tipoAtaque === 'distancia' ? 'ranged' : 'melee') };
  });
  const alvosInvocacaoComDistancia = alvosInvocacaoValidados.map(alvo => ({
    ...alvo,
    distancia: Math.hypot((servo.x + servo.w / 2) - (alvo.token.x + alvo.token.w / 2),
      (servo.y + servo.h / 2) - (alvo.token.y + alvo.token.h / 2)) * escala,
  }));
  if (alvosValidados.length + alvosInvocacaoValidados.length !== idsAlvo.length) return { ok: false, motivo: 'Alvo inválido.' };
  if (!selecaoArea && alvosValidados.some(alvo => alvo.distancia > (acao.alcanceM ?? 1.5) + 1e-6)) return { ok: false, motivo: 'Um ou mais alvos estão fora do alcance.' };
  if (!selecaoArea && alvosInvocacaoComDistancia.some(alvo => alvo.distancia > (acao.alcanceM ?? 1.5) + 1e-6)) return { ok: false, motivo: 'Uma ou mais invocações estão fora do alcance.' };
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
  const movimentoInvestida = instancia.investidaPerfuranteTurno;
  const bonusDadosInvestida = modelo.subcategoria === 'dez-sombras:touro-perfurante' &&
    acaoId === 'investida-perfurante' && movimentoInvestida?.rodada === rodadaAtaque &&
    movimentoInvestida.turnoIndex === estadoTurnoAtaque.currentTurnIndex &&
    Boolean(movimentoInvestida.combateId) &&
    movimentoInvestida.combateId === estadoTurnoAtaque.combatId
    ? dadosAdicionaisInvestidaPerfurante(movimentoInvestida.distanciaM)
    : 0;
  let formulaBase = acao.dano ? parseFormulaDanoInvocacao(acao.dano) : null;
  if (formulaBase && bonusDadosInvestida > 0) {
    const dados = [...formulaBase.dados, { count: bonusDadosInvestida, sides: 10 }];
    acao = {
      ...acao,
      dano: `${formatDamage(dados)}${formulaBase.fixo ? `+${formulaBase.fixo}` : ''}`,
    };
    formulaBase = { ...formulaBase, dados };
  }
  const formula = formulaBase && escalaHorda.niveisAtaqueCura > 0
    ? { ...formulaBase, dados: stepDamage(formulaBase.dados, escalaHorda.niveisAtaqueCura) }
    : formulaBase;
  if (formula && escalaHorda.niveisAtaqueCura > 0) {
    acao = { ...acao, dano: `${formatDamage(formula.dados)}${formula.fixo ? `+${formula.fixo}` : ''}` };
    metricas.escalas.ataque++;
  }
  if (tipoTeste === 'ataque' && !formula) return { ok: false, motivo: 'Dano inválido; use dados como 2d12+1d6+3.' };
  if (tipoTeste === 'resistencia' && acao.dano && !formula) return { ok: false, motivo: 'Dano inválido; use dados como 2d12+1d6+3.' };
  const bonusAtaqueBase = tipoTeste === 'ataque' ? calcularBonusAtaqueInvocacao(dono, modelo, acao) : null;
  const ataquesAnteriores = instancia.usosAtaqueTurno?.rodada === rodadaAtaque ? instancia.usosAtaqueTurno.total : 0;
  const prejuizoAtaque = integracaoInvocacoes.escalaHorda && instancia.composicaoHorda
    ? 3 * calcularPrejuizoRepeticaoHorda(ataquesAnteriores, instancia.composicaoHorda.membros) : 0;
  const bonusAtaque = bonusAtaqueBase
    ? { ...bonusAtaqueBase, total: bonusAtaqueBase.total + bonusAcertoAuxilio - prejuizoAtaque }
    : null;
  if (tipoTeste === 'ataque' && (!bonusAtaque || !Number.isFinite(bonusAtaque.total))) {
    return { ok: false, motivo: 'Defina um atributo de ataque válido na ficha do Shikigami.' };
  }
  if (acao.margemCritico !== undefined && (!Number.isInteger(acao.margemCritico) || acao.margemCritico < 2 || acao.margemCritico > 20)) {
    return { ok: false, motivo: 'Margem de crítico precisa estar entre 2 e 20.' };
  }
  const cd = tipoTeste === 'resistencia' ? calcularCDInvocacao(dono, modelo, acao.atributoCD) : null;
  if (tipoTeste === 'resistencia' && cd === null) return { ok: false, motivo: 'Defina o atributo usado para calcular a CD da ação.' };
  const gasto = gastarAcaoDaInstancia(instancia, categoria, 1, opcoes?.requestId);
  if (!gasto.ok) return gasto;
  const comRecursosDebitados = { ...gasto.instancia, recursosAtuais: debito.recursosRestantes,
    ...(tipoTeste === 'ataque' ? { usosAtaqueTurno: { rodada: rodadaAtaque, total: ataquesAnteriores + 1 } } : {}),
    ...(modelo.subcategoria === 'dez-sombras:touro-perfurante' && acaoId === 'investida-perfurante'
      ? { investidaPerfuranteTurno: undefined }
      : {}),
  };
  const comRecarga = registrarRecargaDaAcao(comRecursosDebitados, acao);
  gravarInstancia(dono, comRecarga, { peCurrent: debito.peDonoRestante });
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
          note: `${alvo.nome} (Shikigami) — ${modelo.nome}: ${acao.nome}`,
          bonusOverride: alvo.bonusResistencia!.total,
          bonusBreakdownOverride: alvo.bonusResistencia!.breakdown,
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
        token: alvo.token,
        instanciaId: alvo.instancia.id,
      })),
    ];
    for (const alvo of alvosParaAtaque) {
      const { defesa } = alvo;
      // Alcateia é uma habilidade manual que requer decisão explícita do Mestre
      // Nenhum bônus de Alcateia é aplicado automaticamente aqui
      const bonusAtaqueAlvo = bonusAtaque!.total;
      const d20Inicial = await rollD20Autonomo(bonusAtaqueAlvo, { label: 'Ataque de ' + modelo.nome + ': ' + acao.nome });
      const atacanteAgarrado = (instancia.agarradoPorInvocacao?.length ?? 0) > 0;
      const d20Alternativo = atacanteAgarrado
        ? await rollD20Autonomo(bonusAtaqueAlvo, { label: 'Desvantagem por Agarrado: ' + modelo.nome })
        : undefined;
      const natural = d20Alternativo === undefined ? d20Inicial : Math.min(d20Inicial, d20Alternativo);
      const resultado = resolverAcertoInvocacao(natural, bonusAtaqueAlvo, defesa, acao.margemCritico ?? 20);
      if (!resultado.acertou) {
        useLogStore.getState().addLog('combat', `🎯 ${modelo.nome} — ${acao.nome} contra ${alvo.nome}: d20 ${natural} + ${bonusAtaqueAlvo} = ${resultado.total} vs Defesa ${defesa} (${resultado.falhaCritica ? 'falha crítica' : 'erro'}).`);
        resultados.push({ alvoId: alvo.alvoId, nomeAlvo: alvo.nome, acertou: false, totalAtaque: resultado.total, dano: 0 });
        continue;
      }
      const dadosDano = resultado.critico
        ? multiplicarDadosCriticos(formula!.dados, acao.multiplicadorCritico ?? 2)
        : formula!.dados;
      const rolagem = await rollDiceGroups(dadosDano, { label: `Dano de ${modelo.nome}: ${acao.nome}` });
      let bonusDanoAuxilio = 0;
      const detalhesDanoAuxilio: string[] = [];
      for (const { efeito, formula: formulaAuxilio } of formulasDanoAdicional) {
        if (!formulaAuxilio) continue;
        const rolagemAuxilio = await rollDiceGroups(formulaAuxilio.dados, { label: `${modelo.nome}: auxílio de dano` });
        bonusDanoAuxilio += rolagemAuxilio.total + formulaAuxilio.fixo;
        detalhesDanoAuxilio.push(`${efeito.formula} = ${rolagemAuxilio.total + formulaAuxilio.fixo}`);
      }
      const dano = Math.max(0, rolagem.total + formula!.fixo + calcularBonusDanoInvocacao(modelo, acao, 'ataque') + bonusDanoAuxilio);
      if (alvo.tipo === 'invocacao') {
        const aplicado = causarDanoInvocacao(alvo.token.id, dano, acao.tipoDano ?? 'DCO', alvo.instanciaId, {
          tipoAlvo: selecaoArea ? 'area' : 'unico',
          ...(opcoes?.requestId ? { eventoId: `${opcoes.requestId}:${alvo.alvoId}` } : {}),
        });
        if (!aplicado.ok) throw new Error(aplicado.motivo);
      } else {
        await useCharacterStore.getState().applyDamage(alvo.personagem.id, dano, acao.tipoDano ?? 'DCO', {
          attackerId: donoId,
          source: 'omni',
          isMelee: bonusAtaque!.tipo === 'corpo_a_corpo',
          attack: { critical: resultado.critico, criticalFail: resultado.falhaCritica, kind: bonusAtaque!.tipo === 'corpo_a_corpo' ? 'melee' : 'ranged' },
          ...(opcoes?.cadeia ? { cadeia: opcoes.cadeia } : {}),
        });
      }
      useLogStore.getState().addLog('combat', `🎯 ${modelo.nome} — ${acao.nome} contra ${alvo.nome}: d20 ${natural} + ${bonusAtaqueAlvo} = ${resultado.total} vs Defesa ${defesa} → ${resultado.critico ? 'acerto crítico' : 'acerto'}, dano ${dano} (${acao.tipoDano ?? 'DCO'})${detalhesDanoAuxilio.length ? `; auxílio extra ${detalhesDanoAuxilio.join(', ')}` : ''}.`);
      resultados.push({ alvoId: alvo.alvoId, nomeAlvo: alvo.nome, acertou: true, totalAtaque: resultado.total, dano, ...(resultado.critico ? { critico: true } : {}) });
    }
    consumirAuxiliosDeAtaque();
    return resultadoEmLista
      ? { ok: true, resultados }
      : {
        ok: true,
        acertou: resultados[0].acertou,
        totalAtaque: resultados[0].totalAtaque,
        dano: resultados[0].dano,
        ...(resultados[0].critico ? { critico: true } : {}),
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
  if (!podeComandarInvocacao(donoId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };
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
  if (!acao.permiteInimigos && alvos.some(alvo => alvo.personagem.category === 'INIMIGO' && alvo.personagem.id !== donoId)) {
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
    for (const alvo of alvos) {
      if (calculado.efeito.tipo === 'cura') {
        if (alvo.tipo === 'personagem') {
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
      case 'cura': nomeEfeito = curaReal ? 'cura real' : 'Pontos de Vida Temporários'; break;
      case 'defesa': nomeEfeito = 'Defesa'; break;
      case 'acerto': nomeEfeito = 'Acerto'; break;
      case 'dano_adicional': nomeEfeito = `dano adicional ${formula}`; break;
      case 'reducao_dano': nomeEfeito = `RD ${calculado.efeito.valor} contra ${calculado.efeito.tiposDano.join(', ')}`; break;
    }
    useLogStore.getState().addLog('combat', `🛟 ${modelo.nome} — ${acao.nome}: ${nomeEfeito}${calculado.efeito.tipo === 'cura' || calculado.efeito.tipo === 'defesa' || calculado.efeito.tipo === 'acerto' || calculado.efeito.tipo === 'reducao_dano' ? ` ${valor}` : ''} em ${alvos.map(alvo => alvo.nome).join(', ')}${formula && calculado.efeito.tipo === 'cura' ? ` (${formula})` : ''}.`);
    return { ok: true, efeito: nomeEfeito, valor, alvos: alvos.length, ...(calculado.efeito.tipo === 'cura' ? { curaReal } : {}), ...(formula ? { formula } : {}) };
  } catch {
    return { ok: false, motivo: 'Falha ao resolver suporte; confira o log de combate.' };
  } finally {
    suportesPendentes.delete(chave);
  }
}

/** Teste de perícia feito pelo Shikigami: usa a ficha da própria invocação e
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
  if (!token) return { ok: false, motivo: 'O Shikigami precisa estar ativo no mapa para fazer o teste.' };
  if (useCombatStore.getState().inCombat && !podeComandarInvocacao(donoId)) return { ok: false, motivo: 'O teste só pode ser rolado no turno do dono durante o combate.' };
  const bonus = calcularBonusPericiaInvocacao(dono, modelo, pericia);
  if (!bonus) return { ok: false, motivo: 'Defina Inteligência ou Sabedoria como atributo-base das perícias na ficha.' };
  if (!invocacaoTreinadaNaPericia(modelo, pericia) && bonusPericiaCaracteristicas(modelo, pericia) <= 0) {
    return { ok: false, motivo: 'O Shikigami precisa ser treinado nessa perícia ou ter uma característica que conceda o teste.' };
  }
  const nomePericia = ROTULOS_PERICIAS[pericia as keyof typeof ROTULOS_PERICIAS] ?? pericia;
  const d20 = await rollD20Autonomo(bonus.total, { label: `${nomePericia} — ${modelo.nome}` });
  const total = d20 + bonus.total;
  useLogStore.getState().addLog('combat', `🎲 ${modelo.nome} — ${nomePericia}: d20 ${d20} + ${bonus.total} = ${total}${bonus.treinada ? ' (treinada)' : ''}.`);
  return { ok: true, d20, bonus: bonus.total, total, treinada: bonus.treinada };
}
