import { useFortunaStore } from '@/lib/fortuna';

/** Pergunta da Postura da Fortuna: rolar o d20 de novo? */
export function FortunaPrompt() {
  const pedido = useFortunaStore((s) => s.pedido);
  if (!pedido) return null;
  return (
    <div className="fixed bottom-24 left-1/2 z-[70] w-[min(92vw,360px)] -translate-x-1/2 rounded-lg border-2 border-primary/60 bg-card p-3 shadow-lg space-y-2" role="dialog" aria-label="Postura da Fortuna">
      <div className="text-xs text-foreground leading-snug">
        🍀 <b>{pedido.charName}</b> tirou <b>{pedido.d20}</b> no d20 {pedido.tipo === 'ataque' ? 'de ataque' : 'de resistência'}.
        Postura da Fortuna: rolar de novo? O novo resultado vale. ({pedido.restantes} uso(s) nesta rodada)
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => pedido.resolve(true)} className="flex-1 text-[11px] px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 font-bold">Rolar de novo</button>
        <button onClick={() => pedido.resolve(false)} className="flex-1 text-[11px] px-2 py-1 rounded border border-border bg-secondary/40 hover:bg-secondary">Manter</button>
      </div>
    </div>
  );
}
