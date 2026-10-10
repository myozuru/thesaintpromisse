// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import type { Character } from '@/types';
import type { InstanciaInvocacao } from '@/lib/invocacoes/schema';
import { consumoPorTempoDecorrido, criarContribuicaoTempoInvocacao, tempoAdicionalEmSegundos } from '@/lib/controlador/tempo';
import { migrarEstadoCombatPersistido } from '@/stores/useCombatStore';

function instanciaComReserva(id: string, segundos: number, createdAt: string): InstanciaInvocacao {
  return {
    schemaVersion: 1,
    version: 1,
    id,
    modeloId: `modelo-${id}`,
    combateId: 'combate-1',
    donoCharacterId: 'dono',
    tokenId: `token-${id}`,
    estado: 'ativa',
    hpAtual: 10,
    hpMaximoAtual: 10,
    contribuicaoTempo: {
      id: `tempo-${id}`,
      grantEventId: `evento-${id}`,
      ownerCharacterId: 'dono',
      combatId: 'combate-1',
      instanceId: id,
      invocationId: `modelo-${id}`,
      quantidadeConcedida: segundos,
      quantidadeRestante: segundos,
      unidade: 'segundos',
      estado: 'ativa',
      createdAt,
    },
  };
}

function configurarRelogio(instancias: InstanciaInvocacao[], input?: Partial<ReturnType<typeof useCombatStore.getState>>) {
  useCharacterStore.setState({
    characters: [{ id: 'dono', instanciasInvocacao: instancias } as Character],
  } as never);
  useCombatStore.setState({
    inCombat: true,
    combatId: 'combate-1',
    round: 1,
    currentTurnIndex: 0,
    initiativeOrder: [{ charId: 'dono', charName: 'Dono', roll: 10, bonus: 0, total: 10 }],
    turnTimerEnabled: true,
    turnDurationSec: 60,
    turnBaseRemainingAtStart: 60,
    turnRemainingAtStart: 60 + instancias.reduce((total, item) => total + (item.contribuicaoTempo?.quantidadeRestante ?? 0), 0),
    turnClockOwnerCharId: 'dono',
    turnTimeGrantEventIds: [],
    turnStartedAt: Date.now(),
    turnPaused: false,
    reactionPauseIds: [],
    ...input,
  } as never);
}

