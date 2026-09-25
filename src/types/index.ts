// ===== DAMAGE TYPES =====
export const DAMAGE_TYPES = ['DCO','DP','DI','DA','DCG','DCC','DQ','DS','DAL','DNR','DE','DPS','DR','DN','DV'] as const;
export type DamageType = typeof DAMAGE_TYPES[number];

export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  DCO: 'Cortante', DP: 'Perfurante', DI: 'Impactante', DA: 'Ácido',
  DCG: 'Congelante', DCC: 'Chocante', DQ: 'Queimante', DS: 'Sônico',
  DAL: 'na Alma', DNR: 'Energia Reversa', DE: 'Energético', DPS: 'Psíquico',
  DR: 'Radiante', DN: 'Necrótico', DV: 'Venenoso',
};

export const DAMAGE_TYPE_ABBR: Record<DamageType, string> = {
  DCO: 'DCO', DP: 'DP', DI: 'DI', DA: 'DA',
  DCG: 'DCG', DCC: 'DCC', DQ: 'DQ', DS: 'DS',
  DAL: 'DAL', DNR: 'DNR', DE: 'DE', DPS: 'DPS',
  DR: 'DR', DN: 'DN', DV: 'DV',
};

// ===== CHARACTER TYPES =====
export type CharacterCategory = 'PLAYER' | 'INIMIGO' | 'NPC';

export type CharacterClass = 'Feiticeiro' | 'Maldição' | 'Não-Feiticeiro';
export const CHARACTER_CLASSES: CharacterClass[] = ['Feiticeiro', 'Maldição', 'Não-Feiticeiro'];

export type Specialization = 'Lutador' | 'Especialista em Combate' | 'Especialista em Técnica' | 'Controlador' | 'Suporte' | 'Restringido' | 'Golpeador';
export const SPECIALIZATIONS: Specialization[] = ['Lutador', 'Especialista em Combate', 'Especialista em Técnica', 'Controlador', 'Suporte', 'Restringido', 'Golpeador'];

/** Backwards-compat alias for getTrainingBonus */
export const getTrainingValue = getTrainingBonus;

export type Motivation = 'Medo' | 'Raiva' | 'Angústia';
export const MOTIVATIONS: Motivation[] = ['Medo', 'Raiva', 'Angústia'];

export type Origin = 'Inato' | 'Herdado' | 'Derivado' | 'Restringido' | 'Feto Amaldiçoada Híbrido (FAH)' | 'Sem Técnica' | 'Corpo Amaldiçoado Mutante (CAM)';
export const ORIGINS: Origin[] = ['Inato', 'Herdado', 'Derivado', 'Restringido', 'Feto Amaldiçoada Híbrido (FAH)', 'Sem Técnica', 'Corpo Amaldiçoado Mutante (CAM)'];

export interface Attribute {
  id: string;
  name: string;
  value: number;
  linkedAttribute?: string;
  trained?: boolean;
  mastery?: boolean;
  externalBonus?: number;
}

/**
 * Mastery bonus: +1 every 5 levels starting at level 5.
 * Level 1-4: 0, Level 5-9: 1, Level 10-14: 2, Level 15-19: 3, Level 20: 4
 */
export function getMasteryBonus(level: number): number {
  return 2 + Math.floor(level / 5);
}

/**
 * Default saving throw bonus = floor(level / 2).
 */
export function getDefaultSavingThrowBonus(level: number): number {
  return Math.floor(level / 2);
}

/**
 * Os 5 Testes de Resistência canônicos do sistema. Substitui a lista antiga,
 * que erroneamente usava abreviações de Atributo (FOR/DES/...).
 */
export const DEFAULT_SAVING_THROWS = [
  'Astúcia',
  'Fortitude',
  'Integridade',
  'Reflexos',
  'Vontade',
];



/** Level skill bonus (half level) */
export function getLevelSkillBonus(level: number): number {
  return Math.floor(level / 2);
}

/**
 * Get training/mastery bonus for a skill based on character level.
 * - Trained: Maestria
 * - Master: 2 x Maestria
 * - Neither: 0
 */
export function getTrainingBonus(level: number, trained?: boolean, mastery?: boolean): number {
  const maestria = getMasteryBonus(level);
  if (mastery) {
    return 2 * maestria;
  }
  if (trained) {
    return maestria;
  }
  return 0;
}

/**
 * Base attack bonus. Half of the character's level.
 */
export function getBaseAttackBonus(level: number): number {
  return Math.floor(level / 2);
}

/** Point-buy cost table: attribute value -> cost from pool */
export const POINT_BUY_COSTS: Record<number, number> = {
  8: -2, 9: -1, 10: 0, 11: 2, 12: 3, 13: 4, 14: 5, 15: 7,
};
export const POINT_BUY_INITIAL = 17;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

export type SaveAttr = 'FOR' | 'DES' | 'CON' | 'INT' | 'SAB' | 'PRE';
export const SAVE_ATTRS: SaveAttr[] = ['FOR', 'DES', 'CON', 'INT', 'SAB', 'PRE'];

export interface Passive {
  id: string;
  name: string;
  description: string;
  bonusHP: number;
  bonusPE: number;
  bonusESC: number;
  bonusSlots: number;
  bonusRD: number;
  bonusCA: number;
  /** Bônus passivo de CD (Classe de Dificuldade). */
  bonusDC?: number;
  /** @deprecated Mantido para compatibilidade com fichas antigas. Use `spellLevel`. */
  level?: number;
  /**
   * Nível de feitiço da passiva ('1'..'5'). A passiva fica ativa quando
   * o personagem alcança um nível de jogador que permita esse nível de feitiço
   * (ver `getMaxSpellLevel`). Se ausente, default '1'.
   */
  spellLevel?: import('./conditions').SpellLevel;
  /** RD por tipo de dano concedida pela passiva. */
  bonusRdByType?: Partial<Record<DamageType, number>>;
}

export type SpellType = 'damage' | 'heal' | 'buff' | 'condition';
export type SpellActionType = 'bonus' | 'action' | 'reaction' | 'full' | 'rapida' | 'movimento' | 'free';

// Re-export condition types
export type { ActiveCondition, SpellCondition, SpellLevel, ConditionDef } from './conditions';
export { ALL_CONDITIONS, SPELL_LEVELS, CONDITION_CATEGORIES } from './conditions';

export interface SpellBuff {
  type: 'ca' | 'dc' | 'hit' | 'skill' | 'attribute' | 'extraDice' | 'extraDiceAfter' | 'damageBonus' | 'damageLevels' | 'critMargin' | 'negacaoRd' | 'rd' | 'tr' | 'movement' | 'spellArea' | 'spellRange';
  targetName?: string;
  value: number;
  extraDiceCount?: number;
  extraDiceSides?: number;
  durationTurns: number;
  peCostPerRound?: number;
  effectLevel?: import('./conditions').SpellLevel;
}

