import type { InvocacaoControlador } from './tipos';
import { FONTE_ENCICLOPEDIA_MALDITA } from './dezSombras';
import { regrasGrau, type GrauShikigami } from './regrasShikigami';

/** Formas oficiais da p. 69; a nova edição lista composição e grau, sem publicar fichas completas. */
export const DEZ_SOMBRAS_FORMAS_DERIVADAS = [
  {
    id: 'totalidade',
    nome: 'Cão Divino: Totalidade',
    pagina: 69,
    grau: 'terceiro',
    requisitos: ['Cão Branco domado', 'Cão Preto domado', 'ritual de quimera'],
    lacunas: ['A fonte não publica atributos, PV, Defesa, deslocamento, custo ou ações da forma.'],
  },
  {
    id: 'abismo-desconhecido-do-poco',
    nome: 'O Abismo Desconhecido do Poço',
    pagina: 69,
    grau: 'terceiro',
    requisitos: ['Gama domado', 'Nue domado', 'ritual de quimera'],
    lacunas: ['A fonte não publica atributos, PV, Defesa, deslocamento, custo ou ações da forma.'],
  },
  {
    id: 'nue-totalidade',
    nome: 'Nue: Totalidade',
    pagina: 69,
    grau: 'segundo',
    requisitos: ['Nue domado', 'Orochi domado', 'ritual de quimera'],
    lacunas: ['A fonte não publica atributos, PV, Defesa, deslocamento, custo ou ações da forma.'],
  },
  {
    id: 'agito',
    nome: 'Agito',
    pagina: 69,
    grau: 'especial',
    requisitos: ['Nue domado', 'Orochi domado', 'Cervo Circular domado', 'Tigre Fúnebre domado', 'ritual de quimera'],
    lacunas: ['A fonte não publica atributos, PV, Defesa, deslocamento, custo ou ações da forma.'],
  },
] as const;

export interface ComparacaoBenchmarkFormaDerivada {
  campo: 'PV' | 'Defesa' | 'Custo de invocação';
  valorProvisorio: number;
  referenciaGrau: number;
  diferenca: number;
}

/** Compara valores herdados/provisórios com a base do grau para dar ao Mestre
 * um resumo de auditoria. A referência não é limite: a fonte não publica a ficha
 * das formas derivadas e os deltas continuam sujeitos à aprovação da mesa. */
export function auditarValoresProvisoriosFormaDerivadaDezSombras(
  ficha: Pick<InvocacaoControlador, 'formaDerivada' | 'grau' | 'hpMaximo' | 'defesa' | 'deslocamentoM' | 'custoInvocacaoPE' | 'valoresProvisoriosFormaDerivada'>,
): ComparacaoBenchmarkFormaDerivada[] {
  if (!ficha.formaDerivada || !ficha.grau) return [];
  const base = regrasGrau(ficha.grau as GrauShikigami);
  const valores: Array<[ComparacaoBenchmarkFormaDerivada['campo'], number, number, string]> = [
    ['PV', ficha.hpMaximo, base.pvBase, 'PV'],
    ['Defesa', ficha.defesa, base.defesaBase, 'Defesa'],
    ['Custo de invocação', ficha.custoInvocacaoPE, base.custo, 'custoInvocacaoPE'],
  ];
  const provisórios = new Set(ficha.valoresProvisoriosFormaDerivada ?? []);
  return valores.filter(([, atual, , chave]) => provisórios.has(chave) && Number.isFinite(atual))
    .map(([campo, valorProvisorio, referenciaGrau]) => ({
      campo,
      valorProvisorio,
      referenciaGrau,
      diferenca: valorProvisorio - referenciaGrau,
    }));
}

const fontePagina = `${FONTE_ENCICLOPEDIA_MALDITA}, Cap. 2, p. 69`;
const lacunaNumerica = 'A p. 69 lista a composição e o Grau, mas não fornece uma ficha numérica. Os valores desta ficha são estimativas locais herdadas do pacote anterior e precisam ser revisados/aprovados pelo Mestre.';

