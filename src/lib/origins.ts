/**
 * ============================================================================
 *  DICIONÁRIO DE LÓGICA POR ORIGEM
 * ============================================================================
 *  Cada Origem declara, de forma puramente declarativa:
 *   - quantos Trackers (pendências) ela cria;
 *   - quais atributos recebem bônus FIXOS (aplicados imediatamente);
 *   - quais ESCOLHAS de atributo (+2/+1) o jogador precisa fazer;
 *   - tags/habilidades injetadas na ficha;
 *   - automações por nível (recompensas progressivas);
 *   - travas (specialization lock, blocked features, attribute caps).
 *
 *  O motor (originEngine.ts) aplica esses dados ao estado do CharacterWizard.
 *  Mantenha este arquivo SEMPRE como única fonte de verdade — qualquer ajuste
 *  mecânico de Origens deve ocorrer aqui.
 * ============================================================================
 */

import type { Origin, Specialization } from '@/types';

// ===== TIPOS DE ESCOLHA =====
export type AttrName = 'Força' | 'Destreza' | 'Constituição' | 'Inteligência' | 'Sabedoria' | 'Presença';
export const ATTR_NAMES: AttrName[] = ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Presença'];
export const PHYSICAL_ATTRS: AttrName[] = ['Força', 'Destreza', 'Constituição'];

/** Modo da escolha de atributos (+2/+1) que aparece como dropdown na UI. */
export interface AttrChoiceSpec {
  /** Conjunto de atributos elegíveis para receber o +2 (vazio = todos). */
  pickFrom?: AttrName[];
  /** Conjunto restrito para o +1 (vazio = qualquer outro do total). */
  secondaryPickFrom?: AttrName[];
  /** Texto de instrução exibido. */
  hint: string;
}

/** Trava temporária de "treinos limitados" — perícias que podem ser treinadas. */
export interface TrainingChoice {
  count: number;                         // quantas perícias podem ser treinadas
  /** Lista branca; vazio = livre. */
  whitelist?: string[];
  /** Alternativa: 1 Expertise = upgrade de uma perícia já treinada para Maestria. */
  alternativeAsExpertise?: boolean;
  hint: string;
}

/** Habilidade narrativa anexada à ficha (vai como Passive). */
export interface OriginAbility {
  name: string;
  description: string;
  bonusHP?: number;
  bonusPE?: number;
  bonusESC?: number;
  bonusRD?: number;
  bonusCA?: number;
  bonusSlots?: number;
}

/** Recompensa automática concedida a cada N níveis (+1 a cada level%step==0). */
export interface LevelAutomation {
  /** Descrição amigável exibida ao jogador. */
  label: string;
  /** Função pura de "se aplica neste nível?". */
  appliesAt: (level: number) => boolean;
  /** Mutação aplicada quando subir de nível (consumido pelos handlers de level-up). */
  apply: (state: OriginAutomationState) => OriginAutomationState;
}

/**
 * Escolha pendente que o jogador precisa resolver para "limpar" o tracker.
 * Cobre tanto recompensas de Sem Técnica (Empenho Implacável) quanto
 * o pacote do Novo Estilo da Sombra (técnica amaldiçoada + Domínio Simples).
 */
export interface PendingChoice {
  id: string;
  level: number;
  /** Categoria mecânica para agrupamento na UI. */
  kind:
    | 'talent_or_aptitude'   // +1 Talento OU +1 Aptidão Amaldiçoada
    | 'skill_bonus'          // selecionar N perícias para receber +X fixo
    | 'class_specialization' // +1 Habilidade de Especialização
    | 'class_spec_and_talent'// +1 Habilidade de Especialização E +1 Talento
    | 'style_technique'      // +1 Técnica de Estilo (Novo Estilo da Sombra)
    | 'shadow_style_aptitude' // pendência de "Domínio Simples" se faltar requisito
  ;
  label: string;
  /** Quantidade de itens a selecionar (ex.: 2 perícias). */
  count?: number;
  /** Bônus fixo concedido por item (ex.: +1, +2, +3). */
  bonusValue?: number;
}

