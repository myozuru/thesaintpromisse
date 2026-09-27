import { describe, expect, it } from "vitest";
import { DICE_DRAMA_CONFIG, getDiceDramaConfig, normalizeDiceDrama } from "@/components/dice-physics/dramaConfig";

describe("configuração dramática dos dados", () => {
  it("fica mais lenta, mais alta e mais elástica a cada nível", () => {
    for (let level = 1; level < DICE_DRAMA_CONFIG.length; level += 1) {
      const previous = DICE_DRAMA_CONFIG[level - 1];
      const current = DICE_DRAMA_CONFIG[level];
      expect(current.timeScale).toBeLessThan(previous.timeScale);
      expect(current.verticalImpulse).toBeGreaterThan(previous.verticalImpulse);
      expect(current.restitution).toBeGreaterThan(previous.restitution);
      expect(current.impactGain).toBeGreaterThan(previous.impactGain);
      expect(current.impactPitch).toBeLessThan(previous.impactPitch);
      expect(current.lowpassHz).toBeLessThan(previous.lowpassHz);
      expect(current.reverbWet).toBeGreaterThanOrEqual(previous.reverbWet);
    }
  });

  it("limita níveis inválidos sem quebrar a rolagem", () => {
    expect(normalizeDiceDrama(-8)).toBe(0);
    expect(normalizeDiceDrama(99)).toBe(3);
    expect(getDiceDramaConfig(99)).toBe(DICE_DRAMA_CONFIG[3]);
  });
});