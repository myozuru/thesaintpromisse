/**
 * VTT Map store — Etapas 1+2+3+4.
 *
 *  - camera: transient (não persiste).
 *  - gridConfig: persistido em localStorage.
 *  - entities: persistidas em localStorage (apenas metadados — blobs
 *    de imagens vivem no IndexedDB via assetDB, referenciados por assetId).
 *  - selectedIds/entityOrder também persistem para retomar sessão.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { rollD20 } from '@/lib/dice';
import { useProfileStore } from './useProfileStore';
import type { CombatEffect } from '@/lib/omni/tipos';


export type GridType = 'SQUARE' | 'HEX_VERTICAL' | 'HEX_HORIZONTAL' | 'ISOMETRIC';
export type LineType = 'solid' | 'dashed' | 'dotted';
export type MeasurementStyle = 'CHEBYSHEV' | 'ALTERNATING' | 'MANHATTAN' | 'EUCLIDEAN';

export interface Vector2 { x: number; y: number; }

export interface Camera {
  x: number;
  y: number;
  scale: number;
  isPanning: boolean;
}

export interface GridConfig {
  type: GridType;
  dpi: number;
  /** Quantos metros vale 1 célula (ex.: D&D 5e ≈ 1.5m). */
  metersPerCell: number;
  /** Snap habilitado globalmente (mover/redimensionar/criar formas). */
  snapping: boolean;
  snappingSensitivity: number;
  useCorners: boolean;
  useCenter: boolean;
  lineType: LineType;
  lineWidth: number;
  color: string;
  /** Opacidade das linhas de grade (0..1). */
  opacity: number;
  measurementStyle: MeasurementStyle;
  visible: boolean;
  /** Altura padrão (em metros) aplicada a novas imagens upadas. */
  defaultImageHeightM?: number;
}



export type EntityShape = 'RECT' | 'ELLIPSE';
export type EntityLayer = 'map' | 'tokens' | 'gm';
export const ENTITY_LAYERS: EntityLayer[] = ['map', 'tokens', 'gm'];

export interface TokenCrop {
  /** Escala adicional sobre o preenchimento mínimo do círculo. */
  zoom: number;
  /** Deslocamento normalizado (-100..100) dentro da sobra horizontal/vertical. */
  offsetX: number;
  offsetY: number;
  /** Estilo da moldura do token circular (ver src/lib/mapa/tokenBorders.ts). */
  border?: import('@/lib/mapa/tokenBorders').TokenBorderStyle;
}

export type GatilhoZonaTerreno = 'entrada' | 'fim_turno';

export interface ZonaTerreno {
  /** Origem identificada dos efeitos; ausente = ambiente sem autor. */
  sourceCharId?: string;
  /** null mantém a zona até ser removida pelo Mestre. */
  duracaoRodadas: number | null;
  rodadasRestantes: number | null;
  gatilhos: GatilhoZonaTerreno[];
  efeitos: CombatEffect[];
}

export interface Entity {
  /** Checkpoint persistido da última confirmação de movimento. */
  _omniMoveAt?: number;
  _omniMoveId?: string;
  /** Equipamento solto na cena, preservando o exemplar e os usos restantes. */
  groundItem?: import('@/lib/omni/itensNoChao').ItemNoChao;
  id: string;
  shape: EntityShape;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color: string;
  label?: string;
  locked: boolean;
  /** referência a um Blob armazenado no IndexedDB via assetDB */
  assetId?: string;
  /** Fallback da arte do token de uma invocação, usado quando a imagem principal não está disponível. */
  invocationFallbackAssetId?: string;
  /** Camada semântica. Default 'tokens'. */
  layer?: EntityLayer;
  /** Quando true, não renderiza nem aceita hit-test. */
  hidden?: boolean;
  /** HP atual e máximo (opcional — desenha barrinha quando ambos existem). */
  hp?: number;
  hpMax?: number;
  /** Força exibir a nameplate (label) abaixo da entidade independente de seleção. */
  nameplate?: boolean;
  /** Quando true, o nome do token fica oculto para todos (alternado pelo mestre). */
  hideName?: boolean;
  /** Fonte de luz emitida (Fase 12). Raio em CÉLULAS. */
  light?: { radius: number; color: string; intensity: number };
  /** Visão por token (Fase 12). Atualmente apenas marca o token como "vê no escuro". */
  vision?: { bright: number; dim: number };
  /** Dynamic Fog — token "vidente": raio em células (revela fog dinâmica).
   *  `radius`     = visão clara (no modo escuridão só conta dentro de áreas iluminadas).
   *  `darkRadius` = visão no escuro (atenua a neblina sem revelar completamente). */
  seer?: { radius: number; darkRadius?: number };
  /** Identificador de grupo nomeado (Fase 14). Membros do mesmo groupId são co-selecionados. */
  groupId?: string;
  /** Espelhamento horizontal da renderização (vira o token para o outro lado). */
  flipX?: boolean;
  /** Enquadramento da imagem para tokens circulares de personagem. */
  tokenCrop?: TokenCrop;
  /** ID do perfil de jogador que marcou este token como "Eu" (avatar pessoal). */
  ownerProfileId?: string;
  /** ID do perfil que marcou este token como avatar ativo; não define posse do token. */
  avatarProfileId?: string;
  /** Invocação do Controlador: proprietário e ID do catálogo. */
  ownerCharId?: string;
  invocationId?: string;
  /** IDs imutáveis do evento e da materialização desta instância. */
  invocationEventId?: string;
  invocationInstanceId?: string;
  /** Defesa e deslocamento próprios do servo (sem criar turno separado). */
  invocationDefense?: number;
  invocationMovementM?: number;
  /** ID da ficha (Character) vinculada a esta imagem/token. */
  characterId?: string;
  /** Configuração de efeito persistente aplicada quando personagens entram ou terminam o turno na zona. */
  terrainZone?: ZonaTerreno;
  /** ID de um Baú (useChestStore) vinculado a este token — transforma o token em um baú interativo. */
  chestId?: string;
  /** ID de outra Entity que está carregando este token (ex.: corpo desmaiado/morto). */
  carriedBy?: string;
}


/** ===== Dynamic Fog: Walls / Doors / Windows ===== */
export interface WallSeg {
  id: string;
  kind: 'wall' | 'door' | 'secret' | 'window' | 'terrain';
  p1: Vector2;
  p2: Vector2;
  /** Para `door` / `secret`. Default false (fechada = bloqueia). */
  open?: boolean;
}

export interface VisionState {
  /** Raio padrão (em células) usado por tokens "videntes". */
  defaultRadiusCells: number;
}

export type ToolId = 'select' | 'measure' | 'shape' | 'draw' | 'pointer' | 'note' | 'template' | 'walls' | 'fog';

export interface DrawStroke {
  id: string;
  color: string;
  /** largura em coords de mundo */
  size: number;
  points: Vector2[];
}

