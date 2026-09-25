import { describe, it, expect, beforeEach } from 'vitest';
import { parseOmniScript } from '@/lib/omni/omniScript';
import { executarCombatEffect } from '@/lib/omni/executarSubEfeito';
import { useCharacterStore } from '@/stores/useCharacterStore';

function makeChar(overrides: Partial<{ id: string; name: string; hpCurrent: number; hpMax: number }> = {}) {
  return {
    id: overrides.id ?? 'c1',
    name: overrides.name ?? 'Tester',
    hpCurrent: overrides.hpCurrent ?? 50,
    hpMax: overrides.hpMax ?? 100,
    activeConditions: [] as Array<{ id: string; conditionId: string; name: string; icon: string; remainingTurns: number; remainingRounds: number }>,
  };
}

describe('OmniScript: aplicar/remover condição', () => {
  it('parseia "aplicar morto" → conditionApply mode=apply', () => {
    const r = parseOmniScript('aplicar morto');
    expect(r.erros).toEqual([]);
    expect(r.efeitos).toHaveLength(1);
    expect(r.efeitos[0].conditionApply).toEqual({ id: 'morto', mode: 'apply' });
  });

  it('aceita alias "aplicar morte" → morto', () => {
    const r = parseOmniScript('aplicar morte');
    expect(r.erros).toEqual([]);
    expect(r.efeitos[0].conditionApply?.id).toBe('morto');
  });

  it('aceita nome amigável "aplicar Cego"', () => {
    const r = parseOmniScript('aplicar Cego');
    expect(r.erros).toEqual([]);
    expect(r.efeitos[0].conditionApply?.id).toBe('cego');
  });

  it('parseia "remover surdo em alvo"', () => {
    const r = parseOmniScript('remover surdo em alvo');
    expect(r.erros).toEqual([]);
    expect(r.efeitos[0].conditionApply).toEqual({ id: 'surdo', mode: 'remove' });
    expect(r.efeitos[0].target).toBe('ALVO');
  });

  it('rejeita condição desconhecida com mensagem útil', () => {
    const r = parseOmniScript('aplicar zumbificado');
    expect(r.efeitos).toHaveLength(0);
    expect(r.erros[0].mensagem).toMatch(/Condição desconhecida/i);
  });
});

describe('OmniScript: rolar XdY entao ( branches )', () => {
  it('parseia rolagem-switch com branches simples', () => {
    const r = parseOmniScript(
      'rolar 1d4 entao ( 1: aplicar morto, 2: aplicar cego, 3: aplicar surdo, 4: somar 100 em vida )',
    );
    expect(r.erros).toEqual([]);
    expect(r.efeitos).toHaveLength(1);
    const ds = r.efeitos[0].diceSwitch!;
    expect(ds.dice).toBe('1d4');
    expect(ds.branches).toHaveLength(4);
    expect(ds.branches[0]).toEqual({
      values: [1],
      effects: expect.arrayContaining([expect.objectContaining({ conditionApply: { id: 'morto', mode: 'apply' } })]),
    });
    expect(ds.branches[3].effects[0].formula).toContain('100');
  });

  it('aceita ranges (1-3) e múltiplos valores (1|2|5)', () => {
    const r = parseOmniScript('rolar 1d6 entao ( 1-3: aplicar cego, 4|5: aplicar surdo, 6: aplicar morto )');
    expect(r.erros).toEqual([]);
    const branches = r.efeitos[0].diceSwitch!.branches;
    expect(branches[0].values).toEqual([1, 2, 3]);
    expect(branches[1].values).toEqual([4, 5]);
    expect(branches[2].values).toEqual([6]);
  });

  it('combina com gatilho e condição: "se vida menor que 40 entao rolar 1d4 entao ( ... )"', () => {
    const r = parseOmniScript(
      'se vida menor que 40 entao rolar 1d4 entao ( 1: aplicar morto, 2: aplicar cego, 3: aplicar surdo, 4: somar 100 em vida )',
    );
    expect(r.erros).toEqual([]);
    expect(r.efeitos).toHaveLength(1);
    expect(r.efeitos[0].condition).toBeTruthy();
    expect(r.efeitos[0].diceSwitch).toBeTruthy();
  });

  it('orienta o usuário quando esquece os parênteses', () => {
    const r = parseOmniScript('rolar 1d4 entao 1: aplicar morto, 2: aplicar cego');
    expect(r.efeitos).toHaveLength(0);
    expect(r.erros[0].mensagem).toMatch(/parênteses/i);
  });
});

