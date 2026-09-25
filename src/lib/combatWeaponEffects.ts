/**
 * Fase 4b — Efeitos passivos/ativos do Especialista em Técnica em ARMAS
 * escolhidas via "Técnicas de Combate" (`tec-tecnicas-de-combate`).
 *
 * Cobertura:
 *   • tec-combate-amaldicoado (passivo): +TB de dano nas armas escolhidas.
 *   • tec-combate-amaldicoado (ativo, flag de cena
 *     `tecCombateAmaldicoadoActive`): +1 passo no dado de dano dessas armas.
 *   • tec-esgrimista-jujutsu: hook flag (consultado por handlers de UI).
 *
 * Não muta nada — devolve um delta consultável onde o dano é calculado.
 */
import type { Character } from '@/types';
import { getTrainingBonusByLevel } from './levelEngine';

export interface WeaponSpecEffects {
  /** Bônus de dano flat por golpe (Combate Amaldiçoado passivo). */
  flatDamageBonus: number;
  /** Quantos passos o dado de dano deve subir (Combate Amaldiçoado ativo). */
  dieStepBoost: number;
  /** Esgrimista Jujutsu disponível neste personagem. */
  esgrimistaJujutsu: boolean;
  /** True se a arma está na lista escolhida em Técnicas de Combate. */
  isChosenWeapon: boolean;
}

function hasAbility(c: Pick<Character, 'chosenSpecAbilities'>, id: string): boolean {
  return (c.chosenSpecAbilities ?? []).some(a => a.abilityId === id);
}

/**
 * Lê os IDs/nomes de armas escolhidas em Técnicas de Combate
 * (`specAbilityChoices['tec-tecnicas-de-combate']` — kind 'weapons').
 */
export function getChosenCombatWeapons(
  c: Pick<Character, 'specAbilityChoices'>,
): string[] {
  const choice = (c.specAbilityChoices ?? {})['tec-tecnicas-de-combate'];
  if (!choice || choice.kind !== 'weapons') return [];
  return choice.weapons ?? [];
}

export function getWeaponSpecEffects(
  c: Pick<
    Character,
    | 'chosenSpecAbilities'
    | 'specAbilityChoices'
    | 'level'
    | 'tecCombateAmaldicoadoActive'
  >,
  weaponIdOrName: string,
): WeaponSpecEffects {
  const out: WeaponSpecEffects = {
    flatDamageBonus: 0,
    dieStepBoost: 0,
    esgrimistaJujutsu: hasAbility(c, 'tec-esgrimista-jujutsu'),
    isChosenWeapon: false,
  };
  const chosen = getChosenCombatWeapons(c);
  if (!chosen.includes(weaponIdOrName)) return out;
  out.isChosenWeapon = true;

  if (hasAbility(c, 'tec-combate-amaldicoado')) {
    const tb = getTrainingBonusByLevel(Math.max(1, c.level ?? 1));
    out.flatDamageBonus += tb;
    if (c.tecCombateAmaldicoadoActive) {
      out.dieStepBoost += 1;
    }
  }
  return out;
}
