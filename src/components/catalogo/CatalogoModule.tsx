/**
 * 📚 Catálogo do Mestre.
 *
 * Mostra todos os itens, talentos, feitiços e demais entidades criadas
 * no Construtor No-Code (Omni-Engine) e permite entregá-los a qualquer
 * personagem — sem que fiquem "presos" dentro do construtor.
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import { ModuleHeader } from '@/components/ui/module-header';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Library, Send, Package, Wand2, Sparkles, Boxes, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useOmniCatalogStore } from '@/stores/useOmniCatalogStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useSpellLibraryStore } from '@/stores/useSpellLibraryStore';
import { usePassiveLibraryStore } from '@/stores/usePassiveLibraryStore';
import { useToast } from '@/hooks/use-toast';
import type { CategoriaEntidade } from '@/lib/omni/tipos';
import { cn } from '@/lib/utils';

const CATEGORIAS: { id: CategoriaEntidade | 'todos'; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'item', label: 'Itens' },
  { id: 'arma', label: 'Armas' },
  { id: 'feitico', label: 'Feitiços' },
  { id: 'talento', label: 'Talentos' },
  { id: 'aura', label: 'Auras' },
  { id: 'passiva', label: 'Passivas' },
  { id: 'condicao', label: 'Condições' },
  { id: 'voto', label: 'Votos' },
];

type SecaoCatalogo = 'omni' | 'feiticos' | 'passivas';

export function CatalogoModule() {
  const role = useRoleStore((s) => s.role);
  const isMaster = role === 'MASTER';
  const listarPorCategoria = useOmniCatalogStore((s) => s.listarPorCategoria);
  const entregar = useOmniCatalogStore((s) => s.entregarParaJogador);
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);
  const addSpellToChar = useCharacterStore((s) => s.addSpell);
  const addPassiveToChar = useCharacterStore((s) => s.addPassive);
  const spellEntriesMap = useSpellLibraryStore((s) => s.entries);
  const passiveEntriesMap = usePassiveLibraryStore((s) => s.entries);
  const spellEntries = useMemo(() => Object.values(spellEntriesMap), [spellEntriesMap]);
  const passiveEntries = useMemo(() => Object.values(passiveEntriesMap), [passiveEntriesMap]);
  const { toast } = useToast();

  const [filtro, setFiltro] = useState<CategoriaEntidade | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [secao, setSecao] = useState<SecaoCatalogo>('omni');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchTargetId, setBatchTargetId] = useState<string>('');
  const buscaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (batchTargetId && !characters.some((character) => character.id === batchTargetId)) {
      setBatchTargetId('');
    }
  }, [batchTargetId, characters]);

  const lista = useMemo(() => {
    return listarPorCategoria(filtro).filter((e) =>
      busca ? e.nome.toLowerCase().includes(busca.toLowerCase()) : true,
    );
  }, [listarPorCategoria, filtro, busca]);

  // Clear selection when section changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [secao]);

  const activeSelectionIds = useMemo(() => {
    if (secao === 'feiticos') return spellEntries.map((entry) => entry.id);
    if (secao === 'passivas') return passiveEntries.map((entry) => entry.id);
    return lista.map((entry) => entry.id);
  }, [secao, lista, spellEntries, passiveEntries]);

  // Clear selection when the active section's filters or entries change.
  useEffect(() => {
    const currentIds = new Set(activeSelectionIds);
    setSelectedIds(prev => {
      const intersection = new Set([...prev].filter(id => currentIds.has(id)));
      if (intersection.size !== prev.size) return intersection;
      return prev;
    });
  }, [activeSelectionIds]);

  const selectedActiveCount = activeSelectionIds.reduce(
    (count, id) => count + Number(selectedIds.has(id)),
    0,
  );
  const isAllSelected = activeSelectionIds.length > 0 && selectedActiveCount === activeSelectionIds.length;
  const isIndeterminate = selectedActiveCount > 0 && selectedActiveCount < activeSelectionIds.length;

  const handleSelectAll = (ids: string[]) => {
    setSelectedIds((previous) => {
      const allSelected = ids.length > 0 && ids.every((id) => previous.has(id));
      const next = new Set(previous);
      ids.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const entregarPara = (entidadeId: string, charId: string) => {
    if (!charId) return;
    const inst = entregar(entidadeId, charId);
    const char = characters.find((c) => c.id === charId);
    const ent = lista.find((e) => e.id === entidadeId);
    if (inst && ent) {
      addLog('system', `🎁 Mestre entregou "${ent.nome}" para ${char?.name ?? 'jogador'}.`);
      toast({ title: 'Item entregue', description: `${ent.nome} → ${char?.name ?? 'Jogador'}` });
    }
  };

  const entregarFeitico = (entryId: string, charId: string) => {
    if (!charId) return;
    const entry = spellEntries.find((e) => e.id === entryId);
    const char = characters.find((c) => c.id === charId);
    if (!entry || !char) return;
    // Cria uma cópia com novo id para que cada ficha tenha sua própria instância.
    const novoId = `spell-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    addSpellToChar(char.id, { ...entry.spell, id: novoId });
    addLog('system', `📖 Mestre entregou o feitiço "${entry.spell.name}" para ${char.name}.`);
    toast({ title: 'Feitiço entregue', description: `${entry.spell.name} → ${char.name}` });
  };

  const entregarPassiva = (entryId: string, charId: string) => {
    if (!charId) return;
    const entry = passiveEntries.find((e) => e.id === entryId);
    const char = characters.find((c) => c.id === charId);
    if (!entry || !char) return;
    const novoId = `passive-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    addPassiveToChar(char.id, { ...entry.passive, id: novoId });
    addLog('system', `🌟 Mestre entregou a passiva "${entry.passive.name}" para ${char.name}.`);
    toast({ title: 'Passiva entregue', description: `${entry.passive.name} → ${char.name}` });
  };

  const entregarLoteOmni = async (ids: string[], charId: string) => {
    if (!charId || ids.length === 0) return;
    const char = characters.find((c) => c.id === charId);
    if (!char) return;
    let count = 0;
    for (const id of ids) {
      const inst = entregar(id, charId);
      const ent = lista.find((e) => e.id === id);
      if (inst && ent) {
        count++;
        addLog('system', `🎁 Mestre entregou "${ent.nome}" para ${char?.name ?? 'jogador'}.`);
      }
    }
    if (count > 0) {
      toast({ title: 'Lote entregue', description: `${count} item(ns) → ${char?.name ?? 'Jogador'}` });
    }
    clearSelection();
  };

  const entregarLoteFeiticos = async (ids: string[], charId: string) => {
    if (!charId || ids.length === 0) return;
    const char = characters.find((c) => c.id === charId);
    if (!char) return;
    let count = 0;
    for (const id of ids) {
      const entry = spellEntries.find((e) => e.id === id);
      if (!entry) continue;
      const novoId = `spell-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      addSpellToChar(char.id, { ...entry.spell, id: novoId });
      count++;
      addLog('system', `📖 Mestre entregou o feitiço "${entry.spell.name}" para ${char.name}.`);
    }
    if (count > 0) {
      toast({ title: 'Feitiços entregues', description: `${count} feitiço(s) → ${char.name}` });
    }
    clearSelection();
  };

  const entregarLotePassivas = async (ids: string[], charId: string) => {
    if (!charId || ids.length === 0) return;
    const char = characters.find((c) => c.id === charId);
    if (!char) return;
    let count = 0;
    for (const id of ids) {
      const entry = passiveEntries.find((e) => e.id === id);
      if (!entry) continue;
      const novoId = `passive-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      addPassiveToChar(char.id, { ...entry.passive, id: novoId });
      count++;
      addLog('system', `🌟 Mestre entregou a passiva "${entry.passive.name}" para ${char.name}.`);
    }
    if (count > 0) {
      toast({ title: 'Passivas entregues', description: `${count} passiva(s) → ${char.name}` });
    }
    clearSelection();
  };

  if (!isMaster) {
    return (
      <div className="space-y-5">
        <ModuleHeader icon={Library} title="Catálogo" subtitle="Acesso restrito ao Mestre." />
        <div className="rounded-xl border border-border/60 bg-card/45 p-8 text-center text-base text-muted-foreground card-enigmatic">
          Apenas o Mestre pode acessar o catálogo global.
        </div>
      </div>
    );
  }

  const SECOES: { id: SecaoCatalogo; label: string; icon: any; count: number }[] = [
    { id: 'omni', label: 'Itens & Entidades Omni', icon: Boxes, count: lista.length },
    { id: 'feiticos', label: 'Feitiços', icon: Wand2, count: spellEntries.length },
    { id: 'passivas', label: 'Passivas', icon: Sparkles, count: passiveEntries.length },
  ];

  return (
    <div className={cn("space-y-5", selectedIds.size > 0 && "pb-64 md:pb-48")}>
      <ModuleHeader
        icon={Library}
        title="Catálogo do Mestre"
        subtitle="Tudo que foi aprovado em Debates ou criado no Omni-Engine, pronto para entregar a qualquer personagem."
      />

      <div className="space-y-2" role="group" aria-label="Seção do catálogo">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Seção do catálogo</p>
        <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-border/70 bg-background/35 p-1.5">
          {SECOES.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={secao === s.id}
                onClick={() => setSecao(s.id)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                  secao === s.id
                    ? 'bg-primary/15 text-primary shadow-[inset_0_-2px_0_hsl(var(--primary)),0_8px_22px_-18px_hsl(var(--primary)/0.9)]'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {s.label}
                <span className={`ml-1 rounded-full px-2 py-0.5 font-mono text-sm ${secao === s.id ? 'bg-primary/20 text-primary' : 'bg-secondary/70 text-muted-foreground'}`}>
                  {s.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {secao === 'omni' && (
      <>
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/35 p-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 space-y-2" role="group" aria-label="Filtrar por categoria">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Filtrar por categoria</p>
          <div className="flex max-w-full flex-wrap items-center gap-1.5">
            {CATEGORIAS.map((c) => {
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={filtro === c.id}
                  onClick={() => setFiltro(c.id)}
                  className={`min-h-10 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                    filtro === c.id
                      ? 'border-primary/40 bg-primary/15 text-primary'
                      : 'border-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex w-full items-center gap-3 xl:max-w-md">
          <div className="relative min-w-0 flex-1">
            <Input
              ref={buscaInputRef}
              aria-label="Buscar no catálogo"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar pelo nome…"
              className="h-11 w-full pr-14 text-base"
            />
            {busca && (
              <button
                type="button"
                aria-label="Limpar busca"
                title="Limpar busca"
                onClick={() => { setBusca(''); buscaInputRef.current?.focus(); }}
                className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <span className="shrink-0 rounded-full border border-border/70 bg-background/50 px-3 py-1.5 font-mono text-sm text-muted-foreground">
            {lista.length} {lista.length === 1 ? 'entrada' : 'entradas'}
          </span>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-card/30 p-10 text-center text-base text-muted-foreground card-enigmatic">
          <Package className="mx-auto mb-3 h-7 w-7 text-primary/70" />
          <p style={{fontSize: '16px', lineHeight: 1.55}}>Nenhuma entidade no catálogo. Crie itens, feitiços ou talentos no Omni-Engine para vê-los aqui.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {lista.map((e) => (
              <div
                key={e.id}
                className={cn(
                  "group flex min-h-[230px] min-w-0 flex-col gap-3 rounded-xl border border-border/70 bg-card/50 p-4",
                  "transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-mystic",
                  selectedIds.has(e.id) && "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <Checkbox
                      checked={selectedIds.has(e.id)}
                      onCheckedChange={() => handleSelectOne(e.id)}
                      aria-label={`Selecionar ${e.nome}`}
                      className="mt-0.5 shrink-0 text-primary focus-visible:ring-primary"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-foreground" style={{fontSize: '16px'}}>{e.nome}</div>
                      <div className="mt-1 text-sm font-mono uppercase tracking-wider text-primary/80">
                        {e.categoria}
                      </div>
                    </div>
                  </div>
                  {e.combatData?.effects?.length ? (
                    <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-sm text-primary">
                      {e.combatData.effects.length} ef.
                    </span>
                  ) : null}
                </div>
                {e.descricao && (
                  <p className="min-h-[4.5rem] text-base leading-relaxed text-muted-foreground line-clamp-3" style={{fontSize: '16px', lineHeight: 1.55}}>{e.descricao}</p>
                )}
                {e.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {e.tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1 text-sm text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex items-center gap-2 border-t border-border/50 pt-3">
                  <Send className="h-4 w-4 shrink-0 text-primary" />
                  <Select onValueChange={(v) => entregarPara(e.id, v)}>
                    <SelectTrigger className="h-10 min-w-0 flex-1 text-base">
                      <SelectValue placeholder="Entregar para Jogador…" />
                    </SelectTrigger>
                    <SelectContent>
                      {characters.length === 0 && (
                        <div className="px-2 py-1 text-sm text-muted-foreground">
                          Nenhum personagem cadastrado
                        </div>
                      )}
                      {characters.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>

          {/* Select all checkbox in header */}
          <div className="flex items-center gap-3 px-2 py-2 text-base text-muted-foreground">
            <Checkbox
              checked={isAllSelected ? true : isIndeterminate ? "indeterminate" : false}
              onCheckedChange={() => handleSelectAll(activeSelectionIds)}
              aria-label={isAllSelected ? 'Desselecionar todos' : 'Selecionar todos'}
              className="text-primary focus-visible:ring-primary"
            />
            <span>Selecionar todos ({selectedActiveCount}/{lista.length})</span>
          </div>
        </>
      )}
      </>
      )}

      {secao === 'feiticos' && (
        <SimpleLibraryGrid
          icon={Wand2}
          emptyText="Nenhum feitiço aprovado ainda. Aprove propostas em Debates para vê-las aqui."
          entries={spellEntries.map((e) => ({
            id: e.id,
            name: e.spell.name,
            description: e.spell.description,
            authorName: e.authorName,
            badge: `Nv ${e.spell.spellLevel ?? '?'}`,
          }))}
          characters={characters}
          onEntregar={entregarFeitico}
          selectedIds={selectedIds}
          onSelectChange={handleSelectOne}
          onSelectAll={handleSelectAll}
          isAllSelected={isAllSelected}
          isIndeterminate={isIndeterminate}
        />
      )}

      {secao === 'passivas' && (
        <SimpleLibraryGrid
          icon={Sparkles}
          emptyText="Nenhuma passiva aprovada ainda. Aprove propostas em Debates para vê-las aqui."
          entries={passiveEntries.map((e) => ({
            id: e.id,
            name: e.passive.name,
            description: e.passive.description,
            authorName: e.authorName,
            badge: `Nv ${e.passive.spellLevel ?? e.passive.level ?? '?'}`,
          }))}
          characters={characters}
          onEntregar={entregarPassiva}
          selectedIds={selectedIds}
          onSelectChange={handleSelectOne}
          onSelectAll={handleSelectAll}
          isAllSelected={isAllSelected}
          isIndeterminate={isIndeterminate}
        />
      )}

      {/* Floating batch delivery bar */}
      {selectedIds.size > 0 && (
          <div className="fixed z-30 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-4 shadow-xl animate-slide-up"
             role="region"
             aria-label="Entrega em lote"
             style={{
               left: 'calc(var(--workspace-left-inset, 16rem) + 1rem)',
               right: '1rem',
               bottom: '6rem',
             }}>
          <div className="max-w-4xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold text-foreground" style={{fontSize: '16px'}}>{selectedIds.size} item(ns) selecionado(s)</p>
              <p className="text-sm text-muted-foreground" style={{fontSize: '16px'}}>Entregar para um personagem</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full md:w-auto md:flex-row md:items-center">
              <Select
                value={batchTargetId}
                onValueChange={(v: string) => setBatchTargetId(v)}
              >
                <SelectTrigger className="h-10 text-base w-full md:w-64" style={{fontSize: '16px'}}>
                  <SelectValue placeholder="Escolher personagem…" />
                </SelectTrigger>
                <SelectContent>
                  {characters.length === 0 && (
                    <div className="px-2 py-1 text-base text-muted-foreground">
                      Nenhum personagem cadastrado
                    </div>
                  )}
                  {characters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={clearSelection}
                  className="min-h-10 px-4 text-base rounded-lg border border-border/60 bg-transparent text-foreground hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 transition-colors"
                  style={{fontSize: '16px'}}
                  disabled={selectedIds.size === 0}
                >
                  <X className="h-4 w-4" /> Limpar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (secao === 'omni') entregarLoteOmni(Array.from(selectedIds), batchTargetId);
                    else if (secao === 'feiticos') entregarLoteFeiticos(Array.from(selectedIds), batchTargetId);
                    else if (secao === 'passivas') entregarLotePassivas(Array.from(selectedIds), batchTargetId);
                  }}
                  disabled={!characters.some((character) => character.id === batchTargetId) || selectedIds.size === 0}
                  className="min-h-10 px-4 text-base rounded-lg border border-primary bg-primary text-primary-foreground hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 transition-colors"
                  style={{fontSize: '16px'}}
                >
                  <Send className="h-4 w-4" /> Entregar {selectedIds.size} para {characters.find(c => c.id === batchTargetId)?.name ?? 'personagem'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SimpleLibraryGrid({
  icon: Icon,
  emptyText,
  entries,
  characters,
  onEntregar,
  selectedIds,
  onSelectChange,
  onSelectAll,
  isAllSelected,
  isIndeterminate,
}: {
  icon: any;
  emptyText: string;
  entries: { id: string; name: string; description: string; authorName: string; badge?: string }[];
  characters: { id: string; name: string }[];
  onEntregar: (entryId: string, charId: string) => void;
  selectedIds: Set<string>;
  onSelectChange: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  isAllSelected: boolean;
  isIndeterminate: boolean;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-base text-muted-foreground" style={{fontSize: '16px', lineHeight: 1.55}}>
        <Icon className="h-6 w-6 mx-auto mb-2 opacity-60" />
        {emptyText}
      </div>
    );
  }
  return (
    <>
      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {entries.map((e) => (
          <div
            key={e.id}
            className={cn(
              "group flex min-h-[230px] min-w-0 flex-col gap-3 rounded-xl border border-border/70 bg-card/50 p-4",
              "transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-mystic",
              selectedIds.has(e.id) && "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3 min-w-0">
                <Checkbox
                  checked={selectedIds.has(e.id)}
                  onCheckedChange={() => onSelectChange(e.id)}
                  aria-label={`Selecionar ${e.name}`}
                  className="mt-0.5 shrink-0 text-primary focus-visible:ring-primary"
                />
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-foreground" style={{fontSize: '16px'}}>{e.name}</div>
                  <div className="mt-1 text-sm font-mono uppercase tracking-wider text-primary/80">
                    de {e.authorName}
                  </div>
                </div>
              </div>
              {e.badge && (
                <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-sm text-primary">
                  {e.badge}
                </span>
              )}
            </div>
            {e.description && (
              <p className="min-h-[4.5rem] text-base leading-relaxed text-muted-foreground line-clamp-3" style={{fontSize: '16px', lineHeight: 1.55}}>{e.description}</p>
            )}
            <div className="mt-auto flex items-center gap-2 border-t border-border/50 pt-3">
              <Send className="h-4 w-4 shrink-0 text-primary" />
              <Select onValueChange={(v) => onEntregar(e.id, v)}>
                <SelectTrigger className="h-10 min-w-0 flex-1 text-base" style={{fontSize: '16px'}}>
                  <SelectValue placeholder="Entregar para Jogador…" />
                </SelectTrigger>
                <SelectContent>
                  {characters.length === 0 && (
                    <div className="px-2 py-1 text-base text-muted-foreground">
                      Nenhum personagem cadastrado
                    </div>
                  )}
                  {characters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 px-2 py-2 text-base text-muted-foreground">
        <Checkbox
          checked={isAllSelected ? true : isIndeterminate ? "indeterminate" : false}
          onCheckedChange={() => onSelectAll(entries.map((entry) => entry.id))}
          aria-label={isAllSelected ? 'Desselecionar todos' : 'Selecionar todos'}
          className="text-primary focus-visible:ring-primary"
        />
        <span>{/* Selected count is scoped to this library, not the other catalog sections. */}
          Selecionar todos ({entries.filter((entry) => selectedIds.has(entry.id)).length}/{entries.length})
        </span>
      </div>
    </>
  );
}
