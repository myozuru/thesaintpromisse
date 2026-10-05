import { useEffect, useMemo, useState } from 'react';
import { useChronosStore } from '@/stores/useChronosStore';
import { useLogStore } from '@/stores/useLogStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { AnalogClock } from './AnalogClock';
import { SmoothTimeDisplay } from './SmoothTimeDisplay';
import { NullSafeInput } from '../fichas/NullSafeInput';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { playClockClickSound, playSuccessSound, playTimeAdvanceSound } from '@/lib/sounds';

export function ChronosModule() {
  const store = useChronosStore();
  const isPlayer = useRoleStore((s) => s.role) === 'PLAYER';
  const characters = useCharacterStore((s) => s.characters);
  const grantRest = useCharacterStore((s) => s.grantRest);
  const addLog = useLogStore((s) => s.addLog);

  const [advanceMinutes, setAdvanceMinutes] = useState(0);
  const [advanceReason, setAdvanceReason] = useState('');
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [selectedRestTargets, setSelectedRestTargets] = useState<string[]>([]);

  const fmt = (n: number) => String(Math.floor(n)).padStart(2, '0');

  const visibleCharacters = useMemo(
    () => (isPlayer
      ? characters.filter((c) => c.category === 'PLAYER' && c.createdBy !== 'MASTER')
      : characters),
    [characters, isPlayer],
  );

  useEffect(() => {
    setSelectedRestTargets((prev) => prev.filter((id) => visibleCharacters.some((c) => c.id === id)));
  }, [visibleCharacters]);

  useEffect(() => {
    if (selectedRestTargets.length === 0 && visibleCharacters.length === 1) {
      setSelectedRestTargets([visibleCharacters[0].id]);
    }
  }, [selectedRestTargets.length, visibleCharacters]);

  const handleManualAdvance = () => {
    if (advanceMinutes <= 0) return;
    playTimeAdvanceSound();
    const beforeTime = `${fmt(store.hours)}:${fmt(store.minutes)}:${fmt(store.seconds)}`;
    store.tick(advanceMinutes * 60);
    const s = useChronosStore.getState();
    const afterTime = `${fmt(s.hours)}:${fmt(s.minutes)}:${fmt(s.seconds)}`;
    const reason = advanceReason.trim() || 'Avanço manual';
    addLog('time', `⏰ ${reason}: ${beforeTime} > ${afterTime}`);
    setAdvanceMinutes(0);
    setAdvanceReason('');
  };

  const toggleRestTarget = (id: string) => {
    setSelectedRestTargets((prev) => (
      prev.includes(id) ? prev.filter((targetId) => targetId !== id) : [...prev, id]
    ));
  };

  const handleGroupRest = (mode: 'short' | 'long') => {
    if (selectedRestTargets.length === 0) return;
    const targetNames: string[] = [];

    selectedRestTargets.forEach((charId) => {
      const target = visibleCharacters.find((c) => c.id === charId);
      if (!target) return;
      targetNames.push(target.name);
      grantRest(charId, mode);
    });

    if (targetNames.length === 0) return;

    playSuccessSound();
    addLog(
      'system',
      `${mode === 'short' ? '☕' : '🌙'} Descanso ${mode === 'short' ? 'Curto' : 'Longo'} concedido a: ${targetNames.join(', ')}. Aguardando o jogador acionar na ficha.`,
    );
    setSelectedRestTargets([]);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Title */}
      <h1 className="text-center text-2xl text-primary glow-text-strong tracking-[0.15em]" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
        Sistema Chronos
      </h1>

      {/* Clock */}
      <div className="rounded-xl border border-border bg-card p-8 card-enigmatic glow-border border-glow flex flex-col items-center">
        <AnalogClock size={300} />
        <SmoothTimeDisplay
          className="mt-5 text-center text-3xl text-foreground tracking-[0.15em] glow-text-strong"
          style={{ fontFamily: "'Cinzel Decorative', serif" }}
        />
        <div className="mt-2 text-center text-base text-muted-foreground flex items-center justify-center gap-1" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}>
          Dia {store.day} · Mês {store.month} ·{' '}
          <span className="relative inline-block">
            {isPlayer ? (
              <span className="text-foreground">Ano {store.year}</span>
            ) : (
              <button
                onClick={() => { setShowYearPicker(!showYearPicker); playClockClickSound(); }}
                className="text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/40 transition-all duration-300"
              >
                Ano {store.year}
              </button>
            )}
            {!isPlayer && showYearPicker && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 rounded-xl border border-border bg-card p-3 shadow-lg shadow-primary/10 animate-fade-in min-w-[200px]">
                <div className="grid grid-cols-3 gap-1 max-h-40 overflow-y-auto">
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((yr) => (
                    <button
                      key={yr}
                      onClick={() => { store.setDate(store.day, store.month, yr); setShowYearPicker(false); playClockClickSound(); }}
                      className={cn(
                        'rounded-lg px-2 py-1 text-sm font-mono transition-all duration-300',
                        store.year === yr
                          ? 'bg-primary text-primary-foreground glow-primary'
                          : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="Ano..."
                    className="h-8 flex-1 rounded-lg border border-input bg-background px-2 text-sm text-foreground text-center"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const v = parseInt((e.target as HTMLInputElement).value);
                        if (v > 0) { store.setDate(store.day, store.month, v); setShowYearPicker(false); }
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </span>
        </div>

        {!isPlayer && (
          <div className="mt-5 flex flex-col items-center gap-3">
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => { store.setIsRunning(!store.isRunning); playClockClickSound(); }}
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-full transition-all duration-300',
                  store.isRunning
                    ? 'bg-primary text-primary-foreground glow-primary-strong shadow-lg shadow-primary/40'
                    : 'bg-primary/80 text-primary-foreground hover:bg-primary glow-primary'
                )}
              >
                {store.isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>
              <div className="flex items-center gap-2 text-base text-muted-foreground">
                <span style={{ fontFamily: "'Cinzel', serif" }}>×</span>
                <NullSafeInput value={store.multiplier} onChange={(v) => store.setMultiplier(Math.max(1, v))} className="w-16" />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
              <label className="flex items-center gap-2">
                <span style={{ fontFamily: "'Cinzel', serif" }}>Início (ms)</span>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={store.easeStartMs}
                  onChange={(e) => store.setEaseStartMs(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-8 w-20 rounded-lg border border-input bg-background px-2 text-center text-sm text-foreground"
                />
              </label>
              <label className="flex items-center gap-2">
                <span style={{ fontFamily: "'Cinzel', serif" }}>Parada (ms)</span>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={store.easeStopMs}
                  onChange={(e) => store.setEaseStopMs(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-8 w-20 rounded-lg border border-input bg-background px-2 text-center text-sm text-foreground"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Manual Advance — Mestre apenas */}
      {!isPlayer && (
        <div className="rounded-xl border border-border bg-card overflow-hidden card-enigmatic p-5 space-y-3">
          <h2 className="text-base font-bold text-primary tracking-wider" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}>
            Adicionar Passagem de Tempo
          </h2>
          <input
            value={advanceReason}
            onChange={(e) => setAdvanceReason(e.target.value)}
            placeholder="Motivo"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={advanceMinutes || ''}
              onChange={(e) => setAdvanceMinutes(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="Minutos"
              className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <button
              onClick={handleManualAdvance}
              disabled={advanceMinutes <= 0}
              className="h-10 rounded-lg bg-primary px-6 text-sm text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 glow-primary transition-all duration-300"
            >
              Avançar
            </button>
          </div>
        </div>
      )}

      {!isPlayer && (
        <div className="rounded-xl border border-border bg-card overflow-hidden card-enigmatic p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-primary tracking-wider" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.06em' }}>
              Conceder Descansos
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setSelectedRestTargets(visibleCharacters.map((c) => c.id))}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                Todos
              </button>
              <button
                onClick={() => setSelectedRestTargets([])}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Nenhum
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground -mt-2">
            Conceder libera o botão "Descansar" na ficha do jogador (apenas no tipo concedido). Ele decide quando acionar.
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
              <span>Alvos do descanso</span>
              <span>{selectedRestTargets.length} selecionado(s)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleCharacters.length === 0 ? (
                <div className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm text-muted-foreground">
                  Nenhuma ficha disponível para descanso.
                </div>
              ) : visibleCharacters.map((char) => {
                const selected = selectedRestTargets.includes(char.id);
                const grant = char.restGrant;
                return (
                  <button
                    key={char.id}
                    onClick={() => { toggleRestTarget(char.id); playClockClickSound(); }}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm transition-all duration-300 flex items-center gap-1.5',
                      selected
                        ? 'border-primary/40 bg-primary/15 text-primary glow-primary'
                        : 'border-border bg-secondary/30 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                    )}
                  >
                    {char.name}
                    {grant && (
                      <span className="text-xs uppercase tracking-wider text-primary/80">
                        {grant === 'short' ? '☕ pendente' : '🌙 pendente'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => handleGroupRest('short')}
              disabled={selectedRestTargets.length === 0}
              className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 glow-primary transition-all duration-300"
            >
              Conceder Descanso Curto
            </button>
            <button
              onClick={() => handleGroupRest('long')}
              disabled={selectedRestTargets.length === 0}
              className="h-11 rounded-lg bg-secondary px-4 text-sm font-medium text-foreground hover:bg-secondary/80 disabled:opacity-50 transition-all duration-300"
            >
              Conceder Descanso Longo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
