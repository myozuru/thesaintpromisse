/**
 * assetDB — Etapa 4.
 *
 * Wrapper minimalista sobre IndexedDB para armazenar Blobs de assets
 * (imagens) localmente, sem nuvem. Cada asset tem um id (uuid) e um
 * mime-type. O store de entidades só guarda o assetId — o Blob fica aqui.
 */
const DB_NAME = 'vtt-assets';
const DB_VERSION = 1;
const STORE = 'assets';

export interface StoredAsset {
  id: string;
  blob: Blob;
  mime: string;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const s = t.objectStore(STORE);
        const r = fn(s);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }),
  );
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const assetDB = {
  async put(blob: Blob, mime?: string): Promise<string> {
    const id = uid();
    const record: StoredAsset = { id, blob, mime: mime ?? blob.type, createdAt: Date.now() };
    await tx('readwrite', (s) => s.put(record));
    return id;
  },
  async putWithId(id: string, blob: Blob, mime?: string): Promise<string> {
    const record: StoredAsset = { id, blob, mime: mime ?? blob.type, createdAt: Date.now() };
    await tx('readwrite', (s) => s.put(record));
    return id;
  },
  async get(id: string): Promise<StoredAsset | undefined> {
    return tx<StoredAsset | undefined>('readonly', (s) => s.get(id) as IDBRequest<StoredAsset | undefined>);
  },
  async delete(id: string): Promise<void> {
    await tx('readwrite', (s) => s.delete(id));
  },
  async allIds(): Promise<string[]> {
    return tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).then((ks) => ks.map(String));
  },
  async clear(): Promise<void> {
    await tx('readwrite', (s) => s.clear());
  },
};
