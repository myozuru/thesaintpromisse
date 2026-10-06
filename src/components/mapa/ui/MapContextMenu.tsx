/**
 * MapContextMenu — menu de clique-direito para o canvas do mapa (Fase 5).
 *
 * Renderiza em coords de tela. Posiciona-se evitando overflow da viewport.
 * Fecha em clique fora, Esc ou scroll.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpToLine, ArrowDownToLine, ArrowUp, ArrowDown,
  Copy, Trash2, Lock, Unlock, Layers, Swords, Flame, Lightbulb, Sun, FlameKindling, CircleOff,
  Group as GroupIcon, Ungroup, Pencil,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
  Map as MapIcon, User, Package, Eye, EyeOff, UserCheck, FileText, Link2Off, Scan,
} from 'lucide-react';
import type { EntityLayer } from '@/stores/useMapStore';

export type LightPreset = 'none' | 'candle' | 'torch' | 'lantern' | 'daylight';
export type AssetKindAction = 'map' | 'character' | 'object';
export type SeerPreset = 'off' | 'small' | 'normal' | 'far';

export type CtxMenuAction =
  | 'bringFront' | 'sendBack' | 'bringForward' | 'sendBackward'
  | 'duplicate' | 'delete' | 'rename'
  | 'lock' | 'unlock'
  | 'alignLeft' | 'alignHCenter' | 'alignRight'
  | 'alignTop'  | 'alignVCenter' | 'alignBottom'
  | 'distH' | 'distV'
  | 'addInit' | 'removeInit'
  | 'group' | 'ungroup'
  | 'setMyself' | 'clearMyself'
  | 'carry' | 'drop'
  | 'adjustToken'
  | 'toggleHideName'
  | { kind: 'setLayer'; layer: EntityLayer }
  | { kind: 'setLight'; preset: LightPreset }
  | { kind: 'setLightMeters'; meters: number }
  | { kind: 'setAssetKind'; assetKind: AssetKindAction }
  | { kind: 'setSeer'; preset: SeerPreset }
  | { kind: 'setSeerMeters'; meters: number }
  | { kind: 'setSeerDarkMeters'; meters: number }
  | { kind: 'setCharacter'; characterId: string | null };

interface CharacterOption {
  id: string;
  name: string;
}

interface Props {
  x: number;
  y: number;
  selectionCount: number;
  anyLocked: boolean;
  anyUnlocked: boolean;
  anyInInit?: boolean;
  anyOutInit?: boolean;
  /** Há ao menos 2 itens selecionados, candidatos a serem agrupados. */
  canGroup?: boolean;
  /** Há ao menos um item da seleção com groupId definido. */
  canUngroup?: boolean;
  /** Algum item selecionado é imagem (tem assetId) — habilita "Tipo". */
  anyHasAsset?: boolean;
  /** Seleção única é um personagem circular ajustável. */
  canAdjustToken?: boolean;
  /** Mostra opções restritas ao player (Sou eu, vincular ficha). */
  isPlayer?: boolean;
  /** Habilita controles GM-only (Luz e Visão dos tokens). */
  isGM?: boolean;
  /** Indica se a seleção única já é o avatar do player ativo. */
  myselfActive?: boolean;
  /** Ficha atualmente vinculada (id) à seleção única. */
  currentCharacterId?: string | null;
  /** Lista de fichas disponíveis para vincular (filtradas pelo escopo do usuário). */
  availableCharacters?: CharacterOption[];
  /** Valor atual de Luz (em metros) da seleção, se única. */
  currentLightMeters?: number | null;
  /** Valor atual de Visão (em metros) da seleção, se única. */
  currentSeerMeters?: number | null;
  /** Valor atual de Visão no escuro (em metros) da seleção, se única. */
  currentSeerDarkMeters?: number | null;
  /** Modo restrito: oferece apenas a ação de "carregar/soltar" sobre um corpo caído. */
  carryMode?: 'carry' | 'drop' | null;
  /** Seleção única está com o nome oculto (controle do mestre). */
  nameHidden?: boolean;
  onAction: (a: CtxMenuAction) => void;
  onClose: () => void;
}

