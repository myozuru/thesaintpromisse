import { useState, useEffect } from 'react';
import { Check, X, ListChecks, Sparkles, Lock, AlertTriangle, Swords, ShieldCheck, Wand2, BookOpen, Plus, Minus } from 'lucide-react';
import { APTITUDE_KEYS, APTITUDE_LABELS, APTITUDE_MAX, type AptitudeKey, createDefaultCursedAptitudes } from '@/types';
import { cn } from '@/lib/utils';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { playClickSound, playSuccessSound } from '@/lib/sounds';
import type { PendingLevelChoice } from '@/lib/levelEngine';
import { LUTADOR_MANEUVERS, LUTADOR_MANEUVER_DETAILS, type LutadorManeuver } from '@/lib/lutadorProgression';
import {
  TECNICA_FUNDAMENTOS,
  TECNICA_FUNDAMENTO_DETAILS,
  TECNICA_FOCOS,
  TECNICA_FOCO_DETAILS,
  type TecnicaFundamento,
  type TecnicaFoco,
} from '@/lib/tecnicaProgression';
import { AttributeSpendDialog } from './AttributeSpendDialog';
import { TalentCatalogModal } from './TalentCatalogModal';
import { TalentOptionsDialog, talentNeedsOptions, type TalentOptionsKind } from './TalentOptionsDialog';
import { AuraAptitudesPanel } from './AuraAptitudesPanel';
import { BarAptitudesPanel } from './BarAptitudesPanel';
import { ClAptitudesPanel } from './ClAptitudesPanel';
import { DomAptitudesPanel } from './DomAptitudesPanel';
import { ErAptitudesPanel } from './ErAptitudesPanel';
import { SpecialAptitudesPanel } from './SpecialAptitudesPanel';
import { CursedExclusivePanel } from './CursedExclusivePanel';
import { SpellCreationAssistant } from './SpellCreationAssistant';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

/**
 * Catálogo unificado de Aptidões Amaldiçoadas (todas as famílias).
 * Usado nas pendências de level-up e no Refino para que o jogador
 * possa escolher entre AU / BAR / CL / DOM / ER / SPECIAL.
 */
function UnifiedAptitudeCatalog({ character: c, onClose }: { character: Character; onClose: () => void }) {
  return (
    <Tabs defaultValue="AU" className="w-full">
      <TabsList className="grid w-full grid-cols-7">
        <TabsTrigger value="AU">AU</TabsTrigger>
        <TabsTrigger value="BAR">BAR</TabsTrigger>
        <TabsTrigger value="CL">CL</TabsTrigger>
        <TabsTrigger value="DOM">DOM</TabsTrigger>
        <TabsTrigger value="ER">ER</TabsTrigger>
        <TabsTrigger value="SPECIAL">SPEC</TabsTrigger>
        <TabsTrigger value="CURSED">CURSE</TabsTrigger>
      </TabsList>
      <TabsContent value="AU" className="mt-3">
        <AuraAptitudesPanel character={c} catalogOpen onCatalogOpenChange={(n) => { if (!n) onClose(); }} editMode catalogOnly />
      </TabsContent>
      <TabsContent value="BAR" className="mt-3">
        <BarAptitudesPanel character={c} catalogOpen onCatalogOpenChange={(n) => { if (!n) onClose(); }} editMode catalogOnly />
      </TabsContent>
      <TabsContent value="CL" className="mt-3">
        <ClAptitudesPanel character={c} catalogOpen onCatalogOpenChange={(n) => { if (!n) onClose(); }} editMode catalogOnly />
      </TabsContent>
      <TabsContent value="DOM" className="mt-3">
        <DomAptitudesPanel character={c} catalogOpen onCatalogOpenChange={(n) => { if (!n) onClose(); }} editMode catalogOnly />
      </TabsContent>
      <TabsContent value="ER" className="mt-3">
        <ErAptitudesPanel character={c} catalogOpen onCatalogOpenChange={(n) => { if (!n) onClose(); }} editMode catalogOnly />
      </TabsContent>
      <TabsContent value="SPECIAL" className="mt-3">
        <SpecialAptitudesPanel character={c} catalogOpen onCatalogOpenChange={(n) => { if (!n) onClose(); }} editMode catalogOnly />
      </TabsContent>
      <TabsContent value="CURSED" className="mt-3">
        <CursedExclusivePanel character={c} catalogOpen onCatalogOpenChange={(n) => { if (!n) onClose(); }} editMode catalogOnly />
      </TabsContent>
    </Tabs>
  );
}

interface Props {
  character: Character;
  filterLevels?: number[];
}

/**
 * Painel-Wizard de pendências do Motor de Progressão.
 *
 * Cada `kind` tem UI específica:
 *   - skill_or_talent              → Habilidade da Classe | Talento (placeholder)
 *   - cursed_aptitude              → input texto livre
 *   - asi_milestone                → A: +2 atributo | B: Talento (placeholder)
 *   - derivado_attr_milestone      → seletor de atributo (+1 e quebra cap)
 *   - master_skill                 → select de perícia (promove a Mestre)
 *   - skill_training_talent_choice → A: +2 treinos | B: +1 maestria
 *
 * Enquanto houver pendência, o painel exibe um aviso de bloqueio. A trava real
 * (impedir fechamento do modal / save) é responsabilidade do componente que
 * abre a ficha — basta consultar `hasPendingChoices(character)`.
 */
