/**
 * ============================================================================
 *  DOTES GERAIS — Catálogo unificado
 * ============================================================================
 *  22 dotes oficiais com metadados de automação (activation, peCost, uses,
 *  prereq, descricao). Passivas estatísticas são aplicadas por
 *  `recalcDotePassives` em `doteEffects.ts`. Demais efeitos são expostos no
 *  painel como botão "Usar" (deduz PE e incrementa uso quando aplicável).
 * ============================================================================
 */

export type DoteActivation =
  | 'passive'
  | 'reaction'
  | 'bonus'
  | 'action'
  | 'free'
  | 'toggle'
  | 'trigger';

export type DoteCategory =
  | 'combate'
  | 'feiticaria'
  | 'sentidos'
  | 'social'
  | 'utilitario'
  | 'sorte';

export type DoteResetScope = 'rodada' | 'cena' | 'descanso-curto' | 'descanso-longo';

export interface DoteUsage {
  /** Quantidade máxima (número fixo ou fórmula textual). */
  max: number;
  /** Quando o uso reseta. */
  per: DoteResetScope;
}

export interface Dote {
  id: string;
  nome: string;
  descricao: string;
  prereq?: string;
  activation: DoteActivation;
  /** Custo de PE fixo. `'variable'` significa custo definido pelo jogador. */
  peCost?: number | 'variable';
  uses?: DoteUsage;
  /** Categoria para agrupamento na UI. */
  category: DoteCategory;
  /** `true` se houver bônus passivo aplicado por `recalcDotePassives`. */
  hasPassiveEffect?: boolean;
  /** Notas curtas para a UI (efeito-resumo abaixo do nome). */
  short?: string;
}

