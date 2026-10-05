import { clicarAlvoMapa, useAlvoMapaStore } from '@/stores/useAlvoMapaStore';
// @vitest-environment jsdom
import { useState } from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async (original) => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
import { ficha, montarMesa, pegarFicha, limparMesa, comoTela, esperar, forcarDados } from './helpers/mesaReal';
import { executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { planejarCustosAtivos, inicioTurnoSustentacoesAtivas, encerrarSustentacaoAtiva } from '@/lib/omni/custosAtivos';
import { novaEntidade, type AcaoAtivaConfig, type EntidadeOmni } from '@/lib/omni/tipos';
import { EditorAcoesAtivas } from '@/components/omni/EditorAcoesAtivas';
import { AcoesAtivasSection } from '@/components/fichas/AcoesAtivasSection';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useReactionStore } from '@/stores/useReactionStore';
import { useMapStore } from '@/stores/useMapStore';
import { PacoteOmniSchema } from '@/lib/omni/validacao';
const cfg = (p: Partial<AcaoAtivaConfig> = {}): AcaoAtivaConfig => ({ id: 'c', nome: 'Escalar', acao: 'comum', custoPE: '2', alcanceM: 18, teste: 'nenhum', ...p });
const mesa = (extra = {}) => montarMesa([ficha('u', { actionsCurrent: 1, hpCurrent: 30, hpMax: 30, omniCounters: { foco: 5 }, ...extra }), ficha('a', { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, escCurrent: 0 }), ficha('b', { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, escCurrent: 0 })], { u: [0, 0], a: [2, 0], b: [3, 0] });
beforeEach(() => { comoTela({ profileId: null, role: 'MASTER' }); useInventoryStore.setState({ items: {} }); useMapStore.setState({ walls: [] }); useCombatStore.setState({ inCombat: false }); mesa(); });
afterEach(async () => { cleanup(); await import('@/lib/omni/eventBus'); await import('@/lib/omni/observadores'); await esperar(); useCombatStore.setState({ inCombat: false }); limparMesa(); });

