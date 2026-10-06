// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
const dados = vi.hoisted(() => ({ roll: vi.fn(async (_id: string, notation: string) => { const m = notation.match(/(\d+)d(\d+)/)!; const rolls = Array(Number(m[1])).fill(2); return { rolls, total: rolls.length * 2 }; }) }));
vi.mock('@/lib/dice', async original => ({ ...await original<typeof import('@/lib/dice')>(), rollD20Com: vi.fn(async () => 20), rollDiceCom: dados.roll, rollDiceGroups: vi.fn(async (groups: {count: number; sides: number}[]) => { const out = await Promise.all(groups.map(async g => ({ ...g, ...await dados.roll('u', `${g.count}d${g.sides}`) }))); return { groups: out, rolls: out.flatMap(g => g.rolls), total: out.reduce((n,g) => n+g.total,0) }; }) }));
import { act, render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { AcoesAtivasSection } from '@/components/fichas/AcoesAtivasSection';
import { selecionarAlvoNoMapaUI } from './helpers/alvoMapaUI';
import { clicarAlvoMapa, terminarAlvoMapa } from '@/stores/useAlvoMapaStore';
import { ficha, montarMesa, pegarFicha, limparMesa, comoTela } from './helpers/mesaReal';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { novaEntidade, type AcaoAtivaConfig } from '@/lib/omni/tipos';
import { applyWeaponModel, setWeaponDamage, getWeaponMeta } from '@/lib/omni/weaponModel';
import { findWeaponByName } from '@/lib/weapons';
import { rollD20Com, rollDiceCom } from '@/lib/dice';
import * as eventBus from '@/lib/omni/eventBus';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { createEmptyRdByType } from '@/types';

beforeEach(() => {
  comoTela({ profileId: 'p', role: 'PLAYER' });
  useInventoryStore.setState({ items: {}, deleted: {} }); useOmniEntidadesStore.setState({ entidades: {} });
  montarMesa([ficha('u', { profileId: 'p', hpCurrent: 100, hpMax: 100, attributes: [{ id: 'for', name: 'FOR', value: 10 }], peCurrent: 20, peMax: 20 }), ficha('a', { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, escCurrent: 0, rd: 0, ca: 10 })], { u: [0, 0], a: [1, 0] });
  vi.mocked(rollD20Com).mockClear();
  vi.mocked(rollD20Com).mockResolvedValue(20);
  vi.mocked(rollDiceCom).mockClear();
});
afterEach(() => { cleanup(); terminarAlvoMapa(null); limparMesa(); });
function arma(formula = '2d6+3', tipo = 'Psíquico', mult = 3) {
  const ent = setWeaponDamage(applyWeaponModel(novaEntidade('arma'), findWeaponByName('Espada Longa')!), formula);
  ent.nome = 'Lâmina do Eco'; ent.combatData!.critMultiplier = mult;
  for (const e of [ent.combatData!.effects, ent.combatData!.effectsActive!]) e[0].damageType = tipo;
  useInventoryStore.getState().add('u', ent);
  useCharacterStore.getState().equipWeapons('u', { mainHandName: ent.nome });
  return ent;
}
async function ataque() {
  render(<AttackPanel character={pegarFicha('u')} />);
  await selecionarAlvoNoMapaUI('a');
  fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Rolar Dano/ })).toBeTruthy());
  expect(pegarFicha('a').hpCurrent).toBe(100);
  fireEvent.click(screen.getByRole('button', { name: /Rolar Dano/ }));
}
it('ataque comum usa dados personalizados, fixo uma vez e crítico x3', async () => {
  arma(); const events = vi.spyOn(eventBus, 'emitirEvento');
  await ataque();
  await waitFor(() => expect(pegarFicha('a').hpCurrent).toBe(85));
  expect(vi.mocked(rollDiceCom).mock.calls.map(c => c[1])).toEqual(['6d6']);
  const ctx = events.mock.calls.find(([e]) => e === 'aoCausarDano')![1]!.dano;
  expect(ctx).toMatchObject({ tipo: 12, foi_critico: 1, valor_final: 15 });
});
it('tipo da arma OMNI respeita RD do tipo aplicado', async () => {
  arma('2d6', 'Fogo', 2); vi.mocked(rollD20Com).mockResolvedValue(15);
  useCharacterStore.getState().updateCharacter('a', { rdByType: { ...createEmptyRdByType(), DCO: 30, DQ: 1 } });
  await ataque(); await waitFor(() => expect(pegarFicha('a').hpCurrent).toBe(97));
});
it('ação ativa mitiga arma e dano adicional pelo tipo próprio em uma ocorrência', async () => {
  useCharacterStore.getState().updateCharacter('a', { rdByType: { ...createEmptyRdByType(), DCO: 30, DQ: 1 } });
  const events = vi.spyOn(eventBus, 'emitirEvento');
  await ativa({ incluirArma: true, dano: '1d8', tipoDano: 'DQ' }, 'Cortante');
  await waitFor(() => expect(pegarFicha('a').hpCurrent).toBe(95));
  await waitFor(() => expect(events.mock.calls.some(([nome]) => nome === 'aoCausarDano')).toBe(true));
  const dano = events.mock.calls.find(([nome]) => nome === 'aoCausarDano')![1]!.dano!;
  expect(dano).toMatchObject({ valor_final: 5, vida_perdida: 5 });
  expect(dano).not.toHaveProperty('tipo');
  expect(events.mock.calls.filter(([nome]) => nome === 'aoSofrerDano')).toHaveLength(1);
});
async function ativa(cfg: Partial<AcaoAtivaConfig>, tipoArma = 'Psíquico') {
  const ent = arma('2d6', tipoArma, 3);
  ent.acoesAtivas = [{ id: 'ativo', nome: 'Corte', acao: 'livre', custoPE: '2', alcanceM: 3, teste: 'ataque', dano: '(@ARMA.DANO) + @USUARIO.treino', efeitos: [], ...cfg }];
  const inst = useInventoryStore.getState().listByOwner('u')[0];
  useInventoryStore.setState({ items: { [inst.instanceId]: { ...inst, entity: ent } } });
  render(<AcoesAtivasSection charId="u" />);
  fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
  act(() => clicarAlvoMapa('e-a'));
}
it('ação ativa com token da arma rola uma vez e preserva bônus fixo da fórmula', async () => {
  pegarFicha('u').trainingBonus = 4;
  await ativa({ incluirArma: true });
  await waitFor(() => expect(pegarFicha('a').hpCurrent).toBe(84));
  expect(vi.mocked(rollDiceCom).mock.calls.map(c => c[1])).toEqual(['6d6']);
  expect(pegarFicha('u').peCurrent).toBe(18);
});
it('ação ativa sem herdar arma não rola o dano dela', async () => {
  await ativa({ dano: '1d4', incluirArma: false });
  await waitFor(() => expect(pegarFicha('a').hpCurrent).toBe(94));
  expect(vi.mocked(rollDiceCom).mock.calls.map(c => c[1])).toEqual(['3d4']);
});
it('erro de ataque ativo gasta o custo, não rola dano nem aplica efeito', async () => {
  vi.mocked(rollD20Com).mockResolvedValue(1);
  await ativa({ incluirArma: true });
  await waitFor(() => expect(pegarFicha('u').peCurrent).toBe(18));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Usar' }) as HTMLButtonElement).disabled).toBe(false));
  expect(pegarFicha('a').hpCurrent).toBe(100);
  expect(rollDiceCom).not.toHaveBeenCalled();
});
it('fórmula de dano com referência inválida é recusada antes de pagar', async () => {
  await ativa({ dano: '1d8 + @USUARIO.key_inexistente', incluirArma: false });
  await waitFor(() => expect((screen.getByRole('button', { name: 'Usar' }) as HTMLButtonElement).disabled).toBe(false));
  expect(pegarFicha('u').peCurrent).toBe(20);
  expect(pegarFicha('a').hpCurrent).toBe(100);
  expect(rollD20Com).not.toHaveBeenCalled();
});

