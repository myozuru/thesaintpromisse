import { estadoRemotoEmAplicacao } from "./estadoRemoto";
export type RegistroSync = { _syncAt?: number };
export interface DicionarioSync<T> {
  records: Record<string, T>;
  deleted: Record<string, number>;
}
const objeto = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const idValido = (id: string) =>
  !!id && !["__proto__", "constructor", "prototype"].includes(id);
const stamp = (x: unknown) => {
  if (!objeto(x)) return 0;
  for (const k of ["_syncAt", "atualizadoEm", "iniciadoEm"])
    if (
      typeof x[k] === "number" &&
      Number.isFinite(x[k]) &&
      (x[k] as number) >= 0
    )
      return x[k] as number;
  return 0;
};
const serial = (x: unknown) =>
  JSON.stringify(x, (_k, v) =>
    objeto(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
/** Ausência não é exclusão. Tombstones viajam com o snapshot, inclusive após recarregar. */
export function mergeDicionario<T extends RegistroSync>(
  local: DicionarioSync<T>,
  incoming: unknown,
  validar: (x: unknown, id: string) => x is T,
): DicionarioSync<T> {
  if (!objeto(incoming)) return local;
  const envelope = incoming.formato === "omni-sync.v1";
  const remote = envelope ? incoming.records : incoming;
  if (!objeto(remote)) return local;
  const deleted = { ...local.deleted },
    records = { ...local.records };
  if (envelope && objeto(incoming.deleted))
    for (const [id, at] of Object.entries(incoming.deleted))
      if (
        idValido(id) &&
        typeof at === "number" &&
        Number.isFinite(at) &&
        at >= 0
      )
        deleted[id] = Math.max(deleted[id] ?? 0, at);
  for (const [id, r] of Object.entries(remote)) {
    if (
      !idValido(id) ||
      !validar(r, id) ||
      !objeto(r) ||
      (r._syncAt !== undefined &&
        (typeof r._syncAt !== "number" ||
          !Number.isFinite(r._syncAt) ||
          r._syncAt < 0))
    )
      continue;
    const l = records[id];
    if (
      !l ||
      stamp(r) > stamp(l) ||
      (stamp(r) === stamp(l) && serial(r) > serial(l))
    )
      records[id] = r;
  }
  for (const [id, at] of Object.entries(deleted))
    if (records[id] && stamp(records[id]) <= at) delete records[id];
  return { records, deleted };
}
export const pacoteDicionario = <T>(
  records: Record<string, T>,
  deleted: Record<string, number>,
) => ({ formato: "omni-sync.v1", records, deleted });
/** Assinado antes dos subscribers de transporte. Não redata aplicação remota. */
export function carimbarDicionario<T extends RegistroSync>(
  next: DicionarioSync<T>,
  prev: DicionarioSync<T>,
): DicionarioSync<T> {
  if (estadoRemotoEmAplicacao()) return next;
  const records = { ...next.records },
    deleted = { ...next.deleted };
  let mudou = false;
  for (const [id, r] of Object.entries(records))
    if (r !== prev.records[id] && r._syncAt === prev.records[id]?._syncAt) {
      records[id] = {
        ...r,
        _syncAt: Math.max(
          Date.now(),
          stamp(r) + 1,
          stamp(prev.records[id]) + 1,
          (deleted[id] ?? 0) + 1,
        ),
      };
      mudou = true;
    }
  for (const [id, r] of Object.entries(prev.records))
    if (!records[id] && deleted[id] === prev.deleted[id]) {
      deleted[id] = Math.max(Date.now(), stamp(r) + 1, (deleted[id] ?? 0) + 1);
      mudou = true;
    }
  return mudou ? { records, deleted } : next;
}
