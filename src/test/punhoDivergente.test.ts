/**
 * Testes para o engine de Punho Divergente (CL, p. 181).
 * Fluxo de duas fases: armar (metade agora) → resolver (TR Fortitude do alvo).
 */
import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import {
  calcularPunhoDivergenteArmar,
  calcularPunhoDivergenteResolver,
} from '@/lib/clActivation';

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'test',
    name: 'Tester',
    level: 5,
    peCurrent: 50,
    peMax: 50,
    hpCurrent: 100,
    hpMax: 100,
    attributes: [
      { id: '1', name: 'Força', value: 14 },
      { id: '2', name: 'Destreza', value: 12 },
      { id: '3', name: 'Constituição', value: 16 }, // mod +3
      { id: '4', name: 'Inteligência', value: 10 },
      { id: '5', name: 'Sabedoria', value: 10 },
      { id: '6', name: 'Presença', value: 10 },
    ],
    cursedAptitudes: { AU: 0, CL: 3, BAR: 0, DOM: 0, ER: 0 },
    ...overrides,
  } as unknown as Character;
}

describe('Punho Divergente — armar', () => {
  it('20 dmg → 10 agora, 10 pendente, +2 CD (10/5)', () => {
    const r = calcularPunhoDivergenteArmar(makeChar(), { danoTotal: 20 });
    expect(r.ok).toBe(true);
    expect(r.omniFlagPatch?.punho_divergente_dano_pendente).toBe(10);
    // CD base: 8 + maestria(level 5) + CON mod (+3). cdBonus = floor(10/5) = 2.
    expect(r.details?.cdBonus).toBe(2);
    expect(r.details?.metadeAgora).toBe(10);
  });

  it('Dano ímpar (11) → 5 agora, 6 pendente (arredonda para cima na pendência)', () => {
    const r = calcularPunhoDivergenteArmar(makeChar(), { danoTotal: 11 });
    expect(r.details?.metadeAgora).toBe(5);
    expect(r.details?.resto).toBe(6);
    expect(r.details?.cdBonus).toBe(1); // floor(5/5)
  });

  it('Bloqueia se já há pendência', () => {
    const c = makeChar({ omniFlags: { punho_divergente_dano_pendente: 5, punho_divergente_cd: 14 } });
    const r = calcularPunhoDivergenteArmar(c, { danoTotal: 10 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/pendente/);
  });

  it('Rejeita dano ≤ 0', () => {
    expect(calcularPunhoDivergenteArmar(makeChar(), { danoTotal: 0 }).ok).toBe(false);
    expect(calcularPunhoDivergenteArmar(makeChar(), { danoTotal: -5 }).ok).toBe(false);
  });
});

describe('Punho Divergente — resolver', () => {
  it('Falha → dano dobrado (vulnerabilidade) e limpa flags', () => {
    const c = makeChar({ omniFlags: { punho_divergente_dano_pendente: 10, punho_divergente_cd: 15 } });
    const r = calcularPunhoDivergenteResolver(c, { fortitudeAlvo: 0, rollFn: () => 1 });
    expect(r.ok).toBe(true);
    expect(r.details?.danoFinal).toBe(20);
    expect(r.details?.sucesso).toBe(0);
    expect(r.omniFlagPatch?.punho_divergente_dano_pendente).toBe(0);
  });

  it('Sucesso → dano normal', () => {
    const c = makeChar({ omniFlags: { punho_divergente_dano_pendente: 10, punho_divergente_cd: 15 } });
    const r = calcularPunhoDivergenteResolver(c, { fortitudeAlvo: 5, rollFn: () => 20 });
    expect(r.details?.danoFinal).toBe(10);
    expect(r.details?.sucesso).toBe(1);
  });

  it('Sem pendência → erro', () => {
    const r = calcularPunhoDivergenteResolver(makeChar(), { fortitudeAlvo: 0 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/pendente/);
  });

  it('Roll exato = CD conta como sucesso', () => {
    const c = makeChar({ omniFlags: { punho_divergente_dano_pendente: 8, punho_divergente_cd: 15 } });
    const r = calcularPunhoDivergenteResolver(c, { fortitudeAlvo: 5, rollFn: () => 10 }); // 10+5=15
    expect(r.details?.sucesso).toBe(1);
  });
});
