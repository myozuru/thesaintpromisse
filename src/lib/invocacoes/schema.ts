import { z } from "zod";

const idSchema = z.string().trim().min(1).max(256);
const textSchema = z.string().trim().min(1);
const finiteNumberSchema = z.number().finite();
const nonNegativeNumberSchema = finiteNumberSchema.min(0);
const nonNegativeIntSchema = z.number().int().min(0);

export const INVOCACAO_SCHEMA_VERSION = 1 as const;

export const CategoriaEconomiaInvocacaoSchema = z.enum([
  "acaoComum",
  "acaoSimples",
  "acaoComplexa",
  "acaoMovimento",
  "acaoBonus",
  "acaoLivre",
  "reacao",
]);
export type CategoriaEconomiaInvocacao = z.infer<typeof CategoriaEconomiaInvocacaoSchema>;

export const LimiteResetEconomiaInvocacaoSchema = z.enum([
  "inicio_turno_dono",
  "inicio_rodada",
  "inicio_combate",
  "manual",
]);
export type LimiteResetEconomiaInvocacao = z.infer<typeof LimiteResetEconomiaInvocacaoSchema>;

const ResetPorCategoriaEconomiaSchema = z.object({
  acaoComum: LimiteResetEconomiaInvocacaoSchema.optional(),
  acaoSimples: LimiteResetEconomiaInvocacaoSchema.optional(),
  acaoComplexa: LimiteResetEconomiaInvocacaoSchema.optional(),
  acaoMovimento: LimiteResetEconomiaInvocacaoSchema.optional(),
  acaoBonus: LimiteResetEconomiaInvocacaoSchema.optional(),
  acaoLivre: LimiteResetEconomiaInvocacaoSchema.optional(),
  reacao: LimiteResetEconomiaInvocacaoSchema.optional(),
}).strict();

const RecargaAcaoSchema = z.object({
  quantidade: z.number().int().min(1),
  unidade: z.enum(["inicio_turno_dono", "inicio_rodada", "manual"]),
}).strict();

const RecargaRecursoSchema = z.object({
  quantidade: finiteNumberSchema.positive(),
  unidade: LimiteResetEconomiaInvocacaoSchema,
}).strict();

export const TipoModeloInvocacaoSchema = z.enum([
  "shikigami",
  "corpo_amaldicoado",
  "maldicao_domada",
]);
export type TipoModeloInvocacao = z.infer<typeof TipoModeloInvocacaoSchema>;

const TipoDanoInvocacaoSchema = z.enum([
  "DCO", "DP", "DI", "DA", "DCG", "DCC", "DQ", "DS", "DAL", "DNR", "DE", "DPS", "DR", "DN", "DV",
]);

export const ConfiguracaoEfeitoSuporteInvocacaoSchema = z.object({
  efeito: z.enum(["cura", "defesa", "acerto", "dano_adicional", "reducao_dano"]),
  alvos: z.enum(["unico", "multiplos"]).default("unico"),
  atributoCura: z.enum(["sabedoria", "presenca"]).optional(),
  tiposDano: z.array(TipoDanoInvocacaoSchema).min(1).max(15).optional(),
}).strict().superRefine((config, ctx) => {
  if (config.efeito !== "cura" && config.alvos === "multiplos") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["alvos"], message: "Apenas ações de cura podem afetar múltiplos alvos nesta versão." });
  }
  if (config.efeito === "reducao_dano" && !config.tiposDano?.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tiposDano"], message: "Escolha ao menos um tipo de dano para reduzir." });
  }
  if (config.efeito !== "reducao_dano" && config.tiposDano?.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tiposDano"], message: "Tipos de dano só se aplicam à redução de dano." });
  }
});
export type ConfiguracaoEfeitoSuporteInvocacao = z.infer<typeof ConfiguracaoEfeitoSuporteInvocacaoSchema>;

export const EfeitoPassivoInvocacaoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("pv_maximo") }).strict(),
  z.object({ tipo: z.literal("bonus_pericia"), pericia: idSchema }).strict(),
  z.object({ tipo: z.literal("reducao_dano"), tipoDano: TipoDanoInvocacaoSchema }).strict(),
]);
export type EfeitoPassivoInvocacao = z.infer<typeof EfeitoPassivoInvocacaoSchema>;

export const EstadoAquisicaoInvocacaoSchema = z.object({
  estado: z.enum(["pendente", "aprovada", "rejeitada"]),
  fonte: z.enum(["mestre", "legado"]),
  inferida: z.boolean().optional(),
  versaoAprovada: z.number().int().min(1).optional(),
}).strict();
export type EstadoAquisicaoInvocacao = z.infer<typeof EstadoAquisicaoInvocacaoSchema>;

export const CampoDerivadoInvocacaoSchema = z.discriminatedUnion("modo", [
  z.object({ modo: z.literal("automatico") }).strict(),
  z.object({ modo: z.literal("manual"), valor: z.unknown() }).strict(),
  z.object({
    modo: z.literal("revisao_necessaria"),
    valorPreservado: z.unknown(),
    motivo: textSchema,
  }).strict(),
]);
export type CampoDerivadoInvocacao = z.infer<typeof CampoDerivadoInvocacaoSchema>;

export const ConfiguracaoTempoInvocacaoSchema = z.object({
  quantidade: nonNegativeNumberSchema,
  unidade: textSchema.max(32),
}).strict();
export type ConfiguracaoTempoInvocacao = z.infer<typeof ConfiguracaoTempoInvocacaoSchema>;

const IntermediarioInvocacaoSchema = z.object({
  tipo: z.enum(["talisma", "dispositivo", "tecnica"]),
  itemInventarioId: idSchema.optional(),
  tecnicaId: idSchema.optional(),
}).passthrough();

