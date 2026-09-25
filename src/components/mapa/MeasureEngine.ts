/**
 * MeasureEngine — Etapa 6.
 *
 * Régua/medição entre dois pontos do mundo. Calcula distância em "células"
 * (unidade = cfg.dpi) usando o estilo configurado em gridConfig.measurementStyle.
 *
 *  - CHEBYSHEV   : max(|dx|,|dy|)              (D&D 4e/5e — diagonal vale 1)
 *  - ALTERNATING : max + floor(min/2)          (D&D 3.5 — diagonal alterna 1,2)
 *  - MANHATTAN   : |dx|+|dy|                   (sem diagonal)
 *  - EUCLIDEAN   : sqrt(dx²+dy²)               (linha reta)
 *
 * Para hex (flat/pointy), usa distância axial em cubo coords; estilo é ignorado.
 * Para isométrico, usa Chebyshev nos eixos diamante.
 */
import type { GridConfig, Vector2, MeasurementStyle } from '@/stores/useMapStore';

export interface MeasureResult {
  cells: number;
  /** distância em pixels do mundo (sempre euclidiana real, para info). */
  pixels: number;
  label: string;
}

function hexAxialDistance(aq: number, ar: number, bq: number, br: number): number {
  const dq = aq - bq;
  const dr = ar - br;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export const MeasureEngine = {
  /** Distância em "células" segundo o tipo de grade + estilo. */
  cellDistance(a: Vector2, b: Vector2, cfg: GridConfig): number {
    const dpi = cfg.dpi || 1;
    if (cfg.type === 'HEX_VERTICAL') {
      const size = dpi / 2;
      const aq = (2 / 3) * a.x / size;
      const ar = (-1 / 3) * a.x / size + (Math.sqrt(3) / 3) * a.y / size;
      const bq = (2 / 3) * b.x / size;
      const br = (-1 / 3) * b.x / size + (Math.sqrt(3) / 3) * b.y / size;
      return hexAxialDistance(aq, ar, bq, br);
    }
    if (cfg.type === 'HEX_HORIZONTAL') {
      const size = dpi / 2;
      const aq = ((Math.sqrt(3) / 3) * a.x - (1 / 3) * a.y) / size;
      const ar = ((2 / 3) * a.y) / size;
      const bq = ((Math.sqrt(3) / 3) * b.x - (1 / 3) * b.y) / size;
      const br = ((2 / 3) * b.y) / size;
      return hexAxialDistance(aq, ar, bq, br);
    }
    const dx = Math.abs(b.x - a.x) / dpi;
    const dy = Math.abs(b.y - a.y) / dpi;
    const style: MeasurementStyle = cfg.measurementStyle;
    switch (style) {
      case 'MANHATTAN': return dx + dy;
      case 'EUCLIDEAN': return Math.hypot(dx, dy);
      case 'ALTERNATING': {
        const mx = Math.max(dx, dy);
        const mn = Math.min(dx, dy);
        return mx + Math.floor(mn / 2 + 1e-9) * 1 + (mn - Math.floor(mn));
        // pragmatismo: parte inteira segue 3.5e, fração mantém continuidade.
      }
      case 'CHEBYSHEV':
      default: return Math.max(dx, dy);
    }
  },

  /** Desenha a régua já dentro do transform do mundo. */
  draw(
    ctx: CanvasRenderingContext2D,
    a: Vector2,
    b: Vector2,
    cfg: GridConfig,
    scale: number,
  ) {
    const cells = this.cellDistance(a, b, cfg);
    const px = Math.hypot(b.x - a.x, b.y - a.y);

    ctx.save();
    // linha principal
    ctx.strokeStyle = 'rgba(255,225,120,0.95)';
    ctx.lineWidth = 2 / scale;
    ctx.setLineDash([8 / scale, 6 / scale]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // endpoints
    ctx.fillStyle = 'rgba(255,225,120,0.95)';
    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 / scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // label no ponto médio
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const metersPerCell = cfg.metersPerCell || 1.5;
    const meters = cells * metersPerCell;
    const text = `${meters.toFixed(meters < 10 ? 1 : 0)}m`;

    const fontPx = 13;
    ctx.font = `600 ${fontPx / scale}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const padX = 6 / scale;
    const padY = 3 / scale;
    const metrics = ctx.measureText(text);
    const tw = metrics.width;
    const th = fontPx / scale;
    ctx.fillStyle = 'rgba(20,20,30,0.85)';
    ctx.strokeStyle = 'rgba(255,225,120,0.9)';
    ctx.lineWidth = 1 / scale;
    const rx = mx - tw / 2 - padX;
    const ry = my - th / 2 - padY;
    const rw = tw + padX * 2;
    const rh = th + padY * 2;
    ctx.beginPath();
    const anyCtx = ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void };
    if (typeof anyCtx.roundRect === 'function') {
      anyCtx.roundRect(rx, ry, rw, rh, 4 / scale);
    } else {
      ctx.rect(rx, ry, rw, rh);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffe178';
    ctx.fillText(text, mx, my);
    ctx.restore();
  },
};
