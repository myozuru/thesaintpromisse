/**
 * SUPORTE — Transmitir Conhecimento (sup-transmitir-conhecimento, Nv 2).
 * Durante um descanso, concede treinamento temporário em perícias treinadas
 * do Suporte para aliados. Limite de ALIADOS afetados: ⌊BT/2⌋ no descanso
 * curto, BT no longo. O treinamento dura até o próximo descanso do ALIADO.
 * Funções puras + ações no store. UI em SuporteTransmitirSection.tsx.
 */
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { hasSpecAbility } from '@/lib/suporteNivel2';

export const TRANSMITIR_ID = 'sup-transmitir-conhecimento';
export type TransmitirMode = 'curto' | 'longo';

/** Quantos aliados podem ser preparados neste descanso. */
export function getTransmitirLimite(
  c: Pick<Character, 'level' | 'chosenSpecAbilities'>,
  mode: TransmitirMode,
): number {
  if (!hasSpecAbility(c, TRANSMITIR_ID)) return 0;
  const bt = getTrainingBonusByLevel(c.level ?? 1);
  return mode === 'longo' ? bt : Math.floor(bt / 2);
}

/** Sessão atual: aliados já preparados neste descanso (modo muda → recomeça). */
export function getTransmitirAliados(c: Character, mode: TransmitirMode): string[] {
  const s = c.transmitirSession;
  if (!s || s.mode !== mode) return [];
  return s.allyIds;
}

/** Perícias que o Suporte pode transmitir: as que ele é treinado. */
export function getTransmitirOpcoes(c: Character): string[] {
  return (c.skills ?? []).filter((s) => s.trained).map((s) => s.name);
}

export function podeTransmitir(
  c: Character,
  ally: Character,
  skillName: string,
  mode: TransmitirMode,
): { ok: boolean; reason?: string } {
  if (!hasSpecAbility(c, TRANSMITIR_ID)) return { ok: false, reason: 'Sem Transmitir Conhecimento.' };
  if (ally.id === c.id) return { ok: false, reason: 'Você não pode transmitir para si mesmo.' };
  if (ally.category !== 'PLAYER') return { ok: false, reason: 'Só aliados Jogadores podem ser preparados.' };
  if (!getTransmitirOpcoes(c).includes(skillName)) return { ok: false, reason: 'Você não é treinado nesta perícia.' };
  const allySkill = (ally.skills ?? []).find((s) => s.name === skillName);
  if (!allySkill) return { ok: false, reason: 'O aliado não tem esta perícia na ficha.' };
  if (allySkill.trained) return { ok: false, reason: 'O aliado já é treinado nesta perícia.' };
  const usados = getTransmitirAliados(c, mode);
  if (!usados.includes(ally.id) && usados.length >= getTransmitirLimite(c, mode)) {
    return { ok: false, reason: `Limite de aliados deste descanso atingido (${getTransmitirLimite(c, mode)}).` };
  }
  return { ok: true };
}

/** Concede o treinamento temporário e registra o aliado na sessão. */
export function transmitir(
  c: Character,
  ally: Character,
  skillName: string,
  mode: TransmitirMode,
): { ok: boolean; reason?: string } {
  const check = podeTransmitir(c, ally, skillName, mode);
  if (!check.ok) return check;
  const store = useCharacterStore.getState();
  store.updateCharacter(ally.id, {
    skills: ally.skills.map((s) => (s.name === skillName ? { ...s, trained: true } : s)),
    transmitirTempSkills: [...(ally.transmitirTempSkills ?? []), skillName],
  });
  const usados = getTransmitirAliados(c, mode);
  store.updateCharacter(c.id, {
    transmitirSession: { mode, allyIds: usados.includes(ally.id) ? usados : [...usados, ally.id] },
  });
  return { ok: true };
}

/**
 * Expiração no descanso: devolve os campos a limpar (treinamentos temporários
 * recebidos e a sessão de transmissão) ou null se não há nada a fazer.
 * Usado por applyShortRest/applyLongRest.
 */
export function expireTransmitir(c: Character): Partial<Character> | null {
  const temps = c.transmitirTempSkills ?? [];
  if (temps.length === 0 && !c.transmitirSession) return null;
  const tempSet = new Set(temps);
  return {
    skills: c.skills.map((s) => (tempSet.has(s.name) ? { ...s, trained: false } : s)),
    transmitirTempSkills: undefined,
    transmitirSession: undefined,
  };
}
