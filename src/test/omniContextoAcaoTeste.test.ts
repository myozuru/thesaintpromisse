// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { avaliarFormula } from '@/lib/omni/parser';
import { variaveisContexto } from '@/lib/omni/contextoEvento';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { novaEntidade, type AcaoAtivaConfig } from '@/lib/omni/tipos';
import { buildAttackContext, rollAttack } from '@/lib/combatEngine';
import { findWeaponByName } from '@/lib/weapons';
import { ficha, montarMesa, pegarFicha, limparMesa, forcarDados } from './helpers/mesaReal';
import * as bus from '@/lib/omni/eventBus';

beforeEach(() => {
  useInventoryStore.setState({ items: {} });
  useOmniRuntimeStore.setState({ efeitos: {} });
  useOmniEntidadesStore.setState({ entidades: {} });
  montarMesa([
    ficha('a', { hpCurrent: 100, hpMax: 100, escCurrent: 0, rd: 0, actionsCurrent: 1, mainHandWeaponName: 'Adaga', attributes: [] }),
    ficha('b', { hpCurrent: 100, hpMax: 100, escCurrent: 0, rd: 0, savingThrows: [] }),
  ], { a: [0, 0], b: [1, 0] });
});
afterEach(limparMesa);

describe('keys de ação e teste no ataque real', () => {
  it('segunda arma usa arma do golpe; identifica acerto, crítico e margem', async () => {
    const w = findWeaponByName('Adaga')!;
    expect(w).toBeDefined();
    forcarDados(20, 4, 4);
    const r = await rollAttack(buildAttackContext({ attacker: pegarFicha('a'), weapon: w, targetDefense: 12, targetId: 'b', situation: { isOffHand: true } }));
    const vars = variaveisContexto(r.contexto);
    const esperado = { 'ACAO.eh_ataque': 1, 'ACAO.eh_feitico': 0, 'ACAO.eh_cac': 1, 'ACAO.eh_distancia': 0, 'ACAO.eh_segunda_arma': 1,
      'TESTE.valor_natural': 20, 'TESTE.total': r.attackTotal, 'TESTE.dt': 12, 'TESTE.sucesso': 1, 'TESTE.margem': r.attackTotal - 12, 'TESTE.eh_tr': 0 };
    for (const [key, value] of Object.entries(esperado)) {
      expect(avaliarFormula(`@${key}`, vars)).toMatchObject({ valor: value, avisos: [] });
    }
  });
  it('erro publica sucesso zero e margem negativa', async () => {
    const spy = vi.spyOn(bus, 'emitirEvento');
    forcarDados(1);
    const r = await rollAttack(buildAttackContext({ attacker: pegarFicha('a'), weapon: findWeaponByName('Adaga')!, targetDefense: 30, targetId: 'b' }));
    expect(r.hit).toBe(false);
    expect(r.contexto?.teste?.sucesso).toBe(0);
    expect(r.contexto?.teste?.margem).toBe(r.attackTotal - 30);
    expect(spy.mock.calls.some(([e]) => e === 'aoErrarAtaque')).toBe(true);
  });
});

describe('TR de ação Omni', () => {
  it.each([1, 20])('resultado natural %s chega ao evento e ao dano', async (natural) => {
    const spy = vi.spyOn(bus, 'emitirEvento');
    const cfg: AcaoAtivaConfig = { id: 'tr', nome: 'Teste', acao: 'comum', custoPE: '0', alcanceM: 0, teste: 'tr', tr: 'fortitude', cd: '15', metadeNoSucesso: true, dano: '20' };
    forcarDados(natural);
    await executarAcaoAtiva('a', cfg, 'b', novaEntidade('feitico', 'Teste'));
    const op = spy.mock.calls.find(([e]) => e === 'aoResolverTeste')![1]!;
    expect(op.usuarioId).toBe('b'); // Quem fez o TR.
    expect(op.contexto?.teste).toEqual({ valor_natural: natural, total: natural, dt: 15, sucesso: natural >= 15 ? 1 : 0, margem: natural - 15, eh_tr: 1 });
    await vi.waitFor(() => expect(spy.mock.calls.some(([e]) => e === 'depoisDeSofrerDano')).toBe(true));
    const dano = spy.mock.calls.find(([e]) => e === 'depoisDeSofrerDano')![1]!;
    expect(dano.contexto?.acao?.eh_feitico).toBe(1);
    expect(dano.contexto?.teste).toEqual(op.contexto?.teste);
    expect(pegarFicha('b').hpCurrent).toBe(natural >= 15 ? 90 : 80);
  });
});

describe('falhas de morte leem o tracker real', () => {
  it('entrada por exaustão e saída de morrendo atualizam as keys', () => {
    useCharacterStore.getState().updateCharacter('a', { exhaustionLevel: 4 });
    useCharacterStore.getState().setDying('a', true);
    const vars = montarVariaveisDoPersonagem(pegarFicha('a'));
    expect(avaliarFormula('@USUARIO.falhas_morte', vars)).toMatchObject({ valor: 2, avisos: [] });
    expect(avaliarFormula('@USUARIO.limite_falhas_morte', vars).valor).toBe(3);
    useCharacterStore.getState().setDying('a', false);
    expect(avaliarFormula('@ALVO.falhas_morte', montarVariaveisDoPersonagem(pegarFicha('a'), 'ALVO')).valor).toBe(0);
  });
});
