// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/components/Header', () => ({
  Header: ({ onTabChange }: { onTabChange: (tab: 'mapa') => void }) => (
    <button onClick={() => onTabChange('mapa')}>Abrir mapa</button>
  ),
  getTabsForRole: () => ['fichas', 'mapa'],
}));
vi.mock('@/components/fichas/FichasModule', () => ({ FichasModule: () => <div>Ficha montada</div> }));
vi.mock('@/components/mundo/MapaHub', () => ({ MapaHub: () => <div>Mapa montado</div> }));
vi.mock('@/components/LogPanel', () => ({ LogPanel: () => null }));
vi.mock('@/components/fab/DataHub', () => ({ DataHub: () => null }));
vi.mock('@/components/chronos/GlobalClockTicker', () => ({ GlobalClockTicker: () => null }));
vi.mock('@/components/JjkSwirl', () => ({ JjkSwirl: () => null }));
vi.mock('@/components/fichas/TestRequestOverlay', () => ({ TestRequestOverlay: () => null }));
vi.mock('@/components/testes/TestRequestPanel', () => ({ TestRequestPanel: () => null }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/lib/sounds', () => ({ playOpeningSound: () => {}, playTabSound: () => {} }));

import Index from '@/pages/Index';
import { useRoleStore } from '@/stores/useRoleStore';
import { useReactionStore } from '@/stores/useReactionStore';

describe('overlay de reação no shell global', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('mantém Cobrir-se visível ao sair da aba Fichas e abrir o mapa', async () => {
    useRoleStore.setState({ role: 'MASTER' } as never);
    useReactionStore.setState({
      prompts: [{
        id: 'cobrir-no-mapa', charId: 'alvo', charName: 'Alvo', kind: 'cobrir_se_offer',
        message: 'Alvo receberá dano', payload: { damageDealt: 8, maxPe: 2, peAvailable: 2, perPe: 4 },
        createdAt: Date.now(),
      }],
      reactionsUsedByChar: {},
    });
    render(<Index />);

    fireEvent.click(screen.getByText('Clique em qualquer lugar para entrar'));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 900)); });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir mapa' }));
    await screen.findByText('Mapa montado');

    await waitFor(() => expect(screen.getByRole('button', { name: /Cobrir-se$/i })).toBeTruthy());
    expect(screen.getByRole('button', { name: /Cobrir-se$/i }).closest('[hidden]')).toBeNull();
  });
});
