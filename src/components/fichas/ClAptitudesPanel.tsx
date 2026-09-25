import { useState, useMemo } from 'react';
import { Brain, Lock, Plus, X, ChevronDown, ChevronUp, AlertTriangle, Zap } from 'lucide-react';
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
  /** Quando true, exibe SOMENTE o catálogo (esconde header e adquiridas). */
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

/**
 * Consolida overrides do upgrade no objeto base, retornando uma cópia
 * imutável com os campos sobrepostos. Não muta nem a base nem o upgrade.
 */
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

export function ClAptitudesPanel({
  character: c,
  catalogOpen,
  onCatalogOpenChange,
  defaultCatalogOpen = false,
  editMode = false,
  catalogOnly = false,
}: Props) {
  const chooseClAptitude = useCharacterStore(s => s.chooseClAptitude);
  const removeClAptitude = useCharacterStore(s => s.removeClAptitude);
  const activateClAptitude = useCharacterStore(s => s.activateClAptitude);
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
  const clLevel = apts.CL;
  const chosen = c.chosenClAptitudes ?? [];
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

  // Filtra catálogo apenas family === 'CL'.
  const catalog = useMemo(() => AURA_APTITUDES.filter(a => a.family === 'CL'), []);

  // Lista de aptidões adquiridas, consolidando upgrades:
  // se o jogador possui um upgrade de X, esconde X e mostra só o tier mais alto.
  const ownedDisplay = useMemo(() => {
    const ownedSet = new Set(chosen);
    // Mapa: idBase -> upgrade mais alto possuído
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
      addLog('system', `${c.name}: adquiriu Aptidão CL — ${apt?.name ?? id}`);
    } else {
      playErrorSound();
      addLog('system', `${c.name}: falhou ao adquirir CL ${id} — ${r.reason ?? '—'}`);
    }
  };

  const handleRemove = (id: string) => {
    playClickSound();
    removeClAptitude(c.id, id);
    const apt = getAuraAptitudeById(id);
    addLog('system', `${c.name}: removeu Aptidão CL — ${apt?.name ?? id}`);
  };

  const handleActivate = async (id: string) => {
    const apt = getAuraAptitudeById(id);
    if (!apt) return;
    // Coleta parâmetros conforme a aptidão (UI mínima via prompt).
    const params: Parameters<typeof activateClAptitude>[2] = {};
    const askPe = (label: string, def = '1') => {
      const v = window.prompt(`${apt.name} — ${label}`, def);
      if (v === null) return null;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    };
    const askCD = () => {
      const v = window.prompt(`${apt.name} — CD Amaldiçoada do alvo?`, '15');
      if (v === null) return null;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    };

    if (id === 'cl-expandir-aura') {
      params.sustain = window.confirm('Manter Expandir Aura por mais uma rodada? (OK = manter / Cancelar = ativar do zero)');
    } else if (id === 'cl-projecao-dividida') {
      const o = askPe('PE gasto na projeção ORIGINAL?'); if (o === null) return;
      const d = askPe('PE gasto na DUPLICATA (≤ metade)?'); if (d === null) return;
      params.peOriginal = o; params.peDuplicata = d;
    } else if (id === 'cl-leitura-de-aura' || id === 'cl-leitura-rapida-de-energia') {
      const cd = askCD(); if (cd === null) return;
      params.cdAmaldicoada = cd;
    } else if (id === 'cl-rastreio-avancado') {
      const known = window.confirm('Você JÁ conhece a origem dos vestígios? (OK = sim / Cancelar = não)');
      if (known) {
        params.alreadyKnown = true;
      } else {
        const skill = window.prompt('Perícia: Investigação | Percepção', 'Investigação');
        if (!skill) return;
        const cd = askCD(); if (cd === null) return;
        params.rastreioSkill = skill.trim().toLowerCase().startsWith('per') ? 'Percepção' : 'Investigação';
        params.cdAmaldicoada = cd;
      }
    } else if (id === 'cl-emocao-da-petala-decadente') {
      const off = window.confirm('Uso OFENSIVO (5 PE → ataque garantido corpo-a-corpo)? OK = sim / Cancelar = uso defensivo (manual)');
      if (!off) {
        addLog('system', `${c.name}: Pétala Decadente defensiva é manual — debite PE = Nível DOM do atacante manualmente.`);
        return;
      }
      params.petalaMode = 'ofensiva';
    } else if (id.startsWith('cl-estimulo-muscular')) {
      const sub = window.prompt('Sub-modo: movimento | teste | manobra | pular', 'movimento');
      if (!sub) return;
      params.submodo = sub.trim().toLowerCase() as 'movimento' | 'teste' | 'manobra' | 'pular';
      const pe = askPe('Quantos PE gastar?'); if (pe === null) return;
      params.peSpent = pe;
    } else if (id.startsWith('cl-projetar-energia') || id.startsWith('cl-projecao')) {
      const pe = askPe('Quantos PE gastar?'); if (pe === null) return;
      const r = window.prompt('Resolução: attack | save', 'attack');
      if (!r) return;
      params.peSpent = pe;
      params.resolution = r.trim().toLowerCase() === 'save' ? 'save' : 'attack';
    } else if (id === 'cl-punho-divergente') {
      const pendente = (c.omniFlags ?? {}).punho_divergente_dano_pendente ?? 0;
      if (pendente > 0) {
        const fort = window.prompt(`Punho Divergente — RESOLVER pendência (${pendente} de dano restante).\nBônus de Fortitude do ALVO?`, '0');
        if (fort === null) return;
        const f = parseInt(fort, 10);
        if (!Number.isFinite(f)) return;
        params.punhoModo = 'resolver';
        params.fortitudeAlvo = f;
      } else {
        const dano = window.prompt('Punho Divergente — ARMAR. Dano TOTAL do golpe desarmado já rolado?', '10');
        if (dano === null) return;
        const d = parseInt(dano, 10);
        if (!Number.isFinite(d) || d <= 0) return;
        params.punhoModo = 'armar';
        params.danoTotal = d;
      }
    } else {
      const pe = askPe('Quantos PE gastar?'); if (pe === null) return;
      params.peSpent = pe;
    }

    const r = await activateClAptitude(c.id, id, params);
    if (r.ok) {
      playSuccessSound();
      addLog('system', r.logMessage ?? `${c.name}: ativou ${apt.name}.`);
    } else {
      playErrorSound();
      addLog('system', `${c.name}: falhou ao ativar ${apt.name} — ${r.reason ?? '—'}`);
    }
  };

  return (
    <div className="space-y-2">
      {!catalogOnly && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Aptidões de CL
            </span>
            <span className="text-xs text-muted-foreground">CL {clLevel}/5</span>
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
          Nenhuma aptidão de CL adquirida.
        </div>
      ) : (
        <div className="space-y-1">
          {ownedDisplay.map(apt => {
            const isOpen = expandedId === apt.id;
            const peCost = resolveFixedPeCost(apt.peCost);
            const isVariablePE = apt.peCost === 'variable';
            const pending = apt.engineSupport === 'pending';
            const manual = apt.engineSupport === 'manual';
            return (
              <div
                key={apt.id}
                className="rounded-md border border-border bg-secondary/20 overflow-hidden"
              >
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
                    {manual && (
                      <span className="text-xs uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold">
                        Manual
                      </span>
                    )}
                  </button>
                  {apt.engineSupport === 'live' && (
                    <button
                      onClick={() => handleActivate(apt.id)}
                      className="text-xs px-2 py-0.5 rounded bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 flex items-center gap-1"
                      title="Ativar aptidão (debita PE e aplica efeitos)"
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
                    {manual && (
                      <div className="text-xs text-sky-400/80 italic">
                        ℹ Aptidão de administração manual — efeito legítimo, mas o jogador aplica
                        à mão (passiva narrativa, escolha única ou gatilho fora dos painéis ativos).
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
        <div className="mt-2 space-y-1 border-t border-border pt-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground px-1">
            Catálogo CL ({catalog.length} disponíveis · {c.availableAuraChoices ?? 0} pontos)
          </div>
          {catalog.map(apt => {
            const owned = chosen.includes(apt.id);
            const gate = checkAuraGate(apt, ctx);
            const canAdd = !owned && gate.ok && (c.availableAuraChoices ?? 0) > 0;
            return (
              <div
                key={apt.id}
                className={cn(
                  'rounded-md border px-2 py-1.5 flex items-center gap-2',
                  owned ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/10',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground">{apt.name}</span>
                    {apt.engineSupport === 'pending' && (
                      <span className="text-xs text-amber-400">Motor Pendente</span>
                    )}
                    {apt.engineSupport === 'manual' && (
                      <span className="text-xs text-sky-400">Manual</span>
                    )}
                    {apt.upgradesId && (
                      <span className="text-xs text-muted-foreground">
                        ↑ {getAuraAptitudeById(apt.upgradesId)?.name ?? apt.upgradesId}
                      </span>
                    )}
                  </div>
                  {apt.prerequisitesText && (
                    <div className="text-xs text-muted-foreground">
                      Pré-req: {apt.prerequisitesText}
                    </div>
                  )}
                  {!gate.ok && (
                    <div className="text-xs text-destructive flex items-center gap-1">
                      <Lock className="h-2.5 w-2.5" />
                      {gate.reasons.join('; ')}
                    </div>
                  )}
                </div>
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
            );
          })}
          {catalog.length === 0 && (
            <div className="text-xs text-muted-foreground italic px-1">
              Catálogo CL ainda vazio (aguardando catalogação nas Partes 3–5).
            </div>
          )}
        </div>
      )}

      {/* Ref vazia para evitar warning de variável não usada quando trainingBonus for futuramente removido. */}
      <span className="hidden">{trainingBonus}</span>
    </div>
  );
}
