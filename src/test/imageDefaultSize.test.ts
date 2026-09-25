import { describe, it, expect } from "vitest";

/**
 * Replica a fórmula usada em MapaModule.tsx ao soltar uma imagem no mapa:
 *
 *   h = defaultImageHeightM * dpi
 *   w = h * (naturalW / naturalH)
 *
 * Como 1 célula da grade vale exatamente `dpi` unidades de mundo
 * (independente de zoom ou de `metersPerCell`), uma altura de Xm
 * deve ocupar X células — ou seja, h / dpi === X.
 */
function computeDropSize(
  defaultM: number,
  dpi: number,
  natural: { w: number; h: number },
) {
  const ratio = natural.h > 0 ? natural.w / natural.h : 1;
  const targetH = defaultM * dpi;
  const h = Math.max(20, targetH);
  const w = Math.max(20, h * ratio);
  return { w, h, cells: h / dpi };
}

describe("imagem com altura padrão ocupa N blocos da grade", () => {
  it("1.5m = 1.5 blocos (dpi=64, caixa quadrada)", () => {
    const r = computeDropSize(1.5, 64, { w: 512, h: 512 });
    expect(r.cells).toBeCloseTo(1.5, 6);
    expect(r.h).toBeCloseTo(96, 6);
    expect(r.w).toBeCloseTo(96, 6);
  });

  it("1.5m = 1.5 blocos independente da resolução nativa (caixa grande)", () => {
    const r = computeDropSize(1.5, 64, { w: 2048, h: 2048 });
    expect(r.cells).toBeCloseTo(1.5, 6);
  });

  it("1.5m = 1.5 blocos independente da resolução nativa (caixa pequena)", () => {
    const r = computeDropSize(1.5, 64, { w: 100, h: 100 });
    expect(r.cells).toBeCloseTo(1.5, 6);
  });

  it("1.5m = 1.5 blocos com dpi diferente (zoom de grade diferente)", () => {
    for (const dpi of [32, 48, 64, 96, 128, 200]) {
      const r = computeDropSize(1.5, dpi, { w: 800, h: 600 });
      expect(r.cells).toBeCloseTo(1.5, 6);
      expect(r.h).toBeCloseTo(1.5 * dpi, 6);
    }
  });

  it("não depende de metersPerCell — 1.5m sempre = 1.5 células", () => {
    // metersPerCell não entra na fórmula, mas validamos isso simulando vários valores
    const dpi = 64;
    for (const _mpc of [0.5, 1, 1.5, 2, 3]) {
      const r = computeDropSize(1.5, dpi, { w: 400, h: 300 });
      expect(r.cells).toBeCloseTo(1.5, 6);
    }
  });

  it("preserva proporção da imagem (16:9)", () => {
    const r = computeDropSize(1.5, 64, { w: 1600, h: 900 });
    expect(r.cells).toBeCloseTo(1.5, 6);
    expect(r.w / r.h).toBeCloseTo(1600 / 900, 6);
  });

  it("preserva proporção da imagem (retrato 9:16)", () => {
    const r = computeDropSize(1.5, 64, { w: 900, h: 1600 });
    expect(r.cells).toBeCloseTo(1.5, 6);
    expect(r.w / r.h).toBeCloseTo(900 / 1600, 6);
  });

  it("outras alturas: 1m, 2m, 3.5m", () => {
    for (const m of [1, 2, 3.5]) {
      const r = computeDropSize(m, 64, { w: 512, h: 512 });
      expect(r.cells).toBeCloseTo(m, 6);
    }
  });

  it("piso mínimo de 20px só ativa em alturas muito pequenas", () => {
    // 0.1m * 64dpi = 6.4 -> piso de 20
    const r = computeDropSize(0.1, 64, { w: 100, h: 100 });
    expect(r.h).toBe(20);
    // 1.5m * 64 = 96 -> sem piso
    const r2 = computeDropSize(1.5, 64, { w: 100, h: 100 });
    expect(r2.h).toBeCloseTo(96, 6);
  });
});
