// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ficha, montarMesa, pegarFicha, comoTela } from './helpers/mesaReal';
import { useMapStore } from '@/stores/useMapStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { invocarControlador, recolherInvocacao, tokensInvocados, limparInvocacoesDerrotadas, causarDanoInvocacao, comandarReposicionamento, comandarAtaque, comandosPorAcao } from '@/lib/controlador/mapa';
import type { InvocacaoControlador } from '@/lib/controlador/tipos';

function modelo(id: string): InvocacaoControlador {
  return {
    id, nome: id, donoCharacterId: 'dono', tipo: 'shikigami',
    hpAtual: 12, hpMaximo: 12, defesa: 14, deslocamentoM: 9,
    porte: 'Médio', custoInvocacaoPE: 3, acoes: [],
  };
}
beforeEach(() => {
  montarMesa([ficha('dono', {
    specialization: 'Controlador', profileId: 'perfil-dono', level: 1,
    peCurrent: 10, treinoControle: 1,
    invocacoesConhecidas: [modelo('a'), modelo('b'), modelo('c')],
  })], { dono: [2, 2] });
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
