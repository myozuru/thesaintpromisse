import { exemplarArma, entidadeDoExemplar } from '@/lib/omni/exemplarArma';
import { notificarResultadoAtaque } from '@/lib/omni/resultadoAtaque';
import { SoltarItemButton } from './SoltarItemButton';
import { pedirAlvoMapa } from '@/stores/useAlvoMapaStore';
import { armaDoPersonagem } from '@/lib/omni/armaDoPersonagem';
import { ContadoresEquipamento } from '@/components/omni/ContadoresEquipamento';
import type { MetadadosAtaqueDano } from '@/lib/omni/contextoDano';
/**
 * AttackPanel — UI de combate ancorada no `combatEngine`.
 *
 * Automação:
 *   • Empunhadura: 2 slots (Principal/Secundária) populados a partir do
 *     INVENTÁRIO do personagem (apenas itens cujo nome casa com `ALL_WEAPONS`).
 *     1ª troca/turno = Ação Livre; 2ª+ = Ação Bônus (delegado ao store).
 *   • Ataque: usa a arma da mão principal e atributo derivado (FOR/DES + fineza).
 *   • Defesa do alvo: dropdown de personagens (NPC/INIMIGO) — calcula via
 *     `computeTotalDefense`. Permite override manual.
 */
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_CONDITIONS } from '@/types/conditions';
import type { Character } from '@/types';
import {
  findWeaponByName, hasProperty, requiresTwoHands, isVersatile, resolveWeaponDamage, type Weapon,
} from '@/lib/weapons';
import {
  buildAttackContext, rollAttack, pickAttackAbility, getAbilityMod, type AttackResult,
} from '@/lib/combatEngine';
import { computeTotalDefense, type AttackKind } from '@/lib/defenseCalc';
import { checkWeaponRange, weaponMaxRangeMeters, distanceBetweenChars } from '@/lib/weaponRange';
import { isAuraToggleActive } from '@/lib/auraEffects';
import { getAutoCritFromConditions } from '@/lib/conditionEffects';
import { useLogStore } from '@/stores/useLogStore';
import { useItemStore } from '@/stores/useItemStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { ReplicasSection } from './ReplicasSection';
import { AcoesAtivasSection } from './AcoesAtivasSection';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useOmniRuntimeStore } from '@/stores/useOmniRuntimeStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { rollD20Com, rollDiceCom } from '@/lib/dice';
import { getAoEFromOmniEntity, findEntitiesInTemplate, type AoEDef } from '@/lib/mapAoE';
import { useMapStore } from '@/stores/useMapStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { CombatTrackersCard } from './CombatTrackersCard';
import { GolpeEspecialSection } from './GolpeEspecialSection';
import {
  hasGolpeEspecial, custoGolpeEspecial, isGolpeAtivo, longoBonusMeters, penetranteRD,
  impactanteMeters, specDCFor, precisoUsesThisTurn, registerPrecisoUse, type GolpeSelecao,
} from '@/lib/golpeEspecial';
import { Swords, Dice5, Shield, Zap, RotateCcw, Sparkles, Hand, X, ChevronDown } from 'lucide-react';
import {
  hasArtesCombate, getPreparoAtual, getPreparoMax, spendPreparo,
  applyDistracaoLetal, applyGolpeDescendente, investidaMoveMeters, metadeSab,
  execucaoSilenciosaDice,
} from '@/lib/artesCombate';
import { renovacaoSangueAtiva, aplicarRenovacao } from '@/lib/renovacaoSangue';
import { posturaAtiva, fortitudeMod, imuneMovimentoForcado, hasAssumirPostura, posturaAlcanceMult, devastacaoBonus, devastacaoPatch, devastacaoPatchReroll, TEMPESTADE_IMOVEL_PREFIX } from '@/lib/posturas';
import { PosturasPanel } from '@/components/fichas/PosturasPanel';
import { arsenalRegistroAtaque, arsenalBonusAtivo, hasArsenalCiclico } from '@/lib/arsenalCiclico';
import { hasArremessosPotentes, podeAtivarArremessos, arremessosAtivo, arremessosRdIgnorada, turnKeyFor } from '@/lib/arremessosPotentes';
import { hasPistoleiroIniciado, podeUsarPistoleiro, armaEstaEmperrada, ehArmaDeFogo, margemEmperrar } from '@/lib/pistoleiroIniciado';
import { hasPrecisaoDefinitiva, precisaoPeMax, precisaoBonus, podeUsarPrecisao, type PrecisaoModo } from '@/lib/precisaoDefinitiva';

import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { extensaoAlcanceBonus } from '@/lib/extensaoCorpo';
import { penalidadeTRFlanqueado } from '@/lib/flanqueadorSuperior';
import { hasDisparosSincronizados, podeSincronizar } from '@/lib/disparosSincronizados';
import { GolpeFalsoSection } from './GolpeFalsoSection';
import { useZonaRiscoStore } from '@/lib/zonaRisco';
import { hasArremessoRapido, arremessoRapidoPodeUsar, arremessoRapidoUsar, useArremessoRapidoStore } from '@/lib/arremessoRapido';
import { TiroFalsoSection } from './TiroFalsoSection';
import { RevigorarButton } from './RevigorarButton';
import { EspiritoLutaButton } from './EspiritoLutaButton';
import { EspecialistaNv4Sections } from './EspecialistaNv4Sections';
import { EspecialistaNv4CSections } from './EspecialistaNv4CSections';
import { consumirTiro } from '@/lib/recargaRapida';
import {
  calcularCustoLanca, createLancaCombatRecord, lancaAttackEffects, lancaDamageFormula, lancaInstanceKey,
  resolveLancaAttack, type LancaAttackMode, type LancaCombatRecord,
} from '@/lib/lancaVetorial';
import { combatMoveBudget } from '@/lib/movementBudget';
import { WallsEngine } from '@/components/mapa/WallsEngine';
import { prepareCollisionCache, resolveCollisionMove, type MapCollisionSegment, type MapCollisionToken } from '@/lib/mapCollision';
import { useFogStore } from '@/stores/fogStore';
import { buildSegments as buildFogSegments } from '@/lib/fog/visibility';
import { amostrarTrajetoria } from '@/lib/omni/geometriaReacao';
import { comPreviaMovimento } from '@/lib/mapa/movimentoConfirmado';
import { selectOmniModifiers } from '@/lib/omni/omniBridge';
import { useOpportunityStore } from '@/stores/useOpportunityStore';
import { isBaculoAetheris } from '@/lib/baculoAetheris';
import { BaculoAetherisPanel } from './BaculoAetherisPanel';

import { escondidoDe, revelarPara } from '@/lib/buscarOportunidade';
import { registrarAtaqueCompensar } from '@/lib/compensarErro';

import { cn } from '@/lib/utils';

interface Props { character: Character; }

interface LancaAttackResolution {
  key: string;
  targetId: string;
  mode: LancaAttackMode;
  before: LancaCombatRecord;
  fractureEligible: boolean;
}

const REACTION_COMBAT_TALENT_IDS = [
  'tal-apaziguador-tecnica',
  'tal-tecnicas-sentinela',
  'tal-movimentos-acrobaticos',
  'tal-tecnicas-defensivas-escudo',
] as const;

const REACTION_LABELS: Record<string, { name: string; trigger: string; effect: string }> = {
  'tal-apaziguador-tecnica': {
    name: 'Apaziguador de Técnica',
    trigger: 'Inimigo adjacente conjura uma técnica.',
    effect: 'Gere AdO; alvo faz TR de Concentração se acertar.',
  },
  'tal-tecnicas-sentinela': {
    name: 'Sentinela',
    trigger: 'Inimigo a 1,5m ataca um aliado.',
    effect: 'Você ganha 1 AdO contra esse inimigo.',
  },
  'tal-movimentos-acrobaticos': {
    name: 'Movimentos Acrobáticos',
    trigger: 'Você fica [Caído].',
    effect: 'Acrobacia vs CD: sucesso = levanta de graça +3m sem AdO + Defesa +(DES/2).',
  },
  'tal-tecnicas-defensivas-escudo': {
    name: 'Técnicas Defensivas de Escudo',
    trigger: 'TR de Reflexos pendente.',
    effect: 'Reduz a margem de Sucesso Crítico do TR em -3.',
  },
};

function setLancaSentenceSuppression(targetId: string, wielder: Character, instanceId: string, active: boolean): void {
  const target = useCharacterStore.getState().characters.find((character) => character.id === targetId);
  if (!target) return;
  const id = `lanca-vetorial-sem-reacoes:${wielder.id}:${instanceId}`;
  const exists = (target.activeConditions ?? []).some((condition) => condition.id === id);
  if (active && !exists) {
    useCharacterStore.getState().addCondition(targetId, {
      id,
      conditionId: 'lanca-vetorial-sem-reacoes',
      name: 'Reações suprimidas',
      icon: '⛔',
      remainingTurns: -1,
      remainingRounds: -1,
      sourceCharId: wielder.id,
      sourceCharName: wielder.name,
      sourceEntityId: 'lanca-vetorial-rubra',
      sourceInstanceId: instanceId,
    });
  } else if (!active && exists) {
    useCharacterStore.getState().updateCharacter(targetId, {
      activeConditions: (target.activeConditions ?? []).filter((condition) => condition.id !== id),
    });
  }
}

