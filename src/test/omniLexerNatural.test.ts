import { describe, expect, it } from 'vitest';
import { tokenizarNatural } from '@/lib/omni/lexerNatural';

describe('lexer da sintaxe natural OMNI', () => {
  it('normaliza comparação com acento sem perder palavra nem posição original', () => {
    const text = 'se usuário até 4,5m então aplicar condenado';
    const r = tokenizarNatural(text);
    expect(r.erros).toEqual([]);
    expect(r.tokens.find(t => t.valor === 'usuário')).toMatchObject({ tipo: 'palavra', normalizado: 'usuario', inicio: 3, fim: 10 });
    expect(r.tokens.find(t => t.tipo === 'numero')).toMatchObject({ valor: 4.5, unidade: 'metros' });
    for (const token of r.tokens) expect(text.slice(token.inicio, token.fim).length).toBe(token.fim - token.inicio);
  });
  it('reconhece então/entao, e/ou, compostos e caixa preservando IDs', () => {
    const r = tokenizarNatural('ENTÃO causa e aplica ou corpo_a_corpo Rancor_Lunar');
    expect(r.erros).toEqual([]);
    expect(r.tokens.map(t => t.tipo === 'palavra' ? t.normalizado : t.valor)).toEqual(['entao','causa','e','aplica','ou','corpo_a_corpo','rancor_lunar']);
    expect(r.tokens.at(-1)).toMatchObject({ valor: 'Rancor_Lunar' });
  });
  it('preserva números, percentuais, unidades e separadores de milhar não ambíguos', () => {
    const r = tokenizarNatural('4.5m 4,5 metros 30% 2 turnos 10 PE 12 PV');
    expect(r.erros).toEqual([]);
    expect(r.tokens.filter(t => t.tipo === 'numero' || t.tipo === 'percentual')).toEqual([
      expect.objectContaining({ tipo:'numero', valor:4.5, unidade:'metros' }),
      expect.objectContaining({ tipo:'numero', valor:4.5 }),
      expect.objectContaining({ tipo:'percentual', valor:30 }),
      expect.objectContaining({ tipo:'numero', valor:2 }),
      expect.objectContaining({ tipo:'numero', valor:10 }),
      expect.objectContaining({ tipo:'numero', valor:12 }),
    ]);
    expect(r.tokens.filter(t => t.tipo === 'palavra').map(t => t.normalizado)).toContain('unidade:turnos');
    expect(r.tokens.filter(t => t.tipo === 'palavra').map(t => t.normalizado)).toContain('pe');
    expect(r.tokens.filter(t => t.tipo === 'palavra').map(t => t.normalizado)).toContain('pv');
  });
  it('lê dados como uma unidade lexical e rejeita quantidades/lados fora do limite', () => {
    const r = tokenizarNatural('2d8 + 1d20kh2 + d6');
    expect(r.erros).toEqual([]);
    expect(r.tokens.filter(t => t.tipo === 'dado').map(t => t.valor)).toEqual(['2d8','1d20kh2','d6']);
    expect(tokenizarNatural('9007199254740992d6').erros).toHaveLength(1);
    expect(tokenizarNatural('1d0').erros).toHaveLength(1);
  });
  it('preserva texto entre aspas para não interpretar palavras internas como gramática', () => {
    const r = tokenizarNatural('marcar "vida e Rancor" então');
    expect(r.erros).toEqual([]);
    expect(r.tokens[1]).toMatchObject({ tipo: 'texto', valor: 'vida e Rancor' });
    expect(r.tokens[2]).toMatchObject({ tipo: 'palavra', normalizado: 'entao' });
  });
  it('fornece offsets UTF-16 e erros localizados para sintaxe antiga e caracteres ilegais', () => {
    const text = '@ALVO.vida -> ação §';
    const r = tokenizarNatural(text);
    expect(r.erros.map(e => e.trecho)).toEqual(['@','->','§']);
    for (const error of r.erros) expect(text.slice(error.inicio, error.fim)).toBe(error.trecho);
    expect(r.erros[1].mensagem).toMatch(/então/);
  });
  it('diagnostica texto não fechado e números não finitos sem travar em Unicode', () => {
    expect(tokenizarNatural('aplicar “Condenado').erros[0].mensagem).toMatch(/não foi fechado/);
    expect(tokenizarNatural('9e999').erros[0].mensagem).toMatch(/finito/);
    expect(tokenizarNatural('coração 🗡').erros).toMatchObject([{ trecho: '🗡' }]);
  });
  it('não decompõe nomes compostos conhecidos do contrato', () => {
    const r = tokenizarNatural('cortar corpo_a_corpo com contador_rancor e arma_principal');
    expect(r.erros).toEqual([]);
    expect(r.tokens.filter(t => t.tipo === 'palavra').map(t => t.valor)).toEqual(['cortar','corpo_a_corpo','com','contador_rancor','e','arma_principal']);
  });
});
