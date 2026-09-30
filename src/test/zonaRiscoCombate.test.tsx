// @vitest-environment jsdom
/**
 * Zona de Risco (Especialista em Combate nv 2) em combate real:
 * peças no mapa, movimento confirmado pelo botão real, pergunta, gasto de PE,
 * limite por rodada e ataque de verdade no Painel de Ataque.
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
import { ZonaRiscoPrompt } from '@/components/fichas/ZonaRiscoPrompt';
import { PendingMoveOverlay } from '@/components/mapa/ui/PendingMoveOverlay';
import { useLogStore } from '@/stores/useLogStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useMapStore } from '@/stores/useMapStore';
import { useZonaRiscoStore } from '@/lib/zonaRisco';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados, CASA } from './helpers/mesaReal';

const ZONA = [{ abilityId: 'ec-zona-risco', chosenAtLevel: 2 }];
const esp = (extra: Record<string, unknown> = {}) => ficha('ana', {
  profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  level: 4, peCurrent: 20, peMax: 20, hpCurrent: 40, hpMax: 40,
  mainHandWeaponName: 'Alabarda', offHandWeaponName: null, meleeTrained: true,
  attributes: [{ name: 'FOR', value: 16 }, { name: 'DES', value: 12 }],
  chosenSpecAbilities: ZONA, attacksThisTurn: 0, reactionsCurrent: 1, reactionsMax: 1, ...extra,
} as never);
const inimigo = (extra: Record<string, unknown> = {}) => ficha('bruno', {
  category: 'INIMIGO', hpCurrent: 300, hpMax: 300, escCurrent: 0, rd: 0, defense: 5, ...extra,
} as never);
const textoLog = () => useLogStore.getState().logs.map((l) => l.message).join('\n');

function mesa(chars: Character[], pos: Record<string, [number, number]>, round = 1) {
  useLogStore.getState().clearLogs();
  useZonaRiscoStore.setState({ fila: [], ataque: null });
  montarMesa(chars, pos);
  useCombatStore.setState({
    inCombat: true, round, movementUsedByChar: {},
    initiativeOrder: [{ charId: 'bruno' }, { charId: 'ana' }] as never, currentTurnIndex: 0,
  } as never);
}

/** Move a peça de `id` para a casa (cx, cy) e clica em "Confirmar movimento". */
function mover(id: string, cx: number, cy: number) {
  const ms = useMapStore.getState();
  const e = ms.entities[`e-${id}`];
  const startX = e.x, startY = e.y;
  ms.updateEntity(`e-${id}`, { x: cx * CASA, y: cy * CASA });
  ms.setPendingMove({ entityId: `e-${id}`, charId: id, startX, startY, trail: [], distM: 1.5 });
  cleanup();
  render(<><PendingMoveOverlay /><ZonaRiscoPrompt /></>);
  fireEvent.click(screen.getByTitle('Confirmar movimento'));
}

class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= RO;
beforeEach(() => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { cleanup(); limparMesa(); useCombatStore.setState({ inCombat: false, initiativeOrder: [] } as never); });

