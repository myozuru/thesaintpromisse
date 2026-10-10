import { useEffect, useState } from 'react';
import type { Character } from '@/types';
import { DEFAULT_SAVING_THROWS } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import {
  ATRIBUTOS_SHIKIGAMI, atributosIniciaisShikigami, auditarFichaShikigami, grausDisponiveis,
  pontosRestantesShikigami, regrasGrau, validarAtributosShikigami, valoresShikigami,
  modificadorAtributoShikigami, type AtributosShikigami, type GrauShikigami,
} from '@/lib/controlador/regrasShikigami';
import { limiteInvocacoesConhecidas, type InvocacaoControlador } from '@/lib/controlador/tipos';
import { submeterAprovacaoInvocacao } from '@/lib/controlador/aprovacao.functions';
import {
  ModeloInvocacaoSchema,
  INVOCACAO_SCHEMA_VERSION,
  type CampoDerivadoInvocacao,
  type CategoriaEconomiaInvocacao,
  type LimiteResetEconomiaInvocacao,
  type RecursoInvocacao,
  type CustoComandoInvocacao,
  type ConfiguracaoEfeitoSuporteInvocacao,
  type EfeitoPassivoInvocacao,
} from '@/lib/invocacoes/schema';
import { resolverValoresDerivados, type CampoDerivadoShikigami, type EstadoEdicaoDerivado, type EstadosEdicaoDerivados } from '@/lib/controlador/fichaShikigami';
import { SISTEMA_PERICIAS, ROTULOS_PERICIAS } from '@/lib/omni/constantesDoSistema';
import { assetCache } from '@/components/mapa/assetCache';
import { TokenCropDialog } from '@/components/mapa/ui/TokenCropDialog';
import type { Entity, TokenCrop } from '@/stores/useMapStore';
import { carregarAssetFicha, salvarAssetFicha } from '@/lib/controlador/assetFicha';
import { parseFormulaDanoInvocacao } from '@/lib/controlador/rolagens';
import { bonusPericiaCaracteristicas, bonusPVCaracteristicas, reducaoDanoCaracteristicas } from '@/lib/controlador/passivas';
import { resolverAcaoOmniInvocacao } from '@/lib/controlador/omni';
import { validarCondicaoAutonomia } from '@/lib/controlador/condicaoAutonomia';

const rotulosAtributos: Record<keyof AtributosShikigami, string> = {
  forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição',
  inteligencia: 'Inteligência', sabedoria: 'Sabedoria', presenca: 'Presença',
};
const rotulosGraus: Record<GrauShikigami, string> = {
  quarto: 'Quarto Grau', terceiro: 'Terceiro Grau', segundo: 'Segundo Grau',
  primeiro: 'Primeiro Grau', especial: 'Grau Especial',
};
const todosGraus: GrauShikigami[] = ['quarto', 'terceiro', 'segundo', 'primeiro', 'especial'];
const chavesDerivadas: CampoDerivadoShikigami[] = ['hpMaximo', 'defesa', 'deslocamentoM', 'custoInvocacaoPE'];
const labelsDerivadas: Record<CampoDerivadoShikigami, string> = {
  hpMaximo: 'PV máximo', defesa: 'Defesa', deslocamentoM: 'Deslocamento (m)', custoInvocacaoPE: 'Custo de invocação (PE)',
};
type ModoDerivado = EstadoEdicaoDerivado['modo'];
type CampoExtra = 'custoSustentacaoPE' | 'alcanceM' | 'resistencias';
type EstadoExtra = { modo: ModoDerivado; valorManual: string; motivo: string };
type AcaoFicha = InvocacaoControlador['acoes'][number];
type CaracteristicaFicha = { id: string; nome: string; descricao: string; condicao?: string; bonus?: string; resistencia?: string; reducaoDano?: string; sentidos?: string; propriedades?: string; efeitoOperacional?: EfeitoPassivoInvocacao };
type ReacaoFicha = { id: string; nome: string; gatilho: string; alcance: string; custo: string; condicao: string; alvo: string; solicitarConfirmacao: boolean };
type ModoOrigem = 'manual' | 'grimorio' | 'omni';

function numeroFinito(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function extrairRegistro(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}
function estadoNumero(
  initial: InvocacaoControlador | undefined,
  key: CampoDerivadoShikigami,
  defaultMode: ModoDerivado,
): EstadoEdicaoDerivado {
  const config = initial?.valoresDerivados?.[key];
  if (config?.modo === 'automatico') return { modo: 'automatico', valorManual: null };
  if (config?.modo === 'manual') return { modo: 'manual', valorManual: numeroFinito(config.valor) };
  if (config?.modo === 'revisao_necessaria') {
    return { modo: 'revisao_necessaria', valorManual: numeroFinito(config.valorPreservado), motivo: config.motivo };
  }
  const legado = extrairRegistro(initial?.estadoLegado);
  const direct = extrairRegistro(initial)[key];
  const valor = numeroFinito(legado[key] ?? direct);
  if (valor !== null) return { modo: 'revisao_necessaria', valorManual: valor, motivo: 'A ficha antiga não registrava se este valor era automático ou manual.' };
  return { modo: defaultMode, valorManual: null };
}
function estadoExtra(initial: InvocacaoControlador | undefined, key: CampoExtra): EstadoExtra {
  const config = initial?.valoresDerivados?.[key];
  const legado = extrairRegistro(initial?.estadoLegado);
  const direct = extrairRegistro(initial)[key];
  const value = config?.modo === 'manual' ? config.valor
    : config?.modo === 'revisao_necessaria' ? config.valorPreservado
    : legado[key] ?? direct;
  const mode: ModoDerivado = config?.modo ?? (value !== undefined ? 'revisao_necessaria' : 'revisao_necessaria');
  return {
    modo: mode,
    valorManual: value === undefined || value === null ? '' : String(value),
    motivo: config?.modo === 'revisao_necessaria' ? config.motivo : 'Não existe uma fórmula automática cadastrada para este campo.',
  };
}
function lerPropriedade(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}
function otimizarImagem(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    if (typeof createImageBitmap !== 'function') { resolve(file); return; }
    void createImageBitmap(file).then((bitmap) => {
      const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) { bitmap.close(); resolve(file); return; }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      canvas.toBlob((blob) => resolve(blob ?? file), 'image/webp', 0.86);
    }).catch(() => resolve(file));
  });
}

interface Props {
  character: Character;
  initial?: InvocacaoControlador;
  onSaved?: () => void;
  onCancel?: () => void;
}

