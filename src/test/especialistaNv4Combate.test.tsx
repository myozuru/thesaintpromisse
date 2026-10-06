import { selecionarAlvoNoMapaUI } from './helpers/alvoMapaUI';
// @vitest-environment jsdom
/**
 * Especialista em Combate — habilidades de 4º nível em combate real:
 * Aprender Postura, Armas Escolhidas e Arremesso Rápido.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/lib/sounds', async (orig) => {
  const real = await orig<Record<string, unknown>>();
  return Object.fromEntries(Object.keys(real).map((k) => [k, () => {}]));
});
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import type { Character } from '@/types';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useArremessoRapidoStore } from '@/lib/arremessoRapido';
import { posturasLimiteChar, podeAprender } from '@/lib/posturas';
import { armasEscolhidasStep, armasEscolhidasGrupo } from '@/lib/armasEscolhidas';
import { findWeaponByName } from '@/lib/weapons';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados } from './helpers/mesaReal';

const esp = (extra: Record<string, unknown> = {}) => ficha('ana', {
  profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  level: 4, peCurrent: 20, peMax: 20, hpCurrent: 40, hpMax: 40,
  mainHandWeaponName: 'Faca de Arremesso', offHandWeaponName: null,
  meleeTrained: true, rangedTrained: true,
  attributes: [{ name: 'FOR', value: 16 }, { name: 'DES', value: 16 }],
  chosenSpecAbilities: [], attacksThisTurn: 0,
  bonusActionsCurrent: 1, bonusActionsMax: 1, reactionsCurrent: 1, reactionsMax: 1, ...extra,
} as never);
const inimigo = (extra: Record<string, unknown> = {}) => ficha('bruno', {
  category: 'INIMIGO', hpCurrent: 300, hpMax: 300, escCurrent: 0, rd: 0, defense: 5, ...extra,
} as never);
const textoLog = () => useLogStore.getState().logs.map((l) => l.message).join('\n');

function mesa(chars: Character[], round = 1) {
  useLogStore.getState().clearLogs();
  useArremessoRapidoStore.setState({ ataque: null });
  montarMesa(chars, { ana: [0, 0], bruno: [1, 0] });
  useCombatStore.setState({
    inCombat: true, round, movementUsedByChar: {},
    initiativeOrder: [{ charId: 'ana' }, { charId: 'bruno' }] as never, currentTurnIndex: 0,
  } as never);
}

class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= RO;
beforeEach(async () => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { cleanup(); limparMesa(); useCombatStore.setState({ inCombat: false, initiativeOrder: [] } as never); });

describe('Aprender Postura', () => {
  const comPostura = (extra: Record<string, unknown> = {}) => esp({
    chosenSpecAbilities: [{ abilityId: 'ec-assumir-postura', chosenAtLevel: 2 }, { abilityId: 'ec-aprender-postura', chosenAtLevel: 4 }],
    ...extra,
  });

  it('aumenta o limite de posturas em +1, e +1 a mais no nível 10', async () => {
    expect(posturasLimiteChar(comPostura() as never)).toBe(2);
    expect(posturasLimiteChar(comPostura({ level: 10 }) as never)).toBe(4); // 1 base + 1 (nv8) + 2 (Aprender nv4 e nv10)
    expect(posturasLimiteChar(comPostura({ level: 16 }) as never)).toBe(5);
  });

  it('sem a habilidade o limite continua 1 no nível 4', async () => {
    expect(posturasLimiteChar(esp({ chosenSpecAbilities: [{ abilityId: 'ec-assumir-postura', chosenAtLevel: 2 }] }) as never)).toBe(1);
  });

  it('a vaga extra permite aprender uma segunda postura, mas respeita o nível mínimo', async () => {
    const c = comPostura({ posturasAprendidas: ['sol'] }) as unknown as Character;
    expect(podeAprender(c, 'lua').ok).toBe(true);
    expect(podeAprender(c, 'tempestade').ok).toBe(false); // requer nível 10
    const cheio = comPostura({ posturasAprendidas: ['sol', 'lua'] }) as unknown as Character;
    expect(podeAprender(cheio, 'terra').ok).toBe(false);
  });
});

describe('Armas Escolhidas', () => {
  const comGrupo = (grupo: string, extra: Record<string, unknown> = {}) => esp({
    chosenSpecAbilities: [{ abilityId: 'ec-armas-escolhidas', chosenAtLevel: 4 }],
    specAbilityChoices: { 'ec-armas-escolhidas': { kind: 'weapon-group', group: grupo } },
    ...extra,
  });

  it('dá +3 níveis de dano só para o grupo escolhido', async () => {
    const c = comGrupo('Faca') as unknown as Character;
    expect(armasEscolhidasGrupo(c)).toBe('Faca');
    expect(armasEscolhidasStep(c, findWeaponByName('Faca de Arremesso'))).toBe(3);
    expect(armasEscolhidasStep(c, findWeaponByName('Azagaia'))).toBe(0);
  });

  it('sem a habilidade ou sem escolha feita, não altera o dano', async () => {
    expect(armasEscolhidasStep(esp() as unknown as Character, findWeaponByName('Faca de Arremesso'))).toBe(0);
    const semEscolha = esp({ chosenSpecAbilities: [{ abilityId: 'ec-armas-escolhidas', chosenAtLevel: 4 }] }) as unknown as Character;
    expect(armasEscolhidasStep(semEscolha, findWeaponByName('Faca de Arremesso'))).toBe(0);
  });

  it('em combate real o log registra o aumento de dano da arma do grupo', async () => {
    mesa([comGrupo('Faca') as unknown as Character, inimigo()]);
    render(<AttackPanel character={pegarFicha('ana')} />);
    await selecionarAlvoNoMapaUI('bruno');
    forcarDados(19, 4, 4, 4, 4, 4, 4);
    fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
    await waitFor(() => expect(textoLog()).toMatch(/🗡️/), { timeout: 15000 });
    const dano = screen.queryAllByRole('button', { name: /Rolar Dano/ });
    if (dano.length) fireEvent.click(dano[0]);
    await waitFor(() => expect(textoLog()).toMatch(/💥 Dano:/), { timeout: 15000 });
    expect(textoLog()).toMatch(/Armas Escolhidas/);
    expect(pegarFicha('bruno').hpCurrent ?? 0).toBeLessThan(300);
  }, 30000);
});


describe('Arremesso Rápido', () => {
  const comArr = (extra: Record<string, unknown> = {}) => esp({
    chosenSpecAbilities: [{ abilityId: 'ec-arremesso-rapido', chosenAtLevel: 4 }],
    attacksThisTurn: 1, ...extra,
  });

  it('gasta 1 PE e a Ação Bônus e libera o ataque extra contra o alvo', async () => {
    mesa([comArr(), inimigo()]);
    render(<AttackPanel character={pegarFicha('ana')} />);
    fireEvent.change(screen.getByTestId('arremesso-rapido-alvo'), { target: { value: 'bruno' } });
    fireEvent.click(screen.getByTestId('arremesso-rapido-usar'));
    expect(pegarFicha('ana').peCurrent).toBe(19);
    expect(pegarFicha('ana').bonusActionsCurrent).toBe(0);
    expect(useArremessoRapidoStore.getState().ataque?.alvoId).toBe('bruno');
    expect(textoLog()).toMatch(/Arremesso Rápido/);
  });

  it('só uma vez por rodada; volta na rodada seguinte', async () => {
    mesa([comArr(), inimigo()]);
    render(<AttackPanel character={pegarFicha('ana')} />);
    fireEvent.change(screen.getByTestId('arremesso-rapido-alvo'), { target: { value: 'bruno' } });
    fireEvent.click(screen.getByTestId('arremesso-rapido-usar'));
    expect((screen.getByTestId('arremesso-rapido-usar') as HTMLButtonElement).disabled).toBe(true);
  });

  it('não aparece sem arma de arremesso, sem ataque prévio, sem PE ou sem ação bônus', async () => {
    const casos: [Record<string, unknown>, RegExp][] = [
      [{ mainHandWeaponName: 'Espada Longa' }, /arma de arremesso/i],
      [{ attacksThisTurn: 0 }, /primeiro um ataque/i],
      [{ peCurrent: 0 }, /PE insuficiente/i],
      [{ bonusActionsCurrent: 0 }, /ação bônus/i],
    ];
    for (const [extra, motivo] of casos) {
      mesa([comArr(extra), inimigo()]);
      cleanup();
      render(<AttackPanel character={pegarFicha('ana')} />);
      expect(screen.getByTestId('arremesso-rapido').textContent).toMatch(motivo);
      expect((screen.getByTestId('arremesso-rapido-usar') as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('o ataque extra acontece de verdade e causa dano', async () => {
    mesa([comArr(), inimigo()]);
    render(<AttackPanel character={pegarFicha('ana')} />);
    fireEvent.change(screen.getByTestId('arremesso-rapido-alvo'), { target: { value: 'bruno' } });
    fireEvent.click(screen.getByTestId('arremesso-rapido-usar'));
    cleanup();
    render(<AttackPanel character={pegarFicha('ana')} />);
    expect(screen.getByTestId('arremesso-rapido-banner').textContent).toMatch(/bruno/);
    forcarDados(19, 4, 4, 4);
    fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
    await waitFor(() => expect(textoLog()).toMatch(/🗡️/), { timeout: 15000 });
    const dano = screen.queryAllByRole('button', { name: /Rolar Dano/ });
    if (dano.length) fireEvent.click(dano[0]);
    await waitFor(() => expect(textoLog()).toMatch(/💥 Dano:/), { timeout: 15000 });
    expect(useArremessoRapidoStore.getState().ataque).toBeNull();
    expect(pegarFicha('bruno').hpCurrent ?? 0).toBeLessThan(300);
  }, 25000);
});
