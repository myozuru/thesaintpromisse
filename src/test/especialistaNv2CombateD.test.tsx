// @vitest-environment jsdom
/**
 * Especialista em Combate (nv 2) em combate real: Presença Suprimida,
 * Revigorar e Tiro Falso. Peças no mapa e cliques reais na ficha.
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
import {
  penalidadeChamativa, presencaSuprimidaBonus, ehFurtividade,
} from '@/lib/presencaSuprimida';
import {
  revigorarDados, revigorarBonus, revigorarUsosMax, revigorarUsosRestantes,
  revigorarPatchDescansoCurto, revigorarPodeUsar,
} from '@/lib/revigorar';
import { tiroFalsoAlcanceM, tiroFalsoPodeUsar, tiroFalsoDisponiveisPara } from '@/lib/tiroFalso';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados } from './helpers/mesaReal';

const PRESENCA = [{ abilityId: 'ec-presenca-suprimida', chosenAtLevel: 2 }];
const REVIG = [{ abilityId: 'ec-revigorar', chosenAtLevel: 2 }];
const TIRO = [{ abilityId: 'ec-tiro-falso', chosenAtLevel: 2 }];

const esp = (extra: Record<string, unknown> = {}) => ficha('ana', {
  profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  level: 4, peCurrent: 20, peMax: 20, hpCurrent: 10, hpMax: 40,
  mainHandWeaponName: 'Pistola', offHandWeaponName: null,
  meleeTrained: true, rangedTrained: true,
  attributes: [
    { name: 'FOR', value: 14 }, { name: 'DES', value: 14 },
    { name: 'Constituição', value: 16 }, { name: 'SAB', value: 12 },
  ],
  skills: [{ id: 's1', name: 'Furtividade', value: 0 }],
  chosenSpecAbilities: [], attacksThisTurn: 0,
  reactionsCurrent: 1, reactionsMax: 1,
  bonusActionsCurrent: 1, bonusActionsMax: 1, ...extra,
} as never);
const inimigo = (extra: Record<string, unknown> = {}) => ficha('bruno', {
  category: 'INIMIGO', hpCurrent: 300, hpMax: 300, rd: 0, defense: 10,
  attributes: [{ name: 'CON', value: 10 }, { name: 'Astúcia', value: 10 }], ...extra,
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

function abrirPainel(id = 'ana') {
  cleanup();
  render(<AttackPanel character={pegarFicha(id)} />);
}

class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= RO;

beforeEach(() => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => {
  cleanup(); limparMesa();
  useCombatStore.setState({ inCombat: false, initiativeOrder: [] } as never);
});

describe('Presença Suprimida', () => {
  it('reconhece a perícia mesmo sem acento e ignora outras', () => {
    expect(ehFurtividade('Furtividade')).toBe(true);
    expect(ehFurtividade('furtividade ')).toBe(true);
    expect(ehFurtividade('Atletismo')).toBe(false);
  });

  it('+2 em Furtividade só com a habilidade', () => {
    const com = esp({ chosenSpecAbilities: PRESENCA });
    const sem = esp();
    expect(presencaSuprimidaBonus(com, 'Furtividade')).toBe(2);
    expect(presencaSuprimidaBonus(com, 'Atletismo')).toBe(0);
    expect(presencaSuprimidaBonus(sem, 'Furtividade')).toBe(0);
  });

  it('penalidade chamativa cai de −10 para −5', () => {
    expect(penalidadeChamativa(esp())).toBe(-10);
    expect(penalidadeChamativa(esp({ chosenSpecAbilities: PRESENCA }))).toBe(-5);
  });
});

describe('Revigorar', () => {
  it('quantidade de dados sobe nos níveis 4, 8, 12, 16 e 20', () => {
    expect(revigorarDados(1)).toBe(1);
    expect(revigorarDados(3)).toBe(1);
    expect(revigorarDados(4)).toBe(2);
    expect(revigorarDados(8)).toBe(3);
    expect(revigorarDados(20)).toBe(6);
  });

  it('bônus = 2× Mod. CON + bônus de treinamento', () => {
    const c = esp({ chosenSpecAbilities: REVIG });
    expect(revigorarBonus(c)).toBe(2 * 3 + revigorarUsosMax(c));
  });

  it('cura de verdade em combate, gastando ação bônus e 1 uso', async () => {
    mesa(esp({ chosenSpecAbilities: REVIG }), [inimigo()], { ana: [0, 0], bruno: [4, 0] });
    abrirPainel();
    const antes = pegarFicha('ana').hpCurrent;
    forcarDados(6, 6, 6);
    fireEvent.click(screen.getByTestId('revigorar-usar'));
    await waitFor(() => expect(textoLog()).toMatch(/usa Revigorar/), { timeout: 15000 });
    const dep = pegarFicha('ana');
    expect(dep.hpCurrent).toBeGreaterThan(antes);
    expect(dep.bonusActionsCurrent).toBe(0);
    expect(revigorarUsosRestantes(dep)).toBe(revigorarUsosMax(dep) - 1);
  }, 20000);

  it('sem ação bônus ou sem usos, o botão fica bloqueado', () => {
    const semAcao = esp({ chosenSpecAbilities: REVIG, bonusActionsCurrent: 0 });
    expect(revigorarPodeUsar(semAcao).ok).toBe(false);
    const semUsos = esp({
      chosenSpecAbilities: REVIG,
      specAbilityUsage: { 'ec-revigorar': revigorarUsosMax(esp()) },
    });
    expect(revigorarPodeUsar(semUsos).ok).toBe(false);
  });

  it('descanso curto devolve metade dos usos (para baixo)', () => {
    const c = esp({ chosenSpecAbilities: REVIG, specAbilityUsage: { 'ec-revigorar': 2 } });
    const max = revigorarUsosMax(c);
    expect(revigorarPatchDescansoCurto(c)).toBe(Math.max(0, 2 - Math.floor(max / 2)));
  });
});

describe('Tiro Falso', () => {
  it('exige arma à distância ou de fogo', () => {
    expect(tiroFalsoAlcanceM(esp({ chosenSpecAbilities: TIRO }))).toBeGreaterThan(0);
    expect(tiroFalsoAlcanceM(esp({ chosenSpecAbilities: TIRO, mainHandWeaponName: 'Espada Curta' }))).toBeNull();
  });

  it('inimigo dentro do alcance: reação gasta e aliado ganha vantagem na falha', async () => {
    mesa(esp({ chosenSpecAbilities: TIRO }), [inimigo(), aliado()], { ana: [0, 0], bruno: [4, 0], caio: [3, 0] });
    abrirPainel();
    fireEvent.change(screen.getByLabelText(/Aliado que vai atacar/), { target: { value: 'caio' } });
    fireEvent.change(screen.getByLabelText(/Inimigo atacado/), { target: { value: 'bruno' } });
    forcarDados(2);
    fireEvent.click(screen.getByTestId('tiro-falso-usar'));
    await waitFor(() => expect(textoLog()).toMatch(/Tiro Falso/), { timeout: 15000 });
    expect(textoLog()).toMatch(/FALHA/);
    expect(pegarFicha('ana').reactionsCurrent).toBe(0);
    const mods = JSON.stringify((pegarFicha('caio') as unknown as Record<string, unknown>).omniAdvMods ?? {});
    expect(mods).toMatch(/advantage/);
  }, 20000);

  it('sucesso no TR não dá vantagem, mas gasta a reação', async () => {
    mesa(esp({ chosenSpecAbilities: TIRO }), [inimigo(), aliado()], { ana: [0, 0], bruno: [4, 0], caio: [3, 0] });
    abrirPainel();
    fireEvent.change(screen.getByLabelText(/Aliado que vai atacar/), { target: { value: 'caio' } });
    fireEvent.change(screen.getByLabelText(/Inimigo atacado/), { target: { value: 'bruno' } });
    forcarDados(20);
    fireEvent.click(screen.getByTestId('tiro-falso-usar'));
    await waitFor(() => expect(textoLog()).toMatch(/SUCESSO/), { timeout: 15000 });
    expect(pegarFicha('ana').reactionsCurrent).toBe(0);
    const mods = JSON.stringify((pegarFicha('caio') as unknown as Record<string, unknown>).omniAdvMods ?? {});
    expect(mods).not.toMatch(/advantage/);
  }, 20000);

  it('fora do alcance da arma, a reação é bloqueada', () => {
    mesa(esp({ chosenSpecAbilities: TIRO }), [inimigo(), aliado()], { ana: [0, 0], bruno: [200, 0], caio: [3, 0] });
    const r = tiroFalsoPodeUsar('ana', 'caio', 'bruno');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/fora do alcance/);
  });

  it('sem reação disponível não é possível usar', () => {
    mesa(esp({ chosenSpecAbilities: TIRO, reactionsCurrent: 0 }), [inimigo(), aliado()], { ana: [0, 0], bruno: [4, 0], caio: [3, 0] });
    expect(tiroFalsoPodeUsar('ana', 'caio', 'bruno').ok).toBe(false);
    expect(tiroFalsoDisponiveisPara('caio', 'bruno')).toHaveLength(0);
  });

  it('o aliado vê o aviso de que há Tiro Falso disponível', () => {
    mesa(esp({ chosenSpecAbilities: TIRO }), [inimigo(), aliado()], { ana: [0, 0], bruno: [4, 0], caio: [3, 0] });
    expect(tiroFalsoDisponiveisPara('caio', 'bruno').map((x) => x.id)).toEqual(['ana']);
  });
});
