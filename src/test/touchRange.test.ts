import { describe, it, expect } from 'vitest';
import { checkTouchTarget, isWithinTouch, touchDistanceMeters } from '@/lib/touchRange';

const grid = { dpi: 70, metersPerCell: 1.5 };
const tok = (x: number, y: number, s = 70) => ({ x, y, w: s, h: s });

describe('Alcance de toque (1,5 m)', () => {
  it('casa adjacente = 1,5 m (toca)', () => {
    expect(touchDistanceMeters(tok(0, 0), tok(70, 0), grid)).toBeCloseTo(1.5);
    expect(isWithinTouch(tok(0, 0), tok(70, 0), grid)).toBe(true);
  });
  it('diagonal adjacente também toca', () => {
    expect(isWithinTouch(tok(0, 0), tok(70, 70), grid)).toBe(true);
  });
  it('duas casas de distância (3 m) não toca', () => {
    expect(isWithinTouch(tok(0, 0), tok(140, 0), grid)).toBe(false);
  });
  it('peça grande conta pela borda', () => {
    expect(isWithinTouch(tok(0, 0, 140), tok(105, 0), grid)).toBe(true);
  });
  it('checkTouchTarget: si mesmo sempre ok, sem peça bloqueia', () => {
    const ents = { a: { ...tok(0, 0), characterId: 'A' }, b: { ...tok(210, 0), characterId: 'B' } };
    expect(checkTouchTarget('A', 'A', {}, grid)).toBeNull();
    expect(checkTouchTarget('A', 'C', ents, grid)).toMatch(/no mapa/);
    expect(checkTouchTarget('A', 'B', ents, grid)).toMatch(/fora do alcance/);
    expect(checkTouchTarget('A', 'B', { ...ents, b: { ...tok(70, 0), characterId: 'B' } }, grid)).toBeNull();
  });
});
