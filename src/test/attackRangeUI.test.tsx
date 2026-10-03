// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { ficha, montarMesa, limparMesa, comoTela } from './helpers/mesaReal';
import { selecionarAlvoNoMapaUI } from './helpers/alvoMapaUI';
import { alvosNoAlcance, clicarAlvoMapa, terminarAlvoMapa, useAlvoMapaStore } from '@/stores/useAlvoMapaStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
const atacante = (arma: string) => ficha('ana', { profileId: 'p-ana', mainHandWeaponName: arma });
const alvo = () => ficha('bruno', { category: 'INIMIGO' });
beforeEach(() => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { cleanup(); terminarAlvoMapa(null); limparMesa(); });

describe('alcance real antes da seleção', () => {
  it.each([['Espada Longa', 1, 1.5], ['Alabarda', 2, 3], ['Arco Curto', 30, 48]] as const)('%s permite escolher somente os tokens no seu alcance', async (arma, casas, alcance) => {
    montarMesa([atacante(arma), alvo()], { ana: [0, 0], bruno: [casas, 0] });
    render(<AttackPanel character={atacante(arma)} />);
    expect(screen.queryByLabelText('Alvo')).toBeNull();
    await selecionarAlvoNoMapaUI('bruno');
    expect(screen.getByText('Alvo: bruno')).toBeTruthy();
    expect(screen.getByText(/Distância:/).textContent).toContain(String(alcance).replace('.', ','));
  });
  it.each([['Espada Longa', 3], ['Arco Curto', 40]] as const)('%s impede escolher um token distante, sem gastar recursos', async (arma, casas) => {
    montarMesa([atacante(arma), alvo()], { ana: [0, 0], bruno: [casas, 0] });
    render(<AttackPanel character={atacante(arma)} />);
    const antes = useCharacterStore.getState().characters[0];
    fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
    const pedido = useAlvoMapaStore.getState().pending!;
    expect(alvosNoAlcance(pedido)).toHaveLength(0);
    act(() => clicarAlvoMapa(Object.values(useMapStore.getState().entities).find(e => e.characterId === 'bruno')!.id));
    expect(useAlvoMapaStore.getState().pending).not.toBeNull();
    await act(async () => { terminarAlvoMapa(null); await Promise.resolve(); });
    expect(useCharacterStore.getState().characters[0]).toEqual(antes);
  });
});
