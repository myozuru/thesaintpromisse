/**
 * MOTOR DE PROGRESSÃO AUTOMÁTICA — ESPECIALISTA EM TÉCNICA
 *
 * Espelha a arquitetura do `lutadorProgression.ts`:
 *   - Idempotente: a cada chamada substitui as passivas/marcas geradas pelo
 *     motor (tag estável `TECNICA_PASSIVE_TAG`), de modo que mudar de spec
 *     limpe corretamente.
 *   - Devolve `patch` (mesclado pelo store) + `newTrackers` (apenas para a
 *     janela [oldLevel+1 .. newLevel] — não regera trackers de níveis antigos).
 *
 * Regras-chave (briefing do usuário):
 *   - Atributo-Chave (INT ou SAB): definido na criação. Soma 1× no PE máximo.
 *   - PV: motor do `levelEngine` já cuida (CON retroativo). Aqui só recalculamos
 *     quando preciso? Não — o PV não tem regra extra da Técnica além da global.
 *   - PE: 6 * Nível + Mod. do Atributo-Chave (calculado em `computeTecnicaPeMax`).
 *   - Nv 1: Domínio dos Fundamentos (escolher 2 mudanças, exceto Rápido) +
 *           Conjuração Aprimorada (passiva de dano extra por nível de feitiço).
 *           A partir do Nv 1 ganha 1 feitiço novo TODO nível (override do gate global).
 *   - Nv 4/7/11/15: 'Adiantar a Evolução' — libera Nv2/3/4/5 de feitiço.
 *   - Nv 6: desbloqueia Feitiço Rápido na lista de fundamentos.
 *   - Nv 9: Teste de Resistência Mestre (tracker reusa o do Lutador? Não — gera próprio).
 *   - Nv 10: Foco Amaldiçoado (Destruição/Economia/Refino).
 *   - Nv 12: +1 Mudança de Fundamento.
 *   - Nv 20: O Honrado — passiva de fim de jogo.
 */
import type { Character, Passive, Specialization, Attribute, SpellLevel, Spell } from '@/types';
import type { PendingLevelChoice } from '@/lib/levelEngine';
import { aggregateSpecAbilityEffects } from '@/lib/specAbilityEffects';

// ===== Foco Amaldiçoado — Helpers puros (PE / Dano / CD-Atk) =================

/**
 * Desconto de PE de Economia: -2 padrão. Nv 0 não desconta.
 * O piso é aplicado em `computeEffectivePeCost` (mín 0 só para Nv 1, mín 1 demais).
 */
export function getEconomiaPeDiscount(foco: TecnicaFoco | undefined, spellLevel: SpellLevel): number {
  if (foco !== 'Economia') return 0;
  if (spellLevel === 'Técnica Reversa') return 0;
  const n = parseInt(String(spellLevel), 10);
  if (!Number.isFinite(n)) {
    // 'Técnica Máxima' — trata como tier alto: aplica desconto.
    return 2;
  }
  if (n === 0) return 0;
  return 2;
}

/**
 * O Honrado (Nv 20): divide o custo final por 2 nos feitiços de Nv 1, 2, 3.
 * Demais níveis (incluindo Técnica Máxima/Reversa) → divisor 1.
 */
export function getHonradoPeDivisor(charLevel: number, spellLevel: SpellLevel): number {
  if (charLevel < 20) return 1;
  const n = parseInt(String(spellLevel), 10);
  if (n === 1 || n === 2 || n === 3) return 2;
  return 1;
}

/**
 * Custo efetivo de PE de um feitiço para um personagem.
 * Pipeline: base + Condenado(+1) − EconomiaDiscount → ceil(/HonradoDivisor).
 * Piso: Nv 1 pode chegar a 0; demais (≥2) mín 1; Nv 0 sempre 0.
 */
