/**
 * EntityEngine — Etapa 3.
 *
 * Funções puras (sem React, sem estado) para:
 *   - Hit-test OBB (Oriented Bounding Box) — corretíssimo sob rotação.
 *   - Cálculo de handles (8 de resize + 1 de rotação).
 *   - Render de entidades + overlay de seleção no canvas.
 *
 * Convenção: (x,y) é o CENTRO da entidade. w/h são as dimensões "locais"
 * antes da rotação. rotation é em radianos.
 */
import type { Entity, TokenCrop, Vector2 } from '@/stores/useMapStore';
import { drawTokenBorder } from '@/lib/mapa/tokenBorders';
import { assetCache } from './assetCache';
import { imagemDaEntidade, imagemPronta } from '@/lib/omni/imagemItem';



export type HandleKind =
  | 'nw' | 'n' | 'ne'
  | 'w'        | 'e'
  | 'sw' | 's' | 'se'
  | 'rot';

export interface Handle {
  kind: HandleKind;
  /** centro do handle em coords de mundo (após rotação aplicada) */
  x: number;
  y: number;
}

const DEFAULT_TOKEN_CROP: TokenCrop = { zoom: 1, offsetX: 0, offsetY: 0 };

export function normalizeTokenCrop(crop?: Partial<TokenCrop>): TokenCrop {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  return {
    zoom: clamp(Number.isFinite(crop?.zoom) ? Number(crop?.zoom) : 1, 1, 4),
    offsetX: clamp(Number.isFinite(crop?.offsetX) ? Number(crop?.offsetX) : 0, -100, 100),
    offsetY: clamp(Number.isFinite(crop?.offsetY) ? Number(crop?.offsetY) : 0, -100, 100),
    border: crop?.border,
  };
}

export function getTokenImageRect(
  naturalW: number,
  naturalH: number,
  frameW: number,
  frameH: number,
  crop?: Partial<TokenCrop>,
): { x: number; y: number; w: number; h: number } {
  const safeW = Math.max(1, naturalW);
  const safeH = Math.max(1, naturalH);
  const resolved = normalizeTokenCrop(crop ?? DEFAULT_TOKEN_CROP);
  const cover = Math.max(frameW / safeW, frameH / safeH) * resolved.zoom;
  const w = safeW * cover;
  const h = safeH * cover;
  const overflowX = Math.max(0, w - frameW) / 2;
  const overflowY = Math.max(0, h - frameH) / 2;
  return {
    x: -w / 2 + overflowX * (resolved.offsetX / 100),
    y: -h / 2 + overflowY * (resolved.offsetY / 100),
    w,
    h,
  };
}

export function getTokenDisplayPatch(
  circular: boolean,
  size: number,
  naturalW: number,
  naturalH: number,
): Pick<Entity, 'shape' | 'w' | 'h'> {
  const safeSize = Math.max(20, size);
  if (circular) return { shape: 'ELLIPSE', w: safeSize, h: safeSize };
  const ratio = naturalH > 0 ? Math.max(0.05, naturalW / naturalH) : 1;
  return { shape: 'RECT', w: Math.max(20, safeSize * ratio), h: safeSize };
}

