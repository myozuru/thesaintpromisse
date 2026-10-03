import { describe, it, expect } from 'vitest';
import catalogo from '../../docs/omni-componentes/catalogo.json';
import { interpretarComposicao } from '@/lib/omni/componentes/interpretar';
const keys = new Map(catalogo.componentes.map(c => [c.id, c.key]));
const casos = catalogo.conversoes.map(c => {
  let texto = c.sequencia.map(t => t.tipo === 'componente' ? keys.get(t.id!) : t.tipo === 'literal' ? t.grafia : t.marcador!.includes('metros') ? '<= 3' : t.marcador === '<número>' ? '>= 3' : t.marcador === '<grupo>' ? 'Faca' : t.marcador === '<moeda>' ? 'yen' : t.marcador!.includes('dano') ? 'arma' : 'alvo-01').join(' ');
  return { origem: c.origem, texto };
});
describe('gramática de todas as conversões aprovadas', () => {
  it.each(casos)('$origem: $texto', ({ texto }) => {
    const r = interpretarComposicao(texto);
    // Comparações numéricas são matemáticas externas à referência.
    const fim = texto.indexOf('<=') >= 0 ? texto.indexOf('<=') : texto.indexOf('>=');
    expect(r.erro).toBeUndefined();
    expect(r.referencia).toBeDefined();
    expect(r.consumido).toBe(fim >= 0 ? texto.slice(0, fim).trim().length : texto.length);
  });
});
