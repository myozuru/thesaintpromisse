import { ALL_WEAPONS, findWeaponByName, type Weapon } from '@/lib/weapons';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { getWeaponMeta } from './weaponModel';

/** Resolve também armas OMNI renomeadas e a empunhadura configurada no construtor. */
export function armaDoPersonagem(charId: string, nome: string): Weapon | undefined {
  const item = useInventoryStore.getState().listByOwner(charId).find(i => i.entity.categoria === 'arma' && i.entity.nome === nome);
  const ent = item && (useOmniEntidadesStore.getState().entidades[item.entity.id] ?? item.entity);
  if (!ent) return findWeaponByName(nome);
  const meta = getWeaponMeta(ent);
  const base = ALL_WEAPONS.find(w => w.id === meta.modeloId) ?? findWeaponByName(nome);
  const weapon: Weapon = base ? { ...base, name: ent.nome, properties: [...base.properties] } : {
    id: ent.id, name: ent.nome, category: 'complexa', range: 'melee', group: 'Espada',
    damage: meta.dano ?? '1d6', damageType: 'Ct', critRange: 20, properties: [], spaces: meta.espacos ?? 1, cost: ent.comercio?.basePrice ?? 0,
  };
  if (meta.maos || ent.tags.includes('prop:duas_maos')) {
    weapon.properties = weapon.properties.filter(p => p.kind !== 'duas_maos');
    if (meta.maos === 2 || ent.tags.includes('prop:duas_maos')) weapon.properties.push({ kind: 'duas_maos' });
  }
  if (meta.alcanceLongo != null) { weapon.rangeLong = meta.alcanceLongo; weapon.rangeShort = meta.alcanceCurto ?? meta.alcanceLongo; }
  return weapon;
}

export function armaEstaEmpunhada(char: { mainHandWeaponName?: string | null; offHandWeaponName?: string | null }, nome: string): boolean {
  return [char.mainHandWeaponName, char.offHandWeaponName].some(n => n?.trim().toLowerCase() === nome.trim().toLowerCase());
}
