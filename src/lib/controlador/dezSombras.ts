import type { DamageType } from '@/types';
import type { InvocacaoControlador } from './tipos';

export type IdDezSombras =
  | 'cao-branco' | 'cao-preto' | 'nue' | 'sapo' | 'grande-serpente'
  | 'elefante-maximo' | 'fuga-do-coelho' | 'cervo-circular' | 'touro-perfurante' | 'mahoraga'
  | 'tigre-funebre';

export const FONTE_ENCICLOPEDIA_MALDITA = 'Enciclopédia Maldita (F&M 2.5.2), v1.1.1';
export const CUSTO_CAO_DIVINO_CAMPANHA_PE = 2;

type AcaoFonte = InvocacaoControlador['acoes'][number] & {
  descricaoRegra?: string;
  statusAutomacao?: 'executavel' | 'parcial' | 'manual';
  formulaCura?: string;
  fenomenoAdaptacaoId?: string;
  curaRealSemCusto?: boolean;
  permiteInimigos?: boolean;
  todosNoAlcance?: boolean;
  somenteProprio?: boolean;
};

export interface ModeloFonteDezSombras {
  id: IdDezSombras;
  nome: string;
  grau: NonNullable<InvocacaoControlador['grau']>;
  custoPE: number;
  hp: number;
  bonusPVMaximo?: number;
  defesa: number;
  deslocamentoM: number;
  atributos: NonNullable<InvocacaoControlador['atributos']>;
  pagina: number;
  descricao: string;
  domadoInicialmente: boolean;
  opcionalHomebrew?: boolean;
  caracteristicas?: Array<Record<string, unknown>>;
  ataqueTreinado?: InvocacaoControlador['ataqueTreinado'];
  acoes: AcaoFonte[];
}

export function ataque(input: {
  id: string; nome: string; dano: string; tipoDano: DamageType; alcanceM?: number;
  bonusAtaque: number; atributoAtaque?: 'forca' | 'destreza'; multiplicadorDanoAtributo?: number; descricaoRegra?: string;
  statusAutomacao?: 'executavel' | 'parcial' | 'manual';
}): AcaoFonte {
  return {
    id: input.id,
    nome: input.nome,
    tipo: 'ataque',
    tipoExecucao: 'manual',
    teste: 'ataque',
    tipoAtaque: 'corpo_a_corpo',
    atributoAtaque: input.atributoAtaque ?? 'forca',
    multiplicadorDanoAtributo: input.multiplicadorDanoAtributo ?? 0,
    categoriaAcao: 'acao_complexa',
    dano: input.dano,
    tipoDano: input.tipoDano,
    alcanceM: input.alcanceM,
    bonusAtaque: input.bonusAtaque,
    statusAutomacao: input.statusAutomacao ?? 'executavel',
    ...(input.descricaoRegra ? { descricaoRegra: input.descricaoRegra } : {}),
  };
}

function habilidade(id: string, nome: string, descricaoRegra: string, categoriaAcao: NonNullable<AcaoFonte['categoriaAcao']> = 'acao_comum'): AcaoFonte {
  return {
    id,
    nome,
    tipo: 'habilidade',
    tipoExecucao: 'manual',
    categoriaAcao,
    descricaoRegra,
    statusAutomacao: 'manual',
  };
}

export function cura(input: {
  id: string; nome: string; formula: string; alcanceM: number;
  alvos?: 'unico' | 'multiplos'; custoPE?: number;
  todosNoAlcance?: boolean; permiteInimigos?: boolean; somenteProprio?: boolean; curaRealSemCusto?: boolean; descricaoRegra?: string;
}): AcaoFonte {
  return {
    id: input.id,
    nome: input.nome,
    tipo: 'suporte',
    tipoExecucao: 'manual',
    categoriaAcao: 'acao_complexa',
    alcanceM: input.alcanceM,
    ...(input.custoPE ? { custoPE: input.custoPE } : {}),
    efeitoSuporte: { efeito: 'cura', alvos: input.alvos ?? 'unico', atributoCura: 'sabedoria' },
    formulaCura: input.formula,
    statusAutomacao: 'executavel',
    ...(input.todosNoAlcance ? { todosNoAlcance: true } : {}),
    ...(input.permiteInimigos ? { permiteInimigos: true } : {}),
    ...(input.somenteProprio ? { somenteProprio: true } : {}),
    ...(input.curaRealSemCusto ? { curaRealSemCusto: true } : {}),
    ...(input.descricaoRegra ? { descricaoRegra: input.descricaoRegra } : {}),
  };
}

