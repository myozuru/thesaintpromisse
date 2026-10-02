/** Metadados fornecidos pelo produtor do golpe; ausência significa desconhecido. */
export interface MetadadosAtaqueDano {
  critical?: boolean;
  criticalFail?: boolean;
  isSneak?: boolean;
  isOpportunity?: boolean;
  kind?: 'melee' | 'ranged' | 'cursed';
}

export interface OpcoesDano {
  ignoresRD?: boolean;
  ignoresResistance?: boolean;
  attackerId?: string;
  isMelee?: boolean;
  tags?: string[];
  rdIgnore?: number;
  attack?: MetadadosAtaqueDano;
}

/** Converte somente informações conhecidas para o namespace numérico DANO. */
export function montarMetadadosDano(opts?: OpcoesDano, distancia?: number | null): Record<string, number> {
  const bag: Record<string, number> = {};
  const attack = opts?.attack;
  for (const [key, value] of [
    ['foi_critico', attack?.critical],
    ['foi_falha_critica', attack?.criticalFail],
    ['foi_furtivo', attack?.isSneak],
    ['foi_ataque_oportunidade', attack?.isOpportunity],
  ] as const) {
    if (typeof value === 'boolean') bag[key] = value ? 1 : 0;
  }
  const kind = attack?.kind ?? (opts?.isMelee === undefined ? undefined : opts.isMelee ? 'melee' : 'ranged');
  if (kind) bag.tipo_ataque = { melee: 1, ranged: 2, cursed: 3 }[kind];
  if (typeof distancia === 'number' && Number.isFinite(distancia) && distancia >= 0) bag.alcance = distancia;
  return bag;
}
