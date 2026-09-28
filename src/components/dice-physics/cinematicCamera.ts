import type { DiceVector3 } from "./types";

export interface CinematicCameraPose {
  position: DiceVector3;
  target: DiceVector3;
  fov: number;
}

/** Mantém o dado no centro e, ao parar, destaca sua face superior. */
export function getCinematicCameraPose(point: DiceVector3, settled: boolean): CinematicCameraPose {
  if (settled) {
    return {
      position: { x: point.x, y: point.y + 0.48, z: point.z + 0.045 },
      target: { x: point.x, y: point.y, z: point.z },
      fov: 17,
    };
  }

  return {
    position: { x: point.x, y: point.y + 1.48, z: point.z + 0.22 },
    target: { x: point.x, y: point.y, z: point.z },
    fov: 30,
  };
}