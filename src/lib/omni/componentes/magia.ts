import type { Character } from '@/types';
import { ALL_CONDITIONS } from '@/types/conditions';
import type { DadoComposto, DadosComposicao, RegistroComposto } from './avaliar';
import { recursoComposto } from './recursos';

export function dadosMagia(c: Character, bag: Record<string, number>): DadosComposicao {
  const n = (k: string) => bag[k] ?? 0;
  const spells = c.spells ?? [], buffs = c.activeBuffs ?? [], conditions = c.activeConditions ?? [];
  const feiticos = spells.map(s => ({ id: s.id, valor: s.costPE, campos: { custo: s.costPE,
    dano: s.spellType === 'damage', cura: s.spellType === 'heal', buff: s.spellType === 'buff', condicao: s.spellType === 'condition',
    prontos: Boolean((s as unknown as { isPrepared?: boolean }).isPrepared), elemento: s.damageType ?? '', nivel: s.spellLevel,
  } }));
  const ativos = buffs.map(b => ({ id: b.id, valor: b.value, campos: { ativos: true, sustentados: Boolean(b.isSustained), custo: b.peCostPerRound ?? 0 } }));
  const condicoes = conditions.map(a => {
    const cat = ALL_CONDITIONS.find(d => d.id === a.conditionId)?.category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return { id: a.conditionId, valor: true, campos: { idade: a.elapsedRounds ?? 0, idade_conhecida: a.elapsedRounds !== undefined,
      restante: a.remainingRounds, restantes: a.remainingRounds,
      ...Object.fromEntries(Object.entries({ fisicas: 'fisica', incapacitacao: 'incapacitacao', mentais: 'mental', movimento: 'movimento', sensoriais: 'sensorial', vulnerabilidade: 'vulnerabilidade' }).map(([k, v]) => [k, v === cat])) } };
  });
  const aptidoes = [...(c.chosenAuraAptitudes ?? []), ...(c.chosenClAptitudes ?? []), ...(c.chosenAptitudes ?? [])];
  const idAptidao = (a: unknown): string => typeof a === 'string' ? a : String((a as { id?: string })?.id ?? '');
  const habilidades = (c.chosenSpecAbilities ?? []).map(a => a.abilityId ?? (a as unknown as { id: string }).id);
  const aptidaoCampos = Object.fromEntries(['au','cl','bar','dom','er'].map(k => [k, n(k.toUpperCase())]));
  const custos = spells.map(s => s.costPE);
  const limiteCustos: RegistroComposto = { campos: { max: custos.length ? Math.max(...custos) : 0,
    maximo: custos.length ? Math.max(...custos) : 0, minimo: custos.length ? Math.min(...custos) : 0 } };
  const selecionados: Record<string, DadoComposto> = {
    feiticos, feitico: { registros: Object.fromEntries(feiticos.map(f => [f.id, f])), campos: {
      pronto: feiticos.filter(f => f.campos.prontos), anterior: c.lastSpellUsedId ? { id: c.lastSpellUsedId, valor: true } : undefined } },
    buffs: ativos,
    buff: { registros: Object.fromEntries(buffs.map((b, i) => [b.spellName, ativos[i]])) },
    condicoes, condicao: { padrao: { valor: false, existe: false, campos: { idade: -1, idade_conhecida: false, restante: -1, restantes: -1 } }, registros: Object.fromEntries(condicoes.map(x => [x.id, x])) },
    concentracao: { quantidade: n('QTD_CONCENTRANDO'), campos: { max: n('MAX_CONCENTRACAO'), maximo: n('MAX_CONCENTRACAO'), livre: n('SLOTS_CONCENTRACAO_LIVRES') } },
    sustentacao: { quantidade: buffs.filter(b => b.isSustained).length,
      campos: { max: n('MAX_SUSTENTADOS'), maximo: n('MAX_SUSTENTADOS'), livre: Math.max(0, n('MAX_SUSTENTADOS') - buffs.filter(b => b.isSustained).length),
        rodada: { campos: { custo: buffs.filter(b => b.isSustained).reduce((s, b) => s + (b.peCostPerRound ?? 0), 0) } } } },
    aptidao: { registros: Object.fromEntries(aptidoes.map(a => [idAptidao(a), { id: idAptidao(a), valor: true }])), campos: aptidaoCampos },
    aptidoes: aptidoes.map(a => ({ id: idAptidao(a), campos: { aura: (c.chosenAuraAptitudes ?? []).some(x => idAptidao(x) === idAptidao(a)) } })),
    talentos: (c.chosenTalents ?? []).map(t => ({ id: t.id, campos: { combate: /combate|arma|ataque|defes/i.test(t.id) } })),
    talento: { registros: Object.fromEntries((c.chosenTalents ?? []).map(t => [t.id, { id: t.id, valor: true }])) },
    habilidade: { registros: Object.fromEntries(habilidades.map(id => [id, { id, valor: true }])) },
    habilidades: habilidades.map(id => ({ id, campos: { especializacao: true } })),
    aura: { campos: { concentrada: n('AU_CONCENTRADA'), defesa: { campos: { bonus: n('AURA_CA_BONUS') } },
      furtividade: { campos: { bonus: n('AURA_FURTIVIDADE_BONUS') } }, agarrar: { campos: { bonus: n('AURA_AGARRAR_BONUS') } } } },
    pe: recursoComposto(n('PE'), n('PE_MAX'), { temporario: { valor: n('PE_TEMP'), campos: { rodada: n('PE_TEMP_POR_RODADA') } }, feitico: limiteCustos }),
  };
  return { selecoes: selecionados };
}
