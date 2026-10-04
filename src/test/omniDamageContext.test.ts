// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { requestReactionDecision, useReactionStore } from '@/stores/useReactionStore';
import { parseOmniScript } from '@/lib/omni/omniScript';
import { novaEntidade } from '@/lib/omni/tipos';
import type { EntidadeOmni } from '@/lib/omni/tipos';
import type { Character } from '@/types';
import * as eventBus from '@/lib/omni/eventBus';
import * as triggers from '@/lib/omni/triggerEfeitos';
import { calcularContador } from '@/lib/omni/contadores';
import { avaliarFormula } from '@/lib/omni/parser';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, capturarEnvios } from './helpers/mesaReal';

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
  useInventoryStore.setState({ items: {} });
  for (const method of ['log', 'group', 'groupEnd'] as const) vi.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => { limparMesa(); vi.restoreAllMocks(); });

describe('Cobrir-se antes da aplicação do dano', () => {
  beforeEach(() => useReactionStore.setState({ prompts: [], reactionsUsedByChar: {} }));

  it('encaminha uma reação ao perfil dono da ficha e devolve a escolha à tela de origem', () => {
    const enviados = capturarEnvios('reaction-prompt');
    const anterior = (window as unknown as { __worldBus?: unknown }).__worldBus;
    (window as unknown as { __worldBus?: unknown }).__worldBus = { send: vi.fn() };
    montarMesa([char('alvo', { profileId: 'perfil-alvo' })], {});
    comoTela({ profileId: null, role: 'MASTER' });
    useReactionStore.getState().enqueue({ charId: 'alvo', charName: 'alvo', kind: 'cobrir_se_offer', message: 'Teste' });
    expect(useReactionStore.getState().prompts).toHaveLength(0);
    expect(enviados.enviados[0]).toMatchObject({ tipo: 'prompt', destinatario: 'perfil-alvo' });

    const prompt = enviados.enviados[0].prompt as import('@/stores/useReactionStore').ReactionPrompt;
    comoTela({ profileId: 'perfil-alvo', role: 'PLAYER' });
    useReactionStore.getState().receiveRemote(prompt, 'cliente-mestre');
    useReactionStore.getState().resolveDecision(prompt.id, 2);
    expect(enviados.enviados[1]).toMatchObject({ tipo: 'resposta', clienteOrigem: 'cliente-mestre', answer: 2 });

    enviados.parar();
    (window as unknown as { __worldBus?: unknown }).__worldBus = anterior;
  });

  it('pausa o dano até a decisão e aplica os PVTs antes do golpe', async () => {
    montarMesa([char('alvo', {
      hpCurrent: 100, escCurrent: 0, peCurrent: 3,
      cursedAptitudes: { CL: 1 } as never,
      chosenClAptitudes: ['cl-cobrir-se'],
    })], {});

    const damage = useCharacterStore.getState().applyDamage('alvo', 10, 'DCO');
    await waitFor(() => expect(useReactionStore.getState().prompts.some((p) => p.kind === 'cobrir_se_offer')).toBe(true));
    expect(pegarFicha('alvo')).toMatchObject({ hpCurrent: 100, escCurrent: 0, peCurrent: 3 });

    const prompt = useReactionStore.getState().prompts.find((p) => p.kind === 'cobrir_se_offer')!;
    useReactionStore.getState().resolveDecision(prompt.id, 2);
    await damage;

    expect(pegarFicha('alvo')).toMatchObject({ hpCurrent: 98, escCurrent: 0, peCurrent: 1 });
    expect(useReactionStore.getState().reactionsUsedByChar.alvo).toBe(1);
  });

  it('aplica o dano normal quando o jogador recusa', async () => {
    montarMesa([char('alvo', {
      hpCurrent: 100, escCurrent: 0, peCurrent: 3,
      cursedAptitudes: { CL: 1 } as never,
      chosenClAptitudes: ['cl-cobrir-se'],
    })], {});

    const damage = useCharacterStore.getState().applyDamage('alvo', 10, 'DCO');
    await waitFor(() => expect(useReactionStore.getState().prompts.some((p) => p.kind === 'cobrir_se_offer')).toBe(true));
    const prompt = useReactionStore.getState().prompts.find((p) => p.kind === 'cobrir_se_offer')!;
    useReactionStore.getState().resolveDecision(prompt.id, null);
    await damage;

    expect(pegarFicha('alvo')).toMatchObject({ hpCurrent: 90, escCurrent: 0, peCurrent: 3 });
    expect(useReactionStore.getState().reactionsUsedByChar.alvo ?? 0).toBe(0);
  });

  it('encerra a espera no prazo e segue sem a reação quando não há resposta', async () => {
    vi.useFakeTimers();
    try {
      montarMesa([char('alvo')], {});
      const pending = requestReactionDecision({
        charId: 'alvo', charName: 'alvo', kind: 'cobrir_se_offer', message: 'Decisão pendente',
      }, 250);
      expect(useReactionStore.getState().prompts).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(250);
      await expect(pending).resolves.toBeNull();
      expect(useReactionStore.getState().prompts).toHaveLength(0);
    } finally { vi.useRealTimers(); }
  });
});

describe('Contexto DANO do combate real', () => {
  it.each([
    ['resistência', { resistencias: ['DCO'] as const }, {}, 10],
    ['vulnerabilidade', { vulnerabilidades: ['DCO'] as const }, {}, 30],
    ['imunidade', { imunidades_dano: ['DCO'] as const }, {}, 0],
    ['resistência e vulnerabilidade cancelam', { resistencias: ['DCO'] as const, vulnerabilidades: ['DCO'] as const }, {}, 20],
    ['ignorar resistência', { resistencias: ['DCO'] as const }, { ignoresResistance: true }, 20],
  ] as const)('%s de acessório equipado aplica o resultado ao dano', async (_nome, mitigacao, opts, danoFinal) => {
    montarMesa([char('alvo')], {});
    const item = { ...novaEntidade('item', 'Broche'), slotType: 'anel' as const, ...mitigacao } as unknown as EntidadeOmni;
    const instancia = useInventoryStore.getState().add('alvo', item);
    expect(useInventoryStore.getState().equipItem(instancia.instanceId, 'anel:0')).toBe(true);
    useCharacterStore.getState().applyDamage('alvo', 20, 'DCO', opts);
    await waitFor(() => expect(pegarFicha('alvo').hpCurrent).toBe(100 - danoFinal));
  });

  it('não aplica as propriedades de um acessório guardado no inventário', async () => {
    montarMesa([char('alvo')], {});
    useInventoryStore.getState().add('alvo', { ...novaEntidade('item', 'Broche'), slotType: 'anel', resistencias: ['DCO'] });
    useCharacterStore.getState().applyDamage('alvo', 20, 'DCO');
    await waitFor(() => expect(pegarFicha('alvo').hpCurrent).toBe(80));
  });
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
