import { describe, it, expect, vi, afterEach } from 'vitest';
import { rollAttack, buildAttackContext } from '../lib/combatEngine';
import { duelistaApplies, getDuelistaBonus } from '../lib/combateEstilos';
import type { Character } from '../types';
import type { Weapon } from '../lib/weapons';

const mk = (over: Partial<Character> = {}): Character => ({
  id: 'd', name: 'Duelista', category: 'JOGADOR', createdBy: 'PLAYER',
  characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  combatStyles: ['duelista'], level: 1,
  attributes: [{ name: 'FOR', value: 16 }, { name: 'DES', value: 12 }],
  skills: [], chosenTalents: [], chosenAuraAptitudes: [],
  mainHandWeaponName: 'Espada Curta', offHandWeaponName: null, equippedShieldId: null,
  ...over,
} as Character);
const sword = { name: 'Espada Curta', group: 'Espada', range: 'melee', damageType: 'Ct', damage: '1d6', critRange: 20, properties: [] } as unknown as Weapon;
const great = { ...sword, name: 'Montante', properties: [{ kind: 'duas_maos' }] } as unknown as Weapon;
const bow = { ...sword, name: 'Arco', range: 'ranged' } as unknown as Weapon;

afterEach(() => vi.restoreAllMocks());

describe('Estilo do Duelista', () => {
  it('escala: acerto +1/+2/+3 (8,16) e dano +2..+6 (4,8,12,16)', () => {
    expect(getDuelistaBonus(1)).toEqual({ hit: 1, damage: 2 });
    expect(getDuelistaBonus(4)).toEqual({ hit: 1, damage: 3 });
    expect(getDuelistaBonus(8)).toEqual({ hit: 2, damage: 4 });
    expect(getDuelistaBonus(16)).toEqual({ hit: 3, damage: 6 });
  });
  it('vale só com uma arma corpo a corpo e a outra mão livre', () => {
    expect(duelistaApplies(mk(), sword).ok).toBe(true);
    expect(duelistaApplies(mk({ equippedShieldId: 'escudo' }), sword).ok).toBe(false);
    expect(duelistaApplies(mk({ offHandWeaponName: 'Adaga' }), sword).ok).toBe(false);
    expect(duelistaApplies(mk(), great).ok).toBe(false);
    expect(duelistaApplies(mk(), sword, true).ok).toBe(false);
    expect(duelistaApplies(mk(), bow).ok).toBe(false);
    expect(duelistaApplies(mk({ combatStyles: ['defensivo'] }), sword).ok).toBe(false);
    expect(duelistaApplies(mk({ specialization: 'Suporte' as never }), sword).ok).toBe(false);
  });
  it('soma no ataque real: +1 acerto e +2 dano', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // d20=11, 1d6=4
    const run = async (c: Character) => rollAttack(buildAttackContext({
      attacker: c, weapon: sword, targetDefense: 10, situation: { preferredAbility: 'FOR' }, trainedRanges: ['melee'],
    }));
    const base = await run(mk({ combatStyles: [] }));
    const duel = await run(mk());
    expect(duel.attackTotal - base.attackTotal).toBe(1);
    expect(duel.damageTotal - base.damageTotal).toBe(2);
    expect(duel.notes.some(n => n.includes('Duelista'))).toBe(true);
    const shield = await run(mk({ equippedShieldId: 'escudo' }));
    expect(shield.attackTotal).toBe(base.attackTotal);
    expect(shield.notes.some(n => n.includes('escudo'))).toBe(true);
  });
});
