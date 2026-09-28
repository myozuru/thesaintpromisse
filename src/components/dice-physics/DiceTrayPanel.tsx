/**
 * DiceTrayPanel — corpo da bandeja 3D (física, suspense dramático e resultados).
 * Única instância viva por vez:
 *  - Dentro da janela flutuante (Global3DDiceOverlay) para rolagens comuns;
 *  - Embutida no rodapé do pedido de teste (TestRequestOverlay) para
 *    rolagens com layout 'test-request' — nesse caso a janela flutuante
 *    se oculta para não haver dois canvases WebGL.
 */
import { Suspense, useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react';
import { Hand } from 'lucide-react';
import { DiceTray, type DiceTrayApi, type DiceRollResult } from './index';
import { MAX_THROW_POWER } from './DiceTray';
import { useDice3DStore } from '@/stores/useDice3DStore';
import { cn } from '@/lib/utils';

export interface DiceTrayPanelHandle {
  /** Limpa os dados e volta ao estado ocioso (botão fechar da janela). */
  close: () => void;
}

interface Props {
  /** Referência opcional para o pai controlar fechar/limpar. */
  handleRef?: RefObject<DiceTrayPanelHandle | null>;
  className?: string;
}

export function DiceTrayPanel({ handleRef, className }: Props) {
  const current = useDice3DStore((s) => s.current);
  const resolveCurrent = useDice3DStore((s) => s.resolveCurrent);
  const setVisible = useDice3DStore((s) => s.setVisible);

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
  /** Nível de drama da rolagem atual (0 = normal). */
  const [drama, setDrama] = useState<0 | 1 | 2 | 3>(0);
  const [cinematicFocus, setCinematicFocus] = useState(false);
  /** true enquanto o resultado é segurado em suspense (modo dramático). */
  const [revealing, setRevealing] = useState(false);
  const [shake, setShake] = useState(false);
  /** Carga do lançamento ao segurar o botão (0..1). */
  const [charge, setCharge] = useState(0);
  const chargeStartRef = useRef<number | null>(null);
  const chargeRafRef = useRef<number | null>(null);
  const CHARGE_MS = 1800;

  const stopCharge = () => {
    if (chargeRafRef.current) cancelAnimationFrame(chargeRafRef.current);
    chargeRafRef.current = null;
    chargeStartRef.current = null;
    setCharge(0);
  };
  const startCharge = () => {
    if (phase !== 'armed' || chargeStartRef.current != null) return;
    chargeStartRef.current = performance.now();
    const tick = () => {
      if (chargeStartRef.current == null) return;
      setCharge(Math.min(1, (performance.now() - chargeStartRef.current) / CHARGE_MS));
      chargeRafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };
  const releaseCharge = () => {
    if (chargeStartRef.current == null) return;
    const c = Math.min(1, (performance.now() - chargeStartRef.current) / CHARGE_MS);
    stopCharge();
    apiRef.current?.throwAll(1 + c * (MAX_THROW_POWER - 1));
  };
  useEffect(() => () => stopCharge(), []);

  useImperativeHandle(handleRef, () => ({
    close: () => {
      activeRollIdRef.current = null;
      apiRef.current?.clear();
      setPhase('idle');
      setTrayFailed(false);
    },
  }), []);

  useEffect(() => {
    if (!current) return;
    setDrama(current.drama ?? 0);
    setCinematicFocus(!!current.cinematicFocus && current.types.length === 1);
    setRevealing(false);
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
        if (Date.now() - startedAt > 30000) {
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
  }, [current]);

  return (
    <div className={cn('relative h-full w-full', shake && 'animate-[dice-shake_0.6s_ease-in-out]', className)}>
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
          cinematicFocus={cinematicFocus}
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
            setPhase('idle');
            const lvl = pending.drama ?? 0;
            // Suspense antes de revelar e tempo para apreciar o resultado.
            const revealDelay = [0, 700, 1400, 2200][lvl];
            const holdAfter = [0, 900, 1400, 2000][lvl];
            const finish = () => {
              setRevealing(false);
              setLastResults(results);
              setLastBonus(bonus);
              setLastTotal(total + bonus);
              if (lvl >= 3) { setShake(true); setTimeout(() => setShake(false), 600); }
              const close = () => {
                // Resolve a Promise associada (caminho oficial) — se for só visual, resolveCurrent simplesmente avança.
                resolveCurrent(results.map((r) => r.value));
                const next = useDice3DStore.getState().current;
                if (pending.layout === 'test-request' && !next) {
                  setVisible(false);
                  apiRef.current?.clear();
                }
              };
              if (holdAfter) setTimeout(close, holdAfter); else close();
            };
            if (revealDelay) { setRevealing(true); setTimeout(finish, revealDelay); } else finish();
            // Fora de pedidos, a bandeja permanece aberta até o usuário fechar.
          }}
        />
      </Suspense>

      {current && phase === 'idle' && !trayFailed && !revealing && lastTotal === null && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-xs italic text-muted-foreground pointer-events-none">
          Carregando os dados…
        </div>
      )}

      {drama >= 1 && current && (
        <div
          className="absolute inset-0 pointer-events-none z-[3]"
          style={{ boxShadow: `inset 0 0 ${40 + drama * 30}px ${10 + drama * 10}px hsl(265 80% 3% / ${0.5 + drama * 0.12})` }}
        />
      )}

      {revealing && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <div className="font-display text-4xl font-black tracking-[0.4em] text-accent animate-pulse" style={{ textShadow: '0 0 18px hsl(42 78% 58% / 0.8)' }}>…</div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-accent/70">{drama >= 3 ? 'O destino hesita' : drama === 2 ? 'Os astros decidem' : 'Revelando'}</div>
        </div>
      )}

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
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); startCharge(); }}
          onPointerUp={releaseCharge}
          onPointerCancel={stopCharge}
          onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startCharge(); } }}
          onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') releaseCharge(); }}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-md border border-accent/40 bg-primary/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-accent hover:bg-primary/50 transition-all animate-pulse overflow-hidden select-none touch-none"
          style={{
            fontFamily: "'Cinzel', serif",
            boxShadow: '0 0 16px hsl(42 78% 58% / 0.35)',
          }}
          title="Clique para lançar; segure para lançar com mais força"
        >
          <span className="absolute inset-y-0 left-0 rounded-md bg-accent/30" style={{ width: `${charge * 100}%` }} />
          <Hand className="relative h-3.5 w-3.5" />
          <span className="relative">{charge > 0 ? `Força ${Math.round(100 + charge * (MAX_THROW_POWER - 1) * 100)}%` : 'Clique ou segure para lançar'}</span>
        </button>
      )}

      {lastTotal !== null && (
        <div
          className={cn("absolute bottom-2 left-2 right-2 flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-accent/30", cinematicFocus && lastResults.length === 1 && "justify-center")}
          style={{
            background:
              'linear-gradient(135deg, hsl(265 30% 8% / 0.85) 0%, hsl(268 40% 6% / 0.85) 100%)',
            boxShadow: '0 0 18px hsl(42 78% 58% / 0.2)',
            zIndex: 3,
          }}
        >
          {!cinematicFocus && lastResults.map((r) => (
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
          {!cinematicFocus && <span
            className="ml-auto text-sm font-bold tabular-nums tracking-wider"
            style={{
              color: 'hsl(42 90% 70%)',
              fontFamily: "'Cinzel Decorative', serif",
              textShadow: '0 0 10px hsl(42 78% 58% / 0.6)',
            }}
          >
            Σ {lastTotal}
          </span>}
          {cinematicFocus && lastResults.length === 1 && (
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
              {lastBonus === 0 ? 'Sem bônus' : `Bônus ${lastBonus > 0 ? '+' : ''}${lastBonus}`} · Total {lastTotal}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