const perfis: ModeloFonteDezSombras[] = [
  {
    id: 'cao-branco', nome: 'Cão Divino Branco', grau: 'quarto', custoPE: CUSTO_CAO_DIVINO_CAMPANHA_PE, hp: 26, defesa: 12, deslocamentoM: 12,
    atributos: { forca: 14, destreza: 14, constituicao: 12, inteligencia: 6, sabedoria: 8, presenca: 6 },
    pagina: 76, domadoInicialmente: true,
    descricao: 'Ficha-base da Enciclopédia Maldita v1.1.1. Exceção aprovada da campanha: cada Cão custa 2 PE (4 PE pelo par), embora a ficha impressa indique outro custo. Mordida: ação complexa, alcance corpo a corpo, +5 no ataque e 1d12+1d8 perfurante. Instinto Caçador concede +2 em Percepção e +3 m de deslocamento; também pode dar vantagem em rastreamento com uma Ação Simples. Matilha das Sombras depende de outro Cão próximo do alvo; a aplicação de Flanqueado e do bônus precisa ser arbitrada conforme a ficha.',
    caracteristicas: [
      { tipo: 'passiva', nome: 'Instinto Caçador', efeitoOperacional: { tipo: 'bonus_pericia', pericia: 'Percepção' } },
    ],
    acoes: [
      ataque({ id: 'mordida', nome: 'Mordida', dano: '1d12+1d8', tipoDano: 'DP', alcanceM: 1.5, bonusAtaque: 1 }),
      {
        ...habilidade('instinto-cacador', 'Instinto Caçador', 'Como Ação Simples, concede vantagem ao Controlador no próximo teste de Percepção feito para rastrear uma criatura.', 'acao_simples'),
        statusAutomacao: 'executavel',
        efeitoEspecial: { tipo: 'vantagem_pericia_controlador', pericia: 'Percepção', contexto: 'rastreamento' },
      },
      habilidade('matilha-das-sombras', 'Matilha das Sombras', 'Se outro aliado estiver adjacente ao alvo da Mordida, ele é considerado Flanqueado. A posição é calculada no mapa e fica disponível no contexto OMNI do alvo; nenhum bônus numérico adicional é presumido.'),
    ],
  },
  {
    id: 'cao-preto', nome: 'Cão Divino Preto', grau: 'quarto', custoPE: CUSTO_CAO_DIVINO_CAMPANHA_PE, hp: 26, defesa: 12, deslocamentoM: 12,
    atributos: { forca: 14, destreza: 14, constituicao: 12, inteligencia: 6, sabedoria: 8, presenca: 6 },
    pagina: 76, domadoInicialmente: true,
    descricao: 'Ficha-base da Enciclopédia Maldita v1.1.1. Exceção aprovada da campanha: cada Cão custa 2 PE (4 PE pelo par), embora a ficha impressa indique outro custo. Mordida: ação complexa, alcance corpo a corpo, +5 no ataque e 1d12+1d8 perfurante. Instinto Caçador concede +2 em Percepção e +3 m de deslocamento; também pode dar vantagem em rastreamento com uma Ação Simples. Matilha das Sombras depende de outro Cão próximo do alvo; a aplicação de Flanqueado e do bônus precisa ser arbitrada conforme a ficha.',
    caracteristicas: [
      { tipo: 'passiva', nome: 'Instinto Caçador', efeitoOperacional: { tipo: 'bonus_pericia', pericia: 'Percepção' } },
    ],
    acoes: [
      ataque({ id: 'mordida', nome: 'Mordida', dano: '1d12+1d8', tipoDano: 'DP', alcanceM: 1.5, bonusAtaque: 1 }),
      {
        ...habilidade('instinto-cacador', 'Instinto Caçador', 'Como Ação Simples, concede vantagem ao Controlador no próximo teste de Percepção feito para rastrear uma criatura.', 'acao_simples'),
        statusAutomacao: 'executavel',
        efeitoEspecial: { tipo: 'vantagem_pericia_controlador', pericia: 'Percepção', contexto: 'rastreamento' },
      },
      habilidade('matilha-das-sombras', 'Matilha das Sombras', 'Se outro aliado estiver adjacente ao alvo da Mordida, ele é considerado Flanqueado. A posição é calculada no mapa e fica disponível no contexto OMNI do alvo; nenhum bônus numérico adicional é presumido.'),
    ],
  },
  {
    id: 'nue', nome: 'Nue', grau: 'quarto', custoPE: 3, hp: 26, defesa: 13, deslocamentoM: 12,
    atributos: { forca: 8, destreza: 16, constituicao: 12, inteligencia: 6, sabedoria: 10, presenca: 6 },
    pagina: 78, domadoInicialmente: false,
    descricao: 'Ficha-base da Enciclopédia Maldita v1.1.1. Voo Maldito: 12 m de voo e 4,5 m de caminhada. Pode carregar até quatro criaturas Pequenas/Mínimas (−1,5 m de voo por criatura) ou até duas Médias (−3 m por criatura); agarrar um hostil em voo e soltá-lo exige resolução manual. Choque Estático acrescenta 1d6 chocante quando um ataque físico ou feitiço elétrico acerta. Investida Eletrizante causa 1d12+1d8 chocante.',
    acoes: [
      ataque({ id: 'investida-eletrizante', nome: 'Investida Eletrizante', dano: '1d12+1d8', tipoDano: 'DCC', alcanceM: 3, bonusAtaque: 1, atributoAtaque: 'destreza' }),
      habilidade('voo-maldito', 'Voo Maldito', 'Voa 12 m e caminha 4,5 m. Pode carregar até quatro criaturas Pequenas/Mínimas, reduzindo o voo em 1,5 m por criatura, ou até duas Médias, reduzindo-o em 3 m por criatura. Agarrar um hostil no ar exige teste de Atletismo ou Acrobacia contra o alvo; se vencer, pode movê-lo conforme as penalidades de carga e soltá-lo no ponto final do movimento.'),
      habilidade('choque-estatico', 'Choque Estático', 'Ao acertar com ataque físico ou feitiço que cause dano elétrico, causa mais 1d6 de dano chocante.'),
    ],
  },
  {
    id: 'sapo', nome: 'Gama', grau: 'quarto', custoPE: 3, hp: 28, defesa: 10, deslocamentoM: 9,
    atributos: { forca: 15, destreza: 10, constituicao: 16, inteligencia: 6, sabedoria: 6, presenca: 6 },
    pagina: 77, domadoInicialmente: false,
    descricao: 'Ficha-base da Enciclopédia Maldita v1.1.1; o identificador interno “sapo” é mantido para compatibilidade. Língua Sombria tem alcance natural de 6 m e puxa um aliado Médio ou menor para um espaço adjacente como Reação, uma vez por rodada. Protusão de Língua tem ataque +5 e causa 1d12+1d8+2 de impacto; ao acertar, pode gastar 4 PE para tentar Agarrar como Ação Livre. Anfíbio Sombrio permite respirar debaixo d’água, ignora terreno difícil aquático ou lamacento e concede +2 em testes de manobra submerso ou em Escuridão Total.',
    acoes: [
      {
        ...ataque({ id: 'protusao-lingua', nome: 'Protusão de Língua', dano: '1d12+1d8', tipoDano: 'DI', alcanceM: 6, bonusAtaque: 0, multiplicadorDanoAtributo: 1, statusAutomacao: 'parcial', descricaoRegra: 'Ataque complexo com alcance natural de 6 m, bônus total +5 e dano 1d12+1d8+2. Ao acertar, o Gama pode escolher gastar 4 PE e tentar Agarrar como Ação Livre.' }),
        efeitoEspecial: { tipo: 'agarrar_gama_apos_acerto', custoPE: 4, categoriaAcao: 'acaoLivre' },
      },
      {
        ...habilidade('lingua-sombria', 'Língua Sombria', 'Uma vez por rodada, como Reação, puxe um aliado de tamanho Médio ou menor que esteja a até 6 m para um espaço adjacente ao Gama. O deslocamento é instantâneo e não provoca ataques de oportunidade.', 'reacao'),
        alcanceM: 6,
        statusAutomacao: 'executavel',
        efeitoEspecial: { tipo: 'puxar_aliado_gama' },
      },
      habilidade('anfibio-sombrio', 'Anfíbio Sombrio', 'Ignora penalidades de terreno difícil ligadas à água ou lama, pode respirar debaixo d’água e recebe +2 em testes de manobra quando submerso ou em ambiente de Escuridão Total.'),
    ],
  },
  {
    id: 'grande-serpente', nome: 'Orochi (Grande Serpente)', grau: 'quarto', custoPE: 3, hp: 26, defesa: 12, deslocamentoM: 9,
    atributos: { forca: 14, destreza: 14, constituicao: 12, inteligencia: 6, sabedoria: 8, presenca: 6 },
    pagina: 79, domadoInicialmente: false,
    descricao: 'Ficha-base da Enciclopédia Maldita v1.1.1. Orochi é Grande e recebe +2 em testes de manobra em Escuridão Total. Emergir das Sombras permite escolher um espaço livre dentro do alcance de invocação; no turno em que surge, recebe vantagem contra alvos que ainda não agiram. Bote Sombrio causa 1d12+1d8 perfurante e pode gastar 4 PE para tentar Agarrar como Ação Livre; enquanto mantém o alvo agarrado, causa dano de Força (+2) automaticamente no início de cada turno do alvo.',
    acoes: [
      ataque({ id: 'bote-sombrio', nome: 'Bote Sombrio', dano: '1d12+1d8', tipoDano: 'DP', alcanceM: 1.5, bonusAtaque: 1, statusAutomacao: 'parcial', descricaoRegra: 'Ataque complexo. Ao acertar, pode gastar 4 PE e tentar Agarrar como Ação Livre. Enquanto mantém o alvo agarrado, causa dano automático no início dos turnos conforme a ficha; a disputa permanece manual.' }),
      habilidade('emergir-das-sombras', 'Emergir das Sombras', 'Pode surgir em espaço livre dentro do alcance de invocação, mesmo em terreno difícil. No turno em que é invocado, recebe vantagem contra alvos que ainda não agiram.'),
      habilidade('grande-serpente', 'Grande Serpente', 'Orochi conta como criatura de categoria Grande e recebe +2 em testes de manobra em ambientes de Escuridão Total.'),
    ],
  },
  {
    id: 'fuga-do-coelho', nome: 'Fuga dos Coelhos', grau: 'terceiro', custoPE: 6, hp: 56, defesa: 13, deslocamentoM: 9,
    atributos: { forca: 6, destreza: 20, constituicao: 12, inteligencia: 12, sabedoria: 6, presenca: 6 },
    pagina: 81, domadoInicialmente: false,
    descricao: 'Ficha-base da Enciclopédia Maldita v1.1.1. A Fuga é uma Horda de tamanho Médio com 56 PV, Defesa 13 e 9 m de deslocamento. A cada três rodadas completas, Horda Infindável acrescenta 1/5 dos PV-base (arredondado para baixo) aos PV atuais e máximos e aumenta uma categoria, até Colossal. Crescimento, pegada, terreno difícil, flanqueamento, cobertura da Fuga, Fragilizada por área, dispersão e ataques dos coelhos têm estado de combate integrado. A fonte não fixa a proporção de PV/porte removidos na dispersão nem a duração ou redução de movimento da Fuga; esses valores ficam para confirmação da mesa. A redução de ataques múltiplos ainda exige adjudicação do Mestre.',
    acoes: [
      { ...habilidade('fuga', 'Fuga', 'Ação Complexa, alcance 9 m, um alvo. Coelhos cobrem o alvo e atrapalham seus movimentos. Aliado recebe Cobertura Completa contra ataques de alvo único; contra ataques em área, alvo e Horda ficam Fragilizados. Duração não definida na fonte e acompanhada pela mesa.'), alcanceM: 9, categoriaAcao: 'acao_complexa', statusAutomacao: 'parcial' },
      { ...habilidade('dispersao-tatica', 'Dispersão Tática', 'Como Ação Bônus, remova uma parte da Horda e manifeste até seis coelhos individuais em quadrados adjacentes. Cada um tem 1 PV, Defesa igual à da Horda e 9 m de deslocamento; pode correr até um alvo e atacar como invocação, causando 1 dano fixo que ignora RD comum. A fonte não fornece a proporção numérica de redução: o Mestre confirma os PV máximos e o porte restantes antes de resolver.' , 'acao_bonus'), statusAutomacao: 'parcial' },
      habilidade('horda-infindavel', 'Horda Infindável', 'A cada 3 rodadas em cena, os PV atuais e máximos aumentam em 1/5 dos PV-base e o tamanho sobe uma categoria (Médio, Grande, Enorme, Colossal). A partir de Grande, inimigos podem atravessar ou parar nos espaços da Horda. Sua área conta como terreno difícil e inimigos nela ficam automaticamente Flanqueados. Recebe +1 nível de dano por categoria acima de Médio (máximo +3); danos de ataques múltiplos e auxiliares diminuem conforme o enxame cresce, exigindo um uso adicional para superar penalidades de ação por categoria acima de Médio. Requer estado de combate para automatizar.'),
      habilidade('tesouro-escondido', 'Tesouro Escondido', 'A Horda compartilha um único Líder, cujo token é seu tesouro sagrado. O Líder não morre e retorna após Descanso Longo, exceto se for atingido por Acerto Crítico; se o Líder for atingido, a Horda é desfeita e exorcizada, qualquer que seja seu PV.'),
    ],
  },
  {
    id: 'elefante-maximo', nome: 'Elefante Máximo', grau: 'terceiro', custoPE: 6, hp: 75, defesa: 12, deslocamentoM: 9,
    atributos: { forca: 15, destreza: 10, constituicao: 20, inteligencia: 6, sabedoria: 6, presenca: 6 },
    pagina: 80, domadoInicialmente: false, bonusPVMaximo: 15,
    descricao: 'Ficha-base da Enciclopédia Maldita v1.1.1: 75 PV-base, Defesa 12 e 9 m de caminhada. Robustez eleva os PV máximos em 15 (90 no total). Torrente de Água é uma linha de 6 m e exige TR de Fortitude; falha causa 1d8 de impacto. Massa Esmagadora permite pisotear como Ação Simples uma criatura sob seus pés: ela cai e sofre 4d12, mais 1d6 por cada 3 m de queda; em Expansão de Domínio, considere 6d12 de dano inicial.',
    acoes: [
      { id: 'torrente-agua', nome: 'Torrente de Água', tipo: 'ataque', tipoExecucao: 'manual', teste: 'resistencia', categoriaAcao: 'acao_complexa', resistenciaAlvo: 'Fortitude', atributoCD: 'constituicao', multiplicadorDanoAtributo: 0, dano: '1d8', tipoDano: 'DI', tipo_alvo: 'area', filtro_alvo: 'todos', area: { forma: 'linha', tamanho_m: 6 }, statusAutomacao: 'executavel', descricaoRegra: 'Libera um jato em linha reta de 6 m. Todas as criaturas na linha fazem TR de Fortitude; em falha, sofrem 1d8 de impacto. A origem e o sentido da linha são posicionados no mapa; a largura usa uma célula padrão da grade porque a fonte não a especifica.' },
      {
        ...habilidade('massa-esmagadora', 'Massa Esmagadora', 'Como Ação Simples, pode pisotear uma criatura menor que esteja sob seus pés. Se lançada no ar e cair sobre a criatura, ela sofre 4d12 de dano de impacto e mais 1d6 para cada 3 m de queda. Em Expansão de Domínio, considere 6d12 como dano inicial.', 'acao_simples'),
        categoriaAcao: 'acao_simples',
        statusAutomacao: 'executavel',
      },
      { ...habilidade('robustez', 'Robustez', 'Aumenta em 15 os PV máximos do Elefante Máximo (90 no total), já aplicados ao perfil.'), statusAutomacao: 'executavel' },
      habilidade('grande', 'Grande', 'O Elefante Máximo conta como criatura de categoria Grande.'),
    ],
  },
  {
    id: 'cervo-circular', nome: 'Cervo Circular', grau: 'segundo', custoPE: 10, hp: 94, defesa: 16, deslocamentoM: 9,
    atributos: { forca: 16, destreza: 10, constituicao: 14, inteligencia: 6, sabedoria: 16, presenca: 6 },
    pagina: 83, domadoInicialmente: false,
    descricao: 'Ficha-base da Enciclopédia Maldita v1.1.1: Grau 2, 10 PE, 94 PV, Defesa 16 e 9 m. Aura da Quietude concede +3 em TR contra condições mentais em raio de 6 m e recupera PV iguais ao atributo Sabedoria (16) no início dos turnos dos aliados. Toque da Vida remove condições Fracas/Médias com movimento ou Fortes/Extremas com Ação Complexa e 2 PE por nível. Bênção cura 3d12+3; contra Maldições, causa dano de Energia Reversa 1,5 vez maior. Neutralização dissipa técnicas amaldiçoadas ativas em 4,5 m; feiticeiros na área fazem TR de Vontade ou ficam sem a técnica inata por 1 rodada.',
    acoes: [
      habilidade('aura-da-quietude', 'Aura da Quietude', 'Aliados em raio de 6 m recebem +3 em TR contra condições mentais (Medo, Confusão, Atordoamento) e recuperam PV iguais ao atributo Sabedoria do Cervo (16) no início dos próprios turnos.'),
      { ...habilidade('toque-da-vida', 'Toque da Vida', 'Ação de Movimento: remove uma condição Fraca ou Média de um aliado adjacente. Ação Complexa: remove uma condição Forte ou Extrema. Cada nível removido custa 2 PE.', 'movimento'), custoPE: 2, efeitoEspecial: { tipo: 'toque_da_vida_cervo' }, statusAutomacao: 'executavel' },
      { id: 'pisotear', nome: 'Pisotear', tipo: 'ataque', tipoExecucao: 'manual', teste: 'resistencia', categoriaAcao: 'acao_complexa', resistenciaAlvo: 'Fortitude', atributoCD: 'constituicao', multiplicadorDanoAtributo: 0, dano: '1d10', formulaDanoAlvoUnico: '2d12', tipoDano: 'DI', tipo_alvo: 'area', filtro_alvo: 'todos_exceto_si', area: { forma: 'raio_em_si', tamanho_m: 4.5 }, statusAutomacao: 'executavel', descricaoRegra: 'Ação Complexa: todas as criaturas em área de até 4,5 m fazem TR de Fortitude; falha causa 1d10 de impacto. Se houver apenas uma criatura na área, ela sofre 1d12+1d12 de impacto.' },
      { ...cura({ id: 'bencao', nome: 'Bênção', formula: '3d12+3', alcanceM: 1.5, custoPE: 2, alvos: 'unico', permiteInimigos: true, descricaoRegra: 'Ação Complexa de toque. Restaura 3d12+modificador de Sabedoria em PV; contra Maldições, causa dano de Energia Reversa igual a 1,5 vez esse valor.' }), statusAutomacao: 'executavel' },
      { ...habilidade('neutralizacao', 'Neutralização', 'Ação Simples: energia positiva em raio de 4,5 m dissipa manifestações ativas de técnica inata (incluindo barreiras, clones e construtos registrados como dissipáveis). Feiticeiros na área fazem TR de Vontade contra a CD do Cervo; na falha, não podem usar sua técnica inata até o início do próximo turno.', 'acao_simples'), tipoExecucao: 'manual', teste: 'resistencia', resistenciaAlvo: 'Vontade', atributoCD: 'sabedoria', tipo_alvo: 'area', filtro_alvo: 'todos', area: { forma: 'raio_em_si', tamanho_m: 4.5 }, efeitoEspecial: { tipo: 'neutralizacao_cervo' }, statusAutomacao: 'executavel' },
      habilidade('grande', 'Grande', 'O Cervo Circular conta como criatura de categoria Grande.'),
    ],
  },
  {
    id: 'touro-perfurante', nome: 'Touro Perfurante', grau: 'segundo', custoPE: 8, hp: 96, defesa: 16, deslocamentoM: 15,
    atributos: { forca: 24, destreza: 8, constituicao: 16, inteligencia: 6, sabedoria: 6, presenca: 6 },
    pagina: 84, domadoInicialmente: false,
    descricao: 'Ficha-base da Enciclopédia Maldita v1.1.1: Grau 2, 8 PE, 96 PV, Defesa 16 e 15 m. Trajetória Fixa exige ao menos 3 m em linha reta antes de atacar; mudanças de direção acima de 45° custam ação de movimento e Ação Complexa. Investida Perfurante desloca o Touro como parte da Ação Complexa, causa 2d12+1d12 de impacto e adiciona +1d8 por cada 3 m percorridos; ao percorrer todo o deslocamento disponível nesta rodada, um acerto torna-se crítico automático (não natural). Inércia Imparável é Ação Simples, dobra o deslocamento para 30 m nesta rodada e ignora efeitos que reduzam velocidade ou impeçam movimento; a Investida usada nesta rodada aumenta em 2 níveis de dano.',
    acoes: [
      ataque({ id: 'investida-perfurante', nome: 'Investida Perfurante', dano: '2d12+1d12', tipoDano: 'DI', alcanceM: 1.5, bonusAtaque: 1, statusAutomacao: 'executavel', descricaoRegra: 'Ação Complexa: o deslocamento em linha reta faz parte do ataque. Requer ao menos 3 m de trajetória reta; adiciona +1d8 por cada 3 m percorridos. Ao percorrer todo o deslocamento disponível nesta rodada, um acerto torna-se crítico automático (não natural). Mudanças de direção acima de 45° exigem uma Ação de Movimento adicional, além desta Ação Complexa.' }),
      habilidade('ruptura', 'Ruptura', 'Causa dano dobrado contra objetos e estruturas. Se destruir um objeto durante a carga, o Touro pode continuar o movimento sem perder o bônus de ímpeto.'),
      habilidade('trajetoria-fixa', 'Trajetória Fixa', 'Só pode atacar depois de mover ao menos 3 m em linha reta naquela rodada. Pode mudar de direção em até 45°; acima disso, gasta ação de movimento e Ação Complexa.'),
      { ...habilidade('inercia-imparavel', 'Inércia Imparável', 'Ação Simples: dobra o deslocamento do Touro para 30 m até o fim desta rodada e o torna imune a efeitos que reduzam sua velocidade ou impeçam movimento. A Investida Perfurante usada nesta rodada aumenta em 2 níveis de dano.', 'acao_simples'), statusAutomacao: 'executavel', somenteProprio: true },
      habilidade('grande', 'Grande', 'O Touro Perfurante conta como criatura de categoria Grande.'),
    ],
  },
  {
    id: 'mahoraga', nome: 'General Divino Mahoraga', grau: 'especial', custoPE: 20, hp: 1000, defesa: 24, deslocamentoM: 15,
    atributos: { forca: 30, destreza: 16, constituicao: 28, inteligencia: 6, sabedoria: 6, presenca: 6 },
    pagina: 88, domadoInicialmente: false,
    descricao: 'Ficha-base da Enciclopédia Maldita v1.1.1, pp. 88–92: Grau Especial, 20 PE, Grande, 1000 PV, Defesa 24, 15 m de caminhada, percepção às cegas em cone de 9 m e atributos FOR 30, DES 16, CON 28, INT/SAB/PRE 6. O Ciclo da Roda tem três estágios de vida (1000, 500 e 250 PV): para avançar, precisa chegar a 0 PV e receber 150 ou mais de dano excedente em um golpe, usando um fenômeno ainda não adaptado nesta cena; sem isso, a Roda restaura o estágio anterior. A Roda de Dharma adapta fenômenos em cinco giros, com um giro imediato no primeiro contato, outro a cada 5 rodadas e giro adicional quando o mesmo fenômeno o atinge novamente. A ficha inclui adaptação de combate, ambiente, condições e obstáculos; efeitos que dependem de fenômeno, alvo ou cenário ficam registrados para resolução específica da mesa quando não houver dado estruturado no sistema.',
    acoes: [
      ataque({ id: 'punho-do-exterminio', nome: 'Punho do Extermínio', dano: '3d12+1d8', tipoDano: 'DI', alcanceM: 3, bonusAtaque: 1, descricaoRegra: 'Ação Complexa. No momento do ataque, reduza um ou mais dados da fórmula (primeiro os d12 e depois o d8); se acertar, empurre o alvo 6 m por dado removido. O empurrão respeita paredes e ocupação do mapa.' }),
      ataque({ id: 'espada-do-exterminio', nome: 'Espada do Extermínio', dano: '3d12+1d8', tipoDano: 'DCO', alcanceM: 3, bonusAtaque: 1, descricaoRegra: 'Ação Complexa. Contra uma Maldição, o dano deste golpe é Energia Reversa (DNR).' }),
      { ...habilidade('regeneracao-adaptativa', 'Regeneração Adaptativa', 'Ação Complexa: recebe 2d12+2d12+1d8 PV temporários. General Imoral eleva a cura em 8 níveis de dano. Por 2 PE, converte o resultado em cura de PV; cada PE adicional (até o modificador de Constituição +8) eleva a cura/PVT em 2 níveis. Com metade dos PV ou menos, usa como Ação Livre uma vez por rodada. Um giro da Roda permite usá-la como Ação Simples; se já for Simples, torna-se Livre. 8 PE regenera Ferimento Complexo; se estiver com o membro, recolocá-lo custa 4 PE e Ação Simples. Ferimentos e membros ainda exigem registro do Mestre.', 'acao_complexa'), statusAutomacao: 'parcial' },
      { ...habilidade('ataque-adaptativo', 'Ataque Adaptativo', 'Ação Simples: escolhe uma propriedade/elemento cuja adaptação a Roda completou em cinco giros e aplica ao próximo ataque. O tipo de dano é automatizado; alcançar frequência e ignorar uma defesa específica do alvo dependem da defesa/técnica registrada pela mesa.', 'acao_simples'), statusAutomacao: 'parcial' },
      { ...habilidade('roda-de-dharma', 'Roda de Dharma', 'Passiva: o primeiro contato com dano, fenômeno, feitiço ou TR gira imediatamente; o mesmo fenômeno atingindo de novo gira mais uma vez; depois, gira automaticamente a cada 5 rodadas no início do turno de Mahoraga. 1) enxerga feitiços invisíveis/intangíveis; 2) recebe 12 RD irredutível; 3) recebe metade do dano por 1 hora; 4) recebe um quarto do dano e fica imune aos efeitos não danosos da fonte; 5) a fonte não pode reduzi-lo abaixo de 1 PV. A adaptação se agrupa por propriedade-base, não pelo nome de cada execução. Um giro também permite Regeneração Adaptativa como Ação Simples (ou Livre se já Simples).', 'acao_comum'), statusAutomacao: 'parcial' },
      { ...habilidade('vontade-divina', 'Vontade Divina', 'Só após domesticação permanente: quando o dono fica inconsciente ou Morrendo, Mahoraga entra em Máquina por rodadas iguais ao maior modificador de Sabedoria/Presença do dono (mínimo 1). Prioriza a última ordem, eliminar a ameaça que feriu o dono e atacar inimigos que se aproximem a menos de 3 m do corpo; se a área for pacificada, retorna à sombra no último segundo. Ignora intimidação/controle mental que não venham do Mestre. O estado e a prioridade são registrados pela HUD; seleção de ameaça pode exigir decisão do Mestre.', 'acao_comum'), statusAutomacao: 'parcial' },
    ],
  },
  {
    id: 'tigre-funebre', nome: 'Tigre Fúnebre', grau: 'primeiro', custoPE: 11, hp: 140, defesa: 12, deslocamentoM: 9,
    atributos: { forca: 20, destreza: 20, constituicao: 20, inteligencia: 6, sabedoria: 6, presenca: 6 },
    pagina: 85, domadoInicialmente: false,
    descricao: 'Ficha-base oficial da Enciclopédia Maldita v1.1.1: Grau 1, 11 PE, Grande, 140 PV, Defesa 12 e 9 m. Garras de Extermínio reduzem cumulativamente a Defesa do alvo em 1, até −4; a Defesa recupera +1 por rodada sem receber ataque corpo a corpo do Tigre. Reflexos Felinos dá uma reação adicional por rodada (duas no total) e permite usar Retalhar contra quem errar um ataque corpo a corpo contra ele. Retalhar causa 2d12+1d12 cortante. Predador Ápice permite dois Retalhares na rodada seguinte e ignora 8 RD, além de toda RD de criaturas de 2º Grau ou inferior.',
    acoes: [
      ataque({ id: 'retalhar', nome: 'Retalhar', dano: '2d12+1d12', tipoDano: 'DCO', alcanceM: 3, bonusAtaque: 1, statusAutomacao: 'executavel', descricaoRegra: 'Ação Complexa. Se for acerto crítico, o Controlador pode gastar 6 PE para forçar TR de Fortitude; na falha, o alvo recebe Sangramento Forte (4d10). Reflexos Felinos também permite Retalhar como reação contra uma criatura hostil que erre um ataque corpo a corpo contra o Tigre.' }),
      habilidade('garras-de-exterminio', 'Garras de Extermínio', 'Sempre que o Tigre acerta uma criatura com um ataque corpo a corpo e causa dano, reduz a Defesa do alvo em 1, cumulativamente até −4. Para cada rodada consecutiva sem um novo ataque bem-sucedido contra esse alvo, ele recupera +1 Defesa no início do próprio turno, até voltar ao valor original.'),
      habilidade('reflexos-felinos', 'Reflexos Felinos', 'Recebe uma Ação de Reação adicional por rodada (duas no total). Quando uma criatura hostil erra um ataque corpo a corpo contra o Tigre, ele pode gastar uma reação para usar Retalhar contra ela e quebrar sua postura.'),
      { ...habilidade('predador-apice', 'Predador Ápice', 'Ação Simples: sintoniza os sentidos com a energia do alvo. Na próxima rodada, pode usar dois Retalhares em vez de um; os ataques ignoram 8 pontos de RD e toda RD de criaturas de 2º Grau ou inferior.', 'acao_simples'), statusAutomacao: 'executavel', somenteProprio: true },
      habilidade('grande', 'Grande', 'O Tigre Fúnebre conta como criatura de categoria Grande.'),
    ],
  },
];