it('evento de acerto já expõe o tipo da arma, sem inventar dano final', async () => {
  arma(); const events = vi.spyOn(eventBus, 'emitirEvento');
  await ataque();
  const hit = events.mock.calls.find(([e]) => e === 'aoAcertarAtaque')![1]!.dano!;
  expect(hit.tipo).toBe(12); expect(hit).not.toHaveProperty('valor_final');
});
it('ação ativa sem herança não inventa tipo de dano no evento de acerto', async () => {
  const events = vi.spyOn(eventBus, 'emitirEvento');
  await ativa({ dano: '1d4', incluirArma: false });
  await waitFor(() => expect(events.mock.calls.some(([e]) => e === 'aoAcertarAtaque')).toBe(true));
  expect(events.mock.calls.find(([e]) => e === 'aoAcertarAtaque')![1]!.dano).not.toHaveProperty('tipo');
});

it('edição do dano não confunde o custo pessoal com o efeito ofensivo', () => {
  const ent = applyWeaponModel(novaEntidade('arma'), findWeaponByName('Espada Longa')!);
  const custo = { id: 'custo', type: 'SUBTRAIR' as const, target: 'USUARIO' as const, resourcePath: 'vida', formula: '5' };
  ent.combatData!.effectsActive!.unshift(custo);
  const editada = setWeaponDamage(ent, '3d6');
  expect(getWeaponMeta(editada).dano).toBe('3d6');
  expect(editada.combatData!.effectsActive![0].formula).toBe('5');
});

