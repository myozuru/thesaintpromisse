/**
 * Catálogo de Talentos (Feats).
 *
 * Estrutura espelhada em `specAbilities.ts`. Talentos são escolhidos como
 * alternativa a "Habilidade da Classe" nos trackers `skill_or_talent` e
 * `asi_milestone` (ramo B). Esta Parte 1 entrega APENAS a infraestrutura —
 * os arrays `GENERAL_TALENTS` e `ORIGIN_TALENTS` ficam vazios e serão
 * populados nas Partes 2 e 3.
 */

import type { Character, Origin } from '@/types';
import type { TalentPassiveEffects } from './talentEffects';

export type TalentCategory = 'general' | 'origin';

export type TalentActivation =
  | 'passive'
  | 'reaction'
  | 'bonus'
  | 'action'
  | 'free'
  | 'toggle'
  | 'trigger'
  | 'choice';

/**
 * Escopo de reset para usos de Talentos. Espelha SpecAbilityUsageScope.
 */
export type TalentUsageScope =
  | 'none'
  | 'round'
  | 'scene'
  | 'rest_short'
  | 'rest_long'
  | 'daily';

export interface TalentUsage {
  /**
   * Número fixo, ou expressão dinâmica baseada no personagem:
   *   'training' = bônus de treinamento
   *   'training_half' = floor(treinamento/2)
   *   'des' = Mod. DES (Esquivar)
   *   'pre_half' = floor(Mod. PRE / 2) (Provocação Desafiadora)
   */
  max: number | 'training' | 'training_half' | 'des' | 'pre_half';
  scope: TalentUsageScope;
}

/** Variantes A/B/C/D para talentos com modal permanente. */
export interface TalentVariant {
  key: string;          // 'A' | 'B' | 'C' | 'D' …
  label: string;        // texto exibido
  description: string;
  /** Efeitos passivos exclusivos desta variante (sobrepõem `passiveEffects` quando escolhida). */
  passiveEffects?: TalentPassiveEffects;
}

export interface Talent {
  id: string;
  name: string;
  category: TalentCategory;
  /** [Contexto do Jogador] — texto narrativo exibido em tooltip. */
  flavor: string;
  /** [Lógica de Estado] resumida — texto para o jogador. */
  mechanic: string;
  /** [Gatilho de UI/UX] — quando/como o talento é ativado. */
  triggerText: string;
  /** Lógica técnica em font-mono (fórmulas, IDs, etc.). */
  logicText: string;

  // ===== Pré-requisitos =====
  /** Nível mínimo do personagem. */
  minLevel?: number;
  /** Origem obrigatória. */
  requiredOrigin?: Origin;
  /** Atributo mínimo (todos obrigatórios). */
  requiredAttr?: { name: string; min: number };
  /** Lista de qualquer-um dos atributos satisfaz (FOR 14 OU DES 14). */
  requiredAttrAny?: Array<{ name: string; min: number }>;
  /** Perícias que precisam estar Treinadas. */
  requiredSkillTrained?: string[];
  /** Perícias que precisam estar em Maestria. */
  requiredSkillMastery?: string[];
  /** Pré-requisitos textuais (livre — exibição apenas). */
  requirementsText?: string;
  /** IDs de outros talentos que precisam estar comprados. */
  prerequisites?: string[];

  // ===== Comportamento =====
  /** Pode ser comprado mais de uma vez? */
  repeatable?: boolean;
  /** Tag para limites cruzados (ex.: max 2 talentos da família "adepto"). */
  tag?: string;
  /** Limite de quantos talentos com a tag dada o personagem pode ter. */
  maxOfTag?: { tag: string; max: number };

  activation: TalentActivation;
  peCost?: number;
  /** Limite de usos (e escopo de reset). Omitido = sem limite mecânico. */
  usage?: TalentUsage;

  /**
   * Efeitos passivos numéricos automatizados (HP/PE/iniciativa/atenção/...).
   * O sistema soma estes valores aos derivados na renderização — sem mutar
   * os campos base. Tooltips ⚙ usam o nome do talento como atribuição.
   */
  passiveEffects?: TalentPassiveEffects;

  /**
   * Variantes mutuamente exclusivas. A escolha persistente fica em
   * `chosenTalents[i].choices.variant`. A UI permite trocar a qualquer momento.
   */
  variants?: TalentVariant[];
}

/** Resolve `usage.max` em número concreto para um Talento, usando contexto do char. */
export function resolveTalentUsageMax(
  usage: TalentUsage,
  ctx: { trainingBonus: number; desMod?: number; preMod?: number },
): number {
  if (typeof usage.max === 'number') return Math.max(0, usage.max);
  if (usage.max === 'training') return Math.max(0, ctx.trainingBonus);
  if (usage.max === 'training_half') return Math.max(0, Math.floor(ctx.trainingBonus / 2));
  if (usage.max === 'des') return Math.max(0, ctx.desMod ?? 0);
  if (usage.max === 'pre_half') return Math.max(0, Math.floor((ctx.preMod ?? 0) / 2));
  return 0;
}


// ===== Catálogos (preenchidos nas Partes 2 e 3) =================================

