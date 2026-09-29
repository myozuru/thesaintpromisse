// @vitest-environment jsdom
/**
 * Golpe Especial (Especialista nv 4) no combate real em memória: peças no mapa,
 * cliques reais, dados forçados, dentro/fora do alcance e PE insuficiente.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { useMapStore } from '@/stores/useMapStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { resetPrecisoUses } from '@/lib/golpeEspecial';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados } from './helpers/mesaReal';

const esp = (extra: Record<string, unknown> = {}) =>
  ficha('ana', {
    profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate', level: 4,
    attributes: [{ name: 'Sabedoria', value: 14 }],
    mainHandWeaponName: 'Espada Longa', peCurrent: 10, preparoCurrent: 5, ...extra,
  } as never);
const inimigo = (id: string, extra: Record<string, unknown> = {}) => ficha(id, { category: 'INIMIGO', ...extra } as never);

const textoLog = () => useLogStore.getState().logs.map((l) => l.message).join('\n');
function selecionarAlvo(id: string) {
  const sel = screen.getAllByRole('combobox').find((s) =>
    s.getAttribute('aria-label') !== 'Alvo extra do Golpe Amplo' &&
    Array.from((s as HTMLSelectElement).options).some((o) => o.value === id)) as HTMLSelectElement;
  fireEvent.change(sel, { target: { value: id } });
}
const golpe = (nome: string) => fireEvent.click(screen.getByRole('button', { name: `Golpe ${nome}` }));

async function montar(c: ReturnType<typeof esp>, pos: Record<string, [number, number]> = { ana: [0, 0], bruno: [1, 0], caio: [0, 1] }, extras: Record<string, Record<string, unknown>> = {}) {
  useLogStore.getState().clearLogs();
  montarMesa([c, inimigo('bruno', extras.bruno), inimigo('caio', extras.caio)], pos);
  render(<AttackPanel character={c} />);
  selecionarAlvo('bruno');
  return screen.getByRole('button', { name: /Rolar Ataque/ }) as HTMLButtonElement;
}

beforeEach(() => { comoTela({ profileId: 'p-ana', role: 'PLAYER' }); resetPrecisoUses(); });
afterEach(() => { cleanup(); limparMesa(); vi.restoreAllMocks(); });

describe('Golpe Especial em combate', () => {
  it('não aparece antes do nível 4', async () => {
    await montar(esp({ level: 3 }));
    expect(screen.queryByLabelText('Golpe Especial')).toBeNull();
  });

  it('Atroz + Letal: gasta 3 PE e registra dado extra e margem', async () => {
    forcarDados(19, 5, 5, 5, 5, 5, 5);
    const btn = await montar(esp());
    golpe('Atroz'); golpe('Letal');
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toContain('gasta 3 PE'), { timeout: 8000 });
    await waitFor(() => expect(textoLog()).toMatch(/Atroz: \+1 dado/), { timeout: 8000 });
    expect(textoLog()).toMatch(/Crítico/); // 19 vira crítico com Letal (espada 19→18 ou 20→19)
    expect(pegarFicha('ana').peCurrent).toBe(7);
  });

  it('Desfocado ×1 + Lento: custo mínimo 1 PE e consome o movimento', async () => {
    useCombatStore.setState({ inCombat: true, movementUsedByChar: {} } as never);
    forcarDados(10, 3, 3, 3);
    const btn = await montar(esp());
    golpe('Atroz'); // +1
    golpe('Desfocado'); // −1
    golpe('Lento'); // −2 → mínimo 1
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toContain('gasta 1 PE'), { timeout: 8000 });
    expect(textoLog()).toMatch(/−4 acerto/);
    expect(useCombatStore.getState().movementUsedByChar.ana).toBeGreaterThan(100);
    useCombatStore.setState({ inCombat: false } as never);
  });

  it('Lento bloqueia se já se moveu no turno (nada gasto)', async () => {
    useCombatStore.setState({ inCombat: true, movementUsedByChar: { ana: 3 } } as never);
    const btn = await montar(esp());
    golpe('Lento'); golpe('Atroz'); golpe('Letal');
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toMatch(/Lento exige ação completa/));
    expect(pegarFicha('ana').peCurrent).toBe(10);
    useCombatStore.setState({ inCombat: false, movementUsedByChar: {} } as never);
  });

  it('PE insuficiente: bloqueia sem gastar nem mover peças (com Investida)', async () => {
    const btn = await montar(esp({ peCurrent: 1 }), { ana: [0, 0], bruno: [3, 0], caio: [0, 1] });
    const antes = { ...Object.values(useMapStore.getState().entities).find((e) => e?.characterId === 'ana')! };
    fireEvent.click(screen.getAllByRole('button').find((b) => /Investida Imediata/.test(b.textContent ?? ''))!);
    golpe('Letal');
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toMatch(/PE insuficiente/));
    const depois = Object.values(useMapStore.getState().entities).find((e) => e?.characterId === 'ana')!;
    expect(depois.x).toBe(antes.x);
    expect(pegarFicha('ana').preparoCurrent).toBe(5);
    expect(pegarFicha('ana').peCurrent).toBe(1);
  });

  it('Longo libera alvo a 3 m com espada; sem Longo continua bloqueado', async () => {
    const btn = await montar(esp(), { ana: [0, 0], bruno: [2, 0], caio: [0, 1] });
    expect(btn.disabled).toBe(true);
    golpe('Longo');
    expect(btn.disabled).toBe(false);
    forcarDados(15, 4, 4);
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toContain('gasta 1 PE'), { timeout: 8000 });
    expect(textoLog()).not.toMatch(/não pode atacar/);
  });

  it('Amplo: 2º alvo no alcance rola separado; fora do alcance bloqueia', async () => {
    let btn = await montar(esp(), { ana: [0, 0], bruno: [1, 0], caio: [4, 4] });
    golpe('Amplo');
    fireEvent.change(screen.getByLabelText('Alvo extra do Golpe Amplo'), { target: { value: 'caio' } });
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toMatch(/Amplo: caio está a .* faltam/));
    expect(pegarFicha('ana').peCurrent).toBe(10);
    cleanup(); limparMesa();

    forcarDados(18, 4, 4, 18, 4, 4);
    btn = await montar(esp());
    golpe('Amplo');
    fireEvent.change(screen.getByLabelText('Alvo extra do Golpe Amplo'), { target: { value: 'caio' } });
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toMatch(/Golpe Amplo: ana atinge também caio/), { timeout: 8000 });
    expect(pegarFicha('ana').peCurrent).toBe(8);
  });

  it('Sanguinário ×2 aplica sangramento médio no acerto', async () => {
    forcarDados(18, 4, 4, 4);
    const btn = await montar(esp());
    fireEvent.click(screen.getByRole('button', { name: 'Mais Sanguinário' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mais Sanguinário' }));
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toMatch(/sangramento médio/), { timeout: 8000 });
    expect(pegarFicha('ana').peCurrent).toBe(6);
    expect((pegarFicha('bruno').activeConditions ?? []).some((c) => c.name === 'Sangramento Médio')).toBe(true);
  });

  it('Sacrifício tira 15 PV do atacante', async () => {
    forcarDados(2, 1, 1);
    const btn = await montar(esp({ hpCurrent: 40, hpMax: 40 } as never));
    golpe('Atroz'); golpe('Sacrifício');
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toMatch(/Sacrifício: ana recebe 15/), { timeout: 8000 });
    expect(pegarFicha('ana').hpCurrent).toBe(25);
  });

  it('Preciso: vantagem e custa 2 PE no 2º uso do turno', async () => {
    forcarDados(3, 17, 4, 4);
    const btn = await montar(esp());
    golpe('Preciso');
    fireEvent.click(btn);
    await waitFor(() => expect(textoLog()).toMatch(/Preciso: vantagem/), { timeout: 8000 });
    expect(pegarFicha('ana').peCurrent).toBe(9);
    cleanup();
    render(<AttackPanel character={pegarFicha('ana')} />);
    expect(screen.getByRole('button', { name: 'Golpe Preciso' }).textContent).toContain('+2 PE');
  });
});
