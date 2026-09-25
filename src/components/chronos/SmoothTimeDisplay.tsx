import { useEffect, useRef } from 'react';
import { chronosDisplayRef } from '@/stores/useChronosDisplayStore';
import { useChronosStore } from '@/stores/useChronosStore';

const fmt = (n: number) => String(Math.floor(n)).padStart(2, '0');

/**
 * Display digital HH:MM:SS que lê do tempo visual suavizado (escrito pelo
 * AnalogClock a cada frame) em vez de ler direto do store. Isso evita os
 * "saltos" do display quando o multiplier é alto e o ticker do store
 * acumula em batches de 250ms.
 */
export function SmoothTimeDisplay({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastText = useRef<string>('');

  useEffect(() => {
    let raf = 0;
    let lastTotal = -1;
    const loop = () => {
      let total = chronosDisplayRef.current;
      // Fallback caso o AnalogClock ainda não tenha rodado.
      if (total === 0 && lastText.current === '') {
        const st = useChronosStore.getState();
        total = st.hours * 3600 + st.minutes * 60 + st.seconds;
      }
      // Proteção monotônica: nunca exibe um valor menor que o último,
      // exceto em viradas de dia (queda > 60s = wrap legítimo).
      if (lastTotal >= 0) {
        const delta = total - lastTotal;
        if (delta < 0 && delta > -60) {
          total = lastTotal;
        }
      }
      lastTotal = total;
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = Math.floor(total % 60);
      const text = `${fmt(h)}:${fmt(m)}:${fmt(s)}`;
      if (text !== lastText.current && ref.current) {
        ref.current.textContent = text;
        lastText.current = text;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <div ref={ref} className={className} style={style} />;
}
