import { describe, it, expect } from 'vitest';
import { custoGolpeEspecial, implementoMarcialBonus, impactanteMeters, hasGolpeEspecial, longoBonusMeters, penetranteRD, precisoUsesThisTurn, registerPrecisoUse, resetPrecisoUses } from '@/lib/golpeEspecial';

const esp = (level: number) => ({ characterClass: 'Feiticeiro', specialization: 'Especialista em Combate', level } as never);

describe('Golpe Especial — regras', () => {
  it('custo com mínimo 1 e descontos', () => {
    expect(custoGolpeEspecial({}).total).toBe(0);
    expect(custoGolpeEspecial({ amplo: 1, letal: 1 }).total).toBe(4);
    expect(custoGolpeEspecial({ atroz: 1, lento: 1, sacrificio: 1 }).total).toBe(1);
    expect(custoGolpeEspecial({ sanguinario: 2 }).total).toBe(4);
    expect(custoGolpeEspecial({ desfocado: 5, amplo: 1, letal: 1 }).bruno).toBe(1);
  });
  it('Preciso escala por turno', () => {
    resetPrecisoUses();
    expect(custoGolpeEspecial({ preciso: 1 }, precisoUsesThisTurn('a', '1:0')).total).toBe(1);
    registerPrecisoUse('a', '1:0');
    expect(custoGolpeEspecial({ preciso: 1 }, precisoUsesThisTurn('a', '1:0')).total).toBe(2);
    expect(precisoUsesThisTurn('a', '2:0')).toBe(0);
  });
  it('nível mínimo 4 e Implemento Marcial 4/8/16', () => {
    expect(hasGolpeEspecial(esp(3))).toBe(false);
    expect(hasGolpeEspecial(esp(4))).toBe(true);
    expect(implementoMarcialBonus(esp(3))).toBe(0);
    expect(implementoMarcialBonus(esp(4))).toBe(2);
    expect(implementoMarcialBonus(esp(8))).toBe(3);
    expect(implementoMarcialBonus(esp(16))).toBe(4);
  });
  it('Impactante, Longo, Penetrante', () => {
    expect(impactanteMeters(31, false)).toBe(3);
    expect(impactanteMeters(31, true)).toBe(1.5);
    expect(impactanteMeters(14, false)).toBe(0);
    expect(longoBonusMeters({ longo: 1 }, 'melee')).toBe(1.5);
    expect(longoBonusMeters({ longo: 1 }, 'ranged')).toBe(9);
    expect(penetranteRD({ level: 9 } as never)).toBe(4);
  });
});
