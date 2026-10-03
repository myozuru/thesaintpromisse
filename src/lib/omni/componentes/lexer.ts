import { COMPONENTES_OMNI, type ComponenteOmni } from './ids';
import { CONTEXTOS_COMPOSICAO, type ContextoComposicao } from './composicao';

export type TokenComposicao =
  | { tipo: 'contexto'; valor: ContextoComposicao; inicio: number; fim: number }
  | { tipo: 'componente'; valor: ComponenteOmni; inicio: number; fim: number }
  | { tipo: 'identificador' | 'argumento' | 'operador' | 'pontuacao'; valor: string; inicio: number; fim: number }
  | { tipo: 'numero' | 'percentual'; valor: number; inicio: number; fim: number };

export interface ResultadoLexico {
  tokens: TokenComposicao[];
  erros: Array<{ inicio: number; fim: number; mensagem: string }>;
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const componentes = new Map(COMPONENTES_OMNI.map(c => [normalizar(c), c]));
const contextos = new Set<string>(CONTEXTOS_COMPOSICAO);

/** Reconhece partes e preserva posições; não substitui conectores por operadores. */
export function tokenizarComposicao(texto: string): ResultadoLexico {
  const tokens: TokenComposicao[] = [];
  const erros: ResultadoLexico['erros'] = [];
  let i = 0;
  while (i < texto.length) {
    if (/\s/u.test(texto[i])) { i++; continue; }
    const inicio = i;
    const restante = texto.slice(i);
    const contexto = /^@([A-Za-z_]+)\./.exec(restante);
    if (contexto) {
      const valor = contexto[1].toUpperCase();
      i += contexto[0].length;
      if (contextos.has(valor)) tokens.push({ tipo: 'contexto', valor: valor as ContextoComposicao, inicio, fim: i });
      else erros.push({ inicio, fim: i, mensagem: `Contexto desconhecido: ${contexto[1]}.` });
      continue;
    }
    const ch = texto[i];
    if (ch === '"' || ch === "'" || ch === '“') {
      const fecha = ch === '“' ? '”' : ch;
      i++;
      let valor = '', fechado = false;
      while (i < texto.length) {
        const c = texto[i++];
        if (c === fecha) { fechado = true; break; }
        if (c === '\\') {
          if (i >= texto.length) break;
          const escaped = texto[i++];
          valor += ({ n: '\n', r: '\r', t: '\t' } as Record<string, string>)[escaped] ?? escaped;
        } else valor += c;
      }
      if (!fechado) erros.push({ inicio, fim: i, mensagem: 'Argumento entre aspas não foi fechado.' });
      else if (!valor.trim()) erros.push({ inicio, fim: i, mensagem: 'Argumento não pode estar vazio.' });
      else tokens.push({ tipo: 'argumento', valor, inicio, fim: i });
      continue;
    }
    const numero = /^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(restante);
    if (numero) {
      i += numero[0].length;
      const valor = Number(numero[0]);
      const percentual = texto[i] === '%';
      if (percentual) i++;
      if (!Number.isFinite(valor)) erros.push({ inicio, fim: i, mensagem: 'Número fora do intervalo finito.' });
      else tokens.push({ tipo: percentual ? 'percentual' : 'numero', valor, inicio, fim: i });
      continue;
    }
    const palavra = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(restante);
    if (palavra) {
      i += palavra[0].length;
      const componente = componentes.get(normalizar(palavra[0]));
      tokens.push(componente ? { tipo: 'componente', valor: componente, inicio, fim: i } : { tipo: 'identificador', valor: palavra[0], inicio, fim: i });
      continue;
    }
    const operador = /^(?:<=|>=|==|!=|&&|\|\||[+*/%^<>=!−×÷-])/.exec(restante);
    if (operador) {
      i += operador[0].length;
      tokens.push({ tipo: 'operador', valor: operador[0], inicio, fim: i });
      continue;
    }
    if ('@(),.:[]'.includes(ch)) { i++; tokens.push({ tipo: 'pontuacao', valor: ch, inicio, fim: i }); continue; }
    i++;
    erros.push({ inicio, fim: i, mensagem: `Caractere não reconhecido: ${ch}.` });
  }
  return { tokens, erros };
}
