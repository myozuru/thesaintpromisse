/**
 * Efeitos mecânicos puros dos Ferimentos Complexos (sem stores, para evitar ciclos):
 *  - 1–2 (olho): desvantagem em Percepção e ataques à distância
 *  - 4–5 (perna): desvantagem em Acrobacia
 *  - 8–9 (braço): desvantagem em Atletismo
 *  - 7 (ferida interna): CD do TR de Fortitude para agir
 */
import type { Character } from '@/types';

type Ctx =
  | { kind: 'attack'; subtype: 'melee' | 'ranged' | 'cursed' }
  | { kind: 'skill' | 'save' | 'attribute'; name: string }
  | { kind: 'any' }
  | { kind: string; [k: string]: unknown };

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Motivos de desvantagem por ferimento para esta rolagem (vazio = nenhum). */
export function desvantagensFerimentos(c: Pick<Character, 'ferimentosComplexos'>, ctx: Ctx): string[] {
  const rs = new Set((c.ferimentosComplexos ?? []).map((f) => f.resultado));
  const out: string[] = [];
  const olho = rs.has(1) || rs.has(2);
  if (ctx.kind === 'attack' && (ctx as { subtype?: string }).subtype === 'ranged' && olho) out.push('Perdeu um olho');
  if (ctx.kind === 'skill') {
    const n = norm(String((ctx as { name?: string }).name ?? ''));
    if (n === 'percepcao' && olho) out.push('Perdeu um olho');
    if (n === 'acrobacia' && (rs.has(4) || rs.has(5))) out.push('Perdeu uma perna');
    if (n === 'atletismo' && (rs.has(8) || rs.has(9))) out.push('Perdeu um braço');
  }
  return out;
}

export const temFeridaInterna = (c: Pick<Character, 'ferimentosComplexos'>) => (c.ferimentosComplexos ?? []).some((f) => f.resultado === 7);
export const feridaInternaTratada = (c: Pick<Character, 'ferimentosComplexos'>) => (c.ferimentosComplexos ?? []).some((f) => f.resultado === 7 && f.tratada);
/** CD 20 + nível; tratada por mestre em Medicina → CD 10. */
export const cdFeridaInterna = (c: Pick<Character, 'ferimentosComplexos' | 'level'>) => feridaInternaTratada(c) ? 10 : 20 + (c.level ?? 0);
