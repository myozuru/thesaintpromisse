/**
 * Motor de Progressão de Nível.
 *
 * Concentra TODA a matemática derivada do `characterLevel` (1..20):
 *  - Bônus de Treinamento por faixa
 *  - Dados de Vida = nível
 *  - Grau do Feiticeiro (cosmético)
 *  - Geração de pendências (LevelTracker[]) ao subir de nível
 *  - Cálculo retroativo de PV via mod de CON
 *  - Cálculo retroativo de PE via mod do Atributo Chave (uma única vez)
 *
 * Funções puras — todas as mutações de estado vivem em `useCharacterStore`.
 */
import type { Character, Specialization, CharacterClass, Attribute, Origin } from '@/types';

/** Múltiplos de 4 dentro do range 1..20 (4, 8, 12, 16, 20). */
export function isMilestoneLevel(level: number): boolean {
  const lv = level | 0;
  return lv >= 4 && lv <= 20 && lv % 4 === 0;
}

// ===== 1. Variáveis derivadas do nível =====================================

/** Bônus de Treinamento por faixa de nível (1-4 +2, 5-8 +3, 9-12 +4, 13-16 +5, 17-20 +6). */
export function getTrainingBonusByLevel(level: number): number {
  const lv = Math.max(1, Math.min(20, level | 0));
  if (lv <= 4) return 2;
  if (lv <= 8) return 3;
  if (lv <= 12) return 4;
  if (lv <= 16) return 5;
  return 6;
}

/** Dados de Vida disponíveis no descanso curto = nível do personagem. */
export function getHitDiceMax(level: number): number {
  return Math.max(1, Math.min(20, level | 0));
}

/** Grau do Feiticeiro (cosmético). */
export type SorcererRank = 'Quarto Grau' | 'Terceiro Grau' | 'Segundo Grau' | 'Primeiro Grau' | 'Grau Especial';

export function getSorcererRank(level: number): SorcererRank {
  const lv = Math.max(1, Math.min(20, level | 0));
  if (lv <= 4) return 'Quarto Grau';
  if (lv <= 7) return 'Terceiro Grau';
  if (lv <= 13) return 'Segundo Grau';
  if (lv <= 18) return 'Primeiro Grau';
  return 'Grau Especial';
}

// ===== 2. Atributos auxiliares =============================================

/** Modificador padrão D20: floor((valor - 10)/2). */
export function getAttrMod(value: number): number {
  return Math.floor((value - 10) / 2);
}

/** Recupera valor cru do atributo por nome. */
export function getAttrValue(c: Pick<Character, 'attributes'>, name: string): number {
  return (c.attributes || []).find(a => a.name === name)?.value ?? 10;
}

/** Mod de CON corrente. */
export function getConMod(c: Pick<Character, 'attributes'>): number {
  return getAttrMod(getAttrValue(c, 'Constituição'));
}

/** Atributo-chave para PE por classe. Apenas Especialista em Técnica/Controlador/Suporte ganham bônus. */
export function getKeyAttrForSpec(spec: Specialization): string | null {
  switch (spec) {
    case 'Especialista em Técnica':
      return 'Inteligência';
    case 'Controlador':
      return 'Sabedoria';
    case 'Suporte':
      return 'Presença';
    default:
      return null;
  }
}

/**
 * Multiplicador de PE por nível, por especialização.
 * Fórmula: PE Máximo = mult × Nível + Mod. do Atributo-Chave (se houver).
 *
 * - Especialista em Técnica: 6/nível + INT
 * - Controlador / Suporte:   5/nível + atributo-chave
 * - Especialista em Combate / Golpeador: 4/nível + 0
 * - Lutador:                 4/nível + 0 (sem mod)
 * - Restringido:             2/nível + 0
 */
export function getPePerLevelMult(spec: Specialization): number {
  switch (spec) {
    case 'Especialista em Técnica':
      return 6;
    case 'Controlador':
    case 'Suporte':
      return 5;
    case 'Lutador':
    case 'Especialista em Combate':
    case 'Golpeador':
      return 4;
    case 'Restringido':
      return 2;
    default:
      return 4;
  }
}

/** PE máximo automático: mult × nível + keyMod + bônus externos manuais. */
export function recalcPeMaxBySpec(
  level: number,
  spec: Specialization,
  attrs: Attribute[],
  bonusExternal = 0,
): number {
  const mult = getPePerLevelMult(spec);
  const keyName = getKeyAttrForSpec(spec);
  let keyMod = 0;
  if (keyName) {
    const value = attrs.find(a => a.name === keyName)?.value ?? 10;
    keyMod = getAttrMod(value);
  }
  return Math.max(0, mult * Math.max(1, level | 0) + keyMod + bonusExternal);
}

