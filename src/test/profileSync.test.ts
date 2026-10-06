import { describe, expect, it } from 'vitest';
import { mergeSyncedProfiles, projectProfilesForSync } from '@/lib/profileSync';
import type { PlayerProfile } from '@/stores/useProfileStore';

const profile = (overrides: Partial<PlayerProfile> = {}): PlayerProfile => ({
  id: 'profile-1',
  name: 'Nobara',
  avatar: 'avatar-data',
  password: 'local-secret',
  createdAt: 10,
  ...overrides,
});

describe('profile sync privacy', () => {
  it('publishes display fields but never the local profile password', () => {
    const synced = projectProfilesForSync([profile()]);

    expect(synced).toEqual([{ id: 'profile-1', name: 'Nobara', avatar: 'avatar-data', createdAt: 10 }]);
    expect(JSON.stringify(synced)).not.toContain('local-secret');
    expect(synced[0]).not.toHaveProperty('password');
  });

  it('preserves a matching local password and discards password fields from legacy payloads', () => {
    const merged = mergeSyncedProfiles([profile()], [{
      id: 'profile-1', name: 'Nobara updated', avatar: null, createdAt: 12, password: 'stolen-secret',
    }]);

    expect(merged).toEqual([{
      id: 'profile-1', name: 'Nobara updated', avatar: null, createdAt: 12, password: 'local-secret',
    }]);
  });

  it('does not import a remote password for a profile absent locally', () => {
    const merged = mergeSyncedProfiles([], [{
      id: 'profile-2', name: 'Yuji', avatar: null, createdAt: 20, password: 'remote-secret',
    }]);

    expect(merged).toEqual([{ id: 'profile-2', name: 'Yuji', avatar: null, createdAt: 20, password: null }]);
  });
});
