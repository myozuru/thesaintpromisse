/**
 * GroupEngine — utilitários para operações em grupo (Fase 5).
 *
 * - Bounding box agregado da seleção (axis-aligned, em coords de mundo).
 * - Resize em grupo: escala posições relativas ao centro do pivô (canto oposto
 *   ao handle) e escala w/h proporcionalmente em cada eixo.
 * - Rotate em grupo: rotaciona o centro de cada entidade ao redor do pivô do
 *   grupo e soma o delta angular ao rotation individual.
 * - Align/Distribute: operam sobre AABB de cada entidade.
 *
 * Não tocam estado. Devolvem patches `{ id, patch }`.
 */
import type { Entity } from '@/stores/useMapStore';
import { entityAABB } from './EntityEngine';

export interface GroupBBox {
  x: number; y: number; x2: number; y2: number;
  cx: number; cy: number; w: number; h: number;
}

export function groupBBox(entities: Entity[]): GroupBBox | null {
  if (!entities.length) return null;
  let x = Infinity, y = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const e of entities) {
    const b = entityAABB(e);
    if (b.x  < x ) x  = b.x;
    if (b.y  < y ) y  = b.y;
    if (b.x2 > x2) x2 = b.x2;
    if (b.y2 > y2) y2 = b.y2;
  }
  return { x, y, x2, y2, cx: (x + x2) / 2, cy: (y + y2) / 2, w: x2 - x, h: y2 - y };
}

export type GroupHandleKind =
  | 'nw' | 'n' | 'ne'
  | 'w'        | 'e'
  | 'sw' | 's' | 'se'
  | 'rot';

export interface GroupHandle { kind: GroupHandleKind; x: number; y: number; }

export function groupHandles(b: GroupBBox, rotOffset = 28): GroupHandle[] {
  return [
    { kind: 'nw', x: b.x,  y: b.y  },
    { kind: 'n',  x: b.cx, y: b.y  },
    { kind: 'ne', x: b.x2, y: b.y  },
    { kind: 'w',  x: b.x,  y: b.cy },
    { kind: 'e',  x: b.x2, y: b.cy },
    { kind: 'sw', x: b.x,  y: b.y2 },
    { kind: 's',  x: b.cx, y: b.y2 },
    { kind: 'se', x: b.x2, y: b.y2 },
    { kind: 'rot', x: b.cx, y: b.y - rotOffset },
  ];
}

export function pickGroupHandle(
  p: { x: number; y: number },
  b: GroupBBox,
  radius: number,
  rotOffset = 28,
): GroupHandle | null {
  const hs = groupHandles(b, rotOffset);
  let best: GroupHandle | null = null;
  let bd = radius * radius;
  for (const h of hs) {
    const dx = p.x - h.x;
    const dy = p.y - h.y;
    const d = dx * dx + dy * dy;
    if (d <= bd) { bd = d; best = h; }
  }
  return best;
}

/** Calcula o pivô (canto oposto ao handle) do bbox original. */
export function pivotForHandle(b: GroupBBox, k: GroupHandleKind): { x: number; y: number } {
  let px = b.cx, py = b.cy;
  if (k.includes('e')) px = b.x;
  if (k.includes('w')) px = b.x2;
  if (k.includes('s')) py = b.y;
  if (k.includes('n')) py = b.y2;
  if (k === 'n' || k === 's') px = b.cx;
  if (k === 'e' || k === 'w') py = b.cy;
  return { x: px, y: py };
}

/**
 * Resize de grupo. `world` é a posição atual do mouse.
 * - Escala em cada eixo conforme handle.
 * - uniform=true preserva proporção (Shift).
 */
export function applyGroupResize(
  origs: Entity[],
  bbox: GroupBBox,
  handle: GroupHandleKind,
  world: { x: number; y: number },
  uniform: boolean,
  minScale = 0.05,
): Array<{ id: string; patch: Partial<Entity> }> {
  const pivot = pivotForHandle(bbox, handle);
  // Tamanho de referência do bbox em cada eixo (do pivô ao handle oposto).
  const refW = Math.max(1e-6, Math.abs(bbox.cx === pivot.x ? bbox.w / 2 : (handle.includes('e') ? bbox.x2 - pivot.x : pivot.x - bbox.x)));
  const refH = Math.max(1e-6, Math.abs(bbox.cy === pivot.y ? bbox.h / 2 : (handle.includes('s') ? bbox.y2 - pivot.y : pivot.y - bbox.y)));

  let sx = 1, sy = 1;
  if (handle === 'n' || handle === 's') {
    sy = (world.y - pivot.y) / (handle === 's' ? (bbox.y2 - pivot.y) : (bbox.y - pivot.y));
    sx = 1;
  } else if (handle === 'e' || handle === 'w') {
    sx = (world.x - pivot.x) / (handle === 'e' ? (bbox.x2 - pivot.x) : (bbox.x - pivot.x));
    sy = 1;
  } else {
    sx = (world.x - pivot.x) / ((handle.includes('e') ? bbox.x2 : bbox.x) - pivot.x);
    sy = (world.y - pivot.y) / ((handle.includes('s') ? bbox.y2 : bbox.y) - pivot.y);
  }

  if (!isFinite(sx) || sx === 0) sx = minScale;
  if (!isFinite(sy) || sy === 0) sy = minScale;
  if (uniform) {
    const s = Math.max(Math.abs(sx), Math.abs(sy)) * Math.sign(sx * sy || 1);
    sx = Math.sign(sx) * Math.abs(s);
    sy = Math.sign(sy) * Math.abs(s);
  }
  // Evita flips: clamp pra positivo mínimo. (flip pode vir depois se quisermos)
  sx = Math.max(minScale, Math.abs(sx));
  sy = Math.max(minScale, Math.abs(sy));

  return origs.map((e) => {
    const nx = pivot.x + (e.x - pivot.x) * sx;
    const ny = pivot.y + (e.y - pivot.y) * sy;
    const nw = Math.max(8, e.w * sx);
    const nh = Math.max(8, e.h * sy);
    return { id: e.id, patch: { x: nx, y: ny, w: nw, h: nh } };
  });
  // (refW/refH calculadas mas não usadas — mantidas como documentação interna.)
}

