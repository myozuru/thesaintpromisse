import type { DamageType } from '@/types';

export interface DamageLogBreakdown {
  total: number;
  rd: number;
  final: number;
  damageType?: DamageType;
}

const displayNumber = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);

export function formatDamageBreakdown(targetName: string, breakdown: DamageLogBreakdown): string {
  const type = breakdown.damageType ? ` · ${breakdown.damageType}` : '';
  return `💥 ${targetName} — Dano total: ${displayNumber(breakdown.total)} | RD: ${displayNumber(breakdown.rd)} | Dano final: ${displayNumber(breakdown.final)}${type}`;
}