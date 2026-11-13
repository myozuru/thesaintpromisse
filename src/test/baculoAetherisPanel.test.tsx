// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));

import * as combatEngine from '@/lib/combatEngine';
import * as dice from '@/lib/dice';
import { BaculoAetherisPanel } from '@/components/fichas/BaculoAetherisPanel';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useMapStore } from '@/stores/useMapStore';
import { ficha, montarMesa, pegarFicha, limparMesa } from './helpers/mesaReal';

const ownerId = 'portador';
const damage = vi.fn(async () => undefined);
let restoreApplyDamage: ReturnType<typeof useCharacterStore.getState>['applyDamage'];

function setup(pe = 10, extra: Record<string, unknown> = {}) {
  const owner = ficha(ownerId, {
    category: 'PLAYER', mainHandWeaponName: 'B\u00e1culo Aetheris',
    peCurrent: pe, reactionsCurrent: 1, reactionsMax: 1,
    actionsCurrent: 1, bonusActionsCurrent: 1, ...extra,
  });
  const target = ficha('alvo', { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, ca: 10 });
  const distant = ficha('longe', { category: 'INIMIGO', hpCurrent: 100, hpMax: 100, ca: 10 });
  montarMesa([owner, target, distant], { [ownerId]: [0, 0], alvo: [2, 0], longe: [20, 0] });
  useCombatStore.setState({ inCombat: true, combatId: 'cena-1', round: 1, aetherisRoundUse: {}, aetherisRequiemUse: {} } as never);
  useCharacterStore.setState({ applyDamage: damage } as never);
}

function renderPanel(ruptureTargetId?: string) {
  return render(<BaculoAetherisPanel character={pegarFicha(ownerId)} weaponInstanceId="baculo-1" ruptureTargetId={ruptureTargetId ?? null} onRupturePromptClose={vi.fn()} />);
}

beforeEach(() => {
  restoreApplyDamage = useCharacterStore.getState().applyDamage;
  damage.mockClear();
  setup();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useCharacterStore.setState({ applyDamage: restoreApplyDamage, characters: [] } as never);
  useMapStore.setState({ entities: {}, walls: [] } as never);
  useCombatStore.setState({ inCombat: false, aetherisRoundUse: {}, aetherisRequiemUse: {} } as never);
  limparMesa();
});

describe('Aetheris combat panel', () => {
  it('groups all weapon actions and exposes exact resource block reasons', () => {
    useCharacterStore.getState().updateCharacter(ownerId, { peCurrent: 5 });
    const { getByRole, getByText } = renderPanel();
    const panel = getByRole('region');
    expect(within(panel).getByRole('button', { name: /Plumas da Tempestade/ }).hasAttribute('disabled')).toBe(true);
    expect(within(panel).getByRole('button', { name: /Plumas da Tempestade/ }).getAttribute('title')).toBe('PE insuficiente: requer 8, voc\u00ea possui 5');
    const reversao = panel.querySelector('[aria-label^="Revers"]');
    expect(reversao?.getAttribute('aria-disabled')).toBe('true');
    expect(reversao?.getAttribute('title')).toContain('PE insuficiente: requer 7');
    expect(reversao?.getAttribute('title')).toContain('possui 5');
    expect(within(panel).getByRole('button', { name: /Trono das Nuvens/ }).hasAttribute('disabled')).toBe(true);
    expect(within(panel).getByRole('button', { name: /18 PE/ }).hasAttribute('disabled')).toBe(true);
    expect(getByText(/Ruptura do Firmamento/)).not.toBeNull();
  });

  it('disables Requiem without both actions and keeps the once-per-scene lock visible', () => {
    useCharacterStore.getState().updateCharacter(ownerId, { peCurrent: 25, bonusActionsCurrent: 0 });
    const { getByRole, rerender } = renderPanel();
    let requiem = getByRole('button', { name: /18 PE/ });
    expect(requiem.hasAttribute('disabled')).toBe(true);
    expect(requiem.getAttribute('title')).toContain('Requer A');

    useCombatStore.setState({ aetherisRequiemUse: { [ownerId]: 'cena-1' } });
    rerender(<BaculoAetherisPanel character={pegarFicha(ownerId)} weaponInstanceId="baculo-1" ruptureTargetId={null} onRupturePromptClose={vi.fn()} />);
    requiem = getByRole('button', { name: /18 PE/ });
    expect(requiem.hasAttribute('disabled')).toBe(true);
    expect(requiem.getAttribute('title')).toContain('usada 1');
    expect(screen.getByRole('status').textContent).toContain('usada 1');
  });

  it('limits Plumas to three independent attacks and omits targets beyond 18 m', async () => {
    const attack = vi.spyOn(combatEngine, 'rollAttack').mockResolvedValue({ hit: true, critical: false, natural: 15 } as never);
    const roll = vi.spyOn(dice, 'rollDiceCom').mockResolvedValue({ total: 21 } as never);
    const { getByRole } = renderPanel();
    fireEvent.click(getByRole('button', { name: /Plumas da Tempestade/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Adicionar pluma a alvo' })).not.toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Adicionar pluma a longe' })).toBeNull();

    for (let i = 0; i < 3; i += 1) fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar pluma a alvo' }));
    expect(within(dialog).getByText('3/3 plumas')).not.toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Adicionar pluma a alvo' }).hasAttribute('disabled')).toBe(true);

    const fireButton = within(dialog).getByRole('button', { name: /Disparar Plumas/ });
    expect((fireButton as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { fireEvent.click(fireButton); });
    await waitFor(() => expect(attack).toHaveBeenCalledTimes(3));
    expect(roll.mock.calls.map((call) => call[1])).toEqual(['6d8', '6d8', '6d8']);
    expect(damage).toHaveBeenCalledTimes(3);
    expect(damage).toHaveBeenCalledWith('alvo', 21, 'DCO', expect.objectContaining({ attackerId: ownerId }));
    expect(pegarFicha(ownerId)).toMatchObject({ peCurrent: 2, actionsCurrent: 0, baculoAetherisSafeMoveM: 4.5, baculoAetherisSafeMoveRemainingM: 4.5 });
  });

  it('leaves the pass button available when Rupture lacks a reaction', () => {
    useCharacterStore.getState().updateCharacter(ownerId, { reactionsCurrent: 0 });
    const { getByRole } = renderPanel('alvo');
    const activate = getByRole('button', { name: /Ativar Ruptura do Firmamento/ });
    expect(activate.hasAttribute('disabled')).toBe(true);
    expect(activate.getAttribute('title')).toContain('Sem Re');
    expect(getByRole('button', { name: /Ignorar/ }).hasAttribute('disabled')).toBe(false);
  });
});