describe('OmniScript: botao "<rótulo>"', () => {
  it('parseia botao com rótulo', () => {
    const r = parseOmniScript('botao "Rolar Tabela"');
    expect(r.erros).toEqual([]);
    expect(r.efeitos[0].buttonOnly?.label).toBe('Rolar Tabela');
  });

  it('parseia botao sem rótulo', () => {
    const r = parseOmniScript('botão');
    expect(r.erros).toEqual([]);
    expect(r.efeitos[0].buttonOnly).toBeDefined();
  });
});

describe('Runtime executarCombatEffect: conditionApply', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [makeChar() as never] });
  });

  it('aplica condição cego no alvo', () => {
    const efeito = parseOmniScript('aplicar cego em usuario').efeitos[0];
    const r = executarCombatEffect(efeito, {
      usuarioId: 'c1',
      usuarioVars: {},
    });
    expect(r.aplicado).toBe(1);
    const c = useCharacterStore.getState().characters.find((x) => x.id === 'c1')!;
    expect(c.activeConditions?.some((cd) => cd.conditionId === 'cego')).toBe(true);
  });

  it('remover limpa todas as instâncias da condição', () => {
    useCharacterStore.setState({
      characters: [
        {
          ...makeChar(),
          activeConditions: [
            { id: 'a', conditionId: 'cego', name: 'Cego', icon: '🙈', remainingTurns: -1, remainingRounds: -1 },
            { id: 'b', conditionId: 'surdo', name: 'Surdo', icon: '🔇', remainingTurns: -1, remainingRounds: -1 },
          ],
        } as never,
      ],
    });
    const efeito = parseOmniScript('remover cego em usuario').efeitos[0];
    executarCombatEffect(efeito, { usuarioId: 'c1', usuarioVars: {} });
    const c = useCharacterStore.getState().characters.find((x) => x.id === 'c1')!;
    expect(c.activeConditions?.map((cd) => cd.conditionId)).toEqual(['surdo']);
  });
});

describe('Runtime executarCombatEffect: diceSwitch', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [makeChar() as never] });
  });

  it('despacha para a branch correta (mock Math.random)', () => {
    const efeito = parseOmniScript(
      'rolar 1d4 entao ( 1: aplicar morto em usuario, 2: aplicar cego em usuario, 3: aplicar surdo em usuario, 4: aplicar caido em usuario )',
    ).efeitos[0];
    // Math.random < 1/4 → roll = 1 (a fórmula 1d4 usa Math.floor(rand*4)+1)
    const orig = Math.random;
    try {
      Math.random = () => 0.0; // → 1
      executarCombatEffect(efeito, { usuarioId: 'c1', usuarioVars: {} });
      const c = useCharacterStore.getState().characters.find((x) => x.id === 'c1')!;
      expect(c.activeConditions?.some((cd) => cd.conditionId === 'morto')).toBe(true);
    } finally {
      Math.random = orig;
    }
  });

  it('com Math.random = 0.99 cai na última branch', () => {
    const efeito = parseOmniScript(
      'rolar 1d4 entao ( 1: aplicar morto em usuario, 4: aplicar caido em usuario )',
    ).efeitos[0];
    const orig = Math.random;
    try {
      Math.random = () => 0.99; // → 4
      executarCombatEffect(efeito, { usuarioId: 'c1', usuarioVars: {} });
      const c = useCharacterStore.getState().characters.find((x) => x.id === 'c1')!;
      expect(c.activeConditions?.some((cd) => cd.conditionId === 'caido')).toBe(true);
    } finally {
      Math.random = orig;
    }
  });
});

describe('Runtime executarCombatEffect: buttonOnly', () => {
  it('é no-op silencioso (não muta personagem)', () => {
    useCharacterStore.setState({ characters: [makeChar() as never] });
    const efeito = parseOmniScript('botao "Acionar"').efeitos[0];
    const r = executarCombatEffect(efeito, { usuarioId: 'c1', usuarioVars: {} });
    expect(r.aplicado).toBe(0);
    expect(r.detalhe).toMatch(/Acionar/);
  });
});
