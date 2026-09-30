/**
 * Especialista em Combate — Habilidade de 2º nível: Flanqueador Superior.
 *
 * Enquanto o Especialista estiver FLANQUEANDO uma criatura (ele e pelo menos
 * um aliado adjacentes — a até 1,5 m — ao mesmo alvo), essa criatura recebe
 * −2 em TODOS os testes de resistência.
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { charsDistanceMeters, TOUCH_RANGE_M, type TouchEntity, type TouchGrid } from '@/lib/touchRange';

export const FLANQUEADOR_SUPERIOR_ID = 'ec-flanqueador-superior';
export const FLANQUEADOR_TR_PENALIDADE = -2;

export function hasFlanqueadorSuperior(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === FLANQUEADOR_SUPERIOR_ID);
}

/** PLAYER e NPC são aliados entre si; INIMIGO é o lado oposto. */
export function mesmoLado(a: Character, b: Character): boolean {
  const lado = (c: Character) => (c.category === 'INIMIGO' ? 'inimigo' : 'aliado');
  return lado(a) === lado(b);
}

type Ent = TouchEntity & { characterId?: string; carriedBy?: string };

const adjacentes = (
  aId: string,
  bId: string,
  entities: Record<string, Ent>,
  grid: TouchGrid,
): boolean => {
  const d = charsDistanceMeters(aId, bId, entities, grid);
  return d !== null && d <= TOUCH_RANGE_M + 0.05;
};

/**
 * `esp` está flanqueando `alvo`? Exige que os dois estejam no mapa, adjacentes,
 * e que haja ao menos um aliado do `esp` (que não seja ele) também adjacente ao alvo.
 */
export function estaFlanqueando(
  esp: Character,
  alvo: Character,
  characters: Character[],
  entities: Record<string, Ent>,
  grid: TouchGrid,
): boolean {
  if (esp.id === alvo.id) return false;
  if (mesmoLado(esp, alvo)) return false;
  if (!adjacentes(esp.id, alvo.id, entities, grid)) return false;
  return characters.some(
    (ch) =>
      ch.id !== esp.id &&
      ch.id !== alvo.id &&
      mesmoLado(ch, esp) &&
      adjacentes(ch.id, alvo.id, entities, grid),
  );
}

/** −2 se algum Especialista com Flanqueador Superior estiver flanqueando o alvo. */
export function penalidadeTRFlanqueado(
  alvo: Character | null | undefined,
  characters: Character[],
  entities: Record<string, Ent>,
  grid: TouchGrid,
): number {
  if (!alvo) return 0;
  const algum = characters.some(
    (ch) => hasFlanqueadorSuperior(ch) && estaFlanqueando(ch, alvo, characters, entities, grid),
  );
  return algum ? FLANQUEADOR_TR_PENALIDADE : 0;
}
