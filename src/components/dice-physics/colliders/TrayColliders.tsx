// @ts-nocheck
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useDice3DStore } from "@/stores/useDice3DStore";
import { getDiceDramaConfig } from "../dramaConfig";

const WALL_THICKNESS = 50;
const WALL_SIZE = 100;
const FLOOR_Y = -WALL_THICKNESS + 0.005;
// Arena compacta para destacar os dados sem cortar suas bordas.
const WALL_X = WALL_THICKNESS + 0.933;
const WALL_Z = WALL_THICKNESS + 1.4;

export function TrayColliders() {
  const bounciness = useDice3DStore((s) => s.bounciness);
  const drama = useDice3DStore((s) => s.current?.drama ?? 0);
  const roofY = WALL_THICKNESS + getDiceDramaConfig(drama).trayRoof;
  return (
    <group>
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
