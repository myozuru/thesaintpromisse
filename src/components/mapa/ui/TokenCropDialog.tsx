import { useEffect, useRef, useState } from 'react';
import { Circle, Move, RotateCcw, Square, ZoomIn } from 'lucide-react';
import type { Entity, TokenCrop } from '@/stores/useMapStore';
import { DEFAULT_TOKEN_BORDER, TOKEN_BORDERS, drawTokenBorder, type TokenBorderStyle } from '@/lib/mapa/tokenBorders';
import { assetCache } from '../assetCache';
import { getTokenImageRect, normalizeTokenCrop } from '../EntityEngine';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface Props {
  entity: Entity;
  onConfirm: (crop: TokenCrop, circular: boolean) => void;
  onCancel: () => void;
}

const DEFAULT_CROP: TokenCrop = { zoom: 1, offsetX: 0, offsetY: 0 };

export function TokenCropDialog({ entity, onConfirm, onCancel }: Props) {
  const [crop, setCrop] = useState(() => normalizeTokenCrop(entity.tokenCrop));
  const [circular, setCircular] = useState(entity.shape === 'ELLIPSE');
  const [border, setBorder] = useState<TokenBorderStyle>(entity.tokenCrop?.border ?? DEFAULT_TOKEN_BORDER);
  const [imageReadyTick, setImageReadyTick] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number; crop: TokenCrop } | null>(null);
  const cached = entity.assetId ? assetCache.get(entity.assetId) : null;

  useEffect(() => {
    if (!cached || cached.ready) return;
    const timer = window.setInterval(() => {
      if (!cached.ready) return;
      window.clearInterval(timer);
      setImageReadyTick((value) => value + 1);
    }, 40);
    return () => window.clearInterval(timer);
  }, [cached]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = cached?.img;
    if (!canvas || !image || !cached.ready) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    if (circular) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 9, 0, Math.PI * 2);
      ctx.clip();
      const rect = getTokenImageRect(image.naturalWidth, image.naturalHeight, size, size, crop);
      ctx.drawImage(image, size / 2 + rect.x, size / 2 + rect.y, rect.w, rect.h);
      ctx.restore();
      ctx.strokeStyle = 'hsl(260 28% 9%)';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'hsl(265 70% 67%)';
      ctx.lineWidth = 6;
      ctx.shadowColor = 'hsl(265 70% 67%)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'hsla(0 0% 100% / 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 20, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const fit = Math.min(size / image.naturalWidth, size / image.naturalHeight);
      const w = image.naturalWidth * fit, h = image.naturalHeight * fit;
      ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
    }
  }, [cached, circular, crop, imageReadyTick]);

  const updateFromDrag = (clientX: number, clientY: number) => {
    const start = dragRef.current;
    const image = cached?.img;
    const canvas = canvasRef.current;
    if (!start || !image || !canvas) return;
    const rect = getTokenImageRect(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height, start.crop);
    const overflowX = Math.max(0, rect.w - canvas.width) / 2;
    const overflowY = Math.max(0, rect.h - canvas.height) / 2;
    const scale = canvas.width / canvas.getBoundingClientRect().width;
    const dx = (clientX - start.x) * scale;
    const dy = (clientY - start.y) * scale;
    setCrop(normalizeTokenCrop({
      ...start.crop,
      offsetX: overflowX > 0 ? start.crop.offsetX + (dx / overflowX) * 100 : 0,
      offsetY: overflowY > 0 ? start.crop.offsetY + (dy / overflowY) * 100 : 0,
    }));
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" onMouseDown={onCancel}>
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 text-card-foreground shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-4">
          <h2 className="text-base font-semibold">Ajustar personagem</h2>
          <p className="mt-1 text-xs text-muted-foreground">Escolha o formato e ajuste o enquadramento do personagem.</p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/40 p-1" aria-label="Formato do personagem">
          <Button type="button" size="sm" variant={circular ? 'secondary' : 'ghost'} onClick={() => setCircular(true)}><Circle /> Circular</Button>
          <Button type="button" size="sm" variant={!circular ? 'secondary' : 'ghost'} onClick={() => setCircular(false)}><Square /> Sem círculo</Button>
        </div>

        <div className={`mx-auto mb-5 aspect-square w-full max-w-[300px] overflow-hidden bg-background shadow-inner ring-1 ring-border ${circular ? 'rounded-full' : 'rounded-md'}`}>
          <canvas
            ref={canvasRef}
            width={600}
            height={600}
            className={`h-full w-full touch-none ${circular ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
            aria-label="Prévia do enquadramento do personagem"
            onPointerDown={(event) => {
              if (circular) {
                event.currentTarget.setPointerCapture(event.pointerId);
                dragRef.current = { x: event.clientX, y: event.clientY, crop };
              }
            }}
            onPointerMove={(event) => updateFromDrag(event.clientX, event.clientY)}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              dragRef.current = null;
            }}
            onPointerCancel={() => { dragRef.current = null; }}
          />
        </div>

        {circular && <div className="space-y-4">
          <label className="block">
            <span className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><ZoomIn className="h-3.5 w-3.5" /> Zoom</span>
              <span className="font-mono text-foreground">{Math.round(crop.zoom * 100)}%</span>
            </span>
            <Slider value={[crop.zoom]} min={1} max={4} step={0.01} onValueChange={([zoom]) => setCrop(normalizeTokenCrop({ ...crop, zoom }))} />
          </label>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Move className="h-3.5 w-3.5" /> Arraste a prévia para reposicionar.
          </div>
        </div>}

        <div className="mt-6 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setCrop(DEFAULT_CROP)}>
            <RotateCcw /> Restaurar
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
            <Button type="button" size="sm" onClick={() => onConfirm(crop, circular)}>Aplicar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}