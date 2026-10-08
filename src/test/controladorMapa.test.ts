// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { ficha, montarMesa, pegarFicha, comoTela } from './helpers/mesaReal';
import { useMapStore } from '@/stores/useMapStore';
import { invocarControlador, recolherInvocacao, tokensInvocados, limparInvocacoesDerrotadas, causarDanoInvocacao, comandarReposicionamento } from '@/lib/controlador/mapa';
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
