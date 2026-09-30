/**
 * Registry de Habilidades de Especialização (por Specialization).
 *
 * Cada habilidade carrega METADADOS DE ATIVAÇÃO que controlam a UI:
 *  - activation:    tipo de ação (passive | reaction | bonus | action | free | toggle | trigger).
 *  - peCost:        custo em PE (0 se não gasta).
 *  - usage:         limite de usos (escopo: rest_long | rest_short | scene | round | none).
 *  - dice:          notação de dado para rolagem automática (opcional).
 *  - triggerText:   o que faz o efeito disparar (texto técnico).
 *  - logicText:     o que muda no estado (texto técnico).
 *
 * Mantém também `flavor` + `mechanic` (texto narrativo). A ficha exibe ambos.
 *
 * Regras gerais:
 *  - Personagem ganha 1 ponto de `availableSpecAbilities` por nível ao subir.
 *  - Não pode repetir habilidade.
 *  - Lista é mostrada em ordem crescente de tier após escolhida.
 */

import type { Specialization } from '@/types';

export type SpecAbilityTier = 2 | 4 | 6 | 8 | 10 | 12 | 16;
export const SPEC_ABILITY_TIERS: SpecAbilityTier[] = [2, 4, 6, 8, 10, 12, 16];

export type SpecAbilityActivation =
  | 'passive'    // Sempre ativa — sem botão.
  | 'reaction'   // Botão "Reagir".
  | 'bonus'      // Botão "Ação Bônus".
  | 'action'     // Botão "Ação Comum".
  | 'free'       // Botão "Ação Livre".
  | 'toggle'     // Liga/desliga (Brutalidade etc.).
  | 'trigger';   // Disparo automático em certa condição (passivo condicional com gatilho).

export type SpecAbilityUsageScope =
  | 'none'       // Sem limite (só PE).
  | 'round'      // Reseta a cada turno do personagem.
  | 'scene'      // Reseta no fim do combate (somente participantes do combate).
  | 'rest_short' // Reseta no descanso curto.
  | 'rest_long'  // Reseta no descanso longo.
  | 'daily';     // Reseta a cada dia do calendário (Chronos).

/**
 * Curva de "marcos" — declara explicitamente em quais níveis o número de usos
 * sobe. Cada entrada significa "a partir do nível X, o máximo de usos é Y".
 * Usado por habilidades cuja escala é específica (ex.: Abastecido pelo Sangue
 * = 1 no Nv 2, 2 no Nv 8, 3 no Nv 16).
 *
 * O resolver pega a entrada com o maior `level` que ainda seja <= ao nível
 * atual do personagem.
 *
 * `scaling_milestone` é alias semântico de `custom_milestone` para habilidades
 * cuja escala é descrita no briefing como "1× → 2× → 3×" por marco de nível
 * (ex.: Abastecido pelo Sangue). Tratado de forma idêntica pelo resolver.
 */
export interface SpecAbilityMilestoneCurve {
  kind: 'custom_milestone' | 'scaling_milestone';
  milestones: { level: number; max: number }[];
}

export interface SpecAbilityUsage {
  /**
   * Máximo de usos por escopo.
   *  - número fixo
   *  - 'training'   = Bônus de Treinamento
   *  - 'level_half' = ⌊nível ÷ 2⌋
   *  - SpecAbilityMilestoneCurve = curva declarada por marcos de nível
   */
  max: number | 'training' | 'level_half' | SpecAbilityMilestoneCurve;
  scope: SpecAbilityUsageScope;
}

/**
 * Efeitos COLATERAIS DECLARATIVOS aplicados automaticamente quando a
 * habilidade é ativada com sucesso. Permitem evitar hardcoding de IDs no
 * `activateSpecAbility`. Cada efeito é processado pelo motor de combate.
 */
export type SpecAbilityActivateEffect =
  | { type: 'exhaustion'; delta: number }
  | { type: 'temp_pe'; amount: number | 'training_half' | 'training' }
  | { type: 'sacrifice_hp_for_pe'; hpCost: number; peGain: number; cooldownPerHp: number }
  | { type: 'empolgacao_max_penalty'; delta: number }
  | { type: 'set_empolgacao_level'; value: number }
  /**
   * Recupera PE rolando 1 dado escalado por nível e somando o Mod_Chave.
   * Usado por `tec-ate-a-ultima-gota`: dado começa em `baseDieSides`
   * (4) e SOBE 2 faces a cada `stepLevels` níveis (→ d6, d8, d10).
   */
  | { type: 'recover_pe_dice'; baseDieSides: number; stepLevels: number; addKeyMod: boolean };


export interface SpecAbility {
  id: string;
  name: string;
  tier: SpecAbilityTier;
  specialization: Specialization;
  flavor: string;
  mechanic: string;
  /** IDs de outras SpecAbilities que precisam estar escolhidas antes desta. */
  prerequisites?: string[];
  /** Pré-requisito textual livre (ex.: "CON 16"). Apenas exibição. */
  prerequisitesText?: string;
  /** Manobra Finalizadora — só aparece se "Manobras Finalizadoras" foi escolhida. */
  isFinalizer?: boolean;
  /** Pode ser comprada várias vezes (Nova Habilidade, Elevar Aptidão, etc.). */
  allowMultiplePurchases?: boolean;
  /** IDs de Aptidões Amaldiçoadas que o personagem precisa possuir. */
  requiredAptitudes?: string[];
  /** Perícias que precisam estar treinadas (ou em maestria). */
  requiredSkillTrained?: string[];
  /** Perícias que precisam estar em maestria. */
  requiredSkillMastery?: string[];

  // ===== Metadados de ATIVAÇÃO =====
  activation: SpecAbilityActivation;
  /** Custo em PE para ativar (0 = grátis). */
  peCost?: number;
  /**
   * Escala de custo em PE.
   *  - 'per_use_in_round': custo aumenta +1 a cada uso repetido na mesma rodada
   *    (ex.: Determinação Energizada — 1 PE no 1º uso, 2 PE no 2º, 3 PE no 3º…).
   *  - 'variable_input':  jogador escolhe quanto PE gastar dentro de um limite
   *    declarado em `logicText` (ex.: Conhecimento Aplicado — máx ⌊Treinamento ÷ 2⌋,
   *    Sobrecarregar — máx Bônus de Treinamento, Explosão Defensiva — máx Bônus de
   *    Treinamento).
   *  - 'spell_level':     o custo é igual ao nível do feitiço alvo do gatilho
   *    (ex.: Correção paga PE = nível do Feitiço sustentado que ia quebrar).
   *  Motor de combate é responsável por resolver o custo efetivo no momento do uso.
   */
  peCostScaling?: 'per_use_in_round' | 'variable_input' | 'spell_level';
  /** Limite de usos. Omitido = ilimitado (só limita PE). */
  usage?: SpecAbilityUsage;
  /** Dado a rolar quando o botão é clicado (notação tipo "1d8" ou "2d6"). */
  dice?: string;
  /** Texto técnico — gatilho da UI. */
  triggerText: string;
  /** Texto técnico — lógica de estado. */
  logicText: string;
  /**
   * Schema declarativo de "escolha permanente" (modal) que o jogador deve fazer
   * ao adquirir esta habilidade. A escolha fica gravada em
   * `character.specAbilityChoices[abilityId]` e o motor de combate consulta
   * dali no futuro. Enquanto a escolha está pendente, o efeito é considerado
   * "não configurado" pela UI.
   *
   * Cada `kind` corresponde a um tipo de UI no `SpecAbilityChoiceDialog`.
   */
  choiceSchema?: SpecAbilityChoiceSchema;
  /**
   * Discriminador textual que indica QUE TIPO de configuração permanente esta
   * habilidade exige. Usado pela UI para forçar a abertura do modal correto.
   * O `choiceSchema` é a forma estruturada da mesma informação — quando
   * `requiresConfig` está setado, `choiceSchema` DEVE estar presente e
   * compatível (validado em runtime por `validateSpecAbilityCatalog`).
   */
  requiresConfig?:
    | 'weapons'
    | 'skills'
    | 'spell_or_variation'
    | 'save_skill_choice'
    | 'spell_and_ritual_upgrade'
    | 'single_spell_choice'
    | 'spell_level_choice'
    | 'single_release_choice'
    | 'spells'
    | 'weapon_group';
  /**
   * Limite de quantas vezes a habilidade pode ser comprada quando
   * `allowMultiplePurchases` é true. Fórmulas suportadas:
   *  - 'training_bonus': limite igual ao Bônus de Treinamento do personagem.
   * Se ausente e `allowMultiplePurchases` é true, sem teto.
   */
  purchaseLimitFormula?: 'training_bonus';
  /**
   * Pré-requisitos de ESTADO (não habilidades) — perícias treinadas/mestradas
   * e aptidões amaldiçoadas que o personagem precisa possuir. Avaliados em
   * `evaluateSpecAbilityRequirements`. Coexiste com os campos legados
   * `requiredSkillTrained`/`requiredSkillMastery`/`requiredAptitudes` para
   * compatibilidade com as habilidades do Lutador.
   */
  prereqState?: {
    trainedSkills?: string[];
    masterSkills?: string[];
    hasAptitude?: string[];
  };
  /**
   * Efeitos colaterais declarativos disparados automaticamente após a ativação
   * com sucesso desta habilidade. Processados pelo `activateSpecAbility` no
   * store do personagem. Evita hardcodar IDs de habilidades no motor.
   */
  onActivateEffects?: SpecAbilityActivateEffect[];
}

/**
 * Tipos de escolha permanente declarativa.
 *
 * - 'spell-level':   1 nível de feitiço entre `min` e `max` (ex.: Nível Perfeito).
 * - 'spell':         1 feitiço dentre os conhecidos (ex.: Dominância em Feitiço, Feitiço Favorito).
 * - 'skills':        N perícias dentre as Treinadas (ex.: Especialização — N=3).
 * - 'weapons':       N armas (ex.: Técnicas de Combate — N=2).
 * - 'save':          1 TR entre Fortitude/Reflexos/Astúcia/Vontade (ex.: Energia Focalizada).
 * - 'aptitude':      1 entre AU/CL/BAR/DOM/ER (ex.: Epifania Amaldiçoada — apenas registro).
 * - 'condition-set': escolha um conjunto fixo de condições.
 *
 * Cada kind extra que precisarmos é adicionado aqui SEM tocar nas habilidades
 * já cadastradas — o catálogo só declara `choiceSchema`, a UI faz o resto.
 */
export type SpecAbilityChoiceSchema =
  | { kind: 'spell-level'; min: number; max: number; label?: string }
  | { kind: 'spell'; label?: string }
  | { kind: 'skills'; count: number; mustBeTrained?: boolean; onlyTrained?: boolean; label?: string }
  | { kind: 'weapons'; count: number; label?: string }
  | { kind: 'save'; options?: Array<'Fortitude' | 'Reflexos' | 'Astúcia' | 'Vontade'>; label?: string }
  // — Novos kinds (Tier 2-16, briefing oficial). Sem UI dedicada ainda — a
  //   escolha permanece "pendente" até o modal específico ser construído.
  | { kind: 'spell-or-variation'; spellCount: number; variationCount: number; label?: string }
  | { kind: 'save-skill'; options: Array<'Fortitude' | 'Reflexos' | 'Astúcia' | 'Vontade'>; label?: string }
  | { kind: 'spell-and-ritual-upgrade'; label?: string }
  | { kind: 'single-spell'; label?: string }
  | { kind: 'single-release'; label?: string }
  | { kind: 'spells'; countFormula: 'training_bonus' | number; label?: string }
  | { kind: 'weapon-group'; options: string[]; label?: string };

/**
 * Valor concreto de uma escolha realizada. Persistido em
 * `character.specAbilityChoices[abilityId]`.
 */
export type SpecAbilityChoiceValue =
  | { kind: 'spell-level'; level: number }
  | { kind: 'spell'; spellId: string }
  | { kind: 'skills'; skills: string[] }
  | { kind: 'weapons'; weapons: string[] }
  | { kind: 'save'; save: 'Fortitude' | 'Reflexos' | 'Astúcia' | 'Vontade' }
  | { kind: 'spell-or-variation'; spellIds: string[]; variationIds: string[] }
  | { kind: 'save-skill'; save: 'Fortitude' | 'Reflexos' | 'Astúcia' | 'Vontade' }
  | { kind: 'spell-and-ritual-upgrade'; spellId: string; upgradeId: string }
  | { kind: 'single-spell'; spellId: string }
  | { kind: 'single-release'; releaseId: string }
  | { kind: 'spells'; spellIds: string[] }
  | { kind: 'weapon-group'; group: string };

// ===== LUTADOR =============================================================

