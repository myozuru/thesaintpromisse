import { describe, expect, it } from 'vitest';
import {
  aetherisRequiemReady,
  aetherisRoundUseReady,
  baculoAetherisBlockReason,
  baculoAetherisEquipped,
  baculoAetherisFallDice,
  fallDamageDice,
  ignoresNaturalDifficultTerrain,
  validAetherisFeatherAllocation,
} from '@/lib/baculoAetheris';
import { effectiveMovement } from '@/lib/movementBudget';
import { movementCostForTerrainSegment, routePrefixByDistance } from '@/lib/mapa/terrenoDificil';

const naturalArea = { x: 50, y: 0, w: 20, h: 40, shape: 'RECT' as const, difficultTerrain: 'natural' as const };

describe('Aetheris movement, terrain and fall', () => {
  it('caps Ventos Favoráveis to the first 4.5 m of the physical route', () => {
    expect(routePrefixByDistance([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 100, y: 0 }], 4.5, 0.1)).toEqual([
      { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 45, y: 0 },
    ]);
    expect(routePrefixByDistance([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 40, y: 0 }], 4.5, 0.1)).toEqual([
      { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 40, y: 0 },
    ]);
  });

  it('adds 3 m movement and ignores only natural difficult terrain', () => {
    const wielder = { movement: 9, slotsCurrent: 0, slotsMax: 10, mainHandWeaponName: 'Baculo Aetheris' };
    expect(baculoAetherisEquipped(wielder)).toBe(true);
    expect(baculoAetherisEquipped({ mainHandWeaponName: 'Aetheris, o Báculo do Firmamento' })).toBe(true);
    expect(effectiveMovement(wielder)).toBe(12);
    expect(movementCostForTerrainSegment({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.1, [naturalArea])).toBeCloseTo(12);
    expect(movementCostForTerrainSegment({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.1, [naturalArea], ignoresNaturalDifficultTerrain(wielder))).toBeCloseTo(10);
    const magical = { ...naturalArea, difficultTerrain: 'magical' as const };
    expect(movementCostForTerrainSegment({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.1, [magical], true)).toBeCloseTo(12);
  });

  it('unions overlapping areas without doubling the same segment twice', () => {
    const overlap = { ...naturalArea, x: 60, w: 20, difficultTerrain: 'magical' as const };
    expect(movementCostForTerrainSegment({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.1, [naturalArea, overlap])).toBeCloseTo(13);
  });

  it('aplica 0 de dano at? 18 m e s? o excedente do b?culo acima disso', () => {
    expect(fallDamageDice(15)).toBe(4);
    expect(baculoAetherisFallDice(15)).toBe(0);
    expect(baculoAetherisFallDice(18)).toBe(0);
    expect(baculoAetherisFallDice(24)).toBe(1);
  });

  it('limita Plumas a tr?s cargas inteiras e rejeita alvos sem carga', () => {
    expect(validAetherisFeatherAllocation({ a: 3 })).toBe(true);
    expect(validAetherisFeatherAllocation({ a: 1, b: 1, c: 1 })).toBe(true);
    expect(validAetherisFeatherAllocation({ a: 4 })).toBe(false);
    expect(validAetherisFeatherAllocation({ a: 1.5 })).toBe(false);
    expect(validAetherisFeatherAllocation({ a: 0, b: 0 })).toBe(false);
  });

  it('trava Rajada por rodada e R?quiem por combate, a??o b?nus ou PE', () => {
    expect(aetherisRoundUseReady({ combatId: 'scene-1', round: 2 }, 'scene-1', 2)).toBe(false);
    expect(aetherisRoundUseReady({ combatId: 'scene-1', round: 2 }, 'scene-1', 3)).toBe(true);
    expect(aetherisRoundUseReady({ combatId: 'scene-1', round: 2 }, 'scene-2', 1)).toBe(true);
    const ready = { peCurrent: 16, tempPE: 2, actionsCurrent: 1, bonusActionsCurrent: 1 };
    expect(aetherisRequiemReady(ready, undefined, 'scene-1')).toBe(true);
    expect(aetherisRequiemReady({ ...ready, bonusActionsCurrent: 0 }, undefined, 'scene-1')).toBe(false);
    expect(aetherisRequiemReady({ ...ready, tempPE: 0 }, undefined, 'scene-1')).toBe(false);
    expect(aetherisRequiemReady(ready, 'scene-1', 'scene-1')).toBe(false);
  });

  it('reports exact PE, bonus action and reaction block reasons', () => {
    const state = { peCurrent: 5, tempPE: 0, actionsCurrent: 1, bonusActionsCurrent: 0, reactionsCurrent: 0, reactionsMax: 1 };
    expect(baculoAetherisBlockReason(state, 8)).toBe('PE insuficiente: requer 8, voc\u00ea possui 5');
    expect(baculoAetherisBlockReason(state, 0, { bonus: true })).toBe('A\u00e7\u00e3o B\u00f4nus indispon\u00edvel nesta rodada');
    expect(baculoAetherisBlockReason(state, 0, { reaction: true })).toBe('Sem Rea\u00e7\u00e3o dispon\u00edvel nesta rodada');
  });
});
