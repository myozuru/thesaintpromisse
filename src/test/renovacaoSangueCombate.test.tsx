// @vitest-environment jsdom
/**
 * Renovação pelo Sangue (Especialista nv 6) no combate real em memória:
 * peças no mapa, cliques reais, crítico forçado e alvo reduzido a 0 PV.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados } from './helpers/mesaReal';

const esp = (extra: Record<string, unknown> = {}) =>
  ficha('ana', {
    profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate', level: 6,
    attributes: [{ name: 'Sabedoria', value: 14 }],
    mainHandWeaponName: 'Espada Longa', peCurrent: 5, peMax: 10, ...extra,
  } as never);
const inimigo = (id: string, extra: Record<string, unknown> = {}) => ficha(id, { category: 'INIMIGO', ...extra } as never);

const textoLog = () => useLogStore.getState().logs.map((l) => l.message).join('\n');
function selecionarAlvo(id: string) {
  const sel = screen.getAllByRole('combobox').find((s) =>
    Array.from((s as HTMLSelectElement).options).some((o) => o.value === id)) as HTMLSelectElement;
  fireEvent.change(sel, { target: { value: id } });
}

async function montar(c: ReturnType<typeof esp>, extras: Record<string, Record<string, unknown>> = {}) {
  useLogStore.getState().clearLogs();
  montarMesa([c, inimigo('bruno', extras.bruno)], { ana: [0, 0], bruno: [1, 0] });
  render(<AttackPanel character={c} />);
  selecionarAlvo('bruno');
  return screen.getByRole('button', { name: /Rolar Ataque/ }) as HTMLButtonElement;
}

beforeEach(() => { comoTela({ profileId: 'p-ana', role: 'PLAYER' }); });
afterEach(() => { cleanup(); limparMesa(); vi.restoreAllMocks(); });

describe('Renovação pelo Sangue em combate', () => {
  it('crítico (d20=20) recupera 1 PE e registra no log', async () => {
    forcarDados(20, 5, 5);
    const btn = await montar(esp());
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toMatch(/Renovação pelo Sangue: crítico/), { timeout: 8000 });
    expect(pegarFicha('ana').peCurrent).toBe(6);
  });

  it('crítico com PE no máximo não ultrapassa', async () => {
    forcarDados(20, 5, 5);
    const btn = await montar(esp({ peCurrent: 10, peMax: 10 }));
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toMatch(/Crítico/), { timeout: 8000 });
    expect(pegarFicha('ana').peCurrent).toBe(10);
    expect(textoLog()).not.toMatch(/Renovação pelo Sangue/);
  });

  it('acerto comum (sem crítico) não recupera PE', async () => {
    forcarDados(15, 5, 5);
    const btn = await montar(esp());
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toMatch(/Acerto/), { timeout: 8000 });
    expect(pegarFicha('ana').peCurrent).toBe(5);
    expect(textoLog()).not.toMatch(/Renovação pelo Sangue/);
  });

  it('personagem nv 4 (sem a habilidade) não recupera nem em crítico', async () => {
    forcarDados(20, 5, 5);
    const btn = await montar(esp({ level: 4 }));
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toMatch(/Crítico/), { timeout: 8000 });
    expect(pegarFicha('ana').peCurrent).toBe(5);
    expect(textoLog()).not.toMatch(/Renovação pelo Sangue/);
  });

  it('reduzir o alvo a 0 PV recupera 1 PE (via applyDamage com attackerId)', async () => {
    await montar(esp());
    useCharacterStore.getState().applyDamage('bruno', 999, 'DCO', { attackerId: 'ana' });
    expect(pegarFicha('bruno').hpCurrent).toBeLessThanOrEqual(0);
    expect(pegarFicha('ana').peCurrent).toBe(6);
    expect(textoLog()).toMatch(/Renovação pelo Sangue: ana reduziu bruno a 0 PV/);
  });

  it('dano sem zerar PV do alvo não recupera', async () => {
    await montar(esp(), { bruno: { hpCurrent: 100, hpMax: 100 } });
    useCharacterStore.getState().applyDamage('bruno', 10, 'DCO', { attackerId: 'ana' });
    expect(pegarFicha('bruno').hpCurrent).toBeGreaterThan(0);
    expect(pegarFicha('ana').peCurrent).toBe(5);
  });

  it('zerar PV sem atacante identificado não recupera', async () => {
    await montar(esp());
    useCharacterStore.getState().applyDamage('bruno', 999, 'DCO');
    expect(pegarFicha('bruno').hpCurrent).toBeLessThanOrEqual(0);
    expect(pegarFicha('ana').peCurrent).toBe(5);
  });
});