export const DEZ_SOMBRAS_MODELOS: readonly ModeloFonteDezSombras[] = perfis;

export const DEZ_SOMBRAS_FORMAS_DERIVADAS = [
  { id: 'totalidade', nome: 'Cão Divino: Totalidade', derivaDe: ['cao-branco', 'cao-preto'], pagina: 69, grau: 'terceiro', categoria: 'quimera', descricao: 'A forma oficial resulta da quimera dos dois Cães Divinos domados e é de 3º Grau. A ficha lista a combinação, mas não publica atributos, PV, Defesa ou ações numéricas.' },
  { id: 'abismo-desconhecido-do-poco', nome: 'O Abismo Desconhecido do Poço', derivaDe: ['sapo', 'nue'], pagina: 69, grau: 'terceiro', categoria: 'quimera', descricao: 'Quimera de Gama e Nue, de 3º Grau. A ficha de forma derivada e seus valores numéricos não são publicados na nova edição.' },
  { id: 'nue-totalidade', nome: 'Nue: Totalidade', derivaDe: ['nue', 'grande-serpente'], pagina: 69, grau: 'segundo', categoria: 'quimera', descricao: 'Quimera de Nue e Orochi, de 2º Grau. A ficha de forma derivada e seus valores numéricos não são publicados na nova edição.' },
  { id: 'agito', nome: 'Agito', derivaDe: ['nue', 'grande-serpente', 'cervo-circular', 'tigre-funebre'], pagina: 69, grau: 'especial', categoria: 'quimera', descricao: 'Quimera de Nue, Orochi, Cervo Circular e Tigre Fúnebre, de Grau Especial. A ficha de forma derivada e seus valores numéricos não são publicados na nova edição.' },
] as const;


