/**
 * Fase 4b — Combate Amaldiçoado / Esgrimista Jujutsu (armas escolhidas).
 */
import { describe, it, expect } from 'vitest';
import { getWeaponSpecEffects, getChosenCombatWeapons } from '@/lib/combatWeaponEffects';
import type { Character } from '@/types';

function baseChar(partial: Partial<Character> = {}): Character {
  return {
    id: 'c', name: 'T', level: 12,
    chosenSpecAbilities: [],
    specAbilityChoices: {},
    ...partial,
  } as unknown as Character;
}

const withIds = (ids: string[], extra: Partial<Character> = {}) =>
  baseChar({
    ...extra,
    chosenSpecAbilities: ids.map((id) => ({ abilityId: id, chosenAtLevel: 1 })),
  });

describe('getWeaponSpecEffects', () => {
  it('sem habilidades nem escolhas: tudo zerado', () => {
    const r = getWeaponSpecEffects(baseChar(), 'katana');
    expect(r.isChosenWeapon).toBe(false);
    expect(r.flatDamageBonus).toBe(0);
    expect(r.dieStepBoost).toBe(0);
    expect(r.esgrimistaJujutsu).toBe(false);
  });

  it('arma fora da lista escolhida não recebe bônus', () => {
    const c = withIds(['tec-combate-amaldicoado'], {
      specAbilityChoices: {
        'tec-tecnicas-de-combate': { kind: 'weapons', weapons: ['katana', 'adaga'] },
      } as Character['specAbilityChoices'],
    });
    const r = getWeaponSpecEffects(c, 'machado');
    expect(r.isChosenWeapon).toBe(false);
    expect(r.flatDamageBonus).toBe(0);
  });

  it('Combate Amaldiçoado passivo: +TB na arma escolhida (Nv12 → +4)', () => {
    const c = withIds(['tec-combate-amaldicoado'], {
      specAbilityChoices: {
        'tec-tecnicas-de-combate': { kind: 'weapons', weapons: ['katana'] },
      } as Character['specAbilityChoices'],
    });
    const r = getWeaponSpecEffects(c, 'katana');
    expect(r.isChosenWeapon).toBe(true);
    expect(r.flatDamageBonus).toBe(4);
    expect(r.dieStepBoost).toBe(0);
  });

  it('Combate Amaldiçoado ativo (flag de cena): +1 passo no dado', () => {
    const c = withIds(['tec-combate-amaldicoado'], {
      tecCombateAmaldicoadoActive: true,
      specAbilityChoices: {
        'tec-tecnicas-de-combate': { kind: 'weapons', weapons: ['katana'] },
      } as Character['specAbilityChoices'],
    });
    const r = getWeaponSpecEffects(c, 'katana');
    expect(r.dieStepBoost).toBe(1);
    expect(r.flatDamageBonus).toBe(4);
  });


  it('Esgrimista Jujutsu reflete na flag', () => {
    const c = withIds(['tec-esgrimista-jujutsu', 'tec-combate-amaldicoado'], {
      specAbilityChoices: {
        'tec-tecnicas-de-combate': { kind: 'weapons', weapons: ['katana'] },
      } as Character['specAbilityChoices'],
    });
    const r = getWeaponSpecEffects(c, 'katana');
    expect(r.esgrimistaJujutsu).toBe(true);
  });

  it('getChosenCombatWeapons devolve [] sem escolha', () => {
    expect(getChosenCombatWeapons(baseChar())).toEqual([]);
  });
});
