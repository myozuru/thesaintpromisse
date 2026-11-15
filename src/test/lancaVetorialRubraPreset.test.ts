import { afterEach, describe, expect, it } from 'vitest';
import pacote from '../../public/omni-presets/lanca-vetorial-rubra.json';
import { armaDoPersonagem } from '@/lib/omni/armaDoPersonagem';
import { applyWeaponModel, buildWeaponTags, describeWeapon } from '@/lib/omni/weaponModel';
import { PacoteOmniSchema } from '@/lib/omni/validacao';
import { EXTERNAL_WEAPONS, ALL_WEAPONS, resolveWeaponDamage } from '@/lib/weapons';
import { useInventoryStore } from '@/stores/useInventoryStore';
import type { EntidadeOmni } from '@/lib/omni/tipos';

describe('Lança Vetorial Rubra como arma externa OMNI', () => {
  afterEach(() => useInventoryStore.getState().resetAll());

  it('mantém o catálogo-base e declara a ficha sem preço inventado', () => {
    const weapon = EXTERNAL_WEAPONS.find((w) => w.id === 'lanca-vetorial-rubra')!;
    expect(ALL_WEAPONS).toHaveLength(52);
    expect(resolveWeaponDamage(weapon)).toBe('1d10');
    expect(weapon.damageType).toBe('Pf');
    expect(weapon.critRange).toBe(19);
    expect(weapon.spaces).toBe(3);
    expect(weapon.cost).toBeUndefined();
    expect(weapon.properties.map((p) => p.kind)).toEqual(['estendida', 'duas_maos', 'especial']);
    expect(describeWeapon(weapon)).not.toContain('Custo:');
    expect(describeWeapon(weapon)).toContain('Espa\u00e7os: 3');
    expect(describeWeapon(weapon)).toContain('Espa\u00e7os: 3');
  });

  it('valida no importador de presets e gera tags/combatData compatíveis com weaponModel', () => {
    const parsed = PacoteOmniSchema.safeParse(pacote);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const entity = parsed.data.entidades[0];
    expect(entity.comercio).toMatchObject({ basePrice: 0, isBought: false });
    expect(entity.comercio?.hiddenTags).toContain('ferramenta_amaldicoada');
    expect(entity.tags).toContain('feature:lanca-vetorial-rubra');
    expect(entity.tags).toContain('mao:2');
    expect(entity.combatData?.effectsActive?.[0]).toMatchObject({ formula: '1d10', damageType: 'Perfurante' });
    const weaponModel = EXTERNAL_WEAPONS.find((weapon) => weapon.id === 'lanca-vetorial-rubra')!;
    expect(buildWeaponTags(weaponModel)).toContain('feature:lanca-vetorial-rubra');
    const rebuilt = applyWeaponModel(entity as EntidadeOmni, weaponModel);
    expect(rebuilt.tags).toContain('feature:lanca-vetorial-rubra');
    expect(rebuilt.combatData?.critRange).toBe(19);
    expect(rebuilt.combatData?.effectsActive?.[0]?.formula).toBe('1d10');
    expect(rebuilt.comercio).toMatchObject({ basePrice: 0, isBought: false });
  });

  it('percorre exemplarArma->armaDoPersonagem e preserva feature, empunhadura e crítico', () => {
    const entity = pacote.entidades[0] as EntidadeOmni;
    const item = useInventoryStore.getState().add('portador', entity, { instanceId: 'lanca-vetorial-rubra-u' });
    expect(item.entity.comercio).toMatchObject({ basePrice: 0, isBought: false });
    const weapon = armaDoPersonagem('portador', entity.nome, item.instanceId);
    expect(weapon).toMatchObject({
      id: 'lanca-vetorial-rubra', specialFeatureId: 'lanca-vetorial-rubra', group: 'Haste',
      damage: '1d10', damageType: 'Pf', critRange: 19, spaces: 3,
    });
    expect(weapon?.properties.map((p) => p.kind).sort()).toEqual(['duas_maos', 'especial', 'estendida']);
  });
});
