/**
 * ============================================================================
 *  CL ACTIVATION ENGINE
 * ============================================================================
 *  Funções PURAS que calculam o efeito de cada aptidão da família CL
 *  (Controle e Leitura) ao ser ativada. Não tocam em store nem efeitos
 *  colaterais — recebem (charSnapshot + opções) e devolvem o resultado
 *  pronto para ser aplicado pelo store ou logado pela UI.
 *
 *  Por que separar?
 *   - Testabilidade: regras do livro viram funções puras testáveis.
 *   - UI desacoplada: o painel CL só decide "qual aptidão / quantos PE",
 *     a aplicação fica no store, e este módulo guarda as fórmulas.
 *   - Fonte única de verdade: se a regra mudar, muda só aqui.
 *
 *  Fidelidade ao livro: Controle e Leitura, pp. 178-181.
 * ============================================================================
 */

import type { Character } from '@/types';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { aggregateSpecChoices } from '@/lib/specChoiceEffects';

/** Resultado padrão de uma ativação CL. */
export interface ClActivationResult {
  ok: boolean;
  reason?: string;
  /** PE efetivamente debitado. */
  peSpent: number;
  /** Mensagem amigável para log. */
  logMessage: string;
  /** PVs temporários a aplicar via applyShield (Cobrir-se / Cobertura). */
  shieldGranted?: number;
  /** Flag a setar em omniFlags (ex.: bônus do próximo ataque). */
  omniFlagPatch?: Record<string, number>;
  /** Fórmula descritiva para o jogador rolar manualmente. */
  damageFormula?: string;
  /** Detalhes extras para tooltips/painéis. */
  details?: Record<string, string | number>;
}

/** Lê o nível de CL do personagem com fallback seguro. */
export function getClLevel(c: Character): number {
  return c.cursedAptitudes?.CL ?? 0;
}

/** Lê o nível de AU do personagem com fallback seguro. */
export function getAuLevel(c: Character): number {
  return c.cursedAptitudes?.AU ?? 0;
}

// ────────────────────────────────────────────────────────────────────────
// COBRIR-SE / COBERTURA AVANÇADA
// ────────────────────────────────────────────────────────────────────────
// Livro: "gaste PE igual a 2 + CL × 2 para receber PVTs: 4 por PE
// (Cobrir-se) / 8 por PE (Cobertura Avançada)". Avulsos das outras
// fontes; duram até o fim do turno do atacante.

export interface CobrirSeOptions {
  peSpent: number;
  /** true se o personagem tem Cobertura Avançada (cl-cobertura-avancada). */
  hasCoberturaAvancada: boolean;
}

export function calcularCobrirSe(
  c: Character,
  opts: CobrirSeOptions,
): ClActivationResult {
  const cl = getClLevel(c);
  // tec-fisico-amaldicoado-defensivo: +2 (+1 com Cobertura Avançada) no maxPE.
  const specBonus = aggregateSpecChoices(c).cobrirSeMaxPeBonus;
  const limit = 2 + cl * 2 + specBonus;
  const peSpent = Math.max(0, Math.floor(opts.peSpent));

  if (peSpent <= 0) {
    return { ok: false, reason: 'Gaste pelo menos 1 PE.', peSpent: 0, logMessage: '' };
  }
  if (peSpent > limit) {
    return {
      ok: false,
      reason: `Limite de PE para Cobrir-se: ${limit} (2 + CL×2${specBonus ? ` +${specBonus} Físico Defensivo` : ''}).`,
      peSpent: 0,
      logMessage: '',
    };
  }
  if ((c.peCurrent ?? 0) < peSpent) {
    return { ok: false, reason: 'PE insuficiente.', peSpent: 0, logMessage: '' };
  }

  const perPe = opts.hasCoberturaAvancada ? 8 : 4;
  const shield = peSpent * perPe;
  const apt = opts.hasCoberturaAvancada ? 'Cobertura Avançada' : 'Cobrir-se';

  return {
    ok: true,
    peSpent,
    shieldGranted: shield,
    logMessage: `🛡️ ${apt}: ${peSpent} PE → +${shield} PV temporários (avulsos; duram até o fim do turno do atacante).`,
    details: { peSpent, perPe, shield, limit },
  };
}

