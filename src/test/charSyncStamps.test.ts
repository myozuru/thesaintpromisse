import { beforeEach, describe, expect, it } from 'vitest';
import { __resetCharSyncStamps, mergeIncomingCharacters, stampLocalChanges, withStamps } from '@/lib/charSyncStamps';
import { calcularContador, CHAVE_TETO_GLOBAL_CONTADOR, CICLO_TETO_GLOBAL_CONTADOR } from '@/lib/omni/contadores';
import { useCharacterStore } from '@/stores/useCharacterStore';

type C = { id: string; hpCurrent: number; _syncAt?: number; _syncFields?: Record<string, number> };

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
    expect(withStamps([a])[0]._syncFields?.[JSON.stringify(['hpCurrent'])]).toBe(4242);
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

import { pickNewestPerCharacter } from '@/lib/charSyncStamps';
describe('salvar fichas na nuvem', () => {
  it('cópia antiga de uma tela não apaga a edição mais nova já salva', () => {
    const out = pickNewestPerCharacter(
      [{ id: 'a', hpCurrent: 30, _syncAt: 100 }, { id: 'b', hpCurrent: 9, _syncAt: 900 }],
      [{ id: 'a', hpCurrent: 12, _syncAt: 500 }, { id: 'b', hpCurrent: 1, _syncAt: 200 }],
    );
    expect(out.map((c) => c.hpCurrent)).toEqual([12, 9]);
  });

  it('salvar na nuvem combina campos editados em telas diferentes', () => {
    type Ficha = { id: string; hpCurrent: number; peCurrent: number; _syncAt?: number; _syncFields?: Record<string, number> };
    const mine: Ficha = {
      id: 'a', hpCurrent: 12, peCurrent: 10, _syncAt: 200,
      _syncFields: { [JSON.stringify(['hpCurrent'])]: 200, [JSON.stringify(['peCurrent'])]: 100 },
    };
    const cloud: Ficha = {
      id: 'a', hpCurrent: 30, peCurrent: 4, _syncAt: 250,
      _syncFields: { [JSON.stringify(['hpCurrent'])]: 100, [JSON.stringify(['peCurrent'])]: 250 },
    };
    expect(pickNewestPerCharacter([mine], [cloud])[0]).toMatchObject({ hpCurrent: 12, peCurrent: 4 });
  });
});

const campo = (...path: string[]) => JSON.stringify(path);

