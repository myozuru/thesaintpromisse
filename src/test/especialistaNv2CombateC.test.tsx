// @vitest-environment jsdom
/**
 * Especialista em Combate (nv 2) em combate real: Pistoleiro Iniciado,
 * Posicionamento Ameaçador e Precisão Definitiva. Peças no mapa, alvo
 * selecionado e cliques reais nos botões da ficha.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async (orig) => {
  const real = await orig<Record<string, unknown>>();
  return Object.fromEntries(Object.keys(real).map((k) => [k, () => {}]));
});
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import type { Character } from '@/types';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { precisaoPeMax, precisaoBonus } from '@/lib/precisaoDefinitiva';
import { penalidadeTRFlanqueado } from '@/lib/flanqueadorSuperior';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados } from './helpers/mesaReal';

const PIST = [{ abilityId: 'ec-pistoleiro-iniciado', chosenAtLevel: 2 }];
const PREC = [{ abilityId: 'ec-precisao-definitiva', chosenAtLevel: 2 }];
const POS = [{ abilityId: 'ec-posicionamento-ameacador', chosenAtLevel: 2 }];
const FLANQ = [{ abilityId: 'ec-flanqueador-superior', chosenAtLevel: 2 }];

const esp = (extra: Record<string, unknown> = {}) => ficha('ana', {
  profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  level: 4, peCurrent: 20, peMax: 20,
  mainHandWeaponName: 'Pistola', offHandWeaponName: null,
  meleeTrained: true, rangedTrained: true,
  attributes: [{ name: 'FOR', value: 14 }, { name: 'DES', value: 14 }, { name: 'CON', value: 12 }, { name: 'SAB', value: 12 }],
  chosenSpecAbilities: [], attacksThisTurn: 0, weaponSwapsThisTurn: 0,
  reactionsCurrent: 1, reactionsMax: 1,
  bonusActionsCurrent: 1, bonusActionsMax: 1, ...extra,
} as never);
const inimigo = (extra: Record<string, unknown> = {}) => ficha('bruno', {
  category: 'INIMIGO', hpCurrent: 300, hpMax: 300, escCurrent: 0, rd: 0, defense: 10,
  attributes: [{ name: 'CON', value: 10 }, { name: 'INT', value: 10 }], ...extra,
} as never);
const aliado = () => ficha('caio', { category: 'PLAYER', hpCurrent: 30, hpMax: 30 } as never);

const textoLog = () => useLogStore.getState().logs.map((l) => l.message).join('\n');

function mesa(c: Character, outros: Character[], posicoes: Record<string, [number, number]>) {
  useLogStore.getState().clearLogs();
  montarMesa([c, ...outros], posicoes);
  useCombatStore.setState({
    inCombat: true, round: 1,
    initiativeOrder: [{ charId: 'ana' }, { charId: 'bruno' }] as never,
    currentTurnIndex: 0,
  } as never);
}

function abrirPainel(id = 'ana', alvo: string | null = 'bruno') {
  cleanup();
  render(<AttackPanel character={pegarFicha(id)} />);
  if (!alvo) return;
  const sel = screen.getAllByRole('combobox').find((s) =>
    Array.from((s as HTMLSelectElement).options).some((o) => o.value === alvo)) as HTMLSelectElement;
  fireEvent.change(sel, { target: { value: alvo } });
}

/** Rola ataque e, se houver dano, rola o dano. */
async function atacar(...dados: number[]) {
  useLogStore.getState().clearLogs();
  forcarDados(...(dados.length ? dados : [18, 4, 4, 4, 4, 4]));
  fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
  await waitFor(() => expect(textoLog()).toMatch(/🎲|EMPERROU|emperrou|Ataque/), { timeout: 15000 });
  const btn = screen.queryAllByRole('button', { name: /Rolar Dano/ });
  if (btn.length) {
    fireEvent.click(btn[0]);
    await waitFor(() => expect(textoLog()).toMatch(/💥 Dano:/), { timeout: 15000 });
  }
}

class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= RO;

