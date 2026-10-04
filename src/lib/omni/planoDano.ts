/** Planeja somas de dados e parcelas escalares sem rolar dano durante a validação. */
export interface PlanoFormulaDano { grupos: { count: number; sides: number }[]; fixo: number }
type Avaliador = (expressao: string) => { valor: number; diagnosticos: readonly unknown[] };
export function planejarFormulaDano(expressao: string | undefined, avaliar: Avaliador): PlanoFormulaDano {
  const plano: PlanoFormulaDano = { grupos: [], fixo: 0 };
  if (!expressao?.trim()) return plano;
  const partes: string[] = []; let inicio = 0, profundidade = 0, aspas = '';
  for (let i = 0; i < expressao.length; i++) {
    const c = expressao[i];
    if (aspas) { if (c === aspas && expressao[i - 1] !== '\\') aspas = ''; continue; }
    if (c === '"' || c === "'") { aspas = c; continue; }
    if (c === '(') profundidade++;
    else if (c === ')') profundidade--;
    else if ((c === '+' || c === '-') && profundidade === 0 && i > inicio && !/[+\-*/(]/.test(expressao.slice(inicio, i).trim().slice(-1))) { partes.push(expressao.slice(inicio, i)); inicio = c === '-' ? i : i + 1; }
  }
  partes.push(expressao.slice(inicio));
  const numero = (expr: string) => {
    const r = avaliar(expr);
    if (r.diagnosticos.length || !Number.isFinite(r.valor)) throw new Error(`Parcela de dano inválida: ${expr}`);
    return r.valor;
  };
  for (const parte of partes) {
    const termo = parte.trim();
    if (!termo) throw new Error('Falta uma parcela na fórmula de dano.');
    if (termo.startsWith('(') && termo.endsWith(')')) {
      let nivel = 0, envolvido = true;
      for (let i = 0; i < termo.length - 1; i++) {
        if (termo[i] === '(') nivel++; else if (termo[i] === ')') nivel--;
        if (nivel === 0) { envolvido = false; break; }
      }
      if (envolvido) {
        const parte = planejarFormulaDano(termo.slice(1, -1), avaliar);
        plano.grupos.push(...parte.grupos); plano.fixo += parte.fixo; continue;
      }
    }
    const dado = termo.match(/^(?:(\d+)|\((.*)\))?\s*d(\d+)$/i);
    if (dado) {
      const count = dado[1] ? Number(dado[1]) : dado[2] ? numero(dado[2]) : 1;
      const sides = Number(dado[3]);
      if (!Number.isInteger(count) || count < 0 || !Number.isInteger(sides) || sides < 1) throw new Error(`Grupo de dados inválido: ${termo}`);
      if (count > 0) plano.grupos.push({ count, sides });
    } else {
      if (/\bd\d+|\d+d\d+/i.test(termo)) throw new Error(`Use grupos de dados somados: ${termo}`);
      plano.fixo += numero(termo);
    }
  }
  return plano;
}
