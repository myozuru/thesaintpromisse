import { useMemo, useState } from 'react';
import { Archive, Plus, Trash2, ChevronDown, X, PackagePlus, PackageOpen, Send, Pencil, Check, Lock, Unlock, Key } from 'lucide-react';
import { LockSprite, KeySprite, LockSpritePicker, KeySpritePicker } from './LockSprite';
import { ModuleHeader } from '@/components/ui/module-header';
import { SearchInput } from '@/components/ui/search-input';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { playClickSound, playToggleSound } from '@/lib/sounds';
import { useToast } from '@/hooks/use-toast';
import { useChestStore } from '@/stores/useChestStore';
import { useItemStore } from '@/stores/useItemStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import type { Item } from '@/types';
import type { EntidadeOmni, OmniSlotType } from '@/lib/omni/tipos';

/**
 * Reconstrói uma EntidadeOmni mínima a partir de um Item.
 * Usada quando o item não existe no banco do Omni (mesma estratégia do ItensModule).
 */
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

export function BausModule() {
  const chestsRecord = useChestStore((s) => s.chests);
  const createChest = useChestStore((s) => s.createChest);
  const removeChest = useChestStore((s) => s.removeChest);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const chests = useMemo(
    () => Object.values(chestsRecord).sort((a, b) => b.updatedAt - a.updatedAt),
    [chestsRecord],
  );
  const sLower = search.trim().toLowerCase();
  const filtered = sLower
    ? chests.filter((c) => c.name.toLowerCase().includes(sLower) || (c.description ?? '').toLowerCase().includes(sLower))
    : chests;

  return (
    <div className="space-y-4">
      <ModuleHeader
        icon={Archive}
        title="Baús"
        subtitle={`(${chests.length})`}
        description="Crie baús, guarde itens e entregue-os aos jogadores."
        actions={
          <button
            onClick={() => {
              const c = createChest();
              setExpanded(c.id);
              playClickSound();
            }}
            className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 glow-primary transition-all"
          >
            <Plus className="h-4 w-4" /> Criar Baú
          </button>
        }
      />

      <SearchInput
        value={search}
        onValueChange={setSearch}
        placeholder="Buscar baú por nome..."
        containerClassName="max-w-md"
      />

      <div className="space-y-2">
        {filtered.map((c) => (
          <ChestCard
            key={c.id}
            chestId={c.id}
            expanded={expanded === c.id}
            onToggle={() => {
              setExpanded(expanded === c.id ? null : c.id);
              playToggleSound();
            }}
            onRemove={() => removeChest(c.id)}
          />
        ))}
      </div>

      {chests.length === 0 && (
        <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12 card-enigmatic">
          <p className="text-muted-foreground italic text-sm">
            Nenhum baú criado. Clique em "Criar Baú" para começar.
          </p>
        </div>
      )}
    </div>
  );
}