export interface OriginAutomationState {
  bonusHP: number;       // somado ao hpMax
  bonusPE: number;       // somado ao peMax
  extraSpells: number;   // feitiços bônus além do limite normal
  extraTalents: number;  // pendências de talento
  extraAttrPoints: number;
  extraTrainings: number;
  extraAnatomyChoices: number;
  attrCapBoost: number;  // limite máx de atributo +N (CAM/Derivado)
  /** Total de Técnicas de Estilo concedidas pelo Novo Estilo da Sombra. */
  extraStyleTechniques: number;
  /** Marca se o personagem já tem Domínio Simples ativo (Sem Técnica Nv 4+). */
  hasShadowStyle: boolean;
  /** Técnica Amaldiçoada injetada automaticamente (ex.: 'Novo Estilo da Sombra'). */
  tecnicaAmaldicoada?: string;
  /** Aptidão amaldiçoada concedida automaticamente (ex.: 'Domínio Simples'). */
  aptidaoConcedida?: string;
  /** Escolhas obrigatórias acumuladas (Trackers de level-up). */
  pendingChoices: PendingChoice[];
  notes: string[];
}

export function emptyAutomationState(): OriginAutomationState {
  return {
    bonusHP: 0, bonusPE: 0, extraSpells: 0, extraTalents: 0,
    extraAttrPoints: 0, extraTrainings: 0, extraAnatomyChoices: 0,
    attrCapBoost: 0, extraStyleTechniques: 0, hasShadowStyle: false,
    pendingChoices: [], notes: [],
  };
}

// ===== CLÃS (sub-menu de "Herdado") =====
export type ClanId = 'Gojo' | 'Inumaki' | 'Kamo' | 'Zenin';
export const CLANS: ClanId[] = ['Gojo', 'Inumaki', 'Kamo', 'Zenin'];

export interface ClanData {
  id: ClanId;
  description: string;
  attrChoice: AttrChoiceSpec;
  training: TrainingChoice;
  abilities: OriginAbility[];
  /** Níveis em que ganha +1 feitiço extra (acumulam). */
  extraSpellLevels?: number[];
  /** Níveis em que injeta uma tag/feitiço focado. */
  focusedSpellLevels?: number[];
  /** Opções de bônus do Feitiço Focado (Zenin). */
  focusedSpellBonusOptions?: string[];
  /** Tracker de usos diários igual ao Bônus de Treinamento (Inumaki). */
  dailyUsesEqualsTraining?: { abilityName: string; resetOn: 'short' | 'long' };
  /** Reroll de PV abaixo da média, mantém o maior (Kamo). */
  rerollHpBelowAverage?: boolean;
  /** Bônus por nível (curva contínua). */
  perLevel?: {
    hpPerLevel?: number;
    pePerEvenLevel?: number;
    /** Bônus extra de PV ao atingir NVL específico (ex.: nv 10 +MOD CON). */
    bonusAtLevel?: { level: number; note: string }[];
  };
}

