// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ficha, comoTela, montarMesa, pegarFicha } from './helpers/mesaReal';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useMapStore } from '@/stores/useMapStore';
import { useRoleStore } from '@/stores/useRoleStore';
import { useReactionStore, requestReactionDecision, completeReactionDecision } from '@/stores/useReactionStore';
import { criarPacoteDezSombras } from '@/lib/controlador/dezSombras';
import { causarDanoInvocacao, podeComandarInvocacao } from '@/lib/controlador/mapa';
import { aguardarDespachosAutonomia } from '@/lib/omni/eventBus';
import { RituaisDezSombrasSection } from '@/components/fichas/RituaisDezSombrasSection';

const DONO_ID = 'dono-ritual';
let randomUuidOriginal: PropertyDescriptor | undefined;
let worldBusOriginal: PropertyDescriptor | undefined;

beforeEach(() => {
  cleanup();
  randomUuidOriginal = Object.getOwnPropertyDescriptor(window.crypto, 'randomUUID');
  Object.defineProperty(window.crypto, 'randomUUID', {
    configurable: true,
    value: () => 'ritual-hud-integracao',
  });

  const modelos = criarPacoteDezSombras(DONO_ID).map(modelo => ({ ...modelo, domado: false }));
  const personagem = ficha(DONO_ID, {
    profileId: 'perfil-dono-ritual',
    specialization: 'Controlador',
    tecnicaAmaldicoada: 'Dez Sombras',
    invocacoesConhecidas: modelos,
  });
  montarMesa([personagem], { [DONO_ID]: [2, 2] });
  comoTela({ profileId: null, role: 'MASTER' });
  useCombatStore.setState({ inCombat: false, combatId: null, round: 1, currentTurnIndex: 0, initiativeOrder: [] } as never);
  useMapStore.setState({
    initiative: { entries: [], turnIndex: 0, round: 1 },
    selectedIds: [],
  } as never);
  useMapStore.getState().clearWalls();
  useReactionStore.setState({ prompts: [], reactionsUsedByChar: {} });
});

afterEach(async () => {
  await aguardarDespachosAutonomia();
  cleanup();
  if (randomUuidOriginal) Object.defineProperty(window.crypto, 'randomUUID', randomUuidOriginal);
  else Reflect.deleteProperty(window.crypto, 'randomUUID');
  if (worldBusOriginal) Object.defineProperty(window, '__worldBus', worldBusOriginal);
  else Reflect.deleteProperty(window, '__worldBus');
  randomUuidOriginal = undefined;
  worldBusOriginal = undefined;
  vi.restoreAllMocks();
});

