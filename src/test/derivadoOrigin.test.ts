/**
 * Origem Derivado — ponta a ponta nas regras e no store real.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { applyOriginEffects } from '@/lib/originEngine';
import { buildLevelUpTrackers } from '@/lib/levelEngine';
import { derivadoAuraPrereqIssues, checkDerivadoEmergency } from '@/lib/derivadoOrigin';
import { useCharacterStore } from '@/stores/useCharacterStore';
import type { Character } from '@/types';

const ATTRS = ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Presença'];

function makeDerivado(over: Partial<Character> = {}): Character {
  return {
    id: 'd1', name: 'Deriv', level: 4, origin: 'Derivado',
    characterClass: 'Feiticeiro', specialization: 'Lutador',
    hpCurrent: 30, hpMax: 30, peCurrent: 2, peMax: 20,
    bonusActionsCurrent: 1, bonusActionsMax: 1,
    attributes: ATTRS.map((n) => ({ id: n, name: n, value: n === 'Força' ? 20 : 12 })),
    skills: [], pendingLevelChoices: [], availableAttrPoints: 0,
    ...over,
  } as unknown as Character;
}

describe('Bônus em Atributo', () => {
  it('+2 em um atributo e +1 em outro', () => {
    const e = applyOriginEffects('Derivado', 1, { primaryAttr: 'Força', secondaryAttr: 'Destreza' });
    expect(e.attrBonuses).toEqual({ 'Força': 2, 'Destreza': 1 });
  });
  it('não aplica se escolher o mesmo atributo duas vezes', () => {
    const e = applyOriginEffects('Derivado', 1, { primaryAttr: 'Força', secondaryAttr: 'Força' });
    expect(e.attrBonuses).toEqual({});
  });
});

describe('Energia Antinatural — Aptidão de Aura', () => {
  it('exige a escolha de 1 aptidão e resolve ao escolher', () => {
    expect(applyOriginEffects('Derivado', 1, {}).trackers.pendingSpecialChoice).toBe(1);
    const e = applyOriginEffects('Derivado', 1, { auraAptitudeId: 'aura_macica' });
    expect(e.trackers.pendingSpecialChoice).toBe(0);
    expect(e.abilities.some((a) => a.name === 'Aura: Aura Maciça')).toBe(true);
  });
  it('bloqueia aptidão sem requisito (Aura Maciça exige CON 16)', () => {
    expect(derivadoAuraPrereqIssues('aura_macica', { 'Constituição': 14 }, 1)).toEqual(['Constituição 16']);
    expect(derivadoAuraPrereqIssues('aura_macica', { 'Constituição': 16 }, 1)).toEqual([]);
    expect(derivadoAuraPrereqIssues('aura_movediça', {}, 1)).toEqual([]);
  });
});

describe('Energia Antinatural — Recuperação de Emergência', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [makeDerivado()] } as never));
  const use = (inCombat: boolean) => useCharacterStore.getState().useDerivadoEmergencyRecovery('d1', inCombat);
  const char = () => useCharacterStore.getState().characters[0];

  it('fora de combate é recusada e nada muda', () => {
    expect(use(false).ok).toBe(false);
    expect(char().peCurrent).toBe(2);
  });
  it('em combate recupera 2× BT, gasta a Ação Bônus e marca uso diário', () => {
    const r = use(true);
    expect(r.ok).toBe(true);
    expect(r.recovered).toBe(4); // BT nv 4 = 2
    expect(char().peCurrent).toBe(6);
    expect(char().bonusActionsCurrent).toBe(0);
    expect(char().derivadoEmergencyUsed).toBe(true);
  });
  it('só 1× por dia', () => {
    use(true);
    useCharacterStore.setState({ characters: [{ ...char(), bonusActionsCurrent: 1 }] } as never);
    expect(use(true).ok).toBe(false);
  });
  it('sem Ação Bônus é recusada', () => {
    expect(checkDerivadoEmergency(makeDerivado({ bonusActionsCurrent: 0 } as never), true).ok).toBe(false);
  });
  it('não passa do PE máximo', () => {
    useCharacterStore.setState({ characters: [makeDerivado({ peCurrent: 19 } as never)] } as never);
    use(true);
    expect(char().peCurrent).toBe(20);
  });
  it('outras origens não têm a habilidade', () => {
    expect(checkDerivadoEmergency(makeDerivado({ origin: 'Inato' } as never), true).ok).toBe(false);
  });
});

describe('Desenvolvimento Inesperado', () => {
  it('gera marco apenas nos níveis 4, 8, 12, 16 e 20', () => {
    const t = buildLevelUpTrackers(1, 20, 'Lutador', 'Feiticeiro', 'Derivado')
      .filter((x) => x.kind === 'derivado_attr_milestone').map((x) => x.level);
    expect(t).toEqual([4, 8, 12, 16, 20]);
    const other = buildLevelUpTrackers(1, 20, 'Lutador', 'Feiticeiro', 'Inato')
      .filter((x) => x.kind === 'derivado_attr_milestone');
    expect(other).toHaveLength(0);
  });

  it('aplica +1 no atributo escolhido e +1 no limite dele, sem ponto solto', () => {
    const [milestone] = buildLevelUpTrackers(3, 4, 'Lutador', 'Feiticeiro', 'Derivado')
      .filter((x) => x.kind === 'derivado_attr_milestone');
    useCharacterStore.setState({ characters: [makeDerivado({ pendingLevelChoices: [milestone] } as never)] } as never);
    useCharacterStore.getState().resolvePendingLevelChoice('d1', milestone.id, 'Força');
    const c = useCharacterStore.getState().characters[0];
    expect(c.attributes.find((a) => a.name === 'Força')!.value).toBe(21); // passa do 20
    expect(c.attrCaps?.['Força']).toBe(21);
    expect(c.availableAttrPoints ?? 0).toBe(0);
    expect(c.attributes.find((a) => a.name === 'Destreza')!.value).toBe(12);
  });
});
