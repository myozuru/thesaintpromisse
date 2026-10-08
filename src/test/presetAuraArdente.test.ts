import { describe, it, expect } from 'vitest';
import pacote from '../../public/omni-presets/aura-ardente.json';
describe('preset Aura Ardente 1', () => {
  const ent = pacote.entidades[0];
  const acao = ent.acoesAtivas[0];
  it('raio de 3 m', () => expect(ent.areaRaio).toEqual({ tipo: 'fixo', valor: 3 }));
  it('TR de Fortitude com 2d8 queimante só na falha', () => {
    expect([acao.teste, acao.tr, acao.dano, acao.tipoDano, acao.metadeNoSucesso]).toEqual(['tr', 'fortitude', '2d8', 'Queimante', false]);
  });
});