// ===== Bloco 2A — Sem pré-requisitos especiais (20) =====
const BLOCO_2A: Talent[] = [
  {
    id: 'tal-afinidade-tecnica',
    name: 'Afinidade com Técnica',
    category: 'general',
    flavor: 'Você tem uma afinidade superior com a sua técnica, criando novas extensões.',
    mechanic: 'Imediatamente: 1 Tracker para escolher Novo Feitiço grátis. Adicionalmente, gera o mesmo tracker ao atingir Nv 5, 10, 15 e 20.',
    triggerText: 'Tracker de nível extra na compra e em level-ups subsequentes (5/10/15/20).',
    logicText: 'on_buy: pendingSpells += 1; on_level_up(5|10|15|20): pendingSpells += 1',
    activation: 'passive',
  },
  {
    id: 'tal-artesao-amaldicoado',
    name: 'Artesão Amaldiçoado',
    category: 'general',
    flavor: 'A criação de ferramentas amaldiçoadas é seu ofício.',
    mechanic: 'Escolha Ferreiro ou Canalizador: torna-se Treinado. Se já Treinado em ambos, escolhe um para virar Maestria. Libera aba Criação de Itens.',
    triggerText: 'Modal de seleção (Ferreiro|Canalizador) na compra.',
    logicText: 'choices.craft ∈ {ferreiro, canalizador}; if !trained → trained=true; else → mastery=true',
    activation: 'choice',
  },
  {
    id: 'tal-ataque-infalivel',
    name: 'Ataque Infalível',
    category: 'general',
    flavor: 'Você pode repetir a rolagem de dano de um ataque armado/desarmado.',
    mechanic: '1x por rodada, rerola o dano de um ataque (mantém o novo). Níveis de dano das armas não podem sofrer redução por nenhum efeito.',
    triggerText: 'Botão "Rerolar Dano" no histórico de ataques (1/rodada).',
    logicText: 'rerollDamage: 1/round; weapon.damageStep: immune to reduction',
    activation: 'trigger',
  },
  {
    id: 'tal-atencao-infalivel',
    name: 'Atenção Infalível',
    category: 'general',
    flavor: 'Sua atenção nunca falha. Impossível ser surpreendido enquanto consciente.',
    mechanic: 'Atenção +5. Imune à condição [Surpreso] enquanto consciente.',
    triggerText: 'Passiva global.',
    logicText: 'attention += 5; immune(Surpreso) while conscious',
    activation: 'passive',
    passiveEffects: { attention: 5, immuneCondition: 'Surpreso' },
  },
  {
    id: 'tal-dedicacao-recompensadora',
    name: 'Dedicação Recompensadora',
    category: 'general',
    flavor: 'Seu esforço gera melhores espólios e recompensas.',
    mechanic: 'Modifica tabela de loot/dinheiro com base no Grau de feiticeiro. Anotação para a UI de inventário exibir itens extras por Grau.',
    triggerText: 'Modificador de recompensas na tela do Mestre/Inventário.',
    logicText: 'loot_table_modifier(grau)',
    activation: 'passive',
  },
  {
    id: 'tal-favorecido-pela-sorte',
    name: 'Favorecido pela Sorte',
    category: 'general',
    flavor: 'Sorte inexplicável nos momentos críticos.',
    mechanic: 'Tracker (Máx 3, reseta no Descanso Longo). Após QUALQUER rolagem (exceto falha crítica), gastar 1 Sorte para re-rolar e ficar com o MAIOR resultado. Pode repetir enquanto houver pontos. Se inimigo rolar 20 nat contra você, recupera +1 Sorte.',
    triggerText: 'Após ver o resultado de qualquer d20/dado: "Gastar 1 Sorte" para re-rolar (mantém o maior). Auto-recovery em nat20 inimigo.',
    logicText: 'luck.max = 3; post_roll: spend 1 luck → reroll & keep_max (except crit_fail); on_enemy_nat20: luck += 1 (cap 3)',
    activation: 'trigger',
    usage: { max: 3, scope: 'rest_long' },
    passiveEffects: { luckMax: 3 },
  },
  {
    id: 'tal-guarda-infalivel',
    name: 'Guarda Infalível',
    category: 'general',
    flavor: 'Você não baixa a guarda nem nos desastres.',
    mechanic: 'Desastre (Falha Crítica) em ataque não provoca Reação inimiga. +3 em TR contra efeitos que reduzam Defesa ou imponham penalidades em TR.',
    triggerText: 'Passiva em rolagens de ataque e TRs.',
    logicText: 'critFail.attack: no enemy reaction; saveBonus_vs_defense_debuff += 3',
    activation: 'passive',
    passiveEffects: { noEnemyReactionOnCritFail: true, saveBonusVsDefenseDebuff: 3 },
  },
  {
    id: 'tal-incremento-atributo',
    name: 'Incremento de Atributo',
    category: 'general',
    flavor: 'Treino e esforço geram aumento direto de poder físico/mental.',
    mechanic: '+2 no Atributo escolhido. Também aumenta o Limite Máximo do atributo em +2. Pode ser comprado várias vezes (não no mesmo atributo).',
    triggerText: 'Modal: escolha 1 atributo (não pode repetir).',
    logicText: 'choices.attr: attr.value += 2; attr.cap += 2',
    activation: 'choice',
    repeatable: true,
    // NOTA: aplicado mutativamente em useCharacterStore.addTalent (não via passiveEffects)
    // para somar +2 direto em attr.value e +2 em attrCaps[attr] do atributo escolhido.
  },
  {
    id: 'tal-investida-aprimorada',
    name: 'Investida Aprimorada',
    category: 'general',
    flavor: 'Otimização para atropelar oponentes em alta velocidade.',
    mechanic: 'Investida: +3m de movimento, bônus de acerto +Treinamento (em vez de +2). Acerto força Atletismo do alvo vs seu Atletismo: falha = [Caído].',
    triggerText: 'Passiva que modifica a ação Investida.',
    logicText: 'investida.move += 3; hitBonus = +training; on_hit: opposed Atletismo → Caído',
    activation: 'passive',
  },
  {
    id: 'tal-mestre-das-armas',
    name: 'Mestre das Armas',
    category: 'general',
    flavor: 'Desenvolvimento brutal para o manejo de armamentos físicos.',
    mechanic: 'Modal 1: FOR +2 ou DES +2. Modal 2: Treinado em 4 Armas OU acesso ao efeito de Crítico de 1 Grupo de Arma (-1 na margem crítica).',
    triggerText: 'Dois modais de seleção na compra (atributo + grupo crítico).',
    logicText: 'choices.attr ∈ {FOR,DES}; choices.criticalGroup ∈ {Faca,Bastão,Espada,Haste,Machado,Martelo,Chicote,Pugilato,Arco,Besta,Tiro,Dardo}',
    activation: 'choice',
    // attrValueBoost/attrCapBoost são MUTATIVOS (applyTalentAcquisitionMutations);
    // não duplicar via passiveEffects. weaponCriticalGroup é resolvido via choices.criticalGroup
    // no aggregator (default 'Espada' caso o jogador não tenha escolhido).
    passiveEffects: { weaponCriticalGroup: 'Espada' },
  },
  {
    id: 'tal-mestre-defensivo',
    name: 'Mestre Defensivo',
    category: 'general',
    flavor: 'Desenvolvimento das capacidades de defesa e proteção.',
    mechanic: 'Modal: FOR +2 ou CON +2. Concede proficiência em Escudos. Se já proficiente, RD do escudo aumenta em +metade do valor base (ex.: 6 → 9).',
    triggerText: 'Modal de seleção (FOR|CON).',
    logicText: 'choices.attr ∈ {FOR,CON}; shield.proficient=true; if was_prof: shield.rd += floor(base/2)',
    activation: 'choice',
    // FOR/CON +2 são mutativos. shieldProficient permanece como flag agregada.
    passiveEffects: { shieldProficient: true },
  },
  {
    id: 'tal-perceber-oportunidade',
    name: 'Perceber Oportunidade',
    category: 'general',
    flavor: 'Instinto quase como segunda natureza para atacar nas brechas.',
    mechanic: 'Limite de Golpes de Oportunidade por rodada sobe para 2. Todos os AdO rolam com Vantagem.',
    triggerText: 'Passiva de reação.',
    logicText: 'aoo.maxPerRound = 2; aoo.advantage = true',
    activation: 'passive',
    passiveEffects: { opportunityMaxFlat: 1, opportunityAdvantage: true },
  },
  {
    id: 'tal-provocacao-desafiadora',
    name: 'Provocação Desafiadora',
    category: 'general',
    flavor: 'Você força as atenções para si.',
    mechanic: 'Alvo provocado tem desvantagem contra aliados E precisa fazer ≥1 ataque contra você no turno dele. Tracker (Máx = Mod. PRE ÷ 2, arred. p/ baixo) para usar Provocar como Ação Livre.',
    triggerText: 'Passiva na ação Provocar + Tracker de usos.',
    logicText: 'Usos máximos de Provocar = (Mod. PRE ÷ 2, arred. p/ baixo); alvo é forçado a atacar você.',
    activation: 'free',
    usage: { max: 'pre_half', scope: 'rest_long' },
  },
  {
    id: 'tal-resiliencia-melhorada',
    name: 'Resiliência Melhorada',
    category: 'general',
    flavor: 'Refinamento estratégico para resistir a ameaças específicas.',
    mechanic: 'Modal: escolha 1 TR (Astúcia/Fortitude/Reflexos/Vontade). Sobe a proficiência (Treinado, ou Maestria se já Treinado). Atributo base do TR +1.',
    triggerText: 'Modal de seleção de TR.',
    logicText: 'choices.save ∈ {Astúcia,Fortitude,Reflexos,Vontade}; save.train_or_master; baseAttr += 1',
    activation: 'choice',
    // O +1 no atributo e a promoção do TR (perícia homônima) são MUTATIVOS via
    // applyTalentAcquisitionMutations. Sem passiveEffects para evitar duplicação.
  },
  {
    id: 'tal-saltador-constante',
    name: 'Saltador Constante',
    category: 'general',
    flavor: 'Domínio aéreo total. Pulos sucessivos para golpear com precisão.',
    mechanic: 'Pulo terminando em parede/objeto: ativa Ação Livre para pular novamente (metade da distância). Se parar adjacente a inimigo, próximo ataque +2 Acerto e +Mod. FOR Dano.',
    triggerText: 'Passiva que modifica a ação Pular.',
    logicText: 'Pulos podem ser encadeados; ataque encadeado: +2 acerto e +Mod. FOR de dano.',
    activation: 'free',
  },
  {
    id: 'tal-tecnicas-agressivas-escudo',
    name: 'Técnicas Agressivas de Escudo',
    category: 'general',
    flavor: 'Usa a placa defensiva para esmagar oponentes.',
    mechanic: 'Se atacou na rodada: Ação Bônus para Empurrar. Sucesso = Xd6 + Mod. FOR (X = Mod. FOR), empurra +4,5m OU deixa Caído.',
    triggerText: 'Ação Bônus condicional após ataque.',
    logicText: 'Empurrão com escudo (bônus): dano = (Mod. FOR)d6 + Mod. FOR; empurra 4,5 m OU aplica Caído.',
    activation: 'bonus',
  },
  {
    id: 'tal-tecnicas-arremesso',
    name: 'Técnicas de Arremesso',
    category: 'general',
    flavor: 'Domínio no manuseio de projéteis e lanças atiradas.',
    mechanic: 'Armas atiradas/arremesso: +2 Acerto e +3 Dano.',
    triggerText: 'Passiva em armas de arremesso.',
    logicText: 'thrown.hit += 2; thrown.dmg += 3',
    activation: 'passive',
  },
  {
    id: 'tal-tecnicas-reacao-rapida',
    name: 'Técnicas de Reação Rápida',
    category: 'general',
    flavor: 'Instintos para agir sob pressão no exato segundo do perigo.',
    mechanic: 'Iniciativa +5. Se não ficou em primeiro lugar, pode rerolar Iniciativa e ficar com o melhor.',
    triggerText: 'Passiva + botão "Rerolar Iniciativa" se não foi 1º.',
    logicText: 'initiative += 5; reroll if not first (keep best)',
    activation: 'passive',
    passiveEffects: { initiative: 5, initiativeRerollIfNotFirst: true },
  },
  {
    id: 'tal-tecnicas-defensivas-escudo',
    name: 'Técnicas Defensivas de Escudo',
    category: 'general',
    flavor: 'Cobre o corpo perfeitamente, usando o peso a seu favor.',
    mechanic: 'Penalidade de Reflexos do escudo vira Bônus (soma o valor do escudo no TR de Reflexos). Reação (Usos = Bônus de Treinamento por Descanso Longo): baixa a margem do Sucesso Crítico do TR de Reflexos em -3 antes do resultado.',
    triggerText: 'Passiva + Reação opcional.',
    logicText: 'reflex.shieldPenalty → +shield.value; reaction: critMargin -= 3 (uses = trainBonus/long-rest)',
    activation: 'reaction',
    usage: { max: 'training', scope: 'rest_long' },
  },
  {
    id: 'tal-tempestade-ideias',
    name: 'Tempestade de Ideias',
    category: 'general',
    flavor: 'Extração máxima de potencial latente em várias áreas.',
    mechanic: 'Modal triplo: +1 Atributo, 1 Perícia (Treinado), 1 Ferramenta. Selecione 1 perícia Treinada para receber Tracker (Usos = Treinamento/2 por Curto) que rola com Vantagem.',
    triggerText: 'Modal triplo na compra + tracker recorrente.',
    logicText: 'choices.attr += 1; choices.skill: trained=true; choices.tool; advTracker.uses = floor(train/2)/short',
    activation: 'choice',
    usage: { max: 'training_half', scope: 'rest_short' },
  },
];

