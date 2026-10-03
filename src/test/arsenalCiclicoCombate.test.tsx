import { selecionarAlvoNoMapaUI } from './helpers/alvoMapaUI';
// @vitest-environment jsdom
/**
 * Arsenal Cíclico (Especialista em Combate, nv 2) em combate real:
 * peças no mapa, turno de iniciativa, ataques por clique, trocas de arma.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { arsenalBonusAtivo } from '@/lib/arsenalCiclico';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados } from './helpers/mesaReal';

const AC = [{ abilityId: 'ec-arsenal-ciclico', chosenAtLevel: 2 }];
const esp = (arma: string, extra: Record<string, unknown> = {}) => ficha('ana', {
  profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate',
  level: 2, mainHandWeaponName: arma, offHandWeaponName: null, meleeTrained: true, rangedTrained: true,
  chosenSpecAbilities: AC, attacksThisTurn: 0, weaponSwapsThisTurn: 0, bonusActionsCurrent: 1, bonusActionsMax: 1, ...extra,
} as never);
const alvo = () => ficha('bruno', { category: 'INIMIGO', hpCurrent: 200, hpMax: 200, escCurrent: 0, rd: 0 } as never);
const textoLog = () => useLogStore.getState().logs.map((l) => l.message).join('\n');
const trocar = (nome: string, round = useCombatStore.getState().round) =>
  useCharacterStore.getState().equipWeapons('ana', { mainHandName: nome, offHandName: null }, { inCombat: true, round });

function mesa(c: ReturnType<typeof esp>, round = 1) {
  useLogStore.getState().clearLogs();
  montarMesa([c, alvo()], { ana: [0, 0], bruno: [1, 0] });
  useCombatStore.setState({ inCombat: true, round, initiativeOrder: [{ charId: 'ana' }, { charId: 'bruno' }] as never, currentTurnIndex: 0 } as never);
}
async function atacar() {
  cleanup();
  useLogStore.getState().clearLogs();
  render(<AttackPanel character={pegarFicha('ana')} />);
  await selecionarAlvoNoMapaUI('bruno');
  forcarDados(18, 3, 3, 3, 3, 3);
  fireEvent.click(screen.getByRole('button', { name: /Rolar Ataque/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Rolar Dano/ }, { timeout: 8000 }));
  await waitFor(() => expect(textoLog()).toMatch(/💥 Dano:/), { timeout: 8000 });
  return /💥 Dano: \d+ \(([^)]*)\)/.exec(textoLog())?.[1] ?? '';
}

beforeEach(async () => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { cleanup(); limparMesa(); useCombatStore.setState({ inCombat: false, initiativeOrder: [] } as never); });

describe('Arsenal Cíclico', () => {
  it('ataca com Espada, troca para Machado (outro grupo): +1 dado real no dano', async () => {
    mesa(esp('Espada Curta'));
    const semBonus = await atacar();
    expect(semBonus).toMatch(/^1d/);
    const r = trocar('Machado');
    expect(r.ok && r.arsenalBonus).toBe(true);
    const comBonus = await atacar();
    expect(comBonus).toMatch(/^2d/);
    expect(textoLog()).toContain('Arsenal Cíclico: +1 dado');
  });

  it('trocar para arma do MESMO grupo não dá bônus', async () => {
    mesa(esp('Espada Curta'));
    await atacar();
    // Adaga → grupo Faca; Espada Curta → Espada. Usa espada de mesmo grupo:
    const r = trocar('Espada Longa');
    expect(r.ok).toBe(true);
    expect(r.arsenalBonus).toBe(false);
    expect(await atacar()).not.toContain('Arsenal');
  });

  it('sem atacar antes: troca não dá bônus', async () => {
    mesa(esp('Espada Curta'));
    expect(trocar('Machado').arsenalBonus).toBe(false);
  });

  it('troca na rodada seguinte ainda vale; duas rodadas depois não', async () => {
    mesa(esp('Espada Curta'), 1);
    await atacar();
    expect(trocar('Machado', 2).arsenalBonus).toBe(true);
    useCharacterStore.getState().updateCharacter('ana', { arsenalBonus: null, mainHandWeaponName: 'Espada Curta' } as never);
    expect(trocar('Machado', 3).arsenalBonus).toBe(false);
  });

  it('bônus dura até o fim do próximo turno e depois expira', async () => {
    mesa(esp('Espada Curta'), 1);
    await atacar();
    trocar('Machado', 1);
    expect(arsenalBonusAtivo(pegarFicha('ana'), 'Machado', 1)).toBe(true);
    expect(arsenalBonusAtivo(pegarFicha('ana'), 'Machado', 2)).toBe(true);
    expect(arsenalBonusAtivo(pegarFicha('ana'), 'Machado', 3)).toBe(false);
    useCombatStore.setState({ round: 3 } as never);
    expect(await atacar()).toMatch(/^1d/);
  });

  it('troca livre extra: só uma vez por rodada (a próxima gasta Ação Bônus)', async () => {
    mesa(esp('Espada Curta'));
    expect(trocar('Machado').actionUsed).toBe('free');       // troca livre normal
    expect(trocar('Espada Curta').actionUsed).toBe('arsenal'); // Arsenal Cíclico
    expect(pegarFicha('ana').bonusActionsCurrent).toBe(1);
    expect(trocar('Machado').actionUsed).toBe('bonus');      // já usou nesta rodada
    expect(pegarFicha('ana').bonusActionsCurrent).toBe(0);
    expect(trocar('Espada Curta').ok).toBe(false);          // sem AB
  });

  it('personagem sem a habilidade: 2ª troca custa Ação Bônus e não há bônus', async () => {
    mesa(esp('Espada Curta', { chosenSpecAbilities: [] }));
    await atacar();
    expect(trocar('Machado').arsenalBonus).toBe(false);
    expect(trocar('Espada Curta').actionUsed).toBe('bonus');
    expect(screen.queryByTestId('arsenal-ciclico')).toBeNull();
  });
});
