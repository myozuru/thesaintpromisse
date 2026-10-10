/**
 * Regras-base de Invocações conforme docs/regras/invocacoes_texto_original_2026-10-08.txt.
 * Os valores do livro são referências: divergências podem ser auditadas sem bloquear
 * escolhas manuais autorizadas em docs/regras/controlador_especificacao_complementar.md.
 */
import { getTrainingBonusByLevel } from "@/lib/levelEngine";

export const GRAUS_SHIKIGAMI = ["quarto", "terceiro", "segundo", "primeiro", "especial"] as const;
export type GrauShikigami = typeof GRAUS_SHIKIGAMI[number];

export const ATRIBUTOS_SHIKIGAMI = ["forca", "destreza", "constituicao", "inteligencia", "sabedoria", "presenca"] as const;
export type AtributoShikigami = typeof ATRIBUTOS_SHIKIGAMI[number];
export type AtributosShikigami = Record<AtributoShikigami, number>;

export interface RegrasGrauShikigami {
  nivel: number;
  pontos: number;
  maximo: number;
  custo: number;
  pvBase: number;
  defesaBase: number;
  constInteira: boolean;
  fatorNivel: number;
  periciasAdicionais: number;
  acoesCaracteristicasBase: number;
  acoesCaracteristicasAdicionais: number;
  acoesComCustoMax: number;
  custoMaximoAcaoComCustoPE: number;
  posicaoGrau: number;
}

const TABELA: Record<GrauShikigami, RegrasGrauShikigami> = {
  quarto: {
    nivel: 1, pontos: 10, maximo: 16, custo: 2, pvBase: 10, defesaBase: 10,
    constInteira: false, fatorNivel: 1, periciasAdicionais: 1,
    acoesCaracteristicasBase: 2, acoesCaracteristicasAdicionais: 1,
    acoesComCustoMax: 1, custoMaximoAcaoComCustoPE: 2, posicaoGrau: 1,
  },
  terceiro: {
    nivel: 5, pontos: 15, maximo: 20, custo: 4, pvBase: 25, defesaBase: 12,
    constInteira: false, fatorNivel: 1, periciasAdicionais: 1,
    acoesCaracteristicasBase: 2, acoesCaracteristicasAdicionais: 2,
    acoesComCustoMax: 1, custoMaximoAcaoComCustoPE: 4, posicaoGrau: 2,
  },
  segundo: {
    nivel: 9, pontos: 20, maximo: 24, custo: 6, pvBase: 40, defesaBase: 16,
    constInteira: true, fatorNivel: 1, periciasAdicionais: 2,
    acoesCaracteristicasBase: 3, acoesCaracteristicasAdicionais: 3,
    acoesComCustoMax: 2, custoMaximoAcaoComCustoPE: 6, posicaoGrau: 3,
  },
  primeiro: {
    nivel: 13, pontos: 30, maximo: 26, custo: 8, pvBase: 60, defesaBase: 20,
    constInteira: true, fatorNivel: 1.5, periciasAdicionais: 2,
    acoesCaracteristicasBase: 3, acoesCaracteristicasAdicionais: 4,
    acoesComCustoMax: 2, custoMaximoAcaoComCustoPE: 8, posicaoGrau: 4,
  },
  especial: {
    nivel: 17, pontos: 40, maximo: 30, custo: 12, pvBase: 80, defesaBase: 24,
    constInteira: true, fatorNivel: 2, periciasAdicionais: 3,
    acoesCaracteristicasBase: 4, acoesCaracteristicasAdicionais: 5,
    acoesComCustoMax: 3, custoMaximoAcaoComCustoPE: 10, posicaoGrau: 5,
  },
};

function nivelInteiro(nivel: number): number {
  return Number.isFinite(nivel) ? Math.max(1, Math.trunc(nivel)) : 1;
}

export function regrasGrau(grau: GrauShikigami): RegrasGrauShikigami {
  return TABELA[grau];
}

export function grausDisponiveis(nivel: number): GrauShikigami[] {
  const nivelAtual = nivelInteiro(nivel);
  return GRAUS_SHIKIGAMI.filter((grau) => nivelAtual >= TABELA[grau].nivel);
}

