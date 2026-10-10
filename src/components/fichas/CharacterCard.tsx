import { EmpunharArmaButton } from './EmpunharArmaButton';
import { PortasDaMorteCard } from './PortasDaMorteCard';
import { SoltarItemButton } from './SoltarItemButton';
import { OmniItemImagem } from '@/components/omni/OmniItemImagem';
import { ContadoresEquipamento } from '@/components/omni/ContadoresEquipamento';
import { consumeCritNegated } from '@/lib/suporteNegacao';
import { implementoMarcialBonus } from '@/lib/golpeEspecial';
import { InspiradoButton } from './SuporteNivel4Sections';
import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { Character, Attribute, Passive, Spell, ActiveBuff, DAMAGE_TYPES, DAMAGE_TYPE_LABELS, DAMAGE_TYPE_ABBR, DamageType, SpellBuff, createEmptyRdByType, CHARACTER_CLASSES, CharacterClass, SPECIALIZATIONS, Specialization, MOTIVATIONS, Motivation, ORIGINS, Origin, createEmptyAccessorySlots, AccessorySlots, ItemSlotType, ITEM_SLOT_LABELS, ALL_CONDITIONS, SPELL_LEVELS, SpellLevel, SpellCondition, SPELL_RANGES, SPELL_TARGET_MODES, SpellTargetMode, getTrainingBonus, getMasteryBonus, getLevelSkillBonus, getBaseAttackBonus, getTrainingValue, SaveAttr, SAVE_ATTRS, APTITUDE_KEYS, APTITUDE_LABELS, APTITUDE_MAX, createDefaultCursedAptitudes, type AptitudeKey } from '@/types';
import { SpellCreationAssistant } from './SpellCreationAssistant';
import { OmniVinculadosList } from './OmniVinculadosList';
import { podeUsarVersaoAprovada } from '@/lib/controlador/aprovacao';
import { BlindfoldSlot } from './BlindfoldSlot';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useItemStore } from '@/stores/useItemStore';
import { useLogStore } from '@/stores/useLogStore';
import { useReactionStore } from '@/stores/useReactionStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useInventoryStore, type InventoryItem } from '@/stores/useInventoryStore';
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { SYSTEM_ACTIONS } from '@/lib/omni/constantesDoSistema';
import { normalizarCombatData } from '@/lib/omni/tipos';
import { resolverAcumuloOmni, selectOmniModifiers, selectOmniPassiveBonuses } from '@/lib/omni/omniBridge';
import { listarDiagnosticosMitigacaoDano } from '@/lib/omni/mitigacoesDano';
import { derivarPassivasContinuas } from '@/lib/omni/passivasDerivadas';
import { aggregateSpecChoices } from '@/lib/specChoiceEffects';
import { aggregateSpecAbilityEffects } from '@/lib/specAbilityEffects';
import {
  aplicarEfeitoNoPersonagem,
  descreverAcaoEfeito,
  recursoBonito,
  validarDestinoAplicacao,
} from '@/lib/omni/aplicarEfeito';
import { executarCombatEffect, validarEfeitosAtivosDaFicha } from '@/lib/omni/executarSubEfeito';
import { useSpellProposalStore } from '@/stores/useSpellProposalStore';
import { usePassiveProposalStore } from '@/stores/usePassiveProposalStore';
import { rollD20Com, rollDiceCom } from '@/lib/dice';
import { perguntarFortuna } from '@/lib/fortuna';
import { posturaPericia } from '@/lib/posturas';
import { ehFurtividade, penalidadeChamativa, presencaSuprimidaBonus } from '@/lib/presencaSuprimida';
import { guardaEstudadaTrBonus } from '@/lib/guardaEstudada';

import { hasSpecAbility } from '@/lib/suporteNivel2';
import { PRE_ANALISE_ATENCAO, PRE_ANALISE_ID } from '@/lib/suportePreAnaliseRecompensa';
import { consumeAdvantageFor, consumeFlatBonusFor, applyAdvantageToD20 } from '@/lib/omni/rollAdvantage';
import { maybeApplyRecompensa } from '@/lib/suportePreAnaliseRecompensa';
import { cn } from '@/lib/utils';
import { getReactionsAvailable } from '@/lib/reactionBudget';
import { Eye, EyeOff, Dice1, ChevronDown, ChevronUp, Zap, Plus, X, Heart, Sparkles, Shield, Backpack, Star, Crosshair, RotateCcw, Gem, ScrollText, ShieldAlert, AlertTriangle, HelpCircle, Wand2, Moon, Wallet, Sword, Trash2 } from 'lucide-react';
import { playDiceSound, playClickSound, playToggleSound, playSuccessSound, playErrorSound, playFichaToggleSound } from '@/lib/sounds';
import { NullSafeInput } from './NullSafeInput';
import { StatusBar } from './StatusBar';
import { StatValue, type StatModifierOrigin } from './StatValue';
import { toast } from 'sonner';
import { listarRecursosAlterados, montarMensagemEquipar, type ChaveBonusEquipado } from '@/lib/omni/omniBonusLabels';
import { HungerBar } from './HungerBar';
import { ExhaustionControl } from './ExhaustionControl';
import { getExhaustionHpReduction } from '@/lib/exhaustionEffects';
import { DeleteConfirm } from './DeleteConfirm';
import { SpellApplyDialog } from './SpellApplyDialog';
import { ActiveConcentrationPanel } from './ActiveConcentrationPanel';
import { SpellLevelGuide } from './SpellLevelGuide';
import { LevelUpDialog } from './LevelUpDialog';
import { CamCoreTabs } from './CamCoreTabs';
import { FahPanel } from './FahPanel';
import { SpecReactionsPanel } from './SpecReactionsPanel';
import { SpecActionsPanel } from './SpecActionsPanel';
import { SuportePanel } from './SuportePanel';
import { CombateEstilosPanel } from './CombateEstilosPanel';
import { AttackPanel } from './AttackPanel';
import { AcoesAtivasSection } from './AcoesAtivasSection';
import { CamDeathReactionDialog } from './CamDeathReactionDialog';
import { PendingLevelChoicesPanel, hasPendingChoices } from './PendingLevelChoicesPanel';
import { PendingSummaryButton } from './PendingSummaryButton';
import { ConquistasButton } from '@/components/conquistas/ConquistasButton';
import { AttributeSpendDialog } from './AttributeSpendDialog';
import { PoolGrantDialog } from './PoolGrantDialog';
import { SorcererRankBadge } from './SorcererRankBadge';
import { SpecAbilitiesPanel, EmpolgacaoPanel } from './SpecAbilitiesPanel';
import { OmniItemDescription } from '@/components/omni/OmniItemDescription';
import { ItemDetailsDialog, type ItemDetailsTarget } from './ItemDetailsDialog';
import { AuraAptitudesPanel } from './AuraAptitudesPanel';
import { ClAptitudesPanel } from './ClAptitudesPanel';
import { DomAptitudesPanel } from './DomAptitudesPanel';
import { BarAptitudesPanel } from './BarAptitudesPanel';
import { ErAptitudesPanel } from './ErAptitudesPanel';
import { SpecialAptitudesPanel } from './SpecialAptitudesPanel';
import { CursedExclusivePanel } from './CursedExclusivePanel';
import { DotesPanel } from './DotesPanel';
import { isCamActive } from '@/lib/camCores';
import { getPassiveSpellLevel, isPassiveActive, getMaxSpells } from '@/lib/spellRules';
import { applyOriginEffects } from '@/lib/originEngine';
import { getTrainingBonusByLevel, getHitDiceMax, MAX_LEVEL, getKeyAttrForSpec } from '@/lib/levelEngine';
import { aggregateTalentBonuses } from '@/lib/talentEffects';
import { aggregateAuraEffects, getPendingAbsorbedDice, hasKokusen, getKokusenCritThreshold } from '@/lib/auraEffects';
import { aggregateConditionMods, getDefenseModFromConditions, getSkillModFromConditions, getAutoCritFromConditions } from '@/lib/conditionEffects';
import { useCombatStore } from '@/stores/useCombatStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { notifyMissedRangedAttack } from '@/stores/useReactionStore';
import { TalentBonusBadge } from './TalentBonusBadge';
import { RestModal } from './RestModal';
import { PreparedSpellsDialog } from './PreparedSpellsDialog';
import { useAttributeLockConfirm } from './AttributeLockConfirm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getMobilidadeBonus } from '@/lib/movementBudget';
import { getOtimizacaoSlotsBonus } from '@/lib/suporteProtetor';

interface Props {
  character: Character;
  /** Esconde o Painel de Ataque (usado no mapa: ele vive na hotbar do turno). */
  hideAttackPanel?: boolean;
  /** Reorganiza o cabeçalho para a coluna lateral estreita do mapa. */
  compactHeader?: boolean;
}

interface RollResult {
  label: string;
  d20: number;
  bonus: number;
  total: number;
  hitResults?: { name: string; hit: 'hit' | 'miss' | 'crit' | 'critFail' }[];
}

/** Calculate D&D-style attribute modifier: (value - 10) / 2, floored */
export function getAttrModifier(value: number): number {
  return Math.floor((value - 10) / 2);
}

