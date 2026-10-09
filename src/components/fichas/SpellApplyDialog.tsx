import { abrirJanelaReacaoAtiva } from '@/lib/omni/reacoesAtivas';
import { consumeCritNegated } from '@/lib/suporteNegacao';
import { implementoMarcialBonus } from '@/lib/golpeEspecial';
import { useState, useEffect, useRef } from 'react';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';
import { useItemStore } from '@/stores/useItemStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { useReactionStore } from '@/stores/useReactionStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { X, Shield, Target, Dice6, Send } from 'lucide-react';
import { Spell, DAMAGE_TYPE_LABELS, ALL_CONDITIONS } from '@/types';
import { normalizeConditionExpiry } from '@/types/conditions';
import { rollDiceCom, rollD20Com } from '@/lib/dice';
import { cn } from '@/lib/utils';
import { getSustainedPEPerRound } from '@/lib/spellAuxiliaryTables';
import { isSpellLevelAllowed, getMaxSpellLevel } from '@/lib/spellRules';
import { getTrainingBonus } from '@/types';
import { getKeyAttrMod, computeEffectivePeCost, getDestruicaoDamageBonus, TECNICA_FUNDAMENTO_DETAILS, type TecnicaFundamento } from '@/lib/tecnicaProgression';
import { hasKokusen, getKokusenCritThreshold } from '@/lib/auraEffects';
import {
  calculateSpellDamageBonus,
  computeFundamentosModifiers,
  rerollDamageNotation,
  type FundamentoId,
  type FundamentosActivation,
  type FundamentoTier,
} from '@/lib/tecnicaFundamentos';
import { prepareCast, applyCast, applyDamageMods, type RolledDie } from '@/lib/spellCastPipeline';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { aplicarReducaoCustoFeitico } from '@/lib/omni/spellCostReduction';
import { selectOmniModifiers } from '@/lib/omni/omniBridge';
import { canStartConcentration, concentrationLimit, createActiveConcentration, getActiveConcentrationCount } from '@/lib/concentration';

interface Props {
  spell: Spell;
  sourceCharId: string;
  onClose: () => void;
  /** IDs de personagens pré-selecionados como alvo (vindos do clique no token). */
  initialTargetIds?: string[];
  /**
   * Modo Área: alvos já foram resolvidos no mapa pelo posicionamento do
   * template. Pula a tela de "selecionar alvos" e dispara o cast mesmo se
   * a lista estiver vazia (= nenhum acerto).
   */
  areaMode?: boolean;
}

type SaveResult = 'pending' | 'fail' | 'success' | 'crit_fail' | 'crit_success';

interface TargetSaveState {
  id: string;
  name: string;
  saveRoll: string;
  result: SaveResult;
}

