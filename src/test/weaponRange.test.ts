import { describe, it, expect } from 'vitest';
import {
  weaponMaxRangeMeters,
  weaponShortRangeMeters,
  checkWeaponRange,
  distanceBetweenChars,
  EXTENDED_REACH_M,
} from '@/lib/weaponRange';
import { getWeaponById } from '@/lib/weapons';
import { TOUCH_RANGE_M } from '@/lib/touchRange';

// Grade padrão: 70 px por casa, 1,5 m por casa.
const GRID = { dpi: 70, metersPerCell: 1.5 };
const CELL = 70;

interface Ent {
  x: number; y: number; w: number; h: number; characterId?: string;
  ownerProfileId?: string; avatarProfileId?: string;
}

/** Peça de 1 casa na coluna `cells` (0 = origem), mesma linha. */
function entAt(cells: number, characterId: string): Ent {
  return { x: cells * CELL + CELL / 2, y: CELL / 2, w: CELL, h: CELL, characterId };
}

function entities(...ents: Ent[]): Record<string, Ent> {
  return Object.fromEntries(ents.map((e, i) => [`e${i}`, e]));
}

describe('weaponMaxRangeMeters', () => {
  it('arma corpo-a-corpo comum alcança o toque (1,5 m)', () => {
    expect(weaponMaxRangeMeters(getWeaponById('espada-longa')!)).toBe(TOUCH_RANGE_M);
  });

  it('arma Estendida alcança 3 m', () => {
    expect(weaponMaxRangeMeters(getWeaponById('alabarda')!)).toBe(EXTENDED_REACH_M);
  });

  it('bônus de alcance CaC da ficha soma ao alcance', () => {
    expect(weaponMaxRangeMeters(getWeaponById('espada-longa')!, 1.5)).toBe(3);
  });

  it('arma à distância usa o alcance longo como máximo', () => {
    expect(weaponMaxRangeMeters(getWeaponById('arco-curto')!)).toBe(48);
    expect(weaponShortRangeMeters(getWeaponById('arco-curto')!)).toBe(24);
  });

  it('arma arremessável usa o alcance longo como máximo', () => {
    expect(weaponMaxRangeMeters(getWeaponById('azagaia')!)).toBe(24);
  });
});

describe('checkWeaponRange — corpo-a-corpo', () => {
  const espada = getWeaponById('espada-longa')!;
  const alabarda = getWeaponById('alabarda')!;

  it('alvo adjacente (1,5 m) está no alcance de toque', () => {
    const ents = entities(entAt(0, 'atk'), entAt(1, 'def'));
    expect(checkWeaponRange('atk', 'def', espada, ents, GRID)).toBeNull();
  });

  it('alvo a 3 m está FORA do alcance de uma espada comum', () => {
    const ents = entities(entAt(0, 'atk'), entAt(2, 'def'));
    const reason = checkWeaponRange('atk', 'def', espada, ents, GRID);
    expect(reason).toMatch(/fora de alcance/i);
    expect(reason).toMatch(/3[,.]0 m/);
  });

  it('alvo a 3 m está DENTRO do alcance de arma Estendida', () => {
    const ents = entities(entAt(0, 'atk'), entAt(2, 'def'));
    expect(checkWeaponRange('atk', 'def', alabarda, ents, GRID)).toBeNull();
  });

  it('alvo a 4,5 m está fora até para arma Estendida', () => {
    const ents = entities(entAt(0, 'atk'), entAt(3, 'def'));
    expect(checkWeaponRange('atk', 'def', alabarda, ents, GRID)).toMatch(/fora de alcance/i);
  });

  it('bônus de alcance CaC permite atingir mais longe', () => {
    const ents = entities(entAt(0, 'atk'), entAt(2, 'def'));
    expect(checkWeaponRange('atk', 'def', espada, ents, GRID, 1.5)).toBeNull();
  });
});

describe('checkWeaponRange — distância e casos especiais', () => {
  const arco = getWeaponById('arco-curto')!; // 24/48 m

  it('alvo dentro do alcance longo é permitido', () => {
    // 30 casas = 45 m
    const ents = entities(entAt(0, 'atk'), entAt(30, 'def'));
    expect(checkWeaponRange('atk', 'def', arco, ents, GRID)).toBeNull();
  });

  it('alvo além do alcance longo é bloqueado', () => {
    // 40 casas = 60 m > 48 m
    const ents = entities(entAt(0, 'atk'), entAt(40, 'def'));
    expect(checkWeaponRange('atk', 'def', arco, ents, GRID)).toMatch(/fora de alcance/i);
  });

  it('sem peças no mapa, não bloqueia (não há como medir)', () => {
    expect(checkWeaponRange('atk', 'def', arco, {}, GRID)).toBeNull();
  });

  it('atacar a si mesmo nunca é bloqueado por alcance', () => {
    const ents = entities(entAt(0, 'atk'));
    expect(checkWeaponRange('atk', 'atk', arco, ents, GRID)).toBeNull();
  });

  it('distanceBetweenChars mede borda a borda na grade', () => {
    const ents = entities(entAt(0, 'a'), entAt(2, 'b'));
    expect(distanceBetweenChars('a', 'b', ents, GRID)).toBeCloseTo(3, 5);
  });

  it('mede pelos perfis quando os ícones ainda não têm ficha vinculada', () => {
    const ents = entities(
      { ...entAt(0, ''), characterId: undefined, avatarProfileId: 'perfil-a' },
      { ...entAt(1, ''), characterId: undefined, ownerProfileId: 'perfil-b' },
    );
    const identities = { casterProfileId: 'perfil-a', targetProfileId: 'perfil-b' };
    expect(distanceBetweenChars('atk', 'def', ents, GRID, identities)).toBeCloseTo(1.5, 5);
    expect(checkWeaponRange('atk', 'def', arco, ents, GRID, 0, identities)).toBeNull();
  });
});