export interface ActiveBuff {
  id: string;
  spellName: string;
  type: 'ca' | 'dc' | 'hit' | 'skill' | 'attribute' | 'extraDice' | 'extraDiceAfter' | 'damageBonus' | 'damageLevels' | 'critMargin' | 'negacaoRd' | 'rd' | 'tr' | 'movement' | 'spellArea' | 'spellRange';
  targetName?: string;
  value: number;
  extraDiceCount?: number;
  extraDiceSides?: number;
  remainingTurns: number;
  peCostPerRound?: number;
  /** Caster id — used to enforce "1 sustentado por player". */
  sourceCharId?: string;
  /** True if this buff comes from a sustained spell (durationRounds === -1). */
  isSustained?: boolean;
}

export type SpellTargetMode = 'single_atk' | 'single_tr' | 'area_tr';
export const SPELL_TARGET_MODES: { value: SpellTargetMode; label: string }[] = [
  { value: 'single_atk', label: 'Alvo Único (Ataque)' },
  { value: 'single_tr', label: 'Alvo Único (TR)' },
  { value: 'area_tr', label: 'Área (TR)' },
];

export const SPELL_RANGES = ['Toque', '1,5m', '3m', '4,5m', '6m', '9m', '12m', '18m', '24m', '30m', '48m', '60m'] as const;

export type DifficultyLevel = 'none' | 'facil' | 'medio' | 'dificil' | 'impossivel';

export const DIFFICULTY_TABLE: Record<DifficultyLevel, { pe: number; dice: number; label: string }> = {
  none: { pe: 0, dice: 0, label: 'Nenhum' },
  facil: { pe: 2, dice: 1, label: 'Fácil (+2 PE, +1d)' },
  medio: { pe: 4, dice: 2, label: 'Médio (+4 PE, +2d)' },
  dificil: { pe: 6, dice: 3, label: 'Difícil (+6 PE, +3d)' },
  impossivel: { pe: 10, dice: 5, label: 'Impossível (+10 PE, +5d)' },
};

export interface Spell {
  id: string;
  name: string;
  costPE: number;
  description: string;
  damageDice: string;
  damageBonus: number;
  /** Dano fixo (plano) somado ao dano dos dados. Independente do bônus por atributo. */
  fixedDamage?: number;
  spellType: SpellType;
  actionType: SpellActionType;
  damageType?: DamageType;
  buffs: SpellBuff[];
  conditions: import('./conditions').SpellCondition[];
  spellLevel: import('./conditions').SpellLevel;
  durationRounds: number;
  range: string;
  targetMode?: SpellTargetMode;
  bonusDC?: number;
  tradeHitBonus?: number;
  tradeDiceAdj?: number;
  tradeRangeAdj?: number;
  tradeCDAdj?: number;
  difficultyLevel?: DifficultyLevel;
  difficultyDescription?: string;
  attackType?: 'melee' | 'ranged' | 'cursed';
  /**
   * Atributo OU Teste de Resistência usado pelo alvo. Default DES.
   * Aceita abreviações de atributo ('FOR'|'DES'|'CON'|'INT'|'SAB'|'PRE')
   * ou nomes de TR canônicos ('Astúcia'|'Fortitude'|'Integridade'|'Reflexos'|'Vontade').
   */
  saveAttr?: SaveAttr | string;
  /**
   * Marca de "Memorização Imediata" (Habilidade de Especialização).
   * Quando true, o próximo cast custa Math.ceil(costPE/2) e a flag é removida.
   * Marcado pelo player no painel pós-Descanso Longo.
   */
  isPrepared?: boolean;
  /** Configuração de Área Persistente — quando enabled=true e targetMode='area_tr',
   *  o template AoE fica fixo no mapa por durationTurns e re-aplica efeito. */
  persistentArea?: import('./conditions').PersistentAreaConfig;
}

// ===== CAM (Corpo Amaldiçoado Mutante) — Sistema de Núcleos =====
export type CoreId = 'core1' | 'core2' | 'core3';
export const CORE_IDS: CoreId[] = ['core1', 'core2', 'core3'];

/**
 * Snapshot completo de UM núcleo do CAM. Cada núcleo é uma "persona" mecânica:
 * tem atributos, feitiços, especialização, passivas e HP/PE PRÓPRIOS.
 *
 * Regra de cap (briefing §3): nenhum núcleo secundário pode ter hpMax/peMax
 * superior ao do núcleo PRIMÁRIO — o limite é aplicado matematicamente
 * via `Math.min(valorCalculado, primarioMax)` no momento da gravação.
 */
export interface CamCore {
  id: CoreId;
  name: string;
  /** Especialização exclusiva deste núcleo (Lutador, Controlador, etc.). */
  specialization: Specialization;
  /** Atributos isolados (cada núcleo redistribui o mesmo total de pontos). */
  attributes: Attribute[];
  /** Feitiços EXCLUSIVOS deste núcleo. */
  spells: Spell[];
  /** Passivas EXCLUSIVAS deste núcleo (ímpares = compartilhadas, pares = individuais). */
  passives: Passive[];
  /** HP/PE máximos DESTE núcleo (capped ao primário se for secundário). */
  hpMax: number;
  peMax: number;
  /** HP/PE atuais DESTE núcleo, persistidos enquanto inativo. */
  hpCurrent: number;
  peCurrent: number;
  /** Marca [DANIFICADO] — ativada quando o HP cai a 0 enquanto o núcleo está inativo. */
  damaged?: boolean;
  /** Marca de destruição absoluta — quando ocorre, a aba é OCULTADA permanentemente. */
  destroyed?: boolean;
}

export function createEmptyRdByType(): Record<DamageType, number> {
  return Object.fromEntries(DAMAGE_TYPES.map(t => [t, 0])) as Record<DamageType, number>;
}