export function atributosIniciaisShikigami(): AtributosShikigami {
  return { forca: 8, destreza: 8, constituicao: 8, inteligencia: 8, sabedoria: 8, presenca: 8 };
}

export function pontosRestantesShikigami(grau: GrauShikigami, atributos: AtributosShikigami): number {
  return TABELA[grau].pontos - ATRIBUTOS_SHIKIGAMI.reduce((acc, chave) => acc + (atributos[chave] - 8), 0);
}

/** A validação técnica não bloqueia valores que apenas divergem das referências do livro. */
export function validarAtributosShikigami(_grau: GrauShikigami, atributos: AtributosShikigami): string | null {
  for (const chave of ATRIBUTOS_SHIKIGAMI) {
    if (!Number.isFinite(atributos[chave]) || !Number.isInteger(atributos[chave])) {
      return "Os atributos precisam ser números inteiros finitos.";
    }
  }
  return null;
}

export interface AvisoRegraShikigami {
  codigo: string;
  severidade: "aviso" | "erro";
  detalhe: string;
}

export function auditarAtributosShikigami(
  grau: GrauShikigami,
  atributos: AtributosShikigami,
): AvisoRegraShikigami[] {
  const problemaTecnico = validarAtributosShikigami(grau, atributos);
  if (problemaTecnico) {
    return [{ codigo: "atributos_invalidos", severidade: "erro", detalhe: problemaTecnico }];
  }

  const avisos: AvisoRegraShikigami[] = [];
  const regras = TABELA[grau];
  for (const chave of ATRIBUTOS_SHIKIGAMI) {
    const valor = atributos[chave];
    if (valor < 6) {
      avisos.push({
        codigo: "atributo_abaixo_referencia",
        severidade: "aviso",
        detalhe: chave + " está abaixo do mínimo de 6 indicado no livro.",
      });
    } else if (valor > regras.maximo) {
      avisos.push({
        codigo: "atributo_acima_referencia",
        severidade: "aviso",
        detalhe: chave + " excede o máximo de " + regras.maximo + " indicado para " + grau + " grau.",
      });
    }
  }

  const restantes = pontosRestantesShikigami(grau, atributos);
  if (restantes > 0) {
    avisos.push({
      codigo: "pontos_nao_distribuidos",
      severidade: "aviso",
      detalhe: "Restam " + restantes + " pontos da distribuição sugerida pelo livro.",
    });
  } else if (restantes < 0) {
    avisos.push({
      codigo: "pontos_acima_referencia",
      severidade: "aviso",
      detalhe: "A distribuição excede em " + Math.abs(restantes) + " pontos a referência do livro.",
    });
  }
  return avisos;
}

export function modificadorAtributoShikigami(valor: number): number {
  return Math.floor((valor - 10) / 2);
}

export function periciasAdicionaisPorGrau(grau: GrauShikigami): number {
  return TABELA[grau].periciasAdicionais;
}

/** Base do livro: 1 + metade do modificador de INT ou SAB + bônus do grau. */
export function quantidadePericiasTreinadas(
  grau: GrauShikigami,
  valorInteligenciaOuSabedoria: number,
): number {
  const metadeModificador = Math.floor(modificadorAtributoShikigami(valorInteligenciaOuSabedoria) / 2);
  return Math.max(0, 1 + metadeModificador + periciasAdicionaisPorGrau(grau));
}

export function novasPericiasAoSubirGrau(
  grauAnterior: GrauShikigami,
  grauNovo: GrauShikigami,
): number {
  return Math.max(0, periciasAdicionaisPorGrau(grauNovo) - periciasAdicionaisPorGrau(grauAnterior));
}

/** O livro permite treinar qualquer TR exceto Integridade. */
export function podeTreinarResistenciaInvocacao(nomeTeste: string): boolean {
  const nomeNormalizado = nomeTeste
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  return nomeNormalizado.length > 0 && nomeNormalizado !== "integridade";
}

