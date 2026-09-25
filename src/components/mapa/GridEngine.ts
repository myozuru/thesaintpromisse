/**
 * GridEngine — Etapa 2.
 *
 * Classe utilitária estática (sem estado, sem React) para:
 *   - matemática de snapping (com tolerância euclidiana)
 *   - desenho responsivo apenas da bounding box visível do canvas
 *
 * Suporta SQUARE, HEX_VERTICAL (flat-top), HEX_HORIZONTAL (pointy-top) e
 * ISOMETRIC. Snapping em hex usa conversão axial cube-coord para escolher
 * o centro mais próximo.
 */
import type { GridConfig, Vector2 } from '@/stores/useMapStore';

export interface BBox { minX: number; minY: number; maxX: number; maxY: number; }

/** Coordenada de tela → coordenada lógica do mundo, dada a câmera. */
export function screenToWorld(
  sx: number,
  sy: number,
  cam: { x: number; y: number; scale: number },
): Vector2 {
  return { x: sx / cam.scale - cam.x, y: sy / cam.scale - cam.y };
}

/** Bounding box visível em coords lógicas, dado tamanho de viewport. */
export function visibleBBox(
  width: number,
  height: number,
  cam: { x: number; y: number; scale: number },
): BBox {
  const tl = screenToWorld(0, 0, cam);
  const br = screenToWorld(width, height, cam);
  return { minX: tl.x, minY: tl.y, maxX: br.x, maxY: br.y };
}

function applyLineDash(ctx: CanvasRenderingContext2D, lt: GridConfig['lineType'], scale: number) {
  // Padrão de dash escalonado para parecer constante na tela.
  if (lt === 'dashed') ctx.setLineDash([6 / scale, 4 / scale]);
  else if (lt === 'dotted') ctx.setLineDash([1.5 / scale, 4 / scale]);
  else ctx.setLineDash([]);
}

export const GridEngine = {
  /** Distância euclidiana ao quadrado (evita sqrt nos comparativos). */
  distSq(a: Vector2, b: Vector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  },

  /**
   * Snap principal — retorna o ponto magnético OU o ponto original se
   * estiver fora do raio de tolerância (snappingSensitivity * dpi).
   */
  snapToGrid(p: Vector2, cfg: GridConfig): Vector2 {
    const candidate = this.nearestAnchor(p, cfg);
    if (!candidate) return p;
    const tol = cfg.dpi * Math.max(0, Math.min(1, cfg.snappingSensitivity));
    if (this.distSq(p, candidate) <= tol * tol) return candidate;
    return p;
  },

  /** Calcula o ponto âncora mais próximo (sem aplicar tolerância). */
  nearestAnchor(p: Vector2, cfg: GridConfig): Vector2 | null {
    switch (cfg.type) {
      case 'SQUARE':
        return nearestSquare(p, cfg);
      case 'ISOMETRIC':
        return nearestIso(p, cfg);
      case 'HEX_VERTICAL':
        return nearestHexFlatTop(p, cfg);
      case 'HEX_HORIZONTAL':
        return nearestHexPointyTop(p, cfg);
      default:
        return null;
    }
  },

  /** Desenha a grade apenas no trecho visível. Já dentro do save/transform. */
  draw(ctx: CanvasRenderingContext2D, bbox: BBox, cfg: GridConfig, scale: number) {
    if (!cfg.visible) return;
    // Fade de opacidade em zoom-out: scale ≥ 0.7 → 100%; scale ≤ 0.2 → 0%.
    const zoomFade = Math.max(0, Math.min(1, (scale - 0.2) / 0.5));
    if (zoomFade <= 0.02) return;
    ctx.save();
    ctx.lineWidth = cfg.lineWidth / scale;
    const baseOpacity = typeof cfg.opacity === 'number' ? cfg.opacity : 0.35;
    ctx.strokeStyle = withAlpha(cfg.color, baseOpacity * zoomFade);

    applyLineDash(ctx, cfg.lineType, scale);

    switch (cfg.type) {
      case 'SQUARE':
        drawSquare(ctx, bbox, cfg);
        break;
      case 'ISOMETRIC':
        drawIso(ctx, bbox, cfg);
        break;
      case 'HEX_VERTICAL':
        drawHexFlatTop(ctx, bbox, cfg);
        break;
      case 'HEX_HORIZONTAL':
        drawHexPointyTop(ctx, bbox, cfg);
        break;
    }
    ctx.restore();
  },
};

