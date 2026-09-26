import { useEffect } from 'react';
import { getSocket, type WorldSlice } from '@/lib/socket';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { useLogStore } from '@/stores/useLogStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useItemStore } from '@/stores/useItemStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useSpellProposalStore } from '@/stores/useSpellProposalStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { useDiscountStore } from '@/stores/useDiscountStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useOmniSpatialStore } from '@/stores/useOmniSpatialStore';
import { useOmniProposalStore } from '@/stores/useOmniProposalStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { useMapStore, type SceneDoc } from '@/stores/useMapStore';
import { assetDB } from '@/components/mapa/assetDB';
import { assetCache } from '@/components/mapa/assetCache';
import { supabase } from '@/integrations/supabase/safeClient';
import { useFogStore } from '@/stores/fogStore';
import { getProtectedRemoteEntityPatchIds, getRecentLocalEntityEdits, markLocalEntityEdits, shouldIgnoreRemoteMapScene } from '@/components/mapa/mapSyncGuards';

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

/**
 * Sincroniza characters / combat / chronos entre todos os clientes
 * conectados ao servidor local (server.js via Socket.IO).
 *
 * - Quando recebe um update do servidor: aplica via setState com a flag
 *   __remote=true para evitar loop de re-emissão.
 * - Quando o estado local muda: emite para o servidor (que faz broadcast).
 *
 * NÃO altera UI — só plumbing de estado.
 */

// Flag global para suprimir emissão durante aplicação remota
let applyingRemote = false;
// Última versão do mapa publicada por este cliente (para suprimir eco).
let lastPublishedMapJSON: string | null = null;


type MapSceneSync = {
  scenes: Record<string, SceneDoc>;
  sceneOrder: string[];
  activeSceneId: string;
  layerVisible: ReturnType<typeof useMapStore.getState>['layerVisible'];
};

function stripSceneCamera(scene: SceneDoc): MapSceneSync['scenes'][string] {
  return { ...scene, camera: { x: 0, y: 0, scale: 1, isPanning: false } };
}

function pickMapScene(): MapSceneSync {
  const s = useMapStore.getState();
  if (!s.sceneOrder.length || !s.activeSceneId) {
    s.ensureScenes();
  }
  const latest = useMapStore.getState();
  const scenes: MapSceneSync['scenes'] = {};
  for (const doc of latest.getAllSceneSnapshots()) scenes[doc.id] = stripSceneCamera(doc);
  return {
    scenes,
    sceneOrder: [...latest.sceneOrder],
    activeSceneId: latest.activeSceneId,
    layerVisible: { ...latest.layerVisible },
  };
}

function collectMapAssetIds(map: MapSceneSync): string[] {
  const ids = new Set<string>();
  for (const scene of Object.values(map.scenes)) {
    for (const entity of Object.values(scene.entities ?? {})) if (entity.assetId) ids.add(entity.assetId);
    if (scene.background?.assetId) ids.add(scene.background.assetId);
  }
  return Array.from(ids);
}

function hasMapContent(map: MapSceneSync): boolean {
  return Object.values(map.scenes).some((scene) =>
    Object.keys(scene.entities ?? {}).length > 0 ||
    (scene.drawings?.length ?? 0) > 0 ||
    (scene.notes?.length ?? 0) > 0 ||
    (scene.walls?.length ?? 0) > 0 ||
    (scene.templates?.length ?? 0) > 0 ||
    !!scene.background,
  );
}

async function emitMapAssets(
  socket: ReturnType<typeof getSocket>,
  assetIds: string[],
  sent: Set<string>,
  force = false,
) {
  for (const id of assetIds) {
    if (!force && sent.has(id)) continue;
    const rec = await assetDB.get(id);
    if (!rec) continue;
    sent.add(id);
    socket?.emit('asset:put', { id, buffer: await rec.blob.arrayBuffer(), mime: rec.mime });
    void publishMapAssetToCloud(id, rec.blob, rec.mime);
  }
}

function blobFromSocketBuffer(buffer: unknown, mime?: string): Blob | null {
  if (buffer instanceof ArrayBuffer) return new Blob([buffer], { type: mime || 'application/octet-stream' });
  if (ArrayBuffer.isView(buffer)) {
    const view = buffer as ArrayBufferView;
    const bytes = new Uint8Array(view.byteLength);
    bytes.set(new Uint8Array(view.buffer as ArrayBuffer, view.byteOffset, view.byteLength));
    return new Blob([bytes.buffer], { type: mime || 'application/octet-stream' });
  }
  if (buffer && typeof buffer === 'object' && 'data' in buffer && Array.isArray((buffer as { data?: unknown }).data)) {
    return new Blob([new Uint8Array((buffer as { data: number[] }).data)], { type: mime || 'application/octet-stream' });
  }
  return null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mime?: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/octet-stream' });
}

async function publishMapSceneToCloud(map: MapSceneSync) {
  rememberPublishedMap(JSON.stringify(map));
  const { error } = await supabase.from('realtime_world').upsert({
    slice: 'mapScene',
    data: JSON.parse(JSON.stringify(map)) as Json,
  });
  if (error) console.warn('[sync] falha ao publicar mapa no Cloud:', error.message);
}

async function publishMapAssetToCloud(id: string, blob: Blob, mime?: string) {
  const data_base64 = await blobToBase64(blob);
  const { error } = await supabase.from('realtime_assets').upsert({
    id,
    mime: mime || blob.type || 'application/octet-stream',
    data_base64,
  });
  if (error) console.warn('[sync] falha ao publicar asset do mapa no Cloud:', error.message);
}

async function fetchMissingMapAssetsFromCloud(ids: string[]) {
  const missing = ids.filter((id) => typeof id === 'string' && !assetCache.get(id));
  if (!missing.length) return;
  const { data, error } = await supabase
    .from('realtime_assets')
    .select('id,mime,data_base64')
    .in('id', missing);
  if (error) {
    console.warn('[sync] falha ao buscar assets do mapa no Cloud:', error.message);
    return;
  }
  await Promise.all((data ?? []).map((row) => assetCache.putWithId(row.id, base64ToBlob(row.data_base64, row.mime), row.mime)));
}

function isMapSceneSync(data: unknown): data is MapSceneSync {
  return !!data && typeof data === 'object' && 'scenes' in data && 'sceneOrder' in data;
}

