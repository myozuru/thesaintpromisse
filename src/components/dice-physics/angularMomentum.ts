import type { DiceVector3 } from "./types";

const MIN_PRESERVED_SPIN = 0.32;
const MIN_ACTIVE_SPIN = 2;
const MIN_ACTIVE_LINEAR_SPEED = 0.35;

function dot(a: DiceVector3, b: DiceVector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function length(vector: DiceVector3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

/** Suaviza a componente que um impacto forte tentou inverter ou cancelar. */
export function preserveDiceSpin(
  before: DiceVector3,
  after: DiceVector3,
  linearSpeed: number,
): DiceVector3 {
  const previousSpeed = length(before);
  if (previousSpeed < MIN_ACTIVE_SPIN || linearSpeed < MIN_ACTIVE_LINEAR_SPEED) return after;

  const axis = {
    x: before.x / previousSpeed,
    y: before.y / previousSpeed,
    z: before.z / previousSpeed,
  };
  const currentProjection = dot(after, axis);
  const minimumProjection = previousSpeed * MIN_PRESERVED_SPIN;
  if (currentProjection >= minimumProjection) return after;

  const correction = minimumProjection - currentProjection;
  const corrected = {
    x: after.x + axis.x * correction,
    y: after.y + axis.y * correction,
    z: after.z + axis.z * correction,
  };
  const correctedSpeed = length(corrected);
  const speedLimit = Math.max(previousSpeed, length(after));
  if (correctedSpeed <= speedLimit || correctedSpeed === 0) return corrected;
  const scale = speedLimit / correctedSpeed;
  return { x: corrected.x * scale, y: corrected.y * scale, z: corrected.z * scale };
}