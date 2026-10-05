import { useZonaRiscoStore, responderZonaRisco, ZONA_RISCO_CUSTO } from '@/lib/zonaRisco';

/** Pergunta da Zona de Risco: inimigo entrou no alcance — atacar por 2 PE? */
export function ZonaRiscoPrompt() {
  const pedido = useZonaRiscoStore((s) => s.fila[0]);
  if (!pedido) return null;
  return (
    <div className="fixed bottom-40 left-1/2 z-[70] w-[min(92vw,360px)] -translate-x-1/2 rounded-lg border-2 border-primary/60 bg-card p-3 shadow-lg space-y-2" role="dialog" aria-label="Zona de Risco">
      <div className="text-xs text-foreground leading-snug">
        ⚔️ <b>{pedido.alvoName}</b> entrou no alcance de <b>{pedido.espName}</b>.
        Zona de Risco: gastar {ZONA_RISCO_CUSTO} PE para atacar? (1 vez por rodada)
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => responderZonaRisco(pedido.id, true)} className="flex-1 text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold">Atacar ({ZONA_RISCO_CUSTO} PE)</button>
        <button onClick={() => responderZonaRisco(pedido.id, false)} className="flex-1 text-xs px-2 py-1 rounded border border-border bg-secondary/40 hover:bg-secondary">Não</button>
      </div>
    </div>
  );
}
