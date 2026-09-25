/**
 * Agregador de efeitos passivos derivados das Habilidades de Especialização
 * (foco inicial: Especialista em Técnica). Inspirado em `talentEffects.ts`:
 * NÃO muta o `Character` — devolve um delta numérico aplicado nos pontos
 * centrais (CD de classe, ataque mágico, PE máximo, defesa, iniciativa).
 *
 * Cobertura desta Fase 1 (7 IDs):
 *   • tec-reacao-rapida          → initiativeBonus += max(modINT, modSAB)
 *   • tec-reforco-amaldicoado    → classCdBonus    += (level >= 10 ? 2 : 1)
 *   • tec-feiticos-refinados     → classCdBonus    += floor(trainingBonus / 2)
 *   • tec-olhar-preciso          → spellAtkBonus   += 2 + floor((level-4)/4)   [mín 0]
 *   • tec-energia-inacabavel     → peMaxBonus      += floor(level / 2)
 *   • tec-movimentos-imprevisiveis → defenseBonus  += min(maxKeyMod, level)
 *   • tec-bastiao-interior       → savesAdvantage  vs Amedrontado/Desorientado/Enfeitiçado
 *
 * Pontos de integração:
 *   • `applyTecnicaProgression` (src/lib/tecnicaProgression.ts) soma
 *     `classCdBonus` / `spellAtkBonus` / `peMax` / `initiativeBonus` no patch
 *     final, propagando o delta a TODA recriação/level-up.
 *   • `computeDefenseBreakdown` (src/lib/defenseCalc.ts) soma `defenseBonus`.
 *   • Vantagem em TR é exposta como flag (consumida na Fase 3 — pipeline TR).
 */
import type { Character } from '@/types';
import { getTrainingBonusByLevel } from './levelEngine';
import { getSpecKeyMod } from './specKeyMod';

export interface SpecAbilityAggregate {
  initiativeBonus: number;
  classCdBonus: number;
  spellAtkBonus: number;
  peMaxBonus: number;
  defenseBonus: number;
  savesAdvantageVsConditions: string[]; // ids de condição
  notes: string[];
  // ===== Fase 2 — Estado vivo =====
  /** Slots máximos de Concentração (default 1; sobe a 2 com Mente Repartida). */
  maxConcentrationSlots: number;
  /** Slots máximos de Sustentados (default 1; 2 com Sust. Avançada; 3 com Sust. Mestre). */
  maxSustainedSpells: number;
  /** +1 variação de liberação universal (Versatilidade Ampliada). */
  bonusReleaseSlots: number;
  /** Pool dedicado a Aptidões aplicado no início da rodada (Mestre das Aptidões). */
  aptitudeOnlyTempPEPerRound: number;
  /**
   * Bônus em testes de Concentração (modelado como bônus no TR de Astúcia,
   * que é o atributo de Concentração no sistema). Vem de `tec-mente-placida`.
   */
  concentrationCheckBonus: number;
}

const EMPTY: SpecAbilityAggregate = Object.freeze({
  initiativeBonus: 0,
  classCdBonus: 0,
  spellAtkBonus: 0,
  peMaxBonus: 0,
  defenseBonus: 0,
  savesAdvantageVsConditions: [],
  notes: [],
  maxConcentrationSlots: 1,
  maxSustainedSpells: 1,
  bonusReleaseSlots: 0,
  aptitudeOnlyTempPEPerRound: 0,
  concentrationCheckBonus: 0,
}) as SpecAbilityAggregate;

function hasAbility(c: Pick<Character, 'chosenSpecAbilities'>, id: string): boolean {
  return (c.chosenSpecAbilities ?? []).some(a => a.abilityId === id);
}

