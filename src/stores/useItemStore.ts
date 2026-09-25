import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Item } from '@/types';
import { useCharacterStore } from './useCharacterStore';
import { useLogStore } from './useLogStore';

interface ItemStore {
  items: Item[];
  addItem: (item: Item) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  spendItem: (id: string) => boolean;
  resetAll: () => void;
}

/**
 * Detecta itens de Medicina/Refeição pelo nome OU descrição.
 * Como o domínio de Item não possui campo de categoria, usamos heurística textual.
 */
function isHealingConsumable(item: Item): boolean {
  if (item.isFood) return true;
  const haystack = `${item.name ?? ''} ${item.category ?? ''}`.toLowerCase();
  return /medicina|remédio|remedio|cura|poção|pocao|refeição|refeicao|comida|alimento/.test(
    haystack,
  );
}

export const useItemStore = create<ItemStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => set((state) => ({ items: [...state.items, item] })),
      removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      updateItem: (id, updates) => set((state) => ({ items: state.items.map((i) => (i.id === id ? { ...i, ...updates } : i)) })),
      spendItem: (id) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return false;
        // CAM: não pode receber benefício de Medicina/Refeição.
        if (isHealingConsumable(item)) {
          const characters = useCharacterStore.getState().characters;
          const blockedTarget = (item.assignedTo || [])
            .map((cid) => characters.find((c) => c.id === cid))
            .find((c) => c?.origin === 'Corpo Amaldiçoado Mutante (CAM)');
          if (blockedTarget) {
            useLogStore
              .getState()
              .addLog(
                'system',
                `❌ ${blockedTarget.name} (CAM) não pode usar "${item.name}" — Medicina/Refeição bloqueada.`,
              );
            return false;
          }
        }
        // Aplica efeitos de comida/consumível (fome / HP / PE / PVT) aos vinculados.
        if (item.isFood) {
          const charStore = useCharacterStore.getState();
          const logStore = useLogStore.getState();
          const characters = charStore.characters;
          const targets = (item.assignedTo || [])
            .map((cid) => characters.find((c) => c.id === cid))
            .filter((c): c is NonNullable<typeof c> => Boolean(c));
          if (targets.length === 0) {
            logStore.addLog(
              'system',
              `⚠️ "${item.name}" não tem personagem vinculado — efeito não aplicado.`,
            );
          } else {
            const hungerRestore = Math.max(0, item.hungerRestore ?? 0);
            const hpRestore = Math.max(0, item.hpRestore ?? 0);
            const peRestore = Math.max(0, item.peRestore ?? 0);
            const pvtRestore = Math.max(0, item.pvtRestore ?? 0);
            for (const target of targets) {
              const parts: string[] = [];
              if (hungerRestore > 0) {
                const before = target.hunger ?? 24;
                const after = Math.min(24, before + hungerRestore);
                charStore.setHunger(target.id, after);
                parts.push(`🍞 +${after - before} fome`);
              }
              if (hpRestore > 0) {
                charStore.applyHealing(target.id, hpRestore, 'other');
                parts.push(`❤️ +${hpRestore} PV`);
              }
              if (peRestore > 0) {
                // Recupera PE direto (cap em peMax).
                useCharacterStore.setState((s) => ({
                  characters: s.characters.map((c) =>
                    c.id === target.id
                      ? { ...c, peCurrent: Math.min(c.peMax, c.peCurrent + peRestore) }
                      : c,
                  ),
                }));
                parts.push(`💠 +${peRestore} PE`);
              }
              if (pvtRestore > 0) {
                charStore.applyShield(target.id, pvtRestore);
                parts.push(`🛡️ +${pvtRestore} PVT`);
              }
              if (parts.length > 0) {
                logStore.addLog(
                  'system',
                  `🍽️ ${target.name} consumiu "${item.name}" — ${parts.join(', ')}.`,
                );
              }
            }
          }
        }
        set((state) => ({
          items: state.items
            .map((i) => {
              if (i.id !== id) return i;
              const newQty = (i.quantity || 1) - 1;
              if (newQty <= 0) return null as any;
              return { ...i, quantity: newQty };
            })
            .filter(Boolean),
        }));
        return true;
      },
      resetAll: () => set({ items: [] }),
    }),
    { name: 'rpg-items' }
  )
);
