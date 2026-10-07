import { describe, expect, it } from 'vitest';
import { atendeRepMinima, nivelReputacao, repEfetiva, type Faccao } from '@/lib/economia/reputacao';
import { distanciaKm, sortearEncontros, tempoViagemSegundos } from '@/lib/economia/viagem';

const f: Faccao = { id: 'f', nome: 'Guilda', emblema: '🛡️', repGrupo: 20, repJogador: { a: 15 }, updatedAt: 0 };

describe('reputação', () => {
  it('soma grupo e individual', () => { expect(repEfetiva(f, 'a')).toBe(35); expect(repEfetiva(f, 'b')).toBe(20); });
  it('limita a 100', () => expect(repEfetiva({ ...f, repGrupo: 90 }, 'a')).toBe(100));
  it('Honrado dá 10% de desconto', () => expect(nivelReputacao(35).ajustePreco).toBe(-10));
  it('Hostil encarece 25%', () => expect(nivelReputacao(-40).ajustePreco).toBe(25));
  it('Inimigo faz a loja recusar', () => expect(nivelReputacao(-60).ajustePreco).toBeNull());
  it('quest exclusiva exige reputação mínima', () => {
    expect(atendeRepMinima(f, 'a', 30)).toBe(true);
    expect(atendeRepMinima(f, 'b', 30)).toBe(false);
  });
});

describe('viagem', () => {
  it('mede distância pela escala do mapa', () => expect(distanciaKm({ x: 0, y: 0 }, { x: 50, y: 0 }, 1000, 1)).toBe(500));
  it('a pé 30 km/dia: 60 km = 2 dias', () => expect(tempoViagemSegundos(60, 30)).toBe(2 * 86400));
  it('sorteia uma chance por dia', () => {
    expect(sortearEncontros(100, 3 * 86400, () => 0.5)).toEqual([1, 2, 3]);
    expect(sortearEncontros(0, 3 * 86400, () => 0)).toEqual([]);
  });
});