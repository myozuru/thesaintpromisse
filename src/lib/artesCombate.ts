/**
 * Especialista em Combate — Artes do Combate (nível 1).
 *
 * Pontos de Preparo = nível de Especialista em Combate + Mod. de Sabedoria.
 * Cinco artes (custos em preparo):
 *   • Arremesso Ágil (1) — após ataque CaC, ação livre: ataque com arma de
 *     arremesso contra um SEGUNDO alvo.
 *   • Distração Letal (1) — no acerto, Defesa do alvo −(SAB/2, mín. 1) por 1 rodada.
 *   • Execução Silenciosa (1) — vs. criatura [Desprevenida]: +1d6 de dano,
 *     +1d6 a cada +2 no Mod. de Sabedoria.
 *   • Golpe Descendente (1) — no acerto de ataque CaC, sua Defesa +(SAB/2, mín. 1)
 *     até o começo do seu próximo turno.
 *   • Investida Imediata (2) — na ação de ataque, aproxima-se SAB × 1,5 m do
 *     alvo (sem AdO) e ataca em seguida.
 *
 * Recuperação: eliminar inimigo +1; ação comum "Analisar o campo" +2;
 * descanso curto = metade do máximo; descanso longo = total.
 *
 * Funções de regra puras + mutações via stores (mesmo padrão do Interceptador).
 * UI: ArtesCombatePanel.tsx (aba "Artes") e opções no AttackPanel.
 */
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { isEspecialistaCombate } from '@/lib/combateEstilos';

export type ArteCombateId =
  | 'arremesso_agil'
  | 'distracao_letal'
  | 'execucao_silenciosa'
  | 'golpe_descendente'
  | 'investida_imediata';

export interface ArteCombateDef {
  id: ArteCombateId;
  name: string;
  cost: number;
  summary: string;
}

export const ARTES_COMBATE: ArteCombateDef[] = [
  { id: 'arremesso_agil', name: 'Arremesso Ágil', cost: 1, summary: 'Após um ataque corpo a corpo, ação livre: um ataque com arma de arremesso contra um segundo alvo.' },
  { id: 'distracao_letal', name: 'Distração Letal', cost: 1, summary: 'Ao acertar um ataque, a Defesa do alvo cai em metade do Mod. de Sabedoria (mín. 1) por 1 rodada.' },
  { id: 'execucao_silenciosa', name: 'Execução Silenciosa', cost: 1, summary: 'Ataque em criatura Desprevenida: +1d6 de dano, +1d6 a cada +2 no Mod. de Sabedoria.' },
  { id: 'golpe_descendente', name: 'Golpe Descendente', cost: 1, summary: 'Ao acertar um ataque corpo a corpo, sua Defesa sobe em metade do Mod. de Sabedoria (mín. 1) até o começo do seu próximo turno.' },
  { id: 'investida_imediata', name: 'Investida Imediata', cost: 2, summary: 'Na ação de ataque, aproxima-se Mod. de Sabedoria × 1,5 m do alvo (sem ataques de oportunidade) e ataca em seguida.' },
];

export function hasArtesCombate(c: Pick<Character, 'specialization' | 'characterClass'>): boolean {
  return isEspecialistaCombate(c);
}

export function sabMod(c: Character): number {
  const a = (c.attributes ?? []).find((x) => x.name === 'Sabedoria');
  const v = (a?.value ?? 10) + (a?.externalBonus ?? 0);
  return Math.floor((v - 10) / 2);
}

/** Metade do Mod. de Sabedoria, mínimo 1, arredondando para baixo. */
export function metadeSab(c: Character): number {
  return Math.max(1, Math.floor(sabMod(c) / 2));
}

/** Dados d6 da Execução Silenciosa: 1d6 + 1d6 a cada +2 no Mod. de Sabedoria. */
export function execucaoSilenciosaDice(c: Character): number {
  return 1 + Math.floor(Math.max(0, sabMod(c)) / 2);
}

/** Deslocamento da Investida Imediata em metros: Mod. de Sabedoria × 1,5. */
export function investidaMoveMeters(c: Character): number {
  return Math.max(0, sabMod(c)) * 1.5;
}

