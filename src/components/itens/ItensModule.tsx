import { useEffect, useId, useRef, useState } from 'react';
import { useItemStore } from '@/stores/useItemStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useLogStore } from '@/stores/useLogStore';
import { Item, ItemRollBonus, ItemSlotType, ITEM_SLOT_TYPES, ITEM_SLOT_LABELS, DAMAGE_TYPES, DAMAGE_TYPE_LABELS, DAMAGE_TYPE_ABBR, DamageType, createEmptyRdByType } from '@/types';
import type { EntidadeOmni, OmniSlotType } from '@/lib/omni/tipos';
import { NullSafeInput } from '../fichas/NullSafeInput';
import { DeleteConfirm } from '../fichas/DeleteConfirm';
import { Eye, EyeOff, ChevronDown, Plus, X, Link2, Unlink, Pencil, Minus, Swords, PackagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { playClickSound, playToggleSound } from '@/lib/sounds';
import { useToast } from '@/hooks/use-toast';
import { ModuleHeader } from '@/components/ui/module-header';
import { SearchInput } from '@/components/ui/search-input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

/**
 * Constrói uma EntidadeOmni mínima a partir de um Item criado no banco
 * (para itens que não vieram do Omni-Engine). Mantém os bônus equipáveis
 * para que o slot da ficha funcione como esperado.
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

const ITEM_CATEGORIES = [
  { value: 'nenhum' as ItemSlotType, label: 'Item (Geral)' },
  { value: 'colar' as ItemSlotType, label: 'Colar' },
  { value: 'anel' as ItemSlotType, label: 'Anel' },
  { value: 'pulseira' as ItemSlotType, label: 'Pulseira' },
];

export function ItensModule() {
  const { items, addItem, removeItem, updateItem, spendItem } = useItemStore();
  const characters = useCharacterStore((s) => s.characters);
  const [editMode, setEditMode] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [itemFormDirty, setItemFormDirty] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const editingItem = editingId ? items.find((item) => item.id === editingId) : undefined;
  const itemFormOpen = creating || editingId !== null;

  const closeItemForm = () => {
    setCreating(false);
    setEditingId(null);
    setItemFormDirty(false);
    setDiscardConfirmOpen(false);
  };

  const requestItemFormClose = () => {
    if (itemFormDirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    closeItemForm();
  };

  const searchLower = search.trim().toLowerCase();
  const filteredItems = searchLower
    ? items.filter((it) =>
        it.name.toLowerCase().includes(searchLower) ||
        (it.description ?? '').toLowerCase().includes(searchLower),
      )
    : items;

  const handleCreate = (item: Item) => {
    addItem(item);
    setExpandedId(item.id);
    closeItemForm();
  };

  const handleEditSave = (item: Item) => {
    updateItem(item.id, item);
    closeItemForm();
  };

  return (
    <Sheet
      open={itemFormOpen}
      onOpenChange={(open) => {
        if (!open) requestItemFormClose();
      }}
    >
      <div className="space-y-5">
      <ModuleHeader
        icon={Swords}
        title="Banco de Itens"
        subtitle={`(${items.length})`}
        description="Catálogo central de itens, equipamentos e consumíveis."
        actions={
          <>
            <button
              onClick={() => { setEditMode(!editMode); playClickSound(); }}
              aria-label={editMode ? 'Desativar edição de itens' : 'Ativar edição de itens'}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-background/35 text-muted-foreground transition-colors hover:border-primary/35 hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              title={editMode ? 'Modo visualização' : 'Modo edição'}
            >
              {editMode ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4" />}
            </button>
            {editMode && (
              <button
                ref={createButtonRef}
                onClick={(event) => {
                  returnFocusRef.current = event.currentTarget;
                  setEditingId(null);
                  setCreating(true);
                  playClickSound();
                }}
                className="flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 glow-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                <Plus className="h-4 w-4" /> Criar Item
              </button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-3 border-y border-border/55 py-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Buscar item por nome ou descrição..."
          containerClassName="w-full sm:max-w-xl"
        />
        <p className="shrink-0 font-mono text-sm text-muted-foreground">
          {filteredItems.length} de {items.length} itens
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2 2xl:grid-cols-3">
        {filteredItems.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            expanded={expandedId === item.id}
            onToggle={() => { setExpandedId(expandedId === item.id ? null : item.id); playToggleSound(); }}
            editMode={editMode}
            characters={characters}
            onUpdate={(updates) => updateItem(item.id, updates)}
            onRemove={() => removeItem(item.id)}
            onSpend={() => spendItem(item.id)}
            onEdit={(trigger) => {
              returnFocusRef.current = trigger;
              setCreating(false);
              setEditingId(item.id);
              playClickSound();
            }}
          />
        ))}
      </div>

      {items.length === 0 && (
        <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12 card-enigmatic">
          <p className="text-muted-foreground italic text-sm">
            {editMode ? 'Clique em "Criar Item" para começar.' : 'Nenhum item criado. Ative o modo edição (👁) para criar.'}
          </p>
        </div>
      )}

      {items.length > 0 && filteredItems.length === 0 && (
        <div className="rounded-lg border border-border/70 bg-card/60 px-5 py-8 text-center text-sm text-muted-foreground">
          Nenhum item corresponde à busca. Ajuste o nome ou a descrição.
        </div>
      )}
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
        className="flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden border-l border-border/80 bg-card p-0 sm:max-w-[520px]"
      >
        <SheetHeader className="shrink-0 border-b border-border/70 bg-card/95 px-5 py-4 pr-14 text-left">
          <SheetTitle>{editingItem ? 'Editar item' : 'Criar item'}</SheetTitle>
          <SheetDescription>
            Configure propriedades, efeitos e vínculos deste item.
          </SheetDescription>
        </SheetHeader>
        {(creating || editingItem) && (
          <ItemForm
            key={editingItem?.id ?? 'new-item'}
            characters={characters}
            onSave={editingItem ? handleEditSave : handleCreate}
            onCancel={requestItemFormClose}
            onDirtyChange={setItemFormDirty}
            initialItem={editingItem}
          />
        )}
      </SheetContent>
      <AlertDialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <AlertDialogContent className="card-enigmatic border-border/80 bg-card text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Há alterações não salvas neste item. Se descartá-las, o formulário será fechado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="mt-0 min-h-11 border-border bg-secondary text-base text-foreground hover:bg-secondary/80">
              Continuar editando
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={closeItemForm}
              className="min-h-11 bg-destructive text-base text-destructive-foreground hover:bg-destructive/90"
            >
              Descartar alterações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

function ItemCard({
  item, expanded, onToggle, editMode, characters, onUpdate, onRemove, onSpend, onEdit,
}: {
  item: Item;
  expanded: boolean;
  onToggle: () => void;
  editMode: boolean;
  characters: { id: string; name: string; category: string }[];
  onUpdate: (updates: Partial<Item>) => void;
  onRemove: () => void;
  onSpend: () => void;
  onEdit: (trigger: HTMLButtonElement) => void;
}) {
  const detailsId = useId();
  const { toast } = useToast();
  const inventoryAdd = useInventoryStore((s) => s.add);
  const omniEntities = useOmniEntidadesStore((s) => s.entidades);
  const addLog = useLogStore((s) => s.addLog);
  const assignedChars = characters.filter((c) => (item.assignedTo ?? []).includes(c.id));
  const isAccessory = item.slotType && item.slotType !== 'nenhum';
  const qty = item.quantity || 1;

  const sendToInventory = (charId: string, charName: string) => {
    // 1) Cria instância no useInventoryStore (slots de Acessório / equipar).
    const ent = omniEntities[item.id] ?? itemToOmniEntity(item);
    inventoryAdd(charId, ent);
    // 2) Vincula o item ao personagem no banco para aparecer na seção
    //    "Inventário" da ficha imediatamente (idempotente).
    if (!(item.assignedTo ?? []).includes(charId)) {
      onUpdate({ assignedTo: [...item.assignedTo, charId] });
    }
    addLog('system', `📦 "${item.name}" enviado ao inventário de ${charName}.`);
    toast({ title: 'Item entregue', description: `${item.name} → ${charName}` });
    playClickSound();
  };



  return (
    <div className={cn('group min-w-0 overflow-hidden rounded-xl border border-border/80 card-enigmatic transition-[border-color,box-shadow,transform] duration-200 hover:border-primary/35 hover:shadow-mystic', expanded && 'xl:col-span-2 2xl:col-span-3')}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={onToggle}
        className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70"
      >
        <span className="flex min-w-0 flex-1 flex-col text-left">
          <span className="block truncate text-base font-semibold text-foreground">
            {item.name}
            {isAccessory && (
              <span className="ml-1.5 rounded-full border border-primary/30 bg-primary/15 px-1.5 py-0.5 text-xs font-normal text-primary">
                {ITEM_SLOT_LABELS[item.slotType]}
              </span>
            )}
          </span>
          <span className="block text-xs text-muted-foreground">{isAccessory ? ITEM_SLOT_LABELS[item.slotType] : 'Item Geral'}</span>
        </span>
        {assignedChars.length > 0 && (
          <div className="flex gap-1 flex-wrap max-w-[200px]">
            {assignedChars.map((c) => (
              <span key={c.id} className="rounded-full bg-primary/15 border border-primary/30 px-2 py-0.5 text-xs text-primary glow-text">{c.name}</span>
            ))}
          </div>
        )}
        <span className="text-sm text-muted-foreground font-mono">x{qty}</span>
        <span className="text-sm text-muted-foreground font-mono">{item.slots} slots</span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-500', expanded && 'rotate-180')} />
      </button>

      <div
        id={detailsId}
        aria-hidden={!expanded}
        inert={!expanded}
        className="grid transition-[grid-template-rows,opacity] duration-500 ease-in-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr', opacity: expanded ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/50 px-4 py-3 space-y-3 text-sm">
            {item.description && <p className="text-muted-foreground italic">{item.description}</p>}

            <div className="flex gap-4 text-muted-foreground text-sm">
              <span>⚖ Peso: {item.weight}</span>
              <span>💰 Custo: {item.cost}</span>
              <span>📦 Qtd: {qty}</span>
            </div>

            {/* Bônus visíveis para qualquer item */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              {item.bonusHP !== 0 && <span className="rounded-full bg-hp/15 border border-hp/30 px-2 py-0.5 text-hp">HP+{item.bonusHP}</span>}
              {item.bonusPE !== 0 && <span className="rounded-full bg-pe/15 border border-pe/30 px-2 py-0.5 text-pe">PE+{item.bonusPE}</span>}
              {item.bonusESC !== 0 && <span className="rounded-full bg-shield/15 border border-shield/30 px-2 py-0.5 text-shield">ESC+{item.bonusESC}</span>}
              {item.bonusRD !== 0 && <span className="rounded-full bg-accent/15 border border-accent/30 px-2 py-0.5 text-accent-foreground">🔰 RD+{item.bonusRD}</span>}
              {item.bonusCA !== 0 && <span className="rounded-full bg-secondary border border-border px-2 py-0.5">CA+{item.bonusCA}</span>}
              {(item.bonusDC ?? 0) !== 0 && <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-2 py-0.5 text-neon-yellow">CD+{item.bonusDC}</span>}
              {item.bonusSlots !== 0 && <span className="rounded-full bg-secondary border border-border px-2 py-0.5">Slots+{item.bonusSlots}</span>}
              {item.bonusActions !== 0 && <span className="rounded-full bg-primary/15 border border-primary/30 px-2 py-0.5 text-primary">AC+{item.bonusActions}</span>}
              {item.bonusBonusActions !== 0 && <span className="rounded-full bg-pe/15 border border-pe/30 px-2 py-0.5 text-pe">AB+{item.bonusBonusActions}</span>}
              {item.bonusReactions !== 0 && <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-2 py-0.5 text-neon-yellow">RÇ+{item.bonusReactions}</span>}
              {item.bonusOpportunity !== 0 && <span className="rounded-full bg-hp/15 border border-hp/30 px-2 py-0.5 text-hp">AO+{item.bonusOpportunity}</span>}
              {item.bonusRdByType && DAMAGE_TYPES.filter((dt) => (item.bonusRdByType[dt] || 0) !== 0).map((dt) => (
                <span key={dt} className="rounded-full bg-accent/15 border border-accent/30 px-2 py-0.5 text-accent-foreground">
                  RD {DAMAGE_TYPE_ABBR[dt]}+{item.bonusRdByType[dt]}
                </span>
              ))}
            </div>

            {/* Comida / Consumível restaurador */}
            {item.isFood && (
              <div className="rounded-md border border-neon-yellow/30 bg-neon-yellow/5 p-2">
                <div className="text-sm font-bold uppercase tracking-wider text-neon-yellow mb-1">
                  🍽️ Comida / Consumível
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {(item.hungerRestore ?? 0) > 0 && (
                    <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-2 py-0.5 text-neon-yellow">
                      🍞 Fome +{item.hungerRestore}
                    </span>
                  )}
                  {(item.hpRestore ?? 0) > 0 && (
                    <span className="rounded-full bg-hp/15 border border-hp/30 px-2 py-0.5 text-hp">
                      ❤️ PV +{item.hpRestore}
                    </span>
                  )}
                  {(item.peRestore ?? 0) > 0 && (
                    <span className="rounded-full bg-pe/15 border border-pe/30 px-2 py-0.5 text-pe">
                      💠 PE +{item.peRestore}
                    </span>
                  )}
                  {(item.pvtRestore ?? 0) > 0 && (
                    <span className="rounded-full bg-shield/15 border border-shield/30 px-2 py-0.5 text-shield">
                      🛡️ PVT +{item.pvtRestore}
                    </span>
                  )}
                  {(item.hungerRestore ?? 0) === 0 &&
                    (item.hpRestore ?? 0) === 0 &&
                    (item.peRestore ?? 0) === 0 &&
                    (item.pvtRestore ?? 0) === 0 && (
                      <span className="text-muted-foreground italic">Sem efeitos configurados.</span>
                    )}
                </div>
                <p className="text-xs text-muted-foreground italic mt-1">
                  Aplicado aos vinculados ao Gastar. Bloqueado para origem CAM.
                </p>
              </div>
            )}

            {item.rollBonuses.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">Bônus de Rolagem</h4>
                <div className="flex flex-wrap gap-1">
                  {item.rollBonuses.map((rb) => (
                    <span key={rb.id} className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-2 py-0.5 text-xs text-neon-yellow">
                      {rb.attributeName}: {rb.value >= 0 ? '+' : ''}{rb.value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Spend button */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onSpend(); playClickSound(); }}
                className="flex items-center gap-1 rounded-lg bg-neon-red/20 border border-neon-red/30 px-3 py-1.5 text-sm font-medium text-neon-red hover:bg-neon-red/30 transition-colors"
              >
                <Minus className="h-3 w-3" /> Gastar (x{qty})
              </button>
            </div>

            {/* Assigned characters */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-1.5">Vinculados</h4>
              {assignedChars.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum personagem vinculado.</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {assignedChars.map((c) => (
                  <div key={c.id} className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/25 pl-2.5 pr-1 py-0.5 group">
                    <span className="text-xs text-primary font-medium">{c.name}</span>
                    <button
                      onClick={() => onUpdate({ assignedTo: (item.assignedTo ?? []).filter((id) => id !== c.id) })}
                      className="rounded-full p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/20 transition-colors opacity-60 group-hover:opacity-100"
                      title="Desvincular"
                    >
                      <Unlink className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {editMode && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1.5">Vincular:</h4>
                <div className="flex flex-wrap gap-1.5">
                  {characters.filter((c) => !(item.assignedTo ?? []).includes(c.id)).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { onUpdate({ assignedTo: [...item.assignedTo, c.id] }); playClickSound(); }}
                      className="flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/10 transition-all"
                    >
                      <Link2 className="h-2.5 w-2.5" /> {c.name}
                    </button>
                  ))}
                  {characters.filter((c) => !(item.assignedTo ?? []).includes(c.id)).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Todos vinculados.</p>
                  )}
                </div>
              </div>
            )}

            {/* Enviar ao inventário do jogador */}
            {characters.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <PackagePlus className="h-3 w-3" /> Enviar ao Inventário
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {characters.map((c) => (
                    <button
                      key={c.id}
                      onClick={(e) => { e.stopPropagation(); sendToInventory(c.id, c.name); }}
                      className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs text-primary hover:bg-primary/20 hover:border-primary/50 transition-all"
                      title={`Enviar uma cópia ao inventário de ${c.name}`}
                    >
                      <PackagePlus className="h-2.5 w-2.5" /> {c.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground italic mt-1">
                  Cria uma instância no inventário do personagem (pode ser equipada na ficha).
                </p>
              </div>
            )}

            {editMode && (
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={(event) => onEdit(event.currentTarget)}
                  className="flex items-center gap-1 rounded-lg bg-pe/20 border border-pe/30 px-3 py-1.5 text-sm font-medium text-pe hover:bg-pe/30 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </button>
                <DeleteConfirm onConfirm={onRemove} label={item.name} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemForm({
  characters, onSave, onCancel, onDirtyChange, initialItem,
}: {
  characters: { id: string; name: string }[];
  onSave: (item: Item) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  initialItem?: Item;
}) {
  const formId = useId();
  const [form, setForm] = useState({
    name: initialItem?.name || '',
    category: initialItem?.category || '',
    description: initialItem?.description || '',
    weight: initialItem?.weight || 0,
    cost: initialItem?.cost || 0,
    slots: initialItem?.slots ?? 1,
    quantity: initialItem?.quantity ?? 1,
    slotType: (initialItem?.slotType || 'nenhum') as ItemSlotType,
    bonusHP: initialItem?.bonusHP || 0,
    bonusPE: initialItem?.bonusPE || 0,
    bonusESC: initialItem?.bonusESC || 0,
    bonusRD: initialItem?.bonusRD || 0,
    bonusSlots: initialItem?.bonusSlots || 0,
    bonusCA: initialItem?.bonusCA || 0,
    bonusDC: initialItem?.bonusDC || 0,
    bonusActions: initialItem?.bonusActions || 0,
    bonusBonusActions: initialItem?.bonusBonusActions || 0,
    bonusReactions: initialItem?.bonusReactions || 0,
    bonusOpportunity: initialItem?.bonusOpportunity || 0,
    bonusRdByType: initialItem?.bonusRdByType || createEmptyRdByType(),
    assignedTo: initialItem?.assignedTo || [] as string[],
    rollBonuses: initialItem?.rollBonuses || [] as ItemRollBonus[],
    isFood: initialItem?.isFood ?? false,
    hungerRestore: initialItem?.hungerRestore ?? 0,
    hpRestore: initialItem?.hpRestore ?? 0,
    peRestore: initialItem?.peRestore ?? 0,
    pvtRestore: initialItem?.pvtRestore ?? 0,
  });
  const [showRdByType, setShowRdByType] = useState(false);
  const [rbName, setRbName] = useState('');
  const [rbVal, setRbVal] = useState('');
  const initialDraftRef = useRef(JSON.stringify({ form, rbName: '', rbVal: '' }));
  const isDirty = JSON.stringify({ form, rbName, rbVal }) !== initialDraftRef.current;

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const isAccessory = form.slotType !== 'nenhum';

  const addRollBonus = () => {
    if (!rbName.trim()) return;
    setForm({
      ...form,
      rollBonuses: [...form.rollBonuses, { id: crypto.randomUUID(), attributeName: rbName.trim(), value: parseInt(rbVal) || 0 }],
    });
    setRbName('');
    setRbVal('');
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({ id: initialItem?.id || crypto.randomUUID(), ...form });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col animate-fade-in">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-base">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <label htmlFor={`${formId}-name`} className="block text-sm font-semibold text-foreground">Nome</label>
          <input id={`${formId}-name`} autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Elixir de vigor" className="h-10 w-full rounded-md border border-input bg-background px-3 text-base text-foreground" />
        </div>
        
        {/* Category selection */}
        <div className="col-span-2 space-y-1">
          <label htmlFor={`${formId}-slotType`} className="block text-sm font-semibold text-foreground">Categoria</label>
          <select
            id={`${formId}-slotType`}
            value={form.slotType}
            onChange={(e) => setForm({ ...form, slotType: e.target.value as ItemSlotType })}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-base text-foreground"
          >
            {ITEM_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>

        <div className="col-span-2 space-y-1">
          <label htmlFor={`${formId}-description`} className="block text-sm font-semibold text-foreground">Descrição</label>
          <input id={`${formId}-description`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descreva o item" className="h-10 w-full rounded-md border border-input bg-background px-3 text-base text-foreground" />
        </div>
        {([
          { key: 'weight', label: 'Peso', value: form.weight, parse: (value: string) => parseFloat(value) || 0 },
          { key: 'cost', label: 'Custo', value: form.cost, parse: (value: string) => parseFloat(value) || 0 },
          { key: 'slots', label: 'Slots', value: form.slots, parse: (value: string) => parseInt(value) || 0 },
          { key: 'quantity', label: 'Quantidade', value: form.quantity, parse: (value: string) => parseInt(value) || 1 },
        ] as const).map(({ key, label, value, parse }) => (
          <div key={key} className="min-w-0 space-y-1">
            <label htmlFor={`${formId}-${key}`} className="block text-sm font-semibold text-foreground">{label}</label>
            <input
              id={`${formId}-${key}`}
              type="number"
              value={value || ''}
              onChange={(e) => setForm({ ...form, [key]: parse(e.target.value) })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-base text-foreground"
            />
          </div>
        ))}
      </div>

      <div className="space-y-2 rounded-lg border border-pe/20 bg-pe/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label htmlFor={`${formId}-bonusRD`} className="text-sm font-bold uppercase tracking-wider text-pe">RD geral</label>
            <input
              id={`${formId}-bonusRD`}
              type="number"
              value={form.bonusRD || ''}
              onChange={(e) => setForm({ ...form, bonusRD: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="h-10 w-24 rounded-md border border-pe/30 bg-background px-2 text-center text-base font-mono font-bold text-pe"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowRdByType(!showRdByType)}
            aria-expanded={showRdByType}
            aria-controls={`${formId}-rd-by-type`}
            className="min-h-10 rounded-md border border-pe/25 px-3 text-sm font-medium text-pe transition-colors hover:bg-pe/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            RD por tipo {showRdByType ? '−' : '+'}
          </button>
        </div>
        <div id={`${formId}-rd-by-type`} hidden={!showRdByType} inert={!showRdByType}>
            <h4 className="mb-2 text-sm font-semibold text-pe">RD por tipo de dano</h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DAMAGE_TYPES.map((dt) => (
                <div key={dt} className="min-w-0 space-y-1">
                  <label className="block truncate text-sm text-muted-foreground" title={DAMAGE_TYPE_LABELS[dt]}>{DAMAGE_TYPE_LABELS[dt]}</label>
                  <input
                    type="number"
                    value={form.bonusRdByType[dt] || ''}
                    onChange={(e) => setForm({ ...form, bonusRdByType: { ...form.bonusRdByType, [dt]: parseInt(e.target.value) || 0 } })}
                    aria-label={`Redução de dano contra ${DAMAGE_TYPE_LABELS[dt]}`}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-base text-foreground"
                  />
                </div>
              ))}
            </div>
        </div>
      </div>

      {/* Bônus disponíveis para qualquer item (geral ou acessório) */}
      <>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Bônus de status</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(['bonusHP', 'bonusPE', 'bonusESC', 'bonusCA', 'bonusDC', 'bonusSlots', 'bonusActions', 'bonusBonusActions', 'bonusReactions', 'bonusOpportunity'] as const).map((key) => {
              const labels: Record<string, string> = { bonusHP: 'HP', bonusPE: 'PE', bonusESC: 'ESC', bonusCA: 'CA', bonusDC: 'CD', bonusSlots: 'Slots', bonusActions: 'AC', bonusBonusActions: 'AB', bonusReactions: 'RÇ', bonusOpportunity: 'AO' };
              return (
              <div key={key} className="min-w-0 space-y-1">
                <label htmlFor={`${formId}-${key}`} className="block text-sm text-muted-foreground">{labels[key]}</label>
                <input id={`${formId}-${key}`} type="number" value={(form as any)[key] || ''} onChange={(e) => setForm({ ...form, [key]: parseInt(e.target.value) || 0 })} className="h-9 w-full rounded-md border border-input bg-background px-2 text-base text-foreground" />
              </div>
            )})}
          </div>
          <p className="mt-2 text-sm text-muted-foreground italic">Itens gerais concedem bônus quando vinculados; acessórios precisam estar equipados em slot.</p>
        </div>

        {/* Comida / Consumível restaurador */}
        <div className="rounded-md border border-neon-yellow/30 bg-neon-yellow/5 p-2">
          <label className="flex min-h-10 items-center gap-2 text-sm font-bold uppercase tracking-wider text-neon-yellow cursor-pointer">
            <input
              type="checkbox"
              checked={form.isFood}
              onChange={(e) => setForm({ ...form, isFood: e.target.checked })}
              className="h-5 w-5 accent-neon-yellow"
            />
            🍽️ É comida / consumível restaurador
          </label>
          {form.isFood && (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {([
                  { key: 'hungerRestore', label: '🍞 Fome', max: 24 },
                  { key: 'hpRestore', label: '❤️ PV', max: undefined },
                  { key: 'peRestore', label: '💠 PE', max: undefined },
                  { key: 'pvtRestore', label: '🛡️ PVT', max: undefined },
                ] as const).map(({ key, label, max }) => (
                  <div key={key} className="min-w-0 space-y-1">
                    <label className="block text-sm text-muted-foreground" title={label}>{label}</label>
                    <input
                      type="number"
                      aria-label={`${label} ao consumir`}
                      min={0}
                      max={max}
                      value={(form as any)[key] || ''}
                      onChange={(e) =>
                        setForm({ ...form, [key]: Math.max(0, parseInt(e.target.value) || 0) })
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-base text-foreground"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-sm text-muted-foreground italic">
                Ao Gastar, aplica os efeitos aos personagens vinculados. Cada ponto de Fome cobre ~1 hora. Origem CAM não recebe efeito.
              </p>
            </>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Bônus de rolagem</h4>
          {form.rollBonuses.map((rb) => (
            <div key={rb.id} className="flex items-center gap-1 mb-1 text-sm">
              <span className="text-foreground">{rb.attributeName}: {rb.value >= 0 ? '+' : ''}{rb.value}</span>
              <button type="button" aria-label={`Remover bônus de ${rb.attributeName}`} onClick={() => setForm({ ...form, rollBonuses: form.rollBonuses.filter((r) => r.id !== rb.id) })} className="flex h-10 w-10 items-center justify-center rounded-md text-destructive/80 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><X className="h-4 w-4" /></button>
            </div>
          ))}
          <div className="flex gap-1">
            <input value={rbName} onChange={(e) => setRbName(e.target.value)} aria-label="Atributo do bônus de rolagem" placeholder="Atributo" className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base text-foreground" />
            <input value={rbVal} onChange={(e) => setRbVal(e.target.value)} aria-label="Valor do bônus de rolagem" placeholder="Valor" type="number" className="h-10 w-24 rounded-md border border-input bg-background px-2 text-base text-foreground" />
            <button type="button" aria-label="Adicionar bônus de rolagem" onClick={addRollBonus} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neon-yellow/30 bg-neon-yellow/15 text-neon-yellow transition-colors hover:bg-neon-yellow/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"><Plus className="h-4 w-4" /></button>
          </div>
        </div>
      </>

      {characters.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted-foreground">Vincular a</h4>
          <div className="flex flex-wrap gap-1.5">
            {characters.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={(form.assignedTo ?? []).includes(c.id)}
                onClick={() => setForm({
                  ...form,
                  assignedTo: (form.assignedTo ?? []).includes(c.id) ? (form.assignedTo ?? []).filter((id) => id !== c.id) : [...form.assignedTo, c.id],
                })}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-all',
                  (form.assignedTo ?? []).includes(c.id)
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-border bg-secondary/50 text-muted-foreground hover:border-primary/30 hover:text-primary'
                )}
              >
                {(form.assignedTo ?? []).includes(c.id) ? <Link2 className="h-2.5 w-2.5" /> : <Unlink className="h-2.5 w-2.5" />}
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      </div>
      <div className="sticky bottom-0 z-10 flex shrink-0 gap-2 border-t border-border/70 bg-card/95 px-5 py-4 backdrop-blur-sm">
        <button type="button" onClick={handleSave} className="h-11 flex-1 rounded-lg bg-primary px-4 text-base font-semibold text-primary-foreground shadow-mystic transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">Salvar item</button>
        <button type="button" onClick={onCancel} className="h-11 rounded-lg border border-border bg-secondary px-4 text-base font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">Cancelar</button>
      </div>
    </div>
  );
}
