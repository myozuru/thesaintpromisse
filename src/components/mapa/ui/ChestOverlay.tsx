/**
 * ChestOverlay — botão "Abrir Baú" + diálogo de saque para tokens vinculados a um Baú.
 *
 * Aparece quando exatamente 1 token selecionado tem `chestId` definido e:
 *  - o usuário é mestre, OU
 *  - existe um token do jogador a até 1.5 células de distância (borda-a-borda).
 *
 * Clicar abre um diálogo com os itens do baú; jogador entrega ao seu personagem,
 * mestre pode escolher o destinatário.
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Package, X, Send, Unlock } from 'lucide-react';
import { LockSprite, KeySprite } from '@/components/baus/LockSprite';

import { useMapStore } from '@/stores/useMapStore';
import { useChestStore } from '@/stores/useChestStore';
import { useItemStore } from '@/stores/useItemStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useLogStore } from '@/stores/useLogStore';
import { entityAABB } from '../EntityEngine';
import { toast } from '@/hooks/use-toast';
import type { Item } from '@/types';
import type { EntidadeOmni, OmniSlotType } from '@/lib/omni/tipos';

const CHEST_RANGE_CELLS = 1;


function itemToOmniEntity(item: Item): EntidadeOmni {
  const now = Date.now();
  return {
    id: item.id,
    versao: 1,
    nome: item.name,
    categoria: 'item',
    descricao: item.description,
    tags: item.category ? [item.category] : [],
    duracao: { tipo: item.slotType && item.slotType !== 'nenhum' ? 'permanente' : 'instantaneo' },
    custos: [],
    gatilhos: [],
    slotType: (item.slotType as OmniSlotType) ?? 'nenhum',
    bonusEquipado: {
      hp: item.bonusHP || undefined,
      pe: item.bonusPE || undefined,
      ca: item.bonusCA || undefined,
      rd: item.bonusRD || undefined,
      esc: item.bonusESC || undefined,
      slots: item.bonusSlots || undefined,
    },
    comercio: { basePrice: item.cost || 0, hiddenTags: [], isBought: false },
    criadoEm: now,
    atualizadoEm: now,
  };
}

export function ChestOverlay() {
  const entities = useMapStore((s) => s.entities);
  const chestsRecord = useChestStore((s) => s.chests);

  const chestEntities = Object.values(entities).filter(
    (e) => e.chestId && chestsRecord[e.chestId],
  );
  if (chestEntities.length === 0) return null;

  return (
    <>
      {chestEntities.map((ent) => (
        <SingleChestOverlay key={ent.id} entityId={ent.id} />
      ))}
    </>
  );
}

function SingleChestOverlay({ entityId }: { entityId: string }) {
  const ent = useMapStore((s) => s.entities[entityId]);
  const camera = useMapStore((s) => s.camera);
  const gridConfig = useMapStore((s) => s.gridConfig);
  const entities = useMapStore((s) => s.entities);

  const chestsRecord = useChestStore((s) => s.chests);
  const removeChestItem = useChestStore((s) => s.removeItem);
  const setItemQuantity = useChestStore((s) => s.setItemQuantity);
  const clearChest = useChestStore((s) => s.clearChest);
  const updateChest = useChestStore((s) => s.updateChest);

  const items = useItemStore((s) => s.items);
  const omniEntities = useOmniEntidadesStore((s) => s.entidades);
  const inventoryAdd = useInventoryStore((s) => s.add);
  const inventoryItems = useInventoryStore((s) => s.items);
  const inventoryRemove = useInventoryStore((s) => s.remove);
  const characters = useCharacterStore((s) => s.characters);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const isMaster = useRoleStore((s) => s.role) !== 'PLAYER';
  const addLog = useLogStore((s) => s.addLog);

  const [open, setOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  if (!ent || !ent.chestId) return null;
  if (ent.hidden && !isMaster) return null;
  const chest = chestsRecord[ent.chestId];
  if (!chest) return null;

  const dpi = gridConfig.dpi || 70;

  // Detecta tokens dentro do alcance (1.5 células do baú).
  const cx = ent.x;
  const cy = ent.y;
  const rChest = Math.max(ent.w, ent.h) / 2;
  const nearbyCharIds = new Set<string>();
  let nearestCharId: string | null = null;
  let bestCells = Infinity;
  for (const e of Object.values(entities)) {
    if (e.id === ent.id) continue;
    if (!e.characterId) continue;
    const ownedByMe = !activeProfileId || e.ownerProfileId === activeProfileId;
    if (!ownedByMe && !isMaster) continue;
    const r = Math.max(e.w, e.h) / 2;
    const edge = Math.max(0, Math.hypot(e.x - cx, e.y - cy) - r - rChest);
    const cells = edge / dpi;
    if (cells <= CHEST_RANGE_CELLS) nearbyCharIds.add(e.characterId);
    if (cells < bestCells) {
      bestCells = cells;
      nearestCharId = e.characterId;
    }
  }
  const inRange = bestCells <= CHEST_RANGE_CELLS;
  const canOpen = isMaster || inRange;
  if (!canOpen) return null;

  const aabb = entityAABB(ent);
  const screenX = ((aabb.x + aabb.x2) / 2 + camera.x) * camera.scale;
  const screenY = (aabb.y2 + camera.y) * camera.scale;

  const itemMap = new Map(items.map((i) => [i.id, i] as const));

  // IDs de personagens que pertencem ao perfil ativo (válidos como destinatário p/ jogadores).
  const ownedCharIds = new Set<string>();
  for (const e of Object.values(entities)) {
    if (!e.characterId) continue;
    if (!activeProfileId || e.ownerProfileId === activeProfileId) {
      ownedCharIds.add(e.characterId);
    }
  }
  const canDeliverTo = (receiverId: string) =>
    isMaster || ownedCharIds.has(receiverId);

  const deliverSingle = (itemId: string, qty: number, receiverId: string) => {
    if (!canDeliverTo(receiverId)) {
      toast({ title: 'Bloqueado', description: 'Só é possível entregar a um personagem seu.' });
      return;
    }
    const ch = characters.find((c) => c.id === receiverId);
    const it = itemMap.get(itemId);
    if (!ch || !it) return;
    const e = omniEntities[it.id] ?? itemToOmniEntity(it);
    for (let i = 0; i < qty; i++) inventoryAdd(ch.id, e);
    removeChestItem(chest.id, itemId);
    addLog('system', `📦 "${it.name}" x${qty} retirado do baú "${chest.name}" por ${ch.name}.`);
    toast({ title: 'Item retirado', description: `${it.name} x${qty} → ${ch.name}` });
  };

  const takeAll = (receiverId: string) => {
    if (!canDeliverTo(receiverId)) {
      toast({ title: 'Bloqueado', description: 'Só é possível entregar a um personagem seu.' });
      return;
    }
    const ch = characters.find((c) => c.id === receiverId);
    if (!ch) return;
    let n = 0;
    for (const entry of chest.entries) {
      const it = itemMap.get(entry.itemId);
      if (!it) continue;
      const e = omniEntities[it.id] ?? itemToOmniEntity(it);
      for (let i = 0; i < entry.quantity; i++) { inventoryAdd(ch.id, e); n++; }
    }
    if (n === 0) { toast({ title: 'Baú vazio' }); return; }
    clearChest(chest.id);
    addLog('system', `📦 Baú "${chest.name}" saqueado por ${ch.name} (${n} item(ns)).`);
    toast({ title: 'Baú saqueado', description: `${n} item(ns) → ${ch.name}` });
    setOpen(false);
  };

  // Procura a chave em QUALQUER personagem dentro do alcance (1.5 células).
  // Mestre pode usar chave de qualquer personagem.
  const keyInstance = chest.keyItemId
    ? Object.values(inventoryItems).find((inv) => {
        if (inv.entity?.id !== chest.keyItemId) return false;
        if (isMaster) return true;
        return inv.ownerId ? nearbyCharIds.has(inv.ownerId) : false;
      })
    : null;


  const finalizeUnlock = () => {
    if (!chest.locked) return;
    if (isMaster) {
      updateChest(chest.id, { locked: false });
      const keyName = chest.keyItemId ? items.find((i) => i.id === chest.keyItemId)?.name : null;
      addLog('system', `🔓 Mestre destrancou o baú "${chest.name}"${keyName ? ` (chave: ${keyName})` : ''}.`);
      toast({ title: 'Baú destrancado' });
      return;
    }
    if (!keyInstance) return;
    updateChest(chest.id, { locked: false });
    const charName = characters.find((c) => c.id === keyInstance.ownerId)?.name ?? 'Personagem';
    const keyName = items.find((i) => i.id === chest.keyItemId)?.name ?? 'chave';
    if (chest.consumeKey) {
      inventoryRemove(keyInstance.instanceId);
      addLog('system', `🔓 ${charName} destrancou o baú "${chest.name}" consumindo "${keyName}".`);
    } else {
      addLog('system', `🔓 ${charName} destrancou o baú "${chest.name}" usando "${keyName}".`);
    }
    toast({ title: 'Destrancado', description: `${charName} usou ${keyName}.` });
  };

  const tryUnlock = () => {
    if (!chest.locked || unlocking) return;
    if (!isMaster) {
      if (!chest.keyItemId) {
        toast({ title: 'Trancado', description: 'Apenas o mestre pode destrancar este baú.' });
        return;
      }
      if (!keyInstance) {
        const keyName = items.find((i) => i.id === chest.keyItemId)?.name ?? 'chave';
        toast({ title: 'Trancado', description: `Você precisa de: ${keyName}.` });
        return;
      }
    }
    // Toca a animação; o store é atualizado no onDone.
    setUnlocking(true);
  };

  const locked = !!chest.locked;
  const keyName = chest.keyItemId ? items.find((i) => i.id === chest.keyItemId)?.name : null;

  return (
    <>
      <div
        className="absolute z-40 pointer-events-auto flex flex-col items-center gap-1"
        style={{ left: screenX, top: screenY + 8, transform: 'translateX(-50%)' }}
      >
        {locked ? (
          <button
            onClick={tryUnlock}
            disabled={unlocking}
            className="flex items-center gap-2 rounded-md border border-amber-700/60 bg-black/80 px-3 py-1.5 text-xs font-semibold text-amber-200 shadow-2xl hover:bg-amber-900/40 disabled:opacity-90 disabled:cursor-default"
            title={keyName ? `Trancado — chave: ${keyName}` : 'Trancado'}
          >
            <LockSprite
              id={chest.lockSpriteId}
              play={unlocking}
              scale={1.1}
              onDone={finalizeUnlock}
            />
            <span className="flex flex-col items-start leading-tight">
              <span>{unlocking ? 'Destrancando…' : 'Destrancar'}</span>
              {keyName && (
                <span className="text-[10px] text-amber-300/70 inline-flex items-center gap-1">
                  <KeySprite id={chest.keySpriteId} scale={0.9} />
                  {keyName}
                </span>
              )}
            </span>
          </button>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-amber-700/60 bg-black/80 px-3 py-1.5 text-xs font-semibold text-amber-200 shadow-2xl hover:bg-amber-900/40"
          >
            <Unlock className="h-3.5 w-3.5" />
            Vasculhar
          </button>
        )}
      </div>


      {open && createPortal(
        <ChestDialog
          chestName={chest.name}
          entries={chest.entries}
          itemMap={itemMap}
          isMaster={isMaster}
          characters={characters}
          allowedReceiverIds={isMaster ? null : ownedCharIds}
          defaultReceiverId={
            nearestCharId && (isMaster || ownedCharIds.has(nearestCharId))
              ? nearestCharId
              : null
          }
          onClose={() => setOpen(false)}
          onTake={deliverSingle}
          onTakeAll={takeAll}
          onSetQty={(id, q) => setItemQuantity(chest.id, id, q)}
        />,
        document.body,
      )}
    </>
  );
}

function ChestDialog({
  chestName, entries, itemMap, isMaster, characters,
  defaultReceiverId, allowedReceiverIds, onClose, onTake, onTakeAll, onSetQty,
}: {
  chestName: string;
  entries: { itemId: string; quantity: number }[];
  itemMap: Map<string, Item>;
  isMaster: boolean;
  characters: ReturnType<typeof useCharacterStore.getState>['characters'];
  defaultReceiverId: string | null;
  allowedReceiverIds: Set<string> | null;
  onClose: () => void;
  onTake: (itemId: string, qty: number, receiverId: string) => void;
  onTakeAll: (receiverId: string) => void;
  onSetQty: (itemId: string, qty: number) => void;
}) {
  const [receiverId, setReceiverId] = useState<string>(defaultReceiverId ?? '');
  const receivers = useMemo(() => {
    if (!allowedReceiverIds) return characters;
    return characters.filter((c) => allowedReceiverIds.has(c.id));
  }, [characters, allowedReceiverIds]);
  useEffect(() => {
    if (!receiverId && receivers.length > 0) setReceiverId(receivers[0].id);
  }, [receivers, receiverId]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-card shadow-2xl card-enigmatic"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{chestName}</h3>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {isMaster ? (
              <>
                <span className="text-xs text-muted-foreground">Entregar a:</span>
                <select
                  value={receiverId}
                  onChange={(e) => setReceiverId(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                >
                  <option value="">— Selecione —</option>
                  {receivers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </>
            ) : receivers.length > 1 ? (
              <>
                <span className="text-xs text-muted-foreground">Para:</span>
                <select
                  value={receiverId}
                  onChange={(e) => setReceiverId(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                >
                  {receivers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </>
            ) : null}
            {entries.length > 0 && receiverId && (
              <button
                onClick={() => onTakeAll(receiverId)}
                className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Pegar tudo
              </button>
            )}
          </div>

          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-8">Baú vazio.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
              {entries.map((entry) => {
                const it = itemMap.get(entry.itemId);
                return (
                  <div
                    key={entry.itemId}
                    className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/30 px-2 py-1.5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {it?.name ?? <span className="italic text-destructive">Item removido</span>}
                      </div>
                      {it?.description && (
                        <div className="text-[11px] text-muted-foreground truncate">{it.description}</div>
                      )}
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">x{entry.quantity}</span>
                    {isMaster && (
                      <button
                        onClick={() => onSetQty(entry.itemId, entry.quantity - 1)}
                        className="rounded bg-secondary px-1.5 py-0.5 text-xs hover:bg-secondary/80"
                        title="Diminuir (mestre)"
                      >−</button>
                    )}
                    {it && receiverId && (
                      <button
                        onClick={() => onTake(entry.itemId, 1, receiverId)}
                        className="rounded p-1.5 text-primary hover:bg-primary/15"
                        title="Pegar 1"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
