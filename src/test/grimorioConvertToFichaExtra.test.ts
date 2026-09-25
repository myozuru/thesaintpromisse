/**
 * Verificações exaustivas adicionais do conversor Grimório → Ficha.
 * Cobre passivas geradas, condições, ações sem dano, re-importação,
 * stats avançados, ações extras, notas, condições com nivel, etc.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { importCreatureToFichas } from '@/components/grimorio/convertToFicha';
import { ALL_CONDITIONS } from '@/types';

function mk(extra: any = {}) {
  return {
    name: 'Corpus',
    core: { nd: 8, size: 'medio', origin: { type: 'feiticeiro' } },
    attributes: { forca: 14, destreza: 14, constituicao: 16, inteligencia: 18, sabedoria: 12, presenca: 10 },
    stats: { hpMax: 150, peMax: 30, defesa: 18, deslocamento: 9, cdBase: 17 },
    saves: { fortitude: 10, reflexos: 9, vontade: 11, astucia: 12, integridade: 8 },
    skills: [],
    defenses: { vulnerabilidades: [], imunidades: [], resistencias: [], condicoesImunes: [] },
    aptidoes: { ea: 2, cl: 1, bar: 0, dom: 0, er: 0 },
    actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [] },
    ...extra,
  };
}
const get = (id: string) => useCharacterStore.getState().characters.find((c) => c.id === id)!;

describe('Passivas geradas — features/dotes/treinamentos/aptidoesEspeciais', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('cada lista é convertida em passiva com prefixo correto', () => {
    const r = importCreatureToFichas(mk({
      features: [{ name: 'Visão', description: 'Vê no escuro' }],
      dotes: [{ name: 'Garras', description: '+1 crit' }],
      treinamentos: [{ name: 'Atletismo Avançado', description: '+5' }],
      aptidoesEspeciais: [{ name: 'Rasante', description: 'voo' }],
    }));
    const c = get(r!.id);
    expect(c.passives.some((p) => p.name === '[Característica] Visão')).toBe(true);
    expect(c.passives.some((p) => p.name === '[Dote] Garras')).toBe(true);
    expect(c.passives.some((p) => p.name === '[Treinamento] Atletismo Avançado')).toBe(true);
    expect(c.passives.some((p) => p.name === '[Apt. Amaldiçoada] Rasante')).toBe(true);
  });

  it('ignora entradas sem name nem description', () => {
    const r = importCreatureToFichas(mk({ features: [{}] }));
    const c = get(r!.id);
    expect(c.passives.filter((p) => p.name.startsWith('[Característica]')).length).toBe(0);
  });
});

describe('Passivas — Stats avançados de Maldição', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('agrega todos os campos em uma única passiva [Stats de Maldição]', () => {
    const r = importCreatureToFichas(mk({
      stats: { hpMax: 200, peMax: 40, defesa: 19, deslocamento: 9, cdBase: 17,
        guardaInabavalMax: 30, rdIrredutivel: 5, ignorarRd: 4,
        vidaTempPorAtaque: 3, resistenciaParcialMax: 2, resistenciaTotalMax: 1, espaco: 3 },
    }));
    const p = get(r!.id).passives.find((x) => x.name === '[Stats de Maldição]')!;
    expect(p).toBeTruthy();
    expect(p.description).toMatch(/Guarda Inabalável: 30/);
    expect(p.description).toMatch(/RD Irredutível: 5/);
    expect(p.description).toMatch(/Ignorar RD: 4/);
    expect(p.description).toMatch(/Vida Temp\/Ataque: 3/);
    expect(p.description).toMatch(/Resist\. Parcial: 2/);
    expect(p.description).toMatch(/Resist\. Total: 1/);
    expect(p.description).toMatch(/Espaço: 3m/);
  });

  it('não cria a passiva quando nenhum stat avançado está presente', () => {
    const r = importCreatureToFichas(mk());
    expect(get(r!.id).passives.some((p) => p.name === '[Stats de Maldição]')).toBe(false);
  });
});

describe('Passivas — Ações extras e notas', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('agrega rápidas/movimento em passiva [Ações Extras]', () => {
    const r = importCreatureToFichas(mk({
      actions: { total: { comum: 1, bonus: 1, reacao: 1, rapida: 3, movimento: 2 }, list: [] },
    }));
    const p = get(r!.id).passives.find((x) => x.name === '[Ações Extras]')!;
    expect(p.description).toMatch(/Rápidas: 3/);
    expect(p.description).toMatch(/Movimento: 2/);
  });

  it('inclui narratorNotes como passiva [Notas do Mestre]', () => {
    const r = importCreatureToFichas(mk({ narratorNotes: 'Cuidado, sangra.' }));
    expect(get(r!.id).passives.some((p) => p.name === '[Notas do Mestre]' && p.description.includes('sangra'))).toBe(true);
  });
});

describe('Imunidades a condições e RD numérica', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('passiva [Imune a Condições] traduz ids para nomes amigáveis', () => {
    const r = importCreatureToFichas(mk({
      defenses: { vulnerabilidades: [], imunidades: [], resistencias: [], condicoesImunes: ['atordoado', 'enfraquecido'] },
    }));
    const p = get(r!.id).passives.find((x) => x.name === '[Imune a Condições]')!;
    const expectedName = ALL_CONDITIONS.find((c) => c.id === 'atordoado')?.name ?? 'atordoado';
    expect(p.description).toContain(expectedName);
  });

  it('RD nivel fraca → 2, extrema → 20', () => {
    const r = importCreatureToFichas(mk({
      defenses: { vulnerabilidades: [], imunidades: [],
        resistencias: [{ tipo: 'cortante', nivel: 'fraca' }, { tipo: 'perfurante', nivel: 'extrema' }],
        condicoesImunes: [] },
    }));
    const c = get(r!.id);
    const fraca = c.passives.find((p) => p.bonusRdByType?.DCO === 2);
    const extr = c.passives.find((p) => p.bonusRdByType?.DP === 20);
    expect(fraca).toBeTruthy();
    expect(extr).toBeTruthy();
  });

  it('RD com nivel desconhecido é ignorada', () => {
    const r = importCreatureToFichas(mk({
      defenses: { vulnerabilidades: [], imunidades: [],
        resistencias: [{ tipo: 'cortante', nivel: 'monstruosa' }], condicoesImunes: [] },
    }));
    expect(get(r!.id).passives.some((p) => p.name.startsWith('[Resistência]'))).toBe(false);
  });

  it('mapeia energia_reversa → DNR em vulnerabilidades', () => {
    const r = importCreatureToFichas(mk({
      defenses: { vulnerabilidades: [{ tipo: 'energia_reversa' }], imunidades: [], resistencias: [], condicoesImunes: [] },
    }));
    expect(get(r!.id).vulnerabilities).toContain('DNR');
  });
});

describe('Ações sem dano e edge cases de spells', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('ação sem damage.roll gera spell com damageDice vazio sem quebrar', () => {
    const r = importCreatureToFichas(mk({
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'Olhar Sombrio', type: 'comum', attackType: 'tr_individual',
          cd: 18, trType: 'vontade', damage: {} },
      ]},
    }));
    const sp = get(r!.id).spells.find((s) => s.name === 'Olhar Sombrio')!;
    expect(sp.damageDice).toBe('');
    expect(sp.damageType).toBeUndefined();
    expect(sp.targetMode).toBe('single_tr');
    expect(sp.saveAttr).toBe('Vontade');
  });

  it('saveAttr e bonusDC undefined quando trType/cd ausentes', () => {
    const r = importCreatureToFichas(mk({
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'Soco', type: 'comum', attackType: 'acerto', toHit: 8,
          damage: { roll: '1d6', type: 'impacto' } },
      ]},
    }));
    const sp = get(r!.id).spells.find((s) => s.name === 'Soco')!;
    expect(sp.bonusDC).toBeUndefined();
    expect(sp.saveAttr).toBeUndefined();
    expect(sp.damageType).toBe('DI');
  });

  it('condição via id direto (sem name) é traduzida', () => {
    const r = importCreatureToFichas(mk({
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'Tropeço', type: 'bonus', attackType: 'tr_individual',
          cd: 15, trType: 'reflexos',
          conditions: [{ id: 'caido', durationRounds: 1 }],
          damage: {} },
      ]},
    }));
    const sp = get(r!.id).spells.find((s) => s.name === 'Tropeço')!;
    expect(sp.conditions?.[0].conditionId).toBe('caido');
    expect(sp.conditions?.[0].durationRounds).toBe(1);
  });

  it('ação tipo livre/movimento/rapida/reacao mapeia actionType correto', () => {
    const r = importCreatureToFichas(mk({
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'Livre', type: 'livre', attackType: 'suporte', damage: {} },
        { name: 'Mov', type: 'movimento', attackType: 'suporte', damage: {} },
        { name: 'Rap', type: 'rapida', attackType: 'suporte', damage: {} },
        { name: 'Reac', type: 'reacao', attackType: 'suporte', damage: {} },
      ]},
    }));
    const sps = get(r!.id).spells;
    expect(sps.find((s) => s.name === 'Livre')!.actionType).toBe('free');
    expect(sps.find((s) => s.name === 'Mov')!.actionType).toBe('movimento');
    expect(sps.find((s) => s.name === 'Rap')!.actionType).toBe('rapida');
    expect(sps.find((s) => s.name === 'Reac')!.actionType).toBe('reaction');
  });

  it('action sem name é descartada', () => {
    const r = importCreatureToFichas(mk({
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        {}, { name: '' }, { name: 'Real', type: 'comum', attackType: 'acerto', damage: {} },
      ]},
    }));
    expect(get(r!.id).spells.length).toBe(1);
  });

  it('TR Astúcia/Integridade mapeadas no saveAttr', () => {
    const r = importCreatureToFichas(mk({
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'A', type: 'comum', attackType: 'tr_individual', cd: 14, trType: 'astucia', damage: {} },
        { name: 'B', type: 'comum', attackType: 'tr_individual', cd: 14, trType: 'integridade', damage: {} },
      ]},
    }));
    const sps = get(r!.id).spells;
    expect(sps.find((s) => s.name === 'A')!.saveAttr).toBe('Astúcia');
    expect(sps.find((s) => s.name === 'B')!.saveAttr).toBe('Integridade');
  });
});

describe('Perícias — heurísticas de atributo e treinada vs maestria', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('perícia ausente no template é adicionada com linkedAttribute coerente', () => {
    const r = importCreatureToFichas(mk({
      skills: [{ name: 'Atletismo', mod: 12, mastered: false }],
    }));
    const c = get(r!.id);
    const atl = c.skills.find((s) => s.name === 'Atletismo')!;
    const forcaId = c.attributes.find((a) => a.name === 'Força')!.id;
    expect(atl.linkedAttribute).toBe(forcaId);
  });

  it('mastered=false não recebe maestria nem treinamento', () => {
    const r = importCreatureToFichas(mk({
      skills: [{ name: 'Percepção', mod: 5, mastered: false }],
    }));
    const perc = get(r!.id).skills.find((s) => s.name === 'Percepção')!;
    expect(perc.mastery).toBe(false);
    expect(perc.trained).toBe(false);
  });

  it('perícia desconhecida cai em Destreza por default', () => {
    const r = importCreatureToFichas(mk({
      skills: [{ name: 'PericiaInventada', mod: 7, mastered: true }],
    }));
    const c = get(r!.id);
    const sk = c.skills.find((s) => s.name === 'PericiaInventada')!;
    const desId = c.attributes.find((a) => a.name === 'Destreza')!.id;
    expect(sk.linkedAttribute).toBe(desId);
  });
});

describe('Re-importação — não duplica passivas/spells e atualiza estado', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('re-importar substitui a lista de passivas (não acumula)', () => {
    const r1 = importCreatureToFichas(mk({
      features: [{ name: 'X', description: 'x' }],
    }));
    const cre2: any = {
      ...mk({ features: [{ name: 'Y', description: 'y' }] }),
      linkedFichaId: r1!.id,
    };
    importCreatureToFichas(cre2);
    const c = get(r1!.id);
    expect(c.passives.some((p) => p.name === '[Característica] X')).toBe(false);
    expect(c.passives.some((p) => p.name === '[Característica] Y')).toBe(true);
  });

  it('re-importar substitui a lista de spells', () => {
    const r1 = importCreatureToFichas(mk({
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'Antigo', type: 'comum', attackType: 'acerto', damage: { roll: '1d4', type: 'cortante' } },
      ]},
    }));
    const cre2: any = {
      ...mk({ actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'Novo', type: 'comum', attackType: 'acerto', damage: { roll: '2d6', type: 'perfurante' } },
      ]}}),
      linkedFichaId: r1!.id,
    };
    importCreatureToFichas(cre2);
    const c = get(r1!.id);
    expect(c.spells.some((s) => s.name === 'Antigo')).toBe(false);
    expect(c.spells.find((s) => s.name === 'Novo')!.damageType).toBe('DP');
  });

  it('re-importar com linkedFichaId inválido cria nova ficha', () => {
    const cre: any = { ...mk(), linkedFichaId: 'id-inexistente' };
    const r = importCreatureToFichas(cre);
    expect(r!.created).toBe(true);
  });
});

describe('Movimento — sobrecarga não interfere na importação', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('slots não são alterados (criatura não tem mochila)', () => {
    const r = importCreatureToFichas(mk({ stats: { hpMax: 100, peMax: 10, defesa: 16, deslocamento: 9 } }));
    const c = get(r!.id);
    expect(c.slotsCurrent ?? 0).toBeLessThanOrEqual(c.slotsMax ?? 0);
  });
});
