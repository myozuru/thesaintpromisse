import { getDefensivoCA } from '@/lib/combateEstilos';
/**
 * defenseCalc — seletor central de Defesa (CA) usado por automações de
 * combate (alvo do AttackPanel, prompts de reação, simulações etc.).
 *
 * Cobre TODA a fórmula que o CharacterCard usa para exibir a CA efetiva:
 *
 *   CA base
 *   + mod DES
 *   + ½ nível
 *   + Σ Passivas ativas (p.bonusCA filtradas por isPassiveActive)
 *   + Σ Passivas Omni vinculadas (selectOmniPassiveBonuses)
 *   + Σ Itens em SLOT de acessório clássicos (slot ≠ 'nenhum' E presentes em
 *     `c.accessorySlots.colar/aneis/pulseiras`)
 *   + Σ Acessórios Omni equipados (selectOmniModifiers)
 *   + Σ Buffs ativos do tipo 'ca'
 *   + Aura Maciça etc. (aggregateAuraEffects)
 *   + Empunhadura Dupla (talentBonuses.dualWieldDefenseBonus, se dualWielding)
 *   + Modificadores de condições (genéricos + específicos por tipo de ataque)
 *
 * REATIVIDADE: a função é PURA e recebe os snapshots externos como parâmetros
 * (`items` clássicos, `omniInventory`, `omniEntidadesMap`,
 * `omniRuntimeEffects`). O componente que chama deve assinar essas stores via
 * hooks para garantir re-render quando mudarem. Não chame `useStore.getState()`
 * aqui dentro — isso quebra reatividade no React.
 *
 * COBERTURA (atualizada):
 *   ✓ Passivas/itens/buffs CA clássicos e Omni (slot accessory)
 *   ✓ Auras dinâmicas (Maciça, etc.)
 *   ✓ Empunhadura Dupla
 *   ✓ Condições do `c.activeConditions` (genéricas + direcionais CaC/Dist.)
 *   ✓ Condições aplicadas via Omni runtime (`useOmniRuntimeStore.efeitos` com
 *     `meta.condicao` apontando para o alvo) — mescladas e processadas pelo
 *     mesmo aggregateConditionMods.
 *
 * LIMITAÇÕES CONSCIENTES:
 *   • Buffs com `type` exótico (não 'ca') não somam aqui — só os tipados como
 *     'ca' contam. Buffs novos precisam estender o switch ou virar passivas.
 *   • RD por tipo NÃO é CA: continua sendo aplicada no `damageStep`, não aqui.
 */
import { posturaDefesa } from '@/lib/posturas';
import { guardaEstudadaDefesa } from '@/lib/guardaEstudada';
import type { Character, Item, Passive } from '@/types';
import { aggregateConditionMods } from '@/lib/conditionEffects';
import { aggregateAuraEffects } from '@/lib/auraEffects';
import { aggregateTalentBonuses } from '@/lib/talentEffects';
import { aggregateSpecAbilityEffects } from '@/lib/specAbilityEffects';
import { isPassiveActive } from '@/lib/spellRules';
import { getShieldById } from '@/lib/shields';
import {
  selectOmniModifiers,
  selectOmniPassiveBonuses,
} from '@/lib/omni/omniBridge';
import type { EntidadeOmni } from '@/lib/omni/tipos';

export type AttackKind = 'melee' | 'ranged' | 'cursed';

/** Forma mínima de uma instância de inventário Omni que esta lib precisa. */
export interface OmniInventoryInstance {
  instanceId: string;
  ownerId: string;
  isEquipped?: boolean;
  equippedSlot?: string | null;
  entity: EntidadeOmni;
}

/** Forma mínima de um efeito ativo do runtime Omni que esta lib precisa. */
export interface OmniRuntimeEffectLike {
  targetCharId?: string;
  meta?: Record<string, unknown>;
}

