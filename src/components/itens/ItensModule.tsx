import { useState } from 'react';
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
    setCreating(false);
  };

  const handleEditSave = (item: Item) => {
    updateItem(item.id, item);
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <ModuleHeader
        icon={Swords}
        title="Banco de Itens"
        subtitle={`(${items.length})`}
        description="Catálogo central de itens, equipamentos e consumíveis."
        actions={
          <>
            <button
              onClick={() => { setEditMode(!editMode); playClickSound(); }}
              className="rounded-md p-2 text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
              title={editMode ? 'Modo visualização' : 'Modo edição'}
            >
              {editMode ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4" />}
            </button>
            {editMode && (
              <button
                onClick={() => { setCreating(true); playClickSound(); }}
                className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 glow-primary transition-all"
              >
                <Plus className="h-4 w-4" /> Criar Item
              </button>
            )}
          </>
        }
      />

      {creating && (
        <ItemForm
          characters={characters}
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      <SearchInput
        value={search}
        onValueChange={setSearch}
        placeholder="Buscar item por nome ou descrição..."
        containerClassName="max-w-md"
      />

      <div className="space-y-2">
        {filteredItems.map((item) => (
          editingId === item.id ? (
            <ItemForm
              key={item.id}
              characters={characters}
              onSave={handleEditSave}
              onCancel={() => setEditingId(null)}
              initialItem={item}
            />
          ) : (
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
              onEdit={() => setEditingId(item.id)}
            />
          )
        ))}
      </div>

      {items.length === 0 && !creating && (
        <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12 card-enigmatic">
          <p className="text-muted-foreground italic text-sm">
            {editMode ? 'Clique em "Criar Item" para começar.' : 'Nenhum item criado. Ative o modo edição (👁) para criar.'}
          </p>
        </div>
      )}
    </div>
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
  onEdit: () => void;
}) {
  const { toast } = useToast();
  const inventoryAdd = useInventoryStore((s) => s.add);
  const omniEntities = useOmniEntidadesStore((s) => s.entidades);
  const addLog = useLogStore((s) => s.addLog);
  const assignedChars = characters.filter((c) => item.assignedTo.includes(c.id));
  const isAccessory = item.slotType && item.slotType !== 'nenhum';
  const qty = item.quantity || 1;

  const sendToInventory = (charId: string, charName: string) => {
    // 1) Cria instância no useInventoryStore (slots de Acessório / equipar).
    const ent = omniEntities[item.id] ?? itemToOmniEntity(item);
    inventoryAdd(charId, ent);
    // 2) Vincula o item ao personagem no banco para aparecer na seção
    //    "Inventário" da ficha imediatamente (idempotente).
    if (!item.assignedTo.includes(charId)) {
      onUpdate({ assignedTo: [...item.assignedTo, charId] });
    }
    addLog('system', `📦 "${item.name}" enviado ao inventário de ${charName}.`);
    toast({ title: 'Item entregue', description: `${item.name} → ${charName}` });
    playClickSound();
  };



  return (
    <div className="rounded-lg border border-border overflow-hidden card-enigmatic">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-primary/5 transition-all duration-300"
      >
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground truncate text-sm">
            {item.name}
            {isAccessory && (
              <span className="ml-1.5 text-xs rounded-full bg-primary/15 border border-primary/30 px-1.5 py-0.5 text-primary font-normal">
                {ITEM_SLOT_LABELS[item.slotType]}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{isAccessory ? ITEM_SLOT_LABELS[item.slotType] : 'Item Geral'}</div>
        </div>
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
                <div className="text-xs font-bold uppercase tracking-wider text-neon-yellow mb-1">
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
                <p className="text-[11px] text-muted-foreground italic mt-1">
                  Aplicado aos vinculados ao Gastar. Bloqueado para origem CAM.
                </p>
              </div>
            )}

            {item.rollBonuses.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-1">Bônus de Rolagem</h4>
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
              <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">Vinculados</h4>
              {assignedChars.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum personagem vinculado.</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {assignedChars.map((c) => (
                  <div key={c.id} className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/25 pl-2.5 pr-1 py-0.5 group">
                    <span className="text-xs text-primary font-medium">{c.name}</span>
                    <button
                      onClick={() => onUpdate({ assignedTo: item.assignedTo.filter((id) => id !== c.id) })}
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
                <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">Vincular:</h4>
                <div className="flex flex-wrap gap-1.5">
                  {characters.filter((c) => !item.assignedTo.includes(c.id)).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { onUpdate({ assignedTo: [...item.assignedTo, c.id] }); playClickSound(); }}
                      className="flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-0.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/10 transition-all"
                    >
                      <Link2 className="h-2.5 w-2.5" /> {c.name}
                    </button>
                  ))}
                  {characters.filter((c) => !item.assignedTo.includes(c.id)).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Todos vinculados.</p>
                  )}
                </div>
              </div>
            )}

            {/* Enviar ao inventário do jogador */}
            {characters.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
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
                <p className="text-[11px] text-muted-foreground italic mt-1">
                  Cria uma instância no inventário do personagem (pode ser equipada na ficha).
                </p>
              </div>
            )}

            {editMode && (
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => { onEdit(); playClickSound(); }}
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
  characters, onSave, onCancel, initialItem,
}: {
  characters: { id: string; name: string }[];
  onSave: (item: Item) => void;
  onCancel: () => void;
  initialItem?: Item;
}) {
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
    <div className="rounded-lg border border-primary/30 p-4 space-y-3 text-sm animate-fade-in card-enigmatic glow-border">
      <h3 className="text-base font-bold text-foreground glow-text">{initialItem ? 'Editar Item' : 'Novo Item'}</h3>
      <div className="grid grid-cols-2 gap-2">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome" className="h-9 rounded border border-input bg-background px-2 text-foreground col-span-2 text-sm" />
        
        {/* Category selection */}
        <div className="col-span-2 flex gap-1 items-center">
          <label className="text-muted-foreground w-20 text-sm">Categoria</label>
          <select
            value={form.slotType}
            onChange={(e) => setForm({ ...form, slotType: e.target.value as ItemSlotType })}
            className="h-9 w-full rounded border border-input bg-background px-2 text-foreground text-sm"
          >
            {ITEM_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>

        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição" className="h-9 rounded border border-input bg-background px-2 text-foreground text-sm col-span-2" />
        <div className="flex gap-1 items-center">
          <label className="text-muted-foreground w-10 text-sm">Peso</label>
          <input type="number" value={form.weight || ''} onChange={(e) => setForm({ ...form, weight: parseFloat(e.target.value) || 0 })} className="h-9 w-full rounded border border-input bg-background px-2 text-foreground text-sm" />
        </div>
        <div className="flex gap-1 items-center">
          <label className="text-muted-foreground w-10 text-sm">Custo</label>
          <input type="number" value={form.cost || ''} onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })} className="h-9 w-full rounded border border-input bg-background px-2 text-foreground text-sm" />
        </div>
        <div className="flex gap-1 items-center">
          <label className="text-muted-foreground w-10 text-sm">Slots</label>
          <input type="number" value={form.slots || ''} onChange={(e) => setForm({ ...form, slots: parseInt(e.target.value) || 0 })} className="h-9 w-full rounded border border-input bg-background px-2 text-foreground text-sm" />
        </div>
        <div className="flex gap-1 items-center">
          <label className="text-muted-foreground w-10 text-sm">Qtd</label>
          <input type="number" value={form.quantity || ''} onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })} className="h-9 w-full rounded border border-input bg-background px-2 text-foreground text-sm" />
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-pe/20 bg-pe/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-pe">🔰 RD Geral</span>
            <input
              type="number"
              value={form.bonusRD || ''}
              onChange={(e) => setForm({ ...form, bonusRD: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="h-8 w-20 rounded border border-pe/30 bg-background px-2 text-center text-sm font-mono font-bold text-pe"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowRdByType(!showRdByType)}
            className="text-xs font-medium text-pe hover:text-pe/80 transition-colors"
          >
            RD por tipo {showRdByType ? '▲' : '▼'}
          </button>
        </div>
        {showRdByType && (
          <div>
            <h4 className="text-xs font-semibold text-pe mb-1 flex items-center gap-1">🔰 RD por Tipo de Dano</h4>
            <div className="grid grid-cols-3 gap-1">
              {DAMAGE_TYPES.map((dt) => (
                <div key={dt} className="flex items-center gap-1">
                  <label className="text-xs text-muted-foreground w-10 truncate" title={DAMAGE_TYPE_LABELS[dt]}>{DAMAGE_TYPE_ABBR[dt]}</label>
                  <input
                    type="number"
                    value={form.bonusRdByType[dt] || ''}
                    onChange={(e) => setForm({ ...form, bonusRdByType: { ...form.bonusRdByType, [dt]: parseInt(e.target.value) || 0 } })}
                    className="h-7 w-full rounded border border-input bg-background px-1 text-foreground text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bônus disponíveis para qualquer item (geral ou acessório) */}
      <>
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Bônus de Status</h4>
          <div className="grid grid-cols-5 gap-1">
            {(['bonusHP', 'bonusPE', 'bonusESC', 'bonusCA', 'bonusDC', 'bonusSlots', 'bonusActions', 'bonusBonusActions', 'bonusReactions', 'bonusOpportunity'] as const).map((key) => {
              const labels: Record<string, string> = { bonusHP: 'HP', bonusPE: 'PE', bonusESC: 'ESC', bonusCA: 'CA', bonusDC: 'CD', bonusSlots: 'Slots', bonusActions: 'AC', bonusBonusActions: 'AB', bonusReactions: 'RÇ', bonusOpportunity: 'AO' };
              return (
              <div key={key} className="flex items-center gap-1">
                <label className="text-xs text-muted-foreground w-10">{labels[key]}</label>
                <input type="number" value={(form as any)[key] || ''} onChange={(e) => setForm({ ...form, [key]: parseInt(e.target.value) || 0 })} className="h-7 w-full rounded border border-input bg-background px-1 text-foreground text-xs" />
              </div>
            )})}
          </div>
          <p className="text-[11px] text-muted-foreground italic mt-1">Itens gerais concedem bônus quando vinculados; acessórios precisam estar equipados em slot.</p>
        </div>

        {/* Comida / Consumível restaurador */}
        <div className="rounded-md border border-neon-yellow/30 bg-neon-yellow/5 p-2">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neon-yellow cursor-pointer">
            <input
              type="checkbox"
              checked={form.isFood}
              onChange={(e) => setForm({ ...form, isFood: e.target.checked })}
              className="h-3.5 w-3.5 accent-neon-yellow"
            />
            🍽️ É comida / consumível restaurador
          </label>
          {form.isFood && (
            <>
              <div className="grid grid-cols-4 gap-1 mt-2">
                {([
                  { key: 'hungerRestore', label: '🍞 Fome', max: 24 },
                  { key: 'hpRestore', label: '❤️ PV', max: undefined },
                  { key: 'peRestore', label: '💠 PE', max: undefined },
                  { key: 'pvtRestore', label: '🛡️ PVT', max: undefined },
                ] as const).map(({ key, label, max }) => (
                  <div key={key} className="flex items-center gap-1">
                    <label className="text-xs text-muted-foreground w-14 truncate" title={label}>{label}</label>
                    <input
                      type="number"
                      min={0}
                      max={max}
                      value={(form as any)[key] || ''}
                      onChange={(e) =>
                        setForm({ ...form, [key]: Math.max(0, parseInt(e.target.value) || 0) })
                      }
                      className="h-7 w-full rounded border border-input bg-background px-1 text-foreground text-xs"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground italic mt-1">
                Ao Gastar, aplica os efeitos aos personagens vinculados. Cada ponto de Fome cobre ~1 hora. Origem CAM não recebe efeito.
              </p>
            </>
          )}
        </div>

        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Bônus de Rolagem</h4>
          {form.rollBonuses.map((rb) => (
            <div key={rb.id} className="flex items-center gap-1 mb-1 text-sm">
              <span className="text-foreground">{rb.attributeName}: {rb.value >= 0 ? '+' : ''}{rb.value}</span>
              <button onClick={() => setForm({ ...form, rollBonuses: form.rollBonuses.filter((r) => r.id !== rb.id) })} className="text-destructive/60 hover:text-destructive"><X className="h-3 w-3" /></button>
            </div>
          ))}
          <div className="flex gap-1">
            <input value={rbName} onChange={(e) => setRbName(e.target.value)} placeholder="Atributo" className="h-8 flex-1 rounded border border-input bg-background px-2 text-foreground text-sm" />
            <input value={rbVal} onChange={(e) => setRbVal(e.target.value)} placeholder="+Val" type="number" className="h-8 w-14 rounded border border-input bg-background px-2 text-foreground text-sm" />
            <button onClick={addRollBonus} className="h-8 w-8 rounded bg-neon-yellow/20 text-neon-yellow flex items-center justify-center hover:bg-neon-yellow/30 transition-colors"><Plus className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </>

      {characters.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">Vincular a:</h4>
          <div className="flex flex-wrap gap-1.5">
            {characters.map((c) => (
              <button
                key={c.id}
                onClick={() => setForm({
                  ...form,
                  assignedTo: form.assignedTo.includes(c.id) ? form.assignedTo.filter((id) => id !== c.id) : [...form.assignedTo, c.id],
                })}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-all',
                  form.assignedTo.includes(c.id)
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-border bg-secondary/50 text-muted-foreground hover:border-primary/30 hover:text-primary'
                )}
              >
                {form.assignedTo.includes(c.id) ? <Link2 className="h-2.5 w-2.5" /> : <Unlink className="h-2.5 w-2.5" />}
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={handleSave} className="h-9 rounded bg-primary px-4 text-primary-foreground font-medium glow-primary hover:glow-primary-strong transition-all text-sm">Salvar</button>
        <button onClick={onCancel} className="h-9 rounded bg-secondary px-4 text-secondary-foreground text-sm">Cancelar</button>
      </div>
    </div>
  );
}
