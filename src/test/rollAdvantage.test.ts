/**
 * 🎲 Testes do sistema de Vantagem/Desvantagem Omni.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  grantAdvantage, consumeAdvantageFor, peekAdvantageFor,
  expireEndOfTurnFor, clearAllAdvantage, applyAdvantageToD20,
} from '@/lib/omni/rollAdvantage';
import { useCharacterStore } from '@/stores/useCharacterStore';
import type { Character } from '@/types';

const baseChar: Character = {
  id: 'adv-test-1',
  name: 'Cobaia Vantagem',
  level: 1,
  attributes: [],
  skills: [],
  hpCurrent: 10, hpMax: 10,
  category: 'PLAYER',
} as unknown as Character;

beforeEach(() => {
  useCharacterStore.setState({ characters: [{ ...baseChar }] });
});

describe('Vantagem/Desvantagem — escopos básicos', () => {
  it('next_attack confere vantagem em ataque e é consumido', () => {
    grantAdvantage('adv-test-1', 'advantage', 'next_attack');
    const r1 = consumeAdvantageFor('adv-test-1', { kind: 'attack', subtype: 'melee' });
    expect(r1.net).toBe('advantage');
    const r2 = consumeAdvantageFor('adv-test-1', { kind: 'attack', subtype: 'melee' });
    expect(r2.net).toBe('normal'); // já consumido
  });

  it('attack_melee não consome — vale enquanto ativo', () => {
    grantAdvantage('adv-test-1', 'advantage', 'attack_melee');
    expect(consumeAdvantageFor('adv-test-1', { kind: 'attack', subtype: 'melee' }).net).toBe('advantage');
    expect(consumeAdvantageFor('adv-test-1', { kind: 'attack', subtype: 'melee' }).net).toBe('advantage');
  });

  it('attack_ranged não afeta ataque CaC', () => {
    grantAdvantage('adv-test-1', 'advantage', 'attack_ranged');
    expect(consumeAdvantageFor('adv-test-1', { kind: 'attack', subtype: 'melee' }).net).toBe('normal');
    expect(consumeAdvantageFor('adv-test-1', { kind: 'attack', subtype: 'ranged' }).net).toBe('advantage');
  });

  it('skill_specific:furtividade só dispara em furtividade', () => {
    grantAdvantage('adv-test-1', 'advantage', 'skill_specific', { target: 'Furtividade' });
    expect(consumeAdvantageFor('adv-test-1', { kind: 'skill', name: 'Furtividade' }).net).toBe('advantage');
    expect(consumeAdvantageFor('adv-test-1', { kind: 'skill', name: 'Atletismo' }).net).toBe('normal');
  });

  it('save_specific:Reflexos confere vantagem só nesse TR', () => {
    grantAdvantage('adv-test-1', 'advantage', 'save_specific', { target: 'Reflexos' });
    expect(consumeAdvantageFor('adv-test-1', { kind: 'save', name: 'Reflexos' }).net).toBe('advantage');
    expect(consumeAdvantageFor('adv-test-1', { kind: 'save', name: 'Vontade' }).net).toBe('normal');
  });

  it('attribute_specific:FOR confere vantagem só nesse atributo', () => {
    grantAdvantage('adv-test-1', 'advantage', 'attribute_specific', { target: 'FOR' });
    expect(consumeAdvantageFor('adv-test-1', { kind: 'attribute', name: 'FOR' }).net).toBe('advantage');
    expect(consumeAdvantageFor('adv-test-1', { kind: 'attribute', name: 'DES' }).net).toBe('normal');
  });

  it('next_any pega QUALQUER rolagem (1 vez)', () => {
    grantAdvantage('adv-test-1', 'advantage', 'next_any');
    expect(consumeAdvantageFor('adv-test-1', { kind: 'skill', name: 'X' }).net).toBe('advantage');
    expect(consumeAdvantageFor('adv-test-1', { kind: 'attack', subtype: 'melee' }).net).toBe('normal');
  });

  it('attack_weapon_group:Machado só dispara em ataques com machado', () => {
    grantAdvantage('adv-test-1', 'advantage', 'attack_weapon_group', { target: 'Machado' });
    expect(consumeAdvantageFor('adv-test-1', { kind: 'attack', subtype: 'melee', weaponGroup: 'Machado' }).net).toBe('advantage');
    expect(consumeAdvantageFor('adv-test-1', { kind: 'attack', subtype: 'melee', weaponGroup: 'Espada' }).net).toBe('normal');
    expect(consumeAdvantageFor('adv-test-1', { kind: 'attack', subtype: 'melee' }).net).toBe('normal');
  });

  it('attack_weapon_name:"Machado de Batalha" só dispara na arma específica', () => {
    grantAdvantage('adv-test-1', 'advantage', 'attack_weapon_name', { target: 'Machado de Batalha' });
    expect(consumeAdvantageFor('adv-test-1', { kind: 'attack', subtype: 'melee', weaponName: 'Machado de Batalha' }).net).toBe('advantage');
    expect(consumeAdvantageFor('adv-test-1', { kind: 'attack', subtype: 'melee', weaponName: 'Machado de Mão' }).net).toBe('normal');
  });
});

describe('Vantagem/Desvantagem — cancelamento mútuo', () => {
  it('vantagem + desvantagem cancelam', () => {
    grantAdvantage('adv-test-1', 'advantage', 'attack_all');
    grantAdvantage('adv-test-1', 'disadvantage', 'attack_all');
    expect(peekAdvantageFor('adv-test-1', { kind: 'attack', subtype: 'melee' })).toBe('normal');
  });
});

describe('Vantagem/Desvantagem — expiração', () => {
  it('expireEndOfTurnFor remove escopos turno mas mantém persistente', () => {
    grantAdvantage('adv-test-1', 'advantage', 'attack_all'); // turn (default)
    grantAdvantage('adv-test-1', 'disadvantage', 'next_save', { expires: 'persistent' });
    expireEndOfTurnFor('adv-test-1');
    // attack_all (turn) foi expirado.
    expect(peekAdvantageFor('adv-test-1', { kind: 'attack', subtype: 'melee' })).toBe('normal');
    // next_save persistente sobreviveu.
    expect(peekAdvantageFor('adv-test-1', { kind: 'save', name: 'X' })).toBe('disadvantage');
  });

  it('clearAllAdvantage zera tudo', () => {
    grantAdvantage('adv-test-1', 'advantage', 'attack_all');
    grantAdvantage('adv-test-1', 'disadvantage', 'next_save');
    clearAllAdvantage('adv-test-1');
    expect(peekAdvantageFor('adv-test-1', { kind: 'attack', subtype: 'melee' })).toBe('normal');
    expect(peekAdvantageFor('adv-test-1', { kind: 'save', name: 'X' })).toBe('normal');
  });
});

describe('applyAdvantageToD20', () => {
  it('vantagem rola 2d20 e mantém o maior', async () => {
    let i = 0;
    const fakeRoll = () => [3, 17][i++];
    const r = await applyAdvantageToD20('advantage', fakeRoll);
    expect(r.d20).toBe(17);
    expect(r.rolls).toEqual([3, 17]);
  });
  it('desvantagem mantém o menor', async () => {
    let i = 0;
    const fakeRoll = () => [3, 17][i++];
    const r = await applyAdvantageToD20('disadvantage', fakeRoll);
    expect(r.d20).toBe(3);
  });
  it('normal rola 1 vez', async () => {
    let count = 0;
    const r = await applyAdvantageToD20('normal', () => { count++; return 12; });
    expect(r.d20).toBe(12);
    expect(count).toBe(1);
  });
});
