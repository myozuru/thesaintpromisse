/**
 * LootOverlay — sistema de saque (loot) inspirado em Skyrim.
 *
 * Aparece um botão flutuante "Saquear" abaixo de um token selecionado quando:
 *  - O token tem uma ficha vinculada (characterId) E essa ficha está com HP <= 0
 *    (ou o próprio entity.hp <= 0), ou seja, o token está morto/inconsciente.
 *  - Existe pelo menos UM token do jogador ativo (ownerProfileId === activeProfileId)
 *    a 1 metro ou menos de distância (borda-a-borda).
 *
 * Clicar em "Saquear" abre um diálogo listando os itens que podem ser pegos:
 *   - Armas equipadas (mainHand/offHand) aparecem no topo.
 *   - Em seguida acessórios equipados.
 *   - Por fim, demais itens do inventário.
 *
 * Clique simples em um item move-o do inventário do morto para o do jogador.
 * Hover prolongado (>= 2s) revela a descrição completa do item em um tooltip.
 * Há um espaço reservado à esquerda de cada item para uma imagem futura
 * (`entity.icone` é usado quando for uma URL/dataURL).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Skull, X, Package } from 'lucide-react';
import { useMapStore } from '@/stores/useMapStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore, type InventoryItem } from '@/stores/useInventoryStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { entityAABB } from '../EntityEngine';
import { toast } from '@/hooks/use-toast';

const LOOT_RANGE_CELLS = 1.5;
const HOVER_DELAY_MS = 2000;

interface SortedItem {
  item: InventoryItem;
  bucket: 'weapon' | 'accessory' | 'inventory';
}

function isImageSrc(s: string | undefined): boolean {
  if (!s) return false;
  return /^(https?:|data:|blob:|\/)/i.test(s);
}

function sortLoot(items: InventoryItem[], mainHand?: string | null, offHand?: string | null): SortedItem[] {
  const equippedNames = new Set<string>();
  if (mainHand) equippedNames.add(mainHand.trim().toLowerCase());
  if (offHand) equippedNames.add(offHand.trim().toLowerCase());

  const out: SortedItem[] = items.map((i) => {
    const cat = i.entity.categoria;
    const isWeaponSlot =
      cat === 'arma' && equippedNames.has((i.entity.nome ?? '').trim().toLowerCase());
    if (isWeaponSlot) return { item: i, bucket: 'weapon' as const };
    if (i.isEquipped) return { item: i, bucket: 'accessory' as const };
    return { item: i, bucket: 'inventory' as const };
  });

  const rank = (b: SortedItem['bucket']) => (b === 'weapon' ? 0 : b === 'accessory' ? 1 : 2);
  out.sort((a, b) => {
    const d = rank(a.bucket) - rank(b.bucket);
    if (d !== 0) return d;
    return (a.item.entity.nome ?? '').localeCompare(b.item.entity.nome ?? '');
  });
  return out;
}

export function LootOverlay() {
  const selectedIds = useMapStore((s) => s.selectedIds);
  const entities = useMapStore((s) => s.entities);
  const camera = useMapStore((s) => s.camera);
  const gridConfig = useMapStore((s) => s.gridConfig);

  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const characters = useCharacterStore((s) => s.characters);
  const isMaster = useRoleStore((s) => s.role) !== 'PLAYER';

  const items = useInventoryStore((s) => s.items);
  const addItem = useInventoryStore((s) => s.add);
  const removeItem = useInventoryStore((s) => s.remove);

  const [dialogOpen, setDialogOpen] = useState(false);

  // fecha o diálogo quando a seleção muda
  const selKey = selectedIds.join(',');
  useEffect(() => { setDialogOpen(false); }, [selKey]);

  if (selectedIds.length !== 1) return null;
  const selected = entities[selectedIds[0]];
  if (!selected) return null;

  const dpi = gridConfig.dpi || 70;
  const metersPerCell = gridConfig.metersPerCell || 1;

  // Helper: ficha vinculada e detecção de morto.
  const charOf = (e: typeof selected) =>
    e.characterId ? characters.find((c) => c.id === e.characterId) : undefined;
  const hpOf = (e: typeof selected) => {
    const c = charOf(e);
    return e.hp ?? c?.hpCurrent;
  };
  const isDeadEnt = (e: typeof selected) => {
    const h = hpOf(e);
    return h !== undefined && h <= 0;
  };

  // O alvo morto: ou o próprio selecionado, ou o token morto mais próximo
  // do selecionado (até 1.5m), para o jogador não precisar adivinhar qual clicar.
  let ent = isDeadEnt(selected) ? selected : null;
  if (!ent) {
    const sx = selected.x + selected.w / 2;
    const sy = selected.y + selected.h / 2;
    const sr = Math.max(selected.w, selected.h) / 2;
    let best = Infinity;
    for (const e of Object.values(entities)) {
      if (e.id === selected.id) continue;
      if (!isDeadEnt(e)) continue;
      const ex = e.x + e.w / 2;
      const ey = e.y + e.h / 2;
      const r = Math.max(e.w, e.h) / 2;
      const edge = Math.max(0, Math.hypot(ex - sx, ey - sy) - r - sr);
      const cells = edge / dpi;
      if (cells <= LOOT_RANGE_CELLS && cells < best) {
        best = cells;
        ent = e;
      }

    }
  }
  if (!ent) return null;
  const linkedChar = charOf(ent);


  // Determina looter: dono == perfil ativo.


  const cx = ent.x + ent.w / 2;
  const cy = ent.y + ent.h / 2;
  const rDead = Math.max(ent.w, ent.h) / 2;

  let looterEntityId: string | null = null;
  let looterCharId: string | null = null;
  let bestDistCells = Infinity;

  // Procura QUALQUER token-de-personagem próximo (independe de quem é o dono),
  // pois muitos players esquecem de configurar o profile ativo e ainda assim
  // querem saquear ao chegar perto do corpo.
  for (const e of Object.values(entities)) {
    if (e.id === ent.id) continue;
    if (!e.characterId) continue;
    const ex = e.x + e.w / 2;
    const ey = e.y + e.h / 2;
    const r = Math.max(e.w, e.h) / 2;
    const dist = Math.hypot(ex - cx, ey - cy);
    const edge = Math.max(0, dist - rDead - r);
    const cells = edge / dpi;

    // Se há activeProfileId, prefere tokens do próprio profile;
    // senão aceita qualquer um.
    const ownedByMe = !activeProfileId || e.ownerProfileId === activeProfileId;
    if (!ownedByMe && !isMaster) {
      // jogador comum só pode saquear com tokens próprios
      continue;
    }
    if (cells < bestDistCells) {
      bestDistCells = cells;
      looterEntityId = e.id;
      looterCharId = e.characterId;
    }
  }
  void looterEntityId;

  const inRange = bestDistCells <= LOOT_RANGE_CELLS;

  // Mestre pode sempre saquear (ainda que sem token próprio próximo).
  const canOpen = inRange || isMaster;
  if (!canOpen) return null;


  // Posição do botão: abaixo do token.
  const aabb = entityAABB(ent);
  const screenX = ((aabb.x + aabb.x2) / 2 + camera.x) * camera.scale;
  const screenY = (aabb.y2 + camera.y) * camera.scale;

  const deadCharId = ent.characterId ?? ent.id;

  return (
    <>
      <div
        className="absolute z-40 pointer-events-auto"
        style={{ left: screenX, top: screenY + 8, transform: 'translateX(-50%)' }}
      >
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-amber-700/60 bg-black/80 px-3 py-1.5 text-xs font-semibold text-amber-200 shadow-2xl hover:bg-amber-900/40"
        >
          <Skull className="h-3.5 w-3.5" />
          Saquear
          {inRange && Number.isFinite(bestDistCells) && (
            <span className="text-[10px] text-amber-300/70">({bestDistCells.toFixed(1)} blocos)</span>

          )}
        </button>
      </div>
      {dialogOpen && (
        <LootDialog
          deadCharId={deadCharId}
          deadName={linkedChar?.name ?? ent.label ?? 'Caído'}
          mainHand={linkedChar?.mainHandWeaponName ?? null}
          offHand={linkedChar?.offHandWeaponName ?? null}
          looterCharId={looterCharId}
          isMaster={isMaster}
          characters={characters}
          onClose={() => setDialogOpen(false)}
          getItems={() =>
            Object.values(items).filter((i) => i.ownerId === deadCharId)
          }
          onTake={(inst, receiverId) => {
            addItem(receiverId, inst.entity);
            removeItem(inst.instanceId);
            toast({ title: 'Item recolhido', description: inst.entity.nome });
          }}
        />
      )}
    </>
  );
}

interface LootDialogProps {
  deadCharId: string;
  deadName: string;
  mainHand: string | null;
  offHand: string | null;
  looterCharId: string | null;
  isMaster: boolean;
  characters: ReturnType<typeof useCharacterStore.getState>['characters'];
  onClose: () => void;
  getItems: () => InventoryItem[];
  onTake: (inst: InventoryItem, receiverId: string) => void;
}

function LootDialog({
  deadCharId, deadName, mainHand, offHand,
  looterCharId, isMaster, characters,
  onClose, getItems, onTake,
}: LootDialogProps) {
  const [receiverId, setReceiverId] = useState<string>(looterCharId ?? '');

  // Lista candidatos a receber: fichas do perfil ativo + (se mestre) todas.
  const receivers = useMemo(() => {
    if (isMaster) return characters.filter((c) => c.id !== deadCharId);
    return characters.filter((c) => c.id === looterCharId);
  }, [characters, isMaster, looterCharId, deadCharId]);

  useEffect(() => {
    if (!receiverId && receivers.length > 0) setReceiverId(receivers[0].id);
  }, [receivers, receiverId]);

  // Sub-componente re-renderiza quando o inventário muda via subscribe (já reativo
  // porque inv store é zustand global e itens são lidos via getItems no render).
  const inv = useInventoryStore((s) => s.items);
  void inv; // garante reatividade
  const all = getItems();
  const sorted = sortLoot(all, mainHand, offHand);

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="relative w-[520px] max-w-[92vw] rounded-md border border-amber-900/60 bg-[#0c0a08] text-amber-50 shadow-[0_0_60px_rgba(0,0,0,0.85)]"
        style={{ fontFamily: 'serif' }}
      >
        <div className="flex items-center justify-between border-b border-amber-900/40 px-4 py-2">
          <div className="flex items-center gap-2 text-amber-200">
            <Skull className="h-4 w-4" />
            <span className="text-sm uppercase tracking-widest">Saque — {deadName}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-amber-300/70 hover:bg-amber-900/30 hover:text-amber-100"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isMaster && receivers.length > 0 && (
          <div className="border-b border-amber-900/30 px-4 py-2 text-xs text-amber-200/80">
            <label className="mr-2">Quem recebe:</label>
            <select
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              className="rounded border border-amber-900/40 bg-black/40 px-2 py-1 text-xs text-amber-100"
            >
              {receivers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {sorted.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-amber-200/60">
              Nada para saquear.
            </div>
          )}
          {sorted.map(({ item, bucket }) => (
            <LootRow
              key={item.instanceId}
              item={item}
              badge={
                bucket === 'weapon' ? 'Equipada' :
                bucket === 'accessory' ? 'Acessório' :
                null
              }
              disabled={!receiverId}
              onClick={() => receiverId && onTake(item, receiverId)}
            />
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-amber-900/40 px-4 py-2 text-[11px] text-amber-300/60">
          <span>[Clique] Pegar</span>
          <button
            onClick={onClose}
            className="text-amber-200/80 hover:text-amber-100"
          >
            [ESC] Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LootRow({
  item, badge, disabled, onClick,
}: {
  item: InventoryItem;
  badge: string | null;
  disabled?: boolean;
  onClick: () => void;
}) {
  const [showTip, setShowTip] = useState(false);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const timer = useRef<number | null>(null);
  const rowRef = useRef<HTMLButtonElement>(null);

  const e = item.entity;
  const imgSrc = isImageSrc(e.icone) ? e.icone : null;
  const emoji = !imgSrc && e.icone ? e.icone : null;

  const startTimer = (clientX: number, clientY: number) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setTipPos({ x: clientX, y: clientY });
      setShowTip(true);
    }, HOVER_DELAY_MS);
  };
  const cancelTimer = () => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    setShowTip(false);
  };

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  return (
    <>
      <button
        ref={rowRef}
        disabled={disabled}
        onMouseEnter={(ev) => startTimer(ev.clientX, ev.clientY)}
        onMouseMove={(ev) => { if (!showTip) startTimer(ev.clientX, ev.clientY); }}
        onMouseLeave={cancelTimer}
        onClick={() => { cancelTimer(); onClick(); }}
        className="group flex w-full items-center gap-3 rounded-sm border border-transparent px-2 py-2 text-left hover:border-amber-700/50 hover:bg-amber-900/15 disabled:opacity-40"
      >
        {/* Espaço reservado para imagem do item */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-amber-900/40 bg-black/50 text-amber-300/80">
          {imgSrc ? (
            <img src={imgSrc} alt="" className="h-full w-full rounded object-cover" />
          ) : emoji ? (
            <span className="text-xl leading-none">{emoji}</span>
          ) : (
            <Package className="h-4 w-4 opacity-60" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-amber-100">{e.nome || 'Item sem nome'}</div>
          <div className="truncate text-[10px] uppercase tracking-wider text-amber-300/50">
            {e.categoria}{badge ? ` · ${badge}` : ''}
          </div>
        </div>
        {item.usosTotais !== undefined && (
          <div className="shrink-0 rounded border border-amber-900/40 bg-black/40 px-1.5 py-0.5 text-[10px] text-amber-200/80">
            x{item.usosRestantes ?? 0}/{item.usosTotais}
          </div>
        )}
      </button>
      {showTip && createPortal(
        <div
          className="pointer-events-none fixed z-[1200] max-w-xs rounded-md border border-amber-900/60 bg-[#0c0a08] p-2 text-xs text-amber-100 shadow-2xl"
          style={{ left: Math.min(tipPos.x + 12, window.innerWidth - 320), top: Math.min(tipPos.y + 12, window.innerHeight - 200) }}
        >
          <div className="mb-1 text-sm font-semibold text-amber-200">{e.nome}</div>
          <div className="whitespace-pre-wrap text-amber-100/90">
            {e.descricao || 'Sem descrição.'}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
