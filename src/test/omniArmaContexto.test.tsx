// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ficha, montarMesa, pegarFicha, limparMesa, comoTela, esperar, forcarDados } from './helpers/mesaReal';
import { executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { avaliarFormula } from '@/lib/omni/parser';
import { createEmptyRdByType } from '@/types';
import { novaEntidade, type AcaoAtivaConfig, type EntidadeOmni } from '@/lib/omni/tipos';
import { PacoteOmniSchema } from '@/lib/omni/validacao';
import { EditorAcoesAtivas } from '@/components/omni/EditorAcoesAtivas';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async original => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
vi.mock('@/components/dice-physics/DiceTrayPanel', () => ({ DiceTrayPanel: () => null }));

const cfg = (p: Partial<AcaoAtivaConfig> = {}): AcaoAtivaConfig => ({ id: 'arma', nome: 'Golpe elemental', acao: 'comum', custoPE: '2', alcanceM: 0, teste: 'nenhum', tipo_efeito: 'dano', dano: '@ARMA.DANO + 2d8', tipoDano: 'DQ', ...p });
function mesa(weapon = 'Espada Longa', extra: Record<string, unknown> = {}) {
  montarMesa([
    ficha('u', { mainHandWeaponName: weapon, peCurrent: 20, actionsCurrent: 1 }),
    ficha('a', { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, escCurrent: 0, rd: 0, rdByType: { ...createEmptyRdByType(), DCO: 30, DQ: 3 }, activeBuffs: [], activeConditions: [], vulnerabilities: [], immunities: [], ...extra }),
  ], { u: [0,0], a: [1,0] });
}
beforeEach(() => comoTela({ profileId: null, role: 'MASTER' }));
afterEach(async () => { cleanup(); await import('@/lib/omni/eventBus'); await esperar(); limparMesa(); });

describe('contexto dinâmico da arma em fórmulas OMNI', () => {
  it('resolve dano-base como dados roláveis e expõe quantidade, passo e margem', () => {
    const r = avaliarFormula('@ARMA.DANO + @ARMA.DADOS + @ARMA.PASSO + @ARMA.CRITICO_MARGEM', {}, () => 0.5, { arma: { dano: '1d8', dados: 1, passo: 8, critico_margem: 20 } });
    expect(r.valor).toBe(34); expect(r.diagnosticos).toEqual([]); expect(r.rolagens).toMatchObject([{ notacao: '1d8', rolls: [5], total: 5 }]);
  });
  it('herda só o dado-base da arma, combina dados adicionais e converte para o tipo escolhido', async () => {
    mesa(); forcarDados(18, 5, 3, 4);
    const r = await executarAcaoAtiva('u', cfg(), 'a');
    expect(r.ok && r.dano).toBe(12); expect(pegarFicha('a').hpCurrent).toBe(91); expect(pegarFicha('u').peCurrent).toBe(18);
  });
  it('sem conversão conserva o tipo e a redução da arma equiparada', async () => {
    mesa('Espada Longa'); forcarDados(18, 5, 3, 4);
    const r = await executarAcaoAtiva('u', cfg({ tipoDano: undefined }), 'a');
    expect(r.ok && r.dano).toBe(12); expect(pegarFicha('a').hpCurrent).toBe(100);
  });
  it('ação sem token de arma mantém o próprio tipo mesmo com arma equipada', async () => {
    mesa('Espada Longa');
    const r = await executarAcaoAtiva('u', cfg({ dano: '12', tipoDano: undefined }), 'a');
    expect(r.ok && r.dano).toBe(12); expect(pegarFicha('a').hpCurrent).toBe(88);
  });
  it('usa aliases numéricos em expressão de dano, inclusive dado dinâmico', async () => {
    mesa('Espada Longa'); forcarDados(6);
    const r = await executarAcaoAtiva('u', cfg({ dano: '(@ARMA.DADOS)d@ARMA.PASSO' }), 'a');
    expect(r.ok && r.dano).toBe(6); expect(pegarFicha('a').hpCurrent).toBe(97);
  });
  it('usa contexto também em valores de suporte da ação', async () => {
    mesa();
    const r = await executarAcaoAtiva('u', cfg({ tipo_efeito: 'buff', dano: '', efeitos: [{ tipo: 'escudo', valor: '@ARMA.PASSO + @ARMA.DADOS', rodadas: 2 }] }), 'a');
    expect(r.ok).toBe(true); expect(pegarFicha('a').escCurrent).toBe(9);
  });
  it('recusa token de arma sem arma antes de debitar PE', async () => {
    mesa('arma inexistente');
    const r = await executarAcaoAtiva('u', cfg(), 'a');
    expect(r.ok).toBe(false); expect(pegarFicha('u').peCurrent).toBe(20); expect(pegarFicha('a').hpCurrent).toBe(100);
  });
  it('editor e pacote JSON preservam a fórmula herdada e o tipo de conversão', () => {
    let salvo: EntidadeOmni;
    function Editor() { const [e, set] = useState<EntidadeOmni>({ ...novaEntidade('item'), acoesAtivas: [cfg()] }); return <EditorAcoesAtivas ent={e} setEnt={n => { salvo = n; set(n); }} />; }
    render(<Editor />); fireEvent.change(screen.getByLabelText('Dano de Golpe elemental'), { target: { value: '@ARMA.DANO + 2d8 + @ARMA.PASSO' } });
    const pacote = PacoteOmniSchema.parse({ formato: 'omni-engine.v1', nome: 'arma', geradoEm: 0, entidades: [salvo!] });
    expect(pacote.entidades[0].acoesAtivas![0]).toMatchObject({ dano: '@ARMA.DANO + 2d8 + @ARMA.PASSO', tipoDano: 'DQ' });
  });
});