// ===== Bloco 2B — Com pré-requisitos (20) =====
const BLOCO_2B: Talent[] = [
  {
    id: 'tal-adepto-medicina',
    name: 'Adepto de Medicina',
    category: 'general',
    flavor: 'Você é um curandeiro excepcional, equiparado a um especialista em suporte.',
    mechanic: 'Libera o 2º Efeito de "Suporte em Combate". Cura usa o Nível do Personagem. Quantidade de usos cai pela metade.',
    triggerText: 'Passiva — modifica habilidades de suporte.',
    logicText: 'unlock(suporteEmCombate.effect2); heal = level; uses /= 2',
    activation: 'passive',
    requiredSkillMastery: ['Medicina'],
    tag: 'adepto',
    maxOfTag: { tag: 'adepto', max: 2 },
    passiveEffects: { unlocksSuporteLv2: true },
  },
  {
    id: 'tal-adepto-briga',
    name: 'Adepto de Briga',
    category: 'general',
    flavor: 'Sua briga corpo-a-corpo equivale à de um lutador especialista.',
    mechanic: 'Sem arma (ou arma do grupo Pugilato): +3 Acerto Desarmado e +2 Dano Desarmado. Se errar o dano, tenta Manobra (Derrubar/Empurrar) como Ação Livre com +floor(Treinamento/2).',
    triggerText: 'Passiva + Ação Livre condicional.',
    logicText: 'unarmed.hit += 3; unarmed.dmg += 2; on_miss: free maneuver +floor(train/2)',
    activation: 'passive',
    requiredSkillMastery: ['Atletismo'],
    tag: 'adepto',
    maxOfTag: { tag: 'adepto', max: 2 },
  },
  {
    id: 'tal-adepto-combate',
    name: 'Adepto de Combate',
    category: 'general',
    flavor: 'Estilos de combate refinados ao nível de especialista.',
    mechanic: 'Abre modal da classe Especialista em Combate. Aprende 1 Estilo de Combate. Usa o Nível de Personagem na escala do efeito.',
    triggerText: 'Modal: escolher 1 Estilo de Combate.',
    logicText: 'choices.combatStyle; scale = characterLevel',
    activation: 'choice',
    requiredSkillMastery: ['Intuição'],
    tag: 'adepto',
    maxOfTag: { tag: 'adepto', max: 2 },
  },
  {
    id: 'tal-adepto-feiticaria',
    name: 'Adepto de Feitiçaria',
    category: 'general',
    flavor: 'Domínio quase profissional sobre alterações de fundamento.',
    mechanic: 'Aprende 1 Mudança de Fundamento (exceto Técnica Rápida). Botão (Usos = Bônus de Treinamento por cena) reduz custo dessa Mudança em -1 PE.',
    triggerText: 'Modal de escolha + tracker por cena.',
    logicText: 'choices.fundamento; reduce.peCost = -1; uses = trainBonus/scene',
    activation: 'choice',
    usage: { max: 'training', scope: 'scene' },
    requiredSkillMastery: ['Feitiçaria'],
    requirementsText: 'Possuir Feitiços',
    tag: 'adepto',
    maxOfTag: { tag: 'adepto', max: 2 },
  },
  {
    id: 'tal-alma-inquebravel',
    name: 'Alma Inquebrável',
    category: 'general',
    flavor: 'Sua alma é uma fortaleza contra ataques espirituais.',
    mechanic: 'Torna-se Treinado em Integridade. RD contra dano de Alma = floor(Nível/4).',
    triggerText: 'Passiva.',
    logicText: 'integridade.trained = true; rd_DAL = floor(level/4)',
    activation: 'passive',
    requiredAttr: { name: 'CON', min: 14 },
    passiveEffects: { soulRdLevelDivisor: 4, grantsTrainedSkill: 'Integridade' },
  },
  {
    id: 'tal-apaziguador-tecnica',
    name: 'Apaziguador de Técnica',
    category: 'general',
    flavor: 'Você lê os movimentos do feiticeiro e interrompe a conjuração.',
    mechanic: 'Reação: inimigo adjacente conjurando feitiço (Ação Comum+) sofre AdO. Se acertar, alvo faz TR de Concentração. Falha = -5 Acerto/CD do feitiço, cura/buff /2, ou anula (sem gasto de PE).',
    triggerText: 'Reação automática quando inimigo adjacente conjura.',
    logicText: 'reaction: opportunity attack on cast; on_hit: enemy concentrationTR; fail: spell debuff',
    activation: 'reaction',
    minLevel: 8,
    requiredSkillTrained: ['Astúcia'],
  },
  {
    id: 'tal-aptidao-desenvolvida',
    name: 'Aptidão Desenvolvida',
    category: 'general',
    flavor: 'Refinamento profundo de uma aptidão amaldiçoada específica.',
    mechanic: 'Aumenta o nível de uma Aptidão Amaldiçoada em +1. Pode ser comprado várias vezes (uma por aptidão).',
    triggerText: 'Modal: escolher 1 aptidão para evoluir.',
    logicText: 'choices.aptidao: level += 1',
    activation: 'choice',
    minLevel: 4,
    repeatable: true,
  },
  {
    id: 'tal-determinado-a-viver',
    name: 'Determinado a Viver',
    category: 'general',
    flavor: 'Sua vontade de viver desafia a própria morte.',
    mechanic: '1x por dia, ao invés de cair para Testes de Morte, fica com 1 PV. A partir do 2º teste de morte, rola com Vantagem.',
    triggerText: 'Trigger automático ao chegar a 0 PV (1/dia).',
    logicText: 'on_zero_hp: hp = 1 (1/day); deathSave[2+]: advantage',
    activation: 'trigger',
    usage: { max: 1, scope: 'daily' },
    requiredSkillTrained: ['Vontade'],
    requiredAttr: { name: 'CON', min: 16 },
  },
  {
    id: 'tal-discurso-motivador',
    name: 'Discurso Motivador',
    category: 'general',
    flavor: 'Suas palavras curam feridas invisíveis e fortalecem aliados.',
    mechanic: 'Ação Completa (combate) ou 10 min (fora). PV Temporário a aliados = (Nível × 2) + (Mod. PRE × Bônus de Treinamento ÷ 2, arred. p/ cima). 1 buff por criatura por descanso.',
    triggerText: 'Ação Completa / atividade narrativa.',
    logicText: 'PV Temporário = Nível × 2 + (Mod. PRE × Treinamento ÷ 2, arred. p/ cima); 1 uso por criatura por descanso.',
    activation: 'action',
    usage: { max: 'training', scope: 'rest_long' },
    requiredSkillTrained: ['Persuasão'],
  },
  {
    id: 'tal-especialista-concussao',
    name: 'Especialista em Concussão',
    category: 'general',
    flavor: 'Seu impacto contundente é devastador.',
    mechanic: 'Modal: FOR +1 ou CON +1. Dano de Impacto Corpo-a-Corpo +1 passo (d8→d10). 1x/turno em sucesso, empurra alvo 3m livremente.',
    triggerText: 'Modal + passiva em armas de impacto.',
    logicText: 'choices.attr ∈ {FOR,CON}; impact.melee.step += 1; on_hit: push 3m (1/turn)',
    activation: 'choice',
    minLevel: 8,
  },
  {
    id: 'tal-especialista-cortes',
    name: 'Especialista em Cortes',
    category: 'general',
    flavor: 'Seus cortes mutilam a mobilidade do oponente.',
    mechanic: 'Modal: FOR +1 ou DES +1. Dano Cortante Melee +1 passo. 1x/turno em sucesso, corta deslocamento inimigo em -4,5m até seu próx turno.',
    triggerText: 'Modal + passiva em armas cortantes.',
    logicText: 'choices.attr ∈ {FOR,DES}; cut.melee.step += 1; on_hit: enemy.move -=4.5m (1/turn)',
    activation: 'choice',
    minLevel: 8,
  },
  {
    id: 'tal-especialista-perfuracao',
    name: 'Especialista em Perfuração',
    category: 'general',
    flavor: 'Suas perfurações encontram sempre o ponto fraco.',
    mechanic: 'Modal: FOR +1 ou DES +1. Dano Perfurante Melee +1 passo. 1x/turno em sucesso, rerola dado de dano e fica com o melhor.',
    triggerText: 'Modal + passiva em armas perfurantes.',
    logicText: 'choices.attr ∈ {FOR,DES}; pierce.melee.step += 1; on_hit: reroll dmg keep best (1/turn)',
    activation: 'choice',
    minLevel: 8,
  },
  {
    id: 'tal-mestre-criacao',
    name: 'Mestre da Criação',
    category: 'general',
    flavor: 'Suas mãos são responsáveis por equipamentos lendários.',
    mechanic: 'Cria +2 itens extras ao focar em Criação no Interlúdio. +2 em 2 perícias de ofício à escolha.',
    triggerText: 'Modal de escolha + bônus passivo.',
    logicText: 'interlude.craft += 2; choices.crafts[2]: skill += 2',
    activation: 'choice',
    minLevel: 4,
    requirementsText: 'Treinado em 2 Ofícios',
  },
  {
    id: 'tal-mestre-arremesso',
    name: 'Mestre do Arremesso',
    category: 'general',
    flavor: 'Você é uma artilharia ambulante.',
    mechanic: 'Dano de arremesso +1 dado. Modificador atualizado para +4 Acerto e +6 Dano. Alcance +6m.',
    triggerText: 'Passiva em armas de arremesso (substitui Técnicas de Arremesso).',
    logicText: 'thrown.dice += 1; thrown.hit = +4; thrown.dmg = +6; thrown.range += 6m',
    activation: 'passive',
    minLevel: 8,
    prerequisites: ['tal-tecnicas-arremesso'],
  },
  {
    id: 'tal-mestre-chicotes',
    name: 'Mestre dos Chicotes',
    category: 'general',
    flavor: 'O chicote dança em suas mãos como uma extensão do corpo.',
    mechanic: 'Com chicote: +4 Dano e +1,5m de alcance. 1x/turno, acerto força TR Fortitude inimigo. Falha = puxa alvo 3m em sua direção.',
    triggerText: 'Passiva em chicotes.',
    logicText: 'whip.dmg += 4; whip.range += 1.5m; on_hit: fortTR; fail: pull 3m (1/turn)',
    activation: 'passive',
    minLevel: 5,
  },
  {
    id: 'tal-movimentos-acrobaticos',
    name: 'Movimentos Acrobáticos',
    category: 'general',
    flavor: 'Você se levanta dançando e está sempre um passo à frente.',
    mechanic: 'Se ficar [Caído]: rola Acrobacia vs Atletismo/CD. Sucesso = levanta como Ação Livre, move 3m sem AdO e ganha +(Mod. DES ÷ 2, arred. p/ baixo) na Defesa por 1 rodada.',
    triggerText: 'Trigger ao receber a condição [Caído].',
    logicText: 'Ao ficar Caído: Acrobacia vs CD; sucesso = levanta de graça + 3 m sem AdO + Defesa +(Mod. DES ÷ 2, arred. p/ baixo) por 1 rodada.',
    activation: 'trigger',
    requiredSkillTrained: ['Acrobacia'],
  },
  {
    id: 'tal-robustez-aprimorada',
    name: 'Robustez Aprimorada',
    category: 'general',
    flavor: 'Seu corpo é uma fortaleza de carne.',
    mechanic: 'Imediato e retroativo: PV Máximo += Nível. +2 em Fortitude. 1×/dia, pode rerolar um TR de Fortitude e ficar com o melhor.',
    triggerText: 'Passiva + Reroll 1×/dia.',
    logicText: 'PV Máximo += Nível (retroativo); Fortitude += 2; reroll fortitude (1/day).',
    activation: 'passive',
    requiredAttr: { name: 'CON', min: 14 },
    usage: { max: 1, scope: 'daily' },
    passiveEffects: { hpMaxPerLevel: 1, fortitudeBonus: 2 },
  },
  {
    id: 'tal-empunhadura-dupla',
    name: 'Técnicas de Empunhadura Dupla',
    category: 'general',
    flavor: 'Duas armas, dobro de ameaça.',
    mechanic: 'Empunhando 1 arma em cada mão: Defesa +1. Permite 2 armas não-leves (exceto pesada/duas mãos). Saque duplo conta como 1 ação.',
    triggerText: 'Passiva quando empunhar 2 armas (toggle no AttackPanel).',
    logicText: 'dualWield: defense += 1; allow non-light dual; dualDraw = 1 action',
    activation: 'passive',
    requiredAttrAny: [{ name: 'FOR', min: 14 }, { name: 'DES', min: 14 }],
    passiveEffects: { dualWieldDefenseBonus: 1 },
  },
  {
    id: 'tal-tecnicas-esquiva',
    name: 'Técnicas de Esquiva',
    category: 'general',
    flavor: 'Você desvia como se estivesse um passo à frente do tempo.',
    mechanic: 'Libera Ação Bônus para usar "Esquivar". Usos = Mod. DES por Descanso Longo.',
    triggerText: 'Ação Bônus + tracker de usos.',
    logicText: 'Esquivar (bônus): usos = Mod. DES por Descanso Longo.',
    activation: 'bonus',
    requiredAttr: { name: 'DES', min: 16 },
    usage: { max: 'des', scope: 'rest_long' },
  },
  {
    id: 'tal-tecnicas-mobilidade',
    name: 'Técnicas de Mobilidade',
    category: 'general',
    flavor: 'Suas pernas são raios; ninguém te alcança no campo.',
    mechanic: 'Deslocamento +3m. 1x/rodada, se atacar, rola Reflexos vs Reflexos inimigo. Sucesso = alvo não pode dar AdO contra você naquele turno.',
    triggerText: 'Passiva (deslocamento) + ação 1×/rodada (anular AdO).',
    logicText: 'speed += 3m; on_attack: opposed reflex → no AdO this turn (1/round)',
    activation: 'passive',
    requiredAttr: { name: 'DES', min: 14 },
    usage: { max: 1, scope: 'round' },
    passiveEffects: { movementBonusMeters: 3 },
  },
  {
    id: 'tal-tecnicas-ocultamento',
    name: 'Técnicas de Ocultamento',
    category: 'general',
    flavor: 'Sumir nas sombras é seu segundo idioma.',
    mechanic: 'Furtividade += Bônus de Treinamento. Inimigo [Desprevenido] por você sofre debuffs em TODOS os TRs, não só Reflexos.',
    triggerText: 'Passiva.',
    logicText: 'furtividade += trainBonus; desprevenido.debuff: all saves',
    activation: 'passive',
    requiredSkillTrained: ['Furtividade'],
    passiveEffects: { desprevenidoAffectsAllSaves: true },
  },
  {
    id: 'tal-tecnicas-sentinela',
    name: 'Técnicas do Sentinela',
    category: 'general',
    flavor: 'Você é a muralha entre o inimigo e seus aliados.',
    mechanic: 'Acertar AdO zera a Movimentação inimiga (-4,5m). Se inimigo a 1,5m de você atacar seu aliado, você ganha 1 AdO contra o inimigo como Reação.',
    triggerText: 'Passiva + Reação.',
    logicText: 'aoo.hit: enemy.move = 0 this turn; on_ally_attacked_adjacent: free AdO',
    activation: 'reaction',
    minLevel: 5,
  },
  {
    id: 'tal-wrestling',
    name: 'Wrestling',
    category: 'general',
    flavor: 'Você agarra como um ginasta olímpico de luta.',
    mechanic: 'Substitui rolagens de Fuga inimigas. 1x/rodada, força inimigo a rolar Mod. FOR puro vs Mod. FOR puro. Ao atacar agarrado, pode soltá-lo: Dano = Mod. FOR ÷ 2, alvo [Caído] sem TR. Pode arremessá-lo (3 m × Mod. FOR) causando Dano de Cenário.',
    triggerText: 'Passiva quando há alvo agarrado.',
    logicText: 'Fuga: disputa de Mod. FOR puro; soltar = Mod. FOR ÷ 2 de dano + Caído; arremesso = 3 m × Mod. FOR.',
    activation: 'passive',
    minLevel: 4,
  },
  {
    id: 'tal-voto-malevolente',
    name: 'Voto Malevolente',
    category: 'general',
    flavor: 'Suas promessas amaldiçoadas dobram a realidade.',
    mechanic: 'Modifica mecânica de Narrativa: Votos não exigem maléfico superior ao benefício.',
    triggerText: 'Passiva narrativa.',
    logicText: 'voto.maleficent_constraint = false',
    activation: 'passive',
    minLevel: 12,
  },
];

