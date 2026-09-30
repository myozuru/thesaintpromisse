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
import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_CONDITIONS } from '@/types/conditions';
import type { Character } from '@/types';
import {
  findWeaponByName, hasProperty, requiresTwoHands, type Weapon,
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

import { cn } from '@/lib/utils';

interface Props { character: Character; }

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
    const out: { item: { id: string; name: string }; weapon: Weapon }[] = [];
    const seenNames = new Set<string>();

    // (a) Banco de Itens (legado)
    const owned = items.filter(i => i.assignedTo?.includes(c.id));
    for (const it of owned) {
      const w = findWeaponByName(it.name);
      if (w) {
        out.push({ item: it, weapon: w });
        seenNames.add(w.name);
      }
    }

    // (b) Inventário Omni do personagem
    for (const inv of omniInventoryList) {
      if (inv.ownerId !== c.id) continue;
      const w = findWeaponByName(inv.entity.nome);
      if (w && !seenNames.has(w.name)) {
        out.push({ item: { id: inv.entity.id, name: inv.entity.nome }, weapon: w });
        seenNames.add(w.name);
      }
    }

    return out;
  }, [items, c.id, omniInventoryList]);

  const mainWeapon = c.mainHandWeaponName ? findWeaponByName(c.mainHandWeaponName) : null;
  const offWeapon =
    c.offHandWeaponName && c.offHandWeaponName !== c.mainHandWeaponName
      ? findWeaponByName(c.offHandWeaponName)
      : null;
  const usingTwoHanded = !!mainWeapon && requiresTwoHands(mainWeapon);

  // ─── AoE detection (forma de área da arma Omni equipada) ───────────────────
  const mainOmniEntity = useMemo(() => {
    if (!c.mainHandWeaponName) return null;
    const inv = omniInventoryList.find(
      (i) => i.ownerId === c.id && i.entity.nome === c.mainHandWeaponName,
    );
    return inv?.entity ?? null;
  }, [omniInventoryList, c.id, c.mainHandWeaponName]);
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
  // Desprevenido/caído são lidos exclusivamente das condições ativas na ficha do alvo.
  // Não há mais override manual: se for preciso aplicar o efeito, registre a condição no alvo.
  const targetUnaware = autoUnaware;
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
  const arremessoAtaque = useArremessoRapidoStore((s) => s.ataque);
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

  const reactions = useMemo(() => {
    const chosen = c.chosenTalents ?? [];
    return REACTION_COMBAT_TALENT_IDS.filter(id => chosen.some(x => x.id === id));
  }, [c.chosenTalents]);

  // ─── Equipar/desequipar ────────────────────────────────────────────────────
  const handleEquip = (slot: 'main' | 'off', weaponName: string | null) => {
    // Caso especial: arma de duas-mãos ocupa ambos os slots (mesmo nome em main e off).
    // "Guardar" em qualquer slot deve limpar os DOIS, senão o store re-equipa a mesma arma.
    const isTwoHandedEquipped =
      !!c.mainHandWeaponName &&
      c.mainHandWeaponName === c.offHandWeaponName;
    const payload =
      weaponName === null && isTwoHandedEquipped
        ? { mainHandName: null, offHandName: null }
        : slot === 'main'
          ? { mainHandName: weaponName, offHandName: c.offHandWeaponName ?? null }
          : { mainHandName: c.mainHandWeaponName ?? null, offHandName: weaponName };
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
  const handleRoll = async (opts?: { reroll?: boolean }) => {
    const isReroll = !!opts?.reroll;
    if (!mainWeapon) {
      addLog('combat', `⚠️ ${c.name} não tem arma equipada na mão principal.`);
      return;
    }
    // ─── Emperrar: arma de fogo travada não dispara ─────────────────────────
    if (armaEstaEmperrada(useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c, mainWeapon)) {
      addLog('combat', `🚫 ${mainWeapon.name} está emperrada — gaste uma Ação Comum para desemperrar.`);
      return;
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
    const golpeUsado = golpeAtivo && !isReroll;
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
    const ctx = buildAttackContext({
      attacker: c,
      weapon: mainWeapon,
      targetDefense: targetDef,
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
        ...golpeSit,
        ...arsenalSit,
      },
      trainedRanges: [
        ...(c.meleeTrained ? (['melee'] as const) : []),
        ...(c.rangedTrained ? (['ranged', 'thrown'] as const) : []),
      ],
    });
    let result: AttackResult;
    try {
      result = await rollAttack(ctx);
    } catch (error) {
      console.error('[AttackPanel] falha ao concluir rolagem:', error);
      setPhase('idle');
      return;
    } finally {
      rollInFlightRef.current = false;
    }
    // Emperrou: trava a arma até uma Ação Comum de desemperrar.
    if (result.emperrou) {
      useCharacterStore.getState().updateCharacter(c.id, { armaEmperrada: mainWeapon.name });
      setPistoleiroOn(false);
      addLog('combat', `🔧 ${mainWeapon.name} emperrou! O ataque falha automaticamente — gaste uma Ação Comum para desemperrar.`);
    }
    // Auto-crit contra alvos Inconsciente / Indefeso / Paralisado (CaC).
    const auto = target ? getAutoCritFromConditions(target, attackKind) : null;

    if (auto && !result.criticalFail && !result.emperrou) {
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
    // Memória de turno: contabiliza apenas no PRIMEIRO disparo (reroll não conta como novo ataque).
    if (!isReroll) {
      recordAttackResult(c.id, result.hit);
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
      const g = golpeRollRef.current;
      if (g) {
        if (result.hit && g.target && g.sel.sanguinario) aplicarSangramento(g.target, g.sel.sanguinario);
        setGolpeSel({});
        setAmploTargetId('');
        if (g.amploTarget) {
          const alvo2 = g.amploTarget;
          const def2 = computeTotalDefense(alvo2, { items, omniInventory: omniInventoryList, omniEntidadesMap, omniRuntimeEffects: omniRuntimeEffectsList }, attackKind);
          const ctx2 = buildAttackContext({
            attacker: c, weapon: mainWeapon, targetDefense: def2,
            situation: { ...ctx.situation, targetUnaware: false, arteExecucao: false, devastacaoHit: 0 },
            trainedRanges: [
              ...(c.meleeTrained ? (['melee'] as const) : []),
              ...(c.rangedTrained ? (['ranged', 'thrown'] as const) : []),
            ],
          });
          const r2 = await rollAttack(ctx2);
          addLog('combat', `⚔️ Golpe Amplo: ${c.name} atinge também ${alvo2.name}: d20 ${r2.natural} · total ${r2.attackTotal} → ${r2.criticalFail ? '💀 falha crítica' : r2.critical ? '💥 CRÍTICO' : r2.hit ? '✅ acerto' : '❌ erro'}${r2.hit ? ` · dano ${r2.damageTotal} (${r2.damageDice})` : ''}`);
          if (r2.hit && g.sel.sanguinario) aplicarSangramento(alvo2, g.sel.sanguinario);
          if (r2.hit && g.sel.penetrante) addLog('combat', `   ↳ Penetrante: ignora ${penetranteRD(c)} de RD.`);
          if (r2.hit && r2.damageTotal > 0) {
            applyDamage(alvo2.id, r2.damageTotal, (r2.damageType ?? undefined) as never, {
              attackerId: c.id, isMelee: mainWeapon.range === 'melee', rdIgnore: rdIgnoradaAtaque(!!g.sel.penetrante),
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
      finalizeAttackReveal(result, isReroll);
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
        applyDamage(target.id, damageTotal, dmgType, { attackerId: c.id, isMelee: mainWeapon.range === 'melee' });
      }
      setPhase('done');
    } catch (err) {
      console.error('[AoE attack] erro:', err);
      setPhase('idle');
    }
  };


  // Anima e revela o 2º d20 em vantagem/desvantagem, então finaliza.
  const handleRollSecondD20 = () => {
    if (phase !== 'await-second-d20' || !pendingResult) return;
    const result = pendingResult;
    const meta = pendingRerollMeta ?? { isReroll: false };
    const second = result.attackRolls[1];
    setPhase('rolling-second-d20');
    setTickD20Pair([result.attackRolls[0], second]);
    finalizeAttackReveal(result, meta.isReroll);
  };

  // Finaliza o reveal do ataque: registra log, expõe acerto/erro e move
  // para await-dmg ou done. Comum aos fluxos d20 único / dual.
  const finalizeAttackReveal = (result: AttackResult, isReroll: boolean) => {
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

    setPendingRerollMeta(null);
    setFirstD20Revealed(null);

    if (!result.hit) {
      setPendingResult(null);
      setPhase('done');
      return;
    }
    // Aguarda o player rolar o dano manualmente.
    setPendingResult(result);
    setPhase('await-dmg');
  };

  // ─── Rolar Dano (fase 2, manual) ───────────────────────────────────────────
  const handleRollDamage = () => {
    if (phase !== 'await-dmg' || !pendingResult || !mainWeapon) return;
    const result = pendingResult;
    setPhase('rolling-dmg');
    setTickDmg(result.damageTotal);
    setLastResult(result);
    setPendingResult(null);
    setPhase('done');
    addLog(
      'combat',
      `   💥 Dano: ${result.damageTotal} (${result.damageDice}${result.damageType ? ' ' + result.damageType : ''})`,
    );
    const g = golpeRollRef.current;
    golpeRollRef.current = null;
    if (g?.sel.penetrante) addLog('combat', `   ↳ Penetrante: ignora ${penetranteRD(c)} de RD.`);
    if (devRdRef.current > 0) addLog('combat', `   ↳ Postura da Devastação: ignora ${devRdRef.current} de RD.`);
    const rdIgn = rdIgnoradaAtaque(!!g?.sel.penetrante, devRdRef.current);
    if (mainWeapon && arremessosRdIgnorada(useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c, mainWeapon, turnInfo) > 0) {
      addLog('combat', `   ↳ Arremessos Potentes: ignora ${arremessosRdIgnorada(useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c, mainWeapon, turnInfo)} de RD.`);
    }
    if (target && result.damageTotal > 0) {
      applyDamage(target.id, result.damageTotal, (result.damageType ?? undefined) as never, {
        attackerId: c.id, isMelee: mainWeapon.range === 'melee', rdIgnore: rdIgn,
      });
    }
    if (g?.sel.impactante && g.target) void empurrarImpactante(g.target, result.damageTotal);
    if (target && result.damageTotal > 0) void explosaoDragao(target, result.damageTotal, result.damageType ?? undefined);
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
      if (!passou) applyDamage(ch.id, meio, tipo as never, { attackerId: c.id, tags: ['__dragao'] });
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
      attacker: c, weapon: arma, targetDefense: def2,
      situation: { preferredAbility: ability2, attackerIsGrappled },
      trainedRanges: [
        ...(c.meleeTrained ? (['melee'] as const) : []),
        ...(c.rangedTrained ? (['ranged', 'thrown'] as const) : []),
      ],
    });
    const r = await rollAttack(ctx2);
    addLog(
      'combat',
      `🎯 Arremesso Ágil: ${c.name} ataca ${alvo2.name} com ${arma.name} (ação livre): d20 ${r.natural} · total ${r.attackTotal} → ${r.critical ? '💥 CRÍTICO' : r.hit ? '✅ acerto' : '❌ erro'}${r.hit ? ` · dano ${r.damageTotal} (${r.damageDice})` : ''}`,
    );
    recordAttackResult(c.id, r.hit);
    if (r.hit && r.damageTotal > 0) {
      const ign = arremessosRdIgnorada(useCharacterStore.getState().characters.find((x) => x.id === c.id) ?? c, arma, turnInfo);
      applyDamage(alvo2.id, r.damageTotal, (r.damageType ?? undefined) as never, { attackerId: c.id, isMelee: false, rdIgnore: ign });
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
          attacker: c, weapon: arma, targetDefense: targetDef,
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
    applyDamage(target.id, total, tipo as never, { attackerId: c.id, isMelee: false, rdIgnore: rdIgn });
    if (tiros.some((t) => t.r.critical)) checarRenovacaoCritico(true, target.name);
    void tempestadeGolpe(target);
    void explosaoDragao(target, total, tipo);
    setLastResult({ ...tiros[0].r, damageTotal: total, damageRolls: tiros.flatMap((t) => t.r.damageRolls) });
    setPhase('done');
  };

  const handleRerollDamage = async () => {
    if (!mainWeapon || !lastResult || !lastResult.canRerollDamage) return;
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
        applyDamage(target.id, r2.damageTotal - lastResult.damageTotal, (lastResult.damageType ?? undefined) as never, {
          attackerId: c.id, isMelee: mainWeapon.range === 'melee', ignoresRD: true,
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
    // Recompõe modificadores totais (idênticos ao roll original).
    const modsTotal = lastResult.modifiers.reduce((a, m) => a + m.value, 0);
    const newAttackTotal = newNat + modsTotal;
    // Mantém canRerollDamage e damage se já tinha sido rolado; senão re-resolve hit.
    const w = mainWeapon;
    const baseCrit = w.critRange ?? 20;
    // Aproximação: usa critRange do resultado anterior se já era crítico, senão o base.
    const wasCrit = lastResult.critical;
    const critRangeApprox = wasCrit ? Math.min(baseCrit, oldNat) : baseCrit;
    const newCritical = newNat >= critRangeApprox;
    const newHit = newAttackTotal >= ctx.targetDefense || newCritical;

    // Atualiza memória de turno (substitui).
    recordAttackResult(c.id, newHit, { replaceLast: true });

    // Atualiza UI: novo natural/total/hit/critical, zera dano (jogador rola de novo se acertou).
    setLastResult({
      ...lastResult,
      natural: keptNat,
      attackTotal: newAttackTotal,
      hit: newHit,
      critical: newCritical,
      criticalFail: false,
      damageTotal: 0,
      damageRolls: [],
      notes: [...lastResult.notes, `🍀 Sorte: d20 re-rolado (${oldNat}→${newNat}, mantido ${keptNat})`],
    });
    if (newHit) {
      // Volta a esperar o jogador rolar o dano.
      setPendingResult({
        ...lastResult,
        natural: keptNat, attackTotal: newAttackTotal, hit: newHit, critical: newCritical, criticalFail: false,
      });
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


        {/* ─── EMPUNHADURA ─────────────────────────────────────────────── */}
        <div className="rounded-lg border border-border bg-background/40 p-2 space-y-2">
          <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Hand className="h-3 w-3" /> Empunhadura
            <span className="ml-auto text-[10px] normal-case font-normal">
              Trocas no turno: <b className="text-foreground">{c.weaponSwapsThisTurn ?? 0}</b>
              {' · '}AB: <b className="text-foreground">{c.bonusActionsCurrent}/{c.bonusActionsMax}</b>
            </span>
          </div>

          {inventoryWeapons.length === 0 ? (
            <div className="text-[11px] text-muted-foreground italic">
              Nenhuma arma do catálogo no inventário deste personagem. Adicione armas pelo módulo Itens (vincule ao personagem).
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <HandSlot
                label="Mão Principal"
                currentName={c.mainHandWeaponName ?? null}
                inventory={inventoryWeapons}
                disabledForOther={null}
                onChange={(name) => handleEquip('main', name)}
              />
              <HandSlot
                label="Mão Secundária"
                currentName={
                  // se duas-mãos, mostra a mesma arma "ocupando" mas sem permitir alterar
                  usingTwoHanded ? c.mainHandWeaponName ?? null : (offWeapon?.name ?? null)
                }
                inventory={inventoryWeapons}
                disabledForOther={c.mainHandWeaponName ?? null}
                lockedReason={usingTwoHanded ? 'Arma de duas-mãos ocupa ambos os slots' : null}
                onChange={(name) => handleEquip('off', name)}
              />
            </div>
          )}

          {mainWeapon && (
            <div className="text-[11px] text-muted-foreground">
              Atacando com <b className="text-foreground">{mainWeapon.name}</b>
              {' · '}atributo: <b className="text-foreground">{ability} ({abilityMod >= 0 ? '+' : ''}{abilityMod})</b>
              {' · '}dano: <b className="text-foreground">{mainWeapon.damage}</b>
              {hasProperty(mainWeapon, 'fineza') && ' · fineza'}
            </div>
          )}
        </div>

        {hasArsenalCiclico(c) && inCombat && (
          <div className="rounded-md border border-primary/30 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground" data-testid="arsenal-ciclico">
            <b className="text-foreground">Arsenal Cíclico</b>
            {' · '}troca livre extra: {c.arsenalFreeSwapRound === combatRound ? 'usada nesta rodada' : 'disponível'}
            {arsenalBonusAtivo(c, c.arsenalBonus?.weaponName, combatRound) && <> {' · '}<b className="text-primary">+1 dado com {c.arsenalBonus?.weaponName}</b></>}
          </div>
        )}

        {zonaAtaque && (
          <div className="flex items-center justify-between gap-2 rounded border border-primary/60 bg-primary/10 px-2 py-1 text-[11px]" data-testid="zona-risco-banner">
            <span>⚔️ Zona de Risco: ataque liberado contra <b>{characters.find((x) => x.id === zonaAtaque.alvoId)?.name ?? 'alvo'}</b> — role o ataque.</span>
            <button onClick={() => useZonaRiscoStore.getState().setAtaque(null)} className="text-muted-foreground hover:text-foreground">✕</button>
          </div>
        )}
        {/* ─── ALVO ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex flex-col gap-0.5">
            <span className="text-muted-foreground uppercase tracking-wider text-[10px]">Alvo</span>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1"
            >
              <option value="">— manual —</option>
              {possibleTargets.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
              ))}
            </select>
          </label>
          {/* Defesa do alvo é oculta para preservar a dinâmica — apenas o resultado (acerto/erro) é revelado. */}
        </div>

        {/* ─── Alcance (medido no mapa, borda a borda) ────────────────────── */}
        {mainWeapon && target && weaponRangeM !== null && targetDistanceM !== null && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px]',
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




        {/* ─── Situação (auto-lida do alvo + override manual) ─────────────── */}
        <div className="flex flex-wrap gap-2 text-[11px]">
          {mainWeapon && (hasProperty(mainWeapon, 'versatil') || hasProperty(mainWeapon, 'duas_maos')) && (
            <ToggleChip on={twoHanded || usingTwoHanded} onChange={setTwoHanded} label="Duas mãos" disabled={usingTwoHanded} />
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
          <div className="text-[10px] text-muted-foreground italic">
            ⚠ Sem combate ativo: a contagem de ataques prévios e trocas de arma só zera com o botão "Resetar turno" (não há virada automática de iniciativa).
          </div>
        )}

        {/* ─── Artes do Combate (Especialista em Combate) ─────────────────── */}
        {temArtes && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
              <Zap className="h-3 w-3" /> Artes do Combate
              <span className="ml-auto normal-case font-normal text-muted-foreground">
                Preparo: <b className={preparoAtual > 0 ? 'text-amber-300' : 'text-destructive'}>{preparoAtual}</b>/{preparoMax}
                {arteCustoTotal > 0 && <span className="text-amber-200"> · custo {arteCustoTotal} PP</span>}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <ToggleChip on={arteDistracao} onChange={setArteDistracao} label={`Distração Letal (1 PP) · −${metadeSab(c)} Def do alvo`} disabled={preparoAtual < 1} />
              <ToggleChip on={arteExecucao} onChange={setArteExecucao} label={`Execução Silenciosa (1 PP) · +${execucaoSilenciosaDice(c)}d6`} disabled={preparoAtual < 1 || !targetUnaware} />
              <ToggleChip on={arteGolpe} onChange={setArteGolpe} label={`Golpe Descendente (1 PP) · +${metadeSab(c)} Def sua`} disabled={preparoAtual < 1 || mainWeapon?.range !== 'melee'} />
              <ToggleChip on={arteInvestida} onChange={setArteInvestida} label={`Investida Imediata (2 PP) · ${investidaMoveMeters(c).toLocaleString('pt-BR')} m`} disabled={preparoAtual < 2 || !target} />
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
          <div className="flex items-center justify-between gap-2 rounded border border-primary/60 bg-primary/10 px-2 py-1 text-[11px]" data-testid="arremesso-rapido-banner">
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
            onClick={() => handleRoll()}
            disabled={!mainWeapon || !rangeOk || phase === 'rolling-hit' || phase === 'await-second-d20' || phase === 'rolling-second-d20' || phase === 'await-dmg' || phase === 'rolling-dmg'}
            title={!rangeOk ? rangeBlockReason ?? undefined : investidaCobreDistancia ? 'Investida Imediata cobre a distância' : longoCobre ? 'Golpe Longo cobre a distância' : undefined}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold transition',
              mainWeapon && rangeOk && phase !== 'rolling-hit' && phase !== 'await-second-d20' && phase !== 'rolling-second-d20' && phase !== 'await-dmg' && phase !== 'rolling-dmg'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
            )}
          >
            <Dice5 className={cn('h-3.5 w-3.5', phase === 'rolling-hit' && 'animate-spin')} />
            {phase === 'rolling-hit' ? 'Rolando ataque…' : 'Rolar Ataque'}
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
            && (c.luckCurrent ?? 0) > 0
            && c.luckMax != null && (
            <button
              type="button"
              onClick={handleLuckRerollAttack}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-400/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 animate-fade-in"
              title="Gastar 1 ponto de Sorte para re-rolar o d20 do ataque e ficar com o MAIOR resultado. Pode repetir enquanto houver pontos. Indisponível em falha crítica."
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
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
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
              <ul className="text-[11px] text-muted-foreground list-disc list-inside">
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
            <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-accent">
              <Shield className="h-3 w-3" /> Reações Disponíveis
            </div>
            {reactions.map(id => {
              const r = REACTION_LABELS[id];
              if (!r) return null;
              return (
                <div key={id} className="text-[11px]">
                  <div className="font-bold">{r.name}</div>
                  <div className="text-muted-foreground"><Zap className="inline h-3 w-3" /> {r.trigger}</div>
                  <div>{r.effect}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Bônus de talentos (Especialistas, Mestre dos Chicotes, Apunhaladora, Enérgica, Mortal/Fatal etc.) são aplicados automaticamente quando a arma e a situação combinarem.
        </div>
        </>)}
      </div>
    </div>
  );
}

function HandSlot({
  label, currentName, inventory, onChange, disabledForOther, lockedReason,
}: {
  label: string;
  currentName: string | null;
  inventory: { item: { id: string; name: string }; weapon: Weapon }[];
  onChange: (name: string | null) => void;
  /** Nome de arma já equipada na outra mão (não pode aparecer aqui se for o mesmo item). */
  disabledForOther: string | null;
  lockedReason?: string | null;
}) {
  const locked = !!lockedReason;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
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
      <select
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
          // Permite a MESMA arma duas vezes só se houver duas instâncias no inventário,
          // mas o filtro mais simples (e suficiente) é desabilitar quando o nome casa com a outra mão.
          const isDuplicate = disabledForOther && weapon.name === disabledForOther;
          return (
            <option key={item.id} value={weapon.name} disabled={!!isDuplicate}>
              {weapon.name} ({weapon.group}){isDuplicate ? ' — em uso' : ''}
            </option>
          );
        })}
      </select>
      {locked && <div className="text-[10px] text-muted-foreground italic">{lockedReason}</div>}
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
