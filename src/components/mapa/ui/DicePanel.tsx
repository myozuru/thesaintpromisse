/**
 * DicePanel — Fase 13.
 *
 * Painel flutuante de rolagem de dados. Publica rolagens no log global
 * (`useLogStore`) e mantém histórico recente em `useDiceStore`.
 */
import { useState } from 'react';
import { Dices, Plus, Minus, Star, StarOff, Trash2, X, RotateCw } from 'lucide-react';
import { useDiceStore } from '@/stores/useDiceStore';
import { useLogStore } from '@/stores/useLogStore';
import { rollExpression, rollSimple } from '../dice';

const QUICK = [4, 6, 8, 10, 12, 20, 100];

export function DicePanel() {
  const open = useDiceStore((s) => s.open);
  const setOpen = useDiceStore((s) => s.setOpen);
  const modifier = useDiceStore((s) => s.modifier);
  const setModifier = useDiceStore((s) => s.setModifier);
  const advantage = useDiceStore((s) => s.advantage);
  const setAdvantage = useDiceStore((s) => s.setAdvantage);
  const expression = useDiceStore((s) => s.expression);
  const setExpression = useDiceStore((s) => s.setExpression);
  const favorites = useDiceStore((s) => s.favorites);
  const addFavorite = useDiceStore((s) => s.addFavorite);
  const removeFavorite = useDiceStore((s) => s.removeFavorite);
  const history = useDiceStore((s) => s.history);
  const pushRoll = useDiceStore((s) => s.pushRoll);
  const clearHistory = useDiceStore((s) => s.clearHistory);
  const addLog = useLogStore((s) => s.addLog);

  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const doRoll = async (expr: string) => {
    try {
      const r = await rollExpression(expr);
      pushRoll(r);
      addLog('roll', r.pretty);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const quickRoll = async (faces: number) => {
    if (faces === 20 && advantage !== 'none') {
      const expr = `2d20${advantage === 'adv' ? 'kh1' : 'kl1'}${
        modifier > 0 ? `+${modifier}` : modifier < 0 ? modifier : ''
      }`;
      await doRoll(expr);
      return;
    }
    const r = await rollSimple(faces, 1, modifier);
    pushRoll(r);
    addLog('roll', r.pretty);
  };

  const rollExpr = () => { void doRoll(expression.trim()); };

  return (
    <div
      className="absolute top-12 right-2 w-[300px] rounded-md border shadow-2xl flex flex-col text-xs"
      style={{
        background: '#16171a',
        borderColor: '#2a2b30',
        color: '#e6e7eb',
        zIndex: 50,
        maxHeight: 'calc(100% - 60px)',
      }}
    >
      <div
        className="h-9 px-2 flex items-center gap-2 border-b"
        style={{ borderColor: '#2a2b30' }}
      >
        <Dices className="h-4 w-4 text-amber-300" />
        <div className="font-semibold">Dados</div>
        <button
          className="ml-auto h-6 w-6 flex items-center justify-center rounded hover:bg-[#1f2024] text-zinc-400"
          onClick={() => setOpen(false)}
          title="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-2 flex flex-col gap-2 overflow-y-auto">
        {/* Quick dice */}
        <div className="grid grid-cols-7 gap-1">
          {QUICK.map((f) => (
            <button
              key={f}
              className="h-8 rounded border border-[#2a2b30] hover:bg-[#1f2024] hover:border-amber-500/40 text-zinc-200 font-medium"
              onClick={() => quickRoll(f)}
              title={`Rolar 1d${f}`}
            >
              d{f}
            </button>
          ))}
        </div>

        {/* Modifier + adv/dis */}
        <div className="flex items-center gap-2">
          <div className="text-zinc-500">Mod.</div>
          <button
            className="h-6 w-6 flex items-center justify-center rounded border border-[#2a2b30] hover:bg-[#1f2024]"
            onClick={() => setModifier(modifier - 1)}
          >
            <Minus className="h-3 w-3" />
          </button>
          <div className="w-10 text-center tabular-nums">{modifier >= 0 ? `+${modifier}` : modifier}</div>
          <button
            className="h-6 w-6 flex items-center justify-center rounded border border-[#2a2b30] hover:bg-[#1f2024]"
            onClick={() => setModifier(modifier + 1)}
          >
            <Plus className="h-3 w-3" />
          </button>
          <div className="ml-auto flex gap-1">
            {(['none', 'adv', 'dis'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setAdvantage(v)}
                className={`h-6 px-2 rounded border text-[11px] ${
                  advantage === v
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                    : 'border-[#2a2b30] text-zinc-300 hover:bg-[#1f2024]'
                }`}
                title={v === 'none' ? 'Normal' : v === 'adv' ? 'Vantagem' : 'Desvantagem'}
              >
                {v === 'none' ? '—' : v === 'adv' ? 'Van' : 'Des'}
              </button>
            ))}
          </div>
        </div>

        {/* Free expression */}
        <div className="flex gap-1">
          <input
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') rollExpr(); }}
            placeholder="ex: 2d20kh1+5"
            className="flex-1 h-7 px-2 rounded bg-[#0f1012] border border-[#2a2b30] text-zinc-100 outline-none focus:border-amber-500/50 font-mono"
          />
          <button
            onClick={rollExpr}
            className="h-7 px-2 rounded bg-amber-500/15 border border-amber-500/40 text-amber-200 hover:bg-amber-500/25"
          >
            Rolar
          </button>
          <button
            onClick={() => {
              const label = prompt('Nome do favorito:', expression);
              if (label) addFavorite(label, expression);
            }}
            title="Salvar como favorito"
            className="h-7 w-7 flex items-center justify-center rounded border border-[#2a2b30] hover:bg-[#1f2024] text-zinc-300"
          >
            <Star className="h-3.5 w-3.5" />
          </button>
        </div>
        {error && <div className="text-[11px] text-red-300">{error}</div>}

        {/* Favorites */}
        {favorites.length > 0 && (
          <div className="flex flex-col gap-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Favoritos</div>
            <div className="flex flex-wrap gap-1">
              {favorites.map((f) => (
                <div
                  key={f.id}
                  className="group flex items-center gap-1 rounded border border-[#2a2b30] bg-[#0f1012] pl-2 pr-1 h-7"
                >
                  <button
                    onClick={() => doRoll(f.expression)}
                    title={f.expression}
                    className="text-zinc-200 hover:text-amber-200"
                  >
                    {f.label}
                  </button>
                  <button
                    onClick={() => removeFavorite(f.id)}
                    title="Remover"
                    className="h-5 w-5 rounded flex items-center justify-center text-zinc-500 hover:text-red-300 opacity-0 group-hover:opacity-100"
                  >
                    <StarOff className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History */}
        <div className="flex items-center gap-1 mt-1">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">Histórico</div>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="ml-auto h-5 w-5 rounded flex items-center justify-center text-zinc-500 hover:text-red-300"
              title="Limpar histórico"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex flex-col gap-1 max-h-[240px] overflow-y-auto">
          {history.length === 0 && (
            <div className="text-[11px] text-zinc-500 italic">Nenhuma rolagem ainda.</div>
          )}
          {history.map((h) => (
            <div
              key={h.id}
              className="flex items-start gap-1 rounded border border-[#2a2b30] bg-[#0f1012] p-1.5"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-zinc-500 font-mono truncate">{h.pretty}</div>
                <div className="text-amber-200 font-semibold tabular-nums">= {h.total}</div>
              </div>
              <button
                onClick={() => doRoll(h.expression)}
                title="Rolar de novo"
                className="h-6 w-6 rounded flex items-center justify-center text-zinc-400 hover:bg-[#1f2024] hover:text-amber-200"
              >
                <RotateCw className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
