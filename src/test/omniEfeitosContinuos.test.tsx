// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async original => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
vi.mock('@/components/dice-physics/DiceTrayPanel', () => ({ DiceTrayPanel: () => null }));
import { ficha, montarMesa, pegarFicha, limparMesa, comoTela, esperar, forcarDados } from './helpers/mesaReal';
import { executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
import type { AcaoAtivaConfig } from '@/lib/omni/tipos';
import { assistenciaCombina, dispararAssistenciaDano, registrarEfeitoContinuo, tickEfeitosContinuosInicioTurno } from '@/lib/omni/efeitosContinuos';
import { useCharacterStore } from '@/stores/useCharacterStore';

const espirito = (p: Partial<AcaoAtivaConfig> = {}): AcaoAtivaConfig => ({
  id: 'esp', nome: 'Espírito de Fogo', acao: 'livre', custoPE: '0', alcanceM: 0, teste: 'nenhum',
  tipo_efeito: 'cura', cura: '1d4 + 2', filtro_alvo: 'aliados', tipo_alvo: 'unico',
  continuo: { cadencia: 'inicio_turno' }, ...p,
});

beforeEach(() => {
  comoTela({ profileId: null, role: 'MASTER' });
  montarMesa([ficha('u', { hpCurrent: 30, hpMax: 30 }), ficha('a', { hpCurrent: 10, hpMax: 30 }), ficha('i', { category: 'INIMIGO', hpCurrent: 40, hpMax: 40, escCurrent: 0 })], { u: [0, 0], a: [1, 0], i: [2, 0] });
});
afterEach(async () => { await esperar(); limparMesa(); });

describe('cura contínua', () => {
  it('não cura na hora: fica no aliado e cura 1d4+2 no início de cada turno dele', async () => {
    const r = await executarAcaoAtiva('u', espirito(), 'a');
    expect(r.ok).toBe(true);
    expect(pegarFicha('a').hpCurrent).toBe(10);
    expect(pegarFicha('a').omniEfeitosContinuos).toHaveLength(1);
    forcarDados(3);
    await tickEfeitosContinuosInicioTurno('a');
    expect(pegarFicha('a').hpCurrent).toBe(15);
    forcarDados(1);
    await tickEfeitosContinuosInicioTurno('a');
    expect(pegarFicha('a').hpCurrent).toBe(18);
  });

  it('dois espíritos no mesmo aliado rolam duas vezes a cura', async () => {
    registrarEfeitoContinuo('a', { nome: 'Espírito', origemId: 'u', acaoId: 'esp', multiplicador: 1, cura: { formula: '1d4 + 2' } });
    registrarEfeitoContinuo('a', { nome: 'Espírito', origemId: 'u', acaoId: 'esp', multiplicador: 1, cura: { formula: '1d4 + 2' } });
    forcarDados(4, 3);
    await tickEfeitosContinuosInicioTurno('a');
    expect(pegarFicha('a').hpCurrent).toBe(10 + 4 + 3 + 4);
  });

  it('para de curar quando a sustentação acaba', async () => {
    registrarEfeitoContinuo('a', { nome: 'Espírito', origemId: 'u', acaoId: 'esp', multiplicador: 1, sustentacaoId: 'sumiu', cura: { formula: '5' } });
    await tickEfeitosContinuosInicioTurno('a');
    expect(pegarFicha('a').hpCurrent).toBe(10);
    expect(pegarFicha('a').omniEfeitosContinuos ?? []).toHaveLength(0);
  });

  it('com 2 rodadas cura duas vezes e some', async () => {
    registrarEfeitoContinuo('a', { nome: 'Brasa', origemId: 'u', acaoId: 'b', multiplicador: 1, rodadas: 2, cura: { formula: '1' } });
    await tickEfeitosContinuosInicioTurno('a');
    await tickEfeitosContinuosInicioTurno('a');
    await tickEfeitosContinuosInicioTurno('a');
    expect(pegarFicha('a').hpCurrent).toBe(12);
  });

  it('key inválida em uma cura contínua não interrompe os outros efeitos do turno', async () => {
    registrarEfeitoContinuo('a', { nome: 'Fórmula quebrada', origemId: 'u', acaoId: 'ruim', multiplicador: 1, cura: { formula: '@USUARIO.chave_inexistente + 2' } });
    registrarEfeitoContinuo('a', { nome: 'Brasa estável', origemId: 'u', acaoId: 'bom', multiplicador: 1, cura: { formula: '2' } });
    await expect(tickEfeitosContinuosInicioTurno('a')).resolves.toBe(1);
    expect(pegarFicha('a').hpCurrent).toBe(12);
  });
});

describe('assistência de dano', () => {
  it('escolhe os ataques certos', () => {
    expect(assistenciaCombina('corpo_a_corpo', undefined, { isMelee: true, source: 'arma' })).toBe(true);
    expect(assistenciaCombina('corpo_a_corpo', undefined, { isMelee: false, source: 'arma' })).toBe(false);
    expect(assistenciaCombina('distancia', undefined, { isMelee: false, source: 'arma' })).toBe(true);
    expect(assistenciaCombina('feitico', undefined, { source: 'feitico' })).toBe(true);
    expect(assistenciaCombina('feitico', undefined, { isMelee: true, source: 'arma' })).toBe(false);
    expect(assistenciaCombina('arma_especifica', 'katana', { source: 'arma', arma: { name: 'Katana', group: 'laminas' as never, range: 'melee' } })).toBe(true);
    expect(assistenciaCombina('arma_especifica', 'katana', { source: 'arma', arma: { name: 'Machado', group: 'machados' as never, range: 'melee' } })).toBe(false);
  });

  it('soma 1d4 no próximo golpe corpo a corpo e depois é gasto', async () => {
    registrarEfeitoContinuo('a', { nome: 'Espírito', origemId: 'u', acaoId: 'esp', multiplicador: 1, assistencia: { escopo: 'corpo_a_corpo', dano: '1d4', consumo: 'proximo_acerto' } });
    forcarDados(4);
    const extra = await dispararAssistenciaDano('i', { attackerId: 'a', isMelee: true, source: 'arma', ignoresRD: true });
    expect(extra).toBe(4);
    expect(pegarFicha('a').omniEfeitosContinuos ?? []).toHaveLength(0);
    expect(await dispararAssistenciaDano('i', { attackerId: 'a', isMelee: true, source: 'arma' })).toBe(0);
  });

  it('não entra em ataque à distância quando é só corpo a corpo', async () => {
    registrarEfeitoContinuo('a', { nome: 'Espírito', origemId: 'u', acaoId: 'esp', multiplicador: 1, assistencia: { escopo: 'corpo_a_corpo', dano: '3', consumo: 'duracao' } });
    expect(await dispararAssistenciaDano('i', { attackerId: 'a', isMelee: false, source: 'arma' })).toBe(0);
    expect(await dispararAssistenciaDano('i', { attackerId: 'a', isMelee: true, source: 'arma' })).toBe(3);
    expect(useCharacterStore.getState().characters.find(c => c.id === 'a')!.omniEfeitosContinuos).toHaveLength(1);
  });

  it('key inválida em uma assistência não interrompe as outras assistências do ataque', async () => {
    registrarEfeitoContinuo('a', { nome: 'Assistência quebrada', origemId: 'u', acaoId: 'ruim', multiplicador: 1, assistencia: { escopo: 'qualquer', dano: '@USUARIO.chave_inexistente + 4', consumo: 'duracao' } });
    registrarEfeitoContinuo('a', { nome: 'Assistência estável', origemId: 'u', acaoId: 'bom', multiplicador: 1, assistencia: { escopo: 'qualquer', dano: '2', consumo: 'duracao' } });
    await expect(dispararAssistenciaDano('i', { attackerId: 'a', isMelee: true, source: 'arma', ignoresRD: true })).resolves.toBe(2);
    expect(pegarFicha('i').hpCurrent).toBe(38);
  });
});