export function computeEffectivePeCost(c: Pick<Character, 'level' | 'characterClass' | 'specialization' | 'tecnicaFoco' | 'activeConditions'>, spell: Pick<Spell, 'spellLevel' | 'costPE'>): number {
  const isTec = c.characterClass === 'Feiticeiro' && c.specialization === 'Especialista em Técnica';
  const foco = isTec ? c.tecnicaFoco : undefined;
  const hasCondenado = (c.activeConditions ?? []).some((cd: any) => cd?.conditionId === 'condenado');
  const baseN = parseInt(String(spell.spellLevel), 10);
  if (baseN === 0) return 0;
  let cost = (spell.costPE ?? 0) + (hasCondenado ? 1 : 0);
  cost -= getEconomiaPeDiscount(foco, spell.spellLevel);
  // Piso pré-divisor.
  const floor = baseN === 1 ? 0 : 1;
  if (cost < floor) cost = floor;
  // O Honrado divide depois.
  const div = getHonradoPeDivisor(c.level || 1, spell.spellLevel);
  if (div > 1) cost = Math.ceil(cost / div);
  if (cost < floor) cost = floor;
  return cost;
}

/**
 * Destruição: +1 por dado rolado + Bônus de Treinamento como dano fixo.
 * Retorna {0,0} se foco diferente.
 */
export function getDestruicaoDamageBonus(foco: TecnicaFoco | undefined, level: number, diceRolledCount: number): { perDie: number; fixed: number } {
  if (foco !== 'Destruição') return { perDie: 0, fixed: 0 };
  return { perDie: 1 * Math.max(0, diceRolledCount), fixed: getTrainingBonusByLevel(level) };
}

/** Refino: +floor(TB/2) em CD de classe e em ataques amaldiçoados. */
export function getRefinoCdAndAtkBonus(foco: TecnicaFoco | undefined, level: number): number {
  if (foco !== 'Refino') return 0;
  return Math.floor(getTrainingBonusByLevel(level) / 2);
}

// ===== Conjuração Aprimorada — Motor de Dano ================================

/**
 * Bônus de dano fixo aplicado a feitiços conjurados por Especialista em Técnica.
 * Tabela exata (não escala fora do mapeamento abaixo):
 *   Nv 0 ............... 0
 *   Nv 1 ............... keyMod
 *   Nv 2 ............... keyMod
 *   Nv 3 ............... keyMod * 2
 *   Nv 4 ............... keyMod * 2 + characterLevel
 *   Nv 5 ............... keyMod * 2 + characterLevel * 2
 *   Técnica Máxima ..... keyMod * 3 + characterLevel * 3
 *   Técnica Reversa .... 0
 */
export function getConjuracaoAprimoradaBonus(
  spellLevel: SpellLevel,
  keyMod: number,
  characterLevel: number,
): number {
  if (spellLevel === 'Técnica Reversa') return 0;
  if (spellLevel === 'Técnica Máxima') return keyMod * 3 + characterLevel * 3;
  const n = parseInt(spellLevel, 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n === 1 || n === 2) return keyMod;
  if (n === 3) return keyMod * 2;
  if (n === 4) return keyMod * 2 + characterLevel;
  if (n === 5) return keyMod * 2 + characterLevel * 2;
  return 0;
}

// ===== Mudanças de Fundamento ===============================================

export const TECNICA_FUNDAMENTOS = [
  'Feitiço Cruel',
  'Feitiço Cuidadoso',
  'Feitiço Distante',
  'Feitiço Duplicado',
  'Feitiço Expansivo',
  'Feitiço Potente',
  'Feitiço Preciso',
  'Feitiço Rápido', // bloqueado até Nv 6
] as const;
export type TecnicaFundamento = typeof TECNICA_FUNDAMENTOS[number];