/** Restringidos NÃO ganham Aptidões Amaldiçoadas ao subir de nível. */
export function isRestringido(spec: Specialization): boolean {
  return spec === 'Restringido';
}

// ===== 3. Histórico por nível ==============================================

/**
 * Snapshot leve do que foi aplicado em cada nível.
 * Permite recálculo retroativo correto (CON e atributo-chave).
 */
export interface LevelHistoryEntry {
  /** Nível ATINGIDO neste evento (>= 2 para ganhos pós Nv1). */
  level: number;
  /** HP base concedido (rolagem ou média) — SEM o mod de CON daquele momento. */
  hpRollBase: number;
  /** Modificador de CON usado no momento do level up (snapshot p/ saber se mudou). */
  conModSnapshot: number;
}

// ===== 4. Cálculo retroativo de HP via CON =================================

/**
 * Recalcula o `hpMax` a partir de:
 *   hpStartingBase  (PV iniciais do Nv 1, definidos no wizard)
 *   + Σ hpRollBase de cada level-up
 *   + (currentConMod * level)
 *   + bonusHpExternal (passivas/itens etc., já agregados externamente)
 *
 * O mod de CON ATUAL multiplica TODOS os níveis ⇒ retroativo automático.
 */
export function recalcHpMaxFromHistory(
  hpStartingBase: number,
  history: LevelHistoryEntry[],
  currentConMod: number,
  level: number,
  bonusHpExternal = 0,
): number {
  const rollSum = history.reduce((s, h) => s + (h.hpRollBase || 0), 0);
  return Math.max(1, hpStartingBase + rollSum + currentConMod * level + bonusHpExternal);
}

// ===== 5. Cálculo retroativo de PE via Atributo Chave ======================

/**
 * Recálculo retroativo de PE *baseado no histórico legado*.
 *
 * Soma simples (sem `mult * level`):
 *   PE = peStartingBase + pePerLevelGains + keyMod(spec, attrs) + bonusPeExternal
 *
 * O `keyMod` entra **uma única vez** — não escala com nível. Spec sem
 * atributo-chave (Lutador, Golpeador, Especialista em Combate, Restringido)
 * recebe `keyMod = 0`. Para o cálculo automático moderno, use
 * `recalcPeMaxBySpec`.
 */
export function recalcPeMaxFromHistory(
  peStartingBase: number,
  pePerLevelGains: number,
  spec: Specialization,
  attrs: Attribute[],
  bonusPeExternal = 0,
  _level = 1,
): number {
  const keyName = getKeyAttrForSpec(spec);
  let keyMod = 0;
  if (keyName) {
    const value = attrs.find((a) => a.name === keyName)?.value ?? 10;
    keyMod = getAttrMod(value);
  }
  return Math.max(0, peStartingBase + pePerLevelGains + keyMod + bonusPeExternal);
}

// ===== 6. Geração de Trackers pendentes ====================================

/**
 * Tipos de pendência geradas pelo motor de progressão.
 *
 * Marcos (Nv 4/8/12/16/20):
 *   - asi_milestone           → Escolha A (atributos +2) OU B (Talento Geral).
 *   - derivado_attr_milestone → Bônus exclusivo da Origem 'Derivado': +1 ponto que
 *                               quebra o cap normal do atributo escolhido.
 *
 * Por nível normal (>=2):
 *   - skill_or_talent  → Habilidade de Especialização OU Talento.
 *   - cursed_aptitude  → Aptidão Amaldiçoada (somente não-Restringidos).
 *   - hp_roll_or_fixed → PV: rolar dado de vida ou usar média fixa.
 *
 * Especiais:
 *   - master_skill                 → Nv 10: promover 1 perícia para Mestre.
 *   - skill_training_talent_choice → gerada pelo Talento "Treinamento em Perícia"
 *                                    (ainda não exposto na UI de talentos);
 *                                    A: +2 treinos / B: +1 maestria.
 */
