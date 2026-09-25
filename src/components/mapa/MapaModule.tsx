/**
 * MapaModule — Etapas 1+2+3.
 *
 * Etapa 1: viewport infinito (pan/zoom, 3 canvases, rAF).
 * Etapa 2: motor paramétrico de grade + UI.
 * Etapa 3: Entidades (RECT/ELLIPSE) com seleção, drag, resize (8 handles)
 *          e rotação via handle. Hit-test OBB. Snap respeitado no drag
 *          e no resize (centro vai pra âncora) salvo bypass com Ctrl/Cmd.
 *
 * Interações:
 *   - Pan: middle mouse ou Space+esquerdo.
 *   - Zoom: scroll.
 *   - LMB em vazio + arrastar: marquee (na real, só clique-deseleciona aqui).
 *   - LMB em entidade: seleciona; arrasta = move; Shift = adiciona à seleção.
 *   - LMB em handle: resize / rotate.
 *   - Duplo-clique no vazio: cria entidade nova.
 *   - Delete: remove selecionadas.
 *   - Ctrl/Cmd: bypass de snap.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useMapStore,
  type GridType,
  type LineType,
  type Entity,
} from '@/stores/useMapStore';

import { GridEngine, screenToWorld, visibleBBox } from './GridEngine';
import {
  hitTest,
  pickHandle,
  resizeFromHandle,
  drawEntity,
  drawSelection,
  drawNameplate,
  worldToLocal,
  entitiesInRect,
  type HandleKind,
} from './EntityEngine';
function normalizeRect(ax: number, ay: number, bx: number, by: number) {
  const x = Math.min(ax, bx); const y = Math.min(ay, by);
  return { x, y, w: Math.abs(bx - ax), h: Math.abs(by - ay) };
}
import { MeasureEngine } from './MeasureEngine';
import { DrawEngine } from './DrawEngine';
import { TemplateEngine, type MapTemplate } from './TemplateEngine';
import { LightingEngine, collectLights, LIGHT_PRESETS } from './LightingEngine';
import { WallsEngine, type WallKind } from './WallsEngine';
import { computeVisibilityPolygon, pathPolygon } from './VisionEngine';
import {
  groupBBox, pickGroupHandle,
  applyGroupResize, applyGroupRotate, drawGroupBox,
  align as alignEntities, distribute as distributeEntities,
  type GroupBBox, type GroupHandleKind,
} from './GroupEngine';

import { assetCache } from './assetCache';
import { assetDB } from './assetDB';

import {
  Image as ImageIcon, Trash2,
} from 'lucide-react';
import { ToolRail } from './ui/ToolRail';
import { MapTopBar } from './ui/MapTopBar';
import { PartyPanel } from './ui/PartyPanel';
import { PlayerActionBar } from './ui/PlayerActionBar';
import { ToolSettingsPanel } from './ui/ToolSettingsPanel';
import { AssetTypeDialog, type AssetKind } from './ui/AssetTypeDialog';
import { NotesOverlay } from './ui/NotesOverlay';
import { SelectionToolbar } from './ui/SelectionToolbar';
import { PendingMoveOverlay } from './ui/PendingMoveOverlay';
import { OpportunityPromptOverlay } from './ui/OpportunityPromptOverlay';
import { PendingAoEOverlay } from './ui/PendingAoEOverlay';
import { LootOverlay } from './ui/LootOverlay';
import { ChestOverlay } from './ui/ChestOverlay';
import { useRoleStore } from '@/stores/useRoleStore';
import { useFogStore } from '@/stores/fogStore';
import { buildSegments as buildFogSegments } from '@/lib/fog/visibility';
import { useProfileStore } from '@/stores/useProfileStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { MapContextMenu, type CtxMenuAction } from './ui/MapContextMenu';
import { LayerPanel } from './ui/LayerPanel';
import { InitiativePanel } from './ui/InitiativePanel';
import { DicePanel } from './ui/DicePanel';
import { ShortcutsHelp } from './ui/ShortcutsHelp';
import { WelcomeTutorial, useWelcomeTutorial } from './ui/WelcomeTutorial';
import { FogCanvas } from '@/components/fog/FogCanvas';
import { FogToolbar } from '@/components/fog/FogToolbar';
import { LightSettings } from '@/components/fog/LightSettings';
import { CombatBar } from '@/components/combat/CombatBar';
import { useDiceStore } from '@/stores/useDiceStore';
import type { Character } from '@/types';
import { getSocket } from '@/lib/socket';
import { holdLocalMapSync } from './mapSyncGuards';
import { effectiveMovement } from '@/lib/movementBudget';
import { isFreeformFor } from '@/lib/freeformMode';
import { toast } from '@/hooks/use-toast';

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const ZOOM_STEP = 1.1;
const isRotatableAoEKind = (kind: MapTemplate['kind']) => kind === 'square' || kind === 'cone' || kind === 'cone_attached' || kind === 'line';

export const snapBypassRef = { current: false };

type DragMode =
  | { kind: 'none' }
  | { kind: 'pan' }
  | { kind: 'move'; ids: string[]; primaryId: string; startWorld: { x: number; y: number }; origs: Record<string, { x: number; y: number }>; historyPushed?: boolean; resolved?: { dx: number; dy: number }; blockers?: MapCollisionCache; combat?: CombatMoveMeta }
  | { kind: 'resize'; id: string; handle: HandleKind; orig: Entity }
  | { kind: 'rotate'; id: string; orig: Entity; startAngle: number }
  | { kind: 'group-resize'; ids: string[]; handle: GroupHandleKind; bbox: GroupBBox; origs: Entity[] }
  | { kind: 'group-rotate'; ids: string[]; pivot: { x: number; y: number }; origs: Entity[]; startAngle: number }
  
  | { kind: 'measure'; startWorld: { x: number; y: number }; currentWorld: { x: number; y: number } }
  | { kind: 'draw'; strokeId: string; points: { x: number; y: number }[]; color: string; size: number }
  | { kind: 'erase'; lastWorld: { x: number; y: number }; radius: number }
  | { kind: 'template'; preview: MapTemplate; startWorld: { x: number; y: number } }
  | { kind: 'wall'; wallKind: WallKind; wallShape: 'line' | 'rect' | 'ellipse' | 'polygon'; startWorld: { x: number; y: number }; currentWorld: { x: number; y: number }; polyPoints?: { x: number; y: number }[] }
  | { kind: 'marquee'; startWorld: { x: number; y: number }; currentWorld: { x: number; y: number }; additive: boolean; baseSelection: string[] };

type CombatMoveMeta = {
  charId: string;
  budgetM: number;
  usedBeforeM: number;
  metersPerPx: number;
  startPrim: { x: number; y: number };
  lastPrim: { x: number; y: number };
  trail: { x: number; y: number }[];
  movedPx: number;
};

/** Clipboard volátil (sobrevive entre mounts da página mas não entre reloads). */
const clipboardRef: { current: Entity[] } = { current: [] };

type NameplateCharacterStats = { hp: number; hpMax: number; pe: number; peMax: number };

type MapCollisionPoint = { x: number; y: number };
type MapCollisionSegment = [MapCollisionPoint, MapCollisionPoint];
type MapCollisionToken = { origin: MapCollisionPoint; entity: Entity };
type MapCollisionBounds = { minX: number; minY: number; maxX: number; maxY: number };
type MapCollisionBlocker = { segment: MapCollisionSegment; bounds: MapCollisionBounds };
type MapCollisionCache = { blockers: MapCollisionBlocker[]; cellSize: number; cells: Map<string, number[]> };

const COLLISION_TOUCH_EPS = 0.05;
const COLLISION_TIME_EPS = 1e-5;
// Antes era 0.015, o que abria buracos nas quinas (onde duas paredes se encontram),
// permitindo que tokens atravessassem cantos. Mantemos só o eps numérico mínimo.
const COLLISION_ENDPOINT_EPS = 1e-6;
const COLLISION_BROADPHASE_PAD = 2;
const COLLISION_MAX_SUBSTEP = 28;
const COLLISION_SPATIAL_CELL = 192;

const tokenCenterAt = (token: MapCollisionToken, dx: number, dy: number): MapCollisionPoint => ({
  x: token.origin.x + dx,
  y: token.origin.y + dy,
});

const tokenLocalToWorld = (
  token: MapCollisionToken,
  dx: number,
  dy: number,
  lx: number,
  ly: number,
): MapCollisionPoint => {
  const c = Math.cos(token.entity.rotation);
  const s = Math.sin(token.entity.rotation);
  const center = tokenCenterAt(token, dx, dy);
  return { x: center.x + lx * c - ly * s, y: center.y + lx * s + ly * c };
};

const worldToTokenLocalAt = (
  p: MapCollisionPoint,
  token: MapCollisionToken,
  dx: number,
  dy: number,
): MapCollisionPoint => {
  const center = tokenCenterAt(token, dx, dy);
  const px = p.x - center.x;
  const py = p.y - center.y;
  const c = Math.cos(-token.entity.rotation);
  const s = Math.sin(-token.entity.rotation);
  return { x: px * c - py * s, y: px * s + py * c };
};

const tokenFootprintPoints = (token: MapCollisionToken, dx: number, dy: number): MapCollisionPoint[] => {
  const hw = token.entity.w / 2;
  const hh = token.entity.h / 2;
  const points: MapCollisionPoint[] = [];
  if (token.entity.shape === 'ELLIPSE') {
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const a = (Math.PI * 2 * i) / steps;
      points.push(tokenLocalToWorld(token, dx, dy, Math.cos(a) * hw, Math.sin(a) * hh));
    }
    return points;
  }

  const perEdge = 4;
  for (let i = 0; i <= perEdge; i++) {
    const t = -hw + (2 * hw * i) / perEdge;
    points.push(tokenLocalToWorld(token, dx, dy, t, -hh));
    points.push(tokenLocalToWorld(token, dx, dy, t, hh));
  }
  for (let i = 1; i < perEdge; i++) {
    const t = -hh + (2 * hh * i) / perEdge;
    points.push(tokenLocalToWorld(token, dx, dy, -hw, t));
    points.push(tokenLocalToWorld(token, dx, dy, hw, t));
  }
  return points;
};

const tokenFootprintSegments = (token: MapCollisionToken, dx: number, dy: number): MapCollisionSegment[] => {
  const hw = token.entity.w / 2;
  const hh = token.entity.h / 2;
  if (token.entity.shape === 'ELLIPSE') {
    const pts = tokenFootprintPoints(token, dx, dy);
    return pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
  }
  const corners = [
    tokenLocalToWorld(token, dx, dy, -hw, -hh),
    tokenLocalToWorld(token, dx, dy, hw, -hh),
    tokenLocalToWorld(token, dx, dy, hw, hh),
    tokenLocalToWorld(token, dx, dy, -hw, hh),
  ];
  return corners.map((p, i) => [p, corners[(i + 1) % corners.length]]);
};

const pointInsideTokenFootprint = (
  p: MapCollisionPoint,
  token: MapCollisionToken,
  dx: number,
  dy: number,
): boolean => {
  const lp = worldToTokenLocalAt(p, token, dx, dy);
  const hw = Math.max(0, token.entity.w / 2 - COLLISION_TOUCH_EPS);
  const hh = Math.max(0, token.entity.h / 2 - COLLISION_TOUCH_EPS);
  if (token.entity.shape === 'ELLIPSE') {
    if (hw <= 0 || hh <= 0) return false;
    const nx = lp.x / hw;
    const ny = lp.y / hh;
    return nx * nx + ny * ny < 1;
  }
  return Math.abs(lp.x) < hw && Math.abs(lp.y) < hh;
};

const segmentIntersectionParams = (
  a: MapCollisionPoint,
  b: MapCollisionPoint,
  c: MapCollisionPoint,
  d: MapCollisionPoint,
): { t: number; u: number } | null => {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denom;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denom;
  if (t < -1e-7 || t > 1 + 1e-7 || u < -1e-7 || u > 1 + 1e-7) return null;
  return { t: Math.max(0, Math.min(1, t)), u: Math.max(0, Math.min(1, u)) };
};

const segmentIntersectionT = (
  a: MapCollisionPoint,
  b: MapCollisionPoint,
  c: MapCollisionPoint,
  d: MapCollisionPoint,
): number | null => {
  return segmentIntersectionParams(a, b, c, d)?.t ?? null;
};

const boundsOverlap = (a: MapCollisionBounds, b: MapCollisionBounds): boolean =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

const segmentBounds = ([a, b]: MapCollisionSegment, pad = 0): MapCollisionBounds => ({
  minX: Math.min(a.x, b.x) - pad,
  minY: Math.min(a.y, b.y) - pad,
  maxX: Math.max(a.x, b.x) + pad,
  maxY: Math.max(a.y, b.y) + pad,
});

const prepareCollisionCache = (segments: MapCollisionSegment[]): MapCollisionCache => {
  const blockers = segments.map((segment) => ({ segment, bounds: segmentBounds(segment, COLLISION_BROADPHASE_PAD) }));
  const cells = new Map<string, number[]>();
  for (let i = 0; i < blockers.length; i++) {
    const b = blockers[i].bounds;
    const minX = Math.floor(b.minX / COLLISION_SPATIAL_CELL);
    const maxX = Math.floor(b.maxX / COLLISION_SPATIAL_CELL);
    const minY = Math.floor(b.minY / COLLISION_SPATIAL_CELL);
    const maxY = Math.floor(b.maxY / COLLISION_SPATIAL_CELL);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const key = `${cx},${cy}`;
        const bucket = cells.get(key);
        if (bucket) bucket.push(i);
        else cells.set(key, [i]);
      }
    }
  }
  return { blockers, cellSize: COLLISION_SPATIAL_CELL, cells };
};

const tokenSweepBounds = (
  token: MapCollisionToken,
  fromDx: number,
  fromDy: number,
  moveDx: number,
  moveDy: number,
): MapCollisionBounds => {
  const start = tokenCenterAt(token, fromDx, fromDy);
  const end = { x: start.x + moveDx, y: start.y + moveDy };
  const radius = Math.hypot(token.entity.w, token.entity.h) / 2 + COLLISION_BROADPHASE_PAD;
  return {
    minX: Math.min(start.x, end.x) - radius,
    minY: Math.min(start.y, end.y) - radius,
    maxX: Math.max(start.x, end.x) + radius,
    maxY: Math.max(start.y, end.y) + radius,
  };
};

const filterBlockersForMove = (
  tokens: MapCollisionToken[],
  cache: MapCollisionCache,
  fromDx: number,
  fromDy: number,
  moveDx: number,
  moveDy: number,
): MapCollisionSegment[] => {
  const bounds = tokens.map((token) => tokenSweepBounds(token, fromDx, fromDy, moveDx, moveDy));
  const indices = new Set<number>();
  for (const b of bounds) {
    const minX = Math.floor(b.minX / cache.cellSize);
    const maxX = Math.floor(b.maxX / cache.cellSize);
    const minY = Math.floor(b.minY / cache.cellSize);
    const maxY = Math.floor(b.maxY / cache.cellSize);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const bucket = cache.cells.get(`${cx},${cy}`);
        if (bucket) for (const i of bucket) indices.add(i);
      }
    }
  }
  return Array.from(indices)
    .map((i) => cache.blockers[i])
    .filter((blocker) => bounds.some((tb) => boundsOverlap(tb, blocker.bounds)))
    .map((blocker) => blocker.segment);
};

const segmentsProperlyCross = (
  a: MapCollisionPoint,
  b: MapCollisionPoint,
  c: MapCollisionPoint,
  d: MapCollisionPoint,
): boolean => {
  const t = segmentIntersectionT(a, b, c, d);
  if (t === null || t < -COLLISION_TIME_EPS || t > 1 + COLLISION_TIME_EPS) return false;
  const u = segmentIntersectionT(c, d, a, b);
  return u !== null && u >= -COLLISION_TIME_EPS && u <= 1 + COLLISION_TIME_EPS;
};

const firstPointBlockerHit = (
  a: MapCollisionPoint,
  b: MapCollisionPoint,
  blockers: MapCollisionSegment[],
): { t: number; normal: MapCollisionPoint } | null => {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  if (Math.hypot(vx, vy) < 1e-9) return null;
  let best: { t: number; normal: MapCollisionPoint } | null = null;
  for (const [p, q] of blockers) {
    const hit = segmentIntersectionParams(a, b, p, q);
    if (!hit || hit.t <= COLLISION_TIME_EPS || hit.t > 1 + COLLISION_TIME_EPS) continue;
    const sx = q.x - p.x;
    const sy = q.y - p.y;
    const len = Math.hypot(sx, sy) || 1;
    let nx = -sy / len;
    let ny = sx / len;
    if (vx * nx + vy * ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    if (!best || hit.t < best.t) best = { t: hit.t, normal: { x: nx, y: ny } };
  }
  return best;
};

const localVectorToWorld = (token: MapCollisionToken, v: MapCollisionPoint): MapCollisionPoint => {
  const c = Math.cos(token.entity.rotation);
  const s = Math.sin(token.entity.rotation);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
};

const rectEntryHit = (
  start: MapCollisionPoint,
  end: MapCollisionPoint,
  hw: number,
  hh: number,
): { t: number; normal: MapCollisionPoint } | null => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const startsInside = Math.abs(start.x) < hw && Math.abs(start.y) < hh;
  if (startsInside) {
    const movingDeeper = start.x * dx / Math.max(1, hw * hw) + start.y * dy / Math.max(1, hh * hh) < -1e-6;
    if (!movingDeeper) return null;
    const len = Math.hypot(start.x, start.y) || 1;
    return { t: COLLISION_TIME_EPS, normal: { x: start.x / len, y: start.y / len } };
  }
  let tEnter = -Infinity;
  let tExit = Infinity;
  let normal: MapCollisionPoint = { x: 0, y: 0 };

  const applyAxis = (pos: number, delta: number, min: number, max: number, axis: 'x' | 'y') => {
    if (Math.abs(delta) < 1e-9) return pos >= min && pos <= max;
    const enter = delta > 0 ? (min - pos) / delta : (max - pos) / delta;
    const exit = delta > 0 ? (max - pos) / delta : (min - pos) / delta;
    if (enter > tEnter) {
      tEnter = enter;
      normal = axis === 'x'
        ? { x: delta > 0 ? -1 : 1, y: 0 }
        : { x: 0, y: delta > 0 ? -1 : 1 };
    }
    tExit = Math.min(tExit, exit);
    return true;
  };

  if (!applyAxis(start.x, dx, -hw, hw, 'x')) return null;
  if (!applyAxis(start.y, dy, -hh, hh, 'y')) return null;
  if (tEnter > tExit || tExit < COLLISION_TIME_EPS || tEnter <= COLLISION_TIME_EPS || tEnter > 1 + COLLISION_TIME_EPS) return null;
  return { t: Math.max(0, Math.min(1, tEnter)), normal };
};

