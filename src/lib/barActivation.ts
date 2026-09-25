/**
 * ============================================================================
 *  BAR ACTIVATION ENGINE
 * ============================================================================
 *  Funções PURAS para a família BAR (Barreira), pp. 175-177.
 * ============================================================================
 */

import type { Character } from '@/types';

export interface BarActivationResult {
  ok: boolean;
  reason?: string;
  peSpent: number;
  logMessage: string;
  omniFlagPatch?: Record<string, number>;
  details?: Record<string, string | number>;
}

export function getBarLevel(c: Character): number {
  return c.cursedAptitudes?.BAR ?? 0;
}

// ────────────────────────────────────────────────────────────────────────
// TÉCNICAS DE BARREIRA (criação de paredes)
// ────────────────────────────────────────────────────────────────────────
// Livro: Ação Comum, até 6 paredes, 1 PE/parede. Cada parede:
// 1,5 m, HP = 10 + 10×BAR (ou 20×BAR com Paredes Resistentes).

export interface CriarParedesOptions {
  /** Nº de paredes a criar (1..6). */
  paredes: number;
  /** true se possui Paredes Resistentes (HP base passa a ser 10×BAR). */
  hasParedesResistentes: boolean;
  /** true se possui Barreira Rápida (custo de Ação Comum vira Ação Bônus). */
  hasBarreiraRapida?: boolean;
}

export function calcularCriarParedes(
  c: Character,
  opts: CriarParedesOptions,
): BarActivationResult {
  const n = Math.max(0, Math.floor(opts.paredes));
  if (n <= 0) return { ok: false, reason: 'Crie ao menos 1 parede.', peSpent: 0, logMessage: '' };
  if (n > 6) return { ok: false, reason: 'Máximo de 6 paredes por ativação.', peSpent: 0, logMessage: '' };
  if ((c.peCurrent ?? 0) < n) return { ok: false, reason: `PE insuficiente (precisa ${n}).`, peSpent: 0, logMessage: '' };

  const bar = getBarLevel(c);
  const hpBase = opts.hasParedesResistentes ? 10 * bar : 10;
  const hpPorParede = hpBase + 10 * bar;
  const hpTotal = hpPorParede * n;

  const action = opts.hasBarreiraRapida ? 'Ação Bônus' : 'Ação Comum';
  return {
    ok: true,
    peSpent: n,
    logMessage: `🧱 Técnicas de Barreira (${action}): -${n} PE → ${n} parede${n > 1 ? 's' : ''} (1,5 m cada). HP por parede: ${hpPorParede}${opts.hasParedesResistentes ? ' (Paredes Resistentes ativa)' : ''}${opts.hasBarreiraRapida ? ' [Barreira Rápida]' : ''}. HP total: ${hpTotal}.`,
    details: { paredes: n, hpPorParede, hpTotal, bar, actionCost: opts.hasBarreiraRapida ? 'bonus' : 'common' },
  };
}

// ────────────────────────────────────────────────────────────────────────
// CESTA OCA DE VIME
// ────────────────────────────────────────────────────────────────────────
// Livro: 3 PE, Bônus ou Reação a Domínio. Imuniza contra Acerto Garantido
// enquanto durabilidade > 0. Durabilidade = BAR + 1.

export function calcularCestaOca(c: Character): BarActivationResult {
  const cost = 3;
  if ((c.peCurrent ?? 0) < cost) {
    return { ok: false, reason: 'PE insuficiente (3 PE).', peSpent: 0, logMessage: '' };
  }
  const bar = getBarLevel(c);
  const dur = bar + 1;
  return {
    ok: true,
    peSpent: cost,
    omniFlagPatch: { cesta_oca_durabilidade: dur },
    logMessage: `🧺 Cesta Oca de Vime: -${cost} PE. Durabilidade ${dur} (BAR ${bar} + 1). Imune ao Acerto Garantido enquanto durabilidade > 0. Exige Concentração — falha custa 1 durabilidade. Manter selo (2 mãos) trava degradação por Acerto Garantido.`,
    details: { dur, bar },
  };
}

// ────────────────────────────────────────────────────────────────────────
// CORTINA
// ────────────────────────────────────────────────────────────────────────
// Livro: 1 PE para cada 4,5 m de área. Sem upkeep. Funcionamento básico:
// ocultamento. Condições conforme Guia.

export function calcularCortina(
  c: Character,
  opts: { areaM: number },
): BarActivationResult {
  const area = Math.max(0, opts.areaM);
  if (area <= 0) return { ok: false, reason: 'Informe uma área > 0.', peSpent: 0, logMessage: '' };
  const cost = Math.ceil(area / 4.5);
  if ((c.peCurrent ?? 0) < cost) {
    return { ok: false, reason: `PE insuficiente (precisa ${cost}).`, peSpent: 0, logMessage: '' };
  }
  return {
    ok: true,
    peSpent: cost,
    logMessage: `🌑 Cortina: -${cost} PE (1 PE / 4,5 m → área de ${area} m). Funcionamento básico: ocultamento (de fora). Sem upkeep. Adicione condições conforme regras de Cortinas.`,
    details: { area, cost },
  };
}
