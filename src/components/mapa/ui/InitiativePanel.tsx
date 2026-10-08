/**
 * InitiativePanel — Tracker de iniciativa (Fase 9).
 *
 * Painel flutuante no canto inferior esquerdo do canvas, com:
 *   - lista ordenada por iniciativa (desc)
 *   - turno atual em destaque, contador de round
 *   - add manual, remover, editar nome/init/HP inline
 *   - prev/next turn, ordenar, rolar todos d20, resetar
 *   - "centralizar" a câmera no token do turno atual
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Swords, Plus, Trash2, ChevronLeft, ChevronRight, Dices,
  ListOrdered, RotateCcw, Target, Check, X, Megaphone, Loader2,
} from 'lucide-react';
import { useMapStore, type InitiativeEntry } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { useLogStore } from '@/stores/useLogStore';
import { rollD20 } from '@/lib/dice';
import { getAttrModifier } from '@/components/fichas/CharacterCard';


interface Props { onClose: () => void; }

const SIDE_COLORS: Record<NonNullable<InitiativeEntry['side']>, string> = {
  pc: '#7dd3fc',
  ally: '#86efac',
  enemy: '#fca5a5',
  neutral: '#d4d4d8',
};

export function InitiativePanel({ onClose }: Props) {
  const init = useMapStore((s) => s.initiative);
  const entities = useMapStore((s) => s.entities);
  const setCamera = useMapStore((s) => s.setCamera);

  const addInitiative = useMapStore((s) => s.addInitiative);
  const updateInitiative = useMapStore((s) => s.updateInitiative);
  const removeInitiative = useMapStore((s) => s.removeInitiative);
  const sortInitiative = useMapStore((s) => s.sortInitiative);
  const rollAll = useMapStore((s) => s.rollAllInitiative);
  const nextTurn = useMapStore((s) => s.nextTurn);
  const prevTurn = useMapStore((s) => s.prevTurn);
  const resetEncounter = useMapStore((s) => s.resetEncounter);

  const containerRef = useRef<HTMLDivElement>(null);

  const ordered = useMemo(
    () => [...init.entries].sort((a, b) => b.init - a.init),
    [init.entries],
  );
  const activeEntryId = init.entries[init.turnIndex]?.id;

  const focusEntity = (entityId?: string) => {
    if (!entityId) return;
    const en = entities[entityId];
    if (!en) return;
    // Centraliza câmera no token (mantém zoom)
    const { camera } = useMapStore.getState();
    const containerEl = document.querySelector('canvas')?.parentElement;
    const vw = containerEl?.clientWidth ?? window.innerWidth;
    const vh = containerEl?.clientHeight ?? window.innerHeight;
    setCamera({
      x: vw / 2 / camera.scale - en.x,
      y: vh / 2 / camera.scale - en.y,
    });
  };

  // ── Pedir Iniciativa (multi-player) ──────────────────────────────────
  // GM dispara TestRequest 'skill' (Iniciativa) para cada PLAYER da lista,
  // rola d20 localmente para NPC/inimigos, e quando TODOS responderam,
  // ordena + chama startCombat automaticamente.
  const [pendingBatchId, setPendingBatchId] = useState<string | null>(null);
  const requests = useTestRequestStore((s) => s.requests);
  const enqueueReq = useTestRequestStore((s) => s.enqueue);
  const dismissReq = useTestRequestStore((s) => s.dismiss);
  const addLog = useLogStore((s) => s.addLog);

  const batchRequests = useMemo(() => {
    if (!pendingBatchId) return [];
    return requests.filter((r) => r.sourceTag?.startsWith(`init-batch::${pendingBatchId}::`));
  }, [requests, pendingBatchId]);

  const askInitiative = () => {
    if (init.entries.length === 0) {
      window.alert('Adicione participantes antes de pedir iniciativa.');
      return;
    }
    const batchId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const allChars = useCharacterStore.getState().characters;
    const ents = useMapStore.getState().entities;
    let askedPlayers = 0;
    for (const entry of init.entries) {
      const ent = entry.entityId ? ents[entry.entityId] : undefined;
      const charId = ent?.characterId;
      const ch = charId ? allChars.find((c) => c.id === charId) : null;
      const astucia = ch?.attributes.find((a) => a.name === 'Astúcia');
      const bonus = astucia ? getAttrModifier(astucia.value) : 0;
      // Toda ficha PLAYER vinculada é rolada pelo perfil dono, mesmo quando
      // a ficha foi originalmente criada pelo Mestre. Sem vínculo, o Mestre rola.
      const isPlayerCh = !!ch && ch.category === 'PLAYER' && !!ch.profileId;
      if (isPlayerCh) {
        enqueueReq({
          charId: ch.id,
          charName: ch.name,
          targetProfileId: ch.profileId,
          kind: 'skill',
          testName: 'Iniciativa',
          bonusOverride: bonus,
          bonusBreakdownOverride: `Astúcia ${bonus >= 0 ? '+' : ''}${bonus}`,
          sourceTag: `init-batch::${batchId}::${entry.id}`,
          note: 'O Mestre iniciou um combate. Role sua iniciativa.',
        });
        askedPlayers += 1;
      } else {
        // Local: NPC/inimigo/sem ficha → GM rola agora.
        const d20 = Math.floor(Math.random() * 20) + 1;
        const total = d20 + bonus;
        updateInitiative(entry.id, { init: total });
      }
    }
    if (askedPlayers > 0) {
      setPendingBatchId(batchId);
      addLog('system', `📣 Iniciativa solicitada para ${askedPlayers} jogador(es). Aguardando rolagens…`);
    } else {
      // Sem jogadores → ordena e começa imediatamente.
      finalizeInitiativeBatch();
    }
  };

  const finalizeInitiativeBatch = () => {
    sortInitiative();
    // Monta entries para o store de combate a partir das entries com charId.
    const ents = useMapStore.getState().entities;
    const all = useCharacterStore.getState().characters;
    const combatEntries = useMapStore.getState().initiative.entries
      .map((e) => {
        const ent = e.entityId ? ents[e.entityId] : undefined;
        const ch = ent?.characterId ? all.find((c) => c.id === ent.characterId) : null;
        if (!ch) return null;
        const astucia = ch.attributes.find((a) => a.name === 'Astúcia');
        const bonus = astucia ? getAttrModifier(astucia.value) : 0;
        return {
          charId: ch.id,
          charName: ch.name,
          roll: Math.max(1, e.init - bonus),
          bonus,
          total: e.init,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    if (combatEntries.length > 0) {
      useCombatStore.getState().startCombat(combatEntries);
      addLog('combat', `⚔️ Combate iniciado com ${combatEntries.length} participante(s).`);
    }
  };

  // Quando todos os pedidos do batch tiverem resultado → fecha o lote.
  useEffect(() => {
    if (!pendingBatchId) return;
    if (batchRequests.length === 0) return;
    const allDone = batchRequests.every((r) => r.result);
    if (!allDone) return;
    // Aplica resultados nas entries.
    for (const r of batchRequests) {
      const match = r.sourceTag?.match(/^init-batch::[^:]+::(.+)$/);
      const entryId = match?.[1];
      if (entryId && r.result) {
        updateInitiative(entryId, { init: r.result.total });
      }
      dismissReq(r.id);
    }
    setPendingBatchId(null);
    // Próximo tick: combat store já tem os totals atualizados.
    setTimeout(finalizeInitiativeBatch, 0);
  }, [batchRequests, pendingBatchId]);

  const waitingCount = batchRequests.filter((r) => !r.result).length;

  return (
    <div
      ref={containerRef}
      className="absolute left-3 bottom-3 w-72 rounded-lg shadow-xl flex flex-col text-xs pointer-events-auto"
      style={{
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        color: 'hsl(var(--foreground))',
        maxHeight: 'calc(100% - 80px)',
        zIndex: 20,
      }}
    >
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-3 h-9 border-b border-border shrink-0">
        <Swords className="h-4 w-4 text-amber-300" />
        <span className="font-medium text-foreground">Iniciativa</span>
        <span className="ml-2 px-1.5 py-0.5 rounded bg-secondary text-xs tracking-wider uppercase text-muted-foreground">
          Round {init.round}
        </span>
        <button
          onClick={onClose}
          className="ml-auto text-muted-foreground hover:text-foreground"
          title="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {ordered.length === 0 && (
          <div className="text-muted-foreground text-center py-6 px-2">
            Nenhum combatente. Adicione tokens pelo menu de contexto ou pelo botão abaixo.
          </div>
        )}
        {ordered.map((e) => {
          const isActive = e.id === activeEntryId;
          const sideColor = SIDE_COLORS[e.side ?? 'neutral'];
          return (
            <div
              key={e.id}
              className="flex items-center gap-2 rounded px-2 py-1.5"
              style={{
                background: isActive ? 'rgba(252,211,77,0.10)' : 'hsl(var(--secondary))',
                border: `1px solid ${isActive ? '#fcd34d' : 'hsl(var(--border))'}`,
              }}
            >
              <div
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: sideColor }}
                title={e.side ?? 'neutral'}
              />
              <input
                value={e.name}
                onChange={(ev) => updateInitiative(e.id, { name: ev.target.value })}
                className="flex-1 min-w-0 bg-transparent outline-none text-foreground"
              />
              {(e.hpMax ?? 0) > 0 && (
                <input
                  type="number"
                  value={e.hp ?? 0}
                  onChange={(ev) => updateInitiative(e.id, { hp: Number(ev.target.value) })}
                  className="w-10 bg-card border border-border rounded px-1 py-0.5 text-foreground text-right"
                  title="HP atual"
                />
              )}
              <input
                type="number"
                value={e.init}
                onChange={(ev) => updateInitiative(e.id, { init: Number(ev.target.value) })}
                className="w-10 bg-card border border-border rounded px-1 py-0.5 text-foreground text-right font-medium"
                title="Iniciativa"
              />
              {e.entityId && (
                <button
                  onClick={() => focusEntity(e.entityId)}
                  className="text-muted-foreground hover:text-amber-300"
                  title="Centralizar no mapa"
                >
                  <Target className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => removeInitiative(e.id)}
                className="text-muted-foreground hover:text-red-300"
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Controles */}
      <div className="border-t border-border p-2 space-y-2 shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={prevTurn}
            disabled={!ordered.length}
            className="h-7 px-2 rounded border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed text-foreground/80 flex items-center gap-1"
          >
            <ChevronLeft className="h-3 w-3" />
            Anterior
          </button>
          <button
            onClick={() => {
              // Em combate, o avanço precisa passar pelo combate (auras, efeitos contínuos, TRs).
              void import('@/stores/useCombatStore').then(({ useCombatStore }) => {
                const cs = useCombatStore.getState();
                if (cs.inCombat && cs.initiativeOrder.length) { cs.nextTurn(); return; }
                nextTurn();
                // Iniciativa só do mapa: ainda assim dispara as auras de início de turno.
                const ms = useMapStore.getState();
                const ini = ms.initiative;
                const atual = ini.entries[ini.turnIndex];
                if (!atual) return;
                void import('@/lib/omni/auras').then(({ verificarAurasInicioTurno, charIdDaEntradaIniciativa }) => {
                  const charId = charIdDaEntradaIniciativa(atual.entityId, atual.name);
                  if (charId) verificarAurasInicioTurno(charId, ini.round);
                });
              });
            }}
            disabled={!ordered.length}
            className="h-7 px-2 rounded text-accent-foreground font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            style={{ background: '#fcd34d' }}
          >
            Próximo
            <ChevronRight className="h-3 w-3" />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => {
              if (confirm('Reiniciar encontro? (round 1, índice 0)')) resetEncounter();
            }}
            className="h-7 w-7 flex items-center justify-center rounded border border-border hover:bg-secondary text-muted-foreground"
            title="Reiniciar encontro"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={async () => {
              const init = await rollD20();
              const id = addInitiative({
                name: 'Novo',
                init,
                side: 'neutral',
              });
              // foca no input depois (best effort)
              setTimeout(() => {
                const input = containerRef.current?.querySelector<HTMLInputElement>(
                  `input[value="Novo"]`,
                );
                input?.focus();
                input?.select();
                void id;
              }, 0);
            }}
            className="h-7 px-2 flex items-center gap-1 rounded border border-border hover:bg-secondary text-foreground/80"
          >
            <Plus className="h-3 w-3" /> Manual
          </button>

          <button
            onClick={sortInitiative}
            className="h-7 px-2 flex items-center gap-1 rounded border border-border hover:bg-secondary text-foreground/80"
            title="Ordenar por iniciativa"
          >
            <ListOrdered className="h-3 w-3" /> Ordenar
          </button>
          <button
            onClick={rollAll}
            className="h-7 px-2 flex items-center gap-1 rounded border border-border hover:bg-secondary text-foreground/80"
            title="Rolar 1d20 para todos (local)"
          >
            <Dices className="h-3 w-3" /> Rolar
          </button>
          <button
            onClick={askInitiative}
            disabled={!!pendingBatchId}
            className="h-7 px-2 flex items-center gap-1 rounded border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Pedir iniciativa aos jogadores e iniciar combate quando todos rolarem"
          >
            {pendingBatchId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Megaphone className="h-3 w-3" />}
            {pendingBatchId ? `Aguardando ${waitingCount}` : 'Pedir & Iniciar'}
          </button>
          <div className="flex-1" />
          <span className="text-muted-foreground tabular-nums">
            <Check className="inline h-3 w-3 mr-0.5" />
            {init.turnIndex + (ordered.length ? 1 : 0)}/{ordered.length}
          </span>
        </div>
      </div>
    </div>
  );
}
