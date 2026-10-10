import { beforeEach, describe, expect, it } from 'vitest';
import { useShikigamiHudStore } from '@/stores/useShikigamiHudStore';

describe('HUD do Shikigami', () => {
  beforeEach(() => {
    useShikigamiHudStore.getState().setSourceTokenId(null);
    useShikigamiHudStore.getState().clearTarget();
  });

  it('seleciona alvo sem substituir a seleção do token de origem', () => {
    const hud = useShikigamiHudStore.getState();
    hud.setSourceTokenId('shikigami-1');
    useShikigamiHudStore.getState().startTargetSelection();

    expect(useShikigamiHudStore.getState().acceptTarget('shikigami-1')).toBe(false);
    expect(useShikigamiHudStore.getState().acceptTarget('alvo-1')).toBe(true);
    expect(useShikigamiHudStore.getState()).toMatchObject({
      sourceTokenId: 'shikigami-1',
      selectedTargetId: 'alvo-1',
      interaction: null,
    });
  });

  it('mede um ponto e limpa seleção, alvo e medição ao trocar a origem', () => {
    const hud = useShikigamiHudStore.getState();
    hud.setSourceTokenId('shikigami-1');
    useShikigamiHudStore.getState().startMeasurement();
    expect(useShikigamiHudStore.getState().acceptMeasurement({ x: 210, y: 70 })).toBe(true);
    expect(useShikigamiHudStore.getState().measurementPoint).toEqual({ x: 210, y: 70 });

    useShikigamiHudStore.getState().setSourceTokenId('shikigami-2');
    expect(useShikigamiHudStore.getState()).toMatchObject({
      sourceTokenId: 'shikigami-2',
      selectedTargetId: null,
      measurementPoint: null,
      interaction: null,
    });
  });
});
