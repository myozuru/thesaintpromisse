import { describe, it, expect } from 'vitest';
import { desvantagensFerimentos, cdFeridaInterna } from '@/lib/ferimentosEfeitos';
const f = (...r: number[]) => ({ ferimentosComplexos: r.map((resultado) => ({ id: String(resultado), resultado, nome: '', desde: 0 })) });
describe('Ferimentos Complexos — desvantagens', () => {
  it('olho: Percepção e ataque à distância, não corpo a corpo', () => {
    expect(desvantagensFerimentos(f(1), { kind: 'skill', name: 'Percepção' })).toHaveLength(1);
    expect(desvantagensFerimentos(f(2), { kind: 'attack', subtype: 'ranged' })).toHaveLength(1);
    expect(desvantagensFerimentos(f(1), { kind: 'attack', subtype: 'melee' })).toHaveLength(0);
  });
  it('perna: Acrobacia; braço: Atletismo', () => {
    expect(desvantagensFerimentos(f(4), { kind: 'skill', name: 'Acrobacia' })).toHaveLength(1);
    expect(desvantagensFerimentos(f(9), { kind: 'skill', name: 'Atletismo' })).toHaveLength(1);
    expect(desvantagensFerimentos(f(4), { kind: 'skill', name: 'Atletismo' })).toHaveLength(0);
  });
});
describe('Ferida interna', () => {
  it('CD 20 + nível; tratada vira 10', () => {
    expect(cdFeridaInterna({ ...f(7), level: 5 })).toBe(25);
    expect(cdFeridaInterna({ ferimentosComplexos: [{ id: 'x', resultado: 7, nome: '', desde: 0, tratada: true }], level: 5 })).toBe(10);
  });
});
