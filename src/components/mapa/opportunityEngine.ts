/**
 * opportunityEngine — Detecção pura de gatilhos de Ataque de Oportunidade.
 *
 * Regra: a entidade `moving` saiu de adjacência (Chebyshev ≤ 1 célula entre
 * AABBs) com algum token `candidate` que possui grant ativo. Não considera
 * paredes/visão — escopo simples conforme spec do usuário.
 */
import type { Entity } from '@/stores/useMapStore';
import type { AdoGrant, AdoCandidate } from '@/stores/useOpportunityStore';

interface GridLike {
  dpi: number;
  metersPerCell: number;
}

function aabbEdgeDistance(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): { dx: number; dy: number } {
  const dx = Math.max(0, Math.abs(ax - bx) - (aw + bw) / 2);
  const dy = Math.max(0, Math.abs(ay - by) - (ah + bh) / 2);
  return { dx, dy };
}

function isAdjacent(
  movingX: number, movingY: number, m: Entity,
  c: Entity, cellPx: number,
): boolean {
  const { dx, dy } = aabbEdgeDistance(
    movingX, movingY, m.w, m.h,
    c.x, c.y, c.w, c.h,
  );
  // tolerância de 5% (snap)
  const tol = cellPx * 1.05;
  return dx <= tol && dy <= tol;
}

/** Linha exata contra o retângulo de posições adjacentes (Minkowski). */
function segmentoCruzaAdjacencia(a: { x: number; y: number }, b: { x: number; y: number }, moving: Entity, candidate: Entity, cellPx: number): boolean {
  const rx = (moving.w + candidate.w) / 2 + cellPx * 1.05;
  const ry = (moving.h + candidate.h) / 2 + cellPx * 1.05;
  const dx = b.x - a.x, dy = b.y - a.y;
  let t0 = 0, t1 = 1;
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) { if (t > t1) return false; t0 = Math.max(t0, t); }
    else { if (t < t0) return false; t1 = Math.min(t1, t); }
    return true;
  };
  return clip(-dx, a.x - (candidate.x - rx)) && clip(dx, candidate.x + rx - a.x)
    && clip(-dy, a.y - (candidate.y - ry)) && clip(dy, candidate.y + ry - a.y);
}

export interface DetectOpts {
  moving: Entity;
  prevX: number;
  prevY: number;
  entities: Record<string, Entity>;
  grants: Record<string, AdoGrant>;
  /** charId → name (para preencher rótulo). */
  charNames: Record<string, string>;
  grid: GridLike;
  /** Waypoints do arraste confirmado; pode incluir curvas no percurso. */
  trajetoria?: { x: number; y: number }[];
}

export function detectOpportunityCandidates(opts: DetectOpts): AdoCandidate[] {
  const { moving, prevX, prevY, entities, grants, charNames, grid } = opts;
  const movingCharId = moving.characterId;
  if (!movingCharId) return [];
  const cellPx = grid.dpi || 70;
  const waypoints = [
    { x: prevX, y: prevY },
    ...(opts.trajetoria ?? []),
    { x: moving.x, y: moving.y },
  ];

  const out: AdoCandidate[] = [];
  for (const ent of Object.values(entities)) {
    if (!ent || ent.id === moving.id) continue;
    const cid = ent.characterId;
    if (!cid) continue;
    const g = grants[cid];
    if (!g || g.consumed) continue;
    if (g.restrictToCharId && g.restrictToCharId !== movingCharId) continue;
    // Mesmo charId não dispara contra si.
    if (cid === movingCharId) continue;

    let withinThreat = isAdjacent(prevX, prevY, moving, ent, cellPx);
    let leftReach = false;
    for (let i = 1; i < waypoints.length; i++) {
      const from = waypoints[i - 1], point = waypoints[i];
      const nextWithinThreat = isAdjacent(point.x, point.y, moving, ent, cellPx);
      if ((withinThreat && !nextWithinThreat) || (!withinThreat && !nextWithinThreat && segmentoCruzaAdjacencia(from, point, moving, ent, cellPx))) leftReach = true;
      withinThreat = nextWithinThreat;
    }
    if (leftReach) {
      out.push({
        charId: cid,
        charName: charNames[cid] ?? ent.label ?? 'Personagem',
        entityId: ent.id,
        mode: g.mode,
      });
    }
  }
  return out;
}
