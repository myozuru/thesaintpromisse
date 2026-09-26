import { describe, it, expect, beforeEach } from 'vitest';
import {
  APOIO_AVANCADO_ID, OUTRA_CHANCE_ID, OUTRA_CHANCE_PE_COST,
  acceptOutraChance, applyApoioAvancado, canChooseApoio, chooseApoio,
  expireApoiosGrantedBy, findOutraChanceSupporter, getApoiosEscolhidos, getApoiosMax,
  getEffectiveBaseDC, getOutraChanceMaxUses, getOutraChanceUsedAfterShortRest,
  getOutraChanceUsesLeft, reduceOutraChanceMessage,
} from '@/lib/suporteNivel6';
import { consumeAdvantageFor, consumeFlatBonusFor } from '@/lib/omni/rollAdvantage';
import { computeTotalDefense } from '@/lib/defenseCalc';
import { getTrainingBonusByLevel } from '@/lib/levelEngine';
import { getSpecAbilitiesFor, validateSpecAbilityCatalog } from '@/lib/specAbilities';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { createFakeMesa } from '@/test/helpers/fakeMesa';
import type { Character } from '@/types';

const get = (id: string) => useCharacterStore.getState().characters.find((c) => c.id === id)!;
const mk = (p: Partial<Character>) => ({
  category: 'PLAYER', level: 2, hpCurrent: 10, hpMax: 10, peCurrent: 10, peMax: 10,
  attributes: [], skills: [], savingThrows: [], passives: [], rdByType: {}, ca: 10, baseDC: 15, ...p,
}) as unknown as Character;

const grid = { dpi: 70, metersPerCell: 1.5 };
const ent = (characterId: string, x: number, y: number) => ({ characterId, x, y, w: 70, h: 70 });
const withAb = (id: string) => ({ chosenSpecAbilities: [{ abilityId: id, chosenAtLevel: 2 }] });

describe('Catálogo do Suporte (Nv 2)', () => {
  it('tem Apoio Avançado e Conceder Outra Chance no tier 2 e o catálogo continua válido', () => {
    const ids = getSpecAbilitiesFor('Suporte').filter((a) => a.tier === 2).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining([APOIO_AVANCADO_ID, OUTRA_CHANCE_ID]));
    expect(validateSpecAbilityCatalog()).toEqual([]);
  });
});

describe('Apoio Avançado — escolha de apoios', () => {
  beforeEach(() => {
    useCharacterStore.setState({ characters: [mk({ id: 's', name: 'Sup', ...withAb(APOIO_AVANCADO_ID) })] });
  });

  it('conhece 1 apoio no Nv 2, +1 no Nv 6 e +1 no Nv 12', () => {
    expect(getApoiosMax(1)).toBe(0);
    expect(getApoiosMax(2)).toBe(1);
    expect(getApoiosMax(5)).toBe(1);
    expect(getApoiosMax(6)).toBe(2);
    expect(getApoiosMax(11)).toBe(2);
    expect(getApoiosMax(12)).toBe(3);
  });

  it('escolhe até o limite e não repete apoio', () => {
    expect(canChooseApoio(get('s'))).toBe(true);
    expect(chooseApoio(get('s'), 'defensivo').ok).toBe(true);
    expect(getApoiosEscolhidos(get('s'))).toEqual(['defensivo']);
    expect(canChooseApoio(get('s'))).toBe(false);
    expect(chooseApoio(get('s'), 'focado').ok).toBe(false);
    // Nv 6 libera o segundo
    useCharacterStore.getState().updateCharacter('s', { level: 6 });
    expect(chooseApoio(get('s'), 'defensivo').ok).toBe(false); // duplicado
    expect(chooseApoio(get('s'), 'focado').ok).toBe(true);
    expect(getApoiosEscolhidos(get('s'))).toEqual(['defensivo', 'focado']);
  });
});

