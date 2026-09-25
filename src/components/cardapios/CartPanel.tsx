import { useState } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, Coins } from 'lucide-react';
import { useCartStore } from '@/stores/useCartStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { ConfirmPurchaseDialog } from './ConfirmPurchaseDialog';
import { playClickSound } from '@/lib/sounds';
import { cn } from '@/lib/utils';

interface Props {
  estId: string;
  estName: string;
}

/**
 * Carrinho do estabelecimento, exibido para player no header do estabelecimento
 * quando há itens. Permite ajustar quantidades, remover linhas e abrir o diálogo
 * de confirmação de compra.
 */
const EMPTY_LINES: never[] = [];

export function CartPanel({ estId, estName }: Props) {
  const lines = useCartStore((s) => s.carts[estId] ?? EMPTY_LINES);
  const setQty = useCartStore((s) => s.setQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const totalsByCurrency = useCartStore((s) => s.totalsByCurrency);
  const currencies = useMoneyStore((s) => s.currencies);

  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (lines.length === 0) return null;

  const totalCount = lines.reduce((acc, l) => acc + l.qty, 0);
  const totals = totalsByCurrency(estId);

  return (
    <>
      <div className="rounded-md border border-primary/30 bg-primary/5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
            playClickSound();
          }}
          className="flex w-full items-center gap-2 px-2 py-1.5 text-xs hover:bg-primary/10 transition-colors"
        >
          <ShoppingCart className="h-3.5 w-3.5 text-primary" />
          <span className="font-bold text-primary">
            Carrinho — {totalCount} item{totalCount === 1 ? '' : 's'}
          </span>
          <span className="ml-auto flex items-center gap-1 font-mono text-xp">
            {Object.entries(totals).map(([cid, t]) => {
              const sym = currencies.find((c) => c.id === cid)?.symbol ?? '';
              return (
                <span key={cid}>
                  {sym}{t}
                </span>
              );
            })}
          </span>
        </button>

        {open && (
          <div className="border-t border-primary/20 p-2 space-y-1.5">
            {lines.map((l) => {
              const sym = currencies.find((c) => c.id === l.currencyId)?.symbol ?? '';
              return (
                <div
                  key={l.itemId}
                  className="flex items-center gap-2 rounded border border-border bg-card/50 px-2 py-1 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium text-foreground">{l.name}</div>
                    <div className="text-muted-foreground font-mono">
                      {sym}{l.unitPrice} cada
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => { setQty(estId, l.itemId, l.qty - 1); playClickSound(); }}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title="Diminuir"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center font-mono font-bold tabular-nums">
                      {l.qty}
                    </span>
                    <button
                      onClick={() => { setQty(estId, l.itemId, l.qty + 1); playClickSound(); }}
                      className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      title="Aumentar"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className={cn('w-14 text-right font-mono font-bold text-xp')}>
                    {sym}{l.unitPrice * l.qty}
                  </div>
                  <button
                    onClick={() => { removeItem(estId, l.itemId); playClickSound(); }}
                    className="rounded p-1 text-muted-foreground hover:bg-hp/20 hover:text-hp"
                    title="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={() => { clearCart(estId); playClickSound(); }}
                className="text-[11px] text-muted-foreground hover:text-hp underline"
              >
                Esvaziar
              </button>
              <button
                onClick={() => { setConfirmOpen(true); playClickSound(); }}
                className="flex items-center gap-1 rounded-md bg-gradient-to-r from-primary to-accent px-3 py-1 text-xs font-bold text-primary-foreground hover:shadow-[0_0_18px_-4px_hsl(var(--primary)/0.6)] transition-all"
              >
                <Coins className="h-3 w-3" /> Finalizar compra
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmPurchaseDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        estId={estId}
        estName={estName}
      />
    </>
  );
}