export interface Character {
  id: string;
  name: string;
  category: CharacterCategory;
  /** Quem criou esta ficha. PLAYER fichas criadas por jogadores são visíveis ao Mestre; fichas criadas pelo Mestre não são visíveis aos players. */
  createdBy?: 'PLAYER' | 'MASTER';
  /** Se true, esta ficha (geralmente INIMIGO/NPC) fica oculta para os players. Apenas o Mestre vê. */
  hiddenFromPlayers?: boolean;
  /** Quando criado por um player, identifica o perfil dono da ficha. */
  profileId?: string;
  /**
   * Ficha temporária / "lite": modo de mestrar onde dano, ações e regras são
   * resolvidas por fora do sistema. Não tem aptidões/feitiços/progressão;
   * só HP, PE, RDs, deslocamento e anotações. UI renderiza um cartão simples.
   */
  temporary?: boolean;
  /** Bloco de anotações livres da ficha (especialmente útil em fichas temporárias). */
  notes?: string;
  /**
   * Override de Modo Livre por ficha. Quando definido, ignora o flag global do
   * combate: `'on'` força modo livre (sem cap de movimento / sem hotbar de
   * aptidões); `'off'` força modo normal mesmo se o global estiver ligado.
   * `undefined` segue o global (comportamento padrão).
   */
  freeformOverride?: 'on' | 'off';
  /**
   * Campos travados pelo Mestre na ficha temporária. Quando true, o Player só
   * lê o valor — apenas o Mestre pode alterar.
   */
  lockedFields?: { hp?: boolean; pe?: boolean; rd?: boolean };
  /** Histórico curto de alterações de recursos (HP/PE) para o Player rastrear. */
  resourceHistory?: Array<{
    id: string;
    at: string;
    resource: 'HP' | 'PE';
    delta: number;
    reason?: string;
    by?: 'PLAYER' | 'MASTER';
  }>;
  level: number;
  ca: number;
  baseDC: number;
  hpCurrent: number;
  hpMax: number;
  peCurrent: number;
  peMax: number;
  escCurrent: number;
  escMax: number;
  rd: number;
  rdByType: Record<DamageType, number>;
  slotsMax: number;
  slotsCurrent: number;
  attributes: Attribute[];
  skills: Attribute[];
  savingThrows: Attribute[];
  passives: Passive[];
  spells: Spell[];
  equippedItems: string[];
  customHitBonus: number;
  meleeAttackBonus: number;
  rangedAttackBonus: number;
  cursedAttackBonus: number;
  meleeLinkedAttr: string;
  rangedLinkedAttr: string;
  cursedLinkedAttr: string;
  /** Atributo vinculado à CD (Classe de Dificuldade). Único e travado uma vez definido. */
  dcLinkedAttr: string;
  meleeTrained: boolean;
  rangedTrained: boolean;
  cursedTrained: boolean;
  meleeMastery: boolean;
  rangedMastery: boolean;
  cursedMastery: boolean;
  initiativeBonus: number;
  /**
   * Quanto do `initiativeBonus` foi injetado pelo agregador de Habilidades
   * de Especialização (`aggregateSpecAbilityEffects`). Mantido pelo motor
   * `applyTecnicaProgression` para garantir idempotência: a cada reaplicação
   * subtraímos o delta antigo antes de somar o novo.
   */
  specInitiativeBonusApplied?: number;
  /** Atenção passiva (campo agregador exibido na ficha; talentos somam aqui via `talentBonuses`). */
  attention?: number;
  movement: number;
  damageDiceLevel: number;
  critMargin: number;
  cdIncrease: number;
  rollPenalty: number;
  actionsMax: number;
  actionsCurrent: number;
  bonusActionsMax: number;
  bonusActionsCurrent: number;
  reactionsMax: number;
  reactionsCurrent: number;
  opportunityMax: number;
  opportunityCurrent: number;
  activeBuffs: ActiveBuff[];
  activeConditions: import('./conditions').ActiveCondition[];
  vulnerabilities: DamageType[];
  immunities: DamageType[];
  characterClass: CharacterClass;
  specialization: Specialization;
  motivation: Motivation;
  origin: Origin;
  accessorySlots: AccessorySlots;
  votos: string;
  hasEnergiaReversa: boolean;
  // ===== ORIGIN SYSTEM (opcional, retrocompatível) =====
  /** Tags livres concedidas pela Origem/Clã/Aptidão (exibidas na ficha). */
  originTags?: string[];
  /** Cura reversa cai pela metade (FAH — apenas quando vinda de terceiros). */
  healingHalved?: boolean;
  // ===== FAH (Feto Amaldiçoado Híbrido) =====
  /** FAH: pode gastar 2 PE para se autocurar com Energia Reversa própria sem o redutor. */
  canHealWithCursedEnergy?: boolean;
  /** FAH: usos atuais de Vigor Maldito (reseta no Descanso Longo). */
  vigorMalditoUses?: number;
  /** FAH: usos máximos de Vigor Maldito = 1 + tiers Lv4/8/12. */
  vigorMalditoMax?: number;
  /** Talento Favorecido pela Sorte: usos atuais (reseta em Descanso Longo). */
  luckCurrent?: number;
  /** Talento Favorecido pela Sorte: usos máximos (definido pelo agregador de talentos). */
  luckMax?: number;
  /**
   * @deprecated A nova mecânica de Sorte é re-rolagem PÓS-resultado
   * (ficar com o maior). Campo mantido apenas para compatibilidade com
   * saves antigos; não é mais lido pelo engine.
   */
  pendingLuckAdvantage?: number;
  /** FAH: IDs das Características de Anatomia escolhidas (slots em Lv 1/5/10/15/20). */
  anatomyFeatures?: string[];
  /** FAH: perícia escolhida pela anatomia "Corpo Especializado" → +1d4 nas rolagens. */
  anatomyCorpoEspecializadoSkill?: string;
  /** FAH: tipo de dano físico com Resistência (Carapaça Mutante Lv 10+). */
  anatomyCarapacaResistType?: DamageType;
  /** FAH (toggle de combate): "Duas Mãos Livres" para Braços Extras propagar +2 Atletismo. */
  anatomyDuasMaosLivres?: boolean;
  /** Derivado: a ação "Recuperação de Emergência" já foi usada hoje (reseta no Descanso Longo). */
  derivadoEmergencyUsed?: boolean;
  /** FAH (toggle): Sangue Tóxico ativo (jogador pode desligar para narrativa). */
  sangueToxicoEnabled?: boolean;
  /** FAH: usos de Alma Maldita restantes (diário) = 2 + tiers Lv6/12/18. */
  almaMalditaUses?: number;
  /** FAH: máximo de Alma Maldita por dia. */
  almaMalditaMax?: number;
  /** FAH: alcance corpo-a-corpo extra (m) concedido por Articulações Extensas. */
  meleeRangeBonus?: number;
  /** FAH: snapshot interno do que `recalcAnatomyPassives` aplicou (para reverter idempotente). NÃO editar manualmente. */
  __anatomyAppliedSnapshot?: import('@/lib/anatomyEffects').AnatomyAppliedSnapshot;
  /** Maldição: snapshot interno do que `recalcCursedExclusivePassives` aplicou. NÃO editar manualmente. */
  __cursedExclusiveAppliedSnapshot?: import('@/lib/cursedExclusiveEffects').CursedExclusiveAppliedSnapshot;
  /** Núcleo Primário (apenas CAM). PV/PE máximos vêm deste núcleo (cap dos demais). */
  primaryCoreId?: CoreId;
  /** ID do núcleo atualmente ATIVO (projetado nos campos raiz do Character). */
  activeCoreId?: CoreId;
  /** Snapshot completo dos três núcleos do CAM. Tudo que é "isolado por núcleo" mora aqui. */
  cores?: CamCore[];
  /**
   * Integridade da Alma (CAM): barra ÚNICA compartilhada pelos 3 núcleos.
   * Total = floor((sum hpMax dos 3 cores) / 2). Ao chegar a 0, todos os 3 morrem.
   */
  soulIntegrityMax?: number;
  soulIntegrityCurrent?: number;
  /** Categoria de tamanho narrativa (CAM começa Pequeno → Médio Nv6 → Grande opcional Nv15). */
  sizeCategory?: 'Pequeno' | 'Médio' | 'Grande';
  /** Indicador do estado "Morrendo" (queda do núcleo ativo após recusar a Reação de troca). */
  dying?: boolean;
  /** Caps customizados de atributo (Restringido = 30 em FOR/DES/CON). */
  attrCaps?: Record<string, number>;
  /** Clã selecionado (Herdado). */
  clanId?: 'Gojo' | 'Inumaki' | 'Kamo' | 'Zenin';
  /** Inumaki: usos atuais de "Olhos de Cobra e Presas" (reseta no Descanso Longo). */
  inumakiUses?: number;
  /** Inumaki: máximo = Bônus de Treinamento (Maestria). */
  inumakiMax?: number;
  /** Restringido: usos atuais de "Resiliência Imediata" (reseta no Descanso Longo). */
  restringidoResilUses?: number;
  /** Restringido: máximo = Bônus de Treinamento (Maestria). */
  restringidoResilMax?: number;
  /** Zenin: feitiços marcados como FOCADO + bônus escolhido por feitiço. */
  zeninFocusedSpells?: Array<{
    spellId: string;
    bonus: 'damage' | 'healing' | 'range' | 'cd';
    chosenAtLevel: number;
  }>;
  /** Técnica Amaldiçoada (ex.: 'Novo Estilo da Sombra' para Sem Técnica Nv 4+). */
  tecnicaAmaldicoada?: string;
  /** Aptidão amaldiçoada concedida automaticamente (ex.: 'Domínio Simples'). */
  aptidaoAmaldicoadaConcedida?: string;
  /** Técnicas de Estilo aprendidas (Novo Estilo da Sombra). */
  styleTechniques?: string[];
  /** Técnica de Estilo atualmente ativa (trocável como Ação Livre no início do turno). */
  activeStyleTechnique?: string;
  /** Snapshot das escolhas obrigatórias geradas pela origem (Empenho Implacável etc.). */
  originPendingChoices?: Array<{ id: string; level: number; kind: string; label: string; count?: number; bonusValue?: number }>;
  /**
   * Slot de descanso concedido pelo Mestre. Quando definido, libera o botão
   * "Descansar" na ficha — restrito ao tipo concedido. Consumido após o uso.
   */
  restGrant?: 'short' | 'long' | null;
  /** Escudo equipado (id do catálogo `src/lib/shields.ts`). null/undefined = sem escudo. */
  equippedShieldId?: string | null;
  /**
   * Slots de empunhadura (NOME da arma — mesmo nome usado no inventário).
   * Resolvidos contra `ALL_WEAPONS` via `findWeaponByName`.
   * Arma de duas-mãos ocupa AMBOS os slots com o mesmo nome.
   * `dualWielding` é DERIVADO: true quando ambos preenchidos com armas distintas.
   */
  mainHandWeaponName?: string | null;
  offHandWeaponName?: string | null;
  /** @deprecated mantido só por retrocompatibilidade (não use em código novo). */
  secondaryWeaponId?: string | null;
  /** @deprecated derivado de mainHand/offHand — use ambos slots. */
  dualWielding?: boolean;
  /**
   * Quantas trocas de empunhadura (equipar/guardar arma) este personagem
   * fez no turno atual. 1ª troca = Ação Livre; 2ª+ = Ação Bônus.
   * Reseta no início do próprio turno e em `resetActions`.
   */
  weaponSwapsThisTurn?: number;
  /**
   * Quantos ataques este personagem já realizou no turno atual. Usado pelo
   * AttackPanel para alimentar `previousAttacksThisTurn` automaticamente
   * (penalidades de iteratividade, propriedade Enérgica etc.).
   * Reseta no início do próprio turno e em `resetActions`.
   */
  attacksThisTurn?: number;
  /**
   * Resultado do último ataque deste personagem no turno atual:
   *   true  = acertou
   *   false = errou (alimenta `previousMissed`, propriedade Oscilante etc.)
   *   undefined = nenhum ataque feito ainda neste turno
   */
  lastAttackHit?: boolean;
  /** "Determinado a Viver" foi consumido hoje? (usa daily reset junto com talentUsage). */
  determinadoAViverUsed?: boolean;

