import { useState } from 'react';
import { Plus, Pencil, Trash2, Copy, Skull, Send, CheckCircle2 } from 'lucide-react';
// @ts-ignore - JS module
import useCreatureStorage from './useCreatureStorage';
// @ts-ignore - JSX module
import CreatureBuilder from './CreatureBuilder';
import { importCreatureToFichas } from './convertToFicha';
import { toast } from 'sonner';
import { useCharacterStore } from '@/stores/useCharacterStore';

type View = { name: 'list' } | { name: 'builder'; creatureId: string | null };

export function GrimorioModule() {
  const storage: any = useCreatureStorage();
  const [view, setView] = useState<View>({ name: 'list' });
  // Subscribe to characters so the "ligada" badge re-renders após import.
  const characterIds = useCharacterStore((s) => s.characters.map((c) => c.id).join(','));

  const activeCreature = view.name === 'builder' && view.creatureId
    ? storage.creatures.find((c: any) => c.id === view.creatureId) ?? null
    : null;

  const sendToFichas = (creature: any) => {
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
  };

  const isLinked = (creature: any) => {
    if (!creature.linkedFichaId) return false;
    return useCharacterStore.getState().characters.some((c) => c.id === creature.linkedFichaId);
  };
  // referência para silenciar warning de variável não usada (subscribe apenas)
  void characterIds;


  if (view.name === 'builder') {
    return (
      <div className="min-h-[calc(100vh-8rem)]">
        <CreatureBuilder
          existingCreature={activeCreature}
          onSave={(data: any) => {
            if (data.id && storage.creatures.find((c: any) => c.id === data.id)) {
              storage.update(data.id, data);
            } else {
              storage.create(data);
            }
            setView({ name: 'list' });
          }}
          onCancel={() => setView({ name: 'list' })}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-2 sm:p-4">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Skull className="h-5 w-5 text-primary" />
          <h1
            className="text-xl font-bold tracking-[0.15em] text-gradient-mystic"
            style={{ fontFamily: "'Cinzel Decorative', serif" }}
          >
            Grimório de Inimigos
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setView({ name: 'builder', creatureId: null })}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-3 py-1.5 text-sm font-semibold text-primary border border-primary/40 hover:bg-primary/25 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Criatura
        </button>
      </div>

      {storage.creatures.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
          Nenhuma criatura criada ainda.<br />
          Clique em <strong>Nova Criatura</strong> para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {storage.creatures.map((c: any) => (
            <div
              key={c.id}
              className="group rounded-md border border-border/60 bg-card/70 p-3 shadow-sm hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                    {c.name || 'Sem nome'}
                    {isLinked(c) && (
                      <span
                        title="Ficha vinculada"
                        className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1 py-0.5 text-xs font-medium text-emerald-400"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Ficha
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {c.core?.patamar ? `Patamar ${c.core.patamar}` : null}
                    {c.core?.nd ? ` · ND ${c.core.nd}` : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    title={isLinked(c) ? 'Atualizar Ficha vinculada' : 'Enviar para Fichas'}
                    onClick={() => sendToFichas(c)}
                    className="rounded p-1 text-muted-foreground hover:bg-primary/15 hover:text-primary"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Editar"
                    onClick={() => setView({ name: 'builder', creatureId: c.id })}
                    className="rounded p-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Duplicar"
                    onClick={() => storage.duplicate(c.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Apagar"
                    onClick={() => {
                      if (confirm(`Apagar "${c.identity?.name || c.name || 'criatura'}"?`)) {
                        storage.remove(c.id);
                      }
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GrimorioModule;
