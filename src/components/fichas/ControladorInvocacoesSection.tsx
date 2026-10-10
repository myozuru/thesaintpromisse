import { useEffect, useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useMapStore } from '@/stores/useMapStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { validarIntermediarioInvocacao } from '@/lib/controlador/intermediario';
import { invocarControladores, recolherInvocacao, limparInvocacoesDerrotadas, levantarInvocacao, comandarReposicionamento, comandarAtaque, comandarSuporte, rolarPericiaInvocacao, type DirecaoInvocacao } from '@/lib/controlador/mapa';
import { limiteInvocacoesConhecidas, limiteAtivasPersonagem, validarCatalogoControlador, type InvocacaoControlador, type TipoInvocacaoControlador } from '@/lib/controlador/tipos';
import { podeUsarVersaoAprovada } from '@/lib/controlador/aprovacao';
import { carregarAssetFicha } from '@/lib/controlador/assetFicha';
import { formatarSegundosTempoInvocacao, tempoAdicionalEmSegundos } from '@/lib/controlador/tempo';
import { assetCache } from '@/components/mapa/assetCache';
import { decidirAprovacaoInvocacao, decidirAprovacaoLegadaInvocacao, submeterAprovacaoInvocacao } from '@/lib/controlador/aprovacao.functions';
import { SISTEMA_PERICIAS, ROTULOS_PERICIAS } from '@/lib/omni/constantesDoSistema';
import { invocacaoTreinadaNaPericia, parseFormulaDanoInvocacao } from '@/lib/controlador/rolagens';
import { bonusPericiaCaracteristicas } from '@/lib/controlador/passivas';

