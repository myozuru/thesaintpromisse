import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Dices, GripHorizontal, PanelLeft, Square, X } from 'lucide-react';
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

  useEffect(() => {
    if (open && mode === 'floating') setPosition((current) => clampPosition(current));
  }, [open, mode]);

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
    <section aria-label="Pedidos de teste" className={cn('fixed z-[170] flex max-h-[calc(100dvh-4.25rem)] flex-col overflow-hidden border border-border/90 bg-card/95 shadow-[0_24px_70px_-20px_hsl(var(--background))] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-12 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-accent/80 before:to-transparent', docked ? 'left-3 top-[4.25rem] w-[min(380px,calc(100vw-1.5rem))] rounded-md' : 'h-[min(720px,calc(100dvh-6rem))] min-h-64 min-w-72 w-[min(440px,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] resize rounded-lg')} style={docked ? undefined : { left: position.x, top: position.y }}>
      <div className={cn('relative flex min-h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-secondary/35 px-3', docked ? 'cursor-default' : 'cursor-grab select-none active:cursor-grabbing')} onPointerDown={startDrag}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-accent/25 bg-accent/10 text-accent">
          {docked ? <Dices className="h-4 w-4" /> : <GripHorizontal className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-sm font-bold uppercase text-accent">Invocar destino</h2>
          <p className="truncate text-xs text-muted-foreground">Forje um desafio para seus jogadores</p>
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