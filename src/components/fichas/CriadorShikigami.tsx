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
import { ModeloInvocacaoSchema, INVOCACAO_SCHEMA_VERSION, type CampoDerivadoInvocacao } from '@/lib/invocacoes/schema';
import { resolverValoresDerivados, type CampoDerivadoShikigami, type EstadoEdicaoDerivado, type EstadosEdicaoDerivados } from '@/lib/controlador/fichaShikigami';
import { SISTEMA_PERICIAS, ROTULOS_PERICIAS } from '@/lib/omni/constantesDoSistema';
import { assetCache } from '@/components/mapa/assetCache';
import { TokenCropDialog } from '@/components/mapa/ui/TokenCropDialog';
import type { Entity, TokenCrop } from '@/stores/useMapStore';
import { carregarAssetFicha, salvarAssetFicha } from '@/lib/controlador/assetFicha';

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
type CaracteristicaFicha = { id: string; nome: string; descricao: string; condicao?: string; bonus?: string; resistencia?: string; reducaoDano?: string; sentidos?: string; propriedades?: string };
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
  const [acaoNome, setAcaoNome] = useState('');
  const [acaoCategoria, setAcaoCategoria] = useState('');
  const [acaoExecucao, setAcaoExecucao] = useState<'manual' | 'omni' | 'referencia_omni'>('manual');
  const [acaoTipo, setAcaoTipo] = useState<NonNullable<AcaoFicha['tipo']>>('habilidade');
  const [acaoTipoDano, setAcaoTipoDano] = useState('');
  const [acaoDano, setAcaoDano] = useState('');
  const [acaoAlvo, setAcaoAlvo] = useState('');
  const [acaoAlcance, setAcaoAlcance] = useState('');
  const [acaoBonus, setAcaoBonus] = useState('');
  const [acaoCusto, setAcaoCusto] = useState('');
  const [acaoOmniEntidade, setAcaoOmniEntidade] = useState('');
  const [acaoOmniId, setAcaoOmniId] = useState('');
  const [caracteristicas, setCaracteristicas] = useState<CaracteristicaFicha[]>(() => (initial?.caracteristicas ?? []) as CaracteristicaFicha[]);
  const [caracteristicaNome, setCaracteristicaNome] = useState('');
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
  const [autonomiaModo, setAutonomiaModo] = useState(initial?.autonomia?.modo ?? '');
  const [autonomiaAlvo, setAutonomiaAlvo] = useState(initial?.autonomia?.politicaAlvo ?? '');
  const [autonomiaCusto, setAutonomiaCusto] = useState(initial?.autonomia?.politicaCusto ?? '');
  const [autonomiaPrioridade, setAutonomiaPrioridade] = useState(initial?.autonomia?.prioridadeAlvo ?? '');
  const [autonomiaLimite, setAutonomiaLimite] = useState(initial?.autonomia?.limitePorRodada?.toString() ?? '');
  const [economia, setEconomia] = useState<Record<string, string>>(() => {
    const values = initial?.economiaAcoesConfigurada ?? {};
    return { acaoComum: values.acaoComum?.toString() ?? '', acaoSimples: values.acaoSimples?.toString() ?? '', acaoComplexa: values.acaoComplexa?.toString() ?? '', acaoMovimento: values.acaoMovimento?.toString() ?? '', acaoBonus: values.acaoBonus?.toString() ?? '', acaoLivre: values.acaoLivre?.toString() ?? '', reacao: values.reacao?.toString() ?? '' };
  });
  const [tempoQuantidade, setTempoQuantidade] = useState(initial?.tempoAdicional?.quantidade?.toString() ?? '');
  const [tempoUnidade, setTempoUnidade] = useState(initial?.tempoAdicional?.unidade ?? '');
  const [intermediarioTipo, setIntermediarioTipo] = useState<'' | 'talisma' | 'dispositivo' | 'tecnica'>(initial?.intermediario?.tipo ?? '');
  const [intermediarioItem, setIntermediarioItem] = useState(initial?.intermediario?.itemInventarioId ?? '');
  const [intermediarioTecnica, setIntermediarioTecnica] = useState(initial?.intermediario?.tecnicaId ?? '');
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
  const inventarioDoDono = items.filter(item => item.ownerId === character.id);
  const entidadeAutomacao = Object.values(entidades).find(entity => entity.id === omniGatilhoEntidade);
  const assetPrincipal = imagemAssetId ? assetCache.get(imagemAssetId) : null;
  const assetFallback = imagemFallbackAssetId ? assetCache.get(imagemFallbackAssetId) : null;
  const cropEntity: Entity = {
    id: initial?.id ?? 'rascunho-shikigami', shape: formaToken, x: 0, y: 0, w: 1, h: 1,
    rotation: 0, color: corIdentificacao, locked: false, assetId: imagemAssetId || undefined,
    label: apelido || nome, nameplate, tokenCrop,
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
  const adicionarAcao = () => {
    if (!acaoNome.trim() || !acaoCategoria) { setErro('Informe o nome e a categoria da ação.'); return; }
    const custo = acaoCusto.trim() === '' ? undefined : Number(acaoCusto);
    const alcance = acaoAlcance.trim() === '' ? undefined : Number(acaoAlcance);
    const bonus = acaoBonus.trim() === '' ? undefined : Number(acaoBonus);
    if ([custo, alcance, bonus].some(value => value !== undefined && !Number.isFinite(value)) || (custo !== undefined && custo < 0) || (alcance !== undefined && alcance < 0)) { setErro('Custos e alcance precisam ser números finitos e não negativos; bônus precisa ser finito.'); return; }
    const category = acaoCategoria as NonNullable<AcaoFicha['categoriaAcao']>;
    if (acaoExecucao !== 'manual' && (!acaoOmniEntidade || !acaoOmniId)) { setErro('A execução OMNI precisa de entidade e ID da ação.'); return; }
    const action: AcaoFicha = {
      id: crypto.randomUUID(), nome: acaoNome.trim(), tipo: category === 'movimento' ? 'movimento' : acaoTipo,
      tipoExecucao: acaoExecucao, categoriaAcao: category,
      ...(acaoDano.trim() ? { dano: acaoDano.trim() } : {}),
      ...(acaoTipoDano ? { tipoDano: acaoTipoDano as import('@/types').DamageType } : {}),
      ...(alcance !== undefined ? { alcanceM: alcance } : {}),
      ...(bonus !== undefined ? { bonusAtaque: bonus } : {}),
      ...(custo !== undefined ? { custoPE: custo } : {}),
      ...(acaoOmniEntidade ? { entidadeOmniId: acaoOmniEntidade } : {}),
      ...(acaoOmniId ? { acaoOmniId: acaoOmniId } : {}),
      ...(acaoAlvo.trim() ? { alvo: acaoAlvo.trim() } : {}),
      ...(category === 'acao_simples' || category === 'acao_complexa' ? { opcaoInvocacao: category } : {}),
    };
    setAcoes(previous => [...previous, action]);
    setAcaoNome(''); setAcaoDano(''); setAcaoAlcance(''); setAcaoBonus(''); setAcaoCusto(''); setAcaoTipoDano(''); setAcaoAlvo('');
    setErro('');
  };
  const adicionarCaracteristica = () => {
    if (!caracteristicaNome.trim()) { setErro('Informe o nome da característica.'); return; }
    setCaracteristicas(previous => [...previous, {
      id: crypto.randomUUID(), nome: caracteristicaNome.trim(), descricao: caracteristicaDescricao,
      ...(caracteristicaCondicao ? { condicao: caracteristicaCondicao } : {}),
      ...(caracteristicaBonus ? { bonus: caracteristicaBonus } : {}),
      ...(caracteristicaRD ? { reducaoDano: caracteristicaRD } : {}),
      ...(caracteristicaResistencia ? { resistencia: caracteristicaResistencia } : {}),
      ...(caracteristicaSentidos ? { sentidos: caracteristicaSentidos } : {}),
      ...(caracteristicaPropriedades ? { propriedades: caracteristicaPropriedades } : {}),
    }]);
    setCaracteristicaNome(''); setCaracteristicaDescricao(''); setCaracteristicaCondicao(''); setCaracteristicaBonus(''); setCaracteristicaRD(''); setCaracteristicaResistencia(''); setCaracteristicaSentidos(''); setCaracteristicaPropriedades('');
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
    setAutomacoesOmni(previous => [...previous, {
      id: crypto.randomUUID(), habilitada: false, entidadeOmniId: entidadeAutomacao.id,
      gatilhoId: omniGatilhoId, acaoId: omniAcaoId,
      ...(autonomiaCusto ? { politicaCusto: autonomiaCusto } : {}),
      ...(autonomiaAlvo ? { politicaAlvo: autonomiaAlvo } : {}),
      ...(autonomiaLimite.trim() && Number.isInteger(Number(autonomiaLimite)) ? { limitePorRodada: Number(autonomiaLimite) } : {}),
      revisao: 1,
    }]);
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
    const erroAtributos = validarAtributosShikigami(grau, atributos);
    if (erroAtributos) { setErro(erroAtributos); return; }
    if ((intermediarioTipo === 'talisma' || intermediarioTipo === 'dispositivo') && !intermediarioItem) { setErro('Selecione um item real do inventário como intermediário.'); return; }
    if (intermediarioTipo === 'tecnica' && !intermediarioTecnica.trim()) { setErro('Informe a técnica usada como intermediário.'); return; }
    if (intermediarioItem && !inventarioDoDono.some(item => item.instanceId === intermediarioItem)) { setErro('O intermediário selecionado não pertence ao inventário deste personagem.'); return; }
    if (Number.isFinite(valoresFinais.hpMaximo) && valoresFinais.hpMaximo < 1) { setErro('PV máximo precisa ser maior que zero.'); return; }
    setSalvando(true); setErro(''); setMensagem('');
    try {
      if (!resolvidos) throw new Error('Resolva os valores derivados manuais antes de salvar.');
      const maxHP = valoresFinais.hpMaximo;
      const atualHP = pvAtual.trim() === '' && !initial ? maxHP : Number(pvAtual);
      if (!Number.isFinite(atualHP) || atualHP < 0 || atualHP > maxHP) throw new Error('PV atual precisa ficar entre zero e o PV máximo.');
      if (valoresFinais.defesa < 0 || valoresFinais.deslocamentoM < 0 || valoresFinais.custoInvocacaoPE < 0) throw new Error('Defesa, deslocamento e custos derivados não podem ser negativos.');
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
      const time = timeQty === undefined ? undefined : { quantidade: timeQty, unidade: tempoUnidade.trim() };
      const acoesParaSalvar = acoes.map(action => ({ ...action, tipoExecucao: action.tipoExecucao ?? 'legada' as const }));
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
        ...(intermediarioTecnica.trim() ? { tecnicaId: intermediarioTecnica.trim() } : {}),
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
        recursosConfigurados: initial?.recursosConfigurados ?? [],
        acoes: acoesParaSalvar, caracteristicas: caracteristicaCompletas, reacoes, automacoesOmni,
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
        ...(Object.keys(economy).length ? { economiaAcoesConfigurada: economy } : {}),
        ...(nivEvolucao !== undefined || registroEvolucao.length ? { registroEvolucao } : {}),
        ...(time ? { tempoAdicional: time } : {}),
        regrasRecuperacao: recoveryRules,
        aquisicao: { estado: 'pendente', fonte: 'mestre' },
        aprovacaoMestre: 'pendente' as const, versaoModelo: version,
        hpAtual: atualHP, hpMaximo: maxHP, defesa: valoresFinais.defesa,
        deslocamentoM: valoresFinais.deslocamentoM, porte,
        custoInvocacaoPE: valoresFinais.custoInvocacaoPE,
        ...(extrasDerivados.custoSustentacaoPE.modo !== 'automatico' && extrasDerivados.custoSustentacaoPE.valorManual.trim() ? { custoSustentacaoPE: Number(extrasDerivados.custoSustentacaoPE.valorManual) } : {}),
        acoes: acoesParaSalvar,
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
        <label className="text-xs">Intermediário<select value={intermediarioTipo} onChange={event => { setIntermediarioTipo(event.target.value as '' | 'talisma' | 'dispositivo' | 'tecnica'); setIntermediarioItem(''); }} className="mt-1 w-full rounded border bg-background p-2"><option value="">Não configurado</option><option value="talisma">Talismã</option><option value="dispositivo">Dispositivo</option><option value="tecnica">Técnica</option></select></label>
        {(intermediarioTipo === 'talisma' || intermediarioTipo === 'dispositivo') && <label className="text-xs">Item real do inventário<select value={intermediarioItem} onChange={event => setIntermediarioItem(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Selecione um item</option>{inventarioDoDono.map(item => <option key={item.instanceId} value={item.instanceId}>{item.entity.nome} · {item.instanceId.slice(0, 8)}</option>)}</select></label>}
        {intermediarioTipo === 'tecnica' && <label className="text-xs">ID da técnica<input value={intermediarioTecnica} onChange={event => setIntermediarioTecnica(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>}
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
      <p className="mt-2 text-xs text-muted-foreground">Cada campo mantém seu modo separadamente. Campos automáticos mostram prévia; os manuais não mudam quando atributos ou grau mudam. Alcance e resistências não têm fórmula cadastrada.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">{chavesDerivadas.map(renderDerivado)}</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {renderExtra('custoSustentacaoPE', 'Custo de sustentação', 'PE', false)}
        {renderExtra('alcanceM', 'Alcance', 'm', false)}
        {renderExtra('resistencias', 'Resistências', '', false)}
      </div>
      <label className="mt-2 block text-xs">PV atual
        <input type="number" step="any" min="0" max={valoresFinais.hpMaximo} value={pvAtual || (!initial ? valoresFinais.hpMaximo : '')} onChange={event => setPvAtual(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" />
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
        <label className="text-xs">Nome<input value={acaoNome} onChange={event => setAcaoNome(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Categoria<select value={acaoCategoria} onChange={event => setAcaoCategoria(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Selecione</option><option value="acao_comum">Comum</option><option value="acao_simples">Simples</option><option value="acao_complexa">Complexa</option><option value="acao_bonus">Bônus</option><option value="movimento">Movimento</option><option value="livre">Livre</option><option value="reacao">Reação</option></select></label>
        <label className="text-xs">Execução<select value={acaoExecucao} onChange={event => setAcaoExecucao(event.target.value as 'manual' | 'omni' | 'referencia_omni')} className="mt-1 w-full rounded border bg-background p-2"><option value="manual">Manual</option><option value="omni">OMNI</option><option value="referencia_omni">Referência OMNI</option></select></label>
        <label className="text-xs">Tipo de ação<select value={acaoTipo} onChange={event => setAcaoTipo(event.target.value as NonNullable<AcaoFicha['tipo']>)} className="mt-1 w-full rounded border bg-background p-2"><option value="ataque">Ataque</option><option value="habilidade">Habilidade</option><option value="movimento">Movimento</option><option value="bonus">Bônus</option><option value="suporte">Suporte</option></select></label>
        <label className="text-xs">Dano ou efeito<input value={acaoDano} onChange={event => setAcaoDano(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Tipo de dano<select value={acaoTipoDano} onChange={event => setAcaoTipoDano(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Não definido</option>{(['DCO','DP','DI','DA','DCG','DCC','DQ','DS','DAL','DNR','DE','DPS','DR','DN','DV'] as const).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-xs">Alcance (m)<input type="number" step="any" value={acaoAlcance} onChange={event => setAcaoAlcance(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Bônus de acerto<input type="number" step="any" value={acaoBonus} onChange={event => setAcaoBonus(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Custo PE<input type="number" step="any" value={acaoCusto} onChange={event => setAcaoCusto(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Alvo<input value={acaoAlvo} onChange={event => setAcaoAlvo(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Entidade OMNI<select value={acaoOmniEntidade} onChange={event => setAcaoOmniEntidade(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Nenhuma</option>{Object.values(entidades).map(entity => <option key={entity.id} value={entity.id}>{entity.nome}</option>)}</select></label>
        <label className="text-xs">ID de ação OMNI<input value={acaoOmniId} onChange={event => setAcaoOmniId(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <button type="button" className="self-end rounded bg-primary px-3 py-2 text-xs text-primary-foreground" onClick={adicionarAcao}>Adicionar ação</button>
      </div>
      <ul className="mt-3 space-y-1">{acoes.map(action => <li key={action.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-xs"><span>{action.nome} · {action.categoriaAcao ?? action.tipo ?? 'sem categoria'}{action.custoPE !== undefined ? ' · ' + action.custoPE + ' PE' : ''}</span><button type="button" className="rounded border px-2 py-1" onClick={() => setAcoes(previous => previous.filter(item => item.id !== action.id))}>Remover</button></li>)}</ul>
    </details>

    <details id="sec-H" className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">H · Passivas e características condicionais</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">Nome<input value={caracteristicaNome} onChange={event => setCaracteristicaNome(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Descrição<textarea value={caracteristicaDescricao} onChange={event => setCaracteristicaDescricao(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Condição<input value={caracteristicaCondicao} onChange={event => setCaracteristicaCondicao(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Bônus condicional<input value={caracteristicaBonus} onChange={event => setCaracteristicaBonus(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Redução de dano<input value={caracteristicaRD} onChange={event => setCaracteristicaRD(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Resistência<input value={caracteristicaResistencia} onChange={event => setCaracteristicaResistencia(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Sentidos<input value={caracteristicaSentidos} onChange={event => setCaracteristicaSentidos(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Propriedades<input value={caracteristicaPropriedades} onChange={event => setCaracteristicaPropriedades(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <button type="button" className="self-end rounded bg-primary px-3 py-2 text-xs text-primary-foreground" onClick={adicionarCaracteristica}>Adicionar característica</button>
      </div>
      <ul className="mt-3 space-y-1">{caracteristicas.map(item => <li key={item.id} className="flex items-center justify-between gap-2 rounded border p-2 text-xs"><span>{item.nome}{item.condicao ? ' · se ' + item.condicao : ''}{item.bonus ? ' · bônus ' + item.bonus : ''}{item.reducaoDano ? ' · RD ' + item.reducaoDano : ''}{item.resistencia ? ' · resistência ' + item.resistencia : ''}{item.sentidos ? ' · sentidos ' + item.sentidos : ''}{item.propriedades ? ' · ' + item.propriedades : ''}</span><button type="button" className="rounded border px-2 py-1" onClick={() => setCaracteristicas(previous => previous.filter(feature => feature.id !== item.id))}>Remover</button></li>)}</ul>
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
      <ul className="mt-3 space-y-1">{automacoesOmni.map(item => <li key={item.id} className="flex items-center justify-between rounded border p-2 text-xs"><span>{item.gatilhoId} → {item.acaoId} · {item.habilitada ? 'ativa' : 'desativada para revisão'}</span><button type="button" className="rounded border px-2 py-1" onClick={() => setAutomacoesOmni(previous => previous.filter(automation => automation.id !== item.id))}>Remover</button></li>)}</ul>
      <p className="mt-2 text-xs text-muted-foreground">As automações novas ficam desativadas até a revisão da ficha.</p>
    </details>

    <details id="sec-K" className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">K · Política de autonomia</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">Modo<select value={autonomiaModo} onChange={event => setAutonomiaModo(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Não definido</option><option value="manual">Manual</option><option value="misto">Misto</option><option value="automatico">Automático</option></select></label>
        <label className="text-xs">Prioridade de alvo<input value={autonomiaPrioridade} onChange={event => setAutonomiaPrioridade(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Política de alvo<select value={autonomiaAlvo} onChange={event => setAutonomiaAlvo(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Não definida</option><option value="manual">Escolha manual</option><option value="prioridade">Prioridade configurada</option><option value="ameaca_mais_proxima">Ameaça mais próxima</option></select></label>
        <label className="text-xs">Política de custos<select value={autonomiaCusto} onChange={event => setAutonomiaCusto(event.target.value)} className="mt-1 w-full rounded border bg-background p-2"><option value="">Não definida</option><option value="manual">Confirmar cada custo</option><option value="permitir_pe">Permitir gastar PE</option><option value="preferir_sem_custo">Preferir ações sem custo</option></select></label>
        <label className="text-xs">Limite por rodada<input type="number" min="0" step="1" value={autonomiaLimite} onChange={event => setAutonomiaLimite(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Políticas e limites ficam sem valor até serem escolhidos por ficha.</p>
    </details>

    <details id="sec-L" className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">L · Economia de ações própria</summary>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[['acaoComum','Ação comum'],['acaoSimples','Ação simples'],['acaoComplexa','Ação complexa'],['acaoMovimento','Ação de movimento'],['acaoBonus','Ação bônus'],['acaoLivre','Ação livre'],['reacao','Reação']].map(([key,label]) =>
          <label key={key} className="text-xs">{label}<input type="number" min="0" step="1" value={economia[key] ?? ''} onChange={event => setEconomia(previous => ({ ...previous, [key]: event.target.value }))} className="mt-1 w-full rounded border bg-background p-2" /></label>)}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Cada campo é independente e pode ficar sem configuração até haver uma regra definida.</p>
    </details>

    <details id="sec-M" className="rounded border border-border p-2">
      <summary className="cursor-pointer text-sm font-semibold">M · Tempo adicional por invocação</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs">Quantidade<input type="number" min="0" step="any" value={tempoQuantidade} onChange={event => setTempoQuantidade(event.target.value)} className="mt-1 w-full rounded border bg-background p-2" /></label>
        <label className="text-xs">Unidade<input value={tempoUnidade} onChange={event => setTempoUnidade(event.target.value)} placeholder="Defina a unidade" className="mt-1 w-full rounded border bg-background p-2" /></label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">A unidade e a quantidade não recebem valores padrão. A configuração só será consumida quando a invocação for executada.</p>
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