/** Converte ponto-mundo p para coordenadas locais (não rotacionadas) da entidade. */
export function worldToLocal(p: Vector2, e: Entity): Vector2 {
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const c = Math.cos(-e.rotation);
  const s = Math.sin(-e.rotation);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

/** Converte ponto local da entidade para coords de mundo. */
export function localToWorld(p: Vector2, e: Entity): Vector2 {
  const c = Math.cos(e.rotation);
  const s = Math.sin(e.rotation);
  return { x: e.x + p.x * c - p.y * s, y: e.y + p.x * s + p.y * c };
}

/** Hit-test OBB. Suporta RECT e ELLIPSE. */
export function hitTest(p: Vector2, e: Entity): boolean {
  const lp = worldToLocal(p, e);
  const hw = e.w / 2;
  const hh = e.h / 2;
  if (e.shape === 'ELLIPSE') {
    const nx = lp.x / hw;
    const ny = lp.y / hh;
    return nx * nx + ny * ny <= 1;
  }
  return lp.x >= -hw && lp.x <= hw && lp.y >= -hh && lp.y <= hh;
}

/** AABB (em coords de mundo) do OBB da entidade. */
export function entityAABB(e: Entity): { x: number; y: number; x2: number; y2: number } {
  const hw = e.w / 2;
  const hh = e.h / 2;
  const corners = [
    localToWorld({ x: -hw, y: -hh }, e),
    localToWorld({ x:  hw, y: -hh }, e),
    localToWorld({ x:  hw, y:  hh }, e),
    localToWorld({ x: -hw, y:  hh }, e),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    x2: Math.max(...xs),
    y2: Math.max(...ys),
  };
}

/** Retorna ids cujo AABB intersecta o retângulo em coords de mundo. */
export function entitiesInRect(
  entities: Record<string, Entity>,
  rect: { x: number; y: number; w: number; h: number },
): string[] {
  const rx2 = rect.x + rect.w;
  const ry2 = rect.y + rect.h;
  const ids: string[] = [];
  for (const id in entities) {
    const e = entities[id];
    const b = entityAABB(e);
    if (b.x2 < rect.x || b.x > rx2 || b.y2 < rect.y || b.y > ry2) continue;
    ids.push(id);
  }
  return ids;
}

/** Handles em coords de mundo. O handle de rotação fica acima da borda N. */
export function getHandles(e: Entity, rotHandleOffset = 24): Handle[] {
  const hw = e.w / 2;
  const hh = e.h / 2;
  const defs: Array<{ kind: HandleKind; lx: number; ly: number }> = [
    { kind: 'nw', lx: -hw, ly: -hh },
    { kind: 'n',  lx: 0,   ly: -hh },
    { kind: 'ne', lx:  hw, ly: -hh },
    { kind: 'w',  lx: -hw, ly: 0   },
    { kind: 'e',  lx:  hw, ly: 0   },
    { kind: 'sw', lx: -hw, ly:  hh },
    { kind: 's',  lx: 0,   ly:  hh },
    { kind: 'se', lx:  hw, ly:  hh },
    { kind: 'rot', lx: 0,  ly: -hh - rotHandleOffset },
  ];
  return defs.map((d) => {
    const w = localToWorld({ x: d.lx, y: d.ly }, e);
    return { kind: d.kind, x: w.x, y: w.y };
  });
}

/** Retorna o handle sob o ponto, dado um raio de tolerância (em mundo).
 *  rotHandleOffset deve ser passado nas MESMAS unidades usadas no draw
 *  (geralmente 24/scale para casar com o desenho on-screen).
 */
export function pickHandle(p: Vector2, e: Entity, radius: number, rotHandleOffset = 24): Handle | null {
  const handles = getHandles(e, rotHandleOffset);
  let best: Handle | null = null;
  let bestD = radius * radius;
  for (const h of handles) {
    const dx = p.x - h.x;
    const dy = p.y - h.y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = h;
    }
  }
  return best;
}


/**
 * Aplica um drag de handle (em coords locais) e devolve patch {x,y,w,h}
 * já no espaço de mundo. delta vem nas coords LOCAIS da entidade.
 *
 * Para handles cardinais ('e','w','n','s') o resize é UNIFORME (escala
 * proporcional em w e h), ancorado no lado oposto — assim arrastar a borda
 * aumenta a imagem como um todo, mantendo o aspect ratio.
 * Para handles de canto ('ne','nw','se','sw') o resize é livre (eixos
 * independentes), como em ferramentas de edição tradicionais.
 */