export const TECNICA_FUNDAMENTO_DETAILS: Record<TecnicaFundamento, {
  short: string;
  effect: string;
  unlockLevel: number;
}> = {
  'Feitiço Cruel': {
    short: 'Aumenta a CD do TR do feitiço gastando PE extra.',
    effect: 'Em feitiço com TR: gaste 1 PE → CD +2, ou 2 PE → CD +4.',
    unlockLevel: 1,
  },
  'Feitiço Cuidadoso': {
    short: 'Protege aliados de feitiços em área.',
    effect: 'Em feitiço em área: gaste PE igual ao Mod. INT/SAB para preservar 2× esse número de criaturas escolhidas.',
    unlockLevel: 1,
  },
  'Feitiço Distante': {
    short: 'Dobra o alcance (ou 9m se for corpo-a-corpo).',
    effect: 'Em feitiço a distância: gaste 2 PE para dobrar o alcance. Em feitiço CaC: gaste 2 PE para alcance de 9m.',
    unlockLevel: 1,
  },
  'Feitiço Duplicado': {
    short: 'Adiciona um segundo alvo a feitiço de dano de alvo único.',
    effect: '1×/rodada, em feitiço de dano com 1 alvo: gaste 2× o nível do feitiço em PE (mín 1 para Nv 0) para adicionar um segundo alvo.',
    unlockLevel: 1,
  },
  'Feitiço Expansivo': {
    short: 'Aumenta a área em 50% (×1,5).',
    effect: 'Em feitiço em área: gaste 3 PE para aumentar a área em metade do tamanho padrão (total ×1,5).',
    unlockLevel: 1,
  },
  'Feitiço Potente': {
    short: 'Re-rola dados de dano usando Mod. INT/SAB.',
    effect: 'Em feitiço de dano: gaste 3 PE e re-role dados de dano em quantidade igual ao seu Mod. INT/SAB, mantendo o melhor resultado.',
    unlockLevel: 1,
  },
  'Feitiço Preciso': {
    short: 'Bônus em rolagens de ataque do feitiço.',
    effect: 'Em feitiço com teste de ataque: gaste 1 PE → +2 acerto, ou 2 PE → +4 acerto.',
    unlockLevel: 1,
  },
  'Feitiço Rápido': {
    short: 'Reduz o custo de ação do feitiço (1×/rodada).',
    effect: '1×/rodada, em feitiço de Ação Completa ou Comum: gaste 2× o nível do feitiço em PE (mín 1 para Nv 0) para reduzir em 1 categoria (Completa→Comum, Comum→Bônus). Requer Nv 6.',
    unlockLevel: 6,
  },
};

// ===== Foco Amaldiçoado =====================================================

export const TECNICA_FOCOS = ['Destruição', 'Economia', 'Refino'] as const;
export type TecnicaFoco = typeof TECNICA_FOCOS[number];

export const TECNICA_FOCO_DETAILS: Record<TecnicaFoco, { short: string; effect: string }> = {
  'Destruição': {
    short: 'Especialista em maximizar dano.',
    effect: '+1 dano por dado rolado nos seus feitiços de dano. +Bônus de Treinamento no dano fixo.',
  },
  'Economia': {
    short: 'Conserva PE e amplia o pool máximo.',
    effect: 'Custo de PE de seus feitiços -2 (mín 1, exceto Nv 0). +Bônus de Treinamento no PE Máximo.',
  },
  'Refino': {
    short: 'Maior precisão e versatilidade.',
    effect: '+floor(Treinamento/2) nas CDs e Ataques Amaldiçoados. Ganha 1 Feitiço ou Aptidão Amaldiçoada bônus.',
  },
};

// ===== Atributo-Chave =======================================================

export type TecnicaKeyAttr = 'Inteligência' | 'Sabedoria';

export function getKeyAttrMod(attrs: Attribute[], keyName?: string): number {
  if (!keyName) return 0;
  const a = attrs.find(at => at.name === keyName);
  if (!a) return 0;
  return Math.floor((a.value - 10) / 2);
}

/** PE Máximo da Técnica = 6 * Nível + Mod. do Atributo-Chave. */
export function computeTecnicaPeMax(level: number, attrs: Attribute[], keyName?: string): number {
  const lv = Math.max(1, Math.min(20, level | 0));
  const keyMod = getKeyAttrMod(attrs, keyName);
  return Math.max(0, 6 * lv + keyMod);
}

// ===== Adiantar a Evolução: gate de feitiços ================================

/**
 * Nível MÁXIMO de feitiço acessível para um Especialista em Técnica.
 * Substitui o gate global apenas para esta especialização.
 *   Nv 1-3 → 1 · Nv 4-6 → 2 · Nv 7-10 → 3 · Nv 11-14 → 4 · Nv 15+ → 5
 */
