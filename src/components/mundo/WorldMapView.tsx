/** Mapa do Mundo: imagem enviada pelo Mestre com chefes como ícones. */
import { useMemo, useRef, useState } from 'react';
import { ImagePlus, Skull, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useRoleStore } from '@/stores/useRoleStore';
import { useBossStore } from '@/stores/useBossStore';
import { BossGallery } from './BossGallery';
import { BossSheet } from './BossSheet';

/** Reduz a imagem para caber no armazenamento local. */
function compressImage(file: File, max = 2048): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function WorldMapView() {
  const isMaster = useRoleStore((s) => s.role) === 'MASTER';
  const { worldMap, worldMarkers, bosses, setWorldMap, addMarker, moveMarker, removeMarker } = useBossStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [placing, setPlacing] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);

  const markers = useMemo(
    () => worldMarkers.filter((m) => bosses[m.bossId] && (isMaster || bosses[m.bossId].visivel)),
    [worldMarkers, bosses, isMaster],
  );
  const unplaced = Object.values(bosses).filter((b) => !worldMarkers.some((m) => m.bossId === b.id));

  const pos = (e: { clientX: number; clientY: number }) => {
    const r = areaRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
    };
  };

  const onUpload = async (f?: File) => {
    if (!f) return;
    try {
      setWorldMap(await compressImage(f));
      toast.success('Mapa do mundo atualizado');
    } catch {
      toast.error('Não foi possível carregar essa imagem');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {isMaster && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />
          <Button size="sm" className="h-8 text-xs" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="mr-1 h-3.5 w-3.5" /> {worldMap ? 'Trocar mapa' : 'Enviar mapa do mundo'}
          </Button>
          {worldMap && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setWorldMap(null)}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Remover mapa
            </Button>
          )}
          {worldMap && unplaced.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              Colocar no mapa:
              {unplaced.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setPlacing(placing === b.id ? null : b.id)}
                  className={`rounded-full border px-2 py-0.5 ${placing === b.id ? 'border-primary bg-primary/20 text-foreground' : 'border-border hover:bg-muted'}`}
                >
                  {b.nome}
                </button>
              ))}
            </div>
          )}
          {placing && <span className="text-xs text-accent">Clique no mapa para posicionar o chefe.</span>}
        </div>
      )}

      {worldMap ? (
        <div
          ref={areaRef}
          className={`relative w-full select-none overflow-hidden rounded-xl border border-border ${placing ? 'cursor-crosshair' : ''}`}
          onClick={(e) => {
            if (!placing) return;
            const p = pos(e);
            addMarker(placing, p.x, p.y);
            setPlacing(null);
          }}
          onPointerMove={(e) => {
            const d = dragRef.current;
            if (!d) return;
            d.moved = true;
            const p = pos(e);
            moveMarker(d.id, p.x, p.y);
          }}
          onPointerUp={() => setTimeout(() => (dragRef.current = null), 0)}
          onPointerLeave={() => (dragRef.current = null)}
        >
          <img src={worldMap} alt="Mapa do mundo" className="block w-full" draggable={false} />
          {markers.map((m) => {
            const b = bosses[m.bossId];
            return (
              <div
                key={m.id}
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
              >
                <button
                  type="button"
                  title={b.nome}
                  onPointerDown={(e) => {
                    if (!isMaster) return;
                    e.stopPropagation();
                    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                    dragRef.current = { id: m.id, moved: false };
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (dragRef.current?.moved) return;
                    setOpenId(b.id);
                  }}
                  className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-accent bg-card shadow-lg transition-transform hover:scale-110 ${isMaster ? 'cursor-grab active:cursor-grabbing' : ''} ${!b.visivel ? 'opacity-60' : ''}`}
                >
                  {b.retrato ? <img src={b.retrato} alt="" className="h-full w-full object-cover" draggable={false} /> : <Skull className="h-5 w-5 text-accent" />}
                </button>
                <div className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold">
                  {b.nome}
                </div>
                {isMaster && (
                  <button
                    type="button"
                    title="Tirar do mapa"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMarker(m.id);
                    }}
                    className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {isMaster ? 'Envie uma imagem do mapa do mundo para começar a posicionar os chefes.' : 'O Mestre ainda não revelou o mapa do mundo.'}
        </div>
      )}

      <BossGallery />
      <BossSheet bossId={openId} isMaster={isMaster} onClose={() => setOpenId(null)} />
    </div>
  );
}
