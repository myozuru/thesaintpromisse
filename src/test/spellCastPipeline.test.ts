/**
 * Fase 3 — Spell Cast Pipeline (Especialista em Técnica).
 *
 * Cobre `prepareCast`, `applyDamageMods` e `applyCast` para os 7 IDs ligados
 * ao fluxo de lançamento de feitiços.
 */
import { describe, it, expect } from 'vitest';
import {
  prepareCast,
  applyDamageMods,
  applyCast,
  type RolledDie,
} from '@/lib/spellCastPipeline';
import type { Character, Spell } from '@/types';

function baseChar(partial: Partial<Character> = {}): Character {
  return {
    id: 'c1',
    name: 'Tester',
    level: 12,
    attributes: [
      { id: 'a1', name: 'Força', value: 10 },
      { id: 'a2', name: 'Destreza', value: 10 },
      { id: 'a3', name: 'Constituição', value: 10 },
      { id: 'a4', name: 'Inteligência', value: 18 }, // mod = +4
      { id: 'a5', name: 'Sabedoria', value: 10 },
      { id: 'a6', name: 'Presença', value: 10 },
    ] as Character['attributes'],
    chosenSpecAbilities: [],
    keyAttribute: 'Inteligência',
    spells: [],
    activeBuffs: [],
    activeConditions: [],
    passives: [],
    talents: [],
    rdByType: {} as Character['rdByType'],
    accessorySlots: {} as Character['accessorySlots'],
    savingThrows: {} as Character['savingThrows'],
    cursedAptitudes: {} as Character['cursedAptitudes'],
    ...partial,
  } as unknown as Character;
}

const withIds = (ids: string[], extra: Partial<Character> = {}) =>
  baseChar({
    ...extra,
    chosenSpecAbilities: ids.map((id) => ({ abilityId: id, chosenAtLevel: 1 })),
  });

function makeSpell(partial: Partial<Spell> = {}): Spell {
  return {
    id: 'sp1',
    name: 'Bola de Energia',
    costPE: 3,
    description: '',
    damageDice: '3d6',
    damageBonus: 0,
    spellType: 'damage',
    actionType: 'action',
    buffs: [],
    conditions: [],
    spellLevel: '3' as Spell['spellLevel'],
    durationRounds: 0,
    range: '9m',
    targetMode: 'single_atk',
    ...partial,
  } as Spell;
}

describe('prepareCast — Specs Tier 2', () => {
  it('sem habilidades: plan zerado', () => {
    const plan = prepareCast(baseChar(), makeSpell());
    expect(plan.extraPe).toBe(0);
    expect(plan.bonusDamageDice).toBe(0);
    expect(plan.flatDamageBonus).toBe(0);
    expect(plan.hooks.defensiveCasting).toBe(false);
    expect(plan.hooks.explosionChain).toBe(false);
  });

  it('Conjuração Defensiva opt-in cobra +2 PE', () => {
    const plan = prepareCast(
      withIds(['tec-conjuracao-defensiva']),
      makeSpell(),
      { defensiveCasting: true },
    );
    expect(plan.extraPe).toBe(2);
    expect(plan.hooks.defensiveCasting).toBe(true);
  });

  it('Conjuração Defensiva sem opt-in NÃO cobra PE', () => {
    const plan = prepareCast(
      withIds(['tec-conjuracao-defensiva']),
      makeSpell(),
      { defensiveCasting: false },
    );
    expect(plan.extraPe).toBe(0);
    expect(plan.hooks.defensiveCasting).toBe(false);
  });

  it('Explosão Encadeada acende a flag em feitiço de dano', () => {
    const plan = prepareCast(withIds(['tec-explosao-encadeada']), makeSpell());
    expect(plan.hooks.explosionChain).toBe(true);
  });

  it('Explosão Encadeada NÃO acende em feitiço de buff', () => {
    const plan = prepareCast(
      withIds(['tec-explosao-encadeada']),
      makeSpell({ spellType: 'buff' }),
    );
    expect(plan.hooks.explosionChain).toBe(false);
  });
});

