import { selecionarAlvoNoMapaUI } from './helpers/alvoMapaUI';
// @vitest-environment jsdom
/**
 * Estilo do Protetor em combate real (mesa em memória): peças no mapa, cliques
 * no painel de estilos, e o ataque do inimigo pelo painel de ataque real.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { CombateEstilosPanel } from '@/components/fichas/CombateEstilosPanel';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { peekAdvantageFor } from '@/lib/omni/rollAdvantage';
import { protetorResguardarTR } from '@/lib/combateProtetor';
import { useReactionStore } from '@/stores/useReactionStore';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados } from './helpers/mesaReal';

const prot = () => ficha('ana', {
  profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  combatStyles: ['protetor'], level: 1, reactionsCurrent: 1, reactionsMax: 1,
} as never);
const aliado = () => ficha('caio', { category: 'PLAYER' } as never);
const inimigo = () => ficha('bruno', { category: 'INIMIGO', mainHandWeaponName: 'Espada Curta' } as never);
const log = () => JSON.stringify(useLogStore.getState());

function abrir(pos: Record<string, [number, number]>) {
  useLogStore.setState({ ...(useLogStore.getState() as object), logs: [] } as never);
  montarMesa([prot(), aliado(), inimigo()], pos);
  render(<CombateEstilosPanel character={pegarFicha('ana')} />);
  fireEvent.change(screen.getByLabelText('Aliado protegido'), { target: { value: 'caio' } });
}

beforeEach(async () => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { cleanup(); limparMesa(); vi.restoreAllMocks(); });

describe('Estilo do Protetor em combate', () => {
  it('aliado a 1,5 m: impõe desvantagem, gasta reação e o ataque real do inimigo sai com 2d20 (menor)', async () => {
    abrir({ ana: [0, 0], caio: [1, 0], bruno: [2, 0] });
    expect(screen.getByLabelText('Aliado protegido').textContent).toContain('ao alcance');
    fireEvent.change(screen.getByLabelText('Quem está atacando'), { target: { value: 'bruno' } });
    fireEvent.click(screen.getByRole('button', { name: 'Impor desvantagem' }));
    expect(pegarFicha('ana').reactionsCurrent).toBe(0);
    expect(peekAdvantageFor('bruno', { kind: 'attack', subtype: 'melee' })).toBe('disadvantage');
    cleanup();

    comoTela({ profileId: 'p-ana', role: 'MASTER' });
    render(<AttackPanel character={pegarFicha('bruno')} />);
    await selecionarAlvoNoMapaUI('caio');
    forcarDados(18, 18, 3);
    fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
    await waitFor(() => expect(log()).toMatch(/desvantagem/), { timeout: 4000 });
    // consumido: o próximo ataque volta ao normal
    await waitFor(() => expect(peekAdvantageFor('bruno', { kind: 'attack', subtype: 'melee' })).toBe('normal'));
  });

  it('aliado a 4,5 m: bloqueia, diz quanto falta e NÃO gasta reação', async () => {
    abrir({ ana: [0, 0], caio: [3, 0], bruno: [4, 0] });
    expect(screen.getByLabelText('Aliado protegido').textContent).toContain('falta 3,0 m');
    fireEvent.change(screen.getByLabelText('Quem está atacando'), { target: { value: 'bruno' } });
    fireEvent.click(screen.getByRole('button', { name: 'Impor desvantagem' }));
    expect(screen.getByText(/falta 3,0 m para 1,5 m/)).toBeTruthy();
    expect(pegarFicha('ana').reactionsCurrent).toBe(1);
    expect(peekAdvantageFor('bruno', { kind: 'attack', subtype: 'melee' })).toBe('normal');
  });

  it('vantagem no TR do aliado adjacente; sem reação, botões travam', async () => {
    abrir({ ana: [0, 0], caio: [0, 1], bruno: [5, 0] });
    fireEvent.click(screen.getByRole('button', { name: 'Vantagem no TR' }));
    expect(peekAdvantageFor('caio', { kind: 'save', name: 'Reflexos' })).toBe('advantage');
    expect(pegarFicha('ana').reactionsCurrent).toBe(0);
    cleanup();
    render(<CombateEstilosPanel character={pegarFicha('ana')} />);
    fireEvent.change(screen.getByLabelText('Aliado protegido'), { target: { value: 'caio' } });
    expect((screen.getByRole('button', { name: 'Vantagem no TR' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('não concede vantagem no TR se o consumo da reação falhar', () => {
    montarMesa([prot(), aliado(), inimigo()], { ana: [0, 0], caio: [0, 1], bruno: [5, 0] });
    vi.spyOn(useReactionStore.getState(), 'consumeReaction').mockReturnValue(false);

    expect(protetorResguardarTR('ana', 'caio')).toEqual({ ok: false, reason: 'Sem reação disponível.' });
    expect(peekAdvantageFor('caio', { kind: 'save', name: 'Reflexos' })).toBe('normal');
    expect(pegarFicha('ana').reactionsCurrent).toBe(1);
  });
});
