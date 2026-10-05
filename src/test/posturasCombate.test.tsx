import { selecionarAlvoNoMapaUI } from './helpers/alvoMapaUI';
// @vitest-environment jsdom
/**
 * Assumir Postura (parte 1: Sol, Lua, Terra, Dragão) em combate real:
 * peças no mapa, turnos de iniciativa, cliques reais no painel e no ataque.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/lib/sounds', () => ({ playSuccessSound: () => {}, playErrorSound: () => {}, playClickSound: () => {} }));
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { ReactionPromptOverlay } from '@/components/fichas/ReactionPromptOverlay';
import { reactionMoveBudget, effectiveMovement } from '@/lib/movementBudget';
import { useLogStore } from '@/stores/useLogStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useReactionStore } from '@/stores/useReactionStore';
import { computeTotalDefense } from '@/lib/defenseCalc';
import { podeEntrar, podeAprender, posturasLimite, imuneMovimentoForcado, posturaFortitude } from '@/lib/posturas';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados } from './helpers/mesaReal';

const AP = [{ abilityId: 'ec-assumir-postura', chosenAtLevel: 2 }];
const FOR = [{ id: 'f', name: 'FOR', value: 16 }, { id: 'c', name: 'Constituição', value: 10 }];
const esp = (extra: Record<string, unknown> = {}) => ficha('ana', {
  profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  level: 4, mainHandWeaponName: 'Espada Curta', offHandWeaponName: null, meleeTrained: true,
  chosenSpecAbilities: AP, attributes: FOR, attacksThisTurn: 0, bonusActionsCurrent: 1, bonusActionsMax: 1,
  reactionsCurrent: 1, reactionsMax: 1, hpCurrent: 50, hpMax: 50, escCurrent: 0, rd: 0, ca: 10, ...extra,
} as never);
const inimigo = (id: string) => ficha(id, { category: 'INIMIGO', hpCurrent: 200, hpMax: 200, escCurrent: 0, rd: 0, attributes: [{ id: 'c', name: 'Constituição', value: 10 }] } as never);
const podeEntrarFora = () => podeEntrar(esp({ posturasAprendidas: ['sol'] }), 'sol', { inCombat: false }).reason;
const log = () => useLogStore.getState().logs.map((l) => l.message).join('\n');

function mesa(c = esp(), extra: Record<string, [number, number]> = {}) {
  useLogStore.getState().clearLogs();
  montarMesa([c, inimigo('bruno'), inimigo('caio'), inimigo('davi')], { ana: [0, 0], bruno: [1, 0], ...extra });
  useCombatStore.setState({ inCombat: true, round: 1, initiativeOrder: [{ charId: 'ana' }, { charId: 'bruno' }] as never, currentTurnIndex: 0 } as never);
  render(<AttackPanel character={pegarFicha('ana')} />);
}
const clicar = (re: RegExp) => fireEvent.click(screen.getByRole('button', { name: re }));
async function atacar(...dados: number[]) {
  await selecionarAlvoNoMapaUI('bruno');
  useLogStore.getState().clearLogs();
  forcarDados(...dados);
  clicar(/Rolar Ataque/);
  fireEvent.click(await screen.findByRole('button', { name: /Rolar Dano/ }, { timeout: 8000 }));
  await waitFor(() => expect(log()).toMatch(/💥 Dano:/), { timeout: 8000 });
}

beforeEach(async () => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { cleanup(); limparMesa(); useCombatStore.setState({ inCombat: false, initiativeOrder: [] } as never); });

describe('Assumir Postura — base', () => {
  it('aprende 1 postura (limite 1 no nv 4; 2 no 8; 3 no 16); Devastação exige nv 6', async () => {
    expect([posturasLimite(4), posturasLimite(8), posturasLimite(16)]).toEqual([1, 2, 3]);
    mesa();
    clicar(/Aprender Sol/);
    expect(pegarFicha('ana').posturasAprendidas).toEqual(['sol']);
    expect(screen.queryByRole('button', { name: /Aprender Lua/ })).toBeNull();
    expect(podeAprender(esp({ level: 4, posturasAprendidas: [] }), 'devastacao').reason).toMatch(/Requer nível 6/);
    expect(podeAprender(esp({ level: 8, posturasAprendidas: ['sol'] }), 'lua').ok).toBe(true);
  });

  it('entrar gasta Ação Bônus e 1 uso; sem AB bloqueia; usos acabam', async () => {
    mesa(esp({ posturasAprendidas: ['sol'] }));
    clicar(/Entrar: Sol/);
    const a = pegarFicha('ana');
    expect(a.posturaAtiva?.id).toBe('sol');
    expect(a.bonusActionsCurrent).toBe(0);
    expect(a.posturaUsos).toBe(1);
    cleanup();
    mesa(esp({ posturasAprendidas: ['sol'], posturaUsos: 2 })); // TB nv 4 = 2
    expect((screen.getByRole('button', { name: /Entrar: Sol/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('fora de combate não entra; termina após 10 rodadas; Caído encerra', async () => {
    expect(podeEntrarFora()).toMatch(/Só em combate/);
    mesa(esp({ posturasAprendidas: ['sol'] }));
    clicar(/Entrar: Sol/);
    for (let i = 0; i < 18; i++) useCombatStore.getState().nextTurn(); // rodada 10
    expect(pegarFicha('ana').posturaAtiva?.id).toBe('sol');
    useCombatStore.getState().nextTurn(); useCombatStore.getState().nextTurn(); // rodada 11
    expect(pegarFicha('ana').posturaAtiva).toBeNull();
    useCharacterStore.getState().updateCharacter('ana', { posturaAtiva: { id: 'sol', untilRound: 99 }, activeConditions: [{ id: 'x', conditionId: 'caido', name: 'Caído', icon: '', remainingTurns: -1 }] } as never);
    expect(pegarFicha('ana').posturaAtiva).toBeNull();
    // levantar não traz a postura de volta
    useCharacterStore.getState().updateCharacter('ana', { activeConditions: [] } as never);
    expect(pegarFicha('ana').posturaAtiva).toBeNull();
    await waitFor(() => expect(screen.getByTestId('postura-ativa').textContent).toMatch(/Nenhuma/));
  });
});

describe('Posturas em combate', () => {
  it('ataque real aguarda Cobrir-se e reduz o dano antes de alterar PV', async () => {
    const alvo = inimigo('bruno');
    Object.assign(alvo, {
      peCurrent: 10, peMax: 10,
      chosenClAptitudes: ['cl-cobrir-se'],
      cursedAptitudes: { CL: 1 },
    });
    montarMesa([esp(), alvo, inimigo('caio'), inimigo('davi')], { ana: [0, 0], bruno: [1, 0] });
    useCombatStore.setState({ inCombat: true, round: 1, initiativeOrder: [{ charId: 'ana' }, { charId: 'bruno' }] as never, currentTurnIndex: 0 } as never);
    useReactionStore.setState({ prompts: [], reactionsUsedByChar: {} });
    render(<><AttackPanel character={pegarFicha('ana')} /><ReactionPromptOverlay /></>);

    await selecionarAlvoNoMapaUI('bruno');
    forcarDados(15, 4, 4, 4);
    clicar(/Rolar Ataque/);
    fireEvent.click(await screen.findByRole('button', { name: /Rolar Dano/ }));

    await screen.findByRole('button', { name: /Cobrir-se$/i });
    const prompt = useReactionStore.getState().prompts.find((p) => p.kind === 'cobrir_se_offer')!;
    const hpBefore = pegarFicha('bruno').hpCurrent;
    expect(prompt.payload?.damageDealt).toBeGreaterThan(0);
    expect(hpBefore).toBe(200); // a escolha ainda está pendente: PV não foram tocados

    fireEvent.click(screen.getByRole('button', { name: /Cobrir-se$/i }));
    const expectedHp = hpBefore - Math.max(0, (prompt.payload?.damageDealt ?? 0) - 4);
    await waitFor(() => expect(pegarFicha('bruno').hpCurrent).toBe(expectedHp));
    expect(pegarFicha('bruno').peCurrent).toBe(9);
    expect(useReactionStore.getState().reactionsUsedByChar.bruno).toBe(1);
  });

  it('oferece Cobrir-se antes de um ataque letal e mantém os PV intactos até a resposta', async () => {
    const alvo = inimigo('bruno');
    Object.assign(alvo, {
      hpCurrent: 4, peCurrent: 10, peMax: 10,
      chosenClAptitudes: ['cl-cobrir-se'],
      cursedAptitudes: { CL: 1 },
    });
    montarMesa([esp(), alvo, inimigo('caio'), inimigo('davi')], { ana: [0, 0], bruno: [1, 0] });
    useCombatStore.setState({ inCombat: true, round: 1, initiativeOrder: [{ charId: 'ana' }, { charId: 'bruno' }] as never, currentTurnIndex: 0 } as never);
    useReactionStore.setState({ prompts: [], reactionsUsedByChar: {} });
    render(<><AttackPanel character={pegarFicha('ana')} /><ReactionPromptOverlay /></>);

    await selecionarAlvoNoMapaUI('bruno');
    forcarDados(15, 4, 4, 4);
    clicar(/Rolar Ataque/);
    fireEvent.click(await screen.findByRole('button', { name: /Rolar Dano/ }));

    await screen.findByRole('button', { name: /Cobrir-se$/i });
    const prompt = useReactionStore.getState().prompts.find((p) => p.kind === 'cobrir_se_offer')!;
    expect(prompt.payload?.damageDealt).toBeGreaterThanOrEqual(4);
    expect(pegarFicha('bruno').hpCurrent).toBe(4);
    expect(document.body.textContent).toMatch(/Rolando dano/);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /Cobrir-se$/i }));
    await waitFor(() => expect(pegarFicha('bruno').escCurrent).toBeGreaterThan(0));
    expect(pegarFicha('bruno').hpCurrent).toBe(4);
    expect(pegarFicha('bruno').peCurrent).toBe(6);
    expect(useReactionStore.getState().reactionsUsedByChar.bruno).toBe(1);
    await waitFor(() => expect(document.body.textContent).not.toMatch(/Rolando dano/));
  });

  it('Sol: +2 acerto, 2 dados no dano e −4 Defesa', async () => {
    const base = computeTotalDefense(esp());
    mesa(esp({ posturasAprendidas: ['sol'] }));
    clicar(/Entrar: Sol/);
    expect(computeTotalDefense(pegarFicha('ana'))).toBe(base - 4);
    await atacar(15, 3, 3, 3);
    expect(log()).toContain('Postura do Sol');
    expect(log()).toMatch(/💥 Dano: \d+ \(2d/);
  });

  it('Lua: +3 Defesa, −4 acerto, dano sem Força; reação reduz dano pelo nível (1x)', async () => {
    const base = computeTotalDefense(esp());
    mesa(esp({ posturasAprendidas: ['lua'], movement: 9 }));
    clicar(/Entrar: Lua/);
    expect(computeTotalDefense(pegarFicha('ana'))).toBe(base + 3);
    await atacar(17, 4, 4, 4);
    expect(log()).toContain('Postura da Lua');
    expect(Number(/💥 Dano: (\d+)/.exec(log())![1])).toBe(4); // 1d6=4, sem +3 de Força
    const ativo = () => { const c = useCombatStore.getState(); return c.initiativeOrder[c.currentTurnIndex]?.charId; };
    while (ativo() === 'ana') useCombatStore.getState().nextTurn(); // turno do inimigo
    useCharacterStore.getState().updateCharacter('ana', { reactionsCurrent: 1 });
    render(<ReactionPromptOverlay />);
    // 1º ataque: aparece a pergunta; dano fica pendente até decidir.
    useCharacterStore.getState().applyDamage('ana', 10, undefined, { attackerId: 'bruno' });
    expect(pegarFicha('ana').hpCurrent).toBe(50);
    fireEvent.click(await screen.findByRole('button', { name: /Usar reação/ }));
    await waitFor(() => expect(pegarFicha('ana').hpCurrent).toBe(50 - 6));
    expect(pegarFicha('ana').reactionsCurrent).toBe(0);
    // Andar fora do turno: deslocamento inteiro liberado; Desengajado.
    expect(reactionMoveBudget(pegarFicha('ana'))).toBe(9);
    expect(effectiveMovement(pegarFicha('ana'))).toBe(9);
    expect(pegarFicha('ana').desengajado).toBe(true);
    // 2º ataque: sem reação, nenhuma pergunta e dano cheio.
    useCharacterStore.getState().applyDamage('ana', 10, undefined, { attackerId: 'bruno' });
    await waitFor(() => expect(pegarFicha('ana').hpCurrent).toBe(50 - 16));
    expect(screen.queryByRole('button', { name: /Usar reação/ })).toBeNull();
    // Desengajar acaba no fim do próprio turno de ana, movimento extra zera no início dele.
    while (ativo() !== 'ana') useCombatStore.getState().nextTurn(); // → ana começa
    expect(reactionMoveBudget(pegarFicha('ana'))).toBeNull();
    expect(pegarFicha('ana').desengajado).toBe(true);
    useCombatStore.getState().nextTurn(); // ana termina
    expect(pegarFicha('ana').desengajado).toBe(false);
  });

  it('Lua: recusar a reação aplica dano cheio e guarda a reação; dano sem atacante não pergunta', async () => {
    mesa(esp({ posturasAprendidas: ['lua'] }));
    clicar(/Entrar: Lua/);
    render(<ReactionPromptOverlay />);
    useCharacterStore.getState().applyDamage('ana', 10, undefined, { attackerId: 'bruno' });
    fireEvent.click(await screen.findByRole('button', { name: /Aceitar dano/ }));
    await waitFor(() => expect(pegarFicha('ana').hpCurrent).toBe(40));
    expect(pegarFicha('ana').reactionsCurrent).toBe(1);
    expect(pegarFicha('ana').desengajado).toBeFalsy();
    useCharacterStore.getState().applyDamage('ana', 5);
    expect(pegarFicha('ana').hpCurrent).toBe(35);
  });

  it('Terra: PV temporários = nível no começo do turno, +treinamento em Fortitude, imune a empurrão', async () => {
    mesa(esp({ posturasAprendidas: ['terra'] }));
    clicar(/Entrar: Terra/);
    expect(posturaFortitude(pegarFicha('ana'))).toBe(2);
    expect(imuneMovimentoForcado(pegarFicha('ana'))).toBe(true);
    useCombatStore.getState().nextTurn(); useCombatStore.getState().nextTurn(); // volta para ana
    expect(pegarFicha('ana').escCurrent).toBe(4);
    expect(imuneMovimentoForcado(esp())).toBe(false);
  });

  it('Dragão: inimigo a 1,5 m do alvo falha Fortitude e sofre metade; quem está longe não', async () => {
    mesa(esp({ posturasAprendidas: ['dragao'] }), { caio: [2, 0], davi: [5, 0] });
    clicar(/Entrar: Dragão/);
    await atacar(18, 6, 1, 1, 1, 1);
    const dano = Number(/💥 Dano: (\d+)/.exec(log())![1]);
    await waitFor(() => expect(log()).toContain('Postura do Dragão: caio'));
    expect(200 - pegarFicha('caio').hpCurrent).toBe(Math.floor(dano / 2));
    expect(pegarFicha('davi').hpCurrent).toBe(200);
    expect(log()).not.toContain('davi Fortitude');
  });

  it('Dragão: inimigo que passa na Fortitude não sofre dano', async () => {
    mesa(esp({ posturasAprendidas: ['dragao'] }), { caio: [2, 0], davi: [9, 9] });
    clicar(/Entrar: Dragão/);
    await atacar(18, 6, 20, 20);
    await waitFor(() => expect(log()).toMatch(/caio Fortitude d20 20.*passou/));
    expect(pegarFicha('caio').hpCurrent).toBe(200);
  });
});
