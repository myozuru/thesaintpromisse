import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/safeClient', () => ({
  hasWorkspaceCloud: true,
  supabase: { rpc: mocks.rpc },
}));

import { aplicarOperacoesContadorOmni, aplicarSnapshotContadoresOmni } from '@/lib/omni/contadorSync';
import { useCharacterStore } from '@/stores/useCharacterStore';
import type { Character } from '@/types';

const personagem = (extra: Partial<Character> = {}) => ({
  id: 'portador', name: 'Portador', category: 'PLAYER', level: 1,
  hpCurrent: 20, hpMax: 20, peCurrent: 10, peMax: 10, escCurrent: 0, escMax: 0,
  ca: 10, baseDC: 10, rd: 0, rdByType: {}, slotsMax: 0, slotsCurrent: 0,
  attributes: [], skills: [], savingThrows: [], passives: [], spells: [],
  omniCounters: { rancor: 0 }, omniCounterSourceUsage: {},
  ...extra,
} as unknown as Character);

describe('sincronização transacional dos contadores OMNI', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    useCharacterStore.setState({ characters: [personagem()] });
  });

  it('serializa operações locais e aplica a revisão canônica sem perder o incremento anterior', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: {
        characterId: 'portador', counters: { rancor: 1 }, sourceUsage: {}, revision: 1, results: [],
      }, error: null })
      .mockResolvedValueOnce({ data: {
        characterId: 'portador', counters: { rancor: 2 }, sourceUsage: {}, revision: 2, results: [],
      }, error: null });

    aplicarOperacoesContadorOmni('portador', [{ action: 'INCREMENTAR_CONTADOR', name: 'rancor', amount: 1 }], 'atacante');
    aplicarOperacoesContadorOmni('portador', [{ action: 'INCREMENTAR_CONTADOR', name: 'rancor', amount: 1 }], 'atacante');

    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(useCharacterStore.getState().characters[0]._omniCounterRevision).toBe(2));
    expect(useCharacterStore.getState().characters[0].omniCounters?.rancor).toBe(2);
    expect(mocks.rpc.mock.calls.map(call => call[1].p_mutations)).toEqual([
      [{ action: 'INCREMENTAR_CONTADOR', name: 'rancor', amount: 1 }],
      [{ action: 'INCREMENTAR_CONTADOR', name: 'rancor', amount: 1 }],
    ]);
    expect(mocks.rpc.mock.calls.map(call => call[1].p_actor_character_id)).toEqual(['atacante', 'atacante']);
  });

  it('ignora reidratação antiga e aplica a revisão autoritativa mais nova', () => {
    useCharacterStore.setState(state => ({
      characters: state.characters.map(c => c.id === 'portador'
        ? { ...c, omniCounters: { rancor: 3 }, _omniCounterRevision: 5 }
        : c),
    }));
    aplicarSnapshotContadoresOmni([{ character_id: 'portador', counters: { rancor: 1 }, source_usage: {}, revision: 4 }]);
    expect(useCharacterStore.getState().characters[0].omniCounters?.rancor).toBe(3);
    aplicarSnapshotContadoresOmni([{ character_id: 'portador', counters: { rancor: 7 }, source_usage: {}, revision: 6 }]);
    expect(useCharacterStore.getState().characters[0]).toMatchObject({ omniCounters: { rancor: 7 }, _omniCounterRevision: 6 });
  });
});