function sameMapScene(a: MapSceneSync, b: MapSceneSync): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function pickCharacters(s: ReturnType<typeof useCharacterStore.getState>) {
  return s.characters;
}
function pickCombat(s: ReturnType<typeof useCombatStore.getState>) {
  return {
    inCombat: s.inCombat,
    round: s.round,
    currentTurnIndex: s.currentTurnIndex,
    initiativeOrder: s.initiativeOrder,
    movementUsedByChar: s.movementUsedByChar,
    turnTimerEnabled: s.turnTimerEnabled,
    turnDurationSec: s.turnDurationSec,
    turnRemainingAtStart: s.turnRemainingAtStart,
    turnStartedAt: s.turnStartedAt,
    turnPaused: s.turnPaused,
    freeformMode: s.freeformMode,
  };
}
function pickChronos(s: ReturnType<typeof useChronosStore.getState>) {
  return {
    hours: s.hours, minutes: s.minutes, seconds: s.seconds,
    day: s.day, month: s.month, year: s.year,
    multiplier: s.multiplier, isRunning: s.isRunning,
  };
}
function pickLogs(s: ReturnType<typeof useLogStore.getState>) {
  return {
    logs: s.logs,
    playerVisibility: s.playerVisibility,
  };
}
function pickProfiles(s: ReturnType<typeof useProfileStore.getState>) {
  return s.profiles;
}
function pickMoney(s: ReturnType<typeof useMoneyStore.getState>) {
  return {
    currencies: s.currencies,
    wallets: s.wallets,
    invites: s.invites,
    transactions: s.transactions,
  };
}
function pickItems(s: ReturnType<typeof useItemStore.getState>) {
  return s.items;
}
function pickCalendar(s: ReturnType<typeof useCalendarStore.getState>) {
  // Apenas eventos sincronizam — ano/mês selecionados são UI local de cada player.
  return s.events;
}
function pickSpellProposals(s: ReturnType<typeof useSpellProposalStore.getState>) {
  return s.proposals;
}
function pickEstablishments(s: ReturnType<typeof useMenuStore.getState>) {
  return s.establishments;
}
function pickDiscounts(s: ReturnType<typeof useDiscountStore.getState>) {
  return s.discounts;
}
function pickOmniEntidades(s: ReturnType<typeof useOmniEntidadesStore.getState>) {
  return s.entidades;
}
function pickOmniRuntime(s: ReturnType<typeof useOmniRuntimeStore.getState>) {
  return s.efeitos;
}
function pickOmniSpatial(s: ReturnType<typeof useOmniSpatialStore.getState>) {
  return s.posicoes;
}
function pickOmniProposals(s: ReturnType<typeof useOmniProposalStore.getState>) {
  return s.proposals;
}
function pickTestRequests(s: ReturnType<typeof useTestRequestStore.getState>) {
  return s.requests;
}

// ── Suavização de movimento remoto ─────────────────────────────────────────
// Posições recebidas deslizam até o destino em vez de "teleportar".
type RemotePatch = { id: string; patch: Record<string, unknown> };
const smoothTargets = new Map<string, { x: number; y: number }>();
/** Quando cada peça recebeu o último movimento ao vivo (para não ser atropelada por um mapa completo atrasado). */
const remotePatchAt = new Map<string, number>();
let smoothRaf: number | null = null;
let smoothLast = 0;

function applyRemoteEntityUpdate(patches: RemotePatch[]) {
  if (!patches.length) return;
  applyingRemote = true;
  try {
    useMapStore.getState().updateEntities(patches as never);
  } finally {
    setTimeout(() => { applyingRemote = false; }, 0);
  }
}

function smoothStep(now: number) {
  const dt = Math.min(100, now - (smoothLast || now));
  smoothLast = now;
  // ~90% do caminho em ~150ms, casando com o ritmo de envio (~8/s).
  const k = 1 - Math.exp(-dt / 65);
  const entities = useMapStore.getState().entities as Record<string, { x: number; y: number } | undefined>;
  const out: RemotePatch[] = [];
  const protectedIds = getProtectedRemoteEntityPatchIds();
  for (const [id, t] of smoothTargets) {
    if (protectedIds?.has(id)) { smoothTargets.delete(id); continue; }
    const e = entities[id];
    if (!e) { smoothTargets.delete(id); continue; }
    const dx = t.x - e.x, dy = t.y - e.y;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      out.push({ id, patch: { x: t.x, y: t.y } });
      smoothTargets.delete(id);
    } else {
      out.push({ id, patch: { x: e.x + dx * k, y: e.y + dy * k } });
    }
  }
  applyRemoteEntityUpdate(out);
  smoothRaf = smoothTargets.size ? requestAnimationFrame(smoothStep) : null;
  if (!smoothRaf) smoothLast = 0;
}

function applySmoothedEntityPatches(patches: RemotePatch[]) {
  const immediate: RemotePatch[] = [];
  const entities = useMapStore.getState().entities as Record<string, { x: number; y: number } | undefined>;
  const canAnimate = typeof requestAnimationFrame === 'function' && typeof document !== 'undefined' && !document.hidden;
  const nowPatch = performance.now();
  for (const { id, patch } of patches) {
    if ('x' in patch || 'y' in patch) remotePatchAt.set(id, nowPatch);
    const { x, y, ...rest } = patch as { x?: unknown; y?: unknown } & Record<string, unknown>;
    const e = entities[id];
    const hasPos = typeof x === 'number' && typeof y === 'number';
    if (hasPos && e && canAnimate) {
      smoothTargets.set(id, { x: x as number, y: y as number });
      if (Object.keys(rest).length) immediate.push({ id, patch: rest });
    } else {
      smoothTargets.delete(id);
      immediate.push({ id, patch });
    }
  }
  applyRemoteEntityUpdate(immediate);
  if (smoothTargets.size && smoothRaf == null) smoothRaf = requestAnimationFrame(smoothStep);
}

/** Últimos mapas completos que ESTE navegador salvou — o eco vindo do banco é ignorado. */
const recentPublishedMapJSON: string[] = [];
/** Última mudança feita NESTE navegador no mapa (ainda pode não ter sido enviada). */
let localMapChangedAt = -Infinity;
function rememberPublishedMap(json: string) {
  recentPublishedMapJSON.push(json);
  if (recentPublishedMapJSON.length > 6) recentPublishedMapJSON.shift();
}

