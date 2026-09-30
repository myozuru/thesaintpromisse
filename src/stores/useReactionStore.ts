/**
 * Fila global de prompts de REAÇÃO.
 *
 * Auras-reação (Anuladora, Absorção Elemental, Redirecionadora) têm botões
 * manuais no painel. Esta store permite que outros pontos do sistema (ex.: o
 * `applyDamage`/`addCondition` no `useCharacterStore`) enfileirem um prompt
 * quando o gatilho ocorrer; um overlay global exibe, o jogador clica
 * "Reagir" e a reação real é executada chamando o método já existente.
 *
 * Princípio: a store NÃO conhece o motor de combate — guarda só metadados de
 * UX. Quem decide a regra é o handler do prompt no `ReactionPromptOverlay`.
 */
import { create } from 'zustand';
import type { DamageType } from '@/types';

export type ReactionKind =
  | 'absorption_offer'         // Absorção Elemental — perguntar se quer armar com o elemento recebido
  | 'nullify_offer'            // Aura Anuladora — perguntar se quer anular a condição
  | 'redirect_offer'           // Aura Redirecionadora — perguntar se quer redirecionar tiro errado
  | 'cobrir_se_offer'          // CL — Cobrir-se: após sofrer dano, oferecer escudo retroativo
  // ─── FAH ──────────────────────────────────────────────────────────────────
  | 'fah_alma_maldita_offer'   // FAH — antes de aplicar dano à Alma, perguntar se gasta uso para reduzir/anular
  | 'fah_anatomia_incompr_offer' // FAH — Anatomia Incompreensível: chance de mitigar crítico/furtivo
  | 'fah_devorador_energia_offer' // FAH — passou em TR contra Feitiço, oferecer +1 tempPE
  | 'fah_presenca_nefasta'     // FAH — início de combate, rolar TR Vontade dos inimigos vs CD Amaldiçoada
  | 'condition_end_tr_offer'    // Condição com modo "TR todos os rounds" / "Até passar em TR" — rolar TR no turno do alvo
  | 'lua_reacao_offer'         // Postura da Lua — atingido por ataque: usar reação para reduzir dano?
  | 'persistent_area_tr_offer'; // Área Persistente — rolar TR para evitar dano/condição do tick

export interface ReactionPrompt {
  id: string;
  charId: string;
  charName: string;
  kind: ReactionKind;
  /** Texto curto descrevendo o gatilho. */
  message: string;
  /** Dados auxiliares para o handler (ex.: elemento sofrido, conditionId). */
  payload?: {
    element?: DamageType;
    conditionId?: string;
    conditionName?: string;
    /** FAH: dano cru na alma antes da redução. */
    soulDamageRaw?: number;
    /** FAH: pendência de aplicar o dano à alma (consumido pelo handler). */
    pendingSoulDamage?: number;
    /** FAH: dano original do crítico/furtivo a mitigar. */
    critDamageRaw?: number;
    critDamageType?: DamageType;
    /** FAH: CD Amaldiçoada para rolagens contra inimigos. */
    cursedDC?: number;
    /** FAH: lista de inimigos no combate para Presença Nefasta. */
    enemies?: Array<{ id: string; name: string }>;
    /** condition_end_tr_offer — id da instância de ActiveCondition para remover em caso de sucesso. */
    conditionInstanceId?: string;
    /** condition_end_tr_offer — nome do TR (fortitude/reflexos/vontade/astucia/integridade). */
    endTrType?: string;
    /** condition_end_tr_offer — CD do teste. */
    endCD?: number;
    /** condition_end_tr_offer — ícone da condição. */
    conditionIcon?: string;
    /** condition_end_tr_offer — modo (apenas pra log/texto). */
    durationMode?: 'tr_todo_round' | 'ate_passar_tr';
    /** persistent_area_tr_offer — id do template/zona no mapa. */
    zoneTemplateId?: string;
    /** persistent_area_tr_offer — id da entidade (token) do mapa do alvo. */
    targetEntityId?: string;
    /** persistent_area_tr_offer — rótulo da zona (nome do feitiço). */
    zoneLabel?: string;
    /** persistent_area_tr_offer — modo do TR ('uma_vez' | 'todo_round' | 'todo_turno'). */
    zoneTRMode?: 'uma_vez' | 'todo_round' | 'todo_turno';
    /** cobrir_se_offer — dano efetivamente sofrido (Esc+HP), para refund. */
    damageDealt?: number;
    /** cobrir_se_offer — dano subtraído do HP. */
    hpLost?: number;
    /** cobrir_se_offer — dano subtraído do Esc. */
    escLost?: number;
    /** cobrir_se_offer — PE máximo gastável neste uso (2 + CL×2 + bônus spec). */
    maxPe?: number;
    /** cobrir_se_offer — PE atualmente disponível. */
    peAvailable?: number;
    /** cobrir_se_offer — PVTs por PE (4 normal, 8 Cobertura Avançada). */
    perPe?: number;
    /** cobrir_se_offer — true se tem Cobertura Avançada. */
    hasCoberturaAvancada?: boolean;
    /** lua_reacao_offer — dano do ataque antes da redução. */
    luaDamage?: number;
    luaDamageType?: DamageType;
    luaReducao?: number;
    /** lua_reacao_offer — opções originais do applyDamage (atacante, RD ignorada...). */
    luaOpts?: Record<string, unknown>;
  };
  /** Timestamp de criação — usado para ordenação. */
  createdAt: number;
}