export function calcularBonusTesteInvocacao(args: {
  modificadorAtributoChave: number;
  bonusTreinamentoUsuario: number;
  nivelControlador: number;
  treinado: boolean;
}): number {
  const metadeNivel = Math.floor(nivelInteiro(args.nivelControlador) / 2);
  return args.modificadorAtributoChave
    + (args.treinado ? args.bonusTreinamentoUsuario : 0)
    + metadeNivel;
}

export type TipoOpcaoInvocacao = "acao_simples" | "acao_complexa" | "caracteristica";

export const REFERENCIAS_ACAO_COM_CUSTO = {
  usosPorRodada: 1,
  acaoMinima: "acao_complexa",
  custoMinimoPE: 1,
  multiplicadorCustoMaximoPorGrau: 2,
  alcanceAdicionalMetrosPorPE: 6,
  areaAdicionalMetrosPorPE: 3,
  niveisDanoOuCuraPorPE: 2,
  bonusAtaqueOuCDPorPE: 1,
  custoCondicaoPE: { fraca: 2, media: 4, forte: 6 },
} as const;

export function maximoAcoesCaracteristicas(grau: GrauShikigami): number {
  const regras = TABELA[grau];
  return regras.acoesCaracteristicasBase + regras.acoesCaracteristicasAdicionais;
}

/** Custo-base do grau mais o custo das opções que excedem a quantidade-base da tabela. */
export function custoInvocacaoComOpcoes(
  grau: GrauShikigami,
  opcoes: readonly TipoOpcaoInvocacao[],
): number {
  const base = TABELA[grau];
  return base.custo + opcoes.slice(base.acoesCaracteristicasBase)
    .reduce((total, opcao) => total + (opcao === "acao_complexa" ? 2 : 1), 0);
}

export interface ConfiguracaoAuditoriaShikigami {
  grau: GrauShikigami;
  nivelUsuario: number;
  bonusTreinamentoUsuario: number;
  atributos: AtributosShikigami;
  atributoBasePericias?: "inteligencia" | "sabedoria";
  periciasTreinadas?: readonly string[];
  valoresAtuais?: Partial<{
    pv: number;
    defesa: number;
    deslocamentoM: number;
    custoInvocacaoPE: number;
  }>;
  acoesCaracteristicas?: readonly TipoOpcaoInvocacao[];
  acoesComCusto?: readonly { custoPE: number; tipo: "acao_simples" | "acao_complexa" }[];
}

