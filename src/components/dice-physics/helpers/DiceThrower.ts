import type { DiceThrow, DiceVector3, DiceQuaternion } from "../types";
import { random } from "./random";

const MIN_X = -1.45;
const MAX_X = 1.45;
const MIN_Y = 1;
const MAX_Y = 1.2;
const MIN_Z = -2.25;
const MAX_Z = 2.25;
const MIN_LAUNCH_VELOCITY = 1.2;
const MAX_LAUNCH_VELOCITY = 1.9;
const MIN_ANGULAR_VELOCITY = 3.5;
const MAX_ANGULAR_VELOCITY = 7;
const EDGE_INSET = 0.22;
const CROSS_VARIATION = 0.5;
const LIFT_WEIGHT = 0.12;

export type DiceLaunchEdge = "left" | "right" | "near" | "far";

/**
 * Escolhe um ponto sobre uma das quatro paredes (ligeiramente para dentro),
 * de onde o dado será "arremessado" em direção ao lado oposto.
 */
export function randomPosition(edge?: DiceLaunchEdge): DiceVector3 {
  const selected = edge ?? (["left", "right", "near", "far"] as const)[Math.floor(Math.random() * 4)];
  const y = random(MIN_Y, MAX_Y);
  if (selected === "left") return { x: MIN_X + EDGE_INSET, y, z: random(MIN_Z * 0.7, MAX_Z * 0.7) };
  if (selected === "right") return { x: MAX_X - EDGE_INSET, y, z: random(MIN_Z * 0.7, MAX_Z * 0.7) };
  if (selected === "near") return { x: random(MIN_X * 0.7, MAX_X * 0.7), y, z: MAX_Z - EDGE_INSET };
  return { x: random(MIN_X * 0.7, MAX_X * 0.7), y, z: MIN_Z + EDGE_INSET };
}

export function randomRotation(): DiceQuaternion {
  let x, y, z, u, v, w, s;
  do { x = random(-1, 1); y = random(-1, 1); z = x * x + y * y; } while (z > 1);
  do { u = random(-1, 1); v = random(-1, 1); w = u * u + v * v; } while (w > 1);
  s = Math.sqrt((1 - z) / w);
  return { x, y, z: s * u, w: s * v };
}

/**
 * Mira a borda oposta em trajetória diagonal e baixa. O torque perpendicular
 * à direção faz o dado rolar de lado, em vez de apenas saltar até o centro.
 */
export function randomLinearVelocity(position: DiceVector3, speedMultiplier = 1): DiceVector3 {
  const { x, z } = position;
  const length = Math.sqrt(x * x + z * z);
  if (isNaN(length) || length === 0) return { x: 0, y: 0, z: 0 };
  const speed = random(MIN_LAUNCH_VELOCITY, MAX_LAUNCH_VELOCITY) * speedMultiplier;
  const onVerticalEdge = Math.abs(x / MAX_X) >= Math.abs(z / MAX_Z);
  const targetX = onVerticalEdge
    ? -Math.sign(x) * (MAX_X - EDGE_INSET)
    : random(MIN_X * CROSS_VARIATION, MAX_X * CROSS_VARIATION);
  const targetZ = onVerticalEdge
    ? Math.max(MIN_Z * CROSS_VARIATION, Math.min(MAX_Z * CROSS_VARIATION, -z * 0.55 + random(-0.75, 0.75)))
    : -Math.sign(z) * (MAX_Z - EDGE_INSET);
  const directionX = targetX - x;
  const directionZ = targetZ - z;
  const directionLength = Math.sqrt(directionX * directionX + directionZ * directionZ);
  return {
    x: (directionX / directionLength) * speed,
    y: speed * LIFT_WEIGHT,
    z: (directionZ / directionLength) * speed,
  };
}

export function randomAngularVelocity(linearVelocity?: DiceVector3): DiceVector3 {
  if (linearVelocity) {
    const roll = random(MIN_ANGULAR_VELOCITY, MAX_ANGULAR_VELOCITY);
    const wobble = random(-1.2, 1.2);
    return {
      x: linearVelocity.z * roll,
      y: wobble,
      z: -linearVelocity.x * roll,
    };
  }
  return {
    x: random(MIN_ANGULAR_VELOCITY, MAX_ANGULAR_VELOCITY),
    y: random(MIN_ANGULAR_VELOCITY, MAX_ANGULAR_VELOCITY),
    z: random(MIN_ANGULAR_VELOCITY, MAX_ANGULAR_VELOCITY),
  };
}

export function getRandomDiceThrow(speedMultiplier = 1): DiceThrow {
  const position = randomPosition();
  const linearVelocity = randomLinearVelocity(position, speedMultiplier);
  return {
    position,
    rotation: randomRotation(),
    linearVelocity,
    angularVelocity: randomAngularVelocity(linearVelocity),
  };
}

export class DiceThrower {
  private history: DiceThrow[] = [];
  private isPositionValid(p: DiceVector3) {
    for (const t of this.history) {
      const dx = p.x - t.position.x, dy = p.y - t.position.y, dz = p.z - t.position.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 0.25) return false;
    }
    return true;
  }
  getDiceThrow(index: number): DiceThrow {
    if (this.history.length > index) return this.history[index];
    let position = randomPosition();
    for (let i = 0; i < 50; i++) {
      if (this.isPositionValid(position)) break;
      position = randomPosition();
    }
    const linearVelocity = randomLinearVelocity(position);
    const t: DiceThrow = {
      position,
      rotation: randomRotation(),
      linearVelocity,
      angularVelocity: randomAngularVelocity(linearVelocity),
    };
    this.history.push(t);
    return t;
  }
  clearHistory() { this.history = []; }
}