beforeEach(() => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => {
  cleanup(); limparMesa();
  useCombatStore.setState({ inCombat: false, initiativeOrder: [] } as never);
});

describe('Pistoleiro Iniciado', () => {
  it('sem declarar: d20 2 com pistola NÃO emperra', async () => {
    mesa(esp({ chosenSpecAbilities: PIST }), [inimigo()], { ana: [0, 0], bruno: [4, 0] });
    abrirPainel();
    await atacar(2, 4, 4, 4);
    expect(textoLog()).not.toMatch(/EMPERROU/);
    expect(pegarFicha('ana').armaEmperrada ?? null).toBeNull();
  }, 20000);

  it('1 natural emperra a arma de fogo mesmo sem declarar (regra base)', async () => {
    mesa(esp({ chosenSpecAbilities: PIST }), [inimigo()], { ana: [0, 0], bruno: [4, 0] });
    abrirPainel();
    await atacar(1, 4, 4, 4);
    expect(textoLog()).toMatch(/EMPERROU|emperrou/);
    expect(pegarFicha('ana').armaEmperrada).toBe('Pistola');
  }, 20000);

  it('declarado: d20 3 emperra, o ataque falha e a arma trava até desemperrar', async () => {
    mesa(esp({ chosenSpecAbilities: PIST }), [inimigo()], { ana: [0, 0], bruno: [4, 0] });
    abrirPainel();
    fireEvent.click(screen.getByTestId('pistoleiro-iniciado').querySelector('button')!);
    await atacar(3, 4, 4, 4);
    const t = textoLog();
    expect(t).toMatch(/EMPERROU|emperrou/);
    expect(t).not.toMatch(/💥 Dano:/);
    expect(pegarFicha('ana').armaEmperrada).toBe('Pistola');

    // Nova tentativa é bloqueada enquanto a arma estiver emperrada.
    abrirPainel();
    useLogStore.getState().clearLogs();
    forcarDados(18, 4, 4, 4);
    fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
    await waitFor(() => expect(textoLog()).toMatch(/está emperrada/), { timeout: 5000 });

    // Ação Comum para desemperrar libera a arma.
    fireEvent.click(screen.getByTestId('desemperrar-arma'));
    expect(pegarFicha('ana').armaEmperrada ?? null).toBeNull();
    expect(textoLog()).toMatch(/desemperra Pistola/);
  }, 30000);

  it('declarado e acertando: +1 dado de dano', async () => {
    mesa(esp({ chosenSpecAbilities: PIST }), [inimigo()], { ana: [0, 0], bruno: [4, 0] });
    abrirPainel();
    fireEvent.click(screen.getByTestId('pistoleiro-iniciado').querySelector('button')!);
    await atacar(18, 5, 5, 5, 5);
    expect(textoLog()).toMatch(/Pistoleiro Iniciado: \+1 dado de dano/);
  }, 20000);

  it('sem a habilidade, o painel não aparece', async () => {
    mesa(esp(), [inimigo()], { ana: [0, 0], bruno: [4, 0] });
    abrirPainel();
    expect(screen.queryByTestId('pistoleiro-iniciado')).toBeNull();
  });
});

