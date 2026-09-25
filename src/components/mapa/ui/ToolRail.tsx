/**
 * ToolRail — coluna vertical de ferramentas (estilo Owlbear Rodeo).
 */
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
} from 'lucide-react';
import { useMapStore, type EntityShape, type ToolId } from '@/stores/useMapStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { RadioIconButton, RailDivider } from './RadioIconButton';
import { OpportunityRailButton } from './OpportunityRailButton';

interface Props {
  activeTool: ToolId;
  shape: EntityShape;
  onSelectTool: (id: ToolId) => void;
  onPickShape: (s: EntityShape) => void;
}

export function ToolRail({
  activeTool,
  shape,
  onSelectTool,
  onPickShape,
}: Props) {
  const undo = useMapStore((s) => s.undo);
  const redo = useMapStore((s) => s.redo);
  const canUndo = useMapStore((s) => s._undo.length > 0);
  const canRedo = useMapStore((s) => s._redo.length > 0);
  const setPanel = useMapStore((s) => s.setSettingsPanelOpen);
  const isPlayer = useRoleStore((s) => s.role) === 'PLAYER';
  const pick = (id: ToolId) => { onSelectTool(id); setPanel(false); };
  const openPanel = (id: ToolId) => (e: React.MouseEvent) => {
    e.preventDefault();
    onSelectTool(id);
    setPanel(true);
  };
  return (
    <div
      className="h-full w-12 flex flex-col items-center py-2 gap-1 shrink-0 bg-card border-r border-border"
    >
      <RadioIconButton
        title="Selecionar / mover"
        active={activeTool === 'select'}
        onClick={() => pick('select')}
      >
        <MousePointer2 className="h-[18px] w-[18px]" />
      </RadioIconButton>
      <RadioIconButton
        title="Régua (segure R) — clique-direito p/ opções"
        active={activeTool === 'measure'}
        onClick={() => pick('measure')}
        onContextMenu={openPanel('measure')}
      >
        <Ruler className="h-[18px] w-[18px]" />
      </RadioIconButton>
      <RadioIconButton
        title="Desenho livre (pincel / borracha) — clique-direito p/ opções"
        active={activeTool === 'draw'}
        onClick={() => pick('draw')}
        onContextMenu={openPanel('draw')}
      >
        <Pencil className="h-[18px] w-[18px]" />
      </RadioIconButton>
      <RadioIconButton
        title="Ponteiro (ping efêmero) — clique-direito p/ opções"
        active={activeTool === 'pointer'}
        onClick={() => pick('pointer')}
        onContextMenu={openPanel('pointer')}
      >
        <MousePointerClick className="h-[18px] w-[18px]" />
      </RadioIconButton>
      <RadioIconButton
        title="Anotação (pino com texto) — clique-direito p/ opções"
        active={activeTool === 'note'}
        onClick={() => pick('note')}
        onContextMenu={openPanel('note')}
      >
        <StickyNote className="h-[18px] w-[18px]" />
      </RadioIconButton>
      <RadioIconButton
        title="Templates de área — clique-direito p/ opções"
        active={activeTool === 'template'}
        onClick={() => pick('template')}
        onContextMenu={openPanel('template')}
      >
        <TriangleIcon className="h-[18px] w-[18px]" />
      </RadioIconButton>

      {!isPlayer && <RailDivider />}


      {!isPlayer && (
        <RadioIconButton
          title="Fog of War (paredes, portas, luzes)"
          active={activeTool === 'fog'}
          onClick={() => pick('fog')}
        >
          <Cloud className="h-[18px] w-[18px]" />
        </RadioIconButton>
      )}

      {!isPlayer && <OpportunityRailButton />}

      <RailDivider />

      <RadioIconButton
        title="Formas (duplo-clique no mapa para criar) — clique-direito p/ opções"
        active={activeTool === 'shape' && shape === 'RECT'}
        onClick={() => { pick('shape'); onPickShape('RECT'); }}
        onContextMenu={(e) => { onPickShape('RECT'); openPanel('shape')(e); }}
      >
        <SquareIcon className="h-[18px] w-[18px]" />
      </RadioIconButton>
      <RadioIconButton
        title="Formas: elipse — clique-direito p/ opções"
        active={activeTool === 'shape' && shape === 'ELLIPSE'}
        onClick={() => { pick('shape'); onPickShape('ELLIPSE'); }}
        onContextMenu={(e) => { onPickShape('ELLIPSE'); openPanel('shape')(e); }}
      >
        <CircleIcon className="h-[18px] w-[18px]" />
      </RadioIconButton>

      <div className="flex-1" />

      <RadioIconButton
        title="Desfazer (Ctrl+Z)"
        onClick={() => canUndo && undo()}
        disabled={!canUndo}
      >
        <Undo2 className="h-[18px] w-[18px]" />
      </RadioIconButton>
      <RadioIconButton
        title="Refazer (Ctrl+Shift+Z)"
        onClick={() => canRedo && redo()}
        disabled={!canRedo}
      >
        <Redo2 className="h-[18px] w-[18px]" />
      </RadioIconButton>
    </div>
  );
}
