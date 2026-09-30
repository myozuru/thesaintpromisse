import { duelistaApplies, getDuelistaBonus, distanteApplies, getDistanteBonus, arremessadorApplies, getArremessadorDamage, duploApplies, getDuploDamage, massivoApplies, getMassivoDamage } from './combateEstilos';
import { posturaAtaque } from '@/lib/posturas';
import { execucaoSilenciosaDice } from './artesCombate';
import { consumeCritNegated } from '@/lib/suporteNegacao';
/**
 * Motor de Combate.
 *
 * Responsabilidades:
 *   - Construir um AttackContext (atacante, arma, alvo, situação).
 *   - Agregar bônus de talento CONTEXTUAIS (filtrados por grupo de arma,
 *     range, condição do alvo etc.) — complementa `aggregateTalentBonuses`,
 *     que só lida com bônus globais.
 *   - Rolar ataque + dano com aplicação dos modificadores e crítico.
 *   - Empilhar entradas no AttackLog para UI/replay.
 *
 * Não-objetivos:
 *   - Posicionamento/grid (fica narrativo).
 *   - Reações automáticas que dependem do turno do oponente — para essas,
 *     expomos `evaluateReactionTriggers` que devolve uma lista de prompts
 *     a ser oferecida via `useReactionStore`.
 */

import type { Character } from '@/types';
import { rollD20Com, rollDiceCom } from '@/lib/dice';
import {
  parseDamage, formatDamage, stepDamage, addBonusDice,
  type DamageDice,
} from '@/lib/damageStep';
import {
  hasProperty, getProperty, resolveWeaponDamage,
  type Weapon, type WeaponGroup, type WeaponRange,
} from '@/lib/weapons';
import { arremessosPotentesStep } from '@/lib/arremessosPotentes';
import { aggregateTalentBonuses } from '@/lib/talentEffects';
import { getTalentById } from '@/lib/talents';
import { consumeAdvantageFor, consumeFlatBonusFor } from '@/lib/omni/rollAdvantage';

// ===== Tipos públicos =======================================================

export interface AttackSituation {
  /** O alvo está [Desprevenido] em relação ao atacante (apunhaladora, furtividade…). */
  targetUnaware?: boolean;
  /** O alvo está [Caído]. */
  targetProne?: boolean;
  /** Nº de ataques anteriores feitos com a MESMA arma neste turno (para 'Enérgica'). */
  previousAttacksThisTurn?: number;
  /** Última jogada com esta arma foi um ERRO (para 'Oscilante'). */
  previousMissed?: boolean;
  /** Empunhando duas mãos (para versátil/duas-mãos). */
  twoHanded?: boolean;
  /** Modificador escolhido (FOR ou DES) para o ataque. Se ausente, o engine escolhe por fineza. */
  preferredAbility?: 'FOR' | 'DES';
  /** Alvo está com `aura_embacada` ativa → atacante tem desvantagem (cancela vantagem). */
  targetHasAuraEmbacada?: boolean;
  /** Carga de "Concentrar Aura" do atacante. Soma +au como dano flat se acertar. */
  attackerConcentratedAura?: number;
  /** Atacante está agarrado (engine de grapple) → desvantagem em ataques. */
  attackerIsGrappled?: boolean;
  /** Arte do Combate — Execução Silenciosa: +1d6 (+1d6 a cada +2 SAB) se o alvo estiver Desprevenido. */
  arteExecucao?: boolean;
  /** Golpe Especial (Especialista nv 4). */
  golpeAtroz?: boolean;
  golpeLetal?: boolean;
  golpePreciso?: boolean;
  golpeDesfocado?: number;
  /** Arsenal Cíclico: +1 dado com a arma trocada. */
  arsenalCiclico?: boolean;
  /** Postura da Devastação: acerto acumulado contra o mesmo alvo. */
  devastacaoHit?: number;
  /** Postura da Fortuna: pode rerrolar d20 baixo. */
  fortuna?: boolean;
}

export interface AttackContext {
  attacker: Character;
  weapon: Weapon;
  /** Modificador de atributo já calculado (FOR ou DES). */
  abilityMod: number;
  /** Bônus de treinamento do personagem (proficient com a arma). */
  trainingBonus: number;
  /** É treinado neste tipo/grupo de arma? Se false, NÃO soma trainingBonus. */
  trained: boolean;
  /** Defesa do alvo. */
  targetDefense: number;
  situation: AttackSituation;
}