// ────────────────────────────────────────────────────────────────────────
// CANALIZAR EM GOLPE / AVANÇADA / MÁXIMA
// ────────────────────────────────────────────────────────────────────────
// Livro: Ação de Movimento (Avançada: também Reação). Limite de PE = CL
// (Máxima: CL+1). Próximo ataque (não-feitiço) recebe +1d6/PE (Avançada:
// d8/PE; Máxima: d10/PE + soma AU ao total). Errar não consome.

export interface CanalizarOptions {
  peSpent: number;
  /** Maior nível adquirido: 'basica' | 'avancada' | 'maxima'. */
  tier: 'basica' | 'avancada' | 'maxima';
}

export function calcularCanalizar(
  c: Character,
  opts: CanalizarOptions,
): ClActivationResult {
  const cl = getClLevel(c);
  const au = getAuLevel(c);
  const limit = opts.tier === 'maxima' ? cl + 1 : cl;
  const peSpent = Math.max(0, Math.floor(opts.peSpent));

  if (peSpent <= 0) {
    return { ok: false, reason: 'Gaste pelo menos 1 PE.', peSpent: 0, logMessage: '' };
  }
  if (peSpent > limit) {
    return {
      ok: false,
      reason: `Limite de PE para Canalizar (${opts.tier}): ${limit}.`,
      peSpent: 0,
      logMessage: '',
    };
  }
  if ((c.peCurrent ?? 0) < peSpent) {
    return { ok: false, reason: 'PE insuficiente.', peSpent: 0, logMessage: '' };
  }

  const die = opts.tier === 'basica' ? 'd6' : opts.tier === 'avancada' ? 'd8' : 'd10';
  const flat = opts.tier === 'maxima' && au > 0 ? ` + ${au} (AU)` : '';
  const formula = `${peSpent}${die}${flat} de dano adicional energético`;
  const tierLabel = opts.tier === 'basica' ? 'Canalizar em Golpe'
    : opts.tier === 'avancada' ? 'Canalização Avançada'
    : 'Canalização Máxima';

  return {
    ok: true,
    peSpent,
    omniFlagPatch: { canalizar_em_golpe_pe: peSpent },
    damageFormula: formula,
    logMessage: `⚡ ${tierLabel}: ${peSpent} PE armazenados — próximo ataque (não-feitiço) recebe ${formula}. Errar não consome.`,
    details: { peSpent, die, tier: opts.tier, flatBonus: au },
  };
}

// ────────────────────────────────────────────────────────────────────────
// PROJETAR ENERGIA / AVANÇADA / MÁXIMA
// ────────────────────────────────────────────────────────────────────────
// Livro: Ação Comum. PE limite = 1 + CL. Dano = PE × 1d10 + mod do
// maior atributo. Alcance = 9m + 1,5m × bônus de treinamento.
// Avançada: 2d8/PE, soma 2× modificador, +2 acerto/+2 CD.
// Máxima: 3d8/PE, +6 acerto/+4 CD, sucesso TR = dano/2.

export interface ProjetarOptions {
  peSpent: number;
  resolution: 'attack' | 'save';
  tier: 'basica' | 'avancada' | 'maxima';
}

/** Retorna o maior modificador entre os atributos. */
function getHighestAttrMod(c: Character): number {
  const values = (c.attributes ?? []).map(a => a.value ?? 10);
  if (values.length === 0) return 0;
  const highest = Math.max(...values);
  return Math.floor((highest - 10) / 2);
}

