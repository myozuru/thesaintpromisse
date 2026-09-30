// @vitest-environment jsdom
/**
 * Especialista nv 4 (parte B) em combate na mesa em memória: Técnicas de
 * Avanço (Bumerangue/Sombra Descendente com clique no mapa), Buscar
 * Oportunidade (um teste por inimigo, escolha de uma ação) e Compensar Erro.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useMapStore } from '@/stores/useMapStore';
import { buscarOportunidade, escolherAcaoOportunidade, escondidoDe, revelarPara } from '@/lib/buscarOportunidade';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados, CASA } from './helpers/mesaReal';

const esp = (habs: string[], extra: Record<string, unknown> = {}) =>
  ficha('ana', {
    profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate', level: 5,
    attributes: [{ name: 'Sabedoria', value: 10 }, { name: 'Força', value: 14 }],
    mainHandWeaponName: 'Espada Longa', preparoCurrent: 8, actionsCurrent: 1, actionsMax: 1, movement: 9,
    chosenSpecAbilities: habs.map((abilityId) => ({ abilityId })), ...extra,
  } as never);
const inimigo = (id: string, extra: Record<string, unknown> = {}) =>
  ficha(id, { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, escCurrent: 0, rd: 0, defense: 5, ...extra } as never);

function combate(ids: string[]) {
  useCombatStore.setState({
    inCombat: true, combatId: 'cb-teste', round: 1, currentTurnIndex: 0, movementUsedByChar: {},
    initiativeOrder: ids.map((charId, i) => ({ charId, charName: charId, roll: 10, bonus: 0, total: 20 - i })),
  } as never);
}
const log = () => useLogStore.getState().logs.map((l) => l.message).join('\n');
async function clicarNoMapa(cx: number, cy: number) {
  await waitFor(() => expect(useMapStore.getState().pendingAoEPlacement).toBeTruthy(), { timeout: 4000 });
  act(() => useMapStore.getState().resolveAoEPlacement({ x: cx * CASA, y: cy * CASA } as never));
}
const pos = (id: string) => useMapStore.getState().entities[`e-${id}`];

beforeEach(() => { comoTela({ profileId: 'p-ana', role: 'PLAYER' }); useLogStore.getState().clearLogs(); });
afterEach(() => { cleanup(); limparMesa(); useCombatStore.setState({ inCombat: false, combatId: null, initiativeOrder: [] } as never); vi.restoreAllMocks(); });

describe('Buscar Oportunidade', () => {
  it('um teste por inimigo vivo (CD 16+2×vivos), cada um só uma vez por combate, e a ação vale só contra os vencidos', async () => {
    montarMesa([esp(['ec-buscar-oportunidade']), inimigo('bruno'), inimigo('caio'), inimigo('morto', { hpCurrent: 0 })], { ana: [0, 0], bruno: [1, 0], caio: [2, 0], morto: [3, 0] });
    combate(['ana', 'bruno', 'caio', 'morto']);
    forcarDados(20, 1);
    const r = await buscarOportunidade('ana');
    expect(r.ok).toBe(true);
    expect(log()).toContain('Percepção CD 20 contra 2 inimigo(s)');
    expect(r.ganhos).toEqual(['bruno']);
    expect((await buscarOportunidade('ana')).ok).toBe(false); // precisa escolher antes
    expect(escolherAcaoOportunidade('ana', 'desengajar').ok).toBe(true);
    expect(pegarFicha('ana').desengajadoDe).toEqual(['bruno']);
    const again = await buscarOportunidade('ana');
    expect(again.ok).toBe(false);
    expect(again.reason).toContain('Nenhum inimigo novo'); // caio falhou e não rola de novo
  });

  it('Esconder só dos vencidos e atacar revela; Andar devolve o deslocamento', async () => {
    montarMesa([esp(['ec-buscar-oportunidade']), inimigo('bruno'), inimigo('caio')], { ana: [0, 0], bruno: [1, 0], caio: [2, 0] });
    combate(['ana', 'bruno', 'caio']);
    forcarDados(20, 20);
    await buscarOportunidade('ana');
    escolherAcaoOportunidade('ana', 'esconder');
    expect(escondidoDe(pegarFicha('ana'), 'bruno')).toBe(true);
    revelarPara('ana', 'bruno');
    expect(escondidoDe(pegarFicha('ana'), 'bruno')).toBe(false);
    expect(escondidoDe(pegarFicha('ana'), 'caio')).toBe(true);
  });

  it('Andar como ação livre zera o deslocamento usado', async () => {
    montarMesa([esp(['ec-buscar-oportunidade']), inimigo('bruno')], { ana: [0, 0], bruno: [1, 0] });
    combate(['ana', 'bruno']);
    useCombatStore.getState().setMovementUsed('ana', 9);
    forcarDados(20);
    await buscarOportunidade('ana');
    escolherAcaoOportunidade('ana', 'andar');
    expect(useCombatStore.getState().movementUsedByChar.ana).toBe(0);
  });
});

describe('Compensar Erro', () => {
  it('após errar CaC: gasta PE, rola Nd10 + mod escolhido e aplica dano Energético; 1 vez por rodada', async () => {
    const c = esp(['ec-compensar-erro']);
    montarMesa([c, inimigo('bruno')], { ana: [0, 0], bruno: [1, 0] });
    combate(['ana', 'bruno']);
    render(<AttackPanel character={c} />);
    const sel = screen.getAllByRole('combobox').find((s) => Array.from((s as HTMLSelectElement).options).some((o) => o.value === 'bruno'))!;
    fireEvent.change(sel, { target: { value: 'bruno' } });
    forcarDados(1, 5, 5);
    fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
    await waitFor(() => expect(screen.getByTestId('compensar-erro')).toBeTruthy(), { timeout: 8000 });
    fireEvent.change(screen.getByTestId('compensar-pe'), { target: { value: '2' } });
    fireEvent.change(screen.getByTestId('compensar-attr'), { target: { value: 'Força' } });
    fireEvent.click(screen.getByTestId('compensar-usar'));
    await waitFor(() => expect(log()).toContain('Compensar Erro: ana gasta 2 PE'), { timeout: 8000 });
    expect(log()).toContain('= 12 de dano Energético'); // 5+5 +2 (FOR 14)
    expect(pegarFicha('ana').peCurrent).toBe(18);
    expect(pegarFicha('bruno').hpCurrent).toBeLessThan(100);
    expect(screen.queryByTestId('compensar-erro')).toBeNull();
  });

  it('acerto não libera Compensar Erro', async () => {
    const c = esp(['ec-compensar-erro']);
    montarMesa([c, inimigo('bruno')], { ana: [0, 0], bruno: [1, 0] });
    combate(['ana', 'bruno']);
    render(<AttackPanel character={c} />);
    const sel = screen.getAllByRole('combobox').find((s) => Array.from((s as HTMLSelectElement).options).some((o) => o.value === 'bruno'))!;
    fireEvent.change(sel, { target: { value: 'bruno' } });
    forcarDados(20, 6, 6);
    fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
    await waitFor(() => expect(log()).toMatch(/✅ Acerto|💥 Crítico/), { timeout: 8000 });
    expect(screen.queryByTestId('compensar-erro')).toBeNull();
  });
});

describe('Técnicas de Avanço', () => {
  it('Avanço Bumerangue: clica onde parar, gasta 3 PP, ataca e volta ao ponto de partida', async () => {
    const c = esp(['ec-tecnicas-avanco']);
    montarMesa([c, inimigo('bruno')], { ana: [0, 0], bruno: [3, 0] });
    combate(['ana', 'bruno']);
    render(<AttackPanel character={c} />);
    fireEvent.change(screen.getByTestId('avanco-alvo'), { target: { value: 'bruno' } });
    forcarDados(20, 6, 6, 6);
    fireEvent.click(screen.getByTestId('avanco-bumerangue'));
    await clicarNoMapa(2, 0);
    await waitFor(() => expect(screen.getByTestId('bumerangue-retorno')).toBeTruthy(), { timeout: 8000 });
    expect(pos('ana').x).toBe(2 * CASA);
    expect(pegarFicha('ana').preparoCurrent).toBe(5);
    expect(pegarFicha('bruno').hpCurrent).toBeLessThan(100);
    fireEvent.click(screen.getByTestId('retorno-so'));
    await waitFor(() => expect(pos('ana').x).toBe(0));
    expect(log()).toContain('retorna ao ponto de partida');
  });

  it('Avanço Bumerangue: ponto fora do alcance da arma não gasta nada e desfaz o salto', async () => {
    const c = esp(['ec-tecnicas-avanco']);
    montarMesa([c, inimigo('bruno')], { ana: [0, 0], bruno: [3, 0] });
    combate(['ana', 'bruno']);
    render(<AttackPanel character={c} />);
    fireEvent.change(screen.getByTestId('avanco-alvo'), { target: { value: 'bruno' } });
    fireEvent.click(screen.getByTestId('avanco-bumerangue'));
    await clicarNoMapa(0, 3); // 4,5 m para baixo — longe do bruno
    await waitFor(() => expect(log()).toContain('fica fora do alcance'), { timeout: 4000 });
    expect(pos('ana').x).toBe(0); expect(pos('ana').y).toBe(0);
    expect(pegarFicha('ana').preparoCurrent).toBe(8);
  });

  it('inimigo a mais de 6 m não aparece como alvo', async () => {
    const c = esp(['ec-tecnicas-avanco']);
    montarMesa([c, inimigo('bruno')], { ana: [0, 0], bruno: [6, 0] });
    combate(['ana', 'bruno']);
    render(<AttackPanel character={c} />);
    const opts = Array.from((screen.getByTestId('avanco-alvo') as HTMLSelectElement).options).map((o) => o.value);
    expect(opts).not.toContain('bruno');
  });

  it('Sombra Descendente: gasta Ação Comum + 3 PP, ataca, cai sobre o 2º inimigo e pousa onde o jogador clicar', async () => {
    const c = esp(['ec-tecnicas-avanco']);
    montarMesa([c, inimigo('bruno'), inimigo('caio')], { ana: [0, 0], bruno: [3, 0], caio: [5, 2] });
    combate(['ana', 'bruno', 'caio']);
    render(<AttackPanel character={c} />);
    fireEvent.change(screen.getByTestId('avanco-alvo'), { target: { value: 'bruno' } });
    forcarDados(20, 6, 6, 6, 20, 6, 6, 6);
    fireEvent.click(screen.getByTestId('sombra-descendente'));
    await waitFor(() => expect(screen.getByTestId('sombra-segundo')).toBeTruthy(), { timeout: 8000 });
    expect(pegarFicha('ana').actionsCurrent).toBe(0);
    expect(pegarFicha('ana').preparoCurrent).toBe(5);
    expect(pegarFicha('bruno').hpCurrent).toBeLessThan(100);
    fireEvent.change(screen.getByTestId('sombra-alvo2'), { target: { value: 'caio' } });
    fireEvent.click(screen.getByTestId('sombra-atacar2'));
    await clicarNoMapa(6, 2);
    await waitFor(() => expect(pos('ana').x).toBe(6 * CASA), { timeout: 8000 });
    expect(pegarFicha('caio').hpCurrent).toBeLessThan(100);
  });

  it('Sombra Descendente: sem Ação Comum o botão fica desabilitado', async () => {
    const c = esp(['ec-tecnicas-avanco'], { actionsCurrent: 0 });
    montarMesa([c, inimigo('bruno')], { ana: [0, 0], bruno: [1, 0] });
    combate(['ana', 'bruno']);
    render(<AttackPanel character={c} />);
    fireEvent.change(screen.getByTestId('avanco-alvo'), { target: { value: 'bruno' } });
    expect((screen.getByTestId('sombra-descendente') as HTMLButtonElement).disabled).toBe(true);
  });
});