export function getTecnicaMaxSpellLevel(level: number): number {
  const lv = Math.max(1, Math.min(20, level | 0));
  if (lv >= 15) return 5;
  if (lv >= 11) return 4;
  if (lv >= 7) return 3;
  if (lv >= 4) return 2;
  return 1;
}

// ===== Bônus escalonados ====================================================

export function getTrainingBonusByLevel(level: number): number {
  const lv = Math.max(1, Math.min(20, level | 0));
  if (lv <= 4) return 2;
  if (lv <= 8) return 3;
  if (lv <= 12) return 4;
  if (lv <= 16) return 5;
  return 6;
}

// ===== Builder de Passivas Injetadas ========================================

export const TECNICA_PASSIVE_TAG = '__tecnica_auto__';

interface AutoPassive extends Passive {
  source?: string;
}

function mkPassive(name: string, description: string, extras: Partial<Passive> = {}): AutoPassive {
  return {
    id: `tec-${name.toLowerCase().replace(/\s+/g, '-')}`,
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
    source: TECNICA_PASSIVE_TAG,
  };
}

export function buildTecnicaPassives(c: Pick<Character, 'attributes'>, level: number, keyName?: string, foco?: TecnicaFoco): AutoPassive[] {
  const out: AutoPassive[] = [];
  const tb = getTrainingBonusByLevel(level);

  // Nv 1 — Conjuração Aprimorada + Domínio dos Fundamentos
  const friendlyAttr: Record<string, string> = {
    'Força': 'Mod. FOR',
    'Destreza': 'Mod. DES',
    'Constituição': 'Mod. CON',
    'Inteligência': 'Mod. INT',
    'Sabedoria': 'Mod. SAB',
    'Presença': 'Mod. PRE',
  };
  const km = keyName ? (friendlyAttr[keyName] ?? `Mod. ${keyName}`) : 'Mod. do Atributo-Chave';
  out.push(mkPassive(
    'Conjuração Aprimorada',
    `Adiciona dano fixo aos seus feitiços, conforme o nível do feitiço (Nv 0 e Técnica Reversa NÃO recebem bônus): ` +
    `Nv 1: +${km} · Nv 2: +${km} · Nv 3: +${km}×2 · Nv 4: +${km}×2 + Nível · Nv 5: +${km}×2 + Nível×2 · Técnica Máxima: +${km}×3 + Nível×3.`,
  ));
  out.push(mkPassive(
    'Domínio dos Fundamentos',
    `Você conhece Mudanças de Fundamento que alteram seus feitiços. Escolha 2 no Nv 1 (Feitiço Rápido só a partir do Nv 6). +1 mudança no Nv 12.`,
  ));
  out.push(mkPassive(
    'Estudo Constante',
    `Você aprende 1 novo feitiço a cada nível alcançado (sobrepõe a regra global de "feitiço só em níveis pares").`,
  ));

  // Nv 4/7/11/15 — Adiantar a Evolução (cosmético: a lógica está no gate)
  if (level >= 4) {
    const max = getTecnicaMaxSpellLevel(level);
    out.push(mkPassive(
      'Adiantar a Evolução',
      `Você pode aprender e lançar feitiços de até Nv ${max} (a Técnica ignora o gate global do sistema).`,
    ));
  }

  // Nv 10 — Foco Amaldiçoado
  if (level >= 10 && foco) {
    const det = TECNICA_FOCO_DETAILS[foco];
    const extras: Partial<Passive> = {};
    if (foco === 'Destruição') {
      // Bônus no dano fixo (+TB) — exposto via passiva (não bate no engine matemático
      // automaticamente porque não temos campo "bônus de dano fixo passivo"; a UI
      // exibe e o jogador soma manualmente / lemos no card).
    }
    if (foco === 'Economia') {
      extras.bonusPE = tb;
    }
    if (foco === 'Refino') {
      // +1 slot de Feitiço/Aptidão permanente (soma aos slots disponíveis).
      extras.bonusSlots = 1;
    }
    out.push(mkPassive(
      `Foco Amaldiçoado: ${foco}`,
      `${det.short} ${det.effect}`,
      extras,
    ));
  }

  // Nv 20 — O Honrado
  if (level >= 20) {
    out.push(mkPassive(
      'O Honrado',
      `Custo de PE dos seus feitiços de Nv 1, 2 e 3 é dividido por 2 (arredondado para cima). +5 na CD de classe e +5 nas Rolagens de Ataque Amaldiçoadas.`,
      { bonusDC: 5 },
    ));
  }

  return out;
}

