// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async (original) => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
import { novaEntidade, type AcaoLogica, type CombatEffect, type EntidadeOmni } from '@/lib/omni/tipos';
import { executarGatilho } from '@/lib/omni/executor';
import { dispararGatilhoEfeitosItens } from '@/lib/omni/triggerEfeitos';
import { reservarPassoOmni, executarNaCadeiaOmni, capturarCadeiaOmni, LIMITE_PASSOS_OMNI, LIMITE_PROFUNDIDADE_OMNI } from '@/lib/omni/cadeiaEventos';
import * as eventBus from '@/lib/omni/eventBus';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useReactionStore } from '@/stores/useReactionStore';
import { ReactionPromptOverlay } from '@/components/fichas/ReactionPromptOverlay';
import type { GatilhoId } from '@/lib/omni/constantesDoSistema';
import type { Character } from '@/types';
import { ficha, montarMesa, pegarFicha, limparMesa, esperar } from './helpers/mesaReal';

const char = (id: string, patch: Partial<Character> = {}) => ficha(id, { hpCurrent: 1000, hpMax: 1000, escCurrent: 0, rd: 0, ...patch });
const dano = (valor = 20, tipoDano?: string): AcaoLogica => ({ id: 'hit', acao: 'DANO', alvoAplicacao: 'ALVO', valor: { tipo: 'fixo', valor }, tipoDano });
function logica(id: string, evento: GatilhoId, acoes: AcaoLogica[]) {
  const ent = novaEntidade('passiva', id);
  ent.id = id;
  ent.gatilhos = [{ id: 'g', evento, blocos: [{ id: 'b', modo: 'todas', condicoes: [], acoes }] }];
  return ent;
}
function terminal(id: string, evento: string, quantidade = 1, target: CombatEffect['target'] = 'ALVO') {
  const ent = novaEntidade('passiva', id);
  ent.id = id;
  ent.combatData = { effects: [], critRange: 20, critMultiplier: 2, effectsPassive: Array.from({ length: quantidade }, (_, i) => ({ id: `hit-${i}`, type: 'SUBTRAIR', target, formula: '1', resourcePath: 'vida', damageType: 'Fogo', trigger: evento })) };
  return ent;
}
function vincular(ent: EntidadeOmni) {
  useOmniEntidadesStore.setState({ entidades: { ...useOmniEntidadesStore.getState().entidades, [ent.id]: ent } });
  return { id: `v-${ent.id}`, entidadeId: ent.id, categoria: 'passiva', instanceId: `i-${ent.id}`, vinculadoEm: 0 } as const;
}
beforeEach(() => {
  useOmniEntidadesStore.setState({ entidades: {} });
  useOmniRuntimeStore.setState({ efeitos: {} });
  useReactionStore.setState({ prompts: [], reactionsUsedByChar: {} });
  for (const method of ['log', 'group', 'groupEnd'] as const) vi.spyOn(console, method).mockImplementation(() => {});
});
afterEach(async () => { await esperar(); cleanup(); limparMesa(); });

