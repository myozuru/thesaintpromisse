import { create } from 'zustand';
import { terraPvtPatch, ceuPreparoPatch, TEMPESTADE_IMOVEL_PREFIX } from '@/lib/posturas';

/** Posturas no começo do turno: Terra (PVT), Céu (preparo temporário) e fim do Imóvel da Tempestade. */
function inicioTurnoPostura(charId: string) {
  const st = useCharacterStore.getState();
  const eu = st.characters.find((x) => x.id === charId);
  if (eu) {
    const terra = terraPvtPatch(eu as never);
    const ceu = ceuPreparoPatch(eu as never);
    if (terra || ceu) st.updateCharacter(charId, { ...(terra ?? {}), ...(ceu ?? {}) });
  }
  const marca = `${TEMPESTADE_IMOVEL_PREFIX}${charId}:`;
  for (const ch of useCharacterStore.getState().characters) {
    for (const ac of ch.activeConditions ?? []) {
      if (ac.id.startsWith(marca)) useCharacterStore.getState().removeCondition(ch.id, ac.id);
    }
  }
}
import { persist } from 'zustand/middleware';
import { useCharacterStore } from './useCharacterStore';
import { useReactionStore } from './useReactionStore';

/**
 * Para cada condição ativa em `charId` cujo `durationMode` exija TR no turno do
 * alvo (`tr_todo_round` ou `ate_passar_tr`), enfileira um prompt para o jogador
 * (ou Mestre) rolar o teste. Modo `ate_acabar` é ignorado — expira sozinho.
 */
function enqueueConditionEndTRPrompts(charId: string) {
  const char = useCharacterStore.getState().characters.find((c) => c.id === charId);
  if (!char) return;
  const conds = char.activeConditions || [];
  for (const cd of conds) {
    const mode = (cd as any).durationMode;
    if (mode !== 'tr_todo_round' && mode !== 'ate_passar_tr') continue;
    const trType = (cd as any).endTrType || 'reflexos';
    const cd_ = (cd as any).endCD ?? 10;
    const turnsLeft = cd.remainingTurns;
    const turnsTxt = mode === 'ate_passar_tr'
      ? 'sem prazo'
      : (turnsLeft === -1 ? '∞' : `${turnsLeft} turno${turnsLeft === 1 ? '' : 's'} restante${turnsLeft === 1 ? '' : 's'}`);
    useReactionStore.getState().enqueue({
      charId,
      charName: char.name,
      kind: 'condition_end_tr_offer',
      message: `${char.name}: role TR ${trType.toUpperCase()} para se livrar de ${cd.icon} ${cd.name} (${turnsTxt}).`,
      payload: {
        conditionInstanceId: cd.id,
        conditionId: cd.conditionId,
        conditionName: cd.name,
        conditionIcon: cd.icon,
        endTrType: trType,
        endCD: cd_,
        durationMode: mode,
      },
    });
  }
}

/** Aplica/agenda efeitos de Áreas Persistentes para o token vinculado a `charId`
 *  no início do turno dele. Decremento de duração da zona é feito 1×/rodada. */
