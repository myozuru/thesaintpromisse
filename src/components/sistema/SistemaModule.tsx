import { useState, useRef } from 'react';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useItemStore } from '@/stores/useItemStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useLogStore } from '@/stores/useLogStore';
import { NullSafeInput } from '../fichas/NullSafeInput';
import { Download, Upload, AlertTriangle, Users, Swords, Bot, Package, CalendarDays, Settings } from 'lucide-react';
import { playClickSound, playDangerSound, playSuccessSound } from '@/lib/sounds';
import { ModuleHeader } from '@/components/ui/module-header';
import { cn } from '@/lib/utils';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const RESET_STEPS = ['Início', 'Confirmar', 'Revisar', 'Executar'];

export function SistemaModule() {
  const characters = useCharacterStore((s) => s.characters);
  const items = useItemStore((s) => s.items);
  const events = useCalendarStore((s) => s.events);
  const chronos = useChronosStore();
  const addLog = useLogStore((s) => s.addLog);

  const fileRef = useRef<HTMLInputElement>(null);
  const [resetStep, setResetStep] = useState(0);
  const [confirmText, setConfirmText] = useState('');

  const players = characters.filter((c) => c.category === 'PLAYER').length;
  const enemies = characters.filter((c) => c.category === 'INIMIGO').length;
  const npcs = characters.filter((c) => c.category === 'NPC').length;

  const stats = [
    { label: 'Total de Fichas', value: characters.length, icon: Users, color: 'text-primary' },
    { label: 'Players', value: players, icon: Users, color: 'text-neon-green' },
    { label: 'Inimigos', value: enemies, icon: Swords, color: 'text-neon-red' },
    { label: 'NPCs', value: npcs, icon: Bot, color: 'text-neon-yellow' },
    { label: 'Total de Itens', value: items.length, icon: Package, color: 'text-shield' },
    { label: 'Eventos', value: events.length, icon: CalendarDays, color: 'text-pe' },
  ];

  const handleExport = () => {
    playSuccessSound();
    const lsDump: Record<string, string> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        const v = localStorage.getItem(k);
        if (v == null) continue;
        lsDump[k] = v;
      }
    } catch {
      // ignore
    }
    const state = {
      __format: 'rpg-backup-v2',
      __exportedAt: new Date().toISOString(),
      localStorage: lsDump,
      characters: useCharacterStore.getState().characters,
      items: useItemStore.getState().items,
      chronos: {
        hours: chronos.hours, minutes: chronos.minutes, seconds: chronos.seconds,
        day: chronos.day, month: chronos.month, year: chronos.year, multiplier: chronos.multiplier,
      },
      calendar: { events: useCalendarStore.getState().events, selectedYear: useCalendarStore.getState().selectedYear, selectedMonth: useCalendarStore.getState().selectedMonth },
      logs: useLogStore.getState().logs,
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rpg-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('system', `📦 Backup completo exportado (${Object.keys(lsDump).length} chaves)`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);

        if (data && typeof data.localStorage === 'object' && data.localStorage) {
          const confirmFull = window.confirm(
            'Importar backup completo? Isso vai SUBSTITUIR todos os dados locais (fichas, grimório, mapas, omni etc.) e recarregar a página.'
          );
          if (!confirmFull) return;
          try {
            for (const k of Object.keys(data.localStorage)) {
              localStorage.setItem(k, data.localStorage[k]);
            }
            const incoming = new Set(Object.keys(data.localStorage));
            const toRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (!k) continue;
              if (incoming.has(k)) continue;
              if (
                k.startsWith('rpg-') ||
                k.startsWith('omni-') ||
                k.startsWith('fm_') ||
                k.startsWith('vtt-') ||
                k.startsWith('spell-library') ||
                k.startsWith('passive-library') ||
                k.startsWith('fog-store') ||
                k.startsWith('menu-store')
              ) {
                toRemove.push(k);
              }
            }
            for (const k of toRemove) localStorage.removeItem(k);
            addLog('system', `📥 Backup completo importado (${Object.keys(data.localStorage).length} chaves). Recarregando…`);
            playSuccessSound();
            setTimeout(() => window.location.reload(), 400);
            return;
          } catch (err) {
            addLog('system', `❌ Falha ao restaurar backup: ${(err as Error).message}`);
            return;
          }
        }

        if (data.characters) useCharacterStore.setState({ characters: data.characters });
        if (data.items) useItemStore.setState({ items: data.items });
        if (data.chronos) {
          useChronosStore.setState({
            hours: data.chronos.hours, minutes: data.chronos.minutes, seconds: data.chronos.seconds,
            day: data.chronos.day, month: data.chronos.month, year: data.chronos.year, multiplier: data.chronos.multiplier,
          });
        }
        if (data.calendar) {
          useCalendarStore.setState({ events: data.calendar.events, selectedYear: data.calendar.selectedYear, selectedMonth: data.calendar.selectedMonth });
        }
        if (data.logs) useLogStore.setState({ logs: data.logs });
        playSuccessSound();
        addLog('system', '📥 Backup (formato antigo) importado — campos limitados restaurados');
      } catch {
        addLog('system', '❌ Erro ao importar JSON');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };


  const handleReset = () => {
    if (confirmText !== 'APAGAR') return;
    playDangerSound();
    useCharacterStore.getState().resetAll();
    useItemStore.getState().resetAll();
    useChronosStore.getState().resetAll();
    useCalendarStore.getState().resetAll();
    useLogStore.getState().clearLogs();
    setResetStep(0);
    setConfirmText('');
    addLog('system', '🔥 Reset global executado');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <ModuleHeader
        icon={Settings}
        title="Sistema"
        description="Estatísticas globais, backup completo e zona de perigo."
      />

      {/* Desktop: two-pane layout — main content left, danger zone right (sticky) */}
      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 lg:items-start">
        {/* Main Content Pane */}
        <div className="space-y-6 animate-fade-in">
          {/* Dashboard */}
          <div className="rounded-xl border border-border bg-card p-4 card-enigmatic">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-3" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}>Visão Geral</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-card p-3 card-enigmatic flex flex-col items-center text-center gap-1.5">
                  <s.icon className={`h-7 w-7 ${s.color}`} />
                  <div className="text-xl font-bold text-foreground tabular-nums">{s.value}</div>
                  <div className="text-sm text-muted-foreground" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.04em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Time/Date config */}
          <div className="rounded-xl border border-border bg-card p-4 card-enigmatic">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-3" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}>Configuração de Data / Hora</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs uppercase tracking-wider" style={{ fontFamily: "'Cinzel', serif" }}>Dia</label>
                <NullSafeInput value={chronos.day} onChange={(v) => chronos.setDate(v, chronos.month, chronos.year)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-foreground text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs uppercase tracking-wider" style={{ fontFamily: "'Cinzel', serif" }}>Mês</label>
                <select
                  value={chronos.month}
                  onChange={(e) => chronos.setDate(chronos.day, parseInt(e.target.value), chronos.year)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-foreground text-sm"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs uppercase tracking-wider" style={{ fontFamily: "'Cinzel', serif" }}>Ano</label>
                <NullSafeInput value={chronos.year} onChange={(v) => chronos.setDate(chronos.day, chronos.month, v)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-foreground text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs uppercase tracking-wider" style={{ fontFamily: "'Cinzel', serif" }}>Hora</label>
                <NullSafeInput value={chronos.hours} onChange={(v) => chronos.setTime(v, chronos.minutes, chronos.seconds)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-foreground text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs uppercase tracking-wider" style={{ fontFamily: "'Cinzel', serif" }}>Minuto</label>
                <NullSafeInput value={chronos.minutes} onChange={(v) => chronos.setTime(chronos.hours, v, chronos.seconds)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-foreground text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs uppercase tracking-wider" style={{ fontFamily: "'Cinzel', serif" }}>Segundo</label>
                <NullSafeInput value={chronos.seconds} onChange={(v) => chronos.setTime(chronos.hours, chronos.minutes, v)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-foreground text-sm" />
              </div>
            </div>
          </div>

          {/* Portability */}
          <div className="rounded-xl border border-border bg-card p-4 card-enigmatic">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-3" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}>Portabilidade</h3>
            <div className="flex flex-wrap gap-3">
              <button onClick={handleExport} className="h-10 rounded-lg bg-primary px-5 text-primary-foreground text-sm font-medium flex items-center gap-2 glow-primary transition-all duration-300 hover:bg-primary/90">
                <Download className="h-4 w-4" />
                <span>Exportar JSON</span>
              </button>
              <button onClick={() => fileRef.current?.click()} className="h-10 rounded-lg border border-input bg-background px-5 text-foreground text-sm font-medium flex items-center gap-2 transition-all duration-300 hover:bg-secondary hover:border-primary/30">
                <Upload className="h-4 w-4" />
                <span>Importar JSON</span>
              </button>
              <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            </div>
          </div>
        </div>

        {/* Danger Zone Pane — sticky on desktop */}
        <div className="lg:sticky lg:top-24 animate-fade-in" style={{ animationDelay: '60ms' }}>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 card-enigmatic space-y-4">
            <h3 className="text-sm font-bold text-destructive uppercase tracking-wider flex items-center gap-2" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}>
              <AlertTriangle className="h-4 w-4" /> Zona de Perigo
            </h3>
            <ol aria-label={`Progresso do reset: etapa ${resetStep + 1} de ${RESET_STEPS.length}`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RESET_STEPS.map((step, index) => (
                <li
                  key={step}
                  aria-current={index === resetStep ? 'step' : undefined}
                  className={cn(
                    'flex min-h-11 items-center gap-2 rounded-lg border px-2 text-sm transition-colors',
                    index === resetStep
                      ? 'border-destructive/50 bg-destructive/15 text-destructive'
                      : index < resetStep
                        ? 'border-destructive/25 bg-destructive/5 text-foreground'
                        : 'border-border/60 bg-background/40 text-muted-foreground',
                  )}
                >
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current font-mono text-sm">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            {resetStep === 0 && (
              <button onClick={() => { setResetStep(1); playDangerSound(); }} className="w-full min-h-11 rounded-lg border border-destructive bg-destructive/10 px-4 text-destructive text-base font-medium hover:bg-destructive/20 transition-all duration-300">
                Reset Global
              </button>
            )}

            {resetStep === 1 && (
              <div className="space-y-3 text-sm">
                <p className="text-destructive">Isso apagará TODOS os dados. Tem certeza?</p>
                <div className="flex gap-2">
                  <button onClick={() => { setResetStep(2); playDangerSound(); }} className="flex-1 min-h-11 rounded-lg bg-destructive px-4 text-destructive-foreground text-base font-medium transition-all duration-300 hover:bg-destructive/90">
                    Sim, continuar
                  </button>
                  <button onClick={() => setResetStep(0)} className="flex-1 min-h-11 rounded-lg bg-secondary px-4 text-secondary-foreground text-base font-medium transition-all duration-300 hover:bg-secondary/80">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {resetStep === 2 && (
              <div className="space-y-3 text-sm">
                <p className="text-destructive font-bold">ÚLTIMA CHANCE! Esta ação é irreversível.</p>
              <div className="flex flex-col gap-2">
                <button onClick={() => { setResetStep(3); playDangerSound(); }} className="w-full min-h-11 rounded-lg bg-destructive px-4 py-2 text-destructive-foreground text-base font-medium transition-all duration-300 hover:bg-destructive/90">
                    Tenho certeza absoluta
                  </button>
                <button onClick={() => setResetStep(0)} className="w-full min-h-11 rounded-lg bg-secondary px-4 py-2 text-secondary-foreground text-base font-medium transition-all duration-300 hover:bg-secondary/80">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {resetStep === 3 && (
              <div className="space-y-3 text-sm">
                <p className="text-destructive">Digite <strong>APAGAR</strong> para confirmar a destruição total:</p>
                <div className="flex flex-wrap gap-2">
                  <input
                    aria-label="Digite APAGAR para confirmar o reset"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="APAGAR"
                    className="min-h-11 flex-1 min-w-[10rem] rounded-lg border border-destructive bg-background px-3 text-foreground font-mono tracking-widest text-base uppercase"
                  />
                  <button
                    onClick={handleReset}
                    disabled={confirmText !== 'APAGAR'}
                    className="min-h-11 shrink-0 whitespace-nowrap rounded-lg bg-destructive px-4 text-destructive-foreground text-base font-medium disabled:opacity-50 transition-all duration-300"
                  >
                    Executar Reset
                  </button>
                  <button onClick={() => { setResetStep(0); setConfirmText(''); }} className="min-h-11 shrink-0 whitespace-nowrap rounded-lg bg-secondary px-4 text-secondary-foreground text-base font-medium transition-all duration-300 hover:bg-secondary/80">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
