import { describe, expect, it } from 'vitest';
import { isMasterControlledWorldSlice, podePublicarWorldSlice } from '@/lib/omni/worldSliceAuthorization';

describe('autorização das fatias compartilhadas', () => {
  it.each(['chronos', 'worldMap', 'worldBosses', 'worldBossesMaster', 'omniEntidades'] as const)(
    'só o Mestre pode publicar %s',
    (slice) => {
      expect(podePublicarWorldSlice('MASTER', slice)).toBe(true);
      expect(podePublicarWorldSlice('PLAYER', slice)).toBe(false);
      expect(podePublicarWorldSlice(null, slice)).toBe(false);
      expect(isMasterControlledWorldSlice(slice)).toBe(true);
    },
  );

  it.each(['characters', 'omniInventory', 'omniRuntime', 'omniSpatial'] as const)(
    '%s continua sincronizável por jogador quando a regra permite ação de ficha',
    (slice) => {
      expect(podePublicarWorldSlice('PLAYER', slice)).toBe(true);
      expect(isMasterControlledWorldSlice(slice)).toBe(false);
    },
  );
});
