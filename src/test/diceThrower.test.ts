import { describe, expect, it, vi } from "vitest";
import { randomAngularVelocity, randomLinearVelocity, randomPosition } from "@/components/dice-physics/helpers/DiceThrower";
import { preserveDiceSpin } from "@/components/dice-physics/angularMomentum";

describe("lançamento lateral dos dados", () => {
  it("atravessa da borda esquerda em direção à borda direita", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.75);
    const start = randomPosition("left");
    const velocity = randomLinearVelocity(start, 1);

    expect(start.x).toBeLessThan(-1.7);
    expect(velocity.x).toBeGreaterThan(0);
    expect(velocity.y).toBeGreaterThan(0);
    expect(Math.abs(velocity.x)).toBeGreaterThan(Math.abs(velocity.y) * 5);
    vi.restoreAllMocks();
  });

  it("atravessa da borda distante em direção à borda próxima", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const start = randomPosition("far");
    const velocity = randomLinearVelocity(start, 1);
    expect(start.z).toBeLessThan(-3);
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