/**
 * Testes para o engine BAR (Barreira) — fórmulas oficiais pp. 175-177.
 */
import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import {
  calcularCriarParedes,
  calcularCestaOca,
  calcularCortina,
} from '@/lib/barActivation';

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'test',
    name: 'Tester',
    level: 5,
    peCurrent: 100,
    peMax: 100,
    hpCurrent: 100,
    hpMax: 100,
    attributes: [
      { id: '1', name: 'Força', value: 12 },
      { id: '2', name: 'Destreza', value: 12 },
      { id: '3', name: 'Constituição', value: 12 },
      { id: '4', name: 'Inteligência', value: 14 },
      { id: '5', name: 'Sabedoria', value: 12 },
      { id: '6', name: 'Presença', value: 12 },
    ],
    cursedAptitudes: { AU: 0, CL: 0, BAR: 2, DOM: 0, ER: 0 },
    ...overrides,
  } as unknown as Character;
}

describe('Técnicas de Barreira — criar paredes', () => {
  it('1 PE por parede; HP base = 10 + 10×BAR', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 0, BAR: 2, DOM: 0, ER: 0 } });
    const r = calcularCriarParedes(c, { paredes: 3, hasParedesResistentes: false });
    expect(r.ok).toBe(true);
    expect(r.peSpent).toBe(3);
    // 10 + 10×2 = 30 por parede
    expect(r.details?.hpPorParede).toBe(30);
    expect(r.details?.hpTotal).toBe(90);
  });

  it('com Paredes Resistentes: HP = 20×BAR (10×BAR base + 10×BAR bônus)', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 0, BAR: 3, DOM: 0, ER: 0 } });
    const r = calcularCriarParedes(c, { paredes: 2, hasParedesResistentes: true });
    expect(r.ok).toBe(true);
    // 10×3 + 10×3 = 60 por parede
    expect(r.details?.hpPorParede).toBe(60);
    expect(r.details?.hpTotal).toBe(120);
  });

  it('rejeita > 6 paredes', () => {
    const c = makeChar();
    const r = calcularCriarParedes(c, { paredes: 7, hasParedesResistentes: false });
    expect(r.ok).toBe(false);
  });

  it('rejeita 0 ou negativo', () => {
    const c = makeChar();
    const r = calcularCriarParedes(c, { paredes: 0, hasParedesResistentes: false });
    expect(r.ok).toBe(false);
  });

  it('falha com PE insuficiente', () => {
    const c = makeChar({ peCurrent: 1 });
    const r = calcularCriarParedes(c, { paredes: 4, hasParedesResistentes: false });
    expect(r.ok).toBe(false);
  });
});

describe('Cesta Oca de Vime', () => {
  it('custa 3 PE; durabilidade = BAR + 1; flag setada', () => {
    const c = makeChar({ cursedAptitudes: { AU: 0, CL: 0, BAR: 2, DOM: 0, ER: 0 } });
    const r = calcularCestaOca(c);
    expect(r.ok).toBe(true);
    expect(r.peSpent).toBe(3);
    expect(r.details?.dur).toBe(3); // 2 + 1
    expect(r.omniFlagPatch?.cesta_oca_durabilidade).toBe(3);
  });

  it('falha sem PE', () => {
    const c = makeChar({ peCurrent: 2 });
    const r = calcularCestaOca(c);
    expect(r.ok).toBe(false);
  });
});

describe('Cortina', () => {
  it('custa 1 PE / 4,5 m de área (arredonda para cima)', () => {
    const c = makeChar();
    const r1 = calcularCortina(c, { areaM: 4.5 });
    expect(r1.peSpent).toBe(1);
    const r2 = calcularCortina(c, { areaM: 9 });
    expect(r2.peSpent).toBe(2);
    const r3 = calcularCortina(c, { areaM: 10 });
    expect(r3.peSpent).toBe(3); // ceil(10/4.5) = 3
  });

  it('rejeita área <= 0', () => {
    const c = makeChar();
    const r = calcularCortina(c, { areaM: 0 });
    expect(r.ok).toBe(false);
  });

  it('falha com PE insuficiente', () => {
    const c = makeChar({ peCurrent: 1 });
    const r = calcularCortina(c, { areaM: 50 });
    expect(r.ok).toBe(false);
  });
});
