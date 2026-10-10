Warning: truncated output (original token count: 38312)
Total output lines: 3621

import { ladoIniciativaPorFicha } from '@/lib/mapa/ladoIniciativa';
import { NpcInteracaoOverlay } from '@/components/economia/NpcInteracaoOverlay';
import { comPreviaMovimento, confirmarMovimentoMapa } from '@/lib/mapa/movimentoConfirmado';
import { ItemNoChaoOverlay } from './ui/ItemNoChaoOverlay';
import { AlvoMapaOverlay } from './ui/AlvoMapaOverlay';
import { useAlvoMapaStore, tokenDaFicha, clicarAlvoMapa, terminarAlvoMapa, alvosNoAlcance } from '@/stores/useAlvoMapaStore';
import { prepareCollisionCache, resolveCollisionMove, type MapCollisionSegment, type MapCollisionToken, type MapCollisionCache } from '@/lib/mapCollision';
/**
 * MapaModule — Etapas 1+2+3.
 *
 * Etapa 1: viewport infinito (pan/zoom, 3 canvases, rAF).
 * Etapa 2: motor paramétrico de grade + UI.
 * Etapa 3: Entidades (RECT/ELLIPSE) com seleção, drag, resize (8 handles)
 *          e rotação via handle. Hit-test OBB. Snap respeitado no drag
 *          e no resize (centro vai pra âncora) salvo bypass com Ctrl/Cmd.
 *
 * Interações:
 *   - Pan: middle mouse ou Space+esquerdo.
 *   - Zoom: scroll.
 *   - LMB em vazio + arrastar: marquee (na real, só clique-deseleciona aqui).
 *   - LMB em entidade: seleciona; arrasta = move; Shift = adiciona à seleção.
 *   - LMB em handle: resize / rotate.
 *   - Duplo-clique no vazio: cria entidade nova.
 *   - Delete: remove selecionadas.
 *   - Ctrl/Cmd: bypass de snap.
 */
import { ReplicaSustentacaoPrompt } from '@/components/fichas/ReplicasSection';
import { shownPeMax, shownHpMax } from '@/lib/peDisplay';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useMapStore,
  type GridType,
  type LineType,
  type Entity,
} from '@/stores/useMapStore';

import { GridEngine, screenToWorld, visibleBBox } from './GridEngine';
import {
  hitTest,
  pickHandle,
  resizeFromHandle,
  drawEntity,
  drawSelection,
  drawNameplate,
  getTokenDisplayPatch,
  worldToLocal,
  entitiesInRect,
  type HandleKind,
} from './EntityEngine';
function normalizeRect(ax: number, ay: number, bx: number, by: number) {
  const x = Math.min(ax, bx); const y = Math.min(ay, by);
  return { x, y, w: Math.abs(bx - ax), h: Math.abs(by - ay) };
}
import { MeasureEngine } from './MeasureEngine';
import { DrawEngine } from './DrawEngine';
import { TemplateEngine, type MapTemplate } from './TemplateEngine';
import { LightingEngine, collectLights, LIGHT_PRESETS } from './LightingEngine';
import { WallsEngine, type WallKind } from './WallsEngine';
import { computeVisibilityPolygon, pathPolygon } from './VisionEngine';
import {
  groupBBox, pickGroupHandle,
  applyGroupResize, applyGroupRotate, drawGroupBox,
  align as alignEntities, distribute as distributeEntities,
  type GroupBBox, type GroupHandleKind,
} from './GroupEngine';

import { assetCache } from './assetCache';
import { assetDB } from './assetDB';

import {
  Image as ImageIcon, Trash2,
} from 'lucide-react';
import { ToolRail } from './ui/ToolRail';
import { MapTopBar } from './ui/MapTopBar';
import { PartyPanel } from './ui/PartyPanel';
import { PlayerActionBar } from './ui/PlayerActionBar';
import { ToolSettingsPanel } from './ui/ToolSettingsPanel';
import { AssetTypeDialog, type AssetKind } from './ui/AssetTypeDialog';
import { TokenCropDialog } from './ui/TokenCropDialog';
import { NotesOverlay } from './ui/NotesOverlay';
import { SelectionToolbar } from './ui/SelectionToolbar';
import { ZonaTerrenoDialog } from './ui/ZonaTerrenoDialog';
import { PendingMoveOverlay } from './ui/PendingMoveOverlay';
import { OpportunityPromptOverlay } from './ui/OpportunityPromptOverlay';
import { ZonaRiscoPrompt } from '@/components/fichas/ZonaRiscoPrompt';
import { PreparoImediatoPrompt } from '@/components/fichas/PreparoImediatoPrompt';

import { PendingAoEOverlay } from './ui/PendingAoEOverlay';
import { LootOverlay } from './ui/LootOverlay';
import { ChestOverlay } from './ui/ChestOverlay';
import { useRoleStore } from '@/stores/useRoleStore';
import { useFogStore } from '@/stores/fogStore';
import { buildSegments as buildFogSegments } from '@/lib/fog/visibility';
import { useProfileStore } from '@/stores/useProfileStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { selectOmniModifiers } from '@/lib/omni/omniBridge';
import { MapContextMenu, type CtxMenuAction } from './ui/MapContextMenu';
import { LayerPanel } from './ui/LayerPanel';
import { InitiativePanel } from './ui/InitiativePanel';
import { DicePanel } from './ui/DicePanel';
import { ShortcutsHelp } from './ui/ShortcutsHelp';
import { WelcomeTutorial, useWelcomeTutorial } from './ui/WelcomeTutorial';
import { FogCanvas } from '@/components/fog/FogCanvas';
import { FogToolbar } from '@/components/fog/FogToolbar';
import { LightSettings } from '@/components/fog/LightSettings';
import { CombatBar } from '@/components/combat/CombatBar';
import { useDiceStore } from '@/stores/useDiceStore';
import type { Character } from '@/types';
import { getSocket } from '@/lib/socket';
import { holdLocalMapSync, markLocalEntityEdits } from './mapSyncGuards';
import { combatMoveBudget, reactionMoveBudget } from '@/lib/movementBudget';
import { isFreeformFor } from '@/lib/freeformMode';
import { toast } from '@/hooks/use-toast';
import { imagemArmaEmpunhada, imagemPronta } from '@/lib/omni/imagemItem';
import { useChestStore } from '@/stores/useChestStore';

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const ZOOM_STEP = 1.1;
const isRotatableAoEKind = (kind: MapTemplate['kind']) => kind === 'square' || kind === 'cone' || kind === 'cone_attached' || kind === 'line';

function bonusDeslocamentoOmni(character: Character | undefined): number {
  if (!character) return 0;
  const equipped = useInventoryStore.getState().listEquipped(character.id);
  const entities = useOmniEntidadesStore.getState().entidades;
  return selectOmniModifiers(character, equipped, entities).deslocamento;
}

export const snapBypassRef = { current: false };

type DragMode =
  | { kind: 'none' }
  | { kind: 'pan' }
  | { kind: 'move'; ids: string[]; primaryId: string; startWorld: { x: number; y: number }; origs: Record<string, { x: number; y: number }>; historyPushed?: boolean; resolved?: { dx: number; dy: number }; blockers?: MapCollisionCache; combat?: CombatMoveMeta }
  | { kind: 'resize'; id: string; handle: HandleKind; orig: Entity }
  | { kind: 'rotate'; id: string; orig: Entity; startAngle: number }
  | { kind: 'group-resize'; ids: string[]; handle: GroupHandleKind; bbox: GroupBBox; origs: Entity[] }
  | { kind: 'group-rotate'; ids: string[]; pivot: { x: number; y: number }; origs: Entity[]; startAngle: number }
  
  | { kind: 'measure'; startWorld: { x: number; y: number }; currentWorld: { x: number; y: number } }
  | { kind: 'draw'; strokeId: string; points: { x: number; y: number }[]; color: string; size: number }
  | { kind: 'erase'; lastWorld: { x: number; y: number }; radius: number }
  | { kind: 'template'; preview: MapTemplate; startWorld: { x: number; y: number } }
  | { kind: 'wall'; wallKind: WallKind; wallShape: 'line' | 'rect' | 'ellipse' | 'polygon'; startWorld: { x: number; y: number }; currentWorld: { x: number; y: number }; polyPoints?: { x: number; y: number }[] }
  | { kind: 'marquee'; startWorld: { x: number; y: number }; currentWorld: { x: number; y: number }; additive: boolean; baseSelection: string[] };

type CombatMoveMeta = {
  charId: string;
  budgetM: number;
  usedBeforeM: number;
  metersPerPx: number;
  startPrim: { x: number; y: number };
  lastPrim: { x: number; y: number };
  trail: { x: number; y: number }[];
  movedPx: number;
};

/** Clipboard volátil (sobrevive entre mounts da página mas não entre reloads). */
const clipboardRef: { current: Entity[] } = { current: [] };

type NameplateCharacterStats = { hp: number; hpMax: number; pe: number; peMax: number };

const isPlayerVisibleCharacter = (c: Character) =>
  c.category === 'PLAYER' && c.createdBy !== 'MASTER' && !c.hiddenFromPlayers;

const findProfileCharacter = (characters: Character[], profileId: string | null): Character | null => {
  const visiblePlayers = characters.filter(isPlayerVisibleCharacter);
  if (profileId) {
    const exact = visiblePlayers.filter((c) => c.profileId === profileId);
    if (exact.length === 1) return exact[0];
    if (visiblePlayers.length === 1) return visiblePlayers[0];
    const legacy = visiblePlayers.filter((c) => !c.profileId);
    if (legacy.length === 1) return legacy[0];
    return null;
  }
  return visiblePlayers.length === 1 ? visiblePlayers[0] : null;
};

