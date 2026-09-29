import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { StatValue, type StatModifierOrigin } from './StatValue';

interface Props {
  label: string;
  current: number;
  max: number;
  color: string;
  icon?: string;
  /** Valor base de `max` antes de qualquer modificador (Buff/Debuff). */
  baseMax?: number;
  /** Origens dos modificadores que alteram `max`. */
  maxOrigens?: StatModifierOrigin[];
}

export function StatusBar({ label, current, max, color, icon, baseMax, maxOrigens }: Props) {
  const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0;
  const safeMax = Number.isFinite(max) ? Math.max(0, max) : 0;
  const pct = safeMax > 0 ? Math.max(0, Math.min(100, (safeCurrent / safeMax) * 100)) : 0;
  const [displayPct, setDisplayPct] = useState(pct);
  const [displayCurrent, setDisplayCurrent] = useState(safeCurrent);
  const prevRef = useRef({ pct, current: safeCurrent });

  useEffect(() => {
    const startPct = prevRef.current.pct;
    const startCurrent = prevRef.current.current;
    const diffPct = pct - startPct;
    const diffCurrent = safeCurrent - startCurrent;
    const duration = 500;
    const startTime = performance.now();
    let raf: number;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPct(startPct + diffPct * eased);
      setDisplayCurrent(Math.round(startCurrent + diffCurrent * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        prevRef.current = { pct, current: safeCurrent };
      }
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [safeCurrent, pct]);

  const effectiveBase = Number.isFinite(baseMax) ? Math.max(0, baseMax ?? 0) : safeMax;

  return (
    <div className="flex items-center gap-2 text-sm">
      {icon && <span className="text-muted-foreground text-sm">{icon}</span>}
      <span className="w-8 text-right font-semibold text-muted-foreground text-sm" style={{ fontFamily: "'Cinzel', serif" }}>{label}</span>
      <div className="relative flex-1 h-3.5 rounded-full bg-secondary/80 overflow-hidden">
        <div
          className={cn('h-full rounded-full', color)}
          style={{
            width: `${displayPct}%`,
            boxShadow: displayPct > 0 ? `0 0 8px hsl(var(--${label === 'HP' ? 'hp' : label === 'PE' ? 'pe' : 'shield'}) / 0.5)` : 'none'
          }}
        />
      </div>
      <span className="w-16 shrink-0 overflow-hidden text-right font-mono text-foreground font-bold text-sm tabular-nums">
        {displayCurrent}/
        <StatValue valorBase={effectiveBase} valorAtual={safeMax} origens={maxOrigens}>
          {safeMax}
        </StatValue>
      </span>
    </div>
  );
}
