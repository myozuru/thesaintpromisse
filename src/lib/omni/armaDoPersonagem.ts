import { exemplarArma, entidadeDoExemplar } from './exemplarArma';
import { ALL_WEAPONS, findWeaponByName, requiresTwoHands, resolveWeaponDamage, type Weapon, type WeaponPropertyKind } from '@/lib/weapons';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { resolverTipoDano } from './contextoDano';
import { getWeaponMeta, efeitoDanoDaArma } from './weaponModel';

/** Resolve também armas OMNI renomeadas e a empunhadura configurada no construtor. */
export function armaDoPersonagem(charId: string, nome: string, instanciaId?: string): Weapon | undefined {
  const item = instanciaId ? useInventoryStore.getState().items[instanciaId] : exemplarArma(charId, nome);
  if (instanciaId && (!item || item.ownerId !== charId || entidadeDoExemplar(item).categoria !== 'arma' || entidadeDoExemplar(item).nome.trim().toLowerCase() !== nome.trim().toLowerCase())) return undefined;
  const ent = item && entidadeDoExemplar(item);
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
  const efeito = efeitoDanoDaArma(ent);
  if (meta.dano && (!base || meta.dano.trim() !== resolveWeaponDamage(base, false))) weapon.omniDamageFormula = meta.dano;
  if (ent.combatData?.critMultiplier != null) weapon.critMultiplier = ent.combatData.critMultiplier;
  const tipo = resolverTipoDano(efeito?.damageType);
  if (tipo) {
    const fisico = { DCO: 'Ct', DP: 'Pf', DI: 'Im' } as const;
    weapon.omniDamageType = tipo;
    weapon.damageType = fisico[tipo as keyof typeof fisico] ?? null;
  }
  if (ent.combatData?.critRange != null) weapon.critRange = ent.combatData.critRange;
  if (meta.espacos != null) weapon.spaces = meta.espacos;
  if (meta.alcanceLongo != null) { weapon.rangeLong = meta.alcanceLongo; weapon.rangeShort = meta.alcanceCurto ?? meta.alcanceLongo; }
  return weapon;
}

export function armaEstaEmpunhada(char: { mainHandWeaponName?: string | null; offHandWeaponName?: string | null }, nome: string): boolean {
  return [char.mainHandWeaponName, char.offHandWeaponName].some(n => n?.trim().toLowerCase() === nome.trim().toLowerCase());
}