export const AcaoInvocacaoSchema = z.object({
  id: idSchema,
  nome: textSchema,
  tipoExecucao: z.enum(["omni", "referencia_omni", "manual", "legada"]),
  tipo: z.enum(["ataque", "habilidade", "movimento", "bonus", "suporte"]).optional(),
  efeitoSuporte: ConfiguracaoEfeitoSuporteInvocacaoSchema.optional(),
  /** Fluxo de rolagem usado pela ação manual desta ficha. */
  teste: z.enum(["ataque", "resistencia"]).optional(),
  tipoAtaque: z.enum(["corpo_a_corpo", "distancia"]).optional(),
  atributoAtaque: z.enum(["forca", "destreza"]).optional(),
  atributoDano: z.enum(["forca", "destreza", "constituicao", "inteligencia", "sabedoria", "presenca"]).optional(),
  /** Multiplicador do modificador do atributo no dano; ausente usa a regra do grau. */
  multiplicadorDanoAtributo: z.number().int().min(0).max(5).optional(),
  resistenciaAlvo: z.string().trim().min(1).max(80).optional(),
  atributoCD: z.enum(["forca", "destreza", "constituicao", "inteligencia", "sabedoria", "presenca"]).optional(),
  danoNoSucesso: z.enum(["nenhum", "metade"]).optional(),
  margemCritico: z.number().int().min(2).max(20).optional(),
  multiplicadorCritico: z.number().int().min(1).max(5).optional(),
  categoriaAcao: z.enum(["acao_comum", "acao_simples", "acao_complexa", "acao_bonus", "movimento", "livre", "reacao"]).optional(),
  custoPE: nonNegativeNumberSchema.optional(),
  /** Descrição textual legada; não é interpretada como regra de recarga. */
  recarga: z.string().optional(),
  entidadeOmniId: idSchema.optional(),
  acaoOmniId: idSchema.optional(),
  payloadLegado: z.unknown().optional(),
  /** Recarga estruturada; o campo textual legado `recarga` continua preservado. */
  recargaConfigurada: RecargaAcaoSchema.optional(),
}).passthrough();
export type AcaoInvocacao = z.infer<typeof AcaoInvocacaoSchema>;

export const RecursoInvocacaoSchema = z.object({
  id: idSchema,
  nome: textSchema,
  valorInicial: finiteNumberSchema,
  valorMaximo: finiteNumberSchema.optional(),
  recargaConfigurada: RecargaRecursoSchema.optional(),
  recarga: z.string().optional(),
}).passthrough().superRefine((recurso, ctx) => {
  if (recurso.valorMaximo !== undefined && recurso.valorInicial > recurso.valorMaximo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["valorInicial"],
      message: "O valor inicial não pode exceder o máximo do recurso.",
    });
  }
});
export type RecursoInvocacao = z.infer<typeof RecursoInvocacaoSchema>;

const DebitoComandoInvocacaoSchema = z.object({
  entidade: z.enum(["dono", "invocacao"]),
  recurso: z.enum(["pe", "recurso"]),
  recursoId: idSchema.optional(),
  quantidade: nonNegativeNumberSchema,
}).strict().superRefine((debito, ctx) => {
  if (debito.entidade === "invocacao" && !debito.recursoId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recursoId"], message: "Selecione o recurso que será debitado." });
  }
  if (debito.entidade === "dono" && debito.recurso !== "pe") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recurso"], message: "Esta versão só pode debitar PE configurado no personagem dono." });
  }
});

export const CustoComandoInvocacaoSchema = z.object({
  execucao: z.enum(["manual", "evento_automatico"]),
  debitos: z.array(DebitoComandoInvocacaoSchema).max(10),
}).strict();
export type CustoComandoInvocacao = z.infer<typeof CustoComandoInvocacaoSchema>;

const EconomiaConfiguradaSchema = z.object({
  acaoComum: nonNegativeIntSchema.optional(),
  acaoSimples: nonNegativeIntSchema.optional(),
  acaoComplexa: nonNegativeIntSchema.optional(),
  acaoMovimento: nonNegativeIntSchema.optional(),
  acaoBonus: nonNegativeIntSchema.optional(),
  acaoLivre: nonNegativeIntSchema.optional(),
  reacao: nonNegativeIntSchema.optional(),
  /** Sem política explícita, o saldo não se reinicia automaticamente. */
  resetPorCategoria: ResetPorCategoriaEconomiaSchema.optional(),
}).strict();

const AutomacaoOmniSchema = z.object({
  id: idSchema,
  habilitada: z.boolean(),
  prioridade: z.number().int().optional(),
  entidadeOmniId: idSchema.optional(),
  gatilhoId: idSchema,
  condicaoAST: z.unknown().optional(),
  acaoId: idSchema,
  politicaCusto: z.enum(["manual", "permitir_pe", "preferir_sem_custo"]).optional(),
  politicaAlvo: z.enum(["manual", "prioridade", "ameaca_mais_proxima"]).optional(),
  limitePorRodada: nonNegativeIntSchema.optional(),
  revisao: z.number().int().min(1).optional(),
}).passthrough();

const AutonomiaInvocacaoSchema = z.object({
  modo: z.enum(["manual", "misto", "automatico"]),
  prioridadeAlvo: z.string().optional(),
  politicaAlvo: z.enum(["manual", "prioridade", "ameaca_mais_proxima"]).optional(),
  politicaCusto: z.enum(["manual", "permitir_pe", "preferir_sem_custo"]).optional(),
  limitePorRodada: nonNegativeIntSchema.optional(),
}).passthrough();

const ReacaoInvocacaoSchema = z.object({
  id: idSchema,
  /** A reação aponta para uma ação OMNI da própria ficha. */
  acaoId: idSchema.optional(),
  solicitarConfirmacao: z.boolean().default(true),
}).passthrough();

