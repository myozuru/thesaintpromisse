import { it, expect } from "vitest";
import * as THREE from "three";
import { getCinematicCameraPlacement } from "@/components/dice-physics/cameraFraming";
it("die stays centered during whole final zoom", () => {
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const off = new THREE.Vector3(); let init = false; let sb = 0; let maxErr = 0;
  for (let f = 0; f < 600; f++) {
    const dt = 1 / 60, t = f * dt, settled = t > 3;
    const p = new THREE.Vector3(Math.sin(t) * (settled ? 0.2 : 1), settled ? 0.1 : Math.abs(Math.sin(t * 5)), Math.cos(t));
    const aspect = settled ? 1.6 - Math.min(1, (t - 3)) * 0.9 : 1.6; // panel shrinking
    sb = THREE.MathUtils.damp(sb, settled ? 1 : 0, 3.2, dt);
    const b = sb * sb * (3 - 2 * sb);
    const pl = getCinematicCameraPlacement(b, aspect);
    const n = new THREE.Vector3(...pl.offset);
    if (!init) { off.copy(n); init = true; } else off.lerp(n, 1 - Math.exp(-8 * dt));
    cam.aspect = aspect; cam.position.copy(p).add(off); cam.lookAt(p);
    cam.fov = THREE.MathUtils.damp(cam.fov, pl.fov, 5, dt); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const ndc = p.clone().project(cam);
    maxErr = Math.max(maxErr, Math.hypot(ndc.x, ndc.y));
  }
  console.log("maxErr", maxErr);
  expect(maxErr).toBeLessThan(1e-4);
});
