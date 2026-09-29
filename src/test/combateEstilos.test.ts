import { describe, it, expect } from 'vitest';
import type { Character } from '@/types';
import {
  chooseCombatStyle, getActiveCombatStyles, getCombatStyleSlots, getDefensivoCA,
  getPendingCombatStyleCount,
} from '@/lib/combateEstilos';
import { computeTotalDefense } from '@/lib/defenseCalc';

const mk = (over: Partial<Character> = {}): Character => ({
  id: 'c1', name: 'Esp', level: 1, characterClass: 'Feiticeiro',
  specialization: 'Especialista em Combate', attributes: [], ca: 10,
  ...over,
} as unknown as Character);

describe('Repertório do Especialista', () => {
  it('slots: 1 no Nv1, 2 no Nv6, 3 no Nv12', () => {
    expect(getCombatStyleSlots(1)).toBe(1);
    expect(getCombatStyleSlots(5)).toBe(1);
    expect(getCombatStyleSlots(6)).toBe(2);
    expect(getCombatStyleSlots(12)).toBe(3);
    expect(getCombatStyleSlots(20)).toBe(3);
  });

  it('pendências retroativas e sem repetir', () => {
    let c = mk({ level: 12, combatStyles: ['defensivo'] });
    expect(getPendingCombatStyleCount(c)).toBe(2);
    expect(chooseCombatStyle(c, 'defensivo').ok).toBe(false);
    const r = chooseCombatStyle(c, 'duelista');
    expect(r.ok).toBe(true);
    if (r.ok) c = { ...c, ...r.patch };
    expect(getPendingCombatStyleCount(c)).toBe(1);
  });

  it('bloqueia escolha sem slot e outras specs', () => {
    expect(chooseCombatStyle(mk({ combatStyles: ['defensivo'] }), 'duelista').ok).toBe(false);
    expect(chooseCombatStyle(mk({ specialization: 'Suporte' } as any), 'duelista').ok).toBe(false);
  });

  it('Defensivo: +2, +1 em 4/8/12/16', () => {
    const at = (level: number) => getDefensivoCA(mk({ level, combatStyles: ['defensivo'] }));
    expect([1, 3, 4, 8, 12, 16, 20].map(at)).toEqual([2, 2, 3, 4, 5, 6, 6]);
    expect(getDefensivoCA(mk({ combatStyles: ['duelista'] }))).toBe(0);
  });

  it('Defensivo entra na CA usada no combate', () => {
    const base = computeTotalDefense(mk({ level: 4 }));
    expect(computeTotalDefense(mk({ level: 4, combatStyles: ['defensivo'] }))).toBe(base + 3);
  });

  it('não afeta outra especialização mesmo com dado salvo', () => {
    const c = mk({ specialization: 'Suporte', combatStyles: ['defensivo'] } as any);
    expect(getDefensivoCA(c)).toBe(0);
  });

  it('Adepto de Combate concede estilo para qualquer um', () => {
    const c = mk({ specialization: 'Lutador', level: 8, chosenTalents: [{ id: 'tal-adepto-combate', level: 4, choices: { combatStyle: 'Estilo Defensivo' } }] } as any);
    expect(getActiveCombatStyles(c)).toEqual(['defensivo']);
    expect(getDefensivoCA(c)).toBe(4);
  });
});