export const DOTES_GERAIS: Dote[] = [
  {
    id: 'dote-abencoado-sorte',
    nome: 'Abençoado pela Sorte',
    descricao:
      'Você tem 3 pontos de sorte. Sempre que fizer uma rolagem, você pode gastar um ponto de sorte para rolar outro d20, podendo escolher o resultado. Recupera 1 ponto ao receber um crítico contra.',
    activation: 'free',
    uses: { max: 3, per: 'descanso-longo' },
    category: 'sorte',
    short: 'Recurso: 3 Pontos de Sorte (re-rola d20).',
  },
  {
    id: 'dote-aparar-ataque',
    nome: 'Aparar Ataque',
    descricao:
      'Uma vez por rodada, como reação, você realiza uma jogada de ataque contra quem o atacou corpo-a-corpo para evitar o golpe ou redirecioná-lo gastando 2 PE.',
    activation: 'reaction',
    peCost: 2,
    uses: { max: 1, per: 'rodada' },
    category: 'combate',
  },
  {
    id: 'dote-assumir-postura',
    nome: 'Assumir Postura',
    descricao:
      'Como Ação Bônus, entra em posturas de combate. Fortuna: Permite re-rolar dados menores que o BT. Tempestade: Derruba ou imobiliza alvos acertados.',
    prereq: 'ND 10',
    activation: 'bonus',
    category: 'combate',
  },
  {
    id: 'dote-atracao-combate',
    nome: 'Atração em Combate',
    descricao:
      'Criaturas provocadas por você só podem atacá-lo até passarem em um teste para escapar.',
    prereq: '20 Presença e Intimidação',
    activation: 'passive',
    category: 'social',
  },
  {
    id: 'dote-bela-tentativa',
    nome: 'Bela Tentativa',
    descricao:
      'Ao desarmar um alvo, pode gastar 2 PE para realizar um ataque como reação. Pode também tentar quebrar a arma inimiga.',
    activation: 'reaction',
    peCost: 2,
    category: 'combate',
  },
  {
    id: 'dote-destruindo-tudo',
    nome: 'Destruindo Tudo',
    descricao:
      'Uma vez por rodada, empurra o alvo ao acertá-lo, causando dano adicional e possível colisão com objetos.',
    activation: 'trigger',
    uses: { max: 1, per: 'rodada' },
    category: 'combate',
  },
  {
    id: 'dote-dominio-fundamentos',
    nome: 'Domínio dos Fundamentos',
    descricao:
      'Permite gastar PE para aumentar a CD de feitiços (Feitiço Cruel) ou para duplicar um feitiço de alvo único (Feitiço Duplicado).',
    activation: 'free',
    peCost: 'variable',
    category: 'feiticaria',
  },
  {
    id: 'dote-estudo-amaldicoado',
    nome: 'Estudo Amaldiçoado',
    descricao:
      'Escolha dois Níveis de Aptidão diferentes para serem aumentados em 1.',
    prereq: 'ND 10',
    activation: 'passive',
    category: 'feiticaria',
    short: 'Aplicar manualmente em duas aptidões (AU/CL/BAR/DOM/ER).',
  },
  {
    id: 'dote-expansao-maestral',
    nome: 'Expansão Maestral',
    descricao:
      'Permite utilizar expansão de domínio com apenas uma mão livre e sem causar ataques de oportunidade.',
    prereq: 'Expansão Completa',
    activation: 'passive',
    category: 'feiticaria',
  },
  {
    id: 'dote-explosao-cadeia',
    nome: 'Explosão em Cadeia',
    descricao:
      'Ao rolar o dano máximo em um dado de feitiço, rola-se mais um dado do mesmo valor. Permite gastar PE para aumentar a CD de resistências inimigas.',
    activation: 'trigger',
    peCost: 'variable',
    category: 'feiticaria',
  },
  {
    id: 'dote-furia-berserker',
    nome: 'Fúria Berserker',
    descricao:
      'Fica imune a imobilização/inconsciência, mas deve focar em um único alvo. Ganha facilidade em pontos cegos e chance de fazer ataques inimigos falharem.',
    activation: 'toggle',
    category: 'combate',
  },
  {
    id: 'dote-imitacao',
    nome: 'Imitação',
    descricao:
      'Reproduz técnicas inimigas com bônus de acerto e dano. Adiciona dado extra em ataques surpresa.',
    activation: 'action',
    category: 'combate',
  },
  {
    id: 'dote-membro-fantasma',
    nome: 'Membro Fantasma',
    descricao:
      'Ignora meia e 3/4 de cobertura. Pode receber penalidade no ataque para desabilitar o membro do alvo por 1 rodada. Ignora desvantagem em tiro à queima-roupa.',
    prereq: 'ND 10',
    activation: 'passive',
    category: 'combate',
  },
  {
    id: 'dote-mente-corpo-equilibrio',
    nome: 'Mente e Corpo em Equilíbrio',
    descricao:
      'Recebe vantagens igual ao BT para resistir a condições mentais e físicas.',
    activation: 'passive',
    category: 'utilitario',
  },
  {
    id: 'dote-posicionamento-ameacador',
    nome: 'Posicionamento Ameaçador',
    descricao:
      'Reduz em 2 a defesa de criaturas a 3 metros (salvo furtivo). Ataques de oportunidade zeram o movimento do alvo.',
    activation: 'passive',
    category: 'combate',
    short: 'Aura: inimigos a 3m sofrem −2 de defesa.',
  },
  {
    id: 'dote-presenca-aterrorizante',
    nome: 'Presença Aterrorizante',
    descricao:
      'Inimigos que o veem pela primeira vez devem fazer um TR de Vontade ou ficam apavorados/amedrontados.',
    prereq: 'Calamidade de Grau 1',
    activation: 'action',
    category: 'social',
  },
  {
    id: 'dote-purificacao-alma',
    nome: 'Purificação da Alma',
    descricao:
      'Ao realizar cura, pode abdicar de metade para recuperar pontos de Integridade.',
    activation: 'free',
    uses: { max: 1, per: 'descanso-longo' },
    category: 'utilitario',
  },
  {
    id: 'dote-reacao-necessaria',
    nome: 'Reação Necessária',
    descricao:
      'Pode gastar 3 PE para realizar uma reação extra. Ao receber dano corpo a corpo, pode gastar 2 PE para revidar.',
    activation: 'reaction',
    peCost: 'variable',
    category: 'combate',
  },
  {
    id: 'dote-sentidos-afiados',
    nome: 'Sentidos Afiados',
    descricao:
      'Soma o ND na Atenção e ganha bônus em Percepção. Pode usar PE para andar no ar ou anular dano de queda.',
    prereq: 'Não ter Sentidos Atentos',
    activation: 'passive',
    category: 'sentidos',
    hasPassiveEffect: true,
    short: '+ND na Atenção · +Percepção',
  },
  {
    id: 'dote-sentidos-atentos',
    nome: 'Sentidos Atentos',
    descricao:
      '+5 em Atenção, imunidade a surpresa, +5 de Iniciativa e re-rolagem na iniciativa.',
    prereq: 'Não ter Sentidos Afiados',
    activation: 'passive',
    category: 'sentidos',
    hasPassiveEffect: true,
    short: '+5 Atenção · +5 Iniciativa · imune a surpresa',
  },
  {
    id: 'dote-ultima-investida',
    nome: 'Última Investida',
    descricao:
      'Ao cair a 0 PV, pode usar uma reação para realizar um ataque de dano máximo em até 6m.',
    prereq: 'Não possuir Desafiando a Morte',
    activation: 'reaction',
    uses: { max: 1, per: 'descanso-longo' },
    category: 'combate',
  },
  {
    id: 'dote-voto-malevolente',
    nome: 'Voto Malevolente',
    descricao:
      'Ao realizar votos emergenciais, o benefício não precisa ser obrigatoriamente menor que o malefício.',
    prereq: 'ND 8',
    activation: 'passive',
    category: 'utilitario',
  },
];

export const DOTE_BY_ID: Record<string, Dote> = Object.fromEntries(
  DOTES_GERAIS.map((d) => [d.id, d]),
);

export function getDoteById(id: string): Dote | undefined {
  return DOTE_BY_ID[id];
}

export const DOTE_CATEGORY_LABEL: Record<DoteCategory, string> = {
  combate: 'Combate',
  feiticaria: 'Feitiçaria',
  sentidos: 'Sentidos',
  social: 'Social / Presença',
  utilitario: 'Utilitário',
  sorte: 'Sorte',
};

export const DOTE_ACTIVATION_LABEL: Record<DoteActivation, string> = {
  passive: 'Passiva',
  reaction: 'Reação',
  bonus: 'Ação Bônus',
  action: 'Ação',
  free: 'Ação Livre',
  toggle: 'Liga/Desliga',
  trigger: 'Gatilho',
};

export const DOTE_RESET_LABEL: Record<DoteResetScope, string> = {
  rodada: 'por rodada',
  cena: 'por cena',
  'descanso-curto': 'por descanso curto',
  'descanso-longo': 'por descanso longo',
};
