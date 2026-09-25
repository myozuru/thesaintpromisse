/**
 * assetCache — Etapa 4.
 *
 * Cache em memória de HTMLImageElement por assetId. Mantém o object URL
 * vivo enquanto o asset estiver em uso e chama URL.revokeObjectURL ao
 * descarregar — evita memory leak.
 *
 * Render flow:
 *   1) hidrate(allIds) carrega do IndexedDB tudo de uma vez.
 *   2) drawEntity consulta get(assetId) para obter a Image pronta.
 *   3) Ao deletar entidade que detinha o único uso → release(assetId).
 */
import { assetDB } from './assetDB';

interface CacheEntry {
  url: string;
  img: HTMLImageElement;
  ready: boolean;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry | null>>();

function makeEntry(blob: Blob): CacheEntry {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  const entry: CacheEntry = { url, img, ready: false };
  img.onload = () => { entry.ready = true; };
  img.onerror = () => { entry.ready = false; };
  img.src = url;
  return entry;
}

export const assetCache = {
  /** Recupera (sync) entrada já carregada, ou null. */
  get(id: string): CacheEntry | null {
    return cache.get(id) ?? null;
  },
  /** Carrega do IDB se ainda não estiver em cache. */
  async load(id: string): Promise<CacheEntry | null> {
    const existing = cache.get(id);
    if (existing) return existing;
    const pending = inflight.get(id);
    if (pending) return pending;
    const p = (async () => {
      const rec = await assetDB.get(id);
      if (!rec) return null;
      const entry = makeEntry(rec.blob);
      cache.set(id, entry);
      inflight.delete(id);
      return entry;
    })();
    inflight.set(id, p);
    return p;
  },
  /** Insere um blob novo no IDB + cache, retorna o id. */
  async put(blob: Blob, mime?: string): Promise<string> {
    const id = await assetDB.put(blob, mime);
    cache.set(id, makeEntry(blob));
    return id;
  },
  /** Insere/atualiza um blob usando um id já conhecido (sync multiplayer). */
  async putWithId(id: string, blob: Blob, mime?: string): Promise<string> {
    this.release(id);
    await assetDB.putWithId(id, blob, mime);
    cache.set(id, makeEntry(blob));
    return id;
  },
  /** Libera do cache + revoga URL. NÃO apaga do IDB. */
  release(id: string): void {
    const entry = cache.get(id);
    if (!entry) return;
    URL.revokeObjectURL(entry.url);
    cache.delete(id);
  },
  /** Libera tudo (chamado no unmount global). */
  releaseAll(): void {
    for (const e of cache.values()) URL.revokeObjectURL(e.url);
    cache.clear();
  },
  /** Apaga do IDB + libera do cache. */
  async destroy(id: string): Promise<void> {
    this.release(id);
    await assetDB.delete(id);
  },
};
