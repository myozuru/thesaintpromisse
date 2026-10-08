import type { CharacterCategory } from '@/types';

export type LadoIniciativa = 'pc' | 'ally' | 'enemy' | 'neutral';

/** Lado da iniciativa pela categoria da ficha; sem ficha, usa a camada do token. */
export function ladoIniciativaPorFicha(category: CharacterCategory | undefined, layer?: string): LadoIniciativa {
  if (category === 'INIMIGO') return 'enemy';
  if (category === 'PLAYER') return 'pc';
  if (category === 'NPC') return 'ally';
  return layer === 'gm' ? 'enemy' : 'pc';
}
