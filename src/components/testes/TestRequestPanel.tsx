import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { GripHorizontal, PanelLeft, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TestesModule } from './TestesModule';
import { cn } from '@/lib/utils';

interface TestRequestPanelProps { open: boolean; onClose: () => void; }
type PanelMode = 'floating' | 'docked';
type Point = { x: number; y: number };
const PANEL_WIDTH = 420;

function clampPosition(point: Point): Point {
  if (typeof window === 'undefined') return point;
  return { x: Math.max(12, Math.min(point.x, window.innerWidth - PANEL_WIDTH - 12)), y: Math.max(68, Math.min(point.y, window.innerHeight - 120)) };
}

export function TestRequestPanel({ open, onClose }: TestRequestPanelProps) {
  const [mode, setMode] = useState<PanelMode>('floating');
  const [position, setPosition] = useState<Point>({ x: 300, y: 84 });
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const onResize = () => setPosition((current) => clampPosition(current));
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      setPosition(clampPosition({ x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY }));
    };
    const onEnd = (event: PointerEvent) => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null; };
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, []);

  if (!open) return null;
  const docked = mode === 'docked';
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (docked || event.button !== 0) return;
    const panel = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!panel) return;
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - panel.left, offsetY: event.clientY - panel.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return (
    <section aria-label="Pedidos de teste" className={cn('fixed z-[170] flex max-h-[calc(100dvh-4.25rem)] flex-col overflow-hidden border border-primary/40 bg-card/95 shadow-2xl backdrop-blur-xl', docked ? 'left-3 top-[4.25rem] w-[min(360px,calc(100vw-1.5rem))] rounded-md' : 'w-[min(420px,calc(100vw-1.5rem))] rounded-lg')} style={docked ? undefined : { left: position.x, top: position.y }}>
      <div className={cn('flex h-11 shrink-0 items-center gap-2 border-b border-border/70 px-2', docked ? 'cursor-default' : 'cursor-grab select-none active:cursor-grabbing')} onPointerDown={startDrag}>
        <GripHorizontal className={cn('h-4 w-4 text-muted-foreground', docked && 'opacity-35')} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground" style={{ fontFamily: "'Cinzel', serif" }}>Pedidos de teste</h2>
          <p className="truncate text-[10px] text-muted-foreground">Solicite rolagens sem sair do mapa</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" title={docked ? 'Usar como janela flutuante' : 'Fixar abaixo do relógio'} aria-label={docked ? 'Usar como janela flutuante' : 'Fixar abaixo do relógio'} onPointerDown={(event) => event.stopPropagation()} onClick={() => setMode(docked ? 'floating' : 'docked')}>
          {docked ? <Square className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" title="Fechar pedidos de teste" aria-label="Fechar pedidos de teste" onPointerDown={(event) => event.stopPropagation()} onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><TestesModule compact /></div>
    </section>
  );
}