import { useRef, useState } from 'react';
import { Move, RotateCcw, ZoomIn } from 'lucide-react';
import type { Boss } from '@/lib/bosses';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { BossPortrait } from './BossPortrait';

interface Props {
  boss: Boss;
  onApply: (crop: Pick<Boss, 'retratoZoom' | 'retratoX' | 'retratoY'>) => void;
  onCancel: () => void;
}

interface Crop { zoom: number; x: number; y: number }

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function BossPortraitEditor({ boss, onApply, onCancel }: Props) {
  const [crop, setCrop] = useState<Crop>({
    zoom: boss.retratoZoom ?? 1,
    x: boss.retratoX ?? 50,
    y: boss.retratoY ?? 50,
  });
  const dragRef = useRef<{ clientX: number; clientY: number; x: number; y: number } | null>(null);
  const previewBoss = { ...boss, retratoZoom: crop.zoom, retratoX: crop.x, retratoY: crop.y };

  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm" onPointerDown={onCancel}>
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-2xl" onPointerDown={(event) => event.stopPropagation()}>
        <h2 className="text-xl font-semibold">Ajustar foto do chefe</h2>
        <p className="mt-1 text-sm text-muted-foreground">Arraste a foto e use o controle para escolher o enquadramento.</p>

        <div className="mx-auto my-5 aspect-square w-full max-w-[320px] overflow-hidden rounded-full border-2 border-accent/60 bg-secondary shadow-inner">
          <div
            role="application"
            aria-label="Prévia ajustável da foto do chefe"
            className="h-full w-full touch-none cursor-grab overflow-hidden active:cursor-grabbing"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = { clientX: event.clientX, clientY: event.clientY, x: crop.x, y: crop.y };
            }}
            onPointerMove={(event) => {
              const start = dragRef.current;
              if (!start) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const sensitivity = 100 / Math.max(1, crop.zoom);
              setCrop((current) => ({
                ...current,
                x: clamp(start.x - ((event.clientX - start.clientX) / rect.width) * sensitivity),
                y: clamp(start.y - ((event.clientY - start.clientY) / rect.height) * sensitivity),
              }));
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              dragRef.current = null;
            }}
            onPointerCancel={() => { dragRef.current = null; }}
          >
            <BossPortrait boss={previewBoss} alt={`Prévia de ${boss.nome}`} draggable={false} />
          </div>
        </div>

        <label className="block">
          <span className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><ZoomIn className="h-3.5 w-3.5" /> Tamanho</span>
            <span className="font-mono text-foreground">{Math.round(crop.zoom * 100)}%</span>
          </span>
          <Slider
            value={[crop.zoom]}
            min={1}
            max={3}
            step={0.01}
            onValueChange={([zoom]) => setCrop((current) => ({ ...current, zoom: zoom ?? current.zoom }))}
            aria-label="Tamanho da foto"
          />
        </label>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Move className="h-4 w-4" /> Arraste a foto para reposicionar.</p>

        <div className="mt-6 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setCrop({ zoom: 1, x: 50, y: 50 })}>
            <RotateCcw className="h-4 w-4" /> Restaurar
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
            <Button type="button" size="sm" onClick={() => onApply({ retratoZoom: crop.zoom, retratoX: crop.x, retratoY: crop.y })}>Aplicar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}