import type { DamageType } from '@/types';
import type { InvocacaoControlador } from './tipos';
import { ALCANCE_BASE_INVOCACAO_M } from './alcanceInvocacao';

export type IdDezSombras =
  | 'cao-branco' | 'cao-preto' | 'nue' | 'sapo' | 'grande-serpente'
  | 'elefante-maximo' | 'cervo-circular' | 'touro-perfurante' | 'mahoraga'
  | 'tigre-funebre';

type AcaoFonte = InvocacaoControlador['acoes'][number] & {
  descricaoRegra?: string;
  statusAutomacao?: 'executavel' | 'parcial' | 'manual';
  formulaCura?: string;
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
  acoes: AcaoFonte[];
}

export function ataque(input: {
  id: string; nome: string; dano: string; tipoDano: DamageType; alcanceM?: number;
  bonusAtaque: number; atributoAtaque?: 'forca' | 'destreza'; descricaoRegra?: string;
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
    multiplicadorDanoAtributo: 0,
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
    id: 'cao-branco', nome: 'Cão Divino Branco', grau: 'quarto', custoPE: 2, hp: 25, defesa: 19, deslocamentoM: 10.5,
    atributos: { forca: 12, destreza: 16, constituicao: 10, inteligencia: 8, sabedoria: 6, presenca: 6 },
    pagina: 55, domadoInicialmente: true,
    descricao: 'Mordida: 1,5 m, +5, 2d8+3 perfurante. Alcateia: a fonte condiciona o bônus a outro shikigami estar a até 1,5 m do alvo e diz que “ele” recebe +2; o antecedente do pronome é ambíguo, então o Mestre define o beneficiário e a aplicação. Regra definida pelo usuário: cada Cão custa 2 PE; invocar o par custa 4 PE. Perfil-base do livro para nível 1 e maestria +2.',
    acoes: [ataque({ id: 'mordida', nome: 'Mordida', dano: '2d8+3', tipoDano: 'DP', alcanceM: 1.5, bonusAtaque: 4 }), { ...habilidade('alcateia', 'Alcateia', 'A fonte condiciona o bônus a outro Shikigami estar a até 1,5 m do alvo e diz que “ele” recebe +2; o antecedente do pronome é ambíguo, então o Mestre define o beneficiário e a aplicação.'), statusAutomacao: 'manual' }],
  },
  {
    id: 'cao-preto', nome: 'Cão Divino Preto', grau: 'quarto', custoPE: 2, hp: 25, defesa: 19, deslocamentoM: 10.5,
    atributos: { forca: 12, destreza: 16, constituicao: 10, inteligencia: 8, sabedoria: 6, presenca: 6 },
    pagina: 55, domadoInicialmente: true,
    descricao: 'Mordida: 1,5 m, +5, 2d8+3 perfurante. Alcateia: a fonte condiciona o bônus a outro shikigami estar a até 1,5 m do alvo e diz que “ele” recebe +2; o antecedente do pronome é ambíguo, então o Mestre define o beneficiário e a aplicação. Regra definida pelo usuário: cada Cão custa 2 PE; invocar o par custa 4 PE. Perfil-base do livro para nível 1 e maestria +2.',
    acoes: [ataque({ id: 'mordida', nome: 'Mordida', dano: '2d8+3', tipoDano: 'DP', alcanceM: 1.5, bonusAtaque: 4 }), { ...habilidade('alcateia', 'Alcateia', 'A fonte condiciona o bônus a outro Shikigami estar a até 1,5 m do alvo e diz que “ele” recebe +2; o antecedente do pronome é ambíguo, então o Mestre define o beneficiário e a aplicação.'), statusAutomacao: 'manual' }],
  },
  {
    id: 'nue', nome: 'Nue', grau: 'quarto', custoPE: 3, hp: 25, defesa: 19, deslocamentoM: 10.5,
    atributos: { forca: 12, destreza: 16, constituicao: 10, inteligencia: 8, sabedoria: 6, presenca: 6 },
    pagina: 56, domadoInicialmente: false,
    descricao: 'Rasante Elétrico: ação complexa, 3 m, +5, 2d8+3 chocante. Alado concede voo. Montaria permite ao montado usar o movimento de Nue; procedimento de montar e desmontar não está especificado. Perfil-base do livro para nível 1 e maestria +2.',
    acoes: [
      ataque({ id: 'rasante-eletrico', nome: 'Rasante Elétrico', dano: '2d8+3', tipoDano: 'DCC', alcanceM: 3, bonusAtaque: 2, atributoAtaque: 'destreza' }),
      habilidade('alado', 'Alado', 'Nue pode voar. O perfil não especifica manobras, limite de altitude ou regras de carga.'),
      habilidade('montaria', 'Montaria', 'Uma criatura montada usa o movimento de Nue. Montar e desmontar não têm procedimento definido no material-fonte.'),
    ],
  },
  {
    id: 'sapo', nome: 'Sapo', grau: 'quarto', custoPE: 3, hp: 25, defesa: 18, deslocamentoM: 9,
    atributos: { forca: 16, destreza: 14, constituicao: 10, inteligencia: 6, sabedoria: 6, presenca: 6 },
    pagina: 57, domadoInicialmente: false,
    descricao: 'Segurar: língua até 9 m, disputa Luta contra Atletismo e aplica Agarrado; o alvo pode tentar escapar no início de seus turnos. Arremessar: ação Complexa apenas contra alvo agarrado; lança a criatura a um ponto desocupado até 6 m, encerra o agarrão e causa 2d6+3 de impacto. O TR de Reflexos causa Caído em caso de falha; a fonte não descreve redução de dano no sucesso nem define a CD, a origem da distância ou a visibilidade do ponto. Fora de Risco: reação até 4,5 m, compara Reflexos do Sapo com o total do ataque; se superar, nega o ataque e move a criatura protegida até 3 m para espaço livre. Desempate, consentimento e origem da distância não são definidos.',
    acoes: [
      ataque({ id: 'arremessar', nome: 'Arremessar', dano: '2d6+3', tipoDano: 'DI', bonusAtaque: 0, statusAutomacao: 'manual', descricaoRegra: 'Somente contra alvo Agarrado. Escolha manualmente ponto desocupado a até 6 m; a fonte não define a origem da distância nem a visibilidade do ponto. O agarrão termina e o alvo sofre 2d6+3 de impacto; o TR de Reflexos causa Caído em caso de falha. A fonte não descreve redução de dano no sucesso nem define a fórmula da CD.' }),
      { ...habilidade('segurar', 'Segurar', 'Ação Simples: disputa o Luta +5 do Sapo contra Atletismo do alvo até 9 m; sucesso aplica Agarrado. A tentativa de fuga é tratada no início do turno do alvo conforme a ficha.', 'acao_simples'), alcanceM: 9, statusAutomacao: 'executavel' },
      habilidade('fora-de-risco', 'Fora de Risco', 'Reação para proteger criatura até 4,5 m: teste de Reflexos do Sapo contra o total do ataque; se superar, anula o ataque e move o protegido até 3 m para espaço livre. Empate e aceitação do deslocamento permanecem indefinidos.', 'reacao'),
    ],
  },
  {
    id: 'grande-serpente', nome: 'Grande Serpente', grau: 'quarto', custoPE: 4, hp: 25, defesa: 19, deslocamentoM: 10.5,
    atributos: { forca: 14, destreza: 16, constituicao: 10, inteligencia: 6, sabedoria: 6, presenca: 6 },
    pagina: 58, domadoInicialmente: false,
    descricao: 'Entrelaçar disputa Luta da Serpente contra Atletismo do alvo e aplica Agarrado; a fuga no início do turno é contra Acrobacia da Serpente. Mordida: 3 m, +5, 2d8+3 perfurante. Flexível concede +2 em Acrobacia. Alcance e limite de tamanho do agarrão não são definidos.',
    acoes: [
      ataque({ id: 'mordida', nome: 'Mordida', dano: '2d8+3', tipoDano: 'DP', alcanceM: 3, bonusAtaque: 3 }),
      habilidade('entrelacar', 'Entrelaçar', 'Disputa Luta da Serpente contra Atletismo do alvo e aplica Agarrado; o alvo pode tentar escapar no início do próprio turno contra Acrobacia da Serpente. Alcance e limite de tamanho não constam da ficha.'),
      { ...habilidade('flexivel', 'Flexível', 'Concede +2 em Acrobacia; o bônus é aplicado automaticamente nos testes de perícia da Serpente.'), statusAutomacao: 'executavel' },
    ],
    caracteristicas: [{ tipo: 'caracteristica', nome: 'Flexível', texto: 'Bônus de +2 em Acrobacia.', efeitoOperacional: { tipo: 'bonus_pericia', pericia: 'acrobacia' } }],
  },
  {
    id: 'elefante-maximo', nome: 'Elefante Máximo', grau: 'terceiro', custoPE: 7, hp: 80, defesa: 22, deslocamentoM: 6,
    atributos: { forca: 18, destreza: 7, constituicao: 20, inteligencia: 6, sabedoria: 6, presenca: 6 },
    pagina: 59, domadoInicialmente: false, bonusPVMaximo: 10,
    descricao: 'Golpe com Tromba: 3 m, +6, 2d12+4 impacto; a ficha não dá empurrão a este golpe. Torrente de Água: alcance 12 m, Fortitude, 2d10+4 impacto; sucesso causa metade e não empurra, falha empurra 4,5 m. Defesa alternativa por Constituição; Grande; Robustez soma +10 PV máximos aos 80 PV do perfil (90 no total).',
    acoes: [
      ataque({ id: 'golpe-tromba', nome: 'Golpe com Tromba', dano: '2d12+4', tipoDano: 'DI', alcanceM: 3, bonusAtaque: 2 }),
      { id: 'torrente-agua', nome: 'Torrente de Água', tipo: 'ataque', tipoExecucao: 'manual', teste: 'resistencia', categoriaAcao: 'acao_complexa', resistenciaAlvo: 'Fortitude', atributoCD: 'constituicao', multiplicadorDanoAtributo: 0, dano: '2d10+4', tipoDano: 'DI', danoNoSucesso: 'metade', alcanceM: 12, statusAutomacao: 'executavel', descricaoRegra: 'No sucesso do TR de Fortitude, o alvo sofre metade do dano e não é empurrado. Na falha, é empurrado 4,5 m, mesmo se o dano for 0; paredes ou tokens podem interromper o movimento.' },
      habilidade('defesa-alternativa', 'Defesa Alternativa (Constituição)', 'O perfil lista Defesa Alternativa por Constituição, sem fórmula de recalcular Defesa; aplicação manual.'),
      { ...habilidade('robustez', 'Robustez', 'A característica adiciona +10 PV máximos aos 80 PV-base (90 no total), já aplicados ao perfil.'), statusAutomacao: 'executavel' },
    ],
  },
  {
    id: 'cervo-circular', nome: 'Cervo Circular', grau: 'segundo', custoPE: 7, hp: 70, defesa: 17, deslocamentoM: 6,
    atributos: { forca: 14, destreza: 8, constituicao: 14, inteligencia: 6, sabedoria: 10, presenca: 20 },
    pagina: 60, domadoInicialmente: false,
    descricao: 'Cura Concentrada cura um alvo a até 4,5 m em 3d10+5 PV. Liberar Energia Reversa cura todas as criaturas em até 3 m em 2d12+5 PV cada. Fluxo Reverso: energia amaldiçoada não afeta objetos até 3 m; criaturas nessa área recebem +6 em testes contra efeitos de técnicas amaldiçoadas. Auto-inclusão e limites de área não são detalhados.',
    acoes: [
      cura({ id: 'cura-concentrada', nome: 'Cura Concentrada', formula: '3d10+5', alcanceM: 4.5, custoPE: 2 }),
      cura({ id: 'liberar-energia-reversa', nome: 'Liberar Energia Reversa', formula: '2d12+5', alcanceM: 3, alvos: 'multiplos', custoPE: 2, todosNoAlcance: true, permiteInimigos: true, descricaoRegra: 'Cura todas as criaturas em até 3 m em 2d12+5 PV cada.' }),
      habilidade('fluxo-reverso', 'Fluxo Reverso', 'Aura de 3 m: impede energia amaldiçoada de afetar objetos e concede +6 a criaturas em testes contra efeitos de técnicas amaldiçoadas. A seleção de objetos e a integração de bônus situacionais precisam de regra própria.'),
    ],
  },
  {
    id: 'touro-perfurante', nome: 'Touro Perfurante', grau: 'segundo', custoPE: 6, hp: 85, defesa: 17, deslocamentoM: 16.5,
    atributos: { forca: 24, destreza: 8, constituicao: 18, inteligencia: 6, sabedoria: 6, presenca: 6 },
    pagina: 61, domadoInicialmente: false,
    descricao: 'Investida Perfurante: ação complexa, 1,5 m, +9, 2d10+7 perfurante e +1d10 a cada 3 m percorridos em linha reta antes do ataque. O movimento confirmado no mapa registra o percurso retilíneo e o ataque consome o bônus no turno. Movimento usa Força; Grande.',
    acoes: [ataque({ id: 'investida-perfurante', nome: 'Investida Perfurante', dano: '2d10+7', tipoDano: 'DP', alcanceM: 1.5, bonusAtaque: 2, statusAutomacao: 'executavel', descricaoRegra: 'Adiciona +1d10 por cada 3 m percorridos em linha reta no movimento confirmado neste turno; a marca é consumida na tentativa de Investida. Curvas não contam. A fonte não define teto de dados.' }), habilidade('movimento-alternativo', 'Movimento Alternativo (Força)', 'O deslocamento do perfil usa Força; o cálculo dinâmico ainda não está integrado.')],
  },
  {
    id: 'mahoraga', nome: 'General Divino Mahoraga', grau: 'especial', custoPE: 18, hp: 200, defesa: 26, deslocamentoM: 9,
    atributos: { forca: 24, destreza: 14, constituicao: 22, inteligencia: 8, sabedoria: 12, presenca: 8 },
    pagina: 62, domadoInicialmente: false, bonusPVMaximo: 40,
    descricao: 'Adaptação Defensiva: após receber um tipo de dano, ganha resistência após 1 rodada e imunidade após outra; duração e dano simultâneo não estão definidos. Adaptação Ofensiva acumula +5 contra um alvo após cada tentativa que erra, permanecendo após o primeiro acerto; sem teto. Burlar Defesas reduz níveis de resistência após acertos em intervalos de rodada; escopo de alvo/tipo não está definido. Robustez soma +40 PV máximos aos 200 PV do perfil (240 no total). Ações com dados e cura são executáveis; as três adaptações ainda precisam de estado de combate próprio.',
    acoes: [
      ataque({ id: 'golpe-punho', nome: 'Golpe com Punho', dano: '4d12+7', tipoDano: 'DI', alcanceM: 3, bonusAtaque: 2 }),
      ataque({ id: 'espada-energia-reversa', nome: 'Espada da Exterminação — Energia Reversa', dano: '4d12+7', tipoDano: 'DNR', alcanceM: 3, bonusAtaque: 2, descricaoRegra: 'Escolha esta versão quando a energia reversa for apropriada ao alvo. O critério da fonte não é formalizado.' }),
      ataque({ id: 'espada-forca', nome: 'Espada da Exterminação — Força', dano: '4d12+7', tipoDano: 'DE', alcanceM: 3, bonusAtaque: 2, descricaoRegra: 'Versão de dano de força; o critério para escolher o tipo não é formalizado na fonte.' }),
      cura({ id: 'regeneracao', nome: 'Regeneração', formula: '5d10+6', alcanceM: 0, somenteProprio: true, curaRealSemCusto: true }),
      habilidade('adaptacao-defensiva', 'Adaptação Defensiva', 'Após receber um tipo de dano, resistência após 1 rodada e imunidade após outra. Duração, tipos simultâneos e marco exato permanecem sem definição.'),
      habilidade('adaptacao-ofensiva', 'Adaptação Ofensiva', 'Cada tentativa que não acerta um alvo concede +5 cumulativo contra ele até o primeiro acerto; o bônus permanece depois. Sem teto ou definição de tentativa elegível.'),
      habilidade('burlar-defesas', 'Burlar Defesas', 'Ao acertar alvo resistente, depois de 1 rodada ignora um nível de resistência e após outra ignora por completo. A ficha não define progressão por alvo/tipo nem reinício.'),
      { ...habilidade('robustez', 'Robustez', 'A característica adiciona +40 PV máximos aos 200 PV-base (240 no total), já aplicados ao perfil.'), statusAutomacao: 'executavel' },
    ],
  },
  {
    id: 'tigre-funebre', nome: 'Tigre Fúnebre', grau: 'segundo', custoPE: 7, hp: 80, defesa: 19, deslocamentoM: 9,
    atributos: { forca: 20, destreza: 14, constituicao: 16, inteligencia: 6, sabedoria: 6, presenca: 6 },
    pagina: 67, domadoInicialmente: false, opcionalHomebrew: true,
    descricao: 'HOMEbrew opcional: o próprio livro classifica este bloco como especulativo e não oficial, sem garantia de fidelidade à técnica original. Presas Fúnebres: 3 m, +7, 3d10+5 necrótico. Garras Rápidas: 3 m, +7, 3d10+5 cortante (mapeado para dano físico cortante do sistema). Arauto do Funeral impede recuperar metade dos PV perdidos pelo dano necrótico durante 1 rodada.',
    acoes: [
      ataque({ id: 'presas-funebres', nome: 'Presas Fúnebres', dano: '3d10+5', tipoDano: 'DN', alcanceM: 3, bonusAtaque: 2 }),
      ataque({ id: 'garras-rapidas', nome: 'Garras Rápidas', dano: '3d10+5', tipoDano: 'DCO', alcanceM: 3, bonusAtaque: 2 }),
      habilidade('arauto-do-funeral', 'Arauto do Funeral', 'Uma criatura atingida pelo dano necrótico do Tigre não pode recuperar metade dos PV perdidos para esse ataque durante 1 rodada. Bloqueio de cura por origem requer integração própria.'),
    ],
  },
];