export interface AttackResult {
  d20: number;
  /** Todos os d20 rolados no ataque. Em vantagem/desvantagem contém 2 valores. */
  attackRolls: number[];
  /** Como a rolagem de ataque foi resolvida após cancelamentos. */
  rollMode: 'normal' | 'advantage' | 'disadvantage';
  /** Acerto natural antes de modificadores. */
  natural: number;
  attackTotal: number;
  hit: boolean;
  critical: boolean;
  criticalFail: boolean;
  damageDice: string;
  damageRolls: number[];
  damageTotal: number;
  damageType: string | null;
  /** Modificadores aplicados (origem → valor) para auditoria. */
  modifiers: { source: string; value: number }[];
  /** Mensagens narrativas geradas (push, prone, retorno do chakram etc.). */
  notes: string[];
  /** Reroll disponível do Ataque Infalível (se ainda não usado nesta rodada). */
  canRerollDamage: boolean;
}

// ===== Bônus contextuais por talento =======================================

interface ContextualBonus {
  hit: number;
  damageFlat: number;
  damageStepDelta: number;
  bonusDice: number;
  /** Vantagem na rolagem de ataque. */
  advantage: boolean;
  /** Desvantagem na rolagem de ataque (cancela vantagem). */
  disadvantage: boolean;
  /** Margem crítica reduzida (-N). */
  critRangeBonus: number;
  /** Notas narrativas para empilhar no log. */
  notes: string[];
}

/** Estilos de combate do Especialista (Repertório). */
function applyCombatStyleBonuses(ctx: AttackContext, out: ContextualBonus): void {
  const d = duelistaApplies(ctx.attacker, ctx.weapon, !!ctx.situation.twoHanded);
  if (d.ok) {
    const b = getDuelistaBonus(ctx.attacker.level ?? 1);
    out.hit += b.hit; out.damageFlat += b.damage;
    out.notes.push(`Estilo do Duelista: +${b.hit} acerto, +${b.damage} dano`);
  } else if (d.reason) {
    out.notes.push(`Estilo do Duelista inativo (${d.reason})`);
  }
  if (distanteApplies(ctx.attacker, ctx.weapon)) {
    const b = getDistanteBonus(ctx.attacker.level ?? 1);
    out.hit += b.hit; out.damageFlat += b.damage;
    out.notes.push(`Estilo Distante: +${b.hit} acerto, +${b.damage} dano`);
  }
  if (arremessadorApplies(ctx.attacker, ctx.weapon)) {
    const dmg = getArremessadorDamage(ctx.attacker.level ?? 1);
    out.damageFlat += dmg;
    out.notes.push(`Estilo do Arremessador: +${dmg} dano`);
  }
  const apStep = arremessosPotentesStep(ctx.attacker, ctx.weapon);
  if (apStep) {
    out.damageStepDelta += apStep;
    out.notes.push('Arremessos Potentes: +1 nível de dano');
  }
  if (duploApplies(ctx.attacker)) {
    const dmg = getDuploDamage(ctx.attacker.level ?? 1);
    out.damageFlat += dmg;
    out.notes.push(`Estilo Duplo: +${dmg} dano`);
  }
  if (massivoApplies(ctx.attacker, ctx.weapon, !!ctx.situation.twoHanded)) {
    const dmg = getMassivoDamage(ctx.attacker.level ?? 1);
    out.damageFlat += dmg;
    out.notes.push(`Estilo Massivo: +${dmg} dano`);
  }
}

const emptyCtx = (): ContextualBonus => ({
  hit: 0, damageFlat: 0, damageStepDelta: 0, bonusDice: 0,
  advantage: false, disadvantage: false, critRangeBonus: 0, notes: [],
});

/**
 * Mapeia cada talento de combate (dos 17) para seu efeito contextual.
 * Mantemos a tabela aqui para que adicionar/remover talento exija mexer
 * em UM lugar só.
 */
