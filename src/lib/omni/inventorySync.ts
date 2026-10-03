import type { InventoryItem } from '@/stores/useInventoryStore';

export interface InventorySnapshot {
  items: Record<string, InventoryItem>;
  deleted: Record<string, number>;
}
const stamp = (item: InventoryItem) => item._syncAt ?? item.acquiredAt ?? 0;

/** União por instância: versões mais recentes ganham; remoções são persistentes. */
export function mergeInventory(local: InventorySnapshot, incoming: unknown): InventorySnapshot {
  if (!incoming || typeof incoming !== 'object') return local;
  const remote = incoming as Partial<InventorySnapshot>;
  if (!remote.items || typeof remote.items !== 'object' || Array.isArray(remote.items)) return local;
  const deleted = { ...local.deleted };
  for (const [id, at] of Object.entries(remote.deleted ?? {})) {
    if (typeof at === 'number' && Number.isFinite(at)) deleted[id] = Math.max(deleted[id] ?? 0, at);
  }
  const items = { ...local.items };
  for (const [id, item] of Object.entries(remote.items)) {
    if (!item || item.instanceId !== id || typeof item.ownerId !== 'string' || !item.entity) continue;
    if (!items[id] || stamp(item) > stamp(items[id]) || stamp(item) === stamp(items[id]) && JSON.stringify(item) > JSON.stringify(items[id])) items[id] = item;
  }
  for (const id of Object.keys(deleted)) delete items[id];
  return { items, deleted };
}

/** Captura também alterações feitas diretamente por outras mecânicas na store. */
export function stampInventoryChanges(next: InventorySnapshot, prev: InventorySnapshot): InventorySnapshot {
  const items = { ...next.items }, deleted = { ...next.deleted };
  let changed = false;
  for (const [id, item] of Object.entries(items)) {
    if (item === prev.items[id]) continue;
    if (item._syncAt !== undefined && item._syncAt !== prev.items[id]?._syncAt) continue;
    items[id] = { ...item, _syncAt: prev.items[id] ? Math.max(Date.now(), stamp(item) + 1, stamp(prev.items[id]) + 1) : stamp(item) };
    changed = true;
  }
  for (const [id, item] of Object.entries(prev.items)) {
    if (!items[id] && !deleted[id]) { deleted[id] = Math.max(Date.now(), stamp(item) + 1); changed = true; }
  }
  return changed ? { items, deleted } : next;
}
