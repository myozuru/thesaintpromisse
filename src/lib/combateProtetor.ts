/**
 * Estilo do Protetor (reações). Usa as stores reais:
 *  • Proteger: aliado (não você) a até 1,5 m está sendo atacado → gasta reação e
 *    impõe desvantagem no PRÓXIMO ataque do atacante.
 *  • Resguardar TR: aliado a até 1,5 m → gasta reação e concede vantagem no
 *    próximo Teste de Resistência dele.
 */
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useMapStore } from '@/stores/useMapStore';
import { useLogStore } from '@/stores/useLogStore';
import { charsDistanceMeters, fmtM, TOUCH_RANGE_M } from '@/lib/touchRange';
import { grantAdvantage } from '@/lib/omni/rollAdvantage';
import { hasCombatStyle } from '@/lib/combateEstilos';
import { getReactionsAvailable } from '@/lib/reactionBudget';
import { useReactionStore } from '@/stores/useReactionStore';

export const PROTETOR_RANGE_M = TOUCH_RANGE_M;

type R = { ok: true } | { ok: false; reason: string };

function chars() { return useCharacterStore.getState().characters; }

/** Distância protetor→aliado; null = sem peça no mapa. */
export function protetorDistance(protectorId: string, allyId: string): number | null {
  const cs = chars();
  const p = cs.find((c) => c.id === protectorId);
  const a = cs.find((c) => c.id === allyId);
  const { entities, gridConfig } = useMapStore.getState();
  return charsDistanceMeters(protectorId, allyId, entities as never, gridConfig as never, {
    casterProfileId: p?.profileId, targetProfileId: a?.profileId,
  });
}

function baseCheck(protectorId: string, allyId: string): R {
  const p = chars().find((c) => c.id === protectorId);
  if (!p || !hasCombatStyle(p, 'protetor')) return { ok: false, reason: 'Sem Estilo do Protetor.' };
  if (allyId === protectorId) return { ok: false, reason: 'O Protetor protege outro alvo, não você mesmo.' };
  if (getReactionsAvailable(p) <= 0) return { ok: false, reason: 'Sem reação disponível.' };
  const d = protetorDistance(protectorId, allyId);
  if (d === null) return { ok: false, reason: 'Aliado sem peça no mapa — não dá para medir 1,5 m.' };
  if (d > PROTETOR_RANGE_M + 0.05) return { ok: false, reason: `Aliado a ${fmtM(d)} m — falta ${fmtM(d - PROTETOR_RANGE_M)} m para 1,5 m.` };
  return { ok: true };
}

function spendReaction(id: string) {
  return useReactionStore.getState().consumeReaction(id);
}

export function protetorProteger(protectorId: string, allyId: string, attackerId: string): R {
  const chk = baseCheck(protectorId, allyId);
  const log = useLogStore.getState().addLog;
  const p = chars().find((c) => c.id === protectorId);
  if (!chk.ok) { log('combat', `🛡️ ${p?.name ?? '?'}: Protetor falhou — ${chk.reason}`); return chk; }
  const atk = chars().find((c) => c.id === attackerId);
  if (!atk) return { ok: false, reason: 'Escolha quem está atacando.' };
  const ally = chars().find((c) => c.id === allyId)!;
  if (!spendReaction(protectorId)) return { ok: false, reason: 'Sem reação disponível.' };
  grantAdvantage(attackerId, 'disadvantage', 'next_attack', { expires: 'use', source: `Estilo do Protetor (${p!.name})`, grantedBy: protectorId });
  log('combat', `🛡️ ${p!.name} usa a reação (Estilo do Protetor): ${atk.name} ataca ${ally.name} com desvantagem.`);
  return { ok: true };
}

export function protetorResguardarTR(protectorId: string, allyId: string): R {
  const chk = baseCheck(protectorId, allyId);
  const log = useLogStore.getState().addLog;
  const p = chars().find((c) => c.id === protectorId);
  if (!chk.ok) { log('combat', `🛡️ ${p?.name ?? '?'}: Protetor falhou — ${chk.reason}`); return chk; }
  const ally = chars().find((c) => c.id === allyId)!;
  grantAdvantage(allyId, 'advantage', 'next_save', { expires: 'use', source: `Estilo do Protetor (${p!.name})`, grantedBy: protectorId });
  spendReaction(protectorId);
  log('combat', `🛡️ ${p!.name} usa a reação (Estilo do Protetor): ${ally.name} tem vantagem no próximo Teste de Resistência.`);
  return { ok: true };
}
