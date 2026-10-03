import { canonicalizarChave } from './keyAliases';

const ROTULOS_RECURSO: Record<string, string> = {
  vida: 'Vida',
  vida_max: 'Vida Máxima',
  pe: 'Energia',
  pe_max: 'Energia Máxima',
  defesa: 'Defesa',
  esquiva: 'Esquiva',
  rd_curse: 'Resistência',
  for: 'Força',
  des: 'Destreza',
  con: 'Constituição',
  int: 'Inteligência',
  sab: 'Sabedoria',
  pre: 'Presença',
};

export function recursoBonito(path?: string): string {
  const p = canonicalizarChave(path || 'vida') || 'vida';
  if (ROTULOS_RECURSO[p]) return ROTULOS_RECURSO[p];
  return p.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

