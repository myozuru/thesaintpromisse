import { describe, it, expect } from 'vitest';
import { getSuporteHealDice, getSuporteHealMaxUses, getSuporteKeyMod, getSuporteHealUsesLeft } from '@/lib/suporteAbilities';
import type { Character } from '@/types';

const mk = (pre: number, sab: number, keyAttribute?: 'Presença' | 'Sabedoria', used = 0) =>
  ({
    attributes: [
      { name: 'Presença', value: pre },
      { name: 'Sabedoria', value: sab },
    ],
    keyAttribute,
    suporteHealUsed: used,
  }) as unknown as Character;

describe('Suporte em Combate', () => {
  it('escala dados por nível', () => {
    expect(getSuporteHealDice(1)).toEqual({ count: 2, sides: 6 });
    expect(getSuporteHealDice(3)).toEqual({ count: 2, sides: 6 });
    expect(getSuporteHealDice(4)).toEqual({ count: 2, sides: 12 });
    expect(getSuporteHealDice(8)).toEqual({ count: 3, sides: 12 });
    expect(getSuporteHealDice(12)).toEqual({ count: 6, sides: 8 });
    expect(getSuporteHealDice(16)).toEqual({ count: 6, sides: 10 });
    expect(getSuporteHealDice(20)).toEqual({ count: 6, sides: 10 });
  });
  it('usa o atributo-chave escolhido', () => {
    expect(getSuporteKeyMod(mk(16, 12))).toBe(3); // fallback Presença
    expect(getSuporteKeyMod(mk(16, 12, 'Sabedoria'))).toBe(1);
  });
  it('usos = mod, mínimo 0, descontando gastos', () => {
    expect(getSuporteHealMaxUses(mk(18, 10, 'Presença'))).toBe(4);
    expect(getSuporteHealMaxUses(mk(8, 10, 'Presença'))).toBe(0);
    expect(getSuporteHealUsesLeft(mk(18, 10, 'Presença', 3))).toBe(1);
  });
});
