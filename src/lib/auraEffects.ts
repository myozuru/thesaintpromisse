/**
 * Agregador de efeitos passivos das APTIDÕES DE AURA (catálogo nomeado).
 *
 * Filosofia (mesma de `talentEffects.ts`):
 *   - Os campos base do Character NÃO são mutados.
 *   - Cada bônus é calculado a partir de `chosenAuraAptitudes` + `cursedAptitudes.AU`
 *     e SOMADO na renderização.
 *   - Adicionar/remover aptidão = recomputa = bônus aparece/some imediatamente.
 *   - Toda passiva carrega `breakdown[]` para tooltip de proveniência.
 *
 * Esta é a FASE 1 (passivas + escala numérica). Toggles (Aura Embaçada, Aura
 * Excessiva, Comandante…) e Reações (Anuladora, Absorção, Redirecionadora) são
 * acionados via `useCharacterStore.activateAuraAptitude` e adicionam buffs
 * temporários — não passam por aqui.
 *
 * Cobertura desta fase (somente efeitos PASSIVOS escaláveis em AU):
 *   - Aura Reforçada           → physicalRD += 2 × AU (DCO, DP, DI)
 *   - Aura Maciça              → CA += AU
 *   - Aura do Bastião          → áura aliados (anota raio + bônus para tooltip)
 *   - Aura Controlada          → Furtividade += floor(AU/2)
 *   - Aura de Contenção        → Atletismo (grapple) += floor(AU/2)
 *   - Aura Movediça            → terreno difícil em raio (anota)
 *   - Aura Elemental Reforçada → elementalRD[elemento] += AU + (Aura Reforçada se possuída)
 *   - Afinidade Ampliada       → bônus de dano elemental = 1 + AU (consultável)
 *
 * As consultas adicionais (`getAuraDamageBonus`, etc.) servem aos hooks de
 * combate FUTUROS — leem o agregador sem reimplementar regras.
 */
import type { Character, DamageType } from '@/types';
import { createDefaultCursedAptitudes, DAMAGE_TYPES } from '@/types';
import { getAuraAptitudeById } from './auraAptitudes';

export interface AuraBreakdownItem {
  aptitudeId: string;
  aptitudeName: string;
  field: string;
  value: number | string;
}

export interface AggregatedAuraEffects {
  /** Bônus passivo de Defesa (CA) — Aura Maciça. */
  caBonus: number;
  /** RD adicional em DCO/DP/DI — Aura Reforçada. */
  physicalRDBonus: number;
  /** RD por tipo elemental — Aura Elemental Reforçada. */
  elementalRDByType: Partial<Record<DamageType, number>>;
  /** Bônus em Furtividade — Aura Controlada (passivo, ½ AU). */
  furtividadeBonus: number;
  /** Bônus em Atletismo p/ agarrar — Aura de Contenção (passivo, ½ AU). */
  grappleBonus: number;
  /** Aliados a 4,5m ganham Defesa = AU — Aura do Bastião (info). */
  bastiaoAuraBonus: number;
  /** Bônus de dano elemental por afinidade (consultar via getAuraDamageBonus). */
  afinidadeDamageBonus: number;
  /** Elemento escolhido (se houver) — para Afinidade Ampliada / Aura Elemental. */
  chosenElement?: DamageType;
  /** Raio do terreno difícil emanado — Aura Movediça. 0 se ausente. */
  difficultTerrainRadiusM: number;
  /** Aura Impenetrável ativa — resistência (½) contra DCO/DP/DI nesta rodada. */
  physicalResistanceActive: boolean;
  /** Casulo de Energia ativo — imunidade a DCO/DP/DI mundanos nesta rodada. */
  casuloActive: boolean;
  /** RD adicional contra DCO/DP/DI vindo de TÉCNICAS quando Casulo está ativo. */
  casuloTechniqueRD: number;
  /** Notas narrativas / tooltips. */
  notes: string[];
  breakdown: AuraBreakdownItem[];
}