export function calcularProjetar(
  c: Character,
  opts: ProjetarOptions,
): ClActivationResult {
  const cl = getClLevel(c);
  const limit = 1 + cl;
  const peSpent = Math.max(0, Math.floor(opts.peSpent));

  if (peSpent <= 0) {
    return { ok: false, reason: 'Gaste pelo menos 1 PE.', peSpent: 0, logMessage: '' };
  }
  if (peSpent > limit) {
    return {
      ok: false,
      reason: `Limite de PE para Projetar Energia: ${limit} (1 + CL).`,
      peSpent: 0,
      logMessage: '',
    };
  }
  if ((c.peCurrent ?? 0) < peSpent) {
    return { ok: false, reason: 'PE insuficiente.', peSpent: 0, logMessage: '' };
  }

  const mod = getHighestAttrMod(c);
  const trainingBonus = getTrainingBonusByLevel(c.level ?? 1);
  const reach = 9 + 1.5 * trainingBonus;

  let die: string;
  let modMultiplier: number;
  let attackBonus = 0;
  let cdBonus = 0;
  let successNote = '';

  if (opts.tier === 'basica') {
    die = '1d10';
    modMultiplier = 1;
    successNote = opts.resolution === 'save' ? 'Sucesso no TR anula o dano.' : '';
  } else if (opts.tier === 'avancada') {
    die = '2d8';
    modMultiplier = 2;
    attackBonus = 2;
    cdBonus = 2;
    successNote = opts.resolution === 'save' ? 'Sucesso no TR anula o dano.' : '';
  } else {
    die = '3d8';
    modMultiplier = 2;
    attackBonus = 6;
    cdBonus = 4;
    successNote = opts.resolution === 'save' ? 'Sucesso no TR: alvo sofre METADE do dano.' : '';
  }

  const modText = mod !== 0 ? ` + ${mod * modMultiplier} (${modMultiplier > 1 ? '2× ' : ''}mod)` : '';
  const formula = `${peSpent}${die}${modText} dano de força`;
  const resolutionLabel = opts.resolution === 'attack'
    ? `Ataque com Feitiçaria${attackBonus ? ` (+${attackBonus})` : ''} (sem crítico)`
    : `TR Reflexos (CD aumentada em ${cdBonus || 0})`;
  const tierLabel = opts.tier === 'basica' ? 'Projetar Energia'
    : opts.tier === 'avancada' ? 'Projeção Avançada' : 'Projeção Máxima';

  return {
    ok: true,
    peSpent,
    damageFormula: formula,
    logMessage: `🌌 ${tierLabel}: ${peSpent} PE → ${formula}. ${resolutionLabel}. Alcance ${reach} m.${successNote ? ' ' + successNote : ''}`,
    details: { peSpent, die, mod, modMultiplier, reach, attackBonus, cdBonus, tier: opts.tier },
  };
}

// ────────────────────────────────────────────────────────────────────────
// ESTÍMULO MUSCULAR / AVANÇADO
// ────────────────────────────────────────────────────────────────────────
// Livro: 4 sub-modos. Avançado: 2× por rodada e bônus melhorados.

export type EstimuloSubmodo = 'movimento' | 'teste' | 'manobra' | 'pular';

export interface EstimuloOptions {
  submodo: EstimuloSubmodo;
  peSpent: number;
  /** true se possui Estímulo Muscular Avançado. */
  isAvancado: boolean;
  /** Velocidade base do personagem em metros (para sub-modo "movimento"). */
  baseSpeedM?: number;
}

export function calcularEstimulo(
  c: Character,
  opts: EstimuloOptions,
): ClActivationResult {
  const cl = getClLevel(c);
  const peSpent = Math.max(0, Math.floor(opts.peSpent));
  const speed = opts.baseSpeedM ?? 9;

  if (peSpent <= 0) {
    return { ok: false, reason: 'Gaste pelo menos 1 PE.', peSpent: 0, logMessage: '' };
  }
  if ((c.peCurrent ?? 0) < peSpent) {
    return { ok: false, reason: 'PE insuficiente.', peSpent: 0, logMessage: '' };
  }

  let logMessage = '';
  let cost = peSpent;

  switch (opts.submodo) {
    case 'movimento': {
      // Básico: 1 PE → +metade do deslocamento.
      // Avançado: 2 PE → +deslocamento total (em vez de metade).
      if (opts.isAvancado && peSpent >= 2) {
        cost = 2;
        logMessage = `🏃 Estímulo Muscular Avançado (Movimento): ${cost} PE → +${speed} m no deslocamento atual.`;
      } else {
        cost = 1;
        logMessage = `🏃 Estímulo Muscular (Movimento): 1 PE → +${speed / 2} m no deslocamento atual.`;
      }
      break;
    }
    case 'teste': {
      // Básico: até CL PE → +1/PE.
      // Avançado: +2/PE.
      if (peSpent > cl) {
        return {
          ok: false,
          reason: `Limite de PE para Estímulo (Teste): ${cl} (CL).`,
          peSpent: 0,
          logMessage: '',
        };
      }
      const perPe = opts.isAvancado ? 2 : 1;
      const bonus = peSpent * perPe;
      logMessage = `💪 Estímulo Muscular${opts.isAvancado ? ' Avançado' : ''} (Teste): ${peSpent} PE → +${bonus} no teste (até o início do próximo turno).`;
      break;
    }
    case 'manobra': {
      // Básico: 2 PE → CL × 1,5 m.
      // Avançado: 2 PE → CL × 3 m.
      cost = 2;
      const dist = opts.isAvancado ? cl * 3 : cl * 1.5;
      logMessage = `🤜 Estímulo Muscular${opts.isAvancado ? ' Avançado' : ''} (Empurrar/Arremessar): ${cost} PE → +${dist} m.`;
      break;
    }
    case 'pular': {
      cost = 1;
      logMessage = `🦘 Estímulo Muscular (Pular): 1 PE → distância DOBRADA.`;
      break;
    }
  }

  if ((c.peCurrent ?? 0) < cost) {
    return { ok: false, reason: 'PE insuficiente para esse sub-modo.', peSpent: 0, logMessage: '' };
  }

  return { ok: true, peSpent: cost, logMessage, details: { submodo: opts.submodo, baseSpeed: speed, cl } };
}

