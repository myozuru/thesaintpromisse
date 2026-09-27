import { afterEach, describe, expect, it } from 'vitest';
import { useDice3DStore } from '@/stores/useDice3DStore';

afterEach(() => {
  useDice3DStore.getState().clear();
  useDice3DStore.setState({ enabled: false });
});

describe('fila oficial dos dados 3D', () => {
  it('entrega cada resultado ao pedido correto e avança apenas uma vez', async () => {
    useDice3DStore.setState({ enabled: true, current: null, queue: [] });
    const first = useDice3DStore.getState().requestRoll(['D20'], 'ataque');
    const second = useDice3DStore.getState().requestRoll(['D6', 'D6'], 'dano');

    expect(useDice3DStore.getState().current?.label).toBe('ataque');
    expect(useDice3DStore.getState().queue).toHaveLength(1);

    useDice3DStore.getState().resolveCurrent([17]);
    await expect(first).resolves.toEqual([17]);
    expect(useDice3DStore.getState().current?.label).toBe('dano');

    useDice3DStore.getState().resolveCurrent([4, 6]);
    await expect(second).resolves.toEqual([4, 6]);
    expect(useDice3DStore.getState().current).toBeNull();
  });

  it('preserva o posicionamento central solicitado por um pedido de teste', () => {
    useDice3DStore.setState({ enabled: true, current: null, queue: [] });
    void useDice3DStore.getState().requestRoll(['D20'], 'Vontade — Player', 0, 'test-request');

    expect(useDice3DStore.getState().current?.layout).toBe('test-request');
  });

  it('cancelar libera o pedido atual e toda a fila sem inventar resultados', async () => {
    useDice3DStore.setState({ enabled: true, current: null, queue: [] });
    const first = useDice3DStore.getState().requestRoll(['D20'], 'ataque');
    const second = useDice3DStore.getState().requestRoll(['D6'], 'dano');

    useDice3DStore.getState().clear();

    await expect(first).resolves.toEqual([]);
    await expect(second).resolves.toEqual([]);
    expect(useDice3DStore.getState().current).toBeNull();
    expect(useDice3DStore.getState().queue).toEqual([]);
  });
});