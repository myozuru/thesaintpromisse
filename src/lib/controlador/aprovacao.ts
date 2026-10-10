export type EstadoAprovacaoInvocacao = "pendente" | "aprovada" | "rejeitada";
export type DecisaoAprovacaoInvocacao = "aprovada" | "rejeitada";

export interface ContextoSubmissaoAprovacao {
  requesterUserId: string;
  /** Papel calculado pelo servidor a partir da conta autenticada. */
  requesterIsMaster: boolean;
  ownerUserId?: string | null;
  ownerCharacterId: string;
  invocationOwnerCharacterId: string;
}

type ResultadoNegado = { ok: false; motivo: string };

export type ResultadoPoliticaSubmissao =
  | { ok: true; estado: "pendente" | "aprovada" }
  | ResultadoNegado;

export type ResultadoPoliticaDecisao =
  | { ok: true; estado: DecisaoAprovacaoInvocacao }
  | ResultadoNegado;

/** A submissão exige propriedade persistida; Mestre pode agir em qualquer ficha. */
export function avaliarSubmissaoAprovacao(
  contexto: ContextoSubmissaoAprovacao,
): ResultadoPoliticaSubmissao {
  if (!contexto.requesterUserId.trim()) {
    return { ok: false, motivo: "A conta autenticada não foi identificada." };
  }
  if (!contexto.ownerCharacterId.trim()
    || contexto.invocationOwnerCharacterId !== contexto.ownerCharacterId) {
    return { ok: false, motivo: "A invocação não pertence à ficha informada." };
  }
  if (contexto.requesterIsMaster) return { ok: true, estado: "aprovada" };
  if (contexto.ownerUserId !== contexto.requesterUserId) {
    return { ok: false, motivo: "Somente o dono da ficha ou o Mestre pode enviar esta invocação." };
  }
  return { ok: true, estado: "pendente" };
}

export function validarDecisaoAprovacao(args: {
  requesterIsMaster: boolean;
  estadoAtual: EstadoAprovacaoInvocacao;
  decisao: DecisaoAprovacaoInvocacao;
  motivo?: string;
}): ResultadoPoliticaDecisao {
  if (!args.requesterIsMaster) {
    return { ok: false, motivo: "Apenas o Mestre pode revisar uma invocação." };
  }
  if (args.estadoAtual !== "pendente") {
    return { ok: false, motivo: "Somente solicitações pendentes podem ser revisadas." };
  }
  if (args.decisao === "rejeitada" && !args.motivo?.trim()) {
    return { ok: false, motivo: "Informe o motivo da rejeição." };
  }
  return { ok: true, estado: args.decisao };
}

/** A aprovação libera apenas a versão submetida; versões editadas aguardam revisão. */
export function podeUsarVersaoAprovada(args: {
  estado?: EstadoAprovacaoInvocacao;
  versaoAtual?: number;
  versaoAprovada?: number;
}): boolean {
  // Saves antigos sem estado de aquisição continuam compatíveis.
  if (args.estado === undefined) return true;
  if (args.estado !== "aprovada") return false;
  // Aprovação legada não tem número de versão rastreável.
  if (args.versaoAprovada === undefined) return true;
  const versaoAtual = args.versaoAtual ?? 1;
  return Number.isSafeInteger(versaoAtual)
    && versaoAtual >= 1
    && Number.isSafeInteger(args.versaoAprovada)
    && args.versaoAprovada >= 1
    && versaoAtual === args.versaoAprovada;
}
