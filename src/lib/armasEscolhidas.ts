/**
 * Especialista em Combate — Habilidade de 4º nível: Armas Escolhidas.
 *
 * Escolha um grupo de armas: seus ataques com armas desse grupo têm o nível
 * de dano aumentado em 3. Acumula com Golpes Potentes e Arremessos Potentes.
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import type { WeaponGroup } from '@/lib/weapons';

export const ARMAS_ESCOLHIDAS_ID = 'ec-armas-escolhidas';
export const ARMAS_ESCOLHIDAS_STEP = 3;

export const WEAPON_GROUPS: WeaponGroup[] = [
  'Faca', 'Bastão', 'Espada', 'Haste', 'Machado', 'Martelo',
  'Chicote', 'Pugilato', 'Arco', 'Besta', 'Tiro', 'Dardo',
];

export function hasArmasEscolhidas(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === ARMAS_ESCOLHIDAS_ID);
}

/** Grupo escolhido (null quando a escolha ainda está pendente). */
export function armasEscolhidasGrupo(c: Character | null | undefined): WeaponGroup | null {
  if (!hasArmasEscolhidas(c)) return null;
  const v = c?.specAbilityChoices?.[ARMAS_ESCOLHIDAS_ID];
  if (v && v.kind === 'weapon-group') return v.group as WeaponGroup;
  return null;
}

/** +3 níveis de dano com armas do grupo escolhido. */
export function armasEscolhidasStep(
  c: Character | null | undefined,
  w: { group?: string } | null | undefined,
): number {
  const g = armasEscolhidasGrupo(c);
  return g && w?.group === g ? ARMAS_ESCOLHIDAS_STEP : 0;
}
