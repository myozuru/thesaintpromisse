import * as THREE from "three";

const meshPosition = new THREE.Vector3();
const locatorVector = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

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
} {
  let highestDot = -1;
  let highestNumber = 0;
  let highestLocalDir: THREE.Vector3 | null = null;
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
      }
    }
  }
  return { value: highestNumber, dot: highestDot, localDir: highestLocalDir };
}
