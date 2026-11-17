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
  Search,
  Menu as MenuIcon,
  ArrowLeft,
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
  const carts = useCartStore((s) => s.carts);
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
  const [selectedEstId, setSelectedEstId] = useState<string | null>(null);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [creatingEst, setCreatingEst] = useState(false);
  const [editingEstId, setEditingEstId] = useState<string | null>(null);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // forms locais para criar menu/item
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
  const visibleEstablishments = useMemo(
    () => isMaster
      ? establishments
      : establishments.filter((e) => e.hiddenMode !== 'invisible'),
    [establishments, isMaster],
  );
  const establishmentsWithCart = useMemo(
    () => visibleEstablishments.filter((est) => (carts[est.id]?.length ?? 0) > 0),
    [carts, visibleEstablishments],
  );

  // Estabelecimento selecionado para o painel direito
  const selectedEst = useMemo(
    () => visibleEstablishments.find((e) => e.id === selectedEstId) ?? null,
    [visibleEstablishments, selectedEstId],
  );

  const handleSelectEst = (est: Establishment) => {
    playToggleSound();
    setSelectedEstId(selectedEstId === est.id ? null : est.id);
    setExpandedMenu(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <ModuleHeader
        icon={Store}
        title="Estabelecimentos"
        subtitle={`(${visibleEstablishments.length})`}
        description="Tavernas, lojas e mercados — cardápios e preços do mundo."
        actions={
          <>
            {isMaster && (
              <button
                onClick={() => { setEditMode(!editMode); playClickSound(); }}
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-all duration-300"
                title={editMode ? 'Modo visualização' : 'Modo edição'}
              >
                {editMode ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4" />}
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => { setCreatingEst(true); playClickSound(); }}
                className="h-10 flex items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 glow-primary transition-all duration-300"
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

      {/* Desktop: two-pane layout — establishments list left, detail right (sticky) */}
      <div className={cn(
        'hidden lg:grid lg:gap-6 lg:items-start',
        isMaster
          ? 'lg:grid-cols-[280px_minmax(0,1fr)]'
          : 'lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px]',
      )}>
        {/* Left Pane — Establishments List */}
        <div className="animate-fade-in space-y-3">
          {visibleEstablishments.length === 0 && !creatingEst ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-8 text-center card-enigmatic">
              <Store className="h-10 w-10 mx-auto mb-3 opacity-50 text-muted-foreground" />
              <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>
                {canEdit
                  ? 'Clique em "Novo Estabelecimento" para começar.'
                  : isMaster
                    ? 'Ative o modo edição (👁) para criar.'
                    : 'Nenhum estabelecimento disponível.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleEstablishments.map((est) => {
                const isSelected = selectedEstId === est.id;
                return (
                  <div
                    key={est.id}
                    className={cn(
                      'rounded-xl border bg-card card-enigmatic overflow-hidden transition-all duration-300',
                      isSelected
                        ? 'border-primary/40 glow-primary shadow-[0_0_20px_-5px_hsl(var(--primary)/0.3)]'
                        : 'border-border hover:border-primary/20'
                    )}
                  >
                    {editingEstId === est.id && selectedEstId !== est.id ? (
                      <EstablishmentForm
                        initial={est}
                        onCancel={() => setEditingEstId(null)}
                        onSave={(data) => {
                          updateEstablishment(est.id, data);
                          setEditingEstId(null);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelectEst(est)}
                        className="w-full flex items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset"
                        aria-pressed={isSelected}
                      >
                        <Store className={cn('h-5 w-5 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className={cn(
                              'font-bold text-foreground truncate',
                              isSelected ? '' : ''
                            )} style={{ fontFamily: "'Cinzel', serif" }}>
                              {est.name}
                            </span>
                            {est.type && (
                              <span className="text-xs italic text-muted-foreground">— {est.type}</span>
                            )}
                            {est.hiddenMode === 'soldout' && (
                              <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-neon-yellow">
                                Esgotado
                              </span>
                            )}
                            {isMaster && est.hiddenMode === 'invisible' && (
                              <span className="rounded-full bg-hp/15 border border-hp/30 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-hp">
                                Oculto
                              </span>
                            )}
                          </div>
                          {est.location && (
                            <span className="block text-xs text-muted-foreground truncate">{est.location}</span>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              aria-label={'Editar ' + est.name}
                              onClick={(e) => { e.stopPropagation(); setEditingEstId(est.id); }}
                              className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary transition-all"
                              title="Editar"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <VisibilityToggle
                              value={est.hiddenMode}
                              onChange={(v) => updateEstablishment(est.id, { hiddenMode: v })}
                            />
                            <button
                              type="button"
                              aria-label={'Descontos de ' + est.name}
                              onClick={(e) => {
                                e.stopPropagation();
                                playClickSound();
                                setDiscountDialog({
                                  targetType: 'establishment',
                                  targetId: est.id,
                                  targetName: est.name,
                                });
                              }}
                              className="rounded p-1.5 text-muted-foreground hover:bg-accent/20 hover:text-accent transition-all"
                              title="Descontos do estabelecimento"
                            >
                              <Percent className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={'Excluir ' + est.name}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Excluir "${est.name}"?`)) removeEstablishment(est.id);
                              }}
                              className="rounded p-1.5 text-muted-foreground hover:bg-hp/20 hover:text-hp transition-all"
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {canEdit && visibleEstablishments.length > 0 && (
            <button
              onClick={() => { setCreatingEst(true); playClickSound(); }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm text-primary hover:bg-primary/10 transition-all duration-300"
            >
              <Plus className="h-4 w-4" /> Novo Estabelecimento
            </button>
          )}
        </div>

        {/* Right Pane — Selected Establishment Detail (sticky on desktop) */}
        <div className="lg:sticky lg:top-24 animate-fade-in" style={{ animationDelay: '60ms' }}>
          {selectedEst ? (
            <EstablishmentDetail
              est={selectedEst}
              canEdit={canEdit}
              isMaster={isMaster}
              expandedMenu={expandedMenu}
              setExpandedMenu={setExpandedMenu}
              onUpdateMenu={(menuId, u) => updateMenu(selectedEst.id, menuId, u)}
              onRemoveMenu={(menuId) => removeMenu(selectedEst.id, menuId)}
              onAddMenu={(menu) => addMenu(selectedEst.id, menu)}
              onUpdateEstablishment={(updates) => updateEstablishment(selectedEst.id, updates)}
              editingEstId={editingEstId}
              setEditingEstId={setEditingEstId}
              onAddItem={(menuId, it) => addMenuItem(selectedEst.id, menuId, it)}
              onUpdateItem={(menuId, itId, u) => updateMenuItem(selectedEst.id, menuId, itId, u)}
              onRemoveItem={(menuId, itId) => removeMenuItem(selectedEst.id, menuId, itId)}
              newItemFor={newItemFor}
              setNewItemFor={setNewItemFor}
              onOpenDiscount={setDiscountDialog}
              editingMenuId={editingMenuId}
              setEditingMenuId={setEditingMenuId}
              editingItemId={editingItemId}
              setEditingItemId={setEditingItemId}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-12 text-center card-enigmatic animate-fade-in">
              <MenuIcon className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
              <h3 className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: "'Cinzel', serif" }}>Selecione um estabelecimento</h3>
              <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>
                Clique em um estabelecimento à esquerda para ver seus cardápios e itens.
              </p>
            </div>
          )}
        </div>
        {!isMaster && (
          <aside className="lg:col-span-2 xl:col-span-1 xl:sticky xl:top-24 min-w-0 space-y-3" aria-label="Carrinhos de compra">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
              <h2 className="font-display text-base font-semibold uppercase tracking-wider text-foreground">
                Carrinho
              </h2>
              <span className="font-mono text-sm text-muted-foreground">
                {establishmentsWithCart.length} {establishmentsWithCart.length === 1 ? 'loja' : 'lojas'}
              </span>
            </div>
            {establishmentsWithCart.length > 0 ? establishmentsWithCart.map((est) => (
              <CartPanel key={est.id} estId={est.id} estName={est.name} />
            )) : (
              <p className="rounded-xl border border-dashed border-border/60 bg-card/30 p-4 text-base text-muted-foreground">
                Seu carrinho está vazio. Adicione itens em um estabelecimento para começar.
              </p>
            )}
          </aside>
        )}
      </div>

      {/* Mobile: stacked layout */}
      <div className="lg:hidden animate-fade-in" style={{ animationDelay: '120ms' }}>
        {selectedEst ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => { setSelectedEstId(null); setExpandedMenu(null); }}
              className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-base text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Estabelecimentos
            </button>
            <EstablishmentDetail
              est={selectedEst}
              canEdit={canEdit}
              isMaster={isMaster}
              expandedMenu={expandedMenu}
              setExpandedMenu={setExpandedMenu}
              onUpdateMenu={(menuId, u) => updateMenu(selectedEst.id, menuId, u)}
              onRemoveMenu={(menuId) => removeMenu(selectedEst.id, menuId)}
              onAddMenu={(menu) => addMenu(selectedEst.id, menu)}
              onUpdateEstablishment={(updates) => updateEstablishment(selectedEst.id, updates)}
              editingEstId={editingEstId}
              setEditingEstId={setEditingEstId}
              onAddItem={(menuId, it) => addMenuItem(selectedEst.id, menuId, it)}
              onUpdateItem={(menuId, itId, u) => updateMenuItem(selectedEst.id, menuId, itId, u)}
              onRemoveItem={(menuId, itId) => removeMenuItem(selectedEst.id, menuId, itId)}
              newItemFor={newItemFor}
              setNewItemFor={setNewItemFor}
              onOpenDiscount={setDiscountDialog}
              editingMenuId={editingMenuId}
              setEditingMenuId={setEditingMenuId}
              editingItemId={editingItemId}
              setEditingItemId={setEditingItemId}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {visibleEstablishments.map((est) => {
              const isOpen = selectedEstId === est.id;
              return (
                <div
                  key={est.id}
                  className={cn(
                    'rounded-xl border bg-card card-enigmatic overflow-hidden transition-all duration-300',
                    isOpen ? 'border-primary/40 glow-primary' : 'border-border'
                  )}
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
                    <button
                      type="button"
                      onClick={() => handleSelectEst(est)}
                      className="w-full flex items-center gap-3 p-3 text-left"
                      aria-expanded={isOpen}
                    >
                      <Store className={cn('h-5 w-5 shrink-0', isOpen ? 'text-primary' : 'text-muted-foreground')} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-bold text-foreground" style={{ fontFamily: "'Cinzel', serif" }}>
                            {est.name}
                          </span>
                          {est.type && (
                            <span className="text-xs italic text-muted-foreground">— {est.type}</span>
                          )}
                          {est.hiddenMode === 'soldout' && (
                            <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-neon-yellow">
                              Esgotado
                            </span>
                          )}
                          {isMaster && est.hiddenMode === 'invisible' && (
                            <span className="rounded-full bg-hp/15 border border-hp/30 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-hp">
                              Oculto
                            </span>
                          )}
                        </div>
                        {est.location && (
                          <span className="block text-xs text-muted-foreground truncate">{est.location}</span>
                        )}
                      </div>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-primary" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  )}
                  {isOpen && (
                    <div className="border-t border-border p-3 space-y-2 bg-background/30 animate-fade-in">
                      <EstablishmentDetail
                        est={est}
                        canEdit={canEdit}
                        isMaster={isMaster}
                        expandedMenu={expandedMenu}
                        setExpandedMenu={setExpandedMenu}
                        onUpdateMenu={(menuId, u) => updateMenu(est.id, menuId, u)}
                        onRemoveMenu={(menuId) => removeMenu(est.id, menuId)}
                        onAddMenu={(menu) => addMenu(est.id, menu)}
                        onUpdateEstablishment={(updates) => updateEstablishment(est.id, updates)}
                        editingEstId={editingEstId}
                        setEditingEstId={setEditingEstId}
                        onAddItem={(menuId, it) => addMenuItem(est.id, menuId, it)}
                        onUpdateItem={(menuId, itId, u) => updateMenuItem(est.id, menuId, itId, u)}
                        onRemoveItem={(menuId, itId) => removeMenuItem(est.id, menuId, itId)}
                        newItemFor={newItemFor}
                        setNewItemFor={setNewItemFor}
                        onOpenDiscount={setDiscountDialog}
                        editingMenuId={editingMenuId}
                        setEditingMenuId={setEditingMenuId}
                        editingItemId={editingItemId}
                        setEditingItemId={setEditingItemId}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {visibleEstablishments.length === 0 && !creatingEst && (
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
        )}
        {!isMaster && (
          <section className="mt-6 space-y-3" aria-label="Carrinhos de compra">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
              <h2 className="font-display text-base font-semibold uppercase tracking-wider text-foreground">
                Carrinho
              </h2>
              <span className="font-mono text-sm text-muted-foreground">
                {establishmentsWithCart.length} {establishmentsWithCart.length === 1 ? 'loja' : 'lojas'}
              </span>
            </div>
            {establishmentsWithCart.length > 0 ? establishmentsWithCart.map((est) => (
              <CartPanel key={est.id} estId={est.id} estName={est.name} />
            )) : (
              <p className="rounded-xl border border-dashed border-border/60 bg-card/30 p-4 text-base text-muted-foreground">
                Seu carrinho está vazio. Adicione itens em um estabelecimento para começar.
              </p>
            )}
          </section>
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

/* ---------------- Establishment Detail (Right Pane) ---------------- */

interface EstablishmentDetailProps {
  est: Establishment;
  canEdit: boolean;
  isMaster: boolean;
  onAddMenu: (menu: { name: string; description?: string }) => void;
  onUpdateEstablishment: (updates: Partial<Omit<Establishment, 'id' | 'menus'>>) => void;
  editingEstId: string | null;
  setEditingEstId: (id: string | null) => void;
  expandedMenu: string | null;
  setExpandedMenu: (id: string | null) => void;
  onUpdateMenu: (menuId: string, u: Partial<Omit<Menu, 'id' | 'items'>>) => void;
  onRemoveMenu: (menuId: string) => void;
  onAddItem: (menuId: string, it: Omit<MenuItem, 'id'>) => void;
  onUpdateItem: (menuId: string, itId: string, u: Partial<Omit<MenuItem, 'id'>>) => void;
  onRemoveItem: (menuId: string, itId: string) => void;
  newItemFor: { estId: string; menuId: string } | null;
  setNewItemFor: (open: { estId: string; menuId: string } | null) => void;
  onOpenDiscount: (target: {
    targetType: 'establishment' | 'menu' | 'item';
    targetId: string;
    targetName: string;
    parentEstId?: string;
    parentMenuId?: string;
  }) => void;
  editingMenuId: string | null;
  setEditingMenuId: (id: string | null) => void;
  editingItemId: string | null;
  setEditingItemId: (id: string | null) => void;
}

function EstablishmentDetail({
  est,
  canEdit,
  isMaster,
  onAddMenu,
  onUpdateEstablishment,
  editingEstId,
  setEditingEstId,
  expandedMenu,
  setExpandedMenu,
  onUpdateMenu,
  onRemoveMenu,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  newItemFor,
  setNewItemFor,
  onOpenDiscount,
  editingMenuId,
  setEditingMenuId,
  editingItemId,
  setEditingItemId,
}: EstablishmentDetailProps) {
  if (editingEstId === est.id) {
    return (
      <EstablishmentForm
        initial={est}
        onCancel={() => setEditingEstId(null)}
        onSave={(updates) => {
          onUpdateEstablishment(updates);
          setEditingEstId(null);
        }}
      />
    );
  }

  const visibleMenus = isMaster
    ? est.menus
    : est.menus.filter((m) => m.hiddenMode !== 'invisible');

  return (
    <div className="rounded-xl border border-border bg-card card-enigmatic glow-border overflow-hidden space-y-3 animate-fade-in">
      {/* Establishment Header */}
      <div className="p-4 border-b border-border bg-background/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground truncate" style={{ fontFamily: "'Cinzel', serif" }}>
                {est.name}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                {est.type && (
                  <span className="text-xs italic text-muted-foreground">— {est.type}</span>
                )}
                {est.location && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> {est.location}
                  </span>
                )}
                {est.hiddenMode === 'soldout' && (
                  <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-neon-yellow">
                    Esgotado
                  </span>
                )}
                {isMaster && est.hiddenMode === 'invisible' && (
                  <span className="rounded-full bg-hp/15 border border-hp/30 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-hp">
                    Oculto
                  </span>
                )}
              </div>
            </div>
          </div>
          {canEdit && (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                aria-label={'Editar ' + est.name}
                onClick={() => { playClickSound(); setEditingEstId(est.id); }}
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-primary transition-all"
                title="Editar estabelecimento"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <VisibilityToggle
                value={est.hiddenMode}
                onChange={(v) => onUpdateEstablishment({ hiddenMode: v })}
              />
              <button
                type="button"
                aria-label={'Descontos de ' + est.name}
                onClick={() => {
                  playClickSound();
                  onOpenDiscount({
                    targetType: 'establishment',
                    targetId: est.id,
                    targetName: est.name,
                  });
                }}
                className="rounded-lg p-2 text-muted-foreground hover:bg-accent/20 hover:text-accent transition-all"
                title="Descontos do estabelecimento"
              >
                <Percent className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        {est.description && (
          <p className="mt-2 text-xs italic text-muted-foreground" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {est.description}
          </p>
        )}
      </div>

      {/* Menus List */}
      <div className="p-4 space-y-3">
        {visibleMenus.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground italic" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Nenhuma seção cadastrada.
            </p>
            {canEdit && newItemFor?.estId === est.id && newItemFor.menuId === '__new' ? (
              <MenuForm
                onCancel={() => setNewItemFor(null)}
                onSave={(data) => {
                  onAddMenu(data);
                  setNewItemFor(null);
                }}
              />
            ) : canEdit ? (
              <button
                onClick={() => { setNewItemFor({ estId: est.id, menuId: '__new' }); playClickSound(); }}
                className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-accent/40 bg-accent/5 px-3 py-2 text-xs text-accent hover:bg-accent/10 transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar Seção
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleMenus.map((menu) => (
              <MenuBlock
                key={menu.id}
                estId={est.id}
                menu={menu}
                canEdit={canEdit}
                isMaster={isMaster}
                expanded={expandedMenu === menu.id}
                onToggle={() => setExpandedMenu(expandedMenu === menu.id ? null : menu.id)}
                onUpdateMenu={(u) => onUpdateMenu(menu.id, u)}
                onRemoveMenu={() => onRemoveMenu(menu.id)}
                onAddItem={(it) => onAddItem(menu.id, it)}
                onUpdateItem={(itId, u) => onUpdateItem(menu.id, itId, u)}
                onRemoveItem={(itId) => onRemoveItem(menu.id, itId)}
                newItemOpen={newItemFor?.estId === est.id && newItemFor?.menuId === menu.id}
                setNewItemOpen={(open) => setNewItemFor(open ? { estId: est.id, menuId: menu.id } : null)}
                onOpenDiscount={(target) => onOpenDiscount(target)}
                editingMenuId={editingMenuId}
                setEditingMenuId={setEditingMenuId}
                editingItemId={editingItemId}
                setEditingItemId={setEditingItemId}
              />
            ))}
            {canEdit && newItemFor?.estId === est.id && newItemFor?.menuId === '__new' && (
              <MenuForm
                onCancel={() => setNewItemFor(null)}
                onSave={(data) => {
                  onAddMenu(data);
                  setNewItemFor(null);
                }}
              />
            )}
            {canEdit && newItemFor?.estId !== est.id && (
              <button
                onClick={() => { setNewItemFor({ estId: est.id, menuId: '__new' }); playClickSound(); }}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-accent/40 bg-accent/5 px-3 py-2 text-xs text-accent hover:bg-accent/10 transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar Seção
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Menu block ---------------- */

interface MenuBlockProps {
  estId: string;
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
  editingMenuId: string | null;
  setEditingMenuId: (id: string | null) => void;
  editingItemId: string | null;
  setEditingItemId: (id: string | null) => void;
}

function MenuBlock({
  estId,
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
  editingMenuId,
  setEditingMenuId,
  editingItemId,
  setEditingItemId,
}: MenuBlockProps) {
  const visibleItems = isMaster
    ? menu.items
    : menu.items.filter((it) => it.hiddenMode !== 'invisible');

  const isEditing = editingMenuId === menu.id;

  // Early return for editing mode
  if (isEditing) {
    return (
      <div className="rounded-lg border border-border/60 bg-card/50 overflow-hidden card-enigmatic">
        <MenuForm
          initial={menu}
          onCancel={() => setEditingMenuId(null)}
          onSave={(data) => {
            onUpdateMenu(data);
            setEditingMenuId(null);
          }}
        />
      </div>
    );
  }

  // Build header actions when canEdit
  const headerActions = canEdit ? (
    <div className="border-t border-border/60 px-3 py-2 flex items-center justify-end gap-1 bg-background/30">
      <button
        type="button"
        aria-label={'Editar seção ' + menu.name}
        onClick={() => setEditingMenuId(menu.id)}
        className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary transition-all"
        title="Editar seção"
      >
        <Edit2 className="h-3.5 w-3.5" />
      </button>
      <VisibilityToggle
        value={menu.hiddenMode}
        onChange={(v) => onUpdateMenu({ hiddenMode: v })}
        size="sm"
      />
      <button
        type="button"
        aria-label={'Descontos de ' + menu.name}
        onClick={() => {
          playClickSound();
          onOpenDiscount({
            targetType: 'menu',
            targetId: menu.id,
            targetName: menu.name,
            parentEstId: estId,
          });
        }}
        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/20 hover:text-accent transition-all"
        title="Descontos do cardápio"
      >
        <Percent className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={'Excluir seção ' + menu.name}
        onClick={() => {
          if (confirm(`Excluir seção "${menu.name}"?`)) onRemoveMenu();
        }}
        className="rounded-lg p-1.5 text-muted-foreground hover:bg-hp/20 hover:text-hp transition-all"
        title="Excluir seção"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  ) : null;

  // Build items list
  const itemsList = (
    <div className="space-y-1.5">
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
            estId={estId}
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
    </div>
  );

  // Build add item button or form
  const addItemSection = canEdit && newItemOpen ? (
    <ItemForm
      onCancel={() => setNewItemOpen(false)}
      onSave={(data) => {
        onAddItem(data);
        setNewItemOpen(false);
      }}
    />
  ) : canEdit ? (
    <button
      onClick={() => { setNewItemOpen(true); playClickSound(); }}
      className="w-full flex items-center justify-center gap-1 rounded-lg border border-dashed border-accent/40 bg-accent/5 px-2 py-1.5 text-xs text-accent hover:bg-accent/10 transition-all"
    >
      <Plus className="h-3 w-3" /> Adicionar Item
    </button>
  ) : null;

  // Build empty state for non-editors
  const emptyState = menu.items.length === 0 && !canEdit ? (
    <p className="text-xs italic text-muted-foreground text-center py-2">Nenhum item.</p>
  ) : null;

  // Build expanded content
  const expandedContent = expanded ? (
    <div className="border-t border-border/60 p-3 space-y-2 bg-background/40 animate-fade-in">
      {menu.description && (
        <p className="text-xs italic text-muted-foreground" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          {menu.description}
        </p>
      )}
      {itemsList}
      {addItemSection}
      {emptyState}
    </div>
  ) : null;

  return (
    <div className="rounded-lg border border-border/60 bg-card/50 overflow-hidden card-enigmatic">
      <div>
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center gap-2 p-3 hover:bg-secondary/20 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset transition-all"
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-primary" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Tag className="h-4 w-4 shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{menu.name}</span>
          {menu.hiddenMode === 'soldout' && (
            <span className="shrink-0 rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-neon-yellow">
              Esgotado
            </span>
          )}
          {isMaster && menu.hiddenMode === 'invisible' && (
            <span className="shrink-0 rounded-full bg-hp/15 border border-hp/30 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-hp">
              Oculto
            </span>
          )}
          <span className="shrink-0 text-xs text-muted-foreground">
            {visibleItems.length} {visibleItems.length === 1 ? 'item' : 'itens'}
          </span>
        </button>
        {headerActions}
        {expandedContent}
      </div>
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
    <div className="rounded-lg border border-primary/40 bg-card/80 p-4 space-y-3 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do estabelecimento *"
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        />
        <input
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="Tipo (loja, restaurante, bar, loja jujutsu...)"
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        />
      </div>
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Localização"
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição"
        rows={2}
        className="h-20 w-full rounded-lg border border-input bg-background px-3 text-sm"
      />
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="h-10 rounded-lg border border-border px-4 text-sm text-muted-foreground hover:bg-secondary transition-all"
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
            playClickSound();
          }}
          className="h-10 rounded-lg bg-primary px-4 text-sm text-primary-foreground glow-primary hover:bg-primary/90 transition-all"
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
    <div className="rounded-lg border border-accent/40 bg-card/80 p-3 space-y-2 animate-fade-in">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nome da seção (ex.: Armas, Bebidas, Pergaminhos) *"
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição (opcional)"
        rows={2}
        className="h-20 w-full rounded-lg border border-input bg-background px-3 text-sm"
      />
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="h-9 rounded-lg border border-border px-3 text-xs text-muted-foreground hover:bg-secondary transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={() => {
            if (!name.trim()) return;
            onSave({ name: name.trim(), description: description.trim() || undefined });
            playClickSound();
          }}
          className="h-9 rounded-lg bg-accent px-3 text-xs text-accent-foreground hover:bg-accent/90 transition-all"
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
    <div className="rounded-lg border border-border/40 bg-card/40 p-3 space-y-2 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-foreground truncate">{item.name}</span>
            {item.isFood && (
              <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-neon-yellow">
                🍽️ Comida
              </span>
            )}
            {item.hiddenMode === 'soldout' && (
              <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-neon-yellow">
                Esgotado
              </span>
            )}
            {!isMaster && stockOut && item.hiddenMode !== 'soldout' && (
              <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-neon-yellow">
                Esgotado
              </span>
            )}
            {stock !== undefined && !stockOut && (
              <span className="rounded-full bg-secondary/40 border border-border px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                Estoque: {stock}
              </span>
            )}
            {isMaster && item.hiddenMode === 'invisible' && (
              <span className="rounded-full bg-hp/15 border border-hp/30 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-hp">
                Oculto
              </span>
            )}
          </div>
          {item.description && (
            <div className="text-xs text-muted-foreground truncate italic mt-0.5" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              {item.description}
            </div>
          )}
          {item.isFood && (
            <div className="flex flex-wrap gap-1 mt-1">
              {(item.hungerRestore ?? 0) > 0 && (
                <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-1.5 py-0.5 text-xs text-neon-yellow">
                  🍞 +{item.hungerRestore}
                </span>
              )}
              {(item.hpRestore ?? 0) > 0 && (
                <span className="rounded-full bg-hp/15 border border-hp/30 px-1.5 py-0.5 text-xs text-hp">
                  ❤️ +{item.hpRestore}
                </span>
              )}
              {(item.peRestore ?? 0) > 0 && (
                <span className="rounded-full bg-pe/15 border border-pe/30 px-1.5 py-0.5 text-xs text-pe">
                  💠 +{item.peRestore}
                </span>
              )}
              {(item.pvtRestore ?? 0) > 0 && (
                <span className="rounded-full bg-shield/15 border border-shield/30 px-1.5 py-0.5 text-xs text-shield">
                  🛡️ +{item.pvtRestore}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
          {hasDiscount && (
            <span className="rounded-full bg-accent/15 border border-accent/30 px-1.5 py-0.5 text-xs font-bold text-accent">
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
            <Coins className="h-3.5 w-3.5" />
            {currency?.symbol ?? ''}
            {effective}
          </div>
        </div>
        {isPlayer && !isUnavailable && effective >= 0 && currency && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center rounded-lg border border-border bg-background">
              <button
                onClick={() => setQty(Math.max(1, qty - 1))}
                disabled={qty <= 1}
                className="rounded-l-lg p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-30 transition-all"
                title="Diminuir"
              >
                <Minus className="h-3.5 w-3.5" />
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
                className="w-12 bg-transparent text-center text-xs font-mono tabular-nums outline-none h-9"
              />
              <button
                onClick={() => setQty(Math.min(maxQty, qty + 1))}
                disabled={qty >= maxQty}
                className="rounded-r-lg p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-30 transition-all"
                title="Aumentar"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={handleAdd}
              disabled={maxQty < 1}
              className="h-9 flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 text-xs text-primary hover:bg-primary/30 transition-all disabled:opacity-40"
              title="Adicionar ao carrinho"
            >
              <ShoppingCart className="h-3.5 w-3.5" /> Carrinho
            </button>
          </div>
        )}
        {isPlayer && isUnavailable && (
          <span className="flex items-center gap-1 rounded-lg bg-muted/40 px-2 py-1 text-xs text-muted-foreground italic shrink-0">
            Indisponível
          </span>
        )}
        {canEdit && (
          <div className="flex gap-0.5 shrink-0">
            <button
              onClick={onEdit}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary transition-all"
              title="Editar item"
            >
              <Edit2 className="h-3.5 w-3.5" />
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
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/20 hover:text-accent transition-all"
              title="Descontos do item"
            >
              <Percent className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Excluir "${item.name}"?`)) onRemove();
              }}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-hp/20 hover:text-hp transition-all"
              title="Excluir item"
            >
              <Trash2 className="h-3.5 w-3.5" />
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
    <div className="rounded-lg border border-primary/30 bg-card/80 p-3 space-y-2 animate-fade-in">
      <div className="flex gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do item *"
          className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
        />
        <div className="flex items-center gap-1 rounded-lg border border-input bg-background px-2">
          <Coins className="h-3.5 w-3.5 text-xp" />
          <input
            type="number"
            min={0}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-20 bg-transparent py-1.5 text-sm font-mono outline-none"
          />
          <select
            value={currencyId}
            onChange={(e) => setCurrencyId(e.target.value)}
            className="bg-transparent py-1.5 text-xs text-foreground outline-none"
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
        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
      />

      {/* Estoque */}
      <div className="rounded-lg border border-border bg-background/40 p-2 flex items-center gap-3 flex-wrap">
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
              className="h-9 w-20 rounded-lg border border-input bg-background px-2 text-foreground text-xs font-mono"
            />
          </div>
        )}
      </div>

      {/* Comida / Consumível restaurador */}
      <div className="rounded-lg border border-neon-yellow/30 bg-neon-yellow/5 p-3">
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
            <div className="grid grid-cols-4 gap-2 mt-2">
              {([
                { label: '🍞 Fome', value: hungerRestore, set: setHungerRestore, max: 24 },
                { label: '❤️ PV', value: hpRestore, set: setHpRestore, max: undefined },
                { label: '💠 PE', value: peRestore, set: setPeRestore, max: undefined },
                { label: '🛡️ PVT', value: pvtRestore, set: setPvtRestore, max: undefined },
              ] as const).map(({ label, value, set, max }) => (
                <div key={label} className="flex items-center gap-1">
                  <label className="text-xs text-muted-foreground w-14 truncate" title={label}>
                    {label}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={max}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-foreground text-xs"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground italic mt-1">
              Ao confirmar a compra, os efeitos são aplicados na ficha. Origem CAM não recebe.
            </p>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="h-9 rounded-lg border border-border px-3 text-xs text-muted-foreground hover:bg-secondary transition-all"
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
            playClickSound();
          }}
          className="h-9 rounded-lg bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90 glow-primary transition-all"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
