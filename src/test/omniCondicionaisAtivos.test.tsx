// @vitest-environment jsdom
import { useState } from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async (original) => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
import { ficha, montarMesa, limparMesa, pegarFicha, comoTela, forcarDados, esperar } from './helpers/mesaReal';
import { avaliarPredicadoEstado, avaliarCondicionaisAtivos } from '@/lib/omni/condicionaisAtivos';
import { executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { avaliarFormula } from '@/lib/omni/parser';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { grantAdvantage, grantFlatBonus, peekAdvantageFor } from '@/lib/omni/rollAdvantage';
import type { ActiveCondition } from '@/types/conditions';
import type { AcaoAtivaConfig, ModificadorCondicionalAtivo, OperadorEstado } from '@/lib/omni/tipos';
import { PacoteOmniSchema } from '@/lib/omni/validacao';
import { novaEntidade } from '@/lib/omni/tipos';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { EditorCondicionaisAtivos } from '@/components/omni/EditorCondicionaisAtivos';

const cond = (patch: Partial<ActiveCondition> = {}): ActiveCondition => ({ id: 'cond', conditionId: 'caido', name: 'Caído', icon: '', remainingTurns: -1, remainingRounds: -1, ...patch });
const cfg: AcaoAtivaConfig = { id: 'acao', nome: 'Genérica', acao: 'comum', custoPE: '2', alcanceM: 6, teste: 'nenhum', dano: '2', tipoDano: 'Impacto' };
const bloco = (patch: Partial<ModificadorCondicionalAtivo> = {}): ModificadorCondicionalAtivo => ({ id: 'bloco', se_alvo: [{ tipo: 'tem_condicao', nome: 'Caído' }], ...patch });
const mesa = (condicoes: ActiveCondition[] = [cond({ elapsedRounds: 3 })]) => {
  montarMesa([
    ficha('u', { attributes: [{ id: 'FOR', name: 'Força', value: 10 }], mainHandWeaponName: 'Espada Curta', meleeTrained: true, trainingBonus: 0, actionsCurrent: 1, omniCounters: { foco: 3 } }),
    ficha('a', { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, escCurrent: 0, rd: 0, ca: 10, activeConditions: condicoes }),
  ], { u: [0, 0], a: [2, 0] });
};
beforeEach(() => comoTela({ profileId: null, role: 'MASTER' }));
afterEach(async () => {
  cleanup();
  await import('@/lib/omni/eventBus');
  await import('@/lib/omni/observadores');
  await esperar();
  limparMesa();
});

describe('estado e idade de condições', () => {
  it('nova condição inicia em zero e conta rodadas completas, sem contar turnos', () => {
    mesa([]);
    const store = useCharacterStore.getState();
    store.addCondition('a', cond({ remainingRounds: 5 }));
    store.tickConditions('a');
    expect(pegarFicha('a').activeConditions![0].elapsedRounds).toBe(0);
    store.tickRoundConditions(); store.tickRoundConditions(); store.tickRoundConditions();
    const c = pegarFicha('a').activeConditions![0];
    expect(c.elapsedRounds).toBe(3);
    expect(c.remainingRounds).toBe(2);
    expect(avaliarPredicadoEstado({ tipo: 'rodadas_condicao', nome: 'Caído', operador: '>=', valor: 3 }, pegarFicha('a'), pegarFicha('u'))).toBe(true);
    const vars = montarVariaveisDoPersonagem(pegarFicha('a'), 'ALVO');
    expect(avaliarFormula('@ALVO.condicao_idade_rodadas_caido', vars).valor).toBe(3);
    expect(avaliarFormula('@ALVO.condicao_rodadas_caido', vars).valor).toBe(2);
    expect(avaliarFormula('@ALVO.condicao_idade_conhecida_caido', vars).valor).toBe(1);
  });
  it('legada não ganha idade inventada nem ativa comparação, inclusive !=', () => {
    mesa([cond()]);
    useCharacterStore.getState().tickRoundConditions();
    expect(pegarFicha('a').activeConditions![0].elapsedRounds).toBeUndefined();
    for (const operador of ['<', '<=', '==', '!=', '>=', '>'] as OperadorEstado[]) expect(avaliarPredicadoEstado({ tipo: 'rodadas_condicao', nome: 'Caído', operador, valor: 3 }, pegarFicha('a'), pegarFicha('u'))).toBe(false);
    const vars = montarVariaveisDoPersonagem(pegarFicha('a'), 'ALVO');
    expect(avaliarFormula('@ALVO.condicao_rodadas_caido', vars).valor).toBe(999);
    expect(avaliarFormula('@ALVO.condicao_idade_rodadas_caido', vars).valor).toBe(-1);
    expect(avaliarFormula('@ALVO.condicao_idade_conhecida_caido', vars).valor).toBe(0);
  });
  it('duplicatas usam maior idade conhecida; remoção e reaplicação reiniciam idade', () => {
    mesa([cond({ id: 'velha', elapsedRounds: 4 }), cond({ id: 'nova', elapsedRounds: 1 }), cond({ id: 'legada' })]);
    expect(avaliarPredicadoEstado({ tipo: 'rodadas_condicao', nome: 'Caído', operador: '==', valor: 4 }, pegarFicha('a'), pegarFicha('u'))).toBe(true);
    const store = useCharacterStore.getState();
    for (const id of ['velha', 'nova', 'legada']) store.removeCondition('a', id);
    expect(avaliarPredicadoEstado({ tipo: 'rodadas_condicao', nome: 'Caído', operador: '==', valor: 0 }, pegarFicha('a'), pegarFicha('u'))).toBe(false);
    store.addCondition('a', cond());
    expect(pegarFicha('a').activeConditions![0].elapsedRounds).toBe(0);
  });
  it('PV usa vida real, cargas e distância leem o estado correto', () => {
    mesa();
    useCharacterStore.getState().updateCharacter('a', { hpCurrent: 24, escCurrent: 100 });
    const a = pegarFicha('a'), u = pegarFicha('u');
    expect(avaliarPredicadoEstado({ tipo: 'pv_percentual', operador: '<', valor: 25 }, a, u)).toBe(true);
    expect(avaliarPredicadoEstado({ tipo: 'cargas', nome: 'FOCO', operador: '==', valor: 3 }, u, a)).toBe(true);
    expect(avaliarPredicadoEstado({ tipo: 'distancia', operador: '==', valor: 3 }, u, a)).toBe(true);
    useMapStore.setState({ entities: {} });
    expect(avaliarPredicadoEstado({ tipo: 'distancia', operador: '<=', valor: 3 }, u, a)).toBe(false);
    expect(avaliarPredicadoEstado({ tipo: 'pv_percentual', operador: '!=', valor: 0 }, ficha('sem-pv'), u)).toBe(false);
  });
  it.each([['<', false], ['<=', true], ['==', true], ['!=', false], ['>=', true], ['>', false]] as const)('comparador %s', (operador, esperado) => {
    mesa();
    expect(avaliarPredicadoEstado({ tipo: 'cargas', nome: 'foco', operador, valor: 3 }, pegarFicha('u'), pegarFicha('a'))).toBe(esperado);
  });
  it('AND entre sujeito/alvo e soma entre blocos, ignorando bloco vazio', () => {
    mesa();
    const b = bloco({ se_usuario: [{ tipo: 'cargas', nome: 'foco', operador: '>=', valor: 3 }], margem_critico_mod: -2, dano_extra: '2d6' });
    const r = avaliarCondicionaisAtivos([b, bloco({ id: 'mais', mod_tr_alvo: -2 }), { id: 'vazio', dano_extra: '99d6' }], pegarFicha('u'), pegarFicha('a'));
    expect(r.margem).toBe(-2); expect(r.tr).toBe(-2); expect(r.danos).toEqual(['2d6']); expect(r.ativos).toHaveLength(2);
    expect(avaliarCondicionaisAtivos([{ ...b, se_usuario: [{ tipo: 'cargas', nome: 'foco', operador: '>', valor: 3 }] }], pegarFicha('u'), pegarFicha('a')).ativos).toHaveLength(0);
  });
});

describe('execução real de condicionais', () => {
  it('checa cargas antes de consumi-las e aplica dano extra', async () => {
    mesa(); forcarDados(6, 6);
    const r = await executarAcaoAtiva('u', { ...cfg, consumirContador: { nome: 'foco', minimo: 1 }, condicionais: [bloco({ se_usuario: [{ tipo: 'cargas', nome: 'foco', operador: '>=', valor: 3 }], dano_extra: '2d6' })] }, 'a');
    expect(r.ok && r.dano).toBe(14);
    expect(pegarFicha('u').omniCounters?.foco).toBe(0);
    expect(pegarFicha('u').peCurrent).toBe(18);
  });
  it('TR combina penalidade e desvantagem e não deixa modificador para a próxima rolagem', async () => {
    mesa(); forcarDados(20, 10);
    const r = await executarAcaoAtiva('u', { ...cfg, teste: 'tr', cd: '10', condicionais: [bloco({ mod_tr_alvo: -2, desvantagem_tr_alvo: true })], efeitos: [{ tipo: 'condicao', condicao: 'exposto', rodadas: 1 }] }, 'a');
    expect(r.ok && r.detalhe).toContain('Desvantagem');
    expect(r.ok && r.detalhe).toContain('10-2 = 8');
    expect(pegarFicha('a').activeConditions?.some(c => c.conditionId === 'exposto')).toBe(true);
    expect(peekAdvantageFor('a', { kind: 'save', name: 'Fortitude' })).toBe('normal');
  });
  it('vantagem existente cancela desvantagem local; bônus fixo de TR soma e é consumido', async () => {
    mesa(); grantAdvantage('a', 'advantage', 'next_save'); grantFlatBonus('a', 'next_save', 2); forcarDados(9);
    const r = await executarAcaoAtiva('u', { ...cfg, teste: 'tr', cd: '10', metadeNoSucesso: true, condicionais: [bloco({ desvantagem_tr_alvo: true })] }, 'a');
    expect(r.ok && r.dano).toBe(1);
    expect(r.ok && r.detalhe).not.toContain('2d20');
    expect(peekAdvantageFor('a', { kind: 'save', name: 'Fortitude' })).toBe('normal');
  });
  it('crítico x3 aplica aos dados da arma e da ação, sem multiplicar fixos', async () => {
    mesa(); forcarDados(17, 6, 6, 6, 6, 6, 6);
    const r = await executarAcaoAtiva('u', { ...cfg, teste: 'ataque', incluirArma: true, dano: '1d6+2', condicionais: [bloco({ margem_critico_mod: -2, multiplicador_critico_mod: 1 })] }, 'a');
    expect(r.ok && r.detalhe).toContain('CRÍTICO');
    expect(r.ok && r.dano).toBe(38);
  });
  it('Executor combina PV baixo com vantagem e crítico, sem alterar próximo ataque', async () => {
    mesa(); useCharacterStore.getState().updateCharacter('a', { hpCurrent: 24 });
    forcarDados(1, 20, 6, 6, 6, 6, 6, 6);
    const r = await executarAcaoAtiva('u', { ...cfg, teste: 'ataque', dano: '1d6', condicionais: [bloco({ se_alvo: [{ tipo: 'pv_percentual', operador: '<', valor: 25 }], vantagem_acerto: true, multiplicador_critico_mod: 1 })] }, 'a');
    expect(r.ok && r.dano).toBe(18);
    expect(peekAdvantageFor('u', { kind: 'attack', subtype: 'melee' })).toBe('normal');
  });
  it('múltiplos alvos ativam blocos independentemente', async () => {
    mesa();
    useCharacterStore.setState({ characters: [...useCharacterStore.getState().characters, ficha('b', { hpCurrent: 100, hpMax: 100, escCurrent: 0, category: 'INIMIGO' })] });
    const r = await executarAcaoAtiva('u', { ...cfg, alcanceM: 0, tipo_alvo: 'multiplo', max_alvos: '2', condicionais: [bloco({ dano_extra: '3' })] }, ['a', 'b']);
    expect(r.ok && r.dano).toBe(7);
    expect(pegarFicha('a').hpCurrent).toBe(95);
    expect(pegarFicha('b').hpCurrent).toBe(98);
    expect(pegarFicha('u').peCurrent).toBe(18);
  });
});

it('editor salva checagens e efeitos por cliques', () => {
  const save = vi.fn();
  function Tela() {
    const [blocos, set] = useState<ModificadorCondicionalAtivo[]>([]);
    return <EditorCondicionaisAtivos blocos={blocos} onChange={b => { save(b); set(b); }} />;
  }
  render(<Tela />);
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar condicional' }));
  fireEvent.change(screen.getByLabelText('Checagem 1 se_alvo 1'), { target: { value: 'rodadas_condicao' } });
  fireEvent.change(screen.getByLabelText('Valor 1 se_alvo 1'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Delta da margem crítica 1'), { target: { value: '-2' } });
  fireEvent.change(screen.getByLabelText('Dano extra 1'), { target: { value: '2d6' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Vantagem no acerto' }));
  expect(save.mock.lastCall![0][0]).toMatchObject({ se_alvo: [{ tipo: 'rodadas_condicao', nome: 'caido', operador: '>=', valor: 3 }], margem_critico_mod: -2, dano_extra: '2d6', vantagem_acerto: true });
});


describe('pacotes preservam as primitivas genéricas', () => {
  it('exporta, valida e reimporta alvos, áreas, condicionais e dados legados', () => {
    const store = useOmniEntidadesStore.getState();
    store.resetar();
    const ativo: AcaoAtivaConfig = { ...cfg, tipo_alvo: 'area', filtro_alvo: 'inimigos', max_alvos: '@USUARIO.treino', area: { forma: 'cone', tamanho_m: 6 },
      margemCritico: { condicao: '@ALVO.condicao_idade_rodadas_caido >= 3', reducao: 2 },
      consumirContador: { nome: 'foco', minimo: 1 }, efeitos: [{ tipo: 'puxar', metros: 3 }],
      condicionais: [bloco({ margem_critico_mod: -2, multiplicador_critico_mod: 1, vantagem_acerto: true, desvantagem_tr_alvo: true, mod_tr_alvo: -2, dano_extra: '2d6' })] };
    const ent = { ...novaEntidade('item', 'Teste'), acoesAtivas: [ativo, cfg] };
    store.importarPacote({ formato: 'omni-engine.v1', nome: 'Teste', geradoEm: 0, entidades: [ent] });
    const pacote = PacoteOmniSchema.parse(JSON.parse(JSON.stringify(store.exportarPacote())));
    expect(pacote.entidades[0].acoesAtivas).toEqual([ativo, cfg]);
    store.resetar();
    store.importarPacote(pacote as unknown as import('@/lib/omni/tipos').PacoteOmni);
    expect(store.listar()[0].acoesAtivas).toEqual([ativo, cfg]);
    store.resetar();
  });
  it('rejeita predicados malformados em vez de perder silenciosamente os campos', () => {
    const ent = { ...novaEntidade('item', 'Teste'), acoesAtivas: [{ ...cfg, condicionais: [{ id: 'b', se_alvo: [{ tipo: 'pv_percentual', operador: '???', valor: 25 }] }] }] };
    expect(PacoteOmniSchema.safeParse({ formato: 'omni-engine.v1', nome: 'Teste', geradoEm: 0, entidades: [ent] }).success).toBe(false);
  });
});
