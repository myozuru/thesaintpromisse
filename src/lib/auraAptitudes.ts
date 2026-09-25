/**
 * Catálogo de APTIDÕES DE AURA — escolas/efeitos desbloqueados pelo Nível de Aptidão em Aura (AU).
 *
 * Diferente do sistema numérico (`Character.cursedAptitudes.AU`), este catálogo cobre
 * as habilidades NOMEADAS (Aura Reforçada, Aura Lacerante, etc.). O jogador
 * ESCOLHE quais aptidões adquirir, e o sistema bloqueia (`gate`) com base em:
 *  - Nível mínimo do personagem
 *  - Nível mínimo de AU (`cursedAptitudes.AU`)
 *  - Atributos mínimos
 *  - Outras aptidões pré-requisito (por id)
 *  - Treinos em perícia
 *
 * Cada aptidão tem metadados de ativação para a UI (igual ao padrão de SpecAbility).
 */

export type AuraActivation = 'passive' | 'reaction' | 'bonus' | 'action' | 'free' | 'toggle' | 'trigger';
export type AuraUsageScope = 'none' | 'round' | 'scene' | 'rest_short' | 'rest_long' | 'daily';

/**
 * Famílias de aptidões amaldiçoadas. Mapeiam para `Character.cursedAptitudes`.
 * - AU: Aura
 * - CL: Controle e Leitura
 * - BAR: Barreiras
 * - DOM: Domínio
 * - ER: Energia Reversa
 * - SPECIAL: Aptidões Especiais (sem nível numérico associado)
 */
export type CursedAptitudeFamily = 'AU' | 'CL' | 'BAR' | 'DOM' | 'ER' | 'SPECIAL' | 'CURSED';

/** Subfamília opcional para CURSED (Aptidões Amaldiçoadas Exclusivas). */
export type CursedExclusiveSubfamily = 'anatomy' | 'control' | 'special';

/**
 * Configurações que a UI deve solicitar antes de aplicar a aptidão.
 */
export type CursedAptitudeRequiresConfig =
  | 'choose_attack_or_save'
  | 'target_enemy'
  | 'choose_action_subtype';

/**
 * Indica como a aptidão é suportada pelo motor:
 *   - 'pending' : ainda não catalogada/implementada (REJEITADO em testes).
 *   - 'wired'   : hook técnico parcial (placeholder).
 *   - 'live'    : hook automático completo no engine.
 *   - 'manual'  : efeito legítimo administrado manualmente pelo jogador
 *                 (passivas narrativas, escolhas únicas, reações fora dos
 *                 painéis ativos). Mesma filosofia do FahPanel/SpecPanels.
 */
export type CursedAptitudeEngineSupport = 'pending' | 'wired' | 'live' | 'manual';

export interface AuraAptitudePrereqs {
  /** Nível mínimo do personagem. */
  minLevel?: number;
  /** Nível mínimo de AU em `cursedAptitudes.AU`. */
  minAU?: number;
  /** Nível mínimo de CL. */
  minCL?: number;
  /** Nível mínimo de BAR. */
  minBAR?: number;
  /** Nível mínimo de DOM. */
  minDOM?: number;
  /** Nível mínimo de ER. */
  minER?: number;
  /** IDs de outras aptidões de aura (legado) que precisam estar adquiridas. */
  requiresAuraIds?: string[];
  /** IDs genéricos de qualquer família (preferir este campo em entradas novas). */
  requiresAptitudeIds?: string[];
  /** Atributos mínimos. Chaves: 'FOR' | 'DES' | 'CON' | 'INT' | 'PRE' | 'SAB'. */
  attrMin?: Partial<Record<'FOR' | 'DES' | 'CON' | 'INT' | 'PRE' | 'SAB', number>>;
  /** Atributos: pelo menos UM precisa atingir o mínimo (OR). */
  attrMinAny?: Partial<Record<'FOR' | 'DES' | 'CON' | 'INT' | 'PRE' | 'SAB', number>>;
  /** Perícias treinadas (nomes). */
  requiredSkillTrained?: string[];
  /** Perícias com Maestria (nomes). Mais restritivo que treinado. */
  requiredSkillMastery?: string[];
  /** Restringe a aptidão a determinados clãs (validar contra `character.originChoices.clanId`). */
  requiredClans?: string[];
}

/**
 * Overrides declarativos para upgrades de aptidão.
 * O tier mais alto possuído deve consolidar a base + overrides na UI.
 */
export interface CursedAptitudeOverrides {
  dieSize?: string;
  peLimitFormula?: string;
  multiplier?: number;
  flatBonus?: string;
  additionalEffects?: string[];
  triggerOverride?: string;
}

/**
 * Esquema unificado para Aptidões Amaldiçoadas (todas as famílias).
 * Mantemos o nome `AuraAptitude` como alias por retrocompatibilidade
 * (consumidores legados em AuraAptitudesPanel, originEngine, auraEffects, OriginStep).
 */
export interface CursedAptitudeEntry {
  id: string;
  name: string;
  /** Família de aptidão (AU/CL/BAR/DOM/ER). Default em entradas legadas: 'AU'. */
  family?: CursedAptitudeFamily;
  /** Subfamília (apenas para CURSED): anatomia / controle e leitura / especial. */
  subfamily?: CursedExclusiveSubfamily;
  /** Texto narrativo curto. */
  flavor: string;
  /** Texto mecânico completo (regra) — Texto para o Jogador. */
  mechanic: string;
  /** Pré-requisitos consolidados. */
  prereqs?: AuraAptitudePrereqs;
  /** Texto livre dos pré-requisitos (exibição). */
  prerequisitesText?: string;

  // ===== Metadados de ativação (UI) =====
  activation: AuraActivation;
  /** Custo em PE para ativar. Número fixo, 0/ausente = grátis, ou 'variable' (PE escolhido pelo jogador no uso). */
  peCost?: number | 'variable';
  /** Fórmula que limita o PE máximo gasto quando `peCost === 'variable'` (ex.: 'CL', 'CL + 1', '2 + CL*2'). */
  peLimitFormula?: string;
  /** Custo em PE por rodada para manter (0 ou ausente = não há manutenção). */
  peUpkeep?: number;
  /** Limite de usos. Omitido = ilimitado. */
  usage?: {
    /**
     * Número fixo, 'training' (= bônus de treinamento), ou fórmula vinculada à família:
     * 'au_full'/'au_half'/'cl_full'/'cl_half'/'bar_full'/'bar_half'/'dom_full'/'dom_half'/'er_full'/'er_half'.
     */
    max:
      | number
      | 'training'
      | 'au_half' | 'au_full'
      | 'cl_half' | 'cl_full'
      | 'bar_half' | 'bar_full'
      | 'dom_half' | 'dom_full'
      | 'er_half' | 'er_full';
    scope: AuraUsageScope;
  };
  /** Texto resumido do gatilho (UI) — Uso (literal). */
  triggerText?: string;
  /** Texto resumido da lógica (UI) — Lógica de Estado (literal). */
  logicText?: string;

  // ===== Upgrades / configuração =====
  /** ID da aptidão base que esta substitui (UI mostra apenas o tier mais alto). */
  upgradesId?: string;
  /** Overrides aplicados sobre a base ao consolidar o tier mais alto. */
  overrides?: CursedAptitudeOverrides;
  /** Configuração que a UI deve coletar antes de aplicar (ex.: alvo, sub-modo). */
  requiresConfig?: CursedAptitudeRequiresConfig;
  /** Status do motor de regras para esta aptidão. */
  engineSupport?: CursedAptitudeEngineSupport;
}

/** @deprecated Use `CursedAptitudeEntry`. Mantido para retrocompatibilidade. */
export type AuraAptitude = CursedAptitudeEntry;

/**
 * Catálogo completo das Aptidões de Aura.
 * Mantenha em ordem aproximada de tier (nível mínimo crescente).
 */
