/**
 * Camada de Comércio do Omni-Engine.
 *
 * Regras absolutas:
 *  1. Anti-Revenda: itens com isBought=true não podem ser vendidos a lojas.
 *  2. Especialização: a loja só compra se houver match de pelo menos uma
 *     hiddenTag entre o item e o array acceptedTags da loja.
 */
import type { EntidadeOmni } from './tipos';
import type { Shop } from '@/stores/useShopStore';

export interface SellValidation {
  ok: boolean;
  /** Mensagem amigável quando ok=false. */
  reason?: string;
}

/**
 * Determina se um item pode ser vendido para uma loja específica.
 * Funciona em modo "fail-closed": qualquer ausência de dado vira bloqueio.
 */
export function canSellItemToShop(item: EntidadeOmni, shop: Shop): SellValidation {
  const com = item.comercio;
  if (!com) {
    return { ok: false, reason: 'Este item não possui dados comerciais configurados.' };
  }

  // Regra 1 — Anti-Revenda
  if (com.isBought) {
    return { ok: false, reason: 'Lojas não compram itens de segunda mão comercial.' };
  }

  // Regra 2 — Especialização
  const itemTags = com.hiddenTags ?? [];
  const shopTags = shop.acceptedTags ?? [];
  if (itemTags.length === 0 || shopTags.length === 0) {
    return { ok: false, reason: 'O mercador não tem interesse neste tipo de mercadoria.' };
  }
  const match = itemTags.some((t) => shopTags.includes(t));
  if (!match) {
    return { ok: false, reason: 'O mercador não tem interesse neste tipo de mercadoria.' };
  }

  return { ok: true };
}

/** Calcula quanto a loja paga ao comprar do jogador. */
export function calcSellPrice(item: EntidadeOmni, shop: Shop): number {
  const base = item.comercio?.basePrice ?? 0;
  const mult = shop.buyMultiplier ?? 0.5;
  return Math.max(0, Math.floor(base * mult));
}
