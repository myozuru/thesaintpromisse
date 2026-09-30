/**
 * Modelo de dados das fichas de Chefe (bosses) do Mapa do Mundo.
 *
 * Cada campo sensível pode ser revelado ou ocultado pelo Mestre — jogadores
 * veem "???" no lugar do valor enquanto o campo estiver oculto.
 */
import type { DamageType } from '@/types';

export const BOSS_TIERS = [
  'Grau 4',
  'Grau 3',
  'Grau 2',
  'Grau 1',
  'Semi-Especial',
  'Grau Especial',
  'Calamidade',
] as const;
export type BossTier = (typeof BOSS_TIERS)[number];

/** Cor/acento de cada patamar (usa tokens do tema, sem cores cruas). */
export const BOSS_TIER_ACCENT: Record<BossTier, string> = {
  'Grau 4': 'text-muted-foreground border-muted-foreground/40 bg-muted/30',
  'Grau 3': 'text-sky-300 border-sky-400/40 bg-sky-500/10',
  'Grau 2': 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10',
  'Grau 1': 'text-amber-300 border-amber-400/40 bg-amber-500/10',
  'Semi-Especial': 'text-orange-300 border-orange-400/40 bg-orange-500/10',
  'Grau Especial': 'text-fuchsia-300 border-fuchsia-400/50 bg-fuchsia-500/10',
  Calamidade: 'text-red-300 border-red-400/60 bg-red-500/15',
};

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
  'nd',
  'patamar',
  'pv',
  'defesa',
  'rd',
  'fraquezas',
  'resistencias',
  'descricao',
  'habilidades',
] as const;
export type BossRevealField = (typeof BOSS_REVEAL_FIELDS)[number];

export interface Boss {
  id: string;
  nome: string;
  titulo?: string;
  /** Retrato em data URL (opcional). */
  retrato?: string;
  nd: number;
  patamar: BossTier;
  estado: BossState;
  pv: number;
  pvMax: number;
  defesa: number;
  rdGeral: number;
  rdPorTipo: Partial<Record<DamageType, number>>;
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
