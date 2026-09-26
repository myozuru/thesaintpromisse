import { describe, it, expect, beforeEach } from 'vitest';
import {
  TRANSMITIR_ID,
  expireTransmitir,
  getTransmitirAliados,
  getTransmitirLimite,
  getTransmitirOpcoes,
  podeTransmitir,
  transmitir,
} from '@/lib/suporteTransmitir';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { getSpecAbilitiesFor, validateSpecAbilityCatalog } from '@/lib/specAbilities';
import { useCharacterStore } from '@/stores/useCharacterStore';
import type { Character } from '@/types';

const get = (id: string) => useCharacterStore.getState().characters.find((c) => c.id === id)!;
const mk = (p: Partial<Character>) => ({
  category: 'PLAYER', level: 2, hpCurrent: 10, hpMax: 10, peCurrent: 10, peMax: 10,
  escCurrent: 0, escMax: 0,
  attributes: [], skills: [], savingThrows: [], passives: [], rdByType: {}, ca: 10, baseDC: 15, ...p,
}) as unknown as Character;
const withAb = { chosenSpecAbilities: [{ abilityId: TRANSMITIR_ID, chosenAtLevel: 2 }] };
const sk = (name: string, trained = false) => ({ id: name, name, trained, value: 0, linkedAttribute: 'Sabedoria' });

describe('Catálogo — Transmitir Conhecimento', () => {
  it('está no tier 2 do Suporte e o catálogo continua válido', () => {
    const ids = getSpecAbilitiesFor('Suporte').filter((a) => a.tier === 2).map((a) => a.id);
    expect(ids).toContain(TRANSMITIR_ID);
    expect(validateSpecAbilityCatalog()).toEqual([]);
  });
});

describe('Transmitir Conhecimento — limites', () => {
  it('descanso curto = ⌊BT/2⌋ aliados; longo = BT; zero sem a habilidade', () => {
    const bt = getTrainingBonusByLevel(5);
    const c = mk({ id: 's', level: 5, ...withAb });
    expect(getTransmitirLimite(c, 'curto')).toBe(Math.floor(bt / 2));
    expect(getTransmitirLimite(c, 'longo')).toBe(bt);
    expect(getTransmitirLimite(mk({ id: 'x', level: 5 }), 'longo')).toBe(0);
  });

  it('opções = apenas perícias treinadas do Suporte', () => {
    const c = mk({ id: 's', ...withAb, skills: [sk('Medicina', true), sk('Furtividade')] });
    expect(getTransmitirOpcoes(c)).toEqual(['Medicina']);
  });
});

