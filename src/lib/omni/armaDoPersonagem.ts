import { ALL_WEAPONS, findWeaponByName, requiresTwoHands, type Weapon, type WeaponPropertyKind } from '@/lib/weapons';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { getWeaponMeta } from './weaponModel';

/** Resolve também armas OMNI renomeadas e a empunhadura configurada no construtor. */
export function armaDoPersonagem(charId: string, nome: string): Weapon | undefined {
  const exemplares = useInventoryStore.getState().listByOwner(charId).filter(i => i.entity.categoria === 'arma' && i.entity.nome.trim().toLowerCase() === nome.trim().toLowerCase());
  const item = exemplares.find(i => i.isEquipped) ?? exemplares[0];
  const ent = item && (useOmniEntidadesStore.getState().entidades[item.entity.id] ?? item.entity);
  if (!ent) return findWeaponByName(nome);
  const meta = getWeaponMeta(ent);
  const base = ALL_WEAPONS.find(w => w.id === meta.modeloId) ?? findWeaponByName(nome);
  const weapon: Weapon = base ? { ...base, name: ent.nome, properties: [...base.properties] } : {
    id: ent.id, name: ent.nome, category: 'complexa', range: 'melee', group: 'Espada',
    damage: meta.dano ?? '1d6', damageType: 'Ct', critRange: 20, properties: [], spaces: meta.espacos ?? 1, cost: ent.comercio?.basePrice ?? 0,
  };
  // Tags do OMNI podem descrever uma arma sem modelo. Não inventa parâmetros
  // de propriedades como Recarga, Fatal ou Pesada quando só há o nome da tag.
  if (!base) {
    if (ent.tags.includes('ranged')) weapon.range = 'ranged';
    else if (ent.tags.includes('thrown')) weapon.range = 'thrown';
    const grupo = ent.tags.find(t => t.startsWith('grupo:'))?.slice(6).toLowerCase();
    const grupoValido = ALL_WEAPONS.find(w => w.group.toLowerCase() === grupo)?.group;
    if (grupoValido) weapon.group = grupoValido;
  }
  const propriedadesSimples: readonly WeaponPropertyKind[] = ['ampla', 'aparar', 'apunhaladora', 'duas_maos', 'dupla', 'energica', 'especial', 'estendida', 'fineza', 'leve', 'marcial', 'oscilante', 'versatil'];
  for (const kind of propriedadesSimples) {
    if (ent.tags.includes(`prop:${kind}`) && !weapon.properties.some(p => p.kind === kind)) weapon.properties.push({ kind });
  }
  if (meta.maos || ent.tags.includes('prop:duas_maos')) {
    weapon.properties = weapon.properties.filter(p => p.kind !== 'duas_maos');
    if (meta.maos === 2 || ent.tags.includes('prop:duas_maos') || (base && requiresTwoHands(base))) weapon.properties.push({ kind: 'duas_maos' });
  }
  if (ent.combatData?.critRange != null) weapon.critRange = ent.combatData.critRange;
  if (meta.espacos != null) weapon.spaces = meta.espacos;
  if (meta.alcanceLongo != null) { weapon.rangeLong = meta.alcanceLongo; weapon.rangeShort = meta.alcanceCurto ?? meta.alcanceLongo; }
  return weapon;
}

export function armaEstaEmpunhada(char: { mainHandWeaponName?: string | null; offHandWeaponName?: string | null }, nome: string): boolean {
  return [char.mainHandWeaponName, char.offHandWeaponName].some(n => n?.trim().toLowerCase() === nome.trim().toLowerCase());
}
