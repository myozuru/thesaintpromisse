import { DAMAGE_TYPE_LABELS, type DamageType } from '@/types';
import type { CadeiaOmni } from './cadeiaEventos';

/** Metadados fornecidos pelo produtor do golpe; ausência significa desconhecido. */
export interface MetadadosAtaqueDano {
  critical?: boolean;
  criticalFail?: boolean;
  isSneak?: boolean;
  isOpportunity?: boolean;
  kind?: 'melee' | 'ranged' | 'cursed';
}

/** Códigos públicos estáveis; não derivar da ordem de arrays de UI. */
export const CODIGOS_TIPO_DANO = Object.freeze({
  DCO: 1, DP: 2, DI: 3, DA: 4, DCG: 5, DCC: 6, DQ: 7, DS: 8,
  DAL: 9, DNR: 10, DE: 11, DPS: 12, DR: 13, DN: 14, DV: 15,
} satisfies Record<DamageType, number>);

/** Categoria do produtor do dano, independente da ficha atacante. */
export const CODIGOS_FONTE_DANO = Object.freeze({ arma: 1, feitico: 2, omni: 3, ambiente: 4 });
export type FonteDano = keyof typeof CODIGOS_FONTE_DANO;

/** Parcela independente de uma ocorrência de dano composta. */
export interface ParcelaDano {
  valor: number;
  tipo?: DamageType;
}

const normalizarNome = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const NOMES_TIPO_DANO: Record<string, DamageType> = {
  ...Object.fromEntries(Object.entries(DAMAGE_TYPE_LABELS).map(([id, label]) => [normalizarNome(label), id as DamageType])),
  ct: 'DCO', pf: 'DP', im: 'DI',
  corte: 'DCO', perfuracao: 'DP',
  impacto: 'DI', fogo: 'DQ', chamas: 'DQ', frio: 'DCG', gelo: 'DCG', congelamento: 'DCG',
  eletrico: 'DCC', eletricidade: 'DCC', choque: 'DCC', som: 'DS', sonico: 'DS',
  mental: 'DPS', psiquico: 'DPS', necro: 'DN', veneno: 'DV',
};

/** Nomes equivalentes legados; conceitos sem correspondência ficam desconhecidos. */
export function resolverTipoDano(valor?: string): DamageType | undefined {
  if (!valor) return undefined;
  const codigo = valor.trim().toUpperCase();
  if (Object.hasOwn(CODIGOS_TIPO_DANO, codigo)) return codigo as DamageType;
  const nome = normalizarNome(valor);
  return Object.hasOwn(NOMES_TIPO_DANO, nome) ? NOMES_TIPO_DANO[nome] : undefined;
}

export interface OpcoesDano {
  /** Contexto interno de encadeamento; não faz parte das keys numéricas. */
  cadeia?: CadeiaOmni;
  ignoresRD?: boolean;
  ignoresResistance?: boolean;
  attackerId?: string;
  isMelee?: boolean;
  tags?: string[];
  rdIgnore?: number;
  attack?: MetadadosAtaqueDano;
  source?: FonteDano;
  /** Componentes tipados mitigados separadamente dentro da mesma ocorrência. */
  parcelas?: ParcelaDano[];
}

/** Converte somente informações conhecidas para o namespace numérico DANO. */
export function montarMetadadosDano(opts?: OpcoesDano, distancia?: number | null, tipoDano?: string): Record<string, number> {
  const bag: Record<string, number> = {};
  const tipo = resolverTipoDano(tipoDano);
  if (tipo) bag.tipo = CODIGOS_TIPO_DANO[tipo];
  if (opts?.source && Object.hasOwn(CODIGOS_FONTE_DANO, opts.source)) bag.fonte = CODIGOS_FONTE_DANO[opts.source];
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