describe('prepareCast — Tier 10/12', () => {
  it('Destruição Ampla: +5 por alvo extra (área)', () => {
    const plan = prepareCast(
      withIds(['tec-destruicao-ampla']),
      makeSpell({ targetMode: 'area_tr' }),
      { targetCount: 4 },
    );
    expect(plan.flatDamageBonus).toBe(15); // 3 alvos extras × 5
    expect(plan.hooks.destructionWide).toBe(true);
  });

  it('Destruição Ampla: 1 alvo → 0 bônus', () => {
    const plan = prepareCast(
      withIds(['tec-destruicao-ampla']),
      makeSpell({ targetMode: 'area_tr' }),
      { targetCount: 1 },
    );
    expect(plan.flatDamageBonus).toBe(0);
  });

  it('Destruição Ampla NÃO aplica em alvo único', () => {
    const plan = prepareCast(
      withIds(['tec-destruicao-ampla']),
      makeSpell({ targetMode: 'single_atk' }),
      { targetCount: 5 },
    );
    expect(plan.flatDamageBonus).toBe(0);
    expect(plan.hooks.destructionWide).toBe(false);
  });

  it('Destruição Focada: ignora RD = keyMod + dados extras = floor(TB/2)', () => {
    // Nv 12 → TB = 5 (regra padrão), floor(5/2)=2; INT 18 → keyMod 4
    const plan = prepareCast(
      withIds(['tec-destruicao-focada'], { level: 12 }),
      makeSpell({ targetMode: 'single_atk' }),
    );
    expect(plan.ignoreRD).toBe(4);
    expect(plan.bonusDamageDice).toBe(2);
    expect(plan.hooks.destructionFocused).toBe(true);
  });

  it('Destruição Focada NÃO aplica em área', () => {
    const plan = prepareCast(
      withIds(['tec-destruicao-focada']),
      makeSpell({ targetMode: 'area_tr' }),
    );
    expect(plan.ignoreRD).toBe(0);
    expect(plan.bonusDamageDice).toBe(0);
  });

  it('Explosão Máxima: perChainExtraFlat = 4', () => {
    const plan = prepareCast(
      withIds(['tec-explosao-encadeada', 'tec-explosao-maxima']),
      makeSpell(),
    );
    expect(plan.perChainExtraFlat).toBe(4);
    expect(plan.hooks.explosionMax).toBe(true);
  });

  it('Ciclagem Maldita: dispara apenas se trocar de feitiço', () => {
    const a = prepareCast(
      withIds(['tec-ciclagem-maldita'], { lastSpellUsedId: 'outro-feitico' }),
      makeSpell({ id: 'sp-novo' }),
    );
    // Nv 12 → TB 5 → floor/2 = 2
    expect(a.bonusDamageDice).toBe(2);
    expect(a.hooks.cycling).toBe(true);

    const b = prepareCast(
      withIds(['tec-ciclagem-maldita'], { lastSpellUsedId: 'sp-novo' }),
      makeSpell({ id: 'sp-novo' }),
    );
    expect(b.bonusDamageDice).toBe(0);
    expect(b.hooks.cycling).toBe(false);
  });

  it('Ciclagem + Focada empilham dados extras', () => {
    const plan = prepareCast(
      withIds(['tec-ciclagem-maldita', 'tec-destruicao-focada'], {
        lastSpellUsedId: 'outro',
      }),
      makeSpell({ targetMode: 'single_tr', id: 'sp-novo' }),
    );
    expect(plan.bonusDamageDice).toBe(4); // 2 + 2
  });
});

