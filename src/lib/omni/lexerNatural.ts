/** Lexer da futura sintaxe natural. Não reescreve IDs, texto citado nem fonte. */
export type UnidadeNatural = 'metros' | 'centimetros' | 'quilometros' | 'segundos' | 'minutos' | 'rodadas' | 'turnos' | 'pontos_vida' | 'pontos_energia';
export type TokenNatural =
  | { tipo: 'palavra'; valor: string; normalizado: string; inicio: number; fim: number }
  | { tipo: 'numero'; valor: number; unidade?: UnidadeNatural; inicio: number; fim: number }
  | { tipo: 'percentual'; valor: number; inicio: number; fim: number }
  | { tipo: 'dado'; valor: string; inicio: number; fim: number }
  | { tipo: 'operador'; valor: string; inicio: number; fim: number }
  | { tipo: 'pontuacao'; valor: string; inicio: number; fim: number }
  | { tipo: 'texto'; valor: string; inicio: number; fim: number };
export interface ErroLexicoNatural { inicio: number; fim: number; trecho: string; mensagem: string }
export interface ResultadoLexicoNatural { tokens: TokenNatural[]; erros: ErroLexicoNatural[] }

const normalizar = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const unidades: Readonly<Record<string, UnidadeNatural>> = {
  m: 'metros', metro: 'metros', metros: 'metros', cm: 'centimetros', centimetro: 'centimetros', centimetros: 'centimetros',
  km: 'quilometros', quilometro: 'quilometros', quilometros: 'quilometros',
  s: 'segundos', seg: 'segundos', segundo: 'segundos', segundos: 'segundos',
  min: 'minutos', minuto: 'minutos', minutos: 'minutos',
  rodada: 'rodadas', rodadas: 'rodadas', turno: 'turnos', turnos: 'turnos',
};

/** Decimal aceita ponto ou vírgula; vírgula decimal requer dígitos adjacentes. */
export function tokenizarNatural(texto: string): ResultadoLexicoNatural {
  const tokens: TokenNatural[] = [];
  const erros: ErroLexicoNatural[] = [];
  let i = 0;
  const inserirErro = (inicio: number, fim: number, mensagem: string) => erros.push({ inicio, fim, trecho: texto.slice(inicio, fim), mensagem });
  while (i < texto.length) {
    if (/\s/u.test(texto[i])) { i++; continue; }
    const inicio = i, restante = texto.slice(i), ch = String.fromCodePoint(texto.codePointAt(i)!);
    // A forma canônica nova proíbe esses marcadores; diagnosticar a sequência inteira.
    if (restante.startsWith('->')) { i += 2; inserirErro(inicio, i, 'Use "então" como separador; a seta pertence ao formato legado.'); continue; }
    if (ch === '@') { i++; inserirErro(inicio, i, 'A sintaxe natural não usa @; indique o papel da criatura por extenso.'); continue; }
    if (ch === '"' || ch === "'" || ch === '“') {
      const fechar = ch === '“' ? '”' : ch; i++;
      let valor = '', fechado = false;
      while (i < texto.length) {
        const atual = texto[i++];
        if (atual === fechar) { fechado = true; break; }
        if (atual === '\\' && i < texto.length) {
          const escapado = texto[i++]; valor += ({ n: '\n', r: '\r', t: '\t' } as Record<string, string>)[escapado] ?? escapado;
        } else valor += atual;
      }
      if (!fechado) inserirErro(inicio, i, 'Texto entre aspas não foi fechado.');
      else if (!valor.trim()) inserirErro(inicio, i, 'Texto entre aspas não pode estar vazio.');
      else tokens.push({ tipo: 'texto', valor, inicio, fim: i });
      continue;
    }
    const dado = /^(\d*)[dD](\d+)(?:(kh|kl|r)(\d+))?/.exec(restante);
    if (dado) {
      i += dado[0].length;
      const lados = Number(dado[2]), quantidade = dado[1] ? Number(dado[1]) : 1;
      if (!Number.isSafeInteger(lados) || lados < 1 || !Number.isSafeInteger(quantidade) || quantidade < 1) inserirErro(inicio, i, 'Notação de dados inválida ou fora dos limites seguros.');
      else tokens.push({ tipo: 'dado', valor: dado[0], inicio, fim: i });
      continue;
    }
    const numero = /^(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][+-]?\d+)?/.exec(restante);
    if (numero) {
      i += numero[0].length;
      const valor = Number(numero[0].replace(',', '.'));
      if (!Number.isFinite(valor)) { inserirErro(inicio, i, 'Número fora do intervalo finito.'); continue; }
      if (texto[i] === '%') { i++; tokens.push({ tipo: 'percentual', valor, inicio, fim: i }); continue; }
      const sufixo = /^[\p{L}]+/u.exec(texto.slice(i));
      if (sufixo) {
        const unidade = unidades[normalizar(sufixo[0])];
        if (unidade) { i += sufixo[0].length; tokens.push({ tipo: 'numero', valor, unidade, inicio, fim: i }); continue; }
      }
      tokens.push({ tipo: 'numero', valor, inicio, fim: i }); continue;
    }
    const palavra = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(restante);
    if (palavra) {
      i += palavra[0].length;
      const canonica = normalizar(palavra[0]);
      const unidade = unidades[canonica];
      if (unidade) tokens.push({ tipo: 'palavra', valor: palavra[0], normalizado: `unidade:${unidade}`, inicio, fim: i });
      else tokens.push({ tipo: 'palavra', valor: palavra[0], normalizado: canonica, inicio, fim: i });
      continue;
    }
    const operador = /^(?:<=|>=|==|!=|&&|\|\||[+*/%^<>=!−×÷-])/.exec(restante);
    if (operador) { i += operador[0].length; tokens.push({ tipo: 'operador', valor: operador[0], inicio, fim: i }); continue; }
    if ('(),.:;[]'.includes(ch)) { i++; tokens.push({ tipo: 'pontuacao', valor: ch, inicio, fim: i }); continue; }
    i += ch.length; inserirErro(inicio, i, `Caractere não reconhecido: ${ch}.`);
  }
  return { tokens, erros };
}
