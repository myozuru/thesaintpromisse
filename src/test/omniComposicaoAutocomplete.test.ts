import { describe, expect, it } from 'vitest';
import { DICIONARIO_AUTOCOMPLETE, extrairPrefixoNoCaret, sugerirNoCaret } from '@/lib/omni/dicionarioAutocomplete';
import { COMPONENTES_OMNI } from '@/lib/omni/componentes/ids';
describe('autocomplete independente dos componentes', () => {
  it('inclui cada componente com sua explicação individual', () => {
    for (const c of COMPONENTES_OMNI) expect(DICIONARIO_AUTOCOMPLETE.find(s => s.valor === c)?.hint).toBeTruthy();
  });
  it('completa a propriedade de uma arma sem substituir o seletor', () => {
    const t = 'arma_principal le', p = extrairPrefixoNoCaret(t, t.length);
    expect(t.slice(0, p.inicio)).toBe('arma_principal ');
    expect(sugerirNoCaret(t, t.length).map(s => s.valor)).toEqual(['leve']);
  });
  it('não sugere keys dentro de um nome ou ID esperado', () => {
    expect(sugerirNoCaret('contador vi', 11)).toEqual([]);
    expect(sugerirNoCaret('tem feitico foo', 15)).toEqual([]);
  });
  it('sugere IDs de condições no argumento adequado', () => {
    const t = 'tem condicao conden';
    expect(sugerirNoCaret(t, t.length).map(s => s.valor)).toContain('condenado');
  });
  it('preserva acentos e hífens dos argumentos no caret', () => {
    expect(extrairPrefixoNoCaret('contador carga-01', 17).prefixo).toBe('carga-01');
    expect(extrairPrefixoNoCaret('duração', 7).prefixo).toBe('duração');
  });
});
