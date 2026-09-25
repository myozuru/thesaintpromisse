/**
 * Sincronização Omni → Banco de Itens.
 *
 * Sempre que uma EntidadeOmni de categoria 'item' for criada, atualizada
 * ou removida no `useOmniEntidadesStore`, este módulo espelha a mudança
 * no `useItemStore` (a aba "Itens"), reutilizando o mesmo `id` para
 * garantir idempotência (sem duplicar entradas em re-salvamentos).
 *
 * O bind é instalado uma única vez no bootstrap do app (main.tsx).
 */
import type { EntidadeOmni } from './tipos';
import type { DamageType, Item, ItemSlotType } from '@/types';
import { DAMAGE_TYPES, ITEM_SLOT_TYPES } from '@/types';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useItemStore } from '@/stores/useItemStore';
import { useInventoryStore } from '@/stores/useInventoryStore';

function emptyDamageMap(): Record<DamageType, number> {
  return DAMAGE_TYPES.reduce(
    (acc, k) => ({ ...acc, [k]: 0 }),
    {} as Record<DamageType, number>,
  );
}

function normalizeSlotType(s: EntidadeOmni['slotType']): ItemSlotType {
  if (s && (ITEM_SLOT_TYPES as readonly string[]).includes(s)) return s as ItemSlotType;
  return 'nenhum';
}

/** Lê `espacos:N` das tags. Usado por armas Omni para definir `slots`. */
function readEspacosFromTags(tags: string[] | undefined): number | null {
  const tag = (tags ?? []).find((t) => t.startsWith('espacos:'));
  if (!tag) return null;
  const n = parseInt(tag.slice(8), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Converte uma EntidadeOmni (item) em Item do banco de itens. */
export function omniToItem(ent: EntidadeOmni, prev?: Item): Item {
  const bonus = ent.bonusEquipado ?? {};
  const espacosTag = readEspacosFromTags(ent.tags);
  return {
    id: ent.id, // MESMO id → idempotente
    name: ent.nome || 'Item sem nome',
    category: (ent.tags && ent.tags[0]) || 'Omni',
    description: ent.descricao || '',
    weight: prev?.weight ?? 0,
    cost: ent.comercio?.basePrice ?? prev?.cost ?? 0,
    slots: espacosTag ?? prev?.slots ?? 1,
    quantity: prev?.quantity ?? 1,
    slotType: normalizeSlotType(ent.slotType),
    bonusHP: bonus.hp ?? 0,
    bonusPE: bonus.pe ?? 0,
    bonusESC: bonus.esc ?? 0,
    bonusRD: bonus.rd ?? 0,
    bonusRdByType: prev?.bonusRdByType ?? emptyDamageMap(),
    bonusSlots: bonus.slots ?? 0,
    bonusCA: bonus.ca ?? 0,
    bonusDC: prev?.bonusDC ?? 0,
    bonusActions: prev?.bonusActions ?? 0,
    bonusBonusActions: prev?.bonusBonusActions ?? 0,
    bonusReactions: prev?.bonusReactions ?? 0,
    bonusOpportunity: prev?.bonusOpportunity ?? 0,
    rollBonuses: prev?.rollBonuses ?? [],
    assignedTo: prev?.assignedTo ?? [],
    isFood: prev?.isFood,
    hungerRestore: prev?.hungerRestore,
    hpRestore: prev?.hpRestore,
    peRestore: prev?.peRestore,
    pvtRestore: prev?.pvtRestore,
  };
}

let installed = false;

/**
 * Instala o subscriber. Idempotente — chamadas repetidas não duplicam o bind.
 * Faz uma reconciliação inicial para o caso do app abrir com itens Omni
 * já persistidos mas ainda não espelhados no banco de itens.
 */
export function installOmniItemBankSync(): void {
  if (installed) return;
  installed = true;

  // Re-entrance guard: a remoção em cascata aciona os subscribers de
  // ambos os stores. Sem esse flag, removeItem→remover→reconcile cria
  // um loop e dispara "Maximum update depth exceeded".
  let cascading = false;

  /** Remove todas as instâncias deste item do inventário de qualquer dono. */
  const purgeInventory = (entityId: string) => {
    const inv = useInventoryStore.getState();
    const alvos = Object.values(inv.items).filter((it) => it.entity?.id === entityId);
    for (const it of alvos) {
      // remove do slot e depois do inventário
      if (it.isEquipped) inv.unequipItem(it.instanceId);
      inv.remove(it.instanceId);
    }
  };

  const reconcile = (entidades: Record<string, EntidadeOmni>, prev?: Record<string, EntidadeOmni>) => {
    const itemStore = useItemStore.getState();
    const items = itemStore.items;

    // Adições / atualizações
    for (const ent of Object.values(entidades)) {
      if (ent.categoria !== 'item' && ent.categoria !== 'arma') continue;
      const prevEnt = prev?.[ent.id];
      if (prevEnt === ent) continue;
      const existing = items.find((i) => i.id === ent.id);
      const next = omniToItem(ent, existing);
      if (existing) {
        itemStore.updateItem(ent.id, next);
      } else {
        itemStore.addItem(next);
      }
    }

    // Remoções: cascata para banco de itens + inventários + slots equipados
    if (prev) {
      for (const oldEnt of Object.values(prev)) {
        if (oldEnt.categoria !== 'item' && oldEnt.categoria !== 'arma') continue;
        if (!entidades[oldEnt.id]) {
          cascading = true;
          try {
            if (items.find((i) => i.id === oldEnt.id)) {
              itemStore.removeItem(oldEnt.id);
            }
            purgeInventory(oldEnt.id);
          } finally {
            cascading = false;
          }
        }
      }
    }
  };

  // Reconciliação inicial (sem `prev`, só popula o que faltar)
  reconcile(useOmniEntidadesStore.getState().entidades);

  // Subscribe a mudanças no Omni → propaga para itens/inventário
  useOmniEntidadesStore.subscribe((state, prevState) => {
    if (state.entidades === prevState.entidades) return;
    reconcile(state.entidades, prevState.entidades);
  });

  // Bridge reverso: deletar do banco de itens também apaga a EntidadeOmni
  // (que por sua vez purga o inventário via cascata acima).
  useItemStore.subscribe((state, prevState) => {
    if (cascading) return;
    if (state.items === prevState.items) return;
    const atuais = new Set(state.items.map((i) => i.id));
    const removidos = prevState.items.filter((i) => !atuais.has(i.id));
    if (removidos.length === 0) return;
    const omni = useOmniEntidadesStore.getState();
    cascading = true;
    try {
      for (const r of removidos) {
        if (omni.entidades[r.id]) {
          omni.remover(r.id);
        }
        // mesmo sem Omni associado, limpa instâncias remanescentes
        purgeInventory(r.id);
      }
    } finally {
      cascading = false;
    }
  });
}