// ────────────────────────────────────────────────────────────────────────
// EXPANDIR AURA
// ────────────────────────────────────────────────────────────────────────
// Livro: 2 PE para ativar (1 rodada). +1 PE/rodada para manter.

export function calcularExpandirAura(
  c: Character,
  opts: { sustain: boolean },
): ClActivationResult {
  const cost = opts.sustain ? 1 : 2;
  if ((c.peCurrent ?? 0) < cost) {
    return { ok: false, reason: 'PE insuficiente.', peSpent: 0, logMessage: '' };
  }

  return {
    ok: true,
    peSpent: cost,
    omniFlagPatch: { aura_expandida: 1 },
    logMessage: opts.sustain
      ? `🌀 Expandir Aura: +1 PE para manter por mais 1 rodada (alcance das aptidões de aura passivas continua DOBRADO).`
      : `🌀 Expandir Aura: 2 PE → alcance de TODAS as aptidões de aura passivas DOBRADO por 1 rodada.`,
    details: { sustain: opts.sustain ? 1 : 0 },
  };
}

// ────────────────────────────────────────────────────────────────────────
// HELPERS COMUNS — testes vs CD Amaldiçoada
// ────────────────────────────────────────────────────────────────────────

/** Tipo da função de rolagem; recebe (sides) e devolve um inteiro 1..sides. Permite mock determinístico nos testes. */
export type RollFn = (sides: number) => number;

/**
 * Em produção, o caller (useCharacterStore) pré-rola os d20s via física 3D e
 * injeta `rollFn` consumindo essa fila. Se nada for injetado, este default
 * estoura — assim garantimos que NENHUMA rolagem escapa do pipeline 3D.
 */
const defaultRoll: RollFn = (sides) => {
  throw new Error(
    `clActivation.defaultRoll(${sides}): rolagem direta proibida — injete rollFn vindo da física 3D.`,
  );
};


/** Bônus em uma perícia treinada/mestria, considerando atributo vinculado. */
function getSkillBonus(c: Character, skillName: string): number {
  const target = skillName.trim().toLowerCase();
  const skill = (c.skills ?? []).find((s) => (s.name ?? '').trim().toLowerCase() === target);
  if (!skill) return 0;
  const linked = (c.attributes ?? []).find((a) => a.name === skill.linkedAttribute);
  const attrMod = linked ? Math.floor((linked.value - 10) / 2) : 0;
  const trainingBonus = getTrainingBonusByLevel(c.level ?? 1);
  let total = attrMod;
  if (skill.trained) total += trainingBonus;
  if (skill.mastery) total += trainingBonus; // duplicado em maestria
  if (skill.externalBonus) total += skill.externalBonus;
  return total;
}

// ────────────────────────────────────────────────────────────────────────
// LEITURA DE AURA
// ────────────────────────────────────────────────────────────────────────
// Livro: teste de Feitiçaria contra a CD Amaldiçoada da criatura.
// Sucesso → revela propriedades passivas e ativas da aura.

