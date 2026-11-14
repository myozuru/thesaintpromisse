import { InvocationDisclosure } from "@/components/invocacoes/InvocationDisclosure";
import { InvocationSelect } from "@/components/invocacoes/InvocationSelect";
import { OwnedInvocationsCollection } from './OwnedInvocationsCollection';
import { useEffect, useRef, useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useMapStore } from '@/stores/useMapStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { validarIntermediarioInvocacao } from '@/lib/controlador/intermediario';
import { invocarControladores, invocarHordaControlador, recolherInvocacao, limparInvocacoesDerrotadas, levantarInvocacao, resolverDerrotaPendenteInvocacao, comandarReposicionamento, comandarAgarrarGama, comandarAtaque, comandarPuxarAliadoGama, comandarSuporte, comandarSegurarSapo, comandarHabilidadeInvocacao, escaparInvocacaoAgarrada, rolarPericiaInvocacao, type DirecaoInvocacao, type PericiaFugaAgarrado } from '@/lib/controlador/mapa';
import { limiteInvocacoesConhecidas, limiteAtivasPersonagem, mensagemDomesticaoPendente, rotuloTipoInvocacao, validarCatalogoControlador, type InvocacaoControlador, type TipoInvocacaoControlador } from '@/lib/controlador/tipos';
import { podeUsarVersaoAprovada } from '@/lib/controlador/aprovacao';
import { carregarAssetFicha, salvarAssetFicha } from '@/lib/controlador/assetFicha';
import { formatarSegundosTempoInvocacao, tempoAdicionalEmSegundos } from '@/lib/controlador/tempo';
import { assetCache } from '@/components/mapa/assetCache';
import { decidirAprovacaoInvocacao, decidirAprovacaoLegadaInvocacao, submeterAprovacaoInvocacao } from '@/lib/controlador/aprovacao.functions';
import { SISTEMA_PERICIAS, ROTULOS_PERICIAS } from '@/lib/omni/constantesDoSistema';
import { calcularBonusAtaqueInvocacao, invocacaoTreinadaNaPericia, parseFormulaDanoInvocacao } from '@/lib/controlador/rolagens';
import { bonusPericiaCaracteristicas } from '@/lib/controlador/passivas';
import { definirAutomacaoInvocacao } from '@/lib/controlador/autonomia';
import { useProfileStore } from '@/stores/useProfileStore';
import { calcularHorda, validarLimiteHorda, vagasInvocacaoEmCampo } from '@/lib/controlador/hordas';
import { DEZ_SOMBRAS_FORMAS_DERIVADAS as DEZ_SOMBRAS_FORMAS_REFERENCIA, DEZ_SOMBRAS_MODELOS, HABILIDADES_TECNICA_DEZ_SOMBRAS, criarPacoteDezSombras } from '@/lib/controlador/dezSombras';
import { auditarValoresProvisoriosFormaDerivadaDezSombras, DEZ_SOMBRAS_FORMAS_DERIVADAS, criarFormasDerivadasDezSombras } from '@/lib/controlador/dezSombrasDerivadas';