  // ===== MOTOR DE PROGRESSÃO DE NÍVEL (todos opcionais p/ retrocompatibilidade) =====
  /** Bônus de Treinamento corrente (+2 a +6 conforme faixa de nível). */
  trainingBonus?: number;
  /**
   * Pontos de Atributo Livres acumulados.
   *
   * IMPORTANTE: NÃO é creditado automaticamente ao subir de nível. Só é creditado
   * quando o jogador resolve um marco ASI escolhendo a Opção A (Aumento de Atributo).
   */
  availableAttrPoints?: number;
  /**
   * Treinamentos disponíveis para gastar (cada 1 = treinar 1 perícia inédita).
   * Só é creditado pelo Talento "Treinamento em Perícia" (escolha A: +2).
   */
  availableTrainings?: number;
  /**
   * Promoções de perícia para Mestre disponíveis.
   * Só é creditado pelo Talento "Treinamento em Perícia" (escolha B: +1).
   */
  availableMastery?: number;
  /**
   * Pool SEPARADO de treinos para Testes de Resistência (não compartilha com perícias).
   * Conquistado por vias específicas (talento dedicado / nível / origem) — fonte a definir.
   * Começa em 0.
   */
  availableSavingTrainings?: number;
  /**
   * Pool SEPARADO de maestrias para Testes de Resistência (não compartilha com perícias).
   * Começa em 0.
   */
  availableSavingMastery?: number;
  /**
   * Pool COMPARTILHADO entre Habilidades de Especialização e Talentos.
   * Creditado +1 por nível ao subir (quando a pendência `skill_or_talent`
   * é resolvida escolhendo "Adiar — pool compartilhado"). Pode ser gasto
   * em qualquer um dos dois catálogos.
   */
  availableSpecAbilities?: number;
  /** Pool EXCLUSIVO de Habilidades de Especialização (não aceita Talentos). */
  availableSkillOnly?: number;
  /** Pool EXCLUSIVO de Talentos (não aceita Habilidades de Especialização). */
  availableTalentOnly?: number;
  /**
   * Habilidades de Especialização efetivamente escolhidas. Catálogo em
   * `src/lib/specAbilities.ts`. UI exibe em ordem crescente de tier.
   */
  chosenSpecAbilities?: Array<{ abilityId: string; chosenAtLevel: number }>;
  /**
   * IDs de Aptidões Amaldiçoadas possuídas (catálogo em `src/lib/aptitudes.ts`).
   * Usado por gating de Habilidades de Especialização / Talentos via `requiredAptitudes`.
   */
  chosenAptitudes?: string[];
  /**
   * Estado de uso por habilidade (ID → contador atual).
   * Resetado por descanso/cena/rodada conforme `usage.scope` da habilidade.
   */
  specAbilityUsage?: Record<string, number>;
  /**
   * Escolhas permanentes feitas em Habilidades de Especialização que possuem
   * `choiceSchema` (ex.: Nível Perfeito → nível de feitiço; Energia Focalizada
   * → TR específico). Chave = abilityId. Valor = `SpecAbilityChoiceValue`.
   * Quando ausente para uma habilidade que exige escolha, a UI marca como
   * "Escolha pendente" e abre o `SpecAbilityChoiceDialog`.
   */
  specAbilityChoices?: Record<string, import('@/lib/specAbilities').SpecAbilityChoiceValue>;
  /**
   * Nível de Empolgação atual do Lutador (1..5). Sobe ao acertar, desce ao
   * errar / não atacar. Inicia em 1 (ou 2 com Lutador Superior).
   */
  empolgacaoLevel?: number;
  /** Nível inicial de Empolgação ao começar combate (1 padrão, 2 com Lutador Superior Nv20). */
  empolgacaoStartLevel?: number;
  /** Tabela atual do Dado de Empolgação (Base ou Máxima após Nv11). */
  empolgacaoDiceTable?: import('@/lib/lutadorProgression').EmpolgacaoTable;
  /** Dano do Ataque Desarmado (Lutador). */
  unarmedDamage?: { count: number; sides: number };
  /** Bônus universal de Redução de Dano via Reflexo Evasivo (Lutador Nv2+). */
  damageReductionBonus?: number;
  /** Bônus de CD de classe via Implemento Marcial (Lutador Nv4+). */
  classCdBonus?: number;
  /** Bônus em Rolagens de Ataque via Gosto pela Luta (Lutador Nv5+). */
  attackRollBonus?: number;
  /** Bônus em Fortitude e Dano via Gosto pela Luta (Lutador Nv5+). */
  fortitudeAndDamageBonus?: number;
  /** Manobras de Empolgação escolhidas pelo Lutador. */
  lutadorManeuvers?: string[];
  /** Habilita Ataque Desarmado como Ação Livre (Custo 2 PE) — Lutador Nv20. */
  unlocksFreeUnarmed?: boolean;
  /**
   * Talentos pendentes (1 entrada = 1 escolha em aberto). Resolvidos no
   * `TalentCatalogModal` consumindo o catálogo `src/lib/talents.ts`.
   */
  pendingTalents?: Array<{ id: string; level: number; source: 'level' | 'asi' | 'origin' | 'training_skill' }>;
  /**
   * Talentos efetivamente escolhidos do catálogo `src/lib/talents.ts`.
   * `choices` guarda seleções persistentes feitas no modal (ex.: atributo
   * escolhido em "Incremento de Atributo", opção A/B/C/D em "Físico Aperfeiçoado").
   */
  chosenTalents?: Array<{
    id: string;
    level: number;
    source?: 'level' | 'asi' | 'origin' | 'training_skill';
    choices?: Record<string, string>;
  }>;
  /**
   * Entidades Omni "vinculadas" à ficha — feitiços, talentos, passivas, auras
   * e condições que o personagem possui no inventário e ativou via botão
   * "Vincular à ficha". Cada entrada referencia a entidade no catálogo Omni
   * e a instância do inventário (para manter rastreabilidade).
   *
   * Itens (categoria 'item') NÃO entram aqui — eles são gerenciados pelo
   * fluxo de inventário/equipar tradicional.
   */
  omniAtivos?: Array<{
    /** ID estável da vinculação (não confunde com instanceId do inventário). */
    id: string;
    /** Categoria da entidade (espelha EntidadeOmni.categoria). */
    categoria: 'feitico' | 'talento' | 'passiva' | 'aura' | 'condicao' | 'voto';
    /** ID da entidade no useOmniEntidadesStore. */
    entidadeId: string;
    /** Instância de inventário que originou a vinculação (para desvincular limpo). */
    instanceId: string;
    /** Quando foi vinculado. */
    vinculadoEm: number;
  }>;
  /** Dados de Vida disponíveis (descanso curto). Total = nível. */
  hitDiceMax?: number;
  hitDiceCurrent?: number;
  /** PV iniciais do Nv 1 (snapshot do wizard) — base para recálculo retroativo. */
  hpStartingBase?: number;
  /** PE iniciais do Nv 1 (snapshot do wizard) — base para recálculo de PE. */
  peStartingBase?: number;
  /** Soma de ganhos manuais de PE por nível (sem o bônus do atributo-chave, que é único). */
  pePerLevelGains?: number;
  /** Histórico por nível (HP base rolado/médio + snapshot de CON-mod). */
  levelHistory?: Array<{ level: number; hpRollBase: number; conModSnapshot: number }>;
  /** Lados do dado de vida desta classe (d6/d8/d10). Snapshot do wizard. */
  hpClassDie?: number;
  /** Fila de pendências geradas por level-up (resolvidas na UI). */
  pendingLevelChoices?: Array<import('@/lib/levelEngine').PendingLevelChoice>;
  /**
   * Pendências ARQUIVADAS por level-down. Ao subir de nível para um nível já alcançado
   * antes, essas escolhas são restauradas (com appliedEffect reaplicado se resolvidas)
   * em vez de gerar trackers novos. Isso impede o farm de atributos/talentos por
   * subir-descer-subir.
   */
  archivedLevelChoices?: Array<import('@/lib/levelEngine').PendingLevelChoice>;