function emptyAggregate(): AggregatedAuraEffects {
  return {
    caBonus: 0,
    physicalRDBonus: 0,
    elementalRDByType: {},
    furtividadeBonus: 0,
    grappleBonus: 0,
    bastiaoAuraBonus: 0,
    afinidadeDamageBonus: 0,
    difficultTerrainRadiusM: 0,
    physicalResistanceActive: false,
    casuloActive: false,
    casuloTechniqueRD: 0,
    notes: [],
    breakdown: [],
  };
}

/** Helper Fase 7 — true se há buff timed `aura_active:<id>` no personagem. */
function isAuraActiveBuff(c: Character, auraId: string): boolean {
  const id = `aura_active:${auraId}`;
  return (c.activeBuffs ?? []).some(b => b.id === id);
}


/**
 * Lê o elemento escolhido para Aura Elemental / Afinidade Ampliada.
 * Estrutura armazenada em `auraAptitudeUsage[`<id>:element`]` como string codificada.
 * Como ainda não há UI de escolha, retorna `undefined` se ausente.
 */
function readChosenElement(c: Character, aptId: string): DamageType | undefined {
  const usage = c.auraAptitudeUsage ?? {};
  const raw = (usage as unknown as Record<string, unknown>)[`${aptId}:element`];
  return typeof raw === 'string' ? (raw as DamageType) : undefined;
}

