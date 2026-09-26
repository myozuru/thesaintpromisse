import { describe, it, expect, beforeEach } from 'vitest';
import {
  MOBILIDADE_ID, REPERTORIO_ID, aceitarMobilidade, definirBonusRepertorio, findMobilidadeReactors,
  getRepertorioPendentes, getRepertorioSlots, reduceMobilidadeMessage, resetarRepertorio, treinarRepertorio,
  viewerSeesMobilidade,
} from '@/lib/suporteRepertorioMobilidade';
import { combatMoveBudget, effectiveMovement, reactionMoveBudget } from '@/lib/movementBudget';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { getSpecAbilitiesFor, validateSpecAbilityCatalog } from '@/lib/specAbilities';
import { useCharacterStore } from '@/stores/useCharacterStore';
import type { Character } from '@/types';

const get = (id: string) => useCharacterStore.getState().characters.find((c) => c.id === id)!;
const skills = () => [
  { id: 'a', name: 'Atletismo', value: 0, trained: false },
  { id: 'b', name: 'Medicina', value: 0, trained: true },
  { id: 'c', name: 'Furtividade', value: 0, trained: false },
];
const mk = (p: Partial<Character>) => ({
  category: 'PLAYER', level: 2, hpCurrent: 10, hpMax: 10, peCurrent: 10, peMax: 10, movement: 9,
  slotsCurrent: 0, slotsMax: 10, reactionsCurrent: 1, attributes: [], skills: skills(), savingThrows: [],
  passives: [], ...p,
}) as unknown as Character;
const withAb = (id: string) => ({ chosenSpecAbilities: [{ abilityId: id, chosenAtLevel: 2 }] });
const seed = (...cs: Character[]) => useCharacterStore.setState({ characters: cs } as never);

describe('Catálogo (Nv 2 — 5º par)', () => {
  it('Expandir Repertório e Mobilidade Avançada no tier 2; catálogo válido', () => {
    const ids = getSpecAbilitiesFor('Suporte').filter((a) => a.tier === 2).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining([REPERTORIO_ID, MOBILIDADE_ID]));
    expect(validateSpecAbilityCatalog()).toEqual([]);
  });
});

describe('Expandir Repertório', () => {
  beforeEach(() => seed(mk({ id: 's', level: 12, ...withAb(REPERTORIO_ID) })));

  it('perícias = metade do bônus de treinamento, para baixo; 0 sem a habilidade', () => {
    for (const lv of [1, 5, 9, 12, 15]) {
      expect(getRepertorioSlots(mk({ level: lv, ...withAb(REPERTORIO_ID) }))).toBe(Math.floor(getTrainingBonusByLevel(lv) / 2));
    }
    expect(getRepertorioSlots(mk({ level: 15 }))).toBe(0);
  });

  it('treina perícia não treinada, bloqueia já treinada e respeita o limite', () => {
    const slots = getRepertorioSlots(get('s'));
    expect(treinarRepertorio(get('s'), 'Medicina').ok).toBe(false);
    expect(treinarRepertorio(get('s'), 'Atletismo').ok).toBe(true);
    expect(get('s').skills.find((x) => x.name === 'Atletismo')!.trained).toBe(true);
    expect(getRepertorioPendentes(get('s'))).toBe(slots - 1);
    if (slots === 1) expect(treinarRepertorio(get('s'), 'Furtividade').ok).toBe(false);
  });

  it('+2 vai em qualquer perícia (inclusive a treinada aqui), só uma vez, e refazer desfaz tudo', () => {
    treinarRepertorio(get('s'), 'Atletismo');
    expect(definirBonusRepertorio(get('s'), 'Atletismo').ok).toBe(true);
    expect(get('s').skills.find((x) => x.name === 'Atletismo')!.externalBonus).toBe(2);
    expect(definirBonusRepertorio(get('s'), 'Medicina').ok).toBe(false);
    resetarRepertorio(get('s'));
    const at = get('s').skills.find((x) => x.name === 'Atletismo')!;
    expect(at.trained).toBe(false);
    expect(at.externalBonus).toBe(0);
    expect(get('s').skills.find((x) => x.name === 'Medicina')!.trained).toBe(true);
  });
});

describe('Mobilidade Avançada', () => {
  it('+3 m no movimento (antes da sobrecarga)', () => {
    expect(effectiveMovement(mk({ ...withAb(MOBILIDADE_ID) }))).toBe(12);
    expect(effectiveMovement(mk({}))).toBe(9);
    expect(effectiveMovement(mk({ ...withAb(MOBILIDADE_ID), slotsCurrent: 11 }))).toBe(6);
  });

  it('só Suportes jogadores vivos com reação reagem a um aliado jogador caído', () => {
    const all = [
      mk({ id: 'f', hpCurrent: 0 }),
      mk({ id: 'ok', ...withAb(MOBILIDADE_ID) }),
      mk({ id: 'semReacao', ...withAb(MOBILIDADE_ID), reactionsCurrent: 0 }),
      mk({ id: 'caido', ...withAb(MOBILIDADE_ID), hpCurrent: 0 }),
      mk({ id: 'npc', category: 'NPC', ...withAb(MOBILIDADE_ID) } as never),
      mk({ id: 'sem' }),
    ];
    expect(findMobilidadeReactors('f', all).map((c) => c.id)).toEqual(['ok']);
    expect(findMobilidadeReactors('npc', all)).toEqual([]);
  });

  it('aceitar gasta a reação e libera metade do movimento fora do turno', () => {
    seed(mk({ id: 's', ...withAb(MOBILIDADE_ID) }));
    expect(combatMoveBudget(get('s'), false)).toBeNull();
    const r = aceitarMobilidade('s', 4);
    expect(r).toMatchObject({ ok: true, meters: 6 });
    expect(get('s').reactionsCurrent).toBe(0);
    // já tinha usado 4 m no próprio turno: orçamento = 4 + 6
    expect(reactionMoveBudget(get('s'))).toBe(10);
    expect(aceitarMobilidade('s', 0).ok).toBe(false);
  });

  it('pergunta vai ao dono da ficha; mensagens entre telas', () => {
    expect(viewerSeesMobilidade('p1', { role: 'PLAYER', profileId: 'p1' })).toBe(true);
    expect(viewerSeesMobilidade('p1', { role: 'PLAYER', profileId: 'p2' })).toBe(false);
    expect(viewerSeesMobilidade(null, { role: 'MASTER', profileId: 'm' })).toBe(false);
    const see = () => true;
    expect(reduceMobilidadeMessage({ clientId: 'me', kind: 'offer', supporterId: 's', fallenId: 'f' }, 'me', see).type).toBe('ignore');
    expect(reduceMobilidadeMessage({ clientId: 'x', kind: 'offer', supporterId: 's', fallenId: 'f' }, 'me', see))
      .toEqual({ type: 'open', offer: { supporterId: 's', fallenId: 'f' } });
    expect(reduceMobilidadeMessage({ clientId: 'x', kind: 'offer', supporterId: 's', fallenId: 'f' }, 'me', () => false).type).toBe('ignore');
    expect(reduceMobilidadeMessage({ clientId: 'x', kind: 'close', supporterId: 's' }, 'me', see)).toEqual({ type: 'close', supporterId: 's' });
  });
});