export type PendingLevelChoiceKind =
  | 'skill_or_talent'
  | 'cursed_aptitude'
  | 'aptitude_distribute'
  | 'pending_aptitude_choice'
  | 'hp_roll_or_fixed'
  | 'asi_milestone'
  | 'derivado_attr_milestone'
  | 'master_skill'
  | 'skill_training_talent_choice'
  // ===== Pendências do Lutador =====
  | 'lutador_initial_maneuvers'
  | 'lutador_extra_maneuver'
  | 'lutador_save_mastery'
  // ===== Pendências do Especialista em Técnica =====
  | 'tecnica_fundamentos_initial'
  | 'tecnica_fundamentos_extra'
  | 'tecnica_foco'
  | 'tecnica_extra_spell'
  | 'tecnica_save_mastery'
  | 'tecnica_refino_grant'
  // ===== Pendências de Origem (Cl\u00e3 Zenin) =====
  | 'zenin_focused_spell';

/**
 * Snapshot dos efeitos mecânicos aplicados ao resolver uma pendência.
 * Usado para REVERTER ao baixar de nível (sem perdas/ganhos infinitos).
 */
export interface PendingChoiceAppliedEffect {
  /** Pontos creditados em availableAttrPoints. */
  attrPointsDelta?: number;
  /** Atributos efetivamente gastos (nome → +N no value). */
  attrSpends?: Record<string, number>;
  /** Cap expandido por atributo (Derivado quebra +1). */
  capDelta?: Record<string, number>;
  /** Id do talento registrado em `Character.pendingTalents` (escolha em aberto). */
  pendingTalentId?: string;
  /** Treinos creditados. */
  trainingsDelta?: number;
  /** Maestrias creditadas. */
  masteryDelta?: number;
  /** Perícia promovida a Mestre (id). */
  promotedSkillId?: string;
  /** Perícia tornada Treinada (id) por skill_or_talent kind=skill. */
  trainedSkillId?: string;
  /** Pontos creditados em availableSpecAbilities (skill_or_talent → 'skill'). */
  specAbilitiesDelta?: number;
  /** Pontos restantes do tracker `aptitude_distribute`. */
  pointsRemaining?: number;
  /** Histórico de pontos gastos POR este tracker em cada aptidão (para reverter). */
  aptitudeSpends?: Partial<Record<import('@/types').AptitudeKey, number>>;
}

export interface PendingLevelChoice {
  /** ID estável (usado como key e para resolver). */
  id: string;
  /** Nível em que o tracker foi criado. */
  level: number;
  kind: PendingLevelChoiceKind;
  label: string;
  /** Resolvido? Sempre persistido para auditoria. */
  resolved: boolean;
  /** Valor opcional escolhido (string livre p/ aptidão, "A"|"B" p/ ASI etc.). */
  value?: string;
  /** Snapshot reversível do efeito aplicado. */
  appliedEffect?: PendingChoiceAppliedEffect;
}

/**
 * Constrói TODAS as pendências disparadas pelo level-up de oldLevel → newLevel.
 * Aceita salto de múltiplos níveis (gera trackers de cada um).
 */
export function buildLevelUpTrackers(
  oldLevel: number,
  newLevel: number,
  spec: Specialization,
  _charClass: CharacterClass,
  origin?: Origin,
): PendingLevelChoice[] {
  const out: PendingLevelChoice[] = [];
  if (newLevel <= oldLevel) return out;

  for (let lv = oldLevel + 1; lv <= newLevel; lv++) {
    const nv = `Nv ${lv}`;

    // Escolha CONSTANTE: Habilidade da Classe OU Talento
    out.push({
      id: `${lv}-skilltalent-${crypto.randomUUID()}`,
      level: lv,
      kind: 'skill_or_talent',
      label: `${nv}: Escolher 1 Habilidade de Especialização OU 1 Talento`,
      resolved: false,
    });

    // Aptidões Amaldiçoadas — sistema numérico (AU/CL/BAR/DOM/ER).
    // Distribuição: 1 ponto em níveis pares; 2 pontos nos picos (10 e 20).
    if (!isRestringido(spec)) {
      const evenLevels = [2, 4, 6, 8, 12, 14, 16, 18];
      const peakLevels = [10, 20];
      let pts = 0;
      if (evenLevels.includes(lv)) pts = 1;
      if (peakLevels.includes(lv)) pts = 2;
      if (pts > 0) {
        out.push({
          id: `${lv}-aptitude-${crypto.randomUUID()}`,
          level: lv,
          kind: 'aptitude_distribute',
          label: `${nv}: Distribuir ${pts} ponto(s) de Aptidão Amaldiçoada`,
          resolved: false,
          value: String(pts),
          appliedEffect: { pointsRemaining: pts, aptitudeSpends: {} },
        });
      }
    }

    // PV — Rolagem vs Fixo
    out.push({
      id: `${lv}-hp-${crypto.randomUUID()}`,
      level: lv,
      kind: 'hp_roll_or_fixed',
      label: `${nv}: Rolar Dado de Vida ou usar valor Fixo (+CON)`,
      resolved: false,
    });

    // ===== MARCOS (Nv 4, 8, 12, 16, 20) =====
    if (isMilestoneLevel(lv)) {
      // ASI — Aumento de Atributo (A) OU Talento (B)
      out.push({
        id: `${lv}-asi-${crypto.randomUUID()}`,
        level: lv,
        kind: 'asi_milestone',
        label: `${nv} (Marco): Aumento de Atributo (+2) OU Talento Geral`,
        resolved: false,
      });

      // Exceção da Origem: Derivado ganha +1 ponto que QUEBRA o cap.
      if (origin === 'Derivado') {
        out.push({
          id: `${lv}-derivado-${crypto.randomUUID()}`,
          level: lv,
          kind: 'derivado_attr_milestone',
          label: `${nv} (Marco — Derivado): +1 Ponto de Atributo (quebra o limite)`,
          resolved: false,
        });
      }
    }

    if (lv === 10) {
      out.push({
        id: `${lv}-master-${crypto.randomUUID()}`,
        level: lv,
        kind: 'master_skill',
        label: `Nv 10: Escolher 1 Perícia para se tornar Mestre`,
        resolved: false,
      });
    }
  }
  return out;
}

