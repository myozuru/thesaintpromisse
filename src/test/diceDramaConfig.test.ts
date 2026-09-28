import { describe, expect, it } from "vitest";
import { DICE_DRAMA_CONFIG, getDiceDramaConfig, normalizeDiceDrama } from "@/components/dice-physics/dramaConfig";

describe("configuração dramática dos dados", () => {
  it("fica mais lenta, mais alta e mais elástica a cada nível", () => {
    for (let level = 1; level < DICE_DRAMA_CONFIG.length; level += 1) {
      const previous = DICE_DRAMA_CONFIG[level - 1];
      const current = DICE_DRAMA_CONFIG[level];
      expect(current.timeScale).toBeLessThan(previous.timeScale);
      expect(current.velocityMultiplier).toBeGreaterThan(previous.velocityMultiplier);
      expect(current.spinMultiplier).toBeGreaterThan(previous.spinMultiplier);
      expect(current.verticalImpulse).toBeGreaterThan(previous.verticalImpulse);
      expect(current.bounceHeightMultiplier).toBeGreaterThan(previous.bounceHeightMultiplier);
      expect(current.restitution).toBeGreaterThan(previous.restitution);
      expect(current.gravityScale).toBeLessThan(previous.gravityScale);
      expect(current.linearDamping).toBeLessThan(previous.linearDamping);
      expect(current.angularDamping).toBeLessThan(previous.angularDamping);
      expect(current.trayRoof).toBeGreaterThan(previous.trayRoof);
      expect(current.impactGain).toBeGreaterThan(previous.impactGain);
      expect(current.impactPitch).toBeLessThan(previous.impactPitch);
      expect(current.lowpassHz).toBeLessThan(previous.lowpassHz);
      expect(current.reverbWet).toBeGreaterThanOrEqual(previous.reverbWet);
    }
  });

  it("torna o lendário muito mais alto e lento que o épico", () => {
    const epic = DICE_DRAMA_CONFIG[2];
    const legendary = DICE_DRAMA_CONFIG[3];
    expect(legendary.timeScale).toBeLessThanOrEqual(epic.timeScale * 0.4);
    expect(legendary.verticalImpulse).toBeGreaterThan(epic.verticalImpulse * 2);
    expect(legendary.bounceHeightMultiplier).toBeGreaterThan(epic.bounceHeightMultiplier * 1.25);
    expect(legendary.trayRoof).toBeGreaterThan(epic.trayRoof * 1.5);
    expect(legendary.velocityMultiplier).toBeGreaterThanOrEqual(1.5);
    expect(legendary.spinMultiplier).toBeGreaterThanOrEqual(2.4);
    expect(legendary.spinMultiplier).toBeGreaterThan(epic.spinMultiplier * 1.5);
  });

  it("limita níveis inválidos sem quebrar a rolagem", () => {
    expect(normalizeDiceDrama(-8)).toBe(0);
    expect(normalizeDiceDrama(99)).toBe(3);
    expect(getDiceDramaConfig(99)).toBe(DICE_DRAMA_CONFIG[3]);
  });
});