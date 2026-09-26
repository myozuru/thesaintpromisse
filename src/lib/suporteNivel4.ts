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
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { getSuporteKeyMod } from '@/lib/suporteAbilities';
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
  return !c.isGrimorioCreature && (c.category === 'PLAYER' || c.category === 'NPC');
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

// ===================== Inspirar Aliados =====================

export const INSPIRAR_ID = 'sup-inspirar-aliados';
export const INTERVENCAO_ID = 'sup-intervencao';
export const INSPIRAR_PE = 1;
export const INSPIRAR_DURACAO_S = 600; // 10 minutos no relógio do jogo

export function getInspirarMaxAliados(c: Pick<Character, 'level'>): number {
  return Math.floor(getTrainingBonusByLevel(c.level ?? 1) / 2);
}

/** Usos totais compartilhados = mod de Presença/Sabedoria (mín. 1). */
export function getInspirarUsos(c: Pick<Character, 'attributes' | 'keyAttribute'>): number {
  return Math.max(1, getSuporteKeyMod(c));
}

export function canInspirar(c: Character, allyIds: string[]): { ok: boolean; reason?: string } {
  if (!hasSpecAbility(c, INSPIRAR_ID)) return { ok: false, reason: 'Sem Inspirar Aliados.' };
  if (c.inspirarUsadoCena) return { ok: false, reason: 'Já usado nesta cena.' };
  if ((c.peCurrent ?? 0) < INSPIRAR_PE) return { ok: false, reason: 'PE insuficiente (1 PE).' };
  const max = getInspirarMaxAliados(c);
  if (allyIds.length === 0) return { ok: false, reason: 'Escolha ao menos um aliado.' };
  if (allyIds.length > max) return { ok: false, reason: `Máximo de ${max} aliado(s).` };
  if (allyIds.includes(c.id)) return { ok: false, reason: 'Escolha aliados, não você.' };
  return { ok: true };
}

/** Patch no Suporte ao inspirar. `now` = segundos na linha do tempo do relógio. */
export function buildInspirar(c: Character, allyIds: string[], now: number): Partial<Character> {
  return {
    peCurrent: (c.peCurrent ?? 0) - INSPIRAR_PE,
    inspirarUsadoCena: true,
    inspiracao: { allyIds, usesLeft: getInspirarUsos(c), expiresAt: now + INSPIRAR_DURACAO_S },
  };
}

/** Suporte cuja inspiração está ativa para esse aliado. */
export function findInspiracaoFor(allyId: string, chars: Character[], now: number): Character | null {
  return chars.find((s) => {
    const i = s.inspiracao;
    return !!i && i.usesLeft > 0 && now < i.expiresAt && i.allyIds.includes(allyId);
  }) ?? null;
}

export function inspiracaoExpirada(s: Pick<Character, 'inspiracao'>, now: number): boolean {
  const i = s.inspiracao;
  return !!i && (i.usesLeft <= 0 || now >= i.expiresAt);
}

// ===================== Intervenção =====================

export type GrauCondicao = 'fraca' | 'media' | 'forte' | 'extrema' | 'variavel' | 'especial';

export const GRAU_CONDICAO: Record<string, GrauCondicao> = {
  condenado: 'media', engasgando: 'media', enjoado: 'media', envenenado: 'media', sangramento: 'variavel', sofrendo: 'fraca',
  atordoado: 'extrema', inconsciente: 'extrema', paralisado: 'extrema', indefeso: 'especial',
  abalado: 'fraca', amedrontado: 'media', aterrorizado: 'forte', confuso: 'media', enfeiticado: 'media',
  agarrado: 'media', caido: 'fraca', enredado: 'media', imovel: 'forte', lento: 'media',
  cego: 'forte', desorientado: 'fraca', desprevenido: 'fraca', invisivel: 'especial', surdo: 'media', surpreso: 'especial',
  exposto: 'forte', fragilizado: 'forte',
  // Condições internas do sistema, fora da lista do livro: não removíveis.
  marcado: 'especial', morto: 'especial', desmaiado: 'especial',
};

const ORDEM: Record<'fraca' | 'media' | 'forte' | 'extrema', number> = { fraca: 0, media: 1, forte: 2, extrema: 3 };
export type GrauRemovivel = keyof typeof ORDEM;

/** Grau máximo removível: fraca; média no Nv 6; forte no Nv 12; extrema no Nv 18. */
export function getGrauMaximo(level: number): GrauRemovivel {
  if (level >= 18) return 'extrema';
  if (level >= 12) return 'forte';
  if (level >= 6) return 'media';
  return 'fraca';
}

/** 3 PE + 3 por grau acima de fraca. */
export function getIntervencaoCusto(grau: GrauRemovivel): number {
  return 3 + 3 * ORDEM[grau];
}

/** Para condições de grau variável (Sangramento) o Suporte informa o grau. */
export function checkIntervencao(
  sup: Character,
  conditionId: string,
  grauVariavel?: GrauRemovivel,
): { ok: true; grau: GrauRemovivel; custo: number } | { ok: false; reason: string } {
  if (!hasSpecAbility(sup, INTERVENCAO_ID)) return { ok: false, reason: 'Sem Intervenção.' };
  const g = GRAU_CONDICAO[conditionId];
  if (!g) return { ok: false, reason: 'Condição sem grau definido.' };
  if (g === 'especial') return { ok: false, reason: 'Condições especiais não podem ser encerradas por Intervenção.' };
  const grau: GrauRemovivel | undefined = g === 'variavel' ? grauVariavel : g;
  if (!grau) return { ok: false, reason: 'Informe o grau desta condição.' };
  if (ORDEM[grau] > ORDEM[getGrauMaximo(sup.level ?? 1)]) return { ok: false, reason: `Seu nível ainda não permite encerrar condições ${grau === 'media' ? 'médias' : grau + 's'}.` };
  const custo = getIntervencaoCusto(grau);
  if ((sup.peCurrent ?? 0) < custo) return { ok: false, reason: `PE insuficiente (${custo} PE).` };
  return { ok: true, grau, custo };
}
