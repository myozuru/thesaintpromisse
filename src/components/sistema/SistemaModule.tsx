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

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

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
    // Backup COMPLETO: dump de todo o localStorage (todas as stores Zustand
    // persist + dados crus como grimório, pastas etc.). Mantemos um espelho
    // dos campos legados para compatibilidade com backups antigos.
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
      // Espelho legado (compatibilidade reversa com importadores antigos)
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

        // Formato v2: restaurar localStorage completo e recarregar a página
        // para que todas as stores rehidratem do snapshot.
        if (data && typeof data.localStorage === 'object' && data.localStorage) {
          const confirmFull = window.confirm(
            'Importar backup completo? Isso vai SUBSTITUIR todos os dados locais (fichas, grimório, mapas, omni etc.) e recarregar a página.'
          );
          if (!confirmFull) return;
          try {
            // Limpa só as chaves que vamos sobrescrever — preserva eventuais
            // chaves não-rpg (ex.: preferências do navegador para outras apps).
            for (const k of Object.keys(data.localStorage)) {
              localStorage.setItem(k, data.localStorage[k]);
            }
            // Remove chaves rpg/grimório/omni que existiam antes mas não estão no backup
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

        // Fallback: backup antigo (v1) — restaura só os campos conhecidos.
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
    <div className="max-w-4xl mx-auto space-y-6">
      <ModuleHeader
        icon={Settings}
        title="Sistema"
        description="Estatísticas globais, backup completo e zona de perigo."
      />

      {/* Dashboard */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4 flex items-center gap-3 card-enigmatic">
            <s.icon className={`h-8 w-8 ${s.color}`} />
            <div>
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Time/Date config */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 card-enigmatic">
        <h3 className="text-base font-bold text-foreground">Configuração de Data/Hora</h3>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="space-y-1">
            <label className="text-muted-foreground text-sm">Dia</label>
            <NullSafeInput value={chronos.day} onChange={(v) => chronos.setDate(v, chronos.month, chronos.year)} className="w-full" />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-sm">Mês</label>
            <select
              value={chronos.month}
              onChange={(e) => chronos.setDate(chronos.day, parseInt(e.target.value), chronos.year)}
              className="h-8 w-full rounded border border-input bg-background px-2 text-foreground text-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-sm">Ano</label>
            <NullSafeInput value={chronos.year} onChange={(v) => chronos.setDate(chronos.day, chronos.month, v)} className="w-full" />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-sm">Hora</label>
            <NullSafeInput value={chronos.hours} onChange={(v) => chronos.setTime(v, chronos.minutes, chronos.seconds)} className="w-full" />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-sm">Minuto</label>
            <NullSafeInput value={chronos.minutes} onChange={(v) => chronos.setTime(chronos.hours, v, chronos.seconds)} className="w-full" />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-sm">Segundo</label>
            <NullSafeInput value={chronos.seconds} onChange={(v) => chronos.setTime(chronos.hours, chronos.minutes, v)} className="w-full" />
          </div>
        </div>
      </div>

      {/* Portability */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 card-enigmatic">
        <h3 className="text-base font-bold text-foreground">Portabilidade</h3>
        <div className="flex gap-3">
          <button onClick={handleExport} className="flex items-center gap-2 h-10 rounded-md bg-primary px-4 text-primary-foreground hover:bg-primary/90 text-sm transition-all duration-300">
            <Download className="h-4 w-4" /> Exportar JSON
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 h-10 rounded-md border border-input bg-background px-4 text-foreground hover:bg-secondary text-sm transition-all duration-300">
            <Upload className="h-4 w-4" /> Importar JSON
          </button>
          <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        <h3 className="text-base font-bold text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Zona de Perigo
        </h3>

        {resetStep === 0 && (
          <button onClick={() => { setResetStep(1); playDangerSound(); }} className="h-10 rounded-md border border-destructive bg-destructive/10 px-4 text-destructive hover:bg-destructive/20 text-sm transition-all duration-300">
            Reset Global
          </button>
        )}
        {resetStep === 1 && (
          <div className="space-y-2 text-sm">
            <p className="text-destructive">Isso apagará TODOS os dados. Tem certeza?</p>
            <div className="flex gap-2">
              <button onClick={() => { setResetStep(2); playDangerSound(); }} className="h-9 rounded bg-destructive px-4 text-destructive-foreground text-sm">Sim, continuar</button>
              <button onClick={() => setResetStep(0)} className="h-9 rounded bg-secondary px-4 text-secondary-foreground text-sm">Cancelar</button>
            </div>
          </div>
        )}
        {resetStep === 2 && (
          <div className="space-y-2 text-sm">
            <p className="text-destructive font-bold">ÚLTIMA CHANCE! Esta ação é irreversível.</p>
            <div className="flex gap-2">
              <button onClick={() => { setResetStep(3); playDangerSound(); }} className="h-9 rounded bg-destructive px-4 text-destructive-foreground text-sm">Tenho certeza absoluta</button>
              <button onClick={() => setResetStep(0)} className="h-9 rounded bg-secondary px-4 text-secondary-foreground text-sm">Cancelar</button>
            </div>
          </div>
        )}
        {resetStep === 3 && (
          <div className="space-y-2 text-sm">
            <p className="text-destructive">Digite <strong>APAGAR</strong> para confirmar a destruição total:</p>
            <div className="flex gap-2">
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="APAGAR"
                className="h-9 rounded border border-destructive bg-background px-3 text-foreground font-mono tracking-widest text-sm"
              />
              <button
                onClick={handleReset}
                disabled={confirmText !== 'APAGAR'}
                className="h-9 rounded bg-destructive px-4 text-destructive-foreground disabled:opacity-50 text-sm"
              >
                Executar Reset
              </button>
              <button onClick={() => { setResetStep(0); setConfirmText(''); }} className="h-9 rounded bg-secondary px-4 text-secondary-foreground text-sm">Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
