import { comPreviaMovimento, confirmarMovimentoMapa } from '@/lib/mapa/movimentoConfirmado';
import { notificarEventoPersonagem } from '@/lib/omni/notificarEvento';
import { useRef, useState } from 'react';
import { abrirJanelaReacaoAtiva, ofertasReacaoAtiva } from '@/lib/omni/reacoesAtivas';
import { amostrarTrajetoria } from '@/lib/omni/geometriaReacao';
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
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { selectOmniModifiers } from '@/lib/omni/omniBridge';
import { useOpportunityStore } from '@/stores/useOpportunityStore';
import { detectOpportunityCandidates } from '../opportunityEngine';
import { detectarZonaRisco } from '@/lib/zonaRisco';
import { getSocket } from '@/lib/socket';
import { holdLocalMapSync } from '../mapSyncGuards';
import { combatMoveBudget } from '@/lib/movementBudget';
import { isFreeformFor } from '@/lib/freeformMode';
import { confirmarMovimentoInvocacao } from '@/lib/controlador/mapa';
import { deslocamentoInvocacaoM } from '@/lib/controlador/dezSombrasMovimento';
import { toast } from '@/hooks/use-toast';
import { hasLancaReactionSuppression } from '@/lib/conditionEffects';
import { routePrefixByDistance } from '@/lib/mapa/terrenoDificil';


