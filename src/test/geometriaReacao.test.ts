import { describe, expect, it } from 'vitest';
import { amostrarTrajetoria, segmentoCruzaAlcance } from '@/lib/omni/geometriaReacao';

const pecaFixa = { x: 0, y: 0, w: 70, h: 70 };
const pecaMovel = { w: 70, h: 70 };
const grade = { dpi: 70, metersPerCell: 1.5 };

describe('trajetória de reações OMNI', () => {
  it('detecta passagem pelo alcance mesmo quando os dois extremos estão fora', () => {
    expect(segmentoCruzaAlcance({ x: -300, y: 0 }, { x: 300, y: 0 }, pecaFixa, pecaMovel, grade, 3)).toBe(true);
  });

  it('não detecta um trajeto que passa fora do alcance', () => {
    expect(segmentoCruzaAlcance({ x: -300, y: 150 }, { x: 300, y: 150 }, pecaFixa, pecaMovel, grade, 3)).toBe(false);
  });

  it('considera a largura e altura das peças no alcance borda a borda', () => {
    expect(segmentoCruzaAlcance({ x: -300, y: 0 }, { x: 300, y: 0 }, pecaFixa, { w: 210, h: 70 }, grade, 0)).toBe(true);
  });

  it('amostra os trechos intermediários em ordem e mantém os extremos no evento', () => {
    expect(amostrarTrajetoria({ x: 0, y: 0 }, { x: 100, y: 0 }, 25)).toEqual([
      { x: 25, y: 0 }, { x: 50, y: 0 }, { x: 75, y: 0 },
    ]);
    expect(amostrarTrajetoria({ x: 0, y: 0 }, { x: 10, y: 0 }, 20)).toEqual([]);
  });
});
