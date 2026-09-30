/**
 * Especialista em Combate — Habilidade de 2º nível: Presença Suprimida.
 *
 *  - +2 em todas as rolagens de Furtividade.
 *  - A penalidade por atacar / fazer ações chamativas cai de −10 para −5.
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';

export const PRESENCA_SUPRIMIDA_ID = 'ec-presenca-suprimida';

/** Penalidade padrão do sistema por ação chamativa (sem a habilidade). */
export const PENALIDADE_CHAMATIVA_PADRAO = -10;
/** Penalidade reduzida concedida por Presença Suprimida. */
export const PENALIDADE_CHAMATIVA_REDUZIDA = -5;

export function hasPresencaSuprimida(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === PRESENCA_SUPRIMIDA_ID);
}

/** É uma rolagem de Furtividade? (tolerante a acento/caixa) */
export function ehFurtividade(name: string | null | undefined): boolean {
  return (name ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .includes('furtividade');
}

/** Bônus passivo em Furtividade (+2 com a habilidade). */
export function presencaSuprimidaBonus(c: Character | null | undefined, skillName: string): number {
  if (!ehFurtividade(skillName)) return 0;
  return hasPresencaSuprimida(c) ? 2 : 0;
}

/** Penalidade aplicada quando o jogador marca "após ataque / ação chamativa". */
export function penalidadeChamativa(c: Character | null | undefined): number {
  return hasPresencaSuprimida(c) ? PENALIDADE_CHAMATIVA_REDUZIDA : PENALIDADE_CHAMATIVA_PADRAO;
}
