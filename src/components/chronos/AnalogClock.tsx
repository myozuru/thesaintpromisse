import { useEffect, useRef } from 'react';
import { stepChronosDisplay } from '@/stores/useChronosDisplayStore';

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

    const draw = () => {
      const total = stepChronosDisplay(performance.now());
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
