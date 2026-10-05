/**
 * Validação do conversor Grimório → Ficha (v2).
 * Cenário: Calamidade ND 15 com HP/PE altos, perícias, TR, ações, aptidões.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { importCreatureToFichas } from '@/components/grimorio/convertToFicha';
import { getMasteryBonus, getDefaultSavingThrowBonus } from '@/types';

function makeCalamidade() {
  return {
    name: 'Calamidade Teste',
    core: { nd: 15, size: 'enorme', origin: { type: 'maldicao', hasAumentoEnergia: true } },
    attributes: { forca: 28, destreza: 18, constituicao: 26, inteligencia: 22, sabedoria: 16, presenca: 24 },
    stats: {
      hpMax: 2700, peMax: 45, defesa: 22, deslocamento: 12, iniciativa: 8, atencao: 6,
      rdGeral: 5, guardaInabavalMax: 80, rdIrredutivel: 4, espaco: 4.5,
    },
    saves: { fortitude: 24, reflexos: 16, vontade: 18, astucia: 14, integridade: 22 },
    skills: [
      { name: 'Feitiçaria', mod: 25, mastered: true },
      { name: 'Intimidação', mod: 20, mastered: true },
      { name: 'Percepção', mod: 14, mastered: false },
    ],
    defenses: {
      vulnerabilidades: [{ tipo: 'radiante' }],
      imunidades: [{ tipo: 'necrótico' }],
      resistencias: [{ tipo: 'cortante', nivel: 'forte' }],
      condicoesImunes: ['atordoado'],
    },
    aptidoes: { ea: 5, cl: 4, bar: 3, dom: 2, er: 5 },
    actions: {
      total: { comum: 2, bonus: 1, reacao: 1, rapida: 2, movimento: 1 },
      list: [
        {
          name: 'Garra Lacerante', type: 'comum', attackType: 'acerto',
          toHit: 27, cost: 0, range: '3m',
          damage: { roll: '6d10+37', type: 'cortante', average: 70 },
        },
        {
          name: 'Rugido Aterrador', type: 'comum', attackType: 'tr_area',
          cd: 24, trType: 'vontade', cost: 5, range: '6m',
          damage: { roll: '4d8', type: 'sônico' },
          conditions: [{ name: 'atordoado', durationRounds: 2 }],
        },
      ],
    },
    features: [{ name: 'Visão Sombria', description: 'Enxerga no escuro.' }],
    dotes: [{ name: 'Garras Cruéis', description: '+1 crítico.' }],
  };
}

describe('importCreatureToFichas — Calamidade ND 15', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [] } as any, false);
  });

  it('preserva HP/PE da criatura sem deixar o recalc do store sobrescrever', () => {
    const res = importCreatureToFichas(makeCalamidade());
    expect(res).not.toBeNull();
    const c = useCharacterStore.getState().characters.find((x) => x.id === res!.id)!;
    expect(c.hpMax).toBe(2700);
    expect(c.hpCurrent).toBe(2700);
    expect(c.peMax).toBe(45);
    expect(c.peCurrent).toBe(45);
  });

  it('limita criaturas do Grimório a duas ações comuns, inclusive em fichas antigas reidratadas/atualizadas', () => {
    const criatura = makeCalamidade();
    criatura.actions.total.comum = 4;
    const res = importCreatureToFichas(criatura);
    const c = useCharacterStore.getState().characters.find((x) => x.id === res!.id)!;
    expect(c.actionsMax).toBe(2);
    expect(c.actionsCurrent).toBe(2);

    useCharacterStore.getState().updateCharacter(c.id, { actionsMax: 4, actionsCurrent: 4 });
    const atualizada = useCharacterStore.getState().characters.find((x) => x.id === c.id)!;
    expect(atualizada.actionsMax).toBe(2);
    expect(atualizada.actionsCurrent).toBe(2);
  });

  it('aplica nível clampado a 20 e atributos com clamp 1..30', () => {
    const res = importCreatureToFichas(makeCalamidade());
    const c = useCharacterStore.getState().characters.find((x) => x.id === res!.id)!;
    expect(c.level).toBe(15);
    expect(c.attributes.find((a) => a.name === 'Força')!.value).toBe(28);
    expect(c.attributes.find((a) => a.name === 'Constituição')!.value).toBe(26);
  });

  it('grava perícias com externalBonus de modo que o mod final reproduza o da criatura', () => {
    const res = importCreatureToFichas(makeCalamidade());
    const c = useCharacterStore.getState().characters.find((x) => x.id === res!.id)!;
    const maestria = getMasteryBonus(c.level);
    const half = Math.floor(c.level / 2);

    // Feitiçaria (mastered) → Inteligência
    const feit = c.skills.find((s) => s.name === 'Feitiçaria')!;
    const intMod = Math.floor((c.attributes.find((a) => a.name === 'Inteligência')!.value - 10) / 2);
    const reconstFeit = half + intMod + 2 * maestria + (feit.externalBonus ?? 0);
    expect(reconstFeit).toBe(25);

    // Percepção (não treinada) → Sabedoria
    const perc = c.skills.find((s) => s.name === 'Percepção')!;
    const wisMod = Math.floor((c.attributes.find((a) => a.name === 'Sabedoria')!.value - 10) / 2);
    const reconstPerc = half + wisMod + 0 + (perc.externalBonus ?? 0);
    expect(reconstPerc).toBe(14);
  });

  it('grava TRs reconstruindo o valor original sem duplicação', () => {
    const res = importCreatureToFichas(makeCalamidade());
    const c = useCharacterStore.getState().characters.find((x) => x.id === res!.id)!;
    const dsb = getDefaultSavingThrowBonus(c.level);
    const fort = c.savingThrows.find((s) => s.name === 'Fortitude')!;
    const conMod = Math.floor((c.attributes.find((a) => a.name === 'Constituição')!.value - 10) / 2);
    expect(dsb + conMod + (fort.externalBonus ?? 0)).toBe(24);
  });

  it('traduz tipos de dano em vulnerabilidades/imunidades/RD', () => {
    const res = importCreatureToFichas(makeCalamidade());
    const c = useCharacterStore.getState().characters.find((x) => x.id === res!.id)!;
    expect(c.vulnerabilities).toContain('DR');
    expect(c.immunities).toContain('DN');
    const rd = c.passives.find((p) => p.name.startsWith('[Resistência]'));
    expect(rd).toBeTruthy();
    expect(rd!.bonusRdByType?.DCO).toBe(10);
  });

  it('converte ações em Spells com damageType e bonusDC corretos', () => {
    const res = importCreatureToFichas(makeCalamidade());
    const c = useCharacterStore.getState().characters.find((x) => x.id === res!.id)!;
    const garra = c.spells.find((s) => s.name === 'Garra Lacerante')!;
    // A conversão separa "6d10+37" em damageDice="6d10" + fixedDamage=37
    // (o bônus fixo é somado na rolagem, sem duplicar nas técnicas).
    expect(garra.damageDice).toBe('6d10');
    expect(garra.fixedDamage).toBe(37);
    expect(garra.damageType).toBe('DCO');
    expect(garra.targetMode).toBe('single_atk');

    const rugido = c.spells.find((s) => s.name === 'Rugido Aterrador')!;
    expect(rugido.bonusDC).toBe(24);
    expect(rugido.saveAttr).toBe('Vontade');
    expect(rugido.targetMode).toBe('area_tr');
    expect(rugido.conditions?.[0].conditionId).toBe('atordoado');

    expect(c.customHitBonus).toBe(27);
  });

  it('mapeia aptidões amaldiçoadas e classe/tamanho', () => {
    const res = importCreatureToFichas(makeCalamidade());
    const c = useCharacterStore.getState().characters.find((x) => x.id === res!.id)!;
    expect(c.cursedAptitudes!.AU).toBe(5);
    expect(c.cursedAptitudes!.ER).toBe(5);
    expect(c.cursedAptitudes!.DOM).toBe(2);
    expect(c.characterClass).toBe('Maldição');
    expect(c.hasEnergiaReversa).toBeFalsy(); // Bug #12 fix: hasAumentoEnergia ≠ hasEnergiaReversa
    expect(c.sizeCategory).toBe('Grande');
  });

  it('preserva HP/PE em re-importação (vinculo via linkedFichaId)', () => {
    const r1 = importCreatureToFichas(makeCalamidade());
    const cre: any = { ...makeCalamidade(), linkedFichaId: r1!.id };
    cre.combatState = { hpCurrent: 1200, peCurrent: 12 };
    const r2 = importCreatureToFichas(cre);
    expect(r2!.id).toBe(r1!.id);
    const c = useCharacterStore.getState().characters.find((x) => x.id === r1!.id)!;
    expect(c.hpMax).toBe(2700);
    expect(c.hpCurrent).toBe(1200);
    expect(c.peCurrent).toBe(12);
  });
});
