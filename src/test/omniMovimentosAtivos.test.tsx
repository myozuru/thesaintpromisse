// @vitest-environment jsdom
import { useState } from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async (original) => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
import { ficha, montarMesa, pegarFicha, limparMesa, comoTela, esperar, forcarDados } from './helpers/mesaReal';
import { useMapStore } from '@/stores/useMapStore';
import { useFogStore } from '@/stores/fogStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useOpportunityStore } from '@/stores/useOpportunityStore';
import { executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { prepararMovimentosAtivos, aplicarMovimentoAtivo } from '@/lib/omni/movimentosAtivos';
import { EditorAcoesAtivas } from '@/components/omni/EditorAcoesAtivas';
import { novaEntidade, type AcaoAtivaConfig, type EfeitoMovimentoAtivo, type EntidadeOmni } from '@/lib/omni/tipos';
import { PacoteOmniSchema } from '@/lib/omni/validacao';

const ef = (tipo: EfeitoMovimentoAtivo['movimento_tipo'], distancia = '6', sujeito: 'usuario' | 'alvo' = 'usuario'): EfeitoMovimentoAtivo => ({ tipo: 'movimento', movimento_tipo: tipo, movimento_distancia: distancia, movimento_alvo: sujeito });
const cfg = (efeito: EfeitoMovimentoAtivo): AcaoAtivaConfig => ({ id: 'm', nome: 'Mover', acao: 'comum', custoPE: '2', alcanceM: 18, teste: 'nenhum', efeitos: [efeito] });
const pos = (id: string) => useMapStore.getState().entities[`e-${id}`];
const mesa = (a = 4) => {
  montarMesa([ficha('u', { actionsCurrent: 1, omniCounters: { foco: 2 } }), ficha('a', { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, escCurrent: 0 })], { u: [0, 0], a: [a, 0] });
};
const wall = (x: number, kind: 'wall' | 'door' = 'wall', open = false) => useMapStore.setState({ walls: [{ id: 'w', kind, open, p1: { x, y: -300 }, p2: { x, y: 300 } }] });
beforeEach(() => {
  comoTela({ profileId: null, role: 'MASTER' });
  useMapStore.setState({ walls: [] }); useFogStore.setState({ walls: [], doors: [] });
  useCombatStore.setState({ movementUsedByChar: { u: 3 }, inCombat: true });
  useOpportunityStore.setState({ pending: null, grants: {} });
});
afterEach(async () => {
  cleanup(); await import('@/lib/omni/eventBus'); await import('@/lib/omni/observadores'); await esperar();
  useCombatStore.setState({ inCombat: false }); limparMesa();
});

describe('movimentos genéricos no combate real', () => {
  it('puxar para na adjacência e consome a distância calculada antes das cargas', async () => {
    mesa();
    const r = await executarAcaoAtiva('u', { ...cfg(ef('puxar', '3 * @USUARIO.foco')), consumirContador: { nome: 'foco', minimo: 1 } }, 'a');
    expect(r.ok).toBe(true); expect(pos('a').x).toBe(70); expect(pegarFicha('u').omniCounters?.foco).toBe(0);
    expect(useCombatStore.getState().movementUsedByChar.u).toBe(3);
  });
  it('empurra em linha reta também quando o alvo não está alinhado à grade', async () => {
    mesa(2); useMapStore.getState().updateEntity('e-a', { y: 70 });
    expect((await executarAcaoAtiva('u', cfg(ef('empurrar', '3')), 'a')).ok).toBe(true);
    expect(pos('a').x).toBe(280); expect(pos('a').y).toBe(140);
  });
  it('puxar respeita paredes e não desliza através delas', async () => {
    mesa(); wall(140);
    const r = await executarAcaoAtiva('u', cfg(ef('puxar')), 'a');
    expect(r.ok).toBe(true); expect(pos('a').x).toBeGreaterThanOrEqual(175); expect(pos('a').x).toBeLessThan(176);
    expect(r.ok && r.detalhe).toContain('obstáculo');
  });
  it.each([false, true])('porta aberta=%s controla passagem', async open => {
    mesa(); wall(140, 'door', open);
    await executarAcaoAtiva('u', cfg(ef('puxar')), 'a');
    expect(pos('a').x < 100).toBe(open);
  });
  it('para na primeira peça ocupada, sem atravessá-la', async () => {
    mesa(1);
    useMapStore.getState().addEntity({ ...pos('a'), id: 'bloqueio', characterId: 'outro', x: 210 });
    await executarAcaoAtiva('u', cfg(ef('empurrar')), 'a');
    expect(pos('a').x).toBeLessThanOrEqual(140); expect(pos('a').x).toBeGreaterThan(139);
  });
  it('adjacência considera o tamanho de duas peças grandes', async () => {
    mesa(6); useMapStore.getState().updateEntity('e-u', { w: 140, h: 140 }); useMapStore.getState().updateEntity('e-a', { w: 140, h: 140 });
    await executarAcaoAtiva('u', cfg(ef('puxar', '9')), 'a');
    expect(pos('a').x).toBeCloseTo(140, 5);
  });
  it('avança até adjacente sem consumir movimento comum; limite menor faz avanço parcial', async () => {
    mesa(); await executarAcaoAtiva('u', cfg(ef('avancar_ate')), 'a');
    expect(pos('u').x).toBe(210); expect(useCombatStore.getState().movementUsedByChar.u).toBe(3);
    mesa(); await executarAcaoAtiva('u', cfg(ef('avancar_ate', '3')), 'a');
    expect(pos('u').x).toBe(140);
  });
  it('imunidade impede deslocamento do alvo mas não elimina o dano do golpe', async () => {
    mesa(); useCharacterStore.getState().updateCharacter('a', { characterClass: 'Feiticeiro', specialization: 'Especialista em Combate', chosenSpecAbilities: [{ abilityId: 'ec-assumir-postura', chosenAtLevel: 2 }], posturaAtiva: { id: 'terra', untilRound: 9 } });
    const r = await executarAcaoAtiva('u', { ...cfg(ef('puxar')), dano: '4' }, 'a');
    expect(r.ok && r.detalhe).toContain('imune'); expect(pos('a').x).toBe(280); expect(pegarFicha('a').hpCurrent).toBe(96);
  });
  it('teleporta usuário através da parede, sem AdO nem orçamento comum', async () => {
    mesa(); wall(70);
    const r = await executarAcaoAtiva('u', cfg(ef('teleporte')), 'a', undefined, { destinosMovimento: { 'a:0': { x: 140, y: 140 } } });
    expect(r.ok).toBe(true); expect(pos('u').x).toBe(140); expect(pos('u').y).toBe(140);
    expect(useOpportunityStore.getState().pending).toBeNull(); expect(useCombatStore.getState().movementUsedByChar.u).toBe(3);
  });
  it('teleporte do alvo mede distância da peça movida', async () => {
    mesa();
    const r = await executarAcaoAtiva('u', cfg(ef('teleporte', '1.5', 'alvo')), 'a', undefined, { destinosMovimento: { 'a:0': { x: 350, y: 0 } } });
    expect(r.ok).toBe(true); expect(pos('u').x).toBe(0); expect(pos('a').x).toBe(350);
  });
  it.each(['ocupado', 'parede', 'longe', 'nan'])('teleporte %s é recusado antes dos custos', async modo => {
    mesa(); if (modo === 'parede') wall(140);
    const ponto = modo === 'ocupado' ? { x: 280, y: 0 } : modo === 'longe' ? { x: 700, y: 0 } : modo === 'nan' ? { x: NaN, y: 0 } : { x: 140, y: 0 };
    const r = await executarAcaoAtiva('u', cfg(ef('teleporte')), 'a', undefined, { destinosMovimento: { 'a:0': ponto } });
    expect(r.ok).toBe(false); expect(pegarFicha('u').peCurrent).toBe(20); expect(pegarFicha('u').actionsCurrent).toBe(1); expect(pos('u').x).toBe(0);
  });
  it('troca de posição é atômica e permite atravessar parede sem atravessar destino bloqueado', async () => {
    mesa(); wall(140); const updates = vi.spyOn(useMapStore.getState(), 'updateEntities');
    const r = await executarAcaoAtiva('u', cfg(ef('trocar_posicao')), 'a');
    expect(r.ok).toBe(true); expect(updates).toHaveBeenCalledTimes(1); expect(pos('u').x).toBe(280); expect(pos('a').x).toBe(0);
  });
  it('troca recusada quando a peça maior não cabe no destino', async () => {
    mesa(); useMapStore.getState().updateEntity('e-u', { w: 140, h: 140 }); wall(330);
    const r = await executarAcaoAtiva('u', cfg(ef('trocar_posicao')), 'a');
    expect(r.ok).toBe(false); expect(pos('u').x).toBe(0); expect(pos('a').x).toBe(280); expect(pegarFicha('u').peCurrent).toBe(20);
  });
  it('teleporte revalida destino após a rolagem e não entra em peça criada depois', async () => {
    mesa();
    const planos = await prepararMovimentosAtivos('u', [pegarFicha('a')], [ef('teleporte')], { destinosMovimento: { 'a:0': { x: 140, y: 140 } } });
    expect(planos.ok).toBe(true);
    useMapStore.getState().addEntity({ ...pos('a'), id: 'obstaculo', x: 140, y: 140 });
    if (planos.ok) expect(aplicarMovimentoAtivo('u', 'a', planos.planos.get('a')![0])).toContain('bloqueado');
    expect(pos('u').x).toBe(0);
  });
  it('transporta peça carregada junto ao portador', async () => {
    mesa(); useMapStore.getState().addEntity({ ...pos('u'), id: 'carga', characterId: undefined, carriedBy: 'e-u', w: 20, h: 20 });
    await executarAcaoAtiva('u', cfg(ef('teleporte')), 'a', undefined, { destinosMovimento: { 'a:0': { x: 140, y: 140 } } });
    expect(useMapStore.getState().entities.carga.x).toBe(140); expect(useMapStore.getState().entities.carga.y).toBe(140);
  });
  it.each(['-1', '@USUARIO.key_inexistente', '1d6', '1/0'])('fórmula inválida %s não cobra nem move', async formula => {
    mesa(); const r = await executarAcaoAtiva('u', cfg(ef('empurrar', formula)), 'a');
    expect(r.ok).toBe(false); expect(pegarFicha('u').peCurrent).toBe(20); expect(pos('a').x).toBe(280);
  });
  it('TR bem sucedido impede o efeito secundário de movimento', async () => {
    mesa(); forcarDados(20);
    const r = await executarAcaoAtiva('u', { ...cfg(ef('empurrar')), teste: 'tr', cd: '10' }, 'a');
    expect(r.ok).toBe(true); expect(pos('a').x).toBe(280);
  });
});

describe('editor, mapa e pacotes', () => {
  it('editor cria teleporte do alvo com distância por fórmula e mantém o JSON', () => {
    const save = vi.fn(); function Tela() { const [ent, set] = useState<EntidadeOmni>({ ...novaEntidade('item', 'Teste'), acoesAtivas: [cfg(ef('puxar'))] }); return <EditorAcoesAtivas ent={ent} setEnt={e => { save(e); set(e); }} />; }
    render(<Tela />);
    fireEvent.change(screen.getByLabelText('Efeito 1 1'), { target: { value: 'teleporte' } });
    fireEvent.change(screen.getByLabelText('Quem teleporta 1 1'), { target: { value: 'alvo' } });
    fireEvent.change(screen.getByLabelText('Distância do movimento 1 1'), { target: { value: '3 * @USUARIO.foco' } });
    const ent = save.mock.lastCall![0]; const pacote = PacoteOmniSchema.parse({ formato: 'omni-engine.v1', nome: 'Teste', geradoEm: 0, entidades: [ent] });
    expect(pacote.entidades[0].acoesAtivas![0].efeitos![0]).toEqual(ef('teleporte', '3 * @USUARIO.foco', 'alvo'));
  });
  it('cancelar seletor do mapa não cobra; confirmação usa o ponto selecionado', async () => {
    mesa();
    const promessa = executarAcaoAtiva('u', cfg(ef('teleporte')), 'a');
    await waitFor(() => expect(useMapStore.getState().pendingAoEPlacement?.sourceLabel).toContain('Teleporte'));
    expect(pegarFicha('u').peCurrent).toBe(20); useMapStore.getState().resolveAoEPlacement(null);
    expect((await promessa).ok).toBe(false); expect(pegarFicha('u').peCurrent).toBe(20);
    const outra = executarAcaoAtiva('u', cfg(ef('teleporte')), 'a');
    await waitFor(() => expect(useMapStore.getState().pendingAoEPlacement).not.toBeNull());
    useMapStore.getState().resolveAoEPlacement({ id: 'p', kind: 'circle', x: 140, y: 140, rotation: 0, length: 7, width: 7, color: '#ffffff', opacity: 1 });
    expect((await outra).ok).toBe(true); expect(pos('u').x).toBe(140); expect(pegarFicha('u').peCurrent).toBe(18);
  });
});