  /**
   * Cooldowns por feitiço (ID do feitiço → turnos restantes).
   * Usado pela Técnica Máxima: ao conjurar, registra `6 - floor(TB/2)` turnos.
   * Decrementa 1 a cada turno do personagem (em `tickBuffs`).
   * Quando 0 (ou ausente), o feitiço pode ser conjurado novamente.
   */
  cooldowns?: Record<string, number>;

  /**
   * Reserva de PE armazenada por "Economia de Energia" (Aptidão tec-economia-de-energia).
   * Após Descanso Curto: rola 1d4 (escala 1 passo a cada 5 níveis).
   * Após Descanso Longo: rola 1d6 (escala 1 passo a cada 5 níveis).
   * O jogador resgata gastando Ação Comum (ainda manual).
   */
  economiaPEReserve?: number;

  /**
   * Total de PV sacrificados na cena por "Sacrifício pela Energia" (tec-sacrificio-pela-energia).
   * Resetado no Descanso Longo (e ao fim de combate, futuramente).
   */
  hpSacrificedTotal?: number;

  /**
   * Nível de Exaustão (0..6). Reduz 1 nível em Descanso Longo padrão (modo
   * crafting também reduz 1). Ver `src/lib/exhaustionEffects.ts` para todas as
   * penalidades escalonáveis (rolagens, defesa, deslocamento e HP máximo).
   */
  exhaustionLevel?: number;
  /**
   * Tracker de FALHAS de Salvaguarda de Morte (0..3). Quando o personagem
   * entra em "Morrendo", se `exhaustionLevel >= 4`, inicia já com 2 falhas.
   */
  deathFails?: number;
  /**
   * Marca de "Desmaiado por Exaustão". Quando a redução de HP máximo derruba
   * o HP atual a 0 sem matar, o personagem é desmaiado e precisa de
   * `deathRestsRequired` Descansos Longos para acordar.
   */
  unconsciousFromExhaustion?: boolean;
  /** Quantos Descansos Longos faltam para acordar (Lv. exaustão no momento do desmaio). */
  deathRestsRequired?: number;

