/**
 * Réplicas Materializáveis: lista das réplicas que o Mestre entregou ao
 * personagem, com Materializar / Desfazer, e o prompt de sustentação.
 */
import { useEffect } from 'react';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useLogStore } from '@/stores/useLogStore';
import {
  checarReplicasSoltas, custosDoPorte, desfazerReplica, materializarReplica, pagarSustentacao,
} from '@/lib/replicas';

export function ReplicasSection({ charId }: { charId: string }) {
  const items = useInventoryStore((s) => s.items);
  const pe = useCharacterStore((s) => s.characters.find((c) => c.id === charId)?.peCurrent ?? 0);
  const replicas = Object.values(items).filter((i) => i.ownerId === charId && i.entity.replica);
  if (replicas.length === 0) return null;
  return (
    <div className="rounded-md border border-primary/40 bg-primary/5 p-2 space-y-1.5" data-testid="replicas-section">
      <div className="text-[11px] font-bold uppercase tracking-wider text-primary">✨ Réplicas</div>
      {replicas.map((r) => {
        const cfg = r.entity.replica!;
        return (
          <div key={r.instanceId} className="flex items-center gap-2 text-xs" data-testid={`replica-${r.entity.nome}`}>
            <div className="flex-1 min-w-0">
              <b className="text-foreground">{r.entity.nome}</b>
              <span className="text-muted-foreground"> · {custosDoPorte(cfg.porte).label} · {cfg.peInvocacao} PE{cfg.cobrarPorRodada ? ` / ${cfg.peSustentacao} PE por rodada` : ''}</span>
              {r.materializada && <span className="ml-1 text-primary font-bold">(materializada)</span>}
            </div>
            {r.materializada ? (
              <button
                className="px-2 py-0.5 rounded border border-border bg-secondary/40 hover:bg-secondary"
                onClick={() => desfazerReplica(r.instanceId, 'desfeita pelo usuário')}
              >Desfazer</button>
            ) : (
              <button
                disabled={pe < cfg.peInvocacao}
                className="px-2 py-0.5 rounded bg-primary/20 border border-primary/50 font-bold hover:bg-primary/30 disabled:opacity-40"
                onClick={() => {
                  const res = materializarReplica(r.instanceId);
                  if (!res.ok) useLogStore.getState().addLog('combat', `❌ ${res.reason}`);
                }}
              >Materializar ({cfg.peInvocacao} PE)</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Prompt global de sustentação + vigia de réplicas que saíram das mãos. */
export function ReplicaSustentacaoPrompt() {
  const items = useInventoryStore((s) => s.items);
  const chars = useCharacterStore((s) => s.characters);
  useEffect(() => { checarReplicasSoltas(); }, [chars, items]);
  const pend = Object.values(items).find((i) => i.materializada && i.sustentacaoPendente && i.entity.replica);
  if (!pend) return null;
  const c = chars.find((x) => x.id === pend.ownerId);
  const cfg = pend.entity.replica!;
  const podePagar = (c?.peCurrent ?? 0) >= cfg.peSustentacao;
  return (
    <div
      role="dialog" aria-label="Sustentar réplica" data-testid="replica-sustentacao-prompt"
      className="fixed bottom-56 left-1/2 z-[70] w-[min(92vw,380px)] -translate-x-1/2 rounded-lg border-2 border-primary/60 bg-card p-3 shadow-lg space-y-2"
    >
      <div className="text-xs text-foreground leading-snug">
        ✨ <b>{c?.name ?? 'Personagem'}</b>: manter a réplica <b>{pend.entity.nome}</b> por mais uma rodada?
        Custa <b>{cfg.peSustentacao} PE</b>{!podePagar && ' — PE insuficiente'}.
      </div>
      <div className="flex gap-1.5">
        <button
          data-testid="replica-sustentar"
          disabled={!podePagar}
          onClick={() => pagarSustentacao(pend.instanceId)}
          className="flex-1 text-[11px] px-2 py-1 rounded bg-primary/20 border border-primary/50 font-bold hover:bg-primary/30 disabled:opacity-40"
        >Sustentar ({cfg.peSustentacao} PE)</button>
        <button
          data-testid="replica-deixar"
          onClick={() => desfazerReplica(pend.instanceId, 'sustentação não paga')}
          className="flex-1 text-[11px] px-2 py-1 rounded border border-border bg-secondary/40 hover:bg-secondary"
        >Deixar desfazer</button>
      </div>
    </div>
  );
}