const ellipseEntryHit = (
  start: MapCollisionPoint,
  end: MapCollisionPoint,
  hw: number,
  hh: number,
): { t: number; normal: MapCollisionPoint } | null => {
  if (hw <= 0 || hh <= 0) return null;
  const sx = start.x / hw;
  const sy = start.y / hh;
  const dx = (end.x - start.x) / hw;
  const dy = (end.y - start.y) / hh;
  if (sx * sx + sy * sy < 1) {
    if (sx * dx + sy * dy >= -1e-6) return null;
    const nLen = Math.hypot(start.x / (hw * hw), start.y / (hh * hh)) || 1;
    return { t: COLLISION_TIME_EPS, normal: { x: (start.x / (hw * hw)) / nLen, y: (start.y / (hh * hh)) / nLen } };
  }
  const a = dx * dx + dy * dy;
  const b = 2 * (sx * dx + sy * dy);
  const c = sx * sx + sy * sy - 1;
  const disc = b * b - 4 * a * c;
  if (a < 1e-9 || disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t <= COLLISION_TIME_EPS || t > 1 + COLLISION_TIME_EPS) return null;
  const px = start.x + (end.x - start.x) * t;
  const py = start.y + (end.y - start.y) * t;
  const nLen = Math.hypot(px / (hw * hw), py / (hh * hh)) || 1;
  return { t: Math.max(0, Math.min(1, t)), normal: { x: (px / (hw * hw)) / nLen, y: (py / (hh * hh)) / nLen } };
};

const placementBlocked = (
  tokens: MapCollisionToken[],
  blockers: MapCollisionSegment[],
  dx: number,
  dy: number,
): boolean => {
  for (const token of tokens) {
    const tokenSegments = tokenFootprintSegments(token, dx, dy);
    for (const [a, b] of blockers) {
      const insideA = pointInsideTokenFootprint(a, token, dx, dy);
      const insideB = pointInsideTokenFootprint(b, token, dx, dy);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (
        insideA ||
        pointInsideTokenFootprint(mid, token, dx, dy) ||
        insideB
      ) return true;
      if (insideA !== insideB) return true;
      if (tokenSegments.some(([p, q]) => segmentsProperlyCross(a, b, p, q))) return true;
    }
  }
  return false;
};

const firstFootprintHit = (
  tokens: MapCollisionToken[],
  blockers: MapCollisionSegment[],
  fromDx: number,
  fromDy: number,
  moveDx: number,
  moveDy: number,
): { t: number; normal: MapCollisionPoint } | null => {
  if (Math.hypot(moveDx, moveDy) < 1e-9) return null;
  let best: { t: number; normal: MapCollisionPoint } | null = null;
  for (const token of tokens) {
    const hw = token.entity.w / 2;
    const hh = token.entity.h / 2;
    const points = [tokenCenterAt(token, fromDx, fromDy), ...tokenFootprintPoints(token, fromDx, fromDy)];
    for (const p of points) {
      const hit = firstPointBlockerHit(p, { x: p.x + moveDx, y: p.y + moveDy }, blockers);
      if (hit && (!best || hit.t < best.t)) best = hit;
    }

    for (const [a, b] of blockers) {
      for (const p of [a, b]) {
        const start = worldToTokenLocalAt(p, token, fromDx, fromDy);
        const end = worldToTokenLocalAt(p, token, fromDx + moveDx, fromDy + moveDy);
        const hit = token.entity.shape === 'ELLIPSE'
          ? ellipseEntryHit(start, end, hw, hh)
          : rectEntryHit(start, end, hw, hh);
        if (hit && (!best || hit.t < best.t)) {
          best = { t: hit.t, normal: localVectorToWorld(token, hit.normal) };
        }
      }
    }
  }
  return best;
};

const resolveCollisionMove = (
  tokens: MapCollisionToken[],
  blockers: MapCollisionCache,
  from: { dx: number; dy: number },
  desiredMove: { dx: number; dy: number },
): { dx: number; dy: number } => {
  let resolvedDx = from.dx;
  let resolvedDy = from.dy;
  const desiredLen = Math.hypot(desiredMove.dx, desiredMove.dy);
  const substeps = Math.min(8, Math.max(1, Math.ceil(desiredLen / COLLISION_MAX_SUBSTEP)));
  const stepDx = desiredMove.dx / substeps;
  const stepDy = desiredMove.dy / substeps;

  for (let step = 0; step < substeps; step++) {
    let moveDx = stepDx;
    let moveDy = stepDy;

    for (let i = 0; i < 3 && Math.hypot(moveDx, moveDy) > 0.001; i++) {
      const nearbyBlockers = filterBlockersForMove(tokens, blockers, resolvedDx, resolvedDy, moveDx, moveDy);
      if (!nearbyBlockers.length) {
        const ndx = resolvedDx + moveDx;
        const ndy = resolvedDy + moveDy;
        if (placementBlocked(tokens, blockers.blockers.map((blocker) => blocker.segment), ndx, ndy)) {
          return { dx: resolvedDx, dy: resolvedDy };
        }
        resolvedDx = ndx;
        resolvedDy = ndy;
        break;
      }

      const hit = firstFootprintHit(tokens, nearbyBlockers, resolvedDx, resolvedDy, moveDx, moveDy);
      if (!hit) {
        const ndx = resolvedDx + moveDx;
        const ndy = resolvedDy + moveDy;
        if (!placementBlocked(tokens, nearbyBlockers, ndx, ndy)) {
          resolvedDx = ndx;
          resolvedDy = ndy;
          break;
        }
        return { dx: resolvedDx, dy: resolvedDy };
      }

      const safeT = hit ? Math.max(0, hit.t - 0.0001) : 0;
      resolvedDx += moveDx * safeT;
      resolvedDy += moveDy * safeT;

      if (!hit) break;
      const restDx = moveDx * (1 - hit.t);
      const restDy = moveDy * (1 - hit.t);
      const into = restDx * hit.normal.x + restDy * hit.normal.y;
      if (into >= 0) return { dx: resolvedDx, dy: resolvedDy };
      moveDx = restDx - hit.normal.x * into;
      moveDy = restDy - hit.normal.y * into;
      const probeDx = resolvedDx + moveDx;
      const probeDy = resolvedDy + moveDy;
      if (placementBlocked(tokens, nearbyBlockers, probeDx, probeDy)) return { dx: resolvedDx, dy: resolvedDy };
    }
  }

  return { dx: resolvedDx, dy: resolvedDy };
};

const isPlayerVisibleCharacter = (c: Character) =>
  c.category === 'PLAYER' && c.createdBy !== 'MASTER' && !c.hiddenFromPlayers;

const findProfileCharacter = (characters: Character[], profileId: string | null): Character | null => {
  const visiblePlayers = characters.filter(isPlayerVisibleCharacter);
  if (profileId) {
    const exact = visiblePlayers.filter((c) => c.profileId === profileId);
    if (exact.length === 1) return exact[0];
    if (visiblePlayers.length === 1) return visiblePlayers[0];
    const legacy = visiblePlayers.filter((c) => !c.profileId);
    if (legacy.length === 1) return legacy[0];
    return null;
  }
  return visiblePlayers.length === 1 ? visiblePlayers[0] : null;
};

const MOVEMENT_EPS_M = 0.05;

type EntityPatchMessage = Array<{ id: string; patch: Partial<Entity> }>;

const sendEntityPatches = (patches: EntityPatchMessage) => {
  if (!patches.length) return;
  try {
    const w = window as unknown as {
      __worldBus?: { send: (a: unknown) => void };
      __worldBusClientId?: string;
    };
    const payload = { clientId: w.__worldBusClientId, patches };
    w.__worldBus?.send({ type: 'broadcast', event: 'entity-patch', payload });
    getSocket()?.emit('entity:patch', payload);
  } catch { /* ignore */ }
};

const playerOwnsEntity = (entity: Entity, profileId: string | null, characters: Character[]): boolean => {
  if (!profileId) return false;
  // Posse real do token/imagem enviada pelo player.
  if (entity.ownerProfileId === profileId) return true;
  // Avatar marcado como "Sou eu" também conta como controlável.
  if (entity.avatarProfileId === profileId) return true;
  // Token vinculado manualmente à ficha do perfil ativo também é controlável.
  if (entity.characterId) {
    const linked = characters.find((c) => c.id === entity.characterId);
    if (linked?.profileId === profileId) return true;
    const legacyPlayers = characters.filter((c) => isPlayerVisibleCharacter(c) && !c.profileId);
    if (linked && isPlayerVisibleCharacter(linked) && !linked.profileId && legacyPlayers.length === 1) return true;
  }
  // Compatibilidade: imagens antigas podem ter perdido ownerProfileId quando
  // "Sou eu" limpava a marcação dos outros uploads do player.
  return !!entity.assetId && !entity.ownerProfileId && !entity.characterId && (entity.layer ?? 'tokens') === 'tokens';
};

const canPlayerEditEntityNow = (entity: Entity): boolean => {
  if (useRoleStore.getState().role !== 'PLAYER') return true;
  return playerOwnsEntity(
    entity,
    useProfileStore.getState().activeProfileId,
    useCharacterStore.getState().characters,
  );
};

const canStartMoveEntityNow = (entity: Entity): boolean => {
  const mapState = useMapStore.getState();
  const samePending = !!mapState.pendingMove && mapState.pendingMove.entityId === entity.id;
  // Permite continuar o movimento pendente do MESMO token; bloqueia outros.
  if (mapState.pendingMove && !samePending) return false;

  // Token com ficha de HP <= 0 (caído) não pode se mover por si só.
  if (entity.characterId) {
    const ch = useCharacterStore.getState().characters.find((c) => c.id === entity.characterId);
    if (ch && (ch.hpCurrent ?? 0) <= 0) return false;
  }

  if (useRoleStore.getState().role !== 'PLAYER') return true;

  const characters = useCharacterStore.getState().characters;
  const activeProfileId = useProfileStore.getState().activeProfileId;
  if (!playerOwnsEntity(entity, activeProfileId, characters)) return false;

  const combat = useCombatStore.getState();
  if (!combat.inCombat) return true;
  // Entidades sem ficha vinculada (imagens/objetos enviados pelo player) são
  // movíveis livremente mesmo em combate — não consomem orçamento de movimento.
  if (!entity.characterId) return true;
  if (combat.initiativeOrder[combat.currentTurnIndex]?.charId !== entity.characterId) return false;

  // Se já existe um pendingMove para esse token, permite retomar mesmo
  // sem orçamento restante (o jogador pode arrastar de volta para reduzir).
  if (samePending) return true;

  const character = characters.find((c) => c.id === entity.characterId);
  if (isFreeformFor(character, combat.freeformMode)) return true;
  const budgetM = effectiveMovement(character);
  const usedM = combat.movementUsedByChar[entity.characterId] ?? 0;
  return budgetM - usedM > MOVEMENT_EPS_M;
};



const toNameplateStats = (c: Character): NameplateCharacterStats => ({
  hp: c.hpCurrent,
  hpMax: c.hpMax,
  pe: c.peCurrent,
  peMax: c.peMax,
});

const resolveEntityNameplateStats = (
  entity: Entity,
  characters: Character[],
  byId: Record<string, NameplateCharacterStats>,
): NameplateCharacterStats | undefined => {
  if (entity.characterId) return byId[entity.characterId];

  const profileId = entity.avatarProfileId ?? entity.ownerProfileId;
  if (!profileId) return undefined;

  const linkedPlayers = characters.filter((c) => isPlayerVisibleCharacter(c) && c.profileId === profileId);
  if (linkedPlayers.length !== 1) return undefined;

  return byId[linkedPlayers[0].id];
};


