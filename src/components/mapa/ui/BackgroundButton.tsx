/**
 * BackgroundButton — upload/clear de imagem de fundo da cena ativa.
 * Mostra popover com tamanho, opacidade e remoção.
 */
import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { useMapStore } from '@/stores/useMapStore';
import { assetCache } from '../assetCache';

export function BackgroundButton() {
  const background = useMapStore((s) => s.background);
  const setBackground = useMapStore((s) => s.setBackground);
  const gridDpi = useMapStore((s) => s.gridConfig.dpi);
  const pushHistory = useMapStore((s) => s.pushHistory);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const handleFile = async (f: File) => {
    if (!f.type.startsWith('image/')) return;
    const assetId = await assetCache.put(f, f.type);
    const cached = assetCache.get(assetId);
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      if (!cached) return resolve({ w: gridDpi * 20, h: gridDpi * 20 });
      if (cached.ready) resolve({ w: cached.img.naturalWidth, h: cached.img.naturalHeight });
      else {
        cached.img.addEventListener('load', () =>
          resolve({ w: cached.img.naturalWidth, h: cached.img.naturalHeight }),
        );
        cached.img.addEventListener('error', () => resolve({ w: gridDpi * 20, h: gridDpi * 20 }));
      }
    });
    pushHistory();
    // Centro do background = origem do mundo; usa dimensões nativas (1px = 1unidade).
    setBackground({
      assetId,
      x: 0,
      y: 0,
      w: dims.w,
      h: dims.h,
      rotation: 0,
      opacity: 1,
    });
    setOpen(true);
  };

  return (
    <div className="relative">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.currentTarget.value = '';
        }}
      />
      <button
        type="button"
        title={background ? 'Editar fundo da cena' : 'Adicionar fundo à cena'}
        onClick={() => {
          if (background) setOpen((v) => !v);
          else fileRef.current?.click();
        }}
        className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[#2a2b30]"
        style={background ? { color: '#a3e3ff' } : undefined}
      >
        <ImageIcon className="h-4 w-4" />
      </button>

      {open && background && (
        <div
          ref={popRef}
          className="absolute right-0 top-9 z-50 w-64 rounded-lg p-3 text-xs space-y-3 shadow-xl"
          style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Fundo da cena</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">×</button>
          </div>

          <div>
            <div className="text-muted-foreground mb-1">Largura: {Math.round(background.w)}</div>
            <input
              type="range" min={100} max={8000} step={10}
              value={Math.min(background.w, 8000)}
              onChange={(e) => {
                const w = Number(e.target.value);
                const ratio = background.h / background.w;
                setBackground({ w, h: w * ratio });
              }}
              className="w-full"
            />
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Opacidade: {Math.round(background.opacity * 100)}%</div>
            <input
              type="range" min={0.1} max={1} step={0.05}
              value={background.opacity}
              onChange={(e) => setBackground({ opacity: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-muted-foreground">X</span>
              <input
                type="number"
                value={Math.round(background.x)}
                onChange={(e) => setBackground({ x: Number(e.target.value) })}
                className="w-full bg-secondary border border-border rounded px-2 py-1 text-foreground"
              />
            </label>
            <label className="block">
              <span className="text-muted-foreground">Y</span>
              <input
                type="number"
                value={Math.round(background.y)}
                onChange={(e) => setBackground({ y: Number(e.target.value) })}
                className="w-full bg-secondary border border-border rounded px-2 py-1 text-foreground"
              />
            </label>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 h-7 rounded border border-border hover:bg-secondary flex items-center justify-center gap-1 text-foreground/80"
            >
              <Upload className="h-3 w-3" /> Trocar
            </button>
            <button
              onClick={() => {
                pushHistory();
                const aid = background.assetId;
                setBackground(null);
                void assetCache.destroy(aid);
                setOpen(false);
              }}
              className="flex-1 h-7 rounded border border-border hover:bg-secondary flex items-center justify-center gap-1 text-red-300"
            >
              <Trash2 className="h-3 w-3" /> Remover
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
