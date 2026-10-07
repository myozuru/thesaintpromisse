/**
 * PlayerActionBar — hotbar estilo MMO na parte inferior do mapa.
 *
 * Visível APENAS para o player (role === 'PLAYER') e APENAS quando for o
 * turno do personagem dele em combate. Possui 4 categorias:
 *   • Ataque (arma)      • Feitiços
 *   • Aptidões (AU/CL/DOM/BAR/ER)   • Especiais + Itens
 *
 * Clicar em uma categoria expande um painel acima da hotbar com a lista
 * correspondente (transição suave). Clicar novamente fecha. Por enquanto
 * os itens da lista são informativos (nome + descrição). A execução real
 * continua sendo feita pelos painéis dedicados da ficha.
 */
import { useEffect, useMemo, useState } from 'react';
import { Swords, Sparkles, Zap, Package, X, Target, AlertTriangle, Check, HeartHandshake, BatteryCharging } from 'lucide-react';
import { isSuporte } from '@/lib/suporteAbilities';
import { parseRangeMeters, touchDistanceMeters, outOfRangeMessage } from '@/lib/touchRange';
import { SuportePanel } from '@/components/fichas/SuportePanel';
import { CombateEstilosPanel } from '@/components/fichas/CombateEstilosPanel';
import { ArtesCombatePanel } from '@/components/fichas/ArtesCombatePanel';
import { isEspecialistaCombate, getAdeptoCombatStyle } from '@/lib/combateEstilos';
import { useRoleStore } from '@/stores/useRoleStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { getReactionsAvailable } from '@/lib/reactionBudget';
import { findMyCharacter } from '@/lib/myCharacter';
import { useCombatStore } from '@/stores/useCombatStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useMapStore } from '@/stores/useMapStore';
import { getAuraAptitudeById } from '@/lib/auraAptitudes';
import { getCursedAptitudeById } from '@/lib/aptitudes';
import { SpellApplyDialog } from '@/components/fichas/SpellApplyDialog';
import { getAoEFromSpell, findEntitiesInTemplate, resolveAreaTargetCharacters, getActiveSpellAreaBonus, getActiveSpellRangeBonus } from '@/lib/mapAoE';
import { useLogStore } from '@/stores/useLogStore';
import type { Spell } from '@/types';
import { cn } from '@/lib/utils';
import { isFreeformFor } from '@/lib/freeformMode';
import { FreeformActionBar } from './FreeformActionBar';
import { AttackPanel } from '@/components/fichas/AttackPanel';

type Category = 'ataque' | 'feiticos' | 'aptidoes' | 'especiais' | 'classe' | 'artes';

interface ListEntry {
  id: string;
  name: string;
  description?: string;
  meta?: string;
  disabled?: boolean;
  disabledReason?: string;
}


