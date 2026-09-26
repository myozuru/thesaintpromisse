import { describe, it, expect } from 'vitest';
import { sintonizacaoHealAmount, canOfferSintonizacao, reduceSintonizacaoMessage, listSintonizacaoTargets } from '@/lib/suporteSintonizacao';
import { getSpecAbility } from '@/lib/specAbilities';

const sup = (o: Record<string, unknown> = {}) => ({ id: 's', name: 'S', peCurrent: 5, selectedSpecAbilities: ['sup-sintonizacao-vital'], specAbilities: ['sup-sintonizacao-vital'], ...o }) as never;

describe('Sintonização Vital', () => {
  it('metade arredondada para cima', () => {
    expect(sintonizacaoHealAmount(7)).toBe(4);
    expect(sintonizacaoHealAmount(10)).toBe(5);
  });
  it('catálogo tier 4', () => {
    expect(getSpecAbility('sup-sintonizacao-vital')?.tier).toBe(4);
  });
  it('não oferece ao curar a si mesmo', () => {
    expect(canOfferSintonizacao(sup(), 's')).toBe(false);
  });
  it('sem PE suficiente não oferece', () => {
    expect(canOfferSintonizacao(sup({ peCurrent: 2 }), 'a')).toBe(false);
  });
  it('fora do mapa: todos exceto o curado', () => {
    const all = [{ id: 's' }, { id: 'a' }, { id: 'b' }] as never;
    expect(listSintonizacaoTargets('s', 'a', all, {}, { cellSize: 50, metersPerCell: 1.5 } as never).map((c: { id: string }) => c.id)).toEqual(['s', 'b']);
  });
  it('mensagens entre telas', () => {
    expect(reduceSintonizacaoMessage({ clientId: 'x', kind: 'offer', supporterId: 's', healedId: 'a', healAmount: 6, requestId: 'r' }, 'me', () => true).type).toBe('open');
    expect(reduceSintonizacaoMessage({ clientId: 'me', kind: 'offer', requestId: 'r' }, 'me', () => true).type).toBe('ignore');
    expect(reduceSintonizacaoMessage({ clientId: 'x', kind: 'accept', requestId: 'r' }, 'me', () => true).type).toBe('close');
  });
});
