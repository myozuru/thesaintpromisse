import { useEffect, useRef, useState } from 'react';
import { Circle, Move, RotateCcw, Square, ZoomIn } from 'lucide-react';
import type { Entity, TokenCrop } from '@/stores/useMapStore';
import { DEFAULT_TOKEN_BORDER, TOKEN_BORDERS, drawTokenBorder, type TokenBorderStyle } from '@/lib/mapa/tokenBorders';
import { assetCache } from '../assetCache';
import { getTokenImageRect, normalizeTokenCrop } from '../EntityEngine';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  entity: Entity;
  onConfirm: (crop: TokenCrop, circular: boolean) => void;
  onCancel: () => void;
  circularOnly?: boolean;
  busy?: boolean;
  error?: string;
}

const DEFAULT_CROP: TokenCrop = { zoom: 1, offsetX: 0, offsetY: 0 };

export function TokenCropDialog({ entity, onConfirm, onCancel, circularOnly = false, busy = false, error }: Props) {
  const [crop, setCrop] = useState(() => normalizeTokenCrop(entity.tokenCrop));
  const [circular, setCircular] = useState(circularOnly || entity.shape === 'ELLIPSE');
  const useCircularFrame = circularOnly || circular;
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
    if (useCircularFrame) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 9, 0, Math.PI * 2);
      ctx.clip();
      const rect = getTokenImageRect(image.naturalWidth, image.naturalHeight, size, size, crop);
      ctx.drawImage(image, size / 2 + rect.x, size / 2 + rect.y, rect.w, rect.h);
      ctx.restore();
      ctx.save();
      ctx.translate(size / 2, size / 2);
      drawTokenBorder(ctx, size / 2, size / 2, border, 1.5);
      ctx.restore();
    } else {
      const fit = Math.min(size / image.naturalWidth, size / image.naturalHeight);
      const w = image.naturalWidth * fit, h = image.naturalHeight * fit;
      ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
    }
  }, [cached, useCircularFrame, crop, border, imageReadyTick]);

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
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <DialogContent
        overlayClassName="z-[1099] bg-background/80 backdrop-blur-sm"
        className="z-[1100] max-h-[calc(100dvh-2rem)] max-w-md overflow-y-auto p-5 text-card-foreground"
      >
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="text-lg">Ajustar enquadramento</DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            Arraste a imagem e ajuste o zoom até o personagem ficar bem enquadrado no círculo.
          </DialogDescription>
        </DialogHeader>

        {!circularOnly && <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/40 p-1" aria-label="Formato do personagem">
          <Button type="button" size="sm" variant={circular ? 'secondary' : 'ghost'} onClick={() => setCircular(true)}><Circle /> Circular</Button>
          <Button type="button" size="sm" variant={!circular ? 'secondary' : 'ghost'} onClick={() => setCircular(false)}><Square /> Sem círculo</Button>
        </div>}

        <div className={`mx-auto aspect-square w-full max-w-[300px] overflow-hidden bg-background shadow-inner ring-1 ring-border ${useCircularFrame ? 'rounded-full' : 'rounded-md'}`}>
          <canvas
            ref={canvasRef}
            width={600}
            height={600}
            className={`h-full w-full touch-none ${useCircularFrame ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
            aria-label="Prévia do recorte circular da imagem"
            onPointerDown={(event) => {
              if (useCircularFrame) {
                event.currentTarget.setPointerCapture(event.pointerId);
                dragRef.current = { x: event.clientX, y: event.clientY, crop };
              }
            }}
            onPointerMove={(event) => updateFromDrag(event.clientX, event.clientY)}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              dragRef.current = null;
            }}
            onPointerCancel={() => { dragRef.current = null; }}
          />
        </div>

        {useCircularFrame && <div className="space-y-4">
          <label className="block">
            <span className="mb-2 flex items-center justify-between text-base text-muted-foreground">
              <span className="flex items-center gap-1.5"><ZoomIn className="h-4 w-4" /> Zoom</span>
              <span className="font-mono text-foreground">{Math.round(crop.zoom * 100)}%</span>
            </span>
            <Slider aria-label="Zoom do recorte" value={[crop.zoom]} min={1} max={4} step={0.01} onValueChange={([zoom]) => setCrop(normalizeTokenCrop({ ...crop, zoom }))} />
          </label>
          <div className="flex items-center gap-2 text-base text-muted-foreground">
            <Move className="h-4 w-4" /> Arraste a prévia para reposicionar.
          </div>
          <div>
            <span className="mb-2 block text-base text-muted-foreground">Moldura</span>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Estilo da moldura">
              {TOKEN_BORDERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={border === option.id}
                  onClick={() => setBorder(option.id)}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-md border px-2 py-1.5 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    border === option.id
                      ? 'border-primary bg-secondary text-foreground'
                      : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-black/40"
                    style={{ background: option.main, boxShadow: `0 0 6px ${option.glow}` }}
                  />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>}

        {error && <p className="text-base text-destructive" role="alert">{error}</p>}
        {!cached?.ready && <p className="text-base text-muted-foreground" role="status">Carregando imagem para o recorte…</p>}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setCrop(DEFAULT_CROP)}>
            <RotateCcw /> Restaurar
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCancel}>Cancelar</Button>
            <Button type="button" size="sm" disabled={busy || !cached?.ready} aria-busy={busy} onClick={() => onConfirm({ ...crop, border }, useCircularFrame)}>{busy ? 'Salvando…' : 'Aplicar recorte'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