describe('Transmitir Conhecimento — concessão', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [] });
  });

  const setup = () => {
    const sup = mk({ id: 's', name: 'Sup', level: 5, ...withAb, skills: [sk('Medicina', true), sk('Percepção', true)] });
    const a1 = mk({ id: 'a1', name: 'Ana', skills: [sk('Medicina'), sk('Percepção')] });
    const a2 = mk({ id: 'a2', name: 'Beto', skills: [sk('Medicina')] });
    const a3 = mk({ id: 'a3', name: 'Caio', skills: [sk('Medicina')] });
    useCharacterStore.setState({ characters: [sup, a1, a2, a3] });
    return { sup, a1, a2, a3 };
  };

  it('concede treinamento temporário e registra o aliado na sessão', () => {
    const { sup, a1 } = setup();
    const r = transmitir(sup, a1, 'Medicina', 'longo');
    expect(r.ok).toBe(true);
    expect(get('a1').skills.find((s) => s.name === 'Medicina')!.trained).toBe(true);
    expect(get('a1').transmitirTempSkills).toEqual(['Medicina']);
    expect(getTransmitirAliados(get('s'), 'longo')).toEqual(['a1']);
  });

  it('respeita o limite de aliados do descanso curto', () => {
    const { sup, a1, a2, a3 } = setup();
    const limite = getTransmitirLimite(sup, 'curto'); // ⌊BT/2⌋
    expect(limite).toBeGreaterThanOrEqual(1);
    expect(transmitir(sup, a1, 'Medicina', 'curto').ok).toBe(true);
    if (limite >= 2) expect(transmitir(get('s'), a2, 'Medicina', 'curto').ok).toBe(true);
    const ultimo = limite >= 2 ? a3 : a2;
    const r = transmitir(get('s'), ultimo, 'Medicina', 'curto');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Limite de aliados/);
  });

  it('o mesmo aliado pode receber mais de uma perícia sem contar de novo', () => {
    const { sup, a1 } = setup();
    expect(transmitir(sup, a1, 'Medicina', 'curto').ok).toBe(true);
    expect(transmitir(get('s'), get('a1'), 'Percepção', 'curto').ok).toBe(true);
    expect(getTransmitirAliados(get('s'), 'curto')).toEqual(['a1']);
    expect(get('a1').transmitirTempSkills).toEqual(['Medicina', 'Percepção']);
  });

  it('rejeita: si mesmo, não-jogador, perícia não treinada do Suporte e perícia já treinada do aliado', () => {
    const { sup, a1 } = setup();
    expect(podeTransmitir(sup, sup, 'Medicina', 'longo').ok).toBe(false);
    const npc = mk({ id: 'n', category: 'ENEMY' as Character['category'], skills: [sk('Medicina')] });
    expect(podeTransmitir(sup, npc, 'Medicina', 'longo').ok).toBe(false);
    expect(podeTransmitir(sup, a1, 'Furtividade', 'longo').ok).toBe(false);
    const treinado = mk({ id: 't', skills: [sk('Medicina', true)] });
    expect(podeTransmitir(sup, treinado, 'Medicina', 'longo').ok).toBe(false);
  });

  it('mudar o modo do descanso recomeça a contagem de aliados', () => {
    const { sup, a1, a2 } = setup();
    transmitir(sup, a1, 'Medicina', 'curto');
    expect(getTransmitirAliados(get('s'), 'longo')).toEqual([]);
    expect(transmitir(get('s'), a2, 'Medicina', 'longo').ok).toBe(true);
    expect(getTransmitirAliados(get('s'), 'longo')).toEqual(['a2']);
  });
});

describe('Transmitir Conhecimento — expiração no descanso', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [] });
  });

  it('expireTransmitir remove só as perícias temporárias e limpa a sessão', () => {
    const ally = mk({
      id: 'a',
      skills: [sk('Medicina', true), sk('Percepção', true)],
      transmitirTempSkills: ['Medicina'],
    });
    const out = expireTransmitir(ally)!;
    expect(out.skills!.find((s) => s.name === 'Medicina')!.trained).toBe(false);
    expect(out.skills!.find((s) => s.name === 'Percepção')!.trained).toBe(true);
    expect(out.transmitirTempSkills).toBeUndefined();
    expect(expireTransmitir(mk({ id: 'b', skills: [sk('Medicina')] }))).toBeNull();
  });

  it('descanso curto do ALIADO remove o treinamento recebido', async () => {
    const sup = mk({ id: 's', name: 'Sup', level: 5, ...withAb, skills: [sk('Medicina', true)] });
    const a1 = mk({ id: 'a1', name: 'Ana', skills: [sk('Medicina')] });
    useCharacterStore.setState({ characters: [sup, a1] });
    transmitir(sup, a1, 'Medicina', 'longo');
    expect(get('a1').skills[0].trained).toBe(true);
    await useCharacterStore.getState().applyShortRest('a1');
    expect(get('a1').skills[0].trained).toBe(false);
    expect(get('a1').transmitirTempSkills).toBeUndefined();
  });

  it('descanso longo do ALIADO também remove; descanso do SUPORTE limpa só a sessão dele', async () => {
    const sup = mk({ id: 's', name: 'Sup', level: 5, ...withAb, skills: [sk('Medicina', true)] });
    const a1 = mk({ id: 'a1', name: 'Ana', skills: [sk('Medicina')] });
    useCharacterStore.setState({ characters: [sup, a1] });
    transmitir(sup, a1, 'Medicina', 'longo');
    await useCharacterStore.getState().applyLongRest('s');
    expect(get('s').transmitirSession).toBeUndefined();
    expect(get('a1').skills[0].trained).toBe(true); // aliado ainda não descansou
    await useCharacterStore.getState().applyLongRest('a1');
    expect(get('a1').skills[0].trained).toBe(false);
  });
});