export const CLAN_DATA: Record<ClanId, ClanData> = {
  Gojo: {
    id: 'Gojo',
    description: 'Linhagem reverenciada com Seis Olhos e Vazio Infinito — sintonia inata com energia amaldiçoada.',
    attrChoice: {
      pickFrom: ['Inteligência', 'Sabedoria'],
      secondaryPickFrom: ['Inteligência', 'Sabedoria'],
      hint: 'Escolha +2 em INT ou SAB; o atributo restante recebe +1.',
    },
    training: {
      count: 2,
      whitelist: ['Feitiçaria', 'Percepção', 'Intuição'],
      alternativeAsExpertise: true,
      hint: '2 treinos (Feitiçaria, Percepção ou Intuição) OU 1 Expertise.',
    },
    abilities: [{
      name: 'Potencial Lendário (Seis Olhos / Vazio Infinito)',
      description: 'Sintonia inata com Energia Amaldiçoada: +1 PE máximo a cada nível PAR (2, 4, 6...). Ganha +1 SLOT de feitiço no nível 1 e novamente nos níveis 5, 10, 15 e 20 (acumulativo).',
    }],
    extraSpellLevels: [1, 5, 10, 15, 20],
    perLevel: { pePerEvenLevel: 1 },
  },
  Inumaki: {
    id: 'Inumaki',
    description: 'Clã das Palavras Amaldiçoadas — comandos verbais que dobram a vontade alheia.',
    attrChoice: {
      pickFrom: ['Inteligência', 'Presença'],
      secondaryPickFrom: ['Inteligência', 'Presença'],
      hint: 'Escolha +2 em INT ou PRE; o atributo restante recebe +1.',
    },
    training: {
      count: 2,
      whitelist: ['Feitiçaria', 'Percepção', 'Intuição'],
      alternativeAsExpertise: true,
      hint: '2 treinos (Feitiçaria, Percepção ou Intuição) OU 1 Expertise.',
    },
    abilities: [{
      name: 'Olhos de Cobra e Presas',
      description: 'Como AÇÃO BÔNUS, concede uma Ação Bônus a um aliado, que ele usa como REAÇÃO. Usos diários iguais ao Bônus de Treinamento (Maestria). Reset no descanso LONGO.',
    }],
    dailyUsesEqualsTraining: { abilityName: 'Olhos de Cobra e Presas', resetOn: 'long' },
  },
  Kamo: {
    id: 'Kamo',
    description: 'Tradição férrea e disciplina marcial — corpos resistentes e sangue manipulado.',
    attrChoice: {
      pickFrom: ['Constituição', 'Sabedoria'],
      secondaryPickFrom: ['Constituição', 'Sabedoria'],
      hint: 'Escolha +2 em CON ou SAB; o atributo restante recebe +1.',
    },
    training: {
      count: 2,
      whitelist: ['Atletismo', 'Medicina', 'Persuasão'],
      alternativeAsExpertise: true,
      hint: '2 treinos (Atletismo, Medicina ou Persuasão) OU 1 Expertise.',
    },
    abilities: [{
      name: 'Valor do Sangue',
      description: '+1 PV MÁXIMO em cada subida de nível. A partir do nível 10, soma o MOD de CON ao PV total novamente. ROLAGEM: ao rolar vida, se o resultado for MENOR que a média do dado, rerola automaticamente e mantém o MAIOR.',
    }],
    rerollHpBelowAverage: true,
    perLevel: {
      hpPerLevel: 1,
      bonusAtLevel: [{ level: 10, note: 'Soma adicional de MOD CON ao PV máximo total.' }],
    },
  },
  Zenin: {
    id: 'Zenin',
    description: 'Tradição militar dos Três Grandes Clãs — disciplina e Feitiço Focado.',
    attrChoice: { hint: 'Escolha +2 em qualquer atributo; outro atributo recebe +1.' },
    training: {
      count: 2,
      alternativeAsExpertise: true,
      hint: '2 treinos livres OU 1 Expertise.',
    },
    abilities: [{
      name: 'Foco no Poder',
      description: 'Nos níveis 1, 5, 10, 15 e 20, marque um feitiço como FOCADO e escolha UM bônus para ele: (a) +1 dado de DANO; (b) +1 dado de CURA; (c) DOBRO de ALCANCE; (d) +CD igual ao Bônus de Treinamento. As escolhas são permanentes por feitiço focado.',
    }],
    focusedSpellLevels: [1, 5, 10, 15, 20],
    focusedSpellBonusOptions: [
      '+1 dado de DANO',
      '+1 dado de CURA',
      'DOBRO de ALCANCE',
      '+CD igual ao Bônus de Treinamento',
    ],
  },
};

// ===== APTIDÕES AMALDIÇOADAS DE AURA (Derivado) =====
export interface AuraAptitude { id: string; name: string; description: string; }
export const AURA_APTITUDES: AuraAptitude[] = [
  { id: 'sintonia', name: 'Sintonia',     description: 'Detecta nuances emocionais em uma aura à vista. Vantagem em Intuição contra usuários de Energia.' },
  { id: 'eco',      name: 'Eco Reverso',  description: 'Reverbera o impacto de um feitiço alheio: gasta 1 reação para reduzir dano sofrido em 1d8+MOD SAB.' },
  { id: 'vau',      name: 'Véu',           description: 'Mascara a própria assinatura de Energia, dificultando rastreio (CD aumenta em +2 contra você).' },
  { id: 'compasso', name: 'Compasso',      description: 'Ação bônus: marca alvo. Próximo ataque contra ele tem +1d4 dano.' },
  { id: 'cinza',    name: 'Cinzas',        description: 'Quando reduzido a 0 PV, libera explosão: alvos a 1,5m sofrem MOD CON em DNR.' },
];

// ===== ANATOMIAS (Feto Amaldiçoado Híbrido) =====
/**
 * Cada anatomia é resolvida pelo `originEngine.applyAnatomyPassives` que aplica
 * os modificadores ao snapshot do personagem (HP, speed, RD, init, perícias, etc.).
 * Slots de seleção são abertos nos níveis 1, 5, 10, 15 e 20.
 */