export function aggregateAuraEffects(c: Character): AggregatedAuraEffects {
  const out = emptyAggregate();
  const chosen = c.chosenAuraAptitudes ?? [];
  if (chosen.length === 0) return out;

  const apts = { ...createDefaultCursedAptitudes(), ...(c.cursedAptitudes ?? {}) };
  const AU = apts.AU;

  const has = (id: string) => chosen.includes(id);
  const push = (aptId: string, field: string, value: number | string) => {
    const apt = getAuraAptitudeById(aptId);
    out.breakdown.push({
      aptitudeId: aptId,
      aptitudeName: apt?.name ?? aptId,
      field,
      value,
    });
  };

  // ---- Aura Reforçada: RD físico = 2 × AU
  if (has('aura_reforcada')) {
    const v = 2 * AU;
    out.physicalRDBonus += v;
    push('aura_reforcada', 'RD físico (DCO/DP/DI)', `+${v}`);
  }

  // ---- Aura Maciça: CA += AU
  if (has('aura_macica')) {
    out.caBonus += AU;
    push('aura_macica', 'CA', `+${AU}`);
  }

  // ---- Aura do Bastião: aliados a 4,5m ganham +AU CA (informativo)
  if (has('aura_do_bastiao')) {
    out.bastiaoAuraBonus = AU;
    out.notes.push(`Aura do Bastião: aliados a 4,5m ganham +${AU} de Defesa.`);
    push('aura_do_bastiao', 'Aliados (4,5m) CA', `+${AU}`);
  }

  // ---- Aura Controlada: Furtividade += floor(AU/2)
  if (has('aura_controlada')) {
    const v = Math.floor(AU / 2);
    if (v > 0) {
      out.furtividadeBonus += v;
      push('aura_controlada', 'Furtividade', `+${v}`);
    }
  }

  // ---- Aura de Contenção: agarrar (Atletismo) += floor(AU/2)
  if (has('aura_de_contencao')) {
    const v = Math.floor(AU / 2);
    if (v > 0) {
      out.grappleBonus += v;
      push('aura_de_contencao', 'Atletismo (agarrar)', `+${v}`);
    }
  }

  // ---- Aura Movediça: raio escalonável de terreno difícil
  if (has('aura_movediça')) {
    let r = 0;
    if (AU >= 5) r = 6;
    else if (AU >= 4) r = 4.5;
    else if (AU >= 2) r = 3;
    else if (AU >= 1) r = 1.5;
    out.difficultTerrainRadiusM = r;
    if (r > 0) {
      out.notes.push(`Aura Movediça: terreno difícil em ${r} m ao redor.`);
      push('aura_movediça', 'Terreno difícil', `${r} m`);
    }
  }

  // ---- Afinidade Ampliada: bônus de dano elemental = 1 + AU
  if (has('afinidade_ampliada')) {
    const elem = readChosenElement(c, 'afinidade_ampliada');
    out.afinidadeDamageBonus = 1 + AU;
    if (elem) out.chosenElement = elem;
    push(
      'afinidade_ampliada',
      `Dano${elem ? ` (${elem})` : ' elemental'}`,
      `+${1 + AU}`,
    );
  }

  // ---- Aura Elemental Reforçada: RD elemental = AU + RD de Aura Reforçada (se possuída)
  if (has('aura_elemental_reforcada')) {
    const reforcadaRD = has('aura_reforcada') ? 2 * AU : 0;
    const total = AU + reforcadaRD;
    const elem =
      readChosenElement(c, 'aura_elemental') ??
      readChosenElement(c, 'afinidade_ampliada');
    if (elem && total > 0) {
      out.elementalRDByType[elem] = (out.elementalRDByType[elem] ?? 0) + total;
      push('aura_elemental_reforcada', `RD ${elem}`, `+${total}`);
    } else if (total > 0) {
      out.notes.push(
        `Aura Elemental Reforçada: +${total} RD ao elemento escolhido (defina o elemento de Aura Elemental).`,
      );
      push('aura_elemental_reforcada', 'RD elemental', `+${total} (?)`);
    }
  }

  // ───────── Fase 7 — Buffs ATIVOS com duração concreta ─────────
  // Aura Excessiva (2 PE): RD universal (exceto alma) = 2 × AU por 1 rodada.
  if (isAuraActiveBuff(c, 'aura_excessiva')) {
    const v = 2 * AU;
    if (v > 0) {
      // Todos os tipos exceto Alma (DAL).
      DAMAGE_TYPES.filter(t => t !== 'DAL').forEach(t => {
        out.elementalRDByType[t] = (out.elementalRDByType[t] ?? 0) + v;
      });
      push('aura_excessiva', 'RD universal (exceto alma)', `+${v}`);
      out.notes.push(`Aura Excessiva: +${v} RD a todos os tipos exceto alma (1 rodada).`);
    }
  }

  // Aura Impenetrável (3 PE): resistência a DCO/DP/DI = dano /2 por 1 rodada.
  // Implementação: somamos uma marca grande aos campos físicos e expomos via flag.
  if (isAuraActiveBuff(c, 'aura_impenetravel')) {
    out.physicalResistanceActive = true;
    out.notes.push('Aura Impenetrável: resistência (½) contra DCO/DP/DI por 1 rodada.');
    push('aura_impenetravel', 'Resistência física', '½ dano');
  }

  // Casulo de Energia (6 PE): imunidade a DCO/DP/DI MUNDANOS por 1 rodada;
  // se vier de técnica: RD adicional = 2 × AU.
  if (isAuraActiveBuff(c, 'casulo_de_energia')) {
    out.casuloActive = true;
    const techRD = 2 * AU;
    out.casuloTechniqueRD = techRD;
    out.notes.push(
      `Casulo de Energia: imune a DCO/DP/DI mundanos; RD +${techRD} contra técnicas (1 rodada).`,
    );
    push('casulo_de_energia', 'Imunidade física mundana', 'imune');
    if (techRD > 0) push('casulo_de_energia', 'RD físico vs técnica', `+${techRD}`);
  }

  return out;
}

/* ───────────────── Consultas para hooks de combate (futuros) ───────────────── */

/**
 * True se a aptidão está com seu toggle/buff sustentado ativo (criado por
 * `toggleAuraAptitude` no store). Convenção do id: `aura:<auraId>`.
 */