export const GENERAL_TALENTS: Talent[] = [...BLOCO_2A, ...BLOCO_2B];

export const ORIGIN_TALENTS: Talent[] = [
  {
    id: 'tal-familiaridade-tecnica',
    name: 'Familiaridade com Técnica',
    category: 'origin',
    flavor: 'Sua técnica é tão sua quanto seu próprio nome.',
    mechanic: 'Redução de custo PE da 1ª "Marca Registrada" passa de -1 para -2 (ou reduz manutenção sustentada em 1). Pode escolher novas Marcas Registradas (Quantidade = floor(Treinamento/2)).',
    triggerText: 'Passiva — modifica Marca Registrada existente + libera novas escolhas.',
    logicText: 'marca[0].peReduction = -2 OR sustained.maintenance -= 1; extraMarcas = floor(train/2)',
    activation: 'passive',
    requiredOrigin: 'Inato',
    minLevel: 12,
  },
  {
    id: 'tal-manual-tecnica',
    name: 'Manual de Técnica',
    category: 'origin',
    flavor: 'Você herdou um grimório que descreve técnicas além do seu nível.',
    mechanic: 'Pode criar Feitiços 1 nível acima do limite atual (sem equipar/usar até o sistema liberar). Se já tiver feitiços Nv 5, cooldown da Técnica Máxima -1 rodada.',
    triggerText: 'Passiva — destrava criação 1 tier acima.',
    logicText: 'spell.create.maxLevel += 1; if hasNv5: tecnicaMaxima.cooldown -= 1',
    activation: 'passive',
    requiredOrigin: 'Herdado',
    minLevel: 5,
    requirementsText: 'Treinado em História ou Ocultismo',
  },
  {
    id: 'tal-expansao-reserva',
    name: 'Expansão de Reserva',
    category: 'origin',
    flavor: 'Sua reserva derivada se renova com facilidade impressionante.',
    mechanic: 'Usar "Energia Antinatural" vira Ação Livre. Ao usar, ganha TempPE = floor(Treinamento/2) além do PE recuperado normal. Pode ser usada 1x por Descanso Longo (em vez de "dia").',
    triggerText: 'Modifica habilidade Energia Antinatural.',
    logicText: 'energiaAntinatural.action = free; tempPE += floor(train/2); uses = 1/long-rest',
    activation: 'free',
    usage: { max: 1, scope: 'rest_long' },
    requiredOrigin: 'Derivado',
    minLevel: 8,
  },
  {
    id: 'tal-quebra-limites',
    name: 'Quebra de Limites',
    category: 'origin',
    flavor: 'Seu corpo derivado quebra os limites naturais dos atributos.',
    mechanic: 'Selecione 2 Atributos diferentes (não pode ser o atributo com maior limite atual). +2 valor e +2 no Limite Máximo de cada.',
    triggerText: 'Modal duplo de seleção de atributos.',
    logicText: 'choices.attrs[2]: value += 2; cap += 2 (each); exclude highest-cap attr',
    activation: 'choice',
    requiredOrigin: 'Derivado',
    minLevel: 6,
    // attrValueBoost/attrCapBoost aplicados mutativamente em addTalent (2 atributos).
  },
  {
    id: 'tal-fisico-aperfeicoado',
    name: 'Físico Aperfeiçoado',
    category: 'origin',
    flavor: 'Seu corpo híbrido se otimizou de uma forma específica.',
    mechanic: 'Modal permanente, escolha 1: [A] Movimento +4,5m. [B] +2 Acrobacia ou +2 Atletismo. [C] Distância de Empurrar/Desarmar +3m. [D] Distância global de Salto +50%.',
    triggerText: 'Modal de seleção (A/B/C/D) — pode trocar a qualquer momento.',
    logicText: 'choices.variant ∈ {A,B,C,D}; passiveEffects vêm da variante escolhida.',
    activation: 'choice',
    requiredOrigin: 'Feto Amaldiçoada Híbrido (FAH)',
    minLevel: 6,
    variants: [
      { key: 'A', label: 'Movimento +4,5m',
        description: 'Bônus permanente de deslocamento.',
        passiveEffects: { movementBonusMeters: 4.5 } },
      { key: 'B', label: '+2 Acrobacia ou Atletismo',
        description: 'Bônus passivo em uma das duas perícias (escolha narrativa).' },
      { key: 'C', label: 'Empurrar/Desarmar +3m',
        description: 'Aumenta a distância máxima dessas manobras.' },
      { key: 'D', label: 'Salto +50%',
        description: 'Distância global de salto aumentada em 50%.' },
    ],
    // Default = A (movimento). aggregateTalentBonuses lê choices.variant.
  },
  {
    id: 'tal-reposicao-sanguinea',
    name: 'Reposição Sanguínea',
    category: 'origin',
    flavor: 'Seu sangue híbrido se regenera quando ferido.',
    mechanic: 'Vigor Maldito vira Ação Bônus OU Reação ao tomar Dano. Cura gerada +5. Ativação reativa: 1×/Descanso Longo.',
    triggerText: 'Modifica habilidade Vigor Maldito + uso reativo.',
    logicText: 'vigorMaldito.action ∈ {bonus, reaction_on_damage}; heal += 5; reactiveUse: 1/long.',
    activation: 'reaction',
    requiredOrigin: 'Feto Amaldiçoada Híbrido (FAH)',
    minLevel: 6,
    usage: { max: 1, scope: 'rest_long' },
    passiveEffects: { vigorMalditoHealBonus: 5 },
  },
  {
    id: 'tal-estudo-amaldicoado',
    name: 'Estudo Amaldiçoado',
    category: 'origin',
    flavor: 'Mesmo sem técnica própria, seu estudo eleva suas aptidões.',
    mechanic: 'Aumenta o nível interno de 2 Aptidões Amaldiçoadas diferentes em +1.',
    triggerText: 'Modal duplo de escolha de aptidões.',
    logicText: 'choices.aptidoes[2]: level += 1 (each, distintas)',
    activation: 'choice',
    requiredOrigin: 'Sem Técnica',
    minLevel: 8,
  },
  {
    id: 'tal-nocao-preparacao',
    name: 'Noção e Preparação',
    category: 'origin',
    flavor: 'Sem técnica própria, você aprendeu a se preparar contra as alheias.',
    mechanic: '+2 em TR contra efeitos de "Aptidões Amaldiçoadas" inimigas. Bônus sobe automaticamente para +3 (Nv 8), +4 (Nv 12) e +5 (Nv 16).',
    triggerText: 'Passiva escalonável.',
    logicText: 'save_vs_aptidao_inimiga: +2 / +3 (Nv 8) / +4 (Nv 12) / +5 (Nv 16)',
    activation: 'passive',
    requiredOrigin: 'Sem Técnica',
    minLevel: 4,
  },
];