const LUTADOR: SpecAbility[] = [
  // ============ TIER 2 ============
  {
    id: 'lut-aparar-ataque', name: 'Aparar Ataque', tier: 2, specialization: 'Lutador',
    flavor: 'Rebate golpes corpo-a-corpo no instante exato.',
    mechanic: 'Reação (1 PE). Ao sofrer ataque corpo-a-corpo, role seu ataque contra o atacante; se superar, evita o golpe completamente.',
    activation: 'reaction', peCost: 1,
    triggerText: 'Reação ao sofrer ataque corpo-a-corpo.',
    logicText: 'Rola seu ataque vs. o ataque do inimigo. Se superar, anula o golpe.',
  },
  {
    id: 'lut-aparar-projeteis', name: 'Aparar Projéteis', tier: 2, specialization: 'Lutador',
    flavor: 'Desvia tiros e flechas com reflexo treinado.',
    mechanic: 'Reação (1 PE). Reduz o dano de um projétil em 2d6 + Atributo-Chave + Bônus de Treinamento.',
    activation: 'reaction', peCost: 1, dice: '2d6',
    triggerText: 'Reação ao sofrer dano de projétil.',
    logicText: 'Dano sofrido -= (2d6 + Atributo-Chave + Bônus de Treinamento).',
  },
  {
    id: 'lut-ataque-inconsequente', name: 'Ataque Inconsequente', tier: 2, specialization: 'Lutador',
    flavor: 'Baixa a guarda para meter tudo num único golpe.',
    mechanic: '1×/rodada. Recebe Vantagem no ataque e +5 de dano, mas fica Desprevenido por 1 rodada.',
    activation: 'trigger', peCost: 0,
    usage: { max: 1, scope: 'round' },
    triggerText: 'Checkbox no próximo ataque (1×/rodada).',
    logicText: 'attackRoll = Vantagem; damage += 5; aplica [Desprevenido] no personagem por 1 rodada.',
  },
  {
    id: 'lut-caminho-mao-vazia', name: 'Caminho da Mão Vazia', tier: 2, specialization: 'Lutador',
    flavor: 'Foco total em socos e chutes.',
    mechanic: 'Dano desarmado ganha bônus igual ao Bônus de Treinamento. Recebe metade do Treinamento no acerto desarmado.',
    activation: 'passive',
    triggerText: 'Passiva permanente.',
    logicText: 'unarmedDamage += Treinamento; unarmedHit += (Treinamento ÷ 2, arred. p/ baixo).',
  },
  {
    id: 'lut-complementacao-marcial', name: 'Complementação Marcial', tier: 2, specialization: 'Lutador',
    flavor: 'Manobras viram parte do fluxo natural.',
    mechanic: '+2 para realizar OU resistir a Desarmar, Derrubar ou Empurrar.',
    activation: 'passive',
    triggerText: 'Passiva permanente.',
    logicText: 'maneuverRollBonus += 2 (Desarmar/Derrubar/Empurrar) — ataque e resistência.',
  },
  {
    id: 'lut-deboche-desconcertante', name: 'Deboche Desconcertante', tier: 2, specialization: 'Lutador',
    flavor: 'Provoca o inimigo até desconcentrá-lo.',
    mechanic: 'Ação Bônus. Intimidação +2 vs Vontade. Sucesso: alvo sofre penalidade igual ao seu Treinamento em testes até o próximo turno dele.',
    activation: 'bonus', peCost: 0,
    prerequisitesText: 'Treinado em Intimidação.',
    triggerText: 'Ação Bônus.',
    logicText: 'Intimidação(+2) vs Vontade do alvo. Sucesso: alvo recebe -Treinamento em todos os testes até o próximo turno dele.',
  },
  {
    id: 'lut-dedicacao-arma', name: 'Dedicação em Arma', tier: 2, specialization: 'Lutador',
    flavor: 'Tornou-se um com 3 armas escolhidas.',
    mechanic: 'Escolhe 3 armas (não-Pesadas / não-Duas Mãos). O dado de dano delas aumenta em 1 passo por nível alcançado nesta habilidade.',
    activation: 'passive',
    triggerText: 'Passiva (escolhida 1×).',
    logicText: 'dedicatedWeapons[3].damageDie += 1 step.',
  },
  {
    id: 'lut-esquiva-rapida', name: 'Esquiva Rápida', tier: 2, specialization: 'Lutador',
    flavor: 'Movimento curto, brusco e enganador.',
    mechanic: 'Ação Bônus. Acrobacia vs Atenção do alvo. Sucesso: o alvo recebe penalidade de (Mod. DES / 2) contra você.',
    activation: 'bonus', peCost: 0,
    triggerText: 'Ação Bônus.',
    logicText: 'Acrobacia vs Atenção. Sucesso: alvo recebe -(Mod. DES ÷ 2, arred. p/ baixo) em ataques contra você.',
  },
  {
    id: 'lut-finta-melhorada', name: 'Finta Melhorada', tier: 2, specialization: 'Lutador',
    flavor: 'Enganação com graça.',
    mechanic: 'Pode usar Destreza na perícia Enganação. Acertar um inimigo fintado causa +1 dado de dano.',
    activation: 'passive',
    triggerText: 'Passiva permanente.',
    logicText: 'Enganação pode usar DES. Acerto vs alvo Fintado: damage += 1 dado.',
  },
  {
    id: 'lut-impacto-misto', name: 'Impacto Misto', tier: 2, specialization: 'Lutador',
    flavor: 'Combina arma e corpo num combo só.',
    mechanic: 'Ao acertar um inimigo com arma, ganha +2 no acerto e +2 no dano do PRÓXIMO golpe desarmado. Os bônus escalam nos Nvs 5, 10, 15 e 20.',
    activation: 'trigger',
    triggerText: 'Auto-aplica ao acertar arma marcial. Buff consumido no próximo desarmado.',
    logicText: 'Aplica buff [ImpactoMisto] (+2 acerto / +2 dano) ao próximo golpe desarmado. Escala nos Nvs 5/10/15/20.',
  },
  {
    id: 'lut-kiai-intimidador', name: 'Kiai Intimidador', tier: 2, specialization: 'Lutador',
    flavor: 'Grito de guerra após o acerto certeiro.',
    mechanic: 'Ação Livre ao dar Crítico. Intimidação vs Vontade. Sucesso: alvo fica Abalado (ou Amedrontado se já estava Abalado).',
    activation: 'free', peCost: 0,
    triggerText: 'Ação Livre — só após dar Crítico.',
    logicText: 'Intimidação vs Vontade. Sucesso: aplica [Abalado] (ou [Amedrontado] se já Abalado).',
  },
  {
    id: 'lut-maos-amaldicoadas', name: 'Mãos Amaldiçoadas', tier: 2, specialization: 'Lutador',
    flavor: 'Magia escorre pelos punhos.',
    mechanic: 'Substitui o teste de um Feitiço de Toque por um Ataque Corpo-a-Corpo (somando Força ou Destreza no ataque).',
    activation: 'passive',
    triggerText: 'Modificador permanente em Feitiços de Toque.',
    logicText: 'spellTouch.attackRoll usa maior entre (Mod. FOR, Mod. DES) em vez do teste padrão da magia.',
  },
  {
    id: 'lut-puxar-um-ar', name: 'Puxar um Ar', tier: 2, specialization: 'Lutador',
    flavor: 'Respira fundo no meio da luta para se recompor.',
    mechanic: 'Ação Bônus. Cura PV igual à rolagem do seu dano desarmado. Usos = Bônus de Treinamento por descanso.',
    activation: 'bonus', peCost: 0, dice: '1d8',
    usage: { max: 'training', scope: 'rest_long' },
    triggerText: 'Ação Bônus.',
    logicText: 'heal(rolagem do dano desarmado).',
  },
  {
    id: 'lut-quebrando-tudo', name: 'Quebrando Tudo', tier: 2, specialization: 'Lutador',
    flavor: 'Usa o cenário como arma.',
    mechanic: 'Agarra um objeto adjacente. Armas improvisadas causam +1d de dano e contam como marciais.',
    activation: 'passive',
    triggerText: 'Passiva permanente.',
    logicText: 'improvisedWeapons.damage += 1d; improvisedWeapons.proficiency = marcial.',
  },
  {
    id: 'lut-resistir', name: 'Resistir', tier: 2, specialization: 'Lutador',
    flavor: 'Endurece o corpo na hora do impacto.',
    mechanic: 'Gasta até 2 PE para ganhar +2 a +4 (+2 por PE) em testes de Fortitude ou Reflexos.',
    activation: 'reaction', peCost: 1,
    triggerText: 'Reação ao fazer TR de Fortitude/Reflexos.',
    logicText: 'savingThrowBonus += 2 por PE gasto (até 2 PE = +4).',
  },

  // ============ TIER 4 ============
  {
    id: 'lut-acao-agil', name: 'Ação Ágil', tier: 4, specialization: 'Lutador',
    flavor: 'Otimiza o tempo de combate.',
    mechanic: '2 PE. Ganha uma Ação Ágil (Andar, Desengajar ou Esconder).',
    activation: 'bonus', peCost: 2,
    triggerText: 'Ação Bônus.',
    logicText: 'Concede 1 Ação Ágil extra (Andar / Desengajar / Esconder) neste turno.',
  },
  {
    id: 'lut-acrobata', name: 'Acrobata', tier: 4, specialization: 'Lutador',
    flavor: 'Pulos graciosos, quase aéreos.',
    mechanic: 'Usa Destreza/Acrobacia para calcular E aumentar a distância de saltos.',
    activation: 'passive',
    triggerText: 'Passiva permanente.',
    logicText: 'jumpDistance usa Mod. DES + Acrobacia.',
  },
  {
    id: 'lut-atacar-recuar', name: 'Atacar e Recuar', tier: 4, specialization: 'Lutador',
    flavor: 'Bate e some na mesma cena.',
    mechanic: '1 PE. Ao acertar um ataque, move-se até 4,5m para longe sem provocar ataque de oportunidade.',
    activation: 'trigger', peCost: 1,
    prerequisites: ['lut-esquiva-rapida'],
    triggerText: 'Trigger pós-acerto (botão habilita após acertar).',
    logicText: 'Move até 4,5m sem provocar Ataque de Oportunidade.',
  },
  {
    id: 'lut-brutalidade', name: 'Brutalidade', tier: 4, specialization: 'Lutador',
    flavor: 'Fúria canalizada para destruir.',
    mechanic: 'Ação Livre (2 PE). Entra em Brutalidade: +2 acerto/dano corpo-a-corpo. Quebra e impede concentração/feitiços. Bônus escala gastando mais PE nos Nvs 8, 12, 16, 20.',
    activation: 'toggle', peCost: 2,
    triggerText: 'Toggle (Ação Livre).',
    logicText: 'meleeHit += 2; meleeDamage += 2; bloqueia concentração/feitiços. Escala com PE nos Nvs 8/12/16/20.',
  },
  {
    id: 'lut-defesa-marcial', name: 'Defesa Marcial', tier: 4, specialization: 'Lutador',
    flavor: 'Guarda armada e firme.',
    mechanic: 'Desarmado ou com arma marcial, soma [1 + (Treinamento / 2)] na Defesa.',
    activation: 'passive',
    prerequisites: ['lut-complementacao-marcial'],
    triggerText: 'Passiva condicional (desarmado OU arma marcial).',
    logicText: 'defense += 1 + (Treinamento ÷ 2, arred. p/ baixo) se desarmado/arma marcial.',
  },
  {
    id: 'lut-devolver-projeteis', name: 'Devolver Projéteis', tier: 4, specialization: 'Lutador',
    flavor: 'Manda o tiro de volta para o atirador.',
    mechanic: 'O dado de Aparar Projéteis sobe para 3d10 + Nível de Lutador. Se reduzir o dano a zero, devolve o golpe no atacante como parte da reação.',
    activation: 'passive',
    prerequisites: ['lut-aparar-projeteis'],
    triggerText: 'Modifica permanentemente "Aparar Projéteis".',
    logicText: 'AparaProjeteis.dado = 3d10 + Nivel. Se damageTaken = 0, refletir ataque no atacante.',
  },
  {
    id: 'lut-fluxo', name: 'Fluxo', tier: 4, specialization: 'Lutador',
    flavor: 'Imersão profunda no combate.',
    mechanic: 'Cada Nível de Empolgação concede +1 passivo em acerto e dano (máximo +4).',
    activation: 'passive',
    triggerText: 'Passiva atrelada à Empolgação.',
    logicText: 'attackHit += min(empolgacaoLevel, 4); damage += min(empolgacaoLevel, 4).',
  },
  {
    id: 'lut-furia-vinganca', name: 'Fúria da Vingança', tier: 4, specialization: 'Lutador',
    flavor: 'Vinga aliados que caem.',
    mechanic: 'Se um aliado cair a 0 PV, ganha por 1 rodada contra o agressor: +4 dano, +2 Defesa, +2 em Fortitude/Vontade.',
    activation: 'reaction', peCost: 0,
    triggerText: 'Reação automática quando aliado cai a 0 PV.',
    logicText: 'Aplica buff [Vingança] (1 rodada): +4 dano, +2 DEF, +2 Fort/Von vs o agressor.',
  },
  {
    id: 'lut-imprudencia-motivadora', name: 'Imprudência Motivadora', tier: 4, specialization: 'Lutador',
    flavor: 'Luta com handicap autoimposto.',
    mechanic: 'Entra no combate com restrição autoimposta (ex.: sem visão). Se vencer, recupera PE igual ao Nível, ganha +2 de acerto e reduz a margem de crítico em 1.',
    activation: 'trigger', peCost: 0,
    usage: { max: 1, scope: 'scene' },
    triggerText: 'Disparo no início do combate (modal de handicap).',
    logicText: 'Aplica [FerimentoComplexo]. Vitória: peCurrent += level; attackHit += 2; critMargin -= 1.',
  },
  {
    id: 'lut-musculos-desenvolvidos', name: 'Músculos Desenvolvidos', tier: 4, specialization: 'Lutador',
    flavor: 'Resistência bruta no lugar de agilidade.',
    mechanic: 'Soma Força (em vez de Destreza) na Defesa.',
    activation: 'passive',
    triggerText: 'Passiva permanente.',
    logicText: 'defense = 10 + Mod. FOR + (level ÷ 2, arred. p/ baixo).',
  },
  {
    id: 'lut-redirecionar-forca', name: 'Redirecionar Força', tier: 4, specialization: 'Lutador',
    flavor: 'Muda o alvo do erro alheio.',
    mechanic: 'Reação (2 PE). Se inimigo errar você, joga o ataque dele contra a Defesa de outra criatura adjacente.',
    activation: 'reaction', peCost: 2,
    triggerText: 'Reação ao ser errado por inimigo.',
    logicText: 'Reaplica o ataque do inimigo contra a Defesa de outra criatura adjacente.',
  },
  {
    id: 'lut-segura-pra-mim', name: 'Segura pra Mim', tier: 4, specialization: 'Lutador',
    flavor: 'Escudo humano improvisado.',
    mechanic: '3 PE. Se for atacado enquanto agarra alguém, faz Atletismo vs Atletismo/Acrobacia do alvo agarrado. Sucesso: o agarrado sofre o ataque no seu lugar.',
    activation: 'reaction', peCost: 3,
    triggerText: 'Reação ao ser atacado enquanto agarra alguém.',
    logicText: 'Atletismo vs Atletismo/Acrobacia do alvo. Sucesso: alvo agarrado sofre o ataque.',
  },
  {
    id: 'lut-sobrevivente', name: 'Sobrevivente', tier: 4, specialization: 'Lutador',
    flavor: 'Persistência vital quase sobrenatural.',
    mechanic: 'Se estiver abaixo de 50% do PV, cura 1d6 + Mod. CON no início do turno. Dado escala nos Nvs 8, 12, 16 e 20.',
    activation: 'trigger', dice: '1d6',
    prerequisitesText: 'Constituição 16.',
    triggerText: 'Auto-disparo no início do turno (se HP < 50%).',
    logicText: 'heal(1d6 + Mod. CON). Dado escala nos Nvs 8/12/16/20.',
  },
  {
    id: 'lut-voadora', name: 'Voadora', tier: 4, specialization: 'Lutador',
    flavor: 'Investida aérea devastadora.',
    mechanic: '3 PE. Ao realizar Investida desarmado, causa +1d8 de dano a cada 3m percorridos (limitado pelo Mod. FOR ou DES).',
    activation: 'action', peCost: 3, dice: '1d8',
    triggerText: 'Ação (durante Investida desarmada).',
    logicText: 'damage += 1d8 a cada 3m corridos (limite = maior entre (Mod. FOR, Mod. DES)).',
  },

  // ============ TIER 6 ============
  {
    id: 'lut-aprimoramento-marcial', name: 'Aprimoramento Marcial', tier: 6, specialization: 'Lutador',
    flavor: 'Domina técnicas difíceis com naturalidade.',
    mechanic: 'Soma metade do Bônus de Treinamento na CD da sua Especialização.',
    activation: 'passive',
    triggerText: 'Passiva permanente.',
    logicText: 'classCD += (Treinamento ÷ 2, arred. p/ baixo).',
  },
  {
    id: 'lut-ataque-extra', name: 'Ataque Extra', tier: 6, specialization: 'Lutador',
    flavor: 'Velocidade sobrenatural.',
    mechanic: '2 PE. Ao usar a ação Atacar, ataca duas vezes em vez de uma.',
    activation: 'trigger', peCost: 2,
    triggerText: 'Checkbox no ataque (consome PE).',
    logicText: 'attackAction.attacks = 2.',
  },
  {
    id: 'lut-brutalidade-sanguinaria', name: 'Brutalidade Sanguinária', tier: 6, specialization: 'Lutador',
    flavor: 'Banho de sangue alimenta a fúria.',
    mechanic: 'Em Brutalidade, dar crítico ou matar inimigo aumenta o dano corpo-a-corpo em 1 passo (acumula até o valor do Treinamento).',
    activation: 'passive',
    prerequisites: ['lut-brutalidade'],
    triggerText: 'Passiva condicional (dentro de Brutalidade).',
    logicText: 'On(crit | kill): meleeDamageDie += 1 step (cap = Treinamento).',
  },
  {
    id: 'lut-corpo-calejado', name: 'Corpo Calejado', tier: 6, specialization: 'Lutador',
    flavor: 'Casca grossa de quem apanha desde sempre.',
    mechanic: 'Soma (Mod. CON / 2) na Defesa. Ganha PV extra igual ao Nível de Lutador.',
    activation: 'passive',
    triggerText: 'Passiva permanente.',
    logicText: 'defense += (Mod. CON ÷ 2, arred. p/ baixo); hpMax += level.',
  },
  {
    id: 'lut-eliminar-continuar', name: 'Eliminar e Continuar', tier: 6, specialization: 'Lutador',
    flavor: 'Sede de vitória renova o corpo.',
    mechanic: 'Matar inimigo a 9m concede 2d6 + Nível + Atributo-Chave em PV Temporário. Dado escala nos Nvs 8, 12, 16 e 20.',
    activation: 'trigger', dice: '2d6',
    triggerText: 'Auto-disparo ao matar inimigo a até 9m.',
    logicText: 'PV Temporário += 2d6 + Nível + Atributo-Chave. Dado escala nos Nvs 8/12/16/20.',
  },
  {
    id: 'lut-foguete-sem-re', name: 'Foguete Sem Ré', tier: 6, specialization: 'Lutador',
    flavor: 'Investida destrutiva e irreversível.',
    mechanic: 'Ação Completa (6 PE). Move o dobro do deslocamento. Inimigos no caminho sofrem Reflexos vs [Xd10 + Mod. FOR/DES] de Impacto. Ao terminar o avanço, pode atacar o alvo final adjacente.',
    activation: 'action', peCost: 6, dice: '1d10',
    triggerText: 'Ação Completa.',
    logicText: 'movement *= 2. Inimigos no trajeto: Reflexos vs Xd10 + maior entre (Mod. FOR, Mod. DES) de Impacto. X = Treinamento. Ataque grátis no alvo final.',
  },
  {
    id: 'lut-golpe-mao-aberta', name: 'Golpe da Mão Aberta', tier: 6, specialization: 'Lutador',
    flavor: 'Palma atordoante que confunde os sentidos.',
    mechanic: 'Ação Comum (4 PE). Ataque desarmado. Sucesso: alvo faz Fortitude. Falha: alvo fica Desorientado, Enjoado e Exposto até o próximo turno dele.',
    activation: 'action', peCost: 4,
    triggerText: 'Ação Comum.',
    logicText: 'Ataque desarmado. Sucesso: alvo faz Fortitude. Falha: aplica [Desorientado], [Enjoado], [Exposto] até o próximo turno do alvo.',
  },
  {
    id: 'lut-ignorar-dor', name: 'Ignorar Dor', tier: 6, specialization: 'Lutador',
    flavor: 'A dor não passa de informação descartável.',
    mechanic: 'Recebe Redução de Dano geral igual ao Nível de Empolgação. A redução dobra contra danos físicos.',
    activation: 'passive',
    triggerText: 'Passiva atrelada à Empolgação.',
    logicText: 'rd += empolgacaoLevel; rdFisica += empolgacaoLevel * 2.',
  },
  {
    id: 'lut-manobras-finalizadoras', name: 'Manobras Finalizadoras', tier: 6, specialization: 'Lutador',
    flavor: 'Libera ataques supremos do estilo.',
    mechanic: 'Desbloqueia: Ataque Circular, Golpe Certeiro e Quebra Crânio. Exige Empolgação 5; após o uso, reseta a Empolgação para 1.',
    activation: 'passive',
    triggerText: 'Desbloqueia 3 manobras na lista.',
    logicText: 'unlock(["Ataque Circular","Golpe Certeiro","Quebra Crânio"]).',
  },
  {
    id: 'lut-poder-corporal', name: 'Poder Corporal', tier: 6, specialization: 'Lutador',
    flavor: 'O corpo todo é uma arma mortal.',
    mechanic: 'Dano desarmado sobe 2 níveis. 1×/rodada pode aplicar uma manobra (derrubar/desarmar) junto do dano de um ataque desarmado.',
    activation: 'passive',
    prerequisites: ['lut-caminho-mao-vazia'],
    usage: { max: 1, scope: 'round' },
    triggerText: 'Passiva + checkbox de manobra grátis (1×/rodada).',
    logicText: 'unarmedDamageDie += 2 steps. Permite anexar manobra ao acerto desarmado 1×/rodada.',
  },
  {
    id: 'lut-potencia-superior', name: 'Potência Superior', tier: 6, specialization: 'Lutador',
    flavor: 'Força exagerada em manobras.',
    mechanic: 'Derrubar causa +2d6 + Mod. FOR de Impacto. Empurrar joga o alvo a 4,5m (em vez de 1,5m).',
    activation: 'passive',
    prerequisites: ['lut-complementacao-marcial'],
    dice: '2d6',
    triggerText: 'Modificador permanente de Derrubar/Empurrar.',
    logicText: 'derrubar.damage += 2d6 + Mod. FOR (Impacto); empurrar.distance = 4.5m.',
  },
  {
    id: 'lut-sequencia-inconsequente', name: 'Sequência Inconsequente', tier: 6, specialization: 'Lutador',
    flavor: 'Risco total a cada golpe da rodada.',
    mechanic: 'O bônus de +5 de dano se aplica a TODOS os ataques do turno, não só ao primeiro.',
    activation: 'passive',
    prerequisites: ['lut-ataque-inconsequente'],
    triggerText: 'Modifica "Ataque Inconsequente".',
    logicText: 'AtaqueInconsequente.bonus aplica em todos os ataques do turno.',
  },
  {
    id: 'lut-um-com-arma', name: 'Um com a Arma', tier: 6, specialization: 'Lutador',
    flavor: 'Ignora a resistência inimiga.',
    mechanic: 'Armas Dedicadas superam RD inimiga (usos = metade do Nível). Se desarmado de uma Arma Dedicada, usa Reação para não deixá-la cair.',
    activation: 'trigger',
    prerequisites: ['lut-dedicacao-arma'],
    usage: { max: 'level_half', scope: 'rest_long' },
    triggerText: 'Checkbox no ataque + reação anti-desarme.',
    logicText: 'ignoreRD na Arma Dedicada (usos = (level ÷ 2, arred. p/ baixo)). Reação evita ser desarmado.',
  },

  // ============ TIER 8 ============
  {
    id: 'lut-aptidoes-luta', name: 'Aptidões de Luta', tier: 8, specialization: 'Lutador',
    flavor: 'Foco em energia amaldiçoada.',
    mechanic: 'Aumenta o nível da sua Aptidão Aura ou Controle e Leitura em +1.',
    activation: 'passive',
    triggerText: 'Modal de escolha (Aura ou Controle e Leitura).',
    logicText: 'aptitude.level += 1 (Aura | Controle e Leitura).',
  },
  {
    id: 'lut-ataques-ressoantes', name: 'Ataques Ressoantes', tier: 8, specialization: 'Lutador',
    flavor: 'O impacto reverbera no entorno.',
    mechanic: '2 PE. Ao atacar um alvo, inimigos adjacentes a ele com Defesa menor que o seu ataque sofrem metade do dano.',
    activation: 'trigger', peCost: 2,
    triggerText: 'Trigger pós-ataque (consome PE).',
    logicText: 'Inimigos adjacentes ao alvo com defense < attackRoll: damage = totalDamage / 2.',
  },
  {
    id: 'lut-brutalidade-aprimorada', name: 'Brutalidade Aprimorada', tier: 8, specialization: 'Lutador',
    flavor: 'Fúria resiliente que escala.',
    mechanic: 'Entrar em Brutalidade concede PV Temporário (Nível + Atributo da CD). Bônus inicial de dano sobe para +4.',
    activation: 'passive',
    prerequisites: ['lut-brutalidade'],
    triggerText: 'Modifica o toggle "Brutalidade".',
    logicText: 'On enter Brutalidade: tempHP += level + attrCD. Brutalidade.damageBonus = +4.',
  },
  {
    id: 'lut-feitico-punho', name: 'Feitiço e Punho', tier: 8, specialization: 'Lutador',
    flavor: 'Magia e soco no mesmo movimento.',
    mechanic: '2 PE. Após usar Feitiço de alvo único, faz um ataque corpo-a-corpo gratuito no mesmo alvo.',
    activation: 'free', peCost: 2,
    prerequisites: ['lut-maos-amaldicoadas'],
    triggerText: 'Ação Livre após Feitiço de alvo único.',
    logicText: 'meleeAttack(target = lastSpellTarget).',
  },
  {
    id: 'lut-golpear-brecha', name: 'Golpear Brecha', tier: 8, specialization: 'Lutador',
    flavor: 'Resposta imediata à abertura.',
    mechanic: '2 PE. Se tiver sucesso no Aparar Ataque, faz um contra-ataque como parte da mesma reação.',
    activation: 'reaction', peCost: 2,
    prerequisites: ['lut-aparar-ataque'],
    triggerText: 'Reação encadeada após "Aparar Ataque" bem-sucedido.',
    logicText: 'meleeAttack(attacker) na mesma reação.',
  },
  {
    id: 'lut-oportunista', name: 'Oportunista', tier: 8, specialization: 'Lutador',
    flavor: 'Flanco letal coordenado.',
    mechanic: '2 PE. Se um inimigo apanhar de um aliado flanqueando, você faz um ataque gratuito contra ele.',
    activation: 'reaction', peCost: 2,
    triggerText: 'Reação quando aliado flanqueante acerta inimigo.',
    logicText: 'meleeAttack(target = inimigoFlanqueado).',
  },
  {
    id: 'lut-pancada-desnorteante', name: 'Pancada Desnorteante', tier: 8, specialization: 'Lutador',
    flavor: 'O acerto crítico embaralha o alvo.',
    mechanic: 'Ao dar Acerto Crítico, o alvo sofre desvantagem em um Teste de Resistência à sua escolha até o seu próximo turno.',
    activation: 'trigger',
    triggerText: 'Auto-disparo no Acerto Crítico.',
    logicText: 'Aplica [Desvantagem em 1 TR] no alvo até o próximo turno do Lutador.',
  },
  {
    id: 'lut-punhos-letais', name: 'Punhos Letais', tier: 8, specialization: 'Lutador',
    flavor: 'Socos penetrantes como aço.',
    mechanic: 'Desarmado: reduz a margem de crítico em -1 e ignora RD inimiga em valor igual ao seu Bônus de Treinamento.',
    activation: 'passive',
    prerequisites: ['lut-poder-corporal'],
    triggerText: 'Passiva (apenas desarmado).',
    logicText: 'unarmed.critMargin -= 1; unarmed.ignoreRD += Treinamento.',
  },

  // ============ TIER 10 ============
  {
    id: 'lut-alma-quieta', name: 'Alma Quieta', tier: 10, specialization: 'Lutador',
    flavor: 'A alma está em silêncio absoluto.',
    mechanic: 'Vantagem para resistir a Condenado, Enfeitiçado e Fragilizado.',
    activation: 'passive',
    prerequisitesText: 'Treinado em Fortitude OU Vontade.',
    triggerText: 'Passiva permanente.',
    logicText: 'savingThrow vs [Condenado, Enfeitiçado, Fragilizado] = Vantagem.',
  },
  {
    id: 'lut-corpo-sincronizado', name: 'Corpo Sincronizado', tier: 10, specialization: 'Lutador',
    flavor: 'Equilíbrio inabalável.',
    mechanic: 'Vantagem para resistir a Caído e Exposto.',
    activation: 'passive',
    prerequisitesText: 'Treinado em Fortitude.',
    triggerText: 'Passiva permanente.',
    logicText: 'savingThrow vs [Caído, Exposto] = Vantagem.',
  },
  {
    id: 'lut-empolgar-se', name: 'Empolgar-se', tier: 10, specialization: 'Lutador',
    flavor: 'Explosão de ânimo súbita.',
    mechanic: 'Usos = Bônus de Treinamento. Permite subir 2 Níveis de Empolgação no turno em vez de apenas 1.',
    activation: 'free', peCost: 0,
    usage: { max: 'training', scope: 'rest_long' },
    triggerText: 'Ação Livre (usos limitados).',
    logicText: 'empolgacaoLevel += 2 neste turno (cap 5).',
  },
  {
    id: 'lut-impacto-demolidor', name: 'Impacto Demolidor', tier: 10, specialization: 'Lutador',
    flavor: 'Transforma o alvo em projétil.',
    mechanic: 'Ação Comum. Ataque corpo-a-corpo que empurra o alvo com a distância dobrada. O alvo quebra obstáculos no caminho e sofre dano de fontes externas. Não combina com Ataque Extra.',
    activation: 'action', peCost: 0,
    prerequisites: ['lut-potencia-superior'],
    triggerText: 'Ação Comum (não combina com Ataque Extra).',
    logicText: 'meleeAttack: pushDistance *= 2; quebra obstáculos; dano externo aplicado.',
  },
  {
    id: 'lut-insistencia', name: 'Insistência', tier: 10, specialization: 'Lutador',
    flavor: 'Recusa-se a cair.',
    mechanic: '1×/cena. Ao cair a 0 PV, volta ao Nível de Empolgação 1, não cai, e cura PV igual a uma rolagem do dano desarmado. Empolgação Máxima cai em -1 até o descanso.',
    activation: 'reaction', peCost: 0,
    prerequisites: ['lut-ignorar-dor'],
    usage: { max: 1, scope: 'scene' },
    triggerText: 'Reação fatal (1×/cena) ao cair a 0 PV.',
    logicText: 'hpCurrent = maior entre (1, rolagem do dano desarmado); empolgacaoLevel = 1; empolgacaoMax -= 1 até descanso.',
    onActivateEffects: [
      { type: 'set_empolgacao_level', value: 1 },
      { type: 'empolgacao_max_penalty', delta: 1 },
    ],
  },
  {
    id: 'lut-mente-em-paz', name: 'Mente em Paz', tier: 10, specialization: 'Lutador',
    flavor: 'Clareza total no caos.',
    mechanic: 'Vantagem para resistir a Amedrontado, Atordoado e Confuso.',
    activation: 'passive',
    prerequisitesText: 'Treinado em Astúcia.',
    triggerText: 'Passiva permanente.',
    logicText: 'savingThrow vs [Amedrontado, Atordoado, Confuso] = Vantagem.',
  },

  // ============ TIER 12 ============
  {
    id: 'lut-armas-absolutas', name: 'Armas Absolutas', tier: 12, specialization: 'Lutador',
    flavor: 'Domínio total da arma escolhida.',
    mechanic: '2 PE/rodada. Com Arma Dedicada, ganha +3 Defesa OU +3 Acerto. Se errar, pode rerolar o dado e manter o melhor.',
    activation: 'toggle', peCost: 2,
    prerequisites: ['lut-um-com-arma'],
    triggerText: 'Toggle por rodada (2 PE).',
    logicText: 'Escolha: defense += 3 OU attackHit += 3. On miss: rerolar e manter o melhor.',
  },
  {
    id: 'lut-corpo-arsenal', name: 'Corpo Arsenal', tier: 12, specialization: 'Lutador',
    flavor: 'Cada parte do corpo é uma arma diferente.',
    mechanic: 'Ao dar crítico desarmado, inflige o efeito crítico de armas do tipo Bastão, Haste E Martelo (à sua escolha).',
    activation: 'trigger',
    prerequisites: ['lut-punhos-letais'],
    triggerText: 'Auto-disparo no Crítico desarmado.',
    logicText: 'Aplica efeito crítico de Bastão | Haste | Martelo (escolha).',
  },
  {
    id: 'lut-seja-agua', name: 'Seja Água', tier: 12, specialization: 'Lutador',
    flavor: 'Fluidez perfeita no combate.',
    mechanic: '+3m de Deslocamento. Ignora terreno difícil físico. 1×/rodada evita ser agarrado sem precisar rolar teste.',
    activation: 'passive',
    usage: { max: 1, scope: 'round' },
    triggerText: 'Passiva + reação anti-agarrão (1×/rodada).',
    logicText: 'movement += 3m; ignora terreno difícil físico; nega agarrão automático 1×/rodada.',
  },
  {
    id: 'lut-tempestade-sufocante', name: 'Tempestade Sufocante', tier: 12, specialization: 'Lutador',
    flavor: 'Sequência sufocante de golpes.',
    mechanic: 'Cada acerto consecutivo no mesmo alvo impõe -1 na Defesa e nos TRs dele contra você (acumula até o seu Bônus de Treinamento).',
    activation: 'passive',
    triggerText: 'Passiva acumulativa por acertos consecutivos.',
    logicText: 'On hit consecutivo: alvo recebe -1 DEF e -1 TR vs você (cap = Treinamento).',
  },

  // ============ TIER 16 ============
  {
    id: 'lut-corpo-supremo', name: 'Corpo Supremo', tier: 16, specialization: 'Lutador',
    flavor: 'O corpo alcança o divino.',
    mechanic: '+3m Deslocamento, +4 Defesa. RD (metade do Nível) contra Cortante, Perfurante, Impacto e +1 tipo à escolha. RD de 1/4 do Nível contra os demais.',
    activation: 'passive',
    triggerText: 'Passiva permanente.',
    logicText: 'movement += 3m; defense += 4; rdFisica += (level ÷ 2, arred. p/ baixo); rdOutros += (level ÷ 4, arred. p/ baixo).',
  },
  {
    id: 'lut-duro-na-queda', name: 'Duro na Queda', tier: 16, specialization: 'Lutador',
    flavor: 'Imortal aos olhos do inimigo.',
    mechanic: 'Nas portas da morte, aceita 1 falha automática para fazer um teste de Vontade (CD 15 + 1 a cada 3 PV negativos). Sucesso: levanta com 1 PV e 1 nível de Exaustão.',
    activation: 'reaction', peCost: 0,
    prerequisitesText: 'Treinado em Vontade.',
    triggerText: 'Reação fatal nas portas da morte.',
    logicText: 'Aceita 1 falha. Vontade vs CD 15 + (|hpNegativo| ÷ 3, arred. p/ baixo). Sucesso: hpCurrent = 1; aplica [Exaustão +1].',
  },

  // ============ MANOBRAS FINALIZADORAS ============
  {
    id: 'lut-finalizadora-ataque-circular', name: 'Ataque Circular', tier: 6, specialization: 'Lutador',
    flavor: 'Manobra Finalizadora — golpe giratório que atinge tudo ao redor.',
    mechanic: 'Requer Empolgação 5 (reseta para 1 após o uso). Aumenta o alcance em 3m. Rola 1 ataque contra TODOS os alvos na área. Causa +5 de dano em cada um que for acertado.',
    activation: 'action', peCost: 0,
    prerequisites: ['lut-manobras-finalizadoras'],
    isFinalizer: true,
    triggerText: 'Ação Comum (requer empolgacaoLevel = 5).',
    logicText: 'reach += 3m; 1 ataque vs cada alvo na área; damage += 5; empolgacaoLevel = 1.',
  },
  {
    id: 'lut-finalizadora-golpe-certeiro', name: 'Golpe Certeiro', tier: 6, specialization: 'Lutador',
    flavor: 'Manobra Finalizadora — precisão absoluta.',
    mechanic: 'Requer Empolgação 5 (reseta para 1 após o uso). Declarado antes do ataque: o resultado do d20 é tratado como Resultado Rolado + 10 (ex.: tirou 10, conta como 20).',
    activation: 'free', peCost: 0,
    prerequisites: ['lut-manobras-finalizadoras'],
    isFinalizer: true,
    triggerText: 'Ação Livre antes do ataque (requer empolgacaoLevel = 5).',
    logicText: 'attackRoll.result += 10; empolgacaoLevel = 1.',
  },
  {
    id: 'lut-finalizadora-quebra-cranio', name: 'Quebra Crânio', tier: 6, specialization: 'Lutador',
    flavor: 'Manobra Finalizadora — pancada que apaga a consciência.',
    mechanic: 'Requer Empolgação 5 (reseta para 1 após o uso). Causa +2d10 de dano. O alvo faz um teste de Fortitude (CD + 5) ou fica Atordoado até o seu próximo turno.',
    activation: 'action', peCost: 0, dice: '2d10',
    prerequisites: ['lut-manobras-finalizadoras'],
    isFinalizer: true,
    triggerText: 'Ação Comum (requer empolgacaoLevel = 5).',
    logicText: 'damage += 2d10. Alvo: Fortitude vs (classCD + 5). Falha: [Atordoado] até o próximo turno. empolgacaoLevel = 1.',
  },
];