describe('mescla de alterações concorrentes por campo', () => {
  beforeEach(() => __resetCharSyncStamps());

  it('preserva alterações recentes em campos diferentes da mesma ficha', () => {
    type Ficha = { id: string; hpCurrent: number; peCurrent: number; _syncAt?: number; _syncFields?: Record<string, number> };
    const base: Ficha = { id: 'a', hpCurrent: 30, peCurrent: 10 };
    stampLocalChanges([], [base], 1000);
    const baseWire = withStamps([base])[0];

    const local: Ficha = { ...baseWire, hpCurrent: 12 };
    stampLocalChanges([baseWire], [local], 2000);
    const localWire = withStamps([local])[0];
    const remote: Ficha = {
      ...baseWire,
      peCurrent: 4,
      _syncAt: 1500,
      _syncFields: { ...baseWire._syncFields, [campo('peCurrent')]: 1500 },
    };

    const merged = mergeIncomingCharacters([localWire], [remote])[0];
    expect([merged.hpCurrent, merged.peCurrent]).toEqual([12, 4]);
  });

  it('mescla contadores Omni diferentes sem substituir o mapa inteiro', () => {
    type Ficha = { id: string; omniCounters: Record<string, number>; _syncAt?: number; _syncFields?: Record<string, number> };
    const local: Ficha = {
      id: 'a', omniCounters: { rancor: 2, foco: 1 }, _syncAt: 200,
      _syncFields: { [campo('omniCounters', 'rancor')]: 200, [campo('omniCounters', 'foco')]: 100 },
    };
    const remote: Ficha = {
      id: 'a', omniCounters: { rancor: 1, foco: 4 }, _syncAt: 250,
      _syncFields: { [campo('omniCounters', 'rancor')]: 150, [campo('omniCounters', 'foco')]: 250 },
    };

    const merged = mergeIncomingCharacters([local], [remote])[0];
    expect(merged.omniCounters).toEqual({ rancor: 2, foco: 4 });
  });

  it('soma contribuições de fontes distintas ao mesclar o mesmo contador', () => {
    type Ficha = { id: string; omniCounters: Record<string, number>; _syncAt?: number; _syncFields?: Record<string, number> };
    const base = { id: 'a', omniCounters: { rancor: 1, rancor__fonte__geral: 1 } };
    const local: Ficha = {
      ...base,
      omniCounters: { ...base.omniCounters, rancor: 2, rancor__fonte__aliado_a: 1 },
      _syncAt: 200,
      _syncFields: {
        [campo('omniCounters', 'rancor')]: 200,
        [campo('omniCounters', 'rancor__fonte__geral')]: 100,
        [campo('omniCounters', 'rancor__fonte__aliado_a')]: 200,
      },
    };
    const remote: Ficha = {
      ...base,
      omniCounters: { ...base.omniCounters, rancor: 2, rancor__fonte__aliado_b: 1 },
      _syncAt: 250,
      _syncFields: {
        [campo('omniCounters', 'rancor')]: 250,
        [campo('omniCounters', 'rancor__fonte__geral')]: 100,
        [campo('omniCounters', 'rancor__fonte__aliado_b')]: 250,
      },
    };

    const merged = mergeIncomingCharacters([local], [remote])[0];
    expect(merged.omniCounters).toEqual({
      rancor: 3,
      rancor__fonte__geral: 1,
      rancor__fonte__aliado_a: 1,
      rancor__fonte__aliado_b: 1,
    });
  });

  it('respeita o teto global ao mesclar fontes que incrementaram em paralelo', () => {
    type Ficha = {
      id: string;
      omniCounters: Record<string, number>;
      omniCounterSourceUsage: Record<string, Record<string, { ciclo: string; usados: number }>>;
      _syncAt?: number;
      _syncFields?: Record<string, number>;
    };
    const metadataKey = '__omni_meta_teto_global__';
    const uso = { ciclo: '__omni_teto_global__', usados: 3 };
    const local: Ficha = {
      id: 'a',
      omniCounters: { rancor: 3, rancor__fonte__geral: 2, rancor__fonte__aliado_a: 1 },
      omniCounterSourceUsage: { rancor: { [metadataKey]: uso } },
      _syncAt: 200,
      _syncFields: {
        [campo('omniCounters', 'rancor')]: 200,
        [campo('omniCounters', 'rancor__fonte__geral')]: 100,
        [campo('omniCounters', 'rancor__fonte__aliado_a')]: 200,
        [campo('omniCounterSourceUsage', 'rancor', metadataKey, 'ciclo')]: 200,
        [campo('omniCounterSourceUsage', 'rancor', metadataKey, 'usados')]: 200,
      },
    };
    const remote: Ficha = {
      id: 'a',
      omniCounters: { rancor: 3, rancor__fonte__geral: 2, rancor__fonte__aliado_b: 1 },
      omniCounterSourceUsage: { rancor: { [metadataKey]: uso } },
      _syncAt: 250,
      _syncFields: {
        [campo('omniCounters', 'rancor')]: 250,
        [campo('omniCounters', 'rancor__fonte__geral')]: 100,
        [campo('omniCounters', 'rancor__fonte__aliado_b')]: 250,
        [campo('omniCounterSourceUsage', 'rancor', metadataKey, 'ciclo')]: 250,
        [campo('omniCounterSourceUsage', 'rancor', metadataKey, 'usados')]: 250,
      },
    };

    const merged = mergeIncomingCharacters([local], [remote])[0];
    expect(merged.omniCounters).toEqual({
      rancor: 3,
      rancor__fonte__geral: 2,
      rancor__fonte__aliado_a: 1,
      rancor__fonte__aliado_b: 0,
    });
    __resetCharSyncStamps();
    const reversed = mergeIncomingCharacters([remote], [local])[0];
    expect(reversed.omniCounters).toEqual(merged.omniCounters);
  });

  it('grava o teto global junto da quota por fonte para a reconciliação', () => {
    const result = calcularContador({}, 'rancor', 'INCREMENTAR_CONTADOR', {
      valor: 1,
      teto: 3,
      rastrearFonte: true,
      fonteId: 'aliado_a',
    });
    expect(result.usoPorFonte.rancor[CHAVE_TETO_GLOBAL_CONTADOR]).toEqual({
      ciclo: CICLO_TETO_GLOBAL_CONTADOR,
      usados: 3,
    });
  });

  it('preserva exclusão explícita de um campo contra uma cópia antiga', () => {
    type Ficha = { id: string; notes?: string; _syncAt?: number; _syncFields?: Record<string, number> };
    const local: Ficha = { id: 'a', _syncAt: 200, _syncFields: { [campo('notes')]: 200 } };
    const remote: Ficha = { id: 'a', notes: 'texto antigo', _syncAt: 150, _syncFields: { [campo('notes')]: 150 } };

    const merged = mergeIncomingCharacters([local], [remote])[0];
    expect(merged).not.toHaveProperty('notes');
  });

  it('resolve conflito no mesmo campo de forma determinística, independente da ordem', () => {
    type Ficha = { id: string; notes: string; _syncAt?: number; _syncFields?: Record<string, number> };
    const a: Ficha = { id: 'a', notes: 'alfa', _syncAt: 50, _syncFields: { [campo('notes')]: 50 } };
    const b: Ficha = { id: 'a', notes: 'beta', _syncAt: 50, _syncFields: { [campo('notes')]: 50 } };
    const ab = mergeIncomingCharacters([a], [b])[0];
    __resetCharSyncStamps();
    const ba = mergeIncomingCharacters([b], [a])[0];
    expect(ab.notes).toBe(ba.notes);
  });
});