// ============================================================
// SQUARE
// ============================================================

function nearestSquare(p: Vector2, cfg: GridConfig): Vector2 {
  // Se useCorners + useCenter, geramos subdivisão (dpi/2).
  const step = cfg.useCorners && cfg.useCenter ? cfg.dpi / 2 : cfg.dpi;
  // Se só useCenter, deslocamos meia célula.
  if (cfg.useCenter && !cfg.useCorners) {
    const half = cfg.dpi / 2;
    return {
      x: Math.round((p.x - half) / cfg.dpi) * cfg.dpi + half,
      y: Math.round((p.y - half) / cfg.dpi) * cfg.dpi + half,
    };
  }
  return {
    x: Math.round(p.x / step) * step,
    y: Math.round(p.y / step) * step,
  };
}

function drawSquare(ctx: CanvasRenderingContext2D, b: BBox, cfg: GridConfig) {
  const step = cfg.dpi;
  const x0 = Math.floor(b.minX / step) * step;
  const y0 = Math.floor(b.minY / step) * step;
  ctx.beginPath();
  for (let x = x0; x <= b.maxX; x += step) {
    ctx.moveTo(x, b.minY);
    ctx.lineTo(x, b.maxY);
  }
  for (let y = y0; y <= b.maxY; y += step) {
    ctx.moveTo(b.minX, y);
    ctx.lineTo(b.maxX, y);
  }
  ctx.stroke();
}

// ============================================================
// ISOMETRIC (diamantes 2:1)
// ============================================================

function nearestIso(p: Vector2, cfg: GridConfig): Vector2 {
  const w = cfg.dpi;
  const h = cfg.dpi / 2;
  // Eixo iso: u = x/w + y/h; v = x/w - y/h. Arredonda u,v e volta.
  const u = Math.round(p.x / w + p.y / h);
  const v = Math.round(p.x / w - p.y / h);
  return { x: ((u + v) / 2) * w, y: ((u - v) / 2) * h };
}

function drawIso(ctx: CanvasRenderingContext2D, b: BBox, cfg: GridConfig) {
  const w = cfg.dpi;
  const h = cfg.dpi / 2;
  // Linhas com inclinação +h/w e -h/w, espaçadas a cada h verticalmente.
  // Usamos intercepto c = y - (h/w)*x e y + (h/w)*x.
  const slope = h / w;
  ctx.beginPath();
  // Famílias de retas: y = slope*x + c1 e y = -slope*x + c2.
  const c1Min = b.minY - slope * b.maxX;
  const c1Max = b.maxY - slope * b.minX;
  const c2Min = b.minY + slope * b.minX;
  const c2Max = b.maxY + slope * b.maxX;
  const cStep = h; // espaçamento dos interceptos
  const c1Start = Math.floor(c1Min / cStep) * cStep;
  const c2Start = Math.floor(c2Min / cStep) * cStep;
  for (let c = c1Start; c <= c1Max; c += cStep) {
    ctx.moveTo(b.minX, slope * b.minX + c);
    ctx.lineTo(b.maxX, slope * b.maxX + c);
  }
  for (let c = c2Start; c <= c2Max; c += cStep) {
    ctx.moveTo(b.minX, -slope * b.minX + c);
    ctx.lineTo(b.maxX, -slope * b.maxX + c);
  }
  ctx.stroke();
}

// ============================================================
// HEX — Flat-top (HEX_VERTICAL) : lados horizontais no topo/baixo
// ============================================================
// Tamanho do hex: dpi = largura "flat-to-flat" horizontal.
// Para flat-top: width = 2*size, height = sqrt(3)*size, onde size = raio do canto.

