import { describe, it, expect, beforeEach } from 'vitest';
import {
  OTIMIZACAO_ID, PROTETOR_ID, applyProtetor, findProtetor, getOtimizacaoSlotsBonus,
  getProtetorDice, getProtetorMod, hasShieldEquipped, protetorRefund, reduceProtetorMessage,
  useProtetorPromptStore,
} from '@/lib/suporteProtetor';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { getSpecAbilitiesFor, validateSpecAbilityCatalog } from '@/lib/specAbilities';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { createFakeMesa } from '@/test/helpers/fakeMesa';
import type { Character } from '@/types';

const get = (id: string) => useCharacterStore.getState().characters.find((c) => c.id === id)!;
const mk = (p: Partial<Character>) => ({
  category: 'PLAYER', level: 2, hpCurrent: 10, hpMax: 10, peCurrent: 10, peMax: 10,
  escCurrent: 0, escMax: 0,
  attributes: [], skills: [], savingThrows: [], passives: [], rdByType: {}, ca: 10, baseDC: 15, ...p,
}) as unknown as Character;

const grid = { dpi: 70, metersPerCell: 1.5 };
const ent = (characterId: string, x: number, y: number) => ({ characterId, x, y, w: 70, h: 70 });
const withAb = (id: string) => ({ chosenSpecAbilities: [{ abilityId: id, chosenAtLevel: 2 }] });
const shielded = { equippedShieldId: 'sh-leve' };

describe('Catálogo do Suporte (Nv 2 — 3º par)', () => {
  it('tem Otimização de Espaço e Protetor no tier 2 e o catálogo continua válido', () => {
    const ids = getSpecAbilitiesFor('Suporte').filter((a) => a.tier === 2).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining([OTIMIZACAO_ID, PROTETOR_ID]));
    expect(validateSpecAbilityCatalog()).toEqual([]);
  });
});

