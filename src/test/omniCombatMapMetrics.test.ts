import { beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import { lerCaminhoOmni, montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { avaliarFormula } from '@/lib/omni/parser';
import { useCombatStore } from '@/stores/useCombatStore';
import { useMapStore, type Entity } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';

const hero = {
  id: 'metrics-hero', name: 'Hero', level: 3, category: 'PLAYER',
  attributes: [], skills: [], savingThrows: [],
  hpCurrent: 17, hpMax: 30, peCurrent: 6, peMax: 12, ca: 14,
  customHitBonus: 7, escCurrent: 11, rd: 5,
  movement: 9, slotsCurrent: 2, slotsMax: 4,
} as unknown as Character;

beforeEach(() => {
  useCombatStore.setState({ inCombat: false, movementUsedByChar: {} });
  useMapStore.setState({ entities: {}, gridConfig: {
    ...useMapStore.getState().gridConfig, dpi: 70, metersPerCell: 1,
  } });
  useCharacterStore.setState({ characters: [hero] });
});

describe('Métricas configuradas da ficha', () => {
  it.each([
    ['acerto', 'stats.modificadorAtaque', 7],
    ['esquiva', 'stats.esquiva', 11],
    ['rd_curse', 'stats.resistenciaAmaldicoada', 5],
    ['resistencia', 'stats.resistenciaAmaldicoada', 5],
  ])('%s tem o mesmo valor no parser e nas referências', (key, legado, esperado) => {
    expect(lerCaminhoOmni(hero, key)).toBe(esperado);
    expect(lerCaminhoOmni(hero, legado)).toBe(esperado);
    for (const escopo of ['USUARIO', 'ALVO'] as const) {
      expect(avaliarFormula(`@${escopo}.${key}`, montarVariaveisDoPersonagem(hero, escopo)).valor).toBe(esperado);
    }
  });

  it('recalcula após editar os valores da ficha', () => {
    const editado = { ...hero, customHitBonus: 13, escCurrent: 4, rd: 8 };
    const bag = montarVariaveisDoPersonagem(editado);
    expect([bag.ACERTO, bag.ESQUIVA, bag.RESISTENCIA, bag.RD_CURSE]).toEqual([13, 4, 8, 8]);
  });
});

describe('Movimento restante', () => {
  it.each([
    [0, 9, 1], [3, 6, 1], [8.5, 0.5, 1], [9, 0, 0], [12, 0, 0],
  ])('após usar %s m, restam %s m', (usado, restante, disponivel) => {
    useCombatStore.setState({ inCombat: true, movementUsedByChar: { [hero.id]: usado } });
    const bag = montarVariaveisDoPersonagem(hero);
    expect(bag.MOVIMENTO_RESTANTE).toBe(restante);
    expect(bag.MOVIMENTO_DISPONIVEL).toBe(disponivel);
    expect(avaliarFormula('@USUARIO.movimento_restante', bag).valor).toBe(restante);
    expect(lerCaminhoOmni(hero, 'movimento_restante')).toBe(restante);
  });

  it('fora de combate ignora registros antigos; zerar o uso restaura o orçamento', () => {
    useCombatStore.setState({ inCombat: false, movementUsedByChar: { [hero.id]: 9 } });
    expect(montarVariaveisDoPersonagem(hero).MOVIMENTO_RESTANTE).toBe(9);
    useCombatStore.setState({ inCombat: true, movementUsedByChar: {} });
    expect(montarVariaveisDoPersonagem(hero).MOVIMENTO_RESTANTE).toBe(9);
  });

  it('usa o orçamento efetivo com Mobilidade Avançada e sobrecarga', () => {
    const c = { ...hero, slotsCurrent: 5,
      chosenSpecAbilities: [{ abilityId: 'sup-mobilidade-avancada', chosenAtLevel: 1 }],
    } as unknown as Character;
    useCombatStore.setState({ inCombat: true, movementUsedByChar: { [hero.id]: 2 } });
    // (9 + 3) / 2 = 6 m de orçamento; 2 m usados → 4 m restantes.
    expect(montarVariaveisDoPersonagem(c).MOVIMENTO_RESTANTE).toBe(4);
  });
});

function token(id: string, characterId: string, x: number, y: number, dpi: number): Entity {
  return { id, characterId, x, y, w: dpi, h: dpi, rotation: 0,
    shape: 'RECT', layer: 'tokens', color: '#fff', locked: false };
}

describe('Escala real do mapa', () => {
  it.each([70, 140])('converte pixels em metros com dpi=%s e reage à escala da grade', (dpi) => {
    const enemy = { ...hero, id: 'metrics-enemy', category: 'INIMIGO' } as Character;
    useCharacterStore.setState({ characters: [hero, enemy] });
    useMapStore.setState({ gridConfig: { ...useMapStore.getState().gridConfig, dpi, metersPerCell: 3 },
      entities: {
        self: token('self', hero.id, 2 * dpi, 3 * dpi, dpi),
        foe: token('foe', enemy.id, 5 * dpi, 3 * dpi, dpi),
      },
    });
    const bag = montarVariaveisDoPersonagem(hero);
    expect(avaliarFormula('@CENA.token_x', bag).valor).toBe(7.5);
    expect(avaliarFormula('@CENA.token_y', bag).valor).toBe(10.5);
    expect(bag.QTD_INIMIGOS_PROXIMOS).toBe(0); // 2.5 células × 3 = 7.5 m.
    useMapStore.getState().setGridConfig({ metersPerCell: 1 });
    const atualizado = montarVariaveisDoPersonagem(hero);
    expect(atualizado.CENA_TOKEN_X).toBe(2.5);
    expect(atualizado.QTD_INIMIGOS_PROXIMOS).toBe(1);
    expect(atualizado.QTD_INIMIGOS_ADJACENTES).toBe(0);
  });

  it('detecta inimigos adjacentes com tokens dimensionados em pixels', () => {
    const enemy = { ...hero, id: 'metrics-enemy', category: 'INIMIGO' } as Character;
    useCharacterStore.setState({ characters: [hero, enemy] });
    useMapStore.setState({ gridConfig: { ...useMapStore.getState().gridConfig, metersPerCell: 1.5 },
      entities: { self: token('self', hero.id, 0, 0, 70), foe: token('foe', enemy.id, 70, 0, 70) },
    });
    expect(montarVariaveisDoPersonagem(hero).QTD_INIMIGOS_ADJACENTES).toBe(1);
  });
});
