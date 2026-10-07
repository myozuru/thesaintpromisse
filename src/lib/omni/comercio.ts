/**
 * Camada de Comércio do Omni-Engine.
 *
 * Regras absolutas:
 *  1. Anti-Revenda: itens com isBought=true não podem ser vendidos a lojas.
 *  2. Especialização: a loja só compra se o item aceitar uma das categorias
 *     da loja (ou, no modo legado, houver tag oculta em comum).
 */
import type { EntidadeOmni } from './tipos';
import type { Shop } from '@/stores/useShopStore';

export interface SellValidation {
  ok: boolean;
  reason?: string;
}

export function canSellItemToShop(item: EntidadeOmni, shop: Shop): SellValidation {
  const com = item.comercio;
  if (!com) return { ok: false, reason: 'Este item não possui dados comerciais configurados.' };
  if (com.isBought) return { ok: false, reason: 'Lojas não compram itens de segunda mão comercial.' };

  const cats = com.categoriasAceitas ?? [];
  const shopCats = shop.categorias ?? [];
  if (cats.length && shopCats.some((c) => cats.includes(c))) return { ok: true };

  const itemTags = com.hiddenTags ?? [];
  const shopTags = shop.acceptedTags ?? [];
  if (itemTags.some((t) => shopTags.includes(t))) return { ok: true };

  return { ok: false, reason: 'O mercador não tem interesse neste tipo de mercadoria.' };
}

/** Moeda do item (ou da loja, quando o item não define). */
export function moedaDoItem(item: EntidadeOmni, shop: Shop): string {
  return item.comercio?.currencyId || shop.currencyId;
}

/** Calcula quanto a loja paga ao comprar do jogador. */
export function calcSellPrice(item: EntidadeOmni, shop: Shop): number {
  const base = item.comercio?.basePrice ?? 0;
  const mult = shop.buyMultiplier ?? 0.5;
  return Math.max(0, Math.floor(base * mult));
}
