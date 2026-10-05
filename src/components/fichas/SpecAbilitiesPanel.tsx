import { useState, useMemo } from 'react';
import { Plus, X, Sparkles, ChevronDown, BookOpen, Lock, Zap, Shield, Hand, Activity, Power, Dices, Award, HelpCircle, AlertCircle, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { playClickSound, playSuccessSound, playErrorSound } from '@/lib/sounds';
import { rollDiceCom } from '@/lib/dice';
import { LUTADOR_PASSIVE_TAG, EMPOLGACAO_BASE, EMPOLGACAO_MAXIMA, formatEmpolgacaoDie, LUTADOR_MANEUVER_DETAILS, type EmpolgacaoTable, type LutadorManeuver } from '@/lib/lutadorProgression';
import {
  getSpecAbilitiesFor,
  getSpecAbilityById,
  resolveUsageMax,
  ACTIVATION_LABEL,
  USAGE_SCOPE_LABEL,
  type SpecAbility,
  type SpecAbilityActivation,
} from '@/lib/specAbilities';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { getTalentById, resolveTalentUsageMax, type Talent } from '@/lib/talents';
import { TalentCatalogModal } from './TalentCatalogModal';
import { SpecAbilityChoiceDialog } from './SpecAbilityChoiceDialog';
import { ConhecimentoAplicadoDialog } from './ConhecimentoAplicadoDialog';
import { TalentOptionsDialog, talentNeedsOptions, type TalentOptionsKind } from './TalentOptionsDialog';

interface Props {
  character: Character;
  /** Quando false, esconde botões de adquirir/remover (modo visualização). */
  editMode?: boolean;
}


const ACTIVATION_ICON: Record<SpecAbilityActivation, typeof Zap> = {
  passive: Shield,
  reaction: Zap,
  bonus: Hand,
  action: Activity,
  free: Hand,
  toggle: Power,
  trigger: Dices,
};

const ACTIVATION_COLOR: Record<SpecAbilityActivation, string> = {
  passive: 'border-muted-foreground/40 bg-muted/30 text-muted-foreground',
  reaction: 'border-blue-500/60 bg-blue-500/15 text-blue-400',
  bonus: 'border-amber-500/60 bg-amber-500/15 text-amber-400',
  action: 'border-primary/60 bg-primary/15 text-primary',
  free: 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400',
  toggle: 'border-purple-500/60 bg-purple-500/15 text-purple-400',
  trigger: 'border-pink-500/60 bg-pink-500/15 text-pink-400',
};

/**
 * Aba "Habilidades de Especialização".
 *
 * - Lista as habilidades já escolhidas (apenas o nome com badge de tier + tipo de ação).
 * - Clique no nome → expande o card com:
 *    • flavor + mechanic narrativos
 *    • bloco "Mecânica Técnica" (gatilho/lógica)
 *    • botão de ATIVAÇÃO específico (Reagir / Ativar / Toggle...) com custo de PE,
 *      contador de usos e rolagem de dados quando aplicável.
 * - Catálogo modal: filtra por nível, valida pré-requisitos.
 */
export function SpecAbilitiesPanel({ character: c, editMode = false }: Props) {
  const rollDice = (n: string) => rollDiceCom(c.id, n);
  const { chooseSpecAbility, removeSpecAbility, activateSpecAbility, chooseTalentFromPool, consumeTalentUse, applyEstudoAmaldicoado } = useCharacterStore();
  const addLog = useLogStore(s => s.addLog);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** ID da habilidade cujo modal de escolha permanente está aberto. */
  const [choiceForAbilityId, setChoiceForAbilityId] = useState<string | null>(null);
  const [conhecimentoOpen, setConhecimentoOpen] = useState(false);
  /** Talento selecionado aguardando escolha de opções no modal. */
  const [pendingTalentOptions, setPendingTalentOptions] = useState<{
    talentId: string;
    talentName: string;
    kind: TalentOptionsKind;
  } | null>(null);

  // 3 pools: exclusivo de Habilidade, exclusivo de Talento, e compartilhado.
  const skillOnly = c.availableSkillOnly ?? 0;
  const talentOnly = c.availableTalentOnly ?? 0;
  const shared = c.availableSpecAbilities ?? 0;
  const totalForSkill = skillOnly + shared;
  const totalForTalent = talentOnly + shared;
  const grandTotal = skillOnly + talentOnly + shared;
  const chosen = c.chosenSpecAbilities ?? [];
  const allForSpec = getSpecAbilitiesFor(c.specialization);

  // Passivas auto-injetadas pelo motor de classe (Lutador, etc.)
  const autoClassPassives = useMemo(() => {
    return (c.passives ?? []).filter((p: any) => p?.source === LUTADOR_PASSIVE_TAG);
  }, [c.passives]);

  // Manobras de Empolgação escolhidas (Lutador)
  const lutadorManeuvers = c.lutadorManeuvers ?? [];

  const chosenAbilities = useMemo(() => {
    return chosen
      .map(ch => {
        const ab = getSpecAbilityById(ch.abilityId);
        return ab ? { ability: ab, chosenAtLevel: ch.chosenAtLevel } : null;
      })
      .filter((x): x is { ability: SpecAbility; chosenAtLevel: number } => x !== null)
      .sort((a, b) => a.ability.tier - b.ability.tier || a.ability.name.localeCompare(b.ability.name));
  }, [chosen]);

  // Talentos escolhidos (catálogo Geral + Origem) — listagem separada das habilidades.
  const chosenTalentEntries = useMemo(() => {
    return (c.chosenTalents ?? [])
      .map(ct => {
        const t = getTalentById(ct.id);
        return t ? { talent: t, level: ct.level } : null;
      })
      .filter((x): x is { talent: Talent; level: number } => x !== null)
      .sort((a, b) =>
        (a.talent.category === b.talent.category ? 0 : a.talent.category === 'general' ? -1 : 1) ||
        a.talent.name.localeCompare(b.talent.name),
      );
  }, [c.chosenTalents]);

  const chosenIds = new Set(chosen.map(ch => ch.abilityId));
  const noCatalog = allForSpec.length === 0;

  const handleActivate = async (ab: SpecAbility) => {
    const res = await activateSpecAbility(c.id, ab.id);
    if (!res.ok) {
      playErrorSound();
      addLog('system', `⚠ ${c.name}: não conseguiu ativar "${ab.name}" — ${res.reason}`);
      return;
    }
    playSuccessSound();
    // Caso especial: Economia de Energia → peSpent vem negativo (= PE recuperado da reserva)
    if (ab.id === 'tec-economia-de-energia' && typeof res.peSpent === 'number' && res.peSpent < 0) {
      const recovered = -res.peSpent;
      addLog('system', `🔋 ${c.name}: ativou "${ab.name}" — transferiu ${recovered} PE da reserva para PE atual (reserva zerada).`);
      return;
    }
    let msg = `⚡ ${c.name}: ativou "${ab.name}" (${ACTIVATION_LABEL[ab.activation]})`;
    if (res.peSpent && res.peSpent > 0) msg += ` • -${res.peSpent} PE`;
    if (typeof res.usesLeft === 'number') msg += ` • ${res.usesLeft} uso(s) restantes`;
    if (ab.dice) {
      const r = await rollDice(ab.dice);
      msg += ` • Rolagem ${ab.dice} = [${r.rolls.join(', ')}] = ${r.total}`;
    }
    addLog('system', msg);
  };

  return (
    <div className="space-y-2">
      {/* === 3 Pools separados: Habilidade · Talento · Compartilhado === */}
      <div className="rounded-lg border border-border/60 bg-secondary/30 px-2 py-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className={cn('h-3.5 w-3.5', grandTotal > 0 ? 'text-primary animate-pulse' : 'text-muted-foreground')} />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Pools de Aquisição
          </span>
          {(editMode || grandTotal > 0) && (
            <button
              onClick={() => {
                if (grandTotal <= 0 && !editMode) { playErrorSound(); return; }
                playClickSound();
                setCatalogOpen(true);
              }}
              disabled={grandTotal <= 0 && !editMode}
              className={cn(
                'ml-auto flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold transition-colors',
                grandTotal > 0
                  ? 'border-primary bg-primary/20 text-primary hover:bg-primary/40 animate-pulse'
                  : 'border-border bg-muted/40 text-muted-foreground cursor-not-allowed',
              )}
              title={grandTotal > 0 ? `Você tem ${grandTotal} ponto(s) para gastar` : 'Catálogo (modo edição)'}
            >
              <Plus className="h-3 w-3" />
              {grandTotal > 0 ? `Escolher (${grandTotal})` : 'Abrir Catálogo'}
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <PoolChip
            label="Habilidade"
            value={skillOnly}
            tone="primary"
            hint="Exclusivo de Habilidades de Especialização"
          />
          <PoolChip
            label="Talento"
            value={talentOnly}
            tone="accent"
            hint="Exclusivo de Talentos (Geral/Origem)"
          />
          <PoolChip
            label="Compartilhado"
            value={shared}
            tone="muted"
            hint="Pode ser gasto em qualquer um"
          />
        </div>
        <div className="text-xs text-muted-foreground italic px-0.5">
          Habilidade pode usar até <strong>{totalForSkill}</strong> · Talento pode usar até <strong>{totalForTalent}</strong>
        </div>
      </div>

      {noCatalog && (
        <div className="flex items-start gap-2 rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 p-2 text-xs text-muted-foreground italic">
          <Lock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Catálogo de <strong>{c.specialization}</strong> em construção. Pontos do pool ficam guardados.
          </span>
        </div>
      )}

      {/* === Habilidades automáticas de classe (motor de progressão) === */}
      {(autoClassPassives.length > 0 || lutadorManeuvers.length > 0) && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
            <Award className="h-3 w-3" />
            Habilidades de Classe — {c.specialization}
            <span className="ml-auto text-xs font-normal italic text-muted-foreground normal-case">
              concedidas automaticamente por nível
            </span>
          </div>
          <ul className="space-y-1">
            {autoClassPassives.map((p: any) => {
              const isOpen = expandedId === `auto-${p.id}`;
              return (
                <li key={p.id} className="rounded-md border border-amber-500/30 bg-background/40 overflow-hidden">
                  <button
                    onClick={() => { playClickSound(); setExpandedId(isOpen ? null : `auto-${p.id}`); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-amber-500/10 transition-colors text-left"
                  >
                    <span className="rounded bg-amber-500/30 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                      Auto
                    </span>
                    <span className="rounded border border-muted-foreground/40 bg-muted/30 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Shield className="h-2.5 w-2.5" />
                      Passiva
                    </span>
                    <span className="flex-1 text-xs font-bold text-foreground">{p.name}</span>
                    <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-amber-500/20 bg-background/60 px-2 py-2">
                      <p className="text-xs text-foreground/90 leading-relaxed">{p.description}</p>
                    </div>
                  )}
                </li>
              );
            })}
            {lutadorManeuvers.length > 0 && (
              <li className="rounded-md border border-amber-500/30 bg-background/40 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-amber-500/30 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                    Manobras
                  </span>
                  <span className="text-xs font-bold text-foreground">Empolgação</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {lutadorManeuvers.length} escolhida{lutadorManeuvers.length === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mt-1 text-xs italic text-muted-foreground">
                  Clique numa manobra para ver custo, gatilho e efeito completos.
                </p>
                <div className="mt-1 space-y-1">
                  {lutadorManeuvers.map(m => {
                    const det = LUTADOR_MANEUVER_DETAILS[m as LutadorManeuver];
                    const isOpen = expandedId === `man-${m}`;
                    return (
                      <div key={m} className="rounded border border-amber-500/40 bg-amber-500/5">
                        <button
                          onClick={() => { playClickSound(); setExpandedId(isOpen ? null : `man-${m}`); }}
                          className="flex w-full items-center gap-2 px-2 py-1 text-left"
                        >
                          <span className="text-xs font-bold text-amber-300">{m}</span>
                          {det && (
                            <span className="ml-auto text-xs uppercase tracking-wider text-muted-foreground">
                              {det.cost.split('·')[0].trim()}
                            </span>
                          )}
                          <ChevronDown className={cn('h-3 w-3 text-amber-300 transition-transform', isOpen && 'rotate-180')} />
                        </button>
                        {isOpen && det && (
                          <div className="border-t border-amber-500/20 px-2 py-1.5 space-y-1 text-xs text-foreground/90">
                            <p className="italic text-muted-foreground">{det.flavor}</p>
                            <div><strong className="text-amber-400">Custo:</strong> {det.cost}</div>
                            <div><strong className="text-amber-400">Quando:</strong> {det.trigger}</div>
                            <div><strong className="text-amber-400">Efeito:</strong> {det.effect}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* === Painel de Empolgação (Lutador) === */}
      {c.specialization === 'Lutador' && (
        <EmpolgacaoPanel character={c} />
      )}

      {/* ═══════════ SEÇÃO: HABILIDADES ESCOLHIDAS ═══════════ */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-1.5 px-1">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Habilidades de Especialização
          </span>
          <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-xs font-mono font-bold text-primary">
            {chosenAbilities.length}
          </span>
          <span className="ml-auto text-xs italic text-muted-foreground">
            do catálogo de {c.specialization}
          </span>
        </div>
        {chosenAbilities.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-1 py-1">
            Nenhuma habilidade escolhida ainda.
          </p>
        ) : (
          <ul className="space-y-1">
            {chosenAbilities.map(({ ability, chosenAtLevel }) => {
              const isOpen = expandedId === ability.id;
              const Icon = ACTIVATION_ICON[ability.activation];
              const used = c.specAbilityUsage?.[ability.id] ?? 0;
              const max = ability.usage
                ? resolveUsageMax(ability.usage, { trainingBonus: getTrainingBonusByLevel(c.level), level: c.level })
                : null;
              return (
                <li key={ability.id} className="rounded-lg border border-border bg-secondary/20 overflow-hidden">
                  <button
                    onClick={() => { playClickSound(); setExpandedId(isOpen ? null : ability.id); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-secondary/40 transition-colors text-left"
                  >
                    <span
                      className="rounded bg-primary/30 px-1.5 py-0.5 text-xs font-mono font-bold text-primary"
                      title={`Tier ${ability.tier} (escolhida no Nv ${chosenAtLevel})`}
                    >
                      Nv {ability.tier}
                    </span>
                    <span
                      className={cn(
                        'rounded border px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1',
                        ACTIVATION_COLOR[ability.activation],
                      )}
                      title={ACTIVATION_LABEL[ability.activation]}
                    >
                      <Icon className="h-2.5 w-2.5" />
                      {ACTIVATION_LABEL[ability.activation]}
                    </span>
                    <span className="flex-1 text-xs font-bold text-foreground">{ability.name}</span>
                    {ability.peCost ? (
                      <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-xs font-bold text-cyan-400">
                        {ability.peCost} PE
                      </span>
                    ) : null}
                    {max !== null && (
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-xs font-mono font-bold',
                          used >= max ? 'bg-destructive/30 text-destructive' : 'bg-muted/40 text-muted-foreground',
                        )}
                        title={`Usos: ${used}/${max} ${USAGE_SCOPE_LABEL[ability.usage!.scope]}`}
                      >
                        {used}/{max}
                      </span>
                    )}
                    <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                    {editMode && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          playClickSound();
                          removeSpecAbility(c.id, ability.id);
                          addLog('system', `↩ ${c.name}: removeu "${ability.name}" (devolveu 1 ao pool).`);
                        }}
                        className="rounded p-0.5 text-muted-foreground hover:bg-destructive/30 hover:text-destructive transition-colors"
                        title="Remover (devolve 1 ao pool)"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="border-t border-border bg-background/40 px-2 py-2 space-y-2">
                      <p className="text-xs italic text-muted-foreground">{ability.flavor}</p>
                      <p className="text-xs text-foreground leading-relaxed">{ability.mechanic}</p>

                      {/* Escolha permanente (se a habilidade declara `choiceSchema`) */}
                      {ability.choiceSchema && (() => {
                        const chosenValue = c.specAbilityChoices?.[ability.id];
                        const pretty = formatChoiceValue(chosenValue);
                        return (
                          <div className={cn(
                            'flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs',
                            chosenValue
                              ? 'border-primary/40 bg-primary/10 text-foreground'
                              : 'border-amber-500/50 bg-amber-500/10 text-amber-300',
                          )}>
                            {chosenValue ? (
                              <>
                                <Award className="h-3.5 w-3.5 text-primary" />
                                <span><strong>Escolha:</strong> {pretty}</span>
                                {editMode && (
                                  <button
                                    onClick={() => { playClickSound(); setChoiceForAbilityId(ability.id); }}
                                    className="ml-auto rounded p-1 hover:bg-primary/20"
                                    title="Trocar escolha"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3.5 w-3.5" />
                                <span>Escolha permanente pendente.</span>
                                {editMode ? (
                                  <button
                                    onClick={() => { playClickSound(); setChoiceForAbilityId(ability.id); }}
                                    className="ml-auto rounded bg-amber-500/30 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-500/50"
                                  >
                                    Escolher…
                                  </button>
                                ) : (
                                  <span className="ml-auto text-xs uppercase tracking-wider text-muted-foreground">Ative o modo edição</span>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}

                      {/* Bloco técnico (oculto por padrão — para o Mestre) */}
                      <details className="rounded-md border border-border/60 bg-card/60">
                        <summary className="cursor-pointer select-none px-2 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                          ⚙ Detalhes técnicos (Mestre)
                        </summary>
                        <div className="border-t border-border/60 p-2 text-xs text-foreground/90 grid gap-0.5">
                          <div><span className="text-muted-foreground">Gatilho:</span> {ability.triggerText}</div>
                          <div><span className="text-muted-foreground">Lógica:</span> <span className="font-mono">{ability.logicText}</span></div>
                          {ability.dice && (
                            <div><span className="text-muted-foreground">Dado:</span> <span className="font-mono text-primary">{ability.dice}</span></div>
                          )}
                          {ability.usage && (
                            <div><span className="text-muted-foreground">Usos:</span> {used}/{max} <span className="text-muted-foreground">{USAGE_SCOPE_LABEL[ability.usage.scope]}</span></div>
                          )}
                          {ability.prerequisitesText && (
                            <div><span className="text-muted-foreground">Pré-requisito:</span> {ability.prerequisitesText}</div>
                          )}
                        </div>
                      </details>

                      {/* Botão de ATIVAÇÃO */}
                      {ability.activation === 'passive' ? (
                        <div className="flex items-center gap-2 rounded-md border border-muted-foreground/30 bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground italic">
                          <Shield className="h-3.5 w-3.5" />
                          Habilidade passiva — efeito sempre ativo.
                        </div>
                      ) : (
                        <button
                          onClick={() => handleActivate(ability)}
                          disabled={
                            (ability.peCost ?? 0) > c.peCurrent ||
                            (max !== null && used >= max) ||
                            (ability.activation === 'action' && c.actionsCurrent <= 0) ||
                            (ability.activation === 'bonus' && c.bonusActionsCurrent <= 0) ||
                            (ability.activation === 'reaction' && c.reactionsCurrent <= 0) ||
                            (ability.id === 'tec-economia-de-energia' && (c.economiaPEReserve ?? 0) <= 0)
                          }
                          className={cn(
                            'w-full flex items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all',
                            'disabled:cursor-not-allowed disabled:opacity-40',
                            ACTIVATION_COLOR[ability.activation],
                            'hover:brightness-125 hover:scale-[1.01]',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {ability.activation === 'toggle' ? 'Alternar' : 'Ativar'} — {ACTIVATION_LABEL[ability.activation]}
                          {ability.peCost ? <span className="opacity-80">({ability.peCost} PE)</span> : null}
                          {ability.id === 'tec-economia-de-energia' && (
                            <span className="opacity-80">(reserva: {c.economiaPEReserve ?? 0} PE)</span>
                          )}
                        </button>
                      )}

                      {/* Indicador de reserva da Economia de Energia */}
                      {ability.id === 'tec-economia-de-energia' && (
                        <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-300">
                          <Zap className="h-3.5 w-3.5" />
                          <span>
                            Reserva atual: <span className="font-mono font-bold">{c.economiaPEReserve ?? 0}</span> PE.
                            {(c.economiaPEReserve ?? 0) <= 0 && ' Faça um descanso para recarregar (curto: 1d4, longo: 1d6, +1 passo a cada 5 níveis).'}
                          </span>
                        </div>
                      )}

                      {/* Botão dedicado: Conhecimento Aplicado (gastar PE em TR) */}
                      {ability.id === 'tec-conhecimento-aplicado' && (
                        <button
                          onClick={() => { setConhecimentoOpen(true); playClickSound(); }}
                          className="w-full flex items-center justify-center gap-2 rounded-md border border-blue-500/60 bg-blue-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-400 hover:bg-blue-500/20 hover:scale-[1.01] transition-all"
                        >
                          <Shield className="h-3.5 w-3.5" />
                          Gastar PE em Teste de Resistência
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ═══════════ SEÇÃO: TALENTOS ADQUIRIDOS ═══════════ */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-1.5 px-1">
          <BookOpen className="h-3 w-3 text-accent-foreground" />
          <span className="text-xs font-bold uppercase tracking-wider text-accent-foreground">
            Talentos Adquiridos
          </span>
          <span className="ml-1 rounded-full bg-accent/30 px-1.5 text-xs font-mono font-bold text-accent-foreground">
            {chosenTalentEntries.length}
          </span>
          <span className="ml-auto text-xs italic text-muted-foreground">
            gerais &amp; de origem
          </span>
        </div>
        {chosenTalentEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-1 py-1">
            Nenhum talento adquirido ainda.
          </p>
        ) : (
          <ul className="space-y-1">
            {chosenTalentEntries.map(({ talent, level }) => {
              const tid = `tal-${talent.id}`;
              const isOpen = expandedId === tid;
              const tb = getTrainingBonusByLevel(c.level);
              const usageMax = talent.usage ? resolveTalentUsageMax(talent.usage, { trainingBonus: tb }) : 0;
              const usageUsed = c.talentUsage?.[talent.id] ?? 0;
              const usesLeft = Math.max(0, usageMax - usageUsed);
              return (
                <li key={talent.id} className="rounded-lg border border-accent/30 bg-accent/5 overflow-hidden">
                  <button
                    onClick={() => { playClickSound(); setExpandedId(isOpen ? null : tid); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-accent/15 transition-colors text-left"
                  >
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider',
                        talent.category === 'general'
                          ? 'bg-accent/30 text-accent-foreground'
                          : 'bg-purple-500/30 text-purple-300',
                      )}
                      title={talent.category === 'general' ? 'Talento Geral' : 'Talento de Origem'}
                    >
                      {talent.category === 'general' ? 'Geral' : 'Origem'}
                    </span>
                    <span
                      className="rounded bg-muted/40 px-1.5 py-0.5 text-xs font-mono font-bold text-muted-foreground"
                      title={`Adquirido no Nv ${level}`}
                    >
                      Nv {level}
                    </span>
                    <span className="flex-1 text-xs font-bold text-foreground">{talent.name}</span>
                    {talent.usage && (
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-xs font-mono font-bold',
                          usesLeft > 0 ? 'bg-primary/20 text-primary' : 'bg-destructive/30 text-destructive-foreground',
                        )}
                        title={`Usos: ${usageUsed}/${usageMax} (${talent.usage.scope})`}
                      >
                        {usesLeft}/{usageMax}
                      </span>
                    )}
                    {talent.repeatable && (
                      <span className="rounded bg-muted/40 px-1.5 py-0.5 text-xs font-bold text-muted-foreground" title="Repetível">↻</span>
                    )}
                    <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-accent/20 bg-background/40 px-2 py-2 space-y-1.5">
                      <p className="text-xs italic text-muted-foreground">{talent.flavor}</p>
                      <p className="text-xs text-foreground leading-relaxed">{talent.mechanic}</p>
                      {talent.requirementsText && (
                        <p className="text-xs text-muted-foreground">📜 {talent.requirementsText}</p>
                      )}
                      {talent.usage && (
                        <button
                          onClick={() => {
                            const res = consumeTalentUse(c.id, talent.id);
                            if (!res.ok) {
                              playErrorSound();
                              addLog('system', `❌ ${c.name}: ${res.reason}`);
                              return;
                            }
                            playSuccessSound();
                            addLog('system', `✦ ${c.name}: usou "${talent.name}" (resta ${res.usesLeft ?? 0}).`);
                          }}
                          disabled={usesLeft <= 0}
                          className="mt-1 w-full h-7 rounded bg-primary/15 hover:bg-primary/25 disabled:opacity-40 text-xs font-medium text-primary transition-colors"
                        >
                          Consumir 1 uso ({usesLeft}/{usageMax} · reset {talent.usage.scope})
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {catalogOpen && (
        <TalentCatalogModal
          character={c}
          allowedTabs={['class', 'talent']}
          initialTab="class"
          onClose={() => setCatalogOpen(false)}
          onPickAny={(pick) => {
            if (pick.kind === 'spec_ability') {
              const ok = chooseSpecAbility(c.id, pick.ability.id);
              if (ok) {
                playSuccessSound();
                addLog('system', `★ ${c.name}: escolheu "${pick.ability.name}" (Tier ${pick.ability.tier}).`);
                setCatalogOpen(false);
                // Se a habilidade exige escolha permanente (Nível Perfeito etc.),
                // abre o modal de escolha logo em seguida.
                if (pick.ability.choiceSchema) {
                  setChoiceForAbilityId(pick.ability.id);
                }
              } else {
                playErrorSound();
              }
            } else {
              // Talento: se exige escolha de opções, abre o modal antes de comprar.
              const optKind = talentNeedsOptions(pick.talent.id);
              if (optKind) {
                setPendingTalentOptions({
                  talentId: pick.talent.id,
                  talentName: pick.talent.name,
                  kind: optKind,
                });
                setCatalogOpen(false);
                return;
              }
              // Talento direto: consome do pool exclusivo de Talento → senão do compartilhado.
              const ok = chooseTalentFromPool(c.id, pick.talent.id, c.level);
              if (ok) {
                playSuccessSound();
                addLog('system', `★ ${c.name}: adquiriu o talento "${pick.talent.name}".`);
                setCatalogOpen(false);
              } else {
                playErrorSound();
              }
            }
          }}
        />
      )}

      {pendingTalentOptions && (
        <TalentOptionsDialog
          character={c}
          kind={pendingTalentOptions.kind}
          onCancel={() => setPendingTalentOptions(null)}
          onConfirm={(choices) => {
            const { talentId, talentName, kind } = pendingTalentOptions;
            const ok = chooseTalentFromPool(c.id, talentId, c.level, choices);
            if (!ok) {
              playErrorSound();
              addLog('system', `❌ ${c.name}: sem pontos disponíveis para "${talentName}".`);
              setPendingTalentOptions(null);
              return;
            }
            // Side-effects específicos por talento:
            if (kind === 'estudo-amaldicoado' && choices.aptitudes) {
              const [k1, k2] = choices.aptitudes.split(',') as [import('@/types').AptitudeKey, import('@/types').AptitudeKey];
              const r = applyEstudoAmaldicoado(c.id, [k1, k2]);
              if (!r.ok) addLog('system', `⚠ ${c.name}: ${r.reason}`);
            }
            playSuccessSound();
            const detail = kind === 'fisico-aperfeicoado'
              ? ` [opção ${choices.fisicoOption}${choices.fisicoSkill ? '/' + choices.fisicoSkill : ''}]`
              : kind === 'quebra-limites'
              ? ` [+2 ${choices.attr} & +2 ${choices.attr2}]`
              : ` [+1 ${choices.aptitudes}]`;
            addLog('system', `★ ${c.name}: adquiriu "${talentName}"${detail}.`);
            setPendingTalentOptions(null);
          }}
        />
      )}

      {choiceForAbilityId && (() => {
        const ab = getSpecAbilityById(choiceForAbilityId);
        if (!ab || !ab.choiceSchema) return null;
        return (
          <SpecAbilityChoiceDialog
            charId={c.id}
            ability={ab}
            current={c.specAbilityChoices?.[choiceForAbilityId]}
            open={true}
            onClose={() => setChoiceForAbilityId(null)}
          />
        );
      })()}

      {conhecimentoOpen && (
        <ConhecimentoAplicadoDialog character={c} onClose={() => setConhecimentoOpen(false)} />
      )}
    </div>
  );
}

/**
 * Renderiza um valor de escolha permanente em texto humano para o card.
 * Mantém o conhecimento do shape `SpecAbilityChoiceValue` em um só lugar.
 */
function formatChoiceValue(value: import('@/lib/specAbilities').SpecAbilityChoiceValue | undefined): string {
  if (!value) return '—';
  switch (value.kind) {
    case 'spell-level': return `Feitiços de Nv ${value.level}`;
    case 'spell':       return `Feitiço (${value.spellId})`;
    case 'skills':      return `Perícias: ${value.skills.join(', ') || '—'}`;
    case 'weapons':     return `Armas: ${value.weapons.join(', ') || '—'}`;
    case 'save':        return `TR de ${value.save}`;
  }
  return "—";
}

// ----- PoolChip: chip visual de cada um dos 3 pools -----
function PoolChip({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: 'primary' | 'accent' | 'muted';
  hint: string;
}) {
  const toneCls =
    tone === 'primary'
      ? value > 0
        ? 'border-primary/60 bg-primary/15 text-primary'
        : 'border-primary/20 bg-primary/5 text-muted-foreground'
      : tone === 'accent'
      ? value > 0
        ? 'border-accent/60 bg-accent/20 text-accent-foreground'
        : 'border-accent/20 bg-accent/5 text-muted-foreground'
      : value > 0
      ? 'border-muted-foreground/40 bg-muted/40 text-foreground'
      : 'border-border bg-muted/20 text-muted-foreground';
  return (
    <div
      title={hint}
      className={cn(
        'flex flex-col items-center justify-center rounded-md border px-1.5 py-1 transition-colors',
        toneCls,
      )}
    >
      <span className="text-xs font-bold uppercase tracking-wider opacity-80 leading-none">
        {label}
      </span>
      <span className={cn('text-base font-mono font-bold tabular-nums leading-tight', value === 0 && 'opacity-40')}>
        {value}
      </span>
    </div>
  );
}

interface CatalogProps {
  spec: Character['specialization'];
  charLevel: number;
  chosenIds: Set<string>;
  onClose: () => void;
  onPick: (a: SpecAbility) => void;
}

function CatalogModal({ spec, charLevel, chosenIds, onClose, onPick }: CatalogProps) {
  const all = getSpecAbilitiesFor(spec);
  const tiers = [...new Set(all.map(a => a.tier))].sort((a, b) => a - b);
  const [activeTier, setActiveTier] = useState<number | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return all
      .filter(a => a.tier <= charLevel)
      .filter(a => !chosenIds.has(a.id))
      .filter(a => activeTier === 'all' || a.tier === activeTier)
      .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  }, [all, charLevel, chosenIds, activeTier]);

  const missingPrereqs = (ab: SpecAbility): string[] => {
    if (!ab.prerequisites?.length) return [];
    return ab.prerequisites
      .filter(pid => !chosenIds.has(pid))
      .map(pid => getSpecAbilityById(pid)?.name ?? pid);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl border border-primary/40 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Catálogo de Habilidades — {spec}
          </h2>
          <button
            onClick={onClose}
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-destructive/30 hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
          <button
            onClick={() => setActiveTier('all')}
            className={cn(
              'rounded-md border px-2 py-1 text-xs font-bold transition-colors',
              activeTier === 'all'
                ? 'border-primary bg-primary/30 text-primary'
                : 'border-border bg-background text-muted-foreground hover:border-primary/40',
            )}
          >Todos</button>
          {tiers.map(t => {
            const locked = t > charLevel;
            return (
              <button
                key={t}
                disabled={locked}
                onClick={() => setActiveTier(t)}
                className={cn(
                  'rounded-md border px-2 py-1 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                  activeTier === t
                    ? 'border-primary bg-primary/30 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40',
                )}
                title={locked ? `Requer Nv ${t}` : `Mostrar tier ${t}`}
              >
                {locked && <Lock className="inline h-2.5 w-2.5 mr-1" />}
                Nv {t}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-8">
              Nenhuma habilidade disponível neste filtro.
            </p>
          ) : (
            <ul className="space-y-2">
              {filtered.map(ab => {
                const isOpen = expandedId === ab.id;
                const missing = missingPrereqs(ab);
                const blocked = missing.length > 0;
                const Icon = ACTIVATION_ICON[ab.activation];
                return (
                  <li
                    key={ab.id}
                    className={cn(
                      'rounded-lg border bg-secondary/30 overflow-hidden transition-colors',
                      blocked
                        ? 'border-destructive/30 opacity-70'
                        : 'border-border hover:border-primary/40',
                    )}
                  >
                    <div className="flex items-start gap-2 p-2">
                      <span className="rounded bg-primary/30 px-1.5 py-0.5 text-xs font-mono font-bold text-primary mt-0.5">
                        Nv {ab.tier}
                      </span>
                      <span
                        className={cn(
                          'rounded border px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5',
                          ACTIVATION_COLOR[ab.activation],
                        )}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {ACTIVATION_LABEL[ab.activation]}
                      </span>
                      {ab.isFinalizer && (
                        <span className="rounded bg-destructive/30 px-1.5 py-0.5 text-xs font-mono font-bold text-destructive mt-0.5">
                          FINAL
                        </span>
                      )}
                      <button
                        onClick={() => setExpandedId(isOpen ? null : ab.id)}
                        className="flex-1 text-left text-sm font-bold text-foreground hover:text-primary transition-colors"
                      >
                        {ab.name}
                        <ChevronDown className={cn('inline ml-1 h-3.5 w-3.5 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                      </button>
                      <button
                        onClick={() => !blocked && onPick(ab)}
                        disabled={blocked}
                        title={blocked ? `Requer: ${missing.join(', ')}` : 'Escolher esta habilidade'}
                        className={cn(
                          'rounded-md border px-2 py-1 text-xs font-bold transition-colors flex items-center gap-1',
                          blocked
                            ? 'border-border bg-muted/40 text-muted-foreground cursor-not-allowed'
                            : 'border-primary bg-primary/20 text-primary hover:bg-primary/40',
                        )}
                      >
                        {blocked ? <Lock className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {blocked ? 'Bloqueada' : 'Escolher'}
                      </button>
                    </div>
                    {(blocked || ab.prerequisitesText) && (
                      <div className="px-3 pb-1.5 -mt-1 text-xs text-muted-foreground italic flex flex-wrap gap-x-2">
                        {blocked && (
                          <span className="text-destructive">
                            ⚠ Pré-req.: {missing.join(', ')}
                          </span>
                        )}
                        {ab.prerequisitesText && (
                          <span>📜 {ab.prerequisitesText}</span>
                        )}
                      </div>
                    )}
                    {isOpen && (
                      <div className="border-t border-border bg-background/40 px-3 py-2 space-y-1.5">
                        <p className="text-xs italic text-muted-foreground">{ab.flavor}</p>
                        <p className="text-xs text-foreground leading-relaxed">{ab.mechanic}</p>
                        <details className="rounded-md border border-border/60 bg-card/60 mt-1.5">
                          <summary className="cursor-pointer select-none px-2 py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                            ⚙ Detalhes técnicos (Mestre)
                          </summary>
                          <div className="border-t border-border/60 p-2 grid gap-0.5 text-xs">
                            <div><span className="text-muted-foreground">Gatilho:</span> {ab.triggerText}</div>
                            <div><span className="text-muted-foreground">Lógica:</span> <span className="font-mono">{ab.logicText}</span></div>
                          </div>
                        </details>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Tier ≤ Nv {charLevel}. Já escolhidas estão ocultas. Habilidades com pré-requisitos ficam bloqueadas até atendê-los.
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EmpolgacaoPanel — controle do nível de Empolgação (1..5) do Lutador.
// REGRA: o nível NÃO pode ser editado manualmente. Sobe ao acertar um ataque,
// zera ao errar ou ao terminar o turno sem atacar. Cap em 5.
// ============================================================================

interface EmpolgacaoPanelProps {
  character: Character;
}

const EMPOLGACAO_RULES = [
  '• Início do combate: Nv 1 (ou Nv 2 com Lutador Superior, Nv 20).',
  '• Acertou um ataque marcial/desarmado → Empolgação +1 (cap 5).',
  '• Errou o ataque OU terminou o turno sem atacar → reseta para o nível inicial.',
  '• Nv 2..5 concedem 1 dado extra de dano (rolado junto com o ataque).',
  '• A tabela de dado muda no Nv 11 (Empolgação Máxima).',
  '• O nível NÃO pode ser ajustado manualmente — use os botões "Acertei" / "Errei".',
];

export function EmpolgacaoPanel({ character: c }: EmpolgacaoPanelProps) {
  const rollDice = (n: string) => rollDiceCom(c.id, n);
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const addLog = useLogStore(s => s.addLog);
  const [showHelp, setShowHelp] = useState(false);

  const isMaxima = c.level >= 11;
  const table: EmpolgacaoTable = c.empolgacaoDiceTable ?? (isMaxima ? EMPOLGACAO_MAXIMA : EMPOLGACAO_BASE);
  const startLevel = c.empolgacaoStartLevel ?? (c.level >= 20 ? 2 : 1);
  const current = c.empolgacaoLevel ?? startLevel;
  // Cap efetivo da Empolgação: 5 menos qualquer penalidade ativa (Última Gota etc.).
  const effectiveCap = Math.max(startLevel, 5 - (c.empolgacaoMaxPenalty ?? 0));

  const onHit = () => {
    if (current >= effectiveCap) {
      playErrorSound();
      addLog('system', `⚠ ${c.name}: Empolgação já está no máximo (${effectiveCap}).`);
      return;
    }
    const next = current + 1;
    playSuccessSound();
    updateCharacter(c.id, { empolgacaoLevel: next });
    addLog('system', `🔥 ${c.name}: acertou o ataque — Empolgação ${current} → ${next}.`);
  };

  const onMiss = () => {
    if (current === startLevel) {
      playClickSound();
      addLog('system', `↺ ${c.name}: errou o ataque (Empolgação já em ${startLevel}).`);
      return;
    }
    playClickSound();
    updateCharacter(c.id, { empolgacaoLevel: startLevel });
    addLog('system', `💨 ${c.name}: errou/não atacou — Empolgação resetada para ${startLevel}.`);
  };

  const rollExtra = async () => {
    if (current < 2) {
      playErrorSound();
      addLog('system', `⚠ ${c.name}: Empolgação ${current} não dá dado extra (mínimo Nv 2).`);
      return;
    }
    const die = table[current as 2 | 3 | 4 | 5];
    const r = await rollDice(`${die.count}d${die.sides}`);
    playSuccessSound();
    addLog('system', `🎲 ${c.name}: Dado de Empolgação Nv${current} (${formatEmpolgacaoDie(die)}) = [${r.rolls.join(', ')}] = ${r.total}`);
  };

  const currentDie = current >= 2 ? table[current as 2 | 3 | 4 | 5] : null;

  return (
    <div className="rounded-lg border border-orange-500/40 bg-orange-500/5 p-2 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-400">
        <Zap className="h-3 w-3" />
        {isMaxima ? 'Empolgação Máxima' : 'Empolgação'}
        <button
          type="button"
          onClick={() => { playClickSound(); setShowHelp(v => !v); }}
          className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-orange-400/60 bg-orange-500/15 text-orange-300 hover:bg-orange-500/30 transition-colors"
          title="Como funciona a Empolgação?"
          aria-label="Ajuda sobre Empolgação"
        >
          <HelpCircle className="h-2.5 w-2.5" />
        </button>
        <span className="ml-auto text-xs font-normal italic text-muted-foreground normal-case">
          início no combate: Nv {startLevel}
        </span>
      </div>

      {showHelp && (
        <div className="rounded-md border border-orange-500/30 bg-background/70 p-2 text-xs leading-relaxed text-foreground/90 space-y-0.5">
          {EMPOLGACAO_RULES.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}

      {/* Display 1..5 — somente leitura */}
      <div className="flex items-center gap-1" aria-label="Nível atual de Empolgação (somente leitura)">
        {[1, 2, 3, 4, 5].map(n => {
          const active = n === current;
          const reached = n <= current;
          return (
            <div
              key={n}
              className={cn(
                'flex-1 rounded-md border px-1 py-1.5 text-xs font-bold text-center select-none',
                active
                  ? 'border-orange-400 bg-orange-500/40 text-orange-100 shadow-[0_0_8px_rgba(251,146,60,0.5)]'
                  : reached
                  ? 'border-orange-500/50 bg-orange-500/15 text-orange-300'
                  : 'border-border bg-muted/30 text-muted-foreground',
              )}
              title={n >= 2 ? `Nv ${n} → ${formatEmpolgacaoDie(table[n as 2 | 3 | 4 | 5])}` : 'Nv 1 (sem dado extra)'}
            >
              {n}
              {n >= 2 && (
                <div className="text-xs font-mono opacity-80">{formatEmpolgacaoDie(table[n as 2 | 3 | 4 | 5])}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Ações regradas */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onHit}
          disabled={current >= 5}
          className="flex-1 rounded-md border border-emerald-500/60 bg-emerald-500/15 px-2 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Marcar acerto de ataque (+1)"
        >
          ✓ Acertei
        </button>
        <button
          type="button"
          onClick={onMiss}
          className="flex-1 rounded-md border border-rose-500/60 bg-rose-500/15 px-2 py-1 text-xs font-bold uppercase tracking-wider text-rose-300 hover:bg-rose-500/30 transition-colors"
          title={`Errou ou terminou o turno sem atacar — reseta para Nv ${startLevel}`}
        >
          ✗ Errei / Não ataquei
        </button>
        <button
          type="button"
          onClick={rollExtra}
          disabled={!currentDie}
          className="flex items-center gap-1 rounded-md border border-primary/60 bg-primary/20 px-2 py-1 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title={currentDie ? `Rolar ${formatEmpolgacaoDie(currentDie)}` : 'Sem dado extra no Nv 1'}
        >
          <Dices className="h-3 w-3" />
          Rolar {currentDie ? formatEmpolgacaoDie(currentDie) : '—'}
        </button>
      </div>

      <p className="text-xs italic text-muted-foreground leading-snug">
        Sobe ao acertar ataques · zera ao errar ou não atacar · cap em 5.
        {c.level >= 20 && ' Lutador Superior: inicia o combate em Nv 2.'}
      </p>
    </div>
  );
}
