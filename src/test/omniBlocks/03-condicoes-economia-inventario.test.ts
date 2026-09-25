/**
 * LOTE 3 — Corretude semântica (15 chaves)
 *   🤕 Condições (8): tem_condicao_<id>, qtd_condicoes, e 6 categorias.
 *   💰 Economia (8 + predicates): saldo_total, saldo_padrao, saldo_pessoal,
 *      carteiras_qtd, carteiras_compartilhadas, tem_carteira_pessoal,
 *      saldo_<moeda>, tem_moeda_<moeda>.
 *   🎒 Inventário (4): qtd_itens_inventario, qtd_itens_equipados,
 *      tem_item_<id>, equipado_<id>.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetStores, makeChar, vEval } from './_helper';
import { useMoneyStore } from '@/stores/useMoneyStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import type { Character } from '@/types';

beforeEach(resetStores);

// ─── 🤕 Condições ──────────────────────────────────────────────────────
describe('Lote 3 — 🤕 Condições (8)', () => {
  it('qtd_condicoes e predicate tem_condicao_<id>', () => {
    const c0 = makeChar();
    expect(vEval(c0, 'USUARIO', 'qtd_condicoes')).toBe(0);
    expect(vEval(c0, 'USUARIO', 'tem_condicao_atordoado')).toBe(0);

    const c = makeChar({
      activeConditions: [
        { conditionId: 'atordoado' },
        { conditionId: 'envenenado' },
        { conditionId: 'cego' },
      ],
    } as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'qtd_condicoes')).toBe(3);
    expect(vEval(c, 'USUARIO', 'tem_condicao_atordoado')).toBe(1);
    expect(vEval(c, 'USUARIO', 'tem_condicao_envenenado')).toBe(1);
    expect(vEval(c, 'USUARIO', 'tem_condicao_paralisado')).toBe(0);
  });

  it('contagem por categoria (fisica / incapacitacao / mental / movimento / sensorial / vulnerabilidade)', () => {
    const c = makeChar({
      activeConditions: [
        { conditionId: 'envenenado' },   // FÍSICA
        { conditionId: 'sangramento' },  // FÍSICA
        { conditionId: 'atordoado' },    // INCAPACITAÇÃO
        { conditionId: 'amedrontado' },  // MENTAL
        { conditionId: 'agarrado' },     // MOVIMENTO
        { conditionId: 'cego' },         // SENSORIAL
        { conditionId: 'exposto' },      // VULNERABILIDADE
      ],
    } as Partial<Character>);
    expect(vEval(c, 'USUARIO', 'qtd_condicoes_fisica')).toBe(2);
    expect(vEval(c, 'USUARIO', 'qtd_condicoes_incapacitacao')).toBe(1);
    expect(vEval(c, 'USUARIO', 'qtd_condicoes_mental')).toBe(1);
    expect(vEval(c, 'USUARIO', 'qtd_condicoes_movimento')).toBe(1);
    expect(vEval(c, 'USUARIO', 'qtd_condicoes_sensorial')).toBe(1);
    expect(vEval(c, 'USUARIO', 'qtd_condicoes_vulnerabilidade')).toBe(1);
  });
});

// ─── 💰 Economia ───────────────────────────────────────────────────────
describe('Lote 3 — 💰 Economia (8)', () => {
  it('saldos zerados sem carteiras', () => {
    const c = makeChar();
    expect(vEval(c, 'USUARIO', 'saldo_total')).toBe(0);
    expect(vEval(c, 'USUARIO', 'saldo_padrao')).toBe(0);
    expect(vEval(c, 'USUARIO', 'saldo_pessoal')).toBe(0);
    expect(vEval(c, 'USUARIO', 'carteiras_qtd')).toBe(0);
    expect(vEval(c, 'USUARIO', 'carteiras_compartilhadas')).toBe(0);
    expect(vEval(c, 'USUARIO', 'tem_carteira_pessoal')).toBe(0);
  });

  it('soma saldos de TODAS as carteiras do personagem (por moeda + total)', () => {
    useMoneyStore.setState({
      currencies: [
        { id: 'yen', name: 'Yen', symbol: '¥', isDefault: true },
        { id: 'ouro', name: 'Ouro', symbol: 'O', isDefault: false },
      ],
      wallets: [
        { id: 'w1', name: 'Pessoal', members: ['hero'], isPersonal: true,
          balances: { yen: 100, ouro: 5 } },
        { id: 'w2', name: 'Grupo',   members: ['hero', 'amigo'], isPersonal: false,
          balances: { yen: 50 } },
        { id: 'w3', name: 'Outros',  members: ['amigo'], isPersonal: false,
          balances: { yen: 9999 } },
      ],
    } as never);
    const c = makeChar();
    expect(vEval(c, 'USUARIO', 'saldo_total')).toBe(155);
    expect(vEval(c, 'USUARIO', 'saldo_padrao')).toBe(150);
    expect(vEval(c, 'USUARIO', 'saldo_pessoal')).toBe(100);
    expect(vEval(c, 'USUARIO', 'carteiras_qtd')).toBe(2);
    expect(vEval(c, 'USUARIO', 'carteiras_compartilhadas')).toBe(1);
    expect(vEval(c, 'USUARIO', 'tem_carteira_pessoal')).toBe(1);
    // Predicates por moeda
    expect(vEval(c, 'USUARIO', 'saldo_yen')).toBe(150);
    expect(vEval(c, 'USUARIO', 'saldo_ouro')).toBe(5);
    expect(vEval(c, 'USUARIO', 'tem_moeda_yen')).toBe(1);
    expect(vEval(c, 'USUARIO', 'tem_moeda_ouro')).toBe(1);
  });
});

// ─── 🎒 Inventário ─────────────────────────────────────────────────────
describe('Lote 3 — 🎒 Inventário (4)', () => {
  it('vazio: zero', () => {
    const c = makeChar();
    expect(vEval(c, 'USUARIO', 'qtd_itens_inventario')).toBe(0);
    expect(vEval(c, 'USUARIO', 'qtd_itens_equipados')).toBe(0);
    expect(vEval(c, 'USUARIO', 'tem_item_potion')).toBe(0);
    expect(vEval(c, 'USUARIO', 'equipado_potion')).toBe(0);
  });

  it('conta itens do dono + equipados e expõe predicates', () => {
    useInventoryStore.setState({
      items: {
        i1: { instanceId: 'i1', ownerId: 'hero', acquiredAt: 1, isEquipped: false,
              entity: { id: 'potion' } },
        i2: { instanceId: 'i2', ownerId: 'hero', acquiredAt: 2, isEquipped: true,
              equippedSlot: 'mainHand', entity: { id: 'sword' } },
        i3: { instanceId: 'i3', ownerId: 'hero', acquiredAt: 3, isEquipped: true,
              equippedSlot: 'armor',    entity: { id: 'armor1' } },
        // de outro dono — não deve contar
        i4: { instanceId: 'i4', ownerId: 'outro', acquiredAt: 4, isEquipped: true,
              entity: { id: 'ghost' } },
      },
    } as never);
    const c = makeChar();
    expect(vEval(c, 'USUARIO', 'qtd_itens_inventario')).toBe(3);
    expect(vEval(c, 'USUARIO', 'qtd_itens_equipados')).toBe(2);
    expect(vEval(c, 'USUARIO', 'tem_item_potion')).toBe(1);
    expect(vEval(c, 'USUARIO', 'tem_item_sword')).toBe(1);
    expect(vEval(c, 'USUARIO', 'tem_item_ghost')).toBe(0);
    expect(vEval(c, 'USUARIO', 'equipado_sword')).toBe(1);
    expect(vEval(c, 'USUARIO', 'equipado_potion')).toBe(0);
  });
});
