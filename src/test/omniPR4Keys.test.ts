/**
 * PR-4 — Auditoria: Economia, Tempo/Calendário, Inventário, funções de rolagem.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { avaliarFormula } from '@/lib/omni/parser';
import { montarVariaveisDoPersonagem } from '@/lib/omni/resolvedor';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useChronosStore } from '@/stores/useChronosStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import type { Character } from '@/types';

const base: Character = {
  id: 'pr4-hero',
  name: 'Hero',
  level: 3,
  trainingBonus: 2,
  hpCurrent: 20, hpMax: 20,
  peCurrent: 10, peMax: 10,
  ca: 10, movement: 9,
  category: 'PLAYER',
  attributes: [], skills: [], savingThrows: [],
} as unknown as Character;

const resolver = (c: Character, key: string) =>
  avaliarFormula(`@USUARIO.${key}`, montarVariaveisDoPersonagem(c)).valor;

describe('PR-4 — Economia', () => {
  beforeEach(() => {
    useMoneyStore.getState().resetAll();
  });

  it('sem carteira → saldos zero', () => {
    expect(resolver(base, 'saldo_total')).toBe(0);
    expect(resolver(base, 'carteiras_qtd')).toBe(0);
    expect(resolver(base, 'tem_carteira_pessoal')).toBe(0);
  });

  it('com carteira pessoal e grant do mestre → saldos refletidos', () => {
    const wid = useMoneyStore.getState().ensurePersonalWallet(base.id, base.name);
    useMoneyStore.getState().masterGrant(wid, 'yen', 500, 'teste');
    expect(resolver(base, 'saldo_padrao')).toBe(500);
    expect(resolver(base, 'saldo_total')).toBe(500);
    expect(resolver(base, 'saldo_pessoal')).toBe(500);
    expect(resolver(base, 'tem_carteira_pessoal')).toBe(1);
    expect(resolver(base, 'tem_moeda_yen')).toBe(1);
    expect(resolver(base, 'saldo_yen')).toBe(500);
  });
});

describe('PR-4 — Tempo & Calendário', () => {
  it('CENA.hora/dia refletem o chronos store', () => {
    useChronosStore.getState().setTime(22, 30, 0);
    useChronosStore.getState().setDate(15, 6, 2);
    const evalC = (k: string) => avaliarFormula(`@CENA.${k}`, montarVariaveisDoPersonagem(base)).valor;
    expect(evalC('hora')).toBe(22);
    expect(evalC('dia')).toBe(15);
    expect(evalC('mes')).toBe(6);
    expect(evalC('ano')).toBe(2);
    expect(evalC('eh_noite')).toBe(1);
    expect(evalC('eh_dia')).toBe(0);
  });

  it('eh_amanhecer entre 05h e 07h', () => {
    useChronosStore.getState().setTime(6, 0, 0);
    const evalC = (k: string) => avaliarFormula(`@CENA.${k}`, montarVariaveisDoPersonagem(base)).valor;
    expect(evalC('eh_amanhecer')).toBe(1);
    expect(evalC('eh_noite')).toBe(0);
  });
});

describe('PR-4 — Inventário', () => {
  beforeEach(() => useInventoryStore.getState().resetAll());

  it('zerado por padrão', () => {
    expect(resolver(base, 'qtd_itens_inventario')).toBe(0);
    expect(resolver(base, 'qtd_itens_equipados')).toBe(0);
  });

  it('add → conta itens e predicate tem_item_<id>', () => {
    useInventoryStore.getState().add(base.id, {
      id: 'espada-curta', nome: 'Espada Curta', tipo: 'arma',
    } as unknown as Parameters<ReturnType<typeof useInventoryStore.getState>['add']>[1]);
    expect(resolver(base, 'qtd_itens_inventario')).toBe(1);
    expect(resolver(base, 'tem_item_espada_curta')).toBe(1);
  });
});

describe('PR-4 — Funções de rolagem', () => {
  it('rand(min,max) dentro do intervalo', () => {
    for (let i = 0; i < 20; i++) {
      const v = avaliarFormula('rand(1, 6)', {}).valor;
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
  it('coin() retorna 0 ou 1', () => {
    for (let i = 0; i < 20; i++) {
      const v = avaliarFormula('coin()', {}).valor;
      expect([0, 1]).toContain(v);
    }
  });
  it('d(20) entre 1 e 20', () => {
    for (let i = 0; i < 20; i++) {
      const v = avaliarFormula('d(20)', {}).valor;
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(20);
    }
  });
});
