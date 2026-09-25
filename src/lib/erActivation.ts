/**
 * ============================================================================
 *  ER ACTIVATION ENGINE
 * ============================================================================
 *  Funções PURAS para a família ER (Energia Reversa), pp. 190-191.
 *  Regra core: 1 PER = 2 PE.
 *
 *  Cobre as 3 aptidões pendentes de motor:
 *   - Fluxo Constante  (gatilho de cura como Ação Livre / Reação)
 *   - Liberação de ER  (libera target=touch para Energia Reversa)
 *   - Canalizar ER     (carga de PER no próximo ataque vs Maldição)
 *
 *  As demais (Energia Reversa, Cura Amplificada, Regeneração, Cura em Grupo)
 *  já têm dialogs dedicados e permanecem como estão.
 * ============================================================================
 */

import type { Character } from '@/types';

export interface ErActivationResult {
  ok: boolean;
  reason?: string;
  peSpent: number;
  logMessage: string;
  omniFlagPatch?: Record<string, number>;
  details?: Record<string, string | number>;
}

export function getErLevel(c: Character): number {
  return c.cursedAptitudes?.ER ?? 0;
}

/** 1 PER = 2 PE. */
export const PE_POR_PER = 2;

// ────────────────────────────────────────────────────────────────────────
// FLUXO CONSTANTE
// ────────────────────────────────────────────────────────────────────────
// Livro: no início do seu turno você pode curar com Energia Reversa como
// Ação Livre. Caso NÃO o faça naquele turno, ganha o direito de usar a
// Reação para curar quando sua vida for reduzida.
//
// Engine: setamos uma flag de janela. `fluxo_constante_modo`:
//   1 = janela do turno (livre, ainda disponível)
//   2 = janela do turno consumida → reação destravada
//   0 = inativo
// O Dialog de Energia Reversa pode consultar a flag para permitir cura sem
// gastar a Ação Comum.

export type FluxoConstanteModo = 'turno-livre' | 'reacao';

export function calcularFluxoConstante(
  c: Character,
  opts: { modo: FluxoConstanteModo },
): ErActivationResult {
  if (!c) return { ok: false, reason: 'Personagem inválido.', peSpent: 0, logMessage: '' };
  const flag = opts.modo === 'turno-livre' ? 1 : 2;
  const label =
    opts.modo === 'turno-livre'
      ? 'Janela ABERTA: cura por Energia Reversa neste turno usa Ação Livre.'
      : 'Janela do turno foi pulada → Reação destravada para curar ao receber dano.';
  return {
    ok: true,
    peSpent: 0,
    omniFlagPatch: { fluxo_constante_modo: flag },
    logMessage: `🌊 Fluxo Constante: ${label}`,
    details: { flag },
  };
}

// ────────────────────────────────────────────────────────────────────────
// LIBERAÇÃO DE ENERGIA REVERSA
// ────────────────────────────────────────────────────────────────────────
// Livro: passiva — destrava cura de OUTRAS criaturas via toque.
// Engine: flag persistente lida pelos dialogs de cura (GroupHealDialog já
// faz; aqui apenas formalizamos a presença para futuras ativações de cura
// pessoal extendida a aliado adjacente).

export function calcularLiberacaoEr(c: Character): ErActivationResult {
  return {
    ok: true,
    peSpent: 0,
    omniFlagPatch: { liberacao_er_ativa: 1 },
    logMessage: `✨ Liberação de Energia Reversa: cura por Energia Reversa pode ter como alvo aliado em alcance de toque (≤ 1,5 m).`,
  };
}

// ────────────────────────────────────────────────────────────────────────
// CANALIZAR ENERGIA REVERSA
// ────────────────────────────────────────────────────────────────────────
// Livro: Ação de Movimento. Investe PER (≤ Bônus de Treinamento). Próximo
// ataque físico que ACERTAR uma Maldição soma 2d6 de dano de Energia
// Reversa por PER gasto. Se errar, a carga PERMANECE. Mutex com
// "Canalizar em Golpe" tradicional. Não funciona em Feitiços.
//
// Engine: debita PE = 2 × PER. Salva carga em `omniFlags.canalizar_er_carga`
// (em PER). Bloqueia ativação simultânea com `canalizar_em_golpe_carga`.

export interface CanalizarErOptions {
  perGasto: number;
  trainingBonus: number;
  /** Carga atual de Canalizar em Golpe normal (mutex). */
  canalizarEmGolpeAtivo?: boolean;
  /** Carga ER já existente (recarregar não é permitido — escolha um). */
  cargaErExistente?: number;
}

export function calcularCanalizarEr(
  c: Character,
  opts: CanalizarErOptions,
): ErActivationResult {
  const per = Math.floor(opts.perGasto);
  if (per <= 0) {
    return { ok: false, reason: 'Invista ao menos 1 PER.', peSpent: 0, logMessage: '' };
  }
  if (per > opts.trainingBonus) {
    return {
      ok: false,
      reason: `PER acima do limite (Bônus de Treinamento ${opts.trainingBonus}).`,
      peSpent: 0,
      logMessage: '',
    };
  }
  if (opts.canalizarEmGolpeAtivo) {
    return {
      ok: false,
      reason: 'Mutuamente exclusivo com Canalizar em Golpe normal já ativo.',
      peSpent: 0,
      logMessage: '',
    };
  }
  if (opts.cargaErExistente && opts.cargaErExistente > 0) {
    return {
      ok: false,
      reason: `Já há carga de ER preparada (${opts.cargaErExistente} PER). Consuma antes de recarregar.`,
      peSpent: 0,
      logMessage: '',
    };
  }
  const peCost = per * PE_POR_PER;
  if ((c.peCurrent ?? 0) < peCost) {
    return {
      ok: false,
      reason: `PE insuficiente (${c.peCurrent ?? 0}/${peCost}).`,
      peSpent: 0,
      logMessage: '',
    };
  }
  return {
    ok: true,
    peSpent: peCost,
    omniFlagPatch: { canalizar_er_carga: per },
    logMessage: `⚡ Canalizar Energia Reversa: -${peCost} PE (${per} PER). Próximo ataque físico que ACERTAR uma Maldição soma ${per * 2}d6 de dano de Energia Reversa. Mantém a carga em caso de miss. Não funciona em Feitiços.`,
    details: { per, peCost, dadosBonus: per * 2 },
  };
}