export function SpellApplyDialog({ spell, sourceCharId, onClose, initialTargetIds, areaMode }: Props) {
  const rollDice = (n: string) => rollDiceCom(sourceCharId, n);
  const characters = useCharacterStore((s) => s.characters);
  const { applyDamage, applyHealing, applyShield, updateCharacter, addBuff, addCondition, removeSustainedBuffsFrom, triggerKokusen } = useCharacterStore();
  const items = useItemStore((s) => s.items);
  const addLog = useLogStore((s) => s.addLog);
  const isMaster = useRoleStore((s) => s.role) === 'MASTER';
  const janelaCastRef = useRef(false);
  const defesaReacaoRef = useRef<Record<string, number>>({});
  const montadoRef = useRef(true);
  useEffect(() => { montadoRef.current = true; return () => { montadoRef.current = false; }; }, []);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialTargetIds ?? []);
  const [phase, setPhase] = useState<'select' | 'sustain_confirm' | 'saves' | 'attacks' | 'done'>('select');
  const [pendingNext, setPendingNext] = useState<'saves' | 'attacks' | 'direct' | null>(null);
  const [targetSaves, setTargetSaves] = useState<TargetSaveState[]>([]);
  const [targetAttacks, setTargetAttacks] = useState<{ id: string; name: string; roll: string; result: 'pending' | 'hit' | 'miss' | 'crit_hit' }[]>([]);
  const [damageResults, setDamageResults] = useState<{ name: string; rawDmg: number; finalDmg: number; multiplier: number; saveLabel: string; conditions: string[]; diceRolls?: number[]; diceSides?: number; flatBonus?: number; isCrit?: boolean }[]>([]);
  // ===== Especialista em Técnica — Fundamentos ativáveis no cast =====
  const [fundAct, setFundAct] = useState<FundamentosActivation>({});
  // ===== Spec Pipeline (Fase 3/4) — opt-in de Conjuração Defensiva =====
  const [defensiveCastingOpt, setDefensiveCastingOpt] = useState<boolean>(false);
  // tec-sobrecarregar (Tier 2): PE extra opt-in para amplificar a CD.
  const [overchargePe, setOverchargePe] = useState<number>(0);
  // tec-potencia-concentrada (Tier 6): consome Ação de Movimento p/ +5×nível flat.
  const [potenciaConcentradaOpt, setPotenciaConcentradaOpt] = useState<boolean>(false);
  // Etapa visual de rolagem de dano: 'ready' mostra botão "Rolar Dano",
  // 'spinning' anima os dados antes de aplicar o resultado.
  const [damageRoll, setDamageRoll] = useState<null | { fn: () => void; stage: 'ready' | 'spinning' }>(null);
  const stageDamageRoll = (fn: () => void) => setDamageRoll({ fn, stage: 'ready' });
  const triggerDamageRoll = () => {
    if (!damageRoll) return;
    const fn = damageRoll.fn;
    setDamageRoll({ fn, stage: 'spinning' });
    setTimeout(() => { fn(); setDamageRoll(null); }, 900);
  };
  // Animação por-alvo da rolagem de ataque (dado girando antes do resultado).
  const [rollingAttackIds, setRollingAttackIds] = useState<Set<string>>(new Set());



  const source = characters.find((c) => c.id === sourceCharId);
  if (!source) return null;

  // Conjuração Aprimorada (Especialista em Técnica): bônus fixo por nível do feitiço.
  // Agora resolvido via `calculateSpellDamageBonus` (tabela oficial + dicionário custom).
  const isTecnica = source.characterClass === 'Feiticeiro' && source.specialization === 'Especialista em Técnica';
  const tecnicaKeyMod = isTecnica ? getKeyAttrMod(source.attributes || [], source.keyAttribute) : 0;
  const conjuracaoBonus = calculateSpellDamageBonus({
    isTecnica,
    spellLevel: spell.spellLevel,
    keyMod: tecnicaKeyMod,
    characterLevel: source.level || 1,
  });
  const caTag = conjuracaoBonus !== 0 ? ` +CA:${conjuracaoBonus}` : '';

  // ===== Fundamentos: fundamentos aprendidos pelo personagem (schema.tecnicaFundamentos) =====
  const ownedFundamentos = isTecnica ? ((source.tecnicaFundamentos ?? []) as TecnicaFundamento[]) : [];
  // Modificadores derivados do estado de ativação do painel de toggles.
  const fundOutcome = computeFundamentosModifiers({ spell, activation: fundAct, keyAttrMod: tecnicaKeyMod });

  // Threshold de re-roll do Feitiço Potente = max(mod INT, mod SAB) do conjurador.
  const potenteThreshold = (() => {
    const getMod = (name: string) => {
      const a = (source.attributes || []).find(
        (x) => x.name?.toLowerCase().startsWith(name.toLowerCase().slice(0, 3)),
      );
      return a ? Math.floor((a.value - 10) / 2) : 0;
    };
    return Math.max(getMod('Inteligência'), getMod('Sabedoria'), 0);
  })();

  /**
   * Rola os dados de dano respeitando Feitiço Potente (re-roll) e Feitiço Duplicado
   * (castCount = 2). Retorna rolls agregados (concatenados), `sides` (0 se notação
   * inválida), e total somado, para que o resto do pipeline (crítico/Destruição/
   * Encadeada/Máxima) permaneça intocado.
   */
  const rollSpellDamageDice = async (notation: string | undefined): Promise<{ rolls: number[]; sides: number; total: number; rerolled: number; casts: number }> => {
    // Aceita "XdY", "XdY+N" ou "XdY-N" — preserva o suffix em rollDice.
    const sidesMatch = notation?.match(/^\d+d(\d+)(?:[+-]\d+)?$/i);
    const sides = sidesMatch ? parseInt(sidesMatch[1], 10) : 0;
    if (!notation) return { rolls: [0], sides: 0, total: 0, rerolled: 0, casts: fundOutcome.castCount };
    const casts = Math.max(1, fundOutcome.castCount);
    const allRolls: number[] = [];
    let total = 0;
    let rerolled = 0;
    for (let i = 0; i < casts; i++) {
      if (fundOutcome.rerollLowDamage && potenteThreshold > 0) {
        const r = await rerollDamageNotation(notation, potenteThreshold);
        allRolls.push(...r.rolls);
        total += r.total;
        rerolled += r.rerolled;
      } else {
        const r = await rollDice(notation);
        allRolls.push(...r.rolls);
        total += r.total;
      }
    }
    return { rolls: allRolls, sides, total, rerolled, casts };
  };

  /**
   * Aplica `applyDamageMods` (Encadeada/Máxima/Destruição Ampla flat) aos rolls
   * brutos. Também rola dados extras de Destruição Focada/Ciclagem Maldita
   * (`plan.bonusDamageDice`) usando os mesmos `sides`. Devolve {rolls, total}
   * agregados, prontos para entrar no pipeline de crítico/dano.
   */
  const applySpecPipelineToRolls = async (
    rolls: number[],
    sides: number,
  ): Promise<{ rolls: number[]; total: number; chainExtra: number; flatBonus: number }> => {
    if (sides <= 0) {
      return { rolls, total: rolls.reduce((s, n) => s + n, 0), chainExtra: 0, flatBonus: 0 };
    }
    // 1) Bônus de dados (Destruição Focada + Ciclagem Maldita) — rolados aqui.
    const extraDiceRolled: number[] = [];
    for (let i = 0; i < castPlan.bonusDamageDice; i++) {
      const r = await rollDice(`1d${sides}`);
      extraDiceRolled.push(...r.rolls);
    }
    const allBaseRolls = [...rolls, ...extraDiceRolled];
    // 2) Encadeada/Máxima/flat de Destruição Ampla.
    const rolledDice: RolledDie[] = allBaseRolls.map((value) => ({ sides, value }));
    // Pré-rola dados extras de Explosão Encadeada (1 por dado que crit-explodiu).
    const chainCount = castPlan.hooks.explosionChain
      ? allBaseRolls.filter((v) => v === sides).length
      : 0;
    const chainExtras: number[] = [];
    for (let i = 0; i < chainCount; i++) {
      const er = await rollDice(`1d${sides}`);
      chainExtras.push(er.total);
    }
    const chainQueue = [...chainExtras];
    const out = applyDamageMods(rolledDice, castPlan, () => chainQueue.shift() ?? 0);
    return {
      rolls: allBaseRolls,
      total: out.total,
      chainExtra: out.chainExtraSum + out.maxFlatBonus,
      flatBonus: castPlan.flatDamageBonus,
    };
  };

  const toggleFund = (id: FundamentoId) => {
    setFundAct((prev) => {
      const cur = prev[id] ?? 'off';
      // Cruel e Preciso têm 2 tiers; demais apenas on/off (t1 ≡ on).
      const hasTwoTiers = id === 'Feitiço Cruel' || id === 'Feitiço Preciso';
      let next: FundamentoTier;
      if (hasTwoTiers) next = cur === 'off' ? 't1' : cur === 't1' ? 't2' : 'off';
      else next = cur === 'off' ? 't1' : 'off';
      return { ...prev, [id]: next };
    });
  };

  const needsTR = (spell.targetMode === 'single_tr' || spell.targetMode === 'area_tr') && spell.spellType !== 'buff';

  // Detecta se o feitiço realmente tem dado de dano (XdY). Buffs e condições puras não rolam dano.
  const hasDamageDice = !!spell.damageDice && /\d+\s*d\s*\d+/i.test(spell.damageDice);
  // Buff puro OU condição/dano-declarado SEM dados de dano → pula a rolagem.
  const skipDamageRoll = spell.spellType === 'buff' || !hasDamageDice;

  // Monta uma string de breakdown verboso "[3,5]=8 + 2(feitiço) + 3(CA) = 13".
  const buildDamageBreakdown = (
    rolls: number[],
    sides: number,
    diceTotal: number,
    parts: Array<{ label: string; value: number }>,
    final: number,
  ): string => {
    const segs: string[] = [];
    if (rolls.length > 0 && sides > 0) {
      segs.push(`[${rolls.join('+')}]=${diceTotal}`);
    } else {
      segs.push(`${diceTotal}`);
    }
    for (const p of parts) {
      if (!p.value) continue;
      const sign = p.value >= 0 ? '+' : '−';
      segs.push(`${sign}${Math.abs(p.value)}(${p.label})`);
    }
    return `${segs.join(' ')} = ${final}`;
  };

  // CD efetiva do lançador: base + atributo vinculado + ½ nível + passivas + itens equipados + buffs ativos + aumento + bônus do feitiço
  // Mesma lógica da CA (getEffectiveCA), mas com atributo configurável (travado uma vez definido).
  const dcLinkedAttr = source.dcLinkedAttr
    ? (source.attributes || []).find(a => a.id === source.dcLinkedAttr)
    : undefined;
  const dcAttrMod = dcLinkedAttr ? Math.floor((dcLinkedAttr.value - 10) / 2) : 0;
  const dcAttrLabel = dcLinkedAttr ? dcLinkedAttr.name.slice(0, 3).toUpperCase() : '—';
  const halfLevelSrc = Math.floor((source.level || 1) / 2);
  const passiveDC = (source.passives || []).reduce((s, p) => s + (p.bonusDC || 0), 0);
  const equippedSrc = items.filter(i => i.assignedTo.includes(source.id));
  const itemDC = equippedSrc.reduce((s, i) => s + (i.bonusDC || 0), 0);
  const buffDC = (source.activeBuffs || []).filter(b => b.type === 'dc').reduce((s, b) => s + b.value, 0);
  const cdIncrease = source.cdIncrease || 0;
  const baseDC = source.baseDC || 10;
  const spellDCBonus = spell.bonusDC || 0;
  // Bônus de CD de classe (Refino: +floor(TB/2); O Honrado: +5; Implemento Marcial).
  // Implemento Marcial do Especialista em Combate (+2 nv4 / +3 nv8 / +4 nv16)
  // é calculado dinamicamente, pois não é gravado em classCdBonus.
  const classCdBonus = (source.classCdBonus || 0) + implementoMarcialBonus(source);
  // Fundamentos Cruel (+CD) entra aqui, junto com os demais bônus de CD.
  const effectiveDC = baseDC + dcAttrMod + halfLevelSrc + passiveDC + itemDC + buffDC + cdIncrease + classCdBonus + fundOutcome.cdBonus;
  const baseTotalDC = effectiveDC + spellDCBonus;

  const toggle = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const hasCondenado = (source.activeConditions || []).some(cd => cd.conditionId === 'condenado');
  // Custo efetivo de PE: aplica Economia (-2) e O Honrado (÷2 nos Nv 1-3) automaticamente.
  const baseEffectiveCostPE = computeEffectivePeCost(source, spell);
  // ─── Família ER (Energia Reversa) ───
  // Regra: feitiços de cura reais (hasEnergiaReversa) usam PER. O custo informado
  // pelo jogador (costPE) é em PER, mas DEBITA 2 PE por 1 PER.
  const isErHealing = spell.spellType === 'heal' && source.hasEnergiaReversa;
  const erMultiplier = isErHealing ? 2 : 1;
  // ─── Técnica Máxima ───
  // Custo SECO de 25 PE — ignora Economia, O Honrado, ER e qualquer override.
  const isTecnicaMaxima = spell.spellLevel === 'Técnica Máxima';
  const TECNICA_MAXIMA_FLAT_COST = 25;
  const rawEffectiveCostPE = isTecnicaMaxima
    ? TECNICA_MAXIMA_FLAT_COST
    : baseEffectiveCostPE * erMultiplier;
  // ─── Memorização Imediata ───
  // Se este feitiço estiver marcado como preparado, custa metade (arredondado para cima).
  // A flag é removida após o cast (ver consumePreparedFlag abaixo).
  const isPreparedDiscount = !!spell.isPrepared && !isTecnicaMaxima;
  const preparedCost = isPreparedDiscount
    ? Math.ceil(rawEffectiveCostPE / 2)
    : rawEffectiveCostPE;
  // Fundamentos (Cruel/Preciso/Distante/Expansivo/Potente/Cuidadoso/Duplicado/Rápido)
  // adicionam PE extra sobre o custo já descontado (Economia/Honrado/ER/Preparado).
  // ===== Spec Cast Pipeline (Especialista em Técnica) =====
  // Plano reativo às escolhas atuais; alvos = nº de selecionados (área).
  const pipelineTargetCount = Math.max(1, selectedIds.length);
  const castPlan = prepareCast(source, spell, {
    defensiveCasting: defensiveCastingOpt,
    targetCount: pipelineTargetCount,
    overchargePe: overchargePe,
    potenciaConcentrada: potenciaConcentradaOpt,
  });
  const totalDC = baseTotalDC + castPlan.cdBonus;
  const peReduced = Math.max(0, preparedCost - castPlan.peReduction);
  // 🪄 Redutores Omni de PE de feitiços (com filtro: nível, tipo, nome…).
  const peAfterOmni = aplicarReducaoCustoFeitico(peReduced, source, spell).custoFinal;
  const effectiveCostPE = peAfterOmni + fundOutcome.extraPe + castPlan.extraPe;
  // Cooldown atual deste feitiço (0 = pronto).
  const currentCooldown = (source.cooldowns || {})[spell.id] ?? 0;

  // Bloqueio por nível: não pode lançar feitiços acima do nível permitido pelo nível do personagem.
  const spellLevelAllowed = isSpellLevelAllowed(source.level, spell.spellLevel, source.specialization);

  // Tipo de ação efetivo considerando Feitiço Rápido (converte action→bonus).
  const effectiveActionType: typeof spell.actionType =
    fundOutcome.asBonusAction && spell.actionType === 'action' ? 'bonus' : spell.actionType;

  const canCast = () => {
    const source = useCharacterStore.getState().characters.find(c => c.id === sourceCharId);
    if (!source || (source.hpCurrent ?? 1) <= 0) return false;
    if (!spellLevelAllowed) return false;
    if (!canStartConcentration(source, spell)) return false;
    if (currentCooldown > 0) return false;
    if (source.peCurrent < effectiveCostPE) return false;
    if (effectiveActionType === 'bonus' && source.bonusActionsCurrent <= 0) return false;
    if (effectiveActionType === 'action' && source.actionsCurrent <= 0) return false;
    if (effectiveActionType === 'reaction' && (source.reactionsCurrent ?? source.reactionsMax ?? 1) <= 0) return false;
    if (effectiveActionType === 'full' && (source.actionsCurrent < source.actionsMax || source.bonusActionsCurrent < source.bonusActionsMax)) return false;
    return true;
  };

  const getBlockReason = () => {
    if (!spellLevelAllowed) return `Feitiço Nv ${spell.spellLevel} bloqueado — seu personagem (Nv ${source.level}) só pode lançar até Nv ${getMaxSpellLevel(source.level, source.specialization)}`;
    if (!canStartConcentration(source, spell)) return `Sem slots de concentração (${getActiveConcentrationCount(source)}/${concentrationLimit(source)}). Encerre uma concentração ativa antes de lançar este feitiço.`;
    if (currentCooldown > 0) return `Em recarga: faltam ${currentCooldown} turno(s)`;
    if (source.peCurrent < effectiveCostPE) {
      const erHint = isErHealing ? ` — ER: ${baseEffectiveCostPE} PER × 2 = ${effectiveCostPE} PE` : '';
      const tmHint = isTecnicaMaxima ? ` — Técnica Máxima: custo seco 25 PE` : '';
      return `PE insuficiente (${source.peCurrent}/${effectiveCostPE}${hasCondenado ? ' [Condenado +1]' : ''})${erHint}${tmHint}`;
    }
    if (effectiveActionType === 'bonus' && source.bonusActionsCurrent <= 0) return fundOutcome.asBonusAction ? 'Sem Ação Bônus (Feitiço Rápido)' : 'Sem Ação Bônus';
    if (effectiveActionType === 'action' && source.actionsCurrent <= 0) return 'Sem Ação Comum';
    if (effectiveActionType === 'reaction' && (source.reactionsCurrent ?? source.reactionsMax ?? 1) <= 0) return 'Sem Reação';
    if (effectiveActionType === 'full') return 'Precisa de todas as ações (AC+AB)';
    return '';
  };


  /**
   * Computa as updates extras a aplicar no cast: registra cooldown de Técnica Máxima
   * em `cooldowns[spell.id] = 6 - floor(TB/2)`, e remove a flag `isPrepared` do
   * feitiço lançado (Memorização Imediata). Mescla com updates existentes.
   */
  const withTecnicaMaximaCooldown = (updates: Partial<typeof source>): Partial<typeof source> => {
    let next: Partial<typeof source> = updates;
    if (isPreparedDiscount) {
      next = {
        ...next,
        spells: source.spells.map((sp) => (sp.id === spell.id ? { ...sp, isPrepared: false } : sp)),
      };
    }
    if (!isTecnicaMaxima) return next;
    const tb = source.trainingBonus ?? 2;
    const cdTurns = Math.max(1, 6 - Math.floor(tb / 2));
    return {
      ...next,
      cooldowns: { ...(source.cooldowns || {}), [spell.id]: cdTurns },
    };
  };

  // Buffs nunca rolam ataque/TR — vão direto para aplicação.
  const isPureBuff = spell.spellType === 'buff';
  // Sustentado = durationRounds === -1 (sentinel "Cena"). Regra: 1 sustentado por player por vez.
  const isSustainedSpell = spell.durationRounds === -1;
  const hasConcentration = !!spell.requiresConcentration;
  // IDs de ciclo são distintos de lastSpellUsedId; um mesmo feitiço pode
  // compartilhar o ID entre concentração e sustentação sem fundir os contadores.
  const spellInstanceIdRef = useRef<string | undefined>(undefined);
  if ((isSustainedSpell || hasConcentration) && !spellInstanceIdRef.current) spellInstanceIdRef.current = crypto.randomUUID();
  const spellInstanceId = isSustainedSpell || hasConcentration ? spellInstanceIdRef.current : undefined;
  const sustainInstanceId = isSustainedSpell ? spellInstanceId : undefined;
  const concentrationInstanceId = hasConcentration ? spellInstanceId : undefined;
  const effectInstanceId = concentrationInstanceId ?? sustainInstanceId;

  const buildCastUpdates = (): Partial<typeof source> | null => {
    const current = useCharacterStore.getState().characters.find((c) => c.id === sourceCharId);
    if (!current || !canStartConcentration(current, spell)) return null;
    const updates: Partial<typeof source> = { peCurrent: current.peCurrent - effectiveCostPE };
    if (hasConcentration && concentrationInstanceId
      && !current.activeConcentrations?.some((entry) => entry.instanceId === concentrationInstanceId)) {
      updates.activeConcentrations = [
        ...(current.activeConcentrations ?? []),
        createActiveConcentration(spell, concentrationInstanceId, selectedIds),
      ];
    }
    return updates;
  };

  const logConcentrationStarted = () => {
    if (!hasConcentration) return;
    const current = useCharacterStore.getState().characters.find((c) => c.id === sourceCharId);
    addLog('spell', `🌀 ${source.name} mantém ${spell.name}; concentração ${getActiveConcentrationCount(current ?? { activeConcentrations: [] })}/${concentrationLimit(source)}.`);
  };

  /** Antes de aplicar buffs sustentados, remove os anteriores do mesmo lançador (apenas players). */
  const enforceSingleSustained = () => {
    if (isSustainedSpell && spell.buffs && spell.buffs.length > 0 && source.category === 'PLAYER') {
      removeSustainedBuffsFrom(sourceCharId);
      addLog('spell', `♾ ${source.name} encerrou o feitiço sustentado anterior (limite: 1 por player).`);
    }
  };

  /** True quando o source PLAYER já tem um buff sustentado vindo dele em qualquer alvo. */
  const hasExistingSustained = source.category === 'PLAYER' && characters.some(ch =>
    (ch.activeBuffs || []).some(b => b.isSustained && b.sourceCharId === sourceCharId)
  );
  const willConflictSustain = isSustainedSpell && spell.buffs && spell.buffs.length > 0 && hasExistingSustained;

  const proceedToSaves = () => {
    if (selectedIds.length === 0 || !canCast()) return;
    let next: 'saves' | 'attacks' | 'direct';
    if (isPureBuff) next = 'direct';
    else if (needsTR) next = 'saves';
    else if (spell.targetMode === 'single_atk') next = 'attacks';
    else next = 'direct';

    if (willConflictSustain) {
      setPendingNext(next);
      setPhase('sustain_confirm');
      return;
    }
    runNext(next);
  };

  // 🪄 Quando o dialog é aberto com alvos pré-selecionados (vindos do
  // "armado" pela hotbar do mapa), pula a tela de seleção e dispara
  // direto a próxima fase (TR / ataque / direto).
  const autoFiredRef = useRef(false);
  useEffect(() => {
    if (autoFiredRef.current) return;
    // Em modo Área, dispara mesmo sem alvos (= sem acertos).
    if (!areaMode) {
      if (!initialTargetIds || initialTargetIds.length === 0) return;
      if (selectedIds.length === 0) return;
    }
    if (phase !== 'select') return;
    if (!canCast()) return;
    autoFiredRef.current = true;
    // Área sem nenhum alvo atingido: consome PE/ação, loga "nenhum acerto" e fecha.
    if (areaMode && selectedIds.length === 0) {
      void (async () => {
      const evento = { gatilho: 'quando_inimigo_conjurar' as const, origemId: sourceCharId };
      // A ausência de ofertas neste cliente não significa que ninguém possa
      // reagir: os inventários dos outros perfis só são consultados após a
      // sondagem remota da janela.
      const janela = spell.actionType === 'reaction'
        ? { cancelado: false }
        : await abrirJanelaReacaoAtiva(evento);
      if (!montadoRef.current) return;
      if (janela.cancelado || !canCast()) { onClose(); return; }
      const updates = buildCastUpdates();
      if (!updates || !consumeActionUpdates(updates)) { onClose(); return; }
      updateCharacter(sourceCharId, withTecnicaMaximaCooldown(updates));
      emitFundLogLines();
      applySpecPostCast();
      logConcentrationStarted();
      addLog('spell', `✨ ${source.name} lança ${spell.name} em área — nenhum alvo atingido.`);
      onClose();
      })();
      return;
    }
    let next: 'saves' | 'attacks' | 'direct';
    if (isPureBuff) next = 'direct';
    else if (needsTR) next = 'saves';
    else if (areaMode) next = 'direct';
    else next = 'attacks';
    if (willConflictSustain) {
      setPendingNext(next);
      setPhase('sustain_confirm');
    } else {
      runNext(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedIds]);


  const runNext = async (next: 'saves' | 'attacks' | 'direct') => {
    if (janelaCastRef.current) return;
    janelaCastRef.current = true;
    try {
      const evento = { gatilho: 'quando_inimigo_conjurar' as const, origemId: sourceCharId };
      // Uma reação já está resolvendo uma interrupção; ela não abre outra
      // janela de reação sobre si mesma.
      const janela = spell.actionType === 'reaction'
        ? { cancelado: false, defesaBonus: 0, testeBonus: 0 }
        : await abrirJanelaReacaoAtiva(evento);
      if (!montadoRef.current) return;
      if (janela.cancelado || !canCast()) { addLog('spell', `⛔ ${spell.name}: conjuração interrompida ou recursos indisponíveis.`); onClose(); return; }
      defesaReacaoRef.current = {};
      if (next === 'attacks') for (const id of selectedIds) {
        const eventoAtaque = { gatilho: 'quando_alvo_declarar_ataque' as const, origemId: sourceCharId, protegidoId: id };
        const defesa = spell.actionType === 'reaction'
          ? { cancelado: false, defesaBonus: 0, testeBonus: 0 }
          : await abrirJanelaReacaoAtiva(eventoAtaque);
        if (!montadoRef.current) return;
        if (defesa.cancelado || !canCast()) { addLog('spell', `⛔ ${spell.name}: ataque mágico interrompido.`); onClose(); return; }
        defesaReacaoRef.current[id] = defesa.defesaBonus;
      }

    if (next === 'direct') { handleCastDirect(); return; }
    if (next === 'saves') {
      setTargetSaves(selectedIds.map(id => {
        const target = characters.find(c => c.id === id);
        return { id, name: target?.name || '?', saveRoll: '', result: 'pending' };
      }));
      setPhase('saves');
    } else {
      setTargetAttacks(selectedIds.map(id => {
        const target = characters.find(c => c.id === id);
        return { id, name: target?.name || '?', roll: '', result: 'pending' };
      }));
      setPhase('attacks');
    }
    } finally { janelaCastRef.current = false; }
  };

  // CA efetiva do alvo: base + mod. DES + ½ nível + passivas + itens equipados + buffs ativos
  const getEffectiveCA = (targetId: string): number => {
    const t = useCharacterStore.getState().characters.find(c => c.id === targetId);
    if (!t) return 10;
    const desAttr = (t.attributes || []).find(a => a.name?.toUpperCase() === 'DES');
    const desMod = desAttr ? Math.floor((desAttr.value - 10) / 2) : 0;
    const halfLevel = Math.floor((t.level || 1) / 2);
    const passiveCA = (t.passives || []).reduce((s, p) => s + (p.bonusCA || 0), 0);
    const equipped = items.filter(i => i.assignedTo.includes(t.id));
    const itemCA = equipped.reduce((s, i) => s + (i.bonusCA || 0), 0);
    const buffCA = (t.activeBuffs || []).filter(b => b.type === 'ca').reduce((s, b) => s + b.value, 0);
    return (t.ca || 10) + desMod + halfLevel + passiveCA + itemCA + buffCA;
  };

  const updateSaveRoll = (targetId: string, value: string) => {
    setTargetSaves(prev => prev.map(ts => {
      if (ts.id !== targetId) return ts;
      const num = parseInt(value);
      let result: SaveResult = 'pending';
      if (!isNaN(num)) {
        if (num >= totalDC) result = 'success';
        else result = 'fail';
        // Natural 20 = crit success, Natural 1 = crit fail (user enters total, but we add a button)
      }
      return { ...ts, saveRoll: value, result };
    }));
  };

  const setSaveCrit = (targetId: string, critType: 'crit_success' | 'crit_fail') => {
    setTargetSaves(prev => prev.map(ts => ts.id === targetId ? { ...ts, result: critType } : ts));
  };

  // Empolgação (Lutador): incrementa +1 (cap 5) ao acertar com feitiço corpo-a-corpo.
  const bumpEmpolgacaoOnMeleeHit = (label: string) => {
    if (spell.attackType !== 'melee') return;
    if (source.specialization !== 'Lutador') return;
    const startLv = source.empolgacaoStartLevel ?? ((source.level || 1) >= 20 ? 2 : 1);
    const cur = source.empolgacaoLevel ?? startLv;
    if (cur >= 5) return;
    updateCharacter(source.id, { empolgacaoLevel: cur + 1 });
    addLog('system', `🔥 ${source.name}: ${label} (feitiço C.a.C) — Empolgação ${cur} → ${cur + 1}.`);
  };

  const updateAttackRoll = (targetId: string, value: string) => {
    setTargetAttacks(prev => prev.map(ta => {
      if (ta.id !== targetId) return ta;
      const target = characters.find(c => c.id === targetId);
      if (!target) return ta;
      const num = parseInt(value);
      let result: 'pending' | 'hit' | 'miss' | 'crit_hit' = 'pending';
      if (!isNaN(num)) {
        const targetCA = getEffectiveCA(targetId) + (defesaReacaoRef.current[targetId] ?? 0);
        if (num >= targetCA) result = 'hit';
        else result = 'miss';
      }
      if (result === 'hit' && ta.result !== 'hit' && ta.result !== 'crit_hit') {
        bumpEmpolgacaoOnMeleeHit('acerto');
      }
      return { ...ta, roll: value, result };
    }));
  };

  const setAttackCrit = (targetId: string) => {
    setTargetAttacks(prev => prev.map(ta => {
      if (ta.id !== targetId) return ta;
      if (ta.result !== 'crit_hit') bumpEmpolgacaoOnMeleeHit('acerto crítico');
      return { ...ta, result: 'crit_hit' };
    }));
  };

  const autoRollAttack = async (targetId: string) => {
    const d20 = await rollD20Com(source.id);
    const bonus = getSourceAtkBonus();
    const total = d20 + bonus;
    const targetCA = getEffectiveCA(targetId) + (defesaReacaoRef.current[targetId] ?? 0);
    const critMargin = source.critMargin || 20;
    let result: 'hit' | 'miss' | 'crit_hit' = total >= targetCA ? 'hit' : 'miss';
    if (d20 >= critMargin) result = 'crit_hit';
    if (d20 === 1) result = 'miss';

    // Fase 10 — Kokusen em feitiço CaC: escuta passiva idêntica ao ataque CaC.
    let isKokusen = false;
    if (spell.attackType === 'melee' && hasKokusen(source) && d20 !== 1) {
      const kk = getKokusenCritThreshold(source);
      if (kk && d20 >= kk.threshold && (result === 'hit' || result === 'crit_hit')) {
        isKokusen = true;
        result = 'crit_hit';
        const round = useCombatStore.getState().round ?? 1;
        const r = triggerKokusen(source.id, round);
        if (r.ok) {
          updateCharacter(source.id, { kokusenArmedDamage: true });
          addLog('system', `⚡ ${source.name}: KOKUSEN! (feitiço CaC) Consciência Absoluta ${r.newStacks} (próx. crit em ${r.threshold}+). Próximo dano: ×1.5 e ignora RD.`);
        }
      }
    }

    setTargetAttacks(prev => prev.map(ta => ta.id === targetId ? { ...ta, roll: String(total), result } : ta));
    if (result === 'hit' || result === 'crit_hit') {
      bumpEmpolgacaoOnMeleeHit(result === 'crit_hit' ? 'acerto crítico' : 'acerto');
    }
    addLog('spell', `🎲 Rolagem de ataque vs ${characters.find(c => c.id === targetId)?.name}: d20(${d20}) + ${bonus} = ${total} → ${isKokusen ? '⚡ KOKUSEN' : result === 'crit_hit' ? '💥 CRÍTICO' : result === 'hit' ? '🎯 ACERTO' : '🛡️ ERRO'}`);
  };

  const animatedRollAttack = (targetId: string) => {
    setRollingAttackIds((prev) => {
      const next = new Set(prev);
      next.add(targetId);
      return next;
    });
    void autoRollAttack(targetId).finally(() => {
      setRollingAttackIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    });
  };

  const TR_NAMES = new Set(['Astúcia', 'Fortitude', 'Integridade', 'Reflexos', 'Vontade']);


  const getTargetSaveBonus = (targetId: string): { bonus: number; attr: string } => {
    const target = characters.find(c => c.id === targetId);
    if (!target) return { bonus: 0, attr: 'DES' };
    const raw = (spell.saveAttr || 'DES') as string;
    const isTRName = TR_NAMES.has(raw);

    let attrMod = 0;
    let stTrain = 0;
    let stExtra = 0;
    let attrAbbr = raw.toUpperCase();
    let stEntry: any = undefined;

    if (isTRName) {
      // TR canônico: usa entry savingThrows pelo nome do TR
      stEntry = (target.savingThrows || []).find(s => s.name === raw);
      const linkedName = stEntry?.linkedAttribute as string | undefined;
      const linked = linkedName ? (target.attributes || []).find(a => a.name === linkedName) : undefined;
      attrMod = linked ? Math.floor((linked.value - 10) / 2) : 0;
      stTrain = stEntry ? getTrainingBonus(target.level || 1, stEntry.trained, stEntry.mastery) : 0;
      stExtra = stEntry?.value || 0;
      attrAbbr = raw; // exibido como nome do TR
    } else {
      const attr = (target.attributes || []).find(a => a.name?.toUpperCase().startsWith(attrAbbr.slice(0, 3)));
      attrMod = attr ? Math.floor((attr.value - 10) / 2) : 0;
      stEntry = (target.savingThrows || []).find(s => s.name?.toUpperCase().startsWith(attrAbbr.slice(0, 3)));
      stTrain = stEntry ? getTrainingBonus(target.level || 1, stEntry.trained, stEntry.mastery) : 0;
      stExtra = stEntry?.value || 0;
    }
    const halfLevel = Math.floor((target.level || 1) / 2);
    // tal-tecnicas-ocultamento: alvo Desprevenido sofre penalidade em TODOS os TRs
    let ocultamentoPenalty = 0;
    const sourceHasOcultamento = (source.chosenTalents ?? []).some(t => t.id === 'tal-tecnicas-ocultamento');
    if (sourceHasOcultamento) {
      const targetCondIds = (target.activeConditions || []).map(ac => (ac.conditionId || '').toLowerCase());
      const isUnaware = targetCondIds.includes('desprevenido') || targetCondIds.includes('agarrado') || targetCondIds.includes('atordoado');
      const isReflexes = attrAbbr.startsWith('DES') || attrAbbr.toLowerCase().startsWith('ref');
      if (isUnaware && !isReflexes) {
        ocultamentoPenalty = -3;
      }
    }
    // tal-guarda-infalivel: +3 em TR contra efeitos que reduzam Defesa ou imponham penalidade em TRs.
    let guardaInfalivelBonus = 0;
    const targetHasGuardaInfalivel = (target.chosenTalents ?? []).some(t => t.id === 'tal-guarda-infalivel');
    if (targetHasGuardaInfalivel) {
      const DEBUFF_COND_IDS = new Set([
        'enredado', 'caido', 'desprevenido', 'agarrado', 'paralisado',
        'exposto', 'inconsciente', 'atordoado', 'envenenado',
      ]);
      const spellAppliesDebuff = (spell.conditions ?? []).some(sc =>
        DEBUFF_COND_IDS.has((sc.conditionId || '').toLowerCase())
      );
      if (spellAppliesDebuff) guardaInfalivelBonus = 3;
    }
    const equipados = useInventoryStore.getState().listEquipped(target.id).map(item => ({ instanceId: item.instanceId, equippedSlot: item.equippedSlot, entity: item.entity }));
    const trKey = (stEntry?.name ?? '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const equipamento = selectOmniModifiers(target, equipados).trs[trKey as 'astucia' | 'fortitude' | 'integridade' | 'reflexos' | 'vontade'] ?? 0;
    return { bonus: attrMod + halfLevel + stTrain + stExtra + equipamento + ocultamentoPenalty + guardaInfalivelBonus, attr: attrAbbr };
  };

  const autoRollSave = async (targetId: string) => {
    const target = characters.find(c => c.id === targetId);
    if (!target) return;
    const d20 = await rollD20Com(target.id);
    const { bonus: stBonus, attr } = getTargetSaveBonus(targetId);
    const total = d20 + stBonus;
    let result: SaveResult = total >= totalDC ? 'success' : 'fail';
    if (d20 === 20) result = 'crit_success';
    if (d20 === 1 && !consumeCritNegated(target.id)) result = 'crit_fail';
    setTargetSaves(prev => prev.map(ts => ts.id === targetId ? { ...ts, saveRoll: String(total), result } : ts));
    addLog('spell', `🎲 TR ${attr} de ${target.name}: d20(${d20}) + ${stBonus} = ${total} vs CD ${totalDC} → ${result === 'crit_success' ? '✨ SUC.CRÍT' : result === 'success' ? '✅ Sucesso' : result === 'crit_fail' ? '💀 FAL.CRÍT' : '❌ Falha'}`, target.category === 'INIMIGO' ? `🎲 TR ${attr} de ${target.name}: teste realizado.` : source.category === 'INIMIGO' ? `🎲 TR ${attr} de ${target.name}: total ${total} → ${result === 'success' || result === 'crit_success' ? 'Sucesso' : 'Falha'}` : undefined);
  };

  // ===== Pedido de TR ao Jogador (overlay full-screen) =====
  const enqueueTest = useTestRequestStore((s) => s.enqueue);
  const allRequests = useTestRequestStore((s) => s.requests);
  const dismissTest = useTestRequestStore((s) => s.dismiss);
  const sentReqIdsRef = useRef<Map<string, string>>(new Map()); // targetId -> sourceTag

  const SAVE_ATTR_TO_TR: Record<string, string> = {
    FOR: 'Fortitude', CON: 'Fortitude',
    DES: 'Reflexos',
    INT: 'Astúcia',
    SAB: 'Vontade', PRE: 'Vontade',
  };

  const requestSaveFromPlayers = () => {
    const raw = (spell.saveAttr || 'DES') as string;
    const isTRName = TR_NAMES.has(raw);
    const trName = isTRName ? raw : (SAVE_ATTR_TO_TR[raw.toUpperCase()] || 'Vontade');
    let count = 0;
    targetSaves.forEach((ts) => {
      const target = characters.find(c => c.id === ts.id);
      if (!target) return;
      if (ts.result !== 'pending') return;
      if (sentReqIdsRef.current.has(ts.id)) return;
      const tag = `spell:${spell.id}:${ts.id}:${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
      const { bonus } = getTargetSaveBonus(ts.id);
      enqueueTest({
        charId: ts.id,
        charName: target.name,
        kind: 'save',
        testName: trName,
        dc: totalDC,
        hideDcFromPlayer: source.category === 'INIMIGO',
        note: `${source.name} lança "${spell.name}" — role TR.`,
        bonusOverride: bonus,
        bonusBreakdownOverride: `TR ${raw} (calc. pelo feitiço)`,
        sourceTag: tag,
      });
      sentReqIdsRef.current.set(ts.id, tag);
      count++;
    });
    if (count > 0) {
      addLog('spell', `📨 ${source.name}: pedido de TR ${trName} enviado para ${count} alvo(s).`);
    }
  };

  // Auto-dispara o pedido de TR assim que entramos na fase 'saves'.
  // O dono de cada token (player ou mestre) verá o overlay e rolará.
  const autoSentSavesRef = useRef(false);
  useEffect(() => {
    if (phase !== 'saves') { autoSentSavesRef.current = false; return; }
    if (autoSentSavesRef.current) return;
    if (targetSaves.length === 0) return;
    autoSentSavesRef.current = true;
    requestSaveFromPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, targetSaves.length]);

  // Quando todos os TRs foram resolvidos, aplica resultado automaticamente.
  const autoAppliedSavesRef = useRef(false);
  useEffect(() => {
    if (phase !== 'saves') { autoAppliedSavesRef.current = false; return; }
    if (autoAppliedSavesRef.current) return;
    if (targetSaves.length === 0) return;
    if (targetSaves.some(ts => ts.result === 'pending')) return;
    autoAppliedSavesRef.current = true;
    // Pequeno respiro para o jogador ler o resultado antes de aplicar.
    const t = setTimeout(() => { stageDamageRoll(handleCastWithSaves); }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, targetSaves]);

  // Ingere resultados vindos do overlay (jogador rolou).
  useEffect(() => {
    if (phase !== 'saves') return;
    const updates: { id: string; saveRoll: string; result: SaveResult }[] = [];
    sentReqIdsRef.current.forEach((tag, targetId) => {
      const req = allRequests.find(r => r.sourceTag === tag);
      if (!req || !req.result) return;
      const cur = targetSaves.find(t => t.id === targetId);
      if (!cur || cur.result !== 'pending') return;
      const total = req.result.total;
      const d20 = req.result.d20;
      let result: SaveResult = total >= totalDC ? 'success' : 'fail';
      if (d20 === 20) result = 'crit_success';
      if (d20 === 1 && !consumeCritNegated(targetId)) result = 'crit_fail';
      updates.push({ id: targetId, saveRoll: String(total), result });
      // limpa para não reprocessar
      dismissTest(req.id);
      sentReqIdsRef.current.delete(targetId);
    });
    if (updates.length > 0) {
      setTargetSaves(prev => prev.map(ts => {
        const u = updates.find(x => x.id === ts.id);
        return u ? { ...ts, saveRoll: u.saveRoll, result: u.result } : ts;
      }));
    }
  }, [allRequests, phase, totalDC, targetSaves, dismissTest]);



  // (effectiveActionType já declarado acima, antes de canCast.)

  const consumeActionUpdates = (updates: Partial<typeof source>): boolean => {
    const source = useCharacterStore.getState().characters.find(c => c.id === sourceCharId)!;
    if (effectiveActionType === 'bonus') updates.bonusActionsCurrent = source.bonusActionsCurrent - 1;
    else if (effectiveActionType === 'action') updates.actionsCurrent = source.actionsCurrent - 1;
    else if (effectiveActionType === 'reaction') {
      delete updates.reactionsCurrent;
      if (!useReactionStore.getState().consumeReaction(sourceCharId)) return false;
    }
    else if (effectiveActionType === 'full') { updates.actionsCurrent = 0; updates.bonusActionsCurrent = 0; }
    return true;
  };

  const emitFundLogLines = () => {
    fundOutcome.logLines.forEach((line) => addLog('spell', `${source.name}: ${line}`));
    // Omni-Engine: emite gatilho aoConjurarFeitico (sem aguardar — fire-and-forget).
    import('@/lib/omni/eventBus').then(({ emitirEvento }) => {
      emitirEvento('aoConjurarFeitico', {
        usuarioId: source.id,
        cena: { custoPE: effectiveCostPE, nivelFeitico: Number(spell.spellLevel ?? 0) },
        origemNome: spell.name,
        incluirPassivas: true,
      });
    });
  };

  /**
   * Aplica as mutações pós-cast da pipeline de Spec (Fase 3/4):
   *   • lastSpellUsedId (Ciclagem Maldita)
   *   • Buff de Conjuração Defensiva (+CA = nível, 1 turno) + buff irmão de RD.
   * Deve ser chamada APÓS `updateCharacter` que debita PE/ações.
   */
  const applySpecPostCast = () => {
    const { patch, buffs } = applyCast(source, spell, castPlan);
    if (Object.keys(patch).length > 0) {
      updateCharacter(source.id, patch);
    }
    for (const b of buffs) {
      addBuff(source.id, b);
    }
    if (buffs.length > 0 && castPlan.hooks.defensiveCasting) {
      const lvl = buffs[0]?.value ?? 0;
      addLog('spell', `🛡 ${source.name}: Conjuração Defensiva — Defesa +${lvl} e RD +${lvl} até o início do próximo turno.`);
    }
    castPlan.notes.forEach((n) => addLog('spell', `🌀 ${source.name}: ${n}`));
  };


  const handleCastWithAttacks = async () => {
    if (!canCast()) return;
    // Consume PE and actions
    const updates = buildCastUpdates();
    if (!updates || !consumeActionUpdates(updates)) return;
    updateCharacter(sourceCharId, withTecnicaMaximaCooldown(updates));
    emitFundLogLines();
    applySpecPostCast();
    logConcentrationStarted();
    for (const t of targetAttacks) if (t.result === 'miss') await abrirJanelaReacaoAtiva({ gatilho: 'quando_ataque_errar', origemId: sourceCharId, protegidoId: t.id });
    if (!montadoRef.current) return;

    // Extract source buffs
    const activeBuffs = source.activeBuffs || [];
    const dmgBonusFromBuffs = activeBuffs.filter(b => b.type === 'damageBonus').reduce((sum, b) => sum + b.value, 0);
    let extraDicePreCrit = 0;
    for (const b of activeBuffs.filter(b => b.type === 'extraDice')) {
      if (b.extraDiceCount && b.extraDiceSides) extraDicePreCrit += (await rollDice(`${b.extraDiceCount}d${b.extraDiceSides}`)).total;
    }
    let extraDicePostCrit = 0;
    for (const b of activeBuffs.filter(b => b.type === 'extraDiceAfter')) {
      if (b.extraDiceCount && b.extraDiceSides) extraDicePostCrit += (await rollDice(`${b.extraDiceCount}d${b.extraDiceSides}`)).total;
    }
    let dmgLevels = activeBuffs.filter(b => b.type === 'damageLevels').reduce((sum, b) => sum + b.value, 0);

    let finalDamageDice = spell.damageDice;
    if (finalDamageDice && dmgLevels > 0) {
      const match = finalDamageDice.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
      if (match) {
        let count = parseInt(match[1]);
        let sides = parseInt(match[2]);
        const suffix = match[3] ?? '';
        const tiers = [4, 6, 8, 10, 12];
        let tierIndex = tiers.indexOf(sides);
        if (tierIndex === -1) tierIndex = 0;
        while (dmgLevels > 0) {
          if (tierIndex < tiers.length - 1) {
             tierIndex++;
             sides = tiers[tierIndex];
          } else {
             count++;
          }
          dmgLevels--;
        }
        finalDamageDice = `${count}d${sides}${suffix}`;
      }
    }

    // Se TODOS os alvos erraram, pula a rolagem de dano por completo.
    const anyHit = targetAttacks.some((ta) => ta.result === 'hit' || ta.result === 'crit_hit');
    const baseRoll = anyHit
      ? await rollSpellDamageDice(finalDamageDice)
      : { rolls: [] as number[], sides: 0, total: 0, rerolled: 0, casts: fundOutcome.castCount };
    const specPipe = anyHit
      ? await applySpecPipelineToRolls(baseRoll.rolls, baseRoll.sides)
      : { rolls: [] as number[], total: 0, chainExtra: 0, flatBonus: 0 };
    const { rolls, rerolled, casts } = { rolls: specPipe.rolls, rerolled: baseRoll.rerolled, casts: baseRoll.casts };
    const total = specPipe.total;
    const destAtk = anyHit && isTecnica ? getDestruicaoDamageBonus(source.tecnicaFoco, source.level || 1, rolls.length) : { perDie: 0, fixed: 0 };
    const destBonus = destAtk.perDie + destAtk.fixed;
    const dstTagAtk = destBonus !== 0 ? ` +DST:${destBonus}` : '';
    // Separa dados (que dobram no crítico) de bônus fixos (que NÃO dobram).
    const diceTotal = total;
    const flatBonus = anyHit ? (spell.damageBonus + (spell.fixedDamage ?? 0) + dmgBonusFromBuffs + extraDicePreCrit + conjuracaoBonus + destBonus) : 0;
    const baseTotal = diceTotal + flatBonus;
    const actionLabels: Record<string, string> = { bonus: 'AB', action: 'AC', reaction: 'RÇ', full: 'Completa', rapida: 'AR', movimento: 'MV', free: 'LV' };
    const dmgTypeLabel = spell.damageType ? DAMAGE_TYPE_LABELS[spell.damageType] : '';

    const results: typeof damageResults = [];

    targetAttacks.forEach((ta) => {
      const target = characters.find(c => c.id === ta.id);
      if (!target) return;

      let dmgMultiplier = 0;
      let label = '';
      let applyConditions = false;
      let isCrit = false;

      if (ta.result === 'crit_hit') {
        dmgMultiplier = 1;
        isCrit = true;
        label = '💥 ACERTO CRÍTICO';
        applyConditions = true;
      } else if (ta.result === 'hit') {
        dmgMultiplier = 1;
        label = '🎯 Acertou';
        applyConditions = true;
      } else {
        dmgMultiplier = 0;
        label = '🛡️ Errou';
        applyConditions = false;
      }

      const appliedConditions: string[] = [];
      // Crítico: dobra apenas os DADOS de dano, mantém os bônus fixos uma vez.
      let dmg = dmgMultiplier === 0 ? 0 : (isCrit ? (diceTotal * 2 + flatBonus) : baseTotal);
      if (dmgMultiplier > 0) {
        dmg += extraDicePostCrit;
      }

      // Fase 10 — Kokusen: consome flag em feitiço CaC (×1.5 + ignoresRD).
      const kokusenArmed = spell.attackType === 'melee'
        && (ta.result === 'hit' || ta.result === 'crit_hit')
        && !!source.kokusenArmedDamage;
      // Faíscas Negras: +CL ao dano CaC enquanto buff de cena ativo.
      const faiscasDmgBonus = spell.attackType === 'melee' && source.kokusenSceneBuffActive
        ? (source.cursedAptitudes?.CL ?? 0)
        : 0;
      if (dmg > 0 && faiscasDmgBonus > 0) dmg += faiscasDmgBonus;
      if (dmg > 0 && kokusenArmed) dmg = Math.floor(dmg * 1.5);

      if (dmg > 0 || (spell.spellType === 'condition' && applyConditions)) {
        if (dmg > 0) applyDamage(ta.id, dmg, spell.damageType, {
          attackerId: source.id, source: 'feitico', ignoresRD: kokusenArmed,
          isMelee: spell.attackType === undefined ? undefined : spell.attackType === 'melee',
          attack: { kind: spell.attackType ?? 'cursed', critical: isCrit, criticalFail: false },
        });
        if (kokusenArmed) updateCharacter(source.id, { kokusenArmedDamage: false });
        
        // Apply buffs/conditions
        if (spell.buffs && spell.buffs.length > 0) {
          const pePerRound = isSustainedSpell ? getSustainedPEPerRound(spell.spellLevel) : 0;
          enforceSingleSustained();
          spell.buffs.forEach(buff => addBuff(ta.id, { ...buff, id: crypto.randomUUID(), spellName: spell.name, remainingTurns: hasConcentration ? -1 : buff.durationTurns, peCostPerRound: pePerRound, sourceCharId, isSustained: isSustainedSpell, sustainInstanceId, concentrationInstanceId }));
        }

        if (applyConditions && spell.conditions && spell.conditions.length > 0) {
          spell.conditions.forEach(sc => {
            const condDef = ALL_CONDITIONS.find(c => c.id === sc.conditionId);
            if (!condDef) return;
            const expiry = normalizeConditionExpiry(sc);
            const mode = expiry.durationMode ?? 'ate_acabar';
            const isAtePassar = mode === 'ate_passar_tr';
            addCondition(ta.id, {
              id: crypto.randomUUID(),
              conditionId: condDef.id,
              name: condDef.name,
              icon: condDef.icon,
              remainingTurns: hasConcentration || isAtePassar ? -1 : (sc.durationTurns || 1),
              remainingRounds: hasConcentration ? -1 : (sc.durationRounds > 0 ? sc.durationRounds : -1),
              sourceCharName: source.name,
              sourceCharId: source.id,
              sourceEntityId: spell.id,
              sourceInstanceId: effectInstanceId,
              durationMode: mode,
              endCD: expiry.endCD,
              endTrType: expiry.endTrType,
            });
            appliedConditions.push(`${condDef.icon} ${condDef.name}`);
          });
        }
      }

      results.push({ name: target.name, rawDmg: baseTotal, finalDmg: dmg, multiplier: dmgMultiplier, saveLabel: label, conditions: appliedConditions, diceRolls: rolls, diceSides: baseRoll.sides, flatBonus, isCrit });
      const breakdownAtk = buildDamageBreakdown(rolls, baseRoll.sides, isCrit ? diceTotal * 2 : diceTotal, [
        { label: 'feitiço', value: spell.damageBonus },
        { label: 'fixo', value: spell.fixedDamage ?? 0 },
        { label: 'buffs', value: dmgBonusFromBuffs },
        { label: 'd.extra', value: extraDicePreCrit + (dmgMultiplier > 0 ? extraDicePostCrit : 0) },
        { label: 'CA', value: conjuracaoBonus },
        { label: 'DST', value: destBonus },
        ...(faiscasDmgBonus ? [{ label: 'Faíscas', value: faiscasDmgBonus }] : []),
      ], dmg);
      addLog('spell', `⚔️ ${spell.name} [Ataque] → ${target.name}: ${label}${dmg > 0 ? ` | ${breakdownAtk}${dmgTypeLabel ? ` (${dmgTypeLabel})` : ''}${kokusenArmed ? ' [Kokusen ×1.5, ignora RD]' : ''}` : ''}`);
    });

    setDamageResults(results);
    setPhase('done');
  };

  const handleCastWithSaves = async () => {
    if (!canCast()) return;
    // Consume action slot
    const updates = buildCastUpdates();
    if (!updates || !consumeActionUpdates(updates)) return;
    updateCharacter(sourceCharId, withTecnicaMaximaCooldown(updates));
    emitFundLogLines();
    applySpecPostCast();
    logConcentrationStarted();

    // Extract source buffs
    const activeBuffs = source.activeBuffs || [];
    const dmgBonusFromBuffs = activeBuffs.filter(b => b.type === 'damageBonus').reduce((sum, b) => sum + b.value, 0);
    let extraDicePreCrit = 0;
    for (const b of activeBuffs.filter(b => b.type === 'extraDice')) {
      if (b.extraDiceCount && b.extraDiceSides) extraDicePreCrit += (await rollDice(`${b.extraDiceCount}d${b.extraDiceSides}`)).total;
    }
    let extraDicePostCrit = 0;
    for (const b of activeBuffs.filter(b => b.type === 'extraDiceAfter')) {
      if (b.extraDiceCount && b.extraDiceSides) extraDicePostCrit += (await rollDice(`${b.extraDiceCount}d${b.extraDiceSides}`)).total;
    }
    let dmgLevels = activeBuffs.filter(b => b.type === 'damageLevels').reduce((sum, b) => sum + b.value, 0);

    let finalDamageDice = spell.damageDice;
    if (finalDamageDice && dmgLevels > 0) {
      const match = finalDamageDice.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
      if (match) {
        let count = parseInt(match[1]);
        let sides = parseInt(match[2]);
        const suffix = match[3] ?? '';
        const tiers = [4, 6, 8, 10, 12];
        let tierIndex = tiers.indexOf(sides);
        if (tierIndex === -1) tierIndex = 0;
        while (dmgLevels > 0) {
          if (tierIndex < tiers.length - 1) {
             tierIndex++;
             sides = tiers[tierIndex];
          } else {
             count++;
          }
          dmgLevels--;
        }
        finalDamageDice = `${count}d${sides}${suffix}`;
      }
    }

    // Roll base dice (skip se feitiço não tem dado — buff puro ou condição sem dano).
    const baseRoll = skipDamageRoll
      ? { rolls: [] as number[], sides: 0, total: 0, rerolled: [] as number[], casts: [] as any[] }
      : await rollSpellDamageDice(finalDamageDice);
    const specPipe = skipDamageRoll
      ? { rolls: baseRoll.rolls, total: 0, flatBonus: 0 }
      : await applySpecPipelineToRolls(baseRoll.rolls, baseRoll.sides);
    const { rolls, rerolled, casts } = { rolls: specPipe.rolls, rerolled: baseRoll.rerolled, casts: baseRoll.casts };
    const total = specPipe.total;
    const destSav = (!skipDamageRoll && isTecnica) ? getDestruicaoDamageBonus(source.tecnicaFoco, source.level || 1, rolls.length) : { perDie: 0, fixed: 0 };
    const destBonusSav = destSav.perDie + destSav.fixed;
    const baseTotal = skipDamageRoll ? 0 : (total + spell.damageBonus + (spell.fixedDamage ?? 0) + dmgBonusFromBuffs + extraDicePreCrit + conjuracaoBonus + destBonusSav);
    const actionLabels: Record<string, string> = { bonus: 'AB', action: 'AC', reaction: 'RÇ', full: 'Completa', rapida: 'AR', movimento: 'MV', free: 'LV' };
    const dmgTypeLabel = spell.damageType ? DAMAGE_TYPE_LABELS[spell.damageType] : '';

    const results: typeof damageResults = [];

    targetSaves.forEach((ts) => {
      const target = characters.find(c => c.id === ts.id);
      if (!target) return;

      let dmgMultiplier = 1;
      let saveLabel = '';
      let applyConditions = true;

      switch (ts.result) {
        case 'crit_fail':
          dmgMultiplier = 2;
          saveLabel = '💀 FALHA CRÍTICA';
          applyConditions = true;
          break;
        case 'fail':
          dmgMultiplier = 1;
          saveLabel = '❌ Falhou';
          applyConditions = true;
          break;
        case 'success':
          dmgMultiplier = 0.5;
          saveLabel = '✅ Sucesso';
          applyConditions = false;
          break;
        case 'crit_success':
          dmgMultiplier = 0;
          saveLabel = '✨ SUCESSO CRÍTICO';
          applyConditions = false;
          break;
        default:
          dmgMultiplier = 1;
          saveLabel = '❓ Não testado';
          applyConditions = true;
      }

      const appliedConditions: string[] = [];

      if (!skipDamageRoll && (spell.spellType === 'damage' || spell.spellType === 'condition')) {
        let dmg = Math.floor(baseTotal * dmgMultiplier);
        if (dmgMultiplier > 0) dmg += extraDicePostCrit;
        
        if (source.category === 'PLAYER' && target.category === 'PLAYER') {
          dmg = Math.floor(dmg * 0.34);
        }
        if (dmg > 0) applyDamage(ts.id, dmg, spell.damageType, { attackerId: source.id, source: 'feitico', attack: { kind: 'cursed' } });
        const pvpNote = (source.category === 'PLAYER' && target.category === 'PLAYER') ? ' (PvP -66%)' : '';
        
        results.push({ name: target.name, rawDmg: baseTotal, finalDmg: dmg, multiplier: dmgMultiplier, saveLabel, conditions: [], diceRolls: rolls, diceSides: baseRoll.sides, flatBonus: spell.damageBonus + dmgBonusFromBuffs + extraDicePreCrit + conjuracaoBonus + destBonusSav });
        
        const breakdown = buildDamageBreakdown(rolls, baseRoll.sides, total, [
          { label: 'feitiço', value: spell.damageBonus },
          { label: 'fixo', value: spell.fixedDamage ?? 0 },
          { label: 'buffs', value: dmgBonusFromBuffs },
          { label: 'd.extra', value: extraDicePreCrit },
          { label: 'CA', value: conjuracaoBonus },
          { label: 'DST', value: destBonusSav },
        ], baseTotal);
        addLog('spell', `⚔️ ${spell.name} [${actionLabels[spell.actionType]}|Nv.${spell.spellLevel || '1'}] → ${target.name}: ${breakdown} × ${dmgMultiplier} = ${dmg}${pvpNote} dano${dmgTypeLabel ? ` (${dmgTypeLabel})` : ''} | TR: ${saveLabel} (CD:${totalDC})`);
      } else if (spell.spellType === 'heal' && !skipDamageRoll) {
        const baseHeal = Math.floor(baseTotal * (ts.result === 'crit_success' ? 1.5 : 1));
        const canHealReal = source.hasEnergiaReversa;
        
        if (canHealReal) {
          applyHealing(ts.id, baseHeal, 'other', source.id);
          addLog('spell', `💚 ${spell.name} → ${target.name}: ${baseHeal} cura | TR: ${saveLabel}`);
        } else {
          applyShield(ts.id, baseHeal);
          addLog('spell', `🛡️ ${spell.name} → ${target.name}: ${baseHeal} PV Temporários (Escudo) | TR: ${saveLabel}`);
        }
        
        results.push({ 
          name: target.name, 
          rawDmg: baseTotal, 
          finalDmg: baseHeal, 
          multiplier: ts.result === 'crit_success' ? 1.5 : 1, 
          saveLabel: canHealReal ? saveLabel : `${saveLabel} (Escudo)`, 
          conditions: [],
          diceRolls: rolls,
          diceSides: baseRoll.sides,
          flatBonus: spell.damageBonus + dmgBonusFromBuffs + extraDicePreCrit + conjuracaoBonus + destBonusSav,
        });

      } else if (spell.spellType === 'buff') {
        results.push({ name: target.name, rawDmg: 0, finalDmg: 0, multiplier: 1, saveLabel, conditions: [] });
        addLog('spell', `✨ ${spell.name} → ${target.name}: buff aplicado | TR: ${saveLabel}`);
      }

      // Apply buffs
      if (spell.buffs && spell.buffs.length > 0) {
        const pePerRound = isSustainedSpell ? getSustainedPEPerRound(spell.spellLevel) : 0;
        enforceSingleSustained();
        spell.buffs.forEach((buff) => {
          addBuff(ts.id, {
            id: crypto.randomUUID(),
            spellName: spell.name,
            type: buff.type,
            targetName: buff.targetName,
            value: buff.value,
            extraDiceCount: buff.extraDiceCount,
            extraDiceSides: buff.extraDiceSides,
            remainingTurns: hasConcentration ? -1 : buff.durationTurns,
            peCostPerRound: pePerRound,
            sourceCharId,
            isSustained: isSustainedSpell,
            sustainInstanceId,
            concentrationInstanceId,
          });
        });
      }

      // Apply conditions only if save failed
      if (applyConditions && spell.conditions && spell.conditions.length > 0) {
        spell.conditions.forEach((sc) => {
          const condDef = ALL_CONDITIONS.find(c => c.id === sc.conditionId);
          if (!condDef) return;
          const extraRounds = ts.result === 'crit_fail' ? 1 : 0;
          const expiry = normalizeConditionExpiry(sc);
          const mode = expiry.durationMode ?? 'ate_acabar';
          const isAtePassar = mode === 'ate_passar_tr';
          const baseTurns = sc.durationTurns > 0 ? sc.durationTurns : -1;
          addCondition(ts.id, {
            id: crypto.randomUUID(),
            conditionId: condDef.id,
            name: condDef.name,
            icon: condDef.icon,
            remainingTurns: hasConcentration || isAtePassar ? -1 : baseTurns,
            remainingRounds: hasConcentration ? -1 : (sc.durationRounds > 0 ? sc.durationRounds + extraRounds : -1),
            sourceCharName: source.name,
              sourceCharId: source.id,
            sourceEntityId: spell.id,
            sourceInstanceId: effectInstanceId,
            durationMode: mode,
            endCD: expiry.endCD,
            endTrType: expiry.endTrType,
          });
          appliedConditions.push(`${condDef.icon} ${condDef.name}`);
          const dur = sc.durationTurns > 0 ? `${sc.durationTurns} turnos` : `${sc.durationRounds + extraRounds} rodadas`;
          addLog('spell', `⚠️ ${target.name} recebeu condição: ${condDef.icon} ${condDef.name} por ${dur}${ts.result === 'crit_fail' ? ' (crit +1rd)' : ''}`);
        });
      }

      // Update the last result with conditions
      if (results.length > 0) {
        results[results.length - 1].conditions = appliedConditions;
      }
    });

    setDamageResults(results);
    setPhase('done');
  };

  const handleCastDirect = async () => {
    if (selectedIds.length === 0 || !canCast()) return;

    const updates = buildCastUpdates();
    if (!updates || !consumeActionUpdates(updates)) return;
    updateCharacter(sourceCharId, withTecnicaMaximaCooldown(updates));
    emitFundLogLines();
    applySpecPostCast();
    logConcentrationStarted();

    // Pula a rolagem completa de dano para buffs puros / condições sem dado.
    const baseRoll = skipDamageRoll
      ? { rolls: [] as number[], sides: 0, total: 0, rerolled: [] as number[], casts: [] as any[] }
      : await rollSpellDamageDice(spell.damageDice);
    const specPipe = skipDamageRoll
      ? { rolls: baseRoll.rolls, total: 0, flatBonus: 0 }
      : await applySpecPipelineToRolls(baseRoll.rolls, baseRoll.sides);
    const { rolls, rerolled, casts } = { rolls: specPipe.rolls, rerolled: baseRoll.rerolled, casts: baseRoll.casts };
    const total = specPipe.total;
    const destDir = (!skipDamageRoll && isTecnica) ? getDestruicaoDamageBonus(source.tecnicaFoco, source.level || 1, rolls.length) : { perDie: 0, fixed: 0 };
    const destBonusDir = destDir.perDie + destDir.fixed;
    const finalTotal = skipDamageRoll ? 0 : (total + spell.damageBonus + (spell.fixedDamage ?? 0) + conjuracaoBonus + destBonusDir);
    const actionLabels: Record<string, string> = { bonus: 'AB', action: 'AC', reaction: 'RÇ', full: 'Completa', rapida: 'AR', movimento: 'MV', free: 'LV' };
    const dmgTypeLabel = spell.damageType ? DAMAGE_TYPE_LABELS[spell.damageType] : '';

    selectedIds.forEach((id) => {
      const target = characters.find((c) => c.id === id);
      if (!target) return;

      if (!skipDamageRoll && (spell.spellType === 'damage' || spell.spellType === 'condition')) {
        let dmg = finalTotal;
        if (source.category === 'PLAYER' && target.category === 'PLAYER') {
          dmg = Math.floor(dmg * 0.34);
        }
        applyDamage(id, dmg, spell.damageType, { attackerId: source.id, source: 'feitico', attack: { kind: 'cursed' } });
        const pvpNote = (source.category === 'PLAYER' && target.category === 'PLAYER') ? ' (PvP -66%)' : '';
        const breakdown = buildDamageBreakdown(rolls, baseRoll.sides, total, [
          { label: 'feitiço', value: spell.damageBonus },
          { label: 'fixo', value: spell.fixedDamage ?? 0 },
          { label: 'CA', value: conjuracaoBonus },
          { label: 'DST', value: destBonusDir },
        ], finalTotal);
        const pvpTag = pvpNote ? ` → ${dmg}${pvpNote}` : '';
        addLog('spell', `⚔️ ${spell.name} [${actionLabels[spell.actionType]}|Nv.${spell.spellLevel || '1'}] → ${target.name}: ${breakdown}${pvpTag} dano${dmgTypeLabel ? ` (${dmgTypeLabel})` : ''}`);
      } else if (spell.spellType === 'heal' && !skipDamageRoll) {
        const canHealReal = source.hasEnergiaReversa;
        const breakdown = buildDamageBreakdown(rolls, baseRoll.sides, total, [
          { label: 'feitiço', value: spell.damageBonus },
          { label: 'fixo', value: spell.fixedDamage ?? 0 },
          { label: 'CA', value: conjuracaoBonus },
        ], finalTotal);
        if (canHealReal) {
          applyHealing(id, finalTotal, 'other', source.id);
          addLog('spell', `💚 ${spell.name} [${actionLabels[spell.actionType]}|Nv.${spell.spellLevel || '1'}] → ${target.name}: ${breakdown} cura`);
        } else {
          applyShield(id, finalTotal);
          addLog('spell', `🛡️ ${spell.name} [${actionLabels[spell.actionType]}|Nv.${spell.spellLevel || '1'}] → ${target.name}: ${breakdown} PV Temporários (Escudo)`);
        }
      } else if (spell.spellType === 'buff' || skipDamageRoll) {
        const tag = spell.spellType === 'buff' ? '✨' : '⚠️';
        const desc = spell.spellType === 'buff' ? 'buff aplicado' : 'efeito aplicado';
        addLog('spell', `${tag} ${spell.name} [${actionLabels[spell.actionType]}|Nv.${spell.spellLevel || '1'}] → ${target.name}: ${desc}`);
      }

      if (spell.buffs && spell.buffs.length > 0) {
        const pePerRound = isSustainedSpell ? getSustainedPEPerRound(spell.spellLevel) : 0;
        enforceSingleSustained();
        spell.buffs.forEach((buff) => {
          addBuff(id, {
            id: crypto.randomUUID(),
            spellName: spell.name,
            type: buff.type,
            targetName: buff.targetName,
            value: buff.value,
            extraDiceCount: buff.extraDiceCount,
            extraDiceSides: buff.extraDiceSides,
            remainingTurns: hasConcentration ? -1 : buff.durationTurns,
            peCostPerRound: pePerRound,
            sourceCharId,
            isSustained: isSustainedSpell,
            sustainInstanceId,
            concentrationInstanceId,
          });
          const buffDesc = buff.type === 'ca' ? `CA+${buff.value}`
            : buff.type === 'hit' ? `Acerto+${buff.value}`
            : buff.type === 'extraDice' ? `+${buff.extraDiceCount}d${buff.extraDiceSides} nos ataques`
            : (buff.targetName || '');
          addLog('spell', `🔮 ${target.name} recebeu buff: ${buffDesc} por ${buff.durationTurns} turnos${pePerRound > 0 ? ` [Sustentado: ${pePerRound} PE/rd]` : ''}`);
        });
      }

      if (spell.conditions && spell.conditions.length > 0) {
        spell.conditions.forEach((sc) => {
          const condDef = ALL_CONDITIONS.find(c => c.id === sc.conditionId);
          if (!condDef) return;
          const expiry = normalizeConditionExpiry(sc);
          const mode = expiry.durationMode ?? 'ate_acabar';
          const isAtePassar = mode === 'ate_passar_tr';
          addCondition(id, {
            id: crypto.randomUUID(),
            conditionId: condDef.id,
            name: condDef.name,
            icon: condDef.icon,
            remainingTurns: hasConcentration || isAtePassar ? -1 : (sc.durationTurns > 0 ? sc.durationTurns : -1),
            remainingRounds: hasConcentration ? -1 : (sc.durationRounds > 0 ? sc.durationRounds : -1),
            sourceCharName: source.name,
              sourceCharId: source.id,
            sourceEntityId: spell.id,
            sourceInstanceId: effectInstanceId,
            durationMode: mode,
            endCD: expiry.endCD,
            endTrType: expiry.endTrType,
          });
          const dur = sc.durationTurns > 0 ? `${sc.durationTurns} turnos` : `${sc.durationRounds} rodadas`;
          addLog('spell', `⚠️ ${target.name} recebeu condição: ${condDef.icon} ${condDef.name} por ${dur}`);
        });
      }
    });

    onClose();
  };

  const dmgLabel = spell.damageType ? ` (${DAMAGE_TYPE_LABELS[spell.damageType]})` : '';
  const levelLabel = spell.spellLevel || '1';
  const allAttacksDone = targetAttacks.every(ta => ta.result !== 'pending');

  const getSourceAtkBonus = () => {
    if (!spell.attackType) return 0;
    const type = spell.attackType;
    const bonus = type === 'melee' ? (source.meleeAttackBonus || 0) : type === 'ranged' ? (source.rangedAttackBonus || 0) : (source.cursedAttackBonus || 0);
    const trained = type === 'melee' ? source.meleeTrained : type === 'ranged' ? source.rangedTrained : source.cursedTrained;
    
    let attrMod = 0;
    const linkedId = type === 'melee' ? source.meleeLinkedAttr : type === 'ranged' ? source.rangedLinkedAttr : source.cursedLinkedAttr;
    if (linkedId) {
      const attr = source.attributes.find(a => a.id === linkedId);
      if (attr) attrMod = Math.floor((attr.value - 10) / 2);
    }

    // Jogadas de ataque usam apenas Treinamento (sem Maestria)
    const trainBonus = getTrainingBonus(source.level, trained, false);
    const spellHitBonus = spell.tradeHitBonus || 0;
    const levelBonus = Math.floor(source.level / 2);
    
    // Get hit bonus from active buffs
    const activeBuffs = source.activeBuffs || [];
    const buffHit = activeBuffs.filter(b => b.type === 'hit').reduce((s, b) => s + b.value, 0);

    // Cursed (amaldiçoado): soma `spellAttackBonus` (cobre Refino + O Honrado).
    const cursedAtkBonus = type === 'cursed' ? (source.spellAttackBonus ?? 0) : 0;
    // Fundamento Preciso: +fundOutcome.hitBonus (t1=+2 / t2=+4).
    return bonus + attrMod + trainBonus + levelBonus + spellHitBonus + buffHit + cursedAtkBonus + fundOutcome.hitBonus;
  };

  const totalAtkBonus = getSourceAtkBonus();

  const targetModeBadge = spell.targetMode === 'single_atk' ? { code: 'AUA', label: 'Alvo Único (Ataque)', cls: 'bg-primary/20 text-primary border-primary/40' }
    : spell.targetMode === 'single_tr' ? { code: 'TRU', label: 'TR Alvo Único', cls: 'bg-neon-yellow/20 text-neon-yellow border-neon-yellow/40' }
    : spell.targetMode === 'area_tr' ? { code: 'TRA', label: 'TR Área', cls: 'bg-hp/20 text-hp border-hp/40' }
    : null;

  return (
    <div className="rounded-xl border border-primary/50 bg-background/95 backdrop-blur-md shadow-2xl px-4 py-3 text-sm space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-semibold text-primary inline-flex items-center gap-1.5 flex-wrap">
          {spell.name} — <span className="font-mono text-xs">Nv.{levelLabel}</span> — <span title={isErHealing ? `Energia Reversa: ${baseEffectiveCostPE} PER × 2 = ${effectiveCostPE} PE` : undefined}>PE:{effectiveCostPE}{isErHealing && <span className="text-neon-green text-xs ml-1">(ER ×2)</span>}{hasCondenado && <span className="text-hp text-xs ml-1">(⛓+1)</span>}</span>
          {targetModeBadge && (
            <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-extrabold tracking-wider", targetModeBadge.cls)} title={targetModeBadge.label}>
              {targetModeBadge.code}
            </span>
          )}
          {spell.spellType === 'damage' && <span className="text-hp ml-1">⚔️ Dano{dmgLabel}</span>}
          {spell.spellType === 'condition' && <span className="text-neon-yellow ml-1">⚠️ Condição{dmgLabel}</span>}
          {spell.spellType === 'heal' && <span className="text-neon-green ml-1">💚 Cura</span>}
          {spell.spellType === 'buff' && <span className="text-pe ml-1">🔮 Buff</span>}
        </span>
        {(() => {
          const locked = phase === 'saves' || !!damageRoll;
          return (
            <button
              onClick={onClose}
              disabled={locked}
              title={locked ? 'Aguardando resultado…' : 'Fechar'}
              className={cn(locked && 'opacity-30 cursor-not-allowed')}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })()}
      </div>

      {/* Etapa visual de "Rolar Dano" — botão + animação dos dados */}
      {damageRoll && (
        <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 space-y-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <Dice6 className={cn("h-5 w-5 text-primary", damageRoll.stage === 'spinning' && "animate-spin")} />
            <span className="text-sm font-bold text-primary flex-1">
              {damageRoll.stage === 'spinning' ? 'Rolando dano…' : 'Pronto para rolar o dano'}
            </span>
            {damageRoll.stage === 'ready' && (
              <button
                onClick={() => setDamageRoll(null)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                title="Cancelar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {damageRoll.stage === 'ready' ? (
            <button
              onClick={triggerDamageRoll}
              className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors"
            >
              <Dice6 className="h-4 w-4" /> Rolar Dano
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 h-9">
              {[0, 1, 2].map((i) => (
                <Dice6
                  key={i}
                  className="h-6 w-6 text-primary animate-spin"
                  style={{ animationDelay: `${i * 120}ms`, animationDuration: '600ms' }}
                />
              ))}
            </div>
          )}
        </div>
      )}



      {/* DC info for TR spells */}
      {needsTR && (
        <div className="flex items-center gap-2 rounded-lg bg-neon-yellow/10 border border-neon-yellow/30 px-2 py-1.5 flex-wrap">
          <Shield className="h-4 w-4 text-neon-yellow" />
          <span className="text-sm font-bold text-neon-yellow">CD: {totalDC}</span>
          <span className="text-xs text-muted-foreground">
            (Base:{baseDC}
            {dcLinkedAttr ? ` + ${dcAttrLabel}:${dcAttrMod >= 0 ? '+' : ''}${dcAttrMod}` : ''}
            {halfLevelSrc !== 0 ? ` + ½Nv:${halfLevelSrc}` : ''}
            {passiveDC !== 0 ? ` + Pass:${passiveDC >= 0 ? '+' : ''}${passiveDC}` : ''}
            {itemDC !== 0 ? ` + Itens:${itemDC >= 0 ? '+' : ''}${itemDC}` : ''}
            {buffDC !== 0 ? ` + Buff:${buffDC >= 0 ? '+' : ''}${buffDC}` : ''}
            {cdIncrease !== 0 ? ` + Aum:${cdIncrease >= 0 ? '+' : ''}${cdIncrease}` : ''}
            {classCdBonus !== 0 ? ` + Classe:${classCdBonus >= 0 ? '+' : ''}${classCdBonus}` : ''}
            {spellDCBonus !== 0 ? ` + Feitiço:${spellDCBonus >= 0 ? '+' : ''}${spellDCBonus}` : ''}
            )
          </span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
            TR: {spell.saveAttr || 'DES'}
          </span>
        </div>
      )}

      {/* Conditions info */}
      {spell.conditions && spell.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {spell.conditions.map((sc, i) => {
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

      {/* Phase: Select targets */}
      {phase === 'select' && (
        <>
          {/* === Fundamentos ativáveis (Especialista em Técnica) === */}
          {isTecnica && ownedFundamentos.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  🌀 Fundamentos
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  +{fundOutcome.extraPe} PE extra
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {ownedFundamentos.map((f) => {
                  const det = TECNICA_FUNDAMENTO_DETAILS[f];
                  const cur = fundAct[f] ?? 'off';
                  const hasTwoTiers = f === 'Feitiço Cruel' || f === 'Feitiço Preciso';
                  const locked = (source.level ?? 1) < det.unlockLevel;
                  const label = locked
                    ? `🔒 ${f} (Nv ${det.unlockLevel})`
                    : cur === 'off' ? f : cur === 't1' ? `${f} ·1` : `${f} ·2`;
                  const title = locked
                    ? `Aprendido, mas só desbloqueia no Nível ${det.unlockLevel}.\n${det.effect}`
                    : `${det.short}\n${det.effect}${hasTwoTiers ? '\n(clique para ciclar off → t1 → t2 → off)' : ''}`;
                  return (
                    <button
                      key={f}
                      type="button"
                      disabled={locked}
                      onClick={() => { if (!locked) toggleFund(f); }}
                      title={title}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs transition-colors',
                        locked
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300/70 cursor-not-allowed opacity-70'
                          : cur === 'off'
                            ? 'border-border bg-background text-muted-foreground hover:border-primary/40'
                            : cur === 't1'
                              ? 'border-primary bg-primary/20 text-primary'
                              : 'border-accent bg-accent/20 text-accent-foreground',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {fundOutcome.activeLabels.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1 border-t border-primary/20">
                  {fundOutcome.activeLabels.map((lbl, i) => (
                    <span key={i} className="rounded bg-primary/10 border border-primary/30 px-1.5 py-0.5 text-xs font-mono text-primary">
                      {lbl}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* === Spec Pipeline (Especialista em Técnica) — opt-ins === */}
          {(source.chosenSpecAbilities ?? []).some(a => a.abilityId === 'tec-conjuracao-defensiva') && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  🛡 Conjuração Defensiva
                </span>
                <button
                  type="button"
                  onClick={() => setDefensiveCastingOpt((v) => !v)}
                  title="Pague +2 PE para ganhar Defesa+nivelFeitiço e RD+nivelFeitiço até o início do próximo turno."
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-xs transition-colors',
                    defensiveCastingOpt
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/40',
                  )}
                >
                  {defensiveCastingOpt ? `Ativado (+2 PE → +${spell.spellLevel === 'Técnica Máxima' ? 10 : Number(spell.spellLevel) || 1} Def/RD)` : '+2 PE → ativar'}
                </button>
              </div>
            </div>
          )}

          {/* tec-sobrecarregar — opt-in: gasta PE extra (até TB) para +1 CD por PE. */}
          {(source.chosenSpecAbilities ?? []).some(a => a.abilityId === 'tec-sobrecarregar') && needsTR && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
                  ⚡ Sobrecarregar
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">PE extra:</span>
                  <input
                    type="number"
                    min={0}
                    max={getTrainingBonusByLevel(source.level)}
                    value={overchargePe}
                    onChange={(e) => setOverchargePe(Math.max(0, Math.min(getTrainingBonusByLevel(source.level), parseInt(e.target.value) || 0)))}
                    className="h-6 w-12 rounded border border-input bg-background px-1 text-center font-mono text-xs"
                  />
                  <span className="text-xs text-muted-foreground">→ CD +{overchargePe} (máx {getTrainingBonusByLevel(source.level)})</span>
                </div>
              </div>
            </div>
          )}

          {/* tec-potencia-concentrada — opt-in: consome Ação de Movimento p/ +5×nível flat (alvo único, dano). */}
          {(source.chosenSpecAbilities ?? []).some(a => a.abilityId === 'tec-potencia-concentrada')
            && spell.spellType === 'damage'
            && (spell.targetMode === 'single_atk' || spell.targetMode === 'single_tr') && (
            <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-2 space-y-1">
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-xs font-bold uppercase tracking-wider text-fuchsia-400">
                  💢 Potência Concentrada
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    +{5 * (spell.spellLevel === 'Técnica Máxima' ? 10 : Number(spell.spellLevel) || 1)} dano · consome Movimento
                  </span>
                  <input
                    type="checkbox"
                    checked={potenciaConcentradaOpt}
                    onChange={(e) => setPotenciaConcentradaOpt(e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-fuchsia-500"
                  />
                </div>
              </label>
            </div>
          )}


          <p className="text-muted-foreground">Selecione alvos antes de lançar:</p>
          <div className="flex flex-wrap gap-1">
            {characters
              .filter((ch) => !(spell.spellType === 'damage' && ch.id === sourceCharId))
              .map((c) => {
                return (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-sm transition-colors',
                      selectedIds.includes(c.id)
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-border text-muted-foreground hover:bg-secondary'
                    )}
                  >
                    {c.name}{c.id === sourceCharId ? ' (eu)' : ''}
                  </button>
                );
              })}
          </div>

          {!canCast() && (
            <p className="text-hp text-xs font-bold">❌ {getBlockReason()}</p>
          )}

          {selectedIds.length > 0 && canCast() && (
            <div className="flex gap-1">
              <button onClick={proceedToSaves} className={cn(
                "h-8 rounded-lg px-3 text-sm transition-colors font-medium",
                spell.spellType === 'damage' || spell.spellType === 'condition'
                  ? "bg-hp/20 text-hp hover:bg-hp/30"
                  : spell.spellType === 'heal'
                    ? "bg-neon-green/20 text-neon-green hover:bg-neon-green/30"
                    : "bg-pe/20 text-pe hover:bg-pe/30"
              )}>
                {needsTR ? '🎯 Prosseguir para TR' : `🎯 Lançar ${spell.spellType === 'heal' ? 'Cura' : spell.spellType === 'buff' ? 'Buff' : 'Dano'}`}
                {spell.damageDice && !needsTR && ` (${spell.damageDice}+${spell.damageBonus})`}
              </button>
            </div>
          )}
        </>
      )}

      {/* Phase: Sustain conflict confirmation */}
      {phase === 'sustain_confirm' && (
        <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground">Feitiço sustentado já ativo</span>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{source.name}</span> já mantém um feitiço sustentado ativo.
            Cada player só pode manter <strong>1 feitiço sustentado</strong> por vez.
          </p>
          <p className="text-xs text-muted-foreground">
            Se prosseguir, o feitiço sustentado anterior será cancelado e <strong>todos os alvos perderão imediatamente</strong> os bônus dele.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (pendingNext) runNext(pendingNext);
              }}
              className="h-9 flex-1 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all"
            >
              ♾ Cancelar anterior e ativar este
            </button>
            <button
              onClick={() => { setPhase('select'); setPendingNext(null); }}
              className="h-9 rounded-lg bg-secondary px-4 text-secondary-foreground hover:bg-secondary/80"
            >
              Cancelar ação
            </button>
          </div>
        </div>
      )}

      {phase === 'saves' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-neon-yellow" />
            <span className="font-bold text-foreground">Testes de Resistência (CD: {totalDC})</span>
          </div>
          <p className="text-xs text-muted-foreground">
            O pedido foi enviado a cada alvo. Aguardando rolagem — o resultado será aplicado automaticamente.
          </p>

          <div className="space-y-1.5">
            {targetSaves.map((ts) => {
              const target = characters.find(c => c.id === ts.id);
              const ownerLabel = target?.category === 'PLAYER' ? 'jogador' : 'mestre';
              return (
                <div key={ts.id} className={cn(
                  "rounded-lg border p-2 flex items-center gap-2 flex-wrap",
                  ts.result === 'crit_fail' ? 'border-hp/50 bg-hp/10' :
                  ts.result === 'fail' ? 'border-hp/30 bg-hp/5' :
                  ts.result === 'success' ? 'border-neon-green/30 bg-neon-green/5' :
                  ts.result === 'crit_success' ? 'border-neon-green/50 bg-neon-green/10' :
                  'border-border bg-secondary/30'
                )}>
                  <span className="font-medium text-foreground text-sm min-w-[80px]">{ts.name}</span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary" title={isMaster || target?.category === 'PLAYER' ? `TR de ${spell.saveAttr || 'DES'} — bônus do alvo: +${getTargetSaveBonus(ts.id).bonus}` : 'Teste do inimigo — bônus reservado ao mestre'}>
                    TR {spell.saveAttr || 'DES'}{(isMaster || target?.category === 'PLAYER') && ` (+${getTargetSaveBonus(ts.id).bonus})`}
                  </span>
                  {ts.result === 'pending' ? (
                    <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                      <Dice6 className="h-3.5 w-3.5 animate-spin text-primary" />
                      Aguardando {ownerLabel}…
                    </span>
                  ) : (
                    <>
                      <span className="h-7 px-2 inline-flex items-center justify-center rounded border border-input bg-background text-sm text-foreground font-mono">
                        {!isMaster && target?.category !== 'PLAYER' ? 'Rolado' : ts.saveRoll || '—'}
                      </span>
                      <span className={cn("text-xs font-bold ml-auto",
                        ts.result === 'crit_fail' ? 'text-hp' :
                        ts.result === 'fail' ? 'text-hp' :
                        ts.result === 'success' ? 'text-neon-green' :
                        'text-neon-green'
                      )}>
                        {ts.result === 'crit_fail' && '💀 FALHA CRÍTICA'}
                        {ts.result === 'fail' && '❌ Falhou'}
                        {ts.result === 'success' && '✅ Sucesso'}
                        {ts.result === 'crit_success' && '✨ SUCESSO CRÍTICO'}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {targetSaves.every(ts => ts.result !== 'pending') && (
            <div className="text-center text-xs text-primary font-bold animate-pulse">
              Aplicando resultado…
            </div>
          )}
        </div>
      )}


      {/* Phase: Attacks */}
      {phase === 'attacks' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-pe" />
            <span className="font-bold text-foreground">Jogadas de Ataque (Bônus: +{totalAtkBonus})</span>
          </div>



          <div className="space-y-1.5">
            {targetAttacks.map((ta) => {
              const target = characters.find(c => c.id === ta.id);
              const targetCA = getEffectiveCA(ta.id) + (defesaReacaoRef.current[ta.id] ?? 0);
              const isRolling = rollingAttackIds.has(ta.id);
              return (
                <div key={ta.id} className={cn(
                  "rounded-lg border p-2 flex items-center gap-2 flex-wrap",
                  ta.result === 'crit_hit' ? 'border-pe/50 bg-pe/10' :
                  ta.result === 'hit' ? 'border-neon-green/30 bg-neon-green/5' :
                  ta.result === 'miss' ? 'border-hp/30 bg-hp/5' :
                  'border-border bg-secondary/30'
                )}>
                  <span className="font-medium text-foreground text-sm min-w-[80px]">{ta.name}</span>
                  {/* CA do alvo oculta — apenas o resultado (acerto/erro) é revelado. */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground uppercase">Roll:</span>
                    {isRolling ? (
                      <span className="h-7 w-16 inline-flex items-center justify-center rounded border border-primary/50 bg-primary/10 px-2 text-sm text-primary font-mono">
                        <Dice6 className="h-4 w-4 animate-spin" />
                      </span>
                    ) : isMaster ? (
                      <input
                        type="number"
                        value={ta.roll}
                        onChange={(e) => updateAttackRoll(ta.id, e.target.value)}
                        placeholder="d20+bônus"
                        className="h-7 w-16 rounded border border-input bg-background px-2 text-sm text-foreground text-center font-mono"
                      />
                    ) : (
                      <span className="h-7 w-16 inline-flex items-center justify-center rounded border border-input bg-background px-2 text-sm text-foreground font-mono">
                        {ta.roll || '—'}
                      </span>
                    )}
                    <button
                      onClick={() => animatedRollAttack(ta.id)}
                      disabled={isRolling || (!isMaster && ta.result !== 'pending')}
                      title={!isMaster && ta.result !== 'pending' ? 'Re-rolagem requer permissão do Mestre' : 'Rolar d20 + bônus automaticamente'}
                      className="h-7 inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Dice6 className={cn("h-3 w-3", isRolling && "animate-spin")} /> Rolar
                    </button>
                  </div>
                  {ta.result !== 'pending' && !isRolling && (
                    <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded ml-auto", ta.result === 'miss' ? 'bg-hp/20 text-hp' : 'bg-neon-green/20 text-neon-green')}>
                      {ta.result === 'hit' ? '🎯 ACERTO' : ta.result === 'crit_hit' ? '💥 CRÍTICO' : '🛡️ ERRO'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {isMaster && (
              <button onClick={() => setPhase('select')} className="h-8 rounded-lg px-3 text-sm text-muted-foreground hover:bg-secondary">
                Voltar
              </button>
            )}
            <button
              onClick={() => stageDamageRoll(handleCastWithAttacks)}
              disabled={!allAttacksDone || rollingAttackIds.size > 0}
              className="h-8 rounded-lg bg-primary px-4 text-sm text-primary-foreground font-bold hover:bg-primary/90 disabled:opacity-50"
            >
              Confirmar Ataques
            </button>
          </div>

        </div>
      )}

      {/* Phase: Done - Show damage results per target */}
      {phase === 'done' && damageResults.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="font-bold text-foreground">Resultado Final por Alvo</span>
          </div>
          <div className="space-y-1">
            {damageResults.map((r, i) => (
              <div key={i} className={cn(
                "rounded-lg border p-2 text-sm",
                r.multiplier >= 2 ? 'border-hp/50 bg-hp/10' :
                r.multiplier <= 0 ? 'border-neon-green/50 bg-neon-green/10' :
                r.multiplier < 1 ? 'border-neon-green/30 bg-neon-green/5' :
                'border-hp/30 bg-hp/5'
              )}>
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-bold text-foreground">{r.name}</span>
                  <span className={cn("text-xs font-bold",
                    r.multiplier >= 2 ? 'text-hp' :
                    r.multiplier <= 0 ? 'text-neon-green' :
                    r.multiplier < 1 ? 'text-neon-green' : 'text-hp'
                  )}>{r.saveLabel}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {spell.spellType === 'heal' ? (
                    <span>Cura recebida: <span className="text-neon-green font-bold">{r.finalDmg}</span> (base: {r.rawDmg} × {r.multiplier})</span>
                  ) : r.rawDmg > 0 ? (
                    <span>Dano recebido: <span className="text-hp font-bold">{r.finalDmg}</span> (base: {r.rawDmg} × {r.multiplier}{r.finalDmg !== Math.floor(r.rawDmg * r.multiplier) ? ' [PvP]' : ''})</span>
                  ) : spell.spellType === 'condition' ? (
                    <span className="text-neon-yellow">Feitiço de condição (sem dano)</span>
                  ) : (
                    <span>Sem dano</span>
                  )}
                </div>
                {r.diceRolls && r.diceRolls.length > 0 && r.diceSides && (
                  <div className="mt-1.5 rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5 space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      <span>{r.diceRolls.length}d{r.diceSides}{r.isCrit ? ' (crítico ×2)' : ''}</span>
                      <span>
                        Soma: <span className="text-foreground font-bold">{r.diceRolls.reduce((a, b) => a + b, 0)}</span>
                        {typeof r.flatBonus === 'number' && r.flatBonus !== 0 && (
                          <> {r.flatBonus >= 0 ? '+' : ''}{r.flatBonus}</>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {r.diceRolls.map((v, j) => {
                        const isMax = v === r.diceSides;
                        const isMin = v === 1;
                        return (
                          <span
                            key={j}
                            className={cn(
                              "inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded font-mono text-xs font-bold border",
                              isMax ? 'bg-neon-green/20 text-neon-green border-neon-green/40' :
                              isMin ? 'bg-hp/20 text-hp border-hp/40' :
                              'bg-background/60 text-foreground border-border'
                            )}
                            title={`d${r.diceSides} → ${v}`}
                          >
                            {v}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {r.conditions.length > 0 && (
                  <div className="text-xs mt-0.5">
                    <span className="text-hp">Condições aplicadas: {r.conditions.join(', ')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button onClick={onClose} className="h-8 w-full rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