// ===== ESPECIALISTA EM TÉCNICA ============================================
// Catálogo do Especialista em Técnica.
//
// ⚠ CAMADA DE DADOS — Tier 2 reescrito conforme ditado oficial do designer.
// Os textos abaixo (flavor / mechanic / triggerText / logicText) são a
// FONTE DE VERDADE da habilidade. Hooks vivos (onSpellSaveSuccess, modal de
// TR contra Feitiço, sistema de Descanso com dado de estoque, PE temporário,
// automação de rolagem de dano com "explosão" de dado, modificadores na
// declaração de Feitiço) serão construídos em etapas dedicadas — Motor de
// Combate e Motor de Descanso. Não inventar lógica aqui sem que o motor
// correspondente exista.
const ESPECIALISTA_TECNICA: SpecAbility[] = [
  // ============ TIER 2 ============
  // ⚠ CAMADA DE DADOS — Tier 2 reescrito ESTRITAMENTE conforme o briefing
  // oficial. `mechanic` = Texto para o Jogador (literal). `triggerText` = Uso.
  // `logicText` = Lógica de Estado. Hooks vivos serão implementados em
  // etapas dedicadas — não inventar regras aqui.
  {
    id: 'tec-abastecido-pelo-sangue', name: 'Abastecido pelo Sangue', tier: 2, specialization: 'Especialista em Técnica',
    flavor: 'A energia do inimigo abatido se desfaz no ar — e o Especialista a inala.',
    mechanic: 'O sangue de seus inimigos o abastece. Quando um inimigo morre dentro de 12 metros de você, você pode usar sua Reação para absorver os vestígios de sua energia e recuperar pontos de energia amaldiçoada iguais ao seu modificador de Inteligência ou Sabedoria. Utilizável uma vez por descanso longo (duas vezes no nível 8, três vezes no nível 16).',
    activation: 'reaction', peCost: 0,
    usage: {
      max: { kind: 'scaling_milestone', milestones: [
        { level: 2, max: 1 },
        { level: 8, max: 2 },
        { level: 16, max: 3 },
      ] },
      scope: 'rest_long',
    },
    triggerText: 'Reação (1x/Descanso Longo). Aumenta para 2x no Nv 8, e 3x no Nv 16.',
    logicText: 'onEnemyDeath(range <= 12m): Habilita reação. currentPE += Mod_Chave(INT ou SAB).',
  },
  {
    id: 'tec-conhecimento-aplicado', name: 'Conhecimento Aplicado', tier: 2, specialization: 'Especialista em Técnica',
    flavor: 'O estudo da maldição alheia paga em segurança própria.',
    mechanic: 'Você aplica seus conhecimentos de forma defensiva. Sempre que for realizar um Teste de Resistência contra o efeito de um Feitiço inimigo, você pode gastar pontos de energia amaldiçoada (até um limite igual à metade do seu bônus de treinamento). Para cada ponto de energia gasto, você recebe um bônus de +2 no seu teste de resistência.',
    activation: 'reaction', peCost: 0, peCostScaling: 'variable_input',
    triggerText: 'Reação durante Teste de Resistência contra Feitiço.',
    logicText: 'onSpellSaveRoll: Permite gastar PE (Máximo permitido = Math.floor(Treinamento / 2)). O resultado do TR recebe + (PE_Gasto * 2).',
  },
  {
    id: 'tec-conjuracao-defensiva', name: 'Conjuração Defensiva', tier: 2, specialization: 'Especialista em Técnica',
    flavor: 'A energia que sai da conjuração também volta como casca protetora.',
    mechanic: 'Você mantém parte da energia como revestimento. Ao utilizar um Feitiço, você pode escolher pagar 2 PE adicionais. Se o fizer, até o começo do seu próximo turno, você recebe um bônus na sua Defesa e um valor de Redução de Dano (RD) exatamente iguais ao nível do Feitiço que acabou de utilizar.',
    activation: 'trigger', peCost: 2,
    triggerText: 'Ação complementar à Conjuração. Duração: 1 Rodada.',
    logicText: 'onSpellCast: Se ativado, currentPE -= 2. Aplica buff no jogador até o início do próximo turno: Defense += Nivel_do_Feitico e RD += Nivel_do_Feitico.',
  },
  {
    id: 'tec-economia-de-energia', name: 'Economia de Energia', tier: 2, specialization: 'Especialista em Técnica',
    flavor: 'A energia poupada no descanso vira reserva pronta para o próximo combate.',
    mechanic: 'Enquanto descansa, você armazena energia em uma reserva. Após um descanso curto, a reserva guarda 1d4 pontos. Após um longo, guarda 1d6 (o dado aumenta a cada 5 níveis). Em combate, usando uma Ação Comum, você transfere toda a energia dessa reserva para os seus pontos atuais. Essa reserva não acumula.',
    activation: 'action', peCost: 0,
    triggerText: 'Ação Comum (para resgatar) / Passiva de Descanso (para armazenar).',
    logicText: 'onShortRest: economiaPE = roll(1d4). onLongRest: economiaPE = roll(1d6). (Aumenta um passo de dado a cada 5 níveis do personagem). Usar Ação Comum soma economiaPE ao currentPE e zera a reserva. Não pode acumular e não ultrapassa o limite máximo de PE.',
  },
  {
    id: 'tec-explosao-encadeada', name: 'Explosão Encadeada', tier: 2, specialization: 'Especialista em Técnica',
    flavor: 'A energia se recusa a parar quando bate forte o suficiente.',
    mechanic: 'Um bom desempenho aumenta o poder destrutivo. Sempre que você rolar o valor máximo em qualquer dado de dano originado de um Feitiço, você rola mais um dado igual e adiciona ao dano total. Isso funciona apenas uma vez por dado original (se o dado extra rolar o valor máximo, ele não explode novamente).',
    activation: 'passive',
    triggerText: 'Passiva automática.',
    logicText: 'onSpellDamageRoll: Para cada dado rolado do feitiço, se o resultado for igual ao valor máximo da face daquele dado, adicione mais 1 dado do mesmo tipo ao total de dano. Trava: Este dado extra rolado NÃO pode ativar a habilidade novamente.',
  },
  {
    id: 'tec-finta-amaldicoada', name: 'Finta Amaldiçoada', tier: 2, specialization: 'Especialista em Técnica',
    flavor: 'A finta deixa de ser charme e vira pulso amaldiçoado.',
    mechanic: 'Você engana com falsas conjurações. Você passa a utilizar seu atributo-chave (Inteligência ou Sabedoria) em vez de Presença para realizar a ação Fintar. Os benefícios e efeitos da condição "Desprevenido" aplicados ao alvo servirão especificamente para facilitar a sua próxima conjuração de Feitiço contra ele.',
    activation: 'bonus', peCost: 0,
    triggerText: 'Ação-Bônus: Fintar (rola Atributo-Chave INT/SAB em vez de Presença).',
    logicText: 'Substitui a rolagem de Presença pela rolagem do Atributo-Chave (INT/SAB). Se o alvo receber o debuff [Desprevenido], este debuff não é consumido por ataques normais, mas reserva-se exclusivamente para aplicar os efeitos na sua próxima conjuração de Feitiço.',
  },
  {
    id: 'tec-mente-placida', name: 'Mente Plácida', tier: 2, specialization: 'Especialista em Técnica',
    flavor: 'A mente treinada segura a magia mesmo sob impacto.',
    mechanic: 'Sua mente inabalável dificulta a quebra de concentração. A Classe de Dificuldade (CD) para manter a sua concentração será permanentemente reduzida em um valor igual ao seu modificador de Inteligência ou Sabedoria. Ao rolar o teste, você pode escolher pagar 1 PE para receber +3 de bônus, ou pagar 2 PE para receber +5.',
    activation: 'passive', peCost: 0,
    triggerText: 'Teste de Manter Concentração.',
    logicText: 'onConcentrationCheck: Passiva -> ConcentrationDC -= Mod_Chave(INT ou SAB). Ativa (Opcional) -> Permite gastar 1 PE para injetar +3 no teste, OU 2 PE para injetar +5 no teste.',
  },
  {
    id: 'tec-nova-habilidade', name: 'Nova Habilidade', tier: 2, specialization: 'Especialista em Técnica',
    flavor: 'Mais uma faceta da técnica desperta a cada compra.',
    mechanic: 'Uma nova ideia se transforma em poder inédito. Ao comprar esta habilidade, você recebe imediatamente o direito de adicionar à sua ficha dois novos Feitiços ou três variações de liberação. Esta habilidade pode ser comprada repetidas vezes.',
    activation: 'passive', peCost: 0,
    allowMultiplePurchases: true,
    requiresConfig: 'spell_or_variation',
    choiceSchema: { kind: 'spell-or-variation', spellCount: 2, variationCount: 3, label: '2 Feitiços OU 3 Variações de liberação' },
    triggerText: 'Imediato / Gatilho de Evolução.',
    logicText: 'Força a abertura do Modal de Habilidades ao subir de nível. Injeta crédito para o jogador selecionar gratuitamente: 2 novos Feitiços OU 3 variações de liberação.',
  },
  {
    id: 'tec-perturbacao-amaldicoada', name: 'Perturbação Amaldiçoada', tier: 2, specialization: 'Especialista em Técnica',
    flavor: 'Uma onda densa de energia desestabiliza o alvo.',
    mechanic: 'Você extrai a negatividade e a impõe no inimigo. Como uma Ação Comum e custo de 2 PE, escolha uma criatura a até 9 metros. Ela deve fazer um TR de Vontade. Se falhar, ela sofre um prejuízo em todas as suas rolagens igual ao seu modificador de atributo-chave. Se passar, o prejuízo é reduzido pela metade. O inimigo sofrerá essa penalidade por um número de rolagens igual ao seu bônus de treinamento.',
    activation: 'action', peCost: 2,
    triggerText: 'Ação Comum (Alcance 9m). Duração baseada no Treinamento.',
    logicText: 'Deduz 2 PE. Força alvo a rolar TR Vontade. Se Falha: Aplica debuff no alvo de -Mod_Chave(INT/SAB) em todas as rolagens dele. Se Sucesso: O debuff cai pela metade (arredondado para baixo). A duração da penalidade no inimigo é contada em número de rolagens, sendo exatamente igual ao seu Bônus de Treinamento.',
  },
  {
    id: 'tec-reacao-rapida', name: 'Reação Rápida', tier: 2, specialization: 'Especialista em Técnica',
    flavor: 'A maldição reage antes do conflito começar.',
    mechanic: 'Você sempre reage rápido quando o combate começa. Você soma o seu modificador de Inteligência ou Sabedoria ao seu bônus total de Iniciativa.',
    activation: 'passive',
    triggerText: 'Passiva Absoluta.',
    logicText: 'calculateDerivedStats: InitiativeBonus += Mod_Chave(INT ou SAB).',
  },
  {
    id: 'tec-reforco-amaldicoado', name: 'Reforço Amaldiçoado', tier: 2, specialization: 'Especialista em Técnica',
    flavor: 'A maldição pesa mais sobre quem tenta resistir.',
    mechanic: 'Você reforça suas habilidades ativamente. A CD (Classe de Dificuldade) para os inimigos resistirem a todos os seus Feitiços e Aptidões Amaldiçoadas aumenta permanentemente em +1. Ao alcançar o nível 10, esse aumento passa a ser de +2.',
    activation: 'passive',
    triggerText: 'Passiva Absoluta.',
    logicText: 'calculateDerivedStats: classSpellDC += 1. Se characterLevel >= 10, então classSpellDC += 2 (ao invés de 1). Aplica-se a Feitiços e Aptidões Amaldiçoadas.',
  },
  {
    id: 'tec-sobrecarregar', name: 'Sobrecarregar', tier: 2, specialization: 'Especialista em Técnica',
    flavor: 'Empurra a CD do feitiço além do projeto, queimando energia extra.',
    mechanic: 'Deixe sua técnica quase impossível de resistir. Quando utilizar um Feitiço que exija um teste de resistência do alvo, você pode consumir energia extra (até um máximo igual ao seu Bônus de Treinamento). Para cada 1 PE que você gastar desta forma, a CD do feitiço aumenta em 1.',
    activation: 'trigger', peCost: 0, peCostScaling: 'variable_input',
    triggerText: 'Ao conjurar feitiço que force Teste de Resistência.',
    logicText: 'onSpellCast(requiresTR): Permite gastar PE adicional (Máximo permitido = Bônus de Treinamento). Deduz o PE gasto. spellDC += PE_Gasto.',
  },
  {
    id: 'tec-tecnicas-de-combate', name: 'Técnicas de Combate', tier: 2, specialization: 'Especialista em Técnica',
    flavor: 'A técnica amaldiçoada se prolonga até a empunhadura da arma.',
    mechanic: 'Você se versa no combate marcial de emergência. Escolha duas armas quaisquer: você obtém Maestria com elas. Além disso, você passa a utilizar o seu atributo-chave (Inteligência ou Sabedoria) para calcular as jogadas de ataque e as rolagens de dano ao manejá-las.',
    activation: 'passive',
    requiresConfig: 'weapons',
    choiceSchema: { kind: 'weapons', count: 2, label: 'Escolha 2 armas' },
    triggerText: 'Passiva Absoluta.',
    logicText: 'Ao escolher 2 armas, adiciona a proficiência Mastery a elas. Nos hooks de cálculo de Ataque e Dano EXCLUSIVAMENTE para essas duas armas, o sistema substitui o uso de Força ou Destreza pela Inteligência ou Sabedoria.',
  },
  {
    id: 'tec-zelo-recompensador', name: 'Zelo Recompensador', tier: 2, specialization: 'Especialista em Técnica',
    flavor: 'Resistir à maldição alheia devolve fôlego para a própria.',
    mechanic: 'O zelo te recompensa no perigo. Sempre que você obtiver um sucesso em um teste de resistência focado em evitar o efeito de um Feitiço inimigo, você recebe imediatamente 1 Ponto de Energia Temporário. A partir do nível 14, a recompensa sobe para 2 PE temporários.',
    activation: 'trigger', peCost: 0,
    triggerText: 'Passiva de Reação Automática.',
    logicText: 'onSpellSaveSuccess: O jogador recebe tempPE += 1. Se characterLevel >= 14, então tempPE += 2.',
  },

  // ============ TIER 4 ============
  // ⚠ CAMADA DE DADOS — Tier 4 reescrito conforme ditado oficial do designer.
  // Hooks vivos (modal de TR Astúcia/Vontade, sistema de Exaustão, lastSpellUsedId,
  // sistema de melhorias de Feitiço, sistema de Fundamentos, marcação isPrepared,
  // cooldown por dano-na-cena, debuff de cura, listener de level-up para injetar
  // aptidão extra no Nv 12) entram nas etapas dedicadas.
  {
    id: 'tec-ate-a-ultima-gota', name: 'Até a Última Gota', tier: 4, specialization: 'Especialista em Técnica',
    flavor: 'Quando o tanque seca, a vontade encontra fundo de poço para mais um gole.',
    mechanic: 'Quando estiver com PE abaixo da metade do máximo, recupere 1d4 + Mod_Chave de PE. O dado escala 1 passo a cada 5 níveis. Aplica +1 nível de Exaustão. Usos: 1×/Descanso Longo.',
    activation: 'action', peCost: 0, dice: '1d4',
    usage: { max: 1, scope: 'rest_long' },
    triggerText: 'Botão "Última Gota" — habilitado apenas se currentPE < MaxPE/2. 1×/Descanso Longo.',
    logicText: 'Se currentPE < (MaxPE / 2): currentPE += 1d4 (dado escala a cada 5 nvs) + Mod_Chave. Aplica +1 nível de Exaustão.',
    onActivateEffects: [
      { type: 'recover_pe_dice', baseDieSides: 4, stepLevels: 5, addKeyMod: true },
      { type: 'exhaustion', delta: 1 },
    ],
  },
  {
    id: 'tec-ciclagem-maldita', name: 'Ciclagem Maldita', tier: 4, specialization: 'Especialista em Técnica',
    flavor: 'Variar o repertório mantém a maldição reciclando energia em vez de gastar à toa.',
    mechanic: 'Passiva. Sempre que conjurar um Feitiço diferente do último que conjurou, soma ⌊Treinamento ÷ 2⌋ dados de dano extras.',
    activation: 'passive',
    triggerText: 'Passiva — verificada na declaração de cada Feitiço de dano.',
    logicText: 'Se spell.id !== lastSpellUsedId: damageDice += Math.floor(Treinamento / 2). Atualiza lastSpellUsedId = spell.id.',
  },
  {
    id: 'tec-determinacao-energizada', name: 'Determinação Energizada', tier: 4, specialization: 'Especialista em Técnica',
    flavor: 'A energia se enrijece sob pressão mental, ao preço escalonado de mais foco a cada uso.',
    mechanic: 'Reação. Concede Vantagem em um TR de Astúcia ou Vontade. Custo base = 1 PE; cada uso repetido na mesma rodada custa +1 PE.',
    activation: 'reaction', peCost: 1, peCostScaling: 'per_use_in_round',
    triggerText: 'Modal de Reação ao rolar TR de Astúcia/Vontade. Custo base 1 PE; +1 PE acumulativo por uso na mesma rodada.',
    logicText: 'Concede Vantagem no TR de Astúcia/Vontade. Custo efetivo = 1 + (usosNaRodada). currentPE -= custoEfetivo.',
  },
  {
    id: 'tec-energia-focalizada', name: 'Energia Focalizada', tier: 4, specialization: 'Especialista em Técnica',
    flavor: 'Direciona um eixo da própria resistência para virar especialidade vitalícia.',
    mechanic: 'Passiva absoluta. Escolha 1 TR (Fortitude, Reflexos, Astúcia ou Vontade): ele recebe +⌊Mod_Chave ÷ 2⌋ permanente.',
    activation: 'passive',
    triggerText: 'Modal de escolha permanente ao comprar (Fortitude/Reflexos/Astúcia/Vontade). Passiva absoluta depois.',
    logicText: 'TR_Escolhido.bonus += Math.floor(Mod_Chave / 2).',
    requiresConfig: 'save_skill_choice',
    choiceSchema: { kind: 'save-skill', options: ['Fortitude', 'Reflexos', 'Astúcia', 'Vontade'], label: 'Escolha o TR favorecido' },
  },
  {
    id: 'tec-energia-inacabavel', name: 'Energia Inacabável', tier: 4, specialization: 'Especialista em Técnica',
    flavor: 'O reservatório se expande junto com a maturidade da Técnica.',
    mechanic: 'Passiva absoluta. PE Máximo aumenta em ⌊Nível da Classe ÷ 2⌋.',
    activation: 'passive',
    triggerText: 'Passiva absoluta.',
    logicText: 'MaxPE += Math.floor(NivelDaClasse / 2).',
  },
  {
    id: 'tec-epifania-amaldicoada', name: 'Epifania Amaldiçoada', tier: 4, specialization: 'Especialista em Técnica',
    flavor: 'Um lampejo destrava uma faceta nova da maldição — e promete outra mais à frente.',
    mechanic: 'Passiva absoluta. Ganha imediatamente +1 escolha de Aptidão Amaldiçoada. Ganha +1 escolha adicional automaticamente ao atingir o Nv 12.',
    activation: 'passive',
    triggerText: 'Tracker imediato (1 escolha de Aptidão agora) + listener de level-up para reabrir o tracker no Nv 12.',
    logicText: 'Injeta +1 escolha de Aptidão Amaldiçoada agora. Adiciona listener de level-up para injetar +1 novamente no Nível 12.',
  },
  {
    id: 'tec-explosao-defensiva', name: 'Explosão Defensiva', tier: 4, specialization: 'Especialista em Técnica',
    flavor: 'A própria barreira detona contra quem ousa encostar.',
    mechanic: 'Reação a dano corpo-a-corpo. Gaste até X PE (X ≤ Bônus de Treinamento) para reduzir o dano sofrido em (X × 5) e empurrar o atacante (X × 3) metros.',
    requiredAptitudes: ['apt-cobrir-se'],
    prereqState: { hasAptitude: ['apt-cobrir-se'] },
    prerequisitesText: 'Aptidão Cobrir-se.',
    activation: 'reaction', peCost: 0, peCostScaling: 'variable_input',
    triggerText: 'Modal de Reação ao sofrer dano corpo-a-corpo. Input numérico de PE (Máx = Bônus de Treinamento).',
    logicText: 'incomingDamage -= (PE_gasto * 5). Aplica push no inimigo de (PE_gasto * 3) metros.',
  },
  {
    id: 'tec-feitico-favorito', name: 'Feitiço Favorito', tier: 4, specialization: 'Especialista em Técnica',
    flavor: 'Um feitiço escolhido vira assinatura — uma melhoria já está embutida nele para sempre.',
    mechanic: 'Passiva absoluta. Escolha 1 Feitiço conhecido + 1 Melhoria compatível: aquela Melhoria fica permanentemente aplicada nele, sem consumir slot de melhoria na conjuração.',
    activation: 'passive',
    triggerText: 'Modal de escolha permanente ao comprar (1 Feitiço + 1 Melhoria compatível).',
    logicText: 'Aplica a Melhoria permanentemente ao Feitiço sem gastar slot de melhoria na conjuração.',
    requiresConfig: 'spell_and_ritual_upgrade',
    choiceSchema: { kind: 'spell-and-ritual-upgrade', label: 'Escolha 1 Feitiço + 1 Melhoria compatível' },
  },
  {
    id: 'tec-feiticos-refinados', name: 'Feitiços Refinados', tier: 4, specialization: 'Especialista em Técnica',
    flavor: 'A construção do feitiço pesa mais sobre quem tenta resistir.',
    mechanic: 'Passiva absoluta. CD dos seus Feitiços e Aptidões += ⌊Treinamento ÷ 2⌋.',
    activation: 'passive',
    triggerText: 'Passiva absoluta.',
    logicText: 'classCD_Bonus += Math.floor(Treinamento / 2).',
  },
  {
    id: 'tec-movimentos-imprevisiveis', name: 'Movimentos Imprevisíveis', tier: 4, specialization: 'Especialista em Técnica',
    flavor: 'Mesmo o ataque mais bem mirado escorrega no padrão impossível de ler.',
    mechanic: 'Passiva absoluta. Defesa += min(Mod_Chave, Nível da Classe).',
    activation: 'passive',
    triggerText: 'Passiva absoluta.',
    logicText: 'Defense += Math.min(Mod_Chave, NivelDaClasse).',
  },
  {
    id: 'tec-naturalidade-com-rituais', name: 'Naturalidade com Rituais', tier: 4, specialization: 'Especialista em Técnica',
    flavor: 'A Técnica refina o gesto: o ritual deixa de pedir destreza e passa a pedir compreensão.',
    mechanic: 'Passiva contextual. Em testes de Prestidigitação atrelados a rituais mágicos, use INT no lugar de DES.',
    requiredSkillTrained: ['Prestidigitação'],
    prereqState: { trainedSkills: ['Prestidigitação'] },
    prerequisitesText: 'Treinado em Prestidigitação.',
    activation: 'passive',
    triggerText: 'Passiva contextual — aplicada apenas em testes de Prestidigitação ligados a rituais mágicos.',
    logicText: 'Substitui DES por INT em testes de Prestidigitação atrelados a rituais mágicos.',
  },
  {
    id: 'tec-preparacao-de-tecnicas', name: 'Preparação de Técnicas', tier: 4, specialization: 'Especialista em Técnica',
    flavor: 'Antes do confronto, dois feitiços já estão meio-conjurados na cabeça.',
    mechanic: 'Em cada Descanso Longo, marque 2 Feitiços com a flag isPrepared. Na próxima conjuração de cada um, custoPE = ⌈custoPE ÷ 2⌉ e a flag é removida. Limite de Nível de feitiço preparado: Nv5 = até Magia Nv2; Nv12 = Nv3; Nv16 = Nv4; Nv20 = Nv5.',
    activation: 'passive',
    usage: { max: 2, scope: 'rest_long' },
    triggerText: 'Painel de Descanso Longo: selecionar 2 Feitiços válidos para marcar isPrepared.',
    logicText: 'Marca 2 feitiços válidos com flag isPrepared. No próximo cast: custoPE = Math.ceil(custoPE / 2); remove flag. Limite de nível por marco: Nv5=MagiaNv2, Nv12=Nv3, Nv16=Nv4, Nv20=Nv5.',
  },
  {
    id: 'tec-olhar-preciso', name: 'Olhar Preciso', tier: 4, specialization: 'Especialista em Técnica',
    flavor: 'O olhar amaldiçoado calibra cada conjuração contra o alvo.',
    mechanic: 'Passiva absoluta. Bônus em Ataque Mágico = 2 + ⌊(Nível da Classe − 4) ÷ 4⌋.',
    activation: 'passive',
    triggerText: 'Passiva absoluta.',
    logicText: 'magicAttackBonus = 2 + Math.floor((charLevel - 4) / 4).',
  },
  {
    id: 'tec-sacrificio-pela-energia', name: 'Sacrifício pela Energia', tier: 4, specialization: 'Especialista em Técnica',
    flavor: 'Troca direta: pedaço da carne agora, pulso de poder em seguida.',
    mechanic: 'Ação. currentHP −= 6 → currentPE += 2. Aplica debuff que limita cura recebida. Se o total de HP sacrificado na cena ultrapassar MaxHP/2, ganha +1 nível de Exaustão. Cooldown = ⌈HP_sacrificado / 5⌉ rodadas.',
    activation: 'action', peCost: 0,
    triggerText: 'Botão "Sacrificar pela Energia" — Ação. Cooldown = ⌈HP_sacrificado / 5⌉ rodadas.',
    logicText: 'currentHP -= 6 → currentPE += 2. Aplica debuff limitador na cura recebida. Se totalSacrificadoNaCena > MaxHP / 2: +1 Exaustão. cooldown = ceil(6 / 5) = 2 rodadas.',
    onActivateEffects: [{ type: 'sacrifice_hp_for_pe', hpCost: 6, peGain: 2, cooldownPerHp: 5 }],
  },
  {
    id: 'tec-versatilidade-em-fundamentos', name: 'Versatilidade em Fundamentos', tier: 4, specialization: 'Especialista em Técnica',
    flavor: 'Os fundamentos viram peças móveis — trocam-se entre descansos.',
    mechanic: 'Em descanso, abre modal para trocar Mudanças de Fundamentos. Limite por Descanso Curto = ⌊Treinamento ÷ 2⌋. Limite por Descanso Longo = Treinamento inteiro.',
    activation: 'passive',
    triggerText: 'Painel de Descanso (Curto OU Longo): abre modal de troca de Mudanças de Fundamentos.',
    logicText: 'Abre modal para trocar Mudanças de Fundamentos. Limite Curto = Math.floor(Treinamento / 2). Limite Longo = Treinamento inteiro.',
  },

  // ============ TIER 6 ============
  {
    id: 'tec-bastiao-interior', name: 'Bastião Interior', tier: 6, specialization: 'Especialista em Técnica',
    flavor: 'O foco é tão profundo que o caos do mundo bate na muralha e desliza.',
    mechanic: 'Passiva absoluta. Concede Vantagem automática em todo TR para resistir às condições [Amedrontado], [Desorientado] e [Enfeitiçado].',
    requiredSkillTrained: ['Vontade'],
    prereqState: { trainedSkills: ['Vontade'] },
    activation: 'passive',
    triggerText: 'Passiva — aplicada automaticamente em qualquer TR contra [Amedrontado] / [Desorientado] / [Enfeitiçado].',
    logicText: 'savingThrow vs ([Amedrontado] | [Desorientado] | [Enfeitiçado]) -> Vantagem.',
  },
  {
    id: 'tec-combate-amaldicoado', name: 'Combate Amaldiçoado', tier: 6, specialization: 'Especialista em Técnica',
    flavor: 'A maldição encaixa-se nas armas escolhidas como se sempre tivesse pertencido a elas.',
    mechanic: 'Passiva: ataques com as armas de Técnicas de Combate causam dano adicional igual ao Bônus de Treinamento. Ação Livre (2 PE): durante todo o combate, o dado de dano dessas armas sobe +1 passo.',
    prerequisites: ['tec-tecnicas-de-combate'],
    activation: 'free', peCost: 2,
    triggerText: 'Passiva: dano extra automático nas armas escolhidas. Botão "Combate Amaldiçoado [2 PE]" — Ação Livre, eleva o passo do dado durante todo o combate.',
    logicText: 'Passiva: attack(armaEscolhida).damage += BonusTreinamento. Ativa: currentPE -= 2; armaEscolhida.damageDie += 1 step até o fim da cena.',
  },
  {
    id: 'tec-correcao', name: 'Correção', tier: 6, specialization: 'Especialista em Técnica',
    flavor: 'A energia recosta o feitiço de volta ao trilho antes que ele se desfaça.',
    mechanic: 'Reação (1×/rodada). Ao quebrar Concentração, pague PE igual ao nível do Feitiço para ignorar a quebra.',
    activation: 'reaction', peCost: 0,
    usage: { max: 1, scope: 'round' },
    triggerText: 'Hook onConcentrationBreak: oferece reação para pagar PE = nível do Feitiço e manter a concentração.',
    logicText: 'currentPE -= spell.level; cancela o evento de quebra de Concentração.',
  },
  {
    id: 'tec-dominancia-em-feitico', name: 'Dominância em Feitiço', tier: 6, specialization: 'Especialista em Técnica',
    flavor: 'Um feitiço se dobra à vontade do Especialista até custar quase nada.',
    mechanic: 'Passiva absoluta. Escolha 1 Feitiço conhecido: o custo em PE para conjurá-lo é reduzido permanentemente em ⌈Nível_do_Feitiço ÷ 2⌉.',
    activation: 'passive',
    triggerText: 'Modal de escolha permanente ao comprar (1 Feitiço conhecido). Passiva absoluta depois.',
    logicText: 'feiticoEscolhido.peCost -= Math.ceil(feiticoEscolhido.level / 2). Mínimo de 0.',
    requiresConfig: 'single_spell_choice',
    choiceSchema: { kind: 'single-spell', label: 'Feitiço dominado' },
  },
  {
    id: 'tec-elevar-aptidao', name: 'Elevar Aptidão', tier: 6, specialization: 'Especialista em Técnica',
    flavor: 'A maldição amadurece — uma faceta dela ganha um degrau.',
    mechanic: 'Gatilho de loja. Pode ser comprada várias vezes (limite máximo de compras = Bônus de Treinamento). Cada compra injeta +1 ponto no tracker de Aptidões Amaldiçoadas para distribuir entre AU/CL/BAR/DOM/ER.',
    activation: 'trigger',
    allowMultiplePurchases: true,
    purchaseLimitFormula: 'training_bonus',
    triggerText: 'Compra: injeta +1 em pendingAptitudePoints (jogador distribui em AU/CL/BAR/DOM/ER). Limite total de compras = Bônus de Treinamento.',
    logicText: 'character.pendingAptitudePoints += 1.',
  },
  {
    id: 'tec-especializacao', name: 'Especialização', tier: 6, specialization: 'Especialista em Técnica',
    flavor: 'O foco implacável do Especialista lapida três perícias até virarem extensão da maldição.',
    mechanic: 'Passiva absoluta. Escolha 3 perícias em que já tenha Treinamento: elas passam para Maestria.',
    activation: 'passive',
    triggerText: 'Modal de escolha permanente ao comprar (3 perícias Treinadas).',
    logicText: 'foreach perícia escolhida: skill.tier = "mastery".',
    requiresConfig: 'skills',
    choiceSchema: { kind: 'skills', count: 3, onlyTrained: true, mustBeTrained: true, label: 'Escolha 3 perícias Treinadas' },
  },
  {
    id: 'tec-incapaz-de-falhar', name: 'Incapaz de Falhar', tier: 6, specialization: 'Especialista em Técnica',
    flavor: 'A maldição teima em vencer — a aptidão se recusa a errar.',
    mechanic: 'Reação (2 PE). Ao rolar uso de Aptidão Amaldiçoada (exceto Aptidões de Domínio), some Mod_Chave no resultado. Limite: 1×/rodada por aptidão específica.',
    activation: 'reaction', peCost: 2,
    usage: { max: 1, scope: 'round' },
    triggerText: 'Hook onAptitudeRoll (exceto Aptidões de Domínio): modal de reação para gastar 2 PE e somar Mod_Chave. Travado em 1×/rodada por aptidão específica.',
    logicText: 'currentPE -= 2; aptitudeRoll.result += Mod_Chave.',
  },
  {
    id: 'tec-mente-repartida', name: 'Mente Repartida', tier: 6, specialization: 'Especialista em Técnica',
    flavor: 'A consciência se divide em dois fios — duas correntes de feitiço sustentadas em paralelo.',
    mechanic: 'Passiva absoluta. Permite manter Concentração em até 2 feitiços/fontes simultaneamente.',
    activation: 'passive',
    triggerText: 'Passiva permanente.',
    logicText: 'character.maxConcentrationSlots = 2.',
  },
  {
    id: 'tec-nivel-perfeito', name: 'Nível Perfeito', tier: 6, specialization: 'Especialista em Técnica',
    flavor: 'Um nível inteiro de feitiços ganha um peso a mais — todos golpeiam um pouco mais fundo.',
    mechanic: 'Passiva absoluta. Escolha 1 nível de Feitiço (1-5): a CD de resistência de TODOS os feitiços daquele nível aumenta em +2. NÃO altera margem de crítico.',
    activation: 'passive',
    choiceSchema: { kind: 'spell-level', min: 1, max: 5, label: 'Nível de Feitiço impactado' },
    triggerText: 'Modal de escolha permanente ao comprar (1 nível de Feitiço entre 1 e 5).',
    logicText: 'foreach spell where spell.level == nivelEscolhido: spell.saveDC += 2.',
  },
  {
    id: 'tec-passo-rapido', name: 'Passo Rápido', tier: 6, specialization: 'Especialista em Técnica',
    flavor: 'O instinto se dispara antes do inimigo travar a guarda.',
    mechanic: 'Reação. Quando um inimigo entra no seu alcance corpo-a-corpo, mova-se até (Deslocamento ÷ 2) sem provocar Ataque de Oportunidade.',
    activation: 'reaction', peCost: 0,
    triggerText: 'Hook onEnemyEnterMeleeRange: botão de reação "Passo Rápido" para mover (Deslocamento / 2) sem provocar AoO.',
    logicText: 'movement(distância <= Math.floor(speed / 2)) ignora Ataques de Oportunidade.',
  },
  {
    id: 'tec-potencia-concentrada', name: 'Potência Concentrada', tier: 6, specialization: 'Especialista em Técnica',
    flavor: 'O Especialista para de andar para empilhar dano puro num único feitiço.',
    mechanic: 'Ação de Movimento (1×/rodada). Consome a Ação de Movimento para buffar o próximo Feitiço de Dano de alvo único: +5 × Nível_do_Feitiço de dano.',
    activation: 'action', peCost: 0,
    usage: { max: 1, scope: 'round' },
    triggerText: 'Botão "Potência Concentrada" — consome a Ação de Movimento. Aplica buff no próximo Feitiço de dano de alvo único.',
    logicText: 'consome moveAction; nextSingleTargetDamageSpell.bonusDamage += 5 * spell.level.',
  },
  {
    id: 'tec-ritualista', name: 'Ritualista', tier: 6, specialization: 'Especialista em Técnica',
    flavor: 'O ritual deixa de ser repetição e vira variação controlada.',
    mechanic: 'Passiva: +2 em testes de Conjuração em Ritual. Opcional (limite ⌊Treinamento ÷ 2⌋ por ritual): adiciona 1 melhoria de ritual sem pagar o custo extra dela.',
    activation: 'passive',
    usage: { max: 'level_half', scope: 'rest_long' },
    triggerText: 'Passiva: bônus automático em testes de ritual. Toggle opcional na declaração do ritual: insere 1 melhoria adicional sem custo extra (limite ⌊Treinamento / 2⌋).',
    logicText: 'Passiva: ritualConjurationRoll += 2. Opcional: ritual.extraImprovements += 1 sem cobrar custo de melhoria, contando 1 uso do limite.',
  },


  // ============ TIER 8 ============
  {
    id: 'tec-expansao-dos-fundamentos', name: 'Expansão dos Fundamentos', tier: 8, specialization: 'Especialista em Técnica',
    flavor: 'Os pilares da técnica se expandem — a base ganha novas faces.',
    mechanic: 'Compre 1 Aptidão Amaldiçoada Avançada adicional. Pode ser comprada várias vezes.',
    activation: 'passive',
    allowMultiplePurchases: true,
    triggerText: 'Compra: abre seleção de Aptidão Avançada.',
    logicText: 'character.chosenAptitudes.push(novaAptidaoAvancada).',
  },
  {
    id: 'tec-fisico-amaldicoado-defensivo', name: 'Físico Amaldiçoado Defensivo', tier: 8, specialization: 'Especialista em Técnica',
    flavor: 'A maldição que protege se aprofunda — mais energia cabe na barreira.',
    mechanic: 'Passiva absoluta. A quantidade máxima de PEs gastáveis com a aptidão Cobrir-se aumenta em +2. Caso possua Cobertura Avançada, aumenta em +1 adicional (total +3).',
    requiredAptitudes: ['apt-cobrir-se'],
    prereqState: { hasAptitude: ['apt-cobrir-se'] },
    prerequisitesText: 'Aptidão Cobrir-se.',
    activation: 'passive',
    triggerText: 'Passiva permanente.',
    logicText: 'cobrirSe.maxPEPerUse += 2. Se possui Cobertura Avançada: cobrirSe.maxPEPerUse += 1 adicional.',
  },
  {
    id: 'tec-imbuir-com-tecnica', name: 'Imbuir com Técnica', tier: 8, specialization: 'Especialista em Técnica',
    flavor: 'A arma recebe a marca da própria maldição — corte e feitiço fundidos.',
    mechanic: 'Quando for utilizar um Feitiço de dano (que não seja de tipo especial nem de área), e cujo custo de tempo seja Ação Comum ou inferior, você pode, como uma Ação Bônus, gastar 2 PE adicionais para imbuí-lo em uma arma com a qual seja treinado e esteja manejando. Se acertar o ataque, além de causar o dano normal, você causa também o efeito do Feitiço como após-ataque. Se o Feitiço exigia TR, o efeito é aplicado diretamente — exceto Condições, que continuam exigindo TR.',
    prerequisites: ['tec-combate-amaldicoado'],
    prerequisitesText: 'Combate Amaldiçoado.',
    activation: 'bonus', peCost: 2,
    triggerText: 'Ação Bônus (+2 PE) ao conjurar Feitiço de dano (não-área, não-especial, custo ≤ Ação Comum) com arma treinada empunhada.',
    logicText: 'currentPE -= 2 (extra). nextWeaponAttack.imbuedSpell = spell. onHit: aplica weaponDamage + spellEffect (efeito direto se TR; TR mantido apenas para Condições).',
  },
  {
    id: 'tec-liberacoes-expandidas', name: 'Liberações Expandidas', tier: 8, specialization: 'Especialista em Técnica',
    flavor: 'O Especialista expande seu repertório de liberações máximas.',
    mechanic: 'Ao obter esta habilidade, você recebe uma Liberação Máxima adicional. Nos níveis 12 e 16, você recebe mais uma Liberação Máxima adicional (total possível: 3).',
    activation: 'passive',
    triggerText: 'Tracker imediato (1 Liberação Máxima agora) + listener de level-up para reabrir o tracker nos Nv 12 e Nv 16.',
    logicText: 'character.maxReleaseSlots += 1. Listener: nos níveis 12 e 16, character.maxReleaseSlots += 1 cada.',
    requiresConfig: 'single_release_choice',
    choiceSchema: { kind: 'single-release', label: 'Liberação Máxima escolhida' },
  },
  {
    id: 'tec-mira-aperfeicoada', name: 'Mira Aperfeiçoada', tier: 8, specialization: 'Especialista em Técnica',
    flavor: 'O olhar afiado vê a brecha antes mesmo dela existir — e a mira se prepara para nela acertar.',
    mechanic: 'Você pode utilizar a ação Mirar para jogadas de ataque amaldiçoado (Feitiços e Aptidões). Adicionalmente, você recebe a Mudança de Fundamento "Técnica Precisa". Caso já a possua, o bônus conferido por ela aumenta em +1.',
    prerequisites: ['tec-olhar-preciso'],
    prerequisitesText: 'Olhar Preciso.',
    activation: 'passive',
    triggerText: 'Passiva permanente: Mirar passa a valer para ataques amaldiçoados; ganha (ou amplifica) Técnica Precisa.',
    logicText: 'allowAimActionForCursedAttacks = true. Se !hasFundamento(\'tecnica-precisa\'): grants \'tecnica-precisa\'. Else: tecnicaPrecisa.bonus += 1.',
  },
  {
    id: 'tec-primeiro-disparo', name: 'Primeiro Disparo', tier: 8, specialization: 'Especialista em Técnica',
    flavor: 'Quando o combate começa, ele já agiu — antes mesmo do primeiro turno.',
    mechanic: 'Durante a rolagem de iniciativa, você pode usar uma habilidade cujo custo de tempo seja Ação Bônus ou Ação Livre.',
    requiredSkillTrained: ['Reflexos'],
    prereqState: { trainedSkills: ['Reflexos'] },
    prerequisitesText: 'Treinado em Reflexos.',
    activation: 'trigger', peCost: 0,
    triggerText: 'Hook onInitiativeRoll: libera execução de uma habilidade de custo Ação Bônus ou Ação Livre antes do início do 1º turno.',
    logicText: 'onInitiativeRoll: enableAbility(activation IN [\'bonus\', \'free\']) = 1 ativação extra antes do round 1.',
  },
  {
    id: 'tec-revestimento-constante', name: 'Revestimento Constante', tier: 8, specialization: 'Especialista em Técnica',
    flavor: 'A camada protetora nunca desaparece — apenas se reforma.',
    mechanic: 'Passiva absoluta. Você recebe Redução de Dano contra todos os tipos de dano (exceto dano na alma) igual ao seu Bônus de Treinamento.',
    requiredAptitudes: ['apt-cobrir-se'],
    prereqState: { hasAptitude: ['apt-cobrir-se'] },
    prerequisitesText: 'Aptidão Cobrir-se.',
    activation: 'passive',
    triggerText: 'Passiva permanente.',
    logicText: 'damageReductionAll += BonusTreinamento (não se aplica a dano na alma).',
  },
  {
    id: 'tec-sustentacao-avancada', name: 'Sustentação Avançada', tier: 8, specialization: 'Especialista em Técnica',
    flavor: 'O corpo aprende a dividir a liberação de energia entre dois feitiços diferentes.',
    mechanic: 'Você pode manter um feitiço sustentado adicional (total: 2). Além disso, no começo do combate, você pode ativar um feitiço sustentado à sua escolha como Ação Livre.',
    activation: 'passive',
    triggerText: 'Passiva permanente: +1 slot de feitiço sustentado. Hook onCombatStart: oferece ativação de 1 feitiço sustentado como Ação Livre.',
    logicText: 'character.maxSustainedSpells += 1 (default 1 → 2). onCombatStart: enable freeSustainedActivation = 1.',
  },

  // ============ TIER 10 ============
  {
    id: 'tec-destruicao-ampla', name: 'Destruição Ampla', tier: 10, specialization: 'Especialista em Técnica',
    flavor: 'Quanto mais a maldição abrange, mais ela destrói.',
    mechanic: 'Passiva absoluta. Quando você utilizar um Feitiço em área, ele causa +5 de dano para cada criatura além da primeira que estiver sendo afetada por ele.',
    activation: 'passive',
    triggerText: 'Passiva: aplicada automaticamente em todo Feitiço em área.',
    logicText: 'onAreaSpellResolve: damage += 5 * Math.max(0, alvosAfetados - 1).',
  },
  {
    id: 'tec-destruicao-focada', name: 'Destruição Focada', tier: 10, specialization: 'Especialista em Técnica',
    flavor: 'Em vez de espalhar a destruição, ele a foca num único ponto.',
    mechanic: 'Passiva absoluta. Quando você utilizar um Feitiço de dano de alvo único, ele ignora RD igual ao seu modificador de Inteligência ou Sabedoria, e seu dano aumenta em uma quantidade de dados igual a ⌊Treinamento ÷ 2⌋ (mesmo tipo de dado do feitiço).',
    activation: 'passive',
    triggerText: 'Passiva: aplicada automaticamente em todo Feitiço de dano de alvo único.',
    logicText: 'onSingleTargetDamageSpell: ignoreRD += Mod_Chave; damageDice += Math.floor(Treinamento / 2) (mesmo dado base do feitiço).',
  },
  {
    id: 'tec-economia-de-energia-avancada', name: 'Economia de Energia Avançada', tier: 10, specialization: 'Especialista em Técnica',
    flavor: 'A reserva de energia descansada cresce — e fica acessível em pleno combate.',
    mechanic: 'Sua economia reserva se expande: descanso curto = 1d6, descanso longo = 1d8 (continua escalando 1 passo a cada 5 níveis a partir desses dados base). Adicionalmente, transferir a energia da reserva para o estoque atual passa a ser uma Ação Bônus.',
    prerequisites: ['tec-economia-de-energia'],
    prerequisitesText: 'Economia de Energia.',
    activation: 'passive',
    triggerText: 'Passiva permanente: aprimora os dados e o tempo de uso da Economia de Energia.',
    logicText: 'economiaPE.shortRestDie = d6 (era d4); economiaPE.longRestDie = d8 (era d6). Ambos continuam escalando 1 passo a cada 5 níveis. economiaPE.transferAction = bonus_action (era action).',
  },
  {
    id: 'tec-sentidos-agucados', name: 'Sentidos Aguçados', tier: 10, specialization: 'Especialista em Técnica',
    flavor: 'O domínio sobre a energia aguça os sentidos ao limite.',
    mechanic: 'Passiva: sua Atenção aumenta em ⌊Mod_Chave ÷ 2⌋, e você adiciona o mesmo bônus às rolagens de Percepção. Adicionalmente, você pode gastar 2 PE para, ao estar no ar, se manter estável de pé nele, percebendo o ar como uma plataforma.',
    requiredSkillMastery: ['Percepção'],
    prereqState: { masterSkills: ['Percepção'] },
    prerequisitesText: 'Mestre em Percepção.',
    activation: 'passive', peCost: 2,
    triggerText: 'Passiva permanente (Atenção/Percepção). Habilidade ativa "Plataforma de Ar" (2 PE) quando no ar.',
    logicText: 'Atencao += Math.floor(Mod_Chave / 2); PerceptionRoll += Math.floor(Mod_Chave / 2). Ativa: gasta 2 PE para se manter estável no ar como plataforma.',
  },

  // ============ TIER 12 ============
  {
    id: 'tec-esgrimista-jujutsu', name: 'Esgrimista Jujutsu', tier: 12, specialization: 'Especialista em Técnica',
    flavor: 'Combate marcial e feitiçaria se entrelaçam num único movimento.',
    mechanic: 'Quando utilizar Combate Amaldiçoado, você pode também utilizar um Feitiço Auxiliar tendo você mesmo como alvo, desde que o custo padrão dele seja Ação Bônus.',
    prerequisites: ['tec-combate-amaldicoado'],
    prerequisitesText: 'Combate Amaldiçoado.',
    activation: 'passive',
    triggerText: 'Hook onCombateAmaldicoadoUse: libera conjurar 1 Feitiço Auxiliar (custo padrão = Ação Bônus) com self como alvo, sem ocupar a Ação Bônus do turno.',
    logicText: 'onCombateAmaldicoadoUse: enable bundleAuxiliarySpell where spell.castTime == bonus_action AND spell.canTargetSelf.',
  },
  {
    id: 'tec-expansao-maestral', name: 'Expansão Maestral', tier: 12, specialization: 'Especialista em Técnica',
    flavor: 'A expansão flui sem esforço — e o domínio cobre até as costas.',
    mechanic: 'Passiva absoluta. Você pode utilizar Expansões de Domínio possuindo apenas uma mão livre. Adicionalmente, ataques à distância não causam Ataques de Oportunidade contra você enquanto estiver expandindo.',
    requiredAptitudes: ['apt-expansao-de-dominio-completa'],
    prereqState: { hasAptitude: ['apt-expansao-de-dominio-completa'] },
    prerequisitesText: 'Aptidão Expansão de Domínio Completa.',
    activation: 'passive',
    triggerText: 'Passiva permanente.',
    logicText: 'expansaoDeDominio.requiredFreeHands = 1 (era 2). enquanto isExpanding: rangedAttacksAgainstYou.provokeAoO = false.',
  },
  {
    id: 'tec-explosao-maxima', name: 'Explosão Máxima', tier: 12, specialization: 'Especialista em Técnica',
    flavor: 'O potencial explosivo da técnica chega ao limite máximo.',
    mechanic: 'Passiva absoluta. Para cada resultado máximo que você obtiver em um dado de dano de Feitiço (que dispare Explosão Encadeada), além de rolar o dado adicional, você soma +4 ao total de dano.',
    prerequisites: ['tec-explosao-encadeada'],
    prerequisitesText: 'Explosão Encadeada.',
    activation: 'passive',
    triggerText: 'Hook onExplosaoEncadeadaTrigger: além do dado extra, soma +4 flat por gatilho.',
    logicText: 'onExplosaoEncadeadaTrigger: damageTotal += 4 (uma vez por dado original que disparou a explosão).',
  },
  {
    id: 'tec-mestre-das-aptidoes', name: 'Mestre das Aptidões', tier: 12, specialization: 'Especialista em Técnica',
    flavor: 'Um pouco do potencial fica sempre reservado às aptidões.',
    mechanic: 'No começo de toda rodada, você recebe PE temporários iguais a ⌊Bônus de Treinamento ÷ 2⌋, utilizáveis exclusivamente em Aptidões Amaldiçoadas. Esses pontos não acumulam entre rodadas e são contabilizados separadamente de outros PEs temporários.',
    activation: 'passive',
    triggerText: 'Hook onRoundStart: zera e reaplica o pool dedicado de PE temporário para Aptidões.',
    logicText: 'onRoundStart: aptitudeOnlyTempPE = Math.floor(BonusTreinamento / 2). Pool exclusivo para Aptidões; não acumula; separado de tempPE geral.',
  },
  {
    id: 'tec-versatilidade-ampliada', name: 'Versatilidade Ampliada', tier: 12, specialization: 'Especialista em Técnica',
    flavor: 'O Especialista descobre múltiplas faces de cada feitiço.',
    mechanic: 'Passiva absoluta. Todos os seus Feitiços recebem +1 variação de liberação. Adicionalmente, escolha 1 dos seus Feitiços para receber 1 variação de cada nível de liberação a que você tenha acesso.',
    activation: 'passive',
    triggerText: 'Passiva permanente: cada Feitiço conhecido +1 variação. Modal de escolha permanente ao comprar (1 Feitiço destacado).',
    logicText: 'foreach spell in knownSpells: spell.releaseVariations += 1. spellEscolhido: ganha 1 variação por nível de liberação acessível ao personagem.',
    requiresConfig: 'single_spell_choice',
    choiceSchema: { kind: 'single-spell', label: 'Feitiço com variação completa por nível' },
  },

  // ============ TIER 16 ============
  {
    id: 'tec-manipulacao-perfeita', name: 'Manipulação Perfeita', tier: 16, specialization: 'Especialista em Técnica',
    flavor: 'A manipulação de energia chega ao seu ápice — feitiços inteiros custam quase nada.',
    mechanic: 'Escolha um número de Feitiços igual ao seu Bônus de Treinamento: cada um deles tem o custo em PE permanentemente reduzido em ⌊Treinamento ÷ 2⌋ (mín. 1).',
    prerequisites: ['tec-dominancia-em-feitico'],
    prerequisitesText: 'Dominância em Feitiço.',
    activation: 'passive',
    triggerText: 'Modal de escolha permanente ao comprar (N Feitiços, N = Bônus de Treinamento). Passiva absoluta depois.',
    logicText: 'foreach feiticoEscolhido: feitico.peCost -= Math.floor(BonusTreinamento / 2) (mín. 1).',
    requiresConfig: 'spells',
    choiceSchema: { kind: 'spells', countFormula: 'training_bonus', label: 'Feitiços com custo reduzido (N = Bônus de Treinamento)' },
  },
  {
    id: 'tec-sustentacao-mestre', name: 'Sustentação Mestre', tier: 16, specialization: 'Especialista em Técnica',
    flavor: 'O corpo dispersa energia em múltiplos canais simultâneos.',
    mechanic: 'Passiva absoluta. Você pode manter até 3 feitiços sustentados ao mesmo tempo. Adicionalmente, o custo em PE para sustentar feitiços é reduzido em 1 (mín. 1).',
    prerequisites: ['tec-sustentacao-avancada'],
    prerequisitesText: 'Sustentação Avançada.',
    activation: 'passive',
    triggerText: 'Passiva permanente.',
    logicText: 'character.maxSustainedSpells = 3 (substitui o valor anterior). sustainedSpell.peCostPerTurn -= 1 (mín. 1).',
  },
];

