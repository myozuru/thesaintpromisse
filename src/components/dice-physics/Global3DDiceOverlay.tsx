/**
 * Global3DDiceOverlay — bandeja 3D flutuante, estilizada com o tema místico do app.
 */
import { Suspense, useEffect, useRef, useState } from 'react';
import { X, Sparkles, Hand, Zap } from 'lucide-react';
import { DiceTray, type DiceTrayApi, type DiceRollResult } from './index';
import { useDice3DStore } from '@/stores/useDice3DStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function Global3DDiceOverlay() {
  const enabled = useDice3DStore((s) => s.enabled);
  const visible = useDice3DStore((s) => s.visible);
  const setVisible = useDice3DStore((s) => s.setVisible);
  const current = useDice3DStore((s) => s.current);
  const resolveCurrent = useDice3DStore((s) => s.resolveCurrent);
  const bounciness = useDice3DStore((s) => s.bounciness);
  const setBounciness = useDice3DStore((s) => s.setBounciness);
  const isMaster = useRoleStore((s) => s.role === 'MASTER');

  const apiRef = useRef<DiceTrayApi | null>(null);
  const [lastResults, setLastResults] = useState<DiceRollResult[]>([]);
  const [lastTotal, setLastTotal] = useState<number | null>(null);
  /** Bônus fixo do pedido que gerou o resultado exibido. */
  const [lastBonus, setLastBonus] = useState(0);
  /** 'idle' = sem dados, 'armed' = parados aguardando clique, 'rolling' = lançados. */
  const [phase, setPhase] = useState<'idle' | 'armed' | 'rolling'>('idle');
  /** true quando a bandeja 3D não carregou — o jogador rola manualmente por botão. */
  const [trayFailed, setTrayFailed] = useState(false);
  const activeRollIdRef = useRef<string | null>(null);

  // Em alguns aparelhos a física continua quicando e nunca emite o término.
  // Só depois do lançamento manual, conclui a mesma jogada em até 8 segundos
  // para que a tela do teste não permaneça em "Rolando…" para sempre.
  useEffect(() => {
    if (phase !== 'rolling' || !current) return;
    const rollId = current.id;
    activeRollIdRef.current = rollId;
    const watchdog = setTimeout(() => {
      const pending = useDice3DStore.getState().current;
      if (!pending || pending.id !== rollId || activeRollIdRef.current !== rollId) return;
      const faces: Record<string, number> = { D4: 4, D6: 6, D8: 8, D10: 10, D12: 12, D20: 20, D100: 100 };
      const values = pending.types.map((type) => {
        const sides = faces[type] ?? 20;
        return sides === 100 ? Math.floor(Math.random() * 10) * 10 : Math.floor(Math.random() * sides) + 1;
      });
      const bonus = pending.bonus ?? 0;
      activeRollIdRef.current = null;
      apiRef.current?.clear();
      setLastResults(values.map((value, index) => ({ id: `recovery_${index}`, type: pending.types[index], value })));
      setLastBonus(bonus);
      setLastTotal(values.reduce((sum, value) => sum + value, 0) + bonus);
      setPhase('idle');
      resolveCurrent(values);
    }, 8000);
    return () => clearTimeout(watchdog);
  }, [phase, current, resolveCurrent]);


  useEffect(() => {
    if (!current) return;
    // A bandeja 3D carrega sob demanda: na primeira rolagem (comum no jogador,
    // que ainda não abriu a bandeja) ela ainda não existe quando o pedido chega.
    // Esperamos ela ficar pronta em vez de desistir — antes o pedido ficava
    // travado para sempre em "Aguardando rolagem…".
    let cancelled = false;
    let t: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    setTrayFailed(false);
    const arm = () => {
      if (cancelled) return;
      const api = apiRef.current;
      if (!api) {
        if (Date.now() - startedAt > 15000) {
          // Não carregou (ex.: navegador sem 3D): NÃO rola sozinho — mostra
          // um botão para o jogador rolar manualmente quando quiser.
          setTrayFailed(true);
          return;
        }
        t = setTimeout(arm, 100);
        return;
      }
      setLastResults([]);
      setLastTotal(null);
      api.clear();
      t = setTimeout(() => {
        if (cancelled) return;
        apiRef.current?.rollMany(current.types);
        setPhase('armed');
      }, 80);
    };
    arm();
    return () => { cancelled = true; if (t) clearTimeout(t); };
  }, [current, resolveCurrent]);

  if (!enabled || !visible) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] w-[360px] rounded-xl overflow-hidden pointer-events-auto border border-primary/30"
      style={{
        background:
          'linear-gradient(135deg, hsl(265 30% 7% / 0.96) 0%, hsl(270 35% 5% / 0.96) 100%)',
        boxShadow:
          '0 20px 60px -15px hsl(265 80% 4% / 0.85), 0 0 32px hsl(268 85% 62% / 0.25), inset 0 1px 0 hsl(268 60% 30% / 0.25)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Ornamento superior dourado */}
      <div
        className="h-px w-full"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, hsl(42 78% 58% / 0.6) 50%, transparent 100%)',
        }}
      />
      <div className="h-10 px-3 flex items-center gap-2 border-b border-primary/20">
        <Sparkles className="h-4 w-4 text-accent" style={{ filter: 'drop-shadow(0 0 6px hsl(42 78% 58% / 0.6))' }} />
        <div
          className="text-xs uppercase tracking-[0.18em] text-foreground/90 truncate"
          style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.18em' }}
        >
          {current?.label ?? 'Auspício dos Dados'}
        </div>
        <button
          onClick={() => {
            if (useDice3DStore.getState().current) return;
            useDice3DStore.getState().clear();
            setVisible(false);
          }}
          disabled={!!current}
          title={current ? 'Aguarde o resultado…' : 'Fechar'}
          className="ml-auto h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-accent hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>

      </div>

      {isMaster && (
        <div className="px-3 py-2 flex items-center gap-2 border-b border-primary/20">
          <Zap className="h-3.5 w-3.5 text-accent shrink-0" />
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground shrink-0" style={{ fontFamily: "'Cinzel', serif" }}>
            Quique
          </span>
          <Slider
            min={0}
            max={2}
            step={0.05}
            value={[bounciness]}
            onValueChange={(v) => setBounciness(v[0] ?? 1)}
            className="flex-1"
          />
          <span className="text-[11px] tabular-nums text-accent w-10 text-right font-semibold">
            {bounciness.toFixed(2)}x
          </span>
        </div>
      )}

      <div className="relative" style={{ height: 280 }}>
        {/* Véu místico atrás do canvas */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 50% 30%, hsl(268 70% 25% / 0.55) 0%, transparent 65%), radial-gradient(ellipse at 80% 90%, hsl(42 50% 20% / 0.25) 0%, transparent 60%)',
            mixBlendMode: 'screen',
            zIndex: 2,
          }}
        />
        <Suspense
          fallback={
            <div
              className="p-4 text-xs text-muted-foreground italic"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Invocando os dados…
            </div>
          }
        >
          <DiceTray
            apiRef={apiRef}
            onThrown={() => {
              activeRollIdRef.current = useDice3DStore.getState().current?.id ?? null;
              setPhase('rolling');
            }}
            onRollComplete={(results, total) => {
              const pending = useDice3DStore.getState().current;
              // Um callback atrasado da física anterior não pode resolver a
              // próxima rolagem que já estiver na fila.
              if (!pending || activeRollIdRef.current !== pending.id) return;
              const bonus = pending.bonus ?? 0;
              activeRollIdRef.current = null;
              setLastResults(results);
              setLastBonus(bonus);
              setLastTotal(total + bonus);
              setPhase('idle');
              // Resolve a Promise associada (caminho oficial) — se for só visual, resolveCurrent simplesmente avança.
              resolveCurrent(results.map((r) => r.value));
              // A bandeja permanece aberta — o usuário fecha manualmente no X.
            }}
          />
        </Suspense>

        {trayFailed && current && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-4">
            <p className="text-xs text-muted-foreground italic text-center">
              Os dados 3D não carregaram neste aparelho.
            </p>
            <button
              onClick={() => {
                const faces: Record<string, number> = { D4: 4, D6: 6, D8: 8, D10: 10, D12: 12, D20: 20, D100: 100 };
                const values = current.types.map((ty) => {
                  const f = faces[ty] ?? 20;
                  return f === 100 ? Math.floor(Math.random() * 10) * 10 : Math.floor(Math.random() * f) + 1;
                });
                const bonus = current.bonus ?? 0;
                setLastResults(values.map((v, i) => ({ id: `fb_${i}`, type: current.types[i], value: v })));
                setLastBonus(bonus);
                setLastTotal(values.reduce((a, b) => a + b, 0) + bonus);
                setTrayFailed(false);
                resolveCurrent(values);
              }}
              className="flex items-center gap-2 rounded-md border border-accent/50 bg-primary/30 px-4 py-2 text-sm font-bold uppercase tracking-[0.15em] text-accent hover:bg-primary/50 transition-all"
              style={{ fontFamily: "'Cinzel', serif", boxShadow: '0 0 16px hsl(42 78% 58% / 0.35)' }}
            >
              <Hand className="h-4 w-4" /> Rolar dados
            </button>
          </div>
        )}

        {phase === 'armed' && (
          <button
            onClick={() => apiRef.current?.throwAll()}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-md border border-accent/40 bg-primary/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-accent hover:bg-primary/50 transition-all animate-pulse"
            style={{
              fontFamily: "'Cinzel', serif",
              boxShadow: '0 0 16px hsl(42 78% 58% / 0.35)',
            }}
            title="Clique aqui ou diretamente em um dado para lançar"
          >
            <Hand className="h-3.5 w-3.5" /> Clique nos dados para lançar
          </button>
        )}

        {lastTotal !== null && (
          <div
            className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-accent/30"
            style={{
              background:
                'linear-gradient(135deg, hsl(265 30% 8% / 0.85) 0%, hsl(268 40% 6% / 0.85) 100%)',
              boxShadow: '0 0 18px hsl(42 78% 58% / 0.2)',
              zIndex: 3,
            }}
          >
            {lastResults.map((r) => (
              <span
                key={r.id}
                className="px-2 py-0.5 rounded-md text-[11px] tabular-nums font-semibold flex items-center gap-1"
                style={{
                  background: 'linear-gradient(135deg, hsl(268 60% 22%) 0%, hsl(285 55% 18%) 100%)',
                  color: 'hsl(42 90% 75%)',
                  border: '1px solid hsl(42 78% 58% / 0.4)',
                  boxShadow: 'inset 0 0 8px hsl(268 85% 62% / 0.25)',
                  fontFamily: "'Cinzel', serif",
                }}
                title={`${r.type} tirou ${r.value}`}
              >
                <span className="text-[9px] uppercase opacity-70 tracking-wider">{r.type}</span>
                {r.value}
              </span>
            ))}
            {lastBonus !== 0 && (
              <span
                className="px-2 py-0.5 rounded-md text-[11px] tabular-nums font-semibold"
                style={{
                  background: 'linear-gradient(135deg, hsl(42 60% 22%) 0%, hsl(38 55% 16%) 100%)',
                  color: 'hsl(42 90% 78%)',
                  border: '1px solid hsl(42 78% 58% / 0.5)',
                  fontFamily: "'Cinzel', serif",
                }}
                title="Bônus fixo"
              >
                {lastBonus > 0 ? `+${lastBonus}` : lastBonus}
              </span>
            )}
            <span
              className="ml-auto text-sm font-bold tabular-nums tracking-wider"
              style={{
                color: 'hsl(42 90% 70%)',
                fontFamily: "'Cinzel Decorative', serif",
                textShadow: '0 0 10px hsl(42 78% 58% / 0.6)',
              }}
            >
              Σ {lastTotal}
            </span>
          </div>
        )}
      </div>

      <div
        className="px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 border-t border-primary/15 text-center italic"
        style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: '0.15em' }}
      >
        ✦ Destino lançado nos dados ✦
      </div>
    </div>
  );
}
