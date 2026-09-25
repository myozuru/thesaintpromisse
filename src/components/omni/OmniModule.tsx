/**
 * Página principal do Omni-Engine: grid de entidades no-code com
 * criação, edição, duplicação, export/import JSON.
 */
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModuleHeader } from '@/components/ui/module-header';
import { Plus, Download, Upload, Copy, Trash2, Pencil, Sparkles, Play, Lock, Package, Wand2, Store, BookOpen } from 'lucide-react';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniProposalStore } from '@/stores/useOmniProposalStore';
import { useLogStore } from '@/stores/useLogStore';
import type { CategoriaEntidade, EntidadeOmni } from '@/lib/omni/tipos';
import { PacoteOmniSchema } from '@/lib/omni/validacao';
import { ConstrutorEntidade } from './ConstrutorEntidade';
import { EfeitosAtivosPanel } from './EfeitosAtivosPanel';
import { PainelEspacial } from './PainelEspacial';
import { PresetsDialog } from './PresetsDialog';
import { MigracaoWizardDialog } from './MigracaoWizardDialog';
import { GerenciadorLojas } from './GerenciadorLojas';
import { GuiaFormulasDialog } from './GuiaFormulasDialog';
import { CatalogoOmni } from './CatalogoOmni';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { OmniItemDescription } from './OmniItemDescription';
import { ROTULOS_GATILHOS } from '@/lib/omni/constantesDoSistema';
import { nomeAmigavelRecurso } from '@/lib/omni/omniScript';

/** Renderiza um ValorDinamico de forma humana (fixo ou fórmula). */
function valorDinamicoTexto(v?: { tipo: 'fixo'; valor: number } | { tipo: 'formula'; expressao: string }): string {
  if (!v) return '—';
  if (v.tipo === 'fixo') return String(v.valor);
  return v.expressao?.replace(/@USUARIO\./gi, '').replace(/@ALVO\./gi, 'alvo.') || '0';
}

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

