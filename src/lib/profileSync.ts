import type { PlayerProfile } from '@/stores/useProfileStore';

export type SyncedPlayerProfile = Pick<PlayerProfile, 'id' | 'name' | 'avatar' | 'createdAt'>;

/** Dados de perfil compartilháveis. Senhas nunca deixam o navegador de origem. */
export function projectProfilesForSync(profiles: readonly PlayerProfile[]): SyncedPlayerProfile[] {
  return profiles.map(({ id, name, avatar, createdAt }) => ({ id, name, avatar, createdAt }));
}

/**
 * Recebe perfis da mesa sem confiar em campos adicionais do payload remoto.
 * Senhas locais existentes são preservadas; senhas enviadas por versões
 * antigas são descartadas e não são copiadas para o armazenamento local.
 */
export function mergeSyncedProfiles(
  localProfiles: readonly PlayerProfile[],
  remote: unknown,
): PlayerProfile[] {
  if (!Array.isArray(remote)) return [...localProfiles];

  const localById = new Map(localProfiles.map((profile) => [profile.id, profile]));
  const merged = new Map<string, PlayerProfile>();

  for (const value of remote) {
    if (!value || typeof value !== 'object') continue;
    const profile = value as Partial<SyncedPlayerProfile>;
    if (typeof profile.id !== 'string' || typeof profile.name !== 'string') continue;

    const local = localById.get(profile.id);
    merged.set(profile.id, {
      id: profile.id,
      name: profile.name,
      avatar: typeof profile.avatar === 'string' ? profile.avatar : null,
      createdAt: typeof profile.createdAt === 'number' ? profile.createdAt : local?.createdAt ?? 0,
      password: local?.password ?? null,
    });
  }

  return [...merged.values()];
}