export function MapaModule() {
  const containerRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const tokenCanvasRef = useRef<HTMLCanvasElement>(null);
  const lightCanvasRef = useRef<HTMLCanvasElement>(null);
  

  const spaceDownRef = useRef(false);
  // Offset manual de rotação para AoE direcionados (cone/line),
  // controlado por Space + scroll do mouse. Resetado por pending.
  const aoeRotOffsetRef = useRef(0);
  const aoePendingIdRef = useRef<unknown>(null);


  const shiftDownRef = useRef(false);
  const panStateRef = useRef<{ lastX: number; lastY: number }>({ lastX: 0, lastY: 0 });
  const dragRef = useRef<DragMode>({ kind: 'none' });
  const mouseScreenRef = useRef<{ x: number; y: number } | null>(null);
  const mouseWorldRef = useRef<{ x: number; y: number } | null>(null);
  const entityDragMovedRef = useRef(false);
  const clickCountRef = useRef<{ id: string | null; count: number; t: number }>({ id: null, count: 0, t: 0 });
  const [selectionToolbarVisible, setSelectionToolbarVisible] = useState(false);
  const selectionToolbarVisibleRef = useRef(false);

  const gridConfig = useMapStore((s) => s.gridConfig);
  const setGridConfig = useMapStore((s) => s.setGridConfig);
  const cameraScale = useMapStore((s) => s.camera.scale);
  const immersive = useMapStore((s) => s.immersive);
  const setImmersive = useMapStore((s) => s.setImmersive);
  const partyCollapsed = useMapStore((s) => s.partyCollapsed);
  const setPartyCollapsed = useMapStore((s) => s.setPartyCollapsed);
  const activeTool = useMapStore((s) => s.activeTool);
  const setActiveTool = useMapStore((s) => s.setActiveTool);
  const shapeShape = useMapStore((s) => s.toolSettings.shape.shape);
  const shapeColor = useMapStore((s) => s.toolSettings.shape.color);
  
  const setToolSettings = useMapStore((s) => s.setToolSettings);

  const [gridOpen, setGridOpen] = useState(false);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const selectedIdsKey = useMapStore((s) => s.selectedIds.join(','));
  useEffect(() => { setSelectionToolbarVisible(false); selectionToolbarVisibleRef.current = false; }, [selectedIdsKey]);
  useEffect(() => { selectionToolbarVisibleRef.current = selectionToolbarVisible; }, [selectionToolbarVisible]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pendingAssets, setPendingAssets] = useState<Array<{
    assetId: string;
    name: string;
    previewUrl: string;
    dims: { w: number; h: number };
    world: { x: number; y: number };
  }>>([]);
  const tutorial = useWelcomeTutorial();
  // Refs sincronizados com o store para uso nos handlers DOM.
  const activeToolRef = useRef(activeTool);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  const drawSettings = useMapStore((s) => s.toolSettings.draw);
  const drawSettingsRef = useRef(drawSettings);
  useEffect(() => { drawSettingsRef.current = drawSettings; }, [drawSettings]);
  /** Pings ativos (transientes, não persistem). */
  const pingsRef = useRef<Array<{ x: number; y: number; color: string; start: number }>>([]);
  /** Emite um ping local + broadcast para os demais clientes. */
  const pushPing = (x: number, y: number, color: string) => {
    pingsRef.current.push({ x, y, color, start: performance.now() });
    const w = window as unknown as { __worldBus?: { send: (m: unknown) => unknown }; __worldBusClientId?: string };
    if (w.__worldBus && w.__worldBusClientId) {
      try { void w.__worldBus.send({ type: 'broadcast', event: 'ping', payload: { clientId: w.__worldBusClientId, x, y, color } }); } catch { /* ignore */ }
    }
  };
  const transientCommitRef = useRef(0);
  const withTransientCommitsPaused = useCallback((fn: () => void) => {
    transientCommitRef.current += 1;
    holdLocalMapSync(220);
    try {
      fn();
    } finally {
      window.setTimeout(() => {
        transientCommitRef.current = Math.max(0, transientCommitRef.current - 1);
      }, 160);
    }
  }, []);
  // Recebe pings remotos.
  useEffect(() => {
    const onRemote = (e: Event) => {
      const d = (e as CustomEvent).detail as { x: number; y: number; color?: string };
      if (typeof d?.x !== 'number' || typeof d?.y !== 'number') return;
      pingsRef.current.push({ x: d.x, y: d.y, color: d.color ?? '#fbbf24', start: performance.now() });
    };
    window.addEventListener('mapa:remote-ping', onRemote);
    return () => window.removeEventListener('mapa:remote-ping', onRemote);
  }, []);

  // Rastros de ponteiro (botão direito) de outros clientes.
  type RemoteRightPing = {
    color: string;
    world: { x: number; y: number };
    trail: Array<{ x: number; y: number; t: number }>;
    fading?: number;
  };
  const remoteRightPingsRef = useRef(new Map<string, RemoteRightPing>());
  useEffect(() => {
    const onTrail = (e: Event) => {
      const d = (e as CustomEvent).detail as { clientId?: string; x?: number; y?: number; color?: string; end?: boolean };
      if (!d || !d.clientId) return;
      const map = remoteRightPingsRef.current;
      let r = map.get(d.clientId);
      if (d.end) {
        if (r) r.fading = performance.now();
        return;
      }
      if (typeof d.x !== 'number' || typeof d.y !== 'number') return;
      const now = performance.now();
      if (!r) {
        r = { color: d.color || '#ff5577', world: { x: d.x, y: d.y }, trail: [{ x: d.x, y: d.y, t: now }] };
        map.set(d.clientId, r);
      } else {
        r.color = d.color || r.color;
        r.world = { x: d.x, y: d.y };
        r.trail.push({ x: d.x, y: d.y, t: now });
        if (r.trail.length > 256) r.trail.shift();
        r.fading = undefined;
      }
    };
    window.addEventListener('mapa:remote-pointer-trail', onTrail);
    return () => window.removeEventListener('mapa:remote-pointer-trail', onTrail);
  }, []);


  const rDownRef = useRef(false);
  /** Ponteiro "press-and-hold" com botão direito (rastro efêmero). */
  const rightPingRef = useRef<{
    active: boolean;
    moved: boolean;
    startScreen: { x: number; y: number };
    world: { x: number; y: number };
    color: string;
    trail: Array<{ x: number; y: number; t: number }>;
  } | null>(null);

  /** Estado do menu de contexto (clique-direito). */
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    world: { x: number; y: number };
    carry?: { mode: 'carry' | 'drop'; targetId: string; carrierId: string };
  } | null>(null);

  // ============ Render loop ============
  useEffect(() => {
    const bg = bgCanvasRef.current;
    const tk = tokenCanvasRef.current;
    const lt = lightCanvasRef.current;
    const container = containerRef.current;
    if (!bg || !tk || !lt || !container) return;

    const bgCtx = bg.getContext('2d')!;
    const tkCtx = tk.getContext('2d')!;
    const ltCtx = lt.getContext('2d')!;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      for (const c of [bg, tk, lt]) {
        c.width = Math.floor(w * dpr);
        c.height = Math.floor(h * dpr);
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let rafId = 0;
    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const state = useMapStore.getState();
      const { camera, gridConfig: cfg, entities, entityOrder, selectedIds } = state;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const bbox = visibleBBox(w, h, camera);

      // --- background: imagem (se houver) + grid ---
      bgCtx.setTransform(1, 0, 0, 1, 0, 0);
      bgCtx.clearRect(0, 0, bg.width, bg.height);
      bgCtx.save();
      bgCtx.scale(dpr, dpr);
      bgCtx.scale(camera.scale, camera.scale);
      bgCtx.translate(camera.x, camera.y);

      const bgImg = state.background;
      if (bgImg) {
        const cached = assetCache.get(bgImg.assetId);
        if (cached?.ready) {
          bgCtx.save();
          bgCtx.translate(bgImg.x, bgImg.y);
          if (bgImg.rotation) bgCtx.rotate(bgImg.rotation);
          bgCtx.globalAlpha = bgImg.opacity;
          bgCtx.drawImage(cached.img, -bgImg.w / 2, -bgImg.h / 2, bgImg.w, bgImg.h);
          bgCtx.restore();
        }
      }

      GridEngine.draw(bgCtx, bbox, cfg, camera.scale);
      bgCtx.restore();

      // --- token layer: entidades + seleção + snap preview ---
      tkCtx.setTransform(1, 0, 0, 1, 0, 0);
      tkCtx.clearRect(0, 0, tk.width, tk.height);
      tkCtx.save();
      tkCtx.scale(dpr, dpr);
      tkCtx.scale(camera.scale, camera.scale);
      tkCtx.translate(camera.x, camera.y);

      // strokes de desenho (abaixo das entidades)
      DrawEngine.drawAll(tkCtx, state.drawings);

      // templates persistentes (abaixo de tokens, acima de strokes)
      for (const t of state.templates) {
        TemplateEngine.draw(tkCtx, t, camera.scale);
        TemplateEngine.drawLabel(tkCtx, t, state.gridConfig, camera.scale);
      }

      // réguas persistentes
      for (const r of state.rulers) {
        MeasureEngine.draw(tkCtx, r.a, r.b, state.gridConfig, camera.scale);
      }

      // Rastro de movimento em combate (pending OU drag em andamento).
      const drawTrail = (
        pts: { x: number; y: number }[],
        color: string,
        meters: number,
        budgetM?: number,
      ) => {
        if (pts.length < 2) return;
        tkCtx.save();
        tkCtx.strokeStyle = color;
        tkCtx.lineWidth = 2 / camera.scale;
        tkCtx.setLineDash([8 / camera.scale, 6 / camera.scale]);
        tkCtx.beginPath();
        tkCtx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) tkCtx.lineTo(pts[i].x, pts[i].y);
        tkCtx.stroke();
        tkCtx.setLineDash([]);

        // Ponto inicial e final
        tkCtx.fillStyle = color;
        for (const p of [pts[0], pts[pts.length - 1]]) {
          tkCtx.beginPath();
          tkCtx.arc(p.x, p.y, 4 / camera.scale, 0, Math.PI * 2);
          tkCtx.fill();
        }

        // Label no meio do trajeto (similar à régua) com metros percorridos.
        // Calcula o ponto a 50% do comprimento total percorrido.
        let total = 0;
        for (let i = 1; i < pts.length; i++) {
          total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        }
        let mid = pts[Math.floor(pts.length / 2)];
        if (total > 0) {
          let acc = 0;
          for (let i = 1; i < pts.length; i++) {
            const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            if (acc + seg >= total / 2) {
              const t = (total / 2 - acc) / seg;
              mid = {
                x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
                y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
              };
              break;
            }
            acc += seg;
          }
        }

        const fmt = (m: number) => `${m.toFixed(m < 10 ? 1 : 0)}`;
        const text = budgetM !== undefined
          ? `${fmt(Math.min(meters, budgetM))} / ${fmt(budgetM)} m`
          : `${fmt(meters)} m`;

        const fontPx = 13;
        tkCtx.font = `600 ${fontPx / camera.scale}px ui-sans-serif, system-ui, sans-serif`;
        tkCtx.textAlign = 'center';
        tkCtx.textBaseline = 'middle';
        const padX = 6 / camera.scale;
        const padY = 3 / camera.scale;
        const tw = tkCtx.measureText(text).width;
        const th = fontPx / camera.scale;
        const rx = mid.x - tw / 2 - padX;
        const ry = mid.y - th / 2 - padY;
        const rw = tw + padX * 2;
        const rh = th + padY * 2;
        tkCtx.fillStyle = 'rgba(20,20,30,0.85)';
        tkCtx.strokeStyle = color;
        tkCtx.lineWidth = 1 / camera.scale;
        tkCtx.beginPath();
        const anyCtx = tkCtx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void };
        if (typeof anyCtx.roundRect === 'function') {
          anyCtx.roundRect(rx, ry, rw, rh, 4 / camera.scale);
        } else {
          tkCtx.rect(rx, ry, rw, rh);
        }
        tkCtx.fill();
        tkCtx.stroke();
        tkCtx.fillStyle = color;
        tkCtx.fillText(text, mid.x, mid.y);
        tkCtx.restore();
      };
      const liveDrag = dragRef.current;
      if (liveDrag.kind === 'move' && liveDrag.combat) {
        const cm = liveDrag.combat;
        const usedNow = cm.usedBeforeM + cm.movedPx * cm.metersPerPx;
        drawTrail(cm.trail, '#fcd34d', usedNow, cm.budgetM);
      }
      if (state.pendingMove && (liveDrag.kind !== 'move' || !liveDrag.combat)) {
        const pm = state.pendingMove;
        const cb2 = useCombatStore.getState();
        const ch2 = useCharacterStore.getState().characters.find((c) => c.id === pm.charId);
        const budgetM2 = isFreeformFor(ch2, cb2.freeformMode) ? Infinity : (ch2 ? effectiveMovement(ch2) : undefined);
        const committed = cb2.movementUsedByChar[pm.charId] ?? 0;
        const totalUsed = committed + pm.distM;
        drawTrail(pm.trail, '#fcd34d', totalUsed, budgetM2);
      }




      const { layerVisible } = state;
      const isMaster = useRoleStore.getState().role !== 'PLAYER';
      // ordem efetiva: agrupa por camada (map → tokens → gm).
      // Player: pula entidades ocultas. Mestre: inclui (renderiza translúcidas).
      const effectiveOrder: string[] = [];
      for (const lyr of ['map', 'tokens', 'gm'] as const) {
        if (!layerVisible[lyr]) continue;
        for (const id of entityOrder) {
          const en = entities[id];
          if (!en) continue;
          if (en.hidden && !isMaster) continue;
          if ((en.layer ?? 'tokens') !== lyr) continue;
          effectiveOrder.push(id);
        }
      }
      for (const id of effectiveOrder) {
        const e = entities[id];
        if (!e) continue;
        if (e.hidden) {
          tkCtx.save();
          tkCtx.globalAlpha = 0.35;
          drawEntity(tkCtx, e, camera.scale);
          tkCtx.restore();
        } else {
          drawEntity(tkCtx, e, camera.scale);
        }
      }
      const aoePreview = state.aoeTargetPreview;
      const aoeTargetIds = new Set(aoePreview?.entityIds ?? []);
      if (aoeTargetIds.size > 0) {
        for (const id of effectiveOrder) {
          if (!aoeTargetIds.has(id)) continue;
          const e = entities[id];
          if (!e || e.hidden) continue;
          tkCtx.save();
          tkCtx.translate(e.x, e.y);
          tkCtx.rotate(e.rotation);
          tkCtx.strokeStyle = 'rgba(250, 204, 21, 0.98)';
          tkCtx.fillStyle = 'rgba(250, 204, 21, 0.13)';
          tkCtx.lineWidth = 3 / camera.scale;
          tkCtx.setLineDash([10 / camera.scale, 5 / camera.scale]);
          if (e.shape === 'ELLIPSE') {
            tkCtx.beginPath();
            tkCtx.ellipse(0, 0, e.w / 2 + 5 / camera.scale, e.h / 2 + 5 / camera.scale, 0, 0, Math.PI * 2);
            tkCtx.fill();
            tkCtx.stroke();
          } else {
            tkCtx.beginPath();
            tkCtx.rect(-e.w / 2 - 5 / camera.scale, -e.h / 2 - 5 / camera.scale, e.w + 10 / camera.scale, e.h + 10 / camera.scale);
            tkCtx.fill();
            tkCtx.stroke();
          }
          tkCtx.setLineDash([]);
          tkCtx.restore();

          tkCtx.save();
          const b = { x: e.x - e.w / 2, y: e.y - e.h / 2 };
          const text = 'ACERTO';
          const fontPx = 11 / camera.scale;
          tkCtx.font = `800 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
          tkCtx.textAlign = 'center';
          tkCtx.textBaseline = 'middle';
          const padX = 5 / camera.scale;
          const padY = 2 / camera.scale;
          const tw = tkCtx.measureText(text).width;
          const cx = e.x;
          const cy = b.y - 10 / camera.scale;
          tkCtx.fillStyle = 'rgba(24, 18, 6, 0.92)';
          tkCtx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
          tkCtx.lineWidth = 1 / camera.scale;
          tkCtx.beginPath();
          tkCtx.rect(cx - tw / 2 - padX, cy - fontPx / 2 - padY, tw + padX * 2, fontPx + padY * 2);
          tkCtx.fill();
          tkCtx.stroke();
          tkCtx.fillStyle = 'rgb(254, 240, 138)';
          tkCtx.fillText(text, cx, cy);
          tkCtx.restore();
        }
      }
      if (aoePreview) {
        const t = state.templates.find((tpl) => tpl.id === aoePreview.templateId);
        if (t) {
          const text = aoeTargetIds.size > 0 ? `${aoeTargetIds.size} acerto(s)` : 'Nenhum acerto';
          const fontPx = 13 / camera.scale;
          const padX = 7 / camera.scale;
          const padY = 3 / camera.scale;
          const y = t.y + (t.kind === 'circle' || t.kind === 'square' ? t.length + 18 / camera.scale : 18 / camera.scale);
          tkCtx.save();
          tkCtx.font = `800 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
          tkCtx.textAlign = 'center';
          tkCtx.textBaseline = 'middle';
          const tw = tkCtx.measureText(text).width;
          tkCtx.fillStyle = aoeTargetIds.size > 0 ? 'rgba(24, 18, 6, 0.92)' : 'rgba(40, 12, 16, 0.92)';
          tkCtx.strokeStyle = aoeTargetIds.size > 0 ? 'rgba(250, 204, 21, 0.95)' : 'rgba(248, 113, 113, 0.95)';
          tkCtx.lineWidth = 1.25 / camera.scale;
          tkCtx.beginPath();
          tkCtx.rect(t.x - tw / 2 - padX, y - fontPx / 2 - padY, tw + padX * 2, fontPx + padY * 2);
          tkCtx.fill();
          tkCtx.stroke();
          tkCtx.fillStyle = aoeTargetIds.size > 0 ? 'rgb(254, 240, 138)' : 'rgb(254, 202, 202)';
          tkCtx.fillText(text, t.x, y);
          tkCtx.restore();
        }
      }
      // Nameplates / HP bars (após desenhar todas as entidades, antes da seleção)
      const charsById = (() => {
        const characters = useCharacterStore.getState().characters;
        const m: Record<string, NameplateCharacterStats> = {};
        for (const c of characters) m[c.id] = toNameplateStats(c);
        return { byId: m, characters };
      })();
      const activePid = useProfileStore.getState().activeProfileId;
      const viewerIsMaster = useRoleStore.getState().role !== 'PLAYER';
      // Helper: resolve o personagem ligado ao token (por characterId ou profileId).
      const charForEntity = (e: Entity): Character | undefined => {
        if (e.characterId) {
          const direct = charsById.characters.find((c) => c.id === e.characterId);
          if (direct) return direct;
        }
        const pid = e.avatarProfileId ?? e.ownerProfileId;
        if (!pid) return undefined;
        const players = charsById.characters.filter((c) => isPlayerVisibleCharacter(c) && c.profileId === pid);
        return players.length === 1 ? players[0] : undefined;
      };
      for (const id of effectiveOrder) {
        const e = entities[id];
        if (!e) continue;
        const forced = selectedIds.includes(id);
        const live = resolveEntityNameplateStats(e, charsById.characters, charsById.byId);
        const ownsEntity = playerOwnsEntity(e, activePid, charsById.characters);
        const hideStats = !viewerIsMaster && !ownsEntity;

        // Visual de Marcação: aura amarela + ícone 🔖 acima do token quando o
        // personagem ligado tem a condição 'marcado' ativa.
        const linkedChar = charForEntity(e);
        const isMarked = !!linkedChar?.activeConditions?.some((c: any) => c.conditionId === 'marcado');
        if (isMarked && !e.hidden) {
          tkCtx.save();
          const radius = Math.max(e.w, e.h) / 2 + 6 / camera.scale;
          tkCtx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
          tkCtx.lineWidth = 3 / camera.scale;
          tkCtx.shadowColor = 'rgba(250, 204, 21, 0.85)';
          tkCtx.shadowBlur = 10 / camera.scale;
          tkCtx.beginPath();
          tkCtx.arc(e.x, e.y, radius, 0, Math.PI * 2);
          tkCtx.stroke();
          tkCtx.shadowBlur = 0;
          const badgePx = 16 / camera.scale;
          tkCtx.font = `${badgePx}px ui-sans-serif, system-ui, sans-serif`;
          tkCtx.textAlign = 'center';
          tkCtx.textBaseline = 'middle';
          tkCtx.fillText('🔖', e.x, e.y - radius - badgePx);
          tkCtx.restore();
        }

        if (e.hidden) {
          tkCtx.save();
          tkCtx.globalAlpha = 0.4;
          drawNameplate(tkCtx, e, camera.scale, { force: forced, live, hideStats });
          tkCtx.restore();
        } else {
          drawNameplate(tkCtx, e, camera.scale, { force: forced, live, hideStats });
        }
      }




      const selEntities = selectedIds
        .map((id) => entities[id])
        .filter((x): x is Entity => !!x && !x.hidden && layerVisible[x.layer ?? 'tokens']);
      if (selectionToolbarVisibleRef.current) {
        if (selEntities.length === 1) {
          drawSelection(tkCtx, selEntities[0], camera.scale);
        } else if (selEntities.length >= 2) {
          // outline fino por entidade (sem handles individuais)
          for (const e of selEntities) {
            tkCtx.save();
            tkCtx.translate(e.x, e.y);
            tkCtx.rotate(e.rotation);
            tkCtx.strokeStyle = 'rgba(120,200,255,0.85)';
            tkCtx.lineWidth = 1.5 / camera.scale;
            tkCtx.setLineDash([3 / camera.scale, 3 / camera.scale]);
            tkCtx.strokeRect(-e.w / 2, -e.h / 2, e.w, e.h);
            tkCtx.setLineDash([]);
            tkCtx.restore();
          }
          const gb = groupBBox(selEntities);
          if (gb) drawGroupBox(tkCtx, gb, camera.scale);
        }
      }

      const drag = dragRef.current;
      const ms = mouseScreenRef.current;

      // régua (sobre tudo no token layer)
      if (drag.kind === 'measure') {
        MeasureEngine.draw(tkCtx, drag.startWorld, drag.currentWorld, state.gridConfig, camera.scale);
      }

      // template preview
      if (drag.kind === 'template') {
        TemplateEngine.draw(tkCtx, drag.preview, camera.scale);
        TemplateEngine.drawLabel(tkCtx, drag.preview, state.gridConfig, camera.scale);
      }

      // Ghost de AoE pendente: segue o mouse antes do clique para o player
      // ver onde o ataque/feitiço será posicionado. Inclui leash do
      // conjurador até o cursor com distância atual/máxima.
      {
        const aoePending = state.pendingAoEPlacement;
        const mw = mouseWorldRef.current;
        if (aoePending && mw && drag.kind === 'none') {
          // Reset do offset manual quando o pending muda.
          if (aoePendingIdRef.current !== aoePending) {
            aoePendingIdRef.current = aoePending;
            aoeRotOffsetRef.current = 0;
          }
          const dpi = state.gridConfig.dpi || 70;
          const mpc = state.gridConfig.metersPerCell || 1;
          const lenPx = (aoePending.sizeMeters / mpc) * dpi;
          const wPx = ((aoePending.widthMeters ?? 1.5) / mpc) * dpi;
          const origin = aoePending.originWorld;

          const rotatablePending = isRotatableAoEKind(aoePending.kind);

          // ── LINE / CONE_ATTACHED dinâmico: parte do conjurador, mouse mira + Space+scroll rotaciona ──
          if ((aoePending.kind === 'line' || aoePending.kind === 'cone_attached') && origin) {
            const rot = Math.atan2(mw.y - origin.y, mw.x - origin.x) + aoeRotOffsetRef.current;
            const ghost: MapTemplate = {
              id: '__aoe-ghost__',
              kind: aoePending.kind,
              x: origin.x,
              y: origin.y,
              rotation: rot,
              length: lenPx,
              width: aoePending.kind === 'line' ? wPx : lenPx,
              color: aoePending.color,
              opacity: 0.55,
            };
            TemplateEngine.draw(tkCtx, ghost, camera.scale);
            TemplateEngine.drawLabel(tkCtx, ghost, state.gridConfig, camera.scale);
          } else {
            // Distância caster → cursor (lógica da esfera) + cone usa apex no cursor.
            let outOfRange = false;
            if (origin) {
              const dxPx = mw.x - origin.x;
              const dyPx = mw.y - origin.y;
              const distPx = Math.hypot(dxPx, dyPx);
              const distM = (distPx / dpi) * mpc;
              const maxM = aoePending.maxRangeMeters;
              outOfRange = maxM != null && distM > maxM;
              // Linha do conjurador ao cursor.
              tkCtx.save();
              tkCtx.lineWidth = 2 / camera.scale;
              tkCtx.setLineDash([8 / camera.scale, 6 / camera.scale]);
              tkCtx.strokeStyle = outOfRange ? '#ef4444' : aoePending.color;
              tkCtx.beginPath();
              tkCtx.moveTo(origin.x, origin.y);
              tkCtx.lineTo(mw.x, mw.y);
              tkCtx.stroke();
              tkCtx.setLineDash([]);
              // Anel de alcance máximo.
              if (maxM != null) {
                const maxPx = (maxM / mpc) * dpi;
                tkCtx.lineWidth = 1.25 / camera.scale;
                tkCtx.strokeStyle = outOfRange ? '#ef4444aa' : `${aoePending.color}66`;
                tkCtx.beginPath();
                tkCtx.arc(origin.x, origin.y, maxPx, 0, Math.PI * 2);
                tkCtx.stroke();
              }
              // Label de distância no meio da linha.
              const labelText = maxM != null
                ? `${distM.toFixed(1)} / ${maxM} m`
                : `${distM.toFixed(1)} m`;
              const mx = (origin.x + mw.x) / 2;
              const my = (origin.y + mw.y) / 2;
              const fontPx = Math.max(11, 12 / camera.scale);
              tkCtx.font = `bold ${fontPx}px ui-monospace, monospace`;
              tkCtx.textAlign = 'center';
              tkCtx.textBaseline = 'middle';
              const padX = 6 / camera.scale;
              const padY = 3 / camera.scale;
              const metrics = tkCtx.measureText(labelText);
              const tw = metrics.width + padX * 2;
              const th = fontPx + padY * 2;
              tkCtx.fillStyle = 'rgba(15,15,20,0.85)';
              tkCtx.fillRect(mx - tw / 2, my - th / 2, tw, th);
              tkCtx.fillStyle = outOfRange ? '#fca5a5' : '#ffffff';
              tkCtx.fillText(labelText, mx, my);
              tkCtx.restore();
            }
            // Para cone, rotação default = caster→cursor. Cubo/quadrado também
            // aceita rotação manual por Space+scroll.
            const areaRot = aoePending.kind === 'cone' && origin
              ? Math.atan2(mw.y - origin.y, mw.x - origin.x) + aoeRotOffsetRef.current
              : rotatablePending
                ? aoeRotOffsetRef.current
                : 0;
            const ghost: MapTemplate = {
              id: '__aoe-ghost__',
              kind: aoePending.kind,
              x: mw.x,
              y: mw.y,
              rotation: areaRot,
              length: lenPx,
              width: aoePending.kind === 'line' ? wPx : lenPx,
              color: outOfRange ? '#ef4444' : aoePending.color,
              opacity: outOfRange ? 0.25 : 0.45,
            };
            TemplateEngine.draw(tkCtx, ghost, camera.scale);
            TemplateEngine.drawLabel(tkCtx, ghost, state.gridConfig, camera.scale);
          }
        }
      }

      // Mira de feitiço single-target: linha do conjurador até o cursor
      // com distância atual / alcance máximo. Visível para qualquer tipo
      // de feitiço (dano, buff, cura, condição etc.) enquanto estiver
      // armado e ainda sem alvo confirmado.
      {
        const aim = state.singleTargetAim;
        const mw = mouseWorldRef.current;
        if (aim && mw && drag.kind === 'none' && !state.pendingAoEPlacement) {
          const dpi = state.gridConfig.dpi || 70;
          const mpc = state.gridConfig.metersPerCell || 1;
          const origin = aim.originWorld;
          const dxPx = mw.x - origin.x;
          const dyPx = mw.y - origin.y;
          const distPx = Math.hypot(dxPx, dyPx);
          const distM = (distPx / dpi) * mpc;
          const maxM = aim.maxRangeMeters;
          const outOfRange = maxM != null && distM > maxM;
          const color = aim.color || '#a78bfa';
          tkCtx.save();
          tkCtx.lineWidth = 2 / camera.scale;
          tkCtx.setLineDash([8 / camera.scale, 6 / camera.scale]);
          tkCtx.strokeStyle = outOfRange ? '#ef4444' : color;
          tkCtx.beginPath();
          tkCtx.moveTo(origin.x, origin.y);
          tkCtx.lineTo(mw.x, mw.y);
          tkCtx.stroke();
          tkCtx.setLineDash([]);
          if (maxM != null) {
            const maxPx = (maxM / mpc) * dpi;
            tkCtx.lineWidth = 1.25 / camera.scale;
            tkCtx.strokeStyle = outOfRange ? '#ef4444aa' : `${color}66`;
            tkCtx.beginPath();
            tkCtx.arc(origin.x, origin.y, maxPx, 0, Math.PI * 2);
            tkCtx.stroke();
          }
          const labelText = maxM != null
            ? `${distM.toFixed(1)} / ${maxM} m`
            : `${distM.toFixed(1)} m`;
          const mx = (origin.x + mw.x) / 2;
          const my = (origin.y + mw.y) / 2;
          const fontPx = Math.max(11, 12 / camera.scale);
          tkCtx.font = `bold ${fontPx}px ui-monospace, monospace`;
          tkCtx.textAlign = 'center';
          tkCtx.textBaseline = 'middle';
          const padX = 6 / camera.scale;
          const padY = 3 / camera.scale;
          const metrics = tkCtx.measureText(labelText);
          const tw = metrics.width + padX * 2;
          const th = fontPx + padY * 2;
          tkCtx.fillStyle = 'rgba(15,15,20,0.85)';
          tkCtx.fillRect(mx - tw / 2, my - th / 2, tw, th);
          tkCtx.fillStyle = outOfRange ? '#fca5a5' : '#ffffff';
          tkCtx.fillText(labelText, mx, my);
          tkCtx.restore();
        }
      }





      // desenho ao vivo
      if (drag.kind === 'draw') {
        DrawEngine.drawLive(tkCtx, {
          id: drag.strokeId,
          color: drag.color,
          size: drag.size,
          points: drag.points,
        });
      }

      // cursor da borracha quando ferramenta de desenho está em modo eraser
      if (
        ms &&
        state.activeTool === 'draw' &&
        state.toolSettings.draw.mode === 'eraser'
      ) {
        const world = screenToWorld(ms.x, ms.y, camera);
        const r = Math.max(state.toolSettings.draw.size, 8);
        DrawEngine.drawEraserCursor(tkCtx, world, r, camera.scale);
      }
      if (drag.kind === 'erase') {
        DrawEngine.drawEraserCursor(tkCtx, drag.lastWorld, drag.radius, camera.scale);
      }

      // pings (efêmeros, ~1.5s)
      const now = performance.now();
      const PING_MS = 1500;
      const livePings = pingsRef.current.filter((p) => now - p.start < PING_MS);
      pingsRef.current = livePings;
      for (const p of livePings) {
        const t = (now - p.start) / PING_MS; // 0..1
        const baseR = 12 / camera.scale;
        const maxR = 36 / camera.scale;
        const r = baseR + (maxR - baseR) * t;
        const alpha = 1 - t;
        tkCtx.save();
        tkCtx.lineWidth = 2.5 / camera.scale;
        tkCtx.strokeStyle = withAlpha(p.color, alpha);
        tkCtx.beginPath();
        tkCtx.arc(p.x, p.y, r, 0, Math.PI * 2);
        tkCtx.stroke();
        tkCtx.fillStyle = withAlpha(p.color, alpha * 0.5);
        tkCtx.beginPath();
        tkCtx.arc(p.x, p.y, baseR * 0.6, 0, Math.PI * 2);
        tkCtx.fill();
        tkCtx.restore();
      }

      // ponteiro press-and-hold com botão direito (bolinha + rastro)
      const rp = rightPingRef.current;
      if (rp && rp.active && rp.moved) {
        const TRAIL_MS = 700;
        rp.trail = rp.trail.filter((pt) => now - pt.t < TRAIL_MS);
        // rastro: linha suavizada com largura/alpha decrescentes
        if (rp.trail.length > 1) {
          for (let i = 1; i < rp.trail.length; i++) {
            const a = rp.trail[i - 1];
            const b = rp.trail[i];
            const age = (now - b.t) / TRAIL_MS; // 0..1
            const alpha = Math.max(0, 1 - age);
            tkCtx.save();
            tkCtx.strokeStyle = withAlpha(rp.color, alpha * 0.85);
            tkCtx.lineWidth = (6 / camera.scale) * (1 - age * 0.6);
            tkCtx.lineCap = 'round';
            tkCtx.lineJoin = 'round';
            tkCtx.beginPath();
            tkCtx.moveTo(a.x, a.y);
            tkCtx.lineTo(b.x, b.y);
            tkCtx.stroke();
            tkCtx.restore();
          }
        }
        // bolinha na ponta
        const br = 9 / camera.scale;
        tkCtx.save();
        tkCtx.fillStyle = withAlpha(rp.color, 0.95);
        tkCtx.beginPath();
        tkCtx.arc(rp.world.x, rp.world.y, br, 0, Math.PI * 2);
        tkCtx.fill();
        tkCtx.lineWidth = 2 / camera.scale;
        tkCtx.strokeStyle = withAlpha('#ffffff', 0.9);
        tkCtx.stroke();
        tkCtx.restore();
      }

      // ponteiros remotos (botão direito de outros jogadores)
      {
        const TRAIL_MS = 700;
        const rmap = remoteRightPingsRef.current;
        for (const [cid, rr] of rmap) {
          rr.trail = rr.trail.filter((pt) => now - pt.t < TRAIL_MS);
          if (rr.trail.length === 0 && rr.fading) { rmap.delete(cid); continue; }
          if (rr.trail.length > 1) {
            for (let i = 1; i < rr.trail.length; i++) {
              const a = rr.trail[i - 1];
              const b = rr.trail[i];
              const age = (now - b.t) / TRAIL_MS;
              const alpha = Math.max(0, 1 - age);
              tkCtx.save();
              tkCtx.strokeStyle = withAlpha(rr.color, alpha * 0.85);
              tkCtx.lineWidth = (6 / camera.scale) * (1 - age * 0.6);
              tkCtx.lineCap = 'round';
              tkCtx.lineJoin = 'round';
              tkCtx.beginPath();
              tkCtx.moveTo(a.x, a.y);
              tkCtx.lineTo(b.x, b.y);
              tkCtx.stroke();
              tkCtx.restore();
            }
          }
          if (!rr.fading) {
            const br = 9 / camera.scale;
            tkCtx.save();
            tkCtx.fillStyle = withAlpha(rr.color, 0.95);
            tkCtx.beginPath();
            tkCtx.arc(rr.world.x, rr.world.y, br, 0, Math.PI * 2);
            tkCtx.fill();
            tkCtx.lineWidth = 2 / camera.scale;
            tkCtx.strokeStyle = withAlpha('#ffffff', 0.9);
            tkCtx.stroke();
            tkCtx.restore();
          }
        }
      }

      // marquee de seleção
      if (drag.kind === 'marquee') {
        const r = normalizeRect(
          drag.startWorld.x, drag.startWorld.y,
          drag.currentWorld.x, drag.currentWorld.y,
        );
        tkCtx.save();
        tkCtx.fillStyle = 'rgba(120,200,255,0.10)';
        tkCtx.strokeStyle = 'rgba(120,200,255,0.95)';
        tkCtx.lineWidth = 1 / camera.scale;
        tkCtx.setLineDash([5 / camera.scale, 3 / camera.scale]);
        tkCtx.fillRect(r.x, r.y, r.w, r.h);
        tkCtx.strokeRect(r.x, r.y, r.w, r.h);
        tkCtx.restore();
      }

      // --- paredes (Dynamic Fog) — apenas para mestre ---
      if (isMaster && state.walls.length) {
        WallsEngine.drawAll(tkCtx, state.walls, camera.scale);
      }
      // preview de wall sendo arrastada
      if (drag.kind === 'wall') {
        WallsEngine.drawPreview(
          tkCtx, drag.startWorld, drag.currentWorld, drag.wallKind, camera.scale,
          drag.wallShape, drag.polyPoints,
        );
      }

      tkCtx.restore();

      // --- lighting (Fase 12) ---
      {
        const lighting = state.lighting;
        if (lighting?.enabled) {
          const lights = collectLights(entities, entityOrder, cfg.dpi);
          LightingEngine.draw(
            ltCtx,
            lighting,
            lights,
            camera,
            { w, h },
            dpr,
            cfg,
            WallsEngine.blockingSegments(state.walls, 'light'),
          );
        } else {
          ltCtx.setTransform(1, 0, 0, 1, 0, 0);
          ltCtx.clearRect(0, 0, lt.width, lt.height);
        }
      }

      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  // ============ Hidratação de assets + inicialização de cenas + cleanup ============
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const st = useMapStore.getState();
      st.ensureScenes();
      const ids = new Set<string>();
      // entidades da cena ativa
      for (const e of Object.values(useMapStore.getState().entities))
        if (e.assetId) ids.add(e.assetId);
      // background da cena ativa
      const bgActive = useMapStore.getState().background;
      if (bgActive?.assetId) ids.add(bgActive.assetId);
      // demais cenas: entidades + background (para GC)
      const scenes = useMapStore.getState().scenes;
      for (const sc of Object.values(scenes)) {
        for (const e of Object.values(sc.entities)) if (e.assetId) ids.add(e.assetId);
        if (sc.background?.assetId) ids.add(sc.background.assetId);
      }
      await Promise.all(Array.from(ids).map((id) => assetCache.load(id)));
      if (cancelled) return;
      // Garbage-collect: blobs órfãos no IDB (sem entidade/bg referenciando).
      const all = await assetDB.allIds();
      for (const id of all) if (!ids.has(id)) await assetDB.delete(id);
    })();
    return () => {
      cancelled = true;
      assetCache.releaseAll();
    };
  }, []);

  // Quando troca de cena, garante hidratação dos assets da nova cena.
  const activeSceneId = useMapStore((s) => s.activeSceneId);
  useEffect(() => {
    if (!activeSceneId) return;
    const st = useMapStore.getState();
    const ids = new Set<string>();
    for (const e of Object.values(st.entities)) if (e.assetId) ids.add(e.assetId);
    if (st.background?.assetId) ids.add(st.background.assetId);
    void Promise.all(Array.from(ids).map((id) => assetCache.load(id)));
  }, [activeSceneId]);

  // ============ Input ============
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const store = useMapStore;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        // Evita que Space "re-clique" o último botão focado e impede o scroll
        // padrão da página. Mantém o Space funcionando dentro de inputs/textareas.
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName ?? '';
        const editable = t?.isContentEditable;
        if (!editable && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
          if (t && typeof (t as HTMLElement).blur === 'function' && tag === 'BUTTON') {
            (t as HTMLElement).blur();
          }
          const ae = document.activeElement as HTMLElement | null;
          if (ae && ae.tagName === 'BUTTON') ae.blur();
          e.preventDefault();
        }
        spaceDownRef.current = true;
      }
      if (e.key === 'Shift') shiftDownRef.current = true;
      if (e.key === 'Control' || e.key === 'Meta') snapBypassRef.current = true;
      if ((e.key === 'r' || e.key === 'R') && !e.repeat) {
        // Ignora se digitando em input/textarea
        const t = e.target as HTMLElement | null;
        if (!t || !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) {
          rDownRef.current = true;
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const st = store.getState();
        const sel = st.selectedIds;
        if (sel.length) {
          const tgt = e.target as HTMLElement | null;
          const typingDel = !!tgt && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tgt.tagName);
          if (typingDel) return;
          const assetsToRelease = sel
            .map((id) => st.entities[id]?.assetId)
            .filter((x): x is string => !!x);
          st.pushHistory();
          st.removeEntities(sel);
          for (const aid of assetsToRelease) void assetCache.destroy(aid);
          e.preventDefault();
        }
      }
      if (e.key === 'F2') {
        const st = store.getState();
        const sel = st.selectedIds;
        const tgt = e.target as HTMLElement | null;
        const typing = !!tgt && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tgt.tagName);
        if (typing) return;
        if (sel.length !== 1) return;
        const target = st.entities[sel[0]];
        if (!target) return;
        e.preventDefault();
        const next = window.prompt('Nome da entidade:', target.label ?? '');
        if (next === null) return;
        st.pushHistory();
        st.updateEntity(target.id, { label: next.trim(), nameplate: next.trim().length > 0 });
        return;
      }

      // Ignora atalhos de teclado se digitando em campo de texto
      const tgt = e.target as HTMLElement | null;
      const typing = !!tgt && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tgt.tagName);
      const mod = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd+Z — undo; Ctrl/Cmd+Shift+Z ou Ctrl+Y — redo
      if (mod && !typing && (e.key === 'z' || e.key === 'Z')) {
        const st = store.getState();
        if (e.shiftKey) st.redo(); else st.undo();
        e.preventDefault();
        return;
      }
      if (mod && !typing && (e.key === 'y' || e.key === 'Y')) {
        store.getState().redo();
        e.preventDefault();
        return;
      }

      // Ctrl/Cmd+A — selecionar tudo (não-locked)
      if (mod && !e.shiftKey && (e.key === 'a' || e.key === 'A') && !typing) {
        const st = store.getState();
        const all = st.entityOrder.filter((id) => !st.entities[id]?.locked);
        st.setSelected(all);
        e.preventDefault();
        return;
      }
      // Ctrl/Cmd+C — copia seleção
      if (mod && (e.key === 'c' || e.key === 'C') && !typing) {
        const st = store.getState();
        clipboardRef.current = st.selectedIds
          .map((id) => st.entities[id])
          .filter((x): x is Entity => !!x)
          .map((en) => ({ ...en }));
        e.preventDefault();
        return;
      }
      // Ctrl/Cmd+V — cola com offset
      if (mod && (e.key === 'v' || e.key === 'V') && !typing) {
        if (!clipboardRef.current.length) return;
        const st = store.getState();
        st.pushHistory();
        const off = st.gridConfig.dpi / 2;
        const newIds: string[] = [];
        for (const en of clipboardRef.current) {
          const id = st.addEntity({
            shape: en.shape,
            x: en.x + off,
            y: en.y + off,
            w: en.w,
            h: en.h,
            rotation: en.rotation,
            color: en.color,
            label: en.label,
            locked: false,
            assetId: en.assetId,
          });
          newIds.push(id);
        }
        st.setSelected(newIds);
        e.preventDefault();
        return;
      }
      // Ctrl/Cmd+D — duplica seleção in-place (offset pequeno)
      if (mod && (e.key === 'd' || e.key === 'D') && !typing) {
        const st = store.getState();
        const sel = st.selectedIds;
        if (!sel.length) return;
        st.pushHistory();
        const off = st.gridConfig.dpi / 2;
        const newIds: string[] = [];
        for (const id of sel) {
          const en = st.entities[id];
          if (!en) continue;
          const nid = st.addEntity({
            shape: en.shape,
            x: en.x + off,
            y: en.y + off,
            w: en.w,
            h: en.h,
            rotation: en.rotation,
            color: en.color,
            label: en.label,
            locked: false,
            assetId: en.assetId,
          });
          newIds.push(nid);
        }
        st.setSelected(newIds);
        e.preventDefault();
        return;
      }

      // L — abre/fecha painel de camadas
      if (!mod && !e.shiftKey && (e.key === 'l' || e.key === 'L') && !typing) {
        setLayerPanelOpen((v) => !v);
        e.preventDefault();
        return;
      }
      // I — abre/fecha tracker de iniciativa
      if (!mod && !e.shiftKey && (e.key === 'i' || e.key === 'I') && !typing) {
        const st = store.getState();
        st.setInitiativeOpen(!st.initiativeOpen);
        e.preventDefault();
        return;
      }
      // D — abre/fecha painel de dados
      if (!mod && !e.shiftKey && (e.key === 'd' || e.key === 'D') && !typing) {
        const ds = useDiceStore.getState();
        ds.setOpen(!ds.open);
        e.preventDefault();
        return;
      }
      // ] / [ — z-order na camada (Shift = front/back absoluto)
      if (!mod && (e.key === ']' || e.key === '[') && !typing) {
        const st = store.getState();
        const sel = st.selectedIds;
        if (!sel.length) return;
        st.pushHistory();
        const fwd = e.key === ']';
        for (const id of sel) {
          if (e.shiftKey) (fwd ? st.bringToFront : st.sendToBack)(id);
          else (fwd ? st.bringForward : st.sendBackward)(id);
        }
        e.preventDefault();
        return;
      }
      // Ctrl/Cmd+G — agrupar seleção; Ctrl+Shift+G — desagrupar
      if (mod && (e.key === 'g' || e.key === 'G') && !typing) {
        const st = store.getState();
        const sel = st.selectedIds;
        if (!sel.length) return;
        st.pushHistory();
        if (e.shiftKey) st.ungroupSelection(sel);
        else st.groupSelection(sel);
        e.preventDefault();
        return;
      }
      // Arrow keys — nudge da seleção. Shift = passo fino (px). Alt = passo grande (5 células).
      if (!typing && !mod &&
        (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        const st = store.getState();
        const sel = st.selectedIds;
        if (!sel.length) return;
        if (useRoleStore.getState().role === 'PLAYER') {
          if (useCombatStore.getState().inCombat) return;
          if (sel.some((id) => {
            const en = st.entities[id];
            return !en || !canStartMoveEntityNow(en);
          })) return;
        }
        const cell = st.gridConfig.dpi;
        let step = cell;
        if (e.shiftKey) step = Math.max(1, cell / 10);
        else if (e.altKey) step = cell * 5;
        let dx = 0, dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;
        else if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        st.pushHistory();
        st.updateEntities(sel.map((id) => {
          const en = st.entities[id];
          return { id, patch: { x: (en?.x ?? 0) + dx, y: (en?.y ?? 0) + dy } };
        }));
        e.preventDefault();
        return;
      }
      // ? — abre/fecha overlay de atalhos
      if (!mod && !typing && (e.key === '?' || (e.shiftKey && e.key === '/'))) {
        setShortcutsOpen((v) => !v);
        e.preventDefault();
        return;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = false;
      if (e.key === 'Shift') shiftDownRef.current = false;
      if (e.key === 'Control' || e.key === 'Meta') snapBypassRef.current = false;
      if (e.key === 'r' || e.key === 'R') rDownRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const worldFromEvent = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cam = store.getState().camera;
      return { sx, sy, ...screenToWorld(sx, sy, cam) };
    };

    /** Pega entidade no topo sob o ponto-mundo (respeita hidden e camada oculta).
     *  Prioriza camadas superiores (gm > tokens > map) para que entidades sobre
     *  um mapa sempre sejam selecionadas antes do mapa. */
    const pickEntityAt = (wx: number, wy: number): Entity | null => {
      const { entities, entityOrder, layerVisible } = store.getState();
      const isMaster = useRoleStore.getState().role !== 'PLAYER';
      const layerPriority: Array<'gm' | 'tokens' | 'map'> = ['gm', 'tokens', 'map'];
      for (const lyr of layerPriority) {
        if (!layerVisible[lyr]) continue;
        for (let i = entityOrder.length - 1; i >= 0; i--) {
          const e = entities[entityOrder[i]];
          if (!e) continue;
          if ((e.layer ?? 'tokens') !== lyr) continue;
          if (e.hidden && !isMaster) continue;
          if (hitTest({ x: wx, y: wy }, e)) return e;
        }
      }
      return null;
    };

    // Garante que listeners nativos do canvas só rodem quando o evento
    // nasceu na própria superfície (container ou um dos <canvas>).
    // Sem isso, clicks em painéis-filhos (LayerPanel, DicePanel, ShortcutsHelp,
    // WelcomeTutorial, InitiativePanel, NotesOverlay, MapContextMenu)
    // borbulham e disparam pan/seleção/desenho/zoom — o mesmo bug do botão
    // "Excluir". stopPropagation no React não cobre listeners nativos.
    const isMapSurface = (target: EventTarget | null): boolean => {
      if (!(target instanceof Node)) return false;
      if (target === el) return true;
      return target instanceof HTMLCanvasElement && el.contains(target);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!isMapSurface(e.target)) return;
      // pan?
      const isMiddle = e.button === 1;
      const isSpacePan = e.button === 0 && spaceDownRef.current && !store.getState().pendingAoEPlacement;
      if (isMiddle || isSpacePan) {
        e.preventDefault();
        dragRef.current = { kind: 'pan' };
        panStateRef.current = { lastX: e.clientX, lastY: e.clientY };
        store.getState().setCamera({ isPanning: true });
        el.style.cursor = 'grabbing';
        return;
      }
      if (e.button !== 0) {
        // Botão direito durante posicionamento de AoE → cancela.
        if (e.button === 2 && store.getState().pendingAoEPlacement) {
          e.preventDefault();
          store.getState().resolveAoEPlacement(null);
          return;
        }
        // Botão direito durante mira single-target → cancela o feitiço.
        if (e.button === 2 && store.getState().singleTargetAim) {
          e.preventDefault();
          const aim = store.getState().singleTargetAim;
          aim?.onCancel?.();
          store.getState().setSingleTargetAim(null);
          return;
        }
        // botão direito segurado na ferramenta select → ponteiro com rastro
        if (e.button === 2 && activeToolRef.current === 'select') {
          const { sx, sy, x: wx2, y: wy2 } = worldFromEvent(e);
          const color = store.getState().toolSettings.pointer?.color ?? '#ff5577';
          rightPingRef.current = {
            active: true,
            moved: false,
            startScreen: { x: sx, y: sy },
            world: { x: wx2, y: wy2 },
            color,
            trail: [{ x: wx2, y: wy2, t: performance.now() }],
          };
          // broadcast inicial
          const w = window as unknown as { __worldBus?: { send: (a: unknown) => void }; __worldBusClientId?: string };
          if (w.__worldBus) {
            try { void w.__worldBus.send({ type: 'broadcast', event: 'pointer-trail', payload: { clientId: w.__worldBusClientId, x: wx2, y: wy2, color } }); } catch { /* ignore */ }
          }
        }
        return;
      }

      const { x: wx, y: wy } = worldFromEvent(e);
      const state = store.getState();
      const cam = state.camera;

      // ── AoE pending placement (intercepta antes de qualquer ferramenta) ──
      const aoe = state.pendingAoEPlacement;
      if (aoe) {
        e.preventDefault();
        const dpi = state.gridConfig.dpi || 70;
        const mpc = state.gridConfig.metersPerCell || 1;
        // Bloqueia clique fora do alcance máximo (não se aplica a LINE/CONE_ATTACHED,
        // que saem do conjurador com comprimento fixo — o mouse só mira).
        if (aoe.kind !== 'line' && aoe.kind !== 'cone_attached' && aoe.originWorld && aoe.maxRangeMeters != null) {
          const distM = (Math.hypot(wx - aoe.originWorld.x, wy - aoe.originWorld.y) / dpi) * mpc;
          if (distM > aoe.maxRangeMeters) return;
        }

        const lenPx = (aoe.sizeMeters / mpc) * dpi;
        const wPx = ((aoe.widthMeters ?? 1.5) / mpc) * dpi;
        const isDirected = aoe.kind === 'cone' || aoe.kind === 'line' || aoe.kind === 'cone_attached';
        const isManualRotatable = isRotatableAoEKind(aoe.kind);

        // LINE / CONE_ATTACHED dinâmico: parte do conjurador, clique apenas confirma a mira.
        if ((aoe.kind === 'line' || aoe.kind === 'cone_attached') && aoe.originWorld) {
          const rot = Math.atan2(wy - aoe.originWorld.y, wx - aoe.originWorld.x) + aoeRotOffsetRef.current;
          const preview: MapTemplate = {
            id: `aoe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            kind: aoe.kind,
            x: aoe.originWorld.x,
            y: aoe.originWorld.y,
            rotation: rot,
            length: lenPx,
            width: aoe.kind === 'line' ? wPx : lenPx,
            color: aoe.color,
            opacity: 0.7,
          };
          state.pushHistory();
          state.addTemplate(preview);
          state.resolveAoEPlacement(preview);
          return;
        }

        // CONE dinâmico: apex no cursor (lógica da esfera para distância),
        // rotação automática caster→cursor + offset manual via Space+scroll.
        if (aoe.kind === 'cone' && aoe.originWorld) {
          const rot = Math.atan2(wy - aoe.originWorld.y, wx - aoe.originWorld.x) + aoeRotOffsetRef.current;
          const preview: MapTemplate = {
            id: `aoe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            kind: 'cone',
            x: wx,
            y: wy,
            rotation: rot,
            length: lenPx,
            width: lenPx,
            color: aoe.color,
            opacity: 0.7,
          };
          state.pushHistory();
          state.addTemplate(preview);
          state.resolveAoEPlacement(preview);
          return;
        }

        const start = { x: wx, y: wy };
        const preview: MapTemplate = {
          id: `aoe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          kind: aoe.kind,
          x: start.x,
          y: start.y,
          rotation: isManualRotatable ? aoeRotOffsetRef.current : 0,
          length: lenPx,
          width: aoe.kind === 'line' ? wPx : lenPx,
          color: aoe.color,
          opacity: 0.7,
        };
        if (!isDirected) {
          // Click único: commit imediato e resolve.
          state.pushHistory();
          state.addTemplate(preview);
          state.resolveAoEPlacement(preview);
          return;
        }
        // Fallback (sem origem): cone/line entra em drag para definir direção.
        dragRef.current = { kind: 'template', preview, startWorld: start };
        return;


      }



      // Triple-click em qualquer lugar dispara um ping de ponteiro.
      if (e.detail >= 3) {
        e.preventDefault();
        pushPing(wx, wy, state.toolSettings.pointer?.color ?? '#ff5577');

        return;
      }


      // 0a) régua tem prioridade absoluta (ferramenta ativa OU tecla R)
      if (activeToolRef.current === 'measure' || rDownRef.current) {
        e.preventDefault();
        const start = (snapBypassRef.current || rDownRef.current)
          ? { x: wx, y: wy }
          : GridEngine.snapToGrid({ x: wx, y: wy }, state.gridConfig);
        dragRef.current = {
          kind: 'measure',
          startWorld: start,
          currentWorld: start,
        };
        return;
      }


      // 0c) ferramenta de desenho (pen ou eraser)
      if (activeToolRef.current === 'draw') {
        e.preventDefault();
        const ds = drawSettingsRef.current;
        state.pushHistory();
        if (ds.mode === 'pen') {
          const id = `stroke-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
          dragRef.current = {
            kind: 'draw',
            strokeId: id,
            points: [{ x: wx, y: wy }],
            color: ds.color,
            size: ds.size,
          };
        } else {
          const radius = Math.max(ds.size, 8);
          const { removeIds, add } = DrawEngine.eraseAt(state.drawings, { x: wx, y: wy }, radius);
          if (removeIds.length) state.spliceStrokes(removeIds, add);
          dragRef.current = { kind: 'erase', lastWorld: { x: wx, y: wy }, radius };
        }
        return;
      }

      // 0d) ponteiro — ping efêmero, não bloqueia outros gestos
      if (activeToolRef.current === 'pointer') {
        e.preventDefault();
        pushPing(wx, wy, state.toolSettings.pointer?.color ?? '#ff5577');

        return;
      }

      // 0e) nota — clique no vazio cria pino novo
      if (activeToolRef.current === 'note') {
        e.preventDefault();
        const id = `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        state.pushHistory();
        state.addNote({
          id,
          x: wx,
          y: wy,
          text: '',
          color: state.toolSettings.note.color,
        });
        return;
      }

      // 0f) template — arrasta para definir raio/direção/comprimento
      if (activeToolRef.current === 'template') {
        e.preventDefault();
        const ts = state.toolSettings.template;
        const start = { x: wx, y: wy };
        const preview = TemplateEngine.fromDrag(ts.kind, start, start, {
          color: ts.color,
          opacity: ts.opacity,
          widthCells: ts.widthCells,
          dpi: state.gridConfig.dpi,
        });
        dragRef.current = { kind: 'template', preview, startWorld: start };
        return;
      }

      // 0g) walls — drag = cria segmento; shift-click = remove; polygon = clique-a-clique
      if (activeToolRef.current === 'walls') {
        e.preventDefault();
        const st2 = store.getState();
        if (e.shiftKey) {
          const hit = WallsEngine.pickAt(st2.walls, { x: wx, y: wy }, 10 / cam.scale);
          if (hit) { st2.pushHistory(); st2.removeWalls([hit.id]); }
          return;
        }
        const start = snapBypassRef.current
          ? { x: wx, y: wy }
          : GridEngine.snapToGrid({ x: wx, y: wy }, st2.gridConfig);
        const shape = (st2.toolSettings.walls.shape ?? 'line') as 'line' | 'rect' | 'ellipse' | 'polygon';
        // Polygon: cada clique adiciona um vértice; duplo-clique finaliza.
        if (shape === 'polygon') {
          const curDrag = dragRef.current;
          if (curDrag.kind === 'wall' && curDrag.wallShape === 'polygon') {
            const pts = [...(curDrag.polyPoints ?? [curDrag.startWorld]), start];
            dragRef.current = { ...curDrag, polyPoints: pts, currentWorld: start };
          } else {
            dragRef.current = {
              kind: 'wall',
              wallKind: st2.toolSettings.walls.kind,
              wallShape: 'polygon',
              startWorld: start,
              currentWorld: start,
              polyPoints: [start],
            };
          }
          return;
        }
        dragRef.current = {
          kind: 'wall',
          wallKind: st2.toolSettings.walls.kind,
          wallShape: shape,
          startWorld: start,
          currentWorld: start,
        };
        return;
      }






      // 1) tenta handle de seleção atual somente quando os controles estão visíveis
      if (selectionToolbarVisibleRef.current && state.selectedIds.length === 1) {
        const sel = state.entities[state.selectedIds[0]];
        if (sel) {
          if (!canPlayerEditEntityNow(sel)) return;
          const tol = 10 / cam.scale;
          const handle = pickHandle({ x: wx, y: wy }, sel, tol, 24 / cam.scale);
          // Apenas handles visíveis (rotação + laterais E/W) podem iniciar
          // resize. Cantos e N/S existem para layout interno mas não devem
          // capturar cliques, evitando esticar a imagem ao tentar arrastar.
          const useHandle =
            handle && (handle.kind === 'rot' || handle.kind === 'e' || handle.kind === 'w')
              ? handle
              : null;
          if (useHandle) {
            state.pushHistory();
            if (useHandle.kind === 'rot') {
              const startAngle = Math.atan2(wy - sel.y, wx - sel.x);
              dragRef.current = { kind: 'rotate', id: sel.id, orig: { ...sel }, startAngle };
            } else {
              dragRef.current = { kind: 'resize', id: sel.id, handle: useHandle.kind, orig: { ...sel } };
            }
            return;
          }
        }
      } else if (selectionToolbarVisibleRef.current && state.selectedIds.length >= 2) {
        // 1b) handle de GRUPO
        const selEnts = state.selectedIds
          .map((id) => state.entities[id])
          .filter((x): x is Entity => !!x);
        if (selEnts.some((en) => !canPlayerEditEntityNow(en))) return;
        const gb = groupBBox(selEnts);
        if (gb) {
          const gh = pickGroupHandle({ x: wx, y: wy }, gb, 10 / cam.scale, 28 / cam.scale);
          if (gh) {
            state.pushHistory();
            const origs = selEnts.map((en) => ({ ...en }));
            if (gh.kind === 'rot') {
              const pivot = { x: gb.cx, y: gb.cy };
              const startAngle = Math.atan2(wy - pivot.y, wx - pivot.x);
              dragRef.current = { kind: 'group-rotate', ids: selEnts.map((e) => e.id), pivot, origs, startAngle };
            } else {
              dragRef.current = { kind: 'group-resize', ids: selEnts.map((e) => e.id), handle: gh.kind, bbox: gb, origs };
            }
            return;
          }
        }
      }

      // 2) hit em entidade?
      const hit = pickEntityAt(wx, wy);
      if (hit) {
        if (hit.locked) return;
        // expansão de grupo: clicar em membro de um grupo seleciona todos do grupo
        // (a menos que Alt esteja pressionado, que isola apenas o token clicado).
        const altIsolate = (e as any).altKey === true;
        const groupExpanded = altIsolate
          ? [hit.id]
          : state.expandToGroups([hit.id]);
        let ids: string[];
        if (shiftDownRef.current) {
          const already = state.selectedIds.includes(hit.id);
          if (already) {
            ids = state.selectedIds.filter((x) => !groupExpanded.includes(x));
          } else {
            const merged = [...state.selectedIds];
            for (const id of groupExpanded) if (!merged.includes(id)) merged.push(id);
            ids = merged;
          }
        } else {
          ids = state.selectedIds.includes(hit.id) && groupExpanded.every((g) => state.selectedIds.includes(g))
            ? state.selectedIds
            : groupExpanded;
        }
        state.setSelected(ids);
        if (ids.some((id) => {
          const en = store.getState().entities[id];
          return !en || !canStartMoveEntityNow(en);
        })) return;
        // pushHistory ocorre no primeiro mousemove (evita snapshot para clique-sem-drag)
        state.bringToFront(hit.id);
        const origs: Record<string, { x: number; y: number }> = {};
        for (const id of ids) {
          const en = store.getState().entities[id];
          if (en) origs[id] = { x: en.x, y: en.y };
        }
        entityDragMovedRef.current = false;
        setSelectionToolbarVisible(false);
        let cachedBlockers: MapCollisionCache | undefined;
        if (useRoleStore.getState().role === 'PLAYER') {
          const wallBlockers = WallsEngine.blockingSegments(store.getState().walls, 'sight');
          const fogState = useFogStore.getState();
          const fogSegs = buildFogSegments(fogState.walls, fogState.doors);
          const blockerSegments: MapCollisionSegment[] = [...wallBlockers];
          for (const s of fogSegs) blockerSegments.push([s.a, s.b]);
          cachedBlockers = prepareCollisionCache(blockerSegments);
        }
        // Em combate: se o token tem ficha vinculada que está na ordem ativa,
        // ativa controle de orçamento de movimento.
        let combatMeta: CombatMoveMeta | undefined;
        const cb = useCombatStore.getState();
        const primaryEnt = store.getState().entities[hit.id];
        const linkedCharId = primaryEnt?.characterId;
        if (cb.inCombat && linkedCharId) {
          const activeChar = cb.initiativeOrder[cb.currentTurnIndex]?.charId;
          if (activeChar === linkedCharId) {
            const ch = useCharacterStore.getState().characters.find((c) => c.id === linkedCharId);
            const budgetM = isFreeformFor(ch, cb.freeformMode) ? Infinity : effectiveMovement(ch);
            const usedBeforeM = isFreeformFor(ch, cb.freeformMode) ? 0 : (cb.movementUsedByChar[linkedCharId] ?? 0);
            const cfg = store.getState().gridConfig;
            const metersPerPx = (cfg.metersPerCell || 1.5) / (cfg.dpi || 70);
            // Se já existe um pendingMove para esse mesmo token, continuamos
            // a partir dele: mantemos a origem e o rastro, e somamos a distância
            // já percorrida (mas ainda não confirmada) ao movedPx inicial.
            const pending = store.getState().pendingMove;
            const continuing = pending && pending.entityId === hit.id && pending.charId === linkedCharId;
            const startPrim = continuing ? { x: pending.startX, y: pending.startY } : { x: primaryEnt.x, y: primaryEnt.y };
            const trail = continuing ? [...pending.trail] : [{ x: primaryEnt.x, y: primaryEnt.y }];
            const movedPx = continuing ? pending.distM / metersPerPx : 0;
            combatMeta = {
              charId: linkedCharId,
              budgetM,
              usedBeforeM,
              metersPerPx,
              startPrim,
              lastPrim: { x: primaryEnt.x, y: primaryEnt.y },
              trail,
              movedPx,
            };
          }
        }

        dragRef.current = { kind: 'move', ids, primaryId: hit.id, startWorld: { x: wx, y: wy }, origs, blockers: cachedBlockers, combat: combatMeta };
        return;
      }

      // 3) clicou no vazio: com select tool, inicia marquee; senão deseleciona.
      if (activeToolRef.current === 'select') {
        dragRef.current = {
          kind: 'marquee',
          startWorld: { x: wx, y: wy },
          currentWorld: { x: wx, y: wy },
          additive: shiftDownRef.current,
          baseSelection: shiftDownRef.current ? [...state.selectedIds] : [],
        };
        if (!shiftDownRef.current) state.clearSelection();
        return;
      }
      if (!shiftDownRef.current) state.clearSelection();
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      mouseScreenRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      {
        const { x: _wx, y: _wy } = worldFromEvent(e);
        mouseWorldRef.current = { x: _wx, y: _wy };
      }
      // right-button ponteiro com rastro (independente de dragRef)
      const rp = rightPingRef.current;
      if (rp && rp.active) {
        const { sx, sy, x: wx2, y: wy2 } = worldFromEvent(e);
        rp.world = { x: wx2, y: wy2 };
        const dxs = sx - rp.startScreen.x;
        const dys = sy - rp.startScreen.y;
        if (!rp.moved && Math.hypot(dxs, dys) > 5) rp.moved = true;
        const last = rp.trail[rp.trail.length - 1];
        if (!last || Math.hypot(wx2 - last.x, wy2 - last.y) > 1) {
          rp.trail.push({ x: wx2, y: wy2, t: performance.now() });
          if (rp.trail.length > 256) rp.trail.shift();
          // broadcast incremental (throttle ~40ms)
          const nowT = performance.now();
          const lastSent = (rp as unknown as { _lastSent?: number })._lastSent || 0;
          if (nowT - lastSent > 40) {
            (rp as unknown as { _lastSent?: number })._lastSent = nowT;
            const w = window as unknown as { __worldBus?: { send: (a: unknown) => void }; __worldBusClientId?: string };
            if (w.__worldBus) {
              try { void w.__worldBus.send({ type: 'broadcast', event: 'pointer-trail', payload: { clientId: w.__worldBusClientId, x: wx2, y: wy2, color: rp.color } }); } catch { /* ignore */ }
            }
          }
        }
      }
      const drag = dragRef.current;
      if (drag.kind === 'none') return;
      const state = store.getState();


      if (drag.kind === 'pan') {
        const dx = e.clientX - panStateRef.current.lastX;
        const dy = e.clientY - panStateRef.current.lastY;
        panStateRef.current = { lastX: e.clientX, lastY: e.clientY };
        const cam = state.camera;
        state.setCamera({ x: cam.x + dx / cam.scale, y: cam.y + dy / cam.scale });
        return;
      }

      const { x: wx, y: wy } = worldFromEvent(e);
      const cfg = state.gridConfig;

      if (drag.kind === 'move') {
        const ddx = wx - drag.startWorld.x;
        const ddy = wy - drag.startWorld.y;
        if (!drag.historyPushed && (Math.abs(ddx) > 0.5 || Math.abs(ddy) > 0.5)) {
          state.pushHistory();
          drag.historyPushed = true;
          entityDragMovedRef.current = true;
        }
        // Movimento suave por padrão; segurar Shift força snap à grade.
        let finalDx = ddx;
        let finalDy = ddy;
        if (shiftDownRef.current) {
          const primOrig = drag.origs[drag.primaryId];
          if (primOrig) {
            const target = { x: primOrig.x + ddx, y: primOrig.y + ddy };
            const snapped = GridEngine.snapToGrid(target, cfg);
            finalDx = snapped.x - primOrig.x;
            finalDy = snapped.y - primOrig.y;
          }
        }

        // Colisão: players não atravessam paredes / portas fechadas.
        const blockers = drag.blockers;
        if (blockers && blockers.blockers.length && (finalDx !== 0 || finalDy !== 0)) {
          const ents = state.entities;
          const moving = drag.ids.map((id) => {
            const origin = drag.origs[id];
            const entity = ents[id];
            return origin && entity ? { origin, entity } : null;
          }).filter((x): x is MapCollisionToken => !!x);

          if (moving.length) {
            const previous = drag.resolved ?? { dx: 0, dy: 0 };
            const desiredStep = { dx: finalDx - previous.dx, dy: finalDy - previous.dy };
            const resolved = resolveCollisionMove(moving, blockers, previous, desiredStep);
            finalDx = resolved.dx;
            finalDy = resolved.dy;
            drag.resolved = resolved;
          }
        }

        // Cap de movimento em combate: distância em linha reta a partir do
        // início da arrastada, somada ao já consumido, não pode exceder budget.
        if (drag.combat) {
          const cm = drag.combat;
          const primOrig = drag.origs[drag.primaryId];
          if (primOrig) {
            // Trava dura: o token nunca pode ultrapassar o orçamento total.
            const totalBudgetPx = Math.max(0, (cm.budgetM - cm.usedBeforeM) / cm.metersPerPx);
            const remainingStepPx = Math.max(0, totalBudgetPx - cm.movedPx);
            const nx = primOrig.x + finalDx;
            const ny = primOrig.y + finalDy;
            const stepPx = Math.hypot(nx - cm.lastPrim.x, ny - cm.lastPrim.y);
            if (stepPx > remainingStepPx && stepPx > 0) {
              const k = remainingStepPx / stepPx;
              finalDx = cm.lastPrim.x + (nx - cm.lastPrim.x) * k - primOrig.x;
              finalDy = cm.lastPrim.y + (ny - cm.lastPrim.y) * k - primOrig.y;
            }
            const tx = primOrig.x + finalDx;
            const ty = primOrig.y + finalDy;
            const appliedStepPx = Math.hypot(tx - cm.lastPrim.x, ty - cm.lastPrim.y);
            if (appliedStepPx > 0) {
              cm.movedPx += appliedStepPx;
              cm.lastPrim = { x: tx, y: ty };
              // Sempre mantém o último ponto do rastro grudado no token,
              // sem "buracos" entre amostras: empurra um novo ponto ou
              // atualiza o último para refletir a posição atual.
              const minStep = 4 / state.camera.scale;
              const last = cm.trail[cm.trail.length - 1];
              const distLast = last ? Math.hypot(tx - last.x, ty - last.y) : Infinity;
              if (distLast >= minStep) {
                cm.trail.push({ x: tx, y: ty });
                if (cm.trail.length > 1024) cm.trail.shift();
              } else if (last) {
                last.x = tx;
                last.y = ty;
              }
            }
          }
        }





        const patches = drag.ids
          .map((id) => {
            const o = drag.origs[id];
            if (!o) return null;
            return { id, patch: { x: o.x + finalDx, y: o.y + finalDy } };
          })
          .filter((p): p is { id: string; patch: { x: number; y: number } } => !!p);

        withTransientCommitsPaused(() => state.updateEntities(patches));
        // Broadcast direto e rápido (estilo Owlbear token_positions): bypass
        // do sync pesado do mapScene — cada peer aplica só a posição,
        // sem reserializar o mundo inteiro a cada frame.
        sendEntityPatches(patches);
        return;
      }


      if (drag.kind === 'marquee') {
        dragRef.current = { ...drag, currentWorld: { x: wx, y: wy } };
        return;
      }

      if (drag.kind === 'resize') {
        const orig = drag.orig;
        // Resize é sempre suave (sem snap-to-grid) para permitir ajuste gradual.
        // Segurar Shift força snap, se desejado.
        const targetWorld = shiftDownRef.current
          ? GridEngine.snapToGrid({ x: wx, y: wy }, cfg)
          : { x: wx, y: wy };
        const localNow = worldToLocal(targetWorld, orig);
        // local original do handle ancorado:
        const hw = orig.w / 2;
        const hh = orig.h / 2;
        const lx = drag.handle.includes('e') ? hw : drag.handle.includes('w') ? -hw : 0;
        const ly = drag.handle.includes('s') ? hh : drag.handle.includes('n') ? -hh : 0;
        const deltaLocal = { x: localNow.x - lx, y: localNow.y - ly };
        const patch = resizeFromHandle(orig, drag.handle, deltaLocal);
        withTransientCommitsPaused(() => state.updateEntity(orig.id, patch));
        sendEntityPatches([{ id: orig.id, patch }]);
        return;
      }


      if (drag.kind === 'rotate') {
        const orig = drag.orig;
        const cur = Math.atan2(wy - orig.y, wx - orig.x);
        let rot = orig.rotation + (cur - drag.startAngle);
        if (e.altKey || e.ctrlKey || e.metaKey) {
          const step = Math.PI / 180;
          rot = Math.round(rot / step) * step;
        } else if (shiftDownRef.current) {
          const step = Math.PI / 12;
          rot = Math.round(rot / step) * step;
        }
        withTransientCommitsPaused(() => state.updateEntity(orig.id, { rotation: rot }));
        sendEntityPatches([{ id: orig.id, patch: { rotation: rot } }]);
        return;
      }

      if (drag.kind === 'group-resize') {
        const patches = applyGroupResize(
          drag.origs, drag.bbox, drag.handle,
          { x: wx, y: wy },
          shiftDownRef.current, // Shift = uniforme
        );
        withTransientCommitsPaused(() => state.updateEntities(patches));
        sendEntityPatches(patches);
        return;
      }

      if (drag.kind === 'group-rotate') {
        const cur = Math.atan2(wy - drag.pivot.y, wx - drag.pivot.x);
        let delta = cur - drag.startAngle;
        if (e.altKey || e.ctrlKey || e.metaKey) {
          const step = Math.PI / 180;
          delta = Math.round(delta / step) * step;
        } else if (shiftDownRef.current) {
          const step = Math.PI / 12;
          delta = Math.round(delta / step) * step;
        }
        const patches = applyGroupRotate(drag.origs, drag.pivot, delta);
        withTransientCommitsPaused(() => state.updateEntities(patches));
        sendEntityPatches(patches);
        return;
      }


      if (drag.kind === 'measure') {
        let p = { x: wx, y: wy };
        if (!snapBypassRef.current && !rDownRef.current) p = GridEngine.snapToGrid(p, state.gridConfig);
        dragRef.current = { ...drag, currentWorld: p };
        return;
      }

      if (drag.kind === 'draw') {
        const last = drag.points[drag.points.length - 1];
        // simplificação leve: só adiciona ponto se moveu o suficiente em coords-mundo
        const minDist = 1.5 / state.camera.scale;
        if (Math.hypot(wx - last.x, wy - last.y) >= minDist) {
          drag.points.push({ x: wx, y: wy });
        }
        return;
      }

      if (drag.kind === 'erase') {
        const { removeIds, add } = DrawEngine.eraseAt(state.drawings, { x: wx, y: wy }, drag.radius);
        if (removeIds.length) state.spliceStrokes(removeIds, add);
        dragRef.current = { ...drag, lastWorld: { x: wx, y: wy } };
        return;
      }

      if (drag.kind === 'template') {
        const p = { x: wx, y: wy };
        const aoePending = state.pendingAoEPlacement;
        if (aoePending) {
          // AoE: comprimento é fixo, apenas rotação acompanha cursor.
          const dx = p.x - drag.startWorld.x;
          const dy = p.y - drag.startWorld.y;
          const rot = Math.atan2(dy, dx);
          const preview: MapTemplate = {
            ...drag.preview,
            rotation: rot,
          };
          dragRef.current = { ...drag, preview };
          return;
        }
        const ts = state.toolSettings.template;
        const preview = TemplateEngine.fromDrag(ts.kind, drag.startWorld, p, {
          color: ts.color,
          opacity: ts.opacity,
          widthCells: ts.widthCells,
          dpi: state.gridConfig.dpi,
        });
        dragRef.current = { ...drag, preview };
        return;
      }


      if (drag.kind === 'wall') {
        let p = { x: wx, y: wy };
        if (!snapBypassRef.current) p = GridEngine.snapToGrid(p, state.gridConfig);
        dragRef.current = { ...drag, currentWorld: p };
        return;
      }
    };

    const onMouseUp = (e?: MouseEvent) => {
      // finaliza ponteiro press-and-hold com botão direito
      if (e && e.button === 2 && rightPingRef.current?.active) {
        const rp = rightPingRef.current;
        rp.active = false;
        // notifica fim para os demais clientes
        const w = window as unknown as { __worldBus?: { send: (a: unknown) => void }; __worldBusClientId?: string };
        if (w.__worldBus) {
          try { void w.__worldBus.send({ type: 'broadcast', event: 'pointer-trail', payload: { clientId: w.__worldBusClientId, end: true } }); } catch { /* ignore */ }
        }
        setTimeout(() => { if (rightPingRef.current === rp) rightPingRef.current = null; }, 800);
        if (rp.moved) return;
      }
      const drag = dragRef.current;
      const state = store.getState();
      if (drag.kind === 'pan') {
        state.setCamera({ isPanning: false });
        el.style.cursor = '';
      } else if (drag.kind === 'draw') {
        if (drag.points.length > 0) {
          state.addStroke({
            id: drag.strokeId,
            color: drag.color,
            size: drag.size,
            points: drag.points,
          });
        }
      } else if (drag.kind === 'marquee') {
        const r = normalizeRect(
          drag.startWorld.x, drag.startWorld.y,
          drag.currentWorld.x, drag.currentWorld.y,
        );
        // Clique simples (sem arrasto): se não-aditivo, já zeramos a seleção no down.
        if (r.w >= 3 && r.h >= 3) {
          const picked = entitiesInRect(state.entities, r).filter(
            (id) => !state.entities[id]?.locked,
          );
          if (drag.additive) {
            const merged = [...drag.baseSelection];
            for (const id of picked) if (!merged.includes(id)) merged.push(id);
            state.setSelected(merged);
          } else {
            state.setSelected(picked);
          }
        }
      } else if (drag.kind === 'measure') {
        // Shift = pin (régua persistente). Sem shift, descarta.
        if (shiftDownRef.current) {
          const a = drag.startWorld;
          const b = drag.currentWorld;
          if (Math.hypot(b.x - a.x, b.y - a.y) > 2) {
            state.pushHistory();
            state.addRuler({
              id: `ruler-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
              a: { ...a },
              b: { ...b },
              color: '#ffe178',
            });
          }
        }
      } else if (drag.kind === 'template') {
        const t = drag.preview;
        const aoePending = state.pendingAoEPlacement;
        // só comita se tem tamanho mínimo
        const minSize = state.gridConfig.dpi * 0.2;
        const ok =
          (t.kind === 'circle' && t.length >= minSize) ||
          (t.kind === 'square' && t.length >= minSize) ||
          (t.kind === 'cone' && t.length >= minSize) ||
          (t.kind === 'line' && t.length >= minSize);
        if (aoePending) {
          // AoE: comprimento já é fixo; sempre commita e resolve.
          state.pushHistory();
          state.addTemplate({ ...t });
          state.resolveAoEPlacement({ ...t });
        } else if (ok && shiftDownRef.current) {
          // Shift = pin (template persistente). Sem shift, descarta (medição efêmera, como a régua).
          state.pushHistory();
          state.addTemplate({ ...t });
        }
      } else if (drag.kind === 'wall') {
        // Polygon é confirmado por duplo-clique (handler dedicado); aqui ignoramos mouseup.
        if (drag.wallShape === 'polygon') {
          // mantém drag ativo para próximos cliques
          return;
        }
        const a = drag.startWorld, b = drag.currentWorld;
        if (Math.hypot(b.x - a.x, b.y - a.y) >= state.gridConfig.dpi * 0.15) {
          const segs = WallsEngine.segmentsForShape(a, b, drag.wallShape);
          if (segs.length) {
            state.pushHistory();
            const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
            segs.forEach(([p1, p2], i) => {
              state.addWall({
                id: `wall-${stamp}-${i}`,
                kind: drag.wallKind,
                p1: { ...p1 },
                p2: { ...p2 },
                open: (drag.wallKind === 'door' || drag.wallKind === 'secret') ? false : undefined,
              });
            });
          }
        }
      }
      if (drag.kind === 'move' && !entityDragMovedRef.current) {
        const sids = store.getState().selectedIds;
        if (sids.length === 1) setSelectionToolbarVisible(true);
        // contagem de cliques para detectar duplo-clique → flip horizontal
        const pid = drag.primaryId;
        const now = performance.now();
        const cc = clickCountRef.current;
        if (cc.id === pid && now - cc.t < 500) {
          cc.count += 1;
        } else {
          cc.id = pid;
          cc.count = 1;
        }
        cc.t = now;
        if (cc.count >= 2) {
          const st = store.getState();
          const ent = st.entities[pid];
          if (ent && !ent.locked) {
            st.pushHistory();
            const patch = { flipX: !ent.flipX };
            st.updateEntity(pid, patch);
            sendEntityPatches([{ id: pid, patch }]);
          }
          cc.count = 0;
        }
      } else if (drag.kind === 'move' && entityDragMovedRef.current) {
        clickCountRef.current.count = 0;
        // Em combate: registra movimento pendente para confirmação.
        if (drag.combat) {
          const cm = drag.combat;
          const st = store.getState();
          const ent = st.entities[drag.primaryId];
          if (ent) {
            const tail = cm.trail[cm.trail.length - 1];
            if (!tail || Math.hypot(ent.x - tail.x, ent.y - tail.y) > 0.5) cm.trail.push({ x: ent.x, y: ent.y });
            const straightPx = Math.hypot(ent.x - cm.startPrim.x, ent.y - cm.startPrim.y);
            const distM = straightPx * cm.metersPerPx;
            holdLocalMapSync(1200, drag.ids);
            st.setPendingMove({
              entityId: drag.primaryId,
              charId: cm.charId,
              startX: cm.startPrim.x,
              startY: cm.startPrim.y,
              trail: [...cm.trail],
              distM,
            });
          }
        }
      }
      dragRef.current = { kind: 'none' };
    };

    const onMouseLeave = () => { mouseScreenRef.current = null; mouseWorldRef.current = null; };

    const onDoubleClick = (e: MouseEvent) => {
      if (!isMapSurface(e.target)) return;
      if (e.button !== 0) return;
      // Walls polygon: duplo-clique finaliza o polígono em construção.
      const cur = dragRef.current;
      if (activeToolRef.current === 'walls' && cur.kind === 'wall' && cur.wallShape === 'polygon') {
        const pts = cur.polyPoints ?? [];
        if (pts.length >= 2) {
          const st = store.getState();
          st.pushHistory();
          const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
          for (let i = 0; i < pts.length - 1; i++) {
            st.addWall({
              id: `wall-${stamp}-${i}`,
              kind: cur.wallKind,
              p1: { ...pts[i] },
              p2: { ...pts[i + 1] },
              open: (cur.wallKind === 'door' || cur.wallKind === 'secret') ? false : undefined,
            });
          }
        }
        dragRef.current = { kind: 'none' } as DragMode;
        return;
      }
      const { x: wx, y: wy } = worldFromEvent(e);
      const hit = pickEntityAt(wx, wy);
      if (hit) {
        store.getState().setSelected([hit.id]);
      }
    };





    const onWheel = (e: WheelEvent) => {
      if (!isMapSurface(e.target)) return;
      e.preventDefault();
      // Space + scroll → gira o AoE rotacionável pendente (cubo/cone/line), sem zoom/pan do mapa.
      const aoePending = store.getState().pendingAoEPlacement;
      if (spaceDownRef.current && aoePending && isRotatableAoEKind(aoePending.kind)) {
        const unit = e.deltaY === 0 ? 0 : Math.max(-1, Math.min(1, e.deltaY / 100));
        const step = e.shiftKey ? Math.PI / 180 : Math.PI / 60; // ~1° ou 3° por notch, com trackpad proporcional
        aoeRotOffsetRef.current += unit * step;
        return;
      }
      if (spaceDownRef.current) return;
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cam = store.getState().camera;
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, cam.scale * factor));
      if (newScale === cam.scale) return;
      const newX = sx / newScale - (sx / cam.scale - cam.x);
      const newY = sy / newScale - (sy / cam.scale - cam.y);
      store.getState().setCamera({ scale: newScale, x: newX, y: newY });
    };


    const onDragOver = (e: DragEvent) => {
      if (!isMapSurface(e.target)) return;
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };
    const onDrop = async (e: DragEvent) => {
      if (!isMapSurface(e.target)) return;
      const files = e.dataTransfer?.files;
      if (!files || !files.length) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cam = store.getState().camera;
      const world = screenToWorld(sx, sy, cam);
      const cfg = store.getState().gridConfig;

      let offset = 0;
      const queued: Array<{
        assetId: string; name: string; previewUrl: string;
        dims: { w: number; h: number }; world: { x: number; y: number };
      }> = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const assetId = await assetCache.put(file, file.type);
        const cached = assetCache.get(assetId);
        const dims = await new Promise<{ w: number; h: number }>((resolve) => {
          if (!cached) return resolve({ w: cfg.dpi, h: cfg.dpi });
          if (cached.ready) {
            resolve({ w: cached.img.naturalWidth, h: cached.img.naturalHeight });
          } else {
            cached.img.addEventListener('load', () =>
              resolve({ w: cached.img.naturalWidth, h: cached.img.naturalHeight }),
            );
            cached.img.addEventListener('error', () => resolve({ w: cfg.dpi, h: cfg.dpi }));
          }
        });
        const previewUrl = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(typeof r.result === 'string' ? r.result : '');
          r.onerror = () => resolve('');
          r.readAsDataURL(file);
        });
        queued.push({
          assetId,
          name: file.name.replace(/\.[^.]+$/, '').slice(0, 48),
          previewUrl,
          dims,
          world: { x: world.x + offset, y: world.y + offset },
        });
        offset += cfg.dpi / 2;
      }
      if (queued.length) setPendingAssets((prev) => [...prev, ...queued]);
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    el.addEventListener('mouseleave', onMouseLeave);
    el.addEventListener('dblclick', onDoubleClick);
    
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);
    const onContextMenu = (ev: MouseEvent) => {
      if (!isMapSurface(ev.target)) return;
      // Posicionamento de AoE ativo: clique-direito cancela e não abre menu.
      if (store.getState().pendingAoEPlacement) { ev.preventDefault(); return; }
      // se o usuário arrastou o ponteiro (press-and-hold), não abre o menu
      if (rightPingRef.current?.moved) { ev.preventDefault(); return; }
      if (spaceDownRef.current) { ev.preventDefault(); return; }
      const { x: wx, y: wy } = worldFromEvent(ev);
      const st = store.getState();
      // template tool: clique-direito remove o template sob o cursor
      if (activeToolRef.current === 'template') {
        ev.preventDefault();
        for (let i = st.templates.length - 1; i >= 0; i--) {
          if (TemplateEngine.hitTest({ x: wx, y: wy }, st.templates[i])) {
            st.pushHistory();
            st.removeTemplate(st.templates[i].id);
            return;
          }
        }
        return;
      }
      // measure tool: clique-direito remove a régua persistente sob o cursor
      if (activeToolRef.current === 'measure') {
        ev.preventDefault();
        const r0 = 8 / store.getState().camera.scale;
        for (let i = st.rulers.length - 1; i >= 0; i--) {
          const r = st.rulers[i];
          // distância ponto→segmento
          const vx = r.b.x - r.a.x, vy = r.b.y - r.a.y;
          const wxw = wx - r.a.x, wyw = wy - r.a.y;
          const len2 = vx * vx + vy * vy;
          let t = len2 > 0 ? (wxw * vx + wyw * vy) / len2 : 0;
          t = Math.max(0, Math.min(1, t));
          const px = r.a.x + t * vx, py = r.a.y + t * vy;
          if (Math.hypot(wx - px, wy - py) <= r0) {
            st.pushHistory();
            st.removeRuler(r.id);
            return;
          }
        }
        return;
      }
      // walls tool: clique-direito abre/fecha porta sob o cursor
      if (activeToolRef.current === 'walls') {
        ev.preventDefault();
        const hit = WallsEngine.pickAt(st.walls.filter((w) => w.kind === 'door' || w.kind === 'secret'), { x: wx, y: wy }, 12 / st.camera.scale);
        if (hit) {
          st.pushHistory();
          st.toggleDoor(hit.id);
        }
        return;
      }
      // só com a ferramenta select abre o menu de contexto de entidades
      if (activeToolRef.current !== 'select') return;
      ev.preventDefault();
      const hit = pickEntityAt(wx, wy);
      if (hit) {
        // Jogadores não podem abrir menu de contexto sobre entidades que não são deles…
        if (!canPlayerEditEntityNow(hit)) {
          // …exceto se for um corpo caído (HP<=0) — nesse caso oferece "Carregar/Soltar".
          const allChars = useCharacterStore.getState().characters;
          const hitChar = hit.characterId
            ? allChars.find((c) => c.id === hit.characterId)
            : null;
          const isDead = !!(hitChar && hitChar.hpCurrent <= 0);
          if (!isDead) return;
          const pid = useProfileStore.getState().activeProfileId;
          if (!pid) return;
          // procura o token próprio mais próximo para servir de carregador
          let carrierId: string | null = null;
          let bestD = Infinity;
          for (const e of Object.values(st.entities)) {
            if (e.id === hit.id) continue;
            if (e.ownerProfileId !== pid) continue;
            const d = Math.hypot(e.x - hit.x, e.y - hit.y);
            if (d < bestD) { bestD = d; carrierId = e.id; }
          }
          if (!carrierId) return;
          const alreadyCarried = hit.carriedBy === carrierId;
          setCtxMenu({
            x: ev.clientX,
            y: ev.clientY,
            world: { x: wx, y: wy },
            carry: { mode: alreadyCarried ? 'drop' : 'carry', targetId: hit.id, carrierId },
          });
          return;
        }
        // se a entidade clicada NÃO está na seleção, vira seleção única
        if (!st.selectedIds.includes(hit.id)) st.setSelected([hit.id]);
      } else {
        if (!st.selectedIds.length) return; // nada a fazer
        // Se o jogador tem seleção mista/alheia, filtra antes de abrir o menu.
        if (useRoleStore.getState().role === 'PLAYER') {
          const ents = st.entities;
          const ownIds = st.selectedIds.filter((id) => {
            const e = ents[id];
            return e && canPlayerEditEntityNow(e);
          });
          if (ownIds.length === 0) return;
        }
      }
      setCtxMenu({ x: ev.clientX, y: ev.clientY, world: { x: wx, y: wy } });
    };
    el.addEventListener('contextmenu', onContextMenu);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('dblclick', onDoubleClick);
      
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('drop', onDrop);
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }, [withTransientCommitsPaused]);

  // ============ Ações do menu de contexto ============
  const handleCtxAction = (a: CtxMenuAction) => {
    const st = useMapStore.getState();
    // Ação especial de "Carregar/Soltar" — usa o alvo do ctxMenu, não a seleção.
    if (a === 'carry' || a === 'drop') {
      const c = ctxMenu?.carry;
      if (!c) return;
      st.pushHistory();
      st.setEntityCarriedBy(c.targetId, a === 'carry' ? c.carrierId : null);
      return;
    }
    const sel = st.selectedIds;
    if (!sel.length) return;
    const ents = sel.map((id) => st.entities[id]).filter((x): x is Entity => !!x);
    st.pushHistory();
    if (typeof a === 'object' && a.kind === 'setLayer') {
      for (const id of sel) st.setEntityLayer(id, a.layer);
      return;
    }
    if (a === 'setMyself') {
      const pid = useProfileStore.getState().activeProfileId;
      if (!pid) {
        window.alert('Selecione/crie um perfil antes de marcar como "Eu".');
        return;
      }
      const isPlayerNow = useRoleStore.getState().role === 'PLAYER';
      // Jogador só pode ter 1 token marcado como "Sou eu": usa apenas o
      // primeiro selecionado e desmarca todos os outros do mesmo perfil.
      const targetIds = isPlayerNow ? sel.slice(0, 1) : sel;
      if (isPlayerNow) {
        for (const e of Object.values(st.entities)) {
          if ((e.avatarProfileId ?? e.ownerProfileId) === pid && !targetIds.includes(e.id)) {
            st.setEntityAvatarProfile(e.id, null);
          }
        }
      }
      // NÃO auto-vincula ficha aqui: o mestre/player precisa associar
      // a ficha manualmente para evitar bugs de atribuição indevida.
      for (const id of targetIds) {
        st.setEntityAvatarProfile(id, pid);
        if (!st.entities[id]?.ownerProfileId) st.setEntityOwnerProfile(id, pid);
      }
      if (isPlayerNow && sel.length > 1) {
        toast({ title: '"Sou eu" aplicado a 1 token', description: 'Você só pode marcar um único token como seu avatar.' });
      }
      return;
    }
    if (a === 'clearMyself') {
      for (const id of sel) st.setEntityAvatarProfile(id, null);
      return;
    }
    if (typeof a === 'object' && a.kind === 'setCharacter') {
      const pid = useProfileStore.getState().activeProfileId;
      for (const id of sel) {
        st.setEntityCharacter(id, a.characterId);
        if (a.characterId && pid && !st.entities[id]?.ownerProfileId) {
          st.setEntityOwnerProfile(id, pid);
        }
      }
      return;
    }
    // Luz e visão: apenas o mestre pode alterar
    const roleNow = useRoleStore.getState().role;
    const isGMNow = roleNow !== 'PLAYER';
    if (typeof a === 'object' && (a.kind === 'setSeer' || a.kind === 'setLight' || a.kind === 'setSeerMeters' || a.kind === 'setSeerDarkMeters' || a.kind === 'setLightMeters')) {
      if (!isGMNow) return;
    }
    if (typeof a === 'object' && a.kind === 'setSeer') {
      const v = st.vision.defaultRadiusCells;
      const radius = a.preset === 'off' ? 0
        : a.preset === 'small' ? 3
        : a.preset === 'far' ? 15
        : v;
      for (const id of sel) {
        st.setEntitySeer(id, radius > 0 ? { radius } : null);
      }
      return;
    }
    if (typeof a === 'object' && a.kind === 'setSeerMeters') {
      const mpc = st.gridConfig.metersPerCell || 1;
      const radius = Math.max(0, a.meters / mpc);
      for (const id of sel) {
        const cur = st.entities[id]?.seer;
        const darkRadius = cur?.darkRadius;
        if (radius <= 0 && !(darkRadius && darkRadius > 0)) st.setEntitySeer(id, null);
        else st.setEntitySeer(id, { radius, ...(darkRadius ? { darkRadius } : {}) });
      }
      return;
    }
    if (typeof a === 'object' && a.kind === 'setSeerDarkMeters') {
      const mpc = st.gridConfig.metersPerCell || 1;
      const darkRadius = Math.max(0, a.meters / mpc);
      for (const id of sel) {
        const cur = st.entities[id]?.seer;
        const radius = cur?.radius ?? 0;
        if (radius <= 0 && darkRadius <= 0) st.setEntitySeer(id, null);
        else st.setEntitySeer(id, { radius, ...(darkRadius > 0 ? { darkRadius } : {}) });
      }
      return;
    }
    if (typeof a === 'object' && a.kind === 'setLight') {
      const preset = LIGHT_PRESETS[a.preset];
      // ativa lighting automaticamente quando algo emite luz
      if (preset) st.setLighting({ enabled: true });
      for (const id of sel) st.setEntityLight(id, preset);
      return;
    }
    if (typeof a === 'object' && a.kind === 'setLightMeters') {
      const mpc = st.gridConfig.metersPerCell || 1;
      const radius = Math.max(0, a.meters / mpc);
      if (radius > 0) st.setLighting({ enabled: true });
      for (const id of sel) {
        if (radius <= 0) {
          st.setEntityLight(id, null);
        } else {
          const cur = st.entities[id]?.light;
          st.setEntityLight(id, {
            radius,
            color: cur?.color ?? '#ffd9a8',
            intensity: cur?.intensity ?? 1.0,
          });
        }
      }
      return;
    }
    if (typeof a === 'object' && a.kind === 'setAssetKind') {
      const cfg = st.gridConfig;
      const targets = ents.filter((e) => !!e.assetId);
      if (!targets.length) return;
      if (a.assetKind === 'map') {
        // Redimensiona para o tamanho natural e move para a camada 'map'.
        const patches = targets.map((e) => {
          const cached = e.assetId ? assetCache.get(e.assetId) : null;
          const natW = cached?.img?.naturalWidth ?? e.w;
          const natH = cached?.img?.naturalHeight ?? e.h;
          return { id: e.id, patch: { w: natW, h: natH } };
        });
        st.updateEntities(patches);
        for (const t of targets) st.setEntityLayer(t.id, 'map');
        return;
      }
      const heightCells = a.assetKind === 'character' ? 1 : (cfg.defaultImageHeightM ?? 1.8);
      const targetH = Math.max(20, heightCells * cfg.dpi);
      const patches = targets.map((e) => {
        const cached = e.assetId ? assetCache.get(e.assetId) : null;
        const natW = cached?.img?.naturalWidth ?? e.w;
        const natH = cached?.img?.naturalHeight ?? e.h;
        const ratio = natH > 0 ? natW / natH : 1;
        return { id: e.id, patch: { h: targetH, w: Math.max(20, targetH * ratio) } };
      });
      st.updateEntities(patches);
      return;
    }
    if (a === 'bringFront')   { for (const id of sel) st.bringToFront(id);   return; }
    if (a === 'sendBack')     { for (const id of sel) st.sendToBack(id);     return; }
    if (a === 'bringForward') { for (const id of sel) st.bringForward(id);   return; }
    if (a === 'sendBackward') { for (const id of sel) st.sendBackward(id);   return; }
    if (a === 'delete') {
      const assetsToRelease = sel
        .map((id) => st.entities[id]?.assetId)
        .filter((x): x is string => !!x);
      st.removeEntities(sel);
      for (const aid of assetsToRelease) void assetCache.destroy(aid);
      return;
    }
    if (a === 'rename') {
      const target = ents[0];
      if (!target) return;
      const next = window.prompt('Nome da entidade:', target.label ?? '');
      if (next === null) return;
      st.updateEntity(target.id, { label: next.trim(), nameplate: next.trim().length > 0 });
      return;
    }
    if (a === 'duplicate') {
      const off = st.gridConfig.dpi / 2;
      const newIds: string[] = [];
      for (const en of ents) {
        const nid = st.addEntity({
          shape: en.shape, x: en.x + off, y: en.y + off,
          w: en.w, h: en.h, rotation: en.rotation,
          color: en.color, label: en.label, locked: false, assetId: en.assetId,
        });
        newIds.push(nid);
      }
      st.setSelected(newIds);
      return;
    }
    if (a === 'lock' || a === 'unlock') {
      const locked = a === 'lock';
      st.updateEntities(sel.map((id) => ({ id, patch: { locked } })));
      return;
    }
    // align / distribute
    const alignMap: Record<string, 'left' | 'right' | 'top' | 'bottom' | 'hcenter' | 'vcenter'> = {
      alignLeft: 'left', alignRight: 'right',
      alignTop: 'top', alignBottom: 'bottom',
      alignHCenter: 'hcenter', alignVCenter: 'vcenter',
    };
    if (typeof a === 'string' && a in alignMap) {
      const patches = alignEntities(ents, alignMap[a as keyof typeof alignMap]);
      if (patches.length) st.updateEntities(patches);
      return;
    }
    if (a === 'distH') {
      const patches = distributeEntities(ents, 'horizontal').filter((p) => Object.keys(p.patch).length);
      if (patches.length) st.updateEntities(patches);
      return;
    }
    if (a === 'distV') {
      const patches = distributeEntities(ents, 'vertical').filter((p) => Object.keys(p.patch).length);
      if (patches.length) st.updateEntities(patches);
      return;
    }
    if (a === 'addInit') {
      // garante painel aberto
      st.setInitiativeOpen(true);
      for (const en of ents) st.addInitiativeFromEntity(en.id);
      st.sortInitiative();
      return;
    }
    if (a === 'removeInit') {
      for (const en of ents) st.removeInitiativeByEntity(en.id);
      return;
    }
    if (a === 'group') {
      st.groupSelection(sel);
      return;
    }
    if (a === 'ungroup') {
      st.ungroupSelection(sel);
      return;
    }
  };

  // Altura do shell completo: imersivo ocupa viewport inteiro; senão respeita o layout do app.
  const shellHeight = immersive ? '100vh' : 'calc(100vh - 160px)';


  return (
    <div
      className="w-full flex select-none overflow-hidden"
      style={{
        height: shellHeight,
        minHeight: 480,
        background: '#1f2024',
        color: '#e6e7eb',
        borderRadius: immersive ? 0 : 6,
        border: immersive ? 'none' : '1px solid #2a2b30',
      }}
    >
      {/* ============ COLUNA ESQUERDA: rail + painel contextual ============ */}
      <div className="relative h-full flex shrink-0">
        <ToolRail
          activeTool={activeTool}
          shape={shapeShape}
          onSelectTool={(id) => setActiveTool(id)}
          onPickShape={(s) => setToolSettings('shape', { shape: s })}
        />
        <ToolSettingsPanel placement="rail" />
      </div>



      {/* ============ COLUNA CENTRAL: topbar + canvas ============ */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <MapTopBar
          immersive={immersive}
          settingsOpen={gridOpen}
          layerPanelOpen={layerPanelOpen}
          onToggleSettings={() => setGridOpen((v) => !v)}
          onToggleImmersive={() => setImmersive(!immersive)}
          onToggleLayerPanel={() => setLayerPanelOpen((v) => !v)}
          onOpenHelp={() => setShortcutsOpen(true)}
        />

        


        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
          tabIndex={0}
          style={{ touchAction: 'none', background: '#1f2024' }}
        >
          <ToolSettingsPanel placement="top" />
          <canvas ref={bgCanvasRef} className="absolute inset-0" style={{ zIndex: 1 }} />
          <canvas ref={tokenCanvasRef} className="absolute inset-0" style={{ zIndex: 2 }} />
          <canvas
            ref={lightCanvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 3 }}
          />

          <div
            className={`absolute inset-0 ${activeTool === 'fog' ? '' : 'pointer-events-none'}`}
            style={{ zIndex: 4 }}
          >
            <FogCanvas overlay interactive={activeTool === 'fog'} />
          </div>

          {activeTool === 'fog' && (
            <>
              <div
                className="absolute z-40 rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-2xl pointer-events-auto"
                style={{
                  top: 8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  maxWidth: 'calc(100% - 24px)',
                }}
              >
                <FogToolbar />
              </div>
              <div className="absolute right-3 top-20 z-40 w-[300px] pointer-events-auto">
                <LightSettings />
              </div>
            </>
          )}


          <NotesOverlay containerRef={containerRef as React.RefObject<HTMLDivElement>} />
          <SelectionToolbar visible={selectionToolbarVisible} />
          <PendingMoveOverlay />
          <OpportunityPromptOverlay />
          <PendingAoEOverlay />
          <LootOverlay />
          <ChestOverlay />

          <CombatBar variant="player" className="absolute top-2 right-2 z-30" />
          <CombatBar variant="master" className="absolute top-2 right-2 z-30" />
          <PlayerActionBar />

          {layerPanelOpen && <LayerPanel onClose={() => setLayerPanelOpen(false)} />}
          <InitiativeMount />
          <DicePanel />
          {shortcutsOpen && <ShortcutsHelp onClose={() => setShortcutsOpen(false)} />}
          {tutorial.open && (
            <WelcomeTutorial
              onClose={tutorial.close}
              onOpenShortcuts={() => setShortcutsOpen(true)}
            />
          )}


          {ctxMenu && (() => {
            const st = useMapStore.getState();
            const sel = st.selectedIds.map((id) => st.entities[id]).filter(Boolean) as Entity[];
            const inInitIds = new Set(
              st.initiative.entries.map((e) => e.entityId).filter((x): x is string => !!x),
            );
            const roleNow = useRoleStore.getState().role;
            const isPlayerNow = roleNow === 'PLAYER';
            const activeProfileId = useProfileStore.getState().activeProfileId;
            const allChars = useCharacterStore.getState().characters;
            const playerChars = allChars.filter(isPlayerVisibleCharacter);
            const exactProfileChars = activeProfileId
              ? playerChars.filter((c) => c.profileId === activeProfileId)
              : [];
            const legacyProfileChars = playerChars.filter((c) => !c.profileId);
            const availableCharacters = (isPlayerNow
              ? activeProfileId
                ? (exactProfileChars.length > 0 ? exactProfileChars : legacyProfileChars)
                : playerChars
              : allChars
            ).map((c) => ({ id: c.id, name: c.name }));
            const single = sel.length === 1 ? sel[0] : null;
            const myselfActive = !!(single && activeProfileId && single.avatarProfileId === activeProfileId);
            const mpcMenu = st.gridConfig.metersPerCell || 1;
            const currentLightMeters = single?.light?.radius != null
              ? single.light.radius * mpcMenu
              : null;
            const currentSeerMeters = single?.seer?.radius != null
              ? single.seer.radius * mpcMenu
              : null;
            const currentSeerDarkMeters = single?.seer?.darkRadius != null
              ? single.seer.darkRadius * mpcMenu
              : null;
            return (
              <MapContextMenu
                x={ctxMenu.x}
                y={ctxMenu.y}
                selectionCount={sel.length}
                anyLocked={sel.some((e) => e.locked)}
                anyUnlocked={sel.some((e) => !e.locked)}
                anyInInit={sel.some((e) => inInitIds.has(e.id))}
                anyOutInit={sel.some((e) => !inInitIds.has(e.id))}
                canGroup={sel.length >= 2}
                canUngroup={sel.some((e) => !!e.groupId)}
                anyHasAsset={sel.some((e) => !!e.assetId)}
                isPlayer={isPlayerNow}
                isGM={!isPlayerNow}
                myselfActive={myselfActive}
                currentCharacterId={single?.characterId ?? null}
                availableCharacters={availableCharacters}
                currentLightMeters={currentLightMeters}
                currentSeerMeters={currentSeerMeters}
                currentSeerDarkMeters={currentSeerDarkMeters}
                carryMode={ctxMenu.carry?.mode ?? null}
                onAction={handleCtxAction}
                onClose={() => setCtxMenu(null)}
              />
            );
          })()}



          {/* HUD overlays dentro do canvas */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            {/* Zoom indicator */}
            <div
              className="absolute bottom-3 right-3 pointer-events-auto rounded-md px-2.5 py-1 text-xs text-zinc-300 tabular-nums"
              style={{ background: '#16171a', border: '1px solid #2a2b30' }}
            >
              {Math.round(cameraScale * 100)}%
            </div>

            {/* Drop hint */}
            <div
              className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-zinc-400"
              style={{ background: '#16171a', border: '1px solid #2a2b30' }}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Arraste imagens para o mapa
            </div>

            {/* Settings popover (top-right anchored to topbar area) */}
            {gridOpen && (
              <div
                className="absolute top-2 right-3 w-72 pointer-events-auto rounded-lg p-3 text-xs space-y-3 shadow-xl"
                style={{
                  background: '#16171a',
                  border: '1px solid #2a2b30',
                  color: '#e6e7eb',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Configurações</span>
                  <button onClick={() => setGridOpen(false)} className="text-zinc-500 hover:text-zinc-200">×</button>
                </div>
                <Row label="Tipo de grade">
                  <select
                    value={gridConfig.type}
                    onChange={(e) => setGridConfig({ type: e.target.value as GridType })}
                    className="bg-[#1f2024] border border-[#2a2b30] rounded px-2 py-1 w-full text-zinc-200"
                  >
                    <option value="SQUARE">Quadrada</option>
                    <option value="HEX_VERTICAL">Hex (flat-top)</option>
                    <option value="HEX_HORIZONTAL">Hex (pointy-top)</option>
                    <option value="ISOMETRIC">Isométrica</option>
                  </select>
                </Row>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-zinc-400 mb-1">Tamanho da grade (m)</div>
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={Number((gridConfig.metersPerCell ?? 1.5).toFixed(2))}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v > 0) setGridConfig({ metersPerCell: v });
                      }}
                      className="w-full bg-[#1f2024] border border-[#2a2b30] rounded px-2 py-1 text-zinc-200"
                    />
                  </div>
                  <div>
                    <div className="text-zinc-400 mb-1">Célula (px)</div>
                    <input
                      type="number"
                      min={10}
                      step={1}
                      value={gridConfig.dpi}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v > 0) setGridConfig({ dpi: v });
                      }}
                      className="w-full bg-[#1f2024] border border-[#2a2b30] rounded px-2 py-1 text-zinc-200"
                    />
                  </div>
                </div>
                <Row label="Altura padrão de imagens (m)">
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={Number((gridConfig.defaultImageHeightM ?? 1.8).toFixed(2))}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v > 0) setGridConfig({ defaultImageHeightM: v });
                    }}
                    className="w-full bg-[#1f2024] border border-[#2a2b30] rounded px-2 py-1 text-zinc-200"
                  />
                </Row>

                <Row label={`Largura da linha: ${gridConfig.lineWidth.toFixed(2)} px`}>
                  <input type="range" min={0.5} max={4} step={0.25}
                    value={gridConfig.lineWidth}
                    onChange={(e) => setGridConfig({ lineWidth: Number(e.target.value) })}
                    className="w-full" />
                </Row>
                <label className="flex items-center justify-between text-zinc-300">
                  <span>Snapping (encaixar na grade)</span>
                  <input
                    type="checkbox"
                    checked={gridConfig.snapping !== false}
                    onChange={(e) => setGridConfig({ snapping: e.target.checked })}
                  />
                </label>
                <Row label={`Sensibilidade do snap: ${(gridConfig.snappingSensitivity * 100).toFixed(0)}%`}>
                  <input type="range" min={0} max={1} step={0.05}
                    value={gridConfig.snappingSensitivity}
                    onChange={(e) => setGridConfig({ snappingSensitivity: Number(e.target.value) })}
                    className="w-full" />
                </Row>
                <div className="flex items-center gap-3 text-zinc-300">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={gridConfig.useCorners}
                      onChange={(e) => setGridConfig({ useCorners: e.target.checked })} />
                    Cantos
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={gridConfig.useCenter}
                      onChange={(e) => setGridConfig({ useCenter: e.target.checked })} />
                    Centro
                  </label>
                  <label className="flex items-center gap-1 ml-auto">
                    <input type="checkbox" checked={gridConfig.visible}
                      onChange={(e) => setGridConfig({ visible: e.target.checked })} />
                    Visível
                  </label>
                </div>
                <Row label="Estilo de linha">
                  <select
                    value={gridConfig.lineType}
                    onChange={(e) => setGridConfig({ lineType: e.target.value as LineType })}
                    className="bg-[#1f2024] border border-[#2a2b30] rounded px-2 py-1 w-full text-zinc-200"
                  >
                    <option value="solid">Sólida</option>
                    <option value="dashed">Tracejada</option>
                    <option value="dotted">Pontilhada</option>
                  </select>
                </Row>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-zinc-400 mb-1">Cor da grade</div>
                    <input type="color" value={gridConfig.color}
                      onChange={(e) => setGridConfig({ color: e.target.value })}
                      className="h-7 w-full bg-[#1f2024] border border-[#2a2b30] rounded" />
                  </div>
                  <div>
                    <div className="text-zinc-400 mb-1">Opacidade: {Math.round((gridConfig.opacity ?? 0.35) * 100)}%</div>
                    <input type="range" min={0.05} max={1} step={0.05}
                      value={gridConfig.opacity ?? 0.35}
                      onChange={(e) => setGridConfig({ opacity: Number(e.target.value) })}
                      className="w-full" />
                  </div>
                </div>

                <Row label="Medição">
                  <select
                    value={gridConfig.measurementStyle}
                    onChange={(e) => setGridConfig({ measurementStyle: e.target.value as typeof gridConfig.measurementStyle })}
                    className="bg-[#1f2024] border border-[#2a2b30] rounded px-2 py-1 w-full text-zinc-200"
                  >
                    <option value="CHEBYSHEV">Chebyshev (5e)</option>
                    <option value="ALTERNATING">Alternada (3.5)</option>
                    <option value="MANHATTAN">Manhattan</option>
                    <option value="EUCLIDEAN">Euclidiana</option>
                  </select>
                </Row>
                <ViewportControls />

              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============ COLUNA DIREITA: Party ============ */}
      <PartyPanel
        collapsed={partyCollapsed}
        onToggleCollapsed={() => setPartyCollapsed(!partyCollapsed)}
      />

      {pendingAssets.length > 0 && (() => {
        const item = pendingAssets[0];
        const consume = () => setPendingAssets((prev) => prev.slice(1));
        const onChoose = (kind: AssetKind) => {
          const st = useMapStore.getState();
          const cfg = st.gridConfig;
          const ratio = item.dims.h > 0 ? item.dims.w / item.dims.h : 1;
          st.pushHistory();
          if (kind === 'map') {
            // Mapa: cria entidade na camada 'map' com dimensões naturais,
            // movível como qualquer outra (basta destravar/clicar pra ajustar).
            const id = st.addEntity({
              shape: 'RECT',
              x: item.world.x, y: item.world.y,
              w: item.dims.w, h: item.dims.h,
              rotation: 0,
              color: '#ffffff',
              locked: false,
              assetId: item.assetId,
              label: item.name.slice(0, 24),
            });
            st.setEntityLayer(id, 'map');
          } else {
            const heightCells = kind === 'character' ? 1 : (cfg.defaultImageHeightM ?? 1.8);
            const h = Math.max(20, heightCells * cfg.dpi);
            const w = Math.max(20, h * ratio);
            const center = snapBypassRef.current
              ? item.world
              : GridEngine.snapToGrid(item.world, cfg);
            st.addEntity({
              shape: 'RECT',
              x: center.x, y: center.y,
              w, h,
              rotation: 0,
              color: '#ffffff',
              locked: false,
              assetId: item.assetId,
              label: item.name.slice(0, 24),
            });
          }
          consume();
        };
        return (
          <AssetTypeDialog
            name={item.name}
            previewUrl={item.previewUrl}
            onChoose={onChoose}
            onCancel={() => {
              void assetCache.destroy(item.assetId);
              consume();
            }}
          />
        );
      })()}
    </div>
  );
}