const EstadoLegadoSchema = z.object({
  hpAtual: finiteNumberSchema.optional(),
  hpMaximo: finiteNumberSchema.optional(),
  defesa: finiteNumberSchema.optional(),
  deslocamentoM: finiteNumberSchema.optional(),
  custoInvocacaoPE: finiteNumberSchema.optional(),
  custoSustentacaoPE: finiteNumberSchema.optional(),
}).passthrough();

export const ModeloInvocacaoSchema = z.object({
  schemaVersion: z.literal(INVOCACAO_SCHEMA_VERSION),
  version: z.number().int().min(1),
  id: idSchema,
  donoCharacterId: idSchema,
  donoProfileId: idSchema.optional(),
  tipo: TipoModeloInvocacaoSchema,
  nome: textSchema.max(160),
  apelido: z.string().max(160).optional(),
  nivelEvolucao: nonNegativeIntSchema.optional(),
  atributoBasePericias: z.enum(["inteligencia", "sabedoria"]).optional(),
  subcategoria: z.string().max(160).optional(),
  descricao: z.string().optional(),
  historico: z.string().optional(),
  origem: z.object({ tipo: textSchema }).passthrough().optional(),
  origemAquisicao: z.string().optional(),
  referenciaInterludio: idSchema.optional(),
  grau: z.string().optional(),
  /** Capacidade inata que permite converter ações de suporte em cura real. */
  possuiEnergiaReversa: z.boolean().optional(),
  imagemAssetId: idSchema.optional(),
  imagemFallbackAssetId: idSchema.optional(),
  imagemAltText: z.string().optional(),
  corIdentificacao: z.string().optional(),
  nomeplate: z.boolean().optional(),
  formaToken: z.enum(["ELLIPSE", "RECT"]).optional(),
  tokenCrop: z.unknown().optional(),
  estiloToken: z.string().optional(),
  tamanho: z.string().optional(),
  intermediario: IntermediarioInvocacaoSchema.optional(),
  atributos: z.record(z.string(), finiteNumberSchema).optional(),
  valoresDerivados: z.record(z.string(), CampoDerivadoInvocacaoSchema).optional(),
  estadoLegado: EstadoLegadoSchema.optional(),
  periciasTreinadas: z.array(z.string()).optional(),
  ataqueTreinado: z.unknown().optional(),
  resistenciaTreinada: z.unknown().optional(),
  recursosConfigurados: z.array(RecursoInvocacaoSchema).optional(),
  acoes: z.array(AcaoInvocacaoSchema).optional(),
  caracteristicas: z.array(z.unknown()).optional(),
  reacoes: z.array(ReacaoInvocacaoSchema).optional(),
  automacoesOmni: z.array(AutomacaoOmniSchema).optional(),
  omniConfiguracao: z.object({ entidadeId: idSchema.optional(), acaoId: idSchema.optional(), gatilhoId: idSchema.optional(), chave: z.string().optional(), formula: z.string().optional(), efeito: z.string().optional(), alvos: z.string().optional(), area: z.string().optional(), sustentacao: z.string().optional(), contador: z.string().optional(), diagnosticos: z.string().optional() }).passthrough().optional(),
  autonomia: AutonomiaInvocacaoSchema.optional(),
  economiaAcoesConfigurada: EconomiaConfiguradaSchema.optional(),
  registroEvolucao: z.array(z.unknown()).optional(),
  /** Mantém a ficha arquivada quando o Controlador/Mestre declara perda permanente. */
  perdaPermanente: z.boolean().optional(),
  regrasRecuperacao: z.object({ derrotaPorPVNegativo: z.literal("menos_cem_por_cento_pv_maximo"), curaAcimaDeZeroLevanta: z.literal(false), acaoParaLevantar: z.literal("acao_de_movimento_propria"), dissipacaoVoluntariaMinSegundos: z.literal(10), contribuicaoNaDerrotaDefinitiva: z.literal("preservar_saldo_restante") }).strict().optional(),
  custosComandosConfigurados: z.record(z.string(), CustoComandoInvocacaoSchema).optional(),
  tempoAdicional: ConfiguracaoTempoInvocacaoSchema.optional(),
  aquisicao: EstadoAquisicaoInvocacaoSchema,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  snapshotLegado: z.record(z.string(), z.unknown()).optional(),
}).passthrough().superRefine((modelo, ctx) => {
  for (const [index, reacao] of (modelo.reacoes ?? []).entries()) {
    if (!reacao.acaoId) continue; // preserva reações textuais antigas sem executá-las.
    const acao = modelo.acoes?.find(item => item.id === reacao.acaoId);
    if (!acao) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reacoes", index, "acaoId"], message: "A reação precisa apontar para uma ação da ficha." });
    } else if (acao.categoriaAcao !== "reacao" || (acao.tipoExecucao !== "omni" && acao.tipoExecucao !== "referencia_omni")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reacoes", index, "acaoId"], message: "A ação vinculada precisa ser uma ação OMNI da categoria Reação." });
    }
  }
});
export type ModeloInvocacao = z.infer<typeof ModeloInvocacaoSchema>;

const SaldoAcaoSchema = z.object({
  atual: nonNegativeIntSchema,
  maximo: nonNegativeIntSchema,
}).strict().superRefine((saldo, ctx) => {
  if (saldo.atual > saldo.maximo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["atual"],
      message: "O saldo atual não pode exceder o máximo.",
    });
  }
});

const EconomiaInstanciaSchema = z.object({
  acaoComum: SaldoAcaoSchema.optional(),
  acaoSimples: SaldoAcaoSchema.optional(),
  acaoComplexa: SaldoAcaoSchema.optional(),
  acaoMovimento: SaldoAcaoSchema.optional(),
  acaoBonus: SaldoAcaoSchema.optional(),
  acaoLivre: SaldoAcaoSchema.optional(),
  reacao: SaldoAcaoSchema.optional(),
}).strict();

