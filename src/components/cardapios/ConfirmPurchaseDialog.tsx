import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Coins, AlertTriangle } from 'lucide-react';
import { useCartStore } from '@/stores/useCartStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useItemStore } from '@/stores/useItemStore';
import { useLogStore } from '@/stores/useLogStore';
import { useMenuStore } from '@/stores/useMenuStore';
import { createEmptyRdByType } from '@/types';
import { toast } from '@/components/ui/use-toast';
import { playClickSound } from '@/lib/sounds';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  estId: string;
  estName: string;
}

/**
 * Diálogo de confirmação de compra do carrinho inteiro.
 * Mostra resumo, escolhe ficha + carteira, e — ao confirmar —
 * debita o saldo, decrementa o estoque, adiciona ao inventário e limpa o carrinho.
 */
const EMPTY_LINES: never[] = [];

export function ConfirmPurchaseDialog({ open, onOpenChange, estId, estName }: Props) {
  const lines = useCartStore((s) => s.carts[estId] ?? EMPTY_LINES);
  const clearCart = useCartStore((s) => s.clearCart);
  const totalsByCurrency = useCartStore((s) => s.totalsByCurrency);

  const currencies = useMoneyStore((s) => s.currencies);
  const wallets = useMoneyStore((s) => s.wallets);
  const spend = useMoneyStore((s) => s.spend);
  const ensurePersonal = useMoneyStore((s) => s.ensurePersonalWallet);
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);
  const inventoryItems = useItemStore((s) => s.items);
  const addInventoryItem = useItemStore((s) => s.addItem);
  const updateInventoryItem = useItemStore((s) => s.updateItem);
  const consumeStock = useMenuStore((s) => s.consumeStock);
  const establishments = useMenuStore((s) => s.establishments);

  const playerChars = useMemo(
    () => characters.filter((c) => c.createdBy === 'PLAYER'),
    [characters],
  );

  const [charId, setCharId] = useState<string>(playerChars[0]?.id ?? '');
  const [walletId, setWalletId] = useState<string>('');

  const char = playerChars.find((c) => c.id === charId);
  const myWallets = char ? wallets.filter((w) => w.members.includes(char.id)) : [];

  // Garante carteira pessoal e seleciona se ainda não houver.
  const pickWalletForChar = (cid: string) => {
    const c = playerChars.find((p) => p.id === cid);
    if (!c) return;
    const personalId = ensurePersonal(c.id, c.name);
    setWalletId(personalId);
  };

  // Seleção inicial quando o diálogo abre.
  if (open && !charId && playerChars.length > 0) {
    setCharId(playerChars[0].id);
    pickWalletForChar(playerChars[0].id);
  }
  if (open && charId && !walletId) {
    pickWalletForChar(charId);
  }

  const totals = totalsByCurrency(estId);
  const wallet = wallets.find((w) => w.id === walletId);

  // Valida saldo + estoque
  const issues: string[] = [];
  if (wallet) {
    for (const [cid, total] of Object.entries(totals)) {
      const have = wallet.balances[cid] ?? 0;
      if (have < total) {
        const sym = currencies.find((c) => c.id === cid)?.symbol ?? '';
        issues.push(`Saldo insuficiente em ${wallet.name}: precisa ${sym}${total}, tem ${sym}${have}.`);
      }
    }
  }
  // Valida estoque ao vivo
  for (const line of lines) {
    const est = establishments.find((e) => e.id === line.estId);
    const menu = est?.menus.find((m) => m.id === line.menuId);
    const it = menu?.items.find((i) => i.id === line.itemId);
    if (!it) {
      issues.push(`"${line.name}" não está mais disponível.`);
      continue;
    }
    if (it.stock !== undefined && it.stock < line.qty) {
      issues.push(`"${line.name}": estoque insuficiente (${it.stock} disponível${it.stock === 1 ? '' : 's'}).`);
    }
    if (it.hiddenMode === 'soldout') {
      issues.push(`"${line.name}" está marcado como esgotado.`);
    }
  }

  const camBlocked = char?.origin === 'Corpo Amaldiçoado Mutante (CAM)' &&
    lines.some((l) => {
      const est = establishments.find((e) => e.id === l.estId);
      const menu = est?.menus.find((m) => m.id === l.menuId);
      return menu?.items.find((i) => i.id === l.itemId)?.isFood;
    });

  const canConfirm = lines.length > 0 && !!wallet && issues.length === 0 && !camBlocked;

  const confirm = () => {
    if (!wallet || !char) return;
    playClickSound();

    // Cobra cada moeda
    for (const [cid, total] of Object.entries(totals)) {
      const ok = spend(wallet.id, cid, total, `Compra em ${estName}`, char.id);
      if (!ok) {
        toast({
          title: '❌ Falha ao cobrar',
          description: `Não foi possível debitar ${total} de ${wallet.name}.`,
          variant: 'destructive',
        });
        return;
      }
    }

    // Decrementa estoque + adiciona ao inventário
    const summary: string[] = [];
    for (const line of lines) {
      const est = establishments.find((e) => e.id === line.estId);
      const menu = est?.menus.find((m) => m.id === line.menuId);
      const it = menu?.items.find((i) => i.id === line.itemId);
      if (!it) continue;

      consumeStock(line.estId, line.menuId, line.itemId, line.qty);

      const existing = inventoryItems.find(
        (inv) =>
          inv.name === it.name &&
          (inv.isFood ?? false) === (it.isFood ?? false) &&
          inv.assignedTo.includes(char.id),
      );
      if (existing) {
        updateInventoryItem(existing.id, {
          quantity: (existing.quantity || 1) + line.qty,
        });
      } else {
        addInventoryItem({
          id: crypto.randomUUID(),
          name: it.name,
          category: '',
          description: it.description ?? '',
          weight: 0,
          cost: line.unitPrice,
          slots: 1,
          quantity: line.qty,
          slotType: 'nenhum',
          bonusHP: 0,
          bonusPE: 0,
          bonusESC: 0,
          bonusRD: 0,
          bonusRdByType: createEmptyRdByType(),
          bonusSlots: 0,
          bonusCA: 0,
          bonusDC: 0,
          bonusActions: 0,
          bonusBonusActions: 0,
          bonusReactions: 0,
          bonusOpportunity: 0,
          rollBonuses: [],
          assignedTo: [char.id],
          isFood: it.isFood ?? false,
          hungerRestore: it.hungerRestore ?? 0,
          hpRestore: it.hpRestore ?? 0,
          peRestore: it.peRestore ?? 0,
          pvtRestore: it.pvtRestore ?? 0,
        });
      }
      summary.push(`${line.qty}× ${it.name}`);
    }

    addLog(
      'system',
      `🛒 ${char.name} comprou em ${estName}: ${summary.join(', ')}.`,
    );
    toast({
      title: '✅ Compra realizada',
      description: `${summary.length} item(ns) adicionado(s) ao inventário de ${char.name}.`,
    });
    clearCart(estId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Confirmar compra — {estName}
          </DialogTitle>
          <DialogDescription>Revise os itens e finalize o pagamento.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {lines.map((l) => {
            const sym = currencies.find((c) => c.id === l.currencyId)?.symbol ?? '';
            return (
              <div
                key={l.itemId}
                className="flex items-center justify-between rounded border border-border bg-card/40 px-2 py-1 text-sm"
              >
                <div className="flex-1">
                  <div className="font-medium text-foreground">{l.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.qty}× {sym}{l.unitPrice}
                  </div>
                </div>
                <div className="font-mono font-bold text-xp">
                  {sym}{l.unitPrice * l.qty}
                </div>
              </div>
            );
          })}
        </div>

        {/* Totais */}
        <div className="rounded border border-primary/30 bg-primary/5 p-2 space-y-1">
          {Object.entries(totals).map(([cid, total]) => {
            const cur = currencies.find((c) => c.id === cid);
            return (
              <div key={cid} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total {cur?.name ?? cid}</span>
                <span className="flex items-center gap-1 font-mono font-bold text-xp">
                  <Coins className="h-3 w-3" /> {cur?.symbol}{total}
                </span>
              </div>
            );
          })}
        </div>

        {/* Ficha + carteira */}
        {playerChars.length > 1 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Ficha:</span>
            <select
              value={charId}
              onChange={(e) => {
                setCharId(e.target.value);
                pickWalletForChar(e.target.value);
              }}
              className="flex-1 rounded border border-border bg-background px-1 py-1"
            >
              {playerChars.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Carteira:</span>
          <select
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            className="flex-1 rounded border border-border bg-background px-1 py-1"
          >
            {myWallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {currencies.length > 0 &&
                  ` — ${currencies
                    .map((c) => `${c.symbol}${w.balances[c.id] ?? 0}`)
                    .join(' / ')}`}
              </option>
            ))}
          </select>
        </div>

        {(issues.length > 0 || camBlocked) && (
          <div className="rounded border border-hp/40 bg-hp/10 p-2 text-xs text-hp space-y-1">
            <div className="flex items-center gap-1 font-bold">
              <AlertTriangle className="h-3 w-3" /> Não foi possível confirmar:
            </div>
            {camBlocked && (
              <div>• Origem CAM não pode receber benefícios de comida.</div>
            )}
            {issues.map((iss, i) => (
              <div key={i}>• {iss}</div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="mystic" onClick={confirm} disabled={!canConfirm}>
            Confirmar compra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
