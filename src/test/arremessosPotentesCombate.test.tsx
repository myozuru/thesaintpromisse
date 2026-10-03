import { selecionarAlvoNoMapaUI } from './helpers/alvoMapaUI';
// @vitest-environment jsdom
/**
 * Arremessos Potentes (Especialista em Combate, nv 2) em combate real:
 * mesa em memória, peças no mapa, turno de iniciativa, cliques reais,
 * dano aplicado de fato na vida do alvo com RD ignorada.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { getSpecAbilitiesFor } from '@/lib/specAbilities';
import { arremessosPotentesStep } from '@/lib/arremessosPotentes';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados } from './helpers/mesaReal';

const AP = [{ abilityId: 'ec-arremessos-potentes', chosenAtLevel: 2 }];
const esp = (arma: string, extra: Record<string, unknown> = {}) => ficha('ana', {
  profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  level: 2, mainHandWeaponName: arma, offHandWeaponName: null, rangedTrained: true, meleeTrained: true,
  chosenSpecAbilities: AP, peCurrent: 5, peMax: 10, attacksThisTurn: 0, ...extra,
} as never);
const alvo = (rd = 3) => ficha('bruno', { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, escCurrent: 0, rd } as never);
const textoLog = () => useLogStore.getState().logs.map((l) => l.message).join('\n');
const danoDoLog = () => Number(/💥 Dano: (\d+)/.exec(textoLog())?.[1] ?? NaN);

async function preparar(c: ReturnType<typeof esp>, pos: Record<string, [number, number]>, turnoDe = 'ana', rd = 3) {
  useLogStore.getState().clearLogs();
  montarMesa([c, alvo(rd)], pos);
  useCombatStore.setState({
    inCombat: true, round: 1,
    initiativeOrder: [{ charId: 'ana' }, { charId: 'bruno' }] as never,
    currentTurnIndex: turnoDe === 'ana' ? 0 : 1,
  } as never);
  render(<AttackPanel character={c} />);
  await selecionarAlvoNoMapaUI('bruno');
  return screen.getByRole('button', { name: /Rolar Ataque/ }) as HTMLButtonElement;
}

async function atacarEDano(btn: HTMLButtonElement) {
  fireEvent.click(btn);
  const dano = await screen.findByRole('button', { name: /Rolar Dano/ }, { timeout: 8000 });
  fireEvent.click(dano);
  await waitFor(() => expect(textoLog()).toMatch(/💥 Dano:/), { timeout: 8000 });
}

beforeEach(async () => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { cleanup(); limparMesa(); vi.restoreAllMocks(); useCombatStore.setState({ inCombat: false, initiativeOrder: [] } as never); });

describe('Arremessos Potentes', () => {
  it('está no catálogo do Especialista em Combate (nv 2)', async () => {
    const ids = getSpecAbilitiesFor('Especialista em Combate').map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['ec-arremessos-potentes', 'ec-arsenal-ciclico', 'ec-assumir-postura']));
  });

  it('sobe 1 nível de dano só em arma de arremesso', async () => {
    const c = esp('Dardo');
    expect(arremessosPotentesStep(c, { range: 'thrown', properties: [] })).toBe(1);
    expect(arremessosPotentesStep(c, { range: 'melee', properties: [] })).toBe(0);
    expect(arremessosPotentesStep(esp('Dardo', { chosenSpecAbilities: [] }), { range: 'thrown', properties: [] })).toBe(0);
  });

  it('Dardo dentro do alcance, sem PE gasto: +1 nível e RD cheia descontada', async () => {
    forcarDados(15, 4, 4, 4);
    await atacarEDano(await preparar(esp('Dardo'), { ana: [0, 0], bruno: [4, 0] }));
    expect(textoLog()).toContain('Arremessos Potentes: +1 nível de dano');
    expect(100 - pegarFicha('bruno').hpCurrent).toBe(Math.max(0, danoDoLog() - 3));
    expect(pegarFicha('ana').peCurrent).toBe(5);
  });

  it('gasta 1 PE no começo do turno: arremesso ignora RD = treinamento (2)', async () => {
    forcarDados(15, 4, 4, 4);
    const btn = await preparar(esp('Dardo'), { ana: [0, 0], bruno: [4, 0] });
    fireEvent.click(screen.getByRole('button', { name: /Gastar 1 PE/ }));
    expect(pegarFicha('ana').peCurrent).toBe(4);
    await screen.findByText(/Ativo neste turno/);
    await atacarEDano(btn);
    expect(textoLog()).toContain('Arremessos Potentes: ignora 2 de RD');
    expect(100 - pegarFicha('bruno').hpCurrent).toBe(Math.max(0, danoDoLog() - 1));
  });

  it('alvo fora do alcance: ataque bloqueado', async () => {
    await expect(preparar(esp('Dardo'), { ana: [0, 0], bruno: [40, 0] })).rejects.toThrow('Alvo fora do alcance');
  });

  it('arma corpo a corpo: sem +1 nível e ativação não afeta a RD', async () => {
    forcarDados(15, 4, 4, 4);
    const btn = await preparar(esp('Espada Longa'), { ana: [0, 0], bruno: [1, 0] });
    fireEvent.click(screen.getByRole('button', { name: /Gastar 1 PE/ }));
    await atacarEDano(btn);
    expect(textoLog()).not.toContain('Arremessos Potentes: +1');
    expect(textoLog()).not.toContain('ignora 2 de RD');
    expect(100 - pegarFicha('bruno').hpCurrent).toBe(Math.max(0, danoDoLog() - 3));
  });

  it('sem PE: botão bloqueado', async () => {
    await preparar(esp('Dardo', { peCurrent: 0 }), { ana: [0, 0], bruno: [4, 0] });
    expect((screen.getByRole('button', { name: /Gastar 1 PE/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('arremessos-potentes').textContent).toMatch(/PE insuficiente/);
  });

  it('fora do seu turno ou depois de atacar: não pode ativar', async () => {
    await preparar(esp('Dardo'), { ana: [0, 0], bruno: [4, 0] }, 'bruno');
    expect(screen.getByTestId('arremessos-potentes').textContent).toMatch(/começo do seu turno/);
    cleanup(); limparMesa();
    await preparar(esp('Dardo', { attacksThisTurn: 1 }), { ana: [0, 0], bruno: [4, 0] });
    expect(screen.getByTestId('arremessos-potentes').textContent).toMatch(/já atacou/);
  });

  it('personagem sem a habilidade não vê o controle', async () => {
    await preparar(esp('Dardo', { chosenSpecAbilities: [] }), { ana: [0, 0], bruno: [4, 0] });
    expect(screen.queryByTestId('arremessos-potentes')).toBeNull();
  });
});
