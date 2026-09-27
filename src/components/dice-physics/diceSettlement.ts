export const DICE_SETTLEMENT = {
  linearSpeed: 0.14,
  angularSpeed: 0.35,
  quietSeconds: 0.3,
  dampingAfterSeconds: 2.5,
  forceAfterSeconds: 6,
} as const;

export type DiceSettlementInput = {
  elapsedSeconds: number;
  quietSeconds: number;
  linearSpeed: number;
  angularSpeed: number;
  inTray: boolean;
  sleeping: boolean;
};

export type DiceSettlementDecision = 'continue' | 'damp' | 'settle';

/** Pure decision used by the 3D body and deterministic tests. */
export function decideDiceSettlement(input: DiceSettlementInput): DiceSettlementDecision {
  // O corpo para no limite e o resultado continua vindo da orientação física.
  // Isso também precisa valer quando um quique o deixa acima da bandeja.
  if (input.elapsedSeconds >= DICE_SETTLEMENT.forceAfterSeconds) return 'settle';
  if (!input.inTray) return 'continue';
  if (input.sleeping) return 'settle';

  const naturallyQuiet =
    input.linearSpeed <= DICE_SETTLEMENT.linearSpeed &&
    input.angularSpeed <= DICE_SETTLEMENT.angularSpeed &&
    input.quietSeconds >= DICE_SETTLEMENT.quietSeconds;

  if (naturallyQuiet) return 'settle';
  if (input.elapsedSeconds >= DICE_SETTLEMENT.dampingAfterSeconds) return 'damp';
  return 'continue';
}