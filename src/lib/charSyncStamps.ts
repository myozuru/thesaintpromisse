/**
 * Carimbos de sincronização das fichas. O carimbo de ficha é mantido para
 * compatibilidade; `_syncFields` guarda versões por caminho para que uma
 * alteração em Vida não apague, por exemplo, uma alteração concorrente em PE.
 */
type WithId = { id: string; _syncAt?: number; _syncFields?: Record<string, number> };
type JsonRecord = Record<string, unknown>;
type FieldValues = Map<string, unknown>;

const STORAGE_KEY = 'rpg-char-sync-stamps';
const FIELD_STORAGE_KEY = 'rpg-char-sync-field-stamps';
/** Fichas criadas agora e ainda ausentes na cópia remota são mantidas. */
const NEW_LOCAL_GRACE_MS = 15000;
const META_FIELDS = new Set(['id', '_syncAt', '_syncFields']);
const COUNTER_SOURCE_SEPARATOR = '__fonte__';

const stamps = new Map<string, number>();
const fieldStamps = new Map<string, Record<string, number>>();
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, number>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) stamps.set(k, v);
    }
    const fieldsRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(FIELD_STORAGE_KEY) : null;
    if (fieldsRaw) {
      const parsed = JSON.parse(fieldsRaw) as Record<string, unknown>;
      for (const [id, value] of Object.entries(parsed)) fieldStamps.set(id, cleanFieldStamps(value));
    }
  } catch { /* ignore */ }
}

function save() {
  if (saveTimer || typeof localStorage === 'undefined') return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(stamps)));
      localStorage.setItem(FIELD_STORAGE_KEY, JSON.stringify(Object.fromEntries(fieldStamps)));
    } catch { /* ignore */ }
  }, 200);
}

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null ? value as JsonRecord : null;
};

const pathKey = (path: string[]) => JSON.stringify(path);

function parsePath(key: string): string[] | null {
  try {
    const path: unknown = JSON.parse(key);
    return Array.isArray(path) && path.length > 0 && path.every((part) => typeof part === 'string') ? path : null;
  } catch { return null; }
}

function collectValue(value: unknown, path: string[], out: FieldValues) {
  const record = asRecord(value);
  if (!record || Object.keys(record).length === 0) {
    if (path.length) out.set(pathKey(path), value);
    return;
  }
  for (const key of Object.keys(record)) collectValue(record[key], [...path, key], out);
}

function valuesOf(character: WithId): FieldValues {
  const out: FieldValues = new Map();
  const record = character as unknown as JsonRecord;
  for (const key of Object.keys(record)) {
    if (META_FIELDS.has(key) || record[key] === undefined) continue;
    collectValue(record[key], [key], out);
  }
  return out;
}

function stableSerialize(value: unknown): string {
  const record = asRecord(value);
  if (record) {
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
  }
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  const serialized = JSON.stringify(value);
  return serialized === undefined ? 'undefined' : serialized;
}

function sameValue(aExists: boolean, a: unknown, bExists: boolean, b: unknown): boolean {
  return aExists === bExists && (!aExists || stableSerialize(a) === stableSerialize(b));
}

function cleanFieldStamps(raw: unknown): Record<string, number> {
  const record = asRecord(raw);
  if (!record) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(record)) {
    if (parsePath(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0) out[key] = value;
  }
  return out;
}

function combineFieldStamps(...sources: Array<Record<string, number> | undefined>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source ?? {})) out[key] = Math.max(out[key] ?? 0, value);
  }
  return out;
}

function maxPathStamp(versions: Record<string, number>, path: string[], fallback = 0): number {
  let result = fallback;
  for (let i = 1; i <= path.length; i += 1) result = Math.max(result, versions[pathKey(path.slice(0, i))] ?? 0);
  return result;
}

function hasPathStamp(versions: Record<string, number>, path: string[]): boolean {
  for (let i = 1; i <= path.length; i += 1) {
    if (Object.prototype.hasOwnProperty.call(versions, pathKey(path.slice(0, i)))) return true;
  }
  return false;
}

function stampOf(character: WithId): number {
  load();
  return Math.max(stamps.get(character.id) ?? 0, character._syncAt ?? 0);
}

function initialFieldStamps(character: WithId, local: boolean): Record<string, number> {
  const embedded = cleanFieldStamps(character._syncFields);
  const memory = local ? fieldStamps.get(character.id) : undefined;
  const versions = combineFieldStamps(embedded, memory);
  const fallback = local ? stampOf(character) : character._syncAt ?? 0;
  for (const key of valuesOf(character).keys()) versions[key] ??= fallback;
  return versions;
}

function withMetadata<T extends WithId>(character: T, local: boolean): T {
  const versions = initialFieldStamps(character, local);
  const latest = Math.max(local ? stampOf(character) : character._syncAt ?? 0, ...Object.values(versions), 0);
  if (local) {
    stamps.set(character.id, Math.max(stamps.get(character.id) ?? 0, latest));
    fieldStamps.set(character.id, versions);
    save();
  }
  return { ...character, _syncAt: latest, _syncFields: versions };
}

