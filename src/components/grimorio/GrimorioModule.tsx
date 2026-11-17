import { useState, useCallback, useEffect } from 'react';
import { Plus, Pencil, Trash2, Copy, Skull, Send, CheckCircle2 } from 'lucide-react';
// @ts-ignore - JS module
import useCreatureStorage from './useCreatureStorage';
// @ts-ignore - JSX module
import CreatureBuilder from './CreatureBuilder';
import { importCreatureToFichas } from './convertToFicha';
import { toast } from 'sonner';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { Button } from '@/components/ui/button';
import { ModuleHeader } from '@/components/ui/module-header';
import { cn } from '@/lib/utils';
// @ts-ignore - hook JS module
import useCreatureBuilder, { blankDraft } from './useCreatureBuilder';
// @ts-ignore - JSX module
import LivePreview from './sections/LivePreview';

type ViewMode = 'list' | 'create' | 'edit';

interface CreatureListProps {
  creatures: any[];
  selectedId: string | null;
  viewMode: ViewMode;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onSendToFichas: (creature: any) => void;
  isLinked: (creature: any) => boolean;
}

function CreatureList({
  creatures,
  selectedId,
  viewMode,
  onSelect,
  onCreateNew,
  onEdit,
  onDuplicate,
  onDelete,
  onSendToFichas,
  isLinked,
}: CreatureListProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background/50 lg:border-r lg:border-border/50">
      {/* Header da lista */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 flex-shrink-0">
        <h3 className="font-display text-lg font-semibold text-foreground">Biblioteca</h3>
        <Button
          type="button"
          variant="mystic"
          size="sm"
          onClick={onCreateNew}
          className="min-h-8 gap-1.5 px-3 text-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova
        </Button>
      </div>

      {/* Lista de criaturas */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {creatures.length === 0 ? (
          <div className="card-enigmatic rounded-xl border border-dashed border-border/70 bg-card/45 p-6 text-center text-sm text-muted-foreground">
            <Skull className="mx-auto mb-2 h-7 w-7 text-primary/50" aria-hidden="true" />
            <p className="font-display text-base text-foreground">Grimório vazio</p>
            <p className="mt-1">Clique em "Nova" para criar sua primeira criatura.</p>
          </div>
        ) : (
          creatures.map((c) => {
            const selected = selectedId === c.id;
            const linked = isLinked(c);
            return (
              <article
                key={c.id}
                className={cn(
                  'card-enigmatic min-w-0 rounded-xl border bg-card/80 p-3 shadow-sm transition-all duration-200',
                  selected
                    ? 'border-primary/50 glow-border bg-primary/5'
                    : 'border-border/70 hover:border-primary/30 hover:shadow-primary/5',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  aria-pressed={selected}
                  aria-label={selected && viewMode === 'list'
                    ? `Fechar prévia de ${c.name || 'criatura'}`
                    : `Ver prévia de ${c.name || 'criatura'}`}
                  className="w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                <div className="flex items-start gap-3">
                  <span className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-primary',
                    selected ? 'border-primary/40 bg-primary/20' : 'border-primary/25 bg-primary/10'
                  )}>
                    <Skull className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <h4 className={cn(
                        'min-w-0 truncate font-display text-base font-semibold',
                        selected ? 'text-primary' : 'text-foreground'
                      )}>
                        {c.name || 'Sem nome'}
                      </h4>
                      {linked && (
                        <span
                          title="Ficha vinculada"
                          className="inline-flex min-h-6 shrink-0 items-center gap-1 rounded-full border border-neon-green/30 bg-neon-green/10 px-2 text-xs font-medium text-neon-green"
                        >
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          Ficha
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.core?.patamar && (
                        <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          Patamar {c.core.patamar}
                        </span>
                      )}
                      {c.core?.nd && (
                        <span className="rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
                          ND {c.core.nd}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                </button>

                <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-border/40 pt-2">
                  <button
                    type="button"
                    onClick={() => onSendToFichas(c)}
                    aria-label={linked ? `Atualizar ficha vinculada de ${c.name || 'criatura'}` : `Enviar ${c.name || 'criatura'} para Fichas`}
                    title={linked ? 'Atualizar Ficha vinculada' : 'Enviar para Fichas'}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(c.id)}
                    aria-label={`Editar ${c.name || 'criatura'}`}
                    title="Editar"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDuplicate(c.id)}
                    aria-label={`Duplicar ${c.name || 'criatura'}`}
                    title="Duplicar"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    aria-label={`Apagar ${c.name || 'criatura'}`}
                    title="Apagar"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-destructive/20 text-destructive/80 transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}

interface CreatureBuilderPanelProps {
  mode: ViewMode;
  creature: any | null;
  onSave: (data: any) => void;
  onCancel: () => void;
  onEdit: (id: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}

function CreaturePreview({ creature, onEdit }: { creature: any; onEdit: (id: string) => void }) {
  const { draft, derived, actions } = useCreatureBuilder(blankDraft());
  const [readyForId, setReadyForId] = useState<string | null>(null);

  useEffect(() => {
    actions.hydrate(creature);
    setReadyForId(creature.id);
  }, [creature, actions.hydrate]);

  if (readyForId !== creature.id) {
    return (
      <div role="status" aria-live="polite" className="min-h-48 animate-pulse rounded-2xl border border-border/50 bg-card/40">
        <span className="sr-only">Carregando prévia da criatura.</span>
      </div>
    );
  }

  return (
    <section className="min-w-0 space-y-4" aria-label={`Prévia da criatura ${creature.name || 'sem nome'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 card-enigmatic">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Prévia da ficha</p>
          <h3 className="truncate font-display text-xl font-semibold text-foreground">{creature.name || 'Sem nome'}</h3>
        </div>
        <Button type="button" variant="mystic" onClick={() => onEdit(creature.id)} className="min-h-11 gap-2 px-4">
          <Pencil className="h-4 w-4" aria-hidden="true" /> Editar ficha
        </Button>
      </div>
      <LivePreview draft={draft} derived={derived} />
    </section>
  );
}

function CreatureBuilderPanel({ mode, creature, onSave, onCancel, onEdit, onDirtyChange }: CreatureBuilderPanelProps) {
  if (mode === 'list') {
    if (creature) {
      return <CreaturePreview key={creature.id} creature={creature} onEdit={onEdit} />;
    }

    return (
      <div className="flex h-full min-h-[24rem] flex-col items-center justify-center p-8 text-center">
        <div className="card-enigmatic w-full max-w-md rounded-2xl border border-dashed border-border/70 bg-card/45 p-10">
          <Skull className="mx-auto mb-4 h-12 w-12 text-primary/50" aria-hidden="true" />
          <h3 className="mb-2 font-display text-xl font-semibold text-foreground">Biblioteca de criaturas</h3>
          <p className="text-muted-foreground">Selecione uma criatura para ver sua prévia ou use o botão Nova.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <CreatureBuilder
        key={`${mode}:${mode === 'create' ? 'nova' : creature?.id ?? 'sem-id'}`}
        existingCreature={mode === 'create' ? null : creature}
        embedded
        onDirtyChange={onDirtyChange}
        onSave={onSave}
        onCancel={onCancel}
      />
    </div>
  );
}

export function GrimorioModule() {
  const storage: any = useCreatureStorage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [builderDirty, setBuilderDirty] = useState(false);
  // Subscribe to characters so the "ligada" badge re-renders após import.
  const characterIds = useCharacterStore((s) => s.characters.map((c) => c.id).join(','));

  const selectedCreature = selectedId
    ? storage.creatures.find((c: any) => c.id === selectedId) ?? null
    : null;

  const isEditing = viewMode === 'edit' && !!selectedCreature;
  const isCreating = viewMode === 'create';

  const sendToFichas = useCallback((creature: any) => {
    const res = importCreatureToFichas(creature);
    if (!res) {
      toast.error('Falha ao enviar para Fichas.');
      return;
    }
    // Vincula o id da ficha à criatura para futuras atualizações.
    storage.update(creature.id, { linkedFichaId: res.id });
    toast.success(
      res.created
        ? `Ficha de "${creature.name || 'inimigo'}" criada.`
        : `Ficha de "${creature.name || 'inimigo'}" atualizada.`,
    );
  }, [storage]);

  const isLinked = useCallback((creature: any) => {
    if (!creature.linkedFichaId) return false;
    return useCharacterStore.getState().characters.some((c) => c.id === creature.linkedFichaId);
  }, []);

  // referência para silenciar warning de variável não usada (subscribe apenas)
  void characterIds;

  const confirmDiscardBuilderChanges = () => {
    if (!builderDirty) return true;
    return window.confirm('Há alterações não salvas na ficha. Deseja descartá-las?');
  };

  const handleCreateNew = () => {
    if (viewMode !== 'list' && !confirmDiscardBuilderChanges()) return;
    setBuilderDirty(false);
    setSelectedId(null);
    setViewMode('create');
  };

  const handleSelect = (id: string) => {
    if (viewMode !== 'list' && !confirmDiscardBuilderChanges()) return;
    setBuilderDirty(false);
    if (selectedId === id && viewMode === 'list') {
      setSelectedId(null);
    } else {
      setSelectedId(id);
      setViewMode('list');
    }
  };

  const handleEdit = (id: string) => {
    if (viewMode === 'edit' && selectedId === id) return;
    if (viewMode !== 'list' && !confirmDiscardBuilderChanges()) return;
    setBuilderDirty(false);
    setSelectedId(id);
    setViewMode('edit');
  };

  const handleDuplicate = (id: string) => {
    if (viewMode !== 'list' && !confirmDiscardBuilderChanges()) return;
    setBuilderDirty(false);
    const cloned = storage.duplicate(id);
    if (cloned) {
      setSelectedId(cloned.id);
      setViewMode('edit');
      toast.success(`"${cloned.name}" duplicada.`);
    }
  };

  const handleDelete = (id: string) => {
    const creature = storage.creatures.find((c: any) => c.id === id);
    const deletingDirtySelection = viewMode !== 'list' && selectedId === id && builderDirty;
    const deletePrompt = `Apagar "${creature?.identity?.name || creature?.name || 'criatura'}"?${deletingDirtySelection ? ' As alterações não salvas nesta ficha também serão descartadas.' : ''}`;
    if (creature && confirm(deletePrompt)) {
      storage.remove(id);
      if (selectedId === id) {
        setBuilderDirty(false);
        setSelectedId(null);
        setViewMode('list');
      }
      toast.success('Criatura removida.');
    }
  };

  const handleSave = (data: any) => {
    let savedId: string | null = data.id ?? null;
    if (data.id && storage.creatures.find((c: any) => c.id === data.id)) {
      storage.update(data.id, data);
      toast.success(`"${data.name}" atualizada.`);
    } else {
      const newId = data.id ?? crypto.randomUUID();
      storage.create({ ...data, id: newId });
      savedId = newId;
      toast.success(`"${data.name}" criada.`);
    }
    setBuilderDirty(false);
    setSelectedId(savedId);
    setViewMode(savedId ? 'edit' : 'list');
  };

  const handleCancel = () => {
    if (!confirmDiscardBuilderChanges()) return;
    setBuilderDirty(false);
    setViewMode('list');
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col animate-fade-in">
      <ModuleHeader
        icon={Skull}
        title="Grimório de Inimigos"
        subtitle={`${storage.creatures.length} ${storage.creatures.length === 1 ? 'criatura' : 'criaturas'}`}
        description="Crie, organize e envie criaturas do Grimório diretamente para as fichas da campanha."
      />

      <div className="flex min-w-0 flex-1 flex-col items-stretch gap-4 lg:flex-row lg:items-start">
        {/* Lista fixa no desktop e empilhada no celular para manter a biblioteca acessível. */}
        <aside className="h-64 w-full shrink-0 lg:sticky lg:top-20 lg:h-[calc(100vh-10rem)] lg:w-[280px]" aria-label="Lista de criaturas">
          <CreatureList
            creatures={storage.creatures}
            selectedId={selectedId}
            viewMode={viewMode}
            onSelect={handleSelect}
            onCreateNew={handleCreateNew}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onSendToFichas={sendToFichas}
            isLinked={isLinked}
          />
        </aside>

        {/* Editor com rolagem natural da página para preservar a navegação a erros do construtor. */}
        <div className="min-w-0 flex-1">
          <CreatureBuilderPanel
            mode={isCreating ? 'create' : isEditing ? 'edit' : 'list'}
            creature={selectedCreature}
            onSave={handleSave}
            onCancel={handleCancel}
            onEdit={handleEdit}
            onDirtyChange={setBuilderDirty}
          />
        </div>
      </div>
    </div>
  );
}

export default GrimorioModule;
