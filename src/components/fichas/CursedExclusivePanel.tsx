import { useState, useMemo } from 'react';
import { Skull, Lock, Plus, X, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import type { Character } from '@/types';
import { createDefaultCursedAptitudes } from '@/types';
import {
  AURA_APTITUDES,
  getAuraAptitudeById,
  checkAuraGate,
  resolveFixedPeCost,
  type AuraAptitude,
  type CursedExclusiveSubfamily,
} from '@/lib/auraAptitudes';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { cn } from '@/lib/utils';
import { playClickSound, playSuccessSound, playErrorSound } from '@/lib/sounds';

interface Props {
  character: Character;
  catalogOpen?: boolean;
  onCatalogOpenChange?: (open: boolean) => void;
  defaultCatalogOpen?: boolean;
  editMode?: boolean;
  catalogOnly?: boolean;
}

const ATTR_SHORT: Record<string, string> = {
  'Força': 'FOR', 'Destreza': 'DES', 'Constituição': 'CON',
  'Inteligência': 'INT', 'Sabedoria': 'SAB', 'Presença': 'PRE',
};

const ACTIVATION_LABEL: Record<AuraAptitude['activation'], string> = {
  passive: 'Passiva',
  reaction: 'Reação',
  bonus: 'Ação Bônus',
  action: 'Ação Comum',
  free: 'Ação Livre',
  toggle: 'Liga/Desliga',
  trigger: 'Gatilho',
};

const SUBFAMILY_LABEL: Record<CursedExclusiveSubfamily, string> = {
  anatomy: 'Anatomia',
  control: 'Controle e Leitura',
  special: 'Especiais',
};
const SUBFAMILY_ORDER: CursedExclusiveSubfamily[] = ['anatomy', 'control', 'special'];

export function CursedExclusivePanel({
  character: c,
  catalogOpen,
  onCatalogOpenChange,
  defaultCatalogOpen = false,
  editMode = false,
  catalogOnly = false,
}: Props) {
  const chooseClAptitude = useCharacterStore(s => s.chooseClAptitude);
  const removeClAptitude = useCharacterStore(s => s.removeClAptitude);
  const addLog = useLogStore(s => s.addLog);

  const isControlled = catalogOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultCatalogOpen);
  const showCatalog = isControlled ? !!catalogOpen : internalOpen;
  const setShowCatalog = (next: boolean | ((p: boolean) => boolean)) => {
    const value = typeof next === 'function' ? (next as (p: boolean) => boolean)(showCatalog) : next;
    if (isControlled) onCatalogOpenChange?.(value);
    else setInternalOpen(value);
  };
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const apts = { ...createDefaultCursedAptitudes(), ...(c.cursedAptitudes ?? {}) };
  const chosen = (c.chosenClAptitudes ?? []).filter(id => getAuraAptitudeById(id)?.family === 'CURSED');
  const ownedCount = chosen.length;
  void getTrainingBonusByLevel(c.level); // mantém import; reservado para futuras lógicas

  const ctx = useMemo(() => {
    const attrs: Partial<Record<'FOR' | 'DES' | 'CON' | 'INT' | 'PRE' | 'SAB', number>> = {};
    (c.attributes ?? []).forEach(a => {
      const k = ATTR_SHORT[a.name];
      if (k) (attrs as Record<string, number>)[k] = a.value;
    });
    return {
      level: c.level,
      auLevel: apts.AU,
      clLevel: apts.CL,
      barLevel: apts.BAR,
      domLevel: apts.DOM,
      erLevel: apts.ER,
      attrs,
      trainedSkills: (c.skills ?? []).filter(s => s.trained || s.mastery).map(s => s.name),
      masterySkills: (c.skills ?? []).filter(s => s.mastery).map(s => s.name),
      chosenAuraIds: c.chosenAuraAptitudes ?? [],
      chosenAptitudeIds: [...(c.chosenAuraAptitudes ?? []), ...(c.chosenClAptitudes ?? [])],
      clanId: c.clanId,
    };
  }, [c, apts]);

  const catalog = useMemo(() => AURA_APTITUDES.filter(a => a.family === 'CURSED'), []);

  const ownedDisplay = useMemo(() => {
    const ownedSet = new Set(chosen);
    const hiddenBases = new Set<string>();
    for (const id of chosen) {
      const apt = getAuraAptitudeById(id);
      if (apt?.upgradesId && ownedSet.has(apt.upgradesId)) {
        hiddenBases.add(apt.upgradesId);
      }
    }
    return chosen
      .map(id => getAuraAptitudeById(id))
      .filter((a): a is AuraAptitude => !!a && !hiddenBases.has(a.id));
  }, [chosen]);

  const handleAdd = (id: string) => {
    const r = chooseClAptitude(c.id, id);
    if (r.ok) {
      playSuccessSound();
      const apt = getAuraAptitudeById(id);
      addLog('system', `${c.name}: adquiriu Aptidão Amaldiçoada Exclusiva — ${apt?.name ?? id}`);
    } else {
      playErrorSound();
      addLog('system', `${c.name}: falhou ao adquirir CURSED ${id} — ${r.reason ?? '—'}`);
    }
  };

  const handleRemove = (id: string) => {
    playClickSound();
    removeClAptitude(c.id, id);
    const apt = getAuraAptitudeById(id);
    addLog('system', `${c.name}: removeu Aptidão Amaldiçoada — ${apt?.name ?? id}`);
  };

  const groupedCatalog = useMemo(() => {
    const map: Record<CursedExclusiveSubfamily, AuraAptitude[]> = { anatomy: [], control: [], special: [] };
    for (const a of catalog) {
      const sf = (a.subfamily ?? 'special') as CursedExclusiveSubfamily;
      map[sf].push(a);
    }
    return map;
  }, [catalog]);

  return (
    <div className="space-y-2">
      {!catalogOnly && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skull className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Aptidões Amaldiçoadas Exclusivas
            </span>
            <span className="text-xs text-muted-foreground">{ownedCount} adquirida(s)</span>
          </div>
          <button
            onClick={() => { playClickSound(); setShowCatalog(p => !p); }}
            className="text-xs px-2 py-1 rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
          >
            {showCatalog ? 'Fechar catálogo' : 'Abrir catálogo'}
          </button>
        </div>
      )}

      {!catalogOnly && (ownedDisplay.length === 0 ? (
        <div className="text-xs text-muted-foreground italic px-1">
          Nenhuma aptidão amaldiçoada exclusiva adquirida.
        </div>
      ) : (
        <div className="space-y-1">
          {ownedDisplay.map(apt => {
            const isOpen = expandedId === apt.id;
            const peCost = resolveFixedPeCost(apt.peCost);
            const isVariablePE = apt.peCost === 'variable';
            const pending = apt.engineSupport === 'pending';
            return (
              <div key={apt.id} className="rounded-md border border-border bg-secondary/20 overflow-hidden">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <button
                    onClick={() => setExpandedId(isOpen ? null : apt.id)}
                    className="flex-1 flex items-center gap-2 text-left"
                  >
                    {isOpen
                      ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                      : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                    <span className="text-xs font-bold text-foreground">{apt.name}</span>
                    {apt.subfamily && (
                      <span className="text-xs uppercase tracking-wider text-muted-foreground/80 px-1.5 py-0.5 rounded bg-muted/40">
                        {SUBFAMILY_LABEL[apt.subfamily]}
                      </span>
                    )}
                    <span className="text-xs uppercase tracking-wider text-primary/80 px-1.5 py-0.5 rounded bg-primary/10">
                      {ACTIVATION_LABEL[apt.activation]}
                    </span>
                    {isVariablePE && (
                      <span className="text-xs text-amber-400">
                        PE var.{apt.peLimitFormula ? ` (≤ ${apt.peLimitFormula})` : ''}
                      </span>
                    )}
                    {!isVariablePE && peCost > 0 && (
                      <span className="text-xs text-amber-400">{peCost} PE</span>
                    )}
                    {pending && (
                      <span className="text-xs uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Manual
                      </span>
                    )}
                  </button>
                  {editMode && (
                    <button
                      onClick={() => handleRemove(apt.id)}
                      className="text-destructive hover:bg-destructive/10 rounded p-1"
                      title="Remover"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div className="px-3 pb-2 space-y-1 border-t border-border/40">
                    <div className="text-xs italic text-muted-foreground pt-2">{apt.flavor}</div>
                    <div className="text-xs text-foreground whitespace-pre-line">{apt.mechanic}</div>
                    {apt.triggerText && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-bold text-primary/80">Uso:</span> {apt.triggerText}
                      </div>
                    )}
                    {apt.logicText && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-bold text-primary/80">Lógica:</span> {apt.logicText}
                      </div>
                    )}
                    {pending && (
                      <div className="text-xs text-amber-400/80 italic">
                        ⚠ Esta aptidão exige aplicação manual no momento (efeito ativo / escolha de jogador).
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {(showCatalog || catalogOnly) && (
        <div className="mt-2 space-y-3 border-t border-border pt-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground px-1">
            Catálogo CURSED ({catalog.length} disponíveis · {c.availableAuraChoices ?? 0} pontos)
          </div>
          {SUBFAMILY_ORDER.map(sf => {
            const list = groupedCatalog[sf];
            if (!list.length) return null;
            return (
              <div key={sf} className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-primary/80 px-1">
                  {SUBFAMILY_LABEL[sf]}
                </div>
                {list.map(apt => {
                  const owned = chosen.includes(apt.id);
                  const gate = checkAuraGate(apt, ctx);
                  const canAdd = !owned && gate.ok && (c.availableAuraChoices ?? 0) > 0;
                  const catalogId = `cat-${apt.id}`;
                  const isCatOpen = expandedId === catalogId;
                  const peCost = resolveFixedPeCost(apt.peCost);
                  const isVariablePE = apt.peCost === 'variable';
                  return (
                    <div
                      key={apt.id}
                      className={cn(
                        'rounded-md border overflow-hidden',
                        owned ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/10',
                      )}
                    >
                      <div className="px-2 py-1.5 flex items-center gap-2">
                        <button
                          onClick={() => setExpandedId(isCatOpen ? null : catalogId)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            {isCatOpen
                              ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                              : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                            <span className="text-xs font-bold text-foreground">{apt.name}</span>
                            <span className="text-xs uppercase tracking-wider text-primary/80 px-1.5 py-0.5 rounded bg-primary/10">
                              {ACTIVATION_LABEL[apt.activation]}
                            </span>
                            {isVariablePE && (
                              <span className="text-xs text-amber-400">PE var.</span>
                            )}
                            {!isVariablePE && peCost > 0 && (
                              <span className="text-xs text-amber-400">{peCost} PE</span>
                            )}
                            {apt.engineSupport === 'pending' && (
                              <span className="text-xs text-amber-400">Manual</span>
                            )}
                            {apt.upgradesId && (
                              <span className="text-xs text-muted-foreground">
                                ↑ {getAuraAptitudeById(apt.upgradesId)?.name ?? apt.upgradesId}
                              </span>
                            )}
                          </div>
                          {apt.prerequisitesText && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Pré-req: {apt.prerequisitesText}
                            </div>
                          )}
                          {!gate.ok && (
                            <div className="text-xs text-destructive flex items-center gap-1">
                              <Lock className="h-2.5 w-2.5" />
                              {gate.reasons.join('; ')}
                            </div>
                          )}
                        </button>
                        {owned ? (
                          <span className="text-xs uppercase tracking-wider text-primary font-bold">
                            Adquirida
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAdd(apt.id)}
                            disabled={!canAdd}
                            className={cn(
                              'text-xs px-2 py-1 rounded flex items-center gap-1',
                              canAdd
                                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                : 'bg-muted text-muted-foreground cursor-not-allowed',
                            )}
                          >
                            <Plus className="h-2.5 w-2.5" />
                            Adquirir
                          </button>
                        )}
                      </div>
                      {isCatOpen && (
                        <div className="px-3 pb-2 space-y-1 border-t border-border/40">
                          {apt.flavor && (
                            <div className="text-xs italic text-muted-foreground pt-2">{apt.flavor}</div>
                          )}
                          {apt.mechanic && (
                            <div className="text-xs text-foreground whitespace-pre-line">{apt.mechanic}</div>
                          )}
                          {apt.triggerText && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-bold text-primary/80">Uso:</span> {apt.triggerText}
                            </div>
                          )}
                          {apt.logicText && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-bold text-primary/80">Lógica:</span> {apt.logicText}
                            </div>
                          )}
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
