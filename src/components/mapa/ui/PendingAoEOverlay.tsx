/**
 * PendingAoEOverlay — HUD exibido enquanto o usuário posiciona um AoE de
 * ataque no mapa (clique no preview do MapaModule). ESC ou botão direito cancela.
 * Permite ao usuário trocar a forma do AoE (círculo/quadrado/cone/linha) antes
 * de confirmar o posicionamento.
 */
import { useEffect } from 'react';
import { useMapStore } from '@/stores/useMapStore';
import type { TemplateKind } from '@/components/mapa/TemplateEngine';
import { Target, Circle, Square, Triangle, Minus } from 'lucide-react';

const SHAPES: Array<{ kind: TemplateKind; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { kind: 'circle', label: 'Círculo', Icon: Circle },
  { kind: 'square', label: 'Quadrado', Icon: Square },
  { kind: 'cone_attached', label: 'Cone', Icon: Triangle },
  { kind: 'line', label: 'Linha', Icon: Minus },
];

export function PendingAoEOverlay() {
  const pending = useMapStore((s) => s.pendingAoEPlacement);
  const resolve = useMapStore((s) => s.resolveAoEPlacement);
  

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        resolve(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, resolve]);

  if (!pending) return null;
  const isDirected = pending.kind === 'cone' || pending.kind === 'cone_attached' || pending.kind === 'line';
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-40 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-primary/60 bg-background/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur">
        <Target className="h-4 w-4 text-primary" />
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-foreground">
            Posicionar AoE — {pending.sourceLabel}
          </span>
          <span className="text-xs text-muted-foreground">
            {isDirected
              ? 'Clique no ponto de origem e arraste na direção desejada · ESC ou botão direito cancela'
              : 'Clique no mapa para centrar a área · ESC ou botão direito cancela'}
          </span>
        </div>
        {(() => {
          const current = SHAPES.find((s) => s.kind === pending.kind);
          if (!current) return null;
          const Icon = current.Icon;
          return (
            <div className="flex items-center gap-1 border-l border-border/60 pl-2 text-xs font-medium text-primary">
              <Icon className="h-3 w-3" />
              {current.label}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
