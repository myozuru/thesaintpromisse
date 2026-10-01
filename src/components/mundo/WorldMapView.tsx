/**
 * Mapa do Mundo: imagem enviada pelo Mestre com chefes como ícones.
 *
 * Suporta zoom (roda do mouse e botões), arrastar para navegar e marcação
 * rápida com o botão direito. Clicar num chefe abre a ficha no painel lateral.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, ImagePlus, Maximize2, MousePointerClick, Pipette, Skull, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useRoleStore } from '@/stores/useRoleStore';
import { useBossStore } from '@/stores/useBossStore';
import { canSeeField } from '@/lib/bosses';
import { BossGallery } from './BossGallery';
import { BossSheetContent } from './BossSheet';
import { BossPortrait } from './BossPortrait';

const MAX_SCALE = 6;

interface EyeDropperResult { sRGBHex: string }
interface EyeDropperInstance { open: () => Promise<EyeDropperResult> }
type EyeDropperConstructor = new () => EyeDropperInstance;

interface Ping { id: string; x: number; y: number }

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
  const {
    worldMap,
    worldBackgroundColor,
    worldMarkers,
    bosses,
    setWorldMap,
    setWorldBackgroundColor,
    addMarker,
    moveMarker,
    removeMarker,
  } = useBossStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [placing, setPlacing] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [pings, setPings] = useState<Ping[]>([]);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  /** A imagem ocupa 100% da largura da área no zoom 1; a altura segue a proporção. */
  const baseSize = useCallback(() => {
    const el = viewRef.current;
    const img = imgRef.current;
    if (!el || !img || !img.naturalWidth) return null;
    const r = el.getBoundingClientRect();
    const w = r.width;
    return { w, h: (w * img.naturalHeight) / img.naturalWidth, vw: r.width, vh: r.height };
  }, []);

  /** Zoom mínimo: mapa inteiro visível, sem sobrar espaço vazio. */
  const fitScale = useCallback(() => {
    const b = baseSize();
    if (!b) return 1;
    return Math.max(1, b.vh / b.h);
  }, [baseSize]);

  /** Limita apenas o zoom; o mapa pode ser arrastado livremente sobre o fundo. */
  const limitZoom = useCallback((v: { scale: number; x: number; y: number }) => {
    const b = baseSize();
    if (!b) return v;
    const min = Math.max(1, b.vh / b.h);
    const scale = Math.max(min, Math.min(MAX_SCALE, v.scale));
    return { ...v, scale };
  }, [baseSize]);
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const markers = useMemo(
    () => worldMarkers.filter((m) => bosses[m.bossId] && (isMaster || bosses[m.bossId].visivel)),
    [worldMarkers, bosses, isMaster],
  );
  const unplaced = Object.values(bosses).filter((b) => !worldMarkers.some((m) => m.bossId === b.id));

  /** Posição em % relativa à imagem já transformada. */
  const pos = (e: { clientX: number; clientY: number }) => {
    const r = layerRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
    };
  };

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const el = viewRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = cx ?? r.left + r.width / 2;
    const py = cy ?? r.top + r.height / 2;
    setView((v) => {
      const requestedScale = v.scale * factor;
      const nextScale = limitZoom({ ...v, scale: requestedScale }).scale;
      if (nextScale === v.scale) return v;
      const k = nextScale / v.scale;
      const ox = px - r.left;
      const oy = py - r.top;
      return { scale: nextScale, x: ox - (ox - v.x) * k, y: oy - (oy - v.y) * k };
    });
  }, [limitZoom]);

  // Zoom pela roda do mouse sem rolar a página.
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(Math.exp(-dy * 0.0018), e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, worldMap]);

  const addPing = (e: React.MouseEvent) => {
    e.preventDefault();
    const p = pos(e);
    const id = `${Date.now()}-${Math.random()}`;
    setPings((list) => [...list, { id, ...p }]);
    window.setTimeout(() => setPings((list) => list.filter((x) => x.id !== id)), 4000);
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

  const pickBackgroundFromScreen = async () => {
    const EyeDropperApi = (window as typeof window & { EyeDropper?: EyeDropperConstructor }).EyeDropper;
    if (!EyeDropperApi) {
      toast.error('O conta-gotas não está disponível neste navegador');
      return;
    }
    try {
      const result = await new EyeDropperApi().open();
      setWorldBackgroundColor(result.sRGBHex);
    } catch {
      // Fechar o conta-gotas sem escolher uma cor não altera o fundo.
    }
  };

  return (
    <div className="space-y-2 animate-fade-in">
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
          {worldMap && (
            <div className="flex h-8 items-center gap-1 rounded-md border border-border bg-card px-1.5">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs" title="Escolher cor do fundo">
                <input
                  type="color"
                  aria-label="Cor do fundo do mapa"
                  value={worldBackgroundColor}
                  onChange={(e) => setWorldBackgroundColor(e.target.value)}
                  className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                />
                Fundo
              </label>
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6" title="Pegar cor da tela" aria-label="Pegar cor da tela" onClick={pickBackgroundFromScreen}>
                <Pipette className="h-3.5 w-3.5" />
              </Button>
            </div>
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
        <div className="flex gap-3">
          {/* Área navegável */}
          <div
            ref={viewRef}
            className={`relative h-[80vh] min-w-0 flex-1 select-none overflow-hidden rounded-xl border border-border ${placing ? 'cursor-crosshair' : 'cursor-grab'}`}
            style={{ backgroundColor: worldBackgroundColor }}
            onContextMenu={addPing}
            onPointerDown={(e) => {
              if (placing || e.button !== 0) return;
              panRef.current = { x: e.clientX, y: e.clientY, ox: view.x, oy: view.y };
            }}
            onPointerMove={(e) => {
              const d = dragRef.current;
              if (d) {
                d.moved = true;
                const p = pos(e);
                moveMarker(d.id, p.x, p.y);
                return;
              }
              const pan = panRef.current;
              if (!pan) return;
              setView((v) => ({ ...v, x: pan.ox + (e.clientX - pan.x), y: pan.oy + (e.clientY - pan.y) }));
            }}
            onPointerUp={() => {
              panRef.current = null;
              setTimeout(() => (dragRef.current = null), 0);
            }}
            onPointerLeave={() => {
              panRef.current = null;
              dragRef.current = null;
            }}
            onClick={(e) => {
              if (!placing) return;
              const p = pos(e);
              addMarker(placing, p.x, p.y);
              setPlacing(null);
            }}
          >
            <div
              ref={layerRef}
              className="absolute left-0 top-0 origin-top-left"
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, width: '100%' }}
            >
              <img
                ref={imgRef}
                src={worldMap}
                alt="Mapa do mundo"
                className="block w-full"
                draggable={false}
                onLoad={() => setView((v) => limitZoom({ ...v, scale: fitScale(), x: 0, y: 0 }))}
              />

              {/* Marcações do botão direito */}
              <AnimatePresence>
                {pings.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.6, opacity: 0 }}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  >
                    <span className="block h-6 w-6 animate-ping rounded-full border-2 border-accent" />
                    <span className="absolute inset-0 m-auto block h-2 w-2 rounded-full bg-accent" />
                  </motion.div>
                ))}
              </AnimatePresence>

              {markers.map((m) => {
                const b = bosses[m.bossId];
                const showFace = b.retrato && canSeeField(b, 'retrato', isMaster);
                return (
                  <div
                    key={m.id}
                    className="group absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${m.x}%`, top: `${m.y}%`, transform: `translate(-50%, -50%) scale(${1 / view.scale})` }}
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
                      className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 bg-card shadow-lg transition-transform hover:scale-110 ${openId === b.id ? 'border-primary ring-2 ring-primary/50' : 'border-accent'} ${isMaster ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${!b.visivel ? 'opacity-60' : ''}`}
                    >
                      {showFace ? (
                        <BossPortrait boss={b} draggable={false} />
                      ) : (
                        <Skull className="h-5 w-5 text-accent" />
                      )}
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

            {/* Controles de zoom */}
            <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-lg border border-border bg-card/90 p-1 backdrop-blur">
              <button type="button" title="Aproximar" onClick={() => zoomAt(1.25)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <ZoomIn className="h-4 w-4" />
              </button>
              <button type="button" title="Afastar" onClick={() => zoomAt(1 / 1.25)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <ZoomOut className="h-4 w-4" />
              </button>
              <button type="button" title="Enquadrar" onClick={() => setView(limitZoom({ scale: fitScale(), x: 0, y: 0 }))} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>

            <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1 rounded-md bg-background/75 px-2 py-1 text-[10px] text-muted-foreground">
              <MousePointerClick className="h-3 w-3" /> Arraste livremente · roda para zoom · botão direito marca o local
            </div>
          </div>

          {/* Painel lateral da ficha */}
          <AnimatePresence initial={false}>
            {openId && (
              <motion.aside
                key="boss-panel"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 380, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                className="h-[80vh] shrink-0 overflow-hidden rounded-xl border border-border bg-card/95 backdrop-blur-xl"
              >
                <div className="h-full w-[380px]">
                  <BossSheetContent bossId={openId} isMaster={isMaster} onClose={() => setOpenId(null)} inline />
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {isMaster ? 'Envie uma imagem do mapa do mundo para começar a posicionar os chefes.' : 'O Mestre ainda não revelou o mapa do mundo.'}
        </div>
      )}

      <div>
        <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => setShowGallery((v) => !v)}>
          <Skull className="mr-1 h-3.5 w-3.5" /> Chefes
          {showGallery ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />}
        </Button>
      </div>
      {(showGallery || !worldMap) && <BossGallery />}

    </div>
  );
}