export const EfeitoSuporteAtivoInvocacaoSchema = z.object({
  id: idSchema,
  tipo: z.enum(["defesa", "acerto", "dano_adicional", "reducao_dano"]),
  valor: nonNegativeNumberSchema,
  formula: z.string().max(160).optional(),
  tiposDano: z.array(TipoDanoInvocacaoSchema).max(15).optional(),
  expiraNaRodada: nonNegativeIntSchema,
  consomeNoAtaque: z.boolean().optional(),
}).strict().superRefine((efeito, ctx) => {
  if (efeito.tipo === "dano_adicional" && !efeito.formula) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["formula"], message: "O bônus de dano precisa de uma fórmula." });
  }
  if (efeito.tipo === "reducao_dano" && !efeito.tiposDano?.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["tiposDano"], message: "A redução precisa de ao menos um tipo de dano." });
  }
});
export type EfeitoSuporteAtivoInvocacao = z.infer<typeof EfeitoSuporteAtivoInvocacaoSchema>;

export const ContribuicaoTempoInvocacaoSchema = z.object({
  id: idSchema,
  grantEventId: idSchema,
  ownerCharacterId: idSchema,
  combatId: idSchema.optional(),
  instanceId: idSchema,
  invocationId: idSchema,
  quantidadeConcedida: nonNegativeNumberSchema,
  quantidadeRestante: nonNegativeNumberSchema,
  unidade: textSchema.max(32),
  estado: z.enum(["ativa", "consumida", "retirada", "consolacao"]),
  createdAt: z.string().optional(),
  lastAccountingAt: z.string().optional(),
  removedAt: z.string().optional(),
  removalReason: z.string().optional(),
}).strict().superRefine((contribuicao, ctx) => {
  if (contribuicao.quantidadeRestante > contribuicao.quantidadeConcedida) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["quantidadeRestante"],
      message: "O saldo restante não pode exceder a contribuição concedida.",
    });
  }
});
export type ContribuicaoTempoInvocacao = z.infer<typeof ContribuicaoTempoInvocacaoSchema>;

export const ResolucaoDerrotaInvocacaoSchema = z.discriminatedUnion("resultado", [
  z.object({
    resultado: z.literal("recuperada"),
    pvNaDerrota: finiteNumberSchema,
    pvRecuperados: finiteNumberSchema.min(1),
    resolvidaEm: z.string(),
    resolvidaPorProfileId: idSchema.optional(),
  }).strict(),
  z.object({
    resultado: z.literal("perda_permanente"),
    pvNaDerrota: finiteNumberSchema,
    resolvidaEm: z.string(),
    resolvidaPorProfileId: idSchema.optional(),
  }).strict(),
]);
export type ResolucaoDerrotaInvocacao = z.infer<typeof ResolucaoDerrotaInvocacaoSchema>;

export const InstanciaInvocacaoSchema = z.object({
  schemaVersion: z.literal(INVOCACAO_SCHEMA_VERSION),
  version: z.number().int().min(1),
  id: idSchema,
  modeloId: idSchema,
  combateId: idSchema.optional(),
  donoCharacterId: idSchema,
  donoProfileId: idSchema.optional(),
  tokenId: idSchema,
  estado: z.enum(["ativa", "caida", "derrotada", "dissipada"]),
  hpAtual: finiteNumberSchema,
  hpMaximoAtual: finiteNumberSchema.min(1),
  /** Camada de Pontos de Vida Temporários absorvida antes dos PV. */
  pvTemporarios: nonNegativeNumberSchema.optional(),
  efeitosSuporteAtivos: z.array(EfeitoSuporteAtivoInvocacaoSchema).max(100).optional(),
  condicoes: z.array(z.unknown()).optional(),
  economiaAcoes: EconomiaInstanciaSchema.optional(),
  recursosAtuais: z.record(z.string(), finiteNumberSchema).optional(),
  /** Chaves de reset por escopo evitam reabastecimento duplicado no mesmo turno/rodada. */
  marcadoresResetEconomia: z.record(z.string(), idSchema).optional(),
  /** Evento de uso persistente por instância; protege comandos repetidos após refresh. */
  eventosAcoesProcessados: z.array(idSchema).optional(),
  deslocamentoUsado: z.boolean().optional(),
  usoAcaoComCusto: z.record(z.string(), z.unknown()).optional(),
  /** Contagem persistente por tipo de auxílio e rodada, individual desta instância. */
  usosAuxilioRodada: z.object({
    rodada: nonNegativeIntSchema,
    total: nonNegativeIntSchema.optional(),
    porEfeito: z.record(z.string(), nonNegativeIntSchema),
  }).strict().optional(),
  /** O dono ou o Mestre pode interromper a autonomia desta instância em campo. */
  automacaoSuspensa: z.boolean().optional(),
  /** Orçamento de automações da rodada; reentrada não restaura ações já executadas. */
  usosAutomacaoRodada: z.object({
    rodada: nonNegativeIntSchema,
    total: nonNegativeIntSchema,
    porAutomacao: z.record(z.string(), nonNegativeIntSchema),
  }).strict().optional(),
  recargas: z.record(z.string(), z.unknown()).optional(),
  duracoes: z.record(z.string(), z.unknown()).optional(),
  turnoCriacao: nonNegativeIntSchema.optional(),
  rodadaCriacao: nonNegativeIntSchema.optional(),
  eventoCriacaoId: idSchema.optional(),
  contribuicaoTempo: ContribuicaoTempoInvocacaoSchema.optional(),
  causasSaida: z.array(z.string()).optional(),
  /** Decisão manual após derrota; os dados da instância original permanecem auditáveis. */
  resolucaoDerrota: ResolucaoDerrotaInvocacaoSchema.optional(),
  createdAt: z.string().optional(),
}).passthrough().superRefine((instancia, ctx) => {
  if (instancia.hpAtual > instancia.hpMaximoAtual) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["hpAtual"],
      message: "PV da instância não pode exceder o PV máximo.",
    });
  }
  if (instancia.estado === "ativa" && instancia.hpAtual <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["estado"],
      message: "Uma instância ativa precisa ter PV acima de zero.",
    });
  }
  if (instancia.estado === "derrotada" && instancia.hpAtual > -instancia.hpMaximoAtual) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["estado"],
      message: "Derrota definitiva exige PV igual ou inferior a −PV máximo.",
    });
  }
  if (instancia.hpAtual <= -instancia.hpMaximoAtual && instancia.estado !== "derrotada") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["estado"],
      message: "PV no limiar de derrota definitiva precisa usar o estado derrotada.",
    });
  }
});
export type InstanciaInvocacao = z.infer<typeof InstanciaInvocacaoSchema>;

