import { selecionarAlvoNoMapaUI } from './helpers/alvoMapaUI';
// @vitest-environment jsdom
/** Estilo do Arremessador em combate real (mesa em memória, peças no mapa, clique real). */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { getArremessadorDamage } from '@/lib/combateEstilos';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha } from './helpers/mesaReal';

const esp = (arma: string | null, extra: Record<string, unknown> = {}) => ficha('ana', {
  profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  combatStyles: ['arremessador'], level: 1, mainHandWeaponName: arma, offHandWeaponName: null,
  weaponSwapsThisTurn: 0, bonusActionsCurrent: 1, bonusActionsMax: 1, ...extra,
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

describe('Estilo do Arremessador em combate', () => {
  it('escala de dano', async () => {
    expect(getArremessadorDamage(1)).toBe(2);
    expect(getArremessadorDamage(16)).toBe(6);
  });
  it('Dardo a 9 m (dentro): rola com +2 dano', async () => {
    const btn = await preparar(esp('Dardo'), { ana: [0, 0], bruno: [6, 0] });
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect(log()).toContain('Estilo do Arremessador: +2 dano'), { timeout: 8000 });
  });
  it('Dardo muito longe (60 m): bloqueado', async () => {
    await expect(preparar(esp('Dardo'), { ana: [0, 0], bruno: [40, 0] })).rejects.toThrow('Alvo fora do alcance');
  });
  it('espada adjacente: sem bônus do Arremessador', async () => {
    const btn = await preparar(esp('Espada Longa'), { ana: [0, 0], bruno: [1, 0] });
    fireEvent.click(btn);
    await waitFor(() => expect(log()).toContain('atacou com'), { timeout: 8000 });
    expect(log()).not.toContain('Arremessador');
  });
  it('sacar dardos várias vezes no turno não gasta troca nem Ação Bônus', async () => {
    montarMesa([esp(null, { weaponSwapsThisTurn: 1 })], { ana: [0, 0] });
    const eq = useCharacterStore.getState().equipWeapons;
    expect(eq('ana', { mainHandName: 'Dardo', offHandName: null }).actionUsed).toBe('arremessador');
    expect(eq('ana', { mainHandName: 'Azagaia', offHandName: null }).actionUsed).toBe('arremessador');
    expect(pegarFicha('ana').bonusActionsCurrent).toBe(1);
    expect(pegarFicha('ana').weaponSwapsThisTurn).toBe(1);
  });
  it('sem o estilo, a 2ª troca gasta Ação Bônus', async () => {
    montarMesa([esp(null, { combatStyles: [], weaponSwapsThisTurn: 1 })], { ana: [0, 0] });
    expect(useCharacterStore.getState().equipWeapons('ana', { mainHandName: 'Dardo', offHandName: null }).actionUsed).toBe('bonus');
    expect(pegarFicha('ana').bonusActionsCurrent).toBe(0);
  });
});
