// @vitest-environment jsdom
/**
 * Assumir Postura (parte 2: Fortuna, Devastação, Tempestade, Céu) em combate real:
 * peças no mapa, turnos de iniciativa, cliques reais no painel e no ataque.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/lib/sounds', () => ({ playSuccessSound: () => {}, playErrorSound: () => {}, playClickSound: () => {} }));
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { FortunaPrompt } from '@/components/fichas/FortunaPrompt';
import { perguntarFortuna } from '@/lib/fortuna';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { posturaPericia, posturaAlcanceMult, fortunaUsosMax } from '@/lib/posturas';
import { getPreparoAtual, spendPreparo } from '@/lib/artesCombate';
import { ReactionPromptOverlay } from '@/components/fichas/ReactionPromptOverlay';
import { reactionMoveBudget, effectiveMovement } from '@/lib/movementBudget';
import { useLogStore } from '@/stores/useLogStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
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
  render(<><AttackPanel character={pegarFicha('ana')} /><FortunaPrompt /></>);
}
const clicar = (re: RegExp) => fireEvent.click(screen.getByRole('button', { name: re }));
async function atacar(...dados: number[]) {
  const sel = screen.getAllByRole('combobox').find((s) =>
    Array.from((s as HTMLSelectElement).options).some((o) => o.value === 'bruno')) as HTMLSelectElement;
  fireEvent.change(sel, { target: { value: 'bruno' } });
  useLogStore.getState().clearLogs();
  forcarDados(...dados);
  clicar(/Rolar Ataque/);
  fireEvent.click(await screen.findByRole('button', { name: /Rolar Dano/ }, { timeout: 8000 }));
  await waitFor(() => expect(log()).toMatch(/💥 Dano:/), { timeout: 8000 });
}

beforeEach(() => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { cleanup(); limparMesa(); useCombatStore.setState({ inCombat: false, initiativeOrder: [] } as never); });


const alvo = (id: string) => {
  const sel = screen.getAllByRole('combobox').find((s) =>
    Array.from((s as HTMLSelectElement).options).some((o) => o.value === id)) as HTMLSelectElement;
  fireEvent.change(sel, { target: { value: id } });
};
async function atacarAlvo(id: string, ...dados: number[]) {
  useCharacterStore.getState().updateCharacter('ana', { attacksThisTurn: 0, actionsCurrent: 1 } as never);
  await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0));
  alvo(id);
  useLogStore.getState().clearLogs();
  forcarDados(...dados);
  clicar(/Rolar Ataque/);
  await waitFor(() => expect(log()).toMatch(/atacou com|Erro|Acerto/), { timeout: 8000 });
  const dano = await screen.findByRole('button', { name: /Rolar Dano/ }, { timeout: 1500 }).catch(() => null);
  if (dano) { fireEvent.click(dano); await waitFor(() => expect(log()).toMatch(/💥 Dano:/), { timeout: 8000 }); }
}
const cond = (id: string) => (pegarFicha(id).activeConditions ?? []).map((x) => x.conditionId);

describe('Posturas — parte 2', { timeout: 20000 }, () => {
  it('Fortuna: d20 ≤ treinamento pergunta; rolar de novo vale; usos por rodada = metade (mín. 1)', async () => {
    const bt = getTrainingBonusByLevel(4);
    expect(fortunaUsosMax(esp({ level: 4 }))).toBe(Math.max(1, Math.floor(bt / 2)));
    mesa(esp({ posturasAprendidas: ['fortuna'] }));
    clicar(/Entrar: Fortuna/);
    alvo('bruno');
    useLogStore.getState().clearLogs();
    forcarDados(1, 19, 4, 4, 4);
    clicar(/Rolar Ataque/);
    fireEvent.click(await screen.findByRole('button', { name: /Rolar de novo/ }, { timeout: 8000 }));
    await waitFor(() => expect(log()).toContain('Postura da Fortuna'), { timeout: 8000 });
    expect(log()).toMatch(/1 → 19/);
    fireEvent.click(await screen.findByRole('button', { name: /Rolar Dano/ }, { timeout: 8000 }));
    // Segundo d20 baixo na mesma rodada: sem usos → sem pergunta.
    await atacarAlvo('bruno', 1, 4, 4, 4);
    expect(screen.queryByRole('button', { name: /Rolar de novo/ })).toBeNull();
    // Nova rodada: volta a perguntar; "Manter" preserva o dado.
    useCombatStore.setState({ round: 2 } as never);
    const p = perguntarFortuna('ana', 2, 'resistencia', async () => 20);
    fireEvent.click(await screen.findByRole('button', { name: /Manter/ }));
    expect(await p).toBe(2);
    // d20 acima do treinamento não pergunta.
    expect(await perguntarFortuna('ana', bt + 1, 'resistencia', async () => 20)).toBe(bt + 1);
  });

  it('Fortuna: fora da postura não pergunta', async () => {
    mesa(esp({ posturasAprendidas: ['fortuna'] }));
    expect(await perguntarFortuna('ana', 1, 'ataque', async () => 20)).toBe(1);
  });

  it('Devastação: acertos no mesmo alvo dão acerto e ignoram RD; erro não zera; trocar de alvo zera', async () => {
    const bt = getTrainingBonusByLevel(6);
    mesa(esp({ level: 6, posturasAprendidas: ['devastacao'] }), { caio: [0, 1], davi: [1, 1] });
    useCombatStore.setState({ initiativeOrder: [{ charId: 'ana' }, { charId: 'bruno' }, { charId: 'caio' }, { charId: 'davi' }] as never });
    useCharacterStore.getState().updateCharacter('bruno', { rd: 20 } as never);
    clicar(/Entrar: Devastação/);
    await atacarAlvo('bruno', 18, 4, 4, 4);
    expect(pegarFicha('ana').devastacao).toEqual({ alvoId: 'bruno', acertos: 1 });
    await atacarAlvo('bruno', 2, 4, 4, 4); // erro
    expect(log()).toContain('+1 acerto');
    expect(pegarFicha('ana').devastacao?.acertos).toBe(1);
    const hp = pegarFicha('bruno').hpCurrent;
    await atacarAlvo('bruno', 18, 6, 6, 6);
    expect(log()).toContain('ignora 2 de RD');
    const dano = Number(/💥 Dano: (\d+)/.exec(log())![1]);
    expect(hp - pegarFicha('bruno').hpCurrent).toBe(Math.max(0, dano - 18));
    for (let i = 0; i < 5; i++) await atacarAlvo('bruno', 18, 4, 4, 4);
    expect(pegarFicha('ana').devastacao?.acertos).toBe(bt); // limite
    await atacarAlvo('caio', 18, 4, 4, 4);
    expect(pegarFicha('ana').devastacao).toEqual({ alvoId: 'caio', acertos: 1 });
    expect(log()).toContain('trocou de alvo');
  });

  it('Devastação: rerrolar o ataque ajusta o acúmulo pelo resultado final', { timeout: 20000 }, async () => {
    mesa(esp({ level: 6, posturasAprendidas: ['devastacao'] }));
    clicar(/Entrar: Devastação/);
    alvo('bruno');
    // 1º ataque erra (d20 2); a rerrolagem acerta (d20 18) → acumula 1.
    forcarDados(2, 18, 4, 4, 4);
    clicar(/Rolar Ataque/);
    fireEvent.click(await screen.findByRole('button', { name: /Rerolar Ataque/ }, { timeout: 8000 }));
    fireEvent.click(await screen.findByRole('button', { name: /Rolar Dano/ }, { timeout: 8000 }));
    await waitFor(() => expect(log()).toMatch(/💥 Dano:/), { timeout: 8000 });
    expect(pegarFicha('ana').devastacao).toEqual({ alvoId: 'bruno', acertos: 1 });
    expect(log()).toContain('a rerrolagem acertou');
    // 2º ataque acerta (acúmulo 1→2); a rerrolagem erra → perde só o acerto da rerrolagem (volta a 1).
    useCharacterStore.getState().updateCharacter('ana', { attacksThisTurn: 0, actionsCurrent: 1 } as never);
    alvo('bruno');
    forcarDados(18, 2);
    clicar(/Rolar Ataque/);
    await waitFor(() => expect(pegarFicha('ana').devastacao?.acertos).toBe(2), { timeout: 8000 });
    fireEvent.click(await screen.findByRole('button', { name: /Rerolar Ataque/ }, { timeout: 8000 }));
    await waitFor(() => expect(pegarFicha('ana').devastacao?.acertos).toBe(1), { timeout: 8000 });
    expect(log()).toContain('a rerrolagem errou');
  });

  it('Tempestade: acerto → Fortitude ou Caído; já Caído → Imóvel até o começo do turno do Especialista; passar não faz nada', async () => {
    mesa(esp({ level: 10, posturasAprendidas: ['tempestade'] }), { caio: [0, 1], davi: [1, 1] });
    useCombatStore.setState({ initiativeOrder: [{ charId: 'ana' }, { charId: 'bruno' }, { charId: 'caio' }, { charId: 'davi' }] as never });
    clicar(/Entrar: Tempestade/);
    await atacarAlvo('bruno', 19, 1, 1, 1, 1);
    await waitFor(() => expect(cond('bruno')).toContain('caido'));
    expect(log()).toContain('Postura da Tempestade: bruno');
    await atacarAlvo('bruno', 19, 1, 1, 1, 1);
    await waitFor(() => expect(cond('bruno')).toContain('imovel'));
    useCombatStore.getState().nextTurn(); // turno de bruno: continua Imóvel
    expect(cond('bruno')).toContain('imovel');
    useCombatStore.getState().nextTurn(); useCombatStore.getState().nextTurn();
    expect(cond('bruno')).toContain('imovel');
    useCombatStore.getState().nextTurn(); // começo do turno de ana: Imóvel acaba
    await waitFor(() => expect(cond('bruno')).not.toContain('imovel'));
    useCharacterStore.getState().updateCharacter('caio', { attributes: [{ id: 'c', name: 'Constituição', value: 30 }] } as never);
    await atacarAlvo('caio', 19, 20, 20, 20, 20);
    await waitFor(() => expect(log()).toContain('caio Fortitude'));
    expect(cond('caio')).not.toContain('caido');
    await atacarAlvo('davi', 2, 1, 1, 1); // errou: sem teste
    expect(log()).not.toContain('davi Fortitude');
  });

  it('Céu: alcance dobrado, +2 em perícias, 2 preparo temporários por turno que não acumulam', () => {
    mesa(esp({ level: 12, posturasAprendidas: ['ceu'], preparoCurrent: 5 }));
    expect(posturaAlcanceMult(pegarFicha('ana'))).toBe(1);
    clicar(/Entrar: Céu/);
    expect(posturaAlcanceMult(pegarFicha('ana'))).toBe(2);
    expect(posturaPericia(pegarFicha('ana'))).toBe(2);
    useCombatStore.getState().nextTurn(); useCombatStore.getState().nextTurn(); // começo do turno de ana
    expect(pegarFicha('ana').preparoTemp).toBe(2);
    expect(getPreparoAtual(pegarFicha('ana'))).toBe(7);
    expect(spendPreparo('ana', 3).ok).toBe(true); // gasta os 2 temporários primeiro
    expect(pegarFicha('ana').preparoTemp).toBe(0);
    expect(pegarFicha('ana').preparoCurrent).toBe(4);
    useCombatStore.getState().nextTurn(); useCombatStore.getState().nextTurn();
    expect(pegarFicha('ana').preparoTemp).toBe(2);
    useCombatStore.getState().nextTurn(); useCombatStore.getState().nextTurn();
    expect(pegarFicha('ana').preparoTemp).toBe(2); // não acumula
    expect(posturaPericia(esp())).toBe(0);
  });

  it('Céu: ataque alcança o dobro da distância no mapa', () => {
    mesa(esp({ level: 12, posturasAprendidas: ['ceu'] }), { bruno: [2, 0] });
    alvo('bruno');
    expect(screen.getByText(/fora de alcance/)).toBeTruthy();
    clicar(/Entrar: Céu/);
    expect(screen.queryByText(/fora de alcance/)).toBeNull();
  });
});
