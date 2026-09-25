/**
 * ============================================================================
 *  DOM ACTIVATION ENGINE
 * ============================================================================
 *  Funções PURAS para ativação das aptidões da família DOM (Domínio).
 *  Mesmo padrão de clActivation.ts: recebem (Character + opções) e devolvem
 *  o resultado pronto para o store aplicar (PE, flags, log, fórmula).
 *
 *  Fidelidade ao livro: Domínio, pp. 182-184.
 * ============================================================================
 */

import type { Character } from '@/types';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';

export interface DomActivationResult {
  ok: boolean;
  reason?: string;
  peSpent: number;
  logMessage: string;
  /** Patch para character.omniFlags. */
  omniFlagPatch?: Record<string, number>;
  /** Texto de fórmula descritiva (testes opostos, durações). */
  damageFormula?: string;
  details?: Record<string, string | number>;
}

export type RollFn = (sides: number) => number;
/**
 * Em produção, o caller (useCharacterStore) pré-rola via 3D e injeta `rollFn`.
 * Se nada for injetado, este default estoura para garantir 100% 3D.
 */
const defaultRoll: RollFn = (sides) => {
  throw new Error(
    `domActivation.defaultRoll(${sides}): rolagem direta proibida — injete rollFn vindo da física 3D.`,
  );
};


export function getDomLevel(c: Character): number {
  return c.cursedAptitudes?.DOM ?? 0;
}
export function getBarLevel(c: Character): number {
  return c.cursedAptitudes?.BAR ?? 0;
}

/** Bônus de Feitiçaria do personagem (atributo + treinamento + maestria). */
function getFeiticariaBonus(c: Character): number {
  const skill = (c.skills ?? []).find((s) => s.name?.toLowerCase() === 'feitiçaria');
  if (!skill) return 0;
  const linked = (c.attributes ?? []).find((a) => a.name === skill.linkedAttribute);
  const attrMod = linked ? Math.floor((linked.value - 10) / 2) : 0;
  const trainingBonus = getTrainingBonusByLevel(c.level ?? 1);
  let total = attrMod;
  if (skill.trained) total += trainingBonus;
  if (skill.mastery) total += trainingBonus;
  if (skill.externalBonus) total += skill.externalBonus;
  return total;
}

// ────────────────────────────────────────────────────────────────────────
// REVESTIMENTO DE DOMÍNIO
// ────────────────────────────────────────────────────────────────────────
// Livro: 5 PE para ativar (Bônus ou Reação a Feitiço). Sustenta com 5 PE
// no início do turno. Reduz dano de técnicas em valor = NÍVEL DO PERSONAGEM
// (não-anulável). Anula técnicas de nível ≤ ceil(DOM/2). Não funciona
// contra Feitiços que afetem a energia amaldiçoada do alvo.

export interface RevestimentoOptions {
  /** Modo de ativação: novo turno (sustain) ou inicial. */
  sustain: boolean;
}

export function calcularRevestimento(
  c: Character,
  opts: RevestimentoOptions,
): DomActivationResult {
  const cost = 5;
  if ((c.peCurrent ?? 0) < cost) {
    return { ok: false, reason: 'PE insuficiente (5 PE).', peSpent: 0, logMessage: '' };
  }
  const dom = getDomLevel(c);
  const limiar = Math.ceil(dom / 2);
  const reducao = c.level ?? 1;
  const verbo = opts.sustain ? 'Sustenta' : 'Ativa';

  return {
    ok: true,
    peSpent: cost,
    omniFlagPatch: { revestimento_dominio: 1 },
    logMessage: `🛡️ Revestimento de Domínio (${verbo}): -${cost} PE. Reduz dano de Feitiços ofensivos em ${reducao} (= nível do personagem, não-anulável). Anula automaticamente Feitiços de Nível ≤ ${limiar} (= ⌈DOM/2⌉). NÃO funciona contra Feitiços que afetam diretamente energia amaldiçoada (Boogie Woogie, Nulificação). Você não pode usar Feitiços enquanto ativo.`,
    details: { reducao, limiarAnulacao: limiar, dom },
  };
}

// ────────────────────────────────────────────────────────────────────────
// ANULAR TÉCNICA
// ────────────────────────────────────────────────────────────────────────
// Livro: Reação. Gasta PE = PE do Feitiço inimigo. Teste oposto de
// Feitiçaria. Em sucesso, anula (área inclui todos). Limite: DOM por
// descanso longo. Só anula Feitiços de nível que você teria acesso.

export interface AnularTecnicaOptions {
  /** PE gasto pelo atacante para conjurar o Feitiço. */
  peInimigo: number;
  /** Bônus de Feitiçaria do atacante (modificador + treinamento). */
  feiticariaInimigo: number;
  /** Usos já gastos da aptidão neste descanso longo. */
  usosGastos: number;
  /** Resultado do d20 do defensor (opcional, mock para testes). */
  rollFn?: RollFn;
}