// ===== SUPORTE ==============================================================
// Os botões dessas habilidades ficam no painel do Suporte (SuportePanel), por
// isso o catálogo as marca como 'passive' (sem botão genérico que gaste PE).

const SUPORTE: SpecAbility[] = [
  {
    id: 'sup-amizade-inquebravel', name: 'Amizade Inquebrável', tier: 2, specialization: 'Suporte',
    flavor: 'Um laço que nenhum combate desfaz.',
    mechanic: 'Escolha um Aliado Jogador como seu "Amigo" (permanente). Ao terminar seu turno ao lado dele (até 1,5 m), você pode, como ação livre, realizar Apoiar nele. Se o Amigo morrer, só pode escolher outro no próximo interlúdio.',
    activation: 'passive',
    triggerText: 'Fim do seu turno a até 1,5 m do Amigo (pergunta ao jogador).',
    logicText: 'Aplica Apoiar (vantagem no próximo teste de perícia do Amigo) sem gastar ação. Troca de Amigo liberada pelo Mestre.',
  },
  {
    id: 'sup-analise-profunda', name: 'Análise Profunda', tier: 2, specialization: 'Suporte',
    flavor: 'Um olhar atento revela o que o inimigo esconde.',
    mechanic: 'Ação Comum, 1 PE: role Percepção contra CD 15 + ND da criatura. No sucesso descobre 1 característica (PV, perícias, ataque…), +1 para cada 5 pontos excedentes. Uma vez por criatura, por cena.',
    activation: 'passive',
    peCost: 1,
    triggerText: 'Botão "Analisar" no painel do Suporte.',
    logicText: 'Descobertas = 1 + ⌊(total − CD) ÷ 5⌋ no sucesso; alvo marcado até o fim da cena.',
  },
  {
    id: 'sup-apoio-avancado', name: 'Apoio Avançado', tier: 2, specialization: 'Suporte',
    flavor: 'Seu apoio vai além de palavras — vira ação concreta.',
    mechanic: 'Ao usar Apoiar, fortaleça com um efeito conhecido: Curativo (gasta 1 uso de Suporte em Combate e cura o aliado), Defensivo (+½ bônus de treinamento na Defesa), Focado (+½ mod de Presença/Sabedoria no teste), Ofensivo (2 PE: 1 ataque como parte da ação) ou Estratégico (+½ bônus de treinamento na CD do próximo teste forçado pelo aliado). Conhece 1 apoio; Nv 6: +1; Nv 12: +1.',
    activation: 'passive',
    triggerText: 'Seletor de efeito no botão Apoiar (painel do Suporte).',
    logicText: 'Buffs Defensivo/Estratégico expiram no início do próximo turno do Suporte; Focado é consumido na próxima perícia do alvo.',
  },
  {
    id: 'sup-conceder-outra-chance', name: 'Conceder Outra Chance', tier: 2, specialization: 'Suporte',
    flavor: 'Um empurrão no momento exato transforma fracasso em acerto.',
    mechanic: 'Ao ver um aliado a até 6 m falhar em um teste, gaste 3 PE para ele rolar novamente, ficando com o melhor resultado. Usos = bônus de treinamento, por descanso longo; descanso curto recupera metade.',
    activation: 'passive',
    peCost: 3,
    triggerText: 'Pergunta automática quando um aliado a até 6 m falha num teste com CD conhecida.',
    logicText: 'Falha detectada na rolagem (total < CD); ao aceitar, o aliado rola de novo e fica com o melhor total.',
  },
  {
    id: 'sup-otimizacao-espaco', name: 'Otimização de Espaço', tier: 2, specialization: 'Suporte',
    flavor: 'Cada bolso no lugar certo — você carrega mais do que parece possível.',
    mechanic: 'Você recebe espaços de item adicionais no inventário iguais ao seu bônus de treinamento.',
    activation: 'passive',
    triggerText: 'Automático — somado aos espaços do inventário na ficha.',
    logicText: 'slotsMax efetivo += bônus de treinamento.',
  },
  {
    id: 'sup-protetor', name: 'Protetor', tier: 2, specialization: 'Suporte',
    flavor: 'Seu escudo não protege só a você.',
    mechanic: 'Quando um aliado a até 1,5 m é atacado, gaste 1 PE (Ação Livre) para reduzir o dano em Xd10 + mod de Presença/Sabedoria, onde X = bônus de treinamento. Requer escudo equipado.',
    activation: 'passive',
    peCost: 1,
    triggerText: 'Pergunta automática quando um aliado adjacente sofre dano de ataque.',
    logicText: 'Redução retroativa: devolve HP/Escudo ao alvo até o valor rolado (máx. o dano sofrido).',
  },
  {
    id: 'sup-comando-motivador', name: 'Comando Motivador', tier: 2, specialization: 'Suporte',
    flavor: 'Sua presença é motivadora, e o mesmo vale para um comando dado por você.',
    mechanic: 'Como Ação Livre, fale um comando a um aliado e gaste 2 PE: quando ele realizar a ação comandada, recebe bônus igual ao seu bônus de treinamento na rolagem usada.',
    activation: 'passive',
    peCost: 2,
    triggerText: 'Botão Comandar no painel do Suporte.',
    logicText: 'Bônus fixo na próxima rolagem do aliado; expira no início do próximo turno do Suporte.',
  },
  {
    id: 'sup-desvendar-terreno', name: 'Desvendar Terreno', tier: 2, specialization: 'Suporte',
    flavor: 'Você destrincha o ambiente e encontra pontos de vantagem.',
    mechanic: 'Ação de Movimento: teste de Percepção com CD do Narrador. Se suceder, percebe pontos estratégicos e, até o fim da cena, soma o bônus de treinamento em testes de Percepção para procurar/encontrar coisas ou pessoas no terreno analisado.',
    activation: 'passive',
    triggerText: 'Pedido no painel do Suporte; o Mestre define a CD.',
    logicText: 'Sucesso libera o botão separado "Procurar no terreno" (Percepção + bônus) até o fim da cena.',
  },
  {
    id: 'sup-expandir-repertorio', name: 'Expandir Repertório', tier: 2, specialization: 'Suporte',
    flavor: 'Estudando para se tornar mais versátil, você domina outros campos de estudo.',
    mechanic: 'Torna-se treinado em perícias igual a metade do bônus de treinamento (para baixo) e recebe +2 em uma perícia qualquer.',
    activation: 'passive',
    triggerText: 'Escolhas no painel do Suporte.',
    logicText: 'Marca as perícias como treinadas e soma +2 no bônus externo da perícia escolhida; novas escolhas surgem quando o bônus de treinamento sobe.',
  },
  {
    id: 'sup-mobilidade-avancada', name: 'Mobilidade Avançada', tier: 2, specialization: 'Suporte',
    flavor: 'Você chega rápido onde seu suporte é requisitado.',
    mechanic: '+3 m de movimento. Quando um aliado cai nas portas da morte, você pode, como reação, mover-se metade do seu movimento na direção dele.',
    activation: 'passive',
    triggerText: 'Pergunta automática quando um aliado jogador cai a 0 PV.',
    logicText: 'Aceitar gasta 1 reação e libera metade do movimento para arrastar a peça fora do turno, até o início do seu próximo turno.',
  },
  {
    id: 'sup-transmitir-conhecimento', name: 'Transmitir Conhecimento', tier: 2, specialization: 'Suporte',
    flavor: 'Um bom mentor deixa o grupo inteiro mais capaz.',
    mechanic: 'Durante um descanso, conceda treinamento temporário em perícias que você é treinado. Limite de aliados: metade do bônus de treinamento (descanso curto) ou o bônus de treinamento (descanso longo). Dura até o próximo descanso do aliado.',
    activation: 'passive',
    triggerText: 'Painel do Suporte — escolha o tipo de descanso, o aliado e a perícia.',
    logicText: 'Marca a perícia do aliado como treinada (registrada em transmitirTempSkills) e remove o treinamento no próximo descanso do aliado.',
  },
  {
    id: 'sup-apoios-versateis', name: 'Apoios Versáteis', tier: 4, specialization: 'Suporte',
    flavor: 'Cada aliado precisa de um tipo diferente de ajuda.',
    mechanic: 'Você aprende um apoio avançado adicional. No 10º nível, recebe outro.',
    activation: 'passive',
    triggerText: 'Painel do Suporte — seção Apoio Avançado.',
    logicText: 'Soma +1 (ou +2 no Nv 10) ao limite de apoios avançados conhecidos.',
  },
  {
    id: 'sup-guarda-sincronizada', name: 'Guarda Sincronizada', tier: 4, specialization: 'Suporte',
    flavor: 'Um cuida do outro.',
    mechanic: 'Ação Bônus: sintonize a guarda dos aliados a até 7,5 m que possam te ver ou ouvir. Para cada aliado no alcance, todos os outros recebem +1 na Defesa.',
    activation: 'passive',
    triggerText: 'Painel do Suporte — botão Sintonizar guarda.',
    logicText: 'Membros (incluindo o Suporte) recebem +1 de Defesa por outro membro. Quem se afastar mais de 7,5 m ou ficar Cego/Surdo sai; se sobrar só o Suporte, a guarda acaba.',
  },
  {
    id: 'sup-inspirar-aliados', name: 'Inspirar Aliados', tier: 4, specialization: 'Suporte',
    flavor: 'A inspiração certa, na hora certa.',
    mechanic: 'Uma vez por cena, 1 PE + Ação Bônus: inspire aliados até metade do bônus de treinamento. Durante 10 minutos, eles podem somar 2d3 em ataque, teste de habilidade ou TR (uma vez por teste), um total de vezes igual ao seu mod de Presença/Sabedoria.',
    activation: 'passive',
    triggerText: 'Painel do Suporte; o aliado usa pelo botão na própria ficha.',
    logicText: 'Usos compartilhados; expira pelo relógio do jogo após 10 minutos.',
  },
  {
    id: 'sup-intervencao', name: 'Intervenção', tier: 4, specialization: 'Suporte',
    flavor: 'Agir antes que a aflição piore.',
    mechanic: 'Ação Comum, 3 PE: encerre uma condição fraca de um aliado ao alcance de toque. Nos níveis 6, 12 e 18 encerra condições médias, fortes e extremas; +3 PE por grau acima de fraca.',
    activation: 'passive',
    triggerText: 'Painel do Suporte — escolha aliado e condição.',
    logicText: 'Toque = 1,5 m no mapa. Condições especiais não podem ser encerradas; Sangramento (variável) pede o grau.',
  },
  {
    id: 'sup-negacao-critica', name: 'Negação Crítica', tier: 4, specialization: 'Suporte',
    flavor: 'Impedir o pior de acontecer.',
    mechanic: '1 + metade do bônus de treinamento vezes por cena, 3 PE: negue uma falha crítica de um aliado que você possa ver a até 12 metros.',
    activation: 'passive',
    triggerText: 'Aviso automático ao dono do Suporte quando um aliado tira 1 natural.',
    logicText: 'A falha crítica vira falha comum. Vale para qualquer rolagem de d20.',
  },
  {
    id: 'sup-pre-analise', name: 'Pré-Análise', tier: 4, specialization: 'Suporte',
    flavor: 'Você analisa o território sem nem perceber.',
    mechanic: 'Você não pode ser surpreendido e sua Atenção recebe +5. Escolha um aliado para também não ser surpreendido.',
    activation: 'passive',
    prerequisitesText: 'Treinado em Percepção.',
    triggerText: 'Painel do Suporte — escolha o aliado (1 por descanso curto).',
    logicText: 'Condição Surpreso é bloqueada. O aliado perde a proteção quando faz um descanso curto. +5 Atenção é narrativo e aparece em destaque na ficha.',
  },
  {
    id: 'sup-recompensa-sucesso', name: 'Recompensa pelo Sucesso', tier: 4, specialization: 'Suporte',
    flavor: 'Um sucesso mais difícil é extremamente gratificante.',
    mechanic: 'Ao usar Comando Motivador, você pode reduzir o bônus pela metade; se o aliado ainda assim suceder, ele ganha 2 PE.',
    activation: 'passive',
    prerequisites: ['sup-comando-motivador'],
    prerequisitesText: 'Comando Motivador.',
    triggerText: 'Opção no Comando Motivador.',
    logicText: 'Bônus arredondado para cima. Sucesso detectado em testes com CD conhecida. PE acima do máximo vira PE temporário.',
  },
  {
    id: 'sup-sintonizacao-vital', name: 'Sintonização Vital', tier: 4, specialization: 'Suporte',
    flavor: 'A cura que você canaliza transborda para quem está por perto.',
    mechanic: 'Quando curar um aliado, você pode gastar 3 PE para que outra criatura a até 3 m (incluindo você) recupere PV igual a metade da cura original.',
    activation: 'passive',
    triggerText: 'Aviso automático após curar um aliado.',
    logicText: 'Metade arredondada para cima. Sem limite de usos. Alvo secundário não pode ser o aliado já curado.',
  },
];