function applyTalentContextualBonuses(ctx: AttackContext, out: ContextualBonus): void {
  const chosen = ctx.attacker.chosenTalents ?? [];
  const has = (id: string) => chosen.some(c => c.id === id);
  const w = ctx.weapon;
  const isThrown = w.range === 'thrown' || hasProperty(w, 'arremessavel');
  const isMelee = w.range === 'melee';

  // Mestre do Arremesso (substitui Técnicas de Arremesso)
  if (isThrown && has('tal-mestre-arremesso')) {
    out.bonusDice += 1;
    out.hit += 4; out.damageFlat += 6;
    out.notes.push('Mestre do Arremesso: +1 dado, +4 acerto, +6 dano');
  } else if (isThrown && has('tal-tecnicas-arremesso')) {
    out.hit += 2; out.damageFlat += 3;
    out.notes.push('Técnicas de Arremesso: +2/+3');
  }

  // Mestre dos Chicotes
  if (w.group === 'Chicote' && isMelee && has('tal-mestre-chicotes')) {
    out.damageFlat += 4;
    out.notes.push('Mestre dos Chicotes: +4 dano, alcance +1,5m, 1×/turno TR Fortitude no acerto');
  }

  // Especialistas em tipo de dano (1 passo no dado, 1×/turno)
  if (isMelee && w.damageType === 'Im' && has('tal-especialista-concussao')) {
    out.damageStepDelta += 1;
    out.notes.push('Especialista em Concussão: +1 nível de dano (impacto)');
  }
  if (isMelee && w.damageType === 'Ct' && has('tal-especialista-cortes')) {
    out.damageStepDelta += 1;
    out.notes.push('Especialista em Cortes: +1 nível de dano (cortante); -4,5m mov. inimigo no acerto');
  }
  if (isMelee && w.damageType === 'Pf' && has('tal-especialista-perfuracao')) {
    out.damageStepDelta += 1;
    out.notes.push('Especialista em Perfuração: +1 nível; reroll de dado (1×/turno) disponível');
  }

  // Apunhaladora vs alvo desprevenido
  if (ctx.situation.targetUnaware && hasProperty(w, 'apunhaladora')) {
    out.damageFlat += ctx.trainingBonus;
    out.notes.push(`Apunhaladora vs desprevenido: +${ctx.trainingBonus} dano`);
  }

  // Enérgica: 2º ataque ganha +qtdDadosBase; cada subsequente +1
  if (hasProperty(w, 'energica') && (ctx.situation.previousAttacksThisTurn ?? 0) > 0) {
    const baseDice = parseDamage(resolveWeaponDamage(w, ctx.situation.twoHanded) ?? '1d4');
    const baseCount = baseDice.reduce((a, d) => a + d.count, 0);
    const n = ctx.situation.previousAttacksThisTurn!;
    const energicBonus = baseCount + Math.max(0, n - 1);
    out.damageFlat += energicBonus;
    out.notes.push(`Enérgica (ataque ${n + 1}): +${energicBonus} dano`);
  }

  // Oscilante: errou anterior → +2 acerto
  if (hasProperty(w, 'oscilante') && ctx.situation.previousMissed) {
    out.hit += 2;
    out.notes.push('Oscilante: +2 acerto após erro');
  }

  // Pesada [X]: FOR insuficiente → desvantagem em ataque (cancelada por vantagem).
  const pesada = getProperty(w, 'pesada');
  if (pesada && pesada.value != null) {
    const forAttr = (ctx.attacker.attributes ?? []).find(a => a.name.toUpperCase() === 'FOR');
    if ((forAttr?.value ?? 0) < pesada.value) {
      out.disadvantage = true;
      out.notes.push(`Pesada [${pesada.value}]: FOR insuficiente — desvantagem em ataque`);
    }
  }

  // Mortal/Fatal são tratados na hora do crítico (ver rollAttack).

  // Aura Embaçada do alvo: desvantagem no atacante (visão obstruída pela aura).
  if (ctx.situation.targetHasAuraEmbacada) {
    out.disadvantage = true;
    out.notes.push('Aura Embaçada do alvo: desvantagem em ataque');
  }

  // Atacante agarrado: desvantagem em ataques.
  if (ctx.situation.attackerIsGrappled) {
    out.disadvantage = true;
    out.notes.push('Agarrado: desvantagem em ataque');
  }

  // NOTA: Favorecido pela Sorte NÃO concede mais vantagem pré-rolagem.
  // A nova mecânica é PÓS-rolagem: o jogador vê o resultado e decide
  // gastar 1 ponto de Sorte para re-rolar (mantendo o MAIOR), repetindo
  // até esgotar pontos. Implementado no AttackPanel via `handleLuckReroll`.

  // Golpe com Aura: consome carga concentrada como dano flat extra.
  const concAU = ctx.situation.attackerConcentratedAura ?? 0;
  if (concAU > 0) {
    out.damageFlat += concAU;
    out.notes.push(`Golpe com Aura: +${concAU} dano (carga consumida)`);
  }
}

