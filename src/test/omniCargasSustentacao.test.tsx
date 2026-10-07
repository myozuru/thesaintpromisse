// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async (original) => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
import { ficha, montarMesa, pegarFicha, limparMesa, comoTela, esperar } from './helpers/mesaReal';
import { executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { encerrarSustentacaoAtiva, inicioTurnoSustentacoesAtivas, verificarDistanciaSustentacoes } from '@/lib/omni/custosAtivos';
import type { AcaoAtivaConfig } from '@/lib/omni/tipos';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useMapStore } from '@/stores/useMapStore';
import { useLogStore } from '@/stores/useLogStore';

const invocar: AcaoAtivaConfig = {
  id: 'inv', nome: 'Invocar Espíritos', acao: 'bonus', custoPE: '3', alcanceM: 0, teste: 'nenhum', tipo_alvo: 'proprio', tipo_efeito: 'buff',
  custo_recursos: { pe_base: '3', tipo_acao: 'sustentada', pe_por_turno: '1', alcance_sustentacao_m: 20, gerar_cargas: { nome: 'espiritos_fogo', quantidade: '2' } },
};
const enviar: AcaoAtivaConfig = {
  id: 'env', nome: 'Enviar Espírito', acao: 'livre', custoPE: '0', alcanceM: 9, teste: 'nenhum', tipo_efeito: 'buff', filtro_alvo: 'todos_exceto_si',
  efeitos: [{ tipo: 'condicao', condicao: 'caido', rodadas: 0 }],
  custo_recursos: { pe_base: '0', gastar_cargas: { nome: 'espiritos_fogo', quantidade: '1' } },
};
const mesa = () => montarMesa([ficha('u', { bonusActionsCurrent: 1, actionsCurrent: 1 }), ficha('b', { hpCurrent: 30, hpMax: 30 })], { u: [0, 0], b: [2, 0] });
const mover = (id: string, casas: number) => useMapStore.setState(s => ({ entities: { ...s.entities, [`e-${id}`]: { ...s.entities[`e-${id}`], x: casas * 70 } } }) as never);

beforeEach(() => { comoTela({ profileId: null, role: 'MASTER' }); useInventoryStore.setState({ items: {} }); useMapStore.setState({ walls: [] }); useCombatStore.setState({ inCombat: false }); useLogStore.getState().clearLogs(); mesa(); });
afterEach(async () => { await esperar(); limparMesa(); });

describe('cargas geradas por sustentação', () => {
  it('invocar gera 2 cargas e cria a sustentação vinculada ao contador', async () => {
    const r = await executarAcaoAtiva('u', invocar, 'u');
    expect(r.ok).toBe(true);
    expect(pegarFicha('u').omniCounters?.espiritos_fogo).toBe(2);
    expect(pegarFicha('u').peCurrent).toBe(17);
    expect(pegarFicha('u').omniSustentacoes?.[0]).toMatchObject({ contador: 'espiritos_fogo', alcanceM: 20, pePorTurno: 1 });
  });
  it('só dá para enviar 2 espíritos; o terceiro é recusado', async () => {
    await executarAcaoAtiva('u', invocar, 'u');
    expect((await executarAcaoAtiva('u', enviar, 'b')).ok).toBe(true);
    expect((await executarAcaoAtiva('u', enviar, 'b')).ok).toBe(true);
    expect(pegarFicha('u').omniCounters?.espiritos_fogo ?? 0).toBe(0);
    expect((await executarAcaoAtiva('u', enviar, 'b')).ok).toBe(false);
  });
  it('efeito enviado fica preso à sustentação e some ao encerrá-la', async () => {
    await executarAcaoAtiva('u', invocar, 'u');
    const env = await executarAcaoAtiva('u', enviar, 'b');
    expect(pegarFicha('b').activeConditions.some(c => c.conditionId === 'caido')).toBe(true);
    const s = pegarFicha('u').omniSustentacoes![0];
    expect(s.alvos).toContain('b');
    encerrarSustentacaoAtiva('u', s.id);
    expect(pegarFicha('b').activeConditions.some(c => c.conditionId === 'caido')).toBe(false);
    expect(pegarFicha('u').omniCounters?.espiritos_fogo ?? 0).toBe(0);
  });
  it('alvo a mais de 20 m perde o espírito; a 19,5 m mantém', async () => {
    await executarAcaoAtiva('u', invocar, 'u');
    await executarAcaoAtiva('u', enviar, 'b');
    mover('b', 13); // 19,5 m
    expect(verificarDistanciaSustentacoes()).toBe(0);
    expect(pegarFicha('b').activeConditions.some(c => c.conditionId === 'caido')).toBe(true);
    mover('b', 15); // 22,5 m
    expect(verificarDistanciaSustentacoes()).toBe(1);
    expect(pegarFicha('b').activeConditions.some(c => c.conditionId === 'caido')).toBe(false);
    // Ainda resta 1 espírito com o conjurador: a sustentação continua.
    expect(pegarFicha('u').omniSustentacoes).toHaveLength(1);
  });
  it('sem espíritos restantes, afastar o último alvo encerra tudo', async () => {
    await executarAcaoAtiva('u', invocar, 'u');
    await executarAcaoAtiva('u', enviar, 'b');
    await executarAcaoAtiva('u', enviar, 'b');
    mover('b', 15);
    verificarDistanciaSustentacoes();
    expect(pegarFicha('u').omniSustentacoes ?? []).toEqual([]);
  });
  it('manutenção cobra 1 PE por turno enquanto houver cargas', async () => {
    await executarAcaoAtiva('u', invocar, 'u');
    inicioTurnoSustentacoesAtivas('u');
    expect(pegarFicha('u').peCurrent).toBe(16);
    expect(pegarFicha('u').omniSustentacoes).toHaveLength(1);
  });
});