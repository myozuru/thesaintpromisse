import { useIndomavelStore } from '@/lib/indomavel';

/** Pergunta do Indomável: falhou no TR — gastar 1 PE e rolar de novo? */
export function IndomavelPrompt() {
  const pedido = useIndomavelStore((s) => s.pedido);
  if (!pedido) return null;
  return (
    <div
      className="fixed bottom-24 left-1/2 z-[220] w-[min(92vw,380px)] -translate-x-1/2 space-y-2 rounded-lg border-2 border-primary/60 bg-card p-3 shadow-lg"
      role="dialog"
      aria-label="Indomável"
      data-testid="indomavel-prompt"
    >
      <div className="text-xs leading-snug text-foreground">
        🛡️ <b>{pedido.charName}</b> falhou no TR de <b>{pedido.testName}</b> ({pedido.total} vs CD {pedido.dc}).
        {' '}Gastar <b>1 PE</b> e um uso de <b>Indomável</b> para rolar o d20 de novo e ficar com o melhor resultado?
        {' '}({pedido.restantes} uso(s) restante(s))
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          data-testid="indomavel-sim"
          onClick={() => pedido.resolve(true)}
          className="flex-1 rounded bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
        >
          Rolar de novo (1 PE)
        </button>
        <button
          type="button"
          data-testid="indomavel-nao"
          onClick={() => pedido.resolve(false)}
          className="flex-1 rounded border border-border bg-secondary/40 px-2 py-1 text-[11px] hover:bg-secondary"
        >
          Aceitar a falha
        </button>
      </div>
    </div>
  );
}