/* ─── Smooth collapsible wrapper (height-based, animação garantida em todos os navegadores) ─── */
function SmoothCollapse({ open, children, className }: { open: boolean; children: React.ReactNode; className?: string }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>(open ? 'auto' : 0);
  const firstRender = useRef(true);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    // Primeiro render: aplica estado final sem animar
    if (firstRender.current) {
      firstRender.current = false;
      setHeight(open ? 'auto' : 0);
      return;
    }

    if (open) {
      // Abrindo: 0 → scrollHeight → auto
      const target = el.scrollHeight;
      setHeight(0);
      // força reflow antes de transicionar
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(target));
      });
      const timeout = setTimeout(() => setHeight('auto'), 620);
      return () => clearTimeout(timeout);
    } else {
      // Fechando: auto → scrollHeight → 0
      const current = el.scrollHeight;
      setHeight(current);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0));
      });
    }
  }, [open]);

  return (
    <div
      aria-hidden={!open}
      className={cn('overflow-hidden', className)}
      style={{
        height: height === 'auto' ? 'auto' : `${height}px`,
        opacity: open ? 1 : 0,
        transitionProperty: 'height, opacity',
        transitionDuration: open ? '600ms, 400ms' : '450ms, 250ms',
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        transitionDelay: open ? '0ms, 80ms' : '0ms, 0ms',
        willChange: height === 'auto' ? 'auto' : 'height, opacity',
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

/* ─── Collapsible Section ─── */
function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-secondary/30 transition-colors">
        <span className="text-primary">{icon}</span>
        <span className="flex-1 text-sm font-bold uppercase tracking-wider text-foreground">{title}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <SmoothCollapse open={open}>
        <div className="px-3 pb-3 pt-1">{children}</div>
      </SmoothCollapse>
    </div>
  );
}

/* ─── Multi-Target Damage/Heal Panel ─── */
function DamageHealPanel({ sourceId, sourceName }: { sourceId: string; sourceName: string }) {
  const characters = useCharacterStore((s) => s.characters);
  const { applyDamage, applyHealing, applyShield, updateCharacter, consumeElementalAbsorption } = useCharacterStore();
  const addLog = useLogStore((s) => s.addLog);
  const [value, setValue] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([sourceId]);

  // Fase 6 — Plug de Aptidões de Aura no dano:
  // 1) Absorção Elemental armada → rolar Xd6/d8/d10 e somar ao valor (+ consumir).
  // 2) Afinidade Ampliada → adicionar bônus de dano elemental por tipo escolhido.
  const source = characters.find((cc) => cc.id === sourceId);
  const auraEffectsForDmg = source ? aggregateAuraEffects(source) : null;
  const pendingAbs = source ? getPendingAbsorbedDice(source) : null;
  const afinidadeBonus = auraEffectsForDmg?.afinidadeDamageBonus ?? 0;
  const afinidadeElem = auraEffectsForDmg?.chosenElement;

  const rollAbsorptionAndAdd = () => {
    if (!pendingAbs || !source) return;
    const rolls: number[] = [];
    let total = 0;
    for (let i = 0; i < pendingAbs.count; i++) {
      const r = Math.floor(Math.random() * pendingAbs.sides) + 1;
      rolls.push(r);
      total += r;
    }
    const current = parseInt(value);
    const base = isNaN(current) ? 0 : current;
    setValue(String(base + total));
    consumeElementalAbsorption(sourceId);
    addLog(
      'roll',
      `🔮 ${sourceName}: Absorção Elemental (${pendingAbs.element}) → ${pendingAbs.count}d${pendingAbs.sides} [${rolls.join(', ')}] = +${total} dano (somado ao valor; absorção consumida).`,
    );
  };

  const addAfinidadeBonus = () => {
    if (afinidadeBonus <= 0) return;
    const current = parseInt(value);
    const base = isNaN(current) ? 0 : current;
    setValue(String(base + afinidadeBonus));
    addLog(
      'roll',
      `✨ ${sourceName}: Afinidade Ampliada${afinidadeElem ? ` (${afinidadeElem})` : ''} → +${afinidadeBonus} de dano somado ao valor.`,
    );
  };


  const toggleTarget = (id: string) => {
    setSelectedTargets((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedTargets(characters.map((c) => c.id));
  const selectNone = () => setSelectedTargets([]);

  const applyToTargets = (action: 'damage' | 'heal' | 'shield' | 'damageShield' | 'rd') => {
    const v = parseInt(value);
    if (isNaN(v) || selectedTargets.length === 0) return;
    if (action === 'rd') {
      const targetNames: string[] = [];
      selectedTargets.forEach((id) => {
        const target = characters.find((c) => c.id === id);
        if (!target) return;
        targetNames.push(target.name);
        updateCharacter(id, { rd: v });
      });
      addLog('combat', `🛡 ${sourceName} definiu RD=${v} em: ${targetNames.join(', ')}`);
      setValue('');
      return;
    }
    if (v <= 0) return;
    const targetNames: string[] = [];
    const source = characters.find((c) => c.id === sourceId);
    // Fase 10 — Kokusen: consome flag se armada (×1.5 dano + ignoresRD).
    const kokusenArmed = action === 'damage' && !!source?.kokusenArmedDamage;
    // Fase 10 — Faíscas Negras (buff de cena): +CL no dano CaC.
    const faiscasDmgBonus = action === 'damage' && source?.kokusenSceneBuffActive
      ? (source.cursedAptitudes?.CL ?? 0)
      : 0;
    selectedTargets.forEach((id) => {
      const target = characters.find((c) => c.id === id);
      if (!target) return;
      targetNames.push(target.name);
      if (action === 'damage') {
        let dmg = v + faiscasDmgBonus;
        if (kokusenArmed) dmg = Math.floor(dmg * 1.5);
        // PvP reduction: 66% less damage when player attacks player
        if (source && source.category === 'PLAYER' && target.category === 'PLAYER') {
          dmg = Math.floor(dmg * 0.34);
        }
        applyDamage(id, dmg, undefined, kokusenArmed ? { ignoresRD: true } : undefined);
      }
      else if (action === 'heal') applyHealing(id, v);
      else if (action === 'shield') applyShield(id, v);
      else if (action === 'damageShield') {
        const newEsc = Math.max(0, target.escCurrent - v);
        updateCharacter(id, { escCurrent: newEsc });
      }
    });
    if (kokusenArmed) {
      updateCharacter(sourceId, { kokusenArmedDamage: false });
    }
    const emojis: Record<string, string> = { damage: '⚔️', heal: '💚', shield: '🛡', damageShield: '💔' };
    const labels: Record<string, string> = { damage: 'dano', heal: 'cura', shield: 'escudo', damageShield: 'dano ao escudo' };
    const suffix = action === 'damage'
      ? `${kokusenArmed ? ' [KOKUSEN ×1.5 ignora RD]' : ''}${faiscasDmgBonus > 0 ? ` [Faíscas Negras +${faiscasDmgBonus}]` : ''}`
      : '';
    addLog('combat', `${emojis[action]} ${sourceName} aplicou ${v} de ${labels[action]} em: ${targetNames.join(', ')}${suffix}`);
    setValue('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Valor"
          className="h-8 flex-1 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
        />
        <button onClick={() => applyToTargets('damage')} className="h-8 rounded-lg bg-hp/20 px-2 text-sm font-medium text-hp hover:bg-hp/30 transition-colors">-HP</button>
        <button onClick={() => applyToTargets('heal')} className="h-8 rounded-lg bg-neon-green/20 px-2 text-sm font-medium text-neon-green hover:bg-neon-green/30 transition-colors">+HP</button>
        <button onClick={() => applyToTargets('shield')} className="h-8 rounded-lg bg-shield/20 px-2 text-sm font-medium text-shield hover:bg-shield/30 transition-colors">+ESC</button>
        <button onClick={() => applyToTargets('damageShield')} className="h-8 rounded-lg bg-orange-400/20 px-2 text-sm font-medium text-orange-400 hover:bg-orange-400/30 transition-colors">-ESC</button>
        <button onClick={() => applyToTargets('rd')} className="h-8 rounded-lg bg-secondary px-2 text-sm font-medium text-muted-foreground hover:bg-secondary/80 transition-colors">RD</button>
      </div>

      {/* Fase 6 — Aura: absorção pendente / bônus de afinidade */}
      {(pendingAbs || afinidadeBonus > 0) && (
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1">
          {pendingAbs && (
            <button
              onClick={rollAbsorptionAndAdd}
              className="h-7 rounded-md bg-primary/20 px-2 text-xs font-medium text-primary hover:bg-primary/30 transition-colors"
              title={`Rola ${pendingAbs.count}d${pendingAbs.sides} (${pendingAbs.element}) e soma ao valor; consome a absorção armada.`}
            >
              🔮 Absorção {pendingAbs.count}d{pendingAbs.sides} ({pendingAbs.element})
            </button>
          )}
          {afinidadeBonus > 0 && (
            <button
              onClick={addAfinidadeBonus}
              className="h-7 rounded-md bg-accent/20 px-2 text-xs font-medium text-accent-foreground hover:bg-accent/30 transition-colors"
              title={`Soma +${afinidadeBonus} ao valor (Afinidade Ampliada${afinidadeElem ? ` — ${afinidadeElem}` : ''}).`}
            >
              ✨ Afinidade +{afinidadeBonus}{afinidadeElem ? ` (${afinidadeElem})` : ''}
            </button>
          )}
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Crosshair className="h-3 w-3" /> Alvos ({selectedTargets.length})
          </span>
          <div className="flex gap-1">
            <button onClick={selectAll} className="text-sm text-primary hover:text-primary/80 px-1">Todos</button>
            <button onClick={selectNone} className="text-sm text-muted-foreground hover:text-foreground px-1">Nenhum</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {characters.map((char) => (
            <button
              key={char.id}
              onClick={() => toggleTarget(char.id)}
              className={cn(
                'rounded-full px-2 py-0.5 text-sm font-medium border transition-all duration-200',
                selectedTargets.includes(char.id)
                  ? 'bg-primary/20 text-primary border-primary/40 shadow-sm shadow-primary/20'
                  : 'bg-secondary/30 text-muted-foreground border-border hover:border-primary/30'
              )}
            >
              {char.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CharacterCard({ character: c, hideAttackPanel, compactHeader = false }: Props) {
  const role = useRoleStore((s) => s.role);
  const isPlayer = role === 'PLAYER';
  const isMaster = role === 'MASTER';
  const canSeeCombatDefense = !isPlayer || c.category === 'PLAYER';
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const combatInProgress = useCombatStore((s) => s.inCombat);
  const activeTurnCharId = useCombatStore((s) => s.initiativeOrder[s.currentTurnIndex]?.charId);
  const movementActionUsed = useCombatStore((s) => !!s.movementActionUsedByChar?.[c.id]);
  const canManageThisCharacter = !isPlayer || (!!activeProfileId && c.profileId === activeProfileId);
  const unableToMove = (c.hpCurrent ?? 1) <= 0 || (c.activeConditions ?? []).some((condition) =>
    ['atordoado', 'inconsciente', 'indefeso', 'imovel', 'morto', 'paralisado', 'desmaiado'].includes(condition.conditionId),
  );
  const canStandFromProne = canManageThisCharacter && !unableToMove && (!combatInProgress || (activeTurnCharId === c.id && !movementActionUsed));
  // Omni-Engine: rolagens deste personagem passam pelo contexto de reroll.
  const rollD20 = () => rollD20Com(c.id);
  const rollDice = (notation: string) => rollDiceCom(c.id, notation);
  const submitSpellProposal = useSpellProposalStore((s) => s.submit);
  const submitPassiveProposal = usePassiveProposalStore((s) => s.submit);
  const [expanded, setExpanded] = useState(false);
  const [auraCatalogOpen, setAuraCatalogOpen] = useState(false);
  const [clCatalogOpen, setClCatalogOpen] = useState(false);
  const [domCatalogOpen, setDomCatalogOpen] = useState(false);
  const [barCatalogOpen, setBarCatalogOpen] = useState(false);
  const [erCatalogOpen, setErCatalogOpen] = useState(false);
  const [specialCatalogOpen, setSpecialCatalogOpen] = useState(false);
  const [cursedCatalogOpen, setCursedCatalogOpen] = useState(false);
  const [dotesCatalogOpen, setDotesCatalogOpen] = useState(false);
  const auraSectionRef = useRef<HTMLDivElement | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [poolGrantOpen, setPoolGrantOpen] = useState(false);
  const [showDamagePanel, setShowDamagePanel] = useState(false);
  const [pendingSpell, setPendingSpell] = useState<Spell | null>(null);
  /** Quando um feitiço em área é lançado por uma maldição (master), guardamos os alvos atingidos. */
  const [pendingSpellAreaTargets, setPendingSpellAreaTargets] = useState<string[] | null>(null);
  const [pendingSpellAreaMode, setPendingSpellAreaMode] = useState<boolean>(false);
  const [pendingSpellAreaTemplateId, setPendingSpellAreaTemplateId] = useState<string | null>(null);
  const [rollResult, setRollResult] = useState<RollResult | null>(null);
  const [rollAnimating, setRollAnimating] = useState(false);
  /** Presença Suprimida: marca rolagens de Furtividade feitas após ação chamativa. */
  const [acaoChamativa, setAcaoChamativa] = useState(false);

  const [removing, setRemoving] = useState(false);
  const [showRestModal, setShowRestModal] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showDeathPrompt, setShowDeathPrompt] = useState(false);
  const [showAttrSpend, setShowAttrSpend] = useState(false);
  // Detalhes de itens (inventário e acessórios) — clique abre modal.
  const [itemDetails, setItemDetails] = useState<ItemDetailsTarget | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Confirmação obrigatória ao vincular atributo a CaC/CD/TR (irreversível).
  const { request: requestAttrLock, dialog: attrLockDialog } = useAttributeLockConfirm();

  // CAM: dispara o prompt de Reação quando o HP do núcleo ativo cai a 0
  // (apenas se ainda não estiver Morrendo e tiver pelo menos 1 outro núcleo).
  useEffect(() => {
    if (!isCamActive(c)) return;
    if (c.dying) return;
    if (c.hpCurrent > 0) return;
    const hasSwitchable = (c.cores ?? []).some(
      co => !co.destroyed && !co.damaged && co.id !== c.activeCoreId,
    );
    if (hasSwitchable) setShowDeathPrompt(true);
  }, [c.hpCurrent, c.dying, c.cores, c.activeCoreId, c]);


  // Click outside to close edit mode
  useEffect(() => {
    if (!editMode) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setEditMode(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editMode]);

  const { updateCharacter, removeCharacter, addAttribute, removeAttribute, addSkill, removeSkill, addSavingThrow, removeSavingThrow, addPassive, removePassive, addSpell, updateSpell, removeSpell, resetActions, addCondition, removeCondition, triggerKokusen } = useCharacterStore();
  const items = useItemStore((s) => s.items);
  const addLog = useLogStore((s) => s.addLog);
  const [showAddCondition, setShowAddCondition] = useState(false);
  const [manualCondId, setManualCondId] = useState(ALL_CONDITIONS[0].id);
  const [manualCondTurns, setManualCondTurns] = useState(1);
  const [manualCondRounds, setManualCondRounds] = useState(0);
  const levantar = (conditionId: string) => {
    if (!canStandFromProne) return;
    if (!useCombatStore.getState().spendMovementAction(c.id)) {
      toast.error('Ação de movimento indisponível: só é possível levantar no seu turno, uma vez por turno.');
      return;
    }
    removeCondition(c.id, conditionId);
    addLog('combat', `${c.name} gastou uma ação de movimento para se levantar.`);
  };

  const effects = c.origin ? applyOriginEffects(c.origin, c.level, {}) : null;
  // Especialista em Técnica usa fórmula própria de slots:
  //   Base = 3 no Nv 1 e +1 a CADA nível subsequente (não acumula em pares).
  //   → slots = level + 2 (Lv1=3, Lv11=13, Lv20=22).
  // Talento "Afinidade com Técnica": +1 imediato + 1 para cada marco {5,10,15,20}
  // já alcançado pelo personagem (retroativo se comprado depois).
  const isTecnica = c.characterClass === 'Feiticeiro' && c.specialization === 'Especialista em Técnica';
  const hasAfinidadeTecnica = (c.chosenTalents ?? []).some(t => t.id === 'tal-afinidade-tecnica');
  const afinidadeBonus = hasAfinidadeTecnica
    ? 1 + [5, 10, 15, 20].filter(n => c.level >= n).length
    : 0;
  const tecnicaBaseSlots = c.level + 2;
  const maxSpells = isTecnica
    ? tecnicaBaseSlots + (effects?.extraSpellsImmediate ?? 0) + (effects?.automation?.extraSpells ?? 0) + afinidadeBonus
    : c.characterClass === 'Feiticeiro'
      ? getMaxSpells(c.level) + (effects?.extraSpellsImmediate ?? 0) + (effects?.automation?.extraSpells ?? 0) + afinidadeBonus
      : getMaxSpells(c.level) + afinidadeBonus;

  const availableTags: { label: string; discountPE: number }[] = [];
  // Conta quantos feitiços já possuem cada tag especial. Limite = 1 por origem.
  const countSpellsWithTag = (tag: string) =>
    (c.spells || []).filter(s => (s.description || '').includes(`[${tag}:`)).length;
  if (effects?.extraSpellTag) {
    const tagLimit = 1;
    if (countSpellsWithTag(effects.extraSpellTag) < tagLimit) {
      availableTags.push({ label: effects.extraSpellTag, discountPE: 1 });
    }
  }
  if (effects?.tags?.some(t => t.startsWith('Feitiço Focado'))) {
    if (countSpellsWithTag('Feitiço Focado') < 1) {
      availableTags.push({ label: 'Feitiço Focado', discountPE: 1 });
    }
  }

  const activePassives = c.passives.filter(p => isPassiveActive(p, c.level));
  // Mutável: somamos abaixo os bônus das passivas Omni vinculadas
  // (após o omniEntidadesMap estar disponível, ainda neste mesmo render).
  const passiveBonuses = activePassives.reduce(
    (acc, p) => ({
      hp: acc.hp + p.bonusHP, pe: acc.pe + p.bonusPE, esc: acc.esc + p.bonusESC,
      slots: acc.slots + p.bonusSlots, rd: acc.rd + p.bonusRD, ca: acc.ca + p.bonusCA,
    }),
    { hp: 0, pe: 0, esc: 0, slots: 0, rd: 0, ca: 0 }
  );

  const passiveRdByType: Record<DamageType, number> = createEmptyRdByType();
  activePassives.forEach(p => {
    if (p.bonusRdByType) {
      DAMAGE_TYPES.forEach(t => {
        passiveRdByType[t] += (p.bonusRdByType![t] || 0);
      });
    }
  });

  const accessorySlots = c.accessorySlots || createEmptyAccessorySlots();

  // Get all item IDs that are in accessory slots
  const slottedItemIds = new Set<string>();
  if (accessorySlots.colar) slottedItemIds.add(accessorySlots.colar);
  accessorySlots.aneis.forEach(id => { if (id) slottedItemIds.add(id); });
  accessorySlots.pulseiras.forEach(id => { if (id) slottedItemIds.add(id); });

  const equippedItems = items.filter((i) => i.assignedTo.includes(c.id));
  // Omni-Engine: mapeia itens (por nome) para entidades com combatData,
  // permitindo o botão de ação no inventário (Atacar / Curar / Aplicar).
  const omniEntidadesMap = useOmniEntidadesStore((s) => s.entidades);
  const omniByName = (() => {
    const m = new Map<string, typeof omniEntidadesMap[string]>();
    Object.values(omniEntidadesMap).forEach((e) => {
      const cd = normalizarCombatData(e.combatData);
      // Só registra como "atacável" itens com Script Ativo (efeitos ativos).
      if (cd && (cd.effectsActive?.length ?? 0) > 0) m.set(e.nome.trim().toLowerCase(), e);
    });
    return m;
  })();

  // ===== Bônus passivos vindos de entidades Omni VINCULADAS "sempre ativas" =====
  // Categorias `passiva`, `talento` e `aura` contribuem com modificadores
  // permanentes (HP, PE, CA, RD, ESC, Slots) usando a mesma matemática
  // que acessórios equipados, mas SEM exigir slotType — elas existem na
  // ficha pelo simples fato de estarem vinculadas.
  //
  // Categorias deixadas de fora aqui:
  //  • `feitico` → só tem efeito quando conjurado (botão Usar).
  //  • `condicao` → tem seu próprio runtime (`useOmniRuntimeStore`).
  const CATEGORIAS_PASSIVAS_VINCULADAS = ['passiva', 'talento', 'aura'] as const;
  const entidadesPassivasVinculadas = (c.omniAtivos ?? [])
    .filter((a) => (CATEGORIAS_PASSIVAS_VINCULADAS as readonly string[]).includes(a.categoria))
    .map((a) => omniEntidadesMap[a.entidadeId])
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  const omniPassivasBonus = useMemo(
    () => selectOmniPassiveBonuses(c, entidadesPassivasVinculadas),
    [c, omniEntidadesMap],
  );
  const omniPassivasContinuas = useMemo(
    () => derivarPassivasContinuas(c),
    [c, omniEntidadesMap],
  );
  passiveBonuses.hp    += omniPassivasBonus.totals.hp;
  passiveBonuses.pe    += omniPassivasBonus.totals.pe;
  passiveBonuses.ca    += omniPassivasBonus.totals.ca;
  passiveBonuses.rd    += omniPassivasBonus.totals.rd;
  passiveBonuses.esc   += omniPassivasBonus.totals.esc;
  passiveBonuses.slots += omniPassivasBonus.totals.slots;
  /**
   * Executa o "Script Ativo" (Ação/Uso) de um item.
   * Aceita o nome (lookup pelo catálogo) ou uma EntidadeOmni explícita
   * (snapshot de inventário — preserva customizações da instância).
   * Quando `instance` é fornecida, faz gate de usos e injeta @ITEM.*.
   */
  const executarAcaoItem = async (
    arg: string | { entidade: { nome: string; combatData?: unknown }; instance?: InventoryItem },
  ) => {
    let nome: string;
    let cd: ReturnType<typeof normalizarCombatData>;
    let instance: InventoryItem | undefined;
    if (typeof arg === 'string') {
      const ent = omniByName.get(arg.trim().toLowerCase());
      cd = normalizarCombatData(ent?.combatData);
      nome = arg;
      // Tenta achar uma instância no inventário desse personagem com este nome.
      instance = Object.values(inventoryItems).find(
        (i) => i.ownerId === c.id && i.entity.nome.trim().toLowerCase() === arg.trim().toLowerCase(),
      );
    } else {
      cd = normalizarCombatData(arg.entidade.combatData);
      nome = arg.entidade.nome;
      instance = arg.instance
        ?? Object.values(inventoryItems).find(
          (i) => i.ownerId === c.id && i.entity.nome === arg.entidade.nome,
        );
    }
    const efeitosAtivos = cd?.effectsActive ?? [];
    if (!cd || efeitosAtivos.length === 0) return;

    // ─── Gate de usos ────────────────────────────────────────────────
    if (instance && instance.usosTotais !== undefined) {
      if ((instance.usosRestantes ?? 0) <= 0) {
        addLog('system', `⛔ ${nome}: sem cargas restantes (recarrega: ${instance.entity.usos?.recarga ?? '—'}).`);
        return;
      }
    }

    const usuarioVars = montarVariaveisDoPersonagem(c, 'USUARIO');
    const alvoVars = usuarioVars; // sem picker de alvo nesta tela
    const itemVars: Record<string, number> = instance?.usosTotais !== undefined
      ? {
          usos_restantes: instance.usosRestantes ?? 0,
          usos_totais: instance.usosTotais ?? 0,
        }
      : {};
    const validacaoEfeitos = validarEfeitosAtivosDaFicha(efeitosAtivos, {
      usuarioId: c.id,
      usuarioVars,
      alvoVars,
      itemVars,
      sourceInstanceId: instance?.instanceId,
    });
    if (!validacaoEfeitos.ok) {
      addLog('system', `⛔ ${nome}: efeito inválido — ${validacaoEfeitos.detalhe}`);
      return;
    }
    const efeitosIgnorados = new Set(validacaoEfeitos.ignorados);
    if (efeitosIgnorados.size === efeitosAtivos.length) {
      addLog('system', `ℹ️ ${nome}: nenhuma condição do item foi atendida.`);
      return;
    }
    const d20 = await rollD20Com(c.id);
    const isCrit = d20 >= (cd.critRange ?? 20);
    const mult = isCrit ? (cd.critMultiplier ?? 2) : 1;
    const resultados: number[] = [];
    const linhas: string[] = [];
    let erroExecucao: string | undefined;
    let efeitosExecutados = 0;
    const indicesExecutados = new Set<number>();
    efeitosAtivos.forEach((eff, idx) => {
      if (erroExecucao) { resultados.push(0); return; }
      if (efeitosIgnorados.has(idx)) {
        resultados.push(0);
        linhas.push(`#${idx + 1} condição não atendida`);
        return;
      }
      if (eff.condition?.trim()) {
        const condicao = avaliarFormula(eff.condition, usuarioVars, () => 0.5, {
          alvo: alvoVars, item: itemVars, resultados,
        });
        if (condicao.diagnosticos.length || !Number.isFinite(condicao.valor)) {
          erroExecucao = `Condição inválida: ${condicao.diagnosticos.map(d => d.mensagem).join('; ') || 'resultado não finito.'}`;
          resultados.push(0);
          return;
        }
        if (condicao.valor <= 0) {
          resultados.push(0);
          linhas.push(`#${idx + 1} condição não atendida`);
          return;
        }
      }
      // ─── 🎭 Keys especiais (diceSwitch / conditionApply / buttonOnly) ──
      // Roteiam pelo runtime unificado em vez do caminho numérico clássico.
      if (eff.diceSwitch || eff.conditionApply || eff.buttonOnly || eff.transferencia) {
        const r = executarCombatEffect(eff, {
          usuarioId: c.id,
          alvoId: c.id, // ficha não tem picker de alvo — herda do CharacterCard
          usuarioVars,
          alvoVars,
          itemVars,
          resultados,
          sourceName: nome,
          sourceEntityId: instance?.entity.id,
          sourceInstanceId: instance?.instanceId,
        });
        if (r.invalido) {
          erroExecucao = r.detalhe ?? 'O efeito especial não pôde ser executado.';
          resultados.push(0);
          linhas.push(`#${idx + 1} inválido: ${erroExecucao}`);
          return;
        }
        resultados.push(r.aplicado);
        efeitosExecutados++;
        indicesExecutados.add(idx);
        const recipiente =
          eff.target === 'USUARIO' ? c.name
          : eff.target === 'AREA' ? 'Área'
          : 'Alvo';
        linhas.push(`#${idx + 1} ${r.detalhe ?? '—'} em ${recipiente}`);
        return;
      }

      const vars = eff.target === 'USUARIO' ? usuarioVars : usuarioVars;
      const out = avaliarFormula(eff.formula, vars, undefined, {
        alvo: alvoVars,
        item: itemVars,
        resultados,
      });
      if (out.diagnosticos.length || !Number.isFinite(out.valor)) {
        erroExecucao = `Fórmula inválida: ${out.diagnosticos.map(d => d.mensagem).join('; ') || 'resultado não finito.'}`;
        resultados.push(0);
        linhas.push(`#${idx + 1} inválido: ${erroExecucao}`);
        return;
      }
      const total = eff.type === 'SUBTRAIR' ? Math.round(out.valor * mult) : Math.round(out.valor);
      resultados.push(total);
      const rollsTxt = out.rolagens.map((r) => `${r.notacao}=[${r.rolls.join(',')}]`).join(' ');
      const recursoLabel = descreverAcaoEfeito(eff.type, eff.resourcePath);
      const recurso = recursoBonito(eff.resourcePath);
      const recipiente =
        eff.target === 'USUARIO' ? c.name
        : eff.target === 'AREA' ? 'Área'
        : 'Alvo';

      // Caso especial: efeito mira `usos_restantes` do próprio item.
      const recursoLower = (eff.resourcePath || '').toLowerCase();
      let absorvidoPorBloqueio = false;
      const limitesVars = { alvo: alvoVars, item: itemVars, resultados: resultados.slice(0, -1) };
      const teto = eff.counterCap ? avaliarFormula(eff.counterCap, usuarioVars, undefined, limitesVars) : undefined;
      const limiteFonte = eff.counterSourceLimit ? avaliarFormula(eff.counterSourceLimit, usuarioVars, undefined, limitesVars) : undefined;
      const erroDoLimite = (rotulo: string, resultado: ReturnType<typeof avaliarFormula> | undefined): string | undefined => {
        if (!resultado) return undefined;
        if (resultado.diagnosticos.length) return `${rotulo}: ${resultado.diagnosticos.map(d => d.mensagem).join('; ')}`;
        if (resultado.rolagens.length) return `${rotulo}: precisa ser determinístico; dados aleatórios não são permitidos.`;
        if (!Number.isFinite(resultado.valor)) return `${rotulo}: valor não finito.`;
        if (resultado.valor < 0) return `${rotulo}: precisa ser não negativo.`;
        return undefined;
      };
      const erroLimite = erroDoLimite('teto global', teto) ?? erroDoLimite('teto por fonte', limiteFonte);
      if (erroLimite) {
        erroExecucao = `Teto inválido: ${erroLimite}`;
        resultados[resultados.length - 1] = 0;
        linhas.push(`#${idx + 1} inválido: ${erroExecucao}`);
        return;
      }
      if (recursoLower === 'usos_restantes' && instance) {
        aplicarEfeitoNoPersonagem(c.id, eff.type, eff.resourcePath, total, {
          peSpellReduction: eff.peSpellReduction,
          immunityGrant: eff.immunityGrant,
          sourceName: nome,
          damageType: eff.damageType,
          attackerId: c.id,
          itemInstanceId: instance.instanceId,
          contador: { teto: teto?.valor, porFonte: eff.counterPerSource, fonteId: c.id, limiteFonte: limiteFonte?.valor, periodoFonte: eff.counterSourcePeriod },
        });
      } else if (eff.target === 'USUARIO') {
        const r = aplicarEfeitoNoPersonagem(c.id, eff.type, eff.resourcePath, total, {
          peSpellReduction: eff.peSpellReduction,
          immunityGrant: eff.immunityGrant,
          sourceName: nome,
          damageType: eff.damageType,
          attackerId: c.id,
          itemInstanceId: instance?.instanceId,
          contador: { teto: teto?.valor, porFonte: eff.counterPerSource, fonteId: c.id, limiteFonte: limiteFonte?.valor, periodoFonte: eff.counterSourcePeriod },
        });
        if (r?.absorvidoPorBloqueio) absorvidoPorBloqueio = true;
      }
      if (recursoLower === 'usos_restantes' && instance || eff.target === 'USUARIO') {
        efeitosExecutados++;
        indicesExecutados.add(idx);
      }
      const sinal =
        absorvidoPorBloqueio ? '∅(bloqueio)' :
        eff.type === 'SUBTRAIR' ? `−${Math.abs(total)}`
        : eff.type === 'ADICIONAR' ? `+${total}`
        : `=${total}`;
      const tipo = eff.damageType && eff.type === 'SUBTRAIR' ? ` ${eff.damageType}` : '';
      linhas.push(
        `#${idx + 1} ${recursoLabel} ${sinal} em ${recurso} de ${recipiente}${tipo ? ` (${tipo.trim()})` : ''}${rollsTxt ? ` · ${rollsTxt}` : ''}`,
      );
    });

    if (erroExecucao) {
      addLog('system', `⛔ ${nome}: ação interrompida — ${erroExecucao}`);
      return;
    }
    if (efeitosExecutados === 0) {
      addLog('system', `ℹ️ ${nome}: nenhuma condição do item foi atendida.`);
      return;
    }

    // ─── Consumo automático de uso (se o script não decrementou) ─────
    const scriptDecrementou = efeitosAtivos.some((e, idx) => {
      if (!indicesExecutados.has(idx) || e.type !== 'SUBTRAIR') return false;
      const destino = validarDestinoAplicacao(e.resourcePath);
      return destino.ok && destino.canal === 'item';
    });
    const usoDepoisDosEfeitos = instance
      ? useInventoryStore.getState().items[instance.instanceId]?.usosRestantes
      : undefined;
    const consumoManualReal = scriptDecrementou && typeof usoDepoisDosEfeitos === 'number'
      && usoDepoisDosEfeitos < (instance?.usosRestantes ?? usoDepoisDosEfeitos);
    if (instance && instance.usosTotais !== undefined && !consumoManualReal) {
      useInventoryStore.getState().consumirUso(instance.instanceId, 1);
    }

    const icone = efeitosAtivos[0].type === 'ADICIONAR' ? '✚' : efeitosAtivos[0].type === 'MODIFICADOR' ? '✦' : '⚔';
    const usosTag = instance?.usosTotais !== undefined
      ? ` [${useInventoryStore.getState().items[instance.instanceId]?.usosRestantes ?? 0}/${instance.usosTotais}]`
      : '';
    addLog(
      'roll',
      `${icone} ${c.name} usa ${nome}${usosTag} → d20=${d20}${isCrit ? ' (CRÍTICO!)' : ''} · ${linhas.join(' | ')}`
    );
    playDiceSound();
  };
  // Compat: chamadores antigos passam só o nome.
  const handleAttackWithItem = (itemName: string) => executarAcaoItem(itemName);
  // Only accessories in slots provide bonuses
  const bonusItems = equippedItems.filter((i) => {
    if (!i.slotType || i.slotType === 'nenhum') return false;
    return slottedItemIds.has(i.id);
  });

  const itemBonuses = bonusItems.reduce(
    (acc, i) => ({
      hp: acc.hp + i.bonusHP, pe: acc.pe + i.bonusPE, esc: acc.esc + i.bonusESC,
      slots: acc.slots + i.bonusSlots, rd: acc.rd + i.bonusRD, ca: acc.ca + i.bonusCA,
      actions: acc.actions + (i.bonusActions || 0), bonusActions: acc.bonusActions + (i.bonusBonusActions || 0),
      reactions: acc.reactions + (i.bonusReactions || 0), opportunity: acc.opportunity + (i.bonusOpportunity || 0),
    }),
    { hp: 0, pe: 0, esc: 0, slots: 0, rd: 0, ca: 0, actions: 0, bonusActions: 0, reactions: 0, opportunity: 0 }
  );
  const effectiveActionsMax = c.isGrimorioCreature
    ? Math.min(2, c.actionsMax + itemBonuses.actions)
    : c.actionsMax + itemBonuses.actions;

  // Omni-Engine: instâncias de inventário e equipados.
  const inventoryItems = useInventoryStore((s) => s.items);
  const equipOmni = useInventoryStore((s) => s.equipItem);
  const unequipOmni = useInventoryStore((s) => s.unequipItem);
  const resolverEntidadeOmniAtual = (inv: InventoryItem) => omniEntidadesMap[inv.entity.id] ?? inv.entity;
  const ownedOmniInventoryInstances = Object.values(inventoryItems)
    .filter((inv) => inv.ownerId === c.id)
    .sort((a, b) => b.acquiredAt - a.acquiredAt)
    .map((inv) => ({
      ...inv,
      entity: resolverEntidadeOmniAtual(inv),
    }));
  const itemIntermediarioIds = new Set((c.invocacoesConhecidas ?? [])
    .filter(inv => podeUsarVersaoAprovada({ estado: inv.aprovacaoMestre, versaoAtual: inv.versaoModelo, versaoAprovada: inv.versaoAprovada }))
    .map(inv => inv.intermediario?.itemInventarioId)
    .filter((id): id is string => Boolean(id && inventoryItems[id]?.ownerId === c.id)));
  const espacosIntermediarios = itemIntermediarioIds.size * 0.5;
  const slotsAtualComIntermediarios = (c.slotsCurrent ?? 0) + espacosIntermediarios;
  const ownedOmniEntityIds = new Set(ownedOmniInventoryInstances.map((inv) => inv.entity.id));
  const legacyGeneralItems = equippedItems.filter(
    (i) => (!i.slotType || i.slotType === 'nenhum') && !ownedOmniEntityIds.has(i.id),
  );
  // Equip Logic: bônus Omni só ativam quando o item está num slot de Acessório
  // (slotType definido e ≠ 'nenhum'). Se o item for movido para a mochila
  // (unequip), `isEquipped` vira false e o bônus some instantaneamente.
  const equippedOmniInstances = ownedOmniInventoryInstances.filter(
    (inv) => inv.isEquipped
      && inv.entity.slotType
      && inv.entity.slotType !== 'nenhum',
  );
  // ===== OmniBridge: modificadores derivados das instâncias equipadas =====
  // Estado puramente derivado: NÃO escrevemos no store. A cada render
  // (incluindo level-up, mudança de atributo, equip/unequip), o useMemo
  // re-roda as fórmulas dos acessórios contra o personagem ATUAL e
  // produz um mapa fresco de modificadores e suas origens.
  //
  // Dependências do recálculo:
  //  • equippedOmniInstances → muda quando o jogador equipa/desequipa.
  //  • omniEntidadesMap     → muda quando o Mestre edita um item Omni.
  //  • c (Character)        → muda quando atributos/level/treino sobem.
  const omniModifiers = useMemo(
    () => selectOmniModifiers(c, equippedOmniInstances, omniEntidadesMap),
    [c, equippedOmniInstances, omniEntidadesMap],
  );
  const omniMitigationDiagnostics = useMemo(
    () => listarDiagnosticosMitigacaoDano(c),
    [c, equippedOmniInstances, omniEntidadesMap],
  );
  const omniFormulaDiagnostics = [
    ...omniModifiers.formulaDiagnostics,
    ...omniPassivasBonus.formulaDiagnostics,
    ...omniPassivasContinuas.diagnostics,
    ...omniMitigationDiagnostics,
  ];
  // Fontes Omni vinculadas e equipamentos concorrem na mesma chave; combinar
  // os arrays aqui evita somar os máximos de cada grupo novamente.
  const omniOriginsCombinadas = {
    hp: [...omniModifiers.origins.hp, ...omniPassivasBonus.origins.hp],
    pe: [...omniModifiers.origins.pe, ...omniPassivasBonus.origins.pe],
    ca: [...omniModifiers.origins.ca, ...omniPassivasBonus.origins.ca],
    rd: [...omniModifiers.origins.rd, ...omniPassivasBonus.origins.rd],
    esc: [...omniModifiers.origins.esc, ...omniPassivasBonus.origins.esc],
    slots: [...omniModifiers.origins.slots, ...omniPassivasBonus.origins.slots],
  };
  const omniTotalsCombinados = {
    hp: resolverAcumuloOmni(omniOriginsCombinadas.hp),
    pe: resolverAcumuloOmni(omniOriginsCombinadas.pe),
    ca: resolverAcumuloOmni(omniOriginsCombinadas.ca),
    rd: resolverAcumuloOmni(omniOriginsCombinadas.rd),
    esc: resolverAcumuloOmni(omniOriginsCombinadas.esc),
    slots: resolverAcumuloOmni(omniOriginsCombinadas.slots),
  };

  // passiveBonuses já contém as passivas Omni vinculadas. Somamos aos itens
  // apenas a diferença necessária para chegar ao total Omni combinado.
  itemBonuses.hp += omniTotalsCombinados.hp - omniPassivasBonus.totals.hp;
  itemBonuses.pe += omniTotalsCombinados.pe - omniPassivasBonus.totals.pe;
  itemBonuses.ca += omniTotalsCombinados.ca - omniPassivasBonus.totals.ca;
  itemBonuses.rd += omniTotalsCombinados.rd - omniPassivasBonus.totals.rd;
  itemBonuses.esc += omniTotalsCombinados.esc - omniPassivasBonus.totals.esc;
  itemBonuses.slots += omniTotalsCombinados.slots - omniPassivasBonus.totals.slots;

  // Hook de Reatividade: mesma fonte alimenta os tooltips (Base / Modificador / Origem).
  const omniOrigensPorChave: Record<ChaveBonusEquipado, StatModifierOrigin[]> = {
    hp: omniOriginsCombinadas.hp.map((o) => ({ nome: o.source, delta: o.delta, aplicado: o.applied })),
    pe: omniOriginsCombinadas.pe.map((o) => ({ nome: o.source, delta: o.delta, aplicado: o.applied })),
    ca: omniOriginsCombinadas.ca.map((o) => ({ nome: o.source, delta: o.delta, aplicado: o.applied })),
    rd: omniOriginsCombinadas.rd.map((o) => ({ nome: o.source, delta: o.delta, aplicado: o.applied })),
    esc: omniOriginsCombinadas.esc.map((o) => ({ nome: o.source, delta: o.delta, aplicado: o.applied })),
    slots: omniOriginsCombinadas.slots.map((o) => ({ nome: o.source, delta: o.delta, aplicado: o.applied })),
  };

  const desAttrCC = (c.attributes || []).find(a => a.name?.toUpperCase() === 'DES');
  const desModCC = desAttrCC ? Math.floor((desAttrCC.value - 10) / 2) : 0;
  const halfLevelCC = Math.floor((c.level || 1) / 2);
  // Aptidões de Aura — passivas escaláveis em AU (Aura Maciça, Reforçada, Elemental Reforçada…)
  const auraEffects = aggregateAuraEffects(c);
  const conditionMods = aggregateConditionMods(c);
  const dualWieldDefenseBonus = c.dualWielding ? aggregateTalentBonuses(c).dualWieldDefenseBonus : 0;
  // CA exibida = "neutra" (sem direcional). Bônus direcionais (Caído etc.) são
  // listados à parte e somados pelo motor de combate via computeTotalDefense
  // ao escolher CaC vs Distância.
  const totalCA = c.ca + desModCC + halfLevelCC + passiveBonuses.ca + itemBonuses.ca + auraEffects.caBonus + conditionMods.defense + dualWieldDefenseBonus;
  const caVsMelee = totalCA + conditionMods.defenseMelee;
  const caVsRanged = totalCA + conditionMods.defenseRanged;
  const hasDirectionalDef = conditionMods.defenseMelee !== 0 || conditionMods.defenseRanged !== 0;
  const totalBuffRD = (c.activeBuffs || []).filter(b => b.type === 'rd' && !b.rdDamageTypes?.length).reduce((s, b) => s + b.value, 0);
  const negacaoRDBuff = (c.activeBuffs || []).filter(b => b.type === 'negacaoRd').reduce((s, b) => s + b.value, 0);
  const totalRD = Math.max(0, c.rd + passiveBonuses.rd + itemBonuses.rd + totalBuffRD + negacaoRDBuff);
  const talentBonuses = aggregateTalentBonuses(c);
  const hpBonuses = passiveBonuses.hp + itemBonuses.hp + talentBonuses.hp;
  // Fichas antigas/temporárias podem chegar com hpMax=0 enquanto ainda têm PV.
  // Nesse caso preserva o melhor teto conhecido, em vez de publicar 0 no HUD.
  const baseHpMax = c.hpMax > 0
    ? c.hpMax + hpBonuses
    : Math.max(0, c.hpMaxEffective ?? 0, c.hpCurrent ?? 0);
  const exhaustionHpReduction = getExhaustionHpReduction(c.exhaustionLevel ?? 0, baseHpMax);
  const effectiveHpMax = Math.max(0, baseHpMax - exhaustionHpReduction);
  const effectivePeMax = c.peMax + passiveBonuses.pe + itemBonuses.pe + talentBonuses.pe;
  const effectiveEscMax = c.escMax + passiveBonuses.esc + itemBonuses.esc;
  const effectiveSlotsMax = c.slotsMax + passiveBonuses.slots + itemBonuses.slots + getOtimizacaoSlotsBonus(c);
  const effectiveAttention = (c.attention ?? 0) + talentBonuses.attention;
  const effectiveInitiative = (c.initiativeBonus ?? 0) + talentBonuses.initiative;

  const baseRdByType = c.rdByType ? { ...createEmptyRdByType(), ...c.rdByType } : createEmptyRdByType();
  const rdByType = { ...baseRdByType };
  DAMAGE_TYPES.forEach(t => { rdByType[t] += passiveRdByType[t]; });
  // Aura Reforçada → +2×AU em DCO/DP/DI
  if (auraEffects.physicalRDBonus > 0) {
    rdByType.DCO += auraEffects.physicalRDBonus;
    rdByType.DP += auraEffects.physicalRDBonus;
    rdByType.DI += auraEffects.physicalRDBonus;
  }
  // Aura Elemental Reforçada → RD por tipo elemental escolhido
  (Object.entries(auraEffects.elementalRDByType) as Array<[DamageType, number]>).forEach(([t, v]) => {
    if (v) rdByType[t] += v;
  });
  const nonZeroRds = DAMAGE_TYPES.filter((t) => rdByType[t] > 0);

  // Active buff bonuses
  const activeBuffs = c.activeBuffs || [];
  const buffCA = activeBuffs.filter(b => b.type === 'ca').reduce((s, b) => s + b.value, 0);
  const buffHit = activeBuffs.filter(b => b.type === 'hit').reduce((s, b) => s + b.value, 0);
  const buffRD = activeBuffs.filter(b => b.type === 'rd').reduce((s, b) => s + b.value, 0);
  const effectiveCA = totalCA + buffCA;

  // ===== CD efetiva — mesma lógica da CA, com atributo configurável (travado uma vez) =====
  const dcAttrCC = c.dcLinkedAttr ? (c.attributes || []).find(a => a.id === c.dcLinkedAttr) : undefined;
  const dcAttrModCC = dcAttrCC ? Math.floor((dcAttrCC.value - 10) / 2) : 0;
  const passiveDC = (c.passives || []).reduce((s, p) => s + (p.bonusDC || 0), 0);
  const itemDC = bonusItems.reduce((s, i) => s + (i.bonusDC || 0), 0);
  const buffDC = activeBuffs.filter(b => b.type === 'dc').reduce((s, b) => s + b.value, 0);
  const cdIncreaseCC = c.cdIncrease || 0;
  const baseDCCC = c.baseDC || 10;
  const trainingBonusCC = getTrainingBonusByLevel(c.level || 1);
  // Bônus de CD de classe (Refino: +floor(TB/2); O Honrado: +5; Implemento Marcial: Lutador).
  const classCdBonusCC = c.classCdBonus || 0;
  const exhaustionPenalty = -(c.exhaustionLevel ?? 0);
  const implementoCC = implementoMarcialBonus(c);
  const effectiveDC = baseDCCC + dcAttrModCC + halfLevelCC + trainingBonusCC + passiveDC + itemDC + buffDC + cdIncreaseCC + classCdBonusCC + exhaustionPenalty + implementoCC;
  // ===== CD de Especialização — atributo-chave da especialização (Suporte: Presença/Sabedoria) =====
  const specKeyNameCC = getKeyAttrForSpec(c.specialization as never, c.keyAttribute) ?? c.keyAttribute ?? null;
  const specKeyAttrCC = specKeyNameCC ? (c.attributes || []).find(a => a.name === specKeyNameCC) : undefined;
  const specKeyModCC = specKeyAttrCC ? Math.floor((specKeyAttrCC.value - 10) / 2) : 0;
  const specDC = baseDCCC + specKeyModCC + halfLevelCC + trainingBonusCC + passiveDC + itemDC + buffDC + cdIncreaseCC + exhaustionPenalty + implementoCC;

  // Grava o PE máximo final na ficha para que mapa, painéis e diálogos mostrem o mesmo número.
  useEffect(() => {
    if (c.peMaxEffective !== effectivePeMax || c.hpMaxEffective !== effectiveHpMax) {
      updateCharacter(c.id, { peMaxEffective: effectivePeMax, hpMaxEffective: effectiveHpMax });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, effectivePeMax, c.peMaxEffective, effectiveHpMax, c.hpMaxEffective]);

  const normalizarNomeRolagem = (nome: string) => nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  const getItemRollBonus = (attrName: string) => {
    const nomeNormalizado = normalizarNomeRolagem(attrName);
    const itemBonus = bonusItems.reduce(
      (sum, item) =>
        sum + item.rollBonuses.filter((rb) => normalizarNomeRolagem(rb.attributeName) === nomeNormalizado).reduce((s, rb) => s + rb.value, 0),
      0
    );
    const omniPassiveRollBonus = omniPassivasBonus.rollTotals[nomeNormalizado as keyof typeof omniPassivasBonus.rollTotals] ?? 0;
    return itemBonus + omniPassiveRollBonus;
  };

  const getOmniSkillBonus = (name: string) => {
    const omniSkillKey = (name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_');
    return ((c.omniSkillBonuses ?? {})[omniSkillKey] ?? 0) + (omniPassivasContinuas.skillBonuses[omniSkillKey] ?? 0);
  };

  const pendingRollRef = { current: null as { label: string; d20: number; bonus: number; total: number } | null };

  const showRollAnimation = (label: string, d20: number, bonus: number, total: number) => {
    playDiceSound();
    pendingRollRef.current = { label, d20, bonus, total };
    setRollAnimating(true);
    let count = 0;
    const interval = setInterval(() => {
      setRollResult({ label, d20: Math.floor(Math.random() * 20) + 1, bonus, total: Math.floor(Math.random() * 30) });
      count++;
      if (count >= 15) {
        clearInterval(interval);
        const final = pendingRollRef.current!;
        setRollResult(final);
        setRollAnimating(false);
        if (final.d20 === 20) playSuccessSound();
        else if (final.d20 === 1) playErrorSound();
        addLog('roll', `🎲 ${c.name} → ${final.label}: d20(${final.d20}) + ${final.bonus} = ${final.total}`);
      }
    }, 80);
  };

  const handleAttrRoll = async (name: string, attrValue: number) => {
    const mod = getAttrModifier(attrValue);
    const itemBonus = getItemRollBonus(name);
    const condBonus = getSkillModFromConditions(c, name);
    const totalBonus = mod + itemBonus + condBonus;
    // Vantagem/Desvantagem via Omni (atributo específico ou genérico).
    const omniAdv = consumeAdvantageFor(c.id, { kind: 'attribute', name });
    const flat = consumeFlatBonusFor(c.id, { kind: 'attribute', name });
    const { d20, modeLabel } = await applyAdvantageToD20(omniAdv.net, () => rollD20Com(c.id));
    const condLabel = condBonus !== 0 ? ` (${condBonus > 0 ? '+' : ''}${condBonus} cond.)` : '';
    const flatLabel = flat.bonus ? ` (${flat.bonus > 0 ? '+' : ''}${flat.bonus} comando/apoio)` : '';
    showRollAnimation(name + condLabel + flatLabel + modeLabel, d20, totalBonus + flat.bonus, d20 + totalBonus + flat.bonus);
    maybeApplyRecompensa(c.id, flat, { find: (id) => useCharacterStore.getState().characters.find((x) => x.id === id), update: updateCharacter, log: (m) => addLog('combat', m) });
  };

  const handleSkillRoll = async (name: string, skillValue: number, linkedAttrId?: string, trained?: boolean, mastery?: boolean, externalBonus?: number) => {
    // Presença Suprimida (EC Nv2): +2 em Furtividade e penalidade chamativa −5 (em vez de −10).
    const furtBonus = presencaSuprimidaBonus(c, name);
    const chamativa = ehFurtividade(name) && acaoChamativa ? penalidadeChamativa(c) : 0;

    let attrMod = 0;
    if (linkedAttrId) {
      const attr = c.attributes.find((a) => a.id === linkedAttrId);
      if (attr) attrMod = getAttrModifier(attr.value);
    }
    const itemBonus = getItemRollBonus(name);
    // Especialização (Tier 6): perícias escolhidas promovidas a Maestria.
    const specAgg = aggregateSpecChoices(c);
    const promotedMastery = mastery || specAgg.skillsToPromoteMastery.some(
      sk => sk.trim().toLowerCase() === (name || '').trim().toLowerCase()
    );
    const trainBonus = getTrainingBonus(c.level, trained, promotedMastery);
    const levelBonus = Math.floor(c.level / 2);
    const baseBonus = skillValue || 0;
    const extBonus = externalBonus || 0;
    // Energia Focalizada (Tier 4): bônus em TR escolhido.
    const saveBonus = (specAgg.savesExternalBonus as Record<string, number>)[name] ?? 0;
    // Sentidos Aguçados (Tier 10): Atenção/Percepção +⌊Mod_Chave/2⌋.
    const lowerName = (name || '').toLowerCase();
    let sentidosBonus = 0;
    if (lowerName.includes('atenção') || lowerName.includes('atencao')) sentidosBonus += specAgg.atencaoBonus;
    if (lowerName.includes('percepção') || lowerName.includes('percepcao')) sentidosBonus += specAgg.percepcaoBonus;
    // Fase 6 — Plug de Aptidões de Aura nas rolagens reais.
    const lower = (name || '').toLowerCase();
    let auraSkillBonus = 0;
    if (lower.includes('furtividade') && auraEffects.furtividadeBonus > 0) {
      auraSkillBonus += auraEffects.furtividadeBonus;
    }
    if (lower.includes('atletismo') && auraEffects.grappleBonus > 0) {
      auraSkillBonus += auraEffects.grappleBonus;
    }
    const conditionSkillBonus = getSkillModFromConditions(c, name);
    const normalizedRollName = (name || '').trim().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const omniEquipmentSkillBonus = omniModifiers.pericias[normalizedRollName.replace(/^pericia(s)?_/, '')] ?? 0;
    // 🪄 Omni Script Passivo (`somar X em pericia_<x>`).
    const omniSkillKey = (name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_');
    const omniSkillBonus = getOmniSkillBonus(name);
    // Mente Plácida (Tier 2): TR Concentração (=Astúcia) +Mod_Chave.
    const passiveAggEarly = aggregateSpecAbilityEffects(c);
    const isAstucia = (name || '').trim().toLowerCase() === 'astúcia' || (name || '').trim().toLowerCase() === 'astucia';
    const concentrationBonus = isAstucia ? passiveAggEarly.concentrationCheckBonus : 0;
    // Bastião Interior (Tier 6) — Vantagem em TR vs Amedrontado / Desorientado / Enfeitiçado.
    const isSavingThrow = (c.savingThrows || []).some(st => st.name === name);
    const omniEquipmentTrBonus = isSavingThrow ? (omniModifiers.trs[normalizedRollName as keyof typeof omniModifiers.trs] ?? 0) : 0;
    // Presença Inspiradora (Suporte Nv 3): bônus de cena em TODAS as perícias (não em TRs).
    const inspiracao = (isSavingThrow ? 0 : (c.inspiracaoBonus ?? 0)) + (isSavingThrow ? 0 : posturaPericia(c));
    // Guarda Estudada (EC Nv4): +2 no TR escolhido.
    const guardaBonus = guardaEstudadaTrBonus(c, name, isSavingThrow);
    const totalBonus = guardaBonus + baseBonus + attrMod + itemBonus + trainBonus + levelBonus + extBonus + auraSkillBonus + conditionSkillBonus + saveBonus + sentidosBonus + concentrationBonus + omniSkillBonus + omniEquipmentSkillBonus + omniEquipmentTrBonus + inspiracao + furtBonus + chamativa;
    const activeCondIds = (c.activeConditions || []).map(ac => (ac.conditionId || '').toLowerCase());
    const triggersBastiao =
      isSavingThrow &&
      passiveAggEarly.savesAdvantageVsConditions.some(cid => activeCondIds.includes(cid));
    // Vantagem/Desvantagem via Omni (TR específico, perícia específica, ou genéricos).
    const omniAdv = consumeAdvantageFor(c.id, isSavingThrow
      ? { kind: 'save', name }
      : { kind: 'skill', name });
    const flat = consumeFlatBonusFor(c.id, isSavingThrow ? { kind: 'save', name } : { kind: 'skill', name });
    // Bastião sempre confere vantagem; combina com Omni (vantagem ganha
    // se já não há desvantagem; desvantagem Omni cancela).
    let netRoll: 'normal' | 'advantage' | 'disadvantage' = omniAdv.net;
    if (triggersBastiao && netRoll !== 'disadvantage') netRoll = 'advantage';
    const adv = await applyAdvantageToD20(netRoll, () => rollD20Com(c.id));
    const { rolls, modeLabel } = adv;
    const d20 = isSavingThrow ? await perguntarFortuna(c.id, adv.d20, 'resistencia', () => rollD20Com(c.id)) : adv.d20;
    let bastiaoLabel = '';
    if (triggersBastiao && rolls.length === 2 && netRoll === 'advantage' && omniAdv.net !== 'advantage') {
      bastiaoLabel = ` [Bastião 2d20(${rolls[0]},${rolls[1]})→${d20}]`;
    }
    const auraLabel = auraSkillBonus > 0 ? ` (+${auraSkillBonus} aura)` : '';
    const condLabel = conditionSkillBonus !== 0 ? ` (${conditionSkillBonus > 0 ? '+' : ''}${conditionSkillBonus} cond.)` : '';
    const specLabel = saveBonus > 0 ? ` (+${saveBonus} foco)` : '';
    const guardaLabel = guardaBonus > 0 ? ` (+${guardaBonus} guarda estudada)` : '';
    const sentidosLabel = sentidosBonus > 0 ? ` (+${sentidosBonus} sentidos)` : '';
    const inspiracaoLabel = inspiracao > 0 ? ` (+${inspiracao} inspiração)` : '';
    const masteryLabel = promotedMastery && !mastery ? ' [Maestria/Spec]' : '';
    const flatLabel = flat.bonus ? ` (${flat.bonus > 0 ? '+' : ''}${flat.bonus} comando/apoio)` : '';
    const furtLabel = furtBonus > 0 ? ` (+${furtBonus} presença suprimida)` : '';
    const chamativaLabel = chamativa !== 0 ? ` (${chamativa} ação chamativa)` : '';
    const omniEquipmentBonus = omniEquipmentSkillBonus + omniEquipmentTrBonus;
    const omniEquipmentLabel = omniEquipmentBonus !== 0 ? ` (${omniEquipmentBonus > 0 ? '+' : ''}${omniEquipmentBonus} equipamento)` : '';
    showRollAnimation(name + auraLabel + omniEquipmentLabel + condLabel + specLabel + guardaLabel + sentidosLabel + inspiracaoLabel + flatLabel + furtLabel + chamativaLabel + masteryLabel + bastiaoLabel + modeLabel, d20, totalBonus + flat.bonus, d20 + totalBonus + flat.bonus);

    maybeApplyRecompensa(c.id, flat, { find: (id) => useCharacterStore.getState().characters.find((x) => x.id === id), update: updateCharacter, log: (m) => addLog('combat', m) });
  };

  const [hitTargets, setHitTargets] = useState<string[]>([]);
  const [showHitTargetSelect, setShowHitTargetSelect] = useState(false);
  const allCharacters = useCharacterStore((s) => s.characters);

  const toggleHitTarget = (id: string) => {
    setHitTargets((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const getAttackTotalBonus = (type: 'melee' | 'ranged' | 'cursed') => {
    const base = getBaseAttackBonus(c.level);
    const bonus = type === 'melee' ? (c.meleeAttackBonus || 0) : type === 'ranged' ? (c.rangedAttackBonus || 0) : (c.cursedAttackBonus || 0);
    const linkedId = type === 'melee' ? c.meleeLinkedAttr : type === 'ranged' ? c.rangedLinkedAttr : c.cursedLinkedAttr;
    const trained = type === 'melee' ? c.meleeTrained : type === 'ranged' ? c.rangedTrained : c.cursedTrained;
    let attrMod = 0;
    if (linkedId) {
      const attr = c.attributes.find(a => a.id === linkedId);
      if (attr) attrMod = getAttrModifier(attr.value);
    }
    // Jogadas de ataque usam apenas Treinamento (sem Maestria)
    const trainBonus = getTrainingBonus(c.level, trained, false);
    // Fase 10 — Faíscas Negras (buff de cena pós-Kokusen): +½CL no acerto CaC.
    let faiscasHit = 0;
    if (type === 'melee' && c.kokusenSceneBuffActive) {
      const cl = c.cursedAptitudes?.CL ?? 0;
      faiscasHit = Math.floor(cl / 2);
    }
    return base + bonus + attrMod + trainBonus + buffHit + faiscasHit + conditionMods.attack;
  };

  const rollDamageAssist = async (buffs: ActiveBuff[]): Promise<string[]> => {
    const lines: string[] = [];
    for (const buff of buffs) {
      if (buff.type !== 'extraDiceAfter') continue;
      const formula = buff.extraDamageFormula ?? (buff.extraDiceCount && buff.extraDiceSides
        ? `${buff.extraDiceCount}d${buff.extraDiceSides}`
        : undefined);
      if (!formula) continue;
      const { rolls, total } = await rollDice(formula);
      lines.push(`➕ Dano Extra: ${total} [${formula}(${rolls.join(',')})]`);
    }
    return lines;
  };

  const consumeSupportAttackBuffs = (buffs: ActiveBuff[]) => {
    const atuais = useCharacterStore.getState().characters.find(character => character.id === c.id)?.activeBuffs ?? [];
    const ids = new Set(buffs.filter(buff => buff.consumeOnAttack).map(buff => buff.id));
    for (const buff of atuais) if (ids.has(buff.id)) useCharacterStore.getState().removeBuff(c.id, buff.id);
  };

  // Alvos por tipo de ataque (Corpo a Corpo / Distância / Amaldiçoado)
  const [attackTargets, setAttackTargets] = useState<Record<'melee' | 'ranged' | 'cursed', string[]>>({
    melee: [], ranged: [], cursed: [],
  });
  const [openTargetPicker, setOpenTargetPicker] = useState<null | 'melee' | 'ranged' | 'cursed'>(null);

  const toggleAttackTarget = (type: 'melee' | 'ranged' | 'cursed', id: string) => {
    setAttackTargets(prev => ({
      ...prev,
      [type]: prev[type].includes(id) ? prev[type].filter(t => t !== id) : [...prev[type], id],
    }));
  };

  const handleAttackTypeRoll = async (type: 'melee' | 'ranged' | 'cursed') => {
    const label = type === 'melee' ? '⚔️ Acerto C.a.C' : type === 'ranged' ? '🏹 Acerto Distância' : '👁‍🗨 Acerto Amaldiçoado';
    const omniAdv = consumeAdvantageFor(c.id, { kind: 'attack', subtype: type });
    const flatAtk = consumeFlatBonusFor(c.id, { kind: 'attack', subtype: type });
    const totalBonus = getAttackTotalBonus(type) + flatAtk.bonus;
    const advAtk = await applyAdvantageToD20(omniAdv.net, () => rollD20Com(c.id));
    const { modeLabel } = advAtk;
    const d20 = await perguntarFortuna(c.id, advAtk.d20, 'ataque', () => rollD20Com(c.id));
    const finalResult = d20 + totalBonus;
    const targets = attackTargets[type];

    if (targets.length === 0) {
      showRollAnimation(label + modeLabel, d20, totalBonus, finalResult);
      maybeApplyRecompensa(c.id, flatAtk, { find: (id) => useCharacterStore.getState().characters.find((x) => x.id === id), update: updateCharacter, log: (m) => addLog('combat', m) });
      return;
    }

    // Crit threshold honra buffs critMargin (igual ao handleCustomHitRoll)
    const critMarginBuff = activeBuffs.filter(b => b.type === 'critMargin').reduce((s, b) => s + b.value, 0);
    const critThreshold = Math.max(2, 20 - critMarginBuff);
    const isCritFail = d20 === 1 && !consumeCritNegated(c.id);
    const isCritHit = d20 >= critThreshold && !isCritFail;

    // Fase 10 — Motor Kokusen (Raio Negro) - escuta passiva em ataques CaC
    let isKokusen = false;
    if (type === 'melee' && hasKokusen(c) && !isCritFail) {
      const kk = getKokusenCritThreshold(c);
      if (kk && d20 >= kk.threshold) {
        isKokusen = true;
      }
    }

    const hitResultsList: { name: string; hit: 'hit' | 'miss' | 'crit' | 'critFail' }[] = [];
    const hitLogResults: string[] = [];
    let anyHit = false;
    targets.forEach((targetId) => {
      const target = allCharacters.find((ch) => ch.id === targetId);
      if (!target) return;
      const tPassiveCA = target.passives.reduce((sum, p) => sum + p.bonusCA, 0);
      const tEquipped = items.filter((i) => i.assignedTo.includes(target.id));
      const tItemCA = tEquipped.reduce((sum, i) => sum + i.bonusCA, 0);
      const tBuffCA = (target.activeBuffs || []).filter(b => b.type === 'ca').reduce((s, b) => s + b.value, 0);
      const tCondCA = getDefenseModFromConditions(target, type === 'cursed' ? 'cursed' : type);
      const targetCA = target.ca + tPassiveCA + tItemCA + tBuffCA + tCondCA;
      // Paralisado / Inconsciente / Indefeso → auto-acerto e auto-crítico (×2 dados de dano).
      const auto = getAutoCritFromConditions(target, type === 'cursed' ? 'cursed' : type);
      if (auto) {
        hitResultsList.push({ name: target.name, hit: 'crit' });
        hitLogResults.push(`💥 ${target.name} — ACERTO CRÍTICO AUTOMÁTICO (${auto.reason}): dado de dano DOBRADO`);
        anyHit = true;
        return;
      }
      if (isCritFail) { hitResultsList.push({ name: target.name, hit: 'critFail' }); hitLogResults.push(`💀 ${target.name} — FALHA CRÍTICA`); }
      else if (isKokusen) { hitResultsList.push({ name: target.name, hit: 'crit' }); hitLogResults.push(`⚡ ${target.name} — KOKUSEN! (×1.5 dano, ignora RD)`); anyHit = true; }
      else if (isCritHit) { hitResultsList.push({ name: target.name, hit: 'crit' }); hitLogResults.push(`✨ ${target.name} — ACERTO CRÍTICO!`); anyHit = true; }
      else if (finalResult >= targetCA) { hitResultsList.push({ name: target.name, hit: 'hit' }); hitLogResults.push(`✅ ${target.name} — ACERTOU`); anyHit = true; }
      else { hitResultsList.push({ name: target.name, hit: 'miss' }); hitLogResults.push(`❌ ${target.name} — ERROU`); }
    });

    // Kokusen — incrementa stack após confirmar acerto e arma flag para o próximo aplicar dano
    if (isKokusen && anyHit) {
      const round = useCombatStore.getState().round ?? 1;
      const r = triggerKokusen(c.id, round);
      if (r.ok) {
        updateCharacter(c.id, { kokusenArmedDamage: true });
        addLog('system', `⚡ ${c.name}: KOKUSEN! Consciência Absoluta ${r.newStacks} (próx. crit em ${r.threshold}+). Próximo dano aplicado: ×1.5 e ignora RD.`);
      }
    }

    // Fase 9 — Aura Redirecionadora: dispara prompt de reação se algum tiro à distância errou.
    if (type === 'ranged' && hitResultsList.some(r => r.hit === 'miss' || r.hit === 'critFail')) {
      notifyMissedRangedAttack(c.id);
    }

    // Empolgação (Lutador): qualquer ataque corpo-a-corpo que acertar dá +1 (cap 5).
    if (type === 'melee' && anyHit && c.characterClass === 'Feiticeiro' && c.specialization === 'Lutador') {
      const startLv = c.empolgacaoStartLevel ?? (c.level >= 20 ? 2 : 1);
      const cur = c.empolgacaoLevel ?? startLv;
      if (cur < 5) {
        updateCharacter(c.id, { empolgacaoLevel: cur + 1 });
        addLog('system', `🔥 ${c.name}: acerto C.a.C — Empolgação ${cur} → ${cur + 1}.`);
      }
    }

    const buffsConsumedByThisAttack = activeBuffs.filter(buff => buff.consumeOnAttack);

    setRollAnimating(true);
    let count = 0;
    const interval = setInterval(async () => {
      setRollResult({ label, d20: Math.floor(Math.random() * 20) + 1, bonus: totalBonus, total: Math.floor(Math.random() * 30) });
      count++;
      if (count >= 15) {
        clearInterval(interval);
        setRollResult({ label, d20, bonus: totalBonus, total: finalResult, hitResults: hitResultsList });
        setRollAnimating(false);
        const extraAfter = anyHit ? await rollDamageAssist(buffsConsumedByThisAttack) : [];
        consumeSupportAttackBuffs(buffsConsumedByThisAttack);
        addLog('roll', `🎲 ${c.name} → ${label}: d20(${d20}) + ${totalBonus} = ${finalResult}${extraAfter.length ? ` | ${extraAfter.join(' | ')}` : ''}\n${hitLogResults.join('\n')}`);
      }
    }, 80);
    setOpenTargetPicker(null);
  };

  const handleCustomHitRoll = async () => {
    // Sem subtipo conhecido — usa 'melee' como default (UI permite só 1 botão custom);
    // escopos genéricos como next_attack/attack_all funcionam normalmente.
    const omniAdv = consumeAdvantageFor(c.id, { kind: 'attack', subtype: 'melee' });
    const flatAtk = consumeFlatBonusFor(c.id, { kind: 'attack', subtype: 'melee' });
    const d20 = await perguntarFortuna(c.id, (await applyAdvantageToD20(omniAdv.net, () => rollD20Com(c.id))).d20, 'ataque', () => rollD20Com(c.id));
    const totalHitBonus = c.customHitBonus + buffHit + flatAtk.bonus;
    const result = d20 + totalHitBonus;
    maybeApplyRecompensa(c.id, flatAtk, { find: (id) => useCharacterStore.getState().characters.find((x) => x.id === id), update: updateCharacter, log: (m) => addLog('combat', m) });

    // Check for extra dice from buffs
    const extraDiceBuffs = activeBuffs.filter(b => b.type === 'extraDice');
    const extraDiceAfterBuffs = activeBuffs.filter(b => b.type === 'extraDiceAfter');
    const damageLevelsBuff = activeBuffs.filter(b => b.type === 'damageLevels').reduce((s, b) => s + b.value, 0);
    
    let extraDiceTotal = 0;
    const extraDiceDetails: string[] = [];
    
    // Add extra dice from "During Attack" buffs
    for (const b of extraDiceBuffs) {
      if (b.extraDiceCount && b.extraDiceSides) {
        const { rolls, total } = await rollDice(`${b.extraDiceCount}d${b.extraDiceSides}`);
        extraDiceTotal += total;
        extraDiceDetails.push(`${b.extraDiceCount}d${b.extraDiceSides}[${rolls.join(',')}]=${total}`);
      }
    }

    // Add extra dice from "Damage Levels" (1d8 per level)
    if (damageLevelsBuff > 0) {
      const { rolls, total } = await rollDice(`${damageLevelsBuff}d8`);
      extraDiceTotal += total;
      extraDiceDetails.push(`${damageLevelsBuff}d8[${rolls.join(',')}]=${total} (Níveis)`);
    }

    const finalResult = result + extraDiceTotal;

    if (hitTargets.length === 0) {
      showRollAnimation('Acerto', d20, totalHitBonus + extraDiceTotal, finalResult);
      return;
    }

    const critMarginBuff = activeBuffs.filter(b => b.type === 'critMargin').reduce((s, b) => s + b.value, 0);
    const critThreshold = Math.max(2, 20 - critMarginBuff);
    const isCritFail = d20 === 1 && !consumeCritNegated(c.id);
    const isCritHit = d20 >= critThreshold && !isCritFail;

    const hitResultsList: { name: string; hit: 'hit' | 'miss' | 'crit' | 'critFail' }[] = [];
    const hitLogResults: string[] = [];
    hitTargets.forEach((targetId) => {
      const target = allCharacters.find((ch) => ch.id === targetId);
      if (!target) return;
      const tPassiveCA = target.passives.reduce((sum, p) => sum + p.bonusCA, 0);
      const tEquipped = items.filter((i) => i.assignedTo.includes(target.id));
      const tItemCA = tEquipped.reduce((sum, i) => sum + i.bonusCA, 0);
      const tBuffCA = (target.activeBuffs || []).filter(b => b.type === 'ca').reduce((s, b) => s + b.value, 0);
      const tCondCA = getDefenseModFromConditions(target, 'melee');
      const targetCA = target.ca + tPassiveCA + tItemCA + tBuffCA + tCondCA;

      // Paralisado / Inconsciente / Indefeso → auto-acerto e auto-crítico (×2 dados de dano).
      const auto = getAutoCritFromConditions(target, 'melee');
      if (auto) {
        hitResultsList.push({ name: target.name, hit: 'crit' });
        hitLogResults.push(`💥 ${target.name} — ACERTO CRÍTICO AUTOMÁTICO (${auto.reason}): dado de dano DOBRADO`);
        return;
      }
      if (isCritFail) {
        hitResultsList.push({ name: target.name, hit: 'critFail' });
        hitLogResults.push(`❌ ${target.name} — FALHA CRÍTICA`);
      } else if (isCritHit) {
        hitResultsList.push({ name: target.name, hit: 'crit' });
        hitLogResults.push(`✅ ${target.name} — ACERTO CRÍTICO!`);
      } else if (finalResult >= targetCA) {
        hitResultsList.push({ name: target.name, hit: 'hit' });
        hitLogResults.push(`✅ ${target.name} — ACERTOU`);
      } else {
        hitResultsList.push({ name: target.name, hit: 'miss' });
        hitLogResults.push(`❌ ${target.name} — ERROU`);
      }
    });

    playDiceSound();
    setRollAnimating(true);
    let count = 0;
    const interval = setInterval(async () => {
      setRollResult({ label: 'Acerto', d20: Math.floor(Math.random() * 20) + 1, bonus: totalHitBonus, total: Math.floor(Math.random() * 30) });
      count++;
      if (count >= 15) {
        clearInterval(interval);
        setRollResult({ label: 'Acerto', d20, bonus: totalHitBonus + extraDiceTotal, total: finalResult, hitResults: hitResultsList });
        setRollAnimating(false);

        // After-attack damage (separate instance)
        let extraAfterStr = '';
        if (extraDiceAfterBuffs.length > 0) {
          for (const b of extraDiceAfterBuffs) {
            const formula = b.extraDamageFormula ?? (b.extraDiceCount && b.extraDiceSides ? `${b.extraDiceCount}d${b.extraDiceSides}` : undefined);
            if (!formula) continue;
            const { rolls, total } = await rollDice(formula);
            extraAfterStr += ` | ➕ Dano Extra: ${total} [${formula}(${rolls.join(',')})]`;
          }
        }

        const extraStr = extraDiceDetails.length > 0 ? ` + ${extraDiceDetails.join(' + ')}` : '';
        consumeSupportAttackBuffs(extraDiceAfterBuffs);
        addLog('roll', `🎲 ${c.name} → Acerto: d20(${d20}) + ${totalHitBonus}${extraStr} = ${finalResult}${extraAfterStr}\n${hitLogResults.join('\n')}`);
      }
    }, 80);

    setShowHitTargetSelect(false);
  };

  const handleUseSpell = async (spell: Spell) => {
    // Feitiço em área: roda o fluxo de posicionamento no mapa (mesmo dos players)
    // para que tokens dentro do template sejam selecionados automaticamente —
    // em vez do dialog antigo "selecionar alvos" um a um.
    try {
      const { getAoEFromSpell, findEntitiesInTemplate, resolveAreaTargetCharacters, getActiveSpellAreaBonus, getActiveSpellRangeBonus } = await import('@/lib/mapAoE');
      const aoe = getAoEFromSpell(spell);
      if (aoe) {
        const mp = (await import('@/stores/useMapStore')).useMapStore.getState();
        const entList = Object.values(mp.entities);
        const casterEnt =
          entList.find((en) => en?.characterId === c.id) ??
          (c.profileId
            ? entList.find(
                (en) =>
                  en && (en.avatarProfileId === c.profileId || en.ownerProfileId === c.profileId),
              )
            : undefined);
        const originWorld = casterEnt ? { x: casterEnt.x, y: casterEnt.y } : undefined;
        const rangeMatch = String(spell.range ?? '').match(/(\d+(?:[.,]\d+)?)/);
        const baseRange = rangeMatch ? parseFloat(rangeMatch[1].replace(',', '.')) : 1.5;
        const areaBonus = getActiveSpellAreaBonus(c as any);
        const rangeBonus = getActiveSpellRangeBonus(c as any);
        const finalSize = Math.max(0.5, aoe.sizeMeters + areaBonus);
        const maxRangeMeters = baseRange + rangeBonus;
        const template = await mp.requestAoEPlacement({
          kind: aoe.kind,
          sizeMeters: finalSize,
          widthMeters: aoe.widthMeters,
          sourceLabel: `${c.name} · ${spell.name}`,
          color: '#a855f7',
          originWorld,
          maxRangeMeters,
        });
        if (!template) return;
        const allEntities = (await import('@/stores/useMapStore')).useMapStore.getState().entities;
        const hitIds = findEntitiesInTemplate(template, allEntities);
        const resolvedTargets = resolveAreaTargetCharacters(
          hitIds,
          allEntities,
          (await import('@/stores/useCharacterStore')).useCharacterStore.getState().characters,
          c.id,
          casterEnt?.id,
        );
        setPendingSpellAreaTargets(resolvedTargets.characterIds);
        setPendingSpellAreaMode(true);
        setPendingSpellAreaTemplateId(template.id);
        setPendingSpell(spell);
        return;
      }
    } catch (err) {
      // Mapa indisponível → cai no dialog tradicional.
      console.warn('[handleUseSpell] AoE flow falhou, abrindo dialog padrão:', err);
    }
    setPendingSpellAreaTargets(null);
    setPendingSpellAreaMode(false);
    setPendingSpellAreaTemplateId(null);
    setPendingSpell(spell);
  };

  const handleResetActions = () => {
    playClickSound();
    const effectiveBonusActionsMax = c.bonusActionsMax + itemBonuses.bonusActions;
    const effectiveReactionsMax = c.reactionsMax + itemBonuses.reactions;
    const effectiveOpportunityMax = c.opportunityMax + itemBonuses.opportunity;
    updateCharacter(c.id, {
      actionsCurrent: effectiveActionsMax,
      bonusActionsCurrent: effectiveBonusActionsMax,
      reactionsCurrent: effectiveReactionsMax,
      opportunityCurrent: effectiveOpportunityMax,
    });
    addLog('system', `🔄 Ações de ${c.name} resetadas`);
  };

  const categoryColors: Record<string, string> = {
    PLAYER: 'bg-neon-green/20 text-neon-green border-neon-green/30',
    INIMIGO: 'bg-neon-red/20 text-neon-red border-neon-red/30',
    NPC: 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/30',
  };

  return (
    <div ref={cardRef} className={cn("rounded-2xl border border-border bg-card overflow-hidden animate-scale-in transition-all duration-300", removing && "opacity-0 scale-95")}>
      {/* ─── Clickable header region ─── */}
      <div
        onClick={() => { playFichaToggleSound(); setExpanded(!expanded); }}
        className="cursor-pointer hover:bg-secondary/10 transition-colors"
      >
      {/* ─── Header ─── */}
      <div className={cn(
        "flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left",
        compactHeader && "content-start",
      )}>
        <div className="flex items-center gap-2 text-foreground font-bold text-sm rounded-lg p-1">
          <span className="font-mono text-muted-foreground">A</span>
          <span className="text-sm text-muted-foreground">
            {c.category === 'INIMIGO' ? `ND.${c.level}` : `Nv.${c.level}`}
          </span>
        </div>
        {/* Level up button (one-way). Oculto para INIMIGOs (ND fixo da importação). */}
        {c.category !== 'INIMIGO' && c.level < MAX_LEVEL && (
        <div className="flex flex-col gap-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              playClickSound();
              if (!showLevelUp && hasPendingChoices(c)) {
                setExpanded(true);
                return;
              }
              setShowLevelUp(true);
            }}
            className="h-8 w-5 flex items-center justify-center rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
            title={hasPendingChoices(c) ? 'Resolva as pendências de nível antes de subir novamente' : 'Subir nível (ação irreversível)'}
          >
            <ChevronUp className="h-3 w-3" />
          </button>
        </div>
        )}
        {/* Visibility toggle: Mestre pode ocultar INIMIGOs/NPCs dos players */}
        {!isPlayer && c.category !== 'PLAYER' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              playClickSound();
              const next = !c.hiddenFromPlayers;
              updateCharacter(c.id, { hiddenFromPlayers: next });
              addLog('system', `${next ? '🙈' : '👁️'} ${c.name} ${next ? 'oculto(a) dos players' : 'visível para os players'}.`);
            }}
            className={cn(
              'h-8 w-8 flex items-center justify-center rounded transition-colors',
              c.hiddenFromPlayers
                ? 'bg-destructive/20 text-destructive hover:bg-destructive/30'
                : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
            )}
            title={c.hiddenFromPlayers ? 'Oculto dos players — clique para revelar' : 'Visível aos players — clique para ocultar'}
          >
            {c.hiddenFromPlayers ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        <div className="order-first min-w-0 basis-full text-left px-1 pb-1">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="truncate min-w-0 flex-1 basis-32 font-semibold text-foreground">{c.name}</span>
            {(c.omniFlags?.bloqueio_total ?? 0) >= 1 && (
              <span
                className="flex-shrink-0 inline-flex items-center gap-1 rounded-full border border-sky-400/50 bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.45)] animate-pulse"
                title="Bloqueio Total: o próximo dano em Vida Atual será absorvido."
                aria-label="Bloqueio Total ativo"
              >
                <Shield className="h-3 w-3" />
                BLOQUEIO
              </span>
            )}
            {c.characterClass === 'Feiticeiro' && (
              <span className="flex-shrink-0">
                <SorcererRankBadge level={c.level} />
              </span>
            )}
            <span className="flex-shrink-0">
              {!c.isGrimorioCreature && <PendingSummaryButton character={c} onExpand={() => setExpanded(true)} />}
            </span>
            {c.category === 'PLAYER' && <ConquistasButton charId={c.id} nome={c.name} master={isMaster} />}
          </div>
          <div className="text-sm text-muted-foreground pr-2">
            {c.characterClass || 'Não-Feiticeiro'}
            {c.isGrimorioCreature ? ' · Criatura' : (c.characterClass === 'Feiticeiro' && c.specialization && c.specialization !== 'Lutador' ? ` · ${c.specialization}` : '')}
            {c.characterClass === 'Maldição' && c.motivation ? ` · ${c.motivation}` : ''}
            {c.characterClass === 'Feiticeiro' && c.origin && c.origin !== 'Inato' ? ` · ${c.origin}` : ''}
            {' · '}
            <span className="text-pe">Maestria: +{getMasteryBonus(c.level)}</span>
            {' · '}
            <span className="text-primary">Treinamento: +{getTrainingBonusByLevel(c.level)}</span>
            {' · '}
            <span className="text-muted-foreground">Dados de Vida: {c.hitDiceCurrent ?? c.hitDiceMax ?? getHitDiceMax(c.level)}/{getHitDiceMax(c.level)}</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {canSeeCombatDefense && <div
            className="flex flex-col items-center justify-center rounded-xl border-2 border-primary/50 bg-gradient-to-br from-primary/20 to-primary/5 px-3 py-1.5 shadow-[0_0_20px_-5px_hsl(var(--primary)/0.4)]"
            title={`CA base ${c.ca} + DES ${desModCC >= 0 ? '+' : ''}${desModCC} + ½ Nv ${halfLevelCC}${passiveBonuses.ca ? ` + Passivas ${passiveBonuses.ca}` : ''}${itemBonuses.ca ? ` + Itens ${itemBonuses.ca}` : ''}${buffCA ? ` + Buffs ${buffCA}` : ''}${conditionMods.defense ? ` ${conditionMods.defense >= 0 ? '+' : ''}${conditionMods.defense} Condições` : ''}${hasDirectionalDef ? `\n— Direcionais (aplicados pelo motor):\n  vs CaC: ${caVsMelee + buffCA} (${conditionMods.defenseMelee >= 0 ? '+' : ''}${conditionMods.defenseMelee})\n  vs Distância: ${caVsRanged + buffCA} (${conditionMods.defenseRanged >= 0 ? '+' : ''}${conditionMods.defenseRanged})` : ''}`}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-primary/80 leading-none">CA</span>
            <span className="font-mono text-2xl font-black leading-none text-primary">
              <StatValue
                valorBase={effectiveCA - omniTotalsCombinados.ca}
                valorAtual={effectiveCA}
                origens={omniOrigensPorChave.ca}
              >
                {effectiveCA}
              </StatValue>
              {buffCA > 0 && <span className="ml-0.5 text-xs text-pe align-top">+{buffCA}</span>}
            </span>
            {hasDirectionalDef && (
              <div className="mt-0.5 flex gap-1 text-xs font-mono leading-none text-primary/70">
                <span title="Defesa contra ataques corpo-a-corpo">CaC {caVsMelee + buffCA}</span>
                <span className="text-primary/30">·</span>
                <span title="Defesa contra ataques à distância">Dist {caVsRanged + buffCA}</span>
              </div>
            )}
          </div>}
          {/* CD — mesmo visual da CA, com atributo configurável travado uma vez */}
          <div
            className="flex flex-col items-center justify-center rounded-xl border-2 border-neon-yellow/50 bg-gradient-to-br from-neon-yellow/20 to-neon-yellow/5 px-3 py-1.5 shadow-[0_0_20px_-5px_hsl(var(--neon-yellow)/0.4)]"
            title={`CD base ${baseDCCC}${dcAttrCC ? ` + ${dcAttrCC.name.slice(0,3).toUpperCase()} ${dcAttrModCC >= 0 ? '+' : ''}${dcAttrModCC}` : ' (sem atributo)'} + ½ Nv ${halfLevelCC} + Treinamento ${trainingBonusCC}${passiveDC ? ` + Passivas ${passiveDC}` : ''}${itemDC ? ` + Itens ${itemDC}` : ''}${buffDC ? ` + Buffs ${buffDC}` : ''}${cdIncreaseCC ? ` + Aumento ${cdIncreaseCC}` : ''}${classCdBonusCC ? ` + Classe ${classCdBonusCC}` : ''}`}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-neon-yellow/80 leading-none">CD Amald.</span>
            <span className="font-mono text-2xl font-black leading-none text-neon-yellow">
              {effectiveDC}
              {buffDC > 0 && <span className="ml-0.5 text-xs text-pe align-top">+{buffDC}</span>}
            </span>
          </div>
          <div
            className="flex flex-col items-center justify-center rounded-xl border-2 border-primary/50 bg-gradient-to-br from-primary/20 to-primary/5 px-3 py-1.5"
            title={`CD de Especialização: base ${baseDCCC}${specKeyAttrCC ? ` + ${specKeyAttrCC.name.slice(0,3).toUpperCase()} ${specKeyModCC >= 0 ? '+' : ''}${specKeyModCC}` : ' (sem atributo-chave)'} + ½ Nv ${halfLevelCC} + Treinamento ${trainingBonusCC}${passiveDC ? ` + Passivas ${passiveDC}` : ''}${itemDC ? ` + Itens ${itemDC}` : ''}${buffDC ? ` + Buffs ${buffDC}` : ''}${cdIncreaseCC ? ` + Aumento ${cdIncreaseCC}` : ''}${implementoCC ? ` + Implemento Marcial ${implementoCC}` : ''}`}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-primary/80 leading-none">CD Espec.</span>
            <span className="font-mono text-2xl font-black leading-none text-primary">{specDC}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-xs text-muted-foreground font-mono" title={`Movimento base ${c.movement ?? 9}m${talentBonuses.movementMeters > 0 ? ` + ${talentBonuses.movementMeters}m (talento)` : ''}${getMobilidadeBonus(c) > 0 ? ` + ${getMobilidadeBonus(c)}m (Mobilidade Avançada)` : ''}${omniModifiers.deslocamento !== 0 ? ` ${omniModifiers.deslocamento > 0 ? '+' : '-'} ${Math.abs(omniModifiers.deslocamento)}m (equipamento)` : ''}${(c.exhaustionLevel ?? 0) > 0 ? ` - ${(1.5 * (c.exhaustionLevel ?? 0)).toFixed(1)}m (Exaustão)` : ''}`}>
              MOV:{Math.max(0, (c.movement ?? 9) + talentBonuses.movementMeters + getMobilidadeBonus(c) + omniModifiers.deslocamento - 1.5 * (c.exhaustionLevel ?? 0)).toFixed(1)}m{talentBonuses.movementMeters > 0 && <span className="ml-0.5 text-primary/80">⚙</span>}
            </div>
            <Select
              value={c.dcLinkedAttr || ''}
              onValueChange={(newId) => {
                if (!newId) return;
                const attr = (c.attributes || []).find(a => a.id === newId);
                requestAttrLock({
                  context: 'CD (Classe de Dificuldade)',
                  attrName: attr?.name ?? '—',
                  onConfirm: () => updateCharacter(c.id, { dcLinkedAttr: newId }),
                });
              }}
              disabled={!!c.dcLinkedAttr}
            >
              <SelectTrigger
                onClick={(e) => e.stopPropagation()}
                title={c.dcLinkedAttr ? `Atributo da CD: ${dcAttrCC?.name} (travado)` : 'Definir atributo da CD (única vez)'}
                className="h-5 w-auto min-w-[68px] gap-1 rounded border border-neon-yellow/30 bg-background/60 px-1.5 py-0 text-xs font-bold text-neon-yellow disabled:opacity-90 disabled:cursor-not-allowed [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-neon-yellow/70"
              >
                <SelectValue placeholder="CD: —" />
              </SelectTrigger>
              <SelectContent onClick={(e) => e.stopPropagation()} className="min-w-[120px]">
                {(c.attributes || []).map(a => (
                  <SelectItem key={a.id} value={a.id} className="text-xs font-bold text-neon-yellow focus:text-neon-yellow">
                    CD:{a.name.slice(0,3).toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <span className={cn('rounded-full border px-2 py-0.5 text-sm font-bold uppercase', categoryColors[c.category])}>
          {c.category}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-300', expanded && 'rotate-180')} />
      </div>
      </div>

      {isMaster && omniFormulaDiagnostics.length > 0 && (
        <div
          role="alert"
          onClick={(event) => event.stopPropagation()}
          className="mx-4 mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-relaxed text-amber-100"
        >
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Fórmulas ou keys de bônus OMNI inválidas
          </div>
          <ul className="list-disc space-y-1 pl-5">
            {omniFormulaDiagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.source}-${diagnostic.key}-${index}`}>
                <strong>{diagnostic.source}</strong> · {diagnostic.key}: {diagnostic.message}
                {diagnostic.formula && <code className="ml-1 break-all">({diagnostic.formula})</code>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <PortasDaMorteCard c={c} />
      {/* ─── Status bars ─── */}
      <div className="px-4 pb-2 space-y-1.5">
        <div className="flex items-center gap-1">
          <div className="flex-1"><StatusBar
            label="HP" icon="♥" current={c.hpCurrent} max={effectiveHpMax} color="bg-hp"
            baseMax={effectiveHpMax - omniTotalsCombinados.hp}
            maxOrigens={omniOrigensPorChave.hp}
          /></div>
          <TalentBonusBadge bonuses={talentBonuses} prefix="HP máx" />
        </div>
        <div className="flex items-center gap-1">
          <div className="flex-1"><StatusBar
            label="PE" icon="♦" current={c.peCurrent} max={effectivePeMax} color="bg-primary"
            baseMax={effectivePeMax - omniTotalsCombinados.pe}
            maxOrigens={omniOrigensPorChave.pe}
          /></div>
          <TalentBonusBadge bonuses={talentBonuses} prefix="PE máx" />
        </div>
        <StatusBar
          label="PVTs" icon="○" current={c.escCurrent} max={effectiveEscMax} color="bg-shield"
          baseMax={effectiveEscMax - omniTotalsCombinados.esc}
          maxOrigens={omniOrigensPorChave.esc}
        />
        {c.category === 'PLAYER' && <HungerBar character={c} />}
        {(talentBonuses.initiative !== 0 || talentBonuses.attention !== 0 || talentBonuses.luckMax !== 0 || talentBonuses.fortitude !== 0 || talentBonuses.soulRd !== 0 || talentBonuses.movementMeters !== 0 || talentBonuses.immunities.length > 0 || talentBonuses.notes.length > 0 || talentBonuses.suporteLv2Unlocked || talentBonuses.shieldProficient) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1">
            {talentBonuses.initiative !== 0 && (
              <span className="inline-flex items-center gap-1">
                ⚡ Iniciativa: <strong className="text-foreground">{effectiveInitiative >= 0 ? '+' : ''}{effectiveInitiative}</strong>
                <TalentBonusBadge bonuses={talentBonuses} prefix="Iniciativa" />
              </span>
            )}
            {talentBonuses.attention !== 0 && (
              <span className="inline-flex items-center gap-1">
                👁 Atenção: <strong className="text-foreground">+{effectiveAttention}</strong>
                <TalentBonusBadge bonuses={talentBonuses} prefix="Atenção" />
              </span>
            )}
            {hasSpecAbility(c, PRE_ANALISE_ID) && (
              <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 text-primary" title="Pré-Análise (narrativo)">
                👁 Pré-Análise: Atenção +{PRE_ANALISE_ATENCAO} · imune a Surpreso
              </span>
            )}
            {talentBonuses.fortitude !== 0 && (
              <span className="inline-flex items-center gap-1" title="Bônus em Testes de Resistência de Fortitude">
                💪 Fortitude: <strong className="text-foreground">+{talentBonuses.fortitude}</strong>
                <TalentBonusBadge bonuses={talentBonuses} prefix="Fortitude" />
              </span>
            )}
            {talentBonuses.soulRd !== 0 && (
              <span className="inline-flex items-center gap-1" title="Redução de Dano contra Dano de Alma">
                ✨ RD Alma: <strong className="text-foreground">{talentBonuses.soulRd}</strong>
                <TalentBonusBadge bonuses={talentBonuses} prefix="RD Alma" />
              </span>
            )}
            {talentBonuses.movementMeters !== 0 && (
              <span className="inline-flex items-center gap-1" title="Bônus de Deslocamento">
                🏃 Movimento: <strong className="text-foreground">+{talentBonuses.movementMeters}m</strong>
                <TalentBonusBadge bonuses={talentBonuses} prefix="Movimento" />
              </span>
            )}
            {c.luckMax != null && c.luckMax > 0 && (
              <span className="inline-flex items-center gap-1">
                🍀 Sorte:{' '}
                <strong className="text-foreground">{c.luckCurrent ?? 0}/{c.luckMax}</strong>
                <button
                  onClick={(e) => { e.stopPropagation(); useCharacterStore.getState().spendLuck(c.id); }}
                  disabled={(c.luckCurrent ?? 0) <= 0}
                  className="ml-1 rounded border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-xs uppercase font-bold text-primary hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Gastar 1 Sorte: re-rola a última rolagem e fica com o MAIOR (exceto falha crítica). Pode repetir até esgotar. Reseta no Descanso Longo."
                >
                  Gastar
                </button>
              </span>
            )}
            {talentBonuses.immunities.length > 0 && (
              <span className="inline-flex items-center gap-1">
                🛡 Imune: <strong className="text-foreground">{talentBonuses.immunities.join(', ')}</strong>
              </span>
            )}
            {talentBonuses.suporteLv2Unlocked && (
              <span
                className="inline-flex items-center gap-1 rounded border border-emerald-400/40 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300"
                title="Adepto de Medicina: 2º efeito de Suporte em Combate liberado. Cura usa o Nível do personagem; usos /2."
              >
                ⚕ Suporte Lv2
              </span>
            )}
            {talentBonuses.shieldProficient && (
              <span
                className="inline-flex items-center gap-1 rounded border border-sky-400/40 bg-sky-500/10 px-1.5 py-0.5 text-sky-300"
                title="Mestre Defensivo: já proficiente em escudos — RD do escudo equipado é amplificada (base + ⌊base/2⌋)."
              >
                🛡 Escudo+
              </span>
            )}
            {talentBonuses.saveBonusVsDefenseDebuff > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-amber-300"
                title={`Guarda Infalível: +${talentBonuses.saveBonusVsDefenseDebuff} em TR contra efeitos que reduzam Defesa ou imponham penalidade em TRs.`}
              >
                🛡 TR+{talentBonuses.saveBonusVsDefenseDebuff} vs debuff
              </span>
            )}
          </div>
        )}
        {c.restGrant && (
          <div className="pt-1">
            <button
              onClick={() => { setShowRestModal(true); playClickSound(); }}
              className="w-full h-8 rounded-lg border border-primary/40 bg-primary/15 px-3 text-xs font-medium text-primary hover:bg-primary/25 transition-all flex items-center justify-center gap-1.5 glow-primary"
              title={`Descanso ${c.restGrant === 'short' ? 'Curto' : 'Longo'} concedido pelo Mestre`}
            >
              <Moon className="h-3.5 w-3.5" /> Descansar ({c.restGrant === 'short' ? 'Curto' : 'Longo'})
            </button>
          </div>
        )}
        {c.hasBlindfoldSlot && (
          <div className="pt-1" onClick={(e) => e.stopPropagation()}>
            <BlindfoldSlot character={c} />
          </div>
        )}
        {!isPlayer && (
          <div className="pt-1" onClick={(e) => e.stopPropagation()}>
            <label className="flex items-center gap-2 text-[10.5px] text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-3 w-3 cursor-pointer"
                checked={!!c.hasBlindfoldSlot}
                onChange={(e) =>
                  useCharacterStore
                    .getState()
                    .setHasBlindfoldSlot(c.id, e.target.checked)
                }
              />
              [Mestre] Habilitar slot de Venda
            </label>
          </div>
        )}
      </div>

      {showRestModal && c.restGrant && (
        <RestModal character={c} allowedMode={c.restGrant} onClose={() => setShowRestModal(false)} />
      )}

      {/* Memorização Imediata: abre automaticamente após Descanso Longo se houver slots pendentes. */}
      {(c.pendingPreparedSpellSlots ?? 0) > 0 && (
        <PreparedSpellsDialog
          character={c}
          onClose={() => useCharacterStore.getState().updateCharacter(c.id, { pendingPreparedSpellSlots: 0 })}
        />
      )}

      {/* ─── CAM: tabs de núcleos + barra de Integridade da Alma ─── */}
      {isCamActive(c) && (
        <div className="px-4 pb-2">
          <CamCoreTabs character={c} />
        </div>
      )}

      {/* ─── FAH: Vigor Maldito + Anatomias + toggles ─── */}
      {c.origin === 'Feto Amaldiçoada Híbrido (FAH)' && <FahPanel character={c} />}

      {/* ─── Reações do Especialista em Técnica (Bloco A) ─── */}
      {!c.isGrimorioCreature && <SpecReactionsPanel character={c} />}

      {/* ─── Ações ativas do Especialista em Técnica (Bloco B) ─── */}
      {!c.isGrimorioCreature && <SpecActionsPanel character={c} />}

      {/* ─── Inspirar Aliados: botão do aliado inspirado ─── */}
      <InspiradoButton c={c} />

      {/* ─── Suporte: habilidades base ─── */}
      <div onClick={(e) => e.stopPropagation()}>
        <SuportePanel character={c} />
        <CombateEstilosPanel character={c} />
      </div>

      {/* ─── Painel de Ataque (combatEngine) ─── */}
      {/* Visível apenas durante combate ativo. */}
      {/* stopPropagation: o painel está dentro da região clickable do header
          (que toggla expanded). Sem isso, qualquer clique dentro do AttackPanel
          borbulha e fecha/abre a ficha. */}
      {useCombatStore((s) => s.inCombat) && !hideAttackPanel && (
        <div onClick={(e) => e.stopPropagation()}>
          <AttackPanel character={c} />
        </div>
      )}

      {/* ─── DERIVADO: Recuperação de Emergência (1×/dia) ─── */}
      {c.origin === 'Derivado' && (() => {
        const tb = getTrainingBonusByLevel(c.level);
        const recovered = tb * 2;
        const used = !!c.derivadoEmergencyUsed;
        return (
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
              <div className="text-xs">
                <div className="font-bold text-primary">Recuperação de Emergência</div>
                <div className="text-muted-foreground">
                  Ação Bônus em combate · Recupera <b>+{recovered} PE</b> (2× Bônus de Treinamento) · 1×/dia
                </div>
              </div>
              <button
                type="button"
                disabled={used}
                onClick={() => {
                  const r = useCharacterStore.getState().useDerivadoEmergencyRecovery(c.id, useCombatStore.getState().inCombat);
                  if (!r.ok) { toast.error(r.reason ?? 'Falha.'); playErrorSound(); return; }
                  playSuccessSound();
                  toast.success(`+${r.recovered} PE (Recuperação de Emergência).`);
                  useLogStore.getState().addLog('combat', `⚡ ${c.name} usou Recuperação de Emergência → +${r.recovered} PE.`);
                }}
                className={cn(
                  'text-xs font-bold rounded px-3 py-1.5 transition',
                  used
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {used ? 'Usada hoje' : 'Usar'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ─── INUMAKI: Olhos de Cobra e Presas (usos diários = Maestria) ─── */}
      {c.clanId === 'Inumaki' && (() => {
        const max = c.inumakiMax ?? getTrainingBonusByLevel(c.level);
        const cur = c.inumakiUses ?? max;
        return (
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between rounded-md border border-accent/30 bg-accent/5 px-3 py-2">
              <div className="text-xs">
                <div className="font-bold text-accent">Olhos de Cobra e Presas</div>
                <div className="text-muted-foreground">
                  Ação Bônus · Concede Ação Bônus a um aliado (gasta como Reação) · {cur}/{max} hoje
                </div>
              </div>
              <button
                type="button"
                disabled={cur <= 0}
                onClick={() => {
                  const r = useCharacterStore.getState().useInumakiOlhosCobra(c.id);
                  if (!r.ok) { toast.error(r.reason ?? 'Falha.'); playErrorSound(); return; }
                  playSuccessSound();
                  toast.success(`Olhos de Cobra e Presas usado (${r.usesLeft} restante).`);
                  useLogStore.getState().addLog('combat', `🐍 ${c.name} ativou Olhos de Cobra e Presas.`);
                }}
                className={cn(
                  'text-xs font-bold rounded px-3 py-1.5 transition',
                  cur <= 0
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-accent text-accent-foreground hover:bg-accent/90',
                )}
              >
                {cur <= 0 ? 'Esgotado' : 'Usar'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ─── RESTRINGIDO: Resiliência Imediata (usos diários = Maestria) ─── */}
      {c.origin === 'Restringido' && (() => {
        const max = c.restringidoResilMax ?? getTrainingBonusByLevel(c.level);
        const cur = c.restringidoResilUses ?? max;
        const reduce = Math.max(1, Math.floor(c.level / 2)) * 5;
        return (
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between rounded-md border border-hp/30 bg-hp/5 px-3 py-2">
              <div className="text-xs">
                <div className="font-bold text-hp">Resiliência Imediata</div>
                <div className="text-muted-foreground">
                  Reação · Reduz dano em <b>{reduce}</b> OU evita Desmembramento · {cur}/{max} hoje
                </div>
              </div>
              <button
                type="button"
                disabled={cur <= 0}
                onClick={() => {
                  const r = useCharacterStore.getState().useRestringidoResiliencia(c.id);
                  if (!r.ok) { toast.error(r.reason ?? 'Falha.'); playErrorSound(); return; }
                  playSuccessSound();
                  toast.success(`Resili\u00eancia Imediata: -${r.reduced} dano (${r.usesLeft} restante).`);
                  useLogStore.getState().addLog('combat', `🛡 ${c.name} usou Resili\u00eancia Imediata → -${r.reduced} dano.`);
                }}
                className={cn(
                  'text-xs font-bold rounded px-3 py-1.5 transition',
                  cur <= 0
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-hp text-white hover:bg-hp/90',
                )}
              >
                {cur <= 0 ? 'Esgotado' : 'Usar'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ─── RD & Vulnerabilities & Actions ─── */}
      <div className="flex items-center justify-between px-4 pb-2 text-sm text-muted-foreground flex-wrap gap-1">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-medium">RD:<StatValue
            valorBase={totalRD - omniTotalsCombinados.rd}
            valorAtual={totalRD}
            origens={omniOrigensPorChave.rd}
          >{totalRD}</StatValue></span>
          {nonZeroRds.map((t) => (
            <span key={t} className="text-xs rounded bg-secondary/50 px-1.5 py-0.5 whitespace-nowrap" title={`RD ${DAMAGE_TYPE_LABELS[t]}`}>
              {DAMAGE_TYPE_LABELS[t]}:{rdByType[t]}
            </span>
          ))}
          {(c.vulnerabilities || []).length > 0 && (
            <span className="text-xs text-neon-red ml-1">
              ⚠ Vuln: {(c.vulnerabilities || []).map(v => DAMAGE_TYPE_LABELS[v]).join(', ')}
            </span>
          )}
          {(c.immunities || []).length > 0 && (
            <span className="text-xs text-pe ml-1">
              🛡 Imune: {(c.immunities || []).map(v => DAMAGE_TYPE_LABELS[v]).join(', ')}
            </span>
          )}
          {auraEffects.physicalResistanceActive && (
            <span className="text-xs rounded bg-primary/20 border border-primary/40 text-primary px-1.5 py-0.5 ml-1" title="Aura Impenetrável: dano físico (DCO/DP/DI) reduzido à metade por 1 rodada">
              🛡 Aura Impenetrável (½ físico)
            </span>
          )}
          {auraEffects.casuloActive && (
            <span className="text-xs rounded bg-primary/20 border border-primary/40 text-primary px-1.5 py-0.5 ml-1" title={`Casulo de Energia: imune a DCO/DP/DI mundanos; +${auraEffects.casuloTechniqueRD} RD vs técnicas`}>
              🥚 Casulo (imune mundano)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); handleResetActions(); }}
            className="rounded p-0.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Resetar ações"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (c.actionsCurrent > 0) updateCharacter(c.id, { actionsCurrent: c.actionsCurrent - 1 }); }}
            className={cn('rounded px-1.5 py-0.5 text-xs font-bold border transition-colors', c.actionsCurrent > 0 ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary/30 text-muted-foreground/50 border-border')}
            title="Ação Comum"
          >
            AC {c.actionsCurrent}/{effectiveActionsMax}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (c.bonusActionsCurrent > 0) updateCharacter(c.id, { bonusActionsCurrent: c.bonusActionsCurrent - 1 }); }}
            className={cn('rounded px-1.5 py-0.5 text-xs font-bold border transition-colors', c.bonusActionsCurrent > 0 ? 'bg-pe/20 text-pe border-pe/40' : 'bg-secondary/30 text-muted-foreground/50 border-border')}
            title="Ação Bônus"
          >
            AB {c.bonusActionsCurrent}/{c.bonusActionsMax + itemBonuses.bonusActions}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); useReactionStore.getState().consumeReaction(c.id); }}
            className={cn('rounded px-1.5 py-0.5 text-xs font-bold border transition-colors', getReactionsAvailable(c) > 0 ? 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/40' : 'bg-secondary/30 text-muted-foreground/50 border-border')}
            title="Reação"
          >
            RÇ {getReactionsAvailable(c)}/{c.reactionsMax + itemBonuses.reactions}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (c.opportunityCurrent > 0) updateCharacter(c.id, { opportunityCurrent: c.opportunityCurrent - 1 }); }}
            className={cn('rounded px-1.5 py-0.5 text-xs font-bold border transition-colors', c.opportunityCurrent > 0 ? 'bg-hp/20 text-hp border-hp/40' : 'bg-secondary/30 text-muted-foreground/50 border-border')}
            title={talentBonuses.opportunity > 0 ? `Ataque de Oportunidade (+${talentBonuses.opportunity} de talentos)${talentBonuses.notes.find(n=>n.includes('AdO')) ? ' · ' + talentBonuses.notes.find(n=>n.includes('AdO')) : ''}` : 'Ataque de Oportunidade'}
          >
            AO {c.opportunityCurrent}/{c.opportunityMax + itemBonuses.opportunity + talentBonuses.opportunity}
            {talentBonuses.opportunity > 0 && <span className="ml-0.5 text-primary/80">⚙</span>}
          </button>
          <span title={espacosIntermediarios > 0 ? 'Inclui ' + espacosIntermediarios.toLocaleString('pt-BR') + ' espaço(s) de intermediário vinculado.' : undefined}>📦 {slotsAtualComIntermediarios.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/<StatValue
            valorBase={effectiveSlotsMax - omniTotalsCombinados.slots}
            valorAtual={effectiveSlotsMax}
            origens={omniOrigensPorChave.slots}
          >{effectiveSlotsMax}</StatValue></span>
          {!isPlayer && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowDamagePanel(!showDamagePanel); }}
              className={cn(
                'rounded-lg p-1.5 transition-all duration-200',
                showDamagePanel ? 'bg-hp/20 text-hp shadow-sm shadow-hp/20' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              )}
              title="Dano / Cura / Escudo"
            >
              <Heart className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {canManageThisCharacter && (c.activeConcentrations || []).length > 0 && (
        <ActiveConcentrationPanel character={c} />
      )}
      {/* Active Buffs */}
      {activeBuffs.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {activeBuffs.map((b) => {
            const desc = b.type === 'ca' ? `CA+${b.value}`
              : b.type === 'hit' ? `Acerto+${b.value}`
              : b.type === 'extraDice' ? `+${b.extraDiceCount}d${b.extraDiceSides}`
              : b.type === 'extraDiceAfter' ? `Dano extra ${b.extraDamageFormula ?? `${b.extraDiceCount ?? 0}d${b.extraDiceSides ?? 0}`}`
              : b.type === 'rd' ? `RD+${b.value}${b.rdDamageTypes?.length ? ` (${b.rdDamageTypes.join('/')})` : ''}`
              : (b.targetName || '');
            const isSus = b.isSustained || b.remainingTurns === -1;
            const durLabel = b.expiraNaRodada !== undefined ? `R${b.expiraNaRodada}` : isSus ? '♾' : `${b.remainingTurns}t`;
            return (
              <span
                key={b.id}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs font-medium inline-flex items-center gap-1",
                  isSus ? "bg-primary/20 border-primary/40 text-primary" : "bg-pe/20 border-pe/30 text-pe"
                )}
                title={`${b.spellName}${isSus ? ' (sustentado)' : ''}`}
              >
                {isSus ? '♾' : '🔮'} {b.spellName}: {desc} ({durLabel})
                <button
                  onClick={() => {
                    useCharacterStore.getState().removeBuff(c.id, b.id);
                    addLog('spell', `${isSus ? '♾' : '🔮'} ${c.name} cancelou buff "${b.spellName}" (${desc})`);
                  }}
                  className="text-destructive/60 hover:text-destructive"
                  title="Cancelar buff"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Active Conditions */}
      {(c.activeConditions || []).length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {(c.activeConditions || []).map((cd) => {
            const dur = cd.remainingTurns === -1 && cd.remainingRounds === -1 ? '∞'
              : cd.remainingTurns > 0 ? `${cd.remainingTurns}t`
              : `${cd.remainingRounds}rd`;
            return (
              <span key={cd.id} className="rounded-full bg-hp/20 border border-hp/30 px-2 py-0.5 text-xs text-hp font-medium group cursor-pointer" title={`${cd.name}${cd.sourceCharName ? ` (por ${cd.sourceCharName})` : ''}`}>
                {cd.icon} {cd.name} ({dur})
                {cd.conditionId !== 'caido' && <button onClick={() => removeCondition(c.id, cd.id)} className="ml-1 text-destructive/60 hover:text-destructive hidden group-hover:inline">✕</button>}
              </span>
            );
          })}
        </div>
      )}

      {/* ─── Damage/Heal Panel ─── */}
      <SmoothCollapse open={showDamagePanel}>
        <div className="px-4 pb-3 border-t border-border pt-2">
          <DamageHealPanel sourceId={c.id} sourceName={c.name} />
        </div>
      </SmoothCollapse>

      {/* ─── Roll result ─── */}
      {rollResult && (
        <div className={cn(
          'mx-4 mb-2 rounded-xl border p-2 text-center text-sm font-mono transition-all relative',
          rollAnimating
            ? 'border-primary/50 bg-primary/10 animate-pulse'
            : rollResult.d20 === 20
              ? 'border-neon-green bg-neon-green/20 text-neon-green'
              : rollResult.d20 === 1
                ? 'border-neon-red bg-neon-red/20 text-neon-red'
                : 'border-primary/30 bg-secondary/50'
        )}>
          {!rollAnimating && (
            <button onClick={() => setRollResult(null)} className="absolute top-1 right-1 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
          <div className="text-xs text-muted-foreground mb-0.5">{rollResult.label}</div>
          <div className="text-lg font-bold text-foreground">
            d20({rollResult.d20}) {rollResult.bonus >= 0 ? '+' : '−'} {Math.abs(rollResult.bonus)} = <span className="text-primary">{rollResult.total}</span>
          </div>
          {!rollAnimating && rollResult.d20 === 20 && <div className="text-neon-green font-bold">CRÍTICO!</div>}
          {!rollAnimating && rollResult.d20 === 1 && <div className="text-neon-red font-bold">FALHA CRÍTICA!</div>}
          {!rollAnimating && rollResult.hitResults && rollResult.hitResults.length > 0 && (
            <div className="mt-1 space-y-0.5 text-xs">
              {rollResult.hitResults.map((hr, i) => (
                <div key={i} className={cn('font-bold',
                  hr.hit === 'crit' ? 'text-indigo-400' :
                  hr.hit === 'hit' ? 'text-neon-green' :
                  hr.hit === 'critFail' ? 'text-fuchsia-500' :
                  'text-neon-red'
                )}>
                  {hr.hit === 'crit' ? '✨' : hr.hit === 'hit' ? '✅' : hr.hit === 'critFail' ? '💀' : '❌'} {hr.name}
                  {' — '}
                  {hr.hit === 'crit' ? 'ACERTO CRÍTICO!' : hr.hit === 'hit' ? 'ACERTOU' : hr.hit === 'critFail' ? 'FALHA CRÍTICA' : 'ERROU'}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Expanded content ─── */}
      <SmoothCollapse open={expanded}>
        <div className="border-t border-border px-4 py-3 space-y-3 resize-y overflow-auto" style={{ minHeight: expanded ? '200px' : undefined }}>
          <ExhaustionControl character={c} />
          {!c.isGrimorioCreature && <PendingLevelChoicesPanel character={c} />}
          <div className="space-y-2">
            {/* Attack types with linked attr, training, mastery */}
            <div className="space-y-1.5">
              {(['melee', 'ranged', 'cursed'] as const).map((atkType) => {
                const label = atkType === 'melee' ? 'Corpo a Corpo' : atkType === 'ranged' ? 'A Distância' : 'Amaldiçoado';
                const bonusKey = atkType === 'melee' ? 'meleeAttackBonus' : atkType === 'ranged' ? 'rangedAttackBonus' : 'cursedAttackBonus';
                const linkedKey = atkType === 'melee' ? 'meleeLinkedAttr' : atkType === 'ranged' ? 'rangedLinkedAttr' : 'cursedLinkedAttr';
                const trainedKey = atkType === 'melee' ? 'meleeTrained' : atkType === 'ranged' ? 'rangedTrained' : 'cursedTrained';
                const bonus = (c as any)[bonusKey] || 0;
                const linkedId = (c as any)[linkedKey] || '';
                const trained = (c as any)[trainedKey] || false;
                const total = getAttackTotalBonus(atkType);
                const emoji = atkType === 'melee' ? '⚔️' : atkType === 'ranged' ? '🏹' : '👁‍🗨';
                return (
                  <div key={atkType} className="flex items-center gap-1.5 flex-wrap rounded-lg bg-secondary/30 px-2 py-1">
                    <span className="text-sm font-bold text-muted-foreground w-[90px]">{emoji} {label}</span>
                    {/* Treinamento — IRREVERSÍVEL. Players NÃO podem alternar livremente
                        (apenas Mestre concede via aptidão/regra). Mostramos apenas o estado. */}
                    {!isPlayer ? (
                      <button
                        onClick={() => {
                          // Mestre em modo de edição: pode tirar e colocar livremente.
                          if (editMode) {
                            updateCharacter(c.id, { [trainedKey]: !trained } as any);
                            return;
                          }
                          if (!trained) updateCharacter(c.id, { [trainedKey]: true } as any);
                        }}
                        disabled={trained && !editMode}
                        className={cn('w-4 h-4 rounded-sm border text-xs font-bold flex items-center justify-center disabled:cursor-not-allowed',
                          trained ? 'bg-primary/30 border-primary text-primary' : 'border-border text-muted-foreground/40 hover:border-primary/50')}
                        title={
                          editMode
                            ? (trained ? 'Treinamento ativo — clique para remover (modo edição)' : `Treinamento (+${getMasteryBonus(c.level)}) — clique para conceder`)
                            : (trained ? 'Treinamento já definido (irreversível)' : `Treinamento (+${getMasteryBonus(c.level)})`)
                        }
                      >T</button>
                    ) : trained ? (
                      <span
                        className="w-4 h-4 rounded-sm border bg-primary/30 border-primary text-primary text-xs font-bold flex items-center justify-center"
                        title={`Treinamento ativo (+${getMasteryBonus(c.level)}) — apenas o Mestre pode conceder`}
                      >T</span>
                    ) : null}
                    {/* Linked attribute — Melee/Ranged: só FOR ou DES. Cursed: qualquer atributo. */}
                    <select
                      value={linkedId}
                      onChange={(e) => {
                        const newId = e.target.value;
                        if (!newId) return;
                        const attr = c.attributes.find(a => a.id === newId);
                        const ctxLabel = atkType === 'melee'
                          ? 'Ataque Corpo a Corpo'
                          : atkType === 'ranged'
                            ? 'Ataque à Distância'
                            : 'Ataque Amaldiçoado';
                        requestAttrLock({
                          context: ctxLabel,
                          attrName: attr?.name ?? '—',
                          onConfirm: () => updateCharacter(c.id, { [linkedKey]: newId } as any),
                        });
                      }}
                      className="h-6 rounded border border-input bg-background px-0.5 text-xs text-foreground w-16 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={linkedId ? "Atributo não pode ser alterado após definido" : (atkType === 'cursed' ? 'Atributo vinculado' : 'Atributo vinculado (apenas FOR ou DES)')}
                      disabled={!!linkedId}
                    >
                      <option value="">—</option>
                      {c.attributes
                        .filter(a => atkType === 'cursed' || a.name === 'Força' || a.name === 'Destreza')
                        .map(a => <option key={a.id} value={a.id}>{a.name.slice(0, 3)}</option>)}
                    </select>
                    {/* Extra bonus — apenas Mestre pode editar */}
                    {!isPlayer ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={bonus || ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '' || raw === '-') { updateCharacter(c.id, { [bonusKey]: 0 } as any); return; }
                          const num = parseInt(raw);
                          if (!isNaN(num)) updateCharacter(c.id, { [bonusKey]: num } as any);
                        }}
                        className="h-6 w-10 rounded border border-input bg-background px-0.5 text-center text-xs font-mono text-foreground"
                        title="Bônus externo"
                      />
                    ) : bonus !== 0 ? (
                      <span className="h-6 px-1 inline-flex items-center text-xs font-mono text-muted-foreground" title="Bônus externo (apenas Mestre edita)">
                        {bonus >= 0 ? '+' : ''}{bonus}
                      </span>
                    ) : null}
                    <span className={cn('font-mono font-bold text-sm', total >= 0 ? 'text-primary' : 'text-hp')}>
                      {total >= 0 ? '+' : ''}{total}
                    </span>
                    <div className="ml-auto relative flex items-center gap-1">
                      <button
                        onClick={() => { playClickSound(); setOpenTargetPicker(openTargetPicker === atkType ? null : atkType); }}
                        className={cn(
                          'h-6 w-6 rounded-md border flex items-center justify-center transition-colors relative',
                          attackTargets[atkType].length > 0
                            ? 'bg-primary/30 border-primary text-primary'
                            : 'bg-secondary/40 border-border text-muted-foreground hover:border-primary/40',
                        )}
                        title={attackTargets[atkType].length > 0 ? `${attackTargets[atkType].length} alvo(s) selecionado(s)` : 'Selecionar alvo(s)'}
                      >
                        <Crosshair className="h-3 w-3" />
                        {attackTargets[atkType].length > 0 && (
                          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary text-xs font-bold text-primary-foreground flex items-center justify-center">
                            {attackTargets[atkType].length}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => handleAttackTypeRoll(atkType)}
                        className="h-6 w-6 rounded-md bg-primary/15 hover:bg-primary/30 border border-primary/40 text-primary flex items-center justify-center transition-colors"
                        title={`Rolar ${label}: d20 ${total >= 0 ? '+' : ''}${total}`}
                      >
                        <Dice1 className="h-3.5 w-3.5" />
                      </button>
                      {openTargetPicker === atkType && (
                        <div className="absolute right-0 top-7 z-50 w-56 rounded-lg border border-border bg-popover p-2 shadow-lg space-y-1">
                          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
                            <span>Alvos · {label}</span>
                            <button onClick={() => setOpenTargetPicker(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                          </div>
                          <div className="flex flex-wrap gap-1 max-h-40 overflow-auto">
                            {allCharacters.filter(ch => ch.id !== c.id).map(ch => {
                              const sel = attackTargets[atkType].includes(ch.id);
                              return (
                                <button
                                  key={ch.id}
                                  onClick={() => { playClickSound(); toggleAttackTarget(atkType, ch.id); }}
                                  className={cn(
                                    'rounded-full px-2 py-0.5 text-xs font-medium border transition-colors',
                                    sel ? 'bg-primary/30 border-primary text-primary' : 'bg-secondary/40 border-border text-muted-foreground hover:border-primary/40',
                                  )}
                                >{ch.name}</button>
                              );
                            })}
                            {allCharacters.filter(ch => ch.id !== c.id).length === 0 && (
                              <span className="text-xs italic text-muted-foreground">Nenhum outro personagem.</span>
                            )}
                          </div>
                          {attackTargets[atkType].length > 0 && (
                            <button
                              onClick={() => setAttackTargets(prev => ({ ...prev, [atkType]: [] }))}
                              className="w-full rounded-md border border-border bg-background/40 px-2 py-1 text-xs text-muted-foreground hover:border-hp/40 hover:text-hp"
                            >Limpar alvos</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {buffHit > 0 && <span className="text-xs text-pe font-bold">+{buffHit} buff</span>}
              <span className="text-sm text-muted-foreground">Base: +{getBaseAttackBonus(c.level)} (nível)</span>
              <div className="ml-auto flex items-center gap-1">
                {!isPlayer && (
                  <button onClick={() => setEditMode(!editMode)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" title={editMode ? 'Modo visualização' : 'Modo edição'}>
                    {editMode ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                )}
                {!isPlayer && (
                  <button
                    onClick={() => { playClickSound(); setPoolGrantOpen(true); }}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-primary"
                    title="Conceder pontos de pools (Mestre)"
                  >
                    <Wallet className="h-4 w-4" />
                  </button>
                )}
                {!isPlayer && editMode && <DeleteConfirm onConfirm={() => { setRemoving(true); setTimeout(() => removeCharacter(c.id), 300); }} label={c.name} />}
              </div>
            </div>
          </div>

          {/* Edit stats */}
          {editMode && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="space-y-1">
                <label className="text-muted-foreground">HP Atual / Max</label>
                <div className="flex gap-1">
                  <NullSafeInput value={c.hpCurrent} onChange={(v) => updateCharacter(c.id, { hpCurrent: v })} className="w-full" />
                  <NullSafeInput value={c.hpMax} onChange={(v) => updateCharacter(c.id, { hpMax: v })} className="w-full" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">PE Atual / Max</label>
                <div className="flex gap-1">
                  <NullSafeInput value={c.peCurrent} onChange={(v) => updateCharacter(c.id, { peCurrent: v })} className="w-full" />
                  <NullSafeInput value={c.peMax} onChange={(v) => updateCharacter(c.id, { peMax: v })} className="w-full" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">AC / AB / RÇ / AO (Max)</label>
                <div className="flex gap-1">
                  <NullSafeInput value={c.actionsMax} onChange={(v) => updateCharacter(c.id, { actionsMax: v, actionsCurrent: v })} className="w-full" />
                  <NullSafeInput value={c.bonusActionsMax} onChange={(v) => updateCharacter(c.id, { bonusActionsMax: v, bonusActionsCurrent: v })} className="w-full" />
                  <NullSafeInput value={c.reactionsMax} onChange={(v) => updateCharacter(c.id, { reactionsMax: v, reactionsCurrent: v })} className="w-full" />
                  <NullSafeInput value={c.opportunityMax} onChange={(v) => updateCharacter(c.id, { opportunityMax: v, opportunityCurrent: v })} className="w-full" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">Bônus Iniciativa / Movimento (m)</label>
                <div className="flex gap-1">
                  <NullSafeInput value={c.initiativeBonus} onChange={(v) => updateCharacter(c.id, { initiativeBonus: v })} className="w-full" />
                  <NullSafeInput value={c.movement ?? 9} onChange={(v) => updateCharacter(c.id, { movement: v })} className="w-full" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">ESC Atual / Max</label>
                <div className="flex gap-1">
                  <NullSafeInput value={c.escCurrent} onChange={(v) => updateCharacter(c.id, { escCurrent: v })} className="w-full" />
                  <NullSafeInput value={c.escMax} onChange={(v) => updateCharacter(c.id, { escMax: v })} className="w-full" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">RD / CA / CD / {c.category === 'INIMIGO' ? 'ND' : 'Nível'}</label>
                <div className="flex gap-1">
                  <NullSafeInput value={c.rd} onChange={(v) => updateCharacter(c.id, { rd: v })} className="w-full" />
                  <NullSafeInput value={c.ca} onChange={(v) => updateCharacter(c.id, { ca: v })} className="w-full" />
                  <NullSafeInput value={c.baseDC || 10} onChange={(v) => updateCharacter(c.id, { baseDC: v })} className="w-full" />
                  {c.category === 'INIMIGO' ? (
                    <div className="h-7 w-full rounded border border-input bg-muted px-2 text-xs text-muted-foreground text-center font-mono flex items-center justify-center" title="ND fixo pela criação no Grimório">
                      {c.level}
                    </div>
                  ) : (
                    <NullSafeInput value={c.level} onChange={(v) => updateCharacter(c.id, { level: v })} className="w-full" />
                  )}
                </div>
              </div>
              {/* CD: atributo vinculado (travado uma vez definido) — mesma lógica das jogadas de ataque */}
              <div className="space-y-1">
                <label className="text-muted-foreground">Atributo da CD <span className="text-xs opacity-70">(travado após definir)</span></label>
                <div className="flex items-center gap-2">
                  <select
                    value={c.dcLinkedAttr || ''}
                    onChange={(e) => {
                      const newId = e.target.value;
                      if (!newId) return;
                      const attr = (c.attributes || []).find(a => a.id === newId);
                      requestAttrLock({
                        context: 'CD (Classe de Dificuldade)',
                        attrName: attr?.name ?? '—',
                        onConfirm: () => updateCharacter(c.id, { dcLinkedAttr: newId }),
                      });
                    }}
                    disabled={!!c.dcLinkedAttr}
                    title={c.dcLinkedAttr ? 'Atributo da CD não pode ser alterado após definido' : 'Atributo vinculado à CD'}
                    className="h-8 flex-1 rounded border border-input bg-background px-1 text-xs text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">— Nenhum —</option>
                    {(c.attributes || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  {(() => {
                    const attr = (c.attributes || []).find(a => a.id === c.dcLinkedAttr);
                    if (!attr) return null;
                    const mod = Math.floor((attr.value - 10) / 2);
                    return (
                      <span className="text-xs font-mono font-bold text-primary whitespace-nowrap">
                        {attr.name.slice(0, 3).toUpperCase()} {mod >= 0 ? '+' : ''}{mod}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">Slots Atual / Max</label>
                <div className="flex gap-1">
                  <NullSafeInput value={c.slotsCurrent} onChange={(v) => updateCharacter(c.id, { slotsCurrent: v })} className="w-full" />
                  <NullSafeInput value={c.slotsMax} onChange={(v) => updateCharacter(c.id, { slotsMax: v })} className="w-full" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">Nv. Dado Dano / Margem Crítico</label>
                <div className="flex gap-1">
                  <NullSafeInput value={c.damageDiceLevel ?? 0} onChange={(v) => updateCharacter(c.id, { damageDiceLevel: v })} className="w-full" />
                  <NullSafeInput value={c.critMargin ?? 20} onChange={(v) => updateCharacter(c.id, { critMargin: v })} className="w-full" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-muted-foreground">Aumento CD / Prejuízo Rolagem</label>
                <div className="flex gap-1">
                  <NullSafeInput value={c.cdIncrease ?? 0} onChange={(v) => updateCharacter(c.id, { cdIncrease: v })} className="w-full" />
                  <NullSafeInput value={c.rollPenalty ?? 0} onChange={(v) => updateCharacter(c.id, { rollPenalty: v })} className="w-full" />
                </div>
              </div>
              {/* RD by damage type */}
              <div className="col-span-2 space-y-1">
                <label className="text-muted-foreground text-xs">RD por tipo de dano</label>
                <div className="grid grid-cols-3 gap-1">
                  {DAMAGE_TYPES.map((t) => (
                    <div key={t} className="flex items-center gap-0.5">
                      <label className="text-xs text-muted-foreground w-16 truncate" title={DAMAGE_TYPE_LABELS[t]}>{DAMAGE_TYPE_LABELS[t]}</label>
                      <NullSafeInput
                        value={rdByType[t]}
                        onChange={(v) => {
                          const newRd = { ...rdByType, [t]: v };
                          updateCharacter(c.id, { rdByType: newRd });
                        }}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
              {/* Vulnerabilities */}
              <div className="col-span-2 space-y-1">
                <label className="text-muted-foreground text-xs">Vulnerabilidades (1.5x dano)</label>
                <div className="grid grid-cols-3 gap-1">
                  {DAMAGE_TYPES.map((t) => {
                    const vulns = c.vulnerabilities || [];
                    const isVuln = vulns.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => {
                          const newVulns = isVuln ? vulns.filter(v => v !== t) : [...vulns, t];
                          updateCharacter(c.id, { vulnerabilities: newVulns });
                        }}
                        className={cn(
                          'text-xs rounded px-1.5 py-1 border transition-colors text-left',
                          isVuln
                            ? 'bg-neon-red/20 text-neon-red border-neon-red/40'
                            : 'bg-secondary/30 text-muted-foreground border-border hover:border-neon-red/30'
                        )}
                      >
                        {DAMAGE_TYPE_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Immunities */}
              <div className="col-span-2 space-y-1">
                <label className="text-muted-foreground text-xs">Imunidades (ignora dano)</label>
                <div className="grid grid-cols-3 gap-1">
                  {DAMAGE_TYPES.map((t) => {
                    const immunes = c.immunities || [];
                    const isImmune = immunes.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => {
                          const newImmunes = isImmune ? immunes.filter(v => v !== t) : [...immunes, t];
                          updateCharacter(c.id, { immunities: newImmunes });
                        }}
                        className={cn(
                          'text-xs rounded px-1.5 py-1 border transition-colors text-left',
                          isImmune
                            ? 'bg-pe/20 text-pe border-pe/40'
                            : 'bg-secondary/30 text-muted-foreground border-border hover:border-pe/30'
                        )}
                      >
                        {DAMAGE_TYPE_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Character Class */}
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs">Classe</label>
                <select
                  value={c.characterClass || 'Não-Feiticeiro'}
                  onChange={(e) => {
                    const newClass = e.target.value as CharacterClass;
                    const updates: Partial<Character> = { characterClass: newClass };
                    if (newClass === 'Não-Feiticeiro') {
                      updates.specialization = 'Lutador' as Specialization;
                    }
                    updateCharacter(c.id, updates);
                  }}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                >
                  {CHARACTER_CLASSES.map((cls) => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
                {c.characterClass === 'Não-Feiticeiro' && (
                  <p className="text-xs text-muted-foreground italic">
                    Não-Feiticeiros não possuem classe/especialização de feitiçaria.
                  </p>
                )}
              </div>
              {/* Especialização - show for Feiticeiro only */}
              {c.characterClass === 'Feiticeiro' && (
                <div className="space-y-1">
                  <label className="text-muted-foreground text-xs">Especialização</label>
                  <select
                    value={c.specialization || 'Lutador'}
                    onChange={(e) => updateCharacter(c.id, { specialization: e.target.value as Specialization })}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  >
                    {SPECIALIZATIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Motivação - show for Maldição only */}
              {c.characterClass === 'Maldição' && (
                <div className="space-y-1">
                  <label className="text-muted-foreground text-xs">Motivação</label>
                  <select
                    value={c.motivation || 'Medo'}
                    onChange={(e) => updateCharacter(c.id, { motivation: e.target.value as Motivation })}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  >
                    {MOTIVATIONS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Origem - show for Feiticeiro only */}
              {c.characterClass === 'Feiticeiro' && (
                <div className="space-y-1">
                  <label className="text-muted-foreground text-xs">Origem</label>
                  <select
                    value={c.origin || 'Inato'}
                    onChange={(e) => updateCharacter(c.id, { origin: e.target.value as Origin })}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                  >
                    {ORIGINS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* ─── Collapsible Sections ─── */}
          {c.characterClass === 'Feiticeiro' && c.specialization === 'Lutador' && (
            <Section icon={<Zap className="h-4 w-4" />} title="Empolgação">
              <EmpolgacaoPanel character={c} />
            </Section>
          )}

          <Section icon={<Sparkles className="h-4 w-4" />} title="Atributos">
            {(c.availableAttrPoints ?? 0) > 0 && (
              <button
                onClick={() => { playClickSound(); setShowAttrSpend(true); }}
                className="mb-2 w-full rounded-md border border-primary/60 bg-gradient-to-r from-primary/20 to-accent/15 px-3 py-2 text-xs font-bold text-primary hover:from-primary/30 hover:to-accent/25 transition-colors flex items-center justify-center gap-2 animate-pulse"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Distribuir {c.availableAttrPoints} ponto{(c.availableAttrPoints ?? 0) > 1 ? 's' : ''} de atributo
              </button>
            )}
            <AttributeBlock
              items={c.attributes}
              editMode={editMode}
              onAdd={(attr) => addAttribute(c.id, attr)}
              onRemove={(id) => removeAttribute(c.id, id)}
              onRoll={(name, val) => handleAttrRoll(name, val)}
              getBonus={getItemRollBonus}
              isAttribute={true}
              onUpdateValue={(attrId, value) => {
                const newAttrs = c.attributes.map(a => a.id === attrId ? { ...a, value } : a);
                updateCharacter(c.id, { attributes: newAttrs });
              }}
            />
          </Section>

          {/* ─── Perfil Amaldiçoado — Aptidões (sistema numérico AU/CL/BAR/DOM/ER) ─── */}
          {!(c.specialization === 'Restringido') && (
            <Section icon={<Sparkles className="h-4 w-4" />} title="Perfil Amaldiçoado — Aptidões">
              <div className="space-y-3">
                <CursedAptitudesSection
                  character={c}
                   onAptitudeClick={(key) => {
                     if (key === 'AU') {
                       setAuraCatalogOpen((o) => !o);
                       setClCatalogOpen(false);
                       setDomCatalogOpen(false);
                       setBarCatalogOpen(false);
                       setErCatalogOpen(false);
                       setSpecialCatalogOpen(false);
                     } else if (key === 'CL') {
                       setClCatalogOpen((o) => !o);
                       setAuraCatalogOpen(false);
                       setDomCatalogOpen(false);
                       setBarCatalogOpen(false);
                       setErCatalogOpen(false);
                       setSpecialCatalogOpen(false);
                     } else if (key === 'DOM') {
                       setDomCatalogOpen((o) => !o);
                       setAuraCatalogOpen(false);
                       setClCatalogOpen(false);
                       setBarCatalogOpen(false);
                       setErCatalogOpen(false);
                       setSpecialCatalogOpen(false);
                     } else if (key === 'BAR') {
                       setBarCatalogOpen((o) => !o);
                       setAuraCatalogOpen(false);
                       setClCatalogOpen(false);
                       setDomCatalogOpen(false);
                       setErCatalogOpen(false);
                       setSpecialCatalogOpen(false);
                     } else if (key === 'ER') {
                       setErCatalogOpen((o) => !o);
                       setAuraCatalogOpen(false);
                       setClCatalogOpen(false);
                       setDomCatalogOpen(false);
                       setBarCatalogOpen(false);
                       setSpecialCatalogOpen(false);
                     }
                   }}
                />
                {auraCatalogOpen && (
                  <div className="rounded-lg border border-primary/30 bg-card/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-wider text-primary">
                        Catálogo — Aptidões de Aura (AU)
                      </div>
                    </div>
                    <AuraAptitudesPanel
                      character={c}
                      editMode={editMode}
                    />
                  </div>
                )}
                {clCatalogOpen && (
                  <div className="rounded-lg border border-primary/30 bg-card/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-wider text-primary">
                        Catálogo — Aptidões de Controle e Leitura (CL)
                      </div>
                    </div>
                    <ClAptitudesPanel
                      character={c}
                      editMode={editMode}
                    />
                  </div>
                )}
                {domCatalogOpen && (
                  <div className="rounded-lg border border-primary/30 bg-card/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-wider text-primary">
                        Catálogo — Aptidões de Domínio (DOM)
                      </div>
                    </div>
                    <DomAptitudesPanel
                      character={c}
                      editMode={editMode}
                    />
                  </div>
                )}
                {barCatalogOpen && (
                  <div className="rounded-lg border border-primary/30 bg-card/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-wider text-primary">
                        Catálogo — Aptidões de Barreira (BAR)
                      </div>
                    </div>
                    <BarAptitudesPanel
                      character={c}
                      editMode={editMode}
                    />
                  </div>
                )}
                {erCatalogOpen && (
                  <div className="rounded-lg border border-primary/30 bg-card/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-wider text-primary">
                        Catálogo — Aptidões de Energia Reversa (ER)
                      </div>
                    </div>
                    <ErAptitudesPanel
                      character={c}
                      editMode={editMode}
                    />
                  </div>
                )}
                {/* Botão dedicado para Aptidões Especiais (sem nível numérico) */}
                <button
                  type="button"
                  onClick={() => {
                    setSpecialCatalogOpen((o) => !o);
                    setAuraCatalogOpen(false);
                    setClCatalogOpen(false);
                    setDomCatalogOpen(false);
                    setBarCatalogOpen(false);
                    setErCatalogOpen(false);
                  }}
                  className="w-full rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-between"
                >
                  <span>✦ Aptidões Especiais</span>
                  <span className="text-xs opacity-80">{specialCatalogOpen ? 'Fechar' : 'Abrir catálogo'}</span>
                </button>
                {specialCatalogOpen && (
                  <div className="rounded-lg border border-primary/30 bg-card/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-wider text-primary">
                        Catálogo — Aptidões Especiais
                      </div>
                    </div>
                    <SpecialAptitudesPanel
                      character={c}
                      editMode={editMode}
                    />
                  </div>
                )}
                {/* Botão dedicado para Aptidões Amaldiçoadas Exclusivas (CURSED — para classe Maldição). Oculto para players. */}
                {!isPlayer && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setCursedCatalogOpen((o) => !o);
                        setAuraCatalogOpen(false);
                        setClCatalogOpen(false);
                        setDomCatalogOpen(false);
                        setBarCatalogOpen(false);
                        setErCatalogOpen(false);
                        setSpecialCatalogOpen(false);
                      }}
                      className="w-full rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-between"
                    >
                      <span>💀 Aptidões Amaldiçoadas Exclusivas</span>
                      <span className="text-xs opacity-80">{cursedCatalogOpen ? 'Fechar' : 'Abrir catálogo'}</span>
                    </button>
                    {cursedCatalogOpen && (
                      <div className="rounded-lg border border-primary/30 bg-card/40 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-xs font-bold uppercase tracking-wider text-primary">
                            Catálogo — Aptidões Amaldiçoadas Exclusivas (Maldição)
                          </div>
                        </div>
                        <CursedExclusivePanel character={c} editMode={editMode} />
                      </div>
                    )}
                  </>
                )}

                {/* Dotes Gerais — oculto para players (apenas Mestre vê). */}
                {!isPlayer && (
                  <>
                    <button
                      type="button"
                      onClick={() => setDotesCatalogOpen((o) => !o)}
                      className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-between"
                    >
                      <span>⭐ Dotes Gerais</span>
                      <span className="text-xs opacity-80">{dotesCatalogOpen ? 'Fechar' : 'Abrir'}</span>
                    </button>
                    <DotesPanel
                      character={c}
                      editMode={editMode}
                      catalogOpen={dotesCatalogOpen}
                      onCatalogOpenChange={setDotesCatalogOpen}
                    />
                  </>
                )}
              </div>
            </Section>
          )}

          <Section icon={<ScrollText className="h-4 w-4" />} title="Perícias">
            <label className="mb-1 flex items-center gap-2 text-xs text-muted-foreground" data-testid="chamativa-label">
              <input
                type="checkbox"
                data-testid="chamativa-check"
                checked={acaoChamativa}
                onChange={(e) => setAcaoChamativa(e.target.checked)}
              />
              Após ataque / ação chamativa (penalidade de {penalidadeChamativa(c)} em Furtividade)
            </label>
            <SkillBlock

              items={c.skills}
              attributes={c.attributes}
              editMode={editMode}
              charLevel={c.level}
              charId={c.id}
              characterClass={c.characterClass}
              isPlayer={isPlayer}
              enforceTrainingLimit
              onAdd={(s) => addSkill(c.id, s)}
              onRemove={(id) => removeSkill(c.id, id)}
              onRoll={(name, val, linkedId, trained, mastery, ext) => handleSkillRoll(name, val, linkedId, trained, mastery, ext)}
              getBonus={getItemRollBonus}
              getOmniSkillBonus={getOmniSkillBonus}
              onUpdate={(skillId: string, updates: Partial<Attribute>) => {
                const newSkills = c.skills.map(s => s.id === skillId ? { ...s, ...updates } : s);
                updateCharacter(c.id, { skills: newSkills });
              }}
            />
          </Section>

          <Section icon={<ShieldAlert className="h-4 w-4" />} title="Testes de Resistência">
            {editMode && (
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 px-2 py-1.5 text-xs">
                <span className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Pool TR</span>
                <label className="flex items-center gap-1">
                  <span className="text-primary font-bold">T</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={c.availableSavingTrainings ?? 0}
                    onChange={(e) => {
                      const v = Math.max(0, parseInt(e.target.value) || 0);
                      updateCharacter(c.id, { availableSavingTrainings: v });
                    }}
                    className="h-6 w-12 rounded border border-input bg-background px-1 text-center font-mono"
                    title="Treinos de TR disponíveis"
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-pe font-bold">M</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={c.availableSavingMastery ?? 0}
                    onChange={(e) => {
                      const v = Math.max(0, parseInt(e.target.value) || 0);
                      updateCharacter(c.id, { availableSavingMastery: v });
                    }}
                    className="h-6 w-12 rounded border border-input bg-background px-1 text-center font-mono"
                    title="Maestrias de TR disponíveis"
                  />
                </label>
                <span className="ml-auto text-xs text-muted-foreground italic">Pool separado das perícias</span>
              </div>
            )}
            <SkillBlock
              items={c.savingThrows || []}
              attributes={c.attributes}
              editMode={editMode}
              charLevel={c.level}
              charId={c.id}
              isPlayer={isPlayer}
              pool={{
                availableTrainings: c.availableSavingTrainings ?? 0,
                availableMastery: c.availableSavingMastery ?? 0,
              }}
              onAdd={(st) => addSavingThrow(c.id, { ...st, trained: false, mastery: false })}
              onRemove={(id) => removeSavingThrow(c.id, id)}
              onRoll={(name, val, linkedId, trained, mastery, ext) => handleSkillRoll(name, val, linkedId, trained, mastery, ext)}
              getBonus={getItemRollBonus}
              getOmniSkillBonus={getOmniSkillBonus}
              onUpdate={(stId, updates) => {
                const prev = (c.savingThrows || []).find(s => s.id === stId);
                if (!prev) return;
                const next = { ...prev, ...updates };
                // Pool SEPARADO de TR: contabiliza somente quando T/M de fato mudou.
                const poolDelta = { trainings: 0, mastery: 0 };
                const wasT = !!prev.trained, wasM = !!prev.mastery;
                const isT = !!next.trained, isM = !!next.mastery;
                if (wasT !== isT) poolDelta.trainings += wasT ? 1 : -1; // marcar consome (-1), desmarcar devolve (+1)
                if (wasM !== isM) poolDelta.mastery   += wasM ? 1 : -1;
                const curT = c.availableSavingTrainings ?? 0;
                const curM = c.availableSavingMastery ?? 0;
                if (poolDelta.trainings < 0 && curT <= 0) return;
                if (poolDelta.mastery   < 0 && curM <= 0) return;
                const newSTs = (c.savingThrows || []).map(s => s.id === stId ? next : s);
                updateCharacter(c.id, {
                  savingThrows: newSTs,
                  availableSavingTrainings: Math.max(0, curT + poolDelta.trainings),
                  availableSavingMastery:   Math.max(0, curM + poolDelta.mastery),
                });
              }}
            />
          </Section>

          <Section icon={<Star className="h-4 w-4" />} title="Passivas">
            <PassiveBlock
              charId={c.id}
              passives={c.passives}
              editMode={editMode}
              onAdd={(p) => addPassive(c.id, p)}
              onRemove={(id) => removePassive(c.id, id)}
              charLevel={c.level}
              onSubmitProposal={isPlayer ? (p) => {
                submitPassiveProposal(c.id, c.name, p);
                addLog('spell', `📜 ${c.name} enviou a passiva "${p.name}" para análise do Mestre.`);
              } : undefined}
            />
            <OmniVinculadosList
              charId={c.id}
              charName={c.name}
              filtroCategoria="passiva"
              hideEmpty
            />
          </Section>

          {(c.omniAtivos ?? []).some((a) => a.categoria === 'talento') && (
            <Section icon={<Star className="h-4 w-4" />} title="Talentos">
              <OmniVinculadosList
                charId={c.id}
                charName={c.name}
                filtroCategoria="talento"
                hideEmpty
              />
              <AcoesAtivasSection charId={c.id} incluirCategorias={['talento']} />
            </Section>
          )}

          {(c.omniAtivos ?? []).some((a) => a.categoria === 'aura') && (
            <Section icon={<Sparkles className="h-4 w-4" />} title="Auras">
              <OmniVinculadosList
                charId={c.id}
                charName={c.name}
                filtroCategoria="aura"
                hideEmpty
              />
              <AcoesAtivasSection charId={c.id} incluirCategorias={['aura']} />
            </Section>
          )}

          {c.characterClass === 'Feiticeiro' && !c.isGrimorioCreature && (
            <Section icon={<Sparkles className="h-4 w-4" />} title="Habilidades de Especialização">
              <SpecAbilitiesPanel character={c} editMode={editMode} />

            </Section>
          )}

          {/* Feitiços - hide for Não-Feiticeiro */}
          {(c.characterClass !== 'Não-Feiticeiro' || (c.omniAtivos ?? []).some(a => a.categoria === 'feitico')) && (
            <Section icon={<Zap className="h-4 w-4" />} title="Feitiços">
              <SpellBlock
                spells={c.spells}
                passivesCount={(c.passives || []).length}
                editMode={editMode}
                onAdd={(s) => {
                  // If spell has same id as existing one → edit; otherwise add new
                  const exists = c.spells.some(sp => sp.id === s.id);
                  if (exists) updateSpell(c.id, s);
                  else addSpell(c.id, s);
                }}
                onRemove={(id) => removeSpell(c.id, id)}
                onUse={handleUseSpell}
                charLevel={c.level}
                isGolpeador={c.specialization === 'Golpeador'}
                hasEnergiaReversa={c.hasEnergiaReversa}
                maxSpells={maxSpells}
                availableTags={availableTags}
                cooldowns={c.cooldowns}
                isMaster={!isPlayer}
                hasTecnicaMaxima={(c.chosenAuraAptitudes || []).includes('special-tecnica-maxima')}
                hasTecnicaReversa={(c.chosenAuraAptitudes || []).includes('special-reversao-de-tecnica')}
                onSubmitProposal={isPlayer ? (s) => {
                  submitSpellProposal(c.id, c.name, s);
                  addLog('spell', `📜 ${c.name} enviou o feitiço "${s.name}" para análise do Mestre.`);
                } : undefined}
              />
              <OmniVinculadosList
                charId={c.id}
                charName={c.name}
                filtroCategoria="feitico"
                hideEmpty
                onUsar={(entidade) => executarAcaoItem({ entidade })}
              />
              <AcoesAtivasSection charId={c.id} incluirCategorias={['feitico']} />
            </Section>
          )}

          {pendingSpell && (
            <SpellApplyDialog
              spell={pendingSpell}
              sourceCharId={c.id}
              areaMode={pendingSpellAreaMode}
              initialTargetIds={pendingSpellAreaTargets ?? undefined}
              onClose={() => {
                // Limpa o template de área temporário, se houver (a menos que
                // o feitiço tenha Área Persistente — nesse caso o dialog/feitiço
                // anexa o bloco `persistent` antes de fechar).
                if (pendingSpellAreaTemplateId && !pendingSpell?.persistentArea?.enabled) {
                  import('@/stores/useMapStore').then(({ useMapStore }) => {
                    useMapStore.getState().removeTemplate(pendingSpellAreaTemplateId);
                  });
                }
                setPendingSpell(null);
                setPendingSpellAreaTargets(null);
                setPendingSpellAreaMode(false);
                setPendingSpellAreaTemplateId(null);
              }}
            />
          )}

          <Section icon={<AlertTriangle className="h-4 w-4" />} title="Condições">
            <div className="space-y-1">
              {(c.activeConditions || []).length === 0 && !showAddCondition && (
                <p className="text-sm text-muted-foreground italic">Nenhuma condição ativa.</p>
              )}
              {(c.activeConditions || []).map((cd) => {
                const condDef = ALL_CONDITIONS.find(def => def.id === cd.conditionId);
                const dur = cd.remainingTurns === -1 && cd.remainingRounds === -1 ? '∞'
                  : cd.remainingTurns > 0 ? `${cd.remainingTurns} turnos`
                  : `${cd.remainingRounds} rodadas`;
                return (
                  <div key={cd.id} className="rounded-lg bg-hp/10 border border-hp/20 px-2 py-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-hp">{cd.icon} {cd.name} <span className="text-xs text-muted-foreground">({dur})</span></span>
                      {cd.conditionId === 'caido' ? (
                        <button
                          type="button"
                          onClick={() => levantar(cd.id)}
                          disabled={!canStandFromProne}
                          title={canStandFromProne ? 'Gasta a ação de movimento para se levantar; não exige TR.' : 'Disponível no próprio turno, uma vez por turno.'}
                          className="rounded border border-primary/40 px-2 py-0.5 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Levantar · Movimento
                        </button>
                      ) : (
                        <button onClick={() => removeCondition(c.id, cd.id)} className="text-destructive/60 hover:text-destructive"><X className="h-3 w-3" /></button>
                      )}
                    </div>
                    {condDef && <p className="text-xs text-muted-foreground mt-0.5">{condDef.description}</p>}
                    {cd.sourceCharName && <p className="text-xs text-muted-foreground">Causado por: {cd.sourceCharName}</p>}
                  </div>
                );
              })}
              <button onClick={() => setShowAddCondition(!showAddCondition)} className="flex items-center gap-1 text-sm text-hp hover:text-hp/80">
                <Plus className="h-3 w-3" /> Adicionar condição
              </button>
              {showAddCondition && (
                <div className="flex gap-1 flex-wrap items-end rounded-lg border border-hp/20 p-2">
                  <div className="space-y-0.5 flex-1 min-w-[120px]">
                    <label className="text-xs text-muted-foreground">Condição</label>
                    <select value={manualCondId} onChange={(e) => setManualCondId(e.target.value)} className="h-7 w-full rounded border border-input bg-background px-1 text-xs text-foreground">
                      {ALL_CONDITIONS.map((cnd) => (
                        <option key={cnd.id} value={cnd.id}>{cnd.icon} {cnd.name} ({cnd.category})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-xs text-muted-foreground">Turnos</label>
                    <input type="text" inputMode="numeric" value={manualCondTurns || ''} onChange={(e) => setManualCondTurns(parseInt(e.target.value) || 0)} className="h-7 w-10 rounded border border-input bg-background px-1 text-xs text-foreground" />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-xs text-muted-foreground">Rodadas</label>
                    <input type="text" inputMode="numeric" value={manualCondRounds || ''} onChange={(e) => setManualCondRounds(parseInt(e.target.value) || 0)} className="h-7 w-10 rounded border border-input bg-background px-1 text-xs text-foreground" />
                  </div>
                  <button onClick={() => {
                    const cnd = ALL_CONDITIONS.find(c2 => c2.id === manualCondId);
                    if (!cnd) return;
                    addCondition(c.id, {
                      id: crypto.randomUUID(),
                      conditionId: cnd.id,
                      name: cnd.name,
                      icon: cnd.icon,
                      remainingTurns: manualCondTurns > 0 ? manualCondTurns : -1,
                      remainingRounds: manualCondRounds > 0 ? manualCondRounds : -1,
                    });
                    addLog('system', `⚠️ ${c.name} recebeu condição: ${cnd.icon} ${cnd.name}`);
                    setShowAddCondition(false);
                  }} className="h-7 rounded bg-hp/20 px-2 text-xs text-hp">Aplicar</button>
                  <button onClick={() => setShowAddCondition(false)} className="h-7 rounded bg-secondary px-2 text-xs text-secondary-foreground">✕</button>
                </div>
              )}
              <OmniVinculadosList
                charId={c.id}
                charName={c.name}
                filtroCategoria="condicao"
                hideEmpty
              />
            </div>
          </Section>

          <Section icon={<ScrollText className="h-4 w-4" />} title="Votos">
            <div className="space-y-2">
              {editMode ? (
                <textarea
                  value={c.votos || ''}
                  onChange={(e) => updateCharacter(c.id, { votos: e.target.value })}
                  placeholder="Anotações livres sobre os votos do personagem..."
                  className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground resize-y"
                />
              ) : (
                c.votos && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {c.votos}
                  </p>
                )
              )}
              <OmniVinculadosList
                charId={c.id}
                charName={c.name}
                filtroCategoria="voto"
              />
            </div>
          </Section>

          <Section icon={<Gem className="h-4 w-4" />} title="Acessórios">
            <AccessorySlotsSection
              character={c}
              items={items}
              accessorySlots={accessorySlots}
              onUpdateSlots={(slots) => updateCharacter(c.id, { accessorySlots: slots })}
              omniInventory={Object.values(inventoryItems).filter((i) => i.ownerId === c.id)}
              onEquipOmni={equipOmni}
              onUnequipOmni={unequipOmni}
              onShowDetails={(t) => setItemDetails(t)}
              resolverEntidadeOmniAtual={resolverEntidadeOmniAtual}
              onUseOmni={(inv) => executarAcaoItem({ entidade: inv.entity, instance: inv })}
            />
          </Section>

          <Section icon={<Backpack className="h-4 w-4" />} title="Inventário">
            {legacyGeneralItems.length === 0 && ownedOmniInventoryInstances.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum item no inventário.</p>
            ) : (
              <div className="space-y-1">
                {legacyGeneralItems.map((item) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      // Se o item legado tem espelho Omni, mostre detalhes ricos do Omni.
                      const omniMirror = omniByName.get(item.name.trim().toLowerCase());
                      if (omniMirror) {
                        setItemDetails({ kind: 'omni', entity: omniMirror });
                      } else {
                        setItemDetails({ kind: 'legacy', item });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        (e.currentTarget as HTMLDivElement).click();
                      }
                    }}
                    className="rounded-lg bg-secondary/50 px-2 py-1 text-sm text-foreground cursor-pointer hover:bg-secondary/70 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                    title="Ver detalhes"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{item.name}</span>
                      <span className="text-muted-foreground text-xs">
                        ({item.slots} slot{item.slots === 1 ? '' : 's'}) x{item.quantity || 1}
                      </span>
                      {omniByName.has(item.name.trim().toLowerCase()) && omniByName.get(item.name.trim().toLowerCase())?.categoria !== 'arma' && (
                        <div className="ml-auto flex items-center gap-1.5">
                          <ActionCostBadge actionId={omniByName.get(item.name.trim().toLowerCase())?.combatData?.actionCost} />
                          {(() => {
                            const cd = normalizarCombatData(omniByName.get(item.name.trim().toLowerCase())!.combatData)!;
                            const ativos = cd.effectsActive ?? [];
                            if (ativos.length === 0) return null;
                            const first = ativos[0];
                            const rt = first.type === 'ADICIONAR' ? 'heal' : first.type === 'MODIFICADOR' ? 'modifier' : 'damage';
                            const cls = rt === 'heal'
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30'
                              : rt === 'modifier'
                                ? 'bg-primary/20 border-primary/40 text-primary hover:bg-primary/30'
                                : 'bg-destructive/20 border-destructive/40 text-destructive hover:bg-destructive/30';
                            const label = ativos.length > 1
                              ? `Usar (${ativos.length})`
                              : rt === 'heal' ? 'Curar' : rt === 'modifier' ? 'Aplicar' : 'Atacar';
                            const titulo = ativos.length > 1
                              ? `Aplicar ${ativos.length} efeitos em sequência (${item.name})`
                              : rt === 'heal' ? `Curar com ${item.name}` : rt === 'modifier' ? `Aplicar efeito de ${item.name}` : `Atacar com ${item.name}`;
                            return (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAttackWithItem(item.name); }}
                                className={`flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-colors ${cls}`}
                                title={titulo}
                              >
                                <Sword className="h-3 w-3" /> {label}
                              </button>
                            );
                          })()}
                        </div>
                      )}
                      {item.isFood && (
                        <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-neon-yellow">
                          🍽️ Comida
                        </span>
                      )}
                      {item.isFood && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            useItemStore.getState().spendItem(item.id);
                            playClickSound();
                          }}
                          className="flex items-center gap-1 rounded bg-neon-yellow/20 border border-neon-yellow/30 px-2 py-0.5 text-xs font-medium text-neon-yellow hover:bg-neon-yellow/30 transition-colors"
                          title="Consumir 1 unidade"
                        >
                          🍴 Consumir
                        </button>
                      )}
                      <SoltarItemButton charId={c.id} itemId={item.id} legado />
                      {!isPlayer && editMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = (item.assignedTo || []).filter((id) => id !== c.id);
                            useItemStore.getState().updateItem(item.id, { assignedTo: next });
                            addLog('system', `🗑️ "${item.name}" removido do inventário de ${c.name}.`);
                            playClickSound();
                          }}
                          className="ml-auto flex items-center gap-1 rounded border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/25 transition-colors"
                          title={`Remover "${item.name}" do inventário de ${c.name}`}
                        >
                          <Trash2 className="h-3 w-3" /> Remover
                        </button>
                      )}
                    </div>
                    {(() => {
                      const ent = omniByName.get(item.name.trim().toLowerCase());
                      const cd = ent ? normalizarCombatData(ent.combatData) : null;
                      if (!cd || cd.effects.length === 0) return null;
                      return <OmniItemDescription effects={cd.effects} variante="inline" />;
                    })()}
                    {item.isFood && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(item.hungerRestore ?? 0) > 0 && (
                          <span className="rounded-full bg-neon-yellow/15 border border-neon-yellow/30 px-1.5 py-0.5 text-xs text-neon-yellow">
                            🍞 +{item.hungerRestore}
                          </span>
                        )}
                        {(item.hpRestore ?? 0) > 0 && (
                          <span className="rounded-full bg-hp/15 border border-hp/30 px-1.5 py-0.5 text-xs text-hp">
                            ❤️ +{item.hpRestore}
                          </span>
                        )}
                        {(item.peRestore ?? 0) > 0 && (
                          <span className="rounded-full bg-pe/15 border border-pe/30 px-1.5 py-0.5 text-xs text-pe">
                            💠 +{item.peRestore}
                          </span>
                        )}
                        {(item.pvtRestore ?? 0) > 0 && (
                          <span className="rounded-full bg-shield/15 border border-shield/30 px-1.5 py-0.5 text-xs text-shield">
                            🛡️ +{item.pvtRestore}
                          </span>
                        )}
                      </div>
                    )}
                    {item.description && (
                      <p className="text-muted-foreground text-sm mt-0.5 break-all">{item.description}</p>
                    )}
                  </div>
                ))}

                {ownedOmniInventoryInstances
                  .filter((inv) => !inv.isEquipped)
                  .map((inv) => {
                  const slotType = (inv.entity.slotType ?? 'nenhum') as ItemSlotType;
                  const isEquippable = slotType !== 'nenhum';
                  const cd = normalizarCombatData(inv.entity.combatData);
                  const categoriaOmni = inv.entity.categoria;
                  // Armas e itens usam Equipar/Atacar; só feitiços, talentos, passivas, auras e condições vinculam.
                  const isVinculavel = categoriaOmni && categoriaOmni !== 'item' && categoriaOmni !== 'arma';
                  const intermediarioVinculado = (c.invocacoesConhecidas ?? []).some(modelo => modelo.intermediario?.itemInventarioId === inv.instanceId && podeUsarVersaoAprovada({ estado: modelo.aprovacaoMestre, versaoAtual: modelo.versaoModelo, versaoAprovada: modelo.versaoAprovada }));
                  const vinculoExistente = (c.omniAtivos ?? []).find(
                    (a) => a.instanceId === inv.instanceId,
                  );

                  // Tenta encontrar o primeiro slot livre para o tipo do item.
                  const findFreeSlotName = (): string | null => {
                    if (slotType === 'colar') {
                      const occupied = ownedOmniInventoryInstances.some(
                        (i) => i.isEquipped && i.equippedSlot === 'colar',
                      );
                      return occupied ? null : 'colar';
                    }
                    if (slotType === 'anel') {
                      for (let i = 0; i < 4; i++) {
                        const name = `anel:${i}`;
                        const taken = ownedOmniInventoryInstances.some(
                          (it) => it.isEquipped && it.equippedSlot === name,
                        );
                        if (!taken) return name;
                      }
                      return null;
                    }
                    if (slotType === 'pulseira') {
                      for (let i = 0; i < 2; i++) {
                        const name = `pulseira:${i}`;
                        const taken = ownedOmniInventoryInstances.some(
                          (it) => it.isEquipped && it.equippedSlot === name,
                        );
                        if (!taken) return name;
                      }
                      return null;
                    }
                    return null;
                  };

                  return (
                    <div
                      key={inv.instanceId}
                      role="button"
                      tabIndex={0}
                      onClick={() => setItemDetails({
                        kind: 'omni',
                        entity: resolverEntidadeOmniAtual(inv),
                        isEquipped: inv.isEquipped,
                        equippedSlot: inv.equippedSlot,
                      })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          (e.currentTarget as HTMLDivElement).click();
                        }
                      }}
                      className="rounded-lg bg-secondary/50 px-2 py-1 text-sm text-foreground cursor-pointer hover:bg-secondary/70 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                      title="Ver detalhes"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <OmniItemImagem entidade={inv.entity} />
                        <span>{inv.entity.nome}</span>
                        {isEquippable && (
                          <span className="rounded-full border border-primary/30 bg-primary/15 px-1.5 py-0.5 text-xs text-primary">
                            {ITEM_SLOT_LABELS[slotType]}
                          </span>
                        )}
                        <span className={inv.quebrado ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'}>{inv.quebrado ? 'Quebrado' : inv.emMaos ? 'Em mãos' : 'Na mochila'}</span>
                        {intermediarioVinculado && <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-300" title="Este item ocupa meio espaço de inventário.">Intermediário · 0,5 espaço</span>}
                        {canManageThisCharacter && categoriaOmni === 'item' && <button type="button" onClick={e => { e.stopPropagation(); useInventoryStore.getState().definirEmMaos(inv.instanceId, !inv.emMaos); }} className="rounded border px-2 py-0.5 text-xs">{inv.emMaos ? 'Guardar' : 'Pegar'}</button>}
                        {inv.usosTotais !== undefined ? (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                useInventoryStore.getState().recargaInstancia(inv.instanceId);
                                addLog('system', `🔄 "${inv.entity.nome}" recarregado (${inv.usosTotais} usos).`);
                                playClickSound();
                              }}
                              title={`Cargas restantes — clique para recarregar (${inv.usosTotais} máx)`}
                              className={cn(
                                'flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-semibold transition-colors',
                                (inv.usosRestantes ?? 0) === 0
                                  ? 'border-destructive/50 bg-destructive/15 text-destructive hover:bg-destructive/25'
                                  : (inv.usosRestantes ?? 0) <= Math.ceil((inv.usosTotais ?? 1) / 3)
                                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                                    : 'border-sky-500/50 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25',
                              )}
                            >
                              ⚡ {inv.usosRestantes ?? 0}/{inv.usosTotais}
                            </button>
                            <span className="text-xs text-muted-foreground">
                              (recarga: {inv.entity.usos?.recarga ?? 'manual'})
                            </span>
                          </>
                        ) : (() => {
                          const todosEfeitos = [
                            ...(cd?.effectsActive ?? []),
                            ...(cd?.effectsPassive ?? []),
                            ...(cd?.effects ?? []),
                          ];
                          const usaUsos = todosEfeitos.some((e) => {
                            const f = (e.formula || '').toLowerCase();
                            const r = (e.resourcePath || '').toLowerCase();
                            const cnd = (e.condition || '').toLowerCase();
                            return f.includes('usos_restantes') || f.includes('usos_totais')
                              || r.includes('usos_restantes')
                              || cnd.includes('usos_restantes') || cnd.includes('usos_totais');
                          });
                          if (!usaUsos) return null;
                          return (
                            <span
                              className="rounded-full border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 text-xs font-semibold text-amber-400"
                              title="Este item usa @ITEM.usos_restantes mas a aba 'Custos e Usos' não foi preenchida no Construtor — o efeito não vai consumir cargas."
                            >
                              ⚠ Sem cargas configuradas
                            </span>
                          );
                        })()}

                        {/* === Categorias não-item: substitui Equipar/Atacar por VINCULAR === */}
                        {isVinculavel ? (
                          <div className="ml-auto flex items-center gap-1.5">
                            {vinculoExistente ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  useCharacterStore.getState().desvincularOmniAtivo(c.id, vinculoExistente.id);
                                  addLog('system', `🔗 "${inv.entity.nome}" desvinculado(a) da ficha de ${c.name}.`);
                                  toast.info(`${inv.entity.nome} desvinculado(a)`, {
                                    description: `Removido das listas da ficha de ${c.name}.`,
                                  });
                                  playClickSound();
                                }}
                                className="flex items-center gap-1 rounded border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors"
                                title={`Remover "${inv.entity.nome}" das listas da ficha (continua no inventário).`}
                              >
                                🔗 Desvincular
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const ok = useCharacterStore.getState().vincularOmniAtivo(c.id, {
                                    categoria: categoriaOmni as 'feitico' | 'talento' | 'passiva' | 'aura' | 'condicao',
                                    entidadeId: inv.entity.id,
                                    instanceId: inv.instanceId,
                                  });
                                  if (ok) {
                                    addLog('system', `🔗 "${inv.entity.nome}" vinculado(a) à ficha de ${c.name}.`);
                                    toast.success(`${inv.entity.nome} vinculado(a)!`, {
                                      description: `Agora aparece na lista de ${categoriaOmni}s de ${c.name}.`,
                                    });
                                    playClickSound();
                                  }
                                }}
                                className="flex items-center gap-1 rounded border border-emerald-500/50 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                                title={`Vincular "${inv.entity.nome}" à ficha de ${c.name} (aparece na lista de ${categoriaOmni}s).`}
                              >
                                🔗 Vincular
                              </button>
                            )}
                          </div>
                        ) : categoriaOmni === 'arma' ? (
                          <EmpunharArmaButton charId={c.id} nome={inv.entity.nome} instanceId={inv.instanceId} />
                        ) : isEquippable ? (
                          <div className="ml-auto flex items-center gap-1.5">
                            {(() => {
                              const freeSlot = findFreeSlotName();
                              const disabled = !freeSlot;
                              return (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!freeSlot) return;
                                    const ok = equipOmni(inv.instanceId, freeSlot);
                                    if (ok) {
                                      addLog('system', `✨ "${inv.entity.nome}" equipado em ${freeSlot} (${c.name}).`);
                                      playClickSound();
                                      // Notificação dinâmica baseada nos recursos efetivamente alterados
                                      const recursos = listarRecursosAlterados(inv.entity);
                                      const mensagem = montarMensagemEquipar(inv.entity);
                                      toast.success(mensagem, {
                                        description: recursos.length > 0
                                          ? `${inv.entity.nome} ativado em ${c.name}.`
                                          : `${inv.entity.nome} equipado (sem bônus passivos).`,
                                      });
                                    }
                                  }}
                                  disabled={disabled}
                                  className={cn(
                                    'flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold transition-colors',
                                    disabled
                                      ? 'border-muted-foreground/30 bg-muted/20 text-muted-foreground cursor-not-allowed'
                                      : 'border-violet-500/50 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25',
                                  )}
                                  title={disabled
                                    ? `Sem slot livre de ${ITEM_SLOT_LABELS[slotType]} para equipar`
                                    : `Equipar "${inv.entity.nome}" em ${freeSlot}`}
                                >
                                  <Sword className="h-3 w-3" /> EQUIPAR
                                </button>
                              );
                            })()}
                          </div>
                        ) : cd && (cd.effectsActive?.length ?? 0) > 0 && (
                          <div className="ml-auto flex items-center gap-1.5">
                            <ActionCostBadge actionId={inv.entity.combatData?.actionCost} />
                            {(() => {
                              const ativos = cd.effectsActive ?? [];
                              const first = ativos[0];
                              const rt = first.type === 'ADICIONAR' ? 'heal' : first.type === 'MODIFICADOR' ? 'modifier' : 'damage';
                              const cls = rt === 'heal'
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30'
                                : rt === 'modifier'
                                  ? 'bg-primary/20 border-primary/40 text-primary hover:bg-primary/30'
                                  : 'bg-destructive/20 border-destructive/40 text-destructive hover:bg-destructive/30';
                              const label = ativos.length > 1
                                ? `Usar (${ativos.length})`
                                : rt === 'heal' ? 'Curar' : rt === 'modifier' ? 'Aplicar' : 'Atacar';
                              const titulo = ativos.length > 1
                                ? `Aplicar ${ativos.length} efeitos em sequência (${inv.entity.nome})`
                                : rt === 'heal' ? `Curar com ${inv.entity.nome}` : rt === 'modifier' ? `Aplicar efeito de ${inv.entity.nome}` : `Atacar com ${inv.entity.nome}`;
                              return (
                                <button
                                  onClick={(e) => { e.stopPropagation(); executarAcaoItem({ entidade: inv.entity, instance: inv }); }}
                                  className={`flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-colors ${cls}`}
                                  title={titulo}
                                >
                                  <Sword className="h-3 w-3" /> {label}
                                </button>
                              );
                            })()}
                          </div>
                        )}

                        {!isVinculavel && <SoltarItemButton charId={c.id} itemId={inv.instanceId} />}
                        {isMaster && editMode && categoriaOmni === 'item' && <button type="button" onClick={e => { e.stopPropagation(); useInventoryStore.getState().marcarQuebrado(inv.instanceId, !inv.quebrado); }} className="rounded border border-amber-500/40 px-2 py-0.5 text-xs text-amber-300">{inv.quebrado ? 'Desmarcar quebrado' : 'Marcar quebrado'}</button>}
                        {!isPlayer && editMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (inv.isEquipped) unequipOmni(inv.instanceId);
                              useInventoryStore.getState().remove(inv.instanceId);
                              addLog('system', `🗑️ "${inv.entity.nome}" removido do inventário de ${c.name}.`);
                              playClickSound();
                            }}
                            className="flex items-center gap-1 rounded border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/25 transition-colors"
                            title={`Remover "${inv.entity.nome}" do inventário de ${c.name}`}
                          >
                            <Trash2 className="h-3 w-3" /> Remover
                          </button>
                        )}
                      </div>
                      {/* Para itens equipáveis: mostra apenas efeito semântico, sem ação técnica/descrição crua */}
                      {cd && cd.effects.length > 0 && (
                        <OmniItemDescription effects={cd.effects} variante="inline" />
                      )}
                      {!isEquippable && inv.entity.descricao && (
                        <p className="text-muted-foreground text-sm mt-0.5 break-all">{inv.entity.descricao}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      </SmoothCollapse>

      {showLevelUp && (
        <LevelUpDialog character={c} onClose={() => setShowLevelUp(false)} />
      )}

      <AttributeSpendDialog
        open={showAttrSpend}
        onOpenChange={setShowAttrSpend}
        character={c}
      />

      {!isPlayer && (
        <PoolGrantDialog
          open={poolGrantOpen}
          onOpenChange={setPoolGrantOpen}
          character={c}
        />
      )}

      {showDeathPrompt && isCamActive(c) && (
        <CamDeathReactionDialog
          character={c}
          onClose={() => setShowDeathPrompt(false)}
        />
      )}

      {/* Confirmação irreversível ao vincular atributo a CaC/CD/TR */}
      {attrLockDialog}

      {/* Detalhes de itens (inventário e acessórios) */}
      <ItemDetailsDialog target={itemDetails} onClose={() => setItemDetails(null)} />
    </div>
  );
}

// === Attribute Block ===
function AttributeBlock({
  items, editMode, onAdd, onRemove, onRoll, getBonus, isAttribute, onUpdateValue,
}: {
  items: Attribute[];
  editMode: boolean;
  onAdd: (a: Attribute) => void;
  onRemove: (id: string) => void;
  onRoll: (name: string, value: number) => void;
  getBonus: (name: string) => number;
  isAttribute?: boolean;
  onUpdateValue?: (id: string, value: number) => void;
}) {
  const [newName, setNewName] = useState('');
  const [newVal, setNewVal] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    const val = newVal === '' ? 10 : parseInt(newVal);
    onAdd({ id: crypto.randomUUID(), name: newName.trim(), value: isNaN(val) ? 10 : val });
    setNewName('');
    setNewVal('');
  };

  if (items.length === 0 && !editMode) {
    return <p className="text-sm text-muted-foreground italic">Nenhum atributo.</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-1">
        {items.map((a) => {
          const mod = getAttrModifier(a.value);
          const itemBonus = getBonus(a.name);
          const totalMod = mod + itemBonus;
          const modStr = totalMod >= 0 ? `+${totalMod}` : `${totalMod}`;
          return (
            <div key={a.id} className="flex items-center gap-1 rounded-lg bg-secondary/50 px-2 py-1 text-sm">
              <button onClick={() => onRoll(a.name, a.value)} className="text-primary hover:text-primary/80 flex-shrink-0" title="Rolar d20">
                <Dice1 className="h-3 w-3" />
              </button>
              <span className="truncate flex-1 min-w-0 text-sm">{a.name}</span>
              {editMode && onUpdateValue ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={a.value}
                  onChange={(e) => onUpdateValue(a.id, parseInt(e.target.value) || 0)}
                  className="h-5 w-10 rounded border border-input bg-background px-0.5 text-center text-xs font-mono font-bold text-primary flex-shrink-0"
                />
              ) : (
                <span className="font-mono text-sm text-muted-foreground flex-shrink-0">{a.value}</span>
              )}
              <span className={cn('font-mono font-bold flex-shrink-0 w-6 text-right text-sm', totalMod >= 0 ? 'text-foreground' : 'text-hp')}>
                {modStr}
              </span>
              {editMode && (
                <button onClick={() => onRemove(a.id)} className="text-destructive/60 hover:text-destructive flex-shrink-0">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {editMode && (
        <div className="mt-1 flex gap-1">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder="Nome" className="h-7 flex-1 min-w-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground" />
          <input value={newVal} onChange={(e) => setNewVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder="Valor (ex: 14)" type="text" inputMode="numeric" className="h-7 w-20 flex-shrink-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground" />
          <button onClick={handleAdd} className="h-7 w-7 flex-shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Plus className="h-3 w-3" /></button>
        </div>
      )}
    </div>
  );
}

// === Skill Block ===
function SkillBlock({
  items, attributes, editMode, charLevel, charId, characterClass, enforceTrainingLimit, hideTraining, hideMastery, pool, onAdd, onRemove, onRoll, getBonus, getOmniSkillBonus, onUpdate, isPlayer,
}: {
  items: Attribute[];
  attributes: Attribute[];
  editMode: boolean;
  charLevel: number;
  charId: string;
  characterClass?: string;
  /** Quando true, aplica limite de treinos (Feiticeiro) e torna T/M irreversíveis. */
  enforceTrainingLimit?: boolean;
  /** Quando true, oculta os botões de Treino (T) e Maestria (M). */
  hideTraining?: boolean;
  /** Quando true, oculta apenas o botão de Maestria (M). Usado em TR. */
  hideMastery?: boolean;
  /**
   * Pool conquistado para gastar em T/M. Quando informado, marcar T exige
   * availableTrainings>0 e marcar M exige availableMastery>0. Desmarcar devolve
   * o ponto (cabe ao onUpdate externo creditar de volta).
   */
  pool?: { availableTrainings: number; availableMastery: number };
  onAdd: (a: Attribute) => void;
  onRemove: (id: string) => void;
  onRoll: (name: string, value: number, linkedAttrId?: string, trained?: boolean, mastery?: boolean, externalBonus?: number) => void;
  getBonus: (name: string) => number;
  getOmniSkillBonus?: (name: string) => number;
  onUpdate: (skillId: string, updates: Partial<Attribute>) => void;
  /** Quando true (player), oculta inputs de bônus externo. */
  isPlayer?: boolean;
}) {
  const [newName, setNewName] = useState('');
  const [newVal, setNewVal] = useState('');
  const [newLinkedAttr, setNewLinkedAttr] = useState('');
  const { request: requestAttrLock, dialog: attrLockDialog } = useAttributeLockConfirm();

  const handleAdd = () => {
    if (!newName.trim()) return;
    const val = parseInt(newVal) || 0;
    const commit = () => {
      onAdd({ id: crypto.randomUUID(), name: newName.trim(), value: val, linkedAttribute: newLinkedAttr || undefined });
      setNewName('');
      setNewVal('');
      setNewLinkedAttr('');
    };
    // Quando o bloco está no contexto de TR (pool definido) e o usuário escolheu
    // um atributo vinculado, exigimos confirmação irreversível — não há UI para
    // trocar o atributo de um TR depois que ele é criado.
    if (pool && newLinkedAttr) {
      const attr = attributes.find(a => a.id === newLinkedAttr);
      requestAttrLock({
        context: `TR — ${newName.trim()}`,
        attrName: attr?.name ?? '—',
        onConfirm: commit,
      });
      return;
    }
    commit();
  };

  if (items.length === 0 && !editMode) {
    return <p className="text-sm text-muted-foreground italic">Nenhuma perícia.</p>;
  }

  // Pool unificado de perícias (Feiticeiro): total de pontos = level + 1.
  // Custos: Treino = 1 ponto · Maestria = 2 pontos · Maestria sobre perícia já Treinada = 1 ponto (substitui o T).
  const isWizard = characterClass === 'Feiticeiro';
  const trainedCount = items.filter(i => i.trained).length;
  const masteryCount = items.filter(i => i.mastery).length;
  const maxPoints = isWizard ? charLevel + 1 : Infinity;
  // Custo gasto: cada T vale 1 e cada M vale 2 (M absorve o T anterior — não soma).
  const spentPoints = trainedCount * 1 + masteryCount * 2;
  const remainingPoints = isWizard ? Math.max(0, maxPoints - spentPoints) : Infinity;
  const trainingLimitReached = enforceTrainingLimit && remainingPoints < 1;
  const masteryLimitReached  = enforceTrainingLimit && remainingPoints < 2;
  // Pool conquistado externo (TR) mantém o gating original.
  const poolTrainEmpty = !!pool && pool.availableTrainings <= 0;
  const poolMasteryEmpty = !!pool && pool.availableMastery <= 0;

  return (
    <div>
      {enforceTrainingLimit && isWizard && (
        <div className="mb-1 text-xs text-muted-foreground font-mono">
          Pontos de perícia: <span className="text-primary font-bold">{remainingPoints}</span>/{maxPoints === Infinity ? '∞' : maxPoints}
          <span className="ml-1 text-muted-foreground/70">(T = 1 · M = 2 · M sobre T = 1)</span>
        </div>
      )}
      {pool && (
        <div className="mb-1 text-xs font-mono text-muted-foreground">
          Treinos disponíveis: <span className={pool.availableTrainings > 0 ? 'text-primary font-bold' : 'text-muted-foreground/50'}>{pool.availableTrainings}</span>
          {!hideMastery && (
            <>{' · '}Maestrias: <span className={pool.availableMastery > 0 ? 'text-pe font-bold' : 'text-muted-foreground/50'}>{pool.availableMastery}</span></>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1">
        {items.map((s) => {
          const linkedAttr = s.linkedAttribute ? attributes.find((a) => a.id === s.linkedAttribute) : null;
          const attrMod = linkedAttr ? getAttrModifier(linkedAttr.value) : 0;
          const itemBonus = getBonus(s.name);
          const omniSkillBonus = getOmniSkillBonus?.(s.name) ?? 0;
          const trainBonus = getTrainingBonus(charLevel, s.trained, s.mastery);
          const extBonus = s.externalBonus || 0;
          const totalBonus = s.value + attrMod + itemBonus + trainBonus + extBonus + omniSkillBonus;
          const modStr = totalBonus >= 0 ? `+${totalBonus}` : `${totalBonus}`;
          // Regras (apenas quando enforceTrainingLimit):
          //  - Irreversível: T/M, uma vez marcado, não desmarca.
          //  - Mutuamente exclusivos: não pode ter T e M ao mesmo tempo.
          //  - Limite (Feiticeiro): respeitar maxTrainings/maxMasteries.
          // Pool conquistado externo (TR) — gating original.
          // MESTRE em modo de edição: bypass total dos limites (pode tirar/colocar T e M livremente).
          const masterFreeEdit = !isPlayer && editMode;
          const tBlockedByPool = !masterFreeEdit && !!pool && !s.trained && poolTrainEmpty;
          const mBlockedByPool = !masterFreeEdit && !!pool && !s.mastery && poolMasteryEmpty;
          // Feiticeiro (pool unificado): bloqueia marcar quando saldo insuficiente.
          // T custa 1; M custa 2 (ou 1 se já houver T para substituir).
          const tBlockedByWizard = !masterFreeEdit && !!enforceTrainingLimit && isWizard && !s.trained && !s.mastery && remainingPoints < 1;
          const mWizardCost = s.trained ? 1 : 2;
          const mBlockedByWizard = !masterFreeEdit && !!enforceTrainingLimit && isWizard && !s.mastery && remainingPoints < mWizardCost;
          const tDisabled = tBlockedByPool || tBlockedByWizard;
          const mDisabled = mBlockedByPool || mBlockedByWizard;
          return (
            <div key={s.id} className="flex items-center gap-1 rounded-lg bg-secondary/50 px-2 py-1 text-sm">
              <button onClick={() => onRoll(s.name, s.value, s.linkedAttribute, s.trained, s.mastery, s.externalBonus)} className="text-primary hover:text-primary/80 flex-shrink-0" title="Rolar d20">
                <Dice1 className="h-3 w-3" />
              </button>
              {/* Training/Mastery checkboxes */}
              {!hideTraining && (
                <div className="flex flex-col gap-0 flex-shrink-0">
                  <button
                    onClick={() => {
                      // PLAYER: irreversível — só pode marcar quando há saldo, nunca desmarca.
                      // MESTRE: livre.
                      if (s.trained) {
                        if (isPlayer) return; // trava: jogador não desmarca
                        onUpdate(s.id, { trained: false, mastery: false });
                        return;
                      }
                      if (s.mastery) return; // Para tirar M, use o botão M.
                      if (tDisabled) return;
                      onUpdate(s.id, { trained: true, mastery: false });
                    }}
                    disabled={(tDisabled && !s.trained) || (isPlayer && s.trained)}
                    className={cn(
                      'w-4 h-4 rounded-sm border text-xs font-bold leading-none flex items-center justify-center transition-all disabled:cursor-not-allowed',
                      s.trained ? 'bg-primary/30 border-primary text-primary' : 'border-border text-muted-foreground/40 hover:border-primary/50',
                      tDisabled && !s.trained && !s.mastery && 'opacity-30'
                    )}
                    title={
                      s.trained ? 'Treinado — clique para devolver 1 ponto'
                      : s.mastery ? 'Maestria ativa — use o botão M para alterar'
                      : tBlockedByPool ? 'Sem treinos disponíveis no pool externo'
                      : tBlockedByWizard ? 'Sem pontos suficientes (T = 1 ponto)'
                      : `Treinamento (custa 1 ponto · +${getMasteryBonus(charLevel)})`
                    }
                  >
                    T
                  </button>
                  {!hideMastery && (
                  <button
                    onClick={() => {
                      // PLAYER: irreversível. MESTRE: pode alternar.
                      if (s.mastery) {
                        if (isPlayer) return;
                        onUpdate(s.id, { mastery: false, trained: false });
                        return;
                      }
                      if (mDisabled) return;
                      onUpdate(s.id, { mastery: true, trained: false });
                    }}
                    disabled={(mDisabled && !s.mastery) || (isPlayer && s.mastery)}
                    className={cn(
                      'w-4 h-4 rounded-sm border text-xs font-bold leading-none flex items-center justify-center transition-all disabled:cursor-not-allowed',
                      s.mastery ? 'bg-pe/30 border-pe text-pe' : 'border-border text-muted-foreground/40 hover:border-pe/50',
                      mDisabled && !s.trained && !s.mastery && 'opacity-30'
                    )}
                    title={
                      s.mastery ? 'Maestria — clique para devolver 2 pontos'
                      : mBlockedByPool ? 'Sem maestrias disponíveis no pool externo'
                      : mBlockedByWizard ? `Sem pontos suficientes (M custa ${mWizardCost})`
                      : s.trained
                        ? `Maestria — substitui o Treino (custa apenas 1 ponto adicional · +${2 * getMasteryBonus(charLevel)})`
                        : `Maestria (custa 2 pontos · +${2 * getMasteryBonus(charLevel)})`
                    }
                  >
                    M
                  </button>
                  )}
                </div>
              )}
              <span className="truncate flex-1 min-w-0 text-sm">{s.name}</span>
              {linkedAttr && (
                <span className="text-sm text-muted-foreground flex-shrink-0" title={`Vinculado a ${linkedAttr.name}`}>
                  ({linkedAttr.name.slice(0, 3)})
                </span>
              )}
              {editMode && (
                <input
                  type="text"
                  inputMode="numeric"
                  value={s.value}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === '' || raw === '-') { onUpdate(s.id, { value: 0 }); return; }
                    const n = parseInt(raw, 10);
                    if (!Number.isNaN(n)) onUpdate(s.id, { value: n });
                  }}
                  className="h-5 w-8 rounded border border-input bg-background px-0.5 text-center text-xs font-mono text-primary flex-shrink-0"
                  title="Bônus base (aceita negativos)"
                />
              )}
              {/* External bonus — apenas Mestre pode editar */}
              {!isPlayer ? (
                <input
                  type="text"
                  inputMode="numeric"
                  value={extBonus || ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    onUpdate(s.id, { externalBonus: raw === '' || raw === '-' ? 0 : parseInt(raw) || 0 });
                  }}
                  className="h-5 w-8 rounded border border-input bg-background px-0.5 text-center text-xs font-mono text-muted-foreground flex-shrink-0"
                  title="Bônus externo"
                  placeholder="ext"
                />
              ) : extBonus !== 0 ? (
                <span className="h-5 inline-flex items-center px-1 text-xs font-mono text-muted-foreground flex-shrink-0" title="Bônus externo (apenas Mestre edita)">
                  {extBonus >= 0 ? '+' : ''}{extBonus}
                </span>
              ) : null}
              {trainBonus > 0 && (
                <span className="text-xs text-pe flex-shrink-0" title={s.mastery ? 'Maestria' : 'Treinamento'}>+{trainBonus}</span>
              )}
              <span className={cn('font-mono font-bold flex-shrink-0 w-6 text-right text-sm', totalBonus >= 0 ? 'text-foreground' : 'text-hp')}>
                {modStr}
              </span>
              {editMode && (
                <button onClick={() => onRemove(s.id)} className="text-destructive/60 hover:text-destructive flex-shrink-0">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {editMode && (
        <div className="mt-1 space-y-1">
          <div className="flex gap-1">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder="Nome" className="h-7 flex-1 min-w-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground" />
            <input value={newVal} onChange={(e) => setNewVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} placeholder="Bônus" type="text" inputMode="numeric" className="h-7 w-14 flex-shrink-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground" />
            <select
              value={newLinkedAttr}
              onChange={(e) => setNewLinkedAttr(e.target.value)}
              className="h-7 rounded-lg border border-input bg-background px-1 text-sm text-foreground"
            >
              <option value="">Atributo...</option>
              {attributes.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <button onClick={handleAdd} className="h-7 w-7 flex-shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Plus className="h-3 w-3" /></button>
          </div>
        </div>
      )}
      {attrLockDialog}
    </div>
  );
}

// === Passive Card ===
function PassiveCard({ passive: p, editMode, onRemove, charLevel }: { passive: Passive; editMode: boolean; onRemove: (id: string) => void; charLevel: number }) {
  const [expanded, setExpanded] = useState(false);
  const passiveSpellLv = getPassiveSpellLevel(p);
  const isActive = isPassiveActive(p, charLevel);
  const rdEntries = p.bonusRdByType ? DAMAGE_TYPES.filter(t => (p.bonusRdByType![t] || 0) !== 0) : [];
  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className={cn(
        "mb-1.5 rounded-xl border bg-secondary/30 px-3 py-2 text-sm cursor-pointer transition-all duration-200 hover:bg-secondary/50",
        isActive ? "border-primary/30 hover:border-primary/50" : "border-border opacity-60"
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-primary text-base">⭐</span>
          <span className="font-bold text-foreground">{p.name}</span>
          <span className={cn(
            "text-xs rounded-full border px-1.5 py-0.5 font-extrabold tracking-wider",
            isActive ? "bg-primary/15 text-primary border-primary/40" : "bg-secondary/50 text-muted-foreground border-border"
          )} title={isActive ? `Ativa (Nível de feitiço ${passiveSpellLv})` : `Inativa — requer nível de feitiço ${passiveSpellLv}`}>
            🔮 Nv.{passiveSpellLv}
          </span>
          {!isActive && <span className="text-xs text-hp font-bold">🔒 inativa</span>}
        </div>
        {editMode && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(p.id); }} className="text-destructive/60 hover:text-destructive flex-shrink-0"><X className="h-3.5 w-3.5" /></button>
        )}
      </div>
      {p.description && (
        <p className={cn("text-muted-foreground text-sm break-words transition-all duration-300 mt-1", !expanded && "line-clamp-2")}>{p.description}</p>
      )}
      <div className="flex gap-1.5 text-xs font-medium mt-1.5 flex-wrap">
        {p.bonusHP !== 0 && <span className="rounded-full bg-hp/20 border border-hp/30 px-2 py-0.5 text-hp">HP{p.bonusHP >= 0 ? '+' : ''}{p.bonusHP}</span>}
        {p.bonusPE !== 0 && <span className="rounded-full bg-pe/20 border border-pe/30 px-2 py-0.5 text-pe">PE{p.bonusPE >= 0 ? '+' : ''}{p.bonusPE}</span>}
        {p.bonusESC !== 0 && <span className="rounded-full bg-shield/20 border border-shield/30 px-2 py-0.5 text-shield">ESC{p.bonusESC >= 0 ? '+' : ''}{p.bonusESC}</span>}
        {p.bonusCA !== 0 && <span className="rounded-full bg-primary/20 border border-primary/30 px-2 py-0.5 text-primary">CA{p.bonusCA >= 0 ? '+' : ''}{p.bonusCA}</span>}
        {p.bonusRD !== 0 && <span className="rounded-full bg-pe/15 border border-pe/30 px-2 py-0.5 text-pe" title="RD geral">🔰 RD{p.bonusRD >= 0 ? '+' : ''}{p.bonusRD}</span>}
        {p.bonusSlots !== 0 && <span className="rounded-full bg-secondary border border-border px-2 py-0.5 text-muted-foreground">Slots{p.bonusSlots >= 0 ? '+' : ''}{p.bonusSlots}</span>}
        {rdEntries.map(t => (
          <span key={t} className="rounded-full bg-pe/10 border border-pe/30 px-2 py-0.5 text-pe" title={`RD ${DAMAGE_TYPE_LABELS[t]}`}>
            🔰 {DAMAGE_TYPE_ABBR[t]}+{p.bonusRdByType![t]}
          </span>
        ))}
      </div>
    </div>
  );
}

// === Passive Block ===
function PassiveBlock({
  charId, passives, editMode, onAdd, onRemove, charLevel, onSubmitProposal,
}: {
  charId: string;
  passives: Passive[];
  editMode: boolean;
  onAdd: (p: Passive) => void;
  onRemove: (id: string) => void;
  charLevel: number;
  /** Se definido, criar passiva ENVIA para análise do Mestre em vez de aplicar direto. */
  onSubmitProposal?: (p: Passive) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ name: string; description: string; spellLevel: SpellLevel; bonusHP: number; bonusPE: number; bonusESC: number; bonusSlots: number; bonusRD: number; bonusCA: number; bonusRdByType: Partial<Record<DamageType, number>> }>({ name: '', description: '', spellLevel: '1', bonusHP: 0, bonusPE: 0, bonusESC: 0, bonusSlots: 0, bonusRD: 0, bonusCA: 0, bonusRdByType: {} });
  const [showRdPicker, setShowRdPicker] = useState(false);

  const handleAdd = () => {
    if (!form.name.trim()) return;
    const cleanRd: Partial<Record<DamageType, number>> = {};
    DAMAGE_TYPES.forEach(t => { if ((form.bonusRdByType[t] || 0) !== 0) cleanRd[t] = form.bonusRdByType[t]; });
    const newPassive: Passive = { id: crypto.randomUUID(), name: form.name, description: form.description, spellLevel: form.spellLevel, bonusHP: form.bonusHP, bonusPE: form.bonusPE, bonusESC: form.bonusESC, bonusSlots: form.bonusSlots, bonusRD: form.bonusRD, bonusCA: form.bonusCA, bonusRdByType: Object.keys(cleanRd).length > 0 ? cleanRd : undefined };
    if (onSubmitProposal) {
      onSubmitProposal(newPassive);
    } else {
      onAdd(newPassive);
    }
    setForm({ name: '', description: '', spellLevel: '1', bonusHP: 0, bonusPE: 0, bonusESC: 0, bonusSlots: 0, bonusRD: 0, bonusCA: 0, bonusRdByType: {} });
    setAdding(false);
    setShowRdPicker(false);
  };

  if (passives.length === 0 && !editMode) {
    return <p className="text-sm text-muted-foreground italic">Nenhuma passiva.</p>;
  }

  // RD geral + RD por tipo (somam-se na ficha).
  const bonusFields = [
    { key: 'bonusHP' as const, label: '❤️ HP', color: 'text-hp border-hp/30 focus:border-hp' },
    { key: 'bonusPE' as const, label: '⚡ PE', color: 'text-pe border-pe/30 focus:border-pe' },
    { key: 'bonusESC' as const, label: '🛡 ESC', color: 'text-shield border-shield/30 focus:border-shield' },
    { key: 'bonusCA' as const, label: '🛡 CA', color: 'text-primary border-primary/30 focus:border-primary' },
    { key: 'bonusSlots' as const, label: '📦 Slots', color: 'text-muted-foreground border-border' },
  ];

  return (
    <div>
      {passives.map((p) => (
        <PassiveCard key={p.id} passive={p} editMode={editMode} onRemove={onRemove} charLevel={charLevel} />
      ))}
      {editMode && !adding && (
        <button onClick={() => setAdding(true)} className="mt-1 flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 transition-all hover:bg-primary/20">
          <Plus className="h-3.5 w-3.5" /> Nova Passiva
        </button>
      )}
      {adding && (
        <div className="mt-2 space-y-3 rounded-2xl border border-primary/30 bg-gradient-to-br from-[oklch(0.16_0.04_280)] to-[oklch(0.12_0.05_300)] p-4 shadow-lg shadow-primary/10">
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-primary uppercase tracking-wider">Nova Passiva</span>
          </div>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nome da passiva"
            className="h-9 w-full rounded-xl border border-primary/30 bg-background/50 px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none transition-colors"
            autoFocus
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Descrição detalhada do efeito..."
            rows={3}
            className="w-full rounded-xl border border-primary/30 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none resize-y transition-colors"
          />
          {/* Nível de feitiço da passiva */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">🔮 Nível de feitiço</label>
            <select
              value={form.spellLevel}
              onChange={(e) => setForm({ ...form, spellLevel: e.target.value as SpellLevel })}
              className="h-8 w-32 rounded-lg border border-primary/30 bg-background/50 px-2 text-center text-sm font-mono font-bold text-primary focus:border-primary focus:outline-none"
            >
              {SPELL_LEVELS.map(lv => (
                <option key={lv} value={lv}>{lv}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground italic">
              {isPassiveActive({ ...form, id: '', bonusRD: 0 } as Passive, charLevel) ? '✅ ativa agora' : `⚠️ requer mais nível de jogador`}
            </span>
          </div>
          <div className="space-y-2 rounded-xl border border-pe/20 bg-pe/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-pe">🔰 RD</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.bonusRD || ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setForm({ ...form, bonusRD: raw === '' || raw === '-' ? 0 : parseInt(raw) || 0 });
                  }}
                  placeholder="0"
                  className="h-8 w-20 rounded-lg border border-pe/30 bg-background/60 px-2 text-center text-sm font-mono font-bold text-pe focus:border-pe focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowRdPicker(!showRdPicker)}
                className="text-xs font-medium text-pe hover:text-pe/80 transition-colors"
              >
                RD por tipo {showRdPicker ? '▲' : '▼'}
              </button>
            </div>
            {showRdPicker && (
              <div className="grid grid-cols-3 gap-1.5">
                {DAMAGE_TYPES.map((t) => (
                  <div key={t} className="space-y-0.5">
                    <label className="text-xs font-bold text-pe uppercase" title={DAMAGE_TYPE_LABELS[t]}>{DAMAGE_TYPE_ABBR[t]}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.bonusRdByType[t] || ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setForm({
                          ...form,
                          bonusRdByType: {
                            ...form.bonusRdByType,
                            [t]: raw === '' || raw === '-' ? 0 : parseInt(raw) || 0,
                          },
                        });
                      }}
                      placeholder="0"
                      className="h-7 w-full rounded-lg border border-pe/30 bg-background/60 px-1 text-center text-xs font-mono font-bold text-pe focus:border-pe focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {bonusFields.map(({ key, label, color }) => (
              <div key={key} className="space-y-1">
                <label className={cn("text-xs font-medium", color.split(' ')[0])}>{label}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form[key] || ''}
                  onChange={(e) => { const raw = e.target.value; setForm({ ...form, [key]: raw === '' || raw === '-' ? 0 : parseInt(raw) || 0 }); }}
                  className={cn("h-8 w-full rounded-lg border bg-background/50 px-2 text-center text-sm font-mono font-bold focus:outline-none transition-colors", color)}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdd} className="h-9 flex-1 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20">
              {onSubmitProposal ? '📨 Enviar para análise do Mestre' : '✨ Criar Passiva'}
            </button>
            <button onClick={() => setAdding(false)} className="h-9 rounded-xl bg-secondary px-4 text-sm text-secondary-foreground hover:bg-secondary/80 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// === Spell Card ===
function SpellCard({ spell: s, editMode, onRemove, onUse, onEdit, cooldown = 0 }: { spell: Spell; editMode: boolean; onRemove: (id: string) => void; onUse: (s: Spell) => void; onEdit?: (s: Spell) => void; cooldown?: number }) {
  const [expanded, setExpanded] = useState(false);
  const typeLabel = s.spellType === 'heal' ? '💚 Cura' : s.spellType === 'buff' ? '🔮 Buff' : s.spellType === 'condition' ? '⚠️ Condição' : '⚔️ Dano';
  const actionLabels: Record<string, string> = { bonus: 'AB', action: 'AC', reaction: 'RÇ', full: 'Completa', rapida: 'AR', movimento: 'MV', free: 'LV' };
  const actionLabel = actionLabels[s.actionType] || 'AC';
  const dmgTypeLabel = s.damageType ? DAMAGE_TYPE_ABBR[s.damageType] : '';
  const levelLabel = s.spellLevel || '1';
  const rangeLabel = s.range || '';
  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="mb-1.5 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm cursor-pointer transition-all duration-200 hover:bg-secondary/50"
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="font-bold text-foreground">{s.name}</span>
          <span className="ml-1 text-xs rounded bg-primary/20 text-primary px-1 py-0.5 font-mono">Nv.{levelLabel}</span>
          {s.requiresConcentration && (
            <span className="ml-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary" title="Este feitiço ocupa um slot de concentração enquanto ativo">
              Concentração
            </span>
          )}
          {s.targetMode === 'single_atk' && (
            <span className="ml-1 text-xs rounded-full bg-primary/15 text-primary border border-primary/40 px-1.5 py-0.5 font-extrabold tracking-wider" title="Alvo Único (Ataque)">AUA</span>
          )}
          {s.targetMode === 'single_tr' && (
            <span className="ml-1 text-xs rounded-full bg-neon-yellow/15 text-neon-yellow border border-neon-yellow/40 px-1.5 py-0.5 font-extrabold tracking-wider" title={`TR Alvo Único — ${s.saveAttr || 'DES'}`}>TRU{s.saveAttr ? `:${s.saveAttr}` : ''}</span>
          )}
          {s.targetMode === 'area_tr' && (
            <span className="ml-1 text-xs rounded-full bg-hp/15 text-hp border border-hp/40 px-1.5 py-0.5 font-extrabold tracking-wider" title={`TR Área — ${s.saveAttr || 'DES'}`}>TRA{s.saveAttr ? `:${s.saveAttr}` : ''}</span>
          )}
          <span className="ml-2 text-muted-foreground text-sm">
            PE:{s.costPE} | {s.damageDice ? `${s.damageDice}+${s.damageBonus}` : '—'} | {typeLabel} | {actionLabel}
            {dmgTypeLabel && ` | ${dmgTypeLabel}`}
            {rangeLabel && ` | ${rangeLabel}`}
            {s.durationRounds > 0 && ` | ${s.durationRounds}rd`}
            {s.bonusDC && s.bonusDC > 0 && ` | CD+${s.bonusDC}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {cooldown > 0 && (
            <span className="rounded-md bg-hp/20 border border-hp/40 px-1.5 py-0.5 text-xs font-bold text-hp" title="Em recarga (Técnica Máxima)">
              ⏳ Recarga: {cooldown}t
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); if (cooldown <= 0) onUse(s); }}
            disabled={cooldown > 0}
            title={cooldown > 0 ? `Em recarga: faltam ${cooldown} turno(s)` : 'Usar feitiço'}
            className={cn(
              "rounded-lg border px-2 py-0.5 transition-colors font-medium text-sm",
              cooldown > 0
                ? "bg-muted/40 border-muted text-muted-foreground cursor-not-allowed opacity-60"
                : "bg-primary/20 border-primary/40 text-primary hover:bg-primary/30",
            )}
          >
            Usar
          </button>
          <Zap className="h-3.5 w-3.5 text-primary" />
          {editMode && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit?.(s); }} 
                className="text-primary/60 hover:text-primary ml-1 flex-shrink-0 flex items-center gap-0.5 text-xs font-bold"
              >
                ✏️ Editar
              </button>
              <button onClick={(e) => { e.stopPropagation(); onRemove(s.id); }} className="text-destructive/60 hover:text-destructive ml-1 flex-shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
      {/* Buff info */}
      {s.buffs && s.buffs.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {s.buffs.map((b, i) => {
            const desc = b.type === 'ca' ? `CA+${b.value}`
              : b.type === 'hit' ? `Acerto+${b.value}`
              : b.type === 'extraDice' ? `+${b.extraDiceCount}d${b.extraDiceSides}`
              : `${b.targetName}+${b.value}`;
            return (
              <span key={i} className="rounded-full bg-pe/10 border border-pe/20 px-1.5 py-0.5 text-xs text-pe">
                🔮 {desc} ({b.durationTurns}t)
              </span>
            );
          })}
        </div>
      )}
      {/* Condition info */}
      {s.conditions && s.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {s.conditions.map((sc, i) => {
            const cond = ALL_CONDITIONS.find(c => c.id === sc.conditionId);
            if (!cond) return null;
            const dur = sc.durationTurns > 0 ? `${sc.durationTurns}t` : `${sc.durationRounds}rd`;
            return (
              <span key={i} className="rounded-full bg-hp/10 border border-hp/20 px-1.5 py-0.5 text-xs text-hp">
                {cond.icon} {cond.name} ({dur})
              </span>
            );
          })}
        </div>
      )}
      {s.description && (
        <div className={cn(
          "text-muted-foreground text-sm break-all transition-all duration-300 overflow-hidden",
          expanded ? "mt-1 max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}>
          {s.description}
        </div>
      )}
    </div>
  );
}

function SpellBlock({
  spells, passivesCount = 0, editMode, onAdd, onRemove, onUse, charLevel = 1, isGolpeador = false, hasEnergiaReversa = false, maxSpells = 99, availableTags = [], cooldowns = {}, isMaster = false, hasTecnicaMaxima = false, hasTecnicaReversa = false, onSubmitProposal,
}: {
  spells: Spell[];
  passivesCount?: number;
  editMode: boolean;
  onAdd: (s: Spell) => void;
  onRemove: (id: string) => void;
  onUse: (s: Spell) => void;
  charLevel?: number;
  isGolpeador?: boolean;
  hasEnergiaReversa?: boolean;
  maxSpells?: number;
  availableTags?: { label: string; discountPE: number }[];
  cooldowns?: Record<string, number>;
  isMaster?: boolean;
  hasTecnicaMaxima?: boolean;
  hasTecnicaReversa?: boolean;
  onSubmitProposal?: (spell: Spell) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingSpell, setEditingSpell] = useState<Spell | null>(null);
  const [showAssistant, setShowAssistant] = useState(false);
  const [showGuide, setShowGuide] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<Spell>>({
    name: '', description: '', costPE: 0, damageDice: '', damageBonus: 0,
    spellType: 'damage', actionType: 'action', durationRounds: 0, range: '1,5m',
    targetMode: 'single_atk', spellLevel: '1',
    buffs: [], conditions: [], saveAttr: 'DES'
  });

  const [buffs, setBuffs] = useState<SpellBuff[]>([]);
  const [spellConditions, setSpellConditions] = useState<SpellCondition[]>([]);
  const [addingBuff, setAddingBuff] = useState(false);
  const [buffForm, setBuffForm] = useState<SpellBuff>({ type: 'ca', value: 0, durationTurns: 1 });
  const [addingCondition, setAddingCondition] = useState(false);
  const [condForm, setCondForm] = useState<SpellCondition>({ conditionId: ALL_CONDITIONS[0].id, durationTurns: 0, durationRounds: 1 });

  const handleAdd = () => {
    if (!form.name) return;
    const id = editingSpell?.id || crypto.randomUUID();
    onAdd({ ...form, id, buffs, conditions: spellConditions } as Spell);
    setAdding(false);
    setEditingSpell(null);
    setBuffs([]);
    setSpellConditions([]);
    setForm({
      name: '', description: '', costPE: 0, damageDice: '', damageBonus: 0,
      spellType: 'damage', actionType: 'action', durationRounds: 0, range: '1,5m',
      targetMode: 'single_atk', spellLevel: '1',
      buffs: [], conditions: [], saveAttr: 'DES'
    });
  };

  const handleAddBuff = () => {
    setBuffs([...buffs, { ...buffForm }]);
    setBuffForm({ type: 'ca', value: 0, durationTurns: 1 });
    setAddingBuff(false);
  };

  const totalSpells = spells.length;
  const isLocked = totalSpells >= maxSpells;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Capacidade: {totalSpells} / {maxSpells}
        </span>
        {!isLocked ? (
          <div className="flex gap-2">
            <button onClick={() => setShowAssistant(true)} className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 animate-pulse" title="Aprender novo feitiço (assistente guiado)">
              <Plus className="h-3 w-3" /> Aprender (Assistente)
            </button>
            {editMode && (
              <button onClick={() => { setAdding(true); setEditingSpell(null); }} className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80" title="Criar feitiço manualmente">
                <Plus className="h-3 w-3" /> Manual
              </button>
            )}
          </div>
        ) : (
          <span className="text-xs font-bold text-hp flex items-center gap-1">
            🔒 Limite atingido
          </span>
        )}
      </div>

      <div className="space-y-1">
        {spells.map((s) => (
          <SpellCard 
            key={s.id} 
            spell={s} 
            editMode={editMode} 
            onRemove={onRemove} 
            onUse={onUse}
            cooldown={cooldowns[s.id] ?? 0}
            onEdit={(spell) => {
              setEditingSpell(spell);
              setShowAssistant(true);
            }}
          />
        ))}
        {spells.length === 0 && !adding && !showAssistant && (
          <p className="text-sm text-muted-foreground italic">Nenhum feitiço aprendido.</p>
        )}
      </div>

      {showAssistant && (
        <SpellCreationAssistant
          onAdd={(s) => {
            onAdd(s);
            setShowAssistant(false);
            setEditingSpell(null);
          }}
          onCancel={() => {
            setShowAssistant(false);
            setEditingSpell(null);
          }}
          charLevel={charLevel}
          currentSpellCount={totalSpells}
          maxSpells={maxSpells}
          initialSpell={editingSpell || undefined}
          isGolpeador={isGolpeador}
          hasEnergiaReversa={hasEnergiaReversa}
          availableTags={availableTags}
          isMaster={isMaster}
          hasTecnicaMaxima={hasTecnicaMaxima}
          hasTecnicaReversa={hasTecnicaReversa}
          onSubmitProposal={onSubmitProposal}
        />
      )}
      {adding && (
        <div className="mt-1 space-y-1 rounded-xl border border-primary/30 p-2 text-sm">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome" className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição" className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground" />
          <div className="flex gap-1 flex-wrap">
            <div className="flex-1 min-w-[70px] space-y-0.5">
              <label className="text-sm text-muted-foreground flex items-center gap-1">
                Nível
                <button
                  type="button"
                  onClick={() => setShowGuide(form.spellLevel ?? null)}
                  className="text-primary hover:text-primary/80 transition-colors"
                  title="Guia de criação para este nível"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </label>
              <select value={form.spellLevel} onChange={(e) => setForm({ ...form, spellLevel: e.target.value as SpellLevel })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground">
                {SPELL_LEVELS.map((lv) => (
                  <option key={lv} value={lv}>{lv}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[80px] space-y-0.5">
              <label className="text-sm text-muted-foreground">Tipo</label>
              <select value={form.spellType} onChange={(e) => setForm({ ...form, spellType: e.target.value as any })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground">
                <option value="damage">⚔️ Dano</option>
                <option value="heal">💚 Cura</option>
                <option value="buff">✨ Buff</option>
                <option value="debuff">💀 Debuff</option>
                <option value="condition">⚠️ Foco Condições</option>
              </select>
            </div>
            <div className="flex-1 min-w-[80px] space-y-0.5">
              <label className="text-sm text-muted-foreground">Ação</label>
              <select value={form.actionType} onChange={(e) => setForm({ ...form, actionType: e.target.value as Spell['actionType'] })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground">
                <option value="action">AC (Comum)</option>
                <option value="bonus">AB (Bônus)</option>
                <option value="rapida">AR (Rápida)</option>
                <option value="reaction">RÇ (Reação)</option>
                <option value="movimento">MV (Movimento)</option>
                <option value="free">LV (Livre)</option>
                <option value="full">Completa</option>
              </select>
            </div>
            <div className="flex-1 min-w-[90px] space-y-0.5">
              <label className="text-sm text-muted-foreground">Modo Alvo</label>
              <select value={form.targetMode} onChange={(e) => setForm({ ...form, targetMode: e.target.value as SpellTargetMode })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground">
                {SPELL_TARGET_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            {(form.spellType === 'damage' || form.spellType === 'condition') && (
              <div className="flex-1 min-w-[90px] space-y-0.5">
                <label className="text-sm text-muted-foreground">Tipo Dano</label>
                <select value={form.damageType} onChange={(e) => setForm({ ...form, damageType: e.target.value as DamageType })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground">
                  <option value="">Nenhum</option>
                  {DAMAGE_TYPES.map((t) => (
                    <option key={t} value={t}>{DAMAGE_TYPE_ABBR[t]} — {DAMAGE_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex-1 min-w-[60px] space-y-0.5">
              <label className="text-sm text-muted-foreground">Custo PE</label>
              <input type="text" inputMode="numeric" value={form.costPE || ''} onChange={(e) => { const raw = e.target.value; setForm({ ...form, costPE: raw === '' ? 0 : parseInt(raw) || 0 }); }} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground" />
            </div>
            <div className="flex-1 min-w-[60px] space-y-0.5">
              <label className="text-sm text-muted-foreground">Duração (rd)</label>
              <input type="text" inputMode="numeric" value={form.durationRounds || ''} onChange={(e) => { const raw = e.target.value; setForm({ ...form, durationRounds: raw === '' ? 0 : parseInt(raw) || 0 }); }} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground" />
            </div>
            <div className="flex-1 min-w-[80px] space-y-0.5">
              <label className="text-sm text-muted-foreground">Alcance</label>
              <select value={form.range} onChange={(e) => setForm({ ...form, range: e.target.value, customRange: '' } as any)} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground">
                {SPELL_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[70px] space-y-0.5">
              <label className="text-sm text-muted-foreground">Personalizado</label>
              <input value={(form as any).customRange || ''} onChange={(e) => setForm({ ...form, customRange: e.target.value } as any)} placeholder="ex: 15m" className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground" />
            </div>
            {(form.targetMode === 'single_tr' || form.targetMode === 'area_tr') && (
              <>
                <div className="flex-1 min-w-[60px] space-y-0.5">
                  <label className="text-sm text-muted-foreground">Bônus CD</label>
                  <input type="text" inputMode="numeric" value={form.bonusDC || ''} onChange={(e) => { const raw = e.target.value; setForm({ ...form, bonusDC: raw === '' ? 0 : parseInt(raw) || 0 }); }} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground" />
                </div>
                <div className="flex-1 min-w-[80px] space-y-0.5">
                  <label className="text-sm text-muted-foreground">Atrib. TR</label>
                  <select value={form.saveAttr} onChange={(e) => setForm({ ...form, saveAttr: e.target.value as SaveAttr })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground">
                    {SAVE_ATTRS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </>
            )}
            {form.spellType !== 'buff' && (form.spellType as string) !== 'debuff' && (
              <>
                <div className="flex-1 min-w-[60px] space-y-0.5">
                  <label className="text-sm text-muted-foreground">Dados</label>
                  <input value={form.damageDice} onChange={(e) => setForm({ ...form, damageDice: e.target.value })} placeholder="3d6" className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground" />
                </div>
                <div className="flex-1 min-w-[60px] space-y-0.5">
                  <label className="text-sm text-muted-foreground">Bônus</label>
                  <input type="text" inputMode="numeric" value={form.damageBonus || ''} onChange={(e) => { const raw = e.target.value; setForm({ ...form, damageBonus: raw === '' ? 0 : parseInt(raw) || 0 }); }} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground" />
                </div>
              </>
            )}
          </div>

          {/* Buff section - only for buff/debuff types */}
          {(form.spellType === 'buff' || (form.spellType as string) === 'debuff') && (
          <div className="space-y-1 border-t border-border pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{(form.spellType as string) === 'debuff' ? '💀 Debuffs' : '✨ Buffs'} ({buffs.length})</span>
              <button onClick={() => setAddingBuff(true)} className="text-xs text-primary hover:text-primary/80">+ {(form.spellType as string) === 'debuff' ? 'Debuff' : 'Buff'}</button>
            </div>
            {buffs.map((b, i) => {
              const desc = b.type === 'ca' ? `CA+${b.value}`
                : b.type === 'hit' ? `Acerto+${b.value}`
                : b.type === 'extraDice' ? `+${b.extraDiceCount}d${b.extraDiceSides}`
                : `${b.targetName}+${b.value}`;
              return (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <span className={(form.spellType as string) === 'debuff' ? 'text-hp' : 'text-pe'}>{(form.spellType as string) === 'debuff' ? '💀' : '✨'} {desc} ({b.durationTurns}rd)</span>
                  <button onClick={() => setBuffs(buffs.filter((_, j) => j !== i))} className="text-destructive/60 hover:text-destructive"><X className="h-3 w-3" /></button>
                </div>
              );
            })}
            {addingBuff && (
              <div className="flex gap-1 flex-wrap items-end">
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Tipo</label>
                  <select value={buffForm.type} onChange={(e) => setBuffForm({ ...buffForm, type: e.target.value as SpellBuff['type'] })} className="h-7 rounded border border-input bg-background px-1 text-xs text-foreground">
                    <option value="ca">CA</option>
                    <option value="hit">Acerto</option>
                    <option value="skill">Perícia</option>
                    <option value="attribute">Atributo</option>
                    <option value="extraDice">Dados extras</option>
                  </select>
                </div>
                {(buffForm.type === 'skill' || buffForm.type === 'attribute') && (
                  <div className="space-y-0.5">
                    <label className="text-xs text-muted-foreground">Nome</label>
                    <input value={buffForm.targetName || ''} onChange={(e) => setBuffForm({ ...buffForm, targetName: e.target.value })} placeholder="Nome" className="h-7 w-20 rounded border border-input bg-background px-1 text-xs text-foreground" />
                  </div>
                )}
                {buffForm.type !== 'extraDice' ? (
                  <div className="space-y-0.5">
                    <label className="text-xs text-muted-foreground">Valor</label>
                    <input type="text" inputMode="numeric" value={buffForm.value || ''} onChange={(e) => setBuffForm({ ...buffForm, value: parseInt(e.target.value) || 0 })} className="h-7 w-12 rounded border border-input bg-background px-1 text-xs text-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-0.5">
                      <label className="text-xs text-muted-foreground">Qtd</label>
                      <input type="text" inputMode="numeric" value={buffForm.extraDiceCount || ''} onChange={(e) => setBuffForm({ ...buffForm, extraDiceCount: parseInt(e.target.value) || 0 })} className="h-7 w-10 rounded border border-input bg-background px-1 text-xs text-foreground" />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-xs text-muted-foreground">Lados</label>
                      <input type="text" inputMode="numeric" value={buffForm.extraDiceSides || ''} onChange={(e) => setBuffForm({ ...buffForm, extraDiceSides: parseInt(e.target.value) || 0 })} className="h-7 w-10 rounded border border-input bg-background px-1 text-xs text-foreground" />
                    </div>
                  </>
                )}
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Rodadas</label>
                  <input type="text" inputMode="numeric" value={buffForm.durationTurns || ''} onChange={(e) => setBuffForm({ ...buffForm, durationTurns: parseInt(e.target.value) || 1 })} className="h-7 w-10 rounded border border-input bg-background px-1 text-xs text-foreground" />
                </div>
                <button onClick={handleAddBuff} className="h-7 rounded bg-pe/20 px-2 text-xs text-pe">OK</button>
                <button onClick={() => setAddingBuff(false)} className="h-7 rounded bg-secondary px-2 text-xs text-secondary-foreground">✕</button>
              </div>
            )}
          </div>
          )}

          {/* Conditions section - for damage, debuff, condition types */}
          {(form.spellType === 'damage' || (form.spellType as string) === 'debuff' || form.spellType === 'condition') && (
          <div className="space-y-1 border-t border-border pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Condições ({spellConditions.length})</span>
              <button onClick={() => setAddingCondition(true)} className="text-xs text-hp hover:text-hp/80">+ Condição</button>
            </div>
            {spellConditions.map((sc, i) => {
              const cond = ALL_CONDITIONS.find(c => c.id === sc.conditionId);
              if (!cond) return null;
              const dur = sc.durationTurns > 0 ? `${sc.durationTurns}t` : `${sc.durationRounds}rd`;
              return (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <span className="text-hp">{cond.icon} {cond.name} ({dur})</span>
                  <button onClick={() => setSpellConditions(spellConditions.filter((_, j) => j !== i))} className="text-destructive/60 hover:text-destructive"><X className="h-3 w-3" /></button>
                </div>
              );
            })}
            {addingCondition && (
              <div className="flex gap-1 flex-wrap items-end">
                <div className="space-y-0.5 flex-1 min-w-[120px]">
                  <label className="text-xs text-muted-foreground">Condição</label>
                  <select value={condForm.conditionId} onChange={(e) => setCondForm({ ...condForm, conditionId: e.target.value })} className="h-7 w-full rounded border border-input bg-background px-1 text-xs text-foreground">
                    {ALL_CONDITIONS.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name} ({c.category})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Rodadas</label>
                  <input type="text" inputMode="numeric" value={condForm.durationRounds || ''} onChange={(e) => setCondForm({ ...condForm, durationRounds: parseInt(e.target.value) || 0 })} className="h-7 w-10 rounded border border-input bg-background px-1 text-xs text-foreground" />
                </div>
                <div className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">Rodadas</label>
                  <input type="text" inputMode="numeric" value={condForm.durationRounds || ''} onChange={(e) => setCondForm({ ...condForm, durationRounds: parseInt(e.target.value) || 0 })} className="h-7 w-10 rounded border border-input bg-background px-1 text-xs text-foreground" />
                </div>
                <button onClick={() => { setSpellConditions([...spellConditions, { ...condForm }]); setCondForm({ conditionId: ALL_CONDITIONS[0].id, durationTurns: 0, durationRounds: 1 }); setAddingCondition(false); }} className="h-7 rounded bg-hp/20 px-2 text-xs text-hp">OK</button>
                <button onClick={() => setAddingCondition(false)} className="h-7 rounded bg-secondary px-2 text-xs text-secondary-foreground">✕</button>
              </div>
            )}
          </div>
          )}

          <div className="flex gap-1">
            <button onClick={handleAdd} className="h-8 rounded-lg bg-primary px-3 text-sm text-primary-foreground">Salvar</button>
            <button onClick={() => { setAdding(false); setBuffs([]); setSpellConditions([]); }} className="h-8 rounded-lg bg-secondary px-3 text-sm text-secondary-foreground">Cancelar</button>
          </div>
        </div>
      )}

      {showGuide && (
        <SpellLevelGuide level={showGuide as any} onClose={() => setShowGuide(null)} />
      )}
    </div>
  );
}

// === Accessory Slots Section ===
function AccessorySlotsSection({
  character, items, accessorySlots, onUpdateSlots,
  omniInventory, onEquipOmni, onUnequipOmni,
  onShowDetails, resolverEntidadeOmniAtual, onUseOmni,
}: {
  character: Character;
  items: import('@/types').Item[];
  accessorySlots: AccessorySlots;
  onUpdateSlots: (slots: AccessorySlots) => void;
  omniInventory: InventoryItem[];
  onEquipOmni: (instanceId: string, slotName: string) => boolean;
  onUnequipOmni: (instanceId: string) => void;
  onShowDetails: (target: ItemDetailsTarget) => void;
  resolverEntidadeOmniAtual: (inv: InventoryItem) => InventoryItem['entity'];
  /** Dispara o Script Ativo do item equipado. Recebe a instância do inventário. */
  onUseOmni: (inv: InventoryItem) => void;
}) {
  const assignedAccessoryItems = items.filter(
    (i) => i.assignedTo.includes(character.id) && i.slotType && i.slotType !== 'nenhum'
  );

  const getItemById = (id: string | null) => id ? items.find((i) => i.id === id) : null;

  const availableForSlot = (slotType: ItemSlotType) =>
    assignedAccessoryItems.filter((i) => i.slotType === slotType && !isItemInAnySlot(i.id));

  const isItemInAnySlot = (itemId: string) => {
    if (accessorySlots.colar === itemId) return true;
    if (accessorySlots.aneis.includes(itemId)) return true;
    if (accessorySlots.pulseiras.includes(itemId)) return true;
    return false;
  };

  const setSlot = (type: 'colar' | 'anel' | 'pulseira', index: number, itemId: string | null) => {
    const newSlots = { ...accessorySlots, aneis: [...accessorySlots.aneis] as AccessorySlots['aneis'], pulseiras: [...accessorySlots.pulseiras] as AccessorySlots['pulseiras'] };
    if (type === 'colar') newSlots.colar = itemId;
    else if (type === 'anel') newSlots.aneis[index] = itemId;
    else if (type === 'pulseira') newSlots.pulseiras[index] = itemId;
    onUpdateSlots(newSlots);
  };

  // ===== Omni-Engine integration =====
  const slotKey = (type: 'colar' | 'anel' | 'pulseira', index: number) =>
    type === 'colar' ? 'colar' : `${type}:${index}`;

  // Inventário Omni filtrado por slotType compatível.
  const omniAvailableForSlot = (st: ItemSlotType) =>
    omniInventory.filter((inv) => (inv.entity.slotType ?? 'nenhum') === st && !inv.isEquipped);

  const omniEquippedInSlot = (slotName: string) =>
    omniInventory.find((inv) => inv.isEquipped && inv.equippedSlot === slotName);

  const renderSlot = (label: string, type: 'colar' | 'anel' | 'pulseira', index: number, currentId: string | null) => {
    const item = getItemById(currentId);
    const slotName = slotKey(type, index);
    const omniEquipped = omniEquippedInSlot(slotName);
    const available = availableForSlot(type === 'colar' ? 'colar' : type === 'anel' ? 'anel' : 'pulseira');
    const omniAvailable = omniAvailableForSlot(
      type === 'colar' ? 'colar' : type === 'anel' ? 'anel' : 'pulseira',
    );
    const isActive = !!item || !!omniEquipped;

    const handleSlotClick = () => {
      if (omniEquipped) {
        onShowDetails({
          kind: 'omni',
          entity: resolverEntidadeOmniAtual(omniEquipped),
          isEquipped: true,
          equippedSlot: omniEquipped.equippedSlot,
        });
      } else if (item) {
        onShowDetails({ kind: 'legacy', item });
      }
    };

    return (
      <div
        key={`${type}-${index}`}
        role={isActive ? 'button' : undefined}
        tabIndex={isActive ? 0 : undefined}
        onClick={isActive ? handleSlotClick : undefined}
        onKeyDown={isActive ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSlotClick();
          }
        } : undefined}
        title={isActive ? 'Ver detalhes' : undefined}
        className={cn(
          'rounded-lg border px-2 py-1.5 text-sm transition-all',
          omniEquipped
            ? 'border-violet-500/60 bg-violet-500/10 shadow-[0_0_12px_-2px_rgba(124,58,237,0.55)] ring-1 ring-violet-500/40'
            : isActive ? 'border-primary/40 bg-primary/10' : 'border-border bg-secondary/30',
          isActive && 'cursor-pointer hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary/40',
        )}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
          {isActive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (omniEquipped) onUnequipOmni(omniEquipped.instanceId);
                else setSlot(type, index, null);
              }}
              className="text-destructive/60 hover:text-destructive"
              title="Remover do slot"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {item ? (
          <div className="mt-0.5">
            <span className="text-foreground font-medium text-sm">{item!.name}</span>
            <div className="flex flex-wrap gap-0.5 mt-0.5">
              {item!.bonusCA !== 0 && <span className="text-xs text-primary">CA+{item!.bonusCA}</span>}
              {item!.bonusHP !== 0 && <span className="text-xs text-hp">HP+{item!.bonusHP}</span>}
              {item!.bonusPE !== 0 && <span className="text-xs text-pe">PE+{item!.bonusPE}</span>}
              {item!.bonusRD !== 0 && <span className="text-xs">RD+{item!.bonusRD}</span>}
            </div>
          </div>
        ) : omniEquipped ? (
          <div className="mt-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-foreground font-medium text-sm">
                ◇ {omniEquipped.entity.nome}
              </span>
              <SoltarItemButton charId={character.id} itemId={omniEquipped.instanceId} />
                  <ContadoresEquipamento charId={character.id} entidade={resolverEntidadeOmniAtual(omniEquipped)} />
              {omniEquipped.usosTotais !== undefined && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    useInventoryStore.getState().recargaInstancia(omniEquipped.instanceId);
                  }}
                  title={`Cargas restantes — clique para recarregar (${omniEquipped.usosTotais} máx)`}
                  className={cn(
                    'flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-xs font-semibold transition-colors',
                    (omniEquipped.usosRestantes ?? 0) === 0
                      ? 'border-destructive/50 bg-destructive/15 text-destructive hover:bg-destructive/25'
                      : (omniEquipped.usosRestantes ?? 0) <= Math.ceil((omniEquipped.usosTotais ?? 1) / 3)
                        ? 'border-amber-500/50 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                        : 'border-sky-500/50 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25',
                  )}
                >
                  ⚡ {omniEquipped.usosRestantes ?? 0}/{omniEquipped.usosTotais}
                </button>
              )}
              {(() => {
                const cdEq = normalizarCombatData(omniEquipped.entity.combatData);
                const ativos = cdEq?.effectsActive ?? [];
                if (ativos.length === 0) return null;
                const first = ativos[0];
                const rt = first.type === 'ADICIONAR' ? 'heal' : first.type === 'MODIFICADOR' ? 'modifier' : 'damage';
                const cls = rt === 'heal'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30'
                  : rt === 'modifier'
                    ? 'bg-primary/20 border-primary/40 text-primary hover:bg-primary/30'
                    : 'bg-destructive/20 border-destructive/40 text-destructive hover:bg-destructive/30';
                const label = ativos.length > 1
                  ? `Usar (${ativos.length})`
                  : rt === 'heal' ? 'Curar' : rt === 'modifier' ? 'Aplicar' : 'Atacar';
                return (
                  <button
                    onClick={(e) => { e.stopPropagation(); onUseOmni(omniEquipped); }}
                    className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold transition-colors ${cls}`}
                    title={`${label} com ${omniEquipped.entity.nome}`}
                  >
                    <Sword className="h-2.5 w-2.5" /> {label.toUpperCase()}
                  </button>
                );
              })()}
            </div>
            <div className="flex flex-wrap gap-0.5 mt-0.5">
              {(['ca','hp','pe','rd','esc','slots'] as const).map((k) => {
                const v = omniEquipped.entity.bonusEquipado?.[k] ?? 0;
                const f = omniEquipped.entity.bonusEquipadoFormula?.[k];
                if (!v && !f) return null;
                return (
                  <span key={k} className="text-xs text-primary">
                    {k.toUpperCase()}{v >= 0 ? '+' : ''}{v}
                    {f ? <span className="text-sky-400 ml-0.5" title={f}>·ƒ</span> : null}
                  </span>
                );
              })}
            </div>
          </div>
        ) : omniAvailable.length > 0 ? (
          <select
            className="mt-0.5 h-7 w-full rounded border border-input bg-background px-1 text-xs text-foreground"
            value=""
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              const v = e.target.value;
              if (!v) return;
              if (v.startsWith('omni:')) {
                onEquipOmni(v.slice(5), slotName);
              }
            }}
          >
            <option value="">Vazio</option>
            {omniAvailable.map((inv) => (
              <option key={inv.instanceId} value={`omni:${inv.instanceId}`}>
                ◇ {inv.entity.nome}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted-foreground italic mt-0.5 block">Vazio</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-1">
        {renderSlot('Colar', 'colar', 0, accessorySlots.colar)}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {accessorySlots.aneis.map((id, i) => renderSlot(`Anel ${i + 1}`, 'anel', i, id))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {accessorySlots.pulseiras.map((id, i) => renderSlot(`Pulseira ${i + 1}`, 'pulseira', i, id))}
      </div>
      {assignedAccessoryItems.length === 0 && omniInventory.length === 0 && (
        <p className="text-sm text-muted-foreground italic">Nenhum item de acessório vinculado. Crie itens com tipo de slot (Colar, Anel, Pulseira) — pelo módulo de Itens ou pelo Omni-Engine — e vincule a este personagem.</p>
      )}
    </div>
  );
}

/* ─── Perfil Amaldiçoado: Aptidões numéricas (AU/CL/BAR/DOM/ER) ─── */
function CursedAptitudesSection({
  character: c,
  onAptitudeClick,
}: {
  character: Character;
  onAptitudeClick?: (key: AptitudeKey) => void;
}) {
  const apts = { ...createDefaultCursedAptitudes(), ...(c.cursedAptitudes ?? {}) };
  const pendingPts = c.pendingAptitudePoints ?? 0;
  return (
    <div className="space-y-2">
      {pendingPts > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-primary/50 bg-primary/15 px-2 py-1.5 text-xs animate-pulse">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-bold text-primary">
            {pendingPts} ponto(s) de aptidão pendente(s) — distribua no painel de Pendências do Wizard de Nível.
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {APTITUDE_KEYS.map((k: AptitudeKey) => {
          const label = APTITUDE_LABELS[k];
          const v = apts[k] ?? 0;
          const clickable = (k === 'AU' || k === 'CL' || k === 'DOM' || k === 'BAR' || k === 'ER') && !!onAptitudeClick;
          const catalogLabel = k === 'AU'
            ? 'catálogo de Aptidões de Aura'
            : k === 'CL'
              ? 'catálogo de Aptidões de Controle e Leitura'
              : k === 'DOM'
                ? 'catálogo de Aptidões de Domínio'
                : k === 'BAR'
                  ? 'catálogo de Aptidões de Barreira'
                  : k === 'ER'
                    ? 'catálogo de Aptidões de Energia Reversa'
              : null;
          return (
            <button
              key={k}
              type="button"
              onClick={clickable ? () => onAptitudeClick!(k) : undefined}
              disabled={!clickable}
              className={cn(
                'rounded-lg border border-border bg-secondary/30 p-2 flex flex-col items-center gap-1 transition-colors text-left',
                clickable
                  ? 'hover:bg-secondary/60 hover:border-primary/60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
                  : 'cursor-default',
              )}
              title={
                clickable && catalogLabel
                  ? `${label.full} — ${label.desc}\n\nClique para abrir o ${catalogLabel}.`
                  : `${label.full} — ${label.desc}`
              }
            >
              <div className="text-xs font-bold uppercase tracking-wider text-primary">{label.short}</div>
              <div className="font-mono text-base font-bold text-foreground">{v}/{APTITUDE_MAX}</div>
              <div className="text-xs text-muted-foreground text-center leading-tight">{label.full}</div>
              <div className="flex gap-0.5 mt-0.5">
                {Array.from({ length: APTITUDE_MAX }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1.5 w-2.5 rounded-sm',
                      i < v ? 'bg-primary' : 'bg-muted',
                    )}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// === Action Cost Badge (Omni Combat) ========================================
// Mostra um chip colorido representando o Custo de Ação de um ataque/item.
// Cores: Azul=Livre, Verde=Movimento, Âmbar=Padrão, Roxo=Bônus,
// Ciano=Reação, Vermelho=Completa, Rosa=Interrupção.
function ActionCostBadge({ actionId }: { actionId?: string }) {
  if (!actionId) return null;
  const meta = Object.values(SYSTEM_ACTIONS).find((a) => a.id === actionId);
  if (!meta) return null;
  const palette: Record<string, string> = {
    action_free:      'bg-blue-500/15 border-blue-500/40 text-blue-400',
    action_move:      'bg-emerald-500/15 border-emerald-500/40 text-emerald-400',
    action_standard:  'bg-amber-500/15 border-amber-500/40 text-amber-400',
    action_bonus:     'bg-purple-500/15 border-purple-500/40 text-purple-400',
    action_reaction:  'bg-cyan-500/15 border-cyan-500/40 text-cyan-400',
    action_full:      'bg-red-500/15 border-red-500/40 text-red-400',
    action_interrupt: 'bg-pink-500/15 border-pink-500/40 text-pink-400',
  };
  const cls = palette[actionId] ?? 'bg-muted/40 border-border text-muted-foreground';
  return (
    <span
      className={`text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}
      title={`${meta.label} · custo ${meta.cost}`}
    >
      {meta.label}
    </span>
  );
}