export function OmniModule() {
  const { toast } = useToast();
  const role = useRoleStore((s) => s.role);
  const isMaster = role === 'MASTER';
  const entidades = useOmniEntidadesStore((s) => s.entidades);
  const criarEntidade = useOmniEntidadesStore((s) => s.criar);
  const removerEntidade = useOmniEntidadesStore((s) => s.remover);
  const substituirEntidade = useOmniEntidadesStore((s) => s.substituir);
  const exportarPacote = useOmniEntidadesStore((s) => s.exportarPacote);
  const importarPacote = useOmniEntidadesStore((s) => s.importarPacote);
  const characters = useCharacterStore((s) => s.characters);
  const vincularOmniAtivo = useCharacterStore((s) => s.vincularOmniAtivo);
  const submitProposal = useOmniProposalStore((s) => s.submit);
  const playerProposals = useOmniProposalStore((s) => s.proposals);
  const inventoryAdd = useInventoryStore((s) => s.add);
  const addLog = useLogStore((s) => s.addLog);
  const [filtro, setFiltro] = useState<CategoriaEntidade | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<EntidadeOmni | null>(null);
  const [sourceId, setSourceId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [presetsAberto, setPresetsAberto] = useState(false);
  const [migracaoAberto, setMigracaoAberto] = useState(false);
  const [lojasAberto, setLojasAberto] = useState(false);
  const [guiaAberto, setGuiaAberto] = useState(false);
  const [propondoCharId, setPropondoCharId] = useState<string>('');
  const [rascunho, setRascunho] = useState<EntidadeOmni | null>(null);
  const [propostaAberta, setPropostaAberta] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const todas = useMemo(
    () => Object.values(entidades).sort((a, b) => b.atualizadoEm - a.atualizadoEm),
    [entidades],
  );
  const filtradas = todas.filter((e) => {
    if (filtro !== 'todos' && e.categoria !== filtro) return false;
    if (busca && !e.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const criar = (cat: CategoriaEntidade) => {
    if (isMaster) {
      const ent = criarEntidade(cat, `Nova ${cat}`);
      setEditando(ent);
    } else {
      const now = Date.now();
      const draft: EntidadeOmni = {
        id: crypto.randomUUID(),
        versao: 1,
        nome: `Nova ${cat}`,
        categoria: cat,
        descricao: '',
        tags: [],
        duracao: { tipo: 'instantaneo' },
        custos: [],
        gatilhos: [{ id: crypto.randomUUID(), evento: 'aoEquipar', blocos: [] }],
        criadoEm: now,
        atualizadoEm: now,
      };
      setRascunho(draft);
    }
  };

  const duplicar = (ent: EntidadeOmni) => {
    const novo = criarEntidade(ent.categoria, `${ent.nome} (cópia)`);
    substituirEntidade(novo.id, { ...ent, id: novo.id, nome: novo.nome });
  };

  const playerCharacters = useMemo(
    () => characters.filter((c) => c.createdBy !== 'MASTER'),
    [characters],
  );

  if (!isMaster && !propondoCharId && playerCharacters.length > 0) {
    setPropondoCharId(playerCharacters[0].id);
  }

  const enviarProposta = (ent: EntidadeOmni) => {
    const char = playerCharacters.find((c) => c.id === propondoCharId);
    if (!char) {
      toast({
        title: 'Selecione um personagem',
        description: 'Você precisa estar associado a uma ficha de jogador para propor entidades.',
        variant: 'destructive',
      });
      return;
    }
    submitProposal(char.id, char.name, ent);
    addLog('system', `📜 ${char.name} enviou ao Mestre uma proposta de ${ent.categoria}: "${ent.nome}".`);
    toast({ title: 'Proposta enviada', description: `"${ent.nome}" aguarda aprovação do Mestre.` });
    setRascunho(null);
  };

  // ===== Visão do PLAYER =====
  if (!isMaster) {
    const minhasPropostas = playerProposals.filter((p) =>
      playerCharacters.some((c) => c.id === p.characterId),
    );
    return (
      <div className="space-y-4">
        <ModuleHeader
          title="Omni-Engine — Construtor"
          subtitle="Crie itens, feitiços, talentos e auras. Tudo que você criar é enviado para aprovação do Mestre."
          icon={Sparkles}
        />
        {playerCharacters.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-10 text-center text-muted-foreground">
            <Lock className="h-10 w-10 mx-auto text-primary/40 mb-3" />
            <p className="font-semibold text-foreground">Crie uma ficha primeiro</p>
            <p className="text-xs mt-1">
              Você precisa de pelo menos um personagem (não-NPC) para propor entidades ao Mestre.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-card/60 p-2 text-xs">
              <span className="text-muted-foreground">Propondo como:</span>
              <select
                value={propondoCharId}
                onChange={(e) => setPropondoCharId(e.target.value)}
                className="bg-background border border-border rounded px-2 py-1"
              >
                {playerCharacters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <span className="ml-auto text-muted-foreground italic">
                Suas criações precisam ser aprovadas pelo Mestre antes de virarem reais.
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS.filter((c) => c.id !== 'todos').map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  onClick={() => criar(c.id as CategoriaEntidade)}
                  className="bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Propor {c.label.replace(/s$/, '')}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setGuiaAberto(true)}
                className="ml-auto"
              >
                <BookOpen className="h-4 w-4 mr-1" /> Guia de Fórmulas
              </Button>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/60 p-3">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Minhas Propostas ({minhasPropostas.length})
              </h3>
              {minhasPropostas.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Você ainda não propôs nenhuma entidade. Use os botões acima para começar.
                </p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {minhasPropostas.slice(0, 8).map((p) => {
                    const last = p.revisions[p.revisions.length - 1];
                    const statusLabel = {
                      pending: 'Aguardando Mestre',
                      counter_master: 'Contraproposta do Mestre',
                      counter_player: 'Aguardando Mestre',
                      approved: 'Aprovada ✓',
                      rejected: 'Recusada ✕',
                    }[p.status];
                    const aberta = propostaAberta === p.id;
                    return (
                      <li
                        key={p.id}
                        className="rounded border border-border/40 bg-background/40"
                      >
                        <button
                          type="button"
                          onClick={() => setPropostaAberta(aberta ? null : p.id)}
                          className="w-full flex items-center justify-between px-2 py-1 hover:bg-primary/5 transition-colors"
                        >
                          <span className="truncate text-left">
                            <span className="text-primary">◇</span> {last.entidade.nome}{' '}
                            <span className="text-muted-foreground">({last.entidade.categoria})</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground uppercase">{statusLabel}</span>
                        </button>
                        {aberta && (
                          <div className="border-t border-border/40 p-2 text-[11px] space-y-1.5">
                            {last.entidade.descricao && (
                              <p className="text-muted-foreground italic">{last.entidade.descricao}</p>
                            )}
                            {last.entidade.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {last.entidade.tags.map((t) => (
                                  <span key={t} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
                              <span>Duração: <span className="text-foreground">{last.entidade.duracao.tipo}</span></span>
                              <span>Custos: <span className="text-foreground">{last.entidade.custos.length}</span></span>
                              <span>Gatilhos: <span className="text-foreground">{last.entidade.gatilhos.length}</span></span>
                              <span>Efeitos: <span className="text-foreground">{last.entidade.combatData?.effects?.length ?? 0}</span></span>
                            </div>
                            {/* Custos detalhados */}
                            {last.entidade.custos.length > 0 && (
                              <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 space-y-0.5">
                                <div className="text-[10px] uppercase tracking-wider text-amber-300/80">Custos</div>
                                {last.entidade.custos.map((c, i) => (
                                  <div key={i} className="text-foreground/90">
                                    💰 {valorDinamicoTexto(c.valor)} de {nomeAmigavelRecurso(c.caminhoRecurso)}
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Gatilhos detalhados */}
                            {last.entidade.gatilhos.length > 0 && (
                              <div className="rounded border border-sky-500/30 bg-sky-500/5 p-2 space-y-0.5">
                                <div className="text-[10px] uppercase tracking-wider text-sky-300/80">Gatilhos</div>
                                {last.entidade.gatilhos.map((g, i) => (
                                  <div key={g.id ?? i} className="text-foreground/90">
                                    ⚡ {ROTULOS_GATILHOS[g.evento] ?? g.evento}
                                    {g.blocos?.length > 0 && (
                                      <span className="text-muted-foreground"> · {g.blocos.length} bloco(s) lógico(s)</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Efeitos de combate humanizados */}
                            {(last.entidade.combatData?.effects?.length ?? 0) > 0 && (
                              <OmniItemDescription
                                effects={last.entidade.combatData!.effects}
                                variante="bloco"
                              />
                            )}
                            {/* Alcance / área */}
                            {(last.entidade.alcance || last.entidade.areaRaio) && (
                              <div className="text-muted-foreground">
                                {last.entidade.alcance && (
                                  <span>📏 Alcance: <span className="text-foreground">{valorDinamicoTexto(last.entidade.alcance)}m</span> </span>
                                )}
                                {last.entidade.areaRaio && (
                                  <span>🌐 Área: <span className="text-foreground">{valorDinamicoTexto(last.entidade.areaRaio)}m</span></span>
                                )}
                              </div>
                            )}
                            {last.note && (
                              <p className="text-muted-foreground border-l-2 border-primary/40 pl-2">
                                💬 "{last.note}"
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground italic mt-1">
                              Use a aba "Feitiços de Players" para responder contrapropostas em detalhe.
                            </p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-[10px] text-muted-foreground mt-2 italic">
                Acompanhe e responda contrapropostas na aba "Feitiços de Players".
              </p>
            </div>
          </>
        )}
        {rascunho && (
          <ConstrutorEntidade
            aberto={!!rascunho}
            onClose={() => setRascunho(null)}
            entidadeInicial={rascunho}
            onSalvar={(e) => enviarProposta(e)}
            onProporConceito={(e) => enviarProposta(e)}
          />
        )}
        <GuiaFormulasDialog aberto={guiaAberto} onClose={() => setGuiaAberto(false)} modo="flutuante" />
      </div>
    );
  }

  const exportar = () => {
    const pacote = exportarPacote('Pacote Omni', 'Mestre');
    const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omni-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Pacote exportado', description: `${pacote.entidades.length} entidade(s)` });
  };

  const importar = async (file: File) => {
    try {
      const txt = await file.text();
      const raw = JSON.parse(txt);
      const parsed = PacoteOmniSchema.safeParse(raw);
      if (!parsed.success) {
        toast({
          title: 'JSON inválido',
          description: parsed.error.issues[0]?.message ?? 'Schema do pacote não bate.',
          variant: 'destructive',
        });
        return;
      }
      const n = importarPacote(parsed.data as unknown as import('@/lib/omni/tipos').PacoteOmni, 'mesclar');
      toast({ title: 'Importado', description: `${n} entidade(s) adicionadas.` });
    } catch {
      toast({ title: 'Falha ao importar', description: 'Arquivo JSON inválido.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <ModuleHeader title="Omni-Engine" subtitle="Construtor visual no-code de entidades do sistema" icon={Sparkles} />

      <Tabs defaultValue="construtor" className="space-y-4">
        <TabsList>
          <TabsTrigger value="construtor" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Construtor
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="gap-1.5">
            <Package className="h-3.5 w-3.5" /> Catálogo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="construtor" className="space-y-4 mt-0">
        <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-48" />
        <div className="flex gap-1 flex-wrap">
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              onClick={() => setFiltro(c.id)}
              className={`text-xs px-3 py-1.5 rounded-md border ${filtro === c.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setGuiaAberto(true)}>
            <BookOpen className="h-4 w-4 mr-1" /> Guia de Fórmulas
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPresetsAberto(true)}>
            <Package className="h-4 w-4 mr-1" /> Presets
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLojasAberto(true)}>
            <Store className="h-4 w-4 mr-1" /> Lojas
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMigracaoAberto(true)}>
            <Wand2 className="h-4 w-4 mr-1" /> Migrar Legado
          </Button>
          <Button size="sm" variant="outline" onClick={exportar} disabled={todas.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Exportar
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Importar
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importar(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIAS.filter((c) => c.id !== 'todos').map((c) => (
          <Button key={c.id} size="sm" onClick={() => criar(c.id as CategoriaEntidade)} className="bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30">
            <Plus className="h-3.5 w-3.5 mr-1" /> {c.label.replace(/s$/, '')}
          </Button>
        ))}
      </div>

      {/* Seletor source/target — usado pelo botão Aplicar e pelo simulador */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/60 p-2 text-xs">
        <span className="text-muted-foreground">Aplicar como:</span>
        <select
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="bg-background border border-border rounded px-2 py-1"
        >
          <option value="">— Origem —</option>
          {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-muted-foreground">→</span>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="bg-background border border-border rounded px-2 py-1"
        >
          <option value="">— Alvo —</option>
          {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <EfeitosAtivosPanel />
      <PainelEspacial />

      {filtradas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-10 text-center text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto text-primary/40 mb-3" />
          <p>Nenhuma entidade criada ainda.</p>
          <p className="text-xs mt-1">Comece criando um Item, Feitiço, Talento ou Aura acima.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtradas.map((e) => (
            <div key={e.id} className="rounded-lg border border-border/60 bg-card/80 p-3 hover:border-primary/50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{e.nome}</div>
                  <div className="text-[10px] uppercase tracking-wider text-primary/70">{e.categoria}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    title={`Aplicar efeito${sourceId ? ` (origem: ${characters.find(c => c.id === sourceId)?.name})` : ''}${targetId ? ` → ${characters.find(c => c.id === targetId)?.name}` : ''}`}
                    onClick={() => {
                      useOmniRuntimeStore.getState().aplicarEfeito(e, {
                        sourceCharId: sourceId || undefined,
                        targetCharId: targetId || undefined,
                      });
                      toast({ title: 'Efeito aplicado', description: e.nome });
                    }}
                  >
                    <Play className="h-3.5 w-3.5 text-primary" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditando(e)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => duplicar(e)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removerEntidade(e.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                  </Button>
                </div>
              </div>
              {e.descricao && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{e.descricao}</p>}
              <div className="flex gap-2 mt-2 text-[10px] text-muted-foreground">
                <span>Duração: {e.duracao.tipo}</span>
                <span>•</span>
                <span>{e.gatilhos.length} gatilho(s)</span>
                <span>•</span>
                <span>{e.custos.length} custo(s)</span>
              </div>
              {characters.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 border-t border-border/40 pt-2">
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {e.categoria === 'item' || e.categoria === 'arma' ? 'Dar a:' : 'Atribuir a:'}
                  </span>
                  <select
                    defaultValue=""
                    onChange={(ev) => {
                      const charId = ev.target.value;
                      if (!charId) return;
                      const char = characters.find((c) => c.id === charId);
                      if (e.categoria === 'item' || e.categoria === 'arma') {
                        inventoryAdd(charId, e);
                        addLog('system', `🎁 Mestre entregou "${e.nome}" para ${char?.name ?? 'jogador'}.`);
                        toast({ title: 'Item entregue', description: `${e.nome} → ${char?.name}` });
                       } else {
                        const jaVinculada = char?.omniAtivos?.some((a) => a.entidadeId === e.id);
                        if (jaVinculada) {
                          toast({ title: 'Já atribuída', description: `${e.nome} já está na ficha de ${char?.name}.` });
                        } else {
                          // NÃO entra no inventário — vai direto pra seção da categoria (passiva/talento/aura/feitiço/condição)
                          const instanceId = `omni-inst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
                          const ok = vincularOmniAtivo(charId, {
                            categoria: e.categoria,
                            entidadeId: e.id,
                            instanceId,
                          });
                          if (ok) {
                            const rotulo =
                              e.categoria === 'passiva' ? 'passiva' :
                              e.categoria === 'talento' ? 'talento' :
                              e.categoria === 'aura' ? 'aura' :
                              e.categoria === 'feitico' ? 'feitiço' :
                              e.categoria === 'condicao' ? 'condição' :
                              e.categoria === 'voto' ? 'voto' : 'habilidade';
                            addLog('system', `🔗 Mestre atribuiu a ${rotulo} "${e.nome}" à ficha de ${char?.name ?? 'jogador'}.`);
                            toast({ title: `${rotulo[0].toUpperCase()}${rotulo.slice(1)} atribuída`, description: `${e.nome} → ${char?.name}` });
                          }
                        }
                      }
                      ev.target.value = '';
                    }}
                    className="flex-1 text-[11px] bg-background border border-border rounded px-1.5 py-1"
                  >
                    <option value="">— Selecionar personagem —</option>
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editando && (
        <ConstrutorEntidade
          aberto={!!editando}
          onClose={() => setEditando(null)}
          entidadeInicial={editando}
          onSalvar={(e) => substituirEntidade(e.id, e)}
        />
      )}
        </TabsContent>

        <TabsContent value="catalogo" className="mt-0">
          <CatalogoOmni />
        </TabsContent>
      </Tabs>

      <PresetsDialog aberto={presetsAberto} onClose={() => setPresetsAberto(false)} />
      <MigracaoWizardDialog aberto={migracaoAberto} onClose={() => setMigracaoAberto(false)} />
      <GerenciadorLojas aberto={lojasAberto} onClose={() => setLojasAberto(false)} />
      <GuiaFormulasDialog aberto={guiaAberto} onClose={() => setGuiaAberto(false)} modo="flutuante" />
    </div>
  );
}
