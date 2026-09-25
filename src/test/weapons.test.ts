import { describe, it, expect } from 'vitest';
import {
  ALL_WEAPONS, getWeaponById, getWeaponsByGroup, hasProperty,
  getProperty, resolveWeaponDamage,
} from '@/lib/weapons';

describe('weapons — catálogo', () => {
  it('tem armas dos três alcances', () => {
    expect(ALL_WEAPONS.some(w => w.range === 'melee')).toBe(true);
    expect(ALL_WEAPONS.some(w => w.range === 'ranged')).toBe(true);
    expect(ALL_WEAPONS.some(w => w.range === 'thrown')).toBe(true);
  });
  it('IDs são únicos', () => {
    const ids = ALL_WEAPONS.map(w => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('armas simples melee têm 14 entradas', () => {
    expect(ALL_WEAPONS.filter(w => w.range === 'melee' && w.category === 'simples').length).toBe(14);
  });
  it('armas complexas melee têm 21 entradas', () => {
    expect(ALL_WEAPONS.filter(w => w.range === 'melee' && w.category === 'complexa').length).toBe(21);
  });
});

describe('weapons — propriedades', () => {
  it('Adaga: arremessável 6/18 + fineza + apunhaladora', () => {
    const adaga = getWeaponById('adaga')!;
    expect(hasProperty(adaga, 'fineza')).toBe(true);
    expect(hasProperty(adaga, 'apunhaladora')).toBe(true);
    const arr = getProperty(adaga, 'arremessavel');
    expect(arr?.rangeShort).toBe(6);
    expect(arr?.rangeLong).toBe(18);
  });
  it('Pistola: recarga 12 + emperrar', () => {
    const p = getWeaponById('pistola')!;
    expect(getProperty(p, 'recarga')?.value).toBe(12);
    expect(hasProperty(p, 'emperrar')).toBe(true);
  });
  it('Espada Colossal: ampla + pesada 20', () => {
    const sc = getWeaponById('espada-colossal')!;
    expect(hasProperty(sc, 'ampla')).toBe(true);
    expect(getProperty(sc, 'pesada')?.value).toBe(20);
  });
  it('Katana: fatal d10 + fineza', () => {
    const k = getWeaponById('katana')!;
    expect(getProperty(k, 'fatal')?.die).toBe(10);
    expect(hasProperty(k, 'fineza')).toBe(true);
  });
});

describe('weapons — grupos', () => {
  it('Chicotes existem em 4 variantes', () => {
    expect(getWeaponsByGroup('Chicote').length).toBeGreaterThanOrEqual(4);
  });
  it('Espadas: katana, longa, grande, colossal, gancho, rapieira', () => {
    const ids = getWeaponsByGroup('Espada').map(w => w.id);
    ['katana', 'espada-longa', 'espada-grande', 'espada-colossal', 'espada-gancho', 'rapieira']
      .forEach(id => expect(ids).toContain(id));
  });
});

describe('weapons — versátil', () => {
  it('Espada Longa: 1H 1d8 / 2H 1d10', () => {
    const w = getWeaponById('espada-longa')!;
    expect(resolveWeaponDamage(w, false)).toBe('1d8');
    expect(resolveWeaponDamage(w, true)).toBe('1d10');
  });
});
