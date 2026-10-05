/**
 * Especialista em Combate — Habilidade de 2º nível: Tiro Falso.
 *
 * Como REAÇÃO a um aliado atacando um inimigo dentro do alcance da arma à
 * distância ou de fogo empunhada, o Especialista finge um disparo: o inimigo
 * faz um TR de Astúcia contra a CD de Especialização e, se falhar, o aliado
 * recebe VANTAGEM no teste de ataque.
 *
 * Alcance considerado: alcance MÁXIMO total da arma (`rangeLong`).
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { findWeaponByName } from '@/lib/weapons';
import { weaponMaxRangeMeters } from '@/lib/weaponRange';
import { specDCFor } from '@/lib/golpeEspecial';
import { astuciaMod, golpeFalsoDistancia } from '@/lib/golpeFalso';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { grantAdvantage } from '@/lib/omni/rollAdvantage';
import { rollD20Com } from '@/lib/dice';
import { getReactionsAvailable } from '@/lib/reactionBudget';
import { useReactionStore } from '@/stores/useReactionStore';

export const TIRO_FALSO_ID = 'ec-tiro-falso';

export function hasTiroFalso(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === TIRO_FALSO_ID);
}

/**
 * Alcance máximo da arma empunhada, apenas se for à distância ou de fogo.
 * null = sem arma válida (corpo a corpo não serve para o Tiro Falso).
 */
export function tiroFalsoAlcanceM(c: Character): number | null {
  const w = c.mainHandWeaponName ? findWeaponByName(c.mainHandWeaponName) : null;
  if (!w || w.range === 'melee') return null;
  return weaponMaxRangeMeters(w);
}

export function tiroFalsoPodeUsar(
  espId: string,
  aliadoId: string,
  inimigoId: string,
): { ok: boolean; reason?: string } {
  const cs = useCharacterStore.getState().characters;
  const esp = cs.find((x) => x.id === espId);
  if (!esp || !hasTiroFalso(esp)) return { ok: false, reason: 'Sem Tiro Falso.' };
  if (aliadoId === espId) return { ok: false, reason: 'O tiro falso auxilia outro aliado.' };
  if (!cs.find((x) => x.id === aliadoId)) return { ok: false, reason: 'Escolha o aliado que vai atacar.' };
  if (!cs.find((x) => x.id === inimigoId)) return { ok: false, reason: 'Escolha o inimigo atacado.' };
  if (getReactionsAvailable(esp) <= 0) return { ok: false, reason: 'Sem reação disponível.' };
  const alcance = tiroFalsoAlcanceM(esp);
  if (alcance === null) {
    return { ok: false, reason: 'Empunhe uma arma à distância ou de fogo.' };
  }
  const d = golpeFalsoDistancia(espId, inimigoId);
  if (d === null) return { ok: false, reason: 'Inimigo sem peça no mapa — não dá para medir o alcance.' };
  if (d > alcance + 0.05) {
    return { ok: false, reason: `Inimigo a ${d.toFixed(1).replace('.', ',')} m — fora do alcance de ${alcance} m.` };
  }
  return { ok: true };
}

export type TiroFalsoResultado =
  | { ok: true; d20: number; total: number; cd: number; falhou: boolean }
  | { ok: false; reason: string };

export async function tiroFalsoExecutar(
  espId: string,
  aliadoId: string,
  inimigoId: string,
): Promise<TiroFalsoResultado> {
  const log = useLogStore.getState().addLog;
  const chk = tiroFalsoPodeUsar(espId, aliadoId, inimigoId);
  const cs = useCharacterStore.getState().characters;
  const esp = cs.find((x) => x.id === espId);
  if (!chk.ok) {
    log('combat', `🔫 ${esp?.name ?? '?'}: Tiro Falso falhou — ${chk.reason}`);
    return { ok: false, reason: chk.reason ?? 'Não é possível.' };
  }
  const aliado = cs.find((x) => x.id === aliadoId)!;
  const ini = cs.find((x) => x.id === inimigoId)!;

  if (!useReactionStore.getState().consumeReaction(espId)) {
    return { ok: false, reason: 'Sem reação disponível.' };
  }

  const cd = specDCFor(esp!);
  const mod = astuciaMod(ini);
  const d20 = await rollD20Com(inimigoId, undefined, { label: `Tiro Falso — TR de Astúcia (${ini.name})` });
  const total = d20 + mod;
  const falhou = total < cd;

  if (falhou) {
    grantAdvantage(aliadoId, 'advantage', 'next_attack', {
      expires: 'use',
      source: `Tiro Falso (${esp!.name})`,
      grantedBy: espId,
    });
  }
  log(
    'combat',
    `🔫 ${esp!.name} usa a reação (Tiro Falso) contra ${ini.name}: TR de Astúcia d20 ${d20} ${mod >= 0 ? '+' : ''}${mod} = ${total} vs CD ${cd} → ${
      falhou ? `❌ FALHA — ${aliado.name} ataca com vantagem` : '✅ SUCESSO — sem efeito'
    }.`,
  );
  return { ok: true, d20, total, cd, falhou };
}

/** Aliados do `atacante` que podem usar Tiro Falso contra `inimigoId` agora. */
export function tiroFalsoDisponiveisPara(atacanteId: string, inimigoId: string): Character[] {
  const cs = useCharacterStore.getState().characters;
  return cs.filter((x) => x.id !== atacanteId && hasTiroFalso(x) && tiroFalsoPodeUsar(x.id, atacanteId, inimigoId).ok);
}