export function resizeFromHandle(
  e: Entity,
  kind: HandleKind,
  deltaLocal: Vector2,
  minSize = 8,
): Partial<Entity> {
  const cosR = Math.cos(e.rotation);
  const sinR = Math.sin(e.rotation);

  // ---- Cardinais: escala uniforme, âncora no lado oposto ----
  if (kind === 'e' || kind === 'w' || kind === 'n' || kind === 's') {
    let newW = e.w;
    let newH = e.h;
    let anchorLx = 0;
    let anchorLy = 0;
    if (kind === 'e' || kind === 'w') {
      const dxLocal = kind === 'e' ? deltaLocal.x : -deltaLocal.x;
      newW = Math.max(minSize, e.w + dxLocal);
      const ratio = newW / e.w;
      newH = Math.max(minSize, e.h * ratio);
      // re-derive newW caso h tenha batido no mínimo
      if (e.h * ratio < minSize) {
        const r2 = newH / e.h;
        newW = Math.max(minSize, e.w * r2);
      }
      anchorLx = kind === 'e' ? -e.w / 2 : e.w / 2;
    } else {
      const dyLocal = kind === 's' ? deltaLocal.y : -deltaLocal.y;
      newH = Math.max(minSize, e.h + dyLocal);
      const ratio = newH / e.h;
      newW = Math.max(minSize, e.w * ratio);
      if (e.w * ratio < minSize) {
        const r2 = newW / e.w;
        newH = Math.max(minSize, e.h * r2);
      }
      anchorLy = kind === 's' ? -e.h / 2 : e.h / 2;
    }
    // novo centro em coords locais (a partir da âncora preservada)
    const newCx =
      kind === 'e' ? anchorLx + newW / 2
      : kind === 'w' ? anchorLx - newW / 2
      : 0;
    const newCy =
      kind === 's' ? anchorLy + newH / 2
      : kind === 'n' ? anchorLy - newH / 2
      : 0;
    return {
      x: e.x + newCx * cosR - newCy * sinR,
      y: e.y + newCx * sinR + newCy * cosR,
      w: newW,
      h: newH,
    };
  }

  // ---- Cantos: resize livre por eixo ----
  let dx = 0, dy = 0, dw = 0, dh = 0;
  if (kind.includes('e')) { dw = deltaLocal.x;  dx = deltaLocal.x / 2; }
  if (kind.includes('w')) { dw = -deltaLocal.x; dx = deltaLocal.x / 2; }
  if (kind.includes('s')) { dh = deltaLocal.y;  dy = deltaLocal.y / 2; }
  if (kind.includes('n')) { dh = -deltaLocal.y; dy = deltaLocal.y / 2; }

  const newW = Math.max(minSize, e.w + dw);
  const newH = Math.max(minSize, e.h + dh);
  if (e.w + dw < minSize) dx = 0;
  if (e.h + dh < minSize) dy = 0;

  const worldDx = dx * cosR - dy * sinR;
  const worldDy = dx * sinR + dy * cosR;
  return { x: e.x + worldDx, y: e.y + worldDy, w: newW, h: newH };
}


