/**
 * Revigorar (Especialista em Combate, 2º nível) — botão de Ação Bônus.
 */
import { useState } from 'react';
import type { Character } from '@/types';
import {
  hasRevigorar,
  revigorarBonus,
  revigorarDados,
  revigorarExecutar,
  revigorarPodeUsar,
  revigorarUsosMax,
  revigorarUsosRestantes,
} from '@/lib/revigorar';

export function RevigorarButton({ character: c }: { character: Character }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!hasRevigorar(c)) return null;

  const chk = revigorarPodeUsar(c);
  const dados = revigorarDados(c.level ?? 1);
  const bonus = revigorarBonus(c);

  const run = async () => {
    setBusy(true);
    const r = await revigorarExecutar(c.id);
    setBusy(false);
    setMsg(r.ok ? `Curou ${r.curado} PV (${dados}d10 + ${bonus} = ${r.total}).` : r.reason);
  };

  return (
    <div className="space-y-1 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2" data-testid="revigorar-secao">
      <p className="text-[11px] font-bold text-emerald-500">
        💚 Revigorar — ação bônus · {dados}d10 {bonus >= 0 ? '+' : ''}{bonus} ·{' '}
        {revigorarUsosRestantes(c)}/{revigorarUsosMax(c)} usos
      </p>
      <button
        type="button"
        data-testid="revigorar-usar"
        disabled={!chk.ok || busy}
        onClick={run}
        className="w-full rounded border border-emerald-500 bg-emerald-500/20 px-2 py-1 text-[11px] font-bold text-emerald-500 hover:bg-emerald-500/40 disabled:opacity-40"
      >
        Revigorar (Ação Bônus)
      </button>
      {!chk.ok && chk.reason && <p className="text-[11px] text-destructive">{chk.reason}</p>}
      {msg && <p className="text-[11px] text-muted-foreground" data-testid="revigorar-msg">{msg}</p>}
    </div>
  );
}
