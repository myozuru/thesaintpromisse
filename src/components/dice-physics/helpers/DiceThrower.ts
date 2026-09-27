import type { DiceThrow, DiceVector3, DiceQuaternion } from "../types";
import { random } from "./random";

const MIN_X = -0.75;
const MAX_X = 0.75;
const MIN_Y = 1;
const MAX_Y = 1.2;
const MIN_Z = -1.3;
const MAX_Z = 1.3;
const MIN_LAUNCH_VELOCITY = 1;
const MAX_LAUNCH_VELOCITY = 2;
const MIN_ANGULAR_VELOCITY = 2;
const MAX_ANGULAR_VELOCITY = 6;
const INWARD_WEIGHT = 0.58;
const SIDEWAYS_WEIGHT = 0.82;
const LIFT_WEIGHT = 0.22;

/**
 * Escolhe um ponto sobre uma das quatro paredes (ligeiramente para dentro),
 * de onde o dado será "arremessado" em direção ao lado oposto.
 */
export function randomPosition(): DiceVector3 {
  return { x: random(MIN_X, MAX_X), y: random(MIN_Y, MAX_Y), z: random(MIN_Z, MAX_Z) };
}

export function randomRotation(): DiceQuaternion {
  let x, y, z, u, v, w, s;
  do { x = random(-1, 1); y = random(-1, 1); z = x * x + y * y; } while (z > 1);
  do { u = random(-1, 1); v = random(-1, 1); w = u * u + v * v; } while (w > 1);
  s = Math.sqrt((1 - z) / w);
  return { x, y, z: s * u, w: s * v };
}

/**
 * Lança na diagonal: conserva uma parcela para dentro e outra maior de lado.
 * Assim o dado atravessa e percorre a bandeja em vez de cair quase no mesmo ponto.
 */
export function randomLinearVelocity(position: DiceVector3, speedMultiplier = 1): DiceVector3 {
  const { x, z } = position;
  const length = Math.sqrt(x * x + z * z);
  if (isNaN(length) || length === 0) return { x: 0, y: 0, z: 0 };
  const speed = random(MIN_LAUNCH_VELOCITY, MAX_LAUNCH_VELOCITY) * speedMultiplier;
  const inwardX = -x / length;
  const inwardZ = -z / length;
  const side = Math.random() < 0.5 ? -1 : 1;
  const sidewaysX = -inwardZ * side;
  const sidewaysZ = inwardX * side;
  const directionX = inwardX * INWARD_WEIGHT + sidewaysX * SIDEWAYS_WEIGHT;
  const directionZ = inwardZ * INWARD_WEIGHT + sidewaysZ * SIDEWAYS_WEIGHT;
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
