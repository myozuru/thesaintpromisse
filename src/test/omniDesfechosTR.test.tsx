// @vitest-environment jsdom
import { useState } from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async original => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
import { ficha, montarMesa, pegarFicha, limparMesa, comoTela, esperar, forcarDados } from './helpers/mesaReal';
import { classificarGrauTR, danoDoGrauTR, executarAcaoAtiva, type GrauSucessoTR } from '@/lib/omni/acaoAtiva';
import { EditorAcoesAtivas } from '@/components/omni/EditorAcoesAtivas';
import { novaEntidade, type AcaoAtivaConfig, type EntidadeOmni } from '@/lib/omni/tipos';
import { useMapStore } from '@/stores/useMapStore';
import { PacoteOmniSchema } from '@/lib/omni/validacao';
const acao = (p: Partial<AcaoAtivaConfig> = {}): AcaoAtivaConfig => ({ id: 'tr', nome: 'Teste de graus', acao: 'comum', custoPE: '0', alcanceM: 0, teste: 'tr', cd: '10', tr: 'fortitude', dano: '10', metadeNoSucesso: true, ...p });
const useTargetX = () => useMapStore.getState().entities['e-a'].x;
const mesa = (pv = 100) => montarMesa([ficha('u', { actionsCurrent: 1, peCurrent: 20 }), ficha('a', { category: 'INIMIGO', hpCurrent: pv, hpMax: pv, escCurrent: 0, fortitude: 0 })], { u: [0, 0], a: [1, 0] });
beforeEach(() => comoTela({ profileId: null, role: 'MASTER' }));
afterEach(async () => { cleanup(); await import('@/lib/omni/eventBus'); await import('@/lib/omni/observadores'); await esperar(); limparMesa(); });

describe('classificação e dano por grau', () => {
  it.each([
    [1, 30, 10, 'falha_critica'], [20, 10, 10, 'sucesso'], [20, 5, 10, 'falha_critica'], [8, 8, 10, 'falha'], [5, 5, 10, 'falha_critica'], [6, 6, 10, 'falha'],
  ] as [number, number, number, GrauSucessoTR][])('d20 %i e total %i contra CD %i resulta em %s', (d20, total, cd, esperado) => { expect(classificarGrauTR(d20, total, cd)).toBe(esperado); });
  it('usa dano total, metade, nenhum e padrão legado sem aleatoriedade adicional', () => {
    expect(danoDoGrauTR(11, 'falha', undefined, true)).toBe(11);
    expect(danoDoGrauTR(11, 'sucesso', undefined, true)).toBe(5);
    expect(danoDoGrauTR(11, 'sucesso', undefined, false)).toBe(0);
    expect(danoDoGrauTR(11, 'falha_critica', { dano: 'metade' }, false)).toBe(5);
    expect(danoDoGrauTR(11, 'falha', { dano: 'nenhum' }, false)).toBe(0);
  });
  it('falha comum aceita dano pela metade, dano extra e condição legada', async () => {
    mesa(); forcarDados(8);
    const r = await executarAcaoAtiva('u', acao({ efeitos: [{ tipo: 'condicao', condicao: 'caido', rodadas: 1 }], desfechosTR: { falha: { dano: 'metade', dano_extra: '2' } } }), 'a');
    expect(r.ok && r.dano).toBe(6); expect(pegarFicha('a').hpCurrent).toBe(94); expect(pegarFicha('a').activeConditions.some(c => c.conditionId === 'caido')).toBe(true);
    expect(r.ok && r.detalhe).toContain('→ FALHA');
  });
  it('movimento do ramo falho usa o destino preparado no índice correto', async () => {
    mesa(); forcarDados(8);
    const cfg = acao({
      efeitos: [{ tipo: 'condicao', condicao: 'caido', rodadas: 1 }],
      desfechosTR: { falha: { dano: 'nenhum', efeitos: [{ tipo: 'movimento', movimento_tipo: 'empurrar', movimento_distancia: '3', movimento_alvo: 'alvo' }] } },
    });
    const r = await executarAcaoAtiva('u', cfg, 'a', undefined, { destinosMovimento: { 'a:1': { x: 210, y: 0 } } });
    expect(r.ok).toBe(true); await waitFor(() => expect(useTargetX()).toBe(210));
    expect(pegarFicha('a').activeConditions).toEqual([]);
  });
  it('sucesso aplica condição própria e deixa o dano em zero', async () => {
    mesa(); forcarDados(10);
    const r = await executarAcaoAtiva('u', acao({ desfechosTR: { sucesso: { dano: 'nenhum', efeitos: [{ tipo: 'condicao', condicao: 'exposto', rodadas: 2 }] } } }), 'a');
    expect(r.ok && r.dano).toBe(0); expect(pegarFicha('a').hpCurrent).toBe(100); expect(pegarFicha('a').activeConditions.map(c => c.conditionId)).toEqual(['exposto']);
    expect(r.ok && r.efeitoAplicado).toBe(true);
  });
  it.each([[1, 'd20 natural 1'], [5, 'falha por cinco']])('falha crítica (%s) maximiza os dados e dobra a duração', async (d20) => {
    mesa(); forcarDados(d20);
    const r = await executarAcaoAtiva('u', acao({ dano: '2d4+1', efeitos: [{ tipo: 'condicao', condicao: 'caido', rodadas: 1 }], desfechosTR: { falha_critica: { dano_extra: '2', dano_maximizado: true, multiplicador_duracao: 2 } } }), 'a');
    expect(r.ok && r.dano).toBe(11); expect(pegarFicha('a').hpCurrent).toBe(89); expect(pegarFicha('a').activeConditions[0].remainingRounds).toBe(2);
    expect(r.ok && r.detalhe).toContain('FALHA CRÍTICA'); expect(r.ok && r.detalhe).toContain('[max]');
  });
  it('grau crítico configurado substitui efeitos falhos, sem aplicar efeitos em outro alvo', async () => {
    mesa(); const b = ficha('b', { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, escCurrent: 0 });
    const { useCharacterStore } = await import('@/stores/useCharacterStore'); useCharacterStore.setState(s => ({ characters: [...s.characters, b] }));
    forcarDados(1, 20);
    const r = await executarAcaoAtiva('u', acao({ tipo_alvo: 'multiplo', alcanceM: 0, max_alvos: '2', efeitos: [{ tipo: 'condicao', condicao: 'caido', rodadas: 1 }], desfechosTR: { falha_critica: { dano: 'nenhum', efeitos: [] }, sucesso: { dano: 'nenhum', efeitos: [{ tipo: 'condicao', condicao: 'exposto', rodadas: 1 }] } } }), ['a', 'b']);
    expect(r.ok).toBe(true); expect(pegarFicha('a').activeConditions).toEqual([]); expect(pegarFicha('b').activeConditions.map(c => c.conditionId)).toEqual(['exposto']);
  });
  it('sem configuração mantém metade no sucesso e falha completa', async () => {
    mesa(); forcarDados(10); await executarAcaoAtiva('u', acao(), 'a'); expect(pegarFicha('a').hpCurrent).toBe(95);
    mesa(); forcarDados(8); await executarAcaoAtiva('u', acao(), 'a'); expect(pegarFicha('a').hpCurrent).toBe(90);
  });
  it('não rola dado quando o ramo define dano nenhum', async () => {
    mesa(); forcarDados(20); const r = await executarAcaoAtiva('u', acao({ dano: '8d12', desfechosTR: { sucesso: { dano: 'nenhum' } } }), 'a');
    expect(r.ok && r.dano).toBe(0); expect(pegarFicha('a').hpCurrent).toBe(100);
  });
});

