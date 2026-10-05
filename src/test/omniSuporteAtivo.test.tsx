// @vitest-environment jsdom
import { useState } from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async original => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
vi.mock('@/components/dice-physics/DiceTrayPanel', () => ({ DiceTrayPanel: () => null }));
import { ficha, montarMesa, pegarFicha, limparMesa, comoTela, esperar, forcarDados } from './helpers/mesaReal';
import { executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { novaEntidade, type AcaoAtivaConfig, type EntidadeOmni } from '@/lib/omni/tipos';
import { EditorAcoesAtivas } from '@/components/omni/EditorAcoesAtivas';
import { PacoteOmniSchema } from '@/lib/omni/validacao';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { ALL_CONDITIONS } from '@/types/conditions';
import { AcoesAtivasSection } from '@/components/fichas/AcoesAtivasSection';
import { useCombatStore } from '@/stores/useCombatStore';
import { withStamps, mergeIncomingCharacters } from '@/lib/charSyncStamps';
const cfg = (p: Partial<AcaoAtivaConfig> = {}): AcaoAtivaConfig => ({ id: 'apoio', nome: 'Proteção', acao: 'livre', custoPE: '2', alcanceM: 0, teste: 'nenhum', tipo_efeito: 'buff', filtro_alvo: 'aliados', tipo_alvo: 'unico', ...p });
const proteger = (valor = '10', rodadas = 2): AcaoAtivaConfig => cfg({ efeitos: [{ tipo: 'escudo', valor, rodadas }] });
function condicao(id: string, instancia = id) { const d = ALL_CONDITIONS.find(c => c.id === id)!; return { id: instancia, conditionId: id, name: d.name, icon: d.icon, remainingTurns: -1, remainingRounds: 3 }; }
beforeEach(() => { comoTela({ profileId: null, role: 'MASTER' }); montarMesa([ficha('u', { hpCurrent: 30, hpMax: 30, escCurrent: 0, actionsCurrent: 1 }), ficha('a', { hpCurrent: 20, hpMax: 25, escCurrent: 5, activeConditions: [condicao('caido', 'c1'), condicao('caido', 'c2'), condicao('exposto')] }), ficha('b', { hpCurrent: 15, hpMax: 25, escCurrent: 0 }), ficha('i', { category: 'INIMIGO', hpCurrent: 20, hpMax: 25, escCurrent: 0 })], { u: [0,0], a: [1,0], b: [2,0], i: [3,0] }); });
afterEach(async () => { cleanup(); await import('@/lib/omni/eventBus'); await import('@/lib/omni/observadores'); await esperar(); limparMesa(); });
describe('proteção e purificação por ação ativa', () => {
  it('concede proteção por alvo, paga uma vez e não causa dano herdado', async () => {
    const r = await executarAcaoAtiva('u', cfg({ tipo_alvo: 'multiplo', max_alvos: '2', dano: '100', incluirArma: true, efeitos: [{ tipo: 'pv_temporarios', valor: '2 + @ALVO.PE', rodadas: 2 }] }), ['a','b']);
    expect(r.ok && r.dano).toBe(0); expect(pegarFicha('a').escCurrent).toBe(27); expect(pegarFicha('b').escCurrent).toBe(22); expect(pegarFicha('a').hpCurrent).toBe(20); expect(pegarFicha('u').peCurrent).toBe(18);
    expect(pegarFicha('a').protecoesOmni?.[0]).toMatchObject({ tipo: 'pv_temporarios', restante: 22, rodadas: 2 });
  });
  it('absorve dano e expira apenas o restante concedido, preservando outras fontes', async () => {
    await executarAcaoAtiva('u', proteger(), 'a');
    useCharacterStore.getState().applyDamage('a', 4, undefined, { ignoresRD: true });
    expect(pegarFicha('a').escCurrent).toBe(11); expect(pegarFicha('a').protecoesOmni?.[0].restante).toBe(6);
    useCharacterStore.getState().tickRoundConditions(); expect(pegarFicha('a').escCurrent).toBe(11);
    useCharacterStore.getState().tickRoundConditions(); expect(pegarFicha('a').escCurrent).toBe(5); expect(pegarFicha('a').hpCurrent).toBe(20); expect(pegarFicha('a').protecoesOmni).toEqual([]);
  });
  it('esgotar a proteção não subtrai PV nem novos escudos na expiração', async () => {
    await executarAcaoAtiva('u', proteger('10', 1), 'a');
    useCharacterStore.getState().applyDamage('a', 18, undefined, { ignoresRD: true });
    expect(pegarFicha('a').hpCurrent).toBe(17); expect(pegarFicha('a').protecoesOmni).toEqual([]);
    useCharacterStore.getState().applyShield('a', 7); useCharacterStore.getState().tickRoundConditions();
    expect(pegarFicha('a').escCurrent).toBe(7); expect(pegarFicha('a').hpCurrent).toBe(17);
  });
  it('concessões com prazos diferentes expiram separadamente', async () => {
    await executarAcaoAtiva('u', proteger('10', 1), 'a'); await executarAcaoAtiva('u', proteger('8', 2), 'a');
    useCharacterStore.getState().applyDamage('a', 6, undefined, { ignoresRD: true });
    useCharacterStore.getState().tickRoundConditions(); expect(pegarFicha('a').escCurrent).toBe(13);
    useCharacterStore.getState().tickRoundConditions(); expect(pegarFicha('a').escCurrent).toBe(5);
  });
  it('rodadas zero permanece e a ficha permite remover só essa concessão', async () => {
    await executarAcaoAtiva('u', proteger('10', 0), 'a'); useCharacterStore.getState().tickRoundConditions(); useCharacterStore.getState().tickRoundConditions();
    render(<AcoesAtivasSection charId="a" />); expect(screen.getByText(/10 escudo · até remover/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Remover proteção Proteção')); expect(pegarFicha('a').escCurrent).toBe(5); expect(pegarFicha('a').protecoesOmni).toEqual([]);
  });
  it('reconcilia redução manual antes de expirar e limpa a concessão ao encerrar cena', async () => {
    await executarAcaoAtiva('u', proteger('10', 1), 'a'); useCharacterStore.getState().updateCharacter('a', { escCurrent: 3 }); useCharacterStore.getState().tickRoundConditions();
    expect(pegarFicha('a').escCurrent).toBe(3); expect(pegarFicha('a').protecoesOmni).toEqual([]);
    await executarAcaoAtiva('u', proteger(), 'a'); useCharacterStore.getState().resetSceneForCharacter('a');
    expect(pegarFicha('a').escCurrent).toBe(0); expect(pegarFicha('a').protecoesOmni).toEqual([]);
  });
  it('redução manual parcial consome a concessão e preserva novas fontes na expiração', async () => {
    await executarAcaoAtiva('u', proteger('10', 1), 'a');
    useCharacterStore.getState().updateCharacter('a', { escCurrent: 11 });
    expect(pegarFicha('a').protecoesOmni?.[0].restante).toBe(6);
    useCharacterStore.getState().applyShield('a', 7); useCharacterStore.getState().tickRoundConditions();
    expect(pegarFicha('a').escCurrent).toBe(12);
  });
  it('proteção com dados registra rolagens e valor negativo não retira reserva', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const r = await executarAcaoAtiva('u', proteger('2d8 + 1'), 'a'); expect(pegarFicha('a').escCurrent).toBe(16); expect(r.ok && r.detalhe).toContain('2d8 [5, 5] = 10');
    await executarAcaoAtiva('u', proteger('-4'), 'a'); expect(pegarFicha('a').escCurrent).toBe(16);
  });
  it('purificação específica remove todas as instâncias daquele tipo e preserva as demais', async () => {
    await executarAcaoAtiva('u', cfg({ acao: 'bonus', efeitos: [{ tipo: 'remover_condicao', condicao: 'Caído' }] }), 'a');
    expect(pegarFicha('a').activeConditions.map(c => c.conditionId)).toEqual(['exposto']);
  });
  it('cura e purificação funcionam juntas mesmo quando PV já estão completos', async () => {
    useCharacterStore.getState().updateCharacter('a', { hpCurrent: 25 });
    const r = await executarAcaoAtiva('u', cfg({ acao: 'bonus', tipo_efeito: 'cura', cura: '8', efeitos: [{ tipo: 'remover_condicao', condicao: 'todas' }, { tipo: 'escudo', valor: '3', rodadas: 1 }] }), 'a');
    expect(r.ok && r.cura).toBe(0); expect(r.ok && r.efeitoAplicado).toBe(true); expect(pegarFicha('a').activeConditions).toEqual([]); expect(pegarFicha('a').escCurrent).toBe(8);
  });
  it('área de apoio não concede proteção nem remove condições de inimigos', async () => {
    const r = await executarAcaoAtiva('u', cfg({ acao: 'bonus', tipo_alvo: 'area', area: { forma: 'raio_em_si', tamanho_m: 10 }, efeitos: [{ tipo: 'escudo', valor: '5', rodadas: 1 }, { tipo: 'remover_condicao', condicao: 'todas' }] }), { ponto: { x: 0, y: 0 } });
    expect(r.ok).toBe(true); expect(pegarFicha('b').escCurrent).toBe(5); expect(pegarFicha('a').activeConditions).toEqual([]); expect(pegarFicha('i').escCurrent).toBe(0);
  });
  it('efeitos de suporte dos graus de TR substituem os padrões e multiplicam duração', async () => {
    forcarDados(1);
    await executarAcaoAtiva('u', cfg({ acao: 'bonus', teste: 'tr', cd: '10', efeitos: [{ tipo: 'escudo', valor: '100', rodadas: 1 }], desfechosTR: { falha_critica: { multiplicador_duracao: 2, efeitos: [{ tipo: 'pv_temporarios', valor: '4', rodadas: 2 }, { tipo: 'remover_condicao', condicao: 'todas' }] } } }), 'a');
    expect(pegarFicha('a').escCurrent).toBe(9); expect(pegarFicha('a').protecoesOmni?.[0].rodadas).toBe(4); expect(pegarFicha('a').activeConditions).toEqual([]);
  });
  it.each([{ tipo: 'escudo', valor: '1 / 0', rodadas: 1 }, { tipo: 'escudo', valor: '5', rodadas: -1 }, { tipo: 'escudo', valor: '5', rodadas: 1.5 }, { tipo: 'remover_condicao', condicao: 'inexistente' }] as const)('configuração inválida não gasta recursos: %j', async ef => {
    const r = await executarAcaoAtiva('u', cfg({ efeitos: [{ ...ef }] }), 'a'); expect(r.ok).toBe(false); expect(pegarFicha('u').peCurrent).toBe(20); expect(pegarFicha('a').escCurrent).toBe(5);
  });
  it('a virada de rodada do combate expira a proteção', async () => {
    await executarAcaoAtiva('u', proteger('10', 1), 'a');
    useCombatStore.setState({ initiativeOrder: [{ charId: 'u', total: 10 }, { charId: 'a', total: 5 }], currentTurnIndex: 0, round: 1 } as never);
    useCombatStore.getState().nextTurn(); expect(pegarFicha('a').escCurrent).toBe(15);
    useCombatStore.getState().nextTurn(); expect(pegarFicha('a').escCurrent).toBe(5);
  });
  it('exportação e sincronização por ficha preservam prazos e saldos', async () => {
    await executarAcaoAtiva('u', proteger(), 'a');
    const remoto = JSON.parse(JSON.stringify(withStamps([pegarFicha('a')])));
    const recebido = mergeIncomingCharacters<ReturnType<typeof pegarFicha>>([], remoto)[0]; expect(recebido.protecoesOmni).toEqual(pegarFicha('a').protecoesOmni); expect(recebido.escCurrent).toBe(15);
  });
  it('construtor e JSON preservam os três efeitos, inclusive nos graus de TR', () => {
    let salvo: EntidadeOmni;
    function Editor() { const [e,set] = useState<EntidadeOmni>({ ...novaEntidade('item'), acoesAtivas: [cfg({ efeitos: [{ tipo: 'condicao', condicao: 'caido', rodadas: 1 }, { tipo: 'condicao', condicao: 'caido', rodadas: 1 }], teste: 'tr', desfechosTR: { sucesso: { efeitos: [{ tipo: 'condicao', condicao: 'caido', rodadas: 1 }] } } })] }); return <EditorAcoesAtivas ent={e} setEnt={n => { salvo=n; set(n); }} />; }
    render(<Editor />); fireEvent.change(screen.getByLabelText('Efeito 1 1'), { target: { value: 'escudo' } }); fireEvent.change(screen.getByLabelText('Valor da proteção 1 1'), { target: { value: '2d8' } }); fireEvent.change(screen.getByLabelText('Duração da proteção 1 1'), { target: { value: '3' } }); fireEvent.change(screen.getByLabelText('Efeito 1 2'), { target: { value: 'remover_condicao' } }); fireEvent.change(screen.getByLabelText('Remover condição 1 2'), { target: { value: 'exposto' } }); fireEvent.change(screen.getByLabelText('Efeito Sucesso 1'), { target: { value: 'pv_temporarios' } });
    const p = PacoteOmniSchema.parse({ formato: 'omni-engine.v1', nome: 'suporte', geradoEm: 0, entidades: [salvo!] }); const a = p.entidades[0].acoesAtivas![0];
    expect(a.efeitos).toEqual([{ tipo: 'escudo', valor: '2d8', rodadas: 3 }, { tipo: 'remover_condicao', condicao: 'exposto' }]); expect(a.desfechosTR?.sucesso?.efeitos?.[0]).toMatchObject({ tipo: 'pv_temporarios', valor: '5', rodadas: 1 });
  });
});
