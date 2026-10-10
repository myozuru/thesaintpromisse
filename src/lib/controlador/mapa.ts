import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore, type Entity } from '@/stores/useMapStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { validarIntermediarioInvocacao } from './intermediario';
import { useCombatStore } from '@/stores/useCombatStore';
import { limiteAtivasPersonagem, type InvocacaoControlador } from './tipos';
import { useLogStore } from '@/stores/useLogStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { podeUsarVersaoAprovada } from '@/lib/controlador/aprovacao';
import { computeTotalDefense } from '@/lib/defenseCalc';
import { rollD20Autonomo, rollDiceGroups } from '@/lib/dice';
import { SISTEMA_PERICIAS, ROTULOS_PERICIAS } from '@/lib/omni/constantesDoSistema';
import { WallsEngine } from '@/components/mapa/WallsEngine';
import { prepareCollisionCache, resolveCollisionMove, tokenFootprintSegments, type MapCollisionToken } from '@/lib/mapCollision';
import { buildSegments as buildFogSegments } from '@/lib/fog/visibility';
import { useFogStore } from '@/stores/fogStore';
import { isFreeformFor } from '@/lib/freeformMode';
import { DEFAULT_SAVING_THROWS, type Character } from '@/types';
import { InstanciaInvocacaoSchema, type InstanciaInvocacao } from '@/lib/invocacoes/schema';
import {
  aplicarCuraPVInvocacao,
  aplicarDanoPVInvocacao,
  levantarInstanciaInvocacao,
  novaInstanciaInvocacao,
  estadoPorPVInvocacao,
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
  calcularBonusPericiaInvocacao,
  calcularBonusDanoInvocacao,
  calcularCDInvocacao,
  invocacaoTreinadaNaPericia,
  multiplicarDadosCriticos,
  parseFormulaDanoInvocacao,
  resolverAcertoInvocacao,
} from './rolagens';

export type DirecaoInvocacao = 'norte' | 'sul' | 'leste' | 'oeste';
export type ResultadoInvocacao = { ok: true; tokenId: string } | { ok: false; motivo: string };
export type PosicaoInvocacao = { invocacaoId: string; x: number; y: number };
export type ResultadoLoteInvocacoes = { ok: true; tokenIds: string[] } | { ok: false; motivo: string };

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
  const hpCatalogo = Math.max(0, Math.min(instancia.hpMaximoAtual, instancia.hpAtual));
  useCharacterStore.getState().updateCharacter(personagem.id, {
    instanciasInvocacao: instanciasComAtualizada(personagem, instancia),
    invocacoesConhecidas: (personagem.invocacoesConhecidas ?? []).map(modelo => modelo.id === instancia.modeloId
      ? { ...modelo, hpAtual: hpCatalogo }
      : modelo),
    ...extras,
  });
}

