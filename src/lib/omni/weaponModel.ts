/**
 * Helper que converte uma arma do catálogo (`src/lib/weapons.ts`) em um
 * patch de `EntidadeOmni` pronto para o Construtor Omni.
 *
 * Usado pelo dropdown "Modelo Base" da aba Geral (categoria === 'arma').
 * Mantém a lógica em um único lugar para que o preset JSON do catálogo
 * de armas e o dropdown produzam entidades equivalentes.
 */
import type { Weapon, DamageType } from '@/lib/weapons';
import { ALL_WEAPONS, resolveWeaponDamage } from '@/lib/weapons';
import { canonicalizarChave } from './keyAliases';
import type { EntidadeOmni, CombatEffect } from './tipos';

const DAMAGE_TYPE_LABEL: Record<DamageType, string> = {
  Ct: 'Cortante',
  Pf: 'Perfurante',
  Im: 'Impacto',
};

const PROPERTY_LABEL: Record<string, string> = {
  ampla: 'Ampla', aparar: 'Aparar', apunhaladora: 'Apunhaladora',
  arremessavel: 'Arremessável', duas_maos: 'Duas Mãos', dupla: 'Dupla',
  emperrar: 'Emperrar', energica: 'Enérgica', especial: 'Especial',
  estendida: 'Estendida', fatal: 'Fatal', fineza: 'Fineza', leve: 'Leve',
  marcial: 'Marcial', modular: 'Modular', mortal: 'Mortal',
  oscilante: 'Oscilante', pesada: 'Pesada', recarga: 'Recarga',
  versatil: 'Versátil',
};

function formatProperty(p: Weapon['properties'][number]): string {
  const base = PROPERTY_LABEL[p.kind] ?? p.kind;
  if (p.kind === 'pesada' && p.value != null) return `${base} [${p.value}]`;
  if (p.kind === 'recarga' && p.value != null) return `${base} [${p.value}]`;
  if (p.kind === 'arremessavel' && p.rangeShort != null && p.rangeLong != null)
    return `${base} [${p.rangeShort}/${p.rangeLong}]`;
  if ((p.kind === 'fatal' || p.kind === 'mortal') && p.die != null)
    return `${base} d${p.die}`;
  if (p.kind === 'modular' && p.damageType)
    return `${base} ${p.damageType}`;
  return base;
}

export function describeWeapon(w: Weapon): string {
  const compl = w.category === 'simples' ? 'Simples' : 'Complexa';
  const alc = w.range === 'melee' ? 'Corpo-a-corpo'
    : w.range === 'ranged' ? 'Distância' : 'Arremessável';
  const dmg1 = resolveWeaponDamage(w, false);
  const dmg2 = w.damage2H ? resolveWeaponDamage(w, true) : null;
  const dmgLine = dmg1
    ? `Dano: ${dmg1}${dmg2 && dmg2 !== dmg1 ? ` (1M) / ${dmg2} (2M)` : ''}${w.damageType ? ` ${DAMAGE_TYPE_LABEL[w.damageType]}` : ''}`
    : 'Dano: especial (ver desarmado)';
  const crit = w.critRange ? `Margem de crítico: ${w.critRange}-20` : '';
  const alcDist = w.rangeShort && w.rangeLong ? `Alcance: ${w.rangeShort}/${w.rangeLong} m` : '';
  const props = w.properties.length
    ? `Propriedades: ${w.properties.map(formatProperty).join(', ')}`
    : '';
  const special = w.specialText ? `\n\n*${w.specialText}*` : '';
  return [
    `**${compl} • ${alc} • Grupo ${w.group}**`,
    dmgLine, crit, alcDist, `Espaços: ${w.spaces} • Custo: ${w.cost}`, props,
  ].filter(Boolean).join('\n') + special;
}

export function buildWeaponTags(w: Weapon): string[] {
  const range = w.range === 'melee' ? 'melee' : w.range === 'ranged' ? 'ranged' : 'thrown';
  // Empunhadura: 2 mãos se a arma exige (Duas Mãos), senão 1.
  // Versátil pode ser usada com 1 ou 2 mãos — default 1.
  const hands = w.properties.some((p) => p.kind === 'duas_maos') ? 2 : 1;
  const tags = [
    'arma', w.category, range,
    `grupo:${w.group.toLowerCase()}`,
    ...w.properties.map((p) => `prop:${p.kind}`),
    `modelo:${w.id}`,
    `espacos:${w.spaces}`,
    `mao:${hands}`,
  ];
  if (w.rangeShort != null && w.rangeLong != null) {
    tags.push(`alcance:${w.rangeShort}/${w.rangeLong}`);
  }
  return tags;
}

function buildCombatEffects(w: Weapon, formulaOverride?: string): CombatEffect[] {
  const formula = formulaOverride ?? resolveWeaponDamage(w, false) ?? '0';
  const damageType = w.damageType ? DAMAGE_TYPE_LABEL[w.damageType] : 'Verdadeiro';
  return [{
    id: crypto.randomUUID(),
    formula,
    type: 'SUBTRAIR',
    target: 'ALVO',
    damageType,
    resourcePath: 'vida_atual',
  }];
}