export const AURA_APTITUDES: AuraAptitude[] = [
  {
    id: 'aura_reforcada',
    name: 'Aura Reforçada',
    flavor: 'Reforçando o fluxo da sua aura, você pausa e anula parte do dano físico que recebe.',
    mechanic: 'Você recebe redução contra danos físicos (cortes, perfurações e impactos) igual ao DOBRO do seu Nível de Aptidão em Aura.',
    activation: 'passive',
    triggerText: 'Sempre ativa.',
    logicText: 'RD = 2 × AU contra DCO/DP/DI.',
  },
  {
    id: 'aura_macica',
    name: 'Aura Maciça',
    flavor: 'Sua aura é tão densa que parece ganhar forma física, dificultando acertos.',
    mechanic: 'Sua Defesa aumenta em um valor igual ao seu Nível de Aptidão em Aura. [Pré-Requisito: Constituição 16]',
    prereqs: { attrMin: { CON: 16 } },
    prerequisitesText: 'Constituição 16',
    activation: 'passive',
    triggerText: 'Sempre ativa.',
    logicText: 'CA += AU.',
  },
  {
    id: 'aura_movediça',
    name: 'Aura Movediça',
    flavor: 'Você molda sua aura para atrapalhar a movimentação em suas proximidades.',
    mechanic: 'Todo quadrado adjacente a você se torna terreno difícil. AU 2: 3m. AU 4: 4,5m. AU 5: 6m. Não pode ser aumentada por Expandir Aura.',
    activation: 'passive',
  },
  {
    id: 'aura_do_bastiao',
    name: 'Aura do Bastião',
    flavor: 'Sua aura protetiva auxilia seus aliados a não serem acertados.',
    mechanic: 'Todo aliado dentro de 4,5 metros de você recebe um bônus na Defesa igual ao seu Nível de Aptidão em Aura.',
    activation: 'passive',
  },
  {
    id: 'afinidade_ampliada',
    name: 'Afinidade Ampliada',
    flavor: 'Sua aura é aprimorada para ter maior afinidade com um elemento específico.',
    mechanic: 'Ao obter, escolha um tipo de dano elemental. Sempre que infligir dano desse tipo, você causa dano adicional igual a 1 + seu Nível de Aptidão em Aura ao total de dano.',
    activation: 'passive',
  },
  {
    id: 'aura_controlada',
    name: 'Aura Controlada',
    flavor: 'Você refinou seu controle, impedindo que sua aura se revele em momentos inconvenientes.',
    mechanic: 'Você soma metade do seu Nível de Aptidão em Aura em testes de Furtividade. Pode gastar 1 PE para receber o NÍVEL DE APTIDÃO COMPLETO em uma rolagem específica de Furtividade. [Pré-Requisito: Treinado em Furtividade e Destreza 16]',
    prereqs: { attrMin: { DES: 16 }, requiredSkillTrained: ['Furtividade'] },
    prerequisitesText: 'Treinado em Furtividade, Destreza 16',
    activation: 'trigger',
    peCost: 1,
    triggerText: 'Em uma rolagem de Furtividade.',
    logicText: 'Gasta 1 PE para usar AU completo no teste.',
  },
  {
    id: 'aura_de_contencao',
    name: 'Aura de Contenção',
    flavor: 'Com foco em conter, sua aura fica mais pesada e densa.',
    mechanic: 'Adiciona metade do AU em rolagens de Atletismo para agarrar/evitar escape. Quantidade de vezes por cena igual a metade do AU, pode gastar 1 PE para vantagem em agarrar OU desvantagem na criatura para escapar. [Pré-Requisito: Força ou Constituição 16]',
    prereqs: { attrMinAny: { FOR: 16, CON: 16 } },
    prerequisitesText: 'Força OU Constituição 16',
    activation: 'trigger',
    peCost: 1,
    usage: { max: 'au_half', scope: 'scene' },
    triggerText: 'Ao agarrar ou na resistência ao escape.',
    logicText: '½ AU passivo no teste; gastar 1 PE para vantagem/desvantagem.',
  },
  {
    id: 'aura_redirecionadora',
    name: 'Aura Redirecionadora',
    flavor: 'Imbue parte da sua aura num projétil ou arma de arremesso, redirecionando-o se errar.',
    mechanic: 'Gaste 2 PE antes do ataque. Se errar, refaça a rolagem contra outro alvo dentro de 6m do primeiro, com bônus = 1 + ½ AU. [Pré-Requisito: Destreza 16]',
    prereqs: { attrMin: { DES: 16 } },
    prerequisitesText: 'Destreza 16',
    activation: 'free',
    peCost: 2,
  },
  {
    id: 'enganacao_projetada',
    name: 'Enganação Projetada',
    flavor: 'Com agilidade, projeta sua aura antes do ataque, criando uma ilusão de quando ele acontecerá.',
    mechanic: 'No ataque, alvo faz TR de Astúcia (atrib. principal). Em falha, você tem vantagem. Cada ataque adicional no mesmo turno custa 1 PE. [Pré-Requisito: Treinado em Enganação, Destreza 18 e Nível 4]',
    prereqs: { minLevel: 4, attrMin: { DES: 18 }, requiredSkillTrained: ['Enganação'] },
    prerequisitesText: 'Treinado em Enganação, Destreza 18, Nível 4',
    activation: 'trigger',
    peCost: 1,
  },
  {
    id: 'aura_lacerante',
    name: 'Aura Lacerante',
    flavor: 'Sua aura é afiada e fere apenas pelo contato.',
    mechanic: 'Ação livre: ativa por 1 rodada. Criaturas que iniciam o turno em 3m: TR de Fortitude, em falha sofrem Xd6 + mod do atributo principal de dano energético, X = AU. AU 3: d8; AU 5: d10.',
    activation: 'toggle',
    triggerText: 'Ligar/desligar (ação livre).',
    logicText: 'Enquanto ativa: inimigo a 3m TR Fort ou sofre Xd6/d8/d10 (X=AU) energético.',
  },
  {
    id: 'aura_macabra',
    name: 'Aura Macabra',
    flavor: 'Maldita e vil, sua aura perturba os afetados.',
    mechanic: 'Passiva a 1,5m: criatura agressiva TR Vontade ou fica Abalada. Liga/desliga (1 PE upkeep) para expandir a 4,5m. AU 3+: aplica Amedrontado em vez de Abalado.',
    activation: 'toggle',
    peCost: 1,
    peUpkeep: 1,
    triggerText: 'Passiva 1,5m sempre; ligar p/ expandir a 4,5m (1 PE/r).',
    logicText: 'Inimigo no raio TR Vontade ou Abalado/Amedrontado (AU 3+).',
  },
  {
    id: 'absorcao_elemental',
    name: 'Absorção Elemental',
    flavor: 'Aura pronta para absorver e armazenar elementos, liberando-os em ataques.',
    mechanic: 'Reação ao receber dano elemental: absorve uma parte (não reduz). No próximo ataque, +Xd6 do mesmo tipo, X = AU. AU 3: d8; AU 5: d10. Não cumulativo. [Pré-Requisito: Aura Elemental]',
    prereqs: { requiresAuraIds: ['aura_elemental'] },
    prerequisitesText: 'Aura Elemental',
    activation: 'reaction',
  },
  {
    id: 'aura_elemental',
    name: 'Aura Elemental',
    flavor: 'Você converte sua aura, imbuindo-a com um elemento.',
    mechanic: 'Escolha um tipo elemental. Seus ataques (não-técnica) causam +1d4 desse tipo. AU 2: 1d6; AU 3: 1d8; AU 5: 1d10. Ação livre para desativar. [Pré-Requisito: Nível 6]',
    prereqs: { minLevel: 6 },
    prerequisitesText: 'Nível 6',
    activation: 'toggle',
    triggerText: 'Liga/desliga (ação livre).',
    logicText: 'Substitui tipo de dano e adiciona dado elemental.',
  },
  {
    id: 'aura_elemental_reforcada',
    name: 'Aura Elemental Reforçada',
    flavor: 'Você reforça sua familiaridade com o elemento da aura.',
    mechanic: 'RD ao tipo de dano da aura elemental igual à redução de Aura Reforçada + AU. [Pré-Requisito: Aura Elemental e Aura Reforçada]',
    prereqs: { requiresAuraIds: ['aura_elemental', 'aura_reforcada'] },
    prerequisitesText: 'Aura Elemental + Aura Reforçada',
    activation: 'passive',
  },
  {
    id: 'aura_anuladora',
    name: 'Aura Anuladora',
    flavor: 'Sua aura ganha propriedade anuladora, protegendo-o de certos efeitos.',
    mechanic: 'Quantidade de vezes igual ao bônus de treinamento. Caso fosse sofrer condição, gasta PE para ignorar: fraca 2 PE; média 4 PE; forte 6 PE; extrema 10 PE. Não anula manobras/efeitos físicos. Recupera no descanso longo.',
    activation: 'reaction',
    usage: { max: 'training', scope: 'rest_long' },
    triggerText: 'Antes de aplicar uma condição em você.',
    logicText: 'Gasta PE conforme tier da condição.',
  },
  {
    id: 'aura_chamativa',
    name: 'Aura Chamativa',
    flavor: 'Cria uma aura cativante e mágica, atraindo atenção.',
    mechanic: 'Inimigos que iniciam turno em 4,5m: TR de Vontade. Em falha, ficam Enfeitiçados (refazem no próximo turno). Cada falha dá +2 acumulativo para resistir. [Pré-Requisito: Presença 18 e Nível 6]',
    prereqs: { minLevel: 6, attrMin: { PRE: 18 } },
    prerequisitesText: 'Presença 18, Nível 6',
    activation: 'passive',
  },
  {
    id: 'aura_inofensiva',
    name: 'Aura Inofensiva',
    flavor: 'Sua aura aparenta ser menor e menos intensa, dificultando ser notada.',
    mechanic: 'No início de combate, faça teste de Feitiçaria contra a Atenção dos inimigos: você fica escondido contra os que falharem. [Pré-Requisito: Presença 16]',
    prereqs: { attrMin: { PRE: 16 } },
    prerequisitesText: 'Presença 16',
    activation: 'trigger',
    triggerText: 'No início do combate.',
  },
  {
    id: 'aura_drenadora',
    name: 'Aura Drenadora',
    flavor: 'Aura vampiresca, drenando vida dos alvos abatidos.',
    mechanic: 'Sempre que matar um inimigo, recebe PV temporários igual a Xd8 + mod CON, X = AU. Acumulam. [Pré-Requisito: AU 2 e Nível 6]',
    prereqs: { minLevel: 6, minAU: 2 },
    prerequisitesText: 'AU 2, Nível 6',
    activation: 'trigger',
    triggerText: 'Ao matar um inimigo.',
  },
  {
    id: 'aura_embacada',
    name: 'Aura Embaçada',
    flavor: 'Deixa sua aura embaçada e borrada, dando chance de erros.',
    mechanic: 'Ação bônus + 2 PE para ativar; 2 PE/rodada para manter. Enquanto ativa, ataques contra você têm 20% de falhar (1-2 em 1d10). [Pré-Requisito: Nível 6]',
    prereqs: { minLevel: 6 },
    prerequisitesText: 'Nível 6',
    activation: 'bonus',
    peCost: 2,
    peUpkeep: 2,
  },
  {
    id: 'aura_do_comandante',
    name: 'Aura do Comandante',
    flavor: 'Personalidade/presença forte: estar coberto pela sua aura motiva aliados.',
    mechanic: 'Ação bônus: expande aura cobrindo aliados em 4,5m, recebem 1 + ½ AU em rolagens de dano e perícia em combate. 2 PE/rodada para manter. [Pré-Requisito: Presença 16 e Nível 8]',
    prereqs: { minLevel: 8, attrMin: { PRE: 16 } },
    prerequisitesText: 'Presença 16, Nível 8',
    activation: 'bonus',
    peUpkeep: 2,
  },
  {
    id: 'aura_excessiva',
    name: 'Aura Excessiva',
    flavor: 'Fluxo de aura excessivo, resistindo até a danos não-físicos.',
    mechanic: 'No começo da rodada, pague 2 PE para receber RD contra TODOS os tipos (exceto alma) igual à redução de Aura Reforçada. [Pré-Requisito: Aura Reforçada, Constituição 16 e Nível 8]',
    prereqs: { minLevel: 8, attrMin: { CON: 16 }, requiresAuraIds: ['aura_reforcada'] },
    prerequisitesText: 'Aura Reforçada, Constituição 16, Nível 8',
    activation: 'trigger',
    peCost: 2,
    triggerText: 'Início da sua rodada.',
  },
  {
    id: 'aura_impenetravel',
    name: 'Aura Impenetrável',
    flavor: 'Sua aura vira fortaleza impenetrável contra golpes físicos.',
    mechanic: 'Ação bônus + 3 PE: por 1 rodada, recebe resistência a DCO/DP/DI. [Pré-Requisito: Aura Reforçada, AU 3 e Nível 10]',
    prereqs: { minLevel: 10, minAU: 3, requiresAuraIds: ['aura_reforcada'] },
    prerequisitesText: 'Aura Reforçada, AU 3, Nível 10',
    activation: 'bonus',
    peCost: 3,
  },
  {
    id: 'aura_do_comandante_evoluida',
    name: 'Aura do Comandante Evoluída',
    flavor: 'Sua presença como comandante se torna ainda mais significante.',
    mechanic: 'Quando usar Aura do Comandante: pode somar AU TOTAL (em vez de ½) e conceder +2 em ataques e TRs. Custo de manutenção sobe para 4 PE. [Pré-Requisito: Aura do Comandante e Nível 12]',
    prereqs: { minLevel: 12, requiresAuraIds: ['aura_do_comandante'] },
    prerequisitesText: 'Aura do Comandante, Nível 12',
    activation: 'passive',
  },
  {
    id: 'concentrar_aura',
    name: 'Concentrar Aura',
    flavor: 'Concentra sua aura em um ponto (sua arma), trocando passivas por impacto extra.',
    mechanic: 'Ação livre: desabilita N aptidões de aura passivas por 1 rodada. Cada uma desabilitada → +1d8 energético no acerto seguinte. Limite N = 1 + AU. Não funciona em Feitiços.',
    activation: 'free',
  },
  {
    id: 'golpe_com_aura',
    name: 'Golpe com Aura',
    flavor: 'Coloca o aspecto da aura no próximo golpe, dificultando a resistência.',
    mechanic: '1 PE: imbui golpe com aptidão de aura que force TR. CD aumenta em AU. Dano (se houver) aplicado após o ataque. Não funciona em Feitiços.',
    activation: 'free',
    peCost: 1,
  },
  {
    id: 'transferencia_de_aura',
    name: 'Transferência de Aura',
    flavor: 'Transfere sua aura para outra pessoa, repassando uma aptidão.',
    mechanic: 'Ação bônus + 2 PE: escolha alvo em 9m e uma aptidão de aura para transferir por 1 rodada. Manter custa 1 PE/rodada adicional.',
    activation: 'bonus',
    peCost: 2,
    peUpkeep: 1,
  },
  {
    id: 'casulo_de_energia',
    name: 'Casulo de Energia',
    flavor: 'Aura tão densa que se torna um casulo protetivo.',
    mechanic: 'Ação comum + 6 PE: forma casulo por 1 rodada. Imunidade a DCO/DP/DI MUNDANOS (armas/quedas). Se vier de técnica: RD adicional = 2 × AU. [Pré-Requisito: Aura Impenetrável, AU 5 e Nível 16]',
    prereqs: { minLevel: 16, minAU: 5, requiresAuraIds: ['aura_impenetravel'] },
    prerequisitesText: 'Aura Impenetrável, AU 5, Nível 16',
    activation: 'action',
    peCost: 6,
  },

  // ===================================================================
  // FAMÍLIA CL — Controle e Leitura
  // ===================================================================
  {
    id: 'cl-canalizar-em-golpe',
    family: 'CL',
    name: 'Canalizar em Golpe',
    flavor: 'Você concentra energia amaldiçoada na arma ou no golpe, potencializando a destruição em troca de PE.',
    mechanic: 'Como Ação de Movimento, gaste PE (limite igual ao seu Nível de Aptidão de CL). Seu próximo ataque (não-feitiço) causa +1d6 de dano por PE gasto. Funciona apenas para um ataque; errar o ataque NÃO consome o uso.',
    prereqs: {},
    activation: 'free',
    peCost: 'variable',
    peLimitFormula: 'CL',
    triggerText: 'Ação de Movimento, antes de atacar.',
    logicText: 'Próximo ataque (não-feitiço): +1d6 por PE. Errar não consome.',
    engineSupport: 'live',
  },
  {
    id: 'cl-canalizacao-avancada',
    family: 'CL',
    name: 'Canalização Avançada',
    flavor: 'Você aperfeiçoa a canalização — mais rápida e mais poderosa.',
    mechanic: 'Pode ativar Canalizar em Golpe como Reação ao realizar um ataque. O bônus por PE passa de 1d6 para 1d8. Continua valendo apenas para um ataque e não é consumida em um erro.',
    prereqs: { minLevel: 8, minCL: 2, requiresAptitudeIds: ['cl-canalizar-em-golpe'] },
    prerequisitesText: 'Canalizar em Golpe, CL 2, Nível 8',
    activation: 'free',
    peCost: 'variable',
    peLimitFormula: 'CL',
    upgradesId: 'cl-canalizar-em-golpe',
    overrides: {
      dieSize: 'd8',
      triggerOverride: 'Ação de Movimento OU Reação ao atacar.',
    },
    logicText: 'd6→d8 por PE; ativa também como Reação ao atacar.',
    engineSupport: 'live',
  },
  {
    id: 'cl-canalizacao-maxima',
    family: 'CL',
    name: 'Canalização Máxima',
    flavor: 'O ápice da canalização: mais energia, dado superior e bônus fixo de aura.',
    mechanic: 'Você pode gastar 1 PE adicional em Canalizar em Golpe (limite passa a CL + 1). O dado por PE passa de 1d8 para 1d10. Além disso, soma seu Nível de Aptidão em AURA ao dano total da canalização.',
    prereqs: { minLevel: 16, minCL: 4, requiresAptitudeIds: ['cl-canalizacao-avancada'] },
    prerequisitesText: 'Canalização Avançada, CL 4, Nível 16',
    activation: 'free',
    peCost: 'variable',
    peLimitFormula: 'CL + 1',
    upgradesId: 'cl-canalizacao-avancada',
    overrides: {
      dieSize: 'd10',
      peLimitFormula: 'CL + 1',
      flatBonus: 'AU',
    },
    logicText: 'd10 por PE; limite CL+1; soma AU ao dano total.',
    engineSupport: 'live',
  },
  {
    id: 'cl-cobrir-se',
    family: 'CL',
    name: 'Cobrir-se',
    flavor: 'Você cobre o corpo com aura no instante do impacto, recebendo PVs temporários.',
    mechanic: 'Como Reação ao receber dano, gaste PE (limite igual a 2 + CL × 2). Para cada PE gasto você recebe 4 PVs temporários. Esses PVs são avulsos a outras fontes (não respeitam o limite normal de PVTs) e duram até o fim do turno da criatura contra a qual você usou a Reação.',
    prereqs: {},
    activation: 'reaction',
    peCost: 'variable',
    peLimitFormula: '2 + CL*2',
    triggerText: 'Reação ao receber dano.',
    logicText: 'Concede 4 PVs temporários por PE gasto (avulsos, expiram no fim do turno do atacante).',
    engineSupport: 'live',
  },
  {
    id: 'cl-cobertura-avancada',
    family: 'CL',
    name: 'Cobertura Avançada',
    flavor: 'Sua cobertura amaldiçoada se torna mais densa.',
    mechanic: 'Ao usar Cobrir-se, cada PE gasto passa a conceder 8 PVs temporários (em vez de 4).',
    prereqs: { minLevel: 10, minCL: 2, requiresAptitudeIds: ['cl-cobrir-se'] },
    prerequisitesText: 'Cobrir-se, CL 2, Nível 10',
    activation: 'reaction',
    peCost: 'variable',
    peLimitFormula: '2 + CL*2',
    upgradesId: 'cl-cobrir-se',
    overrides: {
      multiplier: 8,
    },
    logicText: 'Cobrir-se passa a 8 PVTs por PE gasto.',
    engineSupport: 'live',
  },
  {
    id: 'cl-estimulo-muscular',
    family: 'CL',
    name: 'Estímulo Muscular',
    flavor: 'Você usa a energia para estimular e reforçar o corpo, apurando força e agilidade.',
    mechanic: 'Como parte de uma ação de movimento ou de uma ação com Acrobacia/Atletismo, escolha um dos estímulos:\n• Movimento: 1 PE → distância aumentada em metade do seu deslocamento.\n• Teste (comum ou oposto): até CL PE → +1 no teste por PE gasto (dura até o início do próximo turno).\n• Empurrar/Arremessar (Desarmar/Empurrar): 2 PE → distância aumentada em CL × 1,5 m.\n• Pular: 1 PE → dobra a distância percorrida.\nCada estímulo só pode ser usado uma vez por rodada.',
    prereqs: {},
    activation: 'trigger',
    peCost: 'variable',
    peLimitFormula: 'por sub-modo',
    requiresConfig: 'choose_action_subtype',
    triggerText: 'Junto da ação de movimento ou de Acrobacia/Atletismo.',
    logicText: '4 sub-modos: Movimento (1PE), Teste (até CL PE, +1/PE), Empurrar (2PE → CL×1,5m), Pular (1PE → dobra). 1×/rodada cada.',
    engineSupport: 'live',
  },
  {
    id: 'cl-estimulo-muscular-avancado',
    family: 'CL',
    name: 'Estímulo Muscular Avançado',
    flavor: 'Seu controle para imbuir os músculos com energia se torna ainda mais apurado.',
    mechanic: 'Cada estímulo passa a poder ser usado 2× por rodada e ganha melhorias:\n• Movimento: 2 PE (em vez de 1) → distância aumentada em valor igual ao deslocamento total (em vez de metade).\n• Teste: cada PE gasto passa a somar +2 (em vez de +1).\n• Empurrar/Arremessar: a distância passa a ser CL × 3 m (em vez de CL × 1,5 m).',
    prereqs: { minLevel: 4, minCL: 3, requiresAptitudeIds: ['cl-estimulo-muscular'] },
    prerequisitesText: 'Estímulo Muscular, CL 3, Nível 4',
    activation: 'trigger',
    peCost: 'variable',
    peLimitFormula: 'por sub-modo',
    requiresConfig: 'choose_action_subtype',
    upgradesId: 'cl-estimulo-muscular',
    overrides: {
      additionalEffects: [
        '2× por rodada por sub-tipo.',
        'Movimento: 2 PE → +deslocamento total (em vez de metade).',
        'Teste: +2 por PE (em vez de +1).',
        'Empurrar/Arremessar: CL × 3 m (em vez de CL × 1,5 m).',
      ],
    },
    logicText: 'Amplia limites e efeitos dos sub-modos.',
    engineSupport: 'live',
  },
  {
    id: 'cl-expandir-aura',
    family: 'CL',
    name: 'Expandir Aura',
    flavor: 'Você libera uma descarga de energia que expande sua aura ao redor.',
    mechanic: 'Como Ação Livre no seu turno, gaste 2 PE para dobrar o alcance de todas as suas aptidões de aura PASSIVAS por uma rodada. Para cada rodada após a primeira, gaste +1 PE para mantê-la expandida.',
    prereqs: { minLevel: 6 },
    prerequisitesText: 'Nível 6',
    activation: 'free',
    peCost: 2,
    peUpkeep: 1,
    triggerText: 'Ação Livre, no seu turno.',
    logicText: 'Dobra o alcance de TODAS as aptidões de AURA passivas por 1 rodada; +1 PE/rodada para manter.',
    engineSupport: 'live',
  },
  {
    id: 'cl-leitura-de-aura',
    family: 'CL',
    name: 'Leitura de Aura',
    flavor: 'Você compreende as propriedades que a energia assume em auras e consegue lê-las.',
    mechanic: 'Ao ver uma criatura com aura amaldiçoada, faça um teste de Feitiçaria contra a CD Amaldiçoada da criatura. Em sucesso, você descobre quais são as propriedades passivas e ativas da aura dela.',
    prereqs: {},
    activation: 'action',
    requiresConfig: 'target_enemy',
    triggerText: 'Ao ver criatura com aura amaldiçoada.',
    logicText: 'Teste de Feitiçaria vs CD Amaldiçoada da criatura → revela aptidões de aura passivas e ativas.',
    engineSupport: 'live',
  },
  {
    id: 'cl-leitura-rapida-de-energia',
    family: 'CL',
    name: 'Leitura Rápida de Energia',
    flavor: 'Você lê rapidamente a aura para prever a próxima ação do inimigo, ofensiva e defensivamente.',
    mechanic: 'Como Ação de Movimento, faça um teste de Percepção (com bônus igual ao seu CL) contra a CD Amaldiçoada de uma criatura. Em sucesso, você não pode receber desvantagem nem prejuízo para acertá-la em razão de aura, e ignora aumentos de Defesa concedidos por aura, até o final da cena.',
    prereqs: {},
    activation: 'free',
    requiresConfig: 'target_enemy',
    triggerText: 'Ação de Movimento.',
    logicText: 'Percepção +CL vs CD Amaldiçoada → ignora desvantagem por aura e bônus de Defesa de aura do alvo até o fim da cena.',
    engineSupport: 'live',
  },
  {
    id: 'cl-projetar-energia',
    family: 'CL',
    name: 'Projetar Energia',
    flavor: 'Você concentra energia e a libera como um projétil explosivo.',
    mechanic: 'Como Ação Comum, gaste PE (limite igual a 1 + CL) e os transforma em um projétil. Cada PE gasto causa 1d10 de dano de força, somando o modificador do seu maior atributo ao total. Alcance: 9 m + 1,5 m × bônus de treinamento. Escolha resolver como ataque (Feitiçaria, sem crítico) OU forçar TR de Reflexos (maior atributo) — em sucesso, o dano é anulado.',
    prereqs: {},
    activation: 'action',
    peCost: 'variable',
    peLimitFormula: '1 + CL',
    requiresConfig: 'choose_attack_or_save',
    triggerText: 'Ação Comum.',
    logicText: 'PE limite = 1+CL. Dano = PE × 1d10 + mod do maior atributo. Alcance = 9 + 1,5 × treino. Ataque (Feitiçaria, sem crítico) OU TR Reflexos (anula).',
    engineSupport: 'live',
  },
  {
    id: 'cl-projecao-avancada',
    family: 'CL',
    name: 'Projeção Avançada',
    flavor: 'Você domina a projeção de energia, elevando a densidade dos seus disparos.',
    mechanic: 'O dano por PE de Projetar Energia passa de 1d10 para 2d8 e você soma o DOBRO do seu modificador ao total. Como ataque, recebe +2 para acertar; como TR, a CD aumenta em 2.',
    prereqs: { minLevel: 8, minCL: 2, requiresAptitudeIds: ['cl-projetar-energia'] },
    prerequisitesText: 'Projetar Energia, CL 2, Nível 8',
    activation: 'action',
    peCost: 'variable',
    peLimitFormula: '1 + CL',
    requiresConfig: 'choose_attack_or_save',
    upgradesId: 'cl-projetar-energia',
    overrides: {
      dieSize: '2d8',
      multiplier: 2,
      flatBonus: '+2 Acerto / +2 CD; soma 2× modificador',
    },
    logicText: 'Dano = PE × 2d8 + 2× mod. +2 acerto / +2 CD do TR.',
    engineSupport: 'live',
  },
  {
    id: 'cl-projecao-maxima',
    family: 'CL',
    name: 'Projeção Máxima',
    flavor: 'O ápice da projeção: projéteis devastadores, certeiros e impossíveis de evitar por completo.',
    mechanic: 'O dano por PE passa de 2d8 para 3d8. O bônus para acertar passa a ser +6 e o aumento da CD do TR passa a 4. Em sucesso no TR, o alvo sofre METADE do dano (não anula mais).',
    prereqs: { minLevel: 16, minCL: 4, requiresAptitudeIds: ['cl-projecao-avancada'] },
    prerequisitesText: 'Projeção Avançada, CL 4, Nível 16',
    activation: 'action',
    peCost: 'variable',
    peLimitFormula: '1 + CL',
    requiresConfig: 'choose_attack_or_save',
    upgradesId: 'cl-projecao-avancada',
    overrides: {
      dieSize: '3d8',
      flatBonus: '+6 Acerto / +4 CD',
      additionalEffects: [
        'Em sucesso no TR de Reflexos: alvo sofre metade do dano (não anula mais).',
      ],
    },
    logicText: 'Dano = PE × 3d8 + 2× mod. +6 acerto / +4 CD. Sucesso no TR = dano/2.',
    engineSupport: 'live',
  },
  {
    id: 'cl-projecao-dividida',
    family: 'CL',
    name: 'Projeção Dividida',
    flavor: 'Você divide o disparo de energia em dois projéteis no meio do caminho.',
    mechanic: 'Ao realizar um disparo (Projetar Energia) contra um alvo, pague até METADE do PE gasto no disparo para duplicá-lo como parte da mesma ação. A duplicata deve ter como alvo uma criatura a até 4,5 m do alvo original e causa dano equivalente à quantidade de PE pago nela (cálculo padrão de Projetar Energia). O projétil duplicado SEMPRE é resolvido por Teste de Resistência.',
    prereqs: { minLevel: 12, minCL: 3, requiresAptitudeIds: ['cl-projecao-avancada'] },
    prerequisitesText: 'Projeção Avançada, CL 3, Nível 12',
    activation: 'trigger',
    peCost: 'variable',
    peLimitFormula: 'até PE_original / 2',
    triggerText: 'Ao usar Projetar Energia.',
    logicText: 'Pague ≤ PE_original/2 para duplicar contra alvo a 4,5 m. Duplicata sempre via TR Reflexos.',
    engineSupport: 'live',
  },
  {
    id: 'cl-punho-divergente',
    family: 'CL',
    name: 'Punho Divergente',
    flavor: 'Seu impacto diverge: parte do dano chega no momento, parte chega depois.',
    mechanic: 'Ao acertar um ataque desarmado (não pode ser raio negro), você pode escolher causar apenas METADE do dano agora e guardar a outra metade para o turno seguinte. No turno seguinte, a criatura faz um TR de Fortitude (maior atributo físico). Em falha, o dano restante é causado como se o alvo tivesse vulnerabilidade. Para cada 5 pontos de dano da PRIMEIRA metade, a CD aumenta em +1.',
    prereqs: {},
    activation: 'trigger',
    peCost: 0,
    triggerText: 'Ao acertar um ataque desarmado (exceto raio negro).',
    logicText: 'Adia metade do dano. TR Fortitude no turno seguinte: falha = dano com vulnerabilidade. CD +1 a cada 5 pts da 1ª metade.',
    engineSupport: 'live',
  },
  {
    id: 'cl-emocao-da-petala-decadente',
    family: 'CL',
    name: 'Emoção da Pétala Decadente',
    flavor: 'Arte secreta dos três grandes clãs Jujutsu — uma contra-medida contra expansões de domínio.',
    mechanic: 'Como Reação a uma expansão de domínio ser ativada (ou como Ação Bônus), ative Emoção da Pétala Decadente. Enquanto ativa (Concentração), sempre que você receber um acerto garantido FÍSICO de uma expansão de domínio, gaste PE igual ao Nível de DOM da criatura que expandiu o domínio para anular o acerto garantido.\n\nUso ofensivo: se uma criatura entrar no seu alcance corpo-a-corpo (ou começar seu turno nele), como Ação Livre, gaste 5 PE para realizar um ataque corpo-a-corpo com SUCESSO GARANTIDO (sem teste). Se usar de forma ofensiva, você não pode se proteger contra acertos garantidos até o início do seu próximo turno.',
    prereqs: {
      minLevel: 5,
      minCL: 3,
      requiresAptitudeIds: ['cl-cobrir-se'],
      requiredClans: ['Zenin', 'Gojo', 'Kamo'],
    },
    prerequisitesText: 'Cobrir-se, CL 3, Nível 5, aprender de um dos Três Grandes Clãs (Zenin/Gojo/Kamo)',
    activation: 'reaction',
    peCost: 'variable',
    peLimitFormula: 'Defensivo: Nível DOM do atacante · Ofensivo: 5 PE',
    triggerText: 'Reação à expansão de domínio (defensivo) ou Ação Bônus (preparação).',
    logicText: 'Concentração. Anula acerto garantido físico de DOM gastando PE = Nível DOM do atacante. Ofensivo: 5 PE → ataque garantido em corpo-a-corpo (perde proteção contra acertos garantidos até o próximo turno).',
    engineSupport: 'live',
  },
  {
    id: 'cl-rastreio-avancado',
    family: 'CL',
    name: 'Rastreio Avançado',
    flavor: 'Você refina e amplia sua capacidade de detectar e rastrear energia amaldiçoada.',
    mechanic: 'Em uma cena onde energia amaldiçoada foi usada ou deixada (feitiços, aptidões, presença de maldições), você detecta os vestígios IMEDIATAMENTE. Se já conhece a origem, identifica na hora; se não, faça um teste de Investigação ou Percepção contra a CD Amaldiçoada do originador. Em sucesso, você descobre as características da energia (humano ou maldição, período aproximado, etc.) e segue o rastro até onde ele acaba.',
    prereqs: {},
    activation: 'passive',
    peCost: 0,
    triggerText: 'Em cena com vestígios de energia amaldiçoada.',
    logicText: 'Detecta vestígios automaticamente. Conhecidos = identifica na hora. Desconhecidos = teste Investigação/Percepção vs CD Amaldiçoada para identificar e seguir o rastro.',
    engineSupport: 'live',
  },

  // ============================================================
  // FAMÍLIA BAR — Aptidões de Barreira
  // ============================================================
  {
    id: 'bar-tecnicas-de-barreira',
    family: 'BAR',
    name: 'Técnicas de Barreira',
    flavor: 'Erga e manipule barreiras para defender ou prender oponentes.',
    mechanic: 'Como Ação Comum, você cria até 6 paredes ao seu redor, cada uma custando 1 PE. Cada parede tem 1,5 m de comprimento e Vida igual a 10 + 10 × seu Nível de Aptidão em Barreira.\n\nElas servem como obstáculo OU como meio de prender inimigos. Você pode manipulá-las e movê-las usando outra Ação Comum.',
    prereqs: { minBAR: 1 },
    prerequisitesText: 'BAR 1',
    activation: 'action',
    peCost: 'variable',
    peLimitFormula: '6 (1 PE por parede)',
    triggerText: 'Ação Comum (1 PE por parede, máx. 6).',
    logicText: 'Custo = paredes × 1 PE. HP por parede = 10 + 10×BAR (ou 10×BAR + 10×BAR = 20×BAR com Paredes Resistentes). Tamanho 1,5 m. Manipular/mover usa outra Ação Comum (ou Bônus com Barreira Rápida).',
    engineSupport: 'live',
  },
  {
    id: 'bar-paredes-resistentes',
    family: 'BAR',
    name: 'Paredes Resistentes',
    flavor: 'A vida BASE de cada parede passa a escalar com seu Nível de BAR.',
    mechanic: 'A vida BASE de cada parede que você confecciona passa a ser 10 multiplicado pelo seu Nível de Aptidão em Barreiras (substituindo o "10" fixo). Combinado com o bônus original (+10 × BAR), cada parede passa a ter 20 × BAR de Vida.',
    prereqs: { minLevel: 4, minBAR: 2, requiresAptitudeIds: ['bar-tecnicas-de-barreira'] },
    prerequisitesText: 'Técnicas de Barreira, BAR 2, Nível 4',
    activation: 'passive',
    upgradesId: 'bar-tecnicas-de-barreira',
    overrides: { additionalEffects: ['Vida base = 10 × BAR (substitui o 10 fixo) → HP total = 20 × BAR'] },
    triggerText: 'Passiva.',
    logicText: 'wallHpFormula: 20 × BAR (vida base 10×BAR substitui o "10" fixo, somado ao bônus 10×BAR original).',
    engineSupport: 'live',
  },
  {
    id: 'bar-barreira-rapida',
    family: 'BAR',
    name: 'Barreira Rápida',
    flavor: 'Erguer ou manipular barreiras vira Ação Bônus.',
    mechanic: 'Com treino e repetição, você ergue ou manipula barreiras de maneira mais ágil. Erguer ou manipular barreiras passa de Ação Comum para Ação Bônus.',
    prereqs: { minLevel: 6, minBAR: 3, requiresAptitudeIds: ['bar-tecnicas-de-barreira'] },
    prerequisitesText: 'Técnicas de Barreira, BAR 3, Nível 6',
    activation: 'passive',
    upgradesId: 'bar-tecnicas-de-barreira',
    overrides: { additionalEffects: ['Erguer/manipular barreiras: Ação Comum → Ação Bônus'] },
    triggerText: 'Passiva.',
    logicText: 'actionCost: bonus. Aplica-se tanto à criação quanto à manipulação/movimento de barreiras existentes.',
    engineSupport: 'live',
  },
  {
    id: 'bar-cesta-oca-de-vime',
    family: 'BAR',
    name: 'Cesta Oca de Vime',
    flavor: 'Antiga técnica esotérica anti-domínio, anterior ao Domínio Simples.',
    mechanic: 'Como Ação Bônus OU Reação a uma Expansão de Domínio, gaste 3 PE para criar um trançado de vime ao seu redor.\n\nEnquanto ativa, você NÃO é afetado pelo efeito de Acerto Garantido de uma Expansão de Domínio.\n\nUsa CONCENTRAÇÃO. Possui Durabilidade igual ao seu Nível de BAR + 1.\n• Sempre que falhar em um teste de Concentração: -1 Durabilidade.\n• No início do seu turno, se você DEVERIA ter sido atingido por Acerto Garantido: -1 Durabilidade.\n• No início do seu turno, você pode MANTER O SELO ocupando suas DUAS MÃOS: enquanto mantido, a Cesta NÃO perde durabilidade por nada além de falhas de Concentração.\n\nSe a Durabilidade chegar a 0, a Cesta quebra e você recebe o Acerto Garantido instantaneamente.',
    prereqs: { minLevel: 5, minBAR: 1, requiredSkillMastery: ['História'] },
    prerequisitesText: 'Mestre em História (ou ser de uma época onde era utilizada), BAR 1, Nível 5',
    activation: 'bonus',
    peCost: 3,
    triggerText: 'Ação Bônus OU Reação a Expansão de Domínio. Exige Concentração.',
    logicText: 'Flag omniFlags.cesta_oca_durabilidade = BAR + 1. Imuniza contra Acerto Garantido enquanto >0. Decremento: falha de Concentração; ou início do turno sob Acerto Garantido (a menos que esteja mantendo o selo com 2 mãos). Quebra → recebe Acerto Garantido.',
    engineSupport: 'live',
  },
  {
    id: 'bar-cortina',
    family: 'BAR',
    name: 'Cortina',
    flavor: 'Campo de força negro que isola uma área e impede que o exterior veja o interior.',
    mechanic: 'Técnica de barreira comum: um grande campo de força negro que isola uma área específica, impossibilitando pessoas de FORA de ver seu interior. Funcionamento básico: ocultamento.\n\nAo criar uma cortina, gaste 1 PE para cada 4,5 metros que a área dela cobrirá. NÃO há custo para mantê-la.\n\nVocê pode colocar CONDIÇÕES na cortina (ao criá-la) que expandem sua utilidade, conforme as regras sobre cortinas.',
    prereqs: { requiresAptitudeIds: ['bar-tecnicas-de-barreira'] },
    prerequisitesText: 'Técnicas de Barreira',
    activation: 'action',
    peCost: 'variable',
    peLimitFormula: '1 PE por 4,5 m de área',
    triggerText: 'Ação Comum / preparação narrativa.',
    logicText: 'Custo = ceil(areaM / 4.5) PE. Sem upkeep. Funcionamento básico: ocultamento (de fora). Condições adicionais conforme Guia de Cortinas (impactam o uso, não o custo).',
    engineSupport: 'live',
  },

  // ============================================================
  // FAMÍLIA DOM — Aptidões de Domínio
  // ============================================================
  {
    id: 'dom-revestimento-de-dominio',
    family: 'DOM',
    name: 'Revestimento de Domínio',
    flavor: 'Cobre-se com um domínio fino e vazio, derramando técnicas inimigas sobre seu espaço.',
    mechanic: 'Você se cobre com um domínio fino, sem nenhum Feitiço imbuído, derramando técnicas no espaço do revestimento. Como Ação Bônus — OU como Reação ao ser alvo de um Feitiço — gaste 5 PE para ativar. Para sustentar, gaste 5 PE no início de cada turno seu.\n\nEnquanto ativo:\n• Você reduz o dano de efeitos de técnicas ofensivas que te afetarem em um valor igual ao SEU NÍVEL DE PERSONAGEM. Essa redução não pode ser ignorada.\n• Se a Técnica for de nível ≤ teto(DOM ÷ 2), ela é COMPLETAMENTE ANULADA.\n• Seus golpes anulam qualquer efeito passivo, ativo, sustentado ou duradouro proveniente de Feitiço, desde que esteja dentro do nível que você consegue anular (o funcionamento básico do Feitiço conta como Nível 1).\n\nNÃO SE APLICA a Feitiços que afetem diretamente a sua energia amaldiçoada (ex.: Boogie Woogie, Nulificação).\n\nEnquanto estiver ativo, VOCÊ NÃO PODE usar nem estar sob o efeito de qualquer Feitiço.',
    prereqs: { minLevel: 10, minCL: 3, minDOM: 1 },
    prerequisitesText: 'CL 3, DOM 1, Nível 10',
    activation: 'bonus',
    peCost: 5,
    peUpkeep: 5,
    triggerText: 'Ação Bônus OU Reação ao ser alvo de Feitiço. Sustentação 5 PE/turno.',
    logicText: 'Flag omniFlags.revestimento_dominio = 1. Limiar de anulação = Math.ceil(DOM/2). Redução = level do personagem (não-anulável). Não funciona contra Feitiços que afetam a energia amaldiçoada do alvo (Boogie Woogie, Nulificação). Bloqueia o usuário de usar/receber Feitiços enquanto ativo.',
    engineSupport: 'live',
  },
  {
    id: 'dom-anular-tecnica',
    family: 'DOM',
    name: 'Anular Técnica',
    flavor: 'Aprimora o Domínio Simples para anular técnicas amaldiçoadas no geral, não só expansões.',
    mechanic: 'Quando você for alvo ou submetido a um Feitiço, use sua Reação para tentar anulá-lo. Você só pode anular Feitiços de um nível que você teria acesso a usar.\n\n• Gaste uma quantidade de PE igual à que foi usada para conjurar o Feitiço.\n• Realize um teste de Feitiçaria contra a Feitiçaria de quem usou o Feitiço (teste oposto).\n• Em sucesso, o Feitiço é anulado. Se for em área, NENHUMA das criaturas submetidas sofre o efeito.\n\nLimite de usos: uma quantidade igual ao seu Nível de Aptidão em Domínio, por descanso longo.',
    prereqs: { minLevel: 8, minDOM: 3 },
    prerequisitesText: 'Domínio Simples, DOM 3, Nível 8',
    activation: 'reaction',
    peCost: 'variable',
    peLimitFormula: 'custo do Feitiço inimigo',
    usage: { max: 'dom_full', scope: 'rest_long' },
    triggerText: 'Reação ao ser alvo / submetido a um Feitiço.',
    logicText: 'usage = DOM por descanso longo. peSpent = PE gasto pelo atacante. Teste oposto: 1d20 + Feitiçaria do defensor vs 1d20 + Feitiçaria do atacante. Sucesso → Feitiço cancelado integralmente (área inclusa). Verificar acesso de nível antes (apenas Feitiços de nível que o defensor poderia conhecer).',
    engineSupport: 'live',
  },
  {
    id: 'dom-expansao-dominio-incompleta',
    family: 'DOM',
    name: 'Expansão de Domínio Incompleta',
    flavor: 'Inicia-se na parte mais complexa do Jujutsu, expandindo o domínio interno de forma incompleta.',
    mechanic: 'Como Ação Comum, com as DUAS MÃOS LIVRES, gaste 15 PE para expandir seu domínio incompleto. A área se espalha por um raio igual a 4,5 m × seu bônus de treinamento, ADAPTANDO-SE ao ambiente ao seu redor.\n\nEnquanto ativo, certos efeitos são aplicados — devem ser montados conforme o Guia de Criação de Expansões de Domínio.\n\nDuração padrão: 1 + Nível de Aptidão em Domínio rodadas.',
    prereqs: { minLevel: 8, minDOM: 1 },
    prerequisitesText: 'DOM 1, Nível 8',
    activation: 'action',
    peCost: 15,
    triggerText: 'Ação Comum (exige duas mãos livres).',
    logicText: 'Flag omniFlags.expansao_incompleta = duração. Raio = 4,5 × trainingBonus(level) m. Duração = 1 + DOM rodadas. Efeitos definidos pelo Guia de Criação. Adapta-se ao ambiente.',
    engineSupport: 'live',
  },
  {
    id: 'dom-expansao-dominio-completa',
    family: 'DOM',
    name: 'Expansão de Domínio Completa',
    flavor: 'Aperfeiçoa a expansão, fechando uma barreira esférica que prende os alvos dentro dela.',
    mechanic: 'Como Ação Comum, com as DUAS MÃOS LIVRES, gaste 20 PE para expandir seu domínio completo. Cria uma ÁREA ESFÉRICA de 9 metros, prendendo os alvos dentro.\n\nEnquanto ativo, certos efeitos são aplicados — devem ser montados conforme o Guia de Criação de Expansões de Domínio.\n\nDuração padrão: 3 + Nível de Aptidão em Domínio rodadas.',
    prereqs: { minLevel: 10, minBAR: 3, minDOM: 3, requiresAptitudeIds: ['dom-expansao-dominio-incompleta'] },
    prerequisitesText: 'Técnicas de Barreira, Exp. Incompleta, BAR 3, DOM 3, Nível 10',
    activation: 'action',
    peCost: 20,
    triggerText: 'Ação Comum (exige duas mãos livres).',
    logicText: 'Flag omniFlags.expansao_completa = duração. Área esférica de 9 m (prende alvos). Duração = 3 + DOM rodadas. Efeitos definidos pelo Guia de Criação.',
    engineSupport: 'live',
  },
  {
    id: 'dom-acerto-garantido',
    family: 'DOM',
    name: 'Acerto Garantido',
    flavor: 'O ápice das técnicas de domínio: imbui sua técnica nas barreiras, definindo uma expansão letal.',
    mechanic: 'Você pode adicionar o efeito ACERTO GARANTIDO em sua expansão de domínio — e ele NÃO conta para o máximo de efeitos, imbuindo sua técnica nas barreiras criadas. O funcionamento do Acerto Garantido deve ser elaborado conforme o Guia de Criação de Domínios.\n\nAdicionar Acerto Garantido em uma Expansão Completa AUMENTA o custo dela em +5 PE (passa para 25 PE).',
    prereqs: { minLevel: 14, minBAR: 4, minDOM: 4, requiredSkillTrained: ['Feitiçaria'], requiresAptitudeIds: ['dom-expansao-dominio-completa'] },
    prerequisitesText: 'Exp. Completa, Treinado Feitiçaria, BAR 4, DOM 4, Nível 14',
    activation: 'action',
    peCost: 25,
    upgradesId: 'dom-expansao-dominio-completa',
    overrides: { peLimitFormula: '25', additionalEffects: ['Efeito Acerto Garantido (não conta para o máximo de efeitos da expansão)', '+5 PE no custo da Expansão Completa'] },
    triggerText: 'Modificador de propriedade da Expansão Completa.',
    logicText: 'upgradesId: dom-expansao-dominio-completa. peCost = 20 + 5 = 25. Adiciona efeito "Acerto Garantido" sem ocupar slot de efeito. Funcionamento conforme Guia de Criação.',
    engineSupport: 'live',
  },
  {
    id: 'dom-expansao-dominio-sem-barreiras',
    family: 'DOM',
    name: 'Expansão de Domínio Sem Barreiras',
    flavor: 'Conter água sem recipiente. Pintura no céu sem tela. Apenas para os mais talentosos.',
    mechanic: 'Possui os MESMOS EFEITOS E CUSTO de uma Expansão Completa COM Acerto Garantido (25 PE), MAS NÃO LEVANTA BARREIRAS.\n\nEm troca, possui ALCANCE SUPERIOR para o Acerto Garantido, podendo até mesmo SUPERAR as barreiras de outras expansões de domínio, atacando-os por fora.',
    prereqs: { minLevel: 20, minBAR: 5, minDOM: 5, requiresAptitudeIds: ['dom-acerto-garantido'] },
    prerequisitesText: 'Acerto Garantido, Mestre em Feitiçaria, BAR 5, DOM 5, Nível 20',
    activation: 'action',
    peCost: 25,
    upgradesId: 'dom-acerto-garantido',
    overrides: { additionalEffects: ['Sem barreiras (não cria casulo)', 'Alcance superior do Acerto Garantido', 'Atravessa barreiras de outras expansões de domínio inimigas'] },
    triggerText: 'Ação Comum (auge do sistema).',
    logicText: 'upgradesId: dom-acerto-garantido. peCost = 25 (igual à Completa+Acerto). Sem domo físico. Alcance estendido do Acerto Garantido (atravessa barreiras de domínios inimigos).',
    engineSupport: 'live',
  },

  // ============================================================
  // FAMÍLIA ER — Aptidões de Energia Reversa
  // REGRA CORE: 1 PER = 2 PE (motor cobra dobro do tanque normal).
  // ============================================================
  {
    id: 'er-energia-reversa',
    family: 'ER',
    name: 'Energia Reversa',
    flavor: 'O pináculo do jujutsu: multiplicar negatividade até gerar luz.',
    mechanic: 'O pináculo do jujutsu. Multiplicando energia negativa, você gera energia positiva. Você gasta PER (cada 1 PER consome 2 PE do seu tanque). O máximo de PER que você pode gastar de uma vez é (1 + metade do seu Nível de ER). Como Ação Comum, cure-se em 2d6 para cada PER investido, somando seu modificador de Presença ou Sabedoria ao total. Apenas você pode ser o alvo. Nos níveis 10, 15 e 20 de personagem, a eficiência sobe e você ganha +1d6 extra grátis na rolagem para cada um desses marcos.',
    prereqs: { minLevel: 8, minCL: 3, requiredSkillTrained: ['Feitiçaria'] },
    prerequisitesText: 'Treinado em Feitiçaria, CL 3, Nível 8',
    activation: 'action',
    peCost: 'variable',
    peLimitFormula: '(1 + Math.floor(ER / 2)) PER (1 PER = 2 PE)',
    triggerText: 'Ação Comum (Cura Pessoal — Self).',
    logicText: 'Limite máximo de PER por uso = 1 + Math.floor(cursedAptitudes.ER / 2). Jogador insere PER. currentPE -= (PER_Gasto * 2). Alvo = self. Cura HP = (PER_Gasto * 2)d6 + Mod_Chave(PRE ou SAB). Bônus de nível: >=10 +1d6, >=15 +2d6, >=20 +3d6.',
    engineSupport: 'live',
  },
  {
    id: 'er-cura-amplificada',
    family: 'ER',
    name: 'Cura Amplificada',
    flavor: 'Seu cérebro processa o fluxo reverso com facilidade brutal.',
    mechanic: '(Exige Energia Reversa). O seu cérebro processa o fluxo reverso com facilidade brutal. O limite máximo de PER que você pode gastar na cura sobe, passando a ser igual a (1 + o seu Nível de ER completo). A potência da cura explode: o dado rolado passa a ser d8 e você passa a somar O DOBRO do seu modificador de Presença ou Sabedoria ao total da vida curada.',
    prereqs: { minLevel: 12, minER: 3, requiresAptitudeIds: ['er-energia-reversa'] },
    prerequisitesText: 'Energia Reversa, ER 3, Nível 12',
    activation: 'passive',
    upgradesId: 'er-energia-reversa',
    overrides: { dieSize: 'd8', multiplier: 2, peLimitFormula: '1 + cursedAptitudes.ER' },
    triggerText: 'Passiva (Upgrade).',
    logicText: 'overrides: { dieSize: "d8", multiplier: 2 (sobre Mod_Chave), peLimitFormula: "1 + cursedAptitudes.ER" }. Aumenta dado base para d8, dobra Mod_Chave somado, remove a divisão por 2 do limite de PER.',
    engineSupport: 'live',
  },
  {
    id: 'er-fluxo-constante',
    family: 'ER',
    name: 'Fluxo Constante',
    flavor: 'O fluxo contínuo preserva o corpo no automático.',
    mechanic: '(Exige Energia Reversa). O fluxo contínuo preserva o corpo no automático. O custo de ação para se curar com Energia Reversa cai drasticamente: no exato início do seu turno, você pode ativá-la como Ação Livre. Se decidir não fazer isso, você ganha a permissão de usar sua Reação para ativar a cura no milissegundo em que sua vida for reduzida por um ataque.',
    prereqs: { minLevel: 12, minER: 3, requiresAptitudeIds: ['er-energia-reversa'] },
    prerequisitesText: 'Energia Reversa, ER 3, Nível 12',
    activation: 'free',
    triggerText: 'Ação Livre (no início do turno) OU Reação (ao receber dano).',
    logicText: 'Permite conjurar "Energia Reversa" ignorando o custo de Ação Comum sob dois gatilhos: onTurnStart → Ação Livre; onReceiveDamage → Reação (cura imediatamente após a dedução do dano).',
    engineSupport: 'live',
  },
  {
    id: 'er-regeneracao-aprimorada',
    family: 'ER',
    name: 'Regeneração Aprimorada',
    flavor: 'Você conserta a estrutura óssea e celular do seu avatar.',
    mechanic: '(Exige Cura Amplificada). Você conserta a estrutura óssea e celular do seu avatar. Gaste 8 PER como Ação Comum para curar Ferimentos Complexos. Gaste 4 PER como Ação Bônus para expurgar Venenos. Se seu membro for amputado e você o segurar no lugar (menos de 1 dia do corte), gaste 3 PER como Ação Bônus para recolá-lo perfeitamente. Um detalhe vital: sempre que você regenera uma ferida ou limpa um veneno assim, você automaticamente cura sua vida usando o equivalente à metade da energia gasta. (Se você alcançar o Nível 5 máximo de ER, você pode queimar 10 PER de uma vez para realizar essa técnica inteira como Ação Livre).',
    prereqs: { minLevel: 15, minER: 4, requiresAptitudeIds: ['er-cura-amplificada'] },
    prerequisitesText: 'Cura Amplificada, ER 4, Nível 15',
    activation: 'action',
    peCost: 'variable',
    peLimitFormula: 'Ferimento 8 PER (16 PE) · Veneno 4 PER (8 PE) · Membro 3 PER (6 PE)',
    triggerText: 'Multi-Ação: Comum (Ferimento), Bônus (Veneno/Membro), Livre se ER 5 (10 PER = 20 PE).',
    logicText: 'Modos: Curar Ferimento Complexo = Ação Comum, 8 PER (16 PE). Curar Veneno = Ação Bônus, 4 PER (8 PE). Recolocar Membro Amputado (membro em mãos, < 1 dia) = Ação Bônus, 3 PER (6 PE). Override: se cursedAptitudes.ER === 5, jogador pode pagar 10 PER (20 PE) para realizar qualquer modo como Ação Livre. Side-effect: cada uso recupera HP rolando "Energia Reversa" base usando metade dos PER gastos nesta aptidão.',
    engineSupport: 'live',
  },
  {
    id: 'er-liberacao-energia-reversa',
    family: 'ER',
    name: 'Liberação de Energia Reversa',
    flavor: 'Emite energia positiva para fora do próprio corpo, alcançando aliados.',
    mechanic: '(Exige Energia Reversa). Emitir energia positiva para o ar exterior é complexo e extremamente difícil, mas você dominou. Você se torna capaz de ejetar sua técnica e curar outras criaturas e aliados utilizando a sua habilidade "Energia Reversa", desde que você encoste neles (alcance de toque).',
    prereqs: { minLevel: 10, requiresAptitudeIds: ['er-energia-reversa'] },
    prerequisitesText: 'Energia Reversa, Nível 10',
    activation: 'passive',
    upgradesId: 'er-energia-reversa',
    overrides: { additionalEffects: ['target: touch (self ou aliado adjacente)'] },
    triggerText: 'Passiva (Upgrade de Targeting).',
    logicText: 'overrides: { target: "touch" }. Altera restrição de alvo de self para permitir aliados adjacentes no grid (alcance de toque).',
    engineSupport: 'live',
  },
  {
    id: 'er-canalizar-energia-reversa',
    family: 'ER',
    name: 'Canalizar Energia Reversa',
    flavor: 'A energia positiva dissolve os corpos feitos de negatividade.',
    mechanic: '(Exige Lib. Energia Reversa e Canalizar em Golpe). A energia positiva dissolve os corpos feitos de negatividade. Como uma Ação de Movimento, invista PER (até o limite do seu bônus de treinamento) na sua arma. Seu próximo ataque físico acertado CONTRA UMA MALDIÇÃO causará massivos 2d6 de dano de energia reversa adicional para cada 1 PER gasto. Isso destrói maldições, mas não fere humanos normais. A carga não é gasta se você errar o soco/arma. (Você não pode combar isso ativando o "Canalizar em Golpe" normal ao mesmo tempo, escolha um).',
    prereqs: { requiresAptitudeIds: ['er-liberacao-energia-reversa', 'cl-canalizar-em-golpe'] },
    prerequisitesText: 'Liberação de Energia Reversa, Canalizar em Golpe',
    activation: 'bonus',
    peCost: 'variable',
    peLimitFormula: 'Bônus de Treinamento (PER) — 1 PER = 2 PE',
    triggerText: 'Ação de Movimento (carrega arma com PER).',
    logicText: 'onActivation: abre input. PER Máximo = bônus de treinamento. currentPE -= (PER_gasto * 2). Salva flag de arma carregada. onNextMeleeHit: if (target.race === "Maldição") danoTotal += (PER_gasto * 2)d6 (tipo: Energia Reversa). Carga mantida em caso de miss. Mutuamente exclusivo com "Canalizar em Golpe" normal e não funciona em magias.',
    engineSupport: 'live',
  },
  {
    id: 'er-cura-em-grupo',
    family: 'ER',
    name: 'Cura em Grupo',
    flavor: 'Projete a luz reconfortante em explosão de cura coletiva.',
    mechanic: '(Exige Liberação de Energia Reversa). Projete a luz reconfortante. Em vez de tocar e curar apenas uma pessoa, a sua cura explode em área (Raio de 4,5 metros + 1,5m para cada Nível de ER). O seu teto máximo para gastar PER sobe em +2. Ao invés de curar tudo num só alvo, você joga os dados e recebe o total da cura numa reserva. Você então divide esse valor final de HP como quiser entre as criaturas que estiverem dentro do alcance da luz.',
    prereqs: { requiresAptitudeIds: ['er-liberacao-energia-reversa'] },
    prerequisitesText: 'Liberação de Energia Reversa',
    activation: 'action',
    upgradesId: 'er-energia-reversa',
    overrides: { peLimitFormula: 'oldLimit + 2', additionalEffects: ['target: area (raio 4,5m + 1,5m * ER)', 'splitPool: jogador distribui HP curado entre alvos na área'] },
    triggerText: 'Alteração Paramétrica de Conjuração (AoE Healing).',
    logicText: 'overrides: { target: "area", peLimitFormula: "oldLimit + 2" }. Limite de PER sobe em +2. Área = raio 4,5m + (1,5m * cursedAptitudes.ER). Sistema rola HP curado total em uma pool; jogador fatia esse número e distribui livremente entre criaturas dentro da área.',
    engineSupport: 'live',
  },

  // ============================================================
  // FAMÍLIA SPECIAL — Aptidões Especiais (sem nível numérico)
  // ============================================================
  {
    id: 'special-raio-negro',
    family: 'SPECIAL',
    name: 'Raio Negro (Kokusen)',
    flavor: 'O fenômeno de distorção espacial: um soco que rasga o continuum.',
    mechanic: 'O fenômeno de distorção espacial. Após atingir seu primeiro Raio Negro, sua compreensão explode: seu Max PE aumenta num valor igual ao seu nível e você ganha +1 Ponto de AU permanentemente. Em combate, quando tirar 20 natural num ataque físico, o Kokusen é ativado: O dano total do golpe é multiplicado por 1.5x e ignora totalmente qualquer Redução de Dano (RD) ou Resistência do alvo. Após o acerto, você entra no Estado de Consciência Absoluta por 1 rodada: o valor no dado para ativar novos Kokusens diminui em 1. Se acertar de novo, a duração renova e o número desce de novo (limitado à metade do seu Nível de CL).',
    prereqs: { minLevel: 10, minCL: 3, attrMinAny: { FOR: 16, DES: 16 } },
    prerequisitesText: 'CL 3, FOR ou DES 16, Nível 10',
    activation: 'passive',
    triggerText: 'Passiva (Gatilho em Crítico Corpo-a-Corpo) e Modificador Absoluto.',
    logicText: '1. Efeito Permanente (após 1º uso): MaxPE += characterLevel (atualiza a cada Level Up); cursedAptitudes.AU += 1. 2. Gatilho Base: rolar 20 no dado de Ataque Físico. 3. Efeito Kokusen: dano total rolado * 1.5; flags ignoresRD = true e ignoresResistance = true. 4. Estado de Consciência Absoluta: após acertar, buff por 1 rodada. CritRange desce em 1 (ex: 19-20). Se outro Kokusen na rodada, tempo reseta e CritRange desce de novo (ex: 18-20). Limite de reduções = Math.floor(cursedAptitudes.CL / 2).',
    engineSupport: 'live',
  },
  {
    id: 'special-abencoado-faiscas-negras',
    family: 'SPECIAL',
    name: 'Abençoado pelas Faíscas Negras',
    flavor: 'As faíscas te amam: o Kokusen deixa de ser milagre e vira rotina.',
    mechanic: '(Exige Raio Negro). As faíscas te amam. O Kokusen deixa de ser um milagre: você passa a ativá-lo por padrão rolando 19 ou 20 no dado. O limite que você pode descer essa margem durante a Consciência Absoluta ganha +1 extra. Além disso, depois de encaixar um Raio Negro com sucesso, você fica bufado pelo resto da cena inteira: soma metade do seu CL em Acertos e o seu CL total nas Rolagens de Dano.',
    prereqs: { minLevel: 15, minCL: 4, minAU: 3, requiresAptitudeIds: ['special-raio-negro'] },
    prerequisitesText: 'Raio Negro, CL 4, AU 3, Nível 15',
    activation: 'passive',
    upgradesId: 'special-raio-negro',
    overrides: { additionalEffects: ['critRangeBase: 19-20', 'maxConsciousReductions += 1', 'sceneBuff: hit += floor(CL/2), damage += CL'] },
    triggerText: 'Passiva.',
    logicText: 'overrides: { critRangeBase: "19-20" }. Margem base para engatilhar Kokusen passa a ser 19 e 20. Limite máximo de reduções na Consciência Absoluta ganha +1 fixo. Buff Pós-Kokusen (cena inteira): AttackBonus += Math.floor(cursedAptitudes.CL / 2); DamageBonus += cursedAptitudes.CL.',
    engineSupport: 'live',
  },
  {
    id: 'special-dominio-simples',
    family: 'SPECIAL',
    name: 'Domínio Simples',
    flavor: 'O Domínio dos Fracos: um círculo no chão que protege contra o Acerto Garantido.',
    mechanic: 'O Domínio dos Fracos. Como Ação Bônus (ou Reação a um domínio de Chefe), pague 5 PE para abrir um círculo no chão. O Raio é igual a 1,5m (+ 1,5m por nível de DOM). Você e todos dentro dessa área estão imunes ao Acerto Garantido do inimigo. O domínio tem Durabilidade igual ao seu nível de BAR + 1. Se você falhar na Concentração, ou se o Acerto Garantido ficar batendo nele no início do seu turno, ele perde 1 de Durabilidade. O terror é que: para cada 1 de durabilidade perdida, o raio do círculo encolhe 1,5 metros (podendo deixar aliados para fora). Se a área zerar ou a durabilidade zerar, o círculo estilhaça e a morte os atinge.',
    prereqs: { minLevel: 5, minBAR: 1 },
    prerequisitesText: 'BAR 1, Nível 5',
    activation: 'bonus',
    peCost: 5,
    triggerText: 'Ação Bônus OU Reação a Expansão de Domínio. (Exige Concentração).',
    logicText: 'currentPE -= 5. Área (Raio) = 1.5m + (cursedAptitudes.DOM * 1.5m). Buff global na área: immuneToDomainAutoHit = true e Imunidade a Efeitos de Ambiente. Durability = cursedAptitudes.BAR + 1. Dano à Barreira: onConcentrationFail → Durability -= 1; onTurnStart sob Acerto Garantido → Durability -= 1. Degradação Física: para CADA ponto de Durabilidade perdido, o Raio diminui 1,5m. Quebra: se Durability === 0 OU Radius === 0, o domínio explode e o Acerto Garantido inimigo acerta a todos instantaneamente.',
    engineSupport: 'live',
  },
  {
    id: 'special-reversao-de-tecnica',
    family: 'SPECIAL',
    name: 'Reversão de Técnica',
    flavor: 'Injete energia positiva no motor negativo da sua técnica.',
    mechanic: 'Injetando energia positiva no motor negativo da sua técnica. Ao comprar essa aptidão, você ganha o direito de criar "Feitiços de Reversão" (magias que fazem exatamente o oposto do conceito base do seu poder, ex: Se a técnica atrai, a reversão repele). Você recebe 1 Feitiço novo extra de graça agora, que obrigatoriamente deve ser uma Reversão. O custo de todo feitiço de reversão aumenta num valor igual ao nível daquele feitiço.',
    prereqs: { minLevel: 12, minER: 1 },
    prerequisitesText: 'ER, Nível 12',
    activation: 'passive',
    triggerText: 'Meta-Habilidade (Catálogo de Magias).',
    logicText: 'onPurchase: atribui à ficha a tag canCreateReversals = true. Injeta 1 Feitiço extra gratuito com a flag isReversal: true. Regra do Feitiço de Reversão: PE_Cost base sofre acréscimo obrigatório de + spellLevel.',
    engineSupport: 'live',
  },
  {
    id: 'special-tecnica-maxima',
    family: 'SPECIAL',
    name: 'Técnica Máxima',
    flavor: 'A Arte Suprema: sua Ultimate, com cooldown severo.',
    mechanic: 'A Arte Suprema. Você libera o direito de inventar e cadastrar a sua Técnica Máxima. Diferente dos feitiços comuns, a Máxima custa 25 PE secos para ser conjurada. O poder é descomunal, mas após atirar essa habilidade devastadora, ela entra em tempo de recarga severo, ficando bloqueada por um número de rodadas igual a (6 - metade do seu bônus de treinamento).',
    prereqs: { minLevel: 7, requiredSkillMastery: ['Feitiçaria'] },
    prerequisitesText: 'Mestre em Feitiçaria, Capacidade de Conjurar Feitiços Nível 4',
    activation: 'action',
    peCost: 25,
    triggerText: 'Criação de Ultimate.',
    logicText: 'onPurchase: libera Slot Especial de "Técnica Máxima" na ficha. peCost imutável = 25. Recarga Pós-Cast: Cooldown_Turns = 6 - Math.floor(Treinamento / 2). O feitiço entra em estado disabled até passarem o número exato de turnos na engine.',
    engineSupport: 'live',
  },

  // ============================================================
  // FAMÍLIA CURSED — Aptidões Amaldiçoadas Exclusivas (Maldições)
  // Disponíveis para personagens da classe Maldição. Podem também
  // escolher aptidões do catálogo padrão (exceto Energia Reversa).
  // ============================================================

  // ----- ANATOMIA -----
  {
    id: 'cursed-composicao-elemental',
    family: 'CURSED',
    subfamily: 'anatomy',
    name: 'Composição Elemental',
    flavor: 'Você é composto por um elemento, que dita sua própria existência.',
    mechanic: 'Ao obter esta aptidão, escolha um tipo de dano elemental para ser composto de: você recebe imunidade ao tipo de dano escolhido, além de poder o causar em ataques desarmados ou com arma. [Pré-Requisito: Nível 4]',
    prereqs: { minLevel: 4 },
    prerequisitesText: 'Nível 4',
    activation: 'passive',
    triggerText: 'Sempre ativa.',
    logicText: 'Pede ao jogador o tipo de dano elemental (Fogo/Frio/Elétrico/Ácido/Trovejante/Radiante/Necrótico/Psíquico/Energia). Adiciona à lista de imunidades. Ataques desarmados e com arma podem causar o tipo escolhido.',
    requiresConfig: 'choose_attack_or_save',
    engineSupport: 'manual',
  },
  {
    id: 'cursed-absorcao-elemental',
    family: 'CURSED',
    subfamily: 'anatomy',
    name: 'Absorção Elemental',
    flavor: 'Você absorve o elemento que o compõe para se revigorar.',
    mechanic: 'Ao receber dano do seu elemento escolhido em Composição Elemental, você pode utilizar sua reação para receber pontos de vida temporários igual a metade do dano recebido. [Pré-Requisito: Nível 8, Composição Elemental]',
    prereqs: { minLevel: 8, requiresAptitudeIds: ['cursed-composicao-elemental'] },
    prerequisitesText: 'Composição Elemental, Nível 8',
    activation: 'reaction',
    triggerText: 'Reação ao receber dano do elemento escolhido.',
    logicText: 'onDamageReceived[matchesElement] → tempHP += floor(damageAmount / 2). Consome reaction.',
    engineSupport: 'manual',
  },
  {
    id: 'cursed-armas-naturais',
    family: 'CURSED',
    subfamily: 'anatomy',
    name: 'Armas Naturais',
    flavor: 'Sua anatomia desenvolveu armas naturais para o combate.',
    mechanic: 'Sua arma natural tem um formato a sua escolha, e causa 1d6 de dano, de um dos 3 tipos físicos a sua escolha. Você pode utilizar tanto Força quanto Destreza com a sua arma natural. Nv 5: 1d8. Nv 10: 1d10. Nv 15: 2d6. Nv 20: 2d8.',
    activation: 'passive',
    triggerText: 'Passiva (concede arma natural).',
    logicText: 'Pede formato/visual e tipo de dano físico (DCO/DP/DI). Dado escala com nível: 1d6 (1-4), 1d8 (5-9), 1d10 (10-14), 2d6 (15-19), 2d8 (20). Acerto/dano: FOR ou DES (jogador escolhe).',
    requiresConfig: 'choose_action_subtype',
    engineSupport: 'manual',
  },
  {
    id: 'cursed-armas-naturais-aprimoradas',
    family: 'CURSED',
    subfamily: 'anatomy',
    name: 'Armas Naturais Aprimoradas',
    flavor: 'Seu corpo evolui e aprimora suas armas naturais a um patamar superior.',
    mechanic: 'O dano das armas naturais passa a 1d10 no Nv 5; 2d6 no Nv 10; 2d10 no Nv 15 e 3d10 no Nv 20. Além disso, você recebe +1 em acerto e dano para ataques com elas, aumentando em +1 nos níveis 10, 15 e 20. [Pré-Requisito: Nível 5, Armas Naturais]',
    prereqs: { minLevel: 5, requiresAptitudeIds: ['cursed-armas-naturais'] },
    prerequisitesText: 'Armas Naturais, Nível 5',
    activation: 'passive',
    upgradesId: 'cursed-armas-naturais',
    overrides: { additionalEffects: ['dado: 1d10/2d6/2d10/3d10 (Nv 5/10/15/20)', '+1 acerto/dano (+1 extra em 10/15/20)'] },
    triggerText: 'Passiva (Upgrade).',
    logicText: 'Substitui escala da Armas Naturais. Soma bônus de acerto/dano: +1 base, +1 por marco (Nv 10/15/20).',
    engineSupport: 'manual',
  },
  {
    id: 'cursed-crescimento-corporal',
    family: 'CURSED',
    subfamily: 'anatomy',
    name: 'Crescimento Corporal',
    flavor: 'Seu corpo cresce de maneira exacerbada.',
    mechanic: 'Aumenta uma categoria de tamanho. A partir do Nv 10 você pode obter esta aptidão outra vez, até a categoria máxima de Enorme. [Pré-Requisito: Nível 5]',
    prereqs: { minLevel: 5 },
    prerequisitesText: 'Nível 5',
    activation: 'passive',
    triggerText: 'Passiva.',
    logicText: 'sizeCategory += 1 (cap Enorme). Repetível: 2ª compra requer Nv 10.',
    engineSupport: 'manual',
  },
  {
    id: 'cursed-desenvolvimento-fisico',
    family: 'CURSED',
    subfamily: 'anatomy',
    name: 'Desenvolvimento Físico',
    flavor: 'A própria energia fortalece o seu corpo a um patamar superior.',
    mechanic: 'Um atributo físico (FOR/DES/CON) a sua escolha aumenta em 2. A cada 4 níveis você pode pegá-la novamente, mas o aumento será de +1 ao invés de +2. [Pré-Requisito: Nível 4]',
    prereqs: { minLevel: 4 },
    prerequisitesText: 'Nível 4',
    activation: 'passive',
    triggerText: 'Passiva.',
    logicText: 'Solicita escolha (FOR/DES/CON). 1ª compra: +2 (pode estourar cap em +1). Compras seguintes (a cada 4 níveis): +1.',
    engineSupport: 'manual',
  },
  {
    id: 'cursed-olhos-adicionais',
    family: 'CURSED',
    subfamily: 'anatomy',
    name: 'Olhos Adicionais',
    flavor: 'Olhos extras surgem em seu corpo, apurando sua visão.',
    mechanic: 'Você recebe +2 em Percepção, aumentando em +1 nos níveis 5, 10, 15 e 20; sua atenção passiva passa a ter base 12 ao invés de 10.',
    activation: 'passive',
    triggerText: 'Sempre ativa.',
    logicText: 'skills.Percepção.externalBonus += 2 + (Nv≥5)+(Nv≥10)+(Nv≥15)+(Nv≥20). attentionBase = 12.',
    engineSupport: 'live',
  },
  {
    id: 'cursed-revestimento',
    family: 'CURSED',
    subfamily: 'anatomy',
    name: 'Revestimento',
    flavor: 'Um revestimento corporal te protege contra danos físicos.',
    mechanic: 'Você recebe RD a danos físicos (DCO/DP/DI) igual ao seu modificador de Constituição. [Pré-Requisito: Nível 4, Constituição 14]',
    prereqs: { minLevel: 4, attrMin: { CON: 14 } },
    prerequisitesText: 'Constituição 14, Nível 4',
    activation: 'passive',
    triggerText: 'Sempre ativa.',
    logicText: 'rdByType.DCO/DP/DI += modCON (mínimo 0).',
    engineSupport: 'live',
  },
  {
    id: 'cursed-revestimento-evoluido',
    family: 'CURSED',
    subfamily: 'anatomy',
    name: 'Revestimento Evoluído',
    flavor: 'O revestimento evolui, dobrando suas capacidades defensivas.',
    mechanic: 'A RD a danos físicos passa a ser o dobro do seu modificador de Constituição. [Pré-Requisito: Nível 10, Constituição 20]',
    prereqs: { minLevel: 10, attrMin: { CON: 20 }, requiresAptitudeIds: ['cursed-revestimento'] },
    prerequisitesText: 'Revestimento, Constituição 20, Nível 10',
    activation: 'passive',
    upgradesId: 'cursed-revestimento',
    overrides: { multiplier: 2 },
    triggerText: 'Passiva (Upgrade).',
    logicText: 'rdByType.DCO/DP/DI += 2 × modCON (substitui o efeito base).',
    engineSupport: 'live',
  },
  {
    id: 'cursed-superioridade-fisica',
    family: 'CURSED',
    subfamily: 'anatomy',
    name: 'Superioridade Física',
    flavor: 'Seu corpo é naturalmente superior em combate marcial.',
    mechanic: '+2 em Atletismo e Acrobacia, aumentando em +1 nos níveis 10, 15 e 20. Uma vez por rodada, pague 2 PE para receber vantagem em uma rolagem de manobra (agarrar, empurrar, etc.). [Pré-Requisito: Nível 5, Maestria em Luta]',
    prereqs: { minLevel: 5, requiredSkillMastery: ['Luta'] },
    prerequisitesText: 'Maestria em Luta, Nível 5',
    activation: 'passive',
    triggerText: 'Passiva + Ação Livre (1/rodada, gasto de PE).',
    logicText: 'skills.Atletismo/Acrobacia.externalBonus += 2 + (Nv≥10)+(Nv≥15)+(Nv≥20). Botão: -2 PE → vantagem em próxima rolagem de manobra (1/rodada).',
    engineSupport: 'live',
  },

  // ----- CONTROLE E LEITURA -----
  {
    id: 'cursed-absorcao-amaldicoada',
    family: 'CURSED',
    subfamily: 'control',
    name: 'Absorção Amaldiçoada',
    flavor: 'Você absorve vestígios de energia deixados pelos usuários.',
    mechanic: 'Ao matar um usuário de energia, você recupera uma quantidade de energia igual ao seu bônus de maestria. [Pré-Requisito: Maestria em Feitiçaria]',
    prereqs: { requiredSkillMastery: ['Feitiçaria'] },
    prerequisitesText: 'Maestria em Feitiçaria',
    activation: 'trigger',
    triggerText: 'Gatilho ao matar um usuário de energia.',
    logicText: 'onKill[target.isCursedEnergyUser] → currentPE += masteryBonus (cap em maxPE).',
    engineSupport: 'manual',
  },
  {
    id: 'cursed-estoque-ampliado',
    family: 'CURSED',
    subfamily: 'control',
    name: 'Estoque Ampliado',
    flavor: 'Sua conexão íntima com a energia amplia o seu estoque.',
    mechanic: 'Seu máximo de energia amaldiçoada aumenta em um valor igual ao seu bônus de maestria. [Pré-Requisito: Nível 10]',
    prereqs: { minLevel: 10 },
    prerequisitesText: 'Nível 10',
    activation: 'passive',
    triggerText: 'Sempre ativa.',
    logicText: 'maxPE += masteryBonus. Idempotente via snapshot.',
    engineSupport: 'live',
  },
  {
    id: 'cursed-extracao-potencial',
    family: 'CURSED',
    subfamily: 'control',
    name: 'Extração de Potencial',
    flavor: 'Você extrai o seu potencial natural de manipulação da energia.',
    mechanic: 'Caso não possua, você recebe Maestria em Feitiçaria; caso possua, torna-se Especialista. Além disso, você recebe uma habilidade de técnica adicional, recebendo mais uma no nível 10. [Pré-Requisito: Nível 5]',
    prereqs: { minLevel: 5 },
    prerequisitesText: 'Nível 5',
    activation: 'passive',
    triggerText: 'Passiva (Upgrade de proficiência).',
    logicText: 'Se ¬Maestria(Feitiçaria) → grant Maestria. Senão → grant Especialista. +1 habilidade de técnica (Nv 5); +1 adicional ao atingir Nv 10.',
    engineSupport: 'manual',
  },
  {
    id: 'cursed-protecao-constante',
    family: 'CURSED',
    subfamily: 'control',
    name: 'Proteção Constante',
    flavor: 'O fluxo constante gera uma proteção persistente para o seu corpo.',
    mechanic: 'No começo de toda rodada você recebe pontos de vida temporários igual ao seu modificador de Constituição multiplicado pelo seu bônus de maestria. [Pré-Requisito: Nível 10, Constituição 20]',
    prereqs: { minLevel: 10, attrMin: { CON: 20 } },
    prerequisitesText: 'Constituição 20, Nível 10',
    activation: 'trigger',
    triggerText: 'No início de cada rodada.',
    logicText: 'onRoundStart[self] → tempHP = max(tempHP, modCON × masteryBonus).',
    engineSupport: 'manual',
  },

  // ----- ESPECIAIS -----
  {
    id: 'cursed-regeneracao-corporal',
    family: 'CURSED',
    subfamily: 'special',
    name: 'Regeneração Corporal',
    flavor: 'Você converte energia pura em regeneração corporal.',
    mechanic: 'Como Ação Comum, gaste até 4 PE para se curar; para cada 2 PE gastos, cura 1d6 + modificador de Constituição ou Carisma. Nos níveis 5, 10, 15 e 20 a cura aumenta em 1d6. Apenas você pode ser alvo.',
    activation: 'action',
    peCost: 'variable',
    peLimitFormula: 'até 4 PE (2 PE = 1d6 + mod CON ou CAR)',
    triggerText: 'Ação Comum (auto-cura).',
    logicText: 'currentPE -= peSpent (≤4, múltiplo de 2). dadosBase = peSpent/2. dadosExtra = (Nv≥5)+(Nv≥10)+(Nv≥15)+(Nv≥20). HP += rolar (dadosBase + dadosExtra)d6 + mod(CON ou CAR). Target = self.',
    engineSupport: 'manual',
  },
  {
    id: 'cursed-regeneracao-ampliada',
    family: 'CURSED',
    subfamily: 'special',
    name: 'Regeneração Ampliada',
    flavor: 'Sua capacidade regenerativa foi grandemente ampliada.',
    mechanic: 'O dado de cura da Regeneração Corporal passa a d8, e você soma o dobro do modificador de Constituição ou Carisma. A quantidade máxima de PE gastos passa a ser igual ao dobro do seu bônus de maestria. [Pré-Requisito: Nível 10, Regeneração Corporal]',
    prereqs: { minLevel: 10, requiresAptitudeIds: ['cursed-regeneracao-corporal'] },
    prerequisitesText: 'Regeneração Corporal, Nível 10',
    activation: 'passive',
    upgradesId: 'cursed-regeneracao-corporal',
    overrides: { dieSize: 'd8', multiplier: 2, peLimitFormula: '2 × bônus de maestria' },
    triggerText: 'Passiva (Upgrade).',
    logicText: 'Dado de cura → d8. Soma 2 × mod(CON ou CAR). peLimit = 2 × masteryBonus.',
    engineSupport: 'manual',
  },
  {
    id: 'cursed-regeneracao-maxima',
    family: 'CURSED',
    subfamily: 'special',
    name: 'Regeneração Máxima',
    flavor: 'A facilidade regenerativa das maldições atinge seu auge em você.',
    mechanic: 'O dado de cura passa a d10. A quantidade máxima de PE gastos aumenta em 2. [Pré-Requisito: Nível 16, Regeneração Ampliada]',
    prereqs: { minLevel: 16, requiresAptitudeIds: ['cursed-regeneracao-ampliada'] },
    prerequisitesText: 'Regeneração Ampliada, Nível 16',
    activation: 'passive',
    upgradesId: 'cursed-regeneracao-ampliada',
    overrides: { dieSize: 'd10', additionalEffects: ['peLimit += 2'] },
    triggerText: 'Passiva (Upgrade).',
    logicText: 'Dado de cura → d10. peLimit += 2.',
    engineSupport: 'manual',
  },
  {
    id: 'cursed-regeneracao-membros',
    family: 'CURSED',
    subfamily: 'special',
    name: 'Regeneração de Membros',
    flavor: 'Você regenera membros e feridas internas com facilidade.',
    mechanic: 'Como Ação Comum, gaste 12 PE para regenerar um membro perdido ou ferida interna. [Pré-Requisito: Nível 12, Regeneração Ampliada]',
    prereqs: { minLevel: 12, requiresAptitudeIds: ['cursed-regeneracao-ampliada'] },
    prerequisitesText: 'Regeneração Ampliada, Nível 12',
    activation: 'action',
    peCost: 12,
    triggerText: 'Ação Comum.',
    logicText: 'currentPE -= 12. Remove condição de membro perdido / ferida interna. Apenas em self.',
    engineSupport: 'manual',
  },
  {
    id: 'cursed-fluxo-imparavel',
    family: 'CURSED',
    subfamily: 'special',
    name: 'Fluxo Imparável',
    flavor: 'A energia flui sem cessar, e sua regeneração é quase imparável.',
    mechanic: 'No começo do seu turno, você pode se curar com Regeneração Corporal como ação livre. Caso não o faça, pode se curar como reação ao ter sua vida reduzida. [Pré-Requisito: Nível 12, Regeneração Corporal]',
    prereqs: { minLevel: 12, requiresAptitudeIds: ['cursed-regeneracao-corporal'] },
    prerequisitesText: 'Regeneração Corporal, Nível 12',
    activation: 'free',
    triggerText: 'Ação Livre (início do turno) OU Reação (ao ter vida reduzida).',
    logicText: 'onTurnStart → permite ativar Regeneração Corporal como Livre. Senão, onHPReduced → permite ativar como Reação.',
    engineSupport: 'manual',
  },
  {
    id: 'cursed-area-dominio',
    family: 'CURSED',
    subfamily: 'special',
    name: 'Área de Domínio',
    flavor: 'Você se versa em uma das áreas amaldiçoadas, tornando-a seu domínio.',
    mechanic: 'Escolha uma área (AU/CL/BAR/DOM/ER). Os requisitos de nível das aptidões daquela área diminuem em 1; ao obter, você pode pegar uma aptidão daquela área de graça, e seu Nível de Aptidão na área aumenta em 1. [Pré-Requisito: Nível 10, Especialista em Feitiçaria]',
    prereqs: { minLevel: 10 },
    prerequisitesText: 'Especialista em Feitiçaria, Nível 10',
    activation: 'passive',
    triggerText: 'Passiva (escolha de área).',
    logicText: 'Pede área (AU/CL/BAR/DOM/ER). cursedAptitudes[area] += 1. minLevel das aptidões dessa área -= 1 ao avaliar gate. Concede 1 ponto extra de catálogo para uma aptidão dessa área.',
    requiresConfig: 'choose_action_subtype',
    engineSupport: 'manual',
  },
];