/** @deprecated Totalidade é uma quimera separada dos dois cães; não se transforma uma ficha isolada. */
export function transformarCaoEmTotalidade(_modelo: InvocacaoControlador): InvocacaoControlador | null {
  return null;
}

/** Mede uma trajetória inteiramente reta e em um só sentido; trajetórias curvas não geram bônus de investida. */
export function medirInvestidaRetaEmMetros(
  pontos: readonly { x: number; y: number }[],
  grid: { dpi: number; metersPerCell: number },
): number {
  if (pontos.length < 2 || !(grid.dpi > 0) || !(grid.metersPerCell > 0) ||
    !pontos.every(ponto => Number.isFinite(ponto.x) && Number.isFinite(ponto.y))) return 0;
  const inicio = pontos[0];
  const fim = pontos[pontos.length - 1];
  const dx = fim.x - inicio.x;
  const dy = fim.y - inicio.y;
  const comprimentoPx = Math.hypot(dx, dy);
  if (comprimentoPx < 1) return 0;
  let projecaoAnterior = -Infinity;
  for (const ponto of pontos) {
    const relativoX = ponto.x - inicio.x;
    const relativoY = ponto.y - inicio.y;
    const distanciaDaReta = Math.abs(dx * relativoY - dy * relativoX) / comprimentoPx;
    const projecao = (relativoX * dx + relativoY * dy) / comprimentoPx;
    if (distanciaDaReta > 2 || projecao + 0.5 < projecaoAnterior) return 0;
    projecaoAnterior = projecao;
  }
  return comprimentoPx / grid.dpi * grid.metersPerCell;
}

