// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));

import * as dice from '@/lib/dice';
import * as combatEngine from '@/lib/combatEngine';
import { dispararContraRajadaBaculo } from '@/lib/baculoAetherisCounterattack';
import { BACULO_AETHERIS_ID, BACULO_AETHERIS_SEM_REACOES, BACULO_AETHERIS_SUSPENSO } from '@/lib/baculoAetheris';
import {
  ativarRupturaBaculoAetheris,
  expireBaculoAetherisConditionsForTurnStart,
  pedirTRBaculoAetheris,
  resolverAcertoBaculoAetheris,
  resolverTRBaculoAetheris,
} from '@/lib/baculoAetherisCombat';
import { getReactionsAvailable } from '@/lib/reactionBudget';
import { ofertasReacaoAtiva } from '@/lib/omni/reacoesAtivas';
import { PacoteOmniSchema } from '@/lib/omni/validacao';
import type { EntidadeOmni } from '@/lib/omni/tipos';
import preset from '../../public/omni-presets/baculo-aetheris.json';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useCombatStore } from '@/stores/useCombatStore';
import { useMapStore } from '@/stores/useMapStore';
import { useInventoryStore } from '@/stores/useInventoryStore';
import { useOmniEntidadesStore } from '@/stores/useOmniEntidadesStore';
import { useReactionStore } from '@/stores/useReactionStore';
import { useTestRequestStore } from '@/stores/useTestRequestStore';
import { ficha, montarMesa, pegarFicha, limparMesa } from './helpers/mesaReal';

const donoId = 'portador';
const alvoId = 'alvo';
const damage = vi.fn(async () => undefined);
let restoreApplyDamage: ReturnType<typeof useCharacterStore.getState>['applyDamage'];
let rollCalls: string[] = [];
const trResult = (kind: 'success' | 'failure', d20 = 10, total = d20) => ({ d20, bonus: 0, total, rolledAt: Date.now(), forced: { kind } });

function criarMesa() {
  const dono = ficha(donoId, {
    category: 'PLAYER', mainHandWeaponName: 'Baculo Aetheris',
    peCurrent: 10, tempPE: 0, reactionsCurrent: 1, reactionsMax: 1,
    actionsCurrent: 1, bonusActionsCurrent: 1,
  });
  const alvo = ficha(alvoId, {
    category: 'INIMIGO', hpCurrent: 100, hpMax: 100,
    reactionsCurrent: 1, reactionsMax: 1,
  });
  montarMesa([dono, alvo], { [donoId]: [0, 0], [alvoId]: [2, 0] });
  useCombatStore.setState({ inCombat: true, combatId: 'cena-1', round: 1, aetherisRoundUse: {} } as never);
  useTestRequestStore.setState({ requests: [] } as never);
  useInventoryStore.setState({ items: {} });
  useOmniEntidadesStore.setState({ entidades: {} });
  useReactionStore.setState({ reactionsUsedByChar: {}, prompts: [] });
}

beforeEach(() => {
  restoreApplyDamage = useCharacterStore.getState().applyDamage;
  damage.mockClear();
  useCharacterStore.setState({ applyDamage: damage } as never);
  criarMesa();
  rollCalls = [];
  vi.spyOn(dice, 'rollDiceCom').mockImplementation(async (_id, formula) => { rollCalls.push(formula); return { total: 40 } as never; });
});

afterEach(() => {
  vi.restoreAllMocks();
  useCharacterStore.setState({ applyDamage: restoreApplyDamage, characters: [] } as never);
  useMapStore.setState({ entities: {}, walls: [] } as never);
  useCombatStore.setState({ inCombat: false, aetherisRoundUse: {} } as never);
  useTestRequestStore.setState({ requests: [] } as never);
  useInventoryStore.setState({ items: {} });
  useOmniEntidadesStore.setState({ entidades: {} });
  useReactionStore.setState({ reactionsUsedByChar: {}, prompts: [] });
  limparMesa();
});