function ChestCard({
  chestId,
  expanded,
  onToggle,
  onRemove,
}: {
  chestId: string;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const chest = useChestStore((s) => s.chests[chestId]);
  const updateChest = useChestStore((s) => s.updateChest);
  const addItem = useChestStore((s) => s.addItem);
  const setItemQuantity = useChestStore((s) => s.setItemQuantity);
  const removeItem = useChestStore((s) => s.removeItem);
  const clearChest = useChestStore((s) => s.clearChest);
  const items = useItemStore((s) => s.items);
  const inventoryAdd = useInventoryStore((s) => s.add);
  const omniEntities = useOmniEntidadesStore((s) => s.entidades);
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);
  const { toast } = useToast();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(chest?.name ?? '');
  const [addSearch, setAddSearch] = useState('');
  const [deliverTo, setDeliverTo] = useState<string>('');

  const totalCount = useMemo(
    () => (chest?.entries ?? []).reduce((s, e) => s + e.quantity, 0),
    [chest?.entries],
  );

  if (!chest) return null;

  const itemMap = new Map(items.map((i) => [i.id, i] as const));
  const addSearchLower = addSearch.trim().toLowerCase();
  const availableToAdd = items.filter(
    (i) =>
      !chest.entries.some((e) => e.itemId === i.id) &&
      (addSearchLower
        ? i.name.toLowerCase().includes(addSearchLower) || (i.description ?? '').toLowerCase().includes(addSearchLower)
        : true),
  );

  const commitName = () => {
    const next = nameDraft.trim() || 'Baú sem nome';
    updateChest(chest.id, { name: next });
    setEditingName(false);
  };

  const deliverAll = () => {
    if (!deliverTo) {
      toast({ title: 'Selecione um personagem', variant: 'destructive' as never });
      return;
    }
    const char = characters.find((c) => c.id === deliverTo);
    if (!char) return;
    let delivered = 0;
    for (const entry of chest.entries) {
      const item = itemMap.get(entry.itemId);
      if (!item) continue;
      const ent = omniEntities[item.id] ?? itemToOmniEntity(item);
      for (let i = 0; i < entry.quantity; i++) {
        inventoryAdd(char.id, ent);
        delivered++;
      }
    }
    if (delivered === 0) {
      toast({ title: 'Baú vazio', description: 'Adicione itens antes de entregar.' });
      return;
    }
    clearChest(chest.id);
    addLog('system', `📦 Baú "${chest.name}" entregue a ${char.name} (${delivered} item(ns)).`);
    toast({ title: 'Baú entregue', description: `${delivered} item(ns) → ${char.name}` });
    playClickSound();
  };

  const deliverSingle = (itemId: string, quantity: number) => {
    if (!deliverTo) {
      toast({ title: 'Selecione um personagem' });
      return;
    }
    const char = characters.find((c) => c.id === deliverTo);
    const item = itemMap.get(itemId);
    if (!char || !item) return;
    const ent = omniEntities[item.id] ?? itemToOmniEntity(item);
    for (let i = 0; i < quantity; i++) inventoryAdd(char.id, ent);
    removeItem(chest.id, itemId);
    addLog('system', `📦 "${item.name}" x${quantity} entregue a ${char.name} (do baú "${chest.name}").`);
    toast({ title: 'Item entregue', description: `${item.name} x${quantity} → ${char.name}` });
    playClickSound();
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden card-enigmatic">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={onToggle}
          className="flex flex-1 min-w-0 items-center gap-3 text-left"
        >
          <Archive className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitName();
                    if (e.key === 'Escape') {
                      setNameDraft(chest.name);
                      setEditingName(false);
                    }
                  }}
                  className="h-7 text-sm"
                />
                <button
                  onClick={commitName}
                  className="rounded p-1 text-primary hover:bg-primary/10"
                  title="Salvar"
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="font-semibold text-foreground truncate text-sm">{chest.name}</div>
            )}
            <div className="text-xs text-muted-foreground">
              {chest.entries.length} tipo(s) • {totalCount} item(ns)
            </div>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-300',
              expanded && 'rotate-180',
            )}
          />
        </button>
        {!editingName && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setNameDraft(chest.name);
              setEditingName(true);
            }}
            className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            title="Renomear"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Excluir baú "${chest.name}"?`)) onRemove();
          }}
          className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/15"
          title="Excluir baú"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr', opacity: expanded ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/50 px-4 py-3 space-y-4 text-sm">
            {/* Descrição */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Descrição</label>
              <textarea
                value={chest.description ?? ''}
                onChange={(e) => updateChest(chest.id, { description: e.target.value })}
                placeholder="Notas internas sobre o baú (visíveis apenas ao mestre)."
                rows={2}
                className="w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
            </div>

            {/* Tranca / chave */}
            <div className="rounded-md border border-amber-700/30 bg-amber-900/5 p-3 space-y-3">
              <h4 className="text-xs font-semibold text-amber-300/90 flex items-center gap-1.5">
                {chest.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                Tranca
              </h4>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!chest.locked}
                    onChange={(e) => updateChest(chest.id, { locked: e.target.checked })}
                    className="accent-amber-500"
                  />
                  Trancado
                </label>
                <div className="flex items-center gap-2">
                  <LockSprite id={chest.lockSpriteId} scale={1.4} />
                  {chest.keyItemId && <KeySprite id={chest.keySpriteId} scale={1.2} />}
                </div>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Key className="h-3 w-3" /> Chave:
                </span>
                <select
                  value={chest.keyItemId ?? ''}
                  onChange={(e) => updateChest(chest.id, { keyItemId: e.target.value || undefined })}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground max-w-[200px]"
                >
                  <option value="">— Sem chave —</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!chest.consumeKey}
                    onChange={(e) => updateChest(chest.id, { consumeKey: e.target.checked })}
                    className="accent-amber-500"
                  />
                  Consumir ao destrancar
                </label>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Cadeado (visual)</p>
                <LockSpritePicker
                  value={chest.lockSpriteId}
                  onChange={(id) => updateChest(chest.id, { lockSpriteId: id })}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Chave (visual)</p>
                <KeySpritePicker
                  value={chest.keySpriteId}
                  onChange={(id) => updateChest(chest.id, { keySpriteId: id })}
                />
              </div>

              <p className="text-[11px] text-muted-foreground italic">
                Se trancado e sem chave definida, apenas o mestre pode destrancar.
              </p>
            </div>


            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <PackageOpen className="h-3 w-3" /> Conteúdo
              </h4>
              {chest.entries.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Baú vazio.</p>
              ) : (
                <div className="space-y-1.5">
                  {chest.entries.map((entry) => {
                    const item = itemMap.get(entry.itemId);
                    return (
                      <div
                        key={entry.itemId}
                        className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/30 px-2 py-1.5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {item?.name ?? <span className="italic text-destructive">Item removido</span>}
                          </div>
                          {item?.description && (
                            <div className="text-[11px] text-muted-foreground truncate">{item.description}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setItemQuantity(chest.id, entry.itemId, entry.quantity - 1)}
                            className="rounded bg-secondary px-1.5 py-0.5 text-xs hover:bg-secondary/80"
                            title="Diminuir"
                          >
                            −
                          </button>
                          <Input
                            type="number"
                            min={1}
                            value={entry.quantity}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!Number.isNaN(v)) setItemQuantity(chest.id, entry.itemId, v);
                            }}
                            className="h-7 w-14 text-center text-sm"
                          />
                          <button
                            onClick={() => setItemQuantity(chest.id, entry.itemId, entry.quantity + 1)}
                            className="rounded bg-secondary px-1.5 py-0.5 text-xs hover:bg-secondary/80"
                            title="Aumentar"
                          >
                            +
                          </button>
                        </div>
                        {item && deliverTo && (
                          <button
                            onClick={() => deliverSingle(entry.itemId, entry.quantity)}
                            className="rounded p-1.5 text-primary hover:bg-primary/15"
                            title="Entregar este item ao personagem selecionado"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => removeItem(chest.id, entry.itemId)}
                          className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/15"
                          title="Remover do baú"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Adicionar itens */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <PackagePlus className="h-3 w-3" /> Adicionar do banco de itens
              </h4>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum item no banco. Crie itens em "Itens" primeiro.
                </p>
              ) : (
                <>
                  <SearchInput
                    value={addSearch}
                    onValueChange={setAddSearch}
                    placeholder="Buscar item para adicionar..."
                    containerClassName="mb-2"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {availableToAdd.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Nenhum item disponível.</p>
                    ) : (
                      availableToAdd.map((it) => (
                        <button
                          key={it.id}
                          onClick={() => {
                            addItem(chest.id, it.id, 1);
                            playClickSound();
                          }}
                          className="flex w-full items-center gap-2 rounded-md border border-border/50 bg-background/40 px-2 py-1.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors"
                        >
                          <Plus className="h-3 w-3 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-foreground truncate">{it.name}</div>
                            {it.description && (
                              <div className="text-[11px] text-muted-foreground truncate">{it.description}</div>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Entregar baú */}
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
              <h4 className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Send className="h-3 w-3" /> Entregar a um Personagem
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={deliverTo}
                  onChange={(e) => setDeliverTo(e.target.value)}
                  className="flex h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
                >
                  <option value="">— Selecione —</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={deliverAll}
                  disabled={!deliverTo || chest.entries.length === 0}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <PackageOpen className="h-4 w-4" /> Entregar tudo
                </button>
                <span className="text-[11px] text-muted-foreground italic">
                  Após entregar, o baú é esvaziado.
                </span>
              </div>
              {characters.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum personagem cadastrado.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
