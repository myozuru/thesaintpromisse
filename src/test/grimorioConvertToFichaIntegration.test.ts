/**
 * Verificações de fidelidade numérica, robustez de entrada e
 * integração com o recalc do store. Foco em casos que poderiam
 * passar despercebidos: case/diacríticos, fallback, round-trip,
 * sobrescrita por recalc do store, contadores de nome, etc.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { importCreatureToFichas } from '@/components/grimorio/convertToFicha';
import { getMasteryBonus, getDefaultSavingThrowBonus } from '@/types';

function base(extra: any = {}) {
  return {
    name: 'Alvo',
    core: { nd: 5, size: 'medio', origin: { type: 'feiticeiro' } },
    attributes: { forca: 14, destreza: 14, constituicao: 16, inteligencia: 18, sabedoria: 12, presenca: 10 },
    stats: { hpMax: 100, peMax: 20, defesa: 17, deslocamento: 9, cdBase: 16 },
    saves: { fortitude: 8, reflexos: 6, vontade: 9, astucia: 10, integridade: 7 },
    skills: [],
    defenses: { vulnerabilidades: [], imunidades: [], resistencias: [], condicoesImunes: [] },
    aptidoes: { ea: 1, cl: 0, bar: 0, dom: 0, er: 0 },
    actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [] },
    ...extra,
  };
}
const get = (id: string) => useCharacterStore.getState().characters.find((c) => c.id === id)!;

describe('Damage types — case-insensitive e diacríticos', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('aceita "CORTANTE" maiúsculo', () => {
    const r = importCreatureToFichas(base({
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'A', type: 'comum', attackType: 'acerto', damage: { roll: '1d6', type: 'CORTANTE' } },
      ]},
    }));
    expect(get(r!.id).spells.find((s) => s.name === 'A')!.damageType).toBe('DCO');
  });

  it('aceita "ácido"/"acido" indiferentemente', () => {
    for (const t of ['ácido', 'acido']) {
      useCharacterStore.setState({ characters: [] } as any, false);
      const r = importCreatureToFichas(base({
        actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
          { name: 'A', type: 'comum', attackType: 'acerto', damage: { roll: '1d6', type: t } },
        ]},
      }));
      expect(get(r!.id).spells[0].damageType).toBe('DA');
    }
  });

  it('aceita "sônico"/"sonoro"/"sonico"', () => {
    for (const t of ['sônico', 'sonico', 'sonoro']) {
      useCharacterStore.setState({ characters: [] } as any, false);
      const r = importCreatureToFichas(base({
        actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
          { name: 'A', type: 'comum', attackType: 'acerto', damage: { roll: '1d6', type: t } },
        ]},
      }));
      expect(get(r!.id).spells[0].damageType).toBe('DS');
    }
  });

  it('"necrótico"/"radiante"/"psíquico"/"venenoso"', () => {
    const r = importCreatureToFichas(base({
      defenses: {
        vulnerabilidades: [{ tipo: 'psíquico' }, { tipo: 'venenoso' }],
        imunidades: [{ tipo: 'radiante' }, { tipo: 'necrótico' }],
        resistencias: [], condicoesImunes: [],
      },
    }));
    const c = get(r!.id);
    expect(c.vulnerabilities).toEqual(expect.arrayContaining(['DPS', 'DV']));
    expect(c.immunities).toEqual(expect.arrayContaining(['DR', 'DN']));
  });
});

describe('Nome único — contador suficiente', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('três importações geram "Alvo", "Alvo (2)", "Alvo (3)"', () => {
    importCreatureToFichas(base());
    importCreatureToFichas(base());
    importCreatureToFichas(base());
    const names = useCharacterStore.getState().characters.map((c) => c.name).sort();
    expect(names).toEqual(['Alvo', 'Alvo (2)', 'Alvo (3)']);
  });
});

describe('combatState — sanidade do current vs max', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('hpCurrent acima do hpMax cai para hpMax', () => {
    const cre: any = base();
    cre.combatState = { hpCurrent: 9999, peCurrent: 0 };
    const r = importCreatureToFichas(cre);
    expect(get(r!.id).hpCurrent).toBe(get(r!.id).hpMax);
  });

  it('hpCurrent negativo ou não numérico ignora combatState (default hpMax)', () => {
    const cre: any = base();
    cre.combatState = { hpCurrent: 'abc', peCurrent: null };
    const r = importCreatureToFichas(cre);
    expect(get(r!.id).hpCurrent).toBe(get(r!.id).hpMax);
  });
});

describe('Entradas ausentes/parciais', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('aptidoes ausente: cursedAptitudes fica nos defaults (todos zero)', () => {
    const cre = base();
    delete (cre as any).aptidoes;
    const r = importCreatureToFichas(cre);
    const c = get(r!.id);
    expect(c.cursedAptitudes.AU).toBe(0);
    expect(c.cursedAptitudes.CL).toBe(0);
  });

  it('attributes parcial preserva valores existentes para os não fornecidos', () => {
    const cre = base({ attributes: { forca: 20 } as any });
    const r = importCreatureToFichas(cre);
    const c = get(r!.id);
    expect(c.attributes.find((a) => a.name === 'Força')!.value).toBe(20);
    // Demais devem ter algum valor numérico (default da ficha)
    expect(typeof c.attributes.find((a) => a.name === 'Destreza')!.value).toBe('number');
  });

  it('saves parcial: apenas TR fornecida vira externalBonus calculado', () => {
    const cre = base({ saves: { fortitude: 12 } as any });
    const r = importCreatureToFichas(cre);
    const c = get(r!.id);
    const dsb = getDefaultSavingThrowBonus(c.level);
    const conMod = Math.floor((c.attributes.find((a) => a.name === 'Constituição')!.value - 10) / 2);
    const fort = c.savingThrows.find((s) => s.name === 'Fortitude')!;
    expect(dsb + conMod + (fort.externalBonus ?? 0)).toBe(12);
  });

  it('actions.list vazia não gera spells nem [Ações Extras]', () => {
    const r = importCreatureToFichas(base());
    const c = get(r!.id);
    expect(c.spells).toEqual([]);
    expect(c.passives.some((p) => p.name === '[Ações Extras]')).toBe(false);
  });

  it('cdAttr inválido cai no fallback sem quebrar', () => {
    const r = importCreatureToFichas(base({ cdAttr: 'inexistente' }));
    expect(typeof get(r!.id).dcLinkedAttr).toBe('string');
  });
});

describe('Fidelidade — perícia reconstruída em vários níveis', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it.each([1, 5, 10, 15, 20])('reconstrói Feitiçaria em ND %i', (nd) => {
    const r = importCreatureToFichas(base({
      core: { nd, size: 'medio', origin: { type: 'feiticeiro' } },
      skills: [{ name: 'Feitiçaria', mod: 17, mastered: true }],
    }));
    const c = get(r!.id);
    const m = getMasteryBonus(c.level);
    const half = Math.floor(c.level / 2);
    const intMod = Math.floor((c.attributes.find((a) => a.name === 'Inteligência')!.value - 10) / 2);
    const sk = c.skills.find((s) => s.name === 'Feitiçaria')!;
    expect(half + intMod + 2 * m + (sk.externalBonus ?? 0)).toBe(17);
  });
});

describe('Custo PE e formatos de campos numéricos', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('cost não-numérico vira 0', () => {
    const r = importCreatureToFichas(base({
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'X', type: 'comum', attackType: 'acerto', cost: '5', damage: { roll: '1d4', type: 'cortante' } },
      ]},
    }));
    expect(get(r!.id).spells[0].costPE).toBe(0);
  });

  it('cd não-numérico não vira bonusDC', () => {
    const r = importCreatureToFichas(base({
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'X', type: 'comum', attackType: 'tr_individual', cd: 'auto', trType: 'vontade', damage: {} },
      ]},
    }));
    expect(get(r!.id).spells[0].bonusDC).toBeUndefined();
  });

  it('spellLevel constante "1" para spells convertidos', () => {
    const r = importCreatureToFichas(base({
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'X', type: 'comum', attackType: 'acerto', damage: { roll: '1d6', type: 'cortante' } },
      ]},
    }));
    expect(get(r!.id).spells[0].spellLevel).toBe('1');
  });
});

describe('Range é preservado nos spells', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));
  it('range string passa direto', () => {
    const r = importCreatureToFichas(base({
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'X', type: 'comum', attackType: 'acerto', range: '9m', damage: { roll: '1d6', type: 'cortante' } },
      ]},
    }));
    expect(get(r!.id).spells[0].range).toBe('9m');
  });
});

describe('Integração com recalc do store — HP/PE não são sobrescritos', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('updateCharacter posterior em campo trivial não regenera HP/PE da criatura', () => {
    const r = importCreatureToFichas(base({ stats: { hpMax: 500, peMax: 60, defesa: 18, deslocamento: 9, cdBase: 16 } }));
    expect(get(r!.id).hpMax).toBe(500);
    expect(get(r!.id).peMax).toBe(60);
    useCharacterStore.getState().updateCharacter(r!.id, { initiativeBonus: 99 });
    expect(get(r!.id).hpMax).toBe(500);
    expect(get(r!.id).peMax).toBe(60);
    expect(get(r!.id).initiativeBonus).toBe(99);
  });
});

describe('Vínculo via linkedFichaId — re-importação substitui patch inteiro', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('mudar nome da criatura NÃO renomeia a ficha (vínculo é por id)', () => {
    const r = importCreatureToFichas(base({ name: 'Inicial' }));
    const cre: any = { ...base({ name: 'Renomeado' }), linkedFichaId: r!.id };
    importCreatureToFichas(cre);
    expect(get(r!.id).name).toBe('Inicial');
  });

  it('mudar atributos altera modificadores derivados em re-importação', () => {
    const r = importCreatureToFichas(base());
    const cre: any = { ...base({
      attributes: { forca: 30, destreza: 14, constituicao: 16, inteligencia: 18, sabedoria: 12, presenca: 10 },
    }), linkedFichaId: r!.id };
    importCreatureToFichas(cre);
    expect(get(r!.id).attributes.find((a) => a.name === 'Força')!.value).toBe(30);
  });
});

describe('Classe — fallback Não-Feiticeiro', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('origin.type "restringido" → Não-Feiticeiro', () => {
    const r = importCreatureToFichas(base({ core: { nd: 5, size: 'medio', origin: { type: 'restringido' } } }));
    expect(get(r!.id).characterClass).toBe('Não-Feiticeiro');
  });

  it('origin.type "nao_feiticeiro" → Não-Feiticeiro', () => {
    const r = importCreatureToFichas(base({ core: { nd: 5, size: 'medio', origin: { type: 'nao_feiticeiro' } } }));
    expect(get(r!.id).characterClass).toBe('Não-Feiticeiro');
  });
});
