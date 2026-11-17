/**
 * MapTopBar — barra superior simplificada do mapa.
 *
 * Foco: gerenciamento de cena (abas, fundo, import/export) e controles globais
 * (imersivo, ajuda, grade). Ferramentas específicas foram movidas para o ToolRail lateral.
 */
import { Maximize2, Minimize2, HelpCircle, Grid as GridIcon, Settings2 } from 'lucide-react';
import { RadioIconButton } from './RadioIconButton';
import { useMapStore } from '@/stores/useMapStore';
import { SceneTabs } from './SceneTabs';
import { BackgroundButton } from './BackgroundButton';
import { SceneIOButtons } from './SceneIOButtons';
import { cn } from '@/lib/utils';
import { hasToolSettings } from './toolSettings';
import { InvocationQuickHud } from './InvocationQuickHud';

interface Props {
  immersive: boolean;
  onToggleImmersive: () => void;
  onOpenHelp?: () => void;
  gridOpen: boolean;
  onToggleGrid: () => void;
}

export function MapTopBar({
  immersive,
  onToggleImmersive,
  onOpenHelp,
  gridOpen,
  onToggleGrid,
}: Props) {
  const activeTool = useMapStore((s) => s.activeTool);
  const settingsOpen = useMapStore((s) => s.settingsPanelOpen);
  const setSettingsPanelOpen = useMapStore((s) => s.setSettingsPanelOpen);
  const canConfigureActiveTool = hasToolSettings(activeTool);

  return (
    <div
      className={cn("h-12 min-w-0 shrink-0 flex items-center overflow-x-auto overscroll-x-contain touch-pan-x px-2 gap-2 text-foreground [scrollbar-width:thin] border-b border-border", "card-enigmatic")}
      style={{ backgroundColor: 'hsl(var(--card))' }}
    >
      <div className="min-w-0 flex-1 overflow-hidden" style={{ minWidth: 'min(12rem, 35vw)' }}>
        <SceneTabs />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <BackgroundButton />
        <SceneIOButtons />
        <InvocationQuickHud />
        {canConfigureActiveTool && (
          <RadioIconButton
            variant="ghost"
            title="Configurações da ferramenta"
            label="Ajustes"
            active={settingsOpen}
            expanded={settingsOpen}
            controls={settingsOpen ? 'map-tool-settings' : undefined}
            onClick={() => setSettingsPanelOpen(!settingsOpen)}
          >
            <Settings2 className="h-4 w-4" />
          </RadioIconButton>
        )}
        <RadioIconButton
          id="map-grid-trigger"
          variant="ghost"
          title="Grade (G)"
          label="Grade"
          active={gridOpen}
          expanded={gridOpen}
          controls={gridOpen ? 'map-grid-settings' : undefined}
          onClick={onToggleGrid}
        >
          <GridIcon className="h-4 w-4" />
        </RadioIconButton>
        <RadioIconButton
          variant="ghost"
          title="Ajuda / atalhos (?)"
          label="Ajuda"
          active={false}
          onClick={() => onOpenHelp?.()}
        >
          <HelpCircle className="h-4 w-4" />
        </RadioIconButton>
        <RadioIconButton
          variant="ghost"
          title={immersive ? 'Sair do modo imersivo' : 'Modo imersivo'}
          label={immersive ? 'Sair' : 'Imersivo'}
          active={immersive}
          pressed={immersive}
          onClick={onToggleImmersive}
        >
          {immersive ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </RadioIconButton>
      </div>
    </div>
  );
}
