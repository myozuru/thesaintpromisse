export type DiceDramaLevel = 0 | 1 | 2 | 3;

export type DiceDramaConfig = {
  timeScale: number;
  verticalImpulse: number;
  restitution: number;
  impactGain: number;
  impactPitch: number;
  lowpassHz: number;
  resonanceGain: number;
  reverbWet: number;
};

/** Progressão limitada da física e do áudio: normal, tenso, épico e lendário. */
export const DICE_DRAMA_CONFIG: readonly DiceDramaConfig[] = [
  { timeScale: 1, verticalImpulse: 1, restitution: 1, impactGain: 1, impactPitch: 1, lowpassHz: 8_000, resonanceGain: 0, reverbWet: 0 },
  { timeScale: 0.68, verticalImpulse: 1.25, restitution: 1.12, impactGain: 1.18, impactPitch: 0.9, lowpassHz: 3_800, resonanceGain: 5, reverbWet: 0.28 },
  { timeScale: 0.46, verticalImpulse: 1.55, restitution: 1.28, impactGain: 1.38, impactPitch: 0.79, lowpassHz: 2_200, resonanceGain: 9, reverbWet: 0.48 },
  { timeScale: 0.3, verticalImpulse: 1.9, restitution: 1.45, impactGain: 1.6, impactPitch: 0.68, lowpassHz: 1_250, resonanceGain: 13, reverbWet: 0.68 },
] as const;

export function normalizeDiceDrama(drama: number): DiceDramaLevel {
  return Math.max(0, Math.min(3, Math.round(drama))) as DiceDramaLevel;
}

export function getDiceDramaConfig(drama: number): DiceDramaConfig {
  return DICE_DRAMA_CONFIG[normalizeDiceDrama(drama)];
}