import { ScrollArea } from '@/components/ui/scroll-area';
import { useLogStore } from '@/stores/useLogStore';
import { Scroll, Trash2, Dice1, Swords, Clock, Zap, Settings, ChevronLeft, ChevronRight, Globe, Gamepad2, Flag, Eye, EyeOff, ScanEye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LogType } from '@/types';
import { playDeleteSound } from '@/lib/sounds';
import { useRoleStore } from '@/stores/useRoleStore';
import type { PlayerLogVisibility } from '@/stores/useLogStore';

const LOG_ICONS: Record<LogType, React.ElementType> = {
  roll: Dice1,
  combat: Swords,
  time: Clock,
  spell: Zap,
  system: Settings,
  initiative: Flag,
};

const LOG_COLORS: Record<LogType, string> = {
  roll: 'text-neon-yellow',
  combat: 'text-hp',
  time: 'text-shield',
  spell: 'text-pe',
  system: 'text-muted-foreground',
  initiative: 'text-primary',
};

const VISIBILITY_SEQUENCE: PlayerLogVisibility[] = ['full', 'hide-master', 'hide-roll-results'];

const VISIBILITY_META: Record<PlayerLogVisibility, { label: string; title: string; icon: React.ElementType }> = {
  full: { label: 'Players veem tudo', title: 'Players veem todos os logs', icon: Eye },
  'hide-master': { label: 'Ocultar Mestre', title: 'Players não veem nenhum log feito pelo Mestre', icon: EyeOff },
  'hide-roll-results': { label: 'Ocultar resultados', title: 'Players veem rolagens do Mestre sem resultados', icon: ScanEye },
};

function hideRollResult(message: string) {
  return message
    .replace(/d20\([^)]*\)/gi, 'd20(?)')
    .replace(/Total:\s*-?\d+/gi, 'Resultado oculto')
    .replace(/=\s*-?\d+/g, '= ??');
}

export function LogPanel() {
  const { logs, clearLogs, playerVisibility, setPlayerVisibility, showGameTime, toggleTimeMode, panelCollapsed, setPanelCollapsed } = useLogStore();
  const role = useRoleStore((s) => s.role);
  const isMaster = role === 'MASTER';
  const visibleLogs = role === 'PLAYER'
    ? logs
      .filter((log) => playerVisibility !== 'hide-master' || log.sourceRole !== 'MASTER')
      .map((log) => playerVisibility === 'hide-roll-results' && log.sourceRole === 'MASTER' && log.type === 'roll'
        ? { ...log, message: hideRollResult(log.message) }
        : log)
    : logs;
  const visibilityMeta = VISIBILITY_META[playerVisibility];
  const VisibilityIcon = visibilityMeta.icon;
  const cycleVisibility = () => {
    const idx = VISIBILITY_SEQUENCE.indexOf(playerVisibility);
    setPlayerVisibility(VISIBILITY_SEQUENCE[(idx + 1) % VISIBILITY_SEQUENCE.length]);
  };

  if (panelCollapsed) {
    return (
      <aside className="fixed left-0 top-14 bottom-0 z-40 flex w-10 flex-col border-r border-border bg-card transition-all duration-500">
        <button
          onClick={() => setPanelCollapsed(false)}
          className="flex flex-col items-center gap-2 pt-3 text-muted-foreground hover:text-foreground transition-all duration-300"
          title="Expandir Logs"
        >
          <ChevronRight className="h-4 w-4" />
          <Scroll className="h-4 w-4 text-primary" />
          {visibleLogs.length > 0 && (
            <span className="text-xs font-mono text-primary glow-text">{visibleLogs.length}</span>
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside className="fixed left-0 top-14 bottom-0 z-40 flex w-[85vw] max-w-xs sm:w-64 flex-col border-r border-border bg-card transition-all duration-500 shadow-2xl sm:shadow-none">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Scroll className="h-4 w-4 text-primary float-subtle" />
          <span style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.05em' }}>Logs</span>
        </div>
        <div className="flex items-center gap-1">
          {isMaster && (
            <button
              onClick={cycleVisibility}
              className="rounded-lg p-1 text-primary transition-all duration-300 hover:bg-primary/10"
              title={visibilityMeta.title}
            >
              {(() => {
                const Icon = VisibilityIcon as React.ComponentType<{ className?: string }>;
                return <Icon className="h-3.5 w-3.5" />;
              })()}
            </button>
          )}
          <button
            onClick={toggleTimeMode}
            className={cn(
              'rounded-lg p-1 transition-all duration-300',
              showGameTime
                ? 'text-primary bg-primary/10 hover:bg-primary/20'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
            title={showGameTime ? 'Mostrando hora fictícia — clique para hora real' : 'Mostrando hora real — clique para hora fictícia'}
          >
            {showGameTime ? <Gamepad2 className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
          </button>
          {logs.length > 0 && (
            <button
              onClick={() => { playDeleteSound(); clearLogs(); }}
              className="rounded-lg p-1 text-muted-foreground transition-all duration-300 hover:bg-destructive/20 hover:text-destructive"
              title="Limpar logs"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setPanelCollapsed(true)}
            className="rounded-lg p-1 text-muted-foreground transition-all duration-300 hover:bg-secondary hover:text-foreground"
            title="Minimizar"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {isMaster && (
            <div className="mb-1 rounded-lg border border-border bg-background/40 px-2 py-1 text-xs text-muted-foreground">
              <span className="text-primary">Visão dos players:</span> {visibilityMeta.label}
            </div>
          )}
          {visibleLogs.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>
              Nenhum evento registrado
            </p>
          )}
          {visibleLogs.map((log) => {
            const Icon = LOG_ICONS[log.type];
            const sourceName = log.sourceName ?? (log.sourceRole === 'MASTER' ? 'Mestre' : null);
            return (
              <div
                key={log.id}
                className="flex items-start gap-2 rounded-lg px-2 py-2 text-sm hover:bg-secondary/50 transition-all duration-300 animate-fade-in"
              >
                {(() => {
                  const LogIcon = Icon as React.ComponentType<{ className?: string }>;
                  return <LogIcon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', LOG_COLORS[log.type])} />;
                })()}
                <div className="min-w-0 flex-1">
                  {sourceName && (
                    <p className="mb-0.5 truncate text-xs font-semibold text-primary">{sourceName}</p>
                  )}
                  <p className="break-words font-mono text-[13px] font-medium leading-5 text-foreground tabular-nums">{log.message}</p>
                  <span className="mt-0.5 block font-mono text-xs leading-4 text-muted-foreground tabular-nums">
                    {showGameTime ? (log.gameTime || '—') : new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
