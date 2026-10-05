// ===== CONDITIONS SYSTEM =====

export const CONDITION_CATEGORIES = ['FÍSICA', 'INCAPACITAÇÃO', 'MENTAL', 'MOVIMENTO', 'SENSORIAL', 'VULNERABILIDADE'] as const;
export type ConditionCategory = typeof CONDITION_CATEGORIES[number];

export interface ConditionDef {
  id: string;
  name: string;
  category: ConditionCategory;
  description: string;
  icon: string;
}

export const ALL_CONDITIONS: ConditionDef[] = [
  // FÍSICAS
  { id: 'condenado', name: 'Condenado', category: 'FÍSICA', icon: '⛓', description: 'Custo em PE de todas as habilidades aumentado em 1.' },
  { id: 'engasgando', name: 'Engasgando', category: 'FÍSICA', icon: '🤢', description: 'O alvo fica mudo e precisa segurar o Ar.' },
  { id: 'enjoado', name: 'Enjoado', category: 'FÍSICA', icon: '🤮', description: 'Não pode converter ações dentro da Hierarquia de Ações.' },
  { id: 'envenenado', name: 'Envenenado', category: 'FÍSICA', icon: '☠️', description: 'Recebe -2 em jogadas de ataque, testes de resistência e testes de perícia.' },
  { id: 'sangramento', name: 'Sangramento', category: 'FÍSICA', icon: '🩸', description: 'Recebe perda de vida no início do turno. Teste de Fortitude no final (sucesso encerra).' },
  { id: 'sofrendo', name: 'Sofrendo', category: 'FÍSICA', icon: '😖', description: '-5 em concentração e Prestidigitação para rituais. Perde 3m de movimento.' },

  // INCAPACITAÇÃO
  { id: 'atordoado', name: 'Atordoado', category: 'INCAPACITAÇÃO', icon: '💫', description: 'Fica desprevenido. Não pode realizar ações ou reações.' },
  { id: 'inconsciente', name: 'Inconsciente', category: 'INCAPACITAÇÃO', icon: '💤', description: 'Não pode agir, fica caído. Falha em Reflexos, ataques acertam e são críticos.' },
  { id: 'paralisado', name: 'Paralisado', category: 'INCAPACITAÇÃO', icon: '🧊', description: 'Não pode agir exceto ações mentais. -10 Defesa, falha Reflexos, corpo a corpo = crítico.' },
  { id: 'indefeso', name: 'Indefeso', category: 'INCAPACITAÇÃO', icon: '🚫', description: 'Fica Imóvel e Atordoado. Pode ser morto com ação completa ao alcance de toque.' },

  // MENTAIS
  { id: 'abalado', name: 'Abalado', category: 'MENTAL', icon: '😰', description: '-1 em jogadas de ataque e testes de perícia.' },
  { id: 'amedrontado', name: 'Amedrontado', category: 'MENTAL', icon: '😨', description: '-3 em ataque e perícia. Não acumula com Abalado (evolução direta).' },
  { id: 'aterrorizado', name: 'Aterrorizado', category: 'MENTAL', icon: '😱', description: 'Não pode se aproximar de quem infligiu a condição.' },
  { id: 'confuso', name: 'Confuso', category: 'MENTAL', icon: '🌀', description: '-4 em Fortitude e Atletismo. Movimento aleatório a cada 1,5m (1d4/1d6).' },
  { id: 'enfeiticado', name: 'Enfeitiçado', category: 'MENTAL', icon: '💜', description: '-2 em todos os testes contra quem o enfeitiçou.' },

  // MOVIMENTO
  { id: 'agarrado', name: 'Agarrado', category: 'MOVIMENTO', icon: '🤼', description: 'Fica desprevenido e imóvel. Ataque à distância: 50% chance de errar o alvo.' },
  { id: 'caido', name: 'Caído', category: 'MOVIMENTO', icon: '🔻', description: '-3 ataque corpo a corpo, movimento 4,5m. -3 Defesa (corpo a corpo), +3 Defesa (distância).' },
  { id: 'enredado', name: 'Enredado', category: 'MOVIMENTO', icon: '🕸', description: 'Deslocamento reduzido à metade. -2 Defesa e ataques.' },
  { id: 'imovel', name: 'Imóvel', category: 'MOVIMENTO', icon: '🦶', description: 'Incapaz de ações de movimento. Não recebe Deslocamento de qualquer fonte.' },
  { id: 'lento', name: 'Lento', category: 'MOVIMENTO', icon: '🐌', description: 'Toda forma de movimento reduzida pela metade.' },

  // SENSORIAIS
  { id: 'cego', name: 'Cego', category: 'SENSORIAL', icon: '🙈', description: 'Fica Surpreso e Lento. -5 Percepção. Alvos recebem Camuflagem Total (50%).' },
  { id: 'desorientado', name: 'Desorientado', category: 'SENSORIAL', icon: '😵', description: 'Incapaz de reações contra próxima ação ofensiva ou ataques de oportunidade.' },
  { id: 'desprevenido', name: 'Desprevenido', category: 'SENSORIAL', icon: '👁', description: '-3 na Defesa e Testes de Reflexos.' },
  { id: 'surdo', name: 'Surdo', category: 'SENSORIAL', icon: '🔇', description: 'Falha em testes de audição. -5 em Iniciativa.' },
  { id: 'surpreso', name: 'Surpreso', category: 'SENSORIAL', icon: '❗', description: 'Fica Desprevenido. Não pode reagir contra quem o surpreendeu.' },

  // VULNERABILIDADE
  { id: 'exposto', name: 'Exposto', category: 'VULNERABILIDADE', icon: '🎯', description: '+4 em ataques contra a criatura. Dano adicional = nível do atacante.' },
  { id: 'fragilizado', name: 'Fragilizado', category: 'VULNERABILIDADE', icon: '💔', description: 'RD e resistências zerados. Não pode aumentar RD nem se tornar resistente.' },
  { id: 'marcado', name: 'Marcado', category: 'VULNERABILIDADE', icon: '🔖', description: 'Alvo marcado pelo conjurador. Fica visualmente destacado no mapa (aura + ícone) enquanto durar.' },

  // ESTADOS LIMITES
  { id: 'morto', name: 'Morto', category: 'INCAPACITAÇÃO', icon: '☠', description: 'O personagem está morto. HP = 0 e não pode agir.' },
  { id: 'desmaiado', name: 'Desmaiado', category: 'INCAPACITAÇÃO', icon: '😵‍💫', description: 'Inconsciente por exaustão extrema. Precisa de descansos longos para acordar.' },
];