describe('custos genéricos de ações', () => {
  it('intensifica dano e cobra uma vez para múltiplos alvos', async () => {
    forcarDados(3, 3, 3, 3);
    const r = await executarAcaoAtiva('u', cfg({ tipo_alvo: 'multiplo', max_alvos: '2', dano: '1d6', custo_recursos: { pe_base: '2', pe_por_intensificacao: '1', max_intensificacoes: '4', dano_por_intensificacao: '1d6' } }), ['a', 'b'], undefined, { intensificacoes: 1 });
    expect(r.ok).toBe(true); expect(pegarFicha('u').peCurrent).toBe(17); expect(pegarFicha('u').actionsCurrent).toBe(0);
    expect(pegarFicha('a').hpCurrent).toBe(94); expect(pegarFicha('b').hpCurrent).toBe(94);
  });
  it('consome duas de cinco cargas e usa apenas as consumidas no dano', async () => {
    forcarDados(2, 3);
    await executarAcaoAtiva('u', cfg({ dadosPorCarga: '1d6', custo_recursos: { gastar_cargas: { nome: 'Foco', quantidade: '2' } } }), 'a');
    expect(pegarFicha('u').omniCounters?.foco).toBe(3); expect(pegarFicha('a').hpCurrent).toBe(95);
  });
  it('consumo parcial preserva a contabilidade das fontes', async () => {
    mesa({ omniCounters: { foco: 5, foco__fonte__x: 3, foco__fonte__y: 2 } });
    await executarAcaoAtiva('u', cfg({ custo_recursos: { gastar_cargas: { nome: 'foco', quantidade: '2' } } }), 'a');
    const c = pegarFicha('u').omniCounters!; expect(c.foco).toBe(3); expect(c.foco__fonte__x + c.foco__fonte__y).toBe(3);
  });
  it('erro no ataque mantém os custos pagos e não cria sustentação vazia', async () => {
    mesa({ mainHandWeaponName: 'Espada Curta', attributes: [{ id: 'FOR', name: 'Força', value: 10 }], trainingBonus: 0 });
    forcarDados(1, 3);
    const r = await executarAcaoAtiva('u', cfg({ teste: 'ataque', efeitos: [{ tipo: 'condicao', condicao: 'caido', rodadas: 0 }], custo_recursos: { tipo_acao: 'sustentada', pe_por_turno: '1', custo_pv: '5', gastar_cargas: { nome: 'foco', quantidade: '1' } } }), 'a');
    expect(r.ok && r.detalhe).toContain('ERROU'); expect(pegarFicha('u').hpCurrent).toBe(25); expect(pegarFicha('u').peCurrent).toBe(18); expect(pegarFicha('u').omniCounters?.foco).toBe(4); expect(pegarFicha('u').omniSustentacoes ?? []).toEqual([]);
  });
  it('modificador de acerto pertence somente à ação que consome a carga', async () => {
    mesa({ mainHandWeaponName: 'Espada Curta', attributes: [{ id: 'FOR', name: 'Força', value: 10 }], trainingBonus: 0 });
    useCharacterStore.getState().updateCharacter('a', { ca: 12 }); forcarDados(12, 3);
    const r = await executarAcaoAtiva('u', cfg({ teste: 'ataque', dano: '1', mod_acerto: 2, custo_recursos: { gastar_cargas: { nome: 'foco', quantidade: '1' } } }), 'a'); expect(r.ok && r.detalhe).toContain('ACERTOU'); expect(pegarFicha('u').omniCounters?.foco).toBe(4);
    useCharacterStore.getState().updateCharacter('u', { actionsCurrent: 1 }); forcarDados(12, 3);
    const seguinte = await executarAcaoAtiva('u', cfg({ teste: 'ataque', dano: '1' }), 'a'); expect(seguinte.ok && seguinte.detalhe).toContain('ERROU');
  });
  it('todas e o formato legado continuam consumindo o contador inteiro', async () => {
    await executarAcaoAtiva('u', cfg({ custo_recursos: { gastar_cargas: { nome: 'foco', quantidade: 'todas' } } }), 'a'); expect(pegarFicha('u').omniCounters?.foco).toBe(0);
    mesa(); await executarAcaoAtiva('u', cfg({ consumirContador: { nome: 'foco', minimo: 1 } }), 'a'); expect(pegarFicha('u').omniCounters?.foco).toBe(0);
  });
  it('paga PV reais sem absorção e usa PE temporários primeiro', async () => {
    mesa({ tempPE: 2, escCurrent: 20 });
    const r = await executarAcaoAtiva('u', cfg({ custo_recursos: { pe_base: '3', custo_pv: '5' } }), 'a');
    expect(r.ok).toBe(true); const u = pegarFicha('u'); expect(u.hpCurrent).toBe(25); expect(u.escCurrent).toBe(20); expect(u.tempPE).toBe(0); expect(u.peCurrent).toBe(19);
  });
  it('consome munição configurada na arma associada à ação', async () => {
    mesa({ mainHandWeaponName: 'Pistola', weaponAmmo: { Pistola: 4 } });
    const r = await executarAcaoAtiva('u', cfg({ custo_recursos: { municao: 2 } }), 'a');
    expect(r.ok).toBe(true); expect(pegarFicha('u').weaponAmmo?.Pistola).toBe(2);
  });
  it('rejeita munição insuficiente ou arma sem capacidade de recarga sem pagar PE', async () => {
    mesa({ mainHandWeaponName: 'Pistola', weaponAmmo: { Pistola: 1 } });
    expect((await executarAcaoAtiva('u', cfg({ custo_recursos: { municao: 2 } }), 'a')).ok).toBe(false);
    expect(pegarFicha('u').peCurrent).toBe(20);
    mesa({ mainHandWeaponName: 'Espada Curta' });
    expect((await executarAcaoAtiva('u', cfg({ custo_recursos: { municao: 1 } }), 'a')).ok).toBe(false);
    expect(pegarFicha('u').peCurrent).toBe(20);
  });
  it('consome usos da instância do item ativo, sem afetar outra cópia', async () => {
    const acao = cfg({ custo_recursos: { usos_item: 2 } });
    const ent = { ...novaEntidade('item'), usos: { total: 3, recarga: 'diaria' as const }, acoesAtivas: [acao] } as EntidadeOmni;
    const usada = useInventoryStore.getState().add('u', ent), outra = useInventoryStore.getState().add('u', ent);
    const r = await executarAcaoAtiva('u', acao, 'a', usada.entity, { instanciaId: usada.instanceId });
    expect(r.ok).toBe(true);
    expect(useInventoryStore.getState().items[usada.instanceId].usosRestantes).toBe(1);
    expect(useInventoryStore.getState().items[outra.instanceId].usosRestantes).toBe(3);
  });
  it('não consome uso do item nem outros custos se faltar reação no pagamento final', async () => {
    mesa({ reactionsCurrent: 1 });
    const acao = cfg({ custoPE: '3', custo_recursos: { tipo_acao: 'reacao', usos_item: 1 } });
    const ent = { ...novaEntidade('item'), usos: { total: 3, recarga: 'diaria' as const }, acoesAtivas: [acao] } as EntidadeOmni;
    const item = useInventoryStore.getState().add('u', ent);
    vi.spyOn(useReactionStore.getState(), 'consumeReaction').mockReturnValue(false);

    const result = await executarAcaoAtiva('u', acao, 'a', item.entity, { instanciaId: item.instanceId });

    expect(result).toMatchObject({ ok: false, reason: 'Sem reação disponível.' });
    expect(useInventoryStore.getState().items[item.instanceId].usosRestantes).toBe(3);
    expect(pegarFicha('u')).toMatchObject({ reactionsCurrent: 1, peCurrent: 20 });
  });
  it('não cobra PE quando os usos do item são insuficientes ou ilimitados', async () => {
    const acao = cfg({ custo_recursos: { usos_item: 2 } });
    const limitado = { ...novaEntidade('item'), usos: { total: 1, recarga: 'diaria' as const }, acoesAtivas: [acao] } as EntidadeOmni;
    const inst = useInventoryStore.getState().add('u', limitado);
    expect((await executarAcaoAtiva('u', acao, 'a', inst.entity, { instanciaId: inst.instanceId })).ok).toBe(false);
    expect(pegarFicha('u').peCurrent).toBe(20);
    const semUsos = useInventoryStore.getState().add('u', { ...novaEntidade('item'), acoesAtivas: [acao] });
    expect((await executarAcaoAtiva('u', acao, 'a', semUsos.entity, { instanciaId: semUsos.instanceId })).ok).toBe(false);
    expect(pegarFicha('u').peCurrent).toBe(20);
  });
  it.each(['0', '-1', '6', '1d6', '@USUARIO.key_inexistente'])('quantidade %s inválida não cobra recursos', async quantidade => {
    const antes = pegarFicha('u'); const r = await executarAcaoAtiva('u', cfg({ custo_recursos: { custo_pv: '5', gastar_cargas: { nome: 'foco', quantidade } } }), 'a');
    expect(r.ok).toBe(false); expect(pegarFicha('u')).toEqual(antes);
  });
  it.each(['-2', '1d6', '1/0', '@USUARIO.key_inexistente'])('fórmula de PE %s inválida não cobra', async pe_base => {
    const antes = pegarFicha('u'); expect((await executarAcaoAtiva('u', cfg({ custo_recursos: { pe_base } }), 'a')).ok).toBe(false); expect(pegarFicha('u')).toEqual(antes);
  });
  it('rejeita sacrifício letal, PE insuficiente e intensificação fora do teto', async () => {
    for (const c of [{ custo_pv: '30' }, { pe_base: '21' }, { max_intensificacoes: '1' }]) {
      const antes = pegarFicha('u'); expect((await executarAcaoAtiva('u', cfg({ custo_recursos: c }), 'a', undefined, { intensificacoes: 'max_intensificacoes' in c ? 2 : 0 })).ok).toBe(false); expect(pegarFicha('u')).toEqual(antes);
    }
    expect(planejarCustosAtivos(cfg(), pegarFicha('u'), 0.5).ok).toBe(false);
  });
  it('limite por treinamento impede gasto total acima do teto', async () => {
    const c = cfg({ custo_recursos: { pe_base: '1', pe_por_intensificacao: '1', max_intensificacoes: '@USUARIO.treino', limite_pe: '@USUARIO.treino' } });
    expect(planejarCustosAtivos(c, pegarFicha('u'), 1).ok).toBe(true); expect(planejarCustosAtivos(c, pegarFicha('u'), 2).ok).toBe(false);
  });
  it.each(['bonus', 'reacao', 'livre'] as const)('custo sobrescreve ação como %s', async tipo_acao => {
    mesa({ bonusActionsCurrent: 1, reactionsCurrent: 1 }); await executarAcaoAtiva('u', cfg({ custo_recursos: { tipo_acao } }), 'a'); const u = pegarFicha('u');
    expect(u.actionsCurrent).toBe(1); expect(u.bonusActionsCurrent).toBe(tipo_acao === 'bonus' ? 0 : 1); expect(u.reactionsCurrent).toBe(tipo_acao === 'reacao' ? 0 : 1);
    if (tipo_acao === 'reacao') expect(useReactionStore.getState().reactionsUsedByChar.u).toBe(1);
  });
});