export function dadosAdicionaisInvestidaPerfurante(distanciaM: number): number {
  return Number.isFinite(distanciaM) && distanciaM > 0
    // O solver de colisão pode parar até 0,05 px antes do contato; em uma grade
    // de 70 px por 1,5 m isso equivale a pouco mais de 1 mm.
    ? Math.floor((distanciaM + 0.002) / 3)
    : 0;
}

export interface EstadoInerciaImparavelTouro {
  combateId: string;
  rodada: number;
}

export function inerciaImparavelTouroAtiva(
  estado: EstadoInerciaImparavelTouro | undefined,
  combate: { inCombat: boolean; combatId?: string | null; round?: number | null },
): boolean {
  return Boolean(estado && combate.inCombat && combate.combatId &&
    estado.combateId === combate.combatId && estado.rodada === (combate.round ?? 1));
}

export const HABILIDADES_TECNICA_DEZ_SOMBRAS = [
  { id: 'estoque-das-sombras', nome: 'Estoque das Sombras', nivel: 0, pagina: 69, automacao: 'parcial', descricao: 'Passiva: até 5 espaços de itens na própria sombra; primeira retirada é ação livre, as seguintes usam ação bônus.' },
  { id: 'ocultacao-sombria', nome: 'Ocultação Sombria', nivel: 1, pagina: 69, automacao: 'manual', descricao: 'Ação bônus, alcance 4,5 m, duração variável. Entra numa sombra e fica indetectável/invisível, sem movimento independente; pode sair à vontade ou ser expelido quando a sombra cessar. Detecção e posição de expulsão não foram definidas.' },
  { id: 'passo-sombrio', nome: 'Passo Sombrio', nivel: 1, pagina: 69, automacao: 'manual', descricao: 'Ação bônus: teleporta até a sombra de criatura não hostil a até 9 m, sem ataque de oportunidade. Visão e obstáculos não foram definidos.' },
  { id: 'fuga-do-coelho', nome: 'Fuga do Coelho', nivel: 3, pagina: 70, automacao: 'manual', descricao: 'Reação quando o usuário é alvo de ataque: coelhos negam o ataque e o usuário pode mover até 9 m para espaço livre sem ataques de oportunidade (opcional). Os coelhos não são shikigami e somem no início do próximo turno.' },
  { id: 'jardim-das-sombras-sobrepostas', nome: 'Jardim das Sombras Sobrepostas', nivel: 0, pagina: 71, automacao: 'manual', descricao: 'Expansão incompleta. Duração 1 + Aptidão de Domínio rodadas; área indicada como 4,5 m × maestria; pode receber até três efeitos: invocações persistentes, clones e chão de sombras. Seleção, custos, ação, arredondamento e término estão incompletos na fonte.' },
] as const;

