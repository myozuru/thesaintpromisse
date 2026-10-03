import type { ContextoComposicao } from './composicao';
import type { DadosComposicao } from './avaliar';

const escopos: ContextoComposicao[] = ['USUARIO', 'ALVO', 'CENA', 'DANO', 'ITEM', 'ARMA', 'AREA', 'FORMULA'];
const simbolos = Object.fromEntries(escopos.map(c => [c, Symbol(`omni.dados.${c}`)])) as Record<ContextoComposicao, symbol>;

/** Metadados efêmeros: spreads preservam escopos; JSON continua contendo somente números. */
export function anexarDadosCompostos(bag: Record<string, number>, contexto: ContextoComposicao, dados: DadosComposicao): Record<string, number> {
  Object.defineProperty(bag, simbolos[contexto], { value: dados, enumerable: true, configurable: true });
  return bag;
}

export function extrairDadosCompostos(bag: Record<string, number>): Partial<Record<ContextoComposicao, DadosComposicao>> {
  const dados: Partial<Record<ContextoComposicao, DadosComposicao>> = {};
  for (const c of escopos) {
    const valor = Reflect.get(bag, simbolos[c]);
    if (valor) dados[c] = valor;
  }
  return dados;
}