describe('editor e pacote OMNI', () => {
  it('configura os três graus e preserva efeitos, fórmulas e multiplicadores no JSON', () => {
    let salvo: EntidadeOmni;
    function Editor() { const [e, set] = useState<EntidadeOmni>({ ...novaEntidade('feitico', 'Prova'), acoesAtivas: [acao()] }); return <EditorAcoesAtivas ent={e} setEnt={n => { salvo = n; set(n); }} />; }
    render(<Editor />);
    fireEvent.click(screen.getByLabelText('Configurar Falha crítica'));
    fireEvent.change(screen.getByLabelText('Dano extra em Falha crítica'), { target: { value: '2d8' } });
    fireEvent.click(screen.getByLabelText('Maximizar dano em Falha crítica'));
    fireEvent.change(screen.getByLabelText('Multiplicador da duração em Falha crítica'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('Efeito deste grau'));
    fireEvent.change(screen.getByLabelText('Duração Falha crítica 1'), { target: { value: '3' } });
    fireEvent.click(screen.getByLabelText('Configurar Sucesso'));
    fireEvent.change(screen.getByLabelText('Dano em Sucesso'), { target: { value: 'nenhum' } });
    const parsed = PacoteOmniSchema.parse({ formato: 'omni-engine.v1', nome: 'TR', geradoEm: 1, entidades: [salvo!] });
    expect(parsed.entidades[0].acoesAtivas![0].desfechosTR).toEqual(salvo!.acoesAtivas![0].desfechosTR);
    expect(parsed.entidades[0].acoesAtivas![0].desfechosTR).toMatchObject({ falha_critica: { dano_extra: '2d8', dano_maximizado: true, multiplicador_duracao: 2, efeitos: [{ tipo: 'condicao', rodadas: 3 }] }, sucesso: { dano: 'nenhum' } });
  });
  it('schema rejeita categorias, multiplicadores e graus de dano inválidos', () => {
    const base = { ...novaEntidade('feitico', 'Inválida'), acoesAtivas: [acao({ desfechosTR: { sucesso: { dano: 'dobro' as never, multiplicador_duracao: 0 } } })] };
    expect(() => PacoteOmniSchema.parse({ formato: 'omni-engine.v1', nome: 'TR', geradoEm: 1, entidades: [base] })).toThrow();
  });
});
