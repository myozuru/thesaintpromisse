export type DiceDramaLevel = 0 | 1 | 2 | 3;

export type DiceDramaConfig = {
  timeScale: number;
  /** Velocidade física real, independente do slow motion visual. */
  velocityMultiplier: number;
  spinMultiplier: number;
  verticalImpulse: number;
  /** Amplifica somente a velocidade vertical devolvida pelo impacto no piso. */
  bounceHeightMultiplier: number;
  restitution: number;
  gravityScale: number;
  linearDamping: number;
  angularDamping: number;
  trayRoof: number;
  impactGain: number;
  impactPitch: number;
  lowpassHz: number;
  resonanceGain: number;
  reverbWet: number;
  /** Paleta da bandeja 3D por nível: fundo/névoa, luz ambiente e dois acentos. */
  palette: { bg: string; ambient: string; accentA: string; accentB: string };
};

/** Progressão limitada da física e do áudio: normal, tenso, épico e lendário. */
export const DICE_DRAMA_CONFIG: readonly DiceDramaConfig[] = [
  { timeScale: 1, velocityMultiplier: 1, spinMultiplier: 1, verticalImpulse: 1, bounceHeightMultiplier: 1, restitution: 1, gravityScale: 2.4, linearDamping: 0.3, angularDamping: 0.4, trayRoof: 2.2, impactGain: 1, impactPitch: 1, lowpassHz: 8_000, resonanceGain: 0, reverbWet: 0,
    palette: { bg: '#0d0617', ambient: '#3a1d6e', accentA: '#9b5cff', accentB: '#e8c46b' } },
  { timeScale: 0.68, velocityMultiplier: 1.08, spinMultiplier: 1.2, verticalImpulse: 1.5, bounceHeightMultiplier: 1.18, restitution: 1.2, gravityScale: 2.25, linearDamping: 0.28, angularDamping: 0.36, trayRoof: 2.7, impactGain: 1.18, impactPitch: 0.9, lowpassHz: 3_800, resonanceGain: 5, reverbWet: 0.28,
    palette: { bg: '#070d1c', ambient: '#16305e', accentA: '#4f8cff', accentB: '#9fd0ff' } },
  { timeScale: 0.46, velocityMultiplier: 1.18, spinMultiplier: 1.5, verticalImpulse: 2.1, bounceHeightMultiplier: 1.42, restitution: 1.4, gravityScale: 2, linearDamping: 0.24, angularDamping: 0.3, trayRoof: 3.4, impactGain: 1.38, impactPitch: 0.79, lowpassHz: 2_200, resonanceGain: 9, reverbWet: 0.48,
    palette: { bg: '#160705', ambient: '#5e1f10', accentA: '#ff7a3c', accentB: '#ffc46b' } },
  { timeScale: 0.16, velocityMultiplier: 1.55, spinMultiplier: 2.4, verticalImpulse: 5.4, bounceHeightMultiplier: 1.85, restitution: 1.8, gravityScale: 1.35, linearDamping: 0.14, angularDamping: 0.2, trayRoof: 6.4, impactGain: 1.6, impactPitch: 0.68, lowpassHz: 1_250, resonanceGain: 13, reverbWet: 0.68,
    palette: { bg: '#100309', ambient: '#4a0716', accentA: '#ff2e4d', accentB: '#ffd24d' } },
] as const;

export function normalizeDiceDrama(drama: number): DiceDramaLevel {
  return Math.max(0, Math.min(3, Math.round(drama))) as DiceDramaLevel;
}

export function getDiceDramaConfig(drama: number): DiceDramaConfig {
  return DICE_DRAMA_CONFIG[normalizeDiceDrama(drama)];
}