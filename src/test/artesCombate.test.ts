// @vitest-environment jsdom
/**
 * Regras puras das Artes do Combate: preparo máximo, metade do SAB,
 * dados da Execução Silenciosa, deslocamento da Investida e gastos/ganhos.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import {
  getPreparoMax, getPreparoAtual, metadeSab, execucaoSilenciosaDice,
  investidaMoveMeters, spendPreparo, gainPreparo, analisarCampo,
  applyDistracaoLetal, applyGolpeDescendente, hasArtesCombate,
} from '@/lib/artesCombate';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha } from './helpers/mesaReal';

const esp = (sab: number, extra: Record<string, unknown> = {}) =>
  ficha('ana', {
    profileId: 'p-ana', characterClass: 'Feiticeiro', specialization: 'Especialista em Combate', level: 5,
    attributes: [{ name: 'Sabedoria', value: sab }],
    actionsCurrent: 1, actionsMax: 1, ...extra,
  } as never);

beforeEach(() => comoTela({ profileId: 'p-ana', role: 'PLAYER' }));
afterEach(() => { limparMesa(); vi.restoreAllMocks(); });

describe('Artes do Combate — regras puras', () => {
  it('preparo máximo = nível + Mod. de Sabedoria', () => {
    const c = esp(16); // SAB +3
    expect(getPreparoMax(c)).toBe(8);
    expect(getPreparoAtual(c)).toBe(8); // começa cheio
  });

  it('não-especialista não tem Artes nem preparo', () => {
    const c = esp(16, { specialization: 'Suporte' });
    expect(hasArtesCombate(c)).toBe(false);
    expect(getPreparoMax(c)).toBe(0);
  });

  it('metade do SAB arredonda para baixo com mínimo 1', () => {
    expect(metadeSab(esp(16))).toBe(1);  // +3 → 1
    expect(metadeSab(esp(18))).toBe(2);  // +4 → 2
    expect(metadeSab(esp(10))).toBe(1);  // +0 → mínimo 1
    expect(metadeSab(esp(8))).toBe(1);   // −1 → mínimo 1
  });

  it('Execução Silenciosa: 1d6 + 1d6 a cada +2 de SAB', () => {
    expect(execucaoSilenciosaDice(esp(10))).toBe(1); // +0
    expect(execucaoSilenciosaDice(esp(14))).toBe(2); // +2
    expect(execucaoSilenciosaDice(esp(18))).toBe(3); // +4
  });

  it('Investida Imediata: deslocamento = Mod. SAB × 1,5 m', () => {
    expect(investidaMoveMeters(esp(14))).toBe(3);   // +2 × 1,5
    expect(investidaMoveMeters(esp(18))).toBe(6);   // +4 × 1,5
    expect(investidaMoveMeters(esp(8))).toBe(0);    // mod negativo → 0
  });

  it('gastar preparo respeita o saldo e falha quando insuficiente', () => {
    montarMesa([esp(16)], { ana: [0, 0] });
    expect(spendPreparo('ana', 3).ok).toBe(true);
    expect(getPreparoAtual(pegarFicha('ana'))).toBe(5);
    const r = spendPreparo('ana', 6);
    expect(r.ok).toBe(false);
    expect(getPreparoAtual(pegarFicha('ana'))).toBe(5); // não mudou
  });

  it('ganhar preparo respeita o teto', () => {
    montarMesa([esp(16, { preparoCurrent: 7 })], { ana: [0, 0] });
    gainPreparo('ana', 5, true);
    expect(getPreparoAtual(pegarFicha('ana'))).toBe(8); // teto = 8
  });

  it('Analisar o campo: gasta Ação Comum e recupera +2', () => {
    montarMesa([esp(16, { preparoCurrent: 2 })], { ana: [0, 0] });
    const r = analisarCampo('ana');
    expect(r.ok).toBe(true);
    const depois = pegarFicha('ana');
    expect(getPreparoAtual(depois)).toBe(4);
    expect(depois.actionsCurrent).toBe(0);
    // Sem ação, falha:
    expect(analisarCampo('ana').ok).toBe(false);
  });

  it('Distração Letal e Golpe Descendente gravam os modificadores na ficha', () => {
    montarMesa([esp(18), ficha('bruno', { category: 'INIMIGO' } as never)], { ana: [0, 0], bruno: [1, 0] });
    applyDistracaoLetal('bruno', 2, 'Ana');
    expect(pegarFicha('bruno').arteDefensePenalty?.amount).toBe(2);
    applyGolpeDescendente('ana', 2);
    expect(pegarFicha('ana').arteGolpeDescendente?.amount).toBe(2);
  });

  it('descanso curto recupera metade do preparo; longo recupera tudo', async () => {
    montarMesa([esp(16, { preparoCurrent: 1, hpCurrent: 10, hpMax: 20, peCurrent: 0, peMax: 10 })], { ana: [0, 0] });
    await useCharacterStore.getState().applyShortRest('ana');
    expect(getPreparoAtual(pegarFicha('ana'))).toBe(5); // 1 + floor(8/2)
    await useCharacterStore.getState().applyLongRest('ana');
    expect(getPreparoAtual(pegarFicha('ana'))).toBe(8);
  });
});
