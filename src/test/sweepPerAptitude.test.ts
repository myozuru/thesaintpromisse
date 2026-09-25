/**
 * SWEEP por id — gera um bloco `describe` para CADA aptidão do catálogo.
 *
 * Para cada uma das 67 aptidões, valida individualmente:
 *  1. Presença e identidade no catálogo (id, name, family).
 *  2. Contrato mínimo (mechanic descrito; engineSupport != 'pending').
 *  3. Custo de PE coerente (`number` ou 'variable' com `peLimitFormula`).
 *  4. Gate de pré-requisitos:
 *     - falha em personagem "vazio" quando há prereqs;
 *     - aprova em personagem "máximo" que satisfaz tudo (level/AU/CL/BAR/DOM/ER 20,
 *       todos atributos 20, todas perícias treinadas+maestria, clãs satisfeitos,
 *       e todas as outras aptidões adquiridas).
 *  5. Coerência de upgrade (se `upgradesId` existir, aponta a entrada real).
 *
 * Estes testes são independentes dos engines de família (BAR/CL/DOM/ER/SPECIAL),
 * e fornecem rastreabilidade 1-para-1 com cada aptidão.
 */
import { describe, expect, it } from 'vitest';
import {
  AURA_APTITUDES,
  checkAuraGate,
  getAuraAptitudeById,
  resolveFixedPeCost,
} from '@/lib/auraAptitudes';

type Family = 'AU' | 'CL' | 'BAR' | 'DOM' | 'ER' | 'SPECIAL';

function familyOf(apt: typeof AURA_APTITUDES[number]): Family {
  return ((apt as { family?: Family }).family ?? 'AU') as Family;
}

/** Contexto "máximo" que satisfaz qualquer prereq concebível do catálogo. */
function maxContext(extra: { chosenAuraIds?: string[]; chosenAptitudeIds?: string[]; clanId?: string } = {}) {
  // Coleta TODAS as perícias mencionadas em qualquer prereq do catálogo.
  const allSkills = new Set<string>();
  const allClans = new Set<string>();
  for (const a of AURA_APTITUDES) {
    const p = a.prereqs ?? {};
    p.requiredSkillTrained?.forEach((s) => allSkills.add(s));
    p.requiredSkillMastery?.forEach((s) => allSkills.add(s));
    p.requiredClans?.forEach((c) => allClans.add(c));
  }
  return {
    level: 20,
    auLevel: 20,
    clLevel: 20,
    barLevel: 20,
    domLevel: 20,
    erLevel: 20,
    attrs: { FOR: 20, DES: 20, CON: 20, INT: 20, PRE: 20, SAB: 20 } as const,
    trainedSkills: Array.from(allSkills),
    masterySkills: Array.from(allSkills),
    chosenAuraIds: extra.chosenAuraIds ?? AURA_APTITUDES.map((a) => a.id),
    chosenAptitudeIds: extra.chosenAptitudeIds ?? AURA_APTITUDES.map((a) => a.id),
    clanId: extra.clanId ?? Array.from(allClans)[0] ?? 'kaisen',
  };
}

/** Contexto "vazio" — não satisfaz nada. */
function emptyContext() {
  return {
    level: 1,
    auLevel: 0,
    clLevel: 0,
    barLevel: 0,
    domLevel: 0,
    erLevel: 0,
    attrs: { FOR: 1, DES: 1, CON: 1, INT: 1, PRE: 1, SAB: 1 } as const,
    trainedSkills: [] as string[],
    masterySkills: [] as string[],
    chosenAuraIds: [] as string[],
    chosenAptitudeIds: [] as string[],
    clanId: undefined,
  };
}

function hasAnyPrereq(apt: typeof AURA_APTITUDES[number]): boolean {
  const p = apt.prereqs;
  if (!p) return false;
  return Boolean(
    p.minLevel || p.minAU || p.minCL || p.minBAR || p.minDOM || p.minER ||
    (p.attrMin && Object.keys(p.attrMin).length) ||
    (p.attrMinAny && Object.keys(p.attrMinAny).length) ||
    (p.requiresAuraIds && p.requiresAuraIds.length) ||
    (p.requiresAptitudeIds && p.requiresAptitudeIds.length) ||
    (p.requiredSkillTrained && p.requiredSkillTrained.length) ||
    (p.requiredSkillMastery && p.requiredSkillMastery.length) ||
    (p.requiredClans && p.requiredClans.length),
  );
}

describe('SWEEP — Aptidões individuais (1 describe por id)', () => {
  it(`tem 67 aptidões catalogadas (sanidade)`, () => {
    expect(AURA_APTITUDES.length).toBeGreaterThanOrEqual(67);
  });

  for (const apt of AURA_APTITUDES) {
    const fam = familyOf(apt);

    describe(`[${fam}] ${apt.id} — ${apt.name}`, () => {
      it('está acessível por getAuraAptitudeById', () => {
        const found = getAuraAptitudeById(apt.id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(apt.id);
      });

      it('declara mechanic não-vazio e engineSupport != "pending"', () => {
        expect(apt.name?.length ?? 0).toBeGreaterThan(0);
        expect(apt.mechanic?.length ?? 0).toBeGreaterThan(0);
        const eng = (apt as { engineSupport?: string }).engineSupport;
        // Default (ausente) é tratado como AU legado live; só rejeitamos 'pending' explícito.
        expect(eng).not.toBe('pending');
      });

      it('peCost coerente (numérico OU "variable" com peLimitFormula)', () => {
        const cost = (apt as { peCost?: number | 'variable' }).peCost;
        if (cost === 'variable') {
          const limit = (apt as { peLimitFormula?: string }).peLimitFormula;
          expect(limit, `${apt.id} usa peCost variável mas não declara peLimitFormula`).toBeTruthy();
        } else if (typeof cost === 'number') {
          expect(cost).toBeGreaterThanOrEqual(0);
          expect(resolveFixedPeCost(cost)).toBe(cost);
        }
        // Ausente é permitido (passive/trigger sem custo).
      });

      it('upgradesId (se houver) aponta para entrada existente', () => {
        const up = (apt as { upgradesId?: string }).upgradesId;
        if (up) expect(getAuraAptitudeById(up), `upgradesId ${up} inexistente`).toBeDefined();
      });

      it('gate APROVA em contexto "máximo"', () => {
        const r = checkAuraGate(apt, maxContext());
        expect(r.ok, `Reasons inesperados: ${r.reasons.join(' | ')}`).toBe(true);
      });

      it(hasAnyPrereq(apt) ? 'gate REPROVA em contexto "vazio"' : 'gate aprova em contexto vazio (sem prereqs)', () => {
        const r = checkAuraGate(apt, emptyContext());
        if (hasAnyPrereq(apt)) {
          expect(r.ok).toBe(false);
          expect(r.reasons.length).toBeGreaterThan(0);
        } else {
          expect(r.ok).toBe(true);
        }
      });
    });
  }
});
