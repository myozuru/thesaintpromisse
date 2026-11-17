/**
 * ToolSettingsPanel — painel contextual inline ao lado do rail.
 *
 * Visível quando a ferramenta ativa tem configurações e o painel está aberto.
 * O botão "Ajustes" na barra superior é o acesso principal; clique-direito no rail segue como atalho.
 *
 * Posicionamento: ancorado ao rail, sem cálculo de linha que dependa da ordem/role dos botões.
 * O painel é renderizado uma vez junto ao rail.
 */
import { useEffect, useRef } from "react";
import { useMapStore } from "@/stores/useMapStore";
import { ShapeSettings } from "./settings/ShapeSettings";
import { MeasureSettings } from "./settings/MeasureSettings";
import { DrawSettings } from "./settings/DrawSettings";
import { PointerSettings } from "./settings/PointerSettings";
import { NoteSettings } from "./settings/NoteSettings";
import { TemplateSettings } from "./settings/TemplateSettings";
import { WallsSettings } from "./settings/WallsSettings";
import { HelpVisibilityContext } from "./settings/helpContext";
import { cn } from "@/lib/utils";
import { hasToolSettings } from "./toolSettings";

export function ToolSettingsPanel() {
  const activeTool = useMapStore((s) => s.activeTool);
  const settingsOpen = useMapStore((s) => s.settingsPanelOpen);
  const setSettingsPanelOpen = useMapStore((s) => s.setSettingsPanelOpen);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Mostra painel se a ferramenta ativa tem configurações E o painel está aberto
  const hasSettings = hasToolSettings(activeTool);
  const shouldShow = hasSettings && settingsOpen;

  useEffect(() => {
    if (shouldShow && !wasOpenRef.current) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const frame = window.requestAnimationFrame(() => {
        const firstControl = panelRef.current?.querySelector<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        (firstControl ?? panelRef.current)?.focus();
      });
      wasOpenRef.current = true;
      return () => window.cancelAnimationFrame(frame);
    }

    if (!shouldShow && wasOpenRef.current) {
      const activeElement = document.activeElement;
      if (activeElement === document.body || panelRef.current?.contains(activeElement)) {
        returnFocusRef.current?.focus();
      }
      wasOpenRef.current = false;
      returnFocusRef.current = null;
    }
  }, [shouldShow]);

  if (!shouldShow) return null;

  return (
    <div
      ref={panelRef}
      id="map-tool-settings"
      role="dialog"
      aria-modal="false"
      aria-label="Configurações da ferramenta do mapa"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setSettingsPanelOpen(false);
        }
      }}
      className={cn(
        "absolute z-20 rounded-lg p-3 pointer-events-auto",
        "card-enigmatic shadow-2xl",
      )}
      style={{
        top: 8,
        left: "calc(100% + 8px)",
        backgroundColor: "hsl(var(--card))",
        color: "hsl(var(--foreground))",
      }}
    >
      <HelpVisibilityContext.Provider value={true}>
        {activeTool === "measure" && <MeasureSettings />}
        {activeTool === "shape" && <ShapeSettings />}
        {activeTool === "draw" && <DrawSettings />}
        {activeTool === "pointer" && <PointerSettings />}
        {activeTool === "note" && <NoteSettings />}
        {activeTool === "template" && <TemplateSettings />}
        {activeTool === "walls" && <WallsSettings />}
      </HelpVisibilityContext.Provider>
    </div>
  );
}