function hasOwn(object: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function readPath(object: unknown, path: string[]): { exists: boolean; value?: unknown } {
  let current: unknown = object;
  for (const segment of path) {
    const record = asRecord(current);
    if (!record || !hasOwn(record, segment)) return { exists: false };
    current = record[segment];
  }
  return current === undefined ? { exists: false } : { exists: true, value: current };
}

function defineOwn(record: JsonRecord, key: string, value: unknown) {
  Object.defineProperty(record, key, { value, enumerable: true, configurable: true, writable: true });
}

function writePath(target: JsonRecord, path: string[], value: unknown) {
  let current = target;
  for (let i = 0; i < path.length - 1; i += 1) {
    const segment = path[i];
    let next = current[segment];
    if (!asRecord(next)) {
      next = {};
      defineOwn(current, segment, next);
    }
    current = next as JsonRecord;
  }
  defineOwn(current, path[path.length - 1], value);
}

function deletePath(target: JsonRecord, path: string[]) {
  let current: JsonRecord = target;
  const parents: Array<{ parent: JsonRecord; key: string; child: JsonRecord }> = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    const child = asRecord(current[key]);
    if (!child) return;
    parents.push({ parent: current, key, child });
    current = child;
  }
  delete current[path[path.length - 1]];
  for (let i = parents.length - 1; i >= 0; i -= 1) {
    const { parent, key, child } = parents[i];
    if (Object.keys(child).length) break;
    delete parent[key];
  }
}

/**
 * Para contadores com contribuição por fonte, o total é derivado das parcelas.
 * Mesclar o campo total por LWW perderia uma carga se dois aliados contribuíssem
 * ao mesmo tempo em clientes diferentes, mesmo que cada parcela tivesse chave própria.
 */
function reconcileCounterTotals(character: JsonRecord, versions: Record<string, number>) {
  const counters = asRecord(character.omniCounters);
  if (!counters) return;

  const names = new Set<string>();
  for (const key of Object.keys(counters)) {
    const separatorAt = key.indexOf(COUNTER_SOURCE_SEPARATOR);
    if (separatorAt > 0) names.add(key.slice(0, separatorAt));
  }

  for (const name of names) {
    const prefix = `${name}${COUNTER_SOURCE_SEPARATOR}`;
    let total = 0;
    let version = versions[pathKey(['omniCounters', name])] ?? 0;
    for (const [key, value] of Object.entries(counters)) {
      if (!key.startsWith(prefix) || typeof value !== 'number' || !Number.isFinite(value)) continue;
      total += value;
      version = Math.max(version, versions[pathKey(['omniCounters', key])] ?? 0);
    }
    defineOwn(counters, name, total);
    versions[pathKey(['omniCounters', name])] = version;
  }
}

function mergeCharacter<T extends WithId>(localInput: T, remoteInput: T, localIsMine: boolean): T {
  const local = withMetadata(localInput, localIsMine);
  const remote = withMetadata(remoteInput, false);
  const localValues = valuesOf(local);
  const remoteValues = valuesOf(remote);
  const localVersions = cleanFieldStamps(local._syncFields);
  const remoteVersions = cleanFieldStamps(remote._syncFields);
  const keys = new Set([
    ...localValues.keys(), ...remoteValues.keys(),
    ...Object.keys(localVersions), ...Object.keys(remoteVersions),
  ]);
  const winners: Array<{ key: string; path: string[]; exists: boolean; value?: unknown; version: number }> = [];
  const mergedVersions: Record<string, number> = {};

  for (const key of keys) {
    const path = parsePath(key);
    if (!path) continue;
    const lv = readPath(local, path);
    const rv = readPath(remote, path);
    const ls = maxPathStamp(localVersions, path);
    const rs = maxPathStamp(remoteVersions, path);
    const localKnowsPath = lv.exists || hasPathStamp(localVersions, path);
    const remoteKnowsPath = rv.exists || hasPathStamp(remoteVersions, path);
    const localOnlyValue = lv.exists && !rv.exists && !remoteKnowsPath;
    const remoteOnlyValue = rv.exists && !lv.exists && !localKnowsPath;
    const localTieKey = `${lv.exists ? '1' : '0'}:${lv.exists ? stableSerialize(lv.value) : ''}`;
    const remoteTieKey = `${rv.exists ? '1' : '0'}:${rv.exists ? stableSerialize(rv.value) : ''}`;
    const chooseLocal = ls > rs || (ls === rs && localTieKey >= remoteTieKey);
    const chosen = localOnlyValue ? lv : remoteOnlyValue ? rv : chooseLocal ? lv : rv;
    const version = Math.max(ls, rs);
    mergedVersions[key] = version;
    winners.push({ key, path, exists: chosen.exists, value: chosen.value, version });
  }

  const merged: JsonRecord = { id: local.id };
  winners.sort((a, b) => a.path.length - b.path.length || a.key.localeCompare(b.key));
  for (const winner of winners) {
    if (winner.exists) writePath(merged, winner.path, winner.value);
    else deletePath(merged, winner.path);
  }

  reconcileCounterTotals(merged, mergedVersions);

  const syncAt = Math.max(local._syncAt ?? 0, remote._syncAt ?? 0, ...Object.values(mergedVersions), 0);
  (merged as WithId)._syncAt = syncAt;
  (merged as WithId)._syncFields = mergedVersions;
  stamps.set(local.id, Math.max(stamps.get(local.id) ?? 0, syncAt));
  fieldStamps.set(local.id, mergedVersions);
  return merged as T;
}

