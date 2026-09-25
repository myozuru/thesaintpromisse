import { describe, it, expect } from 'vitest';
import { avaliarFormula, sobrescreverBuffsHomonimos } from '@/lib/omni/parser';

describe('Omni parser', () => {
  it('resolve aliases @TREINO e @NIVEL', () => {
    const r = avaliarFormula('@TREINO * 2 + @NIVEL', { TREINO: 3, NIVEL: 5 });
    expect(r.valor).toBe(11);
  });

  it('rola dados simples XdY', () => {
    const rng = () => 0.99; // sempre face máxima
    const r = avaliarFormula('2d6', {}, rng);
    expect(r.valor).toBe(12);
    expect(r.rolagens[0].rolls).toEqual([6, 6]);
  });

  it('suporta explosão XdY!', () => {
    // Sequência: 1.0→max, 1.0→max, 0→menor → para
    const seq = [0.99, 0.99, 0.0];
    let i = 0;
    const rng = () => seq[Math.min(i++, seq.length - 1)];
    const r = avaliarFormula('1d6!', {}, rng);
    expect(r.valor).toBeGreaterThanOrEqual(12); // 6 + 6 + 1
  });

  it('suporta vantagem (kh)', () => {
    const seq = [0.0, 0.99]; // 1, 6
    let i = 0;
    const rng = () => seq[Math.min(i++, seq.length - 1)];
    const r = avaliarFormula('2d6kh1', {}, rng);
    expect(r.valor).toBe(6);
  });

  it('suporta desvantagem (kl)', () => {
    const seq = [0.0, 0.99]; // 1, 6
    let i = 0;
    const rng = () => seq[Math.min(i++, seq.length - 1)];
    const r = avaliarFormula('2d6kl1', {}, rng);
    expect(r.valor).toBe(1);
  });

  it('combina dados com fórmula', () => {
    const rng = () => 0.99;
    const r = avaliarFormula('1d8 + @FOR', { FOR: 4 }, rng);
    expect(r.valor).toBe(12);
  });

  it('retorna 0 em expressão malformada sem explodir', () => {
    const r = avaliarFormula('(((', {});
    expect(r.valor).toBe(0);
  });
});

describe('Omni sobrescrita de buffs homônimos', () => {
  it('mantém somente o maior buff com mesmo nome+caminho', () => {
    const out = sobrescreverBuffsHomonimos([
      { nome: 'Benção de Força', caminho: 'atributos.forca', valor: 2 },
      { nome: 'Benção de Força', caminho: 'atributos.forca', valor: 4 },
      { nome: 'Benção de Força', caminho: 'atributos.forca', valor: 1 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].valor).toBe(4);
  });

  it('não mescla buffs com caminhos diferentes', () => {
    const out = sobrescreverBuffsHomonimos([
      { nome: 'Benção', caminho: 'atributos.forca', valor: 2 },
      { nome: 'Benção', caminho: 'atributos.destreza', valor: 3 },
    ]);
    expect(out).toHaveLength(2);
  });
});
