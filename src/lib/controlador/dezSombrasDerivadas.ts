import type { InvocacaoControlador } from './tipos';
import { ALCANCE_BASE_INVOCACAO_M } from './alcanceInvocacao';
import { ataque, cura } from './dezSombras';

/** Formas descritas à parte no material da Enciclopédia; não são novos membros-base. */
export const DEZ_SOMBRAS_FORMAS_DERIVADAS = [
  {
    id: 'abismo-desconhecido-do-poco',
    nome: 'O Abismo Desconhecido do Poço',
    pagina: 66,
    requisitos: ['Nue domado', 'Sapo domado', 'Especialização Quimera'],
    lacunas: [
      'Porte e atributos não são especificados; o porte Médio exibido é provisório.',
      'A composição da quimera e a perda de membros não têm regra operacional definida.',
      'Segurar exige que o Mestre informe explicitamente 1-3 sapos vivos; a fuga, Fora de Risco, Alado e Grupo (3 sapos) permanecem manuais.',
    ],
  },
  {
    id: 'agito',
    nome: 'Agito',
    pagina: 68,
    requisitos: [
      'Nue como forma-base',
      'Heranças de Grande Serpente, Tigre Fúnebre e Cervo Circular',
    ],
    lacunas: [
      'A fórmula de composição e os gatilhos de herança são incompletos.',
      'A composição depende do Tigre Fúnebre, ficha marcada como especulativa e homebrew opcional.',
      'Golpes Eletrificados é executável. Cura Concentrada permanece manual porque a fonte não informa custo; Regeneração Superior permanece manual por lacunas de gatilho e frequência.',
    ],
  },
] as const;

const habilidadeManual = (id: string, nome: string, descricaoRegra: string, extra: Record<string, unknown> = {}) => ({
  id,
  nome,
  tipo: 'habilidade' as const,
  tipoExecucao: 'manual' as const,
  statusAutomacao: 'manual' as const,
  descricaoRegra,
  ...extra,
});