export interface MapNote {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

export interface MeasureSettings {
  showTotal: boolean;
}
export interface ShapeSettings {
  shape: EntityShape;
  color: string;
}
export interface DrawSettingsState {
  mode: 'pen' | 'eraser';
  color: string;
  size: number;
}
export interface PointerSettings {
  color: string;
}
export interface NoteSettings {
  color: string;
}
export interface TemplateSettings {
  kind: import('@/components/mapa/TemplateEngine').TemplateKind;
  color: string;
  opacity: number;
  /** largura padrão (em células) para line. */
  widthCells: number;
}
export interface WallsSettings {
  kind: 'wall' | 'door' | 'secret' | 'window' | 'terrain';
  shape?: 'line' | 'rect' | 'ellipse' | 'polygon';
}
export interface ToolSettingsMap {
  measure: MeasureSettings;
  shape: ShapeSettings;
  draw: DrawSettingsState;
  pointer: PointerSettings;
  note: NoteSettings;
  template: TemplateSettings;
  walls: WallsSettings;
}

/** Snapshot do "documento" (entidades, ordem, desenhos, notas, fog). */
interface DocSnap {
  entities: Record<string, Entity>;
  entityOrder: string[];
  drawings: DrawStroke[];
  notes: MapNote[];
  walls: WallSeg[];
  vision: VisionState;
  lighting: import('@/components/mapa/LightingEngine').LightingState;
}

/** Background de cena (imagem em world-space, abaixo da grade). */
export interface SceneBackground {
  assetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
}

/** ===== Iniciativa (Fase 9) ===== */
export interface InitiativeEntry {
  id: string;
  name: string;
  init: number;
  /** referência opcional a uma entidade no mapa (para realce + sync de HP) */
  entityId?: string;
  hp?: number;
  hpMax?: number;
  /** marcador de cor para distinguir lados (PCs/aliados/inimigos) */
  side?: 'pc' | 'ally' | 'enemy' | 'neutral';
  /** entrada marcada como concluída no turno atual (delay/ready). */
  done?: boolean;
}

export interface InitiativeState {
  entries: InitiativeEntry[];
  turnIndex: number;
  round: number;
}

/** Snapshot completo de uma cena. */
export interface SceneDoc {
  id: string;
  name: string;
  entities: Record<string, Entity>;
  entityOrder: string[];
  drawings: DrawStroke[];
  notes: MapNote[];
  gridConfig: GridConfig;
  camera: Camera;
  background: SceneBackground | null;
  initiative?: InitiativeState;
  templates?: import('@/components/mapa/TemplateEngine').MapTemplate[];
  rulers?: import('@/components/mapa/TemplateEngine').PersistentRuler[];
  lighting?: import('@/components/mapa/LightingEngine').LightingState;
  walls?: WallSeg[];
  vision?: VisionState;
}

const HISTORY_LIMIT = 200;
function snapshot(s: {
  entities: Record<string, Entity>;
  entityOrder: string[];
  drawings: DrawStroke[];
  notes: MapNote[];
  walls: WallSeg[];
  vision: VisionState;
  lighting: import('@/components/mapa/LightingEngine').LightingState;
}): DocSnap {
  return {
    entities: { ...s.entities },
    entityOrder: [...s.entityOrder],
    drawings: [...s.drawings],
    notes: [...s.notes],
    walls: s.walls.map((w) => ({ ...w, p1: { ...w.p1 }, p2: { ...w.p2 } })),
    vision: { ...s.vision },
    lighting: { ...s.lighting },
  };
}

interface MapState {
  camera: Camera;
  gridConfig: GridConfig;
  entities: Record<string, Entity>;
  entityOrder: string[];
  selectedIds: string[];
  /** Quando true, a aba Mapa esconde todo o chrome do app (header, log, fab, zoom). */
  immersive: boolean;
  /** Coluna direita (Party) recolhida. */
  partyCollapsed: boolean;
  /** Ferramenta ativa do rail. */
  activeTool: ToolId;
  /** Painel contextual de configurações da ferramenta (abre via clique-direito no rail). */
  settingsPanelOpen: boolean;
  /** Preferências por ferramenta (persistidas). */
  toolSettings: ToolSettingsMap;
  /** Strokes de desenho livre (persistidos). */
  drawings: DrawStroke[];

  /** ===== Histórico (Fase 7) — não persistido. ===== */
  _undo: DocSnap[];
  _redo: DocSnap[];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  setCamera: (patch: Partial<Camera>) => void;
  resetCamera: () => void;

  setGridConfig: (patch: Partial<GridConfig>) => void;

  addEntity: (e: Omit<Entity, 'id'> & { id?: string }) => string;
  updateEntity: (id: string, patch: Partial<Entity>) => void;
  updateEntities: (patches: Array<{ id: string; patch: Partial<Entity> }>) => void;
  removeEntities: (ids: string[]) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  reorderInLayer: (id: string, beforeId: string | null) => void;
  setEntityLayer: (id: string, layer: EntityLayer) => void;
  /** Visibilidade por camada (toggle do painel; UI-only por enquanto). */
  layerVisible: Record<EntityLayer, boolean>;
  setLayerVisible: (layer: EntityLayer, v: boolean) => void;

  addStroke: (s: DrawStroke) => void;
  removeStrokes: (ids: string[]) => void;
  spliceStrokes: (removeIds: string[], add: DrawStroke[]) => void;
  clearStrokes: () => void;

  notes: MapNote[];
  addNote: (n: MapNote) => void;
  updateNote: (id: string, patch: Partial<MapNote>) => void;
  removeNote: (id: string) => void;
  clearNotes: () => void;

  setSelected: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;


  setImmersive: (v: boolean) => void;
  setPartyCollapsed: (v: boolean) => void;
  setActiveTool: (id: ToolId) => void;
  setSettingsPanelOpen: (v: boolean) => void;
  setToolSettings: <K extends keyof ToolSettingsMap>(
    tool: K,
    patch: Partial<ToolSettingsMap[K]>,
  ) => void;

  /** ===== Cenas (Fase 8) ===== */
  scenes: Record<string, SceneDoc>;
  sceneOrder: string[];
  activeSceneId: string;
  background: SceneBackground | null;
  ensureScenes: () => void;
  createScene: (name?: string) => string;
  switchScene: (id: string) => void;
  renameScene: (id: string, name: string) => void;
  duplicateScene: (id: string) => string | null;
  removeScene: (id: string) => void;
  reorderScenes: (order: string[]) => void;
  setBackground: (patch: Partial<SceneBackground> | null) => void;
  /** Snapshot atualizado de uma cena (usa estado vivo p/ a ativa). */
  getSceneSnapshot: (id: string) => SceneDoc | null;
  /** Snapshot de todas as cenas (com a ativa atualizada). */
  getAllSceneSnapshots: () => SceneDoc[];
  /** Insere cenas vindas de bundle e ativa a primeira importada. */
  importScenes: (docs: SceneDoc[]) => void;

  /** ===== Movimento pendente em combate (com confirmação) ===== */
  pendingMove: null | {
    entityId: string;
    charId: string;
    startX: number;
    startY: number;
    trail: Vector2[];
    /** metros percorridos neste arrasto (preview) */
    distM: number;
  };
  setPendingMove: (v: MapState['pendingMove']) => void;

