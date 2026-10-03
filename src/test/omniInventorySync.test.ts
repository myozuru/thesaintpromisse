// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useMultiplayerSync } from '@/hooks/useMultiplayerSync';
import { createFakeMesa } from './helpers/fakeMesa';
import { montarMesa } from './helpers/mesaReal';
import { mergeInventory, stampInventoryChanges, type InventorySnapshot } from '@/lib/omni/inventorySync';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useOmniCatalogStore } from '@/stores/useOmniCatalogStore';
import type { Character } from '@/types';

const socketMock = vi.hoisted(() => ({
  emit: vi.fn(), on: vi.fn(), off: vi.fn(), connected: false,
}));
vi.mock('@/lib/socket', () => ({ getSocket: () => socketMock }));
afterEach(() => { cleanup(); vi.useRealTimers(); });

const empty = (): InventorySnapshot => ({ items: {}, deleted: {} });
const snapshot = (): InventorySnapshot => {
  const { items, deleted } = useInventoryStore.getState();
  return { items, deleted };
};
beforeEach(() => {
  useInventoryStore.setState(empty());
  // Limpa também os registros produzidos pela retirada das instâncias anteriores.
  useInventoryStore.setState({ deleted: {} });
  montarMesa([{ id: 'player', name: 'Jogador' }] as Character[], {});
});

describe('inventário OMNI entre telas', () => {
  it('entrega uma arma passiva, preserva dono, fórmula e identidade e não duplica mensagens repetidas', () => {
    const arma = useOmniEntidadesStore.getState().criar('arma', 'Lâmina de Rancor');
    const mesa = createFakeMesa(empty, { inventory: (client, payload) => { client.state = mergeInventory(client.state, payload.data); } });
    const mestre = mesa.join({ name: 'Mestre', role: 'MASTER', profileId: null });
    const jogador = mesa.join({ name: 'Jogador', role: 'PLAYER', profileId: 'perfil' });
    const instancia = useOmniCatalogStore.getState().entregarParaJogador(arma.id, 'player')!;
    mestre.state = snapshot();
    mestre.send('inventory', { data: mestre.state });
    mestre.send('inventory', { data: mestre.state });
    expect(Object.keys(jogador.state.items)).toEqual([instancia.instanceId]);
    expect(jogador.state.items[instancia.instanceId].ownerId).toBe('player');
    expect(jogador.state.items[instancia.instanceId].entity).toEqual(instancia.entity);
  });
  it('uma cópia antiga não sobrescreve equipamento ou cargas mais recentes', () => {
    const arma = useOmniEntidadesStore.getState().criar('arma', 'Arma');
    const item = useInventoryStore.getState().add('player', { ...arma, usos: { total: 5, recarga: 'diaria' } });
    const antigo = snapshot();
    useInventoryStore.getState().equipItem(item.instanceId, 'principal');
    useInventoryStore.getState().consumirUso(item.instanceId, 2);
    const recente = snapshot();
    const merged = mergeInventory(recente, antigo);
    expect(merged.items[item.instanceId].isEquipped).toBe(true);
    expect(merged.items[item.instanceId].usosRestantes).toBe(3);
    expect(mergeInventory(antigo, recente)).toEqual(recente);
  });
  it('remover e reconectar não ressuscita a arma e conserva outras entregas', () => {
    const arma = useOmniEntidadesStore.getState().criar('arma', 'Arma');
    const item = useInventoryStore.getState().add('player', arma);
    const antigo = snapshot();
    useInventoryStore.getState().remove(item.instanceId);
    const outro = useInventoryStore.getState().add('player', arma);
    const recente = snapshot();
    expect(mergeInventory(antigo, recente).items).toEqual({ [outro.instanceId]: recente.items[outro.instanceId] });
    expect(mergeInventory(recente, antigo)).toEqual(recente);
    expect(mergeInventory(empty(), recente)).toEqual(recente);
  });
  it('preserva entregas independentes e alterações diretas de outras mecânicas', () => {
    const arma = useOmniEntidadesStore.getState().criar('arma', 'Arma');
    const item = useInventoryStore.getState().add('player', arma);
    const original = snapshot();
    useInventoryStore.setState(s => ({ items: { ...s.items, [item.instanceId]: { ...s.items[item.instanceId], materializada: true } } }));
    expect(snapshot().items[item.instanceId]._syncAt).toBeGreaterThan(original.items[item.instanceId]._syncAt!);
    const another = { ...original.items[item.instanceId], instanceId: 'outro', ownerId: 'aliado' };
    const merged = mergeInventory(snapshot(), { items: { outro: another }, deleted: {} });
    expect(Object.keys(merged.items)).toHaveLength(2);
    expect(merged.items[item.instanceId].materializada).toBe(true);
    expect(mergeInventory(merged, { items: null })).toEqual(merged);
  });
});

it('o hook publica a entrega e aplica o inventário recebido sem reemitir', async () => {
  vi.useFakeTimers();
  socketMock.emit.mockClear(); socketMock.on.mockClear();
  const emitSpy = socketMock.emit;
  renderHook(() => useMultiplayerSync());
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  emitSpy.mockClear();
  const arma = useOmniEntidadesStore.getState().criar('arma', 'Arma entre telas');
  let instanceId = '';
  act(() => { instanceId = useOmniCatalogStore.getState().entregarParaJogador(arma.id, 'player')!.instanceId; });
  const calls = emitSpy.mock.calls.filter(([event, payload]) => event === 'state:update' && payload.slice === 'omniInventory');
  expect(calls).toHaveLength(1);
  expect(calls[0][1].data.items[instanceId].ownerId).toBe('player');
  const receiver = socketMock.on.mock.calls.find(([event]) => event === 'state:update')![1];
  const remote = { ...calls[0][1].data.items[instanceId], instanceId: 'remote', ownerId: 'aliado' };
  emitSpy.mockClear();
  act(() => receiver({ slice: 'omniInventory', data: { items: { remote }, deleted: {} } }));
  expect(useInventoryStore.getState().listByOwner('aliado')[0].instanceId).toBe('remote');
  expect(emitSpy.mock.calls.filter(([, p]) => p?.slice === 'omniInventory')).toHaveLength(0);
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
});

it('a migração de cache antigo não o torna mais recente que o remoto', () => {
  const arma = useOmniEntidadesStore.getState().criar('arma', 'Arma antiga');
  const antigo = { instanceId: 'antigo', ownerId: 'player', entity: arma, acquiredAt: 10 };
  const cache = stampInventoryChanges({ items: { antigo }, deleted: {} }, empty());
  expect(cache.items.antigo._syncAt).toBe(10);
  const remoto = { ...antigo, _syncAt: 20, isEquipped: true };
  expect(mergeInventory(cache, { items: { antigo: remoto } }).items.antigo.isEquipped).toBe(true);
  const empate = { ...remoto, isEquipped: false };
  const a = { items: { antigo: remoto }, deleted: {} }, b = { items: { antigo: empate }, deleted: {} };
  expect(mergeInventory(a, b)).toEqual(mergeInventory(b, a));
});