describe('Controlador — reservas de tempo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T10:00:00.000Z'));
    localStorage.clear();
    useCharacterStore.setState({ characters: [] } as never);
    useCombatStore.setState({
      inCombat: false,
      combatId: null,
      round: 1,
      currentTurnIndex: 0,
      initiativeOrder: [],
      turnTimerEnabled: false,
      turnDurationSec: 60,
      turnRemainingAtStart: 60,
      turnBaseRemainingAtStart: 60,
      turnClockOwnerCharId: null,
      turnTimeGrantEventIds: [],
      turnStartedAt: 0,
      turnPaused: true,
      reactionPauseIds: [],
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('converte unidades conhecidas para segundos e deixa ausência como zero', () => {
    expect(tempoAdicionalEmSegundos()).toEqual({ ok: true, segundos: 0 });
    expect(tempoAdicionalEmSegundos({ quantidade: 2, unidade: 'turnos' })).toEqual({ ok: true, segundos: 12 });
    expect(tempoAdicionalEmSegundos({ quantidade: 1.5, unidade: 'minutos' })).toEqual({ ok: true, segundos: 90 });
    expect(tempoAdicionalEmSegundos({ quantidade: 1, unidade: 'unidade inventada' })).toMatchObject({ ok: false });
  });

  it('migra cronômetros salvos antes do controle de tempo-base e reservas', () => {
    expect(migrarEstadoCombatPersistido({
      inCombat: true,
      initiativeOrder: [{ charId: 'dono' }],
      currentTurnIndex: 0,
      turnDurationSec: 60,
      turnRemainingAtStart: 31,
    }, 0)).toMatchObject({
      turnBaseRemainingAtStart: 31,
      turnClockOwnerCharId: 'dono',
      turnTimeGrantEventIds: [],
    });
  });

  it('registra contribuição idempotente por instância', () => {
    configurarRelogio([]);
    const state = useCombatStore.getState();
    expect(state.registerInvocationTimeGrant('dono', 'grant-1', 12)).toBe(12);
    expect(useCombatStore.getState().getTurnRemaining()).toBe(72);
    expect(useCombatStore.getState().registerInvocationTimeGrant('dono', 'grant-1', 12)).toBe(0);
    expect(useCombatStore.getState().getTurnRemaining()).toBe(72);
  });

  it('consome primeiro o tempo-base e depois as reservas em FIFO', () => {
    const primeira = instanciaComReserva('inst-1', 5, '2026-10-10T09:00:00.000Z');
    const segunda = instanciaComReserva('inst-2', 7, '2026-10-10T09:01:00.000Z');
    configurarRelogio([segunda, primeira], { turnRemainingAtStart: 72, turnStartedAt: Date.now() - 65_000 });

    useCombatStore.getState().settleTurnTimer();

    const instancias = useCharacterStore.getState().characters[0].instanciasInvocacao ?? [];
    expect(useCombatStore.getState().turnBaseRemainingAtStart).toBe(0);
    expect(useCombatStore.getState().turnRemainingAtStart).toBeCloseTo(7);
    expect(instancias.find(item => item.id === 'inst-1')?.contribuicaoTempo).toMatchObject({ estado: 'consumida', quantidadeRestante: 0 });
    expect(instancias.find(item => item.id === 'inst-2')?.contribuicaoTempo).toMatchObject({ estado: 'ativa', quantidadeRestante: 7 });
  });

  it('aplica o piso de dez segundos ao retirar reserva voluntariamente', () => {
    const instancia = instanciaComReserva('inst-1', 12, '2026-10-10T09:00:00.000Z');
    configurarRelogio([instancia], { turnBaseRemainingAtStart: 8, turnRemainingAtStart: 20 });

    const resultado = useCombatStore.getState().removeInvocationTimeReservation('dono', 'inst-1');

    expect(resultado).toMatchObject({ removedSeconds: 10, discardedSeconds: 2, clockBefore: 20, clockAfter: 10, appliedToCurrentClock: true });
    expect(useCombatStore.getState().turnRemainingAtStart).toBe(10);
    expect(useCharacterStore.getState().characters[0].instanciasInvocacao?.[0].contribuicaoTempo).toMatchObject({ estado: 'retirada', quantidadeRestante: 0 });
  });

  it('não reduz um relógio que já está no piso ou abaixo dele', () => {
    const instancia = instanciaComReserva('inst-1', 5, '2026-10-10T09:00:00.000Z');
    configurarRelogio([instancia], { turnBaseRemainingAtStart: 9, turnRemainingAtStart: 9 });

    const resultado = useCombatStore.getState().removeInvocationTimeReservation('dono', 'inst-1');

    expect(resultado).toMatchObject({ removedSeconds: 0, discardedSeconds: 5, clockBefore: 9, clockAfter: 9 });
    expect(useCombatStore.getState().turnRemainingAtStart).toBe(9);
  });

  it('calcula separadamente consumo da base e excedente destinado às reservas', () => {
    expect(consumoPorTempoDecorrido({ baseRestante: 15, segundosDecorridos: 10 })).toEqual({ baseRestante: 5, consumirReservas: 0 });
    expect(consumoPorTempoDecorrido({ baseRestante: 15, segundosDecorridos: 20 })).toEqual({ baseRestante: 0, consumirReservas: 5 });
  });

  it('cria um grant em segundos com vínculo estável ao evento e à instância', () => {
    const resultado = criarContribuicaoTempoInvocacao({
      grantEventId: 'evento-1', ownerCharacterId: 'dono', combatId: 'combate-1',
      instanceId: 'inst-1', invocationId: 'modelo-1', tempoAdicional: { quantidade: 2, unidade: 'turnos' },
      agora: Date.parse('2026-10-10T10:00:00Z'),
    });
    expect(resultado).toMatchObject({
      ok: true,
      contribuicao: {
        grantEventId: 'evento-1', combatId: 'combate-1', instanceId: 'inst-1', invocationId: 'modelo-1',
        quantidadeConcedida: 12, quantidadeRestante: 12, unidade: 'segundos', estado: 'ativa',
      },
    });
  });
});
