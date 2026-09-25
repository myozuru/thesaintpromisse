type MapSyncGuardWindow = Window & {
  __mapTransientUntil?: number;
  __mapIgnoreRemoteMapSceneUntil?: number;
  __mapProtectedEntityUntilById?: Map<string, number>;
};

export function holdLocalMapSync(durationMs = 800, entityIds: string[] = []) {
  if (typeof window === 'undefined') return;
  const now = performance.now();
  const until = now + durationMs;
  const w = window as MapSyncGuardWindow;

  w.__mapTransientUntil = Math.max(w.__mapTransientUntil ?? 0, until);
  w.__mapIgnoreRemoteMapSceneUntil = Math.max(w.__mapIgnoreRemoteMapSceneUntil ?? 0, until);

  if (!entityIds.length) return;
  const protectedUntilById = w.__mapProtectedEntityUntilById ?? new Map<string, number>();
  for (const id of entityIds) protectedUntilById.set(id, Math.max(protectedUntilById.get(id) ?? 0, until));
  w.__mapProtectedEntityUntilById = protectedUntilById;
}

export function shouldIgnoreRemoteMapScene() {
  if (typeof window === 'undefined') return false;
  return performance.now() < ((window as MapSyncGuardWindow).__mapIgnoreRemoteMapSceneUntil ?? 0);
}

export function getProtectedRemoteEntityPatchIds() {
  if (typeof window === 'undefined') return null;
  const now = performance.now();
  const protectedUntilById = (window as MapSyncGuardWindow).__mapProtectedEntityUntilById;
  if (!protectedUntilById) return null;

  const active = new Set<string>();
  for (const [id, until] of protectedUntilById) {
    if (until > now) active.add(id);
    else protectedUntilById.delete(id);
  }
  return active.size ? active : null;
}