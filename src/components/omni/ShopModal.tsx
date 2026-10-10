/**
 * Modal de Comércio: Comprar / Vender, com moeda por item, categorias aceitas
 * e pechincha secreta (o jogador só vê o resultado narrado, nunca a CD).
 */
import { useQuestStore } from '@/stores/useQuestStore';
import { nivelReputacao, repEfetiva } from '@/lib/economia/reputacao';
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Coins, Lock, ShoppingBag, ArrowRight, Handshake } from 'lucide-react';
import { useShopStore } from '@/stores/useShopStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { useLogStore } from '@/stores/useLogStore';
import { canSellItemToShop, calcSellPrice, moedaDoItem } from '@/lib/omni/comercio';
import { toTimelineSeconds } from '@/lib/omni/tempo';
import { diaDoMundo } from '@/lib/economia/quests';
import { bonusPericia } from '@/lib/economia/bonusPericia';
import {
  PECHINCHA_PADRAO, ajusteVigente, cdEfetiva, faixaPechincha, mensagemFaixa, precoAjustado, registrarTentativa, tentativasRestantes,
} from '@/lib/economia/pechincha';
import { rollD20Com } from '@/lib/dice';
import { OmniItemImagem } from '@/components/omni/OmniItemImagem';
import { useToast } from '@/hooks/use-toast';

interface Props { aberto: boolean; onClose: () => void; shopId: string; characterId: string }

