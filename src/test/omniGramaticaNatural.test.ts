import { describe, expect, it } from 'vitest';
import { analisarFraseNatural } from '@/lib/omni/gramaticaNatural';

describe('gramática e AST da sintaxe natural OMNI', () => {
  it('separa condição contínua, ação e distância com unidade', () => {
    const r = analisarFraseNatural('se aliado até 3m então conceder +2 em defesa');
    expect(r.erros).toEqual([]);
    expect(r.ast?.condicao).toMatchObject({ tipo:'atomo', classe:'condicao', texto:'aliado até 3m' });
    expect(r.ast?.acoes).toEqual([expect.objectContaining({ verbo:'conceder', texto:'conceder +2 em defesa' })]);
  });
  it('classifica evento e separa ações encadeadas sem quebrar compostos', () => {
    const r = analisarFraseNatural('ao acertar crítico então causar 1d4 de dano psiquico e aplicar condenado por 2 rodadas');
    expect(r.erros).toEqual([]);
    expect(r.ast?.condicao).toMatchObject({ tipo:'atomo', classe:'evento' });
    expect(r.ast?.acoes.map(a => a.verbo)).toEqual(['causar','aplicar']);
    expect(r.ast?.acoes[0].texto).toContain('1d4 de dano psiquico');
  });
  it('preserva o evento de dano do aliado e o filtro de alcance como uma condição', () => {
    const r = analisarFraseNatural('quando aliado até 4.5m sofrer dano de inimigo então acumular 1 contador_rancor até treino');
    expect(r.erros).toEqual([]);
    expect(r.ast?.condicao).toMatchObject({ tipo:'atomo', classe:'evento', texto:'quando aliado até 4.5m sofrer dano de inimigo' });
    expect(r.ast?.acoes[0].texto).toContain('contador_rancor');
  });
  it('aplica precedência e > ou e mantém parênteses', () => {
    const r = analisarFraseNatural('se (esta_furtivo ou invisivel) e ao acertar então causar 2d6 de dano perfuracao');
    expect(r.erros).toEqual([]);
    expect(r.ast?.condicao).toMatchObject({ tipo:'e', esquerda:{ tipo:'ou' }, direita:{ tipo:'atomo', classe:'evento' } });
    const nested = analisarFraseNatural('se A ou B e C então aplicar cego');
    expect(nested.ast?.condicao).toMatchObject({ tipo:'ou', direita:{ tipo:'e' } });
  });
  it('trata expressão de dano escalonado como uma única ação até o próximo verbo', () => {
    const r = analisarFraseNatural('ao acertar então gastar tudo em contador_rancor e causar 2d8 de dano corte mais 1d8 adicional de dano energetico por contador_rancor gasto');
    expect(r.erros).toEqual([]);
    expect(r.ast?.acoes.map(a => a.verbo)).toEqual(['gastar','causar']);
    expect(r.ast?.acoes[1].texto).toContain('mais 1d8 adicional');
  });
  it('mantém aspas opacas ao separar condições e ações', () => {
    const r = analisarFraseNatural('se flag_primeiro então marcar "vida e rancor" e aplicar condenado');
    expect(r.erros).toEqual([]);
    expect(r.ast?.acoes.map(a => a.verbo)).toEqual(['marcar','aplicar']);
    expect(r.ast?.acoes[0].texto).toContain('"vida e rancor"');
  });
  it.each([
    ['', /vazia/], ['ao acertar causar dano', /Falta/], ['se A então B', /não reconhecido/],
    ['se A então causar fogo então aplicar cego', /único/], ['se A então', /sem ação/],
    ['se e A então aplicar cego', /vazia/], ['se A então e aplicar cego', /reconhecido|vazia/],
  ])('diagnostica estrutura incompleta sem produzir AST: %s', (source, expected) => {
    const r = analisarFraseNatural(source);
    expect(r.ast).toBeUndefined();
    expect(r.erros[0].mensagem).toMatch(expected);
  });
  it('preserva intervalos de ações após acentos e expressões agrupadas', () => {
    const source = 'ao sofrer dano então causar (1d8 + 2) de dano corte e curar 2d6 de vida';
    const r = analisarFraseNatural(source);
    expect(r.erros).toEqual([]);
    for (const a of r.ast!.acoes) expect(source.slice(a.intervalo.inicio, a.intervalo.fim)).toBe(a.texto);
  });
  it('rejeita agrupamento de condição inválido e reconhece parenteses fechados', () => {
    expect(analisarFraseNatural('se (A ou B então aplicar cego').ast).toBeUndefined();
    expect(analisarFraseNatural('se (A ou B) então aplicar cego').erros).toEqual([]);
  });
});
