/**
 * Helper compartilhado para resolver o "Modificador Chave" do Especialista
 * em Técnica (INT ou SAB). Usado por `specAbilityEffects.ts` e
 * `spellCastPipeline.ts` — mantém a regra em UM lugar só.
 *
 * Regra:
 *   • Se `keyAttribute` está definido (Inteligência, Sabedoria ou Presença —
 *     Suporte escolhe entre Presença/Sabedoria), usa-se exatamente esse
 *     atributo (respeita escolha do jogador).
 *   • Caso contrário (não-feiticeiro de Técnica, multiclasse, ficha em
 *     wizard incompleto), devolve `max(modINT, modSAB)` — favorece o
 *     jogador, garantindo determinismo.
 */
import type { Character } from '@/types';

function attrMod(c: Pick<Character, 'attributes'>, name: string): number {
  const a = (c.attributes ?? []).find(x => x.name === name);
  if (!a) return 0;
  return Math.floor((a.value - 10) / 2);
}

export function getSpecKeyMod(
  c: Pick<Character, 'attributes' | 'keyAttribute'>,
): number {
  const intMod = attrMod(c, 'Inteligência');
  const sabMod = attrMod(c, 'Sabedoria');
  if (c.keyAttribute === 'Inteligência') return intMod;
  if (c.keyAttribute === 'Sabedoria') return sabMod;
  if (c.keyAttribute === 'Presença') return attrMod(c, 'Presença');
  return Math.max(intMod, sabMod);
}
