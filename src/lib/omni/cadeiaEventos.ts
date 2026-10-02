/** Contexto interno: mantém limites através de imports, timers e prompts. */
export interface CadeiaOmni {
  readonly profundidade: number;
  readonly orcamento: { restantes: number; avisou: boolean };
}

export const LIMITE_PROFUNDIDADE_OMNI = 16;
export const LIMITE_PASSOS_OMNI = 256;
let atual: CadeiaOmni | undefined;

export function capturarCadeiaOmni(): CadeiaOmni | undefined {
  return atual;
}

/** Cada dano/evento reserva um passo; irmãos compartilham o orçamento. */
export function reservarPassoOmni(pai: CadeiaOmni | undefined = atual): CadeiaOmni | undefined {
  const raiz = pai ?? { profundidade: 0, orcamento: { restantes: LIMITE_PASSOS_OMNI, avisou: false } };
  if (raiz.profundidade >= LIMITE_PROFUNDIDADE_OMNI || raiz.orcamento.restantes <= 0) {
    if (!raiz.orcamento.avisou) {
      raiz.orcamento.avisou = true;
      console.warn('[Omni] Cadeia interrompida: limite de encadeamento de eventos atingido.');
    }
    return undefined;
  }
  raiz.orcamento.restantes--;
  return { profundidade: raiz.profundidade + 1, orcamento: raiz.orcamento };
}

/** Escopo apenas síncrono. Callbacks devem levar o contexto capturado. */
export function executarNaCadeiaOmni<T>(cadeia: CadeiaOmni, executar: () => T): T {
  const anterior = atual;
  atual = cadeia;
  try { return executar(); } finally { atual = anterior; }
}
