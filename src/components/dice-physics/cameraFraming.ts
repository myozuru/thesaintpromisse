import * as THREE from "three";

export const TRAY_CAMERA_FOV = 42;

// Segunda escala 2/3: amplia novamente o dado em 50% com margem proporcional.
const TRAY_HALF_WIDTH = 0.622;
const TRAY_HALF_DEPTH = 0.933;
const DICE_VISIBILITY_MARGIN = 0.133;
const CAMERA_TILT_Z = 0.18;
// Aproxima 20% sobre o enquadramento de teste anterior, sem alterar a arena.
const FRAME_MARGIN = 1 / (0.9 * 1.2);

export interface TrayCameraPlacement {
  fov: number;
  position: [number, number, number];
}

export interface CinematicCameraPlacement {
  fov: number;
  offset: [number, number, number];
  lookHeight: number;
}

/** Recua a câmera conforme o aspecto para manter bordas e dados visíveis. */
export function getTrayCameraPlacement(aspect: number): TrayCameraPlacement {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const fov = safeAspect < 0.8 ? 50 : TRAY_CAMERA_FOV;
  const verticalHalfAngle = (fov * Math.PI) / 360;
  const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * safeAspect);
  const distance = Math.max(
    (TRAY_HALF_DEPTH + DICE_VISIBILITY_MARGIN) / Math.tan(verticalHalfAngle),
    (TRAY_HALF_WIDTH + DICE_VISIBILITY_MARGIN) / Math.tan(horizontalHalfAngle),
  ) * FRAME_MARGIN;
  const normalization = Math.hypot(1, CAMERA_TILT_Z);

  return {
    fov,
    position: [0, distance / normalization, (distance * CAMERA_TILT_Z) / normalization],
  };
}

/** Mantém a escala aparente do dado estável durante o redimensionamento. */
export function getCinematicCameraPlacement(settleBlend: number, aspect: number): CinematicCameraPlacement {
  const blend = Math.max(0, Math.min(1, Number.isFinite(settleBlend) ? settleBlend : 0));
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const narrowCompensation = safeAspect < 1 ? 1 + (1 - safeAspect) * 0.22 : 1;

  return {
    fov: THREE.MathUtils.lerp(36, 23, blend),
    offset: [
      0,
      THREE.MathUtils.lerp(2.25, 0.72, blend) * narrowCompensation,
      THREE.MathUtils.lerp(0.38, 0.2, blend) * narrowCompensation,
    ],
    lookHeight: 0,
  };
}