import type { Character } from '@/types';
import type { Entity } from '@/stores/useMapStore';
import { resolverTokensDaFicha } from './tokenDaFicha';
import { touchDistanceMeters } from '@/lib/touchRange';

/** Distância radial entre centros, em metros, igual ao círculo exibido na mira. */
export function distanciaCircularMetros(
  origem: { x: number; y: number }, alvo: { x: number; y: number },
  grid: { dpi?: number; metersPerCell?: number },
): number {
  return Math.hypot(alvo.x - origem.x, alvo.y - origem.y) / (grid.dpi || 70) * (grid.metersPerCell || 1.5);
}

/** Menor distância radial entre qualquer par de tokens válidos das fichas. */
export function distanciaCircularEntreFichas(
  origem: Pick<Character, 'id' | 'profileId'>,
  alvo: Pick<Character, 'id' | 'profileId'>,
  entities: Record<string, Entity>,
  layerVisible: Record<string, boolean>,
  grid: { dpi?: number; metersPerCell?: number },
): number | null {
  const origens = resolverTokensDaFicha(origem, entities, layerVisible);
  const alvos = resolverTokensDaFicha(alvo, entities, layerVisible);
  if (!origens.length || !alvos.length) return null;
  let menor = Infinity;
  for (const a of origens) for (const b of alvos) menor = Math.min(menor, distanciaCircularMetros(a, b, grid));
  return Number.isFinite(menor) ? menor : null;
}

/** Menor distância borda a borda entre quaisquer tokens válidos das fichas. */
export function distanciaBordaEntreFichas(
  origem: Pick<Character, 'id' | 'profileId'>,
  alvo: Pick<Character, 'id' | 'profileId'>,
  entities: Record<string, Entity>,
  layerVisible: Record<string, boolean>,
  grid: { dpi?: number; metersPerCell?: number },
): number | null {
  const origens = resolverTokensDaFicha(origem, entities, layerVisible);
  const alvos = resolverTokensDaFicha(alvo, entities, layerVisible);
  if (!origens.length || !alvos.length) return null;
  let menor = Infinity;
  for (const a of origens) for (const b of alvos) menor = Math.min(menor, touchDistanceMeters(a, b, grid));
  return Number.isFinite(menor) ? menor : null;
}

/** Um token específico de alvo dentro do círculo de qualquer token de origem. */
export function tokenDentroDoAlcanceCircular(
  origens: Entity[], alvo: Entity, grid: { dpi?: number; metersPerCell?: number }, alcanceM: number,
): boolean {
  return origens.some(origem => distanciaCircularMetros(origem, alvo, grid) <= alcanceM + 0.05);
}

/** Um token específico dentro do alcance borda a borda de alguma origem. */
export function tokenDentroDoAlcanceBorda(
  origens: Entity[], alvo: Entity, grid: { dpi?: number; metersPerCell?: number }, alcanceM: number,
): boolean {
  return origens.some(origem => touchDistanceMeters(origem, alvo, grid) <= alcanceM + 0.05);
}