export interface AnatomyTrait {
  id: string;
  name: string;
  description: string;
  /** Logic-text breve (referência para devs/UI; não-executável). */
  logic?: string;
}
export const FAH_ANATOMIES: AnatomyTrait[] = [
  {
    id: 'desenvolvimento_exagerado',
    name: 'Desenvolvimento Exagerado',
    description: 'Categoria de Tamanho +1. HP Máximo aumenta em +1 por Nível.',
    logic: 'sizeCategory += 1; hpMax += 1 * level',
  },
  {
    id: 'bracos_extras',
    name: 'Braços Extras',
    description: 'Prestidigitação +2. Permite equipar +1 item. Toggle "Duas Mãos Livres" estende +2 a Atletismo.',
    logic: 'skills.prestidigitacao += 2; equipSlots += 1; if (anatomyDuasMaosLivres) skills.atletismo += 2',
  },
  {
    id: 'pernas_extras',
    name: 'Pernas Extras',
    description: 'Deslocamento +4,5 m. Ignora Terreno Difícil terrestre.',
    logic: 'movement += 4.5; ignoresGroundDifficultTerrain = true',
  },
  {
    id: 'articulacoes_extensas',
    name: 'Articulações Extensas',
    description: 'Alcance corpo-a-corpo +1,5 m.',
    logic: 'meleeRange += 1.5',
  },
  {
    id: 'corpo_especializado',
    name: 'Corpo Especializado',
    description: 'Escolha 1 perícia: ela ganha bônus permanente de +1d4 em todas as rolagens.',
    logic: 'skill[chosen].bonusDie = "1d4"',
  },
  {
    id: 'carapaca_mutante',
    name: 'Carapaça Mutante',
    description: 'Recebe RD Físico = Bônus de Maestria. No Nv 10, ganha Resistência (½ dano) a 1 tipo físico escolhido.',
    logic: 'rd.fisico = getMasteryBonus(level); if (level>=10) resistance[chosenPhysType] = true',
  },
  {
    id: 'olhos_sombrios',
    name: 'Olhos Sombrios',
    description: 'Visão no Escuro. Treinado em Percepção e +2 fixo. No Nv 12, ignora Escuridão Total.',
    logic: 'flags.darkvision = true; skills.percepcao.trained = true; +2 fixo; if (level>=12) ignoresTotalDarkness',
  },
  {
    id: 'instinto_sanguinario',
    name: 'Instinto Sanguinário',
    description: 'Iniciativa +Maestria. Em combate, Atenção também recebe +Maestria.',
    logic: 'initiative += masteryBonus; if (combat.inCombat) attention += masteryBonus',
  },
];

/** Slots de Anatomia abertos por nível. */
export const FAH_ANATOMY_SLOT_LEVELS = [1, 5, 10, 15, 20] as const;
/** Quantos slots de Anatomia o personagem tem disponíveis no nível atual. */
export function calcAnatomySlots(level: number): number {
  return FAH_ANATOMY_SLOT_LEVELS.filter((lv) => lv <= level).length;
}

// ===== NÚCLEOS (Corpo Amaldiçoado Mutante) =====
export interface CoreTemplate { id: 'core1' | 'core2' | 'core3'; name: string; description: string; }
export const CAM_CORES: CoreTemplate[] = [
  { id: 'core1', name: 'Núcleo I — Sombra',    description: 'Foco em furtividade e DAL. PV menor, PE maior.' },
  { id: 'core2', name: 'Núcleo II — Carcaça',  description: 'Tanque: PV alto, RD natural.' },
  { id: 'core3', name: 'Núcleo III — Lâmina',  description: 'Ataques físicos amaldiçoados, equilíbrio entre PV e PE.' },
];

// ===== "SEM TÉCNICA" — EMPENHO IMPLACÁVEL (escolhas pendentes por nível) =====
/**
 * Regra de cada nível-marco do Empenho Implacável. As escolhas são injetadas
 * como PendingChoice na automação para o jogador resolver na ficha.
 */
