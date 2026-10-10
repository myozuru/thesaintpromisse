// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ficha, montarMesa, pegarFicha, comoTela } from './helpers/mesaReal';
import { useMapStore } from '@/stores/useMapStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useLogStore } from '@/stores/useLogStore';
import type { EntidadeOmni } from '@/lib/omni/tipos';
import { invocarControlador, invocarControladores, recolherInvocacao, tokensInvocados, limparInvocacoesDerrotadas, causarDanoInvocacao, comandarReposicionamento, comandarAtaque, comandosPorAcao } from '@/lib/controlador/mapa';
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
beforeEach(() => {
  numeroFixture += 1;
  useInventoryStore.getState().resetAll();
  useLogStore.getState().clearLogs();
  montarMesa([ficha('dono', {
    specialization: 'Controlador', profileId: 'perfil-dono', level: 1,
    peCurrent: 10, treinoControle: 1,
    invocacoesConhecidas: [modelo('a', numeroFixture), modelo('b', numeroFixture), modelo('c', numeroFixture)],
  })], { dono: [2, 2] });
  for (const id of ['a', 'b', 'c']) {
    const entidade: EntidadeOmni = { id: 'talisma-' + id, versao: 1, nome: 'Talismã ' + id, categoria: 'item', descricao: '', tags: [], criadoEm: 1, atualizadoEm: 1, duracao: { tipo: 'instantaneo' }, custos: [], gatilhos: [] };
    const item = useInventoryStore.getState().add('dono', entidade, { instanceId: `item-${numeroFixture}-${id}` });
    useInventoryStore.getState().definirEmMaos(item.instanceId, true);
  }
  comoTela({ profileId: 'perfil-dono', role: 'PLAYER' });
});
describe('Controlador — materialização real no mapa', () => {
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
  it('aplica dano no token, preserva PV do dono e remove ao chegar a zero', () => {
    const r = invocarControlador('dono', 'a', 'leste');
    if (!r.ok) throw new Error(r.motivo);
    expect(causarDanoInvocacao(r.tokenId, 5)).toEqual({ ok: true, hpRestante: 7, destruida: false });
    expect(pegarFicha('dono').invocacoesConhecidas?.find(i => i.id === 'a')?.hpAtual).toBe(7);
    expect(causarDanoInvocacao(r.tokenId, 7)).toEqual({ ok: true, hpRestante: 0, destruida: true });
    expect(tokensInvocados('dono')).toHaveLength(0);
    expect(pegarFicha('dono').invocacoesConhecidas?.find(i => i.id === 'a')?.hpAtual).toBe(0);
  });
  it('bloqueia comandos fora do turno e cobra apenas uma ação bônus válida', () => {
    const r = invocarControlador('dono', 'a', 'leste');
    if (!r.ok) throw new Error(r.motivo);
    expect(comandarReposicionamento('dono', 'a', 'norte').ok).toBe(false);
    expect(pegarFicha('dono').bonusActionsCurrent ?? 0).toBe(0);
  });
  it('reposiciona uma célula no turno do dono e desconta uma ação bônus', () => {
    const r = invocarControlador('dono', 'a', 'leste');
    if (!r.ok) throw new Error(r.motivo);
    useCombatStore.setState({ inCombat: true, initiativeOrder: [{ charId: 'dono', initiative: 10 }], currentTurnIndex: 0 } as never);
    useCharacterStore.getState().updateCharacter('dono', { bonusActionsCurrent: 1 });
    expect(comandarReposicionamento('dono', 'a', 'leste')).toEqual({ ok: true });
    expect(useMapStore.getState().entities[r.tokenId].x).toBe(280);
    expect(pegarFicha('dono').bonusActionsCurrent).toBe(0);
    expect(comandarReposicionamento('dono', 'a', 'leste').ok).toBe(false);
    useCombatStore.setState({ inCombat: false } as never);
  });
  it('rejeita alvo fora do alcance sem gastar Ação Comum', async () => {
    const inv = { ...modelo('a'), acoes: [{ id: 'mordida', nome: 'Mordida', tipo: 'ataque' as const, alcanceM: 1.5, dano: '1d6' }] };
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
    useCombatStore.setState({ inCombat: false } as never);
  });
  it('ataque comandado que erra gasta exatamente uma Ação Comum', async () => {
    const inv = { ...modelo('a'), acoes: [{ id: 'mordida', nome: 'Mordida', tipo: 'ataque' as const, alcanceM: 1.5, dano: '1d6' }] };
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
    expect(pegarFicha('dono').actionsCurrent).toBe(0);
    expect(pegarFicha('inimigo').hpCurrent).toBe(15);
    useCombatStore.setState({ inCombat: false } as never);
    vi.restoreAllMocks();
  });
  it('acerto comandado usa bônus e tipo do servo, com dados 3D e pipeline de dano', async () => {
    const inv = { ...modelo('a'), acoes: [{
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
    expect(pegarFicha('dono').actionsCurrent).toBe(0);
    useCombatStore.setState({ inCombat: false } as never);
    vi.restoreAllMocks();
  });
  it('progride a cota de comandos nos níveis 1, 6, 12 e 18', () => {
    expect([1, 6, 12, 18].map(comandosPorAcao)).toEqual([1, 2, 3, 4]);
  });
  it('nível 6 compartilha a mesma Ação Comum por dois ataques', async () => {
    const inv = { ...modelo('a'), acoes: [{ id: 'mordida', nome: 'Mordida', tipo: 'ataque' as const, alcanceM: 1.5, dano: '1d6' }] };
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
    expect(pegarFicha('dono').actionsCurrent).toBe(0);
    expect(pegarFicha('dono').comandosControle?.restantes).toBe(1);
    expect((await comandarAtaque('dono', 'a', 'mordida', 'inimigo')).ok).toBe(true);
    expect(pegarFicha('dono').comandosControle?.restantes).toBe(0);
    expect((await comandarAtaque('dono', 'a', 'mordida', 'inimigo')).ok).toBe(false);
    useCombatStore.setState({ inCombat: false } as never);
    vi.restoreAllMocks();
  });
  it('remove token com 0 PV e registra o estado no catálogo', () => {
    const r = invocarControlador('dono', 'a', 'leste');
    if (!r.ok) throw new Error(r.motivo);
    useMapStore.getState().updateEntity(r.tokenId, { hp: 0 });
    expect(limparInvocacoesDerrotadas('dono')).toBe(1);
    expect(tokensInvocados('dono')).toHaveLength(0);
    expect(pegarFicha('dono').invocacoesConhecidas?.find(i => i.id === 'a')?.hpAtual).toBe(0);
    expect(invocarControlador('dono', 'a', 'leste').ok).toBe(false);
  });
});
