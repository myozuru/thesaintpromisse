/**
 * MeasureSettings — painel contextual da ferramenta Régua.
 * Estilo de medição (compartilha com gridConfig) + toggle "mostrar total".
 */
import { useMapStore, type MeasurementStyle } from '@/stores/useMapStore';
import { Trash2 } from 'lucide-react';
import { useHelpVisible } from './helpContext';

export function MeasureSettings() {
  const showHelp = useHelpVisible();
  const style = useMapStore((s) => s.gridConfig.measurementStyle);
  const setGridConfig = useMapStore((s) => s.setGridConfig);
  const showTotal = useMapStore((s) => s.toolSettings.measure.showTotal);
  const setToolSettings = useMapStore((s) => s.setToolSettings);
  const rulersCount = useMapStore((s) => s.rulers.length);
  const clearRulers = useMapStore((s) => s.clearRulers);

  return (
    <div className="space-y-3 w-56">
      <Header label="Régua" />

      <div>
        <Label>Estilo de medição</Label>
        <select
          value={style}
          onChange={(e) => setGridConfig({ measurementStyle: e.target.value as MeasurementStyle })}
          className="bg-secondary border border-border rounded px-2 py-1 w-full text-foreground text-xs"
        >
          <option value="CHEBYSHEV">Chebyshev (5e)</option>
          <option value="ALTERNATING">Alternada (3.5)</option>
          <option value="MANHATTAN">Manhattan</option>
          <option value="EUCLIDEAN">Euclidiana</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-foreground/80 text-xs">
        <input
          type="checkbox"
          checked={showTotal}
          onChange={(e) => setToolSettings('measure', { showTotal: e.target.checked })}
        />
        Mostrar total
      </label>

      <button
        type="button"
        onClick={() => clearRulers()}
        disabled={rulersCount === 0}
        className="w-full px-2 py-1 rounded border border-border hover:bg-secondary flex items-center justify-center gap-1 text-foreground/80 text-xs disabled:opacity-40"
      >
        <Trash2 className="h-3 w-3" /> Limpar réguas ({rulersCount})
      </button>

      {showHelp && (
        <p className="text-zinc-500 text-[11px] leading-relaxed">
          Atalho: segure <kbd className="px-1 rounded bg-secondary border border-border">R</kbd> para medir sem trocar a ferramenta. Solte com <kbd className="px-1 rounded bg-secondary border border-border">Shift</kbd> para fixar a régua. Clique-direito em uma régua para removê-la.
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
