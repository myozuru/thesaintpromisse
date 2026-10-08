import { describe, it, expect } from 'vitest';
import { ladoIniciativaPorFicha } from '@/lib/mapa/ladoIniciativa';
describe('lado da iniciativa pela ficha', () => {
  it('ficha INIMIGO entra como inimigo mesmo na camada normal', () => expect(ladoIniciativaPorFicha('INIMIGO', 'tokens')).toBe('enemy'));
  it('ficha PLAYER entra como grupo mesmo na camada do Mestre', () => expect(ladoIniciativaPorFicha('PLAYER', 'gm')).toBe('pc'));
  it('sem ficha usa a camada', () => expect(ladoIniciativaPorFicha(undefined, 'gm')).toBe('enemy'));
});