export interface LeituraDeAuraOptions {
  cdAmaldicoada: number;
  rollFn?: RollFn;
}

export function calcularLeituraDeAura(
  c: Character,
  opts: LeituraDeAuraOptions,
): ClActivationResult {
  const roll = (opts.rollFn ?? defaultRoll)(20);
  const bonus = getSkillBonus(c, 'Feitiçaria');
  const total = roll + bonus;
  const ok = total >= opts.cdAmaldicoada;
  return {
    ok: true, // a aptidão sempre roda (sem custo de PE); ok=true == teste resolvido
    peSpent: 0,
    logMessage: `🔍 Leitura de Aura: Feitiçaria ${roll}${bonus >= 0 ? '+' : ''}${bonus} = ${total} vs CD ${opts.cdAmaldicoada} → ${ok ? '✅ SUCESSO (revela aptidões de aura passivas e ativas).' : '❌ FALHA.'}`,
    details: { roll, bonus, total, cd: opts.cdAmaldicoada, success: ok ? 1 : 0 },
  };
}

// ────────────────────────────────────────────────────────────────────────
// LEITURA RÁPIDA DE ENERGIA
// ────────────────────────────────────────────────────────────────────────
// Livro: Ação de Movimento. Percepção +CL vs CD Amaldiçoada.
// Sucesso → ignora desvantagem por aura e bônus de Defesa por aura
// do alvo até o fim da cena.

export interface LeituraRapidaOptions {
  cdAmaldicoada: number;
  rollFn?: RollFn;
}

export function calcularLeituraRapida(
  c: Character,
  opts: LeituraRapidaOptions,
): ClActivationResult {
  const cl = getClLevel(c);
  const roll = (opts.rollFn ?? defaultRoll)(20);
  const bonus = getSkillBonus(c, 'Percepção') + cl;
  const total = roll + bonus;
  const ok = total >= opts.cdAmaldicoada;
  return {
    ok: true,
    peSpent: 0,
    omniFlagPatch: ok ? { leitura_rapida_ativa: 1 } : undefined,
    logMessage: `👁️ Leitura Rápida de Energia: Percepção ${roll}${bonus >= 0 ? '+' : ''}${bonus} (incl. CL ${cl}) = ${total} vs CD ${opts.cdAmaldicoada} → ${ok ? '✅ SUCESSO — ignora desvantagem por aura e bônus de Defesa por aura do alvo até o fim da cena.' : '❌ FALHA.'}`,
    details: { roll, bonus, total, cd: opts.cdAmaldicoada, success: ok ? 1 : 0 },
  };
}

// ────────────────────────────────────────────────────────────────────────
// PROJEÇÃO DIVIDIDA
// ────────────────────────────────────────────────────────────────────────
// Livro: ao usar Projetar Energia, pague até METADE do PE original para
// duplicar a projeção contra um 2º alvo a ≤ 4,5m. A duplicata sempre
// usa TR Reflexos.

export interface ProjecaoDivididaOptions {
  peOriginal: number;
  peDuplicata: number;
  /** Tier de Projetar Energia possuído. */
  tier: 'basica' | 'avancada' | 'maxima';
}

export function calcularProjecaoDividida(
  c: Character,
  opts: ProjecaoDivididaOptions,
): ClActivationResult {
  const limit = Math.floor(opts.peOriginal / 2);
  const peSpent = Math.max(0, Math.floor(opts.peDuplicata));

  if (peSpent <= 0) {
    return { ok: false, reason: 'Gaste pelo menos 1 PE na duplicata.', peSpent: 0, logMessage: '' };
  }
  if (peSpent > limit) {
    return {
      ok: false,
      reason: `Limite da duplicata: ${limit} (metade do PE original ${opts.peOriginal}).`,
      peSpent: 0,
      logMessage: '',
    };
  }
  if ((c.peCurrent ?? 0) < peSpent) {
    return { ok: false, reason: 'PE insuficiente.', peSpent: 0, logMessage: '' };
  }

  // Reaproveita Projetar Energia para calcular o dano da duplicata.
  const dup = calcularProjetar(
    { ...c, peCurrent: peSpent } as Character,
    { peSpent, resolution: 'save', tier: opts.tier },
  );
  if (!dup.ok) return dup;

  return {
    ok: true,
    peSpent,
    damageFormula: dup.damageFormula,
    logMessage: `🌠 Projeção Dividida: ${peSpent} PE → duplicata contra alvo ≤ 4,5 m do alvo original via TR Reflexos. ${dup.damageFormula}.`,
    details: { peOriginal: opts.peOriginal, peSpent, limit, tier: opts.tier },
  };
}