  /** ===== Iniciativa (Fase 9) ===== */
  initiative: InitiativeState;
  initiativeOpen: boolean;
  setInitiativeOpen: (v: boolean) => void;
  addInitiative: (e: Omit<InitiativeEntry, 'id'> & { id?: string }) => string;
  addInitiativeFromEntity: (entityId: string, opts?: { init?: number; side?: InitiativeEntry['side'] }) => string | null;
  updateInitiative: (id: string, patch: Partial<InitiativeEntry>) => void;
  removeInitiative: (id: string) => void;
  removeInitiativeByEntity: (entityId: string) => void;
  sortInitiative: () => void;
  rollAllInitiative: () => void;
  nextTurn: () => void;
  prevTurn: () => void;
  resetEncounter: () => void;
  clearInitiative: () => void;

  /** ===== Templates de AoE + Réguas Persistentes (Fase 11) ===== */
  templates: import('@/components/mapa/TemplateEngine').MapTemplate[];
  rulers: import('@/components/mapa/TemplateEngine').PersistentRuler[];
  aoeTargetPreview: null | { templateId: string; entityIds: string[] };
  addTemplate: (t: import('@/components/mapa/TemplateEngine').MapTemplate) => void;
  updateTemplate: (id: string, patch: Partial<import('@/components/mapa/TemplateEngine').MapTemplate>) => void;
  removeTemplate: (id: string) => void;
  clearTemplates: () => void;
  setAoETargetPreview: (v: MapState['aoeTargetPreview']) => void;
  addRuler: (r: import('@/components/mapa/TemplateEngine').PersistentRuler) => void;
  removeRuler: (id: string) => void;
  clearRulers: () => void;

  /** ===== Iluminação Dinâmica (Fase 12) ===== */
  lighting: import('@/components/mapa/LightingEngine').LightingState;
  setLighting: (patch: Partial<import('@/components/mapa/LightingEngine').LightingState>) => void;
  setEntityLight: (id: string, light: Entity['light'] | null) => void;

  /** ===== Dynamic Fog: Walls + Vision ===== */
  walls: WallSeg[];
  vision: VisionState;
  addWall: (w: WallSeg) => void;
  removeWalls: (ids: string[]) => void;
  toggleDoor: (id: string) => void;
  clearWalls: () => void;
  setVision: (patch: Partial<VisionState>) => void;
  setEntitySeer: (id: string, seer: { radius: number; darkRadius?: number } | null) => void;
  /** Marca/desmarca um token como avatar do perfil informado (passar null limpa). */
  setEntityOwnerProfile: (id: string, profileId: string | null) => void;
  /** Marca/desmarca um token como "Sou eu" sem remover a posse de outras imagens. */
  setEntityAvatarProfile: (id: string, profileId: string | null) => void;
  /** Liga uma ficha (Character) ao token (passar null desliga). */
  setEntityCharacter: (id: string, characterId: string | null) => void;
  /** Define quem está carregando este token (passar null para soltar). */
  setEntityCarriedBy: (id: string, carrierId: string | null) => void;

  /** ===== Grupos nomeados (Fase 14) ===== */
  groupSelection: (ids: string[]) => string | null;
  ungroupSelection: (ids: string[]) => void;
  expandToGroups: (ids: string[]) => string[];

  /** ===== Posicionamento pendente de AoE (Ataque em Área) ===== */
  pendingAoEPlacement: null | {
    kind: import('@/components/mapa/TemplateEngine').TemplateKind;
    sizeMeters: number;
    widthMeters?: number;
    sourceLabel: string;
    color: string;
    /** Token de origem (centro do conjurador/atacante) em coordenadas-mundo. */
    originWorld?: { x: number; y: number };
    /** Alcance máximo em metros (centro→centro). */
    maxRangeMeters?: number;
  };
  requestAoEPlacement: (
    opts: {
      kind: import('@/components/mapa/TemplateEngine').TemplateKind;
      sizeMeters: number;
      widthMeters?: number;
      sourceLabel: string;
      color?: string;
      originWorld?: { x: number; y: number };
      maxRangeMeters?: number;
    },
  ) => Promise<import('@/components/mapa/TemplateEngine').MapTemplate | null>;
  resolveAoEPlacement: (
    template: import('@/components/mapa/TemplateEngine').MapTemplate | null,
  ) => void;



