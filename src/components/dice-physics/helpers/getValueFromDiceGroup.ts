import * as THREE from "three";

const meshPosition = new THREE.Vector3();
const locatorVector = new THREE.Vector3();
const meshQuaternion = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const textNormal = new THREE.Vector3(0, 0, 1);
const textUp = new THREE.Vector3(0, 1, 0);
const screenUp = new THREE.Vector3(0, 0, -1);

/** Read the face value pointing up from a dice group with locator children. */
export function getValueFromDiceGroup(parent: THREE.Group): number {
  return getTopFaceInfo(parent).value;
}

/**
 * Returns the top face value, the dot product of its locator with world-up
 * (1 = perfectly flat, ~0.5 = on an edge/vertex) and the local-space direction
 * of that locator (useful to snap the rotation so the face points up).
 */
export function getTopFaceInfo(parent: THREE.Group): {
  value: number;
  dot: number;
  localDir: THREE.Vector3 | null;
  worldDir: THREE.Vector3 | null;
  worldTextUp: THREE.Vector3 | null;
} {
  let highestDot = -1;
  let highestNumber = 0;
  let highestLocalDir: THREE.Vector3 | null = null;
  let highestWorldDir: THREE.Vector3 | null = null;
  let highestWorldTextUp: THREE.Vector3 | null = null;
  const dice = parent.getObjectByName("dice");
  const mesh = dice?.children[0];
  const locators = mesh?.children;
  if (mesh && locators) {
    for (const locator of locators) {
      if (!locator.name || !locator.name.includes("_locator_")) continue;
      const valueStr = locator.name.slice(locator.name.lastIndexOf("_") + 1);
      const parsed = parseInt(valueStr, 10);
      if (Number.isNaN(parsed)) continue;
      mesh.getWorldPosition(meshPosition);
      locator.getWorldPosition(locatorVector);
      locatorVector.sub(meshPosition).normalize();
      const dot = locatorVector.dot(up);
      if (dot > highestDot) {
        highestDot = dot;
        highestNumber = parsed;
        // Local direction (relative to the mesh) of this locator.
        highestLocalDir = locator.position.clone().normalize();
        highestWorldDir = locatorVector.clone();
        mesh.getWorldQuaternion(meshQuaternion);
        const labelRotation = new THREE.Quaternion().setFromUnitVectors(textNormal, highestLocalDir);
        highestWorldTextUp = textUp.clone().applyQuaternion(labelRotation).applyQuaternion(meshQuaternion).normalize();
      }
    }
  }
  return { value: highestNumber, dot: highestDot, localDir: highestLocalDir, worldDir: highestWorldDir, worldTextUp: highestWorldTextUp };
}

/** Mantém a face sorteada para cima e gira ao redor do eixo vertical para deixar o número de pé. */
export function getReadableFaceRotation(
  currentRotation: THREE.Quaternion,
  faceNormal: THREE.Vector3,
  faceTextUp: THREE.Vector3,
): THREE.Quaternion {
  const levelFace = new THREE.Quaternion().setFromUnitVectors(faceNormal.clone().normalize(), up);
  const leveledTextUp = faceTextUp.clone().applyQuaternion(levelFace);
  leveledTextUp.y = 0;
  if (leveledTextUp.lengthSq() < 1e-8) return levelFace.multiply(currentRotation.clone()).normalize();
  leveledTextUp.normalize();
  const angle = Math.atan2(up.dot(leveledTextUp.clone().cross(screenUp)), leveledTextUp.dot(screenUp));
  const turnUpright = new THREE.Quaternion().setFromAxisAngle(up, angle);
  return turnUpright.multiply(levelFace).multiply(currentRotation.clone()).normalize();
}