export const SolicitacaoAprovacaoInvocacaoSchema = z.object({
  id: idSchema,
  modeloId: idSchema,
  donoCharacterId: idSchema,
  versaoSubmetida: z.number().int().min(1),
  enviadoPorProfileId: idSchema.optional(),
  enviadoEm: z.string().optional(),
  estado: z.enum(["pendente", "aprovada", "rejeitada"]),
  revisadoPorProfileId: idSchema.optional(),
  revisadoEm: z.string().optional(),
  motivo: z.string().optional(),
  auditEventId: idSchema.optional(),
}).strict();
export type SolicitacaoAprovacaoInvocacao = z.infer<typeof SolicitacaoAprovacaoInvocacaoSchema>;

export interface AvisoMigracaoInvocacao {
  codigo: string;
  severidade: "aviso" | "erro";
  registroId?: string;
  detalhe: string;
}

export interface ResultadoMigracaoInvocacao<T> {
  ok: boolean;
  dados?: T;
  original: unknown;
  avisos: AvisoMigracaoInvocacao[];
}

function comoRegistro(valor: unknown): Record<string, unknown> | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  return valor as Record<string, unknown>;
}

function textoNaoVazio(valor: unknown): string | null {
  if (typeof valor !== "string" || !valor.trim()) return null;
  return valor.trim();
}

function aviso(
  codigo: string,
  detalhe: string,
  severidade: "aviso" | "erro" = "aviso",
  registroId?: string,
): AvisoMigracaoInvocacao {
  return { codigo, detalhe, severidade, ...(registroId ? { registroId } : {}) };
}

function resultadoFalho<T>(original: unknown, avisos: AvisoMigracaoInvocacao[]): ResultadoMigracaoInvocacao<T> {
  return { ok: false, original, avisos };
}

