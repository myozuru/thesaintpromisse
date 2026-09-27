import { beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import { moneyCharactersForViewer } from '@/lib/moneyIdentity';
import { useMoneyStore } from '@/stores/useMoneyStore';

const character = (id: string, name: string, profileId?: string, createdBy: 'PLAYER' | 'MASTER' = 'PLAYER') => ({
  id, name, profileId, createdBy, category: 'PLAYER',
} as Character);

describe('identidade das carteiras', () => {
  beforeEach(() => useMoneyStore.getState().resetAll());

  it('cada player vê somente as fichas ligadas ao próprio perfil', () => {
    const characters = [character('char-a', 'Ayla', 'profile-a'), character('char-b', 'Bento', 'profile-b')];
    expect(moneyCharactersForViewer(characters, 'PLAYER', 'profile-b').map((item) => item.id)).toEqual(['char-b']);
  });

  it('não usa a primeira ficha como fallback quando não há vínculo', () => {
    const characters = [character('char-a', 'Ayla', 'profile-a')];
    expect(moneyCharactersForViewer(characters, 'PLAYER', null)).toEqual([]);
    expect(moneyCharactersForViewer(characters, 'PLAYER', 'profile-b')).toEqual([]);
  });

  it('permite ao Mestre atribuir carteira a ficha criada pelo Mestre', () => {
    const characters = [character('char-b', 'Bento', 'profile-b', 'MASTER')];
    expect(moneyCharactersForViewer(characters, 'MASTER', null)).toHaveLength(1);
    useMoneyStore.getState().ensurePersonalWallet('char-b', 'Bento');
    const wallet = useMoneyStore.getState().wallets[0];
    expect(wallet?.members).toEqual(['char-b']);
    expect(wallet?.name).toBe('Carteira de Bento');
  });

  it('corrige nome antigo sem perder saldo', () => {
    useMoneyStore.setState({ wallets: [{
      id: 'wallet-b', name: 'Carteira de Ayla', members: ['char-b'], createdBy: 'char-b',
      balances: { yen: 250 }, isPersonal: true, createdAt: 1,
    }] });
    useMoneyStore.getState().ensurePersonalWallet('char-b', 'Bento');
    expect(useMoneyStore.getState().wallets[0]?.name).toBe('Carteira de Bento');
    expect(useMoneyStore.getState().wallets[0]?.balances.yen).toBe(250);
  });
});