function applyRemote(slice: WorldSlice, data: unknown) {
  if (data == null) return;
  applyingRemote = true;
  try {
    if (slice === 'characters' && Array.isArray(data)) {
      useCharacterStore.setState({ characters: data as never });
    } else if (slice === 'combat' && typeof data === 'object') {
      useCombatStore.setState(data as never);
    } else if (slice === 'chronos' && typeof data === 'object') {
      useChronosStore.getState().replaceFromRemote(data as never);
    } else if (slice === 'logs' && Array.isArray(data)) {
      useLogStore.setState({ logs: data as never });
    } else if (slice === 'logs' && typeof data === 'object') {
      useLogStore.setState(data as never);
    } else if (slice === 'profiles' && Array.isArray(data)) {
      useProfileStore.setState({ profiles: data as never });
    } else if (slice === 'money' && data && typeof data === 'object') {
      const m = data as { currencies?: unknown; wallets?: unknown; invites?: unknown; transactions?: unknown };
      const patch: Record<string, unknown> = {};
      if (Array.isArray(m.currencies)) patch.currencies = m.currencies;
      if (Array.isArray(m.wallets)) patch.wallets = m.wallets;
      if (Array.isArray(m.invites)) patch.invites = m.invites;
      if (Array.isArray(m.transactions)) patch.transactions = m.transactions;
      if (Object.keys(patch).length > 0) useMoneyStore.setState(patch as never);
    } else if (slice === 'items' && Array.isArray(data)) {
      useItemStore.setState({ items: data as never });
    } else if (slice === 'calendar' && Array.isArray(data)) {
      useCalendarStore.setState({ events: data as never });
    } else if (slice === 'spellProposals' && Array.isArray(data)) {
      useSpellProposalStore.setState({ proposals: data as never });
    } else if (slice === 'establishments' && Array.isArray(data)) {
      useMenuStore.setState({ establishments: data as never });
    } else if (slice === 'discounts' && Array.isArray(data)) {
      useDiscountStore.setState({ discounts: data as never });
    } else if (slice === 'omniEntidades' && data && typeof data === 'object') {
      useOmniEntidadesStore.setState({ entidades: data as never });
    } else if (slice === 'omniRuntime' && data && typeof data === 'object') {
      useOmniRuntimeStore.setState({ efeitos: data as never });
    } else if (slice === 'omniSpatial' && data && typeof data === 'object') {
      useOmniSpatialStore.setState({ posicoes: data as never });
    }
    else if (slice === 'mapScene' && isMapSceneSync(data)) {
      const incomingJSON = JSON.stringify(data);
      // Eco do nosso próprio publish — ignorar para não atropelar drag local.
      if (incomingJSON === lastPublishedMapJSON || recentPublishedMapJSON.includes(incomingJSON)) return;
      if (shouldIgnoreRemoteMapScene()) return;
      const current = useMapStore.getState();
      const nextActiveId = data.activeSceneId || data.sceneOrder[0] || current.activeSceneId;
      const nextActive = nextActiveId ? data.scenes[nextActiveId] : undefined;
      // Junta em vez de substituir: peças mexidas aqui há pouco mantêm a posição
      // local; peças deslizando recebem o novo destino em vez de pular.
      const mergedEntities: Record<string, any> = { ...(nextActive?.entities ?? {}) };
      if (nextActiveId === current.activeSceneId) {
        const recent = getRecentLocalEntityEdits();
        const localFresh = performance.now() - localMapChangedAt < 1500;
        const localEnts = current.entities as Record<string, any>;
        for (const id of Object.keys(mergedEntities)) {
          const local = localEnts[id];
          if (!local) continue;
          const inc = mergedEntities[id];
          const livePatchAge = performance.now() - (remotePatchAt.get(id) ?? -Infinity);
          if (recent.has(id) || livePatchAge < 1500 || localFresh) {
            mergedEntities[id] = { ...inc, x: local.x, y: local.y };
          } else if (smoothTargets.has(id) && typeof inc.x === 'number' && typeof inc.y === 'number') {
            smoothTargets.set(id, { x: inc.x, y: inc.y });
            mergedEntities[id] = { ...inc, x: local.x, y: local.y };
          }
        }
      }
      useMapStore.setState({
        scenes: data.scenes as never,
        sceneOrder: [...data.sceneOrder],
        activeSceneId: nextActiveId,
        layerVisible: { ...current.layerVisible, ...data.layerVisible },
        entities: mergedEntities,
        entityOrder: [...(nextActive?.entityOrder ?? [])],
        drawings: [...(nextActive?.drawings ?? [])],
        notes: [...(nextActive?.notes ?? [])],
        gridConfig: nextActive?.gridConfig ? { ...nextActive.gridConfig } : current.gridConfig,
        background: nextActive?.background ?? null,
        initiative: nextActive?.initiative ?? { entries: [], turnIndex: 0, round: 1 },
        templates: nextActive?.templates ? nextActive.templates.map((t) => ({ ...t })) : [],
        rulers: nextActive?.rulers ? nextActive.rulers.map((r) => ({ ...r })) : [],
        lighting: nextActive?.lighting ? { ...nextActive.lighting } : current.lighting,
        walls: (nextActive?.walls ?? []).map((wall) => ({ ...wall, p1: { ...wall.p1 }, p2: { ...wall.p2 } })),
        vision: nextActive?.vision ? { ...nextActive.vision } : current.vision,
        // Preservar seleção e histórico locais — alterar isso quebra drags em andamento.
        selectedIds: current.selectedIds,
        _undo: current._undo,
        _redo: current._redo,
      } as never);
      void Promise.all(collectMapAssetIds(data).map((id) => assetCache.load(id))).then((entries) => {
        const missing = collectMapAssetIds(data).filter((_, index) => !entries[index]);
        if (missing.length) {
          getSocket()?.emit('asset:request', { ids: missing });
          void fetchMissingMapAssetsFromCloud(missing);
        }
      });
    }

    else if (slice === 'omniProposals' && Array.isArray(data)) {
      useOmniProposalStore.setState({ proposals: data as never });
    }
    else if (slice === 'testRequests' && Array.isArray(data)) {
      useTestRequestStore.setState({ requests: data as never });
    }
    else if (slice === 'fog' && data && typeof data === 'object') {
      const d = data as { walls?: unknown; doors?: unknown; lights?: unknown };
      const patch: Record<string, unknown> = {};
      if (Array.isArray(d.walls)) patch.walls = d.walls;
      if (Array.isArray(d.doors)) patch.doors = d.doors;
      if (Array.isArray(d.lights)) patch.lights = d.lights;
      if (Object.keys(patch).length > 0) useFogStore.setState(patch as never);
    }
  } finally {
    // libera no próximo tick para garantir que o subscribe não dispare emit
    setTimeout(() => { applyingRemote = false; }, 0);
  }
}


// Cloud sync LIGADO por padrão — o site publicado não tem server.js,
// então o multiplayer depende do Supabase Realtime. Para desativar
// explicitamente (ex.: rodando 100% local com server.js), defina
// VITE_ENABLE_CLOUD_SYNC=false no .env.local.
const CLOUD_SYNC_DISABLED =
  String(import.meta.env.VITE_ENABLE_CLOUD_SYNC ?? 'true').toLowerCase() === 'false';

