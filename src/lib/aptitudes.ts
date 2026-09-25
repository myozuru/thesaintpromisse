/**
 * @deprecated Sistema antigo de Aptidões Amaldiçoadas baseado em catálogo de IDs textuais.
 *
 * SUBSTITUÍDO pelo novo sistema numérico em `src/types/index.ts`:
 *   - `Character.cursedAptitudes`: { AU, CL, BAR, DOM, ER } (0..5 cada)
 *   - `Character.pendingAptitudePoints`: pontos a distribuir
 *   - Constantes: `APTITUDE_KEYS`, `APTITUDE_LABELS`, `APTITUDE_MIN`, `APTITUDE_MAX`
 *   - `createDefaultCursedAptitudes()`
 *
 * Este arquivo é mantido como stub para não quebrar imports legados
 * (ex.: `requiredAptitudes` em SpecAbility/Talent gating). Não adicione novas entradas aqui.
 */

export type CursedAptitudeCategory = 'basic' | 'domain' | 'advanced' | 'maximum';

export interface CursedAptitude {
  id: string;
  name: string;
  category: CursedAptitudeCategory;
  flavor: string;
  mechanic: string;
  prerequisitesText?: string;
}

/** @deprecated Use o sistema numérico em `Character.cursedAptitudes`. */
export const CURSED_APTITUDES: CursedAptitude[] = [];

/** @deprecated */
export function getCursedAptitudeById(id: string): CursedAptitude | undefined {
  return CURSED_APTITUDES.find(a => a.id === id);
}
