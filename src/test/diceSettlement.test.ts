import { describe, expect, it } from 'vitest';
import { DICE_SETTLEMENT, decideDiceSettlement } from '@/components/dice-physics/diceSettlement';

describe('encerramento físico dos dados 3D', () => {
  it('encerra imediatamente quando o motor colocou o dado em repouso', () => {
    expect(decideDiceSettlement({
      elapsedSeconds: 1,
      quietSeconds: 0,
      linearSpeed: 0,
      angularSpeed: 0,
      inTray: true,
      sleeping: true,
    })).toBe('settle');
  });

  it('encerra depois de velocidade linear e angular baixas contínuas', () => {
    expect(decideDiceSettlement({
      elapsedSeconds: 1.5,
      quietSeconds: DICE_SETTLEMENT.quietSeconds,
      linearSpeed: DICE_SETTLEMENT.linearSpeed,
      angularSpeed: DICE_SETTLEMENT.angularSpeed,
      inTray: true,
      sleeping: false,
    })).toBe('settle');
  });

  it('amortece microquiques antes do limite máximo', () => {
    expect(decideDiceSettlement({
      elapsedSeconds: DICE_SETTLEMENT.dampingAfterSeconds,
      quietSeconds: 0,
      linearSpeed: 0.2,
      angularSpeed: 0.5,
      inTray: true,
      sleeping: false,
    })).toBe('damp');
  });

  it('encerra fisicamente no limite máximo mesmo com microquiques', () => {
    expect(decideDiceSettlement({
      elapsedSeconds: DICE_SETTLEMENT.forceAfterSeconds,
      quietSeconds: 0,
      linearSpeed: 0.2,
      angularSpeed: 0.5,
      inTray: true,
      sleeping: false,
    })).toBe('settle');
  });

  it('não encerra um dado fora da bandeja', () => {
    expect(decideDiceSettlement({
      elapsedSeconds: 20,
      quietSeconds: 20,
      linearSpeed: 0,
      angularSpeed: 0,
      inTray: false,
      sleeping: true,
    })).toBe('continue');
  });
});