export interface DefenseInputs {
  /** Itens clássicos do `useItemStore`. */
  items?: Item[];
  /** Instâncias do `useInventoryStore.items` (Object.values). */
  omniInventory?: OmniInventoryInstance[];
  /** Mapa do `useOmniEntidadesStore.entidades`. */
  omniEntidadesMap?: Record<string, EntidadeOmni>;
  /**
   * Lista de efeitos ativos do `useOmniRuntimeStore.efeitos` (Object.values).
   * Apenas efeitos com `targetCharId === c.id` E `meta.condicao` (CondicaoId)
   * serão mesclados nas condições do alvo para fins de cálculo de Defesa.
   */
  omniRuntimeEffects?: OmniRuntimeEffectLike[];
}

export interface DefenseBreakdown {
  base: number;
  desMod: number;
  halfLevel: number;
  passivesCA: number;
  omniPassivesCA: number;
  itemsCA: number;
  omniItemsCA: number;
  buffsCA: number;
  auraCA: number;
  dualWieldCA: number;
  /** Defesa derivada de Habilidades de Especialização (Movimentos Imprevisíveis…). */
  specAbilityCA: number;
  /** Bônus de Defesa concedido pelo escudo equipado (sh-leve/pesado/torre). */
  shieldCA: number;
  conditionsCA: number;
  total: number;
  /** Notas de origem para tooltip ("Aura Maciça +3", "Coração de Aço +2"…). */
  notes: string[];
}

/**
 * Lê passivas Omni vinculadas (omniAtivos categorias passiva/talento/aura).
 * Espelha exatamente a regra do CharacterCard.
 */
function getOmniPassiveCA(
  c: Character,
  omniMap: Record<string, EntidadeOmni>,
): { value: number; notes: string[] } {
  const CATEGORIAS = new Set(['passiva', 'talento', 'aura']);
  const entidades = (c.omniAtivos ?? [])
    .filter((a) => CATEGORIAS.has(a.categoria))
    .map((a) => omniMap[a.entidadeId])
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  if (entidades.length === 0) return { value: 0, notes: [] };
  const bag = selectOmniPassiveBonuses(c, entidades);
  const notes = bag.origins.ca.map((o) => `${o.source} ${o.delta >= 0 ? '+' : ''}${o.delta}`);
  return { value: bag.totals.ca, notes };
}

/**
 * Lê acessórios Omni equipados (slot ≠ 'nenhum') a partir das instâncias
 * passadas (deve vir do useInventoryStore via hook). Espelha o CharacterCard.
 */
function getOmniEquippedCA(
  c: Character,
  omniInventory: OmniInventoryInstance[],
  omniMap: Record<string, EntidadeOmni>,
): { value: number; notes: string[] } {
  const equipped = omniInventory.filter(
    (inv) =>
      inv.ownerId === c.id &&
      inv.isEquipped &&
      inv.entity.slotType &&
      inv.entity.slotType !== 'nenhum',
  );
  if (equipped.length === 0) return { value: 0, notes: [] };
  const bag = selectOmniModifiers(c, equipped, omniMap);
  const notes = bag.origins.ca.map((o) => `${o.source} ${o.delta >= 0 ? '+' : ''}${o.delta}`);
  return { value: bag.totals.ca, notes };
}

/** Soma `bonusCA` apenas das passivas clássicas que estão ATIVAS no nível atual. */
function getPassivesCA(c: Character): { value: number; notes: string[] } {
  const passives: Passive[] = c.passives ?? [];
  const active = passives.filter((p) => isPassiveActive(p, c.level ?? 1));
  let total = 0;
  const notes: string[] = [];
  for (const p of active) {
    if (p.bonusCA) {
      total += p.bonusCA;
      notes.push(`${p.name} ${p.bonusCA >= 0 ? '+' : ''}${p.bonusCA}`);
    }
  }
  return { value: total, notes };
}

