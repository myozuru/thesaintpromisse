// @vitest-environment jsdom
/**
 * Artes do Combate no combate real (mesa em memória): peças no mapa, clique
 * de verdade nos toggles e em "Rolar Ataque", conferindo preparo gasto,
 * penalidade de Defesa no alvo, bônus próprio e bloqueios de requisito.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha } from './helpers/mesaReal';

const esp = (extra: Record<string, unknown> = {}) =>
  ficha('ana', {
    profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate', level: 5,
    attributes: [{ name: 'Sabedoria', value: 18 }], // SAB +4 → metade 2, execução 3d6, investida 6 m
    mainHandWeaponName: 'Espada Longa', preparoCurrent: 8, ...extra,
  } as never);
const alvo = (extra: Record<string, unknown> = {}) =>
  ficha('bruno', { category: 'INIMIGO', ...extra } as never);

function selecionarAlvo(id: string) {
  const sel = screen.getAllByRole('combobox').find((s) =>
    Array.from((s as HTMLSelectElement).options).some((o) => o.value === id)) as HTMLSelectElement;
  fireEvent.change(sel, { target: { value: id } });
}
const textoLog = () => JSON.stringify(useLogStore.getState());
const toggle = (nome: RegExp) => {
  const btn = screen.getAllByRole('button').find((b) => nome.test(b.textContent ?? ''));
  expect(btn, `toggle ${nome}`).toBeTruthy();
  fireEvent.click(btn!);
};

async function montar(c: ReturnType<typeof esp>, alvoExtra: Record<string, unknown> = {}, pos: Record<string, [number, number]> = { ana: [0, 0], bruno: [1, 0] }) {
  montarMesa([c, alvo(alvoExtra)], pos);
  render(<AttackPanel character={c} />);
  selecionarAlvo('bruno');
  return screen.getByRole('button', { name: /Rolar Ataque/ }) as HTMLButtonElement;
}

beforeEach(() => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { cleanup(); limparMesa(); vi.restoreAllMocks(); });

describe('Artes do Combate em combate', () => {
  it('Distração Letal: gasta 1 PP e, no acerto, aplica −2 Defesa no alvo por 1 rodada', async () => {
    const btn = await montar(esp());
    toggle(/Distração Letal/);
    fireEvent.click(btn);
    await waitFor(() => {
      const t = textoLog();
      expect(t).toMatch(/gasta 1 Preparo: Distração Letal|Distração Letal/);
    }, { timeout: 8000 });
    await waitFor(() => {
      const bruno = pegarFicha('bruno');
      const ana = pegarFicha('ana');
      // Preparo foi gasto independente do resultado:
      expect(ana.preparoCurrent).toBe(7);
      if (textoLog().includes('✅ Acerto') || textoLog().includes('💥 Crítico')) {
        expect(bruno.arteDefensePenalty?.amount).toBe(2);
        expect(bruno.arteDefensePenalty?.byName).toBe('Ana');
      }
    }, { timeout: 8000 });
  });

  it('Golpe Descendente: no acerto CaC, a própria Defesa sobe +2 até o próximo turno', async () => {
    const btn = await montar(esp());
    toggle(/Golpe Descendente/);
    fireEvent.click(btn);
    await waitFor(() => expect(pegarFicha('ana').preparoCurrent).toBe(7), { timeout: 8000 });
    if (textoLog().includes('✅ Acerto') || textoLog().includes('💥 Crítico')) {
      expect(pegarFicha('ana').arteGolpeDescendente?.amount).toBe(2);
    }
  });

  it('Execução Silenciosa: sem alvo Desprevenido o botão fica desabilitado e nada é gasto', async () => {
    const btn = await montar(esp());
    const chip = screen.getAllByRole('button').find((b) => /Execução Silenciosa/.test(b.textContent ?? ''))!;
    expect(chip).toBeTruthy();
    expect((chip as HTMLButtonElement).disabled).toBe(true); // caso inválido bloqueado na UI
    fireEvent.click(chip);
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toContain('Rolagem de Ataque'), { timeout: 8000 });
    expect(pegarFicha('ana').preparoCurrent).toBe(8); // nada gasto
    expect(textoLog()).not.toContain('Execução Silenciosa: +');
  });

  it('Execução Silenciosa com alvo Desprevenido: gasta 1 PP e adiciona +3d6 no dano', async () => {
    const btn = await montar(esp(), { activeConditions: [{ conditionId: 'desprevenido', appliedAt: 0 }] });
    toggle(/Execução Silenciosa/);
    fireEvent.click(btn);
    await waitFor(() => expect(pegarFicha('ana').preparoCurrent).toBe(7), { timeout: 8000 });
    if (textoLog().includes('✅ Acerto') || textoLog().includes('💥 Crítico')) {
      expect(textoLog()).toContain('Execução Silenciosa: +3d6');
    }
  });

  it('Investida Imediata: aproxima a peça até o alcance e ataca (6 m de SAB)', async () => {
    // Alvo a 6 m (4 casas): investida cobre até 6 m, chega ao alcance de 1,5 m.
    const btn = await montar(esp(), {}, { ana: [0, 0], bruno: [4, 0] });
    expect(btn.disabled).toBe(true); // fora do alcance normal (1,5 m)
    toggle(/Investida Imediata/);
    await waitFor(() => expect(btn.disabled).toBe(false), { timeout: 4000 });
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toContain('Investida Imediata'), { timeout: 8000 });
    expect(pegarFicha('ana').preparoCurrent).toBe(6); // custou 2 PP
  });

  it('preparo insuficiente: Investida (2 PP) fica desabilitada com 1 PP e o ataque não gasta nada', async () => {
    const btn = await montar(esp({ preparoCurrent: 1 }));
    const chip = screen.getAllByRole('button').find((b) => /Investida Imediata/.test(b.textContent ?? ''))!;
    expect((chip as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(chip); // clique ignorado
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toContain('Rolagem de Ataque'), { timeout: 8000 });
    expect(pegarFicha('ana').preparoCurrent).toBe(1);
    expect(textoLog()).not.toContain('Investida Imediata:');
  });
});
