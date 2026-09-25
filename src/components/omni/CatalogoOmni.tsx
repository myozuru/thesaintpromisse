/**
 * 📚 Aba "Catálogo" do Omni-Engine (visão do Mestre).
 *
 * Lista TODAS as entidades salvas em `useOmniEntidadesStore` (via
 * `useOmniCatalogStore`) com filtro por categoria e busca, permitindo
 * ao Mestre selecionar qualquer item e clicar em **Entregar para Jogador**
 * para criar uma instância no inventário do personagem alvo.
 *
 * Mantém a UX do construtor intacta — o catálogo é apenas leitura/distribuição.
 */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Send, Package, Search, AlertTriangle, Wand2 } from 'lucide-react';
import { useOmniCatalogStore } from '@/stores/useOmniCatalogStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { useToast } from '@/hooks/use-toast';
import type { CategoriaEntidade, EntidadeOmni } from '@/lib/omni/tipos';
import { ConstrutorEntidade } from './ConstrutorEntidade';

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

export function CatalogoOmni() {
  const { toast } = useToast();
  const isMaster = useRoleStore((s) => s.role) === 'MASTER';
  const characters = useCharacterStore((s) => s.characters);
  const addLog = useLogStore((s) => s.addLog);
  const entregar = useOmniCatalogStore((s) => s.entregarParaJogador);
  const substituirEntidade = useOmniEntidadesStore((s) => s.substituir);

  const [filtro, setFiltro] = useState<CategoriaEntidade | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState<string>('todos');
  const [filtroComplex, setFiltroComplex] = useState<string>('todos');
  const [filtroAlcance, setFiltroAlcance] = useState<string>('todos');
  const [destinoPorEnt, setDestinoPorEnt] = useState<Record<string, string>>({});
  const [editandoConceito, setEditandoConceito] = useState<EntidadeOmni | null>(null);

  // Sempre derivado do store de entidades — fica sincronizado automaticamente.
  const todas = useOmniCatalogStore((s) => s.listar)();

  const filtradas = useMemo(() => {
    return todas
      .filter((e) => (filtro === 'todos' ? true : e.categoria === filtro))
      .filter((e) =>
        busca ? e.nome.toLowerCase().includes(busca.toLowerCase()) : true,
      )
      .filter((e) => {
        if (filtro !== 'arma') return true;
        if (filtroGrupo !== 'todos' && !e.tags.includes(`grupo:${filtroGrupo}`)) return false;
        if (filtroComplex !== 'todos' && !e.tags.includes(filtroComplex)) return false;
        if (filtroAlcance !== 'todos' && !e.tags.includes(filtroAlcance)) return false;
        return true;
      })
      .sort((a, b) => b.atualizadoEm - a.atualizadoEm);
  }, [todas, filtro, busca, filtroGrupo, filtroComplex, filtroAlcance]);

  const handleEntregar = (entidadeId: string, nomeEntidade: string) => {
    const charId = destinoPorEnt[entidadeId];
    if (!charId) {
      toast({
        title: 'Selecione um destino',
        description: 'Escolha o personagem que vai receber o item.',
        variant: 'destructive',
      });
      return;
    }
    const char = characters.find((c) => c.id === charId);
    const inst = entregar(entidadeId, charId);
    if (!inst) {
      toast({ title: 'Falha', description: 'Entidade não encontrada.', variant: 'destructive' });
      return;
    }
    addLog('system', `🎁 Mestre entregou "${nomeEntidade}" para ${char?.name ?? 'jogador'}.`);
    toast({ title: 'Entregue', description: `${nomeEntidade} → ${char?.name}` });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar no catálogo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-56 pl-7 h-8 text-xs"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              onClick={() => setFiltro(c.id)}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                filtro === c.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground italic">
          {filtradas.length} entrada(s) · pool global
        </span>
      </div>

      {filtro === 'arma' && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5">
          <span className="text-[10px] uppercase tracking-wider text-primary/80">Tipos de Arma</span>
          <Select value={filtroGrupo} onValueChange={setFiltroGrupo}>
            <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Grupo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os grupos</SelectItem>
              {['faca','espada','bastão','pugilato','haste','machado','martelo','chicote','arco','besta','tiro','dardo'].map((g) => (
                <SelectItem key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroComplex} onValueChange={setFiltroComplex}>
            <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Complexidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Toda complexidade</SelectItem>
              <SelectItem value="simples">Simples</SelectItem>
              <SelectItem value="complexa">Complexa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroAlcance} onValueChange={setFiltroAlcance}>
            <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Alcance" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo alcance</SelectItem>
              <SelectItem value="melee">Corpo-a-corpo</SelectItem>
              <SelectItem value="ranged">Distância</SelectItem>
              <SelectItem value="thrown">Arremessável</SelectItem>
            </SelectContent>
          </Select>
          {(filtroGrupo !== 'todos' || filtroComplex !== 'todos' || filtroAlcance !== 'todos') && (
            <button
              onClick={() => { setFiltroGrupo('todos'); setFiltroComplex('todos'); setFiltroAlcance('todos'); }}
              className="text-[10px] text-muted-foreground hover:text-foreground underline ml-auto"
            >
              limpar filtros
            </button>
          )}
        </div>
      )}

      {filtradas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-8 text-center text-muted-foreground">
          <Package className="h-8 w-8 mx-auto text-primary/40 mb-2" />
          <p className="text-sm">Catálogo vazio para este filtro.</p>
          <p className="text-xs mt-1">Crie entidades na aba <strong>Construtor</strong> — elas aparecem aqui automaticamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtradas.map((e) => (
            <div
              key={e.id}
              className={`rounded-lg border p-3 transition-colors flex flex-col gap-2 ${
                e.tags?.includes('rascunho-conceito')
                  ? 'border-amber-500/60 bg-amber-500/5 hover:border-amber-400'
                  : 'border-border/60 bg-card/80 hover:border-primary/50'
              }`}
            >
              <div>
                <div className="font-semibold text-foreground truncate">{e.nome}</div>
                <div className="text-[10px] uppercase tracking-wider text-primary/70">
                  {e.categoria}
                  {e.combatData?.effects?.length
                    ? ` · ${e.combatData.effects.length} efeito(s)`
                    : ''}
                </div>
              </div>
              {e.tags?.includes('rascunho-conceito') && (
                <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold uppercase tracking-wider text-[10px]">
                      Aguardando mecânica amaldiçoada
                    </div>
                    <div className="text-amber-100/80 mt-0.5">
                      Conceito enviado pelo jogador. {isMaster ? 'Abra para escrever a lógica no Terminal.' : 'O Mestre vai completar.'}
                    </div>
                  </div>
                </div>
              )}
              {e.descricao && (
                <p className="text-xs text-muted-foreground line-clamp-2">{e.descricao}</p>
              )}
              {e.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {e.tags.slice(0, 4).map((t) => {
                    const isConceito = t === 'rascunho-conceito';
                    return (
                      <span
                        key={t}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          isConceito
                            ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {isConceito ? '💡 Conceito' : t}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="mt-auto pt-2 border-t border-border/40 space-y-1.5">
                {isMaster && e.tags?.includes('rascunho-conceito') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditandoConceito(e)}
                    className="w-full h-8 text-xs gap-1 border-amber-500/60 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
                  >
                    <Wand2 className="h-3.5 w-3.5" /> Finalizar Mecânica (Terminal)
                  </Button>
                )}
                <Select
                  value={destinoPorEnt[e.id] ?? ''}
                  onValueChange={(v) =>
                    setDestinoPorEnt((p) => ({ ...p, [e.id]: v }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecionar personagem…" />
                  </SelectTrigger>
                  <SelectContent>
                    {characters.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        Nenhuma ficha cadastrada
                      </div>
                    ) : (
                      characters.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          <span className="text-muted-foreground ml-1.5 text-[10px]">
                            ({c.category ?? 'PJ'})
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="w-full h-8 text-xs gap-1 bg-primary hover:bg-primary/90"
                  onClick={() => handleEntregar(e.id, e.nome)}
                  disabled={!destinoPorEnt[e.id] || e.tags?.includes('rascunho-conceito')}
                  title={e.tags?.includes('rascunho-conceito') ? 'Finalize a mecânica antes de entregar.' : undefined}
                >
                  <Send className="h-3.5 w-3.5" /> Entregar para Jogador
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editandoConceito && (
        <ConstrutorEntidade
          aberto={!!editandoConceito}
          onClose={() => setEditandoConceito(null)}
          entidadeInicial={editandoConceito}
          abaInicial="combate"
          onSalvar={(ent) => {
            // Mestre completou a mecânica → remove a tag de rascunho.
            const tagsLimpas = (ent.tags ?? []).filter((t) => t !== 'rascunho-conceito');
            const finalizada: EntidadeOmni = {
              ...ent,
              tags: tagsLimpas,
              atualizadoEm: Date.now(),
            };
            substituirEntidade(finalizada.id, finalizada);
            addLog('system', `🪄 Mestre finalizou a mecânica do conceito "${finalizada.nome}".`);
            toast({ title: 'Mecânica finalizada', description: finalizada.nome });
          }}
        />
      )}
    </div>
  );
}