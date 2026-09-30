/**
 * Especialista em Combate — Habilidade de 2º nível: Posicionamento Ameaçador.
 *
 * A menos que esteja furtivo (peça escondida no mapa), o Especialista pode
 * conceder os benefícios de Flanco para aliados mesmo usando armas à
 * distância ou de fogo, desde que o alvo esteja dentro do PRIMEIRO alcance
 * da sua arma (`rangeShort`).
 *
 * Efeito: o alvo conta como FLANQUEADO (o Especialista ocupa o papel de um
 * dos flanqueadores). Nenhum bônus direto é concedido aqui — quem lê esse
 * status decide o efeito (ex.: Flanqueador Superior aplica −2 em TRs).
 */
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { findWeaponByName } from '@/lib/weapons';
import { charsDistanceMeters, type TouchEntity, type TouchGrid } from '@/lib/touchRange';

export const POSICIONAMENTO_AMEACADOR_ID = 'ec-posicionamento-ameacador';

export function hasPosicionamentoAmeacador(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === POSICIONAMENTO_AMEACADOR_ID);
}

type Ent = TouchEntity & { characterId?: string; hidden?: boolean };

/** Está furtivo? (peça marcada como escondida no mapa) */
export function estaFurtivo(charId: string, entities: Record<string, Ent>): boolean {
  const e = Object.values(entities ?? {}).find((x) => x?.characterId === charId);
  return !!e?.hidden;
}

/** Primeiro alcance (em metros) da arma empunhada, se for à distância/de fogo. */
export function primeiroAlcanceM(c: Character | null | undefined): number | null {
  const w = findWeaponByName(c?.mainHandWeaponName ?? '');
  if (!w || w.range === 'melee') return null;
  return w.rangeShort ?? null;
}

/**
 * O Especialista ameaça `alvo` à distância, podendo contar como flanqueador?
 * Exige: possuir a habilidade, não estar furtivo, empunhar arma à distância
 * ou de fogo, e o alvo estar dentro do primeiro alcance dessa arma.
 */
export function ameacaADistancia(
  esp: Character,
  alvo: Character,
  entities: Record<string, Ent>,
  grid: TouchGrid,
): boolean {
  if (!hasPosicionamentoAmeacador(esp)) return false;
  if (estaFurtivo(esp.id, entities)) return false;
  const alcance = primeiroAlcanceM(esp);
  if (alcance === null) return false;
  const d = charsDistanceMeters(esp.id, alvo.id, entities, grid);
  if (d === null) return false;
  return d <= alcance + 0.05;
}
