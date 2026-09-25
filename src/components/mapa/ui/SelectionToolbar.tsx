/**
 * SelectionToolbar — toolbar HTML flutuante abaixo da entidade selecionada
 * (estilo Owlbear Rodeo). Aparece quando há exatamente 1 entidade selecionada.
 *
 * - Inclui rename inline (input flutuante) em vez de window.prompt.
 * - Ao definir um nome, ativa nameplate=true para o label ficar visível
 *   abaixo da imagem mesmo sem seleção.
 */
import { useEffect, useRef, useState } from 'react';
import { useMapStore, type EntityLayer } from '@/stores/useMapStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { entityAABB } from '../EntityEngine';
import {
  Eye, EyeOff, Lock, Unlock, Layers, Type as TypeIcon, Trash2, Copy, Package,
} from 'lucide-react';
import { assetCache } from '../assetCache';
import { useChestStore } from '@/stores/useChestStore';

const LAYER_ORDER: EntityLayer[] = ['map', 'tokens', 'gm'];

export function SelectionToolbar({ visible = true }: { visible?: boolean }) {
  const selectedIds = useMapStore((s) => s.selectedIds);
  const entities = useMapStore((s) => s.entities);
  const camera = useMapStore((s) => s.camera);
  const updateEntity = useMapStore((s) => s.updateEntity);
  const removeEntities = useMapStore((s) => s.removeEntities);
  const addEntity = useMapStore((s) => s.addEntity);
  const setEntityLayer = useMapStore((s) => s.setEntityLayer);
  const setSelected = useMapStore((s) => s.setSelected);
  const pushHistory = useMapStore((s) => s.pushHistory);
  const gridConfig = useMapStore((s) => s.gridConfig);
  const isMaster = useRoleStore((s) => s.role) !== 'PLAYER';

  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const [chestMenuOpen, setChestMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chestsRecord = useChestStore((s) => s.chests);
  const createChest = useChestStore((s) => s.createChest);

  // fecha rename ao trocar de seleção
  useEffect(() => {
    setRenaming(false);
    setChestMenuOpen(false);
  }, [selectedIds.join(',')]);

  useEffect(() => {
    if (renaming) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [renaming]);

  if (!visible) return null;
  if (selectedIds.length !== 1) return null;
  const e = entities[selectedIds[0]];
  if (!e) return null;

  const aabb = entityAABB(e);
  const cx = (aabb.x + aabb.x2) / 2;
  const screenX = (cx + camera.x) * camera.scale;
  const screenY = (aabb.y2 + camera.y) * camera.scale;

  // Tamanho em metros (configurável em Grid Controls).
  const metersPerCell = gridConfig.metersPerCell || 1.5;
  const dpi = gridConfig.dpi || 70;
  const heightMeters = (e.h / dpi) * metersPerCell;
  const sizeLabel = `${heightMeters.toFixed(heightMeters < 10 ? 1 : 0)}m`;


  // Posição do badge de tamanho: à direita da AABB, no meio vertical.
  const badgeScreenX = (aabb.x2 + camera.x) * camera.scale;
  const badgeScreenY = ((aabb.y + aabb.y2) / 2 + camera.y) * camera.scale;


  const toggleHidden = () => { pushHistory(); updateEntity(e.id, { hidden: !e.hidden }); };
  const toggleLock = () => { pushHistory(); updateEntity(e.id, { locked: !e.locked }); };
  const cycleLayer = () => {
    const cur = (e.layer ?? 'tokens') as EntityLayer;
    const idx = LAYER_ORDER.indexOf(cur);
    const next = LAYER_ORDER[(idx + 1) % LAYER_ORDER.length];
    pushHistory();
    setEntityLayer(e.id, next);
  };
  const startRename = () => {
    setDraft(e.label ?? '');
    setRenaming(true);
  };
  const commitRename = () => {
    const trimmed = draft.trim();
    pushHistory();
    updateEntity(e.id, {
      label: trimmed,
      // garante que o nome apareça abaixo da imagem sem precisar estar selecionado
      nameplate: trimmed.length > 0 ? true : false,
    });
    setRenaming(false);
  };
  const cancelRename = () => setRenaming(false);
  const duplicate = () => {
    const off = gridConfig.dpi / 2;
    pushHistory();
    const nid = addEntity({
      shape: e.shape, x: e.x + off, y: e.y + off,
      w: e.w, h: e.h, rotation: e.rotation,
      color: e.color, label: e.label, locked: false, assetId: e.assetId,
    });
    setSelected([nid]);
  };
  const del = () => {
    pushHistory();
    const aid = e.assetId;
    removeEntities([e.id]);
    if (aid) void assetCache.destroy(aid);
  };

  const layerLabel = (e.layer ?? 'tokens').toUpperCase();

  return (
    <>
      {/* Badge de tamanho (em metros) à direita da entidade */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: badgeScreenX + 12,
          top: badgeScreenY,
          transform: 'translate(0, -50%)',
          zIndex: 35,
        }}
      >
        <div className="rounded-full border border-[#2a2b30] bg-[#16171a]/95 backdrop-blur px-2 py-0.5 text-[11px] font-semibold text-zinc-100 shadow-lg tabular-nums">
          {sizeLabel}
        </div>
      </div>

      <div
        className="absolute pointer-events-none"
        style={{
          left: screenX,
          top: screenY + 12,
          transform: 'translate(-50%, 0)',
          zIndex: 35,
        }}
      >

      <div
        className="pointer-events-auto flex flex-col items-center gap-1.5"
        onMouseDown={(ev) => ev.stopPropagation()}
        onClick={(ev) => ev.stopPropagation()}
        onContextMenu={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center gap-0.5 rounded-full border border-[#2a2b30] bg-[#16171a]/95 backdrop-blur px-1.5 py-1 shadow-xl">
          {isMaster && (
            <ToolBtn title={e.hidden ? 'Mostrar' : 'Esconder (GM)'} onClick={toggleHidden}>
              {e.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </ToolBtn>
          )}
          <ToolBtn title={e.locked ? 'Destravar' : 'Travar'} onClick={toggleLock}>
            {e.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </ToolBtn>
          <ToolBtn title={`Camada: ${layerLabel} (clique p/ trocar)`} onClick={cycleLayer}>
            <Layers className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn title="Duplicar" onClick={duplicate}>
            <Copy className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn title="Renomear (F2)" onClick={startRename} active={renaming}>
            <TypeIcon className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn
            title={e.chestId ? 'Baú vinculado (clique p/ trocar)' : 'Vincular Baú'}
            onClick={() => setChestMenuOpen((v) => !v)}
            active={!!e.chestId || chestMenuOpen}
          >
            <Package className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn title="Excluir" onClick={del} danger>
            <Trash2 className="h-3.5 w-3.5" />
          </ToolBtn>
        </div>

        {chestMenuOpen && (
          <div className="flex flex-col gap-1 rounded-md border border-[#2a2b30] bg-[#16171a]/95 backdrop-blur p-2 shadow-xl min-w-[220px] max-h-72 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                const c = createChest(e.label ? `Baú de ${e.label}` : undefined);
                pushHistory();
                updateEntity(e.id, { chestId: c.id });
                setChestMenuOpen(false);
              }}
              className="h-7 px-2 rounded text-xs font-medium bg-sky-500/20 text-sky-200 hover:bg-sky-500/30 text-left"
            >
              + Criar novo baú
            </button>
            {e.chestId && (
              <button
                type="button"
                onClick={() => {
                  pushHistory();
                  updateEntity(e.id, { chestId: undefined });
                  setChestMenuOpen(false);
                }}
                className="h-7 px-2 rounded text-xs font-medium bg-red-500/15 text-red-200 hover:bg-red-500/25 text-left"
              >
                Desvincular baú
              </button>
            )}
            <div className="h-px bg-[#2a2b30] my-1" />
            {Object.values(chestsRecord).length === 0 ? (
              <div className="text-[11px] text-zinc-400 italic px-1">Nenhum baú existente.</div>
            ) : (
              Object.values(chestsRecord)
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      pushHistory();
                      updateEntity(e.id, { chestId: c.id });
                      setChestMenuOpen(false);
                    }}
                    className={`h-7 px-2 rounded text-xs text-left truncate ${
                      e.chestId === c.id
                        ? 'bg-sky-500/25 text-sky-100'
                        : 'text-zinc-200 hover:bg-[#1f2024]'
                    }`}
                  >
                    {c.name} <span className="text-zinc-400">({c.entries.length})</span>
                  </button>
                ))
            )}
          </div>
        )}

        {renaming && (
          <div className="flex items-center gap-1 rounded-md border border-[#2a2b30] bg-[#16171a]/95 backdrop-blur px-1.5 py-1 shadow-xl">
            <input
              ref={inputRef}
              value={draft}
              onChange={(ev) => setDraft(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter') { ev.preventDefault(); commitRename(); }
                else if (ev.key === 'Escape') { ev.preventDefault(); cancelRename(); }
              }}
              placeholder="Nome"
              className="h-7 w-44 rounded bg-[#0f1012] border border-[#2a2b30] px-2 text-xs text-zinc-100 outline-none focus:border-sky-400/60"
            />
            <button
              type="button"
              onClick={commitRename}
              className="h-7 px-2 rounded text-xs font-medium bg-sky-500/20 text-sky-200 hover:bg-sky-500/30"
            >
              OK
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}


function ToolBtn({
  children, title, onClick, danger, active,
}: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-7 w-7 flex items-center justify-center rounded-full transition-colors ${
        active
          ? 'bg-sky-500/20 text-sky-200'
          : danger
            ? 'text-red-300 hover:bg-red-500/15 hover:text-red-200'
            : 'text-zinc-300 hover:bg-[#1f2024] hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
