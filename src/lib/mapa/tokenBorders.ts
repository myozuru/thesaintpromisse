/**
 * Estilos de moldura para tokens circulares de personagem.
 * Compartilhado entre o desenho no mapa (EntityEngine) e a prévia
 * do editor de enquadramento (TokenCropDialog).
 */

export type TokenBorderStyle = 'arcana' | 'ouro' | 'gelo' | 'chamas' | 'natureza' | 'sombra';

export interface TokenBorderDef {
  id: TokenBorderStyle;
  label: string;
  /** Cor principal da moldura (anel luminoso). */
  main: string;
  /** Cor do brilho externo. */
  glow: string;
  /** Cor do filete interno. */
  inner: string;
  /** Cor da base escura que separa a imagem da moldura. */
  base: string;
  /** Decoração extra desenhada sobre o anel. */
  decor?: 'gems' | 'dashes' | 'flames' | 'leaves' | 'spikes';
  decorColor?: string;
}

export const TOKEN_BORDERS: TokenBorderDef[] = [
  {
    id: 'arcana',
    label: 'Arcana',
    main: 'hsl(265 70% 67%)',
    glow: 'hsl(265 70% 67%)',
    inner: 'hsla(0 0% 100% / 0.45)',
    base: 'hsl(260 28% 9%)',
  },
  {
    id: 'ouro',
    label: 'Dourada',
    main: 'hsl(43 85% 58%)',
    glow: 'hsl(43 90% 55%)',
    inner: 'hsl(48 100% 85% / 0.7)',
    base: 'hsl(35 40% 10%)',
    decor: 'gems',
    decorColor: 'hsl(48 100% 88%)',
  },
  {
    id: 'gelo',
    label: 'Gelo',
    main: 'hsl(195 90% 65%)',
    glow: 'hsl(195 95% 70%)',
    inner: 'hsla(0 0% 100% / 0.75)',
    base: 'hsl(210 45% 10%)',
    decor: 'dashes',
    decorColor: 'hsla(0 0% 100% / 0.85)',
  },
  {
    id: 'chamas',
    label: 'Chamas',
    main: 'hsl(18 95% 55%)',
    glow: 'hsl(32 100% 55%)',
    inner: 'hsl(45 100% 70% / 0.8)',
    base: 'hsl(10 50% 8%)',
    decor: 'flames',
    decorColor: 'hsl(40 100% 62%)',
  },
  {
    id: 'natureza',
    label: 'Natureza',
    main: 'hsl(130 55% 45%)',
    glow: 'hsl(130 60% 50%)',
    inner: 'hsl(90 70% 70% / 0.6)',
    base: 'hsl(140 35% 8%)',
    decor: 'leaves',
    decorColor: 'hsl(95 65% 60%)',
  },
  {
    id: 'sombra',
    label: 'Sombria',
    main: 'hsl(280 45% 35%)',
    glow: 'hsl(0 70% 45%)',
    inner: 'hsl(0 80% 55% / 0.6)',
    base: 'hsl(270 30% 5%)',
    decor: 'spikes',
    decorColor: 'hsl(0 75% 50%)',
  },
];

export const DEFAULT_TOKEN_BORDER: TokenBorderStyle = 'arcana';

export function getTokenBorder(style?: string | null): TokenBorderDef {
  return TOKEN_BORDERS.find((b) => b.id === style) ?? TOKEN_BORDERS[0];
}

/**
 * Desenha a moldura de um token circular centrado na origem do ctx.
 * `hw`/`hh` são os semi-eixos da elipse do token; `scale` é o zoom do mapa
 * (usado para manter espessuras mínimas legíveis).
 */
