/**
 * MOTOR DE PROGRESSÃO AUTOMÁTICA — LUTADOR
 *
 * Injeta passivas, manobras e dados de empolgação EXATAMENTE quando o
 * `characterLevel` atingir o número correspondente. Funciona como
 * idempotente: chamar `applyLutadorProgression(c, level)` SEMPRE produz
 * o mesmo conjunto final (substitui as passivas/marcas geradas pelo motor),
 * de modo que quedas/mudanças de spec resultem em estado consistente.
 *
 * Os trackers gerados (escolha de manobra, mastery TR) são DEVOLVIDOS para o
 * caller (store) injetar na fila `pendingLevelChoices` apenas para os níveis
 * NOVOS — assim subir do Nv 6 para 7 não regera o tracker do 6.
 */
import type { Character, Passive, Specialization } from '@/types';
import type { PendingLevelChoice } from '@/lib/levelEngine';

// ===== Manobras de Empolgação ==============================================

export const LUTADOR_MANEUVERS = [
  'Ajuste',
  'Comando',
  'Desarme',
  'Esquiva',
  'Trabalho de Pés',
] as const;
export type LutadorManeuver = typeof LUTADOR_MANEUVERS[number];

/**
 * Descrição detalhada de cada Manobra de Empolgação.
 * `short` = resumo de 1 linha (chip/tooltip).
 * `full`  = explicação narrativa + mecânica completa.
 */
export const LUTADOR_MANEUVER_DETAILS: Record<LutadorManeuver, {
  short: string;
  cost: string;
  trigger: string;
  effect: string;
  flavor: string;
}> = {
  'Ajuste': {
    short: 'Reposiciona-se sem provocar ataques de oportunidade.',
    cost: 'Ação Bônus · Consome 1 nível de Empolgação.',
    trigger: 'No seu turno, antes ou depois de atacar.',
    effect:
      'Move-se até metade do seu Deslocamento sem provocar Ataques de Oportunidade nesse movimento. ' +
      'Pode atravessar o espaço de inimigos do seu tamanho ou menores (sem terminar nele).',
    flavor: 'Um passo lateral preciso, um giro de quadril — você lê o campo e sai do alcance antes do golpe vir.',
  },
  'Comando': {
    short: 'Grita uma ordem tática que beneficia um aliado.',
    cost: 'Ação Livre (1×/turno) · Consome 1 nível de Empolgação.',
    trigger: 'Ao acertar um ataque, escolha 1 aliado a até 9m que possa ouvi-lo.',
    effect:
      'O aliado ganha, até o início do SEU próximo turno, UM destes (sua escolha): ' +
      '+2 em Ataque, +2 na CA, ou pode usar sua Reação para mover-se até metade do Deslocamento.',
    flavor: 'Você dita o ritmo do combate. Sua voz é mais afiada que a lâmina.',
  },
  'Desarme': {
    short: 'Tenta arrancar a arma do inimigo.',
    cost: 'Substitui um ataque · Consome 1 nível de Empolgação.',
    trigger: 'No lugar de um ataque do seu turno.',
    effect:
      'Faça uma rolagem de Ataque contra a CA do alvo. Se acertar, ele largue um item segurado à sua escolha ' +
      '(cai no espaço dele). Criaturas de tamanho maior que o seu têm vantagem em resistir.',
    flavor: 'Um golpe seco no pulso, uma alavancagem cirúrgica — a arma dele agora é problema dele.',
  },
  'Esquiva': {
    short: 'Reação defensiva: anula ou reduz um ataque recebido.',
    cost: 'Reação · Consome 1 nível de Empolgação.',
    trigger: 'Quando um inimigo declara um ataque corpo-a-corpo contra você.',
    effect:
      'Imponha desvantagem na rolagem do atacante. Se ainda assim acertar, reduza o dano em 1d6 + seu mod. de DES.',
    flavor: 'Você já viu esse golpe antes. O corpo se inclina sozinho.',
  },
  'Trabalho de Pés': {
    short: 'Movimento extra + bônus de CA até o próximo turno.',
    cost: 'Ação Bônus · Consome 1 nível de Empolgação.',
    trigger: 'No seu turno.',
    effect:
      'Ganha +2 de CA e +3m de Deslocamento até o início do seu próximo turno. ' +
      'Inimigos têm desvantagem em Ataques de Oportunidade contra você nesse intervalo.',
    flavor: 'Dança. Não há outro nome. Cada passo é uma provocação e um escudo.',
  },
};

// ===== Tabela de Empolgação ================================================

export type EmpolgacaoDie = { count: number; sides: number };
export type EmpolgacaoTable = Record<2 | 3 | 4 | 5, EmpolgacaoDie>;

/** Empolgação base — desbloqueada nível 1 (ativa Nv 2..5). */
export const EMPOLGACAO_BASE: EmpolgacaoTable = {
  2: { count: 1, sides: 4 },
  3: { count: 1, sides: 6 },
  4: { count: 2, sides: 4 },
  5: { count: 2, sides: 6 },
};