const MOVEMENT_EPS_M = 0.05;

type EntityPatchMessage = Array<{ id: string; patch: Partial<Entity> }>;

// Limita envios ao vivo (~8/s): a conexão aceita ~10 mensagens/s por pessoa e o
// excesso é descartado. Acumula a última versão de cada peça e sempre envia a final.
const ENTITY_PATCH_INTERVAL_MS = 125;
const pendingEntityPatches = new Map<string, Partial<Entity>>();
let entityPatchTimer: ReturnType<typeof setTimeout> | null = null;
let lastEntityPatchSent = 0;
const pendingEntityPatchAts = new Map<string, number>();

const flushEntityPatches = () => {
  entityPatchTimer = null;
  if (!pendingEntityPatches.size) return;
  const patches = [...pendingEntityPatches.entries()].map(([id, patch]) => ({ id, patch, at: pendingEntityPatchAts.get(id) }));
  pendingEntityPatches.clear();
  pendingEntityPatchAts.clear();
  lastEntityPatchSent = performance.now();
  try {
    const w = window as unknown as {
      __worldBus?: { send: (a: unknown) => void };
      __worldBusClientId?: string;
    };
    const payload = { clientId: w.__worldBusClientId, patches };
    w.__worldBus?.send({ type: 'broadcast', event: 'entity-patch', payload });
    getSocket()?.emit('entity:patch', payload);
  } catch { /* ignore */ }
};

const sendEntityPatches = (patches: EntityPatchMessage) => {
  if (!patches.length) return;
  const at = Date.now();
  markLocalEntityEdits(patches.map((p) => p.id));
  for (const { id, patch } of patches) {
    pendingEntityPatches.set(id, { ...(pendingEntityPatches.get(id) ?? {}), ...patch });
    pendingEntityPatchAts.set(id, at);
  }
  if (entityPatchTimer) return;
  const wait = Math.max(0, ENTITY_PATCH_INTERVAL_MS - (performance.now() - lastEntityPatchSent));
  entityPatchTimer = setTimeout(flushEntityPatches, wait);
};

const playerOwnsEntity = (entity: Entity, profileId: string | null, characters: Character[]): boolean => {
  if (!profileId) return false;
  if (entity.ownerCharId && characters.some(c => c.id === entity.ownerCharId && c.profileId === profileId)) return true;
  // Posse real do token/imagem enviada pelo player.
  if (entity.ownerProfileId === profileId) return true;
  // Avatar marcado como "Sou eu" também conta como controlável.
  if (entity.avatarProfileId === profileId) return true;
  // Token vinculado manualmente à ficha do perfil ativo também é controlável.
  if (entity.characterId) {
    const linked = characters.find((c) => c.id === entity.characterId);
    if (linked?.profileId === profileId) return true;
  }
  // Compatibilidade: imagens antigas podem ter perdido ownerProfileId quando
  // "Sou eu" limpava a marcação dos outros uploads do player.
  return !!entity.assetId && !entity.ownerProfileId && !entity.characterId && (entity.layer ?? 'tokens') === 'tokens';
};

const canPlayerEditEntityNow = (entity: Entity): boolean => {
  if (useRoleStore.getState().role !== 'PLAYER') return true;
  return playerOwnsEntity(
    entity,
    useProfileStore.getState().activeProfileId,
    useCharacterStore.getState().characters,
  );
};

const canStartMoveEntityNow = (entity: Entity): boolean => {
  const mapState = useMapStore.getState();
  const samePending = !!mapState.pendingMove && mapState.pendingMove.entityId === entity.id;
  // Permite continuar o movimento pendente do MESMO token; bloqueia outros.
  if (mapState.pendingMove && !samePending) return false;

  // Token com ficha de HP <= 0 (caído) não pode se mover por si só.
  if (entity.characterId) {
    const ch = useCharacterStore.getState().characters.find((c) => c.id === entity.characterId);
    if (ch && (ch.hpCurrent ?? 0) <= 0) return false;
  }

  if (useRoleStore.getState().role !== 'PLAYER') return true;

  const characters = useCharacterStore.getState().characters;
  const activeProfileId = useProfileStore.getState().activeProfileId;
  if (!playerOwnsEntity(entity, activeProfileId, characters)) return false;

  const combat = useCombatStore.getState();
  // Servos não possuem turnos independentes: em combate aguardam comando do dono.
  if (entity.invocationId && combat.inCombat) return false;
  if (!combat.inCombat) return true;
  // Entidades sem ficha vinculada (imagens/objetos enviados pelo player) são
  // movíveis livremente mesmo em combate — não consomem orçamento de movimento.
  if (!entity.characterId) return true;
  const isActiveTurn = combat.initiativeOrder[combat.currentTurnIndex]?.charId === entity.characterId;
  const character = characters.find((c) => c.id === entity.characterId);
  // Fora do turno só move quem tem movimento de reação (Mobilidade Avançada).
  if (!isActiveTurn && reactionMoveBudget(character, bonusDeslocamentoOmni(character)) == null) return false;

  // Se já existe um pendingMove para esse token, permite retomar mesmo
  // sem orçamento restante (o jogador pode arrastar de volta para reduzir).
  if (samePending) return true;

  if (isActiveTurn && isFreeformFor(character, combat.freeformMode)) return true;
  const budgetM = combatMoveBudget(character, isActiveTurn, bonusDeslocamentoOmni(character)) ?? 0;
  const usedM = combat.movementUsedByChar[entity.characterId] ?? 0;
  return budgetM - usedM > MOVEMENT_EPS_M;
};



export const toNameplateStats = (c: Character): NameplateCharacterStats => {
  // Se o máximo estiver zerado/indefinido (fichas antigas ou temporárias),
  // usa o valor atual como teto para a barra nunca sumir.
  const hpMax = shownHpMax(c);
  const peMax = shownPeMax(c);
  return {
    hp: c.hpCurrent,
    hpMax: hpMax > 0 ? hpMax : Math.max(0, c.hpCurrent ?? 0),
    pe: c.peCurrent,
    peMax: peMax > 0 ? peMax : Math.max(0, c.peCurrent ?? 0),
  };
};

const resolveEntityNameplateStats = (
  entity: Entity,
  characters: Character[],
  byId: Record<string, NameplateCharacterStats>,
): NameplateCharacterStats | undefined => {
  if (entity.characterId) return byId[entity.characterId];
  if (entity.groundItem || entity.chestId) return undefined;

  const profileId = entity.avatarProfileId ?? entity.ownerProfileId;
  if (!profileId) return undefined;

  const linkedPlayers = characters.filter((c) => isPlayerVisibleCharacter(c) && c.profileId === profileId);
  if (linkedPlayers.length !== 1) return undefined;

  return byId[linkedPlayers[0].id];
};


