/** Contador síncrono partilhado pelo motor e pelas janelas de reação. */
type ReacaoGlobal = typeof globalThis & { __tpOmniReactionDepth?: number };
export function reacaoEmCurso(): boolean { return (((globalThis as ReacaoGlobal).__tpOmniReactionDepth) ?? 0) > 0; }
export async function comReacaoEmCurso<T>(fn: () => Promise<T>): Promise<T> {
  const estado = globalThis as ReacaoGlobal;
  estado.__tpOmniReactionDepth = (estado.__tpOmniReactionDepth ?? 0) + 1;
  try { return await fn(); }
  finally { estado.__tpOmniReactionDepth = Math.max(0, (estado.__tpOmniReactionDepth ?? 1) - 1); }
}
