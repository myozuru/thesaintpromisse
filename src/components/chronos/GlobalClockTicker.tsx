import { useEffect, useRef } from 'react';
import { useChronosStore } from '@/stores/useChronosStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { emitirEvento } from '@/lib/omni/eventBus';
import { toTimelineSeconds } from '@/lib/omni/tempo';

export function GlobalClockTicker() {
  const isRunning = useChronosStore((s) => s.isRunning);
  const multiplier = useChronosStore((s) => s.multiplier);
  const tick = useChronosStore((s) => s.tick);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastWallTimeRef = useRef<number>(0);
  const tickAccumRef = useRef<number>(0);
  const pruneAccumRef = useRef<number>(0);
  const lastTimelineMinuteRef = useRef<number>(-1);

  useEffect(() => {
    lastTimeRef.current = performance.now();
    lastWallTimeRef.current = Date.now();

    const frame = (now: number) => {
      const wallNow = Date.now();
      const perfDt = Math.max(0, (now - lastTimeRef.current) / 1000);
      const wallDt = Math.max(0, (wallNow - lastWallTimeRef.current) / 1000);
      const dt = Math.max(perfDt, wallDt);
      lastTimeRef.current = now;
      lastWallTimeRef.current = wallNow;

      if (isRunning) {
        tickAccumRef.current += dt;
        if (tickAccumRef.current >= 0.25) {
          tick(tickAccumRef.current * multiplier, 'ticker');
          tickAccumRef.current = 0;
        }
      } else if (tickAccumRef.current !== 0) {
        tickAccumRef.current = 0;
      }

      // Poda efeitos expirados ~2x por segundo
      pruneAccumRef.current += dt;
      if (pruneAccumRef.current >= 0.5) {
        pruneAccumRef.current = 0;
        useOmniRuntimeStore.getState().podarExpirados();

        // Omni-Engine: emite PASSAGEM_TEMPO uma vez por minuto in-game.
        const totalSec = toTimelineSeconds(useChronosStore.getState());
        const minute = Math.floor(totalSec / 60);
        if (lastTimelineMinuteRef.current === -1) {
          lastTimelineMinuteRef.current = minute;
        } else if (minute !== lastTimelineMinuteRef.current) {
          lastTimelineMinuteRef.current = minute;
          emitirEvento('aoAvancarRelogio', { incluirPassivas: true });
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isRunning, multiplier, tick]);

  return null;
}
