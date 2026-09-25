/**
 * ============================================================================
 *  ORIGIN LEVEL ENGINE — aplica progressão por nível das ORIGENS
 * ============================================================================
 *  Responsabilidades (idempotentes para um (origin, clan, level)):
 *   • Gojo:  +1 PE máximo a cada nível PAR. +1 slot de feitiço em 1/5/10/15/20.
 *   • Kamo:  +1 PV máximo por nível. Nv 10: soma MOD CON adicional ao PV total.
 *   • Zenin: pendência de Feitiço Focado em 1/5/10/15/20.
 *   • Inumaki:    inumakiMax = trainingBonus (Maestria) por nível.
 *   • Restringido: restringidoResilMax = trainingBonus.
 *
 *  É chamado por:
 *   • applyLevelUp (subir de nível) — propaga deltas e abre trackers.
 *   • takeLongRest — recarrega usos diários (Inumaki/Restringido/Derivado/etc).
 *
 *  Mantém-se PURO. Recebe Character + newLevel, devolve { patch, newTrackers }.
 * ============================================================================
 */

import type { Character } from '@/types';
import { getMasteryBonus } from '@/types';
import type { PendingLevelChoice } from './levelEngine';

const ZENIN_FOCUSED_LEVELS = [1, 5, 10, 15, 20];
const GOJO_SLOT_LEVELS = [1, 5, 10, 15, 20];

export interface OriginLevelResult {
  /** Patch parcial aplicado em cima do char (somar/sobrescrever). */
  patch: Partial<Character>;
  /** Trackers a injetar em pendingLevelChoices. */
  newTrackers: PendingLevelChoice[];
  /** Notas para combatLog. */
  notes: string[];
}

/** MOD CON do char (para Kamo Nv 10). */
function getConMod(c: Character): number {
  const con = c.attributes?.find((a) => a.name === 'Constituição');
  return con ? Math.floor((con.value - 10) / 2) : 0;
}

/**
 * Aplica progressão de origem por LEVEL UP (oldLevel → newLevel).
 *
 * Apenas processa os marcos que foram CRUZADOS no salto (sem reaplicar
 * níveis anteriores).
 */
export function applyOriginLevelUp(
  c: Character,
  newLevel: number,
  oldLevel: number,
): OriginLevelResult {
  const patch: Partial<Character> = {};
  const newTrackers: PendingLevelChoice[] = [];
  const notes: string[] = [];

  // ── HERDADO (clãs) ────────────────────────────────────────────────────────
  if (c.origin === 'Herdado') {
    // Gojo: +1 PE em cada nível PAR cruzado; +1 slot em 1/5/10/15/20 cruzado.
    if (c.clanId === 'Gojo') {
      let pePlus = 0;
      let slotPlus = 0;
      for (let lv = oldLevel + 1; lv <= newLevel; lv++) {
        if (lv % 2 === 0) pePlus += 1;
        if (GOJO_SLOT_LEVELS.includes(lv)) slotPlus += 1;
      }
      if (pePlus > 0) {
        const newMax = (c.peMax ?? 0) + pePlus;
        patch.peMax = newMax;
        patch.peCurrent = Math.min((c.peCurrent ?? 0) + pePlus, newMax);
        notes.push(`Clã Gojo: +${pePlus} PE máximo (Potencial Lendário).`);
      }
      if (slotPlus > 0) {
        notes.push(`Clã Gojo: +${slotPlus} slot(s) de feitiço.`);
        // (Os slots em si são lidos via maxSpells helper; armazenamos a marca no log.)
      }
    }

    // Kamo: +1 PV por nível; Nv 10 cruzado → soma MOD CON adicional.
    if (c.clanId === 'Kamo') {
      let hpPlus = 0;
      for (let lv = oldLevel + 1; lv <= newLevel; lv++) hpPlus += 1;
      let kamo10Bonus = 0;
      if (oldLevel < 10 && newLevel >= 10) {
        kamo10Bonus = Math.max(0, getConMod(c));
      }
      const total = hpPlus + kamo10Bonus;
      if (total > 0) {
        const newMax = (c.hpMax ?? 0) + total;
        patch.hpMax = newMax;
        patch.hpCurrent = Math.min((c.hpCurrent ?? 0) + total, newMax);
        if (hpPlus) notes.push(`Clã Kamo: +${hpPlus} PV máximo (Valor do Sangue).`);
        if (kamo10Bonus) notes.push(`Clã Kamo (Nv 10): +${kamo10Bonus} PV (MOD CON adicional).`);
      }
    }

    // Zenin: pendência de "Feitiço Focado" para cada marco cruzado.
    if (c.clanId === 'Zenin') {
      for (let lv = oldLevel + 1; lv <= newLevel; lv++) {
        if (ZENIN_FOCUSED_LEVELS.includes(lv)) {
          newTrackers.push({
            id: `${lv}-zenin-focused-${crypto.randomUUID()}`,
            level: lv,
            kind: 'zenin_focused_spell' as PendingLevelChoice['kind'],
            label: `Nv ${lv} (Zenin): Marcar 1 Feitiço como FOCADO + escolher bônus`,
            resolved: false,
          });
        }
      }
    }
  }

  // ── INUMAKI ──────────────────────────────────────────────────────────────
  if (c.clanId === 'Inumaki') {
    const max = getMasteryBonus(newLevel);
    patch.inumakiMax = max;
    // No level-up: completa o pool até o novo máximo (não “rouba” usos atuais).
    patch.inumakiUses = Math.max(c.inumakiUses ?? max, max);
  }

  // ── RESTRINGIDO ──────────────────────────────────────────────────────────
  if (c.origin === 'Restringido') {
    const max = getMasteryBonus(newLevel);
    patch.restringidoResilMax = max;
    patch.restringidoResilUses = Math.max(c.restringidoResilUses ?? max, max);
  }

  return { patch, newTrackers, notes };
}

/**
 * Inicializa pools de origem na CRIAÇÃO da ficha (level inicial qualquer).
 * Usado pelo wizard quando salva o personagem.
 */
export function initOriginPools(c: Character): Partial<Character> {
  const patch: Partial<Character> = {};
  if (c.clanId === 'Inumaki') {
    const max = getMasteryBonus(c.level);
    patch.inumakiMax = max;
    patch.inumakiUses = max;
  }
  if (c.origin === 'Restringido') {
    const max = getMasteryBonus(c.level);
    patch.restringidoResilMax = max;
    patch.restringidoResilUses = max;
  }
  return patch;
}

/** Reset de Descanso Longo: Inumaki + Restringido (e pode ser estendido). */
export function resetOriginDailyPools(c: Character): Partial<Character> {
  const patch: Partial<Character> = {};
  if (c.clanId === 'Inumaki') {
    patch.inumakiUses = c.inumakiMax ?? getMasteryBonus(c.level);
  }
  if (c.origin === 'Restringido') {
    patch.restringidoResilUses = c.restringidoResilMax ?? getMasteryBonus(c.level);
  }
  return patch;
}

/** Cálculo do dano evitável da Resiliência Imediata: max(1, floor(level/2)) × 5. */
export function calcResilienciaReducao(level: number): number {
  return Math.max(1, Math.floor(level / 2)) * 5;
}
