/**
 * PartyPanel — coluna direita recolhível (estilo Owlbear Rodeo).
 *
 * Players: mostra a ficha do próprio player no painel.
 * Mestre: mantém lista de players + seções placeholder.
 */
import { Users, ChevronRight, ChevronLeft, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRoleStore } from "@/stores/useRoleStore";
import { useCharacterStore } from "@/stores/useCharacterStore";
import { useMapStore } from "@/stores/useMapStore";
import { CharacterCard } from "@/components/fichas/CharacterCard";
import { useProfileStore } from "@/stores/useProfileStore";
import { findMyCharacter } from "@/lib/myCharacter";
import { ShikigamiOwnerPanel } from "./ShikigamiOwnerPanel";
import { cn } from "@/lib/utils";

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  hideSelectedInvocationPanel?: boolean;
}

const PANEL_WIDTH_GM_DEFAULT = 240;
const PANEL_WIDTH_WITH_SHEET = 400;
const PANEL_TOGGLE_WIDTH = 40;
const PANEL_FRAME_WIDTH = 2; // 1px border on each outer edge.

export function PartyPanel({ collapsed, onToggleCollapsed, hideSelectedInvocationPanel = false }: Props) {
  const role = useRoleStore((s) => s.role);
  const isPlayer = role === "PLAYER";

  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const characters = useCharacterStore((s) => s.characters);
  const playerCharacter = isPlayer
    ? (findMyCharacter(characters, activeProfileId) ?? undefined)
    : undefined;

  const selectedEntity = useMapStore((s) =>
    s.selectedIds.length === 1 ? s.entities[s.selectedIds[0]] : undefined,
  );
  const selectedInvocationTokenId =
    selectedEntity?.invocationId &&
    (!isPlayer || selectedEntity.ownerCharId === playerCharacter?.id)
      ? selectedEntity.id
      : null;
  // Ao selecionar um Shikigami, o Mestre vê a ficha do dono junto ao painel da instância.
  const selectedCharacterId = !isPlayer
    ? (selectedEntity?.characterId ?? selectedEntity?.ownerCharId ?? null)
    : null;
  const selectedCharacter = useCharacterStore((s) =>
    selectedCharacterId ? s.characters.find((c) => c.id === selectedCharacterId) : undefined,
  );

  const sheetToShow = isPlayer ? playerCharacter : selectedCharacter;
  const showSheet = !!sheetToShow;
  const panelWidth = showSheet ? PANEL_WIDTH_WITH_SHEET : PANEL_WIDTH_GM_DEFAULT;
  const [activeView, setActiveView] = useState("character");
  const showInvocation = !!selectedInvocationTokenId && !hideSelectedInvocationPanel;
  const displayedView = showInvocation ? activeView : "character";
  useEffect(() => {
    setActiveView(selectedInvocationTokenId ? "invocation" : "character");
  }, [selectedInvocationTokenId]);

  // Durante login/logout, papel indefinido nunca deve abrir ficha selecionada como se fosse Mestre.
  if (!role) return null;

  return (
    <div
      className={cn("mapa-party-panel h-full shrink-0 flex card-enigmatic", {
        "mapa-party-panel--collapsed": collapsed,
      })}
      style={{
        width: collapsed
          ? PANEL_TOGGLE_WIDTH + PANEL_FRAME_WIDTH
          : panelWidth + PANEL_TOGGLE_WIDTH + PANEL_FRAME_WIDTH,
        backgroundColor: "hsl(var(--card))",
      }}
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        title={collapsed ? "Expandir painel do grupo" : "Recolher painel do grupo"}
        aria-label={collapsed ? "Expandir painel do grupo" : "Recolher painel do grupo"}
        aria-expanded={!collapsed}
        aria-controls={!collapsed ? "map-party-panel" : undefined}
        className="h-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0 border-r border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
        style={{
          width: PANEL_TOGGLE_WIDTH,
          minWidth: PANEL_TOGGLE_WIDTH,
          backgroundColor: "hsl(var(--card))",
        }}
      >
        {collapsed ? (
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      {!collapsed && (
        <aside
          id="map-party-panel"
          aria-label="Painel do grupo"
          className="h-full min-w-0 shrink-0 flex flex-col overflow-hidden"
          style={{
            width: panelWidth,
            backgroundColor: "hsl(var(--card))",
            color: "hsl(var(--foreground))",
          }}
        >
          {showSheet ? (
            <Tabs
              value={displayedView}
              onValueChange={setActiveView}
              className="flex min-h-0 flex-1 flex-col"
            >
              {showInvocation ? (
                <TabsList
                  aria-label="Ficha exibida no painel do mapa"
                  className="grid h-auto shrink-0 grid-cols-2 gap-1 rounded-none border-b border-border bg-card p-2"
                >
                  <TabsTrigger value="character" className="min-h-11 whitespace-normal px-2">
                    Controlador
                  </TabsTrigger>
                  <TabsTrigger value="invocation" className="min-h-11 whitespace-normal px-2">
                    Invocação
                  </TabsTrigger>
                </TabsList>
              ) : (
                <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
                  <Users aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                  <h2 className="min-w-0 break-words font-display text-base text-foreground">
                    Ficha do personagem
                  </h2>
                </header>
              )}
              <TabsContent
                value="character"
                forceMount
                hidden={displayedView !== "character"}
                aria-label={!showInvocation ? "Ficha do personagem" : undefined}
                className="mt-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2"
              >
                <CharacterCard
                  key={sheetToShow!.id}
                  character={sheetToShow!}
                  hideAttackPanel
                  compactHeader
                />
              </TabsContent>
              {showInvocation && selectedInvocationTokenId && (
                <TabsContent
                  value="invocation"
                  forceMount
                  hidden={displayedView !== "invocation"}
                  className="mt-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3"
                >
                  <ShikigamiOwnerPanel
                    key={selectedInvocationTokenId}
                    tokenId={selectedInvocationTokenId}
                  />
                </TabsContent>
              )}
            </Tabs>
          ) : isPlayer ? (
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
              <div
                className="text-muted-foreground text-sm leading-relaxed p-3 text-center"
                style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic" }}
              >
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
                  className="text-muted-foreground hover:text-foreground"
                  title="Convidar (em breve)"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </button>
              }
            >
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary">
                <span className="inline-block h-7 w-7 rounded-full bg-amber-600 ring-2 ring-card" />
                <span className="text-foreground flex-1 text-sm truncate">Você (GM)</span>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  GM
                </span>
              </div>
              <Placeholder>Selecione um token vinculado a uma ficha para vê-la aqui.</Placeholder>
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
    <div className="border-b border-border/50 px-3 py-2.5">
      <div
        className="flex items-center gap-1.5 mb-2 text-muted-foreground text-sm uppercase tracking-wider"
        style={{ fontFamily: "'Cinzel', serif", letterSpacing: "0.06em" }}
      >
        {icon}
        <span className="flex-1">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-muted-foreground text-sm leading-relaxed py-1"
      style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic" }}
    >
      {children}
    </div>
  );
}
