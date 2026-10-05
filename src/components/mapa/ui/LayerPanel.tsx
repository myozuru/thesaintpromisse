/**
 * LayerPanel — Fase 6.
 *
 * Painel flutuante (canto direito do canvas) que lista todas as entidades
 * agrupadas por camada semântica ('map' | 'tokens' | 'gm').
 *
 * - Topo da lista = mais "na frente" dentro da camada (ordem de render reversa).
 * - Cada item: handle de drag, swatch de cor, nome (editável), camada (badge clicável),
 *   toggle de visibilidade (apenas marcação local — Phase 6 não esconde a entidade
 *   no canvas, mas a `hidden` flag já está pronta), toggle de lock, exclusão.
 * - Drag-and-drop nativo HTML5 para reordenar dentro da mesma camada ou mover
 *   entre camadas.
 * - Toggle de visibilidade por camada inteira no header.
 */
import { useState } from 'react';
import {
  Eye, EyeOff, Lock, Unlock, Trash2, GripVertical,
  Layers, ChevronDown, ChevronRight, Tag, Heart,
} from 'lucide-react';
import {
  useMapStore, ENTITY_LAYERS,
  type Entity, type EntityLayer,
} from '@/stores/useMapStore';
import { assetCache } from '../assetCache';

const LAYER_LABEL: Record<EntityLayer, string> = {
  map: 'Mapa',
  tokens: 'Tokens',
  gm: 'GM',
};

interface Props {
  onClose: () => void;
}