describe('Origem e regras do novo dano Omni', () => {
  it('DANO lógico passa por RD geral/tipo e PVT antes dos eventos', async () => {
    montarMesa([char('autor'), char('alvo', { escCurrent: 5, rd: 3, rdByType: { DQ: 4 } as Character['rdByType'] })], {});
    const events = vi.spyOn(eventBus, 'emitirEvento');
    executarGatilho(logica('hit', 'aoUsarTalento', [dano(20, 'Fogo')]), 'aoUsarTalento', { usuario: pegarFicha('autor'), alvo: pegarFicha('alvo'), dano: { tipo: 1, fonte: 1, foi_critico: 1 } });
    expect(pegarFicha('alvo').escCurrent).toBe(0);
    expect(pegarFicha('alvo').hpCurrent).toBe(992);
    await waitFor(() => expect(events.mock.calls.some(([e]) => e === 'aoCausarDano')).toBe(true));
    const opts = events.mock.calls.find(([e]) => e === 'aoCausarDano')![1]!;
    expect(opts).toMatchObject({ usuarioId: 'autor', alvoId: 'alvo' });
    expect(opts.dano).toMatchObject({ tipo: 7, fonte: 3, valor_inicial: 20, valor_final: 13, absorvido: 7, id_origem: 1 });
    expect(opts.dano).not.toHaveProperty('foi_critico');
  });
  it.each([
    ['imunidade', { immunities: ['DQ'] }, 'Fogo', 1000],
    ['vulnerabilidade', { vulnerabilities: ['DQ'] }, 'Fogo', 970],
    ['sem tipo declarado', { rd: 3 }, undefined, 983],
    ['sem equivalência', { rd: 3, immunities: ['DQ'] }, 'Verdadeiro', 983],
  ] as const)('%s usa as regras do motor sem inventar tipo', async (_nome, patch, tipo, hp) => {
    montarMesa([char('autor'), char('alvo', patch as Partial<Character>)], {});
    const events = vi.spyOn(eventBus, 'emitirEvento');
    executarGatilho(logica('hit', 'aoUsarTalento', [dano(20, tipo)]), 'aoUsarTalento', { usuario: pegarFicha('autor'), alvo: pegarFicha('alvo') });
    expect(pegarFicha('alvo').hpCurrent).toBe(hp);
    await waitFor(() => expect(events.mock.calls.some(([e]) => e === 'aoCausarDano')).toBe(true));
    if (!tipo || tipo === 'Verdadeiro') expect(events.mock.calls.find(([e]) => e === 'aoCausarDano')![1]?.dano).not.toHaveProperty('tipo');
  });
  it('bloqueio é consumido uma vez e a segunda ação usa a ficha atual', () => {
    montarMesa([char('autor'), char('alvo', { omniFlags: { bloqueio_total: 1 } })], {});
    executarGatilho(logica('hit', 'aoUsarTalento', [dano(20), { ...dano(20), id: 'hit2' }]), 'aoUsarTalento', { usuario: pegarFicha('autor'), alvo: pegarFicha('alvo') });
    expect(pegarFicha('alvo').hpCurrent).toBe(980);
    expect(pegarFicha('alvo').omniFlags?.bloqueio_total).toBe(0);
  });
  it('retaliação pertence ao portador e não ao atacante recebido', async () => {
    montarMesa([char('atacante'), char('defensor', { omniAtivos: [vincular(terminal('retaliar', 'aoSofrerDano'))] })], {});
    const events = vi.spyOn(eventBus, 'emitirEvento');
    useCharacterStore.getState().applyDamage('defensor', 10, 'DI', { attackerId: 'atacante', source: 'arma' });
    await waitFor(() => expect(events.mock.calls.some(([e, o]) => e === 'aoCausarDano' && o?.usuarioId === 'defensor')).toBe(true));
    const opts = events.mock.calls.find(([e, o]) => e === 'aoCausarDano' && o?.usuarioId === 'defensor')![1]!;
    expect(opts).toMatchObject({ alvoId: 'atacante', dano: { fonte: 3, tipo: 7, valor_final: 1 } });
    expect(pegarFicha('atacante').hpCurrent).toBe(999);
    expect(pegarFicha('defensor').hpCurrent).toBe(990);
  });
  it('autoaplicação identifica o próprio portador como origem', async () => {
    montarMesa([char('autor', { omniAtivos: [vincular(terminal('custo', 'aoUsarTalento', 1, 'USUARIO'))] })], {});
    const events = vi.spyOn(eventBus, 'emitirEvento');
    dispararGatilhoEfeitosItens('aoUsarTalento', { usuarioId: 'autor' });
    await waitFor(() => expect(events.mock.calls.some(([e]) => e === 'aoCausarDano')).toBe(true));
    expect(events.mock.calls.find(([e]) => e === 'aoCausarDano')![1]).toMatchObject({ usuarioId: 'autor', alvoId: 'autor', dano: { id_origem: 1 } });
  });
});

