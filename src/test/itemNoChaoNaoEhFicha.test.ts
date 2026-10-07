import { describe, expect, it } from 'vitest';
import { resolverTokenDaFicha } from '@/lib/mapa/tokenDaFicha';
import type { Entity } from '@/stores/useMapStore';
const base = { shape: 'RECT', x: 0, y: 0, w: 10, h: 10, rotation: 0, color: '#fff', locked: true } as const;
describe('item no chão', () => {
  it('item solto com dono do perfil não vira o token da ficha', () => {
    const ents: Record<string, Entity> = {
      a: { ...base, id: 'a', ownerProfileId: 'p', groundItem: { droppedByCharId: 'u' } as never },
      b: { ...base, id: 'b', ownerProfileId: 'p' },
    };
    expect(resolverTokenDaFicha({ id: 'u', profileId: 'p' }, ents, { map: true, tokens: true, gm: true })?.id).toBe('b');
    delete ents.b;
    expect(resolverTokenDaFicha({ id: 'u', profileId: 'p' }, ents, { map: true, tokens: true, gm: true })).toBeUndefined();
  });
});
