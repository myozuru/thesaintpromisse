export type DiceDramaLevel = 0 | 1 | 2 | 3;

export type DiceDramaConfig = {
  timeScale: number;
  verticalImpulse: number;
  restitution: number;
  gravityScale: number;
  trayRoof: number;
  impactGain: number;
  impactPitch: number;
  lowpassHz: number;
  resonanceGain: number;
  reverbWet: number;
};

/** Progressão limitada da física e do áudio: normal, tenso, épico e lendário. */
export const DICE_DRAMA_CONFIG: readonly DiceDramaConfig[] = [
  { timeScale: 1, verticalImpulse: 1, restitution: 1, gravityScale: 2.4, trayRoof: 2.2, impactGain: 1, impactPitch: 1, lowpassHz: 8_000, resonanceGain: 0, reverbWet: 0 },
  { timeScale: 0.68, verticalImpulse: 1.5, restitution: 1.2, gravityScale: 2.25, trayRoof: 2.7, impactGain: 1.18, impactPitch: 0.9, lowpassHz: 3_800, resonanceGain: 5, reverbWet: 0.28 },
  { timeScale: 0.46, verticalImpulse: 2.1, restitution: 1.4, gravityScale: 2, trayRoof: 3.4, impactGain: 1.38, impactPitch: 0.79, lowpassHz: 2_200, resonanceGain: 9, reverbWet: 0.48 },
  { timeScale: 0.16, verticalImpulse: 4.8, restitution: 1.78, gravityScale: 1.45, trayRoof: 5.2, impactGain: 1.6, impactPitch: 0.68, lowpassHz: 1_250, resonanceGain: 13, reverbWet: 0.68 },
] as const;

export function normalizeDiceDrama(drama: number): DiceDramaLevel {
  return Math.max(0, Math.min(3, Math.round(drama))) as DiceDramaLevel;
}

export function getDiceDramaConfig(drama: number): DiceDramaConfig {
  return DICE_DRAMA_CONFIG[normalizeDiceDrama(drama)];
}