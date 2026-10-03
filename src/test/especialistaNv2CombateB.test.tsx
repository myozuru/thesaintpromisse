import { selecionarAlvoNoMapaUI } from './helpers/alvoMapaUI';
// @vitest-environment jsdom
/**
 * Especialista em Combate (nv 2) em combate real: Golpe Falso,
 * Golpes Potentes e Indomável. Peças no mapa, alvo selecionado e
 * cliques reais nos botões.
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
import { TestRequestOverlay } from '@/components/fichas/TestRequestOverlay';
import { IndomavelPrompt } from '@/components/fichas/IndomavelPrompt';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { useLogStore } from '@/stores/useLogStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { indomavelUsosMax, indomavelUsosRestantes, indomavelElegivel, hasIndomavel } from '@/lib/indomavel';
import { golpeFalsoAlcanceM, golpeFalsoPodeUsar } from '@/lib/golpeFalso';
import { peekAdvantageFor } from '@/lib/omni/rollAdvantage';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados } from './helpers/mesaReal';

const GF = [{ abilityId: 'ec-golpe-falso', chosenAtLevel: 2 }];
const GP = [{ abilityId: 'ec-golpes-potentes', chosenAtLevel: 2 }];
const AP = [{ abilityId: 'ec-arremessos-potentes', chosenAtLevel: 2 }];
const IND = [{ abilityId: 'ec-indomavel', chosenAtLevel: 2 }];

const esp = (extra: Record<string, unknown> = {}) => ficha('ana', {
  profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  level: 4, peCurrent: 20, peMax: 20,
  mainHandWeaponName: 'Espada Curta', offHandWeaponName: null,
  meleeTrained: true, rangedTrained: true,
  attributes: [{ name: 'FOR', value: 14 }, { name: 'DES', value: 14 }, { name: 'CON', value: 12 }, { name: 'SAB', value: 12 }],
  chosenSpecAbilities: [], attacksThisTurn: 0, weaponSwapsThisTurn: 0,
  reactionsCurrent: 1, reactionsMax: 1,
  bonusActionsCurrent: 1, bonusActionsMax: 1, ...extra,
} as never);
const inimigo = (extra: Record<string, unknown> = {}) => ficha('bruno', {
  category: 'INIMIGO', hpCurrent: 300, hpMax: 300, escCurrent: 0, rd: 0,
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

async function abrirPainel(id = 'ana', alvo: string | null = 'bruno') {
  cleanup();
  render(<AttackPanel character={pegarFicha(id)} />);
  if (!alvo) return;
  await selecionarAlvoNoMapaUI(alvo);
}

async function atacar(...dados: number[]) {
  useLogStore.getState().clearLogs();
  forcarDados(...(dados.length ? dados : [18, 4, 4, 4, 4, 4]));
  fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
  const btn = await screen.findAllByRole('button', { name: /Rolar Dano/ }).catch(() => []);
  if (btn.length) fireEvent.click(btn[0]);
  await waitFor(() => expect(textoLog()).toMatch(/💥 Dano:/), { timeout: 15000 });
}

class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= RO;

beforeEach(async () => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => {
  cleanup(); limparMesa();
  useCombatStore.setState({ inCombat: false, initiativeOrder: [] } as never);
});

describe('Golpes Potentes', () => {
  it('arma treinada: +1 nível de dano e +2 no dano', async () => {
    mesa(esp({ chosenSpecAbilities: GP }), [inimigo()], { ana: [0, 0], bruno: [1, 0] });
    await abrirPainel();
    await atacar();
    expect(textoLog()).toMatch(/Golpes Potentes: \+1 nível de dano, \+2 dano/);
  }, 20000);

  it('sem a habilidade, nada muda', async () => {
    mesa(esp(), [inimigo()], { ana: [0, 0], bruno: [1, 0] });
    await abrirPainel();
    await atacar();
    expect(textoLog()).not.toMatch(/Golpes Potentes/);
  }, 20000);

  it('acumula com Arremessos Potentes em arma de arremesso treinada', async () => {
    mesa(
      esp({ chosenSpecAbilities: [...GP, ...AP], mainHandWeaponName: 'Faca de Arremesso' }),
      [inimigo()],
      { ana: [0, 0], bruno: [2, 0] },
    );
    await abrirPainel();
    await atacar();
    const t = textoLog();
    expect(t).toMatch(/Golpes Potentes/);
    expect(t).toMatch(/Arremessos Potentes/);
  }, 20000);
});

describe('Golpe Falso', () => {
  it('inimigo ao alcance falha no TR: aliado ganha vantagem e a reação é gasta', async () => {
    mesa(esp({ chosenSpecAbilities: GF }), [inimigo(), aliado()], { ana: [0, 0], bruno: [1, 0], caio: [0, 1] });
    await abrirPainel();
    useLogStore.getState().clearLogs();
    forcarDados(1); // TR de Astúcia do inimigo: falha certa
    fireEvent.change(screen.getByLabelText('Aliado que vai atacar'), { target: { value: 'caio' } });
    fireEvent.change(screen.getByLabelText('Inimigo atacado'), { target: { value: 'bruno' } });
    fireEvent.click(screen.getByTestId('golpe-falso-usar'));
    await waitFor(() => expect(textoLog()).toMatch(/Golpe Falso.*FALHA/s), { timeout: 15000 });
    expect(pegarFicha('ana').reactionsCurrent).toBe(0);
    expect(peekAdvantageFor('caio', { kind: 'attack', subtype: 'melee' })).toBe('advantage');
  }, 20000);

  it('inimigo passa no TR: reação gasta, mas sem vantagem', async () => {
    mesa(esp({ chosenSpecAbilities: GF }), [inimigo({ attributes: [{ name: 'INT', value: 20 }] }), aliado()],
      { ana: [0, 0], bruno: [1, 0], caio: [0, 1] });
    await abrirPainel();
    useLogStore.getState().clearLogs();
    forcarDados(20);
    fireEvent.change(screen.getByLabelText('Aliado que vai atacar'), { target: { value: 'caio' } });
    fireEvent.change(screen.getByLabelText('Inimigo atacado'), { target: { value: 'bruno' } });
    fireEvent.click(screen.getByTestId('golpe-falso-usar'));
    await waitFor(() => expect(textoLog()).toMatch(/Golpe Falso.*SUCESSO/s), { timeout: 15000 });
    expect(pegarFicha('ana').reactionsCurrent).toBe(0);
    expect(peekAdvantageFor('caio', { kind: 'attack', subtype: 'melee' })).toBe('normal');
  }, 20000);

  it('inimigo fora do alcance da arma empunhada não pode ser alvo', async () => {
    mesa(esp({ chosenSpecAbilities: GF }), [inimigo(), aliado()], { ana: [0, 0], bruno: [4, 0], caio: [0, 1] });
    expect(golpeFalsoAlcanceM(pegarFicha('ana'))).toBe(1.5);
    const r = golpeFalsoPodeUsar('ana', 'caio', 'bruno');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/fora do alcance/);
  });

  it('sem reação disponível não dá para usar', async () => {
    mesa(esp({ chosenSpecAbilities: GF, reactionsCurrent: 0 }), [inimigo(), aliado()],
      { ana: [0, 0], bruno: [1, 0], caio: [0, 1] });
    expect(golpeFalsoPodeUsar('ana', 'caio', 'bruno').reason).toMatch(/Sem reação/);
  });

  it('sem a habilidade, a seção não aparece', async () => {
    mesa(esp(), [inimigo(), aliado()], { ana: [0, 0], bruno: [1, 0], caio: [0, 1] });
    await abrirPainel();
    expect(screen.queryByTestId('golpe-falso-secao')).toBeNull();
  });
});

describe('Indomável', () => {
  it('usos = metade do nível (mínimo 1) e exige 1 PE', async () => {
    mesa(esp({ chosenSpecAbilities: IND, level: 7 }), [inimigo()], { ana: [0, 0], bruno: [1, 0] });
    const c = pegarFicha('ana');
    expect(hasIndomavel(c)).toBe(true);
    expect(indomavelUsosMax(c)).toBe(3);
    expect(indomavelUsosRestantes(c)).toBe(3);
    expect(indomavelElegivel(c)).toBe(true);

    useCharacterStore.getState().updateCharacter('ana', { peCurrent: 0 } as never);
    expect(indomavelElegivel(pegarFicha('ana'))).toBe(false);

    useCharacterStore.getState().updateCharacter('ana', {
      peCurrent: 5, specAbilityUsage: { 'ec-indomavel': 3 },
    } as never);
    expect(indomavelUsosRestantes(pegarFicha('ana'))).toBe(0);
    expect(indomavelElegivel(pegarFicha('ana'))).toBe(false);
  });

  it('nível 1 ainda tem 1 uso', async () => {
    mesa(esp({ chosenSpecAbilities: IND, level: 1 }), [inimigo()], { ana: [0, 0], bruno: [1, 0] });
    expect(indomavelUsosMax(pegarFicha('ana'))).toBe(1);
  });

  it('sem a habilidade não fica elegível', async () => {
    mesa(esp(), [inimigo()], { ana: [0, 0], bruno: [1, 0] });
    expect(indomavelElegivel(pegarFicha('ana'))).toBe(false);
  });

  it('falhou num TR pedido pelo Mestre: pergunta, gasta 1 PE e fica com o melhor d20', async () => {
    mesa(esp({ chosenSpecAbilities: IND }), [inimigo()], { ana: [0, 0], bruno: [1, 0] });
    useTestRequestStore.getState().clearAll();
    useTestRequestStore.getState().enqueue({
      charId: 'ana', charName: 'ana', targetProfileId: 'p-ana',
      kind: 'save', testName: 'Fortitude', dc: 20,
    } as never);
    cleanup();
    render(<><TestRequestOverlay /><IndomavelPrompt /></>);
    forcarDados(2, 19);
    fireEvent.click(await screen.findByRole('button', { name: /Rolar/ }, { timeout: 15000 }));
    fireEvent.click(await screen.findByTestId('indomavel-sim', undefined, { timeout: 15000 }));
    await waitFor(() => expect(textoLog()).toMatch(/Indomável/), { timeout: 15000 });
    expect(textoLog()).toMatch(/2 → 19/);
    const c = pegarFicha('ana');
    expect(c.peCurrent).toBe(19);
    expect(indomavelUsosRestantes(c)).toBe(1);
    await waitFor(() => {
      expect(useTestRequestStore.getState().requests[0].result?.d20).toBe(19);
    }, { timeout: 15000 });
  }, 25000);

  it('recusar mantém a falha, o PE e o uso', async () => {
    mesa(esp({ chosenSpecAbilities: IND }), [inimigo()], { ana: [0, 0], bruno: [1, 0] });
    useTestRequestStore.getState().clearAll();
    useTestRequestStore.getState().enqueue({
      charId: 'ana', charName: 'ana', targetProfileId: 'p-ana',
      kind: 'save', testName: 'Fortitude', dc: 20,
    } as never);
    cleanup();
    render(<><TestRequestOverlay /><IndomavelPrompt /></>);
    forcarDados(2, 19);
    fireEvent.click(await screen.findByRole('button', { name: /Rolar/ }, { timeout: 15000 }));
    fireEvent.click(await screen.findByTestId('indomavel-nao', undefined, { timeout: 15000 }));
    await waitFor(() => {
      expect(useTestRequestStore.getState().requests[0].result?.d20).toBe(2);
    }, { timeout: 15000 });
    const c = pegarFicha('ana');
    expect(c.peCurrent).toBe(20);
    expect(indomavelUsosRestantes(c)).toBe(2);
  }, 25000);
});
