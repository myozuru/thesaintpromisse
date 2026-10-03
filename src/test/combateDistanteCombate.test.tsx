import { selecionarAlvoNoMapaUI } from './helpers/alvoMapaUI';
// @vitest-environment jsdom
/** Estilo Distante em combate real (mesa em memória, peças no mapa, clique real). */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { getDistanteBonus } from '@/lib/combateEstilos';
import { ficha, montarMesa, limparMesa, comoTela } from './helpers/mesaReal';

const esp = (arma: string, extra: Record<string, unknown> = {}) => ficha('ana', {
  profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  combatStyles: ['distante'], level: 1, mainHandWeaponName: arma, offHandWeaponName: null, ...extra,
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

describe('Estilo Distante em combate', () => {
  it('escala por nível', async () => {
    expect(getDistanteBonus(1)).toEqual({ hit: 1, damage: 2 });
    expect(getDistanteBonus(12)).toEqual({ hit: 2, damage: 5 });
  });
  it('Arco Curto a 45 m (dentro): rola com +1 acerto, +2 dano', async () => {
    const btn = await preparar(esp('Arco Curto'), { ana: [0, 0], bruno: [30, 0] });
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect(log()).toContain('Estilo Distante: +1 acerto, +2 dano'), { timeout: 8000 });
  });
  it('Arco Curto a 60 m (fora): bloqueado', async () => {
    await expect(preparar(esp('Arco Curto'), { ana: [0, 0], bruno: [40, 0] })).rejects.toThrow('Alvo fora do alcance');
  });
  it('espada corpo a corpo adjacente: sem bônus do Distante', async () => {
    const btn = await preparar(esp('Espada Longa'), { ana: [0, 0], bruno: [1, 0] });
    fireEvent.click(btn);
    await waitFor(() => expect(log()).toContain('atacou com'), { timeout: 8000 });
    expect(log()).not.toContain('Estilo Distante');
  });
});
