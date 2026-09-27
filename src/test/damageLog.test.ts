import { describe, expect, it } from 'vitest';
import { formatDamageBreakdown } from '@/lib/damageLog';

describe('registro detalhado de dano', () => {
  it('mostra dano total, RD aplicada e dano final', () => {
    expect(formatDamageBreakdown('Yuji', {
      total: 24,
      rd: 7,
      final: 17,
      damageType: 'DCO',
    })).toBe('💥 Yuji — Dano total: 24 | RD: 7 | Dano final: 17 · DCO');
  });

  it('mantém números fracionários legíveis quando existirem', () => {
    expect(formatDamageBreakdown('Maki', { total: 10.5, rd: 2, final: 8.5 }))
      .toContain('Dano total: 10.5 | RD: 2 | Dano final: 8.5');
  });
});