/**
 * Carimbos de "última edição" por ficha, para que uma cópia antiga vinda da
 * nuvem (ou de outra tela) nunca sobrescreva uma edição mais nova de vida/PE.
 * O carimbo viaja dentro da ficha como `_syncAt` e fica salvo no navegador.
 */
type WithId = { id: string; _syncAt?: number };

const STORAGE_KEY = 'rpg-char-sync-stamps';
/** Fichas criadas agora e ainda ausentes na cópia remota são mantidas. */
const NEW_LOCAL_GRACE_MS = 15000;

const stamps = new Map<string, number>();
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, number>)) stamps.set(k, v);
  } catch { /* ignore */ }
}
function save() {
  if (saveTimer || typeof localStorage === 'undefined') return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(stamps))); } catch { /* ignore */ }
  }, 200);
}

const stampOf = (c: WithId) => { load(); return Math.max(stamps.get(c.id) ?? 0, c._syncAt ?? 0); };

/** Marca como editadas agora as fichas cujo objeto mudou localmente. */
export function stampLocalChanges<T extends WithId>(prev: T[], next: T[], now = Date.now()): void {
  load();
  const before = new Map(prev.map((c) => [c.id, c]));
  let changed = false;
  for (const c of next) {
    if (before.get(c.id) !== c) { stamps.set(c.id, now); changed = true; }
  }
  if (changed) save();
}

/** Anexa o carimbo atual a cada ficha antes de enviar/salvar. */
export function withStamps<T extends WithId>(chars: T[]): T[] {
  return chars.map((c) => ({ ...c, _syncAt: stampOf(c) }));
}

/** Junta a cópia remota com a local: por ficha, vence a edição mais recente. */
export function mergeIncomingCharacters<T extends WithId>(local: T[], remote: T[], now = Date.now()): T[] {
  load();
  const localById = new Map(local.map((c) => [c.id, c]));
  const remoteIds = new Set<string>();
  const out: T[] = [];
  for (const r of remote) {
    if (!r || typeof r.id !== 'string') continue;
    remoteIds.add(r.id);
    const l = localById.get(r.id);
    const rs = r._syncAt ?? 0;
    if (l && stampOf(l) > rs) { out.push(l); continue; }
    if (rs > (stamps.get(r.id) ?? 0)) stamps.set(r.id, rs);
    out.push(r);
  }
  for (const l of local) {
    if (!remoteIds.has(l.id) && now - (stamps.get(l.id) ?? 0) < NEW_LOCAL_GRACE_MS) out.push(l);
  }
  save();
  return out;
}

/** Para salvar na nuvem: por ficha, fica a cópia com carimbo mais novo.
 *  Fichas só presentes na nuvem são removidas (a lista local define quem existe). */
export function pickNewestPerCharacter<T extends WithId>(mine: T[], cloud: T[]): T[] {
  const cloudById = new Map(cloud.filter((c) => c && typeof c.id === 'string').map((c) => [c.id, c]));
  return mine.map((m) => {
    const cl = cloudById.get(m.id);
    return cl && (cl._syncAt ?? 0) > (m._syncAt ?? 0) ? cl : m;
  });
}

/** Só para testes. */
export function __resetCharSyncStamps() { stamps.clear(); loaded = true; }
