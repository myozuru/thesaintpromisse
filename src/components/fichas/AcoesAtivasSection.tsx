/**
 * Ações ativas OMNI (itens do inventário): escolher alvo e usar.
 */
import { useState } from 'react';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { acoesAtivasDe, custoPEDe, executarAcaoAtiva } from '@/lib/omni/acaoAtiva';

const ACAO_ROT = { comum: 'Ação Comum', bonus: 'Ação Bônus', reacao: 'Reação', livre: 'Livre' } as const;

export function AcoesAtivasSection({ charId }: { charId: string }) {
  useInventoryStore((s) => s.items);
  const chars = useCharacterStore((s) => s.characters);
  const [alvo, setAlvo] = useState('');
  const [multiplos, setMultiplos] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const u = chars.find((c) => c.id === charId);
  const lista = acoesAtivasDe(charId);
  if (!u || lista.length === 0) return null;
  const alvos = chars;
  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 p-2 space-y-1.5" data-testid="acoes-ativas-section">
      <div className="flex items-center gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-primary flex-1">⚡ Ações Ativas</div>
        <select
          data-testid="acao-ativa-alvo"
          value={alvo}
          onChange={(e) => setAlvo(e.target.value)}
          className="h-6 rounded border border-input bg-background px-1 text-xs"
        >
          <option value="">Alvo…</option>
          {alvos.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      {lista.map(({ instanceId, ent, cfg }) => (
        <div key={instanceId + cfg.id} className="flex items-center gap-2 text-xs" data-testid={`acao-ativa-${cfg.nome}`}>
          <div className="flex-1 min-w-0">
            <b className="text-foreground">{cfg.nome}</b>
            <span className="text-muted-foreground">
              {' '}· {ent.nome} · {ACAO_ROT[cfg.acao]} · {custoPEDe(cfg, u)} PE
              {cfg.consumirContador ? ` + cargas de ${cfg.consumirContador.nome} (${u.omniCounters?.[cfg.consumirContador.nome.trim().toLowerCase()] ?? 0})` : ''}
              {cfg.tipo_alvo === 'proprio' ? ' · próprio' : cfg.tipo_alvo === 'area' ? ` · área: ${cfg.area?.forma ?? 'configurar'}` : ''}
              {cfg.alcanceM > 0 ? ` · ${String(cfg.alcanceM).replace('.', ',')} m` : ''}
            </span>
          </div>
          {cfg.tipo_alvo === 'multiplo' && <select multiple aria-label={`Alvos de ${cfg.nome}`} className="rounded border border-input bg-background" value={multiplos[instanceId + cfg.id] ?? []}
            onChange={e => setMultiplos({ ...multiplos, [instanceId + cfg.id]: Array.from(e.target.selectedOptions, o => o.value) })}>
            {chars.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>}
          <button
            disabled={busy}
            className="px-2 py-0.5 rounded bg-primary/20 border border-primary/50 font-bold hover:bg-primary/30 disabled:opacity-40"
            onClick={async () => {
              setBusy(true);
              try {
                const r = await executarAcaoAtiva(charId, cfg, cfg.tipo_alvo === 'multiplo' ? (multiplos[instanceId + cfg.id] ?? []) : alvo, ent);
                if (!r.ok) useLogStore.getState().addLog('combat', `❌ ${cfg.nome}: ${r.reason}`);
              } finally { setBusy(false); }
            }}
          >Usar</button>
        </div>
      ))}
    </div>
  );
}
