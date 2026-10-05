/**
 * Golpe Falso (Especialista em Combate, 2º nível).
 *
 *  - Na ficha do Especialista: reação completa (escolhe o aliado que vai
 *    atacar e o inimigo ao alcance da arma empunhada).
 *  - Na ficha do aliado: aviso de que há um Especialista pronto para ajudar
 *    contra o alvo selecionado.
 */
import { useState } from 'react';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import {
  golpeFalsoAlcanceM,
  golpeFalsoDisponiveisPara,
  golpeFalsoDistancia,
  golpeFalsoExecutar,
  golpeFalsoPodeUsar,
  hasGolpeFalso,
} from '@/lib/golpeFalso';
import { getReactionsAvailable } from '@/lib/reactionBudget';

const fmt = (n: number) => n.toFixed(1).replace('.', ',');

export function GolpeFalsoSection({ character: c, target }: { character: Character; target: Character | null }) {
  const characters = useCharacterStore((s) => s.characters);
  useMapStore((s) => s.entities); // re-mede quando as peças se movem
  const [aliadoId, setAliadoId] = useState('');
  const [inimigoId, setInimigoId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ─── Ficha do ALIADO: só o aviso ────────────────────────────────────────
  if (!hasGolpeFalso(c)) {
    if (!target) return null;
    const prontos = golpeFalsoDisponiveisPara(c.id, target.id);
    if (prontos.length === 0) return null;
    return (
      <div
        className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-foreground"
        data-testid="golpe-falso-aviso"
      >
        🎭 <b>Golpe Falso</b> disponível: {prontos.map((p) => p.name).join(', ')} pode reagir e dar vantagem neste ataque.
      </div>
    );
  }

  // ─── Ficha do ESPECIALISTA: reação ──────────────────────────────────────
  const alcance = golpeFalsoAlcanceM(c);
  const aliados = characters.filter((x) => x.id !== c.id && x.category !== 'INIMIGO');
  const inimigos = characters.filter((x) => x.id !== c.id && x.category === 'INIMIGO');
  const tag = (id: string) => {
    const d = golpeFalsoDistancia(c.id, id);
    if (d === null) return ' · fora do mapa';
    if (alcance === null) return ` · ${fmt(d)} m`;
    return d > alcance + 0.05 ? ` · ${fmt(d)} m (fora de alcance)` : ` · ${fmt(d)} m (ao alcance)`;
  };
  const chk = aliadoId && inimigoId ? golpeFalsoPodeUsar(c.id, aliadoId, inimigoId) : { ok: false as const };
  const sel = 'w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground';

  const run = async () => {
    setBusy(true);
    const r = await golpeFalsoExecutar(c.id, aliadoId, inimigoId);
    setBusy(false);
    setMsg(
      r.ok
        ? r.falhou
          ? `Inimigo caiu no blefe (${r.total} vs CD ${r.cd}) — seu aliado ataca com vantagem.`
          : `Inimigo não caiu no blefe (${r.total} vs CD ${r.cd}). Reação gasta.`
        : r.reason,
    );
  };

  return (
    <div
      className="space-y-1.5 rounded-md border border-primary/40 bg-primary/5 p-2"
      data-testid="golpe-falso-secao"
    >
      <p className="text-xs font-bold text-primary">
        🎭 Golpe Falso — reação ({getReactionsAvailable(c)} disp.)
        {alcance !== null && <span className="ml-1 font-normal text-muted-foreground">· alcance {alcance} m</span>}
      </p>
      <select aria-label="Aliado que vai atacar" className={sel} value={aliadoId} onChange={(e) => setAliadoId(e.target.value)}>
        <option value="">Aliado que vai atacar…</option>
        {aliados.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <select aria-label="Inimigo atacado" className={sel} value={inimigoId} onChange={(e) => setInimigoId(e.target.value)}>
        <option value="">Inimigo atacado…</option>
        {inimigos.map((x) => <option key={x.id} value={x.id}>{x.name}{tag(x.id)}</option>)}
      </select>
      <button
        type="button"
        data-testid="golpe-falso-usar"
        disabled={!chk.ok || busy}
        onClick={run}
        className="w-full rounded border border-primary bg-primary/25 px-2 py-1 text-xs font-bold text-primary hover:bg-primary/45 disabled:opacity-40"
      >
        Fingir o golpe (reação)
      </button>
      {!chk.ok && aliadoId && inimigoId && 'reason' in chk && chk.reason && (
        <p className="text-xs text-destructive">{chk.reason}</p>
      )}
      {msg && <p className="text-xs text-muted-foreground" data-testid="golpe-falso-msg">{msg}</p>}
    </div>
  );
}
