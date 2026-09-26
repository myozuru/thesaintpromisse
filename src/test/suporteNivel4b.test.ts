import { describe, it, expect } from 'vitest';
import type { Character } from '@/types';
import {
  buildInspirar, canInspirar, checkIntervencao, findInspiracaoFor, getGrauMaximo, getInspirarMaxAliados,
  getInspirarUsos, getIntervencaoCusto, inspiracaoExpirada, GRAU_CONDICAO,
} from '@/lib/suporteNivel4';
import { ALL_CONDITIONS } from '@/types';

const ab = (...ids: string[]) => ids.map((abilityId) => ({ abilityId, chosenAtLevel: 4 }));
const ch = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: id, level: 4, category: 'PLAYER', peCurrent: 20, keyAttribute: 'Presença',
     attributes: [{ name: 'Presença', value: 16 }], chosenSpecAbilities: [], ...extra }) as unknown as Character;

describe('Inspirar Aliados', () => {
  const sup = ch('s', { chosenSpecAbilities: ab('sup-inspirar-aliados') });
  it('limites: aliados = ⌊BT/2⌋, usos = mod', () => {
    expect(getInspirarMaxAliados({ level: 4 })).toBe(Math.floor(2 / 2));
    expect(getInspirarUsos(sup)).toBe(3);
  });
  it('valida PE, cena, quantidade e alvo', () => {
    expect(canInspirar(sup, ['a']).ok).toBe(true);
    expect(canInspirar(sup, []).ok).toBe(false);
    expect(canInspirar(sup, ['a', 'b', 'c', 'd', 'e']).ok).toBe(false);
    expect(canInspirar(sup, ['s']).ok).toBe(false);
    expect(canInspirar({ ...sup, inspirarUsadoCena: true }, ['a']).ok).toBe(false);
    expect(canInspirar({ ...sup, peCurrent: 0 }, ['a']).ok).toBe(false);
  });
  it('gasta 1 PE, marca a cena e dura 10 min no relógio', () => {
    const p = buildInspirar(sup, ['a'], 1000);
    expect(p.peCurrent).toBe(19);
    expect(p.inspirarUsadoCena).toBe(true);
    expect(p.inspiracao).toEqual({ allyIds: ['a'], usesLeft: 3, expiresAt: 1600 });
    const s2 = { ...sup, ...p } as Character;
    expect(findInspiracaoFor('a', [s2], 1500)?.id).toBe('s');
    expect(findInspiracaoFor('b', [s2], 1500)).toBeNull();
    expect(findInspiracaoFor('a', [s2], 1600)).toBeNull();
    expect(inspiracaoExpirada(s2, 1600)).toBe(true);
    expect(inspiracaoExpirada({ inspiracao: { ...p.inspiracao!, usesLeft: 0 } }, 1000)).toBe(true);
  });
});

describe('Intervenção', () => {
  const sup = (level: number, pe = 30) => ch('s', { level, peCurrent: pe, chosenSpecAbilities: ab('sup-intervencao') });
  it('toda condição do sistema tem grau', () => {
    for (const c of ALL_CONDITIONS) expect(GRAU_CONDICAO[c.id], c.id).toBeDefined();
  });
  it('grau máximo por nível e custo', () => {
    expect([4, 6, 12, 18].map(getGrauMaximo)).toEqual(['fraca', 'media', 'forte', 'extrema']);
    expect(['fraca', 'media', 'forte', 'extrema'].map((g) => getIntervencaoCusto(g as never))).toEqual([3, 6, 9, 12]);
  });
  it('respeita nível, PE, especiais e variável', () => {
    expect(checkIntervencao(sup(4), 'abalado')).toMatchObject({ ok: true, custo: 3 });
    expect(checkIntervencao(sup(4), 'envenenado').ok).toBe(false);
    expect(checkIntervencao(sup(6), 'envenenado')).toMatchObject({ ok: true, custo: 6 });
    expect(checkIntervencao(sup(12), 'cego')).toMatchObject({ ok: true, custo: 9 });
    expect(checkIntervencao(sup(12), 'atordoado').ok).toBe(false);
    expect(checkIntervencao(sup(15), 'indefeso').ok).toBe(false);
    expect(checkIntervencao(sup(6), 'sangramento').ok).toBe(false);
    expect(checkIntervencao(sup(6), 'sangramento', 'media')).toMatchObject({ ok: true, custo: 6 });
    expect(checkIntervencao(sup(4, 2), 'abalado').ok).toBe(false);
  });
});