// ===== Especialista em Combate =============================================
const ESPECIALISTA_COMBATE: SpecAbility[] = [
  {
    id: 'ec-arremessos-potentes', name: 'Arremessos Potentes', tier: 2, specialization: 'Especialista em Combate',
    flavor: 'Você se torna capaz de arremessar armas com mais potência.',
    mechanic: 'Ataques com armas de arremesso contam como um nível de dano acima. No começo do seu turno, pode gastar 1 PE para que seus ataques com armas de arremesso ignorem RD igual ao seu bônus de treinamento.',
    activation: 'free', peCost: 1,
    triggerText: 'Botão na aba de Ataque, no começo do seu turno (antes de atacar).',
    logicText: 'Dado da arma de arremesso sobe 1 passo sempre. Com PE gasto, a RD do alvo é reduzida pelo bônus de treinamento até o fim do turno.',
  },
  {
    id: 'ec-arsenal-ciclico', name: 'Arsenal Cíclico', tier: 2, specialization: 'Especialista em Combate',
    flavor: 'Você mantém uma ciclagem do seu arsenal para golpear com eficiência.',
    mechanic: 'Uma vez por rodada, pode sacar ou trocar um item com uma ação livre. Ao golpear com um grupo de armas e trocar para uma arma de outro grupo na mesma rodada ou na próxima, recebe +1 dado de dano até o fim do seu próximo turno com a arma trocada.',
    activation: 'free', usage: { max: 1, scope: 'round' },
    triggerText: 'Troca de arma em combate.',
    logicText: 'Grupo = grupo da arma (Faca, Espada, Arco…).',
  },
  {
    id: 'ec-assumir-postura', name: 'Assumir Postura', tier: 2, specialization: 'Especialista em Combate',
    flavor: 'A postura que você mantém em combate molda suas capacidades.',
    mechanic: 'Você aprende uma das oito posturas de combate (mais uma nos níveis 8 e 16). Entrar em uma postura é uma ação bônus e dura 1 minuto ou até ser derrubado, ficar incapacitado ou trocar de postura. Usos iguais ao bônus de treinamento.',
    activation: 'bonus', usage: { max: 'training', scope: 'rest_long' },
    triggerText: 'Aba de Posturas na barra de combate.',
    logicText: 'Sol, Lua, Terra, Dragão, Fortuna, Devastação (nv 6), Tempestade (nv 10), Céu (nv 12).',
  },
  {
    id: 'ec-disparos-sincronizados', name: 'Disparos Sincronizados', tier: 2, specialization: 'Especialista em Combate',
    flavor: 'Você sincroniza seus disparos e tiros, fazendo-os parecer um só.',
    mechanic: 'Manejando duas armas à distância ou de fogo, você pode usar suas ações de ataque juntas. Realize os dois ataques: se ambos acertarem, o dano vira uma única instância, com efeitos das duas armas e resistências/fraquezas aplicadas uma só vez.',
    activation: 'action',
    triggerText: 'Botão "Disparos Sincronizados" na aba de Ataque (Ação Comum).',
    logicText: 'Se qualquer um dos dois tiros errar, nenhum dano é causado. RD aplicada uma vez sobre o dano somado.',
  },
  {
    id: 'ec-extensao-corpo', name: 'Extensão do Corpo', tier: 2, specialization: 'Especialista em Combate',
    flavor: 'Suas armas são praticamente extensões do seu próprio corpo.',
    mechanic: 'Seu alcance em ataques com armas corpo a corpo aumenta em 1,5 m e você recebe +2 em jogadas de ataque e em testes para evitar ser desarmado.',
    activation: 'passive',
    triggerText: 'Sempre ativa.',
    logicText: '+1,5 m de alcance CaC, +2 no acerto com armas corpo a corpo, +2 em testes contra desarme.',
  },
  {
    id: 'ec-flanqueador-superior', name: 'Flanqueador Superior', tier: 2, specialization: 'Especialista em Combate',
    flavor: 'Você sabe perfeitamente como manter um flanco perigoso.',
    mechanic: 'Enquanto estiver flanqueando uma criatura, ela recebe −2 em testes de resistência.',
    activation: 'passive',
    triggerText: 'Você e um aliado adjacentes (1,5 m) à mesma criatura.',
    logicText: '−2 em todos os TRs da criatura flanqueada enquanto o flanco existir.',
  },
  {
    id: 'ec-golpe-falso', name: 'Golpe Falso', tier: 2, specialization: 'Especialista em Combate',
    flavor: 'Você finge desferir um golpe, distraindo seus inimigos para auxiliar aliados.',
    mechanic: 'Como reação a um aliado atacando um inimigo dentro do seu alcance de ataque, o inimigo faz um TR de Astúcia. Se falhar, seu aliado recebe vantagem no teste de ataque.',
    activation: 'reaction',
    triggerText: 'Painel de Ataque — seção "Golpe Falso" (sua ficha) e aviso na ficha do aliado.',
    logicText: 'Alcance = arma empunhada (com Extensão do Corpo, se houver). TR de Astúcia vs CD de Especialização. Falha → vantagem no próximo ataque do aliado.',
  },
  {
    id: 'ec-golpes-potentes', name: 'Golpes Potentes', tier: 2, specialization: 'Especialista em Combate',
    flavor: 'Seus golpes se tornam inatamente mais potentes.',
    mechanic: 'Sempre que usar uma arma com a qual seja treinado, o dano dela aumenta em um nível e suas rolagens de dano recebem +2.',
    activation: 'passive',
    triggerText: 'Sempre ativa, com armas treinadas.',
    logicText: '+1 nível de dano (acumula com Arremessos Potentes) e +2 fixo no dano.',
  },
  {
    id: 'ec-indomavel', name: 'Indomável', tier: 2, specialization: 'Especialista em Combate',
    flavor: 'Em combate, você não se deixa render, resistindo ao que vier.',
    mechanic: 'Metade do seu nível de personagem em vezes por descanso curto ou longo, gaste 1 PE para rolar novamente um teste de resistência em que falhou, ficando com o melhor resultado.',
    activation: 'reaction', peCost: 1, usage: { max: 'level_half', scope: 'rest_short' },
    triggerText: 'Pergunta automática ao falhar em um teste de resistência.',
    logicText: 'Usos = ⌊nível ÷ 2⌋, mínimo 1. Rerrola o d20 e mantém o melhor entre os dois.',
  },
  {
    id: 'ec-pistoleiro-iniciado', name: 'Pistoleiro Iniciado', tier: 2, specialization: 'Especialista em Combate',
    flavor: 'Atirando com volatilidade, você impõe mais poder em troca de um risco maior.',
    mechanic: 'Antes da jogada de ataque com uma arma de fogo, você pode aumentar a margem de Emperrar em 2 e, em troca, causar 1 dado de dano adicional caso acerte.',
    activation: 'free',
    triggerText: 'Interruptor "Pistoleiro Iniciado" na aba de Ataque, antes de rolar.',
    logicText: 'Emperra em 1 natural (base) ou 1-3 com a habilidade. Emperrar = erro automático e a arma trava até uma Ação Comum de desemperrar. Acertando, +1 dado da arma (dobra em crítico).',
  },
  {
    id: 'ec-posicionamento-ameacador', name: 'Posicionamento Ameaçador', tier: 2, specialization: 'Especialista em Combate',
    flavor: 'Você se posiciona de maneira estratégica, sendo reconhecido como ameaça constante.',
    mechanic: 'A menos que esteja furtivo, você pode conceder os benefícios de Flanco para aliados mesmo usando armas à distância ou de fogo, desde que o alvo esteja dentro do primeiro alcance da sua arma.',
    activation: 'passive',
    triggerText: 'Sempre ativa, com arma à distância/de fogo empunhada.',
    logicText: 'Você conta como um dos flanqueadores à distância (1º alcance). Com Flanqueador Superior, o alvo recebe −2 em TRs. Ficar furtivo ou sair do alcance encerra o efeito.',
  },
  {
    id: 'ec-precisao-definitiva', name: 'Precisão Definitiva', tier: 2, specialization: 'Especialista em Combate',
    flavor: 'Você canaliza energia amaldiçoada na arma para alcançar precisão definitiva.',
    mechanic: 'Ao fazer um ataque, gaste 1 PE para receber +2 na rolagem de acerto. A cada quatro níveis, pode gastar 1 ponto a mais para aumentar o bônus em +2. Você também pode adicionar esse bônus na rolagem de dano, com +4 por ponto em vez de +2.',
    activation: 'free', peCost: 1,
    triggerText: 'Seletor "Precisão Definitiva" na aba de Ataque, antes de rolar.',
    logicText: 'Máximo de PE = 1 + ⌊nível ÷ 4⌋. Escolha antes do ataque: +2 acerto por PE OU +4 dano por PE.',
  },
  {
    id: 'ec-presenca-suprimida', name: 'Presença Suprimida', tier: 2, specialization: 'Especialista em Combate',
    flavor: 'A furtividade e a discrição podem ser essenciais em um combate.',
    mechanic: 'Você recebe +2 em rolagens de Furtividade. Sua penalidade em Furtividade por atacar e fazer outras ações chamativas é reduzida para −5.',
    activation: 'passive',
    triggerText: 'Sempre ativa. Na rolagem de Furtividade há a opção "após ataque / ação chamativa".',
    logicText: '+2 fixo em Furtividade. Penalidade por ação chamativa: −5 (em vez de −10).',
  },
  {
    id: 'ec-revigorar', name: 'Revigorar', tier: 2, specialization: 'Especialista em Combate',
    flavor: 'Você é capaz de focar e recuperar seu vigor em meio ao combate.',
    mechanic: 'Ação Bônus para se curar em 1d10 + o dobro do seu modificador de Constituição + bônus de treinamento, aumentando em um dado a cada 4 níveis. Usos iguais ao bônus de treinamento; recupera tudo no descanso longo e metade no curto.',
    activation: 'bonus', usage: { max: 'training', scope: 'rest_long' },
    triggerText: 'Botão "Revigorar" na aba de Ataque da ficha.',
    logicText: 'Cura = Nd10 + 2×Mod.CON + Bônus de Treinamento, com N = 1 + dados extras nos níveis 4, 8, 12, 16 e 20. Gasta 1 ação bônus e 1 uso. Descanso curto devolve ⌊usos máximos ÷ 2⌋.',
  },
  {
    id: 'ec-tiro-falso', name: 'Tiro Falso', tier: 2, specialization: 'Especialista em Combate',
    flavor: 'Você finge falsos disparos, distraindo um inimigo.',
    mechanic: 'Como reação a um aliado atacando um inimigo dentro do seu alcance de ataque, empunhando uma arma à distância ou de fogo, o inimigo faz um TR de Astúcia. Se falhar, seu aliado recebe vantagem no teste de ataque.',
    activation: 'reaction',
    triggerText: 'Painel de Ataque — seção "Tiro Falso" (sua ficha) e aviso na ficha do aliado.',
    logicText: 'Exige arma à distância ou de fogo. Alcance = alcance máximo da arma. TR de Astúcia vs CD de Especialização. Falha → vantagem no próximo ataque do aliado.',
  },
  {
    id: 'ec-zona-risco', name: 'Zona de Risco', tier: 2, specialization: 'Especialista em Combate',
    flavor: 'Ter uma arma com o alcance maior permite criar uma efetiva zona de risco.',
    mechanic: 'Uma vez por rodada, se estiver empunhando uma arma corpo a corpo com a propriedade Estendida e um inimigo entrar no seu alcance de ataque, você pode gastar 2 pontos de energia amaldiçoada para realizar um ataque contra ele.',
    activation: 'reaction',
    triggerText: 'Pergunta automática quando um inimigo termina um movimento no mapa dentro do seu alcance.',
    logicText: 'Custa 2 PE (não gasta reação), 1 vez por rodada, em qualquer turno. Exige arma CaC com Estendida na mão principal. Aceitar seleciona o inimigo no Painel de Ataque para rolar o ataque.',
  },
];



