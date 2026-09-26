import { describe, it, expect, beforeEach } from 'vitest';
import { getSuporteHealDice, getSuporteHealMaxUses, getSuporteKeyMod, getSuporteHealUsesLeft, applyApoiar, applyPresencaInspiradora, getPresencaInspiradoraMaxExtra, applySuporteBaseTR, applyTRMestre, getSuporteBaseTR, TR_MESTRE_LEVEL } from '@/lib/suporteAbilities';
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

describe('Presença Inspiradora (Nv 3)', () => {
  const sup = (pre: number, pe: number) =>
    ({
      id: 'sup-1',
      name: 'Suporte',
      attributes: [{ name: 'Presença', value: pre }],
      peCurrent: pe,
    }) as unknown as Character;
  const ally = (id: string) => ({ id, name: id, inspiracaoBonus: 0 }) as unknown as Character;

  beforeEach(() => {
    useCharacterStore.setState({ characters: [] });
  });

  it('PE extra máximo = metade do mod de Presença', () => {
    expect(getPresencaInspiradoraMaxExtra(sup(16, 20))).toBe(1); // mod +3 → 1
    expect(getPresencaInspiradoraMaxExtra(sup(18, 20))).toBe(2); // mod +4 → 2
    expect(getPresencaInspiradoraMaxExtra(sup(10, 20))).toBe(0);
  });

  it('custa 2 PE + extra e aplica +1 por PE extra nos aliados (não em si)', () => {
    const s = sup(18, 10);
    const a1 = ally('a1');
    const a2 = ally('a2');
    useCharacterStore.setState({ characters: [s, a1, a2] });
    const r = applyPresencaInspiradora(s, [s, a1, a2], 2);
    expect(r.ok).toBe(true);
    expect(r.totalCost).toBe(4);
    expect(r.bonus).toBe(3);
    const chars = useCharacterStore.getState().characters;
    expect(chars.find((x) => x.id === 'sup-1')?.peCurrent).toBe(6);
    expect(chars.find((x) => x.id === 'sup-1')?.inspiracaoBonus ?? 0).toBe(0);
    expect(chars.find((x) => x.id === 'a1')?.inspiracaoBonus).toBe(3);
    expect(chars.find((x) => x.id === 'a2')?.inspiracaoBonus).toBe(3);
  });

  it('limita o extra ao máximo e falha sem PE', () => {
    const s = sup(16, 2); // maxExtra 1, PE 2
    useCharacterStore.setState({ characters: [s] });
    const r = applyPresencaInspiradora(s, [], 99); // clamp a 1 → custo 3 > 2 PE
    expect(r.ok).toBe(false);
    expect(r.totalCost).toBe(3);
    expect(useCharacterStore.getState().characters[0].peCurrent).toBe(2);
  });
});

describe('TR do Suporte (Nv 1) e TR Mestre (Nv 9)', () => {
  const mkSup = (level: number, suporteBaseTR?: 'Astúcia' | 'Vontade', savingThrows?: unknown[]) =>
    ({
      id: 'sup-1',
      name: 'Suporte',
      level,
      suporteBaseTR,
      savingThrows: savingThrows ?? [
        { id: 'astucia', name: 'Astúcia', value: 10 },
        { id: 'vontade', name: 'Vontade', value: 10 },
      ],
    }) as unknown as Character;

  const st = (name: string) =>
    useCharacterStore.getState().characters[0].savingThrows.find((s) => s.name === name);

  beforeEach(() => {
    useCharacterStore.setState({ characters: [] });
  });

  it('escolha do Nv 1 treina Astúcia ou Vontade', () => {
    const s = mkSup(1);
    useCharacterStore.setState({ characters: [s] });
    applySuporteBaseTR(s, 'Vontade');
    expect(getSuporteBaseTR(useCharacterStore.getState().characters[0])).toBe('Vontade');
    expect(st('Vontade')?.trained).toBe(true);
    expect(st('Astúcia')?.trained).toBeFalsy();
  });

  it('TR Mestre: maestria no escolhido, treinado no outro', () => {
    const s = mkSup(TR_MESTRE_LEVEL);
    useCharacterStore.setState({ characters: [s] });
    applySuporteBaseTR(s, 'Astúcia');
    const r = applyTRMestre(useCharacterStore.getState().characters[0]);
    expect(r.ok).toBe(true);
    expect(st('Astúcia')?.mastery).toBe(true);
    expect(st('Astúcia')?.trained).toBe(true);
    expect(st('Vontade')?.trained).toBe(true);
    expect(st('Vontade')?.mastery).toBeFalsy();
  });

  it('TR Mestre falha abaixo do nível ou sem escolha base', () => {
    const s = mkSup(TR_MESTRE_LEVEL - 1);
    useCharacterStore.setState({ characters: [s] });
    applySuporteBaseTR(s, 'Astúcia');
    expect(applyTRMestre(useCharacterStore.getState().characters[0]).ok).toBe(false);
    const semBase = mkSup(20);
    useCharacterStore.setState({ characters: [semBase] });
    expect(applyTRMestre(semBase).ok).toBe(false);
  });

  it('trocar a escolha após o TR Mestre move a maestria junto', () => {
    const s = mkSup(20);
    useCharacterStore.setState({ characters: [s] });
    applySuporteBaseTR(s, 'Astúcia');
    applyTRMestre(useCharacterStore.getState().characters[0]);
    applySuporteBaseTR(useCharacterStore.getState().characters[0], 'Vontade');
    expect(st('Vontade')?.mastery).toBe(true);
    expect(st('Astúcia')?.trained).toBe(true);
    expect(st('Astúcia')?.mastery).toBeFalsy();
  });
});