export function MapaModule() {
  const selecionandoAlvo = useAlvoMapaStore(s => !!s.pending);
  const containerRef = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const tokenCanvasRef = useRef<HTMLCanvasElement>(null);
  const lightCanvasRef = useRef<HTMLCanvasElement>(null);
  

  const spaceDownRef = useRef(false);
  // Offset manual de rotação para AoE direcionados (cone/line),
  // controlado por Space + scroll do mouse. Resetado por pending.
  const aoeRotOffsetRef = useRef(0);
  const aoePendingIdRef = useRef<unknown>(null);


  const shiftDownRef = useRef(false);
  const panStateRef = useRef<{ lastX: number; lastY: number }>({ lastX: 0, lastY: 0 });
  const panClickRef = useRef<{ x: number; y: number; mapId: string | null } | null>(null);
  const dragRef = useRef<DragMode>({ kind: 'none' });
  const mouseScreenRef = useRef<{ x: number; y: number } | null>(null);
  const mouseWorldRef = useRef<{ x: number; y: number } | null>(null);
  const entityDragMovedRef = useRef(false);
  const clickCountRef = useRef<{ id: string | null; count: number; t: number }>({ id: null, count: 0, t: 0 });
  const [selectionToolbarVisible, setSelectionToolbarVisible] = useState(false);
  const [tokenCropEntityId, setTokenCropEntityId] = useState<string | null>(null);
  const [terrainZoneEditId, setTerrainZoneEditId] = useState<string | null>(null);
  const selectionToolbarVisibleRef = useRef(false);

  const gridConfig = useMapStore((s) => s.gridConfig);
  const setGridConfig = useMapStore((s) => s.setGridConfig);
  const cameraScale = useMapStore((s) => s.camera.scale);
  const immersive = useMapStore((s) => s.immersive);
  const setImmersive = useMapStore((s) => s.setImmersive);
  const partyCollapsed = useMapStore((s) => s.partyCollapsed);
  const setPartyCollapsed = useMapStore((s) => s.setPartyCollapsed);
  const activeTool = useMapStore((s) => s.activeTool);
  const setActiveTool = useMapStore((s) => s.setActiveTool);
  const shapeShape = useMapStore((s) => s.toolSettings.shape.shape);
  const shapeColor = useMapStore((s) => s.toolSettings.shape.color);
  
  const setToolSettings = useMapStore((s) => s.setToolSettings);

  const [gridOpen, setGridOpen] = useState(false);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const selectedIdsKey = useMapStore((s) => s.selectedIds.join(','));
  useEffect(() => { setSelectionToolbarVisible(false); selectionToolbarVisibleRef.current = false; }, [selectedIdsKey]);
  useEffect(() => { selectionToolbarVisibleRef.current = selectionToolbarVisible; }, [selectionToolbarVisible]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pendingAssets, setPendingAssets] = useState<Array<{
    assetId: string;
    name: string;
    previewUrl: string;
    dims: { w: number; h: number };
    world: { x: number; y: number };
  }>>([]);
  const tutorial = useWelcomeTutorial();
  // Refs sincronizados com o store para uso nos handlers DOM.
  const activeToolRef = useRef(activeTool);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  const drawSettings = useMapStore((s) => s.toolSettings.draw);
  const drawSettingsRef = useRef(drawSettings);
  useEffect(() => { drawSettingsRef.current = drawSettings; }, [drawSettings]);
  /** Pings ativos (transientes, não persistem). */
  const pingsRef = useRef<Array<{ x: number; y: number; color: string; start: number }>>([]);
  /** Emite um ping local + broadcast para os demais clientes. */
  const pushPing = (x: number, y: number, color: string) => {
    pingsRef.current.push({ x, y, color, start: performance.now() });
    const w = window as unknown as { __worldBus?: { send: (m: unknown) => unknown }; __worldBusClientId?: string };
    if (w.__worldBus && w.__worldBusClientId) {
      try { void w.__worldBus.send({ type: 'broadcast', event: 'ping', payload: { clientId: w.__worldBusClientId, x, y, color } }); } catch { /* ignore */ }
    }
  };
  const transientCommitRef = useRef(0);
  const withTransientCommitsPaused = useCallback((fn: () => void) => {
    transientCommitRef.current += 1;
    holdLocalMapSync(220);
    try {
      comPreviaMovimento(fn);
    } finally {
      window.setTimeout(() => {
        transientCommitRef.current = Math.max(0, transientCommitRef.current - 1);
      }, 160);
    }
  }, []);
  // Recebe pings remotos.
  useEffect(() => {
    const onRemote = (e: Event) => {
      const d = (e as CustomEvent).detail as { x: number; y: number; color?: string };
      if (typeof d?.x !== 'number' || typeof d?.y !== 'number') return;
      pingsRef.current.push({ x: d.x, y: d.y, color: d.color ?? '#fbbf24', start: performance.now() });
    };
    window.addEventListener('mapa:remote-ping', onRemote);
    return () => window.removeEventListener('mapa:remote-ping', onRemote);
  }, []);

  // Rastros de ponteiro (botão direito) de outros clientes.
  type RemoteRightPing = {
    color: string;
    world: { x: number; y: number };
    trail: Array<{ x: number; y: number; t: number }>;
    fading?: number;
  };
  const remoteRightPingsRef = useRef(new Map<string, RemoteRightPing>());
  useEffect(() => {
    const onTrail = (e: Event) => {
      const d = (e as CustomEvent).detail as { clientId?: string; x?: number; y?: number; color?: string; end?: boolean };
      if (!d || !d.clientId) return;
      const map = remoteRightPingsRef.current;
      let r = map.get(d.clientId);
      if (d.end) {
        if (r) r.fading = performance.now();
        return;
      }
      if (typeof d.x !== 'number' || typeof d.y !== 'number') return;
      const now = performance.now();
      if (!r) {
        r = { color: d.color || '#ff5577', world: { x: d.x, y: d.y }, trail: [{ x: d.x, y: d.y, t: now }] };
        map.set(d.clientId, r);
      } else {
        r.color = d.color || r.color;
        r.world = { x: d.x, y: d.y };
        r.trail.push({ x: d.x, y: d.y, t: now });
        if (r.trail.length > 256) r.trail.shift();
        r.fading = undefined;
      }
    };
    window.addEventListener('mapa:remote-pointer-trail', onTrail);
    return () => window.removeEventListener('mapa:remote-pointer-trail', onTrail);
  }, []);


  const rDownRef = useRef(false);
  /** Ponteiro "press-and-hold" com botão direito (rastro efêmero). */
  const rightPingRef = useRef<{
    active: boolean;
    moved: boolean;
    startScreen: { x: number; y: number };
    world: { x: number; y: number };
    color: string;
    trail: Array<{ x: number; y: number; t: number }>;
  } | null>(null);

  /** Estado do menu de contexto (clique-direito). */
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    world: { x: number; y: number };
    carry?: { mode: 'carry' | 'drop'; targetId: string; carrierId: string };
  } | null>(null);

  // ============ Render loop ============
  useEffect(() => {
    const bg = bgCanvasRef.current;
    const tk = tokenCanvasRef.current;
    const lt = lightCanvasRef.current;
    const container = containerRef.current;
    if (!bg || !tk || !lt || !container) return;

    const bgCtx = bg.getContext('2d')!;
    const tkCtx = tk.getContext('2d')!;
    const ltCtx = lt.getContext('2d')!;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      for (const c of [bg, tk, lt]) {
        c.width = Math.floor(w * dpr);
        c.height = Math.floor(h * dpr);
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let rafId = 0;
    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const state = useMapStore.getState();
      const { camera, gridConfig: cfg, entities, entityOrder, selectedIds } = state;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const bbox = visibleBBox(w, h, camera);

      // --- background: imagem (se houver) + grid ---
      bgCtx.setTransform(1, 0, 0, 1, 0, 0);
      bgCtx.clearRect(0, 0, bg.width, bg.height);
      bgCtx.save();
      bgCtx.scale(dpr, dpr);
      bgCtx.scale(camera.scale, camera.scale);
      bgCtx.translate(camera.x, camera.y);

      const bgImg = state.background;
      if (bgImg) {
        const cached = assetCache.get(bgImg.assetId);
        if (cached?.ready) {
          bgCtx.save();
          bgCtx.translate(bgImg.x, bgImg.y);
          if (bgImg.rotation) bgCtx.rotate(bgImg.rotation);
          bgCtx.globalAlpha = bgImg.opacity;
          bgCtx.drawImage(cached.img, -bgImg.w / 2, -bgImg.h / 2, bgImg.w, bgImg.h);
          bgCtx.restore();
        }
      }

      GridEngine.draw(bgCtx, bbox, cfg, camera.scale);
      bgCtx.restore();

      // --- token layer: entidades + seleção + snap preview ---
      tkCtx.setTransform(1, 0, 0, 1, 0, 0);
      tkCtx.clearRect(0, 0, tk.width, tk.height);
      tkCtx.save();
      tkCtx.scale(dpr, dpr);
      tkCtx.scale(camera.scale, camera.scale);
      tkCtx.translate(camera.x, camera.y);

      // strokes de desenho (abaixo das entidades)
      DrawEngine.drawAll(tkCtx, state.drawings);

      // templates persistentes (abaixo de tokens, acima de strokes)
      for (const t of state.templates) {
        TemplateEngine.draw(tkCtx, t, camera.scale);
        TemplateEngine.drawLabel(tkCtx, t, state.gridConfig, camera.scale);
      }

      // réguas persistentes
      for (const r of state.rulers) {
        MeasureEngine.draw(tkCtx, r.a, r.b, state.gridConfig, camera.scale);
      }

      // Rastro de movimento em combate (pending OU drag em andamento).
      const drawTrail = (
        pts: { x: number; y: number }[],
        color: string,
        meters: number,
        budgetM?: number,
      ) => {
        if (pts.length < 2) return;
        tkCtx.save();
        tkCtx.strokeStyle = color;
        tkCtx.lineWidth = 2 / camera.scale;
        tkCtx.setLineDash([8 / camera.scale, 6 / camera.scale]);
        tkCtx.beginPath();
        tkCtx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) tkCtx.lineTo(pts[i].x, pts[i].y);
        tkCtx.stroke();
        tkCtx.setLineDash([]);

        // Ponto inicial e final
        tkCtx.fillStyle = color;
        for (const p of [pts[0], pts[pts.length - 1]]) {
          tkCtx.beginPath();
          tkCtx.arc(p.x, p.y, 4 / camera.scale, 0, Math.PI * 2);
          tkCtx.fill();
        }

        // Label no meio do trajeto (similar à régua) com metros percorridos.
        // Calcula o ponto a 50% do comprimento total percorrido.
        let total = 0;
        for (let i = 1; i < pts.length; i++) {
          total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        }
        let mid = pts[Math.floor(pts.length / 2)];
        if (total > 0) {
          let acc = 0;
          for (let i = 1; i < pts.length; i++) {
            const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
            if (acc + seg >= total / 2) {
              const t = (total / 2 - acc) / seg;
              mid = {
                x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
                y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
              };
              break;
            }
            acc += seg;
          }
        }

        const fmt = (m: number) => `${m.toFixed(m < 10 ? 1 : 0)}`;
        const text = budgetM !== undefined
          ? `${fmt(Math.min(meters, budgetM))} / ${fmt(budgetM)} m`
          : `${fmt(meters)} m`;

        const fontPx = 13;
        tkCtx.font = `600 ${fontPx / camera.scale}px ui-sans-serif, system-ui, sans-serif`;
        tkCtx.textAlign = 'center';
        tkCtx.textBaseline = 'middle';
        const padX = 6 / camera.scale;
        const padY = 3 / camera.scale;
        const tw = tkCtx.measureText(text).width;
        const th = fontPx / camera.scale;
        const rx = mid.x - tw / 2 - padX;
        const ry = mid.y - th / 2 - padY;
        const rw = tw + padX * 2;
        const rh = th + padY * 2;
        tkCtx.fillStyle = 'rgba(20,20,30,0.85)';
        tkCtx.strokeStyle = color;
        tkCtx.lineWidth = 1 / camera.scale;
        tkCtx.beginPath();
        const anyCtx = tkCtx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void };
        if (typeof anyCtx.roundRect === 'function') {
          anyCtx.roundRect(rx, ry, rw, rh, 4 / camera.scale);
        } else {
          tkCtx.rect(rx, ry, rw, rh);
        }
        tkCtx.fill();
        tkCtx.stroke();
        tkCtx.fillStyle = color;
        tkCtx.fillText(text, mid.x, mid.y);
        tkCtx.restore();
      };
      const liveDrag = dragRef.current;
      if (liveDrag.kind === 'move' && liveDrag.combat) {
        const cm = liveDrag.combat;
        const usedNow = cm.usedBeforeM + cm.movedPx * cm.metersPerPx;
        drawTrail(cm.trail, '#fcd34d', usedNow, cm.budgetM);
      }
      if (state.pendingMove && (liveDrag.kind !== 'move' || !liveDrag.combat)) {
        const pm = state.pendingMove;
        const cb2 = useCombatStore.getState();
        const ch2 = useCharacterStore.getState().characters.find((c) => c.id === pm.charId);
        const active2 = cb2.initiativeOrder[cb2.currentTurnIndex]?.charId === pm.charId;
        const budgetM2 = active2 && isFreeformFor(ch2, cb2.freeformMode) ? Infinity : (ch2 ? (combatMoveBudget(ch2, active2, bonusDeslocamentoOmni(ch2)) ?? undefined) : undefined);
        const committed = cb2.movementUsedByChar[pm.charId] ?? 0;
        const totalUsed = committed + pm.distM;
        drawTrail(pm.trail, '#fcd34d', totalUsed, budgetM2);
      }




      const { layerVisible } = state;
      const isMaster = useRoleStore.getState().role !== 'PLAYER';
      // ordem efetiva: agrupa por camada (map → tokens → gm).
      // Player: pula entidades ocultas. Mestre: inclui (renderiza translúcidas).
      const effectiveOrder: string[] = [];
      for (const lyr of ['map', 'tokens', 'gm'] as const) {
        if (!layerVisible[lyr]) continue;
        for (const id of entityOrder) {
          const en = entities[id];
          if (!en) continue;
          if (en.hidden && !isMaster) continue;
          if ((en.layer ?? 'tokens') !== lyr) continue;
          effectiveOrder.push(id);
        }
      }
      for (const id of effectiveOrder) {
        const e = entities[id];
        if (!e) continue;
        if (e.hidden) {
          tkCtx.save();
          tkCtx.globalAlpha = 0.35;
          drawEntity(tkCtx, e, camera.scale);
          tkCtx.restore();
        } else {
          drawEntity(tkCtx, e, camera.scale);
        }
      }
      const aoePreview = state.aoeTargetPreview;
      const aoeTargetIds = new Set(aoePreview?.entityIds ?? []);
      if (aoeTargetIds.size > 0) {
        for (const id of effectiveOrder) {
          if (!aoeTargetIds.has(id)) continue;
          const e = entities[id];
          if (!e || e.hidden) continue;
          tkCtx.save();
          tkCtx.translate(e.x, e.y);
          tkCtx.rotate(e.rotation);
          tkCtx.strokeStyle = 'rgba(250, 204, 21, 0.98)';
          tkCtx.fillStyle = 'rgba(250, 204, 21, 0.13)';
          tkCtx.lineWidth = 3 / camera.scale;
          tkCtx.setLineDash([10 / camera.scale, 5 / camera.scale]);
          if (e.shape === 'ELLIPSE') {
            tkCtx.beginPath();
            tkCtx.ellipse(0, 0, e.w / 2 + 5 / camera.scale, e.h / 2 + 5 / camera.scale, 0, 0, Math.PI * 2);
            tkCtx.fill();
            tkCtx.stroke();
          } else {
            tkCtx.beginPath();
            tkCtx.rect(-e.w / 2 - 5 / camera.scale, -e.h / 2 - 5 / camera.scale, e.w + 10 / camera.scale, e.h + 10 / camera.scale);
            tkCtx.fill();
            tkCtx.stroke();
          }
          tkCtx.setLineDash([]);
          tkCtx.restore();

          tkCtx.save();
          const b = { x: e.x - e.w / 2, y: e.y - e.h / 2 };
          const text = 'ACERTO';
          const fontPx = 11 / camera.scale;
          tkCtx.font = `800 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
          tkCtx.textAlign = 'center';
          tkCtx.textBaseline = 'middle';
          const padX = 5 / camera.scale;
          const padY = 2 / camera.scale;
          const tw = tkCtx.measureText(text).width;
          const cx = e.x;
          const cy = b.y - 10 / camera.scale;
          tkCtx.fillStyle = 'rgba(24, 18, 6, 0.92)';
          tkCtx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
          tkCtx.lineWidth = 1 / camera.scale;
          tkCtx.beginPath();
          tkCtx.rect(cx - tw / 2 - padX, cy - fontPx / 2 - padY, tw + padX * 2, fontPx + padY * 2);
          tkCtx.fill();
          tkCtx.stroke();
          tkCtx.fillStyle = 'rgb(254, 240, 138)';
          tkCtx.fillText(text, cx, cy);
          tkCtx.restore();
        }
      }
      if (aoePreview) {
        const t = state.templates.find((tpl) => tpl.id === aoePreview.templateId);
        if (t) {
          const text = aoeTargetIds.size > 0 ? `${aoeTargetIds.size} acerto(s)` : 'Nenhum acerto';
          const fontPx = 13 / camera.scale;
          const padX = 7 / camera.scale;
          const padY = 3 / camera.scale;
          const y = t.y + (t.kind === 'circle' || t.kind === 'square' ? t.length + 18 / camera.scale : 18 / camera.scale);
          tkCtx.save();
          tkCtx.font = `800 ${fontPx}px ui-sans-serif, system-ui, sans-serif`;
          tkCtx.textAlign = 'center';
          tkCtx.textBaseline = 'middle';
          const tw = tkCtx.measureText(text).width;
          tkCtx.fillStyle = aoeTargetIds.size > 0 ? 'rgba(24, 18, 6, 0.92)' : 'rgba(40, 12, 16, 0.92)';
          tkCtx.strokeStyle = aoeTargetIds.size > 0 ? 'rgba(250, 204, 21, 0.95)' : 'rgba(248, 113, 113, 0.95)';
          tkCtx.lineWidth = 1.25 / camera.scale;
          tkCtx.beginPath();
          tkCtx.rect(t.x - tw / 2 - padX, y - fontPx / 2 - padY, tw + padX * 2, fontPx + padY * 2);
          tkCtx.fill();
          tkCtx.stroke();
          tkCtx.fillStyle = aoeTargetIds.size > 0 ? 'rgb(254, 240, 138)' : 'rgb(254, 202, 202)';
          tkCtx.fillText(text, t.x, y);
          tkCtx.restore();
        }
      }
      // Nameplates / HP bars (após desenhar todas as entidades, antes da seleção)
      const charsById = (() => {
        const characters = useCharacterStore.getState().characters;
        const m: Record<string, NameplateCharacterStats> = {};
        for (const c of characters) m[c.id] = toNameplateStats(c);
        return { byId: m, characters };
      })();
      const activePid = useProfileStore.getState().activeProfileId;
      const viewerIsMaster = useRoleStore.getState().role !== 'PLAYER';
      // Helper: resolve o personagem ligado ao token (por characterId ou profileId).
      const charForEntity = (e: Entity): Character | undefined => {
        if (e.characterId) {
          const direct = charsById.characters.find((c) => c.id === e.characterId);
          if (direct) return direct;
        }
        if (e.groundItem || e.chestId) return undefined;
        const pid = e.avatarProfileId ?? e.ownerProfileId;
        if (!pid) return undefined;
        const players = charsById.characters.filter((c) => isPlayerVisibleCharacter(c) && c.profileId === pid);
        return players.length === 1 ? players[0] : undefined;
      };
      for (const id of effectiveOrder) {
        const e = entities[id];
        if (!e) continue;
        // Nomes sempre visíveis para todos (a menos que o mestre oculte via hideName).
        const forced = true;
        const live = resolveEntityNameplateStats(e, charsById.characters, charsById.byId);
        const ownsEntity = playerOwnsEntity(e, activePid, charsById.characters);
        const hideStats = !viewerIsMaster && !ownsEntity;

        // Visual de Marcação: aura amarela + ícone 🔖 acima do token quando o
        // personagem ligado tem a condição 'marcado' ativa.
        const linkedChar = charForEntity(e);
        // Arma empunhada com imagem: selo no canto inferior direito do token.
        const armaImg = linkedChar && !e.hidden ? imagemPronta(imagemArmaEmpunhada(linkedChar)) : null;
        if (armaImg) {
          const s = Math.max(14 / camera.scale, Math.min(e.w, e.h) * 0.42);
          const bx = e.x + e.w / 2 - s * 0.7, by = e.y + e.h / 2 - s * 0.7;
          tkCtx.save();
          tkCtx.fillStyle = 'rgba(12,12,16,0.85)';
          tkCtx.strokeStyle = 'rgba(250,204,21,0.9)';
          tkCtx.lineWidth = 1.5 / camera.scale;
          tkCtx.beginPath(); tkCtx.arc(bx + s / 2, by + s / 2, s / 2 + 2 / camera.scale, 0, Math.PI * 2); tkCtx.fill(); tkCtx.stroke();
          try { tkCtx.drawImage(armaImg, bx + s * 0.12, by + s * 0.12, s * 0.76, s * 0.76); } catch { /* decoding */ }
          tkCtx.restore();
        }
        const isMarked = !!linkedChar?.activeConditions?.some((c: any) => c.conditionId === 'marcado');
        if (isMarked && !e.hidden) {
          tkCtx.save();
          const radius = Math.max(e.w, e.h) / 2 + 6 / camera.scale;
          tkCtx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
          tkCtx.lineWidth = 3 / camera.scale;
          tkCtx.shadowColor = 'rgba(250, 204, 21, 0.85)';
          tkCtx.shadowBlur = 10 / camera.scale;
          tkCtx.beginPath();
          tkCtx.arc(e.x, e.y, radius, 0, Math.PI * 2);
          tkCtx.stroke();
          tkCtx.shadowBlur = 0;
          const badgePx = 16 / camera.scale;
          tkCtx.font = `${badgePx}px ui-sans-serif, system-ui, sans-serif`;
          tkCtx.textAlign = 'center';
          tkCtx.textBaseline = 'middle';
          tkCtx.fillText('🔖', e.x, e.y - radius - badgePx);
          tkCtx.restore();
        }

        const baseNameLabel = e.label || linkedChar?.name || undefined;
        const nameLabel = e.invocationState === 'caida' && baseNameLabel
          ? `${baseNameLabel} · Caído`
          : baseNameLabel;
        if (e.hidden) {
          tkCtx.save();
          tkCtx.globalAlpha = 0.4;
          drawNameplate(tkCtx, e, camera.scale, { force: forced, live, hideStats, label: nameLabel });
          tkCtx.restore();
        } else {
          drawNameplate(tkCtx, e, camera.scale, {
            force: forced || e.invocationState === 'caida',
            live,
            hideStats,
            label: nameLabel,
          });
        }
      }




      const selEntities = selectedIds
        .map((id) => entities[id])
        .filter((x): x is Entity => !!x && !x.hidden && layerVisible[x.layer ?? 'tokens']);
      if (selectionToolbarVisibleRef.current) {
        if (selEntities.length === 1) {
          drawSelection(tkCtx, selEntities[0], camera.scale);
        } else if (selEntities.length >= 2) {
          // outline fino por entidade (sem handles individuais)
          for (const e of selEntities) {
            tkCtx.save();
            tkCtx.translate(e.x, e.y);
            tkCtx.rotate(e.rotation);
            tkCtx.strokeStyle = 'rgba(120,200,255,0.85)';
            tkCtx.lineWidth = 1.5 / camera.scale;
            tkCtx.setLineDash([3 / camera.scale, 3 / camera.scale]);
            tkCtx.strokeRect(-e.w / 2, -e.h / 2, e.w, e.h);
            tkCtx.setLineDash([]);
            tkCtx.restore();
          }
          const gb = groupBBox(selEntities);
          if (gb) drawGroupBox(tkCtx, gb, camera.scale);
        }
      }

      const drag = dragRef.current;
      const ms = mouseScreenRef.current;

      // régua (sobre tudo no token layer)
      if (drag.kind === 'measure') {
        MeasureEngine.draw(tkCtx, drag.startWorld, drag.currentWorld, state.gridConfig, camera.scale);
      }

      // template preview
      if (drag.kind === 'template') {
        TemplateEngine.draw(tkCtx, drag.preview, camera.scale);
        TemplateEngine.drawLabel(tkCtx, drag.preview, state.gridConfig, camera.scale);
      }

      // Ghost de AoE pendente: segue o mouse antes do clique para o player
      // ver onde o ataque/feitiço será posicionado. Inclui leash do
      // conjurador até o cursor com distância atual/máxima.
      {
        const aoePending = state.pendingAoEPlacement;
        const mw = mouseWorldRef.current;
        if (aoePending && mw && drag.kind === 'none') {
          // Reset do offset manual quando o pending muda.
          if (aoePendingIdRef.current !== aoePending) {
            aoePendingIdRef.current = aoePending;
            aoeRotOffsetRef.current = 0;
          }
          const dpi = state.gridConfig.dpi || 70;
          const mpc = state.gridConfig.metersPerCell || 1;
          const lenPx = (aoePending.sizeMeters / mpc) * dpi;
          const wPx = ((aoePending.widthMeters ?? 1.5) / mpc) * dpi;
          const origin = aoePending.originWorld;

          const rotatablePending = isRotatableAoEKind(aoePending.kind);

          // ── LINE / CONE_ATTACHED dinâmico: parte do conjurador, mouse mira + Space+scroll rotaciona ──
          if ((aoePending.kind === 'line'…18312 tokens truncated… => {
          const fallback = { w: cfg.dpi, h: cfg.dpi };
          if (!cached) return resolve(fallback);
          if (cached.ready) {
            resolve({ w: cached.img.naturalWidth, h: cached.img.naturalHeight });
          } else {
            const t = setTimeout(() => resolve(fallback), 20000);
            cached.img.addEventListener('load', () => {
              clearTimeout(t);
              resolve({ w: cached.img.naturalWidth, h: cached.img.naturalHeight });
            });
            cached.img.addEventListener('error', () => { clearTimeout(t); resolve(fallback); });
          }
        });
        const previewUrl = URL.createObjectURL(blob);
        queued.push({
          assetId,
          name: file.name.replace(/\.[^.]+$/, '').slice(0, 48),
          previewUrl,
          dims,
          world: { x: world.x + offset, y: world.y + offset },
        });
        offset += cfg.dpi / 2;
      }
      if (queued.length) setPendingAssets((prev) => [...prev, ...queued]);
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    el.addEventListener('mouseleave', onMouseLeave);
    el.addEventListener('dblclick', onDoubleClick);
    
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);
    const onContextMenu = (ev: MouseEvent) => {
      if (!isMapSurface(ev.target)) return;
      // Posicionamento de AoE ativo: clique-direito cancela e não abre menu.
      if (store.getState().pendingAoEPlacement || store.getState().pendingInvocationPlacement) { ev.preventDefault(); return; }
      // se o usuário arrastou o ponteiro (press-and-hold), não abre o menu
      if (rightPingRef.current?.moved) { ev.preventDefault(); return; }
      if (spaceDownRef.current) { ev.preventDefault(); return; }
      const { x: wx, y: wy } = worldFromEvent(ev);
      const st = store.getState();
      // template tool: clique-direito remove o template sob o cursor
      if (activeToolRef.current === 'template') {
        ev.preventDefault();
        for (let i = st.templates.length - 1; i >= 0; i--) {
          if (TemplateEngine.hitTest({ x: wx, y: wy }, st.templates[i])) {
            st.pushHistory();
            st.removeTemplate(st.templates[i].id);
            return;
          }
        }
        return;
      }
      // measure tool: clique-direito remove a régua persistente sob o cursor
      if (activeToolRef.current === 'measure') {
        ev.preventDefault();
        const r0 = 8 / store.getState().camera.scale;
        for (let i = st.rulers.length - 1; i >= 0; i--) {
          const r = st.rulers[i];
          // distância ponto→segmento
          const vx = r.b.x - r.a.x, vy = r.b.y - r.a.y;
          const wxw = wx - r.a.x, wyw = wy - r.a.y;
          const len2 = vx * vx + vy * vy;
          let t = len2 > 0 ? (wxw * vx + wyw * vy) / len2 : 0;
          t = Math.max(0, Math.min(1, t));
          const px = r.a.x + t * vx, py = r.a.y + t * vy;
          if (Math.hypot(wx - px, wy - py) <= r0) {
            st.pushHistory();
            st.removeRuler(r.id);
            return;
          }
        }
        return;
      }
      // walls tool: clique-direito abre/fecha porta sob o cursor
      if (activeToolRef.current === 'walls') {
        ev.preventDefault();
        const hit = WallsEngine.pickAt(st.walls.filter((w) => w.kind === 'door' || w.kind === 'secret'), { x: wx, y: wy }, 12 / st.camera.scale);
        if (hit) {
          st.pushHistory();
          st.toggleDoor(hit.id);
        }
        return;
      }
      // só com a ferramenta select abre o menu de contexto de entidades
      if (activeToolRef.current !== 'select') return;
      ev.preventDefault();
      const hit = pickEntityAt(wx, wy);
      if (hit) {
        // Jogadores não podem abrir menu de contexto sobre entidades que não são deles…
        if (!canPlayerEditEntityNow(hit)) {
          // …exceto se for um corpo caído (HP<=0) — nesse caso oferece "Carregar/Soltar".
          const allChars = useCharacterStore.getState().characters;
          const hitChar = hit.characterId
            ? allChars.find((c) => c.id === hit.characterId)
            : null;
          const isDead = !!(hitChar && hitChar.hpCurrent <= 0);
          if (!isDead) return;
          const pid = useProfileStore.getState().activeProfileId;
          if (!pid) return;
          // procura o token próprio mais próximo para servir de carregador
          let carrierId: string | null = null;
          let bestD = Infinity;
          for (const e of Object.values(st.entities)) {
            if (e.id === hit.id) continue;
            if (e.ownerProfileId !== pid) continue;
            const d = Math.hypot(e.x - hit.x, e.y - hit.y);
            if (d < bestD) { bestD = d; carrierId = e.id; }
          }
          if (!carrierId) return;
          const alreadyCarried = hit.carriedBy === carrierId;
          setCtxMenu({
            x: ev.clientX,
            y: ev.clientY,
            world: { x: wx, y: wy },
            carry: { mode: alreadyCarried ? 'drop' : 'carry', targetId: hit.id, carrierId },
          });
          return;
        }
        // se a entidade clicada NÃO está na seleção, vira seleção única
        if (!st.selectedIds.includes(hit.id)) st.setSelected([hit.id]);
      } else {
        if (!st.selectedIds.length) return; // nada a fazer
        // Se o jogador tem seleção mista/alheia, filtra antes de abrir o menu.
        if (useRoleStore.getState().role === 'PLAYER') {
          const ents = st.entities;
          const ownIds = st.selectedIds.filter((id) => {
            const e = ents[id];
            return e && canPlayerEditEntityNow(e);
          });
          if (ownIds.length === 0) return;
        }
      }
      setCtxMenu({ x: ev.clientX, y: ev.clientY, world: { x: wx, y: wy } });
    };
    el.addEventListener('contextmenu', onContextMenu);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('dblclick', onDoubleClick);
      
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('drop', onDrop);
      el.removeEventListener('contextmenu', onContextMenu);
    };
  }, [withTransientCommitsPaused]);

  // ============ Ações do menu de contexto ============
  const handleCtxAction = (a: CtxMenuAction) => {
    const st = useMapStore.getState();
    // Ação especial de "Carregar/Soltar" — usa o alvo do ctxMenu, não a seleção.
    if (a === 'carry' || a === 'drop') {
      const c = ctxMenu?.carry;
      if (!c) return;
      st.pushHistory();
      st.setEntityCarriedBy(c.targetId, a === 'carry' ? c.carrierId : null);
      return;
    }
    const sel = st.selectedIds;
    if (!sel.length) return;
    const ents = sel.map((id) => st.entities[id]).filter((x): x is Entity => !!x);
    if (a === 'adjustToken') {
      const target = ents[0];
      if (target?.assetId) setTokenCropEntityId(target.id);
      return;
    }
    if (a === 'toggleHideName') {
      const target = ents[0];
      if (target) {
        st.pushHistory();
        st.updateEntity(target.id, { hideName: !target.hideName });
      }
      return;
    }
    st.pushHistory();
    if (typeof a === 'object' && a.kind === 'setLayer') {
      for (const id of sel) st.setEntityLayer(id, a.layer);
      return;
    }
    if (a === 'setMyself') {
      const pid = useProfileStore.getState().activeProfileId;
      if (!pid) {
        window.alert('Selecione/crie um perfil antes de marcar como "Eu".');
        return;
      }
      const isPlayerNow = useRoleStore.getState().role === 'PLAYER';
      // Jogador só pode ter 1 token marcado como "Sou eu": usa apenas o
      // primeiro selecionado e desmarca todos os outros do mesmo perfil.
      const targetIds = isPlayerNow ? sel.slice(0, 1) : sel;
      if (isPlayerNow) {
        for (const e of Object.values(st.entities)) {
          if ((e.avatarProfileId ?? e.ownerProfileId) === pid && !targetIds.includes(e.id)) {
            st.setEntityAvatarProfile(e.id, null);
          }
        }
      }
      // NÃO auto-vincula ficha aqui: o mestre/player precisa associar
      // a ficha manualmente para evitar bugs de atribuição indevida.
      for (const id of targetIds) {
        st.setEntityAvatarProfile(id, pid);
        if (!st.entities[id]?.ownerProfileId) st.setEntityOwnerProfile(id, pid);
      }
      if (isPlayerNow && sel.length > 1) {
        toast({ title: '"Sou eu" aplicado a 1 token', description: 'Você só pode marcar um único token como seu avatar.' });
      }
      return;
    }
    if (a === 'clearMyself') {
      for (const id of sel) st.setEntityAvatarProfile(id, null);
      return;
    }
    if (typeof a === 'object' && a.kind === 'setCharacter') {
      const pid = useProfileStore.getState().activeProfileId;
      for (const id of sel) {
        st.setEntityCharacter(id, a.characterId);
        if (a.characterId && pid && !st.entities[id]?.ownerProfileId) {
          st.setEntityOwnerProfile(id, pid);
        }
      }
      return;
    }
    // Luz e visão: apenas o mestre pode alterar
    const roleNow = useRoleStore.getState().role;
    const isGMNow = roleNow !== 'PLAYER';
    if (typeof a === 'object' && (a.kind === 'setSeer' || a.kind === 'setLight' || a.kind === 'setSeerMeters' || a.kind === 'setSeerDarkMeters' || a.kind === 'setLightMeters')) {
      if (!isGMNow) return;
    }
    if (typeof a === 'object' && a.kind === 'setSeer') {
      const v = st.vision.defaultRadiusCells;
      const radius = a.preset === 'off' ? 0
        : a.preset === 'small' ? 3
        : a.preset === 'far' ? 15
        : v;
      for (const id of sel) {
        st.setEntitySeer(id, radius > 0 ? { radius } : null);
      }
      return;
    }
    if (typeof a === 'object' && a.kind === 'setSeerMeters') {
      const mpc = st.gridConfig.metersPerCell || 1;
      const radius = Math.max(0, a.meters / mpc);
      for (const id of sel) {
        const cur = st.entities[id]?.seer;
        const darkRadius = cur?.darkRadius;
        if (radius <= 0 && !(darkRadius && darkRadius > 0)) st.setEntitySeer(id, null);
        else st.setEntitySeer(id, { radius, ...(darkRadius ? { darkRadius } : {}) });
      }
      return;
    }
    if (typeof a === 'object' && a.kind === 'setSeerDarkMeters') {
      const mpc = st.gridConfig.metersPerCell || 1;
      const darkRadius = Math.max(0, a.meters / mpc);
      for (const id of sel) {
        const cur = st.entities[id]?.seer;
        const radius = cur?.radius ?? 0;
        if (radius <= 0 && darkRadius <= 0) st.setEntitySeer(id, null);
        else st.setEntitySeer(id, { radius, ...(darkRadius > 0 ? { darkRadius } : {}) });
      }
      return;
    }
    if (typeof a === 'object' && a.kind === 'setLight') {
      const preset = LIGHT_PRESETS[a.preset];
      // ativa lighting automaticamente quando algo emite luz
      if (preset) st.setLighting({ enabled: true });
      for (const id of sel) st.setEntityLight(id, preset);
      return;
    }
    if (typeof a === 'object' && a.kind === 'setLightMeters') {
      const mpc = st.gridConfig.metersPerCell || 1;
      const radius = Math.max(0, a.meters / mpc);
      if (radius > 0) st.setLighting({ enabled: true });
      for (const id of sel) {
        if (radius <= 0) {
          st.setEntityLight(id, null);
        } else {
          const cur = st.entities[id]?.light;
          st.setEntityLight(id, {
            radius,
            color: cur?.color ?? '#ffd9a8',
            intensity: cur?.intensity ?? 1.0,
          });
        }
      }
      return;
    }
    if (typeof a === 'object' && a.kind === 'setAssetKind') {
      const cfg = st.gridConfig;
      const targets = ents.filter((e) => !!e.assetId);
      if (!targets.length) return;
      if (a.assetKind === 'map') {
        // Redimensiona para o tamanho natural e move para a camada 'map'.
        const patches = targets.map((e) => {
          const cached = e.assetId ? assetCache.get(e.assetId) : null;
          const natW = cached?.img?.naturalWidth ?? e.w;
          const natH = cached?.img?.naturalHeight ?? e.h;
          return { id: e.id, patch: { w: natW, h: natH, shape: 'RECT' as const, tokenCrop: undefined } };
        });
        st.updateEntities(patches);
        for (const t of targets) st.setEntityLayer(t.id, 'map');
        return;
      }
      const heightCells = a.assetKind === 'character' ? 1 : (cfg.defaultImageHeightM ?? 1.8);
      const targetH = Math.max(20, heightCells * cfg.dpi);
      const patches = targets.map((e) => {
        const cached = e.assetId ? assetCache.get(e.assetId) : null;
        const natW = cached?.img?.naturalWidth ?? e.w;
        const natH = cached?.img?.naturalHeight ?? e.h;
        const ratio = natH > 0 ? natW / natH : 1;
        return a.assetKind === 'character'
          ? { id: e.id, patch: { h: targetH, w: targetH, shape: 'ELLIPSE' as const, tokenCrop: { zoom: 1, offsetX: 0, offsetY: 0 } } }
          : { id: e.id, patch: { h: targetH, w: Math.max(20, targetH * ratio), shape: 'RECT' as const, tokenCrop: undefined } };
      });
      st.updateEntities(patches);
      for (const target of targets) st.setEntityLayer(target.id, 'tokens');
      if (a.assetKind === 'character' && targets.length === 1) setTokenCropEntityId(targets[0].id);
      return;
    }
    if (a === 'bringFront')   { for (const id of sel) st.bringToFront(id);   return; }
    if (a === 'sendBack')     { for (const id of sel) st.sendToBack(id);     return; }
    if (a === 'bringForward') { for (const id of sel) st.bringForward(id);   return; }
    if (a === 'sendBackward') { for (const id of sel) st.sendBackward(id);   return; }
    if (a === 'delete') {
      const assetsToRelease = sel
        .map((id) => st.entities[id]?.assetId)
        .filter((x): x is string => !!x);
      st.removeEntities(sel);
      for (const aid of assetsToRelease) void assetCache.destroy(aid);
      return;
    }
    if (a === 'rename') {
      const target = ents[0];
      if (!target) return;
      const next = window.prompt('Nome da entidade:', target.label ?? '');
      if (next === null) return;
      st.updateEntity(target.id, { label: next.trim(), nameplate: next.trim().length > 0 });
      return;
    }
    if (a === 'duplicate') {
      const off = st.gridConfig.dpi / 2;
      const newIds: string[] = [];
      for (const en of ents) {
        const nid = st.addEntity({
          ...en,
          id: undefined,
          x: en.x + off,
          y: en.y + off,
          locked: false,
        });
        newIds.push(nid);
      }
      st.setSelected(newIds);
      return;
    }
    if (a === 'lock' || a === 'unlock') {
      const locked = a === 'lock';
      st.updateEntities(sel.map((id) => ({ id, patch: { locked } })));
      return;
    }
    // align / distribute
    const alignMap: Record<string, 'left' | 'right' | 'top' | 'bottom' | 'hcenter' | 'vcenter'> = {
      alignLeft: 'left', alignRight: 'right',
      alignTop: 'top', alignBottom: 'bottom',
      alignHCenter: 'hcenter', alignVCenter: 'vcenter',
    };
    if (typeof a === 'string' && a in alignMap) {
      const patches = alignEntities(ents, alignMap[a as keyof typeof alignMap]);
      if (patches.length) st.updateEntities(patches);
      return;
    }
    if (a === 'distH') {
      const patches = distributeEntities(ents, 'horizontal').filter((p) => Object.keys(p.patch).length);
      if (patches.length) st.updateEntities(patches);
      return;
    }
    if (a === 'distV') {
      const patches = distributeEntities(ents, 'vertical').filter((p) => Object.keys(p.patch).length);
      if (patches.length) st.updateEntities(patches);
      return;
    }
    if (a === 'addInit') {
      // garante painel aberto
      st.setInitiativeOpen(true);
      const fichas = useCharacterStore.getState().characters;
      for (const en of ents) {
        const ch = en.characterId ? fichas.find((c) => c.id === en.characterId) : undefined;
        st.addInitiativeFromEntity(en.id, { side: ladoIniciativaPorFicha(ch?.category, en.layer) });
      }
      st.sortInitiative();
      return;
    }
    if (a === 'removeInit') {
      for (const en of ents) st.removeInitiativeByEntity(en.id);
      return;
    }
    if (a === 'group') {
      st.groupSelection(sel);
      return;
    }
    if (a === 'ungroup') {
      st.ungroupSelection(sel);
      return;
    }
  };

  // Altura do shell completo: imersivo ocupa viewport inteiro; senão respeita o layout do app.
  const shellHeight = immersive ? '100vh' : 'calc(100vh - 160px)';


  return (
    <div
      className="w-full flex select-none overflow-hidden"
      style={{
        height: shellHeight,
        minHeight: 480,
        background: 'hsl(var(--secondary))',
        color: 'hsl(var(--foreground))',
        borderRadius: immersive ? 0 : 6,
        border: immersive ? 'none' : '1px solid hsl(var(--border))',
      }}
    >
      {/* ============ COLUNA ESQUERDA: rail + painel contextual ============ */}
      <div className="relative h-full flex shrink-0">
        <ToolRail
          activeTool={activeTool}
          shape={shapeShape}
          onSelectTool={(id) => setActiveTool(id)}
          onPickShape={(s) => setToolSettings('shape', { shape: s })}
        />
        <ToolSettingsPanel placement="rail" />
      </div>



      {/* ============ COLUNA CENTRAL: topbar + canvas ============ */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <MapTopBar
          immersive={immersive}
          settingsOpen={gridOpen}
          layerPanelOpen={layerPanelOpen}
          onToggleSettings={() => setGridOpen((v) => !v)}
          onToggleImmersive={() => setImmersive(!immersive)}
          onToggleLayerPanel={() => setLayerPanelOpen((v) => !v)}
          onOpenHelp={() => setShortcutsOpen(true)}
        />

        


        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
          tabIndex={0}
          style={{ touchAction: 'none', background: 'hsl(var(--secondary))' }}
        >
          <ToolSettingsPanel placement="top" />
          <canvas ref={bgCanvasRef} className="absolute inset-0" style={{ zIndex: 1 }} />
          <canvas ref={tokenCanvasRef} className="absolute inset-0" style={{ zIndex: 2 }} />
          <canvas
            ref={lightCanvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 3 }}
          />

          <div
            className={`absolute inset-0 ${activeTool === 'fog' ? '' : 'pointer-events-none'}`}
            style={{ zIndex: 4 }}
          >
            <FogCanvas overlay interactive={activeTool === 'fog'} />
          </div>

          {activeTool === 'fog' && (
            <>
              <div
                className="absolute z-40 rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-2xl pointer-events-auto"
                style={{
                  top: 8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  maxWidth: 'calc(100% - 24px)',
                }}
              >
                <FogToolbar />
              </div>
              <div className="absolute right-3 top-20 z-40 w-[300px] pointer-events-auto">
                <LightSettings />
              </div>
            </>
          )}


          <NotesOverlay containerRef={containerRef as React.RefObject<HTMLDivElement>} />
          <SelectionToolbar visible={selectionToolbarVisible} onAdjustToken={setTokenCropEntityId} onEditTerrainZone={setTerrainZoneEditId} />
          <ZonaTerrenoDialog entityId={terrainZoneEditId} onClose={() => setTerrainZoneEditId(null)} />
          <PendingMoveOverlay />
          <OpportunityPromptOverlay />
          <ZonaRiscoPrompt />
          <PreparoImediatoPrompt />
          <ReplicaSustentacaoPrompt />

          <AlvoMapaOverlay />
          <PendingAoEOverlay />
          <ItemNoChaoOverlay />
          <NpcInteracaoOverlay />
          <LootOverlay />
          <ChestOverlay />

          {/* Keep panels mounted so the waiting action and expanded category survive selection. */}
          <div className={selecionandoAlvo ? 'hidden' : 'contents'}>
            <CombatBar variant="player" className="absolute top-2 right-2 z-30" />
            <CombatBar variant="master" className="absolute top-2 right-2 z-30" />
            <PlayerActionBar />
          </div>

          {layerPanelOpen && <LayerPanel onClose={() => setLayerPanelOpen(false)} />}
          <InitiativeMount />
          <DicePanel />
          {shortcutsOpen && <ShortcutsHelp onClose={() => setShortcutsOpen(false)} />}
          {tutorial.open && (
            <WelcomeTutorial
              onClose={tutorial.close}
              onOpenShortcuts={() => setShortcutsOpen(true)}
            />
          )}


          {ctxMenu && (() => {
            const st = useMapStore.getState();
            const sel = st.selectedIds.map((id) => st.entities[id]).filter(Boolean) as Entity[];
            const inInitIds = new Set(
              st.initiative.entries.map((e) => e.entityId).filter((x): x is string => !!x),
            );
            const roleNow = useRoleStore.getState().role;
            const isPlayerNow = roleNow === 'PLAYER';
            const activeProfileId = useProfileStore.getState().activeProfileId;
            const allChars = useCharacterStore.getState().characters;
            const playerChars = allChars.filter(isPlayerVisibleCharacter);
            const exactProfileChars = activeProfileId
              ? playerChars.filter((c) => c.profileId === activeProfileId)
              : [];
            const legacyProfileChars = playerChars.filter((c) => !c.profileId);
            const availableCharacters = (isPlayerNow
              ? activeProfileId
                ? (exactProfileChars.length > 0 ? exactProfileChars : legacyProfileChars)
                : playerChars
              : allChars
            ).map((c) => ({ id: c.id, name: c.name }));
            const single = sel.length === 1 ? sel[0] : null;
            const myselfActive = !!(single && activeProfileId && single.avatarProfileId === activeProfileId);
            const mpcMenu = st.gridConfig.metersPerCell || 1;
            const currentLightMeters = single?.light?.radius != null
              ? single.light.radius * mpcMenu
              : null;
            const currentSeerMeters = single?.seer?.radius != null
              ? single.seer.radius * mpcMenu
              : null;
            const currentSeerDarkMeters = single?.seer?.darkRadius != null
              ? single.seer.darkRadius * mpcMenu
              : null;
            return (
              <MapContextMenu
                x={ctxMenu.x}
                y={ctxMenu.y}
                selectionCount={sel.length}
                anyLocked={sel.some((e) => e.locked)}
                anyUnlocked={sel.some((e) => !e.locked)}
                anyInInit={sel.some((e) => inInitIds.has(e.id))}
                anyOutInit={sel.some((e) => !inInitIds.has(e.id))}
                canGroup={sel.length >= 2}
                canUngroup={sel.some((e) => !!e.groupId)}
                anyHasAsset={sel.some((e) => !!e.assetId)}
                canAdjustToken={!!single?.assetId}
                isPlayer={isPlayerNow}
                isGM={!isPlayerNow}
                myselfActive={myselfActive}
                currentCharacterId={single?.characterId ?? null}
                availableCharacters={availableCharacters}
                currentLightMeters={currentLightMeters}
                currentSeerMeters={currentSeerMeters}
                currentSeerDarkMeters={currentSeerDarkMeters}
                carryMode={ctxMenu.carry?.mode ?? null}
                nameHidden={!!single?.hideName}
                onAction={handleCtxAction}
                onClose={() => setCtxMenu(null)}
              />
            );
          })()}



          {/* HUD overlays dentro do canvas */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            {/* Zoom indicator */}
            <div
              className="absolute bottom-3 right-3 pointer-events-auto rounded-md px-2.5 py-1 text-xs text-foreground/80 tabular-nums"
              style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            >
              {Math.round(cameraScale * 100)}%
            </div>

            {/* Drop hint */}
            <div
              className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground"
              style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Arraste imagens para o mapa
            </div>

            {/* Settings popover (top-right anchored to topbar area) */}
            {gridOpen && (
              <div
                className="absolute top-2 right-3 w-72 pointer-events-auto rounded-lg p-3 text-xs space-y-3 shadow-xl"
                style={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Configurações</span>
                  <button onClick={() => setGridOpen(false)} className="text-muted-foreground hover:text-foreground">×</button>
                </div>
                <Row label="Tipo de grade">
                  <select
                    value={gridConfig.type}
                    onChange={(e) => setGridConfig({ type: e.target.value as GridType })}
                    className="bg-secondary border border-border rounded px-2 py-1 w-full text-foreground"
                  >
                    <option value="SQUARE">Quadrada</option>
                    <option value="HEX_VERTICAL">Hex (flat-top)</option>
                    <option value="HEX_HORIZONTAL">Hex (pointy-top)</option>
                    <option value="ISOMETRIC">Isométrica</option>
                  </select>
                </Row>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-muted-foreground mb-1">Tamanho da grade (m)</div>
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={Number((gridConfig.metersPerCell ?? 1.5).toFixed(2))}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v > 0) setGridConfig({ metersPerCell: v });
                      }}
                      className="w-full bg-secondary border border-border rounded px-2 py-1 text-foreground"
                    />
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Célula (px)</div>
                    <input
                      type="number"
                      min={10}
                      step={1}
                      value={gridConfig.dpi}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v > 0) setGridConfig({ dpi: v });
                      }}
                      className="w-full bg-secondary border border-border rounded px-2 py-1 text-foreground"
                    />
                  </div>
                </div>
                <Row label="Altura padrão de imagens (m)">
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={Number((gridConfig.defaultImageHeightM ?? 1.8).toFixed(2))}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v > 0) setGridConfig({ defaultImageHeightM: v });
                    }}
                    className="w-full bg-secondary border border-border rounded px-2 py-1 text-foreground"
                  />
                </Row>

                <Row label={`Largura da linha: ${gridConfig.lineWidth.toFixed(2)} px`}>
                  <input type="range" min={0.5} max={4} step={0.25}
                    value={gridConfig.lineWidth}
                    onChange={(e) => setGridConfig({ lineWidth: Number(e.target.value) })}
                    className="w-full" />
                </Row>
                <label className="flex items-center justify-between text-foreground/80">
                  <span>Snapping (encaixar na grade)</span>
                  <input
                    type="checkbox"
                    checked={gridConfig.snapping !== false}
                    onChange={(e) => setGridConfig({ snapping: e.target.checked })}
                  />
                </label>
                <Row label={`Sensibilidade do snap: ${(gridConfig.snappingSensitivity * 100).toFixed(0)}%`}>
                  <input type="range" min={0} max={1} step={0.05}
                    value={gridConfig.snappingSensitivity}
                    onChange={(e) => setGridConfig({ snappingSensitivity: Number(e.target.value) })}
                    className="w-full" />
                </Row>
                <div className="flex items-center gap-3 text-foreground/80">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={gridConfig.useCorners}
                      onChange={(e) => setGridConfig({ useCorners: e.target.checked })} />
                    Cantos
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={gridConfig.useCenter}
                      onChange={(e) => setGridConfig({ useCenter: e.target.checked })} />
                    Centro
                  </label>
                  <label className="flex items-center gap-1 ml-auto">
                    <input type="checkbox" checked={gridConfig.visible}
                      onChange={(e) => setGridConfig({ visible: e.target.checked })} />
                    Visível
                  </label>
                </div>
                <Row label="Estilo de linha">
                  <select
                    value={gridConfig.lineType}
                    onChange={(e) => setGridConfig({ lineType: e.target.value as LineType })}
                    className="bg-secondary border border-border rounded px-2 py-1 w-full text-foreground"
                  >
                    <option value="solid">Sólida</option>
                    <option value="dashed">Tracejada</option>
                    <option value="dotted">Pontilhada</option>
                  </select>
                </Row>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-muted-foreground mb-1">Cor da grade</div>
                    <input type="color" value={gridConfig.color}
                      onChange={(e) => setGridConfig({ color: e.target.value })}
                      className="h-7 w-full bg-secondary border border-border rounded" />
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Opacidade: {Math.round((gridConfig.opacity ?? 0.35) * 100)}%</div>
                    <input type="range" min={0.05} max={1} step={0.05}
                      value={gridConfig.opacity ?? 0.35}
                      onChange={(e) => setGridConfig({ opacity: Number(e.target.value) })}
                      className="w-full" />
                  </div>
                </div>

                <Row label="Medição">
                  <select
                    value={gridConfig.measurementStyle}
                    onChange={(e) => setGridConfig({ measurementStyle: e.target.value as typeof gridConfig.measurementStyle })}
                    className="bg-secondary border border-border rounded px-2 py-1 w-full text-foreground"
                  >
                    <option value="CHEBYSHEV">Chebyshev (5e)</option>
                    <option value="ALTERNATING">Alternada (3.5)</option>
                    <option value="MANHATTAN">Manhattan</option>
                    <option value="EUCLIDEAN">Euclidiana</option>
                  </select>
                </Row>
                <ViewportControls />

              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============ COLUNA DIREITA: Party ============ */}
      <PartyPanel
        collapsed={partyCollapsed}
        onToggleCollapsed={() => setPartyCollapsed(!partyCollapsed)}
      />

      {pendingAssets.length > 0 && (() => {
        const item = pendingAssets[0];
        const consume = () => setPendingAssets((prev) => prev.slice(1));
        const onChoose = (kind: AssetKind, chestId?: string) => {
          const st = useMapStore.getState();
          const cfg = st.gridConfig;
          const ratio = item.dims.h > 0 ? item.dims.w / item.dims.h : 1;
          st.pushHistory();
          if (kind === 'map') {
            // Mapa: cria entidade na camada 'map' com dimensões naturais,
            // movível como qualquer outra (basta destravar/clicar pra ajustar).
            const id = st.addEntity({
              shape: 'RECT',
              x: item.world.x, y: item.world.y,
              w: item.dims.w, h: item.dims.h,
              rotation: 0,
              color: '#ffffff',
              locked: false,
              assetId: item.assetId,
              label: item.name.slice(0, 24),
            });
            st.setEntityLayer(id, 'map');
          } else {
            const heightCells = kind === 'character' ? 1 : kind === 'chest' ? 1 : (cfg.defaultImageHeightM ?? 1.8);
            const h = Math.max(20, heightCells * cfg.dpi);
            const w = Math.max(20, h * ratio);
            const center = snapBypassRef.current
              ? item.world
              : GridEngine.snapToGrid(item.world, cfg);
            const chest = chestId ? useChestStore.getState().chests[chestId] : undefined;
            const id = st.addEntity({
              shape: kind === 'character' ? 'ELLIPSE' : 'RECT',
              x: center.x, y: center.y,
              w: kind === 'character' ? h : w, h,
              rotation: 0,
              color: '#ffffff',
              locked: kind === 'chest',
              assetId: item.assetId,
              label: (chest?.name ?? item.name).slice(0, 24),
              ...(kind === 'chest' && chestId ? { chestId, nameplate: true } : {}),
              tokenCrop: kind === 'character' ? { zoom: 1, offsetX: 0, offsetY: 0 } : undefined,
            });
            st.setSelected([id]);
            if (kind === 'character') setTokenCropEntityId(id);
          }
          consume();
        };
        return (
          <AssetTypeDialog
            name={item.name}
            previewUrl={item.previewUrl}
            onChoose={onChoose}
            onCancel={() => {
              void assetCache.destroy(item.assetId);
              consume();
            }}
          />
        );
      })()}
      {tokenCropEntityId && (() => {
        const entity = useMapStore.getState().entities[tokenCropEntityId];
        if (!entity?.assetId) return null;
        return (
          <TokenCropDialog
            entity={entity}
            onCancel={() => setTokenCropEntityId(null)}
            onConfirm={(tokenCrop, circular) => {
              const st = useMapStore.getState();
              const cached = entity.assetId ? assetCache.get(entity.assetId) : null;
              const naturalW = cached?.img?.naturalWidth ?? entity.w;
              const naturalH = cached?.img?.naturalHeight ?? entity.h;
              const size = circular ? Math.max(entity.w, entity.h) : entity.h;
              st.pushHistory();
              st.updateEntity(entity.id, { ...getTokenDisplayPatch(circular, size, naturalW, naturalH), tokenCrop });
              setTokenCropEntityId(null);
            }}
          />
        );
      })()}
    </div>
  );
}

function InitiativeMount() {
  const open = useMapStore((s) => s.initiativeOpen);
  const setOpen = useMapStore((s) => s.setInitiativeOpen);
  if (!open) return null;
  return <InitiativePanel onClose={() => setOpen(false)} />;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}

function ViewportControls() {
  const camera = useMapStore((s) => s.camera);
  const setCamera = useMapStore((s) => s.setCamera);
  const resetCamera = useMapStore((s) => s.resetCamera);
  return (
    <div className="border-t border-border pt-2 space-y-2">
      <div className="text-muted-foreground uppercase tracking-wider text-xs">Viewport</div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-muted-foreground mb-1">Pos X</div>
          <input
            type="number"
            value={Math.round(camera.x)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setCamera({ x: v });
            }}
            className="w-full bg-secondary border border-border rounded px-2 py-1 text-foreground"
          />
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Pos Y</div>
          <input
            type="number"
            value={Math.round(camera.y)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setCamera({ y: v });
            }}
            className="w-full bg-secondary border border-border rounded px-2 py-1 text-foreground"
          />
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Zoom %</div>
          <input
            type="number"
            min={5}
            max={500}
            value={Math.round(camera.scale * 100)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v > 0) setCamera({ scale: v / 100 });
            }}
            className="w-full bg-secondary border border-border rounded px-2 py-1 text-foreground"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => resetCamera()}
        className="w-full h-7 rounded border border-border hover:bg-secondary text-foreground"
      >
        Resetar viewport
      </button>
    </div>
  );
}


/** '#rrggbb' (ou rgb()) → rgba com alpha aplicado. Fallback se inválido. */
function withAlpha(color: string, alpha: number): string {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const rgb = color.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const parts = rgb[1].split(',').map((x) => x.trim());
    return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`;
  }
  return color;
}

export default MapaModule;