  /**
   * Sistema de Fome (somente PLAYER): 24 barrinhas. A cada hora do Chronos
   * decrementa 1. Ao chegar em 0: +1 nível de Exaustão e reseta para 24.
   * Descanso Longo (não-crafting) restaura para 24.
   */
  hunger?: number;
  /**
   * Marca a última "hora absoluta" do Chronos em que a fome foi descontada
   * (calculada como year*8760 + ... + hours). Evita gastar várias barras se
   * o relógio avançar muitas horas; mas processa cada hora cumulativamente.
   */
  lastHungerHourKey?: number;

  // ===== Especialista em Técnica =====
  /** Atributo-chave da Técnica: 'Inteligência' ou 'Sabedoria'. Define no wizard. */
  keyAttribute?: 'Inteligência' | 'Sabedoria';
  /** Mudanças de Fundamento aprendidas (Domínio dos Fundamentos). */
  tecnicaFundamentos?: string[];
  /** Foco Amaldiçoado escolhido no Nv 10 ('Destruição' | 'Economia' | 'Refino'). */
  tecnicaFoco?: 'Destruição' | 'Economia' | 'Refino';
  /** Bônus em Rolagens de Ataque AMALDIÇOADAS (Spell Attack). Nv 20 'O Honrado'. */
  spellAttackBonus?: number;

  // ===== Perfil Amaldiçoado — Aptidões numéricas (AU/CL/BAR/DOM/ER, 0..5) =====
  /** Pontuação atual de cada aptidão amaldiçoada (0..5). */
  cursedAptitudes?: CursedAptitudesState;
  /** Pontos pendentes para distribuir nas 5 aptidões. */
  pendingAptitudePoints?: number;

  // ===== Aptidões de AURA (catálogo nomeado — `src/lib/auraAptitudes.ts`) =====
  /** IDs das Aptidões de Aura adquiridas pelo jogador. */
  chosenAuraAptitudes?: string[];
  /** Estado de uso por aptidão (id → contador atual), conforme `usage.scope`. */
  auraAptitudeUsage?: Record<string, number>;
  /** Pontos disponíveis para escolher 1 habilidade do Catálogo de Aptidões (Aura/CL/BAR/DOM/ER). */
  availableAuraChoices?: number;

  // ===== Dotes Gerais =====
  /** IDs dos dotes gerais adquiridos. */
  chosenDotes?: string[];
  /** Contagem de usos por dote (id → usos consumidos no escopo atual). */
  doteUsage?: Record<string, number>;
  /** Recurso "Abençoado pela Sorte": pontos de sorte (3 base). */
  luckyPoints?: { current: number; max: number };
  /** Toggle state por dote (Fúria Berserker, Posturas, etc.). */
  doteToggles?: Record<string, boolean>;
  /** Snapshot interno aplicado por `recalcDotePassives`. NÃO editar manualmente. */
  __dotesAppliedSnapshot?: import('@/lib/doteEffects').DotesAppliedSnapshot;

  // ===== Aptidões de CL (Controle e Leitura) — catálogo unificado, family === 'CL' =====
  /** IDs das Aptidões de CL adquiridas pelo jogador. */
  chosenClAptitudes?: string[];
  /** Estado de uso por aptidão CL (id → contador atual). */
  clAptitudeUsage?: Record<string, number>;
  /**
   * Reação "Absorção Elemental" armada — guarda o tipo elemental absorvido e o
   * nível de AU no momento da absorção. Consumido pelo PRÓXIMO ataque para
   * adicionar dados extras (Xd6/d8/d10 conforme escala). Limpa após uso.
   */
  pendingAbsorbedElement?: { element: DamageType; au: number };
  /**
   * Carga de "Concentrar Aura": acumula AU para ser gasto pelo próximo
   * "Golpe com Aura" como dano bônus (+AU). Consumido após o golpe.
   */
  concentratedAura?: { au: number };

  /**
   * Estado de Grapple (engine de agarrar):
   * - `grappledBy`: IDs dos personagens que ME agarram (movimento bloqueado, desvantagem em ataques).
   * - `grappling`: IDs dos personagens que EU agarro (libero ao morrer/desmaiar).
   */
  grappleState?: {
    grappledBy?: string[];
    grappling?: string[];
  };

  // ===== KOKUSEN (Raio Negro) — estado de combate =====
  /**
   * Stacks de Consciência Absoluta. Cada Kokusen acertado incrementa em 1.
   * Reseta para 0 no fim do combate ou se passar uma rodada inteira sem novo Kokusen.
   * Limitado por `Math.floor(CL/2)` (+1 com Faíscas Negras).
   */
  kokusenStacks?: number;
  /**
   * Round em que o último Kokusen foi acertado. Usado pelo decay automático
   * (se o round atual avançar 2+ além desse, stacks zeram).
   */
  kokusenLastRound?: number;
  /**
   * Buff "Pós-Kokusen" das Faíscas Negras ativo nesta cena (acertou ao menos 1
   * Kokusen com a aptidão adquirida). Some ao terminar o combate.
   */
  kokusenSceneBuffActive?: boolean;
  /**
   * Flag transiente: o último ataque CaC virou Kokusen. O DamageHealPanel
   * consome ao aplicar dano (multiplica ×1.5 e ignoresRD). Limpa após uso.
   */
  kokusenArmedDamage?: boolean;