function nearestHexFlatTop(p: Vector2, cfg: GridConfig): Vector2 {
  const size = cfg.dpi / 2;
  // Pixel→axial (flat-top)
  const q = ((2 / 3) * p.x) / size;
  const r = ((-1 / 3) * p.x + (Math.sqrt(3) / 3) * p.y) / size;
  const [rq, rr] = hexRound(q, r);
  const x = size * (1.5 * rq);
  const y = size * (Math.sqrt(3) * (rr + rq / 2));
  return { x, y };
}

function drawHexFlatTop(ctx: CanvasRenderingContext2D, b: BBox, cfg: GridConfig) {
  const size = cfg.dpi / 2;
  const w = 2 * size;
  const h = Math.sqrt(3) * size;
  const colStep = (3 / 4) * w;
  // q-range estimado a partir de bbox.
  const qMin = Math.floor(b.minX / colStep) - 1;
  const qMax = Math.ceil(b.maxX / colStep) + 1;
  const rMin = Math.floor(b.minY / h) - 1;
  const rMax = Math.ceil(b.maxY / h) + 1;
  ctx.beginPath();
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      const cx = size * 1.5 * q;
      const cy = size * Math.sqrt(3) * (r + q / 2);
      if (cx < b.minX - w || cx > b.maxX + w || cy < b.minY - h || cy > b.maxY + h) continue;
      tracePolygon(ctx, cx, cy, size, 0);
    }
  }
  ctx.stroke();
}

// ============================================================
// HEX — Pointy-top (HEX_HORIZONTAL) : pontas no topo/baixo
// ============================================================

function nearestHexPointyTop(p: Vector2, cfg: GridConfig): Vector2 {
  const size = cfg.dpi / 2;
  const q = ((Math.sqrt(3) / 3) * p.x - (1 / 3) * p.y) / size;
  const r = ((2 / 3) * p.y) / size;
  const [rq, rr] = hexRound(q, r);
  const x = size * (Math.sqrt(3) * (rq + rr / 2));
  const y = size * (1.5 * rr);
  return { x, y };
}

function drawHexPointyTop(ctx: CanvasRenderingContext2D, b: BBox, cfg: GridConfig) {
  const size = cfg.dpi / 2;
  const w = Math.sqrt(3) * size;
  const h = 2 * size;
  const rowStep = (3 / 4) * h;
  const qMin = Math.floor(b.minX / w) - 1;
  const qMax = Math.ceil(b.maxX / w) + 1;
  const rMin = Math.floor(b.minY / rowStep) - 1;
  const rMax = Math.ceil(b.maxY / rowStep) + 1;
  ctx.beginPath();
  for (let r = rMin; r <= rMax; r++) {
    for (let q = qMin; q <= qMax; q++) {
      const cx = size * Math.sqrt(3) * (q + r / 2);
      const cy = size * 1.5 * r;
      if (cx < b.minX - w || cx > b.maxX + w || cy < b.minY - h || cy > b.maxY + h) continue;
      tracePolygon(ctx, cx, cy, size, Math.PI / 6);
    }
  }
  ctx.stroke();
}

/** Traça um hexágono regular (sem stroke/fill — chamador agrega). */
function tracePolygon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  startAngle: number,
) {
  for (let i = 0; i < 6; i++) {
    const a = startAngle + (Math.PI / 3) * i;
    const x = cx + size * Math.cos(a);
    const y = cy + size * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Cube-coord rounding clássico do Red Blob Games. */
function hexRound(qf: number, rf: number): [number, number] {
  const xf = qf;
  const zf = rf;
  const yf = -xf - zf;
  let rx = Math.round(xf);
  let ry = Math.round(yf);
  let rz = Math.round(zf);
  const dx = Math.abs(rx - xf);
  const dy = Math.abs(ry - yf);
  const dz = Math.abs(rz - zf);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return [rx, rz];
}

/** Aplica alpha a uma cor hex curta ou longa (#fff / #ffffff). */
function withAlpha(hex: string, a: number): string {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return `rgba(255,255,255,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
