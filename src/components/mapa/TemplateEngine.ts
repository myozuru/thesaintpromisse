/**
 * TemplateEngine — Fase 11.
 *
 * Templates de áreas de efeito (AoE) estilo D&D 5e:
 *  - circle  : raio (a partir do centro)
 *  - cone    : apex + direção, cone D&D 5e (ângulo apex ≈ 53.13°, length = width at end)
 *  - line    : origem → destino, espessura configurável
 *  - square  : meio-lado (centro = origem)
 *
 * As medidas são armazenadas em coords-mundo (pixels). Conversão para
 * "células" usa gridConfig.dpi para exibir labels.
 */
import type { GridConfig, Vector2 } from '@/stores/useMapStore';

export type TemplateKind = 'circle' | 'cone' | 'cone_attached' | 'line' | 'square';

export interface MapTemplate {
  id: string;
  kind: TemplateKind;
  /** centro/origem em coords-mundo. */
  x: number;
  y: number;
  /** ângulo (rad) — usado por cone/line. */
  rotation: number;
  /** comprimento principal em coords-mundo (raio p/ circle; length p/ cone/line; meia-lateral p/ square). */
  length: number;
  /** largura em coords-mundo — só p/ line. */
  width: number;
  color: string;
  opacity: number;
  /** Marca opcional: zona persistente (dano/condição contínua) gerada por feitiço. */
  persistent?: PersistentZoneState;
}

/** Estado runtime da zona persistente, anexado a um MapTemplate. */
export interface PersistentZoneState {
  ownerCharId: string;
  ownerCharName: string;
  sourceLabel: string;
  /** Turnos restantes (decrementa 1 por rodada completa). 0 = expirar. */
  remainingTurns: number;
  /** Snapshot da config no momento do lançamento. */
  config: import('@/types/conditions').PersistentAreaConfig;
  /** Dano por tick (XdY + mod) — null se efeito apenas condição. */
  damage: { numDice: number; dieSize: number; mod: number; type: import('@/types').DamageType | string } | null;
  /** Condição por tick — null se efeito apenas dano. */
  condition: {
    conditionId: string;
    name: string;
    icon: string;
    durationMode: import('@/types/conditions').ConditionDurationMode;
    endCD?: number;
    endTrType?: string;
    turns: number;
  } | null;
  /** CD/TR do TR contra a área (modo `uma_vez`/`todo_round`). */
  zoneCD: number;
  zoneTRType: string;
  /** Presença/imunidade/residual por entidade do mapa (entityId). */
  affected: Record<string, {
    immune?: boolean;            // passou TR (modos uma_vez/todo_round)
    immuneRound?: number;        // rodada em que se tornou imune (todo_round reseta a cada rodada)
    checkedOnce?: boolean;       // uma_vez: a primeira rolagem já aconteceu, mesmo se falhou
    failedRound?: number;        // todo_round: evita repetir o TR na mesma rodada após falha
    lastEntryId?: string;        // ID do movimento confirmado já processado
    lastTriggerKey?: string;     // impede duplicar o mesmo tick/turno
    lastInsideRound?: number;    // última rodada em que esteve dentro
    residualLeft?: number;       // turnos residuais ainda devidos após sair
  }>;
}

export interface PersistentRuler {
  id: string;
  a: Vector2;
  b: Vector2;
  color: string;
}

/** ângulo de meio-cone (rad) p/ cone 5e onde width-no-fim = length. */
const CONE_HALF = Math.atan(0.5); // ≈ 26.565°

