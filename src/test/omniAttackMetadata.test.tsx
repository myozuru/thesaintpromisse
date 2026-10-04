import { novaEntidade } from '@/lib/omni/tipos';
import { parseOmniScript } from '@/lib/omni/omniScript';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { AcoesAtivasSection } from '@/components/fichas/AcoesAtivasSection';
import { clicarAlvoMapa } from '@/stores/useAlvoMapaStore';
import { selecionarAlvoNoMapaUI } from './helpers/alvoMapaUI';
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
// Só os dados físicos são determinísticos; painel, motor e stores são reais.
vi.mock('@/lib/dice', async (original) => ({
  ...await original<typeof import('@/lib/dice')>(),
  rollD20Com: vi.fn(async () => 20),
  rollDiceCom: vi.fn(async () => ({ rolls: [4], total: 4 })),
}));
import { act, render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useMapStore } from '@/stores/useMapStore';
import { rollD20Com } from '@/lib/dice';
import * as eventBus from '@/lib/omni/eventBus';
import * as triggers from '@/lib/omni/triggerEfeitos';
import { montarMetadadosDano } from '@/lib/omni/contextoDano';
import { avaliarFormula } from '@/lib/omni/parser';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha } from './helpers/mesaReal';

beforeEach(async () => {
  useInventoryStore.setState({ items: {}, deleted: {} });
  comoTela({ profileId: 'p-ana', role: 'PLAYER' });
  vi.mocked(rollD20Com).mockResolvedValue(20);
  for (const method of ['log', 'group', 'groupEnd'] as const) vi.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => { cleanup(); limparMesa(); vi.restoreAllMocks(); });

function mesa(weapon = 'Espada Longa', hidden = false) {
  const ana = ficha('ana', { profileId: 'p-ana', mainHandWeaponName: weapon, hpCurrent: 100, hpMax: 100, escCurrent: 0, escondidoDe: { combatId: 'combate-teste', ids: hidden ? ['bruno'] : [] } });
  montarMesa([ana, ficha('bruno', { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, escCurrent: 0, rd: 0 })], { ana: [0, 0], bruno: [1, 0] });
  useCombatStore.setState({ combatId: 'combate-teste' });
  return ana;
}
async function selecionarAlvo() {
  await selecionarAlvoNoMapaUI('bruno');
}

describe('Metadados conhecidos e ausentes', () => {
  it('não inventa flags nem alcance para dano sem contexto de ataque', async () => {
    const bag = montarMetadadosDano();
    expect(bag).toEqual({});
    expect(avaliarFormula('@DANO.foi_critico', {}, undefined, { dano: bag }).diagnosticos).toHaveLength(1);
  });
  it.each([
    [{ isMelee: true }, 1], [{ isMelee: false }, 2], [{ attack: { kind: 'cursed' as const }, isMelee: true }, 3],
  ])('preserva tipo de ataque explícito %j', (opts, expected) => {
    expect(montarMetadadosDano(opts).tipo_ataque).toBe(expected);
  });
  it('zero conhecido e distância zero não são campos ausentes', async () => {
    const bag = montarMetadadosDano({ attack: { critical: false, criticalFail: false, isSneak: false, isOpportunity: false } }, 0);
    expect(avaliarFormula('@DANO.foi_critico + @DANO.foi_furtivo + @DANO.foi_ataque_oportunidade + @DANO.alcance', {}, undefined, { dano: bag })).toMatchObject({ valor: 0, diagnosticos: [] });
  });
  it.each([null, undefined, NaN, Infinity, -1])('distância indisponível/inválida %s permanece ausente', (d) => {
    expect(montarMetadadosDano({}, d)).not.toHaveProperty('alcance');
  });
});

describe('Painel real → motor → dano → Omni', () => {
  it.each([
    ['Espada Longa', 20, true, true, 1, 1],
    ['Espada Longa', 15, false, false, 0, 1],
    ['Arco Curto', 20, false, false, 1, 2],
  ] as const)('%s d20 %i preserva crítico, ocultação e marcação de AdO', async (weapon, natural, hidden, opportunity, critical, kind) => {
    vi.mocked(rollD20Com).mockResolvedValue(natural);
    const ana = mesa(weapon, hidden);
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    const pre = vi.spyOn(triggers, 'dispararGatilhoEfeitosItens');
    render(<AttackPanel character={ana} />);
    await selecionarAlvo();
    if (opportunity) fireEvent.click(screen.getByRole('button', { name: 'Ataque de oportunidade' }));
    fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Rolar Dano/ })).toBeTruthy());
    if (hidden) expect(pegarFicha('ana').escondidoDe?.ids).not.toContain('bruno');
    fireEvent.click(screen.getByRole('button', { name: /Rolar Dano/ }));
    await waitFor(() => expect(spy.mock.calls.some(([e]) => e === 'aoCausarDano')).toBe(true));
    const ctx = spy.mock.calls.find(([e]) => e === 'aoCausarDano')![1]!.dano!;
    expect(ctx).toMatchObject({ foi_critico: critical, foi_falha_critica: 0, foi_furtivo: hidden ? 1 : 0, foi_ataque_oportunidade: opportunity ? 1 : 0, tipo_ataque: kind, alcance: 1.5, fonte: 1, tipo: weapon === 'Espada Longa' ? 1 : 2 });
    expect(ctx.valor_final).toBeGreaterThan(0);
    expect(pegarFicha('bruno').hpCurrent).toBe(100 - ctx.valor_final);
    const preCtx = pre.mock.calls.find(([e]) => e === 'aoSofrerDano')![1].dano!;
    expect(preCtx).toMatchObject({ foi_critico: critical, foi_furtivo: hidden ? 1 : 0 });
    expect(preCtx).not.toHaveProperty('valor_final');
    expect(avaliarFormula('@DANO.foi_critico + @DANO.tipo_ataque + @DANO.alcance', {}, undefined, { dano: { ...ctx } })).toMatchObject({ valor: critical + kind + 1.5, diagnosticos: [] });
  });

  it('marca AdO por tentativa, sem vazar para o próximo ataque', async () => {
    const ana = mesa();
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    render(<AttackPanel character={ana} />);
    await selecionarAlvo();
    fireEvent.click(screen.getByRole('button', { name: 'Ataque de oportunidade' }));
    for (let i = 1; i <= 2; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
      await waitFor(() => expect(screen.getByRole('button', { name: /Rolar Dano/ })).toBeTruthy());
      expect(screen.getByRole('button', { name: 'Ataque de oportunidade' }).getAttribute('aria-pressed')).toBe('false');
      fireEvent.click(screen.getByRole('button', { name: /Rolar Dano/ }));
      await waitFor(() => expect(spy.mock.calls.filter(([e]) => e === 'aoCausarDano')).toHaveLength(i));
    }
    expect(spy.mock.calls.filter(([e]) => e === 'aoCausarDano').map(([, opts]) => opts?.dano?.foi_ataque_oportunidade)).toEqual([1, 0]);
  });

  it('crítico automático é informado mesmo sem d20 natural crítico', async () => {
    vi.mocked(rollD20Com).mockResolvedValue(15);
    const ana = mesa();
    useCharacterStore.getState().updateCharacter('bruno', { activeConditions: [{ id: 'cond', conditionId: 'paralisado', name: 'Paralisado', icon: '', remainingTurns: -1, remainingRounds: -1 }] });
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    render(<AttackPanel character={ana} />);
    await selecionarAlvo();
    fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Rolar Dano/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Rolar Dano/ }));
    await waitFor(() => expect(spy.mock.calls.some(([e]) => e === 'aoCausarDano')).toBe(true));
    expect(spy.mock.calls.find(([e]) => e === 'aoCausarDano')![1]?.dano).toMatchObject({ foi_critico: 1, foi_furtivo: 0 });
  });

  it('falha crítica não cria evento de dano fictício', async () => {
    vi.mocked(rollD20Com).mockResolvedValue(1);
    const ana = mesa();
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    render(<AttackPanel character={ana} />);
    await selecionarAlvo();
    fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
    await waitFor(() => expect(screen.getAllByText(/Falha crítica/i).length).toBeGreaterThan(0));
    expect(spy.mock.calls.some(([e]) => e === 'aoCausarDano')).toBe(false);
    expect(pegarFicha('bruno').hpCurrent).toBe(100);
  });

  it('alcance é capturado antes do pre-hook e não muda após movimento posterior', async () => {
    mesa();
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    useCharacterStore.getState().applyDamage('bruno', 10, 'DCO', { attackerId: 'ana', isMelee: true, attack: { critical: true } });
    const map = useMapStore.getState();
    const alvo = Object.values(map.entities).find((e) => e.characterId === 'bruno')!;
    useMapStore.setState({ entities: { ...map.entities, [alvo.id]: { ...alvo, x: 700 } } });
    await waitFor(() => expect(spy.mock.calls.some(([e]) => e === 'aoCausarDano')).toBe(true));
    expect(spy.mock.calls.find(([e]) => e === 'aoCausarDano')![1]?.dano?.alcance).toBe(1.5);
  });
});