export function isAuraToggleActive(c: Character, auraId: string): boolean {
  const id = `aura:${auraId}`;
  return (c.activeBuffs ?? []).some(b => b.id === id);
}

/** Lista de IDs de aptidões de aura atualmente em estado TOGGLE ativo. */
export function getActiveAuraToggles(c: Character): string[] {
  return (c.activeBuffs ?? [])
    .filter(b => b.id?.startsWith('aura:'))
    .map(b => b.id.slice('aura:'.length));
}

/**
 * Bônus de dano de aura aplicável ao tipo de dano causado.
 * Usado por `onDamage(type)` no motor de combate.
 */
export function getAuraDamageBonus(c: Character, dmgType: DamageType): number {
  const e = aggregateAuraEffects(c);
  if (e.afinidadeDamageBonus > 0 && e.chosenElement === dmgType) {
    return e.afinidadeDamageBonus;
  }
  return 0;
}

/** RD adicional contra um tipo (aura física + elemental + buffs futuros). */
export function getAuraRDForType(c: Character, dmgType: DamageType): number {
  const e = aggregateAuraEffects(c);
  let rd = 0;
  if (dmgType === 'DCO' || dmgType === 'DP' || dmgType === 'DI') {
    rd += e.physicalRDBonus;
  }
  rd += e.elementalRDByType[dmgType] ?? 0;
  return rd;
}

/**
 * Resolve os dados extras concedidos pela Absorção Elemental armada.
 * Escala por AU: 1-2 → d6, 3-4 → d8, 5 → d10. X = AU.
 * Retorna `null` se não há absorção armada.
 */
export function getPendingAbsorbedDice(c: Character):
  | { count: number; sides: number; element: DamageType }
  | null {
  const p = c.pendingAbsorbedElement;
  if (!p || p.au <= 0) return null;
  const sides = p.au >= 5 ? 10 : p.au >= 3 ? 8 : 6;
  return { count: p.au, sides, element: p.element };
}

/* ───────────────── Fase 4 — Hooks de início de turno do INIMIGO ─────────────────
 *
 * Algumas auras (Lacerante, Macabra, Chamativa) disparam quando UM INIMIGO inicia
 * seu turno em um raio ao redor do personagem. Como não há tabuleiro, deixamos a
 * decisão de quem está em raio para o Mestre: o sistema apenas EMITE prompts
 * estruturados (texto + dados de TR) que aparecem no log a cada turno inimigo.
 *
 * Pré-condições para o disparo:
 *   - O PC tem a aptidão.
 *   - Para Lacerante: precisa ter sido ATIVADA por ação livre na rodada (buff
 *     `aura:aura_lacerante` presente; remainingTurns gerencia duração).
 *   - Para Macabra: passiva a 1,5m; expansão a 4,5m exige buff `aura:aura_macabra`.
 *   - Para Chamativa: passiva a 4,5m, sempre ativa se adquirida.
 */

export interface EnemyTurnAuraPrompt {
  auraId: string;
  auraName: string;
  ownerName: string;
  /** Raio em metros aplicável neste momento. */
  radiusM: number;
  /** Tipo de TR exigido. */
  saveType: 'Fortitude' | 'Vontade';
  /** Texto do efeito em falha. */
  onFailText: string;
  /** Categoria do efeito para UI (dano vs condição). */
  kind: 'damage' | 'condition';
}