function withAlpha(color: string, alpha: number): string {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

export const TemplateEngine = {
  /** Desenha um único template no contexto já transformado (mundo). */
  draw(ctx: CanvasRenderingContext2D, t: MapTemplate, scale: number) {
    const fill = withAlpha(t.color, 0.25 * t.opacity);
    const stroke = withAlpha(t.color, 0.95 * t.opacity);
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2 / scale;

    if (t.kind === 'circle') {
      ctx.beginPath();
      ctx.arc(t.x, t.y, Math.max(1, t.length), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (t.kind === 'square') {
      const s = Math.max(1, t.length);
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rotation);
      ctx.beginPath();
      ctx.rect(-s, -s, s * 2, s * 2);
      ctx.moveTo(0, -s);
      ctx.lineTo(0, s);
      ctx.fill();
      ctx.stroke();
      // linha central (eixo de rotação) — visualiza a rotação do cubo
      ctx.beginPath();
      ctx.setLineDash([6 / scale, 4 / scale]);
      ctx.moveTo(-s, 0);
      ctx.lineTo(s, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    } else if (t.kind === 'cone') {
      const L = Math.max(1, t.length);
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rotation);
      // Centraliza o cone no pino (como o cubo): apex em -L/2, base em +L/2.
      ctx.translate(-L / 2, 0);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const dx = L * Math.cos(CONE_HALF);
      const dy = L * Math.sin(CONE_HALF);
      ctx.lineTo(dx, -dy);
      ctx.lineTo(dx, dy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // linha central (eixo) — visualiza a rotação do triângulo
      ctx.beginPath();
      ctx.setLineDash([6 / scale, 4 / scale]);
      ctx.moveTo(0, 0);
      ctx.lineTo(L, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    } else if (t.kind === 'line') {
      const L = Math.max(1, t.length);
      const W = Math.max(1, t.width);
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rotation);
      ctx.beginPath();
      ctx.rect(0, -W / 2, L, W);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (t.kind === 'cone_attached') {
      // Cone com apex no ponto âncora (caster), expandindo na direção da rotação.
      const L = Math.max(1, t.length);
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rotation);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const dx = L * Math.cos(CONE_HALF);
      const dy = L * Math.sin(CONE_HALF);
      ctx.lineTo(dx, -dy);
      ctx.lineTo(dx, dy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // pino do centro/origem
    ctx.fillStyle = stroke;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 3 / scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /** Label com o tamanho em células do template. */
  label(t: MapTemplate, cfg: GridConfig): string {
    const dpi = cfg.dpi || 1;
    const mpc = cfg.metersPerCell || 1.5;
    const toM = (px: number) => ((px / dpi) * mpc).toFixed(1);
    if (t.kind === 'circle') return `${toM(t.length)}m raio`;
    if (t.kind === 'square') return `${toM(t.length * 2)}m lado`;
    if (t.kind === 'cone') return `${toM(t.length)}m cone`;
    if (t.kind === 'cone_attached') return `${toM(t.length)}m cone`;
    return `${toM(t.length)}×${toM(t.width)}m`;
  },


  /** Desenha label flutuante perto do template (no mundo). */
  drawLabel(
    ctx: CanvasRenderingContext2D,
    t: MapTemplate,
    cfg: GridConfig,
    scale: number,
  ) {
    const text = this.label(t, cfg);
    const fontPx = 12;
    ctx.save();
    ctx.font = `600 ${fontPx / scale}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const m = ctx.measureText(text);
    const padX = 5 / scale;
    const padY = 2 / scale;
    const tw = m.width;
    const th = fontPx / scale;
    let lx = t.x;
    let ly = t.y - 10 / scale;
    if (t.kind === 'circle') ly = t.y - t.length - 12 / scale;
    if (t.kind === 'square') ly = t.y - t.length - 12 / scale;
    if (t.kind === 'cone' || t.kind === 'cone_attached') {
      lx = t.x + (t.length / 2) * Math.cos(t.rotation);
      ly = t.y + (t.length / 2) * Math.sin(t.rotation);
    }
    if (t.kind === 'line') {
      lx = t.x + (t.length / 2) * Math.cos(t.rotation);
      ly = t.y + (t.length / 2) * Math.sin(t.rotation);
    }
    ctx.fillStyle = 'rgba(20,20,30,0.85)';
    ctx.strokeStyle = withAlpha(t.color, 0.9);
    ctx.lineWidth = 1 / scale;
    const rx = lx - tw / 2 - padX;
    const ry = ly - th / 2 - padY;
    const rw = tw + padX * 2;
    const rh = th + padY * 2;
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = withAlpha(t.color, 1);
    ctx.fillText(text, lx, ly);
    ctx.restore();
  },

  /** Hit-test simples (ponto dentro do template). Para remover via clique. */
  hitTest(p: Vector2, t: MapTemplate): boolean {
    if (t.kind === 'circle') {
      return Math.hypot(p.x - t.x, p.y - t.y) <= t.length;
    }
    // square/cone/line: rotaciona o ponto para o frame local
    const dx = p.x - t.x;
    const dy = p.y - t.y;
    const cos = Math.cos(-t.rotation);
    const sin = Math.sin(-t.rotation);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    if (t.kind === 'square') {
      return Math.abs(lx) <= t.length && Math.abs(ly) <= t.length;
    }
    if (t.kind === 'line') {
      return lx >= 0 && lx <= t.length && Math.abs(ly) <= t.width / 2;
    }
    if (t.kind === 'cone') {
      // cone centralizado: apex em -L/2, base em +L/2 (no frame local).
      const apexX = -t.length / 2;
      const lxFromApex = lx - apexX;
      if (lxFromApex < 0 || lxFromApex > t.length * Math.cos(CONE_HALF)) return false;
      return Math.abs(ly) <= lxFromApex * Math.tan(CONE_HALF);
    }
    if (t.kind === 'cone_attached') {
      // apex em (0,0) no frame local, base em +L.
      if (lx < 0 || lx > t.length * Math.cos(CONE_HALF)) return false;
      return Math.abs(ly) <= lx * Math.tan(CONE_HALF);
    }
    return false;
  },

  /** Constrói um template a partir do drag inicial → atual. */
  fromDrag(
    kind: TemplateKind,
    origin: Vector2,
    current: Vector2,
    opts: { color: string; opacity: number; widthCells: number; dpi: number },
  ): MapTemplate {
    const id = `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const dx = current.x - origin.x;
    const dy = current.y - origin.y;
    const dist = Math.hypot(dx, dy);
    const rot = Math.atan2(dy, dx);
    const width = Math.max(opts.dpi * 0.25, opts.widthCells * opts.dpi);
    let length = dist;
    if (kind === 'square') {
      // meia-lateral = max(|dx|,|dy|), arredondado a meia-célula
      length = Math.max(Math.abs(dx), Math.abs(dy));
    }
    return {
      id,
      kind,
      x: origin.x,
      y: origin.y,
      rotation: rot,
      length,
      width,
      color: opts.color,
      opacity: opts.opacity,
    };
  },
};
