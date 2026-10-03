// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
import { ficha, montarMesa, pegarFicha, limparMesa } from './helpers/mesaReal';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
afterEach(limparMesa);
describe('produtores reais do histórico', () => {
  it('conta a cura efetiva e o dano após RD e proteção temporária', () => {
    montarMesa([ficha('hist-real', { hpCurrent: 7, hpMax: 10, escCurrent: 5, rd: 2 })], {});
    useCombatStore.setState({ round: 2 });
    useCharacterStore.getState().applyHealing('hist-real', 20);
    expect(pegarFicha('hist-real').omniCounters?.cura_recebida_nesta_rodada).toBe(3);
    useCharacterStore.getState().applyDamage('hist-real', 10);
    expect(pegarFicha('hist-real').omniCounters).toMatchObject({ ultimo_dano_recebido: 8, ultimo_dano_temporario: 5, vida_perdida_nesta_rodada: 3 });
  });
});
