/**
 * Omni-Engine — Pilar 3: Tempo relativístico e expiração de efeitos.
 *
 * Converte qualquer DuracaoEntidade em um número de segundos de linha do tempo
 * (compatível com o cronos global) e fornece helpers para checar expiração.
 */
import type { DuracaoEntidade } from './tipos';
import type { ChronosState } from '@/types';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function toTimelineSeconds(c: Pick<ChronosState, 'hours' | 'minutes' | 'seconds' | 'day' | 'month' | 'year'>): number {
  const years = Math.max(0, c.year - 1) * 365 * 86400;
  const months = DAYS_IN_MONTH.slice(0, Math.max(0, c.month - 1)).reduce((a, b) => a + b, 0) * 86400;
  const days = Math.max(0, c.day - 1) * 86400;
  return years + months + days + c.hours * 3600 + c.minutes * 60 + c.seconds;
}

/** 1 rodada = 6s, 1 turno = 6s (convenção). */
export function duracaoParaSegundos(d: DuracaoEntidade, valor: number): number | null {
  switch (d.tipo) {
    case 'instantaneo':
      return 0;
    case 'permanente':
    case 'ateDissipar':
      return null; // nunca expira via tempo
    case 'rodadas':
    case 'turnos':
      return valor * 6;
    case 'minutos':
      return valor * 60;
    case 'horas':
      return valor * 3600;
    case 'dias':
      return valor * 86400;
    default:
      return 0;
  }
}
