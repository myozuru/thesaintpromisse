/** Intensidade usada para validar o campo visual de proximidade da bandeja. */
export function getProximityReveal(distance: number, near = 0.18, far = 0.86) {
  if (!Number.isFinite(distance) || distance >= far) return 0;
  if (distance <= near) return 1;
  const t = (distance - near) / (far - near);
  return 1 - t * t * (3 - 2 * t);
}

/** Combina vários campos sem estourar a luminosidade quando os dados se encontram. */
export function combineProximityReveals(values: readonly number[]) {
  return values.reduce((combined, value) => Math.max(combined, Math.max(0, Math.min(1, value))), 0);
}
