import { afterEach, describe, expect, it, vi } from 'vitest';
import * as lexer from '@/lib/omni/componentes/lexer';
import { localizarComposicoes } from '@/lib/omni/componentes/expressoes';
import { sugerirNoCaret } from '@/lib/omni/dicionarioAutocomplete';
afterEach(() => vi.restoreAllMocks());
describe('custo da edição conforme o texto cresce', () => {
  it('tokeniza a expressão uma vez para detectar 300 composições', () => {
    const ler = vi.spyOn(lexer, 'tokenizarComposicao');
    const texto = Array(300).fill('vida maximo').join(' + ');
    const trechos = localizarComposicoes(texto);
    expect(trechos).toHaveLength(300);
    expect(ler).toHaveBeenCalledTimes(1);
    expect(trechos.at(-1)!.fim).toBe(texto.length);
  });
  it('o autocomplete lê apenas a palavra anterior em um script longo', () => {
    const ler = vi.spyOn(lexer, 'tokenizarComposicao');
    const texto = 'somar 1 em vida; '.repeat(1000) + 'arma_principal le';
    expect(sugerirNoCaret(texto, texto.length).map(s => s.valor)).toEqual(['leve']);
    expect(ler).toHaveBeenCalledTimes(1);
    expect(ler.mock.calls[0][0]).toBe('arma_principal');
  });
  it('não sugere keys dentro de argumentos entre aspas, inclusive com escapes', () => {
    for (const texto of ['contador "carga de vi', 'contador "carga \\" de vi', 'contador “carga de vi']) {
      expect(sugerirNoCaret(texto, texto.length)).toEqual([]);
    }
  });
});