/**
 * Soma `bonusCA` SOMENTE de itens clássicos que estão **em slot de
 * acessório** do personagem (`accessorySlots.colar/aneis/pulseiras`).
 * Itens com bonusCA na mochila ou só assignedTo NÃO contam — espelha a
 * regra do CharacterCard (`bonusItems` filtrado por `slottedItemIds`).
 */
function getItemsCA(c: Character, items: Item[]): { value: number; notes: string[] } {
  const slots = c.accessorySlots;
  if (!slots) return { value: 0, notes: [] };
  const slottedIds = new Set<string>();
  if (slots.colar) slottedIds.add(slots.colar);
  (slots.aneis ?? []).forEach((id) => { if (id) slottedIds.add(id); });
  (slots.pulseiras ?? []).forEach((id) => { if (id) slottedIds.add(id); });
  if (slottedIds.size === 0) return { value: 0, notes: [] };

  const accessories = items.filter(
    (i) =>
      slottedIds.has(i.id) &&
      i.assignedTo?.includes(c.id) &&
      i.slotType &&
      i.slotType !== 'nenhum' &&
      (i.bonusCA ?? 0) !== 0,
  );
  const total = accessories.reduce((s, i) => s + (i.bonusCA ?? 0), 0);
  const notes = accessories.map((i) => `${i.name} ${(i.bonusCA ?? 0) >= 0 ? '+' : ''}${i.bonusCA}`);
  return { value: total, notes };
}

