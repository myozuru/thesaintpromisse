import { useEffect, useRef, useState } from 'react';
import {
  LogOut, Clock, Users, Swords, CalendarDays, Settings, BookOpen, Wand2, Coins, Store, GripVertical, Sparkles, Library, Map as MapIcon, Archive, Skull,
} from 'lucide-react';
import { RIcon } from '@/components/icons/RIcon';
import { useRoleStore, type UserRole } from '@/stores/useRoleStore';
import { useTabOrderStore } from '@/stores/useTabOrderStore';
import { cn } from '@/lib/utils';
import { MiniClock } from '@/components/chronos/MiniClock';
import { usePendingDebates } from '@/hooks/usePendingDebates';
import { MasterAccountsDialog } from '@/components/MasterAccountsDialog';
import { signOutAll } from '@/lib/auth';

export type TabId = 'relogio' | 'fichas' | 'itens' | 'baus' | 'calendario' | 'sistema' | 'guia' | 'feiticos-players' | 'money' | 'cardapios' | 'omni' | 'catalogo' | 'testes' | 'mapa' | 'grimorio';

const TAB_LABELS: Record<TabId, string> = {
  relogio: 'Relógio',
  fichas: 'Fichas',
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
  grimorio: 'Grimório',
};

const TAB_ICONS: Record<TabId, React.ElementType> = {
  relogio: Clock,
  fichas: Users,
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
  grimorio: Skull,
};

const PLAYER_TABS: TabId[] = ['relogio', 'fichas', 'feiticos-players', 'money', 'cardapios', 'calendario', 'omni', 'mapa', 'guia'];
const ALL_TABS: TabId[] = ['relogio', 'fichas', 'feiticos-players', 'itens', 'baus', 'money', 'cardapios', 'calendario', 'omni', 'catalogo', 'mapa', 'grimorio', 'sistema', 'guia'];

export function getTabsForRole(role: UserRole): TabId[] {
  if (role === 'PLAYER') return PLAYER_TABS;
  return ALL_TABS;
}

interface HeaderProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

/**
 * Topbar global com navegação horizontal de módulos (drag-and-drop preservado).
 */
export function Header({ activeTab, onTabChange }: HeaderProps) {
  const role = useRoleStore((s) => s.role);
  const logout = useRoleStore((s) => s.logout);
  const [accountsOpen, setAccountsOpen] = useState(false);
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

  const handleDrop = (targetId: TabId) => {
    if (!dragId || !roleKey || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const next = [...tabs];
    const from = next.indexOf(dragId);
    const to = next.indexOf(targetId);
    if (from === -1 || to === -1) return;
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    setOrder(roleKey, next);
    setDragId(null);
    setOverId(null);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_-12px_hsl(265_80%_4%/0.8)]">
      {/* Linha ornamental dourada superior */}
      <div className="absolute inset-x-0 bottom-0 ornament-divider" aria-hidden />
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (role === 'MASTER') onTabChange('testes');
            }}
            title={role === 'MASTER' ? 'Enviar testes para players' : 'RPG'}
            className={cn(
              'relative flex h-8 w-8 items-center justify-center rounded-md gradient-mystic shadow-[0_0_14px_-2px_hsl(var(--primary)/0.7)] transition-all',
              role === 'MASTER' && 'hover:scale-110 hover:shadow-[0_0_20px_-2px_hsl(var(--primary)/0.9)] cursor-pointer',
              role === 'MASTER' && activeTab === 'testes' && 'ring-2 ring-accent/80',
            )}
          >
            <span
              className="text-primary-foreground text-sm font-black"
              style={{ fontFamily: "'Cinzel Decorative', serif" }}
            >
              R
            </span>
            <div className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-accent/30" aria-hidden />
          </button>
          <span
            className="hidden sm:inline text-base sm:text-lg font-bold tracking-[0.2em] text-gradient-mystic"
            style={{ fontFamily: "'Cinzel Decorative', serif" }}
          >
            RPG
          </span>
        </div>


        <div className="h-8 w-px bg-border/50 shrink-0" aria-hidden />

        <MiniClock />

        <nav className="relative flex-1 min-w-0 overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-gradient-to-r from-card/90 to-transparent" aria-hidden />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-gradient-to-l from-card/90 to-transparent" aria-hidden />
          <div
            ref={navRef}
            onWheel={scrollMenu}
            className="flex items-center gap-1.5 overflow-x-auto scroll-smooth px-1 py-1 scrollbar-thin"
          >
            {tabs.map((id) => {
            const Icon = TAB_ICONS[id];
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                 ref={isActive ? activeItemRef : undefined}
                type="button"
                draggable={!!roleKey}
                onDragStart={(e) => {
                  if (!roleKey) return;
                  setDragId(id);
                  e.dataTransfer.effectAllowed = 'move';
                  try { e.dataTransfer.setData('text/plain', id); } catch { /* noop */ }
                }}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (overId !== id) setOverId(id);
                }}
                onDragLeave={() => { if (overId === id) setOverId(null); }}
                onDrop={(e) => { e.preventDefault(); handleDrop(id); }}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                onClick={() => onTabChange(id)}
                title={TAB_LABELS[id]}
                className={cn(
                   'group relative flex h-9 items-center gap-1.5 rounded-md px-3 text-xs whitespace-nowrap cursor-grab active:cursor-grabbing select-none border transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 ease-out active:scale-[0.97]',
                  isActive
                     ? 'bg-primary/15 text-primary font-semibold border-primary/50 shadow-[0_0_16px_-5px_hsl(var(--primary)/0.8)] -translate-y-px'
                     : 'text-muted-foreground border-transparent hover:bg-secondary/70 hover:text-foreground hover:border-border/70 hover:-translate-y-px',
                   dragId === id && 'opacity-40 scale-95',
                   overId === id && dragId && dragId !== id && 'translate-x-1 ring-2 ring-accent/60',
                )}
              >
                 <GripVertical className="h-3 w-3 -ml-1 opacity-0 -translate-x-1 group-hover:opacity-50 group-hover:translate-x-0 transition-all duration-200" aria-hidden />
                {(() => {
                  const TabIcon = Icon as React.ComponentType<{ className?: string }>;
                   return <TabIcon className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:scale-110", isActive && "text-accent scale-110")} />;
                })()}
                <span style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}>
                  {TAB_LABELS[id]}
                </span>
                {id === 'feiticos-players' && pending.total > 0 && (
                  <span
                    title={`${pending.total} debate(s) aguardando você`}
                    className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-hp px-1 text-[10px] font-extrabold text-white shadow-[0_0_8px_hsl(var(--hp)/0.7)] animate-pulse"
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
        </nav>

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
            className="shrink-0 flex h-9 items-center gap-1.5 rounded-md border border-transparent px-2 sm:px-3 text-xs font-medium text-muted-foreground hover:bg-destructive/15 hover:text-destructive hover:border-destructive/40 hover:-translate-y-px active:scale-95 transition-all duration-200"
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
