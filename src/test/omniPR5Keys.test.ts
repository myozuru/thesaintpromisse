/**
 * PR-5 — Auditoria: Cena Tática (proximidade, aliados, inimigos).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { useMapStore } from '@/stores/useMapStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import type { Character } from '@/types';

const hero: Character = {
  id: 'hero-pr5',
  name: 'Hero',
  level: 3,
  trainingBonus: 2,
  hpCurrent: 20, hpMax: 20,
  peCurrent: 10, peMax: 10,
  ca: 10, movement: 9,
  category: 'PLAYER',
  attributes: [], skills: [], savingThrows: [],
} as unknown as Character;

const resolver = (c: Character, key: string) =>
  avaliarFormula(`@USUARIO.${key}`, montarVariaveisDoPersonagem(c)).valor;
const resolverCena = (c: Character, key: string) =>
  avaliarFormula(`@CENA.${key}`, montarVariaveisDoPersonagem(c)).valor;

function addEnt(id: string, x: number, y: number, characterId?: string) {
  useMapStore.setState((s) => ({
    entities: {
      ...s.entities,
      [id]: {
        id, shape: 'RECT', x, y, w: 1, h: 1, rotation: 0,
        color: '#fff', locked: false, layer: 'tokens', characterId,
      } as unknown as (typeof s.entities)[string],
    },
  }));
}

describe('PR-5 — Cena Tática', () => {
  beforeEach(() => {
    useMapStore.setState({ entities: {} });
    useCharacterStore.setState({ characters: [
      hero,
      { id: 'ally', name: 'Ally', category: 'PLAYER' } as unknown as Character,
      { id: 'enemy1', name: 'Foe', category: 'INIMIGO' } as unknown as Character,
      { id: 'enemy2', name: 'Foe2', category: 'INIMIGO' } as unknown as Character,
    ] } as never);
  });

  it('sem token → esta_no_mapa=0 e contadores zerados', () => {
    expect(resolver(hero, 'esta_no_mapa')).toBe(0);
    expect(resolver(hero, 'inimigo_adjacente')).toBe(0);
    expect(resolver(hero, 'sozinho')).toBe(1);
  });

  it('com aliado adjacente e inimigo a 5m → cálculos corretos', () => {
    // metersPerCell default = 1.
    addEnt('t-hero', 0, 0, 'hero-pr5');
    addEnt('t-ally', 1, 0, 'ally');     // adjacente
    addEnt('t-enemy', 5, 0, 'enemy1');  // próximo (~5m)
    expect(resolver(hero, 'esta_no_mapa')).toBe(1);
    expect(resolver(hero, 'aliado_adjacente')).toBe(1);
    expect(resolver(hero, 'qtd_aliados_adjacentes')).toBe(1);
    expect(resolver(hero, 'inimigo_adjacente')).toBe(0);
    expect(resolver(hero, 'qtd_inimigos_proximos')).toBe(1);
    expect(resolver(hero, 'sozinho')).toBe(0);
  });

  it('flanqueado quando ≥2 inimigos adjacentes', () => {
    addEnt('t-hero', 0, 0, 'hero-pr5');
    addEnt('t-e1', 1, 0, 'enemy1');
    addEnt('t-e2', 0, 1, 'enemy2');
    expect(resolver(hero, 'inimigo_adjacente')).toBe(1);
    expect(resolver(hero, 'qtd_inimigos_adjacentes')).toBe(2);
    expect(resolver(hero, 'flanqueado')).toBe(1);
    expect(resolver(hero, 'na_linha_de_frente')).toBe(1);
  });

  it('contadores de cena agregam tokens', () => {
    addEnt('t-hero', 0, 0, 'hero-pr5');
    addEnt('t-ally', 2, 2, 'ally');
    addEnt('t-e1', 4, 4, 'enemy1');
    expect(resolverCena(hero, 'qtd_tokens')).toBe(3);
    expect(resolverCena(hero, 'qtd_aliados')).toBe(2);
    expect(resolverCena(hero, 'qtd_inimigos')).toBe(1);
  });
});