/** Rotação em grupo: gira cada centro em torno do pivô e soma o delta angular. */
export function applyGroupRotate(
  origs: Entity[],
  pivot: { x: number; y: number },
  deltaAngle: number,
): Array<{ id: string; patch: Partial<Entity> }> {
  const c = Math.cos(deltaAngle);
  const s = Math.sin(deltaAngle);
  return origs.map((e) => {
    const dx = e.x - pivot.x;
    const dy = e.y - pivot.y;
    return {
      id: e.id,
      patch: {
        x: pivot.x + dx * c - dy * s,
        y: pivot.y + dx * s + dy * c,
        rotation: e.rotation + deltaAngle,
      },
    };
  });
}

// ─── Align / Distribute ───────────────────────────────────────────────────────

export type AlignKind = 'left' | 'right' | 'top' | 'bottom' | 'hcenter' | 'vcenter';

export function align(entities: Entity[], kind: AlignKind): Array<{ id: string; patch: Partial<Entity> }> {
  if (entities.length < 2) return [];
  const bs = entities.map((e) => ({ e, b: entityAABB(e) }));
  const xs = bs.map(({ b }) => b.x);
  const x2s = bs.map(({ b }) => b.x2);
  const ys = bs.map(({ b }) => b.y);
  const y2s = bs.map(({ b }) => b.y2);
  const minX = Math.min(...xs);
  const maxX = Math.max(...x2s);
  const minY = Math.min(...ys);
  const maxY = Math.max(...y2s);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return bs.map(({ e, b }) => {
    const bcx = (b.x + b.x2) / 2;
    const bcy = (b.y + b.y2) / 2;
    let dx = 0, dy = 0;
    switch (kind) {
      case 'left':    dx = minX - b.x;  break;
      case 'right':   dx = maxX - b.x2; break;
      case 'top':     dy = minY - b.y;  break;
      case 'bottom':  dy = maxY - b.y2; break;
      case 'hcenter': dx = cx - bcx;    break;
      case 'vcenter': dy = cy - bcy;    break;
    }
    return { id: e.id, patch: { x: e.x + dx, y: e.y + dy } };
  });
}

export type DistributeKind = 'horizontal' | 'vertical';

export function distribute(entities: Entity[], kind: DistributeKind): Array<{ id: string; patch: Partial<Entity> }> {
  if (entities.length < 3) return [];
  const items = entities.map((e) => ({ e, b: entityAABB(e) }));
  if (kind === 'horizontal') {
    items.sort((a, c) => (a.b.x + a.b.x2) / 2 - (c.b.x + c.b.x2) / 2);
    const first = items[0];
    const last  = items[items.length - 1];
    const fc = (first.b.x + first.b.x2) / 2;
    const lc = (last.b.x  + last.b.x2)  / 2;
    const step = (lc - fc) / (items.length - 1);
    return items.map((it, i) => {
      if (i === 0 || i === items.length - 1) return { id: it.e.id, patch: {} };
      const targetCx = fc + step * i;
      const curCx    = (it.b.x + it.b.x2) / 2;
      return { id: it.e.id, patch: { x: it.e.x + (targetCx - curCx) } };
    });
  } else {
    items.sort((a, c) => (a.b.y + a.b.y2) / 2 - (c.b.y + c.b.y2) / 2);
    const first = items[0];
    const last  = items[items.length - 1];
    const fc = (first.b.y + first.b.y2) / 2;
    const lc = (last.b.y  + last.b.y2)  / 2;
    const step = (lc - fc) / (items.length - 1);
    return items.map((it, i) => {
      if (i === 0 || i === items.length - 1) return { id: it.e.id, patch: {} };
      const targetCy = fc + step * i;
      const curCy    = (it.b.y + it.b.y2) / 2;
      return { id: it.e.id, patch: { y: it.e.y + (targetCy - curCy) } };
    });
  }
}

/** Render do bounding box de grupo + handles (em coords de mundo). */
export function drawGroupBox(
  ctx: CanvasRenderingContext2D,
  b: GroupBBox,
  scale: number,
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,200,120,0.95)';
  ctx.lineWidth = 1.5 / scale;
  ctx.setLineDash([5 / scale, 4 / scale]);
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.setLineDash([]);

  const r = 5 / scale;
  const rotOffset = 28 / scale;
  const hs = groupHandles(b, rotOffset);
  for (const h of hs) {
    if (h.kind === 'rot') {
      ctx.strokeStyle = 'rgba(255,200,120,0.7)';
      ctx.lineWidth = 1 / scale;
      ctx.beginPath();
      ctx.moveTo(b.cx, b.y);
      ctx.lineTo(h.x, h.y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(120,255,170,0.95)';
      ctx.beginPath();
      ctx.arc(h.x, h.y, r * 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.strokeStyle = 'rgba(255,200,120,1)';
      ctx.lineWidth = 1 / scale;
      ctx.beginPath();
      ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}