function InitiativeMount() {
  const open = useMapStore((s) => s.initiativeOpen);
  const setOpen = useMapStore((s) => s.setInitiativeOpen);
  if (!open) return null;
  return <InitiativePanel onClose={() => setOpen(false)} />;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-zinc-400 mb-1">{label}</div>
      {children}
    </div>
  );
}

function ViewportControls() {
  const camera = useMapStore((s) => s.camera);
  const setCamera = useMapStore((s) => s.setCamera);
  const resetCamera = useMapStore((s) => s.resetCamera);
  return (
    <div className="border-t border-[#2a2b30] pt-2 space-y-2">
      <div className="text-zinc-400 uppercase tracking-wider text-[10px]">Viewport</div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-zinc-400 mb-1">Pos X</div>
          <input
            type="number"
            value={Math.round(camera.x)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setCamera({ x: v });
            }}
            className="w-full bg-[#1f2024] border border-[#2a2b30] rounded px-2 py-1 text-zinc-200"
          />
        </div>
        <div>
          <div className="text-zinc-400 mb-1">Pos Y</div>
          <input
            type="number"
            value={Math.round(camera.y)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setCamera({ y: v });
            }}
            className="w-full bg-[#1f2024] border border-[#2a2b30] rounded px-2 py-1 text-zinc-200"
          />
        </div>
        <div>
          <div className="text-zinc-400 mb-1">Zoom %</div>
          <input
            type="number"
            min={5}
            max={500}
            value={Math.round(camera.scale * 100)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v > 0) setCamera({ scale: v / 100 });
            }}
            className="w-full bg-[#1f2024] border border-[#2a2b30] rounded px-2 py-1 text-zinc-200"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => resetCamera()}
        className="w-full h-7 rounded border border-[#2a2b30] hover:bg-[#1f2024] text-zinc-200"
      >
        Resetar viewport
      </button>
    </div>
  );
}


/** '#rrggbb' (ou rgb()) → rgba com alpha aplicado. Fallback se inválido. */
function withAlpha(color: string, alpha: number): string {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const rgb = color.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const parts = rgb[1].split(',').map((x) => x.trim());
    return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`;
  }
  return color;
}

export default MapaModule;

