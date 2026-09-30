/**
 * Especialista em Combate — Habilidade de 2º nível: Golpes Potentes.
 *
 * Sempre que o personagem usa uma arma com a qual é TREINADO:
 *  - o dano dela sobe 1 nível na tabela de passos;
 *  - as rolagens de dano recebem +2.
 *
 * O aumento de passo ACUMULA com Arremessos Potentes (arma de arremesso
 * treinada sobe 2 níveis no total).
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';

export const GOLPES_POTENTES_ID = 'ec-golpes-potentes';
export const GOLPES_POTENTES_DANO = 2;

export function hasGolpesPotentes(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === GOLPES_POTENTES_ID);
}

/** +1 passo de dano (só com arma treinada). */
export function golpesPotentesStep(c: Character | null | undefined, trained: boolean): number {
  return trained && hasGolpesPotentes(c) ? 1 : 0;
}

/** +2 fixo nas rolagens de dano (só com arma treinada). */
export function golpesPotentesDano(c: Character | null | undefined, trained: boolean): number {
  return trained && hasGolpesPotentes(c) ? GOLPES_POTENTES_DANO : 0;
}
