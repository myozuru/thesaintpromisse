import { useState } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { useRoleStore } from '@/stores/useRoleStore';
import { useTabOrderStore } from '@/stores/useTabOrderStore';
import { getTabsForRole, type TabId } from '@/components/Header';
import { usePendingDebates } from '@/hooks/usePendingDebates';
import {
  Clock, Users, Swords, CalendarDays, Settings, BookOpen, Wand2, Coins, Store, GripVertical, Sparkles, Library, Map as MapIcon, Globe, Archive, Skull,
} from 'lucide-react';
import { RIcon } from '@/components/icons/RIcon';

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const ALL_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'relogio', label: 'Relógio', icon: Clock },
  { id: 'fichas', label: 'Fichas', icon: Users },
  { id: 'testes', label: 'Testes', icon: RIcon },
  { id: 'feiticos-players', label: 'Debates', icon: Wand2 },
  { id: 'itens', label: 'Itens', icon: Swords },
  { id: 'baus', label: 'Baús', icon: Archive },
  { id: 'money', label: 'Money', icon: Coins },
  { id: 'cardapios', label: 'Estabelecimentos', icon: Store },
  { id: 'calendario', label: 'Calendário', icon: CalendarDays },
  { id: 'omni', label: 'Omni-Engine', icon: Sparkles },
  { id: 'catalogo', label: 'Catálogo', icon: Library },
  { id: 'mapa', label: 'Mapa', icon: MapIcon },
  { id: 'grimorio', label: 'Grimório', icon: Skull },
  { id: 'sistema', label: 'Sistema', icon: Settings },
  { id: 'guia', label: 'Guia', icon: BookOpen },
];

export function AppSidebar({ activeTab, onTabChange }: Props) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const role = useRoleStore((s) => s.role);
  const setOrder = useTabOrderStore((s) => s.setOrder);
  const savedOrders = useTabOrderStore((s) => s.orders);
  const pending = usePendingDebates();

  const defaults: TabId[] = role ? getTabsForRole(role) : [];
  const roleKey = role ?? null;
  const savedForRole = roleKey ? savedOrders[roleKey] : undefined;
  const allowed = new Set(defaults);
  const reconciled: TabId[] = savedForRole
    ? [
        ...savedForRole.filter((id) => allowed.has(id)),
        ...defaults.filter((id) => !savedForRole.includes(id)),
      ]
    : defaults;

  const itemsById = new Map(ALL_ITEMS.map((i) => [i.id, i]));
  const items = reconciled.map((id) => itemsById.get(id)!).filter(Boolean);

  const [dragId, setDragId] = useState<TabId | null>(null);
  const [overId, setOverId] = useState<TabId | null>(null);

  const handleDrop = (targetId: TabId) => {
    if (!dragId || !roleKey || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const next = [...reconciled];
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
    <Sidebar side="right" collapsible="icon" className="border-l border-border/60 bg-sidebar shadow-[-8px_0_24px_-12px_hsl(265_80%_4%/0.8)]">
      <SidebarContent>
        <div className="ornament-divider-mystic mx-3 mt-2" aria-hidden />
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel
              style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.08em' }}
              className="text-primary/80"
            >
              Módulos
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(({ id, label, icon: Icon }) => {
                const isActive = activeTab === id;
                return (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={collapsed ? label : undefined}
                    >
                      <button
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
                        className={cn(
                          'group relative w-full flex items-center gap-2 cursor-grab active:cursor-grabbing select-none rounded-md transition-all',
                          isActive
                            ? 'bg-primary/15 text-primary font-semibold border-l-2 border-accent shadow-[inset_0_0_18px_-6px_hsl(var(--primary)/0.6)]'
                            : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground border-l-2 border-transparent',
                          dragId === id && 'opacity-40',
                          overId === id && dragId && dragId !== id && 'ring-1 ring-accent/60',
                        )}
                      >
                        {!collapsed && (
                          <GripVertical
                            className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity"
                            aria-hidden
                          />
                        )}
                        {(() => {
                          const TabIcon = Icon as React.ComponentType<{ className?: string }>;
                          return <TabIcon className={cn("h-4 w-4 shrink-0", isActive && "text-accent")} />;
                        })()}
                        {!collapsed && (
                          <span style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.05em' }} className="text-sm">
                            {label}
                          </span>
                        )}
                        {id === 'feiticos-players' && pending.total > 0 && (
                          <span
                            title={`${pending.total} debate(s) aguardando você`}
                            className={cn(
                              'inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-hp px-1 text-xs font-extrabold text-white shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse',
                              collapsed ? 'absolute -top-1 -right-1' : 'ml-auto',
                            )}
                          >
                            !{pending.total > 1 ? pending.total : ''}
                          </span>
                        )}
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
