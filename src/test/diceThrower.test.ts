import { describe, expect, it, vi } from "vitest";
import { randomAngularVelocity, randomLinearVelocity } from "@/components/dice-physics/helpers/DiceThrower";

describe("lançamento lateral dos dados", () => {
  it("combina avanço para dentro, deslocamento lateral e uma leve elevação", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.75);
    const velocity = randomLinearVelocity({ x: 0.75, y: 1, z: 0 }, 1);

    expect(velocity.x).toBeLessThan(0);
    expect(Math.abs(velocity.z)).toBeGreaterThan(Math.abs(velocity.x));
    expect(velocity.y).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });

  it("faz a rotação principal atravessar a direção do movimento", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const angular = randomAngularVelocity({ x: 2, y: 0.4, z: -3 });

    expect(angular.x).toBeLessThan(0);
    expect(angular.z).toBeLessThan(0);
    expect(Math.abs(angular.y)).toBeLessThan(Math.abs(angular.x));
    vi.restoreAllMocks();
  });
});