import { describe, expect, it } from 'vitest';
import { claimDiceLaunch, type DiceLaunchGuard } from '@/components/dice-physics/diceLaunchGuard';

describe('proteção contra cliques repetidos nos dados 3D', () => {
  it('aceita apenas o primeiro clique enquanto a bandeja está armada', () => {
    const guard: DiceLaunchGuard = { armed: true };
    expect(claimDiceLaunch(guard)).toBe(true);
    expect(claimDiceLaunch(guard)).toBe(false);
    expect(claimDiceLaunch(guard)).toBe(false);
  });

  it('pode ser armado novamente para a próxima rolagem', () => {
    const guard: DiceLaunchGuard = { armed: true };
    expect(claimDiceLaunch(guard)).toBe(true);
    guard.armed = true;
    expect(claimDiceLaunch(guard)).toBe(true);
  });
});