// ===== Helpers ==================================================================

export function getAllTalents(): Talent[] {
  return [...GENERAL_TALENTS, ...ORIGIN_TALENTS];
}

export function getTalentsByCategory(cat: TalentCategory): Talent[] {
  return cat === 'general' ? GENERAL_TALENTS : ORIGIN_TALENTS;
}

export function getTalentById(id: string): Talent | undefined {
  return getAllTalents().find(t => t.id === id);
}

export interface TalentRequirementResult {
  ok: boolean;
  /** Lista de mensagens explicando cada requisito não atendido. */
  missing: string[];
}

/** Lê valor de um atributo do personagem por nome (case-insensitive). */
function getAttrValue(c: Character, name: string): number {
  const target = name.trim().toUpperCase();
  const a = (c.attributes ?? []).find(x => x.name.trim().toUpperCase() === target);
  return a?.value ?? 0;
}

/** Verifica se uma perícia está treinada. */
function isSkillTrained(c: Character, name: string): boolean {
  const target = name.trim().toLowerCase();
  return (c.skills ?? []).some(s => s.name.trim().toLowerCase() === target && (s.trained || s.mastery));
}

function isSkillMastery(c: Character, name: string): boolean {
  const target = name.trim().toLowerCase();
  return (c.skills ?? []).some(s => s.name.trim().toLowerCase() === target && s.mastery);
}

