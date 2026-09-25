/**
 * TemplateSettings — painel contextual da ferramenta Template (AoE).
 * Permite escolher tipo (circle/cone/line/square), cor, opacidade e
 * largura padrão (apenas line). Inclui ação "limpar todos".
 */
import { Circle, Triangle, Minus, Square as SquareIcon, Trash2 } from 'lucide-react';
import { useMapStore } from '@/stores/useMapStore';
import type { TemplateKind } from '@/components/mapa/TemplateEngine';

const KINDS: Array<{ id: TemplateKind; icon: React.ReactNode; label: string }> = [
  { id: 'circle', icon: <Circle className="h-3.5 w-3.5" />, label: 'Círculo' },
  { id: 'cone', icon: <Triangle className="h-3.5 w-3.5" />, label: 'Cone' },
  { id: 'line', icon: <Minus className="h-3.5 w-3.5" />, label: 'Linha' },
  { id: 'square', icon: <SquareIcon className="h-3.5 w-3.5" />, label: 'Quadrado' },
];

import { useHelpVisible } from './helpContext';

export function TemplateSettings() {
  const s = useMapStore((st) => st.toolSettings.template);
  const setToolSettings = useMapStore((st) => st.setToolSettings);
  const clearTemplates = useMapStore((st) => st.clearTemplates);
  const templatesCount = useMapStore((st) => st.templates.length);
  const showHelp = useHelpVisible();

  return (
    <div className="space-y-3 w-60">
      <Header label="Templates de Área" />

      <div>
        <Label>Tipo</Label>
        <div className="grid grid-cols-4 gap-1">
          {KINDS.map((k) => {
            const active = s.kind === k.id;
            return (
              <button
                key={k.id}
                type="button"
                title={k.label}
                onClick={() => setToolSettings('template', { kind: k.id })}
                className="flex flex-col items-center gap-1 py-2 rounded border text-[10px]"
                style={{
                  background: active ? 'hsl(var(--border))' : '#1f2024',
                  borderColor: active ? '#7cc4ff' : 'hsl(var(--border))',
                  color: active ? 'hsl(var(--foreground))' : '#a1a1aa',
                }}
              >
                {k.icon}
                <span>{k.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Cor</Label>
        <input
          type="color"
          value={s.color}
          onChange={(e) => setToolSettings('template', { color: e.target.value })}
          className="h-7 w-full bg-secondary border border-border rounded"
        />
      </div>

      <div>
        <Label>Opacidade: {Math.round(s.opacity * 100)}%</Label>
        <input
          type="range"
          min={0.2}
          max={1}
          step={0.05}
          value={s.opacity}
          onChange={(e) => setToolSettings('template', { opacity: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      {s.kind === 'line' && (
        <div>
          <Label>Largura (cel): {s.widthCells.toFixed(1)}</Label>
          <input
            type="range"
            min={0.5}
            max={4}
            step={0.5}
            value={s.widthCells}
            onChange={(e) => setToolSettings('template', { widthCells: Number(e.target.value) })}
            className="w-full"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => clearTemplates()}
        disabled={templatesCount === 0}
        className="w-full px-2 py-1 rounded border border-border hover:bg-secondary flex items-center justify-center gap-1 text-foreground/80 text-xs disabled:opacity-40"
      >
        <Trash2 className="h-3 w-3" /> Limpar templates ({templatesCount})
      </button>

      {showHelp && (
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Arraste no mapa para posicionar. Clique-direito em um template para removê-lo.
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
