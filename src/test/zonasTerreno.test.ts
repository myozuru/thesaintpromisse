import { describe, expect, it } from 'vitest';
import { avancarDuracaoZona, pontoDentroDaZona, segmentoEntraNaZona } from '@/lib/mapa/zonaTerreno';
import type { ZonaTerreno } from '@/stores/useMapStore';

const zona = (patch: Partial<{ shape: 'RECT' | 'ELLIPSE'; x: number; y: number; w: number; h: number; rotation: number }> = {}) => ({
  shape: 'RECT' as const, x: 0, y: 0, w: 20, h: 20, rotation: 0, ...patch,
});

describe('zonas persistentes no mapa', () => {
  it('testa pontos dentro de retângulos rotacionados e elipses', () => {
    expect(pontoDentroDaZona(zona(), { x: 0, y: 0 })).toBe(true);
    expect(pontoDentroDaZona(zona({ rotation: Math.PI / 4 }), { x: 8, y: 0 })).toBe(true);
    expect(pontoDentroDaZona(zona({ shape: 'ELLIPSE' }), { x: 0, y: 9 })).toBe(true);
    expect(pontoDentroDaZona(zona({ shape: 'ELLIPSE' }), { x: 9, y: 9 })).toBe(false);
  });

  it('detecta entrada quando o token cruza a zona entre posições', () => {
    expect(segmentoEntraNaZona(zona(), { x: -30, y: 0 }, { x: 30, y: 0 })).toBe(true);
    expect(segmentoEntraNaZona(zona(), { x: -30, y: 30 }, { x: 30, y: 30 })).toBe(false);
    expect(segmentoEntraNaZona(zona(), { x: 0, y: 0 }, { x: 30, y: 0 })).toBe(false);
  });

  it('mantém zonas permanentes e expira zonas ao fim da duração', () => {
    const permanente: ZonaTerreno = { duracaoRodadas: null, rodadasRestantes: null, gatilhos: [], efeitos: [] };
    const umaRodada: ZonaTerreno = { duracaoRodadas: 1, rodadasRestantes: 1, gatilhos: [], efeitos: [] };
    const duasRodadas: ZonaTerreno = { duracaoRodadas: 2, rodadasRestantes: 2, gatilhos: [], efeitos: [] };
    expect(avancarDuracaoZona(permanente)).toBe(permanente);
    expect(avancarDuracaoZona(umaRodada)).toBeNull();
    expect(avancarDuracaoZona(duasRodadas)?.rodadasRestantes).toBe(1);
  });
});
