/**
 * Auditoria forense do conversor Grimório → Ficha.
 * Foco em mutações indevidas, normalização de chaves acentuadas/case,
 * números inválidos e invariantes que protegem ficha de criatura importada.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { importCreatureToFichas } from '@/components/grimorio/convertToFicha';
import { getDefaultSavingThrowBonus, getMasteryBonus } from '@/types';

function creature(extra: any = {}) {
  return {
    name: 'Forense',
    core: { nd: 11, size: 'medio', origin: { type: 'feiticeiro' } },
    attributes: { forca: 16, destreza: 14, constituicao: 18, inteligencia: 20, sabedoria: 12, presenca: 10 },
    stats: { hpMax: 300, peMax: 40, defesa: 21, deslocamento: 9, cdBase: 19, iniciativa: 5, atencao: 4, rdGeral: 3 },
    saves: { fortitude: 15, reflexos: 12, vontade: 13, astucia: 16, integridade: 14 },
    skills: [],
    defenses: { vulnerabilidades: [], imunidades: [], resistencias: [], condicoesImunes: [] },
    aptidoes: { ea: 2, cl: 3, bar: 1, dom: 0, er: 1 },
    actions: { total: { comum: 2, bonus: 1, reacao: 1 }, list: [] },
    cdAttr: 'inteligencia',
    ...extra,
  };
}

const get = (id: string) => useCharacterStore.getState().characters.find((c) => c.id === id)!;

describe('Forense — ND/nível de criatura fica travado fora do importador', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('updateCharacter manual não altera level de INIMIGO importado', () => {
    const r = importCreatureToFichas(creature({ core: { nd: 11, size: 'medio', origin: { type: 'maldicao' } } }));
    useCharacterStore.getState().updateCharacter(r!.id, { level: 12 });
    expect(get(r!.id).level).toBe(11);
  });

  it('applyLevelUp direto no store também não altera INIMIGO', () => {
    const r = importCreatureToFichas(creature({ core: { nd: 11, size: 'medio', origin: { type: 'maldicao' } } }));
    useCharacterStore.getState().applyLevelUp(r!.id, { hpRollBase: 8, method: 'fixed' });
    const c = get(r!.id);
    expect(c.level).toBe(11);
    expect(c.levelHistory).toEqual([]);
  });

  it('reimportação vinculada ainda pode atualizar o ND definido no Grimório', () => {
    const r = importCreatureToFichas(creature({ core: { nd: 9, size: 'medio', origin: { type: 'maldicao' } } }));
    importCreatureToFichas({ ...creature({ core: { nd: 14, size: 'medio', origin: { type: 'maldicao' } } }), linkedFichaId: r!.id });
    expect(get(r!.id).level).toBe(14);
  });
});

describe('Forense — normalização de chaves com acento/case/espaço', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('atributos aceitam chaves acentuadas/maiúsculas do Grimório', () => {
    const r = importCreatureToFichas(creature({
      attributes: { Força: 24, Destreza: 13, Constituição: 22, Inteligência: 26, Sabedoria: 17, Presença: 15 },
    }));
    const c = get(r!.id);
    expect(c.attributes.find((a) => a.name === 'Força')!.value).toBe(24);
    expect(c.attributes.find((a) => a.name === 'Inteligência')!.value).toBe(26);
    expect(c.attributes.find((a) => a.name === 'Presença')!.value).toBe(15);
  });

  it('TRs aceitam chaves acentuadas/maiúsculas e preservam round-trip numérico', () => {
    const r = importCreatureToFichas(creature({ saves: { Astúcia: 19, Fortitude: 17, Reflexos: 13, Vontade: 15, Integridade: 16 } }));
    const c = get(r!.id);
    const dsb = getDefaultSavingThrowBonus(c.level);
    const intMod = Math.floor((c.attributes.find((a) => a.name === 'Inteligência')!.value - 10) / 2);
    const ast = c.savingThrows.find((s) => s.name === 'Astúcia')!;
    expect(dsb + intMod + (ast.externalBonus ?? 0)).toBe(19);
  });

  it('cdAttr com acento mapeia para o id correto', () => {
    const r = importCreatureToFichas(creature({ cdAttr: 'presença' }));
    const c = get(r!.id);
    expect(c.dcLinkedAttr).toBe(c.attributes.find((a) => a.name === 'Presença')!.id);
  });

  it('size/origin/actionType/attackType/trType aceitam maiúsculas e acentos', () => {
    const r = importCreatureToFichas(creature({
      core: { nd: 7, size: 'MÉDIO', origin: { type: 'MALDIÇÃO', hasAumentoEnergia: true } },
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'Pulso', type: 'RÁPIDA', attackType: 'TR ÁREA', cd: 20, trType: 'ASTÚCIA', damage: { roll: '2d8', type: 'energia amaldiçoada' } },
      ]},
    }));
    const c = get(r!.id);
    const sp = c.spells[0];
    expect(c.characterClass).toBe('Maldição');
    expect(c.sizeCategory).toBe('Médio');
    expect(sp.actionType).toBe('rapida');
    expect(sp.targetMode).toBe('area_tr');
    expect(sp.saveAttr).toBe('Astúcia');
    expect(sp.damageType).toBe('DNR');
  });

  it('perícia default com acento divergente é encontrada e não duplicada', () => {
    const r = importCreatureToFichas(creature({ skills: [{ name: 'Historia', mod: 9, mastered: true }] }));
    const c = get(r!.id);
    const matches = c.skills.filter((s) => s.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'historia');
    expect(matches.length).toBe(1);
    expect(matches[0].mastery).toBe(true);
  });

  it('aptidões aceitam chaves maiúsculas e não-canônicas', () => {
    const r = importCreatureToFichas(creature({ aptidoes: { EA: 4, CL: 5, BAR: 3, DOM: 2, ER: 1 } }));
    const c = get(r!.id);
    expect(c.cursedAptitudes.AU).toBe(4);
    expect(c.cursedAptitudes.CL).toBe(5);
    expect(c.cursedAptitudes.BAR).toBe(3);
  });
});

describe('Forense — sanidade numérica de combate', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('HP/PE máximos negativos são protegidos em zero', () => {
    const r = importCreatureToFichas(creature({ stats: { hpMax: -10, peMax: -5, defesa: 10, deslocamento: 9 } }));
    const c = get(r!.id);
    expect(c.hpMax).toBe(0);
    expect(c.hpCurrent).toBe(0);
    expect(c.peMax).toBe(0);
    expect(c.peCurrent).toBe(0);
  });

  it('combatState negativo não vaza para hpCurrent/peCurrent', () => {
    const r = importCreatureToFichas(creature({ combatState: { hpCurrent: -1, peCurrent: -2 } }));
    const c = get(r!.id);
    expect(c.hpCurrent).toBe(c.hpMax);
    expect(c.peCurrent).toBe(c.peMax);
  });

  it('NaN/Infinity em stats críticos usam fallback seguro', () => {
    const r = importCreatureToFichas(creature({
      stats: { hpMax: Number.NaN, peMax: Number.POSITIVE_INFINITY, defesa: Number.NaN, deslocamento: Number.NEGATIVE_INFINITY, cdBase: Number.NaN, rdGeral: Number.NaN },
    }));
    const c = get(r!.id);
    expect(Number.isFinite(c.hpMax)).toBe(true);
    expect(Number.isFinite(c.peMax)).toBe(true);
    expect(c.ca).toBe(10);
    expect(c.baseDC).toBe(10);
    expect(c.rd).toBe(0);
    expect(c.movement).toBe(9);
  });

  it('ações totais negativas ou inválidas não criam contadores negativos', () => {
    const r = importCreatureToFichas(creature({
      actions: { total: { comum: -3, bonus: Number.NaN, reacao: -1, rapida: -1, movimento: Number.NaN }, list: [] },
    }));
    const c = get(r!.id);
    expect(c.actionsMax).toBe(0);
    expect(c.bonusActionsMax).toBe(1);
    expect(c.reactionsMax).toBe(0);
    expect(c.passives.some((p) => p.name === '[Ações Extras]')).toBe(false);
  });

  it('cost negativo de ação vira 0', () => {
    const r = importCreatureToFichas(creature({
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'Sem custo negativo', type: 'comum', attackType: 'acerto', cost: -7, damage: { roll: '1d4', type: 'cortante' } },
      ]},
    }));
    expect(get(r!.id).spells[0].costPE).toBe(0);
  });
});

describe('Forense — mapeamentos e descrições completas', () => {
  beforeEach(() => useCharacterStore.setState({ characters: [] } as any, false));

  it('RD nivel com acento/case é reconhecida', () => {
    const r = importCreatureToFichas(creature({
      defenses: { vulnerabilidades: [], imunidades: [], resistencias: [{ tipo: 'queimante', nivel: 'MÉDIA' }], condicoesImunes: [] },
    }));
    expect(get(r!.id).passives.find((p) => p.name.startsWith('[Resistência]'))!.bonusRdByType?.DQ).toBe(5);
  });

  it('condição por nome acentuado/case vira id canônico', () => {
    const r = importCreatureToFichas(creature({
      actions: { total: { comum: 1, bonus: 1, reacao: 1 }, list: [
        { name: 'Derrubar', type: 'comum', attackType: 'tr_individual', conditions: [{ name: 'CAÍDO', durationRounds: 2 }], damage: {} },
      ]},
    }));
    expect(get(r!.id).spells[0].conditions?.[0].conditionId).toBe('caido');
  });

  it('tipo de dano com hífen/espaço é normalizado', () => {
    const r = importCreatureToFichas(creature({
      defenses: { vulnerabilidades: [{ tipo: 'energia-reversa' }], imunidades: [], resistencias: [], condicoesImunes: [] },
    }));
    expect(get(r!.id).vulnerabilities).toContain('DNR');
  });

  it('stats avançados zerados não criam passiva fantasma', () => {
    const r = importCreatureToFichas(creature({
      stats: { hpMax: 50, peMax: 10, defesa: 14, deslocamento: 9, guardaInabavalMax: 0, rdIrredutivel: 0, ignorarRd: 0, vidaTempPorAtaque: 0, resistenciaParcialMax: 0, resistenciaTotalMax: 0, espaco: 0 },
    }));
    expect(get(r!.id).passives.some((p) => p.name === '[Stats de Maldição]')).toBe(false);
  });

  it('perícia default mantém round-trip mesmo com mastered true em nome com case divergente', () => {
    const r = importCreatureToFichas(creature({ skills: [{ name: 'feitiçaria', mod: 23, mastered: true }] }));
    const c = get(r!.id);
    const sk = c.skills.find((s) => s.name === 'Feitiçaria')!;
    const intMod = Math.floor((c.attributes.find((a) => a.name === 'Inteligência')!.value - 10) / 2);
    expect(Math.floor(c.level / 2) + intMod + 2 * getMasteryBonus(c.level) + (sk.externalBonus ?? 0)).toBe(23);
  });
});
