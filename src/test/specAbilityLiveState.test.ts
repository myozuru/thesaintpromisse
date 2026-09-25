/**
 * Fase 2 — Estado vivo das Habilidades de Especialização (Técnica):
 *   • Slots de Concentração / Sustentado (passivos derivados)
 *   • Variações de liberação universais (Versatilidade Ampliada)
 *   • Pool dedicado de Aptidões reaplicado no início da rodada
 *   • Reset de aptitudeOnlyTempPE / lastSpellUsedId em cena/descansos
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { aggregateSpecAbilityEffects } from '@/lib/specAbilityEffects';
import { useCharacterStore } from '@/stores/useCharacterStore';
import type { Character } from '@/types';

function baseChar(partial: Partial<Character> = {}): Pick<
  Character,
  'chosenSpecAbilities' | 'attributes' | 'level' | 'keyAttribute'
> {
  return {
    level: 12,
    attributes: [
      { id: 'a1', name: 'Força', value: 10 },
      { id: 'a2', name: 'Destreza', value: 10 },
      { id: 'a3', name: 'Constituição', value: 10 },
      { id: 'a4', name: 'Inteligência', value: 16 },
      { id: 'a5', name: 'Sabedoria', value: 10 },
      { id: 'a6', name: 'Presença', value: 10 },
    ] as Character['attributes'],
    chosenSpecAbilities: [],
    keyAttribute: 'Inteligência',
    ...partial,
  };
}

const withIds = (...ids: string[]) =>
  baseChar({
    chosenSpecAbilities: ids.map((id) => ({ abilityId: id, chosenAtLevel: 1 })),
  });

describe('aggregateSpecAbilityEffects — Fase 2 (estado vivo)', () => {
  it('defaults: 1 concentração, 1 sustentado, 0 release, 0 pool aptidões', () => {
    const r = aggregateSpecAbilityEffects(baseChar());
    expect(r.maxConcentrationSlots).toBe(1);
    expect(r.maxSustainedSpells).toBe(1);
    expect(r.bonusReleaseSlots).toBe(0);
    expect(r.aptitudeOnlyTempPEPerRound).toBe(0);
  });

  it('tec-mente-repartida → maxConcentrationSlots = 2', () => {
    const r = aggregateSpecAbilityEffects(withIds('tec-mente-repartida'));
    expect(r.maxConcentrationSlots).toBe(2);
  });

  it('tec-sustentacao-avancada → maxSustainedSpells = 2', () => {
    const r = aggregateSpecAbilityEffects(withIds('tec-sustentacao-avancada'));
    expect(r.maxSustainedSpells).toBe(2);
  });

  it('tec-sustentacao-mestre → maxSustainedSpells = 3 (substitui anteriores)', () => {
    const r = aggregateSpecAbilityEffects(
      withIds('tec-sustentacao-avancada', 'tec-sustentacao-mestre'),
    );
    expect(r.maxSustainedSpells).toBe(3);
  });

  it('tec-versatilidade-ampliada → bonusReleaseSlots += 1', () => {
    const r = aggregateSpecAbilityEffects(withIds('tec-versatilidade-ampliada'));
    expect(r.bonusReleaseSlots).toBe(1);
  });

  it('tec-mestre-das-aptidoes — pool = ⌊TB/2⌋ (Nv 12 → TB 4 → 2)', () => {
    const r = aggregateSpecAbilityEffects(withIds('tec-mestre-das-aptidoes'));
    expect(r.aptitudeOnlyTempPEPerRound).toBe(2);
  });

  it('tec-mestre-das-aptidoes em Nv 1 (TB 2 → ⌊2/2⌋ = 1)', () => {
    const c = withIds('tec-mestre-das-aptidoes');
    const r = aggregateSpecAbilityEffects({ ...c, level: 1 });
    expect(r.aptitudeOnlyTempPEPerRound).toBe(1);
  });

  it('combinação completa Tier 6→16 acumula coerentemente', () => {
    const r = aggregateSpecAbilityEffects(
      withIds(
        'tec-mente-repartida',
        'tec-sustentacao-mestre',
        'tec-versatilidade-ampliada',
        'tec-mestre-das-aptidoes',
      ),
    );
    expect(r.maxConcentrationSlots).toBe(2);
    expect(r.maxSustainedSpells).toBe(3);
    expect(r.bonusReleaseSlots).toBe(1);
    expect(r.aptitudeOnlyTempPEPerRound).toBe(2);
  });
});

// ===== Reset / hooks no store ===============================================

describe('useCharacterStore — Fase 2 hooks de estado vivo', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [] });
  });

  function seedCharWithAbility(abilityId?: string) {
    useCharacterStore.getState().addCharacter('Tec', 'PLAYER', 'PLAYER');
    const id = useCharacterStore.getState().characters[0]!.id;
    useCharacterStore.setState((s) => ({
      characters: s.characters.map((c) =>
        c.id === id
          ? {
              ...c,
              level: 12,
              characterClass: 'Feiticeiro',
              specialization: 'Especialista em Técnica',
              keyAttribute: 'Inteligência',
              attributes: c.attributes.map((a) =>
                a.name === 'Inteligência' ? { ...a, value: 16 } : a,
              ),
              chosenSpecAbilities: abilityId
                ? [{ abilityId, chosenAtLevel: 12 }]
                : [],
              aptitudeOnlyTempPE: 0,
              lastSpellUsedId: 'feitico-anterior',
            }
          : c,
      ),
    }));
    return id;
  }

  it('applyTurnStartSpecHooks reaplica aptitudeOnlyTempPE quando possui Mestre das Aptidões', () => {
    const id = seedCharWithAbility('tec-mestre-das-aptidoes');
    useCharacterStore.getState().applyTurnStartSpecHooks(id);
    const c = useCharacterStore.getState().characters.find((x) => x.id === id)!;
    // Nv 12 → TB 4 → ⌊4/2⌋ = 2.
    expect(c.aptitudeOnlyTempPE).toBe(2);
  });

  it('applyTurnStartSpecHooks ZERA o pool quando não possui a habilidade', () => {
    const id = seedCharWithAbility(undefined);
    // Pré-condição: pool não-zero (ex.: cena anterior).
    useCharacterStore.setState((s) => ({
      characters: s.characters.map((c) =>
        c.id === id ? { ...c, aptitudeOnlyTempPE: 5 } : c,
      ),
    }));
    useCharacterStore.getState().applyTurnStartSpecHooks(id);
    const c = useCharacterStore.getState().characters.find((x) => x.id === id)!;
    expect(c.aptitudeOnlyTempPE).toBe(0);
  });

  it('applyTurnStartSpecHooks NÃO acumula entre rodadas (substitui o pool)', () => {
    const id = seedCharWithAbility('tec-mestre-das-aptidoes');
    useCharacterStore.getState().applyTurnStartSpecHooks(id);
    useCharacterStore.getState().applyTurnStartSpecHooks(id);
    const c = useCharacterStore.getState().characters.find((x) => x.id === id)!;
    expect(c.aptitudeOnlyTempPE).toBe(2);
  });

  it('resetSceneForCharacter zera aptitudeOnlyTempPE e lastSpellUsedId', () => {
    const id = seedCharWithAbility('tec-mestre-das-aptidoes');
    useCharacterStore.setState((s) => ({
      characters: s.characters.map((c) =>
        c.id === id ? { ...c, aptitudeOnlyTempPE: 3, lastSpellUsedId: 'x' } : c,
      ),
    }));
    useCharacterStore.getState().resetSceneForCharacter(id);
    const c = useCharacterStore.getState().characters.find((x) => x.id === id)!;
    expect(c.aptitudeOnlyTempPE).toBe(0);
    expect(c.lastSpellUsedId).toBeUndefined();
  });

  it('applyShortRest zera aptitudeOnlyTempPE e lastSpellUsedId', () => {
    const id = seedCharWithAbility('tec-mestre-das-aptidoes');
    useCharacterStore.setState((s) => ({
      characters: s.characters.map((c) =>
        c.id === id
          ? { ...c, aptitudeOnlyTempPE: 4, lastSpellUsedId: 'feitico-x', peCurrent: 0 }
          : c,
      ),
    }));
    useCharacterStore.getState().applyShortRest(id);
    const c = useCharacterStore.getState().characters.find((x) => x.id === id)!;
    expect(c.aptitudeOnlyTempPE).toBe(0);
    expect(c.lastSpellUsedId).toBeUndefined();
  });

  it('applyLongRest zera aptitudeOnlyTempPE e lastSpellUsedId', () => {
    const id = seedCharWithAbility('tec-mestre-das-aptidoes');
    useCharacterStore.setState((s) => ({
      characters: s.characters.map((c) =>
        c.id === id
          ? { ...c, aptitudeOnlyTempPE: 4, lastSpellUsedId: 'feitico-y' }
          : c,
      ),
    }));
    useCharacterStore.getState().applyLongRest(id);
    const c = useCharacterStore.getState().characters.find((x) => x.id === id)!;
    expect(c.aptitudeOnlyTempPE).toBe(0);
    expect(c.lastSpellUsedId).toBeUndefined();
  });
});

// ===== Idempotência da progressão ===========================================

describe('applyTecnicaProgression — Fase 2 idempotência dos slots', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [] });
  });

  it('aplica maxConcentrationSlots/maxSustainedSpells via chooseSpecAbility', async () => {
    useCharacterStore.getState().addCharacter('Tec', 'PLAYER', 'PLAYER');
    const id = useCharacterStore.getState().characters[0]!.id;
    useCharacterStore.setState((s) => ({
      characters: s.characters.map((c) =>
        c.id === id
          ? {
              ...c,
              level: 16,
              characterClass: 'Feiticeiro',
              specialization: 'Especialista em Técnica',
              keyAttribute: 'Inteligência',
            }
          : c,
      ),
    }));
    useCharacterStore.getState().chooseSpecAbility(id, 'tec-mente-repartida', { skipPoolConsumption: true });
    useCharacterStore.getState().chooseSpecAbility(id, 'tec-sustentacao-avancada', { skipPoolConsumption: true });
    useCharacterStore.getState().chooseSpecAbility(id, 'tec-sustentacao-mestre', { skipPoolConsumption: true });
    useCharacterStore.getState().chooseSpecAbility(id, 'tec-versatilidade-ampliada', { skipPoolConsumption: true });
    const c = useCharacterStore.getState().characters.find((x) => x.id === id)!;
    expect(c.maxConcentrationSlots).toBe(2);
    expect(c.maxSustainedSpells).toBe(3);
    expect(c.bonusReleaseSlots).toBe(1);
  });
});