describe('Apoio Avançado — efeitos', () => {
  const tb = getTrainingBonusByLevel(6);
  beforeEach(() => {
    useCharacterStore.setState({
      characters: [
        mk({
          id: 's', name: 'Sup', ...withAb(APOIO_AVANCADO_ID),
          apoiosAvancados: ['curativo', 'defensivo', 'focado', 'ofensivo', 'estrategico'],
          attributes: [{ id: 'pre', name: 'Presença', value: 16 }],
          keyAttribute: 'Presença',
        }),
        mk({ id: 'a', name: 'Aliado' }),
      ],
    });
  });

  it('Defensivo: +½ bônus de treinamento na Defesa e expira no turno de quem apoiou', () => {
    const before = computeTotalDefense(get('a'));
    const r = applyApoioAvancado(get('s'), get('a'), 'defensivo');
    expect(r.ok).toBe(true);
    expect(get('a').apoioDefensivo).toEqual({ value: Math.floor(tb / 2), grantedBy: 's' });
    expect(computeTotalDefense(get('a'))).toBe(before + Math.floor(tb / 2));
    expireApoiosGrantedBy('s');
    expect(get('a').apoioDefensivo).toBeUndefined();
    expect(computeTotalDefense(get('a'))).toBe(before);
  });

  it('Focado: bônus fixo no próximo teste de perícia, sem virar vantagem', async () => {
    const r = applyApoioAvancado(get('s'), get('a'), 'focado');
    expect(r.ok).toBe(true);
    await new Promise((res) => setTimeout(res, 0)); // grantFocado é assíncrono
    const ctx = { kind: 'skill', name: 'Percepção' } as const;
    // Não conta como vantagem
    expect(consumeAdvantageFor('a', ctx).net).toBe('normal');
    // Soma +½ mod de Presença (16 → mod 3 → ½ = 1) e é consumido uma vez
    const flat = consumeFlatBonusFor('a', ctx);
    expect(flat.bonus).toBe(1);
    expect(consumeFlatBonusFor('a', ctx).bonus).toBe(0);
  });

  it('Ofensivo: cobra 2 PE e falha sem PE', () => {
    const r = applyApoioAvancado(get('s'), get('a'), 'ofensivo');
    expect(r.ok).toBe(true);
    expect(get('s').peCurrent).toBe(8);
    useCharacterStore.getState().updateCharacter('s', { peCurrent: 1 });
    expect(applyApoioAvancado(get('s'), get('a'), 'ofensivo').ok).toBe(false);
  });

  it('Estratégico: +½ bônus de treinamento na CD efetiva e expira no turno de quem apoiou', () => {
    const r = applyApoioAvancado(get('s'), get('a'), 'estrategico');
    expect(r.ok).toBe(true);
    expect(getEffectiveBaseDC(get('a'))).toBe(15 + Math.floor(tb / 2));
    expireApoiosGrantedBy('s');
    expect(getEffectiveBaseDC(get('a'))).toBe(15);
  });

  it('Curativo: pede rolagem de cura e falha sem usos de Suporte em Combate', () => {
    // Presença 16 → mod 3 → 3 usos de cura
    const r = applyApoioAvancado(get('s'), get('a'), 'curativo');
    expect(r.ok).toBe(true);
    expect(r.needsHealRoll).toBe(true);
    useCharacterStore.getState().updateCharacter('s', { suporteHealUsed: 99 });
    expect(applyApoioAvancado(get('s'), get('a'), 'curativo').ok).toBe(false);
  });

  it('não aplica apoio não conhecido', () => {
    useCharacterStore.getState().updateCharacter('s', { apoiosAvancados: ['defensivo'] });
    expect(applyApoioAvancado(get('s'), get('a'), 'ofensivo').ok).toBe(false);
  });
});

describe('Conceder Outra Chance — usos e descanso', () => {
  const tb = getTrainingBonusByLevel(6);
  beforeEach(() => {
    useCharacterStore.setState({ characters: [mk({ id: 's', name: 'Sup', ...withAb(OUTRA_CHANCE_ID) })] });
  });

  it('usos = bônus de treinamento; sem a habilidade, zero', () => {
    expect(getOutraChanceMaxUses(get('s'))).toBe(tb);
    expect(getOutraChanceUsesLeft(get('s'))).toBe(tb);
    useCharacterStore.getState().updateCharacter('s', { chosenSpecAbilities: [] });
    expect(getOutraChanceUsesLeft(get('s'))).toBe(0);
  });

  it('descanso curto recupera metade dos usos (arredondado para baixo)', () => {
    useCharacterStore.getState().updateCharacter('s', { outraChanceUsed: tb });
    const after = getOutraChanceUsedAfterShortRest(get('s'));
    expect(after).toBe(tb - Math.floor(tb / 2));
    expect(getOutraChanceMaxUses(get('s')) - after).toBe(Math.floor(tb / 2));
  });
});