// ────────────────────────────────────────────────────────────────────────
// EMOÇÃO DA PÉTALA DECADENTE — uso ofensivo
// ────────────────────────────────────────────────────────────────────────
// Livro (parte ofensiva): se uma criatura entrar (ou começar o turno) em
// alcance corpo-a-corpo, gaste 5 PE como Ação Livre para realizar um
// ataque corpo-a-corpo com SUCESSO GARANTIDO. Penalidade: você não pode
// se proteger contra acertos garantidos até o início do seu próximo turno.

export function calcularPetalaOfensiva(c: Character): ClActivationResult {
  const cost = 5;
  if ((c.peCurrent ?? 0) < cost) {
    return { ok: false, reason: 'PE insuficiente (5 PE).', peSpent: 0, logMessage: '' };
  }
  return {
    ok: true,
    peSpent: cost,
    omniFlagPatch: { petala_ofensiva_penalidade: 1 },
    logMessage: `🌸 Emoção da Pétala Decadente (ofensiva): 5 PE → ataque corpo-a-corpo com SUCESSO GARANTIDO. ⚠️ Você não pode se proteger contra acertos garantidos até o início do seu próximo turno.`,
    details: { cost },
  };
}

// ────────────────────────────────────────────────────────────────────────
// RASTREIO AVANÇADO
// ────────────────────────────────────────────────────────────────────────
// Livro: detecta vestígios automaticamente. Se desconhece a origem, faz
// teste de Investigação OU Percepção vs CD Amaldiçoada do originador.

export interface RastreioOptions {
  cdAmaldicoada: number;
  skill: 'Investigação' | 'Percepção';
  /** Se já conhece a origem, pula o teste e identifica direto. */
  alreadyKnown?: boolean;
  rollFn?: RollFn;
}

export function calcularRastreio(
  c: Character,
  opts: RastreioOptions,
): ClActivationResult {
  if (opts.alreadyKnown) {
    return {
      ok: true,
      peSpent: 0,
      logMessage: `🔎 Rastreio Avançado: origem conhecida — vestígios identificados automaticamente.`,
      details: { auto: 1 },
    };
  }
  const roll = (opts.rollFn ?? defaultRoll)(20);
  const bonus = getSkillBonus(c, opts.skill);
  const total = roll + bonus;
  const ok = total >= opts.cdAmaldicoada;
  return {
    ok: true,
    peSpent: 0,
    logMessage: `🔎 Rastreio Avançado (${opts.skill}): ${roll}${bonus >= 0 ? '+' : ''}${bonus} = ${total} vs CD ${opts.cdAmaldicoada} → ${ok ? '✅ SUCESSO — características da energia reveladas e segue o rastro até onde acaba.' : '❌ FALHA.'}`,
    details: { roll, bonus, total, cd: opts.cdAmaldicoada, success: ok ? 1 : 0 },
  };
}


// ────────────────────────────────────────────────────────────────────────
// PUNHO DIVERGENTE
// ────────────────────────────────────────────────────────────────────────
// Livro p. 181: Ao acertar um ataque DESARMADO (não pode ser raio negro),
// o usuário pode causar METADE do dano agora e adiar a outra metade para
// o turno seguinte. No turno seguinte, o alvo faz TR de Fortitude
// (CD = CD Amaldiçoada do usuário + 1 a cada 5 pts de dano da 1ª metade).
// Em FALHA: o dano restante é causado COMO SE O ALVO TIVESSE VULNERABILIDADE
// (ou seja, dobrado). Em SUCESSO: dano normal (a outra metade).
//
// Implementação: duas fases.
//   1) "armar" → calcula metades, devolve flagPatch com pendência e CD.
//   2) "resolver" → consome a pendência, roll Fortitude do alvo, devolve
//      dano final e limpa as flags.

