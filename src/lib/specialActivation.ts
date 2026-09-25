/**
 * ============================================================================
 *  SPECIAL ACTIVATION ENGINE — Domínio Simples
 * ============================================================================
 *  Texto oficial p. 193:
 *  • Ação Bônus OU Reação a Expansão de Domínio. Custo: 5 PE.
 *  • Raio = 1,5 m + 1,5 m × DOM
 *  • Durabilidade = BAR + 1
 *  • Falha em Concentração → -1 durabilidade
 *  • Início do seu turno sob Acerto Garantido inimigo → -1 durabilidade
 *  • Cada -1 durabilidade encolhe o raio em 1,5 m
 *  • Se Durabilidade ≤ 0 OU Raio ≤ 0 → quebra: todos recebem o Acerto
 *    Garantido instantaneamente.
 * ============================================================================
 */

import type { Character } from '@/types';

export interface SpecialActivationResult {
  ok: boolean;
  reason?: string;
  peSpent: number;
  logMessage: string;
  omniFlagPatch?: Record<string, number>;
  details?: Record<string, string | number>;
  /** Sinaliza quebra do Domínio Simples (chama side-effect na UI). */
  quebrou?: boolean;
}

export const PE_DOMINIO_SIMPLES = 5;
export const RAIO_BASE_M = 1.5;
export const RAIO_POR_DOM_M = 1.5;
export const RAIO_PERDIDO_POR_DUR_M = 1.5;

function getDom(c: Character): number {
  return c.cursedAptitudes?.DOM ?? 0;
}
function getBar(c: Character): number {
  return c.cursedAptitudes?.BAR ?? 0;
}

// ────────────────────────────────────────────────────────────────────────
// CRIAR DOMÍNIO SIMPLES
// ────────────────────────────────────────────────────────────────────────

export type DominioSimplesGatilho = 'bonus' | 'reacao';

export function calcularDominioSimples(
  c: Character,
  opts: { gatilho: DominioSimplesGatilho },
): SpecialActivationResult {
  if ((c.peCurrent ?? 0) < PE_DOMINIO_SIMPLES) {
    return {
      ok: false,
      reason: `PE insuficiente (${c.peCurrent ?? 0}/${PE_DOMINIO_SIMPLES}).`,
      peSpent: 0,
      logMessage: '',
    };
  }
  const dom = getDom(c);
  const bar = getBar(c);
  const raio = RAIO_BASE_M + RAIO_POR_DOM_M * dom;
  const dur = bar + 1;
  const tipo = opts.gatilho === 'reacao' ? 'Reação' : 'Ação Bônus';

  return {
    ok: true,
    peSpent: PE_DOMINIO_SIMPLES,
    omniFlagPatch: {
      dominio_simples_durabilidade: dur,
      dominio_simples_raio_m: raio,
      dominio_simples_imune_acerto_garantido: 1,
    },
    logMessage: `🛡️ Domínio Simples (${tipo}): -${PE_DOMINIO_SIMPLES} PE. Raio ${raio} m, Durabilidade ${dur}. Você e todos dentro estão imunes ao Acerto Garantido e efeitos de ambiente do domínio inimigo. Exige Concentração — falha custa 1 dur. Acerto Garantido contínuo no início do seu turno tira 1 dur. Cada -1 dur encolhe o raio em ${RAIO_PERDIDO_POR_DUR_M} m. Quebra a 0 dur ou 0 raio → Acerto Garantido atinge todos.`,
    details: { raio, dur, dom, bar },
  };
}

// ────────────────────────────────────────────────────────────────────────
// DANO À ESTRUTURA (falha de concentração ou tick de Acerto Garantido)
// ────────────────────────────────────────────────────────────────────────

export type DominioSimplesGatilhoDano =
  | 'concentracao_falha'
  | 'acerto_garantido_tick';

export function aplicarDanoDominioSimples(
  c: Character,
  motivo: DominioSimplesGatilhoDano,
): SpecialActivationResult {
  const flags = c.omniFlags ?? {};
  const durAtual = (flags.dominio_simples_durabilidade as number | undefined) ?? 0;
  const raioAtual = (flags.dominio_simples_raio_m as number | undefined) ?? 0;
  if (durAtual <= 0 || raioAtual <= 0) {
    return {
      ok: false,
      reason: 'Domínio Simples não está ativo.',
      peSpent: 0,
      logMessage: '',
    };
  }
  const novaDur = durAtual - 1;
  const novoRaio = Math.max(0, raioAtual - RAIO_PERDIDO_POR_DUR_M);
  const motivoLabel =
    motivo === 'concentracao_falha'
      ? 'Falha em Concentração'
      : 'Acerto Garantido contínuo no início do turno';

  if (novaDur <= 0 || novoRaio <= 0) {
    return {
      ok: true,
      peSpent: 0,
      quebrou: true,
      omniFlagPatch: {
        dominio_simples_durabilidade: 0,
        dominio_simples_raio_m: 0,
        dominio_simples_imune_acerto_garantido: 0,
      },
      logMessage: `💥 Domínio Simples QUEBROU (${motivoLabel}). Acerto Garantido inimigo atinge VOCÊ e todos que estavam dentro instantaneamente.`,
      details: { dur: 0, raio: 0 },
    };
  }
  return {
    ok: true,
    peSpent: 0,
    omniFlagPatch: {
      dominio_simples_durabilidade: novaDur,
      dominio_simples_raio_m: novoRaio,
    },
    logMessage: `🛡️ Domínio Simples sofreu dano (${motivoLabel}): durabilidade ${durAtual} → ${novaDur}, raio ${raioAtual} m → ${novoRaio} m.`,
    details: { dur: novaDur, raio: novoRaio },
  };
}

// ────────────────────────────────────────────────────────────────────────
// DISSIPAR (livre, manual)
// ────────────────────────────────────────────────────────────────────────

export function dissiparDominioSimples(c: Character): SpecialActivationResult {
  const flags = c.omniFlags ?? {};
  const dur = (flags.dominio_simples_durabilidade as number | undefined) ?? 0;
  if (dur <= 0) {
    return { ok: false, reason: 'Domínio Simples não está ativo.', peSpent: 0, logMessage: '' };
  }
  return {
    ok: true,
    peSpent: 0,
    omniFlagPatch: {
      dominio_simples_durabilidade: 0,
      dominio_simples_raio_m: 0,
      dominio_simples_imune_acerto_garantido: 0,
    },
    logMessage: `🛡️ Domínio Simples dissipado voluntariamente.`,
  };
}