it('bônus fixo negativo na arma reduz dano sem virar dado ou desaparecer', async () => {
  arma('2d6-3', 'Psíquico', 3);
  await ataque(); await waitFor(() => expect(pegarFicha('a').hpCurrent).toBe(91));
  expect(vi.mocked(rollDiceCom).mock.calls.map(c => c[1])).toEqual(['6d6']);
});

it('cargas gastas participam do crítico sem multiplicar a parcela fixa', async () => {
  pegarFicha('u').trainingBonus = 4; pegarFicha('u').omniCounters = { rancor: 3 };
  await ativa({ dano: '1d8+@USUARIO.treino', dadosPorCarga: '1d8', incluirArma: false, custo_recursos: { gastar_cargas: { nome: 'rancor', quantidade: 'todas' } } });
  await waitFor(() => expect(pegarFicha('a').hpCurrent).toBe(72));
  expect(pegarFicha('u').omniCounters?.rancor).toBe(0);
  expect(vi.mocked(rollDiceCom).mock.calls.map(c => c[1])).toEqual(['3d8', '9d8']);
});
it('token de uma arma versátil configurada para duas mãos usa o dado de duas mãos', async () => {
  const ent = applyWeaponModel(novaEntidade('arma'), findWeaponByName('Espada Longa')!);
  ent.tags = [...ent.tags.filter(t => !t.startsWith('mao:')), 'mao:2'];
  ent.acoesAtivas = [{ id: 'duas', nome: 'Golpe com duas mãos', acao: 'livre', custoPE: '0', alcanceM: 3, teste: 'nenhum', dano: '@ARMA.DANO', efeitos: [] }];
  useInventoryStore.getState().add('u', ent);
  useCharacterStore.getState().equipWeapons('u', { mainHandName: ent.nome });
  render(<AcoesAtivasSection charId="u" />);
  fireEvent.click(screen.getByRole('button', { name: 'Usar' }));
  act(() => clicarAlvoMapa('e-a'));
  await waitFor(() => expect(pegarFicha('a').hpCurrent).toBe(98));
  expect(vi.mocked(rollDiceCom).mock.calls.map(c => c[1])).toEqual(['1d10']);
});
