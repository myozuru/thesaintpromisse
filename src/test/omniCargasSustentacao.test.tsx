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
import { useCharacterStore } from '@/stores/useCharacterStore';
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
  it('recusa uma key inválida na quantidade antes de cobrar PE ou abrir sustentação', async () => {
    const config: AcaoAtivaConfig = {
      ...invocar,
      custo_recursos: {
        ...invocar.custo_recursos,
        gerar_cargas: { nome: 'espiritos_fogo', quantidade: '@USUARIO.chave_inexistente + 2' },
      },
    };
    const peAntes = pegarFicha('u').peCurrent;
    const resultado = await executarAcaoAtiva('u', config, 'u');
    expect(resultado).toMatchObject({ ok: false });
    if (!resultado.ok) expect(resultado.reason).toMatch(/quantidade de cargas inválida/i);
    expect(pegarFicha('u').peCurrent).toBe(peAntes);
    expect(pegarFicha('u').omniCounters?.espiritos_fogo).toBeUndefined();
    expect(pegarFicha('u').omniSustentacoes ?? []).toEqual([]);
  });

  it('invocar gera 2 cargas e cria a sustentação vinculada ao contador', async () => {
    const r = await executarAcaoAtiva('u', invocar, 'u');
    expect(r.ok).toBe(true);
    expect(pegarFicha('u').omniCounters?.espiritos_fogo).toBe(2);
    expect(pegarFicha('u').peCurrent).toBe(17);
    expect(pegarFicha('u').omniSustentacoes?.[0]).toMatchObject({ contador: 'espiritos_fogo', alcanceM: 20, pePorTurno: 1 });
  });
  it('seleção de uma carga preserva a outra e mantém a sustentação', async () => {
    await executarAcaoAtiva('u', invocar, 'u');
    const r = await executarAcaoAtiva('u', enviar, 'b', undefined, { cargasSelecionadas: 1 });
    expect(r.ok).toBe(true);
    expect(pegarFicha('u').omniCounters?.espiritos_fogo).toBe(1);
    expect(pegarFicha('u').omniSustentacoes).toHaveLength(1);
  });
  it('seleção de duas cargas consome apenas as duas disponíveis', async () => {
    await executarAcaoAtiva('u', invocar, 'u');
    expect((await executarAcaoAtiva('u', enviar, 'b', undefined, { cargasSelecionadas: 2 })).ok).toBe(true);
    expect(pegarFicha('u').omniCounters?.espiritos_fogo ?? 0).toBe(0);
  });
  it('recusa selecionar mais cargas do que o personagem possui', async () => {
    await executarAcaoAtiva('u', invocar, 'u');
    const r = await executarAcaoAtiva('u', enviar, 'b', undefined, { cargasSelecionadas: 3 });
    expect(r.ok).toBe(false);
    expect(pegarFicha('u').omniCounters?.espiritos_fogo).toBe(2);
  });
  it('escala dano e cura juntos pelas cargas selecionadas', async () => {
    await executarAcaoAtiva('u', invocar, 'u');
    useCharacterStore.getState().updateCharacter('b', { hpCurrent: 10 });
    const misto: AcaoAtivaConfig = {
      id: 'misto', nome: 'Espírito Curativo e Ardente', acao: 'livre', custoPE: '0',
      alcanceM: 9, teste: 'nenhum', filtro_alvo: 'todos_exceto_si',
      tipo_efeito: 'dano', dano: '2', cura: '3',
      custo_recursos: { gastar_cargas: { nome: 'espiritos_fogo', quantidade: '1' } },
    };
    const r = await executarAcaoAtiva('u', misto, 'b', undefined, { cargasSelecionadas: 2 });
    expect(r.ok).toBe(true);
    expect(pegarFicha('u').omniCounters?.espiritos_fogo ?? 0).toBe(0);
    expect(pegarFicha('b').hpCurrent).toBe(12);
    if (r.ok) { expect(r.cura).toBe(6); expect(r.dano).toBe(4); }
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

describe('espírito de fogo contínuo no aliado', () => {
  const enviarAliado: AcaoAtivaConfig = {
    id: 'env-al', nome: 'Espírito no Aliado', acao: 'livre', custoPE: '0', alcanceM: 9, teste: 'nenhum', tipo_efeito: 'cura', filtro_alvo: 'aliados',
    cura: '2', continuo: { cadencia: 'inicio_turno' },
    assistencia_dano: { escopo: 'corpo_a_corpo', dano: '1d4', tipoDano: 'DQ', consumo: 'proximo_acerto' },
    custo_recursos: { pe_base: '0', gastar_cargas: { nome: 'espiritos_fogo', quantidade: '1' } },
  };
  it('os dois espíritos ficam no aliado, mantêm a sustentação e somem quando ela acaba', async () => {
    const { tickEfeitosContinuosInicioTurno } = await import('@/lib/omni/efeitosContinuos');
    useCharacterStore.getState().updateCharacter('b', { hpCurrent: 10 });
    await executarAcaoAtiva('u', invocar, 'u');
    const r1 = await executarAcaoAtiva('u', enviarAliado, 'b');
    expect((r1 as { reason?: string }).reason).toBeUndefined();
    await executarAcaoAtiva('u', enviarAliado, 'b');
    expect(pegarFicha('u').omniCounters?.espiritos_fogo ?? 0).toBe(0);
    expect(pegarFicha('b').omniEfeitosContinuos?.[0]).toMatchObject({ multiplicador: 2 });
    // Sem cargas, a sustentação continua porque os espíritos estão no aliado.
    inicioTurnoSustentacoesAtivas('u');
    const sust = pegarFicha('u').omniSustentacoes ?? [];
    expect(sust).toHaveLength(1);
    expect(pegarFicha('u').peCurrent).toBe(16);
    await tickEfeitosContinuosInicioTurno('b');
    expect(pegarFicha('b').hpCurrent).toBe(14);
    encerrarSustentacaoAtiva('u', sust[0].id);
    expect(pegarFicha('b').omniEfeitosContinuos ?? []).toHaveLength(0);
    await tickEfeitosContinuosInicioTurno('b');
    expect(pegarFicha('b').hpCurrent).toBe(14);
  });
});