// ===== Registry global =====================================================

const REGISTRY: Partial<Record<Specialization, SpecAbility[]>> = {
  Lutador: LUTADOR,
  'Especialista em Técnica': ESPECIALISTA_TECNICA,
  Suporte: SUPORTE,
  'Especialista em Combate': ESPECIALISTA_COMBATE,
};

export function getSpecAbilitiesFor(spec: Specialization): SpecAbility[] {
  return REGISTRY[spec] ?? [];
}

export function getSpecAbilityById(id: string): SpecAbility | undefined {
  for (const list of Object.values(REGISTRY)) {
    const found = list?.find(a => a.id === id);
    if (found) return found;
  }
  return undefined;
}

/** Lista de tiers disponíveis para uma spec, em ordem crescente. */
export function getAvailableTiers(spec: Specialization): SpecAbilityTier[] {
  const set = new Set<SpecAbilityTier>();
  for (const a of getSpecAbilitiesFor(spec)) set.add(a.tier);
  return [...set].sort((a, b) => a - b) as SpecAbilityTier[];
}

/** Resolve o máximo de usos efetivo dado o personagem (training/level_half/milestone/numérico). */
export function resolveUsageMax(usage: SpecAbilityUsage, ctx: { trainingBonus: number; level: number }): number {
  if (usage.max === 'training') return Math.max(0, ctx.trainingBonus);
  if (usage.max === 'level_half') return Math.max(0, Math.floor(ctx.level / 2));
  if (
    typeof usage.max === 'object' &&
    (usage.max?.kind === 'custom_milestone' || usage.max?.kind === 'scaling_milestone')
  ) {
    // Pega o marco com o maior `level` que ainda seja <= ao nível atual.
    const eligible = usage.max.milestones
      .filter(m => ctx.level >= m.level)
      .sort((a, b) => b.level - a.level);
    return eligible.length > 0 ? Math.max(0, eligible[0].max) : 0;
  }
  return usage.max as number;
}

