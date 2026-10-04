/**
 * mapAoE — Helpers para Ataques em Área no Mapa.
 *
 * Converte forma/raio definidos em armas Omni e feitiços para o formato
 * do TemplateEngine (pixels), e identifica entidades (tokens) atingidos.
 */
import { type MapTemplate, type TemplateKind } from '@/components/mapa/TemplateEngine';
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
  const c = Math.cos(e.rotation ?? 0);
  const s = Math.sin(e.rotation ?? 0);
  return { x: e.x + lx * c - ly * s, y: e.y + lx * s + ly * c };
};

type Point = { x: number; y: number };
function distanceSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy || 1)));
  return Math.hypot(p.x-a.x-t*dx, p.y-a.y-t*dy);
}
function insidePolygon(p: Point, poly: Point[]) {
  let sign = 0;
  for (let i=0; i<poly.length; i++) {
    const a=poly[i], b=poly[(i+1)%poly.length];
    const cross=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
    if (Math.abs(cross)<1e-9) continue;
    if (sign && Math.sign(cross)!==sign) return false;
    sign=Math.sign(cross);
  }
  return true;
}
function polygonsTouch(a: Point[], b: Point[]) {
  for (const poly of [a,b]) for (let i=0;i<poly.length;i++) {
    const p=poly[i], q=poly[(i+1)%poly.length], nx=p.y-q.y, ny=q.x-p.x;
    const pa=a.map(v=>v.x*nx+v.y*ny), pb=b.map(v=>v.x*nx+v.y*ny);
    if (Math.max(...pa)<Math.min(...pb)-1e-9 || Math.max(...pb)<Math.min(...pa)-1e-9) return false;
  }
  return true;
}
function templateTouchesEntity(t: MapTemplate, e: Entity) {
  if (![t.x,t.y,t.rotation,t.length,e.x,e.y,e.w,e.h,e.rotation??0].every(Number.isFinite) || t.length<=0 || e.w<=0 || e.h<=0 || (t.kind==='line' && (!Number.isFinite(t.width)||t.width<=0))) return false;
  const hw=e.w/2, hh=e.h/2, c=Math.cos(e.rotation??0), s=Math.sin(e.rotation??0);
  const local=(p: Point)=>({x:(p.x-e.x)*c+(p.y-e.y)*s,y:-(p.x-e.x)*s+(p.y-e.y)*c});
  if (t.kind==='circle') {
    const p=local(t);
    if (e.shape!=='ELLIPSE') return Math.hypot(Math.max(0,Math.abs(p.x)-hw),Math.max(0,Math.abs(p.y)-hh))<=t.length+1e-9;
    if ((p.x/hw)**2+(p.y/hh)**2<=1) return true;
    // Closest point on the ellipse via its monotonic Lagrange multiplier.
    const f=(v:number)=>(hw*p.x/(v+hw*hw))**2+(hh*p.y/(v+hh*hh))**2;
    let lo=0, hi=Math.max(hw*Math.abs(p.x),hh*Math.abs(p.y),1);
    while(f(hi)>1) hi*=2;
    for(let i=0;i<80;i++) { const mid=(lo+hi)/2; if(f(mid)>1) lo=mid; else hi=mid; }
    return Math.hypot(p.x-hw*hw*p.x/(hi+hw*hw),p.y-hh*hh*p.y/(hi+hh*hh))<=t.length+1e-9;
  }
  const L=t.length, half=Math.atan(.5), off=t.kind==='cone'?-L/2:0;
  const points: Point[]=t.kind==='square'?[{x:-L,y:-L},{x:L,y:-L},{x:L,y:L},{x:-L,y:L}]
    :t.kind==='line'?[{x:0,y:-t.width/2},{x:L,y:-t.width/2},{x:L,y:t.width/2},{x:0,y:t.width/2}]
    :[{x:off,y:0},{x:off+L*Math.cos(half),y:-L*Math.sin(half)},{x:off+L*Math.cos(half),y:L*Math.sin(half)}];
  const tc=Math.cos(t.rotation), ts=Math.sin(t.rotation);
  const world=points.map(p=>({x:t.x+p.x*tc-p.y*ts,y:t.y+p.x*ts+p.y*tc}));
  if(e.shape==='ELLIPSE') {
    const poly=world.map(p=>{const q=local(p);return {x:q.x/hw,y:q.y/hh};});
    return insidePolygon({x:0,y:0},poly)||poly.some((p,i)=>distanceSegment({x:0,y:0},p,poly[(i+1)%poly.length])<=1+1e-9);
  }
  return polygonsTouch(world,[localToWorld(e,-hw,-hh),localToWorld(e,hw,-hh),localToWorld(e,hw,hh),localToWorld(e,-hw,hh)]);
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
  if (!Number.isFinite(sizeMeters) || sizeMeters <= 0) return null;

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
    if (templateTouchesEntity(template, e)) {
      out.push(e.id);
    }
  }
  return out;
}
