import type { Character } from '@/types';

/** PE máximo mostrado em todos os lugares: o mesmo valor final da ficha
 *  (com bônus de passivas, itens, talentos e Omni), gravado pela ficha. */
export function shownPeMax(c: Pick<Character, 'peMax'> & { peMaxEffective?: number } | null | undefined): number {
  if (!c) return 0;
  return typeof c.peMaxEffective === 'number' ? c.peMaxEffective : (c.peMax ?? 0);
}

/** Vida máxima mostrada em todos os lugares (mesmo número da ficha).
 * Ignora um máximo efetivo antigo/zerado e nunca deixa o atual sem teto. */
export function shownHpMax(c: { hpCurrent?: number; hpMax?: number; hpMaxEffective?: number } | null | undefined): number {
  if (!c) return 0;
  const effective = Number.isFinite(c.hpMaxEffective) ? Math.max(0, c.hpMaxEffective ?? 0) : 0;
  const base = Number.isFinite(c.hpMax) ? Math.max(0, c.hpMax ?? 0) : 0;
  const current = Number.isFinite(c.hpCurrent) ? Math.max(0, c.hpCurrent ?? 0) : 0;
  return effective > 0 ? effective : Math.max(base, current);
}
