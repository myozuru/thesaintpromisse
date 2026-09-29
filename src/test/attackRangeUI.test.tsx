// @vitest-environment jsdom
/**
 * Painel de Ataque com alcance real no mapa (mesa real em memória):
 * a distância é medida pelas peças no mapa e o botão de rolar bloqueia
 * quando o alvo está fora do alcance da arma.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { ficha, montarMesa, limparMesa, comoTela } from './helpers/mesaReal';

const atacante = (arma: string) =>
  ficha('ana', { profileId: 'p-ana', mainHandWeaponName: arma } as never);
const alvo = () => ficha('bruno', { category: 'INIMIGO' } as never);

function selecionarAlvo(nome: string) {
  const selects = screen.getAllByRole('combobox');
  const sel = selects.find((s) =>
    Array.from((s as HTMLSelectElement).options).some((o) => o.textContent === nome),
  ) as HTMLSelectElement | undefined;
  expect(sel, 'select de alvo com o personagem').toBeTruthy();
  fireEvent.change(sel!, { target: { value: nome === 'bruno' ? 'bruno' : nome } });
}

beforeEach(() => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { cleanup(); limparMesa(); });

describe('Painel de Ataque — alcance no mapa', () => {
  it('alvo adjacente (1,5 m): mostra distância e libera o botão de rolar', () => {
    montarMesa([atacante('Espada Longa'), alvo()], { ana: [0, 0], bruno: [1, 0] });
    render(<AttackPanel character={atacante('Espada Longa')} />);
    selecionarAlvo('bruno');
    expect(screen.getByText(/Distância:/).textContent).toContain('1,5 m');
    expect(screen.queryByText(/fora de alcance/i)).toBeNull();
    expect((screen.getByRole('button', { name: /Rolar Ataque/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('alvo a 4,5 m com espada comum: mostra aviso e BLOQUEIA o botão', () => {
    montarMesa([atacante('Espada Longa'), alvo()], { ana: [0, 0], bruno: [3, 0] });
    render(<AttackPanel character={atacante('Espada Longa')} />);
    selecionarAlvo('bruno');
    expect(screen.getByText(/fora de alcance/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Rolar Ataque/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('alvo a 3 m com Alabarda (Estendida): dentro do alcance', () => {
    montarMesa([atacante('Alabarda'), alvo()], { ana: [0, 0], bruno: [2, 0] });
    render(<AttackPanel character={atacante('Alabarda')} />);
    selecionarAlvo('bruno');
    expect(screen.getByText(/Distância:/).textContent).toContain('3,0 m');
    expect(screen.queryByText(/fora de alcance/i)).toBeNull();
    expect((screen.getByRole('button', { name: /Rolar Ataque/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('alvo a 45 m com Arco Curto (máx. 48 m): permitido; a 60 m: bloqueado', () => {
    montarMesa([atacante('Arco Curto'), alvo()], { ana: [0, 0], bruno: [30, 0] });
    const { unmount } = render(<AttackPanel character={atacante('Arco Curto')} />);
    selecionarAlvo('bruno');
    expect(screen.queryByText(/fora de alcance/i)).toBeNull();
    unmount();

    montarMesa([atacante('Arco Curto'), alvo()], { ana: [0, 0], bruno: [40, 0] });
    render(<AttackPanel character={atacante('Arco Curto')} />);
    selecionarAlvo('bruno');
    expect(screen.getByText(/fora de alcance/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Rolar Ataque/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