export interface SemTecnicaReward {
  level: number;
  kind: PendingChoice['kind'];
  label: string;
  count?: number;
  bonusValue?: number;
  description: string;
}
export const SEM_TECNICA_REWARDS: SemTecnicaReward[] = [
  { level: 1,  kind: 'talent_or_aptitude',     label: '+1 Talento OU +1 Aptidão Amaldiçoada',              description: '+1 Talento OU +1 Aptidão Amaldiçoada.' },
  { level: 3,  kind: 'skill_bonus',            label: 'Selecionar 2 perícias para receber +1 fixo',         count: 2, bonusValue: 1, description: 'Selecionar 2 perícias para +1 fixo.' },
  { level: 6,  kind: 'class_specialization',   label: '+1 Habilidade de Especialização da sua classe',      description: '+1 Habilidade de Especialização.' },
  { level: 10, kind: 'talent_or_aptitude',     label: '+1 Talento OU +1 Aptidão Amaldiçoada',               description: '+1 Talento OU +1 Aptidão Amaldiçoada.' },
  { level: 13, kind: 'skill_bonus',            label: 'Selecionar 2 perícias para receber +2 fixo',         count: 2, bonusValue: 2, description: 'Selecionar 2 perícias para +2 fixo.' },
  { level: 15, kind: 'class_specialization',   label: '+1 Habilidade de Especialização',                    description: '+1 Habilidade de Especialização.' },
  { level: 17, kind: 'skill_bonus',            label: 'Selecionar 2 perícias para receber +3 fixo',         count: 2, bonusValue: 3, description: 'Selecionar 2 perícias para +3 fixo.' },
  { level: 19, kind: 'class_spec_and_talent',  label: '+1 Habilidade de Especialização E +1 Talento',       description: '+1 Habilidade de Especialização + 1 Talento.' },
];

/** Níveis em que o Sem Técnica ganha +1 Técnica de Estilo (Novo Estilo da Sombra). */
export const SHADOW_STYLE_TECHNIQUE_LEVELS = [4, 8, 12, 16, 20] as const;

// ===== ESPECIFICAÇÃO POR ORIGEM =====
export interface OriginSpec {
  id: Origin;
  shortLabel: string;
  description: string;
  /** Bônus FIXOS aplicados na hora (sem dropdown). */
  fixedAttrBonuses?: Partial<Record<AttrName, number>>;
  /** Escolha de atributo via dropdown (+2/+1). null = sem escolha. */
  attrChoice: AttrChoiceSpec | null;
  /** Trackers iniciais. */
  trackers: {
    availableAttrPoints?: number;
    /** Quando set, applyOriginEffects retornará attrPointsLockedTo (ex.: ['Força','Destreza','Constituição']) */
    attrPointsLockedTo?: AttrName[];
    /** Tetos individuais para esses pontos (ex.: max 3 no mesmo atributo). */
    attrPointsCapPerAttr?: number;
    availableTrainings?: number;
    trainingChoice?: TrainingChoice;
    availableTalents?: number;
    /** Pendências especiais: 'clan' | 'anatomy' | 'core' | 'aura'. */
    pendingSpecialChoice?: { kind: 'clan' | 'anatomy' | 'core' | 'aura'; count: number; label: string };
  };
  /** Habilidades injetadas como Passive na ficha. */
  abilities: OriginAbility[];
  /** Tags livres (rótulos exibidos na ficha). */
  tags: string[];
  /** Especialização travada. */
  lockSpecialization?: Specialization;
  /** Specializations bloqueadas. */
  blockedSpecializations?: Specialization[];
  /** Bloqueia acesso a feitiços por completo. */
  blockSpells?: boolean;
  /** Atributos com cap diferente (ex.: Restringido = FOR/DES/CON cap 30). */
  attrCapOverrides?: Partial<Record<AttrName, number>>;
  /** Imunidades rápidas (texto). */
  immunitiesNotes?: string[];
  /** Cura reversa cai pela metade (FAH). */
  healingHalved?: boolean;
  /** Bônus de movimento (Restringido +3m). */
  movementBonus?: number;
  /** Feitiços extras imediatos (Inato). */
  extraSpellsImmediate?: number;
  /** Tags acopladas a feitiços extras imediatos. */
  extraSpellTag?: string;
  /** Ativa o sistema de Núcleos. */
  enablesCores?: boolean;
  /** Curva de automação por nível (descrição + acúmulo). */
  perLevel?: {
    label: string;
    apply: (level: number, st: OriginAutomationState) => OriginAutomationState;
  }[];
}

// ===== HELPERS =====
const isEvery = (n: number) => (lvl: number) => lvl > 0 && lvl % n === 0;