/** Cria fichas isoladas, inicialmente bloqueadas para confirmação manual do Mestre. */
export function criarFormasDerivadasDezSombras(donoCharacterId: string): InvocacaoControlador[] {
  const base: Omit<InvocacaoControlador, 'id' | 'nome' | 'hpAtual' | 'hpMaximo' | 'defesa' | 'deslocamentoM' | 'porte' | 'grau' | 'custoInvocacaoPE' | 'acoes'> = {
    donoCharacterId,
    tipo: 'shikigami',
    pacoteRegras: 'dez-sombras',
    formaDerivada: true,
    domado: false,
    opcionalHomebrew: false,
    aprovacaoMestre: 'aprovada',
    versaoModelo: 1,
    versaoAprovada: 1,
    atributoBasePericias: 'sabedoria',
    economiaAcoesConfigurada: { acaoComum: 1, acaoBonus: 1, acaoMovimento: 1, reacao: 1 },
    intermediario: { tipo: 'tecnica', tecnicaId: 'Dez Sombras' },
    origemAquisicao: 'Feiticeiros e Maldições — Enciclopédia Amaldiçoada v0.9, Cap. 2',
    alcanceInvocacaoM: ALCANCE_BASE_INVOCACAO_M,
  };

  return [
    {
      ...base,
      id: `${donoCharacterId}-dez-sombras-abismo-desconhecido-do-poco`,
      nome: 'O Abismo Desconhecido do Poço',
      subcategoria: 'dez-sombras:abismo-desconhecido-do-poco',
      referenciaRegra: 'Enciclopédia Amaldiçoada v0.9, Cap. 2, pp. 64, 66',
      hpAtual: 50,
      hpMaximo: 50,
      defesa: 21,
      deslocamentoM: 10.5,
      porte: 'Médio',
      valoresProvisoriosFormaDerivada: ['porte', 'atributos'],
      grau: 'quarto',
      custoInvocacaoPE: 6,
      requisitosFormaDerivada: [...DEZ_SOMBRAS_FORMAS_DERIVADAS[0].requisitos],
      lacunasFormaDerivada: [
        'Porte e atributos não são especificados; o porte Médio exibido é provisório.',
        'A composição da quimera e a perda de membros não têm regra operacional definida.',
        'Fuga de Segurar, Fora de Risco, Alado e Grupo (3 sapos) permanecem manuais.',
      ],
      descricao: 'Quimera de Nue e Sapo, grau 4, 6 PE, 50 PV, Defesa 21, voo e deslocamento 10,5 m. Requisitos ainda precisam de confirmação manual do Mestre. Porte e atributos não especificados; o porte exibido é provisório. Segurar é parcial: exige contagem de sapos vivos confirmada pelo Mestre; a fuga, Fora de Risco, Alado e Grupo permanecem manuais.',
      historico: 'Quimera de Nue e Sapo — Enciclopédia Amaldiçoada v0.9, Cap. 2, pp. 64, 66.',
      acoes: [
        habilidadeManual('segurar', 'Segurar', 'Ação Simples: disputa o Luta do Abismo contra Atletismo do alvo até 9 m e aplica Agarrado em caso de sucesso. O Mestre informa a quantidade atual de sapos vivos: +5 com um, +7 com dois ou +9 com três. Não inferir a contagem pelos PV. A tentativa de fuga é indicada no início de cada turno, mas custo de ação e comparação exata permanecem manuais.', { categoriaAcao: 'acao_simples', alcanceM: 9, statusAutomacao: 'parcial' }),
        habilidadeManual('fora-de-risco', 'Fora de Risco', 'A habilidade consta na ficha derivada; reação, alvo e resolução permanecem manuais.'),
        habilidadeManual('alado', 'Alado', 'A ficha indica voo. Movimento aéreo e limites operacionais permanecem manuais.'),
        habilidadeManual('grupo', 'Grupo (3 sapos)', 'A forma inclui 3 sapos. A composição, tokens, PV partilhados e comandos não têm regra operacional definida e permanecem manuais.'),
      ],
      caracteristicas: [
        { tipo: 'forma_derivada', texto: 'Não conta como indivíduo-base adicional das Dez Sombras.' },
        { tipo: 'requisito', texto: 'Nue domado; Sapo domado; Especialização Quimera. Confirmação manual do Mestre.' },
        { tipo: 'provisorio', texto: 'Porte e atributos não especificados na fonte; porte exibido como Médio provisório.' },
      ],
    },
    {
      ...base,
      id: `${donoCharacterId}-dez-sombras-agito`,
      nome: 'Agito',
      subcategoria: 'dez-sombras:agito',
      referenciaRegra: 'Enciclopédia Amaldiçoada v0.9, Cap. 2, pp. 64, 68',
      hpAtual: 120,
      hpMaximo: 120,
      defesa: 27,
      deslocamentoM: 18,
      porte: 'Grande',
      grau: 'segundo',
      custoInvocacaoPE: 7,
      requisitosFormaDerivada: [...DEZ_SOMBRAS_FORMAS_DERIVADAS[1].requisitos],
      lacunasFormaDerivada: [...DEZ_SOMBRAS_FORMAS_DERIVADAS[1].lacunas],
      descricao: 'Forma derivada de Nue com heranças de Grande Serpente, Tigre Fúnebre e Cervo Circular; grau 2, 7 PE, 120 PV, Defesa 27, deslocamento 18 m, porte Grande. A fórmula de composição e os gatilhos são incompletos; a dependência do Tigre Fúnebre é especulativa/homebrew. Golpes Eletrificados (+11, 5d10+6 chocante) é executável. Cura Concentrada (5d10+3) permanece manual porque o custo não está publicado; Regeneração Superior como reação também permanece manual.',
      historico: 'Forma descrita como oficial pelo RPG; composição dependente da ficha especulativa do Tigre Fúnebre — Enciclopédia Amaldiçoada v0.9, Cap. 2, pp. 64, 68.',
      acoes: [
        ataque({ id: 'golpes-eletrificados', nome: 'Golpes Eletrificados', dano: '5d10+6', tipoDano: 'DCC', alcanceM: 3, bonusAtaque: 11 }),
        { ...cura({ id: 'cura-concentrada', nome: 'Cura Concentrada', formula: '5d10+3', alcanceM: 4.5, alvos: 'unico', descricaoRegra: 'Um alvo a até 4,5 m recupera 5d10+3 PV. O custo não é informado pela fonte; a execução permanece manual até decisão do Mestre.' }), statusAutomacao: 'manual' },
        habilidadeManual('regeneracao-superior', 'Regeneração Superior', 'Ao receber dano, Agito pode usar uma reação para curar a si mesmo em valor igual à Cura Concentrada (5d10+3). A fonte não define o uso diante de múltiplas instâncias de dano nem o limite de PV; esses pontos permanecem manuais.', { categoriaAcao: 'reacao' }),
      ],
      caracteristicas: [
        { tipo: 'forma_derivada', texto: 'Não conta como indivíduo-base adicional das Dez Sombras.' },
        { tipo: 'requisito', texto: 'Nue como forma-base e heranças de Grande Serpente, Tigre Fúnebre e Cervo Circular. Confirmação manual do Mestre.' },
        { tipo: 'homebrew', texto: 'A composição depende do Tigre Fúnebre, perfil especulativo e opcional.' },
      ],
    },
  ];
}
