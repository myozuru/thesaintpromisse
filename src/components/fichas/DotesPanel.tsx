import { useState, useMemo } from 'react';
import { Star, Plus, X, ChevronDown, ChevronUp, Zap, RotateCcw, Sparkles, Power } from 'lucide-react';
import type { Character } from '@/types';
import {
  DOTES_GERAIS,
  DOTE_BY_ID,
  DOTE_CATEGORY_LABEL,
  DOTE_ACTIVATION_LABEL,
  DOTE_RESET_LABEL,
  type Dote,
  type DoteCategory,
} from '@/lib/dotes';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { cn } from '@/lib/utils';
import { playClickSound, playSuccessSound, playErrorSound } from '@/lib/sounds';

interface Props {
  character: Character;
  editMode?: boolean;
  catalogOpen?: boolean;
  onCatalogOpenChange?: (open: boolean) => void;
  catalogOnly?: boolean;
}

const CATEGORY_ORDER: DoteCategory[] = [
  'combate',
  'feiticaria',
  'sentidos',
  'social',
  'utilitario',
  'sorte',
];

export function DotesPanel({
  character: c,
  editMode = false,
  catalogOpen,
  onCatalogOpenChange,
  catalogOnly = false,
}: Props) {
  const addDote = useCharacterStore((s) => s.addDote);
  const removeDote = useCharacterStore((s) => s.removeDote);
  const useDote = useCharacterStore((s) => s.useDote);
  const toggleDote = useCharacterStore((s) => s.toggleDote);
  const resetDoteUsage = useCharacterStore((s) => s.resetDoteUsage);
  const spendLuckyPoint = useCharacterStore((s) => s.spendLuckyPoint);
  const restoreLuckyPoint = useCharacterStore((s) => s.restoreLuckyPoint);
  const addLog = useLogStore((s) => s.addLog);

  const isControlled = catalogOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const showCatalog = isControlled ? !!catalogOpen : internalOpen;
  const setShowCatalog = (next: boolean) => {
    if (isControlled) onCatalogOpenChange?.(next);
    else setInternalOpen(next);
  };
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [variablePeInput, setVariablePeInput] = useState<Record<string, number>>({});

  const owned = c.chosenDotes ?? [];
  const ownedDisplay = useMemo(
    () => owned.map((id) => DOTE_BY_ID[id]).filter((d): d is Dote => !!d),
    [owned],
  );

  const groupedCatalog = useMemo(() => {
    const map: Record<DoteCategory, Dote[]> = {
      combate: [], feiticaria: [], sentidos: [], social: [], utilitario: [], sorte: [],
    };
    for (const d of DOTES_GERAIS) map[d.category].push(d);
    return map;
  }, []);

  const handleAdd = (id: string) => {
    const r = addDote(c.id, id);
    if (r.ok) {
      playSuccessSound();
      addLog('system', `${c.name}: adquiriu o dote — ${DOTE_BY_ID[id]?.nome ?? id}`);
    } else {
      playErrorSound();
      addLog('system', `${c.name}: falhou ao adquirir dote ${id} — ${r.reason ?? '—'}`);
    }
  };

  const handleRemove = (id: string) => {
    playClickSound();
    removeDote(c.id, id);
    addLog('system', `${c.name}: removeu o dote — ${DOTE_BY_ID[id]?.nome ?? id}`);
  };

  const handleUse = (d: Dote) => {
    const peSpent = typeof d.peCost === 'number'
      ? d.peCost
      : d.peCost === 'variable' ? (variablePeInput[d.id] ?? 0) : 0;
    const r = useDote(c.id, d.id, { peSpent });
    if (r.ok) {
      playSuccessSound();
      const peNote = peSpent > 0 ? ` (gastou ${peSpent} PE)` : '';
      addLog('system', `${c.name}: usou ${d.nome}${peNote}.`);
    } else {
      playErrorSound();
      addLog('system', `${c.name}: falhou ao usar ${d.nome} — ${r.reason ?? '—'}`);
    }
  };

  const handleToggle = (d: Dote) => {
    playClickSound();
    toggleDote(c.id, d.id);
    const next = !((c.doteToggles ?? {})[d.id] ?? false);
    addLog('system', `${c.name}: ${next ? 'ativou' : 'desativou'} ${d.nome}.`);
  };

  const handleSpendLucky = () => {
    const r = spendLuckyPoint(c.id);
    if (r.ok) {
      playSuccessSound();
      addLog('roll', `${c.name}: gastou 1 ponto de Sorte (re-roll d20).`);
    } else {
      playErrorSound();
    }
  };

  const handleRestoreLucky = () => {
    playClickSound();
    restoreLuckyPoint(c.id);
    addLog('system', `${c.name}: recuperou 1 ponto de Sorte.`);
  };

  const handleResetScope = (scope: 'rodada' | 'cena' | 'descanso-curto' | 'descanso-longo') => {
    playClickSound();
    resetDoteUsage(c.id, scope);
    addLog('system', `${c.name}: dotes resetados (${scope}).`);
  };

  return (
    <div className="space-y-2">
      {!catalogOnly && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Star className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Dotes Gerais
            </span>
            <span className="text-xs text-muted-foreground">{ownedDisplay.length} adquirido(s)</span>
          </div>
          <div className="flex items-center gap-1">
            {editMode && (
              <>
                <button onClick={() => handleResetScope('rodada')} className="text-xs px-2 py-1 rounded border border-border bg-secondary/30 hover:bg-secondary/50" title="Reset usos por rodada">
                  <RotateCcw className="h-3 w-3 inline" /> Rd
                </button>
                <button onClick={() => handleResetScope('descanso-longo')} className="text-xs px-2 py-1 rounded border border-border bg-secondary/30 hover:bg-secondary/50" title="Descanso longo">
                  <RotateCcw className="h-3 w-3 inline" /> DL
                </button>
              </>
            )}
            <button
              onClick={() => { playClickSound(); setShowCatalog(!showCatalog); }}
              className="text-xs px-2 py-1 rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary"
            >
              {showCatalog ? 'Fechar catálogo' : 'Abrir catálogo'}
            </button>
          </div>
        </div>
      )}

      {/* Recurso: Pontos de Sorte */}
      {!catalogOnly && c.luckyPoints && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-bold text-amber-300">Pontos de Sorte</span>
            <span className="text-xs text-amber-200">
              {c.luckyPoints.current} / {c.luckyPoints.max}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleSpendLucky}
              disabled={c.luckyPoints.current <= 0}
              className="text-xs px-2 py-1 rounded bg-amber-600/80 text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Gastar (re-roll)
            </button>
            <button
              onClick={handleRestoreLucky}
              disabled={c.luckyPoints.current >= c.luckyPoints.max}
              className="text-xs px-2 py-1 rounded border border-amber-500/40 hover:bg-amber-500/20 disabled:opacity-40"
              title="Recuperar 1 (ex.: crítico contra)"
            >
              +1
            </button>
          </div>
        </div>
      )}

      {/* Lista de adquiridos */}
      {!catalogOnly && (ownedDisplay.length === 0 ? (
        <div className="text-xs text-muted-foreground italic px-1">
          Nenhum dote adquirido. Abra o catálogo para escolher.
        </div>
      ) : (
        <div className="space-y-1">
          {ownedDisplay.map((d) => {
            const isOpen = expandedId === d.id;
            const used = (c.doteUsage ?? {})[d.id] ?? 0;
            const left = d.uses ? Math.max(0, d.uses.max - used) : null;
            const toggled = (c.doteToggles ?? {})[d.id] ?? false;
            const peFixed = typeof d.peCost === 'number' ? d.peCost : 0;
            const peVar = d.peCost === 'variable';
            return (
              <div key={d.id} className="rounded-md border border-border bg-secondary/20 overflow-hidden">
                <div className="flex items-center gap-2 px-2 py-1.5 flex-wrap">
                  <button
                    onClick={() => setExpandedId(isOpen ? null : d.id)}
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                  >
                    {isOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                    <span className="text-xs font-bold text-foreground">{d.nome}</span>
                    <span className="text-xs uppercase tracking-wider text-primary/80 px-1.5 py-0.5 rounded bg-primary/10">
                      {DOTE_ACTIVATION_LABEL[d.activation]}
                    </span>
                    {peFixed > 0 && <span className="text-xs text-amber-400">{peFixed} PE</span>}
                    {peVar && <span className="text-xs text-amber-400">PE var.</span>}
                    {d.uses && (
                      <span className="text-xs text-muted-foreground">
                        {left}/{d.uses.max} {DOTE_RESET_LABEL[d.uses.per]}
                      </span>
                    )}
                    {d.hasPassiveEffect && (
                      <span className="text-xs uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                        Auto
                      </span>
                    )}
                  </button>

                  {/* Ações rápidas */}
                  {d.activation === 'toggle' && (
                    <button
                      onClick={() => handleToggle(d)}
                      className={cn(
                        'text-xs px-2 py-1 rounded flex items-center gap-1',
                        toggled ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:bg-secondary',
                      )}
                    >
                      <Power className="h-3 w-3" />
                      {toggled ? 'Ativo' : 'Inativo'}
                    </button>
                  )}

                  {d.activation !== 'passive' && d.activation !== 'toggle' && d.id !== 'dote-abencoado-sorte' && (
                    <>
                      {peVar && (
                        <input
                          type="number"
                          min={0}
                          value={variablePeInput[d.id] ?? 0}
                          onChange={(e) => setVariablePeInput((p) => ({ ...p, [d.id]: Math.max(0, +e.target.value || 0) }))}
                          className="w-14 h-7 text-xs px-1 rounded border border-border bg-background"
                          title="PE a gastar"
                        />
                      )}
                      <button
                        onClick={() => handleUse(d)}
                        disabled={d.uses ? left! <= 0 : false}
                        className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        <Zap className="h-3 w-3" /> Usar
                      </button>
                    </>
                  )}

                  {editMode && (
                    <button
                      onClick={() => handleRemove(d.id)}
                      className="text-destructive hover:bg-destructive/10 rounded p-1"
                      title="Remover dote"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div className="px-3 pb-2 space-y-1 border-t border-border/40">
                    {d.short && (
                      <div className="text-xs italic text-emerald-300/80 pt-2">{d.short}</div>
                    )}
                    <div className="text-xs text-foreground whitespace-pre-line pt-1">{d.descricao}</div>
                    {d.prereq && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-bold text-primary/80">Pré-req:</span> {d.prereq}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Catálogo */}
      {(showCatalog || catalogOnly) && (
        <div className="mt-2 space-y-3 border-t border-border pt-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground px-1">
            Catálogo — {DOTES_GERAIS.length} dotes gerais (concedidos pelo Mestre)
          </div>
          {CATEGORY_ORDER.map((cat) => {
            const list = groupedCatalog[cat];
            if (!list.length) return null;
            return (
              <div key={cat} className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-primary/80 px-1">
                  {DOTE_CATEGORY_LABEL[cat]}
                </div>
                {list.map((d) => {
                  const isOwned = owned.includes(d.id);
                  const catalogId = `cat-${d.id}`;
                  const isCatOpen = expandedId === catalogId;
                  const peFixed = typeof d.peCost === 'number' ? d.peCost : 0;
                  const peVar = d.peCost === 'variable';
                  return (
                    <div
                      key={d.id}
                      className={cn(
                        'rounded-md border overflow-hidden',
                        isOwned ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/10',
                      )}
                    >
                      <div className="px-2 py-1.5 flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setExpandedId(isCatOpen ? null : catalogId)}
                          className="flex-1 min-w-0 text-left flex items-center gap-2 flex-wrap"
                        >
                          {isCatOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                          <span className="text-xs font-bold text-foreground">{d.nome}</span>
                          <span className="text-xs uppercase tracking-wider text-primary/80 px-1.5 py-0.5 rounded bg-primary/10">
                            {DOTE_ACTIVATION_LABEL[d.activation]}
                          </span>
                          {peFixed > 0 && <span className="text-xs text-amber-400">{peFixed} PE</span>}
                          {peVar && <span className="text-xs text-amber-400">PE var.</span>}
                          {d.hasPassiveEffect && (
                            <span className="text-xs uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                              Auto
                            </span>
                          )}
                          {d.prereq && (
                            <span className="text-xs text-muted-foreground">Pré-req: {d.prereq}</span>
                          )}
                        </button>
                        {isOwned ? (
                          <span className="text-xs uppercase tracking-wider text-primary font-bold">Adquirido</span>
                        ) : (
                          <button
                            onClick={() => handleAdd(d.id)}
                            className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1"
                          >
                            <Plus className="h-2.5 w-2.5" /> Adquirir
                          </button>
                        )}
                      </div>
                      {isCatOpen && (
                        <div className="px-3 pb-2 space-y-1 border-t border-border/40">
                          {d.short && (
                            <div className="text-xs italic text-emerald-300/80 pt-2">{d.short}</div>
                          )}
                          <div className="text-xs text-foreground whitespace-pre-line pt-1">{d.descricao}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
