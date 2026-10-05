import { afterEach, describe, expect, it } from 'vitest';
import type { Character } from '@/types';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useMapStore } from '@/stores/useMapStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { enqueueAuraMacabraTestsForEnemy } from '@/lib/auraTurnTests';
import { resolveAuraTurnTest } from '@/lib/auraTurnResolution';

const owner = {
  id: 'owner', name: 'Portadora', category: 'PLAYER', profileId: 'p-owner', level: 1,
  cursedAptitudes: { AU: 0 }, chosenAuraAptitudes: ['aura_macabra'], attributes: [],
} as unknown as Character;
const enemy = {
  id: 'enemy', name: 'Inimigo', category: 'INIMIGO', profileId: undefined, level: 1,
  savingThrows: [{ id: 'v', name: 'Vontade', value: 3 }], activeConditions: [], attributes: [],
} as unknown as Character;

function setupMap(enemyX = 70) {
  useMapStore.setState({
    entities: {
      ownerToken: { id: 'ownerToken', x: 0, y: 0, w: 70, h: 70, characterId: 'owner' },
      enemyToken: { id: 'enemyToken', x: enemyX, y: 0, w: 70, h: 70, characterId: 'enemy' },
    },
    gridConfig: { dpi: 70, metersPerCell: 1.5 },
  } as never);
  useCharacterStore.setState({ characters: [owner, enemy] } as never);
  useCombatStore.setState({ combatId: 'test', round: 2, currentTurnIndex: 1 } as never);
  useTestRequestStore.setState({ requests: [] });
}

afterEach(() => {
  useCharacterStore.setState({ characters: [] } as never);
  useMapStore.setState({ entities: {} } as never);
  useTestRequestStore.setState({ requests: [] });
});

describe('Aura Macabra no início do turno inimigo', () => {
  it('solicita Vontade ao Mestre quando o inimigo está no raio medido pelo mapa', () => {
    setupMap();
    expect(enqueueAuraMacabraTestsForEnemy('enemy')).toBe(1);
    expect(useTestRequestStore.getState().requests[0]).toMatchObject({
      charId: 'enemy', kind: 'save', testName: 'Vontade', dc: 10,
      auraResolution: { type: 'enemy_turn_aura', auraId: 'aura_macabra', conditionId: 'abalado' },
    });
    expect(enqueueAuraMacabraTestsForEnemy('enemy')).toBe(0);
  });

  it('não solicita TR se o inimigo estiver além do raio', () => {
    setupMap(280);
    expect(enqueueAuraMacabraTestsForEnemy('enemy')).toBe(0);
    expect(useTestRequestStore.getState().requests).toHaveLength(0);
  });

  it('usa Amedrontado a partir de AU 3', () => {
    setupMap();
    useCharacterStore.setState({ characters: [{ ...owner, cursedAptitudes: { AU: 3 } }, enemy] } as never);
    expect(enqueueAuraMacabraTestsForEnemy('enemy')).toBe(1);
    expect(useTestRequestStore.getState().requests[0].auraResolution?.conditionId).toBe('amedrontado');
  });

  it('aplica Abalado na falha e marca o pedido para evitar reaplicar', () => {
    setupMap();
    enqueueAuraMacabraTestsForEnemy('enemy');
    const request = useTestRequestStore.getState().requests[0];
    useTestRequestStore.getState().setResult(request.id, {
      d20: 2, bonus: 3, total: 5, rolledAt: Date.now(),
    });
    const resolved = useTestRequestStore.getState().requests[0];
    expect(resolveAuraTurnTest(resolved)).toBe(true);
    expect(useCharacterStore.getState().characters[1].activeConditions).toHaveLength(1);
    expect(useCharacterStore.getState().characters[1].activeConditions[0]).toMatchObject({
      conditionId: 'abalado', durationMode: 'ate_passar_tr', endTrType: 'vontade', sourceCharId: 'owner',
    });
    expect(resolveAuraTurnTest(useTestRequestStore.getState().requests[0])).toBe(false);
  });

  it('não aplica condição quando o inimigo passa no teste', () => {
    setupMap();
    enqueueAuraMacabraTestsForEnemy('enemy');
    const request = useTestRequestStore.getState().requests[0];
    useTestRequestStore.getState().setResult(request.id, {
      d20: 10, bonus: 3, total: 13, rolledAt: Date.now(),
    });
    expect(resolveAuraTurnTest(useTestRequestStore.getState().requests[0])).toBe(true);
    expect(useCharacterStore.getState().characters[1].activeConditions).toHaveLength(0);
  });
});
