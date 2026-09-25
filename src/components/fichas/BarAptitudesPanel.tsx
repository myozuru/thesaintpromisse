import { useState, useMemo } from 'react';
import { Shield, Lock, Plus, X, ChevronDown, ChevronUp, AlertTriangle, Zap } from 'lucide-react';
import type { Character } from '@/types';
import { createDefaultCursedAptitudes } from '@/types';
import {
  AURA_APTITUDES,
  getAuraAptitudeById,
  checkAuraGate,
  resolveFixedPeCost,
  type AuraAptitude,
  type CursedAptitudeOverrides,
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
  /**
   * Quando true, exibe SOMENTE o catálogo de compra (esconde o header da família
   * e a lista de aptidões já adquiridas). Usado pelo Catálogo Unificado.
   */
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

function consolidateUpgrade(base: AuraAptitude, upgrade: AuraAptitude): AuraAptitude {
  const o: CursedAptitudeOverrides = upgrade.overrides ?? {};
  return {
    ...base,
    id: upgrade.id,
    name: upgrade.name,
    flavor: upgrade.flavor,
    mechanic: upgrade.mechanic,
    prereqs: upgrade.prereqs,
    prerequisitesText: upgrade.prerequisitesText,
    activation: upgrade.activation,
    peCost: upgrade.peCost ?? base.peCost,
    peLimitFormula: o.peLimitFormula ?? upgrade.peLimitFormula ?? base.peLimitFormula,
    peUpkeep: upgrade.peUpkeep ?? base.peUpkeep,
    usage: upgrade.usage ?? base.usage,
    triggerText: o.triggerOverride ?? upgrade.triggerText ?? base.triggerText,
    logicText: upgrade.logicText ?? base.logicText,
    upgradesId: upgrade.upgradesId,
    overrides: upgrade.overrides,
    requiresConfig: upgrade.requiresConfig ?? base.requiresConfig,
    engineSupport: upgrade.engineSupport ?? base.engineSupport,
    family: upgrade.family ?? base.family,
  };
}

export function BarAptitudesPanel({
  character: c,
  catalogOpen,
  onCatalogOpenChange,
  defaultCatalogOpen = false,
  editMode = false,
  catalogOnly = false,
}: Props) {
  const chooseClAptitude = useCharacterStore(s => s.chooseClAptitude);
  const removeClAptitude = useCharacterStore(s => s.removeClAptitude);
  const activateBarAptitude = useCharacterStore(s => s.activateBarAptitude);
  const addLog = useLogStore(s => s.addLog);

  const handleActivate = (id: string) => {
    playClickSound();
    let params: Parameters<typeof activateBarAptitude>[2] = {};
    try {
      if (id === 'bar-tecnicas-de-barreira') {
        const s = prompt('Quantas paredes (1..6)?', '3');
        if (s === null) return;
        const n = parseInt(s, 10);
        if (isNaN(n) || n <= 0) { addLog('system', `${c.name}: nº de paredes inválido.`); playErrorSound(); return; }
        params = { paredes: n };
      } else if (id === 'bar-cortina') {
        const s = prompt('Área da Cortina em metros (1 PE / 4,5 m):', '9');
        if (s === null) return;
        const n = parseFloat(s);
        if (isNaN(n) || n <= 0) { addLog('system', `${c.name}: área inválida.`); playErrorSound(); return; }
        params = { areaM: n };
      }
      // bar-cesta-oca-de-vime: sem prompt (3 PE fixo).
    } catch { /* prompt indisponível */ }
    const r = activateBarAptitude(c.id, id, params);
    if (r.ok) {
      playSuccessSound();
      addLog('system', r.logMessage ?? `${c.name}: ativou BAR ${id}`);
    } else {
      playErrorSound();
      addLog('system', `${c.name}: falhou ao ativar BAR ${id} — ${r.reason ?? '—'}`);
    }
  };

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
  const barLevel = apts.BAR;
  const chosen = (c.chosenClAptitudes ?? []).filter(id => getAuraAptitudeById(id)?.family === 'BAR');
  const trainingBonus = getTrainingBonusByLevel(c.level);

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

  const catalog = useMemo(() => AURA_APTITUDES.filter(a => a.family === 'BAR'), []);

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
      .filter((a): a is AuraAptitude => !!a && !hiddenBases.has(a.id))
      .map(a => {
        if (a.upgradesId) {
          const base = getAuraAptitudeById(a.upgradesId);
          if (base) return consolidateUpgrade(base, a);
        }
        return a;
      });
  }, [chosen]);

  const handleAdd = (id: string) => {
    const r = chooseClAptitude(c.id, id);
    if (r.ok) {
      playSuccessSound();
      const apt = getAuraAptitudeById(id);
      addLog('system', `${c.name}: adquiriu Aptidão BAR — ${apt?.name ?? id}`);
    } else {
      playErrorSound();
      addLog('system', `${c.name}: falhou ao adquirir BAR ${id} — ${r.reason ?? '—'}`);
    }
  };

  const handleRemove = (id: string) => {
    playClickSound();
    removeClAptitude(c.id, id);
    const apt = getAuraAptitudeById(id);
    addLog('system', `${c.name}: removeu Aptidão BAR — ${apt?.name ?? id}`);
  };

  return (
    <div className="space-y-2">
      {!catalogOnly && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Aptidões de BAR
            </span>
            <span className="text-xs text-muted-foreground">BAR {barLevel}/5</span>
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
          Nenhuma aptidão de BAR adquirida.
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
                    {(apt.peUpkeep ?? 0) > 0 && (
                      <span className="text-xs text-amber-400/80">/{apt.peUpkeep}r</span>
                    )}
                    {pending && (
                      <span className="text-xs uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Motor Pendente
                      </span>
                    )}
                  </button>
                  {!pending && apt.activation !== 'passive' && (
                    <button
                      onClick={() => handleActivate(apt.id)}
                      className="text-xs px-2 py-1 rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary flex items-center gap-1 transition-colors"
                      title="Ativar aptidão BAR"
                    >
                      <Zap className="h-3 w-3" />
                      Ativar
                    </button>
                  )}
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
                    <div className="text-xs italic text-muted-foreground pt-2">
                      {apt.flavor}
                    </div>
                    <div className="text-xs text-foreground whitespace-pre-line">
                      {apt.mechanic}
                    </div>
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
                    {apt.overrides?.additionalEffects && apt.overrides.additionalEffects.length > 0 && (
                      <ul className="text-xs text-muted-foreground list-disc pl-4">
                        {apt.overrides.additionalEffects.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    )}
                    {pending && (
                      <div className="text-xs text-amber-400/80 italic">
                        ⚠ Esta aptidão ainda não tem suporte automatizado no motor de regras.
                        Aplique manualmente os efeitos descritos acima.
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
        <div className="mt-2 space-y-1 border-t border-border pt-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground px-1">
            Catálogo BAR ({catalog.length} disponíveis · {c.availableAuraChoices ?? 0} pontos)
          </div>
          {catalog.map(apt => {
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
                        <span className="text-xs text-amber-400">Motor Pendente</span>
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
                      <div className="text-xs italic text-muted-foreground pt-2">
                        {apt.flavor}
                      </div>
                    )}
                    {apt.mechanic && (
                      <div className="text-xs text-foreground whitespace-pre-line">
                        {apt.mechanic}
                      </div>
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
      )}

      <span className="hidden">{trainingBonus}</span>
    </div>
  );
}