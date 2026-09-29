// @vitest-environment jsdom
/**
 * Estilo do Duelista no combate real (mesa em memória): peças no mapa,
 * alvo adjacente, clique em "Rolar Ataque" no painel de verdade e conferência
 * do registro de combate — com a mão livre (ativo) e com escudo (inativo).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { ficha, montarMesa, limparMesa, comoTela } from './helpers/mesaReal';

const duelista = (extra: Record<string, unknown> = {}) => ficha('ana', {
  profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  combatStyles: ['duelista'], level: 1, mainHandWeaponName: 'Espada Longa', offHandWeaponName: null, ...extra,
} as never);
const alvo = () => ficha('bruno', { category: 'INIMIGO' } as never);

function selecionarAlvo(id: string) {
  const sel = screen.getAllByRole('combobox').find((s) =>
    Array.from((s as HTMLSelectElement).options).some((o) => o.value === id)) as HTMLSelectElement;
  fireEvent.change(sel, { target: { value: id } });
}
const textoLog = () => JSON.stringify(useLogStore.getState());

async function atacar(c: ReturnType<typeof duelista>, pos: Record<string, [number, number]>) {
  montarMesa([c, alvo()], pos);
  render(<AttackPanel character={c} />);
  selecionarAlvo('bruno');
  const btn = screen.getByRole('button', { name: /Rolar Ataque/ }) as HTMLButtonElement;
  return btn;
}

beforeEach(() => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { cleanup(); limparMesa(); vi.restoreAllMocks(); });

describe('Duelista em combate', () => {
  it('adjacente (1,5 m), mão livre: rola e o registro mostra o bônus do Duelista', async () => {
    const btn = await atacar(duelista(), { ana: [0, 0], bruno: [1, 0] });
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toContain('Estilo do Duelista: +1 acerto, +2 dano'), { timeout: 8000 });
  });

  it('com escudo: ataca, mas o bônus não entra e o registro explica', async () => {
    const btn = await atacar(duelista({ equippedShieldId: 'escudo-leve' }), { ana: [0, 0], bruno: [1, 0] });
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toContain('Duelista inativo (escudo na outra mão)'), { timeout: 8000 });
  });

  it('fora do alcance (4,5 m): botão bloqueado, sem ataque', async () => {
    const btn = await atacar(duelista(), { ana: [0, 0], bruno: [3, 0] });
    expect(btn.disabled).toBe(true);
  });
});
