import type { OpcoesDano } from '@/lib/omni/contextoDano';
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
import { destinatarioReacao, podeResponderReacao } from '@/lib/omni/destinatarioReacao';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';

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
    /** Opções do golpe original, preservadas ao resolver Alma Maldita. */
    soulDamageOpts?: OpcoesDano;
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
  /** Tela que originou uma decisão remota aguardada pelo motor de dano. */
  remoteClientId?: string;
  expiresAt?: number;
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
export const REACTION_DECISION_TIMEOUT_MS = 12000;

interface ReactionStoreState {
  prompts: ReactionPrompt[];
  /** charId → quantas reações já gastou na rodada atual (limite = 1). */
  reactionsUsedByChar: Record<string, number>;
  enqueue: (p: Omit<ReactionPrompt, 'id' | 'createdAt'>) => void;
  receiveRemote: (p: ReactionPrompt, requesterClientId: string) => void;
  resolveDecision: (id: string, answer: number | null) => boolean;
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
  enqueue: (p) => {
    const prompt = buildPrompt({ ...p, expiresAt: p.expiresAt ?? Date.now() + REACTION_DECISION_TIMEOUT_MS });
    const character = useCharacterStore.getState().characters.find((c) => c.id === p.charId);
    const destinatario = character ? destinatarioReacao(character) : null;
    const hasBus = typeof window !== 'undefined' && !!(window as unknown as { __worldBus?: { send?: unknown } }).__worldBus?.send;
    if (!destinatario || podeResponderReacao(destinatario) || !hasBus) {
      set((state) => ({ prompts: [...state.prompts, prompt] }));
      schedulePromptExpiry(prompt);
      return;
    }
    schedulePromptExpiry(prompt, destinatario);
    window.dispatchEvent(new CustomEvent('reaction-prompt:send', {
      detail: { tipo: 'prompt', requestId: prompt.id, destinatario, prompt },
    }));
  },
  receiveRemote: (prompt, requesterClientId) => {
    const remotePrompt = { ...prompt, remoteClientId: requesterClientId };
    set((state) => ({ prompts: [...state.prompts.filter((x) => x.id !== prompt.id), remotePrompt] }));
    schedulePromptExpiry(remotePrompt);
  },
  resolveDecision: (id, answer) => {
    const prompt = get().prompts.find((entry) => entry.id === id);
    const awaited = !!prompt?.remoteClientId || pendingReactionDecisions.has(id);
    if (prompt?.remoteClientId && typeof window !== 'undefined') sendPromptMessage({ tipo: 'resposta', requestId: id, clienteOrigem: prompt.remoteClientId, answer });
    finalizePrompt(id, answer);
    return awaited;
  },
  dismiss: (id) => {
    const prompt = get().prompts.find((entry) => entry.id === id);
    if (prompt?.remoteClientId) sendPromptMessage({ tipo: 'resposta', requestId: id, clienteOrigem: prompt.remoteClientId, answer: null });
    finalizePrompt(id, null);
  },
  clearForChar: (charId) => {
    for (const prompt of get().prompts.filter((entry) => entry.charId === charId)) get().dismiss(prompt.id);
  },
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

function buildPrompt(p: Omit<ReactionPrompt, 'id' | 'createdAt'>): ReactionPrompt {
  return { ...p, id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, createdAt: Date.now() };
}

const pendingReactionDecisions = new Map<string, (answer: number | null) => void>();
const activePromptTimers = new Map<string, ReturnType<typeof setTimeout>>();
const remotePromptRecipients = new Map<string, string>();
const promptPauseKeys = new Map<string, string>();

function sendPromptMessage(detail: Record<string, unknown>) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('reaction-prompt:send', { detail }));
}

function clearPromptTimer(id: string) {
  const timer = activePromptTimers.get(id);
  if (timer) clearTimeout(timer);
  activePromptTimers.delete(id);
  remotePromptRecipients.delete(id);
  useCombatStore.getState().resumeTurnTimerForReaction(promptPauseKeys.get(id) ?? id);
  promptPauseKeys.delete(id);
}

function finalizePrompt(id: string, answer: number | null) {
  clearPromptTimer(id);
  useReactionStore.setState((state) => ({ prompts: state.prompts.filter((entry) => entry.id !== id) }));
  const resolve = pendingReactionDecisions.get(id);
  if (resolve) {
    pendingReactionDecisions.delete(id);
    resolve(answer);
  }
}

function schedulePromptExpiry(prompt: ReactionPrompt, remoteRecipient?: string) {
  clearPromptTimer(prompt.id);
  if (remoteRecipient) remotePromptRecipients.set(prompt.id, remoteRecipient);
  const pauseKey = prompt.remoteClientId ? `reaction-ui:${prompt.id}` : prompt.id;
  promptPauseKeys.set(prompt.id, pauseKey);
  useCombatStore.getState().pauseTurnTimerForReaction(pauseKey);
  const remaining = Math.max(0, (prompt.expiresAt ?? Date.now() + REACTION_DECISION_TIMEOUT_MS) - Date.now());
  activePromptTimers.set(prompt.id, setTimeout(() => {
    if (remoteRecipientById(prompt.id)) {
      sendPromptMessage({ tipo: 'fechar', requestId: prompt.id, destinatario: remoteRecipientById(prompt.id) });
    }
    if (prompt.remoteClientId) sendPromptMessage({ tipo: 'resposta', requestId: prompt.id, clienteOrigem: prompt.remoteClientId, answer: null });
    finalizePrompt(prompt.id, null);
  }, remaining));
}

function remoteRecipientById(id: string): string | undefined { return remotePromptRecipients.get(id); }

/** Abre a decisão no controlador da ficha e só então deixa o dano prosseguir. */
export async function requestReactionDecision(
  p: Omit<ReactionPrompt, 'id' | 'createdAt'>,
): Promise<number | null> {
  const prompt = buildPrompt({ ...p, expiresAt: Date.now() + REACTION_DECISION_TIMEOUT_MS });
  const answer = new Promise<number | null>((resolve) => {
    pendingReactionDecisions.set(prompt.id, resolve);
  });

  const character = useCharacterStore.getState().characters.find((c) => c.id === p.charId);
  if (!character) {
    completeReactionDecision(prompt.id, null);
    return answer;
  }
  const destinatario = destinatarioReacao(character);
  const hasBus = typeof window !== 'undefined' && !!(window as unknown as { __worldBus?: { send?: unknown } }).__worldBus?.send;
  if (podeResponderReacao(destinatario) || !hasBus) {
    useReactionStore.setState((state) => ({ prompts: [...state.prompts, prompt] }));
    schedulePromptExpiry(prompt);
  } else {
    schedulePromptExpiry(prompt, destinatario);
    sendPromptMessage({ tipo: 'prompt', requestId: prompt.id, destinatario, prompt });
  }
  return answer;
}

/** Resposta do overlay local ou de outro cliente multiplayer. */
export function completeReactionDecision(requestId: string, answer: number | null) {
  finalizePrompt(requestId, answer);
}

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
