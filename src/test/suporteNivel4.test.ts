import { describe, it, expect } from 'vitest';
import type { Character } from '@/types';
import { activateGuarda, computeGuardaPatches, getApoiosVersateisBonus } from '@/lib/suporteNivel4';
import { getApoiosMaxFor, canChooseApoio } from '@/lib/suporteNivel6';

const grid = { dpi: 70, metersPerCell: 1.5 };
const ch = (id: string, extra: Partial<Character> = {}) =>
  ({ id, name: id, level: 4, category: 'PLAYER', chosenSpecAbilities: [], ...extra }) as unknown as Character;
const ent = (id: string, cells: number) => ({ id, characterId: id, x: cells * 70, y: 0, w: 70, h: 70 });

describe('Apoios Versáteis', () => {
  it('+1 no Nv 4, +2 no Nv 10, soma ao Apoio Avançado', () => {
    const c = ch('s', { chosenSpecAbilities: ['sup-apoio-avancado', 'sup-apoios-versateis'] } as Partial<Character>);
    expect(getApoiosVersateisBonus(c)).toBe(1);
    expect(getApoiosMaxFor(c)).toBe(2);
    expect(getApoiosMaxFor({ ...c, level: 10 })).toBe(4);
    expect(getApoiosMaxFor({ ...c, level: 12 })).toBe(5);
  });
  it('funciona sem Apoio Avançado', () => {
    const c = ch('s', { chosenSpecAbilities: ['sup-apoios-versateis'] } as Partial<Character>);
    expect(getApoiosMaxFor(c)).toBe(1);
    expect(canChooseApoio(c)).toBe(true);
  });
});

describe('Guarda Sincronizada', () => {
  const sup = ch('s', { chosenSpecAbilities: ['sup-guarda-sincronizada'] } as Partial<Character>);
  it('inclui aliados a até 7,5 m, exclui longe, cegos, surdos e criaturas', () => {
    const chars = [sup, ch('a'), ch('b'), ch('far'), ch('cego', { activeConditions: [{ conditionId: 'cego' }] } as never),
      ch('surdo', { activeConditions: [{ conditionId: 'surdo' }] } as never), ch('m', { category: 'MONSTER' } as never)];
    const ents = { s: ent('s', 0), a: ent('a', 5), b: ent('b', 2), far: ent('far', 6), cego: ent('cego', 1), surdo: ent('surdo', 1), m: ent('m', 1) };
    const r = activateGuarda(sup, chars, ents, grid);
    expect(r.ok && r.members).toEqual(['s', 'a', 'b']);
  });
  it('sem aliados no alcance falha', () => {
    const r = activateGuarda(sup, [sup, ch('a')], { s: ent('s', 0), a: ent('a', 9) }, grid);
    expect(r.ok).toBe(false);
  });
  it('bônus = membros - 1; quem se afasta sai e não volta; sobrando só o Suporte acaba', () => {
    let chars = [{ ...sup, guardaSincronizada: { members: ['s', 'a', 'b'] } }, ch('a'), ch('b')] as Character[];
    const apply = (ents: Record<string, ReturnType<typeof ent>>) => {
      for (const p of computeGuardaPatches(chars, ents, grid)) chars = chars.map((c) => (c.id === p.id ? { ...c, ...p.patch } : c));
    };
    apply({ s: ent('s', 0), a: ent('a', 1), b: ent('b', 2) });
    expect(chars.map((c) => c.guardaSincronizadaBonus?.value)).toEqual([2, 2, 2]);
    apply({ s: ent('s', 0), a: ent('a', 1), b: ent('b', 8) });
    expect(chars.map((c) => c.guardaSincronizadaBonus?.value)).toEqual([1, 1, undefined]);
    apply({ s: ent('s', 0), a: ent('a', 1), b: ent('b', 1) }); // b voltou, mas não reentra
    expect(chars[2].guardaSincronizadaBonus).toBeUndefined();
    chars = chars.map((c) => (c.id === 'a' ? { ...c, activeConditions: [{ conditionId: 'surdo' }] } as never : c));
    apply({ s: ent('s', 0), a: ent('a', 1), b: ent('b', 1) });
    expect(chars[0].guardaSincronizada).toBeUndefined();
    expect(chars.every((c) => !c.guardaSincronizadaBonus)).toBe(true);
  });
});
