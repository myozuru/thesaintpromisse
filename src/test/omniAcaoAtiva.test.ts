// @vitest-environment jsdom
/** Ações ativas genéricas do OMNI em combate real em memória. */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', async () => ({ supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
vi.mock('@/lib/socket', () => ({ getSocket: () => null }));
vi.mock('@/integrations/supabase/safeClient', async () => ({ hasWorkspaceCloud: false, supabase: (await import('./helpers/mesaReal')).nuvemFalsa }));
import { useMapStore } from '@/stores/useMapStore';
import { executarAcaoAtiva, planejarDano, danoAposTR, moverForcado, parseDados } from '@/lib/omni/acaoAtiva';
import type { AcaoAtivaConfig } from '@/lib/omni/tipos';
import { ficha, montarMesa, limparMesa, comoTela, pegarFicha, forcarDados, CASA } from './helpers/mesaReal';

const vinganca: AcaoAtivaConfig = {
  id: 'v', nome: 'Vingança Agulhada', acao: 'comum', custoPE: '4', alcanceM: 6,
  teste: 'tr', tr: 'fortitude', cd: '15', metadeNoSucesso: true, dano: '6d8', tipoDano: 'Impacto',
  efeitos: [{ tipo: 'puxar', metros: 4.5 }, { tipo: 'condicao', condicao: 'exposto', rodadas: 1 }],
};
const montar = (inimigoX: number) => montarMesa([
  ficha('heroi', { peCurrent: 20, actionsCurrent: 1 }),
  ficha('alvo', { category: 'INIMIGO', hpCurrent: 200, hpMax: 200, escCurrent: 0 }),
], { heroi: [0, 0], alvo: [inimigoX, 0] });
const posAlvo = () => (useMapStore.getState().entities as Record<string, { x: number }>)['e-alvo'].x / CASA;

beforeEach(() => comoTela({ profileId: null, role: 'MASTER' }));
afterEach(() => limparMesa());

describe('regras puras', () => {
  it('dados, cargas e crítico', () => {
    expect(parseDados('2d8+3')).toEqual({ grupos: [{ count: 2, sides: 8 }], fixo: 3 });
    expect(planejarDano('2d8', '1d8', 3, false).grupos).toEqual([{ count: 2, sides: 8 }, { count: 3, sides: 8 }]);
    expect(planejarDano('2d8+2', undefined, 0, true)).toEqual({ grupos: [{ count: 4, sides: 8 }], fixo: 2 });
    expect(danoAposTR(21, true, true)).toBe(10);
    expect(danoAposTR(21, true, false)).toBe(0);
    expect(danoAposTR(21, false, true)).toBe(21);
  });
  it('puxar para ao lado do atacante; empurrar afasta', () => {
    const g = { dpi: 70, metersPerCell: 1.5 } as never;
    expect(moverForcado({ x: 0, y: 0 }, { x: 70 * 4, y: 0 }, 4.5, 'puxar', g).x).toBe(70);
    expect(moverForcado({ x: 0, y: 0 }, { x: 70 * 2, y: 0 }, 4.5, 'puxar', g).x).toBe(70);
    expect(moverForcado({ x: 0, y: 0 }, { x: 70, y: 0 }, 3, 'empurrar', g).x).toBe(210);
  });
});

describe('Vingança Agulhada (TR)', () => {
  it('falha: dano cheio, puxado e Exposto; paga 4 PE e a ação', async () => {
    montar(4);
    forcarDados(1, 8, 8, 8, 8, 8, 8);
    const r = await executarAcaoAtiva('heroi', vinganca, 'alvo');
    expect(r.ok).toBe(true);
    expect(pegarFicha('heroi').peCurrent).toBe(16);
    expect(pegarFicha('heroi').actionsCurrent).toBe(0);
    expect(pegarFicha('alvo').hpCurrent).toBeLessThan(200);
    expect(posAlvo()).toBe(1);
    expect((pegarFicha('alvo').activeConditions ?? []).some((c) => c.conditionId === 'exposto')).toBe(true);
  });
  it('sucesso: metade e sem puxão/condição', async () => {
    montar(4);
    forcarDados(20, 8, 8, 8, 8, 8, 8);
    const r = await executarAcaoAtiva('heroi', vinganca, 'alvo');
    expect(r.ok).toBe(true);
    expect(posAlvo()).toBe(4);
    expect((pegarFicha('alvo').activeConditions ?? []).length).toBe(0);
  });
  it('fora de alcance e PE insuficiente bloqueiam sem gastar', async () => {
    montar(6); // 6 casas = 7,5 m de toque > 6 m
    const r = await executarAcaoAtiva('heroi', vinganca, 'alvo');
    expect(r.ok).toBe(false);
    expect(pegarFicha('heroi').peCurrent).toBe(20);
    montar(2);
    const r2 = await executarAcaoAtiva('heroi', { ...vinganca, custoPE: '99' }, 'alvo');
    expect(r2.ok).toBe(false);
  });
});

describe('consumo de cargas', () => {
  it('consome todas as cargas e exige o mínimo', async () => {
    const cfg: AcaoAtivaConfig = { id: 'c', nome: 'Corte', acao: 'comum', custoPE: '10', alcanceM: 0, teste: 'nenhum', dano: '2', dadosPorCarga: '1', consumirContador: { nome: 'rancor', minimo: 1 } };
    montar(1);
    expect((await executarAcaoAtiva('heroi', cfg, 'alvo')).ok).toBe(false);
    montarMesa([
      ficha('heroi', { peCurrent: 20, actionsCurrent: 1, omniCounters: { rancor: 3 } }),
      ficha('alvo', { category: 'INIMIGO', hpCurrent: 200, hpMax: 200, escCurrent: 0 }),
    ], { heroi: [0, 0], alvo: [1, 0] });
    const r = await executarAcaoAtiva('heroi', cfg, 'alvo');
    expect(r.ok && r.dano).toBe(5);
    expect(pegarFicha('heroi').omniCounters?.rancor ?? 0).toBe(0);
    expect(pegarFicha('heroi').peCurrent).toBe(10);
  });
});
