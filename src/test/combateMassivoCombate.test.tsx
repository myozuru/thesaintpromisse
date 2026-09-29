// @vitest-environment jsdom
/** Estilo Massivo em combate real (mesa em memória, peças no mapa, clique real, dados forçados). */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { getMassivoDamage } from '@/lib/combateEstilos';
import { ficha, montarMesa, limparMesa, comoTela, forcarDados } from './helpers/mesaReal';

const esp = (main: string, styles = ['massivo']) => ficha('ana', {
  profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  combatStyles: styles, level: 1, attributes: [{ name: 'FOR', value: 16 }, { name: 'DES', value: 12 }, { name: 'CON', value: 12 }], mainHandWeaponName: main,
  offHandWeaponName: main === 'Espada Grande' ? main : null,
} as never);
const alvo = () => ficha('bruno', { category: 'INIMIGO' } as never);
const log = () => JSON.stringify(useLogStore.getState());

function preparar(c: ReturnType<typeof esp>, pos: Record<string, [number, number]>) {
  useLogStore.setState({ ...(useLogStore.getState() as object), logs: [] } as never);
  montarMesa([c, alvo()], pos);
  render(<AttackPanel character={c} />);
  const sel = screen.getAllByRole('combobox').find((s) =>
    Array.from((s as HTMLSelectElement).options).some((o) => o.value === 'bruno')) as HTMLSelectElement;
  fireEvent.change(sel, { target: { value: 'bruno' } });
  return screen.getByRole('button', { name: /Rolar Ataque/ }) as HTMLButtonElement;
}

beforeEach(() => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { cleanup(); limparMesa(); });

describe('Estilo Massivo em combate', () => {
  it('escala', () => { expect(getMassivoDamage(1)).toBe(1); expect(getMassivoDamage(16)).toBe(5); });
  it('Espada Grande adjacente: dano 2 é rerrolado e soma +1', async () => {
    forcarDados(19, 2, 9); // acerto 19, dano 2 → rerrola para 9
    const btn = preparar(esp('Espada Grande'), { ana: [0, 0], bruno: [1, 0] });
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect(log()).toContain('Estilo Massivo: +1 dano'), { timeout: 4000 });
    expect(log()).toContain('Estilo Massivo rerrolou: 2→9');
  });
  it('Espada Grande a 4,5 m: bloqueado', () => {
    expect(preparar(esp('Espada Grande'), { ana: [0, 0], bruno: [3, 0] }).disabled).toBe(true);
  });
  it('Espada Curta (leve, uma mão): sem bônus nem rerrolagem', async () => {
    forcarDados(19, 1);
    const btn = preparar(esp('Espada Curta'), { ana: [0, 0], bruno: [1, 0] });
    fireEvent.click(btn);
    await waitFor(() => expect(log()).toContain('atacou com'), { timeout: 8000 });
    expect(log()).not.toContain('Massivo');
  });
});
