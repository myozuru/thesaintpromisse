/**
 * Global3DDiceOverlay — janela flutuante da bandeja 3D para rolagens comuns.
 * Quando a rolagem tem layout 'test-request', ela NÃO aparece aqui: a bandeja
 * (DiceTrayPanel) é embutida no rodapé da janela do pedido de teste
 * (TestRequestOverlay), evitando dois canvases WebGL.
 */
import { Suspense, useRef } from 'react';
import { X, Sparkles, Zap } from 'lucide-react';
import { useDice3DStore } from '@/stores/useDice3DStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { Slider } from '@/components/ui/slider';
import { DiceTrayPanel, type DiceTrayPanelHandle } from './DiceTrayPanel';
import { cn } from '@/lib/utils';

export function Global3DDiceOverlay() {
  const enabled = useDice3DStore((s) => s.enabled);
  const visible = useDice3DStore((s) => s.visible);
  const setVisible = useDice3DStore((s) => s.setVisible);
  const current = useDice3DStore((s) => s.current);
  const clearRolls = useDice3DStore((s) => s.clear);
  const bounciness = useDice3DStore((s) => s.bounciness);
  const setBounciness = useDice3DStore((s) => s.setBounciness);
  const isMaster = useRoleStore((s) => s.role === 'MASTER');

  const panelRef = useRef<DiceTrayPanelHandle>(null);

  const closeTray = () => {
    panelRef.current?.close();
    clearRolls();
  };

  // Pedido de teste: a bandeja vive dentro da janela do pedido, não aqui.
  if (!enabled || !visible || current?.layout === 'test-request') return null;

  return (
    <div
      className={cn('fixed z-[9999] overflow-hidden pointer-events-auto bottom-4 right-4 w-[min(440px,calc(100vw-2rem))] rounded-xl border border-primary/30')}
      style={{
        background:
          'linear-gradient(135deg, hsl(265 30% 7% / 0.96) 0%, hsl(270 35% 5% / 0.96) 100%)',
        boxShadow:
          '0 20px 60px -15px hsl(265 80% 4% / 0.85), 0 0 32px hsl(268 85% 62% / 0.25), inset 0 1px 0 hsl(268 60% 30% / 0.25)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Ornamento superior dourado */}
      <div
        className="h-px w-full"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, hsl(42 78% 58% / 0.6) 50%, transparent 100%)',
        }}
      />
      <div className="h-10 px-3 flex items-center gap-2 border-b border-primary/20">
        <Sparkles className="h-4 w-4 text-accent" style={{ filter: 'drop-shadow(0 0 6px hsl(42 78% 58% / 0.6))' }} />
        <div
          className="text-xs uppercase tracking-[0.18em] text-foreground/90 truncate"
          style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.18em' }}
        >
          {current?.label ?? 'Auspício dos Dados'}
        </div>
        <button
          onClick={() => { closeTray(); setVisible(false); }}
          title={current ? 'Cancelar rolagem e fechar' : 'Fechar'}
          aria-label={current ? 'Cancelar rolagem e fechar' : 'Fechar bandeja'}
          className="ml-auto h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-accent hover:bg-primary/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {isMaster && (
        <div className="px-3 py-2 flex items-center gap-2 border-b border-primary/20">
          <Zap className="h-3.5 w-3.5 text-accent shrink-0" />
          <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground shrink-0" style={{ fontFamily: "'Cinzel', serif" }}>
            Quique
          </span>
          <Slider
            min={0}
            max={2}
            step={0.05}
            value={[bounciness]}
            onValueChange={(v) => setBounciness(v[0] ?? 1)}
            className="flex-1"
          />
          <span className="text-xs tabular-nums text-accent w-10 text-right font-semibold">
            {bounciness.toFixed(2)}x
          </span>
        </div>
      )}

      <div className="relative h-[340px]">
        <Suspense fallback={null}>
          <DiceTrayPanel handleRef={panelRef} />
        </Suspense>
      </div>

      <div
        className="px-3 py-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground/70 border-t border-primary/15 text-center italic"
        style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: '0.15em' }}
      >
        ✦ Destino lançado nos dados ✦
      </div>
    </div>
  );
}