function tickPersistentAreasFor(charId: string, opts: { decrementRound?: boolean } = {}) {
  import('@/stores/useMapStore').then(({ useMapStore }) => {
    import('@/lib/mapAoE').then(({ findEntitiesInTemplate }) => {
      import('@/stores/useCharacterStore').then(({ useCharacterStore }) => {
        import('@/stores/useReactionStore').then(({ useReactionStore }) => {
          import('@/stores/useLogStore').then(({ useLogStore }) => {
            const mp = useMapStore.getState();
            const charStore = useCharacterStore.getState();
            const char = charStore.characters.find((c) => c.id === charId);
            if (!char) return;
            const ent = Object.values(mp.entities).find((e) => {
              if (!e) return false;
              if (e.characterId === charId) return true;
              // Fallback: tokens de jogador usam avatarProfileId/ownerProfileId.
              const profileId = (char as any).profileId;
              if (profileId && (e.avatarProfileId === profileId || e.ownerProfileId === profileId)) return true;
              return false;
            });
            const round = useCombatStore.getState().round;

            const zones = mp.templates.filter((t) => !!t.persistent);
            for (const tpl of zones) {
              const pz = tpl.persistent!;
              // Decremento por rodada (apenas 1x — feito quando começa a rodada).
              if (opts.decrementRound) {
                pz.remainingTurns = Math.max(0, pz.remainingTurns - 1);
                if (pz.remainingTurns === 0) {
                  mp.removeTemplate(tpl.id);
                  useLogStore.getState().addLog('combat', `⏳ Zona "${pz.sourceLabel}" expirou.`);
                  continue;
                }
                // Reseta imunidade "todo_round".
                if (pz.config.trMode === 'todo_round') {
                  for (const k of Object.keys(pz.affected)) {
                    pz.affected[k].immune = false;
                  }
                }
              }
              if (!ent) continue;
              const inside = findEntitiesInTemplate(tpl, mp.entities).includes(ent.id);
              const state = pz.affected[ent.id] || {};
              const wasInside = state.lastInsideRound === round - 1 || state.lastInsideRound === round;

              if (inside) {
                pz.affected[ent.id] = { ...state, lastInsideRound: round, residualLeft: undefined };
                if (!pz.config.applyOnTurn) continue;
                if (state.immune) continue;
                // TR?
                if (pz.config.trMode !== 'todo_round' || !state.immune) {
                  if (pz.config.trMode === 'uma_vez' && state.immune) continue;
                  useReactionStore.getState().enqueue({
                    charId,
                    charName: char.name,
                    kind: 'persistent_area_tr_offer',
                    message: `${char.name}: dentro de ${pz.sourceLabel} — role TR ${pz.zoneTRType.toUpperCase()} ou sofre o efeito.`,
                    payload: {
                      zoneTemplateId: tpl.id,
                      targetEntityId: ent.id,
                      zoneLabel: pz.sourceLabel,
                      zoneTRMode: pz.config.trMode,
                      endTrType: pz.zoneTRType,
                      endCD: pz.zoneCD,
                    },
                  });
                }
              } else if (wasInside) {
                // Saiu da zona: aplica residual conforme config.
                const res = pz.config.residual;
                if (res?.mode === 'manter_turnos' && state.residualLeft === undefined) {
                  pz.affected[ent.id] = { ...state, lastInsideRound: undefined, residualLeft: res.turns };
                }
              }

              // Tick residual ao sair (mesmo após sair).
              const cur = pz.affected[ent.id];
              if (cur?.residualLeft && cur.residualLeft > 0 && !inside) {
                const res = pz.config.residual;
                if (res?.keepDamage && pz.damage) {
                  charStore.applyDamage(charId, pz.damage.numDice * Math.ceil((pz.damage.dieSize + 1) / 2) + pz.damage.mod, pz.damage.type as any, { tags: ['__persistent_area_residual'] });
                }
                if (res?.keepCondition && pz.condition) {
                  charStore.addCondition(charId, {
                    id: `pz_res_${tpl.id}_${Date.now()}`,
                    conditionId: pz.condition.conditionId,
                    name: pz.condition.name,
                    icon: pz.condition.icon,
                    remainingTurns: 1,
                    remainingRounds: 0,
                    sourceCharName: pz.ownerCharName,
                    durationMode: pz.condition.durationMode,
                    endCD: pz.condition.endCD,
                    endTrType: pz.condition.endTrType,
                  } as any);
                }
                cur.residualLeft -= 1;
              }
            }
            // Persiste mutações (zona atualiza in-place; força re-render).
            mp.updateTemplate(zones[0]?.id ?? '__noop__', {});
          });
        });
      });
    });
  });
}



export interface InitiativeEntry {
  charId: string;
  charName: string;
  roll: number;
  bonus: number;
  total: number;
}