// ===== Resolução do ataque =================================================

/** Determina se a arma usa FOR ou DES (considera fineza). */
export function pickAttackAbility(
  c: Character, w: Weapon, preferred?: 'FOR' | 'DES',
): 'FOR' | 'DES' {
  const finesse = hasProperty(w, 'fineza');
  if (preferred && (finesse || preferred === 'FOR')) return preferred;
  if (w.range === 'ranged' || w.range === 'thrown') return 'DES';
  return finesse ? 'DES' : 'FOR';
}

export function getAbilityMod(c: Character, name: 'FOR' | 'DES'): number {
  const a = (c.attributes ?? []).find(x => x.name.toUpperCase() === name);
  if (!a) return 0;
  return Math.floor(((a.value ?? 10) - 10) / 2);
}

/** Resolve um ataque completo. Não muta nada — devolve resultado puro. */
export async function rollAttack(ctx: AttackContext): Promise<AttackResult> {
  const w = ctx.weapon;
  const dmgNotation = resolveWeaponDamage(w, ctx.situation.twoHanded) ?? '1d4';
  const baseDice = parseDamage(dmgNotation);

  // Bônus contextuais (talentos + propriedades)
  const ctxBonus = emptyCtx();
  applyTalentContextualBonuses(ctx, ctxBonus);
  applyCombatStyleBonuses(ctx, ctxBonus);

  // Bônus globais (só os relevantes ao ataque)
  const globals = aggregateTalentBonuses(ctx.attacker);

  // Mestre das Armas: -1 na margem crítica para o(s) grupo(s) escolhido(s).
  if (globals.weaponCriticalGroups.includes(w.group)) {
    ctxBonus.critRangeBonus += 1;
    ctxBonus.notes.push(`Mestre das Armas (${w.group}): margem crítica -1`);
  }

  // Vantagem/Desvantagem concedida via ações Omni (consome modifiers
  // com escopo "use" e mantém os de escopo turno/persistente).
  // Subtipo do ataque: melee se range='melee', cursed se a arma marca
  // como amaldiçoada (group 'Amaldiçoado'), ranged caso contrário.
  const attackSubtype: 'melee' | 'ranged' | 'cursed' =
    w.range === 'melee' ? 'melee' :
    (w.group === 'Amaldiçoado' as WeaponGroup) ? 'cursed' :
    'ranged';
  // Import estático seguro: rollAdvantage só depende de useCharacterStore.
  // (Nada importa combatEngine de dentro de rollAdvantage.)
  const omniAdv = consumeAdvantageFor(ctx.attacker.id, { kind: 'attack', subtype: attackSubtype, weaponGroup: w.group, weaponName: w.name });
  if (omniAdv.net === 'advantage') ctxBonus.advantage = true;
  if (omniAdv.net === 'disadvantage') ctxBonus.disadvantage = true;
  for (const n of omniAdv.notes) ctxBonus.notes.push(`Omni: ${n}`);
  // Bônus fixos de rolagem (Comando Motivador, etc.) somam no acerto.
  const flatAtk = consumeFlatBonusFor(ctx.attacker.id, { kind: 'attack', subtype: attackSubtype, weaponGroup: w.group, weaponName: w.name });
  if (flatAtk.bonus) { ctxBonus.hit = (ctxBonus.hit ?? 0) + flatAtk.bonus; for (const n of flatAtk.notes) ctxBonus.notes.push(n); }

  // Golpe Especial
  const post = posturaAtaque(ctx.attacker);
  if (post.hit) ctxBonus.hit = (ctxBonus.hit ?? 0) + post.hit;
  ctxBonus.bonusDice += post.bonusDice;
  ctxBonus.notes.push(...post.notes);
  if (ctx.situation.devastacaoHit) { ctxBonus.hit = (ctxBonus.hit ?? 0) + ctx.situation.devastacaoHit; ctxBonus.notes.push(`Postura da Devastação: +${ctx.situation.devastacaoHit} acerto`); }
  if (ctx.situation.arsenalCiclico) { ctxBonus.bonusDice += 1; ctxBonus.notes.push('Arsenal Cíclico: +1 dado'); }
  if (ctx.situation.golpeAtroz) { ctxBonus.bonusDice += 1; ctxBonus.notes.push('Golpe Especial Atroz: +1 dado'); }
  if (ctx.situation.golpeLetal) { ctxBonus.critRangeBonus += 1; ctxBonus.notes.push('Golpe Especial Letal: margem de crítico −1'); }
  if (ctx.situation.golpePreciso) { ctxBonus.advantage = true; ctxBonus.notes.push('Golpe Especial Preciso: vantagem'); }
  const desf = Math.min(3, Math.max(0, ctx.situation.golpeDesfocado ?? 0));
  if (desf) { ctxBonus.hit -= 4 * desf; ctxBonus.notes.push(`Golpe Especial Desfocado: −${4 * desf} acerto`); }

  // Margem crítica (menor = mais fácil)
  const baseCrit = w.critRange ?? 20;
  const critRange = Math.max(2, baseCrit - ctxBonus.critRangeBonus);

  // d20 — vantagem e desvantagem se cancelam mutuamente
  const attackRolls = [await rollD20Com(ctx.attacker.id)];
  let d20 = attackRolls[0];
  let rollMode: AttackResult['rollMode'] = 'normal';
  const hasAdv = ctxBonus.advantage && !ctxBonus.disadvantage;
  const hasDis = ctxBonus.disadvantage && !ctxBonus.advantage;
  if (hasAdv) {
    const r2 = await rollD20Com(ctx.attacker.id);
    attackRolls.push(r2);
    rollMode = 'advantage';
    if (r2 > d20) d20 = r2;
  } else if (hasDis) {
    const r2 = await rollD20Com(ctx.attacker.id);
    attackRolls.push(r2);
    rollMode = 'disadvantage';
    if (r2 < d20) d20 = r2;
  }
  if (ctx.situation.fortuna !== false) {
    const { perguntarFortuna } = await import('@/lib/fortuna');
    const novo = await perguntarFortuna(ctx.attacker.id, d20, 'ataque', () => rollD20Com(ctx.attacker.id));
    if (novo !== d20) {
      const i = attackRolls.lastIndexOf(d20);
      if (i >= 0) attackRolls[i] = novo;
      ctxBonus.notes.push(`Postura da Fortuna: d20 ${d20} → ${novo}`);
      d20 = novo;
    }
  }
  const natural = d20;
  const criticalFail = natural === 1 && !consumeCritNegated(ctx.attacker.id);
  const critical = natural >= critRange;

  // Modificadores
  const mods: AttackResult['modifiers'] = [];
  mods.push({ source: `Mod. ${ctx.situation.preferredAbility ?? 'auto'}`, value: ctx.abilityMod });
  if (ctx.trained) mods.push({ source: 'Treinamento', value: ctx.trainingBonus });
  if (ctxBonus.hit) mods.push({ source: 'Talento/Propriedade', value: ctxBonus.hit });

  // Bônus de ataque por tipo de arma (corpo a corpo vs. à distância).
  // `thrown` (arremessável) entra junto de ranged.
  if (w.range === 'melee' && (ctx.attacker.meleeAttackBonus ?? 0) !== 0) {
    mods.push({ source: 'Ataque Corpo a Corpo', value: ctx.attacker.meleeAttackBonus });
  } else if ((w.range === 'ranged' || w.range === 'thrown') && (ctx.attacker.rangedAttackBonus ?? 0) !== 0) {
    mods.push({ source: 'Ataque à Distância', value: ctx.attacker.rangedAttackBonus });
  }

  const attackTotal = natural + mods.reduce((a, m) => a + m.value, 0);
  const hit = !criticalFail && (critical || attackTotal >= ctx.targetDefense);

  // Dano: aplica step + dados extras + crítico (Mortal/Fatal)
  let finalDice: DamageDice = stepDamage(baseDice, ctxBonus.damageStepDelta);
  finalDice = addBonusDice(finalDice, ctxBonus.bonusDice);

  // Arte do Combate — Execução Silenciosa: +Nd6 vs. alvo Desprevenido.
  const execucaoD6 = ctx.situation.arteExecucao && ctx.situation.targetUnaware
    ? execucaoSilenciosaDice(ctx.attacker)
    : 0;
  if (execucaoD6 > 0) finalDice.push({ count: execucaoD6, sides: 6 });

  if (critical) {
    // Crítico padrão: dobra os dados. Mortal: +1 dado do tamanho listado.
    // Fatal: dado base sobe para o listado para fins de contagem.
    const fatal = getProperty(w, 'fatal');
    if (fatal?.die) {
      // Aumenta o maior dado para `fatal.die` (se for menor)
      const big = finalDice.reduce((m, d) => (d.sides > m.sides ? d : m), finalDice[0]);
      if (big.sides < fatal.die) big.sides = fatal.die;
    }
    // dobra dados
    finalDice = finalDice.map(d => ({ ...d, count: d.count * 2 }));
    const mortal = getProperty(w, 'mortal');
    if (mortal?.die) {
      finalDice.push({ count: 1, sides: mortal.die });
    }
  }

  let damageRolls: number[] = [];
  let damageTotal = 0;
  if (hit) {
    const massivo = massivoApplies(ctx.attacker, w, !!ctx.situation.twoHanded);
    const rerolled: string[] = [];
    for (const term of finalDice) {
      const { rolls, total } = await rollDiceCom(ctx.attacker.id, `${term.count}d${term.sides}`);
      if (massivo && rolls.length === term.count) {
        // Estilo Massivo: rerrola cada dado que caiu 1 ou 2 (uma vez), fica com o novo.
        for (let i = 0; i < rolls.length; i++) {
          if (rolls[i] <= 2) {
            const r = await rollDiceCom(ctx.attacker.id, `1d${term.sides}`);
            rerolled.push(`${rolls[i]}→${r.total}`);
            rolls[i] = r.total;
          }
        }
        damageRolls.push(...rolls);
        damageTotal += rolls.reduce((a, b) => a + b, 0);
      } else {
        damageRolls.push(...rolls);
        damageTotal += total;
      }
    }
    if (rerolled.length) ctxBonus.notes.push(`Estilo Massivo rerrolou: ${rerolled.join(', ')}`);
    damageTotal += (posturaAtaque(ctx.attacker).semAtributo ? 0 : ctx.abilityMod) + ctxBonus.damageFlat;
  }

  const notes = [...ctxBonus.notes];
  if (execucaoD6 > 0) notes.push(`Execução Silenciosa: +${execucaoD6}d6 de dano (alvo Desprevenido)`);
  if (critical) notes.push(`💥 Crítico (≥${critRange})`);
  if (criticalFail) {
    notes.push('💀 Falha crítica (1 nat)');
    if (globals.noEnemyReactionOnCritFail) {
      notes.push('🛡 Guarda Infalível: inimigo NÃO ganha reação por essa falha.');
    }
  }

  return {
    d20: natural, attackRolls, rollMode, natural, attackTotal, hit, critical, criticalFail,
    damageDice: formatDamage(finalDice),
    damageRolls, damageTotal,
    damageType: w.damageType,
    modifiers: mods, notes,
    canRerollDamage:
      hit && (ctx.attacker.chosenTalents ?? []).some(t => t.id === 'tal-ataque-infalivel'),
  };
}