export function normalizarModeloInvocacao(valor: unknown): ResultadoMigracaoInvocacao<ModeloInvocacao> {
  const registro = comoRegistro(valor);
  if (!registro) {
    return resultadoFalho(valor, [aviso("registro_invalido", "O registro não é um objeto de ficha.", "erro")]);
  }

  if (registro.schemaVersion === INVOCACAO_SCHEMA_VERSION) {
    const atual = ModeloInvocacaoSchema.safeParse(registro);
    if (!atual.success) {
      return resultadoFalho(valor, atual.error.issues.map((issue) =>
        aviso("schema_atual_invalido", issue.message, "erro", textoNaoVazio(registro.id) ?? undefined),
      ));
    }
    return { ok: true, dados: atual.data, original: valor, avisos: [] };
  }
  if (registro.schemaVersion !== undefined) {
    return resultadoFalho(valor, [
      aviso("schema_version_desconhecida", "A versão deste modelo não pode ser migrada por esta versão do leitor.", "erro", textoNaoVazio(registro.id) ?? undefined),
    ]);
  }

  const id = textoNaoVazio(registro.id);
  const donoCharacterId = textoNaoVazio(registro.donoCharacterId);
  const nome = textoNaoVazio(registro.nome);
  const tipo = TipoModeloInvocacaoSchema.safeParse(registro.tipo);
  const avisos: AvisoMigracaoInvocacao[] = [];

  if (!id) avisos.push(aviso("id_ausente", "O modelo legado foi preservado, mas não pode ser convertido sem um ID estável.", "erro"));
  if (!donoCharacterId) avisos.push(aviso("dono_ausente", "O modelo legado foi preservado, mas não pode ser convertido sem o dono.", "erro", id ?? undefined));
  if (!nome) avisos.push(aviso("nome_ausente", "O modelo legado foi preservado, mas não pode ser convertido sem nome.", "erro", id ?? undefined));
  if (!tipo.success) avisos.push(aviso("tipo_invalido", "O tipo do modelo legado não é reconhecido.", "erro", id ?? undefined));

  let aquisicao: EstadoAquisicaoInvocacao;
  const aprovacaoLegada = registro.aprovacaoMestre;
  if (aprovacaoLegada === undefined) {
    aquisicao = { estado: "aprovada", fonte: "legado", inferida: true };
    avisos.push(aviso("aprovacao_legada_inferida", "Sem estado de aprovação, a ficha continua adquirida conforme a regra de compatibilidade.", "aviso", id ?? undefined));
  } else if (aprovacaoLegada === "pendente" || aprovacaoLegada === "aprovada" || aprovacaoLegada === "rejeitada") {
    aquisicao = { estado: aprovacaoLegada, fonte: "legado", inferida: false };
  } else {
    aquisicao = { estado: "pendente", fonte: "legado", inferida: false };
    avisos.push(aviso("aprovacao_invalida", "O valor de aprovação não foi interpretado; a ficha não pode ser convertida automaticamente.", "erro", id ?? undefined));
  }

  if (!id || !donoCharacterId || !nome || !tipo.success || avisos.some((item) => item.severidade === "erro")) {
    return resultadoFalho(valor, avisos);
  }

  const estadoLegado: Record<string, unknown> = {};
  const valoresDerivados: Record<string, CampoDerivadoInvocacao> = {};
  const campos = [
    "hpAtual",
    "hpMaximo",
    "defesa",
    "deslocamentoM",
    "custoInvocacaoPE",
    "custoSustentacaoPE",
  ] as const;

  for (const campo of campos) {
    if (!Object.prototype.hasOwnProperty.call(registro, campo)) continue;
    const valorCampo = registro[campo];
    if (typeof valorCampo === "number" && Number.isFinite(valorCampo)) {
      estadoLegado[campo] = valorCampo;
    } else {
      avisos.push(aviso("valor_legado_invalido", "O valor legado de " + campo + " foi mantido no snapshot para revisão.", "aviso", id));
    }
    if (campo !== "hpAtual") {
      valoresDerivados[campo] = {
        modo: "revisao_necessaria",
        valorPreservado: valorCampo,
        motivo: "A ficha antiga não registra se este valor era automático ou manual.",
      };
    }
  }

  if (!textoNaoVazio(registro.donoProfileId)) {
    avisos.push(aviso("perfil_de_dono_ausente", "O perfil do dono não foi inferido a partir do ID do personagem.", "aviso", id));
  }
  if (!registro.intermediario) {
    avisos.push(aviso("intermediario_nao_configurado", "A ficha antiga não contém vínculo de intermediário; nenhuma referência foi inventada.", "aviso", id));
  }
  if (registro.tempoAdicional === undefined) {
    if (registro.tempoExtraSegundos === undefined) {
      avisos.push(aviso("tempo_nao_configurado", "Nenhum valor ou unidade de tempo foi inferido para a ficha antiga.", "aviso", id));
    } else {
      avisos.push(aviso("tempo_legado_requer_revisao", "O tempo legado permanece no snapshot; sua semântica precisa ser confirmada antes de configurar uma contribuição.", "aviso", id));
    }
  }
  if (!Array.isArray(registro.acoes)) {
    avisos.push(aviso("acoes_ausentes", "A ficha não possui uma lista de ações legada reconhecível; os dados originais foram preservados.", "aviso", id));
  }

  const acoes: Array<z.infer<typeof AcaoInvocacaoSchema>> = [];
  if (Array.isArray(registro.acoes)) {
    for (const acaoValor of registro.acoes) {
      const acao = comoRegistro(acaoValor);
      const acaoId = textoNaoVazio(acao?.id);
      const acaoNome = textoNaoVazio(acao?.nome);
      if (!acao || !acaoId || !acaoNome) {
        avisos.push(aviso("acao_legada_incompleta", "A ação original foi mantida no snapshot e requer revisão antes de ser usada.", "aviso", id));
        continue;
      }
      const entidadeOmniId = textoNaoVazio(acao.entidadeOmniId);
      acoes.push({
        id: acaoId,
        nome: acaoNome,
        tipoExecucao: "legada",
        ...(entidadeOmniId ? { entidadeOmniId } : {}),
        payloadLegado: acaoValor,
      });
      avisos.push(aviso(
        entidadeOmniId ? "acao_omni_parcial_preservada" : "acao_preservada_sem_conversao",
        entidadeOmniId
          ? "A referência de entidade OMNI foi preservada, mas o ID de ação OMNI não pode ser inferido."
          : "A ação foi mantida no formato legado; a migração não altera sua semântica para OMNI.",
        "aviso",
        id,
      ));
    }
  }

  const origemRegistro = comoRegistro(registro.origem);
  const atributosRegistro = comoRegistro(registro.atributos);
  let atributos: Record<string, number> | undefined;
  if (atributosRegistro) {
    const validos = Object.entries(atributosRegistro).every(([, v]) => typeof v === "number" && Number.isFinite(v));
    if (validos) atributos = atributosRegistro as Record<string, number>;
    else avisos.push(aviso("atributos_legados_incompletos", "Atributos inválidos não foram reinterpretados; permanecem no snapshot original.", "aviso", id));
  }

  const modeloBruto = {
    schemaVersion: INVOCACAO_SCHEMA_VERSION,
    version: 1,
    id,
    donoCharacterId,
    ...(textoNaoVazio(registro.donoProfileId) ? { donoProfileId: textoNaoVazio(registro.donoProfileId)! } : {}),
    tipo: tipo.data,
    nome,
    ...(origemRegistro && textoNaoVazio(origemRegistro.tipo) ? { origem: origemRegistro } : {}),
    ...(textoNaoVazio(registro.grau) ? { grau: textoNaoVazio(registro.grau)! } : {}),
    ...(textoNaoVazio(registro.porte) ? { tamanho: textoNaoVazio(registro.porte)! } : {}),
    ...(atributos ? { atributos } : {}),
    ...(Object.keys(valoresDerivados).length ? { valoresDerivados } : {}),
    ...(Object.keys(estadoLegado).length ? { estadoLegado } : {}),
    acoes,
    aquisicao,
    snapshotLegado: registro,
  };

  const convertido = ModeloInvocacaoSchema.safeParse(modeloBruto);
  if (!convertido.success) {
    avisos.push(...convertido.error.issues.map((issue) =>
      aviso("modelo_migrado_invalido", issue.message, "erro", id),
    ));
    return resultadoFalho(valor, avisos);
  }
  return { ok: true, dados: convertido.data, original: valor, avisos };
}

