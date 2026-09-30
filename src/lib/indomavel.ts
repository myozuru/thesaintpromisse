/**
 * Especialista em Combate — Habilidade de 2º nível: Indomável.
 *
 * Ao FALHAR em um teste de resistência, o personagem pode gastar 1 PE para
 * rolar o d20 novamente e ficar com o MELHOR resultado.
 *
 * Usos: metade do nível de personagem (mínimo 1), por descanso curto ou longo.
 * O contador vive em `specAbilityUsage['ec-indomavel']`, que a ficha zera
 * automaticamente nos dois descansos (escopo `rest_short`).
 */
import { create } from 'zustand';
import type { Character } from '@/types';
import { isEspecialistaCombate } from '@/lib/combateEstilos';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useLogStore } from '@/stores/useLogStore';

export const INDOMAVEL_ID = 'ec-indomavel';
export const INDOMAVEL_PE = 1;

export function hasIndomavel(c: Character | null | undefined): boolean {
  if (!c || !isEspecialistaCombate(c)) return false;
  return (c.chosenSpecAbilities ?? []).some((a) => a.abilityId === INDOMAVEL_ID);
}

/** Metade do nível, mínimo 1. */
export function indomavelUsosMax(c: Character): number {
  return Math.max(1, Math.floor((c.level ?? 1) / 2));
}

export function indomavelUsosGastos(c: Character): number {
  return c.specAbilityUsage?.[INDOMAVEL_ID] ?? 0;
}

export function indomavelUsosRestantes(c: Character): number {
  return Math.max(0, indomavelUsosMax(c) - indomavelUsosGastos(c));
}

/** Pode oferecer a rerrolagem agora? */
export function indomavelElegivel(c: Character | null | undefined): boolean {
  if (!hasIndomavel(c) || !c) return false;
  if (indomavelUsosRestantes(c) <= 0) return false;
  return (c.peCurrent ?? 0) >= INDOMAVEL_PE;
}

/** Patch de consumo: 1 PE + 1 uso. */
export function indomavelPatchUso(c: Character): Partial<Character> {
  return {
    peCurrent: Math.max(0, (c.peCurrent ?? 0) - INDOMAVEL_PE),
    specAbilityUsage: {
      ...(c.specAbilityUsage ?? {}),
      [INDOMAVEL_ID]: indomavelUsosGastos(c) + 1,
    },
  };
}

// ─── Prompt ────────────────────────────────────────────────────────────────
export interface IndomavelPedido {
  id: string;
  charId: string;
  charName: string;
  testName: string;
  d20: number;
  total: number;
  dc: number;
  restantes: number;
  resolve: (sim: boolean) => void;
}

export const useIndomavelStore = create<{
  pedido: IndomavelPedido | null;
  set: (p: IndomavelPedido | null) => void;
}>((set) => ({ pedido: null, set: (pedido) => set({ pedido }) }));

/**
 * Pergunta ao jogador se quer usar Indomável após falhar num TR.
 * Devolve o d20 final (o melhor entre o original e a rerrolagem).
 */
export async function perguntarIndomavel(
  charId: string,
  testName: string,
  d20: number,
  total: number,
  dc: number,
  rerolar: () => Promise<number>,
): Promise<number> {
  const c = useCharacterStore.getState().characters.find((x) => x.id === charId);
  if (!c || !indomavelElegivel(c)) return d20;
  if (total >= dc) return d20; // não falhou

  const sim = await new Promise<boolean>((resolve) => {
    useIndomavelStore.getState().set({
      id: `${Date.now()}`,
      charId,
      charName: c.name,
      testName,
      d20,
      total,
      dc,
      restantes: indomavelUsosRestantes(c),
      resolve,
    });
  });
  useIndomavelStore.getState().set(null);
  if (!sim) return d20;

  const atual = useCharacterStore.getState().characters.find((x) => x.id === charId) ?? c;
  useCharacterStore.getState().updateCharacter(charId, indomavelPatchUso(atual));
  const novo = await rerolar();
  const melhor = Math.max(d20, novo);
  useLogStore.getState().addLog(
    'combat',
    `🛡️ Indomável: ${c.name} rola de novo o TR de ${testName} — ${d20} → ${novo} (fica com ${melhor}). −1 PE.`,
  );
  return melhor;
}