/** Rótulo amigável para o tipo de ativação. */
export const ACTIVATION_LABEL: Record<SpecAbilityActivation, string> = {
  passive: 'Passiva',
  reaction: 'Reação',
  bonus: 'Ação Bônus',
  action: 'Ação',
  free: 'Ação Livre',
  toggle: 'Toggle',
  trigger: 'Gatilho',
};

/** Rótulo amigável para o escopo de uso. */
export const USAGE_SCOPE_LABEL: Record<SpecAbilityUsageScope, string> = {
  none: '—',
  round: '/rodada',
  scene: '/cena',
  rest_short: '/descanso curto',
  rest_long: '/descanso longo',
  daily: '/dia',
};

// ===== Avaliação de pré-requisitos =========================================

export interface SpecAbilityRequirementResult {
  ok: boolean;
  missing: string[];
}

function isSkillTrainedC(c: import('@/types').Character, name: string): boolean {
  const target = name.trim().toLowerCase();
  return (c.skills ?? []).some(
    s => s.name.trim().toLowerCase() === target && (s.trained || s.mastery),
  );
}

function isSkillMasteryC(c: import('@/types').Character, name: string): boolean {
  const target = name.trim().toLowerCase();
  return (c.skills ?? []).some(
    s => s.name.trim().toLowerCase() === target && s.mastery,
  );
}

