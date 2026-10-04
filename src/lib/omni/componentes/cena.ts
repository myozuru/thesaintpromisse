import type { DadoComposto, DadosComposicao } from './avaliar';
import { recursoComposto } from './recursos';

export function dadosTurnos(b: Record<string, number>): DadosComposicao {
  const n = (k: string) => b[k] ?? 0;
  const comum = recursoComposto(n('ATAQUES_RESTANTES'), n('ATAQUES_NO_TURNO'));
  const bonus = recursoComposto(n('ACAO_BONUS'), n('ACAO_BONUS'));
  return { selecoes: {
    acao: { campos: { comum, bonus } },
    ataques: recursoComposto(n('ATAQUES_RESTANTES'), n('ATAQUES_NO_TURNO'), { turno: recursoComposto(n('ATAQUES_NESTE_TURNO'), n('ATAQUES_NO_TURNO')) }),
    reacao: recursoComposto(n('REACOES_RESTANTES'), n('REACOES_MAX'), { usada: n('REACAO_USADA_NESTA_RODADA') }),
    reacoes: recursoComposto(n('REACOES_RESTANTES'), n('REACOES_MAX'), { usadas: { valor: n('REACOES_USADAS_NESTA_RODADA'), quantidade: n('REACOES_USADAS_NESTA_RODADA') } }),
    oportunidade: recursoComposto(n('ADO_RESTANTES'), n('ADO_MAX'), { concedida: n('ADO_CONCEDIDA'), modo: n('ADO_MODO'), consumida: n('ADO_CONSUMIDA'), restrita: n('ADO_RESTRITA') }),
    movimento: recursoComposto(n('MOVIMENTO_RESTANTE'), n('DESLOCAMENTO'), { bonus: n('MOVIMENTO_BONUS_METROS'), velocidade: n('VELOCIDADE_ATUAL') }),
    metros: { campos: { movidos: { campos: { turno: n('METROS_MOVIDOS_NESTE_TURNO') } } } },
    trocas_arma: { quantidade: n('SWAPS_ARMAS_NESTE_TURNO'), campos: { turno: { quantidade: n('SWAPS_ARMAS_NESTE_TURNO') } } },
    rodada: n('RODADA'), turno: { campos: { indice: n('TURNO_ATUAL_INDEX'), pausado: n('TURNO_PAUSADO'), segundos: { campos: { duração: n('TURNO_DURACAO_SEG') } }, duração: { campos: { segundos: n('TURNO_DURACAO_SEG') } } } },
    turnos: { campos: { minha_vez: n('TURNOS_ATE_MEU') } },
    segundos: { campos: { restante: { campos: { turno: n('TURNO_SEGUNDOS_RESTANTES') } } } },
    cronometro: { campos: { ativo: n('TURNO_CRONOMETRO_ATIVO') } },
    usuario: { campos: { turno: { campos: { proximo: n('SOU_PROXIMO_NO_TURNO'), ultimo: n('SOU_ULTIMO_NO_TURNO') } } } },
    eh: { campos: { meu: { campos: { turno: n('EH_MEU_TURNO') } } } },
    defesa: { valor: n('DEFESA'), campos: { cac: n('DEFESA_CAC'), distancia: n('DEFESA_DIST') } },
    iniciativa: { valor: n('INICIATIVA'), campos: { bonus: n('INICIATIVA') } },
  } };
}

export function dadosCena(b: Record<string, number>): DadosComposicao {
  const n = (k: string) => b[`CENA_${k}`];
  const selecoes: Record<string, DadoComposto> = {};
  for (const k of ['ano', 'mes', 'dia', 'hora', 'minuto', 'segundo', 'rodada', 'rodadas_em_combate', 'consumido', 'dificuldade', 'terreno']) selecoes[k] = n(k.toUpperCase());
  selecoes.dano = { campos: { evento: n('DANO_EVENTO') ?? n('DANO') } };
  selecoes.mapa = { campos: { ambos: n('AMBOS_NO_MAPA') ?? n('NO_MAPA') } };
  selecoes.turno = { campos: { indice: b.CENA_TURNO_INDICE } };
  selecoes.periodo = { campos: Object.fromEntries(['amanhecer', 'anoitecer', 'dia', 'noite'].map(k => [k, n(`EH_${k.toUpperCase()}`)])) };
  selecoes.relogio = { campos: { ativo: n('RELOGIO_ATIVO'), velocidade: n('MULTIPLICADOR_TEMPO') } };
  selecoes.segundos = { campos: { dia: n('TIMESTAMP_SEGUNDOS') } };
  selecoes.eventos = { campos: { hoje: { quantidade: n('EVENTOS_HOJE') } } };
  selecoes.x = { campos: { posicao: n('TOKEN_X') } };
  selecoes.y = { campos: { posicao: n('TOKEN_Y') } };
  selecoes.distancia = { valor: n('DISTANCIA'), campos: { plana: n('DISTANCIA_XY'), grade: n('DISTANCIA_MANHATTAN') } };
  selecoes.diferenca = { campos: { altura: n('ELEVACAO_DIFF') } };
  selecoes.tokens = { quantidade: n('QTD_TOKENS') };
  selecoes.aliados = { quantidade: n('QTD_ALIADOS') };
  selecoes.inimigos = { quantidade: n('QTD_INIMIGOS') };
  selecoes.outro = { campos: { aliado: n('OUTRO_EH_ALIADO'), inimigo: n('OUTRO_EH_INIMIGO'),
    identidade: { registros: n('OUTRO_EH_VOCE') === undefined ? {} : { voce: Boolean(n('OUTRO_EH_VOCE')) } } } };
  selecoes.sujeito = { campos: { aliado: n('SUJEITO_EH_ALIADO') } };
  return { selecoes };
}