// ===== Reações disponíveis =================================================

export type ReactionPrompt =
  | { id: 'apaziguador-tecnica'; label: string; reason: string }
  | { id: 'sentinela'; label: string; reason: string }
  | { id: 'movimentos-acrobaticos'; label: string; reason: string }
  | { id: 'tecnicas-defensivas-escudo'; label: string; reason: string };

/**
 * Avalia, dado um evento de combate, quais talentos do defensor disparam
 * uma reação. A UI chama isto e empilha prompts no useReactionStore.
 */
export function evaluateReactionTriggers(
  defender: Character,
  event:
    | { kind: 'enemy_casting_adjacent' }
    | { kind: 'ally_attacked_adjacent' }
    | { kind: 'received_prone' }
    | { kind: 'reflex_save_pending' },
): ReactionPrompt[] {
  const has = (id: string) => (defender.chosenTalents ?? []).some(c => c.id === id);
  const out: ReactionPrompt[] = [];
  if (event.kind === 'enemy_casting_adjacent' && has('tal-apaziguador-tecnica')) {
    out.push({
      id: 'apaziguador-tecnica',
      label: 'Apaziguador de Técnica (Reação)',
      reason: 'Inimigo adjacente conjurando — gere AdO; alvo faz TR de Concentração ao acerto.',
    });
  }
  if (event.kind === 'ally_attacked_adjacent' && has('tal-tecnicas-sentinela')) {
    out.push({
      id: 'sentinela',
      label: 'Sentinela (Reação)',
      reason: 'Inimigo a 1,5m atacou seu aliado — você ganha 1 AdO contra o inimigo.',
    });
  }
  if (event.kind === 'received_prone' && has('tal-movimentos-acrobaticos')) {
    out.push({
      id: 'movimentos-acrobaticos',
      label: 'Movimentos Acrobáticos (Trigger)',
      reason: 'Caído: role Acrobacia vs CD — sucesso = levanta de graça +3m sem AdO + Defesa +(DES/2).',
    });
  }
  if (event.kind === 'reflex_save_pending' && has('tal-tecnicas-defensivas-escudo')) {
    out.push({
      id: 'tecnicas-defensivas-escudo',
      label: 'Técnicas Defensivas de Escudo (Reação)',
      reason: 'Reduza em -3 a margem de Sucesso Crítico do TR de Reflexos pendente.',
    });
  }
  return out;
}

