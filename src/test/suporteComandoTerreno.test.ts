import { describe, it, expect, beforeEach } from 'vitest';
import {
  COMANDO_ID, DESVENDAR_ID, darComando, definirCDDesvendar, getDesvendarFase,
  pedirDesvendar, pendingDesvendar, resolverDesvendar, cancelarDesvendar,
} from '@/lib/suporteComandoTerreno';
import { consumeFlatBonusFor, expireGrantedBy } from '@/lib/omni/rollAdvantage';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { getSpecAbilitiesFor, validateSpecAbilityCatalog } from '@/lib/specAbilities';
import { useCharacterStore } from '@/stores/useCharacterStore';
import type { Character } from '@/types';

const get = (id: string) => useCharacterStore.getState().characters.find((c) => c.id === id)!;
const mk = (p: Partial<Character>) => ({
  category: 'PLAYER', level: 5, hpCurrent: 10, hpMax: 10, peCurrent: 10, peMax: 10,
  attributes: [], skills: [], savingThrows: [], passives: [], rdByType: {}, ca: 10, ...p,
}) as unknown as Character;
const withAb = (id: string) => ({ chosenSpecAbilities: [{ abilityId: id, chosenAtLevel: 2 }] });
const TB = getTrainingBonusByLevel(5);

beforeEach(() => {
  useCharacterStore.setState({ characters: [
    mk({ id: 's', name: 'Sup', ...withAb(COMANDO_ID), ...withAb(DESVENDAR_ID),
      chosenSpecAbilities: [{ abilityId: COMANDO_ID, chosenAtLevel: 2 }, { abilityId: DESVENDAR_ID, chosenAtLevel: 2 }] } as Partial<Character>),
    mk({ id: 'a', name: 'Aliado' }),
    mk({ id: 'n', name: 'Inimigo', category: 'NPC' } as Partial<Character>),
  ] });
});

describe('Catálogo', () => {
  it('ambas no tier 2 e catálogo válido', () => {
    const ids = getSpecAbilitiesFor('Suporte').filter((a) => a.tier === 2).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining([COMANDO_ID, DESVENDAR_ID]));
    expect(validateSpecAbilityCatalog()).toEqual([]);
  });
});

describe('Comando Motivador', () => {
  it('paga 2 PE e dá +TB na próxima rolagem qualquer, só uma vez', () => {
    expect(darComando(get('s'), get('a'), 'Ataque!').ok).toBe(true);
    expect(get('s').peCurrent).toBe(8);
    expect(consumeFlatBonusFor('a', { kind: 'attack', subtype: 'melee' }).bonus).toBe(TB);
    expect(consumeFlatBonusFor('a', { kind: 'skill', name: 'Atletismo' }).bonus).toBe(0);
  });
  it('também vale para perícia/TR', () => {
    darComando(get('s'), get('a'), '');
    expect(consumeFlatBonusFor('a', { kind: 'save', name: 'Reflexos' }).bonus).toBe(TB);
  });
  it('expira no início do próximo turno do Suporte', () => {
    darComando(get('s'), get('a'), '');
    expireGrantedBy('s');
    expect(consumeFlatBonusFor('a', { kind: 'any' }).bonus).toBe(0);
  });
  it('bloqueia sem PE, em si mesmo e em não aliados', () => {
    expect(darComando(get('s'), get('s'), '').ok).toBe(false);
    expect(darComando(get('s'), get('n'), '').ok).toBe(false);
    useCharacterStore.getState().updateCharacter('s', { peCurrent: 1 });
    expect(darComando(get('s'), get('a'), '').ok).toBe(false);
    expect(get('s').peCurrent).toBe(1);
  });
});

describe('Desvendar Terreno', () => {
  it('fluxo: pedir → Mestre define CD → sucesso dá bônus de cena', () => {
    expect(pedirDesvendar(get('s')).ok).toBe(true);
    expect(getDesvendarFase(get('s'))).toBe('aguardando-cd');
    expect(pendingDesvendar(useCharacterStore.getState().characters).map((c) => c.id)).toEqual(['s']);
    expect(definirCDDesvendar('s', 0).ok).toBe(false);
    expect(definirCDDesvendar('s', 15).ok).toBe(true);
    expect(getDesvendarFase(get('s'))).toBe('pronto-para-rolar');
    const r = resolverDesvendar(get('s'), 16);
    expect(r).toMatchObject({ success: true, cd: 15, bonus: TB });
    expect(getDesvendarFase(get('s'))).toBe('ativo');
    expect(pedirDesvendar(get('s')).ok).toBe(false);
  });
  it('falha não dá bônus e permite tentar de novo', () => {
    pedirDesvendar(get('s')); definirCDDesvendar('s', 20);
    expect(resolverDesvendar(get('s'), 12).success).toBe(false);
    expect(getDesvendarFase(get('s'))).toBe('idle');
  });
  it('não rola sem CD; cancelar limpa o pedido', () => {
    pedirDesvendar(get('s'));
    expect(resolverDesvendar(get('s'), 30).ok).toBe(false);
    cancelarDesvendar('s');
    expect(getDesvendarFase(get('s'))).toBe('idle');
  });
  it('fim de cena zera o bônus', () => {
    pedirDesvendar(get('s')); definirCDDesvendar('s', 10); resolverDesvendar(get('s'), 20);
    const st = useCharacterStore.getState() as unknown as Record<string, () => void>;
    const reset = st.resetScene ?? st.endScene ?? st.resetSceneState;
    if (reset) { reset(); expect(getDesvendarFase(get('s'))).toBe('idle'); }
  });
  it('sem a habilidade não pede', () => {
    expect(pedirDesvendar(get('a')).ok).toBe(false);
  });
});
