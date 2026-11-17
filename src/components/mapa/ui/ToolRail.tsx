/**
 * ToolRail — coluna vertical de ferramentas reorganizada em grupos claros.
 *
 * Grupos (por role estável, não por índice fixo):
 *   • Tela: seleção, iluminação (GM), camadas
 *   • Entidades: formas (GM), anotação, templates (GM)
 *   • Combate: iniciativa, dados, régua, ponteiro
 *   • Ferramentas: desenho, paredes (GM), nevoeiro (GM), desfazer/refazer, imersivo
 *
 * O painel de configurações é renderizado pelo MapaModule (não aqui) para evitar duplicação.
 * Ajuda e Abas de Cena estão apenas no MapTopBar.
 */
import { useState } from "react";
import {
  MousePointer2,
  Ruler,
  Square as SquareIcon,
  Circle as CircleIcon,
  Pencil,
  MousePointerClick,
  StickyNote,
  Triangle as TriangleIcon,
  Undo2,
  Redo2,
  Cloud,
  Layers,
  Lightbulb,
  Swords,
  BrickWall,
  Dices,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useMapStore, type EntityShape, type ToolId } from "@/stores/useMapStore";
import { useRoleStore } from "@/stores/useRoleStore";
import { useDiceStore } from "@/stores/useDiceStore";
import { RadioIconButton, RailDivider, RailSectionToggle } from "./RadioIconButton";
import { OpportunityRailButton } from "./OpportunityRailButton";
import { cn } from "@/lib/utils";

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  activeTool: ToolId;
  shape: EntityShape;
  onSelectTool: (id: ToolId) => void;
  onPickShape: (s: EntityShape) => void;
  layerPanelOpen: boolean;
  setLayerPanelOpen: (v: boolean) => void;
}

// Helper type for rail items - can be a tool or a UI toggle
type RailItem =
  | {
      type: "tool";
      id: ToolId;
      icon: React.ReactNode;
      title: string;
      label: string;
      gmOnly?: boolean;
      variant?: "rail" | "ghost";
      shapeFilter?: EntityShape;
      section: "tela" | "entidades" | "combate" | "ferramentas";
    }
  | { type: "divider"; section: "tela" | "entidades" | "combate" | "ferramentas" }
  | { type: "custom"; id: "opportunity"; section: "tela" | "entidades" | "combate" | "ferramentas" }
  | {
      type: "toggle";
      id: string;
      icon: React.ReactNode;
      title: string;
      label: string;
      active: boolean;
      onClick: () => void;
      disabled?: boolean;
      gmOnly?: boolean;
      section: "tela" | "entidades" | "combate" | "ferramentas";
    };

const SECTION_NAMES: Record<"tela" | "entidades" | "combate" | "ferramentas", string> = {
  tela: "Tela",
  entidades: "Entidades",
  combate: "Combate",
  ferramentas: "Ferramentas",
};

const SECTION_ORDER: Array<"tela" | "entidades" | "combate" | "ferramentas"> = [
  "tela",
  "entidades",
  "combate",
  "ferramentas",
];
type ToolSection = (typeof SECTION_ORDER)[number];

