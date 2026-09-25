/**
 * DrawSettings — painel contextual da ferramenta de desenho.
 * Pincel/Borracha, cor, espessura, limpar tudo.
 */
import { useMapStore } from '@/stores/useMapStore';
import { Pencil, Eraser, Trash2 } from 'lucide-react';

export function DrawSettings() {
  const draw = useMapStore((s) => s.toolSettings.draw);
  const setToolSettings = useMapStore((s) => s.setToolSettings);
  const clearStrokes = useMapStore((s) => s.clearStrokes);
  const count = useMapStore((s) => s.drawings.length);

  return (
    <div className="w-56 space-y-3 text-xs">
      <div className="text-sm font-medium">Desenho</div>

      <div className="grid grid-cols-2 gap-1">
        <ModeBtn
          active={draw.mode === 'pen'}
          onClick={() => setToolSettings('draw', { mode: 'pen' })}
          icon={<Pencil className="h-3.5 w-3.5" />}
          label="Pincel"
        />
        <ModeBtn
          active={draw.mode === 'eraser'}
          onClick={() => setToolSettings('draw', { mode: 'eraser' })}
          icon={<Eraser className="h-3.5 w-3.5" />}
          label="Borracha"
        />
      </div>

      <div>
        <div className="text-muted-foreground mb-1">Cor</div>
        <input
          type="color"
          value={draw.color}
          onChange={(e) => setToolSettings('draw', { color: e.target.value })}
          className="h-7 w-full bg-secondary border border-border rounded cursor-pointer"
        />
      </div>

      <div>
        <div className="text-muted-foreground mb-1">
          Espessura: <span className="tabular-nums">{draw.size}px</span>
        </div>
        <input
          type="range"
          min={1}
          max={40}
          step={1}
          value={draw.size}
          onChange={(e) => setToolSettings('draw', { size: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      <button
        onClick={clearStrokes}
        disabled={count === 0}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border border-border hover:bg-secondary text-foreground/80 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Trash2 className="h-3 w-3" /> Limpar tudo ({count})
      </button>
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded border text-xs transition-colors ${
        active
          ? 'bg-zinc-100 text-accent-foreground border-zinc-100'
          : 'border-border text-foreground/80 hover:bg-secondary'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