// ===== Trackers (escolhas obrigatórias) =====================================

export function buildTecnicaTrackersForRange(
  oldLevel: number,
  newLevel: number,
  hasFundamentos: boolean,
  hasFoco: boolean,
): PendingLevelChoice[] {
  const out: PendingLevelChoice[] = [];
  for (let lv = oldLevel + 1; lv <= newLevel; lv++) {
    if (lv === 1 && !hasFundamentos) {
      out.push({
        id: `tec-fund-init-${crypto.randomUUID()}`,
        level: 1,
        kind: 'tecnica_fundamentos_initial' as any,
        label: 'Nv 1 (Técnica): Escolher 2 Mudanças de Fundamento',
        resolved: false,
      });
    }
    // Feitiço novo TODO nível (override do gate global "só níveis pares").
    // Inclui Nv 1: o wizard adiciona o feitiço inicial, mas o tracker força a
    // escolha registrada para consistência com a regra "sem pular nenhum nível".
    out.push({
      id: `tec-spell-${lv}-${crypto.randomUUID()}`,
      level: lv,
      kind: 'tecnica_extra_spell' as any,
      label: `Nv ${lv} (Técnica): Aprender 1 novo Feitiço`,
      resolved: false,
    });
    // Catálogo de Aptidões — regra do Especialista em Técnica:
    // "Sempre que subir de nível, você recebe também uma aptidão amaldiçoada."
    // → 1 ponto em TODO nível (1..20) para escolher do catálogo (Aura/CL/BAR/DOM/ER).
    out.push({
      id: `tec-aptchoice-${lv}-${crypto.randomUUID()}`,
      level: lv,
      kind: 'pending_aptitude_choice',
      label: `Nv ${lv} (Técnica): Escolher 1 Aptidão Amaldiçoada do Catálogo`,
      resolved: false,
    });
    // Nv 9 — Teste de Resistência Mestre (Astúcia OU Vontade → Mestre + 1 TR Treinado)
    if (lv === 9) {
      out.push({
        id: `tec-save-mastery-${crypto.randomUUID()}`,
        level: 9,
        kind: 'tecnica_save_mastery' as any,
        label: 'Nv 9 (Técnica): Promover Astúcia OU Vontade a Mestre + 1 TR Treinado',
        resolved: false,
      });
    }
    if (lv === 10 && !hasFoco) {
      out.push({
        id: `tec-foco-${crypto.randomUUID()}`,
        level: 10,
        kind: 'tecnica_foco' as any,
        label: 'Nv 10 (Técnica): Escolher Foco Amaldiçoado (Destruição / Economia / Refino)',
        resolved: false,
      });
    }
    if (lv === 12) {
      out.push({
        id: `tec-fund-extra-${crypto.randomUUID()}`,
        level: 12,
        kind: 'tecnica_fundamentos_extra' as any,
        label: 'Nv 12 (Técnica): Escolher +1 Mudança de Fundamento',
        resolved: false,
      });
    }
  }
  return out;
}

// ===== Lock de Multiclasse ===================================================

/**
 * Especialista em Técnica só pode multiclasse (entrada/saída) se possuir
 * Inteligência E Sabedoria >= 16. Helper utilitário consultado pela UI.
 */
export function canMulticlassFromTecnica(attrs: Attribute[]): boolean {
  const get = (n: string) => attrs.find(a => a.name === n)?.value ?? 10;
  // Regra: Inteligência OU Sabedoria >= 16.
  return get('Inteligência') >= 16 || get('Sabedoria') >= 16;
}

/**
 * Suporte só pode multiclasse (entrada/saída) se possuir
 * Presença OU Sabedoria >= 16 (regra do livro).
 */