export const DEZ_SOMBRAS_MODELOS: readonly ModeloFonteDezSombras[] = perfis;

export const DEZ_SOMBRAS_FORMAS_DERIVADAS = [
  { id: 'totalidade', nome: 'Totalidade', derivaDe: ['cao-branco', 'cao-preto'], pagina: 65, categoria: 'forma', descricao: 'Transformação do Cão sobrevivente somente após o outro sofrer exorcismo permanente (regra definida pelo usuário; 0 PV ou dissipação não ativam Totalidade). Não é uma décima identidade. Perfil publicado: 35 PV máximos, Defesa 22, deslocamento 12 m, mordida +8, 3d8+6 perfurante.' },
  { id: 'abismo-desconhecido-do-poco', nome: 'O Abismo Desconhecido do Poço', derivaDe: ['nue', 'sapo'], pagina: 66, categoria: 'quimera', descricao: 'Quimera de Nue e Sapo que requer a especialização Quimera; grau 4º, 6 PE, 50 PV, Defesa 21, voo e movimento 10,5 m. Inclui Segurar, Fora de Risco, Alado e Grupo (3 sapos). A composição e a perda de membros precisam de regras próprias.' },
  { id: 'agito', nome: 'Agito', derivaDe: ['nue', 'grande-serpente', 'tigre-funebre', 'cervo-circular'], pagina: 68, categoria: 'heranca', descricao: 'Forma descrita como oficial pelo RPG, mas inclui Tigre Fúnebre, cuja ficha é especulativa. Grau 2º, 7 PE, 120 PV, Defesa 27, movimento 18 m; Golpes Eletrificados +11, 5d10+6 chocante; Cura Concentrada 5d10+3; Regeneração Superior como reação. Fórmulas de composição e gatilhos têm limites editoriais.' },
] as const;


