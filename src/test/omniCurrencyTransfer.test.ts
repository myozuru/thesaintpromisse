import { afterEach, describe, expect, it } from 'vitest';
import { efeitosParaScript, parseOmniScript } from '@/lib/omni/omniScript';
import { executarCombatEffect } from '@/lib/omni/executarSubEfeito';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useRoleStore } from '@/stores/useRoleStore';

const wallets = [
  { id: 'wallet-a', name: 'Origem', members: ['p1'], createdBy: 'p1', balances: { yen: 50 }, isPersonal: true, createdAt: 0 },
  { id: 'wallet-b', name: 'Destino', members: ['p2'], createdBy: 'p2', balances: { yen: 5 }, isPersonal: true, createdAt: 0 },
];
const currency = [{ id: 'yen', name: 'Yen', symbol: '¥', isDefault: true }];
const effect = () => {
  const result = parseOmniScript('@fim_turno -> transferir 10 de wallet-a para wallet-b moeda yen');
    expect(result.erros).toEqual([]);
    expect(efeitosParaScript(result.efeitos)).toContain('transferir 10 de wallet-a para wallet-b moeda yen');
    return result.efeitos[0];
};
const context = (usuarioId: string) => ({ usuarioId, usuarioVars: {}, sourceName: 'Pagamento Omni' });

afterEach(() => {
  useMoneyStore.setState({ currencies: currency, wallets: [], invites: [], transactions: [] });
  useRoleStore.getState().setRole(null);
});

describe('transferência monetária OMNI', () => {
  it('exige valor, duas carteiras e ID da moeda no comando', () => {
    const result = parseOmniScript('@fim_turno -> transferir 10 de wallet-a para wallet-b');
    expect(result.erros).toHaveLength(1);
    expect(effect().transferencia).toEqual({ origem: 'wallet-a', destino: 'wallet-b', moedaId: 'yen' });
  });

  it('debita e credita uma única moeda e registra a ficha membro como autor', () => {
    useMoneyStore.setState({ currencies: currency, wallets, invites: [], transactions: [] });
    useRoleStore.getState().setRole('PLAYER');
    const result = executarCombatEffect(effect(), context('p1'));
    expect(result).toMatchObject({ aplicado: 10 });
    expect(useMoneyStore.getState().wallets.map(w => w.balances.yen)).toEqual([40, 15]);
    expect(useMoneyStore.getState().transactions[0]).toMatchObject({ kind: 'transfer', currencyId: 'yen', amount: 10, actor: 'p1' });
  });

  it('bloqueia jogador que não é membro da carteira de origem sem alterar saldos', () => {
    useMoneyStore.setState({ currencies: currency, wallets, invites: [], transactions: [] });
    useRoleStore.getState().setRole('PLAYER');
    const result = executarCombatEffect(effect(), context('intruso'));
    expect(result.invalido).toBe(true);
    expect(useMoneyStore.getState().wallets.map(w => w.balances.yen)).toEqual([50, 5]);
    expect(useMoneyStore.getState().transactions).toHaveLength(0);
  });

  it('aceita Mestre e respeita o saldo disponível', () => {
    useMoneyStore.setState({ currencies: currency, wallets, invites: [], transactions: [] });
    useRoleStore.getState().setRole('MASTER');
    const result = executarCombatEffect(effect(), context('mestre'));
    expect(result.aplicado).toBe(10);
    expect(useMoneyStore.getState().transactions[0].actor).toBe('MASTER');

    const insuficiente = parseOmniScript('@fim_turno -> transferir 100 de wallet-a para wallet-b moeda yen').efeitos[0];
    expect(executarCombatEffect(insuficiente, context('mestre')).invalido).toBe(true);
    expect(useMoneyStore.getState().wallets.map(w => w.balances.yen)).toEqual([40, 15]);
  });
});
