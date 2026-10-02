import { describe, expect, it } from 'vitest';
import { efeitosParaScript, parseOmniScript } from '@/lib/omni/omniScript';
import { avaliarFormula } from '@/lib/omni/parser';
import { canonicalizarChave } from '@/lib/omni/keyAliases';
import type { CombatEffect } from '@/lib/omni/tipos';
import { DAMAGE_TYPES } from '@/types';
import { DICIONARIO_AUTOCOMPLETE } from '@/lib/omni/dicionarioAutocomplete';

function roundtrip(efeitos: CombatEffect[], defaultTarget: CombatEffect['target'] = 'ALVO') {
  const script = efeitosParaScript(efeitos, { defaultTarget });
  const parsed = parseOmniScript(script, { defaultTarget });
  expect(parsed.erros, script).toEqual([]);
  return parsed.efeitos;
}
const hit = (damageType?: string): CombatEffect => ({ id: 'hit', type: 'SUBTRAIR', target: 'ALVO', resourcePath: 'vida', formula: '@DANO.valor_final + @ALVO.forca', damageType });

describe('Tipo de dano no terminal e na conversão de efeitos salvos', () => {
  it.each(DAMAGE_TYPES)('mantém %s após converter para texto e reabrir', tipo => {
    const [r] = roundtrip([hit(tipo)]);
    expect(r.damageType).toBe(tipo);
    expect(r.target).toBe('ALVO');
    expect(canonicalizarChave(r.resourcePath)).toBe('vida');
    expect(r.formula).toBe(hit().formula);
    expect(DICIONARIO_AUTOCOMPLETE.some(s => s.valor === tipo && s.categoria === 'Tipo de dano')).toBe(true);
  });
  it.each(['Fogo', 'Verdadeiro', 'Integridade da Alma', 'Tipo antigo, com espaços; e vírgula'])('preserva o valor legado %s', tipo => {
    expect(roundtrip([hit(tipo)])[0].damageType).toBe(tipo);
  });
  it('script antigo sem tipo continua sem tipo', () => {
    const parsed = parseOmniScript('subtrair 2d6 em vida');
    expect(parsed.erros).toEqual([]);
    expect(parsed.efeitos[0].damageType).toBeUndefined();
    expect(roundtrip([hit()])[0].damageType).toBeUndefined();
  });
  it('aceita código explícito, mas diagnostica erro de digitação', () => {
    expect(parseOmniScript('subtrair 2d6 em vida tipo DQ').efeitos[0].damageType).toBe('DQ');
    expect(parseOmniScript('subtrair 2d6 em vida tipo DO').erros).toHaveLength(1);
  });
  it.each(['botao "a\\q"', 'subtrair 1 em vida tipo "a\\q"'])('aspas inválidas geram erro em vez de lançar exceção: %s', script => {
    expect(parseOmniScript(script).erros).toHaveLength(1);
  });
});