interface CombatStore {
  inCombat: boolean;
  /** Identificador do combate atual (muda a cada startCombat). */
  combatId?: string | null;
  round: number;
  currentTurnIndex: number;
  initiativeOrder: InitiativeEntry[];
  /**
   * IDs dos personagens marcados pelo Mestre como participantes do próximo
   * combate. A iniciativa é rolada apenas para esses IDs e o reset de "cena"
   * (escopo `scene`) ocorre apenas para esses ao encerrar o combate.
   * Persistido para sobreviver a refresh.
   */
  participantIds: string[];
  /** Metros de movimento já consumidos no turno atual, por charId. */
  movementUsedByChar: Record<string, number>;
  /** Cronômetro de turno (definido pelo Mestre). */
  turnTimerEnabled: boolean;
  /** Duração padrão do turno em segundos. 0 = sem cronômetro. */
  turnDurationSec: number;
  /** Quanto tempo (s) restava no momento em que `turnStartedAt` foi setado. */
  turnRemainingAtStart: number;
  /** Timestamp (ms) de quando a contagem corrente começou. */
  turnStartedAt: number;
  /** Se o cronômetro está pausado. */
  turnPaused: boolean;
  /** Reações em resolução; ids impedem que uma delas retome o relógio antes das demais. */
  reactionPauseIds: string[];
  /**
   * Modo Livre (freeform): quando true, o mapa NÃO limita movimento por turno
   * e a hotbar do player fica oculta. Usado para mestrar fora do sistema
   * (dano e ações resolvidos pelo Mestre por fora). Apenas o Mestre liga/desliga.
   */
  freeformMode: boolean;
  setFreeformMode: (v: boolean) => void;
  setMovementUsed: (charId: string, meters: number) => void;
  addMovementUsed: (charId: string, meters: number) => void;
  resetMovementUsed: (charId: string) => void;
  toggleParticipant: (charId: string) => void;
  setParticipants: (ids: string[]) => void;
  clearParticipants: () => void;
  startCombat: (entries: InitiativeEntry[]) => void;
  nextTurn: () => { endOfRound: boolean };
  endCombat: () => void;
  /** Liga/desliga o cronômetro (mestre). */
  setTurnTimerEnabled: (v: boolean) => void;
  /** Define a duração-base do turno (segundos). */
  setTurnDuration: (sec: number) => void;
  /** Pausa o cronômetro mantendo o tempo restante. */
  pauseTurnTimer: () => void;
  /** Retoma a contagem. */
  resumeTurnTimer: () => void;
  pauseTurnTimerForReaction: (id: string) => void;
  resumeTurnTimerForReaction: (id: string) => void;
  /** Soma `delta` segundos ao tempo restante (pode ser negativo). */
  adjustTurnTime: (deltaSec: number) => void;
  /** Reinicia o tempo do turno atual para `turnDurationSec`. */
  resetTurnTimer: () => void;
  /** Retorna o tempo restante computado agora. */
  getTurnRemaining: () => number;
}

