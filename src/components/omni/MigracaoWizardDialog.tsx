/**
 * Wizard de migração legado → Omni-Engine.
 *
 * Lista todos os Itens (useItemStore) e Feitiços (Character.spells de todos
 * os personagens), com checkboxes. O Mestre marca o que importar e o
 * conteúdo é convertido via `migracao.ts` e adicionado ao
 * `useOmniEntidadesStore`. O conteúdo legado NÃO é apagado.
 */
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wand2, Package } from 'lucide-react';
import { useItemStore } from '@/stores/useItemStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { feiticoParaEntidade, itemParaEntidade } from '@/lib/omni/migracao';
import { useToast } from '@/hooks/use-toast';
import type { Spell } from '@/types';

interface Props {
  aberto: boolean;
  onClose: () => void;
}

interface SpellRow {
  key: string; // charId+spellId
  charName: string;
  spell: Spell;
}

export function MigracaoWizardDialog({ aberto, onClose }: Props) {
  const { toast } = useToast();
  const items = useItemStore((s) => s.items);
  const characters = useCharacterStore((s) => s.characters);
  const importar = useOmniEntidadesStore((s) => s.importarPacote);

  const [itensSelecionados, setItensSelecionados] = useState<Set<string>>(new Set());
  const [feiticosSelecionados, setFeiticosSelecionados] = useState<Set<string>>(new Set());

  const feiticoRows: SpellRow[] = useMemo(() => {
    const rows: SpellRow[] = [];
    for (const c of characters) {
      for (const s of c.spells ?? []) {
        rows.push({ key: `${c.id}::${s.id}`, charName: c.name, spell: s });
      }
    }
    return rows;
  }, [characters]);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const selecionarTodosItens = () =>
    setItensSelecionados(new Set(items.map((i) => i.id)));
  const limparItens = () => setItensSelecionados(new Set());
  const selecionarTodosFeiticos = () =>
    setFeiticosSelecionados(new Set(feiticoRows.map((r) => r.key)));
  const limparFeiticos = () => setFeiticosSelecionados(new Set());

  const importarSelecao = () => {
    const entidades = [
      ...items
        .filter((i) => itensSelecionados.has(i.id))
        .map(itemParaEntidade),
      ...feiticoRows
        .filter((r) => feiticosSelecionados.has(r.key))
        .map((r) => feiticoParaEntidade(r.spell)),
    ];
    if (entidades.length === 0) {
      toast({ title: 'Nada selecionado', description: 'Marque ao menos um item ou feitiço.', variant: 'destructive' });
      return;
    }
    importar(
      {
        formato: 'omni-engine.v1',
        nome: 'Migração legado',
        autor: 'Wizard',
        geradoEm: Date.now(),
        entidades,
      },
      'mesclar',
    );
    toast({ title: 'Migração concluída', description: `${entidades.length} entidade(s) adicionadas ao Omni-Engine.` });
    setItensSelecionados(new Set());
    setFeiticosSelecionados(new Set());
    onClose();
  };

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Migração — Itens & Feitiços legados → Omni
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Marque o conteúdo que deseja recriar como <b>EntidadeOmni</b>. O conteúdo original <b>não é alterado</b> —
          a migração só <b>adiciona</b> cópias editáveis no construtor visual.
        </p>

        <Tabs defaultValue="itens">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="itens">
              Itens ({items.length}) {itensSelecionados.size > 0 && `· ${itensSelecionados.size} marcados`}
            </TabsTrigger>
            <TabsTrigger value="feiticos">
              Feitiços ({feiticoRows.length}) {feiticosSelecionados.size > 0 && `· ${feiticosSelecionados.size} marcados`}
            </TabsTrigger>
          </TabsList>

          {/* ITENS */}
          <TabsContent value="itens" className="space-y-2">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={selecionarTodosItens} disabled={items.length === 0}>
                Selecionar todos
              </Button>
              <Button size="sm" variant="ghost" onClick={limparItens} disabled={itensSelecionados.size === 0}>
                Limpar
              </Button>
            </div>
            <ScrollArea className="h-72 rounded-md border border-border/60 bg-background/40">
              {items.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Nenhum item legado cadastrado.</div>
              ) : (
                <div className="divide-y divide-border/40">
                  {items.map((i) => (
                    <label
                      key={i.id}
                      className="flex items-center gap-3 p-2.5 hover:bg-primary/5 cursor-pointer"
                    >
                      <Checkbox
                        checked={itensSelecionados.has(i.id)}
                        onCheckedChange={() => toggle(itensSelecionados, setItensSelecionados, i.id)}
                      />
                      <Package className="h-4 w-4 text-primary/60 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{i.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {i.category} · {i.slotType}
                          {i.bonusHP ? ` · +${i.bonusHP} HP` : ''}
                          {i.bonusPE ? ` · +${i.bonusPE} PE` : ''}
                          {i.bonusCA ? ` · +${i.bonusCA} CA` : ''}
                          {i.isFood ? ' · consumível' : ''}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* FEITIÇOS */}
          <TabsContent value="feiticos" className="space-y-2">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={selecionarTodosFeiticos} disabled={feiticoRows.length === 0}>
                Selecionar todos
              </Button>
              <Button size="sm" variant="ghost" onClick={limparFeiticos} disabled={feiticosSelecionados.size === 0}>
                Limpar
              </Button>
            </div>
            <ScrollArea className="h-72 rounded-md border border-border/60 bg-background/40">
              {feiticoRows.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum personagem possui feitiços cadastrados.
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {feiticoRows.map((r) => (
                    <label
                      key={r.key}
                      className="flex items-center gap-3 p-2.5 hover:bg-primary/5 cursor-pointer"
                    >
                      <Checkbox
                        checked={feiticosSelecionados.has(r.key)}
                        onCheckedChange={() => toggle(feiticosSelecionados, setFeiticosSelecionados, r.key)}
                      />
                      <Wand2 className="h-4 w-4 text-primary/60 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{r.spell.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {r.charName} · {r.spell.spellType} · custo {r.spell.costPE} PE
                          {r.spell.damageDice ? ` · ${r.spell.damageDice}` : ''}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={importarSelecao}
            disabled={itensSelecionados.size + feiticosSelecionados.size === 0}
            className="bg-primary hover:bg-primary/90"
          >
            Importar {itensSelecionados.size + feiticosSelecionados.size} item(ns)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