describe('Reconstrução dos gatilhos e das keys especiais', () => {
  it('vários comandos sob um gatilho continuam juntos ao editar/reabrir', () => {
    const effects: CombatEffect[] = [{ ...hit('DQ'), trigger: 'aoCausarDano', condition: '@USUARIO.pe > 0' }, { ...hit('DI'), id: 'hit2', trigger: 'aoCausarDano', condition: '@USUARIO.pe > 0' }];
    const r = roundtrip(effects);
    expect(r).toHaveLength(2);
    for (const eff of r) {
      expect(eff.trigger).toBe('aoCausarDano');
      expect(avaliarFormula(eff.condition!, { USUARIO_PE: 1 }).valor).toBe(1);
      expect(avaliarFormula(eff.condition!, { USUARIO_PE: 0 }).valor).toBe(0);
    }
    expect(r.map(e => e.damageType)).toEqual(['DQ', 'DI']);
  });
  it('mantém watchers e tetos de contador nos comandos agrupados', () => {
    const parsed = parseOmniScript('quando vida <= 25% -> (somar 1 em contador_rancor ate treino por_fonte, somar 2 em pe)', { defaultTarget: 'USUARIO' });
    expect(parsed.erros).toEqual([]);
    const r = roundtrip(parsed.efeitos, 'USUARIO');
    expect(r).toHaveLength(2);
    expect(r[0].counterCap).toBe(parsed.efeitos[0].counterCap);
    expect(r[0].counterPerSource).toBe(true);
    expect(r.map(e => e.watcher)).toEqual(parsed.efeitos.map(e => e.watcher));
  });
  it('preserva condições, duração e alvo explícito', () => {
    const [r] = roundtrip([{ id: 'cond', type: 'MODIFICADOR', target: 'USUARIO', formula: '0', conditionApply: { id: 'cego', mode: 'apply', durationTurns: 2, durationRounds: -1 } }]);
    expect(r.target).toBe('USUARIO');
    expect(r.conditionApply).toEqual({ id: 'cego', mode: 'apply', durationTurns: 2, durationRounds: -1 });
  });
  it('preserva botão, texto com separadores e alvo', () => {
    const label = 'Ação (teste), @fim_turno -> x; e aplicar "cego"';
    const [r] = roundtrip([{ id: 'btn', type: 'MODIFICADOR', target: 'USUARIO', formula: '0', buttonOnly: { label } }]);
    expect(r.buttonOnly?.label).toBe(label);
    expect(r.target).toBe('USUARIO');
  });
  it('preserva imunidade, revogação e filtros de redução de PE', () => {
    const r = roundtrip([
      { id: 'imu', type: 'MODIFICADOR', target: 'USUARIO', formula: '0', immunityGrant: { escopo: 'categoria:MENTAL', mode: 'grant' } },
      { id: 'unimu', type: 'MODIFICADOR', target: 'ALVO', formula: '0', immunityGrant: { escopo: 'condicao:cego', mode: 'revoke' } },
      { id: 'pe', type: 'MODIFICADOR', target: 'USUARIO', formula: '@USUARIO.treino', peSpellReduction: { filtro: 'nivel:1-3&tipo:damage', min: 1 } },
    ]);
    expect(r[0].immunityGrant).toEqual({ escopo: 'categoria:MENTAL', mode: 'grant' });
    expect(r[1].immunityGrant).toEqual({ escopo: 'condicao:cego', mode: 'revoke' });
    expect(r[2].peSpellReduction).toEqual({ filtro: 'nivel:1-3&tipo:damage', min: 1 });
    expect(r.map(e => e.target)).toEqual(['USUARIO', 'ALVO', 'USUARIO']);
  });
  it('mantém switches aninhados, contexto DANO, vários subcomandos e tipos próprios', () => {
    const nested: CombatEffect = { id: 'root', type: 'MODIFICADOR', target: 'USUARIO', formula: '@DANO.valor_final', diceSwitch: { dice: '@DANO.valor_final', branches: [{ values: [1, 3], effects: [
      { ...hit('DQ'), target: 'USUARIO' },
      { id: 'inner', type: 'MODIFICADOR', target: 'ALVO', formula: '1d1', diceSwitch: { dice: '1d1', branches: [{ values: [1], effects: [{ ...hit('DI') }, { ...hit('DV'), id: 'hit2' }] }] } },
    ] }, { values: [2], effects: [] }] } };
    const [r] = roundtrip([nested]);
    expect(r.target).toBe('USUARIO');
    expect(r.diceSwitch?.dice).toBe('@DANO.valor_final');
    expect(r.diceSwitch?.branches[0].effects).toHaveLength(2);
    expect(r.diceSwitch?.branches[0].effects[0]).toMatchObject({ target: 'USUARIO', damageType: 'DQ' });
    const child = r.diceSwitch?.branches[0].effects[1];
    expect(child?.target).toBe('ALVO');
    expect(child?.diceSwitch?.branches[0].effects.map(e => e.damageType)).toEqual(['DI', 'DV']);
    expect(r.diceSwitch?.branches[1].effects).toEqual([]);
  });
});
