/** Contador síncrono: enquanto uma reação resolve, seus efeitos não abrem novas janelas. */
let profundidade = 0;
export const reacaoEmCurso = () => profundidade > 0;
export async function comReacaoEmCurso<T>(fn: () => Promise<T>): Promise<T> {
  profundidade++;
  try { return await fn(); } finally { profundidade--; }
}