export function CriadorShikigami({ character, initial, onSaved, onCancel }: Props) {
  const update = useCharacterStore(s => s.updateCharacter);
  const items = useInventoryStore(s => s.items);
  const entidades = useOmniEntidadesStore(s => s.entidades);
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [apelido, setApelido] = useState(initial?.apelido ?? '');
  const [subcategoria, setSubcategoria] = useState(initial?.subcategoria ?? '');
  const [descricao, setDescricao] = useState(initial?.descricao ?? '');
  const [historico, setHistorico] = useState(initial?.historico ?? '');
  const [origemTipo, setOrigemTipo] = useState<ModoOrigem>(initial?.origem?.tipo ?? 'manual');
  const [origemReferencia, setOrigemReferencia] = useState(initial?.origem?.entidadeId ?? '');
  const [origemAquisicao, setOrigemAquisicao] = useState(initial?.origemAquisicao ?? '');
  const [referenciaInterludio, setReferenciaInterludio] = useState(initial?.referenciaInterludio ?? '');
  const [tipo, setTipo] = useState<'shikigami' | 'corpo_amaldicoado'>(initial?.tipo ?? 'shikigami');
  const [alcanceInvocacaoM, setAlcanceInvocacaoM] = useState(initial?.alcanceInvocacaoM?.toString() ?? '');
  const [grau, setGrau] = useState<GrauShikigami>((initial?.grau as GrauShikigami) ?? 'quarto');
  const [nivelEvolucao, setNivelEvolucao] = useState(initial?.nivelEvolucao?.toString() ?? '');
  const [atributos, setAtributos] = useState<AtributosShikigami>(() => initial?.atributos ? { ...atributosIniciaisShikigami(), ...initial.atributos } : atributosIniciaisShikigami());
  const [derivados, setDerivados] = useState<EstadosEdicaoDerivados>(() => ({
    hpMaximo: estadoNumero(initial, 'hpMaximo', 'automatico'),
    defesa: estadoNumero(initial, 'defesa', 'automatico'),
    deslocamentoM: estadoNumero(initial, 'deslocamentoM', 'automatico'),
    custoInvocacaoPE: estadoNumero(initial, 'custoInvocacaoPE', 'automatico'),
  }));
  const [extrasDerivados, setExtrasDerivados] = useState<Record<CampoExtra, EstadoExtra>>(() => ({
    custoSustentacaoPE: estadoExtra(initial, 'custoSustentacaoPE'),
    alcanceM: estadoExtra(initial, 'alcanceM'),
    resistencias: estadoExtra(initial, 'resistencias'),
  }));
  const [porte, setPorte] = useState<InvocacaoControlador['porte']>(initial?.porte ?? 'Médio');
  const [pvAtual, setPvAtual] = useState(initial?.hpAtual?.toString() ?? '');
  const [imagemAssetId, setImagemAssetId] = useState(initial?.imagemAssetId ?? '');
  const [imagemFallbackAssetId, setImagemFallbackAssetId] = useState(initial?.imagemFallbackAssetId ?? '');
  const [imagemAltText, setImagemAltText] = useState(initial?.imagemAltText ?? '');
  const [corIdentificacao, setCorIdentificacao] = useState(initial?.corIdentificacao ?? '#7c3aed');
  const [nomeplate, setNomeplate] = useState(initial?.nomeplate ?? true);
  const [formaToken, setFormaToken] = useState<'ELLIPSE' | 'RECT'>(initial?.formaToken ?? 'ELLIPSE');
  const [tokenCrop, setTokenCrop] = useState<TokenCrop | undefined>(initial?.tokenCrop as TokenCrop | undefined);
  const [cropOpen, setCropOpen] = useState(false);
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetErro, setAssetErro] = useState('');
  const [assetTick, setAssetTick] = useState(0);
  const [notaEvolucao, setNotaEvolucao] = useState('');
  const [periciasTreinadas, setPericiasTreinadas] = useState<string[]>(initial?.periciasTreinadas ?? []);
  const [atributoBasePericias, setAtributoBasePericias] = useState<'inteligencia' | 'sabedoria' | ''>(initial?.atributoBasePericias ?? '');
  const [tipoAtaqueTreinado, setTipoAtaqueTreinado] = useState<'corpo_a_corpo' | 'distancia' | ''>(String(lerPropriedade(initial?.ataqueTreinado, 'tipo') ?? '') as 'corpo_a_corpo' | 'distancia' | '');
  const [atributoAtaqueTreinado, setAtributoAtaqueTreinado] = useState<'forca' | 'destreza' | ''>(String(lerPropriedade(initial?.ataqueTreinado, 'atributo') ?? '') as 'forca' | 'destreza' | '');
  const [ataqueTreinadoBonus, setAtaqueTreinadoBonus] = useState(String(lerPropriedade(initial?.ataqueTreinado, 'bonus') ?? ''));
  const [resistenciaTreinada, setResistenciaTreinada] = useState(String(lerPropriedade(initial?.resistenciaTreinada, 'nome') ?? ''));
  const [bonusResistenciaTreinada, setBonusResistenciaTreinada] = useState(String(lerPropriedade(initial?.resistenciaTreinada, 'bonus') ?? ''));
  const [acoes, setAcoes] = useState<AcaoFicha[]>(initial?.acoes ?? []);
  const [custosComandos, setCustosComandos] = useState<Record<string, CustoComandoInvocacao>>(() => ({
    ...initial?.custosComandosConfigurados,
  }));
  const [acaoNome, setAcaoNome] = useState('');
  const [acaoCategoria, setAcaoCategoria] = useState('');
  const [acaoExecucao, setAcaoExecucao] = useState<'manual' | 'omni' | 'referencia_omni'>('manual');
  const [acaoTipo, setAcaoTipo] = useState<NonNullable<AcaoFicha['tipo']>>('habilidade');
  const [acaoEfeitoSuporte, setAcaoEfeitoSuporte] = useState<ConfiguracaoEfeitoSuporteInvocacao['efeito'] | ''>('');
  const [acaoAlvosSuporte, setAcaoAlvosSuporte] = useState<'unico' | 'multiplos'>('unico');
  const [acaoAtributoCura, setAcaoAtributoCura] = useState<'sabedoria' | 'presenca'>('sabedoria');
  const [acaoTiposDanoRD, setAcaoTiposDanoRD] = useState<import('@/types').DamageType[]>(['DCO']);
  const [acaoTeste, setAcaoTeste] = useState<'nenhum' | 'ataque' | 'resistencia'>('nenhum');
  const [acaoTipoAtaque, setAcaoTipoAtaque] = useState<'corpo_a_corpo' | 'distancia'>('corpo_a_corpo');
  const [acaoAtributoAtaque, setAcaoAtributoAtaque] = useState<'forca' | 'destreza'>('forca');
  const [acaoAtributoDano, setAcaoAtributoDano] = useState<keyof AtributosShikigami | ''>('');
  const [acaoMultiplicadorDanoAtributo, setAcaoMultiplicadorDanoAtributo] = useState('');
  const [acaoResistenciaAlvo, setAcaoResistenciaAlvo] = useState(DEFAULT_SAVING_THROWS[1]);
  const [acaoAtributoCD, setAcaoAtributoCD] = useState<keyof AtributosShikigami>('presenca');
  const [acaoDanoNoSucesso, setAcaoDanoNoSucesso] = useState<'nenhum' | 'metade'>('nenhum');
  const [acaoMargemCritico, setAcaoMargemCritico] = useState('20');
  const [acaoMultiplicadorCritico, setAcaoMultiplicadorCritico] = useState('2');
  const [acaoTipoDano, setAcaoTipoDano] = useState('');
  const [acaoDano, setAcaoDano] = useState('');
  const [acaoAlvo, setAcaoAlvo] = useState('');
  const [acaoAlcance, setAcaoAlcance] = useState('');
  const [acaoBonus, setAcaoBonus] = useState('');
  const [acaoCusto, setAcaoCusto] = useState('');
  const [acaoCustoDonoPE, setAcaoCustoDonoPE] = useState('');
  const [acaoCustoRecursoId, setAcaoCustoRecursoId] = useState('');
  const [acaoCustoRecurso, setAcaoCustoRecurso] = useState('');
  const [acaoModoCusto, setAcaoModoCusto] = useState<'manual' | 'evento_automatico'>('manual');
  const [acaoRecargaQuantidade, setAcaoRecargaQuantidade] = useState('');
  const [acaoRecargaUnidade, setAcaoRecargaUnidade] = useState<'inicio_turno_dono' | 'inicio_rodada' | 'manual' | ''>('');
  const [acaoOmniEntidade, setAcaoOmniEntidade] = useState('');
  const [acaoOmniId, setAcaoOmniId] = useState('');
  const entidadeOmniSelecionada = acaoOmniEntidade ? entidades[acaoOmniEntidade] : undefined;
  const configOmniSelecionada = entidadeOmniSelecionada?.acoesAtivas?.find(item => item.id === acaoOmniId);
  const previewOmni = configOmniSelecionada && entidadeOmniSelecionada
    ? resolverAcaoOmniInvocacao({
        id: 'rascunho', nome: configOmniSelecionada.nome, tipoExecucao: acaoExecucao,
        entidadeOmniId: entidadeOmniSelecionada.id, acaoOmniId: configOmniSelecionada.id,
      }, entidades)
    : undefined;
  const [caracteristicas, setCaracteristicas] = useState<CaracteristicaFicha[]>(() => (initial?.caracteristicas ?? []) as CaracteristicaFicha[]);
  const [possuiEnergiaReversa, setPossuiEnergiaReversa] = useState(initial?.possuiEnergiaReversa ?? false);
  const [caracteristicaNome, setCaracteristicaNome] = useState('');
  const [caracteristicaEfeito, setCaracteristicaEfeito] = useState<EfeitoPassivoInvocacao['tipo'] | ''>('');
  const [caracteristicaPericia, setCaracteristicaPericia] = useState('percepcao');
  const [caracteristicaTipoDano, setCaracteristicaTipoDano] = useState<import('@/types').DamageType>('DCO');
  const [caracteristicaDescricao, setCaracteristicaDescricao] = useState('');
  const [caracteristicaCondicao, setCaracteristicaCondicao] = useState('');
  const [caracteristicaBonus, setCaracteristicaBonus] = useState('');
  const [caracteristicaRD, setCaracteristicaRD] = useState('');
  const [caracteristicaResistencia, setCaracteristicaResistencia] = useState('');
  const [caracteristicaSentidos, setCaracteristicaSentidos] = useState('');
  const [caracteristicaPropriedades, setCaracteristicaPropriedades] = useState('');
  const [reacoes, setReacoes] = useState<ReacaoFicha[]>(() => (initial?.reacoes ?? []) as ReacaoFicha[]);
  const [reacaoNome, setReacaoNome] = useState('');
  const [reacaoGatilho, setReacaoGatilho] = useState('');
  const [reacaoAlcance, setReacaoAlcance] = useState('');
  const [reacaoCusto, setReacaoCusto] = useState('');
  const [reacaoCondicao, setReacaoCondicao] = useState('');
  const [reacaoAlvo, setReacaoAlvo] = useState('');
  const [reacaoPrompt, setReacaoPrompt] = useState(true);
  const [omniChave, setOmniChave] = useState(String(lerPropriedade(initial?.omniConfiguracao, 'chave') ?? ''));
  const [omniFormula, setOmniFormula] = useState(String(lerPropriedade(initial?.omniConfiguracao, 'formula') ?? ''));
  const [omniEfeito, setOmniEfeito] = useState(String(lerPropriedade(initial?.omniConfiguracao, 'efeito') ?? ''));
  const [omniAlvos, setOmniAlvos] = useState(String(lerPropriedade(initial?.omniConfiguracao, 'alvos') ?? ''));
  const [omniArea, setOmniArea] = useState(String(lerPropriedade(initial?.omniConfiguracao, 'area') ?? ''));
  const [omniSustentacao, setOmniSustentacao] = useState(String(lerPropriedade(initial?.omniConfiguracao, 'sustentacao') ?? ''));
  const [omniContador, setOmniContador] = useState(String(lerPropriedade(initial?.omniConfiguracao, 'contador') ?? ''));
  const [omniDiagnosticos, setOmniDiagnosticos] = useState(String(lerPropriedade(initial?.omniConfiguracao, 'diagnosticos') ?? ''));
  const [omniGatilhoEntidade, setOmniGatilhoEntidade] = useState(String(lerPropriedade(initial?.omniConfiguracao, 'entidadeId') ?? ''));
  const [omniGatilhoId, setOmniGatilhoId] = useState(String(lerPropriedade(initial?.omniConfiguracao, 'gatilhoId') ?? ''));
  const [omniAcaoId, setOmniAcaoId] = useState(String(lerPropriedade(initial?.omniConfiguracao, 'acaoId') ?? ''));
  const [automacoesOmni, setAutomacoesOmni] = useState<(NonNullable<InvocacaoControlador['automacoesOmni']>[number])[]>(initial?.automacoesOmni ?? []);
  const [condicoesAutomacaoJson, setCondicoesAutomacaoJson] = useState<Record<string, string>>(() => Object.fromEntries(
    (initial?.automacoesOmni ?? []).map(item => [item.id, item.condicaoAST === undefined ? '' : JSON.stringify(item.condicaoAST, null, 2)]),
  ));
  const [autonomiaModo, setAutonomiaModo] = useState(initial?.autonomia?.modo ?? '');
  const [autonomiaAlvo, setAutonomiaAlvo] = useState(initial?.autonomia?.politicaAlvo ?? '');
  const [autonomiaCusto, setAutonomiaCusto] = useState(initial?.autonomia?.politicaCusto ?? '');
  const [autonomiaPrioridade, setAutonomiaPrioridade] = useState(initial?.autonomia?.prioridadeAlvo ?? '');
  const [autonomiaLimite, setAutonomiaLimite] = useState(initial?.autonomia?.limitePorRodada?.toString() ?? '');
  const [economia, setEconomia] = useState<Record<string, string>>(() => {
    const values = initial?.economiaAcoesConfigurada ?? {};
    return { acaoComum: values.acaoComum?.toString() ?? '', acaoSimples: values.acaoSimples?.toString() ?? '', acaoComplexa: values.acaoComplexa?.toString() ?? '', acaoMovimento: values.acaoMovimento?.toString() ?? '', acaoBonus: values.acaoBonus?.toString() ?? '', acaoLivre: values.acaoLivre?.toString() ?? '', reacao: values.reacao?.toString() ?? '' };
  });
  const [resetEconomia, setResetEconomia] = useState<Partial<Record<CategoriaEconomiaInvocacao, LimiteResetEconomiaInvocacao>>>(() => ({
    ...initial?.economiaAcoesConfigurada?.resetPorCategoria,
  }));
  const [recursos, setRecursos] = useState<RecursoInvocacao[]>(() => [...(initial?.recursosConfigurados ?? [])]);
  const [recursoId, setRecursoId] = useState('');
  const [recursoNome, setRecursoNome] = useState('');
  const [recursoInicial, setRecursoInicial] = useState('');
  const [recursoMaximo, setRecursoMaximo] = useState('');
  const [recursoRecarga, setRecursoRecarga] = useState('');
  const [recursoRecargaUnidade, setRecursoRecargaUnidade] = useState<LimiteResetEconomiaInvocacao | ''>('');
  const [tempoQuantidade, setTempoQuantidade] = useState(initial?.tempoAdicional?.quantidade?.toString() ?? '');
  const [tempoUnidade, setTempoUnidade] = useState(initial?.tempoAdicional?.unidade ?? '');
  const [intermediarioTipo, setIntermediarioTipo] = useState<'' | 'talisma' | 'dispositivo' | 'tecnica'>(initial?.intermediario?.tipo ?? '');
  const [intermediarioItem, setIntermediarioItem] = useState(initial?.intermediario?.itemInventarioId ?? '');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [salvando, setSalvando] = useState(false);
  const isEditing = Boolean(initial);
  const aguardandoMestre = initial?.aprovacaoMestre === 'pendente';
  const grauRegra = regrasGrau(grau);
  const pontosRestantes = pontosRestantesShikigami(grau, atributos);
  const bonusTreinamento = getTrainingBonusByLevel(character.level);
  const valoresAutomaticosBase = valoresShikigami(grau, atributos, character.level, bonusTreinamento);
  const automaticos = {
    hpMaximo: valoresAutomaticosBase.pv,
    defesa: valoresAutomaticosBase.defesa,
    deslocamentoM: valoresAutomaticosBase.deslocamentoM,
    custoInvocacaoPE: valoresAutomaticosBase.custoPE,
  };
  const resolvidos = (() => {
    try { return resolverValoresDerivados(automaticos, derivados); } catch { return null; }
  })();
  const valoresFinais = resolvidos?.valores ?? automaticos;
  const hpMaximoComCaracteristicas = valoresFinais.hpMaximo + bonusPVCaracteristicas({ grau, caracteristicas });
  const alertas = [
    ...auditarFichaShikigami({
      grau, nivelUsuario: character.level, bonusTreinamentoUsuario: bonusTreinamento, atributos,
      atributoBasePericias: atributoBasePericias || undefined, periciasTreinadas,
      valoresAtuais: { pv: valoresFinais.hpMaximo, defesa: valoresFinais.defesa, deslocamentoM: valoresFinais.deslocamentoM, custoInvocacaoPE: valoresFinais.custoInvocacaoPE },
    }),
    ...(!origemAquisicao ? [{ codigo: 'origem_aquisicao_ausente', severidade: 'aviso' as const, detalhe: 'A origem da aquisição ainda não foi registrada.' }] : []),
    ...(character.specialization !== 'Controlador' && origemAquisicao !== 'interludio' ? [{ codigo: 'interludio_requerido', severidade: 'aviso' as const, detalhe: 'A referência do livro indica aquisição em Interlúdio para esta especialização.' }] : []),
    ...(origemAquisicao === 'interludio' && !referenciaInterludio.trim() ? [{ codigo: 'referencia_interludio_ausente', severidade: 'aviso' as const, detalhe: 'Informe a referência do Interlúdio quando estiver disponível.' }] : []),
    ...(resistenciaTreinada === 'Integridade' ? [{ codigo: 'integridade_treino_legado', severidade: 'aviso' as const, detalhe: 'Integridade aparece como treino legado; a ficha atual não oferece esse teste para treinamento.' }] : []),
  ];
  const skills = Object.keys(SISTEMA_PERICIAS) as Array<keyof typeof SISTEMA_PERICIAS>;
  const inventarioDoDono = Object.values(items).filter(item => item.ownerId === character.id);
  const entidadeAutomacao = Object.values(entidades).find(entity => entity.id === omniGatilhoEntidade);
  const assetPrincipal = imagemAssetId ? assetCache.get(imagemAssetId) : null;
  const assetFallback = imagemFallbackAssetId ? assetCache.get(imagemFallbackAssetId) : null;
  const cropEntity: Entity = {
    id: initial?.id ?? 'rascunho-shikigami', shape: formaToken, x: 0, y: 0, w: 1, h: 1,
    rotation: 0, color: corIdentificacao, locked: false, assetId: imagemAssetId || undefined,
    label: apelido || nome, nameplate: nomeplate, tokenCrop,
  };

  useEffect(() => {
    const ids = [imagemAssetId, imagemFallbackAssetId].filter(Boolean);
    if (!ids.length) return;
    void Promise.all(ids.map(id => carregarAssetFicha(id))).then(() => setAssetTick(value => value + 1));
  }, [imagemAssetId, imagemFallbackAssetId]);

  const atualizarDerivado = (key: CampoDerivadoShikigami, patch: Partial<EstadoEdicaoDerivado>) => {
    setDerivados(previous => ({ ...previous, [key]: { ...previous[key], ...patch } }));
  };
  const atualizarExtra = (key: CampoExtra, patch: Partial<EstadoExtra>) => {
    setExtrasDerivados(previous => ({ ...previous, [key]: { ...previous[key], ...patch } }));
  };
  const alternarPericia = (key: string) => {
    setPericiasTreinadas(previous => previous.includes(key) ? previous.filter(item => item !== key) : [...previous, key]);
  };
  const uploadImagem = async (file: File | undefined, fallback: boolean) => {
    if (!file) return;
    setAssetBusy(true); setAssetErro('');
    try {
      const blob = await otimizarImagem(file);
      const id = await salvarAssetFicha(blob);
      if (fallback) setImagemFallbackAssetId(id); else setImagemAssetId(id);
      setAssetTick(value => value + 1);
    } catch (error) {
      setAssetErro(error instanceof Error ? error.message : 'Não foi possível guardar a imagem.');
    } finally { setAssetBusy(false); }
  };
  const selecionarAcaoOmni = (id: string) => {
    setAcaoOmniId(id);
    setErro('');
    const entidade = entidades[acaoOmniEntidade];
    const config = entidade?.acoesAtivas?.find(item => item.id === id);
    if (!entidade || !config) return;
    const resolvida = resolverAcaoOmniInvocacao({
      id: 'rascunho', nome: config.nome, tipoExecucao: acaoExecucao,
      entidadeOmniId: entidade.id, acaoOmniId: config.id,
    }, entidades);
    if (!resolvida.ok) {
      setAcaoNome(config.nome);
      setErro(resolvida.motivo);
      return;
    }
    const acao = resolvida.acao;
    setAcaoNome(acao.nome);
    setAcaoCategoria(acao.categoriaAcao ?? '');
    setAcaoTipo(acao.tipo ?? 'habilidade');
    setAcaoTeste(acao.teste ?? 'nenhum');
    setAcaoDano(acao.dano ?? '');
    setAcaoTipoDano(acao.tipoDano ?? '');
    setAcaoAlcance(acao.alcanceM?.toString() ?? '');
    setAcaoBonus(acao.bonusAtaque?.toString() ?? '0');
    setAcaoCusto(acao.custoPE?.toString() ?? '0');
    setAcaoResistenciaAlvo(acao.resistenciaAlvo ?? DEFAULT_SAVING_THROWS[0]);
    setAcaoDanoNoSucesso(acao.danoNoSucesso ?? 'nenhum');
    if (acao.alcanceM !== undefined) setAcaoTipoAtaque(acao.alcanceM > 1.5 ? 'distancia' : 'corpo_a_corpo');
  };
  const adicionarAcao = () => {
    if (acaoExecucao === 'manual' && (!acaoNome.trim() || !acaoCategoria)) { setErro('Informe o nome e a categoria da ação.'); return; }
    if (acaoExecucao !== 'manual' && (!acaoOmniEntidade || !acaoOmniId)) { setErro('Selecione uma entidade e uma ação OMNI.'); return; }
    const resolucaoOmni = acaoExecucao === 'manual' ? undefined : resolverAcaoOmniInvocacao({
      id: 'rascunho', nome: acaoNome.trim() || 'Ação OMNI', tipoExecucao: acaoExecucao,
      entidadeOmniId: acaoOmniEntidade, acaoOmniId,
    }, entidades);
    if (resolucaoOmni && !resolucaoOmni.ok) { setErro(resolucaoOmni.motivo); return; }
    const acaoOmniResolvida = resolucaoOmni?.ok ? resolucaoOmni.acao : undefined;
    const custo = acaoCusto.trim() === '' ? undefined : Number(acaoCusto);
    const custoDono = numeroOpcional(acaoCustoDonoPE, 'Débito de PE do dono');
    const custoRecurso = numeroOpcional(acaoCustoRecurso, 'Débito do recurso próprio');
    const recargaQuantidade = inteiroOpcional(acaoRecargaQuantidade, 'Quantidade da recarga');
    const alcance = acaoAlcance.trim() === '' ? undefined : Number(acaoAlcance);
    const bonus = acaoBonus.trim() === '' ? undefined : Number(acaoBonus);
    const margemCritico = inteiroOpcional(acaoMargemCritico, 'Margem de crítico');
    const multiplicadorCritico = inteiroOpcional(acaoMultiplicadorCritico, 'Multiplicador de crítico');
    const multiplicadorDanoAtributo = acaoMultiplicadorDanoAtributo === '' ? undefined : inteiroOpcional(acaoMultiplicadorDanoAtributo, 'Multiplicador de atributo no dano');
    if ([custo, custoDono, custoRecurso, alcance, bonus].some(value => value !== undefined && !Number.isFinite(value)) || [custo, custoDono, custoRecurso, alcance].some(value => value !== undefined && value < 0)) { setErro('Custos e alcance precisam ser números finitos e não negativos; bônus precisa ser finito.'); return; }
    if (margemCritico === undefined || margemCritico < 2 || margemCritico > 20 || multiplicadorCritico === undefined || multiplicadorCritico < 1 || multiplicadorCritico > 5) { setErro('Margem de crítico precisa ser 2–20 e multiplicador, 1–5.'); return; }
    if (acaoMultiplicadorDanoAtributo !== '' && (multiplicadorDanoAtributo === undefined || multiplicadorDanoAtributo < 0 || multiplicadorDanoAtributo > 5)) { setErro('Multiplicador do atributo no dano precisa ser de 0 a 5.'); return; }
    if (acaoExecucao === 'manual' && acaoTipo === 'ataque' && acaoTeste !== 'ataque') { setErro('Ações do tipo Ataque precisam usar uma rolagem contra Defesa.'); return; }
    if (acaoExecucao === 'manual' && acaoTeste === 'ataque' && !parseFormulaDanoInvocacao(acaoDano)) { setErro('Dano inválido. Use dados como 2d12+1d6+3.'); return; }
    if (acaoExecucao === 'manual' && acaoTeste === 'resistencia' && !DEFAULT_SAVING_THROWS.includes(acaoResistenciaAlvo)) { setErro('Escolha um Teste de Resistência válido.'); return; }
    if (acaoExecucao === 'manual' && acaoTeste === 'resistencia' && acaoDano.trim() && !parseFormulaDanoInvocacao(acaoDano)) { setErro('Dano inválido. Use dados como 2d12+1d6+3.'); return; }
    if ((custoRecurso === undefined) !== !acaoCustoRecursoId) { setErro('Selecione o recurso próprio e informe o valor a debitar juntos.'); return; }
    if ((recargaQuantidade === undefined) !== !acaoRecargaUnidade) { setErro('Preencha quantidade e marco da recarga juntos.'); return; }
    if (recargaQuantidade !== undefined && recargaQuantidade < 1) { setErro('A recarga precisa ser de pelo menos um turno ou rodada.'); return; }
    if (custoRecurso !== undefined && !recursos.some(recurso => recurso.id === acaoCustoRecursoId)) { setErro('O recurso escolhido precisa estar configurado na ficha.'); return; }
    const recursoSelecionado = recursos.find(recurso => recurso.id === acaoCustoRecursoId);
    const peDistribuido = (custoDono ?? 0) + (recursoSelecionado?.id === 'pe' ? custoRecurso ?? 0 : 0);
    if (Math.abs(peDistribuido - (custo ?? 0)) > 1e-9) { setErro('Distribua o custo total de PE entre o dono e o recurso próprio com ID "pe".'); return; }
    const category = (acaoOmniResolvida?.categoriaAcao ?? acaoCategoria) as NonNullable<AcaoFicha['categoriaAcao']>;
    if (!category) { setErro('A categoria da ação precisa estar configurada.'); return; }
    let efeitoSuporte: ConfiguracaoEfeitoSuporteInvocacao | undefined;
    if (acaoTipo === 'suporte' && acaoExecucao === 'manual') {
      if (!acaoEfeitoSuporte) { setErro('Escolha o efeito tabelado desta ação de suporte.'); return; }
      if (acaoEfeitoSuporte === 'cura' && !['acao_complexa', 'acao_comum'].includes(category)) { setErro('A cura exige uma Ação Complexa.'); return; }
      if (['defesa', 'acerto'].includes(acaoEfeitoSuporte) && !['acao_simples', 'acao_bonus'].includes(category)) {
        setErro('Os bônus de Defesa e Acerto precisam ser ações simples; a conversão complexa depende de regra de arredondamento.'); return;
      }
      if (acaoAlvosSuporte === 'multiplos' && acaoEfeitoSuporte !== 'cura') { setErro('Apenas ações de cura podem selecionar múltiplos alvos.'); return; }
      if (acaoEfeitoSuporte === 'reducao_dano' && acaoTiposDanoRD.length === 0) { setErro('Escolha ao menos um tipo de dano para reduzir.'); return; }
      const trueHealing = acaoEfeitoSuporte === 'cura' && (character.hasEnergiaReversa || possuiEnergiaReversa);
      if (trueHealing && custo !== 2) { setErro('Esta ficha pode curar PV reais; configure o custo da ação como exatamente 2 PE e distribua o débito entre dono e/ou recurso próprio.'); return; }
      efeitoSuporte = {
        efeito: acaoEfeitoSuporte,
        alvos: acaoAlvosSuporte,
        ...(acaoEfeitoSuporte === 'cura' ? { atributoCura: acaoAtributoCura } : {}),
        ...(acaoEfeitoSuporte === 'reducao_dano' ? { tiposDano: acaoTiposDanoRD } : {}),
      };
    }
    const actionId = crypto.randomUUID();
    const testeSalvo = acaoOmniResolvida?.teste ?? (acaoTeste === 'nenhum' ? undefined : acaoTeste);
    const actionDraft: AcaoFicha = {
      id: actionId, nome: acaoOmniResolvida?.nome ?? acaoNome.trim(), tipo: acaoOmniResolvida?.tipo ?? (category === 'movimento' ? 'movimento' : acaoTipo),
      tipoExecucao: acaoExecucao, categoriaAcao: category,
      ...(efeitoSuporte ? { efeitoSuporte } : {}),
      ...(testeSalvo ? { teste: testeSalvo } : {}),
      ...(acaoTeste === 'ataque' ? { tipoAtaque: acaoTipoAtaque, atributoAtaque: acaoAtributoAtaque, margemCritico, multiplicadorCritico } : {}),
      ...(acaoTeste === 'resistencia' ? { resistenciaAlvo: acaoResistenciaAlvo, atributoCD: acaoAtributoCD, danoNoSucesso: acaoDanoNoSucesso } : {}),
      ...(acaoTeste !== 'nenhum' && acaoAtributoDano ? { atributoDano: acaoAtributoDano } : {}),
      ...(acaoTeste !== 'nenhum' && multiplicadorDanoAtributo !== undefined ? { multiplicadorDanoAtributo } : {}),
      ...((acaoOmniResolvida?.dano ?? acaoDano.trim()) ? { dano: acaoOmniResolvida?.dano ?? acaoDano.trim() } : {}),
      ...(acaoTipoDano ? { tipoDano: acaoTipoDano as import('@/types').DamageType } : {}),
      ...(alcance !== undefined ? { alcanceM: alcance } : {}),
      ...(acaoOmniResolvida ? { alcanceM: acaoOmniResolvida.alcanceM, bonusAtaque: acaoOmniResolvida.bonusAtaque ?? 0, custoPE: acaoOmniResolvida.custoPE } : {}),
      ...(!acaoOmniResolvida && bonus !== undefined ? { bonusAtaque: bonus } : {}),
      ...(!acaoOmniResolvida && custo !== undefined ? { custoPE: custo } : {}),
      ...(recargaQuantidade !== undefined && acaoRecargaUnidade
        ? { recargaConfigurada: { quantidade: recargaQuantidade, unidade: acaoRecargaUnidade } }
        : {}),
      ...(acaoExecucao !== 'manual' ? { entidadeOmniId: acaoOmniEntidade, acaoOmniId } : {}),
      ...(acaoAlvo.trim() ? { alvo: acaoAlvo.trim() } : {}),
      ...(category === 'acao_simples' || category === 'acao_complexa' ? { opcaoInvocacao: category } : {}),
    };
    const action: AcaoFicha = {
      ...actionDraft,
      ...(acaoOmniResolvida?.tipoDano ? { tipoDano: acaoOmniResolvida.tipoDano } : {}),
      ...(acaoOmniResolvida?.resistenciaAlvo ? { resistenciaAlvo: acaoOmniResolvida.resistenciaAlvo } : {}),
      ...(acaoOmniResolvida?.danoNoSucesso ? { danoNoSucesso: acaoOmniResolvida.danoNoSucesso } : {}),
    };
    setAcoes(previous => [...previous, action]);
    const debitos: CustoComandoInvocacao['debitos'] = [];
    if ((custoDono ?? 0) > 0) debitos.push({ entidade: 'dono', recurso: 'pe', quantidade: custoDono! });
    if ((custoRecurso ?? 0) > 0 && recursoSelecionado) debitos.push({
      entidade: 'invocacao', recurso: recursoSelecionado.id === 'pe' ? 'pe' : 'recurso',
      recursoId: recursoSelecionado.id, quantidade: custoRecurso!,
    });
    if (acaoModoCusto === 'evento_automatico' || debitos.length) {
      setCustosComandos(previous => ({ ...previous, [actionId]: { execucao: acaoModoCusto, debitos } }));
    }
    setAcaoNome(''); setAcaoDano(''); setAcaoAlcance(''); setAcaoBonus(''); setAcaoCusto(''); setAcaoCustoDonoPE(''); setAcaoCustoRecursoId(''); setAcaoCustoRecurso(''); setAcaoModoCusto('manual'); setAcaoRecargaQuantidade(''); setAcaoRecargaUnidade(''); setAcaoTipoDano(''); setAcaoAlvo(''); setAcaoEfeitoSuporte(''); setAcaoAlvosSuporte('unico'); setAcaoAtributoCura('sabedoria'); setAcaoTiposDanoRD(['DCO']);
    setErro('');
  };
  const adicionarRecurso = () => {
    if (!recursoId.trim() || !recursoNome.trim()) { setErro('Informe um ID estável e o nome do recurso próprio.'); return; }
    if (recursos.some(recurso => recurso.id === recursoId.trim())) { setErro('Esse ID de recurso já está configurado.'); return; }
    const inicial = numeroOpcional(recursoInicial, 'Valor inicial do recurso');
    const maximo = numeroOpcional(recursoMaximo, 'Valor máximo do recurso');
    const quantidadeRecarga = numeroOpcional(recursoRecarga, 'Quantidade de recarga do recurso');
    if (inicial === undefined) { setErro('Informe o valor inicial do recurso próprio.'); return; }
    if (maximo !== undefined && maximo < inicial) { setErro('O valor máximo do recurso não pode ser menor que o inicial.'); return; }
    if ((quantidadeRecarga === undefined) !== !recursoRecargaUnidade) { setErro('Preencha a quantidade e o marco de recarga juntos.'); return; }
    if (quantidadeRecarga !== undefined && quantidadeRecarga <= 0) { setErro('A quantidade recuperada precisa ser maior que zero.'); return; }
    setRecursos(previous => [...previous, {
      id: recursoId.trim(), nome: recursoNome.trim(), valorInicial: inicial,
      ...(maximo !== undefined ? { valorMaximo: maximo } : {}),
      ...(quantidadeRecarga !== undefined && recursoRecargaUnidade
        ? { recargaConfigurada: { quantidade: quantidadeRecarga, unidade: recursoRecargaUnidade } }
        : {}),
    }]);
    setRecursoId(''); setRecursoNome(''); setRecursoInicial(''); setRecursoMaximo(''); setRecursoRecarga(''); setRecursoRecargaUnidade(''); setErro('');
  };
  const adicionarCaracteristica = () => {
    if (!caracteristicaNome.trim()) { setErro('Informe o nome da característica.'); return; }
    let efeitoOperacional: EfeitoPassivoInvocacao | undefined;
    if (caracteristicaEfeito === 'pv_maximo') efeitoOperacional = { tipo: 'pv_maximo' };
    else if (caracteristicaEfeito === 'bonus_pericia') {
      if (!Object.hasOwn(SISTEMA_PERICIAS, caracteristicaPericia)) { setErro('Escolha uma perícia válida para o bônus da característica.'); return; }
      efeitoOperacional = { tipo: 'bonus_pericia', pericia: caracteristicaPericia };
    } else if (caracteristicaEfeito === 'reducao_dano') efeitoOperacional = { tipo: 'reducao_dano', tipoDano: caracteristicaTipoDano };
    setCaracteristicas(previous => [...previous, {
      id: crypto.randomUUID(), nome: caracteristicaNome.trim(), descricao: caracteristicaDescricao,
      ...(efeitoOperacional ? { efeitoOperacional } : {}),
      ...(caracteristicaCondicao ? { condicao: caracteristicaCondicao } : {}),
      ...(caracteristicaBonus ? { bonus: caracteristicaBonus } : {}),
      ...(caracteristicaRD ? { reducaoDano: caracteristicaRD } : {}),
      ...(caracteristicaResistencia ? { resistencia: caracteristicaResistencia } : {}),
      ...(caracteristicaSentidos ? { sentidos: caracteristicaSentidos } : {}),
      ...(caracteristicaPropriedades ? { propriedades: caracteristicaPropriedades } : {}),
    }]);
    setCaracteristicaNome(''); setCaracteristicaDescricao(''); setCaracteristicaCondicao(''); setCaracteristicaBonus(''); setCaracteristicaRD(''); setCaracteristicaResistencia(''); setCaracteristicaSentidos(''); setCaracteristicaPropriedades(''); setCaracteristicaEfeito('');
  };
  const adicionarReacao = () => {
    if (!reacaoNome.trim() || !reacaoGatilho.trim()) { setErro('Informe o nome e o gatilho da reação.'); return; }
    setReacoes(previous => [...previous, {
      id: crypto.randomUUID(), nome: reacaoNome.trim(), gatilho: reacaoGatilho.trim(),
      alcance: reacaoAlcance, custo: reacaoCusto, condicao: reacaoCondicao, alvo: reacaoAlvo, solicitarConfirmacao: reacaoPrompt,
    }]);
    setReacaoNome(''); setReacaoGatilho(''); setReacaoAlcance(''); setReacaoCusto(''); setReacaoCondicao(''); setReacaoAlvo('');
  };
  const adicionarAutomacao = () => {
    if (!entidadeAutomacao || !omniGatilhoId || !omniAcaoId) { setErro('Selecione uma entidade, um gatilho e uma ação OMNI.'); return; }
    const id = crypto.randomUUID();
    setAutomacoesOmni(previous => [...previous, {
      id, habilitada: false, prioridade: automacoesOmni.length, entidadeOmniId: entidadeAutomacao.id,
      gatilhoId: omniGatilhoId, acaoId: omniAcaoId,
      ...(autonomiaCusto ? { politicaCusto: autonomiaCusto as 'manual' | 'permitir_pe' | 'preferir_sem_custo' } : {}),
      ...(autonomiaAlvo ? { politicaAlvo: autonomiaAlvo as 'manual' | 'prioridade' | 'ameaca_mais_proxima' } : {}),
      ...(autonomiaLimite.trim() && Number.isInteger(Number(autonomiaLimite)) ? { limitePorRodada: Number(autonomiaLimite) } : {}),
      revisao: 1,
    }]);
    setCondicoesAutomacaoJson(previous => ({ ...previous, [id]: '' }));
  };
  const criarConfigExtra = (key: CampoExtra, campo: EstadoExtra): CampoDerivadoInvocacao => {
    if (campo.modo === 'automatico') return { modo: 'automatico' };
    if (campo.modo === 'revisao_necessaria') {
      const preserve: unknown = campo.valorManual === '' ? null : campo.valorManual;
      return { modo: 'revisao_necessaria', valorPreservado: preserve, motivo: campo.motivo || 'Fórmula automática ainda não cadastrada para ' + key + '.' };
    }
    if (key !== 'resistencias') {
      if (campo.valorManual.trim() === '' || !Number.isFinite(Number(campo.valorManual)) || Number(campo.valorManual) < 0) {
        throw new Error('Informe um valor manual finito e não negativo para ' + key + '.');
      }
      return { modo: 'manual', valor: Number(campo.valorManual) };
    }
    return { modo: 'manual', valor: campo.valorManual.trim() };
  };
  const numeroOpcional = (value: string, label: string): number | undefined => {
    if (!value.trim()) return undefined;
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(label + ' precisa ser um número finito.');
    return number;
  };
  const inteiroOpcional = (value: string, label: string): number | undefined => {
    const number = numeroOpcional(value, label);
    if (number === undefined) return undefined;
    if (!Number.isInteger(number) || number < 0) throw new Error(label + ' precisa ser um inteiro não negativo.');
    return number;
  };
  const salvar = async () => {
    if (salvando) return;
    if (aguardandoMestre) { setErro('Esta versão está aguardando o Mestre e não pode ser editada.'); return; }
    if (!nome.trim()) { setErro('Informe o nome da ficha.'); return; }
    const tecnicaIntermediario = character.tecnicaAmaldicoada?.trim() ?? '';
    const erroAtributos = validarAtributosShikigami(grau, atributos);
    if (erroAtributos) { setErro(erroAtributos); return; }
    if (Number.isFinite(hpMaximoComCaracteristicas) && hpMaximoComCaracteristicas < 1) { setErro('PV máximo precisa ser maior que zero.'); return; }
    setSalvando(true); setErro(''); setMensagem('');
    try {
      if (!resolvidos) throw new Error('Resolva os valores derivados manuais antes de salvar.');
      const maxHP = hpMaximoComCaracteristicas;
      const atualHP = pvAtual.trim() === '' && !initial ? maxHP : Number(pvAtual);
      if (!Number.isFinite(atualHP) || atualHP < 0 || atualHP > maxHP) throw new Error('PV atual precisa ficar entre zero e o PV máximo.');
      if (valoresFinais.defesa < 0 || valoresFinais.deslocamentoM < 0 || valoresFinais.custoInvocacaoPE < 0) throw new Error('Defesa, deslocamento e custos derivados não podem ser negativos.');
      const alcancePosicionamento = numeroOpcional(alcanceInvocacaoM, 'Alcance de posicionamento');
      if (alcancePosicionamento === undefined || alcancePosicionamento < 0) throw new Error('Defina um alcance de posicionamento igual ou maior que zero.');
      const timeQty = numeroOpcional(tempoQuantidade, 'Tempo adicional');
      if ((timeQty === undefined) !== !tempoUnidade.trim()) throw new Error('Preencha quantidade e unidade do tempo adicional juntas.');
      const valoresDerivados: Record<string, CampoDerivadoInvocacao> = { ...resolvidos.configuracao };
      for (const key of ['custoSustentacaoPE', 'alcanceM', 'resistencias'] as CampoExtra[]) {
        valoresDerivados[key] = criarConfigExtra(key, extrasDerivados[key]);
      }
      const nivEvolucao = inteiroOpcional(nivelEvolucao, 'Nível de evolução');
      const economy: Record<string, number> = {};
      for (const key of ['acaoComum', 'acaoSimples', 'acaoComplexa', 'acaoMovimento', 'acaoBonus', 'acaoLivre', 'reacao']) {
        const value = inteiroOpcional(economia[key] ?? '', key);
        if (value !== undefined) economy[key] = value;
      }
      const resetPorCategoria = Object.fromEntries(
        Object.entries(resetEconomia).filter(([key, policy]) => economy[key] !== undefined && !!policy),
      ) as Partial<Record<CategoriaEconomiaInvocacao, LimiteResetEconomiaInvocacao>>;
      const time = timeQty === undefined ? undefined : { quantidade: timeQty, unidade: tempoUnidade.trim() };
      const acoesParaSalvar = acoes.map(action => ({ ...action, tipoExecucao: action.tipoExecucao ?? 'legada' as const }));
      const automacoesParaSalvar = automacoesOmni.map(item => {
        const raw = (condicoesAutomacaoJson[item.id] ?? '').trim();
        if (!raw) {
          const { condicaoAST: _condicaoAST, ...semCondicao } = item;
          return semCondicao;
        }
        let condicaoAST: unknown;
        try { condicaoAST = JSON.parse(raw); }
        catch { throw new Error(`A condição JSON da automação ${item.id} está inválida.`); }
        if (!validarCondicaoAutonomia(condicaoAST)) throw new Error(`A condição da automação ${item.id} não usa o AST seguro aceito.`);
        return { ...item, condicaoAST };
      });
      const autonomous = autonomiaModo ? {
        modo: autonomiaModo as 'manual' | 'misto' | 'automatico',
        ...(autonomiaAlvo ? { politicaAlvo: autonomiaAlvo } : {}),
        ...(autonomiaCusto ? { politicaCusto: autonomiaCusto } : {}),
        ...(autonomiaPrioridade ? { prioridadeAlvo: autonomiaPrioridade } : {}),
        ...(autonomiaLimite.trim() ? { limitePorRodada: inteiroOpcional(autonomiaLimite, 'Limite de autonomia') } : {}),
      } : undefined;
      const intermediario = intermediarioTipo ? {
        tipo: intermediarioTipo,
        ...(intermediarioItem ? { itemInventarioId: intermediarioItem } : {}),
        ...(intermediarioTipo === 'tecnica' && tecnicaIntermediario ? { tecnicaId: tecnicaIntermediario } : {}),
      } : undefined;
      const caracteristicaCompletas = caracteristicas.map(item => ({
        ...item,
        ...(item.resistencia ? { resistencia: item.resistencia } : {}),
        ...(item.sentidos ? { sentidos: item.sentidos } : {}),
        ...(item.propriedades ? { propriedades: item.propriedades } : {}),
      }));
      const beforeChanged = Boolean(initial && (initial.grau !== grau || initial.nivelEvolucao !== nivEvolucao || JSON.stringify(initial.atributos ?? {}) !== JSON.stringify(atributos)));
      const registroEvolucao = [
        ...(initial?.registroEvolucao ?? []),
        ...(beforeChanged ? [{ id: crypto.randomUUID(), em: new Date().toISOString(), de: { grau: initial?.grau, nivelEvolucao: initial?.nivelEvolucao, atributos: initial?.atributos }, para: { grau, nivelEvolucao: nivEvolucao, atributos: { ...atributos } } }] : []),
        ...(notaEvolucao.trim() ? [{ id: crypto.randomUUID(), em: new Date().toISOString(), tipo: 'nota_evolucao', texto: notaEvolucao.trim(), grau }] : []),
      ];
      const version = initial ? (initial.versaoModelo ?? 1) + 1 : 1;
      const id = initial?.id ?? crypto.randomUUID();
      const recoveryRules = {
        derrotaPorPVNegativo: 'menos_cem_por_cento_pv_maximo',
        curaAcimaDeZeroLevanta: false,
        acaoParaLevantar: 'acao_de_movimento_propria',
        dissipacaoVoluntariaMinSegundos: 10,
        contribuicaoNaDerrotaDefinitiva: 'preservar_saldo_restante',
      } as const;
      const snapshot = {
        schemaVersion: INVOCACAO_SCHEMA_VERSION,
        version, id, donoCharacterId: character.id, tipo, nome: nome.trim(),
        ...(apelido.trim() ? { apelido: apelido.trim() } : {}),
        ...(subcategoria.trim() ? { subcategoria: subcategoria.trim() } : {}),
        ...(nivEvolucao !== undefined ? { nivelEvolucao: nivEvolucao } : {}),
        descricao, historico, origem: { tipo: origemTipo, ...(origemReferencia.trim() ? { entidadeId: origemReferencia.trim() } : {}) },
        ...(origemAquisicao ? { origemAquisicao } : {}),
        ...(referenciaInterludio.trim() ? { referenciaInterludio: referenciaInterludio.trim() } : {}),
        grau, tamanho: porte, ...(imagemAssetId ? { imagemAssetId } : {}),
        ...(imagemFallbackAssetId ? { imagemFallbackAssetId } : {}),
        ...(imagemAltText.trim() ? { imagemAltText: imagemAltText.trim() } : {}),
        ...(corIdentificacao ? { corIdentificacao } : {}), nomeplate, formaToken, ...(tokenCrop ? { tokenCrop } : {}),
        ...(intermediario ? { intermediario } : {}), atributos: { ...atributos }, valoresDerivados,
        alcanceInvocacaoM: alcancePosicionamento,
        estadoLegado: {
          hpAtual: atualHP, hpMaximo: maxHP, defesa: valoresFinais.defesa,
          deslocamentoM: valoresFinais.deslocamentoM, custoInvocacaoPE: valoresFinais.custoInvocacaoPE,
          ...(extrasDerivados.custoSustentacaoPE.modo !== 'automatico' && extrasDerivados.custoSustentacaoPE.valorManual ? { custoSustentacaoPE: Number(extrasDerivados.custoSustentacaoPE.valorManual) } : {}),
        },
        periciasTreinadas, ...(atributoBasePericias ? { atributoBasePericias } : {}),
        ataqueTreinado: {
          ...(tipoAtaqueTreinado ? { tipo: tipoAtaqueTreinado } : {}),
          ...(atributoAtaqueTreinado ? { atributo: atributoAtaqueTreinado } : {}),
          ...(numeroOpcional(ataqueTreinadoBonus, 'Bônus do ataque treinado') !== undefined ? { bonus: numeroOpcional(ataqueTreinadoBonus, 'Bônus do ataque treinado') } : {}),
        },
        ...(resistenciaTreinada ? { resistenciaTreinada: { nome: resistenciaTreinada, ...(numeroOpcional(bonusResistenciaTreinada, 'Bônus de resistência') !== undefined ? { bonus: numeroOpcional(bonusResistenciaTreinada, 'Bônus de resistência') } : {}) } } : {}),
        recursosConfigurados: recursos,
        ...(Object.keys(custosComandos).length ? { custosComandosConfigurados: custosComandos } : {}),
        acoes: acoesParaSalvar, caracteristicas: caracteristicaCompletas, possuiEnergiaReversa, reacoes, automacoesOmni: automacoesParaSalvar,
        omniConfiguracao: {
          ...(omniGatilhoEntidade ? { entidadeId: omniGatilhoEntidade } : {}),
          ...(omniAcaoId ? { acaoId: omniAcaoId } : {}),
          ...(omniGatilhoId ? { gatilhoId: omniGatilhoId } : {}),
          ...(omniChave.trim() ? { chave: omniChave.trim() } : {}),
          ...(omniFormula.trim() ? { formula: omniFormula.trim() } : {}),
          ...(omniEfeito.trim() ? { efeito: omniEfeito.trim() } : {}),
          ...(omniAlvos.trim() ? { alvos: omniAlvos.trim() } : {}),
          ...(omniArea.trim() ? { area: omniArea.trim() } : {}),
          ...(omniSustentacao.trim() ? { sustentacao: omniSustentacao.trim() } : {}),
          ...(omniContador.trim() ? { contador: omniContador.trim() } : {}),
          ...(omniDiagnosticos.trim() ? { diagnosticos: omniDiagnosticos.trim() } : {}),
        },
        ...(autonomous ? { autonomia: autonomous } : {}),
        ...(Object.keys(economy).length ? {
          economiaAcoesConfigurada: {
            ...economy,
            ...(Object.keys(resetPorCategoria).length ? { resetPorCategoria } : {}),
          },
        } : {}),
        ...(nivEvolucao !== undefined || registroEvolucao.length ? { registroEvolucao } : {}),
        ...(time ? { tempoAdicional: time } : {}),
        regrasRecuperacao: recoveryRules,
        aquisicao: { estado: 'pendente', fonte: 'mestre' },
        aprovacaoMestre: 'pendente' as const, versaoModelo: version,
        hpAtual: atualHP, hpMaximo: maxHP, defesa: valoresFinais.defesa,
        deslocamentoM: valoresFinais.deslocamentoM, porte,
        custoInvocacaoPE: valoresFinais.custoInvocacaoPE,
        ...(extrasDerivados.custoSustentacaoPE.modo !== 'automatico' && extrasDerivados.custoSustentacaoPE.valorManual.trim() ? { custoSustentacaoPE: Number(extrasDerivados.custoSustentacaoPE.valorManual) } : {}),
      };
      if (tipo === 'shikigami' && grau === 'quarto' && Object.values(atributos).some(value => !Number.isFinite(value))) {
        throw new Error('A ficha possui atributo não finito.');
      }
      const validado = ModeloInvocacaoSchema.safeParse(snapshot);
      if (!validado.success) throw new Error('Ficha inválida: ' + validado.error.issues[0]?.message);
      const solicitacao = await submeterAprovacaoInvocacao({ data: {
        requestId: crypto.randomUUID(), invocationId: id, ownerCharacterId: character.id,
        versionSubmitted: version, snapshot: snapshot as unknown as Record<string, unknown>,
      } });
      const salvo: InvocacaoControlador = {
        ...snapshot,
        aprovacaoMestre: solicitacao.status,
        versaoAprovada: solicitacao.versaoAprovada ?? undefined,
        solicitacaoAprovacaoId: solicitacao.requestId,
        versaoModelo: version,
      } as unknown as InvocacaoControlador;
      const catalogo = character.invocacoesConhecidas ?? [];
      update(character.id, {
        invocacoesConhecidas: initial
          ? catalogo.map(inv => inv.id === id ? salvo : inv)
          : [...catalogo, salvo],
        limiteInvocacoesConhecidas: character.specialization === 'Controlador' ? limiteInvocacoesConhecidas(character.level) : undefined,
      });
      setMensagem(solicitacao.status === 'aprovada' ? 'Ficha aprovada pelo Mestre.' : 'Ficha enviada ao Mestre para aprovação.');
      onSaved?.();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar a ficha ao Mestre.');
    } finally { setSalvando(false); }
  };

  const renderDerivado = (key: CampoDerivadoShikigami) => {
    const state = derivados[key];
    const auto = automaticos[key];
    return <div key={key} className="space-y-1 rounded border border-border p-2">
      <label className="block text-xs font-medium">{labelsDerivadas[key]}
        <select aria-label={'Modo de ' + labelsDerivadas[key]} className="mt-1 w-full rounded border bg-background p-2" value={state.modo}
          onChange={event => {
            const modo = event.target.value as ModoDerivado;
            atualizarDerivado(key, { modo, valorManual: state.valorManual ?? auto, motivo: state.motivo || 'Requer confirmação manual do modo legado.' });
          }}>
          <option value="automatico">Automático</option><option value="manual">Manual</option><option value="revisao_necessaria">Revisão necessária</option>
        </select>
      </label>
      {state.modo === 'manual' && <label className="block text-xs">Valor manual
        <input aria-label={labelsDerivadas[key] + ' manual'} type="number" step="any" value={state.valorManual ?? ''} onChange={event => atualizarDerivado(key, { valorManual: event.target.value === '' ? null : Number(event.target.value) })} className="mt-1 w-full rounded border bg-background p-2" />
      </label>}
      {state.modo === 'automatico' && <p className="text-xs text-muted-foreground">Prévia: {auto}{key === 'deslocamentoM' ? ' m' : key === 'custoInvocacaoPE' ? ' PE' : ''}. Recalcula ao mudar grau, atributos ou nível.</p>}
      {state.modo === 'revisao_necessaria' && <p className="text-xs text-amber-700">Valor preservado: {state.valorManual ?? 'não informado'}. Escolha automático ou manual para confirmar a origem.</p>}
    </div>;
  };
  const renderExtra = (key: CampoExtra, label: string, unit: string, autoAvailable: boolean) => {
    const state = extrasDerivados[key];
    return <div key={key} className="space-y-1 rounded border border-border p-2">
      <label className="block text-xs font-medium">{label}
        <select aria-label={'Modo de ' + label} className="mt-1 w-full rounded border bg-background p-2" value={state.modo}
          onChange={event => atualizarExtra(key, { modo: event.target.value as ModoDerivado, motivo: state.motivo || 'Fórmula automática ainda não cadastrada.' })}>
          <option value="automatico">Automático</option><option value="manual">Manual</option><option value="revisao_necessaria">Revisão necessária</option>
        </select>
      </label>
      {state.modo === 'manual' && <label className="block text-xs">Valor manual
        <input aria-label={label + ' manual'} type={key === 'resistencias' ? 'text' : 'number'} step="any" value={state.valorManual} onChange={event => atualizarExtra(key, { valorManual: event.target.value })} className="mt-1 w-full rounded border bg-background p-2" />
      </label>}
      {state.modo === 'automatico' && <p className="text-xs text-muted-foreground">{autoAvailable ? 'Cálculo automático configurado.' : 'Sem fórmula automática cadastrada; o valor fica sem cálculo nesta etapa.'}{unit ? ' ' + unit : ''}</p>}
      {state.modo === 'revisao_necessaria' && <p className="text-xs text-amber-700">Valor preservado para revisão: {state.valorManual || 'não informado'}.</p>}
    </div>;
  };

  return <div className="space-y-3 rounded-lg border border-border p-3 text-sm">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="font-semibold">{isEditing ? 'Editar ficha de invocação' : 'Criador completo de Shikigami'}</h3>
        <p className="text-xs text-muted-foreground">Ficha contínua com seções navegáveis. A submissão cria uma versão que precisa de aprovação do Mestre.</p></div>
      {onCancel && <button type="button" className="rounded border px-3 py-2 text-xs" onClick={onCancel}>Cancelar edição</button>}
    </div>
    {aguardandoMestre && <p role="status" className="rounded border border-amber-500/50 p-2 text-xs">Esta versão está pendente. Aguarde o Mestre antes de editar.</p>}
    <nav aria-label="Navegação das seções da ficha" className="flex flex-wrap gap-1 border-b border-border pb-2">
      {['A Identidade','B Arte','C Evolução','D Atributos','E Derivados','F Treinamentos','G Ações','H Passivas','I Reações','J OMNI','K Autonomia','L Economia','M Tempo','N Recuperação','O Aprovação'].map((label, index) =>
        <a key={label} href={'#sec-' + String.fromCharCode(65 + index)} className="rounded border px-2 py-1 text-xs">{label}</a>)}
    </nav>

    <details id="sec-A" open className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">A · Identidade, origem e aquisição</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">Nome<input aria-label="Nome da invocação" maxLength={160} value={nome} onChange={event => setNome(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Apelido<input value={apelido} onChange={event => setApelido(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Tipo<select value={tipo} onChange={event => setTipo(event.target.value as 'shikigami' | 'corpo_amaldicoado')} className="mt-1 w-full rounded border bg-background p-2"><option value="shikigami">Shikigami</option><option value="corpo_amaldicoado">Corpo amaldiçoado</option></select></label>
        <label className="text-xs">Subcategoria<input value={subcategoria} onChange={event => setSubcategoria(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Responsável<input value={character.name} readOnly className="mt-1 w-full rounded border bg-muted p-2" /></label>
        <label className="text-xs">Origem da ficha<select value={origemTipo} onChange={event => setOrigemTipo(event.target.value as ModoOrigem)} className="mt-1 w-full rounded border bg-background p-2"><option value="manual">Manual</option><option value="grimorio">Grimório</option><option value="omni">OMNI</option></select></label>
        <label className="text-xs">ID de referência da origem<input value={origemReferencia} onChange={event => setOrigemReferencia(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Origem da aquisição<select value={origemAquisicao} onChange={event => setOrigemAquisicao(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Não definida</option><option value="interludio">Interlúdio</option><option value="livro">Referência do livro</option><option value="mestre">Decisão do Mestre</option><option value="outra">Outra</option></select></label>
        <label className="text-xs">Referência do Interlúdio<input value={referenciaInterludio} onChange={event => setReferenciaInterludio(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Alcance de posicionamento (m)<input aria-label="Alcance de posicionamento" type="number" min="0" step="any" value={alcanceInvocacaoM} onChange={event => setAlcanceInvocacaoM(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /><span className="mt-1 block text-xs text-muted-foreground">Distância máxima entre o centro do Controlador e o centro da célula escolhida no mapa.</span></label>
        <label className="text-xs">Intermediário<select value={intermediarioTipo} onChange={event => { setIntermediarioTipo(event.target.value as '' | 'talisma' | 'dispositivo' | 'tecnica'); setIntermediarioItem(''); }} className="mt-1 w-full rounded border bg-background p-2"><option value="">Não configurado</option>{tipo === 'shikigami' ? <><option value="talisma">Talismã</option><option value="tecnica" disabled={!character.tecnicaAmaldicoada?.trim()}>Técnica inata do personagem</option></> : <option value="dispositivo">Dispositivo próprio do corpo</option>}</select></label>
        {(intermediarioTipo === 'talisma' || intermediarioTipo === 'dispositivo') && <label className="text-xs">Item real do inventário<select value={intermediarioItem} onChange={event => setIntermediarioItem(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Selecione um item</option>{inventarioDoDono.filter(item => item.entity.categoria === 'item' && (item.entity.slotType ?? 'nenhum') === 'nenhum').map(item => <option key={item.instanceId} value={item.instanceId}>{item.entity.nome} · {item.emMaos ? 'em mãos' : 'na mochila'}{item.quebrado ? ' · quebrado' : ''} · {item.instanceId.slice(0, 8)}</option>)}</select></label>}
        {intermediarioTipo === 'tecnica' && <div className="space-y-1"><label className="block text-xs">Técnica amaldiçoada do personagem<input value={character.tecnicaAmaldicoada ?? ''} readOnly className="mt-1 w-full rounded border bg-muted p-2" /></label><p className="text-xs text-muted-foreground">A ficha precisa ser aprovada pelo Mestre para usar esta exceção ao talismã.</p></div>}
        <p className="sm:col-span-2 text-xs text-muted-foreground">Cada item intermediário real vinculado ocupa 0,5 espaço de inventário quando a aquisição for aprovada.</p>
        <p className="sm:col-span-2 text-xs text-amber-300">A ficha continua editável sem intermediário validado. Para invocar, o intermediário precisa ser compatível e disponível; divergências bloqueiam a invocação e podem ser corrigidas depois.</p>
        <label className="text-xs sm:col-span-2">Descrição<textarea value={descricao} onChange={event => setDescricao(event.target.value)} rows={3} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs sm:col-span-2">Histórico<textarea value={historico} onChange={event => setHistorico(event.target.value)} rows={4} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Grau<select value={grau} onChange={event => setGrau(event.target.value as GrauShikigami)} className="mt-1 w-full rounded border bg-background p-2">{todosGraus.map(value => <option key={value} value={value}>{rotulosGraus[value]}{grausDisponiveis(character.level).includes(value) ? '' : ' · acima do nível atual'}</option>)}</select></label>
      </div>
    </details>

    <details id="sec-B" className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">B · Arte, token e miniatura</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs">Imagem principal<input type="file" accept="image/*" disabled={assetBusy} onChange={event => void uploadImagem(event.target.files?.[0], false)} className="mt-1 block w-full text-xs" /></label>
        <label className="text-xs">Imagem alternativa<input type="file" accept="image/*" disabled={assetBusy} onChange={event => void uploadImagem(event.target.files?.[0], true)} className="mt-1 block w-full text-xs" /></label>
        <label className="text-xs">Texto alternativo<input value={imagemAltText} onChange={event => setImagemAltText(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Cor de identificação<input type="color" value={corIdentificacao} onChange={event => setCorIdentificacao(event.target.value)} className="mt-1 h-10 w-full rounded border bg-background p-1" /></label>
        <label className="text-xs">Forma do token<select value={formaToken} onChange={event => setFormaToken(event.target.value as 'ELLIPSE' | 'RECT')} className="mt-1 w-full rounded border bg-background p-2"><option value="ELLIPSE">Circular</option><option value="RECT">Retangular</option></select></label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={nomeplate} onChange={event => setNomeplate(event.target.checked)} />Exibir plaqueta com o nome</label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded border" style={{ borderColor: corIdentificacao }}>
            {assetPrincipal ? <img key={assetTick} src={assetPrincipal.url} alt={imagemAltText || apelido || nome || 'Miniatura da invocação'} className="h-full w-full object-cover" /> : <span className="text-xs text-muted-foreground">Sem arte</span>}
          </div>
          <div className="space-y-1"><p className="text-xs">Prévia do token · {nomeplate ? (apelido || nome || 'Sem nome') : 'plaqueta oculta'}</p>
            <button type="button" disabled={!imagemAssetId} onClick={() => setCropOpen(true)} className="rounded border px-2 py-1 text-xs disabled:opacity-50">Ajustar corte e moldura</button>
            {imagemFallbackAssetId && <div className="flex items-center gap-2 text-xs text-muted-foreground">{assetFallback && <img src={assetFallback.url} alt="Miniatura alternativa" className="h-10 w-10 rounded border object-cover" />}<span>{assetFallback ? 'Arte alternativa carregada.' : 'Arte alternativa salva; carregando prévia.'}</span></div>}
          </div>
        </div>
      </div>
      {assetBusy && <p role="status" className="text-xs">Guardando imagem…</p>}
      {assetErro && <p role="alert" className="text-xs text-destructive">{assetErro}</p>}
    </details>

    <details id="sec-C" className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">C · Evolução e histórico de crescimento</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">Nível de evolução (opcional)<input type="number" min="0" step="1" value={nivelEvolucao} onChange={event => setNivelEvolucao(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <div className="text-xs text-muted-foreground">Grau atual: {rotulosGraus[grau]}. Alterações de grau e atributos serão registradas ao salvar.</div>
      </div>
      <label className="mt-2 block text-xs">Nota desta evolução<textarea value={notaEvolucao} onChange={event => setNotaEvolucao(event.target.value)} rows={2} className="mt-1 w-full rounded border bg-background p-2" /></label>
      {(initial?.registroEvolucao?.length ?? 0) > 0 && <p className="mt-2 text-xs text-muted-foreground">Este modelo já tem {initial?.registroEvolucao?.length} registro(s) de evolução.</p>}
    </details>

    <details id="sec-D" open className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">D · Atributos, pontos e modificadores</summary>
      <p className="mt-2 text-xs">Pontos restantes: <strong>{pontosRestantes}</strong> de {grauRegra.pontos} · máximo de referência: {grauRegra.maximo}. Diferenças do livro aparecem como aviso.</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ATRIBUTOS_SHIKIGAMI.map(key => <label key={key} className="text-xs">{rotulosAtributos[key]}
          <input aria-label={rotulosAtributos[key]} type="number" step="1" value={atributos[key]} onChange={event => setAtributos(previous => ({ ...previous, [key]: event.target.value === '' ? Number.NaN : Number(event.target.value) }))} className="mt-1 w-full rounded border bg-background p-2" />
          <span className="text-xs text-muted-foreground">Modificador {Number.isFinite(atributos[key]) ? modificadorAtributoShikigami(atributos[key]) : '—'}</span>
        </label>)}
      </div>
    </details>

    <details id="sec-E" open className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">E · Valores derivados e modo por campo</summary>
      <p className="mt-2 text-xs text-muted-foreground">Cada campo mantém seu modo separadamente. Campos automáticos mostram prévia; os manuais não mudam quando atributos ou grau mudam. O alcance de posicionamento é definido acima e é diferente do alcance dos ataques.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">{chavesDerivadas.map(renderDerivado)}</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {renderExtra('custoSustentacaoPE', 'Custo de sustentação', 'PE', false)}
        {renderExtra('alcanceM', 'Alcance', 'm', false)}
        {renderExtra('resistencias', 'Resistências', '', false)}
      </div>
      <label className="mt-2 block text-xs">PV atual
        <input type="number" step="any" min="0" max={hpMaximoComCaracteristicas} value={pvAtual || (!initial ? hpMaximoComCaracteristicas : '')} onChange={event => setPvAtual(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" />
        {bonusPVCaracteristicas({ grau, caracteristicas }) > 0 && <span className="mt-1 block text-xs text-muted-foreground">Inclui +{bonusPVCaracteristicas({ grau, caracteristicas })} PV da característica operacional.</span>}
      </label>
      <label className="mt-2 block text-xs">Porte<select value={porte} onChange={event => setPorte(event.target.value as InvocacaoControlador['porte'])} className="mt-1 w-full rounded border bg-background p-2"><option>Pequeno</option><option>Médio</option><option>Grande</option></select></label>
    </details>

    <details id="sec-F" className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">F · Treinamentos e prévia de rolagem</summary>
      <div className="mt-3 space-y-2">
        <p className="text-xs">Perícias treinadas</p>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          {skills.map(key => <label key={key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={periciasTreinadas.includes(key)} onChange={() => alternarPericia(key)} />{ROTULOS_PERICIAS[key]}</label>)}
        </div>
        <label className="block text-xs">Atributo-base das perícias<select value={atributoBasePericias} onChange={event => setAtributoBasePericias(event.target.value as 'inteligencia' | 'sabedoria' | '')} className="mt-1 w-full rounded border bg-background p-2"><option value="">Não definido</option><option value="inteligencia">Inteligência</option><option value="sabedoria">Sabedoria</option></select></label>
        <label className="block text-xs">Ataque treinado<select value={tipoAtaqueTreinado} onChange={event => setTipoAtaqueTreinado(event.target.value as 'corpo_a_corpo' | 'distancia' | '')} className="mt-1 w-full rounded border bg-background p-2"><option value="">Não definido</option><option value="corpo_a_corpo">Corpo a corpo</option><option value="distancia">À distância</option></select></label>
        <label className="block text-xs">Atributo do ataque<select value={atributoAtaqueTreinado} onChange={event => setAtributoAtaqueTreinado(event.target.value as 'forca' | 'destreza' | '')} className="mt-1 w-full rounded border bg-background p-2"><option value="">Não definido</option><option value="forca">Força</option><option value="destreza">Destreza</option></select></label>
        <label className="block text-xs">Bônus extra do ataque<input type="number" step="any" value={ataqueTreinadoBonus} onChange={event => setAtaqueTreinadoBonus(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="block text-xs">Teste de resistência treinado<select value={resistenciaTreinada} onChange={event => setResistenciaTreinada(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Não definido</option>{DEFAULT_SAVING_THROWS.filter(name => name !== 'Integridade').map(name => <option key={name} value={name}>{name}</option>)}{resistenciaTreinada === 'Integridade' && <option value="Integridade">Integridade · legado</option>}</select></label>
        <label className="block text-xs">Bônus extra do teste<input type="number" step="any" value={bonusResistenciaTreinada} onChange={event => setBonusResistenciaTreinada(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <p className="rounded border border-border p-2 text-xs">Prévia de perícia: {atributoBasePericias ? '1d20 + ' + modificadorAtributoShikigami(atributos[atributoBasePericias]) + ' + ' + bonusTreinamento + ' = 1d20 + ' + (modificadorAtributoShikigami(atributos[atributoBasePericias]) + bonusTreinamento) : 'selecione o atributo-base para calcular'}.</p>
      </div>
    </details>

    <details id="sec-G" className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">G · Catálogo de ações</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">Execução<select value={acaoExecucao} onChange={event => setAcaoExecucao(event.target.value as 'manual' | 'omni' | 'referencia_omni')} className="mt-1 w-full rounded border bg-background p-2"><option value="manual">Manual</option><option value="omni">OMNI</option><option value="referencia_omni">Referência OMNI</option></select></label>
        {acaoExecucao === 'manual' ? <>
          <label className="text-xs">Nome<input value={acaoNome} onChange={event => setAcaoNome(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
          <label className="text-xs">Categoria<select value={acaoCategoria} onChange={event => setAcaoCategoria(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Selecione</option><option value="acao_comum">Comum</option><option value="acao_simples">Simples</option><option value="acao_complexa">Complexa</option><option value="acao_bonus">Bônus</option><option value="movimento">Movimento</option><option value="livre">Livre</option><option value="reacao">Reação</option></select></label>
        </> : <>
          <label className="text-xs">Entidade OMNI<select value={acaoOmniEntidade} onChange={event => { setAcaoOmniEntidade(event.target.value); setAcaoOmniId(''); setErro(''); }} className="mt-1 w-full rounded border bg-background p-2"><option value="">Selecione uma entidade</option>{Object.values(entidades).map(entity => <option key={entity.id} value={entity.id}>{entity.nome}</option>)}</select></label>
          <label className="text-xs">Ação OMNI<select value={acaoOmniId} onChange={event => selecionarAcaoOmni(event.target.value)} disabled={!entidadeOmniSelecionada} className="mt-1 w-full rounded border bg-background p-2"><option value="">Selecione uma ação</option>{(entidadeOmniSelecionada?.acoesAtivas ?? []).map(action => <option key={action.id} value={action.id}>{action.nome}</option>)}</select></label>
          <p className="sm:col-span-2 rounded border border-border p-2 text-xs text-muted-foreground">A entidade OMNI define nome, categoria, teste, dano, alcance, bônus e custo. A ficha do Shikigami define seus atributos; distribua o custo fixo de PE entre controlador e recurso próprio.</p>
          {previewOmni && !previewOmni.ok && <p role="alert" className="sm:col-span-2 text-xs text-destructive">{previewOmni.motivo}</p>}
        </>}
        {acaoExecucao === 'manual' && <label className="text-xs">Tipo de ação<select value={acaoTipo} onChange={event => {
          const next = event.target.value as NonNullable<AcaoFicha['tipo']>;
          setAcaoTipo(next);
          setAcaoTeste(next === 'ataque' ? 'ataque' : 'nenhum');
        }} className="mt-1 w-full rounded border bg-background p-2"><option value="ataque">Ataque</option><option value="habilidade">Habilidade</option><option value="movimento">Movimento</option><option value="bonus">Bônus</option><option value="suporte">Suporte</option></select></label>}
        {acaoExecucao === 'manual' && acaoTipo === 'suporte' && <>
          <label className="text-xs">Efeito tabelado<select value={acaoEfeitoSuporte} onChange={event => setAcaoEfeitoSuporte(event.target.value as typeof acaoEfeitoSuporte)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Selecione</option><option value="cura">Cura / PVT</option><option value="defesa">Bônus de Defesa</option><option value="acerto">Bônus de Acerto</option><option value="dano_adicional">Dano adicional no próximo ataque</option><option value="reducao_dano">Redução de Dano</option></select></label>
          {acaoEfeitoSuporte === 'cura' && <>
            <label className="text-xs">Alvos da cura<select value={acaoAlvosSuporte} onChange={event => setAcaoAlvosSuporte(event.target.value as 'unico' | 'multiplos')} className="mt-1 w-full rounded border bg-background p-2"><option value="unico">Alvo único</option><option value="multiplos">Múltiplos alvos</option></select></label>
            <label className="text-xs">Atributo somado à cura<select value={acaoAtributoCura} onChange={event => setAcaoAtributoCura(event.target.value as 'sabedoria' | 'presenca')} className="mt-1 w-full rounded border bg-background p-2"><option value="sabedoria">Sabedoria</option><option value="presenca">Presença</option></select></label>
          </>}
          {acaoEfeitoSuporte === 'reducao_dano' && <label className="text-xs">Tipos de dano cobertos (Ctrl/Cmd para vários)<select multiple value={acaoTiposDanoRD} onChange={event => setAcaoTiposDanoRD(Array.from(event.target.selectedOptions, option => option.value as import('@/types').DamageType))} className="mt-1 min-h-24 w-full rounded border bg-background p-2">{(['DCO','DP','DI','DA','DCG','DCC','DQ','DS','DAL','DNR','DE','DPS','DR','DN','DV'] as const).map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}</select></label>}
          <p className="text-xs text-muted-foreground">A cura exige Ação Complexa. Defesa e Acerto usam Ação Simples; Dano adicional e RD aceitam ação simples ou complexa. O alcance do auxílio é 1,5 m por padrão; cure usa o alcance do grau.</p>
        </>}
        {acaoExecucao === 'manual' && <>
          <label className="text-xs">Rolagem da ação<select value={acaoTeste} onChange={event => setAcaoTeste(event.target.value as 'nenhum' | 'ataque' | 'resistencia')} className="mt-1 w-full rounded border bg-background p-2"><option value="nenhum">Sem rolagem automática</option><option value="ataque">Ataque contra Defesa</option><option value="resistencia">Teste de Resistência do alvo</option></select></label>
          <label className="text-xs">Dano ou efeito<input aria-label="Fórmula de dano" value={acaoDano} onChange={event => setAcaoDano(event.target.value)} placeholder="Ex.: 2d12+1d6+3" className="mt-1 w-full rounded border bg-background p-2" /><span className="mt-1 block text-muted-foreground">O modificador do atributo é somado separadamente.</span></label>
        </>}
        {acaoTeste === 'ataque' && <>
          <label className="text-xs">Tipo de ataque<select value={acaoTipoAtaque} onChange={event => setAcaoTipoAtaque(event.target.value as 'corpo_a_corpo' | 'distancia')} className="mt-1 w-full rounded border bg-background p-2"><option value="corpo_a_corpo">Corpo a corpo</option><option value="distancia">À distância</option></select></label>
          <label className="text-xs">Atributo do ataque<select value={acaoAtributoAtaque} onChange={event => setAcaoAtributoAtaque(event.target.value as 'forca' | 'destreza')} className="mt-1 w-full rounded border bg-background p-2"><option value="forca">Força</option><option value="destreza">Destreza</option></select></label>
          <label className="text-xs">Margem de crítico<input type="number" min="2" max="20" step="1" value={acaoMargemCritico} onChange={event => setAcaoMargemCritico(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
          <label className="text-xs">Multiplicador crítico<input type="number" min="1" max="5" step="1" value={acaoMultiplicadorCritico} onChange={event => setAcaoMultiplicadorCritico(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        </>}
        {acaoTeste === 'resistencia' && <>
          {acaoExecucao === 'manual' && <label className="text-xs">TR do alvo<select value={acaoResistenciaAlvo} onChange={event => setAcaoResistenciaAlvo(event.target.value)} className="mt-1 w-full rounded border bg-background p-2">{DEFAULT_SAVING_THROWS.map(nome => <option key={nome} value={nome}>{nome}</option>)}</select></label>}
          <label className="text-xs">Atributo da CD<select value={acaoAtributoCD} onChange={event => setAcaoAtributoCD(event.target.value as keyof AtributosShikigami)} className="mt-1 w-full rounded border bg-background p-2">{ATRIBUTOS_SHIKIGAMI.map(atributo => <option key={atributo} value={atributo}>{rotulosAtributos[atributo]}</option>)}</select></label>
          {acaoExecucao === 'manual' && <label className="text-xs">Dano no sucesso do TR<select value={acaoDanoNoSucesso} onChange={event => setAcaoDanoNoSucesso(event.target.value as 'nenhum' | 'metade')} className="mt-1 w-full rounded border bg-background p-2"><option value="nenhum">Nenhum</option><option value="metade">Metade</option></select></label>}
        </>}
        {acaoTeste !== 'nenhum' && <>
          <label className="text-xs">Atributo do dano<select value={acaoAtributoDano} onChange={event => setAcaoAtributoDano(event.target.value as keyof AtributosShikigami | '')} className="mt-1 w-full rounded border bg-background p-2"><option value="">Igual ao atributo do ataque/CD</option>{ATRIBUTOS_SHIKIGAMI.map(atributo => <option key={atributo} value={atributo}>{rotulosAtributos[atributo]}</option>)}</select></label>
          <label className="text-xs">Multiplicador do atributo no dano<select value={acaoMultiplicadorDanoAtributo} onChange={event => setAcaoMultiplicadorDanoAtributo(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Padrão do grau</option><option value="0">Nenhum</option><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option><option value="4">4×</option><option value="5">5×</option></select></label>
        </>}
        {acaoExecucao === 'manual' && <>
          <label className="text-xs">Tipo de dano<select value={acaoTipoDano} onChange={event => setAcaoTipoDano(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Não definido</option>{(['DCO','DP','DI','DA','DCG','DCC','DQ','DS','DAL','DNR','DE','DPS','DR','DN','DV'] as const).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="text-xs">Alcance (m)<input type="number" step="any" value={acaoAlcance} onChange={event => setAcaoAlcance(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
          <label className="text-xs">Bônus de acerto<input type="number" step="any" value={acaoBonus} onChange={event => setAcaoBonus(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        </>}
        <label className="text-xs">Custo total em PE<input type="number" min="0" step="any" readOnly={acaoExecucao !== 'manual'} value={acaoCusto} onChange={event => setAcaoCusto(event.target.value)} className="mt-1 w-full rounded border bg-background p-2 read-only:opacity-70" /></label>
        <label className="text-xs">PE debitado do dono<input type="number" min="0" step="any" value={acaoCustoDonoPE} onChange={event => setAcaoCustoDonoPE(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Recurso debitado da invocação<select value={acaoCustoRecursoId} onChange={event => setAcaoCustoRecursoId(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Nenhum</option>{recursos.map(recurso => <option key={recurso.id} value={recurso.id}>{recurso.nome} · {recurso.id}</option>)}</select></label>
        <label className="text-xs">Quantidade do recurso próprio<input type="number" min="0" step="any" value={acaoCustoRecurso} onChange={event => setAcaoCustoRecurso(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Execução do comando<select value={acaoModoCusto} onChange={event => setAcaoModoCusto(event.target.value as 'manual' | 'evento_automatico')} className="mt-1 w-full rounded border bg-background p-2"><option value="manual">Manual, sob comando</option><option value="evento_automatico">Somente por evento automático</option></select></label>
        <label className="text-xs">Recarga em turnos ou rodadas<input type="number" min="1" step="1" value={acaoRecargaQuantidade} onChange={event => setAcaoRecargaQuantidade(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Marco da recarga<select value={acaoRecargaUnidade} onChange={event => setAcaoRecargaUnidade(event.target.value as 'inicio_turno_dono' | 'inicio_rodada' | 'manual' | '')} className="mt-1 w-full rounded border bg-background p-2"><option value="">Sem recarga</option><option value="inicio_turno_dono">Turnos do dono</option><option value="inicio_rodada">Rodadas</option><option value="manual">Manual</option></select></label>
        {acaoExecucao === 'manual' && <label className="text-xs">Alvo<input value={acaoAlvo} onChange={event => setAcaoAlvo(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>}
        <button type="button" className="self-end rounded bg-primary px-3 py-2 text-xs text-primary-foreground" onClick={adicionarAcao}>Adicionar ação</button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Se a ação custa PE, distribua o total entre PE do dono e um recurso próprio com ID “pe”. Outros recursos podem ser debitados à parte. Sem distribuição, uma ação com custo PE não será executada.</p>
      <ul className="mt-3 space-y-1">{acoes.map(action => <li key={action.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-xs"><span>{action.nome} · {action.categoriaAcao ?? action.tipo ?? 'sem categoria'}{action.custoPE !== undefined ? ' · ' + action.custoPE + ' PE' : ''}{custosComandos[action.id]?.execucao === 'evento_automatico' ? ' · somente evento automático' : custosComandos[action.id]?.debitos.length ? ' · débitos configurados' : ''}{action.recargaConfigurada ? ` · recarga ${action.recargaConfigurada.quantidade} (${action.recargaConfigurada.unidade})` : ''}</span><button type="button" className="rounded border px-2 py-1" onClick={() => {
        setAcoes(previous => previous.filter(item => item.id !== action.id));
        setCustosComandos(previous => { const next = { ...previous }; delete next[action.id]; return next; });
      }}>Remover</button></li>)}</ul>
    </details>

    <details id="sec-H" className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">H · Passivas e características condicionais</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={possuiEnergiaReversa} onChange={event => setPossuiEnergiaReversa(event.target.checked)} />Capacidade inata de Energia Reversa (permite cura real)</label>
        <label className="text-xs">Nome<input value={caracteristicaNome} onChange={event => setCaracteristicaNome(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Descrição<textarea value={caracteristicaDescricao} onChange={event => setCaracteristicaDescricao(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Efeito operacional<select value={caracteristicaEfeito} onChange={event => setCaracteristicaEfeito(event.target.value as typeof caracteristicaEfeito)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Somente descritiva</option><option value="pv_maximo">Aumento de PV máximo</option><option value="bonus_pericia">Bônus em perícia específica</option><option value="reducao_dano">RD contra tipo específico</option></select></label>
        {caracteristicaEfeito === 'bonus_pericia' && <label className="text-xs">Perícia<select value={caracteristicaPericia} onChange={event => setCaracteristicaPericia(event.target.value)} className="mt-1 w-full rounded border bg-background p-2">{Object.keys(SISTEMA_PERICIAS).map(key => <option key={key} value={key}>{ROTULOS_PERICIAS[key as keyof typeof ROTULOS_PERICIAS] ?? key}</option>)}</select></label>}
        {caracteristicaEfeito === 'reducao_dano' && <label className="text-xs">Tipo de dano<select value={caracteristicaTipoDano} onChange={event => setCaracteristicaTipoDano(event.target.value as import('@/types').DamageType)} className="mt-1 w-full rounded border bg-background p-2">{(['DCO','DP','DI','DA','DCG','DCC','DQ','DS','DAL','DNR','DE','DPS','DR','DN','DV'] as const).map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}</select></label>}
        <label className="text-xs">Condição<input value={caracteristicaCondicao} onChange={event => setCaracteristicaCondicao(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Bônus condicional<input value={caracteristicaBonus} onChange={event => setCaracteristicaBonus(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Redução de dano<input value={caracteristicaRD} onChange={event => setCaracteristicaRD(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Resistência<input value={caracteristicaResistencia} onChange={event => setCaracteristicaResistencia(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Sentidos<input value={caracteristicaSentidos} onChange={event => setCaracteristicaSentidos(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Propriedades<input value={caracteristicaPropriedades} onChange={event => setCaracteristicaPropriedades(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <button type="button" className="self-end rounded bg-primary px-3 py-2 text-xs text-primary-foreground" onClick={adicionarCaracteristica}>Adicionar característica</button>
      </div>
      <ul className="mt-3 space-y-1">{caracteristicas.map(item => <li key={item.id} className="flex items-center justify-between gap-2 rounded border p-2 text-xs"><span>{item.nome}{item.condicao ? ' · se ' + item.condicao : ''}{item.bonus ? ' · bônus ' + item.bonus : ''}{item.reducaoDano ? ' · RD ' + item.reducaoDano : ''}{item.resistencia ? ' · resistência ' + item.resistencia : ''}{item.sentidos ? ' · sentidos ' + item.sentidos : ''}{item.propriedades ? ' · ' + item.propriedades : ''}{item.efeitoOperacional?.tipo === 'pv_maximo' ? ` · PV máximo +${bonusPVCaracteristicas({ grau, caracteristicas: [item] })}` : item.efeitoOperacional?.tipo === 'bonus_pericia' ? ` · +${bonusPericiaCaracteristicas({ grau, caracteristicas: [item] }, item.efeitoOperacional.pericia)} em ${ROTULOS_PERICIAS[item.efeitoOperacional.pericia as keyof typeof ROTULOS_PERICIAS] ?? item.efeitoOperacional.pericia}` : item.efeitoOperacional?.tipo === 'reducao_dano' ? ` · RD ${reducaoDanoCaracteristicas({ grau, caracteristicas: [item] }, item.efeitoOperacional.tipoDano)} contra ${item.efeitoOperacional.tipoDano}` : ''}</span><button type="button" className="rounded border px-2 py-1" onClick={() => setCaracteristicas(previous => previous.filter(feature => feature.id !== item.id))}>Remover</button></li>)}</ul>
    </details>

    <details id="sec-I" className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">I · Reações</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">Nome<input value={reacaoNome} onChange={event => setReacaoNome(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Gatilho<input value={reacaoGatilho} onChange={event => setReacaoGatilho(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Alcance<input value={reacaoAlcance} onChange={event => setReacaoAlcance(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Custo<input value={reacaoCusto} onChange={event => setReacaoCusto(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Condição<input value={reacaoCondicao} onChange={event => setReacaoCondicao(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Alvo<input value={reacaoAlvo} onChange={event => setReacaoAlvo(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={reacaoPrompt} onChange={event => setReacaoPrompt(event.target.checked)} />Pedir confirmação ao jogador</label>
        <button type="button" className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground" onClick={adicionarReacao}>Adicionar reação</button>
      </div>
      <ul className="mt-3 space-y-1">{reacoes.map(item => <li key={item.id} className="flex items-center justify-between gap-2 rounded border p-2 text-xs"><span>{item.nome} · {item.gatilho}{item.alcance ? ' · ' + item.alcance : ''}{item.custo ? ' · ' + item.custo : ''}{item.condicao ? ' · ' + item.condicao : ''}{item.alvo ? ' · alvo ' + item.alvo : ''}</span><button type="button" className="rounded border px-2 py-1" onClick={() => setReacoes(previous => previous.filter(reaction => reaction.id !== item.id))}>Remover</button></li>)}</ul>
    </details>

    <details id="sec-J" className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">J · OMNI, fórmulas e automações</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">Chave OMNI<input value={omniChave} onChange={event => setOmniChave(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Fórmula<input value={omniFormula} onChange={event => setOmniFormula(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Efeito<textarea value={omniEfeito} onChange={event => setOmniEfeito(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Alvos<textarea value={omniAlvos} onChange={event => setOmniAlvos(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Área<textarea value={omniArea} onChange={event => setOmniArea(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Sustentação<textarea value={omniSustentacao} onChange={event => setOmniSustentacao(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Contadores<textarea value={omniContador} onChange={event => setOmniContador(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Diagnósticos<textarea value={omniDiagnosticos} onChange={event => setOmniDiagnosticos(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Entidade OMNI<select value={omniGatilhoEntidade} onChange={event => { setOmniGatilhoEntidade(event.target.value); setOmniGatilhoId(''); setOmniAcaoId(''); }} className="mt-1 w-full rounded border bg-background p-2"><option value="">Selecione</option>{Object.values(entidades).map(entity => <option key={entity.id} value={entity.id}>{entity.nome}</option>)}</select></label>
        <label className="text-xs">Gatilho OMNI<select value={omniGatilhoId} onChange={event => setOmniGatilhoId(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Selecione</option>{(entidadeAutomacao?.gatilhos ?? []).map(trigger => <option key={trigger.id} value={trigger.id}>{trigger.evento}</option>)}</select></label>
        <label className="text-xs">Ação OMNI<select value={omniAcaoId} onChange={event => setOmniAcaoId(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Selecione</option>{(entidadeAutomacao?.acoesAtivas ?? []).map(action => <option key={action.id} value={action.id}>{action.nome}</option>)}</select></label>
        <button type="button" className="self-end rounded border px-3 py-2 text-xs" onClick={adicionarAutomacao}>Adicionar automação OMNI</button>
      </div>
      <ul className="mt-3 space-y-2">{automacoesOmni.map(item => <li key={item.id} className="space-y-2 rounded border p-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1"><input type="checkbox" aria-label={`Ativar automação ${item.gatilhoId} → ${item.acaoId}`} checked={item.habilitada} onChange={event => setAutomacoesOmni(previous => previous.map(automation => automation.id === item.id ? { ...automation, habilitada: event.target.checked } : automation))} />Ativa</label>
          <span className="min-w-0 flex-1">{item.gatilhoId} → {item.acaoId}{item.entidadeOmniId ? ` · ${entidades[item.entidadeOmniId]?.nome ?? item.entidadeOmniId}` : ''}</span>
          <label>Prioridade<input aria-label={`Prioridade da automação ${item.id}`} type="number" step="1" value={item.prioridade ?? 0} onChange={event => {
            const valor = event.target.value === '' ? undefined : Number(event.target.value);
            if (valor !== undefined && !Number.isInteger(valor)) return;
            setAutomacoesOmni(previous => previous.map(automation => automation.id === item.id ? { ...automation, prioridade: valor } : automation));
          }} className="ml-1 w-20 rounded border bg-background px-2 py-1" /></label>
          <button type="button" className="rounded border px-2 py-1" onClick={() => {
            setAutomacoesOmni(previous => previous.filter(automation => automation.id !== item.id));
            setCondicoesAutomacaoJson(previous => { const next = { ...previous }; delete next[item.id]; return next; });
          }}>Remover</button>
        </div>
        <label className="block">Condição segura (JSON, opcional)
          <textarea aria-label={`Condição segura da automação ${item.id}`} rows={2} value={condicoesAutomacaoJson[item.id] ?? ''} onChange={event => setCondicoesAutomacaoJson(previous => ({ ...previous, [item.id]: event.target.value }))} placeholder={'{"op":"compare","path":"evento.cena.rodada","cmp":"gte","value":1}'} className="mt-1 w-full rounded border bg-background p-2 font-mono text-[11px]" />
        </label>
      </li>)}</ul>
      <p className="mt-2 text-xs text-muted-foreground">A automação só roda depois da aprovação do Mestre. Cada regra pode ser ativada ou pausada aqui; a condição aceita apenas comparações seguras sobre evento, dono, alvo e Shikigami.</p>
    </details>

    <details id="sec-K" className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">K · Política de autonomia</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">Modo<select value={autonomiaModo} onChange={event => setAutonomiaModo(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Não definido</option><option value="manual">Manual</option><option value="misto">Misto</option><option value="automatico">Automático</option></select></label>
        <label className="text-xs">Prioridade de alvo<input value={autonomiaPrioridade} onChange={event => setAutonomiaPrioridade(event.target.value)} placeholder="IDs ou nomes, em ordem" className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Política de alvo<select value={autonomiaAlvo} onChange={event => setAutonomiaAlvo(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Não definida</option><option value="manual">Escolha manual</option><option value="prioridade">Prioridade configurada</option><option value="ameaca_mais_proxima">Ameaça mais próxima</option></select></label>
        <label className="text-xs">Política de custos<select value={autonomiaCusto} onChange={event => setAutonomiaCusto(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Não definida</option><option value="manual">Pular ações com custo (manual)</option><option value="permitir_pe">Permitir custos configurados</option><option value="preferir_sem_custo">Preferir ações sem custo</option></select></label>
        <label className="text-xs">Limite por rodada<input type="number" min="0" step="1" value={autonomiaLimite} onChange={event => setAutonomiaLimite(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Regras com prioridade maior rodam primeiro. A seleção automática só ocorre no turno do dono, com alvo visível e dentro do alcance. Custos sem autorização explícita são pulados; esta etapa não abre confirmação manual.</p>
    </details>

    <details id="sec-L" className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">L · Economia de ações própria</summary>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {([
          ['acaoComum', 'Ação comum'], ['acaoSimples', 'Ação simples'], ['acaoComplexa', 'Ação complexa'],
          ['acaoMovimento', 'Ação de movimento'], ['acaoBonus', 'Ação bônus'], ['acaoLivre', 'Ação livre'], ['reacao', 'Reação'],
        ] as const).map(([key, label]) =>
          <div key={key} className="rounded border border-border p-2">
            <label className="text-xs">{label}<input type="number" min="0" step="1" value={economia[key] ?? ''} onChange={event => setEconomia(previous => ({ ...previous, [key]: event.target.value }))} className="mt-1 w-full rounded border bg-background p-2" /></label>
            <label className="mt-2 block text-xs">Reset<select value={resetEconomia[key] ?? ''} disabled={!economia[key]?.trim()} onChange={event => setResetEconomia(previous => {
              const next = { ...previous };
              if (event.target.value) next[key] = event.target.value as LimiteResetEconomiaInvocacao;
              else delete next[key];
              return next;
            })} className="mt-1 w-full rounded border bg-background p-2 disabled:opacity-50">
              <option value="">Sem reset automático</option>
              <option value="inicio_turno_dono">No início do turno do dono</option>
              <option value="inicio_rodada">No início da rodada</option>
              <option value="inicio_combate">No início do combate</option>
              <option value="manual">Manual</option>
            </select></label>
          </div>)}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Saldos são próprios da instância. Cada categoria pode ter um reset independente; campos vazios não recebem limite nem reset por suposição.</p>
      <div className="mt-4 border-t border-border pt-3">
        <h4 className="font-medium">Recursos próprios e recargas</h4>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-xs">ID estável (use “pe” para PE próprio)<input value={recursoId} onChange={event => setRecursoId(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
          <label className="text-xs">Nome do recurso<input value={recursoNome} onChange={event => setRecursoNome(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
          <label className="text-xs">Saldo ao invocar<input type="number" step="any" value={recursoInicial} onChange={event => setRecursoInicial(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
          <label className="text-xs">Saldo máximo (opcional)<input type="number" step="any" value={recursoMaximo} onChange={event => setRecursoMaximo(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
          <label className="text-xs">Quantidade recuperada<input type="number" min="0" step="any" value={recursoRecarga} onChange={event => setRecursoRecarga(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
          <label className="text-xs">Marco da recarga<select value={recursoRecargaUnidade} onChange={event => setRecursoRecargaUnidade(event.target.value as LimiteResetEconomiaInvocacao | '')} className="mt-1 w-full rounded border bg-background p-2"><option value="">Sem recarga automática</option><option value="inicio_turno_dono">Início do turno do dono</option><option value="inicio_rodada">Início da rodada</option><option value="inicio_combate">Início do combate</option><option value="manual">Manual</option></select></label>
          <button type="button" className="self-end rounded bg-primary px-3 py-2 text-xs text-primary-foreground" onClick={adicionarRecurso}>Adicionar recurso</button>
        </div>
        <ul className="mt-3 space-y-1">{recursos.map(recurso => <li key={recurso.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-xs"><span>{recurso.nome} · ID {recurso.id} · inicial {recurso.valorInicial}{recurso.valorMaximo !== undefined ? ` / máximo ${recurso.valorMaximo}` : ''}{recurso.recargaConfigurada ? ` · +${recurso.recargaConfigurada.quantidade} em ${recurso.recargaConfigurada.unidade}` : ''}</span><button type="button" className="rounded border px-2 py-1" onClick={() => {
          if (Object.values(custosComandos).some(custo => custo.debitos.some(debito => debito.recursoId === recurso.id))) { setErro('Este recurso está usado como custo de uma ação. Remova o débito antes de remover o recurso.'); return; }
          setRecursos(previous => previous.filter(item => item.id !== recurso.id));
        }}>Remover</button></li>)}</ul>
      </div>
    </details>

    <details id="sec-M" className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">M · Tempo adicional por invocação</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">Quantidade<input aria-label="Tempo adicional" type="number" min="0" step="any" value={tempoQuantidade} onChange={event => setTempoQuantidade(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Unidade<select aria-label="Unidade do tempo adicional" value={tempoUnidade} onChange={event => setTempoUnidade(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Não configurado</option><option value="segundos">Segundos</option><option value="minutos">Minutos</option><option value="horas">Horas</option><option value="turnos">Turnos (6 s)</option><option value="rodadas">Rodadas (6 s)</option></select></label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Sem configuração, a invocação não recebe tempo extra. Turnos e rodadas equivalem a 6 s; o valor é concedido uma vez por instância.</p>
    </details>

    <details id="sec-N" className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">N · Recuperação, PV negativos e dissipação</summary>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
        <li>Derrota definitiva ao atingir −100% do PV máximo.</li>
        <li>Cura acima de zero não levanta a invocação; exige a própria Ação de Movimento.</li>
        <li>Dissipação voluntária deixa ao menos 10 segundos.</li>
        <li>Derrota permanente preserva o saldo restante da contribuição.</li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Estas decisões são registradas no snapshot da ficha.</p>
    </details>

    <details id="sec-O" className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">O · Aprovação, auditoria e compartilhamento</summary>
      <div className="mt-3 space-y-2">
        <p className="text-xs">Estado atual: {initial?.aprovacaoMestre === 'aprovada' ? 'Aprovada' : initial?.aprovacaoMestre === 'rejeitada' ? 'Rejeitada' : initial ? 'Pendente' : 'Nova ficha aguardará aprovação'} · Versão {initial?.versaoModelo ?? 1}{initial?.versaoAprovada ? ' · Aprovada até a versão ' + initial.versaoAprovada : ''}</p>
        {initial?.motivoRejeicao && <p className="text-xs text-destructive">Motivo da rejeição: {initial.motivoRejeicao}</p>}
        <p className="text-xs">Compartilhamento: a ficha acompanha o personagem e segue as permissões e a sincronização atuais da mesa.</p>
        {alertas.length > 0 && <div className="rounded border border-amber-500/40 bg-amber-500/5 p-2"><p className="text-xs font-semibold">Avisos de regra — não bloqueiam o envio</p><ul className="mt-1 space-y-1 text-xs text-amber-700">{alertas.map((notice,index) => <li key={notice.codigo + index}>{notice.detalhe}</li>)}</ul></div>}
        {[...Object.values(derivados).filter(item => item.modo === 'revisao_necessaria'), ...Object.values(extrasDerivados).filter(item => item.modo === 'revisao_necessaria')].length > 0 && <p className="text-xs text-amber-700">Há campos derivados pendentes de revisão. Os valores foram preservados e não serão recalculados sem uma escolha explícita.</p>}
      </div>
    </details>

    {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
    {mensagem && <p role="status" className="text-xs text-muted-foreground">{mensagem}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={salvando || aguardandoMestre} onClick={() => void salvar()} className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50">{salvando ? 'Enviando…' : isEditing ? 'Salvar e solicitar nova aprovação' : 'Criar ficha e solicitar aprovação'}</button>
      {onCancel && <button type="button" className="rounded border px-3 py-2 text-xs" onClick={onCancel}>Voltar à biblioteca</button>}
    </div>
    {cropOpen && imagemAssetId && <TokenCropDialog entity={cropEntity} onCancel={() => setCropOpen(false)} onConfirm={(crop, circular) => { setTokenCrop(crop); setFormaToken(circular ? 'ELLIPSE' : 'RECT'); setCropOpen(false); }} />}
  </div>;
}
