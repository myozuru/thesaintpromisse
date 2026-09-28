// @ts-nocheck
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useDice3DStore } from "@/stores/useDice3DStore";
import { getDiceDramaConfig } from "../dramaConfig";
import type { DiceVector3 } from "../types";
import * as THREE from "three";

const WALL_THICKNESS = 50;
const WALL_SIZE = 100;
const FLOOR_Y = -WALL_THICKNESS + 0.005;
// Os limites visuais e físicos compartilham estas dimensões.
const WALL_X = WALL_THICKNESS + 0.622;
const WALL_Z = WALL_THICKNESS + 0.933;
const MAX_REACTIVE_DICE = 12;

export type DicePositionRegistry = React.MutableRefObject<Map<string, DiceVector3>>;

const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  #define MAX_DICE ${MAX_REACTIVE_DICE}
  uniform float uTime;
  uniform int uDiceCount;
  uniform vec3 uDicePositions[MAX_DICE];
  uniform vec3 uAccentA;
  uniform vec3 uAccentB;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    float field = 0.0;
    float pulse = 0.0;
    for (int i = 0; i < MAX_DICE; i++) {
      if (i >= uDiceCount) break;
      float distanceToDie = distance(vWorldPosition, uDicePositions[i]);
      float proximity = 1.0 - smoothstep(0.18, 0.86, distanceToDie);
      field = max(field, proximity);
      float ring = 1.0 - smoothstep(0.025, 0.09, abs(distanceToDie - mod(uTime * 0.34, 0.72)));
      pulse = max(pulse, ring * proximity);
    }

    vec2 cells = abs(fract(vUv * vec2(8.0, 11.0) - 0.5) - 0.5) / fwidth(vUv * vec2(8.0, 11.0));
    float grid = 1.0 - min(min(cells.x, cells.y), 1.0);
    float circuit = smoothstep(0.76, 0.98, sin((vUv.x * 17.0 + vUv.y * 13.0) * 3.14159) * 0.5 + 0.5);
    float scan = 0.72 + 0.28 * sin(uTime * 3.2 + vWorldPosition.y * 9.0 + vWorldPosition.x * 4.0);
    float visible = clamp(field * (0.34 + grid * 0.72 + circuit * 0.18) * scan + pulse * 0.5, 0.0, 1.0);
    vec3 color = mix(uAccentA, uAccentB, clamp(grid * 0.65 + pulse * 0.55, 0.0, 1.0));
    gl_FragColor = vec4(color, visible * 0.82);
  }
`;

function CollisionField({ roofY, accentA, accentB, dicePositionsRef }: {
  roofY: number;
  accentA: string;
  accentB: string;
  dicePositionsRef: DicePositionRegistry;
}) {
  const width = (WALL_X - WALL_THICKNESS) * 2;
  const depth = (WALL_Z - WALL_THICKNESS) * 2;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const diceVectors = useMemo(
    () => Array.from({ length: MAX_REACTIVE_DICE }, () => new THREE.Vector3(100, 100, 100)),
    [],
  );
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uDiceCount: { value: 0 },
    uDicePositions: { value: diceVectors },
    uAccentA: { value: new THREE.Color(accentA) },
    uAccentB: { value: new THREE.Color(accentB) },
  }), [accentA, accentB, diceVectors]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }), [uniforms]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    let index = 0;
    for (const position of dicePositionsRef.current.values()) {
      if (index >= MAX_REACTIVE_DICE) break;
      diceVectors[index].set(position.x, position.y, position.z);
      index += 1;
    }
    uniforms.uDiceCount.value = index;
  });

  return (
    <group aria-label="Limites físicos reativos">
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.009, 0]} material={material}>
        <planeGeometry args={[width, depth, 1, 1]} />
      </mesh>
      {[-halfWidth, halfWidth].map((x) => (
        <mesh key={`side-${x}`} position={[x, roofY / 2, 0]} rotation-y={Math.PI / 2} material={material}>
          <planeGeometry args={[depth, roofY, 1, 1]} />
        </mesh>
      ))}
      {[-halfDepth, halfDepth].map((z) => (
        <mesh key={`end-${z}`} position={[0, roofY / 2, z]} material={material}>
          <planeGeometry args={[width, roofY, 1, 1]} />
        </mesh>
      ))}
    </group>
  );
}

export function TrayColliders({ dicePositionsRef }: { dicePositionsRef: DicePositionRegistry }) {
  const bounciness = useDice3DStore((s) => s.bounciness);
  const drama = useDice3DStore((s) => s.current?.drama ?? 0);
  const config = getDiceDramaConfig(drama);
  const roofY = WALL_THICKNESS + config.trayRoof;
  return (
    <group>
      <CollisionField roofY={config.trayRoof} accentA={config.palette.accentA} accentB={config.palette.accentB} dicePositionsRef={dicePositionsRef} />
      <RigidBody type="fixed" friction={1.6} restitution={Math.min(0.95, 0.6 * bounciness)}>
        <CuboidCollider args={[WALL_SIZE, WALL_THICKNESS, WALL_SIZE]} position={[0, FLOOR_Y, 0]} />
      </RigidBody>

      <RigidBody type="fixed" friction={1} restitution={Math.min(0.95, 0.7 * bounciness)}>
        <CuboidCollider args={[WALL_SIZE, WALL_THICKNESS, WALL_SIZE]} position={[0, FLOOR_Y, WALL_Z]} rotation={[Math.PI/2,0,0]} />
        <CuboidCollider args={[WALL_SIZE, WALL_THICKNESS, WALL_SIZE]} position={[0, FLOOR_Y, -WALL_Z]} rotation={[Math.PI/2,0,0]} />
        <CuboidCollider args={[WALL_SIZE, WALL_THICKNESS, WALL_SIZE]} position={[WALL_X, FLOOR_Y, 0]} rotation={[0,0,Math.PI/2]} />
        <CuboidCollider args={[WALL_SIZE, WALL_THICKNESS, WALL_SIZE]} position={[-WALL_X, FLOOR_Y, 0]} rotation={[0,0,Math.PI/2]} />
        <CuboidCollider args={[WALL_SIZE, WALL_THICKNESS, WALL_SIZE]} position={[0, roofY, 0]} />
      </RigidBody>
    </group>
  );
}
