import { interpretarComposicao } from './interpretar';
import type { ReferenciaComposta } from './composicao';

export interface TrechoComposto { inicio: number; fim: number; texto: string; referencia: ReferenciaComposta }

/** Detecta referências sem interpretar funções, strings ou nomes legados pontuados. */
export function localizarComposicoes(texto: string): TrechoComposto[] {
  const trechos: TrechoComposto[] = [];
  let i = 0;
  while (i < texto.length) {
    if (['"', "'", '“'].includes(texto[i])) {
      const fecha = texto[i] === '“' ? '”' : texto[i];
      i++;
      while (i < texto.length) { if (texto[i] === '\\') { i += 2; continue; } if (texto[i++] === fecha) break; }
      continue;
    }
    const palavra = /^@?(?:[\p{L}_][\p{L}\p{N}_]*\.)?[\p{L}_][\p{L}\p{N}_]*/u.exec(texto.slice(i));
    if (!palavra) { i++; continue; }
    if (['e', 'ou'].includes(palavra[0].toLowerCase())) { i += palavra[0].length; continue; }
    const p = interpretarComposicao(texto.slice(i));
    const fim = i + p.consumido;
    if (p.referencia && !p.erro && !/[\p{L}\p{N}_.]/u.test(texto[fim] ?? '') && !/^\s*\(/.test(texto.slice(fim))) {
      const trecho = texto.slice(i, fim);
      // A integração composta só assume sequências; referências simples mantêm o caminho legado.
      if (/\s/.test(trecho.trim())) { trechos.push({ inicio: i, fim, texto: trecho, referencia: p.referencia }); i = fim; continue; }
    }
    i += palavra[0].length;
  }
  return trechos;
}

/** Transforma apenas o texto externo; conectores e argumentos de composições ficam intactos. */
export function transformarForaDasComposicoes(texto: string, transformar: (trecho: string) => string): string {
  let fim = 0, resultado = '';
  for (const trecho of localizarComposicoes(texto)) {
    resultado += transformar(texto.slice(fim, trecho.inicio)) + trecho.texto;
    fim = trecho.fim;
  }
  return resultado + transformar(texto.slice(fim));
}
