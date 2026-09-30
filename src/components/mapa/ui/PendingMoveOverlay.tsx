/**
 * PendingMoveOverlay — Confirma/cancela movimento em combate.
 *
 * Aparece quando há um `pendingMove` no MapStore. Mostra a distância
 * percorrida + restante e botões OK / Cancelar próximos ao token.
 */
import { Check, X } from 'lucide-react';
import { useMapStore } from '@/stores/useMapStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useOpportunityStore } from '@/stores/useOpportunityStore';
import { detectOpportunityCandidates } from '../opportunityEngine';
import { detectarZonaRisco } from '@/lib/zonaRisco';
import { getSocket } from '@/lib/socket';
import { holdLocalMapSync } from '../mapSyncGuards';
import { combatMoveBudget } from '@/lib/movementBudget';
import { isFreeformFor } from '@/lib/freeformMode';


export function PendingMoveOverlay() {
  const pending = useMapStore((s) => s.pendingMove);
  const entities = useMapStore((s) => s.entities);
  const camera = useMapStore((s) => s.camera);
  const gridConfig = useMapStore((s) => s.gridConfig);
  const setPendingMove = useMapStore((s) => s.setPendingMove);
  const updateEntity = useMapStore((s) => s.updateEntity);
  const addMovementUsed = useCombatStore((s) => s.addMovementUsed);
  const movementUsed = useCombatStore((s) => s.movementUsedByChar);
  const freeformMode = useCombatStore((s) => s.freeformMode);
  const character = useCharacterStore((s) =>
    pending ? s.characters.find((c) => c.id === pending.charId) : undefined,
  );

  if (!pending) return null;
  const ent = entities[pending.entityId];
  if (!ent) return null;

  const combatNow = useCombatStore.getState();
  const isActiveTurn = !combatNow.inCombat || combatNow.initiativeOrder[combatNow.currentTurnIndex]?.charId === pending.charId;
  const isFreeform = isActiveTurn && isFreeformFor(character, freeformMode);
  const used = movementUsed[pending.charId] ?? 0;
  const total = isFreeform ? Infinity : (combatMoveBudget(character, isActiveTurn) ?? 0);
  const remaining = isFreeform ? Infinity : Math.max(0, total - used - pending.distM);

  const confirm = () => {
    addMovementUsed(pending.charId, pending.distM);
    // ─── Ataque de Oportunidade ──────────────────────────────────────────
    try {
      const oppState = useOpportunityStore.getState();
      const chars = useCharacterStore.getState().characters;
      const charNames: Record<string, string> = {};
      for (const c of chars) charNames[c.id] = c.name;
      const movingChar = useCharacterStore.getState().characters.find((c) => c.id === pending.charId);
      const candidates = movingChar?.desengajado ? [] : detectOpportunityCandidates({
        moving: ent,
        prevX: pending.startX,
        prevY: pending.startY,
        entities,
        grants: oppState.grants,
        charNames,
        grid: gridConfig,
      });
      if (candidates.length > 0) {
        oppState.setPending({
          id: `${Date.now().toString(36)}`,
          triggerCharId: pending.charId,
          triggerCharName: charNames[pending.charId] ?? ent.label ?? 'Personagem',
          triggerEntityId: ent.id,
          candidates,
          createdAt: Date.now(),
        });
      }
    } catch { /* ignore */ }
    // ─── Zona de Risco (Especialista em Combate) ─────────────────────────
    try { detectarZonaRisco(pending.charId); } catch { /* ignore */ }
    setPendingMove(null);
  };
  const cancel = () => {
    const patch = { x: pending.startX, y: pending.startY };
    holdLocalMapSync(1500, [pending.entityId]);
    updateEntity(pending.entityId, patch);
    // Replica o rollback aos peers imediatamente (mesmo canal usado pelo drag),
    // evitando que um broadcast atrasado de mapScene de outro cliente reverta
    // a posição de volta ao ponto onde o token foi solto.
    try {
      const w = window as unknown as {
        __worldBus?: { send: (a: unknown) => void };
        __worldBusClientId?: string;
      };
      const payload = {
        clientId: w.__worldBusClientId,
        patches: [{ id: pending.entityId, patch }],
      };
      w.__worldBus?.send({ type: 'broadcast', event: 'entity-patch', payload });
      getSocket()?.emit('entity:patch', payload);
    } catch { /* ignore */ }
    setPendingMove(null);
  };


  // Posição na tela: abaixo do token.
  const screenX = (ent.x + camera.x) * camera.scale;
  const screenY = (ent.y + ent.h / 2 + camera.y) * camera.scale;

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: screenX, top: screenY + 16, transform: 'translate(-50%, 0)', zIndex: 40 }}
    >
      <div className="pointer-events-auto flex flex-col items-center gap-1">
        <div className="rounded-md border border-border bg-card/95 backdrop-blur px-2 py-0.5 text-[11px] font-mono text-amber-200 shadow-lg tabular-nums">
          {pending.distM.toFixed(1)}m{Number.isFinite(remaining) ? ` · resta ${remaining.toFixed(1)}m` : ' · livre'}
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border bg-card/95 backdrop-blur px-1 py-1 shadow-xl">
          <button
            onClick={confirm}
            title="Confirmar movimento"
            className="h-7 w-7 flex items-center justify-center rounded-full bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-200"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={cancel}
            title="Cancelar movimento"
            className="h-7 w-7 flex items-center justify-center rounded-full bg-rose-500/20 hover:bg-rose-500/40 text-rose-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
