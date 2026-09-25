import { describe, it, expect } from 'vitest';
import {
  parseDamage, formatDamage, stepDamage, stepDamageStr,
  addBonusDice, biggestDie, maxOf,
} from '@/lib/damageStep';

describe('damageStep — parser', () => {
  it('parseia 1d6, 2d4, 1d12+1d4', () => {
    expect(parseDamage('1d6')).toEqual([{ count: 1, sides: 6 }]);
    expect(parseDamage('2d4')).toEqual([{ count: 2, sides: 4 }]);
    expect(parseDamage('1d12+1d4')).toEqual([
      { count: 1, sides: 12 }, { count: 1, sides: 4 },
    ]);
  });
  it('rejeita versátil sem escolha de mão', () => {
    expect(() => parseDamage('1d6/1d8')).toThrow();
  });
});

describe('damageStep — escala canônica', () => {
  it('1d6 +1 = 1d8', () => {
    expect(stepDamageStr('1d6', 1)).toBe('1d8');
  });
  it('1d6 +2 = 1d10', () => {
    expect(stepDamageStr('1d6', 2)).toBe('1d10');
  });
  it('1d8 +1 = 1d10', () => {
    expect(stepDamageStr('1d8', 1)).toBe('1d10');
  });
  it('1d8 -1 = 1d6', () => {
    expect(stepDamageStr('1d6', -1)).toBe('1d4');
  });
  it('1d10 +3 = 1d12+1d6', () => {
    expect(stepDamageStr('1d10', 3)).toBe('1d12+1d6');
  });
  it('1d12 +1 = 1d12+1d4', () => {
    expect(stepDamageStr('1d12', 1)).toBe('1d12+1d4');
  });
});

describe('damageStep — overflow acima de +3', () => {
  it('1d10 +4 sobe sequência de adicional (1d12+1d8)', () => {
    expect(stepDamageStr('1d10', 4)).toBe('1d12+1d8');
  });
  it('1d12 +5 chega em 1d12+1d12 e +6 vira 1d12+1d12+1d4', () => {
    expect(stepDamageStr('1d12', 5)).toBe('1d12+1d12');
    expect(stepDamageStr('1d12', 6)).toBe('1d12+1d12+1d4');
  });
});

describe('damageStep — redução abaixo de -2', () => {
  it('1d6 -3 = 1d2 (continua reduzindo o último termo)', () => {
    expect(stepDamageStr('1d6', -3)).toBe('1d2');
  });
  it('1d4 -3 chega em 1 (linha base 1, col=0)', () => {
    expect(stepDamageStr('1d4', -3)).toBe('1');
  });
  it('1d4 -5 chega em 1', () => {
    expect(stepDamageStr('1d4', -5)).toBe('1');
  });
});

describe('damageStep — multi-dado (linha 2d6)', () => {
  it('2d6 +1 = 2d8', () => {
    expect(stepDamageStr('2d6', 1)).toBe('2d8');
  });
  it('2d6 -1 = 2d6 (linha base = 2d6 padrão da linha)', () => {
    // 2d6 está em col=2 da linha; -1 cai em col=1 que é 1d10 nesta linha.
    expect(stepDamageStr('2d6', -1)).toBe('1d10');
  });
});

describe('damageStep — utilitários', () => {
  it('biggestDie acha o maior termo', () => {
    expect(biggestDie(parseDamage('1d6+1d12+1d4'))).toEqual({ count: 1, sides: 12 });
  });
  it('addBonusDice agrupa com termo existente', () => {
    expect(formatDamage(addBonusDice(parseDamage('1d12+1d6'), 1))).toBe('2d12+1d6');
  });
  it('maxOf soma máximos', () => {
    expect(maxOf(parseDamage('2d6'))).toBe(12);
    expect(maxOf(parseDamage('1d12+1d4'))).toBe(16);
  });
});
