import { clicarAlvoMapa, terminarAlvoMapa, useAlvoMapaStore } from '@/stores/useAlvoMapaStore';
// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async (original) => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
import { EditorAcoesAtivas } from '@/components/omni/EditorAcoesAtivas';
import { AcoesAtivasSection } from '@/components/fichas/AcoesAtivasSection';
import { novaAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { novaEntidade, type EntidadeOmni, type AcaoAtivaConfig } from '@/lib/omni/tipos';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useMapStore } from '@/stores/useMapStore';
import { ficha, montarMesa, pegarFicha, limparMesa, comoTela, esperar } from './helpers/mesaReal';

beforeEach(() => {
  comoTela({ profileId: null, role: 'MASTER' });
  useInventoryStore.setState({ items: {} });
  useMapStore.setState({ initiative: { entries: [], turnIndex: -1, round: 0 } });
});
afterEach(async () => {
  cleanup();
  await import('@/lib/omni/eventBus');
  await import('@/lib/omni/observadores');
  await esperar();
  limparMesa();
});

function painel(cfg: Partial<AcaoAtivaConfig>) {
  montarMesa([
    ficha('heroi', { actionsCurrent: 1, hpCurrent: 100, hpMax: 100, escCurrent: 0 }),
    ficha('a', { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, escCurrent: 0 }),
    ficha('b', { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, escCurrent: 0 }),
  ], { heroi: [0, 0], a: [2, 0], b: [3, 0] });
  const ent = { ...novaEntidade('item', 'item'), acoesAtivas: [{ ...novaAcaoAtiva(), nome: 'Teste', custoPE: '2', dano: '4', tipoDano: 'Impacto', ...cfg }] };
  useInventoryStore.getState().add('heroi', ent);
  render(<AcoesAtivasSection charId="heroi" />);
}

describe('editor e execução por cliques reais', () => {
  it('salva tipo, filtro, fórmula e dimensões sem editar código', () => {
    const save = vi.fn();
    function Tela() {
      const [ent, setEnt] = useState<EntidadeOmni>({ ...novaEntidade('item', 'item'), acoesAtivas: [novaAcaoAtiva()] });
      return <EditorAcoesAtivas ent={ent} setEnt={e => { save(e); setEnt(e); }} />;
    }
    render(<Tela />);
    fireEvent.change(screen.getByLabelText('Tipo de alvo'), { target: { value: 'multiplo' } });
    fireEvent.change(screen.getByLabelText('Máximo de alvos'), { target: { value: '@USUARIO.treino' } });
    fireEvent.change(screen.getByLabelText('Filtro de alvos'), { target: { value: 'inimigos' } });
    expect(save.mock.lastCall![0].acoesAtivas[0]).toMatchObject({ tipo_alvo: 'multiplo', max_alvos: '@USUARIO.treino', filtro_alvo: 'inimigos' });
    fireEvent.change(screen.getByLabelText('Tipo de alvo'), { target: { value: 'area' } });
    fireEvent.change(screen.getByLabelText('Forma da área'), { target: { value: 'linha' } });
    fireEvent.change(screen.getByLabelText('Tamanho da área'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Largura da linha'), { target: { value: '3' } });
    expect(save.mock.lastCall![0].acoesAtivas[0].area).toEqual({ forma: 'linha', tamanho_m: 12, largura_m: 3 });
  });
  it('configura uma disputa de perícias e preserva as opções no editor', () => {
    const save = vi.fn();
    function Tela() {
      const [ent, setEnt] = useState<EntidadeOmni>({ ...novaEntidade('item', 'item'), acoesAtivas: [novaAcaoAtiva()] });
      return <EditorAcoesAtivas ent={ent} setEnt={e => { save(e); setEnt(e); }} />;
    }
    render(<Tela />);
    fireEvent.change(screen.getByLabelText('Teste da ação'), { target: { value: 'disputa' } });
    fireEvent.change(screen.getByLabelText('Perícia do usuário'), { target: { value: 'Enganação' } });
    fireEvent.change(screen.getByLabelText('Perícias possíveis do alvo'), { target: { value: 'Percepção, Intuição' } });
    expect(save.mock.lastCall![0].acoesAtivas[0]).toMatchObject({
      teste: 'disputa', pericia_usuario: 'Enganação', pericias_alvo: ['Percepção', 'Intuição'],
    });
  });
  it('seleciona dois alvos e executa uma única ação', async () => {
    painel({ tipo_alvo: 'multiplo', filtro_alvo: 'inimigos', max_alvos: '2', alcanceM: 4.5 });
    fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
    await act(async () => { clicarAlvoMapa('e-a'); clicarAlvoMapa('e-b'); terminarAlvoMapa(useAlvoMapaStore.getState().selecionados); await Promise.resolve(); });
    await waitFor(() => expect(pegarFicha('b').hpCurrent).toBe(96));
    expect(pegarFicha('a').hpCurrent).toBe(96);
    expect(pegarFicha('heroi').peCurrent).toBe(18);
  });
  it('próprio dispensa escolher alvo', async () => {
    painel({ tipo_alvo: 'proprio' });
    fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
    await waitFor(() => expect(pegarFicha('heroi').hpCurrent).toBe(96));
  });
  it('abre seletor do mapa, aguarda confirmação e só então paga', async () => {
    painel({ tipo_alvo: 'area', filtro_alvo: 'inimigos', area: { forma: 'cone', tamanho_m: 6 } });
    fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
    await waitFor(() => expect(useMapStore.getState().pendingAoEPlacement?.kind).toBe('cone_attached'));
    expect(pegarFicha('heroi').peCurrent).toBe(20);
    useMapStore.getState().resolveAoEPlacement({ id: 'teste', kind: 'cone_attached', x: 0, y: 0, rotation: 0, length: 280, width: 70, color: '#ffffff', opacity: 1 });
    await waitFor(() => expect(pegarFicha('b').hpCurrent).toBe(96));
    expect(pegarFicha('heroi').peCurrent).toBe(18);
  });
});