export function PlayerActionBar() {
  const role = useRoleStore((s) => s.role);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const allCharacters = useCharacterStore((s) => s.characters);
  const inCombat = useCombatStore((s) => s.inCombat);
  const initiativeOrder = useCombatStore((s) => s.initiativeOrder);
  const currentTurnIndex = useCombatStore((s) => s.currentTurnIndex);
  const freeformMode = useCombatStore((s) => s.freeformMode);
  const inventoryMap = useInventoryStore((s) => s.items);

  const [open, setOpen] = useState<Category | null>(null);
  const [castingSpell, setCastingSpell] = useState<Spell | null>(null);
  /** Feitiço "armado": aguardando o player clicar num token-alvo. */
  const [armedSpell, setArmedSpell] = useState<Spell | null>(null);
  /** ID do personagem-alvo escolhido (clique no token). */
  const [targetCharId, setTargetCharId] = useState<string | null>(null);
  /** IDs de personagens atingidos por um feitiço em ÁREA já posicionado. */
  const [areaTargetIds, setAreaTargetIds] = useState<string[] | null>(null);
  /** IDs de ENTIDADES (tokens) atingidos pela área — inclui tokens sem ficha. */
  const [areaHitEntityIds, setAreaHitEntityIds] = useState<string[] | null>(null);
  /** ID do template AoE temporário criado pelo posicionamento (removido ao fechar). */
  const [areaTemplateId, setAreaTemplateId] = useState<string | null>(null);
  /** Feitiço em área já posicionado, aguardando confirmação final do player. */
  const [pendingAreaSpell, setPendingAreaSpell] = useState<Spell | null>(null);

  // Mapa: entidades + grid (para calcular distância) + seleção atual.
  const entities = useMapStore((s) => s.entities);
  const gridConfig = useMapStore((s) => s.gridConfig);
  const mapSelection = useMapStore((s) => s.selectedIds);

  const activeChar = useMemo(() => {
    const entry = initiativeOrder[currentTurnIndex];
    if (!entry) return null;
    return allCharacters.find((c) => c.id === entry.charId) ?? null;
  }, [initiativeOrder, currentTurnIndex, allCharacters]);

  // Personagem "meu" (mesma heurística do PartyPanel).
  const myChar = useMemo(() => {
    if (role !== 'PLAYER') return null;
    return findMyCharacter(allCharacters, activeProfileId);
  }, [role, allCharacters, activeProfileId]);

  /**
   * Mostra a hotbar quando:
   *  • PLAYER: é o turno do personagem do player ativo.
   *  • MASTER: é o turno de um personagem controlado pelo mestre
   *            (ficha criada pelo mestre OU categoria diferente de PLAYER).
   */
  const isMyTurn = useMemo(() => {
    if (!inCombat || !activeChar) return false;
    if (role === 'MASTER') {
      const masterControlled =
        (activeChar as any).createdBy === 'MASTER' ||
        activeChar.category !== 'PLAYER';
      return masterControlled;
    }
    if (role !== 'PLAYER' || !myChar) return false;
    if (activeChar.id === myChar.id) return true;
    if (activeProfileId && activeChar.profileId === activeProfileId) return true;
    return false;
  }, [role, inCombat, activeChar, myChar, activeProfileId]);


  // ─── Listas por categoria ──────────────────────────────────────────────
  const attackEntries: ListEntry[] = useMemo(() => {
    if (!activeChar) return [];
    const equipped = (activeChar as any).equippedWeapons as
      | { primary?: string; secondary?: string }
      | undefined;
    const list: ListEntry[] = [];
    if (equipped?.primary) {
      list.push({
        id: 'wpn-main',
        name: equipped.primary,
        meta: 'Mão Principal',
        description: 'Realiza um ataque com a arma da mão principal.',
      });
    }
    if (equipped?.secondary) {
      list.push({
        id: 'wpn-off',
        name: equipped.secondary,
        meta: 'Mão Secundária',
        description: 'Realiza um ataque com a arma da mão secundária.',
      });
    }
    if (list.length === 0) {
      list.push({
        id: 'wpn-none',
        name: 'Ataque Desarmado',
        meta: 'Sem arma equipada',
        description: 'Equipe uma arma na ficha para ver mais opções aqui.',
      });
    }
    return list;
  }, [activeChar]);

  const spellEntries: ListEntry[] = useMemo(() => {
    if (!activeChar) return [];
    const ac = activeChar as any;
    const actions = ac.actionsCurrent ?? 0;
    const bonus = ac.bonusActionsCurrent ?? 0;
    const reactions = getReactionsAvailable(ac);
    const pe = ac.peCurrent ?? 0;
    const actionLabel: Record<string, string> = {
      action: 'Ação Comum',
      bonus: 'Ação Bônus',
      reaction: 'Reação',
      full: 'Ação Completa',
      free: 'Ação Livre',
      rapida: 'Ação Rápida',
      movimento: 'Movimento',
    };
    return (activeChar.spells ?? []).map((sp) => {
      const at = sp.actionType;
      let disabled = false;
      let reason = '';
      if (at === 'action' || at === 'full') {
        if (actions <= 0) { disabled = true; reason = 'Sem Ação Comum disponível.'; }
      } else if (at === 'bonus') {
        if (bonus <= 0) { disabled = true; reason = 'Sem Ação Bônus disponível.'; }
      } else if (at === 'reaction') {
        if (reactions <= 0) { disabled = true; reason = 'Sem Reação disponível.'; }
      }
      if (!disabled && pe < (sp.costPE ?? 0)) {
        disabled = true; reason = `PE insuficiente (${pe}/${sp.costPE}).`;
      }
      const aLabel = actionLabel[at as string] ?? (at ?? '—');
      return {
        id: sp.id,
        name: sp.name,
        meta: `${aLabel} • PE ${sp.costPE}`,
        description: sp.description,
        disabled,
        disabledReason: reason,
      };
    });
  }, [activeChar]);



  const aptitudeEntries: ListEntry[] = useMemo(() => {
    if (!activeChar) return [];
    const ids: string[] = [
      ...((activeChar as any).chosenAuraAptitudes ?? []),
      ...((activeChar as any).chosenClAptitudes ?? []),
    ];
    return ids
      .map((id) => {
        const a = getAuraAptitudeById(id);
        if (!a) return null;
        return {
          id,
          name: a.name,
          meta: `${a.family ?? 'AU'} • ${a.activation ?? ''}`.trim(),
          description: a.mechanic,
        } as ListEntry;
      })
      .filter(Boolean) as ListEntry[];
  }, [activeChar]);

  const specialEntries: ListEntry[] = useMemo(() => {
    if (!activeChar) return [];
    const specials: ListEntry[] = (activeChar.chosenAptitudes ?? [])
      .map((id) => {
        const a = getCursedAptitudeById(id);
        if (!a) return null;
        return {
          id: `spec-${id}`,
          name: a.name,
          meta: 'Aptidão Especial',
          description: a.mechanic ?? a.flavor,
        } as ListEntry;
      })
      .filter(Boolean) as ListEntry[];
    const items: ListEntry[] = Object.values(inventoryMap)
      .filter((i) => i.ownerId === activeChar.id)
      .map((i) => ({
        id: `item-${i.instanceId}`,
        name: i.entity?.nome ?? 'Item',
        meta: i.usosTotais !== undefined ? `${i.usosRestantes ?? 0}/${i.usosTotais} usos` : 'Item',
        description: i.entity?.descricao ?? '',
      }));
    return [...specials, ...items];
  }, [activeChar, inventoryMap]);

  const lists: Record<Category, ListEntry[]> = {
    ataque: attackEntries,
    feiticos: spellEntries,
    aptidoes: aptitudeEntries,
    especiais: specialEntries,
    classe: [],
    artes: [],
  };

  const buttons: { key: Category; label: string; icon: React.ReactNode }[] = [
    { key: 'ataque', label: 'Ataque', icon: <Swords className="h-5 w-5" /> },
    { key: 'feiticos', label: 'Feitiços', icon: <Zap className="h-5 w-5" /> },
    { key: 'aptidoes', label: 'Aptidões', icon: <Sparkles className="h-5 w-5" /> },
    { key: 'especiais', label: 'Especiais & Itens', icon: <Package className="h-5 w-5" /> },
    ...(activeChar && isSuporte(activeChar)
      ? [{ key: 'classe' as Category, label: 'Suporte', icon: <HeartHandshake className="h-5 w-5" /> }]
      : activeChar && (isEspecialistaCombate(activeChar) || getAdeptoCombatStyle(activeChar))
      ? [{ key: 'classe' as Category, label: 'Estilos', icon: <Swords className="h-5 w-5" /> }]
      : []),
    ...(activeChar && isEspecialistaCombate(activeChar)
      ? [{ key: 'artes' as Category, label: 'Artes', icon: <BatteryCharging className="h-5 w-5" /> }]
      : []),
  ];

  // ─── Cálculo de distância entre o token do conjurador e o alvo ─────────
  // Importante: tokens de player podem não ter `characterId` direto e sim
  // apenas avatarProfileId/ownerProfileId — usar fallback via profileId
  // do personagem (mesma lógica do nameplate).
  const findEntityForChar = (charId: string | undefined, charProfileId: string | undefined) => {
    if (!charId) return null;
    const list = Object.values(entities);
    const direct = list.find((en) => en?.characterId === charId);
    if (direct) return direct;
    if (!charProfileId) return null;
    return list.find(
      (en) => en && (en.avatarProfileId === charProfileId || en.ownerProfileId === charProfileId),
    ) ?? null;
  };

  const casterEntity = useMemo(() => {
    if (!activeChar) return null;
    return findEntityForChar(activeChar.id, activeChar.profileId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, activeChar]);

  const targetEntity = useMemo(() => {
    if (!targetCharId) return null;
    const tChar = allCharacters.find((c) => c.id === targetCharId);
    return findEntityForChar(targetCharId, tChar?.profileId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, targetCharId, allCharacters]);

  const distanceMeters = useMemo(() => {
    if (!casterEntity || !targetEntity) return null;
    // Mesma regra de todas as habilidades: grade, borda a borda.
    if (casterEntity === targetEntity) return 0;
    return touchDistanceMeters(casterEntity, targetEntity, gridConfig);
  }, [casterEntity, targetEntity, gridConfig]);

  /** Alcance em metros (Toque = 1,5 m) + bônus de alcance ativo. null = sem alcance definido. */
  const spellRangeMeters = useMemo(() => {
    if (!armedSpell) return null;
    const base = parseRangeMeters(armedSpell.range);
    if (base === null) return null;
    return base + (activeChar ? getActiveSpellRangeBonus(activeChar) : 0);
  }, [armedSpell, activeChar]);

  const targetCharacter = targetCharId
    ? allCharacters.find((c) => c.id === targetCharId) ?? null
    : null;

  const areaTargetSummaries = areaHitEntityIds
    ? areaHitEntityIds.map((eid) => {
        const ent = entities[eid];
        const cid = ent?.characterId;
        const charName = cid ? allCharacters.find((c) => c.id === cid)?.name : null;
        return {
          id: eid,
          name: charName ?? ent?.label ?? 'Token',
        };
      })
    : [];

  const outOfRange =
    armedSpell && distanceMeters !== null && spellRangeMeters !== null
      ? distanceMeters > spellRangeMeters
      : false;

  // ─── Mira visual no mapa: linha do conjurador até o mouse + anel de
  // alcance, enquanto o feitiço estiver "armado" (single-target, sem AoE).
  useEffect(() => {
    const setAim = useMapStore.getState().setSingleTargetAim;
    // Para a linha de mira assim que um alvo for selecionado — ela não deve
    // continuar seguindo o cursor após o lock do alvo.
    if (!armedSpell || pendingAreaSpell || !casterEntity || targetCharId) {
      setAim(null);
      return;
    }
    setAim({
      originWorld: {
        x: casterEntity.x,
        y: casterEntity.y,
      },
      maxRangeMeters: spellRangeMeters ?? undefined,
      color: '#a78bfa',
      label: armedSpell.name,
      onCancel: () => {
        setArmedSpell(null);
        setTargetCharId(null);
      },
    });
    return () => setAim(null);
  }, [armedSpell, pendingAreaSpell, casterEntity, spellRangeMeters, targetCharId]);

  // ─── Watcher de seleção do mapa: ao armar um feitiço, clicar num token
  // (que não seja o do conjurador) define-o como alvo. ─────────────────
  useEffect(() => {
    if (!armedSpell) return;
    if (mapSelection.length !== 1) return;
    const ent = entities[mapSelection[0]];
    if (!ent) return;
    const allowSelf = armedSpell.spellType === 'buff' || armedSpell.spellType === 'heal';
    // Resolve characterId do token clicado — tokens de player podem não ter
    // characterId direto, só avatarProfileId/ownerProfileId.
    let clickedCharId = ent.characterId ?? null;
    if (!clickedCharId) {
      const prof = (ent as any).avatarProfileId ?? (ent as any).ownerProfileId ?? null;
      if (prof) {
        const matched = allCharacters.find((c) => c.profileId === prof);
        if (matched) clickedCharId = matched.id;
      }
    }
    if (!clickedCharId) return;
    if (!allowSelf && activeChar && clickedCharId === activeChar.id) return;
    setTargetCharId(clickedCharId);
  }, [armedSpell, mapSelection, entities, activeChar, allCharacters]);



  const cancelArm = () => {
    setArmedSpell(null);
    setTargetCharId(null);
  };

  const confirmTarget = () => {
    if (!armedSpell || !targetCharId || outOfRange) return;
    setCastingSpell(armedSpell);
    setArmedSpell(null); // fecha o overlay de mira — o dialog assume daqui
  };

  const cancelAreaCast = () => {
    if (areaTemplateId) useMapStore.getState().removeTemplate(areaTemplateId);
    useMapStore.getState().setAoETargetPreview(null);
    setPendingAreaSpell(null);
    setAreaTargetIds(null);
    setAreaHitEntityIds(null);
    setAreaTemplateId(null);
  };

  const confirmAreaCast = () => {
    if (!pendingAreaSpell || !activeChar) return;
    const aoe = getAoEFromSpell(pendingAreaSpell);
    useLogStore.getState().addLog(
      'combat',
      `🎯 ${activeChar.name} mira ${pendingAreaSpell.name} em área${aoe ? ` (${aoe.kind} ${aoe.sizeMeters}m)` : ''} → ${areaTargetIds?.length ?? 0} alvo(s)`,
    );
    setCastingSpell(pendingAreaSpell);
    setPendingAreaSpell(null);
    setTargetCharId(null);
    setArmedSpell(null);
  };

  if (!isMyTurn) return null;
  // Modo Livre (global ou override por ficha): dano/ações resolvidos por fora —
  // mostra apenas a barra simplificada de rolagem (dano/cura).
  if (isFreeformFor(activeChar as any, freeformMode)) {
    return <FreeformActionBar character={activeChar as any} />;
  }

  const activeList = open ? lists[open] : [];
  const activeLabel = open ? buttons.find((b) => b.key === open)?.label : '';

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center gap-2">
      {/* Painel de conjuração (rola TR / acerto / dano) — no MESMO lugar do overlay de Mira */}
      {castingSpell && activeChar && (
        <div className="pointer-events-auto min-w-[360px] max-w-[460px] w-full animate-fade-in">
          <SpellApplyDialog
            spell={castingSpell}
            sourceCharId={activeChar.id}
            areaMode={areaTargetIds !== null}
            initialTargetIds={
              areaTargetIds && areaTargetIds.length > 0
                ? areaTargetIds
                : targetCharId
                ? [targetCharId]
                : undefined
            }
            onClose={() => {
              // Se o feitiço tem Área Persistente habilitada, NÃO remove o template:
              // anexa o bloco `persistent` para o motor de combate aplicar dano/condição
              // por turno a quem estiver dentro.
              const persistCfg = castingSpell?.persistentArea;
              if (persistCfg?.enabled && areaTemplateId && activeChar) {
                const mp = useMapStore.getState();
                const tpl = mp.templates.find((t) => t.id === areaTemplateId);
                if (tpl) {
                  // Extrai dano do feitiço (XdY+N) para tick.
                  const m = String(castingSpell?.damageDice ?? '').match(/(\d+)d(\d+)\s*([+-]\s*\d+)?/i);
                  const numDice = m ? parseInt(m[1], 10) : 0;
                  const dieSize = m ? parseInt(m[2], 10) : 0;
                  const rollMod = m && m[3] ? (parseInt(m[3].replace(/\s+/g, ''), 10) || 0) : 0;
                  const dmgMod = rollMod + (castingSpell?.damageBonus ?? 0) + (castingSpell?.fixedDamage ?? 0);
                  const damage = numDice > 0 && dieSize > 0
                    ? { numDice, dieSize, mod: dmgMod, type: castingSpell?.damageType ?? 'DCO' }
                    : null;
                  // Extrai condição (primeira) do feitiço para tick.
                  const firstCond = (castingSpell?.conditions ?? [])[0];
                  let condBlock: typeof tpl.persistent extends infer T ? (T extends { condition: infer C } ? C : never) : never;
                  condBlock = null as any;
                  if (firstCond?.conditionId) {
                    const { ALL_CONDITIONS } = require('@/types/conditions');
                    const cdef = ALL_CONDITIONS.find((c: any) => c.id === firstCond.conditionId);
                    condBlock = {
                      conditionId: firstCond.conditionId,
                      name: cdef?.name ?? firstCond.conditionId,
                      icon: cdef?.icon ?? '⚠',
                      durationMode: firstCond.durationMode ?? 'ate_acabar',
                      endCD: firstCond.endCD,
                      endTrType: firstCond.endTrType,
                      turns: firstCond.durationTurns || 1,
                    } as any;
                  }
                  mp.updateTemplate(areaTemplateId, {
                    persistent: {
                      ownerCharId: activeChar.id,
                      ownerCharName: activeChar.name,
                      sourceLabel: castingSpell?.name ?? 'Zona',
                      remainingTurns: persistCfg.durationTurns,
                      config: persistCfg,
                      damage,
                      condition: condBlock,
                      zoneCD: castingSpell?.bonusDC ?? 10,
                      zoneTRType: String(castingSpell?.saveAttr ?? 'reflexos').toLowerCase(),
                      affected: {},
                    },
                  });
                  useLogStore.getState().addLog(
                    'combat',
                    `🌫 ${activeChar.name} criou zona persistente "${castingSpell?.name}" (${persistCfg.durationTurns} turnos).`,
                  );
                }
              } else if (areaTemplateId) {
                useMapStore.getState().removeTemplate(areaTemplateId);
              }
              useMapStore.getState().setAoETargetPreview(null);
              setCastingSpell(null);
              setArmedSpell(null);
              setPendingAreaSpell(null);
              setTargetCharId(null);
              setAreaTargetIds(null);
              setAreaHitEntityIds(null);
              setAreaTemplateId(null);
            }}
          />
        </div>
      )}

      {pendingAreaSpell && !castingSpell && (
        <div className="pointer-events-auto rounded-xl border border-primary/50 bg-background/95 backdrop-blur-md shadow-2xl px-4 py-3 min-w-[360px] max-w-[480px] animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
                Área selecionada
              </div>
              <div className="text-sm font-bold text-primary">{pendingAreaSpell.name}</div>
            </div>
            <button
              type="button"
              onClick={cancelAreaCast}
              className="text-muted-foreground hover:text-destructive transition-colors"
              title="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            {areaTargetSummaries.length > 0 ? (
              <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
                <div className="text-xs font-mono uppercase tracking-wider text-primary mb-1">
                  Será acertado ({areaTargetSummaries.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {areaTargetSummaries.map((target) => (
                    <span
                      key={target.id}
                      className="rounded-sm border border-primary/30 bg-background/70 px-2 py-0.5 text-xs font-semibold text-foreground"
                    >
                      {target.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/15 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Nenhum token será acertado.</span>
              </div>
            )}

            <button
              type="button"
              onClick={confirmAreaCast}
              className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors"
            >
              <Check className="h-4 w-4" /> Confirmar área e lançar ataque
            </button>
          </div>
        </div>
      )}

      {/* Overlay de mira: aparece quando há um feitiço "armado" */}
      {armedSpell && !castingSpell && (
        <div className="pointer-events-auto rounded-xl border border-primary/50 bg-background/95 backdrop-blur-md shadow-2xl px-4 py-3 min-w-[360px] max-w-[460px] animate-fade-in">


          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-primary animate-pulse" />
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
                Mirando feitiço
              </div>
              <div className="text-sm font-bold text-primary">{armedSpell.name}</div>
            </div>
            <button
              onClick={cancelArm}
              className="text-muted-foreground hover:text-destructive transition-colors"
              title="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!targetCharId ? (
            <div className="text-xs text-muted-foreground italic space-y-2">
              <div>
                Clique no token do alvo no mapa para mirar.
                {spellRangeMeters !== null && (
                  <span className="block mt-1 font-mono not-italic text-foreground/80">
                    Alcance: {spellRangeMeters} m
                  </span>
                )}
              </div>
              {(armedSpell.spellType === 'buff' || armedSpell.spellType === 'heal') && activeChar && (
                <button
                  type="button"
                  onClick={() => setTargetCharId(activeChar.id)}
                  className="not-italic w-full h-8 rounded-md bg-primary/15 border border-primary/40 text-primary text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/25 transition-colors"
                >
                  <Target className="h-3.5 w-3.5" /> Lançar em mim mesmo
                </button>
              )}
            </div>

          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Alvo:</span>
                <span className="font-bold text-foreground">
                  {targetCharacter?.name ?? '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Distância:</span>
                <span className="font-mono font-bold text-foreground">
                  {distanceMeters !== null ? `${distanceMeters.toFixed(1)} m` : '—'}
                  {spellRangeMeters !== null && (
                    <span className="text-muted-foreground/70">
                      {' '}/ {spellRangeMeters} m
                    </span>
                  )}
                </span>
              </div>
              {outOfRange ? (
                <div className="flex items-center gap-2 rounded-md bg-destructive/15 border border-destructive/40 px-2 py-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{distanceMeters !== null && spellRangeMeters !== null ? outOfRangeMessage(distanceMeters, spellRangeMeters) : "Alvo fora de alcance."}</span>
                </div>
              ) : (
                <button
                  onClick={confirmTarget}
                  className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors"
                >
                  <Check className="h-4 w-4" /> Confirmar e lançar
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Painel expandido (lista) */}

      <div
        className={cn(
          'pointer-events-auto transition-all duration-300 ease-out origin-bottom',
          open
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-3 scale-95 pointer-events-none',
        )}
        style={{ minWidth: 360, maxWidth: open === 'classe' ? 640 : 520 }}
      >
        {open && (
          <div className="rounded-xl border border-border/60 bg-background/90 backdrop-blur-md shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-primary/10">
              <span className="text-xs uppercase tracking-wider font-mono text-primary font-bold flex-1">
                {activeLabel}
              </span>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Fechar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className={cn('overflow-y-auto', open === 'classe' ? 'max-h-[60vh]' : 'max-h-[420px]')}>
              {open === 'classe' && activeChar ? (
                <div className="py-2 -mx-2" onClick={(e) => e.stopPropagation()}>
                  {isSuporte(activeChar) ? <SuportePanel character={activeChar} /> : <CombateEstilosPanel character={activeChar} />}
                </div>
              ) : open === 'artes' && activeChar ? (
                <div className="py-2 -mx-2" onClick={(e) => e.stopPropagation()}>
                  <ArtesCombatePanel character={activeChar} />
                </div>
              ) : open === 'ataque' && activeChar ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <AttackPanel character={activeChar} />
                </div>
              ) : activeList.length === 0 ? (
                <div className="text-xs text-muted-foreground px-3 py-4 text-center">
                  Nenhuma opção disponível.
                </div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {activeList.map((e) => {
                    const handleClick = async () => {
                      if (e.disabled) return;
                      if (open === 'feiticos' && activeChar) {
                        const sp = (activeChar.spells ?? []).find((s) => s.id === e.id);
                        if (!sp) return;
                        const aoe = getAoEFromSpell(sp);
                        if (aoe) {
                          // Feitiço em área → posicionar template no mapa,
                          // coletar todos os alvos atingidos e aguardar confirmação.
                          setOpen(null);
                          cancelAreaCast();
                          // Origem = centro do token do conjurador (se houver).
                          // Inclui fallback por avatarProfileId/ownerProfileId para
                          // tokens de player sem characterId direto.
                          const entList = Object.values(useMapStore.getState().entities);
                          const casterEnt =
                            entList.find((en) => en?.characterId === activeChar.id) ??
                            (activeChar.profileId
                              ? entList.find(
                                  (en) =>
                                    en &&
                                    (en.avatarProfileId === activeChar.profileId ||
                                      en.ownerProfileId === activeChar.profileId),
                                )
                              : undefined);
                          const originWorld = casterEnt
                            ? { x: casterEnt.x, y: casterEnt.y }
                            : undefined;
                          // Alcance máximo do feitiço (em metros) extraído de sp.range.
                          // Se "Toque" ou sem número, assume 1.5m (alcance corpo-a-corpo)
                          // para que o anel apareça mesmo em feitiços curtos.
                          const rangeMatch = String(sp.range ?? '').match(/(\d+(?:[.,]\d+)?)/);
                          const baseRange = rangeMatch
                            ? parseFloat(rangeMatch[1].replace(',', '.'))
                            : 1.5;
                          const areaBonus = getActiveSpellAreaBonus(activeChar);
                          const rangeBonus = getActiveSpellRangeBonus(activeChar);
                          const finalSize = Math.max(0.5, aoe.sizeMeters + areaBonus);
                          const maxRangeMeters = baseRange + rangeBonus;
                          if (areaBonus !== 0 || rangeBonus !== 0) {
                            useLogStore.getState().addLog(
                              'combat',
                              `📐 ${activeChar.name}: buff ativo — área ${aoe.sizeMeters}m → ${finalSize}m${rangeBonus ? ` · alcance +${rangeBonus}m` : ''}.`,
                            );
                          }
                          const template = await useMapStore.getState().requestAoEPlacement({
                            kind: aoe.kind,
                            sizeMeters: finalSize,
                            widthMeters: aoe.widthMeters,
                            sourceLabel: `${activeChar.name} · ${sp.name}`,
                            color: '#a855f7',
                            originWorld,
                            maxRangeMeters,
                          });
                          if (!template) return;
                          const allEntities = useMapStore.getState().entities;
                          const hitIds = findEntitiesInTemplate(template, allEntities);
                          const resolvedTargets = resolveAreaTargetCharacters(
                            hitIds,
                            allEntities,
                            allCharacters,
                            activeChar.id,
                            casterEnt?.id,
                          );
                          setAreaTargetIds(resolvedTargets.characterIds);
                          setAreaHitEntityIds(resolvedTargets.entityIds);
                          setAreaTemplateId(template.id);
                          useMapStore.getState().setAoETargetPreview({ templateId: template.id, entityIds: resolvedTargets.entityIds });
                          setTargetCharId(null);
                          setArmedSpell(null);
                          setPendingAreaSpell(sp);
                          return;
                        }
                        cancelAreaCast();
                        setArmedSpell(sp);
                        setTargetCharId(null);
                        setAreaTargetIds(null);
                        setOpen(null);
                        useMapStore.getState().setSelected([]);
                      }
                      // aptidões/itens/ataque: a serem plugados quando você definir a lógica final.
                    };
                    const clickable = open === 'feiticos' && !e.disabled;
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={handleClick}
                          disabled={!clickable}
                          className={cn(
                            'w-full text-left px-3 py-2 group transition-colors',
                            clickable
                              ? 'hover:bg-primary/10 cursor-pointer'
                              : 'cursor-default',
                            e.disabled && 'opacity-50',
                          )}
                          title={e.disabled ? e.disabledReason : (clickable ? `Usar ${e.name}` : e.description)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground flex-1 truncate">
                              {e.name}
                            </span>
                            {e.meta && (
                              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground shrink-0">
                                {e.meta}
                              </span>
                            )}
                          </div>
                          {e.disabled ? (
                            <p className="text-xs text-destructive/90 mt-0.5">
                              {e.disabledReason}
                            </p>
                          ) : e.description && (
                            <p className="text-xs text-muted-foreground/90 mt-0.5 line-clamp-2 group-hover:line-clamp-none">
                              {e.description}
                            </p>
                          )}
                        </button>
                      </li>
                    );
                  })}

                </ul>

              )}
            </div>
          </div>
        )}
      </div>

      {/* Hotbar */}
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-border/60 bg-background/85 backdrop-blur-md px-2 py-1.5 shadow-xl">
        {buttons.map((b) => {
          const isActive = open === b.key;
          const count = lists[b.key].length;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => setOpen(isActive ? null : b.key)}
              className={cn(
                'relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-200',
                isActive
                  ? 'bg-primary/25 text-primary shadow-md shadow-primary/20 scale-105'
                  : 'text-muted-foreground hover:text-foreground hover:bg-primary/10',
              )}
              title={b.label}
            >
              {b.icon}
              <span>{b.label}</span>
              {count > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-xs font-mono font-bold flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
