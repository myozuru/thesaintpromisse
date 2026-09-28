import { describe, expect, it, vi } from "vitest";
import { randomAngularVelocity, randomLinearVelocity, randomPosition } from "@/components/dice-physics/helpers/DiceThrower";

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