export function criarPacoteDezSombras(donoCharacterId: string, incluirHomebrew = false): InvocacaoControlador[] {
  return perfis
    .filter(perfil => incluirHomebrew || !perfil.opcionalHomebrew)
    .map(perfil => {
      const id = `${donoCharacterId}-dez-sombras-${perfil.id}`;
      const acoes = perfil.acoes.map(acao => ({
        ...acao,
        ...(perfil.id === 'grande-serpente' && acao.id === 'bote-sombrio' ? {
          statusAutomacao: 'executavel' as const,
          efeitoEspecial: {
            tipo: 'agarrar_orochi_apos_acerto' as const,
            custoPE: 4,
            categoriaAcao: 'acaoLivre' as const,
          },
          descricaoRegra: 'Ação Complexa. Ao acertar, pode gastar 4 PE e tentar Agarrar como Ação Livre. Enquanto mantém o alvo agarrado, causa 2 de dano de Força automaticamente no início de cada turno do alvo.',
        } : {}),
        ...(perfil.id === 'fuga-do-coelho' && acao.id === 'horda-infindavel' ? {
          statusAutomacao: 'parcial' as const,
          descricaoRegra: 'Passiva: no início da rodada, após cada três rodadas completas da cena, acrescenta 1/5 dos PV-base (arredondado para baixo) aos PV atuais e máximos e cresce uma categoria até Colossal. O app automatiza crescimento e porte; terreno, flanqueamento e interações de dano da Horda ainda são resolvidos manualmente.',
        } : {}),
      }));
      const custosComandosConfigurados: NonNullable<InvocacaoControlador['custosComandosConfigurados']> = {};
      for (const acao of acoes) {
        if ((acao.custoPE ?? 0) <= 0) continue;
        custosComandosConfigurados[acao.id] = {
          execucao: 'manual',
          debitos: [{ entidade: 'dono', recurso: 'pe', quantidade: acao.custoPE! }],
        };
      }
      return {
        id,
        donoCharacterId,
        nome: perfil.nome,
        tipo: 'shikigami' as const,
        subcategoria: `dez-sombras:${perfil.id}`,
        pacoteRegras: 'dez-sombras' as const,
        referenciaRegra: `${FONTE_ENCICLOPEDIA_MALDITA}, Cap. 2, p. ${perfil.pagina}`,
        opcionalHomebrew: perfil.opcionalHomebrew ?? false,
        origemAquisicao: `Feiticeiros e Maldições — ${FONTE_ENCICLOPEDIA_MALDITA}, Cap. 2, p. ${perfil.pagina}`,
        historico: perfil.descricao,
        descricao: perfil.descricao,
        hpAtual: perfil.hp + (perfil.bonusPVMaximo ?? 0),
        hpMaximo: perfil.hp + (perfil.bonusPVMaximo ?? 0),
        defesa: perfil.defesa,
        deslocamentoM: perfil.deslocamentoM,
        ...(perfil.id === 'fuga-do-coelho' ? { formaToken: 'RECT' as const } : {}),
        porte: (['grande-serpente', 'elefante-maximo', 'cervo-circular', 'touro-perfurante', 'mahoraga', 'tigre-funebre'] as IdDezSombras[]).includes(perfil.id) ? 'Grande' : 'Médio',
        grau: perfil.grau,
        atributos: { ...perfil.atributos },
        ataqueTreinado: perfil.ataqueTreinado ?? { tipo: 'corpo_a_corpo', atributo: 'forca' },
        custoInvocacaoPE: perfil.custoPE,
        domado: perfil.domadoInicialmente,
        aprovacaoMestre: 'aprovada' as const,
        versaoModelo: 1,
        versaoAprovada: 1,
        atributoBasePericias: 'sabedoria' as const,
        possuiEnergiaReversa: perfil.id === 'cervo-circular',
        economiaAcoesConfigurada: {
          acaoComum: 1, acaoBonus: 1, acaoMovimento: 1, reacao: 1,
          ...(perfil.id === 'touro-perfurante' ? { acaoSimples: 1, acaoComplexa: 1 } : {}),
          ...(perfil.id === 'tigre-funebre' ? {
            acaoSimples: 1,
            acaoComplexa: 1,
            reacao: 2,
            resetPorCategoria: {
              acaoComum: 'inicio_turno_dono' as const,
              acaoSimples: 'inicio_turno_dono' as const,
              acaoComplexa: 'inicio_turno_dono' as const,
              acaoMovimento: 'inicio_turno_dono' as const,
              acaoBonus: 'inicio_turno_dono' as const,
              reacao: 'inicio_turno_dono' as const,
            },
          } : {}),
          ...(perfil.id === 'mahoraga' ? {
            acaoSimples: 1,
            acaoComplexa: 1,
            acaoLivre: 1,
            resetPorCategoria: {
              acaoComum: 'inicio_turno_dono' as const,
              acaoSimples: 'inicio_turno_dono' as const,
              acaoComplexa: 'inicio_turno_dono' as const,
              acaoMovimento: 'inicio_turno_dono' as const,
              acaoBonus: 'inicio_turno_dono' as const,
              acaoLivre: 'inicio_turno_dono' as const,
              reacao: 'inicio_turno_dono' as const,
            },
          } : {}),
        },
        ...(Object.keys(custosComandosConfigurados).length ? { custosComandosConfigurados } : {}),
        intermediario: { tipo: 'tecnica' as const, tecnicaId: 'Dez Sombras' },
        acoes,
        caracteristicas: [
          { tipo: 'fonte', texto: `${FONTE_ENCICLOPEDIA_MALDITA}, Cap. 2, p. ${perfil.pagina}` },
          ...(perfil.caracteristicas ?? []),
          ...(perfil.opcionalHomebrew ? [{ tipo: 'homebrew', texto: 'Perfil especulativo e opcional; não oficial segundo o próprio livro.' }] : []),
        ],
      };
    });
}
