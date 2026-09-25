import { describe, it, expect } from 'vitest';
import { AURA_APTITUDES, validateCursedAptitudeCatalog, getAuraAptitudeById } from '../lib/auraAptitudes';

describe('Cursed Aptitudes Catalog', () => {
  it('passa pelo validador sem erros', () => {
    const errors = validateCursedAptitudeCatalog();
    if (errors.length > 0) {
      console.error('Erros do catálogo:\n' + errors.join('\n'));
    }
    expect(errors).toEqual([]);
  });

  it('todos os IDs são únicos', () => {
    const ids = AURA_APTITUDES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todos os upgradesId apontam para entradas existentes', () => {
    for (const apt of AURA_APTITUDES) {
      if (apt.upgradesId) {
        expect(getAuraAptitudeById(apt.upgradesId), `upgradesId ${apt.upgradesId} (em ${apt.id}) inexistente`).toBeDefined();
      }
    }
  });

  it('todos os requiresAptitudeIds apontam para entradas existentes', () => {
    for (const apt of AURA_APTITUDES) {
      const reqs = apt.prereqs?.requiresAptitudeIds ?? [];
      for (const reqId of reqs) {
        expect(getAuraAptitudeById(reqId), `requiresAptitudeIds ${reqId} (em ${apt.id}) inexistente`).toBeDefined();
      }
    }
  });

  it('cobertura mínima por família', () => {
    const families = AURA_APTITUDES.reduce<Record<string, number>>((acc, a) => {
      const f = (a as { family?: string }).family ?? 'AU';
      acc[f] = (acc[f] ?? 0) + 1;
      return acc;
    }, {});
    expect(families.AU ?? 0).toBeGreaterThan(0);
    expect(families.CL ?? 0).toBeGreaterThan(0);
    expect(families.BAR ?? 0).toBeGreaterThan(0);
    expect(families.DOM ?? 0).toBeGreaterThan(0);
    expect(families.ER ?? 0).toBeGreaterThan(0);
    expect(families.SPECIAL ?? 0).toBeGreaterThan(0);
  });
});
