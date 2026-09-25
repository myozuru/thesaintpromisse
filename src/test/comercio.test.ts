import { describe, it, expect } from 'vitest';
import { canSellItemToShop, calcSellPrice } from '@/lib/omni/comercio';
import { novaEntidade } from '@/lib/omni/tipos';
import type { Shop } from '@/stores/useShopStore';

function mkShop(p: Partial<Shop> = {}): Shop {
  return {
    id: 's1',
    name: 'Loja',
    description: '',
    acceptedTags: ['amaldicoado'],
    inventory: [],
    currencyId: 'yen',
    buyMultiplier: 0.5,
    createdAt: 0,
    ...p,
  };
}

describe('canSellItemToShop', () => {
  it('bloqueia sem dados comerciais', () => {
    const item = novaEntidade('item');
    const r = canSellItemToShop(item, mkShop());
    expect(r.ok).toBe(false);
  });

  it('bloqueia item de segunda mão (isBought)', () => {
    const item = novaEntidade('item');
    item.comercio = { basePrice: 100, hiddenTags: ['amaldicoado'], isBought: true };
    const r = canSellItemToShop(item, mkShop());
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/segunda mão/i);
  });

  it('bloqueia quando não há match de tags', () => {
    const item = novaEntidade('item');
    item.comercio = { basePrice: 100, hiddenTags: ['reliquia'], isBought: false };
    const r = canSellItemToShop(item, mkShop({ acceptedTags: ['amaldicoado'] }));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/interesse/i);
  });

  it('aceita quando há ao menos uma tag em comum', () => {
    const item = novaEntidade('item');
    item.comercio = { basePrice: 100, hiddenTags: ['ilegal', 'amaldicoado'], isBought: false };
    const r = canSellItemToShop(item, mkShop({ acceptedTags: ['amaldicoado'] }));
    expect(r.ok).toBe(true);
  });

  it('calcSellPrice aplica multiplicador da loja', () => {
    const item = novaEntidade('item');
    item.comercio = { basePrice: 200, hiddenTags: ['amaldicoado'], isBought: false };
    expect(calcSellPrice(item, mkShop({ buyMultiplier: 0.5 }))).toBe(100);
    expect(calcSellPrice(item, mkShop({ buyMultiplier: 0.25 }))).toBe(50);
  });
});
