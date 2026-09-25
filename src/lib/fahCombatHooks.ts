/**
 * ============================================================================
 *  FAH COMBAT HOOKS
 * ============================================================================
 *  Funções puras + notifiers que aplicam as mecânicas reativas do
 *  "Feto Amaldiçoado Híbrido" sem espalhar lógica pelos stores.
 *
 *  Mecânicas cobertas:
 *  - Sangue Tóxico:           devolve dano automático ao atacante em melee
 *                             (resolvido inline no `applyDamage`).
 *  - Alma Maldita:            antes de aplicar dano à Alma (DAL), oferece
 *                             prompt para gastar 1 uso e reduzir/anular.
 *  - Anatomia Incompreensível: ao receber crítico/furtivo, oferece TR de
 *                             Constituição vs CD do efeito para mitigar.
 *  - Devorador de Energia:    quando o personagem PASSA num TR contra um
 *                             ataque de tag 'Feitiço', ganha +1 tempPE.
 *  - Presença Nefasta:        no início do combate, enfileira prompt para
 *                             rolar TR Vontade de cada inimigo vs CD Amald.
 *
 *  CD Amaldiçoada = 8 + Maestria + ConMod  (canônico do FAH).
 * ============================================================================
 */
import type { Character } from '@/types';
import { getMasteryBonus } from '@/types';

export function getConMod(c: Character): number {
  const con = c.attributes?.find((a) => a.name === 'Constituição');
  return con ? Math.floor((con.value - 10) / 2) : 0;
}

/** CD Amaldiçoada — usada por Presença Nefasta e por TRs forçados pelo FAH. */
export function calcCursedDC(c: Character): number {
  return 8 + getMasteryBonus(c.level) + getConMod(c);
}

/** True se o char tem origem FAH e o flag opcional ainda permite o efeito. */
export function isFAH(c: Character): boolean {
  return c.origin === 'Feto Amaldiçoada Híbrido (FAH)';
}

/** Reduz/anula dano à alma usando 1 uso de Alma Maldita.
 *  Lv < 15 → metade; Lv ≥ 15 → anula totalmente. */
export function applyAlmaMalditaReduction(c: Character, raw: number): number {
  if (!isFAH(c)) return raw;
  if (c.level >= 15) return 0;
  return Math.floor(raw / 2);
}

/** Sangue Tóxico — dano de retorno ao atacante em corpo-a-corpo.
 *  Fórmula: Maestria do FAH (mínimo 1). Tipo: DPS (dano psíquico/maldito). */
export function calcSangueToxicoReturn(c: Character): number {
  return Math.max(1, getMasteryBonus(c.level));
}