export interface PunhoDivergenteArmarOptions {
  /** Dano TOTAL do golpe desarmado já rolado. */
  danoTotal: number;
}

export interface PunhoDivergenteResolverOptions {
  /** Bônus de Fortitude do ALVO (atributo físico + maestria, etc). */
  fortitudeAlvo: number;
  rollFn?: RollFn;
}

/** CD Amaldiçoada local — evita import circular com fahCombatHooks. */
function calcCdAmaldicoadaLocal(c: Character): number {
  const con = (c.attributes ?? []).find((a) => a.name === 'Constituição');
  const conMod = con ? Math.floor((con.value - 10) / 2) : 0;
  return 8 + getTrainingBonusByLevel(c.level ?? 1) + conMod;
}

export function calcularPunhoDivergenteArmar(
  c: Character,
  opts: PunhoDivergenteArmarOptions,
): ClActivationResult {
  if (!Number.isFinite(opts.danoTotal) || opts.danoTotal <= 0) {
    return { ok: false, peSpent: 0, logMessage: '', reason: 'Dano total deve ser > 0.' };
  }
  // Verifica se já há pendência ativa.
  const ativo = (c.omniFlags ?? {}).punho_divergente_dano_pendente;
  if (ativo && ativo > 0) {
    return {
      ok: false, peSpent: 0, logMessage: '',
      reason: 'Já há um Punho Divergente pendente — resolva-o no próximo turno antes de armar outro.',
    };
  }
  const metade = Math.floor(opts.danoTotal / 2);
  const resto = opts.danoTotal - metade; // a "outra metade" (arredonda pra cima)
  const cdBonus = Math.floor(metade / 5); // +1 CD a cada 5 pts da PRIMEIRA metade
  const cdBase = calcCdAmaldicoadaLocal(c);
  const cdFinal = cdBase + cdBonus;
  return {
    ok: true,
    peSpent: 0,
    omniFlagPatch: {
      punho_divergente_dano_pendente: resto,
      punho_divergente_cd: cdFinal,
    },
    logMessage:
      `👊 Punho Divergente ARMADO: causa ${metade} de dano AGORA. ` +
      `Resto (${resto}) adiado p/ próximo turno → TR Fortitude vs CD ${cdFinal} (base ${cdBase} + ${cdBonus} de bônus). ` +
      `Falha = ${resto * 2} (vulnerabilidade); Sucesso = ${resto}.`,
    damageFormula: `${metade} agora; ${resto} pendente (vulnerabilidade em falha).`,
    details: { metadeAgora: metade, resto, cdBase, cdBonus, cdFinal },
  };
}

export function calcularPunhoDivergenteResolver(
  c: Character,
  opts: PunhoDivergenteResolverOptions,
): ClActivationResult {
  const flags = c.omniFlags ?? {};
  const resto = flags.punho_divergente_dano_pendente ?? 0;
  const cd = flags.punho_divergente_cd ?? 0;
  if (resto <= 0 || cd <= 0) {
    return { ok: false, peSpent: 0, logMessage: '', reason: 'Não há Punho Divergente pendente.' };
  }
  const roll = (opts.rollFn ?? defaultRoll)(20);
  const total = roll + opts.fortitudeAlvo;
  const sucesso = total >= cd;
  const danoFinal = sucesso ? resto : resto * 2;
  return {
    ok: true,
    peSpent: 0,
    omniFlagPatch: {
      punho_divergente_dano_pendente: 0,
      punho_divergente_cd: 0,
    },
    logMessage:
      `👊 Punho Divergente RESOLVIDO: TR Fortitude ${roll}${opts.fortitudeAlvo >= 0 ? '+' : ''}${opts.fortitudeAlvo} = ${total} vs CD ${cd} → ` +
      (sucesso
        ? `✅ Sucesso — alvo recebe ${danoFinal} (dano restante normal).`
        : `❌ Falha — alvo recebe ${danoFinal} (vulnerabilidade: ${resto} × 2).`),
    damageFormula: `${danoFinal} de dano de impacto`,
    details: { roll, fortitudeAlvo: opts.fortitudeAlvo, total, cd, sucesso: sucesso ? 1 : 0, danoFinal },
  };
}