export function aggregateSpecAbilityEffects(
  c: Pick<Character, 'chosenSpecAbilities' | 'attributes' | 'level' | 'keyAttribute'>,
): SpecAbilityAggregate {
  const chosen = c.chosenSpecAbilities ?? [];
  if (chosen.length === 0) {
    return {
      ...EMPTY,
      savesAdvantageVsConditions: [],
      notes: [],
    };
  }

  const out: SpecAbilityAggregate = {
    initiativeBonus: 0,
    classCdBonus: 0,
    spellAtkBonus: 0,
    peMaxBonus: 0,
    defenseBonus: 0,
    savesAdvantageVsConditions: [],
    notes: [],
    maxConcentrationSlots: 1,
    maxSustainedSpells: 1,
    bonusReleaseSlots: 0,
    aptitudeOnlyTempPEPerRound: 0,
    concentrationCheckBonus: 0,
  };
  const level = Math.max(1, c.level ?? 1);
  const trainingBonus = getTrainingBonusByLevel(level);
  const maxKeyMod = getSpecKeyMod(c);

  // tec-reacao-rapida — Iniciativa += Mod_Chave (INT ou SAB, o maior)
  if (hasAbility(c, 'tec-reacao-rapida')) {
    out.initiativeBonus += maxKeyMod;
    out.notes.push(`Reação Rápida: Iniciativa +${maxKeyMod}`);
  }

  // tec-reforco-amaldicoado — CD +1 (Nv<10) ou +2 (Nv>=10)
  if (hasAbility(c, 'tec-reforco-amaldicoado')) {
    const v = level >= 10 ? 2 : 1;
    out.classCdBonus += v;
    out.notes.push(`Reforço Amaldiçoado: CD +${v}`);
  }

  // tec-feiticos-refinados — CD += floor(TB/2)
  if (hasAbility(c, 'tec-feiticos-refinados')) {
    const v = Math.floor(trainingBonus / 2);
    if (v > 0) {
      out.classCdBonus += v;
      out.notes.push(`Feitiços Refinados: CD +${v} (⌊TB/2⌋)`);
    }
  }

  // tec-olhar-preciso — Ataque Mágico = 2 + floor((Nv-4)/4) (mín 0)
  if (hasAbility(c, 'tec-olhar-preciso')) {
    const v = Math.max(0, 2 + Math.floor((level - 4) / 4));
    out.spellAtkBonus += v;
    out.notes.push(`Olhar Preciso: Ataque Mágico +${v}`);
  }

  // tec-energia-inacabavel — PE máx += floor(Nv/2)
  if (hasAbility(c, 'tec-energia-inacabavel')) {
    const v = Math.floor(level / 2);
    out.peMaxBonus += v;
    out.notes.push(`Energia Inacabável: PE máx +${v}`);
  }

  // tec-movimentos-imprevisiveis — Defesa += min(Mod_Chave, Nv)
  if (hasAbility(c, 'tec-movimentos-imprevisiveis')) {
    const v = Math.max(0, Math.min(maxKeyMod, level));
    if (v > 0) {
      out.defenseBonus += v;
      out.notes.push(`Movimentos Imprevisíveis: Defesa +${v}`);
    }
  }

  // tec-bastiao-interior — Vantagem em TR vs Amedrontado/Desorientado/Enfeitiçado
  if (hasAbility(c, 'tec-bastiao-interior')) {
    out.savesAdvantageVsConditions.push('amedrontado', 'desorientado', 'enfeiticado');
    out.notes.push('Bastião Interior: Vantagem em TR vs Amedrontado/Desorientado/Enfeitiçado');
  }

  // ====== Fase 2 — Estado vivo ======
  // tec-mente-repartida (Tier 6) — Concentração máx = 2
  if (hasAbility(c, 'tec-mente-repartida')) {
    out.maxConcentrationSlots = Math.max(out.maxConcentrationSlots, 2);
    out.notes.push('Mente Repartida: Concentração máx = 2');
  }

  // tec-sustentacao-avancada (Tier 8) — Sustentados máx = 2
  if (hasAbility(c, 'tec-sustentacao-avancada')) {
    out.maxSustainedSpells = Math.max(out.maxSustainedSpells, 2);
    out.notes.push('Sustentação Avançada: Sustentados máx = 2');
  }

  // tec-sustentacao-mestre (Tier 16) — Sustentados máx = 3 (substitui anterior)
  if (hasAbility(c, 'tec-sustentacao-mestre')) {
    out.maxSustainedSpells = 3;
    out.notes.push('Sustentação Mestre: Sustentados máx = 3');
  }

  // tec-versatilidade-ampliada (Tier 12) — +1 variação de liberação universal
  if (hasAbility(c, 'tec-versatilidade-ampliada')) {
    out.bonusReleaseSlots += 1;
    out.notes.push('Versatilidade Ampliada: +1 variação de liberação por feitiço');
  }

  // tec-mestre-das-aptidoes (Tier 12) — Pool dedicado a Aptidões = ⌊TB/2⌋ por rodada
  if (hasAbility(c, 'tec-mestre-das-aptidoes')) {
    out.aptitudeOnlyTempPEPerRound = Math.floor(trainingBonus / 2);
    out.notes.push(`Mestre das Aptidões: PE-Apt/rodada = ${out.aptitudeOnlyTempPEPerRound}`);
  }

  // tec-mente-placida (Tier 2) — TR de Concentração mais fácil em Mod_Chave.
  // Modelado como bônus em rolagens de Astúcia (atributo de Concentração).
  if (hasAbility(c, 'tec-mente-placida')) {
    out.concentrationCheckBonus += maxKeyMod;
    out.notes.push(`Mente Plácida: TR de Concentração +${maxKeyMod} (Astúcia)`);
  }

  return out;
}
