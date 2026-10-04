/** Receber um resultado não equivale a executar novamente a ação que o produziu. */
let profundidade = 0;
export const estadoRemotoEmAplicacao = () => profundidade > 0;
export function comEstadoRemoto<T>(fn: () => T): T {
  profundidade++;
  try {
    return fn();
  } finally {
    profundidade--;
  }
}