// ===== ESPECIFICAÇÕES =====
export const ORIGIN_SPECS: Record<Origin, OriginSpec> = {
  Inato: {
    id: 'Inato',
    shortLabel: 'INATO',
    description: 'Nasceu com o controle natural da Energia Amaldiçoada — talento bruto.',
    attrChoice: { hint: 'Escolha +2 em um atributo e +1 em outro.' },
    trackers: { availableTalents: 1 },
    abilities: [
      {
        name: 'Talento Natural',
        description: 'Você ganha um talento extra no Nível 1.',
      },
      {
        name: 'O Bônus Escondido',
        description: 'A partir do Nível 4, você ganha mais um talento grátis.',
      },
      {
        name: 'Marca Registrada',
        description: 'Um feitiço escolhido recebe a tag "Marca Registrada": custo de PE -1 (mínimo 1).',
      }
    ],
    tags: ['Marca Registrada: Custo -1 PE'],
    extraSpellsImmediate: 1,
    extraSpellTag: 'Marca Registrada',
    perLevel: [{
      label: 'Nível 4: +1 Talento grátis (O Bônus Escondido).',
      apply: (lvl, st) => {
        if (lvl === 4) {
          return { ...st, extraTalents: st.extraTalents + 1, notes: [...st.notes, `Nv ${lvl}: +1 talento (O Bônus Escondido)`] };
        }
        return st;
      },
    }],
  },
  Herdado: {
    id: 'Herdado',
    shortLabel: 'HERDADO',
    description: 'Pertence a um Clã ancestral — escolha qual linhagem flui em seu sangue.',
    attrChoice: null, // depende do clã
    trackers: {
      pendingSpecialChoice: { kind: 'clan', count: 1, label: 'Selecionar Clã (Gojo, Inumaki, Kamo ou Zenin)' },
    },
    abilities: [],
    tags: [],
  },
  Derivado: {
    id: 'Derivado',
    shortLabel: 'DERIVADO',
    description: 'Manipula derivações da própria Aura — versatilidade rara.',
    attrChoice: { hint: 'Escolha +2 em um atributo e +1 em outro.' },
    trackers: {
      pendingSpecialChoice: { kind: 'aura', count: 1, label: 'Selecionar 1 Aptidão Amaldiçoada de Aura' },
    },
    abilities: [
      {
        name: 'Energia Antinatural',
        description: 'Despertou o poder de forma antinatural. Selecione 1 Aptidão Amaldiçoada de Aura (verifique requisitos). AÇÃO: "Recuperação de Emergência" — recupera PE igual ao DOBRO do Bônus de Treinamento (Maestria). Uso 1× POR DIA.',
      },
      {
        name: 'Desenvolvimento Inesperado',
        description: 'Nos níveis 4, 8, 12, 16 e 20: ganha +1 ponto de atributo adicional E o LIMITE MÁXIMO daquele atributo onde o ponto for aplicado sobe em +1 (Derivado pode ultrapassar os limites normais do sistema).',
      },
    ],
    tags: ['Recuperação de Emergência (1×/dia)', 'Energia Antinatural', 'Desenvolvimento Inesperado'],
    perLevel: [{
      // Apenas REGISTRA a nota no log. A pendência real (escolha de atributo +1 e
      // cap +1 daquele atributo) é gerada por buildLevelUpTrackers() no levelEngine
      // como kind 'derivado_attr_milestone' e resolvida via PendingLevelChoicesPanel.
      // NÃO mexemos em extraAttrPoints/attrCapBoost aqui para evitar duplicação.
      label: 'Desenvolvimento Inesperado (Nv 4/8/12/16/20): escolher atributo na ficha.',
      apply: (lvl, st) => {
        if (lvl > 0 && lvl % 4 === 0 && lvl <= 20) {
          return {
            ...st,
            notes: [...st.notes, `Nv ${lvl}: Desenvolvimento Inesperado — escolha o atributo na pendência "Marco — Derivado" para receber +1 ponto e +1 no limite daquele atributo.`],
          };
        }
        return st;
      },
    }],
  },
  Restringido: {
    id: 'Restringido',
    shortLabel: 'RESTRINGIDO',
    description: 'Corpo modificado, treinamento extremo: pesa o físico, paga o preço sobrenatural. Classe travada em Feiticeiro / Restringido.',
    fixedAttrBonuses: { 'Força': 1, 'Destreza': 1, 'Constituição': 1 },
    attrChoice: null,
    trackers: {
      availableAttrPoints: 2,
      attrPointsLockedTo: PHYSICAL_ATTRS,
    },
    abilities: [
      {
        name: 'Físico Abençoado',
        description: 'Deslocamento +3m permanente. Imune a Doenças Mundanas. Vantagem em Testes de Resistência contra Venenos. DESCANSO CURTO: ao curar, soma metade do Bônus de Treinamento (arredondado para baixo) ao TOTAL de dados de cura rolados.',
      },
      {
        name: 'Ápice Corporal Humano',
        description: 'Limite máximo de FOR / DES / CON sobe para 30. Nos níveis 6, 12 e 18, GANHA uma escolha obrigatória: +2 em FOR, DES OU CON. NOTA (Atletismo): ao testar Atletismo para erguer peso ou saltar, DOBRE o limite de peso ou a distância saltada.',
      },
      {
        name: 'Resiliência Imediata',
        description: 'REAÇÃO ao receber dano: gasta 1 USO para reduzir o dano em Math.max(1, Math.floor(Nível/2)) × 5. ALTERNATIVA: gasta 1 USO para evitar a condição "Desmembramento". USOS MÁXIMOS = Bônus de Treinamento (Maestria). Recupera todos no DESCANSO LONGO.',
      },
    ],
    tags: [
      'Físico Reforçado',
      'Imune a Doenças Mundanas',
      'Vantagem em TR contra Venenos',
      'Deslocamento +3m',
      'Atletismo: dobra peso/salto',
      'Resiliência Imediata (usos = Bônus de Treinamento)',
    ],
    lockSpecialization: 'Restringido',
    attrCapOverrides: { 'Força': 30, 'Destreza': 30, 'Constituição': 30 },
    immunitiesNotes: ['Doenças mundanas'],
    movementBonus: 3,
    perLevel: [{
      label: 'Ápice Corporal Humano (Nv 6/12/18): +2 em FOR, DES ou CON (escolha).',
      apply: (lvl, st) => {
        if (lvl === 6 || lvl === 12 || lvl === 18) {
          return {
            ...st,
            extraAttrPoints: st.extraAttrPoints + 2,
            notes: [...st.notes, `Nv ${lvl}: Ápice Corporal Humano — +2 pontos em FOR, DES ou CON.`],
          };
        }
        return st;
      },
    }],
  },
  'Feto Amaldiçoada Híbrido (FAH)': {
    id: 'Feto Amaldiçoada Híbrido (FAH)',
    shortLabel: 'FAH',
    description: 'Híbrido entre humano e maldição — anatomia em mutação.',
    attrChoice: { hint: 'Escolha +2 em um atributo e +1 em outro.' },
    trackers: {
      pendingSpecialChoice: { kind: 'anatomy', count: 1, label: 'Selecionar 1 Característica de Anatomia' },
    },
    abilities: [
      {
        name: 'Vigor Maldito',
        description: 'Ação Bônus: gaste 1 ou mais usos para se curar (Base + MOD CON) × Usos. Base por patamar: Lv1-3 = 5 | Lv4-7 = 10 | Lv8-11 = 15 | Lv12+ = 20. Usos máximos: 1 + tiers Lv4/8/12. Reseta no Descanso Longo.',
      },
      {
        name: 'Herança Maldita',
        description: 'Cura de Energia Reversa vinda de TERCEIROS é reduzida à metade. Você pode gastar 2 PE para se autocurar com Energia Reversa própria sem o redutor.',
      },
    ],
    tags: ['Cura reversa reduzida (terceiros)', 'Anatomia Híbrida', 'Vigor Maldito'],
    healingHalved: true,
    perLevel: [{
      label: 'Slots de Anatomia em Lv 1/5/10/15/20.',
      apply: (lvl, st) => {
        // Slot já é concedido no Nv 1 pelo `pendingSpecialChoice` (tracker base).
        // Aqui adicionamos slots EXTRAS nos níveis 5, 10, 15 e 20.
        if (lvl === 5 || lvl === 10 || lvl === 15 || lvl === 20) {
          return { ...st, extraAnatomyChoices: st.extraAnatomyChoices + 1, notes: [...st.notes, `Nv ${lvl}: +1 slot de Anatomia`] };
        }
        return st;
      },
    }],
  },
  'Sem Técnica': {
    id: 'Sem Técnica',
    shortLabel: 'SEM TÉCNICA',
    description: 'Não possui técnica inata: compensa com Empenho Implacável e, no Nv 4, desperta o Novo Estilo da Sombra.',
    attrChoice: null,
    trackers: {
      availableAttrPoints: 4,
      attrPointsCapPerAttr: 3,
      availableTrainings: 2,
    },
    abilities: [
      {
        name: 'Empenho Implacável',
        description: 'Sem acesso a Feitiços nem à Especialização "Especialista em Técnica". Ganha recompensas obrigatórias por nível: Talentos, Aptidões, Bônus em Perícias e Habilidades de Especialização. Cada recompensa precisa ser RESOLVIDA antes de avançar.',
      },
      {
        name: 'Novo Estilo da Sombra (Nv 4+)',
        description: 'Ao atingir o Nv 4, ganha a técnica amaldiçoada "Novo Estilo da Sombra" e a aptidão "Domínio Simples" (auto-concedida assim que tiver requisitos). Aprende +1 Técnica de Estilo no Nv 4 e +1 a cada Nv 8/12/16/20. Pode trocar a Técnica de Estilo ATIVA no início do turno como Ação Livre, enquanto o Domínio Simples estiver ativo.',
      },
    ],
    tags: ['Sem Feitiços', 'Empenho Implacável', 'Novo Estilo da Sombra'],
    blockSpells: true,
    blockedSpecializations: ['Especialista em Técnica'],
    perLevel: [{
      label: 'Empenho Implacável + Novo Estilo da Sombra.',
      apply: (lvl, st) => {
        let next = st;
        // (a) Recompensa de Empenho Implacável neste nível
        const reward = SEM_TECNICA_REWARDS.find(r => r.level === lvl);
        if (reward) {
          const choice: PendingChoice = {
            id: `semtec-${lvl}`,
            level: lvl,
            kind: reward.kind,
            label: reward.label,
            count: reward.count,
            bonusValue: reward.bonusValue,
          };
          next = {
            ...next,
            pendingChoices: [...next.pendingChoices, choice],
            notes: [...next.notes, `Nv ${lvl} (Empenho Implacável): ${reward.description}`],
          };
        }
        // (b) Novo Estilo da Sombra: ativa no Nv 4 e concede +1 Técnica de Estilo nos marcos
        if (lvl === 4 && !next.hasShadowStyle) {
          next = {
            ...next,
            hasShadowStyle: true,
            tecnicaAmaldicoada: 'Novo Estilo da Sombra',
            aptidaoConcedida: 'Domínio Simples',
            notes: [
              ...next.notes,
              `Nv 4: Novo Estilo da Sombra desperta — Técnica Amaldiçoada e aptidão "Domínio Simples" concedidas.`,
            ],
          };
        }
        if ((SHADOW_STYLE_TECHNIQUE_LEVELS as readonly number[]).includes(lvl)) {
          next = {
            ...next,
            extraStyleTechniques: next.extraStyleTechniques + 1,
            pendingChoices: [
              ...next.pendingChoices,
              {
                id: `style-${lvl}`,
                level: lvl,
                kind: 'style_technique',
                label: 'Selecionar +1 Técnica de Estilo (Novo Estilo da Sombra)',
                count: 1,
              },
            ],
            notes: [...next.notes, `Nv ${lvl}: +1 Técnica de Estilo (Novo Estilo da Sombra).`],
          };
        }
        return next;
      },
    }],
  },
  'Corpo Amaldiçoado Mutante (CAM)': {
    id: 'Corpo Amaldiçoado Mutante (CAM)',
    shortLabel: 'CAM',
    description: 'Três essências amaldiçoadas habitam o mesmo corpo — escolha qual é o Núcleo Primário.',
    attrChoice: null,
    trackers: {
      availableAttrPoints: 2,
      pendingSpecialChoice: { kind: 'core', count: 1, label: 'Selecionar Núcleo Primário (1, 2 ou 3)' },
    },
    abilities: [{
      name: 'Tríade Amaldiçoada',
      description: 'Imunidade a dano DV (venenoso/envenenado). Possui três Núcleos com atributos e feitiços independentes; PV/PE máximos vêm do Núcleo Primário.',
    }],
    tags: ['Imune a DV', 'Sistema de Núcleos'],
    immunitiesNotes: ['DV (venenoso)'],
    enablesCores: true,
  },
};

// ===== Re-export auxiliar para UI =====
export { isEvery };
