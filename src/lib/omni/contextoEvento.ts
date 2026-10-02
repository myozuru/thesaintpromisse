import { DAMAGE_TYPES, DAMAGE_TYPE_LABELS } from '@/types';

/** Dados numéricos locais de um evento; nunca são gravados na ficha. */
export interface ContextosOmni {
  dano?: Record<string, number>;
  acao?: Record<string, number>;
  teste?: Record<string, number>;
  efeito?: Record<string, number>;
}

export function variaveisContexto(contexto?: ContextosOmni): Record<string, number> {
  const vars: Record<string, number> = {};
  for (const [prefixo, bag] of Object.entries(contexto ?? {})) {
    for (const [key, value] of Object.entries(bag ?? {})) {
      if (typeof value === 'number' && Number.isFinite(value)) vars[`${prefixo}_${key}`.toUpperCase()] = value;
    }
  }
  return vars;
}

export function contextoDano(inicial: number, final: number | undefined, opts: {
  tipo?: string; atacanteId?: string; alvoId?: string; isMelee?: boolean; tags?: string[];
  alcance?: number; contexto?: ContextosOmni;
} = {}): ContextosOmni {
  const tags = opts.tags ?? [];
  const tipo = opts.tipo ? DAMAGE_TYPES.findIndex((t) => t === opts.tipo || DAMAGE_TYPE_LABELS[t] === opts.tipo) + 1 : 0;
  const anteriores = Object.fromEntries(Object.entries(opts.contexto?.dano ?? {}).filter(([key]) => !['valor_final', 'absorvido'].includes(key)));
  return {
    ...opts.contexto,
    dano: {
      ...anteriores,
      tipo, fonte: opts.atacanteId ? 1 : 0,
      valor_inicial: inicial,
      ...(final === undefined ? {} : { valor_final: final, absorvido: Math.max(0, inicial - final) }),
      id_origem: opts.atacanteId ? 1 : 0, id_alvo: opts.alvoId ? 1 : 0,
      foi_critico: tags.includes('critical') ? 1 : opts.contexto?.dano?.foi_critico ?? 0,
      foi_falha_critica: tags.includes('critical_fail') ? 1 : opts.contexto?.dano?.foi_falha_critica ?? 0,
      foi_furtivo: tags.includes('furtivo') ? 1 : 0,
      foi_ataque_oportunidade: tags.includes('ado') ? 1 : 0,
      tipo_ataque: opts.contexto?.acao?.eh_feitico ? 3 : opts.isMelee === undefined ? opts.contexto?.acao?.eh_cac ? 1 : opts.contexto?.acao?.eh_distancia ? 2 : 0 : opts.isMelee ? 1 : 2,
      ...(opts.alcance === undefined ? {} : { alcance: opts.alcance }),
      resolvido: final === undefined ? 0 : 1,
    },
  };
}

export function contextoTeste(natural: number, total: number, dt: number, sucesso: boolean, ehTR: boolean): Record<string, number> {
  return { valor_natural: natural, total, dt, sucesso: sucesso ? 1 : 0, margem: total - dt, eh_tr: ehTR ? 1 : 0 };
}