// ===== Modificadores de ações específicas ==================================

/** Modifica a ação Investida quando o personagem tem o talento. */
export function applyInvestidaModifiers(c: Character) {
  const has = (c.chosenTalents ?? []).some(t => t.id === 'tal-investida-aprimorada');
  if (!has) return null;
  const train = c.trainingBonus ?? 0;
  return {
    moveBonusMeters: 3,
    hitBonus: train,
    onHit: 'Disputa de Atletismo: alvo falha → [Caído]',
  };
}

/** Tracker de Esquivar (Ação Bônus, Mod.DES/long-rest). */
export function getEsquivaTracker(c: Character) {
  const has = (c.chosenTalents ?? []).some(t => t.id === 'tal-tecnicas-esquiva');
  if (!has) return null;
  const desMod = getAbilityMod(c, 'DES');
  return { max: Math.max(1, desMod), scope: 'rest_long' as const };
}

/** Tracker de Provocação Desafiadora (Mod.PRE/2 por descanso). */
export function getProvocacaoTracker(c: Character) {
  const has = (c.chosenTalents ?? []).some(t => t.id === 'tal-provocacao-desafiadora');
  if (!has) return null;
  const pre = (c.attributes ?? []).find(a => a.name === 'Presença');
  const preMod = pre ? Math.floor(((pre.value ?? 10) - 10) / 2) : 0;
  return { max: Math.max(0, Math.floor(preMod / 2)), scope: 'rest_long' as const };
}