export function AttackPanel({ character: cProp }: Props) {
  // Sempre a ficha viva da mesa (posturas, bônus e PE mudam durante o turno).
  const c = useCharacterStore((s) => s.characters.find((x) => x.id === cProp.id)) ?? cProp;
  const addLog = useLogStore(s => s.addLog);
  const items = useItemStore(s => s.items);
  const characters = useCharacterStore(s => s.characters);
  const equipWeapons = useCharacterStore(s => s.equipWeapons);
  const recordAttackResult = useCharacterStore(s => s.recordAttackResult);
  const consumeConcentratedAura = useCharacterStore(s => s.consumeConcentratedAura);
  const spendLuck = useCharacterStore(s => s.spendLuck);
  const resetTurnStateFor = useCharacterStore(s => s.resetTurnStateFor);
  const inCombat = useCombatStore(s => s.inCombat);
  const initiativeOrder = useCombatStore(s => s.initiativeOrder);
  const lancaRecords = useCombatStore(s => s.lancaVetorial);
  const pendingLancaAdvance = useCombatStore(s => s.pendingLancaAdvance);
  const movementUsedByChar = useCombatStore(s => s.movementUsedByChar);
  const pendingMove = useMapStore(s => s.pendingMove);
  const opportunityPending = useOpportunityStore(s => s.pending);
  const isMaster = useRoleStore(s => s.role) === 'MASTER';
  // Fontes externas para o cálculo central de Defesa (mantém reatividade).
  const omniInventoryMap = useInventoryStore(s => s.items);
  const omniEntidadesMap = useOmniEntidadesStore(s => s.entidades);
  const omniInventoryList = useMemo(
    () => Object.values(omniInventoryMap),
    [omniInventoryMap],
  );
  const omniRuntimeMap = useOmniRuntimeStore(s => s.efeitos);
  const omniRuntimeEffectsList = useMemo(
    () => Object.values(omniRuntimeMap),
    [omniRuntimeMap],
  );

  // ─── Inventário → armas equipáveis ─────────────────────────────────────────
  // Combina:
  //   (a) Itens do banco (`useItemStore`) atribuídos ao personagem (legado).
  //   (b) Instâncias Omni no inventário do personagem (`useInventoryStore`),
  //       cujo nome casa com uma arma do catálogo (`ALL_WEAPONS`).
  const inventoryWeapons = useMemo(() => {
    const out: { item: { id: string; key: string; name: string }; weapon: Weapon }[] = [];

    // (a) Banco de Itens (legado)
    const owned = items.filter(i => i.assignedTo?.includes(c.id));
    for (const it of owned) {
      const w = findWeaponByName(it.name);
      if (w) {
        out.push({ item: { ...it, key: `legacy:${it.id}` }, weapon: w });
      }
    }

    // (b) Inventário Omni do personagem
    for (const inv of omniInventoryList) {
      if (inv.ownerId !== c.id) continue;
      // Réplicas só aparecem nas mãos enquanto materializadas.
      if (inv.entity.replica && !inv.materializada) continue;
      const w = inv.entity.replica ? (inv.replicaArma ? findWeaponByName(inv.replicaArma) : undefined) : armaDoPersonagem(c.id, inv.entity.nome, inv.instanceId);
      if (w) out.push({ item: { id: inv.instanceId, key: `omni:${inv.instanceId}`, name: inv.entity.nome }, weapon: w });
    }

    return out;
  }, [items, c.id, omniInventoryList, omniEntidadesMap]);

  const mainWeapon = c.mainHandWeaponName ? armaDoPersonagem(c.id, c.mainHandWeaponName, c.mainHandWeaponInstanceId ?? undefined) : null;
  const offWeapon =
    c.offHandWeaponName && (c.offHandWeaponInstanceId !== c.mainHandWeaponInstanceId || c.offHandWeaponName !== c.mainHandWeaponName)
      ? armaDoPersonagem(c.id, c.offHandWeaponName, c.offHandWeaponInstanceId ?? undefined)
      : null;
  const usingTwoHanded = !!mainWeapon && (requiresTwoHands(mainWeapon) || (!!c.mainHandWeaponInstanceId && c.mainHandWeaponInstanceId === c.offHandWeaponInstanceId) || (!c.mainHandWeaponInstanceId && c.mainHandWeaponName === c.offHandWeaponName));

  // ─── AoE detection (forma de área da arma Omni equipada) ───────────────────
  const mainOmniEntity = useMemo(() => {
    if (!c.mainHandWeaponName) return null;
    const inv = c.mainHandWeaponInstanceId
      ? omniInventoryList.find(i => i.instanceId === c.mainHandWeaponInstanceId)
      : exemplarArma(c.id, c.mainHandWeaponName);
    return inv ? entidadeDoExemplar(inv) : null;
  }, [omniInventoryList, c.id, c.mainHandWeaponName, c.mainHandWeaponInstanceId]);
  const weaponAoE: AoEDef | null = useMemo(
    () => getAoEFromOmniEntity(mainOmniEntity),
    [mainOmniEntity],
  );
  const requestAoEPlacement = useMapStore((s) => s.requestAoEPlacement);
  const applyDamage = useCharacterStore((s) => s.applyDamage);
  const mapEntities = useMapStore((s) => s.entities);
  const gridConfig = useMapStore((s) => s.gridConfig);


  // ─── Alvo automatizado ─────────────────────────────────────────────────────
  // Em combate: alvos vêm do tracker de iniciativa (cena ativa).
  // Fora de combate: fallback para todos NPC/INIMIGO/JOGADOR do roster.
  const possibleTargets = useMemo(() => {
    if (inCombat && initiativeOrder.length > 0) {
      return initiativeOrder
        .map(e => characters.find(ch => ch.id === e.charId))
        .filter((ch): ch is Character => !!ch && ch.id !== c.id);
    }
    return characters.filter(ch => ch.id !== c.id && (ch.category === 'INIMIGO' || ch.category === 'NPC'));
  }, [inCombat, initiativeOrder, characters, c.id]);
  const [mirando, setMirando] = useState(false);
  const ataqueAposMira = useRef(false);
  const [targetId, setTargetId] = useState<string>('');
  const [defenseOverride, setDefenseOverride] = useState<number | null>(null);
  const target = useMemo(() => characters.find(x => x.id === targetId) ?? null, [characters, targetId]);
  // Zona de Risco: ataque liberado → pré-seleciona o inimigo que entrou no alcance.
  const zonaAtaque = useZonaRiscoStore((s) => (s.ataque?.espId === c.id ? s.ataque : null));
  useEffect(() => {
    if (zonaAtaque) setTargetId(zonaAtaque.alvoId);
  }, [zonaAtaque]);
  // Arremesso Rápido: ataque extra liberado → pré-seleciona o alvo escolhido.
  const arremessoAtaqueSel = useArremessoRapidoStore((s) => (s.ataque?.espId === c.id ? s.ataque : null));
  useEffect(() => {
    if (arremessoAtaqueSel) setTargetId(arremessoAtaqueSel.alvoId);
  }, [arremessoAtaqueSel]);
  // Tipo de ataque (CaC vs Distância) — define defesa específica do alvo.
  const attackKind: AttackKind = useMemo(() => {
    if (!mainWeapon) return 'melee';
    return mainWeapon.range === 'melee' ? 'melee' : 'ranged';
  }, [mainWeapon]);
  const autoDefense = useMemo(
    () =>
      target
        ? computeTotalDefense(
            target,
            {
              items,
              omniInventory: omniInventoryList,
              omniEntidadesMap,
              omniRuntimeEffects: omniRuntimeEffectsList,
            },
            attackKind,
          )
        : 15,
    [target, items, omniInventoryList, omniEntidadesMap, omniRuntimeEffectsList, attackKind],
  );
  const targetDef = target ? autoDefense : (defenseOverride ?? 15);

  // ─── Alcance da arma no mapa (grade, borda a borda) ──────────────────────
  const meleeRangeBonus = ((c as { meleeRangeBonus?: number }).meleeRangeBonus ?? 0) + extensaoAlcanceBonus(c);
  const weaponRangeBase = mainWeapon ? weaponMaxRangeMeters(mainWeapon, meleeRangeBonus) : null;
  const weaponRangeM = weaponRangeBase !== null ? weaponRangeBase * posturaAlcanceMult(c) : null;
  const mapIdentities = target
    ? { casterProfileId: c.profileId, targetProfileId: target.profileId }
    : undefined;
  const targetDistanceM = target
    ? distanceBetweenChars(c.id, target.id, mapEntities, gridConfig, mapIdentities)
    : null;
  const isLancaWeapon = mainWeapon?.specialFeatureId === 'lanca-vetorial-rubra';
  const isAetherisWeapon = isBaculoAetheris(mainWeapon);
  const lancaKey = isLancaWeapon ? lancaInstanceKey(c.id, c.mainHandWeaponInstanceId, mainWeapon.name) : null;
  const lancaRecord = lancaKey
    ? lancaRecords[lancaKey] ?? createLancaCombatRecord(c.id, c.mainHandWeaponInstanceId ?? mainWeapon!.id)
    : null;
  const lancaMarks = target && lancaRecord?.targetId === target.id ? lancaRecord.marks : 0;
  const lancaFractureAvailable = lancaRecord?.fractureAvailable ?? true;
  const lancaSuppressedTarget = target?.activeConditions?.some((condition) => condition.conditionId === 'lanca-vetorial-sem-reacoes') ?? false;
  const rangeBlockReason =
    mainWeapon && target
      ? checkWeaponRange(c.id, target.id, mainWeapon, mapEntities, gridConfig, meleeRangeBonus, mapIdentities, posturaAlcanceMult(c))
      : null;

  // Ao trocar de alvo, limpa override
  useEffect(() => { setDefenseOverride(null); }, [targetId]);

  // ─── Condições do alvo (auto-leitura) ──────────────────────────────────────
  // Inclui condições no Character (activeConditions) E condições aplicadas via
  // Omni runtime (efeitos com meta.condicao apontando para o alvo).
  const targetConditionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const cd of target?.activeConditions ?? []) {
      const id = (cd as { conditionId?: string }).conditionId;
      if (id) ids.add(id);
    }
    if (target) {
      for (const ef of omniRuntimeEffectsList) {
        if (ef.targetCharId !== target.id) continue;
        const id = (ef.meta as { condicao?: string } | undefined)?.condicao;
        if (id) ids.add(id);
      }
    }
    return ids;
  }, [target, omniRuntimeEffectsList]);
  const autoUnaware = targetConditionIds.has('desprevenido') || targetConditionIds.has('agarrado') || targetConditionIds.has('atordoado');
  const autoProne = targetConditionIds.has('caido');

  // ─── Situação ──────────────────────────────────────────────────────────────
  const [twoHanded, setTwoHanded] = useState<boolean>(false);
  const [ataqueOportunidade, setAtaqueOportunidade] = useState(false);
  const metadadosAtaqueRef = useRef<MetadadosAtaqueDano>({});
  // Desprevenido/caído são lidos exclusivamente das condições ativas na ficha do alvo.
  // Não há mais override manual: se for preciso aplicar o efeito, registre a condição no alvo.
  const targetUnaware = autoUnaware || escondidoDe(c, target?.id);
  const targetProne = autoProne;
  // Aura Embaçada do alvo (toggle): aplica desvantagem ao atacante.
  const targetHasAuraEmbacada = !!target && isAuraToggleActive(target, 'aura_embacada');
  // Golpe com Aura: consome carga concentrada se o atacante tiver a aptidão.
  const hasGolpeComAura = (c.chosenAuraAptitudes ?? []).includes('golpe_com_aura');
  const attackerConcentratedAura = hasGolpeComAura ? (c.concentratedAura?.au ?? 0) : 0;
  // Engine de Grapple: atacante agarrado tem desvantagem.
  const attackerIsGrappled = (c.grappleState?.grappledBy?.length ?? 0) > 0;

  // Memória de turno: contadores derivados do estado do personagem.
  const previousAttacks = c.attacksThisTurn ?? 0;
  const previousMissed = c.lastAttackHit === false;
  const [lastResult, setLastResult] = useState<AttackResult | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  // Dramatização: 'idle' | 'rolling-hit' | 'await-second-d20' | 'rolling-second-d20' | 'await-dmg' | 'rolling-dmg' | 'done'
  const [phase, setPhase] = useState<'idle' | 'rolling-hit' | 'await-second-d20' | 'rolling-second-d20' | 'await-dmg' | 'rolling-dmg' | 'done'>('idle');
  const [tickD20, setTickD20] = useState<number>(0);
  const [tickD20Pair, setTickD20Pair] = useState<[number, number] | null>(null);
  const [tickDmg, setTickDmg] = useState<number>(0);
  // Resultado pendente quando estamos esperando o player rolar o dano (ou o 2º d20 em adv/dis).
  const [pendingResult, setPendingResult] = useState<AttackResult | null>(null);
  // Para vantagem/desvantagem: revela o 1º d20, espera clique, anima o 2º d20, depois finaliza.
  const [firstD20Revealed, setFirstD20Revealed] = useState<number | null>(null);
  const [pendingRerollMeta, setPendingRerollMeta] = useState<{ isReroll: boolean } | null>(null);
  // Resultado do 1º disparo do ataque atual — usado para reconciliar a Devastação numa rerrolagem.
  const primeiroDisparoRef = useRef<{ alvoId: string; hit: boolean } | null>(null);
  // Quantas vezes o d20 de ataque foi rolado nesta tentativa (máx 2).
  // Reseta a cada nova ação de ataque (handleRoll chamado sem ser reroll).
  const [attackRollCount, setAttackRollCount] = useState<number>(0);
  const rollInFlightRef = useRef(false);
  const golpeRollRef = useRef<{ sel: GolpeSelecao; target: Character | null | undefined; amploTarget?: Character } | null>(null);
  const luckRollInFlightRef = useRef(false);
  const lancaAttackResolutionRef = useRef<LancaAttackResolution | null>(null);
  const lancaActionLockRef = useRef(false);
  const [ruptureTargetId, setRuptureTargetId] = useState<string | null>(null);

  // ─── Artes do Combate (Especialista em Combate) ────────────────────────────
  const temArtes = hasArtesCombate(c);
  const preparoAtual = temArtes ? getPreparoAtual(c) : 0;
  const preparoMax = temArtes ? getPreparoMax(c) : 0;
  const [arteDistracao, setArteDistracao] = useState(false);
  const [arteExecucao, setArteExecucao] = useState(false);
  const [arteGolpe, setArteGolpe] = useState(false);
  const [arteInvestida, setArteInvestida] = useState(false);
  const [arremessoTargetId, setArremessoTargetId] = useState<string>('');
  const arremessoWeapons = useMemo(
    () => inventoryWeapons.filter(({ weapon }) => weapon.range === 'thrown'),
    [inventoryWeapons],
  );
  // ─── Golpe Especial (Especialista nv 4) ───────────────────────────────────
  const temGolpe = hasGolpeEspecial(c);
  const [golpeSel, setGolpeSel] = useState<GolpeSelecao>({});
  const [amploTargetId, setAmploTargetId] = useState<string>('');
  const combatRound = useCombatStore((s) => s.round);
  const combatTurnIdx = useCombatStore((s) => s.currentTurnIndex);
  const turnInfo = {
    inCombat,
    round: combatRound,
    currentCharId: initiativeOrder[combatTurnIdx]?.charId ?? null,
  };
  const activeLancaTurn = !inCombat || turnInfo.currentCharId === c.id;
  const lancaEquippedItems = omniInventoryList.filter((item) => item.ownerId === c.id && item.isEquipped && item.equippedSlot);
  const lancaMovementBonus = selectOmniModifiers(c, lancaEquippedItems, omniEntidadesMap).deslocamento;
  const lancaMoveBudget = combatMoveBudget(c, activeLancaTurn, lancaMovementBonus) ?? 0;
  const lancaMovementRemaining = Math.max(0, lancaMoveBudget - (movementUsedByChar[c.id] ?? 0));
  const cVivo = useCharacterStore((s) => s.characters.find((x) => x.id === c.id)) ?? c;
  const temArremessos = hasArremessosPotentes(cVivo);
  const arremessosLigado = arremessosAtivo(cVivo, turnInfo);
  const arremessosCheck = podeAtivarArremessos(cVivo, turnInfo);
  const handleAtivarArremessos = () => {
    const fresh = useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c;
    const chk = podeAtivarArremessos(fresh, turnInfo);
    if (!chk.ok) { addLog('combat', `🚫 Arremessos Potentes: ${chk.reason}`); return; }
    useCharacterStore.getState().updateCharacter(c.id, {
      peCurrent: Math.max(0, (fresh.peCurrent ?? 0) - 1),
      arremessosPotentesTurnKey: turnKeyFor(turnInfo.round, c.id),
    });
    addLog('combat', `🎯 Arremessos Potentes: ${c.name} gasta 1 PE — arremessos ignoram ${getTrainingBonusByLevel(c.level ?? 1)} de RD neste turno.`);
  };
  // ─── Pistoleiro Iniciado / Precisão Definitiva (Especialista em Combate) ──
  const temPistoleiro = hasPistoleiroIniciado(cVivo);
  const pistoleiroCheck = podeUsarPistoleiro(cVivo, mainWeapon);
  const [pistoleiroOn, setPistoleiroOn] = useState(false);
  const armaTravada = armaEstaEmperrada(cVivo, mainWeapon);
  const temPrecisao = hasPrecisaoDefinitiva(cVivo);
  const precisaoMax = precisaoPeMax(cVivo);
  const [precisaoPe, setPrecisaoPe] = useState(0);
  const [precisaoModo, setPrecisaoModo] = useState<PrecisaoModo>('acerto');
  const handleDesemperrar = () => {
    const fresh = useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c;
    const nome = fresh.armaEmperrada;
    if (!nome) return;
    useCharacterStore.getState().updateCharacter(c.id, { armaEmperrada: null });
    addLog('combat', `🔧 ${c.name} gasta uma Ação Comum e desemperra ${nome}.`);
  };
  // ─── Arremesso Rápido (Especialista nv 4) ─────────────────────────────────
  const temArremessoRapido = hasArremessoRapido(cVivo);
  const [arremessoRapidoAlvo, setArremessoRapidoAlvo] = useState<string>('');
  const arremessoAtaque = arremessoAtaqueSel;
  const arremessoRapidoCtx = { inCombat, round: combatRound };
  const arremessoRapidoCheck = arremessoRapidoPodeUsar(cVivo, arremessoRapidoCtx);
  const handleArremessoRapido = () => {
    const r = arremessoRapidoUsar(c.id, arremessoRapidoAlvo, { inCombat, round: combatRound });
    if (!r.ok) { addLog('combat', `🚫 Arremesso Rápido: ${r.reason}`); return; }
    setTargetId(arremessoRapidoAlvo);
  };

  /** RD ignorada por este ataque (Penetrante + Arremessos Potentes). */
  const devRdRef = useRef(0);
  const rdIgnoradaAtaque = (penetrante: boolean, devastacaoRd = 0): number =>
    devastacaoRd + (penetrante ? penetranteRD(c) : 0) + (mainWeapon ? arremessosRdIgnorada(useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c, mainWeapon, turnInfo) : 0);
  const golpeTurnKey = `${combatRound}:${combatTurnIdx}`;
  const precisoUsado = precisoUsesThisTurn(c.id, golpeTurnKey);
  const golpeAtivo = temGolpe && isGolpeAtivo(golpeSel);
  const golpeCusto = golpeAtivo ? custoGolpeEspecial(golpeSel, precisoUsado).total : 0;
  const longoM = golpeAtivo && mainWeapon ? longoBonusMeters(golpeSel, mainWeapon.range) : 0;
  const longoCobre = longoM > 0 && !!rangeBlockReason && targetDistanceM !== null && weaponRangeM !== null
    && targetDistanceM <= weaponRangeM + longoM + 0.01;
  const arteCustoTotal =
    (arteDistracao ? 1 : 0) + (arteExecucao ? 1 : 0) + (arteGolpe ? 1 : 0) + (arteInvestida ? 2 : 0);
  // Investida Imediata cobre a distância faltante (até Mod. SAB × 1,5 m).
  const investidaCobreDistancia =
    temArtes && arteInvestida && !!rangeBlockReason && targetDistanceM !== null && weaponRangeM !== null
      ? targetDistanceM - investidaMoveMeters(c) <= weaponRangeM + longoM + 0.01
      : false;
  const rangeOk = !rangeBlockReason || investidaCobreDistancia || longoCobre;

  // duas-mãos sempre verdadeiro se a arma exigir
  useEffect(() => {
    if (usingTwoHanded) setTwoHanded(true);
  }, [usingTwoHanded]);

  useEffect(() => { if (offWeapon) setTwoHanded(false); }, [c.offHandWeaponName]);

  const reactions = useMemo(() => {
    const chosen = c.chosenTalents ?? [];
    return REACTION_COMBAT_TALENT_IDS.filter(id => chosen.some(x => x.id === id));
  }, [c.chosenTalents]);

  // ─── Equipar/desequipar ────────────────────────────────────────────────────
  const handleEquip = (slot: 'main' | 'off', weaponKey: string | null) => {
    // Caso especial: arma de duas-mãos ocupa ambos os slots (mesmo nome em main e off).
    // "Guardar" em qualquer slot deve limpar os DOIS, senão o store re-equipa a mesma arma.
    const isTwoHandedEquipped = usingTwoHanded;
    if (slot === 'off' && (usingTwoHanded || (twoHanded && !!mainWeapon && isVersatile(mainWeapon)))) return;
    const selected = weaponKey ? inventoryWeapons.find(({ item }) => item.key === weaponKey) : null;
    const weaponName = selected?.weapon.name ?? null;
    const weaponInstanceId = selected?.item.key.startsWith('omni:') ? selected.item.id
      : selected?.item.key.startsWith('legacy:') ? selected.item.key : null;
    const novaArma = selected?.weapon ?? null;
    const mainCurrentId = c.mainHandWeaponInstanceId ?? null;
    const offCurrentId = c.offHandWeaponInstanceId ?? null;
    const payload =
      weaponName === null && isTwoHandedEquipped
        ? { mainHandName: null, offHandName: null, mainHandInstanceId: null, offHandInstanceId: null }
        : slot === 'main'
          ? { mainHandName: weaponName, offHandName: isTwoHandedEquipped || (novaArma && requiresTwoHands(novaArma)) ? null : c.offHandWeaponName ?? null,
              mainHandInstanceId: weaponInstanceId, offHandInstanceId: isTwoHandedEquipped || (novaArma && requiresTwoHands(novaArma)) ? null : offCurrentId }
          : { mainHandName: c.mainHandWeaponName ?? null, offHandName: weaponName,
              mainHandInstanceId: mainCurrentId, offHandInstanceId: weaponInstanceId };
    const res = equipWeapons(c.id, payload, { inCombat, round: combatRound });
    if (!res.ok) {
      addLog('combat', `❌ ${res.reason}`);
      return;
    }
    const swaps = useCharacterStore.getState().characters.find(x => x.id === c.id)?.weaponSwapsThisTurn ?? 0;
    const costLabel = res.actionUsed === 'bonus' ? 'Ação Bônus (2ª troca)' : res.actionUsed === 'arremessador' ? 'parte do ataque (Estilo do Arremessador)' : res.actionUsed === 'arsenal' ? 'Ação Livre (Arsenal Cíclico)' : 'Ação Livre';
    addLog('combat', `🤝 ${c.name} ${weaponName ? 'equipou' : 'guardou'} arma — ${costLabel} · trocas no turno: ${swaps}`);
    if (res.arsenalBonus) addLog('combat', `🔄 Arsenal Cíclico: +1 dado de dano com ${weaponName} até o fim do próximo turno.`);
  };

  // ─── Rolar ataque ──────────────────────────────────────────────────────────
  const handleRoll = async (opts?: { reroll?: boolean; lancaMode?: LancaAttackMode }) => {
    const isReroll = !!opts?.reroll;
    if (!mainWeapon) {
      addLog('combat', `⚠️ ${c.name} não tem arma equipada na mão principal.`);
      return;
    }
    const lancaMode: LancaAttackMode | null = isLancaWeapon
      ? (opts?.lancaMode ?? (isReroll ? lancaAttackResolutionRef.current?.mode : 'normal') ?? 'normal')
      : null;
    const priorLancaResolution = isReroll && lancaAttackResolutionRef.current?.key === lancaKey
      ? lancaAttackResolutionRef.current
      : null;
    const lancaBefore = priorLancaResolution?.before ?? (lancaRecord ? { ...lancaRecord } : null);
    const attackMarks = target && lancaBefore?.targetId === target.id ? lancaBefore.marks : 0;
    const lancaEffects = lancaMode && lancaBefore
      ? lancaAttackEffects(attackMarks, lancaBefore.fractureAvailable, lancaMode)
      : null;
    const fractureEligible = !!lancaEffects?.fractureDice;
    const attackWeapon = lancaMode && lancaEffects
      ? {
          ...mainWeapon,
          omniDamageFormula: lancaDamageFormula(resolveWeaponDamage(mainWeapon, usingTwoHanded || twoHanded) ?? '1d10', lancaMode, lancaEffects.fractureDice),
          omniDamageType: 'Pf',
        }
      : mainWeapon;
    // ─── Emperrar: arma de fogo travada não dispara ─────────────────────────
    if (armaEstaEmperrada(useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c, mainWeapon)) {
      addLog('combat', `🚫 ${mainWeapon.name} está emperrada — gaste uma Ação Comum para desemperrar.`);
      return;
    }
    // ─── Munição: armas com Recarga [X] gastam 1 tiro por ataque ────────────
    if (!isReroll) {
      const tiro = consumirTiro(c.id, mainWeapon.name, c.mainHandWeaponInstanceId ?? undefined);
      if (!tiro.ok) { addLog('combat', `🚫 ${tiro.reason}`); return; }
      if (tiro.restante !== undefined) {
        addLog('combat', `🔫 ${mainWeapon.name}: ${tiro.restante} tiro(s) restante(s).`);
      }
    }

    // ─── Precisão Definitiva: gasta PE antes da jogada ──────────────────────
    let precisaoUsada = 0;
    if (!isReroll && temPrecisao && precisaoPe > 0) {
      const fresh = useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c;
      const chk = podeUsarPrecisao(fresh, precisaoPe);
      if (!chk.ok) { addLog('combat', `🚫 Precisão Definitiva: ${chk.reason}`); return; }
      precisaoUsada = precisaoPe;
      useCharacterStore.getState().updateCharacter(c.id, { peCurrent: Math.max(0, (fresh.peCurrent ?? 0) - precisaoUsada) });
      addLog('combat', `🎯 Precisão Definitiva: ${c.name} gasta ${precisaoUsada} PE → +${precisaoBonus(precisaoUsada, precisaoModo)} ${precisaoModo === 'dano' ? 'no dano' : 'no acerto'}.`);
    }
    const pistoleiroUsado = temPistoleiro && pistoleiroOn && ehArmaDeFogo(mainWeapon);

    // ─── Artes do Combate: validações (sem gastar ainda) ────────────────────
    const artesAtivas = temArtes && arteCustoTotal > 0;
    if (artesAtivas) {
      if (arteExecucao && !targetUnaware) {
        addLog('combat', `🚫 Execução Silenciosa exige alvo [Desprevenido].`);
        return;
      }
      if (arteGolpe && mainWeapon.range !== 'melee') {
        addLog('combat', `🚫 Golpe Descendente exige ataque corpo a corpo.`);
        return;
      }
    }
    // ─── Golpe Especial: validações (sem gastar ainda) ──────────────────────
    const ataqueConcedidoSemRecursao = !!arremessoAtaque;
    const golpeUsado = golpeAtivo && !isReroll && !ataqueConcedidoSemRecursao;
    const amploTarget = golpeUsado && golpeSel.amplo ? characters.find((x) => x.id === amploTargetId) : undefined;
    if (golpeUsado) {
      if ((c.peCurrent ?? 0) < golpeCusto) {
        addLog('combat', `🚫 Golpe Especial: PE insuficiente (${c.peCurrent ?? 0}/${golpeCusto}).`);
        return;
      }
      if (golpeSel.amplo) {
        if (!amploTarget) { addLog('combat', `🚫 Golpe Especial Amplo: escolha a criatura extra.`); return; }
        if (amploTarget.id === targetId) { addLog('combat', `🚫 Golpe Especial Amplo: a criatura extra deve ser diferente do alvo.`); return; }
        const d2 = distanceBetweenChars(c.id, amploTarget.id, mapEntities, gridConfig, { casterProfileId: c.profileId, targetProfileId: amploTarget.profileId });
        if (d2 !== null && weaponRangeM !== null && d2 > weaponRangeM + longoM + 0.01) {
          addLog('combat', `🚫 Golpe Especial Amplo: ${amploTarget.name} está a ${d2.toFixed(1).replace('.', ',')} m — faltam ${(d2 - weaponRangeM - longoM).toFixed(1).replace('.', ',')} m para o alcance.`);
          return;
        }
      }
      if (golpeSel.lento && useCombatStore.getState().inCombat && (useCombatStore.getState().movementUsedByChar[c.id] ?? 0) > 0) {
        addLog('combat', `🚫 Golpe Especial Lento exige ação completa — você já se moveu neste turno.`);
        return;
      }
    }
    // Investida Imediata: move a peça em direção ao alvo (sem AdO) ANTES do
    // ataque — por isso a checagem de alcance acontece depois do movimento.
    if (artesAtivas && arteInvestida && target) {
      const mapState = useMapStore.getState();
      const ents = Object.values(mapState.entities ?? {});
      const findEnt = (ch: Character) =>
        ents.find((e) => e?.characterId === ch.id) ??
        ents.find((e) => (e?.avatarProfileId ?? e?.ownerProfileId) && (e.avatarProfileId === ch.profileId || e.ownerProfileId === ch.profileId));
      const atkEnt = findEnt(c);
      const tgtEnt = findEnt(target);
      if (atkEnt && tgtEnt) {
        const mpc = mapState.gridConfig?.metersPerCell || 1.5;
        const dpi = mapState.gridConfig?.dpi || 70;
        const pxPerM = dpi / mpc;
        const dx = (tgtEnt.x - atkEnt.x) / pxPerM;
        const dy = (tgtEnt.y - atkEnt.y) / pxPerM;
        const distM = Math.hypot(dx, dy);
        const maxMove = investidaMoveMeters(c);
        const alcance = weaponRangeM ?? 1.5;
        const passo = Math.min(maxMove, Math.max(0, distM - alcance));
        if (passo > 0 && distM > 0) {
          const nx = atkEnt.x + (dx / distM) * passo * pxPerM;
          const ny = atkEnt.y + (dy / distM) * passo * pxPerM;
          mapState.updateEntity(atkEnt.id, { x: nx, y: ny });
          addLog('combat', `🎯 Investida Imediata: ${c.name} avança ${passo.toFixed(1).replace('.', ',')} m em direção a ${target.name} (sem ataques de oportunidade).`);
        } else {
          addLog('combat', `🎯 Investida Imediata: ${c.name} já está no alcance de ${target.name}.`);
        }
      } else {
        addLog('combat', `⚠️ Investida Imediata: peças fora do mapa — movimento ignorado.`);
      }
    }
    // Alcance: com Investida ativa, mede de novo com a posição já atualizada.
    let blockReason = artesAtivas && arteInvestida && target
      ? checkWeaponRange(c.id, target.id, mainWeapon, useMapStore.getState().entities, useMapStore.getState().gridConfig, meleeRangeBonus, mapIdentities, posturaAlcanceMult(useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c))
      : rangeBlockReason;
    if (blockReason && golpeUsado && longoM > 0 && target && weaponRangeM !== null) {
      const dNow = distanceBetweenChars(c.id, target.id, useMapStore.getState().entities, useMapStore.getState().gridConfig, mapIdentities);
      if (dNow !== null && dNow <= weaponRangeM + longoM + 0.01) blockReason = null;
    }
    if (blockReason) {
      addLog('combat', `🚫 ${c.name} não pode atacar: ${blockReason}`);
      return;
    }
    // Gasto de preparo só acontece depois de todas as validações passarem.
    if (artesAtivas) {
      const spend = spendPreparo(c.id, arteCustoTotal);
      if (!spend.ok) {
        addLog('combat', `🚫 ${c.name}: ${spend.reason}`);
        return;
      }
      const usadas = [
        arteDistracao && 'Distração Letal',
        arteExecucao && 'Execução Silenciosa',
        arteGolpe && 'Golpe Descendente',
        arteInvestida && 'Investida Imediata',
      ].filter(Boolean).join(', ');
      addLog('combat', `🎯 ${c.name} gasta ${arteCustoTotal} Preparo: ${usadas}.`);
    }
    if (golpeUsado) {
      const peNow = useCharacterStore.getState().characters.find((x) => x.id === c.id)?.peCurrent ?? 0;
      useCharacterStore.getState().updateCharacter(c.id, { peCurrent: peNow - golpeCusto });
      if (golpeSel.preciso) registerPrecisoUse(c.id, golpeTurnKey);
      const nomes = Object.entries(golpeSel).filter(([, n]) => (n ?? 0) > 0).map(([k, n]) => `${k}${(n ?? 0) > 1 ? ` ×${n}` : ''}`).join(', ');
      addLog('combat', `⚔️ ${c.name} monta Golpe Especial (${nomes}) — gasta ${golpeCusto} PE.`);
      if (golpeSel.sacrificio) {
        const hpNow = useCharacterStore.getState().characters.find((x) => x.id === c.id)?.hpCurrent ?? 0;
        useCharacterStore.getState().updateCharacter(c.id, { hpCurrent: Math.max(0, hpNow - 15) });
        addLog('combat', `🩸 Sacrifício: ${c.name} recebe 15 de dano.`);
      }
      if (golpeSel.lento && useCombatStore.getState().inCombat) {
        useCombatStore.getState().setMovementUsed(c.id, 9999);
        addLog('combat', `🐢 Golpe Lento: ação completa — ação padrão, bônus e movimento do turno consumidos.`);
      }
    }
    const golpeSit = golpeUsado ? {
      golpeAtroz: !!golpeSel.atroz, golpeLetal: !!golpeSel.letal,
      golpePreciso: !!golpeSel.preciso, golpeDesfocado: golpeSel.desfocado ?? 0,
    } : {};
    const arsenalSit = inCombat && arsenalBonusAtivo(useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c, mainWeapon.name, combatRound)
      ? { arsenalCiclico: true } : {};
    golpeRollRef.current = golpeUsado ? { sel: golpeSel, target, amploTarget } : null;
    if (rollInFlightRef.current || phase === 'rolling-hit' || phase === 'rolling-dmg') return;
    if (isReroll && attackRollCount >= 2) return;
    rollInFlightRef.current = true;
    setPhase('rolling-hit');
    const ability = pickAttackAbility(c, mainWeapon);
    const devB = devastacaoBonus(useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c, target?.id);
    devRdRef.current = devB.rd;
    const auto = target ? getAutoCritFromConditions(target, attackKind) : null;
    const ctx = buildAttackContext({
      attacker: c,
      weapon: attackWeapon,
      targetDefense: targetDef - (lancaEffects?.defenseIgnore ?? 0) + (ataqueOportunidade && target?.ultimoSegundoAtivo ? 5 : 0), targetId: isReroll ? undefined : target?.id,
      semRecursao: ataqueConcedidoSemRecursao,
      situation: {
        pistoleiro: pistoleiroUsado,
        precisaoPe: temPrecisao ? precisaoPe : 0,
        precisaoModo,
        devastacaoHit: devB.hit,

        twoHanded: usingTwoHanded || twoHanded,
        targetUnaware,
        targetProne,
        previousAttacksThisTurn: previousAttacks,
        previousMissed,
        preferredAbility: ability,
        targetHasAuraEmbacada,
        attackerConcentratedAura,
        attackerIsGrappled,
        arteExecucao: artesAtivas && arteExecucao,
        hitBonusExtra: lancaEffects?.hitBonus,
        critBonusExtra: lancaEffects?.critRangeBonus,
        forceCritical: isLancaWeapon && !!auto?.autoCrit,
        autoCriticalReason: isLancaWeapon && auto?.autoCrit ? auto.reason : undefined,
        lancaSentenceSuppression: lancaMode === 'sentence' && lancaBefore
          ? {
              sourceCharId: c.id,
              sourceCharName: c.name,
              sourceInstanceId: c.mainHandWeaponInstanceId ?? lancaKey ?? mainWeapon.id,
            }
          : undefined,
        ...golpeSit,
        ...arsenalSit,
      },
      trainedRanges: [
        ...(c.meleeTrained ? (['melee'] as const) : []),
        ...(c.rangedTrained ? (['ranged', 'thrown'] as const) : []),
      ],
    });
    if (!isReroll) {
      metadadosAtaqueRef.current = {
        isSneak: escondidoDe(c, target?.id),
        isOpportunity: ataqueOportunidade,
      };
      setAtaqueOportunidade(false);
    }
    let result: AttackResult;
    try {
      result = await rollAttack(ctx);
      if (result.cancelled) { addLog('combat', '⛔ Ataque interrompido.'); setPhase('idle'); return; }
    } catch (error) {
      console.error('[AttackPanel] falha ao concluir rolagem:', error);
      setPhase('idle');
      return;
    } finally {
      rollInFlightRef.current = false;
      if (arremessoAtaque) useArremessoRapidoStore.getState().setAtaque(null);
    }
    // Emperrou: trava a arma até uma Ação Comum de desemperrar.
    if (result.emperrou) {
      useCharacterStore.getState().updateCharacter(c.id, { armaEmperrada: mainWeapon.name });
      setPistoleiroOn(false);
      addLog('combat', `🔧 ${mainWeapon.name} emperrou! O ataque falha automaticamente — gaste uma Ação Comum para desemperrar.`);
    }
    // Auto-crit contra alvos Inconsciente / Indefeso / Paralisado (CaC).
    if (auto && !result.critical && !result.criticalFail && !result.emperrou) {
      const extraDamage = result.hit ? result.damageTotal : Math.max(0, ctx.abilityMod);
      result = {
        ...result,
        hit: true,
        critical: true,
        attackTotal: Math.max(result.attackTotal, ctx.targetDefense),
        damageTotal: result.hit ? result.damageTotal * 2 : extraDamage * 2,
        notes: [...result.notes, `🎯 Auto-acerto crítico: alvo ${auto.reason}`],
      };
    }
    if (isLancaWeapon && lancaMode && lancaKey && target && lancaBefore) {
      const nextRecord = resolveLancaAttack(lancaBefore, {
        targetId: target.id,
        mode: lancaMode,
        hit: result.hit,
        critical: result.critical,
        fractureEligible,
      });
      useCombatStore.getState().setLancaRecord(lancaKey, nextRecord);
      lancaAttackResolutionRef.current = { key: lancaKey, targetId: target.id, mode: lancaMode, before: lancaBefore, fractureEligible };
      if (lancaMode === 'sentence') {
        setLancaSentenceSuppression(
          target.id,
          c,
          c.mainHandWeaponInstanceId ?? lancaKey ?? mainWeapon.id,
          result.hit,
        );
      }
      if (result.hit) {
        const beforeMarks = lancaBefore.targetId === target.id ? lancaBefore.marks : 0;
        const afterMarks = nextRecord.targetId === target.id ? nextRecord.marks : 0;
        if (lancaMode === 'sentence') addLog('combat', `🩸 Sentença Rubra: ${target.name} fica sem Reações até o início do próximo turno de ${c.name}; as 3 marcas foram consumidas.`);
        else if (lancaMode === 'advance') addLog('combat', `🔻 Avanço Escarlate: ${target.name} recebe 2 marcas (total ${afterMarks}/3).`);
        else addLog('combat', `🔻 Núcleo Carmesim: ${target.name} ${beforeMarks ? `passa de ${beforeMarks} para ${afterMarks}` : `recebe ${afterMarks}`} marca(s) vetorial(is).`);
      }
    }
    metadadosAtaqueRef.current = {
      ...metadadosAtaqueRef.current, critical: result.critical, criticalFail: result.criticalFail,
    };
    // Memória de turno: contabiliza apenas no PRIMEIRO disparo (reroll não conta como novo ataque).
    if (!isReroll) {
      recordAttackResult(c.id, result.hit);
      if (target) revelarPara(c.id, target.id);
      if (target) registrarDevastacao(target.id, result.hit);
      primeiroDisparoRef.current = target ? { alvoId: target.id, hit: result.hit } : null;
      if (result.hit && target) void tempestadeGolpe(target);
      if (inCombat) {
        const reg = arsenalRegistroAtaque(useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c, mainWeapon.name, combatRound);
        if (reg) useCharacterStore.getState().updateCharacter(c.id, reg);
      }
      if (result.hit && attackerConcentratedAura > 0) {
        consumeConcentratedAura(c.id);
      }
      // Artes do Combate: efeitos que disparam no acerto.
      if (artesAtivas) {
        if (result.hit) {
          if (arteDistracao && target) applyDistracaoLetal(target.id, metadeSab(c), c.name);
          if (arteGolpe && mainWeapon.range === 'melee') applyGolpeDescendente(c.id, metadeSab(c));
        }
        setArteDistracao(false);
        setArteExecucao(false);
        setArteGolpe(false);
        setArteInvestida(false);
      }
      // Golpe Especial: efeitos no acerto + ataque extra do Amplo.
    const g = result.semRecursao ? null : golpeRollRef.current;
      if (g) {
        if (result.hit && g.target && g.sel.sanguinario) aplicarSangramento(g.target, g.sel.sanguinario);
        setGolpeSel({});
        setAmploTargetId('');
        if (g.amploTarget) {
          const alvo2 = g.amploTarget;
          const def2 = computeTotalDefense(alvo2, { items, omniInventory: omniInventoryList, omniEntidadesMap, omniRuntimeEffects: omniRuntimeEffectsList }, attackKind);
          const ctx2 = buildAttackContext({
            attacker: c, weapon: mainWeapon, targetDefense: def2, targetId: alvo2.id,
            semRecursao: true,
            situation: { ...ctx.situation, targetUnaware: false, arteExecucao: false, devastacaoHit: 0 },
            trainedRanges: [
              ...(c.meleeTrained ? (['melee'] as const) : []),
              ...(c.rangedTrained ? (['ranged', 'thrown'] as const) : []),
            ],
          });
          const r2 = await rollAttack(ctx2);
          notificarResultadoAtaque(c.id, alvo2.id, mainWeapon, r2);
          addLog('combat', `⚔️ Golpe Amplo: ${c.name} atinge também ${alvo2.name}: d20 ${r2.natural} · total ${r2.attackTotal} → ${r2.criticalFail ? '💀 falha crítica' : r2.critical ? '💥 CRÍTICO' : r2.hit ? '✅ acerto' : '❌ erro'}${r2.hit ? ` · dano ${r2.damageTotal} (${r2.damageDice})` : ''}`);
          if (r2.hit && g.sel.sanguinario) aplicarSangramento(alvo2, g.sel.sanguinario);
          if (r2.hit && g.sel.penetrante) addLog('combat', `   ↳ Penetrante: ignora ${penetranteRD(c)} de RD.`);
          if (r2.hit && r2.damageTotal > 0) {
            await applyDamage(alvo2.id, r2.damageTotal, (r2.damageType ?? undefined) as never, {
              attackerId: c.id, source: 'arma', isMelee: mainWeapon.range === 'melee', rdIgnore: rdIgnoradaAtaque(!!g.sel.penetrante),
              attack: { critical: r2.critical, criticalFail: r2.criticalFail, isSneak: false, isOpportunity: false },
            });
          }
          if (r2.hit && r2.critical) checarRenovacaoCritico(true, alvo2.name);
          registrarDevastacao(alvo2.id, r2.hit);
          if (r2.hit) void tempestadeGolpe(alvo2);
        }
      }
    } else {
      // No reroll, atualiza a memória para refletir o resultado final (sobrescreve hit/miss do 1º).
      recordAttackResult(c.id, result.hit, { replaceLast: true });
      // Devastação: o resultado final é o que vale — ajusta o acúmulo se a rerrolagem mudou acerto/erro.
      const prev = primeiroDisparoRef.current;
      if (prev && target && prev.alvoId === target.id && prev.hit !== result.hit) {
        const eu = useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c;
        const patch = devastacaoPatchReroll(eu, target.id, prev.hit, result.hit);
        if (patch) {
          useCharacterStore.getState().updateCharacter(c.id, patch);
          const n = patch.devastacao?.acertos ?? 0;
          addLog('combat', `💢 Postura da Devastação: a rerrolagem ${result.hit ? 'acertou' : 'errou'} — acúmulo ajustado para ${n} acerto(s) (+${n} acerto, ignora ${n * 2} RD).`);
        }
      }
      primeiroDisparoRef.current = null;
    }

    const nextRollCount = isReroll ? attackRollCount + 1 : 1;
    setAttackRollCount(nextRollCount);

    // ─── Dramatização: rola d20 visualmente (900ms) e revela acerto.
    //     Se vantagem/desvantagem: anima só o 1º d20, espera o player clicar
    //     para rolar o 2º. Caso contrário, segue direto para o resultado.
    setLastResult(null);
    setPendingResult(null);
    setFirstD20Revealed(null);
    setPendingRerollMeta({ isReroll });
    // Resultado já vem do sistema 3D (await). Revela direto, sem ticking falso
    // que poderia "voltar atrás" do valor real.
    const isDualD20 = result.attackRolls.length > 1;
    setTickD20Pair(null);
    if (isDualD20) {
      const first = result.attackRolls[0];
      setTickD20(first);
      setFirstD20Revealed(first);
      setPendingResult(result);
      setPhase('await-second-d20');
      const modeLabel = result.rollMode === 'disadvantage' ? 'desvantagem' : 'vantagem';
      addLog('combat', `🎲 ${c.name} rolou o 1º d20 (${modeLabel}): ${first}. Aguardando 2º d20…`);
    } else {
      await finalizeAttackReveal(result, isReroll);
    }
  };

  // ─── Ataque em Área (AoE no Mapa) ──────────────────────────────────────────
  // Forma (círculo/cone/linha/quadrado) vem da arma Omni equipada
  // (`combatData.aoeShape` + `aoeSize`). O usuário posiciona o template no
  // mapa, identificamos os tokens atingidos e rolamos UMA vez o dano,
  // aplicado a todos os alvos.
  const handleRollAoE = async () => {
    if (!mainWeapon || !weaponAoE) return;
    if (phase === 'rolling-hit' || phase === 'rolling-dmg') return;
    setPhase('rolling-hit');
    try {
      const casterEnt = Object.values(mapEntities).find((en) => en?.characterId === c.id);
      const originWorld = casterEnt
        ? { x: casterEnt.x, y: casterEnt.y }
        : undefined;
      // Alcance máximo do AoE da arma (campo `alcance` em metros, quando fixo).
      const alc = mainOmniEntity?.alcance;
      const maxRangeMeters =
        alc && alc.tipo === 'fixo' && Number.isFinite(alc.valor) && alc.valor > 0
          ? alc.valor
          : undefined;
      const template = await requestAoEPlacement({
        kind: weaponAoE.kind,
        sizeMeters: weaponAoE.sizeMeters,
        widthMeters: weaponAoE.widthMeters,
        sourceLabel: `${c.name} · ${mainWeapon.name}`,
        color: '#ff5577',
        originWorld,
        maxRangeMeters,
      });
      if (!template) {
        addLog('combat', `🚫 ${c.name} cancelou o posicionamento da área (${mainWeapon.name}).`);
        setPhase('idle');
        return;
      }
      const hitIds = findEntitiesInTemplate(template, mapEntities);
      const hitChars = hitIds
        .map((id) => mapEntities[id])
        .filter((e) => !!e?.characterId)
        .map((e) => characters.find((ch) => ch.id === e!.characterId))
        .filter((ch): ch is Character => !!ch && ch.id !== c.id);

      // Uma rolagem de dano via física 3D, aplicada a todos.
      const ability = pickAttackAbility(c, mainWeapon);
      const abMod = getAbilityMod(c, ability);
      const { rolls, total } = await rollDiceCom(c.id, mainWeapon.damage ?? "0");
      const damageTotal = Math.max(0, total + abMod);
      const dmgType = mainWeapon.damageType as any;
      const targetsLabel =
        hitChars.length === 0
          ? 'nenhum alvo'
          : hitChars.map((t) => t.name).join(', ');
      addLog(
        'combat',
        `🎯 ${c.name} ataca em área (${mainWeapon.name} · ${weaponAoE.kind} ${weaponAoE.sizeMeters}m) → ${targetsLabel}`,
      );
      addLog(
        'combat',
        `   💥 Dano: ${damageTotal} (${mainWeapon.damage}${abMod ? (abMod > 0 ? '+' : '') + abMod : ''} = ${rolls.join('+')}${abMod ? (abMod > 0 ? '+' : '') + abMod : ''})`,
      );
      for (const target of hitChars) {
        await applyDamage(target.id, damageTotal, dmgType, { attackerId: c.id, source: 'arma', isMelee: mainWeapon.range === 'melee' });
      }
      setPhase('done');
    } catch (err) {
      console.error('[AoE attack] erro:', err);
      setPhase('idle');
    }
  };


  // Anima e revela o 2º d20 em vantagem/desvantagem, então finaliza.
  const handleRollSecondD20 = async () => {
    if (phase !== 'await-second-d20' || !pendingResult) return;
    const result = pendingResult;
    const meta = pendingRerollMeta ?? { isReroll: false };
    const second = result.attackRolls[1];
    setPhase('rolling-second-d20');
    setTickD20Pair([result.attackRolls[0], second]);
    await finalizeAttackReveal(result, meta.isReroll);
  };

  // Finaliza o reveal do ataque: registra log, expõe acerto/erro e move
  // para await-dmg ou done. Comum aos fluxos d20 único / dual.
  const finalizeAttackReveal = async (result: AttackResult, isReroll: boolean) => {
    setTickD20(result.natural);
    if (result.attackRolls.length > 1) {
      setTickD20Pair([result.attackRolls[0], result.attackRolls[1]]);
    } else {
      setTickD20Pair(null);
    }
    // Revela o ataque, mas SEM o dano ainda (zera para não vazar).
    const hitOnlyResult: AttackResult = result.hit
      ? { ...result, damageTotal: 0, damageRolls: [] }
      : result;
    setLastResult(hitOnlyResult);
    const targetLabel = target ? target.name : 'alvo';
    const verdict = result.criticalFail
      ? '💀 Falha crítica'
      : result.critical
        ? `💥 Crítico! (vs ${targetLabel})`
        : result.hit
          ? `✅ Acerto (vs ${targetLabel})`
          : `❌ Erro (vs ${targetLabel})`;
    const rollLabel = result.rollMode === 'disadvantage'
      ? `2d20 (${result.attackRolls.join(', ')}) → menor ${result.natural}`
      : result.rollMode === 'advantage'
        ? `2d20 (${result.attackRolls.join(', ')}) → maior ${result.natural}`
        : `d20 ${result.natural}`;
    const weaponName = mainWeapon?.name ?? '—';
    const prefix = isReroll ? `🔁 ${c.name} re-rolou o ataque` : `🗡️ ${c.name} atacou com ${weaponName}`;
    addLog('combat', `${prefix}: ${rollLabel} · ${verdict}`);
    if (result.notes.length) addLog('combat', `   ↳ ${result.notes.join(' · ')}`);
    if (result.hit && result.critical) checarRenovacaoCritico(true, target?.name);
    registrarAtaqueCompensar(useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c, target?.id, result.hit, mainWeapon?.range === 'melee');

    setPendingRerollMeta(null);
    setFirstD20Revealed(null);

    if (!result.hit) {
      if (mainWeapon) notificarResultadoAtaque(c.id, target?.id, mainWeapon, result, metadadosAtaqueRef.current);
      setPendingResult(null);
      setPhase('done');
      return;
    }
    // Aguarda o player rolar o dano manualmente.
    setPendingResult(result);
    setPhase('await-dmg');
  };

  // ─── Rolar Dano (fase 2, manual) ───────────────────────────────────────────
  const handleRollDamage = async () => {
    if (phase !== 'await-dmg' || !pendingResult || !mainWeapon) return;
    let result = pendingResult;
    setRuptureTargetId(null);
    setPhase('rolling-dmg');
    if (result.damageNeedsReroll) {
      const rolled = await rollDiceCom(c.id, result.damageDice);
      result = {
        ...result,
        damageTotal: rolled.total + (result.damageFlatBonus ?? 0),
        damageRolls: rolled.rolls,
        damageNeedsReroll: false,
      };
    }
    setTickDmg(result.damageTotal);
    setLastResult(result);
    setPendingResult(null);
    addLog(
      'combat',
      `   💥 Dano: ${result.damageTotal} (${result.damageDice}${result.damageType ? ' ' + result.damageType : ''})`,
    );
    notificarResultadoAtaque(c.id, target?.id, mainWeapon, result, metadadosAtaqueRef.current);
    const g = golpeRollRef.current;
    golpeRollRef.current = null;
    if (g?.sel.penetrante) addLog('combat', `   ↳ Penetrante: ignora ${penetranteRD(c)} de RD.`);
    if (devRdRef.current > 0) addLog('combat', `   ↳ Postura da Devastação: ignora ${devRdRef.current} de RD.`);
    const rdIgn = rdIgnoradaAtaque(!!g?.sel.penetrante, devRdRef.current);
    if (mainWeapon && arremessosRdIgnorada(useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c, mainWeapon, turnInfo) > 0) {
      addLog('combat', `   ↳ Arremessos Potentes: ignora ${arremessosRdIgnorada(useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c, mainWeapon, turnInfo)} de RD.`);
    }
    try {
      if (target && result.damageTotal > 0) {
        await applyDamage(target.id, result.damageTotal, (result.damageType ?? undefined) as never, {
          attackerId: c.id, source: 'arma', isMelee: mainWeapon.range === 'melee', rdIgnore: rdIgn,
          attack: { ...metadadosAtaqueRef.current, critical: result.critical, criticalFail: result.criticalFail },
        });
      }
      if (isAetherisWeapon && target) {
        const { resolverAcertoBaculoAetheris } = await import('@/lib/baculoAetherisCombat');
        const followup = await resolverAcertoBaculoAetheris(c.id, target.id, c.mainHandWeaponInstanceId ?? mainWeapon.id, result.critical);
        if (followup.rupturaPodeSerOferecida) setRuptureTargetId(target.id);
      }
      if (g?.sel.impactante && g.target) await empurrarImpactante(g.target, result.damageTotal);
      if (target && result.damageTotal > 0) await explosaoDragao(target, result.damageTotal, result.damageType ?? undefined);
    } finally {
      // A rolagem só termina depois que os prompts de reação ao dano forem resolvidos.
      setPhase('done');
    }
  };

  /** Ataque completo fora do fluxo principal (Técnicas de Avanço): rola, aplica dano e registra. */
  const ataqueExtra = async (alvo: Character, arma: Weapon): Promise<AttackResult | null> => {
    const eu = useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c;
    const kind: AttackKind = arma.range === 'melee' ? 'melee' : 'ranged';
    const def = computeTotalDefense(alvo, { items, omniInventory: omniInventoryList, omniEntidadesMap, omniRuntimeEffects: omniRuntimeEffectsList }, kind);
    const ids = new Set((alvo.activeConditions ?? []).map((x) => (x as { conditionId?: string }).conditionId));
    const furtivo = escondidoDe(eu, alvo.id);
    const unaware = ids.has('desprevenido') || ids.has('agarrado') || ids.has('atordoado') || escondidoDe(eu, alvo.id);
    const ctx = buildAttackContext({
      attacker: eu, weapon: arma, targetDefense: def, targetId: alvo.id,
      semRecursao: true,
      situation: {
        previousAttacksThisTurn: eu.attacksThisTurn ?? 0, previousMissed: eu.lastAttackHit === false,
        targetUnaware: unaware, targetProne: ids.has('caido'), preferredAbility: pickAttackAbility(eu, arma),
      },
      trainedRanges: [
        ...(c.meleeTrained ? (['melee'] as const) : []),
        ...(c.rangedTrained ? (['ranged', 'thrown'] as const) : []),
      ],
    });
    let r: AttackResult;
    try { r = await rollAttack(ctx); } catch (e) { console.error('[AttackPanel] ataque extra falhou:', e); return null; }
    notificarResultadoAtaque(c.id, alvo.id, arma, r);
    recordAttackResult(c.id, r.hit);
    revelarPara(c.id, alvo.id);
    const verdict = r.criticalFail ? '💀 falha crítica' : r.critical ? '💥 CRÍTICO' : r.hit ? '✅ acerto' : '❌ erro';
    const defesaLabel = !isMaster && alvo.category !== 'PLAYER' ? 'Defesa do alvo' : `Def ${def}`;
    addLog('combat', `🗡️ ${c.name} ataca ${alvo.name} com ${arma.name}: d20 ${r.natural} · total ${r.attackTotal} vs ${defesaLabel} → ${verdict}${r.hit ? ` · dano ${r.damageTotal} (${r.damageDice})` : ''}`);
    if (r.hit && r.damageTotal > 0) {
      await applyDamage(alvo.id, r.damageTotal, (r.damageType ?? undefined) as never, {
        attackerId: c.id, source: 'arma', isMelee: arma.range === 'melee', rdIgnore: arremessosRdIgnorada(eu, arma, turnInfo),
        attack: { critical: r.critical, criticalFail: r.criticalFail, isSneak: furtivo, isOpportunity: false },
      });
    }
    if (r.hit && r.critical) checarRenovacaoCritico(true, alvo.name);
    registrarAtaqueCompensar(useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c, alvo.id, r.hit, arma.range === 'melee');
    return r;
  };

  // Fortitude do alvo já com a penalidade de Flanqueador Superior (−2 em TRs).
  const trFortitude = (alvo: Character): number => {
    const ms = useMapStore.getState();
    return (
      fortitudeMod(alvo) +
      penalidadeTRFlanqueado(alvo, useCharacterStore.getState().characters, ms.entities as never, ms.gridConfig as never)
    );
  };

  // Postura da Devastação: acumula acertos no mesmo alvo; trocar de alvo zera.
  const registrarDevastacao = (alvoId: string, acertou: boolean) => {
    const eu = useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c;
    const patch = devastacaoPatch(eu, alvoId, acertou);
    if (!patch) return;
    const trocou = eu.devastacao?.alvoId && eu.devastacao.alvoId !== alvoId;
    useCharacterStore.getState().updateCharacter(c.id, patch);
    const n = patch.devastacao?.acertos ?? 0;
    addLog('combat', `💢 Postura da Devastação: ${trocou ? 'trocou de alvo — acúmulo zerado. ' : ''}${n} acerto(s) acumulado(s) (+${n} acerto, ignora ${n * 2} RD no próximo golpe).`);
  };

  // Postura da Tempestade: acerto → Fortitude ou Caído; alvo já Caído → Imóvel até o começo do seu turno.
  const tempestadeGolpe = async (alvo: Character) => {
    const eu = useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c;
    if (posturaAtiva(eu) !== 'tempestade') return;
    const vivo = useCharacterStore.getState().characters.find((x) => x.id === alvo.id) ?? alvo;
    const jaCaido = (vivo.activeConditions ?? []).some((x) => x.conditionId === 'caido');
    const cd = specDCFor(eu);
    const d20 = await rollD20Com(vivo.id);
    const mod = trFortitude(vivo);
    const passou = d20 + mod >= cd;
    const efeito = jaCaido ? 'fica Imóvel até o começo do turno de ' + eu.name : 'fica Caído';
    addLog('combat', `🌩️ Postura da Tempestade: ${vivo.name} Fortitude d20 ${d20}${mod >= 0 ? '+' : ''}${mod} vs CD ${cd} → ${passou ? 'passou' : `falhou — ${efeito}`}.`);
    if (passou) return;
    const def = ALL_CONDITIONS.find((x) => x.id === (jaCaido ? 'imovel' : 'caido'));
    if (!def) return;
    useCharacterStore.getState().addCondition(vivo.id, {
      id: jaCaido ? `${TEMPESTADE_IMOVEL_PREFIX}${eu.id}:${Date.now()}` : `tempestade-caido:${Date.now()}`,
      conditionId: def.id, name: def.name, icon: def.icon,
      remainingTurns: -1, remainingRounds: -1, sourceCharName: eu.name,
    });
  };

  // Postura do Dragão: inimigos a 1,5 m do alvo fazem Fortitude ou sofrem metade do dano.
  const explosaoDragao = async (alvo: Character, dano: number, tipo?: string) => {
    const eu = useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c;
    if (posturaAtiva(eu) !== 'dragao') return;
    const meio = Math.floor(dano / 2);
    if (meio <= 0) return;
    const ms = useMapStore.getState();
    const ents = Object.values(ms.entities ?? {});
    const tEnt = ents.find((e) => e?.characterId === alvo.id);
    if (!tEnt) return;
    const cell = ms.gridConfig?.dpi || 70;
    const cd = specDCFor(eu);
    const todos = useCharacterStore.getState().characters;
    for (const e of ents) {
      if (!e?.characterId || e.characterId === alvo.id || e.characterId === c.id) continue;
      const ch = todos.find((x) => x.id === e.characterId);
      if (!ch || (ch.category !== 'INIMIGO' && ch.category !== 'NPC')) continue;
      const casas = Math.max(Math.abs(e.x - tEnt.x), Math.abs(e.y - tEnt.y)) / cell;
      if (casas > 1.01) continue;
      const d20 = await rollD20Com(ch.id);
      const mod = trFortitude(ch);
      const passou = d20 + mod >= cd;
      addLog('combat', `🐉 Postura do Dragão: ${ch.name} Fortitude d20 ${d20}${mod >= 0 ? '+' : ''}${mod} vs CD ${cd} → ${passou ? 'passou' : `falhou — sofre ${meio} de dano`}.`);
      if (!passou) await applyDamage(ch.id, meio, tipo as never, { attackerId: c.id, source: 'arma', tags: ['__dragao'] });
    }
  };

  // Renovação pelo Sangue (Nv 6): crítico em inimigo recupera 1 PE.
  // (Reduzir o alvo a 0 PV é tratado em applyDamage, que conhece o HP final.)
  const checarRenovacaoCritico = (critico: boolean, alvoNome?: string) => {
    if (!critico || !renovacaoSangueAtiva(c)) return;
    const fresco = useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c;
    const ok = aplicarRenovacao(fresco, useCharacterStore.getState().updateCharacter);
    if (ok) addLog('combat', `🩸 Renovação pelo Sangue: crítico em ${alvoNome ?? 'inimigo'} — ${c.name} recupera 1 PE.`);
  };

  const aplicarSangramento = (alvo: Character, nivel: number) => {
    const medio = nivel >= 2;
    const cd = specDCFor(c);
    useCharacterStore.getState().addCondition(alvo.id, {
      id: `sangramento-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      conditionId: 'sangramento',
      name: medio ? 'Sangramento Médio' : 'Sangramento Leve',
      icon: '🩸',
      remainingTurns: -1,
      remainingRounds: -1,
      sourceCharName: c.name,
      endCD: cd,
    } as never);
    addLog('combat', `🩸 Sanguinário: ${alvo.name} sofre sangramento ${medio ? 'médio' : 'leve'} (CD ${cd}).`);
  };

  const empurrarImpactante = async (alvo: Character, dano: number) => {
    const cd = specDCFor(c);
    const conMod = trFortitude(alvo);
    const d20 = await rollD20Com(alvo.id);
    const passou = d20 + conMod >= cd;
    const metros = impactanteMeters(dano, passou);
    addLog('combat', `💢 Impactante: ${alvo.name} Fortitude d20 ${d20}${conMod >= 0 ? '+' : ''}${conMod} vs CD ${cd} → ${passou ? 'passou (metade)' : 'falhou'} · empurrado ${metros.toFixed(1).replace('.', ',')} m.`);
    if (metros <= 0) return;
    if (imuneMovimentoForcado(alvo)) { addLog('combat', `⛰️ Postura da Terra: ${alvo.name} é imune a movimento forçado.`); return; }
    const ms = useMapStore.getState();
    const ents = Object.values(ms.entities ?? {});
    const atk = ents.find((e) => e?.characterId === c.id);
    const tgt = ents.find((e) => e?.characterId === alvo.id);
    if (!atk || !tgt) return;
    const pxPerM = (ms.gridConfig?.dpi || 70) / (ms.gridConfig?.metersPerCell || 1.5);
    const dx = tgt.x - atk.x, dy = tgt.y - atk.y;
    const len = Math.hypot(dx, dy) || 1;
    ms.updateEntity(tgt.id, { x: tgt.x + (dx / len) * metros * pxPerM, y: tgt.y + (dy / len) * metros * pxPerM });
  };


  // ─── Arte: Arremesso Ágil (ação livre após acertar ataque CaC) ─────────────
  const handleArremessoAgil = async () => {
    if (!lastResult?.hit || phase !== 'done') return;
    const alvo2 = characters.find((x) => x.id === arremessoTargetId);
    const arma = arremessoWeapons[0]?.weapon;
    if (!arma) { addLog('combat', `🚫 Arremesso Ágil: nenhuma arma de arremesso no inventário.`); return; }
    if (!alvo2) { addLog('combat', `🚫 Arremesso Ágil: escolha o segundo alvo.`); return; }
    if (alvo2.id === targetId) { addLog('combat', `🚫 Arremesso Ágil: o segundo alvo deve ser diferente do primeiro.`); return; }
    const spend = spendPreparo(c.id, 1);
    if (!spend.ok) { addLog('combat', `🚫 ${c.name}: ${spend.reason}`); return; }
    const ability2 = pickAttackAbility(c, arma);
    const def2 = computeTotalDefense(
      alvo2,
      { items, omniInventory: omniInventoryList, omniEntidadesMap, omniRuntimeEffects: omniRuntimeEffectsList },
      'ranged',
    );
    const ctx2 = buildAttackContext({
      attacker: c, weapon: arma, targetDefense: def2, targetId: alvo2.id,
      semRecursao: true,
      situation: { preferredAbility: ability2, attackerIsGrappled },
      trainedRanges: [
        ...(c.meleeTrained ? (['melee'] as const) : []),
        ...(c.rangedTrained ? (['ranged', 'thrown'] as const) : []),
      ],
    });
    const r = await rollAttack(ctx2);
    notificarResultadoAtaque(c.id, alvo2.id, arma, r);
    addLog(
      'combat',
      `🎯 Arremesso Ágil: ${c.name} ataca ${alvo2.name} com ${arma.name} (ação livre): d20 ${r.natural} · total ${r.attackTotal} → ${r.critical ? '💥 CRÍTICO' : r.hit ? '✅ acerto' : '❌ erro'}${r.hit ? ` · dano ${r.damageTotal} (${r.damageDice})` : ''}`,
    );
    recordAttackResult(c.id, r.hit);
    if (r.hit && r.damageTotal > 0) {
      const ign = arremessosRdIgnorada(useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c, arma, turnInfo);
      await applyDamage(alvo2.id, r.damageTotal, (r.damageType ?? undefined) as never, { attackerId: c.id, source: 'arma', isMelee: false, rdIgnore: ign, attack: { critical: r.critical, criticalFail: r.criticalFail, isOpportunity: false } });
    }
    if (r.hit && r.critical) checarRenovacaoCritico(true, alvo2.name);
    registrarDevastacao(alvo2.id, r.hit);
    if (r.hit) void tempestadeGolpe(alvo2);
    setArremessoTargetId('');
  };

  // ─── Disparos Sincronizados (Especialista nv 2) ───────────────────────────
  const sincroCheck = podeSincronizar(c, mainWeapon, offWeapon);
  const temDisparos = hasDisparosSincronizados(c);
  const handleDisparosSincronizados = async () => {
    if (phase === 'rolling-hit' || phase === 'rolling-dmg') return;
    const chk = podeSincronizar(c, mainWeapon, offWeapon);
    if (!chk.ok || !mainWeapon || !offWeapon) { addLog('combat', `🚫 Disparos Sincronizados: ${chk.reason}`); return; }
    if (!target) { addLog('combat', `🚫 Disparos Sincronizados: escolha o alvo.`); return; }
    const ms = useMapStore.getState();
    for (const arma of [mainWeapon, offWeapon]) {
      const bloqueio = checkWeaponRange(c.id, target.id, arma, ms.entities, ms.gridConfig, meleeRangeBonus, mapIdentities, posturaAlcanceMult(c));
      if (bloqueio) { addLog('combat', `🚫 Disparos Sincronizados (${arma.name}): ${bloqueio}`); return; }
    }
    setPhase('rolling-hit');
    const base = {
      twoHanded: false, targetUnaware, targetProne,
      previousAttacksThisTurn: previousAttacks, previousMissed,
      targetHasAuraEmbacada, attackerConcentratedAura, attackerIsGrappled,
    };
    const trained = [
      ...(c.meleeTrained ? (['melee'] as const) : []),
      ...(c.rangedTrained ? (['ranged', 'thrown'] as const) : []),
    ];
    const tiros: { arma: Weapon; r: AttackResult }[] = [];
    try {
      for (const arma of [mainWeapon, offWeapon]) {
        const ctxT = buildAttackContext({
          attacker: c, weapon: arma, targetDefense: targetDef, targetId: target?.id,
          semRecursao: tiros.length > 0,
          situation: { ...base, preferredAbility: pickAttackAbility(c, arma) },
          trainedRanges: trained,
        });
        const r = await rollAttack(ctxT);
        tiros.push({ arma, r });
        addLog('combat', `🔫 Disparos Sincronizados (${arma.name}): d20 ${r.natural} · total ${r.attackTotal} → ${r.criticalFail ? '💀 falha crítica' : r.critical ? '💥 CRÍTICO' : r.hit ? '✅ acerto' : '❌ erro'}`);
        recordAttackResult(c.id, r.hit);
      }
    } catch (err) {
      console.error('[Disparos Sincronizados] erro:', err);
      setPhase('idle');
      return;
    }
    const ambos = tiros.every((t) => t.r.hit);
    registrarDevastacao(target.id, ambos);
    if (!ambos) {
      addLog('combat', `   ↳ Um dos tiros errou — os disparos não se sincronizam e nenhum dano é causado.`);
      setLastResult({ ...tiros[0].r, hit: false, damageTotal: 0, damageRolls: [] });
      setPhase('done');
      return;
    }
    const total = tiros.reduce((a, t) => a + t.r.damageTotal, 0);
    const tipo = tiros[0].r.damageType ?? undefined;
    addLog('combat', `   💥 Dano combinado: ${total} (${tiros.map((t) => `${t.arma.name} ${t.r.damageTotal}`).join(' + ')}) — RD e resistências aplicadas uma única vez.`);
    const rdIgn = rdIgnoradaAtaque(false);
    setPhase('rolling-dmg');
    try {
      await applyDamage(target.id, total, tipo as never, { attackerId: c.id, source: 'arma', isMelee: false, rdIgnore: rdIgn, attack: { critical: tiros.some((t) => t.r.critical), criticalFail: false, isSneak: escondidoDe(c, target.id), isOpportunity: false } });
      if (tiros.some((t) => t.r.critical)) checarRenovacaoCritico(true, target.name);
      await tempestadeGolpe(target);
      await explosaoDragao(target, total, tipo);
      setLastResult({ ...tiros[0].r, damageTotal: total, damageRolls: tiros.flatMap((t) => t.r.damageRolls) });
    } finally {
      setPhase('done');
    }
  };

  const handleRerollDamage = async () => {
    if (!mainWeapon || !lastResult || !lastResult.canRerollDamage) return;
    if (isLancaWeapon) {
      const rolled = await rollDiceCom(c.id, lastResult.damageDice);
      const damageTotal = rolled.total + (lastResult.damageFlatBonus ?? 0);
      if (damageTotal > lastResult.damageTotal) {
        setLastResult({ ...lastResult, damageTotal, damageRolls: rolled.rolls, canRerollDamage: false });
        addLog('combat', `🎲 Ataque Infalível: novo dano da Lança ${damageTotal} (substituiu ${lastResult.damageTotal}).`);
        if (target) await applyDamage(target.id, damageTotal - lastResult.damageTotal, (lastResult.damageType ?? undefined) as never, {
          attackerId: c.id, source: 'arma', isMelee: true, ignoresRD: true,
          attack: { ...metadadosAtaqueRef.current, critical: lastResult.critical, criticalFail: lastResult.criticalFail },
        });
      } else {
        setLastResult({ ...lastResult, canRerollDamage: false });
        addLog('combat', `🎲 Ataque Infalível: dano original mantido (${lastResult.damageTotal} ≥ ${damageTotal}).`);
      }
      return;
    }
    const ability = pickAttackAbility(c, mainWeapon);
    const ctx = buildAttackContext({
      attacker: c, weapon: mainWeapon, targetDefense: targetDef,
      situation: {
        twoHanded: usingTwoHanded || twoHanded,
        targetUnaware, targetProne,
        previousAttacksThisTurn: previousAttacks, previousMissed,
        preferredAbility: ability,
        targetHasAuraEmbacada,
        attackerConcentratedAura,
        attackerIsGrappled,
      },
      trainedRanges: [
        ...(c.meleeTrained ? (['melee'] as const) : []),
        ...(c.rangedTrained ? (['ranged', 'thrown'] as const) : []),
      ],
    });
    const r2 = await rollAttack(ctx);
    if (r2.damageTotal > lastResult.damageTotal) {
      setLastResult({ ...lastResult, damageTotal: r2.damageTotal, damageRolls: r2.damageRolls, canRerollDamage: false });
      addLog('combat', `🎲 Ataque Infalível: novo dano ${r2.damageTotal} (substituiu ${lastResult.damageTotal}).`);
      // O dano original já foi aplicado: aplica só a diferença (sem RD de novo).
      if (target) {
        await applyDamage(target.id, r2.damageTotal - lastResult.damageTotal, (lastResult.damageType ?? undefined) as never, {
          attackerId: c.id, source: 'arma', isMelee: mainWeapon.range === 'melee', ignoresRD: true,
          attack: { ...metadadosAtaqueRef.current, critical: lastResult.critical, criticalFail: lastResult.criticalFail },
        });
      }
    } else {
      setLastResult({ ...lastResult, canRerollDamage: false });
      addLog('combat', `🎲 Ataque Infalível: dano original mantido (${lastResult.damageTotal} ≥ ${r2.damageTotal}).`);
    }
  };

  // ─── 🍀 Favorecido pela Sorte: re-roll PÓS-resultado ───────────────────────
  // Gasta 1 ponto de Sorte para re-rolar o d20 do ATAQUE já feito e ficar
  // com o MAIOR valor. Indisponível em falha crítica. Pode repetir enquanto
  // houver pontos. Aplica o novo natural e re-resolve hit/critico/dano se mudar.
  const handleLuckRerollAttack = async () => {
    if (luckRollInFlightRef.current) return;
    if (!lastResult || !mainWeapon) return;
    if (lastResult.criticalFail) return;
    if ((c.luckCurrent ?? 0) <= 0) return;
    if (phase !== 'await-dmg' && phase !== 'done') return;
    if (isLancaWeapon && lastResult.hit && phase === 'done') {
      addLog('combat', '🚫 Após o dano da Lança ser aplicado, a rolagem de ataque não pode ser reaberta sem reverter as consequências já resolvidas.');
      return;
    }

    luckRollInFlightRef.current = true;
    const res = spendLuck(c.id);
    if (!res.ok) {
      luckRollInFlightRef.current = false;
      addLog('combat', `⚠️ ${res.reason ?? 'Não foi possível gastar Sorte.'}`);
      return;
    }

    // Re-roll do d20 puro (não rerola contexto inteiro — preserva mods já calculados).
    let newNat: number;
    try {
      newNat = await rollD20Com(c.id);
    } finally {
      luckRollInFlightRef.current = false;
    }
    const oldNat = lastResult.natural;
    const keptNat = Math.max(oldNat, newNat);
    const kept = keptNat === oldNat ? 'antigo' : 'novo';

    addLog(
      'combat',
      `🍀 ${c.name} gastou 1 Sorte: re-rolou d20 (${oldNat} → ${newNat}) → mantém ${keptNat} (${kept}). Restam ${res.remaining}.`,
    );

    if (keptNat === oldNat) {
      // Manteve o antigo: nada muda no resultado.
      return;
    }

    // Recalcula com o novo natural — recria contexto e força o d20 manualmente.
    const ability = pickAttackAbility(c, mainWeapon);
    const lancaSaved = isLancaWeapon && lancaAttackResolutionRef.current?.key === lancaKey
      ? lancaAttackResolutionRef.current
      : null;
    const lancaSavedMarks = lancaSaved && lancaSaved.before.targetId === target?.id ? lancaSaved.before.marks : 0;
    const lancaSavedEffects = lancaSaved
      ? lancaAttackEffects(lancaSavedMarks, lancaSaved.before.fractureAvailable, lancaSaved.mode)
      : null;
    const rerollWeapon = lancaSaved
      ? {
          ...mainWeapon,
          omniDamageFormula: lancaDamageFormula(resolveWeaponDamage(mainWeapon, usingTwoHanded || twoHanded) ?? '1d10', lancaSaved.mode, lancaSavedEffects?.fractureDice ?? 0),
          omniDamageType: 'Pf',
        }
      : mainWeapon;
    const ctx = buildAttackContext({
      attacker: c, weapon: rerollWeapon, targetDefense: targetDef - (lancaSavedEffects?.defenseIgnore ?? 0),
      situation: {
        twoHanded: usingTwoHanded || twoHanded,
        targetUnaware, targetProne,
        previousAttacksThisTurn: previousAttacks, previousMissed,
        preferredAbility: ability,
        targetHasAuraEmbacada,
        attackerConcentratedAura,
        attackerIsGrappled,
        hitBonusExtra: lancaSavedEffects?.hitBonus,
        critBonusExtra: lancaSavedEffects?.critRangeBonus,
        forceCritical: !!lancaSaved && !!getAutoCritFromConditions(target, attackKind)?.autoCrit,
      },
      trainedRanges: [
        ...(c.meleeTrained ? (['melee'] as const) : []),
        ...(c.rangedTrained ? (['ranged', 'thrown'] as const) : []),
      ],
    });
    // Recompõe modificadores totais (idênticos ao roll original).
    const modsTotal = lastResult.modifiers.reduce((a, m) => a + m.value, 0);
    const newAttackTotal = keptNat + modsTotal;
    const auto = target ? getAutoCritFromConditions(target, attackKind) : null;
    const critThreshold = lastResult.criticalThreshold ?? mainWeapon.critRange ?? 20;
    const newCritical = !!auto?.autoCrit || keptNat >= critThreshold;
    const newHit = !!auto?.autoHit || newAttackTotal >= ctx.targetDefense || newCritical;

    // Atualiza memória de turno (substitui).
    recordAttackResult(c.id, newHit, { replaceLast: true });
    if (lancaSaved && target && lancaKey) {
      const resolved = resolveLancaAttack(lancaSaved.before, {
        targetId: target.id,
        mode: lancaSaved.mode,
        hit: newHit,
        critical: newCritical,
        fractureEligible: lancaSaved.fractureEligible,
      });
      useCombatStore.getState().setLancaRecord(lancaSaved.key, resolved);
      lancaAttackResolutionRef.current = { ...lancaSaved, fractureEligible: lancaSaved.fractureEligible };
      if (lancaSaved.mode === 'sentence') {
        setLancaSentenceSuppression(target.id, c, c.mainHandWeaponInstanceId ?? lancaKey ?? mainWeapon.id, newHit);
      }
    }

    // Atualiza UI: novo natural/total/hit/critical, zera dano (jogador rola de novo se acertou).
    const rerolledAttackResult = {
      ...lastResult,
      natural: keptNat,
      attackTotal: newAttackTotal,
      hit: newHit,
      critical: newCritical,
      criticalThreshold: critThreshold,
      criticalFail: false,
      ...(newHit ? { damageTotal: 0, damageRolls: [], damageNeedsReroll: true } : { damageTotal: 0, damageRolls: [], damageNeedsReroll: false }),
      notes: [...lastResult.notes, `🍀 Sorte: d20 re-rolado (${oldNat}→${newNat}, mantido ${keptNat})`],
    };
    setLastResult(rerolledAttackResult);
    if (newHit) {
      // Volta a esperar o jogador rolar o dano.
      setPendingResult(rerolledAttackResult);
      setPhase('await-dmg');
    } else {
      setPhase('done');
    }
  };

  // 🍀 Re-roll do DANO usando 1 ponto de Sorte: re-rola os dados de dano
  // (mesma notação) e mantém o MAIOR total. Disponível após acertar.
  const handleLuckRerollDamage = async () => {
    if (luckRollInFlightRef.current) return;
    if (!lastResult || !mainWeapon || !lastResult.hit) return;
    if ((c.luckCurrent ?? 0) <= 0) return;
    if (phase !== 'done') return;

    luckRollInFlightRef.current = true;
    const res = spendLuck(c.id);
    if (!res.ok) {
      luckRollInFlightRef.current = false;
      addLog('combat', `⚠️ ${res.reason ?? 'Não foi possível gastar Sorte.'}`);
      return;
    }

    if (isLancaWeapon) {
      let rolled: { rolls: number[]; total: number };
      try { rolled = await rollDiceCom(c.id, lastResult.damageDice); }
      finally { luckRollInFlightRef.current = false; }
      const damageTotal = rolled.total + (lastResult.damageFlatBonus ?? 0);
      const oldDmg = lastResult.damageTotal;
      const keep = damageTotal > oldDmg;
      addLog('combat', `🍀 ${c.name} gastou 1 Sorte: re-rolou dano da Lança (${oldDmg} vs ${damageTotal}) → mantém ${Math.max(oldDmg, damageTotal)}. Restam ${res.remaining}.`);
      if (keep) {
        setLastResult({ ...lastResult, damageTotal, damageRolls: rolled.rolls, notes: [...lastResult.notes, `🍀 Sorte: dano re-rolado (${oldDmg}→${damageTotal})`] });
        if (target) await applyDamage(target.id, damageTotal - oldDmg, (lastResult.damageType ?? undefined) as never, {
          attackerId: c.id, source: 'arma', isMelee: true, ignoresRD: true,
          attack: { ...metadadosAtaqueRef.current, critical: lastResult.critical, criticalFail: lastResult.criticalFail },
        });
      }
      return;
    }
    const ability = pickAttackAbility(c, mainWeapon);
    const ctx = buildAttackContext({
      attacker: c, weapon: mainWeapon, targetDefense: targetDef,
      situation: {
        twoHanded: usingTwoHanded || twoHanded,
        targetUnaware, targetProne,
        previousAttacksThisTurn: previousAttacks, previousMissed,
        preferredAbility: ability,
        targetHasAuraEmbacada, attackerConcentratedAura, attackerIsGrappled,
      },
      trainedRanges: [
        ...(c.meleeTrained ? (['melee'] as const) : []),
        ...(c.rangedTrained ? (['ranged', 'thrown'] as const) : []),
      ],
    });
    let r2: AttackResult;
    try {
      r2 = await rollAttack(ctx);
    } finally {
      luckRollInFlightRef.current = false;
    }
    const oldDmg = lastResult.damageTotal;
    const keep = r2.damageTotal > oldDmg;
    addLog(
      'combat',
      `🍀 ${c.name} gastou 1 Sorte: re-rolou dano (${oldDmg} vs ${r2.damageTotal}) → mantém ${Math.max(oldDmg, r2.damageTotal)}. Restam ${res.remaining}.`,
    );
    if (keep) {
      setLastResult({
        ...lastResult,
        damageTotal: r2.damageTotal,
        damageRolls: r2.damageRolls,
        notes: [...lastResult.notes, `🍀 Sorte: dano re-rolado (${oldDmg}→${r2.damageTotal})`],
      });
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  const ability = mainWeapon ? pickAttackAbility(c, mainWeapon) : null;
  const abilityMod = ability ? getAbilityMod(c, ability) : 0;

  const selecionarAlvoNoMapa = async (atacar = false) => {
    if (!mainWeapon) return;
    setMirando(true); setTargetId('');
    try {
      const ids = await pedirAlvoMapa({ usuarioId: c.id, label: mainWeapon.name,
        maxRangeMeters: (weaponRangeM ?? 0) + longoM + (temArtes && arteInvestida ? investidaMoveMeters(c) : 0),
        medicao: 'borda',
        aceita: alvo => alvo.id !== c.id });
      if (ids) {
        const atual = useCharacterStore.getState().characters.find(ch => ch.id === c.id);
        if (atual?.mainHandWeaponName !== c.mainHandWeaponName) { addLog('combat', 'A arma mudou durante a seleção. Selecione o ataque novamente.'); return; }
        ataqueAposMira.current = atacar; setTargetId(ids[0]);
      }
    } catch (e) { addLog('combat', `❌ ${e instanceof Error ? e.message : 'Não foi possível selecionar o alvo.'}`); }
    finally { setMirando(false); }
  };
  useEffect(() => {
    if (!mirando && targetId && ataqueAposMira.current) {
      ataqueAposMira.current = false; void handleRoll();
    }
  }, [mirando, targetId]);

  const contadoresArma = (nome: string | null | undefined) => {
    if (!nome) return null;
    const candidatas = omniInventoryList.filter(inv => inv.ownerId === c.id && inv.entity.nome === nome);
    const instancia = candidatas.find(inv => inv.isEquipped) ?? candidatas[0];
    if (!instancia) { const legado = items.find(i => i.name === nome && (i.assignedTo ?? []).includes(c.id)); return legado ? <SoltarItemButton charId={c.id} itemId={legado.id} legado /> : null; }
    return <><ContadoresEquipamento charId={c.id} entidade={omniEntidadesMap[instancia.entity.id] ?? instancia.entity} /><SoltarItemButton charId={c.id} itemId={instancia.instanceId} /></>;
  };

  const gastarAcaoLanca = (custoPe: number): boolean => {
    const fresh = useCharacterStore.getState().characters.find((character) => character.id === c.id);
    if (!fresh) return false;
    const cost = calcularCustoLanca(fresh.actionsCurrent, fresh.tempPE, fresh.peCurrent, custoPe);
    if (!cost.ok) { addLog('combat', `🚫 ${cost.reason}`); return false; }
    useCharacterStore.getState().updateCharacter(c.id, {
      actionsCurrent: cost.actionsCurrent,
      tempPE: cost.tempPE,
      peCurrent: cost.peCurrent,
    });
    return true;
  };

  const executarSentencaRubra = async () => {
    if (!isLancaWeapon || !mainWeapon || !target || lancaActionLockRef.current) return;
    const currentCombat = useCombatStore.getState();
    const key = lancaInstanceKey(c.id, c.mainHandWeaponInstanceId, mainWeapon.name);
    const record = currentCombat.lancaVetorial[key] ?? createLancaCombatRecord(c.id, c.mainHandWeaponInstanceId ?? mainWeapon.id);
    if (record.targetId !== target.id || record.marks < 3) { addLog('combat', '🚫 Sentença Rubra exige 3 Marcas Vetoriais no alvo selecionado.'); return; }
    if (!activeLancaTurn || (currentCombat.pendingLancaAdvance?.wielderId === c.id) || useMapStore.getState().pendingMove) { addLog('combat', '🚫 Termine a ação ou o movimento pendente antes de usar a Sentença Rubra.'); return; }
    if (phase === 'rolling-hit' || phase === 'rolling-dmg' || phase === 'await-second-d20' || phase === 'await-dmg') { addLog('combat', '🚫 Termine a rolagem atual antes de confirmar a Sentença Rubra.'); return; }
    const freshTarget = useCharacterStore.getState().characters.find((character) => character.id === target.id) ?? target;
    const freshRange = checkWeaponRange(c.id, freshTarget.id, mainWeapon, useMapStore.getState().entities, useMapStore.getState().gridConfig, meleeRangeBonus, { casterProfileId: c.profileId, targetProfileId: freshTarget.profileId }, posturaAlcanceMult(c));
    if (freshRange) { addLog('combat', `🚫 Sentença Rubra não pode alcançar o alvo: ${freshRange}`); return; }
    lancaActionLockRef.current = true;
    if (!gastarAcaoLanca(10)) { lancaActionLockRef.current = false; return; }
    addLog('combat', `🩸 ${c.name} confirma Sentença Rubra: gasta 1 Ação Comum e 10 PE.`);
    try { await handleRoll({ lancaMode: 'sentence' }); }
    finally { lancaActionLockRef.current = false; }
  };

  const executarAvancoEscarlate = async () => {
    if (!isLancaWeapon || !mainWeapon || !target || lancaActionLockRef.current) return;
    const currentCombat = useCombatStore.getState();
    const currentMap = useMapStore.getState();
    if (!activeLancaTurn || currentCombat.pendingLancaAdvance?.wielderId === c.id || currentMap.pendingMove) { addLog('combat', '🚫 Termine o movimento pendente antes de confirmar Avanço Escarlate.'); return; }
    if (phase === 'rolling-hit' || phase === 'rolling-dmg' || phase === 'await-second-d20' || phase === 'await-dmg') { addLog('combat', '🚫 Termine a rolagem atual antes de confirmar Avanço Escarlate.'); return; }
    const freshTarget = useCharacterStore.getState().characters.find((character) => character.id === target.id) ?? target;
    const freshDistance = distanceBetweenChars(c.id, freshTarget.id, currentMap.entities, currentMap.gridConfig, { casterProfileId: c.profileId, targetProfileId: freshTarget.profileId });
    if (freshDistance === null) { addLog('combat', '🚫 Avanço Escarlate precisa das peças do portador e do alvo no mapa para medir o movimento e o alcance final.'); return; }
    const reach = weaponRangeM ?? 3;
    const movementNeeded = Math.max(0, freshDistance - reach);
    const attackerEntity = Object.values(currentMap.entities).find((entity) => entity?.characterId === c.id);
    const targetEntity = Object.values(currentMap.entities).find((entity) => entity?.characterId === freshTarget.id);
    if (movementNeeded > 0 && (!attackerEntity || !targetEntity)) { addLog('combat', '🚫 Avanço Escarlate precisa das duas peças no mapa para calcular o deslocamento.'); return; }

    let move: { start: { x: number; y: number }; end: { x: number; y: number }; distanceM: number; trail: { x: number; y: number }[] } | null = null;
    if (movementNeeded > 0 && attackerEntity && targetEntity) {
      const metersPerPx = (currentMap.gridConfig?.metersPerCell || 1.5) / (currentMap.gridConfig?.dpi || 70);
      const remainingMovement = Math.min(3, lancaMovementRemaining);
      const stepM = Math.min(3, movementNeeded, remainingMovement);
      const dx = (targetEntity.x + targetEntity.w / 2) - (attackerEntity.x + attackerEntity.w / 2);
      const dy = (targetEntity.y + targetEntity.h / 2) - (attackerEntity.y + attackerEntity.h / 2);
      const centerDistance = Math.hypot(dx, dy);
      const desiredPx = centerDistance > 0 ? stepM / metersPerPx : 0;
      const desired = centerDistance > 0 ? { dx: dx / centerDistance * desiredPx, dy: dy / centerDistance * desiredPx } : { dx: 0, dy: 0 };
      const fog = useFogStore.getState();
      const blockerSegments: MapCollisionSegment[] = [
        ...WallsEngine.blockingSegments(currentMap.walls, 'sight'),
        ...buildFogSegments(fog.walls, fog.doors).map((segment) => [segment.a, segment.b] as MapCollisionSegment),
      ];
      const mover: MapCollisionToken = { origin: { x: attackerEntity.x, y: attackerEntity.y }, entity: attackerEntity };
      const delta = resolveCollisionMove([mover], prepareCollisionCache(blockerSegments), { dx: 0, dy: 0 }, desired);
      const end = { x: attackerEntity.x + delta.dx, y: attackerEntity.y + delta.dy };
      const distanceM = Math.hypot(delta.dx, delta.dy) * metersPerPx;
      move = {
        start: { x: attackerEntity.x, y: attackerEntity.y }, end, distanceM,
        trail: amostrarTrajetoria({ x: attackerEntity.x, y: attackerEntity.y }, end, (currentMap.gridConfig?.dpi || 70) / 4),
      };
    }

    lancaActionLockRef.current = true;
    if (!gastarAcaoLanca(4)) { lancaActionLockRef.current = false; return; }
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `lanca-avanco-${Date.now().toString(36)}`;
    addLog('combat', `🔻 ${c.name} confirma Avanço Escarlate: gasta 1 Ação Comum e 4 PE antes do deslocamento.`);
    if (!move || move.distanceM <= 0.01) {
      useCombatStore.getState().setPendingLancaAdvance({ id, wielderId: c.id, targetId: freshTarget.id, status: 'interrupted' });
      addLog('combat', '⛔ O trajeto do Avanço não permite deslocamento até o alcance; ação e PE permanecem gastos.');
      lancaActionLockRef.current = false;
      return;
    }
    if (!attackerEntity) {
      useCombatStore.getState().setPendingLancaAdvance({ id, wielderId: c.id, targetId: freshTarget.id, status: 'interrupted' });
      addLog('combat', '⛔ A peça do portador não está mais no mapa. Ação e PE permanecem gastos.');
      lancaActionLockRef.current = false;
      return;
    }

    useCombatStore.getState().setPendingLancaAdvance({ id, wielderId: c.id, targetId: freshTarget.id, status: 'movement' });
    comPreviaMovimento(() => currentMap.updateEntity(attackerEntity!.id, { x: move!.end.x, y: move!.end.y }));
    useMapStore.getState().setPendingMove({
      entityId: attackerEntity.id,
      charId: c.id,
      startX: move.start.x,
      startY: move.start.y,
      trail: move.trail,
      distM: move.distanceM,
      lancaAdvanceId: id,
    });
    lancaActionLockRef.current = false;
  };

  const confirmarAtaqueAvanco = () => {
    if (!pendingLancaAdvance || pendingLancaAdvance.wielderId !== c.id || pendingLancaAdvance.status !== 'ready') return;
    if (targetId !== pendingLancaAdvance.targetId) { setTargetId(pendingLancaAdvance.targetId); addLog('combat', '🎯 O alvo do Avanço foi restaurado. Confirme o ataque novamente.'); return; }
    const freshTarget = useCharacterStore.getState().characters.find((character) => character.id === pendingLancaAdvance.targetId);
    const ms = useMapStore.getState();
    const block = freshTarget && mainWeapon
      ? checkWeaponRange(c.id, freshTarget.id, mainWeapon, ms.entities, ms.gridConfig, meleeRangeBonus, { casterProfileId: c.profileId, targetProfileId: freshTarget.profileId }, posturaAlcanceMult(c))
      : 'O alvo ou a arma não está disponível.';
    if (block) {
      useCombatStore.getState().resolveLancaAdvanceMovement(pendingLancaAdvance.id, 'interrupted');
      addLog('combat', `⛔ Avanço Escarlate interrompido antes do d20: ${block}. Ação e PE permanecem gastos.`);
      return;
    }
    useCombatStore.getState().setPendingLancaAdvance(null);
    void handleRoll({ lancaMode: 'advance' });
  };

  const lancaActionBlock = !target
    ? 'Selecione um alvo.'
    : !activeLancaTurn
      ? 'A ação só pode ser confirmada no turno do portador.'
      : pendingMove || pendingLancaAdvance?.wielderId === c.id
        ? 'Há um movimento ou ataque da Lança pendente.'
        : phase === 'rolling-hit' || phase === 'rolling-dmg' || phase === 'await-second-d20' || phase === 'await-dmg'
          ? 'Conclua a rolagem atual.'
          : (c.actionsCurrent ?? 1) < 1
            ? 'Sem Ação Comum disponível.'
            : ((c.tempPE ?? 0) + (c.peCurrent ?? 0)) < 4
              ? 'PE insuficiente.'
              : null;
  const lancaSentenceBlock = lancaActionBlock
    ?? (((c.tempPE ?? 0) + (c.peCurrent ?? 0)) < 10 ? 'PE insuficiente (precisa de 10).' : null)
    ?? (lancaMarks < 3 ? 'Exige 3 marcas no alvo.' : rangeBlockReason ?? null);
  const lancaAdvanceNeed = targetDistanceM === null ? null : Math.max(0, targetDistanceM - (weaponRangeM ?? 3));
  const lancaAdvanceBlock = lancaActionBlock
    ?? (lancaAdvanceNeed === null ? 'Peças do portador e do alvo são necessárias no mapa.' : null)
    ?? (lancaAdvanceNeed !== null && lancaAdvanceNeed > 0 && lancaMovementRemaining <= 0 ? 'Sem deslocamento restante para alcançar o alvo.' : null);
  const lancaAdvanceReady = pendingLancaAdvance?.wielderId === c.id && pendingLancaAdvance.status === 'ready';
  const lancaAdvanceInterrupted = pendingLancaAdvance?.wielderId === c.id && pendingLancaAdvance.status === 'interrupted';

  return (
    <div className="px-4 pb-3">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex w-full items-center gap-2 text-left px-3 py-2 -mx-1 -mt-1 rounded-lg hover:bg-primary/10 active:bg-primary/15 transition-colors"
          title={collapsed ? 'Expandir Painel de Ataque' : 'Recolher Painel de Ataque'}
          aria-expanded={!collapsed}
        >
          <Swords className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Painel de Ataque
          </span>
          <ChevronDown
            className={cn(
              'ml-auto h-5 w-5 text-primary/70 transition-transform duration-200',
              collapsed && '-rotate-90',
            )}
          />
        </button>

        {!collapsed && (<>


        {/* ─── AÇÕES ATIVAS & TÉCNICAS OMNI ───────────────────────────── */}
        <AcoesAtivasSection charId={c.id} incluirCategorias={['arma']} />
        {isAetherisWeapon && mainWeapon && (
          <BaculoAetherisPanel character={c} weaponInstanceId={c.mainHandWeaponInstanceId ?? mainWeapon.id}
            ruptureTargetId={ruptureTargetId} onRupturePromptClose={() => setRuptureTargetId(null)} />
        )}

        {isLancaWeapon && mainWeapon && (
          <section className="rounded-xl border border-rose-500/40 bg-gradient-to-br from-rose-950/35 via-background/80 to-background p-3 space-y-3" aria-label="Núcleo Carmesim da Lança Vetorial Rubra">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-rose-400/40 bg-rose-500/10 text-rose-300" aria-hidden="true">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-rose-100">Núcleo Carmesim</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">Marcas vetoriais do alvo e técnicas da arma.</p>
              </div>
              <span className="shrink-0 rounded-full border border-rose-400/30 px-2 py-1 text-xs font-semibold tabular-nums text-rose-200">
                {lancaRecord?.marks ?? 0}/3 marcas
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2" aria-label={`${lancaRecord?.marks ?? 0} de 3 marcas vetoriais`}>
              {[1, 2, 3].map((limiar) => {
                const ativo = (lancaRecord?.marks ?? 0) >= limiar;
                const labels = ['+2 no ataque', 'Ignora 3 Defesa · Fratura', 'Crítico 18–20'];
                return (
                  <div key={limiar} className={cn('min-w-0 rounded-lg border px-2 py-2', ativo ? 'border-rose-400/50 bg-rose-500/10 text-rose-100' : 'border-border bg-background/50 text-muted-foreground')}>
                    <div className="flex items-center gap-1.5 text-xs font-bold"><span className={cn('grid h-5 w-5 place-items-center rounded-full border tabular-nums', ativo ? 'border-rose-300 bg-rose-400/20' : 'border-border')}>{limiar}</span>Marca</div>
                    <p className="mt-1 text-xs leading-snug">{labels[limiar - 1]}</p>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground" aria-live="polite">
              {lancaRecord?.marks
                ? `Alvo marcado: ${characters.find((character) => character.id === lancaRecord.targetId)?.name ?? 'alvo atual'}. `
                : 'Nenhum alvo marcado. '}
              Fratura Energética: {lancaFractureAvailable ? 'disponível no próximo acerto elegível' : 'usada; renova no próximo turno do portador'}.
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!!lancaAdvanceBlock || lancaActionLockRef.current}
                onClick={() => void executarAvancoEscarlate()}
                title={lancaAdvanceBlock ?? 'Confirma o Avanço; Ação Comum e 4 PE são gastos antes do deslocamento.'}
                className="min-h-11 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-left text-sm font-semibold text-rose-100 transition-colors hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="block">Avanço Escarlate</span>
                <span className="block text-xs font-normal text-rose-100/70">Ação Comum · 4 PE · até 3 m</span>
              </button>
              <button
                type="button"
                disabled={!!lancaSentenceBlock || lancaActionLockRef.current}
                onClick={() => void executarSentencaRubra()}
                title={lancaSentenceBlock ?? 'Confirma a Sentença Rubra; Ação Comum e 10 PE são gastos antes do ataque.'}
                className="min-h-11 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-left text-sm font-semibold text-amber-100 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="block">Sentença Rubra</span>
                <span className="block text-xs font-normal text-amber-100/70">Ação Comum · 10 PE · exige 3 marcas</span>
              </button>
            </div>

            {lancaAdvanceReady && (
              <div className="flex flex-col gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/5 p-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-emerald-100/80" aria-live="polite">
                  {opportunityPending ? 'Resolva o Ataque de Oportunidade pendente antes de atacar.' : 'Movimento confirmado. Confira o alcance final e role o ataque.'}
                </p>
                <button
                  type="button"
                  disabled={!!opportunityPending || !!rangeBlockReason || phase === 'rolling-hit' || phase === 'rolling-dmg' || phase === 'await-dmg'}
                  onClick={confirmarAtaqueAvanco}
                  title={opportunityPending ? 'Resolva o Ataque de Oportunidade primeiro.' : rangeBlockReason ?? 'Rola o ataque do Avanço Escarlate.'}
                  className="min-h-10 shrink-0 rounded-md bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                >Rolar ataque do Avanço</button>
              </div>
            )}
            {lancaAdvanceInterrupted && (
              <p className="rounded-lg border border-amber-400/30 bg-amber-500/5 p-2 text-xs text-amber-100" role="status">
                Avanço interrompido antes do d20. A Ação Comum e os 4 PE continuam gastos.
              </p>
            )}
            {lancaSuppressedTarget && (
              <p className="rounded-lg border border-rose-400/30 bg-rose-500/5 p-2 text-xs text-rose-100" role="status">
                As Reações deste alvo estão suprimidas; o saldo de Reações não foi consumido.
              </p>
            )}
          </section>
        )}

        {/* ─── EMPUNHADURA ─────────────────────────────────────────────── */}
        <div className="rounded-lg border border-border bg-background/40 p-2 space-y-2">
          <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Hand className="h-3 w-3" /> Empunhadura
            <span className="ml-auto text-xs normal-case font-normal">
              Trocas no turno: <b className="text-foreground">{c.weaponSwapsThisTurn ?? 0}</b>
              {' · '}AB: <b className="text-foreground">{c.bonusActionsCurrent}/{c.bonusActionsMax}</b>
            </span>
          </div>

          <ReplicasSection charId={c.id} />
          {inventoryWeapons.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">
              Nenhuma arma do catálogo no inventário deste personagem. Adicione armas pelo módulo Itens (vincule ao personagem).
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <HandSlot
                label="Mão Principal"
                ocupacaoDuasMaos={usingTwoHanded || (twoHanded && !!mainWeapon && isVersatile(mainWeapon))}
                rodape={contadoresArma(c.mainHandWeaponName)}
                currentName={equippedWeaponKey(c, 'main', inventoryWeapons)}
                inventory={inventoryWeapons}
                disabledForOther={null}
                onChange={(key) => handleEquip('main', key)}
              />
              <HandSlot
                label="Mão Secundária"
                rodape={usingTwoHanded ? null : contadoresArma(c.offHandWeaponName)}
                currentName={
                  // se duas-mãos, mostra a mesma arma "ocupando" mas sem permitir alterar
                  usingTwoHanded || (twoHanded && !!mainWeapon && isVersatile(mainWeapon)) ? equippedWeaponKey(c, 'main', inventoryWeapons) : equippedWeaponKey(c, 'off', inventoryWeapons)
                }
                inventory={inventoryWeapons}
                disabledForOther={c.mainHandWeaponInstanceId ? `omni:${c.mainHandWeaponInstanceId}` : equippedWeaponKey(c, 'main', inventoryWeapons)}
                lockedReason={usingTwoHanded || (twoHanded && !!mainWeapon && isVersatile(mainWeapon)) ? 'Arma de duas-mãos ocupa ambos os slots' : null}
                onChange={(key) => handleEquip('off', key)}
              />
            </div>
          )}



          {mainWeapon && (
            <div className="text-xs text-muted-foreground">
              Atacando com <b className="text-foreground">{mainWeapon.name}</b>
              {' · '}atributo: <b className="text-foreground">{ability} ({abilityMod >= 0 ? '+' : ''}{abilityMod})</b>
              {' · '}dano: <b className="text-foreground">{mainWeapon.damage}</b>
              {hasProperty(mainWeapon, 'fineza') && ' · fineza'}
            </div>
          )}
        </div>

        {hasArsenalCiclico(c) && inCombat && (
          <div className="rounded-md border border-primary/30 bg-background/40 px-2 py-1 text-xs text-muted-foreground" data-testid="arsenal-ciclico">
            <b className="text-foreground">Arsenal Cíclico</b>
            {' · '}troca livre extra: {c.arsenalFreeSwapRound === combatRound ? 'usada nesta rodada' : 'disponível'}
            {arsenalBonusAtivo(c, c.arsenalBonus?.weaponName, combatRound) && <> {' · '}<b className="text-primary">+1 dado com {c.arsenalBonus?.weaponName}</b></>}
          </div>
        )}

        {zonaAtaque && (
          <div className="flex items-center justify-between gap-2 rounded border border-primary/60 bg-primary/10 px-2 py-1 text-xs" data-testid="zona-risco-banner">
            <span>⚔️ Zona de Risco: ataque liberado contra <b>{characters.find((x) => x.id === zonaAtaque.alvoId)?.name ?? 'alvo'}</b> — role o ataque.</span>
            <button onClick={() => useZonaRiscoStore.getState().setAtaque(null)} className="text-muted-foreground hover:text-foreground">✕</button>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs">
          <span>{target ? `Alvo: ${target.name}` : 'Selecione o alvo no mapa ao atacar.'}</span>
          <button type="button" disabled={!mainWeapon || mirando} onClick={() => void selecionarAlvoNoMapa()}
            className="rounded border border-border px-2 py-1">Selecionar alvo no mapa</button>
        </div>

        {/* ─── Alcance (medido no mapa, borda a borda) ────────────────────── */}
        {mainWeapon && target && weaponRangeM !== null && targetDistanceM !== null && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs',
              rangeBlockReason
                ? 'border-destructive/40 bg-destructive/15 text-destructive'
                : 'border-border bg-background/40 text-muted-foreground',
            )}
          >
            <Shield className="h-3 w-3 shrink-0" />
            <span>
              Distância: <b className="font-mono">{targetDistanceM.toFixed(1).replace('.', ',')} m</b>
              {' / alcance '}<b className="font-mono">{weaponRangeM} m</b>
              {rangeBlockReason ? ' — fora de alcance!' : ''}
            </span>
          </div>
        )}

        {/* ─── Golpe Falso (reação) ───────────────────────────────────────── */}
        <GolpeFalsoSection character={c} target={target} />

        {/* ─── Tiro Falso (reação) ────────────────────────────────────────── */}
        <TiroFalsoSection character={c} target={target} />

        {/* ─── Revigorar (ação bônus) ─────────────────────────────────────── */}
        <RevigorarButton character={c} />
        <EspiritoLutaButton character={c} />

        {/* ─── Técnicas de Avanço / Buscar Oportunidade / Compensar Erro ─── */}
        <EspecialistaNv4Sections
          character={c}
          possibleTargets={possibleTargets}
          mainWeapon={mainWeapon ?? null}
          rangedWeapons={inventoryWeapons.map(({ weapon }) => weapon).filter((w) => w.range !== 'melee')}
          ataque={ataqueExtra}
          reachBlock={(alvoId, arma) => {
            const ms = useMapStore.getState();
            const al = characters.find((x) => x.id === alvoId);
            const eu = useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c;
            return checkWeaponRange(c.id, alvoId, arma, ms.entities, ms.gridConfig, meleeRangeBonus, al ? { casterProfileId: c.profileId, targetProfileId: al.profileId } : undefined, posturaAlcanceMult(eu));
          }}
        />

        {/* ─── Preparo Imediato / Munição / Uso Rápido ─────────────────────── */}
        <EspecialistaNv4CSections character={c} />





        {/* ─── Situação (auto-lida do alvo + override manual) ─────────────── */}
        <div className="flex flex-wrap gap-2 text-xs">
          <ToggleChip on={ataqueOportunidade} onChange={setAtaqueOportunidade} label="Ataque de oportunidade" disabled={phase !== 'idle' && phase !== 'done'} />
          {mainWeapon && (hasProperty(mainWeapon, 'versatil') || hasProperty(mainWeapon, 'duas_maos')) && (
            <ToggleChip on={twoHanded || usingTwoHanded} onChange={setTwoHanded} label="Duas mãos" disabled={usingTwoHanded || !!offWeapon} />
          )}
          {targetUnaware && (
            <span
              className="rounded-full border border-primary/60 bg-primary/15 px-2 py-0.5 font-bold text-primary"
              title="Lido automaticamente das condições ativas do alvo (desprevenido/agarrado/atordoado)."
            >
              Alvo desprevenido (auto)
            </span>
          )}
          {targetProne && (
            <span
              className="rounded-full border border-primary/60 bg-primary/15 px-2 py-0.5 font-bold text-primary"
              title="Lido automaticamente da condição 'caído' do alvo."
            >
              Alvo caído (auto)
            </span>
          )}
          <span
            className={cn(
              'rounded-full border px-2 py-0.5',
              previousMissed
                ? 'border-hp/60 bg-hp/15 text-hp font-bold'
                : 'border-border bg-background text-muted-foreground',
            )}
            title="Auto: lê o resultado do último ataque do personagem neste turno."
          >
            Errou anterior {previousMissed ? '✓' : '—'}
          </span>
          <span
            className="flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5"
            title="Auto: contagem de ataques já feitos pelo personagem neste turno. Reseta no início do turno."
          >
            <span className="text-muted-foreground">Ataques prévios</span>
            <b className="text-foreground">{previousAttacks}</b>
          </span>
          {!inCombat && (previousAttacks > 0 || previousMissed || (c.weaponSwapsThisTurn ?? 0) > 0) && (
            <button
              type="button"
              onClick={() => {
                resetTurnStateFor(c.id);
                addLog('combat', `🔄 ${c.name}: turno narrativo reiniciado (ataques prévios, último resultado e trocas de arma zerados).`);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-accent/50 bg-accent/10 px-2 py-0.5 text-accent hover:bg-accent/20"
              title="Fora de combate não há virada de turno automática. Use este botão para zerar a memória do turno (ataques prévios, errou anterior, trocas de arma)."
            >
              <RotateCcw className="h-3 w-3" /> Resetar turno
            </button>
          )}
        </div>
        {!inCombat && (
          <div className="text-xs text-muted-foreground italic">
            ⚠ Sem combate ativo: a contagem de ataques prévios e trocas de arma só zera com o botão "Resetar turno" (não há virada automática de iniciativa).
          </div>
        )}

        {/* ─── Artes do Combate (Especialista em Combate) ─────────────────── */}
        {temArtes && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
              <Zap className="h-3 w-3" /> Artes do Combate
              <span className="ml-auto normal-case font-normal text-muted-foreground">
                Preparo: <b className={preparoAtual > 0 ? 'text-amber-300' : 'text-destructive'}>{preparoAtual}</b>/{preparoMax}
                {arteCustoTotal > 0 && <span className="text-amber-200"> · custo {arteCustoTotal} PP</span>}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <ToggleChip on={arteDistracao} onChange={setArteDistracao} label={`Distração Letal (1 PP) · −${metadeSab(c)} Def do alvo`} disabled={preparoAtual < 1} />
              <ToggleChip on={arteExecucao} onChange={setArteExecucao} label={`Execução Silenciosa (1 PP) · +${execucaoSilenciosaDice(c)}d6`} disabled={preparoAtual < 1 || !targetUnaware} />
              <ToggleChip on={arteGolpe} onChange={setArteGolpe} label={`Golpe Descendente (1 PP) · +${metadeSab(c)} Def sua`} disabled={preparoAtual < 1 || mainWeapon?.range !== 'melee'} />
              <ToggleChip on={arteInvestida} onChange={setArteInvestida} label={`Investida Imediata (2 PP) · ${investidaMoveMeters(c).toLocaleString('pt-BR')} m`} disabled={preparoAtual < 2 || !mainWeapon} />
            </div>
          </div>
        )}

        {hasAssumirPostura(c) && <PosturasPanel charId={c.id} inCombat={inCombat} round={combatRound} />}

        {temArremessos && (
          <div className="rounded-lg border border-primary/30 bg-background/40 p-2 space-y-1" data-testid="arremessos-potentes">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">Arremessos Potentes</span>
              {arremessosLigado ? (
                <span className="text-xs font-semibold text-primary">Ativo neste turno</span>
              ) : (
                <button
                  type="button"
                  onClick={handleAtivarArremessos}
                  disabled={!arremessosCheck.ok}
                  className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary disabled:opacity-50"
                >
                  Gastar 1 PE
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Arremessos: +1 nível de dano. Com 1 PE no começo do turno, ignoram {getTrainingBonusByLevel(c.level ?? 1)} de RD.
              {!arremessosLigado && !arremessosCheck.ok && arremessosCheck.reason ? ` (${arremessosCheck.reason})` : ''}
            </p>
          </div>
        )}

        {temPistoleiro && (
          <div className="rounded-lg border border-primary/30 bg-background/40 p-2 space-y-1" data-testid="pistoleiro-iniciado">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">Pistoleiro Iniciado</span>
              {armaTravada ? (
                <button
                  type="button"
                  onClick={handleDesemperrar}
                  data-testid="desemperrar-arma"
                  className="rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive"
                >
                  Desemperrar (Ação Comum)
                </button>
              ) : (
                <ToggleChip
                  on={pistoleiroOn}
                  onChange={setPistoleiroOn}
                  label={`Margem de Emperrar 1-${margemEmperrar(mainWeapon, true) || 3} · +1 dado`}
                  disabled={!pistoleiroCheck.ok}
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {armaTravada
                ? `${cVivo.armaEmperrada} está emperrada e não dispara até ser desemperrada.`
                : pistoleiroCheck.ok
                  ? 'Declarado antes do ataque: emperra em 1-3 no d20, mas causa 1 dado de dano adicional ao acertar.'
                  : pistoleiroCheck.reason}
            </p>
          </div>
        )}

        {temPrecisao && (
          <div className="rounded-lg border border-primary/30 bg-background/40 p-2 space-y-1" data-testid="precisao-definitiva">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">Precisão Definitiva</span>
              <div className="flex items-center gap-1">
                <select
                  aria-label="PE da Precisão Definitiva"
                  data-testid="precisao-pe"
                  value={precisaoPe}
                  onChange={(e) => setPrecisaoPe(Number(e.target.value))}
                  className="rounded-md border border-border bg-background px-1 py-0.5 text-xs"
                >
                  {Array.from({ length: precisaoMax + 1 }, (_, i) => i).map((n) => (
                    <option key={n} value={n}>{n} PE</option>
                  ))}
                </select>
                <select
                  aria-label="Destino do bônus da Precisão Definitiva"
                  data-testid="precisao-modo"
                  value={precisaoModo}
                  onChange={(e) => setPrecisaoModo(e.target.value as PrecisaoModo)}
                  className="rounded-md border border-border bg-background px-1 py-0.5 text-xs"
                >
                  <option value="acerto">Acerto (+2/PE)</option>
                  <option value="dano">Dano (+4/PE)</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {precisaoPe > 0
                ? `Gastando ${precisaoPe} PE: +${precisaoBonus(precisaoPe, precisaoModo)} ${precisaoModo === 'dano' ? 'no dano' : 'no acerto'}. (PE: ${cVivo.peCurrent ?? 0})`
                : `Até ${precisaoMax} PE por ataque no seu nível. (PE: ${cVivo.peCurrent ?? 0})`}
            </p>
          </div>
        )}


        {temArremessoRapido && (
          <div className="rounded-lg border border-primary/30 bg-background/40 p-2 space-y-1" data-testid="arremesso-rapido">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">Arremesso Rápido</span>
              <div className="flex items-center gap-1">
                <select
                  aria-label="Alvo do Arremesso Rápido"
                  data-testid="arremesso-rapido-alvo"
                  value={arremessoRapidoAlvo}
                  onChange={(e) => setArremessoRapidoAlvo(e.target.value)}
                  className="rounded-md border border-border bg-background px-1 py-0.5 text-xs"
                >
                  <option value="">— alvo —</option>
                  {possibleTargets.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  data-testid="arremesso-rapido-usar"
                  disabled={!arremessoRapidoCheck.ok || !arremessoRapidoAlvo}
                  onClick={handleArremessoRapido}
                  className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary disabled:opacity-50"
                >
                  Ataque extra (1 PE + AB)
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {arremessoRapidoCheck.ok
                ? 'Gasta 1 PE e sua Ação Bônus: arremesse novamente contra outro alvo (ou o mesmo, se for o único).'
                : arremessoRapidoCheck.reason}
            </p>
          </div>
        )}

        {arremessoAtaque && arremessoAtaque.espId === c.id && (
          <div className="flex items-center justify-between gap-2 rounded border border-primary/60 bg-primary/10 px-2 py-1 text-xs" data-testid="arremesso-rapido-banner">
            <span>🌀 Arremesso Rápido: ataque extra liberado contra <b>{characters.find((x) => x.id === arremessoAtaque.alvoId)?.name ?? 'alvo'}</b> — role o ataque.</span>
            <button onClick={() => useArremessoRapidoStore.getState().setAtaque(null)} className="text-muted-foreground hover:text-foreground">✕</button>
          </div>
        )}

        {temGolpe && (
          <GolpeEspecialSection
            sel={golpeSel}
            onChange={setGolpeSel}
            custo={golpeCusto}
            peAtual={c.peCurrent ?? 0}
            precisoUsado={precisoUsado}
            amploTargetId={amploTargetId}
            onAmploTarget={setAmploTargetId}
            amploOptions={characters.filter((x) => x.id !== c.id && x.id !== targetId).map((x) => ({ id: x.id, name: x.name }))}
            longoM={mainWeapon ? longoBonusMeters({ longo: 1 }, mainWeapon.range) : 0}
            penetranteRD={penetranteRD(c)}
          />
        )}

        {/* Botão rolar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => target ? void handleRoll() : void selecionarAlvoNoMapa(true)}
            disabled={mirando || !mainWeapon || !rangeOk || phase === 'rolling-hit' || phase === 'await-second-d20' || phase === 'rolling-second-d20' || phase === 'await-dmg' || phase === 'rolling-dmg'}
            title={!rangeOk ? rangeBlockReason ?? undefined : investidaCobreDistancia ? 'Investida Imediata cobre a distância' : longoCobre ? 'Golpe Longo cobre a distância' : undefined}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold transition',
              mainWeapon && rangeOk && phase !== 'rolling-hit' && phase !== 'await-second-d20' && phase !== 'rolling-second-d20' && phase !== 'await-dmg' && phase !== 'rolling-dmg'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
            )}
          >
            <Dice5 className={cn('h-3.5 w-3.5', phase === 'rolling-hit' && 'animate-spin')} />
            {mirando ? 'Selecione no mapa…' : phase === 'rolling-hit' ? 'Rolando ataque…' : 'Rolar Ataque'}
          </button>
          {temDisparos && (
            <button
              type="button"
              data-testid="disparos-sincronizados"
              onClick={() => void handleDisparosSincronizados()}
              disabled={!sincroCheck.ok || !target || phase === 'rolling-hit' || phase === 'rolling-dmg'}
              title={sincroCheck.ok ? 'Ação Comum: dispara as duas armas juntas. Se ambos acertarem, o dano vira uma instância só.' : `Disparos Sincronizados: ${sincroCheck.reason}`}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-bold transition',
                'border-accent/60 bg-accent/15 text-accent hover:bg-accent/25',
                (!sincroCheck.ok || !target || phase === 'rolling-hit' || phase === 'rolling-dmg') && 'opacity-50 cursor-not-allowed',
              )}
            >
              <Zap className="h-3.5 w-3.5" /> Disparos Sincronizados
            </button>
          )}
          {weaponAoE && (
            <button
              type="button"
              onClick={() => handleRollAoE()}
              disabled={!mainWeapon || phase === 'rolling-hit' || phase === 'rolling-dmg'}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold transition border',
                'border-hp/60 bg-hp/15 text-hp hover:bg-hp/25',
                (!mainWeapon || phase === 'rolling-hit' || phase === 'rolling-dmg') && 'opacity-50 cursor-not-allowed',
              )}
              title={`Ataque em área (${weaponAoE.kind} · ${weaponAoE.sizeMeters}m) — posicione no mapa`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Atacar em Área ({weaponAoE.kind} {weaponAoE.sizeMeters}m)
            </button>
          )}
          {phase === 'await-second-d20' && pendingResult && (
            <button
              type="button"
              onClick={handleRollSecondD20}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 animate-fade-in"
              title={pendingResult.rollMode === 'disadvantage'
                ? 'Desvantagem: role o segundo d20 — será mantido o MENOR.'
                : 'Vantagem: role o segundo d20 — será mantido o MAIOR.'}
            >
              <Dice5 className="h-3.5 w-3.5" /> Rolar 2º d20 ({pendingResult.rollMode === 'disadvantage' ? 'desvantagem' : 'vantagem'})
            </button>
          )}
          {phase === 'rolling-second-d20' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">
              <Dice5 className="h-3.5 w-3.5 animate-spin" /> Rolando 2º d20…
            </span>
          )}
          {phase === 'await-dmg' && (
            <button
              type="button"
              onClick={handleRollDamage}
              className="inline-flex items-center gap-1 rounded-md bg-neon-yellow px-3 py-1.5 text-xs font-bold text-background hover:bg-neon-yellow/90 animate-fade-in"
            >
              <Dice5 className="h-3.5 w-3.5" /> Rolar Dano
            </button>
          )}
          {phase === 'rolling-dmg' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">
              <Dice5 className="h-3.5 w-3.5 animate-spin" /> Rolando dano…
            </span>
          )}
          {/* Rerolar ataque: disponível enquanto não houve crítico nem falha crítica e ainda há tentativa restante. */}
          {lastResult
            && (phase === 'await-dmg' || phase === 'done')
            && !lastResult.critical
            && !lastResult.criticalFail
            && attackRollCount < 2 && (
            <button
              type="button"
              onClick={() => handleRoll({ reroll: true })}
              className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 animate-fade-in"
              title="Rolar o ataque uma segunda vez. O resultado da nova rolagem substitui o anterior. Indisponível após crítico ou falha crítica."
            >
              <RotateCcw className="h-3.5 w-3.5" /> Rerolar Ataque ({attackRollCount}/2)
            </button>
          )}
          {lastResult?.canRerollDamage && phase === 'done' && (
            <button
              type="button"
              onClick={handleRerollDamage}
              className="inline-flex items-center gap-1 rounded-md border border-accent/50 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/20"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Ataque Infalível: rerrolar dano
            </button>
          )}
          {/* 🍀 Sorte: re-rolar d20 do ataque (mantém o maior). Pode repetir enquanto houver pontos. Indisponível em falha crítica. */}
          {lastResult
            && (phase === 'await-dmg' || phase === 'done')
            && !lastResult.criticalFail
            && !(isLancaWeapon && lastResult.hit && phase === 'done')
            && (c.luckCurrent ?? 0) > 0
            && c.luckMax != null && (
            <button
              type="button"
              onClick={handleLuckRerollAttack}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-400/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 animate-fade-in"
              title={isLancaWeapon && lastResult.hit && phase === 'done' ? 'O dano da Lança já foi aplicado.' : 'Gastar 1 ponto de Sorte para re-rolar o d20 do ataque e ficar com o MAIOR resultado. Pode repetir enquanto houver pontos. Indisponível em falha crítica.'}
            >
              <Sparkles className="h-3.5 w-3.5" /> 🍀 Sorte: re-rolar d20 ({c.luckCurrent}/{c.luckMax})
            </button>
          )}
          {/* 🍀 Sorte: re-rolar dano (mantém o maior). Disponível após acertar. */}
          {lastResult
            && lastResult.hit
            && phase === 'done'
            && (c.luckCurrent ?? 0) > 0
            && c.luckMax != null && (
            <button
              type="button"
              onClick={handleLuckRerollDamage}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-400/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 animate-fade-in"
              title="Gastar 1 ponto de Sorte para re-rolar o dano e ficar com o MAIOR total. Pode repetir enquanto houver pontos."
            >
              <Sparkles className="h-3.5 w-3.5" /> 🍀 Sorte: re-rolar dano ({c.luckCurrent}/{c.luckMax})
            </button>
          )}
        </div>

        {/* ─── Arremesso Ágil: ataque extra com arma de arremesso ────────── */}
        {temArtes && lastResult?.hit && phase === 'done' && mainWeapon?.range === 'melee' && arremessoWeapons.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 space-y-1.5 animate-fade-in">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Arremesso Ágil (1 PP · ação livre)
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={arremessoTargetId}
                onChange={(e) => setArremessoTargetId(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1 text-xs"
              >
                <option value="">— segundo alvo —</option>
                {possibleTargets.filter((t) => t.id !== targetId).map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleArremessoAgil}
                disabled={!arremessoTargetId || preparoAtual < 1}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold transition',
                  arremessoTargetId && preparoAtual >= 1
                    ? 'bg-amber-500 text-background hover:bg-amber-400'
                    : 'bg-muted text-muted-foreground cursor-not-allowed',
                )}
                title="Ação livre: um ataque com arma de arremesso contra um segundo alvo"
              >
                <Zap className="h-3.5 w-3.5" /> Arremessar {arremessoWeapons[0].weapon.name}
              </button>
            </div>
          </div>
        )}

        {/* Dramatização: rolagem do d20 em curso */}
        {phase === 'rolling-hit' && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs animate-fade-in">
            <div className="font-mono flex items-center gap-2">
              <Dice5 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-muted-foreground">
                {pendingResult && pendingResult.attackRolls.length > 1
                  ? `Rolando 1º d20 (${pendingResult.rollMode === 'disadvantage' ? 'desvantagem' : 'vantagem'})…`
                  : 'Rolando ataque…'}
              </span>
              <span className="ml-auto text-2xl font-bold tabular-nums text-primary">{tickD20 || '—'}</span>
            </div>
          </div>
        )}

        {/* Vantagem/Desvantagem: 1º d20 já rolado, aguardando 2º */}
        {(phase === 'await-second-d20' || phase === 'rolling-second-d20') && pendingResult && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs animate-fade-in">
            <div className="font-mono flex items-center gap-2">
              <Dice5 className={cn('h-4 w-4 text-primary', phase === 'rolling-second-d20' && 'animate-spin')} />
              <span className="text-muted-foreground">
                {pendingResult.rollMode === 'disadvantage' ? 'Desvantagem' : 'Vantagem'}: 1º d20 rolado
                {phase === 'await-second-d20' ? ' — clique para rolar o 2º' : ' — rolando 2º…'}
              </span>
              <span className="ml-auto text-2xl font-bold tabular-nums text-primary">
                {firstD20Revealed ?? pendingResult.attackRolls[0]} / {tickD20Pair ? (tickD20Pair[1] || '—') : '—'}
              </span>
            </div>
          </div>
        )}

        {/* Resultado */}
        {lastResult && phase !== 'rolling-hit' && (
          <div className={cn(
            'rounded-lg border px-3 py-2 text-xs space-y-1 animate-fade-in',
            lastResult.criticalFail ? 'border-hp/40 bg-hp/5'
              : lastResult.critical ? 'border-neon-yellow/40 bg-neon-yellow/5'
              : lastResult.hit ? 'border-neon-green/40 bg-neon-green/5'
              : 'border-border bg-muted/20',
          )}>
            <div className="font-mono">
              {lastResult.rollMode === 'disadvantage' ? (
                <>2d20: <b>{lastResult.attackRolls.join(' / ')}</b> → menor <b>{lastResult.natural}</b></>
              ) : lastResult.rollMode === 'advantage' ? (
                <>2d20: <b>{lastResult.attackRolls.join(' / ')}</b> → maior <b>{lastResult.natural}</b></>
              ) : (
                <>d20: <b>{lastResult.natural}</b></>
              )}
              {' · '}Total: <b>{lastResult.attackTotal}</b> →{' '}
              {lastResult.criticalFail ? '💀 Falha crítica' : lastResult.critical ? '💥 Crítico' : lastResult.hit ? '✅ Acerto' : '❌ Erro'}
            </div>
            {lastResult.modifiers.length > 0 && (
              <div className="text-muted-foreground">
                Modificadores: {lastResult.modifiers.map(m => `${m.source} ${m.value >= 0 ? '+' : ''}${m.value}`).join(' · ')}
              </div>
            )}
            {lastResult.hit && phase === 'rolling-dmg' && (
              <div className="font-mono flex items-center gap-2 pt-1">
                <Dice5 className="h-4 w-4 animate-spin text-neon-yellow" />
                <span className="text-muted-foreground">Rolando dano…</span>
                <span className="ml-auto text-2xl font-bold tabular-nums text-neon-yellow">{tickDmg || '—'}</span>
              </div>
            )}
            {lastResult.hit && phase === 'done' && (
              <div className="font-mono animate-scale-in">
                Dano: <b className="text-base">{lastResult.damageTotal}</b> ({lastResult.damageDice}
                {lastResult.damageType ? ` ${lastResult.damageType}` : ''})
                {lastResult.damageRolls.length > 0 && ` · rolls: [${lastResult.damageRolls.join(', ')}]`}
              </div>
            )}
            {lastResult.notes.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc list-inside">
                {lastResult.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* Trackers consumíveis + ações de talento */}
        <CombatTrackersCard character={c} />

        {/* Reações disponíveis */}
        {reactions.length > 0 && (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-2 space-y-1.5">
            <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-accent">
              <Shield className="h-3 w-3" /> Reações Disponíveis
            </div>
            {reactions.map(id => {
              const r = REACTION_LABELS[id];
              if (!r) return null;
              return (
                <div key={id} className="text-xs">
                  <div className="font-bold">{r.name}</div>
                  <div className="text-muted-foreground"><Zap className="inline h-3 w-3" /> {r.trigger}</div>
                  <div>{r.effect}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Bônus de talentos (Especialistas, Mestre dos Chicotes, Apunhaladora, Enérgica, Mortal/Fatal etc.) são aplicados automaticamente quando a arma e a situação combinarem.
        </div>
        </>)}
      </div>
    </div>
  );
}

function equippedWeaponKey(
  character: Character,
  hand: 'main' | 'off',
  inventory: { item: { id: string; key: string; name: string }; weapon: Weapon }[],
): string | null {
  const instanceId = hand === 'main' ? character.mainHandWeaponInstanceId : character.offHandWeaponInstanceId;
  const weaponName = hand === 'main' ? character.mainHandWeaponName : character.offHandWeaponName;
  if (!weaponName) return null;
  if (instanceId) return instanceId.startsWith('legacy:') ? instanceId : `omni:${instanceId}`;
  return inventory.find(({ weapon }) => weapon.name === weaponName)?.item.key ?? `legacy-name:${weaponName}`;
}

function HandSlot({
  label, currentName, inventory, onChange, disabledForOther, lockedReason, rodape, ocupacaoDuasMaos,
}: {
  label: string;
  currentName: string | null;
  inventory: { item: { id: string; key: string; name: string }; weapon: Weapon }[];
  onChange: (name: string | null) => void;
  /** Identidade já equipada na outra mão (ou nome estável legado). */
  disabledForOther: string | null;
  lockedReason?: string | null;
  rodape?: ReactNode;
  ocupacaoDuasMaos?: boolean;
}) {
  const locked = !!lockedReason;
  const currentLabel = inventory.find(({ item }) => item.key === currentName)?.weapon.name ?? currentName;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {currentName && !locked && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-0.5 text-hp hover:text-hp/80"
            title="Guardar arma"
          >
            <X className="h-3 w-3" /> guardar
          </button>
        )}
      </div>
      {locked ? <div className="rounded border border-primary/40 bg-primary/10 px-2 py-1 text-sm text-foreground">🤲 {currentLabel} · duas mãos</div> : <select
        value={currentName ?? ''}
        disabled={locked}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn(
          'w-full rounded border border-border bg-background px-2 py-1 text-xs',
          locked && 'opacity-60 cursor-not-allowed',
        )}
        title={lockedReason ?? undefined}
      >
        <option value="">— vazia —</option>
        {inventory.map(({ item, weapon }) => {
          const isDuplicate = disabledForOther === item.key;
          return (
            <option key={item.key} value={item.key} disabled={!!isDuplicate}>
              {weapon.name} ({weapon.group}){isDuplicate ? ' — em uso' : ''}
            </option>
          );
        })}
      </select>}
      {ocupacaoDuasMaos && <div className="text-xs text-primary">🤲 {currentLabel} · duas mãos</div>}
      {rodape}
      {locked && <div className="text-xs text-muted-foreground italic">{lockedReason}</div>}
    </div>
  );
}

function ToggleChip({
  on, onChange, label, disabled,
}: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={on}
      onClick={() => !disabled && onChange(!on)}
      className={cn(
        'rounded-full border px-2 py-0.5 transition',
        on
          ? 'border-primary/60 bg-primary/15 text-primary font-bold'
          : 'border-border bg-background text-muted-foreground hover:bg-muted/50',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
    >
      {label}
    </button>
  );
}