export function MapContextMenu({
  x, y, selectionCount, anyLocked, anyUnlocked, anyInInit, anyOutInit, canGroup, canUngroup, anyHasAsset, canAdjustToken,
  isPlayer, isGM, myselfActive, currentCharacterId, availableCharacters,
  currentLightMeters, currentSeerMeters, currentSeerDarkMeters, carryMode, nameHidden,
  onAction, onClose,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // ajusta posição pra não vazar: limita a altura à tela e rola o resto.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const fit = () => {
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const vh = document.documentElement.clientHeight || window.innerHeight;
      el.style.maxHeight = `${vh - 8}px`;
      const w = el.offsetWidth, h = Math.min(el.scrollHeight, vh - 8);
      el.style.left = `${Math.max(4, Math.min(x, vw - w - 4))}px`;
      el.style.top = `${Math.max(4, Math.min(y, vh - h - 4))}px`;
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [x, y]);

  const canAlign = selectionCount >= 2;
  const canDist  = selectionCount >= 3;

  if (carryMode) {
    return createPortal(
      <div
        ref={rootRef}
        className="fixed z-[1000] min-w-[160px] rounded-md border p-1 text-xs shadow-2xl"
        style={{ left: x, top: y, background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Item
          icon={<User className="h-3.5 w-3.5 text-amber-300" />}
          label={carryMode === 'drop' ? 'Soltar' : 'Carregar'}
          onClick={() => { onAction(carryMode === 'drop' ? 'drop' : 'carry'); onClose(); }}
        />
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      ref={rootRef}
      className="fixed z-[1000] min-w-[200px] overflow-y-auto overscroll-contain rounded-md border p-1 text-xs shadow-2xl"
      onWheel={(e) => e.stopPropagation()}
      style={{
        left: x, top: y,
        maxHeight: 'calc(100vh - 8px)',
        background: 'hsl(var(--card))',
        borderColor: 'hsl(var(--border))',
        color: 'hsl(var(--foreground))',
      }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <Item icon={<ArrowUpToLine className="h-3.5 w-3.5" />} label="Trazer para frente  (Shift+])"
        onClick={() => { onAction('bringFront'); onClose(); }} />
      <Item icon={<ArrowUp className="h-3.5 w-3.5" />} label="Avançar 1  (])"
        onClick={() => { onAction('bringForward'); onClose(); }} />
      <Item icon={<ArrowDown className="h-3.5 w-3.5" />} label="Recuar 1  ([)"
        onClick={() => { onAction('sendBackward'); onClose(); }} />
      <Item icon={<ArrowDownToLine className="h-3.5 w-3.5" />} label="Enviar para trás  (Shift+[)"
        onClick={() => { onAction('sendBack'); onClose(); }} />
      <Sep />
      <Group label="Camada">
        <Mini icon={<Layers className="h-3.5 w-3.5" />} title="Mapa"
          onClick={() => { onAction({ kind: 'setLayer', layer: 'map' }); onClose(); }} />
        <Mini icon={<Layers className="h-3.5 w-3.5" />} title="Tokens"
          onClick={() => { onAction({ kind: 'setLayer', layer: 'tokens' }); onClose(); }} />
        <Mini icon={<Layers className="h-3.5 w-3.5" />} title="GM"
          onClick={() => { onAction({ kind: 'setLayer', layer: 'gm' }); onClose(); }} />
      </Group>
      {anyHasAsset && (
        <>
          <Sep />
          <Group label="Tipo da imagem">
            <Mini icon={<MapIcon className="h-3.5 w-3.5" />} title="Mapa (vira fundo)"
              onClick={() => { onAction({ kind: 'setAssetKind', assetKind: 'map' }); onClose(); }} />
            <Mini icon={<User className="h-3.5 w-3.5" />} title="Personagem (1 célula)"
              onClick={() => { onAction({ kind: 'setAssetKind', assetKind: 'character' }); onClose(); }} />
            <Mini icon={<Package className="h-3.5 w-3.5" />} title="Objeto (altura padrão)"
              onClick={() => { onAction({ kind: 'setAssetKind', assetKind: 'object' }); onClose(); }} />
          </Group>
        </>
      )}
      {anyHasAsset && selectionCount === 1 && (
        <>
          <Sep />
          {canAdjustToken && (
            <Item
              icon={<Scan className="h-3.5 w-3.5 text-violet-300" />}
              label="Ajustar imagem"
              onClick={() => { onAction('adjustToken'); onClose(); }}
            />
          )}
          {isPlayer && (
            <Item
              icon={<UserCheck className={`h-3.5 w-3.5 ${myselfActive ? 'text-emerald-300' : 'text-sky-300'}`} />}
              label={myselfActive ? 'Remover marcação "Sou eu"' : 'Sou eu (meu avatar)'}
              onClick={() => { onAction(myselfActive ? 'clearMyself' : 'setMyself'); onClose(); }}
            />
          )}
          {(isGM || isPlayer) && (
            <FichaPicker
              currentCharacterId={currentCharacterId ?? null}
              options={availableCharacters ?? []}
              onPick={(id) => { onAction({ kind: 'setCharacter', characterId: id }); onClose(); }}
            />
          )}
        </>
      )}
      <Sep />
      {selectionCount === 1 && (
        <Item icon={<Pencil className="h-3.5 w-3.5" />} label="Renomear  (F2)"
          onClick={() => { onAction('rename'); onClose(); }} />
      )}
      {isGM && selectionCount === 1 && (
        <Item
          icon={nameHidden
            ? <Eye className="h-3.5 w-3.5 text-emerald-300" />
            : <EyeOff className="h-3.5 w-3.5 text-amber-300" />}
          label={nameHidden ? 'Mostrar nome' : 'Ocultar nome'}
          onClick={() => { onAction('toggleHideName'); onClose(); }} />
      )}
      <Item icon={<Copy className="h-3.5 w-3.5" />} label="Duplicar  (Ctrl+D)"
        onClick={() => { onAction('duplicate'); onClose(); }} />
      <Item icon={<Trash2 className="h-3.5 w-3.5" />} label="Excluir  (Del)" danger
        onClick={() => { onAction('delete'); onClose(); }} />
      <Sep />
      {anyUnlocked && (
        <Item icon={<Lock className="h-3.5 w-3.5" />} label="Travar"
          onClick={() => { onAction('lock'); onClose(); }} />
      )}
      {anyLocked && (
        <Item icon={<Unlock className="h-3.5 w-3.5" />} label="Destravar"
          onClick={() => { onAction('unlock'); onClose(); }} />
      )}
      <Sep />
      {isGM && (
        <>
          <Sep />
          <Group label="Luz (apenas mestre)">
            <Mini icon={<CircleOff className="h-3.5 w-3.5" />} title="Sem luz"
              onClick={() => { onAction({ kind: 'setLight', preset: 'none' }); onClose(); }} />
            <Mini icon={<FlameKindling className="h-3.5 w-3.5 text-amber-300" />} title="Vela (2)"
              onClick={() => { onAction({ kind: 'setLight', preset: 'candle' }); onClose(); }} />
            <Mini icon={<Flame className="h-3.5 w-3.5 text-orange-400" />} title="Tocha (4)"
              onClick={() => { onAction({ kind: 'setLight', preset: 'torch' }); onClose(); }} />
            <Mini icon={<Lightbulb className="h-3.5 w-3.5 text-yellow-300" />} title="Lanterna (6)"
              onClick={() => { onAction({ kind: 'setLight', preset: 'lantern' }); onClose(); }} />
            <Mini icon={<Sun className="h-3.5 w-3.5 text-amber-200" />} title="Luz do dia (12)"
              onClick={() => { onAction({ kind: 'setLight', preset: 'daylight' }); onClose(); }} />
          </Group>
          <MetersInput
            label="Luz personalizada"
            placeholder="metros"
            initialValue={currentLightMeters ?? null}
            onSubmit={(m) => { onAction({ kind: 'setLightMeters', meters: m }); onClose(); }}
          />
          <Group label="Visão (apenas mestre)">
            <Mini icon={<EyeOff className="h-3.5 w-3.5" />} title="Sem visão"
              onClick={() => { onAction({ kind: 'setSeer', preset: 'off' }); onClose(); }} />
            <Mini icon={<Eye className="h-3.5 w-3.5 text-sky-300" />} title="Curta (3 células)"
              onClick={() => { onAction({ kind: 'setSeer', preset: 'small' }); onClose(); }} />
            <Mini icon={<Eye className="h-3.5 w-3.5 text-emerald-300" />} title="Normal (raio padrão)"
              onClick={() => { onAction({ kind: 'setSeer', preset: 'normal' }); onClose(); }} />
            <Mini icon={<Eye className="h-3.5 w-3.5 text-amber-200" />} title="Longa (15 células)"
              onClick={() => { onAction({ kind: 'setSeer', preset: 'far' }); onClose(); }} />
          </Group>
          <MetersInput
            label="Visão personalizada"
            placeholder="metros"
            initialValue={currentSeerMeters ?? null}
            onSubmit={(m) => { onAction({ kind: 'setSeerMeters', meters: m }); onClose(); }}
          />
          <MetersInput
            label="Visão no escuro (modo escuridão)"
            placeholder="metros"
            initialValue={currentSeerDarkMeters ?? null}
            onSubmit={(m) => { onAction({ kind: 'setSeerDarkMeters', meters: m }); onClose(); }}
          />
        </>
      )}
      {(canGroup || canUngroup) && (
        <>
          <Sep />
          {canGroup && (
            <Item icon={<GroupIcon className="h-3.5 w-3.5 text-sky-300" />} label="Agrupar  (Ctrl+G)"
              onClick={() => { onAction('group'); onClose(); }} />
          )}
          {canUngroup && (
            <Item icon={<Ungroup className="h-3.5 w-3.5 text-sky-300" />} label="Desagrupar  (Ctrl+Shift+G)"
              onClick={() => { onAction('ungroup'); onClose(); }} />
          )}
        </>
      )}
      {canAlign && (
        <>
          <Sep />
          <Group label="Alinhar">
            <Mini icon={<AlignStartVertical    className="h-3.5 w-3.5" />} title="Esquerda"   onClick={() => { onAction('alignLeft');    onClose(); }} />
            <Mini icon={<AlignCenterVertical   className="h-3.5 w-3.5" />} title="Centro H"   onClick={() => { onAction('alignHCenter'); onClose(); }} />
            <Mini icon={<AlignEndVertical      className="h-3.5 w-3.5" />} title="Direita"    onClick={() => { onAction('alignRight');   onClose(); }} />
            <Mini icon={<AlignStartHorizontal  className="h-3.5 w-3.5" />} title="Topo"       onClick={() => { onAction('alignTop');     onClose(); }} />
            <Mini icon={<AlignCenterHorizontal className="h-3.5 w-3.5" />} title="Centro V"   onClick={() => { onAction('alignVCenter'); onClose(); }} />
            <Mini icon={<AlignEndHorizontal    className="h-3.5 w-3.5" />} title="Base"       onClick={() => { onAction('alignBottom');  onClose(); }} />
          </Group>
        </>
      )}
      {canDist && (
        <Group label="Distribuir">
          <Mini icon={<AlignHorizontalDistributeCenter className="h-3.5 w-3.5" />} title="Horizontal" onClick={() => { onAction('distH'); onClose(); }} />
          <Mini icon={<AlignVerticalDistributeCenter   className="h-3.5 w-3.5" />} title="Vertical"   onClick={() => { onAction('distV'); onClose(); }} />
        </Group>
      )}
    </div>,
    document.body,
  );
}

function Item({
  icon, label, danger, onClick,
}: { icon: React.ReactNode; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-left hover:bg-secondary ${danger ? 'text-red-300 hover:text-red-200' : 'text-foreground'}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
function Sep() { return <div className="my-1 h-px bg-border" />; }

function MetersInput({
  label, placeholder, initialValue, onSubmit,
}: { label: string; placeholder?: string; initialValue?: number | null; onSubmit: (meters: number) => void }) {
  const initStr = initialValue != null && Number.isFinite(initialValue) && initialValue > 0
    ? String(Math.round(initialValue * 100) / 100)
    : '';
  const [val, setVal] = useState(initStr);
  const submit = () => {
    const m = parseFloat(val.replace(',', '.'));
    if (Number.isFinite(m) && m >= 0) onSubmit(m);
  };
  return (
    <div className="px-2 py-1">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          step={0.5}
          inputMode="decimal"
          placeholder={placeholder}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          className="h-7 flex-1 rounded border border-border bg-[#101113] px-2 text-xs text-foreground outline-none focus:border-sky-500"
        />
        <span className="text-xs text-muted-foreground">m</span>
        <button
          onClick={submit}
          className="h-7 px-2 rounded border border-border hover:bg-secondary text-xs text-foreground"
        >
          OK
        </button>
      </div>
    </div>
  );
}

function FichaPicker({
  currentCharacterId,
  options,
  onPick,
}: {
  currentCharacterId: string | null;
  options: CharacterOption[];
  onPick: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === currentCharacterId);
  return (
    <div className="px-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-left hover:bg-secondary text-foreground"
      >
        <FileText className="h-3.5 w-3.5 text-amber-200" />
        <span className="flex-1">
          {current ? `Ficha: ${current.name}` : 'Vincular ficha…'}
        </span>
        <span className="text-muted-foreground text-xs">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-1 max-h-48 overflow-auto rounded border border-border bg-[#101113]">
          {options.length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground">Nenhuma ficha disponível</div>
          )}
          {options.map((o) => (
            <button
              key={o.id}
              onClick={() => onPick(o.id)}
              className={`w-full text-left px-2 py-1.5 text-xs hover:bg-secondary ${
                o.id === currentCharacterId ? 'text-emerald-300' : 'text-foreground'
              }`}
            >
              {o.name}
            </button>
          ))}
          {currentCharacterId && (
            <>
              <div className="h-px bg-border" />
              <button
                onClick={() => onPick(null)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-red-300 hover:bg-secondary"
              >
                <Link2Off className="h-3.5 w-3.5" />
                <span>Desvincular</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-2 py-1">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}
function Mini({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="h-7 w-7 flex items-center justify-center rounded border border-border hover:bg-secondary text-foreground/80"
    >
      {icon}
    </button>
  );
}
