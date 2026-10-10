// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ficha, montarMesa, pegarFicha, comoTela } from './helpers/mesaReal';
import { useMapStore } from '@/stores/useMapStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useLogStore } from '@/stores/useLogStore';
import type { EntidadeOmni } from '@/lib/omni/tipos';
import { invocarControlador, invocarControladores, recolherInvocacao, tokensInvocados, limparInvocacoesDerrotadas, causarDanoInvocacao, curarInvocacao, levantarInvocacao, comandarReposicionamento, comandarAtaque, comandosPorAcao, confirmarMovimentoInvocacao } from '@/lib/controlador/mapa';
import type { InvocacaoControlador } from '@/lib/controlador/tipos';

let numeroFixture = 0;

function modelo(id: string, rodada = numeroFixture): InvocacaoControlador {
  return {
    id, nome: id, donoCharacterId: 'dono', tipo: 'shikigami',
    hpAtual: 12, hpMaximo: 12, defesa: 14, deslocamentoM: 9,
    porte: 'Médio', custoInvocacaoPE: 3, alcanceInvocacaoM: 3, acoes: [],
    intermediario: { tipo: 'talisma', itemInventarioId: `item-${rodada}-${id}` },
  };
}
function configurarTempo(id: string, quantidade: number, unidade = 'turnos') {
  const personagem = pegarFicha('dono');
  useCharacterStore.getState().updateCharacter('dono', {
    invocacoesConhecidas: (personagem.invocacoesConhecidas ?? []).map(item => item.id === id
      ? { ...item, tempoAdicional: { quantidade, unidade } }
      : item),
  });
}
function configurarEconomiaMovimento(id: string, quantidade = 1) {
  const personagem = pegarFicha('dono');
  useCharacterStore.getState().updateCharacter('dono', {
    invocacoesConhecidas: (personagem.invocacoesConhecidas ?? []).map(item => item.id === id
      ? { ...item, economiaAcoesConfigurada: { acaoMovimento: quantidade } }
      : item),
  });
}
function prepararMovimentoPendente(
  tokenId: string,
  instanciaId: string,
  de: { x: number; y: number },
  distanciaM: number,
  requestId: string,
  trail: { x: number; y: number }[],
) {
  useMapStore.getState().setPendingMove({
    entityId: tokenId,
    charId: 'dono',
    invocationInstanceId: instanciaId,
    movementRequestId: requestId,
    startX: de.x,
    startY: de.y,
    trail,
    distM: distanciaM,
  });
}
beforeEach(() => {
  numeroFixture += 1;
  useInventoryStore.getState().resetAll();
  useLogStore.getState().clearLogs();
  montarMesa([ficha('dono', {
    specialization: 'Controlador', profileId: 'perfil-dono', level: 1,
    peCurrent: 10, treinoControle: 1,
    invocacoesConhecidas: [modelo('a', numeroFixture), modelo('b', numeroFixture), modelo('c', numeroFixture)],
  })], { dono: [2, 2] });
  useMapStore.getState().clearWalls();
  for (const id of ['a', 'b', 'c']) {
    const entidade: EntidadeOmni = { id: 'talisma-' + id, versao: 1, nome: 'Talismã ' + id, categoria: 'item', descricao: '', tags: [], criadoEm: 1, atualizadoEm: 1, duracao: { tipo: 'instantaneo' }, custos: [], gatilhos: [] };
    const item = useInventoryStore.getState().add('dono', entidade, { instanceId: `item-${numeroFixture}-${id}` });
    useInventoryStore.getState().definirEmMaos(item.instanceId, true);
  }
  comoTela({ profileId: 'perfil-dono', role: 'PLAYER' });
});
describe('Controlador — materialização real no mapa', () => {
  it('move no turno do dono dentro do deslocamento e gasta só a ação da instância', () => {
    configurarEconomiaMovimento('a');
    useCharacterStore.getState().updateCharacter('dono', { actionsCurrent: 2, bonusActionsCurrent: 1 });
    useCombatStore.setState({
      inCombat: true,
      currentTurnIndex: 0,
      initiativeOrder: [{ charId: 'dono', charName: 'Dono', roll: 10, bonus: 0, total: 10 }],
    } as never);
    const invocacao = invocarControlador('dono', 'a', 'leste');
    if (!invocacao.ok) throw new Error(invocacao.motivo);
    const token = useMapStore.getState().entities[invocacao.tokenId];
    const de = { x: token.x, y: token.y };
    const para = { x: token.x + 70, y: token.y };
    useMapStore.getState().updateEntity(token.id, para);
    prepararMovimentoPendente(token.id, token.invocationInstanceId!, de, 1.5, 'movimento-teste-1', [de, para]);

    expect(confirmarMovimentoInvocacao({
      tokenId: token.id,
      instanciaId: token.invocationInstanceId!,
      de,
      para,
      trajetoria: [de, para],
      distanciaM: 1.5,
      requestId: 'movimento-teste-1',
    })).toEqual({ ok: true, distanciaM: 1.5 });
    const instancia = pegarFicha('dono').instanciasInvocacao?.find(item => item.id === token.invocationInstanceId);
    expect(instancia?.economiaAcoes?.acaoMovimento?.atual).toBe(0);
    expect(instancia?.eventosAcoesProcessados).toContain('movimento-teste-1');
    expect(pegarFicha('dono')).toMatchObject({ actionsCurrent: 2, bonusActionsCurrent: 1 });
  });

  it('recusa movimento fora do deslocamento sem debitar ação própria', () => {
    configurarEconomiaMovimento('a');
    useCombatStore.setState({
      inCombat: true,
      currentTurnIndex: 0,
      initiativeOrder: [{ charId: 'dono', charName: 'Dono', roll: 10, bonus: 0, total: 10 }],
    } as never);
    const invocacao = invocarControlador('dono', 'a', 'leste');
    if (!invocacao.ok) throw new Error(invocacao.motivo);
    const token = useMapStore.getState().entities[invocacao.tokenId];
    const de = { x: token.x, y: token.y };
    const para = { x: token.x + 700, y: token.y };
    useMapStore.getState().updateEntity(token.id, para);
    prepararMovimentoPendente(token.id, token.invocationInstanceId!, de, 15, 'movimento-longo', [de, para]);

    expect(confirmarMovimentoInvocacao({
      tokenId: token.id,
      instanciaId: token.invocationInstanceId!,
      de,
      para,
      trajetoria: [de, para],
      distanciaM: 15,
      requestId: 'movimento-longo',
    })).toEqual({ ok: false, motivo: 'O movimento excede o deslocamento configurado na ficha.' });
    expect(pegarFicha('dono').instanciasInvocacao?.[0].economiaAcoes?.acaoMovimento?.atual).toBe(1);
  });

  it('recusa atravessar uma parede sem gastar ação', () => {
    configurarEconomiaMovimento('a');
    useCombatStore.setState({
      inCombat: true,
      currentTurnIndex: 0,
      initiativeOrder: [{ charId: 'dono', charName: 'Dono', roll: 10, bonus: 0, total: 10 }],
    } as never);
    const invocacao = invocarControlador('dono', 'a', 'leste');
    if (!invocacao.ok) throw new Error(invocacao.motivo);
    const token = useMapStore.getState().entities[invocacao.tokenId];
    const de = { x: token.x, y: token.y };
    const para = { x: token.x + 70, y: token.y };
    useMapStore.getState().addWall({ id: 'parede-movimento', kind: 'wall', p1: { x: token.x + 35, y: token.y - 50 }, p2: { x: token.x + 35, y: token.y + 50 } });
    useMapStore.getState().updateEntity(token.id, para);
    prepararMovimentoPendente(token.id, token.invocationInstanceId!, de, 1.5, 'movimento-parede', [de, para]);

    expect(confirmarMovimentoInvocacao({
      tokenId: token.id,
      instanciaId: token.invocationInstanceId!,
      de,
      para,
      trajetoria: [de, para],
      distanciaM: 1.5,
      requestId: 'movimento-parede',
    })).toEqual({ ok: false, motivo: 'A trajetória está bloqueada por uma parede, área ou token.' });
    expect(pegarFicha('dono').instanciasInvocacao?.[0].economiaAcoes?.acaoMovimento?.atual).toBe(1);
  });

  it('recusa ocupar outro token sem gastar ação', () => {
    configurarEconomiaMovimento('a');
    useCombatStore.setState({
      inCombat: true,
      currentTurnIndex: 0,
      initiativeOrder: [{ charId: 'dono', charName: 'Dono', roll: 10, bonus: 0, total: 10 }],
    } as never);
    const invocacao = invocarControlador('dono', 'a', 'leste');
    if (!invocacao.ok) throw new Error(invocacao.motivo);
    const token = useMapStore.getState().entities[invocacao.tokenId];
    const de = { x: token.x, y: token.y };
    const para = { x: token.x + 70, y: token.y };
    useMapStore.getState().addEntity({
      shape: 'RECT', x: para.x, y: para.y, w: 70, h: 70, rotation: 0,
      color: '#333333', label: 'Bloqueador', locked: true, layer: 'tokens',
    });
    useMapStore.getState().updateEntity(token.id, para);
    prepararMovimentoPendente(token.id, token.invocationInstanceId!, de, 1.5, 'movimento-token', [de, para]);

    expect(confirmarMovimentoInvocacao({
      tokenId: token.id,
      instanciaId: token.invocationInstanceId!,
      de,
      para,
      trajetoria: [de, para],
      distanciaM: 1.5,
      requestId: 'movimento-token',
    })).toEqual({ ok: false, motivo: 'A trajetória está bloqueada por uma parede, área ou token.' });
    expect(pegarFicha('dono').instanciasInvocacao?.[0].economiaAcoes?.acaoMovimento?.atual).toBe(1);
  });

  it('não confirma movimento de uma instância caída', () => {
    configurarEconomiaMovimento('a');
    const invocacao = invocarControlador('dono', 'a', 'leste');
    if (!invocacao.ok) throw new Error(invocacao.motivo);
    const token = useMapStore.getState().entities[invocacao.tokenId];
    useMapStore.getState().updateEntity(token.id, { hp: 0, invocationState: 'caida' });
    const posicao = { x: token.x, y: token.y };
    prepararMovimentoPendente(token.id, token.invocationInstanceId!, posicao, 0, 'movimento-caido', []);

    expect(confirmarMovimentoInvocacao({
      tokenId: token.id,
      instanciaId: token.invocationInstanceId!,
      de: posicao,
      para: posicao,
      trajetoria: [],
      distanciaM: 0,
      requestId: 'movimento-caido',
    })).toEqual({ ok: false, motivo: 'Invocação caída ou inativa não pode se mover.' });
    expect(pegarFicha('dono').instanciasInvocacao?.[0].economiaAcoes?.acaoMovimento?.atual).toBe(1);
  });

  it('concede o tempo configurado uma vez quando a instância é invocada no turno do dono', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T10:00:00.000Z'));
    configurarTempo('a', 2);
    useCombatStore.setState({
      inCombat: true, combatId: 'combate-tempo', round: 1, currentTurnIndex: 0,
      initiativeOrder: [{ charId: 'dono', charName: 'Dono', roll: 10, bonus: 0, total: 10 }],
      turnTimerEnabled: true, turnDurationSec: 60, turnBaseRemainingAtStart: 60,
      turnRemainingAtStart: 60, turnClockOwnerCharId: 'dono', turnTimeGrantEventIds: [],
      turnStartedAt: Date.now(), turnPaused: false, reactionPauseIds: [],
    } as never);
    try {
      const r = invocarControlador('dono', 'a', 'leste', { eventoId: 'evento-tempo-unico' });
      if (!r.ok) throw new Error(r.motivo);
      expect(useCombatStore.getState().turnRemainingAtStart).toBe(72);
      expect(pegarFicha('dono').instanciasInvocacao?.[0].contribuicaoTempo).toMatchObject({
        grantEventId: 'evento-tempo-unico', quantidadeConcedida: 12, quantidadeRestante: 12, estado: 'ativa',
      });
      expect(invocarControlador('dono', 'a', 'leste', { eventoId: 'evento-tempo-unico' })).toEqual(r);
      expect(useCombatStore.getState().turnRemainingAtStart).toBe(72);
    } finally {
      vi.useRealTimers();
    }
  });

  it('dissipação voluntária retira a reserva sem baixar o relógio abaixo de 10 segundos', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T10:00:00.000Z'));
    configurarTempo('a', 2);
    useCombatStore.setState({
      inCombat: true, combatId: 'combate-tempo', round: 1, currentTurnIndex: 0,
      initiativeOrder: [{ charId: 'dono', charName: 'Dono', roll: 10, bonus: 0, total: 10 }],
      turnTimerEnabled: true, turnDurationSec: 8, turnBaseRemainingAtStart: 8,
      turnRemainingAtStart: 8, turnClockOwnerCharId: 'dono', turnTimeGrantEventIds: [],
      turnStartedAt: Date.now(), turnPaused: false, reactionPauseIds: [],
    } as never);
    try {
      expect(invocarControlador('dono', 'a', 'leste').ok).toBe(true);
      expect(useCombatStore.getState().turnRemainingAtStart).toBe(20);
      expect(recolherInvocacao('dono', 'a')).toBe(true);
      expect(useCombatStore.getState().turnRemainingAtStart).toBe(10);
      expect(pegarFicha('dono').instanciasInvocacao?.[0].contribuicaoTempo).toMatchObject({ estado: 'retirada', quantidadeRestante: 0 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('converte em consolação o saldo de tempo restante quando a instância é derrotada', () => {
    configurarTempo('a', 2);
    useCombatStore.setState({ inCombat: false, combatId: null, turnTimerEnabled: false, turnPaused: true, reactionPauseIds: [], turnTimeGrantEventIds: [] } as never);
    const r = invocarControlador('dono', 'a', 'leste');
    if (!r.ok) throw new Error(r.motivo);
    expect(causarDanoInvocacao(r.tokenId, 24)).toMatchObject({ ok: true, hpRestante: -12, destruida: true });
    expect(pegarFicha('dono').instanciasInvocacao?.[0].contribuicaoTempo).toMatchObject({
      estado: 'consolacao', quantidadeConcedida: 12, quantidadeRestante: 12, removalReason: 'derrota_definitiva',
    });
  });

  it('cria token próprio na célula adjacente, preserva posse e desconta PE uma só vez', () => {
    const r = invocarControlador('dono', 'a', 'leste');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const token = useMapStore.getState().entities[r.tokenId];
    expect(token.ownerCharId).toBe('dono');
    expect(token.ownerProfileId).toBe('perfil-dono');
    expect(token.invocationId).toBe('a');
    expect(token.characterId).toBeUndefined();
    expect([token.x, token.y]).toEqual([210, 140]);
    expect([token.hp, token.hpMax, token.invocationDefense]).toEqual([12, 12, 14]);
    expect(pegarFicha('dono').peCurrent).toBe(7);
    expect(invocarControlador('dono', 'a', 'sul').ok).toBe(false);
    expect(pegarFicha('dono').peCurrent).toBe(7);
  });
  it('repete o mesmo evento de invocação sem criar outra instância nem cobrar PE novamente', () => {
    const eventoId = 'evento-repetido-controlador';
    const primeira = invocarControlador('dono', 'a', 'leste', { eventoId });
    if (!primeira.ok) throw new Error(primeira.motivo);
    const token = useMapStore.getState().entities[primeira.tokenId];
    expect(token.invocationEventId).toBe(eventoId);
    expect(token.invocationInstanceId).toMatch(/^instancia-/);

    const repetida = invocarControlador('dono', 'a', 'sul', { eventoId });
    expect(repetida).toEqual(primeira);
    expect(tokensInvocados('dono')).toHaveLength(1);
    expect(pegarFicha('dono').peCurrent).toBe(7);
  });
  it('recusa reutilizar o ID de evento para outra invocação sem cobrar PE', () => {
    const primeira = invocarControlador('dono', 'a', 'leste', { eventoId: 'evento-unico' });
    expect(primeira.ok).toBe(true);
    const segunda = invocarControlador('dono', 'b', 'sul', { eventoId: 'evento-unico' });
    expect(segunda).toEqual({ ok: false, motivo: 'Este ID de evento já pertence a outra invocação.' });
    expect(tokensInvocados('dono')).toHaveLength(1);
    expect(pegarFicha('dono').peCurrent).toBe(7);
  });
  it('materializa duas invocações em células escolhidas, cobra o PE total uma vez e mantém Ação Livre', () => {
    useCharacterStore.getState().updateCharacter('dono', { actionsCurrent: 1, bonusActionsCurrent: 1 });
    const acoesAntes = pegarFicha('dono').actionsCurrent;
    const bonusAntes = pegarFicha('dono').bonusActionsCurrent;
    const resultado = invocarControladores('dono', [
      { invocacaoId: 'a', x: 210, y: 140 },
      { invocacaoId: 'b', x: 140, y: 210 },
    ], { eventoId: 'lote-duplo' });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.tokenIds).toHaveLength(2);
    expect(tokensInvocados('dono')).toHaveLength(2);
    expect(pegarFicha('dono').peCurrent).toBe(4);
    expect(pegarFicha('dono').actionsCurrent).toBe(acoesAntes);
    expect(pegarFicha('dono').bonusActionsCurrent).toBe(bonusAntes);
    const tokens = resultado.tokenIds.map(id => useMapStore.getState().entities[id]);
    expect(tokens.map(token => [token.x, token.y])).toEqual([[210, 140], [140, 210]]);
    expect(tokens.every(token => token.invocationBatchId === 'lote-duplo')).toBe(true);
    expect(new Set(tokens.map(token => token.invocationInstanceId)).size).toBe(2);
  });
  it('repete um lote com o mesmo ID sem recriar tokens nem cobrar PE de novo', () => {
    const posicoes = [
      { invocacaoId: 'a', x: 210, y: 140 },
      { invocacaoId: 'b', x: 140, y: 210 },
    ];
    const primeira = invocarControladores('dono', posicoes, { eventoId: 'lote-idempotente' });
    if (!primeira.ok) throw new Error(primeira.motivo);
    const repetida = invocarControladores('dono', posicoes, { eventoId: 'lote-idempotente' });
    expect(repetida).toEqual(primeira);
    expect(tokensInvocados('dono')).toHaveLength(2);
    expect(pegarFicha('dono').peCurrent).toBe(4);
  });
  it('não duplica uma invocação derrotada quando o mesmo pedido é reenviado', () => {
    const r = invocarControlador('dono', 'a', 'leste', { eventoId: 'invocacao-antes-da-derrota' });
    if (!r.ok) throw new Error(r.motivo);
    expect(causarDanoInvocacao(r.tokenId, 24)).toEqual({ ok: true, hpRestante: -12, destruida: true });
    expect(invocarControlador('dono', 'a', 'leste', { eventoId: 'invocacao-antes-da-derrota' })).toEqual({
      ok: false,
      motivo: 'Este evento já foi resolvido; ele não pode materializar uma segunda instância.',
    });
    expect(tokensInvocados('dono')).toHaveLength(0);
    expect(pegarFicha('dono').peCurrent).toBe(7);
    expect(pegarFicha('dono').instanciasInvocacao).toHaveLength(1);
  });
  it('conta uma instância caída ainda presente no limite simultâneo', () => {
    const a = invocarControlador('dono', 'a', 'leste');
    const b = invocarControlador('dono', 'b', 'sul');
    if (!a.ok || !b.ok) throw new Error('As duas invocações iniciais deveriam ser aceitas.');
    expect(causarDanoInvocacao(a.tokenId, 12)).toMatchObject({ ok: true, hpRestante: 0, destruida: false });
    expect(invocarControlador('dono', 'c', 'oeste')).toEqual({ ok: false, motivo: 'Limite de invocações ativas atingido.' });
    expect(tokensInvocados('dono')).toHaveLength(2);
    expect(pegarFicha('dono').peCurrent).toBe(4);
  });
  it('valida o lote inteiro antes de criar tokens ou cobrar PE', () => {
    const dono = pegarFicha('dono');
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: (dono.invocacoesConhecidas ?? []).map(inv => inv.id === 'b' ? { ...inv, alcanceInvocacaoM: 0.5 } : inv),
    });
    const resultado = invocarControladores('dono', [
      { invocacaoId: 'a', x: 210, y: 140 },
      { invocacaoId: 'b', x: 280, y: 140 },
    ]);
    expect(resultado).toMatchObject({ ok: false, motivo: 'A posição de b está fora do alcance definido na ficha.' });
    expect(tokensInvocados('dono')).toHaveLength(0);
    expect(pegarFicha('dono').peCurrent).toBe(10);
  });
  it('rejeita ocupação e PE insuficiente sem materializar parte do lote', () => {
    useMapStore.getState().addEntity({
      shape: 'ELLIPSE', x: 140, y: 210, w: 70, h: 70, rotation: 0,
      color: '#000', locked: false,
    });
    const ocupado = invocarControladores('dono', [
      { invocacaoId: 'a', x: 210, y: 140 },
      { invocacaoId: 'b', x: 140, y: 210 },
    ]);
    expect(ocupado).toMatchObject({ ok: false, motivo: 'A célula escolhida para b está ocupada.' });
    expect(tokensInvocados('dono')).toHaveLength(0);
    expect(pegarFicha('dono').peCurrent).toBe(10);

    useCharacterStore.getState().updateCharacter('dono', { peCurrent: 5 });
    const blockerIds = Object.values(useMapStore.getState().entities).filter(entity => entity.x === 140 && entity.y === 210 && !entity.characterId).map(entity => entity.id);
    useMapStore.getState().removeEntities(blockerIds);
    const semPE = invocarControladores('dono', [
      { invocacaoId: 'a', x: 210, y: 140 },
      { invocacaoId: 'b', x: 140, y: 210 },
    ]);
    expect(semPE).toEqual({ ok: false, motivo: 'PE insuficiente para o lote selecionado.' });
    expect(tokensInvocados('dono')).toHaveLength(0);
    expect(pegarFicha('dono').peCurrent).toBe(5);
  });
  it('bloqueia posicionamento em parede ativa antes de cobrar PE', () => {
    useMapStore.getState().addWall({
      id: 'parede-bloqueante', kind: 'wall',
      p1: { x: 205, y: 100 }, p2: { x: 205, y: 180 },
    });
    const resultado = invocarControladores('dono', [{ invocacaoId: 'a', x: 210, y: 140 }]);
    expect(resultado).toEqual({
      ok: false,
      motivo: 'A célula escolhida para a está bloqueada por uma parede ou obstáculo.',
    });
    expect(tokensInvocados('dono')).toHaveLength(0);
    expect(pegarFicha('dono').peCurrent).toBe(10);
  });
  it('bloqueia fichas legadas sem alcance de posicionamento', () => {
    const dono = pegarFicha('dono');
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: (dono.invocacoesConhecidas ?? []).map(inv => {
        if (inv.id !== 'a') return inv;
        const { alcanceInvocacaoM: _alcance, ...legada } = inv;
        return legada;
      }),
    });
    const resultado = invocarControlador('dono', 'a', 'leste');
    expect(resultado).toEqual({ ok: false, motivo: 'Defina o alcance de posicionamento na ficha antes de invocar.' });
    expect(tokensInvocados('dono')).toHaveLength(0);
    expect(pegarFicha('dono').peCurrent).toBe(10);
  });
  it('rejeita um lote acima de duas invocações sem efeitos parciais', () => {
    const resultado = invocarControladores('dono', [
      { invocacaoId: 'a', x: 210, y: 140 },
      { invocacaoId: 'b', x: 140, y: 210 },
      { invocacaoId: 'c', x: 210, y: 210 },
    ]);
    expect(resultado).toEqual({ ok: false, motivo: 'Um uso permite posicionar uma ou duas invocações.' });
    expect(tokensInvocados('dono')).toHaveLength(0);
    expect(pegarFicha('dono').peCurrent).toBe(10);
  });
  it('reverte todos os tokens se a cobrança única de PE do lote falhar', () => {
    const state = useCharacterStore.getState();
    const updateSpy = vi.spyOn(state, 'updateCharacter').mockImplementation(() => {
      throw new Error('falha simulada ao salvar o custo');
    });
    try {
      const resultado = invocarControladores('dono', [
        { invocacaoId: 'a', x: 210, y: 140 },
        { invocacaoId: 'b', x: 140, y: 210 },
      ], { eventoId: 'lote-falha-custo' });
      expect(resultado).toEqual({
        ok: false,
        motivo: 'Não foi possível concluir o lote; os efeitos locais foram desfeitos.',
      });
      expect(tokensInvocados('dono')).toHaveLength(0);
      expect(pegarFicha('dono').peCurrent).toBe(10);
    } finally {
      updateSpy.mockRestore();
    }
  });
  it('bloqueia o uso sem intermediário em mãos e registra o override do Mestre', () => {
    useInventoryStore.getState().definirEmMaos(`item-${numeroFixture}-a`, false);
    const bloqueada = invocarControlador('dono', 'a', 'leste');
    expect(bloqueada.ok).toBe(false);
    expect(pegarFicha('dono').peCurrent).toBe(10);
    const overrideSemPermissao = invocarControlador('dono', 'a', 'leste', { motivoOverrideIntermediario: 'Tentativa de override por jogador.' });
    expect(overrideSemPermissao).toMatchObject({ ok: false, motivo: 'Somente o Mestre pode ignorar a validação do intermediário.' });
    expect(pegarFicha('dono').peCurrent).toBe(10);
    comoTela({ profileId: 'perfil-mestre', role: 'MASTER' });
    const aprovada = invocarControlador('dono', 'a', 'leste', { motivoOverrideIntermediario: 'O Mestre confirmou a exceção para esta cena.' });
    expect(aprovada.ok).toBe(true);
    expect(pegarFicha('dono').peCurrent).toBe(7);
    expect(useLogStore.getState().logs[0]).toMatchObject({ sourceRole: 'MASTER' });
    expect(useLogStore.getState().logs[0].message).toContain('O Mestre confirmou a exceção para esta cena.');
  });
  it('materializa arte, recorte, forma, cor e nomeplate da ficha', () => {
    const dono = pegarFicha('dono');
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: (dono.invocacoesConhecidas ?? []).map(inv => inv.id === 'a' ? {
        ...inv, apelido: 'Sombra', imagemAssetId: 'arte-principal', imagemFallbackAssetId: 'arte-alternativa',
        formaToken: 'RECT', corIdentificacao: '#123456', nomeplate: false,
        tokenCrop: { zoom: 1.5, offsetX: 12, offsetY: -4 },
      } : inv),
    });
    const resultado = invocarControlador('dono', 'a', 'leste');
    if (!resultado.ok) throw new Error(resultado.motivo);
    const token = useMapStore.getState().entities[resultado.tokenId];
    expect(token.shape).toBe('RECT');
    expect(token.assetId).toBe('arte-principal');
    expect(token.invocationFallbackAssetId).toBe('arte-alternativa');
    expect(token.tokenCrop).toEqual({ zoom: 1.5, offsetX: 12, offsetY: -4 });
    expect(token.color).toBe('#123456');
    expect(token.label).toBe('Sombra');
    expect(token.nameplate).toBe(false);
  });
  it('não permite materializar sem aprovação do Mestre', () => {
    const dono = pegarFicha('dono');
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: (dono.invocacoesConhecidas ?? []).map(i => i.id === 'a' ? { ...i, aprovacaoMestre: 'pendente' } : i),
    });
    expect(invocarControlador('dono', 'a', 'leste').ok).toBe(false);
    expect(pegarFicha('dono').peCurrent).toBe(10);
    const atual = pegarFicha('dono');
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: (atual.invocacoesConhecidas ?? []).map(i => i.id === 'a' ? { ...i, aprovacaoMestre: 'aprovada' } : i),
    });
    expect(invocarControlador('dono', 'a', 'leste').ok).toBe(true);
    expect(pegarFicha('dono').peCurrent).toBe(7);
  });
  it('respeita limite, ocupação e PE sem criar tokens indevidos', () => {
    expect(invocarControlador('dono', 'a', 'leste').ok).toBe(true);
    expect(invocarControlador('dono', 'b', 'sul').ok).toBe(true);
    expect(invocarControlador('dono', 'c', 'oeste').ok).toBe(false);
    expect(tokensInvocados('dono')).toHaveLength(2);
  });
  it('remove o token se a cobrança de PE falhar no meio da transação', () => {
    const atual = useCharacterStore.getState();
    const updateSpy = vi.spyOn(atual, 'updateCharacter').mockImplementation(() => {
      throw new Error('falha simulada ao salvar o custo');
    });
    try {
      const resultado = invocarControlador('dono', 'a', 'leste', { eventoId: 'evento-falha-custo' });
      expect(resultado).toEqual({
        ok: false,
        motivo: 'Não foi possível concluir a invocação; os efeitos locais foram desfeitos.',
      });
      expect(tokensInvocados('dono')).toHaveLength(0);
      expect(pegarFicha('dono').peCurrent).toBe(10);
    } finally {
      updateSpy.mockRestore();
    }
  });
  it('recolhe sem reembolso e libera o slot para nova invocação', () => {
    expect(invocarControlador('dono', 'a', 'leste').ok).toBe(true);
    expect(recolherInvocacao('dono', 'a')).toBe(true);
    expect(tokensInvocados('dono')).toHaveLength(0);
    expect(pegarFicha('dono').peCurrent).toBe(7);
    expect(invocarControlador('dono', 'b', 'leste').ok).toBe(true);
  });
  it('mantém a instância no mapa a 0 PV e só a remove ao atingir -PV máximo', () => {
    const r = invocarControlador('dono', 'a', 'leste');
    if (!r.ok) throw new Error(r.motivo);
    expect(causarDanoInvocacao(r.tokenId, 5)).toEqual({ ok: true, hpRestante: 7, destruida: false });
    expect(pegarFicha('dono').invocacoesConhecidas?.find(i => i.id === 'a')?.hpAtual).toBe(7);
    expect(causarDanoInvocacao(r.tokenId, 7)).toEqual({ ok: true, hpRestante: 0, destruida: false });
    expect(useMapStore.getState().entities[r.tokenId].invocationState).toBe('caida');
    expect(tokensInvocados('dono')).toHaveLength(1);
    expect(pegarFicha('dono').instanciasInvocacao?.[0]).toMatchObject({ estado: 'caida', hpAtual: 0 });
    expect(causarDanoInvocacao(r.tokenId, 11)).toEqual({ ok: true, hpRestante: -11, destruida: false });
    expect(tokensInvocados('dono')).toHaveLength(1);
    expect(causarDanoInvocacao(r.tokenId, 1)).toEqual({ ok: true, hpRestante: -12, destruida: true });
    expect(tokensInvocados('dono')).toHaveLength(0);
    expect(pegarFicha('dono').invocacoesConhecidas?.find(i => i.id === 'a')?.hpAtual).toBe(0);
    expect(pegarFicha('dono').instanciasInvocacao?.[0]).toMatchObject({ estado: 'derrotada', hpAtual: -12 });
    expect(pegarFicha('dono').invocacoesConhecidas).toHaveLength(3);
  });
  it('cura PV negativos até o máximo sem levantar; levantar gasta movimento próprio', () => {
    const dono = pegarFicha('dono');
    const inv = modelo('a', numeroFixture);
    useCharacterStore.getState().updateCharacter('dono', {
      invocacoesConhecidas: (dono.invocacoesConhecidas ?? []).map(item => item.id === 'a'
        ? { ...inv, economiaAcoesConfigurada: { acaoMovimento: 1 } }
        : item),
    });
    const r = invocarControlador('dono', 'a', 'leste');
    if (!r.ok) throw new Error(r.motivo);
    expect(causarDanoInvocacao(r.tokenId, 17)).toMatchObject({ ok: true, hpRestante: -5, destruida: false });
    expect(curarInvocacao(r.tokenId, 8)).toEqual({ ok: true, hpRestante: 3, caida: true });
    expect(curarInvocacao(r.tokenId, 50)).toEqual({ ok: true, hpRestante: 12, caida: true });
    expect(useMapStore.getState().entities[r.tokenId].invocationState).toBe('caida');
    expect(levantarInvocacao('dono', 'a')).toEqual({ ok: true });
    expect(useMapStore.getState().entities[r.tokenId].invocationState).toBe('ativa');
    expect(pegarFicha('dono').instanciasInvocacao?.[0].economiaAcoes?.acaoMovimento).toEqual({ atual: 0, maximo: 1 });
    expect(levantarInvocacao('dono', 'a')).toMatchObject({ ok: false });
  });
  it('exige cura acima de zero e Ação de Movimento própria para levantar', () => {
    const r = invocarControlador('dono', 'a', 'leste');
    if (!r.ok) throw new Error(r.motivo);
    expect(causarDanoInvocacao(r.tokenId, 12)).toMatchObject({ ok: true, hpRestante: 0, destruida: false });
    expect(levantarInvocacao('dono', 'a')).toEqual({ ok: false, motivo: 'É preciso curar a invocação acima de 0 PV antes de levantá-la.' });
    expect(curarInvocacao(r.tokenId, 4)).toEqual({ ok: true, hpRestante: 4, caida: true });
    expect(levantarInvocacao('dono', 'a')).toEqual({ ok: false, motivo: 'Ação de Movimento própria indisponível.' });
  });
  it('bloqueia comandos fora do turno e cobra apenas uma ação bônus válida', () => {
    const r = invocarControlador('dono', 'a', 'leste');
    if (!r.ok) throw new Error(r.motivo);
    expect(comandarReposicionamento('dono', 'a', 'norte').ok).toBe(false);
    expect(pegarFicha('dono').bonusActionsCurrent ?? 0).toBe(0);
  });
  it('reposiciona uma célula no turno do dono usando a Ação Livre própria', () => {
    const dono = pegarFicha('dono');
    useCharacterStore.getState().updateCharacter('dono', {
      bonusActionsCurrent: 1,
      invocacoesConhecidas: (dono.invocacoesConhecidas ?? []).map(inv => inv.id === 'a'
        ? { ...inv, economiaAcoesConfigurada: { acaoLivre: 1 } }
        : inv),
    });
    const r = invocarControlador('dono', 'a', 'leste');
    if (!r.ok) throw new Error(r.motivo);
    useCombatStore.setState({ inCombat: true, initiativeOrder: [{ charId: 'dono', initiative: 10 }], currentTurnIndex: 0 } as never);
    expect(comandarReposicionamento('dono', 'a', 'leste')).toEqual({ ok: true });
    expect(useMapStore.getState().entities[r.tokenId].x).toBe(280);
    expect(pegarFicha('dono').bonusActionsCurrent).toBe(1);
    expect(pegarFicha('dono').instanciasInvocacao?.[0].economiaAcoes?.acaoLivre).toEqual({ atual: 0, maximo: 1 });
    expect(comandarReposicionamento('dono', 'a', 'leste').ok).toBe(false);
    useCombatStore.setState({ inCombat: false } as never);
  });
  it('rejeita alvo fora do alcance sem gastar Ação Comum', async () => {
    const inv = { ...modelo('a'), economiaAcoesConfigurada: { acaoComum: 1 }, acoes: [{ id: 'mordida', nome: 'Mordida', tipo: 'ataque' as const, alcanceM: 1.5, dano: '1d6' }] };
    useCharacterStore.getState().updateCharacter('dono', { actionsCurrent: 1, invocacoesConhecidas: [inv] });
    const target = ficha('inimigo', { hpCurrent: 15, hpMax: 15, ca: 10 });
    useCharacterStore.setState({ characters: [...useCharacterStore.getState().characters, target] });
    useMapStore.getState().addEntity({ shape: 'ELLIPSE', x: 700, y: 0, w: 70, h: 70, rotation: 0,
      color: '#000', locked: false, characterId: 'inimigo' });
    const summoned = invocarControlador('dono', 'a', 'leste');
    expect(summoned.ok).toBe(true);
    useCombatStore.setState({ inCombat: true, initiativeOrder: [{ charId: 'dono', initiative: 10 }], currentTurnIndex: 0 } as never);
    expect((await comandarAtaque('dono', 'a', 'mordida', 'inimigo')).ok).toBe(false);
    expect(pegarFicha('dono').actionsCurrent).toBe(1);
    expect(pegarFicha('dono').instanciasInvocacao?.[0].economiaAcoes?.acaoComum).toEqual({ atual: 1, maximo: 1 });
    useCombatStore.setState({ inCombat: false } as never);
  });
  it('ataque comandado que erra gasta exatamente uma Ação Comum', async () => {
    const inv = { ...modelo('a'), economiaAcoesConfigurada: { acaoComum: 1 }, acoes: [{ id: 'mordida', nome: 'Mordida', tipo: 'ataque' as const, alcanceM: 1.5, dano: '1d6' }] };
    useCharacterStore.getState().updateCharacter('dono', { actionsCurrent: 1, invocacoesConhecidas: [inv] });
    useCharacterStore.setState({ characters: [...useCharacterStore.getState().characters,
      ficha('inimigo', { hpCurrent: 15, hpMax: 15, ca: 30 })] });
    useMapStore.getState().addEntity({ shape: 'ELLIPSE', x: 280, y: 140, w: 70, h: 70, rotation: 0,
      color: '#000', locked: false, characterId: 'inimigo' });
    expect(invocarControlador('dono', 'a', 'leste').ok).toBe(true);
    useCombatStore.setState({ inCombat: true, initiativeOrder: [{ charId: 'dono', initiative: 10 }], currentTurnIndex: 0 } as never);
    const { useDice3DStore } = await import('@/stores/useDice3DStore');
    vi.spyOn(useDice3DStore.getState(), 'requestRoll').mockResolvedValue([2]);
    const r = await comandarAtaque('dono', 'a', 'mordida', 'inimigo');
    expect(r).toMatchObject({ ok: true, acertou: false, dano: 0 });
    expect(pegarFicha('dono').actionsCurrent).toBe(1);
    expect(pegarFicha('dono').instanciasInvocacao?.[0].economiaAcoes?.acaoComum).toEqual({ atual: 0, maximo: 1 });
    expect(pegarFicha('inimigo').hpCurrent).toBe(15);
    useCombatStore.setState({ inCombat: false } as never);
    vi.restoreAllMocks();
  });
  it('acerto comandado usa bônus e tipo do servo, com dados 3D e pipeline de dano', async () => {
    const inv = { ...modelo('a'), economiaAcoesConfigurada: { acaoComum: 1 }, acoes: [{
      id: 'mordida', nome: 'Mordida', tipo: 'ataque' as const, alcanceM: 1.5,
      dano: '1d6+2', bonusAtaque: 3, tipoDano: 'DP' as const,
    }] };
    useCharacterStore.getState().updateCharacter('dono', { actionsCurrent: 1, invocacoesConhecidas: [inv] });
    useCharacterStore.setState({ characters: [...useCharacterStore.getState().characters,
      ficha('inimigo', { hpCurrent: 15, hpMax: 15, ca: 13 })] });
    useMapStore.getState().addEntity({ shape: 'ELLIPSE', x: 280, y: 140, w: 70, h: 70, rotation: 0,
      color: '#000', locked: false, characterId: 'inimigo' });
    expect(invocarControlador('dono', 'a', 'leste').ok).toBe(true);
    useCombatStore.setState({ inCombat: true, initiativeOrder: [{ charId: 'dono', initiative: 10 }], currentTurnIndex: 0 } as never);
    const { useDice3DStore } = await import('@/stores/useDice3DStore');
    vi.spyOn(useDice3DStore.getState(), 'requestRoll').mockResolvedValue([12]);
    vi.spyOn(useDice3DStore.getState(), 'requestNotation').mockResolvedValue([4]);
    const damage = vi.spyOn(useCharacterStore.getState(), 'applyDamage').mockResolvedValue();
    const result = await comandarAtaque('dono', 'a', 'mordida', 'inimigo');
    expect(result).toEqual({ ok: true, acertou: true, totalAtaque: 15, dano: 6 });
    expect(damage).toHaveBeenCalledWith('inimigo', 6, 'DP', { attackerId: 'dono' });
    expect(pegarFicha('dono').actionsCurrent).toBe(1);
    expect(pegarFicha('dono').instanciasInvocacao?.[0].economiaAcoes?.acaoComum).toEqual({ atual: 0, maximo: 1 });
    useCombatStore.setState({ inCombat: false } as never);
    vi.restoreAllMocks();
  });
  it('debita custos de comando da origem configurada sem cobrar recursos não selecionados', async () => {
    const inv = {
      ...modelo('a'),
      economiaAcoesConfigurada: { acaoComum: 1 },
      recursosConfigurados: [{ id: 'pe', nome: 'PE próprio', valorInicial: 2, valorMaximo: 2 }],
      custosComandosConfigurados: {
        mordida: {
          execucao: 'manual' as const,
          debitos: [
            { entidade: 'dono' as const, recurso: 'pe' as const, quantidade: 1 },
            { entidade: 'invocacao' as const, recurso: 'pe' as const, recursoId: 'pe', quantidade: 1 },
          ],
        },
      },
      acoes: [{ id: 'mordida', nome: 'Mordida', tipo: 'ataque' as const, alcanceM: 1.5, dano: '1d6', custoPE: 2 }],
    };
    useCharacterStore.getState().updateCharacter('dono', { peCurrent: 10, invocacoesConhecidas: [inv] });
    useCharacterStore.setState({ characters: [...useCharacterStore.getState().characters,
      ficha('inimigo', { hpCurrent: 15, hpMax: 15, ca: 30 })] });
    useMapStore.getState().addEntity({ shape: 'ELLIPSE', x: 280, y: 140, w: 70, h: 70, rotation: 0,
      color: '#000', locked: false, characterId: 'inimigo' });
    expect(invocarControlador('dono', 'a', 'leste').ok).toBe(true);
    useCombatStore.setState({ inCombat: true, initiativeOrder: [{ charId: 'dono', initiative: 10 }], currentTurnIndex: 0 } as never);
    const { useDice3DStore } = await import('@/stores/useDice3DStore');
    vi.spyOn(useDice3DStore.getState(), 'requestRoll').mockResolvedValue([2]);
    const result = await comandarAtaque('dono', 'a', 'mordida', 'inimigo');
    expect(result).toMatchObject({ ok: true, acertou: false });
    expect(pegarFicha('dono').peCurrent).toBe(6);
    expect(pegarFicha('dono').instanciasInvocacao?.[0]).toMatchObject({
      economiaAcoes: { acaoComum: { atual: 0, maximo: 1 } },
      recursosAtuais: { pe: 1 },
    });
    useCombatStore.setState({ inCombat: false } as never);
    vi.restoreAllMocks();
  });
  it('não gasta ação nem PE do dono se o recurso da invocação estiver insuficiente', async () => {
    const inv = {
      ...modelo('a'),
      economiaAcoesConfigurada: { acaoComum: 1 },
      recursosConfigurados: [{ id: 'pe', nome: 'PE próprio', valorInicial: 1, valorMaximo: 1 }],
      custosComandosConfigurados: {
        mordida: {
          execucao: 'manual' as const,
          debitos: [
            { entidade: 'dono' as const, recurso: 'pe' as const, quantidade: 1 },
            { entidade: 'invocacao' as const, recurso: 'pe' as const, recursoId: 'pe', quantidade: 1 },
          ],
        },
      },
      acoes: [{ id: 'mordida', nome: 'Mordida', tipo: 'ataque' as const, alcanceM: 1.5, dano: '1d6', custoPE: 2 }],
    };
    useCharacterStore.getState().updateCharacter('dono', { peCurrent: 10, invocacoesConhecidas: [inv] });
    useCharacterStore.setState({ characters: [...useCharacterStore.getState().characters,
      ficha('inimigo', { hpCurrent: 15, hpMax: 15, ca: 10 })] });
    useMapStore.getState().addEntity({ shape: 'ELLIPSE', x: 280, y: 140, w: 70, h: 70, rotation: 0,
      color: '#000', locked: false, characterId: 'inimigo' });
    expect(invocarControlador('dono', 'a', 'leste').ok).toBe(true);
    const dono = pegarFicha('dono');
    useCharacterStore.getState().updateCharacter('dono', {
      instanciasInvocacao: (dono.instanciasInvocacao ?? []).map(instance => ({ ...instance, recursosAtuais: { pe: 0 } })),
    });
    useCombatStore.setState({ inCombat: true, initiativeOrder: [{ charId: 'dono', initiative: 10 }], currentTurnIndex: 0 } as never);
    expect(await comandarAtaque('dono', 'a', 'mordida', 'inimigo')).toMatchObject({ ok: false });
    expect(pegarFicha('dono').peCurrent).toBe(7);
    expect(pegarFicha('dono').instanciasInvocacao?.[0].economiaAcoes?.acaoComum).toEqual({ atual: 1, maximo: 1 });
    useCombatStore.setState({ inCombat: false } as never);
  });
  it('progride a cota de comandos nos níveis 1, 6, 12 e 18', () => {
    expect([1, 6, 12, 18].map(comandosPorAcao)).toEqual([1, 2, 3, 4]);
  });
  it('cada instância gasta seu próprio saldo e não usa os créditos de ação do dono', async () => {
    const inv = { ...modelo('a'), economiaAcoesConfigurada: { acaoComum: 2 }, acoes: [{ id: 'mordida', nome: 'Mordida', tipo: 'ataque' as const, alcanceM: 1.5, dano: '1d6' }] };
    useCharacterStore.getState().updateCharacter('dono', { level: 6, actionsCurrent: 1, invocacoesConhecidas: [inv] });
    useCharacterStore.setState({ characters: [...useCharacterStore.getState().characters,
      ficha('inimigo', { hpCurrent: 15, hpMax: 15, ca: 30 })] });
    useMapStore.getState().addEntity({ shape: 'ELLIPSE', x: 280, y: 140, w: 70, h: 70,
      rotation: 0, color: '#000', locked: false, characterId: 'inimigo' });
    expect(invocarControlador('dono', 'a', 'leste').ok).toBe(true);
    useCombatStore.setState({ inCombat: true, round: 1, initiativeOrder: [{ charId: 'dono', initiative: 10 }], currentTurnIndex: 0 } as never);
    const { useDice3DStore } = await import('@/stores/useDice3DStore');
    vi.spyOn(useDice3DStore.getState(), 'requestRoll').mockResolvedValue([2]);
    expect((await comandarAtaque('dono', 'a', 'mordida', 'inimigo')).ok).toBe(true);
    expect(pegarFicha('dono').actionsCurrent).toBe(1);
    expect(pegarFicha('dono').instanciasInvocacao?.[0].economiaAcoes?.acaoComum).toEqual({ atual: 1, maximo: 2 });
    expect((await comandarAtaque('dono', 'a', 'mordida', 'inimigo')).ok).toBe(true);
    expect(pegarFicha('dono').instanciasInvocacao?.[0].economiaAcoes?.acaoComum).toEqual({ atual: 0, maximo: 2 });
    expect((await comandarAtaque('dono', 'a', 'mordida', 'inimigo')).ok).toBe(false);
    expect(pegarFicha('dono').actionsCurrent).toBe(1);
    useCombatStore.setState({ inCombat: false } as never);
    vi.restoreAllMocks();
  });
  it('normaliza estado legado: 0 PV permanece Caído e −PV máximo registra derrota sem apagar a ficha', () => {
    const r = invocarControlador('dono', 'a', 'leste');
    if (!r.ok) throw new Error(r.motivo);
    useMapStore.getState().updateEntity(r.tokenId, { hp: 0 });
    expect(limparInvocacoesDerrotadas('dono')).toBe(0);
    expect(tokensInvocados('dono')).toHaveLength(1);
    expect(useMapStore.getState().entities[r.tokenId].invocationState).toBe('caida');
    useMapStore.getState().updateEntity(r.tokenId, { hp: -12 });
    expect(limparInvocacoesDerrotadas('dono')).toBe(1);
    expect(tokensInvocados('dono')).toHaveLength(0);
    expect(pegarFicha('dono').invocacoesConhecidas?.find(i => i.id === 'a')?.hpAtual).toBe(0);
    expect(pegarFicha('dono').instanciasInvocacao?.[0]).toMatchObject({ estado: 'derrotada', hpAtual: -12 });
    expect(invocarControlador('dono', 'a', 'leste').ok).toBe(false);
  });
});