  /**
   * Chave do último dia do calendário (Chronos) em que os usos `daily` foram
   * resetados. Formato `YYYY-MM-DD` (ano/mês/dia do mundo). Quando o dia atual
   * difere desse, `tickDailyReset` zera as contagens de habilidades/aptidões
   * com escopo `daily`.
   */
  lastDailyResetKey?: string;

  /**
   * Quantidade de feitiços a marcar como `isPrepared` após o último Descanso
   * Longo (Habilidade "Memorização Imediata"). Quando > 0, a UI da ficha abre
   * o painel de seleção. Após confirmar, é zerado.
   */
  pendingPreparedSpellSlots?: number;

  /**
   * Pontos de Energia TEMPORÁRIOS — consumidos ANTES do `peCurrent`.
   * Zerados ao fim do combate / cena. Não persistem por descansos.
   * Fonte: talentos como Energia Antinatural, Zelo Recompensador.
   */
  tempPE?: number;

  /**
   * Penalidade no cap máximo da Empolgação (cap_efetivo = 5 - empolgacaoMaxPenalty).
   * Aplicada por habilidades como "Última Resistência". Zerada APENAS no Descanso Longo.
   */
  empolgacaoMaxPenalty?: number;

  /**
   * Estado de uso por talento (ID → contador atual).
   * Resetado por descanso/cena conforme `talent.usage.scope`.
   */
  talentUsage?: Record<string, number>;

  /**
   * Talento "Discurso Motivador" — IDs de criaturas que já receberam
   * o PV Temporário desde o último Descanso Longo (1 buff por criatura).
   */
  discursoMotivadorUsedOn?: string[];

  /**
   * Nome do feitiço atualmente imbuído em arma branca via
   * `tec-imbuir-com-tecnica`. Liberado no próximo ataque corpo a corpo
   * bem-sucedido (administrado manualmente pelo jogador via SpecActionsPanel).
   * Vazio/undefined = sem feitiço imbuído.
   */
  imbuedSpell?: string;

  /**
   * Cooldown ATIVO em rodadas para a habilidade "Sacrifício pela Energia".
   * Decrementa 1 a cada turno do personagem. 0/ausente = pode usar.
   */
  sacrificioCooldownRounds?: number;
  /**
   * Trava 1×/cena para evitar aplicar +1 Exaustão duas vezes na mesma cena
   * quando hpSacrificedTotal cruzar hpMax/2 via Sacrifício pela Energia.
   * Reset em fim de cena e em descanso longo (não-crafting).
   */
   sacrificioExhaustionTriggered?: boolean;
  /**
   * Mapa genérico de flags Omni (estados narrativos/táticos numéricos).
   * Ex.: `omniFlags.bloqueio_total = 1` indica que o próximo dano em
   * `vida_atual` será absorvido. Usado pelo executor do Omni-Engine.
   * Sempre numérico (0 = inativo, ≥1 = ativo / contador).
   */
  omniFlags?: Record<string, number>;
  /**
   * Lista de imunidades a condições concedidas pelo Omni-Engine.
   * Cada entrada é um escopo bruto interpretado por `lib/omni/immunity.ts`:
   *   - "todas"               → imune a qualquer condição
   *   - "categoria:MENTAL"    → categoria inteira
   *   - "condicao:atordoado"  → condição específica
   * Lida por `addCondition` para bloquear na fonte (a condição nunca é
   * persistida em `activeConditions`).
   */
  omniImmunities?: string[];
  /**
   * Contadores nomeados (Omni). Ex.: `contadores.fadiga_olhos = 3`.
   * Usado por INCREMENTAR_CONTADOR/ZERAR_CONTADOR/DEFINIR_CONTADOR e
   * pelo gatilho `aoAtualizarContador` (limiar disparável via predicado).
   */
  omniCounters?: Record<string, number>;
  /**
   * Redutores de custo de recurso por chave canônica (ex.: `pe`, `vida`).
   * Aplicados em `gastarPE`/`spellCastPipeline`/`CONSUMIR_RECURSO`,
   * sempre garantindo o piso mínimo configurado (default 1).
   * Ex.: `omniCostReduction.pe = { reduce: 5, min: 1 }`.
   */
  omniCostReduction?: Record<string, { reduce: number; min: number }>;
  /**
   * Override de custo de ação por habilidade nomeada (Omni).
   * Ex.: `omniActionCost.ler_tecnica = { cost: 'action_free', perRound: 1 }`.
   * Resolve a transformação dinâmica de "Ler Técnica" (bônus → livre 1×/rodada).
   */
  omniActionCost?: Record<string, { cost: string; perRound?: number; usedThisRound?: number }>;
  /**
   * Redutores de custo de PE de FEITIÇOS aplicados no `SpellApplyDialog`.
   * Cada item filtra por nível, tipo, ação, nome ou id (ver `spellCostReduction.ts`).
   * Vários itens aplicáveis ao mesmo feitiço se SOMAM, com piso = maior `min`.
   */
  omniSpellCostReduction?: Array<{
    id: string;
    filtro: string;
    reduce: number;
    min: number;
    origem?: string;
  }>;
  /**
   * Bônus passivos em perícias vindos de scripts Omni (passivas/itens).
   * Mapa `pericia_<x>` (sem o prefixo) → bonus inteiro.
   * Aplicado em rolagens de perícia via `handleSkillRoll` (somado a
   * `externalBonus`) e exibido como badge ao lado do valor.
   * Ex.: `{ percepcao: 4 }` significa +4 em rolagens de Percepção.
   */
  omniSkillBonuses?: Record<string, number>;
  /**
   * Slot de "Venda" (cobertura ocular). Quando preenchido, equivale a
   * acessório passivo equipado: dispara `aoVendar`/`aoDescobrir` no Omni.
   * Aceita id de instância de inventário (item omni com tag `venda`).
   */
  blindfoldSlot?: string | null;
  /**
   * Habilita o slot de Venda no card. Controlado pelo Mestre — apenas
   * personagens com `hasBlindfoldSlot === true` exibem o slot na ficha.
   */
  hasBlindfoldSlot?: boolean;
  /**
   * Quantas vezes o personagem alternou o slot de venda (vendar/descobrir)
   * na rodada atual de combate. 1ª = Ação Livre; 2ª+ = Ação Bônus.
   * Reseta em `aoFinalizarRodadaCombate`.
   */
  blindfoldTogglesThisRound?: number;

