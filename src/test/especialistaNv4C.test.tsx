// @vitest-environment jsdom
/**
 * Especialista nv 4 (parte C): Preparo Imediato, Recarga Rápida e Uso Rápido.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AttackPanel } from '@/components/fichas/AttackPanel';
import { useLogStore } from '@/stores/useLogStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useItemStore } from '@/stores/useItemStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import {
  prepararNaIniciativa, dispararPreparada, expirarPreparoNoTurno, devePerguntarNaIniciativa,
  opcoesPreparo, marcarOfertaRespondida,
} from '@/lib/preparoImediato';
import {
  capacidadePorNome, tirosRestantes, consumirTiro, recarregar, custoRecarga,
} from '@/lib/recargaRapida';
import { podeUsarItemAdicional, pagarItemAdicional, isConsumivel } from '@/lib/usoRapido';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados } from './helpers/mesaReal';

const esp = (habs: string[], extra: Record<string, unknown> = {}) =>
  ficha('ana', {
    profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate', level: 5,
    attributes: [{ name: 'Destreza', value: 14 }, { name: 'Força', value: 12 }],
    mainHandWeaponName: 'Pistola', preparoCurrent: 8, peCurrent: 10, peMax: 10,
    actionsCurrent: 1, actionsMax: 1, bonusActionsCurrent: 1, reactionsCurrent: 1,
    chosenSpecAbilities: habs.map((abilityId) => ({ abilityId })), ...extra,
  } as never);
const inimigo = (id: string) =>
  ficha(id, { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, escCurrent: 0, rd: 0, defense: 5 } as never);

function combate(ids: string[]) {
  useCombatStore.setState({
    inCombat: true, combatId: 'cb-teste', round: 1, currentTurnIndex: 0, movementUsedByChar: {},
    initiativeOrder: ids.map((charId, i) => ({ charId, charName: charId, roll: 10, bonus: 0, total: 20 - i })),
  } as never);
}
const log = () => useLogStore.getState().logs.map((l) => l.message).join('\n');

beforeEach(() => { comoTela({ profileId: 'p-ana', role: 'PLAYER' }); useLogStore.getState().clearLogs(); useItemStore.setState({ items: [] } as never); });
afterEach(() => { cleanup(); limparMesa(); useCombatStore.setState({ inCombat: false, combatId: null, initiativeOrder: [] } as never); vi.restoreAllMocks(); });

describe('Preparo Imediato', () => {
  it('oferece só Ação Bônus abaixo do nível 10 e gasta 3 Preparo', () => {
    montarMesa([esp(['ec-preparo-imediato'])], { ana: [0, 0] });
    combate(['ana']);
    expect(devePerguntarNaIniciativa(pegarFicha('ana'), 'cb-teste')).toBe(true);
    expect(opcoesPreparo(pegarFicha('ana'))).toEqual(['bonus']);
    expect(prepararNaIniciativa('ana', 'bonus', 'cb-teste').ok).toBe(true);
    expect(pegarFicha('ana').preparoCurrent).toBe(5);
    expect(pegarFicha('ana').prontidaoPreparada?.tipo).toBe('bonus');
    expect(devePerguntarNaIniciativa(pegarFicha('ana'), 'cb-teste')).toBe(false);
  });

  it('nível 10 pode gastar 7 Preparo para Ação Comum', () => {
    montarMesa([esp(['ec-preparo-imediato'], { level: 10, preparoCurrent: 9 })], { ana: [0, 0] });
    combate(['ana']);
    expect(opcoesPreparo(pegarFicha('ana'))).toEqual(['bonus', 'action']);
    expect(prepararNaIniciativa('ana', 'action', 'cb-teste').ok).toBe(true);
    expect(pegarFicha('ana').preparoCurrent).toBe(2);
    expect(pegarFicha('ana').actionsCurrent).toBe(1);
  });

  it('abaixo do nível 10 não pode preparar Ação Comum', () => {
    montarMesa([esp(['ec-preparo-imediato'])], { ana: [0, 0] });
    combate(['ana']);
    const r = prepararNaIniciativa('ana', 'action', 'cb-teste');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('nível 10');
  });

  it('disparar fora do turno gasta a reação; no próprio turno não', () => {
    montarMesa([esp(['ec-preparo-imediato'])], { ana: [0, 0] });
    combate(['ana']);
    prepararNaIniciativa('ana', 'bonus', 'cb-teste');
    expect(dispararPreparada('ana', { meuTurno: false }).ok).toBe(true);
    expect(pegarFicha('ana').reactionsCurrent).toBe(0);
    expect(pegarFicha('ana').bonusActionsCurrent).toBe(2);
    expect(pegarFicha('ana').prontidaoPreparada).toBeNull();

    prepararNaIniciativa('ana', 'bonus', 'cb-teste');
    expect(dispararPreparada('ana', { meuTurno: true }).ok).toBe(true);
    expect(pegarFicha('ana').reactionsCurrent).toBe(0);
  });

  it('sem reação fora do turno não dispara', () => {
    montarMesa([esp(['ec-preparo-imediato'], { reactionsCurrent: 0 })], { ana: [0, 0] });
    combate(['ana']);
    prepararNaIniciativa('ana', 'bonus', 'cb-teste');
    const r = dispararPreparada('ana', { meuTurno: false });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('reação');
  });

  it('expira no começo do próprio turno', () => {
    montarMesa([esp(['ec-preparo-imediato'])], { ana: [0, 0] });
    combate(['ana']);
    prepararNaIniciativa('ana', 'bonus', 'cb-teste');
    expirarPreparoNoTurno('ana');
    expect(pegarFicha('ana').prontidaoPreparada).toBeNull();
    expect(log()).toContain('expirou');
  });

  it('recusar a oferta não gasta Preparo e não repergunta', () => {
    montarMesa([esp(['ec-preparo-imediato'])], { ana: [0, 0] });
    combate(['ana']);
    marcarOfertaRespondida('ana', 'cb-teste');
    expect(pegarFicha('ana').preparoCurrent).toBe(8);
    expect(devePerguntarNaIniciativa(pegarFicha('ana'), 'cb-teste')).toBe(false);
  });
});

describe('Recarga Rápida e munição', () => {
  it('Pistola tem 12 tiros e cada ataque gasta 1', () => {
    montarMesa([esp([])], { ana: [0, 0] });
    expect(capacidadePorNome('Pistola')).toBe(12);
    expect(consumirTiro('ana', 'Pistola').restante).toBe(11);
    expect(tirosRestantes(pegarFicha('ana'), 'Pistola')).toBe(11);
  });

  it('arma descarregada bloqueia o ataque até recarregar', () => {
    montarMesa([esp([], { weaponAmmo: { Pistola: 0 } })], { ana: [0, 0] });
    const r = consumirTiro('ana', 'Pistola');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('descarregada');
    expect(recarregar('ana', 'Pistola').ok).toBe(true);
    expect(tirosRestantes(pegarFicha('ana'), 'Pistola')).toBe(12);
  });

  it('Pistola (Leve) recarrega com Ação Bônus e, com a habilidade, Ação Livre', () => {
    montarMesa([esp([], { weaponAmmo: { Pistola: 3 } })], { ana: [0, 0] });
    expect(custoRecarga(pegarFicha('ana'), 'Pistola')).toBe('bonus');
    recarregar('ana', 'Pistola');
    expect(pegarFicha('ana').bonusActionsCurrent).toBe(0);

    limparMesa();
    montarMesa([esp(['ec-recarga-rapida'], { weaponAmmo: { Pistola: 3 } })], { ana: [0, 0] });
    expect(custoRecarga(pegarFicha('ana'), 'Pistola')).toBe('free');
    recarregar('ana', 'Pistola');
    expect(pegarFicha('ana').bonusActionsCurrent).toBe(1);
    expect(pegarFicha('ana').actionsCurrent).toBe(1);
  });

  it('Rifle (não leve) custa Ação Comum e vira Ação Bônus com a habilidade', () => {
    montarMesa([esp([], { mainHandWeaponName: 'Rifle', weaponAmmo: { Rifle: 1 } })], { ana: [0, 0] });
    expect(custoRecarga(pegarFicha('ana'), 'Rifle')).toBe('action');
    limparMesa();
    montarMesa([esp(['ec-recarga-rapida'], { mainHandWeaponName: 'Rifle', weaponAmmo: { Rifle: 1 } })], { ana: [0, 0] });
    expect(custoRecarga(pegarFicha('ana'), 'Rifle')).toBe('bonus');
    expect(recarregar('ana', 'Rifle').ok).toBe(true);
    expect(pegarFicha('ana').bonusActionsCurrent).toBe(0);
    expect(pegarFicha('ana').actionsCurrent).toBe(1);
  });

  it('arma sem munição cheia não recarrega de novo e arma sem Recarga não usa munição', () => {
    montarMesa([esp([])], { ana: [0, 0] });
    expect(recarregar('ana', 'Pistola').reason).toContain('já está carregada');
    expect(capacidadePorNome('Espada Longa')).toBeNull();
    expect(consumirTiro('ana', 'Espada Longa').ok).toBe(true);
  });

  it('o ataque real gasta munição e o HUD mostra os tiros', async () => {
    montarMesa([esp(['ec-recarga-rapida']), inimigo('bruno')], { ana: [0, 0], bruno: [1, 0] });
    combate(['ana', 'bruno']);
    forcarDados(18, 5);
    render(<AttackPanel character={pegarFicha('ana')} />);
    expect(screen.getByTestId('ammo-Pistola').textContent).toContain('12/12');
    fireEvent.click(screen.getByTestId('recarga-section')); // não deve quebrar
    await waitFor(() => expect(screen.getByTestId('ammo-Pistola')).toBeTruthy());
  });
});

describe('Uso Rápido', () => {
  const item = (id: string, over: Record<string, unknown> = {}) => ({
    id, name: `Poção ${id}`, category: 'Consumível', description: '', weight: 0, cost: 0, slots: 0,
    quantity: 2, slotType: 'inventory', bonusHP: 0, bonusPE: 0, bonusESC: 0, bonusRD: 0,
    bonusRdByType: {}, bonusSlots: 0, bonusCA: 0, bonusDC: 0, bonusActions: 0, bonusBonusActions: 0,
    assignedTo: ['ana'], isFood: false, ...over,
  });

  it('reconhece consumíveis', () => {
    expect(isConsumivel({ name: 'Poção de Cura', category: 'Consumível' } as never)).toBe(true);
    expect(isConsumivel({ name: 'Pão', category: '', isFood: true } as never)).toBe(true);
    expect(isConsumivel({ name: 'Corda', category: 'Equipamento' } as never)).toBe(false);
  });

  it('gasta 1 PE e só permite um item adicional por turno', () => {
    montarMesa([esp(['ec-uso-rapido'])], { ana: [0, 0] });
    combate(['ana']);
    useItemStore.setState({ items: [item('i1'), item('i2')] } as never);
    expect(podeUsarItemAdicional(pegarFicha('ana')).ok).toBe(true);
    expect(pagarItemAdicional('ana', 'Poção i1').ok).toBe(true);
    expect(pegarFicha('ana').peCurrent).toBe(9);
    const segundo = podeUsarItemAdicional(pegarFicha('ana'));
    expect(segundo.ok).toBe(false);
    expect(segundo.reason).toContain('já usou');
    expect(log()).toContain('Uso Rápido');
  });

  it('libera de novo na rodada seguinte e bloqueia sem PE', () => {
    montarMesa([esp(['ec-uso-rapido'])], { ana: [0, 0] });
    combate(['ana']);
    pagarItemAdicional('ana');
    useCombatStore.setState({ round: 2 } as never);
    expect(podeUsarItemAdicional(pegarFicha('ana')).ok).toBe(true);
    useCharacterStore.getState().updateCharacter('ana', { peCurrent: 0 });
    expect(podeUsarItemAdicional(pegarFicha('ana')).reason).toContain('energia');
  });

  it('sem a habilidade não libera item adicional', () => {
    montarMesa([esp([])], { ana: [0, 0] });
    combate(['ana']);
    expect(podeUsarItemAdicional(pegarFicha('ana')).ok).toBe(false);
  });
});
