// @vitest-environment jsdom
/** Estilo do Interceptador em combate (mesa em memória): peças no mapa, clique no painel e dano real. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CombateEstilosPanel } from '@/components/fichas/CombateEstilosPanel';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { interceptadorDice } from '@/lib/combateInterceptador';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha } from './helpers/mesaReal';

const inter = (extra = {}) => ficha('ana', {
  profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  combatStyles: ['interceptador'], level: 1, reactionsCurrent: 1, reactionsMax: 1, ...extra,
} as never);
const aliado = () => ficha('caio', { category: 'PLAYER', hpCurrent: 50, hpMax: 50, escCurrent: 0, rd: 0 } as never);

function abrir(pos: Record<string, [number, number]>, extra = {}) {
  montarMesa([inter(extra), aliado()], pos);
  render(<CombateEstilosPanel character={pegarFicha('ana')} />);
  fireEvent.change(screen.getByLabelText('Aliado interceptado'), { target: { value: 'caio' } });
}

beforeEach(() => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { cleanup(); limparMesa(); vi.restoreAllMocks(); });

describe('Estilo do Interceptador em combate', () => {
  it('aliado a 1,5 m: gasta reação e reduz o próximo dano real (só uma vez)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.55); // d10 = 6
    abrir({ ana: [0, 0], caio: [1, 0] });
    expect(screen.getByLabelText('Aliado interceptado').textContent).toContain('ao alcance');
    fireEvent.click(screen.getByRole('button', { name: 'Interceptar' }));
    vi.restoreAllMocks();
    expect(pegarFicha('ana').reactionsCurrent).toBe(0);
    const g = pegarFicha('caio').interceptGuard!;
    expect(g.amount).toBeGreaterThanOrEqual(1);
    const hp0 = pegarFicha('caio').hpCurrent;
    useCharacterStore.getState().applyDamage('caio', 20, 'DCO', { ignoresRD: true });
    expect(hp0 - pegarFicha('caio').hpCurrent).toBe(Math.max(0, 20 - g.amount));
    expect(pegarFicha('caio').interceptGuard).toBeFalsy();
    const hp1 = pegarFicha('caio').hpCurrent;
    useCharacterStore.getState().applyDamage('caio', 5, 'DCO', { ignoresRD: true });
    expect(hp1 - pegarFicha('caio').hpCurrent).toBe(5);
  });

  it('aliado a 4,5 m: bloqueia, mostra distância faltante e não gasta reação', () => {
    abrir({ ana: [0, 0], caio: [3, 0] });
    expect(screen.getByLabelText('Aliado interceptado').textContent).toContain('falta 3');
    fireEvent.click(screen.getByRole('button', { name: 'Interceptar' }));
    expect(pegarFicha('ana').reactionsCurrent).toBe(1);
    expect(pegarFicha('caio').interceptGuard).toBeFalsy();
    expect(screen.getByText(/falta 3/, { selector: 'p' })).toBeTruthy();
  });

  it('sem reação o botão fica desabilitado; dados escalam com o nível', () => {
    abrir({ ana: [0, 0], caio: [1, 0] }, { reactionsCurrent: 0 });
    expect((screen.getByRole('button', { name: 'Interceptar' }) as HTMLButtonElement).disabled).toBe(true);
    expect([1, 4, 8, 12, 16].map(interceptadorDice)).toEqual([1, 2, 3, 4, 5]);
  });
});
