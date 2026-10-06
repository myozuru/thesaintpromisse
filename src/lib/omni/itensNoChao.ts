import { exemplarEstaEmpunhado } from './exemplarArma';
import { useMapStore } from '@/stores/useMapStore';
import { useInventoryStore, type InventoryItem } from '@/stores/useInventoryStore';
import { useItemStore } from '@/stores/useItemStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useLogStore } from '@/stores/useLogStore';
import { tokenDaFicha } from '@/stores/useAlvoMapaStore';
import { touchDistanceMeters } from '@/lib/touchRange';
import { findMyCharacter } from '@/lib/myCharacter';
import type { Item } from '@/types';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';

export type ItemNoChao = { item: InventoryItem; droppedByCharId: string } | { legacy: Item; droppedByCharId: string };
function validarDono(charId: string) {
  const chars = useCharacterStore.getState().characters, char = chars.find(c => c.id === charId);
  if (!char) throw new Error('Ficha não encontrada.');
  if (useRoleStore.getState().role === 'PLAYER' && findMyCharacter(chars, useProfileStore.getState().activeProfileId)?.id !== charId) throw new Error('Você só pode usar o inventário da sua ficha.');
  const token = tokenDaFicha(char);
  if (!token) throw new Error('Coloque sua ficha no mapa para soltar ou recolher o item.');
  return { char, token };
}
export function soltarItemNoChao(charId: string, id: string, legado = false): string {
  const { char, token } = validarDono(charId);
  const inv = useInventoryStore.getState(), banco = useItemStore.getState();
  const item = inv.items[id], legacy = banco.items.find(i => i.id === id);
  if (legado ? !legacy?.assignedTo?.includes(charId) : !item || item.ownerId !== charId || !['arma', 'item'].includes(item.entity.categoria)) throw new Error('Item não encontrado neste inventário.');
  const ms = useMapStore.getState(), dpi = ms.gridConfig.dpi || 70;
  const nome = legado ? legacy!.name : item.entity.nome;
  const naMao = !legado && exemplarEstaEmpunhado(char, item);
  const handId = legado ? `legacy:${id}` : id;
  const maoPrincipalExata = char.mainHandWeaponInstanceId === handId;
  const maoSecundariaExata = char.offHandWeaponInstanceId === handId;
  const groundItem: ItemNoChao = legado ? { legacy: { ...legacy!, assignedTo: [] }, droppedByCharId: charId } : { item: { ...item, isEquipped: false, equippedSlot: undefined, materializada: false, sustentacaoPendente: false }, droppedByCharId: charId };
  const entityId = ms.addEntity({ shape: 'RECT', x: token.x + dpi * .65, y: token.y + dpi * .65, w: dpi * .4, h: dpi * .4, rotation: 0,
    color: '#c084fc', locked: true, layer: 'tokens', label: `📦 ${nome}`, nameplate: true, groundItem });
  if (legado) banco.updateItem(id, { assignedTo: legacy!.assignedTo.filter(c => c !== charId) });
  else inv.remove(id);
  const restantes = Object.values(useInventoryStore.getState().items).some(i => i.ownerId === charId && i.entity.nome === nome) ||
    useItemStore.getState().items.some(i => i.name === nome && i.assignedTo.includes(charId));
  if (maoPrincipalExata || maoSecundariaExata || (!restantes && (item?.isEquipped || naMao))) useCharacterStore.getState().updateCharacter(charId, {
    ...(maoPrincipalExata || (!char.mainHandWeaponInstanceId && char.mainHandWeaponName === nome && !restantes) ? { mainHandWeaponName: null, mainHandWeaponInstanceId: null } : {}),
    ...(maoSecundariaExata || (!char.offHandWeaponInstanceId && char.offHandWeaponName === nome && !restantes) ? { offHandWeaponName: null, offHandWeaponInstanceId: null } : {}),
  });
  useLogStore.getState().addLog('system', `📦 ${char.name} soltou ${nome} no chão.`);
  return entityId;
}
export function recolherItemDoChao(charId: string, entityId: string): void {
  const { char, token } = validarDono(charId), ms = useMapStore.getState();
  const ground = ms.entities[entityId], data = ground?.groundItem;
  if (!data) throw new Error('O item não está mais no chão.');
  if (touchDistanceMeters(token, ground, ms.gridConfig) > 1.5 + .05) throw new Error('Aproxime-se a até 1,5 m do item.');
  const pickupId = `ground-${entityId}`, inv = useInventoryStore.getState();
  if (inv.items[pickupId] || inv.deleted[pickupId]) throw new Error('Este item já foi recolhido.');
  if ('item' in data) {
    const inst = inv.add(charId, data.item.entity, { instanceId: pickupId });
    useInventoryStore.setState(s => ({ items: { ...s.items, [inst.instanceId]: { ...s.items[inst.instanceId], usosRestantes: data.item.usosRestantes, usosTotais: data.item.usosTotais } } }));
  } else {
    const banco = useItemStore.getState(), existing = banco.items.find(i => i.id === data.legacy.id);
    if (existing) banco.updateItem(existing.id, { assignedTo: [...new Set([...existing.assignedTo, charId])] });
    else banco.addItem({ ...data.legacy, assignedTo: [charId] });
    useInventoryStore.setState(s => ({ deleted: { ...s.deleted, [pickupId]: Date.now() } }));
  }
  ms.removeEntities([entityId]);
  useLogStore.getState().addLog('system', `📦 ${char.name} recolheu ${'item' in data ? data.item.entity.nome : data.legacy.name}.`);
}

/** Mestre coloca uma arma/item do catálogo OMNI diretamente no chão do mapa. */
export function invocarItemNoChao(entidadeId: string, pos?: { x: number; y: number }): string {
  if (useRoleStore.getState().role !== 'MASTER') throw new Error('Apenas o Mestre pode invocar itens no chão.');
  const ent = useOmniEntidadesStore.getState().entidades[entidadeId];
  if (!ent || !['arma', 'item'].includes(ent.categoria)) throw new Error('Escolha uma arma ou item do catálogo.');
  const ms = useMapStore.getState(), dpi = ms.gridConfig.dpi || 70;
  const p = pos ?? { x: dpi * 2, y: dpi * 2 };
  const now = Date.now();
  const item: InventoryItem = { instanceId: `mestre-${now}-${Math.random().toString(36).slice(2, 7)}`, ownerId: 'mestre', entity: ent, acquiredAt: now,
    ...(ent.usos?.total != null ? { usosRestantes: ent.usos.total, usosTotais: ent.usos.total } : {}) };
  const id = ms.addEntity({ shape: 'RECT', x: p.x, y: p.y, w: dpi * .5, h: dpi * .5, rotation: 0, color: '#c084fc', locked: true, layer: 'tokens',
    label: `📦 ${ent.nome}`, nameplate: true, groundItem: { item, droppedByCharId: '' } });
  useLogStore.getState().addLog('system', `📦 O Mestre colocou ${ent.nome} no chão.`);
  return id;
}
