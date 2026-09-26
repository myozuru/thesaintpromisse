import { beforeEach, describe, expect, it } from 'vitest';
import { __resetCharSyncStamps, mergeIncomingCharacters, stampLocalChanges, withStamps } from '@/lib/charSyncStamps';
import { useCharacterStore } from '@/stores/useCharacterStore';

type C = { id: string; hpCurrent: number; _syncAt?: number };

describe('sincronização de vida/PE das fichas', () => {
  beforeEach(() => __resetCharSyncStamps());

  it('cópia remota antiga não sobrescreve vida editada localmente', () => {
    const a: C = { id: 'a', hpCurrent: 30 };
    const edited: C = { ...a, hpCurrent: 12 };
    stampLocalChanges([a], [edited], 2000);
    const merged = mergeIncomingCharacters([edited], [{ id: 'a', hpCurrent: 30, _syncAt: 1000 }], 3000);
    expect(merged[0].hpCurrent).toBe(12);
  });

  it('edição remota mais nova vence', () => {
    const a: C = { id: 'a', hpCurrent: 30 };
    stampLocalChanges([], [a], 1000);
    const merged = mergeIncomingCharacters([a], [{ id: 'a', hpCurrent: 5, _syncAt: 5000 }], 6000);
    expect(merged[0].hpCurrent).toBe(5);
  });

  it('carimbo viaja junto ao enviar (sobrevive ao F5 via nuvem)', () => {
    const a: C = { id: 'a', hpCurrent: 7 };
    stampLocalChanges([], [a], 4242);
    expect(withStamps([a])[0]._syncAt).toBe(4242);
  });

  it('subir atributo em ficha temporária não reseta vida/PE', () => {
    const id = 'tmp-1';
    useCharacterStore.setState({
      characters: [{
        id, name: 'T', temporary: true, category: 'PLAYER', level: 1,
        attributes: { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, presenca: 10 },
        hpCurrent: 33, hpMax: 40, peCurrent: 9, peMax: 15,
      } as never],
    });
    const c = useCharacterStore.getState().characters[0];
    useCharacterStore.getState().updateCharacter(id, { attributes: { ...c.attributes, constituicao: 18 } as never });
    const after = useCharacterStore.getState().characters[0];
    expect([after.hpCurrent, after.hpMax, after.peCurrent, after.peMax]).toEqual([33, 40, 9, 15]);
  });
});
