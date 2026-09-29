import { describe, it, expect } from 'vitest';
import { parseRangeMeters, isWithinRangeMeters, touchDistanceMeters } from '@/lib/touchRange';

const grid = { dpi: 70, metersPerCell: 1.5 };
const at = (cx: number, cy: number, size = 70) => ({ x: cx * 70, y: cy * 70, w: size, h: size });

describe('auditoria de alcance', () => {
  it('interpreta textos de alcance', () => {
    expect(parseRangeMeters('9 m')).toBe(9);
    expect(parseRangeMeters('4,5m')).toBe(4.5);
    expect(parseRangeMeters('Toque')).toBe(1.5);
    expect(parseRangeMeters('Pessoal')).toBe(0);
    expect(parseRangeMeters('')).toBeNull();
  });

  it('feitiço de toque bloqueia alvo a 2 casas e libera adjacente (inclui diagonal)', () => {
    expect(isWithinRangeMeters(at(0, 0), at(1, 1), grid, 1.5)).toBe(true);
    expect(isWithinRangeMeters(at(0, 0), at(2, 0), grid, 1.5)).toBe(false);
  });

  it('9 m = 6 casas; 7 casas fica fora', () => {
    expect(isWithinRangeMeters(at(0, 0), at(6, 3), grid, 9)).toBe(true);
    expect(isWithinRangeMeters(at(0, 0), at(7, 0), grid, 9)).toBe(false);
  });

  it('peças grandes medem borda a borda', () => {
    // criatura 2x2 centrada entre casas: adjacente pela borda
    expect(touchDistanceMeters(at(0, 0), { x: 105, y: 0, w: 140, h: 140 }, grid)).toBeLessThanOrEqual(1.55);
  });

  it('respeita metros por casa configurados no mapa', () => {
    expect(isWithinRangeMeters(at(0, 0), at(3, 0), { dpi: 70, metersPerCell: 3 }, 9)).toBe(true);
    expect(isWithinRangeMeters(at(0, 0), at(4, 0), { dpi: 70, metersPerCell: 3 }, 9)).toBe(false);
  });
});
