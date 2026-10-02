// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { parseOmniScript } from '@/lib/omni/omniScript';
import { novaEntidade } from '@/lib/omni/tipos';
import type { EntidadeOmni } from '@/lib/omni/tipos';
import type { Character } from '@/types';
import * as eventBus from '@/lib/omni/eventBus';
import * as triggers from '@/lib/omni/triggerEfeitos';
import { calcularContador } from '@/lib/omni/contadores';
import { avaliarFormula } from '@/lib/omni/parser';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha } from './helpers/mesaReal';

function script(id: string, texto: string): EntidadeOmni {
  const parsed = parseOmniScript(texto, { defaultTarget: 'USUARIO' });
  expect(parsed.erros).toEqual([]);
  return { ...novaEntidade('passiva', id), id, combatData: { effects: [], critRange: 20, critMultiplier: 2, effectsPassive: parsed.efeitos } };
}
function vincular(ent: EntidadeOmni) {
  useOmniEntidadesStore.setState({ entidades: { ...useOmniEntidadesStore.getState().entidades, [ent.id]: ent } });
  return { id: `v-${ent.id}`, entidadeId: ent.id, categoria: 'passiva', instanceId: `i-${ent.id}`, vinculadoEm: 0 } as const;
}
const char = (id: string, patch: Partial<Character> = {}) => ficha(id, { hpCurrent: 100, hpMax: 100, escCurrent: 0, rd: 0, ...patch });
const contadores = (id: string) => pegarFicha(id).omniCounters;
const registro = () => script('registro', `@causar_dano -> somar 1 em contador_eventos
@causar_dano -> somar @DANO.valor_inicial em contador_inicial
@causar_dano -> somar @DANO.valor_final em contador_final
@causar_dano -> somar @DANO.absorvido em contador_absorvido`);

