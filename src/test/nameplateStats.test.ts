import { describe, expect, it } from 'vitest';
import { toNameplateStats } from '@/components/mapa/MapaModule';
import type { Character } from '@/types';

const base = { id: 'c1', name: 'Teste' } as unknown as Character;

describe('toNameplateStats (barras do token no mapa)', () => {
  it('mostra vida mesmo quando hpMax está zerado mas hpCurrent tem valor', () => {
    const s = toNameplateStats({ ...base, hpCurrent: 25, hpMax: 0, peCurrent: 10, peMax: 30 });
    expect(s.hp).toBe(25);
    expect(s.hpMax).toBe(25); // barra de vida não some
    expect(s.peMax).toBe(30);
  });

  it('mostra energia mesmo quando peMax está zerado mas peCurrent tem valor', () => {
    const s = toNameplateStats({ ...base, hpCurrent: 40, hpMax: 40, peCurrent: 12, peMax: 0 });
    expect(s.pe).toBe(12);
    expect(s.peMax).toBe(12);
  });

  it('prefere os máximos efetivos quando existem', () => {
    const s = toNameplateStats({
      ...base,
      hpCurrent: 30,
      hpMax: 40,
      hpMaxEffective: 55,
      peCurrent: 8,
      peMax: 20,
      peMaxEffective: 26,
    });
    expect(s.hpMax).toBe(55);
    expect(s.peMax).toBe(26);
  });

  it('ficha normal mantém os valores originais', () => {
    const s = toNameplateStats({ ...base, hpCurrent: 18, hpMax: 40, peCurrent: 5, peMax: 20 });
    expect(s).toEqual({ hp: 18, hpMax: 40, pe: 5, peMax: 20 });
  });
});