export function getPreparoMax(c: Character): number {
  if (!hasArtesCombate(c)) return 0;
  return Math.max(0, (c.level ?? 1) + sabMod(c));
}

/** Preparo atual; se nunca inicializado, começa cheio. */
export function getPreparoAtual(c: Character): number {
  return c.preparoCurrent ?? getPreparoMax(c);
}

type R = { ok: true } | { ok: false; reason: string };

export function spendPreparo(charId: string, n: number): R {
  const st = useCharacterStore.getState();
  const p = st.characters.find((c) => c.id === charId);
  if (!p) return { ok: false, reason: 'Personagem não encontrado.' };
  const cur = getPreparoAtual(p);
  if (cur < n) return { ok: false, reason: `Preparo insuficiente (${cur}/${n}).` };
  st.updateCharacter(charId, { preparoCurrent: cur - n } as Partial<Character>);
  return { ok: true };
}

export function gainPreparo(charId: string, n: number, silent = false): void {
  const st = useCharacterStore.getState();
  const p = st.characters.find((c) => c.id === charId);
  if (!p || !hasArtesCombate(p)) return;
  const max = getPreparoMax(p);
  const cur = getPreparoAtual(p);
  const next = Math.min(max, cur + n);
  if (next === cur) return;
  st.updateCharacter(charId, { preparoCurrent: next } as Partial<Character>);
  if (!silent) {
    useLogStore.getState().addLog('combat', `🎯 ${p.name} recupera ${next - cur} Ponto(s) de Preparo (${next}/${max}).`);
  }
}

/** Eliminar um inimigo recupera 1 Ponto de Preparo. */
export function recoverPreparoOnKill(attackerId: string): void {
  const st = useCharacterStore.getState();
  const p = st.characters.find((c) => c.id === attackerId);
  if (!p || !hasArtesCombate(p)) return;
  gainPreparo(attackerId, 1);
}

/** Ação comum: analisar o campo de batalha → +2 Pontos de Preparo. */
export function analisarCampo(charId: string): R {
  const st = useCharacterStore.getState();
  const log = useLogStore.getState().addLog;
  const p = st.characters.find((c) => c.id === charId);
  const fail = (reason: string): R => { log('combat', `🎯 ${p?.name ?? '?'}: Analisar Campo falhou — ${reason}`); return { ok: false, reason }; };
  if (!p || !hasArtesCombate(p)) return fail('Apenas Especialista em Combate.');
  if ((p.actionsCurrent ?? 0) <= 0) return fail('Sem Ação Comum disponível.');
  st.updateCharacter(charId, { actionsCurrent: Math.max(0, (p.actionsCurrent ?? 0) - 1) } as Partial<Character>);
  gainPreparo(charId, 2, true);
  const after = useCharacterStore.getState().characters.find((c) => c.id === charId)!;
  log('combat', `🎯 ${p.name} usa a Ação Comum para analisar o campo de batalha: +2 Preparo (${getPreparoAtual(after)}/${getPreparoMax(after)}).`);
  return { ok: true };
}

/** Distração Letal: aplica penalidade de Defesa no alvo por 1 rodada. */
export function applyDistracaoLetal(targetId: string, amount: number, byName: string): void {
  const round = useCombatStore.getState().round ?? 1;
  useCharacterStore.getState().updateCharacter(targetId, {
    arteDefensePenalty: { amount, byName, round },
  } as Partial<Character>);
  const t = useCharacterStore.getState().characters.find((c) => c.id === targetId);
  useLogStore.getState().addLog('combat', `🎯 Distração Letal: Defesa de ${t?.name ?? '?'} −${amount} por 1 rodada (por ${byName}).`);
}

/** Golpe Descendente: bônus de Defesa no usuário até o começo do próximo turno dele. */
export function applyGolpeDescendente(charId: string, amount: number): void {
  useCharacterStore.getState().updateCharacter(charId, {
    arteGolpeDescendente: { amount },
  } as Partial<Character>);
  const p = useCharacterStore.getState().characters.find((c) => c.id === charId);
  useLogStore.getState().addLog('combat', `🎯 Golpe Descendente: Defesa de ${p?.name ?? '?'} +${amount} até o começo do próximo turno.`);
}
