import { useChronosStore } from './useChronosStore';

// Tempo "visual" suavizado em segundos do dia (0..86400), compartilhado por
// TODOS os relógios (mini do topo e o grande do Chronos). Um único integrador
// evita que cada instância acumule seu próprio tempo e se dessincronize.
export const chronosDisplayRef = { current: 0 };

let displaySec = 0;
let smoothMult = 0;
let lastFrame = 0;
let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;
  const s0 = useChronosStore.getState();
  displaySec = s0.hours * 3600 + s0.minutes * 60 + s0.seconds;
  smoothMult = s0.isRunning ? s0.multiplier : 0;
  lastFrame = performance.now();
  chronosDisplayRef.current = displaySec;

  useChronosStore.subscribe((s, prev) => {
    if (s.lastMutationSource !== 'manual') return;
    const storeSec = s.hours * 3600 + s.minutes * 60 + s.seconds;
    if (s.day !== prev.day || s.month !== prev.month || s.year !== prev.year) {
      displaySec = storeSec;
      return;
    }
    const prevSec = prev.hours * 3600 + prev.minutes * 60 + prev.seconds;
    if (storeSec === prevSec) return;
    const visual = ((displaySec % 86400) + 86400) % 86400;
    let diff = storeSec - visual;
    if (diff > 43200) diff -= 86400;
    if (diff < -43200) diff += 86400;
    if (diff < -1 || diff > 30) displaySec = storeSec;
  });
}

/** Avança o tempo visual compartilhado (idempotente por frame) e retorna segundos do dia. */
export function stepChronosDisplay(now: number): number {
  init();
  if (now <= lastFrame) return chronosDisplayRef.current;
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  const st = useChronosStore.getState();
  const target = st.isRunning ? st.multiplier : 0;
  const easeMs = target > smoothMult ? st.easeStartMs : st.easeStopMs;
  const alpha = easeMs <= 0 ? 1 : 1 - Math.exp(-dt / Math.max(0.001, easeMs / 1000));
  smoothMult += (target - smoothMult) * alpha;
  if (Math.abs(target - smoothMult) < 0.001) smoothMult = target;
  displaySec += smoothMult * dt;
  chronosDisplayRef.current = ((displaySec % 86400) + 86400) % 86400;
  return chronosDisplayRef.current;
}