describe('Precisão Definitiva', () => {
  it('máximo de PE cresce a cada 4 níveis', () => {
    expect(precisaoPeMax(esp({ chosenSpecAbilities: PREC, level: 1 }))).toBe(1);
    expect(precisaoPeMax(esp({ chosenSpecAbilities: PREC, level: 4 }))).toBe(2);
    expect(precisaoPeMax(esp({ chosenSpecAbilities: PREC, level: 8 }))).toBe(3);
    expect(precisaoPeMax(esp({ chosenSpecAbilities: PREC, level: 20 }))).toBe(6);
    expect(precisaoBonus(2, 'acerto')).toBe(4);
    expect(precisaoBonus(2, 'dano')).toBe(8);
  });

  it('2 PE no acerto: gasta os PE e soma +4 na jogada', async () => {
    mesa(esp({ chosenSpecAbilities: PREC }), [inimigo()], { ana: [0, 0], bruno: [4, 0] });
    abrirPainel();
    fireEvent.change(screen.getByTestId('precisao-pe'), { target: { value: '2' } });
    await atacar(10, 4, 4, 4);
    const t = textoLog();
    expect(t).toMatch(/Precisão Definitiva: 2 PE → \+4 no acerto/);
    expect(pegarFicha('ana').peCurrent).toBe(18);
  }, 20000);

  it('modo dano: 1 PE vira +4 no dano', async () => {
    mesa(esp({ chosenSpecAbilities: PREC }), [inimigo()], { ana: [0, 0], bruno: [4, 0] });
    abrirPainel();
    fireEvent.change(screen.getByTestId('precisao-pe'), { target: { value: '1' } });
    fireEvent.change(screen.getByTestId('precisao-modo'), { target: { value: 'dano' } });
    await atacar(18, 4, 4, 4);
    expect(textoLog()).toMatch(/Precisão Definitiva: 1 PE → \+4 no dano/);
    expect(pegarFicha('ana').peCurrent).toBe(19);
  }, 20000);

  it('sem PE suficiente, o ataque é barrado e nada é gasto', async () => {
    mesa(esp({ chosenSpecAbilities: PREC, peCurrent: 0 }), [inimigo()], { ana: [0, 0], bruno: [4, 0] });
    abrirPainel();
    fireEvent.change(screen.getByTestId('precisao-pe'), { target: { value: '2' } });
    useLogStore.getState().clearLogs();
    forcarDados(18, 4, 4, 4);
    fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
    await waitFor(() => expect(textoLog()).toMatch(/PE insuficiente/), { timeout: 5000 });
    expect(pegarFicha('ana').peCurrent).toBe(0);
  }, 20000);
});

describe('Posicionamento Ameaçador', () => {
  const grid = () => ({ cellSize: useMapStore.getState().cellSize ?? 50, metersPerCell: useMapStore.getState().metersPerCell ?? 1.5 });
  const pen = () => penalidadeTRFlanqueado(
    pegarFicha('bruno'),
    useCharacterStore.getState().characters,
    useMapStore.getState().entities as never,
    grid() as never,
  );

  it('com arma de fogo no 1º alcance e aliado adjacente: alvo recebe −2 em TR', () => {
    mesa(esp({ chosenSpecAbilities: [...POS, ...FLANQ] }), [inimigo(), aliado()],
      { ana: [0, 0], bruno: [4, 0], caio: [5, 0] });
    expect(pen()).toBe(-2);
  });

  it('sem Posicionamento Ameaçador, atirar de longe não flanqueia', () => {
    mesa(esp({ chosenSpecAbilities: FLANQ }), [inimigo(), aliado()],
      { ana: [0, 0], bruno: [4, 0], caio: [5, 0] });
    expect(pen()).toBe(0);
  });

  it('sem aliado adjacente ao alvo, não há flanco', () => {
    mesa(esp({ chosenSpecAbilities: [...POS, ...FLANQ] }), [inimigo(), aliado()],
      { ana: [0, 0], bruno: [4, 0], caio: [0, 1] });
    expect(pen()).toBe(0);
  });

  it('furtivo (peça escondida) perde o flanco', () => {
    mesa(esp({ chosenSpecAbilities: [...POS, ...FLANQ] }), [inimigo(), aliado()],
      { ana: [0, 0], bruno: [4, 0], caio: [5, 0] });
    expect(pen()).toBe(-2);
    const ents = useMapStore.getState().entities;
    const anaEnt = Object.values(ents).find((e) => (e as { characterId?: string })?.characterId === 'ana') as { id: string };
    useMapStore.setState({ entities: { ...ents, [anaEnt.id]: { ...ents[anaEnt.id], hidden: true } } } as never);
    expect(pen()).toBe(0);
  });

  it('arma corpo a corpo longe do alvo não concede flanco', () => {
    mesa(esp({ chosenSpecAbilities: [...POS, ...FLANQ], mainHandWeaponName: 'Espada Curta' }),
      [inimigo(), aliado()], { ana: [0, 0], bruno: [4, 0], caio: [5, 0] });
    expect(pen()).toBe(0);
  });
});
