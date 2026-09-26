import { describe, expect, it } from 'vitest';
import { getTokenImageRect, normalizeTokenCrop } from '@/components/mapa/EntityEngine';

describe('enquadramento circular de personagem', () => {
  it('preenche um círculo sem distorcer uma imagem retrato', () => {
    const rect = getTokenImageRect(600, 1200, 100, 100, { zoom: 1, offsetX: 0, offsetY: 0 });
    expect(rect).toEqual({ x: -50, y: -100, w: 100, h: 200 });
    expect(rect.w / rect.h).toBe(0.5);
  });

  it('preenche um círculo sem distorcer uma imagem paisagem', () => {
    const rect = getTokenImageRect(1200, 600, 100, 100, { zoom: 1, offsetX: 0, offsetY: 0 });
    expect(rect).toEqual({ x: -100, y: -50, w: 200, h: 100 });
    expect(rect.w / rect.h).toBe(2);
  });

  it('aplica zoom e deslocamento dentro da sobra disponível', () => {
    const rect = getTokenImageRect(600, 1200, 100, 100, { zoom: 2, offsetX: 100, offsetY: -100 });
    expect(rect).toEqual({ x: 0, y: -400, w: 200, h: 400 });
  });

  it('limita valores inválidos para manter o personagem visível', () => {
    expect(normalizeTokenCrop({ zoom: 20, offsetX: -500, offsetY: 500 })).toEqual({ zoom: 4, offsetX: -100, offsetY: 100 });
    expect(normalizeTokenCrop()).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 });
  });
});