export function ShopModal({ aberto, onClose, shopId, characterId }: Props) {
  const { toast } = useToast();
  const shop = useShopStore((s) => s.shops[shopId]);
  const estadoP = useShopStore((s) => s.pechinchas[`${shopId}:${characterId}`]);
  const setPechincha = useShopStore((s) => s.setPechincha);
  const entidades = useOmniEntidadesStore((s) => s.entidades);
  const character = useCharacterStore((s) => s.characters.find((c) => c.id === characterId));
  const invItems = useInventoryStore((s) => s.items);
  const inventory = useMemo(() => useInventoryStore.getState().listByOwner(characterId), [invItems, characterId]);
  const addItem = useInventoryStore((s) => s.add);
  const removeItem = useInventoryStore((s) => s.remove);
  const ensurePersonal = useMoneyStore((s) => s.ensurePersonalWallet);
  const wallets = useMoneyStore((s) => s.wallets);
  const currencies = useMoneyStore((s) => s.currencies);
  const spend = useMoneyStore((s) => s.spend);
  const grant = useMoneyStore((s) => s.masterGrant);
  const chronos = useChronosStore();
  const dia = diaDoMundo(toTimelineSeconds(chronos));
  const faccoes = useQuestStore((s) => s.faccoes);

  const [tab, setTab] = useState<'comprar' | 'vender'>('comprar');
  const [pericia, setPericia] = useState('');
  const [rolando, setRolando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto || !shop) return;
    const txt = [shop.name ?? '', ...(shop.categorias ?? [])].join(' ').toLowerCase();
    if (/comida|padaria|taverna|restaurante|lanch|mercado(?!_negro)/.test(txt)) {
      void import('@/lib/conquistas/motor').then((m) => m.dispararGatilhoConquista('loja_comida', [characterId])).catch(() => {});
    }
  }, [aberto, shop?.id, characterId]);
  const walletId = useMemo(() => (character ? ensurePersonal(character.id, character.name) : null), [character, ensurePersonal]);
  if (!shop || shop.deletedAt || !character || !walletId) return null;

  const cfg = shop.pechincha ?? PECHINCHA_PADRAO;
  const faccao = shop.faccaoId ? faccoes[shop.faccaoId] : undefined;
  const nivelRep = faccao && !faccao.deletedAt ? nivelReputacao(repEfetiva(faccao, character.id)) : null;
  const recusa = nivelRep?.ajustePreco === null;
  const ajuste = ajusteVigente(estadoP, dia) + (nivelRep?.ajustePreco ?? 0);
  const restantes = tentativasRestantes(cfg, estadoP, dia);
  const periciasDisp = cfg.pericias.filter((p) => character.skills.some((s) => s.name === p));
  const wallet = wallets.find((w) => w.id === walletId);
  const moeda = (id: string) => currencies.find((c) => c.id === id) ?? currencies[0];
  const saldo = (id: string) => wallet?.balances[id] ?? 0;
  const lojaMoeda = moeda(shop.currencyId);

  const itensDaLoja = shop.inventory.map((id) => entidades[id]).filter((e): e is NonNullable<typeof e> => Boolean(e));

  const comprar = (entityId: string) => {
    const ent = entidades[entityId];
    if (!ent || recusa) return;
    const cur = moeda(moedaDoItem(ent, shop));
    const price = precoAjustado(ent.comercio?.basePrice ?? 0, ajuste, 'comprar');
    if (saldo(cur.id) < price) { toast({ title: 'Saldo insuficiente', description: `${cur.symbol}${price} necessário.`, variant: 'destructive' }); return; }
    if (price > 0 && !spend(walletId, cur.id, price, `Compra: ${ent.nome}`, character.id)) { toast({ title: 'Falha ao processar', variant: 'destructive' }); return; }
    addItem(character.id, ent, { markBought: true });
    toast({ title: 'Item adquirido', description: `${ent.nome} foi adicionado ao inventário.` });
  };

  const vender = (instanceId: string) => {
    const inst = inventory.find((i) => i.instanceId === instanceId);
    if (!inst || recusa) return;
    const v = canSellItemToShop(inst.entity, shop);
    if (!v.ok) { toast({ title: 'Venda bloqueada', description: v.reason, variant: 'destructive' }); return; }
    const cur = moeda(moedaDoItem(inst.entity, shop));
    const price = precoAjustado(calcSellPrice(inst.entity, shop), ajuste, 'vender');
    grant(walletId, cur.id, price, `Venda: ${inst.entity.nome}`);
    removeItem(instanceId);
    toast({ title: 'Vendido', description: `+${cur.symbol}${price}` });
  };

  const pechinchar = async () => {
    const nome = pericia || periciasDisp[0];
    if (!nome || restantes <= 0 || !cfg.ativa) return;
    setRolando(true);
    try {
      const bonus = bonusPericia(character, nome);
      const natural = await rollD20Com(character.id, bonus, { label: `Pechinchar (${nome}) — ${shop.name}` });
      const total = natural + bonus;
      const f = faixaPechincha(natural, total, cdEfetiva(cfg, estadoP));
      const novo = registrarTentativa(cfg, estadoP, dia, f);
      setPechincha(shop.id, character.id, novo);
      const msg = mensagemFaixa(f, novo.ajuste);
      setResultado(msg);
      useLogStore.getState().addLog('system', `🤝 ${character.name} pechinchou com ${shop.name} (${nome} ${total}): ${msg}`);
    } finally { setRolando(false); }
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            {shop.name}
            <span className="ml-auto flex items-center gap-1 text-sm font-normal text-muted-foreground">
              <Coins className="h-4 w-4 text-primary/80" />{lojaMoeda.symbol}{saldo(lojaMoeda.id)}
            </span>
          </DialogTitle>
          {shop.description && <p className="text-xs text-muted-foreground italic">{shop.description}</p>}
        </DialogHeader>

        {faccao && nivelRep && (
          <div className={`rounded-md border p-2 text-sm ${recusa ? 'border-destructive/60 text-destructive' : 'border-border/60'}`} data-reputacao-loja>
            {faccao.emblema} {faccao.nome}: <b>{nivelRep.nome}</b>
            {recusa ? ' — o mercador se recusa a negociar com você.' : nivelRep.ajustePreco ? ` — preços ${nivelRep.ajustePreco < 0 ? `${-nivelRep.ajustePreco}% menores` : `${nivelRep.ajustePreco}% maiores`} pela sua reputação.` : ''}
          </div>
        )}
        {cfg.ativa && !recusa && (
          <div className="rounded-md border border-border/60 bg-card/50 p-2 flex flex-wrap items-center gap-2 text-sm" data-pechincha>
            <Handshake className="h-4 w-4 text-primary" />
            <b>Pechinchar</b>
            {periciasDisp.length > 1 && (
              <select aria-label="Perícia da pechincha" value={pericia || periciasDisp[0]} onChange={(e) => setPericia(e.target.value)} className="rounded border border-border bg-background px-1 py-0.5 text-xs">
                {periciasDisp.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <Button size="sm" variant="outline" disabled={rolando || restantes <= 0 || !periciasDisp.length} onClick={pechinchar}>
              {periciasDisp.length === 1 ? `Rolar ${periciasDisp[0]}` : 'Rolar'}
            </Button>
            <span className="text-xs text-muted-foreground">
              {!periciasDisp.length ? 'Sua ficha não tem as perícias que este mercador respeita.' : restantes > 0 ? `${restantes} tentativa(s) hoje` : 'Sem tentativas até amanhã (no mundo).'}
            </span>
            {ajuste !== 0 && <span className={`ml-auto text-xs font-semibold ${ajuste < 0 ? 'text-primary' : 'text-destructive'}`}>{ajuste < 0 ? `${-ajuste}% de desconto hoje` : `+${ajuste}% hoje`}</span>}
            {resultado && <p className="w-full text-xs italic text-foreground" role="status">{resultado}</p>}
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="comprar">Comprar ({itensDaLoja.length})</TabsTrigger>
            <TabsTrigger value="vender">Vender ({inventory.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="comprar" className="flex-1 overflow-y-auto space-y-2 pt-3">
            {itensDaLoja.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Esta loja não tem nada à venda.</p>}
            {itensDaLoja.map((e) => {
              const cur = moeda(moedaDoItem(e, shop));
              const base = e.comercio?.basePrice ?? 0;
              const price = precoAjustado(base, ajuste, 'comprar');
              return (
                <div key={e.id} className="flex items-center gap-3 rounded-md border border-border/60 bg-card/60 p-3">
                  <OmniItemImagem entidade={e} tamanho={32} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground truncate">{e.nome}</div>
                    {e.descricao && <p className="text-xs text-muted-foreground line-clamp-1">{e.descricao}</p>}
                  </div>
                  <div className="text-sm text-primary font-mono">
                    {price !== base && <s className="mr-1 text-muted-foreground">{cur.symbol}{base}</s>}{cur.symbol}{price}
                  </div>
                  <Button size="sm" disabled={saldo(cur.id) < price} onClick={() => comprar(e.id)}>
                    <ArrowRight className="h-3.5 w-3.5 mr-1" />Comprar
                  </Button>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="vender" className="flex-1 overflow-y-auto space-y-2 pt-3">
            {inventory.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Seu inventário está vazio.</p>}
            <TooltipProvider delayDuration={150}>
              {inventory.map((inst) => {
                const v = canSellItemToShop(inst.entity, shop);
                const cur = moeda(moedaDoItem(inst.entity, shop));
                const price = precoAjustado(calcSellPrice(inst.entity, shop), ajuste, 'vender');
                const row = (
                  <div className={`flex items-center gap-3 rounded-md border p-3 ${v.ok ? 'border-border/60 bg-card/60' : 'border-border/40 bg-card/30 opacity-50'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground truncate flex items-center gap-2">
                        {!v.ok && <Lock className="h-3.5 w-3.5 text-destructive/70 shrink-0" />}{inst.entity.nome}
                      </div>
                    </div>
                    <div className="text-sm text-primary font-mono">{v.ok ? `+${cur.symbol}${price}` : '—'}</div>
                    <Button size="sm" variant={v.ok ? 'default' : 'ghost'} disabled={!v.ok} onClick={() => vender(inst.instanceId)}>Vender</Button>
                  </div>
                );
                return v.ok ? <div key={inst.instanceId}>{row}</div> : (
                  <Tooltip key={inst.instanceId}>
                    <TooltipTrigger asChild><div>{row}</div></TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">{v.reason}</TooltipContent>
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