/** Render de uma entidade. Já dentro do save/transform (escala/translate do mundo). */
export function drawEntity(ctx: CanvasRenderingContext2D, e: Entity, scale: number) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.rotation);
  const hw = e.w / 2;
  const hh = e.h / 2;

  // Imagem (assetId) — se disponível no cache e carregada.
  const cached = e.assetId ? assetCache.get(e.assetId) : null;
  const imagemChao = e.groundItem && 'item' in e.groundItem ? imagemPronta(imagemDaEntidade(e.groundItem.item.entity)) : null;
  const image = cached?.ready ? cached.img : imagemChao;

  if (image) {
    // Clip pelo shape para imagem respeitar elipse.
    ctx.save();
    if (e.shape === 'ELLIPSE') {
      ctx.beginPath();
      ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      ctx.clip();
    }
    if (e.flipX) ctx.scale(-1, 1);
    try {
      if (e.shape === 'ELLIPSE' && e.tokenCrop) {
        const rect = getTokenImageRect(
          image.naturalWidth,
          image.naturalHeight,
          e.w,
          e.h,
          e.tokenCrop,
        );
        ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
      } else {
        ctx.drawImage(image, -hw, -hh, e.w, e.h);
      }
    } catch {
      // ignora frames durante decoding
    }
    ctx.restore();
    if (e.shape === 'ELLIPSE' && e.tokenCrop) {
      drawTokenBorder(ctx, hw, hh, e.tokenCrop.border, scale);
    }
  } else {
    ctx.fillStyle = withAlpha(e.color, e.terrainZone ? 0.18 : 0.5);
    ctx.strokeStyle = withAlpha(e.color, 1);
    ctx.lineWidth = 2 / scale;
    ctx.setLineDash(e.terrainZone ? [8 / scale, 5 / scale] : []);
    if (e.shape === 'ELLIPSE') {
      ctx.beginPath();
      ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.rect(-hw, -hh, e.w, e.h);
      ctx.fill();
      ctx.stroke();
    }
    ctx.setLineDash([]);

    if (e.label) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3 / scale;
      ctx.font = `${Math.max(10, Math.min(e.w, e.h) * 0.22)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.rotate(-e.rotation);
      ctx.strokeText(e.label, 0, 0);
      ctx.fillText(e.label, 0, 0);
    }
  }
  ctx.restore();
}

/**
 * Desenha nameplate (label) + HP bar abaixo da AABB da entidade, em coords-mundo
 * mas com tamanhos compensados pela escala (legível em qualquer zoom).
 */
export interface NameplateLiveStats {
  hp?: number;
  hpMax?: number;
  pe?: number;
  peMax?: number;
}

export function drawNameplate(
  ctx: CanvasRenderingContext2D,
  e: Entity,
  scale: number,
  opts: { force?: boolean; live?: NameplateLiveStats; hideStats?: boolean; label?: string } = {},
) {
  // Stats efetivos: prioriza a ficha vinculada (live) sobre os campos do próprio token.
  const hp = opts.live?.hp ?? e.hp;
  const hpMax = opts.live?.hpMax ?? e.hpMax;
  const pe = opts.live?.pe;
  const peMax = opts.live?.peMax;

  const label = opts.label ?? e.label;
  const showLabel = !!(label && !e.hideName && (e.nameplate || opts.force));
  const showHp = !opts.hideStats && typeof hp === 'number' && typeof hpMax === 'number' && (hpMax ?? 0) > 0;
  const showPe = !opts.hideStats && typeof pe === 'number' && typeof peMax === 'number' && (peMax ?? 0) > 0;
  if (!showLabel && !showHp && !showPe) return;



  const b = entityAABB(e);
  const cx = (b.x + b.x2) / 2;
  const tokenW = b.x2 - b.x;
  const tokenH = b.y2 - b.y;
  // Tamanhos proporcionais ao TOKEN (crescem com zoom-in), com mínimo legível em tela.
  const barW = Math.max(tokenW * 1.0, 80 / scale);
  const barH = Math.max(tokenH * 0.075, 10 / scale);
  const gap = Math.max(tokenH * 0.02, 2.5 / scale);
  const radius = barH / 2;
  const fontPx = barH * 0.92;



  ctx.save();

  const roundRectPath = (x: number, y: number, w: number, h: number, r: number) => {
    const rr = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  };

  const drawBar = (
    y: number,
    cur: number,
    max: number,
    fill: string,
  ) => {
    const x = cx - barW / 2;
    const ratio = Math.max(0, Math.min(1, max > 0 ? cur / max : 0));

    // Trilho: secondary translúcido (igual à StatusBar do site)
    roundRectPath(x, y, barW, barH, radius);
    ctx.fillStyle = 'hsla(265, 18%, 14%, 0.85)';
    ctx.fill();

    // Preenchimento flat, sem glow, com a mesma pill rounding
    if (ratio > 0) {
      ctx.save();
      roundRectPath(x, y, barW, barH, radius);
      ctx.clip();
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, barW * ratio, barH);
      ctx.restore();
    }

    // Texto cur/max — Cinzel
    ctx.font = `700 ${fontPx}px 'Cinzel', 'Cormorant Garamond', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const txt = `${cur}/${max}`;
    ctx.lineWidth = Math.max(1.5 / scale, barH * 0.18);
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.strokeText(txt, cx, y + barH / 2);
    ctx.fillStyle = 'hsl(270, 20%, 96%)';
    ctx.fillText(txt, cx, y + barH / 2);
  };


  // Empilhar acima do token: PE colado, HP em cima
  let topY = b.y - gap;
  if (showPe && typeof pe === 'number' && typeof peMax === 'number') {
    topY -= barH;
    // PE = primary roxo místico (--pe: 268 85% 62%)
    drawBar(topY, pe, peMax, 'hsl(268, 85%, 62%)');
    topY -= gap;
  }
  if (showHp && typeof hp === 'number' && typeof hpMax === 'number') {
    topY -= barH;
    // HP = vermelho (--hp: 0 75% 55%)
    drawBar(topY, hp, hpMax, 'hsl(0, 75%, 55%)');
  }


  let baseY = b.y2 + 6 / scale;


  if (showLabel && label) {
    const fontPx = 12 / scale;
    ctx.font = `${fontPx}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const padX = 6 / scale;
    const padY = 2 / scale;
    const metrics = ctx.measureText(label);
    const tw = metrics.width;
    const th = fontPx;
    const y = baseY + (showHp ? 4 / scale : 0);
    const bx = cx - tw / 2 - padX;
    const by = y;
    const bw = tw + padX * 2;
    const bh = th + padY * 2;
    ctx.fillStyle = 'rgba(20,20,24,0.85)';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1 / scale;
    ctx.beginPath();
    const ctxAny = ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void };
    if (typeof ctxAny.roundRect === 'function') {
      ctxAny.roundRect(bx, by, bw, bh, 3 / scale);
    } else {
      ctx.rect(bx, by, bw, bh);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(240,240,245,1)';
    ctx.fillText(label, cx, y + padY);
  }
  ctx.restore();
}
export function drawSelection(ctx: CanvasRenderingContext2D, e: Entity, scale: number) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.rotation);
  ctx.strokeStyle = 'rgba(120,200,255,0.95)';
  ctx.lineWidth = 1.5 / scale;
  ctx.setLineDash([4 / scale, 3 / scale]);
  ctx.strokeRect(-e.w / 2, -e.h / 2, e.w, e.h);
  ctx.setLineDash([]);
  ctx.restore();

  // Handles visíveis: apenas rotação (topo) + resize lateral (E/W).
  // Os demais (cantos, N/S) continuam ativos para hit-test em pickHandle, mas
  // não são desenhados para manter a UI limpa estilo Owlbear.
  const handles = getHandles(e, 24 / scale).filter(
    (h) => h.kind === 'rot' || h.kind === 'e' || h.kind === 'w',
  );
  const r = 7 / scale;
  ctx.save();
  for (const h of handles) {
    if (h.kind === 'rot') {
      const nWorld = localToWorld({ x: 0, y: -e.h / 2 }, e);
      ctx.strokeStyle = 'rgba(120,200,255,0.7)';
      ctx.lineWidth = 1 / scale;
      ctx.beginPath();
      ctx.moveTo(nWorld.x, nWorld.y);
      ctx.lineTo(h.x, h.y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(30,35,45,0.95)';
      ctx.strokeStyle = 'rgba(200,220,255,0.95)';
      ctx.lineWidth = 1.5 / scale;
      ctx.beginPath();
      ctx.arc(h.x, h.y, r * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(30,35,45,0.95)';
      ctx.strokeStyle = 'rgba(200,220,255,0.95)';
      ctx.lineWidth = 1.5 / scale;
      ctx.beginPath();
      ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function withAlpha(hex: string, a: number): string {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return `rgba(180,180,255,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