/** Recupera 1 ponto de Sorte quando inimigo rola 20 natural contra você. */
export function shouldRecoverLuckOnEnemyNat20(c: Character): boolean {
  return (c.chosenTalents ?? []).some(t => t.id === 'tal-favorecido-pela-sorte');
}

// ===== Construtor de contexto ==============================================

export function buildAttackContext(opts: {
  attacker: Character;
  weapon: Weapon;
  targetDefense: number;
  situation?: AttackSituation;
  trainedGroups?: WeaponGroup[]; // grupos de arma onde é treinado
  trainedRanges?: WeaponRange[]; // ranges onde é treinado
}): AttackContext {
  const sit = opts.situation ?? {};
  const ability = pickAttackAbility(opts.attacker, opts.weapon, sit.preferredAbility);
  const abilityMod = getAbilityMod(opts.attacker, ability);
  const trained =
    (opts.trainedGroups?.includes(opts.weapon.group) ?? false) ||
    (opts.trainedRanges?.includes(opts.weapon.range) ?? false);
  return {
    attacker: opts.attacker,
    weapon: opts.weapon,
    abilityMod,
    trainingBonus: opts.attacker.trainingBonus ?? 0,
    trained,
    targetDefense: opts.targetDefense,
    situation: { ...sit, preferredAbility: ability },
  };
}

// ===== Re-exports úteis ====================================================
export { getTalentById };