describe('Otimização de Espaço', () => {
  it('espaços extras = bônus de treinamento; zero sem a habilidade', () => {
    const c = mk({ id: 's', level: 5, ...withAb(OTIMIZACAO_ID) });
    expect(getOtimizacaoSlotsBonus(c)).toBe(getTrainingBonusByLevel(5));
    expect(getOtimizacaoSlotsBonus(mk({ id: 'x', level: 5 }))).toBe(0);
    expect(getOtimizacaoSlotsBonus(mk({ id: 'y', level: 12, ...withAb(OTIMIZACAO_ID) })).toBeGreaterThan(
      getOtimizacaoSlotsBonus(c),
    );
  });
});

describe('Protetor — dados e requisitos', () => {
  it('Xd10 com X = bônus de treinamento; mod = atributo-chave', () => {
    const c = mk({ id: 's', level: 6, keyAttribute: 'Presença', attributes: [{ id: 'pre', name: 'Presença', value: 16 }] });
    expect(getProtetorDice(c)).toEqual({ count: getTrainingBonusByLevel(6), sides: 10 });
    expect(getProtetorMod(c)).toBe(3);
  });

  it('exige escudo equipado', () => {
    expect(hasShieldEquipped(mk({ id: 's', ...shielded }))).toBe(true);
    expect(hasShieldEquipped(mk({ id: 's' }))).toBe(false);
    expect(hasShieldEquipped(mk({ id: 's', equippedShieldId: 'inexistente' }))).toBe(false);
  });
});

describe('Protetor — elegibilidade (1,5 m)', () => {
  const sup = () => mk({ id: 's', name: 'Sup', ...withAb(PROTETOR_ID), ...shielded });
  const alvo = () => mk({ id: 'a', name: 'Alvo' });

  it('oferece a aliado adjacente, não a 3 m', () => {
    const all = [sup(), alvo()];
    expect(findProtetor('a', all, { s: ent('s', 0, 0), a: ent('a', 70, 0) }, grid)?.id).toBe('s');
    expect(findProtetor('a', all, { s: ent('s', 0, 0), a: ent('a', 140, 0) }, grid)).toBeNull();
  });

  it('exige habilidade, escudo, PE e peças no mapa; não protege a si mesmo nem NPC', () => {
    expect(findProtetor('a', [mk({ id: 's', ...shielded }), alvo()], { s: ent('s', 0, 0), a: ent('a', 70, 0) }, grid)).toBeNull();
    expect(findProtetor('a', [mk({ id: 's', ...withAb(PROTETOR_ID) }), alvo()], { s: ent('s', 0, 0), a: ent('a', 70, 0) }, grid)).toBeNull();
    expect(findProtetor('a', [{ ...sup(), peCurrent: 0 }, alvo()], { s: ent('s', 0, 0), a: ent('a', 70, 0) }, grid)).toBeNull();
    expect(findProtetor('a', [sup(), alvo()], { s: ent('s', 0, 0) }, grid)).toBeNull();
    expect(findProtetor('s', [sup()], { s: ent('s', 0, 0) }, grid)).toBeNull();
    const npc = { ...alvo(), category: 'ENEMY' } as unknown as Character;
    expect(findProtetor('a', [sup(), npc], { s: ent('s', 0, 0), a: ent('a', 70, 0) }, grid)).toBeNull();
  });
});

describe('Protetor — reembolso e aplicação', () => {
  it('cobre HP primeiro, depois Escudo, limitado ao dano sofrido', () => {
    expect(protetorRefund({ hpLost: 5, escLost: 3 }, 10)).toEqual({ hpBack: 5, escBack: 3 });
    expect(protetorRefund({ hpLost: 5, escLost: 3 }, 6)).toEqual({ hpBack: 5, escBack: 1 });
    expect(protetorRefund({ hpLost: 0, escLost: 4 }, 10)).toEqual({ hpBack: 0, escBack: 4 });
    expect(protetorRefund({ hpLost: 5, escLost: 0 }, 2)).toEqual({ hpBack: 2, escBack: 0 });
  });

  it('aplicar paga 1 PE e devolve PV/Escudo sem estourar o máximo', () => {
    useCharacterStore.setState({
      characters: [
        supProtetor(),
        mk({ id: 'a', name: 'Alvo', hpCurrent: 3, hpMax: 10, escCurrent: 0, escMax: 4 }),
      ],
    });
    const res = applyProtetor(
      { supporterId: 's', targetId: 'a', damageDealt: 9, hpLost: 6, escLost: 3 },
      8,
    );
    expect(res.ok).toBe(true);
    expect(res).toMatchObject({ hpBack: 6, escBack: 2 });
    expect(get('s').peCurrent).toBe(9);
    expect(get('a').hpCurrent).toBe(9);
    expect(get('a').escCurrent).toBe(2);
  });

  it('sem PE, falha sem gastar nem curar', () => {
    useCharacterStore.setState({
      characters: [{ ...supProtetor(), peCurrent: 0 }, mk({ id: 'a', hpCurrent: 3 })],
    });
    const res = applyProtetor({ supporterId: 's', targetId: 'a', damageDealt: 5, hpLost: 5, escLost: 0 }, 10);
    expect(res.ok).toBe(false);
    expect(get('a').hpCurrent).toBe(3);
  });
});

const supProtetor = () => mk({ id: 's', name: 'Sup', ...withAb(PROTETOR_ID), ...shielded });

describe('Protetor — roteamento multiplayer (mesa simulada)', () => {
  beforeEach(() => useProtetorPromptStore.getState().close());

  it('oferta chega só ao dono do Suporte; close fecha todos', () => {
    const mesa = createFakeMesa(['mestre', 'dona', 'outro']);
    const offer = { supporterId: 's', targetId: 'a', damageDealt: 7, hpLost: 7, escLost: 0 };
    mesa.send('mestre', { kind: 'offer', ...offer });
    const canSee = { mestre: () => false, dona: () => true, outro: () => false };
    const seen = mesa.deliver((clientId, msg) => reduceProtetorMessage(msg, clientId, (sid) => canSee[clientId as keyof typeof canSee](sid)));
    expect(seen.dona).toEqual({ type: 'open', offer });
    expect(seen.mestre).toEqual({ type: 'ignore' });
    expect(seen.outro).toEqual({ type: 'ignore' });

    mesa.send('dona', { kind: 'close' });
    const closed = mesa.deliver((clientId, msg) => reduceProtetorMessage(msg, clientId, () => true));
    expect(closed.mestre).toEqual({ type: 'close' });
    expect(closed.outro).toEqual({ type: 'close' });
  });

  it('ignora mensagens inválidas e as da própria tela', () => {
    expect(reduceProtetorMessage(null, 'x', () => true)).toEqual({ type: 'ignore' });
    expect(reduceProtetorMessage({ clientId: 'x', kind: 'offer' }, 'x', () => true)).toEqual({ type: 'ignore' });
    expect(reduceProtetorMessage({ kind: 'offer', supporterId: 's' }, 'x', () => true)).toEqual({ type: 'ignore' });
  });
});
