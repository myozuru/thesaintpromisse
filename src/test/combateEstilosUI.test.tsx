// @vitest-environment jsdom
/** Painel de Estilos com store real: escolha pendente atrasada (Nv 12) e CA do Defensivo. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CombateEstilosPanel } from '@/components/fichas/CombateEstilosPanel';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { ficha, montarMesa, limparMesa, comoTela } from './helpers/mesaReal';
import { computeTotalDefense } from '@/lib/defenseCalc';

beforeEach(() => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { cleanup(); limparMesa(); });

describe('Repertório do Especialista — tela', () => {
  it('escolhe estilos atrasados com cliques reais e aplica CA', () => {
    montarMesa([ficha('ana', {
      profileId: 'p-ana', level: 12, characterClass: 'Feiticeiro',
      specialization: 'Especialista em Combate', combatStyles: ['duelista'],
    } as never)], { ana: [0, 0] });
    const get = () => useCharacterStore.getState().characters.find((c) => c.id === 'ana')!;
    const before = computeTotalDefense(get());
    const { rerender } = render(<CombateEstilosPanel character={get()} />);
    expect(screen.getByText('2 estilo(s) para escolher')).toBeTruthy();
    fireEvent.click(screen.getByText('Estilo Defensivo'));
    fireEvent.click(screen.getByText('Confirmar estilo'));
    expect(get().combatStyles).toEqual(['duelista', 'defensivo']);
    expect(computeTotalDefense(get())).toBe(before + 5);
    rerender(<CombateEstilosPanel character={get()} />);
    expect(screen.getByText('1 estilo(s) para escolher')).toBeTruthy();
    expect(screen.getByText('CA +5 (ativo)')).toBeTruthy();
  });
});
