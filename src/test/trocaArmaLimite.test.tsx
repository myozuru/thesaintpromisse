// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
import { ficha, montarMesa, comoTela, pegarFicha } from './helpers/mesaReal';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useItemStore } from '@/stores/useItemStore';
import { novaEntidade } from '@/lib/omni/tipos';
import { applyWeaponModel } from '@/lib/omni/weaponModel';
import { findWeaponByName } from '@/lib/weapons';
const arma = (n: string) => applyWeaponModel(novaEntidade('arma'), findWeaponByName(n)!);
beforeEach(() => {
  useInventoryStore.setState({ items: {}, deleted: {} }); useOmniEntidadesStore.setState({ entidades: {} }); useItemStore.setState({ items: [] });
  comoTela({ profileId: 'p', role: 'PLAYER' });
  montarMesa([ficha('u', { profileId: 'p', actionsCurrent: 1, bonusActionsCurrent: 1 })], { u: [0, 0] });
});
describe('limite de trocas de arma', () => {
  it('trocar direto de arma sem guardar não é infinito', () => {
    const a = useInventoryStore.getState().add('u', arma('Adaga'));
    const b = useInventoryStore.getState().add('u', arma('Espada Longa'));
    const eq = (n: string, id: string) => useCharacterStore.getState().equipWeapons('u', { mainHandName: n, offHandName: null, mainHandInstanceId: id, offHandInstanceId: null }, { inCombat: true, round: 1 });
    const r = [eq('Adaga', a.instanceId), eq('Espada Longa', b.instanceId), eq('Adaga', a.instanceId), eq('Espada Longa', b.instanceId)];
    console.log(r.map(x => x.ok + ':' + (x as any).actionUsed), pegarFicha('u').weaponSwapsThisTurn);
    expect(r[3].ok).toBe(false);
  });
});
