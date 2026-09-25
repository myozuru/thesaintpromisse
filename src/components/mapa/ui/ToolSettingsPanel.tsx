/**
 * ToolSettingsPanel — painel contextual inline ao lado do rail.
 */
import { useMapStore, type ToolId } from '@/stores/useMapStore';
import { ShapeSettings } from './settings/ShapeSettings';
import { MeasureSettings } from './settings/MeasureSettings';
import { DrawSettings } from './settings/DrawSettings';
import { PointerSettings } from './settings/PointerSettings';
import { NoteSettings } from './settings/NoteSettings';
import { TemplateSettings } from './settings/TemplateSettings';
import { WallsSettings } from './settings/WallsSettings';
import { HelpVisibilityContext } from './settings/helpContext';

const BTN = 36;
const GAP = 4;
const TOP_PAD = 8;

const TOOL_ROW: Record<Exclude<ToolId, 'select'>, number> = {
  measure: 1,
  draw: 2,
  pointer: 3,
  note: 4,
  template: 5,
  walls: 6,
  fog: 7,
  shape: 9,
};

function panelTopFor(tool: Exclude<ToolId, 'select'>): number {
  const row = TOOL_ROW[tool];
  let dividers = 0;
  if (row >= 6) dividers += 1;
  if (row >= 9) dividers += 1;
  return TOP_PAD + row * (BTN + GAP) + dividers * 9;
}

export function ToolSettingsPanel({ placement = 'rail' }: { placement?: 'rail' | 'top' }) {
  const activeTool = useMapStore((s) => s.activeTool);
  const open = useMapStore((s) => s.settingsPanelOpen);
  if (activeTool === 'select' || !open) return null;
  const isTopToolbar = activeTool === 'walls';

  if (placement === 'top' && !isTopToolbar) return null;
  if (placement === 'rail' && isTopToolbar) return null;

  if (isTopToolbar) {
    return (
      <div
        className="absolute z-40 rounded-lg border border-border bg-popover px-2 py-1.5 text-popover-foreground shadow-2xl pointer-events-auto overflow-hidden"
        style={{
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'max-content',
          maxWidth: 'calc(100% - 24px)',
        }}
      >
        <HelpVisibilityContext.Provider value={true}>
          <div className="flex items-center justify-center gap-2 whitespace-nowrap">
            <WallsSettings horizontal />
          </div>
        </HelpVisibilityContext.Provider>
      </div>
    );
  }

  const top = panelTopFor(activeTool);

  return (
    <div
      className="absolute z-20 rounded-lg p-3 shadow-2xl pointer-events-auto"
      style={{
        top,
        left: 52,
        background: 'hsl(var(--card))',
        border: '1px solid #2a2b30',
        color: 'hsl(var(--foreground))',
      }}
    >
      <HelpVisibilityContext.Provider value={true}>
        {activeTool === 'measure' && <MeasureSettings />}
        {activeTool === 'shape' && <ShapeSettings />}
        {activeTool === 'draw' && <DrawSettings />}
        {activeTool === 'pointer' && <PointerSettings />}
        {activeTool === 'note' && <NoteSettings />}
        {activeTool === 'template' && <TemplateSettings />}
      </HelpVisibilityContext.Provider>
    </div>
  );
}
