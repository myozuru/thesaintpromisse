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

export interface DetectOpts {
  moving: Entity;
  prevX: number;
  prevY: number;
  entities: Record<string, Entity>;
  grants: Record<string, AdoGrant>;
  /** charId → name (para preencher rótulo). */
  charNames: Record<string, string>;
  grid: GridLike;
}

export function detectOpportunityCandidates(opts: DetectOpts): AdoCandidate[] {
  const { moving, prevX, prevY, entities, grants, charNames, grid } = opts;
  const movingCharId = moving.characterId;
  if (!movingCharId) return [];
  const cellPx = grid.dpi || 70;

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

    const wasAdj = isAdjacent(prevX, prevY, moving, ent, cellPx);
    const nowAdj = isAdjacent(moving.x, moving.y, moving, ent, cellPx);
    if (wasAdj && !nowAdj) {
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
