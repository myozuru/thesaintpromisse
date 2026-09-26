/**
 * mapAoE — Helpers para Ataques em Área no Mapa.
 *
 * Converte forma/raio definidos em armas Omni e feitiços para o formato
 * do TemplateEngine (pixels), e identifica entidades (tokens) atingidos.
 */
import { TemplateEngine, type MapTemplate, type TemplateKind } from '@/components/mapa/TemplateEngine';
import type { Entity } from '@/stores/useMapStore';
import type { EntidadeOmni } from '@/lib/omni/tipos';
import type { Spell } from '@/types';

/** Mapeia rótulos "Esfera/Cubo/Cone/Linha" para TemplateKind. */
const SHAPE_LABEL_TO_KIND: Record<string, TemplateKind> = {
  esfera: 'circle',
  círculo: 'circle',
  circulo: 'circle',
  cubo: 'square',
  quadrado: 'square',
  triângulo: 'cone_attached',
  triangulo: 'cone_attached',
  cone: 'cone_attached',
  'cone aderente': 'cone_attached',
  aderente: 'cone_attached',
  'cone livre': 'cone',
  linha: 'line',
  'linha aderente': 'line',
};

const localToWorld = (e: Entity, lx: number, ly: number) => {
  const c = Math.cos(e.rotation);
  const s = Math.sin(e.rotation);
  return { x: e.x + lx * c - ly * s, y: e.y + lx * s + ly * c };
};

function entitySamplePoints(e: Entity) {
  const hw = e.w / 2;
  const hh = e.h / 2;
  return [
    { x: e.x, y: e.y },
    localToWorld(e, -hw, -hh),
    localToWorld(e, hw, -hh),
    localToWorld(e, hw, hh),
    localToWorld(e, -hw, hh),
    localToWorld(e, 0, -hh),
    localToWorld(e, hw, 0),
    localToWorld(e, 0, hh),
    localToWorld(e, -hw, 0),
  ];
}

/**
 * Extrai forma/tamanho de um feitiço de Área.
 *
 * O construtor de feitiços (`SpellCreationAssistant`) codifica a área dentro
 * da `description` no formato:
 *   "Área: 🔴 Esfera (4.5m)"        // circle/square/cone
 *   "Área: ➖ Linha (12m x 1.5m)"   // line: comprimento × largura
 * Em linha o `range` também segue "Linha {len}m".
 */
export function getAoEFromSpell(spell: Spell | null | undefined): AoEDef | null {
  if (!spell || spell.targetMode !== 'area_tr') return null;
  const desc = String(spell.description ?? '');
  // 1) Tenta o bloco "Área: <emoji?> <shape> (<size>[ x <w>])".
  const m = desc.match(
    /Área:\s*(?:[^\sA-Za-zÀ-ÿ]+\s*)?([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)\s*\(([\d.,]+)\s*m(?:\s*[xX×]\s*([\d.,]+)\s*m)?\)/,
  );
  if (m) {
    const label = m[1].toLowerCase();
    const kind = SHAPE_LABEL_TO_KIND[label];
    const sizeMeters = parseFloat(m[2].replace(',', '.'));
    const widthMeters = m[3] ? parseFloat(m[3].replace(',', '.')) : undefined;
    if (kind && sizeMeters > 0) {
      return {
        kind,
        sizeMeters,
        widthMeters: kind === 'line' ? widthMeters ?? 1.5 : undefined,
      };
    }
  }
  // 2) Fallbacks: range "Triângulo 12m", "Cone 12m" ou "Linha 12m".
  const tri = String(spell.range ?? '').match(/(?:Triângulo|Triangulo|Cone)\s+([\d.,]+)\s*m/i);
  if (tri) {
    return { kind: 'cone_attached', sizeMeters: parseFloat(tri[1].replace(',', '.')) };
  }
  const r = String(spell.range ?? '').match(/Linha\s+([\d.,]+)\s*m/i);
  if (r) {
    return { kind: 'line', sizeMeters: parseFloat(r[1].replace(',', '.')), widthMeters: 1.5 };
  }
  return null;
}

export interface AoEDef {
  /** TemplateKind (sem 'single'/'aura' — aura é resolvida em sítio). */
  kind: TemplateKind;
  /** Raio (circle/square) ou comprimento (cone/line) em METROS. */
  sizeMeters: number;
  /** Largura (line) em METROS. Default 1.5m. */
  widthMeters?: number;
  /** Se true: posicionar automaticamente centrado no atacante (aura). */
  centeredOnSelf?: boolean;
}

/** Lê forma/tamanho de uma entidade Omni (arma ou aptidão). */
export function getAoEFromOmniEntity(ent: EntidadeOmni | null | undefined): AoEDef | null {
  const cd = ent?.combatData;
  if (!cd?.aoeShape || cd.aoeShape === 'single') return null;
  const sizeMeters = Number(cd.aoeSize) || 0;
  if (sizeMeters <= 0) return null;

  if (cd.aoeShape === 'aura') {
    return { kind: 'circle', sizeMeters, centeredOnSelf: true };
  }
  if (
    cd.aoeShape === 'circle' ||
    cd.aoeShape === 'square' ||
    cd.aoeShape === 'cone' ||
    cd.aoeShape === 'line'
  ) {
    const kind: TemplateKind = cd.aoeShape === 'cone' ? 'cone_attached' : (cd.aoeShape as TemplateKind);
    return {
      kind,
      sizeMeters,
      widthMeters: cd.aoeShape === 'line' ? 1.5 : undefined,
    };
  }
  return null;
}




/** Soma todos os bônus ativos de área (SpellBuff 'spellArea') de um conjurador. */
export function getActiveSpellAreaBonus(caster: { activeBuffs?: Array<{ type: string; value: number }> } | null | undefined): number {
  if (!caster?.activeBuffs) return 0;
  return caster.activeBuffs
    .filter((b) => b.type === 'spellArea')
    .reduce((s, b) => s + (Number(b.value) || 0), 0);
}

/** Soma todos os bônus ativos de alcance (SpellBuff 'spellRange') de um conjurador. */
export function getActiveSpellRangeBonus(caster: { activeBuffs?: Array<{ type: string; value: number }> } | null | undefined): number {
  if (!caster?.activeBuffs) return 0;
  return caster.activeBuffs
    .filter((b) => b.type === 'spellRange')
    .reduce((s, b) => s + (Number(b.value) || 0), 0);
}

/** Lista IDs de entidades (tokens) cuja área toca o template. */
export function findEntitiesInTemplate(
  template: MapTemplate,
  entities: Record<string, Entity>,
): string[] {
  const out: string[] = [];
  for (const e of Object.values(entities)) {
    if (e.hidden) continue;
    if ((e.layer ?? 'tokens') !== 'tokens') continue;
    if (entitySamplePoints(e).some((p) => TemplateEngine.hitTest(p, template))) {
      out.push(e.id);
    }
  }
  return out;
}