beforeEach(() => {
  comoTela({ profileId: null, role: 'MASTER' });
  useOmniEntidadesStore.setState({ entidades: {} });
  for (const method of ['log', 'group', 'groupEnd'] as const) vi.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => { limparMesa(); vi.restoreAllMocks(); });

describe('Contexto DANO do combate real', () => {
  it.each(['global', 'porFonte'] as const)('incrementar zero preserva contadores com teto %s', (escopoTeto) => {
    const origem: Record<string, number> = escopoTeto === 'global' ? { cargas: 3 } : { cargas: 3, cargas__fonte__alvo: 3 };
    const res = calcularContador(origem, 'cargas', 'INCREMENTAR_CONTADOR', { valor: 0, fonteId: 'alvo', escopoTeto, teto: 4 });
    expect(res.counters).toEqual(origem);
  });

  it.each([
    ['sem RD', {}, {}, 20, 0],
    ['RD parcial', { rd: 7 }, {}, 13, 7],
    ['RD total', { rd: 50 }, {}, 0, 20],
    ['RD ignorada', { rd: 50 }, { ignoresRD: true }, 20, 0],
    ['Penetrante', { rd: 7 }, { rdIgnore: 3 }, 16, 4],
    ['imunidade', { immunities: ['DCO'] }, {}, 0, 20],
    ['imunidade ignorada', { immunities: ['DCO'] }, { ignoresResistance: true }, 20, 0],
    ['vulnerabilidade', { vulnerabilities: ['DCO'] }, {}, 30, 0],
    ['RD e vulnerabilidade', { rd: 8, vulnerabilities: ['DCO'] }, {}, 18, 2],
    ['PVT', { escCurrent: 12 }, {}, 20, 0],
  ] as const)('%s informa dano resolvido, inclusive quando é zero', async (_nome, patch, opts, final, absorvido) => {
    montarMesa([char('atacante', { omniAtivos: [vincular(registro())] }), char('alvo', patch as Partial<Character>)], {});
    useCharacterStore.getState().applyDamage('alvo', 20, 'DCO', { attackerId: 'atacante', ...opts });
    await waitFor(() => expect(contadores('atacante')?.eventos).toBe(1));
    expect(contadores('atacante')).toMatchObject({ inicial: 20, final, absorvido });
    expect(100 - pegarFicha('alvo').hpCurrent + ('escCurrent' in patch ? patch.escCurrent : 0) - pegarFicha('alvo').escCurrent).toBe(final);
  });

  it('pre-hook usa valor inicial para reduzir o golpe; resultado inclui essa redução e RD', async () => {
    const pre = script('pre', '@sofrer_dano -> reduzir (@DANO.valor_inicial/2) em dano_recebido');
    const spy = vi.spyOn(triggers, 'dispararGatilhoEfeitosItens');
    montarMesa([char('atacante', { omniAtivos: [vincular(registro())] }), char('alvo', { rd: 3, omniAtivos: [vincular(pre)] })], {});
    useCharacterStore.getState().applyDamage('alvo', 20, 'DCO', { attackerId: 'atacante' });
    await waitFor(() => expect(contadores('atacante')?.eventos).toBe(1));
    expect(contadores('atacante')).toMatchObject({ inicial: 20, final: 7, absorvido: 13 });
    const preCtx = spy.mock.calls.find(([evento]) => evento === 'aoSofrerDano')![1].dano!;
    expect(preCtx).toEqual({ tipo: 1, valor_inicial: 20, id_origem: 1, id_alvo: 1 });
    expect(avaliarFormula('@DANO.valor_final', {}, undefined, { dano: { ...preCtx } }).diagnosticos).toHaveLength(1);
    expect(pegarFicha('alvo').hpCurrent).toBe(93);
  });

  it('observador recebe o mesmo golpe, preservando os indicadores da origem e do alvo', async () => {
    const obs = script('obs', `@aliado_sofrer_dano -> somar 1 em contador_eventos
@aliado_sofrer_dano -> somar @DANO.valor_final em contador_final
@aliado_sofrer_dano -> somar (@DANO.id_origem + @DANO.id_alvo) em contador_ids`);
    montarMesa([char('atacante'), char('alvo', { rd: 4 }), char('obs', { omniAtivos: [vincular(obs)] })], { obs: [0, 0], alvo: [1, 0] });
    useCharacterStore.getState().applyDamage('alvo', 20, 'DCO', { attackerId: 'atacante' });
    await waitFor(() => expect(contadores('obs')?.eventos).toBe(1));
    expect(contadores('obs')).toMatchObject({ final: 16, ids: 2 });
  });

  it('bloco lógico do alvo recebe valor final e mantém CENA.dano compatível', async () => {
    const ent = novaEntidade('passiva', 'logica');
    ent.gatilhos = [{ id: 'g', evento: 'aoSofrerDano', blocos: [{ id: 'b', condicoes: [], modo: 'todas', acoes: [
      { id: 'a', acao: 'DEFINIR_CONTADOR', alvoAplicacao: 'USUARIO', caminhoAlvo: 'final', valor: { tipo: 'formula', expressao: '@DANO.valor_final' } },
      { id: 'z', acao: 'INCREMENTAR_CONTADOR', alvoAplicacao: 'USUARIO', caminhoAlvo: 'zero', valor: { tipo: 'formula', expressao: '@DANO.valor_final - @DANO.valor_final' } },
      { id: 'b', acao: 'DEFINIR_CONTADOR', alvoAplicacao: 'USUARIO', caminhoAlvo: 'legado', valor: { tipo: 'formula', expressao: '@CENA.dano' } },
    ] }] }];
    montarMesa([char('alvo', { rd: 4, omniAtivos: [vincular(ent)] })], {});
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    useCharacterStore.getState().applyDamage('alvo', 20, 'DCO');
    await waitFor(() => expect(contadores('alvo')?.final).toBe(16));
    expect(contadores('alvo')?.legado).toBe(20);
    expect(contadores('alvo')?.zero).toBe(0);
    expect(spy.mock.calls.find(([evento]) => evento === 'aoSofrerDano')![1]?.dano).toMatchObject({ id_origem: 0, id_alvo: 1 });
  });

  it('evento de morte carrega o golpe que causou a queda', async () => {
    montarMesa([char('atacante'), char('alvo', { hpCurrent: 5, rd: 2 })], {});
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    useCharacterStore.getState().applyDamage('alvo', 10, 'DCO', { attackerId: 'atacante' });
    await waitFor(() => expect(spy.mock.calls.some(([e]) => e === 'aoMorrer')).toBe(true));
    expect(spy.mock.calls.find(([e]) => e === 'aoMorrer')![1]?.dano).toEqual({ tipo: 1, valor_inicial: 10, valor_final: 8, absorvido: 2, id_origem: 1, id_alvo: 1 });
  });

  it('dois golpes consecutivos mantêm snapshots separados', async () => {
    montarMesa([char('atacante', { omniAtivos: [vincular(registro())] }), char('alvo', { rd: 3 })], {});
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    useCharacterStore.getState().applyDamage('alvo', 20, 'DCO', { attackerId: 'atacante' });
    useCharacterStore.getState().applyDamage('alvo', 8, 'DCO', { attackerId: 'atacante' });
    await waitFor(() => expect(contadores('atacante')?.eventos).toBe(2));
    expect(contadores('atacante')).toMatchObject({ inicial: 28, final: 22, absorvido: 6 });
    expect(spy.mock.calls.filter(([e]) => e === 'aoCausarDano').map(([, opts]) => opts?.dano?.valor_final)).toEqual([17, 5]);
  });
});