function prepararDebitoComando(
  dono: Character,
  modelo: InvocacaoControlador,
  instancia: InstanciaInvocacao,
  acao: InvocacaoControlador['acoes'][number],
): { ok: true; peDonoRestante: number; recursosRestantes: Record<string, number> } | { ok: false; motivo: string } {
  const custo = acao.custoPE ?? 0;
  const configuracao = modelo.custosComandosConfigurados?.[acao.id];
  if (configuracao?.execucao === 'evento_automatico') {
    return { ok: false, motivo: 'Esta ação está configurada para execução por evento automático.' };
  }
  if (custo > 0 && !configuracao) {
    return { ok: false, motivo: 'A origem do custo de PE desta ação ainda precisa ser configurada.' };
  }

  let peDono = 0;
  let peInvocacao = 0;
  const recursosRestantes = { ...instancia.recursosAtuais };
  for (const debito of configuracao?.debitos ?? []) {
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
  if (!podeUsarVersaoAprovada({ estado: modelo.aprovacaoMestre, versaoAtual: modelo.versaoModelo, versaoAprovada: modelo.versaoAprovada })) return { ok: false, motivo: 'Esta versão da invocação ainda não foi aprovada pelo Mestre.' };
  const validacaoIntermediario = validarIntermediarioInvocacao(modelo, dono, useInventoryStore.getState().items, dono.invocacoesConhecidas ?? []);
  const motivoOverride = opcoes?.motivoOverrideIntermediario?.trim() ?? '';
  const overrideIntermediario = !validacaoIntermediario.ok && Boolean(motivoOverride);
  if (!validacaoIntermediario.ok && !motivoOverride) return { ok: false, motivo: validacaoIntermediario.motivo };
  if (overrideIntermediario && useRoleStore.getState().role !== 'MASTER') return { ok: false, motivo: 'Somente o Mestre pode ignorar a validação do intermediário.' };
  if (modelo.hpAtual <= 0) return { ok: false, motivo: 'A invocação precisa ter PV para ser materializada.' };
  const tempoAdicional = tempoAdicionalEmSegundos(modelo.tempoAdicional);
  if (!tempoAdicional.ok) return { ok: false, motivo: tempoAdicional.motivo };

  const ativos = tokensInvocados(donoId);
  if (ativos.some(e => e.invocationId === invocacaoId)) return { ok: false, motivo: 'Essa invocação já está no mapa.' };
  if (ativos.length >= limiteAtivasPersonagem(dono.specialization, dono.treinoControle ?? 0)) return { ok: false, motivo: 'Limite de invocações ativas atingido.' };
  if (!Number.isFinite(modelo.custoInvocacaoPE) || modelo.custoInvocacaoPE < 0) return { ok: false, motivo: 'Custo de PE inválido.' };
  if ((dono.peCurrent ?? 0) < modelo.custoInvocacaoPE) return { ok: false, motivo: 'PE insuficiente.' };
  const origem = Object.values(mapa.entities).find(e => e.characterId === donoId && !e.invocationId);
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
  const alcance = modelo.alcanceInvocacaoM;
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
      shape: modelo.formaToken ?? 'ELLIPSE', x, y, w: passo, h: passo, rotation: 0,
      color: modelo.corIdentificacao ?? '#8055bd',
      label: modelo.apelido?.trim() || modelo.nome, locked: false, layer: 'tokens',
      nameplate: modelo.nomeplate ?? true,
      ...(modelo.imagemAssetId ? { assetId: modelo.imagemAssetId } : modelo.imagemFallbackAssetId ? { assetId: modelo.imagemFallbackAssetId } : {}),
      ...(modelo.imagemFallbackAssetId ? { invocationFallbackAssetId: modelo.imagemFallbackAssetId } : {}),
      ...(modelo.tokenCrop ? { tokenCrop: modelo.tokenCrop as import('@/stores/useMapStore').TokenCrop } : {}),
      hp: modelo.hpAtual, hpMax: modelo.hpMaximo, ownerCharId: donoId,
      ownerProfileId: dono.profileId || undefined, invocationId: modelo.id,
      invocationEventId: eventoId, invocationInstanceId: instanciaId,
      invocationState: 'ativa',
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
    if (!podeUsarVersaoAprovada({ estado: modelo.aprovacaoMestre, versaoAtual: modelo.versaoModelo, versaoAprovada: modelo.versaoAprovada })) {
      return { ok: false, motivo: 'A invocação ' + modelo.nome + ' ainda não foi aprovada pelo Mestre.' };
    }
    const validacao = validarIntermediarioInvocacao(modelo, dono, useInventoryStore.getState().items, dono.invocacoesConhecidas ?? []);
    const motivo = opcoes?.motivosOverrideIntermediario?.[modelo.id]?.trim() ?? '';
    const override = !validacao.ok && Boolean(motivo);
    if (!validacao.ok && !motivo) return { ok: false, motivo: validacao.motivo };
    if (override && useRoleStore.getState().role !== 'MASTER') return { ok: false, motivo: 'Somente o Mestre pode ignorar a validação do intermediário.' };
    if (modelo.hpAtual <= 0) return { ok: false, motivo: 'A invocação ' + modelo.nome + ' precisa ter PV para ser materializada.' };
    const tempoAdicional = tempoAdicionalEmSegundos(modelo.tempoAdicional);
    if (!tempoAdicional.ok) return { ok: false, motivo: modelo.nome + ': ' + tempoAdicional.motivo };
    const alcance = modelo.alcanceInvocacaoM;
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

  const origem = Object.values(mapa.entities).find(entity => entity.characterId === donoId && !entity.invocationId);
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
    if (distanciaM > modelo.alcanceInvocacaoM!) return { ok: false, motivo: 'A posição de ' + modelo.nome + ' está fora do alcance definido na ficha.' };
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
        shape: modelo.formaToken ?? 'ELLIPSE', x, y, w: passo, h: passo, rotation: 0,
        color: modelo.corIdentificacao ?? '#8055bd',
        label: modelo.apelido?.trim() || modelo.nome, locked: false, layer: 'tokens',
        nameplate: modelo.nomeplate ?? true,
        ...(modelo.imagemAssetId ? { assetId: modelo.imagemAssetId } : modelo.imagemFallbackAssetId ? { assetId: modelo.imagemFallbackAssetId } : {}),
        ...(modelo.imagemFallbackAssetId ? { invocationFallbackAssetId: modelo.imagemFallbackAssetId } : {}),
        ...(modelo.tokenCrop ? { tokenCrop: modelo.tokenCrop as import('@/stores/useMapStore').TokenCrop } : {}),
        hp: modelo.hpAtual, hpMax: modelo.hpMaximo, ownerCharId: donoId,
        ownerProfileId: dono.profileId || undefined, invocationId: modelo.id,
        invocationEventId: eventoDaInstancia, invocationBatchId: eventoId, invocationInstanceId: instanciaId,
        invocationState: 'ativa',
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
  const modelo = obterModeloDoToken(dono, token);
  if (!modelo) return false;
  const instancia = obterInstanciaDoToken(dono, token, modelo);
  if (instancia.estado === 'derrotada') return false;
  const tempo = useCombatStore.getState().removeInvocationTimeReservation(donoId, instancia.id);
  const donoAtual = useCharacterStore.getState().characters.find(c => c.id === donoId);
  const instanciaAtual = donoAtual?.instanciasInvocacao?.find(item => item.id === instancia.id) ?? instancia;
  const dissipada = InstanciaInvocacaoSchema.parse({
    ...instanciaAtual,
    version: instanciaAtual.version + 1,
    estado: 'dissipada',
  });
  gravarInstancia(donoAtual ?? dono, dissipada);
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
export function causarDanoInvocacao(tokenId: string, dano: number): { ok: true; hpRestante: number; destruida: boolean } | { ok: false; motivo: string } {
  const mapa = useMapStore.getState();
  const token = mapa.entities[tokenId];
  if (!token?.ownerCharId || !token.invocationId) return { ok: false, motivo: 'Token não pertence a uma invocação.' };
  useCombatStore.getState().settleTurnTimer();
  const dono = useCharacterStore.getState().characters.find(c => c.id === token.ownerCharId);
  if (!dono) return { ok: false, motivo: 'Dono da invocação não encontrado.' };
  const modelo = obterModeloDoToken(dono, token);
  if (!modelo) return { ok: false, motivo: 'Modelo da invocação não encontrado.' };
  const atual = obterInstanciaDoToken(dono, token, modelo);
  const resultado = aplicarDanoPVInvocacao(atual, dano);
  if (!resultado.ok) return resultado;
  const instanciaAtualizada = resultado.instancia.estado === 'derrotada'
    ? preservarContribuicaoNaDerrota(resultado.instancia)
    : resultado.instancia;
  gravarInstancia(dono, instanciaAtualizada);
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
    invocationState: instanciaAtualizada.estado,
    invocationInstanceId: instanciaAtualizada.id,
  });
  return { ok: true, hpRestante: instanciaAtualizada.hpAtual, destruida: false };
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
  gravarInstancia(dono, resultado.instancia);
  mapa.updateEntity(tokenId, {
    hp: resultado.instancia.hpAtual,
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

/** Ataque de servo comandado no turno do Controlador. O alvo utiliza uma ficha
 * real, portanto o dano percorre applyDamage (reações, RD e demais regras).
 */
export async function comandarAtaque(
  donoId: string,
  invocacaoId: string,
  acaoId: string,
  alvoId: string,
  opcoes?: { instanciaId?: string; requestId?: string },
):
  Promise<{ ok: true; acertou: boolean; totalAtaque: number; dano: number; critico?: boolean; testePendente?: boolean; requestId?: string; cd?: number } | { ok: false; motivo: string }> {
  const dono = useCharacterStore.getState().characters.find(c => c.id === donoId);
  if (!dono) return { ok: false, motivo: 'Personagem inválido.' };
  if (!podeComandarInvocacao(donoId)) return { ok: false, motivo: 'Fora do turno do Controlador.' };
  const inv = dono.invocacoesConhecidas?.find(i => i.id === invocacaoId && i.donoCharacterId === donoId);
  const acao = inv?.acoes.find(a => a.id === acaoId);
  const tipoTeste = acao?.teste ?? (acao?.tipo === 'ataque' ? 'ataque' : undefined);
  if (!acao || (tipoTeste !== 'ataque' && tipoTeste !== 'resistencia')) return { ok: false, motivo: 'Ação sem ataque ou teste de resistência configurado.' };
  if (acao.tipoExecucao === 'omni' || acao.tipoExecucao === 'referencia_omni') return { ok: false, motivo: 'Esta ação está vinculada ao OMNI e deve ser resolvida pelo executor OMNI.' };
  if (tipoTeste === 'ataque' && !acao.dano) return { ok: false, motivo: 'Configure a fórmula de dano deste ataque.' };
  if (tipoTeste === 'resistencia' && !acao.resistenciaAlvo?.trim()) return { ok: false, motivo: 'Configure qual Teste de Resistência o alvo fará.' };
  if (tipoTeste === 'resistencia' && !DEFAULT_SAVING_THROWS.some(nome => nome.toLocaleLowerCase('pt-BR') === acao.resistenciaAlvo!.trim().toLocaleLowerCase('pt-BR'))) {
    return { ok: false, motivo: 'Teste de Resistência não reconhecido para esta ação.' };
  }
  const mapa = useMapStore.getState();
  const servo = tokensInvocados(donoId).find(e => e.invocationId === invocacaoId && (!opcoes?.instanciaId || e.invocationInstanceId === opcoes.instanciaId) && (e.hp ?? 0) > 0);
  if (!servo) return { ok: false, motivo: 'Servo ou alvo ausente do mapa.' };
  const modelo = obterModeloDoToken(dono, servo);
  if (!modelo) return { ok: false, motivo: 'Modelo da invocação não encontrado.' };
  const instancia = obterInstanciaDoToken(dono, servo, modelo);
  const chave = instancia.id + ':' + acaoId;
  if (ataquesPendentes.has(chave)) return { ok: false, motivo: 'Comando anterior ainda em andamento.' };
  if (!podeUsarAcaoDaInstancia(instancia, acaoId)) return { ok: false, motivo: 'A ação ainda está em recarga.' };
  const debito = prepararDebitoComando(dono, modelo, instancia, acao);
  if (!debito.ok) return debito;
  const categoria = categoriaEconomiaDaAcao(acao, instancia.economiaAcoes);
  if (!categoria) return { ok: false, motivo: 'Categoria de ação própria não configurada.' };
  const alvo = useCharacterStore.getState().characters.find(c => c.id === alvoId);
  const tokenAlvo = Object.values(mapa.entities).find(e => e.characterId === alvoId && !e.invocationId);
  if (!alvo || !tokenAlvo || alvoId === donoId) return { ok: false, motivo: 'Servo ou alvo ausente do mapa.' };
  const escala = mapa.gridConfig.metersPerCell / mapa.gridConfig.dpi;
  if (!(escala > 0)) return { ok: false, motivo: 'Grade inválida.' };
  const distancia = Math.hypot((servo.x + servo.w / 2) - (tokenAlvo.x + tokenAlvo.w / 2),
    (servo.y + servo.h / 2) - (tokenAlvo.y + tokenAlvo.h / 2)) * escala;
  if (distancia > (acao.alcanceM ?? 1.5) + 1e-6) return { ok: false, motivo: 'Alvo fora do alcance.' };
  const formula = acao.dano ? parseFormulaDanoInvocacao(acao.dano) : null;
  if (tipoTeste === 'ataque' && !formula) return { ok: false, motivo: 'Dano inválido; use dados como 2d12+1d6+3.' };
  if (tipoTeste === 'resistencia' && acao.dano && !formula) return { ok: false, motivo: 'Dano inválido; use dados como 2d12+1d6+3.' };
  const bonusAtaque = tipoTeste === 'ataque' ? calcularBonusAtaqueInvocacao(dono, modelo, acao) : null;
  if (tipoTeste === 'ataque' && (!bonusAtaque || !Number.isFinite(bonusAtaque.total))) {
    return { ok: false, motivo: 'Defina um atributo de ataque válido na ficha do Shikigami.' };
  }
  if (acao.margemCritico !== undefined && (!Number.isInteger(acao.margemCritico) || acao.margemCritico < 2 || acao.margemCritico > 20)) {
    return { ok: false, motivo: 'Margem de crítico precisa estar entre 2 e 20.' };
  }
  const cd = tipoTeste === 'resistencia' ? calcularCDInvocacao(dono, modelo, acao.atributoCD) : null;
  if (tipoTeste === 'resistencia' && cd === null) return { ok: false, motivo: 'Defina o atributo usado para calcular a CD da ação.' };
  const kind = bonusAtaque?.tipo === 'distancia' ? 'ranged' : 'melee';
  const defesa = computeTotalDefense(alvo, {}, kind);
  const gasto = gastarAcaoDaInstancia(instancia, categoria, 1, opcoes?.requestId);
  if (!gasto.ok) return gasto;
  const comRecursosDebitados = { ...gasto.instancia, recursosAtuais: debito.recursosRestantes };
  const comRecarga = registrarRecargaDaAcao(comRecursosDebitados, acao);
  gravarInstancia(dono, comRecarga, { peCurrent: debito.peDonoRestante });
  ataquesPendentes.add(chave);
  try {
    if (tipoTeste === 'resistencia') {
      const requestId = useTestRequestStore.getState().enqueue({
        charId: alvo.id,
        charName: alvo.name,
        targetProfileId: alvo.profileId,
        kind: 'save',
        testName: acao.resistenciaAlvo!,
        dc: cd!,
        note: `${modelo.nome} — ${acao.nome}`,
        originId: donoId,
        sourceTag: `shikigami:${instancia.id}:${acao.id}:${opcoes?.requestId ?? novoIdInvocacao('tr')}`,
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
      return { ok: true, acertou: false, totalAtaque: 0, dano: 0, testePendente: true, requestId, cd: cd! };
    }
    const natural = await rollD20Autonomo(bonusAtaque!.total, { label: `Ataque de ${modelo.nome}: ${acao.nome}` });
    const resultado = resolverAcertoInvocacao(natural, bonusAtaque!.total, defesa, acao.margemCritico ?? 20);
    if (!resultado.acertou) {
      useLogStore.getState().addLog('combat', `🎯 ${modelo.nome} — ${acao.nome} contra ${alvo.name}: d20 ${natural} + ${bonusAtaque!.total} = ${resultado.total} vs Defesa ${defesa} (${resultado.falhaCritica ? 'falha crítica' : 'erro'}).`);
      return { ok: true, acertou: false, totalAtaque: resultado.total, dano: 0 };
    }
    const dadosDano = resultado.critico
      ? multiplicarDadosCriticos(formula!.dados, acao.multiplicadorCritico ?? 2)
      : formula!.dados;
    const rolagem = await rollDiceGroups(dadosDano, { label: `Dano de ${modelo.nome}: ${acao.nome}` });
    const dano = Math.max(0, rolagem.total + formula!.fixo + calcularBonusDanoInvocacao(modelo, acao, 'ataque'));
    await useCharacterStore.getState().applyDamage(alvoId, dano, acao.tipoDano ?? 'DCO', {
      attackerId: donoId,
      source: 'omni',
      isMelee: bonusAtaque!.tipo === 'corpo_a_corpo',
      attack: { critical: resultado.critico, criticalFail: resultado.falhaCritica, kind: bonusAtaque!.tipo === 'corpo_a_corpo' ? 'melee' : 'ranged' },
    });
    useLogStore.getState().addLog('combat', `🎯 ${modelo.nome} — ${acao.nome} contra ${alvo.name}: d20 ${natural} + ${bonusAtaque!.total} = ${resultado.total} vs Defesa ${defesa} → ${resultado.critico ? 'acerto crítico' : 'acerto'}, dano ${dano} (${acao.tipoDano ?? 'DCO'}).`);
    return { ok: true, acertou: true, totalAtaque: resultado.total, dano, ...(resultado.critico ? { critico: true } : {}) };
  } catch {
    // A execução pode ter chegado ao dano antes da falha. Não duplicar ação nem dano.
    return { ok: false, motivo: 'Falha ao resolver ataque; confira o log de combate.' };
  } finally {
    ataquesPendentes.delete(chave);
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
  if (!invocacaoTreinadaNaPericia(modelo, pericia)) return { ok: false, motivo: 'O Shikigami precisa ser treinado nessa perícia para fazer um teste independente.' };
  const nomePericia = ROTULOS_PERICIAS[pericia as keyof typeof ROTULOS_PERICIAS] ?? pericia;
  const d20 = await rollD20Autonomo(bonus.total, { label: `${nomePericia} — ${modelo.nome}` });
  const total = d20 + bonus.total;
  useLogStore.getState().addLog('combat', `🎲 ${modelo.nome} — ${nomePericia}: d20 ${d20} + ${bonus.total} = ${total}${bonus.treinada ? ' (treinada)' : ''}.`);
  return { ok: true, d20, bonus: bonus.total, total, treinada: bonus.treinada };
}
