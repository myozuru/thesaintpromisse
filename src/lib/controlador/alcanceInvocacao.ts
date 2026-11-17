/** Alcance base de posicionamento definido pelo Mestre para todas as invocações. */
export const ALCANCE_BASE_INVOCACAO_M = 1;

/** Fichas antigas sem alcance usam a mesma base das fichas novas. */
export function alcancePosicionamentoInvocacao(modelo: { alcanceInvocacaoM?: number }): number {
  return modelo.alcanceInvocacaoM ?? ALCANCE_BASE_INVOCACAO_M;
}
