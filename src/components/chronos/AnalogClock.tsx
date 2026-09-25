import { useEffect, useRef } from 'react';
import { useChronosStore } from '@/stores/useChronosStore';
import { chronosDisplayRef } from '@/stores/useChronosDisplayStore';

const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

export function AnalogClock({ size: canvasSize = 280 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize}px`;
    ctx.scale(dpr, dpr);

    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = canvasSize * dpr;
    faceCanvas.height = canvasSize * dpr;
    const faceCtx = faceCanvas.getContext('2d');
    if (!faceCtx) return;
    faceCtx.scale(dpr, dpr);
    drawClockFace(faceCtx, canvasSize);

    const initialState = useChronosStore.getState();
    let displaySec = initialState.hours * 3600 + initialState.minutes * 60 + initialState.seconds;
    let smoothMult = initialState.isRunning ? initialState.multiplier : 0;
    let lastFrameTime = performance.now();

    const unsub = useChronosStore.subscribe((s, prev) => {
      // Só re-sincroniza em casos genuinamente manuais que NÃO podem ser
      // alcançados pelo avanço natural do display:
      //  1) mudança de data (dia/mês/ano)
      //  2) edição manual que move o relógio para TRÁS (tick negativo / setTime)
      // Qualquer mudança vinda do ticker OU de sync remoto é ignorada — o
      // display é a fonte visual da verdade entre snaps. Sync remoto envia
      // o store de outro cliente (que está atrasado em relação ao nosso
      // display suavizado) e causaria saltos para trás dos ponteiros.
      if (s.lastMutationSource !== 'manual') return;

      const dateChanged =
        s.day !== prev.day || s.month !== prev.month || s.year !== prev.year;
      const storeSec = s.hours * 3600 + s.minutes * 60 + s.seconds;
      const prevStoreSec = prev.hours * 3600 + prev.minutes * 60 + prev.seconds;
      const visualSec = ((displaySec % 86400) + 86400) % 86400;

      if (dateChanged) {
        displaySec = storeSec;
        return;
      }

      // Edição manual real: store mudou de valor por setTime/tick manual.
      // Só puxamos o display se o store foi explicitamente movido para trás
      // (usuário recuou o tempo) ou para muito à frente (>30s, salto manual).
      const storeJumped = storeSec !== prevStoreSec;
      if (!storeJumped) return;

      let diff = storeSec - visualSec;
      if (diff > 43200) diff -= 86400;
      if (diff < -43200) diff += 86400;

      // Só snap em retrocessos manuais ou saltos grandes para frente.
      if (diff < -1 || diff > 30) {
        displaySec = storeSec;
      }
    });

    const draw = () => {
      const now = performance.now();
      const frameDt = Math.min((now - lastFrameTime) / 1000, 0.1);
      lastFrameTime = now;

      const state = useChronosStore.getState();
      const targetMult = state.isRunning ? state.multiplier : 0;
      // Tau dinâmico (em segundos) baseado nos ms configurados pelo usuário.
      // Usa start quando acelerando, stop quando desacelerando.
      const isStarting = targetMult > smoothMult;
      const easeMs = isStarting ? state.easeStartMs : state.easeStopMs;
      const tau = Math.max(0.001, easeMs / 1000);
      const alpha = easeMs <= 0 ? 1 : 1 - Math.exp(-frameDt / tau);
      smoothMult += (targetMult - smoothMult) * alpha;
      if (Math.abs(targetMult - smoothMult) < 0.001) smoothMult = targetMult;

      displaySec += smoothMult * frameDt;

      const total = ((displaySec % 86400) + 86400) % 86400;
      chronosDisplayRef.current = total;
      const hoursContinuous = total / 3600;       // 0..24, contínuo
      const minutesContinuous = (total % 3600) / 60; // 0..60, contínuo (já inclui segundos)
      const seconds = total % 60;
      const size = canvasSize;
      const center = size / 2;
      const radius = Math.max(0, center - 10);

      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(faceCanvas, 0, 0, size, size);

      // Smooth continuous angles — sem double-counting de segundos
      const secAngle = ((seconds / 60) * 360 - 90) * (Math.PI / 180);
      const minAngle = ((minutesContinuous / 60) * 360 - 90) * (Math.PI / 180);
      const hrAngle = (((hoursContinuous % 12) / 12) * 360 - 90) * (Math.PI / 180);

      // Hour hand
      drawHand(ctx, center, hrAngle, radius * 0.5, 4.5, '#d4c8e8');
      // Minute hand
      drawHand(ctx, center, minAngle, radius * 0.68, 3, '#b8a8d4');
      // Second hand with neon glow
      ctx.shadowColor = 'hsl(270, 100%, 62%)';
      ctx.shadowBlur = 12;
      drawHand(ctx, center, secAngle, radius * 0.75, 1.5, 'hsl(270, 100%, 62%)');
      ctx.shadowBlur = 0;

      // Center dot
      ctx.beginPath();
      ctx.arc(center, center, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'hsl(270, 100%, 62%)';
      ctx.shadowColor = 'hsl(270, 100%, 62%)';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      unsub();
    };
  }, [canvasSize]);

  return <canvas ref={canvasRef} style={{ width: canvasSize, height: canvasSize }} className="mx-auto" />;
}

function drawClockFace(ctx: CanvasRenderingContext2D, size: number) {
  const center = size / 2;
  const radius = Math.max(0, center - 10);

  const glowGrad = ctx.createRadialGradient(center, center, Math.max(0, radius - 5), center, center, radius + 8);
  glowGrad.addColorStop(0, 'hsla(270, 100%, 62%, 0.08)');
  glowGrad.addColorStop(0.5, 'hsla(270, 100%, 62%, 0.04)');
  glowGrad.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(center, center, radius + 8, 0, Math.PI * 2);
  ctx.fillStyle = glowGrad;
  ctx.fill();

  const faceGrad = ctx.createRadialGradient(center, center, 0, center, center, radius);
  faceGrad.addColorStop(0, '#1a1622');
  faceGrad.addColorStop(0.9, '#120e1a');
  faceGrad.addColorStop(1, '#0d0a14');
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = faceGrad;
  ctx.fill();
  ctx.strokeStyle = 'hsla(270, 100%, 62%, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(center, center, radius * 0.93, 0, Math.PI * 2);
  ctx.strokeStyle = 'hsla(270, 50%, 40%, 0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#d4c8e8';
  ctx.font = `700 ${radius * 0.16}px "Cinzel Decorative", "Cinzel", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6 - Math.PI / 2;
    const x = center + Math.cos(angle) * radius * 0.76;
    const y = center + Math.sin(angle) * radius * 0.76;
    ctx.fillText(ROMAN[i], x, y);
  }

  for (let i = 0; i < 60; i++) {
    const angle = (i * Math.PI) / 30 - Math.PI / 2;
    const outer = radius * 0.92;
    const inner = i % 5 === 0 ? radius * 0.85 : radius * 0.89;
    ctx.beginPath();
    ctx.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
    ctx.lineTo(center + Math.cos(angle) * outer, center + Math.sin(angle) * outer);
    ctx.strokeStyle = i % 5 === 0 ? 'hsla(270, 100%, 62%, 0.7)' : 'hsla(270, 40%, 50%, 0.3)';
    ctx.lineWidth = i % 5 === 0 ? 2 : 1;
    ctx.stroke();
  }
}

function drawHand(ctx: CanvasRenderingContext2D, center: number, angle: number, length: number, width: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(center, center);
  ctx.lineTo(center + Math.cos(angle) * length, center + Math.sin(angle) * length);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}