describe('applyDamageMods — Explosão Encadeada/Máxima', () => {
  it('sem encadeada: total = soma dos dados', () => {
    const plan = prepareCast(baseChar(), makeSpell());
    const rolls: RolledDie[] = [
      { sides: 6, value: 6 }, { sides: 6, value: 3 }, { sides: 6, value: 1 },
    ];
    const out = applyDamageMods(rolls, plan, () => 4);
    expect(out.total).toBe(10);
    expect(out.chainExtraRolls).toBe(0);
  });

  it('encadeada: dado max gera 1 extra (não recursivo)', () => {
    const plan = prepareCast(withIds(['tec-explosao-encadeada']), makeSpell());
    const rolls: RolledDie[] = [
      { sides: 6, value: 6 }, // dispara
      { sides: 6, value: 6 }, // dispara
      { sides: 6, value: 4 },
    ];
    // roller fixo retorna 6 (mas NÃO deve disparar de novo).
    const out = applyDamageMods(rolls, plan, () => 6);
    expect(out.chainExtraRolls).toBe(2);
    expect(out.chainExtraSum).toBe(12);
    expect(out.total).toBe(16 + 12); // base 16 + extras 12
    expect(out.maxFlatBonus).toBe(0);
  });

  it('encadeada + máxima: +4 por dado disparado', () => {
    const plan = prepareCast(
      withIds(['tec-explosao-encadeada', 'tec-explosao-maxima']),
      makeSpell(),
    );
    const rolls: RolledDie[] = [
      { sides: 8, value: 8 }, { sides: 8, value: 8 }, { sides: 8, value: 1 },
    ];
    const out = applyDamageMods(rolls, plan, () => 3);
    expect(out.chainExtraRolls).toBe(2);
    expect(out.chainExtraSum).toBe(6);
    expect(out.maxFlatBonus).toBe(8); // 4 × 2
    expect(out.total).toBe(17 + 6 + 8);
  });

  it('flatDamageBonus de Destruição Ampla entra no total', () => {
    const plan = prepareCast(
      withIds(['tec-destruicao-ampla']),
      makeSpell({ targetMode: 'area_tr' }),
      { targetCount: 3 },
    );
    const rolls: RolledDie[] = [{ sides: 6, value: 4 }];
    const out = applyDamageMods(rolls, plan, () => 1);
    expect(out.total).toBe(4 + 10); // +5×2 alvos extras
  });
});

describe('applyCast — patches de estado', () => {
  it('sempre grava lastSpellUsedId', () => {
    const c = baseChar();
    const sp = makeSpell({ id: 'sp-xyz' });
    const plan = prepareCast(c, sp);
    const { patch, buffs } = applyCast(c, sp, plan);
    expect(patch.lastSpellUsedId).toBe('sp-xyz');
    expect(buffs).toEqual([]);
  });

  it('Conjuração Defensiva produz buffs CA + RD de 1 turno com value = nível do feitiço', () => {
    const c = withIds(['tec-conjuracao-defensiva']);
    const sp = makeSpell({ spellLevel: '4' as Spell['spellLevel'] });
    const plan = prepareCast(c, sp, { defensiveCasting: true });
    const { buffs } = applyCast(c, sp, plan);
    expect(buffs).toHaveLength(2);
    const ca = buffs.find(b => b.type === 'ca')!;
    const rd = buffs.find(b => b.type === 'rd')!;
    expect(ca.value).toBe(4);
    expect(rd.value).toBe(4);
    expect(ca.remainingTurns).toBe(1);
    expect(rd.remainingTurns).toBe(1);
    expect(ca.sourceCharId).toBe(c.id);
    expect(rd.sourceCharId).toBe(c.id);
  });

  it('Conjuração Defensiva: Técnica Máxima conta como nível 10', () => {
    const c = withIds(['tec-conjuracao-defensiva']);
    const sp = makeSpell({ spellLevel: 'Técnica Máxima' as Spell['spellLevel'] });
    const plan = prepareCast(c, sp, { defensiveCasting: true });
    const { buffs } = applyCast(c, sp, plan);
    expect(buffs.find(b => b.type === 'ca')!.value).toBe(10);
    expect(buffs.find(b => b.type === 'rd')!.value).toBe(10);
  });
});
