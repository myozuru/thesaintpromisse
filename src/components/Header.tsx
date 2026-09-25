import { useState } from 'react';
import {
  LogOut, Clock, Users, Swords, CalendarDays, Settings, BookOpen, Wand2, Coins, Store, GripVertical, Sparkles, Library, Map as MapIcon, Archive, Skull,
} from 'lucide-react';
import { RIcon } from '@/components/icons/RIcon';
import { useRoleStore, type UserRole } from '@/stores/useRoleStore';
import { useTabOrderStore } from '@/stores/useTabOrderStore';
import { cn } from '@/lib/utils';
import { MiniClock } from '@/components/chronos/MiniClock';
import { usePendingDebates } from '@/hooks/usePendingDebates';

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
  const setOrder = useTabOrderStore((s) => s.setOrder);
  const savedOrders = useTabOrderStore((s) => s.orders);
  const pending = usePendingDebates();

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
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-card/95 shadow-[0_4px_24px_-12px_hsl(265_80%_4%/0.8)]">
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

        <nav className="flex-1 min-w-0">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
            {tabs.map((id) => {
            const Icon = TAB_ICONS[id];
            const isActive = activeTab === id;
            return (
              <button
                key={id}
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
                  'group relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs whitespace-nowrap cursor-grab active:cursor-grabbing select-none transition-all',
                  isActive
                    ? 'bg-primary/15 text-primary font-semibold border border-primary/50 shadow-[0_0_14px_-4px_hsl(var(--primary)/0.7)]'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground border border-transparent hover:border-border/50',
                  dragId === id && 'opacity-40',
                  overId === id && dragId && dragId !== id && 'ring-2 ring-accent/60',
                )}
              >
                <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" aria-hidden />
                <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive && "text-accent")} />
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
              </button>
            );
            })}
          </div>
        </nav>

        {role && (
          <button
            onClick={logout}
            title={`Sair (${role === 'MASTER' ? 'Mestre' : 'Player'})`}
            className="shrink-0 flex items-center gap-1.5 rounded-md border border-transparent px-2 sm:px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/15 hover:text-destructive hover:border-destructive/40 transition-all"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.05em' }}>
              {role === 'MASTER' ? 'Mestre' : 'Player'}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
