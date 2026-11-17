import { useEffect, useRef, useState } from 'react';
import {
  LogOut, Clock, Users, Swords, CalendarDays, Settings, BookOpen, Wand2, Coins, Store, GripVertical, Sparkles, Library, Map as MapIcon, Globe, Archive, Skull, Ghost, ChevronDown, Check, Menu,
} from 'lucide-react';
import { RIcon } from '@/components/icons/RIcon';
import { useRoleStore, type UserRole } from '@/stores/useRoleStore';
import { useTabOrderStore } from '@/stores/useTabOrderStore';
import { cn } from '@/lib/utils';
import { MiniClock } from '@/components/chronos/MiniClock';
import { usePendingDebates } from '@/hooks/usePendingDebates';
import { MasterAccountsDialog } from '@/components/MasterAccountsDialog';
import { signOutAll } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type TabId = 'relogio' | 'fichas' | 'invocacoes' | 'itens' | 'baus' | 'calendario' | 'sistema' | 'guia' | 'feiticos-players' | 'money' | 'cardapios' | 'omni' | 'catalogo' | 'testes' | 'mapa' | 'mundo' | 'grimorio';

const TAB_LABELS: Record<TabId, string> = {
  relogio: 'Relógio',
  fichas: 'Fichas',
  invocacoes: 'Invocações',
  'feiticos-players': 'Debates',
  itens: 'Itens',
  baus: 'Baús',
  money: 'Money',
  cardapios: 'Estabelecimentos',
  calendario: 'Calendário',
  sistema: 'Sistema',
  guia: 'Guia',
  omni: 'Omni-Engine',
  catalogo: 'Catálogo',
  testes: 'Testes',
  mapa: 'Mapa',
  mundo: 'Mundo',
  grimorio: 'Grimório',
};

const TAB_ICONS: Record<TabId, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  relogio: Clock,
  fichas: Users,
  invocacoes: Ghost,
  'feiticos-players': Wand2,
  itens: Swords,
  baus: Archive,
  money: Coins,
  cardapios: Store,
  calendario: CalendarDays,
  sistema: Settings,
  guia: BookOpen,
  omni: Sparkles,
  catalogo: Library,
  testes: RIcon,
  mapa: MapIcon,
  mundo: Globe,
  grimorio: Skull,
};

const PLAYER_TABS: TabId[] = ['relogio', 'fichas', 'invocacoes', 'feiticos-players', 'money', 'cardapios', 'calendario', 'omni', 'mapa', 'guia'];
const ALL_TABS: TabId[] = ['relogio', 'fichas', 'invocacoes', 'feiticos-players', 'itens', 'baus', 'money', 'cardapios', 'calendario', 'omni', 'catalogo', 'mapa', 'grimorio', 'sistema', 'guia'];
const VISIBLE_TABS_COUNT = { MASTER: 4, PLAYER: 5 } as const;

export function getTabsForRole(role: UserRole): TabId[] {
  if (role === 'PLAYER') return PLAYER_TABS;
  return ALL_TABS;
}

interface HeaderProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  immersive?: boolean;
  testsOpen?: boolean;
  onToggleTests?: () => void;
  onOpenDiary?: () => void;
}

/**
 * Topbar global com navegação horizontal de módulos (drag-and-drop preservado).
 */
