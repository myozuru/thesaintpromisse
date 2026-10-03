import { describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { avaliarFormula } from '@/lib/omni/parser';
const c = { id: 'magia-composta', name: 'Teste', level: 1, hpCurrent: 10, hpMax: 10, peCurrent: 3, peMax: 8,
  attributes: [], skills: [], savingThrows: [], maxSustainedSpells: 3,
  activeBuffs: [{ id: 'b1', spellName: 'Escudo Azul', value: 2, isSustained: true, peCostPerRound: 2 },
    { id: 'b2', spellName: 'Luz', value: 1, isSustained: false, durationRounds: -1 }],
  activeConditions: [{ conditionId: 'condenado', remainingRounds: 2, elapsedRounds: 3 }, { conditionId: 'cego', remainingRounds: -1 }],
  spells: [{ id: 'fogo-01', spellType: 'damage', costPE: 4, damageType: 'Fo' }, { id: 'cura-02', spellType: 'heal', costPE: 2 }],
} as unknown as Character;
describe('coleções genéricas de magia e condições', () => {
  it.each([
    ['quantidade buffs ativos', 2], ['quantidade buffs sustentados', 1], ['livre sustentacao', 2],
    ['custo sustentacao rodada', 2], ['tem buff "Escudo Azul"', 1], ['tem buff Ausente', 0],
    ['quantidade feiticos dano', 1], ['quantidade feiticos cura', 1], ['quantidade feiticos elemento Fo', 1],
    ['pe maximo feitico', 4], ['pe minimo feitico', 2], ['idade condicao condenado', 3],
    ['restante condicao condenado', 2], ['condicao cego idade_conhecida', 0], ['quantidade condicoes fisicas', 1],
  ])('%s usa a coleção da ficha', (s, esperado) => { const r = avaliarFormula(String(s), montarVariaveisDoPersonagem(c)); expect(r.valor).toBe(esperado); expect(r.diagnosticos).toEqual([]); });
  it('preserva a contagem antiga de efeitos indefinidos', () => {
    expect(avaliarFormula('@qtd_sustentados', montarVariaveisDoPersonagem(c)).valor).toBe(2);
  });
});
