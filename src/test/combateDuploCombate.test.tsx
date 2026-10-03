import { selecionarAlvoNoMapaUI } from './helpers/alvoMapaUI';
// @vitest-environment jsdom
/** Estilo Duplo em combate real (mesa em memória, peças no mapa, clique real). */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { getDuploDamage } from '@/lib/combateEstilos';
import { ficha, montarMesa, limparMesa, comoTela } from './helpers/mesaReal';

const esp = (main: string, off: string | null) => ficha('ana', {
  profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  combatStyles: ['duplo'], level: 1, mainHandWeaponName: main, offHandWeaponName: off,
} as never);
const alvo = () => ficha('bruno', { category: 'INIMIGO' } as never);
const log = () => JSON.stringify(useLogStore.getState());

async function preparar(c: ReturnType<typeof esp>, pos: Record<string, [number, number]>) {
  useLogStore.setState({ ...(useLogStore.getState() as object), logs: [] } as never);
  montarMesa([c, alvo()], pos);
  render(<AttackPanel character={c} />);
  await selecionarAlvoNoMapaUI('bruno');
  return screen.getByRole('button', { name: /Rolar Ataque/ }) as HTMLButtonElement;
}

beforeEach(async () => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { cleanup(); limparMesa(); });

describe('Estilo Duplo em combate', () => {
  it('escala', async () => { expect(getDuploDamage(1)).toBe(1); expect(getDuploDamage(16)).toBe(5); });
  it('duas armas, adjacente: +1 dano no registro', async () => {
    const btn = await preparar(esp('Espada Curta', 'Adaga'), { ana: [0, 0], bruno: [1, 0] });
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect(log()).toContain('Estilo Duplo: +1 dano'), { timeout: 8000 });
  });
  it('duas armas, alvo a 4,5 m: bloqueado', async () => {
    await expect(preparar(esp('Espada Curta', 'Adaga'), { ana: [0, 0], bruno: [3, 0] })).rejects.toThrow('Alvo fora do alcance');
  });
  it('uma arma só: sem bônus', async () => {
    const btn = await preparar(esp('Espada Curta', null), { ana: [0, 0], bruno: [1, 0] });
    fireEvent.click(btn);
    await waitFor(() => expect(log()).toContain('atacou com'), { timeout: 8000 });
    expect(log()).not.toContain('Estilo Duplo');
  });
});
