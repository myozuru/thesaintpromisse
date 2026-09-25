/**
 * PartyPanel — coluna direita recolhível (estilo Owlbear Rodeo).
 *
 * Players: mostra a ficha do próprio player no painel.
 * Mestre: mantém lista de players + seções placeholder.
 */
import { Users, ChevronRight, ChevronLeft, UserPlus } from 'lucide-react';
import { useRoleStore } from '@/stores/useRoleStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { CharacterCard } from '@/components/fichas/CharacterCard';

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const PANEL_WIDTH_GM_DEFAULT = 240;
const PANEL_WIDTH_WITH_SHEET = 600;

export function PartyPanel({ collapsed, onToggleCollapsed }: Props) {
  const role = useRoleStore((s) => s.role);
  const isPlayer = role === 'PLAYER';

  const playerCharacter = useCharacterStore((s) =>
    isPlayer
      ? s.characters.find(
          (c) => c.category === 'PLAYER' && c.createdBy !== 'MASTER' && !c.hiddenFromPlayers,
        )
      : undefined,
  );

  // Mestre: se houver um único token selecionado vinculado a uma ficha, mostra essa ficha.
  const selectedCharacterId = useMapStore((s) => {
    if (isPlayer) return null;
    if (s.selectedIds.length !== 1) return null;
    const ent = s.entities[s.selectedIds[0]];
    return ent?.characterId ?? null;
  });
  const selectedCharacter = useCharacterStore((s) =>
    selectedCharacterId ? s.characters.find((c) => c.id === selectedCharacterId) : undefined,
  );

  const sheetToShow = isPlayer ? playerCharacter : selectedCharacter;
  const showSheet = !!sheetToShow;
  const panelWidth = showSheet ? PANEL_WIDTH_WITH_SHEET : PANEL_WIDTH_GM_DEFAULT;

  return (
    <div className="h-full shrink-0 flex" style={{ width: collapsed ? 24 : panelWidth + 24 }}>
      <button
        type="button"
        onClick={onToggleCollapsed}
        title={collapsed ? 'Abrir Party' : 'Esconder Party'}
        className="h-full w-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
        style={{
          background: 'hsl(var(--card))',
          borderLeft: '1px solid #2a2b30',
          borderRight: collapsed ? 'none' : '1px solid #2a2b30',
        }}
      >
        {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {!collapsed && (
        <aside
          className="h-full flex flex-col overflow-hidden"
          style={{
            width: panelWidth,
            background: 'hsl(var(--card))',
            color: 'hsl(var(--foreground))',
          }}
        >
          {showSheet ? (
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
              <CharacterCard character={sheetToShow!} hideAttackPanel />
            </div>
          ) : isPlayer ? (
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
              <div className="text-zinc-500 text-xs leading-relaxed p-3 text-center">
                Crie sua ficha no módulo Fichas para vê-la aqui.
              </div>
            </div>
          ) : (
            <Section
              icon={<Users className="h-3.5 w-3.5" />}
              title="Players"
              action={
                <button
                  type="button"
                  className="text-zinc-500 hover:text-foreground"
                  title="Convidar (em breve)"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </button>
              }
            >
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary">
                <span className="inline-block h-7 w-7 rounded-full bg-amber-600 ring-2 ring-[#16171a]" />
                <span className="text-foreground flex-1 text-sm truncate">Você (GM)</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  GM
                </span>
              </div>
              <Placeholder>
                Selecione um token vinculado a uma ficha para vê-la aqui.
              </Placeholder>
            </Section>
          )}
        </aside>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-2 text-muted-foreground text-[10px] uppercase tracking-wider">
        {icon}
        <span className="flex-1">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <div className="text-zinc-500 text-xs leading-relaxed py-1">{children}</div>;
}
