// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
import { ficha, montarMesa, pegarFicha, limparMesa } from './helpers/mesaReal';
import { aplicarEfeitoNoPersonagem } from '@/lib/omni/aplicarEfeito';
import { parseOmniScript } from '@/lib/omni/omniScript';
import { destinoComposto } from '@/lib/omni/componentes/escrita';
import { executarCombatEffect } from '@/lib/omni/executarSubEfeito';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
afterEach(limparMesa);
describe('destinos compostos graváveis', () => {
  it('consome e repõe dados de vida com teto', () => {
    montarMesa([ficha('write', { hitDiceCurrent: 2, hitDiceMax: 3 })], {});
    aplicarEfeitoNoPersonagem('write', 'ADICIONAR', 'curto', 10);
    expect(pegarFicha('write').hitDiceCurrent).toBe(3);
    aplicarEfeitoNoPersonagem('write', 'SUBTRAIR', 'dado_vida restante', 1);
    // O próprio recurso pode ser usado sem qualificador; `restante` também é um destino válido.
    expect(pegarFicha('write').hitDiceCurrent).toBe(2);
  });
  it('mantém o saldo total ao consumir somente uma fonte do contador', () => {
    montarMesa([ficha('write', { omniCounters: { brasas: 7, 'brasas__fonte__ALVO-01': 3, 'brasas__fonte__alvo-02': 4 } })], {});
    aplicarEfeitoNoPersonagem('write', 'SUBTRAIR', 'contador brasas fonte ALVO-01', 2);
    expect(pegarFicha('write').omniCounters).toMatchObject({ brasas: 5, 'brasas__fonte__ALVO-01': 1, 'brasas__fonte__alvo-02': 4 });
  });
  it('não concede escrita a filtros ou consultas percentuais', () => {
    expect(destinoComposto('percentual vida')).toBeUndefined();
    expect(destinoComposto('quantidade buffs ativos')).toBeUndefined();
    expect(parseOmniScript('somar 2 em quantidade buffs ativos').erros).toHaveLength(1);
    expect(parseOmniScript('somar 2 em vida temporaria').erros).toEqual([]);
  });
  it('transfere o valor calculado uma vez e conserva a reserva excedente', () => {
    const c = ficha('write', { economiaPEReserve: 8, peCurrent: 4, peMax: 10, attributes: [], skills: [], savingThrows: [] });
    montarMesa([c], {});
    const script = parseOmniScript('transferir reserva pe recuperavel de reserva pe para pe', { defaultTarget: 'USUARIO' });
    expect(script.erros).toEqual([]);
    const r = executarCombatEffect(script.efeitos[0], { usuarioId: c.id, usuarioVars: montarVariaveisDoPersonagem(c) });
    expect(r.aplicado).toBe(6);
    expect(pegarFicha('write')).toMatchObject({ economiaPEReserve: 2, peCurrent: 10 });
  });
});
