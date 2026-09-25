/**
 * Testes para o engine SPECIAL — Domínio Simples (p. 193).
 */
import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import {
  calcularDominioSimples,
  aplicarDanoDominioSimples,
  dissiparDominioSimples,
  PE_DOMINIO_SIMPLES,
} from '@/lib/specialActivation';

function makeChar(overrides: Partial<Character> = {}): Character {
  return {
    id: 'test',
    name: 'Tester',
    level: 5,
    peCurrent: 50,
    peMax: 50,
    hpCurrent: 100,
    hpMax: 100,
    attributes: [],
    cursedAptitudes: { AU: 0, CL: 0, BAR: 2, DOM: 2, ER: 0 },
    ...overrides,
  } as unknown as Character;
}

describe('Domínio Simples — criação', () => {
  it('Ação Bônus: -5 PE; Raio = 1.5 + 1.5×DOM; Dur = BAR + 1', () => {
    const r = calcularDominioSimples(makeChar(), { gatilho: 'bonus' });
    expect(r.ok).toBe(true);
    expect(r.peSpent).toBe(PE_DOMINIO_SIMPLES);
    // DOM 2 → 1.5 + 3 = 4.5; BAR 2 → 3
    expect(r.details?.raio).toBe(4.5);
    expect(r.details?.dur).toBe(3);
    expect(r.omniFlagPatch?.dominio_simples_imune_acerto_garantido).toBe(1);
  });

  it('Reação a Expansão de Domínio funciona igual', () => {
    const r = calcularDominioSimples(makeChar(), { gatilho: 'reacao' });
    expect(r.ok).toBe(true);
    expect(r.logMessage).toMatch(/Reação/);
  });

  it('PE insuficiente bloqueia', () => {
    const r = calcularDominioSimples(makeChar({ peCurrent: 2 }), { gatilho: 'bonus' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/PE insuficiente/);
  });

  it('BAR 0 ainda dá Dur = 1 (BAR + 1)', () => {
    const r = calcularDominioSimples(
      makeChar({ cursedAptitudes: { AU: 0, CL: 0, BAR: 0, DOM: 1, ER: 0 } }),
      { gatilho: 'bonus' },
    );
    expect(r.details?.dur).toBe(1);
    expect(r.details?.raio).toBe(3);
  });
});

describe('Domínio Simples — dano à estrutura', () => {
  it('Falha de Concentração: -1 dur, raio encolhe 1.5m', () => {
    const c = makeChar({
      omniFlags: { dominio_simples_durabilidade: 3, dominio_simples_raio_m: 4.5, dominio_simples_imune_acerto_garantido: 1 },
    });
    const r = aplicarDanoDominioSimples(c, 'concentracao_falha');
    expect(r.ok).toBe(true);
    expect(r.omniFlagPatch?.dominio_simples_durabilidade).toBe(2);
    expect(r.omniFlagPatch?.dominio_simples_raio_m).toBe(3);
  });

  it('Acerto Garantido tick: -1 dur', () => {
    const c = makeChar({
      omniFlags: { dominio_simples_durabilidade: 2, dominio_simples_raio_m: 3 },
    });
    const r = aplicarDanoDominioSimples(c, 'acerto_garantido_tick');
    expect(r.omniFlagPatch?.dominio_simples_durabilidade).toBe(1);
    expect(r.omniFlagPatch?.dominio_simples_raio_m).toBe(1.5);
    expect(r.logMessage).toMatch(/Acerto Garantido/);
  });

  it('Quebra quando durabilidade chega a 0', () => {
    const c = makeChar({
      omniFlags: { dominio_simples_durabilidade: 1, dominio_simples_raio_m: 3 },
    });
    const r = aplicarDanoDominioSimples(c, 'concentracao_falha');
    expect(r.ok).toBe(true);
    expect(r.quebrou).toBe(true);
    expect(r.omniFlagPatch?.dominio_simples_durabilidade).toBe(0);
    expect(r.omniFlagPatch?.dominio_simples_imune_acerto_garantido).toBe(0);
    expect(r.logMessage).toMatch(/QUEBROU/);
  });

  it('Quebra quando raio chega a 0 mesmo com dur > 0', () => {
    const c = makeChar({
      omniFlags: { dominio_simples_durabilidade: 5, dominio_simples_raio_m: 1.5 },
    });
    const r = aplicarDanoDominioSimples(c, 'concentracao_falha');
    expect(r.quebrou).toBe(true);
  });

  it('Dano sem domínio ativo retorna erro', () => {
    const r = aplicarDanoDominioSimples(makeChar(), 'concentracao_falha');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/não está ativo/);
  });
});

describe('Domínio Simples — dissipar', () => {
  it('zera flags', () => {
    const c = makeChar({
      omniFlags: { dominio_simples_durabilidade: 3, dominio_simples_raio_m: 4.5 },
    });
    const r = dissiparDominioSimples(c);
    expect(r.ok).toBe(true);
    expect(r.omniFlagPatch?.dominio_simples_durabilidade).toBe(0);
    expect(r.omniFlagPatch?.dominio_simples_imune_acerto_garantido).toBe(0);
  });
  it('rejeita se não está ativo', () => {
    expect(dissiparDominioSimples(makeChar()).ok).toBe(false);
  });
});
