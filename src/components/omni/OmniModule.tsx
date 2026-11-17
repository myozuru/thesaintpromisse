/**
 * Página principal do Omni-Engine: grid de entidades no-code com
 * criação, edição, duplicação, export/import JSON.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ModuleHeader } from '@/components/ui/module-header';
import { Plus, Download, Upload, Copy, Trash2, Pencil, Sparkles, Play, Lock, Package, Wand2, Store, BookOpen, Eye, X } from 'lucide-react';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniProposalStore } from '@/stores/useOmniProposalStore';
import { useLogStore } from '@/stores/useLogStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { findMyCharacter } from '@/lib/myCharacter';
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
import { cn } from '@/lib/utils';

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
  const [entidadeSelecionadaId, setEntidadeSelecionadaId] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [presetsAberto, setPresetsAberto] = useState(false);
  const [migracaoAberto, setMigracaoAberto] = useState(false);
  const [lojasAberto, setLojasAberto] = useState(false);
  const [guiaAberto, setGuiaAberto] = useState(false);
  const [propondoCharId, setPropondoCharId] = useState<string>('');
  const [rascunho, setRascunho] = useState<EntidadeOmni | null>(null);
  const [propostaAberta, setPropostaAberta] = useState<string | null>(null);
  const buscaInputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const todas = useMemo(
    () => Object.values(entidades).sort((a, b) => b.atualizadoEm - a.atualizadoEm),
    [entidades],
  );
  const filtradas = useMemo(
    () => todas.filter((e) => {
      if (filtro !== 'todos' && e.categoria !== filtro) return false;
      if (busca && !e.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    }),
    [todas, filtro, busca],
  );

  // Category counts for filter pills
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CATEGORIAS.forEach((c) => {
      counts[c.id] = todas.filter((e) => e.categoria === c.id).length;
    });
    counts['todos'] = todas.length;
    return counts;
  }, [todas]);

  // Keep the detail view while the selected entity is hidden by search/filters;
  // clear it only when the entity itself was removed from the catalog.
  useEffect(() => {
    if (entidadeSelecionadaId && !todas.some((e) => e.id === entidadeSelecionadaId)) {
      setEntidadeSelecionadaId(null);
    }
  }, [todas, entidadeSelecionadaId]);

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

  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  // Jogador só pode propor com a PRÓPRIA ficha (ligada ao perfil logado).
  const playerCharacters = useMemo(() => {
    const mine = findMyCharacter(characters, activeProfileId);
    return mine ? [mine] : [];
  }, [characters, activeProfileId]);

  if (!isMaster && playerCharacters.length > 0 && propondoCharId !== playerCharacters[0].id) {
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
            <p className="text-base mt-1">
              Você precisa de pelo menos um personagem (não-NPC) para propor entidades ao Mestre.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-card/60 p-2 text-base">
              <span className="text-muted-foreground">Propondo como:</span>
              <span className="font-semibold text-foreground">{playerCharacters[0]?.name}</span>
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
              <h3 className="text-base uppercase tracking-wider text-muted-foreground mb-2">
                Minhas Propostas ({minhasPropostas.length})
              </h3>
              {minhasPropostas.length === 0 ? (
                <p className="text-base text-muted-foreground italic">
                  Você ainda não propôs nenhuma entidade. Use os botões acima para começar.
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
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
                          <span className="text-xs text-muted-foreground uppercase">{statusLabel}</span>
                        </button>
                        {aberta && (
                          <div className="border-t border-border/40 p-2 text-sm space-y-1.5">
                            {last.entidade.descricao && (
                              <p className="text-muted-foreground italic">{last.entidade.descricao}</p>
                            )}
                            {last.entidade.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {last.entidade.tags.map((t) => (
                                  <span key={t} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-sm">
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
                              <div className="text-sm uppercase tracking-wider text-amber-300/80">Custos</div>
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
                              <div className="text-sm uppercase tracking-wider text-sky-300/80">Gatilhos</div>
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
                            <p className="text-base text-muted-foreground italic mt-1">
                              Use a aba "Feitiços de Players" para responder contrapropostas em detalhe.
                            </p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-base text-muted-foreground mt-2 italic">
                Acompanhe e responda contrapropostas na aba "Feitiços de Players".
              </p>
            </div>
          </>
        )}
        {rascunho && (
          <ConstrutorEntidade
            aberto={!!rascunho}
            onCancelar={() => setRascunho(null)}
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
    <div className="space-y-6 animate-fade-in">
      <ModuleHeader title="Omni-Engine" subtitle="Construtor visual no-code de entidades do sistema" icon={Sparkles} />

      <Tabs defaultValue="construtor" className="space-y-5">
        <TabsList className="h-auto flex-wrap gap-1 rounded-xl border border-border/70 bg-card/70 p-1.5">
          <TabsTrigger value="construtor" className="min-h-11 gap-2 px-4 text-base data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Construtor
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="min-h-11 gap-2 px-4 text-base data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <Package className="h-3.5 w-3.5" /> Catálogo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="construtor" className="mt-0 space-y-5">
        <div className="space-y-4 rounded-2xl border border-border/70 bg-card/70 p-4 card-enigmatic">
        <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Input
            ref={buscaInputRef}
            aria-label="Buscar entidades"
            placeholder="Buscar entidade…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-11 w-full bg-background/70 pr-14 text-base"
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
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={filtro === c.id}
              onClick={() => setFiltro(c.id)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${filtro === c.id
                ? 'border-primary/50 bg-primary/15 text-primary shadow-sm shadow-primary/10'
                : 'border-border/70 bg-background/40 text-muted-foreground hover:border-primary/30 hover:bg-secondary/60 hover:text-foreground'}`}
            >
              {c.label}
              {categoryCounts[c.id] > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-primary/20 text-primary/80">
                  {categoryCounts[c.id]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4">
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

      <div className="flex flex-wrap gap-2 rounded-xl border border-border/60 bg-background/25 p-3">
        {CATEGORIAS.filter((c) => c.id !== 'todos').map((c) => (
          <Button key={c.id} size="sm" onClick={() => criar(c.id as CategoriaEntidade)} className="min-h-11 border border-primary/30 bg-primary/10 px-4 text-base text-primary hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-primary/70">
            <Plus className="h-3.5 w-3.5 mr-1" /> {c.label.replace(/s$/, '')}
          </Button>
        ))}
      </div>

      {/* Seletor source/target — usado pelo botão Aplicar e pelo simulador */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-card/60 p-3 text-base card-enigmatic">
        <span className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Aplicar como</span>
        <select
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          aria-label="Personagem de origem"
          className="min-h-11 min-w-[12rem] flex-1 rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <option value="">— Origem —</option>
          {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-muted-foreground">→</span>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          aria-label="Personagem alvo"
          className="min-h-11 min-w-[12rem] flex-1 rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        >
          <option value="">— Alvo —</option>
          {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <EfeitosAtivosPanel />
      <PainelEspacial />

      {filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/45 p-10 text-center text-muted-foreground card-enigmatic">
          <Sparkles className="h-10 w-10 mx-auto text-primary/40 mb-3" />
          <p>{todas.length === 0 ? 'Nenhuma entidade criada ainda.' : 'Nenhuma entidade corresponde aos filtros.'}</p>
          <p className="text-sm mt-1">{todas.length === 0 ? 'Comece criando um Item, Feitiço, Talento ou Aura acima.' : 'Ajuste a busca ou escolha outra categoria.'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 min-h-[500px] lg:h-[min(70vh,800px)] lg:flex-row">
          {/* Sidebar - Lista filtrável (~280px) */}
          <aside
            className="lg:w-[280px] flex-shrink-0 flex flex-col"
            aria-label="Lista de entidades"
          >
            <div className="rounded-2xl border border-border/70 bg-card/85 p-3 card-enigmatic overflow-hidden flex flex-col h-full">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-foreground text-sm uppercase tracking-wider">
                  Entidades ({filtradas.length})
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1">
                <ul className="space-y-1" aria-label="Entidades disponíveis">
                  {filtradas.map((e) => {
                    const selecionada = entidadeSelecionadaId === e.id;
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => setEntidadeSelecionadaId(selecionada ? null : e.id)}
                          aria-pressed={selecionada}
                          className={cn(
                            "w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                            selecionada
                              ? "bg-primary/15 border border-primary/40 shadow-sm shadow-primary/10"
                              : "border border-transparent hover:bg-secondary/60 hover:border-primary/20",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-foreground truncate text-sm">{e.nome}</div>
                              <div className="text-xs uppercase tracking-wider text-primary/70">{e.categoria}</div>
                            </div>
                            {selecionada && <Eye className="h-4 w-4 text-primary flex-shrink-0" />}
                          </div>
                          {e.descricao && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{e.descricao}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-sm font-mono text-muted-foreground">
                            <span>Duração: <span className="text-foreground">{e.duracao.tipo}</span></span>
                            <span className="text-border">•</span>
                            <span>{e.gatilhos.length} gatilho(s)</span>
                            <span className="text-border">•</span>
                            <span>{e.custos.length} custo(s)</span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </aside>

          {/* Painel de detalhe/edição à direita */}
          <div className="flex-1 min-w-0">
            {entidadeSelecionadaId ? (
              (() => {
                const ent = todas.find((e) => e.id === entidadeSelecionadaId);
                if (!ent) return null;
                return (
                  <div className="rounded-2xl border border-border/70 bg-card/85 p-4 card-enigmatic h-full flex flex-col overflow-hidden">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground text-lg truncate">{ent.nome}</div>
                        <div className="text-xs uppercase tracking-wider text-primary/70">{ent.categoria}</div>
                        {!filtradas.some((e) => e.id === ent.id) && (
                          <p role="status" className="mt-1 text-base text-muted-foreground">
                            Esta entidade está fora da busca e dos filtros atuais; o detalhe permanece aberto.
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-10 w-10 p-0 focus-visible:ring-2 focus-visible:ring-primary/70"
                          aria-label={'Aplicar efeito ' + ent.nome}
                          title={`Aplicar efeito${sourceId ? ` (origem: ${characters.find(c => c.id === sourceId)?.name})` : ''}${targetId ? ` → ${characters.find(c => c.id === targetId)?.name}` : ''}`}
                          onClick={() => {
                            useOmniRuntimeStore.getState().aplicarEfeito(ent, {
                              sourceCharId: sourceId || undefined,
                              targetCharId: targetId || undefined,
                            });
                            toast({ title: 'Efeito aplicado', description: ent.nome });
                          }}
                        >
                          <Play className="h-4 w-4 text-primary" />
                        </Button>
                        <Button size="sm" variant="ghost" aria-label={'Editar ' + ent.nome} title={'Editar ' + ent.nome} className="h-10 w-10 p-0 focus-visible:ring-2 focus-visible:ring-primary/70" onClick={() => setEditando(ent)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" aria-label={'Duplicar ' + ent.nome} title={'Duplicar ' + ent.nome} className="h-10 w-10 p-0 focus-visible:ring-2 focus-visible:ring-primary/70" onClick={() => duplicar(ent)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" aria-label={'Excluir ' + ent.nome} title={'Excluir ' + ent.nome} className="h-10 w-10 p-0 text-destructive/80 focus-visible:ring-2 focus-visible:ring-primary/70" onClick={() => { removerEntidade(ent.id); setEntidadeSelecionadaId(null); }}>
                          <Trash2 className="h-4 w-4 text-destructive/70" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4">
                      {ent.descricao && (
                        <div className="prose prose-invert max-w-none text-muted-foreground" style={{ fontSize: 'var(--ui-reading-floor)', lineHeight: '1.75' }}>
                          <p className="leading-relaxed">{ent.descricao}</p>
                        </div>
                      )}

                      <div className="rounded-xl border border-border/50 bg-background/40 p-3 space-y-2">
                        <div className="text-sm uppercase tracking-wider text-muted-foreground">Resumo</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>Duração:</span>
                          <span className="text-foreground font-mono">{ent.duracao.tipo}</span>
                          <span>Gatilhos:</span>
                          <span className="text-foreground font-mono">{ent.gatilhos.length}</span>
                          <span>Custos:</span>
                          <span className="text-foreground font-mono">{ent.custos.length}</span>
                          <span>Efeitos:</span>
                          <span className="text-foreground font-mono">{ent.combatData?.effects?.length ?? 0}</span>
                        </div>
                        {ent.alcance && (
                          <div className="text-sm text-muted-foreground">
                            Alcance: <span className="text-foreground font-mono">{valorDinamicoTexto(ent.alcance)}m</span>
                          </div>
                        )}
                        {ent.areaRaio && (
                          <div className="text-sm text-muted-foreground">
                            Área: <span className="text-foreground font-mono">{valorDinamicoTexto(ent.areaRaio)}m</span>
                          </div>
                        )}
                        {ent.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {ent.tags.map((t) => (
                              <span key={t} className="px-2 py-0.5 rounded bg-primary/10 text-primary text-sm border border-primary/20">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {ent.custos.length > 0 && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                          <div className="text-sm uppercase tracking-wider text-amber-300/80">Custos</div>
                          {ent.custos.map((c, i) => (
                            <div key={i} className="text-foreground/90 text-sm">
                              💰 {valorDinamicoTexto(c.valor)} de {nomeAmigavelRecurso(c.caminhoRecurso)}
                            </div>
                          ))}
                        </div>
                      )}

                      {ent.gatilhos.length > 0 && (
                        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-2">
                          <div className="text-sm uppercase tracking-wider text-sky-300/80">Gatilhos</div>
                          {ent.gatilhos.map((g, i) => (
                            <div key={g.id ?? i} className="text-foreground/90 text-sm">
                              ⚡ {ROTULOS_GATILHOS[g.evento] ?? g.evento}
                              {g.blocos?.length > 0 && (
                                <span className="text-muted-foreground"> · {g.blocos.length} bloco(s) lógico(s)</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {(ent.combatData?.effects?.length ?? 0) > 0 && (
                        <OmniItemDescription
                          effects={ent.combatData!.effects}
                          variante="bloco"
                        />
                      )}
                    </div>

                    {characters.length > 0 && (
                      <div className="mt-4 border-t border-border/40 pt-4">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            {ent.categoria === 'item' || ent.categoria === 'arma' ? 'Dar a:' : 'Atribuir a:'}
                          </span>
                        </div>
                        <select
                          defaultValue=""
                          onChange={(ev) => {
                            const charId = ev.target.value;
                            if (!charId) return;
                            const char = characters.find((c) => c.id === charId);
                            if (ent.categoria === 'item' || ent.categoria === 'arma') {
                              inventoryAdd(charId, ent);
                              addLog('system', `🎁 Mestre entregou "${ent.nome}" para ${char?.name ?? 'jogador'}.`);
                              toast({ title: 'Item entregue', description: `${ent.nome} → ${char?.name}` });
                             } else {
                              const jaVinculada = char?.omniAtivos?.some((a) => a.entidadeId === ent.id);
                              if (jaVinculada) {
                                toast({ title: 'Já atribuída', description: `${ent.nome} já está na ficha de ${char?.name}.` });
                              } else {
                                const instanceId = `omni-inst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
                                const ok = vincularOmniAtivo(charId, {
                                  categoria: ent.categoria,
                                  entidadeId: ent.id,
                                  instanceId,
                                });
                                if (ok) {
                                  const rotulo =
                                    ent.categoria === 'passiva' ? 'passiva' :
                                    ent.categoria === 'talento' ? 'talento' :
                                    ent.categoria === 'aura' ? 'aura' :
                                    ent.categoria === 'feitico' ? 'feitiço' :
                                    ent.categoria === 'condicao' ? 'condição' :
                                    ent.categoria === 'voto' ? 'voto' : 'habilidade';
                                  addLog('system', `🔗 Mestre atribuiu a ${rotulo} "${ent.nome}" à ficha de ${char?.name ?? 'jogador'}.`);
                                  toast({ title: `${rotulo[0].toUpperCase()}${rotulo.slice(1)} atribuída`, description: `${ent.nome} → ${char?.name}` });
                                }
                              }
                            }
                            ev.target.value = '';
                          }}
                          aria-label={`Atribuir ${ent.nome} a personagem`}
                          className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                        >
                          <option value="">— Selecionar personagem —</option>
                          {characters.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-card/45 p-10 text-center text-muted-foreground card-enigmatic h-full flex flex-col items-center justify-center">
                <Sparkles className="h-12 w-12 mx-auto text-primary/40 mb-4" />
                <p className="text-foreground">Selecione uma entidade</p>
                <p className="text-base mt-1">Clique em um item na lista à esquerda para ver os detalhes aqui.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {editando && (
        <ConstrutorEntidade
          aberto={!!editando}
          onCancelar={() => setEditando(null)}
          onSalvarEFechar={(e) => { setEditando(null); }}
          entidadeInicial={editando}
          onSalvar={(e) => { substituirEntidade(e.id, e); setEntidadeSelecionadaId(e.id); }}
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