/** Kinds que CONSOMEM a reação da rodada (1 por personagem/token).
 *  Os "*_tr_offer", "fah_presenca_nefasta" e "fah_devorador_energia_offer" são
 *  testes de resistência / acknowledgements e NÃO contam como reação. */
const REACTION_CONSUMING_KINDS: ReadonlySet<ReactionKind> = new Set<ReactionKind>([
  'absorption_offer',
  'nullify_offer',
  'redirect_offer',
  'cobrir_se_offer',
  'fah_alma_maldita_offer',
  'fah_anatomia_incompr_offer',
  'lua_reacao_offer',
]);

export function kindConsumesReaction(kind: ReactionKind): boolean {
  return REACTION_CONSUMING_KINDS.has(kind);
}

/** Limite de reações por personagem/token por rodada. */
export const REACTIONS_PER_ROUND = 1;

interface ReactionStoreState {
  prompts: ReactionPrompt[];
  /** charId → quantas reações já gastou na rodada atual (limite = 1). */
  reactionsUsedByChar: Record<string, number>;
  enqueue: (p: Omit<ReactionPrompt, 'id' | 'createdAt'>) => void;
  dismiss: (id: string) => void;
  clearForChar: (charId: string) => void;
  /** Quantas reações o personagem ainda pode usar nesta rodada. */
  reactionsLeft: (charId: string) => number;
  hasReactionAvailable: (charId: string) => boolean;
  /** Marca consumo (chamado pelo overlay ao executar uma reação). */
  consumeReaction: (charId: string) => void;
  /** Reset no início de cada rodada (chamado pelo useCombatStore). */
  resetRoundReactions: () => void;
}

export const useReactionStore = create<ReactionStoreState>((set, get) => ({
  prompts: [],
  reactionsUsedByChar: {},
  enqueue: (p) =>
    set((state) => ({
      prompts: [
        ...state.prompts,
        { ...p, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now() },
      ],
    })),
  dismiss: (id) => set((state) => ({ prompts: state.prompts.filter((x) => x.id !== id) })),
  clearForChar: (charId) =>
    set((state) => ({ prompts: state.prompts.filter((x) => x.charId !== charId) })),
  reactionsLeft: (charId) =>
    Math.max(0, REACTIONS_PER_ROUND - (get().reactionsUsedByChar[charId] ?? 0)),
  hasReactionAvailable: (charId) =>
    (get().reactionsUsedByChar[charId] ?? 0) < REACTIONS_PER_ROUND,
  consumeReaction: (charId) =>
    set((state) => ({
      reactionsUsedByChar: {
        ...state.reactionsUsedByChar,
        [charId]: (state.reactionsUsedByChar[charId] ?? 0) + 1,
      },
    })),
  resetRoundReactions: () => set({ reactionsUsedByChar: {} }),
}));

/** Helper de uso externo (combate): notifica que um ataque à distância ERROU
 *  para o atacante `attackerId`. Se ele tem `aura_redirecionadora` e PE, gera
 *  um prompt. Importação tardia para evitar ciclos. */
export function notifyMissedRangedAttack(attackerId: string) {
  // Lazy import — useCharacterStore importa este arquivo indiretamente via overlay.
  import('@/stores/useCharacterStore').then(({ useCharacterStore }) => {
    const c = useCharacterStore.getState().characters.find((x) => x.id === attackerId);
    if (!c) return;
    if (!(c.chosenAuraAptitudes ?? []).includes('aura_redirecionadora')) return;
    if ((c.peCurrent ?? 0) < 2) return;
    useReactionStore.getState().enqueue({
      charId: c.id,
      charName: c.name,
      kind: 'redirect_offer',
      message: `${c.name} errou um ataque à distância — Aura Redirecionadora disponível (2 PE).`,
    });
  });
}
