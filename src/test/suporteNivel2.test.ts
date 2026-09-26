import { describe, it, expect, beforeEach } from 'vitest';
import {
  AMIZADE_ID, ANALISE_ID, amizadeEndTurnTarget, canAnalisar, canChooseAmigo, getAnaliseCD,
  getAnaliseDiscoveries, getCreatureND, liberarTrocaAmigo, performAnalise, setAmigo, getAnaliseTraits,
} from '@/lib/suporteNivel2';
import { getSpecAbilitiesFor, validateSpecAbilityCatalog } from '@/lib/specAbilities';
import { useCharacterStore } from '@/stores/useCharacterStore';
import type { Character } from '@/types';

const get = (id: string) => useCharacterStore.getState().characters.find((c) => c.id === id)!;
const mk = (p: Partial<Character>) => ({
  category: 'PLAYER', level: 2, hpCurrent: 10, hpMax: 10, peCurrent: 5, actionsCurrent: 1,
  attributes: [], skills: [], savingThrows: [], passives: [], rdByType: {}, ...p,
}) as unknown as Character;

const grid = { dpi: 70, metersPerCell: 1.5 };
const ent = (characterId: string, x: number, y: number) => ({ characterId, x, y, w: 70, h: 70 });

describe('Catálogo do Suporte', () => {
  it('tem as duas habilidades de 2º nível e o catálogo continua válido', () => {
    const ids = getSpecAbilitiesFor('Suporte').filter((a) => a.tier === 2).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining([AMIZADE_ID, ANALISE_ID]));
    expect(validateSpecAbilityCatalog()).toEqual([]);
  });
});

describe('Amizade Inquebrável', () => {
  const sup = () => get('s');
  beforeEach(() => {
    useCharacterStore.setState({
      characters: [
        mk({ id: 's', name: 'Sup', chosenSpecAbilities: [{ abilityId: AMIZADE_ID, chosenAtLevel: 2 }] }),
        mk({ id: 'a', name: 'Amigo' }),
        mk({ id: 'b', name: 'Outro' }),
        mk({ id: 'n', name: 'Npc', category: 'NPC' } as Partial<Character>),
      ],
    });
  });

  it('só aceita aliado Jogador e fica permanente', () => {
    expect(setAmigo(sup(), get('n')).ok).toBe(false);
    expect(setAmigo(sup(), get('s')).ok).toBe(false);
    expect(setAmigo(sup(), get('a')).ok).toBe(true);
    expect(canChooseAmigo(sup())).toBe(false);
    expect(setAmigo(sup(), get('b')).ok).toBe(false);
  });

  it('Mestre libera a troca e ela trava de novo após escolher', () => {
    setAmigo(sup(), get('a'));
    liberarTrocaAmigo(sup());
    expect(canChooseAmigo(sup())).toBe(true);
    expect(setAmigo(sup(), get('b')).ok).toBe(true);
    expect(sup().suporteAmigoId).toBe('b');
    expect(canChooseAmigo(sup())).toBe(false);
  });

  it('Apoiar grátis só a até 1,5 m e com o Amigo vivo', () => {
    setAmigo(sup(), get('a'));
    const all = useCharacterStore.getState().characters;
    expect(amizadeEndTurnTarget(sup(), all, { 1: ent('s', 35, 35), 2: ent('a', 105, 105) }, grid)?.id).toBe('a');
    expect(amizadeEndTurnTarget(sup(), all, { 1: ent('s', 35, 35), 2: ent('a', 175, 35) }, grid)).toBeNull();
    expect(amizadeEndTurnTarget(sup(), all, { 1: ent('s', 35, 35) }, grid)).toBeNull();
    useCharacterStore.getState().updateCharacter('a', { hpCurrent: 0 });
    expect(amizadeEndTurnTarget(sup(), useCharacterStore.getState().characters, { 1: ent('s', 35, 35), 2: ent('a', 105, 35) }, grid)).toBeNull();
  });

  it('sem a habilidade, nada acontece', () => {
    const plain = mk({ id: 'x', suporteAmigoId: 'a' });
    expect(amizadeEndTurnTarget(plain, [plain, get('a')], { 1: ent('x', 35, 35), 2: ent('a', 105, 35) }, grid)).toBeNull();
  });
});

describe('Análise Profunda', () => {
  beforeEach(() => {
    useCharacterStore.setState({
      characters: [
        mk({ id: 's', name: 'Sup', chosenSpecAbilities: [{ abilityId: ANALISE_ID, chosenAtLevel: 2 }] }),
        mk({ id: 'e', name: 'Inimigo', category: 'NPC', level: 5 } as Partial<Character>),
      ],
    });
  });

  it('CD = 15 + ND (inclusive ND real acima de 20)', () => {
    expect(getAnaliseCD(get('e'))).toBe(20);
    const big = mk({ level: 20, passives: [{ name: '[ND Real]', description: 'ND original: 24 (clampado…)' }] as never });
    expect(getCreatureND(big)).toBe(24);
  });

  it('1 característica no sucesso, +1 a cada 5 excedentes', () => {
    expect(getAnaliseDiscoveries(19, 20)).toBe(0);
    expect(getAnaliseDiscoveries(20, 20)).toBe(1);
    expect(getAnaliseDiscoveries(24, 20)).toBe(1);
    expect(getAnaliseDiscoveries(25, 20)).toBe(2);
    expect(getAnaliseDiscoveries(31, 20)).toBe(3);
  });

  it('paga 1 PE, gasta a Ação Comum em combate e trava o alvo na cena', () => {
    const r = performAnalise(get('s'), get('e'), 26, true);
    expect(r).toMatchObject({ ok: true, cd: 20, discoveries: 2 });
    expect(get('s').peCurrent).toBe(4);
    expect(get('s').actionsCurrent).toBe(0);
    expect(canAnalisar(get('s'), get('e'), false).ok).toBe(false);
    useCharacterStore.getState().resetSceneForCharacter('s');
    expect(canAnalisar(get('s'), get('e'), false).ok).toBe(true);
  });

  it('bloqueia sem PE ou sem ação em combate; fora de combate não gasta ação', () => {
    useCharacterStore.getState().updateCharacter('s', { actionsCurrent: 0 });
    expect(canAnalisar(get('s'), get('e'), true).ok).toBe(false);
    expect(performAnalise(get('s'), get('e'), 10, false).ok).toBe(true);
    expect(get('s').actionsCurrent).toBe(0);
    useCharacterStore.getState().updateCharacter('s', { peCurrent: 0, analiseProfundaAlvos: [] });
    expect(canAnalisar(get('s'), get('e'), false).reason).toMatch(/PE/);
  });

  it('lista características com valores reais', () => {
    const t = getAnaliseTraits(mk({ hpCurrent: 7, hpMax: 30, ca: 15 } as Partial<Character>));
    expect(t.find((x) => x.key === 'pv')?.value).toBe('7/30 PV');
    expect(t.find((x) => x.key === 'ca')?.value).toBe('CA 15');
  });
});