export function PendingLevelChoicesPanel({ character: c, filterLevels }: Props) {
  const { resolvePendingLevelChoice, updateCharacter } = useCharacterStore();
  const addLog = useLogStore(s => s.addLog);
  const [collapsed, setCollapsed] = useState(false);
  const pending = (c.pendingLevelChoices ?? []).filter(
    p => !p.resolved && (!filterLevels || filterLevels.includes(p.level)),
  );

  if (pending.length === 0) return null;

  // Agrupa por nível para visual de wizard.
  const byLevel = pending.reduce<Record<number, PendingLevelChoice[]>>((acc, p) => {
    (acc[p.level] ??= []).push(p);
    return acc;
  }, {});
  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);

  return (
    <div className="rounded-xl border border-primary/40 bg-gradient-to-br from-primary/10 to-accent/5 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-primary animate-pulse" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
          Wizard de Nível — Pendências
        </h3>
        <span className="ml-auto rounded-full bg-primary/25 px-2 py-0.5 text-xs font-mono font-bold text-primary">
          {pending.length}
        </span>
        <button
          onClick={() => { playClickSound(); setCollapsed(p => !p); }}
          className="rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 px-2 py-0.5 text-xs font-bold text-primary transition-colors flex items-center gap-1"
          title={collapsed ? 'Expandir wizard' : 'Recolher wizard'}
        >
          {collapsed ? <><Plus className="h-3 w-3" />Expandir</> : <><Minus className="h-3 w-3" />Recolher</>}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive-foreground">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Resolva todas as pendências antes de salvar/fechar a ficha. As escolhas
              podem ser feitas depois — ficam pendentes até serem concluídas.
            </span>
          </div>

          <div className="space-y-3">
            {levels.map(lv => (
              <div key={lv} className="rounded-lg border border-primary/30 bg-background/40 p-2">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="rounded bg-primary/30 px-2 py-0.5 text-xs font-mono font-bold text-primary">
                    Nv {lv}
                  </span>
                  <span className="text-xs text-muted-foreground italic">
                    {byLevel[lv].length} escolha(s)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {byLevel[lv].map(p => (
                    <PendingChoiceItem
                      key={p.id}
                      choice={p}
                      character={c}
                      onResolve={(value) => {
                        playSuccessSound();
                        resolvePendingLevelChoice(c.id, p.id, value);
                        addLog('system', `✓ ${c.name}: ${p.label}${value ? ` → ${value}` : ''}`);
                      }}
                      onUpdateCharacter={(patch) => updateCharacter(c.id, patch)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Helper para o resto da UI bloquear save enquanto houver pendência. */
export function hasPendingChoices(c: Character): boolean {
  return (c.pendingLevelChoices ?? []).some(p => !p.resolved);
}

// ===== Item ===============================================================

interface ItemProps {
  choice: PendingLevelChoice;
  character: Character;
  onResolve: (value?: string) => void;
  onUpdateCharacter: (patch: Partial<Character>) => void;
}

function PendingChoiceItem({ choice, character: c, onResolve, onUpdateCharacter }: ItemProps) {
  const { resolvePendingLevelChoice } = useCharacterStore();
  const addLog = useLogStore(s => s.addLog);
  const [text, setText] = useState('');
  const [pick, setPick] = useState<string>('');
  const [skillId, setSkillId] = useState('');
  const [attrName, setAttrName] = useState('');
  const [asiOpen, setAsiOpen] = useState(false);
  const [derivadoOpen, setDerivadoOpen] = useState(false);
  // Lutador: manobras
  const alreadyChosen = c.lutadorManeuvers ?? [];
  const remainingManeuvers = LUTADOR_MANEUVERS.filter(m => !alreadyChosen.includes(m));
  const [maneuverPicks, setManeuverPicks] = useState<string[]>([]);
  // Lutador Nv9
  const [saveMastery, setSaveMastery] = useState<'Fortitude' | 'Reflexos' | 'Astúcia' | 'Vontade' | ''>('');
  const [saveTrained, setSaveTrained] = useState<string>('');
  // Lista de TRs candidatos a Treinado (a Técnica usa Astúcia/Vontade no Mestre,
  // o Lutador usa Fortitude/Reflexos — o que virou Mestre é filtrado abaixo).
  const trainableSaves = ['Fortitude', 'Reflexos', 'Astúcia', 'Vontade'];
  // Técnica: fundamentos
  const fundJaTem = c.tecnicaFundamentos ?? [];
  const fundDisponiveis = TECNICA_FUNDAMENTOS.filter(f => {
    if (fundJaTem.includes(f)) return false;
    const det = TECNICA_FUNDAMENTO_DETAILS[f];
    return c.level >= det.unlockLevel;
  });
  const [fundPicks, setFundPicks] = useState<string[]>([]);
  // Técnica: foco
  const [focoPick, setFocoPick] = useState<TecnicaFoco | ''>('');
  // Técnica: extra spell
  const [spellName, setSpellName] = useState('');
  // Talento que precisa de modal de opções (gerado pelo UniversalChoiceLauncher).
  const [universalPendingOpts, setUniversalPendingOpts] = useState<{
    talentId: string;
    talentName: string;
    kind: TalentOptionsKind;
    level: number;
    source: 'level' | 'asi' | 'origin' | 'training_skill';
  } | null>(null);
  const applyEstudoAmaldicoado = useCharacterStore(s => s.applyEstudoAmaldicoado);

  const toggleManeuver = (m: string, max: number) => {
    setManeuverPicks(prev => {
      if (prev.includes(m)) return prev.filter(x => x !== m);
      if (prev.length >= max) return prev;
      return [...prev, m];
    });
  };

  const toggleFundamento = (f: string, max: number) => {
    setFundPicks(prev => {
      if (prev.includes(f)) return prev.filter(x => x !== f);
      if (prev.length >= max) return prev;
      return [...prev, f];
    });
  };

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-2 space-y-1.5">
      <div className="text-xs text-foreground">{choice.label}</div>

      {/* ===== skill_or_talent ===== */}
      {choice.kind === 'skill_or_talent' && !choice.resolved && (
        <div className="space-y-1.5">
          <UniversalChoiceLauncher
            character={c}
            level={choice.level}
            source="level"
            initialTab="class"
            onPickedAbility={(abilityId, abilityName) => {
              // Compra direta no level-up — não consome do pool (a escolha em si é o crédito).
              const ok = useCharacterStore.getState().chooseSpecAbility(c.id, abilityId, { skipPoolConsumption: true });
              if (ok) {
                onResolve(`skill:${abilityId}`);
                addLog('system', `⚔ ${c.name}: Habilidade "${abilityName}" (Nv ${choice.level})`);
              }
            }}
            onPickedTalent={(talentId, talentName) => {
              const optKind = talentNeedsOptions(talentId);
              if (optKind) {
                setUniversalPendingOpts({ talentId, talentName, kind: optKind, level: choice.level, source: 'level' });
                return;
              }
              useCharacterStore.getState().addTalent(c.id, talentId, choice.level, undefined, 'level');
              onResolve(`talent:${talentId}`);
              addLog('system', `🎓 ${c.name}: Talento "${talentName}" (Nv ${choice.level})`);
            }}
          />
          <button
            onClick={() => {
              playClickSound();
              onResolve('skill');
              addLog('system', `⏳ ${c.name}: ponto de Habilidade/Talento (Nv ${choice.level}) adiado para o pool.`);
            }}
            className="w-full rounded-md border border-dashed border-primary/50 bg-primary/5 px-2 py-1 text-xs font-semibold text-primary/80 hover:bg-primary/15 hover:text-primary transition-smooth"
            title="Credita 1 ponto no pool de Habilidades de Especialização — pode ser gasto depois pelo Catálogo (Habilidade ou Talento)."
          >
            ⏳ Adiar — creditar 1 ponto ao pool
          </button>
        </div>
      )}
      {choice.kind === 'skill_or_talent' && choice.resolved && (
        <div className="text-xs text-muted-foreground italic">
          ✓ Resolvido: <strong>{choice.value}</strong>
        </div>
      )}

      {/* ===== asi_milestone ===== */}
      {choice.kind === 'asi_milestone' && (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                playClickSound();
                setPick('A');
                // Abre o dialog PRIMEIRO. Só resolve a escolha e credita
                // +2 availableAttrPoints ao confirmar (onApplied). Isso evita
                // desmontar a row durante a transição e impede que o pointer-up
                // do clique caia "fora" do dialog, fechando-o.
                if (!choice.resolved) {
                  resolvePendingLevelChoice(c.id, choice.id, 'A');
                  addLog('system', `✓ ${c.name}: ${choice.label} → A: Atributo +2`);
                }
                // Delay maior que o tick de reconciliação + animação de abertura
                // do Dialog pai (Radix), para que o overlay já esteja "travado".
                setTimeout(() => setAsiOpen(true), 60);
              }}
              className={cn(
                'flex-1 rounded-md border px-2 py-1 text-xs font-bold transition-colors',
                choice.value === 'A' || pick === 'A'
                  ? 'border-primary bg-primary/30 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/40',
              )}
            >A: Atributo +2</button>
            <button
              onClick={() => { playClickSound(); setPick('B'); }}
              disabled={choice.resolved}
              className={cn(
                'flex-1 rounded-md border px-2 py-1 text-xs font-bold transition-colors disabled:opacity-50',
                choice.value === 'B' || pick === 'B'
                  ? 'border-accent bg-accent/30 text-accent-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-accent/40',
              )}
            >B: Talento Geral</button>
          </div>
          {pick === 'B' && !choice.resolved && (
            <TalentChooser
              character={c}
              level={choice.level}
              source="asi"
              onConfirm={(talentId) => onResolve(`B:${talentId}`)}
            />
          )}
          {choice.resolved && choice.value === 'A' && (
            <div className="text-xs text-muted-foreground italic">
              {(c.availableAttrPoints ?? 0) > 0
                ? `Faltam ${c.availableAttrPoints} ponto(s) — clique novamente em "A: Atributo +2" para distribuir.`
                : '✓ Pontos distribuídos.'}
            </div>
          )}
        </div>
      )}

      {/* ===== derivado_attr_milestone ===== */}
      {choice.kind === 'derivado_attr_milestone' && (
        <div className="space-y-1.5">
          <div className="flex items-start gap-2 rounded-md border border-accent/40 bg-accent/10 p-2 text-xs text-accent-foreground">
            <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Bônus da Origem Derivado:</strong> +1 ponto livre que <em>quebra o limite máximo</em> do atributo escolhido (ex.: 20 → 21).
            </span>
          </div>
          {!choice.resolved ? (
            <div className="flex gap-1.5">
              <select
                value={attrName}
                onChange={(e) => setAttrName(e.target.value)}
                className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">— Escolha um atributo —</option>
                {(c.attributes ?? []).map(a => (
                  <option key={a.id} value={a.name}>
                    {a.name} (atual {a.value} / cap {c.attrCaps?.[a.name] ?? 20})
                  </option>
                ))}
              </select>
              <button
                disabled={!attrName}
                onClick={() => {
                  resolvePendingLevelChoice(c.id, choice.id, attrName);
                  addLog('system', `✓ ${c.name}: ${choice.label} → ${attrName}`);
                  setDerivadoOpen(true);
                }}
                className="rounded-md bg-accent/30 border border-accent px-2 text-xs font-bold text-accent-foreground hover:bg-accent/50 disabled:opacity-40"
              ><Check className="inline h-3 w-3" /></button>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic">
              {(c.availableAttrPoints ?? 0) > 0
                ? `+1 ponto pendente para `
                : '✓ Bônus aplicado em '}
              <strong>{choice.value}</strong>.
              {(c.availableAttrPoints ?? 0) > 0 && (
                <button
                  onClick={() => { playClickSound(); setDerivadoOpen(true); }}
                  className="ml-2 underline hover:text-foreground"
                >Distribuir agora</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== skill_training_talent_choice ===== */}
      {choice.kind === 'skill_training_talent_choice' && (
        <div className="flex gap-1.5">
          <button
            onClick={() => onResolve('A')}
            className="flex-1 rounded-md border border-primary/60 bg-primary/20 px-2 py-1 text-xs font-bold text-primary hover:bg-primary/40"
          >A: +2 Treinos</button>
          <button
            onClick={() => onResolve('B')}
            className="flex-1 rounded-md border border-accent/60 bg-accent/20 px-2 py-1 text-xs font-bold text-accent-foreground hover:bg-accent/40"
          >B: +1 Maestria</button>
        </div>
      )}

      {/* ===== cursed_aptitude (DEPRECATED — sistema antigo) ===== */}
      {choice.kind === 'cursed_aptitude' && (
        <button
          onClick={() => onResolve('legacy')}
          className="w-full rounded-md bg-muted/30 border border-muted-foreground/30 px-2 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted/50"
          title="Sistema antigo de Aptidão Amaldiçoada — substituído pelo novo Perfil Amaldiçoado numérico. Marque como resolvido para limpar."
        >
          <Check className="inline h-3 w-3 mr-1" />
          Marcar como resolvido (legado)
        </button>
      )}

      {/* ===== aptitude_distribute (Perfil Amaldiçoado numérico) ===== */}
      {choice.kind === 'aptitude_distribute' && (
        <AptitudeDistributePanel character={c} choice={choice} />
      )}

      {/* ===== pending_aptitude_choice (Catálogo de Aptidões) ===== */}
      {choice.kind === 'pending_aptitude_choice' && !choice.resolved && (
        <PendingAptitudeChoicePanel character={c} />
      )}
      {choice.kind === 'pending_aptitude_choice' && choice.resolved && (
        <div className="text-xs text-muted-foreground italic">
          ✓ Aptidão escolhida: <strong>{choice.value}</strong>
        </div>
      )}

      {/* ===== lutador_initial_maneuvers / lutador_extra_maneuver ===== */}
      {(choice.kind === 'lutador_initial_maneuvers' || choice.kind === 'lutador_extra_maneuver') && (() => {
        const max = choice.kind === 'lutador_initial_maneuvers' ? 2 : 1;
        return (
          <div className="space-y-1.5">
            <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-foreground">
              <Swords className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary" />
              <span>
                Escolha <strong>{max}</strong> manobra(s) da lista de Empolgação.
                {alreadyChosen.length > 0 && (
                  <> Já possui: <em>{alreadyChosen.join(', ')}</em>.</>
                )}
              </span>
            </div>
            {!choice.resolved ? (
              <>
                <div className="space-y-1.5">
                  {remainingManeuvers.map(m => {
                    const sel = maneuverPicks.includes(m);
                    const det = LUTADOR_MANEUVER_DETAILS[m as LutadorManeuver];
                    return (
                      <div
                        key={m}
                        className={cn(
                          'rounded-md border transition-colors',
                          sel ? 'border-primary bg-primary/10' : 'border-border bg-background/40 hover:border-primary/40',
                        )}
                      >
                        <button
                          onClick={() => { playClickSound(); toggleManeuver(m, max); }}
                          className="w-full text-left px-2 py-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'inline-flex h-4 w-4 items-center justify-center rounded border text-xs font-bold',
                              sel ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                            )}>{sel ? '✓' : ''}</span>
                            <span className="text-xs font-bold text-foreground">{m}</span>
                            <span className="ml-auto text-xs uppercase tracking-wider text-muted-foreground">{det.cost.split('·')[0].trim()}</span>
                          </div>
                          <p className="mt-1 text-xs italic text-muted-foreground">{det.short}</p>
                          <div className="mt-1 space-y-0.5 text-xs text-foreground/85">
                            <div><strong className="text-amber-400">Custo:</strong> {det.cost}</div>
                            <div><strong className="text-amber-400">Quando:</strong> {det.trigger}</div>
                            <div><strong className="text-amber-400">Efeito:</strong> {det.effect}</div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  disabled={maneuverPicks.length !== max}
                  onClick={() => onResolve(JSON.stringify(maneuverPicks))}
                  className="w-full rounded-md bg-primary/30 border border-primary px-2 py-1 text-xs font-bold text-primary hover:bg-primary/50 disabled:opacity-40"
                >
                  <Check className="inline h-3 w-3 mr-1" />
                  Confirmar ({maneuverPicks.length}/{max})
                </button>
              </>
            ) : (
              <div className="text-xs text-muted-foreground italic">
                ✓ Manobras escolhidas: <strong>{(() => { try { return (JSON.parse(choice.value || '[]') as string[]).join(', '); } catch { return choice.value; } })()}</strong>
              </div>
            )}
          </div>
        );
      })()}

      {/* ===== lutador_save_mastery ===== */}
      {choice.kind === 'lutador_save_mastery' && (
        <div className="space-y-1.5">
          <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-foreground">
            <ShieldCheck className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary" />
            <span>Promova <strong>Fortitude OU Reflexos</strong> para Mestre e escolha <strong>1 novo TR</strong> para Treinado.</span>
          </div>
          {!choice.resolved ? (
            <>
              <div className="flex gap-1.5">
                {(['Fortitude', 'Reflexos'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => { playClickSound(); setSaveMastery(s); }}
                    className={cn(
                      'flex-1 rounded-md border px-2 py-1 text-xs font-bold transition-colors',
                      saveMastery === s
                        ? 'border-primary bg-primary/30 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/40',
                    )}
                  >{s} (Mestre)</button>
                ))}
              </div>
              <select
                value={saveTrained}
                onChange={(e) => setSaveTrained(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">— TR para Treinado —</option>
                {trainableSaves.filter(s => s !== saveMastery).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                disabled={!saveMastery || !saveTrained}
                onClick={() => onResolve(JSON.stringify({ mastery: saveMastery, trained: saveTrained }))}
                className="w-full rounded-md bg-primary/30 border border-primary px-2 py-1 text-xs font-bold text-primary hover:bg-primary/50 disabled:opacity-40"
              ><Check className="inline h-3 w-3 mr-1" />Confirmar</button>
            </>
          ) : (
            <div className="text-xs text-muted-foreground italic">
              ✓ {(() => { try { const d = JSON.parse(choice.value || '{}'); return `Mestre: ${d.mastery} · Treinado: ${d.trained}`; } catch { return choice.value; } })()}
            </div>
          )}
        </div>
      )}

      {/* ===== tecnica_save_mastery (Nv 9 — Astúcia OU Vontade → Mestre + 1 TR Treinado) ===== */}
      {choice.kind === 'tecnica_save_mastery' && (
        <div className="space-y-1.5">
          <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-foreground">
            <ShieldCheck className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary" />
            <span>Promova <strong>Astúcia OU Vontade</strong> para Mestre e escolha <strong>1 novo TR</strong> qualquer para Treinado.</span>
          </div>
          {!choice.resolved ? (
            <>
              <div className="flex gap-1.5">
                {(['Astúcia', 'Vontade'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => { playClickSound(); setSaveMastery(s); }}
                    className={cn(
                      'flex-1 rounded-md border px-2 py-1 text-xs font-bold transition-colors',
                      saveMastery === s
                        ? 'border-primary bg-primary/30 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/40',
                    )}
                  >{s} (Mestre)</button>
                ))}
              </div>
              <select
                value={saveTrained}
                onChange={(e) => setSaveTrained(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">— TR para Treinado —</option>
                {trainableSaves.filter(s => s !== saveMastery).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                disabled={!saveMastery || !saveTrained}
                onClick={() => onResolve(JSON.stringify({ mastery: saveMastery, trained: saveTrained }))}
                className="w-full rounded-md bg-primary/30 border border-primary px-2 py-1 text-xs font-bold text-primary hover:bg-primary/50 disabled:opacity-40"
              ><Check className="inline h-3 w-3 mr-1" />Confirmar</button>
            </>
          ) : (
            <div className="text-xs text-muted-foreground italic">
              ✓ {(() => { try { const d = JSON.parse(choice.value || '{}'); return `Mestre: ${d.mastery} · Treinado: ${d.trained}`; } catch { return choice.value; } })()}
            </div>
          )}
        </div>
      )}

      {choice.kind === 'master_skill' && (
        <div className="flex gap-1.5">
          <select
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">— Escolha uma perícia —</option>
            {(c.skills ?? []).filter(s => !s.mastery).map(s => (
              <option key={s.id} value={s.id}>{s.name}{s.trained ? ' (Treinada)' : ''}</option>
            ))}
          </select>
          <button
            disabled={!skillId}
            onClick={() => {
              const sk = (c.skills ?? []).find(s => s.id === skillId);
              if (!sk) return;
              onUpdateCharacter({
                skills: (c.skills ?? []).map(x => x.id === skillId ? { ...x, mastery: true, trained: false } : x),
              });
              onResolve(`Mestre em ${sk.name}`);
            }}
            className="rounded-md bg-primary/30 border border-primary px-2 text-xs font-bold text-primary hover:bg-primary/50 disabled:opacity-40"
          ><Sparkles className="inline h-3 w-3" /></button>
        </div>
      )}

      {/* Dialog: ASI — distribuir 2 pontos (cap 2 por atributo, ou seja, +2 num atrib OU +1 em dois) */}
      {choice.kind === 'asi_milestone' && (
        <AttributeSpendDialog
          open={asiOpen}
          onOpenChange={setAsiOpen}
          character={c}
          perAttrCap={2}
          requireSpendAll
          linkChoiceId={choice.id}
          hint={`Marco Nv ${choice.level}: distribua os 2 pontos. Você pode escolher 2× +1 (atributos diferentes) ou 1× +2 (mesmo atributo).`}
        />
      )}

      {/* Dialog: Derivado — distribuir o +1 (que quebra cap, já expandido em +1 ao resolver) */}
      {choice.kind === 'derivado_attr_milestone' && choice.value && (
        <AttributeSpendDialog
          open={derivadoOpen}
          onOpenChange={setDerivadoOpen}
          character={c}
          perAttrCap={1}
          requireSpendAll
          lockedTo={[choice.value]}
          linkChoiceId={choice.id}
          hint={`Origem Derivado: aplique o +1 em ${choice.value} (limite expandido em +1).`}
        />
      )}

      {/* ===== tecnica_fundamentos_initial / tecnica_fundamentos_extra ===== */}
      {(choice.kind === 'tecnica_fundamentos_initial' || choice.kind === 'tecnica_fundamentos_extra') && (() => {
        const max = choice.kind === 'tecnica_fundamentos_initial' ? 2 : 1;
        return (
          <div className="space-y-1.5">
            <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-foreground">
              <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary" />
              <span>
                Escolha <strong>{max}</strong> Mudança(s) de Fundamento.
                {fundJaTem.length > 0 && (
                  <> Já possui: <em>{fundJaTem.join(', ')}</em>.</>
                )}
                {' '}Feitiço Rápido fica bloqueado até o Nv 6.
              </span>
            </div>
            {!choice.resolved ? (
              <>
                <div className="space-y-1.5">
                  {fundDisponiveis.map(f => {
                    const sel = fundPicks.includes(f);
                    const det = TECNICA_FUNDAMENTO_DETAILS[f as TecnicaFundamento];
                    return (
                      <button
                        key={f}
                        onClick={() => { playClickSound(); toggleFundamento(f, max); }}
                        className={cn(
                          'w-full text-left rounded-md border px-2 py-1.5 transition-colors',
                          sel ? 'border-primary bg-primary/10' : 'border-border bg-background/40 hover:border-primary/40',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'inline-flex h-4 w-4 items-center justify-center rounded border text-xs font-bold',
                            sel ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                          )}>{sel ? '✓' : ''}</span>
                          <span className="text-xs font-bold text-foreground">{f}</span>
                        </div>
                        <p className="mt-1 text-xs italic text-muted-foreground">{det.short}</p>
                        <p className="text-xs text-foreground/85"><strong className="text-amber-400">Efeito:</strong> {det.effect}</p>
                      </button>
                    );
                  })}
                  {fundDisponiveis.length === 0 && (
                    <div className="text-xs text-muted-foreground italic">
                      Sem novas Mudanças disponíveis no seu nível atual.
                    </div>
                  )}
                </div>
                <button
                  disabled={fundPicks.length !== max}
                  onClick={() => onResolve(JSON.stringify(fundPicks))}
                  className="w-full rounded-md bg-primary/30 border border-primary px-2 py-1 text-xs font-bold text-primary hover:bg-primary/50 disabled:opacity-40"
                >
                  <Check className="inline h-3 w-3 mr-1" />
                  Confirmar ({fundPicks.length}/{max})
                </button>
              </>
            ) : (
              <div className="text-xs text-muted-foreground italic">
                ✓ Aprendeu: <strong>{(() => { try { return (JSON.parse(choice.value || '[]') as string[]).join(', '); } catch { return choice.value; } })()}</strong>
              </div>
            )}
          </div>
        );
      })()}

      {/* ===== tecnica_foco ===== */}
      {choice.kind === 'tecnica_foco' && (
        <div className="space-y-1.5">
          <div className="flex items-start gap-2 rounded-md border border-accent/40 bg-accent/10 p-2 text-xs text-accent-foreground">
            <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>Escolha 1 Foco. A escolha é permanente e injeta a passiva correspondente.</span>
          </div>
          {!choice.resolved ? (
            <>
              <div className="space-y-1.5">
                {TECNICA_FOCOS.map(f => {
                  const sel = focoPick === f;
                  const det = TECNICA_FOCO_DETAILS[f];
                  return (
                    <button
                      key={f}
                      onClick={() => { playClickSound(); setFocoPick(f); }}
                      className={cn(
                        'w-full text-left rounded-md border px-2 py-1.5 transition-colors',
                        sel ? 'border-accent bg-accent/10' : 'border-border bg-background/40 hover:border-accent/40',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'inline-flex h-4 w-4 items-center justify-center rounded border text-xs font-bold',
                          sel ? 'border-accent bg-accent text-accent-foreground' : 'border-muted-foreground/40',
                        )}>{sel ? '✓' : ''}</span>
                        <span className="text-xs font-bold text-foreground">{f}</span>
                      </div>
                      <p className="mt-1 text-xs italic text-muted-foreground">{det.short}</p>
                      <p className="text-xs text-foreground/85"><strong className="text-amber-400">Efeito:</strong> {det.effect}</p>
                    </button>
                  );
                })}
              </div>
              <button
                disabled={!focoPick}
                onClick={() => onResolve(focoPick)}
                className="w-full rounded-md bg-accent/30 border border-accent px-2 py-1 text-xs font-bold text-accent-foreground hover:bg-accent/50 disabled:opacity-40"
              >
                <Check className="inline h-3 w-3 mr-1" /> Confirmar
              </button>
            </>
          ) : (
            <div className="text-xs text-muted-foreground italic">
              ✓ Foco Amaldiçoado: <strong>{choice.value}</strong>
            </div>
          )}
        </div>
      )}

      {/* ===== tecnica_extra_spell — concede +1 slot automaticamente ===== */}
      {choice.kind === 'tecnica_extra_spell' && (
        <div className="space-y-1.5">
          <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-foreground">
            <Wand2 className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary" />
            <span>
              Você ganha <strong>+1 slot de Feitiço</strong>. Cadastre o feitiço na aba <strong>Feitiços</strong> quando quiser.
            </span>
          </div>
          {!choice.resolved ? (
            <button
              onClick={() => onResolve('auto')}
              className="w-full rounded-md bg-primary/30 border border-primary px-2 py-1 text-xs font-bold text-primary hover:bg-primary/50"
            >
              <Check className="inline h-3 w-3 mr-1" /> Confirmar (+1 slot)
            </button>
          ) : (
            <div className="text-xs text-muted-foreground italic">
              ✓ +1 slot de Feitiço concedido.
            </div>
          )}
        </div>
      )}

      {/* ===== tecnica_refino_grant (Foco Refino: 1 Feitiço OU Aptidão grátis) ===== */}
      {choice.kind === 'tecnica_refino_grant' && (
        <div className="space-y-1.5">
          <div className="flex items-start gap-2 rounded-md border border-accent/40 bg-accent/10 p-2 text-xs text-accent-foreground">
            <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Refino:</strong> ganhe <strong>1 Feitiço</strong> OU <strong>1 Aptidão Amaldiçoada</strong> grátis.
              Cadastre na aba correspondente e registre o nome aqui (auditoria).
            </span>
          </div>
          {!choice.resolved ? (
            <RefinoGrantChooser
              character={c}
              onResolved={(value) => onResolve(value)}
            />
          ) : (
            <div className="text-xs text-muted-foreground italic">
              ✓ Ganhou: <strong>{choice.value}</strong>
            </div>
          )}
        </div>
      )}

      {universalPendingOpts && (
        <TalentOptionsDialog
          character={c}
          kind={universalPendingOpts.kind}
          onCancel={() => setUniversalPendingOpts(null)}
          onConfirm={(choices) => {
            const { talentId, talentName, level, kind, source } = universalPendingOpts;
            useCharacterStore.getState().addTalent(c.id, talentId, level, choices, source);
            if (kind === 'estudo-amaldicoado' && choices.aptitudes) {
              const [k1, k2] = choices.aptitudes.split(',') as [AptitudeKey, AptitudeKey];
              applyEstudoAmaldicoado(c.id, [k1, k2]);
            }
            const detail = kind === 'fisico-aperfeicoado'
              ? ` [opção ${choices.fisicoOption}${choices.fisicoSkill ? '/' + choices.fisicoSkill : ''}]`
              : kind === 'quebra-limites'
              ? ` [+2 ${choices.attr} & +2 ${choices.attr2}]`
              : ` [+1 ${choices.aptitudes}]`;
            addLog('system', `🎓 ${c.name}: Talento "${talentName}" (Nv ${level})${detail}`);
            setUniversalPendingOpts(null);
            onResolve(`talent:${talentId}`);
          }}
        />
      )}
    </div>
  );
}

/**
 * Botão "Abrir Catálogo de Talentos" + render do modal. Ao escolher um
 * talento, registra via `addTalent` no store e marca a pendência como resolvida.
 */
function TalentChooser({
  character,
  level,
  source,
  onConfirm,
}: {
  character: Character;
  level: number;
  source: 'level' | 'asi' | 'origin' | 'training_skill';
  onConfirm: (talentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pendingOpts, setPendingOpts] = useState<{ talentId: string; talentName: string; kind: TalentOptionsKind } | null>(null);
  const addTalent = useCharacterStore(s => s.addTalent);
  const applyEstudoAmaldicoado = useCharacterStore(s => s.applyEstudoAmaldicoado);
  const addLog = useLogStore(s => s.addLog);

  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed border-accent/40 bg-accent/5 p-2">
      <BookOpen className="h-3.5 w-3.5 mt-0.5 text-accent flex-shrink-0" />
      <div className="flex-1 text-xs text-muted-foreground italic">
        Escolha um Talento do catálogo. Pré-requisitos não atendidos ficam bloqueados.
      </div>
      <button
        onClick={() => { playClickSound(); setOpen(true); }}
        className="rounded-md bg-accent/30 border border-accent px-2 py-1 text-xs font-bold text-accent-foreground hover:bg-accent/50"
      >Abrir Catálogo</button>

      {open && (
        <TalentCatalogModal
          character={character}
          onClose={() => setOpen(false)}
          allowedTabs={['talent']}
          initialTab="talent"
          onPick={(t) => {
            const optKind = talentNeedsOptions(t.id);
            if (optKind) {
              setPendingOpts({ talentId: t.id, talentName: t.name, kind: optKind });
              setOpen(false);
              return;
            }
            addTalent(character.id, t.id, level, undefined, source);
            addLog('system', `🎓 ${character.name}: Talento "${t.name}" (Nv ${level})`);
            setOpen(false);
            onConfirm(t.id);
          }}
        />
      )}

      {pendingOpts && (
        <TalentOptionsDialog
          character={character}
          kind={pendingOpts.kind}
          onCancel={() => setPendingOpts(null)}
          onConfirm={(choices) => {
            const { talentId, talentName, kind } = pendingOpts;
            addTalent(character.id, talentId, level, choices, source);
            if (kind === 'estudo-amaldicoado' && choices.aptitudes) {
              const [k1, k2] = choices.aptitudes.split(',') as [AptitudeKey, AptitudeKey];
              applyEstudoAmaldicoado(character.id, [k1, k2]);
            }
            addLog('system', `🎓 ${character.name}: Talento "${talentName}" (Nv ${level})`);
            setPendingOpts(null);
            onConfirm(talentId);
          }}
        />
      )}
    </div>
  );
}

/**
 * Lançador do modal universal (3 abas) usado pelo `skill_or_talent`.
 * Compra é instantânea ao selecionar — o modal fecha sozinho via callback.
 */
function UniversalChoiceLauncher({
  character,
  level,
  source: _source,
  initialTab,
  onPickedAbility,
  onPickedTalent,
}: {
  character: Character;
  level: number;
  source: 'level' | 'asi' | 'origin' | 'training_skill';
  initialTab?: 'class' | 'talent' | 'aptitude';
  onPickedAbility: (abilityId: string, abilityName: string) => void;
  onPickedTalent: (talentId: string, talentName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  void level; void _source;

  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
      <BookOpen className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
      <div className="flex-1 text-xs text-muted-foreground italic">
        Abra o catálogo e escolha 1 <strong>Habilidade da Classe</strong> ou 1 <strong>Talento</strong>.
        A escolha consome o ponto deste nível.
      </div>
      <button
        onClick={() => { playClickSound(); setOpen(true); }}
        className="rounded-md bg-primary/30 border border-primary px-2 py-1 text-xs font-bold text-primary hover:bg-primary/50"
      >Abrir Catálogo</button>

      {open && (
        <TalentCatalogModal
          character={character}
          onClose={() => setOpen(false)}
          initialTab={initialTab}
          onPickAny={(pick) => {
            if (pick.kind === 'spec_ability') {
              onPickedAbility(pick.ability.id, pick.ability.name);
            } else {
              onPickedTalent(pick.talent.id, pick.talent.name);
            }
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

export function dismissPendingChoice(charId: string, choiceId: string) {
  // Helper exportável caso CharacterCard queira um botão "X" externo.
  useCharacterStore.getState().removePendingLevelChoice(charId, choiceId);
  void X; // referência intencional para evitar tree-shake do ícone se reusado
}

// ===== Aptidão Amaldiçoada — painel de distribuição numérica =================

interface AptPanelProps {
  character: Character;
  choice: PendingLevelChoice;
}

function AptitudeDistributePanel({ character: c, choice }: AptPanelProps) {
  const bumpAptitude = useCharacterStore(s => s.bumpAptitude);
  const apts = { ...createDefaultCursedAptitudes(), ...(c.cursedAptitudes ?? {}) };
  const eff = choice.appliedEffect ?? {};
  const total = Number(choice.value) + Object.values(eff.aptitudeSpends ?? {}).reduce((s, v) => s + (v || 0), 0);
  const remaining = eff.pointsRemaining ?? Number(choice.value) ?? 0;
  const spends = eff.aptitudeSpends ?? {};
  const globalRemaining = c.pendingAptitudePoints ?? 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-xs">
        <span className="font-bold text-accent-foreground">
          <Sparkles className="inline h-3 w-3 mr-1" />
          Pontos restantes neste nível
        </span>
        <span className="font-mono font-bold text-accent-foreground">
          {remaining} / {total}
        </span>
      </div>
      <div className="space-y-1">
        {APTITUDE_KEYS.map((k: AptitudeKey) => {
          const label = APTITUDE_LABELS[k];
          const value = apts[k] ?? 0;
          const spentHere = spends[k] ?? 0;
          const canInc = value < APTITUDE_MAX && remaining > 0 && globalRemaining > 0;
          const canDec = spentHere > 0 && value > 0;
          return (
            <div
              key={k}
              className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1"
              title={label.desc}
            >
              <span className="w-10 text-center rounded bg-primary/30 px-1 py-0.5 text-xs font-mono font-bold text-primary">
                {label.short}
              </span>
              <span className="flex-1 text-xs text-foreground">{label.full}</span>
              <button
                onClick={() => { playClickSound(); bumpAptitude(c.id, choice.id, k, -1); }}
                disabled={!canDec}
                className="h-6 w-6 rounded-md border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-10 text-center font-mono text-xs font-bold text-foreground">
                {value} / {APTITUDE_MAX}
              </span>
              <button
                onClick={() => { playSuccessSound(); bumpAptitude(c.id, choice.id, k, 1); }}
                disabled={!canInc}
                className="h-6 w-6 rounded-md border border-primary/40 bg-primary/15 text-primary hover:bg-primary/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
      {remaining > 0 && (
        <p className="text-xs italic text-destructive">
          ⚠ Distribua todos os {remaining} ponto(s) restantes para concluir.
        </p>
      )}
    </div>
  );
}

// ===== PendingAptitudeChoicePanel =========================================
// Branch UI para `pending_aptitude_choice`. Abre um modal com o Catálogo
// de Aptidões de Aura (futuramente CL/BAR/DOM/ER). Ao escolher, o store
// consome 1 ponto de `availableAuraChoices` e marca o tracker resolvido.
function PendingAptitudeChoicePanel({ character: c }: { character: Character }) {
  const [open, setOpen] = useState(false);
  const [snapshotChosen, setSnapshotChosen] = useState((c.chosenAuraAptitudes ?? []).length);
  const pool = c.availableAuraChoices ?? 0;
  const chosenCount = (c.chosenAuraAptitudes ?? []).length;
  // Fecha o modal automaticamente após uma nova escolha bem-sucedida.
  useEffect(() => {
    if (open && chosenCount > snapshotChosen) {
      setOpen(false);
      setSnapshotChosen(chosenCount);
    }
  }, [open, chosenCount, snapshotChosen]);
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-foreground">
        <Sparkles className="h-3 w-3 mt-0.5 flex-shrink-0 text-primary" />
        <span>
          Você ganhou <strong>1 escolha</strong> no Catálogo de Aptidões Amaldiçoadas.
          Pool atual: <span className="font-mono font-bold text-primary">{pool}</span>.
        </span>
      </div>
      <button
        onClick={() => { playClickSound(); setSnapshotChosen(chosenCount); setOpen(true); }}
        className="w-full rounded-md border border-primary/60 bg-primary/20 px-2 py-1.5 text-xs font-bold text-primary hover:bg-primary/40"
      >
        <BookOpen className="inline h-3 w-3 mr-1" />
        Abrir Catálogo de Aptidões
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Catálogo de Aptidões Amaldiçoadas
              <span className="ml-auto text-xs font-mono text-muted-foreground">
                Escolhas restantes: {pool}
              </span>
            </DialogTitle>
          </DialogHeader>
          <UnifiedAptitudeCatalog character={c} onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== RefinoGrantChooser ================================================
// Em vez de pedir um nome solto, abre o Catálogo de Aptidões Amaldiçoadas OU
// o Assistente de Criação de Feitiço. Quando o jogador concluir uma das duas
// rotas, marca a pendência como resolvida automaticamente.
function RefinoGrantChooser({
  character: c,
  onResolved,
}: {
  character: Character;
  onResolved: (value: string) => void;
}) {
  const [aptOpen, setAptOpen] = useState(false);
  const [spellOpen, setSpellOpen] = useState(false);
  const addSpell = useCharacterStore(s => s.addSpell);
  const [snapshotChosen, setSnapshotChosen] = useState((c.chosenAuraAptitudes ?? []).length);
  const chosenCount = (c.chosenAuraAptitudes ?? []).length;

  // Detecta nova aptidão escolhida → resolve a pendência.
  useEffect(() => {
    if (aptOpen && chosenCount > snapshotChosen) {
      const last = (c.chosenAuraAptitudes ?? [])[chosenCount - 1];
      const label = (last as any)?.aptitudeId ?? 'Aptidão';
      setAptOpen(false);
      setSnapshotChosen(chosenCount);
      onResolved(`Aptidão: ${label}`);
    }
  }, [aptOpen, chosenCount, snapshotChosen, c.chosenAuraAptitudes, onResolved]);

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={() => { playClickSound(); setSpellOpen(true); }}
          className="rounded-md border border-primary/60 bg-primary/20 px-2 py-1.5 text-xs font-bold text-primary hover:bg-primary/40"
        >
          <Wand2 className="inline h-3 w-3 mr-1" /> Criar Feitiço
        </button>
        <button
          onClick={() => { playClickSound(); setSnapshotChosen(chosenCount); setAptOpen(true); }}
          className="rounded-md border border-accent/60 bg-accent/20 px-2 py-1.5 text-xs font-bold text-accent-foreground hover:bg-accent/40"
        >
          <BookOpen className="inline h-3 w-3 mr-1" /> Catálogo de Aptidões
        </button>
      </div>

      <Dialog open={aptOpen} onOpenChange={setAptOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Catálogo de Aptidões Amaldiçoadas (Refino — grátis)
            </DialogTitle>
          </DialogHeader>
          <UnifiedAptitudeCatalog character={c} onClose={() => setAptOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={spellOpen} onOpenChange={setSpellOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              Criar Feitiço Grátis (Refino)
            </DialogTitle>
          </DialogHeader>
          <SpellCreationAssistant
            charLevel={c.level}
            currentSpellCount={c.spells.length}
            onAdd={(spell) => {
              addSpell(c.id, spell);
              setSpellOpen(false);
              onResolved(`Feitiço: ${spell.name}`);
            }}
            onCancel={() => setSpellOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