export function getEnemyTurnAuraPrompts(c: Character): EnemyTurnAuraPrompt[] {
  const chosen = c.chosenAuraAptitudes ?? [];
  if (chosen.length === 0) return [];
  const AU = c.cursedAptitudes?.AU ?? 0;
  const out: EnemyTurnAuraPrompt[] = [];

  // Aura Lacerante — só se ativada (buff presente)
  if (chosen.includes('aura_lacerante') && isAuraToggleActive(c, 'aura_lacerante')) {
    const sides = AU >= 5 ? 10 : AU >= 3 ? 8 : 6;
    out.push({
      auraId: 'aura_lacerante',
      auraName: 'Aura Lacerante',
      ownerName: c.name,
      radiusM: 3,
      saveType: 'Fortitude',
      onFailText: `${AU}d${sides} de dano energético + mod do atributo principal de dano.`,
      kind: 'damage',
    });
  }

  // Aura Macabra — passiva a 1,5m; expandida a 4,5m se buff ativo
  if (chosen.includes('aura_macabra')) {
    const expanded = isAuraToggleActive(c, 'aura_macabra');
    const condition = AU >= 3 ? 'Amedrontado' : 'Abalado';
    out.push({
      auraId: 'aura_macabra',
      auraName: 'Aura Macabra',
      ownerName: c.name,
      radiusM: expanded ? 4.5 : 1.5,
      saveType: 'Vontade',
      onFailText: `Aplica ${condition} (refaz no próximo turno do alvo).`,
      kind: 'condition',
    });
  }

  // Aura Chamativa — passiva a 4,5m
  if (chosen.includes('aura_chamativa')) {
    out.push({
      auraId: 'aura_chamativa',
      auraName: 'Aura Chamativa',
      ownerName: c.name,
      radiusM: 4.5,
      saveType: 'Vontade',
      onFailText: 'Fica Enfeitiçado (refaz no próximo turno; cada falha dá +2 cumulativo p/ resistir).',
      kind: 'condition',
    });
  }

  return out;
}

/* ───────────────── Fase 10 — Motor de Crítico Dinâmico (Kokusen) ─────────────────
 *
 * Aptidão SPECIAL: special-raio-negro (base) + special-abencoado-faiscas-negras.
 * Regras:
 *   - Margem base = 20 (natural) ou 19 com 'Abençoado pelas Faíscas Negras'.
 *   - Stacks de Consciência Absoluta diminuem o threshold em 1 por stack.
 *   - Limite de reduções = floor(CL/2) (+1 fixo com as Faíscas Negras).
 */
export function hasAuraId(c: Character, id: string): boolean {
  return (c.chosenAuraAptitudes ?? c.chosenClAptitudes ?? []).includes(id)
    || (c.chosenClAptitudes ?? []).includes(id)
    || (c.chosenAuraAptitudes ?? []).includes(id);
}

export function hasKokusen(c: Character): boolean {
  return (c.chosenClAptitudes ?? []).includes('special-raio-negro')
    || (c.chosenAuraAptitudes ?? []).includes('special-raio-negro');
}

export function hasFaiscasNegras(c: Character): boolean {
  return (c.chosenClAptitudes ?? []).includes('special-abencoado-faiscas-negras')
    || (c.chosenAuraAptitudes ?? []).includes('special-abencoado-faiscas-negras');
}

export interface KokusenThreshold {
  baseCrit: number;
  maxReductions: number;
  stacks: number;
  threshold: number;
}

/**
 * Calcula o valor do d20 a partir do qual o ataque CaC vira Kokusen.
 * Retorna null se o personagem não tem a aptidão (motor inativo).
 */
export function getKokusenCritThreshold(c: Character): KokusenThreshold | null {
  if (!hasKokusen(c)) return null;
  const cl = c.cursedAptitudes?.CL ?? 0;
  const baseCrit = hasFaiscasNegras(c) ? 19 : 20;
  let maxReductions = Math.floor(cl / 2);
  if (hasFaiscasNegras(c)) maxReductions += 1;
  const stacks = c.kokusenStacks ?? 0;
  const reduction = Math.min(stacks, maxReductions);
  const threshold = Math.max(2, baseCrit - reduction);
  return { baseCrit, maxReductions, stacks, threshold };
}