  /** ===== Mira de feitiço single-target (linha que segue o mouse) ===== */
  singleTargetAim: null | {
    originWorld: { x: number; y: number };
    maxRangeMeters?: number;
    color?: string;
    label?: string;
    /** Chamado quando o usuário cancela a mira (ESC ou botão direito no mapa). */
    onCancel?: () => void;
  };
  setSingleTargetAim: (v: MapState['singleTargetAim']) => void;
}



const defaultCamera: Camera = { x: 0, y: 0, scale: 1, isPanning: false };

const defaultGrid: GridConfig = {
  type: 'SQUARE',
  dpi: 70,
  metersPerCell: 1,
  snapping: true,
  snappingSensitivity: 0.45,
  useCorners: true,
  useCenter: true,
  lineType: 'solid',
  lineWidth: 1,
  color: '#ffffff',
  opacity: 0.35,
  measurementStyle: 'CHEBYSHEV',
  visible: true,
  defaultImageHeightM: 1.8,
};




const defaultVision: VisionState = { defaultRadiusCells: 6 };
const defaultLightingState: import('@/components/mapa/LightingEngine').LightingState = {
  enabled: false,
  ambient: 0.78,
  color: '#05060a',
};

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

// Resolver da Promise de posicionamento AoE — fora do store para não persistir.
let _pendingAoEResolver:
  | ((t: import('@/components/mapa/TemplateEngine').MapTemplate | null) => void)
  | null = null;

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => ({
      camera: { ...defaultCamera },
      gridConfig: { ...defaultGrid },
      entities: {},
      entityOrder: [],
      selectedIds: [],

      _undo: [],
      _redo: [],
      pushHistory: () => {
        const s = get();
        const snap = snapshot(s);
        const next = [...s._undo, snap];
        if (next.length > HISTORY_LIMIT) next.splice(0, next.length - HISTORY_LIMIT);
        set({ _undo: next, _redo: [] });
      },
      undo: () => {
        const s = get();
        if (!s._undo.length) return;
        const prev = s._undo[s._undo.length - 1];
        const cur = snapshot(s);
        set({
          entities: prev.entities,
          entityOrder: prev.entityOrder,
          drawings: prev.drawings,
          notes: prev.notes,
          walls: prev.walls,
          vision: prev.vision,
          lighting: prev.lighting,
          _undo: s._undo.slice(0, -1),
          _redo: [...s._redo, cur],
          selectedIds: s.selectedIds.filter((id) => prev.entities[id]),
        });
      },
      redo: () => {
        const s = get();
        if (!s._redo.length) return;
        const next = s._redo[s._redo.length - 1];
        const cur = snapshot(s);
        set({
          entities: next.entities,
          entityOrder: next.entityOrder,
          drawings: next.drawings,
          notes: next.notes,
          walls: next.walls,
          vision: next.vision,
          lighting: next.lighting,
          _undo: [...s._undo, cur],
          _redo: s._redo.slice(0, -1),
          selectedIds: s.selectedIds.filter((id) => next.entities[id]),
        });
      },
      clearHistory: () => set({ _undo: [], _redo: [] }),


      setCamera: (patch) => set((s) => ({ camera: { ...s.camera, ...patch } })),
      resetCamera: () => set({ camera: { ...defaultCamera } }),

      setGridConfig: (patch) => set((s) => ({ gridConfig: { ...s.gridConfig, ...patch } })),

      addEntity: (e) => {
        const id = e.id ?? uid();
        // Marca dono pelo perfil ativo quando não vier explícito,
        // para que jogadores só consigam manipular o que eles mesmos colocaram.
        let ownerProfileId = e.ownerProfileId;
        if (!ownerProfileId) {
          const pid = useProfileStore.getState().activeProfileId;
          if (pid) ownerProfileId = pid;
        }
        const full = { ...e, id, ...(ownerProfileId ? { ownerProfileId } : {}) } as Entity;
        set((s) => ({
          entities: { ...s.entities, [id]: full },
          entityOrder: [...s.entityOrder, id],
        }));
        return id;
      },
      updateEntity: (id, patch) =>
        set((s) => {
          const cur = s.entities[id];
          if (!cur) return {};
          const entities = { ...s.entities, [id]: { ...cur, ...patch } };
          // Propaga movimento para tokens carregados (carriedBy === id).
          const dx = typeof patch.x === 'number' ? patch.x - cur.x : 0;
          const dy = typeof patch.y === 'number' ? patch.y - cur.y : 0;
          if (dx !== 0 || dy !== 0) {
            for (const e of Object.values(s.entities)) {
              if (e.carriedBy === id) {
                entities[e.id] = { ...e, x: e.x + dx, y: e.y + dy };
              }
            }
          }
          // sync para iniciativa se a entidade estiver listada
          let initiative = s.initiative;
          if (
            'hp' in patch || 'hpMax' in patch || 'label' in patch
          ) {
            const idx = s.initiative.entries.findIndex((e) => e.entityId === id);
            if (idx >= 0) {
              const next = [...s.initiative.entries];
              const cur = next[idx];
              next[idx] = {
                ...cur,
                hp: 'hp' in patch ? patch.hp : cur.hp,
                hpMax: 'hpMax' in patch ? patch.hpMax : cur.hpMax,
                name: 'label' in patch && patch.label !== undefined
                  ? (patch.label.trim() || cur.name)
                  : cur.name,
              };
              initiative = { ...s.initiative, entries: next };
            }
          }
          return { entities, initiative };
        }),
      updateEntities: (patches) =>
        set((s) => {
          const next = { ...s.entities };
          // Aplica patches diretos.
          for (const { id, patch } of patches) {
            const cur = next[id];
            if (cur) next[id] = { ...cur, ...patch };
          }
          // Propaga deltas de posição para tokens carregados pelos afetados.
          const deltas = new Map<string, { dx: number; dy: number }>();
          for (const { id, patch } of patches) {
            const prev = s.entities[id];
            if (!prev) continue;
            const dx = typeof patch.x === 'number' ? patch.x - prev.x : 0;
            const dy = typeof patch.y === 'number' ? patch.y - prev.y : 0;
            if (dx !== 0 || dy !== 0) deltas.set(id, { dx, dy });
          }
          if (deltas.size > 0) {
            for (const e of Object.values(s.entities)) {
              if (!e.carriedBy) continue;
              const d = deltas.get(e.carriedBy);
              if (!d) continue;
              const cur = next[e.id] ?? e;
              next[e.id] = { ...cur, x: cur.x + d.dx, y: cur.y + d.dy };
            }
          }
          return { entities: next };
        }),
      removeEntities: (ids) =>
        set((s) => {
          const next = { ...s.entities };
          for (const id of ids) delete next[id];
          const idSet = new Set(ids);
          const initEntries = s.initiative.entries.filter(
            (e) => !e.entityId || !idSet.has(e.entityId),
          );
          return {
            entities: next,
            entityOrder: s.entityOrder.filter((x) => !ids.includes(x)),
            selectedIds: s.selectedIds.filter((x) => !ids.includes(x)),
            initiative: {
              ...s.initiative,
              entries: initEntries,
              turnIndex: Math.min(
                s.initiative.turnIndex,
                Math.max(0, initEntries.length - 1),
              ),
            },
          };
        }),
      bringToFront: (id) =>
        set((s) => {
          const layer = s.entities[id]?.layer ?? 'tokens';
          const sameLayer = s.entityOrder.filter(
            (x) => x !== id && (s.entities[x]?.layer ?? 'tokens') === layer,
          );
          const others = s.entityOrder.filter(
            (x) => x !== id && (s.entities[x]?.layer ?? 'tokens') !== layer,
          );
          // dentro da camada: id vai pro fim; outras camadas mantêm posição relativa.
          // estratégia simples: remove id, anexa após o último mesmo-layer existente.
          const arr = s.entityOrder.filter((x) => x !== id);
          let lastSameIdx = -1;
          for (let i = 0; i < arr.length; i++) {
            if ((s.entities[arr[i]]?.layer ?? 'tokens') === layer) lastSameIdx = i;
          }
          arr.splice(lastSameIdx + 1, 0, id);
          void sameLayer; void others;
          return { entityOrder: arr };
        }),
      sendToBack: (id) =>
        set((s) => {
          const layer = s.entities[id]?.layer ?? 'tokens';
          const arr = s.entityOrder.filter((x) => x !== id);
          let firstSameIdx = arr.length;
          for (let i = 0; i < arr.length; i++) {
            if ((s.entities[arr[i]]?.layer ?? 'tokens') === layer) { firstSameIdx = i; break; }
          }
          arr.splice(firstSameIdx, 0, id);
          return { entityOrder: arr };
        }),
      bringForward: (id) =>
        set((s) => {
          const layer = s.entities[id]?.layer ?? 'tokens';
          const idx = s.entityOrder.indexOf(id);
          if (idx < 0) return {};
          for (let i = idx + 1; i < s.entityOrder.length; i++) {
            if ((s.entities[s.entityOrder[i]]?.layer ?? 'tokens') === layer) {
              const arr = [...s.entityOrder];
              [arr[idx], arr[i]] = [arr[i], arr[idx]];
              return { entityOrder: arr };
            }
          }
          return {};
        }),
      sendBackward: (id) =>
        set((s) => {
          const layer = s.entities[id]?.layer ?? 'tokens';
          const idx = s.entityOrder.indexOf(id);
          if (idx < 0) return {};
          for (let i = idx - 1; i >= 0; i--) {
            if ((s.entities[s.entityOrder[i]]?.layer ?? 'tokens') === layer) {
              const arr = [...s.entityOrder];
              [arr[idx], arr[i]] = [arr[i], arr[idx]];
              return { entityOrder: arr };
            }
          }
          return {};
        }),
      reorderInLayer: (id, beforeId) =>
        set((s) => {
          if (id === beforeId) return {};
          const arr = s.entityOrder.filter((x) => x !== id);
          if (beforeId === null) {
            arr.push(id);
          } else {
            const i = arr.indexOf(beforeId);
            if (i < 0) arr.push(id); else arr.splice(i, 0, id);
          }
          return { entityOrder: arr };
        }),
      setEntityLayer: (id, layer) =>
        set((s) => {
          const cur = s.entities[id];
          if (!cur) return {};
          return { entities: { ...s.entities, [id]: { ...cur, layer } } };
        }),

      layerVisible: { map: true, tokens: true, gm: true },
      setLayerVisible: (layer, v) =>
        set((s) => ({ layerVisible: { ...s.layerVisible, [layer]: v } })),

      setSelected: (ids) => set({ selectedIds: ids }),
      toggleSelected: (id) =>
        set((s) => ({
          selectedIds: s.selectedIds.includes(id)
            ? s.selectedIds.filter((x) => x !== id)
            : [...s.selectedIds, id],
        })),
      clearSelection: () => set({ selectedIds: [] }),


      immersive: false,
      setImmersive: (v) => set({ immersive: v }),
      partyCollapsed: false,
      setPartyCollapsed: (v) => set({ partyCollapsed: v }),

      activeTool: 'select',
      settingsPanelOpen: false,
      toolSettings: {
        measure: { showTotal: true },
        shape: { shape: 'RECT', color: '#7cc4ff' },
        draw: { mode: 'pen', color: '#ffd166', size: 4 },
        pointer: { color: '#ff5577' },
        note: { color: '#ffd166' },
        template: { kind: 'circle', color: '#ff7e5f', opacity: 1, widthCells: 1 },
        walls: { kind: 'wall' },
      },
      setActiveTool: (id) => set({ activeTool: id }),
      setSettingsPanelOpen: (v) => set({ settingsPanelOpen: v }),
      setToolSettings: (tool, patch) =>
        set((s) => ({
          toolSettings: {
            ...s.toolSettings,
            [tool]: { ...s.toolSettings[tool], ...patch },
          },
        })),

      drawings: [],
      addStroke: (s) => set((st) => ({ drawings: [...st.drawings, s] })),
      removeStrokes: (ids) =>
        set((st) => ({ drawings: st.drawings.filter((d) => !ids.includes(d.id)) })),
      spliceStrokes: (removeIds, add) =>
        set((st) => ({
          drawings: [...st.drawings.filter((d) => !removeIds.includes(d.id)), ...add],
        })),
      clearStrokes: () => set({ drawings: [] }),

      notes: [],
      addNote: (n) => set((st) => ({ notes: [...st.notes, n] })),
      updateNote: (id, patch) =>
        set((st) => ({
          notes: st.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
        })),
      removeNote: (id) => set((st) => ({ notes: st.notes.filter((n) => n.id !== id) })),
      clearNotes: () => set({ notes: [] }),

      // ===== Cenas (Fase 8) =====
      scenes: {},
      sceneOrder: [],
      activeSceneId: '',
      background: null,

      ensureScenes: () => {
        const s = get();
        if (s.sceneOrder.length && s.activeSceneId && s.scenes[s.activeSceneId]) return;
        const id = uid();
        const doc: SceneDoc = {
          id,
          name: 'Cena 1',
          entities: { ...s.entities },
          entityOrder: [...s.entityOrder],
          drawings: [...s.drawings],
          notes: [...s.notes],
          gridConfig: { ...s.gridConfig },
          camera: { ...s.camera },
          background: s.background,
          initiative: s.initiative,
          templates: [...s.templates],
          rulers: [...s.rulers],
          lighting: { ...s.lighting },
          walls: s.walls.map((w) => ({ ...w, p1: { ...w.p1 }, p2: { ...w.p2 } })),
          vision: { ...s.vision },
        };
        set({ scenes: { [id]: doc }, sceneOrder: [id], activeSceneId: id });
      },

      createScene: (name) => {
        const s = get();
        // snapshot atual
        const curId = s.activeSceneId;
        const scenes = { ...s.scenes };
        if (curId && scenes[curId]) {
          scenes[curId] = {
            ...scenes[curId],
            entities: { ...s.entities },
            entityOrder: [...s.entityOrder],
            drawings: [...s.drawings],
            notes: [...s.notes],
            gridConfig: { ...s.gridConfig },
            camera: { ...s.camera },
            background: s.background,
            initiative: s.initiative,
            templates: [...s.templates],
            rulers: [...s.rulers],
            lighting: { ...s.lighting },
            walls: s.walls.map((w) => ({ ...w, p1: { ...w.p1 }, p2: { ...w.p2 } })),
            vision: { ...s.vision },
          };
        }
        const id = uid();
        const nextName = name?.trim() || `Cena ${s.sceneOrder.length + 1}`;
        const doc: SceneDoc = {
          id,
          name: nextName,
          entities: {},
          entityOrder: [],
          drawings: [],
          notes: [],
          gridConfig: { ...defaultGrid },
          camera: { ...defaultCamera },
          background: null,
          initiative: { entries: [], turnIndex: 0, round: 1 },
          templates: [],
          rulers: [],
          lighting: { ...defaultLightingState },
          walls: [],
          vision: { ...defaultVision },
        };
        scenes[id] = doc;
        set({
          scenes,
          sceneOrder: [...s.sceneOrder, id],
          activeSceneId: id,
          entities: {},
          entityOrder: [],
          drawings: [],
          notes: [],
          gridConfig: { ...defaultGrid },
          camera: { ...defaultCamera },
          background: null,
          selectedIds: [],
          initiative: { entries: [], turnIndex: 0, round: 1 },
          templates: [],
          rulers: [],
          lighting: { ...defaultLightingState },
          walls: [],
          vision: { ...defaultVision },
          _undo: [],
          _redo: [],
        });
        return id;
      },

      switchScene: (id) => {
        const s = get();
        if (id === s.activeSceneId) return;
        const target = s.scenes[id];
        if (!target) return;
        const scenes = { ...s.scenes };
        if (s.activeSceneId && scenes[s.activeSceneId]) {
          scenes[s.activeSceneId] = {
            ...scenes[s.activeSceneId],
            entities: { ...s.entities },
            entityOrder: [...s.entityOrder],
            drawings: [...s.drawings],
            notes: [...s.notes],
            gridConfig: { ...s.gridConfig },
            camera: { ...s.camera },
            background: s.background,
            initiative: s.initiative,
            templates: [...s.templates],
            rulers: [...s.rulers],
            lighting: { ...s.lighting },
            walls: s.walls.map((w) => ({ ...w, p1: { ...w.p1 }, p2: { ...w.p2 } })),
            vision: { ...s.vision },
          };
        }
        set({
          scenes,
          activeSceneId: id,
          entities: { ...target.entities },
          entityOrder: [...target.entityOrder],
          drawings: [...target.drawings],
          notes: [...target.notes],
          gridConfig: { ...target.gridConfig },
          camera: { ...target.camera },
          background: target.background,
          initiative: target.initiative ?? { entries: [], turnIndex: 0, round: 1 },
          templates: target.templates ? target.templates.map((t) => ({ ...t })) : [],
          rulers: target.rulers ? target.rulers.map((r) => ({ ...r })) : [],
          lighting: { ...(target.lighting ?? defaultLightingState) },
          walls: (target.walls ?? []).map((wall) => ({ ...wall, p1: { ...wall.p1 }, p2: { ...wall.p2 } })),
          vision: { ...(target.vision ?? defaultVision) },
          selectedIds: [],
          _undo: [],
          _redo: [],
        });
      },

      renameScene: (id, name) =>
        set((s) => {
          const sc = s.scenes[id];
          if (!sc) return {};
          return { scenes: { ...s.scenes, [id]: { ...sc, name: name.slice(0, 60) } } };
        }),

      duplicateScene: (id) => {
        const s = get();
        const src = s.scenes[id];
        if (!src) return null;
        // snapshot atual no caso de duplicar a cena ativa
        const scenes = { ...s.scenes };
        if (s.activeSceneId && scenes[s.activeSceneId]) {
          scenes[s.activeSceneId] = {
            ...scenes[s.activeSceneId],
            entities: { ...s.entities },
            entityOrder: [...s.entityOrder],
            drawings: [...s.drawings],
            notes: [...s.notes],
            gridConfig: { ...s.gridConfig },
            camera: { ...s.camera },
            background: s.background,
            initiative: s.initiative,
            templates: [...s.templates],
            rulers: [...s.rulers],
            lighting: { ...s.lighting },
            walls: s.walls.map((w) => ({ ...w, p1: { ...w.p1 }, p2: { ...w.p2 } })),
            vision: { ...s.vision },
          };
        }
        const srcEff = scenes[id] ?? src;
        const newId = uid();
        const idMap: Record<string, string> = {};
        const newEnts: Record<string, Entity> = {};
        for (const eid of Object.keys(srcEff.entities)) {
          const ne = uid();
          idMap[eid] = ne;
          newEnts[ne] = { ...srcEff.entities[eid], id: ne };
        }
        const doc: SceneDoc = {
          id: newId,
          name: `${srcEff.name} (cópia)`,
          entities: newEnts,
          entityOrder: srcEff.entityOrder.map((x) => idMap[x]).filter(Boolean),
          drawings: srcEff.drawings.map((d) => ({ ...d, points: d.points.map((p) => ({ ...p })) })),
          notes: srcEff.notes.map((n) => ({ ...n })),
          gridConfig: { ...srcEff.gridConfig },
          camera: { ...srcEff.camera },
          background: srcEff.background ? { ...srcEff.background } : null,
          initiative: srcEff.initiative
            ? {
                entries: srcEff.initiative.entries.map((e) => ({
                  ...e,
                  entityId: e.entityId ? idMap[e.entityId] : undefined,
                })),
                turnIndex: srcEff.initiative.turnIndex,
                round: srcEff.initiative.round,
              }
            : { entries: [], turnIndex: 0, round: 1 },
          templates: (srcEff.templates ?? []).map((t) => ({ ...t, id: uid() })),
          rulers: (srcEff.rulers ?? []).map((r) => ({ ...r, id: uid(), a: { ...r.a }, b: { ...r.b } })),
          lighting: { ...(srcEff.lighting ?? defaultLightingState) },
          walls: (srcEff.walls ?? []).map((wall) => ({ ...wall, id: uid(), p1: { ...wall.p1 }, p2: { ...wall.p2 } })),
          vision: { ...(srcEff.vision ?? defaultVision) },
        };
        scenes[newId] = doc;
        const insertAt = s.sceneOrder.indexOf(id);
        const sceneOrder = [...s.sceneOrder];
        sceneOrder.splice(insertAt + 1, 0, newId);
        set({ scenes, sceneOrder });
        return newId;
      },

      removeScene: (id) => {
        const s = get();
        if (s.sceneOrder.length <= 1) return;
        const scenes = { ...s.scenes };
        delete scenes[id];
        const sceneOrder = s.sceneOrder.filter((x) => x !== id);
        if (id === s.activeSceneId) {
          const nextId = sceneOrder[0];
          const target = scenes[nextId];
          set({
            scenes,
            sceneOrder,
            activeSceneId: nextId,
            entities: { ...target.entities },
            entityOrder: [...target.entityOrder],
            drawings: [...target.drawings],
            notes: [...target.notes],
            gridConfig: { ...target.gridConfig },
            camera: { ...target.camera },
            background: target.background,
            initiative: target.initiative ?? { entries: [], turnIndex: 0, round: 1 },
            templates: target.templates ? target.templates.map((t) => ({ ...t })) : [],
            rulers: target.rulers ? target.rulers.map((r) => ({ ...r })) : [],
            lighting: { ...(target.lighting ?? defaultLightingState) },
            walls: (target.walls ?? []).map((wall) => ({ ...wall, p1: { ...wall.p1 }, p2: { ...wall.p2 } })),
            vision: { ...(target.vision ?? defaultVision) },
            selectedIds: [],
            _undo: [],
            _redo: [],
          });
        } else {
          set({ scenes, sceneOrder });
        }
      },

      reorderScenes: (order) => set({ sceneOrder: order }),

      setBackground: (patch) =>
        set((s) => {
          if (patch === null) return { background: null };
          if (!s.background) {
            if (!patch.assetId) return {};
            return {
              background: {
                assetId: patch.assetId,
                x: patch.x ?? 0,
                y: patch.y ?? 0,
                w: patch.w ?? 1000,
                h: patch.h ?? 1000,
                rotation: patch.rotation ?? 0,
                opacity: patch.opacity ?? 1,
              },
            };
          }
          return { background: { ...s.background, ...patch } };
        }),

      getSceneSnapshot: (id) => {
        const s = get();
        if (id === s.activeSceneId) {
          const base = s.scenes[id];
          if (!base) return null;
          return {
            ...base,
            entities: { ...s.entities },
            entityOrder: [...s.entityOrder],
            drawings: [...s.drawings],
            notes: [...s.notes],
            gridConfig: { ...s.gridConfig },
            camera: { ...s.camera },
            background: s.background,
            initiative: s.initiative,
            templates: [...s.templates],
            rulers: [...s.rulers],
            lighting: { ...s.lighting },
            walls: s.walls.map((w) => ({ ...w, p1: { ...w.p1 }, p2: { ...w.p2 } })),
            vision: { ...s.vision },
          };
        }
        return s.scenes[id] ?? null;
      },

      getAllSceneSnapshots: () => {
        const s = get();
        return s.sceneOrder
          .map((id) => get().getSceneSnapshot(id))
          .filter((x): x is SceneDoc => !!x);
      },

      importScenes: (docs) => {
        const s = get();
        if (!docs.length) return;
        // snapshot da cena ativa antes de inserir
        const scenes = { ...s.scenes };
        if (s.activeSceneId && scenes[s.activeSceneId]) {
          scenes[s.activeSceneId] = {
            ...scenes[s.activeSceneId],
            entities: { ...s.entities },
            entityOrder: [...s.entityOrder],
            drawings: [...s.drawings],
            notes: [...s.notes],
            gridConfig: { ...s.gridConfig },
            camera: { ...s.camera },
            background: s.background,
            initiative: s.initiative,
            templates: [...s.templates],
            rulers: [...s.rulers],
            lighting: { ...s.lighting },
            walls: s.walls.map((w) => ({ ...w, p1: { ...w.p1 }, p2: { ...w.p2 } })),
            vision: { ...s.vision },
          };
        }
        const sceneOrder = [...s.sceneOrder];
        for (const d of docs) {
          scenes[d.id] = d;
          sceneOrder.push(d.id);
        }
        const first = docs[0];
        set({
          scenes,
          sceneOrder,
          activeSceneId: first.id,
          entities: { ...first.entities },
          entityOrder: [...first.entityOrder],
          drawings: [...first.drawings],
          notes: [...first.notes],
          gridConfig: { ...first.gridConfig },
          camera: { ...first.camera },
          background: first.background,
          initiative: first.initiative ?? { entries: [], turnIndex: 0, round: 1 },
          templates: first.templates ? first.templates.map((t) => ({ ...t })) : [],
          rulers: first.rulers ? first.rulers.map((r) => ({ ...r })) : [],
            lighting: { ...(first.lighting ?? defaultLightingState) },
            walls: (first.walls ?? []).map((wall) => ({ ...wall, p1: { ...wall.p1 }, p2: { ...wall.p2 } })),
            vision: { ...(first.vision ?? defaultVision) },
          selectedIds: [],
          _undo: [],
          _redo: [],
        });
      },

      // ===== Iniciativa (Fase 9) =====
      initiative: { entries: [], turnIndex: 0, round: 1 },
      initiativeOpen: false,
      pendingMove: null,
      setPendingMove: (v) => set({ pendingMove: v }),
      setInitiativeOpen: (v) => set({ initiativeOpen: v }),

      addInitiative: (e) => {
        const id = e.id ?? uid();
        set((s) => ({
          initiative: {
            ...s.initiative,
            entries: [...s.initiative.entries, { ...e, id }],
          },
        }));
        return id;
      },

      addInitiativeFromEntity: (entityId, opts) => {
        const s = get();
        const en = s.entities[entityId];
        if (!en) return null;
        // evita duplicar
        const exists = s.initiative.entries.find((x) => x.entityId === entityId);
        if (exists) return exists.id;
        const explicitInit = opts?.init;
        const init = explicitInit ?? 0; // placeholder; rolamos via 3D logo abaixo se não veio explícito
        const id = uid();
        const side: InitiativeEntry['side'] = opts?.side
          ?? (en.layer === 'gm' ? 'enemy' : 'pc');
        const entry: InitiativeEntry = {
          id,
          name: en.label?.trim() || 'Sem nome',
          init,
          entityId,
          hp: en.hp,
          hpMax: en.hpMax,
          side,
        };
        set({
          initiative: {
            ...s.initiative,
            entries: [...s.initiative.entries, entry],
          },
        });
        if (explicitInit == null) {
          // Rolagem 3D oficial — atualiza a entrada quando o dado parar.
          void rollD20().then((value) => {
            const st = get();
            set({
              initiative: {
                ...st.initiative,
                entries: st.initiative.entries.map((e) =>
                  e.id === id ? { ...e, init: value } : e,
                ),
              },
            });
          });
        }
        return id;
      },


      updateInitiative: (id, patch) =>
        set((s) => ({
          initiative: {
            ...s.initiative,
            entries: s.initiative.entries.map((e) =>
              e.id === id ? { ...e, ...patch } : e,
            ),
          },
        })),

      removeInitiative: (id) =>
        set((s) => {
          const entries = s.initiative.entries.filter((e) => e.id !== id);
          const turnIndex = Math.min(s.initiative.turnIndex, Math.max(0, entries.length - 1));
          return { initiative: { ...s.initiative, entries, turnIndex } };
        }),

      removeInitiativeByEntity: (entityId) =>
        set((s) => {
          const entries = s.initiative.entries.filter((e) => e.entityId !== entityId);
          if (entries.length === s.initiative.entries.length) return {};
          const turnIndex = Math.min(s.initiative.turnIndex, Math.max(0, entries.length - 1));
          return { initiative: { ...s.initiative, entries, turnIndex } };
        }),

      sortInitiative: () =>
        set((s) => {
          const activeId = s.initiative.entries[s.initiative.turnIndex]?.id;
          const entries = [...s.initiative.entries].sort((a, b) => b.init - a.init);
          const turnIndex = Math.max(0, entries.findIndex((e) => e.id === activeId));
          return { initiative: { ...s.initiative, entries, turnIndex } };
        }),

      rollAllInitiative: () => {
        const s = get();
        const ids = s.initiative.entries.map((e) => e.id);
        if (ids.length === 0) return;
        // Roda 1 d20 por entrada na bandeja 3D oficial.
        void (async () => {
          const results: number[] = [];
          for (let i = 0; i < ids.length; i++) {
            results.push(await rollD20());
          }
          const st = get();
          const updated = st.initiative.entries.map((e) => {
            const idx = ids.indexOf(e.id);
            return idx >= 0 ? { ...e, init: results[idx] } : e;
          });
          updated.sort((a, b) => b.init - a.init);
          set({ initiative: { entries: updated, turnIndex: 0, round: 1 } });
        })();
      },


      nextTurn: () =>
        set((s) => {
          const n = s.initiative.entries.length;
          if (!n) return {};
          const next = s.initiative.turnIndex + 1;
          if (next >= n) {
            // limpa flag "done" no início do novo round
            const entries = s.initiative.entries.map((e) => ({ ...e, done: false }));
            return { initiative: { entries, turnIndex: 0, round: s.initiative.round + 1 } };
          }
          return { initiative: { ...s.initiative, turnIndex: next } };
        }),

      prevTurn: () =>
        set((s) => {
          const n = s.initiative.entries.length;
          if (!n) return {};
          const prev = s.initiative.turnIndex - 1;
          if (prev < 0) {
            const round = Math.max(1, s.initiative.round - 1);
            return { initiative: { ...s.initiative, turnIndex: n - 1, round } };
          }
          return { initiative: { ...s.initiative, turnIndex: prev } };
        }),

      resetEncounter: () =>
        set((s) => ({
          initiative: {
            entries: s.initiative.entries.map((e) => ({ ...e, done: false })),
            turnIndex: 0,
            round: 1,
          },
        })),

      clearInitiative: () =>
        set({ initiative: { entries: [], turnIndex: 0, round: 1 } }),

      // ===== Templates + Réguas (Fase 11) =====
      templates: [],
      rulers: [],
      aoeTargetPreview: null,
      addTemplate: (t) => set((s) => ({ templates: [...s.templates, t] })),
      updateTemplate: (id, patch) =>
        set((s) => ({
          templates: s.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeTemplate: (id) =>
        set((s) => ({
          templates: s.templates.filter((t) => t.id !== id),
          aoeTargetPreview: s.aoeTargetPreview?.templateId === id ? null : s.aoeTargetPreview,
        })),
      clearTemplates: () => set({ templates: [], aoeTargetPreview: null }),
      setAoETargetPreview: (v) => set({ aoeTargetPreview: v }),
      addRuler: (r) => set((s) => ({ rulers: [...s.rulers, r] })),
      removeRuler: (id) =>
        set((s) => ({ rulers: s.rulers.filter((r) => r.id !== id) })),
      clearRulers: () => set({ rulers: [] }),

      // ===== Mira single-target =====
      singleTargetAim: null,
      setSingleTargetAim: (v) => set({ singleTargetAim: v }),



      // ===== Iluminação (Fase 12) =====
      lighting: { ...defaultLightingState },
      setLighting: (patch) =>
        set((s) => ({ lighting: { ...s.lighting, ...patch } })),
      setEntityLight: (id, light) =>
        set((s) => {
          const cur = s.entities[id];
          if (!cur) return {};
          const next = { ...cur } as Entity;
          if (light) next.light = { ...light };
          else delete next.light;
          return { entities: { ...s.entities, [id]: next } };
        }),

      // ===== Dynamic Fog: Walls + Vision =====
      walls: [],
      vision: { ...defaultVision },
      addWall: (w) => set((s) => ({ walls: [...s.walls, w] })),
      removeWalls: (ids) =>
        set((s) => ({ walls: s.walls.filter((w) => !ids.includes(w.id)) })),
      toggleDoor: (id) =>
        set((s) => ({
          walls: s.walls.map((w) =>
            w.id === id && w.kind === 'door' ? { ...w, open: !w.open } : w,
          ),
        })),
      clearWalls: () => set({ walls: [] }),
      setVision: (patch) => set((s) => ({ vision: { ...s.vision, ...patch } })),
      setEntitySeer: (id, seer) =>
        set((s) => {
          const cur = s.entities[id];
          if (!cur) return {};
          const next = { ...cur } as Entity;
          if (seer) next.seer = { ...seer };
          else delete next.seer;
          return { entities: { ...s.entities, [id]: next } };
        }),
      setEntityOwnerProfile: (id, profileId) =>
        set((s) => {
          const cur = s.entities[id];
          if (!cur) return {};
          const next = { ...cur } as Entity;
          if (profileId) next.ownerProfileId = profileId;
          else delete next.ownerProfileId;
          return { entities: { ...s.entities, [id]: next } };
        }),
      setEntityAvatarProfile: (id, profileId) =>
        set((s) => {
          const cur = s.entities[id];
          if (!cur) return {};
          const next = { ...cur } as Entity;
          if (profileId) next.avatarProfileId = profileId;
          else delete next.avatarProfileId;
          return { entities: { ...s.entities, [id]: next } };
        }),
      setEntityCharacter: (id, characterId) =>
        set((s) => {
          const cur = s.entities[id];
          if (!cur) return {};
          const next = { ...cur } as Entity;
          if (characterId) next.characterId = characterId;
          else delete next.characterId;
          return { entities: { ...s.entities, [id]: next } };
        }),
      setEntityCarriedBy: (id, carrierId) =>
        set((s) => {
          const cur = s.entities[id];
          if (!cur) return {};
          const next = { ...cur } as Entity;
          if (carrierId) next.carriedBy = carrierId;
          else delete next.carriedBy;
          return { entities: { ...s.entities, [id]: next } };
        }),

      // ===== Grupos nomeados (Fase 14) =====
      groupSelection: (ids) => {
        if (ids.length < 2) return null;
        const gid = `g-${uid().slice(0, 8)}`;
        set((s) => {
          const next = { ...s.entities };
          for (const id of ids) {
            const cur = next[id];
            if (cur) next[id] = { ...cur, groupId: gid };
          }
          return { entities: next };
        });
        return gid;
      },
      ungroupSelection: (ids) => {
        set((s) => {
          const next = { ...s.entities };
          const targets = new Set<string>();
          for (const id of ids) {
            const e = next[id];
            if (e?.groupId) targets.add(e.groupId);
          }
          if (!targets.size) return {};
          for (const id of Object.keys(next)) {
            const e = next[id];
            if (e.groupId && targets.has(e.groupId)) {
              const { groupId, ...rest } = e;
              next[id] = rest as Entity;
            }
          }
          return { entities: next };
        });
      },
      expandToGroups: (ids) => {
        const s = get();
        const gset = new Set<string>();
        for (const id of ids) {
          const e = s.entities[id];
          if (e?.groupId) gset.add(e.groupId);
        }
        if (!gset.size) return ids;
        const out = new Set(ids);
        for (const id of s.entityOrder) {
          const e = s.entities[id];
          if (e?.groupId && gset.has(e.groupId)) out.add(id);
        }
        return Array.from(out);
      },

      pendingAoEPlacement: null,
      requestAoEPlacement: (opts) => {
        // Cancela qualquer placement pendente anterior.
        if (_pendingAoEResolver) {
          try { _pendingAoEResolver(null); } catch { /* noop */ }
          _pendingAoEResolver = null;
        }
        set({
          pendingAoEPlacement: {
            kind: opts.kind,
            sizeMeters: opts.sizeMeters,
            widthMeters: opts.widthMeters,
            sourceLabel: opts.sourceLabel,
            color: opts.color ?? '#ff5577',
            originWorld: opts.originWorld,
            maxRangeMeters: opts.maxRangeMeters,
          },
        });
        return new Promise((resolve) => {
          _pendingAoEResolver = resolve;
        });
      },
      resolveAoEPlacement: (template) => {
        const r = _pendingAoEResolver;
        _pendingAoEResolver = null;
        set({ pendingAoEPlacement: null });
        if (r) r(template);
      },
    }),
    {
      name: 'vtt-map-v1',
      partialize: (s) => ({
        gridConfig: s.gridConfig,
        entities: s.entities,
        entityOrder: s.entityOrder,
        selectedIds: s.selectedIds,
        partyCollapsed: s.partyCollapsed,
        activeTool: s.activeTool,
        toolSettings: s.toolSettings,
        drawings: s.drawings,
        notes: s.notes,
        layerVisible: s.layerVisible,
        scenes: s.scenes,
        sceneOrder: s.sceneOrder,
        activeSceneId: s.activeSceneId,
        background: s.background,
        initiative: s.initiative,
        initiativeOpen: s.initiativeOpen,
        templates: s.templates,
        rulers: s.rulers,
        lighting: s.lighting,
        walls: s.walls,
        vision: s.vision,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<typeof current>;
        // Saneamento: descarta resíduos de cena (zonas persistentes já expiradas
        // e seleções apontando para tokens que não existem mais).
        const entities = (p.entities ?? current.entities) as typeof current.entities;
        const templates = ((p.templates ?? []) as typeof current.templates).filter(
          (t) => !t.persistent || t.persistent.remainingTurns !== 0,
        );
        const selectedIds = ((p.selectedIds ?? []) as string[]).filter((id) => !!entities[id]);
        return {
          ...current,
          ...p,
          templates,
          selectedIds,
          // Estados efêmeros nunca devem ressurgir após um reload.
          singleTargetAim: null,
          pendingAoEPlacement: null,
          aoeTargetPreview: null,
          toolSettings: {
            ...current.toolSettings,
            ...(p.toolSettings ?? {}),
            pointer: {
              ...current.toolSettings.pointer,
              ...((p.toolSettings as any)?.pointer ?? {}),
            },
          },
        };
      },
    },
  ),
);






// Dev-only hook for browser tests (never in production builds).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__mapStore = useMapStore;
}

