/**
 * Catálogo enxuto de escudos (livro p. 138).
 *
 * - `baseRD`: RD base concedida ao defender.
 * - `defenseBonus`: +N na Defesa enquanto equipado.
 * - `reflexPenalty`: penalidade em TR de Reflexos (positiva — subtrai).
 *   Talento "Defensivas de Escudo" inverte o sinal (vira bônus).
 * - `proficiencyTier`: 'simples' | 'pesado'.
 *
 * Mestre Defensivo: se já proficiente em escudos, RD = baseRD + floor(baseRD / 2).
 */
export interface Shield {
  id: string;
  name: string;
  baseRD: number;
  defenseBonus: number;
  reflexPenalty: number;
  proficiencyTier: 'simples' | 'pesado';
  cost: number;
  spaces: number;
}

export const SHIELDS: Shield[] = [
  { id: 'sh-leve',   name: 'Escudo Leve',    baseRD: 2, defenseBonus: 1, reflexPenalty: 0, proficiencyTier: 'simples', cost: 1, spaces: 1 },
  { id: 'sh-pesado', name: 'Escudo Pesado',  baseRD: 4, defenseBonus: 1, reflexPenalty: 2, proficiencyTier: 'pesado',   cost: 1, spaces: 2 },
  { id: 'sh-torre',  name: 'Escudo de Torre', baseRD: 6, defenseBonus: 2, reflexPenalty: 4, proficiencyTier: 'pesado',   cost: 2, spaces: 3 },
];

export function getShieldById(id?: string | null): Shield | undefined {
  if (!id) return undefined;
  return SHIELDS.find(s => s.id === id);
}

/** Aplica Mestre Defensivo: se já proficiente, RD efetiva = baseRD + floor(baseRD/2). */
export function effectiveShieldRD(s: Shield, opts: { mestreDefensivo?: boolean }): number {
  if (!opts.mestreDefensivo) return s.baseRD;
  return s.baseRD + Math.floor(s.baseRD / 2);
}
