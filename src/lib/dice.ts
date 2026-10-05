import { consumirRerollDe, getCharContextoRolagem, setCharContextoRolagem } from '@/lib/omni/reroll';
import { useDice3DStore, type DiceOverlayLayout, type DiceDrama } from '@/stores/useDice3DStore';
import { useCombatStore } from '@/stores/useCombatStore';

let rollPauseSequence = 0;

async function whileCombatClockPaused<T>(roll: () => Promise<T>): Promise<T> {
  const pauseId = `dice-roll:${Date.now()}:${++rollPauseSequence}`;
  useCombatStore.getState().pauseTurnTimerForReaction(pauseId);
  try {
    return await roll();
  } finally {
    useCombatStore.getState().resumeTurnTimerForReaction(pauseId);
  }
}

/**
 * Sistema oficial de rolagem: TODA rolagem agora vem da física 3D.
 * `rollDice`/`rollD20` retornam Promises que resolvem com os valores em que
 * os dados pararam na bandeja 3D. Se a física estiver desabilitada, o store
 * resolve via RNG instantaneamente (mantendo a interface assíncrona).
 */

function parseNotation(notation: string): { count: number; sides: number } | null {
  const match = notation.match(/^(\d+)d(\d+)$/i);
  if (!match) return null;
  return { count: parseInt(match[1], 10), sides: parseInt(match[2], 10) };
}

export async function rollDice(
  notation: string,
  opts?: { bonus?: number; label?: string },
): Promise<{ rolls: number[]; total: number }> {
  const parsed = parseNotation(notation);
  if (!parsed) return { rolls: [0], total: 0 };
  const { sides } = parsed;
  // captura o contexto AGORA (antes do await) para evitar race conditions
  const charId = getCharContextoRolagem();
  return whileCombatClockPaused(async () => {
    const rolls = await useDice3DStore
      .getState()
      .requestNotation(notation, opts?.label, opts?.bonus);
    if (charId && rolls.length > 0 && consumirRerollDe(charId)) {
      const minIdx = rolls.indexOf(Math.min(...rolls));
      const [r2] = await useDice3DStore.getState().requestNotation(`1d${sides}`);
      rolls[minIdx] = r2 ?? rolls[minIdx];
    }
    return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
  });
}

export async function rollD20(bonus?: number, options?: { label?: string; layout?: DiceOverlayLayout; drama?: DiceDrama; cinematicFocus?: boolean }): Promise<number> {
  return whileCombatClockPaused(async () => {
    const charId = getCharContextoRolagem();
    const [r1] = await useDice3DStore.getState().requestRoll(['D20'], options?.label ?? 'd20', bonus, options?.layout, options?.drama, options?.cinematicFocus);
    let r = r1 ?? 0;
    if (charId && consumirRerollDe(charId)) {
      const [r2] = await useDice3DStore.getState().requestRoll(['D20'], 'd20 reroll', undefined, options?.layout, options?.drama);
      if ((r2 ?? 0) > r) r = r2;
    }
    // Negação Crítica (Suporte Nv 4): 1 natural de um aliado pode virar falha comum.
    if (r === 1 && charId) {
      try {
        const { maybeNegateCritFail } = await import('@/lib/suporteNegacao');
        await maybeNegateCritFail(charId);
      } catch { /* sem Suporte elegível */ }
    }
    return r;
  });
}

export async function rollDiceCom(
  charId: string | undefined,
  notation: string,
  opts?: { bonus?: number; label?: string },
) {
  const prev = getCharContextoRolagem();
  setCharContextoRolagem(charId);
  try {
    return await rollDice(notation, opts);
  } finally {
    setCharContextoRolagem(prev);
  }
}

export async function rollD20Com(charId: string | undefined, bonus?: number, options?: { label?: string; layout?: DiceOverlayLayout; drama?: DiceDrama; cinematicFocus?: boolean }): Promise<number> {
  const prev = getCharContextoRolagem();
  setCharContextoRolagem(charId);
  try {
    return await rollD20(bonus, options);
  } finally {
    setCharContextoRolagem(prev);
  }
}

/**
 * Rola VÁRIOS grupos de dados de tipos diferentes em UMA ÚNICA jogada na
 * bandeja 3D (ex.: 2d6 + 1d8 caem juntos), devolvendo os resultados já
 * separados por grupo na mesma ordem recebida.
 */
export async function rollDiceGroups(
  groups: { count: number; sides: number }[],
  opts?: { bonus?: number; label?: string },
): Promise<{ groups: { count: number; sides: number; rolls: number[]; total: number }[]; rolls: number[]; total: number }> {
  const active = groups
    .map((g) => ({ count: Math.max(0, Math.floor(g.count)), sides: g.sides }))
    .filter((g) => g.count > 0);
  if (active.length === 0) return { groups: [], rolls: [], total: 0 };

  const notation = active.map((g) => `${g.count}d${g.sides}`).join('+');
  const label = opts?.label ?? notation;
  const values = await whileCombatClockPaused(() => useDice3DStore.getState().requestNotation(notation, label, opts?.bonus));

  let i = 0;
  const out = active.map((g) => {
    const rolls = values.slice(i, i + g.count);
    i += g.count;
    return { ...g, rolls, total: rolls.reduce((a, b) => a + b, 0) };
  });
  const rolls = out.flatMap((g) => g.rolls);
  return { groups: out, rolls, total: rolls.reduce((a, b) => a + b, 0) };
}
