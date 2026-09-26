import { describe, it, expect } from 'vitest';
import type { Character } from '@/types';
import {
  findNegacaoSupporter, getNegacaoMaxUses, getNegacaoUsesLeft, reduceNegacaoMessage,
  resolveNegacao, consumeCritNegated,
} from '@/lib/suporteNegacao';

const ab = (...ids: string[]) => ids.map((abilityId) => ({ abilityId, chosenAtLevel: 4 }));
const ch = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, name: id, level: 4, category: 'PLAYER', peCurrent: 20, chosenSpecAbilities: [], ...extra }) as unknown as Character;
const grid = { dpi: 50, metersPerCell: 1.5 } as never;
const ent = (cid: string, x: number) => ({ id: `e-${cid}`, characterId: cid, x, y: 0, w: 50, h: 50 });

describe('Negação Crítica', () => {
  const sup = ch('s', { chosenSpecAbilities: ab('sup-negacao-critica') });
  const ally = ch('a');
  const ents = (dx: number) => ({ es: ent('s', 0), ea: ent('a', dx) });

  it('usos = 1 + ⌊BT/2⌋ e desconta os gastos', () => {
    expect(getNegacaoMaxUses({ level: 4 })).toBe(2);
    expect(getNegacaoUsesLeft({ ...sup, negacaoCriticaUsed: 2 })).toBe(0);
  });

  it('acha Suporte a até 12 m, com PE, usos e visão', () => {
    const near = ents(50 * 7); // 8 casas de distância de borda ≈ 10,5 m
    const e = { s: near.es, a: near.ea } as never;
    expect(findNegacaoSupporter('a', [sup, ally], e, grid)?.id).toBe('s');
    const far = { s: ent('s', 0), a: ent('a', 50 * 10) } as never;
    expect(findNegacaoSupporter('a', [sup, ally], far, grid)).toBeNull();
    expect(findNegacaoSupporter('a', [{ ...sup, peCurrent: 2 }, ally], e, grid)).toBeNull();
    expect(findNegacaoSupporter('a', [{ ...sup, negacaoCriticaUsed: 2 }, ally], e, grid)).toBeNull();
    const cego = { ...sup, activeConditions: [{ id: 'x', conditionId: 'cego' }] } as unknown as Character;
    expect(findNegacaoSupporter('a', [cego, ally], e, grid)).toBeNull();
    expect(findNegacaoSupporter('s', [sup, ally], e, grid)).toBeNull(); // não nega a própria
  });

  it('mensagens entre telas', () => {
    const offer = { kind: 'offer', supporterId: 's', rollerId: 'a', requestId: 'r1', clientId: 'B' };
    expect(reduceNegacaoMessage(offer, 'A', () => true).type).toBe('open');
    expect(reduceNegacaoMessage(offer, 'A', () => false).type).toBe('ignore');
    expect(reduceNegacaoMessage(offer, 'B', () => true).type).toBe('ignore');
    expect(reduceNegacaoMessage({ kind: 'accept', requestId: 'r1', clientId: 'B' }, 'A', () => true).type).toBe('accept');
  });

  it('sem negação registrada, o crítico continua valendo', () => {
    resolveNegacao('inexistente', true);
    expect(consumeCritNegated('a')).toBe(false);
  });
});
