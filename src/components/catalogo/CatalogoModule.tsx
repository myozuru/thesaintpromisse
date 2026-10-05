/**
 * 📚 Catálogo do Mestre.
 *
 * Mostra todos os itens, talentos, feitiços e demais entidades criadas
 * no Construtor No-Code (Omni-Engine) e permite entregá-los a qualquer
 * personagem — sem que fiquem "presos" dentro do construtor.
 */
import { useMemo, useState } from 'react';
import { ModuleHeader } from '@/components/ui/module-header';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Library, Send, Package, Wand2, Sparkles, Boxes } from 'lucide-react';
import { useOmniCatalogStore } from '@/stores/useOmniCatalogStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useSpellLibraryStore } from '@/stores/useSpellLibraryStore';
import { usePassiveLibraryStore } from '@/stores/usePassiveLibraryStore';
import { useToast } from '@/hooks/use-toast';
import type { CategoriaEntidade } from '@/lib/omni/tipos';

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

  const lista = useMemo(() => {
    return listarPorCategoria(filtro).filter((e) =>
      busca ? e.nome.toLowerCase().includes(busca.toLowerCase()) : true,
    );
  }, [listarPorCategoria, filtro, busca]);

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

  if (!isMaster) {
    return (
      <div className="space-y-4">
        <ModuleHeader icon={Library} title="Catálogo" subtitle="Acesso restrito ao Mestre." />
        <div className="rounded-md border border-border/40 bg-card/40 p-6 text-center text-sm text-muted-foreground">
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
    <div className="space-y-4">
      <ModuleHeader
        icon={Library}
        title="Catálogo do Mestre"
        subtitle="Tudo que foi aprovado em Debates ou criado no Omni-Engine, pronto para entregar a qualquer personagem."
      />

      <div className="inline-flex rounded-md border border-border/60 bg-background/60 p-0.5 text-xs">
        {SECOES.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSecao(s.id)}
              className={`px-3 py-1.5 rounded inline-flex items-center gap-1.5 transition-colors ${
                secao === s.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
              <span className={`ml-1 rounded px-1 text-xs ${secao === s.id ? 'bg-primary-foreground/20' : 'bg-secondary/60'}`}>
                {s.count}
              </span>
            </button>
          );
        })}
      </div>

      {secao === 'omni' && (
      <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border/60 bg-background/60 p-0.5 text-xs">
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFiltro(c.id)}
              className={`px-3 py-1 rounded transition-colors ${
                filtro === c.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pelo nome…"
          className="h-8 max-w-xs text-xs"
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {lista.length} {lista.length === 1 ? 'entrada' : 'entradas'}
        </span>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          <Package className="h-6 w-6 mx-auto mb-2 opacity-60" />
          Nenhuma entidade no catálogo. Crie itens, feitiços ou talentos no Omni-Engine para vê-los aqui.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {lista.map((e) => (
            <div
              key={e.id}
              className="rounded-md border border-border/50 bg-card/60 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{e.nome}</div>
                  <div className="text-xs uppercase tracking-wider text-primary/70">
                    {e.categoria}
                  </div>
                </div>
                {e.combatData?.effects?.length ? (
                  <span className="shrink-0 text-xs rounded px-1.5 py-0.5 bg-primary/15 text-primary">
                    {e.combatData.effects.length} ef.
                  </span>
                ) : null}
              </div>
              {e.descricao && (
                <p className="text-xs text-muted-foreground italic line-clamp-3">{e.descricao}</p>
              )}
              {e.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {e.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="text-xs px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                <Send className="h-3.5 w-3.5 text-primary shrink-0" />
                <Select onValueChange={(v) => entregarPara(e.id, v)}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Entregar para Jogador…" />
                  </SelectTrigger>
                  <SelectContent>
                    {characters.length === 0 && (
                      <div className="px-2 py-1 text-xs text-muted-foreground">
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
        />
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
}: {
  icon: any;
  emptyText: string;
  entries: { id: string; name: string; description: string; authorName: string; badge?: string }[];
  characters: { id: string; name: string }[];
  onEntregar: (entryId: string, charId: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        <Icon className="h-6 w-6 mx-auto mb-2 opacity-60" />
        {emptyText}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {entries.map((e) => (
        <div key={e.id} className="rounded-md border border-border/50 bg-card/60 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">{e.name}</div>
              <div className="text-xs uppercase tracking-wider text-primary/70">
                de {e.authorName}
              </div>
            </div>
            {e.badge && (
              <span className="shrink-0 text-xs rounded px-1.5 py-0.5 bg-primary/15 text-primary">
                {e.badge}
              </span>
            )}
          </div>
          {e.description && (
            <p className="text-xs text-muted-foreground italic line-clamp-3">{e.description}</p>
          )}
          <div className="flex items-center gap-2 pt-1 border-t border-border/40">
            <Send className="h-3.5 w-3.5 text-primary shrink-0" />
            <Select onValueChange={(v) => onEntregar(e.id, v)}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Entregar para Jogador…" />
              </SelectTrigger>
              <SelectContent>
                {characters.length === 0 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">
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
  );
}
