/**
 * Testes para o engine ER (Energia Reversa) — pp. 190-191.
 * Cobre Fluxo Constante, Liberação de ER e Canalizar ER.
 */
import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import {
  calcularFluxoConstante,
  calcularLiberacaoEr,
  calcularCanalizarEr,
  PE_POR_PER,
} from '@/lib/erActivation';

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'test',
    name: 'Tester',
    level: 12,
    peCurrent: 100,
    peMax: 100,
    hpCurrent: 100,
    hpMax: 100,
    attributes: [
      { id: '1', name: 'Força', value: 12 },
      { id: '2', name: 'Destreza', value: 12 },
      { id: '3', name: 'Constituição', value: 12 },
      { id: '4', name: 'Inteligência', value: 14 },
      { id: '5', name: 'Sabedoria', value: 14 },
      { id: '6', name: 'Presença', value: 14 },
    ],
    cursedAptitudes: { AU: 0, CL: 3, BAR: 0, DOM: 0, ER: 3 },
    ...overrides,
  } as unknown as Character;
}

describe('Fluxo Constante', () => {
  it('modo turno-livre seta flag = 1 sem custo', () => {
    const r = calcularFluxoConstante(makeChar(), { modo: 'turno-livre' });
    expect(r.ok).toBe(true);
    expect(r.peSpent).toBe(0);
    expect(r.omniFlagPatch?.fluxo_constante_modo).toBe(1);
  });
  it('modo reacao seta flag = 2', () => {
    const r = calcularFluxoConstante(makeChar(), { modo: 'reacao' });
    expect(r.omniFlagPatch?.fluxo_constante_modo).toBe(2);
  });
});

describe('Liberação de Energia Reversa', () => {
  it('flag passiva sem custo', () => {
    const r = calcularLiberacaoEr(makeChar());
    expect(r.ok).toBe(true);
    expect(r.peSpent).toBe(0);
    expect(r.omniFlagPatch?.liberacao_er_ativa).toBe(1);
  });
});

describe('Canalizar Energia Reversa', () => {
  it('debita 2 PE por PER e salva carga', () => {
    const r = calcularCanalizarEr(makeChar(), { perGasto: 2, trainingBonus: 3 });
    expect(r.ok).toBe(true);
    expect(r.peSpent).toBe(2 * PE_POR_PER);
    expect(r.omniFlagPatch?.canalizar_er_carga).toBe(2);
    expect(r.details?.dadosBonus).toBe(4); // 2 PER × 2d6
  });
  it('rejeita PER acima do bônus de treinamento', () => {
    const r = calcularCanalizarEr(makeChar(), { perGasto: 5, trainingBonus: 3 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Bônus de Treinamento/);
  });
  it('rejeita PER zero ou negativo', () => {
    expect(calcularCanalizarEr(makeChar(), { perGasto: 0, trainingBonus: 3 }).ok).toBe(false);
    expect(calcularCanalizarEr(makeChar(), { perGasto: -1, trainingBonus: 3 }).ok).toBe(false);
  });
  it('rejeita PE insuficiente', () => {
    const c = makeChar({ peCurrent: 1 });
    const r = calcularCanalizarEr(c, { perGasto: 2, trainingBonus: 3 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/PE insuficiente/);
  });
  it('mutex com Canalizar em Golpe normal', () => {
    const r = calcularCanalizarEr(makeChar(), {
      perGasto: 1,
      trainingBonus: 3,
      canalizarEmGolpeAtivo: true,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Mutuamente exclusivo/);
  });
  it('bloqueia recarregar se já existe carga ER', () => {
    const r = calcularCanalizarEr(makeChar(), {
      perGasto: 1,
      trainingBonus: 3,
      cargaErExistente: 2,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/carga de ER preparada/);
  });
});