describe('Zona de Risco', () => {
  it('inimigo entra no alcance → pergunta; aceitar gasta 2 PE e ataca de verdade', async () => {
    mesa([esp(), inimigo()], { ana: [0, 0], bruno: [6, 0] });
    mover('bruno', 2, 0);
    expect(await screen.findByRole('dialog', { name: 'Zona de Risco' })).toBeTruthy();
    fireEvent.click(screen.getByText(/Atacar \(2 PE\)/));
    expect(pegarFicha('ana').peCurrent).toBe(18);
    expect(pegarFicha('ana').reactionsCurrent).toBe(1); // não gasta reação
    expect(textoLog()).toMatch(/Zona de Risco: ana gasta 2 PE/);
    cleanup();
    render(<AttackPanel character={pegarFicha('ana')} />);
    expect(screen.getByTestId('zona-risco-banner').textContent).toMatch(/bruno/);
    forcarDados(18, 6, 6, 6);
    fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
    await waitFor(() => expect(textoLog()).toMatch(/🗡️/), { timeout: 15000 });
    const dano = screen.queryAllByRole('button', { name: /Rolar Dano/ });
    if (dano.length) fireEvent.click(dano[0]);
    await waitFor(() => expect(textoLog()).toMatch(/💥 Dano:/), { timeout: 15000 });
    expect(pegarFicha('bruno').hpCurrent).toBe(291);
  }, 25000);

  it('recusar não gasta PE nem a rodada', () => {
    mesa([esp(), inimigo()], { ana: [0, 0], bruno: [6, 0] });
    mover('bruno', 2, 0);
    fireEvent.click(screen.getByText('Não'));
    expect(pegarFicha('ana').peCurrent).toBe(20);
    expect(pegarFicha('ana').zonaRiscoRound).toBeUndefined();
    mover('bruno', 1, 0);
    expect(screen.getByRole('dialog', { name: 'Zona de Risco' })).toBeTruthy();
  });

  it('já dentro do alcance e se move sem sair também ativa', () => {
    mesa([esp(), inimigo()], { ana: [0, 0], bruno: [1, 0] });
    mover('bruno', 1, 1);
    expect(screen.getByRole('dialog', { name: 'Zona de Risco' })).toBeTruthy();
  });

  it('fora do alcance não pergunta', () => {
    mesa([esp(), inimigo()], { ana: [0, 0], bruno: [8, 0] });
    mover('bruno', 5, 0);
    expect(screen.queryByRole('dialog', { name: 'Zona de Risco' })).toBeNull();
  });

  it('só 1 vez por rodada; volta na rodada seguinte', () => {
    mesa([esp(), inimigo()], { ana: [0, 0], bruno: [6, 0] });
    mover('bruno', 2, 0);
    fireEvent.click(screen.getByText(/Atacar \(2 PE\)/));
    mover('bruno', 1, 0);
    expect(screen.queryByRole('dialog', { name: 'Zona de Risco' })).toBeNull();
    useCombatStore.setState({ round: 2 } as never);
    mover('bruno', 2, 1);
    expect(screen.getByRole('dialog', { name: 'Zona de Risco' })).toBeTruthy();
  });

  it('sem arma Estendida, sem PE, aliado ou sem habilidade: não pergunta', () => {
    for (const [c, alvo] of [
      [esp({ mainHandWeaponName: 'Espada Longa' }), inimigo()],
      [esp({ peCurrent: 1 }), inimigo()],
      [esp({ chosenSpecAbilities: [] }), inimigo()],
      [esp(), inimigo({ category: 'PLAYER' })],
    ] as [Character, Character][]) {
      mesa([c, alvo], { ana: [0, 0], bruno: [6, 0] });
      mover('bruno', 2, 0);
      expect(screen.queryByRole('dialog', { name: 'Zona de Risco' })).toBeNull();
    }
  });

  it('funciona também no turno do próprio Especialista', () => {
    mesa([esp(), inimigo()], { ana: [0, 0], bruno: [6, 0] });
    useCombatStore.setState({ currentTurnIndex: 1 } as never);
    mover('bruno', 2, 0);
    expect(screen.getByRole('dialog', { name: 'Zona de Risco' })).toBeTruthy();
  });
});

import { getAbilityMod as __gam, findAbilityAttr as __faa } from '@/lib/combatEngine';
describe('atributos por nome completo', () => {
  it('reconhece Força/Destreza (sem desvantagem falsa de Pesada)', () => {
    const c = { attributes: [{ id: 'a', name: 'Força', value: 16 }, { id: 'b', name: 'Destreza', value: 12 }] } as never;
    expect(__faa(c, 'FOR')?.value).toBe(16);
    expect(__gam(c, 'FOR')).toBe(3);
    expect(__gam(c, 'DES')).toBe(1);
  });
});
