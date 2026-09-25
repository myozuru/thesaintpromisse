import type { Discount } from '@/stores/useDiscountStore';

/** Converte (year, month, day) em um número absoluto de dias.
 *  Convenção simples: 12 meses × 30 dias (alinhado com o Chronos atual). */
export function chronosToAbsDay(year: number, month: number, day: number): number {
  return year * 360 + (Math.max(1, month) - 1) * 30 + Math.max(1, day);
}

export function isDiscountActive(
  d: Discount,
  nowAbsDay: number,
): boolean {
  const startOk = d.startAbsDay == null || nowAbsDay >= d.startAbsDay;
  const endOk = d.endAbsDay == null || nowAbsDay <= d.endAbsDay;
  return startOk && endOk;
}

/**
 * Retorna os descontos ativos aplicáveis a um item específico,
 * considerando empilhamento (estabelecimento → cardapio → item).
 */
export function getApplicableDiscounts(
  discounts: Discount[],
  estId: string,
  menuId: string,
  itemId: string,
  nowAbsDay: number,
): Discount[] {
  return discounts.filter((d) => {
    if (!isDiscountActive(d, nowAbsDay)) return false;
    if (d.targetType === 'establishment' && d.targetId === estId) return true;
    if (d.targetType === 'menu' && d.targetId === menuId) return true;
    if (d.targetType === 'item' && d.targetId === itemId) return true;
    return false;
  });
}

/**
 * Aplica os descontos em cascata sobre um preço base.
 * Ordem: primeiro todos os percentuais, depois todos os fixos.
 * Nunca abaixo de 0.
 */
export function applyDiscounts(basePrice: number, applicable: Discount[]): number {
  if (basePrice <= 0 || applicable.length === 0) return basePrice;
  let p = basePrice;
  // percentuais
  for (const d of applicable) {
    if (d.kind === 'percent') {
      const pct = Math.max(0, Math.min(100, d.value));
      p = p * (1 - pct / 100);
    }
  }
  // fixos
  for (const d of applicable) {
    if (d.kind === 'flat') {
      p -= Math.max(0, d.value);
    }
  }
  return Math.max(0, Math.round(p));
}

/** Retorna { effective, hasDiscount, percentEquivalent } para exibição. */
export function computeEffectivePrice(
  basePrice: number,
  applicable: Discount[],
): { effective: number; hasDiscount: boolean; percentEquivalent: number } {
  const effective = applyDiscounts(basePrice, applicable);
  const hasDiscount = applicable.length > 0 && effective < basePrice;
  const percentEquivalent =
    basePrice > 0 ? Math.round(((basePrice - effective) / basePrice) * 100) : 0;
  return { effective, hasDiscount, percentEquivalent };
}
