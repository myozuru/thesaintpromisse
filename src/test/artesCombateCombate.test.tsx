import { selecionarAlvoNoMapaUI } from './helpers/alvoMapaUI';
// @vitest-environment jsdom
/**
 * Artes do Combate no combate real (mesa em memória): peças no mapa, clique
 * de verdade nos toggles e em "Rolar Ataque", conferindo preparo gasto,
 * penalidade de Defesa no alvo, bônus próprio e bloqueios de requisito.
 * O log é limpo a cada teste para não vazar resultado entre cenários.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados } from './helpers/mesaReal';

const esp = (extra: Record<string, unknown> = {}) =>
  ficha('ana', {
    profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate', level: 5,
    attributes: [{ name: 'Sabedoria', value: 18 }], // SAB +4 → metade 2, execução 3d6, investida 6 m
    mainHandWeaponName: 'Espada Longa', preparoCurrent: 8, ...extra,
  } as never);
const alvo = (extra: Record<string, unknown> = {}) =>
  ficha('bruno', { category: 'INIMIGO', ...extra } as never);

async function selecionarAlvo(id: string) {
  await selecionarAlvoNoMapaUI(id);
}
const textoLog = () => useLogStore.getState().logs.map((l) => l.message).join('\n');
const toggle = (nome: RegExp) => {
  const btn = screen.getAllByRole('button').find((b) => nome.test(b.textContent ?? ''));
  expect(btn, `toggle ${nome}`).toBeTruthy();
  fireEvent.click(btn!);
};

async function montar(c: ReturnType<typeof esp>, alvoExtra: Record<string, unknown> = {}, pos: Record<string, [number, number]> = { ana: [0, 0], bruno: [1, 0] }) {
  useLogStore.getState().clearLogs();
  montarMesa([c, alvo(alvoExtra)], pos);
  render(<AttackPanel character={c} />);
  await selecionarAlvo('bruno');
  return screen.getByRole('button', { name: /Rolar Ataque/ }) as HTMLButtonElement;
}

beforeEach(async () => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { cleanup(); limparMesa(); vi.restoreAllMocks(); });

describe('Artes do Combate em combate', () => {
  it('Distração Letal: gasta 1 PP e, no acerto, aplica −2 Defesa no alvo por 1 rodada', async () => {
    forcarDados(20, 6, 6, 6, 6); // acerto garantido
    const btn = await montar(esp());
    toggle(/Distração Letal/);
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toContain('gasta 1 Preparo: Distração Letal'), { timeout: 8000 });
    await waitFor(() => expect(textoLog()).toMatch(/✅ Acerto|💥 Crítico/), { timeout: 8000 });
    const bruno = pegarFicha('bruno');
    expect(pegarFicha('ana').preparoCurrent).toBe(7);
    expect(bruno.arteDefensePenalty?.amount).toBe(2);
    expect(bruno.arteDefensePenalty?.byName).toBe('ana');
  });

  it('Distração Letal no erro: gasta o preparo mas NÃO aplica a penalidade', async () => {
    forcarDados(1, 1); // erro garantido
    const btn = await montar(esp());
    toggle(/Distração Letal/);
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toMatch(/❌ Erro|💀 Falha crítica/), { timeout: 8000 });
    expect(pegarFicha('ana').preparoCurrent).toBe(7);
    expect(pegarFicha('bruno').arteDefensePenalty).toBeUndefined();
  });

  it('Golpe Descendente: no acerto CaC, a própria Defesa sobe +2 até o próximo turno', async () => {
    forcarDados(20, 6, 6, 6, 6);
    const btn = await montar(esp());
    toggle(/Golpe Descendente/);
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toMatch(/✅ Acerto|💥 Crítico/), { timeout: 8000 });
    expect(pegarFicha('ana').preparoCurrent).toBe(7);
    expect(pegarFicha('ana').arteGolpeDescendente?.amount).toBe(2);
  });

  it('Execução Silenciosa: sem alvo Desprevenido o botão fica desabilitado e nada é gasto', async () => {
    forcarDados(20, 6, 6);
    const btn = await montar(esp());
    const chip = screen.getAllByRole('button').find((b) => /Execução Silenciosa/.test(b.textContent ?? ''))!;
    expect(chip).toBeTruthy();
    expect((chip as HTMLButtonElement).disabled).toBe(true); // caso inválido bloqueado na UI
    fireEvent.click(chip);
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toMatch(/✅ Acerto|💥 Crítico|❌ Erro/), { timeout: 8000 });
    expect(pegarFicha('ana').preparoCurrent).toBe(8); // nada gasto
    expect(textoLog()).not.toContain('Execução Silenciosa: +');
  });

  it('Execução Silenciosa com alvo Desprevenido: gasta 1 PP e adiciona +3d6 no dano', async () => {
    forcarDados(20, 6, 6, 6, 6, 6, 6);
    const btn = await montar(esp(), { activeConditions: [{ conditionId: 'desprevenido', appliedAt: 0 }] });
    toggle(/Execução Silenciosa/);
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toMatch(/✅ Acerto|💥 Crítico/), { timeout: 8000 });
    expect(pegarFicha('ana').preparoCurrent).toBe(7);
    expect(textoLog()).toContain('Execução Silenciosa: +3d6');
  });

  it('Investida Imediata: aproxima a peça até o alcance e ataca (6 m de SAB)', async () => {
    forcarDados(20, 6, 6);
    // Alvo a 6 m (4 casas): investida cobre até 6 m, chega ao alcance de 1,5 m.
    await expect(montar(esp(), {}, { ana: [0, 0], bruno: [4, 0] })).rejects.toThrow('Alvo fora do alcance');
    toggle(/Investida Imediata/);
    await selecionarAlvo('bruno');
    const btn = screen.getByRole('button', { name: /Rolar Ataque/ }) as HTMLButtonElement;
    await waitFor(() => expect(btn.disabled).toBe(false), { timeout: 4000 });
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toContain('Investida Imediata'), { timeout: 8000 });
    expect(pegarFicha('ana').preparoCurrent).toBe(6); // custou 2 PP
    await waitFor(() => expect(textoLog()).toMatch(/✅ Acerto|💥 Crítico|❌ Erro/), { timeout: 8000 });
  });

  it('Investida Imediata além do limite (9 m > 6 m): ataque continua bloqueado e nada é gasto', async () => {
    await expect(montar(esp(), {}, { ana: [0, 0], bruno: [6, 0] })).rejects.toThrow('Alvo fora do alcance');
    toggle(/Investida Imediata/);
    await expect(selecionarAlvo('bruno')).rejects.toThrow('Alvo fora do alcance'); // 9 m − 6 m = 3 m > 1,5 m de alcance
    expect(pegarFicha('ana').preparoCurrent).toBe(8);
  });

  it('preparo insuficiente: Investida (2 PP) fica desabilitada com 1 PP e o ataque não gasta nada', async () => {
    forcarDados(20, 6, 6);
    const btn = await montar(esp({ preparoCurrent: 1 }));
    const chip = screen.getAllByRole('button').find((b) => /Investida Imediata/.test(b.textContent ?? ''))!;
    expect((chip as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(chip); // clique ignorado
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toMatch(/✅ Acerto|💥 Crítico|❌ Erro/), { timeout: 8000 });
    expect(pegarFicha('ana').preparoCurrent).toBe(1);
    expect(textoLog()).not.toContain('Investida Imediata:');
  });
});

const esperar0 = () => new Promise((r) => setTimeout(r, 0));