type Fonte = { id: string; nome: string; tipo: 'grimorio' | 'omni'; hp: number; defesa: number; deslocamento: number; porte: InvocacaoControlador['porte']; acoes: InvocacaoControlador['acoes'] };
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
      acoes: Array.isArray(c.actions) ? c.actions.map((a: { id?: string; name?: string; damage?: string }, i: number) => ({
        id: String(a.id || i), nome: String(a.name || 'Ação'), tipo: 'ataque' as const, dano: a.damage ? String(a.damage) : undefined,
      })) : [],
    }));
  } catch { return []; }
}
export function ControladorInvocacoesSection({ character, onEditFicha }: { character: Character; onEditFicha?: (id: string) => void }) {
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const allCharacters = useCharacterStore(s => s.characters);
  const isMaster = useRoleStore(s => s.role) === 'MASTER';
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
  const [motivosRejeicao, setMotivosRejeicao] = useState<Record<string, string>>({});
  const [motivosOverride, setMotivosOverride] = useState<Record<string, string>>({});
  const [direcao, setDirecao] = useState<DirecaoInvocacao>('leste');
  const [invocacoesSelecionadas, setInvocacoesSelecionadas] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [alvosAtaque, setAlvosAtaque] = useState<Record<string, string>>({});
  const [alvosAtaqueMultiplo, setAlvosAtaqueMultiplo] = useState<Record<string, string[]>>({});
  const [busyAtaque, setBusyAtaque] = useState(false);
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
            ? `${r.critico ? 'Acerto crítico! ' : 'Acertou! '}Dano aplicado: ${r.dano}. Resultado: ${r.totalAtaque}.`
            : `Ataque errou (resultado ${r.totalAtaque}).`);
      }
    } finally { setBusyAtaque(false); }
  };
  const executarSuporte = async (invocacaoId: string, acaoId: string) => {
    const chave = `${invocacaoId}:${acaoId}`;
    const selecionados = alvosSuporte[chave] ?? [];
    if (!selecionados.length || busySuporte) return;
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
      setErro(error instanceof Error ? error.message : 'Não foi possível rolar a perícia do Shikigami.');
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
  const catalogo = character.invocacoesConhecidas ?? [];
  const assetForFicha = (inv: InvocacaoControlador) => {
    const principal = inv.imagemAssetId ? assetCache.get(inv.imagemAssetId) : null;
    const fallback = inv.imagemFallbackAssetId ? assetCache.get(inv.imagemFallbackAssetId) : null;
    return principal?.ready ? principal : fallback ?? principal;
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
  const fontes: Fonte[] = [
    ...criaturasGrimorio(),
    ...Object.values(entidades).filter(e => e.categoria !== 'condicao' && e.categoria !== 'voto').map(e => ({
      id: e.id, nome: e.nome, tipo: 'omni' as const,
      hp: 10, defesa: 10, deslocamento: 9, porte: 'Médio' as const,
      acoes: (e.acoesAtivas ?? []).map(a => ({
        id: a.id, nome: a.nome, tipo: 'habilidade' as const, alcanceM: a.alcanceM,
        dano: a.dano, entidadeOmniId: e.id,
      })),
    })),
  ];
  const acoesDeAtaque = (inv: InvocacaoControlador) => inv.acoes.filter(a => a.tipo === 'ataque' || a.teste === 'ataque' || a.teste === 'resistencia');
  const alvosDisponiveis = [...new Map(Object.values(entities)
    .filter(entity => entity.characterId && entity.characterId !== character.id && !entity.invocationId && !entity.hidden)
    .map(entity => {
      const alvo = allCharacters.find(item => item.id === entity.characterId);
      return [entity.characterId!, { id: entity.characterId!, nome: alvo?.name ?? entity.label ?? entity.characterId! }] as const;
    })).values()];
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
  return (
    <div className="space-y-3 rounded-lg border border-border p-3 text-sm">
      <div className="font-semibold">Invocações conhecidas: {catalogo.length}/{max ?? 'Interlúdio'} · Em campo: {ativos.length}/{ativas}</div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-40 flex-1 text-xs">Direção dos comandos de movimento
          <select aria-label="Direção do movimento da invocação" value={direcao} onChange={e => setDirecao(e.target.value as DirecaoInvocacao)} className="mt-1 w-full rounded border border-input bg-background p-2">
            <option value="norte">Norte</option><option value="sul">Sul</option><option value="leste">Leste</option><option value="oeste">Oeste</option>
          </select>
        </label>
        <button type="button" className="rounded border border-primary px-3 py-2 text-xs disabled:opacity-50" disabled={!!carregandoArteId || invocacoesSelecionadas.length < 1} onClick={() => void invocarSelecionadas()}>
          {carregandoArteId === 'lote' ? 'Preparando posicionamento…' : 'Invocar selecionadas (' + invocacoesSelecionadas.length + '/2)'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Selecione até duas fichas e clique no mapa para escolher uma célula livre para cada uma. Invocar é Ação Livre por enquanto.</p>
      {mensagem && <p role="status" className="text-xs text-muted-foreground">{mensagem}</p>}
      {catalogo.map(inv => {
        const arte = assetForFicha(inv);
        const estadoIntermediario = validarIntermediarioInvocacao(inv, character, itensInventario, catalogo);
        const token = ativos.find(entity => entity.invocationId === inv.id);
        const ativo = Boolean(token);
        const instancia = token
          ? character.instanciasInvocacao?.find(item => item.id === token.invocationInstanceId || item.tokenId === token.id)
          : [...(character.instanciasInvocacao ?? [])].reverse().find(item => item.modeloId === inv.id);
        const estadoInstancia = token?.invocationState ?? instancia?.estado;
        const contribuicaoTempo = instancia?.contribuicaoTempo;
        const tempoConfigurado = tempoAdicionalEmSegundos(inv.tempoAdicional);
        const rotuloTempo = contribuicaoTempo?.estado === 'consolacao'
          ? `Reserva preservada após derrota: ${formatarSegundosTempoInvocacao(contribuicaoTempo.quantidadeRestante)} s`
          : contribuicaoTempo?.estado === 'ativa'
            ? `Reserva desta instância: ${formatarSegundosTempoInvocacao(contribuicaoTempo.quantidadeRestante)} s`
            : contribuicaoTempo?.estado === 'retirada'
              ? 'Reserva desta instância: retirada por dissipação'
              : contribuicaoTempo?.estado === 'consumida'
                ? 'Reserva desta instância: consumida ou encerrada'
                : !inv.tempoAdicional
                  ? 'Tempo extra: não configurado'
                  : tempoConfigurado.ok
                    ? `Tempo por invocação: +${formatarSegundosTempoInvocacao(tempoConfigurado.segundos)} s`
                    : `Tempo extra inválido: ${tempoConfigurado.motivo}`;
        const derrotaPendente = estadoInstancia === 'derrotada';
        const personagensAlvoSuporte = [...new Map(Object.values(entities)
          .filter(entity => entity.characterId && !entity.invocationId && !entity.hidden &&
            (allCharacters.find(alvo => alvo.id === entity.characterId)?.category !== 'INIMIGO' || entity.characterId === character.id))
          .map(entity => [entity.characterId!, { id: entity.characterId!, nome: entity.label || entity.characterId! }])).values()];
        const invocacoesAlvoSuporte = Object.values(entities)
          .filter(entity => entity.invocationId && entity.ownerCharId && !entity.hidden &&
            (allCharacters.find(alvo => alvo.id === entity.ownerCharId)?.category !== 'INIMIGO' || entity.ownerCharId === character.id))
          .flatMap(entity => {
            const donoAlvo = allCharacters.find(alvo => alvo.id === entity.ownerCharId);
            const modeloAlvo = donoAlvo?.invocacoesConhecidas?.find(modelo => modelo.id === entity.invocationId);
            return modeloAlvo ? [{ id: `invoc:${entity.id}`, nome: `${modeloAlvo.apelido?.trim() || modeloAlvo.nome}${entity.invocationState === 'caida' ? ' · Caído' : ''}` }] : [];
          });
        const opcoesAlvoSuporte = [...personagensAlvoSuporte, ...invocacoesAlvoSuporte];
        const movimentoDisponivel = (instancia?.economiaAcoes?.acaoMovimento?.atual ?? 0) > 0;
        const rotuloEstado = estadoInstancia === 'derrotada'
          ? 'Derrotada — aguardando resolução'
          : estadoInstancia === 'caida'
            ? 'Caída — cura acima de 0 PV e Ação de Movimento própria para levantar'
            : estadoInstancia === 'ativa'
              ? 'Ativa no mapa'
              : estadoInstancia === 'dissipada'
                ? 'Dissipada'
                : 'Pronta';
        const aprovado = podeUsarVersaoAprovada({ estado: inv.aprovacaoMestre, versaoAtual: inv.versaoModelo, versaoAprovada: inv.versaoAprovada });
        const alcanceConfigurado = Number.isFinite(inv.alcanceInvocacaoM) && (inv.alcanceInvocacaoM ?? -1) >= 0;
        const podeSelecionar = !ativo && !derrotaPendente && inv.hpAtual > 0 && aprovado && alcanceConfigurado && (estadoIntermediario.ok || (isMaster && Boolean(motivosOverride[inv.id]?.trim())));
        return (
        <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2">
          <div className="flex items-center gap-2">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border" style={{ borderColor: inv.corIdentificacao ?? '#8055bd' }}>
              {arte ? <img key={assetsTick} src={arte.url} alt={inv.imagemAltText || inv.apelido || inv.nome} className="h-full w-full object-cover" /> : <span className="text-xs text-muted-foreground">Sem arte</span>}
            </div>
            <div><strong>{inv.apelido?.trim() || inv.nome}</strong><div className="text-xs text-muted-foreground">{inv.tipo === 'shikigami' ? 'Shikigami' : 'Corpo Amaldiçoado'} · PV {inv.hpAtual}/{inv.hpMaximo} · Defesa {inv.defesa} · {inv.deslocamentoM} m · {inv.custoInvocacaoPE} PE · {inv.acoes.length} ações</div></div>
          </div>
          <div className={'basis-full text-xs ' + (derrotaPendente ? 'text-destructive' : estadoInstancia === 'caida' ? 'text-amber-300' : 'text-muted-foreground')}>Estado de combate: {rotuloEstado}{estadoInstancia === 'derrotada' && instancia ? ` (PV ${instancia.hpAtual})` : ''}</div>
          <div className="basis-full text-xs text-muted-foreground">{rotuloTempo}</div>
          <div className="basis-full text-xs text-muted-foreground">Aquisição: {inv.aprovacaoMestre === 'pendente' ? 'Aguardando aprovação do Mestre' : inv.aprovacaoMestre === 'rejeitada' ? 'Rejeitada — edite e solicite novamente' : 'Aprovada'}</div>
          <div className={'basis-full text-xs ' + (estadoIntermediario.ok ? 'text-muted-foreground' : 'text-amber-300')}>Intermediário: {estadoIntermediario.ok ? 'disponível — ' + estadoIntermediario.resumo : 'pendente de validação — ' + estadoIntermediario.motivo}</div>
          <div className={'basis-full text-xs ' + (alcanceConfigurado ? 'text-muted-foreground' : 'text-amber-300')}>Alcance de posicionamento: {alcanceConfigurado ? (inv.alcanceInvocacaoM ?? 0) + ' m' : 'não definido — edite a ficha antes de invocar'}</div>
          {inv.origemAquisicao && <div className="basis-full text-xs text-muted-foreground">Origem da aquisição: {inv.origemAquisicao === 'interludio' ? 'Interlúdio' : inv.origemAquisicao}</div>}
          {inv.referenciaInterludio && <div className="basis-full text-xs text-muted-foreground">Referência do Interlúdio: {inv.referenciaInterludio}</div>}
          {isMaster && !estadoIntermediario.ok && podeUsarVersaoAprovada({ estado: inv.aprovacaoMestre, versaoAtual: inv.versaoModelo, versaoAprovada: inv.versaoAprovada }) && !ativos.some(e => e.invocationId === inv.id) && (
            <div className="basis-full flex flex-wrap items-center gap-2">
              <input aria-label={'Motivo do override do intermediário de ' + inv.nome} value={motivosOverride[inv.id] ?? ''} onChange={event => setMotivosOverride(state => ({ ...state, [inv.id]: event.target.value }))} placeholder="Motivo do override do Mestre" className="min-w-48 rounded border bg-background px-2 py-1 text-xs" />

            </div>
          )}
          {inv.aprovacaoMestre === 'rejeitada' && inv.motivoRejeicao && <div className="basis-full text-xs text-destructive">Motivo da rejeição: {inv.motivoRejeicao}</div>}
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
          <div className="flex shrink-0 flex-wrap gap-1">
            {onEditFicha && <button type="button" disabled={busyAprovacao || inv.aprovacaoMestre === 'pendente'} className="rounded border px-2 py-1 text-xs disabled:opacity-50" onClick={() => onEditFicha(inv.id)}>Editar ficha</button>}
            {ativo ? (
              <>
                {estadoInstancia === 'caida' && <button type="button" disabled={(token?.hp ?? 0) <= 0 || !movimentoDisponivel} title={!movimentoDisponivel ? 'Ação de Movimento própria indisponível.' : undefined} className="rounded border px-2 py-1 text-xs disabled:opacity-50" onClick={() => levantar(inv.id)}>Levantar (Ação de Movimento)</button>}
                <button type="button" disabled={estadoInstancia === 'caida'} className="rounded border px-2 py-1 text-xs disabled:opacity-50" onClick={() => comandar(inv.id)}>Comandar movimento (bônus)</button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => recolher(inv.id)}>Recolher</button>
              </>
            ) : (
                <label className="flex items-center gap-2 rounded border border-primary px-2 py-1 text-xs">
                  <input type="checkbox" aria-label={'Selecionar ' + inv.nome + ' para invocar'} checked={invocacoesSelecionadas.includes(inv.id)} disabled={!!carregandoArteId || !podeSelecionar} onChange={event => setInvocacoesSelecionadas(current => event.target.checked ? (current.includes(inv.id) || current.length >= 2 ? current : [...current, inv.id]) : current.filter(id => id !== inv.id))} />
                  Selecionar para invocar
                </label>
            )}
            <button type="button" disabled={ativo || derrotaPendente || inv.aprovacaoMestre === 'pendente' || busyAprovacao} className="rounded border px-2 py-1 text-xs disabled:opacity-50" onClick={() => remover(inv.id)}>Remover</button>
          </div>
          <div className="basis-full space-y-2 border-t border-border/60 pt-2">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-xs">Ataques personalizados</strong>
              <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setEditando(editando === inv.id ? null : inv.id)}>Adicionar ataque</button>
            </div>
            {inv.acoes.filter(a => a.tipo === 'ataque' || a.teste === 'ataque' || a.teste === 'resistencia').map(a => (
              <div key={a.id} className="flex items-center justify-between text-xs">
                <span>{a.nome}: {a.dano ?? 'sem dano'} · {a.alcanceM ?? 1.5} m · acerto {a.bonusAtaque ?? 0}</span>
                <button type="button" className="rounded border px-2 py-1" onClick={() => removerAtaque(inv.id, a.id)}>Excluir</button>
              </div>
            ))}
            {editando === inv.id && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">Nome<input aria-label="Nome do ataque" value={nomeAtaque} onChange={e => setNomeAtaque(e.target.value)} className="w-full rounded border bg-background p-2" /></label>
                <label className="text-xs">Dano<input aria-label="Dados de dano" value={formulaAtaque} onChange={e => setFormulaAtaque(e.target.value)} placeholder="2d12+1d6+3" className="w-full rounded border bg-background p-2" /></label>
                <label className="text-xs">Alcance (m)<input type="number" min="0.1" step="0.5" value={alcanceAtaque} onChange={e => setAlcanceAtaque(Number(e.target.value))} className="w-full rounded border bg-background p-2" /></label>
                <label className="text-xs">Bônus de acerto<input type="number" value={bonusAtaque} onChange={e => setBonusAtaque(Number(e.target.value))} className="w-full rounded border bg-background p-2" /></label>
                <label className="text-xs">Tipo de ataque<select value={tipoAtaqueAtaque} onChange={e => setTipoAtaqueAtaque(e.target.value as 'corpo_a_corpo' | 'distancia')} className="w-full rounded border bg-background p-2"><option value="corpo_a_corpo">Corpo a corpo</option><option value="distancia">À distância</option></select></label>
                <label className="text-xs">Atributo do ataque<select value={atributoAtaqueAtaque} onChange={e => setAtributoAtaqueAtaque(e.target.value as 'forca' | 'destreza')} className="w-full rounded border bg-background p-2"><option value="forca">Força</option><option value="destreza">Destreza</option></select></label>
                <label className="text-xs">Atributo do dano<select value={atributoDanoAtaque} onChange={e => setAtributoDanoAtaque(e.target.value as typeof atributoDanoAtaque)} className="w-full rounded border bg-background p-2"><option value="">Igual ao atributo do ataque</option><option value="forca">Força</option><option value="destreza">Destreza</option><option value="constituicao">Constituição</option><option value="inteligencia">Inteligência</option><option value="sabedoria">Sabedoria</option><option value="presenca">Presença</option></select></label>
                <label className="text-xs">Multiplicador do atributo no dano<select value={multiplicadorDanoAtributoAtaque} onChange={e => setMultiplicadorDanoAtributoAtaque(e.target.value)} className="w-full rounded border bg-background p-2"><option value="">Padrão do grau</option><option value="0">Nenhum</option><option value="1">1×</option><option value="2">2×</option></select></label>
                <label className="text-xs">Margem de crítico<input type="number" min="2" max="20" value={margemCriticoAtaque} onChange={e => setMargemCriticoAtaque(Number(e.target.value))} className="w-full rounded border bg-background p-2" /></label>
                <label className="text-xs">Multiplicador crítico<input type="number" min="1" max="5" value={multiplicadorCriticoAtaque} onChange={e => setMultiplicadorCriticoAtaque(Number(e.target.value))} className="w-full rounded border bg-background p-2" /></label>
                <label className="text-xs">Tipo de dano<select value={tipoDanoAtaque} onChange={e => setTipoDanoAtaque(e.target.value as import('@/types').DamageType)} className="w-full rounded border bg-background p-2">
                  {(['DCO','DP','DI','DA','DCG','DCC','DQ','DS','DAL','DNR','DE','DPS','DR','DN','DV'] as const).map(d => <option key={d} value={d}>{d}</option>)}
                </select></label>
                <button type="button" disabled={busyAprovacao || inv.aprovacaoMestre === 'pendente'} className="rounded bg-primary px-2 py-2 text-xs text-primary-foreground disabled:opacity-50" onClick={() => void adicionarAtaque(inv.id)}>Salvar ataque</button>
              </div>
            )}
          </div>
          {ativos.some(e => e.invocationId === inv.id) && acoesDeAtaque(inv).length > 0 && (
            <div className="basis-full space-y-2 border-t border-border/60 pt-2">
              {acoesDeAtaque(inv).some(acao => !['multiplo', 'area'].includes(configOmniDaAcao(acao)?.tipo_alvo ?? 'unico')) && <label className="block text-xs">Alvo para ação individual
                <select aria-label={`Alvo de ${inv.nome}`} className="mt-1 w-full rounded border border-input bg-background p-2"
                  value={alvosAtaque[inv.id] ?? ''} onChange={e => setAlvosAtaque(v => ({ ...v, [inv.id]: e.target.value }))}>
                  <option value="">Selecione uma ficha no mapa</option>
                  {alvosDisponiveis.map(alvo => <option key={alvo.id} value={alvo.id}>{alvo.nome}</option>)}
                </select>
              </label>}
              {acoesDeAtaque(inv).some(acao => configOmniDaAcao(acao)?.tipo_alvo === 'area') && <p className="text-xs text-muted-foreground">Ações em área: ao usar, posicione e confirme a forma no mapa. O raio em si usa o centro da invocação.</p>}
              {acoesDeAtaque(inv).filter(acao => configOmniDaAcao(acao)?.tipo_alvo === 'multiplo').map(acao => {
                const chave = `${inv.id}:${acao.id}`;
                const maxAlvos = configOmniDaAcao(acao)?.max_alvos ?? '?';
                return <label key={acao.id} className="block text-xs">Alvos de {acao.nome} (até {maxAlvos})
                  <select aria-label={`Alvos de ${acao.nome}`} multiple size={Math.min(5, Math.max(2, alvosDisponiveis.length))}
                    className="mt-1 w-full rounded border border-input bg-background p-2"
                    value={alvosAtaqueMultiplo[chave] ?? []}
                    onChange={event => setAlvosAtaqueMultiplo(current => ({
                      ...current,
                      [chave]: Array.from(event.currentTarget.selectedOptions, option => option.value),
                    }))}>
                    {alvosDisponiveis.map(alvo => <option key={alvo.id} value={alvo.id}>{alvo.nome}</option>)}
                  </select>
                </label>;
              })}
              <div className="flex flex-wrap gap-1">
                {acoesDeAtaque(inv).map(a => {
                  const multiplo = configOmniDaAcao(a)?.tipo_alvo === 'multiplo';
                const area = configOmniDaAcao(a)?.tipo_alvo === 'area';
                  const temAlvos = multiplo
                    ? (alvosAtaqueMultiplo[`${inv.id}:${a.id}`]?.length ?? 0) > 0
                    : area || Boolean(alvosAtaque[inv.id]);
                return <button key={a.id} type="button" disabled={busyAtaque || !temAlvos}
                    onClick={() => void atacar(inv.id, a.id)}
                    className="rounded border border-primary px-2 py-1 text-xs disabled:opacity-50">
                    Usar ação: {a.nome}
                  </button>;
                })}
              </div>
            </div>
          )}
          {ativos.some(e => e.invocationId === inv.id) && (
            <div className="basis-full space-y-2 border-t border-border/60 pt-2">
              <label className="block text-xs">Teste de perícia do Shikigami
                <select aria-label={`Perícia de ${inv.nome}`} className="mt-1 w-full rounded border border-input bg-background p-2"
                  value={periciasSelecionadas[inv.id] ?? ''}
                  onChange={event => setPericiasSelecionadas(current => ({ ...current, [inv.id]: event.target.value }))}>
                  <option value="">Selecione uma perícia</option>
                  {(Object.keys(SISTEMA_PERICIAS) as Array<keyof typeof SISTEMA_PERICIAS>).filter(key => invocacaoTreinadaNaPericia(inv, key) || bonusPericiaCaracteristicas(inv, key) > 0).map(key => (
                    <option key={key} value={key}>{ROTULOS_PERICIAS[key]}{invocacaoTreinadaNaPericia(inv, key) ? ' · treinada' : ` · característica +${bonusPericiaCaracteristicas(inv, key)}`}</option>
                  ))}
                  {!Object.keys(SISTEMA_PERICIAS).some(key => invocacaoTreinadaNaPericia(inv, key)) && <option disabled value="">Sem perícias treinadas</option>}
                </select>
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
                    <select aria-label={`Alvo de suporte ${acao.nome}`} multiple={multiplos} className="mt-1 min-h-9 w-full rounded border border-input bg-background p-2"
                      value={multiplos ? alvos : (alvos[0] ?? '')}
                      onChange={event => {
                        const valores = multiplos
                          ? Array.from(event.target.selectedOptions, option => option.value).filter(Boolean)
                          : event.target.value ? [event.target.value] : [];
                        setAlvosSuporte(atual => ({ ...atual, [chave]: valores }));
                      }}>
                      <option value="">{multiplos ? 'Selecione um ou mais alvos no mapa' : 'Selecione uma ficha no mapa'}</option>
                      {opcoesAlvoSuporte.map(alvo => <option key={alvo.id} value={alvo.id}>{alvo.nome}</option>)}
                    </select>
                  </label>
                  <button type="button" disabled={busySuporte || alvos.length === 0} className="self-end rounded border border-primary px-2 py-2 text-xs disabled:opacity-50" onClick={() => void executarSuporte(inv.id, acao.id)}>
                    Usar suporte
                  </button>
                </div>;
              })}
            </div>
          )}
        </div>
        );
      })}
      <div className="space-y-2 rounded border border-border p-2">
        <strong>Adicionar invocação</strong>
        <label className="block text-xs">Importar do Grimório ou OMNI
          <select value={fonte} onChange={e => setFonte(e.target.value)} className="mt-1 w-full rounded border border-input bg-background p-2">
            <option value="">Criar manualmente</option>
            {fontes.map(f => <option key={`${f.tipo}:${f.id}`} value={`${f.tipo}:${f.id}`}>{f.tipo === 'grimorio' ? 'Grimório' : 'OMNI'} — {f.nome}</option>)}
          </select>
        </label>
        <label className="block text-xs">Tipo
          <select value={tipo} onChange={e => setTipo(e.target.value as TipoInvocacaoControlador)} className="mt-1 w-full rounded border border-input bg-background p-2">
            <option value="shikigami">Shikigami</option><option value="corpo_amaldicoado">Corpo Amaldiçoado</option>
          </select>
        </label>
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
        {erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}
        <button type="button" disabled={busyAprovacao} onClick={() => void salvar()} className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50">Adicionar ao catálogo</button>
      </div>
      <p className="text-xs text-amber-600">{controlador ? `Progressão do livro: ${max} invocações; além disso exige Interlúdio. Limite simultâneo: ${ativas}.` : 'Outras especializações obtêm Shikigamis durante Interlúdios; podem manter apenas 1 invocação em campo por padrão.'}</p>
      <p className="text-xs text-muted-foreground">Invocar é uma Ação Livre por enquanto e gasta PE. Posicione as invocações clicando no mapa, dentro do alcance definido em cada ficha; um uso permite selecionar até duas. Reposicionamento custa uma Ação Bônus e ataques comandados gastam uma Ação Comum.</p>
    </div>
  );
}