export function getAuraAptitudeById(id: string): AuraAptitude | undefined {
  return AURA_APTITUDES.find(a => a.id === id);
}

/**
 * Normaliza `peCost` para um número fixo. Retorna 0 quando o custo é
 * 'variable' (o jogador escolhe no momento do uso) ou ausente.
 * Use este helper em todo call site legado que assume `peCost: number`.
 */
export function resolveFixedPeCost(peCost: AuraAptitude['peCost']): number {
  if (typeof peCost === 'number') return peCost;
  return 0;
}

/** Resolve `usage.max` em número concreto, com suporte a todas as famílias. */
export function resolveAuraUsageMax(
  usage: NonNullable<AuraAptitude['usage']>,
  ctx: {
    auLevel: number;
    trainingBonus: number;
    clLevel?: number;
    barLevel?: number;
    domLevel?: number;
    erLevel?: number;
  },
): number {
  if (typeof usage.max === 'number') return usage.max;
  if (usage.max === 'training') return ctx.trainingBonus;
  if (usage.max === 'au_full') return ctx.auLevel;
  if (usage.max === 'au_half') return Math.floor(ctx.auLevel / 2);
  if (usage.max === 'cl_full') return ctx.clLevel ?? 0;
  if (usage.max === 'cl_half') return Math.floor((ctx.clLevel ?? 0) / 2);
  if (usage.max === 'bar_full') return ctx.barLevel ?? 0;
  if (usage.max === 'bar_half') return Math.floor((ctx.barLevel ?? 0) / 2);
  if (usage.max === 'dom_full') return ctx.domLevel ?? 0;
  if (usage.max === 'dom_half') return Math.floor((ctx.domLevel ?? 0) / 2);
  if (usage.max === 'er_full') return ctx.erLevel ?? 0;
  if (usage.max === 'er_half') return Math.floor((ctx.erLevel ?? 0) / 2);
  return 0;
}