export function Header({ activeTab, onTabChange, immersive = false, testsOpen = false, onToggleTests, onOpenDiary }: HeaderProps) {
  const role = useRoleStore((s) => s.role);
  const logout = useRoleStore((s) => s.logout);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [modulesMenuOpen, setModulesMenuOpen] = useState(false);
  const [overModulesButton, setOverModulesButton] = useState(false);
  const activeMenuItemRef = useRef<HTMLDivElement | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState('');

  useEffect(() => {
    if (!immersive) return;
    setAccountsOpen(false);
    setModulesMenuOpen(false);
    setOverModulesButton(false);
  }, [immersive]);
  const setOrder = useTabOrderStore((s) => s.setOrder);
  const savedOrders = useTabOrderStore((s) => s.orders);
  const pending = usePendingDebates();
  const navRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  const defaults: TabId[] = role ? getTabsForRole(role) : [];
  const roleKey = role ?? null;
  const savedForRole = roleKey ? savedOrders[roleKey] : undefined;
  const allowed = new Set(defaults);
  const tabs: TabId[] = savedForRole
    ? [
        ...savedForRole.filter((id) => allowed.has(id)),
        ...defaults.filter((id) => !savedForRole.includes(id)),
      ]
    : defaults;
  const visibleTabsCount = role === 'PLAYER' ? VISIBLE_TABS_COUNT.PLAYER : VISIBLE_TABS_COUNT.MASTER;
  const primaryTabs = tabs.slice(0, visibleTabsCount);
  const overflowTabs = tabs.slice(visibleTabsCount);
  const isActiveInModulesMenu = overflowTabs.includes(activeTab);

  const [dragId, setDragId] = useState<TabId | null>(null);
  const [overId, setOverId] = useState<TabId | null>(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTab]);

  const scrollMenu = (event: React.WheelEvent<HTMLDivElement>) => {
    const menu = navRef.current;
    if (!menu || menu.scrollWidth <= menu.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    menu.scrollBy({ left: event.deltaY, behavior: 'smooth' });
  };

  const handleDragStart = (id: TabId) => (event: React.DragEvent<HTMLElement>) => {
    if (!roleKey) return;
    setDragId(id);
    event.dataTransfer.effectAllowed = 'move';
    try { event.dataTransfer.setData('text/plain', id); } catch { /* noop */ }
  };

  const handleDragOver = (id: TabId) => (event: React.DragEvent<HTMLElement>) => {
    if (!dragId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (overId !== id) setOverId(id);
  };

  const handleDragLeave = (id: TabId) => {
    if (overId === id) setOverId(null);
  };

  const handleDrop = (targetId: TabId) => {
    if (!dragId || !roleKey || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const next = [...tabs];
    const from = next.indexOf(dragId);
    if (from === -1) return;
    next.splice(from, 1);
    const to = next.indexOf(targetId);
    if (to === -1) return;
    next.splice(to, 0, dragId);
    setOrder(roleKey, next);
    setDragId(null);
    setOverId(null);
    setOverModulesButton(false);
  };

  const handleDropIntoModules = () => {
    if (!dragId || !roleKey) {
      setDragId(null);
      setOverId(null);
      setOverModulesButton(false);
      return;
    }
    const next = [...tabs];
    const from = next.indexOf(dragId);
    if (from === -1) return;
    next.splice(from, 1);
    next.splice(Math.min(visibleTabsCount, next.length), 0, dragId);
    setOrder(roleKey, next);
    setDragId(null);
    setOverId(null);
    setOverModulesButton(false);
    setModulesMenuOpen(false);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setOverId(null);
    setOverModulesButton(false);
  };

  const handleKeyboardReorder = (id: TabId) => (event: React.KeyboardEvent<HTMLElement>) => {
    if (!roleKey || !event.shiftKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    event.stopPropagation();
    const from = tabs.indexOf(id);
    const to = from + (event.key === 'ArrowUp' ? -1 : 1);
    if (from < 0 || to < 0 || to >= tabs.length) return;
    const next = [...tabs];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setOrder(roleKey, next);
    setReorderAnnouncement(`${TAB_LABELS[id]} movido para a posi\u00e7\u00e3o ${to + 1} de ${tabs.length}.`);
  };

  return (
    <header
      aria-hidden={immersive || undefined}
      inert={immersive}
      className={cn(
        'atlas-immersive-shell atlas-header fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-card/90 backdrop-blur-xl transition-[opacity,transform] duration-300 ease-in-out',
        immersive ? 'pointer-events-none -translate-y-full opacity-0 invisible' : 'translate-y-0 opacity-100 visible',
      )}
      style={{ transition: `opacity 300ms ease-in-out, transform 300ms ease-in-out, visibility 0s linear ${immersive ? '300ms' : '0ms'}` }}
    >
      {/* Linha ornamental dourada superior */}
      <div className="absolute inset-x-0 bottom-0 ornament-divider" aria-hidden />
      <div className="flex h-16 items-center gap-3 px-3 sm:px-5">
        <div className="flex items-center gap-2 shrink-0">
          {role === 'MASTER' ? (
            <button
              type="button"
              onClick={onToggleTests}
              aria-label={testsOpen ? 'Fechar painel de testes' : 'Abrir painel de testes'}
              aria-expanded={testsOpen}
              title="Enviar testes para os jogadores"
              className={cn(
                'relative flex h-8 items-center justify-center gap-1.5 rounded-md px-2 gradient-mystic shadow-[0_0_14px_-2px_hsl(var(--primary)/0.7)] transition-all hover:scale-105 hover:shadow-[0_0_20px_-2px_hsl(var(--primary)/0.9)]',
                testsOpen && 'ring-2 ring-accent/80',
              )}
            >
              <span
                className="text-primary-foreground text-sm font-black"
                style={{ fontFamily: "'Cinzel Decorative', serif" }}
                aria-hidden="true"
              >
                R
              </span>
              <span className="text-xs font-semibold tracking-wide text-primary-foreground">Testes</span>
              <div className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-accent/30" aria-hidden />
            </button>
          ) : (
            <div
              className="relative flex h-8 w-8 items-center justify-center rounded-md gradient-mystic shadow-[0_0_14px_-2px_hsl(var(--primary)/0.7)]"
              aria-hidden="true"
            >
              <span
                className="text-primary-foreground text-sm font-black"
                style={{ fontFamily: "'Cinzel Decorative', serif" }}
              >
                R
              </span>
              <div className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-accent/30" aria-hidden />
            </div>
          )}
          <span
            className="hidden sm:inline text-base sm:text-lg font-bold tracking-[0.2em] text-gradient-mystic"
            style={{ fontFamily: "'Cinzel Decorative', serif" }}
          >
            RPG
          </span>
        </div>


        <div className="hidden sm:block h-8 w-px bg-border/50 shrink-0" aria-hidden />

        <div className="hidden sm:block"><MiniClock /></div>

        <nav aria-label="Navegação principal" className="relative flex flex-1 min-w-0 items-center gap-1.5">
          <div className="relative hidden min-w-0 flex-1 overflow-hidden sm:block">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-gradient-to-r from-card/90 to-transparent" aria-hidden />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-gradient-to-l from-card/90 to-transparent" aria-hidden />
            <div
              ref={navRef}
              onWheel={scrollMenu}
              className="flex items-center gap-1.5 overflow-x-auto scroll-smooth px-1 py-1 scrollbar-thin"
            >
              {primaryTabs.map((id) => {
                const Icon = TAB_ICONS[id];
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    ref={isActive ? activeItemRef : undefined}
                    type="button"
                    draggable={!!roleKey}
                    onDragStart={handleDragStart(id)}
                    onDragOver={handleDragOver(id)}
                    onDragLeave={() => handleDragLeave(id)}
                    onDrop={(event) => { event.preventDefault(); handleDrop(id); }}
                    onDragEnd={handleDragEnd}
                    onKeyDown={handleKeyboardReorder(id)}
                    aria-keyshortcuts={roleKey ? 'Shift+ArrowUp Shift+ArrowDown' : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => onTabChange(id)}
                    title={TAB_LABELS[id]}
                    className={cn(
                      'group relative flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm whitespace-nowrap cursor-grab active:cursor-grabbing select-none border transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 ease-out active:scale-[0.97]',
                      isActive
                        ? 'bg-primary/15 text-primary font-semibold border-primary/50 shadow-[0_0_16px_-5px_hsl(var(--primary)/0.8)] -translate-y-px'
                        : 'text-muted-foreground border-transparent hover:bg-secondary/70 hover:text-foreground hover:border-border/70 hover:-translate-y-px',
                      dragId === id && 'opacity-40 scale-95',
                      overId === id && dragId && dragId !== id && 'translate-x-1 ring-2 ring-accent/60',
                    )}
                  >
                    <GripVertical className="h-3 w-3 -ml-1 opacity-0 -translate-x-1 group-hover:opacity-50 group-hover:translate-x-0 transition-all duration-200" aria-hidden />
                    <Icon className={cn('h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:scale-110', isActive && 'text-accent scale-110')} />
                    <span style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}>
                      {TAB_LABELS[id]}
                    </span>
                    {id === 'feiticos-players' && pending.total > 0 && (
                      <span
                        title={`${pending.total} debate(s) aguardando você`}
                        className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-hp px-1 text-xs font-extrabold text-white shadow-[0_0_8px_hsl(var(--hp)/0.7)] animate-pulse"
                      >
                        !{pending.total > 1 ? pending.total : ''}
                      </span>
                    )}
                    <span
                      className={cn(
                        'pointer-events-none absolute inset-x-2 -bottom-px h-px origin-center bg-accent transition-transform duration-300',
                        isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50',
                      )}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {tabs.length > 0 && (
            <DropdownMenu
              open={modulesMenuOpen}
              onOpenChange={(open) => {
                if (!open && dragId) return;
                setModulesMenuOpen(open);
              }}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onDragOver={(event) => {
                    if (!dragId) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setOverModulesButton(true);
                  }}
                  onDragLeave={() => setOverModulesButton(false)}
                  onDrop={(event) => { event.preventDefault(); handleDropIntoModules(); }}
                  aria-label={isActiveInModulesMenu ? `Módulos. Página atual: ${TAB_LABELS[activeTab]}` : 'Módulos'}
                  title={isActiveInModulesMenu ? `Módulos · página atual: ${TAB_LABELS[activeTab]}` : 'Módulos'}
                  className={cn(
                    'shrink-0 flex h-10 items-center gap-1.5 rounded-lg border px-2.5 text-sm whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    overflowTabs.length === 0 && 'sm:hidden',
                    isActiveInModulesMenu
                      ? 'border-primary/50 bg-primary/15 text-primary shadow-[0_0_16px_-5px_hsl(var(--primary)/0.8)]'
                      : 'border-border/60 text-muted-foreground hover:bg-secondary/70 hover:text-foreground hover:border-border/70',
                    overModulesButton && 'ring-2 ring-accent/60',
                  )}
                >
                  <Menu className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>Módulos</span>
                  {isActiveInModulesMenu && (
                    <span className="max-w-14 sm:max-w-24 truncate text-xs text-primary/80" aria-hidden="true">
                      · {TAB_LABELS[activeTab]}
                    </span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-64 max-w-[calc(100vw-1rem)]"
                {...({ onOpenAutoFocus: (event: Event) => {
                  if (!activeMenuItemRef.current) return;
                  event.preventDefault();
                  activeMenuItemRef.current.focus();
                } } as Record<string, unknown>)}
              >
                <DropdownMenuLabel className="flex flex-col items-start gap-0.5 px-3 py-2">
                  <span className="sm:hidden">{'Navega\u00e7\u00e3o'}</span>
                  <span className="hidden sm:inline">Mais módulos</span>
                  <span className="text-sm font-normal text-muted-foreground">{'Arraste ou use Shift + \u2191/\u2193 para reordenar'}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup className="max-h-[min(65vh,24rem)] overflow-y-auto">
                  {tabs.map((id) => {
                    const Icon = TAB_ICONS[id];
                    const isActive = activeTab === id;
                    return (
                      <DropdownMenuItem
                        key={id}
                        ref={isActive ? activeMenuItemRef : undefined}
                        draggable={!!roleKey}
                        onDragStart={handleDragStart(id)}
                        onDragOver={handleDragOver(id)}
                        onDragLeave={() => handleDragLeave(id)}
                        onDrop={(event) => { event.preventDefault(); handleDrop(id); }}
                        onDragEnd={handleDragEnd}
                        onSelect={(event) => {
                          if (dragId) { event.preventDefault(); return; }
                          onTabChange(id);
                        }}
                        onKeyDown={handleKeyboardReorder(id)}
                        aria-keyshortcuts={roleKey ? 'Shift+ArrowUp Shift+ArrowDown' : undefined}
                        aria-posinset={tabs.indexOf(id) + 1}
                        aria-setsize={tabs.length}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'gap-2 py-2 cursor-grab active:cursor-grabbing select-none border border-transparent',
                          tabs.indexOf(id) < visibleTabsCount ? 'sm:hidden' : '',
                          isActive && 'bg-primary/15 text-primary font-semibold border-primary/40',
                          dragId === id && 'opacity-50',
                          overId === id && dragId && dragId !== id && 'translate-x-1 ring-2 ring-accent/60',
                        )}
                      >
                        <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-accent' : 'text-muted-foreground')} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{TAB_LABELS[id]}</span>
                        {id === 'feiticos-players' && pending.total > 0 && (
                          <span
                            title={`${pending.total} debate(s) aguardando você`}
                            className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-hp px-1 text-xs font-extrabold text-white shadow-[0_0_8px_hsl(var(--hp)/0.7)] animate-pulse"
                          >
                            !{pending.total > 1 ? pending.total : ''}
                          </span>
                        )}
                        {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />}
                        <GripVertical className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {reorderAnnouncement}
          </span>
        </nav>

        <Button size="sm" variant="outline" onClick={onOpenDiary} title="Diário e Conquistas" aria-label="Abrir diário e conquistas" className="shrink-0 border-accent/50 text-accent gap-1.5 px-2 sm:px-3">
          <BookOpen aria-hidden />
          <span className="hidden sm:inline">Diário</span>
        </Button>

        {role === 'MASTER' && (
          <button
            onClick={() => setAccountsOpen(true)}
            title="Contas e Mestres"
            className="shrink-0 flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground hover:border-border/70 hover:-translate-y-px active:scale-95 transition-all duration-200"
          >
            <Users className="h-4 w-4" />
          </button>
        )}
        {role && (
          <button
            onClick={() => { void signOutAll(); logout(); }}
            title={`Sair (${role === 'MASTER' ? 'Mestre' : 'Player'})`}
            className="shrink-0 flex h-10 items-center gap-1.5 rounded-lg border border-transparent px-2 sm:px-3 text-sm font-medium text-muted-foreground hover:bg-destructive/15 hover:text-destructive hover:border-destructive/40 hover:-translate-y-px active:scale-95 transition-all duration-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.05em' }}>
              {role === 'MASTER' ? 'Mestre' : 'Player'}
            </span>
          </button>
        )}
        <MasterAccountsDialog open={accountsOpen} onOpenChange={setAccountsOpen} />
      </div>
    </header>
  );
}
