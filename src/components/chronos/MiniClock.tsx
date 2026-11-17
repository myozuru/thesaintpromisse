import { useState } from 'react';
import { useChronosStore } from '@/stores/useChronosStore';
import { useLogStore } from '@/stores/useLogStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { Play, Pause, FastForward, ChevronDown, ChevronUp, CalendarPlus } from 'lucide-react';
import { SmoothTimeDisplay } from './SmoothTimeDisplay';
import { cn } from '@/lib/utils';
import { playClockClickSound } from '@/lib/sounds';

export function MiniClock() {
  const store = useChronosStore();
  const isPlayer = useRoleStore((s) => s.role) === 'PLAYER';
  const hourAngle = ((store.hours % 12) + store.minutes / 60) * 30;
  const minuteAngle = (store.minutes + store.seconds / 60) * 6;
  const secondAngle = store.seconds * 6;
  const addLog = useLogStore((s) => s.addLog);
  const [expanded, setExpanded] = useState(false);
  const [advMin, setAdvMin] = useState('');
  const [showEvent, setShowEvent] = useState(false);
  const [eventMinutes, setEventMinutes] = useState('');
  const [eventReason, setEventReason] = useState('');

  const fmt = (n: number) => String(Math.floor(n)).padStart(2, '0');
  const timeStr = `${fmt(store.hours)}:${fmt(store.minutes)}:${fmt(store.seconds)}`;

  const handleAdvance = () => {
    const mins = parseInt(advMin) || 0;
    if (mins <= 0) return;
    const before = timeStr;
    store.tick(mins * 60);
    const s = useChronosStore.getState();
    const after = `${fmt(s.hours)}:${fmt(s.minutes)}:${fmt(s.seconds)}`;
    addLog('time', `⏰ Avanço: ${before} > ${after} (+${mins}min)`);
    setAdvMin('');
  };

  const handleEvent = () => {
    const mins = parseInt(eventMinutes) || 0;
    if (mins <= 0 || !eventReason.trim()) return;
    const before = timeStr;
    store.tick(mins * 60);
    const s = useChronosStore.getState();
    const after = `${fmt(s.hours)}:${fmt(s.minutes)}:${fmt(s.seconds)}`;
    addLog('time', `📅 Evento "${eventReason.trim()}": ${before} > ${after} (+${mins}min)`);
    setEventMinutes('');
    setEventReason('');
    setShowEvent(false);
  };

  return (
    <div className="relative shrink-0">
      {/* Compact bar */}
      <div className="flex items-center gap-1.5 bg-card/60 border border-border rounded-lg px-2.5 py-1">
        <svg className="h-6 w-6 shrink-0 text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.65" strokeWidth="1.25" />
          <path d="M12 4.5v1.25M19.5 12h-1.25M12 19.5v-1.25M4.5 12h1.25" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
          <line x1="12" y1="12" x2="12" y2="7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" transform={`rotate(${hourAngle} 12 12)`} />
          <line x1="12" y1="12" x2="12" y2="5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" transform={`rotate(${minuteAngle} 12 12)`} />
          <line x1="12" y1="13.5" x2="12" y2="4.5" stroke="hsl(var(--accent))" strokeWidth="0.7" strokeLinecap="round" transform={`rotate(${secondAngle} 12 12)`} />
          <circle cx="12" cy="12" r="1.2" fill="hsl(var(--accent))" />
        </svg>
        <SmoothTimeDisplay className="text-base text-foreground tracking-[0.1em] glow-text text-center tabular-nums whitespace-nowrap" style={{ fontFamily: "'Cinzel Decorative', serif", width: '7.2em', display: 'inline-block' }} />
        {!isPlayer && (
          <button
            aria-label={store.isRunning ? 'Pausar relógio da campanha' : 'Retomar relógio da campanha'}
            onClick={() => { playClockClickSound(); store.setIsRunning(!store.isRunning); }}
            className={cn(
              'h-5 w-5 flex items-center justify-center rounded-full transition-all duration-300',
              store.isRunning ? 'bg-primary text-primary-foreground glow-primary shadow-sm shadow-primary/30' : 'bg-primary/20 text-primary hover:bg-primary/30'
            )}
          >
            {store.isRunning ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
          </button>
        )}
        {!isPlayer && (
          <button
            aria-label={expanded ? 'Recolher controles do relógio' : 'Expandir controles do relógio'}
            aria-expanded={expanded}
            aria-controls="mini-clock-controls"
            onClick={() => setExpanded(!expanded)}
            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-secondary transition-all duration-300"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>

      {/* Expanded panel — Mestre apenas */}
      {!isPlayer && (
      <div
        id="mini-clock-controls"
        aria-hidden={!expanded}
        inert={!expanded}
        className={cn(
          'absolute left-0 top-full mt-1 z-[60] w-56 bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl overflow-hidden transition-all duration-500 ease-in-out',
          expanded ? 'max-h-80 opacity-100 px-2.5 py-2' : 'max-h-0 opacity-0'
        )}
      >
        <div className="space-y-1.5">
          {/* Multiplier */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground" style={{ fontFamily: "'Cinzel', serif" }}>×</span>
            {[1, 10, 60, 300].map((m) => (
              <button
                key={m}
                onClick={() => store.setMultiplier(m)}
                className={cn(
                  'rounded-md px-1.5 py-0.5 font-mono transition-all duration-300',
                  store.multiplier === m
                    ? 'bg-primary text-primary-foreground glow-primary'
                    : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                )}
              >
                {m}
              </button>
            ))}
            <input
              type="number"
              value={store.multiplier}
              onChange={(e) => store.setMultiplier(Math.max(1, parseInt(e.target.value) || 1))}
              className="h-5 w-10 rounded-md border border-input bg-background px-1 text-center text-xs font-mono text-foreground"
            />
          </div>

          {/* Advance */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={advMin}
              onChange={(e) => setAdvMin(e.target.value)}
              placeholder="min"
              className="h-5 w-14 rounded-md border border-input bg-background px-1 text-xs text-foreground text-center"
            />
            <button
              onClick={handleAdvance}
              disabled={!advMin || parseInt(advMin) <= 0}
              className="h-5 flex items-center gap-0.5 rounded-md bg-primary/20 px-1.5 text-xs text-primary hover:bg-primary/30 disabled:opacity-40 transition-all duration-300"
            >
              <FastForward className="h-2.5 w-2.5" /> Avançar
            </button>
          </div>

          {/* Event button */}
          <button
            onClick={() => setShowEvent(!showEvent)}
            className={cn(
              'flex items-center gap-1 text-xs transition-all duration-300 w-full',
              showEvent ? 'text-primary glow-text' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CalendarPlus className="h-3 w-3" />
            <span style={{ fontFamily: "'Cormorant Garamond', serif" }}>Registrar evento</span>
            <ChevronDown className={cn('h-2.5 w-2.5 ml-auto transition-transform duration-500', showEvent && 'rotate-180')} />
          </button>

          {showEvent && (
            <div className="space-y-1 pl-1 animate-fade-in">
              <input
                value={eventReason}
                onChange={(e) => setEventReason(e.target.value)}
                placeholder="Motivo do evento"
                className="h-5 w-full rounded-md border border-input bg-background px-1.5 text-xs text-foreground"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={eventMinutes}
                  onChange={(e) => setEventMinutes(e.target.value)}
                  placeholder="min"
                  className="h-5 w-14 rounded-md border border-input bg-background px-1 text-xs text-foreground text-center"
                />
                <button
                  onClick={handleEvent}
                  disabled={!eventMinutes || parseInt(eventMinutes) <= 0 || !eventReason.trim()}
                  className="h-5 flex-1 flex items-center justify-center gap-0.5 rounded-md bg-primary/20 px-1.5 text-xs text-primary hover:bg-primary/30 disabled:opacity-40 transition-all duration-300"
                >
                  <CalendarPlus className="h-2.5 w-2.5" /> Criar
                </button>
              </div>
            </div>
          )}

          {/* Date */}
          <div className="text-xs text-muted-foreground" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>
            Dia {store.day} · Mês {store.month} · Ano {store.year}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
