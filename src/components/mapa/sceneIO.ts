/**
 * sceneIO — Fase 10.
 *
 * Empacota cenas (SceneDoc) + os blobs de assets que elas referenciam
 * em um único JSON portátil. Permite exportar e importar cenas inteiras
 * (com backgrounds e tokens com imagem) entre sessões/usuários.
 *
 * Formato (versão 1):
 *   {
 *     version: 1,
 *     exportedAt: ISO,
 *     scenes: SceneDoc[],
 *     assets: { [assetId]: { mime, dataB64 } }
 *   }
 */
import type { SceneDoc } from '@/stores/useMapStore';
import { assetDB } from './assetDB';
import { assetCache } from './assetCache';

export interface SceneBundleV1 {
  version: 1;
  exportedAt: string;
  scenes: SceneDoc[];
  assets: Record<string, { mime: string; dataB64: string }>;
}

export interface FullBackupV2 {
  version: 2;
  kind: 'full-app-backup';
  exportedAt: string;
  localStorage: Record<string, string>;
  map: SceneBundleV1;
}

const FULL_BACKUP_KEYS = [
  'rpg-characters', 'rpg-combat', 'rpg-logs', 'rpg-profiles', 'rpg-money', 'rpg-items',
  'rpg-calendar', 'rpg-spell-proposals', 'rpg-passive-proposals', 'rpg-omni-proposals',
  'rpg-test-requests', 'vtt-map-v1', 'vtt-dice-v1', 'fog-store-v2', 'rpg-role',
  'rpg-tab-order', 'spell-library-v1', 'passive-library-v1', 'omni-shops', 'omni-inventory',
  'omni-engine-entidades', 'omni-runtime-efeitos', 'omni-spatial', 'menu-store', 'rpg-discounts',
];

function blobToB64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const r = fr.result as string;
      // result é "data:<mime>;base64,XXXX" → mantemos só a parte base64
      const i = r.indexOf(',');
      resolve(i >= 0 ? r.slice(i + 1) : r);
    };
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

function b64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime || 'application/octet-stream' });
}

/** Coleta todos os assetIds referenciados por uma lista de cenas. */
function collectAssetIds(scenes: SceneDoc[]): string[] {
  const ids = new Set<string>();
  for (const sc of scenes) {
    if (sc.background?.assetId) ids.add(sc.background.assetId);
    for (const e of Object.values(sc.entities)) {
      if (e.assetId) ids.add(e.assetId);
    }
  }
  return [...ids];
}

export async function buildBundle(scenes: SceneDoc[]): Promise<SceneBundleV1> {
  const assetIds = collectAssetIds(scenes);
  const assets: SceneBundleV1['assets'] = {};
  await Promise.all(
    assetIds.map(async (id) => {
      const rec = await assetDB.get(id);
      if (!rec) return;
      assets[id] = { mime: rec.mime, dataB64: await blobToB64(rec.blob) };
    }),
  );
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    scenes: JSON.parse(JSON.stringify(scenes)),
    assets,
  };
}

export async function buildFullBackup(scenes: SceneDoc[]): Promise<FullBackupV2> {
  const map = await buildBundle(scenes);
  const allAssetIds = await assetDB.allIds();
  await Promise.all(allAssetIds.map(async (id) => {
    if (map.assets[id]) return;
    const rec = await assetDB.get(id);
    if (rec) map.assets[id] = { mime: rec.mime, dataB64: await blobToB64(rec.blob) };
  }));
  const localStorageDump: Record<string, string> = {};
  for (const key of FULL_BACKUP_KEYS) {
    const value = localStorage.getItem(key);
    if (value != null) localStorageDump[key] = value;
  }
  return { version: 2, kind: 'full-app-backup', exportedAt: new Date().toISOString(), localStorage: localStorageDump, map };
}

export function downloadBundle(bundle: SceneBundleV1, filename: string) {
  const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadFullBackup(backup: FullBackupV2, filename: string) {
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function restoreFullBackup(backup: FullBackupV2): Promise<void> {
  if (!backup || backup.version !== 2 || backup.kind !== 'full-app-backup') throw new Error('Backup completo inválido.');
  for (const [id, rec] of Object.entries(backup.map.assets ?? {})) {
    await assetCache.putWithId(id, b64ToBlob(rec.dataB64, rec.mime), rec.mime);
  }
  for (const [key, value] of Object.entries(backup.localStorage ?? {})) localStorage.setItem(key, value);
}

/**
 * Importa um bundle: grava os assets no IDB (gerando novos ids quando
 * já existirem) e devolve cenas com referências remapeadas + novos ids
 * (cena + entidades) para evitar colisão com cenas atuais.
 */
export async function importBundle(
  bundle: SceneBundleV1,
  existingSceneIds: Set<string>,
  existingSceneNames: Set<string>,
): Promise<{ scenes: SceneDoc[] }> {
  if (!bundle || bundle.version !== 1 || !Array.isArray(bundle.scenes)) {
    throw new Error('Formato de bundle inválido.');
  }
  const uid = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);

  // Reinsere todos os assets sob novos ids — assim nunca colidimos
  // com assets de outras sessões nem corrompemos referências locais.
  const assetMap = new Map<string, string>();
  for (const [oldId, rec] of Object.entries(bundle.assets ?? {})) {
    try {
      const blob = b64ToBlob(rec.dataB64, rec.mime);
      const newId = await assetCache.put(blob, rec.mime);
      assetMap.set(oldId, newId);
    } catch {
      /* ignora asset corrompido */
    }
  }

  const outScenes: SceneDoc[] = [];
  for (const sc of bundle.scenes) {
    const idMap: Record<string, string> = {};
    const newEnts: Record<string, typeof sc.entities[string]> = {};
    for (const eid of Object.keys(sc.entities)) {
      const ne = uid();
      idMap[eid] = ne;
      const e = sc.entities[eid];
      newEnts[ne] = {
        ...e,
        id: ne,
        assetId: e.assetId ? assetMap.get(e.assetId) : undefined,
      };
    }
    let sceneId = sc.id;
    if (!sceneId || existingSceneIds.has(sceneId)) sceneId = uid();
    existingSceneIds.add(sceneId);
    let name = sc.name || 'Cena importada';
    if (existingSceneNames.has(name)) {
      let i = 2;
      while (existingSceneNames.has(`${name} (${i})`)) i++;
      name = `${name} (${i})`;
    }
    existingSceneNames.add(name);

    outScenes.push({
      ...sc,
      id: sceneId,
      name,
      entities: newEnts,
      entityOrder: sc.entityOrder.map((x) => idMap[x]).filter(Boolean),
      background: sc.background
        ? { ...sc.background, assetId: assetMap.get(sc.background.assetId) ?? sc.background.assetId }
        : null,
      initiative: sc.initiative
        ? {
            ...sc.initiative,
            entries: sc.initiative.entries.map((e) => ({
              ...e,
              entityId: e.entityId ? idMap[e.entityId] : undefined,
            })),
          }
        : { entries: [], turnIndex: 0, round: 1 },
      templates: (sc.templates ?? []).map((t) => ({ ...t, id: uid() })),
      rulers: (sc.rulers ?? []).map((r) => ({ ...r, id: uid(), a: { ...r.a }, b: { ...r.b } })),
    });
  }

  return { scenes: outScenes };
}
