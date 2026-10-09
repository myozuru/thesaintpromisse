import type { UserRole } from '@/stores/useRoleStore';
import type { WorldSlice } from '@/lib/socket';

/** Fatias cuja origem oficial é o Mestre e que não devem confiar em broadcast de cliente. */
export const MASTER_CONTROLLED_WORLD_SLICES: ReadonlySet<WorldSlice> = new Set([
  'chronos',
  'worldMap',
  'worldBosses',
  'worldBossesMaster',
  'omniEntidades',
]);

export function isMasterControlledWorldSlice(slice: WorldSlice): boolean {
  return MASTER_CONTROLLED_WORLD_SLICES.has(slice);
}

export function podePublicarWorldSlice(role: UserRole, slice: WorldSlice): boolean {
  return !isMasterControlledWorldSlice(slice) || role === 'MASTER';
}