type Fonte = { id: string; nome: string; tipo: 'grimorio' | 'omni'; hp: number; defesa: number; deslocamento: number; porte: InvocacaoControlador['porte']; acoes: InvocacaoControlador['acoes'] };
type InvocationSectionView = 'owned' | 'catalog';
const numero = (valor: unknown, padrao: number): number => {
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
};
function criaturasGrimorio(): Fonte[] {
  try {
    const raw = JSON.parse(localStorage.getItem('fm_creatures_v1') || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((c) => c && c.id && c.name).map((c) => ({
      id: String(c.id), nome: String(c.name), tipo: 'grimorio' as const,
      hp: Math.max(1, numero(c.hpMax ?? c.hp ?? c.pvMax ?? c.pv, 10)),
      defesa: Math.max(0, numero(c.defense ?? c.defesa ?? c.ca, 10)),
      deslocamento: Math.max(0, numero(c.speed ?? c.deslocamento ?? c.movement, 9)),
      porte: (['Pequeno', 'Médio', 'Grande'].includes(c.size) ? c.size : 'Médio') as InvocacaoControlador['porte'],
      acoes: Array.isArray(c.actions) ? c.actions.map((a: unknown, i: number) => {
        if (typeof a === 'object' && a !== null) {
          return {
            id: String((a as any).id || i),
            nome: String((a as any).name || 'Ação'),
            tipo: 'ataque' as const,
            dano: (a as any).damage ? String((a as any).damage) : undefined,
          };
        }
        // Fallback for non-object actions
        return {
          id: String(i),
          nome: 'Ação',
          tipo: 'ataque' as const,
          dano: undefined,
        };
      }) : [],
    }));
  } catch { return []; }
}
export function ControladorInvocacoesSection({ character, view = 'catalog', canViewCatalog = true, onBrowseCatalog, onEditFicha, onCreateFicha }: { character: Character; view?: InvocationSectionView; canViewCatalog?: boolean; onBrowseCatalog?: () => void; onEditFicha?: (id: string) => void; onCreateFicha?: () => void }) {
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const allCharacters = useCharacterStore(s => s.characters);
  const isMaster = useRoleStore(s => s.role) === 'MASTER';
  const inCombat = useCombatStore(s => s.inCombat);
  const combatId = useCombatStore(s => s.combatId);
  const round = useCombatStore(s => s.round);
  const currentTurnIndex = useCombatStore(s => s.currentTurnIndex);
  const currentActorId = useCombatStore(s => s.initiativeOrder[s.currentTurnIndex]?.charId);
  const activeProfileId = useProfileStore(s => s.activeProfileId);
  const entidades = useOmniEntidadesStore(s => s.entidades);
  const itensInventario = useInventoryStore(s => s.items);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoInvocacaoControlador>('shikigami');
  const [hp, setHp] = useState(10);
  const [defesa, setDefesa] = useState(10);
  const [deslocamento, setDeslocamento] = useState(9);
  const [custoPE, setCustoPE] = useState(3);
  const [alcanceInvocacaoM, setAlcanceInvocacaoM] = useState('');
  const [fonte, setFonte] = useState('');
  const [erro, setErro] = useState('');
  const [busyAprovacao, setBusyAprovacao] = useState(false);
  const [carregandoArteId, setCarregandoArteId] = useState<string | null>(null);
  const [assetsTick, setAssetsTick] = useState(0);
  const [imagensPerfisPreProntos, setImagensPerfisPreProntos] = useState<Record<string, { arquivo: File; url: string }>>({});
  const [salvandoImagemPerfilId, setSalvandoImagemPerfilId] = useState<string | null>(null);
  const urlsImagensPerfisPreProntos = useRef<Record<string, string>>({});
  const [motivosRejeicao, setMotivosRejeicao] = useState<Record<string, string>>({});
  const [motivosOverride, setMotivosOverride] = useState<Record<string, string>>({});
  const [direcao, setDirecao] = useState<DirecaoInvocacao>('leste');
  const [invocacoesSelecionadas, setInvocacoesSelecionadas] = useState<string[]>([]);
  const [hordaLiderId, setHordaLiderId] = useState('');
  const [hordaMembrosIds, setHordaMembrosIds] = useState<string[]>([]);
  const [hordaTempoQuantidade, setHordaTempoQuantidade] = useState('');
  const [hordaTempoUnidade, setHordaTempoUnidade] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [alvosAtaque, setAlvosAtaque] = useState<Record<string, string>>({});
  const [alvosPuxarGama, setAlvosPuxarGama] = useState<Record<string, string>>({});
  const [alvosAtaqueMultiplo, setAlvosAtaqueMultiplo] = useState<Record<string, string[]>>({});
  const [busyAtaque, setBusyAtaque] = useState(false);
  const [busyHabilidadeId, setBusyHabilidadeId] = useState<string | null>(null);
  const [busySegurar, setBusySegurar] = useState(false);
  const [busyAgarrarGama, setBusyAgarrarGama] = useState(false);
  const [gamaSubmerso, setGamaSubmerso] = useState(false);
  const [gamaEscuridaoTotal, setGamaEscuridaoTotal] = useState(false);
  const [membrosSapoVivos, setMembrosSapoVivos] = useState<Record<string, string>>({});
  const [busyFugaInvocacao, setBusyFugaInvocacao] = useState(false);
  const [alvosSuporte, setAlvosSuporte] = useState<Record<string, string[]>>({});
  const [busySuporte, setBusySuporte] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [nomeAtaque, setNomeAtaque] = useState('');
  const [formulaAtaque, setFormulaAtaque] = useState('1d6');
  const [alcanceAtaque, setAlcanceAtaque] = useState(1.5);
  const [bonusAtaque, setBonusAtaque] = useState(0);
  const [tipoDanoAtaque, setTipoDanoAtaque] = useState<import('@/types').DamageType>('DCO');
  const [tipoAtaqueAtaque, setTipoAtaqueAtaque] = useState<'corpo_a_corpo' | 'distancia'>('corpo_a_corpo');
  const [atributoAtaqueAtaque, setAtributoAtaqueAtaque] = useState<'forca' | 'destreza'>('forca');
  const [margemCriticoAtaque, setMargemCriticoAtaque] = useState(20);
  const [multiplicadorCriticoAtaque, setMultiplicadorCriticoAtaque] = useState(2);
  const [atributoDanoAtaque, setAtributoDanoAtaque] = useState<'' | 'forca' | 'destreza' | 'constituicao' | 'inteligencia' | 'sabedoria' | 'presenca'>('');
  const [multiplicadorDanoAtributoAtaque, setMultiplicadorDanoAtributoAtaque] = useState('');
  const [periciasSelecionadas, setPericiasSelecionadas] = useState<Record<string, string>>({});
  const [busyPericia, setBusyPericia] = useState<Record<string, boolean>>({});
  const [confirmandoPerdaDerrota, setConfirmandoPerdaDerrota] = useState<string | null>(null);

  useEffect(() => () => {
    Object.values(urlsImagensPerfisPreProntos.current).forEach(url => URL.revokeObjectURL(url));
    urlsImagensPerfisPreProntos.current = {};
  }, []);

  const entities = useMapStore(s => s.entities);
  const ativos = Object.values(entities).filter(e => e.ownerCharId === character.id && !!e.invocationId);
  useEffect(() => { if (ativos.some(e => (e.hp ?? 0) <= 0)) limparInvocacoesDerrotadas(character.id); }, [entities, character.id]);
  const invocarSelecionadas = async () => {
    if (carregandoArteId) return;
    const ids = [...invocacoesSelecionadas];
    if (ids.length < 1 || ids.length > 2) { setErro('Selecione uma ou duas invocações.'); return; }
    const modelos = ids.map(id => character.invocacoesConhecidas?.find(item => item.id === id));
    if (modelos.some(modelo => !modelo)) { setErro('Uma das invocações selecionadas não está no catálogo.'); return; }
    const modelosValidos = modelos as InvocacaoControlador[];
    if (!Object.values(useMapStore.getState().entities).some(entity => entity.characterId === character.id && !entity.invocationId)) {
      setErro('Coloque o token do Controlador no mapa primeiro.'); return;
    }
    if (modelosValidos.some(modelo => !Number.isFinite(modelo.alcanceInvocacaoM) || (modelo.alcanceInvocacaoM ?? -1) < 0)) {
      setErro('Defina o alcance de posicionamento em cada ficha selecionada.'); return;
    }
    const eventoId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'evento-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    try {
      setErro(''); setMensagem(''); setCarregandoArteId('lote');
      const assetIds = modelosValidos.flatMap(modelo => [modelo.imagemAssetId, modelo.imagemFallbackAssetId].filter((assetId): assetId is string => Boolean(assetId)));
      if (assetIds.length) await Promise.all(assetIds.map(assetId => carregarAssetFicha(assetId)));
      const posicoes = await useMapStore.getState().requestInvocationPlacement({
        ownerCharacterId: character.id,
        items: modelosValidos.map(modelo => ({
          invocationId: modelo.id,
          label: modelo.apelido?.trim() || modelo.nome,
          alcanceM: modelo.alcanceInvocacaoM!,
          color: modelo.corIdentificacao ?? '#8055bd',
        })),
      });
      if (!posicoes) { setMensagem('Posicionamento cancelado.'); return; }
      const motivos = Object.fromEntries(ids.map(id => [id, motivosOverride[id] ?? '']));
      const resultado = invocarControladores(character.id, posicoes.map(posicao => ({ invocacaoId: posicao.invocationId, x: posicao.x, y: posicao.y })), { eventoId, motivosOverrideIntermediario: motivos });
      if (!resultado.ok) { setErro(resultado.motivo); return; }
      setInvocacoesSelecionadas([]);
      setErro('');
      setMensagem('Invocação materializada no mapa como Ação Livre. PE cobrado uma vez pelo lote.');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível preparar o posicionamento das invocações.');
    } finally {
      setCarregandoArteId(null);
    }
  };
  const comandar = (id: string) => {
    const r = comandarReposicionamento(character.id, id, direcao);
    if (!r.ok) { setErro(r.motivo); return; }
    setErro(''); setMensagem('Reposicionamento executado com uma Ação Livre própria.');
  };
  const atacar = async (invocacaoId: string, acaoId: string) => {
    const invocacao = catalogo.find(item => item.id === invocacaoId);
    const acao = invocacao?.acoes.find(item => item.id === acaoId);
    const configOmni = acao?.entidadeOmniId && acao.acaoOmniId
      ? entidades[acao.entidadeOmniId]?.acoesAtivas?.find(item => item.id === acao.acaoOmniId)
      : undefined;
    const alvoMultiplo = configOmni?.tipo_alvo === 'multiplo';
    const alvoArea = configOmni?.tipo_alvo === 'area';
    const alvosSelecionados = alvoMultiplo
      ? alvosAtaqueMultiplo[`${invocacaoId}:${acaoId}`] ?? []
      : alvosAtaque[invocacaoId] ? [alvosAtaque[invocacaoId]] : [];
    if ((!alvosSelecionados.length && !alvoArea) || busyAtaque) return;
    setBusyAtaque(true); setErro(''); setMensagem('');
    try {
      if (acao?.efeitoEspecial?.tipo === 'puxar_aliado_gama') {
        const alvo = alvosPuxarGama[invocacaoId];
        if (!alvo) { setErro('Selecione um aliado para Língua Sombria.'); return; }
        const resultado = comandarPuxarAliadoGama(character.id, invocacaoId, alvo);
        if (!resultado.ok) { setErro(resultado.motivo); return; }
        setMensagem(`${resultado.nomeAlvo} foi puxado para um espaço adjacente ao Gama, sem provocar ataques de oportunidade.`);
        return;
      }
      const selecao = alvoArea
        ? { tipo: 'area' as const }
        : alvoMultiplo ? alvosSelecionados : alvosSelecionados[0];
      const r = await comandarAtaque(character.id, invocacaoId, acaoId, selecao);
      if (!r.ok) { setErro(r.motivo); return; }
      if ('resultados' in r) {
        const pendentes = r.resultados.filter(resultado => resultado.testePendente).length;
        const acertos = r.resultados.filter(resultado => resultado.acertou).length;
        const dano = r.resultados.reduce((total, resultado) => total + resultado.dano, 0);
        setMensagem(pendentes
          ? `${pendentes} teste(s) de resistência enviado(s) aos alvos.`
          : `${acertos}/${r.resultados.length} acerto(s); dano total aplicado: ${dano}.`);
      } else {
        setMensagem(r.testePendente
          ? `Teste de ${r.cd ? `CD ${r.cd}` : 'resistência'} enviado ao alvo. O efeito será aplicado após a rolagem.`
          : r.acertou
            ? `${r.critico ? 'Acerto crítico! ' : 'Acertou! '}Dano aplicado: ${r.dano}. Resultado: ${r.totalAtaque}.${r.efeitoOpcional?.tipo === 'agarrar_gama' ? ` Pode gastar ${r.efeitoOpcional.custoPE} PE para tentar Agarrar como Ação Livre.` : ''}`
            : `Ataque errou (resultado ${r.totalAtaque}).`);
      }
    } finally { setBusyAtaque(false); }
  };
  const agarrarGama = async (invocacaoId: string, instanciaId: string, eventoId: string) => {
    if (busyAgarrarGama) return;
    setBusyAgarrarGama(true); setErro(''); setMensagem('');
    try {
      const resultado = await comandarAgarrarGama(character.id, invocacaoId, {
        instanciaId,
        requestId: `ficha-gama-grapple-${eventoId}`,
        contextoAmbiente: { submerso: gamaSubmerso, escuridaoTotal: gamaEscuridaoTotal },
      });
      if (!resultado.ok) { setErro(resultado.motivo); return; }
      const bonusSituacional = resultado.bonusSituacional > 0 ? ' (+2 Anfíbio Sombrio)' : '';
      setMensagem(resultado.sucesso
        ? resultado.aplicouCondicao ? resultado.nomeAlvo + ' ficou Agarrado' + bonusSituacional + '.' : 'A disputa foi vencida, mas a condição não foi aplicada' + bonusSituacional + '.'
        : resultado.nomeAlvo + ' resistiu ao Agarrar' + bonusSituacional + '.');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível concluir a tentativa de Agarrar.');
    } finally { setBusyAgarrarGama(false); }
  };
  const segurar = async (invocacaoId: string) => {
    const alvoId = alvosAtaque[invocacaoId];
    if (!alvoId || busySegurar) return;
    setBusySegurar(true); setErro(''); setMensagem('');
    try {
      const invocacao = catalogo.find(item => item.id === invocacaoId);
      const quantidade = membrosSapoVivos[invocacaoId] ?? '';
      const opcoes = invocacao?.subcategoria === 'dez-sombras:abismo-desconhecido-do-poco' && quantidade.trim()
        ? { membrosSapoVivos: Number(quantidade) }
        : undefined;
      const resultado = await comandarSegurarSapo(character.id, invocacaoId, alvoId, opcoes);
      if (!resultado.ok) { setErro(resultado.motivo); return; }
      if (invocacao?.subcategoria === 'dez-sombras:abismo-desconhecido-do-poco') {
        setMembrosSapoVivos(atual => {
          const proximo = { ...atual };
          delete proximo[invocacaoId];
          return proximo;
        });
      }
      setMensagem(resultado.sucesso
        ? resultado.aplicouCondicao ? resultado.nomeAlvo + ' ficou Agarrado.' : 'O alvo venceu a disputa, mas a condição foi bloqueada.'
        : 'Segurar falhou: o alvo resistiu.');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível executar Segurar.');
    } finally { setBusySegurar(false); }
  };
  const usarHabilidadeInvocacao = (invocacaoId: string, acaoId: string) => {
    const key = `${invocacaoId}:${acaoId}`;
    if (busyHabilidadeId) return;
    setBusyHabilidadeId(key); setErro(''); setMensagem('');
    try {
      const resultado = comandarHabilidadeInvocacao(character.id, invocacaoId, acaoId);
      if (!resultado.ok) { setErro(resultado.motivo); return; }
      setMensagem(`Vantagem concedida no próximo teste de ${resultado.pericia} para rastreamento.`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível executar esta habilidade.');
    } finally { setBusyHabilidadeId(null); }
  };
  const escaparInvocacao = async (instanciaId: string, pericia: PericiaFugaAgarrado) => {
    if (busyFugaInvocacao) return;
    setBusyFugaInvocacao(true); setErro(''); setMensagem('');
    try {
      const resultado = await escaparInvocacaoAgarrada(character.id, instanciaId, pericia);
      if (!resultado.ok) { setErro(resultado.motivo); return; }
      setMensagem(resultado.escapou ? 'A invocação escapou do agarrão.' : 'A invocação continua Agarrada.');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível tentar escapar.');
    } finally { setBusyFugaInvocacao(false); }
  };
  const listarAlvosNoAlcance = (invocacaoId: string, alcanceM: number): string[] => {
    const mapa = useMapStore.getState();
    const fonte = Object.values(mapa.entities).find(entity => entity.ownerCharId === character.id && entity.invocationId === invocacaoId && (entity.hp ?? 0) > 0 && entity.invocationState === 'ativa');
    if (!fonte || !Number.isFinite(alcanceM) || alcanceM < 0) return [];
    const pixelsPorMetro = (mapa.gridConfig.dpi || 70) / (mapa.gridConfig.metersPerCell || 1.5);
    if (!Number.isFinite(pixelsPorMetro) || pixelsPorMetro <= 0) return [];
    const alcancePx = alcanceM * pixelsPorMetro;
    const ids = new Set<string>();
    for (const entity of Object.values(mapa.entities)) {
      if (entity.hidden || mapa.layerVisible[entity.layer ?? 'tokens'] === false) continue;
      if (entity.invocationId && (!entity.ownerCharId || entity.invocationState === 'derrotada' || entity.invocationState === 'dissipada')) continue;
      const id = entity.invocationId ? 'invoc:' + entity.id : entity.characterId;
      if (!id) continue;
      const donoAlvoId = entity.invocationId ? entity.ownerCharId : entity.characterId;
      const personagemAlvo = allCharacters.find(alvo => alvo.id === donoAlvoId);
      if (personagemAlvo?.category === 'INIMIGO' && personagemAlvo.id !== character.id) continue;
      const distancia = Math.hypot((fonte.x + fonte.w / 2) - (entity.x + entity.w / 2), (fonte.y + fonte.h / 2) - (entity.y + entity.h / 2));
      if (distancia <= alcancePx + 1e-6) ids.add(id);
    }
    return [...ids];
  };
  const executarSuporte = async (invocacaoId: string, acaoId: string) => {
    const chave = invocacaoId + ':' + acaoId;
    const acao = catalogo.find(item => item.id === invocacaoId)?.acoes.find(item => item.id === acaoId);
    const tokenFonte = Object.values(useMapStore.getState().entities).find(entity => entity.ownerCharId === character.id && entity.invocationId === invocacaoId && (entity.hp ?? 0) > 0);
    const selecionados = acao?.somenteProprio && tokenFonte
      ? ['invoc:' + tokenFonte.id]
      : acao?.todosNoAlcance ? listarAlvosNoAlcance(invocacaoId, acao.alcanceM ?? 0)
        : alvosSuporte[chave] ?? [];
    if (!selecionados.length || busySuporte) { if (!selecionados.length) setErro('Nenhum alvo válido está ao alcance desta ação.'); return; }
    setBusySuporte(true); setErro(''); setMensagem('');
    try {
      const r = await comandarSuporte(character.id, invocacaoId, acaoId, selecionados);
      if (!r.ok) { setErro(r.motivo); return; }
      const resumoValor = r.efeito.startsWith('dano adicional') ? (r.formula ?? '') : String(r.valor);
      setMensagem(`${r.efeito}: ${resumoValor}${r.curaReal === false ? ' PVT' : ''} em ${r.alvos} alvo(s).`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível executar a ação de suporte.');
    } finally { setBusySuporte(false); }
  };
  const rolarPericia = async (invocacaoId: string) => {
    const pericia = periciasSelecionadas[invocacaoId];
    if (!pericia || busyPericia[invocacaoId]) return;
    setBusyPericia(current => ({ ...current, [invocacaoId]: true }));
    setErro(''); setMensagem('');
    try {
      const resultado = await rolarPericiaInvocacao(character.id, invocacaoId, pericia);
      if (!resultado.ok) { setErro(resultado.motivo); return; }
      const nome = ROTULOS_PERICIAS[pericia as keyof typeof ROTULOS_PERICIAS] ?? pericia;
      setMensagem(`${nome}: ${resultado.d20} + ${resultado.bonus} = ${resultado.total}${resultado.treinada ? ' (treinada)' : ''}.`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível rolar a perícia da invocação.');
    } finally {
      setBusyPericia(current => ({ ...current, [invocacaoId]: false }));
    }
  };
  const recolher = (id: string) => {
    if (recolherInvocacao(character.id, id)) { setErro(''); setMensagem('Invocação recolhida.'); }
  };
  const levantar = (id: string) => {
    const resultado = levantarInvocacao(character.id, id);
    if (!resultado.ok) { setErro(resultado.motivo); return; }
    setErro(''); setMensagem('Invocação levantada; Ação de Movimento própria consumida.');
  };
  const resolverDerrota = (id: string, resultado: 'recuperada' | 'perda_permanente') => {
    const decisao = { resultado } as const;
    const resolucao = resolverDerrotaPendenteInvocacao(character.id, id, decisao, {
      isMaster,
      profileId: activeProfileId || undefined,
    });
    if (!resolucao.ok) { setErro(resolucao.motivo); return; }
    setErro('');
    setMensagem(resultado === 'recuperada'
      ? 'Recuperação autorizada pelo Mestre. A invocação volta com 100% dos PV após um descanso longo.'
      : 'Perda permanente registrada; a ficha foi arquivada e o histórico foi preservado.');
    setConfirmandoPerdaDerrota(null);
  };
  const [ownedQuery, setOwnedQuery] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const libraryQuery = view === 'owned' ? ownedQuery : catalogQuery;
  const setLibraryQuery = view === 'owned' ? setOwnedQuery : setCatalogQuery;
  const catalogo = character.invocacoesConhecidas ?? [];
  const invocacoesPossuidas = catalogo.filter(inv => !mensagemDomesticaoPendente(inv) && !inv.perdaPermanente);
  const invocacoesDaVisao = view === 'owned' ? invocacoesPossuidas : catalogo;
  const invocacoesFiltradas = invocacoesDaVisao.filter(inv =>
    (inv.nome + ' ' + (inv.apelido ?? '')).toLocaleLowerCase().includes(libraryQuery.trim().toLocaleLowerCase()),
  );
  const temTecnicaDezSombras = (character.tecnicaAmaldicoada ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes('dez sombras');
  const chaveImagemParaFichaDezSombras = (ficha: InvocacaoControlador) => {
    const idPerfil = ficha.subcategoria?.replace(/^dez-sombras:/, '');
    if (!idPerfil || ficha.pacoteRegras !== 'dez-sombras') return null;
    if (ficha.formaDerivada) return `derivada:${idPerfil}`;
    return `${ficha.opcionalHomebrew ? 'homebrew' : 'base'}:${idPerfil}`;
  };
  const importarDezSombras = async () => {
    if (!temTecnicaDezSombras) {
      setErro('Cadastre a técnica amaldiçoada Dez Sombras no personagem antes de importar este pacote.');
      return;
    }
    if (salvandoImagemPerfilId) return;
    const existentes = new Set(catalogo.filter(item => item.pacoteRegras === 'dez-sombras').map(item => item.subcategoria));
    const fichasBase = criarPacoteDezSombras(character.id);
    const fichasDerivadas = criarFormasDerivadasDezSombras(character.id);
    const novos = [...fichasBase, ...fichasDerivadas].filter(item => !existentes.has(item.subcategoria));
    if (!novos.length) {
      setMensagem('As fichas selecionadas das Dez Sombras já estão na biblioteca.');
      return;
    }
    const semImagem = novos.filter(item => {
      const chaveImagem = chaveImagemParaFichaDezSombras(item);
      return !chaveImagem || !imagensPerfisPreProntos[chaveImagem];
    });
    if (semImagem.length) {
      setErro(`Escolha uma imagem em cada cartão pendente antes da importação em lote: ${semImagem.map(item => item.nome).join(', ')}.`);
      setMensagem('');
      return;
    }
    setSalvandoImagemPerfilId('lote');
    setErro('');
    setMensagem('');
    try {
      const novosComImagem = await Promise.all(novos.map(async ficha => {
        const chaveImagem = chaveImagemParaFichaDezSombras(ficha)!;
        const imagem = imagensPerfisPreProntos[chaveImagem];
        const imagemAssetId = await salvarAssetFicha(imagem.arquivo);
        return { ...ficha, imagemAssetId, imagemAltText: ficha.nome };
      }));
      updateCharacter(character.id, {
        invocacoesConhecidas: [...catalogo, ...novosComImagem],
        limiteInvocacoesConhecidas: max ?? undefined,
        limiteInvocacoesAtivas: ativas,
      });
      setAssetsTick(tick => tick + 1);
      novos.forEach(ficha => {
        const chaveImagem = chaveImagemParaFichaDezSombras(ficha);
        if (chaveImagem) limparImagemPerfilPrePronto(chaveImagem);
      });
      const quantidadeBase = novos.length - novos.filter(item => item.formaDerivada).length;
      const quantidadeDerivada = novos.filter(item => item.formaDerivada).length;
      setMensagem(`${quantidadeBase} ficha(s)-base e ${quantidadeDerivada} forma(s) derivada(s) adicionados com imagem. A lista oficial tem dez entradas; os dois Cães aparecem em fichas separadas. Fichas derivadas aguardam aprovação do Mestre.`);
    } catch (error) {
      setErro(error instanceof Error ? `Não foi possível guardar as imagens: ${error.message}` : 'Não foi possível guardar as imagens das fichas.');
    } finally {
      setSalvandoImagemPerfilId(null);
    }
  };
  const adicionarFichaDezSombras = (ficha: InvocacaoControlador | undefined) => {
    if (!temTecnicaDezSombras) {
      setErro('Cadastre a técnica amaldiçoada Dez Sombras no personagem antes de adicionar fichas.');
      return;
    }
    if (!ficha) {
      setErro('Não foi possível localizar este perfil no catálogo das Dez Sombras.');
      return;
    }
    const catalogoAtual = useCharacterStore.getState().characters.find(item => item.id === character.id)?.invocacoesConhecidas ?? catalogo;
    if (catalogoAtual.some(item => item.pacoteRegras === 'dez-sombras' && item.subcategoria === ficha.subcategoria)) {
      setMensagem(ficha.nome + ' já está na biblioteca.');
      return;
    }
    updateCharacter(character.id, {
      invocacoesConhecidas: [...catalogoAtual, ficha],
      limiteInvocacoesConhecidas: max ?? undefined,
      limiteInvocacoesAtivas: ativas,
    });
    setErro('');
    setMensagem(ficha.nome + ' foi adicionada à biblioteca.');
  };
  const selecionarImagemPerfilPrePronto = (chave: string, arquivo: File) => {
    if (!arquivo.type.startsWith('image/')) {
      setErro('Escolha um arquivo de imagem para este perfil.');
      return;
    }
    if (arquivo.size > 12 * 1024 * 1024) {
      setErro('A imagem precisa ter no máximo 12 MB.');
      return;
    }
    const urlAnterior = urlsImagensPerfisPreProntos.current[chave];
    if (urlAnterior) URL.revokeObjectURL(urlAnterior);
    const url = URL.createObjectURL(arquivo);
    urlsImagensPerfisPreProntos.current[chave] = url;
    setImagensPerfisPreProntos(atual => ({ ...atual, [chave]: { arquivo, url } }));
    setErro('');
    setMensagem('');
  };
  const limparImagemPerfilPrePronto = (chave: string) => {
    const url = urlsImagensPerfisPreProntos.current[chave];
    if (url) URL.revokeObjectURL(url);
    delete urlsImagensPerfisPreProntos.current[chave];
    setImagensPerfisPreProntos(atual => {
      const proximo = { ...atual };
      delete proximo[chave];
      return proximo;
    });
  };
  const renderSeletorImagemPerfilPrePronto = (chave: string, nomePerfil: string) => {
    const imagem = imagensPerfisPreProntos[chave];
    return (
      <div className="inv-profile-art-picker" data-selected={Boolean(imagem)}>
        <div className="inv-profile-art-frame">
          {imagem
            ? <img src={imagem.url} alt={`Prévia da imagem de ${nomePerfil}`} />
            : <span aria-hidden="true">◇</span>}
        </div>
        <label className="inv-profile-image-select">
          <input
            type="file"
            accept="image/*"
            aria-label={`Selecionar imagem para ${nomePerfil}`}
            aria-required="true"
            disabled={Boolean(salvandoImagemPerfilId)}
            onChange={event => {
              const arquivo = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (arquivo) selecionarImagemPerfilPrePronto(chave, arquivo);
            }}
          />
          <span aria-hidden="true">{imagem ? '↻' : '+'}</span>
          {imagem ? 'Trocar imagem' : 'Escolher imagem'}
        </label>
        <span className="inv-profile-image-hint">{imagem ? 'Imagem pronta' : 'Imagem obrigatória'}</span>
      </div>
    );
  };
  const adicionarFichaPreProntaComImagem = async (
    chaveImagem: string,
    criarFicha: () => InvocacaoControlador | undefined,
    nomeFicha: string,
  ) => {
    const imagem = imagensPerfisPreProntos[chaveImagem];
    if (!imagem) {
      setErro(`Selecione uma imagem para ${nomeFicha} antes de adicionar.`);
      return;
    }
    const ficha = criarFicha();
    if (!ficha) {
      setErro(`Não foi possível localizar o perfil de ${nomeFicha}.`);
      return;
    }
    setSalvandoImagemPerfilId(chaveImagem);
    setErro('');
    setMensagem('');
    try {
      const imagemAssetId = await salvarAssetFicha(imagem.arquivo);
      adicionarFichaDezSombras({ ...ficha, imagemAssetId, imagemAltText: nomeFicha });
      setAssetsTick(tick => tick + 1);
      limparImagemPerfilPrePronto(chaveImagem);
    } catch (error) {
      setErro(error instanceof Error ? `Não foi possível guardar a imagem: ${error.message}` : 'Não foi possível guardar a imagem deste perfil.');
    } finally {
      setSalvandoImagemPerfilId(null);
    }
  };
  const registrarDomesticaoConcluida = (invocacaoId: string) => {
    if (!isMaster) return;
    const invocacao = catalogo.find(item => item.id === invocacaoId);
    if (!invocacao || invocacao.pacoteRegras === 'dez-sombras' || !mensagemDomesticaoPendente(invocacao)) return;
    updateCharacter(character.id, {
      invocacoesConhecidas: catalogo.map(item => item.id === invocacaoId ? { ...item, domado: true } : item),
    });
    setMensagem(invocacao.tipo === 'maldicao_domada'
      ? `Domesticação de ${invocacao.nome} confirmada pelo Mestre. A aprovação da ficha e os custos de invocação continuam valendo.`
      : `Ritual de ${invocacao.nome} registrado pelo Mestre. A ficha pode ser invocada se também estiver aprovada.`);
  };
  const assetForFicha = (inv: InvocacaoControlador) => {
    const principal = inv.imagemAssetId ? assetCache.get(inv.imagemAssetId) : null;
    const fallback = inv.imagemFallbackAssetId ? assetCache.get(inv.imagemFallbackAssetId) : null;
    return principal?.ready ? principal : fallback ?? principal;
  };
  const renderImagemPerfilExistente = (ficha: InvocacaoControlador, nomePerfil: string) => {
    const arte = assetForFicha(ficha);
    return (
      <div className="inv-profile-art-picker" data-selected={Boolean(arte)}>
        <div className="inv-profile-art-frame">
          {arte
            ? <img key={assetsTick} src={arte.url} alt={ficha.imagemAltText || nomePerfil} />
            : <span aria-hidden="true">◇</span>}
        </div>
        <span className="inv-profile-image-hint">{arte ? 'Imagem vinculada' : 'Imagem ausente nesta ficha'}</span>
      </div>
    );
  };
  useEffect(() => {
    let mounted = true;
    const ids = Array.from(new Set(catalogo.flatMap(inv => [inv.imagemAssetId, inv.imagemFallbackAssetId].filter((id): id is string => Boolean(id)))));
    if (ids.length) void Promise.all(ids.map(id => carregarAssetFicha(id)))
      .then(() => { if (mounted) setAssetsTick(value => value + 1); })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, [catalogo]);
  const controlador = character.specialization === 'Controlador';
  const max = controlador ? limiteInvocacoesConhecidas(character.level) : null;
  const ativas = limiteAtivasPersonagem(character.specialization, character.treinoControle ?? 0);
  const ordemGrauHorda = { quarto: 1, terceiro: 2, segundo: 3, primeiro: 4, especial: 5 } as const;
  const hordaLider = catalogo.find(inv => inv.id === hordaLiderId);
  const hordaMembros = hordaMembrosIds.map(id => catalogo.find(inv => inv.id === id)).filter((inv): inv is InvocacaoControlador => Boolean(inv));
  const componenteHorda = (inv: InvocacaoControlador) => inv.grau ? {
    id: inv.id,
    grau: inv.grau,
    pvAtual: inv.hpAtual,
    pvMaximo: inv.hpMaximo,
    custoInvocacaoPE: inv.custoInvocacaoPE,
  } : null;
  const liderComponenteHorda = hordaLider ? componenteHorda(hordaLider) : null;
  const membrosComponentesHorda = hordaMembros.map(componenteHorda);
  const hordaPreview = liderComponenteHorda && hordaMembrosIds.length > 0 &&
    membrosComponentesHorda.length === hordaMembrosIds.length && membrosComponentesHorda.every(Boolean)
    ? calcularHorda({
      id: 'horda-preview',
      lider: liderComponenteHorda,
      membros: membrosComponentesHorda.filter((item): item is NonNullable<typeof item> => Boolean(item)),
      nivelDono: character.level,
      maximoInvocacoesEmCampo: ativas,
      tempoAdicional: {
        quantidade: hordaTempoQuantidade.trim() ? Number(hordaTempoQuantidade) : Number.NaN,
        unidade: hordaTempoUnidade,
      },
    })
    : null;
  const hordaAtivaTokens = ativos.filter(token => Boolean(token.invocationHordeId));
  const limiteHordaPreview = hordaPreview?.ok ? validarLimiteHorda({
    limiteInvocacoesEmCampo: ativas,
    hordasAtivas: hordaAtivaTokens.length,
    invocacoesIndividuaisAposCriacao: ativos.filter(token => !token.invocationHordeId).length,
    vagasOcupadasPorHordas: hordaAtivaTokens.reduce((total, token) => total + vagasInvocacaoEmCampo(token), 0),
    vagasNovaHorda: hordaPreview.horda.vagasInvocacao,
  }) : null;
  const hordaTempoPreview = hordaTempoQuantidade.trim() && hordaTempoUnidade.trim()
    ? tempoAdicionalEmSegundos({ quantidade: Number(hordaTempoQuantidade), unidade: hordaTempoUnidade })
    : { ok: false as const, motivo: 'Defina o tempo da Horda na criação.' };
  const hordaModelosVinculados = new Set<string>();
  for (const instancia of character.instanciasInvocacao ?? []) {
    if (!instancia.composicaoHorda || instancia.estado === 'dissipada') continue;
    hordaModelosVinculados.add(instancia.composicaoHorda.liderModeloId);
    instancia.composicaoHorda.membros.forEach(membro => hordaModelosVinculados.add(membro.modeloId));
  }
  for (const token of ativos) {
    if (!token.invocationHordeId) continue;
    if (token.invocationId) hordaModelosVinculados.add(token.invocationId);
    token.invocationHordeMemberIds?.forEach(id => hordaModelosVinculados.add(id));
  }
  const membrosHordaDisponiveis = hordaLider?.grau
    ? catalogo.filter(inv => inv.id !== hordaLider.id && inv.grau && ordemGrauHorda[inv.grau] < ordemGrauHorda[hordaLider.grau!])
    : [];
  const formarHorda = async () => {
    if (carregandoArteId) return;
    if (!hordaLider || hordaMembros.length !== hordaMembrosIds.length || hordaMembros.length < 1) {
      setErro('Escolha um líder e pelo menos um membro para a Horda.'); return;
    }
    if (!hordaPreview) { setErro('Confira a composição e o tempo da Horda.'); return; }
    if (!hordaPreview.ok) { setErro(hordaPreview.motivo); return; }
    if (limiteHordaPreview && !limiteHordaPreview.ok) { setErro(limiteHordaPreview.motivo); return; }
    if (!hordaTempoPreview.ok) { setErro(hordaTempoPreview.motivo); return; }
    if (!Object.values(useMapStore.getState().entities).some(entity => entity.characterId === character.id && !entity.invocationId)) {
      setErro('Coloque o token do Controlador no mapa primeiro.'); return;
    }
    const eventoId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'evento-horda-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    try {
      setErro(''); setMensagem(''); setCarregandoArteId('horda');
      const assetIds = [hordaLider.imagemAssetId, hordaLider.imagemFallbackAssetId].filter((assetId): assetId is string => Boolean(assetId));
      if (assetIds.length) await Promise.all(assetIds.map(assetId => carregarAssetFicha(assetId)));
      const posicoes = await useMapStore.getState().requestInvocationPlacement({
        ownerCharacterId: character.id,
        items: [{
          invocationId: 'horda-' + eventoId,
          label: `Horda de ${hordaLider.apelido?.trim() || hordaLider.nome}`,
          alcanceM: hordaLider.alcanceInvocacaoM ?? 0,
          color: hordaLider.corIdentificacao ?? '#8055bd',
        }],
      });
      if (!posicoes) { setMensagem('Posicionamento da Horda cancelado.'); return; }
      const posicao = posicoes[0];
      if (!posicao) { setErro('O mapa não retornou a posição da Horda.'); return; }
      const ids = [hordaLider.id, ...hordaMembrosIds];
      const resultado = invocarHordaControlador(character.id, {
        eventoId,
        liderId: hordaLider.id,
        membrosIds: hordaMembrosIds,
        tempoAdicional: { quantidade: Number(hordaTempoQuantidade), unidade: hordaTempoUnidade },
        x: posicao.x,
        y: posicao.y,
        motivosOverrideIntermediario: Object.fromEntries(ids.map(id => [id, motivosOverride[id] ?? ''])),
      });
      if (!resultado.ok) { setErro(resultado.motivo); return; }
      setHordaLiderId(''); setHordaMembrosIds([]); setHordaTempoQuantidade(''); setHordaTempoUnidade('');
      setInvocacoesSelecionadas([]);
      setErro('');
      setMensagem('Horda criada como uma única entidade, com PV e contribuição de tempo compartilhados. A ficha do líder fornece as ações.');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível preparar o posicionamento da Horda.');
    } finally {
      setCarregandoArteId(null);
    }
  };
  const fontes: Fonte[] = [
    ...criaturasGrimorio(),
    ...Object.values(entidades).filter(e => e.categoria !== 'condicao' && e.categoria !== 'voto').map(e => ({
      id: e.id, nome: e.nome, tipo: 'omni' as const,
      hp: 10, defesa: 10, deslocamento: 9, porte: 'Médio' as const,
      acoes: (e.acoesAtivas ?? []).map(a => {
        if (typeof a === 'object' && a !== null) {
          return {
            id: a.id, nome: a.nome, tipo: 'habilidade' as const, alcanceM: a.alcanceM,
            dano: a.dano, entidadeOmniId: e.id,
          };
        }
        // Fallback for non-object actions
        return {
          id: 'unknown', nome: 'Habilidade desconhecida', tipo: 'habilidade' as const, alcanceM: 0,
          dano: undefined, entidadeOmniId: e.id,
        };
      }),
    })),
  ];
  const acoesDeAtaque = (inv: InvocacaoControlador) => inv.acoes.filter(a => a.tipo === 'ataque' || a.teste === 'ataque' || a.teste === 'resistencia' || a.efeitoEspecial?.tipo === 'puxar_aliado_gama');
  const alvosPersonagensDisponiveis = [...new Map(Object.values(entities)
    .filter(entity => entity.characterId && entity.characterId !== character.id && !entity.invocationId && !entity.hidden)
    .map(entity => {
      const alvo = allCharacters.find(item => item.id === entity.characterId);
      return [entity.characterId!, { id: entity.characterId!, nome: alvo?.name ?? entity.label ?? entity.characterId! }] as const;
    })).values()];
  const alvosInvocacaoDisponiveis = Object.values(entities)
    .filter(entity => entity.invocationId && entity.ownerCharId && !entity.hidden &&
      entity.invocationState !== 'derrotada' && entity.invocationState !== 'dissipada')
    .flatMap(entity => {
      const donoAlvo = allCharacters.find(item => item.id === entity.ownerCharId);
      const modeloAlvo = donoAlvo?.invocacoesConhecidas?.find(item => item.id === entity.invocationId);
      return donoAlvo && modeloAlvo
        ? [{ id: `invoc:${entity.id}`, nome: entity.invocationHordeId
          ? entity.label || `Horda de ${modeloAlvo.apelido?.trim() || modeloAlvo.nome}`
          : `${modeloAlvo.apelido?.trim() || modeloAlvo.nome} (${rotuloTipoInvocacao(modeloAlvo.tipo)})` }]
        : [];
    });
  const alvosDisponiveis = [...alvosPersonagensDisponiveis, ...alvosInvocacaoDisponiveis];
  const configOmniDaAcao = (acao: InvocacaoControlador['acoes'][number]) => acao.entidadeOmniId && acao.acaoOmniId
    ? entidades[acao.entidadeOmniId]?.acoesAtivas?.find(item => item.id === acao.acaoOmniId)
    : undefined;
  const escolhido = fontes.find(f => `${f.tipo}:${f.id}` === fonte);
  const solicitarVersaoEditada = async (original: InvocacaoControlador, alterada: InvocacaoControlador) => {
    const versaoModelo = (original.versaoModelo ?? 1) + 1;
    const rascunho: InvocacaoControlador = {
      ...alterada,
      versaoModelo,
      aprovacaoMestre: 'pendente',
      versaoAprovada: undefined,
      motivoRejeicao: undefined,
    };
    const solicitacao = await submeterAprovacaoInvocacao({ data: {
      requestId: crypto.randomUUID(),
      invocationId: rascunho.id,
      ownerCharacterId: character.id,
      versionSubmitted: versaoModelo,
      snapshot: rascunho as unknown as Record<string, unknown>,
    } });
    return {
      ...rascunho,
      aprovacaoMestre: solicitacao.status,
      versaoAprovada: solicitacao.versaoAprovada ?? undefined,
      solicitacaoAprovacaoId: solicitacao.requestId,
    };
  };

  const salvar = async () => {
    if (busyAprovacao) return;
    const alcance = alcanceInvocacaoM.trim() === '' ? Number.NaN : Number(alcanceInvocacaoM);
    if (!Number.isFinite(alcance) || alcance < 0) { setErro('Defina o alcance de posicionamento em metros.'); return; }
    const novo: InvocacaoControlador = {
      id: crypto.randomUUID(), donoCharacterId: character.id,
      nome: escolhido?.nome ?? nome.trim(), tipo,
      ...(tipo === 'maldicao_domada' ? { domado: false } : {}),
      aprovacaoMestre: 'pendente', versaoModelo: 1,
      origem: escolhido ? { tipo: escolhido.tipo, entidadeId: escolhido.id } : { tipo: 'manual' },
      hpAtual: escolhido?.hp ?? hp, hpMaximo: escolhido?.hp ?? hp,
      defesa: escolhido?.defesa ?? defesa, deslocamentoM: escolhido?.deslocamento ?? deslocamento,
      porte: escolhido?.porte ?? 'Médio', custoInvocacaoPE: custoPE, alcanceInvocacaoM: alcance,
      acoes: escolhido?.acoes ?? [],
    };
    const resultado = validarCatalogoControlador(character.id, character.level, [...catalogo, novo]);
    if (!resultado.ok) { setErro(resultado.motivo); return; }
    setBusyAprovacao(true); setErro('');
    try {
      const solicitacao = await submeterAprovacaoInvocacao({ data: {
        requestId: crypto.randomUUID(),
        invocationId: novo.id,
        ownerCharacterId: character.id,
        versionSubmitted: 1,
        snapshot: novo as unknown as Record<string, unknown>,
      } });
      const salvo = {
        ...novo,
        aprovacaoMestre: solicitacao.status,
        versaoAprovada: solicitacao.versaoAprovada ?? undefined,
        solicitacaoAprovacaoId: solicitacao.requestId,
      };
      updateCharacter(character.id, { invocacoesConhecidas: [...catalogo, salvo], limiteInvocacoesConhecidas: max ?? undefined, limiteInvocacoesAtivas: ativas });
      setFonte(''); setNome(''); setAlcanceInvocacaoM(''); setErro('');
      setMensagem(solicitacao.status === 'aprovada' ? 'Invocação aprovada pelo Mestre.' : 'Solicitação enviada ao Mestre.');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar a solicitação ao Mestre.');
    } finally {
      setBusyAprovacao(false);
    }
  };
  const adicionarAtaque = async (id: string) => {
    if (busyAprovacao) return;
    if (!nomeAtaque.trim() || !parseFormulaDanoInvocacao(formulaAtaque)
      || !Number.isFinite(alcanceAtaque) || alcanceAtaque <= 0 || !Number.isFinite(bonusAtaque)
      || !Number.isInteger(margemCriticoAtaque) || margemCriticoAtaque < 2 || margemCriticoAtaque > 20
      || !Number.isInteger(multiplicadorCriticoAtaque) || multiplicadorCriticoAtaque < 1 || multiplicadorCriticoAtaque > 5) {
      setErro('Informe nome, dano como 2d12+1d6+3, alcance, bônus e crítico válidos.'); return;
    }
    const original = catalogo.find(inv => inv.id === id);
    if (!original || original.aprovacaoMestre === 'pendente') {
      setErro('Aguarde a decisão do Mestre antes de editar esta invocação.'); return;
    }
    const alterada = {
      ...original,
      acoes: [...original.acoes, {
        id: crypto.randomUUID(), nome: nomeAtaque.trim(), tipo: 'ataque' as const,
        teste: 'ataque' as const, tipoAtaque: tipoAtaqueAtaque, atributoAtaque: atributoAtaqueAtaque,
        ...(atributoDanoAtaque ? { atributoDano: atributoDanoAtaque } : {}),
        ...(multiplicadorDanoAtributoAtaque !== '' ? { multiplicadorDanoAtributo: Number(multiplicadorDanoAtributoAtaque) } : {}),
        margemCritico: margemCriticoAtaque, multiplicadorCritico: multiplicadorCriticoAtaque,
        dano: formulaAtaque.trim(), alcanceM: alcanceAtaque, bonusAtaque, tipoDano: tipoDanoAtaque,
      }],
    };
    setBusyAprovacao(true); setErro('');
    try {
      const salva = await solicitarVersaoEditada(original, alterada);
      updateCharacter(character.id, { invocacoesConhecidas: catalogo.map(inv => inv.id === id ? salva : inv) });
      setEditando(null); setNomeAtaque(''); setErro('');
      setMensagem(salva.aprovacaoMestre === 'aprovada' ? 'Alteração aprovada pelo Mestre.' : 'Alteração enviada para nova aprovação.');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar a alteração ao Mestre.');
    } finally {
      setBusyAprovacao(false);
    }
  };
  const removerAtaque = async (invId: string, ataqueId: string) => {
    if (busyAprovacao) return;
    const original = catalogo.find(inv => inv.id === invId);
    if (!original || original.aprovacaoMestre === 'pendente') {
      setErro('Aguarde a decisão do Mestre antes de editar esta invocação.'); return;
    }
    const alterada = { ...original, acoes: original.acoes.filter(a => a.id !== ataqueId) };
    setBusyAprovacao(true); setErro('');
    try {
      const salva = await solicitarVersaoEditada(original, alterada);
      updateCharacter(character.id, { invocacoesConhecidas: catalogo.map(inv => inv.id === invId ? salva : inv) });
      setMensagem(salva.aprovacaoMestre === 'aprovada' ? 'Alteração aprovada pelo Mestre.' : 'Alteração enviada para nova aprovação.');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar a alteração ao Mestre.');
    } finally {
      setBusyAprovacao(false);
    }
  };
  const decidirAprovacao = async (id: string, estado: 'aprovada' | 'rejeitada') => {
    if (!isMaster || busyAprovacao) return;
    const invocacao = catalogo.find(inv => inv.id === id);
    if (!invocacao) return;
    setBusyAprovacao(true); setErro('');
    try {
      const motivo = estado === 'rejeitada' ? (motivosRejeicao[id] ?? '') : undefined;
      const resultado = invocacao.solicitacaoAprovacaoId
        ? await decidirAprovacaoInvocacao({ data: {
            requestId: invocacao.solicitacaoAprovacaoId,
            decisao: estado,
            ...(motivo !== undefined ? { motivo } : {}),
          } })
        : await decidirAprovacaoLegadaInvocacao({ data: {
            requestId: crypto.randomUUID(),
            invocationId: invocacao.id,
            ownerCharacterId: character.id,
            versionSubmitted: invocacao.versaoModelo ?? 1,
            snapshot: invocacao as unknown as Record<string, unknown>,
            decisao: estado,
            ...(motivo !== undefined ? { motivo } : {}),
          } });
      updateCharacter(character.id, { invocacoesConhecidas: catalogo.map(inv => inv.id !== id ? inv : {
        ...inv,
        aprovacaoMestre: resultado.status,
        solicitacaoAprovacaoId: resultado.requestId,
        versaoAprovada: resultado.versaoAprovada ?? undefined,
        motivoRejeicao: resultado.motivo ?? undefined,
      }) });
      setMensagem(resultado.status === 'aprovada' ? 'Invocação aprovada pelo Mestre.' : 'Solicitação rejeitada pelo Mestre.');
      setMotivosRejeicao(v => ({ ...v, [id]: '' }));
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível registrar a decisão do Mestre.');
    } finally {
      setBusyAprovacao(false);
    }
  };
  const reenviarAprovacao = async (id: string) => {
    if (busyAprovacao) return;
    const original = catalogo.find(inv => inv.id === id);
    if (!original || original.aprovacaoMestre !== 'rejeitada') return;
    setBusyAprovacao(true); setErro('');
    try {
      const salva = await solicitarVersaoEditada(original, original);
      updateCharacter(character.id, { invocacoesConhecidas: catalogo.map(inv => inv.id === id ? salva : inv) });
      setMensagem(salva.aprovacaoMestre === 'aprovada' ? 'Nova versão aprovada pelo Mestre.' : 'Nova versão enviada ao Mestre.');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível reenviar a invocação.');
    } finally {
      setBusyAprovacao(false);
    }
  };
  const remover = (id: string) => {
    if (catalogo.some(inv => inv.id === id && inv.aprovacaoMestre === 'pendente')) {
      setErro('Aguarde a decisão do Mestre antes de remover esta invocação.');
      return;
    }
    if (character.instanciasInvocacao?.some(instancia => instancia.modeloId === id && instancia.estado === 'derrotada')) {
      setErro('A ficha derrotada precisa permanecer no catálogo até a resolução do Mestre/Controlador.');
      return;
    }
    updateCharacter(character.id, { invocacoesConhecidas: catalogo.filter(i => i.id !== id) });
    setErro('');
  };
  const acaoPrimaria = view === 'owned' && invocacoesPossuidas.length === 0 && onBrowseCatalog
    ? { label: 'Explorar catálogo', run: onBrowseCatalog }
    : onCreateFicha
      ? { label: 'Criar ficha', run: onCreateFicha }
      : undefined;
  return (
    <div className="invocations-view space-y-4">
      {view === 'catalog' && <>
      <section className="inv-section inv-package-panel" aria-label="Pacote Dez Sombras">
        <div className="inv-package-top">
          <div className="inv-package-intro">
            <span className="inv-package-mark" aria-hidden="true">✦</span>
            <div className="inv-package-copy">
              <p className="inv-package-eyebrow">Pacote pré-pronto</p>
              <h3>Dez Sombras</h3>
              <p>Importe os dez shikigamis e suas formas derivadas. Os Cães Divinos têm fichas separadas; cada ficha exige uma imagem.</p>
            </div>
          </div>
          <div className="inv-package-import">
            <button type="button" className="inv-primary inv-package-import-button" disabled={!temTecnicaDezSombras || Boolean(salvandoImagemPerfilId)} onClick={() => void importarDezSombras()}>
              {salvandoImagemPerfilId === 'lote' ? 'Guardando imagens…' : 'Importar fichas'}
            </button>
            <p className="inv-package-bulk-help">Escolha uma imagem por perfil pendente.</p>
            {!temTecnicaDezSombras && <p className="inv-package-requirement" role="status">Cadastre “Dez Sombras” como técnica amaldiçoada para liberar a importação.</p>}
          </div>
        </div>
        <div className="inv-package-tools">
          <div className="inv-package-facts" aria-label="Conteúdo do pacote">
            <span><strong>10</strong> entradas oficiais</span>
            <span><strong>4</strong> formas derivadas</span>
          </div>
        </div>
        <details className="inv-package-details">
          <summary>Regras, habilidades e ressalvas</summary>
          <div className="inv-package-details-content">
            <p className="inv-package-reference-notes">A lista oficial tem dez entradas; os Cães Divinos são dois lobos entregues juntos e aparecem como duas fichas. Fuga dos Coelhos e Tigre Fúnebre são perfis oficiais. As quatro formas derivadas ficam em fichas separadas, não ocupam vagas de indivíduo-base e aguardam aprovação do Mestre porque a edição nova não publica seus valores numéricos completos. As quimeras exigem que as invocações componentes tenham sido domadas e um ritual; um shikigami exorcizado após ser domado ainda pode ser usado na quimera. O alcance de posicionamento das invocações não é definido; a esfera de 18 m do ritual não é tratada como alcance de invocação. Regra da campanha preservada: cada Cão custa 2 PE; invocar o par custa 4 PE. Fichas já salvas não são sobrescritas durante a importação, para preservar personalizações; versões da edição anterior ficam identificadas na própria ficha.</p>
            <div className="inv-package-skills-grid">
              <div>
                <strong>Técnica</strong>
                <ul>
                  {HABILIDADES_TECNICA_DEZ_SOMBRAS.map(habilidade => <li key={habilidade.id}><strong>{habilidade.nome} — {habilidade.automacao === 'parcial' ? 'Parcial' : 'Manual'}</strong> — {habilidade.descricao}</li>)}
                </ul>
              </div>
              <div>
                <strong>Formas derivadas (não são indivíduos adicionais na lista-base)</strong>
                <ul>
                  {DEZ_SOMBRAS_FORMAS_REFERENCIA.map(forma => <li key={forma.id}><strong>{forma.nome} | p. {forma.pagina}</strong> — {forma.descricao}</li>)}
                  <li><strong>Fichas derivadas:</strong> {DEZ_SOMBRAS_FORMAS_DERIVADAS.map(forma => forma.nome).join(', ')}. Não contam como indivíduos-base; seus valores numéricos são provisórios até revisão e aprovação pelo Mestre.</li>
                </ul>
              </div>
            </div>
            <p className="inv-package-automation-note">Manual e Parcial indicam que a regra está visível, mas o motor não automatiza todos os efeitos. Lacunas da fonte permanecem explícitas.</p>
          </div>
        </details>
      </section>
      </>}

      {view === 'catalog' && <section className="inv-individual-catalog" aria-labelledby="inv-individual-catalog-title">
        <header className="inv-individual-heading">
          <div className="inv-individual-mark" aria-hidden="true">✦</div>
          <div className="inv-individual-heading-copy">
            <p className="inv-catalog-kicker">Catálogo de referência</p>
            <h3 id="inv-individual-catalog-title">Adicionar invocações individuais</h3>
            <p>Escolha uma imagem para cada perfil antes de adicioná-lo. A prévia aparece no cartão e acompanha a ficha na biblioteca.</p>
          </div>
          <div className="inv-catalog-counter" aria-label="Onze fichas para dez entradas oficiais">
            <strong>11</strong><span>fichas-base</span>
          </div>
        </header>

        <div className="inv-profile-group">
          <div className="inv-profile-group-heading">
            <div className="inv-profile-group-title">
              <span className="inv-profile-group-index" aria-hidden="true">01</span>
              <div><p className="inv-catalog-kicker">Catálogo principal</p><h4>Invocações oficiais</h4></div>
            </div>
            <span className="inv-profile-group-count">10 entradas · 11 fichas com os dois Cães</span>
          </div>

          <div className="inv-profile-grid" role="list">
            {DEZ_SOMBRAS_MODELOS
              .filter(perfil => !perfil.opcionalHomebrew) // Excluir homebrew
              .map(perfil => {
                const chaveImagem = `base:${perfil.id}`;
                const imagemSelecionada = Boolean(imagensPerfisPreProntos[chaveImagem]);
                const salvandoImagem = salvandoImagemPerfilId === chaveImagem;
                const fichaExistente = catalogo.find(inv =>
                  inv.subcategoria === `dez-sombras:${perfil.id}`
                );
                const isAlreadyInCatalog = Boolean(fichaExistente);
                return (
                  <article key={perfil.id} className="inv-profile-card" role="listitem" data-added={isAlreadyInCatalog} data-image-ready={imagemSelecionada}>
                    <div className="inv-profile-card-top">
                      {fichaExistente ? renderImagemPerfilExistente(fichaExistente, perfil.nome) : renderSeletorImagemPerfilPrePronto(chaveImagem, perfil.nome)}
                      <div className="inv-profile-card-name">
                        <span className="inv-profile-kind">Indivíduo-base</span>
                        <h5>{perfil.nome}</h5>
                      </div>
                      <span className="inv-profile-page">p. {perfil.pagina}</span>
                    </div>
                    <div className="inv-profile-badges">
                      <span className="inv-profile-grade">Grau {perfil.grau}</span>
                      <span className="inv-profile-cost"><span aria-hidden="true">✦</span> {perfil.custoPE} PE</span>
                    </div>
                    <dl className="inv-profile-stats">
                      <div><dt>PV</dt><dd>{perfil.hp + (perfil.bonusPVMaximo ?? 0)}</dd></div>
                      <div><dt>Defesa</dt><dd>{perfil.defesa}</dd></div>
                      <div><dt>Movimento</dt><dd>{perfil.deslocamentoM}<small> m</small></dd></div>
                    </dl>
                    <div className="inv-profile-actions">
                      <div className="inv-profile-actions-heading">
                        <span>Ações</span>
                        <small>{perfil.acoes.length} {perfil.acoes.length === 1 ? 'ação' : 'ações'}</small>
                      </div>
                      <div className="inv-profile-action-list">
                        {perfil.acoes.map((acao, index) => (
                          <div key={index} className="inv-profile-action-row">
                            <div className="inv-profile-action-main">
                              <strong>{acao.nome}</strong>
                              <span>
                                {acao.tipo === 'ataque' ? (acao.dano ?? 'Ataque') :
                                 acao.formulaCura ? acao.formulaCura + ' PV' :
                                 acao.efeitoSuporte?.efeito || 'Habilidade'}
                              </span>
                            </div>
                            {acao.statusAutomacao && (
                              <span className="inv-profile-automation" data-state={acao.statusAutomacao}>
                                {acao.statusAutomacao === 'executavel' ? 'Automático' :
                                 acao.statusAutomacao === 'parcial' ? 'Parcial' : 'Manual'}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <footer className="inv-profile-card-footer">
                      {isAlreadyInCatalog ? (
                        <p className="inv-profile-added" role="status"><span aria-hidden="true">✓</span> Já está na biblioteca</p>
                      ) : (
                        <button
                          type="button"
                          className="inv-primary inv-profile-add"
                          disabled={!temTecnicaDezSombras || !imagemSelecionada || Boolean(salvandoImagemPerfilId)}
                          onClick={() => void adicionarFichaPreProntaComImagem(chaveImagem,
                            () => criarPacoteDezSombras(character.id).find(
                              novo => novo.subcategoria === 'dez-sombras:' + perfil.id
                            ),
                            perfil.nome,
                          )}
                        >
                          <span className="inv-profile-add-symbol" aria-hidden="true">+</span>
                          {!temTecnicaDezSombras ? 'Técnica necessária' : salvandoImagem ? 'Guardando imagem…' : imagemSelecionada ? 'Adicionar à biblioteca' : 'Escolha uma imagem'}
                        </button>
                      )}
                    </footer>
                  </article>
                );
              })}
          </div>
        </div>

        <div className="inv-profile-group inv-profile-group-derived">
          <div className="inv-profile-group-heading">
            <div className="inv-profile-group-title">
              <span className="inv-profile-group-index" aria-hidden="true">02</span>
              <div><p className="inv-catalog-kicker">Combinações e mudanças</p><h4>Formas derivadas</h4></div>
            </div>
            <span className="inv-profile-group-count">Catálogo separado</span>
          </div>
          {DEZ_SOMBRAS_FORMAS_REFERENCIA.filter(forma => forma.id === 'totalidade').map(forma => (
            <article key={forma.id} className="inv-derived-note">
              <div className="inv-derived-note-symbol" aria-hidden="true">↻</div>
              <div className="inv-derived-note-copy">
                <p className="inv-profile-kind">Quimera · ficha derivada separada</p>
                <h5>{forma.nome}</h5>
                <p>{'descricao' in forma ? forma.descricao : 'Descrição não informada nesta referência.'}</p>
                <p>A Totalidade é criada ao combinar os dois Cães já domados em um ritual. A perda permanente de um Cão não transforma automaticamente o outro. Se um shikigami foi domado antes de ser exorcizado, ele ainda pode compor uma quimera.</p>
              </div>
            </article>
          ))}
          <div className="inv-profile-grid" role="list">
            {DEZ_SOMBRAS_FORMAS_DERIVADAS.map(forma => {
              const chaveImagem = `derivada:${forma.id}`;
              const imagemSelecionada = Boolean(imagensPerfisPreProntos[chaveImagem]);
              const salvandoImagem = salvandoImagemPerfilId === chaveImagem;
              const fichaExistente = catalogo.find(inv =>
                inv.subcategoria === `dez-sombras:${forma.id}`
              );
              const isAlreadyInCatalog = Boolean(fichaExistente);
              return (
                <article key={forma.id} className="inv-profile-card" role="listitem" data-variant="derived" data-added={isAlreadyInCatalog} data-image-ready={imagemSelecionada}>
                  <div className="inv-profile-card-top">
                    {fichaExistente ? renderImagemPerfilExistente(fichaExistente, forma.nome) : renderSeletorImagemPerfilPrePronto(chaveImagem, forma.nome)}
                    <div className="inv-profile-card-name">
                      <span className="inv-profile-kind">Forma derivada</span>
                      <h5>{forma.nome}</h5>
                    </div>
                    <span className="inv-profile-page">p. {forma.pagina}</span>
                  </div>
                  <div className="inv-profile-origin">
                    <span>Origem</span>
                    <strong>{(DEZ_SOMBRAS_FORMAS_REFERENCIA.find(f => f.id === forma.id)?.derivaDe ?? []).map(id =>
                      DEZ_SOMBRAS_MODELOS.find(p => p.id === id)?.nome || id
                    ).join(' + ')}</strong>
                  </div>
                  <div className="inv-profile-description">
                    <span>Descrição</span>
                    <p>{DEZ_SOMBRAS_FORMAS_REFERENCIA.find((referencia) => referencia.id === forma.id)?.descricao ?? 'Descrição não informada nesta referência.'}</p>
                  </div>
                  <footer className="inv-profile-card-footer">
                    {isAlreadyInCatalog ? (
                      <p className="inv-profile-added" role="status"><span aria-hidden="true">✓</span> Já está na biblioteca</p>
                    ) : (
                      <button
                        type="button"
                        className="inv-primary inv-profile-add"
                        disabled={!temTecnicaDezSombras || !imagemSelecionada || Boolean(salvandoImagemPerfilId)}
                        onClick={() => void adicionarFichaPreProntaComImagem(chaveImagem,
                          () => criarFormasDerivadasDezSombras(character.id).find(
                            nova => nova.subcategoria === 'dez-sombras:' + forma.id
                          ),
                          forma.nome,
                        )}
                      >
                        <span className="inv-profile-add-symbol" aria-hidden="true">+</span>
                        {!temTecnicaDezSombras ? 'Técnica necessária' : salvandoImagem ? 'Guardando imagem…' : imagemSelecionada ? 'Adicionar à biblioteca' : 'Escolha uma imagem'}
                      </button>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        </div>
      </section>}
      <OwnedInvocationsCollection
        variant={view}
        canViewCatalog={canViewCatalog}
        title={view === 'owned' ? 'Minhas invocações' : 'Fichas do personagem'}
        description={view === 'owned'
          ? canViewCatalog
            ? 'Invocações domadas e disponíveis. Rituais pendentes e fichas arquivadas ficam no Catálogo.'
            : 'Invocações domadas e disponíveis para o personagem.'
          : 'Fichas salvas, rituais pendentes e registros arquivados. Os perfis de referência ficam acima.'}
        totalCount={invocacoesDaVisao.length}
        baseLimit={max}
        derivedCount={invocacoesDaVisao.filter(inv => inv.formaDerivada).length}
        activeCount={ativos.length}
        activeLimit={ativas}
        selectedCount={invocacoesSelecionadas.length}
        pendingApprovalCount={invocacoesDaVisao.filter(inv => inv.aprovacaoMestre === 'pendente').length}
        searchQuery={libraryQuery}
        onSearchChange={setLibraryQuery}
        primaryActionLabel={acaoPrimaria?.label}
        onPrimaryAction={acaoPrimaria?.run}
        movementDirection={direcao}
        onMovementDirectionChange={setDirecao}
        onInvokeSelected={() => void invocarSelecionadas()}
        statusMessage={mensagem}
        error={erro}
        zeroResults={libraryQuery.trim().length > 0 && invocacoesFiltradas.length === 0}
      >
      {invocacoesFiltradas.map(inv => {
        const arte = assetForFicha(inv);
        const auditoriaFormaDerivada = auditarValoresProvisoriosFormaDerivadaDezSombras(inv);
        const estadoIntermediario = validarIntermediarioInvocacao(inv, character, itensInventario, catalogo);
        const instanciaHorda = [...(character.instanciasInvocacao ?? [])].reverse().find(item =>
          item.estado !== 'dissipada' && item.composicaoHorda &&
          (item.composicaoHorda.liderModeloId === inv.id || item.composicaoHorda.membros.some(membro => membro.modeloId === inv.id)));
        const composicaoHorda = instanciaHorda?.composicaoHorda;
        const emHorda = Boolean(composicaoHorda);
        const ehLiderHorda = composicaoHorda?.liderModeloId === inv.id;
        const ehMembroHorda = Boolean(composicaoHorda?.membros.some(membro => membro.modeloId === inv.id));
        const tokenHorda = instanciaHorda
          ? ativos.find(entity => entity.invocationInstanceId === instanciaHorda.id || entity.invocationHordeId === composicaoHorda?.id)
          : undefined;
        const token = ativos.find(entity => entity.invocationId === inv.id);
        const ativo = Boolean(token);
        const ehAbismo = inv.subcategoria === 'dez-sombras:abismo-desconhecido-do-poco';
        const quantidadeSaposTexto = membrosSapoVivos[inv.id] ?? '';
        const quantidadeSapos = Number(quantidadeSaposTexto);
        const quantidadeSaposValida = quantidadeSaposTexto.trim() !== '' &&
          Number.isInteger(quantidadeSapos) && quantidadeSapos >= 1 && quantidadeSapos <= 3;
        const instancia = token
          ? character.instanciasInvocacao?.find(item => item.id === token.invocationInstanceId || item.tokenId === token.id)
          : instanciaHorda ?? [...(character.instanciasInvocacao ?? [])].reverse().find(item => item.modeloId === inv.id);
        const estadoInstancia = token?.invocationState ?? instancia?.estado;
        const acaoAgarrarGama = inv.acoes.find(acao => acao.efeitoEspecial?.tipo === 'agarrar_gama_apos_acerto');
        const agarrarLinguaPendente = instancia?.agarrarLinguaPendente;
        const janelaAgarrarGama = Boolean(acaoAgarrarGama?.efeitoEspecial?.tipo === 'agarrar_gama_apos_acerto' &&
          agarrarLinguaPendente && inCombat && currentActorId === character.id &&
          agarrarLinguaPendente.combateId === combatId && agarrarLinguaPendente.rodada === round &&
          agarrarLinguaPendente.turnoIndex === currentTurnIndex && estadoInstancia === 'ativa');
        const pvAtualExibido = emHorda
          ? tokenHorda?.hp ?? instanciaHorda?.hpAtual ?? inv.hpAtual
          : token?.hp ?? instancia?.hpAtual ?? inv.hpAtual;
        const pvMaximoExibido = emHorda
          ? tokenHorda?.hpMax ?? instanciaHorda?.hpMaximoAtual ?? inv.hpMaximo
          : token?.hpMax ?? instancia?.hpMaximoAtual ?? inv.hpMaximo;
        const liderHorda = composicaoHorda && catalogo.find(item => item.id === composicaoHorda.liderModeloId);
        const resolucaoDerrota = instancia?.resolucaoDerrota;
        const contribuicaoTempo = instancia?.contribuicaoTempo;
        const tempoConfigurado = tempoAdicionalEmSegundos(inv.tempoAdicional);
        const rotuloTempo = contribuicaoTempo?.estado === 'consolacao'
          ? `Contribuição preservada no relógio global após derrota: ${formatarSegundosTempoInvocacao(contribuicaoTempo.quantidadeRestante)} s`
          : contribuicaoTempo?.estado === 'ativa'
            ? `Parte desta invocação no relógio global: ${formatarSegundosTempoInvocacao(contribuicaoTempo.quantidadeRestante)} s`
            : contribuicaoTempo?.estado === 'retirada'
              ? 'Contribuição retirada do relógio global por dissipação'
              : contribuicaoTempo?.estado === 'consumida'
                ? 'Contribuição consumida ou encerrada'
                : !inv.tempoAdicional
                  ? 'Tempo extra: não configurado'
                  : tempoConfigurado.ok
                    ? `Tempo por invocação: +${formatarSegundosTempoInvocacao(tempoConfigurado.segundos)} s`
                    : `Tempo extra inválido: ${tempoConfigurado.motivo}`;
        const derrotaPendente = estadoInstancia === 'derrotada' && !resolucaoDerrota;
        const permiteAlvosInimigos = inv.acoes.some(acao => acao.permiteInimigos === true);
        const acaoLinguaSombria = inv.acoes.find(acao => acao.efeitoEspecial?.tipo === 'puxar_aliado_gama');
        const linguaSombriaUsada = Boolean(instancia?.usoLinguaSombriaGama &&
          instancia.usoLinguaSombriaGama.combateId === combatId && instancia.usoLinguaSombriaGama.rodada === round);
        const linguaSombriaDisponivel = Boolean(inCombat && combatId && estadoInstancia === 'ativa' &&
          (instancia?.economiaAcoes?.reacao?.atual ?? 0) > 0 && !linguaSombriaUsada);
        const alvosAliadosLinguaSombria = [...new Map(Object.values(entities)
          .filter(entity => !entity.hidden && (entity.layer ?? 'tokens') !== 'map' &&
            (entity.layer == null || useMapStore.getState().layerVisible[entity.layer] !== false))
          .flatMap(entity => {
            if (entity.invocationId && entity.ownerCharId && entity.id !== token?.id) {
              const donoAlvo = allCharacters.find(alvo => alvo.id === entity.ownerCharId);
              const modeloAlvo = donoAlvo?.invocacoesConhecidas?.find(modelo => modelo.id === entity.invocationId);
              if (!donoAlvo || !modeloAlvo || (donoAlvo.category === 'INIMIGO') !== (character.category === 'INIMIGO')) return [];
              return [[`invoc:${entity.id}`, entity.label || modeloAlvo.apelido?.trim() || modeloAlvo.nome] as const];
            }
            if (entity.characterId) {
              const alvo = allCharacters.find(item => item.id === entity.characterId);
              if (!alvo || (alvo.category === 'INIMIGO') !== (character.category === 'INIMIGO')) return [];
              return [[alvo.id, alvo.name] as const];
            }
            return [];
          })).values()];
        const personagensAlvoSuporte = [...new Map(Object.values(entities)
          .filter(entity => entity.characterId && !entity.invocationId && !entity.hidden &&
            (permiteAlvosInimigos || allCharacters.find(alvo => alvo.id === entity.characterId)?.category !== 'INIMIGO' || entity.characterId === character.id))
          .map(entity => [entity.characterId!, { id: entity.characterId!, nome: entity.label || entity.characterId! }])).values()];
        const invocacoesAlvoSuporte = Object.values(entities)
          .filter(entity => entity.invocationId && entity.ownerCharId && !entity.hidden &&
            (permiteAlvosInimigos || allCharacters.find(alvo => alvo.id === entity.ownerCharId)?.category !== 'INIMIGO' || entity.ownerCharId === character.id))
          .flatMap(entity => {
            const donoAlvo = allCharacters.find(alvo => alvo.id === entity.ownerCharId);
            const modeloAlvo = donoAlvo?.invocacoesConhecidas?.find(modelo => modelo.id === entity.invocationId);
            return modeloAlvo ? [{ id: `invoc:${entity.id}`, nome: `${modeloAlvo.apelido?.trim() || modeloAlvo.nome}${entity.invocationState === 'caida' ? ' · Caído' : ''}` }] : [];
          });
        const opcoesAlvoSuporte = [...personagensAlvoSuporte, ...invocacoesAlvoSuporte];
        const movimentoDisponivel = (instancia?.economiaAcoes?.acaoMovimento?.atual ?? 0) > 0;
        const rotuloEstado = emHorda
          ? ehMembroHorda
            ? `Integrante da Horda de ${liderHorda?.apelido?.trim() || liderHorda?.nome || 'invocação'}; sem PV individual`
            : `Líder de Horda com ${composicaoHorda?.membros.length ?? 0} membro(s)`
          : inv.perdaPermanente || resolucaoDerrota?.resultado === 'perda_permanente'
          ? 'Perda permanente registrada'
          : estadoInstancia === 'derrotada'
            ? 'Derrotada — aguardando resolução'
            : estadoInstancia === 'caida'
              ? 'Caída — cura acima de 0 PV e Ação de Movimento própria para levantar'
              : inv.hpAtual <= 0 && !ativo
                ? 'Disponível com 0 PV — ficará Caída ao ser invocada'
              : estadoInstancia === 'ativa'
                ? 'Ativa no mapa'
                : estadoInstancia === 'dissipada'
                  ? 'Dissipada'
                  : 'Pronta';
        const aprovado = podeUsarVersaoAprovada({ estado: inv.aprovacaoMestre, versaoAtual: inv.versaoModelo, versaoAprovada: inv.versaoAprovada });
        const automacoesAtivas = (inv.automacoesOmni ?? []).filter(automacao => automacao.habilitada).length;
        const podeIntervirNaAutonomia = isMaster || Boolean(character.profileId && activeProfileId === character.profileId);
        const podeResolverDerrota = isMaster;
        const alcanceConfigurado = Number.isFinite(inv.alcanceInvocacaoM) && (inv.alcanceInvocacaoM ?? -1) >= 0;
        const aguardandoRodadaHorda = character.instanciasInvocacao?.some(item =>
          item.membrosHordaRemovidos?.some(membro => membro.modeloId === inv.id && membro.bloqueioRodadas > 0));
        const bloqueioDomesticao = mensagemDomesticaoPendente(inv);
        const podeSelecionar = !aguardandoRodadaHorda && !emHorda && !bloqueioDomesticao && !inv.perdaPermanente && !ativo && !derrotaPendente && aprovado && alcanceConfigurado && (estadoIntermediario.ok || (isMaster && Boolean(motivosOverride[inv.id]?.trim())));
        return (
        <div key={inv.id} role="listitem" className="inv-card flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2">
          <div className="inv-card-header flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border" style={{ borderColor: inv.corIdentificacao ?? '#8055bd' }}>
              {arte ? <img key={assetsTick} src={arte.url} alt={inv.imagemAltText || inv.apelido || inv.nome} className="h-full w-full object-cover" /> : <span className="text-xs text-muted-foreground">Sem arte</span>}
            </div>
            <div><h3>{inv.apelido?.trim() || inv.nome}</h3><p className="inv-card-kind">{rotuloTipoInvocacao(inv.tipo)} · {inv.acoes.length} ações</p><dl className="inv-card-hud" aria-label={'Valores de ' + inv.nome}><div><dt>PV{emHorda ? ' compartilhados' : ''}</dt><dd>{pvAtualExibido}/{pvMaximoExibido}</dd></div><div><dt>Defesa</dt><dd>{inv.defesa}</dd></div><div><dt>Movimento</dt><dd>{inv.deslocamentoM} m</dd></div><div><dt>Invocação</dt><dd>{inv.custoInvocacaoPE} PE</dd></div></dl></div>
          </div>
          <div className="inv-acquisition-status basis-full text-xs" data-status={inv.aprovacaoMestre}>Aprovação da ficha: {inv.aprovacaoMestre === 'pendente' ? 'Aguardando o Mestre' : inv.aprovacaoMestre === 'rejeitada' ? 'Rejeitada — edite e solicite novamente' : 'Aprovada'}</div>
          {inv.formaDerivada && inv.acoes.length === 0 && <p role="status" className="basis-full text-xs inv-warning">Esta forma ainda não tem ações cadastradas. Complete a ficha derivada e solicite nova aprovação antes de invocar.</p>}
          <div className={'basis-full text-xs ' + (derrotaPendente ? 'inv-error' : estadoInstancia === 'caida' ? 'inv-warning' : 'text-muted-foreground')}>Estado de combate: {rotuloEstado}{estadoInstancia === 'derrotada' && instancia ? ` (PV ${instancia.hpAtual})` : ''}</div>
          {(instancia?.agarradoPorInvocacao?.length ?? 0) > 0 && <div className="basis-full flex flex-wrap items-center gap-2 rounded border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
            <span>Agarrado por {instancia?.agarradoPorInvocacao?.[0]?.nome}. Tente escapar no início do turno:</span>
            <button type="button" disabled={busyFugaInvocacao} className="rounded border px-2 py-1 disabled:opacity-50" onClick={() => void escaparInvocacao(instancia!.id, 'Atletismo')}>Escapar · Atletismo</button>
            <button type="button" disabled={busyFugaInvocacao} className="rounded border px-2 py-1 disabled:opacity-50" onClick={() => void escaparInvocacao(instancia!.id, 'Acrobacia')}>Escapar · Acrobacia</button>
          </div>}
          {bloqueioDomesticao && (inv.tipo === 'maldicao_domada' || inv.pacoteRegras === 'dez-sombras') && <div className="basis-full space-y-1 text-xs">
            {inv.formaDerivada ? <>
              <p>Forma derivada bloqueada. Conclua o ritual de quimera na aba Rituais depois de domar os componentes.</p>
              {inv.requisitosFormaDerivada && <ul className="list-disc pl-5">{inv.requisitosFormaDerivada.map(requisito => <li key={requisito}>{requisito}</li>)}</ul>}
            </> : inv.tipo === 'maldicao_domada' ? <>
              <p>{bloqueioDomesticao} Criar ou aprovar a ficha não substitui o processo de domesticação da campanha.</p>
              {isMaster && <button type="button" className="rounded border px-2 py-1" onClick={() => registrarDomesticaoConcluida(inv.id)}>Confirmar domesticação concluída</button>}
            </> : <>
              <p>Ritual de domesticação pendente; esta ficha não pode ser invocada. Consulte a aba Rituais para solicitar ou conduzir a tentativa.</p>
            </>}
          </div>}
          {inv.formaDerivada && <div className="basis-full text-xs text-muted-foreground"><strong>Forma derivada — não ocupa vaga de indivíduo-base.</strong>{inv.lacunasFormaDerivada && <ul className="list-disc pl-5">{inv.lacunasFormaDerivada.map(lacuna => <li key={lacuna}>{lacuna}</li>)}</ul>}{inv.valoresProvisoriosFormaDerivada?.length ? <><p>Valores provisórios: {inv.valoresProvisoriosFormaDerivada.join(', ')}.</p><p>Comparação com a base do grau ({inv.grau}); diferenças para revisão do Mestre, sem funcionarem como limites:</p><ul className="list-disc pl-5">{auditoriaFormaDerivada.map(item => <li key={item.campo}>{item.campo}: {item.valorProvisorio} vs referência {item.referenciaGrau} ({item.diferenca > 0 ? '+' : ''}{item.diferenca}).</li>)}</ul></> : null}</div>}
          {inv.opcionalHomebrew && !(inv.pacoteRegras === 'dez-sombras' && inv.subcategoria === 'dez-sombras:tigre-funebre') && <div className="basis-full text-xs text-amber-500">Homebrew opcional — especulativo segundo a própria fonte.</div>}
          {inv.pacoteRegras === 'dez-sombras' && inv.referenciaRegra?.includes('v0.9') && <div className="basis-full text-xs text-amber-500">Ficha importada da edição anterior. O catálogo usa agora a v1.1.1; esta ficha salva foi preservada para não sobrescrever ajustes personalizados.</div>}
          {inv.referenciaRegra && <div className="basis-full text-xs text-muted-foreground">{inv.referenciaRegra}</div>}
          {inv.pacoteRegras === 'dez-sombras' && !alcanceConfigurado && <p role="status" className="basis-full text-xs inv-warning">O livro não define o alcance de posicionamento após domar. Edite a ficha para configurar essa distância antes de invocar.</p>}
          {inv.pacoteRegras === 'dez-sombras' && inv.descricao && <InvocationDisclosure className="inv-card-disclosure basis-full"><summary>Resumo da ficha e ressalvas da fonte</summary><p className="text-xs text-muted-foreground">{inv.descricao}</p></InvocationDisclosure>}
          {ehLiderHorda && <div className="basis-full text-xs inv-warning">A Horda usa um único token, pool de PV e contribuição temporal. A dissipação fica bloqueada até definir como os PV gerais retornam às fichas individuais.</div>}
          {ehLiderHorda && tokenHorda?.invocationEffectiveSize && <div className="basis-full text-xs text-muted-foreground">Porte efetivo: {tokenHorda.invocationEffectiveSize}</div>}
          {aguardandoRodadaHorda && <div className="basis-full text-xs inv-warning">Saiu da Horda com seus PV individuais. Aguarde a próxima rodada para invocar novamente.</div>}
          {ehLiderHorda && instancia?.perdaMembrosHordaPendente && <div className="basis-full text-xs inv-warning">Perda de {instancia.perdaMembrosHordaPendente.quantidade} membro(s) aguardando resolução.</div>}
          {resolucaoDerrota && <div className="basis-full text-xs text-muted-foreground">
            {resolucaoDerrota.resultado === 'recuperada'
              ? resolucaoDerrota.pvRecuperados !== undefined
                ? `Derrota resolvida por uma versão anterior: recuperação manual para ${resolucaoDerrota.pvRecuperados} PV. PV ao ser derrotada: ${resolucaoDerrota.pvNaDerrota}.`
                : `Derrota resolvida pelo Mestre; a ficha retorna com 100% dos PV após um descanso longo. PV ao ser derrotada: ${resolucaoDerrota.pvNaDerrota}.`
              : `Perda permanente registrada com ${resolucaoDerrota.pvNaDerrota} PV; ficha arquivada.`}
          </div>}
          {derrotaPendente && podeResolverDerrota && instancia && (!emHorda || ehLiderHorda) && <div className="basis-full space-y-2 rounded border border-destructive/50 p-2">
            <p className="text-xs">Somente o Mestre decide. Ao autorizar a recuperação, a invocação fica com 0 PV até um descanso longo, que restaura 100% dos PV. A perda permanente só pode ser declarada após atingir −100% dos PV máximos. A instância derrotada fica no histórico.</p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="rounded border border-primary px-2 py-2 text-xs" onClick={() => resolverDerrota(inv.id, 'recuperada')}>Autorizar recuperação</button>
              {confirmandoPerdaDerrota === inv.id ? <>
                <span className="text-xs inv-error">Esta decisão arquiva a ficha sem possibilidade de invocá-la novamente.</span>
                <button type="button" className="rounded border border-destructive px-2 py-2 text-xs" onClick={() => resolverDerrota(inv.id, 'perda_permanente')}>Confirmar perda permanente</button>
                <button type="button" className="rounded border px-2 py-2 text-xs" onClick={() => setConfirmandoPerdaDerrota(null)}>Cancelar</button>
              </> : <button type="button" className="rounded border px-2 py-2 text-xs" onClick={() => setConfirmandoPerdaDerrota(inv.id)}>Declarar perda permanente</button>}
            </div>
          </div>}
          <div className="basis-full text-xs text-muted-foreground">{rotuloTempo}</div>

          {ativo && automacoesAtivas > 0 && (
            <div className="basis-full flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">Automações OMNI: {automacoesAtivas} regra(s) habilitada(s) · {instancia?.automacaoSuspensa ? 'suspensas nesta instância' : 'disponíveis conforme gatilho e política'}</span>
              {podeIntervirNaAutonomia && <button type="button" className="rounded border px-2 py-1" onClick={() => {
                if (!token) return;
                const resultado = definirAutomacaoInvocacao(token.id, !instancia?.automacaoSuspensa);
                if (!resultado.ok) setErro(resultado.motivo);
                else { setErro(''); setMensagem(instancia?.automacaoSuspensa ? 'Automações retomadas nesta instância.' : 'Automações suspensas nesta instância.'); }
              }}>{instancia?.automacaoSuspensa ? 'Retomar automações' : isMaster ? 'Mestre: suspender automações' : 'Suspender automações'}</button>}
            </div>
          )}
          <div className={'basis-full text-xs ' + (estadoIntermediario.ok ? 'text-muted-foreground' : 'inv-warning')}>Intermediário: {estadoIntermediario.ok ? 'disponível — ' + estadoIntermediario.resumo : 'pendente de validação — ' + estadoIntermediario.motivo}</div>
          <div className={'basis-full text-xs ' + (alcanceConfigurado ? 'text-muted-foreground' : 'inv-warning')}>Alcance de posicionamento: {alcanceConfigurado ? (inv.alcanceInvocacaoM ?? 0) + ' m' : 'não definido — edite a ficha antes de invocar'}</div>
          {inv.origemAquisicao && <div className="basis-full text-xs text-muted-foreground">Origem da aquisição: {inv.origemAquisicao === 'interludio' ? 'Interlúdio' : inv.origemAquisicao}</div>}
          {inv.referenciaInterludio && <div className="basis-full text-xs text-muted-foreground">Referência do Interlúdio: {inv.referenciaInterludio}</div>}
          {isMaster && !emHorda && !estadoIntermediario.ok && podeUsarVersaoAprovada({ estado: inv.aprovacaoMestre, versaoAtual: inv.versaoModelo, versaoAprovada: inv.versaoAprovada }) && !ativos.some(e => e.invocationId === inv.id) && (
            <div className="basis-full flex flex-wrap items-center gap-2">
              <input aria-label={'Motivo do override do intermediário de ' + inv.nome} value={motivosOverride[inv.id] ?? ''} onChange={event => setMotivosOverride(state => ({ ...state, [inv.id]: event.target.value }))} placeholder="Motivo do override do Mestre" className="min-w-48 rounded border bg-background px-2 py-1 text-xs" />

            </div>
          )}
          {inv.aprovacaoMestre === 'rejeitada' && inv.motivoRejeicao && <div className="basis-full text-xs inv-error">Motivo da rejeição: {inv.motivoRejeicao}</div>}
          {inv.aprovacaoMestre === 'rejeitada' && <button type="button" disabled={busyAprovacao} className="rounded border px-2 py-1 text-xs disabled:opacity-50" onClick={() => void reenviarAprovacao(inv.id)}>Solicitar nova aprovação</button>}
          {isMaster && inv.aprovacaoMestre === 'pendente' && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busyAprovacao} className="rounded border border-primary px-2 py-1 text-xs disabled:opacity-50" onClick={() => void decidirAprovacao(inv.id, 'aprovada')}>Aprovar</button>
              <input
                aria-label={`Motivo da rejeição de ${inv.nome}`}
                value={motivosRejeicao[inv.id] ?? ''}
                onChange={e => setMotivosRejeicao(v => ({ ...v, [inv.id]: e.target.value }))}
                placeholder="Motivo da rejeição"
                className="rounded border bg-background px-2 py-1 text-xs"
              />
              <button type="button" disabled={busyAprovacao || !motivosRejeicao[inv.id]?.trim()} className="rounded border px-2 py-1 text-xs disabled:opacity-50" onClick={() => void decidirAprovacao(inv.id, 'rejeitada')}>Rejeitar</button>
            </div>
          )}
          <div className="inv-card-actions flex shrink-0 flex-wrap gap-2">
            {onEditFicha && <button type="button" disabled={emHorda || inv.perdaPermanente || busyAprovacao || inv.aprovacaoMestre === 'pendente'} title={emHorda ? 'A ficha está vinculada a uma Horda.' : undefined} className="rounded border px-2 py-1 text-xs disabled:opacity-50" onClick={() => onEditFicha(inv.id)}>Editar ficha</button>}
            {ativo ? (
              <>
                {estadoInstancia === 'caida' && <button type="button" disabled={(token?.hp ?? 0) <= 0 || !movimentoDisponivel} title={!movimentoDisponivel ? 'Ação de Movimento própria indisponível.' : undefined} className="rounded border px-2 py-1 text-xs disabled:opacity-50" onClick={() => levantar(inv.id)}>Levantar (Ação de Movimento)</button>}
                <button type="button" disabled={estadoInstancia === 'caida'} className="rounded border px-2 py-1 text-xs disabled:opacity-50" onClick={() => comandar(inv.id)}>Comandar movimento (bônus)</button>
                <button type="button" disabled={emHorda} title={emHorda ? 'A dissipação da Horda depende da regra de retorno dos PV compartilhados.' : undefined} className="rounded border px-2 py-1 text-xs disabled:opacity-50" onClick={() => recolher(inv.id)}>Recolher</button>
              </>
            ) : (
                <label className="flex items-center gap-2 rounded border border-primary px-2 py-1 text-xs">
                  <input type="checkbox" aria-label={'Selecionar ' + inv.nome + ' para invocar'} checked={invocacoesSelecionadas.includes(inv.id)} disabled={!!carregandoArteId || !podeSelecionar} onChange={event => setInvocacoesSelecionadas(current => event.target.checked ? (current.includes(inv.id) || current.length >= 2 ? current : [...current, inv.id]) : current.filter(id => id !== inv.id))} />
                  Selecionar para invocar
                </label>
            )}
            <button type="button" disabled={emHorda || inv.perdaPermanente || ativo || derrotaPendente || inv.aprovacaoMestre === 'pendente' || busyAprovacao} title={emHorda ? 'A ficha está vinculada a uma Horda.' : undefined} className="rounded border px-2 py-1 text-xs disabled:opacity-50" onClick={() => remover(inv.id)}>Remover</button>
          </div>
          <InvocationDisclosure className="inv-card-disclosure basis-full space-y-2"><summary>Ataques personalizados · {inv.acoes.filter(a => a.tipo === 'ataque' || a.teste === 'ataque' || a.teste === 'resistencia').length}</summary>
            <div className="flex items-center justify-between gap-2">
              <strong className="text-xs">Ataques personalizados</strong>
              <button type="button" disabled={inv.perdaPermanente || emHorda} className="rounded border px-2 py-1 text-xs disabled:opacity-50" onClick={() => setEditando(editando === inv.id ? null : inv.id)}>Adicionar ataque</button>
            </div>
            {inv.acoes.filter(a => a.tipo === 'ataque' || a.teste === 'ataque' || a.teste === 'resistencia').map(a => (
              <div key={a.id} className="flex items-start justify-between gap-2 text-xs">
                <div className="space-y-1">
                  <div>{a.nome}: {a.dano ?? 'sem dano'} · {a.alcanceM !== undefined ? a.alcanceM + ' m' : 'alcance n\u00e3o definido'} · {a.teste === 'resistencia' ? 'TR: ' + (a.resistenciaAlvo ?? 'n\u00e3o especificado') : 'acerto ' + (calcularBonusAtaqueInvocacao(character, inv, a)?.total ?? a.bonusAtaque ?? 0)}
                    {a.statusAutomacao && <span className="ml-2 rounded border px-1">{a.statusAutomacao === 'executavel' ? 'Automático' : a.statusAutomacao === 'parcial' ? 'Parcial' : 'Manual'}</span>}
                  </div>
                  {a.descricaoRegra && <p className="text-muted-foreground">{a.descricaoRegra}</p>}
                </div>
                <button type="button" disabled={inv.perdaPermanente || emHorda} className="rounded border px-2 py-1 disabled:opacity-50" onClick={() => removerAtaque(inv.id, a.id)}>Excluir</button>
              </div>
            ))}
            {editando === inv.id && !inv.perdaPermanente && !emHorda && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">Nome<input aria-label="Nome do ataque" value={nomeAtaque} onChange={e => setNomeAtaque(e.target.value)} className="w-full rounded border bg-background p-2" /></label>
                <label className="text-xs">Dano<input aria-label="Dados de dano" value={formulaAtaque} onChange={e => setFormulaAtaque(e.target.value)} placeholder="2d12+1d6+3" className="w-full rounded border bg-background p-2" /></label>
                <label className="text-xs">Alcance (m)<input type="number" min="0.1" step="0.5" value={alcanceAtaque} onChange={e => setAlcanceAtaque(Number(e.target.value))} className="w-full rounded border bg-background p-2" /></label>
                <label className="text-xs">Bônus de acerto<input type="number" value={bonusAtaque} onChange={e => setBonusAtaque(Number(e.target.value))} className="w-full rounded border bg-background p-2" /></label>
                <label className="text-xs">Tipo de ataque<InvocationSelect value={tipoAtaqueAtaque} onChange={e => setTipoAtaqueAtaque(e.target.value as 'corpo_a_corpo' | 'distancia')} className="w-full rounded border bg-background p-2"><option value="corpo_a_corpo">Corpo a corpo</option><option value="distancia">À distância</option></InvocationSelect></label>
                <label className="text-xs">Atributo do ataque<InvocationSelect value={atributoAtaqueAtaque} onChange={e => setAtributoAtaqueAtaque(e.target.value as 'forca' | 'destreza')} className="w-full rounded border bg-background p-2"><option value="forca">Força</option><option value="destreza">Destreza</option></InvocationSelect></label>
                <label className="text-xs">Atributo do dano<InvocationSelect value={atributoDanoAtaque} onChange={e => setAtributoDanoAtaque(e.target.value as typeof atributoDanoAtaque)} className="w-full rounded border bg-background p-2"><option value="">Igual ao atributo do ataque</option><option value="forca">Força</option><option value="destreza">Destreza</option><option value="constituicao">Constituição</option><option value="inteligencia">Inteligência</option><option value="sabedoria">Sabedoria</option><option value="presenca">Presença</option></InvocationSelect></label>
                <label className="text-xs">Multiplicador do atributo no dano<InvocationSelect value={multiplicadorDanoAtributoAtaque} onChange={e => setMultiplicadorDanoAtributoAtaque(e.target.value)} className="w-full rounded border bg-background p-2"><option value="">Padrão do grau</option><option value="0">Nenhum</option><option value="1">1×</option><option value="2">2×</option></InvocationSelect></label>
                <label className="text-xs">Margem de crítico<input type="number" min="2" max="20" value={margemCriticoAtaque} onChange={e => setMargemCriticoAtaque(Number(e.target.value))} className="w-full rounded border bg-background p-2" /></label>
                <label className="text-xs">Multiplicador crítico<input type="number" min="1" max="5" value={multiplicadorCriticoAtaque} onChange={e => setMultiplicadorCriticoAtaque(Number(e.target.value))} className="w-full rounded border bg-background p-2" /></label>
                <label className="text-xs">Tipo de dano<InvocationSelect value={tipoDanoAtaque} onChange={e => setTipoDanoAtaque(e.target.value as import('@/types').DamageType)} className="w-full rounded border bg-background p-2">
                  {(['DCO','DP','DI','DA','DCG','DCC','DQ','DS','DAL','DNR','DE','DPS','DR','DN','DV'] as const).map(d => <option key={d} value={d}>{d}</option>)}
                </InvocationSelect></label>
                <button type="button" disabled={inv.perdaPermanente || busyAprovacao || inv.aprovacaoMestre === 'pendente'} className="rounded bg-primary px-2 py-2 text-xs text-primary-foreground disabled:opacity-50" onClick={() => void adicionarAtaque(inv.id)}>Salvar ataque</button>
              </div>
            )}
          </InvocationDisclosure>
          {inv.pacoteRegras === 'dez-sombras' && inv.acoes.some(acao => acao.tipo === 'habilidade') && (
            <InvocationDisclosure className="inv-card-disclosure basis-full space-y-2">
              <summary>Habilidades e traços {inv.acoes.filter(acao => acao.tipo === 'habilidade').length}</summary>
              <ul className="space-y-2 text-xs">
                {inv.acoes.filter(acao => acao.tipo === 'habilidade').map(acao => <li key={acao.id}>
                  <strong>{acao.nome} - {acao.statusAutomacao === 'executavel' ? 'Automático' : acao.statusAutomacao === 'parcial' ? 'Parcial' : 'Manual'}</strong>
                  {acao.descricaoRegra && <p className="text-muted-foreground">{acao.descricaoRegra}</p>}
                  {acao.id === 'segurar' && ehAbismo && ativo && isMaster && <label className="mt-1 block text-xs">
                    Sapos vivos confirmados pelo Mestre (1 a 3)
                    <input type="number" min={1} max={3} step={1} aria-label={'Sapos vivos confirmados para ' + inv.nome}
                      value={quantidadeSaposTexto}
                      onChange={event => setMembrosSapoVivos(atual => ({ ...atual, [inv.id]: event.target.value }))}
                      className="mt-1 block w-24 rounded border bg-background p-1" />
                    <span className="text-muted-foreground">Informe a quantidade atual; ela não é inferida pelos PV.</span>
                  </label>}
                  {acao.id === 'segurar' && ehAbismo && ativo && !isMaster && <p className="mt-1 text-xs text-muted-foreground">Somente o Mestre pode confirmar a quantidade de sapos vivos para este comando.</p>}
                  {acao.id === 'segurar' && ativo && <button type="button"
                    disabled={busySegurar || !alvosAtaque[inv.id] || emHorda || (ehAbismo && (!isMaster || !quantidadeSaposValida))}
                    title={ehAbismo && !isMaster ? 'Somente o Mestre pode confirmar a quantidade de sapos vivos.' : ehAbismo && !quantidadeSaposValida ? 'Informe a quantidade de sapos confirmada pelo Mestre.' : undefined}
                    className="mt-1 rounded border px-2 py-1 disabled:opacity-50"
                    onClick={() => void segurar(inv.id)}>Segurar alvo selecionado</button>}
                  {acao.efeitoEspecial?.tipo === 'vantagem_pericia_controlador' && ativo && <button type="button"
                    disabled={busyHabilidadeId !== null || inv.perdaPermanente || inv.aprovacaoMestre === 'pendente'}
                    className="mt-1 rounded border border-violet-400/40 bg-violet-500/10 px-2 py-1 text-violet-100 disabled:opacity-50"
                    onClick={() => usarHabilidadeInvocacao(inv.id, acao.id)}>
                    {busyHabilidadeId === `${inv.id}:${acao.id}` ? 'Resolvendo…' : `Usar ${acao.nome} · vantagem em ${acao.efeitoEspecial.pericia} para rastrear`}
                  </button>}
                </li>)}
              </ul>
            </InvocationDisclosure>
          )}
          {ativos.some(e => e.invocationId === inv.id) && acoesDeAtaque(inv).length > 0 && (
            <div className="basis-full space-y-2 border-t border-border/60 pt-2">
              {acoesDeAtaque(inv).some(acao => !['multiplo', 'area'].includes(configOmniDaAcao(acao)?.tipo_alvo ?? 'unico')) && <label className="block text-xs">Alvo para ação individual
                <InvocationSelect aria-label={`Alvo de ${inv.nome}`} className="mt-1 w-full rounded border border-input bg-background p-2"
                  value={alvosAtaque[inv.id] ?? ''} onChange={e => setAlvosAtaque(v => ({ ...v, [inv.id]: e.target.value }))}>
                  <option value="">Selecione uma ficha ou invocação no mapa</option>
                  {alvosDisponiveis.filter(alvo => alvo.id !== `invoc:${token?.id}`).map(alvo => <option key={alvo.id} value={alvo.id}>{alvo.nome}</option>)}
                </InvocationSelect>
              </label>}
              {acaoLinguaSombria && ativo && <label className="block text-xs">Aliado para Língua Sombria
                <InvocationSelect aria-label={`Aliado para Língua Sombria de ${inv.nome}`} className="mt-1 w-full rounded border border-input bg-background p-2"
                  value={alvosPuxarGama[inv.id] ?? ''} onChange={event => setAlvosPuxarGama(current => ({ ...current, [inv.id]: event.target.value }))}>
                  <option value="">Selecione um aliado no mapa</option>
                  {alvosAliadosLinguaSombria.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
                </InvocationSelect>
              </label>}
              {acoesDeAtaque(inv).some(acao => configOmniDaAcao(acao)?.tipo_alvo === 'area') && <p className="text-xs text-muted-foreground">Ações em área: ao usar, posicione e confirme a forma no mapa. O raio em si usa o centro da invocação.</p>}
              {acoesDeAtaque(inv).filter(acao => configOmniDaAcao(acao)?.tipo_alvo === 'multiplo').map(acao => {
                const chave = `${inv.id}:${acao.id}`;
                const maxAlvos = configOmniDaAcao(acao)?.max_alvos ?? '?';
                return <label key={acao.id} className="block text-xs">Alvos de {acao.nome} (até {maxAlvos})
                  <InvocationSelect aria-label={`Alvos de ${acao.nome}`} multiple size={Math.min(5, Math.max(2, alvosDisponiveis.length))}
                    className="mt-1 w-full rounded border border-input bg-background p-2"
                    value={alvosAtaqueMultiplo[chave] ?? []}
                    onChange={event => setAlvosAtaqueMultiplo(current => ({
                      ...current,
                      [chave]: Array.from(event.currentTarget.selectedOptions, option => option.value),
                    }))}>
                    {alvosDisponiveis.filter(alvo => alvo.id !== `invoc:${token?.id}`).map(alvo => <option key={alvo.id} value={alvo.id}>{alvo.nome}</option>)}
                  </InvocationSelect>
                </label>;
              })}
              <div className="flex flex-wrap gap-1">
                {acoesDeAtaque(inv).map(a => {
                  const multiplo = configOmniDaAcao(a)?.tipo_alvo === 'multiplo';
                  const area = configOmniDaAcao(a)?.tipo_alvo === 'area';
                  const eLinguaSombria = a.efeitoEspecial?.tipo === 'puxar_aliado_gama';
                  const temAlvos = eLinguaSombria
                    ? Boolean(alvosPuxarGama[inv.id])
                    : multiplo
                    ? (alvosAtaqueMultiplo[`${inv.id}:${a.id}`]?.length ?? 0) > 0
                    : area || Boolean(alvosAtaque[inv.id]);
                  return <button key={a.id} type="button" disabled={busyAtaque || !temAlvos || a.statusAutomacao === 'manual' || (eLinguaSombria && !linguaSombriaDisponivel)}
                    title={eLinguaSombria && !linguaSombriaDisponivel
                      ? linguaSombriaUsada ? 'Língua Sombria já foi usada nesta rodada.' : 'Requer combate ativo e uma Reação disponível do Gama.'
                      : a.statusAutomacao === 'manual' ? 'A fonte deixa uma etapa sem regra suficiente para automação.' : a.statusAutomacao === 'parcial' ? 'O dano/TR foi aplicado; consulte a descrição para os efeitos restantes.' : undefined}
                    onClick={() => void atacar(inv.id, a.id)}
                    className="rounded border border-primary px-2 py-1 text-xs disabled:opacity-50">
                    Usar ação: {a.nome}{a.statusAutomacao === 'parcial' ? ' (parcial)' : a.statusAutomacao === 'manual' ? ' (manual)' : ''}
                  </button>;
                })}
                {janelaAgarrarGama && acaoAgarrarGama?.efeitoEspecial?.tipo === 'agarrar_gama_apos_acerto' && instancia && (
                  <div className="space-y-2">
                    <fieldset className="space-y-1 text-xs text-muted-foreground">
                      <legend className="font-medium text-foreground">Anfíbio Sombrio · +2 em manobras</legend>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={gamaSubmerso} disabled={busyAgarrarGama} onChange={event => setGamaSubmerso(event.target.checked)} />
                        Gama está submerso
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={gamaEscuridaoTotal} disabled={busyAgarrarGama} onChange={event => setGamaEscuridaoTotal(event.target.checked)} />
                        Gama está em Escuridão Total
                      </label>
                      <p>O bônus de +2 é aplicado uma vez, mesmo se as duas condições forem verdadeiras.</p>
                    </fieldset>
                    <button
                      type="button"
                      data-testid="gama-grapple-followup"
                      disabled={busyAgarrarGama || (character.peCurrent ?? 0) < acaoAgarrarGama.efeitoEspecial.custoPE}
                      title={(character.peCurrent ?? 0) < acaoAgarrarGama.efeitoEspecial.custoPE ? 'PE insuficiente para tentar Agarrar.' : undefined}
                      onClick={() => void agarrarGama(inv.id, instancia.id, agarrarLinguaPendente!.eventoId)}
                      className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100 disabled:opacity-50"
                    >
                      {busyAgarrarGama ? 'Resolvendo…' : `Gastar ${acaoAgarrarGama.efeitoEspecial.custoPE} PE e tentar Agarrar · Ação Livre`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {ativos.some(e => e.invocationId === inv.id) && (
            <div className="basis-full space-y-2 border-t border-border/60 pt-2">
              <label className="block text-xs">Teste de perícia da invocação
                <InvocationSelect aria-label={`Perícia de ${inv.nome}`} className="mt-1 w-full rounded border border-input bg-background p-2"
                  value={periciasSelecionadas[inv.id] ?? ''}
                  onChange={event => setPericiasSelecionadas(current => ({ ...current, [inv.id]: event.target.value }))}>
                  <option value="">Selecione uma perícia</option>
                  {(Object.keys(SISTEMA_PERICIAS) as Array<keyof typeof SISTEMA_PERICIAS>).filter(key => invocacaoTreinadaNaPericia(inv, key) || bonusPericiaCaracteristicas(inv, key) > 0).map(key => (
                    <option key={key} value={key}>{ROTULOS_PERICIAS[key]}{invocacaoTreinadaNaPericia(inv, key) ? ' · treinada' : ` · característica +${bonusPericiaCaracteristicas(inv, key)}`}</option>
                  ))}
                  {!Object.keys(SISTEMA_PERICIAS).some(key => invocacaoTreinadaNaPericia(inv, key)) && <option disabled value="">Sem perícias treinadas</option>}
                </InvocationSelect>
              </label>
              <button type="button" disabled={!periciasSelecionadas[inv.id] || !!busyPericia[inv.id]}
                onClick={() => void rolarPericia(inv.id)} className="rounded border px-2 py-1 text-xs disabled:opacity-50">
                {busyPericia[inv.id] ? 'Rolando…' : 'Rolar perícia em 3D'}
              </button>
            </div>
          )}
          {ativo && inv.acoes.some(acao => acao.tipo === 'suporte' && acao.efeitoSuporte) && (
            <div className="basis-full space-y-2 border-t border-border/60 pt-2">
              <strong className="text-xs">Ações de suporte</strong>
              {inv.acoes.filter(acao => acao.tipo === 'suporte' && acao.efeitoSuporte).map(acao => {
                const chave = `${inv.id}:${acao.id}`;
                const alvos = alvosSuporte[chave] ?? [];
                const multiplos = acao.efeitoSuporte?.alvos === 'multiplos';
                return <div key={acao.id} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <label className="block text-xs">{acao.nome} · {acao.efeitoSuporte?.efeito}
                    {acao.todosNoAlcance || acao.somenteProprio
                      ? <span className="mt-1 block text-muted-foreground">{acao.todosNoAlcance ? 'Afeta todas as criaturas visíveis em até ' + (acao.alcanceM ?? 0) + ' m.' : 'Afeta apenas esta invocação.'}</span>
                      : <InvocationSelect aria-label={'Alvo de suporte ' + acao.nome} multiple={multiplos} className="mt-1 min-h-9 w-full rounded border border-input bg-background p-2"
                        value={multiplos ? alvos : (alvos[0] ?? '')}
                        onChange={event => {
                          const valores = multiplos
                            ? Array.from(event.target.selectedOptions, option => option.value).filter(Boolean)
                            : event.target.value ? [event.target.value] : [];
                          setAlvosSuporte(atual => ({ ...atual, [chave]: valores }));
                        }}>
                        <option value="">{multiplos ? 'Selecione um ou mais alvos no mapa' : 'Selecione uma ficha no mapa'}</option>
                        {opcoesAlvoSuporte.map(alvo => <option key={alvo.id} value={alvo.id}>{alvo.nome}</option>)}
                      </InvocationSelect>}
                  </label>
                  <button type="button" disabled={busySuporte || acao.statusAutomacao === 'manual' || (!(acao.todosNoAlcance || acao.somenteProprio) && alvos.length === 0)} title={acao.statusAutomacao === 'manual' ? 'Esta habilidade permanece manual até as lacunas da fonte serem resolvidas.' : undefined} className="self-end rounded border border-primary px-2 py-2 text-xs disabled:opacity-50" onClick={() => void executarSuporte(inv.id, acao.id)}>
                    {acao.statusAutomacao === 'manual' ? 'Manual: ' + acao.nome : acao.todosNoAlcance ? 'Curar todas no alcance' : acao.somenteProprio ? 'Regenerar' : 'Usar suporte'}
                  </button>
                </div>;
              })}
            </div>
          )}
        </div>
        );
      })}
      </OwnedInvocationsCollection>
{view === 'owned' && controlador && invocacoesPossuidas.length > 0 && <div className="inv-library-utilities"><h3>Comandos avançados</h3>
      {controlador && <InvocationDisclosure className="inv-section space-y-2 p-3" aria-label="Criar Horda"><summary>Criar Horda</summary>

        <p className="text-xs text-muted-foreground">Escolha um líder de Primeiro Grau ou inferior e membros de grau inferior ao dele. A Horda ocupa uma vaga e usa uma única ficha de PV; as ações vêm do líder.</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <label className="text-xs">Líder
            <InvocationSelect aria-label="Líder da Horda" value={hordaLiderId} onChange={event => { setHordaLiderId(event.target.value); setHordaMembrosIds([]); }} className="mt-1 w-full rounded border border-input bg-background p-2">
              <option value="">Escolha uma invocação</option>
              {catalogo.filter(inv => inv.grau && inv.grau !== 'especial').map(inv => <option key={inv.id} value={inv.id} disabled={hordaModelosVinculados.has(inv.id) || ativos.some(token => token.invocationId === inv.id) || Boolean(inv.perdaPermanente) || !podeUsarVersaoAprovada({ estado: inv.aprovacaoMestre, versaoAtual: inv.versaoModelo, versaoAprovada: inv.versaoAprovada })}>{inv.apelido?.trim() || inv.nome} · {inv.grau}</option>)}
            </InvocationSelect>
          </label>
          <div className="text-xs">
            <label className="block">Contribuição de tempo da Horda
              <div className="mt-1 grid grid-cols-2 gap-2">
                <input aria-label="Quantidade de tempo da Horda" type="number" min="0" step="any" value={hordaTempoQuantidade} onChange={event => setHordaTempoQuantidade(event.target.value)} placeholder="Quantidade" className="w-full rounded border border-input bg-background p-2" />
                <input aria-label="Unidade de tempo da Horda" value={hordaTempoUnidade} onChange={event => setHordaTempoUnidade(event.target.value)} placeholder="segundos, turnos…" className="w-full rounded border border-input bg-background p-2" />
              </div>
            </label>
            <span className="mt-1 block text-muted-foreground">Sem valor inicial ou limite máximo; informe a quantidade e a unidade a cada criação.</span>
          </div>
        </div>
        {hordaLiderId && <fieldset className="space-y-1 rounded border border-border p-2">
          <legend className="px-1 text-xs">Membros (limite: {Math.max(0, ativas - 1)})</legend>
          {membrosHordaDisponiveis.length === 0
            ? <p className="text-xs text-muted-foreground">Não há membros elegíveis. Confira o grau do líder e as fichas do catálogo.</p>
            : membrosHordaDisponiveis.map(inv => {
              const indisponivel = hordaModelosVinculados.has(inv.id) || ativos.some(token => token.invocationId === inv.id) || Boolean(inv.perdaPermanente) || !podeUsarVersaoAprovada({ estado: inv.aprovacaoMestre, versaoAtual: inv.versaoModelo, versaoAprovada: inv.versaoAprovada });
              return <label key={inv.id} className="flex items-center gap-2 text-xs">
                <input type="checkbox" aria-label={'Adicionar ' + inv.nome + ' à Horda'} checked={hordaMembrosIds.includes(inv.id)} disabled={indisponivel || !!carregandoArteId} onChange={event => setHordaMembrosIds(current => event.target.checked ? [...current, inv.id] : current.filter(id => id !== inv.id))} />
                {inv.apelido?.trim() || inv.nome} · {inv.grau} · PV {inv.hpAtual}/{inv.hpMaximo}{indisponivel ? ' · indisponível' : ''}
              </label>;
            })}
        </fieldset>}
        {hordaPreview?.ok && limiteHordaPreview?.ok
          ? <p className="text-xs" role="status">Prévia: PV compartilhados {hordaPreview.horda.pvAtual}/{hordaPreview.horda.pvMaximo} · custo {hordaPreview.horda.custoInvocacaoPE} PE · {hordaPreview.horda.quantidadeMembros} membro(s) ocupam {hordaPreview.horda.vagasInvocacao} vagas · tempo único +{hordaTempoPreview.ok ? formatarSegundosTempoInvocacao(hordaTempoPreview.segundos) : '—'} s.</p>
          : hordaPreview?.ok && limiteHordaPreview && !limiteHordaPreview.ok
            ? <p className="text-xs inv-warning" role="status">{limiteHordaPreview.motivo}</p>
          : hordaLiderId && hordaMembrosIds.length > 0 && <p className="text-xs inv-warning" role="status">{hordaPreview && !hordaPreview.ok ? hordaPreview.motivo : 'Confira o grau e o tempo da composição.'}</p>}
        <button type="button" className="rounded border border-primary px-3 py-2 text-xs disabled:opacity-50" disabled={!!carregandoArteId || !hordaPreview?.ok || !limiteHordaPreview?.ok || !hordaTempoPreview.ok || !hordaMembrosIds.length} onClick={() => void formarHorda()}>
          {carregandoArteId === 'horda' ? 'Preparando Horda…' : 'Posicionar Horda no mapa'}
        </button>
      </InvocationDisclosure>}
      </div>}
      {view === 'catalog' && <div className="inv-library-utilities"><h3>Mais opções do catálogo</h3>
      <InvocationDisclosure className="inv-section space-y-2 p-4">
        <summary>Importar ou adicionar ficha rápida</summary>
        <label className="block text-xs">Importar do Grimório ou OMNI
          <InvocationSelect value={fonte} onChange={e => setFonte(e.target.value)} className="mt-1 w-full rounded border border-input bg-background p-2">
            <option value="">Criar manualmente</option>
            {fontes.map(f => <option key={`${f.tipo}:${f.id}`} value={`${f.tipo}:${f.id}`}>{f.tipo === 'grimorio' ? 'Grimório' : 'OMNI'} — {f.nome}</option>)}
          </InvocationSelect>
        </label>
        <label className="block text-xs">Tipo
          <InvocationSelect value={tipo} onChange={e => setTipo(e.target.value as TipoInvocacaoControlador)} className="mt-1 w-full rounded border border-input bg-background p-2">
            <option value="shikigami">Shikigami</option><option value="corpo_amaldicoado">Corpo Amaldiçoado</option><option value="maldicao_domada">Maldição Domada</option>
          </InvocationSelect>
        </label>
        {tipo === 'maldicao_domada' && <p role="note" className="text-xs text-muted-foreground">Criar a ficha não adquire a criatura. Ela precisa ser aprovada e a domesticação concluída na campanha; o Mestre registra essa confirmação separadamente.</p>}
        {!escolhido && <>
          <label className="block text-xs">Nome<input value={nome} onChange={e => setNome(e.target.value)} className="mt-1 w-full rounded border border-input bg-background p-2" /></label>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs">PV<input type="number" min="1" value={hp} onChange={e => setHp(Number(e.target.value))} className="w-full rounded border bg-background p-2" /></label>
            <label className="text-xs">Defesa<input type="number" min="0" value={defesa} onChange={e => setDefesa(Number(e.target.value))} className="w-full rounded border bg-background p-2" /></label>
            <label className="text-xs">Deslocamento (m)<input type="number" min="0" value={deslocamento} onChange={e => setDeslocamento(Number(e.target.value))} className="w-full rounded border bg-background p-2" /></label>
          </div>
        </>}
        <label className="block text-xs">Alcance de posicionamento (m)<input aria-label="Alcance de posicionamento" type="number" min="0" step="any" value={alcanceInvocacaoM} onChange={e => setAlcanceInvocacaoM(e.target.value)} className="mt-1 w-full rounded border bg-background p-2" /><span className="mt-1 block text-xs text-muted-foreground">Máxima distância entre o Controlador e o local escolhido no mapa.</span></label>
        <label className="block text-xs">Custo de invocação (PE)<input type="number" min="0" value={custoPE} onChange={e => setCustoPE(Number(e.target.value))} className="mt-1 w-full rounded border bg-background p-2" /></label>

        <button type="button" disabled={busyAprovacao} onClick={() => void salvar()} className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50">Adicionar ao catálogo</button>
      </InvocationDisclosure>
      </div>}

      {view === 'catalog' && <p className="text-xs inv-warning">{controlador ? `Progressão do Controlador: ${max} invocações conhecidas; extras exigem Interlúdio. Limite simultâneo: ${ativas}.` : 'Esta especialização recebe invocações em Interlúdios e mantém uma em campo por padrão.'}</p>}
    </div>
  );
}
