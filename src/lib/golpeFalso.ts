/**
 * Especialista em Combate — Habilidade de 2º nível: Golpe Falso.
 *
 * Como REAÇÃO a um aliado atacando um inimigo que esteja dentro do alcance
 * de ataque da arma empunhada pelo Especialista, ele finge um golpe:
 * o inimigo faz um TR de Astúcia contra a CD de Especialização e, se falhar,
 * o aliado recebe VANTAGEM no teste de ataque.
 *
 * Alcance = arma empunhada (mão principal). Corpo a corpo já soma os
 * +1,5 m de Extensão do Corpo, quando o Especialista a possui.
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { armaDoPersonagem } from '@/lib/omni/armaDoPersonagem';
import { weaponMaxRangeMeters, distanceBetweenChars } from '@/lib/weaponRange';
import { extensaoAlcanceBonus } from '@/lib/extensaoCorpo';
import { penalidadeTRFlanqueado } from '@/lib/flanqueadorSuperior';
import { specDCFor } from '@/lib/golpeEspecial';
import { getTrainingBonus } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { useLogStore } from '@/stores/useLogStore';
import { grantAdvantage } from '@/lib/omni/rollAdvantage';
import { rollD20Com } from '@/lib/dice';
import { useReactionStore } from '@/stores/useReactionStore';
import { getReactionsAvailable } from '@/lib/reactionBudget';

export const GOLPE_FALSO_ID = 'ec-golpe-falso';

export function hasGolpeFalso(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === GOLPE_FALSO_ID);
}

/** Alcance de ataque em metros da arma empunhada (null = sem arma/alcance). */
export function golpeFalsoAlcanceM(c: Character): number | null {
  const w = c.mainHandWeaponName ? armaDoPersonagem(c.id, c.mainHandWeaponName, c.mainHandWeaponInstanceId ?? undefined) : null;
  if (!w) return null;
  const bonus = w.range === 'melee'
    ? ((c as { meleeRangeBonus?: number }).meleeRangeBonus ?? 0) + extensaoAlcanceBonus(c)
    : 0;
  return weaponMaxRangeMeters(w, bonus);
}

/** Distância Especialista → inimigo no mapa (null = alguém fora do mapa). */
export function golpeFalsoDistancia(espId: string, inimigoId: string): number | null {
  const cs = useCharacterStore.getState().characters;
  const esp = cs.find((x) => x.id === espId);
  const ini = cs.find((x) => x.id === inimigoId);
  const { entities, gridConfig } = useMapStore.getState();
  return distanceBetweenChars(espId, inimigoId, entities as never, gridConfig as never, {
    casterProfileId: esp?.profileId,
    targetProfileId: ini?.profileId,
  });
}

/** Modificador de TR de Astúcia do alvo (inclui Flanqueador Superior). */
export function astuciaMod(alvo: Character): number {
  const st = (alvo.savingThrows ?? []).find((s) => s.name === 'Astúcia');
  const attr = st?.linkedAttribute
    ? (alvo.attributes ?? []).find((a) => a.name === st.linkedAttribute)
    : (alvo.attributes ?? []).find((a) => a.name === 'Inteligência');
  const attrMod = attr ? Math.floor((((attr.value ?? 10) + (attr.externalBonus ?? 0)) - 10) / 2) : 0;
  const train = st ? getTrainingBonus(alvo.level ?? 1, st.trained, st.mastery) : 0;
  const base = st?.value ?? 0;
  const ext = st?.externalBonus ?? 0;
  const ms = useMapStore.getState();
  const flank = penalidadeTRFlanqueado(
    alvo,
    useCharacterStore.getState().characters,
    ms.entities as never,
    ms.gridConfig as never,
  );
  return base + attrMod + train + ext + flank;
}

export type GolpeFalsoResultado =
  | { ok: true; d20: number; total: number; cd: number; falhou: boolean }
  | { ok: false; reason: string };