/** Marcos do talento Afinidade com Técnica que concedem +1 feitiço. */
export const AFINIDADE_TECNICA_MILESTONES = [5, 10, 15, 20] as const;

/**
 * Constrói trackers de feitiço extra do talento Afinidade com Técnica para
 * marcos atravessados em um level-up. NÃO inclui o feitiço imediato da compra
 * (esse é gerado em `addTalent`/`chooseTalentFromPool`).
 */
export function buildAfinidadeTecnicaTrackers(
  oldLevel: number,
  newLevel: number,
  hasAfinidadeAtLevel: number | null,
): PendingLevelChoice[] {
  if (hasAfinidadeAtLevel === null) return [];
  const out: PendingLevelChoice[] = [];
  for (const mile of AFINIDADE_TECNICA_MILESTONES) {
    if (mile > oldLevel && mile <= newLevel && mile >= hasAfinidadeAtLevel) {
      out.push({
        id: `${mile}-afinidade-spell-${crypto.randomUUID()}`,
        level: mile,
        kind: 'tecnica_extra_spell',
        label: `Nv ${mile}: Afinidade com Técnica — +1 Feitiço extra`,
        resolved: false,
      });
    }
  }
  return out;
}

/**
 * Cria a pendência específica do Talento "Treinamento em Perícia".
 * Chamada quando o talento for selecionado no catálogo (`src/lib/talents.ts`).
 */
export function buildSkillTrainingTalentChoice(level: number): PendingLevelChoice {
  return {
    id: `${level}-trainingtalent-${crypto.randomUUID()}`,
    level,
    kind: 'skill_training_talent_choice',
    label: `Talento "Treinamento em Perícia": +2 Treinos OU +1 Maestria`,
    resolved: false,
  };
}

// ===== 7. Dado de vida por classe ==========================================

/** Dado de vida da classe. Default d8.
 *
 * Prioridade: a especialização define o dado quando aplicável (Lutador/Golpeador
 * → d10, demais Feiticeiros → d8). Só caímos no dado por classe (Maldição d10,
 * Não-Feiticeiro d6) quando a especialização não traz informação útil. Isso evita
 * inconsistências em personagens migrados onde `characterClass` ficou como
 * 'Não-Feiticeiro' mas a `specialization` é uma de Feiticeiro.
 */
export function getClassHitDie(charClass: CharacterClass, spec: Specialization): number {
  switch (spec) {
    case 'Lutador':
    case 'Golpeador':
      return 10;
    case 'Especialista em Técnica':
    case 'Especialista em Combate':
    case 'Restringido':
    case 'Controlador':
    case 'Suporte':
      return 8;
  }
  if (charClass === 'Maldição') return 10;
  if (charClass === 'Não-Feiticeiro') return 6;
  return 8;
}

/** Média arredondada para cima do dado: dN → ceil((N+1)/2). */
export function getDieAvg(sides: number): number {
  return Math.ceil((sides + 1) / 2);
}
