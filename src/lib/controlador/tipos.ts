import type {
  CampoDerivadoInvocacao,
  EstadoAquisicaoInvocacao,
  ModeloInvocacao,
} from "@/lib/invocacoes/schema";

/** Catálogo persistente de invocações do Controlador.
 * A materialização em tokens e os comandos pertencem às fases seguintes.
 * Referências preservam a origem no Grimório/OMNI sem duplicar entidades.
 */
export type TipoInvocacaoControlador = 'shikigami' | 'corpo_amaldicoado';

export interface InvocacaoControlador {
  id: string;
  donoCharacterId: string;
  nome: string;
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
  reacoes?: unknown[];
  automacoesOmni?: ModeloInvocacao["automacoesOmni"];
  omniConfiguracao?: ModeloInvocacao["omniConfiguracao"];
  autonomia?: ModeloInvocacao["autonomia"];
  economiaAcoesConfigurada?: ModeloInvocacao["economiaAcoesConfigurada"];
  custosComandosConfigurados?: Record<string, unknown>;
  tempoAdicional?: ModeloInvocacao["tempoAdicional"];
  aquisicao?: EstadoAquisicaoInvocacao;
  registroEvolucao?: unknown[];
  regrasRecuperacao?: ModeloInvocacao["regrasRecuperacao"];
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
  custoSustentacaoPE?: number;
  acoes: Array<{
    id: string;
    nome: string;
    tipo?: 'ataque' | 'habilidade' | 'movimento' | 'bonus' | 'suporte';
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
