/**
 * SUPORTE — Habilidades de 4º nível (1º par)
 *  • Apoios Versáteis     (sup-apoios-versateis) — +1 apoio avançado; +1 no Nv 10.
 *  • Guarda Sincronizada  (sup-guarda-sincronizada) — Ação Bônus; aliados a até 7,5 m
 *    que possam ver/ouvir (sem Cego/Surdo). Cada membro recebe +1 de Defesa por
 *    outro membro. Quem se afasta (> 7,5 m do Suporte) ou fica Cego/Surdo sai do grupo
 *    e não volta; se sobrar só o Suporte, a guarda acaba e precisa ser reativada.
 */
import type { Character } from '@/types';
import { hasSpecAbility } from '@/lib/suporteNivel2';
import { findCharEntity, touchDistanceMeters, type TouchEntity, type TouchGrid } from '@/lib/touchRange';

export const APOIOS_VERSATEIS_ID = 'sup-apoios-versateis';
export const GUARDA_ID = 'sup-guarda-sincronizada';
export const GUARDA_RANGE_M = 7.5;

// ===================== Apoios Versáteis =====================

export function getApoiosVersateisBonus(c: Pick<Character, 'level' | 'chosenSpecAbilities'>): number {
  if (!hasSpecAbility(c, APOIOS_VERSATEIS_ID)) return 0;
  return (c.level ?? 0) >= 10 ? 2 : 1;
}

// ===================== Guarda Sincronizada =====================

type Ent = TouchEntity & { characterId?: string };

export function isCegoOuSurdo(c: Pick<Character, 'activeConditions'>): boolean {
  return (c.activeConditions ?? []).some((cd) => {
    const id = (cd as { conditionId?: string }).conditionId;
    return id === 'cego' || id === 'surdo';
  });
}

function isAlly(c: Character): boolean {
  return !c.isGrimorioCreature;
}

/** Membros válidos a partir de uma lista de candidatos (inclui o Suporte). */
export function filterGuardaMembers(
  supportId: string,
  candidateIds: string[],
  chars: Character[],
  entities: Record<string, Ent>,
  grid: TouchGrid,
): string[] {
  const supEnt = findCharEntity(entities, supportId);
  if (!supEnt) return [];
  const byId = new Map(chars.map((c) => [c.id, c]));
  const out = [supportId];
  for (const id of candidateIds) {
    if (id === supportId) continue;
    const c = byId.get(id);
    if (!c || !isAlly(c) || isCegoOuSurdo(c)) continue;
    const e = findCharEntity(entities, id);
    if (!e) continue;
    if (touchDistanceMeters(supEnt, e, grid) > GUARDA_RANGE_M + 0.05) continue;
    out.push(id);
  }
  return out.length > 1 ? out : [];
}

/** Ativa: retorna membros ou motivo de falha. */
export function activateGuarda(
  sup: Character,
  chars: Character[],
  entities: Record<string, Ent>,
  grid: TouchGrid,
): { ok: true; members: string[] } | { ok: false; reason: string } {
  if (!hasSpecAbility(sup, GUARDA_ID)) return { ok: false, reason: 'Sem Guarda Sincronizada.' };
  if (!findCharEntity(entities, sup.id)) return { ok: false, reason: 'Sua peça precisa estar no mapa.' };
  const members = filterGuardaMembers(sup.id, chars.map((c) => c.id), chars, entities, grid);
  if (members.length === 0) return { ok: false, reason: 'Nenhum aliado a até 7,5 m que possa te ver ou ouvir.' };
  return { ok: true, members };
}

/** Bônus de Defesa de cada membro: +1 por outro membro. */
export function guardaBonus(members: string[]): number {
  return members.length > 1 ? members.length - 1 : 0;
}

/**
 * Recalcula todas as guardas ativas e devolve os patches necessários
 * (membros atualizados no Suporte e bônus em cada ficha). Idempotente.
 */
export function computeGuardaPatches(
  chars: Character[],
  entities: Record<string, Ent>,
  grid: TouchGrid,
): Array<{ id: string; patch: Partial<Character> }> {
  const bonusFor = new Map<string, { value: number; grantedBy: string }>();
  const patches: Array<{ id: string; patch: Partial<Character> }> = [];
  for (const sup of chars) {
    const g = sup.guardaSincronizada;
    if (!g || g.members.length === 0) continue;
    const next = filterGuardaMembers(sup.id, g.members, chars, entities, grid);
    if (next.join('|') !== g.members.join('|')) {
      patches.push({ id: sup.id, patch: { guardaSincronizada: next.length ? { members: next } : undefined } });
    }
    const v = guardaBonus(next);
    for (const id of next) {
      const cur = bonusFor.get(id);
      if (!cur || v > cur.value) bonusFor.set(id, { value: v, grantedBy: sup.id });
    }
  }
  for (const c of chars) {
    const want = bonusFor.get(c.id);
    const have = c.guardaSincronizadaBonus;
    if (!want && !have) continue;
    if (want && have && want.value === have.value && want.grantedBy === have.grantedBy) continue;
    const existing = patches.find((p) => p.id === c.id);
    if (existing) existing.patch.guardaSincronizadaBonus = want;
    else patches.push({ id: c.id, patch: { guardaSincronizadaBonus: want } });
  }
  return patches;
}
