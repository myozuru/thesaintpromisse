import { describe, expect, it } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';
import { autoArrobaExpressao, normalizarConjuncaoComoSoma, normalizarConjuncaoLogica, desconstruirScript } from '@/lib/omni/omniScript';
import { anexarDadosCompostos } from '@/lib/omni/componentes/contexto';

const composicoes = { USUARIO: { selecoes: {
  vida: { valor: 12, campos: { maximo: 40 } },
  cura: { campos: { recebida: { campos: { rodada: 9 } } } },
  contador: { registros: { 'vida e morte': 3, '2d6': 4 } },
  outro: { id: 'p1' }, voce: { id: 'p1' },
} } };

describe('composições dentro de fórmulas', () => {
  it('combina operações genéricas, matemática e referências antigas', () => {
    const r = avaliarFormula('percentual vida + @TREINO + cura recebida nesta rodada', { TREINO: 2 }, undefined, { composicoes });
    expect(r.valor).toBe(41);
    expect(r.diagnosticos).toEqual([]);
  });
  it('resolve contexto explícito e limiar sem arredondar a vida', () => {
    expect(avaliarFormula('@USUARIO.vida ate 50%', {}, undefined, { composicoes }).valor).toBe(1);
  });
  it('não rola dados que fazem parte do nome de um contador', () => {
    const r = avaliarFormula('contador "2d6" + 1', {}, () => 0, { composicoes });
    expect(r.valor).toBe(5);
    expect(r.rolagens).toEqual([]);
  });
  it('mantém conectores internos ao converter conjunções externas', () => {
    expect(normalizarConjuncaoComoSoma('outro e voce e 2')).toBe('outro e voce + 2');
    expect(normalizarConjuncaoLogica('outro e voce e vida > 0')).toBe('outro e voce && vida > 0');
    expect(normalizarConjuncaoComoSoma('contador "vida e morte" e 2')).toBe('contador "vida e morte" + 2');
  });
  it('auto-@ conserva uma composição e continua prefixando chaves simples', () => {
    expect(autoArrobaExpressao('cura recebida nesta rodada + treino')).toBe('cura recebida nesta rodada + @USUARIO.treino');
  });
  it('informa contexto indisponível em vez de aceitar silenciosamente uma referência', () => {
    const r = avaliarFormula('cura recebida nesta rodada');
    expect(r.valor).toBe(0);
    expect(r.diagnosticos[0].referencia).toBe('cura recebida nesta rodada');
  });
  it('preserva referências legadas pontuadas e funções matemáticas', () => {
    expect(avaliarFormula('max(@vida, 2) + @TREINO', { VIDA: 4, TREINO: 3 }).valor).toBe(7);
  });
  it('preserva dados dos dois participantes após combinar bags', () => {
    const a = anexarDadosCompostos({}, 'USUARIO', composicoes.USUARIO);
    const b = anexarDadosCompostos({}, 'ALVO', { selecoes: { vida: { valor: 5, campos: { maximo: 20 } } } });
    expect(avaliarFormula('percentual vida + @ALVO.vida maximo', { ...a, ...b }).valor).toBe(50);
    expect(JSON.stringify(a)).toBe('{}');
  });
  it('aceita observadores com recursos compostos e base percentual explícita', () => {
    const r = desconstruirScript('quando vida temporaria <= 50% de vida temporaria maximo -> somar 1 em pe');
    expect(r.watcher).toMatchObject({ resource: 'vida temporaria', threshold: .5, percentBase: 'vida temporaria maximo' });
  });
});
