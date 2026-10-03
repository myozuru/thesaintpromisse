import { describe, expect, it } from 'vitest';
import { tokenizarComposicao } from '@/lib/omni/componentes/lexer';

describe('Leitura lexical de componentes', () => {
  it('preserva contexto e as duas keys da propriedade de arma', () => {
    expect(tokenizarComposicao('@ALVO.arma_principal leve').tokens.map(t => [t.tipo, t.valor])).toEqual([['contexto','ALVO'],['componente','arma_principal'],['componente','leve']]);
  });
  it('não transforma e nem nivel em operadores ou referências', () => {
    expect(tokenizarComposicao('outro e voce').tokens.every(t => t.tipo === 'componente')).toBe(true);
    expect(tokenizarComposicao('suporte nivel 2').tokens.map(t => t.valor)).toEqual(['suporte','nivel',2]);
  });
  it('conserva palavras reservadas dentro de argumento delimitado', () => {
    const r = tokenizarComposicao('contador "vida e brasas" fonte reliquia_lunar');
    expect(r.erros).toEqual([]);
    expect(r.tokens[1]).toMatchObject({ tipo: 'argumento', valor: 'vida e brasas' });
    expect(r.tokens[3]).toMatchObject({ tipo: 'identificador', valor: 'reliquia_lunar' });
  });
  it('mantém conceitos completos e reconhece acentos sem mudar ID de conteúdo', () => {
    expect(tokenizarComposicao('arma_principal corpo_a_corpo').tokens.map(t => t.valor)).toEqual(['arma_principal','corpo_a_corpo']);
    expect(tokenizarComposicao('DURAÇÃO turno segundos').tokens[0].valor).toBe('duração');
    expect(tokenizarComposicao('tem feitico Bola_de_Fogo').tokens[2].valor).toBe('Bola_de_Fogo');
  });
  it('distingue literal percentual e comparador com posições exatas', () => {
    const texto = '@USUARIO.vida <= 25%';
    const r = tokenizarComposicao(texto);
    expect(r.tokens.map(t => t.valor)).toEqual(['USUARIO','vida','<=',25]);
    expect(r.tokens.at(-1)).toMatchObject({ tipo: 'percentual' });
    expect(r.tokens.map(t => texto.slice(t.inicio,t.fim))).toEqual(['@USUARIO.','vida','<=','25%']);
  });
  it('diagnostica contexto, aspas e números inválidos', () => {
    for (const texto of ['@NINGUEM.vida', 'contador "brasas', 'contador ""', '1e999']) expect(tokenizarComposicao(texto).erros.length).toBeGreaterThan(0);
  });
});
