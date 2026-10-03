import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { avaliarFormula } from '@/lib/omni/parser';
import { useMoneyStore } from '@/stores/useMoneyStore';
const c = { id: 'equip-composed', name: 'Teste', level: 1, hpCurrent: 10, hpMax: 10, peCurrent: 3, peMax: 3,
  mainHandWeaponName: 'Adaga', offHandWeaponName: 'Lança', attributes: [], skills: [], savingThrows: [] } as unknown as Character;
const r = (s: string) => avaliarFormula(s, montarVariaveisDoPersonagem(c));
describe('dados genéricos de equipamento e carteiras', () => {
  it('reutiliza propriedades e mantém as mãos separadas', () => {
    expect(r('arma_principal corpo_a_corpo').valor).toBe(1);
    expect(r('arma_principal grupo Faca').valor).toBe(1);
    expect(r('arma_principal grupo Haste').valor).toBe(0);
    expect(r('margem_critico arma_principal').valor).toBe(18);
  });
  it('distingue existência de carteira e saldo de moeda', () => {
    useMoneyStore.setState({ currencies: [{ id: 'moeda-teste-01', name: 'Teste', symbol: 'T', isDefault: true }],
      wallets: [{ id: 'carteira-01', name: 'Vazia', createdBy: c.id, members: [c.id], isPersonal: true, balances: { 'moeda-teste-01': 0 }, createdAt: 0 }] });
    expect(r('tem carteira pessoal').valor).toBe(1);
    expect(r('tem moeda moeda-teste-01').valor).toBe(0);
    expect(r('quantidade carteiras pessoal').valor).toBe(1);
    expect(r('quantidade carteiras compartilhadas').valor).toBe(0);
    useMoneyStore.setState({ wallets: [] });
  });
});
