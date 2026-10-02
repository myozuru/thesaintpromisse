// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { avaliarFormula, diagnosticarKeysFormula } from '@/lib/omni/parser';
import { contextoDano, variaveisContexto } from '@/lib/omni/contextoEvento';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { novaEntidade } from '@/lib/omni/tipos';
import { ficha, montarMesa, pegarFicha, limparMesa } from './helpers/mesaReal';
import * as bus from '@/lib/omni/eventBus';

beforeEach(() => {
  useInventoryStore.setState({ items: {} });
  useOmniEntidadesStore.setState({ entidades: {} });
  useOmniRuntimeStore.setState({ efeitos: {} });
  montarMesa([
    ficha('a', { hpCurrent: 100, hpMax: 100, escCurrent: 0, rd: 0 }),
    ficha('b', { hpCurrent: 100, hpMax: 100, escCurrent: 0, rd: 5 }),
  ], { a: [0, 0], b: [1, 0] });
});
afterEach(limparMesa);

describe('DANO.* resolve valores reais', () => {
  const esperado = {
    tipo: 1, fonte: 1, valor_inicial: 20, valor_final: 15, absorvido: 5,
    id_origem: 1, id_alvo: 1, alcance: 3, foi_critico: 1,
    foi_falha_critica: 0, foi_furtivo: 1, foi_ataque_oportunidade: 1, tipo_ataque: 1, resolvido: 1,
  };
  it.each(Object.entries(esperado))('%s → %s', (key, valor) => {
    const vars = variaveisContexto(contextoDano(20, 15, {
      tipo: 'DCO', atacanteId: 'a', alvoId: 'b', alcance: 3, isMelee: true, tags: ['critical', 'furtivo', 'ado'],
    }));
    const r = avaliarFormula(`@DANO.${key}`, vars);
    expect(r.valor).toBe(valor);
    expect(r.avisos).toEqual([]);
  });
  it('antes do dano não inventa um valor final', () => {
    const vars = variaveisContexto(contextoDano(20, undefined));
    expect(avaliarFormula('@DANO.resolvido', vars).valor).toBe(0);
    expect(avaliarFormula('@DANO.valor_final', vars).avisos[0].tipo).toBe('sem_contexto');
  });
  it('key errada avisa, zero conhecido não avisa e contador ausente vale zero', () => {
    expect(avaliarFormula('@USUARIO.vidaa + 1').avisos[0].tipo).toBe('desconhecida');
    expect(avaliarFormula('@DANO.valor_final', { DANO_VALOR_FINAL: 0 }).avisos).toEqual([]);
    expect(avaliarFormula('@USUARIO.contador_brasas').avisos).toEqual([]);
    expect(diagnosticarKeysFormula('@DANO.valor_final')).toEqual([]);
    expect(avaliarFormula('@USUARIO.minha_flag', { USUARIO_MINHA_FLAG: 2 }).avisos).toEqual([]);
  });
});

describe('dano real → eventos e fórmulas Omni', () => {
  it('informa dano bruto, final e crítico após RD; antes não possui final', async () => {
    const spy = vi.spyOn(bus, 'emitirEvento');
    useCharacterStore.getState().applyDamage('b', 20, 'DCO', { attackerId: 'a', isMelee: true, tags: ['critical'] });
    await vi.waitFor(() => expect(spy.mock.calls.some(([e]) => e === 'depoisDeSofrerDano')).toBe(true));
    const antes = spy.mock.calls.find(([e]) => e === 'antesDeSofrerDano')![1]!;
    const depois = spy.mock.calls.find(([e]) => e === 'depoisDeSofrerDano')![1]!;
    expect(antes.contexto?.dano?.valor_final).toBeUndefined();
    expect(depois.contexto?.dano).toMatchObject({ valor_inicial: 20, valor_final: 15, absorvido: 5, foi_critico: 1 });
    expect(pegarFicha('b').hpCurrent).toBe(85);
  });
  it.each(['bloqueio', 'imunidade', 'rd'])('dano totalmente impedido por %s produz final zero', async (tipo) => {
    useCharacterStore.getState().updateCharacter('b', tipo === 'bloqueio' ? { omniFlags: { bloqueio_total: 1 } } : tipo === 'imunidade' ? { immunities: ['DCO'] } : { rd: 50 });
    const spy = vi.spyOn(bus, 'emitirEvento');
    useCharacterStore.getState().applyDamage('b', 20, 'DCO', { attackerId: 'a' });
    await vi.waitFor(() => expect(spy.mock.calls.some(([e]) => e === 'depoisDeSofrerDano')).toBe(true));
    const op = spy.mock.calls.find(([e]) => e === 'depoisDeSofrerDano')![1]!;
    expect(op.contexto?.dano).toMatchObject({ valor_final: 0, absorvido: 20 });
    expect(pegarFicha('b').hpCurrent).toBe(100);
  });
  it('passiva vinculada usa dano final e não o bruto', async () => {
    const ent = novaEntidade('passiva', 'Registrar dano');
    ent.gatilhos = [{ id: 'g', evento: 'aoCausarDano', blocos: [{ id: 'b', modo: 'todas', condicoes: [], acoes: [{
      id: 'c', acao: 'INCREMENTAR_CONTADOR', alvoAplicacao: 'USUARIO', caminhoAlvo: 'dano_real', valor: { tipo: 'formula', expressao: '@DANO.valor_final' },
    }] }] }];
    useOmniEntidadesStore.setState({ entidades: { [ent.id]: ent } });
    useCharacterStore.getState().updateCharacter('a', { omniAtivos: [{ entidadeId: ent.id, categoria: 'passiva' }] } as never);
    useCharacterStore.getState().applyDamage('b', 20, 'DCO', { attackerId: 'a' });
    await vi.waitFor(() => expect(pegarFicha('a').omniCounters?.dano_real).toBe(15));
  });
  it('script novo bloqueia antes do dano; script depois registra absorção', () => {
    const ent = novaEntidade('item', 'Escudo reativo');
    ent.combatData = { critRange: 20, critMultiplier: 2, effects: [], effectsActive: [
      { id: 'pre', type: 'MODIFICADOR', target: 'USUARIO', resourcePath: 'dano_pendente', formula: '0', trigger: 'antesDeSofrerDano' },
      { id: 'pos', type: 'ADICIONAR', target: 'USUARIO', resourcePath: 'contador_absorvido', formula: '@DANO.absorvido', trigger: 'depoisDeSofrerDano' },
    ] };
    const item = useInventoryStore.getState().add('b', ent);
    useInventoryStore.getState().equipItem(item.instanceId, 'colar');
    useCharacterStore.getState().applyDamage('b', 20, 'DCO', { attackerId: 'a' });
    expect(pegarFicha('b').hpCurrent).toBe(100);
    expect(pegarFicha('b').omniCounters?.absorvido).toBe(20);
  });
});