export function normalizarInstanciaInvocacao(
  valor: unknown,
  modelo: ModeloInvocacao,
): ResultadoMigracaoInvocacao<InstanciaInvocacao> {
  const registro = comoRegistro(valor);
  if (!registro) {
    return resultadoFalho(valor, [aviso("token_invalido", "O token não é um objeto de mapa.", "erro")]);
  }

  if (registro.schemaVersion === INVOCACAO_SCHEMA_VERSION) {
    const atual = InstanciaInvocacaoSchema.safeParse(registro);
    if (!atual.success) {
      return resultadoFalho(valor, atual.error.issues.map((issue) =>
        aviso("instancia_atual_invalida", issue.message, "erro", textoNaoVazio(registro.id) ?? undefined),
      ));
    }
    if (atual.data.modeloId !== modelo.id) {
      return resultadoFalho(valor, [
        aviso("modelo_instancia_invalido", "A instância atual aponta para um modelo diferente do fornecido.", "erro", atual.data.id),
      ]);
    }
    if (atual.data.donoCharacterId !== modelo.donoCharacterId) {
      return resultadoFalho(valor, [
        aviso("dono_instancia_invalido", "O dono da instância atual não corresponde ao dono do modelo.", "erro", atual.data.id),
      ]);
    }
    return { ok: true, dados: atual.data, original: valor, avisos: [] };
  }
  if (registro.schemaVersion !== undefined) {
    return resultadoFalho(valor, [
      aviso("schema_version_desconhecida", "A versão desta instância não pode ser migrada por esta versão do leitor.", "erro", textoNaoVazio(registro.id) ?? undefined),
    ]);
  }

  const tokenId = textoNaoVazio(registro.id);
  const ownerId = textoNaoVazio(registro.ownerCharId);
  const modelId = textoNaoVazio(registro.invocationId);
  const hpAtual = registro.hp;
  const hpMaximoAtual = typeof registro.hpMax === "number" && Number.isFinite(registro.hpMax)
    ? registro.hpMax
    : modelo.estadoLegado?.hpMaximo;
  const avisos: AvisoMigracaoInvocacao[] = [];

  if (!tokenId) avisos.push(aviso("token_id_ausente", "O token original foi preservado, mas não pode gerar uma instância sem ID estável.", "erro"));
  if (!ownerId || ownerId !== modelo.donoCharacterId) avisos.push(aviso("dono_instancia_invalido", "O dono do token não corresponde ao dono do modelo.", "erro", tokenId ?? undefined));
  if (!modelId || modelId !== modelo.id) avisos.push(aviso("modelo_instancia_invalido", "O token não aponta para o modelo fornecido.", "erro", tokenId ?? undefined));
  if (typeof hpAtual !== "number" || !Number.isFinite(hpAtual)) avisos.push(aviso("pv_instancia_ausente", "PV atual não foi inferido para o token.", "erro", tokenId ?? undefined));
  if (typeof hpMaximoAtual !== "number" || !Number.isFinite(hpMaximoAtual) || hpMaximoAtual < 1) avisos.push(aviso("pv_maximo_instancia_ausente", "PV máximo válido é necessário para preservar a faixa de estado.", "erro", tokenId ?? undefined));

  if (
    !tokenId || !ownerId || ownerId !== modelo.donoCharacterId || !modelId || modelId !== modelo.id ||
    typeof hpAtual !== "number" || !Number.isFinite(hpAtual) ||
    typeof hpMaximoAtual !== "number" || !Number.isFinite(hpMaximoAtual) || hpMaximoAtual < 1
  ) {
    return resultadoFalho(valor, avisos);
  }
  if (hpAtual > hpMaximoAtual) {
    return resultadoFalho(valor, [
      ...avisos,
      aviso("pv_instancia_acima_do_maximo", "O token permanece preservado para reconciliação; PV acima do máximo não será ajustado automaticamente.", "erro", tokenId),
    ]);
  }

  const estado: InstanciaInvocacao["estado"] =
    hpAtual <= -hpMaximoAtual ? "derrotada" : hpAtual <= 0 ? "caida" : "ativa";
  const instanciaBruta = {
    schemaVersion: INVOCACAO_SCHEMA_VERSION,
    version: 1,
    id: "legacy-instance-" + tokenId,
    modeloId: modelId,
    donoCharacterId: ownerId,
    ...(textoNaoVazio(registro.ownerProfileId) ? { donoProfileId: textoNaoVazio(registro.ownerProfileId)! } : {}),
    tokenId,
    estado,
    hpAtual,
    hpMaximoAtual,
  };
  const convertido = InstanciaInvocacaoSchema.safeParse(instanciaBruta);
  if (!convertido.success) {
    avisos.push(...convertido.error.issues.map((issue) =>
      aviso("instancia_migrada_invalida", issue.message, "erro", tokenId),
    ));
    return resultadoFalho(valor, avisos);
  }

  avisos.push(aviso("economia_ausente", "A instância antiga não contém saldos próprios de ações ou recursos; nenhum saldo foi inventado.", "aviso", tokenId));
  avisos.push(aviso("tempo_instancia_ausente", "A instância antiga não contém contribuição temporal configurada.", "aviso", tokenId));
  if (!textoNaoVazio(registro.eventoCriacaoId)) {
    avisos.push(aviso("evento_criacao_ausente", "Não existe evento antigo de criação para deduplicação temporal.", "aviso", tokenId));
  }
  return { ok: true, dados: convertido.data, original: valor, avisos };
}

export interface ResultadoAuditoriaInventarioInvocacao {
  modelos: ResultadoMigracaoInvocacao<ModeloInvocacao>[];
  instancias: ResultadoMigracaoInvocacao<InstanciaInvocacao>[];
  avisos: AvisoMigracaoInvocacao[];
  originais: { catalogo: unknown; tokens: unknown };
}

function chaveModelo(donoId: string, modeloId: string): string {
  return JSON.stringify([donoId, modeloId]);
}

