/** Regras de cálculo para Hordas, conforme o texto-base de Invocações e as
 * decisões aprovadas em controlador_especificacao_complementar.md.
 * A montagem/materialização no mapa ainda é responsabilidade do fluxo de combate.
 */

export type GrauHorda = "quarto" | "terceiro" | "segundo" | "primeiro" | "especial";

/** Líder excluído: estes são aumentos, não multiplicadores do valor rolado. */
export function calcularEscalaHorda(membros: readonly { grau: GrauHorda }[]) {
  const segundo = membros.filter(membro => membro.grau === 'segundo').length;
  return {
    niveisAtaqueCura: membros.length + segundo,
    bonusDefesaAcerto: Math.floor(segundo / 2),
    niveisDanoAuxilio: Math.floor(membros.length / 2),
    rdAuxilio: membros.length,
    categoriasTamanho: Math.floor(membros.length / 2),
    usosAntesPrejuizo: 1 + Math.floor(membros.length / 2),
  };
}

export function calcularPrejuizoRepeticaoHorda(usosAnteriores: number, membros: readonly { grau: GrauHorda }[]): number {
  return Math.floor(Math.max(0, usosAnteriores) / calcularEscalaHorda(membros).usosAntesPrejuizo);
}

/** Sequência de portes já utilizada por PORTES_REPLICA; tamanho não multiplica dano. */
export function calcularTamanhoEfetivoHorda(base: string, membros: readonly { grau: GrauHorda }[]) {
  const portes = ['Minúsculo', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Colossal'];
  const indice = portes.indexOf(base);
  if (indice < 0) return { tamanho: base, categoria: undefined };
  const categoria = indice + calcularEscalaHorda(membros).categoriasTamanho;
  return { categoria, tamanho: portes[categoria] ?? `Colossal +${categoria - 5} categoria(s)` };
}

/** Detecta cruzamento; não resolve PV, desempate ou destino sem decisão do Mestre. */
export function verificarPerdaMembrosHorda(pvAntes: number, pvDepois: number, pvMaximo: number, membros: number) {
  const pendente = pvAntes > pvMaximo / 2 && pvDepois <= pvMaximo / 2;
  return { pendente, quantidade: pendente ? Math.floor(membros / 2) : 0 };
}

export interface LimiarPerdaHorda {
  armado: boolean;
  curaAcumulada: number;
  pvMaximoReferencia: number;
  totalAtivacoes: number;
}

/** Decisão da mesa: cura efetiva acumulada, sem contar PVT ou cura excedente. */
export function acumularCuraParaLimiarHorda(limiar: LimiarPerdaHorda, curaEfetiva: number): LimiarPerdaHorda {
  if (limiar.armado) return { ...limiar };
  const curaAcumulada = limiar.curaAcumulada + Math.max(0, curaEfetiva);
  return { ...limiar, curaAcumulada, armado: curaAcumulada >= limiar.pvMaximoReferencia * 0.25 };
}

/** Regras aprovadas pelo usuário nesta sessão, não atribuídas ao livro. */
export function resolverPerdaMembrosHorda<T extends {
  modeloId: string; grau: GrauHorda; pvMaximoAntes: number; ordemEntrada?: number;
}>(input: { pvAntes: number; pvDepois: number; pvMaximo: number; membros: readonly T[]; limiar?: LimiarPerdaHorda }) {
  const semPerda = { membros: [...input.membros], removidos: [] as T[], pvAtual: input.pvDepois,
    pvMaximo: input.pvMaximo, limiar: input.limiar };
  const quantidade = Math.floor(input.membros.length / 2);
  if (input.limiar?.armado === false || quantidade === 0 ||
      !verificarPerdaMembrosHorda(input.pvAntes, input.pvDepois, input.pvMaximo, input.membros.length).pendente) return semPerda;
  const ordenados = input.membros.map((membro, index) => ({ membro, entrada: membro.ordemEntrada ?? index }))
    .sort((a, b) => ORDEM_GRAU[a.membro.grau] - ORDEM_GRAU[b.membro.grau] || b.entrada - a.entrada ||
      (a.membro.modeloId < b.membro.modeloId ? -1 : a.membro.modeloId > b.membro.modeloId ? 1 : 0));
  const removidos = ordenados.slice(0, quantidade).map(item => item.membro);
  const ids = new Set(removidos.map(membro => membro.modeloId));
  const pvMaximo = input.pvMaximo - removidos.reduce((total, membro) => total + membro.pvMaximoAntes / 2, 0);
  if (pvMaximo <= 0) throw new Error('A composição da Horda não pode remover o PV máximo do líder.');
  return {
    membros: input.membros.filter(membro => !ids.has(membro.modeloId)), removidos,
    pvAtual: input.pvDepois / input.pvMaximo * pvMaximo, pvMaximo,
    limiar: { armado: false, curaAcumulada: 0, pvMaximoReferencia: pvMaximo,
      totalAtivacoes: (input.limiar?.totalAtivacoes ?? 0) + 1 },
  };
}

export interface InvocacaoComponenteHorda {
  id: string;
  grau: GrauHorda;
  pvAtual: number;
  pvMaximo: number;
  custoInvocacaoPE: number;
}

export interface ConfiguracaoTempoHorda {
  quantidade: number;
  unidade: string;
}

export interface CalcularHordaInput {
  id: string;
  lider: InvocacaoComponenteHorda;
  membros: readonly InvocacaoComponenteHorda[];
  nivelDono: number;
  maximoInvocacoesEmCampo: number;
  /** A Horda recebe uma única contribuição de tempo, informada para a entidade. */
  tempoAdicional: ConfiguracaoTempoHorda;
}

export interface HordaCalculada {
  id: string;
  liderId: string;
  membrosIds: string[];
  quantidadeMembros: number;
  /** Vagas de invocação ocupadas: líder mais cada integrante da composição. */
  vagasInvocacao: number;
  pvAtual: number;
  pvMaximo: number;
  custoInvocacaoPE: number;
  tempoAdicional: ConfiguracaoTempoHorda;
  efeitos: {
    categoriasTamanhoAdicionais: number;
    usosAntesPrejuizoMultiplo: number;
    regraDeAlvo: {
      ocupaUmEspaco: true;
      contaComoUmAlvo: true;
      aoSerAtingidaPorArea: "fragilizada";
      alvoUnico: { rd: number; rdNaoPodeSerNegada: true };
      atravessamento: { inimigosPodemOcupar: true; terrenoDificil: true; flanqueado: true };
    };
  };
}

/** Cada modelo que compõe uma Horda ocupa uma vaga de invocação, mesmo sob um token compartilhado. */
export function vagasInvocacaoEmCampo(token: {
  invocationHordeId?: string;
  invocationHordeMemberIds?: readonly string[];
}): number {
  return token.invocationHordeId ? 1 + (token.invocationHordeMemberIds?.length ?? 0) : 1;
}

export type TipoAlvoDanoHorda = "unico" | "area";

/**
 * Resolve a RD de uma invocação atingida. Hordas ignoram toda RD/resistência
 * quando a fonte é uma área; contra alvo único, somam o nível do Controlador
 * à RD normal da invocação. O bônus especial não entra no cálculo de negação.
 */
export function calcularReducaoDanoHorda(input: {
  ehHorda: boolean;
  tipoAlvo: TipoAlvoDanoHorda;
  rdBase: number;
  nivelDono: number;
}): number {
  const rdBruta = Number.isFinite(input.rdBase) ? input.rdBase : 0;
  if (!input.ehHorda) return rdBruta;
  const rdBase = Math.max(0, rdBruta);
  if (input.tipoAlvo === "area") return 0;
  const nivelDono = Number.isFinite(input.nivelDono) ? Math.max(0, Math.floor(input.nivelDono)) : 0;
  return rdBase + nivelDono;
}

export type ResultadoCalculoHorda =
  | { ok: true; horda: HordaCalculada }
  | { ok: false; codigo: string; motivo: string };

const ORDEM_GRAU: Record<GrauHorda, number> = {
  quarto: 1,
  terceiro: 2,
  segundo: 3,
  primeiro: 4,
  especial: 5,
};

const CUSTO_ADICIONAL_MEMBRO: Partial<Record<GrauHorda, number>> = {
  quarto: 1,
  terceiro: 2,
  segundo: 3,
};

function erro(codigo: string, motivo: string): ResultadoCalculoHorda {
  return { ok: false, codigo, motivo };
}

function componenteValido(invocacao: InvocacaoComponenteHorda): boolean {
  return Boolean(invocacao.id.trim())
    && Number.isFinite(invocacao.pvAtual)
    && Number.isFinite(invocacao.pvMaximo)
    && invocacao.pvMaximo > 0
    && invocacao.pvAtual >= 0
    && invocacao.pvAtual <= invocacao.pvMaximo
    && Number.isFinite(invocacao.custoInvocacaoPE)
    && invocacao.custoInvocacaoPE >= 0
    && Object.hasOwn(ORDEM_GRAU, invocacao.grau);
}

/** Metade arredondada para baixo, como definido pelo usuário para o limite. */
export function limiteHordasAtivas(limiteInvocacoesEmCampo: number): number {
  if (!Number.isFinite(limiteInvocacoesEmCampo) || limiteInvocacoesEmCampo <= 0) return 0;
  return Math.floor(limiteInvocacoesEmCampo / 2);
}

export interface ValidarLimiteHordaInput {
  limiteInvocacoesEmCampo: number;
  hordasAtivas: number;
  /** Invocações individuais que continuam em campo após converter os membros. */
  invocacoesIndividuaisAposCriacao: number;
  /** Vagas ocupadas por todas as Hordas que já estão em campo. */
  vagasOcupadasPorHordas?: number;
  /** Vagas reservadas pela nova Horda; legado assume uma vaga. */
  vagasNovaHorda?: number;
}

export function validarLimiteHorda(
  input: ValidarLimiteHordaInput,
): { ok: true } | { ok: false; codigo: string; motivo: string } {
  const { limiteInvocacoesEmCampo, hordasAtivas, invocacoesIndividuaisAposCriacao } = input;
  const vagasOcupadasPorHordas = input.vagasOcupadasPorHordas ?? hordasAtivas;
  const vagasNovaHorda = input.vagasNovaHorda ?? 1;
  if (![limiteInvocacoesEmCampo, hordasAtivas, invocacoesIndividuaisAposCriacao, vagasOcupadasPorHordas, vagasNovaHorda].every(Number.isInteger)
      || limiteInvocacoesEmCampo < 0 || hordasAtivas < 0 || invocacoesIndividuaisAposCriacao < 0 || vagasOcupadasPorHordas < 0 || vagasNovaHorda < 1) {
    return { ok: false, codigo: "limite_invalido", motivo: "Os limites e as quantidades precisam ser inteiros não negativos." };
  }

  const limiteHordas = limiteHordasAtivas(limiteInvocacoesEmCampo);
  if (hordasAtivas >= limiteHordas) {
    return { ok: false, codigo: "limite_hordas", motivo: `O limite atual permite ${limiteHordas} Horda(s) em campo.` };
  }
  if (invocacoesIndividuaisAposCriacao + vagasOcupadasPorHordas + vagasNovaHorda > limiteInvocacoesEmCampo) {
    return { ok: false, codigo: "limite_invocacoes_em_campo", motivo: "A composição da Horda ultrapassa o limite de vagas de invocação em campo." };
  }
  return { ok: true };
}

/** Calcula os valores compartilhados; não cria vários tokens nem relógios por membro. */
export function calcularHorda(input: CalcularHordaInput): ResultadoCalculoHorda {
  const { id, lider, membros, nivelDono, maximoInvocacoesEmCampo, tempoAdicional } = input;
  if (!id.trim()) return erro("id_invalido", "A Horda precisa de um identificador.");
  if (!componenteValido(lider)) return erro("lider_invalido", "Os dados do líder da Horda são inválidos.");
  if (lider.grau === "especial") {
    return erro("grau_lider_invalido", "O texto-base exige líder de Primeiro Grau ou inferior.");
  }
  if (!Number.isInteger(nivelDono) || nivelDono < 1) return erro("nivel_dono_invalido", "O nível do dono precisa ser um inteiro positivo.");
  if (!Number.isInteger(maximoInvocacoesEmCampo) || maximoInvocacoesEmCampo < 0) {
    return erro("limite_invalido", "O limite de invocações em campo precisa ser um inteiro não negativo.");
  }
  if (membros.length > Math.max(0, maximoInvocacoesEmCampo - 1)) {
    return erro("limite_membros", "A Horda excede o número de membros permitido pelo limite em campo, desconsiderando o líder.");
  }
  if (!Number.isFinite(tempoAdicional.quantidade) || tempoAdicional.quantidade < 0 || !tempoAdicional.unidade.trim()) {
    return erro("tempo_invalido", "Defina um único tempo válido para a Horda.");
  }

  const ids = new Set([lider.id]);
  for (const membro of membros) {
    if (!componenteValido(membro)) return erro("membro_invalido", "Os dados de um membro da Horda são inválidos.");
    if (ids.has(membro.id)) return erro("membro_duplicado", "O líder ou um membro foi selecionado mais de uma vez.");
    ids.add(membro.id);
    if (ORDEM_GRAU[membro.grau] >= ORDEM_GRAU[lider.grau]) {
      return erro("grau_membro_invalido", "Os membros precisam ter grau inferior ao líder da Horda.");
    }
    if (CUSTO_ADICIONAL_MEMBRO[membro.grau] === undefined) {
      return erro("custo_membro_indefinido", "O texto-base não define o custo adicional para este grau de membro.");
    }
  }

  const pvAtual = lider.pvAtual + membros.reduce((total, membro) => total + membro.pvAtual / 2, 0);
  const pvMaximo = lider.pvMaximo + membros.reduce((total, membro) => total + membro.pvMaximo / 2, 0);
  const custoInvocacaoPE = lider.custoInvocacaoPE + membros.reduce(
    (total, membro) => total + CUSTO_ADICIONAL_MEMBRO[membro.grau]!,
    0,
  );
  const categoriasTamanhoAdicionais = Math.floor(membros.length / 2);

  return {
    ok: true,
    horda: {
      id,
      liderId: lider.id,
      membrosIds: membros.map(membro => membro.id),
      quantidadeMembros: membros.length,
      vagasInvocacao: membros.length + 1,
      pvAtual,
      pvMaximo,
      custoInvocacaoPE,
      tempoAdicional: { quantidade: tempoAdicional.quantidade, unidade: tempoAdicional.unidade.trim() },
      efeitos: {
        categoriasTamanhoAdicionais,
        usosAntesPrejuizoMultiplo: 1 + categoriasTamanhoAdicionais,
        regraDeAlvo: {
          ocupaUmEspaco: true,
          contaComoUmAlvo: true,
          aoSerAtingidaPorArea: "fragilizada",
          alvoUnico: { rd: nivelDono, rdNaoPodeSerNegada: true },
          atravessamento: { inimigosPodemOcupar: true, terrenoDificil: true, flanqueado: true },
        },
      },
    },
  };
}
