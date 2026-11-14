import { Crosshair, Ruler, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { causarDanoInvocacao, comandarAgarrarGama, comandarAgarrarOrochi, comandarAtaque, comandarAtaqueAdaptativoMahoraga, comandarAtaqueCoelhoDisperso, comandarCargaAereaNue, comandarDispersaoTaticaFugaCoelhos, comandarFugaCoelhos, comandarHabilidadeInvocacao, comandarInerciaImparavelTouro, comandarLevantarInvocacao, comandarMassaEsmagadoraElefante, comandarNeutralizacaoCervo, comandarPuxarAliadoGama, comandarRecuperacaoFerimentoMahoraga, comandarRegeneracaoAdaptativaMahoraga, comandarSoltarCargaNue, comandarSuporte, comandarToqueDaVidaCervo, configurarVontadeDivinaMahoraga, encerrarCondicaoMahoraga, encerrarFugaCoelhos, registrarCondicaoMahoraga, registrarFenomenoRodaMahoraga, registrarFerimentoMahoraga, removerFragilizadoFugaCoelhos, resetarEconomiaManualInvocacao } from '@/lib/controlador/mapa';
import { deslocamentoInvocacaoM, estadoCargaNue, modoMovimentoNue } from '@/lib/controlador/dezSombrasMovimento';
import { condicaoInvocacaoCervo, nivelCondicaoCervo } from '@/lib/controlador/dezSombrasCervo';
import { limitePEAdicionalRegeneracaoMahoraga } from '@/lib/controlador/dezSombrasMahoraga';
import { inerciaImparavelTouroAtiva } from '@/lib/controlador/dezSombras';
import { comandarPredadorApiceTigre } from '@/lib/controlador/mapa';
import { predadorApiceTigreAtivo, TIGRE_FUNEBRE_SUBCATEGORIA } from '@/lib/controlador/dezSombrasTigre';
import { distanciaCircularMetros } from '@/lib/mapa/alcanceCircular';
import { broadcastEntityPatches } from '@/lib/mapa/broadcastEntityPatches';
import { ALL_CONDITIONS, DAMAGE_TYPES, DAMAGE_TYPE_LABELS, type DamageType } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useMapStore } from '@/stores/useMapStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useShikigamiHudStore } from '@/stores/useShikigamiHudStore';
import { GRAU_CONDICAO } from '@/lib/suporteNivel4';

const ACTION_POOLS = [
  ['acaoComum', 'Ação Comum'],
  ['acaoSimples', 'Ação Simples'],
  ['acaoComplexa', 'Ação Complexa'],
  ['acaoMovimento', 'Movimento'],
  ['acaoBonus', 'Ação Bônus'],
  ['acaoLivre', 'Ação Livre'],
  ['reacao', 'Reação'],
] as const;

function idFenomenoMahoraga(nome: string): string {
  return `manual:${nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100)}`;
}