/** Dano-base declarado: não confunde cura, custo pessoal ou efeito de evento com o golpe. */
export function efeitoDanoDaArma(ent: EntidadeOmni): CombatEffect | undefined {
  const efeitos = ent.combatData?.effectsActive?.length ? ent.combatData.effectsActive : ent.combatData?.effects ?? [];
  return efeitos.find(e => e.type === 'SUBTRAIR' && e.target === 'ALVO' && !e.trigger && canonicalizarChave(e.resourcePath ?? 'vida') === 'vida');
}

/** Lê metadados de arma das tags da entidade Omni. */
export function getWeaponMeta(ent: EntidadeOmni): {
  modeloId: string | null;
  espacos: number | null;
  maos: 1 | 2 | null;
  alcanceCurto: number | null;
  alcanceLongo: number | null;
  dano: string | null;
} {
  const tags = ent.tags ?? [];
  const find = (prefix: string) =>
    tags.find((t) => t.startsWith(prefix))?.slice(prefix.length) ?? null;
  const espacosStr = find('espacos:');
  const maosStr = find('mao:');
  const alcanceStr = find('alcance:');
  const numero = (texto: string | undefined | null): number | null => {
    if (!texto?.trim()) return null;
    const n = Number(texto);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const [curto, longo] = alcanceStr ? alcanceStr.split('/').map(numero) : [null, null];
  const dano = efeitoDanoDaArma(ent)?.formula ?? null;
  return {
    modeloId: find('modelo:'),
    espacos: numero(espacosStr),
    maos: maosStr === '1' ? 1 : maosStr === '2' ? 2 : null,
    alcanceCurto: Number.isFinite(curto as number) ? (curto as number) : null,
    alcanceLongo: Number.isFinite(longo as number) ? (longo as number) : null,
    dano,
  };
}

/** Substitui (ou adiciona) uma tag prefixada na entidade. */
export function setPrefixedTag(ent: EntidadeOmni, prefix: string, value: string | null): EntidadeOmni {
  const filtered = (ent.tags ?? []).filter((t) => !t.startsWith(prefix));
  const next = value == null ? filtered : [...filtered, `${prefix}${value}`];
  return { ...ent, tags: next, atualizadoEm: Date.now() };
}

/**
 * Aplica um modelo de arma sobre uma entidade Omni existente, preservando
 * id/criadoEm e quaisquer ajustes que não façam parte do template (tags
 * customizadas, comércio, slots, etc. — no patch só campos relevantes).
 */
export function applyWeaponModel(base: EntidadeOmni, w: Weapon): EntidadeOmni {
  const effects = buildCombatEffects(w);
  // Preserva tags do usuário que não pertencem ao "modelo" anterior.
  const userTags = (base.tags ?? []).filter(
    (t) => !t.startsWith('grupo:') && !t.startsWith('prop:') && !t.startsWith('modelo:')
      && !t.startsWith('espacos:') && !t.startsWith('mao:') && !t.startsWith('alcance:')
      && t !== 'arma' && t !== 'simples' && t !== 'complexa'
      && t !== 'melee' && t !== 'ranged' && t !== 'thrown',
  );
  return {
    ...base,
    nome: w.name,
    descricao: describeWeapon(w),
    tags: Array.from(new Set([...userTags, ...buildWeaponTags(w)])),
    slotType: 'maos',
    combatData: {
      ...(base.combatData ?? {}),
      effects,
      effectsActive: effects,
      effectsPassive: [],
      critRange: w.critRange ?? 20,
      critMultiplier: base.combatData?.critMultiplier ?? 2,
      actionCost: base.combatData?.actionCost ?? 'action_standard',
      rangeType: w.range === 'melee' ? 'touch' : 'ranged',
      aoeShape: base.combatData?.aoeShape ?? 'single',
      aoeSize: w.rangeShort ?? base.combatData?.aoeSize,
    },
    atualizadoEm: Date.now(),
  };
}

/** Atualiza a fórmula de dano do efeito ativo principal. */
export function setWeaponDamage(ent: EntidadeOmni, formula: string): EntidadeOmni {
  const cd = ent.combatData;
  if (!cd) return ent;
  const patchEffects = (list?: CombatEffect[]) => {
    if (!list || list.length === 0) return list;
    const indice = list.findIndex(e => e.type === 'SUBTRAIR' && e.target === 'ALVO' && !e.trigger && canonicalizarChave(e.resourcePath ?? 'vida') === 'vida');
    if (indice < 0) return list;
    return list.map((e, i) => i === indice ? { ...e, formula } : e);
  };
  return {
    ...ent,
    combatData: {
      ...cd,
      effects: patchEffects(cd.effects) ?? cd.effects,
      effectsActive: patchEffects(cd.effectsActive) ?? cd.effectsActive,
    },
    atualizadoEm: Date.now(),
  };
}

export function listWeaponModels(): Weapon[] {
  return ALL_WEAPONS;
}