/**
 * Avalia se o personagem cumpre os pré-requisitos do talento. Não considera
 * limite global de pool — apenas o talento em si.
 */
export function evaluateTalentRequirements(t: Talent, c: Character): TalentRequirementResult {
  const missing: string[] = [];

  // Já possui? (anti-duplicação para não-repeatable)
  const chosen = c.chosenTalents ?? [];
  const alreadyHas = chosen.some(ct => ct.id === t.id);
  if (alreadyHas && !t.repeatable) {
    missing.push('Já adquirido');
  }

  // Nível
  if (t.minLevel != null && c.level < t.minLevel) {
    missing.push(`Requer Nv ${t.minLevel}`);
  }

  // Origem
  if (t.requiredOrigin && c.origin !== t.requiredOrigin) {
    missing.push(`Requer origem ${t.requiredOrigin}`);
  }

  // Atributo único (todos obrigatórios)
  if (t.requiredAttr) {
    const v = getAttrValue(c, t.requiredAttr.name);
    if (v < t.requiredAttr.min) {
      missing.push(`Requer ${t.requiredAttr.name} ${t.requiredAttr.min} (atual ${v})`);
    }
  }

  // Atributo "qualquer um"
  if (t.requiredAttrAny && t.requiredAttrAny.length > 0) {
    const ok = t.requiredAttrAny.some(r => getAttrValue(c, r.name) >= r.min);
    if (!ok) {
      missing.push(
        `Requer ${t.requiredAttrAny.map(r => `${r.name} ${r.min}`).join(' ou ')}`,
      );
    }
  }

  // Perícias treinadas
  for (const s of t.requiredSkillTrained ?? []) {
    if (!isSkillTrained(c, s)) {
      missing.push(`Treinado em ${s}`);
    }
  }

  // Perícias em maestria
  for (const s of t.requiredSkillMastery ?? []) {
    if (!isSkillMastery(c, s)) {
      missing.push(`Mestre em ${s}`);
    }
  }

  // Talentos pré-requisitos
  for (const pid of t.prerequisites ?? []) {
    if (!chosen.some(ct => ct.id === pid)) {
      const dep = getTalentById(pid);
      missing.push(`Requer talento: ${dep?.name ?? pid}`);
    }
  }

  // Limite por tag
  if (t.maxOfTag) {
    const count = chosen.filter(ct => {
      const def = getTalentById(ct.id);
      return def?.tag === t.maxOfTag!.tag;
    }).length;
    if (count >= t.maxOfTag.max) {
      missing.push(`Limite atingido: max ${t.maxOfTag.max} talentos "${t.maxOfTag.tag}"`);
    }
  }

  return { ok: missing.length === 0, missing };
}
