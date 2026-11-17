import type {
  CampoDerivadoInvocacao,
  EstadoAquisicaoInvocacao,
  ModeloInvocacao,
  ConfiguracaoEfeitoSuporteInvocacao,
  EfeitoEspecialInvocacao,
} from "@/lib/invocacoes/schema";

/** Catálogo persistente de invocações do Controlador.
 * A materialização em tokens e os comandos pertencem às fases seguintes.
 * Referências preservam a origem no Grimório/OMNI sem duplicar entidades.
 */
export type TipoInvocacaoControlador = ModeloInvocacao["tipo"];

export function rotuloTipoInvocacao(tipo: TipoInvocacaoControlador): string {
  switch (tipo) {
    case 'shikigami': return 'Shikigami';
    case 'corpo_amaldicoado': return 'Corpo Amaldiçoado';
    case 'maldicao_domada': return 'Maldição Domada';
    default: return 'Invocação';
  }
}

/** Compatibilidade legada não dispensa a confirmação em fichas modernas de Maldição Domada. */
export function mensagemDomesticaoPendente(
  invocacao: Pick<InvocacaoControlador, 'nome' | 'tipo' | 'domado' | 'aprovacaoMestre' | 'schemaVersion' | 'version' | 'versaoModelo' | 'aquisicao'>,
): string | null {
  if (invocacao.domado === true) return null;
  if (invocacao.tipo === 'maldicao_domada') {
    const estadoAquisicao = invocacao.aquisicao?.estado;
    const revisaoPendente = invocacao.aprovacaoMestre === 'pendente'
      || invocacao.aprovacaoMestre === 'rejeitada'
      || estadoAquisicao === 'pendente'
      || estadoAquisicao === 'rejeitada';
    // Saves anteriores à introdução de `domado` podem ter schemaVersion,
    // version ou até aprovação preenchidos. Só um estado explicitamente
    // pendente/rejeitado bloqueia a compatibilidade quando o campo está ausente.
    if (invocacao.domado === undefined && !revisaoPendente) return null;
    return `A domesticação de ${invocacao.nome} ainda não foi confirmada pelo Mestre.`;
  }
  if (invocacao.domado !== false) return null;
  return `${invocacao.nome} ainda precisa ser domado no ritual.`;
}

export type TipoRitualDezSombras = 'domesticacao' | 'quimera';
export type EstadoRitualDezSombras = 'solicitado' | 'em_andamento' | 'concluido' | 'falhou' | 'cancelado';
export type ModoRitualDezSombras = 'mapa' | 'manual';

/** Registro persistente de uma tentativa. O resultado continua sendo decisão explícita do Mestre. */
export interface RitualDezSombras {
  id: string;
  tipo: TipoRitualDezSombras;
  estado: EstadoRitualDezSombras;
  alvoInvocacaoId: string;
  alvoNomeSnapshot: string;
  solicitadoEm: string;
  solicitadoPorProfileId?: string;
  modo?: ModoRitualDezSombras;
  iniciadoEm?: string;
  iniciadoPorProfileId?: string;
  resolvidoEm?: string;
  resolvidoPorProfileId?: string;
  entidadeMapaId?: string;
  iniciativaMapaId?: string;
}

