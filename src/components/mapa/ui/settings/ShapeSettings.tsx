/**
 * ShapeSettings — painel contextual da ferramenta Shape.
 * Forma + cor.
 */
import { Square, Circle } from 'lucide-react';
import { useMapStore, type EntityShape } from '@/stores/useMapStore';
import { useHelpVisible } from './helpContext';

export function ShapeSettings() {
  const shape = useMapStore((s) => s.toolSettings.shape.shape);
  const color = useMapStore((s) => s.toolSettings.shape.color);
  const setToolSettings = useMapStore((s) => s.setToolSettings);
  const showHelp = useHelpVisible();

  return (
    <div className="space-y-3 w-56">
      <Header label="Formas" />

      <div>
        <Label>Tipo</Label>
        <div className="grid grid-cols-2 gap-1">
          <SegBtn active={shape === 'RECT'} onClick={() => setToolSettings('shape', { shape: 'RECT' as EntityShape })}>
            <Square className="h-3.5 w-3.5" /> Retângulo
          </SegBtn>
          <SegBtn active={shape === 'ELLIPSE'} onClick={() => setToolSettings('shape', { shape: 'ELLIPSE' as EntityShape })}>
            <Circle className="h-3.5 w-3.5" /> Elipse
          </SegBtn>
        </div>
      </div>

      <div>
        <Label>Cor</Label>
        <input
          type="color" value={color}
          onChange={(e) => setToolSettings('shape', { color: e.target.value })}
          className="h-8 w-full bg-secondary border border-border rounded cursor-pointer"
        />
      </div>

      {showHelp && (
        <p className="text-zinc-500 text-[11px] leading-relaxed">
          Duplo-clique no mapa para criar.
        </p>
      )}
    </div>
  );
}

function Header({ label }: { label: string }) {
  return <div className="text-foreground/80 text-xs font-semibold uppercase tracking-wider">{label}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-muted-foreground text-[11px] mb-1">{children}</div>;
}
function SegBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[11px] font-medium transition-colors ${
        active
          ? 'bg-zinc-100 text-zinc-900'
          : 'bg-secondary text-foreground/80 hover:bg-secondary border border-border'
      }`}
    >
      {children}
    </button>
  );
}
