import { useState, useEffect, useRef } from 'react';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { Plus, X, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { playClickSound } from '@/lib/sounds';
import { ModuleHeader } from '@/components/ui/module-header';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const EVENT_COLORS = ['#7C3AED', '#EF4444', '#22C55E', '#3B82F6', '#F59E0B', '#EC4899', '#14B8A6', '#F97316'];

export function CalendarioModule() {
  const { events, selectedYear, selectedMonth, setSelectedYear, setSelectedMonth, addEvent, removeEvent } = useCalendarStore();
  const isPlayer = useRoleStore((s) => s.role) === 'PLAYER';
  const [agendaDay, setAgendaDay] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [newEvent, setNewEvent] = useState({ time: '12:00', title: '', description: '', color: EVENT_COLORS[0] });
  const [gridKey, setGridKey] = useState(0);
  const [slidePhase, setSlidePhase] = useState<'idle' | 'out' | 'in'>('idle');
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right');
  const pendingChange = useRef<(() => void) | null>(null);

  const triggerTransition = (changeFn: () => void, direction: 'left' | 'right' = 'right') => {
    if (slidePhase !== 'idle') return;
    setSlideDir(direction);
    setSlidePhase('out');
    pendingChange.current = changeFn;
  };

  useEffect(() => {
    if (slidePhase === 'out' && pendingChange.current) {
      const timer = setTimeout(() => {
        pendingChange.current?.();
        pendingChange.current = null;
        setGridKey((k) => k + 1);
        setSlidePhase('in');
      }, 300);
      return () => clearTimeout(timer);
    }
    if (slidePhase === 'in') {
      const timer = setTimeout(() => setSlidePhase('idle'), 300);
      return () => clearTimeout(timer);
    }
  }, [slidePhase]);
  

  const daysInCurrentMonth = DAYS_IN_MONTH[(selectedMonth - 1) % 12] || 30;
  const days = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

  const dayEvents = (day: number) =>
    events.filter((e) => e.day === day && e.month === selectedMonth && e.year === selectedYear);

  const handleDayClick = (day: number) => {
    playClickSound();
    setAgendaDay(day);
    setCreating(false);
  };

  const handleCreateEvent = () => {
    if (!newEvent.title.trim() || agendaDay === null) return;
    addEvent({
      id: crypto.randomUUID(),
      day: agendaDay,
      month: selectedMonth,
      year: selectedYear,
      time: newEvent.time,
      title: newEvent.title.trim(),
      description: newEvent.description,
      color: newEvent.color,
    });
    setNewEvent({ time: '12:00', title: '', description: '', color: EVENT_COLORS[0] });
    setCreating(false);
  };

  const changeMonth = (delta: number) => {
    playClickSound();
    const newMonth = selectedMonth + delta <= 0 ? 12 : selectedMonth + delta > 12 ? 1 : selectedMonth + delta;
    triggerTransition(() => setSelectedMonth(newMonth), delta > 0 ? 'right' : 'left');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
      <ModuleHeader
        icon={CalendarDays}
        title="Calendário"
        subtitle={`${MONTHS[(selectedMonth - 1) % 12]} · ${selectedYear}`}
        description="Eventos, marcos da campanha e datas importantes do mundo."
      />

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => changeMonth(-1)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-300">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <select
          value={selectedMonth}
          onChange={(e) => {
            const newVal = parseInt(e.target.value);
            triggerTransition(() => setSelectedMonth(newVal), newVal > selectedMonth ? 'right' : 'left');
          }}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>

        {/* Year selector */}
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground" style={{ fontFamily: "'Cinzel', serif" }}>Ano</span>
          <select
            value={selectedYear}
            onChange={(e) => {
              const newVal = parseInt(e.target.value);
              triggerTransition(() => setSelectedYear(newVal), newVal > selectedYear ? 'right' : 'left');
            }}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground font-mono"
          >
            {Array.from({ length: 3001 }, (_, i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>

        <button onClick={() => changeMonth(1)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-300">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className={cn(
        "rounded-xl border border-border bg-card p-4 card-enigmatic transition-all duration-300 ease-in-out",
        slidePhase === 'out' && slideDir === 'left' && "opacity-0 -translate-x-8",
        slidePhase === 'out' && slideDir === 'right' && "opacity-0 translate-x-8",
        slidePhase === 'in' && "animate-fade-in",
        slidePhase === 'idle' && "opacity-100 translate-x-0"
      )} key={gridKey}>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
            <div key={d} className="py-1 font-semibold" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const evts = dayEvents(day);
            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                className={cn(
                  'relative rounded-lg p-1.5 text-sm text-foreground hover:bg-primary/10 transition-all duration-300 min-h-[44px] text-left',
                  agendaDay === day && 'ring-1 ring-primary bg-primary/15 glow-primary shadow-sm'
                )}
              >
                <span className="font-mono text-sm">{day}</span>
                {evts.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5 flex-wrap">
                    {evts.slice(0, 3).map((e) => (
                      <div key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: e.color }} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Daily agenda */}
      {agendaDay !== null && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 animate-fade-in card-enigmatic glow-border">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-foreground glow-text" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
              {agendaDay} de {MONTHS[selectedMonth - 1]}, Ano {selectedYear}
            </h3>
            <div className="flex gap-1">
              {!isPlayer && (
                <button onClick={() => { setCreating(true); playClickSound(); }} className="rounded-lg p-1.5 text-primary hover:bg-primary/20 transition-all duration-300">
                  <Plus className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => setAgendaDay(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary transition-all duration-300">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {dayEvents(agendaDay).sort((a, b) => a.time.localeCompare(b.time)).map((evt) => (
            <div key={evt.id} className="flex items-start gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm transition-all duration-300 hover:bg-secondary/70">
              <div className="mt-1 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: evt.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{evt.time}</span>
                  <span className="font-semibold text-foreground">{evt.title}</span>
                </div>
                {evt.description && <p className="text-muted-foreground mt-0.5 text-sm" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{evt.description}</p>}
              </div>
              {!isPlayer && (
                <button onClick={() => removeEvent(evt.id)} className="text-destructive/60 hover:text-destructive shrink-0 transition-colors duration-300">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          {dayEvents(agendaDay).length === 0 && !creating && (
            <p className="text-sm text-muted-foreground text-center py-4" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>Nenhum evento. Clique + para criar.</p>
          )}

          {creating && (
            <div className="rounded-lg border border-primary/30 p-3 space-y-2 text-sm animate-fade-in">
              <div className="flex gap-2">
                <input type="time" value={newEvent.time} onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })} className="h-8 rounded-lg border border-input bg-background px-2 text-foreground text-sm" />
                <input value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} placeholder="Título" className="h-8 flex-1 rounded-lg border border-input bg-background px-2 text-foreground text-sm" />
              </div>
              <input value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} placeholder="Descrição" className="h-8 w-full rounded-lg border border-input bg-background px-2 text-foreground text-sm" />
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm">Cor:</span>
                {EVENT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewEvent({ ...newEvent, color: c })}
                    className={cn('h-5 w-5 rounded-full border-2 transition-all duration-300', newEvent.color === c ? 'border-foreground scale-110 shadow-sm' : 'border-transparent hover:scale-105')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                <button onClick={handleCreateEvent} className="h-8 rounded-lg bg-primary px-3 text-primary-foreground text-sm glow-primary transition-all duration-300">Salvar</button>
                <button onClick={() => setCreating(false)} className="h-8 rounded-lg bg-secondary px-3 text-secondary-foreground text-sm transition-all duration-300">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