export function ToolRail({
  collapsed,
  onToggleCollapsed,
  activeTool,
  shape,
  onSelectTool,
  onPickShape,
  layerPanelOpen,
  setLayerPanelOpen,
}: Props) {
  const [collapsedSections, setCollapsedSections] = useState<Record<ToolSection, boolean>>({
    tela: false,
    entidades: false,
    combate: false,
    ferramentas: false,
  });
  const undo = useMapStore((s) => s.undo);
  const redo = useMapStore((s) => s.redo);
  const canUndo = useMapStore((s) => s._undo.length > 0);
  const canRedo = useMapStore((s) => s._redo.length > 0);
  const setPanel = useMapStore((s) => s.setSettingsPanelOpen);
  const settingsPanelOpen = useMapStore((s) => s.settingsPanelOpen);
  const initiativeOpen = useMapStore((s) => s.initiativeOpen);
  const setInitiativeOpen = useMapStore((s) => s.setInitiativeOpen);
  const lightingEnabled = useMapStore((s) => s.lighting.enabled);
  const setLighting = useMapStore((s) => s.setLighting);
  const diceOpen = useDiceStore((s) => s.open);
  const setDiceOpen = useDiceStore((s) => s.setOpen);
  const isPlayer = useRoleStore((s) => s.role) === "PLAYER";
  const pick = (id: ToolId) => {
    onSelectTool(id);
    setPanel(false);
  };
  const openPanel = (id: ToolId) => (e: React.MouseEvent) => {
    e.preventDefault();
    onSelectTool(id);
    setPanel(true);
  };

  // Helper to determine if a tool is active
  const isToolActive = (toolId: ToolId): boolean => {
    if (toolId === "shape") {
      return activeTool === "shape";
    }
    return activeTool === toolId;
  };

  // Build rail items grouped by section (stable, role-aware)
  const buildRailItems = (): RailItem[] => {
    const items: RailItem[] = [];

    // Grupo: Tela
    items.push({
      type: "tool",
      id: "select",
      icon: <MousePointer2 className="h-[18px] w-[18px]" />,
      title: "Selecionar / mover (V)",
      label: "Selecionar",
      variant: "rail",
      section: "tela",
    });
    items.push({
      type: "tool",
      id: "shape",
      shapeFilter: "RECT",
      icon: <SquareIcon className="h-[18px] w-[18px]" />,
      title: "Forma: retângulo",
      label: "Retângulo",
      variant: "rail",
      section: "tela",
    });
    items.push({
      type: "tool",
      id: "shape",
      shapeFilter: "ELLIPSE",
      icon: <CircleIcon className="h-[18px] w-[18px]" />,
      title: "Forma: elipse",
      label: "Elipse",
      variant: "rail",
      section: "tela",
    });
    items.push({
      type: "toggle",
      id: "lighting",
      icon: <Lightbulb className="h-[18px] w-[18px]" />,
      title: lightingEnabled ? "Iluminação: ligada" : "Iluminação: desligada",
      label: "Iluminação",
      active: lightingEnabled,
      onClick: () => setLighting({ enabled: !lightingEnabled }),
      section: "tela",
    });
    items.push({
      type: "toggle",
      id: "layers",
      icon: <Layers className="h-[18px] w-[18px]" />,
      title: "Camadas (L)",
      label: "Camadas",
      active: layerPanelOpen,
      onClick: () => setLayerPanelOpen(!layerPanelOpen),
      section: "tela",
    });

    items.push({ type: "divider", section: "tela" });

    // Grupo: Entidades
    items.push({
      type: "tool",
      id: "note",
      icon: <StickyNote className="h-[18px] w-[18px]" />,
      title: "Anotação (pino com texto)",
      label: "Anotação",
      variant: "rail",
      section: "entidades",
    });
    items.push({
      type: "tool",
      id: "template",
      icon: <TriangleIcon className="h-[18px] w-[18px]" />,
      title: "Templates de área (AoE)",
      label: "Área (AoE)",
      variant: "rail",
      section: "entidades",
    });

    items.push({ type: "divider", section: "entidades" });

    // Grupo: Combate
    items.push({
      type: "toggle",
      id: "initiative",
      icon: <Swords className="h-[18px] w-[18px]" />,
      title: "Iniciativa (I)",
      label: "Iniciativa",
      active: initiativeOpen,
      onClick: () => setInitiativeOpen(!initiativeOpen),
      section: "combate",
    });
    items.push({
      type: "toggle",
      id: "dice",
      icon: <Dices className="h-[18px] w-[18px]" />,
      title: "Dados (D)",
      label: "Dados",
      active: diceOpen,
      onClick: () => setDiceOpen(!diceOpen),
      section: "combate",
    });
    if (!isPlayer) items.push({ type: "custom", id: "opportunity", section: "combate" });
    items.push({
      type: "tool",
      id: "measure",
      icon: <Ruler className="h-[18px] w-[18px]" />,
      title: "Régua (segure R)",
      label: "Régua",
      variant: "rail",
      section: "combate",
    });
    items.push({
      type: "tool",
      id: "pointer",
      icon: <MousePointerClick className="h-[18px] w-[18px]" />,
      title: "Ponteiro (ping efêmero)",
      label: "Ponteiro",
      variant: "rail",
      section: "combate",
    });

    items.push({ type: "divider", section: "combate" });

    // Grupo: Ferramentas
    items.push({
      type: "tool",
      id: "draw",
      icon: <Pencil className="h-[18px] w-[18px]" />,
      title: "Desenho livre (pincel / borracha)",
      label: "Desenho",
      variant: "rail",
      section: "ferramentas",
    });
    if (!isPlayer) {
      items.push({
        type: "tool",
        id: "walls",
        icon: <BrickWall className="h-[18px] w-[18px]" />,
        title: "Paredes / Portas / Terreno",
        label: "Paredes",
        variant: "rail",
        section: "ferramentas",
      });
      items.push({
        type: "tool",
        id: "fog",
        icon: <Cloud className="h-[18px] w-[18px]" />,
        title: "Fog of War (paredes, portas, luzes)",
        label: "Nevoeiro",
        variant: "rail",
        section: "ferramentas",
      });
    }
    return items;
  };

  const railItems = buildRailItems();

  // Group items by section for rendering
  const itemsBySection = SECTION_ORDER.reduce(
    (acc, section) => {
      acc[section] = railItems.filter((item) => item.section === section);
      return acc;
    },
    {} as Record<"tela" | "entidades" | "combate" | "ferramentas", RailItem[]>,
  );

  return (
    <div
      role="group"
      aria-label="Ferramentas do mapa"
      className="h-full min-h-0 flex flex-col items-stretch py-2 gap-1 shrink-0 card-enigmatic"
      style={{ width: "100%", backgroundColor: "hsl(var(--card))" }}
    >
      <button
        type="button"
        aria-label={collapsed ? "Expandir ferramentas do mapa" : "Recolher ferramentas do mapa"}
        title={collapsed ? "Expandir ferramentas do mapa" : "Recolher ferramentas do mapa"}
        aria-expanded={!collapsed}
        aria-controls="map-tool-content"
        onClick={() => {
          setPanel(false);
          if (!collapsed) setLayerPanelOpen(false);
          onToggleCollapsed();
        }}
        className={cn(
          "mb-1 flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-border/60 bg-secondary/30 text-base text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
          collapsed ? "justify-center" : "mx-1 justify-between px-3",
        )}
      >
        {!collapsed && <span>Ferramentas</span>}
        {collapsed ? (
          <PanelLeftOpen aria-hidden="true" className="h-5 w-5 shrink-0" />
        ) : (
          <PanelLeftClose aria-hidden="true" className="h-5 w-5 shrink-0" />
        )}
      </button>
      <div
        id="map-tool-content"
        hidden={collapsed}
        className={collapsed ? "hidden" : "flex min-h-0 flex-1 flex-col gap-1"}
      >
        <div className="w-full min-h-0 flex-1 overflow-y-auto flex flex-col gap-1.5 px-1">
          {SECTION_ORDER.map((section) => {
            const items = itemsBySection[section];
            if (!items.length) return null;
            return (
              <div
                key={section}
                role="group"
                aria-label={SECTION_NAMES[section]}
                className="w-full flex flex-col gap-1"
              >
                <RailSectionToggle
                  title={SECTION_NAMES[section]}
                  expanded={!collapsedSections[section]}
                  controls={`map-tools-${section}`}
                  onClick={() =>
                    setCollapsedSections((current) => ({
                      ...current,
                      [section]: !current[section],
                    }))
                  }
                >
                  {SECTION_NAMES[section]}
                </RailSectionToggle>
                <div
                  id={`map-tools-${section}`}
                  hidden={collapsedSections[section]}
                  className="w-full flex flex-col gap-1"
                >
                  {items.map((item, idx) => renderRailItem(item, idx))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-auto w-full shrink-0 border-t border-border/50 pt-2 px-1 flex flex-col items-stretch gap-1">
          <RadioIconButton
            title="Desfazer (Ctrl+Z)"
            label="Desfazer"
            disabled={!canUndo}
            onClick={() => canUndo && undo()}
          >
            <Undo2 className="h-[18px] w-[18px]" />
          </RadioIconButton>
          <RadioIconButton
            title="Refazer (Ctrl+Shift+Z)"
            label="Refazer"
            disabled={!canRedo}
            onClick={() => canRedo && redo()}
          >
            <Redo2 className="h-[18px] w-[18px]" />
          </RadioIconButton>
        </div>
      </div>
    </div>
  );

  function renderRailItem(item: RailItem, idx: number) {
    if (item.type === "divider") {
      return <RailDivider key={`divider-${item.section}-${idx}`} />;
    }

    if ("gmOnly" in item && item.gmOnly && isPlayer) return null;

    if (item.type === "custom") {
      if (item.id === "opportunity") return <OpportunityRailButton key={item.id} />;
      return null;
    }

    if (item.type === "tool") {
      const active = item.shapeFilter
        ? activeTool === "shape" && shape === item.shapeFilter
        : isToolActive(item.id);
      const variant = item.variant ?? "rail";
      const handleClick = () => {
        if (item.shapeFilter) onPickShape(item.shapeFilter);
        pick(item.id);
      };
      const handleContextMenu = (event: React.MouseEvent) => {
        if (item.shapeFilter) onPickShape(item.shapeFilter);
        openPanel(item.id)(event);
      };

      return (
        <RadioIconButton
          key={item.shapeFilter ? `shape-${item.shapeFilter}` : item.id}
          title={item.title}
          label={item.label}
          active={active}
          pressed={active}
          expanded={settingsPanelOpen && activeTool === item.id}
          controls={settingsPanelOpen && activeTool === item.id ? "map-tool-settings" : undefined}
          variant={variant}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        >
          {item.icon}
        </RadioIconButton>
      );
    }

    if (item.type === "toggle") {
      return (
        <RadioIconButton
          key={item.id}
          id={item.id === "layers" ? "map-layers-trigger" : undefined}
          title={item.title}
          label={item.label}
          active={item.active}
          pressed={
            item.id === "undo" || item.id === "redo" || item.id === "layers"
              ? undefined
              : item.active
          }
          expanded={item.id === "layers" ? item.active : undefined}
          controls={item.id === "layers" && item.active ? "map-layer-panel" : undefined}
          disabled={item.disabled}
          variant="rail"
          onClick={item.onClick}
        >
          {item.icon}
        </RadioIconButton>
      );
    }

    return null;
  }
}
