// @vitest-environment jsdom
import { useState } from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async original => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
vi.mock('@/components/dice-physics/DiceTrayPanel', () => ({ DiceTrayPanel: () => null }));
import { ficha, montarMesa, pegarFicha, limparMesa, comoTela, esperar } from './helpers/mesaReal';
import { executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { novaEntidade, type AcaoAtivaConfig, type EntidadeOmni } from '@/lib/omni/tipos';
import { EditorAcoesAtivas } from '@/components/omni/EditorAcoesAtivas';
import { PacoteOmniSchema } from '@/lib/omni/validacao';
import { useCharacterStore } from '@/stores/useCharacterStore';
const cfg = (p: Partial<AcaoAtivaConfig> = {}): AcaoAtivaConfig => ({ id: 'cura', nome: 'Recuperar', acao: 'comum', custoPE: '2', alcanceM: 0, teste: 'nenhum', tipo_efeito: 'cura', cura: '8', filtro_alvo: 'aliados', tipo_alvo: 'unico', ...p });
beforeEach(() => { comoTela({ profileId: null, role: 'MASTER' }); montarMesa([ficha('u', { hpCurrent: 10, hpMax: 30, actionsCurrent: 1 }), ficha('a', { hpCurrent: 20, hpMax: 25, peCurrent: 3, peMax: 10 }), ficha('b', { hpCurrent: 5, hpMax: 25 }), ficha('i', { category: 'INIMIGO', hpCurrent: 20, hpMax: 25 })], { u: [0,0], a: [1,0], b: [2,0], i: [3,0] }); });
afterEach(async () => { cleanup(); await import('@/lib/omni/eventBus'); await esperar(); limparMesa(); });
describe('recuperação por ações ativas', () => {
  it('cura múltiplos aliados respeitando o máximo e paga uma vez', async () => {
    const r = await executarAcaoAtiva('u', cfg({ tipo_alvo: 'multiplo', max_alvos: '3' }), ['a','b']);
    expect(r.ok && r.cura).toBe(13); expect(r.ok && r.dano).toBe(0);
    expect(pegarFicha('a').hpCurrent).toBe(25); expect(pegarFicha('b').hpCurrent).toBe(13); expect(pegarFicha('u').peCurrent).toBe(18);
  });
  it('restaura PE sem afetar PV, escudo ou PE temporário', async () => {
    const r = await executarAcaoAtiva('u', cfg({ recurso_cura: 'pe', cura: '20' }), 'a');
    expect(r.ok && r.cura).toBe(7); expect(pegarFicha('a').peCurrent).toBe(10); expect(pegarFicha('a').hpCurrent).toBe(20);
  });
  it('autocura usa o estado depois do custo e aceita fórmulas', async () => {
    const r = await executarAcaoAtiva('u', cfg({ tipo_alvo: 'proprio', recurso_cura: 'pe', cura: '2 + 1' }), '');
    expect(r.ok && r.cura).toBe(2); expect(pegarFicha('u').peCurrent).toBe(20);
  });
  it('dados são registrados e valor negativo não reduz vida', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const r = await executarAcaoAtiva('u', cfg({ cura: '2d8 + 1' }), 'b');
    expect(r.ok && r.cura).toBe(11); expect(pegarFicha('b').hpCurrent).toBe(16);
    vi.restoreAllMocks();
    await executarAcaoAtiva('u', cfg({ cura: '-4' }), 'b'); expect(pegarFicha('b').hpCurrent).toBe(16);
  });
  it('área cura aliados e exclui inimigos', async () => {
    const r = await executarAcaoAtiva('u', cfg({ tipo_alvo: 'area', area: { forma: 'raio_em_si', tamanho_m: 10 } }), { ponto: { x: 0, y: 0 } });
    expect(r.ok).toBe(true); expect(pegarFicha('b').hpCurrent).toBe(13); expect(pegarFicha('i').hpCurrent).toBe(20);
  });
  it('cura não reduz PV que já estão acima do máximo', async () => {
    useCharacterStore.getState().updateCharacter('a', { hpCurrent: 28 });
    const r = await executarAcaoAtiva('u', cfg(), 'a');
    expect(r.ok && r.cura).toBe(0); expect(pegarFicha('a').hpCurrent).toBe(28);
  });
  it.each([{ filtro_alvo: 'inimigos' }, { teste: 'ataque' }, { cura: '1 / 0' }])('rejeita configuração inválida antes de gastar', async p => {
    const r = await executarAcaoAtiva('u', cfg(p as Partial<AcaoAtivaConfig>), 'a'); expect(r.ok).toBe(false); expect(pegarFicha('u').peCurrent).toBe(20);
  });
  it('editor e JSON preservam a recuperação de PE', () => {
    let salvo: EntidadeOmni;
    function Editor() { const [e,set] = useState<EntidadeOmni>({ ...novaEntidade('item'), acoesAtivas: [cfg({ tipo_efeito: undefined })] }); return <EditorAcoesAtivas ent={e} setEnt={n => { salvo=n; set(n); }} />; }
    render(<Editor />); fireEvent.change(screen.getByLabelText('Tipo de efeito'), { target: { value: 'cura' } }); fireEvent.change(screen.getByLabelText('Recurso da recuperação'), { target: { value: 'pe' } }); fireEvent.change(screen.getByLabelText('Valor da recuperação'), { target: { value: '2d8' } });
    const pacote=PacoteOmniSchema.parse({ formato: 'omni-engine.v1', nome: 'cura', geradoEm: 0, entidades: [salvo!] }); expect(pacote.entidades[0].acoesAtivas![0]).toMatchObject({ tipo_efeito: 'cura', cura: '2d8', recurso_cura: 'pe', teste: 'nenhum', filtro_alvo: 'aliados' });
  });
});
