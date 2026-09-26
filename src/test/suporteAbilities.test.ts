import { describe, it, expect, beforeEach } from 'vitest';
import { getSuporteHealDice, getSuporteHealMaxUses, getSuporteKeyMod, getSuporteHealUsesLeft, applyApoiar } from '@/lib/suporteAbilities';
import { consumeAdvantageFor, expireGrantedBy, peekAdvantageFor } from '@/lib/omni/rollAdvantage';
import { useCharacterStore } from '@/stores/useCharacterStore';
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

describe('Apoiar (Suporte em Combate)', () => {
  const supporter = { id: 'sup-1', name: 'Suporte' } as Character;
  const target = { id: 'alvo-1', name: 'Alvo', omniFlags: {} } as unknown as Character;

  beforeEach(() => {
    useCharacterStore.setState({ characters: [supporter, target] });
  });

  it('concede vantagem no próximo teste de perícia do alvo', async () => {
    await applyApoiar(supporter, target);
    expect(peekAdvantageFor('alvo-1', { kind: 'skill', name: 'Atletismo' })).toBe('advantage');
    // Não afeta ataques nem TRs.
    expect(peekAdvantageFor('alvo-1', { kind: 'save', name: 'Reflexos' })).toBe('normal');
    expect(peekAdvantageFor('alvo-1', { kind: 'attack', subtype: 'melee' })).toBe('normal');
  });

  it('é consumido na primeira rolagem de perícia (1 uso)', async () => {
    await applyApoiar(supporter, target);
    const r = consumeAdvantageFor('alvo-1', { kind: 'skill', name: 'Furtividade' });
    expect(r.net).toBe('advantage');
    expect(peekAdvantageFor('alvo-1', { kind: 'skill', name: 'Furtividade' })).toBe('normal');
  });

  it('expira no início do próximo turno de quem apoiou', async () => {
    await applyApoiar(supporter, target);
    expireGrantedBy('sup-1');
    expect(peekAdvantageFor('alvo-1', { kind: 'skill', name: 'Atletismo' })).toBe('normal');
  });

  it('não expira no turno de outra criatura', async () => {
    await applyApoiar(supporter, target);
    expireGrantedBy('outro-id');
    expect(peekAdvantageFor('alvo-1', { kind: 'skill', name: 'Atletismo' })).toBe('advantage');
  });
});
