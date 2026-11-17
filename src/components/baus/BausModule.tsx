import { useId, useMemo, useRef, useState } from 'react';
import { Archive, Plus, Trash2, ChevronRight, X, PackagePlus, PackageOpen, Send, Pencil, Check, Lock, Unlock, Key } from 'lucide-react';
import { LockSprite, KeySprite, LockSpritePicker, KeySpritePicker } from './LockSprite';
import { ModuleHeader } from '@/components/ui/module-header';
import { SearchInput } from '@/components/ui/search-input';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const createButtonRef = useRef<HTMLButtonElement | null>(null);

  const chests = useMemo(
    () => Object.values(chestsRecord).sort((a, b) => b.updatedAt - a.updatedAt),
    [chestsRecord],
  );
  const sLower = search.trim().toLowerCase();
  const filtered = sLower
    ? chests.filter((c) => c.name.toLowerCase().includes(sLower) || (c.description ?? '').toLowerCase().includes(sLower))
    : chests;

  return (
    <div className="space-y-5">
      <ModuleHeader
        icon={Archive}
        title="Baús"
        subtitle={`(${chests.length})`}
        description="Crie baús, guarde itens e entregue-os aos jogadores."
        actions={
          <button
            ref={createButtonRef}
            onClick={(event) => {
              returnFocusRef.current = event.currentTarget;
              const c = createChest();
              setExpanded(c.id);
              playClickSound();
            }}
            className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 glow-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <Plus className="h-4 w-4" /> Criar Baú
          </button>
        }
      />

      <div className="flex flex-col gap-3 border-y border-border/55 py-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Buscar baú por nome..."
          containerClassName="w-full sm:max-w-xl"
        />
        <span className="shrink-0 font-mono text-base text-muted-foreground">
          {filtered.length} de {chests.length} baús
        </span>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {filtered.map((c) => (
          <ChestCard
            key={c.id}
            chestId={c.id}
            expanded={expanded === c.id}
            returnFocusRef={returnFocusRef}
            createButtonRef={createButtonRef}
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
      {chests.length > 0 && filtered.length === 0 && (
        <div className="rounded-lg border border-border/70 bg-card/60 px-5 py-8 text-center text-sm text-muted-foreground">
          Nenhum baú corresponde à busca. Ajuste o nome ou a descrição.
        </div>
      )}
    </div>
  );
}

function ChestCard({
  chestId,
  expanded,
  returnFocusRef,
  createButtonRef,
  onToggle,
  onRemove,
}: {
  chestId: string;
  expanded: boolean;
  returnFocusRef: { current: HTMLButtonElement | null };
  createButtonRef: { current: HTMLButtonElement | null };
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
  const descriptionId = useId();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(chest?.name ?? '');
  const [addSearch, setAddSearch] = useState('');
  const [deliverTo, setDeliverTo] = useState<string>('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

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
    setSelectedItemIds([]);
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
    setSelectedItemIds((current) => current.filter((id) => id !== itemId));
    addLog('system', `📦 "${item.name}" x${quantity} entregue a ${char.name} (do baú "${chest.name}").`);
    toast({ title: 'Item entregue', description: `${item.name} x${quantity} → ${char.name}` });
    playClickSound();
  };

  const selectedEntries = chest.entries.filter(
    (entry) => selectedItemIds.includes(entry.itemId) && itemMap.has(entry.itemId),
  );

  const toggleSelectedItem = (itemId: string) => {
    setSelectedItemIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  };

  const deliverSelected = () => {
    if (!deliverTo) {
      toast({ title: 'Selecione um personagem', variant: 'destructive' as never });
      return;
    }
    if (!characters.some((character) => character.id === deliverTo)) return;
    for (const entry of selectedEntries) deliverSingle(entry.itemId, entry.quantity);
    setSelectedItemIds([]);
  };

  return (
    <Sheet
      open={expanded}
      onOpenChange={(open) => {
        if (open !== expanded) {
          if (!open) {
            setNameDraft(chest.name);
            setEditingName(false);
          }
          onToggle();
        }
      }}
    >
    <div className={cn('group min-w-0 overflow-hidden rounded-xl border border-border/80 card-enigmatic transition-[border-color,box-shadow,transform] duration-200 hover:border-primary/35 hover:shadow-mystic', expanded && 'border-primary/40 shadow-mystic')}>
      <div className="flex min-h-16 items-center gap-2 border-b border-border/45 bg-background/15 px-4 py-3">
        {editingName ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Archive className="h-4 w-4 shrink-0 text-primary" />
            <Input
              aria-label="Nome do baú"
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
              className="h-10 flex-1 text-base"
            />
            <button
              type="button"
              aria-label="Salvar nome do baú"
              onClick={commitName}
              className="flex h-10 w-10 items-center justify-center rounded-md text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              title="Salvar"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <SheetTrigger asChild>
          <button
            type="button"
            onClick={(event) => {
              returnFocusRef.current = event.currentTarget;
            }}
            aria-label={`Abrir detalhes do baú ${chest.name}: ${chest.entries.length} tipo(s), ${totalCount} item(ns)`}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70"
          >
            <Archive className="h-4 w-4 shrink-0 text-primary" />
            {chest.locked && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-1 font-mono text-xs text-accent" aria-label="Baú trancado">
                <Lock className="h-3.5 w-3.5" /> Trancado
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-foreground">{chest.name}</span>
              <span className="block font-mono text-xs text-muted-foreground">
                {chest.entries.length} tipo(s) • {totalCount} item(ns)
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
          </SheetTrigger>
        )}
        {!editingName && (
          <button
            type="button"
            aria-label={'Renomear baú ' + chest.name}
            onClick={() => {
              setNameDraft(chest.name);
              setEditingName(true);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            title="Renomear"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          aria-label={'Excluir baú ' + chest.name}
          onClick={() => {
            if (confirm(`Excluir baú "${chest.name}"?`)) onRemove();
          }}
            className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          title="Excluir baú"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

    </div>
    <SheetContent
      side="right"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        requestAnimationFrame(() => {
          if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
          else createButtonRef.current?.focus();
        });
      }}
      className="flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden border-l border-border/80 bg-card p-0 sm:max-w-[440px]"
    >
      <SheetHeader className="shrink-0 border-b border-border/70 bg-card/95 px-5 py-4 pr-14 text-left">
        <div className="flex items-center justify-between gap-3">
          <SheetTitle className="min-w-0 truncate">{chest.name}</SheetTitle>
          {!editingName && (
            <button
              type="button"
              aria-label={`Renomear baú ${chest.name}`}
              onClick={() => {
                setNameDraft(chest.name);
                setEditingName(true);
              }}
              className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-border/70 px-3 text-base text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              <span>Renomear</span>
            </button>
          )}
        </div>
        {editingName && (
          <div className="flex items-center gap-2">
            <Input
              aria-label="Nome do baú"
              autoFocus
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitName();
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  setNameDraft(chest.name);
                  setEditingName(false);
                }
              }}
              className="h-10 min-w-0 flex-1 text-base"
            />
            <button
              type="button"
              aria-label="Salvar nome do baú"
              onClick={commitName}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Cancelar edição do nome do baú"
              onClick={() => {
                setNameDraft(chest.name);
                setEditingName(false);
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <SheetDescription>
          {chest.entries.length} tipo(s) • {totalCount} item(ns) no baú.
        </SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-base">
          <div className="space-y-4">
            {/* Descrição */}
            <div className="min-w-0 space-y-2 border-b border-border/70 pb-4">
              <label htmlFor={`${descriptionId}-description`} className="block text-base font-semibold text-foreground">Descrição</label>
              <textarea
                id={`${descriptionId}-description`}
                value={chest.description ?? ''}
                onChange={(e) => updateChest(chest.id, { description: e.target.value })}
                placeholder="Notas internas sobre o baú (visíveis apenas ao mestre)."
                rows={2}
                className="min-h-24 w-full resize-none rounded-md border border-border bg-background/60 px-3 py-2 text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
            </div>

            {/* Tranca / chave */}
            <div className="min-w-0 space-y-3 border-b border-accent/25 pb-4">
              <h4 className="flex items-center gap-1.5 text-base font-semibold text-accent">
                {chest.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                Tranca
              </h4>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-base text-foreground">
                  <input
                    type="checkbox"
                    checked={!!chest.locked}
                    onChange={(e) => updateChest(chest.id, { locked: e.target.checked })}
                  />
                  Trancado
                </label>
                <div className="flex items-center gap-2">
                  <LockSprite id={chest.lockSpriteId} scale={1.4} />
                  {chest.keyItemId && <KeySprite id={chest.keySpriteId} scale={1.2} />}
                </div>
                <label htmlFor={`${descriptionId}-key`} className="inline-flex min-h-10 items-center gap-1 text-base text-muted-foreground">
                  <Key className="h-3 w-3" /> Chave:
                </label>
                <select
                  id={`${descriptionId}-key`}
                  value={chest.keyItemId ?? ''}
                  onChange={(e) => updateChest(chest.id, { keyItemId: e.target.value || undefined })}
                  aria-label="Item usado como chave"
                  className="h-10 min-w-0 max-w-full flex-1 rounded-md border border-border bg-background px-3 text-base text-foreground sm:max-w-[240px]"
                >
                  <option value="">— Sem chave —</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </select>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-base text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={!!chest.consumeKey}
                    onChange={(e) => updateChest(chest.id, { consumeKey: e.target.checked })}
                  />
                  Consumir ao destrancar
                </label>
              </div>

              <div className="space-y-1.5">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Cadeado (visual)</p>
                <LockSpritePicker
                  value={chest.lockSpriteId}
                  onChange={(id) => updateChest(chest.id, { lockSpriteId: id })}
                />
              </div>
              <div className="space-y-1.5">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Chave (visual)</p>
                <KeySpritePicker
                  value={chest.keySpriteId}
                  onChange={(id) => updateChest(chest.id, { keySpriteId: id })}
                />
              </div>

              <p className="text-sm text-muted-foreground italic">
                Se trancado e sem chave definida, apenas o mestre pode destrancar.
              </p>
            </div>


            <div className="min-w-0 space-y-3 border-b border-border/70 pb-4">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-base font-semibold text-foreground">
                <PackageOpen className="h-3 w-3" /> Conteúdo
              </h4>
              {chest.entries.length === 0 ? (
                <p className="text-base text-muted-foreground italic">Baú vazio.</p>
              ) : (
                <div className="space-y-1.5">
                  {chest.entries.map((entry) => {
                    const item = itemMap.get(entry.itemId);
                    return (
                      <div
                        key={entry.itemId}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors',
                          selectedItemIds.includes(entry.itemId)
                            ? 'border-primary/45 bg-primary/10'
                            : 'border-border/60 bg-secondary/30',
                        )}
                      >
                        <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-primary/10 focus-within:ring-2 focus-within:ring-primary/70">
                          <input
                            type="checkbox"
                            checked={selectedItemIds.includes(entry.itemId)}
                            disabled={!item}
                            aria-label={item ? `Selecionar ${item.name} para entrega` : 'Item removido do banco; não pode ser entregue'}
                            onChange={() => toggleSelectedItem(entry.itemId)}
                          />
                        </label>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {item?.name ?? <span className="italic text-destructive">Item removido</span>}
                          </div>
                          {item?.description && (
                            <div className="text-sm text-muted-foreground truncate">{item.description}</div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Diminuir quantidade de ${item?.name ?? 'item removido'}`}
                            onClick={() => setItemQuantity(chest.id, entry.itemId, entry.quantity - 1)}
                            className="flex h-10 w-10 items-center justify-center rounded-md border border-border/60 bg-secondary text-base hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
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
                            aria-label={`Quantidade de ${item?.name ?? 'item removido'} no baú`}
                            className="h-10 w-14 text-center text-base"
                          />
                          <button
                            type="button"
                            aria-label={`Aumentar quantidade de ${item?.name ?? 'item removido'}`}
                            onClick={() => setItemQuantity(chest.id, entry.itemId, entry.quantity + 1)}
                            className="flex h-10 w-10 items-center justify-center rounded-md border border-border/60 bg-secondary text-base hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                            title="Aumentar"
                          >
                            +
                          </button>
                        </div>
                        {item && deliverTo && (
                          <button
                            type="button"
                            aria-label={`Entregar ${item.name} ao personagem selecionado`}
                            onClick={() => deliverSingle(entry.itemId, entry.quantity)}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-primary hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                            title="Entregar este item ao personagem selecionado"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`Remover ${item?.name ?? 'item removido'} do baú`}
                          onClick={() => {
                            removeItem(chest.id, entry.itemId);
                            setSelectedItemIds((current) => current.filter((id) => id !== entry.itemId));
                          }}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
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
            <div className="min-w-0 space-y-3 border-b border-border/70 pb-4">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-base font-semibold text-foreground">
                <PackagePlus className="h-3 w-3" /> Adicionar do banco de itens
              </h4>
              {items.length === 0 ? (
                <p className="text-base text-muted-foreground italic">
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
                      <p className="text-base text-muted-foreground italic">Nenhum item disponível.</p>
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
                              <div className="text-base text-muted-foreground truncate">{it.description}</div>
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
            <div className="min-w-0 space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <h4 className="flex items-center gap-1.5 text-base font-semibold text-primary">
                <Send className="h-3 w-3" /> Entregar a um Personagem
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={deliverTo}
                  onChange={(e) => setDeliverTo(e.target.value)}
                  aria-label="Personagem que receberá os itens"
                  className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
                >
                  <option value="">— Selecione —</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="flex w-full flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={deliverSelected}
                    disabled={!deliverTo || selectedEntries.length === 0}
                    className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-primary/45 bg-primary/10 px-3 py-2 text-base font-semibold text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    <Send className="h-4 w-4" />
                    Entregar {selectedEntries.length}{' '}
                    {selectedEntries.length === 1 ? 'tipo selecionado' : 'tipos selecionados'}
                  </button>
                  <button
                    type="button"
                    onClick={deliverAll}
                    disabled={!deliverTo || chest.entries.length === 0}
                    className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    <PackageOpen className="h-4 w-4" /> Entregar tudo
                  </button>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  Os itens selecionados são entregues com as quantidades indicadas. “Entregar tudo” esvazia o baú.
                </p>
              </div>
              {characters.length === 0 && (
                <p className="text-base text-muted-foreground italic">Nenhum personagem cadastrado.</p>
              )}
            </div>
          </div>
        </div>
    </SheetContent>
    </Sheet>
  );
}