// Modo de término da condição:
//  - 'ate_acabar'      → some quando os turnos zeram (sem teste).
//  - 'tr_todo_round'   → todo turno do alvo o jogador rola TR; sucesso encerra antes; falha mantém até zerar turnos.
//  - 'ate_passar_tr'   → não tem prazo; só sai quando o alvo passar no TR.
export type ConditionDurationMode = 'ate_acabar' | 'tr_todo_round' | 'ate_passar_tr';

export interface ActiveCondition {
  id: string;
  conditionId: string;
  name: string;
  icon: string;
  remainingTurns: number; // -1 = indefinido
  remainingRounds: number; // -1 = indefinido, decrementa a cada rodada completa
  /** Rodadas completas decorridas desde a aplicação; ausente = histórico desconhecido. */
  elapsedRounds?: number;
  sourceCharName?: string;
  /** Origem identificada para gatilhos; não é inferida pelo nome. */
  sourceCharId?: string;
  // === Sistema de duração estruturada (opcional para compat com fichas antigas) ===
  durationMode?: ConditionDurationMode;
  /** CD do teste de fim de condição (modos *_tr). */
  endCD?: number;
  /** Nome do TR a rolar (ex.: 'fortitude','reflexos','vontade','astucia','integridade'). */
  endTrType?: string;
}

export interface SpellCondition {
  conditionId: string;
  durationTurns: number; // 0 = use rounds instead
  durationRounds: number; // 0 = use turns instead
  durationMode?: ConditionDurationMode;
  endCD?: number;
  endTrType?: string;
  /** TR usado para sofrer a condição (quando diferente do TR do ataque). */
  applyTrType?: string;
}

/**
 * Condições que não podem ser encerradas por um TR usam esta normalização
 * compartilhada. Caído termina por ação de movimento; TRs de aplicação (ou
 * valores antigos gravados como TR de remoção) não devem gerar um prompt para
 * se levantar.
 */
export function normalizeConditionExpiry<T extends {
  conditionId: string;
  durationMode?: ConditionDurationMode;
  endCD?: number;
  endTrType?: string;
}>(condition: T): Pick<T, 'durationMode' | 'endCD' | 'endTrType'> {
  if (condition.conditionId.trim().toLowerCase() === 'caido') {
    return { durationMode: 'ate_acabar', endCD: undefined, endTrType: undefined } as Pick<T, 'durationMode' | 'endCD' | 'endTrType'>;
  }
  return {
    durationMode: condition.durationMode,
    endCD: condition.endCD,
    endTrType: condition.endTrType,
  } as Pick<T, 'durationMode' | 'endCD' | 'endTrType'>;
}

// ===== ÁREA PERSISTENTE (dano/condição contínua em zona) =====
// Quando uma ação em área é lançada com `persistentArea.enabled`, o template
// AoE fica fixo no mapa por `durationTurns` rodadas e re-aplica seu efeito
// nos tokens dentro. Ao sair, opcionalmente carrega efeito residual por X
// turnos (ex.: fumaça de veneno).
export type PersistentAreaEffectMode = 'dano' | 'condicao' | 'ambos';
export type PersistentAreaTRMode = 'uma_vez' | 'todo_round' | 'todo_turno';
export type PersistentAreaResidualMode = 'nenhum' | 'manter_turnos';

export interface PersistentAreaResidual {
  mode: PersistentAreaResidualMode;
  turns: number;
  keepDamage: boolean;
  keepCondition: boolean;
}

export interface PersistentAreaConfig {
  enabled: boolean;
  durationTurns: number;
  effectMode: PersistentAreaEffectMode;
  applyOnEnter: boolean;
  applyOnTurn: boolean;
  trMode: PersistentAreaTRMode;
  residual: PersistentAreaResidual;
}

export const DEFAULT_PERSISTENT_AREA: PersistentAreaConfig = {
  enabled: false,
  durationTurns: 3,
  effectMode: 'ambos',
  applyOnEnter: true,
  applyOnTurn: true,
  trMode: 'todo_turno',
  residual: { mode: 'nenhum', turns: 1, keepDamage: false, keepCondition: true },
};

// ===== SPELL LEVELS =====
export const SPELL_LEVELS = ['0', '1', '2', '3', '4', '5', 'Técnica Máxima', 'Técnica Reversa'] as const;
export type SpellLevel = typeof SPELL_LEVELS[number];
