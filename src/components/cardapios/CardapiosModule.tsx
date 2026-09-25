import { useMemo, useState } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Store,
  Tag,
  BookOpen,
  Coins,
  ShoppingCart,
  Percent,
} from 'lucide-react';
import { useMenuStore, type Establishment, type Menu, type MenuItem } from '@/stores/useMenuStore';
import { VisibilityToggle } from './VisibilityToggle';
import { CartPanel } from './CartPanel';
import { useCartStore } from '@/stores/useCartStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useDiscountStore } from '@/stores/useDiscountStore';
import { useChronosStore } from '@/stores/useChronosStore';
import {
  chronosToAbsDay,
  computeEffectivePrice,
  getApplicableDiscounts,
} from '@/lib/discounts';
import { DiscountDialog } from './DiscountDialog';
import { playClickSound, playToggleSound } from '@/lib/sounds';
import { toast } from '@/components/ui/use-toast';
import { ModuleHeader } from '@/components/ui/module-header';
import { cn } from '@/lib/utils';

export function CardapiosModule() {
  const role = useRoleStore((s) => s.role);
  const isMaster = role === 'MASTER';
  const {
    establishments,
    addEstablishment,
    updateEstablishment,
    removeEstablishment,
    addMenu,
    updateMenu,
    removeMenu,
    addMenuItem,
    updateMenuItem,
    removeMenuItem,
  } = useMenuStore();

  const [editMode, setEditMode] = useState(false);
  const [expandedEst, setExpandedEst] = useState<string | null>(null);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [creatingEst, setCreatingEst] = useState(false);
  const [editingEstId, setEditingEstId] = useState<string | null>(null);

  // forms locais para criar menu/item
  const [newMenuFor, setNewMenuFor] = useState<string | null>(null);
  const [newItemFor, setNewItemFor] = useState<{ estId: string; menuId: string } | null>(null);

  // Diálogo de descontos (alvo: estabelecimento, cardapio ou item)
  const [discountDialog, setDiscountDialog] = useState<{
    targetType: 'establishment' | 'menu' | 'item';
    targetId: string;
    targetName: string;
    parentEstId?: string;
    parentMenuId?: string;
  } | null>(null);

  const canEdit = isMaster && editMode;

  // Players não enxergam estabelecimentos marcados como invisíveis.
  const visibleEstablishments = isMaster
    ? establishments
    : establishments.filter((e) => e.hiddenMode !== 'invisible');

  return (
    <div className="space-y-3">
      <ModuleHeader
        icon={Store}
        title="Estabelecimentos"
        subtitle={`(${establishments.length})`}
        description="Tavernas, lojas e mercados — cardápios e preços do mundo."
        actions={
          <>
            {isMaster && (
              <button
                onClick={() => { setEditMode(!editMode); playClickSound(); }}
                className="rounded-md p-2 text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
                title={editMode ? 'Modo visualização' : 'Modo edição'}
              >
                {editMode ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4" />}
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => { setCreatingEst(true); playClickSound(); }}
                className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 glow-primary transition-all"
              >
                <Plus className="h-4 w-4" /> Novo Estabelecimento
              </button>
            )}
          </>
        }
      />

      {creatingEst && (
        <EstablishmentForm
          onCancel={() => setCreatingEst(false)}
          onSave={(data) => {
            addEstablishment(data);
            setCreatingEst(false);
          }}
        />
      )}

      <div className="space-y-2">
        {visibleEstablishments.map((est) => {
          const isOpen = expandedEst === est.id;
          return (
            <div
              key={est.id}
              className="rounded-lg border border-border bg-card card-enigmatic overflow-hidden"
            >
              {editingEstId === est.id ? (
                <EstablishmentForm
                  initial={est}
                  onCancel={() => setEditingEstId(null)}
                  onSave={(data) => {
                    updateEstablishment(est.id, data);
                    setEditingEstId(null);
                  }}
                />
              ) : (
                <div
                  className="flex items-center gap-2 p-3 cursor-pointer hover:bg-secondary/30"
                  onClick={() => {
                    setExpandedEst(isOpen ? null : est.id);
                    playToggleSound();
                  }}
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Store className="h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-foreground" style={{ fontFamily: "'Cinzel', serif" }}>
                        {est.name}
                      </span>
                      {est.type && (
                        <span className="text-xs italic text-muted-foreground">— {est.type}</span>
                      )}
                      {est.hiddenMode === 'soldout' && (
                        <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neon-yellow">
                          Esgotado
                        </span>
                      )}
                      {isMaster && est.hiddenMode === 'invisible' && (
                        <span className="rounded-full bg-hp/15 border border-hp/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-hp">
                          Oculto
                        </span>
                      )}
                    </div>
                    {est.location && (
                      <div className="text-xs text-muted-foreground">{est.location}</div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {est.menus.length} seç{est.menus.length === 1 ? 'ão' : 'ões'}
                  </span>
                  {canEdit && (
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setEditingEstId(est.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"
                        title="Editar"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <VisibilityToggle
                        value={est.hiddenMode}
                        onChange={(v) => updateEstablishment(est.id, { hiddenMode: v })}
                      />
                      <button
                        onClick={() => {
                          playClickSound();
                          setDiscountDialog({
                            targetType: 'establishment',
                            targetId: est.id,
                            targetName: est.name,
                          });
                        }}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent/20 hover:text-accent"
                        title="Descontos do estabelecimento"
                      >
                        <Percent className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Excluir "${est.name}"?`)) removeEstablishment(est.id);
                        }}
                        className="rounded p-1.5 text-muted-foreground hover:bg-hp/20 hover:text-hp"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isOpen && (
                <div className="border-t border-border p-3 space-y-2 bg-background/30">
                  {est.description && (
                    <p className="text-xs italic text-muted-foreground">{est.description}</p>
                  )}

                  {!isMaster && <CartPanel estId={est.id} estName={est.name} />}

                  {(isMaster ? est.menus : est.menus.filter((m) => m.hiddenMode !== 'invisible')).map((menu) => (
                    <MenuBlock
                      key={menu.id}
                      est={est}
                      menu={menu}
                      canEdit={canEdit}
                      isMaster={isMaster}
                      expanded={expandedMenu === menu.id}
                      onToggle={() => {
                        setExpandedMenu(expandedMenu === menu.id ? null : menu.id);
                        playToggleSound();
                      }}
                      onUpdateMenu={(u) => updateMenu(est.id, menu.id, u)}
                      onRemoveMenu={() => removeMenu(est.id, menu.id)}
                      onAddItem={(it) => addMenuItem(est.id, menu.id, it)}
                      onUpdateItem={(itId, u) => updateMenuItem(est.id, menu.id, itId, u)}
                      onRemoveItem={(itId) => removeMenuItem(est.id, menu.id, itId)}
                      newItemOpen={newItemFor?.estId === est.id && newItemFor?.menuId === menu.id}
                      setNewItemOpen={(open) =>
                        setNewItemFor(open ? { estId: est.id, menuId: menu.id } : null)
                      }
                      onOpenDiscount={(target) => setDiscountDialog(target)}
                    />
                  ))}

                  {canEdit && newMenuFor === est.id ? (
                    <MenuForm
                      onCancel={() => setNewMenuFor(null)}
                      onSave={(data) => {
                        addMenu(est.id, data);
                        setNewMenuFor(null);
                      }}
                    />
                  ) : (
                    canEdit && (
                      <button
                        onClick={() => {
                          setNewMenuFor(est.id);
                          playClickSound();
                        }}
                        className="flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 transition-all"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar Seção
                      </button>
                    )
                  )}

                  {est.menus.length === 0 && !canEdit && (
                    <p className="text-xs italic text-muted-foreground">Nenhuma seção.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {establishments.length === 0 && !creatingEst && (
          <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12 card-enigmatic">
            <p className="text-muted-foreground italic text-sm">
              {canEdit
                ? 'Clique em "Novo Estabelecimento" para começar.'
                : isMaster
                  ? 'Ative o modo edição (👁) para criar.'
                  : 'Nenhum estabelecimento disponível.'}
            </p>
          </div>
        )}
      </div>

      {discountDialog && (
        <DiscountDialog
          open={!!discountDialog}
          onOpenChange={(o) => { if (!o) setDiscountDialog(null); }}
          targetType={discountDialog.targetType}
          targetId={discountDialog.targetId}
          targetName={discountDialog.targetName}
          parentEstId={discountDialog.parentEstId}
          parentMenuId={discountDialog.parentMenuId}
        />
      )}
    </div>
  );
}

/* ---------------- Menu block ---------------- */

function MenuBlock({
  est,
  menu,
  canEdit,
  isMaster,
  expanded,
  onToggle,
  onUpdateMenu,
  onRemoveMenu,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  newItemOpen,
  setNewItemOpen,
  onOpenDiscount,
}: {
  est: Establishment;
  menu: Menu;
  canEdit: boolean;
  isMaster: boolean;
  expanded: boolean;
  onToggle: () => void;
  onUpdateMenu: (u: Partial<Omit<Menu, 'id' | 'items'>>) => void;
  onRemoveMenu: () => void;
  onAddItem: (it: Omit<MenuItem, 'id'>) => void;
  onUpdateItem: (itId: string, u: Partial<Omit<MenuItem, 'id'>>) => void;
  onRemoveItem: (itId: string) => void;
  newItemOpen: boolean;
  setNewItemOpen: (open: boolean) => void;
  onOpenDiscount: (target: {
    targetType: 'establishment' | 'menu' | 'item';
    targetId: string;
    targetName: string;
    parentEstId?: string;
    parentMenuId?: string;
  }) => void;
}) {
  const [editingMenu, setEditingMenu] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const visibleItems = isMaster
    ? menu.items
    : menu.items.filter((it) => it.hiddenMode !== 'invisible');

  return (
    <div className="rounded-md border border-border/60 bg-card/50 overflow-hidden">
      {editingMenu ? (
        <MenuForm
          initial={menu}
          onCancel={() => setEditingMenu(false)}
          onSave={(data) => {
            onUpdateMenu(data);
            setEditingMenu(false);
          }}
        />
      ) : (
        <div
          className="flex items-center gap-2 p-2 cursor-pointer hover:bg-secondary/20"
          onClick={onToggle}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-primary" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <Tag className="h-3.5 w-3.5 text-accent" />
          <span className="flex-1 text-sm font-semibold text-foreground">{menu.name}</span>
          {menu.hiddenMode === 'soldout' && (
            <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neon-yellow">
              Esgotado
            </span>
          )}
          {isMaster && menu.hiddenMode === 'invisible' && (
            <span className="rounded-full bg-hp/15 border border-hp/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-hp">
              Oculto
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {visibleItems.length} {visibleItems.length === 1 ? 'item' : 'itens'}
          </span>
          {canEdit && (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setEditingMenu(true)}
                className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-primary"
                title="Editar seção"
              >
                <Edit2 className="h-3 w-3" />
              </button>
              <VisibilityToggle
                value={menu.hiddenMode}
                onChange={(v) => onUpdateMenu({ hiddenMode: v })}
                size="sm"
              />
              <button
                onClick={() => {
                  playClickSound();
                  onOpenDiscount({
                    targetType: 'menu',
                    targetId: menu.id,
                    targetName: menu.name,
                    parentEstId: est.id,
                  });
                }}
                className="rounded p-1 text-muted-foreground hover:bg-accent/20 hover:text-accent"
                title="Descontos do cardápio"
              >
                <Percent className="h-3 w-3" />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Excluir seção "${menu.name}"?`)) onRemoveMenu();
                }}
                className="rounded p-1 text-muted-foreground hover:bg-hp/20 hover:text-hp"
                title="Excluir seção"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {expanded && (
        <div className="border-t border-border/60 p-2 space-y-1.5 bg-background/40">
          {menu.description && (
            <p className="text-xs italic text-muted-foreground">{menu.description}</p>
          )}

          {visibleItems.map((it) =>
            editingItemId === it.id ? (
              <ItemForm
                key={it.id}
                initial={it}
                onCancel={() => setEditingItemId(null)}
                onSave={(data) => {
                  onUpdateItem(it.id, data);
                  setEditingItemId(null);
                }}
              />
            ) : (
              <ItemRow
                key={it.id}
                estId={est.id}
                menuId={menu.id}
                item={it}
                canEdit={canEdit}
                isMaster={isMaster}
                onEdit={() => setEditingItemId(it.id)}
                onRemove={() => onRemoveItem(it.id)}
                onOpenDiscount={onOpenDiscount}
                onUpdateItem={(u) => onUpdateItem(it.id, u)}
              />
            ),
          )}

          {/* placeholder removed (refactored into ItemRow) */}

          {canEdit && newItemOpen ? (
            <ItemForm
              onCancel={() => setNewItemOpen(false)}
              onSave={(data) => {
                onAddItem(data);
                setNewItemOpen(false);
              }}
            />
          ) : (
            canEdit && (
              <button
                onClick={() => {
                  setNewItemOpen(true);
                  playClickSound();
                }}
                className="flex items-center gap-1 rounded-md border border-dashed border-accent/40 px-2 py-1 text-xs text-accent hover:bg-accent/10 transition-all"
              >
                <Plus className="h-3 w-3" /> Adicionar Item
              </button>
            )
          )}

          {menu.items.length === 0 && !canEdit && (
            <p className="text-xs italic text-muted-foreground">Nenhum item.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Forms ---------------- */

function EstablishmentForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Establishment;
  onSave: (data: { name: string; type?: string; location?: string; description?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.type ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');

  return (
    <div className="rounded-lg border border-primary/40 bg-card/80 p-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do estabelecimento *"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
        <input
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="Tipo (loja, restaurante, bar, loja jujutsu...)"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
      </div>
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Localização"
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição"
        rows={2}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
        >
          Cancelar
        </button>
        <button
          onClick={() => {
            if (!name.trim()) return;
            onSave({
              name: name.trim(),
              type: type.trim() || undefined,
              location: location.trim() || undefined,
              description: description.trim() || undefined,
            });
          }}
          className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 glow-primary"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

function MenuForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Menu;
  onSave: (data: { name: string; description?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');

  return (
    <div className="rounded-md border border-accent/40 bg-card/80 p-2 space-y-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome da seção (ex.: Armas, Bebidas, Pergaminhos) *"
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição (opcional)"
        rows={2}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-secondary"
        >
          Cancelar
        </button>
        <button
          onClick={() => {
            if (!name.trim()) return;
            onSave({ name: name.trim(), description: description.trim() || undefined });
          }}
          className="rounded-md bg-accent px-3 py-1 text-xs text-accent-foreground hover:bg-accent/90"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

/* ---------------- Item row (visualização + compra) ---------------- */

function ItemRow({
  estId,
  menuId,
  item,
  canEdit,
  isMaster,
  onEdit,
  onRemove,
  onOpenDiscount,
  onUpdateItem,
}: {
  estId: string;
  menuId: string;
  item: MenuItem;
  canEdit: boolean;
  isMaster: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onOpenDiscount: (target: {
    targetType: 'establishment' | 'menu' | 'item';
    targetId: string;
    targetName: string;
    parentEstId?: string;
    parentMenuId?: string;
  }) => void;
  onUpdateItem: (u: Partial<Omit<MenuItem, 'id'>>) => void;
}) {
  const role = useRoleStore((s) => s.role);
  const isPlayer = role === 'PLAYER';
  const currencies = useMoneyStore((s) => s.currencies);
  const addToCart = useCartStore((s) => s.addItem);
  const cartLine = useCartStore((s) => s.carts[estId]?.find((l) => l.itemId === item.id));
  const inCart = cartLine?.qty ?? 0;

  const currency =
    currencies.find((c) => c.id === item.currencyId) ??
    currencies.find((c) => c.isDefault) ??
    currencies[0];

  // Descontos ativos aplicáveis (estabelecimento + cardapio + item)
  const allDiscounts = useDiscountStore((s) => s.discounts);
  const cDay = useChronosStore((s) => s.day);
  const cMonth = useChronosStore((s) => s.month);
  const cYear = useChronosStore((s) => s.year);
  const nowAbsDay = chronosToAbsDay(cYear, cMonth, cDay);
  const applicable = useMemo(
    () => getApplicableDiscounts(allDiscounts, estId, menuId, item.id, nowAbsDay),
    [allDiscounts, estId, menuId, item.id, nowAbsDay],
  );
  const { effective, hasDiscount, percentEquivalent } = useMemo(
    () => computeEffectivePrice(item.cost, applicable),
    [item.cost, applicable],
  );

  // Estoque efetivo (undefined = ilimitado)
  const stock = item.stock;
  const stockOut = stock !== undefined && stock <= 0;
  const stockRemaining = stock === undefined ? Infinity : Math.max(0, stock - inCart);
  const isUnavailable = item.hiddenMode === 'soldout' || stockOut;

  // Quantidade a adicionar
  const [qty, setQty] = useState(1);
  const maxQty = stock === undefined ? 99 : stockRemaining;

  const handleAdd = () => {
    if (!currency) return;
    if (qty < 1) return;
    if (maxQty < qty) {
      toast({
        title: '❌ Estoque insuficiente',
        description: `Restam apenas ${maxQty} unidade(s) disponível(is).`,
        variant: 'destructive',
      });
      return;
    }
    addToCart({
      estId,
      menuId,
      itemId: item.id,
      name: item.name,
      unitPrice: effective,
      currencyId: currency.id,
      qty,
    });
    playClickSound();
    toast({
      title: '🛒 Adicionado ao carrinho',
      description: `${qty}× ${item.name}`,
    });
    setQty(1);
  };

  return (
    <div className="rounded border border-border/40 bg-card/40 px-2 py-1.5 text-sm space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-foreground truncate">{item.name}</span>
            {item.isFood && (
              <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neon-yellow">
                🍽️ Comida
              </span>
            )}
            {item.hiddenMode === 'soldout' && (
              <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neon-yellow">
                Esgotado
              </span>
            )}
            {!isMaster && stockOut && item.hiddenMode !== 'soldout' && (
              <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neon-yellow">
                Esgotado
              </span>
            )}
            {stock !== undefined && !stockOut && (
              <span className="rounded-full bg-secondary/40 border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                Estoque: {stock}
              </span>
            )}
            {isMaster && item.hiddenMode === 'invisible' && (
              <span className="rounded-full bg-hp/15 border border-hp/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-hp">
                Oculto
              </span>
            )}
          </div>
          {item.description && (
            <div className="text-xs text-muted-foreground truncate italic">
              {item.description}
            </div>
          )}
          {item.isFood && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {(item.hungerRestore ?? 0) > 0 && (
                <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-1.5 py-0.5 text-[10px] text-neon-yellow">
                  🍞 +{item.hungerRestore}
                </span>
              )}
              {(item.hpRestore ?? 0) > 0 && (
                <span className="rounded-full bg-hp/15 border border-hp/30 px-1.5 py-0.5 text-[10px] text-hp">
                  ❤️ +{item.hpRestore}
                </span>
              )}
              {(item.peRestore ?? 0) > 0 && (
                <span className="rounded-full bg-pe/15 border border-pe/30 px-1.5 py-0.5 text-[10px] text-pe">
                  💠 +{item.peRestore}
                </span>
              )}
              {(item.pvtRestore ?? 0) > 0 && (
                <span className="rounded-full bg-shield/15 border border-shield/30 px-1.5 py-0.5 text-[10px] text-shield">
                  🛡️ +{item.pvtRestore}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {hasDiscount && (
            <span className="rounded-full bg-accent/15 border border-accent/30 px-1.5 py-0.5 text-[10px] font-bold text-accent">
              -{percentEquivalent}%
            </span>
          )}
          {hasDiscount && (
            <span className="text-xs text-muted-foreground line-through font-mono">
              {currency?.symbol ?? ''}{item.cost}
            </span>
          )}
          <div className={cn(
            "flex items-center gap-1 font-mono font-bold",
            hasDiscount ? "text-accent" : "text-xp"
          )}>
            <Coins className="h-3 w-3" />
            {currency?.symbol ?? ''}
            {effective}
          </div>
        </div>
        {isPlayer && !isUnavailable && effective >= 0 && currency && (
          <div className="flex items-center gap-1">
            <div className="flex items-center rounded border border-border bg-background">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                disabled={qty <= 1}
                className="rounded-l p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                title="Diminuir"
              >
                <Minus className="h-3 w-3" />
              </button>
              <input
                type="number"
                min={1}
                max={maxQty}
                value={qty}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v)) setQty(Math.max(1, Math.min(maxQty, v)));
                }}
                className="w-10 bg-transparent text-center text-xs font-mono tabular-nums outline-none"
              />
              <button
                onClick={() => setQty(Math.min(maxQty, qty + 1))}
                disabled={qty >= maxQty}
                className="rounded-r p-1 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                title="Aumentar"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <button
              onClick={handleAdd}
              disabled={maxQty < 1}
              className="flex items-center gap-1 rounded bg-primary/20 px-2 py-1 text-xs text-primary hover:bg-primary/30 transition-all disabled:opacity-40"
              title="Adicionar ao carrinho"
            >
              <ShoppingCart className="h-3 w-3" /> Carrinho
            </button>
          </div>
        )}
        {isPlayer && isUnavailable && (
          <span className="flex items-center gap-1 rounded bg-muted/40 px-2 py-1 text-xs text-muted-foreground italic">
            Indisponível
          </span>
        )}
        {canEdit && (
          <div className="flex gap-0.5">
            <button
              onClick={onEdit}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-primary"
              title="Editar item"
            >
              <Edit2 className="h-3 w-3" />
            </button>
            <VisibilityToggle
              value={item.hiddenMode}
              onChange={(v) => onUpdateItem({ hiddenMode: v })}
              size="sm"
            />
            <button
              onClick={() => {
                playClickSound();
                onOpenDiscount({
                  targetType: 'item',
                  targetId: item.id,
                  targetName: item.name,
                  parentEstId: estId,
                  parentMenuId: menuId,
                });
              }}
              className="rounded p-1 text-muted-foreground hover:bg-accent/20 hover:text-accent"
              title="Descontos do item"
            >
              <Percent className="h-3 w-3" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Excluir "${item.name}"?`)) onRemove();
              }}
              className="rounded p-1 text-muted-foreground hover:bg-hp/20 hover:text-hp"
              title="Excluir item"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: MenuItem;
  onSave: (data: {
    name: string;
    description?: string;
    cost: number;
    currencyId?: string;
    isFood?: boolean;
    hungerRestore?: number;
    hpRestore?: number;
    peRestore?: number;
    pvtRestore?: number;
    stock?: number;
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [cost, setCost] = useState<string>(initial?.cost?.toString() ?? '0');
  const currencies = useMoneyStore((s) => s.currencies);
  const defaultCurrencyId =
    currencies.find((c) => c.isDefault)?.id ?? currencies[0]?.id ?? '';
  const [currencyId, setCurrencyId] = useState<string>(initial?.currencyId ?? defaultCurrencyId);
  const [isFood, setIsFood] = useState<boolean>(initial?.isFood ?? false);
  const [hungerRestore, setHungerRestore] = useState<string>(
    initial?.hungerRestore?.toString() ?? '0',
  );
  const [hpRestore, setHpRestore] = useState<string>(initial?.hpRestore?.toString() ?? '0');
  const [peRestore, setPeRestore] = useState<string>(initial?.peRestore?.toString() ?? '0');
  const [pvtRestore, setPvtRestore] = useState<string>(initial?.pvtRestore?.toString() ?? '0');
  // Estoque: '' = ilimitado; número >= 0 = quantidade disponível.
  const [stockUnlimited, setStockUnlimited] = useState<boolean>(initial?.stock === undefined);
  const [stock, setStock] = useState<string>(
    initial?.stock !== undefined ? String(initial.stock) : '10',
  );

  return (
    <div className="rounded border border-primary/30 bg-card/80 p-2 space-y-1.5">
      <div className="flex gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do item *"
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
        />
        <div className="flex items-center gap-1 rounded border border-border bg-background px-2">
          <Coins className="h-3 w-3 text-xp" />
          <input
            type="number"
            min={0}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-20 bg-transparent py-1 text-sm font-mono"
          />
          <select
            value={currencyId}
            onChange={(e) => setCurrencyId(e.target.value)}
            className="bg-transparent py-1 text-xs text-foreground outline-none"
            title="Moeda"
          >
            {currencies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.symbol} {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição (opcional)"
        className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
      />

      {/* Estoque */}
      <div className="rounded border border-border bg-background/40 p-2 flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={stockUnlimited}
            onChange={(e) => setStockUnlimited(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          📦 Estoque ilimitado
        </label>
        {!stockUnlimited && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Unidades disponíveis:</span>
            <input
              type="number"
              min={0}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="h-7 w-20 rounded border border-input bg-background px-1 text-foreground text-xs font-mono"
            />
          </div>
        )}
      </div>

      {/* Comida / Consumível restaurador */}
      <div className="rounded border border-neon-yellow/30 bg-neon-yellow/5 p-2">
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neon-yellow cursor-pointer">
          <input
            type="checkbox"
            checked={isFood}
            onChange={(e) => setIsFood(e.target.checked)}
            className="h-3.5 w-3.5 accent-neon-yellow"
          />
          🍽️ É comida / consumível restaurador
        </label>
        {isFood && (
          <>
            <div className="grid grid-cols-4 gap-1 mt-2">
              {([
                { label: '🍞 Fome', value: hungerRestore, set: setHungerRestore, max: 24 },
                { label: '❤️ PV', value: hpRestore, set: setHpRestore, max: undefined },
                { label: '💠 PE', value: peRestore, set: setPeRestore, max: undefined },
                { label: '🛡️ PVT', value: pvtRestore, set: setPvtRestore, max: undefined },
              ] as const).map(({ label, value, set, max }) => (
                <div key={label} className="flex items-center gap-1">
                  <label className="text-[11px] text-muted-foreground w-12 truncate" title={label}>
                    {label}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={max}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    className="h-7 w-full rounded border border-input bg-background px-1 text-foreground text-xs"
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground italic mt-1">
              Ao confirmar a compra, os efeitos são aplicados na ficha. Origem CAM não recebe.
            </p>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-secondary"
        >
          Cancelar
        </button>
        <button
          onClick={() => {
            if (!name.trim()) return;
            const n = Number(cost);
            const toNum = (s: string) => {
              const v = Number(s);
              return Number.isFinite(v) && v > 0 ? v : 0;
            };
            onSave({
              name: name.trim(),
              description: description.trim() || undefined,
              cost: Number.isFinite(n) ? n : 0,
              currencyId: currencyId || undefined,
              isFood,
              hungerRestore: isFood ? Math.min(24, toNum(hungerRestore)) : 0,
              hpRestore: isFood ? toNum(hpRestore) : 0,
              peRestore: isFood ? toNum(peRestore) : 0,
              pvtRestore: isFood ? toNum(pvtRestore) : 0,
              stock: stockUnlimited
                ? undefined
                : Math.max(0, Math.floor(Number(stock) || 0)),
            });
          }}
          className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground hover:bg-primary/90"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}