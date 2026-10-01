/**
 * Modelo de dados das fichas de Chefe (bosses) do Mapa do Mundo.
 *
 * Cada campo sensível pode ser revelado ou ocultado pelo Mestre — jogadores
 * veem "???" no lugar do valor enquanto o campo estiver oculto.
 */
import type { DamageType } from '@/types';

export const BOSS_TIERS = [
  'Lacaio',
  'Capanga',
  'Desafio',
  'Especial',
  'Santo',
  'Calamidade',
] as const;
export type BossTier = (typeof BOSS_TIERS)[number];

/** Cor/acento de cada patamar (usa tokens do tema, sem cores cruas). */
export const BOSS_TIER_ACCENT: Record<BossTier, string> = {
  Lacaio: 'text-muted-foreground border-muted-foreground/40 bg-muted/30',
  Capanga: 'text-sky-300 border-sky-400/40 bg-sky-500/10',
  Desafio: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10',
  Especial: 'text-amber-300 border-amber-400/40 bg-amber-500/10',
  Santo: 'text-fuchsia-300 border-fuchsia-400/50 bg-fuchsia-500/10',
  Calamidade: 'text-red-300 border-red-400/60 bg-red-500/15',
};

/** Patamares antigos (Graus/Semi-Especial) mapeados para a nova lista. */
const LEGACY_TIER_MAP: Record<string, BossTier> = {
  'Grau 4': 'Lacaio',
  'Grau 3': 'Capanga',
  'Grau 2': 'Desafio',
  'Grau 1': 'Especial',
  'Semi-Especial': 'Especial',
  'Grau Especial': 'Santo',
  Calamidade: 'Calamidade',
};

/** Normaliza um patamar salvo no armazenamento para a lista atual. */
export function normalizeBossTier(value: unknown): BossTier {
  if (typeof value === 'string' && value in LEGACY_TIER_MAP) return LEGACY_TIER_MAP[value];
  return 'Lacaio';
}

export const BOSS_STATES = ['ATIVO', 'FURIA', 'ENFRAQUECIDO', 'DERROTADO', 'SELADO'] as const;
export type BossState = (typeof BOSS_STATES)[number];

export const BOSS_STATE_LABELS: Record<BossState, string> = {
  ATIVO: 'Ativo',
  FURIA: 'Em Fúria',
  ENFRAQUECIDO: 'Enfraquecido',
  DERROTADO: 'Derrotado',
  SELADO: 'Selado',
};

export type BossAbilityKind = 'ATAQUE' | 'PASSIVA' | 'REACAO' | 'FASE';

export const BOSS_ABILITY_LABELS: Record<BossAbilityKind, string> = {
  ATAQUE: 'Ataque',
  PASSIVA: 'Passiva',
  REACAO: 'Reação',
  FASE: 'Fase',
};

export interface BossAbility {
  id: string;
  nome: string;
  kind: BossAbilityKind;
  texto: string;
  /** Visível para jogadores? */
  revelada?: boolean;
}

/** Campos que o Mestre pode revelar individualmente. */
export const BOSS_REVEAL_FIELDS = [
  'retrato',
  'nd',
  'patamar',
  'estado',
  'tamanho',
  'tipo',
  'pv',
  'pvMax',
  'defesa',
  'rd',
  'fraquezas',
  'resistencias',
  'descricao',
  'habilidades',
] as const;
export type BossRevealField = (typeof BOSS_REVEAL_FIELDS)[number];

export const BOSS_REVEAL_LABELS: Record<BossRevealField, string> = {
  retrato: 'Foto',
  nd: 'ND',
  patamar: 'Patamar',
  estado: 'Estado',
  tamanho: 'Tamanho',
  tipo: 'Tipo',
  pv: 'PV atual',
  pvMax: 'PV máximo',
  defesa: 'Defesa',
  rd: 'RD',
  fraquezas: 'Fraquezas',
  resistencias: 'Resistências',
  descricao: 'Descrição',
  habilidades: 'Habilidades',
};


export interface Boss {
  id: string;
  nome: string;
  titulo?: string;
  /** Retrato em data URL (opcional). */
  retrato?: string;
  /** Enquadramento do retrato nos avatares circulares. */
  retratoZoom?: number;
  retratoX?: number;
  retratoY?: number;
  nd: number;
  patamar: BossTier;
  estado: BossState;
  pv: number;
  pvMax: number;
  defesa: number;
  rdGeral: number;
  rdPorTipo: Partial<Record<DamageType, number>>;
  /** Revelação individual de cada tipo de RD para jogadores. */
  rdTipoRevelado?: Partial<Record<DamageType, boolean>>;
  fraquezas: DamageType[];
  resistencias: DamageType[];
  descricao: string;
  tamanho: string;
  tipo: string;
  tatica: string;
  habilidades: BossAbility[];
  /** Notas privadas do Mestre — nunca exibidas a jogadores. */
  segredos: string;
  recompensas: string;
  /** A ficha inteira aparece para jogadores? */
  visivel: boolean;
  revelado: Partial<Record<BossRevealField, boolean>>;
  createdAt: number;
  updatedAt: number;
}

export const uidBoss = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `boss-${Math.random().toString(36).slice(2)}-${Date.now()}`;

export function createBoss(nome = 'Novo Chefe'): Boss {
  const now = Date.now();
  return {
    id: uidBoss(),
    nome,
    titulo: '',
    retratoZoom: 1,
    retratoX: 50,
    retratoY: 50,
    nd: 1,
    patamar: 'Grau 4',
    estado: 'ATIVO',
    pv: 100,
    pvMax: 100,
    defesa: 12,
    rdGeral: 0,
    rdPorTipo: {},
    fraquezas: [],
    resistencias: [],
    descricao: '',
    tamanho: 'Médio',
    tipo: 'Maldição',
    tatica: '',
    habilidades: [],
    segredos: '',
    recompensas: '',
    visivel: false,
    revelado: {},
    createdAt: now,
    updatedAt: now,
  };
}

/** Percentual de vida (0..1), protegido contra divisão por zero. */
export function bossHpRatio(boss: Boss): number {
  if (!boss.pvMax) return 0;
  return Math.max(0, Math.min(1, boss.pv / boss.pvMax));
}

/** O campo pode ser lido por este papel? */
export function canSeeField(boss: Boss, field: BossRevealField, isMaster: boolean): boolean {
  if (isMaster) return true;
  return boss.revelado[field] === true;
}
