/**
 * DrawEngine — desenho livre estilo Owlbear.
 *
 * Cada stroke é uma polilinha em coordenadas-mundo com cor + largura.
 * Renderiza com quadraticCurveTo para suavização leve.
 *
 * Borracha: hit-test por distância de ponto-ao-segmento contra o raio
 * do círculo da borracha (em coords-mundo).
 */
import type { DrawStroke, Vector2 } from '@/stores/useMapStore';

export const DrawEngine = {
  /** Desenha todos os strokes. Assume ctx já transformado para mundo. */
  drawAll(ctx: CanvasRenderingContext2D, strokes: DrawStroke[]) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of strokes) drawStroke(ctx, s);
    ctx.restore();
  },

  /** Preview do stroke atual em desenho. */
  drawLive(ctx: CanvasRenderingContext2D, stroke: DrawStroke) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawStroke(ctx, stroke);
    ctx.restore();
  },

  /** Cursor da borracha (círculo). */
  drawEraserCursor(
    ctx: CanvasRenderingContext2D,
    p: Vector2,
    radius: number,
    scale: number,
  ) {
    ctx.save();
    ctx.lineWidth = 1.5 / scale;
    ctx.strokeStyle = 'rgba(255,160,160,0.9)';
    ctx.fillStyle = 'rgba(255,160,160,0.12)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },

  /** Retorna IDs de strokes a remover (qualquer ponto/segmento dentro do círculo). */
  hitStrokes(strokes: DrawStroke[], center: Vector2, radius: number): string[] {
    const out: string[] = [];
    for (const s of strokes) {
      if (strokeIntersectsCircle(s, center, radius)) out.push(s.id);
    }
    return out;
  },

  /**
   * Aplica a borracha em todos os strokes atingidos: recorta as partes que
   * caem dentro do círculo e mantém o restante como novos sub-strokes.
   * Retorna { removeIds, add } para alimentar `spliceStrokes`.
   */
  eraseAt(
    strokes: DrawStroke[],
    center: Vector2,
    radius: number,
  ): { removeIds: string[]; add: DrawStroke[] } {
    const removeIds: string[] = [];
    const add: DrawStroke[] = [];
    for (const s of strokes) {
      if (!strokeIntersectsCircle(s, center, radius)) continue;
      removeIds.push(s.id);
      const pieces = splitStrokeByCircle(s, center, radius);
      for (let i = 0; i < pieces.length; i++) {
        add.push({
          ...s,
          id: `${s.id}-e${Date.now().toString(36)}${i}`,
          points: pieces[i],
        });
      }
    }
    return { removeIds, add };
  },
};

/** Divide os pontos do stroke em subsequências fora do círculo da borracha. */
function splitStrokeByCircle(
  s: DrawStroke,
  c: Vector2,
  r: number,
): Vector2[][] {
  const rEff = r + s.size / 2;
  const r2 = rEff * rEff;
  const inside = (p: Vector2) => {
    const dx = p.x - c.x, dy = p.y - c.y;
    return dx * dx + dy * dy <= r2;
  };
  const pieces: Vector2[][] = [];
  let cur: Vector2[] = [];
  for (const p of s.points) {
    if (inside(p)) {
      if (cur.length >= 2) pieces.push(cur);
      cur = [];
    } else {
      cur.push(p);
    }
  }
  if (cur.length >= 2) pieces.push(cur);
  return pieces;
}

function drawStroke(ctx: CanvasRenderingContext2D, s: DrawStroke) {
  if (s.points.length === 0) return;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.beginPath();
  const pts = s.points;
  if (pts.length === 1) {
    // pontinho
    ctx.fillStyle = s.color;
    ctx.arc(pts[0].x, pts[0].y, s.size / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function strokeIntersectsCircle(s: DrawStroke, c: Vector2, r: number): boolean {
  const rEff = r + s.size / 2;
  const r2 = rEff * rEff;
  const pts = s.points;
  if (pts.length === 1) {
    const dx = pts[0].x - c.x, dy = pts[0].y - c.y;
    return dx * dx + dy * dy <= r2;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    if (segDistSq(pts[i], pts[i + 1], c) <= r2) return true;
  }
  return false;
}

function segDistSq(a: Vector2, b: Vector2, p: Vector2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx - p.x;
  const py = a.y + t * dy - p.y;
  return px * px + py * py;
}