export interface InvocacaoControlador {
  id: string;
  donoCharacterId: string;
  nome: string;
  pacoteRegras?: "dez-sombras";
  /** Formas derivadas não consomem vagas de indivíduos-base. */
  formaDerivada?: boolean;
  /** Requisitos de composição e domesticação exigidos antes do ritual de quimera. */
  requisitosFormaDerivada?: string[];
  /** Lacunas ou dependências que devem permanecer visíveis na ficha. */
  lacunasFormaDerivada?: string[];
  /** Campos provisórios por ausência de valor explícito na fonte. */
  valoresProvisoriosFormaDerivada?: string[];
  referenciaRegra?: string;
  opcionalHomebrew?: boolean;
  domado?: boolean;
  schemaVersion?: 1;
  version?: number;
  donoProfileId?: string;
  apelido?: string;
  nivelEvolucao?: number;
  atributoBasePericias?: "inteligencia" | "sabedoria";
  subcategoria?: string;
  descricao?: string;
  historico?: string;
  imagemAssetId?: string;
  imagemFallbackAssetId?: string;
  imagemAltText?: string;
  corIdentificacao?: string;
  nomeplate?: boolean;
  formaToken?: "ELLIPSE" | "RECT";
  tokenCrop?: unknown;
  estiloToken?: string;
  tamanho?: string;
  intermediario?: ModeloInvocacao["intermediario"];
  valoresDerivados?: Record<string, CampoDerivadoInvocacao>;
  estadoLegado?: ModeloInvocacao["estadoLegado"];
  periciasTreinadas?: string[];
  ataqueTreinado?: unknown;
  resistenciaTreinada?: unknown;
  recursosConfigurados?: ModeloInvocacao["recursosConfigurados"];
  caracteristicas?: unknown[];
  possuiEnergiaReversa?: boolean;
  reacoes?: ModeloInvocacao["reacoes"];
  automacoesOmni?: ModeloInvocacao["automacoesOmni"];
  omniConfiguracao?: ModeloInvocacao["omniConfiguracao"];
  autonomia?: ModeloInvocacao["autonomia"];
  economiaAcoesConfigurada?: ModeloInvocacao["economiaAcoesConfigurada"];
  custosComandosConfigurados?: ModeloInvocacao["custosComandosConfigurados"];
  tempoAdicional?: ModeloInvocacao["tempoAdicional"];
  aquisicao?: EstadoAquisicaoInvocacao;
  registroEvolucao?: unknown[];
  regrasRecuperacao?: ModeloInvocacao["regrasRecuperacao"];
  /** Ficha preservada para histórico, mas indisponível para novas invocações. */
  perdaPermanente?: boolean;
  /** Aquisição depende de aprovação do Mestre. Ausência em saves antigos equivale a legado já adquirido. */
  aprovacaoMestre?: 'pendente' | 'aprovada' | 'rejeitada';
  /** Versão do snapshot atualmente editado e versão liberada pelo Mestre. */
  versaoModelo?: number;
  versaoAprovada?: number;
  /** ID persistente da solicitação, usado para registrar a decisão do Mestre. */
  solicitacaoAprovacaoId?: string;
  motivoRejeicao?: string;
  tipo: TipoInvocacaoControlador;
  origem?: { tipo: 'grimorio' | 'omni' | 'manual'; entidadeId?: string };
  /** Proveniência declarada; a aprovação não infere regras nem libera uso por si só. */
  origemAquisicao?: string;
  referenciaInterludio?: string;
  hpAtual: number;
  hpMaximo: number;
  defesa: number;
  deslocamentoM: number;
  porte: 'Pequeno' | 'Médio' | 'Grande';
  /** Grau e atributos definidos pelo editor de Shikigamis. */
  grau?: 'quarto' | 'terceiro' | 'segundo' | 'primeiro' | 'especial';
  atributos?: Record<'forca' | 'destreza' | 'constituicao' | 'inteligencia' | 'sabedoria' | 'presenca', number>;
  custoInvocacaoPE: number;
  /** Distância máxima de posicionamento em metros; sem valor, usa a base de 1 m. */
  alcanceInvocacaoM?: number;
  custoSustentacaoPE?: number;
  acoes: Array<{
    id: string;
    nome: string;
    tipo?: 'ataque' | 'habilidade' | 'movimento' | 'bonus' | 'suporte';
    efeitoSuporte?: ConfiguracaoEfeitoSuporteInvocacao;
    efeitoEspecial?: EfeitoEspecialInvocacao;
    teste?: 'ataque' | 'resistencia';
    tipoAtaque?: 'corpo_a_corpo' | 'distancia';
    atributoAtaque?: 'forca' | 'destreza';
    atributoDano?: 'forca' | 'destreza' | 'constituicao' | 'inteligencia' | 'sabedoria' | 'presenca';
    multiplicadorDanoAtributo?: number;
    /** Condição específica imposta pela ação, usada para calcular adaptação de TR de Mahoraga. */
    condicaoAlvoId?: string;
    resistenciaAlvo?: string;
    atributoCD?: 'forca' | 'destreza' | 'constituicao' | 'inteligencia' | 'sabedoria' | 'presenca';
    danoNoSucesso?: 'nenhum' | 'metade';
    tipo_alvo?: 'unico' | 'multiplo' | 'area' | 'proprio';
    filtro_alvo?: 'inimigos' | 'aliados' | 'todos' | 'todos_exceto_si';
    area?: { forma: 'cone' | 'linha' | 'raio_em_si' | 'raio_no_ponto'; tamanho_m: number; largura_m?: number };
    margemCritico?: number;
    multiplicadorCritico?: number;
    alcanceM?: number;
    /** Bônus específico de acerto do servo, sem herdar o acerto do Controlador. */
    bonusAtaque?: number;
    dano?: string;
    tipoDano?: import('@/types').DamageType;
    entidadeOmniId?: string;
    acaoOmniId?: string;
    tipoExecucao?: 'omni' | 'referencia_omni' | 'manual' | 'legada';
    categoriaAcao?: 'acao_comum' | 'acao_simples' | 'acao_complexa' | 'acao_bonus' | 'movimento' | 'livre' | 'reacao';
    opcaoInvocacao?: 'acao_simples' | 'acao_complexa' | 'caracteristica';
    custoPE?: number;
    recarga?: string;
    recargaConfigurada?: { quantidade: number; unidade: 'inicio_turno_dono' | 'inicio_rodada' | 'manual' };
    descricaoRegra?: string;
    statusAutomacao?: 'executavel' | 'parcial' | 'manual';
    formulaCura?: string;
    curaRealSemCusto?: boolean;
    permiteInimigos?: boolean;
    todosNoAlcance?: boolean;
    somenteProprio?: boolean;
    alvo?: string;
    [campo: string]: unknown;
  }>;
}

