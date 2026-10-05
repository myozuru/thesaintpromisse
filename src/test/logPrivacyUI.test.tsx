// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LogPanel } from '@/components/LogPanel';
import { useLogStore } from '@/stores/useLogStore';
import { useRoleStore } from '@/stores/useRoleStore';
vi.mock('@/lib/sounds', () => ({ playDeleteSound: vi.fn() }));
vi.mock('@/components/ui/scroll-area', () => ({ ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

afterEach(cleanup);
const message = '🎲 Kurogiri — TR (Reflexos): d20 13 +2 = 15 vs CD 69 → FALHA';
function seed(role: 'MASTER' | 'PLAYER') {
  useRoleStore.setState({ role });
  useLogStore.setState({ panelCollapsed: false, playerVisibility: 'full', logs: [
    { id: 'legacy', timestamp: 1, type: 'combat', message, sourceRole: 'MASTER' },
  ] });
}
describe('histórico visível por papel', () => {
  it('jogador não vê os dados privados nem com visibilidade full e registro antigo', () => {
    seed('PLAYER');
    const { container } = render(<LogPanel />);
    expect(container.textContent).toContain('Kurogiri');
    expect(container.textContent).not.toContain('CD 69');
    expect(container.textContent).not.toContain('+2');
  });
  it('mestre continua vendo o registro completo em seu cliente', () => {
    seed('MASTER');
    render(<LogPanel />);
    expect(screen.getByText(message)).toBeTruthy();
  });
});
