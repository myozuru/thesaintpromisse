import { describe, expect, it } from 'vitest';
import type { Entity } from '@/stores/useMapStore';
import { detectOpportunityCandidates } from '@/components/mapa/opportunityEngine';
import type { AdoGrant } from '@/stores/useOpportunityStore';

const entity = (id: string, characterId: string, x: number): Entity => ({
  id, characterId, x, y: 0, w: 20, h: 20, rotation: 0, shape: 'RECT', layer: 'tokens',
} as Entity);
const guard = entity('guard-token', 'guard', 200);
const grants: Record<string, AdoGrant> = { guard: { mode: 'reaction' } };

describe('Ataque de Oportunidade respeita a trajetória confirmada', () => {
  it('detecta entrada e saída do alcance mesmo quando o início e fim estão distantes', () => {
    const moving = entity('moving-token', 'moving', 400);
    expect(detectOpportunityCandidates({
      moving, prevX: 0, prevY: 0, entities: { moving, guard }, grants,
      charNames: { guard: 'Guarda' }, grid: { dpi: 70, metersPerCell: 1.5 },
    })).toEqual([{ charId: 'guard', charName: 'Guarda', entityId: 'guard-token', mode: 'reaction' }]);
  });

  it('não dispara se a criatura entra no alcance e termina dentro dele', () => {
    const moving = entity('moving-token', 'moving', 120);
    expect(detectOpportunityCandidates({
      moving, prevX: 0, prevY: 0, entities: { moving, guard }, grants,
      charNames: { guard: 'Guarda' }, grid: { dpi: 70, metersPerCell: 1.5 },
    })).toEqual([]);
  });

  it('usa waypoints do arraste curvo para detectar a saída do alcance', () => {
    const moving = entity('moving-token', 'moving', 400);
    expect(detectOpportunityCandidates({
      moving, prevX: 0, prevY: 0,
      trajetoria: [{ x: 180, y: 0 }, { x: 220, y: 20 }, { x: 260, y: 0 }],
      entities: { moving, guard }, grants, charNames: { guard: 'Guarda' },
      grid: { dpi: 70, metersPerCell: 1.5 },
    })).toHaveLength(1);
  });
});