/** Mantém a API histórica enquanto a progressão fica centralizada no motor de regras. */
export {
  invocacoesConhecidasPeloLivro as limiteInvocacoesConhecidas,
  limiteInvocacoesAtivas,
  limiteAtivasPersonagem,
} from './regrasShikigami';

/** Níveis de Controlador: PV inicial 10+CON, subsequentes 1d8 (média 5)+CON. */
export function pvControlador(nivel: number, modCon: number, dadosPosteriores?: readonly number[]): number {
  const n = Math.max(1, Math.trunc(nivel) || 1);
  const ganhos = Array.from({ length: n - 1 }, (_, i) => dadosPosteriores?.[i] ?? 5);
  if (ganhos.some(g => !Number.isInteger(g) || g < 1 || g > 8)) throw new Error('Dado de vida do Controlador precisa estar entre 1 e 8.');
  return Math.max(1, 10 + n * modCon + ganhos.reduce((a, b) => a + b, 0));
}

/** Protege contra duplicidade, catálogo acima do limite e referências cruzadas. */
export function validarCatalogoControlador(
  donoCharacterId: string,
  nivel: number,
  catalogo: readonly InvocacaoControlador[],
): { ok: true } | { ok: false; motivo: string } {
  // Atingir o limite gera aviso na UI, não impede personalização autorizada.
  const ids = new Set<string>();
  for (const inv of catalogo) {
    if (!inv.id || ids.has(inv.id)) return { ok: false, motivo: 'ID de invocação duplicado ou ausente.' };
    ids.add(inv.id);
    if (inv.donoCharacterId !== donoCharacterId) return { ok: false, motivo: 'Invocação pertence a outro controlador.' };
    if (!inv.nome.trim() || !Number.isFinite(inv.hpMaximo) || inv.hpMaximo < 1 || !Number.isFinite(inv.hpAtual) || inv.hpAtual < 0 || inv.hpAtual > inv.hpMaximo)
      return { ok: false, motivo: 'Dados vitais da invocação inválidos.' };
    if (!Number.isFinite(inv.defesa) || inv.defesa < 0 || !Number.isFinite(inv.deslocamentoM) || inv.deslocamentoM < 0 || !Number.isFinite(inv.custoInvocacaoPE) || inv.custoInvocacaoPE < 0 || (inv.custoSustentacaoPE !== undefined && (!Number.isFinite(inv.custoSustentacaoPE) || inv.custoSustentacaoPE < 0)))
      return { ok: false, motivo: 'Defesa, deslocamento ou custos inválidos.' };
  }
  return { ok: true };
}