describe('Limites permanecem válidos através de callbacks assíncronos', () => {
  it.each(['logico', 'terminal', 'pre-hook'] as const)('interrompe ciclo de dano %s e libera a próxima ação independente', async modo => {
    const ent = modo === 'logico' ? logica('loop', 'aoCausarDano', [dano(1)]) : terminal('loop', modo === 'pre-hook' ? 'aoSofrerDano' : 'aoCausarDano');
    const vinculo = vincular(ent);
    montarMesa([char('autor', { omniAtivos: [vinculo] }), char('alvo', { omniAtivos: modo === 'pre-hook' ? [vinculo] : [] })], {});
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useCharacterStore.getState().applyDamage('alvo', 1, 'DI', { attackerId: 'autor' });
    await waitFor(() => expect(warning).toHaveBeenCalledWith(expect.stringContaining('Cadeia interrompida')));
    await esperar(10);
    const snapshot = useCharacterStore.getState().characters.map(c => c.hpCurrent);
    await esperar(10);
    expect(useCharacterStore.getState().characters.map(c => c.hpCurrent)).toEqual(snapshot);
    expect(2000 - snapshot.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(LIMITE_PROFUNDIDADE_OMNI);
    useOmniEntidadesStore.setState({ entidades: {} });
    const hp = pegarFicha('alvo').hpCurrent;
    useCharacterStore.getState().applyDamage('alvo', 3, 'DI', { attackerId: 'autor' });
    expect(pegarFicha('alvo').hpCurrent).toBe(hp - 3);
  });
  it('ramificações compartilham orçamento em vez de reiniciar o limite', async () => {
    montarMesa([char('autor', { omniAtivos: [vincular(terminal('ramificar', 'aoCausarDano', 4))] }), char('alvo')], {});
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useCharacterStore.getState().applyDamage('alvo', 1, 'DI', { attackerId: 'autor' });
    await waitFor(() => expect(warning).toHaveBeenCalled());
    await esperar(20);
    const hp = pegarFicha('alvo').hpCurrent;
    expect(1000 - hp).toBeGreaterThan(LIMITE_PROFUNDIDADE_OMNI);
    expect(1000 - hp).toBeLessThanOrEqual(LIMITE_PASSOS_OMNI);
    await esperar(10);
    expect(pegarFicha('alvo').hpCurrent).toBe(hp);
  });
  it('observadores preservam o limite quando seu efeito produz outro dano', async () => {
    const obs = logica('observar', 'aoAliadoSofrerDano', [dano(1)]);
    montarMesa([char('autor'), char('alvo'), char('obs1', { omniAtivos: [vincular(obs)] }), char('obs2', { omniAtivos: [vincular(obs)] })], {});
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useCharacterStore.getState().applyDamage('alvo', 1, 'DI', { attackerId: 'autor' });
    await waitFor(() => expect(warning).toHaveBeenCalled());
    await esperar(20);
    const hp = pegarFicha('alvo').hpCurrent;
    await esperar(10);
    expect(pegarFicha('alvo').hpCurrent).toBe(hp);
    expect(1000 - hp).toBeLessThanOrEqual(LIMITE_PROFUNDIDADE_OMNI);
  });
  it('atualização de contador não reinicia profundidade depois do import', async () => {
    const ent = logica('contador', 'aoAtualizarContador', [{ id: 'count', acao: 'INCREMENTAR_CONTADOR', alvoAplicacao: 'USUARIO', caminhoAlvo: 'loop' }]);
    montarMesa([char('autor', { omniAtivos: [vincular(ent)] })], {});
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    eventBus.emitirEvento('aoAtualizarContador', { usuarioId: 'autor' });
    await waitFor(() => expect(warning).toHaveBeenCalled());
    await esperar(10);
    expect(pegarFicha('autor').omniCounters?.loop).toBe(LIMITE_PROFUNDIDADE_OMNI);
    eventBus.emitirEvento('aoAtualizarContador', { usuarioId: 'autor' });
    await waitFor(() => expect(pegarFicha('autor').omniCounters?.loop).toBe(2 * LIMITE_PROFUNDIDADE_OMNI));
  });
  it('o prompt de Alma Maldita mantém o orçamento pendente até o clique', async () => {
    montarMesa([char('autor'), char('alvo', { origin: 'Feto Amaldiçoada Híbrido (FAH)', almaMalditaUses: 1, almaMalditaMax: 1 })], {});
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cadeia = reservarPassoOmni()!;
    render(<ReactionPromptOverlay />);
    useCharacterStore.getState().applyDamage('alvo', 10, 'DAL', { attackerId: 'autor', cadeia });
    await screen.findByRole('button', { name: 'Aceitar dano' });
    cadeia.orcamento.restantes = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar dano' }));
    expect(pegarFicha('alvo').hpCurrent).toBe(1000);
    await waitFor(() => expect(warning).toHaveBeenCalled());
    expect(useReactionStore.getState().prompts).toHaveLength(0);
  });
  it('restaura escopo mesmo com erro e não mistura ações independentes', () => {
    const cadeia = reservarPassoOmni()!;
    expect(() => executarNaCadeiaOmni(cadeia, () => { throw new Error('teste'); })).toThrow('teste');
    expect(capturarCadeiaOmni()).toBeUndefined();
    cadeia.orcamento.restantes = 0;
    const nova = reservarPassoOmni()!;
    expect(nova.profundidade).toBe(1);
    expect(nova.orcamento.restantes).toBe(LIMITE_PASSOS_OMNI - 1);
  });
});
