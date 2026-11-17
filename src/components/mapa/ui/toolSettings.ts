import type { ToolId } from '@/stores/useMapStore';

/** Shared width keeps the labeled rail and its adjacent settings panel aligned. */
export const MAP_TOOL_RAIL_WIDTH = 'clamp(168px, 16vw, 208px)';

/** Tools whose settings are rendered by ToolSettingsPanel. */
export const TOOLS_WITH_SETTINGS: ReadonlySet<ToolId> = new Set([
  'measure',
  'shape',
  'draw',
  'pointer',
  'note',
  'template',
  'walls',
]);

export function hasToolSettings(tool: ToolId): boolean {
  return TOOLS_WITH_SETTINGS.has(tool);
}
