/**
 * TurnTimer — cronômetro de turno controlado pelo Mestre.
 *
 * Mestre: define duração, pausa/retoma, adiciona/remove segundos e zera.
 * Quando o tempo zera, avança o turno automaticamente (via `useCombatStore.nextTurn`).
 *
 * Player: vê apenas a barra/contagem.
 */
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Minus, RotateCcw, Timer, TimerOff } from 'lucide-react';
import { useCombatStore } from '@/stores/useCombatStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useLogStore } from '@/stores/useLogStore';
import { cn } from '@/lib/utils';

const fmt = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

interface Props {
  className?: string;
  /** 'compact' para painel do mapa, 'full' para barra de Fichas, 'mini' para player. */
  layout?: 'compact' | 'full' | 'mini';
}

export function TurnTimer({ className, layout = 'compact' }: Props) {
  const isMaster = useRoleStore((s) => s.role !== 'PLAYER');
  const inCombat = useCombatStore((s) => s.inCombat);
  const enabled = useCombatStore((s) => s.turnTimerEnabled);
  const duration = useCombatStore((s) => s.turnDurationSec);
  const paused = useCombatStore((s) => s.turnPaused);
  const pausedForReaction = useCombatStore((s) => s.reactionPauseIds.length > 0);
  const effectivelyPaused = paused || pausedForReaction;
  // dependências para recomputar a cada mudança
  const startedAt = useCombatStore((s) => s.turnStartedAt);
  const remainingAtStart = useCombatStore((s) => s.turnRemainingAtStart);
  const setEnabled = useCombatStore((s) => s.setTurnTimerEnabled);
  const setDuration = useCombatStore((s) => s.setTurnDuration);
  const pause = useCombatStore((s) => s.pauseTurnTimer);
  const resume = useCombatStore((s) => s.resumeTurnTimer);
  const adjust = useCombatStore((s) => s.adjustTurnTime);
  const reset = useCombatStore((s) => s.resetTurnTimer);
  const nextTurn = useCombatStore((s) => s.nextTurn);
  const resetActions = useCharacterStore((s) => s.resetActions);
  const addLog = useLogStore((s) => s.addLog);

  const [remaining, setRemaining] = useState(() => useCombatStore.getState().getTurnRemaining());
  const advancedRef = useRef(false);

  // Tick local em todos os clientes (apenas para display). Apenas o Mestre
  // avança automaticamente o turno quando o tempo chega a zero.
  useEffect(() => {
    advancedRef.current = false;
    const id = window.setInterval(() => {
      const r = useCombatStore.getState().getTurnRemaining();
      setRemaining(r);
      if (
        isMaster &&
        enabled &&
        inCombat &&
        !effectivelyPaused &&
        r <= 0 &&
        !advancedRef.current
      ) {
        advancedRef.current = true;
        const { endOfRound } = nextTurn();
        if (endOfRound) resetActions();
        addLog('initiative', '⏱️ Tempo esgotado — turno avançado automaticamente.');
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [isMaster, enabled, inCombat, effectivelyPaused, startedAt, remainingAtStart, nextTurn, resetActions, addLog]);

  if (!inCombat) return null;

  // Players só veem se o cronômetro estiver ligado.
  if (!isMaster && !enabled) return null;

  const pct = duration > 0 ? Math.max(0, Math.min(100, (remaining / duration) * 100)) : 0;
  const barColor =
    pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-destructive';

  // Visualização (todos)
  const display = (
    <div className="flex items-center gap-2">
      <Timer
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          effectivelyPaused ? 'text-muted-foreground' : 'text-primary',
        )}
      />
      <span
        className={cn(
          'font-mono tabular-nums font-bold',
          layout === 'full' ? 'text-base' : 'text-xs',
          remaining <= 5 && !effectivelyPaused ? 'text-destructive animate-pulse' : 'text-foreground',
        )}
      >
        {enabled ? fmt(remaining) : '—'}
      </span>
      {effectivelyPaused && enabled && (
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
          {pausedForReaction ? 'aguardando reação' : 'pausado'}
        </span>
      )}
    </div>
  );

  const bar = enabled && (
    <div className="h-1 w-full rounded-full bg-secondary/40 overflow-hidden">
      <div
        className={cn('h-full transition-all duration-200', barColor)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );

  if (!isMaster) {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        {display}
        {bar}
      </div>
    );
  }

  // Controles do Mestre
  const btn =
    'h-6 w-6 rounded-md border border-border bg-secondary/40 hover:bg-secondary/70 text-foreground flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-2 flex-wrap">
        {display}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className={btn}
            onClick={() => setEnabled(!enabled)}
            title={enabled ? 'Desligar cronômetro' : 'Ligar cronômetro'}
          >
            {enabled ? <TimerOff className="h-3 w-3" /> : <Timer className="h-3 w-3" />}
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => adjust(-10)}
            disabled={!enabled}
            title="-10s"
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            type="button"
            className={cn(btn, 'w-auto px-1.5 text-[10px] font-semibold')}
            onClick={() => {
              if (!enabled) setEnabled(true);
              adjust(10);
            }}
            title="Adicionar 10 segundos ao turno"
          >
            +10s
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => (paused ? resume() : pause())}
            disabled={!enabled || pausedForReaction}
            title={pausedForReaction ? 'Aguardando a reação ser resolvida' : paused ? 'Retomar' : 'Pausar'}
          >
            {effectivelyPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => reset()}
            disabled={!enabled}
            title="Reiniciar tempo do turno"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>
      {bar}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <span>Duração:</span>
        <input
          type="number"
          min={5}
          max={3600}
          step={5}
          value={duration}
          onChange={(e) => setDuration(parseInt(e.target.value, 10) || 0)}
          className="w-14 h-6 rounded border border-border bg-background px-1 text-xs font-mono"
        />
        <span>seg</span>
        {[30, 60, 90, 120].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setDuration(s)}
            className="px-1.5 h-5 rounded border border-border/60 hover:bg-secondary/50 text-[10px]"
          >
            {s}s
          </button>
        ))}
      </div>
    </div>
  );
}