describe('Aetheris combat', () => {
  it('aplica Rajada uma vez por rodada e o cr?tico abre Julgamento com Fortitude', async () => {
    await resolverAcertoBaculoAetheris(donoId, alvoId, 'baculo-1', false);
    expect(rollCalls).toEqual(['3d8']);
    expect(damage).toHaveBeenCalledWith(alvoId, 40, 'DS', expect.objectContaining({ attackerId: donoId }));
    expect(useMapStore.getState().entities['e-alvo'].x).toBe(280);

    await resolverAcertoBaculoAetheris(donoId, alvoId, 'baculo-1', true);
    expect(rollCalls).toEqual(['3d8', '5d8']);
    expect(useMapStore.getState().entities['e-alvo'].x).toBe(280);
    expect(useTestRequestStore.getState().requests[0]).toMatchObject({
      kind: 'save', testName: 'Fortitude', charId: alvoId,
      aetherisResolution: { sourceCharId: donoId, conditionOnFailure: 'sem-reacoes', sourceEntityId: BACULO_AETHERIS_ID },
    });
    expect(useTestRequestStore.getState().requests[0].note).toContain('Julgamento dos Ventos');
    expect(pegarFicha(donoId).reactionsCurrent).toBe(1);
  });

  it('Ruptura consome 2 PE e Rea??o, usa 10d10 sem duplicar e bloqueia uma segunda ativa??o', async () => {
    const crit = await resolverAcertoBaculoAetheris(donoId, alvoId, 'baculo-1', true);
    expect(crit.rupturaPodeSerOferecida).toBe(true);

    expect(await ativarRupturaBaculoAetheris(donoId, alvoId, 'baculo-1')).toEqual({ ok: true });
    expect(rollCalls).toEqual(['3d8', '5d8', '10d10']);
    expect(pegarFicha(donoId)).toMatchObject({ peCurrent: 8, reactionsCurrent: 0 });
    expect(useMapStore.getState().entities['e-alvo'].x).toBe(560);

    const second = await ativarRupturaBaculoAetheris(donoId, alvoId, 'baculo-1');
    expect(second.ok).toBe(false); expect(second.reason).toContain('Ruptura'); expect(second.reason).toContain('nesta rodada');
    expect(pegarFicha(donoId)).toMatchObject({ peCurrent: 8, reactionsCurrent: 0 });
    expect(rollCalls).toEqual(['3d8', '5d8', '10d10']);

    const ruptureRequest = useTestRequestStore.getState().requests.find((request) => request.aetherisResolution?.conditionOnFailure === 'caido');
    expect(ruptureRequest).toBeDefined();
    await resolverTRBaculoAetheris({ ...ruptureRequest!, result: trResult('failure', 2) });
    expect(pegarFicha(alvoId).activeConditions?.some((condition) => condition.conditionId === 'caido')).toBe(true);
  });

  it('Trono causa metade no sucesso, suspende a 4,5 m na falha e expira com descida segura', async () => {
    const requestId = pedirTRBaculoAetheris(pegarFicha(donoId), pegarFicha(alvoId), 'Trono das Nuvens', {
      damageFormula: '5d8', damageType: 'DI', halfOnSuccess: true, conditionOnFailure: 'suspenso',
    });
    const base = useTestRequestStore.getState().requests.find((request) => request.id === requestId)!;
    await resolverTRBaculoAetheris({ ...base, result: trResult('success', 15) });
    expect(damage).toHaveBeenCalledWith(alvoId, 20, 'DI', expect.objectContaining({ attackerId: donoId }));
    expect(pegarFicha(alvoId).activeConditions?.some((condition) => condition.conditionId === BACULO_AETHERIS_SUSPENSO)).toBe(false);

    const failedId = pedirTRBaculoAetheris(pegarFicha(donoId), pegarFicha(alvoId), 'Trono das Nuvens', {
      damageFormula: '5d8', damageType: 'DI', halfOnSuccess: true, conditionOnFailure: 'suspenso',
    });
    const failed = useTestRequestStore.getState().requests.find((request) => request.id === failedId)!;
    await resolverTRBaculoAetheris({ ...failed, result: trResult('failure', 3) });
    expect(damage).toHaveBeenCalledWith(alvoId, 40, 'DI', expect.objectContaining({ attackerId: donoId }));
    expect(pegarFicha(alvoId).activeConditions?.some((condition) => condition.conditionId === BACULO_AETHERIS_SUSPENSO)).toBe(true);
    expect(useMapStore.getState().entities['e-alvo']).toMatchObject({ altitudeM: 4.5, altitudeLabel: 'Suspenso' });

    expireBaculoAetherisConditionsForTurnStart(donoId);
    expect(pegarFicha(alvoId).activeConditions?.some((condition) => condition.conditionId === BACULO_AETHERIS_SUSPENSO)).toBe(false);
    expect(useMapStore.getState().entities['e-alvo']).toMatchObject({ altitudeM: 0, altitudeLabel: undefined });
  });

  it('offers Reversao only for a ranged attack against an ally within 9 m', () => {
    const dono = ficha(donoId, { category: 'PLAYER', peCurrent: 10, reactionsCurrent: 1, reactionsMax: 1 });
    const atacante = ficha('atacante', { category: 'INIMIGO', hpCurrent: 50, reactionsCurrent: 1 });
    const aliado = ficha('aliado', { category: 'PLAYER', hpCurrent: 50 });
    montarMesa([dono, atacante, aliado], { [donoId]: [0, 0], atacante: [10, 0], aliado: [5, 0] });
    const parsed = PacoteOmniSchema.safeParse(preset);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const item = useInventoryStore.getState().add(donoId, parsed.data.entidades[0] as unknown as EntidadeOmni, { instanceId: 'baculo-reversao-test' });
    useCharacterStore.getState().updateCharacter(donoId, { mainHandWeaponName: 'B?culo Aetheris', mainHandWeaponInstanceId: item.instanceId });
    const evento = { gatilho: 'quando_alvo_declarar_ataque' as const, origemId: 'atacante', protegidoId: 'aliado', tipoAtaque: 'ranged' as const };
    expect(ofertasReacaoAtiva(evento)).toHaveLength(1);
    expect(ofertasReacaoAtiva({ ...evento, tipoAtaque: 'melee' })).toHaveLength(0);
    useMapStore.getState().updateEntity('e-aliado', { x: 14 * 70 });
    expect(ofertasReacaoAtiva(evento)).toHaveLength(0);
  });

  it('resolves the 5d8 counterattack using the external Aetheris weapon model', async () => {
    const attack = vi.spyOn(combatEngine, 'rollAttack').mockResolvedValue({ hit: true, critical: false, natural: 15 } as never);

    await expect(dispararContraRajadaBaculo({ wielderId: donoId, attackerId: alvoId, protectedId: 'aliado' })).resolves.toEqual({ ok: true });

    expect(attack).toHaveBeenCalledOnce();
    expect(rollCalls).toEqual(['5d8']);
    expect(damage).toHaveBeenCalledWith(alvoId, 40, 'DS', expect.objectContaining({ attackerId: donoId, isMelee: false }));
  });

  it('Julgamento suprime rea??es somente quando o alvo falha no teste', async () => {
    await resolverAcertoBaculoAetheris(donoId, alvoId, 'baculo-1', true);
    const request = useTestRequestStore.getState().requests.find((item) => item.aetherisResolution?.conditionOnFailure === 'sem-reacoes')!;
    await resolverTRBaculoAetheris({ ...request, result: trResult('failure', 1) });
    expect(pegarFicha(alvoId).activeConditions?.some((condition) => condition.conditionId === BACULO_AETHERIS_SEM_REACOES)).toBe(true);
    expect(getReactionsAvailable(pegarFicha(alvoId))).toBe(0);

    const passed = { ...request, id: 'tr-passou', result: trResult('success', 19, 99) };
    const target = pegarFicha(alvoId);
    useCharacterStore.getState().updateCharacter(alvoId, { activeConditions: [] });
    await resolverTRBaculoAetheris(passed);
    expect(getReactionsAvailable(pegarFicha(alvoId))).toBe(1);
    expect(pegarFicha(alvoId).activeConditions).toEqual([]);
    expect(target).not.toBe(pegarFicha(alvoId));
  });
});