/** Transforma o perfil do C?o sobrevivente ap?s o exorcismo permanente do outro. */
export function transformarCaoEmTotalidade(modelo: InvocacaoControlador): InvocacaoControlador | null {
  if (
    modelo.pacoteRegras !== 'dez-sombras' ||
    !['dez-sombras:cao-branco', 'dez-sombras:cao-preto'].includes(modelo.subcategoria ?? '')
  ) return null;

  const forma = DEZ_SOMBRAS_FORMAS_DERIVADAS.find(item => item.id === 'totalidade');
  return {
    ...modelo,
    nome: 'C\u00e3o Divino Totalidade',
    subcategoria: 'dez-sombras:totalidade',
    referenciaRegra: 'Enciclop\u00e9dia Amaldi\u00e7oada v0.9, Cap. 2, p. 65',
    descricao: forma?.descricao ?? modelo.descricao,
    historico: forma?.descricao ?? modelo.historico,
    hpAtual: Number.isFinite(modelo.hpAtual) ? Math.min(Math.trunc(modelo.hpAtual), 35) : 0,
    hpMaximo: 35,
    defesa: 22,
    deslocamentoM: 12,
    acoes: modelo.acoes.map(acao => acao.id === 'mordida'
      ? {
          ...acao,
          nome: 'Mordida (Totalidade)',
          dano: '3d8+6',
          tipoDano: 'DP',
          alcanceM: 1.5,
          bonusAtaque: 7,
          statusAutomacao: 'executavel',
          descricaoRegra: 'Perfil publicado: +8 no acerto no n\u00edvel 1 com maestria +2; 3d8+6 perfurante. A fonte também prevê +4 de Alcateia se outro shikigami estiver a at\u00e9 1,5 m do alvo e diz que “ele” recebe o bônus; o antecedente do pronome é ambíguo, então o Mestre define o benefici\u00e1rio e a aplica\u00e7\u00e3o.',
        }
      : acao.id === 'alcateia'
        ? { ...acao, statusAutomacao: 'manual', descricaoRegra: 'A fonte prevê +4 se outro shikigami estiver a at\u00e9 1,5 m do alvo e diz que “ele” recebe o bônus; o antecedente do pronome é ambíguo, então o Mestre define o benefici\u00e1rio e a aplica\u00e7\u00e3o.' }
        : { ...acao }),
  };
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
    ? Math.floor((distanciaM + 1e-6) / 3)
    : 0;
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
      const acoes = perfil.acoes.map(acao => ({ ...acao }));
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
        referenciaRegra: `Enciclopédia Amaldiçoada v0.9, Cap. 2, p. ${perfil.pagina}`,
        opcionalHomebrew: perfil.opcionalHomebrew ?? false,
        origemAquisicao: `Feiticeiros e Maldições — ${`Enciclopédia Amaldiçoada v0.9, Cap. 2, p. ${perfil.pagina}`}`,
        historico: perfil.descricao,
        descricao: perfil.descricao,
        hpAtual: perfil.hp + (perfil.bonusPVMaximo ?? 0),
        hpMaximo: perfil.hp + (perfil.bonusPVMaximo ?? 0),
        defesa: perfil.defesa,
        deslocamentoM: perfil.deslocamentoM,
        porte: (['grande-serpente', 'elefante-maximo', 'cervo-circular', 'touro-perfurante', 'mahoraga', 'tigre-funebre'] as IdDezSombras[]).includes(perfil.id) ? 'Grande' : 'Médio',
        grau: perfil.grau,
        atributos: { ...perfil.atributos },
        custoInvocacaoPE: perfil.custoPE,
        alcanceInvocacaoM: ALCANCE_BASE_INVOCACAO_M,
        domado: perfil.domadoInicialmente,
        aprovacaoMestre: 'aprovada' as const,
        versaoModelo: 1,
        versaoAprovada: 1,
        atributoBasePericias: 'sabedoria' as const,
        possuiEnergiaReversa: perfil.id === 'cervo-circular',
        economiaAcoesConfigurada: { acaoComum: 1, acaoBonus: 1, acaoMovimento: 1, reacao: 1 },
        ...(Object.keys(custosComandosConfigurados).length ? { custosComandosConfigurados } : {}),
        intermediario: { tipo: 'tecnica' as const, tecnicaId: 'Dez Sombras' },
        acoes,
        caracteristicas: [
          { tipo: 'fonte', texto: `Enciclopédia Amaldiçoada v0.9, Cap. 2, p. ${perfil.pagina}` },
          ...(perfil.caracteristicas ?? []),
          ...(perfil.opcionalHomebrew ? [{ tipo: 'homebrew', texto: 'Perfil especulativo e opcional; não oficial segundo o próprio livro.' }] : []),
        ],
      };
    });
}