/**
 * Verifica se o personagem cumpre TODOS os pré-requisitos de uma habilidade
 * de especialização. Retorna a lista de itens faltantes (texto pronto para
 * tooltip). NÃO bloqueia por classe/spec — isso é responsabilidade da UI
 * (a aba já filtra por `character.specialization`).
 */
export function evaluateSpecAbilityRequirements(
  a: SpecAbility,
  c: import('@/types').Character,
): SpecAbilityRequirementResult {
  const missing: string[] = [];

  // Tier <= nível
  if (c.level < a.tier) {
    missing.push(`Requer Nv ${a.tier}`);
  }

  // Já comprada? (anti-duplicação salvo allowMultiplePurchases)
  const chosen = c.chosenSpecAbilities ?? [];
  const alreadyHas = chosen.some(x => x.abilityId === a.id);
  if (alreadyHas && !a.allowMultiplePurchases) {
    missing.push('Já adquirida');
  }

  // Habilidades pré-requisito (do próprio pool)
  for (const pid of a.prerequisites ?? []) {
    if (!chosen.some(x => x.abilityId === pid)) {
      const dep = getSpecAbilityById(pid);
      missing.push(`Requer habilidade: ${dep?.name ?? pid}`);
    }
  }

  // Aptidões amaldiçoadas
  const apts = c.chosenAptitudes ?? [];
  for (const aid of a.requiredAptitudes ?? []) {
    if (!apts.includes(aid)) {
      missing.push(`Requer aptidão: ${aid}`);
    }
  }

  // Perícias treinadas
  for (const s of a.requiredSkillTrained ?? []) {
    if (!isSkillTrainedC(c, s)) missing.push(`Treinado em ${s}`);
  }

  // Perícias em maestria
  for (const s of a.requiredSkillMastery ?? []) {
    if (!isSkillMasteryC(c, s)) missing.push(`Mestre em ${s}`);
  }

  // ── Pré-requisitos de ESTADO (briefing oficial) ──
  if (a.prereqState) {
    for (const s of a.prereqState.trainedSkills ?? []) {
      if (!isSkillTrainedC(c, s)) missing.push(`Treinado em ${s}`);
    }
    for (const s of a.prereqState.masterSkills ?? []) {
      if (!isSkillMasteryC(c, s)) missing.push(`Mestre em ${s}`);
    }
    for (const aid of a.prereqState.hasAptitude ?? []) {
      if (!apts.includes(aid)) missing.push(`Requer aptidão: ${aid}`);
    }
  }

  return { ok: missing.length === 0, missing };
}

// ===== Validação do catálogo (boot-time) ===================================

/**
 * Mapa de compatibilidade entre `requiresConfig` (string) e o `kind` esperado
 * em `choiceSchema`. Usado para evitar o bug de "Escolher…" não aparecer
 * quando o catálogo declara uma config mas esquece o schema.
 */
const REQUIRES_CONFIG_TO_SCHEMA_KIND: Record<NonNullable<SpecAbility['requiresConfig']>, SpecAbilityChoiceSchema['kind']> = {
  weapons: 'weapons',
  skills: 'skills',
  spell_or_variation: 'spell-or-variation',
  save_skill_choice: 'save-skill',
  spell_and_ritual_upgrade: 'spell-and-ritual-upgrade',
  single_spell_choice: 'single-spell',
  spell_level_choice: 'spell-level',
  single_release_choice: 'single-release',
  spells: 'spells',
};

/**
 * Valida o catálogo no boot. Emite `console.error` em DEV; no PROD apenas
 * coleta para inspeção. Não lança — não queremos derrubar o app por dado
 * inconsistente.
 */
export function validateSpecAbilityCatalog(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const list of Object.values(REGISTRY)) {
    if (!list) continue;
    for (const a of list) {
      // IDs únicos
      if (seen.has(a.id)) errors.push(`ID duplicado: ${a.id}`);
      seen.add(a.id);

      // requiresConfig ⇄ choiceSchema
      if (a.requiresConfig) {
        if (!a.choiceSchema) {
          errors.push(`${a.id} (${a.name}): requiresConfig='${a.requiresConfig}' mas choiceSchema ausente.`);
        } else {
          const expected = REQUIRES_CONFIG_TO_SCHEMA_KIND[a.requiresConfig];
          if (a.choiceSchema.kind !== expected) {
            errors.push(`${a.id} (${a.name}): requiresConfig='${a.requiresConfig}' espera choiceSchema.kind='${expected}', recebeu '${a.choiceSchema.kind}'.`);
          }
        }
      }

      // Prerequisites internos resolvíveis
      for (const pid of a.prerequisites ?? []) {
        const exists = Object.values(REGISTRY).some(l => l?.some(x => x.id === pid));
        if (!exists) errors.push(`${a.id}: prerequisite '${pid}' não existe no catálogo.`);
      }
    }
  }

  if (errors.length > 0 && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.error('[specAbilities] Catálogo com erros:\n' + errors.join('\n'));
  }
  return errors;
}

// Validação automática no carregamento do módulo (apenas em DEV).
if (typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
  validateSpecAbilityCatalog();
}