export function useMultiplayerSync() {
  useEffect(() => {
    if (CLOUD_SYNC_DISABLED) {
      console.warn('[sync] VITE_ENABLE_CLOUD_SYNC=false — multiplayer/cloud sync desativado neste cliente.');
      return;
    }
    const socket = getSocket() as NonNullable<ReturnType<typeof getSocket>>;
    const sentMapAssetIds = new Set<string>();

    // ============================================================
    // BUS DE BROADCAST EM CLOUD (Supabase Realtime)
    // Espelha todo socket.emit('state:update', ...) para os demais
    // clientes, sem precisar do server.js local. Latência ~50ms.
    // ============================================================
    const clientId = Math.random().toString(36).slice(2);
    // Isola o canal por host: preview do Lovable e site publicado não se cruzam.
    // Override manual: VITE_SYNC_ROOM=<nome> (útil pra rodar várias mesas separadas).
    const envRoom = String(import.meta.env.VITE_SYNC_ROOM ?? '').trim();
    const host = typeof window !== 'undefined' ? window.location.hostname : 'server';
    const room = envRoom || host || 'default';
    const channelName = `world-bus:${room}`;
    const worldBus = supabase.channel(channelName, {
      config: { broadcast: { self: false, ack: false } },
    });
    worldBus.on('broadcast', { event: 'slice' }, ({ payload }) => {
      const p = payload as { clientId?: string; slice?: WorldSlice; data?: unknown } | null;
      if (!p || p.clientId === clientId || !p.slice) return;
      applyRemote(p.slice, p.data);
    });
    worldBus.on('broadcast', { event: 'amizade' }, ({ payload }) => {
      void import('@/lib/suporteNivel2').then(({ useAmizadePromptStore, shouldSeeAmizadePrompt, reduceAmizadeMessage }) => {
        const st = useAmizadePromptStore.getState();
        const r = reduceAmizadeMessage(payload as never, clientId, (sid) => shouldSeeAmizadePrompt(sid, useRoleStore.getState().role));
        if (r.type === 'close') st.close();
        else if (r.type === 'open') st.open({ supporterId: r.supporterId, friendId: r.friendId });
      });
    });
    const onAmizadeSend = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {};
      void worldBus.send({ type: 'broadcast', event: 'amizade', payload: { clientId, ...d } });
    };
    window.addEventListener('amizade:send', onAmizadeSend);
    // Conceder Outra Chance (Suporte Nv 6): oferta/aceite/fechamento entre telas.
    worldBus.on('broadcast', { event: 'outra-chance' }, ({ payload }) => {
      void import('@/lib/suporteNivel6').then(
        ({ useOutraChancePromptStore, shouldSeeOutraChancePrompt, reduceOutraChanceMessage }) => {
          const r = reduceOutraChanceMessage(payload as never, clientId, (sid) =>
            shouldSeeOutraChancePrompt(sid, useRoleStore.getState().role),
          );
          const st = useOutraChancePromptStore.getState();
          if (r.type === 'close') st.close();
          else if (r.type === 'open') st.open(r.offer);
          else if (r.type === 'accept') {
            st.close();
            window.dispatchEvent(
              new CustomEvent('outra-chance:apply', { detail: { requestId: r.requestId, rollerId: r.rollerId } }),
            );
          }
        },
      );
    });
    const onOutraChanceSend = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {};
      void worldBus.send({ type: 'broadcast', event: 'outra-chance', payload: { clientId, ...d } });
    };
    window.addEventListener('outra-chance:send', onOutraChanceSend);
    // Protetor (Suporte Nv 2): oferta/fechamento entre telas.
    worldBus.on('broadcast', { event: 'protetor' }, ({ payload }) => {
      void import('@/lib/suporteProtetor').then(
        ({ useProtetorPromptStore, shouldSeeProtetorPrompt, reduceProtetorMessage }) => {
          const r = reduceProtetorMessage(payload as never, clientId, (sid) =>
            shouldSeeProtetorPrompt(sid, useRoleStore.getState().role),
          );
          const st = useProtetorPromptStore.getState();
          if (r.type === 'close') st.close();
          else if (r.type === 'open') st.open(r.offer);
        },
      );
    });
    const onProtetorSend = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {};
      void worldBus.send({ type: 'broadcast', event: 'protetor', payload: { clientId, ...d } });
    };
    window.addEventListener('protetor:send', onProtetorSend);
    // Negação Crítica (Suporte Nv 4): oferta/aceite/fechamento entre telas.
    worldBus.on('broadcast', { event: 'negacao' }, ({ payload }) => {
      void import('@/lib/suporteNegacao').then(
        ({ useNegacaoPromptStore, shouldSeeNegacaoPrompt, reduceNegacaoMessage, resolveNegacao }) => {
          const r = reduceNegacaoMessage(payload as never, clientId, (sid) =>
            shouldSeeNegacaoPrompt(sid, useRoleStore.getState().role),
          );
          const st = useNegacaoPromptStore.getState();
          if (r.type === 'open') st.open(r.offer);
          else if (r.type === 'accept' || r.type === 'close') {
            if (st.offer?.requestId === r.requestId) st.close();
            resolveNegacao(r.requestId, r.type === 'accept');
          }
        },
      );
    });
    const onNegacaoSend = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {};
      void worldBus.send({ type: 'broadcast', event: 'negacao', payload: { clientId, ...d } });
    };
    window.addEventListener('negacao:send', onNegacaoSend);
    // Mobilidade Avançada (Suporte Nv 2): oferta de reação entre telas.
    worldBus.on('broadcast', { event: 'mobilidade' }, ({ payload }) => {
      void import('@/lib/suporteRepertorioMobilidade').then(
        ({ useMobilidadePromptStore, shouldSeeMobilidadePrompt, reduceMobilidadeMessage }) => {
          const r = reduceMobilidadeMessage(payload as never, clientId, (sid) =>
            shouldSeeMobilidadePrompt(sid, useRoleStore.getState().role),
          );
          const st = useMobilidadePromptStore.getState();
          if (r.type === 'open') st.open(r.offer);
          else if (r.type === 'close') st.close(r.supporterId);
        },
      );
    });
    const onMobilidadeSend = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {};
      void worldBus.send({ type: 'broadcast', event: 'mobilidade', payload: { clientId, ...d } });
    };
    window.addEventListener('mobilidade:send', onMobilidadeSend);
    worldBus.on('broadcast', { event: 'ping' }, ({ payload }) => {
      const p = payload as { clientId?: string; x?: number; y?: number; color?: string } | null;
      if (!p || p.clientId === clientId || typeof p.x !== 'number' || typeof p.y !== 'number') return;
      window.dispatchEvent(new CustomEvent('mapa:remote-ping', { detail: { x: p.x, y: p.y, color: p.color || '#fbbf24' } }));
    });
    worldBus.on('broadcast', { event: 'cursor' }, ({ payload }) => {
      const p = payload as { clientId?: string; x?: number; y?: number; name?: string; color?: string } | null;
      if (!p || p.clientId === clientId) return;
      window.dispatchEvent(new CustomEvent('mapa:remote-cursor', { detail: p }));
    });
    // Rastro do ponteiro com botão direito (press-and-hold) — replica para todos.
    worldBus.on('broadcast', { event: 'pointer-trail' }, ({ payload }) => {
      const p = payload as { clientId?: string; x?: number; y?: number; color?: string; end?: boolean } | null;
      if (!p || p.clientId === clientId) return;
      window.dispatchEvent(new CustomEvent('mapa:remote-pointer-trail', { detail: p }));
    });
    // Patches incrementais de entidade (drag/resize/rotate em tempo real,
    // estilo Owlbear token_positions). Aplica direto sem reserializar o mapa.
    worldBus.on('broadcast', { event: 'entity-patch' }, ({ payload }) => {
      const p = payload as { clientId?: string; patches?: Array<{ id: string; patch: Record<string, unknown> }> } | null;
      if (!p || p.clientId === clientId || !Array.isArray(p.patches)) return;
      const protectedIds = getProtectedRemoteEntityPatchIds();
      const patches = protectedIds ? p.patches.filter((patch) => !protectedIds.has(patch.id)) : p.patches;
      if (!patches.length) return;
      applySmoothedEntityPatches(patches);
    });
    const onEntityPatch = (payload: { clientId?: string; patches?: Array<{ id: string; patch: Record<string, unknown> }> } | null) => {
      if (!payload || payload.clientId === clientId || !Array.isArray(payload.patches)) return;
      const protectedIds = getProtectedRemoteEntityPatchIds();
      const patches = protectedIds ? payload.patches.filter((patch) => !protectedIds.has(patch.id)) : payload.patches;
      if (!patches.length) return;
      applySmoothedEntityPatches(patches);
    };
    void worldBus.subscribe();
    // expõe para o MapaModule emitir pings/cursor remotos
    (window as unknown as { __worldBus?: unknown; __worldBusClientId?: string }).__worldBus = worldBus;
    (window as unknown as { __worldBusClientId?: string }).__worldBusClientId = clientId;

    // Monkey-patch do socket.emit: cada state:update vai também via broadcast.
    const origEmit = socket.emit.bind(socket);
    // Persistência: cada parte da mesa é salva (com atraso curto) para quem entrar depois.
    const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const persistSlice = (slice: string, data: unknown) => {
      if (slice === 'mapScene') return; // mapa já é salvo por publishMapSceneToCloud
      const prev = persistTimers.get(slice);
      if (prev) clearTimeout(prev);
      persistTimers.set(slice, setTimeout(() => {
        persistTimers.delete(slice);
        let json: Json;
        try { json = JSON.parse(JSON.stringify(data ?? null)) as Json; } catch { return; }
        void supabase.from('realtime_world').upsert({ slice, data: json }).then(({ error }) => {
          if (error) console.warn(`[sync] falha ao salvar ${slice}:`, error.message);
        });
      }, 800));
    };
    (socket as unknown as { emit: typeof socket.emit }).emit = ((event: string, ...args: unknown[]) => {
      if (event === 'state:update' && args[0] && typeof args[0] === 'object') {
        const a = args[0] as { slice?: WorldSlice; data?: unknown };
        if (a.slice) {
          try {
            void worldBus.send({ type: 'broadcast', event: 'slice', payload: { clientId, slice: a.slice, data: a.data } });
          } catch (err) { /* ignore */ }
          persistSlice(a.slice, a.data);
        }
      }
      return origEmit(event as never, ...(args as never[]));
    }) as typeof socket.emit;

    // Carrega o estado salvo da mesa ao abrir o site.
    void supabase.from('realtime_world').select('slice,data').neq('slice', 'mapScene').then(({ data, error }) => {
      if (error) { console.warn('[sync] falha ao carregar mesa do Cloud:', error.message); return; }
      for (const row of data ?? []) {
        if (row.data !== null) applyRemote(row.slice as WorldSlice, row.data);
      }
    });



    const onSnapshot = (world: {
      characters: unknown; combat: unknown; chronos: unknown; logs: unknown; profiles: unknown;
      money?: unknown; items?: unknown; calendar?: unknown; spellProposals?: unknown;
      establishments?: unknown; discounts?: unknown;
      omniEntidades?: unknown; omniRuntime?: unknown; omniSpatial?: unknown;
      omniProposals?: unknown;
      mapScene?: unknown;
      testRequests?: unknown;
    }) => {
      // Capturar o estado local ANTES de aplicar o snapshot.
      const preLocal = {
        chars: pickCharacters(useCharacterStore.getState()),
        profiles: pickProfiles(useProfileStore.getState()),
        items: pickItems(useItemStore.getState()),
        events: pickCalendar(useCalendarStore.getState()),
        spellProposals: pickSpellProposals(useSpellProposalStore.getState()),
        establishments: pickEstablishments(useMenuStore.getState()),
        discounts: pickDiscounts(useDiscountStore.getState()),
        omniEnt: pickOmniEntidades(useOmniEntidadesStore.getState()),
        omniRt: pickOmniRuntime(useOmniRuntimeStore.getState()),
        omniSp: pickOmniSpatial(useOmniSpatialStore.getState()),
        omniProps: pickOmniProposals(useOmniProposalStore.getState()),
        mapScene: pickMapScene(),
        money: pickMoney(useMoneyStore.getState()),
      };

      // Helper: merge por id, preservando entradas locais não presentes no remoto.
      // Local "ganha" para itens com mesmo id (assumimos que o local é mais novo
      // quando o snapshot inicial chega — edições subsequentes vêm por state:update).
      const mergeArr = <T extends { id?: unknown }>(local: T[] | undefined, remote: unknown): T[] => {
        const localArr = Array.isArray(local) ? local : [];
        const remoteArr = Array.isArray(remote) ? (remote as T[]) : [];
        const map = new Map<unknown, T>();
        for (const it of remoteArr) if (it && typeof it === 'object' && 'id' in it) map.set((it as { id: unknown }).id, it);
        for (const it of localArr) if (it && typeof it === 'object' && 'id' in it) map.set((it as { id: unknown }).id, it);
        return Array.from(map.values());
      };
      const mergeObj = <T extends Record<string, unknown>>(local: T | undefined, remote: unknown): T => {
        const r = (remote && typeof remote === 'object' ? (remote as T) : ({} as T));
        const l = (local && typeof local === 'object' ? (local as T) : ({} as T));
        return { ...r, ...l }; // local prevalece em conflitos
      };

      // Slices baseadas em arrays-por-id: faz merge local e aplica.
      const mergedChars = mergeArr(preLocal.chars as never[], world.characters);
      const mergedProfiles = mergeArr(preLocal.profiles as never[], world.profiles);
      const mergedItems = mergeArr(preLocal.items as never[], world.items);
      const mergedEvents = mergeArr(preLocal.events as never[], world.calendar);
      const mergedSpellProps = mergeArr(preLocal.spellProposals as never[], world.spellProposals);
      const mergedEsts = mergeArr(preLocal.establishments as never[], world.establishments);
      const mergedDiscounts = mergeArr(preLocal.discounts as never[], world.discounts);
      const mergedOmniProps = mergeArr(preLocal.omniProps as never[], world.omniProposals);

      applyRemote('characters', mergedChars);
      applyRemote('profiles', mergedProfiles);
      applyRemote('items', mergedItems);
      applyRemote('calendar', mergedEvents);
      applyRemote('spellProposals', mergedSpellProps);
      applyRemote('establishments', mergedEsts);
      applyRemote('discounts', mergedDiscounts);
      applyRemote('omniProposals', mergedOmniProps);

      // Slices "replace": só aplica o remoto se o local estiver vazio/default.
      // Logs, combat e chronos podem ser puxados do servidor sem perda.
      if (world.combat) applyRemote('combat', world.combat);
      if (world.chronos) applyRemote('chronos', world.chronos);
      if (world.logs) applyRemote('logs', world.logs);
      if (world.testRequests) applyRemote('testRequests', world.testRequests);

      // Omni: dicionários (merge raso, local prevalece).
      const mergedOmniEnt = mergeObj(preLocal.omniEnt as never, world.omniEntidades);
      const mergedOmniRt = mergeObj(preLocal.omniRt as never, world.omniRuntime);
      const mergedOmniSp = mergeObj(preLocal.omniSp as never, world.omniSpatial);
      applyRemote('omniEntidades', mergedOmniEnt);
      applyRemote('omniRuntime', mergedOmniRt);
      applyRemote('omniSpatial', mergedOmniSp);

      const shouldPublishLocalMap = hasMapContent(preLocal.mapScene) && !isMapSceneSync(world.mapScene);
      if (isMapSceneSync(world.mapScene) && !shouldPublishLocalMap) applyRemote('mapScene', world.mapScene);

      // Money: se o local tem conteúdo, prevalece; senão usa remoto.
      const moneyLocalHasContent =
        (preLocal.money.wallets?.length ?? 0) > 0 ||
        (preLocal.money.transactions?.length ?? 0) > 0 ||
        (preLocal.money.currencies?.length ?? 0) > 1;
      if (!moneyLocalHasContent && world.money) applyRemote('money', world.money);

      // Empurra os merges resultantes para o servidor (mode 'merge' por id,
      // replace para os agregados). O servidor faz broadcast aos demais.
      try {
        if (mergedChars.length > 0) socket.emit('state:update', { slice: 'characters', data: mergedChars, mode: 'merge' });
        if (mergedProfiles.length > 0) socket.emit('state:update', { slice: 'profiles', data: mergedProfiles, mode: 'merge' });
        if (mergedItems.length > 0) socket.emit('state:update', { slice: 'items', data: mergedItems, mode: 'merge' });
        if (mergedEvents.length > 0) socket.emit('state:update', { slice: 'calendar', data: mergedEvents, mode: 'merge' });
        if (mergedSpellProps.length > 0) socket.emit('state:update', { slice: 'spellProposals', data: mergedSpellProps, mode: 'merge' });
        if (mergedEsts.length > 0) socket.emit('state:update', { slice: 'establishments', data: mergedEsts, mode: 'merge' });
        if (mergedDiscounts.length > 0) socket.emit('state:update', { slice: 'discounts', data: mergedDiscounts, mode: 'merge' });
        if (mergedOmniProps.length > 0) socket.emit('state:update', { slice: 'omniProposals', data: mergedOmniProps, mode: 'merge' });
        if (Object.keys(mergedOmniEnt).length > 0) socket.emit('state:update', { slice: 'omniEntidades', data: mergedOmniEnt });
        if (Object.keys(mergedOmniRt).length > 0) socket.emit('state:update', { slice: 'omniRuntime', data: mergedOmniRt });
        if (Object.keys(mergedOmniSp).length > 0) socket.emit('state:update', { slice: 'omniSpatial', data: mergedOmniSp });
        if (shouldPublishLocalMap) {
          socket.emit('state:update', { slice: 'mapScene', data: preLocal.mapScene });
          void publishMapSceneToCloud(preLocal.mapScene);
          void emitMapAssets(socket, collectMapAssetIds(preLocal.mapScene), sentMapAssetIds);
        }
        if (moneyLocalHasContent) socket.emit('state:update', { slice: 'money', data: preLocal.money });
      } catch (err) {
        console.warn('[sync] merge inicial falhou:', err);
      }
    };


    const onUpdate = ({ slice, data }: { slice: WorldSlice; data: unknown }) => {
      applyRemote(slice, data);
    };

    const onAssetPut = ({ id, buffer, mime }: { id?: unknown; buffer?: unknown; mime?: string }) => {
      if (typeof id !== 'string') return;
      const blob = blobFromSocketBuffer(buffer, mime);
      if (!blob) return;
      void assetCache.putWithId(id, blob, mime).then(() => sentMapAssetIds.add(id));
    };

    const onAssetRequest = ({ ids }: { ids?: unknown }) => {
      if (!Array.isArray(ids)) return;
      void emitMapAssets(socket, ids.filter((id): id is string => typeof id === 'string'), sentMapAssetIds, true);
    };

    void supabase.from('realtime_world').select('data').eq('slice', 'mapScene').maybeSingle().then(({ data, error }) => {
      if (error) console.warn('[sync] falha ao carregar mapa do Cloud:', error.message);
      const local = pickMapScene();
      if (isMapSceneSync(data?.data) && !sameMapScene(data.data, local)) applyRemote('mapScene', data.data);
      if (!isMapSceneSync(data?.data) && hasMapContent(local)) void publishMapSceneToCloud(local);
    });

    const cloudMapChannel = supabase
      .channel('shared-map-scene')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'realtime_world', filter: 'slice=eq.mapScene' }, (payload) => {
        const next = (payload.new as { data?: unknown } | null)?.data;
        if (shouldIgnoreRemoteMapScene()) return;
        if (isMapSceneSync(next) && !sameMapScene(next, pickMapScene())) applyRemote('mapScene', next);
      })
      .subscribe();

    const cloudAssetChannel = supabase
      .channel('shared-map-assets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'realtime_assets' }, (payload) => {
        const row = payload.new as { id?: unknown; mime?: string; data_base64?: string } | null;
        const id = row?.id;
        if (typeof id !== 'string' || typeof row?.data_base64 !== 'string') return;
        void assetCache.putWithId(id, base64ToBlob(row.data_base64, row.mime), row.mime).then(() => sentMapAssetIds.add(id));
      })
      .subscribe();

    socket.on('world:snapshot', onSnapshot);
    socket.on('state:update', onUpdate);
    socket.on('entity:patch', onEntityPatch);
    socket.on('asset:put', onAssetPut);
    socket.on('asset:request', onAssetRequest);

    // Pede snapshot ao (re)conectar
    const onConnect = () => socket.emit('world:request');
    socket.on('connect', onConnect);
    if (socket.connected) socket.emit('world:request');

    // Subscribe → emit
    let lastChars = pickCharacters(useCharacterStore.getState());
    const unsubChars = useCharacterStore.subscribe((state) => {
      const next = pickCharacters(state);
      if (next === lastChars) return;
      lastChars = next;
      if (applyingRemote) return;
      socket.emit('state:update', { slice: 'characters', data: next });
    });

    let lastCombat = JSON.stringify(pickCombat(useCombatStore.getState()));
    const unsubCombat = useCombatStore.subscribe((state) => {
      const snap = pickCombat(state);
      const s = JSON.stringify(snap);
      if (s === lastCombat) return;
      lastCombat = s;
      if (applyingRemote) return;
      socket.emit('state:update', { slice: 'combat', data: snap });
    });

    // Chronos: só o Mestre publica (fonte de verdade), e throttla emits para 1×/s.
    let lastChronos = JSON.stringify(pickChronos(useChronosStore.getState()));
    let chronosTimer: ReturnType<typeof setTimeout> | null = null;
    let chronosPending: ReturnType<typeof pickChronos> | null = null;
    const flushChronos = () => {
      chronosTimer = null;
      if (!chronosPending) return;
      socket.emit('state:update', { slice: 'chronos', data: chronosPending });
      lastChronos = JSON.stringify(chronosPending);
      chronosPending = null;
    };
    const unsubChronos = useChronosStore.subscribe((state) => {
      const snap = pickChronos(state);
      const s = JSON.stringify(snap);
      if (s === lastChronos) return;
      if (applyingRemote) { lastChronos = s; return; }
      if (state.lastMutationSource === 'ticker') { lastChronos = s; return; }
      // Apenas o Mestre publica chronos para evitar conflito com o ticker local.
      if (useRoleStore.getState().role !== 'MASTER') { lastChronos = s; return; }
      if (state.lastMutationSource === 'manual') {
        socket.emit('state:update', { slice: 'chronos', data: snap });
        lastChronos = s;
        return;
      }
      chronosPending = snap;
      if (!chronosTimer) chronosTimer = setTimeout(flushChronos, 1000);
    });

    let lastLogs = JSON.stringify(pickLogs(useLogStore.getState()));
    const unsubLogs = useLogStore.subscribe((state) => {
      const next = pickLogs(state);
      const s = JSON.stringify(next);
      if (s === lastLogs) return;
      lastLogs = s;
      if (applyingRemote) return;
      socket.emit('state:update', { slice: 'logs', data: useRoleStore.getState().role === 'MASTER' ? next : next.logs });
    });

    let lastProfiles = JSON.stringify(pickProfiles(useProfileStore.getState()));
    const unsubProfiles = useProfileStore.subscribe((state) => {
      const next = pickProfiles(state);
      const s = JSON.stringify(next);
      if (s === lastProfiles) return;
      lastProfiles = s;
      if (applyingRemote) return;
      socket.emit('state:update', { slice: 'profiles', data: next });
    });

    let lastMoney = JSON.stringify(pickMoney(useMoneyStore.getState()));
    const unsubMoney = useMoneyStore.subscribe((state) => {
      const next = pickMoney(state);
      const s = JSON.stringify(next);
      if (s === lastMoney) return;
      lastMoney = s;
      if (applyingRemote) return;
      socket.emit('state:update', { slice: 'money', data: next });
    });

    let lastItems = JSON.stringify(pickItems(useItemStore.getState()));
    const unsubItems = useItemStore.subscribe((state) => {
      const next = pickItems(state);
      const s = JSON.stringify(next);
      if (s === lastItems) return;
      lastItems = s;
      if (applyingRemote) return;
      socket.emit('state:update', { slice: 'items', data: next });
    });

    let lastCalendar = JSON.stringify(pickCalendar(useCalendarStore.getState()));
    const unsubCalendar = useCalendarStore.subscribe((state) => {
      const next = pickCalendar(state);
      const s = JSON.stringify(next);
      if (s === lastCalendar) return;
      lastCalendar = s;
      if (applyingRemote) return;
      socket.emit('state:update', { slice: 'calendar', data: next });
    });

    let lastProposals = JSON.stringify(pickSpellProposals(useSpellProposalStore.getState()));
    const unsubProposals = useSpellProposalStore.subscribe((state) => {
      const next = pickSpellProposals(state);
      const s = JSON.stringify(next);
      if (s === lastProposals) return;
      lastProposals = s;
      if (applyingRemote) return;
      socket.emit('state:update', { slice: 'spellProposals', data: next });
    });

    let lastEsts = JSON.stringify(pickEstablishments(useMenuStore.getState()));
    const unsubEsts = useMenuStore.subscribe((state) => {
      const next = pickEstablishments(state);
      const s = JSON.stringify(next);
      if (s === lastEsts) return;
      lastEsts = s;
      if (applyingRemote) return;
      socket.emit('state:update', { slice: 'establishments', data: next });
    });

    let lastDiscounts = JSON.stringify(pickDiscounts(useDiscountStore.getState()));
    const unsubDiscounts = useDiscountStore.subscribe((state) => {
      const next = pickDiscounts(state);
      const s = JSON.stringify(next);
      if (s === lastDiscounts) return;
      lastDiscounts = s;
      if (applyingRemote) return;
      socket.emit('state:update', { slice: 'discounts', data: next });
    });

    // Omni — entidades (somente Mestre publica; jogadores recebem broadcast).
    let lastOmniEnt = JSON.stringify(pickOmniEntidades(useOmniEntidadesStore.getState()));
    const unsubOmniEnt = useOmniEntidadesStore.subscribe((state) => {
      const next = pickOmniEntidades(state);
      const s = JSON.stringify(next);
      if (s === lastOmniEnt) return;
      lastOmniEnt = s;
      if (applyingRemote) return;
      if (useRoleStore.getState().role !== 'MASTER') return;
      socket.emit('state:update', { slice: 'omniEntidades', data: next });
    });

    // Omni — runtime de efeitos ativos.
    let lastOmniRt = JSON.stringify(pickOmniRuntime(useOmniRuntimeStore.getState()));
    const unsubOmniRt = useOmniRuntimeStore.subscribe((state) => {
      const next = pickOmniRuntime(state);
      const s = JSON.stringify(next);
      if (s === lastOmniRt) return;
      lastOmniRt = s;
      if (applyingRemote) return;
      socket.emit('state:update', { slice: 'omniRuntime', data: next });
    });

    // Omni — posições espaciais.
    let lastOmniSp = JSON.stringify(pickOmniSpatial(useOmniSpatialStore.getState()));
    const unsubOmniSp = useOmniSpatialStore.subscribe((state) => {
      const next = pickOmniSpatial(state);
      const s = JSON.stringify(next);
      if (s === lastOmniSp) return;
      lastOmniSp = s;
      if (applyingRemote) return;
      socket.emit('state:update', { slice: 'omniSpatial', data: next });
    });

    // Mapa visual — qualquer cliente publica mudanças permitidas pela UI;
    // players conseguem mover seus próprios tokens e o Mestre recebe em tempo real.
    // Só posições mudaram → envia patches leves e salva na nuvem com calma.
    // Qualquer outra mudança (cena, fundo, paredes, desenhos...) → mapa completo.
    const structuralKey = (map: MapSceneSync) => JSON.stringify(map, (key, value) => {
      if ((key === 'x' || key === 'y') && typeof value === 'number') return undefined;
      return value;
    });
    let lastMapObj = pickMapScene();
    let lastMapScene = JSON.stringify(lastMapObj);
    let lastMapStructure = structuralKey(lastMapObj);
    let mapSceneTimer: ReturnType<typeof setTimeout> | null = null;
    let mapPersistTimer: ReturnType<typeof setTimeout> | null = null;
    const lastSentLivePos = new Map<string, { x: number; y: number }>();
    const rememberLivePos = () => {
      lastSentLivePos.clear();
      for (const [id, e] of Object.entries(useMapStore.getState().entities as Record<string, { x: number; y: number }>)) {
        lastSentLivePos.set(id, { x: e.x, y: e.y });
      }
    };
    rememberLivePos();
    const persistMapLater = () => {
      if (mapPersistTimer) clearTimeout(mapPersistTimer);
      mapPersistTimer = setTimeout(() => {
        mapPersistTimer = null;
        void publishMapSceneToCloud(pickMapScene());
      }, 1500);
    };
    const flushMapScene = () => {
      mapSceneTimer = null;
      if (applyingRemote) return;
      const transientUntil = (window as unknown as { __mapTransientUntil?: number }).__mapTransientUntil ?? 0;
      if (performance.now() < transientUntil) {
        mapSceneTimer = setTimeout(flushMapScene, 140);
        return;
      }
      const next = pickMapScene();
      const s = JSON.stringify(next);
      if (s === lastMapScene) return;
      const structure = structuralKey(next);
      const prevObj = lastMapObj;
      lastMapObj = next;
      lastMapScene = s;
      lastPublishedMapJSON = s;
      if (structure === lastMapStructure && next.activeSceneId && next.activeSceneId === prevObj.activeSceneId) {
        // Usa as posições vivas (a cópia da cena pode estar um passo atrasada).
        const liveEnts = useMapStore.getState().entities as Record<string, { x: number; y: number }>;
        const patches: Array<{ id: string; patch: { x: number; y: number } }> = [];
        for (const [id, e] of Object.entries(liveEnts)) {
          const p = lastSentLivePos.get(id);
          if (!p || p.x !== e.x || p.y !== e.y) patches.push({ id, patch: { x: e.x, y: e.y } });
        }
        const otherScenesSame = Object.keys(next.scenes).every((id) =>
          id === next.activeSceneId || JSON.stringify(next.scenes[id]) === JSON.stringify(prevObj.scenes[id]));
        if (otherScenesSame) {
          rememberLivePos();
          if (patches.length) {
            markLocalEntityEdits(patches.map((p) => p.id));
            void worldBus.send({ type: 'broadcast', event: 'entity-patch', payload: { clientId, patches } });
          }
          persistMapLater();
          return;
        }
      }
      lastMapStructure = structure;
      rememberLivePos();
      if (mapPersistTimer) { clearTimeout(mapPersistTimer); mapPersistTimer = null; }
      socket.emit('state:update', { slice: 'mapScene', data: next });
      void publishMapSceneToCloud(next);
      void emitMapAssets(socket, collectMapAssetIds(next), sentMapAssetIds);
    };

    const unsubMapScene = useMapStore.subscribe(() => {
      if (applyingRemote) return;
      localMapChangedAt = performance.now();
      if (mapSceneTimer) clearTimeout(mapSceneTimer);
      mapSceneTimer = setTimeout(flushMapScene, 120);
    });

    // Omni — propostas de jogadores (sincronizam para todos: player vê status, mestre recebe pendentes).
    let lastOmniProps = JSON.stringify(pickOmniProposals(useOmniProposalStore.getState()));
    const unsubOmniProps = useOmniProposalStore.subscribe((state) => {
      const next = pickOmniProposals(state);
      const s = JSON.stringify(next);
      if (s === lastOmniProps) return;
      lastOmniProps = s;
      if (applyingRemote) return;
      socket.emit('state:update', { slice: 'omniProposals', data: next });
    });

    // Pedidos de teste mestre↔jogador.
    let lastTestReqs = JSON.stringify(pickTestRequests(useTestRequestStore.getState()));
    const unsubTestReqs = useTestRequestStore.subscribe((state) => {
      const next = pickTestRequests(state);
      const s = JSON.stringify(next);
      if (s === lastTestReqs) return;
      lastTestReqs = s;
      if (applyingRemote) return;
      socket.emit('state:update', { slice: 'testRequests', data: next });
    });

    // Fog/Walls/Doors/Lights — sincroniza apenas o snapshot persistente.
    const pickFog = () => {
      const s = useFogStore.getState();
      return { walls: s.walls, doors: s.doors, lights: s.lights };
    };
    let lastFog = JSON.stringify(pickFog());
    const unsubFog = useFogStore.subscribe((state) => {
      const next = { walls: state.walls, doors: state.doors, lights: state.lights };
      const s = JSON.stringify(next);
      if (s === lastFog) return;
      lastFog = s;
      if (applyingRemote) return;
      socket.emit('state:update', { slice: 'fog', data: next });
    });

    return () => {
      socket.off('world:snapshot', onSnapshot);
      socket.off('state:update', onUpdate);
      socket.off('entity:patch', onEntityPatch);
      socket.off('asset:put', onAssetPut);
      socket.off('asset:request', onAssetRequest);
      socket.off('connect', onConnect);
      (socket as unknown as { emit: typeof socket.emit }).emit = origEmit as typeof socket.emit;
      void supabase.removeChannel(cloudMapChannel);
      void supabase.removeChannel(cloudAssetChannel);
      window.removeEventListener('amizade:send', onAmizadeSend);
      window.removeEventListener('outra-chance:send', onOutraChanceSend);
      window.removeEventListener('negacao:send', onNegacaoSend);
      window.removeEventListener('protetor:send', onProtetorSend);
      window.removeEventListener('mobilidade:send', onMobilidadeSend);
      void supabase.removeChannel(worldBus);
      if (chronosTimer) clearTimeout(chronosTimer);
      if (mapSceneTimer) clearTimeout(mapSceneTimer);
      unsubChars();
      unsubCombat();
      unsubChronos();
      unsubLogs();
      unsubProfiles();
      unsubMoney();
      unsubItems();
      unsubCalendar();
      unsubProposals();
      unsubEsts();
      unsubDiscounts();
      unsubOmniEnt();
      unsubOmniRt();
      unsubOmniSp();
      unsubMapScene();
      unsubOmniProps();
      unsubTestReqs();
      unsubFog();
    };

  }, []);
}
