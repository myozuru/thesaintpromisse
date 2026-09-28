// @ts-nocheck
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useDice3DStore } from "@/stores/useDice3DStore";
import { getDiceDramaConfig } from "../dramaConfig";
import * as THREE from "three";

const WALL_THICKNESS = 50;
const WALL_SIZE = 100;
const FLOOR_Y = -WALL_THICKNESS + 0.005;
// Arena compacta para destacar os dados sem cortar suas bordas.
const WALL_X = WALL_THICKNESS + 0.622;
const WALL_Z = WALL_THICKNESS + 0.933;

function CollisionField({ roofY, accentA, accentB }: { roofY: number; accentA: string; accentB: string }) {
  const width = (WALL_X - WALL_THICKNESS) * 2;
  const depth = (WALL_Z - WALL_THICKNESS) * 2;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const gridX = Array.from({ length: 7 }, (_, index) => -halfWidth + (width * index) / 6);
  const gridZ = Array.from({ length: 9 }, (_, index) => -halfDepth + (depth * index) / 8);
  const rail = 0.012;

  return (
    <group aria-label="Limites físicos visíveis">
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.008, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={accentA} emissive={accentA} emissiveIntensity={0.18} transparent opacity={0.08} roughness={0.82} metalness={0.38} depthWrite={false} />
      </mesh>
      {gridX.map((x) => (
        <mesh key={`gx-${x}`} position={[x, 0.014, 0]}>
          <boxGeometry args={[0.005, 0.005, depth]} />
          <meshBasicMaterial color={accentA} transparent opacity={0.2} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {gridZ.map((z) => (
        <mesh key={`gz-${z}`} position={[0, 0.014, z]}>
          <boxGeometry args={[width, 0.005, 0.005]} />
          <meshBasicMaterial color={accentB} transparent opacity={0.16} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {[-halfWidth, halfWidth].map((x) => (
        <group key={`side-${x}`}>
          <mesh position={[x, roofY / 2, 0]} rotation-y={Math.PI / 2}>
            <planeGeometry args={[depth, roofY]} />
            <meshBasicMaterial color={accentA} transparent opacity={0.035} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[x, roofY, 0]}>
            <boxGeometry args={[rail, rail, depth]} />
            <meshBasicMaterial color={accentB} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {[-halfDepth, halfDepth].map((z) => (
        <group key={`end-${z}`}>
          <mesh position={[0, roofY / 2, z]}>
            <planeGeometry args={[width, roofY]} />
            <meshBasicMaterial color={accentB} transparent opacity={0.03} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, roofY, z]}>
            <boxGeometry args={[width, rail, rail]} />
            <meshBasicMaterial color={accentA} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {[-halfWidth, halfWidth].flatMap((x) => [-halfDepth, halfDepth].map((z) => (
        <mesh key={`corner-${x}-${z}`} position={[x, roofY / 2, z]}>
          <boxGeometry args={[rail, roofY, rail]} />
          <meshBasicMaterial color={accentB} transparent opacity={0.65} depthWrite={false} toneMapped={false} />
        </mesh>
      )))}
    </group>
  );
}

export function TrayColliders() {
  const bounciness = useDice3DStore((s) => s.bounciness);
  const drama = useDice3DStore((s) => s.current?.drama ?? 0);
  const config = getDiceDramaConfig(drama);
  const roofY = WALL_THICKNESS + config.trayRoof;
  return (
    <group>
      <CollisionField roofY={config.trayRoof} accentA={config.palette.accentA} accentB={config.palette.accentB} />
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