export function LayerPanel({ onClose }: Props) {
  const entities = useMapStore((s) => s.entities);
  const entityOrder = useMapStore((s) => s.entityOrder);
  const selectedIds = useMapStore((s) => s.selectedIds);
  const layerVisible = useMapStore((s) => s.layerVisible);
  const setLayerVisible = useMapStore((s) => s.setLayerVisible);
  const setSelected = useMapStore((s) => s.setSelected);
  const updateEntityRaw = useMapStore((s) => s.updateEntity);
  const removeEntitiesRaw = useMapStore((s) => s.removeEntities);
  const setEntityLayerRaw = useMapStore((s) => s.setEntityLayer);
  const reorderInLayerRaw = useMapStore((s) => s.reorderInLayer);
  const pushHistory = useMapStore((s) => s.pushHistory);
  const updateEntity: typeof updateEntityRaw = (id, patch) => { pushHistory(); updateEntityRaw(id, patch); };
  const removeEntities: typeof removeEntitiesRaw = (ids) => { pushHistory(); removeEntitiesRaw(ids); };
  const setEntityLayer: typeof setEntityLayerRaw = (id, layer) => { pushHistory(); setEntityLayerRaw(id, layer); };
  const reorderInLayer: typeof reorderInLayerRaw = (id, beforeId) => { pushHistory(); reorderInLayerRaw(id, beforeId); };

  const [collapsed, setCollapsed] = useState<Record<EntityLayer, boolean>>({
    map: false, tokens: false, gm: false,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  // Agrupar por camada, mantendo ordem do entityOrder (no painel exibimos
  // do topo-da-pilha para o fundo — reverso).
  const byLayer: Record<EntityLayer, Entity[]> = { map: [], tokens: [], gm: [] };
  for (const id of entityOrder) {
    const e = entities[id];
    if (!e) continue;
    const l = e.layer ?? 'tokens';
    byLayer[l].push(e);
  }
  for (const l of ENTITY_LAYERS) byLayer[l].reverse();

  const handleDropOn = (targetId: string | null, targetLayer: EntityLayer) => {
    if (!dragId) return;
    const dragged = entities[dragId];
    if (!dragged) { setDragId(null); return; }
    if ((dragged.layer ?? 'tokens') !== targetLayer) {
      setEntityLayer(dragId, targetLayer);
    }
    // Mover na ordem: no painel a lista é reversa, então "drop antes do alvo no painel"
    // significa "vir DEPOIS do alvo no entityOrder" → reorderInLayer com beforeId = próximo do alvo
    // Para simplificar: se targetId == null, vai pro topo (= fim do entityOrder).
    if (targetId === null) {
      reorderInLayer(dragId, null);
    } else {
      // targetId é o item acima do qual estamos soltando no painel (mais à frente)
      // queremos que dragId fique IMEDIATAMENTE atrás dele → no entityOrder, antes do targetId
      reorderInLayer(dragId, targetId);
    }
    setDragId(null);
  };

  return (
    <div
      className="absolute top-2 right-3 w-72 max-h-[80%] pointer-events-auto rounded-lg shadow-xl flex flex-col text-xs"
      style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))', zIndex: 20 }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          <span className="text-sm font-medium">Camadas</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" title="Fechar">×</button>
      </div>

      <div className="flex-1 overflow-auto p-1">
        {ENTITY_LAYERS.slice().reverse().map((layer) => {
          const items = byLayer[layer];
          const isOpen = !collapsed[layer];
          return (
            <div key={layer} className="mb-1">
              <div
                className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-secondary"
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); handleDropOn(null, layer); }}
              >
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [layer]: !c[layer] }))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
                <span className="text-xs uppercase tracking-wider text-muted-foreground flex-1">
                  {LAYER_LABEL[layer]} <span className="text-muted-foreground/40">· {items.length}</span>
                </span>
                <button
                  title={layerVisible[layer] ? 'Ocultar camada' : 'Mostrar camada'}
                  onClick={() => setLayerVisible(layer, !layerVisible[layer])}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {layerVisible[layer] ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
              </div>

              {isOpen && (
                <div className="ml-1 mt-0.5">
                  {items.length === 0 && (
                    <div
                      className="px-2 py-1.5 text-xs text-muted-foreground/40 italic border border-dashed border-border rounded mx-1"
                      onDragOver={(e) => { e.preventDefault(); }}
                      onDrop={(e) => { e.preventDefault(); handleDropOn(null, layer); }}
                    >
                      arraste aqui
                    </div>
                  )}
                  {items.map((e) => {
                    const selected = selectedIds.includes(e.id);
                    const hasImg = !!(e.assetId && assetCache.get(e.assetId)?.ready);
                    return (
                      <div
                        key={e.id}
                        draggable
                        onDragStart={() => setDragId(e.id)}
                        onDragEnd={() => setDragId(null)}
                        onDragOver={(ev) => { ev.preventDefault(); }}
                        onDrop={(ev) => { ev.preventDefault(); handleDropOn(e.id, layer); }}
                        onClick={(ev) => {
                          if (ev.shiftKey) {
                            const next = selected
                              ? selectedIds.filter((x) => x !== e.id)
                              : [...selectedIds, e.id];
                            setSelected(next);
                          } else {
                            setSelected([e.id]);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer ${
                          selected ? 'bg-[#1d2a3a] outline outline-1 outline-sky-700' : 'hover:bg-secondary'
                        }`}
                      >
                        <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        <span
                          className="h-3 w-3 rounded-sm shrink-0"
                          style={{
                            background: hasImg ? 'transparent' : e.color,
                            border: hasImg ? '1px dashed #555' : '1px solid rgba(0,0,0,0.4)',
                          }}
                        />
                        {editingId === e.id ? (
                          <input
                            autoFocus
                            defaultValue={e.label ?? ''}
                            onBlur={(ev) => {
                              updateEntity(e.id, { label: ev.target.value || undefined });
                              setEditingId(null);
                            }}
                            onKeyDown={(ev) => {
                              if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
                              if (ev.key === 'Escape') setEditingId(null);
                            }}
                            className="flex-1 bg-[#0f1014] border border-border rounded px-1 text-xs text-foreground"
                          />
                        ) : (
                          <button
                            className="flex-1 text-left truncate text-foreground"
                            onDoubleClick={(ev) => { ev.stopPropagation(); setEditingId(e.id); }}
                            title="Duplo-clique para renomear"
                          >
                            {e.label || <span className="text-muted-foreground/40 italic">sem nome</span>}
                          </button>
                        )}
                        <button
                          title="Mostrar nameplate"
                          onClick={(ev) => { ev.stopPropagation(); updateEntity(e.id, { nameplate: !e.nameplate }); }}
                          className={`text-muted-foreground hover:text-foreground ${e.nameplate ? 'text-sky-300' : ''}`}
                        >
                          <Tag className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title={typeof e.hp === 'number' ? 'Editar HP' : 'Definir HP'}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            const cur = typeof e.hp === 'number' ? `${e.hp}/${e.hpMax ?? e.hp}` : '';
                            const inp = window.prompt('HP (formato "atual/max", vazio = remover)', cur);
                            if (inp === null) return;
                            if (!inp.trim()) {
                              updateEntity(e.id, { hp: undefined, hpMax: undefined });
                              return;
                            }
                            const m = inp.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
                            if (m) updateEntity(e.id, { hp: +m[1], hpMax: +m[2] });
                            else {
                              const n = parseInt(inp, 10);
                              if (!Number.isNaN(n)) updateEntity(e.id, { hp: n, hpMax: n });
                            }
                          }}
                          className={`text-muted-foreground hover:text-foreground ${typeof e.hp === 'number' ? 'text-rose-300' : ''}`}
                        >
                          <Heart className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title={e.hidden ? 'Mostrar' : 'Ocultar'}
                          onClick={(ev) => { ev.stopPropagation(); updateEntity(e.id, { hidden: !e.hidden }); }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {e.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          title={e.locked ? 'Destravar' : 'Travar'}
                          onClick={(ev) => { ev.stopPropagation(); updateEntity(e.id, { locked: !e.locked }); }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {e.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          title="Excluir"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            const aid = e.assetId;
                            removeEntities([e.id]);
                            if (aid) void assetCache.destroy(aid);
                          }}
                          className="text-muted-foreground hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-3 py-1.5 border-t border-border text-xs text-muted-foreground">
        Arraste para reordenar/trocar de camada. Shift+clique para multi-seleção.
      </div>
    </div>
  );
}