export function computeDefenseBreakdown(
  c: Character,
  inputs: DefenseInputs = {},
  attackKind: AttackKind = 'melee',
): DefenseBreakdown {
  const items = inputs.items ?? [];
  const omniInventory = inputs.omniInventory ?? [];
  const omniMap = inputs.omniEntidadesMap ?? {};
  const omniRuntimeEffects = inputs.omniRuntimeEffects ?? [];

  const desAttr = (c.attributes ?? []).find((a) => a.name?.toUpperCase() === 'DES');
  const desMod = desAttr ? Math.floor(((desAttr.value ?? 10) - 10) / 2) : 0;
  const halfLevel = Math.floor((c.level ?? 1) / 2);

  const passives = getPassivesCA(c);
  const omniPassives = getOmniPassiveCA(c, omniMap);
  const classicItems = getItemsCA(c, items);
  const omniItems = getOmniEquippedCA(c, omniInventory, omniMap);

  const buffsCA = (c.activeBuffs ?? [])
    .filter((b) => b.type === 'ca')
    .reduce((s, b) => s + (b.value ?? 0), 0);

  const aura = aggregateAuraEffects(c);
  const auraCA = aura.caBonus ?? 0;

  const talentBonuses = aggregateTalentBonuses(c);
  const dualWieldCA = c.dualWielding ? (talentBonuses.dualWieldDefenseBonus ?? 0) : 0;

  // Escudo equipado: +N na CA (defenseBonus do catálogo).
  const equippedShield = getShieldById(c.equippedShieldId);
  const shieldCA = equippedShield?.defenseBonus ?? 0;

  const specEff = aggregateSpecAbilityEffects(c);
  const specAbilityCA = specEff.defenseBonus + guardaEstudadaDefesa(c);

  // Mescla condições do char + condições aplicadas via Omni runtime no alvo.
  // Sintetiza um proxy de Character só com `activeConditions` aumentadas para
  // reaproveitar `aggregateConditionMods` sem duplicar regras.
  const runtimeCondIds = omniRuntimeEffects
    .filter((ef) => ef.targetCharId === c.id)
    .map((ef) => (ef.meta as { condicao?: string } | undefined)?.condicao)
    .filter((id): id is string => Boolean(id));
  const existingCondIds = new Set(
    (c.activeConditions ?? [])
      .map((cd) => (cd as { conditionId?: string }).conditionId)
      .filter(Boolean) as string[],
  );
  const extraConds = runtimeCondIds
    .filter((id) => !existingCondIds.has(id))
    .map((id) => ({ conditionId: id, appliedAt: 0 } as unknown as NonNullable<Character['activeConditions']>[number]));
  const charProxy: Character = extraConds.length > 0
    ? { ...c, activeConditions: [...(c.activeConditions ?? []), ...extraConds] }
    : c;

  const condMods = aggregateConditionMods(charProxy);
  let conditionsCA = condMods.defense ?? 0;
  if (attackKind === 'melee') conditionsCA += condMods.defenseMelee ?? 0;
  else if (attackKind === 'ranged') conditionsCA += condMods.defenseRanged ?? 0;

  // Apoio Defensivo (Suporte Nv 6): bônus temporário até o início do turno de quem apoiou.
  const apoioCA = c.apoioDefensivo?.value ?? 0;
  const guardaCA = c.guardaSincronizadaBonus?.value ?? 0;
  const defensivoCA = getDefensivoCA(c);
  // Artes do Combate: Distração Letal (penalidade no alvo) e Golpe Descendente (bônus próprio).
  const arteDistracaoCA = -(c.arteDefensePenalty?.amount ?? 0);
  const arteGolpeCA = c.arteGolpeDescendente?.amount ?? 0;

  const posturaCA = posturaDefesa(c as never);
  const base = c.ca ?? 10;
  const total =
    base +
    desMod +
    halfLevel +
    passives.value +
    omniPassives.value +
    classicItems.value +
    omniItems.value +
    buffsCA +
    auraCA +
    dualWieldCA +
    specAbilityCA +
    shieldCA +
    conditionsCA +
    apoioCA +
    guardaCA +
    defensivoCA +
    arteDistracaoCA +
    arteGolpeCA +
    posturaCA;

  const notes: string[] = [];
  notes.push(`CA base ${base}`);
  if (desMod) notes.push(`DES ${desMod >= 0 ? '+' : ''}${desMod}`);
  if (halfLevel) notes.push(`½ Nível +${halfLevel}`);
  if (posturaCA) notes.push(`Postura ${posturaCA > 0 ? '+' : ''}${posturaCA}`);
  notes.push(...passives.notes);
  notes.push(...omniPassives.notes);
  notes.push(...classicItems.notes);
  notes.push(...omniItems.notes);
  if (buffsCA) notes.push(`Buffs ${buffsCA >= 0 ? '+' : ''}${buffsCA}`);
  if (auraCA) notes.push(`Aura Maciça +${auraCA}`);
  if (dualWieldCA) notes.push(`Empunhadura Dupla ${dualWieldCA >= 0 ? '+' : ''}${dualWieldCA}`);
  if (specAbilityCA) notes.push(`Movimentos Imprevisíveis +${specAbilityCA}`);
  if (shieldCA && equippedShield) notes.push(`${equippedShield.name} +${shieldCA}`);
  if (conditionsCA) notes.push(`Condições ${conditionsCA >= 0 ? '+' : ''}${conditionsCA}`);
  if (apoioCA) notes.push(`Apoio Defensivo +${apoioCA}`);
  if (guardaCA) notes.push(`Guarda Sincronizada +${guardaCA}`);
  if (defensivoCA) notes.push(`Estilo Defensivo +${defensivoCA}`);
  if (arteDistracaoCA) notes.push(`Distração Letal ${arteDistracaoCA}`);
  if (arteGolpeCA) notes.push(`Golpe Descendente +${arteGolpeCA}`);

  return {
    base,
    desMod,
    halfLevel,
    passivesCA: passives.value,
    omniPassivesCA: omniPassives.value,
    itemsCA: classicItems.value,
    omniItemsCA: omniItems.value,
    buffsCA,
    auraCA,
    dualWieldCA,
    specAbilityCA,
    shieldCA,
    conditionsCA,
    total,
    notes,
  };
}

export function computeTotalDefense(
  c: Character,
  inputs: DefenseInputs = {},
  attackKind: AttackKind = 'melee',
): number {
  return computeDefenseBreakdown(c, inputs, attackKind).total;
}
