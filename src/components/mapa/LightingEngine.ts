/**
 * LightingEngine — Fase 12.
 *
 * Renderiza uma camada de escuridão sobre o mapa (em coords de tela),
 * "perfurada" por luzes radiais emitidas pelas entidades que possuem
 * `light = { radius, color, intensity }`. Sem ray-casting (LOS),
 * apenas falloff radial com bordas suaves.
 *
 * Convenção de cores: light.color em '#rrggbb'.
 */
import type { Entity, GridConfig, Vector2 } from '@/stores/useMapStore';
import { computeVisibilityPolygon, pathPolygon } from './VisionEngine';

export interface LightingState {
  enabled: boolean;
  /** 0..1 — opacidade da escuridão ambiente (1 = totalmente escuro). */
  ambient: number;
  /** Cor da escuridão (#rrggbb). */
  color: string;
}



export interface LightSource {
  /** centro em coords de mundo */
  x: number;
  y: number;
  /** raio em coords de mundo (já convertido a partir de cells * dpi) */
  radius: number;
  color: string;
  /** 0..1 — intensidade do brilho central */
  intensity: number;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h.split('').map((c) => c + c).join('')
    : h.padEnd(6, '0');
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Extrai fontes de luz a partir das entidades visíveis.
 * Considera entity.light.radius em CÉLULAS (multiplica por dpi).
 */
export function collectLights(
  entities: Record<string, Entity>,
  order: string[],
  dpi: number,
): LightSource[] {
  const out: LightSource[] = [];
  for (const id of order) {
    const e = entities[id];
    if (!e || e.hidden) continue;
    const li = e.light;
    if (!li || !(li.radius > 0)) continue;
    out.push({
      x: e.x,
      y: e.y,
      radius: li.radius * dpi,
      color: li.color || '#ffd58a',
      intensity: Math.min(1, Math.max(0, li.intensity ?? 0.9)),
    });
  }
  return out;
}

export const LightingEngine = {
  /**
   * Desenha a camada de iluminação em `ctx` (canvas em tela cheia, sem transform).
   * Aplica a matriz `setTransform(scale*dpr, 0, 0, scale*dpr, dpr*scale*camera.x, ...)`
   * INTERNAMENTE para desenhar as luzes em coords de mundo via composição.
   *
   * Estratégia: pinta um retângulo escuro full-screen; depois usa
   * `destination-out` com gradiente radial para "furar" buracos suaves;
   * por fim, em `lighter`, soma um pequeno tinte da cor da luz.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    state: LightingState,
    lights: LightSource[],
    cam: { x: number; y: number; scale: number },
    viewport: { w: number; h: number },
    dpr: number,
    _grid: GridConfig,
    blockerSegments: Array<[Vector2, Vector2]> = [],
  ) {
    if (!state.enabled) return;

    const W = viewport.w * dpr;
    const H = viewport.h * dpr;

    // 1) Escuridão ambiente.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const { r, g, b } = hexToRgb(state.color);
    ctx.fillStyle = `rgba(${r},${g},${b},${state.ambient})`;
    ctx.fillRect(0, 0, W, H);

    if (!lights.length) return;

    // 2) Perfura buracos com gradientes radiais (destination-out).
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(cam.x, cam.y);

    ctx.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      const poly = blockerSegments.length ? computeVisibilityPolygon({ x: l.x, y: l.y }, l.radius, blockerSegments) : null;
      if (poly) { ctx.save(); pathPolygon(ctx, poly); ctx.clip(); }
      const grd = ctx.createRadialGradient(l.x, l.y, l.radius * 0.15, l.x, l.y, l.radius);
      // alpha center → 0 nas bordas (em destination-out: 1 apaga, 0 mantém)
      grd.addColorStop(0, `rgba(0,0,0,${0.92 * l.intensity})`);
      grd.addColorStop(0.55, `rgba(0,0,0,${0.55 * l.intensity})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.radius, 0, Math.PI * 2);
      ctx.fill();
      if (poly) ctx.restore();
    }

    // 3) Tinte quente sobre o que ficou iluminado.
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const poly = blockerSegments.length ? computeVisibilityPolygon({ x: l.x, y: l.y }, l.radius, blockerSegments) : null;
      if (poly) { ctx.save(); pathPolygon(ctx, poly); ctx.clip(); }
      const lc = hexToRgb(l.color);
      const grd = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.radius);
      grd.addColorStop(0, `rgba(${lc.r},${lc.g},${lc.b},${0.18 * l.intensity})`);
      grd.addColorStop(0.7, `rgba(${lc.r},${lc.g},${lc.b},${0.05 * l.intensity})`);
      grd.addColorStop(1, `rgba(${lc.r},${lc.g},${lc.b},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.radius, 0, Math.PI * 2);
      ctx.fill();
      if (poly) ctx.restore();
    }

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  },
};

/** Presets de luz exposiçãoem células (raios D&D-ish). */
export const LIGHT_PRESETS: Record<string, { radius: number; color: string; intensity: number } | null> = {
  none: null,
  candle:   { radius: 2,  color: '#ffd49a', intensity: 0.7 },
  torch:    { radius: 4,  color: '#ffb070', intensity: 0.9 },
  lantern:  { radius: 6,  color: '#ffd58a', intensity: 0.95 },
  daylight: { radius: 12, color: '#fff4d2', intensity: 1.0 },
};
