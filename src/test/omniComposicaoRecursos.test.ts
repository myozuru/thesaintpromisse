import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { avaliarFormula } from '@/lib/omni/parser';
const c = { id: 'composed-resource', name: 'Teste', level: 3, hpCurrent: 12, hpMax: 40, peCurrent: 3, peMax: 10,
  escCurrent: 5, escMax: 10, luckCurrent: 1, luckMax: 4, hitDiceCurrent: 2, hitDiceMax: 3,
  economiaPEReserve: 6, attributes: [{ id: 'forca', name: 'Força', value: 4 }],
  skills: [{ id: 'furtividade', name: 'Furtividade', value: 7 }],
  savingThrows: [{ id: 'fortitude', name: 'Fortitude', value: 5 }],
} as unknown as Character;
describe('recursos compostos conectados à ficha', () => {
  it.each([
    ['vida maximo', 40], ['percentual vida', 30], ['vida faltante', 28],
    ['percentual vida faltante', 70], ['vida temporaria maximo', 10], ['percentual vida temporaria', 50],
    ['pe maximo', 10], ['percentual pe', 30], ['percentual sorte', 25], ['dado_vida restante', 2],
    ['reserva pe recuperavel', 6], ['reserva pe maximo', 0], ['atributo for', 4], ['pericia furtividade', 7], ['tr fortitude', 5],
  ])('%s lê os dados reais', (texto, esperado) => {
    const r = avaliarFormula(String(texto), montarVariaveisDoPersonagem(c));
    expect(r.valor).toBe(esperado);
    expect(r.diagnosticos).toEqual([]);
  });
  it('qualquer recurso limitado reutiliza o mesmo operador percentual', () => {
    const r = avaliarFormula('percentual dado_vida + percentual vida', montarVariaveisDoPersonagem(c));
    expect(r.valor).toBe(97);
  });
  it('preserva o escopo em bags combinadas', () => {
    const bag = { ...montarVariaveisDoPersonagem(c), ...montarVariaveisDoPersonagem({ ...c, hpMax: 80 }, 'ALVO') };
    expect(avaliarFormula('vida maximo + @ALVO.vida maximo', bag).valor).toBe(120);
  });
});