/** Marca os caminhos realmente alterados, preservando os carimbos dos demais. */
export function stampLocalChanges<T extends WithId>(prev: T[], next: T[], now = Date.now()): void {
  load();
  const before = new Map(prev.map((character) => [character.id, character]));
  let changed = false;
  for (const character of next) {
    const previous = before.get(character.id);
    if (previous === character) continue;

    const previousValues = previous ? valuesOf(previous) : new Map<string, unknown>();
    const nextValues = valuesOf(character);
    const keys = new Set([...previousValues.keys(), ...nextValues.keys()]);
    const versions = previous
      ? initialFieldStamps(previous, true)
      : cleanFieldStamps(character._syncFields);
    const baseStamp = Math.max(stampOf(previous ?? character), ...Object.values(versions), 0);
    const changedAt = Math.max(now, baseStamp + 1);

    for (const key of keys) {
      const oldExists = previousValues.has(key);
      const newExists = nextValues.has(key);
      if (sameValue(oldExists, previousValues.get(key), newExists, nextValues.get(key))) continue;
      versions[key] = changedAt;
      changed = true;
    }

    const syncAt = Math.max(changedAt, stampOf(character));
    stamps.set(character.id, Math.max(stamps.get(character.id) ?? 0, syncAt));
    fieldStamps.set(character.id, versions);
  }
  if (changed) save();
}

/** Anexa carimbos de ficha e de caminho antes de enviar/salvar. */
export function withStamps<T extends WithId>(characters: T[]): T[] {
  return characters.map((character) => withMetadata(character, true));
}

/** Mescla cada caminho por versão; versões iguais resolvem empate de forma determinística. */
export function mergeIncomingCharacters<T extends WithId>(local: T[], remote: T[], now = Date.now()): T[] {
  load();
  const localById = new Map(local.map((character) => [character.id, character]));
  const remoteIds = new Set<string>();
  const out: T[] = [];

  for (const remoteCharacter of remote) {
    if (!remoteCharacter || typeof remoteCharacter.id !== 'string') continue;
    remoteIds.add(remoteCharacter.id);
    const localCharacter = localById.get(remoteCharacter.id);
    out.push(localCharacter ? mergeCharacter(localCharacter, remoteCharacter, true) : withMetadata(remoteCharacter, false));
  }
  for (const localCharacter of local) {
    if (!remoteIds.has(localCharacter.id) && now - (stamps.get(localCharacter.id) ?? 0) < NEW_LOCAL_GRACE_MS) {
      out.push(withMetadata(localCharacter, true));
    }
  }
  save();
  return out;
}

/** Ids excluídos de propósito nesta tela (a única forma de uma ficha sair da nuvem). */
const DELETED_KEY = 'rpg-char-deleted-ids';
function loadDeleted(): Set<string> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DELETED_KEY) : null;
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}
export function markCharacterDeleted(id: string) {
  const set = loadDeleted(); set.add(id);
  try { localStorage.setItem(DELETED_KEY, JSON.stringify([...set].slice(-500))); } catch { /* ignore */ }
}

/** Une também os campos não sobrepostos ao salvar uma ficha na nuvem. */
export function pickNewestPerCharacter<T extends WithId>(mine: T[], cloud: T[], deleted: Set<string> = loadDeleted()): T[] {
  const cloudById = new Map(cloud.filter((character) => character && typeof character.id === 'string').map((character) => [character.id, character]));
  const mineIds = new Set(mine.map((character) => character.id));
  const out = mine.map((character) => {
    const cloudCharacter = cloudById.get(character.id);
    return cloudCharacter ? mergeCharacter(character, cloudCharacter, true) : withMetadata(character, true);
  });
  for (const character of cloudById.values()) {
    if (!mineIds.has(character.id) && !deleted.has(character.id)) out.push(withMetadata(character, false));
  }
  return out;
}

/** Só para testes. */
export function __resetCharSyncStamps() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  stamps.clear();
  fieldStamps.clear();
  loaded = true;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(FIELD_STORAGE_KEY);
  } catch { /* ignore */ }
}
