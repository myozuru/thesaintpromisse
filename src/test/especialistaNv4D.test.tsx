// @vitest-environment jsdom
/**
 * Especialista nv 4 (parte D): Guarda Estudada e Espírito de Luta.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { computeDefenseBreakdown } from '@/lib/defenseCalc';
import { guardaEstudadaDefesa, guardaEstudadaTrBonus, guardaEstudadaSave } from '@/lib/guardaEstudada';
import {
  espiritoLutaAtivar, espiritoLutaAtivo, espiritoLutaBonus, espiritoLutaPodeUsar,
} from '@/lib/espiritoLuta';
import { rollAttack, buildAttackContext } from '@/lib/combatEngine';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados } from './helpers/mesaReal';

const esp = (habs: string[], extra: Record<string, unknown> = {}) =>
  ficha('ana', {
    profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate', level: 5,
    attributes: [{ name: 'Destreza', value: 14 }, { name: 'Força', value: 12 }, { name: 'Sabedoria', value: 18 }],
    mainHandWeaponName: 'Espada Longa', peCurrent: 10, peMax: 10, ca: 10,
    actionsCurrent: 1, actionsMax: 1, bonusActionsCurrent: 1, reactionsCurrent: 1,
    escCurrent: 0, escMax: 0,
    chosenSpecAbilities: habs.map((abilityId) => ({ abilityId })), ...extra,
  } as never);

const log = () => useLogStore.getState().logs.map((l) => l.message).join('\n');

beforeEach(() => { comoTela({ profileId: 'p-ana', role: 'PLAYER' }); useLogStore.getState().clearLogs(); });
afterEach(() => { cleanup(); limparMesa(); useCombatStore.setState({ inCombat: false, combatId: null, initiativeOrder: [] } as never); vi.restoreAllMocks(); });

describe('Guarda Estudada', () => {
  it('soma metade do modificador de Sabedoria na Defesa', () => {
    montarMesa([esp(['ec-guarda-estudada'])], { ana: [0, 0] });
    const c = pegarFicha('ana'); // SAB 18 → mod +4 → +2
    expect(guardaEstudadaDefesa(c)).toBe(2);
    const semHab = { ...c, chosenSpecAbilities: [] } as never;
    const dif = computeDefenseBreakdown(c).total - computeDefenseBreakdown(semHab).total;
    expect(dif).toBe(2);
  });

  it('o bônus é limitado pelo nível do personagem', () => {
    montarMesa([esp(['ec-guarda-estudada'], {
      level: 1,
      attributes: [{ name: 'Destreza', value: 10 }, { name: 'Sabedoria', value: 20 }],
    })], { ana: [0, 0] });
    expect(guardaEstudadaDefesa(pegarFicha('ana'))).toBe(1); // ⌊5/2⌋=2, teto = nível 1
  });

  it('Sabedoria negativa vira penalidade e Sabedoria neutra não muda nada', () => {
    montarMesa([esp(['ec-guarda-estudada'], {
      attributes: [{ name: 'Destreza', value: 10 }, { name: 'Sabedoria', value: 6 }],
    })], { ana: [0, 0] });
    expect(guardaEstudadaDefesa(pegarFicha('ana'))).toBe(-1); // mod −2 → ⌊−2/2⌋ = −1
    limparMesa();
    montarMesa([esp(['ec-guarda-estudada'], {
      attributes: [{ name: 'Destreza', value: 10 }, { name: 'Sabedoria', value: 11 }],
    })], { ana: [0, 0] });
    expect(guardaEstudadaDefesa(pegarFicha('ana'))).toBe(0);
  });

  it('+2 apenas no Teste de Resistência escolhido', () => {
    montarMesa([esp(['ec-guarda-estudada'], {
      specAbilityChoices: { 'ec-guarda-estudada': { kind: 'save', save: 'Fortitude' } },
    })], { ana: [0, 0] });
    const c = pegarFicha('ana');
    expect(guardaEstudadaSave(c)).toBe('Fortitude');
    expect(guardaEstudadaTrBonus(c, 'Fortitude')).toBe(2);
    expect(guardaEstudadaTrBonus(c, 'Reflexos')).toBe(0);
    expect(guardaEstudadaTrBonus(c, 'Fortitude', false)).toBe(0); // perícia homônima não conta
  });

  it('permite escolher Integridade e trocar a escolha', () => {
    montarMesa([esp(['ec-guarda-estudada'])], { ana: [0, 0] });
    expect(guardaEstudadaTrBonus(pegarFicha('ana'), 'Integridade')).toBe(0); // escolha pendente
    useCharacterStore.getState().setSpecAbilityChoice('ana', 'ec-guarda-estudada', { kind: 'save', save: 'Integridade' } as never);
    expect(guardaEstudadaTrBonus(pegarFicha('ana'), 'Integridade')).toBe(2);
    useCharacterStore.getState().setSpecAbilityChoice('ana', 'ec-guarda-estudada', { kind: 'save', save: 'Vontade' } as never);
    expect(guardaEstudadaTrBonus(pegarFicha('ana'), 'Integridade')).toBe(0);
    expect(guardaEstudadaTrBonus(pegarFicha('ana'), 'Vontade')).toBe(2);
  });

  it('sem a habilidade não altera nada', () => {
    montarMesa([esp([])], { ana: [0, 0] });
    expect(guardaEstudadaDefesa(pegarFicha('ana'))).toBe(0);
    expect(guardaEstudadaTrBonus(pegarFicha('ana'), 'Fortitude')).toBe(0);
  });
});

describe('Espírito de Luta', () => {
  it('gasta 1 PE, dá PV temporários iguais ao nível e +2 em ataques', () => {
    montarMesa([esp(['ec-espirito-luta'])], { ana: [0, 0] });
    expect(espiritoLutaBonus(pegarFicha('ana'))).toBe(0);
    const r = espiritoLutaAtivar('ana');
    expect(r.ok).toBe(true);
    const c = pegarFicha('ana');
    expect(c.peCurrent).toBe(9);
    expect(c.escCurrent).toBe(5);
    expect(c.escMax).toBeGreaterThanOrEqual(5);
    expect(espiritoLutaAtivo(c)).toBe(true);
    expect(espiritoLutaBonus(c)).toBe(2);
    expect(c.actionsCurrent).toBe(1); // ação livre: não gasta ação
    expect(c.bonusActionsCurrent).toBe(1);
    expect(log()).toContain('Espírito de Luta');
  });

  it('não pode ser reativado na mesma cena nem sem PE', () => {
    montarMesa([esp(['ec-espirito-luta'])], { ana: [0, 0] });
    espiritoLutaAtivar('ana');
    const segundo = espiritoLutaAtivar('ana');
    expect(segundo.ok).toBe(false);
    limparMesa();
    montarMesa([esp(['ec-espirito-luta'], { peCurrent: 0 })], { ana: [0, 0] });
    const chk = espiritoLutaPodeUsar(pegarFicha('ana'));
    expect(chk.ok).toBe(false);
    expect(chk.reason).toContain('PE');
  });

  it('soma +2 numa jogada de ataque real', async () => {
    montarMesa([
      esp(['ec-espirito-luta']),
      ficha('bruno', { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, escCurrent: 0, rd: 0, defense: 5 } as never),
    ], { ana: [0, 0], bruno: [1, 0] });
    espiritoLutaAtivar('ana');
    forcarDados(10, 5);
    const res = await rollAttack(buildAttackContext({
      attacker: pegarFicha('ana'),
      weapon: { name: 'Espada Longa', group: 'Espada', range: 'melee', damage: '1d8', properties: [] } as never,
      targetDefense: 5,
      situation: { fortuna: false } as never,
    }));
    const notas = (res as { notes?: string[] }).notes ?? [];
    expect(notas.join(' ')).toContain('Espírito de Luta');
  });

  it('o botão aparece na aba de Ataque e aplica o efeito', () => {
    montarMesa([esp(['ec-espirito-luta'])], { ana: [0, 0] });
    render(<AttackPanel character={pegarFicha('ana')} />);
    fireEvent.click(screen.getByTestId('espirito-luta-usar'));
    expect(pegarFicha('ana').peCurrent).toBe(9);
    expect(pegarFicha('ana').escCurrent).toBe(5);
  });

  it('sem a habilidade não há botão nem bônus', () => {
    montarMesa([esp([])], { ana: [0, 0] });
    render(<AttackPanel character={pegarFicha('ana')} />);
    expect(screen.queryByTestId('espirito-luta-usar')).toBeNull();
    expect(espiritoLutaBonus(pegarFicha('ana'))).toBe(0);
  });
});