export function auditarInventarioLegadoInvocacao(
  catalogoValor: unknown,
  tokensValor: unknown,
): ResultadoAuditoriaInventarioInvocacao {
  const catalogo = Array.isArray(catalogoValor) ? catalogoValor : [];
  const tokens = Array.isArray(tokensValor) ? tokensValor : [];
  const modelos = catalogo.map(normalizarModeloInvocacao);
  const avisos: AvisoMigracaoInvocacao[] = modelos.flatMap((resultado) => resultado.avisos);
  const contagemIds = new Map<string, number>();

  for (const resultado of modelos) {
    const id = resultado.dados?.id;
    if (id) contagemIds.set(id, (contagemIds.get(id) ?? 0) + 1);
  }
  for (const [id, count] of contagemIds) {
    if (count > 1) {
      avisos.push(aviso("id_modelo_duplicado", "Modelos com o mesmo ID foram mantidos para revisão; tokens vinculados não serão migrados automaticamente.", "erro", id));
    }
  }

  const modelosPorChave = new Map<string, ModeloInvocacao[]>();
  for (const resultado of modelos) {
    const modelo = resultado.dados;
    if (!modelo || (contagemIds.get(modelo.id) ?? 0) > 1) continue;
    const key = chaveModelo(modelo.donoCharacterId, modelo.id);
    modelosPorChave.set(key, [...(modelosPorChave.get(key) ?? []), modelo]);
  }

  const candidatos = tokens.map((original) => ({ original, registro: comoRegistro(original) }))
    .filter((item) => textoNaoVazio(item.registro?.invocationId) !== null);
  const contagemTokens = new Map<string, number>();
  for (const item of candidatos) {
    const id = textoNaoVazio(item.registro?.id);
    if (id) contagemTokens.set(id, (contagemTokens.get(id) ?? 0) + 1);
  }
  const contagemPorModelo = new Map<string, number>();
  for (const item of candidatos) {
    const donoId = textoNaoVazio(item.registro?.ownerCharId);
    const modeloId = textoNaoVazio(item.registro?.invocationId);
    if (donoId && modeloId) {
      const key = chaveModelo(donoId, modeloId);
      contagemPorModelo.set(key, (contagemPorModelo.get(key) ?? 0) + 1);
    }
  }

  const instancias: ResultadoMigracaoInvocacao<InstanciaInvocacao>[] = [];
  for (const item of candidatos) {
    const token = item.registro;
    const tokenId = textoNaoVazio(token?.id);
    const donoId = textoNaoVazio(token?.ownerCharId);
    const modeloId = textoNaoVazio(token?.invocationId);
    const key = donoId && modeloId ? chaveModelo(donoId, modeloId) : null;
    const modelo = key ? modelosPorChave.get(key)?.[0] : undefined;
    let falha: AvisoMigracaoInvocacao | null = null;

    if (!tokenId || !donoId || !modeloId || !modelo) {
      falha = aviso("token_orfao", "O token não pôde ser ligado sem alterar os dados; ele foi mantido para reconciliação.", "erro", tokenId ?? undefined);
    } else if ((contagemTokens.get(tokenId) ?? 0) > 1) {
      falha = aviso("id_token_duplicado", "Tokens com o mesmo ID foram mantidos para reconciliação; nenhuma instância foi escolhida automaticamente.", "erro", tokenId);
    } else if ((contagemPorModelo.get(key!) ?? 0) > 1) {
      falha = aviso("tokens_do_mesmo_modelo_duplicados", "Há mais de um token ativo para o mesmo modelo; todos foram preservados para revisão.", "erro", tokenId);
    }

    if (falha) {
      const resultado = resultadoFalho<InstanciaInvocacao>(item.original, [falha]);
      instancias.push(resultado);
      avisos.push(falha);
      continue;
    }

    const resultado = normalizarInstanciaInvocacao(item.original, modelo!);
    instancias.push(resultado);
    avisos.push(...resultado.avisos);
  }

  return {
    modelos,
    instancias,
    avisos,
    originais: { catalogo: catalogoValor, tokens: tokensValor },
  };
}

export function validarReferenciasModeloInstancia(
  modelos: readonly ModeloInvocacao[],
  instancias: readonly InstanciaInvocacao[],
): AvisoMigracaoInvocacao[] {
  const avisos: AvisoMigracaoInvocacao[] = [];
  const modelosPorId = new Map<string, ModeloInvocacao>();
  const idsModeloDuplicados = new Set<string>();

  for (const modelo of modelos) {
    if (modelosPorId.has(modelo.id)) idsModeloDuplicados.add(modelo.id);
    else modelosPorId.set(modelo.id, modelo);
  }
  for (const id of idsModeloDuplicados) {
    avisos.push(aviso("id_modelo_duplicado", "O ID do modelo aparece mais de uma vez.", "erro", id));
  }

  const idsInstancia = new Set<string>();
  const idsToken = new Set<string>();
  for (const instancia of instancias) {
    if (idsInstancia.has(instancia.id)) {
      avisos.push(aviso("id_instancia_duplicado", "Uma instância não pode aparecer duas vezes pelo mesmo ID.", "erro", instancia.id));
    }
    idsInstancia.add(instancia.id);
    if (idsToken.has(instancia.tokenId)) {
      avisos.push(aviso("id_token_duplicado", "Um token não pode pertencer a duas instâncias.", "erro", instancia.tokenId));
    }
    idsToken.add(instancia.tokenId);

    const modelo = modelosPorId.get(instancia.modeloId);
    if (!modelo) {
      avisos.push(aviso("modelo_instancia_ausente", "A instância aponta para um modelo inexistente.", "erro", instancia.id));
    } else if (modelo.donoCharacterId !== instancia.donoCharacterId) {
      avisos.push(aviso("dono_instancia_divergente", "O dono da instância precisa corresponder ao dono do modelo.", "erro", instancia.id));
    }
  }
  return avisos;
}