describe('sustentação e interface reais', () => {
  const sustentada = () => cfg({ efeitos: [{ tipo: 'condicao', condicao: 'caido', rodadas: 1 }], custo_recursos: { tipo_acao: 'sustentada', pe_por_turno: '3' } });
  it('mantém uma condição sem acumular e encerra sua instância ao dissipar', async () => {
    const r = await executarAcaoAtiva('u', sustentada(), 'a'); expect(r.ok).toBe(true);
    const s = pegarFicha('u').omniSustentacoes![0]; expect(s.condicoes).toHaveLength(1); expect(pegarFicha('a').activeConditions[0].remainingRounds).toBe(-1);
    useCharacterStore.getState().addCondition('a', { ...pegarFicha('a').activeConditions[0], id: 'outra' });
    expect(pegarFicha('a').activeConditions.map(c => c.id)).toEqual([s.condicoes[0].id]);
    inicioTurnoSustentacoesAtivas('u'); expect(pegarFicha('u').peCurrent).toBe(15);
    encerrarSustentacaoAtiva('u', s.id); expect(pegarFicha('a').activeConditions).toEqual([]); expect(pegarFicha('u').omniSustentacoes).toEqual([]);
  });
  it('falta de PE encerra manutenção sem saldo negativo', async () => {
    mesa({ peCurrent: 4 }); await executarAcaoAtiva('u', sustentada(), 'a'); inicioTurnoSustentacoesAtivas('u'); expect(pegarFicha('u').peCurrent).toBe(2); expect(pegarFicha('u').omniSustentacoes).toEqual([]); expect(pegarFicha('a').activeConditions).toEqual([]);
  });
  it('virada de turno do combate cobra manutenção exatamente uma vez', async () => {
    await executarAcaoAtiva('u', sustentada(), 'a');
    useCombatStore.setState({ inCombat: true, currentTurnIndex: 0, round: 1, initiativeOrder: [{ charId: 'a', charName: 'a', roll: 20, bonus: 0, total: 20 }, { charId: 'u', charName: 'u', roll: 10, bonus: 0, total: 10 }] });
    useCombatStore.getState().nextTurn(); await waitFor(() => expect(pegarFicha('u').peCurrent).toBe(15)); await esperar(); expect(pegarFicha('u').peCurrent).toBe(15);
  });
  it('construtor cria custos e JSON preserva a configuração completa', () => {
    let salvo: EntidadeOmni;
    function Editor() { const [ent, set] = useState<EntidadeOmni>({ ...novaEntidade('item'), acoesAtivas: [cfg()] }); return <EditorAcoesAtivas ent={ent} setEnt={e => { salvo = e; set(e); }} />; }
    render(<Editor />); fireEvent.click(screen.getByLabelText('Custos flexíveis'));
    fireEvent.change(screen.getByLabelText('Máximo de intensificações'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Custo PV'), { target: { value: '5' } }); fireEvent.change(screen.getByLabelText('Contador de cargas'), { target: { value: 'foco' } });
    fireEvent.change(screen.getByLabelText('Quantidade de cargas'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Munição consumida'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Usos do item consumidos'), { target: { value: '1' } });
    expect(salvo!.acoesAtivas![0].custo_recursos).toMatchObject({ max_intensificacoes: '4', custo_pv: '5', municao: 2, usos_item: 1, gastar_cargas: { nome: 'foco', quantidade: '2' } });
    const parsed = PacoteOmniSchema.parse({ formato: 'omni-engine.v1', nome: 'Teste', geradoEm: 0, entidades: [salvo!] }); expect(parsed.entidades[0].acoesAtivas![0]).toEqual(salvo!.acoesAtivas![0]);
  });
  it('jogador escolhe intensificação e usa a ação pelo painel', async () => {
    const c = cfg({ dano: '1', custo_recursos: { pe_por_intensificacao: '1', max_intensificacoes: '4', dano_por_intensificacao: '2', custo_pv: '5' } });
    useInventoryStore.getState().add('u', { ...novaEntidade('item'), acoesAtivas: [c] }); render(<AcoesAtivasSection charId="u" />);
     fireEvent.change(screen.getByLabelText('Intensificação de Escalar'), { target: { value: '2' } });
    expect(screen.getByTestId('acao-ativa-Escalar').textContent).toContain('4 PE + 5 PV'); fireEvent.click(screen.getByText('Usar'));
    await act(async () => { clicarAlvoMapa('e-a'); await Promise.resolve(); });
    await waitFor(() => expect(pegarFicha('u').peCurrent).toBe(16)); expect(pegarFicha('u').hpCurrent).toBe(25); expect(pegarFicha('a').hpCurrent).toBe(95);
  });
  it('painel permite encerrar mesmo sem o item no inventário', async () => {
    await executarAcaoAtiva('u', sustentada(), 'a'); render(<AcoesAtivasSection charId="u" />); fireEvent.click(screen.getByLabelText('Encerrar Escalar')); expect(pegarFicha('a').activeConditions).toEqual([]);
  });
});
