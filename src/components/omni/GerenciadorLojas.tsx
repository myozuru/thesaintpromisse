/**
 * Gerenciador de Lojas (Mestre): cria/edita lojas, define acceptedTags
 * e seleciona itens do inventário Omni para vender.
 */
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Pencil, Store } from 'lucide-react';
import { useShopStore } from '@/stores/useShopStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';

interface Props {
  aberto: boolean;
  onClose: () => void;
}

export function GerenciadorLojas({ aberto, onClose }: Props) {
  const shopsMap = useShopStore((s) => s.shops);
  const shops = useMemo(() => Object.values(shopsMap), [shopsMap]);
  const criar = useShopStore((s) => s.criar);
  const atualizar = useShopStore((s) => s.atualizar);
  const remover = useShopStore((s) => s.remover);
  const toggleInv = useShopStore((s) => s.toggleInventory);
  const entidades = useOmniEntidadesStore((s) => s.entidades);
  const itens = useMemo(
    () => Object.values(entidades).filter((e) => e.categoria === 'item' || e.categoria === 'arma'),
    [entidades],
  );

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const editando = shops.find((s) => s.id === editandoId);

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Mercados & Lojas
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-3 overflow-hidden">
          {/* Lista */}
          <div className="w-64 border-r border-border/60 pr-3 overflow-y-auto space-y-2">
            <Button size="sm" className="w-full" onClick={() => {
              const s = criar('Nova Loja');
              setEditandoId(s.id);
            }}>
              <Plus className="h-4 w-4 mr-1" /> Nova Loja
            </Button>
            {shops.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhuma loja criada.
              </p>
            )}
            {shops.map((s) => (
              <div
                key={s.id}
                className={`rounded-md border p-2 cursor-pointer transition-colors ${
                  editandoId === s.id ? 'border-primary bg-primary/10' : 'border-border/60 hover:border-primary/50'
                }`}
                onClick={() => setEditandoId(s.id)}
              >
                <div className="font-semibold text-sm truncate">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  {s.inventory.length} item(s) • {s.acceptedTags.length} tag(s)
                </div>
              </div>
            ))}
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {!editando && (
              <p className="text-sm text-muted-foreground text-center py-12">
                Selecione ou crie uma loja para editar.
              </p>
            )}
            {editando && (
              <>
                <div className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-primary" />
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Editando</span>
                  <Button size="sm" variant="ghost" className="ml-auto text-destructive/70" onClick={() => {
                    remover(editando.id);
                    setEditandoId(null);
                  }}>
                    <Trash2 className="h-4 w-4 mr-1" /> Excluir
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome</Label>
                    <Input
                      value={editando.name}
                      onChange={(e) => atualizar(editando.id, { name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Multiplicador de compra (0–1)</Label>
                    <Input
                      type="number"
                      step={0.05}
                      min={0}
                      max={1}
                      value={editando.buyMultiplier}
                      onChange={(e) => atualizar(editando.id, {
                        buyMultiplier: Math.min(1, Math.max(0, Number(e.target.value) || 0)),
                      })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    rows={2}
                    value={editando.description}
                    onChange={(e) => atualizar(editando.id, { description: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Tags aceitas (separadas por vírgula)</Label>
                  <Input
                    placeholder="amaldicoado, reliquia, ilegal"
                    value={editando.acceptedTags.join(', ')}
                    onChange={(e) => atualizar(editando.id, {
                      acceptedTags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                    })}
                  />
                  <div className="flex flex-wrap gap-1 mt-2">
                    {editando.acceptedTags.map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Inventário (itens à venda)</Label>
                  <div className="rounded-md border border-border/60 bg-card/40 p-2 max-h-64 overflow-y-auto space-y-1">
                    {itens.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Crie itens no Omni-Engine para popular esta loja.
                      </p>
                    )}
                    {itens.map((it) => {
                      const sel = editando.inventory.includes(it.id);
                      const price = it.comercio?.basePrice ?? 0;
                      return (
                        <label
                          key={it.id}
                          className={`flex items-center gap-2 rounded p-1.5 cursor-pointer text-sm ${
                            sel ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/30'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => toggleInv(editando.id, it.id)}
                          />
                          <span className="flex-1 truncate">{it.nome}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            ¥{price}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