function criarFichaDerivada(input: {
  donoCharacterId: string;
  id: typeof DEZ_SOMBRAS_FORMAS_DERIVADAS[number]['id'];
  nome: string;
  grau: NonNullable<InvocacaoControlador['grau']>;
  custoPE: number;
  hp: number;
  defesa: number;
  deslocamentoM: number;
  porte: NonNullable<InvocacaoControlador['porte']>;
  requisitos: readonly string[];
  lacunas: readonly string[];
  origem: readonly string[];
}): InvocacaoControlador {
  const grauDescricao = input.grau === 'especial'
    ? 'Grau Especial'
    : `${({ primeiro: '1º', segundo: '2º', terceiro: '3º', quarto: '4º' } as const)[input.grau]} Grau`;
  return {
    id: `${input.donoCharacterId}-dez-sombras-${input.id}`,
    donoCharacterId: input.donoCharacterId,
    nome: input.nome,
    tipo: 'shikigami',
    pacoteRegras: 'dez-sombras',
    subcategoria: `dez-sombras:${input.id}`,
    formaDerivada: true,
    domado: false,
    opcionalHomebrew: false,
    aprovacaoMestre: 'pendente',
    versaoModelo: 1,
    versaoAprovada: 1,
    atributoBasePericias: 'sabedoria',
    economiaAcoesConfigurada: { acaoComum: 1, acaoBonus: 1, acaoMovimento: 1, reacao: 1 },
    intermediario: { tipo: 'tecnica', tecnicaId: 'Dez Sombras' },
    origemAquisicao: `Feiticeiros e Maldições — ${fontePagina}`,
    referenciaRegra: fontePagina,
    hpAtual: input.hp,
    hpMaximo: input.hp,
    defesa: input.defesa,
    deslocamentoM: input.deslocamentoM,
    porte: input.porte,
    grau: input.grau,
    custoInvocacaoPE: input.custoPE,
    requisitosFormaDerivada: [...input.requisitos],
    lacunasFormaDerivada: [...input.lacunas, lacunaNumerica],
    valoresProvisoriosFormaDerivada: ['custoInvocacaoPE', 'PV', 'Defesa', 'deslocamentoM', 'porte', 'atributos', 'ações'],
    descricao: `${input.nome}: forma derivada oficial de ${grauDescricao}. ${lacunaNumerica}`,
    historico: `${input.nome} — composição e Grau conforme ${fontePagina}. ${lacunaNumerica}`,
    acoes: [],
    caracteristicas: [
      { tipo: 'fonte', texto: fontePagina },
      { tipo: 'forma_derivada', texto: 'Não ocupa vaga de indivíduo-base.' },
      { tipo: 'requisito', texto: input.origem.join('; ') },
      { tipo: 'provisorio', texto: lacunaNumerica },
    ],
  };
}

/** Cria as quatro fichas oficiais como rascunhos: valores numéricos provisórios exigem aprovação. */
export function criarFormasDerivadasDezSombras(donoCharacterId: string): InvocacaoControlador[] {
  return [
    criarFichaDerivada({
      donoCharacterId, id: 'totalidade', nome: 'Cão Divino: Totalidade', grau: 'terceiro',
      custoPE: 4, hp: 35, defesa: 22, deslocamentoM: 12, porte: 'Grande',
      requisitos: [...DEZ_SOMBRAS_FORMAS_DERIVADAS[0].requisitos],
      lacunas: [...DEZ_SOMBRAS_FORMAS_DERIVADAS[0].lacunas],
      origem: ['Cão Branco domado', 'Cão Preto domado', 'ritual de quimera'],
    }),
    criarFichaDerivada({
      donoCharacterId, id: 'abismo-desconhecido-do-poco', nome: 'O Abismo Desconhecido do Poço', grau: 'terceiro',
      custoPE: 6, hp: 50, defesa: 21, deslocamentoM: 10.5, porte: 'Médio',
      requisitos: [...DEZ_SOMBRAS_FORMAS_DERIVADAS[1].requisitos],
      lacunas: [...DEZ_SOMBRAS_FORMAS_DERIVADAS[1].lacunas],
      origem: ['Gama domado', 'Nue domado', 'ritual de quimera'],
    }),
    criarFichaDerivada({
      donoCharacterId, id: 'nue-totalidade', nome: 'Nue: Totalidade', grau: 'segundo',
      custoPE: 3, hp: 26, defesa: 13, deslocamentoM: 12, porte: 'Médio',
      requisitos: [...DEZ_SOMBRAS_FORMAS_DERIVADAS[2].requisitos],
      lacunas: [...DEZ_SOMBRAS_FORMAS_DERIVADAS[2].lacunas],
      origem: ['Nue domado', 'Orochi domado', 'ritual de quimera'],
    }),
    criarFichaDerivada({
      donoCharacterId, id: 'agito', nome: 'Agito', grau: 'especial',
      custoPE: 7, hp: 120, defesa: 27, deslocamentoM: 18, porte: 'Grande',
      requisitos: [...DEZ_SOMBRAS_FORMAS_DERIVADAS[3].requisitos],
      lacunas: [...DEZ_SOMBRAS_FORMAS_DERIVADAS[3].lacunas],
      origem: ['Nue domado', 'Orochi domado', 'Cervo Circular domado', 'Tigre Fúnebre domado', 'ritual de quimera'],
    }),
  ];
}
