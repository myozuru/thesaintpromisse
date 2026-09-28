export const TRAY_CAMERA_FOV = 42;

const TRAY_HALF_WIDTH = 2.35;
const TRAY_HALF_DEPTH = 3.8;
const DICE_VISIBILITY_MARGIN = 0.62;
const CAMERA_TILT_Z = 0.18;
const FRAME_MARGIN = 1.08;

export interface TrayCameraPlacement {
  fov: number;
  position: [number, number, number];
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