/** Empolgação Máxima — substitui base ao chegar no Nv 11. */
export const EMPOLGACAO_MAXIMA: EmpolgacaoTable = {
  2: { count: 2, sides: 4 },
  3: { count: 2, sides: 6 },
  4: { count: 2, sides: 8 },
  5: { count: 3, sides: 6 },
};

export function formatEmpolgacaoDie(d: EmpolgacaoDie): string {
  return `${d.count}d${d.sides}`;
}

// ===== Tabela de Ataque Desarmado ==========================================

/**
 * Ataque desarmado: 1d8 base. Lutador Superior (Nv20) ganha +1 dado → 2d8.
 * (O briefing menciona "ex.: de 2d12 vai para 3d12" como exemplo — a regra
 * é "+1 dado". Mantemos d8 como base e adicionamos 1 dado no Nv 20.)
 */
export function getUnarmedDamage(level: number): { count: number; sides: number } {
  const base = { count: 1, sides: 8 };
  if (level >= 20) return { count: base.count + 1, sides: base.sides };
  return base;
}

// ===== Bônus escalonados ===================================================

/** Reflexo Evasivo (Nv 2+): RD universal = floor(level / 2). */
export function getReflexoEvasivoRd(level: number): number {
  if (level < 2) return 0;
  return Math.floor(level / 2);
}

/** Implemento Marcial (Nv 4+): +2 / +3 (Nv 8) / +4 (Nv 12) / +5 (Nv 16) / +6 (Nv 20) */
export function getImplementoMarcialDcBonus(level: number): number {
  if (level < 4) return 0;
  if (level < 8) return 2;
  if (level < 12) return 3;
  if (level < 16) return 4;
  if (level < 20) return 5;
  return 6;
}

/** Gosto pela Luta (Nv 5+): bônus de Ataque (+2 → +6) */
export function getGostoAttackBonus(level: number): number {
  if (level < 5) return 0;
  if (level < 8) return 2;
  if (level < 12) return 3;
  if (level < 16) return 4;
  if (level < 20) return 5;
  return 6;
}

/** Gosto pela Luta (Nv 5+): bônus de Fortitude e Dano (+1 → +4) */
export function getGostoFortAndDamageBonus(level: number): number {
  if (level < 5) return 0;
  if (level < 9) return 1;
  if (level < 13) return 2;
  if (level < 17) return 3;
  return 4;
}

// ===== Builder de Passivas Injetadas =======================================

/** Marker estável colocado em todas as passivas geradas pelo motor de Lutador. */
export const LUTADOR_PASSIVE_TAG = '__lutador_auto__';

interface AutoPassive extends Passive {
  /** Marca interna para localizar/limpar passivas geradas. */
  source?: string;
}

