/** Mescla registros por `updatedAt` (o mais recente vence). */
export function mergeByUpdatedAt<T extends { updatedAt?: number }>(local: Record<string, T>, remote: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = { ...local };
  for (const [k, r] of Object.entries(remote ?? {})) {
    const l = out[k];
    if (!l || (r?.updatedAt ?? 0) >= (l.updatedAt ?? 0)) out[k] = r;
  }
  return out;
}