export function PendingMoveOverlay() {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const pending = useMapStore((s) => s.pendingMove);
  const entities = useMapStore((s) => s.entities);
  const camera = useMapStore((s) => s.camera);
  const gridConfig = useMapStore((s) => s.gridConfig);
  const setPendingMove = useMapStore((s) => s.setPendingMove);
  const updateEntity = useMapStore((s) => s.updateEntity);
  const addMovementUsed = useCombatStore((s) => s.addMovementUsed);
  const resolveLancaAdvanceMovement = useCombatStore((s) => s.resolveLancaAdvanceMovement);
  const movementUsed = useCombatStore((s) => s.movementUsedByChar);
  const freeformMode = useCombatStore((s) => s.freeformMode);
  const character = useCharacterStore((s) =>
    pending ? s.characters.find((c) => c.id === pending.charId) : undefined,
  );
  const inventoryItems = useInventoryStore((s) => s.items);
  const omniEntidades = useOmniEntidadesStore((s) => s.entidades);

  if (!pending) return null;
  const ent = entities[pending.entityId];
  if (!ent) return null;

  const combatNow = useCombatStore.getState();
  const isInvocationMove = !!pending.invocationInstanceId;
  const isActiveTurn = !combatNow.inCombat || combatNow.initiativeOrder[combatNow.currentTurnIndex]?.charId === pending.charId;
  const isFreeform = isActiveTurn && isFreeformFor(character, freeformMode);
  const used = movementUsed[pending.charId] ?? 0;
  const equipped = Object.values(inventoryItems).filter((item) => item.ownerId === pending.charId && item.isEquipped && item.equippedSlot);
  const bonusDeslocamento = character ? selectOmniModifiers(character, equipped, omniEntidades).deslocamento : 0;
  const total = isInvocationMove
    ? deslocamentoInvocacaoM(ent.id, pending.invocationMovementMode)
    : isFreeform ? Infinity : (combatMoveBudget(character, isActiveTurn, bonusDeslocamento) ?? 0);
  const remaining = isFreeform && !isInvocationMove ? Infinity : Math.max(0, total - (isInvocationMove ? 0 : used) - pending.distM);

  const confirm = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try {
      const de = { x: pending.startX, y: pending.startY }, para = { x: ent.x, y: ent.y };
      const movimento = { de, para, trajetoria: pending.trail.length ? pending.trail : amostrarTrajetoria(de, para, (gridConfig.dpi || 70) / 4) };
      if (isInvocationMove) {
        const resultado = confirmarMovimentoInvocacao({
          tokenId: pending.entityId,
          instanciaId: pending.invocationInstanceId!,
          de,
          para,
          trajetoria: movimento.trajetoria,
          distanciaM: pending.distM,
          requestId: pending.movementRequestId ?? `movimento-${crypto.randomUUID()}`,
        });
        if (!resultado.ok) {
          toast({ title: 'Movimento não confirmado', description: resultado.motivo, variant: 'destructive' });
          cancel();
          return;
        }
        const confirmado = useMapStore.getState().entities[pending.entityId];
        if (confirmado) {
          holdLocalMapSync(1500, [pending.entityId]);
          const w = window as unknown as {
            __worldBus?: { send: (a: unknown) => void };
            __worldBusClientId?: string;
          };
          const payload = {
            clientId: w.__worldBusClientId,
            at: Date.now(),
            patches: [{ id: pending.entityId, patch: {
              x: confirmado.x,
              y: confirmado.y,
              ...(pending.invocationMovementMode ? { invocationMovementMode: pending.invocationMovementMode } : {}),
            } }],
          };
          try {
            w.__worldBus?.send({ type: 'broadcast', event: 'entity-patch', payload });
            getSocket()?.emit('entity:patch', payload);
          } catch { /* offline */ }
        }
        setPendingMove(null);
        return;
      }
      for (const gatilho of ['quando_inimigo_sair_alcance', 'quando_inimigo_entrar_alcance'] as const) {
        const evento = { gatilho, origemId: pending.charId, movimento };
        const r = ofertasReacaoAtiva(evento).length ? await abrirJanelaReacaoAtiva(evento) : { cancelado: false };
        const atual = useMapStore.getState().entities[pending.entityId];
        const ficha = useCharacterStore.getState().characters.find(c => c.id === pending.charId);
        if (useMapStore.getState().pendingMove !== pending) return;
        if (!atual || atual.x !== ent.x || atual.y !== ent.y) {
          setPendingMove(null);
          if (pending.lancaAdvanceId) resolveLancaAdvanceMovement(pending.lancaAdvanceId, 'interrupted');
          return;
        }
        if (r.cancelado || (ficha?.hpCurrent ?? 1) <= 0) { cancel(); return; }
      }
    addMovementUsed(pending.charId, pending.distM);
    if (pending.distM > 0) notificarEventoPersonagem('aoMover', pending.charId, 'Movimento Confirmado');
    // ─── Ataque de Oportunidade ──────────────────────────────────────────
    try {
      const oppState = useOpportunityStore.getState();
      const chars = useCharacterStore.getState().characters;
      const suppressedReactionIds = new Set(chars.filter(hasLancaReactionSuppression).map((character) => character.id));
      const charNames: Record<string, string> = {};
      for (const c of chars) charNames[c.id] = c.name;
      const movingChar = useCharacterStore.getState().characters.find((c) => c.id === pending.charId);
      const fullCandidates = movingChar?.desengajado ? [] : detectOpportunityCandidates({
        moving: ent,
        prevX: pending.startX,
        prevY: pending.startY,
        trajetoria: movimento.trajetoria,
        entities,
        grants: oppState.grants,
        charNames,
        grid: gridConfig,
      });
      const safeRemainingM = Math.max(0, movingChar?.baculoAetherisSafeMoveRemainingM ?? 0);
      const actualDistanceM = Math.max(0, pending.actualDistM ?? pending.distM);
      const metersPerPx = (gridConfig.metersPerCell || 1.5) / (gridConfig.dpi || 70);
      const safeRoute = safeRemainingM > 0
        ? routePrefixByDistance([de, ...movimento.trajetoria, para], Math.min(safeRemainingM, actualDistanceM), metersPerPx)
        : [];
      const safeEnd = safeRoute[safeRoute.length - 1];
      const safeCandidates = safeRemainingM > 0 && safeEnd ? detectOpportunityCandidates({
        moving: { ...ent, x: safeEnd.x, y: safeEnd.y },
        prevX: pending.startX,
        prevY: pending.startY,
        trajetoria: safeRoute.slice(1),
        entities,
        grants: oppState.grants,
        charNames,
        grid: gridConfig,
      }) : [];
      const safeCandidateEntityIds = new Set(safeCandidates.map((cand) => cand.entityId));
      const candidates = fullCandidates.filter((cand) =>
        !safeCandidateEntityIds.has(cand.entityId)
        && !(movingChar?.desengajadoDe ?? []).includes(cand.charId) && !suppressedReactionIds.has(cand.charId),
      );
      if (safeRemainingM > 0 && movingChar) {
        useCharacterStore.getState().updateCharacter(pending.charId, {
          baculoAetherisSafeMoveRemainingM: Math.max(0, safeRemainingM - actualDistanceM),
        });
      }
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
    confirmarMovimentoMapa(pending.entityId, de, movimento.trajetoria);
    if (pending.lancaAdvanceId) resolveLancaAdvanceMovement(pending.lancaAdvanceId, 'ready');
    } finally { locked.current = false; setBusy(false); }
  };
  const cancel = () => {
    const patch = { x: pending.startX, y: pending.startY };
    holdLocalMapSync(1500, [pending.entityId]);
    comPreviaMovimento(() => updateEntity(pending.entityId, patch));
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
        at: Date.now(),
        patches: [{ id: pending.entityId, patch }],
      };
      w.__worldBus?.send({ type: 'broadcast', event: 'entity-patch', payload });
      getSocket()?.emit('entity:patch', payload);
    } catch { /* ignore */ }
    setPendingMove(null);
    if (pending.lancaAdvanceId) resolveLancaAdvanceMovement(pending.lancaAdvanceId, 'interrupted');
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
        <div className="rounded-md border border-border bg-card/95 backdrop-blur px-2 py-0.5 text-xs font-mono text-amber-200 shadow-lg tabular-nums">
          {pending.distM.toFixed(1)}m de custo{pending.actualDistM !== undefined && Math.abs(pending.distM - pending.actualDistM) > 0.05 ? ` (${pending.actualDistM.toFixed(1)}m real)` : ''} | {Number.isFinite(remaining) ? ` · resta ${remaining.toFixed(1)}m` : ' · livre'}{isInvocationMove ? ' · ação própria' : ''}
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border bg-card/95 backdrop-blur px-1 py-1 shadow-xl">
          <button
            disabled={busy}
            onClick={confirm}
            title="Confirmar movimento"
            className="h-7 w-7 flex items-center justify-center rounded-full bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-200"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            disabled={busy}
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