describe('Preparação de ritual das Dez Sombras no mapa', () => {
  it('roteia reações de uma sombra controlada pelo Mestre sem mostrar decisão ao jogador', async () => {
    comoTela({ profileId: 'perfil-dono-ritual', role: 'PLAYER' });
    worldBusOriginal = Object.getOwnPropertyDescriptor(window, '__worldBus');
    Object.defineProperty(window, '__worldBus', { configurable: true, value: { send: vi.fn() } });
    let pedido: { destinatario?: string; requestId?: string } | undefined;
    const receber = (event: Event) => { pedido = (event as CustomEvent).detail; };
    window.addEventListener('reaction-prompt:send', receber);

    const decisao = requestReactionDecision({
      charId: DONO_ID,
      charName: 'Controlador',
      kind: 'tigre_reflexos_offer',
      message: 'O Tigre pode reagir.',
    }, { forceMaster: true });

    expect(pedido?.destinatario).toBe('@mestre');
    expect(useReactionStore.getState().prompts).toHaveLength(0);
    completeReactionDecision(pedido!.requestId!, null);
    await expect(decisao).resolves.toBeNull();
    window.removeEventListener('reaction-prompt:send', receber);
  });

  it('vincula o alvo à ficha e à instância e mantém a entidade para registrar derrota', () => {
    const character = useCharacterStore.getState().characters[0];
    const nue = character.invocacoesConhecidas?.find(modelo => modelo.subcategoria === 'dez-sombras:nue');
    expect(nue).toBeDefined();
    if (!nue) return;

    render(<RituaisDezSombrasSection character={character} />);
    const item = screen.getByRole('heading', { name: nue.nome }).closest('li');
    expect(item).not.toBeNull();
    fireEvent.click(within(item as HTMLElement).getByRole('button', { name: /Preparar no mapa/ }));

    const ritual = pegarFicha(DONO_ID).rituaisDezSombras?.find(registro => registro.estado === 'em_andamento');
    expect(ritual?.entidadeMapaId).toBe(`ritual-alvo-${ritual?.id}`);
    const token = useMapStore.getState().entities[ritual!.entidadeMapaId!];
    const instancia = pegarFicha(DONO_ID).instanciasInvocacao?.find(item => item.id === token.invocationInstanceId);

    expect(token).toMatchObject({
      masterControlled: true,
      ritualId: ritual!.id,
      ownerCharId: DONO_ID,
      ownerProfileId: 'perfil-dono-ritual',
      invocationId: nue.id,
      invocationState: 'ativa',
    });
    expect(instancia).toMatchObject({
      id: token.invocationInstanceId,
      modeloId: nue.id,
      donoCharacterId: DONO_ID,
      tokenId: token.id,
    });
    expect(useMapStore.getState().initiative.entries.some(entry => entry.entityId === token.id)).toBe(true);

    useCombatStore.setState({
      inCombat: true,
      combatId: 'ritual-combate',
      initiativeOrder: [{ charId: token.id, charName: nue.nome, roll: 12, bonus: 0, total: 12 }],
      currentTurnIndex: 0,
    } as never);
    useMapStore.setState({
      initiative: { entries: [{ id: 'iniciativa-desatualizada', entityId: 'outro-token', name: 'Outro token', init: 99 }], turnIndex: 0, round: 1 },
    } as never);
    expect(podeComandarInvocacao(DONO_ID, nue.id)).toBe(true);
    useRoleStore.setState({ role: 'PLAYER' } as never);
    expect(podeComandarInvocacao(DONO_ID, nue.id)).toBe(false);

    vi.spyOn(useCombatStore.getState(), 'settleTurnTimer').mockImplementation(() => {});
    const derrota = causarDanoInvocacao(token.id, 5000, undefined, instancia!.id);
    expect(derrota).toMatchObject({ ok: true, destruida: true });
    expect(useMapStore.getState().entities[token.id]).toMatchObject({
      masterControlled: true,
      ritualId: ritual!.id,
      invocationState: 'derrotada',
      hp: expect.any(Number),
    });
  });

  it('vincula Mahoraga e Tigre Fúnebre preparados antes ao combate iniciado depois', async () => {
    let uuid = 0;
    Object.defineProperty(window.crypto, 'randomUUID', {
      configurable: true,
      value: () => `ritual-pre-combate-${++uuid}`,
    });

    const character = useCharacterStore.getState().characters[0];
    render(<RituaisDezSombrasSection character={character} />);
    const alvos = ['dez-sombras:mahoraga', 'dez-sombras:tigre-funebre'].map(subcategoria => {
      const modelo = character.invocacoesConhecidas?.find(item => item.subcategoria === subcategoria);
      expect(modelo).toBeDefined();
      if (!modelo) throw new Error(`Modelo ausente: ${subcategoria}`);

      const item = screen.getByRole('heading', { name: modelo.nome }).closest('li');
      expect(item).not.toBeNull();
      fireEvent.click(within(item as HTMLElement).getByRole('button', { name: /Preparar no mapa/ }));

      const ritual = pegarFicha(DONO_ID).rituaisDezSombras?.find(registro =>
        registro.alvoInvocacaoId === modelo.id && registro.estado === 'em_andamento',
      );
      expect(ritual?.entidadeMapaId).toBeDefined();
      const token = useMapStore.getState().entities[ritual!.entidadeMapaId!];
      const instancia = pegarFicha(DONO_ID).instanciasInvocacao?.find(registro => registro.id === token.invocationInstanceId);
      expect(instancia?.combateId).toBeUndefined();
      return { modelo, token };
    });

    useCombatStore.getState().startCombat(alvos.map(({ modelo, token }, index) => ({
      charId: token.id,
      charName: modelo.nome,
      roll: 20 - index,
      bonus: 0,
      total: 20 - index,
    })));

    const combateId = useCombatStore.getState().combatId;
    expect(combateId).toBeTruthy();
    for (const { modelo, token } of alvos) {
      const instancia = pegarFicha(DONO_ID).instanciasInvocacao?.find(registro => registro.id === token.invocationInstanceId);
      expect(instancia).toMatchObject({
        combateId,
        marcadoresResetEconomia: { inicio_combate: `${combateId}:inicio_combate` },
      });
      if (modelo.subcategoria === 'dez-sombras:mahoraga') {
        expect(instancia?.estadoMahoraga?.combateId).toBe(combateId);
      }
      if (modelo.subcategoria === 'dez-sombras:tigre-funebre') {
        expect(instancia?.estadoTigreFunebre?.combateId).toBe(combateId);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  });
});