describe('Conceder Outra Chance — elegibilidade (6 m)', () => {
  const tb = getTrainingBonusByLevel(6);
  const sup = () => get('s');
  beforeEach(() => {
    useCharacterStore.setState({
      characters: [
        mk({ id: 's', name: 'Sup', ...withAb(OUTRA_CHANCE_ID) }),
        mk({ id: 'a', name: 'Aliado' }),
        mk({ id: 'n', name: 'Npc', category: 'NPC' } as Partial<Character>),
      ],
    });
  });

  it('oferece a até 6 m (4 casas), não a 7,5 m', () => {
    const all = useCharacterStore.getState().characters;
    const perto = { 1: ent('s', 35, 35), 2: ent('a', 35 + 280, 35) }; // 6 m
    expect(findOutraChanceSupporter('a', all, perto, grid)?.id).toBe('s');
    const longe = { 1: ent('s', 35, 35), 2: ent('a', 35 + 350, 35) }; // 7,5 m
    expect(findOutraChanceSupporter('a', all, longe, grid)).toBeNull();
  });

  it('exige usos, PE e peças no mapa; não oferece para NPC nem para si mesmo', () => {
    const all = useCharacterStore.getState().characters;
    const ents = { 1: ent('s', 35, 35), 2: ent('a', 105, 35), 3: ent('n', 105, 105) };
    expect(findOutraChanceSupporter('n', all, ents, grid)).toBeNull(); // NPC não é aliado jogador
    expect(findOutraChanceSupporter('s', all, ents, grid)).toBeNull(); // si mesmo
    expect(findOutraChanceSupporter('a', all, {}, grid)).toBeNull(); // fora do mapa
    useCharacterStore.getState().updateCharacter('s', { peCurrent: OUTRA_CHANCE_PE_COST - 1 });
    expect(findOutraChanceSupporter('a', useCharacterStore.getState().characters, ents, grid)).toBeNull();
    useCharacterStore.getState().updateCharacter('s', { peCurrent: 10, outraChanceUsed: tb });
    expect(findOutraChanceSupporter('a', useCharacterStore.getState().characters, ents, grid)).toBeNull();
  });

  it('aceitar paga 3 PE e gasta 1 uso', () => {
    const offer = { supporterId: 's', rollerId: 'a', requestId: 'r1', testName: 'Atletismo', total: 10, dc: 15 };
    const r = acceptOutraChance(offer);
    expect(r.ok).toBe(true);
    expect(sup().peCurrent).toBe(10 - OUTRA_CHANCE_PE_COST);
    expect(sup().outraChanceUsed).toBe(1);
    useCharacterStore.getState().updateCharacter('s', { peCurrent: 0 });
    expect(acceptOutraChance(offer).ok).toBe(false);
  });
});

describe('Conceder Outra Chance — roteamento multiplayer (mesa simulada)', () => {
  it('oferta chega só ao dono do Suporte; aceite é roteado; close fecha todos', () => {
    type St = { opened: unknown[]; accepted: unknown[]; closed: number };
    const mesa = createFakeMesa<St>(
      () => ({ opened: [], accepted: [], closed: 0 }),
      {
        'outra-chance': (client, payload) => {
          const r = reduceOutraChanceMessage(
            payload as never,
            client.id,
            (sid) => sid === 'sup' && client.viewer.profileId === 'dona-do-suporte',
          );
          if (r.type === 'open') client.state.opened.push(r.offer);
          else if (r.type === 'accept') client.state.accepted.push(r);
          else if (r.type === 'close') client.state.closed += 1;
        },
      },
    );
    const mestre = mesa.join({ name: 'Mestre', role: 'MASTER', profileId: 'mestre' });
    const dona = mesa.join({ name: 'Dona', role: 'PLAYER', profileId: 'dona-do-suporte' });
    const outro = mesa.join({ name: 'Outro', role: 'PLAYER', profileId: 'outro' });

    const offer = { kind: 'offer', supporterId: 'sup', rollerId: 'a', requestId: 'r1', testName: 'Atletismo', total: 10, dc: 15 };
    mestre.send('outra-chance', offer);
    expect(dona.state.opened).toHaveLength(1);
    expect(outro.state.opened).toHaveLength(0);
    expect(mestre.state.opened).toHaveLength(0);

    dona.send('outra-chance', { kind: 'accept', requestId: 'r1', rollerId: 'a' });
    expect(mestre.state.accepted).toHaveLength(1);
    expect(outro.state.accepted).toHaveLength(1);

    dona.send('outra-chance', { kind: 'close', requestId: 'r1' });
    expect(mestre.state.closed).toBe(1);
    expect(outro.state.closed).toBe(1);
  });

  it('ignora mensagens inválidas e as da própria tela', () => {
    expect(reduceOutraChanceMessage(null, 'c1', () => true).type).toBe('ignore');
    expect(reduceOutraChanceMessage({ clientId: 'c1', kind: 'offer' }, 'c1', () => true).type).toBe('ignore');
    expect(
      reduceOutraChanceMessage({ clientId: 'c2', kind: 'offer', supporterId: 's' }, 'c1', () => true).type,
    ).toBe('ignore');
  });
});