export function drawTokenBorder(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
  style: TokenBorderStyle | undefined,
  scale: number,
): void {
  const def = getTokenBorder(style);
  const outerWidth = Math.max(2 / scale, Math.min(hw, hh) * 0.11);
  const rx = (k: number) => Math.max(1, hw - outerWidth * k);
  const ry = (k: number) => Math.max(1, hh - outerWidth * k);
  const ring = (k: number, color: string, width: number, glow = 0, glowColor?: string) => {
    ctx.beginPath();
    ctx.ellipse(0, 0, rx(k), ry(k), 0, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowBlur = glow;
    if (glowColor) ctx.shadowColor = glowColor;
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  ctx.save();
  // Base escura que separa a imagem da moldura.
  ring(0.5, def.base, outerWidth);
  // Anel principal luminoso.
  ring(1.05, def.main, Math.max(1.5 / scale, outerWidth * 0.42), Math.max(3 / scale, outerWidth * 0.8), def.glow);
  // Filete interno claro.
  ring(1.55, def.inner, Math.max(0.75 / scale, outerWidth * 0.16));

  // Decorações por estilo.
  const cx = 0;
  const cy = 0;
  const midRx = rx(1.05);
  const midRy = ry(1.05);
  const dot = (angle: number, r: number, color: string) => {
    const x = cx + Math.cos(angle) * midRx;
    const y = cy + Math.sin(angle) * midRy;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = def.glow;
    ctx.shadowBlur = r * 1.5;
    ctx.fill();
    ctx.shadowBlur = 0;
  };

  if (def.decor === 'gems') {
    const r = Math.max(1.2 / scale, outerWidth * 0.22);
    for (let i = 0; i < 4; i += 1) dot((Math.PI / 2) * i + Math.PI / 4, r, def.decorColor!);
  } else if (def.decor === 'dashes') {
    // Cristais de gelo: pequenos traços radiais espaçados.
    ctx.strokeStyle = def.decorColor!;
    ctx.lineWidth = Math.max(0.75 / scale, outerWidth * 0.14);
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i += 1) {
      const a = (Math.PI * 2 * i) / 12;
      const x1 = Math.cos(a) * rx(1.35);
      const y1 = Math.sin(a) * ry(1.35);
      const x2 = Math.cos(a) * rx(0.75);
      const y2 = Math.sin(a) * ry(0.75);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  } else if (def.decor === 'flames') {
    // Línguas de fogo: arcos curtos alternados sobre o anel.
    ctx.strokeStyle = def.decorColor!;
    ctx.lineWidth = Math.max(1 / scale, outerWidth * 0.2);
    ctx.lineCap = 'round';
    ctx.shadowColor = def.glow;
    ctx.shadowBlur = Math.max(2 / scale, outerWidth * 0.5);
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI * 2 * i) / 8;
      ctx.beginPath();
      ctx.ellipse(0, 0, midRx, midRy, 0, a, a + Math.PI / 10);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  } else if (def.decor === 'leaves') {
    const r = Math.max(1 / scale, outerWidth * 0.18);
    for (let i = 0; i < 6; i += 1) dot((Math.PI * 2 * i) / 6 + Math.PI / 6, r, def.decorColor!);
  } else if (def.decor === 'spikes') {
    // Espinhos sombrios: triângulos apontando para fora.
    ctx.fillStyle = def.decorColor!;
    ctx.shadowColor = def.glow;
    ctx.shadowBlur = Math.max(2 / scale, outerWidth * 0.4);
    for (let i = 0; i < 10; i += 1) {
      const a = (Math.PI * 2 * i) / 10;
      const bx = Math.cos(a) * rx(0.6);
      const by = Math.sin(a) * ry(0.6);
      const tx = Math.cos(a) * (rx(0.6) + outerWidth * 0.45);
      const ty = Math.sin(a) * (ry(0.6) + outerWidth * 0.45);
      const px = Math.cos(a + Math.PI / 2) * outerWidth * 0.14;
      const py = Math.sin(a + Math.PI / 2) * outerWidth * 0.14;
      ctx.beginPath();
      ctx.moveTo(bx + px, by + py);
      ctx.lineTo(bx - px, by - py);
      ctx.lineTo(tx, ty);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}