/** Auditoria só informa divergências de regra; falhas técnicas seguem separadas. */
export function auditarFichaShikigami(
  ficha: ConfiguracaoAuditoriaShikigami,
): AvisoRegraShikigami[] {
  const avisos = auditarAtributosShikigami(ficha.grau, ficha.atributos);
  if (avisos.some((item) => item.severidade === "erro")) return avisos;

  const opcoes = ficha.acoesCaracteristicas ?? [];
  const regras = TABELA[ficha.grau];
  const maximoOpcoes = maximoAcoesCaracteristicas(ficha.grau);
  if (opcoes.length > maximoOpcoes) {
    avisos.push({
      codigo: "acoes_caracteristicas_acima_referencia",
      severidade: "aviso",
      detalhe: "A ficha possui " + opcoes.length + " ações/características; a referência do livro é " + maximoOpcoes + ".",
    });
  }

  if (ficha.periciasTreinadas) {
    const unicas = new Set(ficha.periciasTreinadas);
    if (unicas.size !== ficha.periciasTreinadas.length) {
      avisos.push({
        codigo: "pericias_duplicadas",
        severidade: "aviso",
        detalhe: "Há perícias repetidas na lista; cada perícia treinada deve contar uma vez.",
      });
    }
    if (ficha.atributoBasePericias) {
      const valorAtributo = ficha.atributos[ficha.atributoBasePericias];
      const esperado = quantidadePericiasTreinadas(ficha.grau, valorAtributo);
      if (unicas.size !== esperado) {
        avisos.push({
          codigo: "quantidade_pericias_divergente",
          severidade: "aviso",
          detalhe: "A ficha registra " + unicas.size + " perícias treinadas; a referência atual é " + esperado + ".",
        });
      }
    } else {
      avisos.push({
        codigo: "atributo_base_pericias_nao_definido",
        severidade: "aviso",
        detalhe: "Defina se a quantidade de perícias usa Inteligência ou Sabedoria para comparar com o livro.",
      });
    }
  }

  const acoesComCusto = ficha.acoesComCusto ?? [];
  if (acoesComCusto.length > regras.acoesComCustoMax) {
    avisos.push({
      codigo: "acoes_com_custo_acima_referencia",
      severidade: "aviso",
      detalhe: "A ficha possui mais ações com custo do que o limite de " + regras.acoesComCustoMax + " do livro.",
    });
  }
  for (const acao of acoesComCusto) {
    if (!Number.isInteger(acao.custoPE) || acao.custoPE < REFERENCIAS_ACAO_COM_CUSTO.custoMinimoPE
      || acao.custoPE > regras.custoMaximoAcaoComCustoPE) {
      avisos.push({
        codigo: "custo_de_acao_fora_referencia",
        severidade: "aviso",
        detalhe: "O custo da ação deve ser de 1 a " + regras.custoMaximoAcaoComCustoPE + " PE segundo a referência do grau.",
      });
    }
    if (acao.tipo !== "acao_complexa") {
      avisos.push({
        codigo: "acao_com_custo_exige_acao_complexa",
        severidade: "aviso",
        detalhe: "O livro exige que uma ação com custo use pelo menos uma Ação Complexa.",
      });
    }
  }

  const valoresCalculados = valoresShikigami(
    ficha.grau,
    ficha.atributos,
    ficha.nivelUsuario,
    ficha.bonusTreinamentoUsuario,
  );
  const custoEsperado = custoInvocacaoComOpcoes(ficha.grau, opcoes);
  const esperados = {
    pv: valoresCalculados.pv,
    defesa: valoresCalculados.defesa,
    deslocamentoM: valoresCalculados.deslocamentoM,
    custoInvocacaoPE: custoEsperado,
  } as const;
  for (const chave of Object.keys(ficha.valoresAtuais ?? {}) as (keyof typeof esperados)[]) {
    const atual = ficha.valoresAtuais?.[chave];
    if (atual === undefined) continue;
    if (!Number.isFinite(atual)) {
      avisos.push({
        codigo: "valor_derivado_invalido",
        severidade: "erro",
        detalhe: "O valor de " + chave + " precisa ser finito.",
      });
    } else if (atual !== esperados[chave]) {
      avisos.push({
        codigo: "valor_derivado_divergente",
        severidade: "aviso",
        detalhe: chave + " difere da referência calculada pelo livro (" + esperados[chave] + ").",
      });
    }
  }
  return avisos;
}

export function valoresShikigami(
  grau: GrauShikigami,
  atributos: AtributosShikigami,
  nivel: number,
  treino: number = getTrainingBonusByLevel(nivel),
) {
  const regras = TABELA[grau];
  const nivelAtual = nivelInteiro(nivel);
  const constituicao = regras.constInteira
    ? atributos.constituicao
    : Math.floor(atributos.constituicao / 2);
  const modificadorDestreza = modificadorAtributoShikigami(atributos.destreza);
  const pv = Math.floor(regras.pvBase + constituicao + regras.fatorNivel * nivelAtual);
  return {
    pv,
    defesa: regras.defesaBase + modificadorDestreza + treino,
    deslocamentoM: 9,
    custoPE: regras.custo,
  };
}

/** Livro: duas invocações no primeiro nível e +1 a cada três níveis após o 1º. */
export function invocacoesConhecidasPeloLivro(nivel: number): number {
  return 2 + Math.floor((nivelInteiro(nivel) - 1) / 3);
}

/** Padrão de 1 invocação em campo; Controle aumenta o limite do Controlador. */
export function limiteInvocacoesAtivas(treinoControle = 0): number {
  const treinamento = Number.isFinite(treinoControle) ? Math.max(0, Math.trunc(treinoControle)) : 0;
  return 1 + treinamento;
}

export function limiteAtivasPersonagem(especializacao: string, treinoControle = 0): number {
  return especializacao === "Controlador" ? limiteInvocacoesAtivas(treinoControle) : 1;
}