export function calcularAnularTecnica(
  c: Character,
  opts: AnularTecnicaOptions,
): DomActivationResult {
  const dom = getDomLevel(c);
  const usosMax = dom;
  if (opts.usosGastos >= usosMax) {
    return { ok: false, reason: `Usos esgotados neste descanso longo (${usosMax}/${usosMax}).`, peSpent: 0, logMessage: '' };
  }
  const peInimigo = Math.max(0, Math.floor(opts.peInimigo));
  if (peInimigo <= 0) {
    return { ok: false, reason: 'Informe o PE gasto pelo atacante (> 0).', peSpent: 0, logMessage: '' };
  }
  if ((c.peCurrent ?? 0) < peInimigo) {
    return { ok: false, reason: `PE insuficiente (precisa ${peInimigo}).`, peSpent: 0, logMessage: '' };
  }

  const roll = opts.rollFn ?? defaultRoll;
  const meuD20 = roll(20);
  const inimigoD20 = roll(20);
  const meuBonus = getFeiticariaBonus(c);
  const meuTotal = meuD20 + meuBonus;
  const inimigoTotal = inimigoD20 + opts.feiticariaInimigo;
  const sucesso = meuTotal >= inimigoTotal;
  const usosRestantes = usosMax - opts.usosGastos - 1;

  return {
    ok: true,
    peSpent: peInimigo,
    omniFlagPatch: { anular_tecnica_uso: 1 },
    logMessage: `❎ Anular Técnica: -${peInimigo} PE. Teste oposto Feitiçaria → você ${meuD20}+${meuBonus}=${meuTotal} vs atacante ${inimigoD20}+${opts.feiticariaInimigo}=${inimigoTotal} → ${sucesso ? '✅ FEITIÇO ANULADO (área inclui todos os submetidos).' : '❌ FALHA — Feitiço prossegue.'} Usos restantes: ${usosRestantes}/${usosMax}.`,
    details: { peInimigo, meuD20, meuBonus, meuTotal, inimigoD20, inimigoTotal, sucesso: sucesso ? 1 : 0, usosRestantes },
  };
}

// ────────────────────────────────────────────────────────────────────────
// EXPANSÃO DE DOMÍNIO INCOMPLETA
// ────────────────────────────────────────────────────────────────────────
// Livro: 15 PE, Ação Comum, duas mãos livres. Raio = 4,5 × bônus de
// treinamento. Duração = 1 + DOM rodadas.

export function calcularExpansaoIncompleta(c: Character): DomActivationResult {
  const cost = 15;
  if ((c.peCurrent ?? 0) < cost) {
    return { ok: false, reason: 'PE insuficiente (15 PE).', peSpent: 0, logMessage: '' };
  }
  const dom = getDomLevel(c);
  const trainingBonus = getTrainingBonusByLevel(c.level ?? 1);
  const raio = 4.5 * trainingBonus;
  const duracao = 1 + dom;

  return {
    ok: true,
    peSpent: cost,
    omniFlagPatch: { expansao_incompleta: duracao },
    logMessage: `🌀 Expansão de Domínio Incompleta: -${cost} PE. Raio ${raio} m (4,5 × treinamento ${trainingBonus}). Duração ${duracao} rodadas (1 + DOM ${dom}). Adapta-se ao ambiente. Efeitos conforme Guia de Criação de Expansões.`,
    details: { raio, duracao, trainingBonus, dom },
  };
}

// ────────────────────────────────────────────────────────────────────────
// EXPANSÃO DE DOMÍNIO COMPLETA
// ────────────────────────────────────────────────────────────────────────
// Livro: 20 PE, Ação Comum, duas mãos livres. Esfera de 9 m. Duração
// = 3 + DOM rodadas. Com Acerto Garantido: 25 PE.

export interface ExpansaoCompletaOptions {
  /** Aplica modificador "Acerto Garantido" (+5 PE). */
  comAcertoGarantido: boolean;
  /** Modo "Sem Barreiras" (mesmo custo da Completa+Acerto, sem domo). */
  semBarreiras: boolean;
}

export function calcularExpansaoCompleta(
  c: Character,
  opts: ExpansaoCompletaOptions,
): DomActivationResult {
  let cost = 20;
  if (opts.comAcertoGarantido || opts.semBarreiras) cost = 25;
  if ((c.peCurrent ?? 0) < cost) {
    return { ok: false, reason: `PE insuficiente (${cost} PE).`, peSpent: 0, logMessage: '' };
  }
  const dom = getDomLevel(c);
  const duracao = 3 + dom;
  const flagKey = opts.semBarreiras ? 'expansao_sem_barreiras' : 'expansao_completa';

  const tags: string[] = [];
  if (opts.comAcertoGarantido && !opts.semBarreiras) tags.push('Acerto Garantido (não conta para o máx. de efeitos)');
  if (opts.semBarreiras) tags.push('Sem Barreiras — alcance estendido do Acerto Garantido (atravessa barreiras inimigas)');
  const tagText = tags.length ? ` [${tags.join(' · ')}]` : '';
  const areaText = opts.semBarreiras ? 'sem domo (afeta arena real)' : 'esfera de 9 m (alvos presos)';

  return {
    ok: true,
    peSpent: cost,
    omniFlagPatch: { [flagKey]: duracao },
    logMessage: `🌌 Expansão de Domínio ${opts.semBarreiras ? 'Sem Barreiras' : 'Completa'}${tagText}: -${cost} PE. Área: ${areaText}. Duração ${duracao} rodadas (3 + DOM ${dom}). Efeitos conforme Guia de Criação.`,
    details: { custo: cost, duracao, dom, semBarreiras: opts.semBarreiras ? 1 : 0, acertoGarantido: opts.comAcertoGarantido ? 1 : 0 },
  };
}
