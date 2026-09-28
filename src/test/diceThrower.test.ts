import { describe, expect, it, vi } from "vitest";
import { randomAngularVelocity, randomLinearVelocity, randomPosition } from "@/components/dice-physics/helpers/DiceThrower";
import { preserveDiceSpin } from "@/components/dice-physics/angularMomentum";
import { getTrayCameraPlacement } from "@/components/dice-physics/cameraFraming";
import { getReadableFaceRotation } from "@/components/dice-physics/helpers/getValueFromDiceGroup";
import * as THREE from "three";

describe("lançamento lateral dos dados", () => {
  it("atravessa da borda esquerda em direção à borda direita", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.75);
    const start = randomPosition("left");
    const velocity = randomLinearVelocity(start, 1);

    expect(start.x).toBeLessThan(-0.4);
    expect(velocity.x).toBeGreaterThan(0);
    expect(velocity.y).toBeGreaterThan(0);
    expect(Math.abs(velocity.x)).toBeGreaterThan(Math.abs(velocity.y) * 5);
    vi.restoreAllMocks();
  });

  it("atravessa da borda distante em direção à borda próxima", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const start = randomPosition("far");
    const velocity = randomLinearVelocity(start, 1);
    expect(start.z).toBeLessThan(-0.7);
    expect(velocity.z).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });

  it("faz a rotação principal atravessar a direção do movimento", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const angular = randomAngularVelocity({ x: 2, y: 0.4, z: -3 });

    expect(angular.x).toBeLessThan(0);
    expect(angular.z).toBeLessThan(0);
    expect(Math.abs(angular.y)).toBeLessThan(Math.abs(angular.x));
    expect(Math.hypot(angular.x, angular.z)).toBeGreaterThan(10);
    vi.restoreAllMocks();
  });
});

describe("continuidade da rotação após colisões", () => {
  it("impede que um impacto inverta o giro dominante", () => {
    const stabilized = preserveDiceSpin({ x: 10, y: 0, z: 0 }, { x: -8, y: 2, z: 1 }, 4);
    expect(stabilized.x).toBeGreaterThanOrEqual(3.19);
    expect(Math.hypot(stabilized.x, stabilized.y, stabilized.z)).toBeLessThanOrEqual(10);
  });

  it("preserva parte do giro quando o impacto tenta zerá-lo", () => {
    const stabilized = preserveDiceSpin({ x: 0, y: 0, z: -12 }, { x: 0.2, y: 0.1, z: -0.2 }, 3);
    expect(stabilized.z).toBeLessThanOrEqual(-3.83);
  });

  it("não interfere no giro lento durante o assentamento", () => {
    const after = { x: -0.1, y: 0.05, z: 0 };
    expect(preserveDiceSpin({ x: 0.2, y: 0, z: 0 }, after, 0.1)).toEqual(after);
  });
});

describe("enquadramento da bandeja", () => {
  it("mantém distância segura e abre o campo de visão em bandejas estreitas", () => {
    const wide = getTrayCameraPlacement(16 / 9);
    const narrow = getTrayCameraPlacement(9 / 16);

    expect(wide.position[1]).toBeGreaterThan(2.5);
    expect(wide.position[1]).toBeLessThan(2.6);
    expect(narrow.position[1]).toBeGreaterThan(2.6);
    expect(narrow.position[1]).toBeLessThan(2.7);
    expect(narrow.fov).toBeGreaterThan(wide.fov);
  });

  it("mantém valores seguros antes das dimensões ficarem disponíveis", () => {
    const placement = getTrayCameraPlacement(0);

    expect(placement.position.every(Number.isFinite)).toBe(true);
    expect(placement.position[1]).toBeGreaterThan(0);
  });
});

describe("leitura cinematográfica da face", () => {
  it("mantém a face vencedora para cima e orienta o número para o topo da tela", () => {
    const current = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, -0.8, 0.25));
    const localFace = new THREE.Vector3(0.3, 0.85, -0.42).normalize();
    const localTextUp = new THREE.Vector3(0.7, -0.08, 0.7).normalize();
    const target = getReadableFaceRotation(current, localFace.clone().applyQuaternion(current), localTextUp.clone().applyQuaternion(current));
    const finalFace = localFace.clone().applyQuaternion(target);
    const finalTextUp = localTextUp.clone().applyQuaternion(target);
    finalTextUp.y = 0;
    finalTextUp.normalize();
    expect(finalFace.angleTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(0.0001);
    expect(finalTextUp.angleTo(new THREE.Vector3(0, 0, -1))).toBeLessThan(0.0001);
  });
});