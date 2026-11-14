import type { DamageType } from '@/types';
import type { InstanciaInvocacao } from '@/lib/invocacoes/schema';

export type EstadoMahoraga = NonNullable<InstanciaInvocacao['estadoMahoraga']>;
export type FenomenoMahoraga = EstadoMahoraga['fenomenos'][number];
export type AdaptaAlvoMahoraga = EstadoMahoraga['adaptacoesCombate'][number];
export type AdaptacaoCondicaoMahoraga = EstadoMahoraga['adaptacoesCondicoes'][number];

export const PV_POR_ESTAGIO_MAHORAGA = { 1: 1000, 2: 500, 3: 250 } as const;
export const EXCESSO_MINIMO_ESTAGIO_MAHORAGA = 150;
export const RODADAS_POR_GIRO_AUTOMATICO_MAHORAGA = 5;
export const DURACAO_GIRO_TRES_RODAS_MAHORAGA = 600;
export const RD_GIRO_DOIS_MAHORAGA = 12;
export const BONUS_NIVEIS_REGENERACAO_MAHORAGA = 8;
export const BONUS_TR_POR_RODADA_CONDICAO_MAHORAGA = 5;

const BONUS_RESISTENCIA_CONDICAO_MAHORAGA = {
  fraca: 10,
  media: 20,
  forte: 30,
  extrema: 40,
} as const;