export function canMulticlassFromSuporte(attrs: Attribute[]): boolean {
  const get = (n: string) => attrs.find(a => a.name === n)?.value ?? 10;
  return get('Presença') >= 16 || get('Sabedoria') >= 16;
}

// ===== Integração: aplica TODA a progressão automática ======================

export interface TecnicaProgressionResult {
  patch: Partial<Character>;
  newTrackers: PendingLevelChoice[];
}

export function applyTecnicaProgression(
  c: Character,
  newLevel: number,
  spec: Specialization,
  oldLevel: number,
): TecnicaProgressionResult {
  // Limpa quaisquer passivas auto-geradas em rodadas anteriores.
  const cleanedPassives = (c.passives ?? []).filter(
    (p: any) => p?.source !== TECNICA_PASSIVE_TAG,
  );

  if (c.characterClass !== 'Feiticeiro' || spec !== 'Especialista em Técnica') {
    return {
      patch: {
        passives: cleanedPassives,
        // Não limpa keyAttribute — pode querer voltar.
        tecnicaFundamentos: undefined,
        tecnicaFoco: undefined,
      },
      newTrackers: [],
    };
  }

  const hasFundamentos = (c.tecnicaFundamentos ?? []).length >= 2;
  const hasFoco = !!c.tecnicaFoco;

  const autoPassives = buildTecnicaPassives(c, newLevel, c.keyAttribute, c.tecnicaFoco);

  // PE Máximo automático (6*Nv + KeyMod).
  const newPeMax = computeTecnicaPeMax(newLevel, c.attributes, c.keyAttribute);

  // O Honrado (Nv 20): bônus universal +5 em CD e em Spell Attack.
  const honradoBonus = newLevel >= 20 ? 5 : 0;
  // Refino: +floor(TB/2) em CD/Atk amaldiçoado.
  const refinoBonus = getRefinoCdAndAtkBonus(c.tecnicaFoco, newLevel);

  // Habilidades de Especialização passivas (Reforço Amaldiçoado, Feitiços
  // Refinados, Olhar Preciso, Energia Inacabável, Reação Rápida...) — agregador
  // puro que lê `chosenSpecAbilities` e devolve deltas. Reaplicado a cada
  // chamada do motor (criação, level-up, compra/remoção de habilidade).
  const specEff = aggregateSpecAbilityEffects({
    chosenSpecAbilities: c.chosenSpecAbilities,
    attributes: c.attributes ?? [],
    level: newLevel,
    keyAttribute: c.keyAttribute,
  });

  const totalCdBonus = honradoBonus + refinoBonus + specEff.classCdBonus;
  const totalSpellAtkBonus = honradoBonus + refinoBonus + specEff.spellAtkBonus;

  return {
    patch: {
      passives: [...cleanedPassives, ...(autoPassives as Passive[])],
      tecnicaFundamentos: c.tecnicaFundamentos ?? [],
      tecnicaFoco: c.tecnicaFoco,
      // PE Máximo é AUTO-CALCULADO pela Técnica (6*Nv + KeyMod) — sempre
      // sobrescreve qualquer valor anterior porque é regra de classe.
      // Energia Inacabável (+⌊Nv/2⌋) e outros bônus passivos somam por cima.
      peMax: newPeMax + specEff.peMaxBonus,
      classCdBonus: totalCdBonus,
      spellAttackBonus: totalSpellAtkBonus,
      // Iniciativa derivada (Reação Rápida etc.). Sobrescreve para garantir
      // idempotência — o agregador já acumula tudo o que vem das specs.
      initiativeBonus: (c.initiativeBonus ?? 0) - (c.specInitiativeBonusApplied ?? 0) + specEff.initiativeBonus,
      specInitiativeBonusApplied: specEff.initiativeBonus,
      // ===== Fase 2 — Estado vivo (passivos derivados) =====
      maxConcentrationSlots: specEff.maxConcentrationSlots,
      maxSustainedSpells: specEff.maxSustainedSpells,
      bonusReleaseSlots: specEff.bonusReleaseSlots,
    },
    newTrackers: buildTecnicaTrackersForRange(oldLevel, newLevel, hasFundamentos, hasFoco),
  };
}