export const useCombatStore = create<CombatStore>()(
  persist(
    (set, get) => ({
      inCombat: false,
      round: 1,
      currentTurnIndex: 0,
      initiativeOrder: [],
      participantIds: [],
      movementUsedByChar: {},
      turnTimerEnabled: false,
      turnDurationSec: 60,
      turnRemainingAtStart: 60,
      turnStartedAt: 0,
      turnPaused: true,
      reactionPauseIds: [],
      freeformMode: false,
      setFreeformMode: (v) => set({ freeformMode: !!v }),
      setTurnTimerEnabled: (v) =>
        set((s) => ({
          turnTimerEnabled: v,
          turnRemainingAtStart: s.turnDurationSec,
          turnStartedAt: Date.now(),
          // Ao ligar durante combate, começa a contar; caso contrário fica em standby.
          turnPaused: v ? !s.inCombat : true,
        })),
      setTurnDuration: (sec) => {
        const dur = Math.max(5, Math.min(3600, Math.round(sec)));
        set(() => ({
          turnDurationSec: dur,
          turnRemainingAtStart: dur,
          turnStartedAt: Date.now(),
        }));
      },
      pauseTurnTimer: () => {
        const remaining = get().getTurnRemaining();
        set({ turnPaused: true, turnRemainingAtStart: remaining, turnStartedAt: Date.now() });
      },
      resumeTurnTimer: () =>
        set({ turnPaused: false, turnStartedAt: Date.now() }),
      pauseTurnTimerForReaction: (id) => set((s) => {
        if (s.reactionPauseIds.includes(id)) return s;
        const remaining = s.reactionPauseIds.length ? s.turnRemainingAtStart : get().getTurnRemaining();
        return {
          reactionPauseIds: [...s.reactionPauseIds, id],
          turnRemainingAtStart: s.turnTimerEnabled ? remaining : s.turnRemainingAtStart,
          turnStartedAt: Date.now(),
        };
      }),
      resumeTurnTimerForReaction: (id) => set((s) => {
        if (!s.reactionPauseIds.includes(id)) return s;
        const reactionPauseIds = s.reactionPauseIds.filter((x) => x !== id);
        return {
          reactionPauseIds,
          // O cronômetro só volta a contar quando também não estiver pausado manualmente.
          turnStartedAt: !reactionPauseIds.length && !s.turnPaused ? Date.now() : s.turnStartedAt,
        };
      }),
      adjustTurnTime: (deltaSec) => {
        const remaining = get().getTurnRemaining();
        const next = Math.max(0, Math.min(3600, remaining + deltaSec));
        set({ turnRemainingAtStart: next, turnStartedAt: Date.now() });
      },
      resetTurnTimer: () =>
        set((s) => ({
          turnRemainingAtStart: s.turnDurationSec,
          turnStartedAt: Date.now(),
          // Em combate, ao reiniciar o cronômetro ele já volta a contar
          // automaticamente (despausa). Fora de combate fica pausado.
          turnPaused: !s.inCombat,
        })),
      getTurnRemaining: () => {
        const s = get();
        if (!s.turnTimerEnabled) return 0;
        if (s.turnPaused || s.reactionPauseIds.length > 0) return Math.max(0, s.turnRemainingAtStart);
        const elapsed = (Date.now() - s.turnStartedAt) / 1000;
        return Math.max(0, s.turnRemainingAtStart - elapsed);
      },
      setMovementUsed: (charId, m) =>
        set((s) => ({ movementUsedByChar: { ...s.movementUsedByChar, [charId]: m } })),
      addMovementUsed: (charId, m) =>
        set((s) => ({
          movementUsedByChar: {
            ...s.movementUsedByChar,
            [charId]: (s.movementUsedByChar[charId] ?? 0) + m,
          },
        })),
      resetMovementUsed: (charId) =>
        set((s) => {
          const next = { ...s.movementUsedByChar };
          delete next[charId];
          return { movementUsedByChar: next };
        }),
      toggleParticipant: (charId) =>
        set((s) => ({
          participantIds: s.participantIds.includes(charId)
            ? s.participantIds.filter((id) => id !== charId)
            : [...s.participantIds, charId],
        })),
      setParticipants: (ids) => set({ participantIds: ids }),
      clearParticipants: () => set({ participantIds: [] }),
      startCombat: (entries) => {
        for (const c of useCharacterStore.getState().characters) {
          useCharacterStore.getState().updateCharacter(c.id, { omniCounters: {
            ...c.omniCounters, __omni_rodada: 1, cura_recebida_nesta_rodada: 0,
            dano_recebido_nesta_rodada: 0, vida_perdida_nesta_rodada: 0,
          } });
        }
        const sorted = [...entries].sort((a, b) => b.total - a.total);
        set((s) => ({
          inCombat: true,
          combatId: `cb-${Date.now().toString(36)}`,
          round: 1,
          currentTurnIndex: 0,
          initiativeOrder: sorted,
          movementUsedByChar: {},
          turnRemainingAtStart: s.turnDurationSec,
          turnStartedAt: Date.now(),
          turnPaused: !s.turnTimerEnabled,
        }));
        // Limpa a telemetria de reações ao iniciar combate.
        import('@/stores/useReactionStore').then(({ useReactionStore }) =>
          useReactionStore.getState().resetRoundReactions(),
        );
        // 🔗 Sincroniza com a iniciativa do mapa: para cada ficha em combate,
        // adiciona automaticamente o token vinculado (entity.characterId).
        import('@/stores/useMapStore').then(({ useMapStore }) => {
          const mapState = useMapStore.getState();
          for (const e of sorted) {
            const linked = Object.values(mapState.entities).find(
              (en) => en?.characterId === e.charId,
            );
            if (linked) {
              useMapStore.getState().addInitiativeFromEntity(linked.id, { init: e.total });
            }
          }
        });
        // Fase 2 — Aplica hook de início de turno para o 1º da iniciativa.
        const first = sorted[0];
        if (first) useCharacterStore.getState().applyTurnStartSpecHooks(first.charId);
        // 🆕 Reset do contador de toggles do slot de Venda ao iniciar combate.
        for (const e of sorted) {
          useCharacterStore.getState().updateCharacter(e.charId, {
            blindfoldTogglesThisRound: 0,
          });
        }
        // 🆕 Omni — dispara aoIniciarCombate + aoIniciarRodadaCombate para todos na rodada 1.
        import('@/lib/omni/eventBus').then(({ emitirEvento }) => {
          for (const e of sorted) {
            emitirEvento('aoIniciarCombate', {
              usuarioId: e.charId,
              cena: { rodada: 1 },
              incluirPassivas: true,
            });
            emitirEvento('aoIniciarRodadaCombate', {
              usuarioId: e.charId,
              cena: { rodada: 1 },
              incluirPassivas: true,
            });
          }
        });
        // ─── FAH — Presença Nefasta ──────────────────────────────────────────
        // Para cada FAH presente, enfileira UM prompt listando os inimigos
        // (NPCs do encontro) para o jogador rolar TR Vontade vs CD Amaldiçoada.
        const charStore = useCharacterStore.getState();
        const participants = entries.map((e) => charStore.characters.find((c) => c.id === e.charId)).filter(Boolean);
        const fahs = participants.filter((c) => c && c.origin === 'Feto Amaldiçoada Híbrido (FAH)');
        const enemies = participants
          .filter((c) => c && (c.category === 'NPC' || c.category === 'INIMIGO'))
          .map((c) => ({ id: c!.id, name: c!.name }));
        if (fahs.length > 0 && enemies.length > 0) {
          import('@/lib/fahCombatHooks').then(({ calcCursedDC }) => {
            import('@/stores/useReactionStore').then(({ useReactionStore }) => {
              for (const fah of fahs) {
                if (!fah) continue;
                useReactionStore.getState().enqueue({
                  charId: fah.id,
                  charName: fah.name,
                  kind: 'fah_presenca_nefasta',
                  message: `Presença Nefasta de ${fah.name}: role TR Vontade vs CD ${calcCursedDC(fah)} para cada inimigo.`,
                  payload: { cursedDC: calcCursedDC(fah), enemies },
                });
              }
            });
          });
        }
      },
      nextTurn: () => {
        // Omni-Engine: recalcula auras a cada virada de turno.
        import('@/lib/omni/auras').then(({ recalcularAuras }) => recalcularAuras());
        // Reset de grants de Ataque de Oportunidade (1 por rodada/turno).
        import('@/stores/useOpportunityStore').then(({ useOpportunityStore }) =>
          useOpportunityStore.getState().resetRound(),
        );
        const { currentTurnIndex, initiativeOrder, round } = get();
        const currentEntry = initiativeOrder[currentTurnIndex];
        // Desengajar dura até o fim do turno de quem desengajou.
        if (currentEntry) {
          const ce = useCharacterStore.getState().characters.find((c) => c.id === currentEntry.charId);
          if (ce?.desengajado) useCharacterStore.getState().updateCharacter(currentEntry.charId, { desengajado: false });
          if (ce?.desengajadoDe?.length) useCharacterStore.getState().updateCharacter(currentEntry.charId, { desengajadoDe: [] });
        }
        if (currentEntry) {
          useCharacterStore.getState().tickBuffs(currentEntry.charId);
          useCharacterStore.getState().tickConditions(currentEntry.charId);
          // Omni-Engine: fim de turno do atual
          import('@/lib/omni/eventBus').then(({ emitirEvento }) => {
            emitirEvento('noFimDoTurno', { usuarioId: currentEntry.charId, incluirPassivas: true });
          });
          // Expira modificadores de Vantagem/Desvantagem com escopo "turn".
          import('@/lib/omni/rollAdvantage').then(({ expireEndOfTurnFor }) => {
            expireEndOfTurnFor(currentEntry.charId);
          });
          // Expira modificadores de Sucesso/Falha Garantida com escopo "turn".
          import('@/lib/omni/autoOutcome').then(({ expireAutoOutcomesEndOfTurnFor }) => {
            expireAutoOutcomesEndOfTurnFor(currentEntry.charId);
          });
          // Amizade Inquebrável (Suporte): pergunta se quer Apoiar o Amigo ao lado.
          import('@/lib/suporteNivel2').then(({ checkAmizadeAtEndOfTurn }) =>
            checkAmizadeAtEndOfTurn(currentEntry.charId),
          );
        }
        const nextIndex = currentTurnIndex + 1;
        if (nextIndex >= initiativeOrder.length) {
          // 🆕 Omni — dispara aoFinalizarRodadaCombate ANTES de virar a rodada,
          // para todos os participantes. Permite efeitos "no fim da rodada".
          import('@/lib/omni/eventBus').then(({ emitirEvento }) => {
            for (const e of initiativeOrder) {
              emitirEvento('aoFinalizarRodadaCombate', {
                usuarioId: e.charId,
                cena: { rodada: round },
                incluirPassivas: true,
              });
            }
          });
          // 🆕 Reset do contador de toggles do slot de Venda no fim da rodada.
          for (const e of initiativeOrder) {
            useCharacterStore.getState().updateCharacter(e.charId, {
              blindfoldTogglesThisRound: 0,
            });
          }
          useCharacterStore.getState().tickRoundConditions();
          useCharacterStore.getState().tickSacrificioCooldown();
          const newRound = round + 1;
          const charStore = useCharacterStore.getState();
          charStore.characters.forEach((c) => {
            if ((c.kokusenStacks ?? 0) > 0 && c.kokusenLastRound !== undefined) {
              if (newRound - c.kokusenLastRound >= 2) {
                charStore.updateCharacter(c.id, { kokusenStacks: 0, kokusenLastRound: undefined });
              }
            }
          });
          // Limpa a telemetria; o saldo autorizado por personagem vem da ficha e é restaurado junto às ações.
          import('@/stores/useReactionStore').then(({ useReactionStore }) =>
            useReactionStore.getState().resetRoundReactions(),
          );
          set((s) => ({
            currentTurnIndex: 0,
            round: newRound,
            movementUsedByChar: {},
            turnRemainingAtStart: s.turnDurationSec,
            turnStartedAt: Date.now(),
            turnPaused: !s.turnTimerEnabled,
          }));
          import('@/stores/useMapStore').then(({ useMapStore }) => useMapStore.getState().setPendingMove(null));
          const firstEntry = initiativeOrder[0];
          if (firstEntry) {
            charStore.updateCharacter(firstEntry.charId, { weaponSwapsThisTurn: 0, attacksThisTurn: 0, lastAttackHit: undefined, mobilidadeReacaoM: 0, mobilidadeReacaoBase: 0, arteGolpeDescendente: null });
            // Assumir Postura: termina após 1 minuto (10 rodadas).
            for (const ch of charStore.characters) {
              if (ch.posturaAtiva && newRound > ch.posturaAtiva.untilRound) {
                charStore.updateCharacter(ch.id, { posturaAtiva: null });
                import('@/stores/useLogStore').then(({ useLogStore }) => useLogStore.getState().addLog('combat', `⏳ ${ch.name}: a postura terminou (1 minuto).`));
              }
            }
            inicioTurnoPostura(firstEntry.charId);
            import('@/lib/replicas').then(({ inicioTurnoReplicas }) => inicioTurnoReplicas(firstEntry.charId));
            import('@/lib/omni/custosAtivos').then(({ inicioTurnoSustentacoesAtivas }) => inicioTurnoSustentacoesAtivas(firstEntry.charId));
            // Preparo Imediato: a ação preparada expira no começo do próprio turno.
            import('@/lib/preparoImediato').then(({ expirarPreparoNoTurno }) => expirarPreparoNoTurno(firstEntry.charId));

            // Distração Letal: expira penalidades aplicadas em rodadas anteriores.
            for (const ch of charStore.characters) {
              if (ch.arteDefensePenalty && newRound > ch.arteDefensePenalty.round) {
                charStore.updateCharacter(ch.id, { arteDefensePenalty: null });
              }
            }
            // Fase 2 — Reaplica pool dedicado de Aptidões (Mestre das Aptidões).
            charStore.applyTurnStartSpecHooks(firstEntry.charId);
            import('@/lib/omni/eventBus').then(({ emitirEvento }) => {
              emitirEvento('noInicioDoTurno', { usuarioId: firstEntry.charId, incluirPassivas: true });
              // 🆕 Dispara aoIniciarRodadaCombate para TODOS os participantes.
              for (const e of initiativeOrder) {
                emitirEvento('aoIniciarRodadaCombate', {
                  usuarioId: e.charId,
                  cena: { rodada: newRound },
                  incluirPassivas: true,
                });
              }
            });
            // Apoiar (Suporte): expira efeitos concedidos por quem está iniciando o turno.
            import('@/lib/omni/rollAdvantage').then(({ expireGrantedBy }) => {
              expireGrantedBy(firstEntry.charId);
            });
            import('@/lib/suporteNivel6').then(({ expireApoiosGrantedBy }) => {
              expireApoiosGrantedBy(firstEntry.charId);
            });
            // TRs de fim de condição para o primeiro da nova rodada.
            enqueueConditionEndTRPrompts(firstEntry.charId);
            // Áreas Persistentes: decrementa a duração no início da rodada e aplica tick.
            tickPersistentAreasFor(firstEntry.charId, { decrementRound: true });
            // Reset do contador `usedThisRound` em omniActionCost.
            for (const e of initiativeOrder) {
              const ch = charStore.characters.find((c) => c.id === e.charId);
              if (!ch?.omniActionCost) continue;
              const next: typeof ch.omniActionCost = {};
              for (const [k, v] of Object.entries(ch.omniActionCost)) next[k] = { ...v, usedThisRound: 0 };
              charStore.updateCharacter(e.charId, { omniActionCost: next });
            }
          }
          return { endOfRound: true };
        }
        set((s) => ({
          currentTurnIndex: nextIndex,
          movementUsedByChar: {},
          turnRemainingAtStart: s.turnDurationSec,
          turnStartedAt: Date.now(),
          turnPaused: !s.turnTimerEnabled,
        }));
        import('@/stores/useMapStore').then(({ useMapStore }) => useMapStore.getState().setPendingMove(null));
        // Zera movimento do novo personagem ativo.
        const nextActive = initiativeOrder[nextIndex];
        if (nextActive) {
          // Apoiar (Suporte): expira efeitos concedidos por quem está iniciando o turno.
          import('@/lib/omni/rollAdvantage').then(({ expireGrantedBy }) => {
            expireGrantedBy(nextActive.charId);
          });
          import('@/lib/suporteNivel6').then(({ expireApoiosGrantedBy }) => {
            expireApoiosGrantedBy(nextActive.charId);
          });
          set((s) => {
            const m = { ...s.movementUsedByChar };
            delete m[nextActive.charId];
            return { movementUsedByChar: m };
          });
        }
        const nextEntry = initiativeOrder[nextIndex];
        if (nextEntry) {
          useCharacterStore.getState().updateCharacter(nextEntry.charId, { weaponSwapsThisTurn: 0, attacksThisTurn: 0, lastAttackHit: undefined, mobilidadeReacaoM: 0, mobilidadeReacaoBase: 0, arteGolpeDescendente: null });
          // Fase 2 — Reaplica pool dedicado de Aptidões (Mestre das Aptidões).
          useCharacterStore.getState().applyTurnStartSpecHooks(nextEntry.charId);
          inicioTurnoPostura(nextEntry.charId);
          import('@/lib/replicas').then(({ inicioTurnoReplicas }) => inicioTurnoReplicas(nextEntry.charId));
          import('@/lib/omni/custosAtivos').then(({ inicioTurnoSustentacoesAtivas }) => inicioTurnoSustentacoesAtivas(nextEntry.charId));
          // Preparo Imediato: a ação preparada expira no começo do próprio turno.
          import('@/lib/preparoImediato').then(({ expirarPreparoNoTurno }) => expirarPreparoNoTurno(nextEntry.charId));

          import('@/lib/omni/eventBus').then(({ emitirEvento }) => {
            emitirEvento('noInicioDoTurno', { usuarioId: nextEntry.charId, incluirPassivas: true });
          });
          // TRs de fim de condição (modos tr_todo_round / ate_passar_tr).
          enqueueConditionEndTRPrompts(nextEntry.charId);
          // Áreas Persistentes — tick do turno (sem decremento de rodada).
          tickPersistentAreasFor(nextEntry.charId, { decrementRound: false });
        }
        return { endOfRound: false };
      },
      endCombat: () => {
        const charStore = useCharacterStore.getState();
        const { initiativeOrder, round } = get();
        const participants = initiativeOrder.map((e) => e.charId);
        // Limpa todos os AdO ao fim do combate.
        import('@/stores/useOpportunityStore').then(({ useOpportunityStore }) =>
          useOpportunityStore.getState().clearAllGrants(),
        );
        // 🆕 Omni — dispara aoFinalizarCombate ANTES de limpar estado/cena,
        // para que efeitos consigam ler o estado atual do combate.
        import('@/lib/omni/eventBus').then(({ emitirEvento }) => {
          for (const id of participants) {
            emitirEvento('aoFinalizarCombate', {
              usuarioId: id,
              cena: { rodada: round },
              incluirPassivas: true,
            });
          }
        });
        // Reset de "cena" para todos os participantes do combate
        participants.forEach((id) => {
          charStore.resetSceneForCharacter(id);
        });
        // 🔗 Remove os tokens vinculados da iniciativa do mapa e limpa resíduos de cena.
        import('@/stores/useMapStore').then(({ useMapStore }) => {
          const mapState = useMapStore.getState();
          for (const charId of participants) {
            const linked = Object.values(mapState.entities).find(
              (en) => en?.characterId === charId,
            );
            if (linked) useMapStore.getState().removeInitiativeByEntity(linked.id);
          }
          // Zonas persistentes só decrementam durante o combate — ao encerrar,
          // elas ficariam para sempre no mapa. Removemos junto.
          const st = useMapStore.getState();
          for (const tpl of st.templates.filter((t) => !!t.persistent)) {
            st.removeTemplate(tpl.id);
          }
          st.setSingleTargetAim(null);
          st.setAoETargetPreview(null);
        });

        import('@/lib/omni/reacoesAtivas').then(({ cancelarJanelasReacoesAtivas }) => cancelarJanelasReacoesAtivas());
        // Limpa estado de combate
        set((s) => ({
          inCombat: false,
          round: 1,
          currentTurnIndex: 0,
          initiativeOrder: [],
          movementUsedByChar: {},
          turnPaused: true,
          turnRemainingAtStart: s.turnDurationSec,
          turnStartedAt: Date.now(),
        }));
      },
    }),
    {
      name: 'rpg-combat',
      partialize: (s) => ({
        participantIds: s.participantIds,
        inCombat: s.inCombat,
        round: s.round,
        currentTurnIndex: s.currentTurnIndex,
        initiativeOrder: s.initiativeOrder,
        turnTimerEnabled: s.turnTimerEnabled,
        turnDurationSec: s.turnDurationSec,
        turnRemainingAtStart: s.turnRemainingAtStart,
        turnStartedAt: s.turnStartedAt,
        turnPaused: s.turnPaused,
        freeformMode: s.freeformMode,
      }),
    },
  ),
);

// Dev-only hook for browser tests (never in production builds).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__combatStore = useCombatStore;
}
