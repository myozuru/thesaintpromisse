/**
 * Modal de Comércio: aba Comprar (loja → jogador) e Vender (jogador → loja).
 * Aplica a regra Anti-Revenda + Especialização via canSellItemToShop.
 *
 * Personagens carregam carteira pessoal (useMoneyStore) e itens vivem no
 * useInventoryStore como instâncias com isBought controlado pela loja.
 */
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Coins, Lock, ShoppingBag, ArrowRight } from 'lucide-react';
import { useShopStore, type Shop } from '@/stores/useShopStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { canSellItemToShop, calcSellPrice } from '@/lib/omni/comercio';
import { useToast } from '@/hooks/use-toast';

interface Props {
  aberto: boolean;
  onClose: () => void;
  shopId: string;
  characterId: string;
}

export function ShopModal({ aberto, onClose, shopId, characterId }: Props) {
  const { toast } = useToast();
  const shop = useShopStore((s) => s.shops[shopId]);
  const entidades = useOmniEntidadesStore((s) => s.entidades);
  const character = useCharacterStore((s) =>
    s.characters.find((c) => c.id === characterId),
  );

  const inventory = useInventoryStore((s) => s.listByOwner(characterId));
  const addItem = useInventoryStore((s) => s.add);
  const removeItem = useInventoryStore((s) => s.remove);

  const ensurePersonal = useMoneyStore((s) => s.ensurePersonalWallet);
  const wallets = useMoneyStore((s) => s.wallets);
  const currencies = useMoneyStore((s) => s.currencies);
  const spend = useMoneyStore((s) => s.spend);
  const grant = useMoneyStore((s) => s.masterGrant);

  const [tab, setTab] = useState<'comprar' | 'vender'>('comprar');

  const walletId = useMemo(() => {
    if (!character) return null;
    return ensurePersonal(character.id, character.name);
  }, [character, ensurePersonal]);

  if (!shop || !character || !walletId) return null;

  const wallet = wallets.find((w) => w.id === walletId);
  const currency = currencies.find((c) => c.id === shop.currencyId) ?? currencies[0];
  const balance = wallet?.balances[currency.id] ?? 0;

  const itensDaLoja = shop.inventory
    .map((id) => entidades[id])
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  const comprar = (entityId: string) => {
    const ent = entidades[entityId];
    if (!ent) return;
    const price = ent.comercio?.basePrice ?? 0;
    if (balance < price) {
      toast({ title: 'Saldo insuficiente', description: `${currency.symbol}${price} necessário.`, variant: 'destructive' });
      return;
    }
    if (price > 0) {
      const ok = spend(walletId, currency.id, price, `Compra: ${ent.nome}`, character.id);
      if (!ok) {
        toast({ title: 'Falha ao processar', variant: 'destructive' });
        return;
      }
    }
    addItem(character.id, ent, { markBought: true });
    toast({ title: 'Item adquirido', description: `${ent.nome} foi adicionado ao inventário.` });
  };

  const vender = (instanceId: string) => {
    const inst = inventory.find((i) => i.instanceId === instanceId);
    if (!inst) return;
    const v = canSellItemToShop(inst.entity, shop);
    if (!v.ok) {
      toast({ title: 'Venda bloqueada', description: v.reason, variant: 'destructive' });
      return;
    }
    const price = calcSellPrice(inst.entity, shop);
    grant(walletId, currency.id, price, `Venda: ${inst.entity.nome}`);
    removeItem(instanceId);
    toast({ title: 'Vendido', description: `+${currency.symbol}${price}` });
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            {shop.name}
            <span className="ml-auto flex items-center gap-1 text-sm font-normal text-muted-foreground">
              <Coins className="h-4 w-4 text-primary/80" />
              {currency.symbol}{balance}
            </span>
          </DialogTitle>
          {shop.description && (
            <p className="text-xs text-muted-foreground italic">{shop.description}</p>
          )}
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="comprar">Comprar ({itensDaLoja.length})</TabsTrigger>
            <TabsTrigger value="vender">Vender ({inventory.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="comprar" className="flex-1 overflow-y-auto space-y-2 pt-3">
            {itensDaLoja.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Esta loja não tem nada à venda.
              </p>
            )}
            {itensDaLoja.map((e) => {
              const price = e.comercio?.basePrice ?? 0;
              const podePagar = balance >= price;
              return (
                <div key={e.id} className="flex items-center gap-3 rounded-md border border-border/60 bg-card/60 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground truncate">{e.nome}</div>
                    {e.descricao && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{e.descricao}</p>
                    )}
                  </div>
                  <div className="text-sm text-primary font-mono">
                    {currency.symbol}{price}
                  </div>
                  <Button size="sm" disabled={!podePagar} onClick={() => comprar(e.id)}>
                    <ArrowRight className="h-3.5 w-3.5 mr-1" />
                    Comprar
                  </Button>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="vender" className="flex-1 overflow-y-auto space-y-2 pt-3">
            {inventory.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Seu inventário está vazio.
              </p>
            )}
            <TooltipProvider delayDuration={150}>
              {inventory.map((inst) => {
                const v = canSellItemToShop(inst.entity, shop);
                const price = calcSellPrice(inst.entity, shop);
                const row = (
                  <div
                    className={`flex items-center gap-3 rounded-md border p-3 transition-opacity ${
                      v.ok ? 'border-border/60 bg-card/60' : 'border-border/40 bg-card/30 opacity-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground truncate flex items-center gap-2">
                        {!v.ok && <Lock className="h-3.5 w-3.5 text-destructive/70 shrink-0" />}
                        {inst.entity.nome}
                      </div>
                      {inst.entity.descricao && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{inst.entity.descricao}</p>
                      )}
                    </div>
                    <div className="text-sm text-primary font-mono">
                      {v.ok ? `+${currency.symbol}${price}` : '—'}
                    </div>
                    <Button size="sm" variant={v.ok ? 'default' : 'ghost'} disabled={!v.ok} onClick={() => vender(inst.instanceId)}>
                      Vender
                    </Button>
                  </div>
                );
                return v.ok ? (
                  <div key={inst.instanceId}>{row}</div>
                ) : (
                  <Tooltip key={inst.instanceId}>
                    <TooltipTrigger asChild>
                      <div>{row}</div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      {v.reason}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
