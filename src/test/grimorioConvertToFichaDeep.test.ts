/**
 * Verificações profundas e adicionais do conversor Grimório → Ficha.
 * Cobre: CD base, atributo da CD, movimento, categoria, level-lock,
 * clamps, fallbacks, idempotência, ações sem dano, etc.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { importCreatureToFichas } from '@/components/grimorio/convertToFicha';

function baseCreature(extra: any = {}) {
  return {
    name: 'Teste',
    core: { nd: 5, size: 'medio', origin: { type: 'feiticeiro' } },
    attributes: { forca: 14, destreza: 12, constituicao: 16, inteligencia: 18, sabedoria: 10, presenca: 8 },
    stats: { hpMax: 80, peMax: 20, defesa: 17, deslocamento: 9, cdBase: 16, iniciativa: 2, atencao: 1, rdGeral: 0 },
    saves: { fortitude: 8, reflexos: 5, vontade: 7, astucia: 9, integridade: 6 },
    skills: [{ name: 'Percepção', mod: 6, mastered: false }],
    defenses: { vulnerabilidades: [], imunidades: [], resistencias: [], condicoesImunes: [] },
    aptidoes: { ea: 1, cl: 0, bar: 0, dom: 0, er: 0 },
    actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [] },
    cdAttr: 'inteligencia',
    ...extra,
  };
}

function get(id: string) {
  return useCharacterStore.getState().characters.find((c) => c.id === id)!;
}

describe('Conversor — CD base & atributo da CD', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('grava baseDC vindo de stats.cdBase', () => {
    const r = importCreatureToFichas(baseCreature());
    expect(get(r!.id).baseDC).toBe(16);
  });

  it('mapeia cdAttr para dcLinkedAttr (id do atributo correto)', () => {
    const r = importCreatureToFichas(baseCreature({ cdAttr: 'presenca' }));
    const c = get(r!.id);
    const presId = c.attributes.find((a) => a.name === 'Presença')!.id;
    expect(c.dcLinkedAttr).toBe(presId);
  });

  it('mantém dcLinkedAttr atual (sem quebrar) quando cdAttr ausente', () => {
    const r = importCreatureToFichas(baseCreature({ cdAttr: null }));
    const c = get(r!.id);
    expect(typeof c.dcLinkedAttr).toBe('string');
  });

  it('usa fallback do current.baseDC quando stats.cdBase ausente', () => {
    const cre = baseCreature();
    delete cre.stats.cdBase;
    const r = importCreatureToFichas(cre);
    expect(typeof get(r!.id).baseDC).toBe('number');
  });
});

describe('Conversor — Movimento e tamanho', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('grava movimento em metros direto de stats.deslocamento', () => {
    const r = importCreatureToFichas(baseCreature({ stats: { ...baseCreature().stats, deslocamento: 12 } }));
    expect(get(r!.id).movement).toBe(12);
  });

  it('mapeia tamanhos enorme/colossal → Grande', () => {
    const r = importCreatureToFichas(baseCreature({ core: { nd: 5, size: 'colossal', origin: { type: 'feiticeiro' } } }));
    expect(get(r!.id).sizeCategory).toBe('Grande');
  });

  it('mapeia minusculo → Pequeno', () => {
    const r = importCreatureToFichas(baseCreature({ core: { nd: 5, size: 'minusculo', origin: { type: 'feiticeiro' } } }));
    expect(get(r!.id).sizeCategory).toBe('Pequeno');
  });
});

describe('Conversor — Categoria, visibilidade, level-lock', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('cria como INIMIGO oculto dos players', () => {
    const r = importCreatureToFichas(baseCreature());
    const c = get(r!.id);
    expect(c.category).toBe('INIMIGO');
    expect(c.hiddenFromPlayers).toBe(true);
  });

  it('zera levelHistory para impedir reconstrução de níveis fictícios', () => {
    const r = importCreatureToFichas(baseCreature());
    expect(get(r!.id).levelHistory).toEqual([]);
  });

  it('marca createdBy = MASTER', () => {
    const r = importCreatureToFichas(baseCreature());
    expect(get(r!.id).createdBy).toBe('MASTER');
  });
});

describe('Conversor — Clamps e ND > 20', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('clampa ND a 20 e adiciona passiva [ND Real] com valor original', () => {
    const r = importCreatureToFichas(baseCreature({ core: { nd: 25, size: 'medio', origin: { type: 'maldicao' } } }));
    const c = get(r!.id);
    expect(c.level).toBe(20);
    expect(c.passives.some((p) => p.name.includes('[ND Real]') && p.description.includes('25'))).toBe(true);
  });

  it('clampa atributos > 30 e < 1', () => {
    const r = importCreatureToFichas(baseCreature({ attributes: { forca: 99, destreza: -3, constituicao: 16, inteligencia: 18, sabedoria: 10, presenca: 8 } }));
    const c = get(r!.id);
    expect(c.attributes.find((a) => a.name === 'Força')!.value).toBe(30);
    expect(c.attributes.find((a) => a.name === 'Destreza')!.value).toBe(1);
  });

  it('clampa aptidões a 5', () => {
    const r = importCreatureToFichas(baseCreature({ aptidoes: { ea: 99, cl: 2, bar: 0, dom: 0, er: -2 } }));
    const c = get(r!.id);
    expect(c.cursedAptitudes.AU).toBe(5);
    expect(c.cursedAptitudes.ER).toBe(0);
  });
});

describe('Conversor — Classe e energia reversa', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('mapeia origin.type = feiticeiro → Feiticeiro', () => {
    const r = importCreatureToFichas(baseCreature({ core: { nd: 5, size: 'medio', origin: { type: 'feiticeiro' } } }));
    expect(get(r!.id).characterClass).toBe('Feiticeiro');
  });

  it('mapeia origin.type = maldicao → Maldição', () => {
    const r = importCreatureToFichas(baseCreature({ core: { nd: 5, size: 'medio', origin: { type: 'maldicao' } } }));
    expect(get(r!.id).characterClass).toBe('Maldição');
  });

  it('hasAumentoEnergia NÃO ativa hasEnergiaReversa (bug #12 fix)', () => {
    const r = importCreatureToFichas(baseCreature({ core: { nd: 5, size: 'medio', origin: { type: 'maldicao', hasAumentoEnergia: true } } }));
    expect(get(r!.id).hasEnergiaReversa).toBeFalsy();
  });
});

describe('Conversor — Ações: edge cases', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('ações tipo suporte → spellType buff sem damageType obrigatório', () => {
    const r = importCreatureToFichas(baseCreature({
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'Bênção', type: 'comum', attackType: 'suporte', cost: 3, range: '6m', damage: { roll: '', type: '' } },
      ] },
    }));
    const sp = get(r!.id).spells.find((s) => s.name === 'Bênção')!;
    expect(sp.spellType).toBe('buff');
    expect(sp.costPE).toBe(3);
  });

  it('ação tipo bonus mapeia actionType=bonus', () => {
    const r = importCreatureToFichas(baseCreature({
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'Reposicionar', type: 'bonus', attackType: 'suporte', cost: 0, damage: { roll: '', type: '' } },
      ] },
    }));
    const sp = get(r!.id).spells.find((s) => s.name === 'Reposicionar')!;
    expect(sp.actionType).toBe('bonus');
  });

  it('customHitBonus reflete a mediana dos toHit das ações (Bug #22)', () => {
    const r = importCreatureToFichas(baseCreature({
      actions: { total: { comum: 2, bonus: 1, reacao: 1 }, list: [
        { name: 'A', type: 'comum', attackType: 'acerto', toHit: 10, damage: { roll: '1d8', type: 'cortante' } },
        { name: 'B', type: 'comum', attackType: 'acerto', toHit: 17, damage: { roll: '2d6', type: 'perfurante' } },
      ] },
    }));
    // mediana de [10, 17] = round((10+17)/2) = 14 — evita outlier inflar o bônus
    expect(get(r!.id).customHitBonus).toBe(14);
  });

  it('opportunityMax = 0 (criatura usa apenas reactionsMax)', () => {
    const r = importCreatureToFichas(baseCreature());
    const c = get(r!.id);
    expect(c.opportunityMax).toBe(0);
    expect(c.reactionsMax).toBe(1);
  });
});

describe('Conversor — Idempotência e nomes únicos', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('duas importações sem linkedFichaId geram nomes únicos', () => {
    const r1 = importCreatureToFichas(baseCreature());
    const r2 = importCreatureToFichas(baseCreature());
    expect(r1!.id).not.toBe(r2!.id);
    const names = useCharacterStore.getState().characters.map((c) => c.name);
    expect(new Set(names).size).toBe(2);
  });

  it('reseta snapshots idempotentes para evitar drift entre re-importações', () => {
    const r = importCreatureToFichas(baseCreature());
    const c = get(r!.id) as any;
    expect(c.__anatomyAppliedSnapshot).toBeUndefined();
    expect(c.__cursedExclusiveAppliedSnapshot).toBeUndefined();
    expect(c.__dotesAppliedSnapshot).toBeUndefined();
  });
});

describe('Conversor — Robustez de entrada', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('sobrevive a criatura mínima (sem actions/defenses)', () => {
    const min = { name: 'Mínimo', core: { nd: 1, size: 'medio' }, attributes: {}, stats: { hpMax: 10, peMax: 0, defesa: 10 }, saves: {} };
    const r = importCreatureToFichas(min as any);
    expect(r).not.toBeNull();
    const c = get(r!.id);
    expect(c.hpMax).toBe(10);
    expect(c.spells).toEqual([]);
  });

  it('tipo de dano desconhecido não quebra (resulta em undefined)', () => {
    const r = importCreatureToFichas(baseCreature({
      defenses: { vulnerabilidades: [{ tipo: 'xpto-invalido' }], imunidades: [], resistencias: [], condicoesImunes: [] },
    }));
    const c = get(r!.id);
    expect(c.vulnerabilities).toEqual([]);
  });
});