  // ===== ESPECIALISTA EM TÉCNICA — estado vivo (Fase 2) =====
  /**
   * Slots máximos de Concentração simultânea.
   *   • Default sistema: 1 (não setado = 1).
   *   • `tec-mente-repartida` (Tier 6) eleva para 2.
   * Aplicado idempotentemente por `applyTecnicaProgression` via agregador.
   */
  maxConcentrationSlots?: number;
  /**
   * Slots máximos de feitiços Sustentados simultâneos.
   *   • Default sistema: 1.
   *   • `tec-sustentacao-avancada` (Tier 8) → 2.
   *   • `tec-sustentacao-mestre` (Tier 16) → 3 (substitui anteriores).
   */
  maxSustainedSpells?: number;
  /**
   * Slots-bônus de Variações de Liberação universais aplicados a TODO feitiço
   * conhecido. `tec-versatilidade-ampliada` (Tier 12) soma +1.
   */
  bonusReleaseSlots?: number;
  /**
   * Pool de PE TEMPORÁRIO EXCLUSIVO para Aptidões Amaldiçoadas. Resetado e
   * reaplicado no INÍCIO DE CADA RODADA enquanto o personagem possuir
   * `tec-mestre-das-aptidoes` (Tier 12). Não acumula entre rodadas. Não soma
   * com `tempPE` geral. Zerado em fim de cena/descansos.
   */
  aptitudeOnlyTempPE?: number;
  /**
   * Último ID de Feitiço conjurado nesta cena/combate. Usado por
   * `tec-ciclagem-maldita` (bônus quando troca de feitiço entre conjurações).
   * Zerado em fim de cena, descanso curto e descanso longo.
   */
  lastSpellUsedId?: string;
  /**
   * Flag de cena: Combate Amaldiçoado (`tec-combate-amaldicoado`) foi ativado
   * (Ação Livre, 2 PE) — durante toda a cena, as armas escolhidas em
   * Técnicas de Combate sobem +1 passo no dado de dano. Resetada no fim da
   * cena e em descansos.
   */
  tecCombateAmaldicoadoActive?: boolean;
}

// ===== Aptidões Amaldiçoadas (sistema numérico) =====
export const APTITUDE_KEYS = ['AU', 'CL', 'BAR', 'DOM', 'ER'] as const;
export type AptitudeKey = typeof APTITUDE_KEYS[number];
export type CursedAptitudesState = Record<AptitudeKey, number>;

export const APTITUDE_MIN = 0;
export const APTITUDE_MAX = 5;

export const APTITUDE_LABELS: Record<AptitudeKey, { short: string; full: string; desc: string }> = {
  AU:  { short: 'AU',  full: 'Aura',                desc: 'Refino da emanação de energia amaldiçoada — presença, intimidação e percepção espiritual.' },
  CL:  { short: 'CL',  full: 'Controle e Leitura', desc: 'Precisão no controle do fluxo da própria energia e capacidade de ler a energia alheia.' },
  BAR: { short: 'BAR', full: 'Barreira',            desc: 'Domínio sobre técnicas de barreira, véus e selos espaciais.' },
  DOM: { short: 'DOM', full: 'Domínio',             desc: 'Capacidade de manifestar e sustentar Expansão de Domínio e construções territoriais.' },
  ER:  { short: 'ER',  full: 'Energia Reversa',     desc: 'Manuseio da energia reversa — cura, anti-cursed e técnicas reversas.' },
};

export function createDefaultCursedAptitudes(): CursedAptitudesState {
  return { AU: 0, CL: 0, BAR: 0, DOM: 0, ER: 0 };
}

// ===== ITEM SLOT TYPES =====
export const ITEM_SLOT_TYPES = [
  'nenhum',
  'colar', 'anel', 'pulseira',
  'cabeca', 'corpo', 'maos', 'pes',
] as const;
export type ItemSlotType = typeof ITEM_SLOT_TYPES[number];
export const ITEM_SLOT_LABELS: Record<ItemSlotType, string> = {
  nenhum: 'Nenhum (Geral)',
  colar: 'Colar', anel: 'Anel', pulseira: 'Pulseira',
  cabeca: 'Cabeça', corpo: 'Corpo', maos: 'Mãos', pes: 'Pés',
};

export interface AccessorySlots {
  colar: string | null;
  aneis: [string | null, string | null, string | null, string | null];
  pulseiras: [string | null, string | null];
}

export function createEmptyAccessorySlots(): AccessorySlots {
  return { colar: null, aneis: [null, null, null, null], pulseiras: [null, null] };
}

// ===== ITEM TYPES =====
export interface ItemRollBonus {
  id: string;
  attributeName: string;
  value: number;
}

export interface Item {
  id: string;
  name: string;
  category: string;
  description: string;
  weight: number;
  cost: number;
  slots: number;
  quantity: number;
  slotType: ItemSlotType;
  bonusHP: number;
  bonusPE: number;
  bonusESC: number;
  bonusRD: number;
  bonusRdByType: Record<DamageType, number>;
  bonusSlots: number;
  bonusCA: number;
  /** Bônus de CD concedido pelo item (acessório). */
  bonusDC: number;
  bonusActions: number;
  bonusBonusActions: number;
  bonusReactions: number;
  bonusOpportunity: number;
  rollBonuses: ItemRollBonus[];
  assignedTo: string[];
  /** Marca o item como comida/consumível restaurador (ativa efeitos ao Gastar). */
  isFood?: boolean;
  /** Pontos de fome restaurados ao consumir (0..24). */
  hungerRestore?: number;
  /** PV restaurados ao consumir. */
  hpRestore?: number;
  /** PE restaurados ao consumir. */
  peRestore?: number;
  /** PVT (Pontos de Vida Temporários / Escudo) concedidos ao consumir. */
  pvtRestore?: number;
}

// ===== CHRONOS TYPES =====
export interface ChronosState {
  hours: number;
  minutes: number;
  seconds: number;
  day: number;
  month: number;
  year: number;
  multiplier: number;
  isRunning: boolean;
}

// ===== CALENDAR TYPES =====
export interface CalendarEvent {
  id: string;
  day: number;
  month: number;
  year: number;
  time: string;
  title: string;
  description: string;
  color: string;
}

// ===== LOG TYPES =====
export type LogType = 'roll' | 'combat' | 'time' | 'system' | 'spell' | 'initiative';

export interface LogEntry {
  id: string;
  timestamp: number;
  gameTime?: string;
  type: LogType;
  message: string;
  sourceRole?: 'MASTER' | 'PLAYER' | null;
}