/* ───────────────── Fase 10 — Motor da família ER (Energia Reversa) ─────────────────
 *
 * Lê dinamicamente as aptidões adquiridas e devolve a configuração corrente
 * da habilidade "Energia Reversa" base (dado, multiplicador do mod-chave,
 * limite de PER, atributo-chave, dados bônus por nível).
 */
export interface EnergiaReversaConfig {
  /** Lados do dado: 6 base, 8 com Cura Amplificada. */
  dieSize: 6 | 8;
  /** Multiplicador aplicado ao modificador de PRE/SAB. 1 base, 2 com Cura Amplificada. */
  modMultiplier: 1 | 2;
  /** Teto máximo de PER em uma única ativação. */
  peLimit: number;
  /** Atributo-chave selecionado (PRE > SAB se ambos disponíveis). */
  keyAttribute: 'Presença' | 'Sabedoria';
  /** Modificador-chave (já considerando o multiplier — devolvido cru aqui). */
  keyAttrMod: number;
  /** Dados bônus grátis pela escala de nível: +1d em 10, +2d em 15, +3d em 20. */
  bonusDiceFromLevel: number;
  /** True se possui Liberação de Energia Reversa (permite curar aliados). */
  hasLiberacao: boolean;
  /** True se possui Cura em Grupo (área 4,5m + 1,5m·ER). */
  hasCuraEmGrupo: boolean;
  /** True se possui Cura Amplificada (upgrade core). */
  hasCuraAmplificada: boolean;
  /** Raio em metros para Cura em Grupo. 0 se não possuir. */
  groupHealRadiusM: number;
}

export function hasEnergiaReversa(c: Character): boolean {
  return (c.chosenClAptitudes ?? []).includes('er-energia-reversa');
}

function getKeyAttrModForER(c: Character): { key: 'Presença' | 'Sabedoria'; mod: number } {
  const pre = (c.attributes ?? []).find(a => a.name === 'Presença');
  const sab = (c.attributes ?? []).find(a => a.name === 'Sabedoria');
  const preMod = pre ? Math.floor((pre.value - 10) / 2) : -5;
  const sabMod = sab ? Math.floor((sab.value - 10) / 2) : -5;
  if (preMod >= sabMod) return { key: 'Presença', mod: preMod };
  return { key: 'Sabedoria', mod: sabMod };
}

export function getEnergiaReversaConfig(c: Character): EnergiaReversaConfig | null {
  if (!hasEnergiaReversa(c)) return null;
  const er = c.cursedAptitudes?.ER ?? 0;
  const owned = new Set(c.chosenClAptitudes ?? []);
  const hasCuraAmplificada = owned.has('er-cura-amplificada');
  const hasLiberacao = owned.has('er-liberacao-energia-reversa');
  const hasCuraEmGrupo = owned.has('er-cura-em-grupo');
  // Limite base: 1 + floor(ER/2). Com Cura Amplificada: 1 + ER. Com Cura em Grupo: +2.
  let peLimit = hasCuraAmplificada ? 1 + er : 1 + Math.floor(er / 2);
  if (hasCuraEmGrupo) peLimit += 2;
  // Bônus de dados grátis pela escala de nível: +1 em 10, +1 em 15, +1 em 20.
  let bonusDiceFromLevel = 0;
  if (c.level >= 10) bonusDiceFromLevel += 1;
  if (c.level >= 15) bonusDiceFromLevel += 1;
  if (c.level >= 20) bonusDiceFromLevel += 1;
  const { key, mod } = getKeyAttrModForER(c);
  return {
    dieSize: hasCuraAmplificada ? 8 : 6,
    modMultiplier: hasCuraAmplificada ? 2 : 1,
    peLimit: Math.max(1, peLimit),
    keyAttribute: key,
    keyAttrMod: mod,
    bonusDiceFromLevel,
    hasLiberacao,
    hasCuraEmGrupo,
    hasCuraAmplificada,
    groupHealRadiusM: hasCuraEmGrupo ? 4.5 + 1.5 * er : 0,
  };
}
