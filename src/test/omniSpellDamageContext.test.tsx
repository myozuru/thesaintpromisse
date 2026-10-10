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
import { act, render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { SpellApplyDialog } from '@/components/fichas/SpellApplyDialog';
import { TestRequestOverlay } from '@/components/fichas/TestRequestOverlay';
import { importCreatureToFichas } from '@/components/grimorio/convertToFicha';
import { resolveAreaTargetCharacters } from '@/lib/mapAoE';
import { useMapStore } from '@/stores/useMapStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useDice3DStore } from '@/stores/useDice3DStore';
import { grantAdvantage, grantFlatBonus, peekAdvantageFor } from '@/lib/omni/rollAdvantage';
import * as eventBus from '@/lib/omni/eventBus';
import { CODIGOS_TIPO_DANO, montarMetadadosDano, resolverTipoDano } from '@/lib/omni/contextoDano';
import { executarAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { receberRespostaRemota } from '@/lib/omni/reacoesAtivas';
import { DESTINATARIO_MESTRE } from '@/lib/omni/destinatarioReacao';
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
afterEach(() => { cleanup(); vi.unstubAllGlobals(); limparMesa(); useTestRequestStore.getState().clearAll(); useOmniEntidadesStore.setState({ entidades: {} }); useOmniRuntimeStore.setState({ efeitos: {} } as never); useDice3DStore.setState({ requestRoll: originalRoll }); vi.restoreAllMocks(); });

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
  it('consulta o mestre por reação mesmo quando a sessão do conjurador não tem ofertas locais', async () => {
    mesa();
    vi.stubGlobal('__worldBus', { send: vi.fn() });
    comoTela({ role: 'PLAYER', profileId: 'perfil-caster' });
    useCharacterStore.getState().updateCharacter('caster', { profileId: 'perfil-caster' });
    const enviados: CustomEvent[] = [];
    const capturar = (e: Event) => enviados.push(e as CustomEvent);
    window.addEventListener('omni-reaction:send', capturar);
    try {
      render(<SpellApplyDialog spell={spell()} sourceCharId="caster" initialTargetIds={['alvo']} onClose={() => {}} />);
      await waitFor(() => expect(enviados.some(e => e.detail.tipo === 'sondar')).toBe(true));
      const sondagem = enviados.find(e => e.detail.tipo === 'sondar')!.detail;
      expect(sondagem.perfilId).toBe(DESTINATARIO_MESTRE);
      await act(async () => receberRespostaRemota({
        tipo: 'passar', janelaId: sondagem.janelaId, perfilId: DESTINATARIO_MESTRE,
        clienteOrigem: 'origem',
      }, 'origem'));
      expect(await screen.findByRole('button', { name: /Lançar Dano/ })).toBeTruthy();
    } finally {
      window.removeEventListener('omni-reaction:send', capturar);
    }
  });

  it.each([20, 15])('ataque d20 %i identifica conjurador, tipo, fonte e crítico', async (natural) => {
    mesa(); forcarDados(natural, 4, 4, 4);
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    render(<SpellApplyDialog spell={spell()} sourceCharId="caster" initialTargetIds={['alvo']} onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Rolar$/ }));
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

  it('jogador rola pelo Shikigami com o bônus dele sem gastar vantagem ou bônus do dono', async () => {
    const dono = ficha('dono', {
      profileId: 'perfil-dono', level: 4, peCurrent: 20,
      attributes: [{ name: 'CON', value: 30 }],
    });
    montarMesa([dono], { dono: [0, 0] });
    comoTela({ role: 'PLAYER', profileId: 'perfil-dono' });
    const vantagemId = grantAdvantage('dono', 'advantage', 'next_save', { source: 'vantagem do dono' });
    const bonusId = grantFlatBonus('dono', 'next_save', 5, { source: 'bônus do dono' });
    useOmniRuntimeStore.setState({ efeitos: {
      'reroll-dono': {
        id: 'reroll-dono', entidadeId: 'reroll', nomeSnapshot: 'Rerrolagem do dono',
        targetCharId: 'dono', iniciadoEm: 0, expiraEm: null, meta: { rerollPendente: 1 },
      },
    } });
    useTestRequestStore.getState().enqueue({
      charId: 'dono', charName: 'Guardião', targetProfileId: 'perfil-dono',
      kind: 'save', testName: 'Fortitude', dc: 14,
      bonusOverride: 4, bonusBreakdownOverride: 'mod. constituição +2 · ½ nível +2',
      invocationResolution: {
        kind: 'shikigami_damage_after_save', ownerCharacterId: 'origem',
        invocationId: 'shiki-origem', invocationInstanceId: 'origem-instance',
        actionId: 'rugido', sourceName: 'Atacante — Rugido', damageFormula: '1d6',
        damageOnSuccess: 'nenhum',
        targetInvocation: {
          tokenId: 'token-guardiao', ownerCharacterId: 'dono',
          invocationId: 'shiki-alvo', invocationInstanceId: 'guardiao-instance', name: 'Guardião',
        },
      },
    });
    const d20 = vi.spyOn(useDice3DStore.getState(), 'requestRoll').mockResolvedValueOnce([10]).mockResolvedValueOnce([20]);
    render(<TestRequestOverlay />);

    fireEvent.click(await screen.findByRole('button', { name: /Rolar d20/i }));

    await waitFor(() => expect(useTestRequestStore.getState().requests[0].result).toMatchObject({ d20: 10, bonus: 4, total: 14 }));
    expect(d20).toHaveBeenCalledTimes(1);
    expect(d20).toHaveBeenCalledWith(['D20'], 'Fortitude — Guardião', undefined, 'test-request', 0, undefined);
    expect(peekAdvantageFor('dono', { kind: 'save', name: 'Fortitude' })).toBe('advantage');
    expect((pegarFicha('dono') as unknown as { omniAdvMods: Record<string, unknown> }).omniAdvMods).toHaveProperty(vantagemId);
    expect((pegarFicha('dono') as unknown as { omniAdvMods: Record<string, unknown> }).omniAdvMods).toHaveProperty(bonusId);
    expect(useOmniRuntimeStore.getState().efeitos['reroll-dono'].meta?.rerollPendente).toBe(1);
    expect(pegarFicha('dono').peCurrent).toBe(20);
  });

  it('ataque em área importado do Grimório percorre mapa, TR do jogador e dano real', async () => {
    useCharacterStore.setState({ characters: [] } as never);
    const imported = importCreatureToFichas({
      name: 'Calamidade de Teste',
      core: { nd: 10, size: 'grande', origin: { type: 'maldicao' } },
      attributes: { forca: 20, destreza: 16, constituicao: 20, inteligencia: 16, sabedoria: 16, presenca: 20 },
      stats: { hpMax: 1000, peMax: 30, defesa: 20, deslocamento: 9, cdBase: 10 },
      saves: { fortitude: 12, reflexos: 10, vontade: 14, astucia: 10, integridade: 12 },
      skills: [],
      defenses: { vulnerabilidades: [], imunidades: [], resistencias: [], condicoesImunes: [] },
      aptidoes: { ea: 0, cl: 0, bar: 0, dom: 0, er: 0 },
      actions: {
        total: { comum: 1, bonus: 1, reacao: 1 },
        list: [{
          name: 'Onda de Cinzas', type: 'comum', attackType: 'tr_area', cd: 20,
          trType: 'Vontade', cost: 5, range: '9m', area: 4.5, areaShape: 'circle',
          damage: { roll: '2d8', type: 'queimante' },
        }],
      },
    } as never)!;
    const target = ficha('alvo', {
      profileId: 'perfil-alvo', category: 'PLAYER', hpCurrent: 200, hpMax: 200, escCurrent: 0,
      peCurrent: 20, peMax: 20, rd: 0, attributes: [], savingThrows: [], activeBuffs: [],
    });
    useCharacterStore.setState((s) => ({ characters: [...s.characters, target] }));
    const entities = {
      caster: { id: 'caster', characterId: imported.id, x: 0, y: 0, w: 70, h: 70 },
      tokenAlvo: { id: 'tokenAlvo', avatarProfileId: 'perfil-alvo', x: 70, y: 0, w: 70, h: 70 },
    } as never;
    useMapStore.setState({ entities });
    const resolved = resolveAreaTargetCharacters(
      ['tokenAlvo'], entities as never, useCharacterStore.getState().characters, imported.id, 'caster',
    );
    expect(resolved.characterIds).toEqual(['alvo']);

    const creature = pegarFicha(imported.id);
    const areaAttack = creature.spells.find((s) => s.name === 'Onda de Cinzas')!;
    expect(areaAttack.targetMode).toBe('area_tr');
    expect(areaAttack.damageDice).toBe('2d8');
    forcarDados(1, 4, 5); // falha crítica no TR, depois 2d8 de dano
    const spy = vi.spyOn(eventBus, 'emitirEvento');
    render(<><SpellApplyDialog spell={areaAttack} sourceCharId={creature.id} initialTargetIds={resolved.characterIds} areaMode onClose={() => {}} /><TestRequestOverlay /></>);
    comoTela({ profileId: 'perfil-alvo', role: 'PLAYER' });
    fireEvent.click(await screen.findByRole('button', { name: /Rolar d20/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Rolar Dano' }, { timeout: 5000 }));
    const ctx = await resultadoCausado(spy);
    await waitFor(() => expect(pegarFicha('alvo').hpCurrent).toBe(182));
    expect(ctx).toMatchObject({ tipo: 7, fonte: 2, valor_inicial: 18, valor_final: 18, id_origem: 1 });
    expect(pegarFicha(creature.id).peCurrent).toBe(creature.peCurrent - 5);
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
