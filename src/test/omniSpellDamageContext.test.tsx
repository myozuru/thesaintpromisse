// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async (original) => {
  const real = await original<Record<string, unknown>>();
  return Object.fromEntries(Object.keys(real).map((key) => [key, () => {}]));
});
vi.mock('@/components/dice-physics/DiceTrayPanel', () => ({ DiceTrayPanel: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SpellApplyDialog } from '@/components/fichas/SpellApplyDialog';
import { TestRequestOverlay } from '@/components/fichas/TestRequestOverlay';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useDice3DStore } from '@/stores/useDice3DStore';
import * as eventBus from '@/lib/omni/eventBus';
import { CODIGOS_TIPO_DANO, montarMetadadosDano, resolverTipoDano } from '@/lib/omni/contextoDano';
import { executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { aplicarEfeitoNoPersonagem } from '@/lib/omni/aplicarEfeito';
import { parseOmniScript } from '@/lib/omni/omniScript';
import { novaEntidade, type AcaoAtivaConfig } from '@/lib/omni/tipos';
import { DAMAGE_TYPES, type Spell, type Character } from '@/types';
import { avaliarFormula } from '@/lib/omni/parser';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados } from './helpers/mesaReal';

const spell = (patch: Partial<Spell> = {}): Spell => ({
  id: 'sp', name: 'Chama', costPE: 3, description: '', damageDice: '1d6', damageBonus: 0,
  fixedDamage: 10, damageType: 'DQ', spellType: 'damage', actionType: 'action',
  buffs: [], conditions: [], spellLevel: '1', durationRounds: 0, range: '9m', targetMode: 'single_atk', attackType: 'cursed', ...patch,
});
function mesa(patch: Partial<Character> = {}) {
  const ent = novaEntidade('passiva', 'Receptor');
  const parsed = parseOmniScript('@causar_dano -> somar @DANO.fonte em contador_fonte\n@causar_dano -> somar @DANO.tipo em contador_tipo', { defaultTarget: 'USUARIO' });
  expect(parsed.erros).toEqual([]);
  ent.combatData = { effects: [], critRange: 20, critMultiplier: 2, effectsPassive: parsed.efeitos };
  useOmniEntidadesStore.setState({ entidades: { [ent.id]: ent } });
  const caster = ficha('caster', { peCurrent: 20, actionsCurrent: 2, actionsMax: 2, mainHandWeaponName: 'Espada Longa', attributes: [], activeBuffs: [], spells: [], omniAtivos: [{ id: 'v', entidadeId: ent.id, instanceId: 'i', categoria: 'passiva', vinculadoEm: 0 }] });
  montarMesa([caster, ficha('alvo', { category: 'INIMIGO', hpCurrent: 200, hpMax: 200, escCurrent: 0, rd: 3, attributes: [], ...patch })], { caster: [0, 0], alvo: [1, 0] });
}
const originalRoll = useDice3DStore.getState().requestRoll;
beforeEach(() => {
  comoTela({ profileId: null, role: 'MASTER' });
  useTestRequestStore.getState().clearAll();
  for (const method of ['log', 'group', 'groupEnd'] as const) vi.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => { cleanup(); limparMesa(); useTestRequestStore.getState().clearAll(); useOmniEntidadesStore.setState({ entidades: {} }); useDice3DStore.setState({ requestRoll: originalRoll }); vi.restoreAllMocks(); });

async function resultadoCausado(spy: ReturnType<typeof vi.spyOn>) {
  await waitFor(() => expect(spy.mock.calls.some(([e]) => e === 'aoCausarDano')).toBe(true), { timeout: 4000 });
  return (spy.mock.calls.find(([e]) => e === 'aoCausarDano')![1] as eventBus.EmitirOpts).dano!;
}

describe('Códigos estáveis de dano', () => {
  it('cada tipo do motor tem código numérico distinto', () => {
    expect(new Set(Object.values(CODIGOS_TIPO_DANO)).size).toBe(DAMAGE_TYPES.length);
    for (const tipo of DAMAGE_TYPES) expect(montarMetadadosDano({}, null, tipo).tipo).toBe(CODIGOS_TIPO_DANO[tipo]);
  });
  it.each([['Ct', 'DCO'], ['Pf', 'DP'], ['Im', 'DI'], ['Impacto', 'DI'], ['Fogo', 'DQ'], [' frio ', 'DCG'], ['Elétrico', 'DCC'], ['Mental', 'DPS'], ['Veneno', 'DV'], ['na Alma', 'DAL']])('converte %s para %s', (nome, tipo) => {
    expect(resolverTipoDano(nome)).toBe(tipo);
  });
  it.each(['Verdadeiro', 'Cura', 'Força', 'Amaldiçoado', '__proto__', 'desconhecido', ''])('não inventa correspondência para %s', (nome) => {
    expect(resolverTipoDano(nome)).toBeUndefined();
    expect(montarMetadadosDano({}, null, nome)).not.toHaveProperty('tipo');
  });
  it('tipo e fonte desconhecidos produzem diagnóstico em vez de zero válido', () => {
    expect(avaliarFormula('@DANO.tipo + @DANO.fonte', {}, undefined, { dano: montarMetadadosDano() }).diagnosticos).toHaveLength(2);
  });
});

describe('Feitiços reais pela UI', () => {
  it.each([20, 15])('ataque d20 %i identifica conjurador, tipo, fonte e crítico', async (natural) => {
    mesa(); forcarDados(natural, 4, 4, 4);
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    render(<SpellApplyDialog spell={spell()} sourceCharId="caster" initialTargetIds={['alvo']} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Rolar$/ }));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Confirmar Ataques' }) as HTMLButtonElement).disabled).toBe(false), { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Ataques' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rolar Dano' }));
    const ctx = await resultadoCausado(spy);
    expect(ctx).toMatchObject({ tipo: 7, fonte: 2, id_origem: 1, id_alvo: 1, tipo_ataque: 3, foi_critico: natural === 20 ? 1 : 0, alcance: 1.5 });
    expect(pegarFicha('alvo').hpCurrent).toBe(200 - ctx.valor_final);
    await waitFor(() => expect(pegarFicha('caster').omniCounters).toMatchObject({ fonte: 2, tipo: 7 }));
    expect(pegarFicha('caster').peCurrent).toBe(17);
  });
  it('dano direto informa o conjurador sem inventar crítico de ataque', async () => {
    mesa(); forcarDados(4, 4, 4);
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    render(<SpellApplyDialog spell={spell({ targetMode: undefined })} areaMode sourceCharId="caster" initialTargetIds={['alvo']} onClose={() => {}} />);
    const ctx = await resultadoCausado(spy);
    expect(ctx).toMatchObject({ tipo: 7, fonte: 2, id_origem: 1, tipo_ataque: 3 });
    expect(ctx).not.toHaveProperty('foi_critico');
    expect(ctx.valor_final).toBe(11);
  });
  it('TR pela pergunta real preserva tipo/fonte após a redução por sucesso', async () => {
    mesa(); forcarDados(19, 4, 4, 4);
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    render(<><SpellApplyDialog spell={spell({ targetMode: 'single_tr' })} sourceCharId="caster" initialTargetIds={['alvo']} onClose={() => {}} /><TestRequestOverlay /></>);
    fireEvent.click(await screen.findByRole('button', { name: /Rolar d20/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Rolar Dano' }, { timeout: 4000 }));
    const ctx = await resultadoCausado(spy);
    expect(ctx).toMatchObject({ tipo: 7, fonte: 2, id_origem: 1, tipo_ataque: 3, valor_inicial: 7, valor_final: 4 });
    expect(ctx).not.toHaveProperty('foi_falha_critica');
  });
});

describe('Ações Omni e nomes legados usam o dano real', () => {
  const cfg: AcaoAtivaConfig = { id: 'a', nome: 'Ação', acao: 'comum', custoPE: '0', alcanceM: 3, teste: 'nenhum', dano: '10', tipoDano: 'Fogo' };
  it('ação ativa converte Fogo em DQ antes da RD por tipo', async () => {
    mesa({ rdByType: { DQ: 4 } as Character['rdByType'] });
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    expect((await executarAcaoAtiva('caster', cfg, 'alvo')).ok).toBe(true);
    const ctx = await resultadoCausado(spy);
    expect(ctx).toMatchObject({ fonte: 3, tipo: 7, valor_inicial: 10, valor_final: 3 });
    expect(pegarFicha('alvo').hpCurrent).toBe(197);
    expect(ctx).not.toHaveProperty('tipo_ataque');
  });
  it('ação com ataque informa resultado e tipo da arma', async () => {
    mesa(); forcarDados(20, 4, 4, 4);
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    await executarAcaoAtiva('caster', { ...cfg, teste: 'ataque' }, 'alvo');
    expect(await resultadoCausado(spy)).toMatchObject({ fonte: 3, tipo: 7, foi_critico: 1, tipo_ataque: 1 });
  });
  it('ponte de efeitos identifica fonte Omni mesmo sem atacante conhecido', async () => {
    mesa();
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    aplicarEfeitoNoPersonagem('alvo', 'SUBTRAIR', 'vida', 10);
    await waitFor(() => expect(spy.mock.calls.some(([e]) => e === 'aoSofrerDano')).toBe(true));
    expect(spy.mock.calls.find(([e]) => e === 'aoSofrerDano')![1]?.dano).toMatchObject({ fonte: 3, id_origem: 0, valor_final: 7 });
    expect(pegarFicha('caster').omniCounters).toBeUndefined();
  });
  it('fonte ambiental explícita não inventa atacante', async () => {
    mesa();
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    useCharacterStore.getState().applyDamage('alvo', 10, 'DP', { source: 'ambiente' });
    await waitFor(() => expect(spy.mock.calls.some(([e]) => e === 'aoSofrerDano')).toBe(true));
    expect(spy.mock.calls.find(([e]) => e === 'aoSofrerDano')![1]?.dano).toMatchObject({ fonte: 4, tipo: 2, id_origem: 0, valor_final: 7 });
    expect(spy.mock.calls.some(([e]) => e === 'aoCausarDano')).toBe(false);
  });
  it('nome localizado recebido pelo store respeita imunidade real', async () => {
    mesa({ immunities: ['DI'] });
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    useCharacterStore.getState().applyDamage('alvo', 10, 'Impacto' as never, { attackerId: 'caster', source: 'omni' });
    expect(await resultadoCausado(spy)).toMatchObject({ tipo: 3, valor_final: 0 });
    expect(pegarFicha('alvo').hpCurrent).toBe(200);
  });
});
