import { describe, expect, it } from 'vitest';
import { calcularContador, somarFontes } from '@/lib/omni/contadores';

describe('auditoria etapa 3: conservação e limites de cargas', () => {
  it.each(['INCREMENTAR_CONTADOR', 'DEFINIR_CONTADOR'])('%s respeita teto zero e teto positivo', acao => {
    expect(calcularContador({}, 'rancor', acao, { valor: 5, teto: 0 }).counters.rancor).toBe(0);
    expect(calcularContador({}, 'rancor', acao, { valor: 5, teto: 2 }).counters.rancor).toBe(2);
    expect(calcularContador({}, 'rancor', acao, { valor: 5 }).counters.rancor).toBe(5);
  });
  it('passar de global para fonte preserva cargas já existentes', () => {
    const r = calcularContador({ rancor: 3 }, 'rancor', 'INCREMENTAR_CONTADOR', { valor: 1, teto: 2, escopoTeto: 'porFonte', fonteId: 'bia' });
    expect(r.counters).toEqual({ rancor: 4, rancor__fonte__geral: 3, rancor__fonte__bia: 1 });
  });
  it('acúmulo global e consumo parcial preservam a soma das parcelas', () => {
    let c = { rancor: 3, rancor__fonte__bia: 2, rancor__fonte__caio: 1 };
    c = calcularContador(c, 'rancor', 'INCREMENTAR_CONTADOR', { valor: 2 }).counters as typeof c;
    expect(c.rancor).toBe(5); expect(somarFontes(c, 'rancor')).toBe(5);
    c = calcularContador(c, 'rancor', 'CONSUMIR_CONTADOR', { valor: 2 }).counters as typeof c;
    expect(c.rancor).toBe(3); expect(somarFontes(c, 'rancor')).toBe(3);
    const fim = calcularContador(c, 'rancor', 'CONSUMIR_CONTADOR', { valor: 0 });
    expect(fim.consumido).toBe(3); expect(fim.counters).toEqual({ rancor: 0 });
  });
  it('uma fração positiva arredondada para zero não consome a fonte inteira', () => {
    const c = { rancor: 2, rancor__fonte__bia: 2 };
    expect(calcularContador(c, 'rancor', 'CONSUMIR_CONTADOR', { valor: 0.4, fonteExata: true, fonteId: 'bia' }).counters).toEqual(c);
  });
  it.each([NaN, Infinity, -Infinity])('valor não finito %s não contamina o contador', valor => {
    const c = { rancor: 2 };
    expect(calcularContador(c, 'rancor', 'INCREMENTAR_CONTADOR', { valor }).counters).toEqual(c);
    expect(calcularContador(c, 'rancor', 'INCREMENTAR_CONTADOR', { valor: 1, teto: valor }).counters).toEqual(c);
  });
});
