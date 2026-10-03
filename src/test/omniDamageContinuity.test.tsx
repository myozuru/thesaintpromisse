// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async (original) => Object.fromEntries(Object.keys(await original<Record<string, unknown>>()).map(k => [k, () => {}])));
import { EditorAcoesAtivas } from '@/components/omni/EditorAcoesAtivas';
import { ReactionPromptOverlay } from '@/components/fichas/ReactionPromptOverlay';
import { novaAcaoAtiva } from '@/lib/omni/acaoAtiva';
import { novaEntidade, type CombatEffect, type EntidadeOmni } from '@/lib/omni/tipos';
import { executarCombatEffect } from '@/lib/omni/executarSubEfeito';
import { dispararGatilhoEfeitosItens } from '@/lib/omni/triggerEfeitos';
import * as eventBus from '@/lib/omni/eventBus';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useReactionStore } from '@/stores/useReactionStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { DAMAGE_TYPES, DAMAGE_TYPE_LABELS, type Character } from '@/types';
import { ficha, montarMesa, pegarFicha, limparMesa } from './helpers/mesaReal';

const char = (id: string, patch: Partial<Character> = {}) => ficha(id, { hpCurrent: 100, hpMax: 100, escCurrent: 0, rd: 0, ...patch });
beforeEach(() => {
  useReactionStore.setState({ prompts: [], reactionsUsedByChar: {} });
  useOmniEntidadesStore.setState({ entidades: {} });
  for (const method of ['log', 'group', 'groupEnd'] as const) vi.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => { cleanup(); limparMesa(); });

function editor(tipoDano?: string) {
  const initial = { ...novaEntidade('item', 'item'), acoesAtivas: [{ ...novaAcaoAtiva(), tipoDano }] };
  const save = vi.fn();
  function Tela() {
    const [ent, setEnt] = useState<EntidadeOmni>(initial);
    return <EditorAcoesAtivas ent={ent} setEnt={next => { save(next); setEnt(next); }} />;
  }
  render(<Tela />);
  return { save, select: screen.getByLabelText('Tipo de dano') as HTMLSelectElement };
}

describe('Editor de tipos compatíveis com o motor', () => {
  it('oferece todos os códigos reconhecidos e seus rótulos', () => {
    const { select, save } = editor();
    expect(Array.from(select.options).slice(1).map(o => [o.value, o.text])).toEqual(DAMAGE_TYPES.map(t => [t, DAMAGE_TYPE_LABELS[t]]));
    expect(save).not.toHaveBeenCalled();
  });
  it('exibe alias antigo sem regravar a configuração até a escolha explícita', () => {
    const { select, save } = editor('Fogo');
    expect(select.value).toBe('DQ');
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Nome da ação'), { target: { value: 'Novo nome' } });
    expect(save.mock.lastCall![0].acoesAtivas[0].tipoDano).toBe('Fogo');
    fireEvent.change(select, { target: { value: 'DP' } });
    expect(save.mock.lastCall![0].acoesAtivas[0].tipoDano).toBe('DP');
  });
  it.each(['Amaldiçoado', 'Força', 'Verdadeiro', 'Cura'])('preserva %s e permite corrigir manualmente', tipo => {
    const { select, save } = editor(tipo);
    expect(select.value).toBe(tipo);
    expect(screen.getByText(`${tipo} (sem equivalência)`)).toBeTruthy();
    expect(screen.getByText(/Escolha um tipo reconhecido/)).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(select, { target: { value: 'DI' } });
    expect(save.mock.lastCall![0].acoesAtivas[0].tipoDano).toBe('DI');
    expect(screen.queryByText(/sem equivalência/)).toBeNull();
  });
});

describe('Alma Maldita preserva o golpe no fluxo real de reação', () => {
  it.each(['reduzir', 'aceitar', 'uso esgotado'] as const)('%s mantém origem, flags e opções de mitigação', async caminho => {
    montarMesa([char('caster'), char('alvo', { origin: 'Feto Amaldiçoada Híbrido (FAH)', level: 6, almaMalditaUses: 1, almaMalditaMax: 1, rd: 8 })], {});
    const events = vi.spyOn(eventBus, 'emitirEvento');
    const applied = vi.spyOn(useCharacterStore.getState(), 'applyDamage');
    render(<ReactionPromptOverlay />);
    useCharacterStore.getState().applyDamage('alvo', 24, 'DAL', { attackerId: 'caster', source: 'feitico', attack: { critical: true, kind: 'cursed' }, tags: ['original'], ignoresRD: true, rdIgnore: 3 });
    await screen.findByRole('button', { name: /Usar \(1 uso\)/ });
    expect(pegarFicha('alvo').hpCurrent).toBe(100);
    if (caminho === 'uso esgotado') useCharacterStore.getState().updateCharacter('alvo', { almaMalditaUses: 0 });
    fireEvent.click(screen.getByRole('button', { name: caminho === 'aceitar' ? 'Aceitar dano' : /Usar \(1 uso\)/ }));
    const expected = caminho === 'reduzir' ? 12 : 24;
    await waitFor(() => expect(events.mock.calls.some(([e]) => e === 'aoCausarDano')).toBe(true));
    expect(pegarFicha('alvo').hpCurrent).toBe(100 - expected);
    const opts = events.mock.calls.find(([e]) => e === 'aoCausarDano')![1]!;
    expect(opts.dano).toMatchObject({ tipo: 9, fonte: 2, foi_critico: 1, valor_final: expected, id_origem: 1 });
    expect(applied.mock.lastCall![3]).toMatchObject({ attackerId: 'caster', source: 'feitico', ignoresRD: true, rdIgnore: 3, tags: ['original', '__alma_maldita_resolved'], attack: { critical: true, kind: 'cursed' } });
    expect(useReactionStore.getState().prompts).toHaveLength(0);
  });
  it('anulação total continua sem reaplicar dano ou emitir dano causado', async () => {
    montarMesa([char('caster'), char('alvo', { origin: 'Feto Amaldiçoada Híbrido (FAH)', level: 15, almaMalditaUses: 1, almaMalditaMax: 1 })], {});
    const events = vi.spyOn(eventBus, 'emitirEvento');
    render(<ReactionPromptOverlay />);
    useCharacterStore.getState().applyDamage('alvo', 24, 'DAL', { attackerId: 'caster', source: 'feitico' });
    fireEvent.click(await screen.findByRole('button', { name: /Usar \(1 uso\)/ }));
    expect(pegarFicha('alvo').hpCurrent).toBe(100);
    expect(events.mock.calls.some(([e]) => e === 'aoCausarDano')).toBe(false);
    expect(pegarFicha('alvo').almaMalditaUses).toBe(0);
  });
  it('prompt legado sem opções continua aplicando dano sem inventar atacante', async () => {
    montarMesa([char('alvo')], {});
    const events = vi.spyOn(eventBus, 'emitirEvento');
    useReactionStore.getState().enqueue({ charId: 'alvo', charName: 'alvo', kind: 'fah_alma_maldita_offer', message: 'Legado', payload: { pendingSoulDamage: 10 } });
    render(<ReactionPromptOverlay />);
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar dano' }));
    await waitFor(() => expect(events.mock.calls.some(([e]) => e === 'aoSofrerDano')).toBe(true));
    expect(pegarFicha('alvo').hpCurrent).toBe(90);
    expect(events.mock.calls.some(([e]) => e === 'aoCausarDano')).toBe(false);
  });
});

const nested: CombatEffect = {
  id: 'switch', type: 'SUBTRAIR', target: 'ALVO', formula: '0', damageType: 'Impacto',
  diceSwitch: { dice: '@DANO.valor_final + @ITEM.usos_restantes + @RESULTADO_1', branches: [{ values: [12], effects: [{
    id: 'inner', type: 'SUBTRAIR', target: 'ALVO', formula: '0',
    diceSwitch: { dice: '@DANO.tipo', branches: [{ values: [1], effects: [{ id: 'hit', type: 'SUBTRAIR', target: 'ALVO', formula: '@DANO.valor_final + 13', resourcePath: 'vida', damageType: 'Fogo' }] }] },
  }] }] },
};
describe('Subefeitos encadeados', () => {
  it('herda namespaces em dois switches, usando tipo próprio na mitigação e evento', async () => {
    montarMesa([char('usuario'), char('alvo', { rd: 3, rdByType: { DQ: 4 } as Character['rdByType'] })], {});
    const events = vi.spyOn(eventBus, 'emitirEvento');
    executarCombatEffect(nested, { usuarioId: 'usuario', alvoId: 'alvo', usuarioVars: {}, itemVars: { usos_restantes: 2 }, resultados: [3], dano: Object.freeze({ valor_final: 7, tipo: 1 }) });
    expect(pegarFicha('alvo').hpCurrent).toBe(87);
    await waitFor(() => expect(events.mock.calls.some(([e]) => e === 'aoSofrerDano')).toBe(true));
    expect(events.mock.calls.find(([e]) => e === 'aoSofrerDano')![1]?.dano).toMatchObject({ tipo: 7, fonte: 3, valor_inicial: 20, valor_final: 13, id_origem: 1 });
  });
  it('gatilho entrega DANO ao switch em vez de perder o snapshot', () => {
    const ent = novaEntidade('passiva', 'passiva');
    const effect: CombatEffect = { id: 'switch', type: 'ADICIONAR', target: 'USUARIO', formula: '0', trigger: 'aoCausarDano', diceSwitch: { dice: '@DANO.valor_final', branches: [{ values: [7], effects: [{ id: 'gain', type: 'ADICIONAR', target: 'USUARIO', resourcePath: 'vida', formula: '@DANO.valor_final' }] }] } };
    ent.combatData = { effects: [], critRange: 20, critMultiplier: 2, effectsPassive: [effect] };
    useOmniEntidadesStore.setState({ entidades: { [ent.id]: ent } });
    montarMesa([char('usuario', { hpCurrent: 50, omniAtivos: [{ id: 'v', entidadeId: ent.id, categoria: 'passiva', instanceId: 'i', vinculadoEm: 0 }] })], {});
    dispararGatilhoEfeitosItens('aoCausarDano', { usuarioId: 'usuario', dano: { valor_final: 7 } });
    expect(pegarFicha('usuario').hpCurrent).toBe(57);
  });
});