/** Checagem de pré-requisitos, sem gastar nada. */
export function golpeFalsoPodeUsar(espId: string, aliadoId: string, inimigoId: string): { ok: boolean; reason?: string } {
  const cs = useCharacterStore.getState().characters;
  const esp = cs.find((x) => x.id === espId);
  if (!esp || !hasGolpeFalso(esp)) return { ok: false, reason: 'Sem Golpe Falso.' };
  if (aliadoId === espId) return { ok: false, reason: 'O golpe falso auxilia outro aliado.' };
  if (!cs.find((x) => x.id === aliadoId)) return { ok: false, reason: 'Escolha o aliado que vai atacar.' };
  const ini = cs.find((x) => x.id === inimigoId);
  if (!ini) return { ok: false, reason: 'Escolha o inimigo atacado.' };
  if (getReactionsAvailable(esp) <= 0) return { ok: false, reason: 'Sem reação disponível.' };
  const alcance = golpeFalsoAlcanceM(esp);
  if (alcance === null) return { ok: false, reason: 'Empunhe uma arma para medir o alcance.' };
  const d = golpeFalsoDistancia(espId, inimigoId);
  if (d === null) return { ok: false, reason: 'Inimigo sem peça no mapa — não dá para medir o alcance.' };
  if (d > alcance + 0.05) {
    return { ok: false, reason: `Inimigo a ${d.toFixed(1).replace('.', ',')} m — fora do alcance de ${alcance} m.` };
  }
  return { ok: true };
}

/**
 * Executa o Golpe Falso: gasta a reação, o inimigo rola TR de Astúcia contra
 * a CD de Especialização e, se falhar, o aliado ganha vantagem no ataque.
 */
export async function golpeFalsoExecutar(
  espId: string,
  aliadoId: string,
  inimigoId: string,
): Promise<GolpeFalsoResultado> {
  const log = useLogStore.getState().addLog;
  const chk = golpeFalsoPodeUsar(espId, aliadoId, inimigoId);
  const cs = useCharacterStore.getState().characters;
  const esp = cs.find((x) => x.id === espId);
  if (!chk.ok) {
    log('combat', `🎭 ${esp?.name ?? '?'}: Golpe Falso falhou — ${chk.reason}`);
    return { ok: false, reason: chk.reason ?? 'Não é possível.' };
  }
  const aliado = cs.find((x) => x.id === aliadoId)!;
  const ini = cs.find((x) => x.id === inimigoId)!;

  if (!useReactionStore.getState().consumeReaction(espId)) {
    return { ok: false, reason: 'Sem reação disponível.' };
  }

  const cd = specDCFor(esp!);
  const mod = astuciaMod(ini);
  const d20 = await rollD20Com(inimigoId, undefined, { label: `Golpe Falso — TR de Astúcia (${ini.name})` });
  const total = d20 + mod;
  const falhou = total < cd;

  if (falhou) {
    grantAdvantage(aliadoId, 'advantage', 'next_attack', {
      expires: 'use',
      source: `Golpe Falso (${esp!.name})`,
      grantedBy: espId,
    });
  }
  log(
    'combat',
    `🎭 ${esp!.name} usa a reação (Golpe Falso) contra ${ini.name}: TR de Astúcia d20 ${d20} ${mod >= 0 ? '+' : ''}${mod} = ${total} vs CD ${cd} → ${
      falhou ? `❌ FALHA — ${aliado.name} ataca com vantagem` : '✅ SUCESSO — sem efeito'
    }.`,
  );
  return { ok: true, d20, total, cd, falhou };
}

/** Aliados do `atacante` que podem usar Golpe Falso contra `inimigoId` agora. */
export function golpeFalsoDisponiveisPara(atacanteId: string, inimigoId: string): Character[] {
  const cs = useCharacterStore.getState().characters;
  return cs.filter((x) => x.id !== atacanteId && hasGolpeFalso(x) && golpeFalsoPodeUsar(x.id, atacanteId, inimigoId).ok);
}