export interface AuraGateResult {
  ok: boolean;
  reasons: string[];
}

/** Verifica se o personagem cumpre os pré-requisitos da aptidão. */
export function checkAuraGate(
  apt: AuraAptitude,
  ctx: {
    level: number;
    auLevel: number;
    clLevel?: number;
    barLevel?: number;
    domLevel?: number;
    erLevel?: number;
    attrs: Partial<Record<'FOR' | 'DES' | 'CON' | 'INT' | 'PRE' | 'SAB', number>>;
    trainedSkills: string[];
    /** Perícias com maestria (subset de trainedSkills, mais restrito). */
    masterySkills?: string[];
    chosenAuraIds: string[];
    /** IDs adquiridos de qualquer família (preferir este em entradas novas). */
    chosenAptitudeIds?: string[];
    /** Clã do personagem (para gate `requiredClans`). */
    clanId?: string;
  },
): AuraGateResult {
  const reasons: string[] = [];
  const p = apt.prereqs ?? {};
  if (p.minLevel && ctx.level < p.minLevel) reasons.push(`Requer Nível ${p.minLevel}`);
  if (p.minAU && ctx.auLevel < p.minAU) reasons.push(`Requer AU ${p.minAU}`);
  if (p.minCL && (ctx.clLevel ?? 0) < p.minCL) reasons.push(`Requer CL ${p.minCL}`);
  if (p.minBAR && (ctx.barLevel ?? 0) < p.minBAR) reasons.push(`Requer BAR ${p.minBAR}`);
  if (p.minDOM && (ctx.domLevel ?? 0) < p.minDOM) reasons.push(`Requer DOM ${p.minDOM}`);
  if (p.minER && (ctx.erLevel ?? 0) < p.minER) reasons.push(`Requer ER ${p.minER}`);
  if (p.attrMin) {
    for (const [k, v] of Object.entries(p.attrMin)) {
      const cur = ctx.attrs[k as keyof typeof p.attrMin] ?? 0;
      if (v && cur < v) reasons.push(`Requer ${k} ${v}`);
    }
  }
  if (p.attrMinAny) {
    const entries = Object.entries(p.attrMinAny).filter(([, v]) => v && v > 0);
    if (entries.length > 0) {
      const ok = entries.some(([k, v]) => (ctx.attrs[k as keyof typeof p.attrMinAny] ?? 0) >= (v as number));
      if (!ok) {
        const desc = entries.map(([k, v]) => `${k} ${v}`).join(' ou ');
        reasons.push(`Requer ${desc}`);
      }
    }
  }
  if (p.requiresAuraIds) {
    for (const id of p.requiresAuraIds) {
      if (!ctx.chosenAuraIds.includes(id)) {
        const dep = getAuraAptitudeById(id);
        reasons.push(`Requer "${dep?.name ?? id}"`);
      }
    }
  }
  if (p.requiresAptitudeIds) {
    const owned = new Set([...(ctx.chosenAptitudeIds ?? []), ...ctx.chosenAuraIds]);
    for (const id of p.requiresAptitudeIds) {
      if (!owned.has(id)) {
        const dep = getAuraAptitudeById(id);
        reasons.push(`Requer "${dep?.name ?? id}"`);
      }
    }
  }
  if (p.requiredSkillTrained) {
    for (const skill of p.requiredSkillTrained) {
      if (!ctx.trainedSkills.includes(skill)) reasons.push(`Treinado em ${skill}`);
    }
  }
  if (p.requiredSkillMastery) {
    for (const skill of p.requiredSkillMastery) {
      if (!(ctx.masterySkills ?? []).includes(skill)) reasons.push(`Mestre em ${skill}`);
    }
  }
  if (p.requiredClans && p.requiredClans.length > 0) {
    if (!ctx.clanId || !p.requiredClans.includes(ctx.clanId)) {
      reasons.push(`Restrito a clã específico`);
    }
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Valida o catálogo de Aptidões Amaldiçoadas. Roda no boot.
 * - Garante que `upgradesId` aponta para entrada existente.
 * - Garante que entradas com `peCost: 'variable'` declaram `peLimitFormula`.
 * - Garante que entradas com `engineSupport: 'pending'` carregam ao menos `mechanic`.
 */
export function validateCursedAptitudeCatalog(): string[] {
  const errors: string[] = [];
  const ids = new Set(AURA_APTITUDES.map(a => a.id));
  for (const apt of AURA_APTITUDES) {
    if (apt.upgradesId && !ids.has(apt.upgradesId)) {
      errors.push(`[${apt.id}] upgradesId "${apt.upgradesId}" não existe no catálogo.`);
    }
    if (apt.peCost === 'variable' && !apt.peLimitFormula) {
      errors.push(`[${apt.id}] peCost 'variable' requer peLimitFormula.`);
    }
    if (apt.engineSupport === 'pending' && !apt.mechanic) {
      errors.push(`[${apt.id}] engineSupport 'pending' requer mechanic literal.`);
    }
  }
  return errors;
}
