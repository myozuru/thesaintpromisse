/**
 * Especialista em Combate — Buscar Oportunidade (4º nível).
 * Ação Livre: um teste de Percepção por inimigo vivo no combate, CD 16 + 2 por
 * inimigo vivo. Cada inimigo só é testado uma vez por combate (passe ou falhe).
 * Contra os inimigos vencidos, o jogador escolhe UMA ação livre:
 *   • Andar — recupera o deslocamento do turno;
 *   • Desengajar — esses inimigos não fazem ataque de oportunidade (até o fim do turno);
 *   • Esconder — escondido desses inimigos: o próximo ataque contra cada um conta como Desprevenido.
 * Falhar não causa nada além de não ganhar a ação contra aquele inimigo.
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { rollDiceCom } from '@/lib/dice';
import { effectiveMovement } from '@/lib/movementBudget';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useLogStore } from '@/stores/useLogStore';

export const BUSCAR_OPORTUNIDADE_ID = 'ec-buscar-oportunidade';
export type AcaoOportunidade = 'andar' | 'desengajar' | 'esconder';

export function hasBuscarOportunidade(c: Character | null | undefined): boolean {
  return !!c && isEspecialistaCombate(c) && (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === BUSCAR_OPORTUNIDADE_ID);
}

export function inimigosVivos(): Character[] {
  const cs = useCombatStore.getState();
  if (!cs.inCombat) return [];
  const chars = useCharacterStore.getState().characters;
  return cs.initiativeOrder
    .map((e) => chars.find((c) => c.id === e.charId))
    .filter((c): c is Character => !!c && c.category === 'INIMIGO' && (c.hpCurrent ?? 1) > 0);
}

export const cdBuscar = (vivos: number) => 16 + 2 * vivos;

export function percepcaoBonus(c: Character): number {
  const sk = (c.skills ?? []).find((s) => (s.name ?? '').trim().toLowerCase() === 'percepção');
  const attrName = sk?.linkedAttribute ?? 'Sabedoria';
  const a = (c.attributes ?? []).find((x) => x.name === attrName);
  let t = Math.floor(((a?.value ?? 10) + (a?.externalBonus ?? 0) - 10) / 2);
  const tb = getTrainingBonusByLevel(c.level ?? 1);
  if (sk?.trained) t += tb;
  if (sk?.mastery) t += tb;
  if (sk?.externalBonus) t += sk.externalBonus;
  return t;
}

function estado(c: Character, combatId: string) {
  return c.buscarOportunidade?.combatId === combatId ? c.buscarOportunidade : { combatId, resultados: {}, ganhos: [] };
}

/** Inimigos vivos ainda não testados neste combate. */
export function inimigosPendentes(c: Character): Character[] {
  const id = useCombatStore.getState().combatId;
  if (!id) return [];
  const st = estado(c, id);
  return inimigosVivos().filter((e) => !(e.id in st.resultados));
}

export function ganhosPendentes(c: Character): string[] {
  const id = useCombatStore.getState().combatId;
  return id && c.buscarOportunidade?.combatId === id ? c.buscarOportunidade.ganhos : [];
}

export async function buscarOportunidade(charId: string): Promise<{ ok: boolean; reason?: string; ganhos?: string[] }> {
  const log = useLogStore.getState().addLog;
  const c = useCharacterStore.getState().characters.find((x) => x.id === charId);
  const combatId = useCombatStore.getState().combatId;
  if (!c || !hasBuscarOportunidade(c)) return { ok: false, reason: 'Sem Buscar Oportunidade.' };
  if (!useCombatStore.getState().inCombat || !combatId) return { ok: false, reason: 'Só em combate.' };
  if (ganhosPendentes(c).length) return { ok: false, reason: 'Escolha primeiro a ação livre do teste anterior.' };
  const pend = inimigosPendentes(c);
  if (!pend.length) return { ok: false, reason: 'Nenhum inimigo novo para testar neste combate.' };
  const cd = cdBuscar(inimigosVivos().length);
  const bonus = percepcaoBonus(c);
  const resultados = { ...estado(c, combatId).resultados };
  const ganhos: string[] = [];
  log('combat', `👁️ ${c.name} usa Buscar Oportunidade (Ação Livre): Percepção CD ${cd} contra ${pend.length} inimigo(s).`);
  for (const e of pend) {
    const { total } = await rollDiceCom(charId, '1d20', { bonus, label: `Buscar Oportunidade vs ${e.name}` });
    const t = total + bonus;
    const ok = t >= cd;
    resultados[e.id] = ok;
    if (ok) ganhos.push(e.id);
    log('combat', `   ↳ vs ${e.name}: ${total} ${bonus >= 0 ? '+' : ''}${bonus} = ${t} → ${ok ? '✅ sucesso' : '❌ falha'}`);
  }
  useCharacterStore.getState().updateCharacter(charId, { buscarOportunidade: { combatId, resultados, ganhos } });
  return { ok: true, ganhos };
}

export function escolherAcaoOportunidade(charId: string, acao: AcaoOportunidade): { ok: boolean; reason?: string } {
  const store = useCharacterStore.getState();
  const c = store.characters.find((x) => x.id === charId);
  const cs = useCombatStore.getState();
  if (!c || !cs.combatId) return { ok: false, reason: 'Só em combate.' };
  const ganhos = ganhosPendentes(c);
  if (!ganhos.length) return { ok: false, reason: 'Nenhum inimigo vencido no teste.' };
  const nomes = ganhos.map((id) => store.characters.find((x) => x.id === id)?.name ?? '?').join(', ');
  const log = useLogStore.getState().addLog;
  const patch: Partial<Character> = { buscarOportunidade: { ...c.buscarOportunidade!, ganhos: [] } };
  if (acao === 'andar') {
    const used = cs.movementUsedByChar[charId] ?? 0;
    cs.setMovementUsed(charId, Math.max(0, used - effectiveMovement(c)));
    log('combat', `🏃 Buscar Oportunidade: ${c.name} usa Andar como Ação Livre (+${effectiveMovement(c)} m de deslocamento).`);
  } else if (acao === 'desengajar') {
    patch.desengajadoDe = [...new Set([...(c.desengajadoDe ?? []), ...ganhos])];
    log('combat', `🛡️ Buscar Oportunidade: ${c.name} Desengaja de ${nomes} (sem ataques de oportunidade deles até o fim do turno).`);
  } else {
    const prev = c.escondidoDe?.combatId === cs.combatId ? c.escondidoDe.ids : [];
    patch.escondidoDe = { combatId: cs.combatId, ids: [...new Set([...prev, ...ganhos])] };
    log('combat', `🫥 Buscar Oportunidade: ${c.name} se Esconde de ${nomes}.`);
  }
  store.updateCharacter(charId, patch);
  return { ok: true };
}

export function escondidoDe(c: Character, alvoId: string | null | undefined): boolean {
  const id = useCombatStore.getState().combatId;
  return !!alvoId && !!id && c.escondidoDe?.combatId === id && c.escondidoDe.ids.includes(alvoId);
}

/** Atacar revela a posição para aquele inimigo. */
export function revelarPara(charId: string, alvoId: string) {
  const c = useCharacterStore.getState().characters.find((x) => x.id === charId);
  if (!c || !escondidoDe(c, alvoId)) return;
  useCharacterStore.getState().updateCharacter(charId, { escondidoDe: { ...c.escondidoDe!, ids: c.escondidoDe!.ids.filter((i) => i !== alvoId) } });
}
