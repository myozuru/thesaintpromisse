/**
 * Testes para a automação do talento Afinidade com Técnica.
 *
 * Regras (Cap. Talentos Gerais):
 *  - Imediatamente: +1 Feitiço (tracker tecnica_extra_spell).
 *  - Nos níveis 5/10/15/20: +1 Feitiço extra (tracker novo a cada marco).
 *  - Marcos passados ANTES da compra também são creditados na hora.
 *  - Marcos posteriores são gerados via level-up.
 */
import { describe, expect, it } from 'vitest';
import {
  buildAfinidadeTecnicaTrackers,
  AFINIDADE_TECNICA_MILESTONES,
} from '@/lib/levelEngine';

describe('buildAfinidadeTecnicaTrackers', () => {
  it('sem talento: nenhum tracker', () => {
    expect(buildAfinidadeTecnicaTrackers(1, 20, null)).toEqual([]);
  });

  it('comprado no Nv 1, sobe 1→6: gera marco do Nv 5', () => {
    const r = buildAfinidadeTecnicaTrackers(1, 6, 1);
    expect(r).toHaveLength(1);
    expect(r[0].level).toBe(5);
    expect(r[0].kind).toBe('tecnica_extra_spell');
  });

  it('comprado no Nv 1, sobe 4→11: gera marcos 5 e 10', () => {
    const r = buildAfinidadeTecnicaTrackers(4, 11, 1);
    expect(r.map((t) => t.level)).toEqual([5, 10]);
  });

  it('comprado no Nv 7, sobe 1→20: gera apenas 10/15/20 (não retroativo)', () => {
    const r = buildAfinidadeTecnicaTrackers(1, 20, 7);
    expect(r.map((t) => t.level)).toEqual([10, 15, 20]);
  });

  it('comprado no Nv 5, sobe 4→5: o marco do 5 SAI no level-up', () => {
    const r = buildAfinidadeTecnicaTrackers(4, 5, 5);
    expect(r.map((t) => t.level)).toEqual([5]);
  });

  it('marcos canônicos = 5/10/15/20', () => {
    expect([...AFINIDADE_TECNICA_MILESTONES]).toEqual([5, 10, 15, 20]);
  });

  it('sem novos marcos no intervalo: array vazio', () => {
    expect(buildAfinidadeTecnicaTrackers(11, 14, 1)).toEqual([]);
  });
});