function mkPassive(name: string, description: string, extras: Partial<Passive> = {}): AutoPassive {
  return {
    id: `lut-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    description,
    bonusHP: 0,
    bonusPE: 0,
    bonusESC: 0,
    bonusSlots: 0,
    bonusRD: 0,
    bonusCA: 0,
    bonusDC: 0,
    ...extras,
    source: LUTADOR_PASSIVE_TAG,
  };
}

/** Gera o array completo de passivas auto-injetadas para um Lutador no nível N. */
export function buildLutadorPassives(level: number): AutoPassive[] {
  const out: AutoPassive[] = [];

  // Nv 1 — Corpo Treinado + Empolgação
  out.push(mkPassive(
    'Corpo Treinado',
    'Pode usar FOR ou DES para ataques marciais e desarmados. Ataque desarmado base: ' +
      `${formatEmpolgacaoDie(getUnarmedDamage(level))}. Libera Ação Bônus "Ataque Desarmado".`,
  ));
  const empTable = level >= 11 ? EMPOLGACAO_MAXIMA : EMPOLGACAO_BASE;
  out.push(mkPassive(
    level >= 11 ? 'Empolgação Máxima' : 'Empolgação',
    `Ao acertar ataques, sobe o nível de Empolgação (1..5). Dado extra de dano: ` +
      `Nv2 ${formatEmpolgacaoDie(empTable[2])} · Nv3 ${formatEmpolgacaoDie(empTable[3])} · ` +
      `Nv4 ${formatEmpolgacaoDie(empTable[4])} · Nv5 ${formatEmpolgacaoDie(empTable[5])}.`,
  ));

  // Nv 2 — Reflexo Evasivo
  if (level >= 2) {
    const rd = getReflexoEvasivoRd(level);
    out.push(mkPassive(
      'Reflexo Evasivo',
      `Você adiciona +${rd} de Redução de Dano universal (floor(nível/2)).`,
      { bonusRD: rd },
    ));
  }

  // Nv 4 — Implemento Marcial
  if (level >= 4) {
    const dc = getImplementoMarcialDcBonus(level);
    out.push(mkPassive(
      'Implemento Marcial',
      `Sua CD de classe ganha +${dc} (escalona +2/+3/+4/+5/+6 por faixa).`,
      { bonusDC: dc },
    ));
  }

  // Nv 5 — Gosto pela Luta
  if (level >= 5) {
    const atk = getGostoAttackBonus(level);
    const fort = getGostoFortAndDamageBonus(level);
    out.push(mkPassive(
      'Gosto pela Luta',
      `+${atk} em Rolagens de Ataque · +${fort} em Fortitude e Dano (escalonam por faixa).`,
    ));
  }

  // Nv 11 — Empolgação Máxima já refletida acima (nome trocado).

  // Nv 20 — Lutador Superior
  if (level >= 20) {
    out.push(mkPassive(
      'Lutador Superior',
      `Ataque desarmado ganha +1 dado (${formatEmpolgacaoDie(getUnarmedDamage(level))}). ` +
        `A Empolgação inicia o combate em 2. Habilitado: "Ataque Desarmado" como Ação Livre (custo 2 PE).`,
    ));
  }

  return out;
}

// ===== Trackers (escolhas obrigatórias) ====================================

/** Cria todas as escolhas obrigatórias para a JANELA (oldLevel, newLevel]. */
export function buildLutadorTrackersForRange(
  oldLevel: number,
  newLevel: number,
): PendingLevelChoice[] {
  const out: PendingLevelChoice[] = [];
  for (let lv = oldLevel + 1; lv <= newLevel; lv++) {
    if (lv === 1) {
      out.push({
        id: `lut-init-maneuvers-${crypto.randomUUID()}`,
        level: 1,
        kind: 'lutador_initial_maneuvers' as any,
        label: 'Nv 1 (Lutador): Escolher 2 Manobras de Empolgação',
        resolved: false,
      });
    }
    if (lv === 6 || lv === 12 || lv === 18) {
      out.push({
        id: `lut-extra-maneuver-${lv}-${crypto.randomUUID()}`,
        level: lv,
        kind: 'lutador_extra_maneuver' as any,
        label: `Nv ${lv} (Lutador): Escolher +1 Manobra de Empolgação`,
        resolved: false,
      });
    }
    if (lv === 9) {
      out.push({
        id: `lut-save-mastery-${crypto.randomUUID()}`,
        level: 9,
        kind: 'lutador_save_mastery' as any,
        label: 'Nv 9 (Lutador): Promover Fortitude OU Reflexos para Mestre + 1 novo TR Treinado',
        resolved: false,
      });
    }
  }
  return out;
}

// ===== Integração: aplica TODA a progressão automática =====================

export interface LutadorProgressionResult {
  /** Patch parcial a aplicar no Character. */
  patch: Partial<Character>;
  /** Trackers novos da janela (oldLevel, newLevel]. */
  newTrackers: PendingLevelChoice[];
}

/**
 * Idempotente. Aceita qualquer Character; se não for Lutador, REMOVE os efeitos
 * automáticos do motor (para que mudar de spec limpe corretamente).
 *
 * Retorna o patch a mesclar via store + os trackers a empilhar.
 */
export function applyLutadorProgression(
  c: Character,
  newLevel: number,
  spec: Specialization,
  oldLevel: number,
): LutadorProgressionResult {
  // Limpa quaisquer passivas auto-geradas em rodadas anteriores.
  const cleanedPassives = (c.passives ?? []).filter(
    (p: any) => p?.source !== LUTADOR_PASSIVE_TAG,
  );

  if (c.characterClass !== 'Feiticeiro' || spec !== 'Lutador') {
    return {
      patch: {
        passives: cleanedPassives,
        empolgacaoLevel: undefined,
        empolgacaoStartLevel: undefined,
        empolgacaoDiceTable: undefined,
        unarmedDamage: undefined,
        damageReductionBonus: 0,
        classCdBonus: 0,
        attackRollBonus: 0,
        fortitudeAndDamageBonus: 0,
        lutadorManeuvers: undefined,
        unlocksFreeUnarmed: false,
      },
      newTrackers: [],
    };
  }

  const autoPassives = buildLutadorPassives(newLevel);
  const empTable = newLevel >= 11 ? EMPOLGACAO_MAXIMA : EMPOLGACAO_BASE;
  const startLevel = newLevel >= 20 ? 2 : 1;

  return {
    patch: {
      passives: [...cleanedPassives, ...(autoPassives as Passive[])],
      empolgacaoLevel: c.empolgacaoLevel ?? startLevel,
      empolgacaoStartLevel: startLevel,
      empolgacaoDiceTable: empTable,
      unarmedDamage: getUnarmedDamage(newLevel),
      damageReductionBonus: getReflexoEvasivoRd(newLevel),
      classCdBonus: getImplementoMarcialDcBonus(newLevel),
      attackRollBonus: getGostoAttackBonus(newLevel),
      fortitudeAndDamageBonus: getGostoFortAndDamageBonus(newLevel),
      lutadorManeuvers: c.lutadorManeuvers ?? [],
      unlocksFreeUnarmed: newLevel >= 20,
    },
    newTrackers: buildLutadorTrackersForRange(oldLevel, newLevel),
  };
}
