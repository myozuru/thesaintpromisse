import { afterEach, describe, expect, it } from 'vitest';
import preset from '../../public/omni-presets/baculo-aetheris.json';
import { EXTERNAL_WEAPONS, ALL_WEAPONS, hasProperty, requiresTwoHands } from '@/lib/weapons';
import { weaponMaxRangeMeters } from '@/lib/weaponRange';
import { PacoteOmniSchema } from '@/lib/omni/validacao';
import { armaDoPersonagem } from '@/lib/omni/armaDoPersonagem';
import { useInventoryStore } from '@/stores/useInventoryStore';
import type { EntidadeOmni } from '@/lib/omni/tipos';

describe('Báculo Aetheris — catálogo e importação OMNI', () => {
  afterEach(() => useInventoryStore.getState().resetAll());

  it('declara alcance, empunhadura, espaços, dano e crítico do plano', () => {
    const weapon = EXTERNAL_WEAPONS.find((item) => item.id === 'baculo-aetheris')!;
    expect(ALL_WEAPONS).toHaveLength(52);
    expect(weapon).toMatchObject({ name: 'Báculo Aetheris', range: 'melee', group: 'Haste', damage: '2d8', damageType: 'Im', critRange: 19, spaces: 2 });
    expect(weapon.cost).toBeUndefined();
    expect(requiresTwoHands(weapon)).toBe(true);
    expect(hasProperty(weapon, 'estendida')).toBe(true);
    expect(weaponMaxRangeMeters(weapon)).toBe(3);
  });

  it('passa pelo schema de importação e preserva feature e combatData ao equipar', () => {
    const parsed = PacoteOmniSchema.safeParse(preset);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const entity = parsed.data.entidades[0];
    expect(entity.comercio).toBeUndefined();
    expect(entity.tags).toContain('feature:baculo-aetheris');
    expect(entity.tags).toContain('mao:2');
    expect(entity.combatData?.critRange).toBe(19);
    expect(entity.acoesAtivas?.find((action) => action.id === 'baculo-aetheris-reversao')).toMatchObject({
      acao: 'reacao', custoPE: '7', alcanceM: 9,
      reacao: { gatilho: 'quando_alvo_declarar_ataque', alcance_m: 9, tipo_ataque: 'ranged', protegido: 'todos', defesa_bonus: 5 },
    });

    const item = useInventoryStore.getState().add('portador', entity as unknown as EntidadeOmni, { instanceId: 'baculo-aetheris-u' });
    const weapon = armaDoPersonagem('portador', entity.nome, item.instanceId);
    expect(weapon).toMatchObject({
      id: 'baculo-aetheris', specialFeatureId: 'baculo-aetheris', name: 'Báculo Aetheris',
      damage: '2d8', damageType: 'Im', critRange: 19, spaces: 2,
    });
    expect(requiresTwoHands(weapon!)).toBe(true);
    expect(weaponMaxRangeMeters(weapon!)).toBe(3);
  });
});