function normalizarIdCondicaoMahoraga(valor: string): string {
  return valor.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

const CONDICOES_ADAPTAVEIS_MAHORAGA = ALL_CONDITIONS.filter(condition =>
  ['fraca', 'media', 'forte', 'extrema'].includes(GRAU_CONDICAO[condition.id] ?? ''),
);

export function ShikigamiOwnerPanel({ tokenId }: { tokenId: string }) {
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [gamaSubmerso, setGamaSubmerso] = useState(false);
  const [gamaEscuridaoTotal, setGamaEscuridaoTotal] = useState(false);
  const [orochiEscuridaoTotal, setOrochiEscuridaoTotal] = useState(false);
  const [nueConfirmacaoAlvoId, setNueConfirmacaoAlvoId] = useState<string | null>(null);
  const [fugaQuantidade, setFugaQuantidade] = useState('1');
  const [fugaPVMaxRestante, setFugaPVMaxRestante] = useState('');
  const [fugaPorteRestante, setFugaPorteRestante] = useState('');
  const [elefanteDominioAtivo, setElefanteDominioAtivo] = useState(false);
  const [toqueCondicaoId, setToqueCondicaoId] = useState('');
  const [mahoragaModoRegeneracao, setMahoragaModoRegeneracao] = useState<'temporarios' | 'cura'>('temporarios');
  const [mahoragaPEAdicional, setMahoragaPEAdicional] = useState('0');
  const [mahoragaUsarGiro, setMahoragaUsarGiro] = useState(false);
  const [mahoragaTipoAdaptativo, setMahoragaTipoAdaptativo] = useState<DamageType | ''>('');
  const [mahoragaDadosRemovidos, setMahoragaDadosRemovidos] = useState('0');
  const [mahoragaDanoManual, setMahoragaDanoManual] = useState('');
  const [mahoragaTipoDanoManual, setMahoragaTipoDanoManual] = useState<DamageType>('DCO');
  const [mahoragaAtaqueMeleeManual, setMahoragaAtaqueMeleeManual] = useState(true);
  const [mahoragaFenomenoManual, setMahoragaFenomenoManual] = useState('');
  const [mahoragaPropriedadeBaseManual, setMahoragaPropriedadeBaseManual] = useState('');
  const [mahoragaFerimentoDescricao, setMahoragaFerimentoDescricao] = useState('');
  const [mahoragaFerimentoComplexo, setMahoragaFerimentoComplexo] = useState(true);
  const [mahoragaMembroSeparado, setMahoragaMembroSeparado] = useState('');
  const [mahoragaMembroDisponivel, setMahoragaMembroDisponivel] = useState(true);
  const [mahoragaFerimentoSelecionado, setMahoragaFerimentoSelecionado] = useState('');
  const [mahoragaFenomenoTipoManual, setMahoragaFenomenoTipoManual] = useState<DamageType | 'sem-dano'>('sem-dano');
  const [mahoragaConditionId, setMahoragaConditionId] = useState(CONDICOES_ADAPTAVEIS_MAHORAGA[0]?.id ?? '');
  const [mahoragaCondicaoOrigemMestre, setMahoragaCondicaoOrigemMestre] = useState(false);
  const [mahoragaFenomenoControleMental, setMahoragaFenomenoControleMental] = useState(false);
  const [mahoragaFenomenoOrigemMestre, setMahoragaFenomenoOrigemMestre] = useState(false);
  const [mahoragaPrioridadeDivina, setMahoragaPrioridadeDivina] = useState<'ultima_ordem' | 'eliminar_ameaca' | 'proteger_corpo'>('ultima_ordem');
  const [mahoragaUltimaOrdem, setMahoragaUltimaOrdem] = useState('');
  const token = useMapStore((state) => state.entities[tokenId]);
  const entities = useMapStore((state) => state.entities);
  const grid = useMapStore((state) => state.gridConfig);
  const characters = useCharacterStore((state) => state.characters);
  const role = useRoleStore((state) => state.role);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const sourceTokenId = useShikigamiHudStore((state) => state.sourceTokenId);
  const selectedTargetId = useShikigamiHudStore((state) => state.selectedTargetId);
  const rangeMode = useShikigamiHudStore((state) => state.rangeMode);
  const interaction = useShikigamiHudStore((state) => state.interaction);
  const measurementPoint = useShikigamiHudStore((state) => state.measurementPoint);
  const error = useShikigamiHudStore((state) => state.error);
  const setRangeMode = useShikigamiHudStore((state) => state.setRangeMode);
  const startTargetSelection = useShikigamiHudStore((state) => state.startTargetSelection);
  const startMeasurement = useShikigamiHudStore((state) => state.startMeasurement);
  const clearTarget = useShikigamiHudStore((state) => state.clearTarget);
  const pendingMove = useMapStore((state) => state.pendingMove);
  const inCombat = useCombatStore((state) => state.inCombat);
  const combatId = useCombatStore((state) => state.combatId);
  const round = useCombatStore((state) => state.round);
  const currentTurnIndex = useCombatStore((state) => state.currentTurnIndex);
  const currentActorId = useCombatStore((state) => state.initiativeOrder[state.currentTurnIndex]?.charId);

  const owner = characters.find((character) => character.id === token?.ownerCharId);
  const model = owner?.invocacoesConhecidas?.find((invocation) => invocation.id === token?.invocationId);
  const instance = owner?.instanciasInvocacao?.find((item) => item.id === token?.invocationInstanceId);
  const grappleAction = model?.acoes.find((item) => item.efeitoEspecial?.tipo === 'agarrar_gama_apos_acerto');
  const orochiGrappleAction = model?.acoes.find((item) => item.efeitoEspecial?.tipo === 'agarrar_orochi_apos_acerto');
  const shadowTongueUsedThisRound = Boolean(instance?.usoLinguaSombriaGama &&
    instance.usoLinguaSombriaGama.combateId === combatId && instance.usoLinguaSombriaGama.rodada === round);
  const shadowTongueAvailable = Boolean(inCombat && combatId && instance?.estado === 'ativa' &&
    (instance.economiaAcoes?.reacao?.atual ?? 0) > 0 && !shadowTongueUsedThisRound);
  const isNue = model?.subcategoria === 'dez-sombras:nue';
  const isElefante = model?.subcategoria === 'dez-sombras:elefante-maximo';
  const isCervo = model?.subcategoria === 'dez-sombras:cervo-circular';
  const isTouro = model?.subcategoria === 'dez-sombras:touro-perfurante';
  const isMahoraga = model?.subcategoria === 'dez-sombras:mahoraga';
  const isTigre = model?.subcategoria === TIGRE_FUNEBRE_SUBCATEGORIA;
  const mahoragaState = instance?.estadoMahoraga;
  const tigreState = instance?.estadoTigreFunebre;
  const tigreSangramentos = useMemo(() => {
    if (!isTigre || !owner || !instance) return [];
    const alvos: Array<{ key: string; nome: string }> = [];
    for (const personagem of characters) {
      for (const condition of personagem.activeConditions ?? []) {
        if (condition.conditionId !== 'sangramento' || condition.sourceEntityId !== 'tigre-funebre' ||
          condition.sourceCharId !== owner.id || condition.sourceInstanceId !== instance.id) continue;
        alvos.push({ key: `personagem:${personagem.id}:${condition.id}`, nome: personagem.name });
      }
      for (const alvoInstance of personagem.instanciasInvocacao ?? []) {
        const alvoModel = personagem.invocacoesConhecidas?.find(item => item.id === alvoInstance.modeloId);
        for (const rawCondition of alvoInstance.condicoes ?? []) {
          if (!rawCondition || typeof rawCondition !== 'object') continue;
          const condition = rawCondition as { id?: unknown; conditionId?: unknown; sourceEntityId?: unknown; sourceCharId?: unknown; sourceInstanceId?: unknown };
          if (condition.conditionId !== 'sangramento' || condition.sourceEntityId !== 'tigre-funebre' ||
            condition.sourceCharId !== owner.id || condition.sourceInstanceId !== instance.id) continue;
          alvos.push({
            key: `invocacao:${alvoInstance.id}:${typeof condition.id === 'string' ? condition.id : 'sangramento'}`,
            nome: alvoModel?.apelido?.trim() || alvoModel?.nome || 'Invocação',
          });
        }
      }
    }
    return alvos;
  }, [isTigre, owner, instance, characters]);
  const tigrePredadorAtivo = predadorApiceTigreAtivo(tigreState, round, combatId ?? undefined);
  const tigrePredadorPendente = Boolean(tigreState?.predadorApice &&
    tigreState.predadorApice.combateId === combatId && tigreState.predadorApice.rodadaAlvo > round);
  const mahoragaFerimentos = mahoragaState?.ferimentosComplexos ?? [];
  const mahoragaFerimentoAtivo = mahoragaFerimentos.find(item => item.id === mahoragaFerimentoSelecionado) ?? mahoragaFerimentos[0];
  const limitePEMahoraga = limitePEAdicionalRegeneracaoMahoraga(model?.atributos?.constituicao ?? 28);
  const tiposAdaptadosMahoraga = [...new Set((mahoragaState?.fenomenos ?? []).flatMap(fenomeno =>
    fenomeno.giros === 5 && fenomeno.tipoDano ? [fenomeno.tipoDano] : [],
  ))];
  const mahoragaCondicoesAtivas = (instance?.condicoes ?? []).flatMap(raw => {
    const conditionId = typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object' && typeof (raw as { conditionId?: unknown }).conditionId === 'string'
        ? (raw as { conditionId: string }).conditionId
        : '';
    if (!conditionId) return [];
    const definicao = ALL_CONDITIONS.find(item => normalizarIdCondicaoMahoraga(item.id) === normalizarIdCondicaoMahoraga(conditionId));
    return [{ conditionId: normalizarIdCondicaoMahoraga(conditionId), name: definicao?.name ?? conditionId }];
  });
  const mahoragaCondicaoSelecionada = CONDICOES_ADAPTAVEIS_MAHORAGA.find(condition => condition.id === mahoragaConditionId);
  const ownerIncapacitado = Boolean(owner?.dying || owner?.unconsciousFromExhaustion || owner?.activeConditions?.some(condition =>
    condition.conditionId === 'inconsciente' || condition.conditionId === 'desmaiado',
  ));
  useEffect(() => {
    if (mahoragaState?.vontadeDivina?.prioridade) setMahoragaPrioridadeDivina(mahoragaState.vontadeDivina.prioridade);
    if (mahoragaState?.vontadeDivina?.ultimaOrdem) setMahoragaUltimaOrdem(mahoragaState.vontadeDivina.ultimaOrdem);
  }, [tokenId, mahoragaState?.vontadeDivina?.prioridade, mahoragaState?.vontadeDivina?.ultimaOrdem]);
  const touroInerciaAtiva = Boolean(instance && inerciaImparavelTouroAtiva(
    instance.inerciaImparavelTouro,
    { inCombat, combatId, round },
  ));
  const isCoelhoDisperso = token?.invocationSubordinate?.kind === 'fuga-coelho';
  const isFugaCoelhos = model?.subcategoria === 'dez-sombras:fuga-do-coelho' && !isCoelhoDisperso;
  const coelhosDispersosAtivos = isFugaCoelhos && token && instance
    ? Object.values(entities).filter(entity => entity.invocationSubordinate?.kind === 'fuga-coelho' &&
      entity.invocationSubordinate.parentTokenId === token.id && entity.invocationInstanceId === instance.id &&
      (entity.hp ?? 0) > 0 && (!entity.invocationState || entity.invocationState === 'ativa')).length
    : 0;
  const fugaFragilizada = Boolean(instance?.condicoes?.some(condicao =>
    typeof condicao === 'object' && condicao !== null &&
    (condicao as { conditionId?: unknown }).conditionId === 'fragilizado',
  ));
  const estadoCrescimentoCoelhos = instance?.crescimentoFugaCoelhos;
  const rodadaInicioCoelhos = estadoCrescimentoCoelhos && estadoCrescimentoCoelhos.combateId === combatId
    ? estadoCrescimentoCoelhos.rodadaInicio
    : instance?.combateId && instance.combateId === combatId ? instance.rodadaCriacao : inCombat ? 1 : undefined;
  const proximaRodadaCrescimentoCoelhos = rodadaInicioCoelhos === undefined
    ? undefined
    : rodadaInicioCoelhos + (Math.floor(Math.max(0, round - rodadaInicioCoelhos) / 3) + 1) * 3;
  const incrementoPVCoelhos = Math.floor((model?.hpMaximo ?? 0) / 5);
  const nueMovementMode = token ? modoMovimentoNue(token) : 'voo';
  const nueMovementRange = token ? deslocamentoInvocacaoM(token.id, nueMovementMode) : 0;
  const nueCargo = token ? estadoCargaNue(token.id) : null;
  const pendingGrapple = instance?.agarrarLinguaPendente;
  const grappleAvailable = Boolean(pendingGrapple && inCombat && currentActorId === owner?.id &&
    pendingGrapple.combateId === combatId && pendingGrapple.rodada === round &&
    pendingGrapple.turnoIndex === currentTurnIndex && instance?.estado === 'ativa');
  const pendingOrochiGrapple = instance?.agarrarOrochiPendente;
  const orochiGrappleAvailable = Boolean(pendingOrochiGrapple && inCombat && currentActorId === owner?.id &&
    pendingOrochiGrapple.combateId === combatId && pendingOrochiGrapple.rodada === round &&
    pendingOrochiGrapple.turnoIndex === currentTurnIndex && instance?.estado === 'ativa');
  const target = selectedTargetId ? entities[selectedTargetId] : undefined;
  const targetCommandId = target?.invocationId
    ? `invoc:${target.id}`
    : target?.characterId ?? (target
      ? characters.find((character) => character.profileId &&
        (character.profileId === target.avatarProfileId || character.profileId === target.ownerProfileId))?.id
      : undefined);
  const targetForCondition = targetCommandId?.startsWith('invoc:')
    ? entities[targetCommandId.slice('invoc:'.length)]
    : target;
  const targetOwnerForCondition = targetForCondition?.ownerCharId
    ? characters.find(character => character.id === targetForCondition.ownerCharId)
    : targetCommandId ? characters.find(character => character.id === targetCommandId) : undefined;
  const targetInstanceForCondition = targetForCondition?.invocationInstanceId
    ? targetOwnerForCondition?.instanciasInvocacao?.find(item => item.id === targetForCondition.invocationInstanceId)
    : undefined;
  const toqueConditionOptions = useMemo(() => {
    if (targetForCondition?.invocationId) {
      return (targetInstanceForCondition?.condicoes ?? []).map((condition, index) => condicaoInvocacaoCervo(condition, index))
        .filter((condition): condition is NonNullable<typeof condition> => !!condition && nivelCondicaoCervo(condition.conditionId) !== null);
    }
    return (targetOwnerForCondition?.activeConditions ?? []).map(condition => ({
      selectionId: condition.id,
      conditionId: condition.conditionId,
      name: condition.name,
      icon: condition.icon,
      raw: condition,
    })).filter(condition => nivelCondicaoCervo(condition.conditionId) !== null);
  }, [targetForCondition?.invocationId, targetInstanceForCondition?.condicoes, targetOwnerForCondition?.activeConditions]);
  const toqueCondicaoSelecionada = toqueConditionOptions.some(condition => condition.selectionId === toqueCondicaoId)
    ? toqueCondicaoId
    : toqueConditionOptions[0]?.selectionId ?? '';
  const action = rangeMode?.kind === 'action'
    ? model?.acoes.find((item) => item.id === rangeMode.actionId)
    : undefined;
  const rangeMeters = rangeMode?.kind === 'movement'
    ? nueMovementRange
    : action?.alcanceM;
  const measuredPoint = target ? { x: target.x, y: target.y } : measurementPoint;
  const measuredMeters = token && measuredPoint
    ? distanciaCircularMetros(token, measuredPoint, grid)
    : null;

  const resources = useMemo(() => model?.recursosConfigurados ?? [], [model?.recursosConfigurados]);
  const hasManualReset = Boolean(model && (
    Object.values(model.economiaAcoesConfigurada?.resetPorCategoria ?? {}).includes('manual') ||
    model.acoes.some((invocationAction) => invocationAction.recargaConfigurada?.unidade === 'manual') ||
    resources.some((resource) => resource.recargaConfigurada?.unidade === 'manual')
  ));

  const executeAction = async (actionId: string) => {
    if (!model || !owner || busyActionId) return;
    const action = model.acoes.find((item) => item.id === actionId);
    if (!action) return;
    const precisaAlvo = !action.area && !action.somenteProprio && action.efeitoEspecial?.tipo !== 'vantagem_pericia_controlador';
    if (precisaAlvo && !targetCommandId) {
      setFeedback({ ok: false, message: 'Selecione um token ligado a uma ficha válida antes de executar esta ação.' });
      return;
    }
    const dadosReduzidos = Number(mahoragaDadosRemovidos);
    if (isMahoraga && action.id === 'punho-do-exterminio' &&
      (!Number.isInteger(dadosReduzidos) || dadosReduzidos < 0 || dadosReduzidos > 4)) {
      setFeedback({ ok: false, message: 'O Punho pode remover de 0 a 4 dados da fórmula.' });
      return;
    }

    setBusyActionId(actionId);
    setFeedback(null);
    const requestId = `hud-${token.id}-${actionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const opcoes = {
      instanciaId: token.invocationInstanceId ?? instance?.id,
      requestId,
      ...(isMahoraga && action.id === 'punho-do-exterminio' ? { dadosReduzidos } : {}),
    };
    try {
      if (isTouro && action.id === 'inercia-imparavel') {
        const result = comandarInerciaImparavelTouro(owner.id, model.id, opcoes);
        setFeedback(result.ok
          ? { ok: true, message: `Inércia Imparável ativa: deslocamento de ${result.deslocamentoM} m e Investida +2 níveis até o fim da rodada.` }
          : { ok: false, message: result.motivo });
      } else if (isTigre && action.id === 'predador-apice') {
        const result = comandarPredadorApiceTigre(owner.id, model.id, opcoes);
        setFeedback(result.ok
          ? { ok: true, message: `Predador Ápice preparado: dois Retalhares na rodada ${result.rodadaAlvo}, ignorando 8 RD e a RD de criaturas de 2º Grau ou inferior.` }
          : { ok: false, message: result.motivo });
      } else if (action.efeitoEspecial?.tipo === 'neutralizacao_cervo') {
        const result = comandarNeutralizacaoCervo(owner.id, model.id, opcoes);
        setFeedback(result.ok
          ? { ok: true, message: `Neutralização: ${result.dissipadas} efeito(s) dissipado(s); ${result.testes} TR(s) de Vontade enviados contra CD ${result.cd}.` }
          : { ok: false, message: result.motivo });
      } else if (action.efeitoEspecial?.tipo === 'toque_da_vida_cervo') {
        if (!toqueCondicaoSelecionada || !targetCommandId) {
          setFeedback({ ok: false, message: 'Selecione um aliado adjacente com uma condição Fraca, Média, Forte ou Extrema.' });
        } else {
          const result = comandarToqueDaVidaCervo(owner.id, model.id, targetCommandId, toqueCondicaoSelecionada, opcoes);
          setFeedback(result.ok
            ? { ok: true, message: `${result.condicao} removida; ${result.custoPE} PE e ${result.categoriaAcao === 'movimento' ? 'Movimento' : 'Ação Complexa'} consumidos.` }
            : { ok: false, message: result.motivo });
        }
      } else if (isElefante && action.id === 'massa-esmagadora') {
        const result = await comandarMassaEsmagadoraElefante(owner.id, model.id, targetCommandId!, {
          ...opcoes,
          dominioAtivo: role === 'MASTER' && elefanteDominioAtivo,
        });
        setFeedback(result.ok
          ? { ok: true, message: `${result.alvo}: ${result.formula} (${result.dano} de impacto); Caído aplicado se o alvo permaneceu consciente.` }
          : { ok: false, message: result.motivo });
      } else if (action.tipo === 'ataque') {
        const alvo = action.area ? { tipo: 'area' as const } : targetCommandId!;
        const result = await comandarAtaque(owner.id, model.id, action.id, alvo, opcoes);
        if (!result.ok) {
          setFeedback({ ok: false, message: result.motivo });
        } else if ('resultados' in result) {
          const testesPendentes = result.resultados.filter((item) => item.testePendente).length;
          if (testesPendentes > 0) {
            setFeedback({ ok: true, message: `${testesPendentes} teste(s) de resistência enviado(s); o dano será aplicado após as rolagens.` });
          } else {
            const acertos = result.resultados.filter((item) => item.acertou).length;
            const dano = result.resultados.reduce((total, item) => total + item.dano, 0);
            setFeedback({ ok: true, message: `${acertos}/${result.resultados.length} acerto(s); ${dano} de dano aplicado.` });
          }
        } else if (result.testePendente) {
          setFeedback({ ok: true, message: `Teste enviado ao alvo (CD ${result.cd ?? '—'}); o efeito será aplicado após a rolagem.` });
        } else {
          setFeedback({
            ok: true,
            message: result.acertou
              ? `${result.critico ? 'Acerto crítico' : 'Acerto'}: ${result.dano} de dano.${result.vantagemEmergir ? ' Vantagem de Emergir das Sombras aplicada.' : ''}${result.efeitoOpcional?.tipo === 'agarrar_gama' || result.efeitoOpcional?.tipo === 'agarrar_orochi' ? ` Pode gastar ${result.efeitoOpcional.custoPE} PE para tentar Agarrar como Ação Livre.` : ''}`
              : `Ataque errou (total ${result.totalAtaque}).`,
          });
        }
      } else if (action.tipo === 'suporte' && action.efeitoSuporte) {
        const result = await comandarSuporte(owner.id, model.id, action.id, [targetCommandId!], opcoes);
        setFeedback(result.ok
          ? { ok: true, message: `${result.efeito}: ${result.valor} aplicado a ${result.alvos} alvo(s).` }
          : { ok: false, message: result.motivo });
      } else if (action.efeitoEspecial?.tipo === 'vantagem_pericia_controlador') {
        const result = comandarHabilidadeInvocacao(owner.id, model.id, action.id, opcoes);
        setFeedback(result.ok
          ? { ok: true, message: `Vantagem concedida no próximo teste de ${result.pericia} para rastreamento.` }
          : { ok: false, message: result.motivo });
      } else if (action.efeitoEspecial?.tipo === 'puxar_aliado_gama') {
        const result = comandarPuxarAliadoGama(owner.id, model.id, targetCommandId!, opcoes);
        setFeedback(result.ok
          ? { ok: true, message: `${result.nomeAlvo} foi puxado para um espaço adjacente ao Gama, sem provocar ataques de oportunidade.` }
          : { ok: false, message: result.motivo });
      }
    } catch {
      setFeedback({ ok: false, message: 'A ação foi interrompida. Confira o log de combate e os recursos da invocação.' });
    } finally {
      setBusyActionId(null);
    }
  };

  const removerFragilidadeFuga = () => {
    if (!owner || !instance || !token) return;
    const resultado = removerFragilizadoFugaCoelhos(owner.id, token.id, instance.id);
    setFeedback(resultado.ok
      ? { ok: true, message: 'Fragilizada removida da Horda por resolução manual.' }
      : { ok: false, message: resultado.motivo });
  };

  const usarFugaCoelhos = () => {
    if (!owner || !model || !instance || !target) return;
    const requestId = `hud-${token.id}-fuga-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const resultado = comandarFugaCoelhos(owner.id, model.id, target.id, { instanciaId: instance.id, requestId });
    setFeedback(resultado.ok
      ? { ok: true, message: `Fuga aplicada em ${resultado.alvo}. A duração precisa ser encerrada pela mesa.` }
      : { ok: false, message: resultado.motivo });
  };

  const encerrarAlvoFuga = () => {
    if (!owner || !instance) return;
    const resultado = encerrarFugaCoelhos(owner.id, instance.id);
    setFeedback(resultado.ok
      ? { ok: true, message: 'Fuga encerrada.' }
      : { ok: false, message: resultado.motivo });
  };

  const usarDispersaoTatica = () => {
    if (!owner || !model || !instance || !token || !isFugaCoelhos) return;
    const resultado = comandarDispersaoTaticaFugaCoelhos(
      owner.id, model.id, Number(fugaQuantidade), Number(fugaPVMaxRestante), fugaPorteRestante,
      { instanciaId: instance.id, requestId: `hud-${token.id}-dispersao-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    );
    setFeedback(resultado.ok
      ? { ok: true, message: `${resultado.quantidade} coelho(s) liberados; Horda com ${resultado.hpAtualRestante}/${resultado.hpMaximoRestante} PV e porte ${resultado.porteRestante}.` }
      : { ok: false, message: resultado.motivo });
  };

  const atacarComCoelhoDisperso = async () => {
    if (!owner || !token || !targetCommandId || !isCoelhoDisperso || busyActionId) return;
    const actionId = 'ataque-coelho-disperso';
    setBusyActionId(actionId);
    setFeedback(null);
    try {
      const resultado = await comandarAtaqueCoelhoDisperso(owner.id, token.id, targetCommandId, {
        requestId: `hud-${token.id}-ataque-${combatId ?? 'fora'}-${round ?? 0}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      setFeedback(resultado.ok
        ? { ok: true, message: resultado.acertou
          ? `Acerto${resultado.critico ? ' crítico' : ''}: ${resultado.totalAtaque} vs Defesa ${resultado.defesa}; 1 dano fixo.`
          : `Erro: ${resultado.totalAtaque} vs Defesa ${resultado.defesa}.` }
        : { ok: false, message: resultado.motivo });
    } catch {
      setFeedback({ ok: false, message: 'O ataque foi interrompido; confira o estado do coelho e do alvo antes de repetir.' });
    } finally {
      setBusyActionId(null);
    }
  };

  const usarAgarrarGama = async () => {
    if (!owner || !model || !instance || busyActionId) return;
    const actionId = 'agarrar-gama';
    setBusyActionId(actionId);
    setFeedback(null);
    try {
      const result = await comandarAgarrarGama(owner.id, model.id, {
        instanciaId: instance.id,
        requestId: `hud-gama-grapple-${pendingGrapple?.eventoId}`,
        contextoAmbiente: { submerso: gamaSubmerso, escuridaoTotal: gamaEscuridaoTotal },
      });
      const bonusSituacional = result.ok && result.bonusSituacional > 0 ? ' (+2 Anfíbio Sombrio)' : '';
      setFeedback(result.ok
        ? {
          ok: true,
          message: result.sucesso
            ? result.aplicouCondicao ? `${result.nomeAlvo} ficou Agarrado${bonusSituacional}.` : `A disputa foi vencida, mas a condição não foi aplicada${bonusSituacional}.`
            : `${result.nomeAlvo} resistiu ao Agarrar${bonusSituacional}.`,
        }
        : { ok: false, message: result.motivo });
    } catch {
      setFeedback({ ok: false, message: 'A tentativa foi interrompida. Confira o log e o saldo de PE.' });
    } finally {
      setBusyActionId(null);
    }
  };

  const usarAgarrarOrochi = async () => {
    if (!owner || !model || !instance || busyActionId) return;
    setBusyActionId('agarrar-orochi');
    setFeedback(null);
    try {
      const result = await comandarAgarrarOrochi(owner.id, model.id, {
        instanciaId: instance.id,
        requestId: `hud-orochi-grapple-${pendingOrochiGrapple?.eventoId}`,
        escuridaoTotal: orochiEscuridaoTotal,
      });
      const bonusEscuridao = result.ok && result.bonusEscuridao > 0 ? ' (+2 em Escuridão Total)' : '';
      setFeedback(result.ok
        ? {
          ok: true,
          message: result.sucesso
            ? `${result.nomeAlvo} ficou Agarrado${bonusEscuridao} e sofrerá 2 de dano de Força no início de cada turno.`
            : `${result.nomeAlvo} resistiu ao Agarrar${bonusEscuridao}.`,
        }
        : { ok: false, message: result.motivo });
    } catch {
      setFeedback({ ok: false, message: 'A tentativa foi interrompida. Confira o log e o saldo de PE.' });
    } finally {
      setBusyActionId(null);
    }
  };

  const alterarModoMovimentoNue = (modo: 'voo' | 'caminhada') => {
    if (!token || !isNue || pendingMove?.entityId === token.id || busyActionId) return;
    const map = useMapStore.getState();
    map.pushHistory();
    map.updateEntity(token.id, { invocationMovementMode: modo });
    broadcastEntityPatches([{ id: token.id, patch: { invocationMovementMode: modo } }]);
    setRangeMode({ kind: 'movement' });
    setFeedback(null);
  };

  const comandarCargaNue = () => {
    if (!owner || !token || !target || !isNue) return;
    const resultado = comandarCargaAereaNue(owner.id, token.id, target.id, nueConfirmacaoAlvoId === target.id);
    setFeedback(resultado.ok
      ? { ok: true, message: `Alvo carregado. Penalidade de voo atual: −${resultado.penalidadeVooM} m.` }
      : { ok: false, message: resultado.motivo });
    if (resultado.ok) setNueConfirmacaoAlvoId(null);
  };

  const soltarCargaNue = () => {
    if (!owner || !token || !target || !isNue) return;
    const resultado = comandarSoltarCargaNue(owner.id, token.id, target.id);
    setFeedback(resultado.ok
      ? { ok: true, message: 'Alvo solto na posição atual.' }
      : { ok: false, message: resultado.motivo });
  };

  const usarRegeneracaoMahoraga = async (origemRoda: boolean) => {
    if (!owner || !model || !instance || !isMahoraga || busyActionId) return;
    const actionId = origemRoda ? 'regeneracao-mahoraga-roda' : 'regeneracao-mahoraga';
    setBusyActionId(actionId);
    setFeedback(null);
    try {
      const resultado = await comandarRegeneracaoAdaptativaMahoraga(owner.id, model.id, {
        requestId: `hud-${token.id}-${actionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        modo: mahoragaModoRegeneracao,
        peAdicional: Number(mahoragaPEAdicional),
        ...(origemRoda ? { origemRoda: true } : {}),
      });
      setFeedback(resultado.ok
        ? { ok: true, message: `Regeneração: ${resultado.valorPV} ${resultado.modo === 'cura' ? 'PV curados' : 'PV temporários'}; ${resultado.custoPE} PE e ${resultado.categoriaAcao}.` }
        : { ok: false, message: resultado.motivo });
    } catch {
      setFeedback({ ok: false, message: 'A regeneração foi interrompida antes de confirmar os custos. Confira os PV e o log antes de tentar de novo.' });
    } finally {
      setBusyActionId(null);
    }
  };

  const registrarFerimentoMahoragaManual = () => {
    if (!owner || !model || role !== 'MASTER') return;
    const resultado = registrarFerimentoMahoraga(owner.id, model.id, {
      descricao: mahoragaFerimentoDescricao,
      ferimentoComplexo: mahoragaFerimentoComplexo,
      ...(mahoragaMembroSeparado.trim() ? {
        membroSeparado: mahoragaMembroSeparado.trim(),
        membroDisponivel: mahoragaMembroDisponivel,
      } : {}),
    });
    if (resultado.ok) {
      setMahoragaFerimentoSelecionado(resultado.ferimentoId);
      setMahoragaFerimentoDescricao('');
      setMahoragaMembroSeparado('');
    }
    setFeedback(resultado.ok
      ? { ok: true, message: 'Ferimento e anatomia registrados pelo Mestre.' }
      : { ok: false, message: resultado.motivo });
  };

  const recuperarFerimentoMahoraga = (operacao: 'curar_ferimento' | 'reanexar_membro') => {
    if (!owner || !model || !mahoragaFerimentoAtivo || busyActionId) return;
    const resultado = comandarRecuperacaoFerimentoMahoraga(owner.id, model.id, {
      requestId: `hud-${tokenId}-recuperacao-ferimento-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ferimentoId: mahoragaFerimentoAtivo.id,
      operacao,
    });
    setFeedback(resultado.ok
      ? { ok: true, message: operacao === 'curar_ferimento'
        ? `Ferimento Complexo regenerado por ${resultado.custoPE} PE e ${resultado.categoriaAcao}.`
        : `Membro reanexado por ${resultado.custoPE} PE e Ação Simples.` }
      : { ok: false, message: resultado.motivo });
  };

  const prepararAtaqueAdaptativoMahoraga = () => {
    if (!owner || !model || !isMahoraga || !mahoragaTipoAdaptativo) return;
    const resultado = comandarAtaqueAdaptativoMahoraga(owner.id, model.id, {
      tipoDano: mahoragaTipoAdaptativo,
      requestId: `hud-${token.id}-ataque-adaptativo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
    setFeedback(resultado.ok
      ? { ok: true, message: `Próximo ataque preparado com ${DAMAGE_TYPE_LABELS[resultado.tipoDano]}.` }
      : { ok: false, message: resultado.motivo });
  };

  const registrarFenomenoMahoragaManual = () => {
    if (!owner || !model || !token || !instance || !isMahoraga || role !== 'MASTER') return;
    const nome = mahoragaFenomenoManual.trim();
    const propriedadeBase = mahoragaPropriedadeBaseManual.trim();
    if (!nome) {
      setFeedback({ ok: false, message: 'Informe o nome da fonte antes de registrar o contato.' });
      return;
    }
    if (!propriedadeBase) {
      setFeedback({ ok: false, message: 'Informe a propriedade-base para agrupar as execuções desta fonte.' });
      return;
    }
    const resultado = registrarFenomenoRodaMahoraga(owner.id, model.id, {
      id: idFenomenoMahoraga(propriedadeBase),
      nome,
      eventoId: `hud-${token.id}-fenomeno-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      prevalidarEfeitoNaoDanoso: true,
      ...(mahoragaFenomenoControleMental ? {
        controleMental: true,
        origemMestre: mahoragaFenomenoOrigemMestre,
      } : {}),
      ...(mahoragaFenomenoTipoManual === 'sem-dano' ? {} : { tipoDano: mahoragaFenomenoTipoManual }),
    });
    setFeedback(resultado.ok
      ? resultado.bloqueadoPorVontadeDivina
        ? { ok: false, message: 'Vontade Divina ignora este controle mental/intimidação porque a fonte não é o Mestre. Não peça o TR nem aplique o efeito.' }
        : resultado.bloqueado
        ? { ok: false, message: `Roda ${resultado.giros}/5: Mahoraga está imune aos efeitos não danosos desta fonte. Não aplique o efeito nem peça o TR.` }
        : { ok: true, message: `${nome}: Roda em ${resultado.giros}/5. Resolva agora este primeiro contato; o próximo efeito não danoso da fonte será bloqueado a partir do 4º giro.` }
      : { ok: false, message: resultado.motivo });
  };

  const registrarCondicaoAtivaMahoraga = () => {
    if (!owner || !model || role !== 'MASTER' || !mahoragaConditionId) return;
    const resultado = registrarCondicaoMahoraga(owner.id, model.id, mahoragaConditionId, { origemMestre: mahoragaCondicaoOrigemMestre });
    const condicao = CONDICOES_ADAPTAVEIS_MAHORAGA.find(item => item.id === mahoragaConditionId);
    setFeedback(resultado.ok
      ? resultado.bloqueadaPorVontadeDivina
        ? { ok: false, message: `Vontade Divina ignora ${condicao?.name ?? mahoragaConditionId} porque a fonte não é o Mestre. A condição não foi registrada.` }
        : { ok: true, message: resultado.duplicada ? `${condicao?.name ?? mahoragaConditionId} já está registrada em Mahoraga.` : `${condicao?.name ?? mahoragaConditionId} registrada. O bônus cumulativo avança no início de cada turno dele.` }
      : { ok: false, message: resultado.motivo });
  };

  const encerrarCondicaoAdaptadaMahoraga = (conditionId: string) => {
    if (!owner || !model || role !== 'MASTER') return;
    const resultado = encerrarCondicaoMahoraga(owner.id, model.id, conditionId);
    setFeedback(resultado.ok
      ? { ok: true, message: `Condição encerrada; resistência permanente: +${resultado.bonusTRPermanente} em TR contra essa condição.` }
      : { ok: false, message: resultado.motivo });
  };

  const configurarPrioridadeMahoraga = () => {
    if (!owner || !model || role !== 'MASTER') return;
    const resultado = configurarVontadeDivinaMahoraga(owner.id, model.id, {
      prioridade: mahoragaPrioridadeDivina,
      ...(mahoragaUltimaOrdem.trim() ? { ultimaOrdem: mahoragaUltimaOrdem.trim() } : {}),
      ...(mahoragaPrioridadeDivina === 'eliminar_ameaca' && targetCommandId ? { alvoPrioritarioId: targetCommandId } : {}),
    });
    setFeedback(resultado.ok
      ? { ok: true, message: 'Prioridade e instrução da Vontade Divina registradas para a próxima ativação.' }
      : { ok: false, message: resultado.motivo });
  };

  const aplicarDanoManualMahoraga = () => {
    if (!owner || !model || !token || !instance || !isMahoraga || role !== 'MASTER') return;
    const dano = Number(mahoragaDanoManual);
    if (!Number.isFinite(dano) || dano <= 0) {
      setFeedback({ ok: false, message: 'Informe um dano positivo já rolado para aplicar à instância.' });
      return;
    }
    const resultado = causarDanoInvocacao(token.id, Math.floor(dano), mahoragaTipoDanoManual, instance.id, {
      eventoId: `hud-${token.id}-dano-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fenomenoId: `dano:${mahoragaTipoDanoManual}`,
      fenomenoNome: DAMAGE_TYPE_LABELS[mahoragaTipoDanoManual],
      ataqueCorpoACorpo: mahoragaAtaqueMeleeManual,
    });
    setFeedback(resultado.ok
      ? { ok: true, message: resultado.destruida ? 'Mahoraga foi derrotado nesta cena.' : `Dano resolvido; Mahoraga está com ${resultado.hpRestante} PV.` }
      : { ok: false, message: resultado.motivo });
    if (resultado.ok) setMahoragaDanoManual('');
  };

  if (!token?.invocationId || !owner || !model || sourceTokenId !== token.id) return null;
  if (role === 'PLAYER' && (owner.profileId !== activeProfileId || (token.ownerProfileId && token.ownerProfileId !== activeProfileId))) return null;

  const targetRangeLabel = rangeMeters === undefined
    ? 'Sem alcance definido'
    : measuredMeters === null
      ? `${rangeMeters} m de alcance`
      : `${measuredMeters.toFixed(1)} m${rangeMeters !== undefined ? ` / ${rangeMeters} m` : ''}${rangeMeters !== undefined && measuredMeters > rangeMeters + 0.05 ? ' · fora de alcance' : ''}`;

  return (
    <section className="mb-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3" data-testid="shikigami-owner-panel">
      <header className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">Shikigami selecionado</div>
          <h3 className="truncate text-sm font-semibold text-foreground">{isCoelhoDisperso ? 'Coelho disperso' : model.apelido?.trim() || model.nome}</h3>
          <p className="text-xs text-muted-foreground">
            {owner.name} · PV {token.hp ?? instance?.hpAtual ?? model.hpAtual}/{token.hpMax ?? instance?.hpMaximoAtual ?? model.hpMaximo}
            {(instance?.pvTemporarios ?? token.invocationTempHp ?? 0) > 0 && <> · PVT {instance?.pvTemporarios ?? token.invocationTempHp}</>}
            {' · '}Defesa {token.invocationDefense ?? model.defesa}
            {isCoelhoDisperso && <> · Deslocamento {token.invocationMovementM ?? 9} m</>}
            {isFugaCoelhos && <> · Porte {token.invocationEffectiveSize ?? model.porte ?? 'Médio'}</>}
          </p>
        </div>
        <span className={`rounded px-1.5 py-0.5 text-[10px] ${token.invocationState === 'caida' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
          {token.invocationState === 'caida' ? 'Caído' : 'Ativo'}
        </span>
      </header>

      {isMahoraga && (
        <section className="mb-2 rounded-md border border-amber-400/30 bg-amber-500/5 p-2 text-xs" data-testid="mahoraga-combat-status" aria-label="Ciclo de vida e Roda de Dharma de Mahoraga">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-amber-100">Ciclo da Roda · Estágio {mahoragaState?.estagioVida ?? 1}/3</strong>
            <span className="text-muted-foreground">{mahoragaState?.regeneracoesRodaPendentes ?? 0} regeneração(ões) por giro disponível(is)</span>
          </div>
          <p className="mt-1 text-muted-foreground">
            Estágios: 1000 → 500 → 250 PV. Avança ao chegar a 0 com 150+ de excesso no mesmo golpe, causado por fenômeno ainda não adaptado nesta cena.
          </p>
          {mahoragaState?.despertarPendente && (
            <p role="status" className="mt-1 text-amber-100">Caído. Despertará com {mahoragaState.estagioVida === 2 ? 500 : 250} PV no início do próximo turno do Controlador.</p>
          )}
          <p className="mt-1 text-muted-foreground">
            Roda: 1 revela feitiços invisíveis/intangíveis; 2 concede 12 RD irredutível; 3 reduz dano à metade por 1 h; 4 reduz a ¼ e impede efeitos não danosos da fonte; 5 impede que a fonte o reduza abaixo de 1 PV.
          </p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground" aria-label="Fenômenos adaptados">
            {(mahoragaState?.fenomenos ?? []).map(fenomeno => (
              <li key={fenomeno.id}>
                {fenomeno.nome}: {fenomeno.giros}/5
                {fenomeno.proximaRodadaGiroAutomatico !== undefined ? ` · próximo giro na rodada ${fenomeno.proximaRodadaGiroAutomatico}` : ' · adaptação completa'}
                {fenomeno.expiraReducaoDanoNaRodada !== undefined ? ` · redução do 3º giro até a rodada ${fenomeno.expiraReducaoDanoNaRodada}` : ''}
              </li>
            ))}
          </ul>
          {(mahoragaState?.adaptacoesCombate?.length ?? 0) > 0 && (
            <p className="mt-1 text-muted-foreground">
              Adaptação de combate: {mahoragaState!.adaptacoesCombate.map(alvo => `${alvo.nomeAlvo} ${alvo.giros}/4`).join(' · ')}
            </p>
          )}
          {mahoragaState?.ataqueAdaptativoTipo && (
            <p className="mt-1 text-amber-100">Próximo ataque: {DAMAGE_TYPE_LABELS[mahoragaState.ataqueAdaptativoTipo]}.</p>
          )}
        </section>
      )}

      {isFugaCoelhos && (
        <div className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs" data-testid="fuga-coelhos-horda-status">
          <strong>Horda Infindável</strong>
          <p className="text-muted-foreground">Crescimentos: {estadoCrescimentoCoelhos?.totalCrescimentos ?? 0} · Porte atual: {token.invocationEffectiveSize ?? model.porte ?? 'Médio'}.</p>
          {inCombat && proximaRodadaCrescimentoCoelhos !== undefined
            ? <p className="text-muted-foreground">Próximo crescimento no início da rodada {proximaRodadaCrescimentoCoelhos}: +{incrementoPVCoelhos} PV atuais e máximos.</p>
            : <p className="text-muted-foreground">O contador começa no início do combate; a Horda cresce a cada três rodadas completas.</p>}
          <p className="mt-1 text-muted-foreground">RD contra alvo único: {fugaFragilizada ? 0 : owner.level}. Contra área, ignora essa RD.</p>
          {fugaFragilizada && (
            <div className="mt-2 rounded border border-rose-400/30 bg-rose-500/10 p-2 text-rose-100" data-testid="fuga-coelhos-fragilizada">
              <strong>Fragilizada</strong>
              <p>RD e resistências zerados até a mesa remover esta condição.</p>
              {(role === 'MASTER' || Boolean(owner.profileId && owner.profileId === activeProfileId)) && (
                <button type="button" onClick={removerFragilidadeFuga} className="mt-1 rounded border border-rose-300/40 px-2 py-1 text-[10px] hover:bg-rose-500/20">
                  Remover condição (resolução manual)
                </button>
              )}
            </div>
          )}
          {instance?.fugaCoelhosAlvo && (
            <div className="mt-2 rounded border border-violet-400/30 bg-violet-500/10 p-2" data-testid="fuga-coelhos-alvo-ativo">
              <strong>Fuga em {instance.fugaCoelhosAlvo.targetName}</strong>
              <p className="text-muted-foreground">
                {instance.fugaCoelhosAlvo.lado === 'aliado'
                  ? 'Cobertura Completa contra ataques de alvo único.'
                  : 'Movimento dificultado; o valor não é definido na fonte e fica para a mesa.'}{' '}
                Duração não definida pela Enciclopédia.
              </p>
              {(role === 'MASTER' || Boolean(owner.profileId && owner.profileId === activeProfileId)) && (
                <button type="button" onClick={encerrarAlvoFuga} className="mt-1 rounded border border-violet-300/40 px-2 py-1 text-[10px] hover:bg-violet-500/20">
                  Encerrar Fuga (resolução da mesa)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {isTouro && (
        <div className={`mb-2 rounded-md border p-2 text-xs ${touroInerciaAtiva ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-violet-400/30 bg-violet-500/5'}`} data-testid="touro-inercia-status" aria-live="polite">
          <strong>Inércia Imparável</strong>
          <p className="text-muted-foreground">
            {touroInerciaAtiva
              ? 'Ativa nesta rodada: deslocamento 30 m; a Investida Perfurante aumenta em 2 níveis de dano.'
              : `Inativa · Ação Simples para ativar; deslocamento atual ${deslocamentoInvocacaoM(token.id)} m.`}
            {' '}A Investida move o Touro como parte da Ação Complexa e exige 3 m retos.
          </p>
        </div>
      )}
      {isTouro && model.acoes.some(invocationAction => invocationAction.id === 'ruptura') && (
        <p className="mb-2 rounded-md border border-amber-400/25 bg-amber-500/5 px-2 py-1.5 text-[11px] text-amber-100/90" data-testid="touro-ruptura-note">
          Ruptura: a Investida causa dano dobrado contra objetos e estruturas; se destruir um objeto durante a carga, o Touro pode continuar sem perder o ímpeto. A resolução contra objetos permanece manual porque o mapa não define Defesa nem aplica o dano da Investida a entidades de cenário.
        </p>
      )}

      {isFugaCoelhos && (
        <div className="mb-2 rounded-md border border-violet-500/30 bg-violet-500/5 p-2" data-testid="fuga-coelhos-action">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-200">Fuga · Ação Complexa · 9 m</div>
          <p className="mb-2 text-[11px] text-muted-foreground">Os coelhos cobrem uma criatura. Se for aliada, recebe Cobertura Completa contra ataques de alvo único. A fonte não define a duração nem quanto o movimento de um inimigo é reduzido.</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => { setRangeMode({ kind: 'action', actionId: 'fuga' }); startTargetSelection(); }}
              aria-pressed={rangeMode?.kind === 'action' && rangeMode.actionId === 'fuga'}
              className="min-h-8 rounded border border-violet-400/40 bg-violet-500/10 px-2 py-1 text-xs text-violet-100 hover:bg-violet-500/20">
              Selecionar alvo
            </button>
            <button type="button" onClick={usarFugaCoelhos} disabled={busyActionId !== null || !target || instance?.estado !== 'ativa'}
              className="min-h-8 rounded border border-violet-400/40 bg-violet-500/20 px-2 py-1 text-xs text-violet-100 hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50">
              Aplicar em {target?.label || 'alvo selecionado'}
            </button>
          </div>
        </div>
      )}

      {isFugaCoelhos && (
        <div className="mb-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2" data-testid="fuga-coelhos-dispersao">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">Dispersão Tática · Ação Bônus</div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Coelhos ativos: {coelhosDispersosAtivos}/6. Confirme com o Mestre os PV máximos e o porte que restam à Horda; a fonte não define uma proporção numérica.
            {' '}A Horda encolhe pela borda superior esquerda; coloque os coelhos em espaços adjacentes livres.
          </p>
          <div className="mb-2 grid grid-cols-3 gap-2 text-xs">
            <label className="space-y-1">
              <span className="block text-muted-foreground">Liberar</span>
              <input aria-label="Quantidade de coelhos" type="number" min={1} max={Math.max(1, 6 - coelhosDispersosAtivos)} step={1}
                value={fugaQuantidade} onChange={event => setFugaQuantidade(event.target.value)}
                className="h-8 w-full rounded border border-border bg-background px-2" />
            </label>
            <label className="space-y-1">
              <span className="block text-muted-foreground">PV máx. restante</span>
              <input aria-label="PV máximos restantes" type="number" min={1} max={Math.max(1, instance?.hpMaximoAtual ?? model.hpMaximo)} step={1}
                value={fugaPVMaxRestante} onChange={event => setFugaPVMaxRestante(event.target.value)}
                className="h-8 w-full rounded border border-border bg-background px-2" />
            </label>
            <label className="space-y-1">
              <span className="block text-muted-foreground">Porte restante</span>
              <select aria-label="Porte restante da Horda" value={fugaPorteRestante} onChange={event => setFugaPorteRestante(event.target.value)}
                className="h-8 w-full rounded border border-border bg-background px-2">
                <option value="">Escolher…</option>
                {['Minúsculo', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Colossal'].map(porte => (
                  <option key={porte} value={porte}>{porte}</option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" onClick={usarDispersaoTatica}
            disabled={busyActionId !== null || instance?.estado !== 'ativa' || coelhosDispersosAtivos >= 6 || !fugaPorteRestante || !fugaPVMaxRestante}
            className="min-h-8 rounded border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50">
            Liberar coelhos e reduzir a Horda
          </button>
        </div>
      )}

      {isCoelhoDisperso && (
        <div className="mb-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2" data-testid="fuga-coelho-disperso-action">
          <p className="mb-2 text-[11px] text-muted-foreground">Mova o token até um alvo adjacente. Cada coelho tem um ataque por rodada; o dano é fixo em 1 e ignora RD comum.</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={startTargetSelection}
              className="min-h-8 rounded border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-500/20">
              Selecionar alvo
            </button>
            <button type="button" onClick={() => void atacarComCoelhoDisperso()}
              disabled={busyActionId !== null || !targetCommandId || (token.hp ?? 0) <= 0}
              className="min-h-8 rounded border border-emerald-400/40 bg-emerald-500/20 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50">
              {busyActionId === 'ataque-coelho-disperso' ? 'Rolando…' : `Atacar ${target?.label || 'alvo selecionado'}`}
            </button>
          </div>
        </div>
      )}

      {isMahoraga && (
        <div className="mb-2 space-y-2 rounded-md border border-amber-400/25 bg-background/60 p-2" data-testid="mahoraga-combat-controls">
          <div className="rounded border border-violet-400/25 bg-violet-500/5 p-2" data-testid="mahoraga-vontade-divina">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-200">Vontade Divina · Máquina</div>
            {model.domado !== true ? (
              <p className="text-[11px] text-muted-foreground">Disponível somente após o Mestre confirmar a domesticação permanente de Mahoraga.</p>
            ) : mahoragaState?.vontadeDivina?.ativa ? (
              <p className="text-[11px] text-foreground">
                Máquina ativa · {mahoragaState.vontadeDivina.rodadasRestantes}/{mahoragaState.vontadeDivina.rodadasTotais} rodada(s).
                {' '}O Mestre aplica a prioridade registrada e escolhe as ações/alvos na HUD; controle mental e intimidação de outras fontes são ignorados.
              </p>
            ) : ownerIncapacitado ? (
              <p className="text-[11px] text-amber-100">O Controlador está inconsciente ou Morrendo. Máquina será ativada no próximo início de turno dele.</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Quando o Controlador ficar inconsciente ou Morrendo, Mahoraga entra em Máquina no próximo turno do Controlador, por pelo menos 1 rodada.</p>
            )}
            {model.domado === true && role === 'MASTER' && (
              <div className="mt-2 space-y-1.5 border-t border-violet-400/20 pt-2">
                <label className="block text-[10px] text-muted-foreground">
                  Prioridade quando a Máquina ativar
                  <select aria-label="Prioridade da Vontade Divina" value={mahoragaPrioridadeDivina}
                    disabled={busyActionId !== null}
                    onChange={event => setMahoragaPrioridadeDivina(event.target.value as typeof mahoragaPrioridadeDivina)}
                    className="mt-1 h-9 w-full rounded border border-border bg-background px-2 text-xs text-foreground">
                    <option value="ultima_ordem">Cumprir última ordem</option>
                    <option value="eliminar_ameaca">Eliminar ameaça selecionada</option>
                    <option value="proteger_corpo">Proteger o corpo do Controlador</option>
                  </select>
                </label>
                {mahoragaPrioridadeDivina === 'ultima_ordem' && (
                  <input aria-label="Última ordem do Controlador para Mahoraga" value={mahoragaUltimaOrdem}
                    disabled={busyActionId !== null}
                    onChange={event => setMahoragaUltimaOrdem(event.target.value)}
                    placeholder="Registre a última ordem antes da incapacidade"
                    className="h-9 w-full rounded border border-border bg-background px-2 text-xs text-foreground" />
                )}
                {mahoragaPrioridadeDivina === 'eliminar_ameaca' && (
                  <p className="text-[10px] text-muted-foreground">Alvo selecionado: {target?.label ?? 'selecione a ameaça no mapa'}.</p>
                )}
                <button type="button" onClick={configurarPrioridadeMahoraga}
                  disabled={busyActionId !== null || (mahoragaPrioridadeDivina === 'ultima_ordem' && !mahoragaUltimaOrdem.trim()) || (mahoragaPrioridadeDivina === 'eliminar_ameaca' && !targetCommandId)}
                  className="min-h-8 w-full rounded border border-violet-400/40 bg-violet-500/10 px-2 py-1 text-xs text-violet-100 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                  Registrar prioridade e instrução
                </button>
                <p className="text-[10px] text-muted-foreground">A seleção persiste a prioridade. As ações e a escolha de alvos da Máquina continuam sendo executadas pelo Mestre na HUD.</p>
              </div>
            )}
          </div>

          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">Regeneração Adaptativa</div>
            <p className="mb-2 text-[11px] text-muted-foreground">4d12+1d8, +8 níveis de dano. Por PE extra, +2 níveis; com metade dos PV ou menos, a primeira regeneração da rodada é Ação Livre.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <label className="space-y-1 text-[11px] text-muted-foreground">
                <span className="block">Resultado</span>
                <select aria-label="Resultado da Regeneração Adaptativa" value={mahoragaModoRegeneracao}
                  disabled={busyActionId !== null}
                  onChange={event => setMahoragaModoRegeneracao(event.target.value as 'temporarios' | 'cura')}
                  className="h-9 w-full rounded border border-border bg-background px-2 text-xs text-foreground">
                  <option value="temporarios">PV temporários · 0 PE base</option>
                  <option value="cura">Curar PV · 2 PE base</option>
                </select>
              </label>
              <label className="space-y-1 text-[11px] text-muted-foreground">
                <span className="block">PE extra (máx. {limitePEMahoraga})</span>
                <input aria-label="PE extra da Regeneração Adaptativa" type="number" min={0} max={limitePEMahoraga} step={1}
                  value={mahoragaPEAdicional} disabled={busyActionId !== null}
                  onChange={event => setMahoragaPEAdicional(event.target.value)}
                  className="h-9 w-full rounded border border-border bg-background px-2 text-xs text-foreground" />
              </label>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Custo previsto: {(mahoragaModoRegeneracao === 'cura' ? 2 : 0) + (Number(mahoragaPEAdicional) || 0)} PE · +{8 + (Number(mahoragaPEAdicional) || 0) * 2} níveis.
            </p>
            <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={mahoragaUsarGiro} disabled={(mahoragaState?.regeneracoesRodaPendentes ?? 0) < 1 || busyActionId !== null}
                onChange={event => setMahoragaUsarGiro(event.target.checked)} />
              Gastar um giro pendente para usar como Ação Simples
            </label>
            <button type="button" onClick={() => void usarRegeneracaoMahoraga(mahoragaUsarGiro)}
              disabled={busyActionId !== null || instance?.estado !== 'ativa' || (inCombat && currentActorId !== owner.id) ||
                (mahoragaUsarGiro && (mahoragaState?.regeneracoesRodaPendentes ?? 0) < 1) ||
                (mahoragaModoRegeneracao === 'cura' && (instance?.hpAtual ?? 0) >= (instance?.hpMaximoAtual ?? model.hpMaximo))}
              className="mt-2 min-h-9 w-full rounded border border-emerald-400/40 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50">
              {busyActionId?.startsWith('regeneracao-mahoraga') ? 'Rolando regeneração…' : 'Usar Regeneração Adaptativa'}
            </button>
          </div>

          <div className="border-t border-border/70 pt-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">Ataque Adaptativo</div>
            <p className="mb-2 text-[11px] text-muted-foreground">Escolha uma propriedade de dano que a Roda já registrou. A Ação Simples prepara o próximo ataque.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select aria-label="Propriedade para Ataque Adaptativo" value={mahoragaTipoAdaptativo}
                disabled={!tiposAdaptadosMahoraga.length || busyActionId !== null}
                onChange={event => setMahoragaTipoAdaptativo(event.target.value as DamageType | '')}
                className="h-9 min-w-0 rounded border border-border bg-background px-2 text-xs text-foreground">
                <option value="">Escolha uma propriedade adaptada</option>
                {tiposAdaptadosMahoraga.map(tipo => <option key={tipo} value={tipo}>{DAMAGE_TYPE_LABELS[tipo]}</option>)}
              </select>
              <button type="button" onClick={prepararAtaqueAdaptativoMahoraga}
                disabled={!mahoragaTipoAdaptativo || busyActionId !== null || instance?.estado !== 'ativa' || (inCombat && currentActorId !== owner.id)}
                className="min-h-9 rounded border border-amber-400/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                Preparar próximo ataque
              </button>
            </div>
          </div>

          {model.acoes.some(item => item.id === 'punho-do-exterminio') && (
            <label className="flex items-center gap-2 border-t border-border/70 pt-2 text-[11px] text-muted-foreground">
              Dados removidos do Punho (0–4)
              <input aria-label="Dados removidos do Punho do Extermínio" type="number" min={0} max={4} step={1}
                value={mahoragaDadosRemovidos} disabled={busyActionId !== null}
                onChange={event => setMahoragaDadosRemovidos(event.target.value)}
                className="h-8 w-16 rounded border border-border bg-background px-2 text-xs text-foreground" />
              <span>· empurra 6 m por dado removido se acertar</span>
            </label>
          )}

          {isMahoraga && (
            <div className="space-y-2 border-t border-border/70 pt-2" data-testid="mahoraga-injury-regeneration">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200">Ferimentos e membros</div>
              <p className="text-[10px] text-muted-foreground">O Mestre registra ferimentos e partes do corpo confirmados na ficção. Regenerar um Ferimento Complexo custa 8 PE e Ação Complexa; reanexar um membro disponível custa 4 PE e Ação Simples.</p>
              {mahoragaFerimentos.length > 0 ? (
                <>
                  <select aria-label="Ferimento de Mahoraga" value={mahoragaFerimentoAtivo?.id ?? ''}
                    onChange={event => setMahoragaFerimentoSelecionado(event.target.value)}
                    className="h-9 w-full rounded border border-border bg-background px-2 text-xs text-foreground">
                    {mahoragaFerimentos.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.descricao}{item.ferimentoAtivo ? ' · ferimento ativo' : ' · ferimento regenerado'}
                        {item.membroSeparado ? ` · ${item.membroReanexado ? 'membro reanexado' : `membro separado${item.membroDisponivel ? ' disponível' : ''}`}` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => recuperarFerimentoMahoraga('curar_ferimento')}
                      disabled={!mahoragaFerimentoAtivo?.ferimentoAtivo || Boolean(mahoragaFerimentoAtivo.membroSeparado && mahoragaFerimentoAtivo.membroDisponivel && !mahoragaFerimentoAtivo.membroReanexado) || busyActionId !== null || instance?.estado !== 'ativa' || (inCombat && currentActorId !== owner?.id)}
                      title={mahoragaFerimentoAtivo?.membroSeparado && mahoragaFerimentoAtivo.membroDisponivel && !mahoragaFerimentoAtivo.membroReanexado
                        ? 'O membro está disponível para reanexação por 4 PE e Ação Simples.'
                        : 'Regenera um Ferimento Complexo por 8 PE e Ação Complexa.'}
                      className="min-h-9 rounded border border-emerald-400/40 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                      Regenerar ferimento · 8 PE + Complexa
                    </button>
                    <button type="button" onClick={() => recuperarFerimentoMahoraga('reanexar_membro')}
                      disabled={!mahoragaFerimentoAtivo?.membroSeparado || mahoragaFerimentoAtivo.membroReanexado || !mahoragaFerimentoAtivo.membroDisponivel || busyActionId !== null || instance?.estado !== 'ativa' || (inCombat && currentActorId !== owner?.id)}
                      className="min-h-9 rounded border border-emerald-400/40 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                      Reanexar membro · 4 PE + Simples
                    </button>
                  </div>
                </>
              ) : <p className="rounded bg-background/70 px-2 py-1 text-[10px] text-muted-foreground">Nenhum ferimento complexo ou membro separado registrado.</p>}
              {role === 'MASTER' && (
                <div className="space-y-2 rounded border border-border/70 bg-background/40 p-2">
                  <strong className="text-[10px] text-foreground">Registro do Mestre</strong>
                  <input aria-label="Descrição do ferimento de Mahoraga" value={mahoragaFerimentoDescricao}
                    onChange={event => setMahoragaFerimentoDescricao(event.target.value)} maxLength={120}
                    placeholder="Descreva o ferimento confirmado" className="h-9 w-full rounded border border-border bg-background px-2 text-xs text-foreground" />
                  <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <input type="checkbox" checked={mahoragaFerimentoComplexo} onChange={event => setMahoragaFerimentoComplexo(event.target.checked)} />
                    É um Ferimento Complexo regenerável por 8 PE.
                  </label>
                  <input aria-label="Membro separado de Mahoraga" value={mahoragaMembroSeparado}
                    onChange={event => setMahoragaMembroSeparado(event.target.value)} maxLength={80}
                    placeholder="Membro separado (opcional)" className="h-9 w-full rounded border border-border bg-background px-2 text-xs text-foreground" />
                  {mahoragaMembroSeparado.trim() && (
                    <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <input type="checkbox" checked={mahoragaMembroDisponivel} onChange={event => setMahoragaMembroDisponivel(event.target.checked)} />
                      O membro está disponível para reanexação.
                    </label>
                  )}
                  <button type="button" onClick={registrarFerimentoMahoragaManual}
                    disabled={!mahoragaFerimentoDescricao.trim() || (!mahoragaFerimentoComplexo && !mahoragaMembroSeparado.trim()) || instance?.estado === 'derrotada'}
                    className="min-h-9 w-full rounded border border-border px-2 py-1.5 text-xs text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
                    Registrar ferimento ou membro
                  </button>
                </div>
              )}
            </div>
          )}

          {role === 'MASTER' && (
            <div className="space-y-2 border-t border-border/70 pt-2" data-testid="mahoraga-manual-resolution">
              <div className="space-y-1.5 rounded border border-amber-400/20 bg-amber-500/5 p-2" data-testid="mahoraga-condition-adaptation">
                <strong className="text-[11px] text-foreground">Adaptação a condições</strong>
                <p className="text-[10px] text-muted-foreground">Registre uma condição depois que a mesa confirmar que ela afetou Mahoraga. O efeito e a duração originais continuam na resolução da mesa; o HUD acompanha +5 em TR por rodada consecutiva para o Mestre aplicar nos TRs externos. Ao encerrar a condição, fixa a resistência permanente do grau.</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <select aria-label="Condição adaptada por Mahoraga" value={mahoragaConditionId}
                    disabled={!CONDICOES_ADAPTAVEIS_MAHORAGA.length || busyActionId !== null}
                    onChange={event => setMahoragaConditionId(event.target.value)}
                    className="h-9 min-w-0 rounded border border-border bg-background px-2 text-xs text-foreground">
                    {CONDICOES_ADAPTAVEIS_MAHORAGA.map(condition => <option key={condition.id} value={condition.id}>{condition.name}</option>)}
                  </select>
                  <button type="button" onClick={registrarCondicaoAtivaMahoraga}
                    disabled={!mahoragaConditionId || busyActionId !== null || instance?.estado !== 'ativa'}
                    className="min-h-9 rounded border border-amber-400/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                    Registrar condição ativa
                  </button>
                </div>
                {mahoragaState?.vontadeDivina?.ativa && mahoragaCondicaoSelecionada?.category === 'MENTAL' && (
                  <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <input type="checkbox" checked={mahoragaCondicaoOrigemMestre} disabled={busyActionId !== null}
                      onChange={event => setMahoragaCondicaoOrigemMestre(event.target.checked)} />
                    Esta condição mental vem do Mestre (única origem que afeta Mahoraga durante Máquina).
                  </label>
                )}
                <div className="space-y-1">
                  {mahoragaCondicoesAtivas.map(condition => {
                    const adaptation = mahoragaState?.adaptacoesCondicoes.find(item =>
                      normalizarIdCondicaoMahoraga(item.conditionId) === condition.conditionId,
                    );
                    return (
                      <div key={condition.conditionId} className="flex flex-wrap items-center justify-between gap-2 rounded bg-background/70 px-2 py-1 text-[10px]">
                        <span className="text-foreground">
                          {condition.name} · {adaptation?.bonusTRConsecutivo ?? 0} bônus cumulativo
                          {adaptation ? ` · resistência permanente ${adaptation.bonusTRPermanente}` : ' · primeiro turno pendente'}
                        </span>
                        <button type="button" onClick={() => encerrarCondicaoAdaptadaMahoraga(condition.conditionId)}
                          disabled={busyActionId !== null}
                          className="min-h-7 rounded border border-border px-2 text-muted-foreground hover:text-foreground disabled:opacity-50">
                          Marcar condição encerrada
                        </button>
                      </div>
                    );
                  })}
                  {mahoragaCondicoesAtivas.length === 0 && (mahoragaState?.adaptacoesCondicoes ?? []).filter(item => !item.condicaoAtiva && item.bonusTRPermanente > 0).map(adaptation => (
                    <div key={adaptation.conditionId} className="rounded bg-background/70 px-2 py-1 text-[10px] text-emerald-100">
                      {adaptation.nome} · resistência permanente +{adaptation.bonusTRPermanente} em TR
                    </div>
                  ))}
                  {mahoragaCondicoesAtivas.length === 0 && !(mahoragaState?.adaptacoesCondicoes ?? []).some(item => !item.condicaoAtiva && item.bonusTRPermanente > 0) && (
                    <p className="text-[10px] text-muted-foreground">Nenhuma condição ativa registrada.</p>
                  )}
                </div>
              </div>

              <div>
                <strong className="text-[11px] text-foreground">Verificar efeito não danoso antes do TR</strong>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Antes de pedir o TR ou aplicar o efeito, informe a propriedade-base e o nome desta execução. Reutilize a propriedade-base para agrupar execuções diferentes do mesmo fenômeno. O primeiro contato gira a Roda e ainda se resolve; se ela já estava em 4/5 antes deste contato, não aplique o efeito nem peça o TR. Dano resolvido no mapa já gira automaticamente.</p>
                <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_auto]">
                  <input aria-label="Nome da fonte para a Roda de Dharma" value={mahoragaFenomenoManual} disabled={busyActionId !== null}
                    onChange={event => setMahoragaFenomenoManual(event.target.value)} placeholder="Nome da fonte ou fenômeno"
                    className="h-9 min-w-0 rounded border border-border bg-background px-2 text-xs text-foreground" />
                  <input aria-label="Propriedade-base da fonte para a Roda de Dharma" value={mahoragaPropriedadeBaseManual} disabled={busyActionId !== null}
                    onChange={event => setMahoragaPropriedadeBaseManual(event.target.value)} placeholder="Propriedade-base (ex.: fogo)"
                    className="h-9 min-w-0 rounded border border-border bg-background px-2 text-xs text-foreground" />
                  <select aria-label="Tipo de dano da fonte" value={mahoragaFenomenoTipoManual}
                    onChange={event => setMahoragaFenomenoTipoManual(event.target.value as DamageType | 'sem-dano')}
                    className="h-9 rounded border border-border bg-background px-2 text-xs text-foreground">
                    <option value="sem-dano">Sem dano</option>
                    {DAMAGE_TYPES.map(tipo => <option key={tipo} value={tipo}>{DAMAGE_TYPE_LABELS[tipo]}</option>)}
                  </select>
                  {mahoragaState?.vontadeDivina?.ativa && (
                    <div className="space-y-1 rounded border border-violet-400/20 bg-violet-500/5 p-2 sm:col-span-4">
                      <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <input type="checkbox" checked={mahoragaFenomenoControleMental} disabled={busyActionId !== null}
                          onChange={event => setMahoragaFenomenoControleMental(event.target.checked)} />
                        Este contato é controle mental ou intimidação.
                      </label>
                      {mahoragaFenomenoControleMental && (
                        <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <input type="checkbox" checked={mahoragaFenomenoOrigemMestre} disabled={busyActionId !== null}
                            onChange={event => setMahoragaFenomenoOrigemMestre(event.target.checked)} />
                          A fonte é o Mestre; caso contrário, Vontade Divina ignora o contato.
                        </label>
                      )}
                    </div>
                  )}
                  <button type="button" onClick={registrarFenomenoMahoragaManual}
                    disabled={!mahoragaFenomenoManual.trim() || !mahoragaPropriedadeBaseManual.trim() || busyActionId !== null || instance?.estado === 'derrotada'}
                    className="min-h-9 rounded border border-amber-400/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                    Verificar e registrar
                  </button>
                </div>
              </div>

              <div>
                <strong className="text-[11px] text-foreground">Aplicar dano recebido fora do fluxo do mapa</strong>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Para um ataque resolvido por ficha que não aceita um token de invocação como alvo, informe o dano já rolado. Não reaplique dano que o mapa já lançou.</p>
                <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-[7rem_8rem_minmax(0,1fr)_auto]">
                  <input aria-label="Dano rolado contra Mahoraga" type="number" min={1} step={1} value={mahoragaDanoManual}
                    onChange={event => setMahoragaDanoManual(event.target.value)} placeholder="Dano"
                    className="h-9 rounded border border-border bg-background px-2 text-xs text-foreground" />
                  <select aria-label="Tipo de dano recebido por Mahoraga" value={mahoragaTipoDanoManual}
                    onChange={event => setMahoragaTipoDanoManual(event.target.value as DamageType)}
                    className="h-9 rounded border border-border bg-background px-2 text-xs text-foreground">
                    {DAMAGE_TYPES.map(tipo => <option key={tipo} value={tipo}>{DAMAGE_TYPE_LABELS[tipo]}</option>)}
                  </select>
                  <label className="col-span-2 flex items-center gap-2 text-[11px] text-muted-foreground sm:col-span-1">
                    <input type="checkbox" checked={mahoragaAtaqueMeleeManual} onChange={event => setMahoragaAtaqueMeleeManual(event.target.checked)} />
                    Ataque corpo a corpo
                  </label>
                  <button type="button" onClick={aplicarDanoManualMahoraga}
                    disabled={!mahoragaDanoManual || instance?.estado === 'derrotada'}
                    className="col-span-2 min-h-9 rounded border border-rose-400/40 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1">
                    Aplicar dano
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!isCoelhoDisperso && <div className="mb-2 flex flex-wrap gap-1.5">
        {ACTION_POOLS.map(([key, label]) => {
          const saldo = instance?.economiaAcoes?.[key];
          if (!saldo) return null;
          return (
            <span key={key} className="rounded border border-border/70 bg-background/70 px-1.5 py-1 text-[10px] text-muted-foreground">
              {label} <strong className="text-foreground">{saldo.atual}/{saldo.maximo}</strong>
            </span>
          );
        })}
      </div>}

      {isTigre && instance && (
        <section className="mb-2 space-y-1.5 rounded-md border border-rose-400/25 bg-rose-500/5 p-2" data-testid="tigre-funebre-status">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <strong className="text-rose-100">Reflexos Felinos</strong>
            <span className="rounded border border-border/70 bg-background/70 px-1.5 py-0.5 text-muted-foreground">
              Reações {instance.economiaAcoes?.reacao?.atual ?? 0}/{instance.economiaAcoes?.reacao?.maximo ?? 2}
            </span>
          </div>
          {tigrePredadorAtivo ? (
            <p role="status" className="text-[11px] text-amber-100">
              Predador Ápice ativo nesta rodada: {Math.max(0, 2 - (tigreState?.predadorApice?.retalharesUsados ?? 0))} Retalhar(es) restante(s); ignora 8 RD e RD de criaturas de 2º Grau ou inferior.
            </p>
          ) : tigrePredadorPendente ? (
            <p role="status" className="text-[11px] text-amber-100">Predador Ápice preparado para a rodada {tigreState?.predadorApice?.rodadaAlvo}.</p>
          ) : null}
          <div aria-label="Penalidades de Defesa causadas por Garras de Extermínio" className="text-[10px] text-muted-foreground">
            {tigreState?.garras?.length ? tigreState.garras.map(garras => (
              <div key={garras.alvoId} className="flex justify-between gap-2">
                <span className="truncate">{garras.nomeAlvo}</span>
                <span className="shrink-0 text-rose-100">Defesa −{garras.penalidade}/4</span>
              </div>
            )) : 'Garras de Extermínio: nenhum alvo marcado.'}
          </div>
          {tigreSangramentos.length > 0 && (
            <div data-testid="tigre-sangramento-alvos" className="rounded border border-red-400/30 bg-red-950/20 p-1.5 text-[10px] text-red-100">
              <strong>Sangramento Forte ativo</strong>
              <ul className="mt-0.5 list-inside list-disc">
                {tigreSangramentos.map(alvo => (
                  <li key={alvo.key}>{alvo.nome}: 4d10 no início do turno; TR de Fortitude no fim pode encerrar.</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {token.invocationConditionIds?.includes('caido') && instance?.estado === 'ativa' && (
        <button
          type="button"
          disabled={busyActionId !== null || (instance.economiaAcoes?.acaoMovimento?.atual ?? 0) < 1 || (inCombat && currentActorId !== owner?.id)}
          onClick={() => {
            if (!owner || !instance) return;
            const result = comandarLevantarInvocacao(owner.id, token.id, instance.id, `levantar-${token.id}-${Date.now()}`);
            setFeedback(result.ok
              ? { ok: true, message: 'A invocação gastou sua Ação de Movimento e se levantou.' }
              : { ok: false, message: result.motivo });
          }}
          className="mb-2 rounded border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          title={(instance.economiaAcoes?.acaoMovimento?.atual ?? 0) < 1 ? 'Ação de Movimento própria indisponível.' : 'Gasta Ação de Movimento própria para remover Caído.'}
        >
          Levantar · Movimento
        </button>
      )}

      {model.acoes.some((invocationAction) => invocationAction.tipo === 'ataque' ||
        (invocationAction.tipo === 'suporte' && invocationAction.efeitoSuporte) ||
        invocationAction.efeitoEspecial?.tipo === 'vantagem_pericia_controlador' ||
        invocationAction.efeitoEspecial?.tipo === 'puxar_aliado_gama' ||
        invocationAction.efeitoEspecial?.tipo === 'toque_da_vida_cervo' ||
        invocationAction.efeitoEspecial?.tipo === 'neutralizacao_cervo' ||
        (isElefante && invocationAction.id === 'massa-esmagadora') ||
        (isTouro && invocationAction.id === 'inercia-imparavel') ||
        (isTigre && invocationAction.id === 'predador-apice')) && (
        <div className="mb-2 rounded-md border border-border/70 bg-background/50 p-2" data-testid="shikigami-combat-actions">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ações de combate</div>
          {isElefante && role === 'MASTER' && model.acoes.some(invocationAction => invocationAction.id === 'massa-esmagadora') && (
            <label className="mb-2 flex items-start gap-2 rounded border border-amber-400/20 bg-amber-500/5 p-2 text-xs text-amber-100">
              <input type="checkbox" checked={elefanteDominioAtivo} onChange={event => setElefanteDominioAtivo(event.target.checked)} />
              Expansão de Domínio ativa: Massa Esmagadora usa 6d12 iniciais.
            </label>
          )}
          {isElefante && <p className="mb-2 text-[11px] text-muted-foreground">Massa Esmagadora exige alvo menor sob os pés do Elefante. A altura atual do token concede +1d6 por cada 3 m de queda; o ataque reduz a altura a 0 m.</p>}
          {isCervo && model.acoes.some(invocationAction => invocationAction.efeitoEspecial?.tipo === 'toque_da_vida_cervo') && (
            <div className="mb-2 rounded border border-emerald-400/30 bg-emerald-500/5 p-2" data-testid="cervo-toque-da-vida">
              <label className="block text-[11px] text-muted-foreground">
                Toque da Vida · aliado adjacente
                <select
                  aria-label="Condição para remover com Toque da Vida"
                  value={toqueCondicaoSelecionada}
                  disabled={!toqueConditionOptions.length || busyActionId !== null}
                  onChange={event => setToqueCondicaoId(event.target.value)}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                >
                  {!toqueConditionOptions.length && <option value="">Selecione um aliado com condição removível</option>}
                  {toqueConditionOptions.map(condition => {
                    const nivel = nivelCondicaoCervo(condition.conditionId)!;
                    return <option key={condition.selectionId} value={condition.selectionId}>{condition.icon} {condition.name} · {nivel * 2} PE · {nivel <= 2 ? 'Movimento' : 'Ação Complexa'}</option>;
                  })}
                </select>
              </label>
            </div>
          )}
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {model.acoes.filter((invocationAction) => invocationAction.tipo === 'ataque' ||
              (invocationAction.tipo === 'suporte' && invocationAction.efeitoSuporte) ||
              invocationAction.efeitoEspecial?.tipo === 'vantagem_pericia_controlador' ||
              invocationAction.efeitoEspecial?.tipo === 'puxar_aliado_gama' ||
              invocationAction.efeitoEspecial?.tipo === 'toque_da_vida_cervo' ||
              invocationAction.efeitoEspecial?.tipo === 'neutralizacao_cervo' ||
              (isElefante && invocationAction.id === 'massa-esmagadora') ||
              (isTouro && invocationAction.id === 'inercia-imparavel') ||
              (isTigre && invocationAction.id === 'predador-apice')).map((invocationAction) => {
              const precisaAlvo = !invocationAction.area && !invocationAction.somenteProprio && invocationAction.efeitoEspecial?.tipo !== 'vantagem_pericia_controlador' && invocationAction.efeitoEspecial?.tipo !== 'neutralizacao_cervo';
              const desabilitada = busyActionId !== null || instance?.estado === 'caida' ||
                (precisaAlvo && !targetCommandId) || invocationAction.statusAutomacao === 'manual' ||
                (isTouro && invocationAction.id === 'inercia-imparavel' && (touroInerciaAtiva || !inCombat)) ||
                (isTigre && invocationAction.id === 'predador-apice' && (
                  !inCombat || currentActorId !== owner?.id || instance?.estado !== 'ativa' ||
                  (instance.economiaAcoes?.acaoSimples?.atual ?? 0) < 1 || tigrePredadorAtivo || tigrePredadorPendente
                )) ||
                (invocationAction.efeitoEspecial?.tipo === 'toque_da_vida_cervo' && !toqueCondicaoSelecionada) ||
                (invocationAction.efeitoEspecial?.tipo === 'puxar_aliado_gama' && !shadowTongueAvailable);
              return (
                <button
                  type="button"
                  key={invocationAction.id}
                  aria-label={`Executar ${invocationAction.nome}${invocationAction.alcanceM === undefined ? '' : ` · ${invocationAction.alcanceM} m`}`}
                  disabled={desabilitada}
                  onClick={() => void executeAction(invocationAction.id)}
                  className="min-h-9 rounded border border-violet-400/30 bg-violet-500/10 px-2 py-1.5 text-left text-xs text-foreground hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  title={invocationAction.efeitoEspecial?.tipo === 'neutralizacao_cervo'
                    ? 'Afeta criaturas e técnicas ativas em um raio de 4,5 m centrado no Cervo.'
                    : isTouro && invocationAction.id === 'inercia-imparavel' && touroInerciaAtiva
                    ? 'Inércia já está ativa até o fim desta rodada.'
                    : isTigre && invocationAction.id === 'predador-apice' && tigrePredadorAtivo
                    ? 'Predador Ápice já está ativo nesta rodada.'
                    : isTigre && invocationAction.id === 'predador-apice' && tigrePredadorPendente
                    ? `Predador Ápice já está preparado para a rodada ${tigreState?.predadorApice?.rodadaAlvo}.`
                    : isTigre && invocationAction.id === 'predador-apice' && (!inCombat || currentActorId !== owner?.id)
                    ? 'Ação Simples disponível apenas no turno do Controlador, durante combate.'
                    : isTigre && invocationAction.id === 'predador-apice' && (instance?.economiaAcoes?.acaoSimples?.atual ?? 0) < 1
                    ? 'Ação Simples do Tigre indisponível neste turno.'
                    : invocationAction.area
                    ? 'Posicione a área no mapa para definir todos os alvos automaticamente.'
                    : isElefante && invocationAction.id === 'massa-esmagadora'
                    ? precisaAlvo && !targetCommandId ? 'Selecione uma criatura menor, ativa e sob os pés do Elefante.' : invocationAction.descricaoRegra
                    : invocationAction.statusAutomacao === 'manual'
                    ? 'Esta ação ainda exige resolução manual.'
                    : invocationAction.efeitoEspecial?.tipo === 'puxar_aliado_gama' && !shadowTongueAvailable
                      ? shadowTongueUsedThisRound ? 'Língua Sombria já foi usada nesta rodada.' : 'Requer combate ativo e uma Reação disponível do Gama.'
                      : precisaAlvo && !targetCommandId ? 'Selecione um alvo válido no mapa.' : invocationAction.descricaoRegra}
                >
                  {busyActionId === invocationAction.id ? 'Resolvendo…' : invocationAction.nome}
                  {invocationAction.alcanceM === undefined ? '' : ` · ${invocationAction.alcanceM} m`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {grappleAvailable && grappleAction?.efeitoEspecial?.tipo === 'agarrar_gama_apos_acerto' && (
        <div className="mb-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2" data-testid="gama-grapple-followup">
          <p className="mb-1 text-xs text-muted-foreground">A Protusão de Língua acertou neste turno. Você pode pagar {grappleAction.efeitoEspecial.custoPE} PE para tentar Agarrar como Ação Livre.</p>
          <fieldset className="mb-2 space-y-1 text-xs text-muted-foreground">
            <legend className="mb-1 font-medium text-foreground">Anfíbio Sombrio · +2 em manobras</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={gamaSubmerso} disabled={busyActionId !== null} onChange={(event) => setGamaSubmerso(event.target.checked)} />
              Gama está submerso
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={gamaEscuridaoTotal} disabled={busyActionId !== null} onChange={(event) => setGamaEscuridaoTotal(event.target.checked)} />
              Gama está em Escuridão Total
            </label>
            <p>O bônus de +2 é aplicado uma vez, mesmo se as duas condições forem verdadeiras.</p>
          </fieldset>
          <button
            type="button"
            disabled={busyActionId !== null || (owner?.peCurrent ?? 0) < grappleAction.efeitoEspecial.custoPE}
            onClick={() => void usarAgarrarGama()}
            className="min-h-9 rounded border border-emerald-400/40 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyActionId === 'agarrar-gama' ? 'Resolvendo…' : `Gastar ${grappleAction.efeitoEspecial.custoPE} PE e tentar Agarrar · Ação Livre`}
          </button>
        </div>
      )}

      {orochiGrappleAvailable && orochiGrappleAction?.efeitoEspecial?.tipo === 'agarrar_orochi_apos_acerto' && (
        <div className="mb-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2" data-testid="orochi-grapple-followup">
          <p className="mb-2 text-xs text-muted-foreground">O Bote Sombrio acertou. Você pode gastar {orochiGrappleAction.efeitoEspecial.custoPE} PE para tentar Agarrar como Ação Livre.</p>
          <label className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={orochiEscuridaoTotal} disabled={busyActionId !== null} onChange={(event) => setOrochiEscuridaoTotal(event.target.checked)} />
            Orochi está em Escuridão Total (+2 no teste de manobra)
          </label>
          <button
            type="button"
            disabled={busyActionId !== null || (owner?.peCurrent ?? 0) < orochiGrappleAction.efeitoEspecial.custoPE}
            onClick={() => void usarAgarrarOrochi()}
            className="min-h-9 rounded border border-emerald-400/40 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyActionId === 'agarrar-orochi' ? 'Resolvendo…' : `Gastar ${orochiGrappleAction.efeitoEspecial.custoPE} PE e tentar Agarrar · Ação Livre`}
          </button>
        </div>
      )}

      {isNue && token && nueCargo && (
        <div className="mb-2 rounded-md border border-sky-400/30 bg-sky-500/5 p-2" data-testid="nue-flight-controls">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-sky-200">Voo Maldito</div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              aria-pressed={nueMovementMode === 'voo'}
              disabled={pendingMove?.entityId === token.id || instance?.estado !== 'ativa'}
              onClick={() => alterarModoMovimentoNue('voo')}
              className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${nueMovementMode === 'voo' ? 'border-sky-300 bg-sky-400/20 text-sky-100' : 'border-border bg-background text-muted-foreground'}`}
            >
              Voo · {deslocamentoInvocacaoM(token.id, 'voo')} m
            </button>
            <button
              type="button"
              aria-pressed={nueMovementMode === 'caminhada'}
              disabled={pendingMove?.entityId === token.id || instance?.estado !== 'ativa'}
              onClick={() => alterarModoMovimentoNue('caminhada')}
              className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${nueMovementMode === 'caminhada' ? 'border-sky-300 bg-sky-400/20 text-sky-100' : 'border-border bg-background text-muted-foreground'}`}
            >
              Caminhada · 4,5 m
            </button>
          </div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Carga: {nueCargo.passageiros} criatura(s), {nueCargo.unidades}/4 unidades · penalidade de voo −{nueCargo.penalidadeVooM} m.
            {!nueCargo.ok && ` ${nueCargo.motivo}`}
          </p>
          {target && target.id !== token.id && (
            target.carriedBy === token.id ? (
              <button type="button" disabled={pendingMove?.entityId === token.id} onClick={soltarCargaNue}
                className="min-h-8 rounded border border-sky-300/40 bg-sky-400/10 px-2 py-1 text-xs text-sky-100 disabled:opacity-50">
                Soltar {target.label || 'alvo'}
              </button>
            ) : (
              <div className="space-y-1.5">
                <label className="flex items-start gap-2 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={nueConfirmacaoAlvoId === target.id}
                    onChange={(event) => setNueConfirmacaoAlvoId(event.target.checked ? target.id : null)} />
                  Alcance e disputa de agarrar, se necessária, resolvidos manualmente.
                </label>
                <button type="button" disabled={pendingMove?.entityId === token.id || !nueCargo.ok || nueConfirmacaoAlvoId !== target.id}
                  onClick={comandarCargaNue}
                  className="min-h-8 rounded border border-sky-300/40 bg-sky-400/10 px-2 py-1 text-xs text-sky-100 disabled:opacity-50">
                  Carregar {target.label || 'alvo'}
                </button>
              </div>
            )
          )}
        </div>
      )}

      {resources.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {resources.map((resource) => {
            const current = instance?.recursosAtuais?.[resource.id] ?? resource.valorInicial;
            return (
              <span key={resource.id} className="rounded border border-border/70 bg-background/70 px-1.5 py-1 text-[10px] text-muted-foreground">
                {resource.nome} <strong className="text-foreground">{current}{resource.valorMaximo === undefined ? '' : `/${resource.valorMaximo}`}</strong>
              </span>
            );
          })}
        </div>
      )}

      {hasManualReset && instance?.estado === 'ativa' && (
        <div className="mb-2">
          <button
            type="button"
            onClick={() => {
              const resultado = resetarEconomiaManualInvocacao(owner.id, token.id);
              setFeedback({ ok: resultado.ok, message: resultado.ok ? 'Reset manual aplicado à instância.' : resultado.motivo });
            }}
            className="rounded border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-100 hover:bg-violet-500/20"
          >
            Aplicar reset manual
          </button>
        </div>
      )}

      <div className="mb-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={startTargetSelection}
          aria-pressed={interaction === 'target'}
          className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-xs ${interaction === 'target' ? 'border-violet-400 bg-violet-500/20 text-violet-100' : 'border-border bg-background text-foreground hover:bg-secondary'}`}
        >
          <Crosshair className="h-3.5 w-3.5" /> Alvo
        </button>
        <button
          type="button"
          onClick={startMeasurement}
          aria-pressed={interaction === 'measure'}
          className={`inline-flex h-7 items-center gap-1 rounded border px-2 text-xs ${interaction === 'measure' ? 'border-violet-400 bg-violet-500/20 text-violet-100' : 'border-border bg-background text-foreground hover:bg-secondary'}`}
        >
          <Ruler className="h-3.5 w-3.5" /> Medir
        </button>
        {(target || measurementPoint) && (
          <button type="button" onClick={clearTarget} title="Limpar alvo e medição" className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2 text-xs text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" /> Limpar
          </button>
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setRangeMode({ kind: 'movement' })}
          aria-pressed={rangeMode?.kind === 'movement'}
          className={`rounded px-2 py-1 text-[10px] ${rangeMode?.kind === 'movement' ? 'bg-violet-500/20 text-violet-100' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
        >
          Movimento · {nueMovementRange} m
        </button>
        {model.acoes.filter((invocationAction) => invocationAction.alcanceM !== undefined && invocationAction.tipo !== 'habilidade').map((invocationAction) => (
          <button
            type="button"
            key={invocationAction.id}
            onClick={() => setRangeMode({ kind: 'action', actionId: invocationAction.id })}
            aria-pressed={rangeMode?.kind === 'action' && rangeMode.actionId === invocationAction.id}
            className={`max-w-full truncate rounded px-2 py-1 text-[10px] ${rangeMode?.kind === 'action' && rangeMode.actionId === invocationAction.id ? 'bg-violet-500/20 text-violet-100' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            {invocationAction.nome}{invocationAction.alcanceM === undefined ? '' : ` · ${invocationAction.alcanceM} m`}
          </button>
        ))}
      </div>

      {(model.subcategoria === 'dez-sombras:cao-branco' || model.subcategoria === 'dez-sombras:cao-preto') && (
        <p className="mb-2 rounded border border-amber-400/20 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-100/90">
          Matilha das Sombras: se outro aliado também estiver adjacente ao alvo da Mordida, ele conta como Flanqueado. A posição é conferida no mapa e registrada no combate.
        </p>
      )}

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {interaction === 'target' ? 'Clique em um token para defini-lo como alvo.'
          : interaction === 'measure' ? 'Clique no mapa para medir a distância.'
            : target ? `Alvo: ${target.label || 'Token'} · ${targetRangeLabel}`
              : measurementPoint ? `Medição: ${measuredMeters?.toFixed(1) ?? '—'} m`
                : `Arraste o token para mover até ${model.deslocamentoM} m por Ação de Movimento.`}
      </p>
      {feedback && <p role={feedback.ok ? 'status' : 'alert'} className={`mt-1 text-xs ${feedback.ok ? 'text-emerald-300' : 'text-rose-300'}`}>{feedback.message}</p>}
      {error && <p role="alert" className="mt-1 text-xs text-rose-300">{error}</p>}
    </section>
  );
}
