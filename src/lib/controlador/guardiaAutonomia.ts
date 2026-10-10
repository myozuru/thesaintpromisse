import type { CadeiaOmni } from '@/lib/omni/cadeiaEventos';

export const MAX_ACOES_AUTONOMAS_POR_RODADA = 8;

const regrasVisitadasPorCadeia = new WeakMap<object, Set<string>>();

/** Uma mesma automação só pode disparar uma vez na cadeia OMNI que a originou. */
export function marcarRegraVisitada(cadeia: CadeiaOmni, chave: string): boolean {
  const orcamento = cadeia.orcamento as object;
  const visitadas = regrasVisitadasPorCadeia.get(orcamento) ?? new Set<string>();
  if (visitadas.has(chave)) return false;
  visitadas.add(chave);
  regrasVisitadasPorCadeia.set(orcamento, visitadas);
  return true;
}

/** Limites configuráveis nunca podem remover o teto global contra recursão. */
export function limitarAcoesAutonomas(limite: number | undefined, padrao: number): number {
  const valor = Number.isInteger(limite) && (limite ?? -1) >= 0 ? limite! : padrao;
  return Math.min(MAX_ACOES_AUTONOMAS_POR_RODADA, valor);
}