function normalizarCondicaoMahoraga(valor: string): string {
  return valor.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

export function limitePEAdicionalRegeneracaoMahoraga(constituicao: number): number {
  if (!Number.isFinite(constituicao)) return BONUS_NIVEIS_REGENERACAO_MAHORAGA;
  const modificadorConstituicao = Math.floor((constituicao - 10) / 2);
  return Math.max(0, modificadorConstituicao + BONUS_NIVEIS_REGENERACAO_MAHORAGA);
}

export function estadoInicialMahoraga(combateId?: string): EstadoMahoraga {
  return {
    ...(combateId ? { combateId } : {}),
    estagioVida: 1,
    despertarPendente: false,
    fenomenos: [],
    ataquesCorpoACorpoRecebidos: 0,
    regeneracoesRodaPendentes: 0,
    adaptacoesCombate: [],
    adaptacoesCondicoes: [],
    ferimentosComplexos: [],
    recuperacoesFerimentoProcessadas: [],
    eventosDanoProcessados: [],
    eventosRodaProcessados: [],
    regeneracoesProcessadas: [],
  };
}

/** Um novo combate reinicia a Roda da cena, mas preserva o progresso pausado contra cada alvo. */
export function normalizarEstadoMahoraga(
  estado: EstadoMahoraga | undefined,
  combateId?: string,
): EstadoMahoraga {
  const base = estado ?? estadoInicialMahoraga(combateId);
  if (!combateId || base.combateId === combateId) return {
    ...base,
    fenomenos: base.fenomenos ?? [],
    ataquesCorpoACorpoRecebidos: base.ataquesCorpoACorpoRecebidos ?? 0,
    regeneracoesRodaPendentes: base.regeneracoesRodaPendentes ?? 0,
    adaptacoesCombate: base.adaptacoesCombate ?? [],
    adaptacoesCondicoes: base.adaptacoesCondicoes ?? [],
    ferimentosComplexos: base.ferimentosComplexos ?? [],
    recuperacoesFerimentoProcessadas: base.recuperacoesFerimentoProcessadas ?? [],
    eventosDanoProcessados: base.eventosDanoProcessados ?? [],
    eventosRodaProcessados: base.eventosRodaProcessados ?? [],
    regeneracoesProcessadas: base.regeneracoesProcessadas ?? [],
  };
  const prioridadeDivina = base.vontadeDivina;
  return {
    ...base,
    combateId,
    fenomenos: [],
    ataquesCorpoACorpoRecebidos: 0,
    regeneracoesRodaPendentes: 0,
    alvoFocoId: undefined,
    adaptacoesCombate: base.adaptacoesCombate ?? [],
    adaptacoesCondicoes: base.adaptacoesCondicoes ?? [],
    ferimentosComplexos: base.ferimentosComplexos ?? [],
    recuperacoesFerimentoProcessadas: base.recuperacoesFerimentoProcessadas ?? [],
    vontadeDivina: prioridadeDivina ? {
      ativa: false,
      rodadasRestantes: 0,
      rodadasTotais: 0,
      prioridade: prioridadeDivina.prioridade,
      ...(prioridadeDivina.ultimaOrdem ? { ultimaOrdem: prioridadeDivina.ultimaOrdem } : {}),
    } : undefined,
    ataqueAdaptativoTipo: undefined,
    regeneracaoLivreUsada: undefined,
    eventosDanoProcessados: [],
    eventosRodaProcessados: [],
    regeneracoesProcessadas: [],
  };
}

/** Avança uma vez por rodada os bônus contra condições que continuam ativas. */
export function processarAdaptacoesCondicoesMahoraga(
  estado: EstadoMahoraga,
  condicoesAtivas: readonly { conditionId: string; nome: string; grau?: string }[],
  rodada: number,
): EstadoMahoraga {
  const ativas = new Map(condicoesAtivas.map(condicao => [normalizarCondicaoMahoraga(condicao.conditionId), condicao]));
  const adaptacoes = new Map(estado.adaptacoesCondicoes.map(adaptacao => [normalizarCondicaoMahoraga(adaptacao.conditionId), adaptacao]));

  for (const adaptacao of estado.adaptacoesCondicoes) {
    const chave = normalizarCondicaoMahoraga(adaptacao.conditionId);
    if (ativas.has(chave) || !adaptacao.condicaoAtiva) continue;
    adaptacoes.set(chave, {
      ...adaptacao,
      condicaoAtiva: false,
      bonusTRPermanente: Math.max(adaptacao.bonusTRPermanente, adaptacao.grau
        ? BONUS_RESISTENCIA_CONDICAO_MAHORAGA[adaptacao.grau]
        : 0),
    });
  }

  for (const [chave, condicao] of ativas) {
    const anterior = adaptacoes.get(chave);
    if (anterior?.ultimaRodadaProcessada === rodada) {
      adaptacoes.set(chave, { ...anterior, nome: condicao.nome, condicaoAtiva: true });
      continue;
    }
    const rodadasConsecutivas = (anterior?.condicaoAtiva ? anterior.rodadasConsecutivas : 0) + 1;
    const grau = ['fraca', 'media', 'forte', 'extrema'].includes(condicao.grau ?? '')
      ? condicao.grau as AdaptacaoCondicaoMahoraga['grau']
      : anterior?.grau;
    adaptacoes.set(chave, {
      conditionId: condicao.conditionId,
      nome: condicao.nome,
      ...(grau ? { grau } : {}),
      rodadasConsecutivas,
      bonusTRConsecutivo: rodadasConsecutivas * BONUS_TR_POR_RODADA_CONDICAO_MAHORAGA,
      condicaoAtiva: true,
      bonusTRPermanente: anterior?.bonusTRPermanente ?? 0,
      ultimaRodadaProcessada: rodada,
    });
  }

  return { ...estado, adaptacoesCondicoes: [...adaptacoes.values()].slice(-100) };
}

/** Encerra uma condição registrada e fixa a resistência prevista pelo grau do livro. */
export function encerrarAdaptacaoCondicaoMahoraga(
  estado: EstadoMahoraga,
  conditionId: string,
  detalhe?: { nome?: string; grau?: string },
): EstadoMahoraga {
  const chave = normalizarCondicaoMahoraga(conditionId);
  const existente = estado.adaptacoesCondicoes.find(adaptacao =>
    normalizarCondicaoMahoraga(adaptacao.conditionId) === chave,
  );
  if (!existente && detalhe) {
    const grau = ['fraca', 'media', 'forte', 'extrema'].includes(detalhe.grau ?? '')
      ? detalhe.grau as AdaptacaoCondicaoMahoraga['grau']
      : undefined;
    return {
      ...estado,
      adaptacoesCondicoes: [...estado.adaptacoesCondicoes, {
        conditionId,
        nome: detalhe.nome ?? conditionId,
        ...(grau ? { grau } : {}),
        rodadasConsecutivas: 0,
        bonusTRConsecutivo: 0,
        condicaoAtiva: false,
        bonusTRPermanente: grau ? BONUS_RESISTENCIA_CONDICAO_MAHORAGA[grau] : 0,
      }].slice(-100),
    };
  }
  return {
    ...estado,
    adaptacoesCondicoes: estado.adaptacoesCondicoes.map(adaptacao =>
      normalizarCondicaoMahoraga(adaptacao.conditionId) !== chave
        ? adaptacao
        : {
          ...adaptacao,
          condicaoAtiva: false,
          bonusTRPermanente: Math.max(adaptacao.bonusTRPermanente, adaptacao.grau
            ? BONUS_RESISTENCIA_CONDICAO_MAHORAGA[adaptacao.grau]
            : 0),
        }),
  };
}

export function bonusTRCondicaoMahoraga(estado: EstadoMahoraga, conditionId: string): number {
  const adaptacao = estado.adaptacoesCondicoes.find(item =>
    normalizarCondicaoMahoraga(item.conditionId) === normalizarCondicaoMahoraga(conditionId),
  );
  return adaptacao ? adaptacao.bonusTRConsecutivo + adaptacao.bonusTRPermanente : 0;
}

export function processarVontadeDivinaMahoraga(
  estado: EstadoMahoraga,
  input: { domadoPermanentemente: boolean; donoIncapacitado: boolean; maiorModificadorMental: number; rodada: number; combateId?: string },
) {
  const atual = estado.vontadeDivina;
  if (!input.domadoPermanentemente || (atual?.combateId && input.combateId && atual.combateId !== input.combateId)) {
    return { estado: { ...estado, vontadeDivina: undefined }, iniciou: false, terminou: Boolean(atual?.ativa) };
  }
  if (atual?.ativa) {
    if (atual.ultimaRodadaProcessada === input.rodada) return { estado, iniciou: false, terminou: false };
    const rodadasRestantes = Math.max(0, atual.rodadasRestantes - 1);
    const vontadeDivina = {
      ...atual,
      ativa: rodadasRestantes > 0,
      rodadasRestantes,
      ...(rodadasRestantes === 0 && input.donoIncapacitado ? { bloqueadaAteRecuperar: true } : {}),
      ultimaRodadaProcessada: input.rodada,
    };
    return { estado: { ...estado, vontadeDivina }, iniciou: false, terminou: atual.rodadasRestantes > 0 && rodadasRestantes === 0 };
  }
  if (!input.donoIncapacitado) {
    return atual?.bloqueadaAteRecuperar
      ? { estado: { ...estado, vontadeDivina: { ...atual, bloqueadaAteRecuperar: false } }, iniciou: false, terminou: false }
      : { estado, iniciou: false, terminou: false };
  }
  if (atual?.bloqueadaAteRecuperar) return { estado, iniciou: false, terminou: false };
  const rodadasTotais = Math.max(1, Math.trunc(input.maiorModificadorMental));
  return {
    estado: {
      ...estado,
      vontadeDivina: {
        ativa: true,
        rodadasRestantes: rodadasTotais,
        rodadasTotais,
        ...(input.combateId ? { combateId: input.combateId } : {}),
        ultimaRodadaProcessada: input.rodada,
        prioridade: atual?.prioridade ?? 'ultima_ordem',
        ...(atual?.alvoPrioritarioId ? { alvoPrioritarioId: atual.alvoPrioritarioId } : {}),
        ...(atual?.ultimaOrdem ? { ultimaOrdem: atual.ultimaOrdem } : {}),
      },
    },
    iniciou: true,
    terminou: false,
  };
}

function giroFenomeno(
  estado: EstadoMahoraga,
  input: { id: string; nome: string; tipoDano?: DamageType; rodada: number; eventoId?: string },
): { estado: EstadoMahoraga; girosAntes: number; girosDepois: number; novoFenomeno: boolean } {
  const existente = estado.fenomenos.find(fenomeno => fenomeno.id === input.id);
  const girosAntes = existente?.giros ?? 0;
  const girosDepois = Math.min(5, girosAntes + 1);
  const proximaRodada = girosDepois >= 5
    ? undefined
    : (existente?.proximaRodadaGiroAutomatico ?? input.rodada + RODADAS_POR_GIRO_AUTOMATICO_MAHORAGA);
  const fenomeno: FenomenoMahoraga = {
    id: input.id,
    nome: input.nome,
    ...(input.tipoDano ? { tipoDano: input.tipoDano } : {}),
    ...(existente?.eventoPrimeiroGiroId || input.eventoId
      ? { eventoPrimeiroGiroId: existente?.eventoPrimeiroGiroId ?? input.eventoId }
      : {}),
    ...(input.eventoId || existente?.eventoUltimoGiroId
      ? { eventoUltimoGiroId: input.eventoId ?? existente?.eventoUltimoGiroId }
      : {}),
    giros: girosDepois,
    ultimaRodadaGiro: input.rodada,
    ...(proximaRodada === undefined ? {} : { proximaRodadaGiroAutomatico: proximaRodada }),
    ...(girosDepois === 3 ? { expiraReducaoDanoNaRodada: input.rodada + DURACAO_GIRO_TRES_RODAS_MAHORAGA } : {}),
  };
  return {
    estado: {
      ...estado,
      fenomenos: existente
        ? estado.fenomenos.map(item => item.id === input.id ? fenomeno : item)
        : [...estado.fenomenos, fenomeno].slice(-100),
    },
    girosAntes,
    girosDepois,
    novoFenomeno: !existente,
  };
}

export function registrarFenomenoMahoraga(
  estado: EstadoMahoraga,
  input: { id: string; nome: string; tipoDano?: DamageType; rodada: number; eventoId?: string },
) {
  return giroFenomeno(estado, input);
}

export function efeitosRodaNoDano(
  fenomeno: FenomenoMahoraga | undefined,
  danoDepoisDeRD: number,
  atual: { pv: number; pvTemporarios: number; ataqueCorpoACorpo: boolean; ataquesCorpoACorpoRecebidos: number },
): { dano: number; pvTemporariosConsumidos: number; danoNosPV: number; efeito: string } {
  let dano = Math.max(0, Math.floor(danoDepoisDeRD));
  const giro = fenomeno?.giros ?? 0;
  if (giro >= 2) dano = Math.max(0, dano - RD_GIRO_DOIS_MAHORAGA);
  if (giro >= 3) dano = Math.floor(dano / 2);
  if (giro >= 4) dano = Math.floor(dano / 2);
  if (atual.ataqueCorpoACorpo) {
    const danoBase = atual.ataquesCorpoACorpoRecebidos === 0
      ? Math.floor(dano / 2)
      : Math.floor(dano / 4);
    dano = Math.min(dano, danoBase);
  }
  const pvTemporariosConsumidos = Math.min(atual.pvTemporarios, dano);
  let danoNosPV = dano - pvTemporariosConsumidos;
  if (giro >= 5 && atual.pv > 0) danoNosPV = Math.min(danoNosPV, atual.pv - 1);
  const efeito = giro >= 5
    ? '5º giro: o fenômeno não pode reduzir Mahoraga abaixo de 1 PV'
    : giro === 4 ? '4º giro: 1/4 do dano'
      : giro === 3 ? '3º giro: metade do dano'
        : giro === 2 ? `2º giro: −${RD_GIRO_DOIS_MAHORAGA} RD irredutível`
          : atual.ataqueCorpoACorpo ? 'adaptação a ataque corpo a corpo' : '';
  return { dano, pvTemporariosConsumidos, danoNosPV, efeito };
}

export function resolverCicloVidaMahoraga(input: {
  estado: EstadoMahoraga;
  pvAtual: number;
  danoNosPV: number;
  fenomenoJaConhecido: boolean;
}): {
  estado: EstadoMahoraga;
  pvAtual: number;
  pvMaximo: number;
  estadoInvocacao: 'ativa' | 'caida' | 'derrotada';
  excesso: number;
  mensagem: string;
} {
  const { estado, pvAtual, danoNosPV, fenomenoJaConhecido } = input;
  if (estado.despertarPendente) {
    return { estado, pvAtual: 0, pvMaximo: PV_POR_ESTAGIO_MAHORAGA[estado.estagioVida], estadoInvocacao: 'caida', excesso: 0,
      mensagem: 'Mahoraga permanece caído até o início do próximo turno do Controlador.' };
  }
  const pvAposDano = pvAtual - danoNosPV;
  if (pvAposDano > 0) {
    return { estado, pvAtual: pvAposDano, pvMaximo: PV_POR_ESTAGIO_MAHORAGA[estado.estagioVida], estadoInvocacao: 'ativa', excesso: 0, mensagem: '' };
  }
  const excesso = Math.max(0, danoNosPV - Math.max(0, pvAtual));
  const podeAvancar = excesso >= EXCESSO_MINIMO_ESTAGIO_MAHORAGA && !fenomenoJaConhecido;
  if (estado.estagioVida === 3 && podeAvancar) {
    return { estado: { ...estado, despertarPendente: false }, pvAtual: -PV_POR_ESTAGIO_MAHORAGA[3],
      pvMaximo: PV_POR_ESTAGIO_MAHORAGA[3], estadoInvocacao: 'derrotada', excesso,
      mensagem: 'O terceiro estágio foi superado com 150 ou mais de dano excedente. Mahoraga foi derrotado permanentemente.' };
  }
  if (podeAvancar) {
    const proximo = (estado.estagioVida + 1) as 2 | 3;
    return { estado: { ...estado, estagioVida: proximo, despertarPendente: true }, pvAtual: 0,
      pvMaximo: PV_POR_ESTAGIO_MAHORAGA[proximo], estadoInvocacao: 'caida', excesso,
      mensagem: `O excesso de ${excesso} PV supera o limiar. Mahoraga consumiu o Estágio ${estado.estagioVida} e despertará no Estágio ${proximo} no início do próximo turno.` };
  }
  const estagioRestaurado = estado.estagioVida === 1 ? 1 : (estado.estagioVida - 1) as 1 | 2;
  const pvRestaurados = PV_POR_ESTAGIO_MAHORAGA[estagioRestaurado];
  const motivo = fenomenoJaConhecido
    ? 'O fenômeno já havia iniciado adaptação nesta cena'
    : `o dano excedente foi ${excesso}, abaixo de ${EXCESSO_MINIMO_ESTAGIO_MAHORAGA}`;
  return {
    estado: { ...estado, estagioVida: estagioRestaurado, despertarPendente: false },
    pvAtual: pvRestaurados,
    pvMaximo: pvRestaurados,
    estadoInvocacao: 'ativa',
    excesso,
    mensagem: `A Roda impediu a progressão (${motivo}); Mahoraga recupera ${pvRestaurados} PV e retorna ao Estágio ${estagioRestaurado}.`,
  };
}

export function processarInicioTurnoMahoraga(estado: EstadoMahoraga, rodada: number) {
  let acordou = false;
  let atual = estado;
  if (estado.despertarPendente) {
    atual = { ...estado, despertarPendente: false };
    acordou = true;
  }
  const expirados: string[] = [];
  const girados: string[] = [];
  const fenomenos = atual.fenomenos.map(fenomeno => {
    let giros = fenomeno.giros;
    let proxima = fenomeno.proximaRodadaGiroAutomatico;
    let expira = fenomeno.expiraReducaoDanoNaRodada;
    if (giros === 3 && expira !== undefined && rodada >= expira) {
      giros = 2;
      expira = undefined;
      expirados.push(fenomeno.nome);
    }
    while (giros < 5 && proxima !== undefined && rodada >= proxima) {
      giros += 1;
      girados.push(fenomeno.nome);
      proxima = giros >= 5 ? undefined : proxima + RODADAS_POR_GIRO_AUTOMATICO_MAHORAGA;
      if (giros === 3) expira = rodada + DURACAO_GIRO_TRES_RODAS_MAHORAGA;
      if (giros >= 4) expira = undefined;
    }
    return {
      ...fenomeno,
      giros,
      ...(proxima === undefined ? { proximaRodadaGiroAutomatico: undefined } : { proximaRodadaGiroAutomatico: proxima }),
      ...(expira === undefined ? { expiraReducaoDanoNaRodada: undefined } : { expiraReducaoDanoNaRodada: expira }),
      ...(girados.includes(fenomeno.nome) ? { ultimaRodadaGiro: rodada } : {}),
    };
  });
  // A regra vincula Regeneração Adaptativa a qualquer giro; giros automáticos também liberam um uso.
  return {
    estado: { ...atual, fenomenos, regeneracoesRodaPendentes: atual.regeneracoesRodaPendentes + girados.length },
    acordou,
    girados,
    expirados,
    pvDespertar: acordou ? PV_POR_ESTAGIO_MAHORAGA[atual.estagioVida] : undefined,
  };
}

export function registrarAtaqueContraAlvoMahoraga(
  estado: EstadoMahoraga,
  alvo: { id: string; nome: string; defesa: number; idsLegados?: string[] },
): { estado: EstadoMahoraga; girosAntes: number; girosDepois: number } {
  const anterior = estado.adaptacoesCombate.find(item => item.alvoId === alvo.id) ??
    estado.adaptacoesCombate.find(item => alvo.idsLegados?.includes(item.alvoId));
  const girosAntes = anterior?.giros ?? 0;
  const girosDepois = Math.min(4, girosAntes + 1);
  const novo: AdaptaAlvoMahoraga = {
    alvoId: alvo.id,
    nomeAlvo: alvo.nome,
    giros: girosDepois,
    ...(anterior?.defesaRegistrada !== undefined
      ? { defesaRegistrada: anterior.defesaRegistrada }
      : { defesaRegistrada: alvo.defesa }),
  };
  return {
    estado: {
      ...estado,
      alvoFocoId: alvo.id,
      adaptacoesCombate: anterior
        ? [
          ...estado.adaptacoesCombate.filter(item => item.alvoId !== alvo.id && !alvo.idsLegados?.includes(item.alvoId)),
          novo,
        ].slice(-100)
        : [...estado.adaptacoesCombate, novo].slice(-100),
    },
    girosAntes,
    girosDepois,
  };
}

export function obterIgnoranciaAdaptativaMahoraga(estado: EstadoMahoraga, alvoId: string, idsLegados: string[] = []) {
  const giros = (estado.adaptacoesCombate.find(item => item.alvoId === alvoId) ??
    estado.adaptacoesCombate.find(item => idsLegados.includes(item.alvoId)))?.giros ?? 0;
  return {
    giros,
    rdIgnore: giros >= 4 ? Number.POSITIVE_INFINITY : giros >= 2 ? RD_GIRO_DOIS_MAHORAGA : 0,
    ignoraResistencias: giros >= 3,
    ignoraImunidades: giros >= 4,
  };
}

export function obterAdaptacaoPorId(estado: EstadoMahoraga, id: string) {
  return estado.fenomenos.find(fenomeno => fenomeno.id === id);
}

