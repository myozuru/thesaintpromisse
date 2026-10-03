import { selecionarAlvoNoMapaUI } from './helpers/alvoMapaUI';
// @vitest-environment jsdom
/**
 * Especialista em Combate (nv 2) em combate real: Extensão do Corpo,
 * Disparos Sincronizados e Flanqueador Superior. Peças no mapa, alvo
 * selecionado e cliques reais nos botões do Painel de Ataque.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import type { Character } from '@/types';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { penalidadeTRFlanqueado, estaFlanqueando } from '@/lib/flanqueadorSuperior';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados } from './helpers/mesaReal';

const EXT = [{ abilityId: 'ec-extensao-corpo', chosenAtLevel: 2 }];
const DIS = [{ abilityId: 'ec-disparos-sincronizados', chosenAtLevel: 2 }];
const FLA = [{ abilityId: 'ec-flanqueador-superior', chosenAtLevel: 2 }];

const esp = (extra: Record<string, unknown> = {}) => ficha('ana', {
  profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  level: 4, peCurrent: 20, peMax: 20,
  mainHandWeaponName: 'Espada Curta', offHandWeaponName: null,
  meleeTrained: true, rangedTrained: true,
  attributes: [{ name: 'FOR', value: 14 }, { name: 'DES', value: 14 }, { name: 'CON', value: 12 }, { name: 'SAB', value: 12 }],
  chosenSpecAbilities: [], attacksThisTurn: 0, weaponSwapsThisTurn: 0,
  bonusActionsCurrent: 1, bonusActionsMax: 1, ...extra,
} as never);
const inimigo = (extra: Record<string, unknown> = {}) => ficha('bruno', {
  category: 'INIMIGO', hpCurrent: 200, hpMax: 200, escCurrent: 0, rd: 0,
  attributes: [{ name: 'CON', value: 10 }], ...extra,
} as never);
const aliado = () => ficha('caio', { category: 'PLAYER', hpCurrent: 30, hpMax: 30 } as never);

const textoLog = () => useLogStore.getState().logs.map((l) => l.message).join('\n');
const hp = (id: string) => pegarFicha(id).hpCurrent ?? 0;

function mesa(c: Character, outros: Character[], posicoes: Record<string, [number, number]>) {
  useLogStore.getState().clearLogs();
  montarMesa([c, ...outros], posicoes);
  useCombatStore.setState({
    inCombat: true, round: 1,
    initiativeOrder: [{ charId: 'ana' }, { charId: 'bruno' }] as never,
    currentTurnIndex: 0,
  } as never);
}

async function abrirPainel() {
  cleanup();
  render(<AttackPanel character={pegarFicha('ana')} />);
  await selecionarAlvoNoMapaUI('bruno');
}

async function atacar(...dados: number[]) {
  await abrirPainel();
  useLogStore.getState().clearLogs();
  forcarDados(...(dados.length ? dados : [18, 4, 4, 4, 4, 4]));
  fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
  const btn = await screen.findAllByRole('button', { name: /Rolar Dano/ }).catch(() => []);
  if (btn.length) fireEvent.click(btn[0]);
}

beforeEach(async () => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => {
  cleanup(); limparMesa();
  useCombatStore.setState({ inCombat: false, initiativeOrder: [] } as never);
});

describe('Extensão do Corpo', () => {
  it('alcança um alvo a 3 m com arma corpo a corpo (sem a habilidade, não alcança)', async () => {
    // Sem a habilidade: Espada Curta alcança 1,5 m; alvo a 2 casas = 3 m.
    mesa(esp(), [inimigo()], { ana: [0, 0], bruno: [2, 0] });
    await expect(abrirPainel()).rejects.toThrow('Alvo fora do alcance');

    // Com a habilidade: +1,5 m → alcança.
    mesa(esp({ chosenSpecAbilities: EXT }), [inimigo()], { ana: [0, 0], bruno: [2, 0] });
    await atacar();
    await waitFor(() => expect(textoLog()).toMatch(/💥 Dano:/), { timeout: 15000 });
  }, 20000);

  it('dá +2 no acerto com arma corpo a corpo', async () => {
    mesa(esp({ chosenSpecAbilities: EXT }), [inimigo()], { ana: [0, 0], bruno: [1, 0] });
    await atacar();
    await waitFor(() => expect(textoLog()).toMatch(/Extensão do Corpo: \+2 acerto/), { timeout: 15000 });
  }, 20000);

  it('não dá o +2 com arma à distância', async () => {
    mesa(esp({ chosenSpecAbilities: EXT, mainHandWeaponName: 'Pistola' }), [inimigo()], { ana: [0, 0], bruno: [2, 0] });
    await atacar();
    await waitFor(() => expect(textoLog()).toMatch(/💥 Dano:/), { timeout: 15000 });
    expect(textoLog()).not.toMatch(/Extensão do Corpo/);
  }, 20000);

  it('ainda respeita o limite: alvo a 6 m continua fora de alcance', async () => {
    mesa(esp({ chosenSpecAbilities: EXT }), [inimigo()], { ana: [0, 0], bruno: [4, 0] });
    await expect(abrirPainel()).rejects.toThrow('Alvo fora do alcance');
  }, 20000);
});

describe('Disparos Sincronizados', () => {
  const atirador = (extra: Record<string, unknown> = {}) => esp({
    chosenSpecAbilities: DIS, mainHandWeaponName: 'Pistola', offHandWeaponName: 'Arco Curto', ...extra,
  });

  it('os dois tiros acertam: dano vira uma instância só, com RD aplicada uma vez', async () => {
    mesa(atirador(), [inimigo({ rd: 5 })], { ana: [0, 0], bruno: [2, 0] });
    await abrirPainel();
    useLogStore.getState().clearLogs();
    const antes = hp('bruno');
    forcarDados(19, 6, 19, 6); // ataque1, dano1, ataque2, dano2
    fireEvent.click(screen.getByTestId('disparos-sincronizados'));
    await waitFor(() => expect(textoLog()).toMatch(/Dano combinado/), { timeout: 15000 });
    const total = Number(/Dano combinado: (\d+)/.exec(textoLog())?.[1] ?? 0);
    expect(total).toBeGreaterThan(0);
    await waitFor(() => expect(hp('bruno')).toBe(antes - (total - 5)), { timeout: 15000 });
  }, 20000);

  it('se um tiro errar, nenhum dano é causado (tudo ou nada)', async () => {
    mesa(atirador(), [inimigo()], { ana: [0, 0], bruno: [2, 0] });
    await abrirPainel();
    useLogStore.getState().clearLogs();
    const antes = hp('bruno');
    forcarDados(19, 6, 1, 6); // segundo tiro erra
    fireEvent.click(screen.getByTestId('disparos-sincronizados'));
    await waitFor(() => expect(textoLog()).toMatch(/nenhum dano é causado/), { timeout: 15000 });
    expect(hp('bruno')).toBe(antes);
    expect(textoLog()).not.toMatch(/Dano combinado/);
  }, 20000);

  it('com arma corpo a corpo na mão principal, o botão fica bloqueado', async () => {
    mesa(atirador({ mainHandWeaponName: 'Espada Curta' }), [inimigo()], { ana: [0, 0], bruno: [1, 0] });
    await abrirPainel();
    expect(screen.getByTestId('disparos-sincronizados').hasAttribute('disabled')).toBe(true);
  });

  it('sem a habilidade o botão nem aparece', async () => {
    mesa(esp({ mainHandWeaponName: 'Pistola', offHandWeaponName: 'Arco Curto' }), [inimigo()], { ana: [0, 0], bruno: [2, 0] });
    await abrirPainel();
    expect(screen.queryByTestId('disparos-sincronizados')).toBeNull();
  });
});

describe('Flanqueador Superior', () => {
  it('alvo flanqueado sofre −2 no TR de Fortitude do Golpe Impactante', async () => {
    // Sem flanco: aliado longe.
    mesa(esp({ chosenSpecAbilities: FLA }), [inimigo(), aliado()], { ana: [0, 0], bruno: [1, 0], caio: [6, 6] });
    await abrirPainel();
    useLogStore.getState().clearLogs();
    forcarDados(18, 6, 6, 10);
    fireEvent.click(screen.getByRole('button', { name: /Golpe Impactante/ }));
    fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Rolar Dano/ }, { timeout: 15000 }));
    await waitFor(() => expect(textoLog()).toMatch(/Impactante: bruno Fortitude/), { timeout: 15000 });
    const semFlanco = /Impactante: bruno Fortitude d20 \d+([+-]\d+)/.exec(textoLog())?.[1];
    expect(semFlanco).toBe('+0');

    // Com flanco: aliado adjacente ao mesmo alvo.
    mesa(esp({ chosenSpecAbilities: FLA }), [inimigo(), aliado()], { ana: [0, 0], bruno: [1, 0], caio: [2, 0] });
    await abrirPainel();
    useLogStore.getState().clearLogs();
    forcarDados(18, 6, 6, 10);
    fireEvent.click(screen.getByRole('button', { name: /Golpe Impactante/ }));
    fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Rolar Dano/ }, { timeout: 15000 }));
    await waitFor(() => expect(textoLog()).toMatch(/Impactante: bruno Fortitude/), { timeout: 15000 });
    const comFlanco = /Impactante: bruno Fortitude d20 \d+([+-]\d+)/.exec(textoLog())?.[1];
    expect(comFlanco).toBe('-2');
  }, 30000);

  it('só conta como flanco com aliado adjacente ao mesmo alvo', async () => {
    mesa(esp({ chosenSpecAbilities: FLA }), [inimigo(), aliado()], { ana: [0, 0], bruno: [1, 0], caio: [6, 6] });
    const ms = useMapStore.getState();
    const chars = useCharacterStore.getState().characters;
    expect(estaFlanqueando(pegarFicha('ana'), pegarFicha('bruno'), chars, ms.entities as never, ms.gridConfig as never)).toBe(false);
    expect(penalidadeTRFlanqueado(pegarFicha('bruno'), chars, ms.entities as never, ms.gridConfig as never)).toBe(0);

    mesa(esp({ chosenSpecAbilities: FLA }), [inimigo(), aliado()], { ana: [0, 0], bruno: [1, 0], caio: [2, 0] });
    const ms2 = useMapStore.getState();
    const chars2 = useCharacterStore.getState().characters;
    expect(estaFlanqueando(pegarFicha('ana'), pegarFicha('bruno'), chars2, ms2.entities as never, ms2.gridConfig as never)).toBe(true);
    expect(penalidadeTRFlanqueado(pegarFicha('bruno'), chars2, ms2.entities as never, ms2.gridConfig as never)).toBe(-2);
  });

  it('sem a habilidade, o flanco não penaliza o TR', async () => {
    mesa(esp(), [inimigo(), aliado()], { ana: [0, 0], bruno: [1, 0], caio: [2, 0] });
    const ms = useMapStore.getState();
    const chars = useCharacterStore.getState().characters;
    expect(penalidadeTRFlanqueado(pegarFicha('bruno'), chars, ms.entities as never, ms.gridConfig as never)).toBe(0);
  });
});
