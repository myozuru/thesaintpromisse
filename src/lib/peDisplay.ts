import type { Character } from '@/types';

/** PE máximo mostrado em todos os lugares: o mesmo valor final da ficha
 *  (com bônus de passivas, itens, talentos e Omni), gravado pela ficha. */
export function shownPeMax(c: Pick<Character, 'peMax'> & { peMaxEffective?: number } | null | undefined): number {
  if (!c) return 0;
  return typeof c.peMaxEffective === 'number' ? c.peMaxEffective : (c.peMax ?? 0);
}