function equiparRancor() {
  const parsed = parseOmniScript('@acertar -> se @DANO.tipo_ataque == 1 entao subtrair (@USUARIO.contador rancor)d1 em @ALVO.vida tipo "Psíquico"');
  expect(parsed.erros).toEqual([]);
  const ent = { ...novaEntidade('arma'), nome: 'Espada Longa', tags: ['modelo:espada-longa'], combatData: { effects: [], critRange: 20, critMultiplier: 2, effectsPassive: parsed.efeitos } };
  useInventoryStore.getState().add('ana', ent);
  useCharacterStore.getState().updateCharacter('ana', { omniCounters: { rancor: 3 } });
  return ent;
}
it('botões reais de ataque e dano aplicam Rancor uma vez ao alvo', async () => {
  mesa(); equiparRancor();
  const spy = vi.spyOn(eventBus, 'emitirEvento');
  render(<AttackPanel character={pegarFicha('ana')} />);
  await selecionarAlvo();
  fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Rolar Dano/ })).toBeTruthy());
  expect(pegarFicha('bruno').hpCurrent).toBe(100);
  fireEvent.click(screen.getByRole('button', { name: /Rolar Dano/ }));
  await waitFor(() => expect(spy.mock.calls.filter(([e]) => e === 'aoAcertarAtaque')).toHaveLength(1));
  const hit = spy.mock.calls.find(([e]) => e === 'aoAcertarAtaque')![1]!;
  expect(hit.dano).toMatchObject({ tipo_ataque: 1 });
  const hp = pegarFicha('bruno').hpCurrent;
  await waitFor(() => expect(spy.mock.calls.some(([e, op]) => e === 'aoCausarDano' && op?.dano?.tipo === 12)).toBe(true));
  const danoArma = spy.mock.calls.find(([e, op]) => e === 'aoCausarDano' && op?.dano?.fonte === 1)![1]!.dano!.valor_final;
  expect(hp).toBe(100 - danoArma - 3);
  expect(pegarFicha('ana').omniCounters?.rancor).toBe(3);
});
it('Usar com Teste Ataque rola acerto e dispara Rancor; erro não aplica dano', async () => {
  mesa(); const ent = equiparRancor();
  ent.acoesAtivas = [{ id: 'golpe', nome: 'Golpe de Rancor', acao: 'livre', custoPE: '0', alcanceM: 3, teste: 'ataque', incluirArma: true, dano: '1', efeitos: [] }];
  const inst = Object.values(useInventoryStore.getState().items)[0];
  useInventoryStore.setState({ items: { [inst.instanceId]: { ...inst, entity: ent } } });
  const spy = vi.spyOn(eventBus, 'emitirEvento');
  render(<AcoesAtivasSection charId="ana" />);
  fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
  act(() => clicarAlvoMapa('e-bruno'));
  await waitFor(() => expect(spy.mock.calls.filter(([e]) => e === 'aoAcertarAtaque')).toHaveLength(1));
  expect(vi.mocked(rollD20Com)).toHaveBeenCalled();
  expect(pegarFicha('bruno').hpCurrent).toBeLessThan(97);
  await waitFor(() => expect((screen.getByRole('button', { name: 'Usar' }) as HTMLButtonElement).disabled).toBe(false));
  const hp = pegarFicha('bruno').hpCurrent;
  vi.mocked(rollD20Com).mockResolvedValue(1);
  fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
  act(() => clicarAlvoMapa('e-bruno'));
  await waitFor(() => expect(spy.mock.calls.filter(([e]) => e === 'aoErrarAtaque')).toHaveLength(1));
  expect(pegarFicha('bruno').hpCurrent).toBe(hp);
  expect(spy.mock.calls.filter(([e]) => e === 'aoAcertarAtaque')).toHaveLength(1);
});
