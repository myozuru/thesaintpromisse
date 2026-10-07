import { describe, it, expect } from 'vitest';
import { guildaDe, limitarRenome, nivelGuilda, renomeGanho, type Guilda } from './guilda';

const g = (id: string, membros: string[], deletedAt?: number): Guilda => ({ id, nome: id, emblema: '⚔️', lema: '', liderId: membros[0], membros, renome: 0, updatedAt: 1, deletedAt });

describe('guilda', () => {
  it('acha a guilda ativa da ficha', () => {
    expect(guildaDe({ a: g('a', ['x'], 5), b: g('b', ['x', 'y']) }, 'y')?.id).toBe('b');
    expect(guildaDe({ a: g('a', ['x'], 5) }, 'x')).toBeUndefined();
  });
  it('concluir dá no mínimo 10 de renome', () => {
    expect(renomeGanho(0)).toBe(10);
    expect(renomeGanho(25)).toBe(25);
  });
  it('renome nunca fica negativo', () => expect(limitarRenome(-7)).toBe(0));
  it('níveis', () => {
    expect(nivelGuilda(19).nome).toBe('Desconhecida');
    expect(nivelGuilda(20).nome).toBe('Iniciante');
    expect(nivelGuilda(300).nome).toBe('Lendária');
  });
});